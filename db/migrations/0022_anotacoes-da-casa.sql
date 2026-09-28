-- APLICADA À MÃO, pelo dono, depois de backup (CLAUDE.md §Migrações) — nunca pelo pipeline
-- automático. Gerada pelo plano 04.6-07 (Anotações da casa, D-08/GES-10); aplicada em produção
-- só no plano 04.6-08 (Roteiro 14), pelo dono, olhando.
--
-- O bloco `create table` abaixo saiu de `drizzle-kit generate`, direto do schema. O resto deste
-- arquivo (gatilho, grants/revoke, semente) foi ACRESCENTADO À MÃO — o Drizzle não gera trigger,
-- função nem grant/revoke (02-MODELO-DE-DADOS.md §6), no MESMO molde de
-- 0006/0008/0011/0013/0015/0018:
--
-- (1) o gatilho `tocar_atualizado_em_anotacoes_da_casa`, ligando a tabela nova à função
--     `tocar_atualizado_em()` que já existe desde a migração 0002 — é ele que mantém
--     `atualizado_em` como marca de versão (comentário na tabela, `db/schema.ts`);
-- (2) `grant select, insert, update` para `amassa_app`; `revoke delete` EXPLÍCITO — a folha não
--     se apaga, esvazia-se (D-08: "ver o dela" troca o texto da caixa, nunca apaga a linha);
-- (3) a semente da linha única (`insert ... on conflict do nothing`) — é ela que faz a leitura
--     de `lerFolhaDaCasa()` nunca devolver nada e o código nunca precisar tratar "a folha não
--     existe". Nasce com `texto = ''` e `salvo_por` nulo ("ninguém salvou ainda").
--
-- Recriação condicional (`drop trigger if exists` antes de `create trigger`): reaplicar este
-- arquivo num banco parcialmente migrado não deve explodir.

CREATE TABLE "anotacoes_da_casa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linha_unica" boolean DEFAULT true NOT NULL,
	"texto" text DEFAULT '' NOT NULL,
	"salvo_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anotacoes_da_casa_linha_unica_uk" UNIQUE("linha_unica"),
	CONSTRAINT "anotacoes_da_casa_linha_unica" CHECK ("anotacoes_da_casa"."linha_unica"),
	CONSTRAINT "anotacoes_da_casa_texto_comprimento" CHECK (length("anotacoes_da_casa"."texto") <= 10000)
);
--> statement-breakpoint
ALTER TABLE "anotacoes_da_casa" ADD CONSTRAINT "anotacoes_da_casa_salvo_por_usuarios_id_fk" FOREIGN KEY ("salvo_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- (1) Gatilho de atualizado_em — a marca de versão que `decidirGravacao` compara.
drop trigger if exists tocar_atualizado_em_anotacoes_da_casa on anotacoes_da_casa;
--> statement-breakpoint
create trigger tocar_atualizado_em_anotacoes_da_casa
  before update on anotacoes_da_casa
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (2) Grants: select/insert/update para amassa_app; delete explicitamente revogado — a folha
-- nunca se apaga, só esvazia (texto = '').
grant select, insert, update on anotacoes_da_casa to amassa_app;
--> statement-breakpoint

revoke delete on anotacoes_da_casa from amassa_app;
--> statement-breakpoint

-- (3) Semente da linha única: nasce vazia, sem ninguém tendo salvado ainda. Reaplicar esta
-- migração não duplica a linha (on conflict do nothing sobre a restrição de linha única).
insert into anotacoes_da_casa (texto) values ('')
on conflict do nothing;