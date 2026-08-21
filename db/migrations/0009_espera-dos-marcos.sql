ALTER TABLE "encomenda_etapas" DROP CONSTRAINT "marcos_zero_ou_um";--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD COLUMN "espera_dias" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "marcos_sempre_um_dia" CHECK ("encomenda_etapas"."etapa" not in ('queima1','queima2','entrega') or "encomenda_etapas"."dias" = 1);--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "encomenda_etapas_espera_no_intervalo" CHECK ("encomenda_etapas"."espera_dias" >= 0 and "encomenda_etapas"."espera_dias" <= 365);--> statement-breakpoint
ALTER TABLE "encomenda_etapas" ADD CONSTRAINT "espera_so_em_marco" CHECK ("encomenda_etapas"."etapa" in ('queima1','queima2','entrega') or "encomenda_etapas"."espera_dias" = 0);