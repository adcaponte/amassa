-- Correção do gatilho `recusar_mudanca_de_valor_do_parametro()` (migração 0018, Fase 04.5-01).
--
-- ACHADO REAL desta execução (04.5-02-PLAN.md, Tarefa 3, e2e "precificacao parametros"): o
-- gatilho de 0018 recusa QUALQUER `update` que mude `valor_inteiro`, mesmo quando
-- `vigente_desde` continua o MESMO dia (`old.vigente_desde = new.vigente_desde`). Isso quebra a
-- própria ação `definirParametro` (04.5-02-PLAN.md, Tarefa 2) — que grava por
-- `insert ... on conflict (chave, vigente_desde) do update set valor_inteiro = excluded.valor_inteiro`
-- — sempre que já existe uma linha para a chave HOJE: o `on conflict` dispara um `update` de
-- verdade, e o gatilho antigo recusa mesmo essa correção do mesmo dia, contradizendo o texto do
-- próprio plano ("duas edições no mesmo dia atualizam a linha de hoje... o gatilho não é
-- violado"). Provado ao rodar `npm run test:e2e -- --grep "precificacao parametros"` contra
-- Postgres de verdade: a primeira edição do dia sempre funciona (é um INSERT limpo, sem
-- conflito — a chave ainda não tem linha de hoje); qualquer edição SEGUINTE no MESMO dia batia
-- no gatilho antigo e falhava com "SQLSTATE P0001".
--
-- `amassa_app` não tem `delete` em `parametros_precificacao` (revogado em 0018, D-20) — apagar e
-- reinserir a linha de hoje a cada correção não é uma opção; o gatilho PRECISA distinguir os dois
-- casos.
--
-- Regra corrigida (D-15, sem mudar nenhuma garantia de negócio, só destrava o caminho que o
-- plano já previa):
--   1. `vigente_desde` NUNCA muda, em nenhuma linha, de nenhum dia — sempre recusado.
--   2. `valor_inteiro` de uma linha de um dia ANTERIOR a hoje nunca muda — é história, congelada.
--   3. `valor_inteiro` da linha de HOJE pode ser corrigido quantas vezes for preciso no mesmo
--      dia — só a linha de hoje ainda não é "história".
--   `medido` continua podendo mudar livremente, em qualquer linha, como antes.
--
-- `create or replace function` + `drop trigger if exists`/`create trigger`: mesma disciplina de
-- 0018, reaplicar este arquivo num banco já corrigido não deve explodir.

create or replace function recusar_mudanca_de_valor_do_parametro()
returns trigger
language plpgsql
as $$
begin
  if new.vigente_desde <> old.vigente_desde then
    raise exception
      'A data de vigência de um parâmetro não pode ser alterada — mudar o valor de "%" cria um registro novo, nunca reescreve a data de uma linha existente.',
      old.chave;
  end if;

  if old.vigente_desde <> current_date and new.valor_inteiro <> old.valor_inteiro then
    raise exception
      'O valor de um parâmetro já histórico não pode ser alterado — mudar o valor de "%" cria um registro novo com a data de hoje, nunca reescreve um dia anterior.',
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
