CREATE TYPE "public"."area_financeira" AS ENUM('cafeteria', 'espaco', 'pecas', 'loja', 'geral');--> statement-breakpoint
CREATE TYPE "public"."forma_pagamento" AS ENUM('dinheiro', 'pix', 'cartao');--> statement-breakpoint
CREATE TYPE "public"."grupo_categoria" AS ENUM('receita', 'custo', 'geral', 'fora');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('venda', 'despesa');--> statement-breakpoint
CREATE TYPE "public"."unidade_estoque" AS ENUM('un', 'g', 'kg', 'ml', 'l', 'm');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"grupo" "grupo_categoria" NOT NULL,
	"area" "area_financeira" NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"chave_do_sistema" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_chave_do_sistema_uk" UNIQUE("chave_do_sistema"),
	CONSTRAINT "categorias_nome_comprimento" CHECK (length(trim("categorias"."nome")) between 1 and 120),
	CONSTRAINT "categorias_chave_do_sistema_valida" CHECK ("categorias"."chave_do_sistema" is null or "categorias"."chave_do_sistema" = 'diferenca'),
	CONSTRAINT "categorias_grupo_area_coerente" CHECK (("categorias"."grupo" in ('geral','fora')) = ("categorias"."area" = 'geral'))
);
--> statement-breakpoint
CREATE TABLE "configuracao_financeira" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linha_unica" boolean DEFAULT true NOT NULL,
	"taxa_cartao_pontos_base" integer DEFAULT 0 NOT NULL,
	"saldo_inicial_centavos" integer DEFAULT 0 NOT NULL,
	"data_saldo_inicial" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuracao_financeira_linha_unica_uk" UNIQUE("linha_unica"),
	CONSTRAINT "configuracao_financeira_linha_unica" CHECK ("configuracao_financeira"."linha_unica"),
	CONSTRAINT "configuracao_financeira_taxa_no_intervalo" CHECK ("configuracao_financeira"."taxa_cartao_pontos_base" between 0 and 10000),
	CONSTRAINT "configuracao_financeira_saldo_no_intervalo" CHECK ("configuracao_financeira"."saldo_inicial_centavos" >= -1000000000 and "configuracao_financeira"."saldo_inicial_centavos" <= 1000000000)
);
--> statement-breakpoint
CREATE TABLE "contas_fixas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"valor_esperado_centavos" integer NOT NULL,
	"dia_vencimento" integer NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contas_fixas_nome_comprimento" CHECK (length(trim("contas_fixas"."nome")) between 1 and 120),
	CONSTRAINT "contas_fixas_valor_no_intervalo" CHECK ("contas_fixas"."valor_esperado_centavos" >= 1 and "contas_fixas"."valor_esperado_centavos" <= 1000000000),
	CONSTRAINT "contas_fixas_dia_vencimento_no_intervalo" CHECK ("contas_fixas"."dia_vencimento" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "documento_linhas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"item_id" uuid,
	"descricao" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"quantidade_estoque" numeric(12, 3),
	"valor_centavos" integer NOT NULL,
	"parcela_diferenca_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_linhas_parcela_diferenca_uk" UNIQUE("parcela_diferenca_id"),
	CONSTRAINT "documento_linhas_descricao_comprimento" CHECK (length(trim("documento_linhas"."descricao")) between 1 and 160),
	CONSTRAINT "documento_linhas_quantidade_no_intervalo" CHECK ("documento_linhas"."quantidade" between 1 and 99999),
	CONSTRAINT "documento_linhas_quantidade_estoque_positiva" CHECK ("documento_linhas"."quantidade_estoque" is null or "documento_linhas"."quantidade_estoque" > 0),
	CONSTRAINT "documento_linhas_valor_conforme_diferenca" CHECK (("documento_linhas"."parcela_diferenca_id" is null and "documento_linhas"."valor_centavos" between 0 and 1000000000) or ("documento_linhas"."parcela_diferenca_id" is not null and "documento_linhas"."valor_centavos" between -1000000000 and 1000000000 and "documento_linhas"."valor_centavos" <> 0))
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "documentos_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tipo" "tipo_documento" NOT NULL,
	"data" date NOT NULL,
	"pessoa_nome" text,
	"titulo" text,
	"conta_fixa_id" uuid,
	"mes_referencia" date,
	"chave_de_importacao" text,
	"cancelado_em" timestamp with time zone,
	"cancelado_por" uuid,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documentos_numero_uk" UNIQUE("numero"),
	CONSTRAINT "documentos_conta_fixa_mes_uk" UNIQUE("conta_fixa_id","mes_referencia"),
	CONSTRAINT "documentos_chave_de_importacao_uk" UNIQUE("chave_de_importacao"),
	CONSTRAINT "documentos_pessoa_nome_comprimento" CHECK ("documentos"."pessoa_nome" is null or length(trim("documentos"."pessoa_nome")) between 1 and 160),
	CONSTRAINT "documentos_titulo_comprimento" CHECK ("documentos"."titulo" is null or length(trim("documentos"."titulo")) between 1 and 160),
	CONSTRAINT "documentos_mes_referencia_primeiro_dia" CHECK ("documentos"."mes_referencia" is null or extract(day from "documentos"."mes_referencia") = 1),
	CONSTRAINT "documentos_conta_fixa_e_mes_juntos" CHECK (("documentos"."conta_fixa_id" is null and "documentos"."mes_referencia" is null) or ("documentos"."conta_fixa_id" is not null and "documentos"."mes_referencia" is not null)),
	CONSTRAINT "documentos_cancelado_em_e_por_juntos" CHECK (("documentos"."cancelado_em" is null and "documentos"."cancelado_por" is null) or ("documentos"."cancelado_em" is not null and "documentos"."cancelado_por" is not null))
);
--> statement-breakpoint
CREATE TABLE "ficha_tecnica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"quantidade" numeric(12, 3) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ficha_tecnica_item_insumo_uk" UNIQUE("item_id","insumo_id"),
	CONSTRAINT "ficha_tecnica_item_diferente_insumo" CHECK ("ficha_tecnica"."item_id" <> "ficha_tecnica"."insumo_id"),
	CONSTRAINT "ficha_tecnica_quantidade_positiva" CHECK ("ficha_tecnica"."quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "itens_catalogo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"categoria_venda_id" uuid,
	"preco_venda_centavos" integer,
	"aparece_na_venda" boolean DEFAULT false NOT NULL,
	"atalho_venda" boolean DEFAULT false NOT NULL,
	"controla_estoque" boolean DEFAULT false NOT NULL,
	"atalho_compra" boolean DEFAULT false NOT NULL,
	"unidade" "unidade_estoque",
	"categoria_compra_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "itens_catalogo_nome_comprimento" CHECK (length(trim("itens_catalogo"."nome")) between 1 and 120),
	CONSTRAINT "itens_catalogo_preco_no_intervalo" CHECK ("itens_catalogo"."preco_venda_centavos" is null or ("itens_catalogo"."preco_venda_centavos" >= 1 and "itens_catalogo"."preco_venda_centavos" <= 1000000000)),
	CONSTRAINT "itens_catalogo_aparece_exige_categoria_venda" CHECK (not "itens_catalogo"."aparece_na_venda" or "itens_catalogo"."categoria_venda_id" is not null),
	CONSTRAINT "itens_catalogo_controla_exige_unidade_e_categoria_compra" CHECK (not "itens_catalogo"."controla_estoque" or ("itens_catalogo"."unidade" is not null and "itens_catalogo"."categoria_compra_id" is not null)),
	CONSTRAINT "itens_catalogo_aparece_ou_controla" CHECK ("itens_catalogo"."aparece_na_venda" or "itens_catalogo"."controla_estoque"),
	CONSTRAINT "itens_catalogo_atalho_venda_exige_aparece" CHECK (not "itens_catalogo"."atalho_venda" or "itens_catalogo"."aparece_na_venda"),
	CONSTRAINT "itens_catalogo_atalho_compra_exige_controla" CHECK (not "itens_catalogo"."atalho_compra" or "itens_catalogo"."controla_estoque")
);
--> statement-breakpoint
CREATE TABLE "parcelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"vencimento" date NOT NULL,
	"valor_centavos" integer NOT NULL,
	"forma" "forma_pagamento" NOT NULL,
	"pago_em" date,
	"pago_por" uuid,
	"taxa_pontos_base" integer,
	"valor_previsto_centavos" integer,
	"forma_prevista" "forma_pagamento",
	"rotulo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parcelas_documento_numero_uk" UNIQUE("documento_id","numero"),
	CONSTRAINT "parcelas_valor_no_intervalo" CHECK ("parcelas"."valor_centavos" >= 1 and "parcelas"."valor_centavos" <= 1000000000),
	CONSTRAINT "parcelas_taxa_no_intervalo" CHECK ("parcelas"."taxa_pontos_base" is null or ("parcelas"."taxa_pontos_base" >= 0 and "parcelas"."taxa_pontos_base" <= 10000)),
	CONSTRAINT "parcelas_valor_previsto_no_intervalo" CHECK ("parcelas"."valor_previsto_centavos" is null or ("parcelas"."valor_previsto_centavos" >= 1 and "parcelas"."valor_previsto_centavos" <= 1000000000)),
	CONSTRAINT "parcelas_rotulo_comprimento" CHECK ("parcelas"."rotulo" is null or length(trim("parcelas"."rotulo")) between 1 and 40),
	CONSTRAINT "parcelas_taxa_exige_pago_no_cartao" CHECK ("parcelas"."taxa_pontos_base" is null or ("parcelas"."pago_em" is not null and "parcelas"."forma" = 'cartao')),
	CONSTRAINT "parcelas_previsto_e_forma_prevista_juntos" CHECK (("parcelas"."valor_previsto_centavos" is null and "parcelas"."forma_prevista" is null) or ("parcelas"."valor_previsto_centavos" is not null and "parcelas"."forma_prevista" is not null)),
	CONSTRAINT "parcelas_previsto_exige_pago" CHECK ("parcelas"."valor_previsto_centavos" is null or "parcelas"."pago_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "contas_fixas" ADD CONSTRAINT "contas_fixas_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_linhas" ADD CONSTRAINT "documento_linhas_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_linhas" ADD CONSTRAINT "documento_linhas_item_id_itens_catalogo_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_linhas" ADD CONSTRAINT "documento_linhas_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_linhas" ADD CONSTRAINT "documento_linhas_parcela_diferenca_id_parcelas_id_fk" FOREIGN KEY ("parcela_diferenca_id") REFERENCES "public"."parcelas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_conta_fixa_id_contas_fixas_id_fk" FOREIGN KEY ("conta_fixa_id") REFERENCES "public"."contas_fixas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cancelado_por_usuarios_id_fk" FOREIGN KEY ("cancelado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_tecnica" ADD CONSTRAINT "ficha_tecnica_item_id_itens_catalogo_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_tecnica" ADD CONSTRAINT "ficha_tecnica_insumo_id_itens_catalogo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_categoria_venda_id_categorias_id_fk" FOREIGN KEY ("categoria_venda_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_categoria_compra_id_categorias_id_fk" FOREIGN KEY ("categoria_compra_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_pago_por_usuarios_id_fk" FOREIGN KEY ("pago_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_nome_normalizado_idx" ON "categorias" USING btree (lower(trim("nome")));--> statement-breakpoint
CREATE INDEX "documento_linhas_documento_ordem_idx" ON "documento_linhas" USING btree ("documento_id","ordem");--> statement-breakpoint
CREATE INDEX "documento_linhas_categoria_idx" ON "documento_linhas" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "documentos_data_idx" ON "documentos" USING btree ("data");--> statement-breakpoint
CREATE INDEX "documentos_tipo_data_idx" ON "documentos" USING btree ("tipo","data");--> statement-breakpoint
CREATE INDEX "parcelas_pago_em_idx" ON "parcelas" USING btree ("pago_em");--> statement-breakpoint
CREATE INDEX "parcelas_documento_idx" ON "parcelas" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "parcelas_vencimento_em_aberto_idx" ON "parcelas" USING btree ("vencimento") WHERE "parcelas"."pago_em" is null;