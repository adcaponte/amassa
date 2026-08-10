CREATE TYPE "public"."tipo_queima" AS ENUM('biscoito', 'esmalte', 'ouro');--> statement-breakpoint
CREATE TABLE "fornos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"limite" integer DEFAULT 100 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fornos_nome_comprimento" CHECK (length(trim("fornos"."nome")) between 1 and 80),
	CONSTRAINT "fornos_limite_minimo" CHECK ("fornos"."limite" >= 10)
);
--> statement-breakpoint
CREATE TABLE "manutencoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forno_id" uuid NOT NULL,
	"ocorrida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"responsavel" text,
	"observacoes" text,
	"queimas_acumuladas" integer NOT NULL,
	"registrado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manutencoes_queimas_acumuladas_nao_negativo" CHECK ("manutencoes"."queimas_acumuladas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "queimas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forno_id" uuid NOT NULL,
	"tipo" "tipo_queima" NOT NULL,
	"ocorrida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"registrado_por" uuid,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_forno_id_fornos_id_fk" FOREIGN KEY ("forno_id") REFERENCES "public"."fornos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queimas" ADD CONSTRAINT "queimas_forno_id_fornos_id_fk" FOREIGN KEY ("forno_id") REFERENCES "public"."fornos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queimas" ADD CONSTRAINT "queimas_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manutencoes_forno_idx" ON "manutencoes" USING btree ("forno_id","ocorrida_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "queimas_forno_data_idx" ON "queimas" USING btree ("forno_id","ocorrida_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "queimas_data_idx" ON "queimas" USING btree ("ocorrida_em" DESC NULLS LAST);