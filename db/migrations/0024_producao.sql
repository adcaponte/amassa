-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline. Roteiro 16 (plano 06.1-15).
-- D-09: publicada JUNTO com o código e com a `0025`, e aplicada numa sessão só de `db:migrate`,
-- logo depois de o job `implantar` terminar. Só cria, religa e grava o dado do D-02; quem apaga as
-- tabelas de Encomendas é a `0025`.
--
-- Gerada pelo plano 06.1-01 (Fase 06.1 — Produção, o traçador) com
-- `npm run db:generate -- --name producao`, a partir de `db/schema.ts` (enums `tipo_ordem`,
-- `caminho_ordem`, `status_ordem`, `etapa_producao`, `destino_extras`, `material_da_ordem`; tabelas
-- `ordens_producao`, `ordem_etapas`, `ordem_pecas`; coluna `movimentacoes_estoque.material_da_ordem`;
-- os vínculos `orcamentos.encomenda_id` e `movimentacoes_estoque.encomenda_id` apontando para a
-- ordem). O `drizzle-kit` rodou sem pergunta nenhuma: o schema desta etapa só ACRESCENTA — as
-- tabelas `encomendas*` continuam nele (06.1-RESEARCH.md, Pitfall 3).
--
-- O arquivo foi REORGANIZADO à mão depois de gerado, na ordem do Pitfall 4 da pesquisa — cada
-- bloco separado pelo marcador de instrução do Drizzle (nunca escrito dentro de um comentário:
-- o migrador parte o arquivo nele, até no meio de uma linha comentada).
--
-- (2) o DDL gerado que CRIA (tipos, tabelas, coluna nova, chaves das tabelas novas, índices),
--     mantido como saiu do `drizzle-kit`;
-- (3) o dado do D-02, à mão: (a) as ordens "aguardando o sinal" → (b) as etapas → (c) as peças →
--     (d) anular os vínculos que não viraram ordem;
-- (4) a troca de alvo das duas chaves estrangeiras e a troca do `check` do livro — o gerador
--     punha o `DROP` antes e o `ADD` no meio do DDL; aqui eles vêm DEPOIS do bloco (d), senão o
--     `ADD CONSTRAINT` recusaria com 23503 as referências velhas a `encomendas`;
-- (5) os gatilhos `tocar_atualizado_em_*` das três tabelas novas (o Drizzle não gera gatilho);
-- (6) o `revoke delete` das três tabelas novas para `amassa_app`.
--
-- Tudo roda numa transação só (o migrador do Drizzle aplica todas as pendentes numa transação):
-- se qualquer bloco falhar, nada fica pela metade.
--
-- Esta migração é aplicada à mão, e NÃO por nenhum executor: as únicas bases que ela toca antes do dono são
-- o Postgres efêmero de `npm run test:migracoes` e de `npm run test:e2e`. Nunca `drizzle-kit push`.

CREATE TYPE "public"."caminho_ordem" AS ENUM('completo', 'biscoito');--> statement-breakpoint
CREATE TYPE "public"."destino_extras" AS ENUM('estoque', 'sem_destino');--> statement-breakpoint
CREATE TYPE "public"."etapa_producao" AS ENUM('producao', 'secagem', 'queima1', 'esmaltacao', 'queima2', 'entrega');--> statement-breakpoint
CREATE TYPE "public"."material_da_ordem" AS ENUM('argila', 'esmalte');--> statement-breakpoint
CREATE TYPE "public"."status_ordem" AS ENUM('aguardando_sinal', 'ativa', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_ordem" AS ENUM('encomenda', 'casa');--> statement-breakpoint
CREATE TABLE "ordem_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ordem_id" uuid NOT NULL,
	"etapa" "etapa_producao" NOT NULL,
	"posicao" integer NOT NULL,
	"dias_previstos" integer NOT NULL,
	"feita_em" date,
	"passaram" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordem_etapas_ordem_etapa_uk" UNIQUE("ordem_id","etapa"),
	CONSTRAINT "ordem_etapas_ordem_posicao_uk" UNIQUE("ordem_id","posicao"),
	CONSTRAINT "ordem_etapas_posicao_faixa" CHECK ("ordem_etapas"."posicao" between 0 and 5),
	CONSTRAINT "ordem_etapas_dias_previstos_faixa" CHECK ("ordem_etapas"."dias_previstos" between 1 and 365),
	CONSTRAINT "ordem_etapas_passaram_nao_negativo" CHECK ("ordem_etapas"."passaram" is null or "ordem_etapas"."passaram" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ordem_pecas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ordem_id" uuid NOT NULL,
	"posicao" integer NOT NULL,
	"ficha_id" uuid,
	"item_catalogo_id" uuid,
	"descricao" text NOT NULL,
	"quantidade" integer NOT NULL,
	"a_mais" integer DEFAULT 0 NOT NULL,
	"cor" text,
	"personalizacao" text,
	"perdidas" integer,
	"destino_extras" "destino_extras",
	"para_estoque" integer,
	"sem_destino" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordem_pecas_ordem_posicao_uk" UNIQUE("ordem_id","posicao"),
	CONSTRAINT "ordem_pecas_posicao_nao_negativa" CHECK ("ordem_pecas"."posicao" >= 0),
	CONSTRAINT "ordem_pecas_descricao_comprimento" CHECK (length(trim("ordem_pecas"."descricao")) between 1 and 160),
	CONSTRAINT "ordem_pecas_quantidade_faixa" CHECK ("ordem_pecas"."quantidade" between 1 and 100000),
	CONSTRAINT "ordem_pecas_a_mais_faixa" CHECK ("ordem_pecas"."a_mais" between 0 and 100000),
	CONSTRAINT "ordem_pecas_cor_comprimento" CHECK ("ordem_pecas"."cor" is null or length(trim("ordem_pecas"."cor")) between 1 and 80),
	CONSTRAINT "ordem_pecas_personalizacao_comprimento" CHECK ("ordem_pecas"."personalizacao" is null or length(trim("ordem_pecas"."personalizacao")) between 1 and 200),
	CONSTRAINT "ordem_pecas_perdidas_faixa" CHECK ("ordem_pecas"."perdidas" is null or "ordem_pecas"."perdidas" between 0 and "ordem_pecas"."quantidade" + "ordem_pecas"."a_mais"),
	CONSTRAINT "ordem_pecas_conclusao_junta" CHECK (("ordem_pecas"."perdidas" is null and "ordem_pecas"."para_estoque" is null and "ordem_pecas"."sem_destino" is null) or ("ordem_pecas"."perdidas" is not null and "ordem_pecas"."para_estoque" is not null and "ordem_pecas"."sem_destino" is not null)),
	CONSTRAINT "ordem_pecas_destinos_cabem" CHECK ("ordem_pecas"."para_estoque" is null or ("ordem_pecas"."para_estoque" >= 0 and "ordem_pecas"."sem_destino" >= 0 and "ordem_pecas"."para_estoque" + "ordem_pecas"."sem_destino" <= "ordem_pecas"."quantidade" + "ordem_pecas"."a_mais" - "ordem_pecas"."perdidas"))
);
--> statement-breakpoint
CREATE TABLE "ordens_producao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "ordens_producao_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tipo" "tipo_ordem" NOT NULL,
	"caminho" "caminho_ordem" DEFAULT 'completo' NOT NULL,
	"status" "status_ordem" NOT NULL,
	"nome" text NOT NULL,
	"cliente_nome" text,
	"entrega_prometida" date,
	"inicio" date,
	"concluida_em" date,
	"entrega_parcial" boolean DEFAULT false NOT NULL,
	"cancelada_em" timestamp with time zone,
	"cancelada_por" uuid,
	"cancelada_pela_venda" boolean DEFAULT false NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordens_producao_numero_uk" UNIQUE("numero"),
	CONSTRAINT "ordens_producao_nome_comprimento" CHECK (length(trim("ordens_producao"."nome")) between 1 and 120),
	CONSTRAINT "ordens_producao_cliente_comprimento" CHECK ("ordens_producao"."cliente_nome" is null or length(trim("ordens_producao"."cliente_nome")) between 1 and 160),
	CONSTRAINT "ordens_producao_cliente_so_em_encomenda" CHECK ("ordens_producao"."tipo" = 'encomenda' or "ordens_producao"."cliente_nome" is null),
	CONSTRAINT "ordens_producao_aguardando_sem_inicio" CHECK (("ordens_producao"."status" = 'aguardando_sinal') = ("ordens_producao"."inicio" is null)),
	CONSTRAINT "ordens_producao_concluida_com_data" CHECK (("ordens_producao"."status" = 'concluida') = ("ordens_producao"."concluida_em" is not null)),
	CONSTRAINT "ordens_producao_cancelada_com_data" CHECK (("ordens_producao"."status" = 'cancelada') = ("ordens_producao"."cancelada_em" is not null)),
	CONSTRAINT "ordens_producao_cancelada_por" CHECK ("ordens_producao"."cancelada_em" is null or "ordens_producao"."cancelada_por" is not null),
	CONSTRAINT "ordens_producao_parcial_so_concluida" CHECK (not "ordens_producao"."entrega_parcial" or "ordens_producao"."status" = 'concluida'),
	CONSTRAINT "ordens_producao_pela_venda_so_cancelada" CHECK (not "ordens_producao"."cancelada_pela_venda" or "ordens_producao"."status" = 'cancelada')
);
--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD COLUMN "material_da_ordem" "material_da_ordem";--> statement-breakpoint
ALTER TABLE "ordem_etapas" ADD CONSTRAINT "ordem_etapas_ordem_id_ordens_producao_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."ordens_producao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_pecas" ADD CONSTRAINT "ordem_pecas_ordem_id_ordens_producao_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."ordens_producao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_pecas" ADD CONSTRAINT "ordem_pecas_ficha_id_fichas_precificacao_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_precificacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_pecas" ADD CONSTRAINT "ordem_pecas_item_catalogo_id_itens_catalogo_id_fk" FOREIGN KEY ("item_catalogo_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_cancelada_por_usuarios_id_fk" FOREIGN KEY ("cancelada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordens_producao" ADD CONSTRAINT "ordens_producao_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ordens_producao_status_idx" ON "ordens_producao" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ordens_producao_concluida_em_idx" ON "ordens_producao" USING btree ("concluida_em");
--> statement-breakpoint

-- (3) O DADO DO D-02, à mão (06.1-CONTEXT.md D-02; 06.1-RESEARCH.md §Pergunta 7). Orçamento já
-- aprovado e ainda ativo — que ganhou encomenda provisória na 04.5 — ganha a ordem nova
-- "aguardando o sinal", com os dados do orçamento. Sem nenhum caso, os `insert` não inserem nada e
-- os `update` não mudam nada (D-02: "se não houver nenhum, a migração não faz nada").
--
-- (a) Uma ordem por orçamento aprovado cuja encomenda provisória ainda está em andamento e cuja
--     venda não foi cancelada. O id da ordem É o id da encomenda: os vínculos (`orcamentos` e o
--     livro do Estoque) e os links antigos continuam valendo sem tradução.
insert into ordens_producao (id, tipo, caminho, status, nome, cliente_nome, entrega_prometida, criado_por)
select e.id, 'encomenda', 'completo', 'aguardando_sinal', e.nome, o.cliente_nome, o.entrega_prevista, o.criado_por
  from orcamentos o
  join encomendas e on e.id = o.encomenda_id
  join documentos d on d.id = o.documento_id
 where o.status = 'aprovado'
   and e.status in ('rascunho', 'em_producao')
   and d.cancelado_em is null;
--> statement-breakpoint

-- (b) As seis etapas do caminho completo, com os dias previstos padrão do D-10 — terceira cópia de
--     DIAS_PREVISTOS_PADRAO (lib/producao/etapas.ts) — tests/unit/producao-etapas.test.ts compara.
--     Neste instante só existem as ordens do bloco (a) em `ordens_producao`.
insert into ordem_etapas (ordem_id, etapa, posicao, dias_previstos)
select op.id, v.etapa::etapa_producao, v.posicao, v.dias
  from ordens_producao op
 cross join (values ('producao',0,5),('secagem',1,15),('queima1',2,1),('esmaltacao',3,1),('queima2',4,4),('entrega',5,6)) as v(etapa, posicao, dias);
--> statement-breakpoint

-- (c) As peças, das linhas do orçamento, na ordem de `orcamento_linhas.ordem`. A descrição vem do
--     SNAPSHOT congelado no envio (a mesma leitura por índice de `aprovarOrcamento`: a linha N do
--     snapshot é a N-ésima linha por `ordem`), com o nome da ficha de reserva; a ficha, a
--     quantidade, a cor e a personalização vêm da linha.
insert into ordem_pecas (ordem_id, posicao, ficha_id, descricao, quantidade, cor, personalizacao)
select o.encomenda_id, l.idx, l.ficha_id,
       coalesce(nullif(left(trim(o.snapshot->'linhas'->(l.idx)->>'nome'), 160), ''), left(f.nome, 160)),
       l.quantidade, l.cor, l.personalizacao
  from orcamentos o
  join ordens_producao op on op.id = o.encomenda_id
  join (select *, (row_number() over (partition by orcamento_id order by ordem) - 1)::int as idx
          from orcamento_linhas) l on l.orcamento_id = o.id
  join fichas_precificacao f on f.id = l.ficha_id;
--> statement-breakpoint

-- (d) Quem apontava para uma encomenda que NÃO virou ordem perde o vínculo — o mesmo efeito do
--     `on delete set null` de hoje. No livro do Estoque, a `nota` guarda o nome congelado da
--     encomenda (Pitfall 10 da Fase 06). O `update` no livro passa porque a migração roda como
--     DONO das tabelas; o `revoke update` da 0023 vale só para `amassa_app`.
update orcamentos set encomenda_id = null
 where encomenda_id is not null
   and encomenda_id not in (select id from ordens_producao);
--> statement-breakpoint
update movimentacoes_estoque set encomenda_id = null
 where encomenda_id is not null
   and encomenda_id not in (select id from ordens_producao);
--> statement-breakpoint

-- (4) Os dois vínculos mudam de alvo — DEPOIS do bloco (d): a partir daqui toda referência que
-- sobrou é a uma ordem. Mesmo nome de coluna (`encomenda_id`, o nome histórico do vínculo com a
-- ordem de produção), sem `on delete` (ordem não se apaga). SQL gerado pelo `drizzle-kit`, só
-- movido de lugar.
ALTER TABLE "orcamentos" DROP CONSTRAINT "orcamentos_encomenda_id_encomendas_id_fk";
--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" DROP CONSTRAINT "movimentacoes_estoque_encomenda_id_encomendas_id_fk";
--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_encomenda_id_ordens_producao_id_fk" FOREIGN KEY ("encomenda_id") REFERENCES "public"."ordens_producao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_encomenda_id_ordens_producao_id_fk" FOREIGN KEY ("encomenda_id") REFERENCES "public"."ordens_producao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A troca do `check` do livro: o vínculo com a ordem passa a valer na saída "consumo em
-- encomenda" E na entrada da produção (peça pronta que entra no Estoque na conclusão); a entrada da
-- produção exige a ordem; `material_da_ordem` só na baixa ligada a uma ordem.
ALTER TABLE "movimentacoes_estoque" DROP CONSTRAINT "movimentacoes_estoque_encomenda_so_no_destino_encomenda";--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_ordem_so_no_destino_encomenda_ou_producao" CHECK ("movimentacoes_estoque"."encomenda_id" is null or "movimentacoes_estoque"."destino" = 'encomenda' or "movimentacoes_estoque"."origem" = 'producao');--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_producao_com_ordem" CHECK ("movimentacoes_estoque"."origem" <> 'producao' or "movimentacoes_estoque"."encomenda_id" is not null);--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_material_da_ordem_so_na_baixa" CHECK ("movimentacoes_estoque"."material_da_ordem" is null or ("movimentacoes_estoque"."origem" = 'manual' and "movimentacoes_estoque"."destino" = 'encomenda' and "movimentacoes_estoque"."encomenda_id" is not null));
--> statement-breakpoint

-- (5) Os gatilhos `tocar_atualizado_em` das três tabelas novas, no molde de
-- `0006_gatilhos-encomendas.sql`. A função `tocar_atualizado_em()` já existe desde a 0002 (base
-- comum de datas). Recriação condicional (`drop trigger if exists` antes de `create trigger`):
-- reaplicar este bloco num banco parcialmente migrado não explode.
drop trigger if exists tocar_atualizado_em_ordens_producao on ordens_producao;
--> statement-breakpoint
create trigger tocar_atualizado_em_ordens_producao
  before update on ordens_producao
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_ordem_etapas on ordem_etapas;
--> statement-breakpoint
create trigger tocar_atualizado_em_ordem_etapas
  before update on ordem_etapas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_ordem_pecas on ordem_pecas;
--> statement-breakpoint
create trigger tocar_atualizado_em_ordem_pecas
  before update on ordem_pecas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (6) Nada se apaga na Produção — só "Cancelar ordem". A migração 0003 concede
-- select/insert/update/delete a `amassa_app` por `alter default privileges` em TODA tabela nova —
-- por isso este revoke precisa ser explícito. Ficam select, insert e update.
revoke delete on ordens_producao, ordem_etapas, ordem_pecas from amassa_app;
