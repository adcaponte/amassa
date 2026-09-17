-- O Drizzle não gera trigger nenhum (02-MODELO-DE-DADOS.md §6: "funções, views, papéis e
-- grant/revoke o Drizzle NÃO gera") — este arquivo liga as duas tabelas novas do Comparador de
-- Compras (`cotacao_categorias`, `cotacoes`) à função `tocar_atualizado_em()`, que já existe
-- desde a migração 0002, seguindo o checklist de toda tabela nova (§0: criado_em, atualizado_em,
-- trigger). Sem esse trigger, atualizado_em fica parado no valor de criação para sempre, mesmo
-- em UPDATE.
--
-- Nenhum `grant` aqui: o `alter default privileges` da migração 0003 já cobre tabela criada
-- depois pelo mesmo dono (amassa_owner) — amassa_app já nasce com select/insert/update/delete
-- nas duas tabelas sem grant adicional.
--
-- Recriação condicional (`drop trigger if exists` antes de `create trigger`): reaplicar este
-- arquivo num banco parcialmente migrado não deve explodir — mesma forma de 0002/0006/0008/0011.
--
-- ARQUIVAR, NÃO APAGAR (D-03): ao contrário dos gatilhos de 0011 (módulo temporário Abertura,
-- que saem junto com as tabelas na remoção do plano 04.2-05), estes dois gatilhos NÃO entram em
-- `db/remocao/remover-abertura-do-espaco.sql` — o comparador sobrevive ao dia em que a Abertura
-- for desmontada (prova em `scripts/testar-migracoes.mjs`, `conferirRemocaoDoModuloAbertura`).

drop trigger if exists tocar_atualizado_em_cotacao_categorias on cotacao_categorias;
--> statement-breakpoint
create trigger tocar_atualizado_em_cotacao_categorias
  before update on cotacao_categorias
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_cotacoes on cotacoes;
--> statement-breakpoint
create trigger tocar_atualizado_em_cotacoes
  before update on cotacoes
  for each row execute function tocar_atualizado_em();
