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
