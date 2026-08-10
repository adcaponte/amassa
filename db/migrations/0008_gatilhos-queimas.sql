-- O Drizzle não gera trigger nenhum (02-MODELO-DE-DADOS.md §6: "funções, views, papéis e
-- grant/revoke o Drizzle NÃO gera"). A função tocar_atualizado_em() já existe desde a migração
-- 0002 (base comum de datas) — este arquivo só liga as três tabelas novas de Fornos a ela,
-- seguindo o checklist de toda tabela nova (§0: criado_em, atualizado_em, trigger). Sem esse
-- trigger, `atualizado_em` fica parado no valor de criação para sempre, mesmo em UPDATE.
--
-- Nenhum `grant` aqui: o `alter default privileges` da migração 0003 já cobre tabela criada
-- depois pelo mesmo dono (amassa_owner) — `amassa_app` já nasce com select/insert/update/delete
-- nas três tabelas sem grant adicional.
--
-- Recriação condicional (`drop trigger if exists` antes de `create trigger`): reaplicar este
-- arquivo num banco parcialmente migrado não deve explodir — mesma forma de 0002/0006.

drop trigger if exists tocar_atualizado_em_fornos on fornos;
--> statement-breakpoint
create trigger tocar_atualizado_em_fornos
  before update on fornos
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_queimas on queimas;
--> statement-breakpoint
create trigger tocar_atualizado_em_queimas
  before update on queimas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_manutencoes on manutencoes;
--> statement-breakpoint
create trigger tocar_atualizado_em_manutencoes
  before update on manutencoes
  for each row execute function tocar_atualizado_em();
