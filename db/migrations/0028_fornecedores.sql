-- NÃO APLICAR sem o Roteiro 19 (backup antes) — docs/operacao/19-migracao-fornecedores.md.
-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline. Publicada junto com o código e
-- aplicada numa sessão só de `db:migrate`, logo depois de o job `implantar` terminar (como a D-15).
-- A 0027 (Roteiro 18) vem antes; se ainda não estiver aplicada, as duas entram na mesma sessão de
-- `db:migrate`.
-- Só acrescenta: duas tabelas, um enum, uma coluna em `documentos`, duas em `execucoes_backup`;
-- nada é apagado.
--
-- Fase 06.2 — Fornecedores (06.2-CONTEXT.md):
--   * D-04 ("acrescentar ao lado"): `documentos.fornecedor_id` nasce AO LADO de
--     `documentos.pessoa_nome`, que continua com o mesmo tipo, o mesmo check e sendo gravado. Anulável,
--     sem `on delete`; dois checks novos amarram o vínculo ao nome congelado e à despesa. Toda linha
--     que já existe nasce com nulo — nada retroativo (BRIEFING §4).
--   * D-05: a migração TOCA `execucoes_backup` (`anexos_bytes`, `anexos_destino_externo_ok`,
--     anuláveis — nulo = linha anterior à fase, nenhuma tentativa registrada, como `fotos_*` da 0017).
--     `documentos` e `execucoes_backup` são tabelas quentes: depois do deploy e antes desta migração,
--     todo `insert` nelas falha (Pitfall 12) — por isso publicar e migrar numa sessão só.
--   * D-06: nome único entre ativos SEM distinção de caixa NEM de acento — índice único parcial
--     sobre `nome_normalizado(nome)` `where ativo` ("Argila Goias" e "Argila Goiás" não convivem
--     ativos). `nome_normalizado()` é a função imutável da 0026 (minúsculas, sem acento, apara e
--     colapsa espaços), que já existe quando esta roda. Troca do dono no chat, 03/10/2026, editada
--     aqui antes de a 0028 ser aplicada em qualquer base fora dos testes; até então a regra era
--     `lower(trim(nome))`, pela letra do BRIEFING §2, com acento contando.
--
-- Gerada com `npm run db:generate -- --name fornecedores` e completada à mão (cabeçalho, gatilho e
-- revoke no fim). Desfazer: outra migração que remova as colunas e as tabelas — também
-- aplicada à mão, depois de backup.

CREATE TYPE "public"."tipo_anexo_fornecedor" AS ENUM('tabela', 'catalogo', 'nota', 'outro');--> statement-breakpoint
CREATE TABLE "fornecedor_anexos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_anexo_fornecedor" NOT NULL,
	"vale_desde" date,
	"nota" text,
	"arquivo_caminho" text NOT NULL,
	"arquivo_tipo" text NOT NULL,
	"arquivo_bytes" integer NOT NULL,
	"extensao" text NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fornecedor_anexos_arquivo_uk" UNIQUE("arquivo_caminho"),
	CONSTRAINT "fornecedor_anexos_nome_comprimento" CHECK (length(trim("fornecedor_anexos"."nome")) between 1 and 120),
	CONSTRAINT "fornecedor_anexos_nota_comprimento" CHECK ("fornecedor_anexos"."nota" is null or length(trim("fornecedor_anexos"."nota")) between 1 and 160),
	CONSTRAINT "fornecedor_anexos_vale_desde_so_tabela" CHECK ("fornecedor_anexos"."vale_desde" is null or "fornecedor_anexos"."tipo" = 'tabela'),
	CONSTRAINT "fornecedor_anexos_extensao_valida" CHECK ("fornecedor_anexos"."extensao" in ('pdf','jpg','xlsx','xls','csv')),
	CONSTRAINT "fornecedor_anexos_arquivo_formato" CHECK ("fornecedor_anexos"."arquivo_caminho" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|xlsx|xls|csv)$'),
	CONSTRAINT "fornecedor_anexos_arquivo_coerente" CHECK (right("fornecedor_anexos"."arquivo_caminho", length("fornecedor_anexos"."extensao") + 1) = '.' || "fornecedor_anexos"."extensao"),
	CONSTRAINT "fornecedor_anexos_bytes_no_intervalo" CHECK ("fornecedor_anexos"."arquivo_bytes" between 1 and 21000000)
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"vende" text,
	"area" "area_financeira" NOT NULL,
	"cidade_entrega" text,
	"whatsapp" text,
	"pessoa_contato" text,
	"email" text,
	"site" text,
	"pagamento_prazo" text,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fornecedores_nome_comprimento" CHECK (length(trim("fornecedores"."nome")) between 1 and 120),
	CONSTRAINT "fornecedores_vende_comprimento" CHECK ("fornecedores"."vende" is null or length(trim("fornecedores"."vende")) between 1 and 160),
	CONSTRAINT "fornecedores_cidade_entrega_comprimento" CHECK ("fornecedores"."cidade_entrega" is null or length(trim("fornecedores"."cidade_entrega")) between 1 and 160),
	CONSTRAINT "fornecedores_whatsapp_comprimento" CHECK ("fornecedores"."whatsapp" is null or length(trim("fornecedores"."whatsapp")) between 1 and 40),
	CONSTRAINT "fornecedores_pessoa_contato_comprimento" CHECK ("fornecedores"."pessoa_contato" is null or length(trim("fornecedores"."pessoa_contato")) between 1 and 160),
	CONSTRAINT "fornecedores_email_comprimento" CHECK ("fornecedores"."email" is null or length(trim("fornecedores"."email")) between 1 and 160),
	CONSTRAINT "fornecedores_site_comprimento" CHECK ("fornecedores"."site" is null or length(trim("fornecedores"."site")) between 1 and 300),
	CONSTRAINT "fornecedores_pagamento_prazo_comprimento" CHECK ("fornecedores"."pagamento_prazo" is null or length(trim("fornecedores"."pagamento_prazo")) between 1 and 160),
	CONSTRAINT "fornecedores_observacoes_comprimento" CHECK ("fornecedores"."observacoes" is null or length("fornecedores"."observacoes") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "fornecedor_id" uuid;--> statement-breakpoint
ALTER TABLE "execucoes_backup" ADD COLUMN "anexos_bytes" bigint;--> statement-breakpoint
ALTER TABLE "execucoes_backup" ADD COLUMN "anexos_destino_externo_ok" boolean;--> statement-breakpoint
ALTER TABLE "fornecedor_anexos" ADD CONSTRAINT "fornecedor_anexos_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedor_anexos" ADD CONSTRAINT "fornecedor_anexos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fornecedor_anexos_fornecedor_idx" ON "fornecedor_anexos" USING btree ("fornecedor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fornecedores_nome_ativo_uk" ON "fornecedores" USING btree (nome_normalizado("nome")) WHERE "fornecedores"."ativo";--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_fornecedor_idx" ON "documentos" USING btree ("fornecedor_id");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_fornecedor_exige_pessoa_nome" CHECK ("documentos"."fornecedor_id" is null or "documentos"."pessoa_nome" is not null);--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_fornecedor_so_em_despesa" CHECK ("documentos"."fornecedor_id" is null or "documentos"."tipo" = 'despesa');--> statement-breakpoint

-- (à mão) O gatilho `tocar_atualizado_em` de `fornecedores`, no molde da 0026. A função
-- `tocar_atualizado_em()` já existe desde a 0002. Recriação condicional (`drop trigger if exists`
-- antes de `create trigger`): reaplicar este bloco num banco parcialmente migrado não explode.
-- `fornecedor_anexos` não tem `atualizado_em` — anexo só se insere e se tira.
drop trigger if exists tocar_atualizado_em_fornecedores on fornecedores;
--> statement-breakpoint
create trigger tocar_atualizado_em_fornecedores
  before update on fornecedores
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (à mão) Fornecedor não se apaga (FRN-03): anexos e despesas apontam para ele; desativar é o único
-- jeito de tirá-lo da lista. A migração 0003 concede select/insert/update/delete a `amassa_app` por
-- `alter default privileges` em TODA tabela nova — por isso este revoke precisa ser explícito. A
-- tabela de anexos FICA com o delete: tirar um anexo é o único "apagar" do módulo (FRN-10).
revoke delete on fornecedores from amassa_app;