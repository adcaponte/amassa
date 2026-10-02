-- NÃO APLICAR sem o Roteiro 18 (backup antes) — docs/operacao/18-migracao-dispensa-do-uso-livre.md.
-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline. Publicada junto com o código e
-- aplicada numa sessão só de `db:migrate`, logo depois de o job `implantar` terminar (como a D-15).
-- Só acrescenta: três colunas que aceitam nulo e três checks em `usos_livres`; nada é apagado.
--
-- Dispensa do uso livre só com a venda cancelada — decisão do dono no chat, 02/10/2026
-- (VERIFICACAO-COWORK-05 §2 item 2; refina a D-09). Gerada pelo quick 261002-sdt com
-- `npx drizzle-kit generate --name dispensa-do-uso-livre`. Desfazer: outra migração com `drop column`.

ALTER TABLE "usos_livres" ADD COLUMN "dispensada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD COLUMN "dispensada_por" uuid;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD COLUMN "motivo_dispensa" text;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_dispensada_por_usuarios_id_fk" FOREIGN KEY ("dispensada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_dispensada_por" CHECK ("usos_livres"."dispensada_em" is null or "usos_livres"."dispensada_por" is not null);--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_motivo_so_com_dispensa" CHECK ("usos_livres"."motivo_dispensa" is null or ("usos_livres"."dispensada_em" is not null and length(trim("usos_livres"."motivo_dispensa")) between 1 and 200));--> statement-breakpoint
ALTER TABLE "usos_livres" ADD CONSTRAINT "usos_livres_dispensa_so_com_venda" CHECK ("usos_livres"."dispensada_em" is null or ("usos_livres"."estado" = 'encerrado' and "usos_livres"."documento_id" is not null));