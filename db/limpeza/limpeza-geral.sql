-- LIMPEZA GERAL DOS DADOS ANTES DA INAUGURAÇÃO (item 10 da fila do Code; decisões do Theo de
-- 08/10/2026, `.planning/quick/261008-6f1-limpeza-geral-dos-dados-antes-da-inaugur/261008-6f1-CONTEXT.md`).
--
-- O que é: apaga os dados de teste e de uso até aqui — vendas, despesas, contas fixas, orçamentos,
-- ordens de produção, catálogo e fichas (menos os itens do sistema), fornos, queimas, manutenções,
-- turmas, alunos, eventos, mensalidades, uso livre, clientes, fornecedores, movimentações do
-- estoque, lembretes e o texto das anotações da casa — e mantém a Abertura do Espaço, o Comparador
-- de Compras, as categorias, os parâmetros, os usuários e o histórico de backup.
--
-- Este arquivo NÃO é uma migração e nunca vai para `db/migrations/`: o Drizzle nunca o vê, e
-- nenhum `npm run db:migrate` o aplica. Quem roda é o Theo, à mão, depois de um backup, pelo
-- Roteiro 24 (`docs/operacao/24-limpeza-geral.md`), com `npm run limpeza-geral` na imagem
-- `ferramentas` (conexão de DONO, `DATABASE_URL_MIGRACAO`). O script `scripts/limpeza-geral.ts`
-- abre UMA transação, roda este arquivo inteiro dentro dela e: sem `--confirmar`, DESFAZ (ensaio);
-- com `--confirmar --banco <nome>`, grava. Por isso aqui não há `begin`/`commit`.
--
-- As cinco listas (a guarda do bloco (a) as repete — é a mesma classificação):
--   APAGA (32) — esvaziadas por um TRUNCATE só;
--   SEMENTE (1) — anotacoes_da_casa volta à linha da semente da 0022;
--   PARCIAL (1) — itens_catalogo perde só os itens SEM chave_do_sistema;
--   ZERA (2) — configuracao_financeira (só o saldo inicial vai a 0; taxa do cartão e data ficam,
--              escolha L7) e contadores_orcamento (esvaziado no TRUNCATE: sem linha, o próximo
--              orçamento do ano é o 1, pelo upsert de `lib/orcamentos/numero.ts`);
--   FICA (10) — intactas. A tabela de migrações do Drizzle (schema `drizzle`) também fica.
--
-- Por que TRUNCATE e não DELETE: as restrições de soma do Financeiro são `constraint trigger`
-- adiadas (0015: `conferir_soma_apos_linha`, `_apos_parcela`, `_apos_documento`) que um DELETE
-- dispara linha a linha; o TRUNCATE não dispara gatilho de linha, trata as chaves estrangeiras
-- entre as tabelas listadas de uma vez, trava cada tabela até o fim da transação (nenhuma escrita
-- da aplicação no meio) e, com `restart identity`, devolve as três numerações (venda/despesa,
-- ordem de produção, movimentação do estoque) a 1. Ele NÃO propaga para outras tabelas: se um dia
-- uma tabela que fica passar a referenciar uma que sai, o comando FALHA e a transação inteira
-- desfaz — nunca esvazia a que fica.
--
-- Por que a folha da casa volta à semente em vez de ficar sem linha: `lerFolhaDaCasa`
-- (`lib/anotacoes/consultas.ts`) e `salvarAnotacoes` LANÇAM erro sem a linha única — o Início
-- quebraria. O texto some; a linha fica como a 0022 a criou (texto vazio, ninguém salvou).
--
-- Por que TODOS os itens com chave ficam (seis, não três): a regra do Theo é "exceto os itens com
-- `chave_do_sistema` não nula". Hoje são `mensalidade`, `inscricao_oficina`, `uso_livre_hora`
-- (0026, a Agenda os acha por código) e `queima_externa_p/m/g` (0030, `/api/health/queimas` exige o
-- P). O gatilho `travar_item_do_sistema` recusaria apagá-los de qualquer jeito. Preço, nome e
-- categoria deles ficam como estão. O que eles precisam para continuar válidos — a categoria de
-- venda — está em `categorias`, que fica.
--
-- Idempotente: rodar de novo não muda nada (a folha só é recriada se tiver conteúdo; o saldo só é
-- gravado se for diferente de 0).
--
-- Prova: `scripts/provar-limpeza-geral.mjs`, dentro de `npm run test:migracoes` (logo de
-- `npm run verificar` e do job `banco` da CI), num banco próprio com as 46 tabelas populadas.

-- (a) Guarda: nada muda se o banco não for exatamente o que esta limpeza conhece.
do $$
declare
  apaga text[] := array[
    'ordens_producao', 'ordem_pecas', 'ordem_etapas',
    'orcamentos', 'orcamento_linhas', 'orcamento_projeto', 'orcamento_revisoes', 'orcamento_fotos',
    'documentos', 'documento_linhas', 'parcelas', 'correcoes_de_documento', 'contas_fixas',
    'movimentacoes_estoque',
    'ficha_tecnica', 'fichas_precificacao',
    'fornos', 'queimas', 'queima_contagens', 'queima_vendas', 'manutencoes',
    'turmas', 'turma_alunos', 'inscricoes', 'mensalidades', 'eventos', 'usos_livres',
    'usos_livres_material',
    'clientes', 'fornecedores', 'fornecedor_anexos',
    'lembretes'
  ];
  semente text[] := array['anotacoes_da_casa'];
  parcial text[] := array['itens_catalogo'];
  zera text[] := array['configuracao_financeira', 'contadores_orcamento'];
  fica text[] := array[
    'abertura_itens', 'abertura_tarefas', 'abertura_configuracao',
    'cotacoes', 'cotacao_categorias',
    'categorias', 'parametros_precificacao',
    'usuarios', 'execucoes_backup', 'verificacao_infraestrutura'
  ];
  sequencias_conhecidas text[] := array[
    'documentos_numero_seq', 'movimentacoes_estoque_numero_seq', 'ordens_producao_numero_seq'
  ];
  classificadas text[];
  sobrando text;
  faltando text;
  sequencia_nova text;
  chave_ruim text;
begin
  classificadas := apaga || semente || parcial || zera || fica;

  if array_length(apaga, 1) <> 32 or array_length(classificadas, 1) <> 46 then
    raise exception using message =
      'Recusado: as listas desta limpeza não somam 32 tabelas a apagar e 46 ao todo — o arquivo foi '
      || 'editado sem revisar a classificação. Nada foi apagado.';
  end if;

  select string_agg(c.relname, ', ' order by c.relname)
    into sobrando
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and c.relname <> all (classificadas);
  if sobrando is not null then
    raise exception using message =
      'Recusado: o banco tem tabela que a limpeza não conhece: ' || sobrando || '. '
      || 'Ninguém decidiu se ela apaga ou fica — a limpeza precisa ser revista com o Theo antes de '
      || 'rodar. Nada foi apagado.';
  end if;

  select string_agg(nome, ', ' order by nome)
    into faltando
    from unnest(classificadas) as nome
   where not exists (
     select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = nome
   );
  if faltando is not null then
    raise exception using message =
      'Recusado: falta no banco tabela que a limpeza espera: ' || faltando || '. '
      || 'O banco não está na versão que esta limpeza conhece (migração faltando?). Nada foi apagado.';
  end if;

  select string_agg(c.relname, ', ' order by c.relname)
    into sequencia_nova
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'S'
     and c.relname <> all (sequencias_conhecidas);
  if sequencia_nova is not null then
    raise exception using message =
      'Recusado: o banco tem numeração (sequence) que a limpeza não conhece: ' || sequencia_nova
      || '. Ninguém decidiu se ela volta a 1 — a limpeza precisa ser revista com o Theo antes de '
      || 'rodar. Nada foi apagado.';
  end if;

  select string_agg(format('%s → %s (%s)', origem.relname, destino.relname, k.conname), ', '
                    order by origem.relname, destino.relname)
    into chave_ruim
    from pg_constraint k
    join pg_class origem on origem.oid = k.conrelid
    join pg_namespace n on n.oid = origem.relnamespace
    join pg_class destino on destino.oid = k.confrelid
   where n.nspname = 'public'
     and k.contype = 'f'
     and (
       (origem.relname = any (fica || zera || semente || parcial) and destino.relname = any (apaga))
       or (origem.relname = any (fica || zera || semente) and destino.relname = any (parcial))
     );
  if chave_ruim is not null then
    raise exception using message =
      'Recusado: tabela que fica aponta para tabela que sai: ' || chave_ruim || '. '
      || 'Apagar quebraria esse vínculo — a limpeza precisa ser revista com o Theo antes de rodar. '
      || 'Nada foi apagado.';
  end if;
end;
$$;

-- (b) APAGA + contadores_orcamento: um TRUNCATE só, numerações de volta a 1. Sem propagação: se
-- alguma tabela fora desta lista referenciar uma delas, o Postgres recusa e nada é apagado.
truncate table
  ordens_producao, ordem_pecas, ordem_etapas,
  orcamentos, orcamento_linhas, orcamento_projeto, orcamento_revisoes, orcamento_fotos,
  documentos, documento_linhas, parcelas, correcoes_de_documento, contas_fixas,
  movimentacoes_estoque,
  ficha_tecnica, fichas_precificacao,
  fornos, queimas, queima_contagens, queima_vendas, manutencoes,
  turmas, turma_alunos, inscricoes, mensalidades, eventos, usos_livres, usos_livres_material,
  clientes, fornecedores, fornecedor_anexos,
  lembretes,
  contadores_orcamento
  restart identity;

-- (c) SEMENTE: a folha da casa volta a ser a da 0022. Só apaga a linha se ela tiver conteúdo —
-- na segunda execução nada muda, nem o `atualizado_em`.
delete from anotacoes_da_casa
 where texto <> '' or salvo_por is not null;

insert into anotacoes_da_casa (texto) values ('')
on conflict do nothing;

-- (d) PARCIAL: saem os itens sem chave do sistema. As seis tabelas que apontam para itens já
-- estão vazias pelo (b); o gatilho `travar_item_do_sistema` deixa passar item sem chave.
delete from itens_catalogo
 where chave_do_sistema is null;

-- (e) ZERA (L7): só o saldo inicial. A taxa do cartão e a data do saldo ficam. Sem linha, nada a
-- fazer — ausente já é saldo 0.
update configuracao_financeira
   set saldo_inicial_centavos = 0
 where saldo_inicial_centavos <> 0;

-- (f) Conferência final, ainda dentro da transação: se algo não ficou como deveria, tudo desfaz.
do $$
declare
  esvaziadas text[] := array[
    'ordens_producao', 'ordem_pecas', 'ordem_etapas',
    'orcamentos', 'orcamento_linhas', 'orcamento_projeto', 'orcamento_revisoes', 'orcamento_fotos',
    'documentos', 'documento_linhas', 'parcelas', 'correcoes_de_documento', 'contas_fixas',
    'movimentacoes_estoque',
    'ficha_tecnica', 'fichas_precificacao',
    'fornos', 'queimas', 'queima_contagens', 'queima_vendas', 'manutencoes',
    'turmas', 'turma_alunos', 'inscricoes', 'mensalidades', 'eventos', 'usos_livres',
    'usos_livres_material',
    'clientes', 'fornecedores', 'fornecedor_anexos',
    'lembretes',
    'contadores_orcamento'
  ];
  sequencias text[] := array[
    'documentos_numero_seq', 'movimentacoes_estoque_numero_seq', 'ordens_producao_numero_seq'
  ];
  nome text;
  tem_linha boolean;
  chamada boolean;
  folhas integer;
  folhas_semente integer;
  itens_sem_chave integer;
  saldos_nao_zero integer;
begin
  foreach nome in array esvaziadas loop
    execute format('select exists (select 1 from %I)', nome) into tem_linha;
    if tem_linha then
      raise exception using message =
        'Falhou a conferência final: a tabela ' || nome || ' ainda tem linha. Nada foi apagado.';
    end if;
  end loop;

  select count(*), count(*) filter (where texto = '' and salvo_por is null)
    into folhas, folhas_semente
    from anotacoes_da_casa;
  if folhas <> 1 or folhas_semente <> 1 then
    raise exception using message =
      'Falhou a conferência final: a folha das anotações da casa não ficou como uma linha vazia ('
      || folhas || ' linha(s)). Nada foi apagado.';
  end if;

  select count(*) into itens_sem_chave from itens_catalogo where chave_do_sistema is null;
  if itens_sem_chave <> 0 then
    raise exception using message =
      'Falhou a conferência final: sobraram ' || itens_sem_chave
      || ' item(ns) do catálogo sem chave do sistema. Nada foi apagado.';
  end if;

  select count(*) into saldos_nao_zero from configuracao_financeira where saldo_inicial_centavos <> 0;
  if saldos_nao_zero <> 0 then
    raise exception using message =
      'Falhou a conferência final: o saldo inicial do caixa não ficou em zero. Nada foi apagado.';
  end if;

  foreach nome in array sequencias loop
    execute format('select is_called from %I', nome) into chamada;
    if chamada then
      raise exception using message =
        'Falhou a conferência final: a numeração ' || nome || ' não voltou a 1. Nada foi apagado.';
    end if;
  end loop;
end;
$$;
