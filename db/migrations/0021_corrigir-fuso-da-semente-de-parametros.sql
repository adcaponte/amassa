-- Corrige o fuso da semente de parâmetros (WINDOWS #44) — sem editar 0019 (D-33: as migrações
-- 0017 a 0020 ficam como estão, quatro arquivos, nunca reescritos nem renumerados).
--
-- ACHADO REAL Nº 1 (04.5-10-SUMMARY.md, achado de ambiente durante a Tarefa 4; WINDOWS.md #44): a
-- migração 0019 semeia `vigente_desde = current_date`, que é o `current_date` DO POSTGRES — e o
-- contêiner do banco roda em UTC (CLAUDE.md: `TZ` só no serviço app, nunca no Postgres). A leitura
-- (`lib/precificacao/consultas.ts::parametrosVigentes`) filtra por `vigente_desde <= hoje` com
-- `hojeEmBrasilia()` (America/Sao_Paulo). Entre 21h e meia-noite BRT (0h-3h UTC do dia seguinte),
-- `current_date` do Postgres já avançou um dia enquanto a data civil de Brasília ainda está no dia
-- anterior — os 18 parâmetros nascem "datados de amanhã", `vigente_desde <= hoje` não acha nenhum,
-- e toda tela que depende de `parametrosVigentes` (Peças, editor de Orçamento) mostra "Não deu para
-- carregar os parâmetros" até a virada do dia, quando se cura sozinha. Reproduzido de forma
-- determinística pelo executor do plano 04.5-10, que trabalhou exatamente nessa janela.
--
-- ACHADO REAL Nº 2 (04.5-13-PLAN.md, Tarefa 1 — encontrado ao PROVAR a correção acima contra
-- Postgres de verdade, às 23h41 BRT de 26/09/2026, dentro da própria janela ruim, não por
-- suposição): a função `recusar_mudanca_de_valor_do_parametro()` (0018, corrigida em 0020 para
-- permitir corrigir o VALOR de um parâmetro no mesmo dia) decide "isto é a linha de hoje?"
-- comparando `old.vigente_desde <> current_date` — o MESMO `current_date` cru do Postgres, no
-- MESMO fuso errado do achado nº 1. Sequência real observada: a Tarefa 1 corrigiu a semente para
-- `vigente_desde = hoje_brasilia()` (26/09); o teste que confere "editar o valor de hoje duas
-- vezes é permitido" (04.5-02-PLAN.md, Tarefa 3) foi então recusado pelo gatilho, porque
-- `current_date` já marcava 27/09 (UTC) — a mesma linha que a aplicação trata como "de hoje"
-- (D-15, `hojeEmBrasilia()`) foi tratada pelo BANCO como "de ontem", e a correção do MESMO DIA que
-- 0020 existe para permitir voltou a ser recusada, exatamente nas horas em que alguém mais
-- provavelmente está editando um parâmetro (fim do dia). Mesma classe de defeito do achado nº 1,
-- na mesma tabela, na mesma migração corretiva — não uma mudança de regra de negócio (D-15
-- continua idêntica: só o VALOR de uma linha do dia corrente pode ser corrigido; `vigente_desde`
-- nunca muda em nenhuma linha), só a fonte da data usada para decidir "qual é o dia corrente".
--
-- A correção dos dois achados é GERAL, nunca uma lista de chaves: nenhum caminho legítimo do
-- aplicativo grava ou reconhece `vigente_desde` fora da data civil de Brasília (D-15) — só o
-- defeito de fuso pode produzir esse estado. `hoje_brasilia()` é a MESMA função SQL que toda
-- outra coluna `date` desta base já usa como padrão (0002_base-comum-datas-e-trigger.sql), nunca
-- `current_date` cru — a correção usa a fonte de verdade certa, não repete a conta à mão.
--
-- A correção dos dados é IDEMPOTENTE E SEGURA CONTRA DUPLICATA: depois de aplicada uma vez,
-- nenhuma linha satisfaz mais `vigente_desde > hoje_brasilia()`, e reaplicar este arquivo não muda
-- nada. Ela também cobre o caso (só possível fora do fluxo normal do Drizzle, que nunca reaplica
-- uma migração já registrada — só reaplicando 0019 à mão, por fora do `db:migrate`) de já existir
-- uma linha correta para a MESMA chave em `hoje_brasilia()`: apaga a duplicata "de amanhã" em vez
-- de tentar sobrescrever a data para um par (chave, vigente_desde) que já existe (o que violaria o
-- `unique` do banco). Prova em scripts/testar-migracoes.mjs::conferirCorrecaoDoFusoDaSemente. A
-- correção da função usa `create or replace`, mesma disciplina de 0018/0020 — reaplicar não
-- explode.

-- Achado nº 2 primeiro: recria a função com a data certa ANTES de corrigir os dados abaixo, para
-- que a correção da semente já seja avaliada pela versão corrigida da função (embora, como
-- explicado abaixo, ela precise ficar desligada de qualquer forma para o próprio ajuste de
-- `vigente_desde`).
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

  if old.vigente_desde <> hoje_brasilia() and new.valor_inteiro <> old.valor_inteiro then
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
--> statement-breakpoint

-- Achado nº 1: a correção dos dados. O gatilho recusa qualquer `update` que mude `vigente_desde`
-- (correto para a aplicação, D-15: histórico nunca reescrito) — mas esta É a correção legítima
-- que o gatilho não pode distinguir sozinho de uma reescrita indevida. Desligado só pela duração
-- deste `update`, religado logo em seguida.
alter table parametros_precificacao disable trigger recusar_mudanca_de_valor_do_parametro;
--> statement-breakpoint

-- Duplicata primeiro: uma linha "datada de amanhã" cujo par (chave, hoje_brasilia()) JÁ existe é
-- artefato de uma reaplicação de 0019 por fora do fluxo normal, nunca dado novo — apagada, nunca a
-- linha correta que já está lá.
delete from parametros_precificacao p
 where p.vigente_desde > hoje_brasilia()
   and exists (
     select 1 from parametros_precificacao p2
      where p2.chave = p.chave and p2.vigente_desde = hoje_brasilia()
   );
--> statement-breakpoint

-- A linha restante "datada de amanhã" (sem uma correta já existente para a mesma chave) é
-- corrigida no lugar — o caso comum, de primeira aplicação.
update parametros_precificacao
   set vigente_desde = hoje_brasilia()
 where vigente_desde > hoje_brasilia();
--> statement-breakpoint

alter table parametros_precificacao enable trigger recusar_mudanca_de_valor_do_parametro;
