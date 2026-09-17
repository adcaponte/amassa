CREATE TYPE "public"."situacao_cotacao" AS ENUM('cotando', 'favorito', 'descartado');--> statement-breakpoint
CREATE TABLE "cotacao_categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotacao_categorias_nome_comprimento" CHECK (length(trim("cotacao_categorias"."nome")) between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "cotacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" uuid NOT NULL,
	"empresa" text NOT NULL,
	"produto" text DEFAULT '' NOT NULL,
	"preco_centavos" integer,
	"situacao" "situacao_cotacao" DEFAULT 'cotando' NOT NULL,
	"diferenciais" text DEFAULT '' NOT NULL,
	"assistencia" text DEFAULT '' NOT NULL,
	"pagamento" text DEFAULT '' NOT NULL,
	"contato" text DEFAULT '' NOT NULL,
	"observacoes" text DEFAULT '' NOT NULL,
	"alertas" text DEFAULT '' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotacoes_empresa_comprimento" CHECK (length(trim("cotacoes"."empresa")) between 1 and 160),
	CONSTRAINT "cotacoes_produto_comprimento" CHECK (length("cotacoes"."produto") <= 200),
	CONSTRAINT "cotacoes_diferenciais_comprimento" CHECK (length("cotacoes"."diferenciais") <= 2000),
	CONSTRAINT "cotacoes_assistencia_comprimento" CHECK (length("cotacoes"."assistencia") <= 2000),
	CONSTRAINT "cotacoes_pagamento_comprimento" CHECK (length("cotacoes"."pagamento") <= 2000),
	CONSTRAINT "cotacoes_contato_comprimento" CHECK (length("cotacoes"."contato") <= 2000),
	CONSTRAINT "cotacoes_observacoes_comprimento" CHECK (length("cotacoes"."observacoes") <= 2000),
	CONSTRAINT "cotacoes_alertas_comprimento" CHECK (length("cotacoes"."alertas") <= 2000),
	CONSTRAINT "cotacoes_preco_no_intervalo" CHECK ("cotacoes"."preco_centavos" is null or ("cotacoes"."preco_centavos" >= 0 and "cotacoes"."preco_centavos" <= 1000000000))
);
--> statement-breakpoint
ALTER TABLE "cotacoes" ADD CONSTRAINT "cotacoes_categoria_id_cotacao_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."cotacao_categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotacao_categorias_criado_em_idx" ON "cotacao_categorias" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "cotacoes_categoria_idx" ON "cotacoes" USING btree ("categoria_id","criado_em");