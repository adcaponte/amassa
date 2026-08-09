CREATE TYPE "public"."etapa_encomenda" AS ENUM('producao', 'secagem', 'queima1', 'esmaltacao', 'queima2', 'entrega');--> statement-breakpoint
CREATE TYPE "public"."status_encomenda" AS ENUM('rascunho', 'em_producao', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TABLE "encomenda_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encomenda_id" uuid NOT NULL,
	"etapa" "etapa_encomenda" NOT NULL,
	"dias" integer DEFAULT 1 NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "encomenda_etapas_encomenda_etapa_uk" UNIQUE("encomenda_id","etapa"),
	CONSTRAINT "marcos_zero_ou_um" CHECK ("encomenda_etapas"."etapa" not in ('queima1','queima2','entrega') or "encomenda_etapas"."dias" in (0, 1)),
	CONSTRAINT "encomenda_etapas_dias_nao_negativo" CHECK ("encomenda_etapas"."dias" >= 0)
);
--> statement-breakpoint
CREATE TABLE "encomenda_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encomenda_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"quantidade" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "encomenda_itens_descricao_comprimento" CHECK (length(trim("encomenda_itens"."descricao")) between 1 and 200),
	CONSTRAINT "encomenda_itens_quantidade_positiva" CHECK ("encomenda_itens"."quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "encomendas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cliente_nome" text,
	"data_inicio" date NOT NULL,
	"status" "status_encomenda" DEFAULT 'em_producao' NOT NULL,
	"observacoes" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "encomendas_nome_comprimento" CHECK (length(trim("encomendas"."nome")) between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "encomenda_etapas_encomenda_id_encomendas_id_fk" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encomenda_itens" ADD CONSTRAINT "encomenda_itens_encomenda_id_encomendas_id_fk" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encomendas" ADD CONSTRAINT "encomendas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "encomenda_etapas_encomenda_idx" ON "encomenda_etapas" USING btree ("encomenda_id");--> statement-breakpoint
CREATE INDEX "encomenda_itens_encomenda_idx" ON "encomenda_itens" USING btree ("encomenda_id");--> statement-breakpoint
CREATE INDEX "encomendas_data_inicio_idx" ON "encomendas" USING btree ("data_inicio");--> statement-breakpoint
CREATE INDEX "encomendas_status_idx" ON "encomendas" USING btree ("status");