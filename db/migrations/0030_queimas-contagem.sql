-- NÃO APLICAR sem o Roteiro 21 (docs/operacao/21-migracao-queimas.md) — backup antes.
-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline (migração aplicada à mão, por
-- alguém que está olhando).
-- Vem depois da 0029.
-- Acrescenta as tabelas `queima_contagens` e `queima_vendas` (D-07: várias vendas por queima, uma
-- por pessoa), os três itens do sistema “Queima externa P/M/G” (adotando item de mesmo nome, D-05),
-- as duas chaves da régua P · M · G (D-03) e troca dois checks por listas MAIORES
-- (`itens_catalogo_chave_do_sistema_valida` e `parametros_precificacao_chave_valida`) — nada do que
-- hoje vale passa a ser recusado. Nada é apagado nem renomeado.
--
-- Fase 06.4 — Queimas: contagem (06.4-CONTEXT.md, BRIEFING §2, §4 e §6):
--   * `queima_contagens`: uma linha por queima (PK = a queima, cascade); sem linha = "sem
--     contagem". Seis contadores 0..10000 e "saiu cheio" (padrão verdadeiro). Nenhuma coluna de
--     dono da peça nem de pagamento.
--   * `queima_vendas`: uma linha por venda das externas (PK = a venda: uma venda é de UMA queima),
--     com a quantidade P · M · G. "Lançado" é derivado das vendas não canceladas; o piso
--     "Σ lançado ≤ externas" mora em `lib/queimas/gravacao.ts`, sob a trava da queima.
--
-- Gerada com `npm run db:generate -- --name queimas-contagem` e completada à mão (cabeçalho,
-- gatilho, semente das Queimas, função do gatilho dos itens do sistema e régua). Desfazer: outra
-- migração — também aplicada à mão, depois de backup.

CREATE TABLE "queima_contagens" (
	"queima_id" uuid PRIMARY KEY NOT NULL,
	"internas_p" integer DEFAULT 0 NOT NULL,
	"internas_m" integer DEFAULT 0 NOT NULL,
	"internas_g" integer DEFAULT 0 NOT NULL,
	"externas_p" integer DEFAULT 0 NOT NULL,
	"externas_m" integer DEFAULT 0 NOT NULL,
	"externas_g" integer DEFAULT 0 NOT NULL,
	"saiu_cheio" boolean DEFAULT true NOT NULL,
	"contado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queima_contagens_internas_p_faixa" CHECK ("queima_contagens"."internas_p" between 0 and 10000),
	CONSTRAINT "queima_contagens_internas_m_faixa" CHECK ("queima_contagens"."internas_m" between 0 and 10000),
	CONSTRAINT "queima_contagens_internas_g_faixa" CHECK ("queima_contagens"."internas_g" between 0 and 10000),
	CONSTRAINT "queima_contagens_externas_p_faixa" CHECK ("queima_contagens"."externas_p" between 0 and 10000),
	CONSTRAINT "queima_contagens_externas_m_faixa" CHECK ("queima_contagens"."externas_m" between 0 and 10000),
	CONSTRAINT "queima_contagens_externas_g_faixa" CHECK ("queima_contagens"."externas_g" between 0 and 10000),
	CONSTRAINT "queima_contagens_alguma_peca" CHECK ("queima_contagens"."internas_p" + "queima_contagens"."internas_m" + "queima_contagens"."internas_g" + "queima_contagens"."externas_p" + "queima_contagens"."externas_m" + "queima_contagens"."externas_g" > 0)
);
--> statement-breakpoint
CREATE TABLE "queima_vendas" (
	"documento_id" uuid PRIMARY KEY NOT NULL,
	"queima_id" uuid NOT NULL,
	"quantidade_p" integer DEFAULT 0 NOT NULL,
	"quantidade_m" integer DEFAULT 0 NOT NULL,
	"quantidade_g" integer DEFAULT 0 NOT NULL,
	"lancado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queima_vendas_p_faixa" CHECK ("queima_vendas"."quantidade_p" between 0 and 10000),
	CONSTRAINT "queima_vendas_m_faixa" CHECK ("queima_vendas"."quantidade_m" between 0 and 10000),
	CONSTRAINT "queima_vendas_g_faixa" CHECK ("queima_vendas"."quantidade_g" between 0 and 10000),
	CONSTRAINT "queima_vendas_alguma_peca" CHECK ("queima_vendas"."quantidade_p" + "queima_vendas"."quantidade_m" + "queima_vendas"."quantidade_g" > 0)
);
--> statement-breakpoint
ALTER TABLE "itens_catalogo" DROP CONSTRAINT "itens_catalogo_chave_do_sistema_valida";--> statement-breakpoint
ALTER TABLE "parametros_precificacao" DROP CONSTRAINT "parametros_precificacao_chave_valida";--> statement-breakpoint
ALTER TABLE "queima_contagens" ADD CONSTRAINT "queima_contagens_queima_id_queimas_id_fk" FOREIGN KEY ("queima_id") REFERENCES "public"."queimas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queima_contagens" ADD CONSTRAINT "queima_contagens_contado_por_usuarios_id_fk" FOREIGN KEY ("contado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queima_vendas" ADD CONSTRAINT "queima_vendas_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queima_vendas" ADD CONSTRAINT "queima_vendas_queima_id_queima_contagens_queima_id_fk" FOREIGN KEY ("queima_id") REFERENCES "public"."queima_contagens"("queima_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queima_vendas" ADD CONSTRAINT "queima_vendas_lancado_por_usuarios_id_fk" FOREIGN KEY ("lancado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queima_vendas_queima_idx" ON "queima_vendas" USING btree ("queima_id");--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_chave_do_sistema_valida" CHECK ("itens_catalogo"."chave_do_sistema" is null or "itens_catalogo"."chave_do_sistema" in ('mensalidade','inscricao_oficina','uso_livre_hora','queima_externa_p','queima_externa_m','queima_externa_g'));--> statement-breakpoint
ALTER TABLE "parametros_precificacao" ADD CONSTRAINT "parametros_precificacao_chave_valida" CHECK ("parametros_precificacao"."chave" in (
        'material_argila','material_esmalte','trabalho_hora','forno_tarifa_energia',
        'forno_kwh_biscoito','forno_kwh_esmalte','forno_largura_util','forno_profundidade_util',
        'forno_altura_util','forno_folga_entre_pecas','forno_prateleira_e_pilar',
        'forno_fator_biscoito','forno_desgaste_por_fornada','perda_unica','preco_lucro',
        'preco_folga_negociacao','preco_imposto_sobre_venda','preco_comissao_galeria',
        'queima_regua_p_ate','queima_regua_m_ate'
      ));
--> statement-breakpoint

-- (à mão) O gatilho `tocar_atualizado_em` de `queima_contagens`, no molde da 0029. A função
-- `tocar_atualizado_em()` já existe desde a 0002. Recriação condicional (`drop trigger if exists`
-- antes de `create trigger`): reaplicar este bloco num banco parcialmente migrado não explode.
-- `queima_vendas` não tem `atualizado_em`: o vínculo só nasce, nunca é editado.
drop trigger if exists tocar_atualizado_em_queima_contagens on queima_contagens;
--> statement-breakpoint
create trigger tocar_atualizado_em_queima_contagens
  before update on queima_contagens
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- >>> semente das Queimas (marcador lido por conferirQueimas, em scripts/testar-migracoes.mjs)
-- (à mão) D-05: os três itens do sistema "Queima externa P/M/G", achados por CHAVE (nunca pelo
-- nome editável), no molde da semente da 0026. Sem preço (D-05/AGE-17 — o dono cadastra em
-- Cadastros → Catálogo), na venda, sem estoque, ativos. ANTES de criar, ADOTA o item que o dono já
-- tenha cadastrado com o mesmo nome: só item ATIVO, SEM chave e SEM controle de estoque (vender um
-- item com estoque daria baixa no livro — pesquisa A8), comparado por `nome_normalizado()` (0026),
-- o mais antigo por `criado_em, id`. Idempotente: reaplicar não duplica nada (a adoção só roda se a
-- chave ainda não existe; a criação não faz nada se a chave já existe).
--
-- (a) Garantir a categoria "Queima externa" (semente 0016) — se o dono a renomeou ou apagou, ela é
-- recriada; senão a subconsulta da criação devolveria nada e o item não nasceria.
insert into categorias (nome, grupo, area)
select 'Queima externa', 'receita', 'pecas'
where not exists (
  select 1 from categorias where lower(trim(nome)) = lower(trim('Queima externa'))
);
--> statement-breakpoint
-- (b) P: adotar, depois criar.
update itens_catalogo i
   set chave_do_sistema = 'queima_externa_p',
       aparece_na_venda = true,
       categoria_venda_id = coalesce(
         i.categoria_venda_id,
         (select c.id from categorias c where lower(trim(c.nome)) = lower(trim('Queima externa')))
       )
 where i.id = (
         select candidato.id
           from itens_catalogo candidato
          where candidato.chave_do_sistema is null
            and candidato.ativo
            and not candidato.controla_estoque
            and nome_normalizado(candidato.nome) = nome_normalizado('Queima externa P')
          order by candidato.criado_em, candidato.id
          limit 1
       )
   and not exists (select 1 from itens_catalogo where chave_do_sistema = 'queima_externa_p');
--> statement-breakpoint
insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, controla_estoque, ativo, chave_do_sistema)
select 'Queima externa P', c.id, null, true, false, true, 'queima_externa_p'
  from categorias c
 where lower(trim(c.nome)) = lower(trim('Queima externa'))
on conflict (chave_do_sistema) do nothing;
--> statement-breakpoint
-- (c) M: adotar, depois criar.
update itens_catalogo i
   set chave_do_sistema = 'queima_externa_m',
       aparece_na_venda = true,
       categoria_venda_id = coalesce(
         i.categoria_venda_id,
         (select c.id from categorias c where lower(trim(c.nome)) = lower(trim('Queima externa')))
       )
 where i.id = (
         select candidato.id
           from itens_catalogo candidato
          where candidato.chave_do_sistema is null
            and candidato.ativo
            and not candidato.controla_estoque
            and nome_normalizado(candidato.nome) = nome_normalizado('Queima externa M')
          order by candidato.criado_em, candidato.id
          limit 1
       )
   and not exists (select 1 from itens_catalogo where chave_do_sistema = 'queima_externa_m');
--> statement-breakpoint
insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, controla_estoque, ativo, chave_do_sistema)
select 'Queima externa M', c.id, null, true, false, true, 'queima_externa_m'
  from categorias c
 where lower(trim(c.nome)) = lower(trim('Queima externa'))
on conflict (chave_do_sistema) do nothing;
--> statement-breakpoint
-- (d) G: adotar, depois criar.
update itens_catalogo i
   set chave_do_sistema = 'queima_externa_g',
       aparece_na_venda = true,
       categoria_venda_id = coalesce(
         i.categoria_venda_id,
         (select c.id from categorias c where lower(trim(c.nome)) = lower(trim('Queima externa')))
       )
 where i.id = (
         select candidato.id
           from itens_catalogo candidato
          where candidato.chave_do_sistema is null
            and candidato.ativo
            and not candidato.controla_estoque
            and nome_normalizado(candidato.nome) = nome_normalizado('Queima externa G')
          order by candidato.criado_em, candidato.id
          limit 1
       )
   and not exists (select 1 from itens_catalogo where chave_do_sistema = 'queima_externa_g');
--> statement-breakpoint
insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, controla_estoque, ativo, chave_do_sistema)
select 'Queima externa G', c.id, null, true, false, true, 'queima_externa_g'
  from categorias c
 where lower(trim(c.nome)) = lower(trim('Queima externa'))
on conflict (chave_do_sistema) do nothing;
--> statement-breakpoint
-- <<< semente das Queimas

-- (à mão) O gatilho `travar_item_do_sistema` (0026) com a frase escolhida pela CHAVE: os itens das
-- Queimas dizem "usado pelas Queimas"; os três da Agenda continuam com a frase LITERAL da 0026, sem
-- mudar uma letra. O mesmo corpo, o mesmo `errcode` P0001; a função é trocada no lugar (o gatilho
-- da 0026 continua apontando para ela — não é recriado). A frase da tela vem de
-- `lib/cadastros/textos.ts` (plano 04); a detecção em `lib/cadastros/acoes.ts` olha o `where` com o
-- nome da função, então as duas frases chegam ao mesmo tratamento.
create or replace function travar_item_do_sistema()
returns trigger
language plpgsql
as $$
declare
  v_mensagem text;
begin
  if old.chave_do_sistema is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE'
     or new.ativo = false
     or new.aparece_na_venda = false
     or new.chave_do_sistema is distinct from old.chave_do_sistema then
    if old.chave_do_sistema like 'queima_externa_%' then
      v_mensagem := 'Este item é usado pelas Queimas e não se desativa. Nome, preço e categoria podem mudar.';
    else
      v_mensagem := 'Este item é usado pela Agenda e não se desativa. Nome, preço e categoria podem mudar.';
    end if;
    raise exception using
      errcode = 'P0001',
      message = v_mensagem;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

-- >>> régua das Queimas (marcador lido por conferirQueimas, em scripts/testar-migracoes.mjs)
-- (à mão) D-03: a régua P · M · G, em `parametros_precificacao` (com histórico, como os outros
-- parâmetros), na escala cm × 1000 do catálogo de parâmetros: P até 10 cm (10000), M até 25 cm
-- (25000), G maior que isso (briefing §2). `vigente_desde` é a data FIXA do dia em que o dono
-- definiu a régua (20/09/2026), nunca o relógio do Postgres (lição da 0021: `current_date` em UTC
-- datava a semente de amanhã entre 21h e meia-noite de Brasília). Idempotente pela chave
-- (chave, vigente_desde).
insert into parametros_precificacao (chave, valor_inteiro, medido, vigente_desde)
values
  ('queima_regua_p_ate', 10000, false, '2026-09-20'),
  ('queima_regua_m_ate', 25000, false, '2026-09-20')
on conflict (chave, vigente_desde) do nothing;
--> statement-breakpoint
-- <<< régua das Queimas
