-- O Drizzle não gera trigger nenhum, nem função, nem grant/revoke (02-MODELO-DE-DADOS.md §6) —
-- este arquivo faz o que a migração 0017 (só tabelas) deixou de fora, seguindo o mesmo molde de
-- 0006/0008/0011/0013/0015:
--
-- (1) os seis gatilhos `tocar_atualizado_em_<tabela>`, nas tabelas de 0017 que TÊM
--     `atualizado_em` (`orcamento_revisoes` e `execucoes_backup` NÃO entram aqui — a primeira é
--     tabela só-de-inserção por desenho, a segunda já tem seu próprio gatilho ausente por
--     desenho desde a Fase 1, e nenhuma das duas ganhou `atualizado_em` nesta fase);
-- (2) a função `recusar_mudanca_de_valor_do_parametro()` + gatilho `before update` em
--     `parametros_precificacao` — D-15 defendida pelo banco: mudar o VALOR de um parâmetro cria
--     linha nova, nunca reescreve a anterior; só `medido` é atualizável;
-- (3) `grant select, insert, update` para `amassa_app` nas oito tabelas novas, mais
--     `grant delete` só em `orcamento_linhas`/`orcamento_projeto`/`orcamento_fotos`/
--     `fichas_precificacao` (tirar uma linha, tirar uma foto, apagar uma ficha que não está em
--     nenhum orçamento — D-20), e `revoke delete` explícito em `orcamentos`,
--     `orcamento_revisoes`, `parametros_precificacao` e `contadores_orcamento` (um `revoke`
--     contra o dono da tabela, amassa_owner, não vale nada — mesmo raciocínio de
--     0003_papel-amassa-app-e-grants.sql).
--
-- Recriação condicional em tudo (`create or replace function`, `drop trigger if exists`):
-- reaplicar este arquivo num banco parcialmente migrado não deve explodir.

-- (1) Gatilhos de atualizado_em — um drop + um create por tabela, nas seis tabelas de 0017 com
-- essa coluna.
drop trigger if exists tocar_atualizado_em_parametros_precificacao on parametros_precificacao;
--> statement-breakpoint
create trigger tocar_atualizado_em_parametros_precificacao
  before update on parametros_precificacao
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_fichas_precificacao on fichas_precificacao;
--> statement-breakpoint
create trigger tocar_atualizado_em_fichas_precificacao
  before update on fichas_precificacao
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_orcamentos on orcamentos;
--> statement-breakpoint
create trigger tocar_atualizado_em_orcamentos
  before update on orcamentos
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_orcamento_linhas on orcamento_linhas;
--> statement-breakpoint
create trigger tocar_atualizado_em_orcamento_linhas
  before update on orcamento_linhas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_orcamento_projeto on orcamento_projeto;
--> statement-breakpoint
create trigger tocar_atualizado_em_orcamento_projeto
  before update on orcamento_projeto
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_orcamento_fotos on orcamento_fotos;
--> statement-breakpoint
create trigger tocar_atualizado_em_orcamento_fotos
  before update on orcamento_fotos
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (2) D-15 no banco: mudar VALOR de parâmetro cria linha nova, nunca reescreve a anterior.
-- Comparar new/old é seguro mesmo em update que não toca nenhuma das duas colunas (a condição
-- fica falsa e o gatilho deixa passar) — só dispara exceção quando o valor OU a vigência
-- realmente mudam. `medido` (e só ele) pode mudar livremente.
create or replace function recusar_mudanca_de_valor_do_parametro()
returns trigger
language plpgsql
as $$
begin
  if new.valor_inteiro <> old.valor_inteiro or new.vigente_desde <> old.vigente_desde then
    raise exception
      'O valor e a data de vigência de um parâmetro não podem ser alterados — mudar o valor de "%" cria um registro novo com data nova, nunca reescreve o anterior.',
      old.chave;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

drop trigger if exists recusar_mudanca_de_valor_do_parametro on parametros_precificacao;
--> statement-breakpoint
create trigger recusar_mudanca_de_valor_do_parametro
  before update on parametros_precificacao
  for each row execute function recusar_mudanca_de_valor_do_parametro();
--> statement-breakpoint

-- (3) Grants nas oito tabelas novas. select/insert/update em todas; delete só nas quatro onde
-- "tirar uma linha" é uma operação legítima do dia a dia (D-20).
grant select, insert, update on
  parametros_precificacao,
  fichas_precificacao,
  orcamentos,
  orcamento_linhas,
  orcamento_projeto,
  orcamento_fotos,
  orcamento_revisoes,
  contadores_orcamento
  to amassa_app;
--> statement-breakpoint

grant delete on
  orcamento_linhas,
  orcamento_projeto,
  orcamento_fotos,
  fichas_precificacao
  to amassa_app;
--> statement-breakpoint

revoke delete on orcamentos, orcamento_revisoes, parametros_precificacao, contadores_orcamento
  from amassa_app;
