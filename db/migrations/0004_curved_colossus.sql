CREATE TABLE "execucoes_backup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"sucesso" boolean NOT NULL,
	"bytes" bigint,
	"destino_externo_ok" boolean DEFAULT false NOT NULL,
	"mensagem" text
);
--> statement-breakpoint
CREATE INDEX "execucoes_backup_quando_idx" ON "execucoes_backup" USING btree ("quando" DESC NULLS LAST);