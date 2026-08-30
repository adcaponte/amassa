-- O Drizzle não gera trigger nenhum (02-MODELO-DE-DADOS.md §6: "funções, views, papéis e
-- grant/revoke o Drizzle NÃO gera"). A função tocar_atualizado_em() já existe desde a migração
-- 0002 (base comum de datas) — este arquivo só liga as três tabelas novas de Abertura do Espaço
-- a ela, seguindo o checklist de toda tabela nova (§0: criado_em, atualizado_em, trigger). Sem
-- esse trigger, atualizado_em fica parado no valor de criação para sempre, mesmo em UPDATE.
--
-- Nenhum `grant` aqui: o `alter default privileges` da migração 0003 já cobre tabela criada
-- depois pelo mesmo dono (amassa_owner) — amassa_app já nasce com select/insert/update/delete
-- nas três tabelas sem grant adicional.
--
-- Recriação condicional (`drop trigger if exists` antes de `create trigger`): reaplicar este
-- arquivo num banco parcialmente migrado não deve explodir — mesma forma de 0002/0006/0008.
--
-- MÓDULO TEMPORÁRIO (D-01/ABE-15): estes três gatilhos saem junto com as tabelas na migração de
-- remoção do plano 04.2-05.

drop trigger if exists tocar_atualizado_em_abertura_itens on abertura_itens;
--> statement-breakpoint
create trigger tocar_atualizado_em_abertura_itens
  before update on abertura_itens
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_abertura_tarefas on abertura_tarefas;
--> statement-breakpoint
create trigger tocar_atualizado_em_abertura_tarefas
  before update on abertura_tarefas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_abertura_configuracao on abertura_configuracao;
--> statement-breakpoint
create trigger tocar_atualizado_em_abertura_configuracao
  before update on abertura_configuracao
  for each row execute function tocar_atualizado_em();
