-- NÃO APLICAR sem o Roteiro 22 (docs/operacao/22-migracao-polimento.md) — backup antes.
-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline (migração aplicada à mão, por
-- alguém que está olhando).
-- Vem depois da 0030.
-- Fase 06.5 — Polimento (06.5-CONTEXT.md, D-18, D-26, UI-D9). O que faz, uma frase por item:
--   * troca a única `documentos_conta_fixa_mes_uk` (0014) pelo índice único PARCIAL
--     `documentos_conta_fixa_mes_ativo_uk (conta_fixa_id, mes_referencia) where cancelado_em is
--     null` — uma conta fixa cancelada libera o mês para ser gerada de novo; duas ativas no mesmo
--     mês continuam recusadas (23505). O índice novo é MAIS FROUXO que a única: nenhum dado que
--     hoje existe o viola, e ele é criado depois que a única sai;
--   * cria três índices de leitura: `movimentacoes_estoque_encomenda_idx (encomenda_id)`,
--     `mensalidades_cliente_idx (cliente_id)` e `usos_livres_cliente_idx (cliente_id)`;
--   * cria `correcoes_de_documento`, o vínculo do “Corrigir” (original → corrigido, um para um),
--     numa tabela À PARTE — nenhum `insert` em `documentos` passa a depender desta migração — que só
--     cresce: `amassa_app` fica com `select` e `insert`, sem `update` nem `delete` (fim do arquivo).
-- Nada é apagado nem renomeado além da única trocada pelo índice parcial.
--
-- A janela entre o `implantar` e este `db:migrate`: `gerarContasDoMes` usa
-- `on conflict (conta_fixa_id, mes_referencia) where cancelado_em is null do nothing`, que o Postgres
-- infere tanto pelo índice parcial daqui quanto pela única antiga (um índice não parcial satisfaz
-- qualquer predicado) — provado em banco próprio no `test:migracoes`
-- (`provarJanelaDoPolimentoEmBancoProprio`).
--
-- Gerada com `npm run db:generate -- --name polimento` e completada à mão (cabeçalho e o `revoke`).
-- Desfazer: outra migração — também aplicada à mão, depois de backup.

CREATE TABLE "correcoes_de_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_id" uuid NOT NULL,
	"corrigido_id" uuid NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "correcoes_de_documento_original_uk" UNIQUE("original_id"),
	CONSTRAINT "correcoes_de_documento_corrigido_uk" UNIQUE("corrigido_id"),
	CONSTRAINT "correcoes_de_documento_original_diferente_do_corrigido" CHECK ("correcoes_de_documento"."original_id" <> "correcoes_de_documento"."corrigido_id")
);
--> statement-breakpoint
ALTER TABLE "documentos" DROP CONSTRAINT "documentos_conta_fixa_mes_uk";--> statement-breakpoint
ALTER TABLE "correcoes_de_documento" ADD CONSTRAINT "correcoes_de_documento_original_id_documentos_id_fk" FOREIGN KEY ("original_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcoes_de_documento" ADD CONSTRAINT "correcoes_de_documento_corrigido_id_documentos_id_fk" FOREIGN KEY ("corrigido_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcoes_de_documento" ADD CONSTRAINT "correcoes_de_documento_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_conta_fixa_mes_ativo_uk" ON "documentos" USING btree ("conta_fixa_id","mes_referencia") WHERE "documentos"."cancelado_em" is null;--> statement-breakpoint
CREATE INDEX "mensalidades_cliente_idx" ON "mensalidades" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "movimentacoes_estoque_encomenda_idx" ON "movimentacoes_estoque" USING btree ("encomenda_id");--> statement-breakpoint
CREATE INDEX "usos_livres_cliente_idx" ON "usos_livres" USING btree ("cliente_id");--> statement-breakpoint

-- (à mão) O vínculo da correção só cresce (D-18): corrigir de novo é outra correção, nunca editar
-- nem apagar o vínculo. A 0003 concede select/insert/update/delete a `amassa_app` em toda tabela
-- nova (default privileges) — por isso a retirada precisa ser explícita. Ficam `select` e `insert`.
revoke update, delete on correcoes_de_documento from amassa_app;
