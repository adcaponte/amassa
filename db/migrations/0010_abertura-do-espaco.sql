CREATE TYPE "public"."categoria_item_abertura" AS ENUM('moveis', 'equipamentos', 'material', 'utensilios', 'obra', 'outros');--> statement-breakpoint
CREATE TYPE "public"."forma_pagamento_abertura" AS ENUM('vista', 'prazo');--> statement-breakpoint
CREATE TYPE "public"."grupo_tarefa_abertura" AS ENUM('obra', 'documentacao', 'aquisicao', 'montagem', 'divulgacao', 'outros');--> statement-breakpoint
CREATE TABLE "abertura_configuracao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linha_unica" boolean DEFAULT true NOT NULL,
	"inauguracao_em" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abertura_configuracao_linha_unica_uk" UNIQUE("linha_unica"),
	CONSTRAINT "abertura_configuracao_linha_unica" CHECK ("abertura_configuracao"."linha_unica")
);
--> statement-breakpoint
CREATE TABLE "abertura_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"categoria" "categoria_item_abertura" NOT NULL,
	"valor_centavos" integer NOT NULL,
	"forma_pagamento" "forma_pagamento_abertura" NOT NULL,
	"parcelas" integer DEFAULT 1 NOT NULL,
	"primeira_parcela_em" date NOT NULL,
	"entrega_prevista_em" date,
	"resolvido" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abertura_itens_nome_comprimento" CHECK (length(trim("abertura_itens"."nome")) between 1 and 120),
	CONSTRAINT "abertura_itens_valor_nao_negativo" CHECK ("abertura_itens"."valor_centavos" >= 0 and "abertura_itens"."valor_centavos" <= 1000000000),
	CONSTRAINT "abertura_itens_parcelas_no_intervalo" CHECK ("abertura_itens"."parcelas" between 1 and 36),
	CONSTRAINT "abertura_itens_vista_uma_parcela" CHECK ("abertura_itens"."forma_pagamento" <> 'vista' or "abertura_itens"."parcelas" = 1),
	CONSTRAINT "abertura_itens_prazo_duas_ou_mais" CHECK ("abertura_itens"."forma_pagamento" <> 'prazo' or "abertura_itens"."parcelas" >= 2)
);
--> statement-breakpoint
CREATE TABLE "abertura_tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"descricao" text NOT NULL,
	"grupo" "grupo_tarefa_abertura" NOT NULL,
	"prazo_em" date NOT NULL,
	"responsavel_id" uuid,
	"item_id" uuid,
	"concluida" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abertura_tarefas_descricao_comprimento" CHECK (length(trim("abertura_tarefas"."descricao")) between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "abertura_tarefas" ADD CONSTRAINT "abertura_tarefas_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abertura_tarefas" ADD CONSTRAINT "abertura_tarefas_item_id_abertura_itens_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."abertura_itens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abertura_itens_categoria_idx" ON "abertura_itens" USING btree ("categoria","nome");--> statement-breakpoint
CREATE INDEX "abertura_tarefas_grupo_prazo_idx" ON "abertura_tarefas" USING btree ("grupo","prazo_em");--> statement-breakpoint
CREATE INDEX "abertura_tarefas_item_idx" ON "abertura_tarefas" USING btree ("item_id");