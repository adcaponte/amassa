-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline. Roteiro 17 (plano 05-16).
-- D-15: publicada JUNTO com o código e aplicada numa sessão só de `db:migrate`, logo depois de o
-- job `implantar` terminar. Só acrescenta: nada é apagado nem renomeado.
--
-- Gerada pelo plano 05-01 (Fase 5 — Agenda, o traçador) com `npm run db:generate -- --name agenda`,
-- a partir de `db/schema.ts`: enums `tipo_evento`, `tipo_inscricao`, `presenca`, `estado_uso_livre`
-- e o valor novo `uso_livre` em `destino_saida` (D-06); tabelas `clientes`, `turmas`,
-- `turma_alunos`, `eventos`, `inscricoes`, `mensalidades`, `usos_livres`, `usos_livres_material`;
-- colunas `documentos.cliente_id` (D-01), `movimentacoes_estoque.uso_livre_id` (D-06) e
-- `itens_catalogo.chave_do_sistema` (D-17). O `drizzle-kit` rodou sem pergunta nenhuma.
--
-- D-01 — "ACRESCENTAR AO LADO AGORA, PROMOVER DEPOIS" (decisão de identidade do dono): `clientes`
-- nasce AO LADO de `documentos.pessoa_nome`, que continua com o mesmo tipo, o mesmo check e sendo
-- preenchido por toda venda; `documentos.cliente_id` é NULO por padrão, sem `on delete`, com o
-- check `documentos_cliente_exige_pessoa_nome` (`cliente_id is null or pessoa_nome is not null`);
-- só as vendas criadas pela Agenda gravam o vínculo (planos 05-11 e 05-12). A Venda manual, o
-- Orçamento (`orcamentos.cliente_nome`) e a Produção (`ordens_producao.cliente_nome`) continuam com
-- texto livre nesta fase — ligá-los ao cadastro é a ideia adiada do CONTEXT, e ninguém "corrige"
-- isto apagando `pessoa_nome` nem tornando `cliente_id` obrigatório.
--
-- O ENUM NOVO (D-06, Pitfall 1 da pesquisa): o migrador do Drizzle aplica todas as pendentes numa
-- transação só, e o Postgres 17 recusa o literal de um valor de enum acrescentado na mesma
-- transação ("unsafe use of new value"). Por isso os dois `check`s do livro comparam o destino
-- COMO TEXTO (`destino::text = 'uso_livre'`), e nenhuma linha desta migração insere ou atualiza dado
-- com esse valor — nenhum literal `uso_livre` aparece fora de `::text`.
--
-- Blocos, separados pelo marcador de instrução do Drizzle (nunca escrito dentro de um comentário:
-- o migrador parte o arquivo nele, até no meio de uma linha comentada):
-- (1) este cabeçalho;
-- (2) a função `nome_normalizado()` — ANTES do DDL, porque o índice de `clientes` a usa;
-- (3) o DDL gerado, como saiu do `drizzle-kit`;
-- (4) a semente das duas categorias e dos três itens do sistema (D-04, D-17, AGE-17);
-- (5) o gatilho `travar_item_do_sistema` (D-17);
-- (6) os gatilhos `tocar_atualizado_em_*` das oito tabelas novas;
-- (7) o `revoke delete` de `clientes`, `turmas`, `turma_alunos` e `mensalidades`.
--
-- Esta migração é aplicada à mão, e NÃO por nenhum executor: as únicas bases que ela toca antes do dono são
-- o Postgres efêmero de `npm run test:migracoes` e de `npm run test:e2e`. Nunca `drizzle-kit push`.

-- (2) Nome normalizado: minúsculas, sem acento, espaços colapsados — "Joao" acha "João" no
-- celular. Receita de `amassa-plataforma/02-MODELO-DE-DADOS.md` §"Normalização de nomes":
-- `unaccent()` de um argumento não é `immutable`; a forma de dois argumentos, com o dicionário
-- explícito, é o que permite marcar a função como imutável e indexá-la. A extensão `unaccent` existe
-- desde a 0002. Use `nome_normalizado()` também nas consultas de busca, senão o índice não serve.
create or replace function nome_normalizado(t text)
returns text language sql immutable strict parallel safe as $$
  select lower(public.unaccent('public.unaccent'::regdictionary,
                               regexp_replace(trim(t), '\s+', ' ', 'g')));
$$;
--> statement-breakpoint

-- (3) O DDL gerado pelo `drizzle-kit`, como saiu.
CREATE TYPE "public"."estado_uso_livre" AS ENUM('reservado', 'no_espaco', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."presenca" AS ENUM('veio', 'faltou');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento" AS ENUM('turma', 'avulsa', 'fechado');--> statement-breakpoint
CREATE TYPE "public"."tipo_inscricao" AS ENUM('aluno', 'reposicao', 'experimental', 'oficina');--> statement-breakpoint
ALTER TYPE "public"."destino_saida" ADD VALUE 'uso_livre';--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"telefone" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_nome_comprimento" CHECK (length(trim("clientes"."nome")) between 1 and 160),
	CONSTRAINT "clientes_telefone_comprimento" CHECK ("clientes"."telefone" is null or length(trim("clientes"."telefone")) between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_evento" NOT NULL,
	"data" date NOT NULL,
	"inicio" time,
	"fim" time,
	"titulo" text,
	"turma_id" uuid,
	"vagas" integer,
	"preco_centavos" integer,
	"publico" boolean DEFAULT false NOT NULL,
	"cancelado_em" timestamp with time zone,
	"cancelado_por" uuid,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_turma_data_uk" UNIQUE("turma_id","data"),
	CONSTRAINT "eventos_turma_so_no_tipo_turma" CHECK (("eventos"."tipo" = 'turma') = ("eventos"."turma_id" is not null)),
	CONSTRAINT "eventos_fechado_sem_aula" CHECK ("eventos"."tipo" <> 'fechado' or ("eventos"."inicio" is null and "eventos"."fim" is null and "eventos"."vagas" is null and "eventos"."preco_centavos" is null and not "eventos"."publico" and "eventos"."cancelado_em" is null and "eventos"."titulo" is not null)),
	CONSTRAINT "eventos_aula_com_horario" CHECK ("eventos"."tipo" = 'fechado' or ("eventos"."inicio" is not null and "eventos"."fim" is not null and "eventos"."vagas" is not null and "eventos"."fim" > "eventos"."inicio")),
	CONSTRAINT "eventos_avulsa_com_titulo_e_preco" CHECK ("eventos"."tipo" <> 'avulsa' or ("eventos"."titulo" is not null and "eventos"."preco_centavos" is not null)),
	CONSTRAINT "eventos_titulo_comprimento" CHECK ("eventos"."titulo" is null or length(trim("eventos"."titulo")) between 1 and 120),
	CONSTRAINT "eventos_vagas_faixa" CHECK ("eventos"."vagas" is null or "eventos"."vagas" between 1 and 999),
	CONSTRAINT "eventos_preco_faixa" CHECK ("eventos"."preco_centavos" is null or "eventos"."preco_centavos" between 0 and 1000000000),
	CONSTRAINT "eventos_cancelado_por" CHECK ("eventos"."cancelado_em" is null or "eventos"."cancelado_por" is not null)
);
--> statement-breakpoint
CREATE TABLE "inscricoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_inscricao" NOT NULL,
	"presenca" "presenca",
	"direito_a_repor" boolean DEFAULT false NOT NULL,
	"cobrar" boolean DEFAULT false NOT NULL,
	"valor_centavos" integer,
	"documento_id" uuid,
	"dispensada_em" timestamp with time zone,
	"dispensada_por" uuid,
	"motivo_dispensa" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inscricoes_evento_cliente_uk" UNIQUE("evento_id","cliente_id"),
	CONSTRAINT "inscricoes_direito_so_com_falta" CHECK (not "inscricoes"."direito_a_repor" or ("inscricoes"."presenca" is not null and "inscricoes"."presenca" = 'faltou' and "inscricoes"."tipo" in ('aluno','experimental'))),
	CONSTRAINT "inscricoes_cobrar_com_valor" CHECK ("inscricoes"."cobrar" = ("inscricoes"."valor_centavos" is not null)),
	CONSTRAINT "inscricoes_reposicao_nao_cobra" CHECK ("inscricoes"."tipo" <> 'reposicao' or not "inscricoes"."cobrar"),
	CONSTRAINT "inscricoes_aluno_nao_cobra" CHECK ("inscricoes"."tipo" <> 'aluno' or not "inscricoes"."cobrar"),
	CONSTRAINT "inscricoes_oficina_cobra" CHECK ("inscricoes"."tipo" <> 'oficina' or "inscricoes"."cobrar"),
	CONSTRAINT "inscricoes_valor_faixa" CHECK ("inscricoes"."valor_centavos" is null or "inscricoes"."valor_centavos" between 0 and 1000000000),
	CONSTRAINT "inscricoes_venda_so_cobrada" CHECK ("inscricoes"."documento_id" is null or "inscricoes"."cobrar"),
	CONSTRAINT "inscricoes_dispensa_so_cobrada" CHECK ("inscricoes"."dispensada_em" is null or "inscricoes"."cobrar"),
	CONSTRAINT "inscricoes_dispensada_por" CHECK ("inscricoes"."dispensada_em" is null or "inscricoes"."dispensada_por" is not null),
	CONSTRAINT "inscricoes_motivo_so_com_dispensa" CHECK ("inscricoes"."motivo_dispensa" is null or ("inscricoes"."dispensada_em" is not null and length(trim("inscricoes"."motivo_dispensa")) between 1 and 200))
);
--> statement-breakpoint
CREATE TABLE "mensalidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turma_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"mes" date NOT NULL,
	"valor_centavos" integer NOT NULL,
	"aulas_restantes" integer,
	"aulas_no_mes" integer,
	"vencimento" date NOT NULL,
	"documento_id" uuid,
	"dispensada_em" timestamp with time zone,
	"dispensada_por" uuid,
	"motivo_dispensa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensalidades_turma_cliente_mes_uk" UNIQUE("turma_id","cliente_id","mes"),
	CONSTRAINT "mensalidades_mes_primeiro_dia" CHECK (extract(day from "mensalidades"."mes") = 1),
	CONSTRAINT "mensalidades_valor_faixa" CHECK ("mensalidades"."valor_centavos" between 1 and 1000000000),
	CONSTRAINT "mensalidades_proporcional_junto" CHECK (("mensalidades"."aulas_restantes" is null) = ("mensalidades"."aulas_no_mes" is null)),
	CONSTRAINT "mensalidades_proporcional_faixa" CHECK ("mensalidades"."aulas_restantes" is null or ("mensalidades"."aulas_restantes" > 0 and "mensalidades"."aulas_restantes" < "mensalidades"."aulas_no_mes")),
	CONSTRAINT "mensalidades_vencimento_no_mes" CHECK (date_trunc('month', "mensalidades"."vencimento")::date = "mensalidades"."mes"),
	CONSTRAINT "mensalidades_dispensada_por" CHECK ("mensalidades"."dispensada_em" is null or "mensalidades"."dispensada_por" is not null),
	CONSTRAINT "mensalidades_motivo_so_com_dispensa" CHECK ("mensalidades"."motivo_dispensa" is null or ("mensalidades"."dispensada_em" is not null and length(trim("mensalidades"."motivo_dispensa")) between 1 and 200))
);
--> statement-breakpoint
CREATE TABLE "turma_alunos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turma_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"entrou_em" date NOT NULL,
	"saiu_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turma_alunos_saida_depois_da_entrada" CHECK ("turma_alunos"."saiu_em" is null or "turma_alunos"."saiu_em" >= "turma_alunos"."entrou_em")
);
--> statement-breakpoint
CREATE TABLE "turmas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"dia_semana" smallint NOT NULL,
	"inicio" time NOT NULL,
	"fim" time NOT NULL,
	"vagas" integer NOT NULL,
	"mensalidade_centavos" integer NOT NULL,
	"dia_vencimento" integer NOT NULL,
	"publica" boolean DEFAULT true NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"desativada_em" timestamp with time zone,
	"desativada_por" uuid,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turmas_nome_comprimento" CHECK (length(trim("turmas"."nome")) between 1 and 120),
	CONSTRAINT "turmas_dia_semana_faixa" CHECK ("turmas"."dia_semana" between 0 and 6),
	CONSTRAINT "turmas_fim_depois_do_inicio" CHECK ("turmas"."fim" > "turmas"."inicio"),
	CONSTRAINT "turmas_vagas_faixa" CHECK ("turmas"."vagas" between 1 and 999),
	CONSTRAINT "turmas_mensalidade_faixa" CHECK ("turmas"."mensalidade_centavos" between 1 and 1000000000),
	CONSTRAINT "turmas_dia_vencimento_faixa" CHECK ("turmas"."dia_vencimento" between 1 and 28),
	CONSTRAINT "turmas_ativa_coerente" CHECK ("turmas"."ativa" = ("turmas"."desativada_em" is null)),
	CONSTRAINT "turmas_desativada_por" CHECK ("turmas"."desativada_em" is null or "turmas"."desativada_por" is not null)
);
--> statement-breakpoint
CREATE TABLE "usos_livres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"data" date NOT NULL,
	"chegada_prevista" time NOT NULL,
	"horas_previstas" integer NOT NULL,
	"pessoas" integer NOT NULL,
	"estado" "estado_uso_livre" DEFAULT 'reservado' NOT NULL,
	"chegada" time,
	"saida" time,
	"horas_cheias" integer,
	"preco_hora_centavos" integer,
	"valor_centavos" integer,
	"documento_id" uuid,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usos_livres_horas_previstas_faixa" CHECK ("usos_livres"."horas_previstas" between 1 and 12),
	CONSTRAINT "usos_livres_pessoas_faixa" CHECK ("usos_livres"."pessoas" between 1 and 50),
	CONSTRAINT "usos_livres_chegada_por_estado" CHECK (("usos_livres"."estado" = 'reservado') = ("usos_livres"."chegada" is null)),
	CONSTRAINT "usos_livres_encerrado_completo" CHECK (("usos_livres"."estado" = 'encerrado' and "usos_livres"."saida" is not null and "usos_livres"."horas_cheias" is not null and "usos_livres"."preco_hora_centavos" is not null and "usos_livres"."valor_centavos" is not null) or ("usos_livres"."estado" <> 'encerrado' and "usos_livres"."saida" is null and "usos_livres"."horas_cheias" is null and "usos_livres"."preco_hora_centavos" is null and "usos_livres"."valor_centavos" is null)),
	CONSTRAINT "usos_livres_saida_depois_da_chegada" CHECK ("usos_livres"."saida" is null or "usos_livres"."saida" > "usos_livres"."chegada"),
	CONSTRAINT "usos_livres_horas_cheias_faixa" CHECK ("usos_livres"."horas_cheias" is null or "usos_livres"."horas_cheias" between 1 and 24),
	CONSTRAINT "usos_livres_valor_faixa" CHECK ("usos_livres"."valor_centavos" is null or "usos_livres"."valor_centavos" between 0 and 1000000000),
	CONSTRAINT "usos_livres_venda_so_encerrado" CHECK ("usos_livres"."documento_id" is null or "usos_livres"."estado" = 'encerrado')
);
--> statement-breakpoint
CREATE TABLE "usos_livres_material" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uso_livre_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantidade_milesimos" bigint NOT NULL,
	"cobrar" boolean NOT NULL,
	"preco_unitario_centavos" integer,
	"valor_centavos" integer,
	"movimentacao_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usos_livres_material_movimentacao_uk" UNIQUE("movimentacao_id"),
	CONSTRAINT "usos_livres_material_quantidade_positiva" CHECK ("usos_livres_material"."quantidade_milesimos" > 0),
	CONSTRAINT "usos_livres_material_incluso_sem_preco" CHECK ("usos_livres_material"."cobrar" or ("usos_livres_material"."preco_unitario_centavos" is null and "usos_livres_material"."valor_centavos" is null)),
	CONSTRAINT "usos_livres_material_preco_junto" CHECK (("usos_livres_material"."preco_unitario_centavos" is null) = ("usos_livres_material"."valor_centavos" is null)),
	CONSTRAINT "usos_livres_material_cobrado_baixado_tem_preco" CHECK (not "usos_livres_material"."cobrar" or "usos_livres_material"."movimentacao_id" is null or "usos_livres_material"."preco_unitario_centavos" is not null)
);
--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD COLUMN "chave_do_sistema" text;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD COLUMN "uso_livre_id" uuid;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_cancelado_por_usuarios_id_fk" FOREIGN KEY ("cancelado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_dispensada_por_usuarios_id_fk" FOREIGN KEY ("dispensada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensalidades" ADD CONSTRAINT "mensalidades_dispensada_por_usuarios_id_fk" FOREIGN KEY ("dispensada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turma_alunos" ADD CONSTRAINT "turma_alunos_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turma_alunos" ADD CONSTRAINT "turma_alunos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_desativada_por_usuarios_id_fk" FOREIGN KEY ("desativada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres_material" ADD CONSTRAINT "usos_livres_material_uso_livre_id_usos_livres_id_fk" FOREIGN KEY ("uso_livre_id") REFERENCES "public"."usos_livres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres_material" ADD CONSTRAINT "usos_livres_material_item_id_itens_catalogo_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres_material" ADD CONSTRAINT "usos_livres_material_movimentacao_id_movimentacoes_estoque_id_fk" FOREIGN KEY ("movimentacao_id") REFERENCES "public"."movimentacoes_estoque"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_nome_normalizado_idx" ON "clientes" USING btree (nome_normalizado("nome"));--> statement-breakpoint
CREATE INDEX "eventos_data_idx" ON "eventos" USING btree ("data");--> statement-breakpoint
CREATE INDEX "inscricoes_cliente_idx" ON "inscricoes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "inscricoes_documento_idx" ON "inscricoes" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "mensalidades_documento_idx" ON "mensalidades" USING btree ("documento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "turma_alunos_ativo_uk" ON "turma_alunos" USING btree ("turma_id","cliente_id") WHERE "turma_alunos"."saiu_em" is null;--> statement-breakpoint
CREATE INDEX "usos_livres_data_idx" ON "usos_livres" USING btree ("data");--> statement-breakpoint
CREATE INDEX "usos_livres_documento_idx" ON "usos_livres" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "usos_livres_material_uso_idx" ON "usos_livres_material" USING btree ("uso_livre_id");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_uso_livre_id_usos_livres_id_fk" FOREIGN KEY ("uso_livre_id") REFERENCES "public"."usos_livres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_cliente_idx" ON "documentos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "movimentacoes_estoque_uso_livre_idx" ON "movimentacoes_estoque" USING btree ("uso_livre_id");--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_chave_do_sistema_uk" UNIQUE("chave_do_sistema");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_exige_pessoa_nome" CHECK ("documentos"."cliente_id" is null or "documentos"."pessoa_nome" is not null);--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_chave_do_sistema_valida" CHECK ("itens_catalogo"."chave_do_sistema" is null or "itens_catalogo"."chave_do_sistema" in ('mensalidade','inscricao_oficina','uso_livre_hora'));--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_uso_livre_so_no_destino_uso_livre" CHECK ("movimentacoes_estoque"."uso_livre_id" is null or "movimentacoes_estoque"."destino"::text = 'uso_livre');--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_destino_uso_livre_com_vinculo" CHECK ("movimentacoes_estoque"."destino" is null or "movimentacoes_estoque"."destino"::text <> 'uso_livre' or "movimentacoes_estoque"."uso_livre_id" is not null);
--> statement-breakpoint

-- >>> semente da Agenda (marcador lido por `conferirAgenda`, em scripts/testar-migracoes.mjs, que
-- reexecuta este trecho para provar que a semente é idempotente)
-- (4) SEMENTE (D-04, D-17, AGE-17), no molde da 0023. (a) Garantir as duas categorias de venda da
-- semente 0016 — se o dono renomeou ou apagou alguma, ela é recriada, senão a subconsulta do bloco
-- (b) devolveria nulo e o check `itens_catalogo_aparece_exige_categoria_venda` derrubaria a
-- migração inteira. Idempotente — `where not exists` sobre o nome normalizado das categorias (o
-- mesmo critério do índice único `categorias_nome_normalizado_idx`).
insert into categorias (nome, grupo, area)
select 'Aulas e oficinas', 'receita', 'espaco'
where not exists (
  select 1 from categorias where lower(trim(nome)) = lower(trim('Aulas e oficinas'))
);
--> statement-breakpoint
insert into categorias (nome, grupo, area)
select 'Uso do espaço', 'receita', 'espaco'
where not exists (
  select 1 from categorias where lower(trim(nome)) = lower(trim('Uso do espaço'))
);
--> statement-breakpoint

-- (b) Os três itens que a Agenda acha por CÓDIGO (`chave_do_sistema`), nunca pelo nome editável.
-- Preço NULO ("valor na hora"): o da mensalidade vem da turma, o da oficina vem do evento, e o da
-- hora do uso livre o dono preenche em Cadastros — nenhum preço no código (AGE-17). Aparecem na venda
-- (exigido por `lancarVenda`), não controlam estoque. Idempotente pela chave única.
insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, controla_estoque, ativo, chave_do_sistema)
select 'Mensalidade', c.id, null, true, false, true, 'mensalidade'
  from categorias c
 where lower(trim(c.nome)) = lower(trim('Aulas e oficinas'))
on conflict (chave_do_sistema) do nothing;
--> statement-breakpoint
insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, controla_estoque, ativo, chave_do_sistema)
select 'Inscrição em oficina', c.id, null, true, false, true, 'inscricao_oficina'
  from categorias c
 where lower(trim(c.nome)) = lower(trim('Aulas e oficinas'))
on conflict (chave_do_sistema) do nothing;
--> statement-breakpoint
insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda, controla_estoque, ativo, chave_do_sistema)
select 'Uso livre (hora)', c.id, null, true, false, true, 'uso_livre_hora'
  from categorias c
 where lower(trim(c.nome)) = lower(trim('Uso do espaço'))
on conflict (chave_do_sistema) do nothing;
--> statement-breakpoint
-- <<< semente da Agenda

-- (5) D-17: item do sistema não se desativa, não sai da venda, não troca de chave e não se apaga
-- (Pitfall 14: "Mensalidade" desativada faria toda cobrança falhar). Nome, preço e categoria
-- continuam editáveis. Molde de `travar_grupo_e_area_da_categoria` (0015); a frase P0001 chega à
-- tela pelo tratamento que `lib/cadastros/acoes.ts` já faz.
create or replace function travar_item_do_sistema()
returns trigger
language plpgsql
as $$
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
    raise exception using
      errcode = 'P0001',
      message = 'Este item é usado pela Agenda e não se desativa. Nome, preço e categoria podem mudar.';
  end if;

  return new;
end;
$$;
--> statement-breakpoint

drop trigger if exists travar_item_do_sistema on itens_catalogo;
--> statement-breakpoint
create trigger travar_item_do_sistema
  before update or delete on itens_catalogo
  for each row execute function travar_item_do_sistema();
--> statement-breakpoint

-- (6) Os gatilhos `tocar_atualizado_em` das oito tabelas novas, no molde da 0024. A função
-- `tocar_atualizado_em()` já existe desde a 0002. Recriação condicional (`drop trigger if exists`
-- antes de `create trigger`): reaplicar este bloco num banco parcialmente migrado não explode.
drop trigger if exists tocar_atualizado_em_clientes on clientes;
--> statement-breakpoint
create trigger tocar_atualizado_em_clientes
  before update on clientes
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_turmas on turmas;
--> statement-breakpoint
create trigger tocar_atualizado_em_turmas
  before update on turmas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_turma_alunos on turma_alunos;
--> statement-breakpoint
create trigger tocar_atualizado_em_turma_alunos
  before update on turma_alunos
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_eventos on eventos;
--> statement-breakpoint
create trigger tocar_atualizado_em_eventos
  before update on eventos
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_inscricoes on inscricoes;
--> statement-breakpoint
create trigger tocar_atualizado_em_inscricoes
  before update on inscricoes
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_mensalidades on mensalidades;
--> statement-breakpoint
create trigger tocar_atualizado_em_mensalidades
  before update on mensalidades
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_usos_livres on usos_livres;
--> statement-breakpoint
create trigger tocar_atualizado_em_usos_livres
  before update on usos_livres
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_usos_livres_material on usos_livres_material;
--> statement-breakpoint
create trigger tocar_atualizado_em_usos_livres_material
  before update on usos_livres_material
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (7) Pessoa, turma, matrícula e mensalidade não se apagam: vendas, presenças e cobranças apontam
-- para elas (sair da turma é `saiu_em`; desativar a turma é `ativa = false`; não cobrar é a
-- dispensa). A migração 0003 concede select/insert/update/delete a `amassa_app` por
-- `alter default privileges` em TODA tabela nova — por isso este revoke precisa ser explícito. Só
-- `eventos` (o dia fechado; datas futuras de turma desativada), `inscricoes` (tirar da lista),
-- `usos_livres` (reserva não iniciada) e `usos_livres_material` (tirar antes de encerrar) se
-- apagam, sempre por ação sob trava.
revoke delete on clientes, turmas, turma_alunos, mensalidades from amassa_app;
