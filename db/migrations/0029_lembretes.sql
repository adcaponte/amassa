-- NÃO APLICAR sem o Roteiro 20 (docs/operacao/20-migracao-lembretes.md) — backup antes.
-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline (migração aplicada à mão, por
-- alguém que está olhando).
-- Vem depois da 0027 e da 0028: se elas ainda não estiverem aplicadas, as três entram na MESMA
-- sessão de `db:migrate` (o migrador aplica todas as pendentes numa transação só).
-- Só acrescenta uma tabela (`lembretes`), com os seus checks, chaves, índice e gatilho; nada é
-- apagado nem renomeado.
--
-- Fase 06.3 — Lembretes (06.3-CONTEXT.md, BRIEFING §2 e §4):
--   * `quem` nulo = "geral"; é etiqueta, não permissão — todo usuário vê e mexe em todos.
--   * Feito não apaga: `feito_em`/`feito_por` andam juntos (check `lembretes_feito_coerente`).
--   * Índice em `(feito_em, para_quando)` (BRIEFING §4): a lista lê os abertos por prazo.
--   * 🔴 SEM retirada do privilégio de apagar — ver o bloco "EXCEÇÃO DELIBERADA" no fim.
--
-- Gerada com `npm run db:generate -- --name lembretes` e completada à mão (cabeçalho, gatilho e o
-- grant comentado no fim). Desfazer: outra migração que remova a tabela — também aplicada à mão,
-- depois de backup.

CREATE TABLE "lembretes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"texto" text NOT NULL,
	"para_quando" date,
	"quem" uuid,
	"feito_em" timestamp with time zone,
	"feito_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lembretes_texto_comprimento" CHECK (length(trim("lembretes"."texto")) between 1 and 200),
	CONSTRAINT "lembretes_feito_coerente" CHECK (("lembretes"."feito_em" is null) = ("lembretes"."feito_por" is null))
);
--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_quem_usuarios_id_fk" FOREIGN KEY ("quem") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_feito_por_usuarios_id_fk" FOREIGN KEY ("feito_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lembretes_feito_em_para_quando_idx" ON "lembretes" USING btree ("feito_em","para_quando");
--> statement-breakpoint

-- (à mão) O gatilho `tocar_atualizado_em` de `lembretes`, no molde da 0022/0028. A função
-- `tocar_atualizado_em()` já existe desde a 0002. Recriação condicional (`drop trigger if exists`
-- antes de `create trigger`): reaplicar este bloco num banco parcialmente migrado não explode.
drop trigger if exists tocar_atualizado_em_lembretes on lembretes;
--> statement-breakpoint
create trigger tocar_atualizado_em_lembretes
  before update on lembretes
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (à mão) EXCEÇÃO DELIBERADA (LMB-08, decisão do dono em 02/10/2026): lembrete se apaga de verdade —
-- não é registro de dinheiro, estoque nem cadastro. A 0003 já concede select/insert/update/delete a
-- `amassa_app` em toda tabela nova (default privileges); o grant abaixo repete isso de propósito,
-- para a exceção ficar legível aqui. Não acrescente uma retirada do privilégio de apagar: o
-- `test:migracoes` (`conferirLembretes`) e o e2e provam que apagar funciona.
-- Precisão: outras tabelas criadas depois da 0003 também mantêm o delete por desenho (anexos de
-- fornecedor, linhas de documento, ficha técnica…) — a exceção é de REGISTRO de negócio, não de
-- privilégio.
grant select, insert, update, delete on lembretes to amassa_app;
