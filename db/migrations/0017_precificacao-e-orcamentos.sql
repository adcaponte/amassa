CREATE TYPE "public"."plano_pagamento_orcamento" AS ENUM('sinal', 'avista', '3x');--> statement-breakpoint
CREATE TYPE "public"."status_orcamento" AS ENUM('rascunho', 'enviado', 'aprovado', 'recusado');--> statement-breakpoint
CREATE TABLE "contadores_orcamento" (
	"ano" integer PRIMARY KEY NOT NULL,
	"ultimo_numero" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contadores_orcamento_ano_no_intervalo" CHECK ("contadores_orcamento"."ano" between 2020 and 2200),
	CONSTRAINT "contadores_orcamento_ultimo_numero_no_intervalo" CHECK ("contadores_orcamento"."ultimo_numero" between 0 and 999999)
);
--> statement-breakpoint
CREATE TABLE "fichas_precificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"argila_miligramas" integer DEFAULT 0 NOT NULL,
	"esmalte_miligramas" integer DEFAULT 0 NOT NULL,
	"horas_milesimos" integer DEFAULT 0 NOT NULL,
	"largura_mm" integer DEFAULT 0 NOT NULL,
	"profundidade_mm" integer DEFAULT 0 NOT NULL,
	"altura_mm" integer DEFAULT 0 NOT NULL,
	"embalagem_centavos" integer DEFAULT 0 NOT NULL,
	"cabem_biscoito_informado" integer,
	"cabem_esmalte_informado" integer,
	"preco_mercado_centavos" integer,
	"preco_praticado_centavos" integer,
	"exclusiva" boolean DEFAULT false NOT NULL,
	"item_catalogo_id" uuid,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fichas_precificacao_item_catalogo_uk" UNIQUE("item_catalogo_id"),
	CONSTRAINT "fichas_precificacao_nome_comprimento" CHECK (length(trim("fichas_precificacao"."nome")) between 1 and 120),
	CONSTRAINT "fichas_precificacao_argila_no_intervalo" CHECK ("fichas_precificacao"."argila_miligramas" between 0 and 10000000),
	CONSTRAINT "fichas_precificacao_esmalte_no_intervalo" CHECK ("fichas_precificacao"."esmalte_miligramas" between 0 and 10000000),
	CONSTRAINT "fichas_precificacao_horas_no_intervalo" CHECK ("fichas_precificacao"."horas_milesimos" between 0 and 10000000),
	CONSTRAINT "fichas_precificacao_largura_no_intervalo" CHECK ("fichas_precificacao"."largura_mm" between 0 and 10000000),
	CONSTRAINT "fichas_precificacao_profundidade_no_intervalo" CHECK ("fichas_precificacao"."profundidade_mm" between 0 and 10000000),
	CONSTRAINT "fichas_precificacao_altura_no_intervalo" CHECK ("fichas_precificacao"."altura_mm" between 0 and 10000000),
	CONSTRAINT "fichas_precificacao_embalagem_no_intervalo" CHECK ("fichas_precificacao"."embalagem_centavos" between 0 and 1000000000),
	CONSTRAINT "fichas_precificacao_cabem_biscoito_nao_negativo" CHECK ("fichas_precificacao"."cabem_biscoito_informado" is null or "fichas_precificacao"."cabem_biscoito_informado" >= 0),
	CONSTRAINT "fichas_precificacao_cabem_esmalte_nao_negativo" CHECK ("fichas_precificacao"."cabem_esmalte_informado" is null or "fichas_precificacao"."cabem_esmalte_informado" >= 0),
	CONSTRAINT "fichas_precificacao_preco_mercado_no_intervalo" CHECK ("fichas_precificacao"."preco_mercado_centavos" is null or ("fichas_precificacao"."preco_mercado_centavos" >= 0 and "fichas_precificacao"."preco_mercado_centavos" <= 1000000000)),
	CONSTRAINT "fichas_precificacao_preco_praticado_no_intervalo" CHECK ("fichas_precificacao"."preco_praticado_centavos" is null or ("fichas_precificacao"."preco_praticado_centavos" >= 0 and "fichas_precificacao"."preco_praticado_centavos" <= 1000000000)),
	CONSTRAINT "fichas_precificacao_exclusividade_coerente" CHECK (("fichas_precificacao"."exclusiva" and "fichas_precificacao"."item_catalogo_id" is null) or (not "fichas_precificacao"."exclusiva" and "fichas_precificacao"."item_catalogo_id" is not null and "fichas_precificacao"."preco_praticado_centavos" is null))
);
--> statement-breakpoint
CREATE TABLE "orcamento_fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"arquivo" text NOT NULL,
	"legenda" text,
	"bytes" integer NOT NULL,
	"largura_px" integer,
	"altura_px" integer,
	"anexado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_fotos_orcamento_ordem_uk" UNIQUE("orcamento_id","ordem"),
	CONSTRAINT "orcamento_fotos_arquivo_uk" UNIQUE("arquivo"),
	CONSTRAINT "orcamento_fotos_ordem_no_intervalo" CHECK ("orcamento_fotos"."ordem" between 0 and 2),
	CONSTRAINT "orcamento_fotos_legenda_comprimento" CHECK ("orcamento_fotos"."legenda" is null or length(trim("orcamento_fotos"."legenda")) between 1 and 80),
	CONSTRAINT "orcamento_fotos_bytes_no_intervalo" CHECK ("orcamento_fotos"."bytes" between 0 and 1000000000),
	CONSTRAINT "orcamento_fotos_largura_positiva" CHECK ("orcamento_fotos"."largura_px" is null or "orcamento_fotos"."largura_px" > 0),
	CONSTRAINT "orcamento_fotos_altura_positiva" CHECK ("orcamento_fotos"."altura_px" is null or "orcamento_fotos"."altura_px" > 0),
	CONSTRAINT "orcamento_fotos_arquivo_formato" CHECK ("orcamento_fotos"."arquivo" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.jpg$')
);
--> statement-breakpoint
CREATE TABLE "orcamento_linhas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"ficha_id" uuid NOT NULL,
	"quantidade" integer NOT NULL,
	"preco_unitario_centavos" integer NOT NULL,
	"cor" text,
	"personalizacao" text,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_linhas_orcamento_ordem_uk" UNIQUE("orcamento_id","ordem"),
	CONSTRAINT "orcamento_linhas_quantidade_no_intervalo" CHECK ("orcamento_linhas"."quantidade" between 1 and 100000),
	CONSTRAINT "orcamento_linhas_preco_no_intervalo" CHECK ("orcamento_linhas"."preco_unitario_centavos" between 0 and 1000000000),
	CONSTRAINT "orcamento_linhas_cor_comprimento" CHECK ("orcamento_linhas"."cor" is null or length(trim("orcamento_linhas"."cor")) between 1 and 80),
	CONSTRAINT "orcamento_linhas_personalizacao_comprimento" CHECK ("orcamento_linhas"."personalizacao" is null or length(trim("orcamento_linhas"."personalizacao")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "orcamento_projeto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_projeto_orcamento_ordem_uk" UNIQUE("orcamento_id","ordem"),
	CONSTRAINT "orcamento_projeto_descricao_comprimento" CHECK (length(trim("orcamento_projeto"."descricao")) between 1 and 120),
	CONSTRAINT "orcamento_projeto_valor_no_intervalo" CHECK ("orcamento_projeto"."valor_centavos" between 0 and 1000000000)
);
--> statement-breakpoint
CREATE TABLE "orcamento_revisoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"revisao" integer NOT NULL,
	"enviado_em" timestamp with time zone,
	"total_centavos" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_revisoes_orcamento_revisao_uk" UNIQUE("orcamento_id","revisao"),
	CONSTRAINT "orcamento_revisoes_total_no_intervalo" CHECK ("orcamento_revisoes"."total_centavos" between 0 and 1000000000)
);
--> statement-breakpoint
CREATE TABLE "orcamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ano" integer NOT NULL,
	"sequencial" integer NOT NULL,
	"revisao" integer DEFAULT 1 NOT NULL,
	"status" "status_orcamento" DEFAULT 'rascunho' NOT NULL,
	"cliente_nome" text,
	"titulo" text,
	"data" date NOT NULL,
	"validade_dias" integer DEFAULT 10 NOT NULL,
	"entrega_prevista" date NOT NULL,
	"plano" "plano_pagamento_orcamento" DEFAULT 'sinal' NOT NULL,
	"sinal_percentual" integer DEFAULT 50 NOT NULL,
	"frete_centavos" integer DEFAULT 0 NOT NULL,
	"observacoes" text,
	"congelado_em" timestamp with time zone,
	"snapshot" jsonb,
	"documento_id" uuid,
	"encomenda_id" uuid,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamentos_ano_sequencial_uk" UNIQUE("ano","sequencial"),
	CONSTRAINT "orcamentos_documento_id_uk" UNIQUE("documento_id"),
	CONSTRAINT "orcamentos_encomenda_id_uk" UNIQUE("encomenda_id"),
	CONSTRAINT "orcamentos_cliente_nome_comprimento" CHECK ("orcamentos"."cliente_nome" is null or length(trim("orcamentos"."cliente_nome")) between 1 and 160),
	CONSTRAINT "orcamentos_titulo_comprimento" CHECK ("orcamentos"."titulo" is null or length(trim("orcamentos"."titulo")) between 1 and 160),
	CONSTRAINT "orcamentos_observacoes_comprimento" CHECK ("orcamentos"."observacoes" is null or length(trim("orcamentos"."observacoes")) between 1 and 300),
	CONSTRAINT "orcamentos_validade_dias_no_intervalo" CHECK ("orcamentos"."validade_dias" between 1 and 365),
	CONSTRAINT "orcamentos_sinal_percentual_no_intervalo" CHECK ("orcamentos"."sinal_percentual" between 1 and 100),
	CONSTRAINT "orcamentos_frete_no_intervalo" CHECK ("orcamentos"."frete_centavos" between 0 and 1000000000),
	CONSTRAINT "orcamentos_revisao_minima" CHECK ("orcamentos"."revisao" >= 1),
	CONSTRAINT "orcamentos_rascunho_sem_snapshot" CHECK (("orcamentos"."status" = 'rascunho') = ("orcamentos"."snapshot" is null)),
	CONSTRAINT "orcamentos_snapshot_e_congelado_juntos" CHECK (("orcamentos"."snapshot" is null) = ("orcamentos"."congelado_em" is null)),
	CONSTRAINT "orcamentos_documento_exige_aprovado" CHECK ("orcamentos"."documento_id" is null or "orcamentos"."status" = 'aprovado')
);
--> statement-breakpoint
CREATE TABLE "parametros_precificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" text NOT NULL,
	"valor_inteiro" integer NOT NULL,
	"medido" boolean DEFAULT false NOT NULL,
	"vigente_desde" date NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parametros_precificacao_chave_vigencia_uk" UNIQUE("chave","vigente_desde"),
	CONSTRAINT "parametros_precificacao_chave_valida" CHECK ("parametros_precificacao"."chave" in (
        'material_argila','material_esmalte','trabalho_hora','forno_tarifa_energia',
        'forno_kwh_biscoito','forno_kwh_esmalte','forno_largura_util','forno_profundidade_util',
        'forno_altura_util','forno_folga_entre_pecas','forno_prateleira_e_pilar',
        'forno_fator_biscoito','forno_desgaste_por_fornada','perda_unica','preco_lucro',
        'preco_folga_negociacao','preco_imposto_sobre_venda','preco_comissao_galeria'
      )),
	CONSTRAINT "parametros_precificacao_valor_no_intervalo" CHECK ("parametros_precificacao"."valor_inteiro" between 0 and 1000000000)
);
--> statement-breakpoint
ALTER TABLE "execucoes_backup" ADD COLUMN "fotos_bytes" bigint;--> statement-breakpoint
ALTER TABLE "execucoes_backup" ADD COLUMN "fotos_destino_externo_ok" boolean;--> statement-breakpoint
ALTER TABLE "fichas_precificacao" ADD CONSTRAINT "fichas_precificacao_item_catalogo_id_itens_catalogo_id_fk" FOREIGN KEY ("item_catalogo_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_precificacao" ADD CONSTRAINT "fichas_precificacao_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_fotos" ADD CONSTRAINT "orcamento_fotos_orcamento_id_orcamentos_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_fotos" ADD CONSTRAINT "orcamento_fotos_anexado_por_usuarios_id_fk" FOREIGN KEY ("anexado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_linhas" ADD CONSTRAINT "orcamento_linhas_orcamento_id_orcamentos_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_linhas" ADD CONSTRAINT "orcamento_linhas_ficha_id_fichas_precificacao_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_precificacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_projeto" ADD CONSTRAINT "orcamento_projeto_orcamento_id_orcamentos_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_revisoes" ADD CONSTRAINT "orcamento_revisoes_orcamento_id_orcamentos_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_encomenda_id_encomendas_id_fk" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametros_precificacao" ADD CONSTRAINT "parametros_precificacao_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orcamento_fotos_orcamento_idx" ON "orcamento_fotos" USING btree ("orcamento_id");--> statement-breakpoint
CREATE INDEX "orcamento_linhas_orcamento_idx" ON "orcamento_linhas" USING btree ("orcamento_id");--> statement-breakpoint
CREATE INDEX "orcamento_projeto_orcamento_idx" ON "orcamento_projeto" USING btree ("orcamento_id");--> statement-breakpoint
CREATE INDEX "orcamento_revisoes_orcamento_idx" ON "orcamento_revisoes" USING btree ("orcamento_id");--> statement-breakpoint
CREATE INDEX "orcamentos_ano_sequencial_idx" ON "orcamentos" USING btree ("ano" DESC NULLS LAST,"sequencial" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "parametros_precificacao_chave_vigencia_idx" ON "parametros_precificacao" USING btree ("chave","vigente_desde" DESC NULLS LAST);