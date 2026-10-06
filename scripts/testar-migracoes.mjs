#!/usr/bin/env node
// Prova, de fora, que a base comum do banco (extensão, funções de data, trigger e o papel
// amassa_app) saiu como especificado — não pelo relato de quem rodou `npm run db:migrate`,
// mas consultando o Postgres depois, pelo cliente `pg`, que já é dependência do projeto.
// Nenhum binário de linha de comando do Postgres é invocado: essa suposição já quebrou no
// Windows durante a Fase 1 (ver 01-07-SUMMARY.md, seção "Desvios e descobertas").
//
// Orquestração no molde de scripts/testar-e2e.mjs: em CI usa o banco de teste que o runner já
// entrega; localmente sobe o Postgres efêmero de docker/compose.teste.yml, publica a porta só
// pela linha de comando, e derruba tudo no finally.

import { execFileSync, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const NOME_CONTAINER = "amassa_postgres_teste_migracoes";
const PORTA_HOST = 5435;
const USUARIO = "amassa_teste";
const SENHA = "efemero_de_teste_sem_valor_real";
const BANCO = "amassa_teste";

// Lista exata de tabelas que devem existir no schema público depois das migrações. Cada fase
// que acrescentar uma tabela de produto atualiza esta constante — é o que impede uma tabela
// nova de aparecer sem ninguém notar.
const TABELAS_ESPERADAS = [
  "verificacao_infraestrutura",
  "usuarios",
  "execucoes_backup",
  // (As três tabelas da Fase 3 — `encomendas`, `encomenda_itens`, `encomenda_etapas`, da 0005 —
  // saíram: a 0025_remover-encomendas da Fase 06.1 as apaga; a prova está em
  // `provarMigracaoDaProducaoEmBancoProprio`.)
  // Fase 4 — Contador de Queima (migração 0007_queimas).
  "fornos",
  "queimas",
  "manutencoes",
  // Fase 4.2 — Abertura do Espaço (migração 0010_abertura-do-espaco). MÓDULO TEMPORÁRIO: estas
  // três saem juntas na remoção do plano 04.2-05.
  "abertura_itens",
  "abertura_tarefas",
  "abertura_configuracao",
  // Fase 4.3 — Comparador de Compras (migração 0012_comparador-de-compras), aba dentro do
  // módulo Abertura do Espaço. FORA do grupo prefixado acima de propósito (D-03): ao contrário
  // das três tabelas de Abertura, estas duas NÃO saem quando o módulo for desmontado — elas são
  // arquivadas, não apagadas. A prova de sobrevivência roda em `conferirRemocaoDoModuloAbertura`
  // (Tarefa 3 do plano 04.3-01), nunca em `TABELAS_DA_REMOCAO_ABERTURA` abaixo.
  "cotacao_categorias",
  "cotacoes",
  // Fase 04.4 — Financeiro (migração 0014_financeiro): permanentes, não saem com a Abertura —
  // ao contrário do bloco de Abertura do Espaço acima, nenhuma tabela abaixo entra em
  // TABELAS_DA_REMOCAO_ABERTURA nem depende do módulo temporário para existir.
  "categorias",
  "itens_catalogo",
  "ficha_tecnica",
  "documentos",
  "documento_linhas",
  "parcelas",
  "contas_fixas",
  "configuracao_financeira",
  // Fase 04.5 — Financeiro, parte 2: Precificação e Orçamento (migração 0017_precificacao-e-
  // orcamentos). Permanentes, não saem com a Abertura — nenhuma delas entra em
  // TABELAS_DA_REMOCAO_ABERTURA.
  "parametros_precificacao",
  "fichas_precificacao",
  "orcamentos",
  "orcamento_linhas",
  "orcamento_projeto",
  "orcamento_fotos",
  "orcamento_revisoes",
  "contadores_orcamento",
  // Fase 04.6, plano 07 — Anotações da casa (migração 0022_anotacoes-da-casa). Permanente, não
  // sai com a Abertura — não entra em TABELAS_DA_REMOCAO_ABERTURA.
  "anotacoes_da_casa",
  // Fase 06 — Estoque (migração 0023_estoque). Permanente; não entra em
  // TABELAS_DA_REMOCAO_ABERTURA. O livro imutável de onde o saldo sai (não existe tabela de
  // materiais nem de saldos — D-01/EST-02). As conferências do livro (revoke, gatilho da unidade,
  // checks) e a prova de concorrência são do plano 06-02.
  "movimentacoes_estoque",
  // Fase 06.1 — Produção (migração 0024_producao). Permanentes; não entram em
  // TABELAS_DA_REMOCAO_ABERTURA. As três `encomenda*` da Fase 3 foram apagadas pela `0025`
  // (plano 06.1-14). As conferências completas das tabelas novas e a prova do D-02 e da `0025`
  // em banco próprio são dos planos 06.1-02 e 06.1-14; aqui, o vínculo do livro com a ordem
  // (conferirEstoque).
  "ordens_producao",
  "ordem_etapas",
  "ordem_pecas",
  // Fase 5 — Agenda (migração 0026_agenda). Permanentes; não entram em
  // TABELAS_DA_REMOCAO_ABERTURA. As invariantes (privilégio, chaves únicas, checks, o enum em
  // texto, a FK do uso livre com baixa, o gatilho e a semente do item do sistema) são provadas em
  // `conferirAgenda` (plano 05-02).
  "clientes",
  "turmas",
  "turma_alunos",
  "eventos",
  "inscricoes",
  "mensalidades",
  "usos_livres",
  "usos_livres_material",
  // Fase 06.2 — Fornecedores (migração 0028_fornecedores). Permanentes; não entram em
  // TABELAS_DA_REMOCAO_ABERTURA. As invariantes (unicidade entre ativos sem caixa, `revoke delete`
  // de `fornecedores` e não de `fornecedor_anexos`, gatilho, checks, o vínculo da despesa e as
  // colunas novas de `execucoes_backup`) são provadas em `conferirFornecedores` (plano 06.2-01).
  "fornecedores",
  "fornecedor_anexos",
  // Fase 06.3 — Lembretes (migração 0029_lembretes). Permanente; não entra em
  // TABELAS_DA_REMOCAO_ABERTURA. 🔴 EXCEÇÃO DELIBERADA: `amassa_app` MANTÉM o delete nesta tabela
  // (LMB-08, decisão do dono em 02/10/2026) — `conferirLembretes` prova.
  "lembretes",
  // Fase 06.4 — Queimas: contagem (migração 0030_queimas-contagem). Permanentes; não entram em
  // TABELAS_DA_REMOCAO_ABERTURA. queima_contagens: uma linha por queima; sem linha = sem
  // contagem. queima_vendas: uma linha por venda das externas (D-07).
  "queima_contagens",
  "queima_vendas",
  // Fase 06.5 — Polimento (migração 0031_polimento). Permanente; não entra em
  // TABELAS_DA_REMOCAO_ABERTURA. O vínculo do “Corrigir” (original → corrigido), à parte de
  // `documentos`; só cresce (`revoke update, delete`) — `conferirPolimento` prova.
  "correcoes_de_documento",
];

// A MESMA lista de tabelas acima, numa constante própria para a verificação da remoção
// (`conferirRemocaoDoModuloAbertura`, mais abaixo) — no dia da abertura, as mesmas três saem de
// TABELAS_ESPERADAS e esta constante inteira é apagada junto com o módulo (Roteiro 8,
// `docs/operacao/08-remover-abertura-do-espaco.md`).
const TABELAS_DA_REMOCAO_ABERTURA = ["abertura_itens", "abertura_tarefas", "abertura_configuracao"];

// Os três tipos de enum do módulo — `drop table` não os apaga, só `drop type` apaga. Um enum
// órfão em pg_type é exatamente o resíduo que ABE-15 proíbe.
const TIPOS_DA_REMOCAO_ABERTURA = [
  "categoria_item_abertura",
  "forma_pagamento_abertura",
  "grupo_tarefa_abertura",
];

// Nome do banco de produção — a mesma guarda de disciplina do Passo 1 dos roteiros de operação:
// barato de conferir, caro de errar. `conferirRemocaoDoModuloAbertura` se recusa a rodar um
// único `drop` sequer se o banco conectado tiver este nome.
const BANCO_DE_PRODUCAO = "amassa";

// docker.exe é executável direto em qualquer plataforma — sem shell.
function rodarDocker(args, opcoes = {}) {
  execFileSync("docker", args, { stdio: "inherit", ...opcoes });
}

function tentarRodarDocker(args) {
  try {
    execFileSync("docker", args, { stdio: "ignore" });
  } catch {
    // Sem problema — usado só para limpeza best-effort.
  }
}

// npm/npx são scripts .cmd no Windows — precisam do shell para rodar. Com shell, a chamada
// segura é uma única string (não um array de args não escapados).
function rodarNpm(comando, args, opcoes = {}) {
  execSync(`${comando} ${args.join(" ")}`, { stdio: "inherit", ...opcoes });
}

function statusDeSaude() {
  try {
    return execFileSync("docker", ["inspect", "-f", "{{.State.Health.Status}}", NOME_CONTAINER])
      .toString()
      .trim();
  } catch {
    return "";
  }
}

async function esperarSaudavel(tentativasMax = 30) {
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    if (statusDeSaude() === "healthy") return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Postgres de teste não ficou saudável a tempo.");
}

async function subirBancoDeTeste() {
  console.log("Subindo o Postgres de teste (efêmero, porta só desta execução)...");
  tentarRodarDocker(["compose", "-f", "docker/compose.teste.yml", "down", "--remove-orphans"]);
  rodarDocker([
    "compose",
    "-f",
    "docker/compose.teste.yml",
    "run",
    "-d",
    "--rm",
    "--name",
    NOME_CONTAINER,
    "-p",
    `127.0.0.1:${PORTA_HOST}:5432`,
    "postgres_teste",
  ]);
  await esperarSaudavel();
  process.env.DATABASE_URL_TESTE = `postgresql://${USUARIO}:${SENHA}@127.0.0.1:${PORTA_HOST}/${BANCO}`;
  console.log("Banco de teste no ar.");
}

// Todas as afirmações desta função, cada uma com mensagem em português dizendo o que ficou
// faltando. Lança no primeiro erro — é o que faz `npm run test:migracoes` sair diferente de 0.
function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

// A data civil em America/Sao_Paulo calculada pelo próprio Node, sem nenhuma dependência nova
// — é o par independente que confere hoje_brasilia() do lado de fora do banco.
function dataBrasiliaDeHoje() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function conferirFusoDoBanco(cliente) {
  const { rows } = await cliente.query("show timezone");
  afirmar(
    rows[0].TimeZone === "UTC",
    `O fuso do servidor Postgres deveria ser UTC, veio "${rows[0].TimeZone}". ` +
      "Alguma variável TZ alcançou o container do banco — confira docker/compose.yml e " +
      "docker/compose.teste.yml, o bloco do serviço postgres não pode declarar TZ.",
  );
}

async function conferirTabelas(cliente) {
  const { rows } = await cliente.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  const encontradas = rows.map((linha) => linha.table_name).sort();
  const esperadas = [...TABELAS_ESPERADAS].sort();
  afirmar(
    JSON.stringify(encontradas) === JSON.stringify(esperadas),
    "A lista de tabelas do schema público não bate com TABELAS_ESPERADAS.\n" +
      `Esperado: ${esperadas.join(", ")}\n` +
      `Encontrado: ${encontradas.join(", ")}\n` +
      "Se uma fase acabou de acrescentar uma tabela de produto, atualize a constante " +
      "TABELAS_ESPERADAS no topo deste arquivo.",
  );
}

// Confere a tabela execucoes_backup (plano 06): as colunas certas, nenhum atualizado_em nem
// trigger (exceção deliberada de tabela só de inserção), o índice sobre `quando` e o padrão
// pessimista de destino_externo_ok.
async function conferirTabelaExecucoesBackup(cliente) {
  const colunas = await cliente.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'execucoes_backup'`,
  );
  const nomes = new Set(colunas.rows.map((linha) => linha.column_name));
  const esperadas = [
    "id",
    "quando",
    "sucesso",
    "bytes",
    "destino_externo_ok",
    "mensagem",
    // Fase 06.2 (0028, D-05): o par dos anexos dos fornecedores, no molde de `fotos_*` (0017).
    "anexos_bytes",
    "anexos_destino_externo_ok",
  ];
  for (const coluna of esperadas) {
    afirmar(nomes.has(coluna), `execucoes_backup não tem a coluna esperada "${coluna}".`);
  }
  afirmar(
    !nomes.has("atualizado_em"),
    "execucoes_backup tem uma coluna atualizado_em — ela é uma tabela só de inserção " +
      "(cada execução do script de backup escreve uma linha nova) e não deveria ter essa " +
      "coluna, a mesma exceção que 02-MODELO-DE-DADOS.md §0 abre para movimentacoes_estoque.",
  );

  const trigger = await cliente.query(
    "select 1 from pg_trigger where tgrelid = 'execucoes_backup'::regclass and not tgisinternal",
  );
  afirmar(
    trigger.rowCount === 0,
    "execucoes_backup tem um trigger — ela é uma tabela só de inserção e não deveria ter " +
      "nenhum trigger de atualizado_em.",
  );

  const indice = await cliente.query(
    `select 1 from pg_indexes where schemaname = 'public' and tablename = 'execucoes_backup'
     and indexname = 'execucoes_backup_quando_idx'`,
  );
  afirmar(
    indice.rowCount === 1,
    "O índice execucoes_backup_quando_idx não existe — /api/health/backup sempre pede a " +
      "última linha por quando decrescente, e essa é a única consulta que a tabela recebe.",
  );

  const inserida = await cliente.query(
    `insert into execucoes_backup (sucesso) values (true)
     returning id, destino_externo_ok, anexos_bytes, anexos_destino_externo_ok`,
  );
  const {
    id,
    destino_externo_ok: destinoExternoOk,
    anexos_bytes: anexosBytes,
    anexos_destino_externo_ok: anexosDestinoExternoOk,
  } = inserida.rows[0];
  try {
    afirmar(
      destinoExternoOk === false,
      "destino_externo_ok deveria sair falso por padrão ao inserir só sucesso (o padrão " +
        `pessimista é deliberado) — veio ${destinoExternoOk}.`,
    );
    // D-05: nulo = "nenhuma tentativa registrada" — é o que mantém legíveis as linhas escritas
    // antes da 0028. Um padrão `false` aqui faria toda linha antiga parecer falha da cópia externa.
    afirmar(
      anexosBytes === null && anexosDestinoExternoOk === null,
      "anexos_bytes e anexos_destino_externo_ok deveriam sair NULOS ao inserir só sucesso (nulo = " +
        `sem tentativa registrada, D-05) — vieram ${anexosBytes} e ${anexosDestinoExternoOk}.`,
    );
  } finally {
    // Registro operacional de teste, não histórico de autoria — apagar aqui é aceitável.
    await cliente.query("delete from execucoes_backup where id = $1", [id]);
  }
}

async function conferirExtensaoEFuncoes(cliente) {
  const extensao = await cliente.query(
    "select 1 from pg_extension where extname = 'unaccent'",
  );
  afirmar(
    extensao.rowCount === 1,
    "A extensão unaccent não está instalada — confira a migração da base comum " +
      "(db/migrations, seção 'base comum de datas e trigger').",
  );

  const dataDoBanco = await cliente.query("select hoje_brasilia()::text as valor");
  const dataEsperada = dataBrasiliaDeHoje();
  afirmar(
    dataDoBanco.rows[0].valor === dataEsperada,
    `hoje_brasilia() devolveu "${dataDoBanco.rows[0].valor}", mas a data civil de ` +
      `America/Sao_Paulo calculada pelo Node é "${dataEsperada}". Isso normalmente indica ` +
      "que o container do Postgres não está mais em UTC, ou que a função não converte o " +
      "fuso corretamente.",
  );

  const trigger = await cliente.query(
    "select 1 from pg_trigger where tgname = 'tocar_atualizado_em_usuarios'",
  );
  afirmar(
    trigger.rowCount === 1,
    "O trigger tocar_atualizado_em_usuarios não existe. A função tocar_atualizado_em() " +
      "sozinha não faz nada — falta o 'create trigger' sobre a tabela usuarios.",
  );
}

async function conferirTriggerFuncionando(cliente) {
  // Este é o único lugar do sistema onde apagar uma linha de usuarios é legítimo — o banco é
  // efêmero e a linha é puramente de teste, apagada ao final desta função.
  const inserida = await cliente.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste', 'usuaria-de-teste@exemplo.test', 'hash-fake-de-teste')
     returning id, atualizado_em`,
  );
  const { id, atualizado_em: carimboAntes } = inserida.rows[0];

  // Pausa pequena: sem ela, "antes" e "depois" podem cair no mesmo microssegundo e a
  // comparação de avanço ficaria ambígua por coincidência de relógio, não por defeito real.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const atualizada = await cliente.query(
    "update usuarios set nome = 'Usuária de Teste (atualizada)' where id = $1 returning atualizado_em",
    [id],
  );
  const carimboDepois = atualizada.rows[0].atualizado_em;

  await cliente.query("delete from usuarios where id = $1", [id]);

  afirmar(
    new Date(carimboDepois).getTime() > new Date(carimboAntes).getTime(),
    "atualizado_em não avançou depois de um update que não mencionou essa coluna — o " +
      "trigger tocar_atualizado_em_usuarios não está funcionando de verdade.",
  );
}

async function conferirPapelEPrivilegios(cliente) {
  const papel = await cliente.query(
    `select rolsuper, rolcreatedb, rolcreaterole
     from pg_roles where rolname = 'amassa_app'`,
  );
  afirmar(papel.rowCount === 1, "O papel amassa_app não existe.");
  const { rolsuper, rolcreatedb, rolcreaterole } = papel.rows[0];
  afirmar(
    rolsuper === false && rolcreatedb === false && rolcreaterole === false,
    "O papel amassa_app tem privilégio elevado demais " +
      `(rolsuper=${rolsuper}, rolcreatedb=${rolcreatedb}, rolcreaterole=${rolcreaterole}) — ` +
      "ele deveria ser um papel comum, sem nenhum dos três.",
  );

  const posse = await cliente.query(
    "select tablename from pg_tables where schemaname = 'public' and tableowner = 'amassa_app'",
  );
  afirmar(
    posse.rowCount === 0,
    `O papel amassa_app é dono de tabela (${posse.rows.map((l) => l.tablename).join(", ")}) — ` +
      "ele nunca deveria ser dono de tabela nenhuma; quem cria tabela é amassa_owner.",
  );

  const privilegiosUsuarios = await cliente.query(
    `select
       has_table_privilege('amassa_app', 'usuarios', 'select')   as pode_select,
       has_table_privilege('amassa_app', 'usuarios', 'insert')   as pode_insert,
       has_table_privilege('amassa_app', 'usuarios', 'update')   as pode_update,
       has_table_privilege('amassa_app', 'usuarios', 'delete')   as pode_delete,
       has_table_privilege('amassa_app', 'usuarios', 'truncate') as pode_truncate`,
  );
  const { pode_select, pode_insert, pode_update, pode_delete, pode_truncate } =
    privilegiosUsuarios.rows[0];
  afirmar(
    pode_select && pode_insert && pode_update && pode_delete,
    "O papel amassa_app não tem as quatro operações de manipulação de dados " +
      `(select/insert/update/delete) sobre usuarios (select=${pode_select}, ` +
      `insert=${pode_insert}, update=${pode_update}, delete=${pode_delete}).`,
  );
  afirmar(
    pode_truncate === false,
    "O papel amassa_app tem privilégio de truncate sobre usuarios — ele não deveria ter " +
      "nenhum privilégio de esvaziamento de tabela.",
  );

  // Privilégios padrão: uma tabela criada DEPOIS da migração, como o dono do banco, já
  // precisa nascer com as quatro operações concedidas ao papel de aplicação — senão as
  // tabelas das Fases 3 a 6 nasceriam invisíveis para a aplicação.
  await cliente.query("create table tabela_descartavel_teste_migracoes (id int)");
  try {
    const privilegiosFuturos = await cliente.query(
      `select
         has_table_privilege('amassa_app', 'tabela_descartavel_teste_migracoes', 'select') as pode_select,
         has_table_privilege('amassa_app', 'tabela_descartavel_teste_migracoes', 'insert') as pode_insert,
         has_table_privilege('amassa_app', 'tabela_descartavel_teste_migracoes', 'update') as pode_update,
         has_table_privilege('amassa_app', 'tabela_descartavel_teste_migracoes', 'delete') as pode_delete`,
    );
    const futuros = privilegiosFuturos.rows[0];
    afirmar(
      futuros.pode_select && futuros.pode_insert && futuros.pode_update && futuros.pode_delete,
      "Uma tabela criada depois da migração não nasceu com os privilégios padrão concedidos " +
        "a amassa_app — falta o 'alter default privileges' na migração dos papéis.",
    );
  } finally {
    await cliente.query("drop table tabela_descartavel_teste_migracoes");
  }
}

// npm/npx precisam do shell no Windows (rodarNpm acima) — esta variante captura a saída em
// vez de herdar o terminal, porque redefinir-senha imprime a senha nova numa linha `SENHA: `
// que este cenário precisa ler de volta.
function rodarNpmCapturado(comando, args, opcoes = {}) {
  return execSync(`${comando} ${args.join(" ")}`, {
    stdio: ["ignore", "pipe", "inherit"],
    ...opcoes,
  }).toString();
}

// Prova as três operações de conta (AUTH-08, AUTH-09) contra um banco de verdade, rodando os
// próprios scripts de linha de comando como processo filho — não reimplementando a lógica
// deles. O par "o hash mudou" + "a senha antiga deixou de conferir" é o que distingue
// redefinir de reescrever o mesmo valor por engano.
async function conferirContas(cliente) {
  const { hash, verify } = await import("@node-rs/argon2");
  const email = "conta-de-teste-plano-05@exemplo.test";
  const senhaOriginal = "SenhaOriginalDeTesteDoPlano05";
  const hashOriginal = await hash(senhaOriginal);

  const envDoBancoDeTeste = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE };

  const inserida = await cliente.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Conta de Teste do Plano 05', $1, $2)
     returning id`,
    [email, hashOriginal],
  );
  const { id } = inserida.rows[0];

  try {
    console.log("  redefinir-senha...");
    const saidaRedefinir = rodarNpmCapturado(
      "npm",
      ["run", "redefinir-senha", "--", "--email", email],
      { env: envDoBancoDeTeste },
    );
    const linhaSenha = saidaRedefinir.split("\n").find((linha) => linha.startsWith("SENHA: "));
    afirmar(
      Boolean(linhaSenha),
      "redefinir-senha não imprimiu a linha SENHA: esperada.\nSaída completa:\n" +
        saidaRedefinir,
    );
    const senhaNova = linhaSenha.slice("SENHA: ".length).trim();

    const { rows: linhasAposRedefinir } = await cliente.query(
      "select senha_hash from usuarios where id = $1",
      [id],
    );
    const hashNovo = linhasAposRedefinir[0].senha_hash;

    afirmar(hashNovo !== hashOriginal, "O hash da senha não mudou depois de redefinir-senha.");
    afirmar(
      (await verify(hashNovo, senhaOriginal)) === false,
      "A senha antiga ainda confere com o hash novo depois de redefinir-senha — a senha " +
        "anterior deveria ter deixado de funcionar.",
    );
    afirmar(
      (await verify(hashOriginal, senhaNova)) === false,
      "A senha nova confere com o hash antigo — redefinir-senha não deveria produzir um hash " +
        "que a senha anterior já satisfazia.",
    );
    afirmar(
      (await verify(hashNovo, senhaNova)) === true,
      "A senha nova impressa por redefinir-senha não confere com o hash gravado no banco.",
    );

    console.log("  desativar-usuario...");
    rodarNpmCapturado("npm", ["run", "desativar-usuario", "--", "--email", email], {
      env: envDoBancoDeTeste,
    });
    const { rows: linhasAposDesativar } = await cliente.query(
      "select ativo from usuarios where id = $1",
      [id],
    );
    afirmar(
      linhasAposDesativar.length === 1,
      "A linha do usuário desapareceu depois de desativar-usuario — desativar nunca deve " +
        "apagar uma linha.",
    );
    afirmar(
      linhasAposDesativar[0].ativo === false,
      "ativo continua true depois de desativar-usuario.",
    );

    console.log("  desativar-usuario --reativar...");
    rodarNpmCapturado(
      "npm",
      ["run", "desativar-usuario", "--", "--email", email, "--reativar"],
      { env: envDoBancoDeTeste },
    );
    const { rows: linhasAposReativar } = await cliente.query(
      "select ativo from usuarios where id = $1",
      [id],
    );
    afirmar(
      linhasAposReativar[0].ativo === true,
      "ativo continua false depois de desativar-usuario --reativar.",
    );
  } finally {
    await cliente.query("delete from usuarios where id = $1", [id]);
  }
}

// ABE-15/D-01: prova, contra um banco COM DADO, que `db/remocao/remover-abertura-do-espaco.sql`
// apaga o módulo Abertura do Espaço inteiro (três tabelas, três tipos de enum) sem afetar nada
// mais do sistema. Chamada POR ÚLTIMO em conferirBanco() — de propósito: ela destrói tabelas, e
// qualquer verificação depois dela estaria olhando um banco mutilado, e a falha apareceria longe
// da causa real.
//
// Remover tabela vazia não prova nada: o que precisa ser provado é que o `drop` funciona com
// dado e com chave estrangeira em uso. Por isso semeamos um item, uma tarefa LIGADA a ele e a
// linha de configuração antes de aplicar a remoção.
async function conferirRemocaoDoModuloAbertura(cliente) {
  // 1. Guarda — a mesma disciplina do Passo 1 dos roteiros de operação: barato de conferir, caro
  // de errar. Esta verificação faz `drop table`/`drop type` de verdade; ela nunca pode rodar
  // contra um banco que não seja o de teste.
  const { rows: bancoAtual } = await cliente.query("select current_database() as banco");
  afirmar(
    bancoAtual[0].banco !== BANCO_DE_PRODUCAO,
    `conferirRemocaoDoModuloAbertura recusou-se a rodar: o banco conectado é ` +
      `"${bancoAtual[0].banco}", que é o nome do banco de PRODUÇÃO. Esta verificação faz ` +
      "'drop table'/'drop type' de verdade e só pode rodar contra o banco de teste efêmero.",
  );

  // 2. Antes — as três tabelas e os três tipos existem; guarda a contagem de usuarios e a
  // lista completa de tabelas do schema público, para comparar depois da remoção.
  for (const tabela of TABELAS_DA_REMOCAO_ABERTURA) {
    const existe = await cliente.query(
      `select 1 from information_schema.tables
       where table_schema = 'public' and table_name = $1`,
      [tabela],
    );
    afirmar(existe.rowCount === 1, `A tabela "${tabela}" deveria existir antes da remoção.`);
  }
  for (const tipo of TIPOS_DA_REMOCAO_ABERTURA) {
    const existe = await cliente.query("select 1 from pg_type where typname = $1", [tipo]);
    afirmar(existe.rowCount === 1, `O tipo "${tipo}" deveria existir em pg_type antes da remoção.`);
  }

  // D-03/D-26 (plano 04.3-01, Tarefa 3): as duas tabelas do Comparador de Compras e o tipo de
  // enum de situação existem ANTES da remoção — o "antes" precisa provar que elas estavam lá,
  // senão o "depois" não prova sobrevivência nenhuma, só ausência de sempre.
  for (const tabela of ["cotacao_categorias", "cotacoes"]) {
    const existe = await cliente.query(
      `select 1 from information_schema.tables
       where table_schema = 'public' and table_name = $1`,
      [tabela],
    );
    afirmar(existe.rowCount === 1, `A tabela "${tabela}" (Comparador de Compras) deveria existir antes da remoção da Abertura.`);
  }
  const tipoSituacaoAntes = await cliente.query(
    "select 1 from pg_type where typname = 'situacao_cotacao'",
  );
  afirmar(
    tipoSituacaoAntes.rowCount === 1,
    'O tipo "situacao_cotacao" (Comparador de Compras) deveria existir em pg_type antes da remoção da Abertura.',
  );

  const { rows: contagemUsuariosAntes } = await cliente.query(
    "select count(*)::int as total from usuarios",
  );
  const { rows: tabelasAntes } = await cliente.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  const listaDeTabelasAntes = tabelasAntes.map((linha) => linha.table_name);

  // 3. Semeie — nomes inventados e genéricos, nunca dado de pessoa real (o repositório é
  // público). A tarefa é LIGADA ao item (item_id), para o `drop table abertura_tarefas` provar
  // que funciona com chave estrangeira em uso, não só com linha solta.
  const { rows: configuracaoInserida } = await cliente.query(
    "insert into abertura_configuracao (inauguracao_em) values (current_date) returning id",
  );
  const { rows: itemInserido } = await cliente.query(
    `insert into abertura_itens (nome, categoria, valor_centavos, forma_pagamento, parcelas, primeira_parcela_em)
     values ('Bancada de teste', 'moveis', 100000, 'vista', 1, current_date)
     returning id`,
  );
  const idDoItem = itemInserido[0].id;
  await cliente.query(
    `insert into abertura_tarefas (descricao, grupo, prazo_em, item_id)
     values ('Conferir a instalação', 'obra', current_date, $1)`,
    [idDoItem],
  );
  afirmar(
    configuracaoInserida.length === 1 && Boolean(idDoItem),
    "A semeadura de item/tarefa/configuração de abertura não inseriu as linhas esperadas.",
  );

  // D-03/D-26 (Tarefa 3): semeia UMA categoria e DUAS cotações do Comparador de Compras — uma
  // com preço, uma com preço NULO (D-07, "sob consulta") — para provar, depois da remoção da
  // Abertura, que as duas tabelas, o tipo de enum e as três linhas continuam lá, LEGÍVEIS, com o
  // preço nulo ainda nulo e o preço com valor ainda com o mesmo valor. Nomes inventados e
  // genéricos, nunca fornecedor real (o repositório é público).
  const { rows: categoriaDeCotacaoInserida } = await cliente.query(
    "insert into cotacao_categorias (nome) values ('Categoria de teste') returning id",
  );
  const idDaCategoriaDeCotacao = categoriaDeCotacaoInserida[0].id;
  const { rows: cotacaoComPrecoInserida } = await cliente.query(
    `insert into cotacoes (categoria_id, empresa, preco_centavos)
     values ($1, 'Fornecedora de teste', 190000)
     returning id`,
    [idDaCategoriaDeCotacao],
  );
  const { rows: cotacaoSemPrecoInserida } = await cliente.query(
    `insert into cotacoes (categoria_id, empresa, preco_centavos)
     values ($1, 'Fornecedora sem preço de teste', null)
     returning id`,
    [idDaCategoriaDeCotacao],
  );
  afirmar(
    Boolean(idDaCategoriaDeCotacao) &&
      cotacaoComPrecoInserida.length === 1 &&
      cotacaoSemPrecoInserida.length === 1,
    "A semeadura de categoria/cotações do Comparador de Compras não inseriu as linhas esperadas.",
  );

  // 4. Aplique — lê o arquivo de db/remocao/, separa pelas marcas de instrução do Drizzle
  // (o MESMO separador de db/migrations/) e executa em sequência, dentro de uma transação.
  const caminhoDoArquivo = path.join(
    process.cwd(),
    "db",
    "remocao",
    "remover-abertura-do-espaco.sql",
  );
  const conteudoDoArquivo = readFileSync(caminhoDoArquivo, "utf8");
  const instrucoes = conteudoDoArquivo
    .split("--> statement-breakpoint")
    .map((bloco) =>
      // Remove as linhas de comentário `-- ...` DE DENTRO do bloco (não só quando o bloco
      // inteiro é comentário) — o cabeçalho deste arquivo e o primeiro `drop table` convivem
      // no mesmo bloco antes do primeiro statement-breakpoint, no mesmo formato de
      // db/migrations/0008_gatilhos-queimas.sql.
      bloco
        .split("\n")
        .filter((linha) => !linha.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((instrucao) => instrucao.length > 0);

  await cliente.query("begin");
  try {
    for (const instrucao of instrucoes) {
      await cliente.query(instrucao);
    }
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  }

  // 5. Depois — cada afirmação com mensagem própria dizendo o que ficou faltando.
  for (const tabela of TABELAS_DA_REMOCAO_ABERTURA) {
    const existeAinda = await cliente.query(
      `select 1 from information_schema.tables
       where table_schema = 'public' and table_name = $1`,
      [tabela],
    );
    afirmar(existeAinda.rowCount === 0, `A tabela "${tabela}" deveria ter sumido depois da remoção.`);
  }
  for (const tipo of TIPOS_DA_REMOCAO_ABERTURA) {
    const existeAinda = await cliente.query("select 1 from pg_type where typname = $1", [tipo]);
    afirmar(
      existeAinda.rowCount === 0,
      `O tipo "${tipo}" ainda existe em pg_type depois da remoção — 'drop table' não apaga ` +
        "tipo de enum, e este é exatamente o resíduo órfão que ABE-15 proíbe.",
    );
  }

  // D-03/D-26 (Tarefa 3): as duas tabelas do Comparador de Compras, o tipo de enum de situação e
  // as três linhas semeadas SOBREVIVEM à remoção da Abertura — cada afirmação com mensagem
  // própria dizendo exatamente o que faltou. A lista de tabelas "depois é antes menos as três da
  // Abertura", conferida logo abaixo, já cobre as duas tabelas novas automaticamente (elas não
  // estão em TABELAS_DA_REMOCAO_ABERTURA, então continuam na lista de "antes" e de "depois") —
  // isto aqui é a prova ADICIONAL de que elas não só existem, mas continuam com o dado legível.
  for (const tabela of ["cotacao_categorias", "cotacoes"]) {
    const existeAinda = await cliente.query(
      `select 1 from information_schema.tables
       where table_schema = 'public' and table_name = $1`,
      [tabela],
    );
    afirmar(
      existeAinda.rowCount === 1,
      `A tabela "${tabela}" (Comparador de Compras) deveria CONTINUAR existindo depois da ` +
        "remoção da Abertura — D-03: arquivar, não apagar.",
    );
  }
  const tipoSituacaoDepois = await cliente.query(
    "select 1 from pg_type where typname = 'situacao_cotacao'",
  );
  afirmar(
    tipoSituacaoDepois.rowCount === 1,
    'O tipo "situacao_cotacao" (Comparador de Compras) sumiu de pg_type depois da remoção da ' +
      "Abertura — ele deveria continuar existindo (D-03: arquivar, não apagar).",
  );

  const categoriaDeCotacaoDepois = await cliente.query(
    "select nome from cotacao_categorias where id = $1",
    [idDaCategoriaDeCotacao],
  );
  afirmar(
    categoriaDeCotacaoDepois.rowCount === 1 &&
      categoriaDeCotacaoDepois.rows[0].nome === "Categoria de teste",
    "A categoria de cotação semeada não sobreviveu, LEGÍVEL, à remoção da Abertura.",
  );

  const cotacoesDepois = await cliente.query(
    `select id, categoria_id, preco_centavos from cotacoes
     where id = any($1::uuid[])
     order by preco_centavos nulls last`,
    [[cotacaoComPrecoInserida[0].id, cotacaoSemPrecoInserida[0].id]],
  );
  afirmar(
    cotacoesDepois.rowCount === 2,
    "As duas cotações semeadas não sobreviveram à remoção da Abertura — deveriam continuar as duas, legíveis.",
  );
  const [cotacaoComPrecoDepois, cotacaoSemPrecoDepois] = cotacoesDepois.rows;
  afirmar(
    cotacaoComPrecoDepois.preco_centavos === 190000,
    `O preço da cotação com valor mudou depois da remoção da Abertura (esperado 190000, veio ${cotacaoComPrecoDepois.preco_centavos}) — a remoção não deveria tocar em dado do Comparador de Compras.`,
  );
  afirmar(
    cotacaoSemPrecoDepois.preco_centavos === null,
    "O preço nulo (sob consulta, D-07) da segunda cotação deixou de ser nulo depois da remoção da Abertura.",
  );
  afirmar(
    cotacaoComPrecoDepois.categoria_id === idDaCategoriaDeCotacao &&
      cotacaoSemPrecoDepois.categoria_id === idDaCategoriaDeCotacao,
    "A chave estrangeira de categoria_id das cotações não é mais a categoria semeada depois da " +
      "remoção da Abertura — ela deveria continuar válida e intocada (D-04: nenhuma dependência " +
      "cruzada com a Abertura).",
  );

  const { rows: tabelasDepois } = await cliente.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  const listaDeTabelasDepois = tabelasDepois.map((linha) => linha.table_name);
  const listaEsperadaDepois = listaDeTabelasAntes
    .filter((tabela) => !TABELAS_DA_REMOCAO_ABERTURA.includes(tabela))
    .sort();
  afirmar(
    JSON.stringify(listaDeTabelasDepois.sort()) === JSON.stringify(listaEsperadaDepois),
    "A lista de tabelas depois da remoção não é exatamente 'antes menos as três do módulo'.\n" +
      `Esperado: ${listaEsperadaDepois.join(", ")}\n` +
      `Encontrado: ${listaDeTabelasDepois.join(", ")}`,
  );

  const { rows: contagemUsuariosDepois } = await cliente.query(
    "select count(*)::int as total from usuarios",
  );
  afirmar(
    contagemUsuariosDepois[0].total === contagemUsuariosAntes[0].total,
    `A contagem de usuarios mudou depois da remoção (antes: ${contagemUsuariosAntes[0].total}, ` +
      `depois: ${contagemUsuariosDepois[0].total}) — a remoção não deveria tocar em usuarios.`,
  );

  const funcoesCompartilhadas = await cliente.query(
    `select proname from pg_proc where proname in ('hoje_brasilia', 'tocar_atualizado_em')`,
  );
  afirmar(
    funcoesCompartilhadas.rowCount === 2,
    "hoje_brasilia() e/ou tocar_atualizado_em() sumiram depois da remoção — elas são base " +
      "comum de todos os módulos e nunca deveriam ser tocadas por esta remoção.",
  );

  const triggerDeOutroModulo = await cliente.query(
    "select 1 from pg_trigger where tgname = 'tocar_atualizado_em_fornos'",
  );
  afirmar(
    triggerDeOutroModulo.rowCount === 1,
    "O gatilho tocar_atualizado_em_fornos (de outro módulo) sumiu depois da remoção — a " +
      "remoção da Abertura não deveria afetar tabela nenhuma de outro módulo.",
  );

  const privilegiosDoPapel = await cliente.query(
    `select has_table_privilege('amassa_app', 'usuarios', 'select') as pode_select`,
  );
  afirmar(
    privilegiosDoPapel.rows[0].pode_select === true,
    "O papel amassa_app perdeu o privilégio de select sobre usuarios depois da remoção — a " +
      "remoção não deveria mexer em papel nem em privilégio nenhum.",
  );
}

// A prova de remocao faz `drop table`/`drop type` DE VERDADE. Por isso ela roda num banco
// so dela, criado aqui e apagado no fim — nunca no banco que os outros passos usam.
//
// POR QUE ISTO EXISTE (achado de 2026-08-31, run #33445099364). Antes, ela recebia o mesmo
// cliente dos outros passos. Localmente isso era inofensivo: este script sobe um Postgres
// efemero so dele. Em CI, NAO — la o script usa o banco que o runner entrega, que e o MESMO
// banco onde o job e2e roda logo depois. A prova apagava as tres tabelas da Abertura e ia
// embora; o e2e subia contra um banco sem elas, `/abertura` estourava com
// `relation "abertura_tarefas" does not exist`, a tela de erro aparecia no lugar da pagina, e
// quatro testes @vazio-global reprovavam derrubando 412 atras deles. O pipeline ficou vermelho
// sem nenhum defeito no modulo.
//
// A guarda por NOME de banco que ja existia continua valendo, mas ela protege producao — nao
// protegia o vizinho. Banco proprio protege os dois.
async function provarRemocaoEmBancoProprio() {
  const url = new URL(process.env.DATABASE_URL_TESTE);
  const bancoOriginal = url.pathname.slice(1);
  const bancoDaProva = `${bancoOriginal}_remocao`;

  const urlAdmin = new URL(url);
  urlAdmin.pathname = "/postgres";
  const urlDaProva = new URL(url);
  urlDaProva.pathname = `/${bancoDaProva}`;

  const admin = new Client({ connectionString: urlAdmin.toString() });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${bancoDaProva}"`);
    await admin.query(`create database "${bancoDaProva}"`);
  } finally {
    await admin.end();
  }

  try {
    console.log(`Provando a remocao em banco proprio ("${bancoDaProva}")...`);
    rodarNpm("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: urlDaProva.toString() },
    });
    const cliente = new Client({ connectionString: urlDaProva.toString() });
    await cliente.connect();
    try {
      await conferirRemocaoDoModuloAbertura(cliente);
    } finally {
      await cliente.end();
    }
  } finally {
    const faxina = new Client({ connectionString: urlAdmin.toString() });
    await faxina.connect();
    try {
      await faxina.query(`drop database if exists "${bancoDaProva}"`);
    } finally {
      await faxina.end();
    }
  }
}


// Fase 04.4 — Financeiro (04.4-01-PLAN.md, Tarefa 3): prova, de fora, que o banco recusa o que a
// aplicação nunca deveria mandar. Nove grupos, cada afirmação com mensagem própria dizendo o que
// faltou. A prova de remoção da Abertura (banco próprio, `conferirRemocaoDoModuloAbertura`) já
// cobre as oito tabelas novas pela afirmação "depois = antes menos as três da Abertura" — elas
// não estão em TABELAS_DA_REMOCAO_ABERTURA, então continuam na lista de "antes" e "depois", o
// que já prova que a remoção da Abertura não as apaga. Nomes inventados e genéricos em toda linha
// criada aqui — o repositório é público.
async function conferirFinanceiro(cliente) {
  console.log("  conferirFinanceiro...");

  // `true` quando a promessa rejeita, `false` quando resolve — o formato comum de todo teste
  // "isso deveria ser recusado" deste grupo.
  async function falha(executar) {
    try {
      await executar();
      return false;
    } catch {
      return true;
    }
  }

  // Uma transação onde os `insert`s passam (as restrições imediatas não disparam), mas o
  // `commit` deveria ser recusado pela restrição ADIADA (`conferir_soma_do_documento()`,
  // migração 0015). Falhar ANTES do commit é um erro de teste, não o caso que está sendo provado
  // — por isso os dois `catch` são distintos.
  async function commitDeveFalhar(executarInserts, mensagemEsperadaRegex, contexto) {
    await cliente.query("begin");
    try {
      await executarInserts();
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      throw new Error(
        `${contexto}: falhou ANTES do commit (deveria falhar só no commit) — ${erro.message}`,
      );
    }
    try {
      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      afirmar(
        mensagemEsperadaRegex.test(erro.message),
        `${contexto}: mensagem inesperada da restrição adiada: "${erro.message}".`,
      );
      return;
    }
    throw new Error(`${contexto}: o commit deveria ter sido recusado, mas passou.`);
  }

  // O par de `commitDeveFalhar`: os `insert`s e o `commit` devem passar os dois. Devolve o id do
  // documento para os grupos seguintes reaproveitarem (categoria travada, privilégios).
  async function commitDevePassar(executarInserts, contexto) {
    await cliente.query("begin");
    try {
      const resultado = await executarInserts();
      await cliente.query("commit");
      return resultado;
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      throw new Error(`${contexto}: deveria ter passado, mas falhou — ${erro.message}`);
    }
  }

  // Um documento de teste com uma linha e uma parcela (ou sem uma das duas, ou sem nenhuma) —
  // usado pelos grupos 2 e 8. Nomes inventados e genéricos.
  async function inserirDocumentoDeTeste({
    tipo = "venda",
    usuarioId,
    categoriaId,
    valorLinha,
    valorParcela,
    semLinha = false,
    semParcela = false,
  }) {
    const { rows } = await cliente.query(
      `insert into documentos (tipo, data, criado_por) values ($1, current_date, $2) returning id`,
      [tipo, usuarioId],
    );
    const documentoId = rows[0].id;
    if (!semLinha) {
      await cliente.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
         values ($1, 1, 'Linha de teste (prova de migração)', $2, $3)`,
        [documentoId, categoriaId, valorLinha],
      );
    }
    if (!semParcela) {
      await cliente.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
         values ($1, 1, current_date, $2, 'pix', current_date, $3)`,
        [documentoId, valorParcela, usuarioId],
      );
    }
    return documentoId;
  }

  // Fixture compartilhada: um usuário e as categorias já semeadas pela migração 0016 — apagados
  // ao final, num `finally`, junto de todo dado de teste criado por este grupo de funções.
  const { rows: usuarioInserido } = await cliente.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste do Financeiro', 'usuaria-financeiro@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;

  const documentosDeTeste = [];
  const contasFixasDeTeste = [];

  try {
    // 1. Semente (D-02/D-14): exatamente 25 categorias — as 23 do protótipo com grupo/área
    // certos, mais "Juros, multas e descontos" com chave_do_sistema = 'diferenca' (as 24 da 0016),
    // mais "Produção da casa" (custo/pecas), semeada no fim da 0023 (D-29, dono em 29/09/2026).
    const GRUPO_E_AREA_ESPERADOS = new Map([
      ["Bebidas e comidas", ["receita", "cafeteria"]],
      ["Uso do espaço", ["receita", "espaco"]],
      ["Aulas e oficinas", ["receita", "espaco"]],
      ["Peças prontas", ["receita", "pecas"]],
      ["Peças para pintar", ["receita", "pecas"]],
      ["Encomendas", ["receita", "pecas"]],
      ["Queima externa", ["receita", "pecas"]],
      ["Materiais e papelaria", ["receita", "loja"]],
      ["Insumos da cafeteria", ["custo", "cafeteria"]],
      ["Material de aula", ["custo", "espaco"]],
      ["Argila, esmalte e insumos", ["custo", "pecas"]],
      ["Mercadoria para revenda", ["custo", "loja"]],
      ["Aluguel", ["geral", "geral"]],
      ["Água e luz", ["geral", "geral"]],
      ["Internet e sistemas", ["geral", "geral"]],
      ["Contabilidade", ["geral", "geral"]],
      ["Ferramentas e utensílios", ["geral", "geral"]],
      ["Divulgação", ["geral", "geral"]],
      ["Pró-labore", ["geral", "geral"]],
      ["Equipamento e obra", ["fora", "geral"]],
      ["Financiamento (parcela)", ["fora", "geral"]],
      ["Aporte dos sócios", ["fora", "geral"]],
      ["Retirada de lucro", ["fora", "geral"]],
      ["Juros, multas e descontos", ["geral", "geral"]],
      ["Produção da casa", ["custo", "pecas"]],
    ]);

    const { rows: categoriasSemeadas } = await cliente.query(
      "select nome, grupo, area, chave_do_sistema from categorias",
    );
    afirmar(
      categoriasSemeadas.length === 25,
      `Deveriam existir exatamente 25 categorias semeadas (24 pela migração 0016, 1 pela 0023), vieram ${categoriasSemeadas.length}.`,
    );
    for (const [nome, [grupoEsperado, areaEsperada]] of GRUPO_E_AREA_ESPERADOS) {
      const linha = categoriasSemeadas.find((atual) => atual.nome === nome);
      afirmar(Boolean(linha), `A categoria semeada "${nome}" não foi encontrada.`);
      afirmar(
        linha.grupo === grupoEsperado && linha.area === areaEsperada,
        `A categoria "${nome}" deveria ter grupo "${grupoEsperado}" e área "${areaEsperada}", veio grupo "${linha.grupo}" e área "${linha.area}".`,
      );
    }
    const comChaveDoSistema = categoriasSemeadas.filter((linha) => linha.chave_do_sistema !== null);
    afirmar(
      comChaveDoSistema.length === 1,
      `Deveria existir exatamente 1 categoria com chave_do_sistema, vieram ${comChaveDoSistema.length}.`,
    );
    afirmar(
      comChaveDoSistema[0].nome === "Juros, multas e descontos" &&
        comChaveDoSistema[0].chave_do_sistema === "diferenca",
      `A categoria de chave_do_sistema deveria ser "Juros, multas e descontos"/"diferenca", veio "${comChaveDoSistema[0]?.nome}"/"${comChaveDoSistema[0]?.chave_do_sistema}".`,
    );

    // Rodar o SQL da semente de novo não duplica nenhuma categoria (o `on conflict do nothing`
    // da migração 0016 sobre o índice de nome normalizado).
    const caminhoDaSemente = path.join(process.cwd(), "db", "migrations", "0016_categorias-iniciais.sql");
    const instrucoesDaSemente = readFileSync(caminhoDaSemente, "utf8")
      .split("--> statement-breakpoint")
      .map((bloco) =>
        bloco
          .split("\n")
          .filter((linha) => !linha.trim().startsWith("--"))
          .join("\n")
          .trim(),
      )
      .filter((instrucao) => instrucao.length > 0);
    for (const instrucao of instrucoesDaSemente) {
      await cliente.query(instrucao);
    }
    const { rows: categoriasAposReaplicar } = await cliente.query("select count(*)::int as total from categorias");
    afirmar(
      categoriasAposReaplicar[0].total === 25,
      `Reaplicar a semente de categorias (0016) não deveria duplicar nada — esperado 25, veio ${categoriasAposReaplicar[0].total}.`,
    );

    // A semente de "Produção da casa" (fim da 0023, D-29): existe UMA vez depois de migrar, e
    // continua uma só quando a instrução roda de novo (o `where not exists` sobre o nome
    // normalizado). É a mesma conferência que o Roteiro 15, Passo 5, pede ao dono no servidor.
    const contarProducaoDaCasa = async () =>
      (
        await cliente.query(
          "select count(*)::int as total from categorias where nome = 'Produção da casa'",
        )
      ).rows[0].total;
    afirmar(
      (await contarProducaoDaCasa()) === 1,
      `A categoria "Produção da casa" deveria existir exatamente uma vez depois da 0023, veio ${await contarProducaoDaCasa()}.`,
    );
    const instrucaoDaSementeDaCasa = readFileSync(
      path.join(process.cwd(), "db", "migrations", "0023_estoque.sql"),
      "utf8",
    )
      .replace(/\r\n/g, "\n")
      .split("--> statement-breakpoint")
      .map((bloco) =>
        bloco
          .split("\n")
          .filter((linha) => !linha.trim().startsWith("--"))
          .join("\n")
          .trim(),
      )
      .find((instrucao) => instrucao.startsWith("insert into categorias"));
    afirmar(
      Boolean(instrucaoDaSementeDaCasa),
      'A migração 0023 deveria terminar com a semente "insert into categorias" de "Produção da casa".',
    );
    await cliente.query(instrucaoDaSementeDaCasa);
    afirmar(
      (await contarProducaoDaCasa()) === 1,
      `Reaplicar a semente de "Produção da casa" (0023) não deveria duplicá-la — veio ${await contarProducaoDaCasa()}.`,
    );

    const idCategoriaReceita = categoriasSemeadas.find((linha) => linha.nome === "Uso do espaço")
      ? (await cliente.query("select id from categorias where nome = 'Uso do espaço'")).rows[0].id
      : null;
    afirmar(Boolean(idCategoriaReceita), 'A categoria "Uso do espaço" deveria existir para os grupos seguintes.');
    const idCategoriaDiferenca = (
      await cliente.query("select id from categorias where chave_do_sistema = 'diferenca'")
    ).rows[0].id;

    // 2. Soma (FNC-03 no banco): soma divergente falha só no commit; soma exata passa; documento
    // sem linha nem parcela falha só no commit.
    await commitDeveFalhar(
      () =>
        inserirDocumentoDeTeste({
          usuarioId,
          categoriaId: idCategoriaReceita,
          valorLinha: 10000,
          valorParcela: 9000,
        }),
      /não fecha com a soma das linhas/,
      "Soma divergente (linha 10000, parcela 9000)",
    );

    const idDocumentoAlinhado = await commitDevePassar(
      () =>
        inserirDocumentoDeTeste({
          usuarioId,
          categoriaId: idCategoriaReceita,
          valorLinha: 10000,
          valorParcela: 10000,
        }),
      "Soma exata (linha 10000, parcela 10000)",
    );
    documentosDeTeste.push(idDocumentoAlinhado);

    await commitDeveFalhar(
      () => inserirDocumentoDeTeste({ usuarioId, semLinha: true, semParcela: true }),
      /não tem nenhuma linha lançada/,
      "Documento sem linha nem parcela",
    );

    // 3. Categoria: grupo/área travados depois de lançamento; renomear continua livre; a
    // categoria de sistema nunca muda; grupo/área incoerentes são recusados; nome duplicado
    // (ignorando caixa) é recusado pelo índice único.
    afirmar(
      await falha(() => cliente.query("update categorias set grupo = 'custo' where id = $1", [idCategoriaReceita])),
      'Mudar o grupo de "Uso do espaço" (que já tem lançamento no grupo 2) deveria ser recusado.',
    );
    afirmar(
      !(await falha(() =>
        cliente.query("update categorias set nome = $1 where id = $2", [
          "Uso do espaço (renomeada na prova)",
          idCategoriaReceita,
        ]),
      )),
      "Renomear uma categoria com lançamento (sem tocar grupo/área) deveria continuar livre.",
    );
    await cliente.query("update categorias set nome = 'Uso do espaço' where id = $1", [idCategoriaReceita]);

    afirmar(
      await falha(() =>
        cliente.query("update categorias set grupo = 'fora' where id = $1", [idCategoriaDiferenca]),
      ),
      'Mudar o grupo da categoria de sistema ("Juros, multas e descontos") deveria ser recusado mesmo sem lançamento.',
    );

    afirmar(
      await falha(() =>
        cliente.query(
          "insert into categorias (nome, grupo, area) values ('Categoria de teste custo-geral inválida', 'custo', 'geral')",
        ),
      ),
      'Uma categoria de grupo "custo" com área "geral" deveria ser recusada (coerência grupo/área).',
    );
    afirmar(
      await falha(() =>
        cliente.query(
          "insert into categorias (nome, grupo, area) values ('Categoria de teste geral-loja inválida', 'geral', 'loja')",
        ),
      ),
      'Uma categoria de grupo "geral" com área "loja" deveria ser recusada (coerência grupo/área).',
    );
    afirmar(
      await falha(() =>
        cliente.query("insert into categorias (nome, grupo, area) values ('uso do espaço', 'receita', 'espaco')"),
      ),
      'Um nome de categoria repetido só com a caixa diferente ("uso do espaço" vs. "Uso do espaço") deveria ser recusado pelo índice único.',
    );

    // 4. Parcela: valor zero, taxa sem pago_em, valor previsto sem forma prevista.
    afirmar(
      await falha(() =>
        cliente.query(
          `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma)
           values ($1, 90, current_date, 0, 'pix')`,
          [idDocumentoAlinhado],
        ),
      ),
      "Uma parcela de valor zero deveria ser recusada.",
    );
    afirmar(
      await falha(() =>
        cliente.query(
          `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, taxa_pontos_base)
           values ($1, 91, current_date, 1000, 'cartao', 350)`,
          [idDocumentoAlinhado],
        ),
      ),
      "Uma parcela com taxa_pontos_base sem pago_em deveria ser recusada.",
    );
    afirmar(
      await falha(() =>
        cliente.query(
          `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, valor_previsto_centavos)
           values ($1, 92, current_date, 1000, 'pix', 500)`,
          [idDocumentoAlinhado],
        ),
      ),
      "Uma parcela com valor_previsto_centavos sem forma_prevista deveria ser recusada.",
    );

    // 5. Linha: valor negativo sem parcela_diferenca_id.
    afirmar(
      await falha(() =>
        cliente.query(
          `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
           values ($1, 90, 'Linha negativa de teste', $2, -100)`,
          [idDocumentoAlinhado, idCategoriaReceita],
        ),
      ),
      "Uma linha de valor negativo sem parcela_diferenca_id deveria ser recusada — só a linha de diferença pode ser negativa.",
    );

    // 6. Conta fixa: o par (conta_fixa_id, mes_referencia) é único — o segundo documento falha.
    const { rows: contaFixaInserida } = await cliente.query(
      `insert into contas_fixas (nome, categoria_id, valor_esperado_centavos, dia_vencimento)
       values ('Conta fixa de teste', $1, 15000, 5) returning id`,
      [(await cliente.query("select id from categorias where nome = 'Aluguel'")).rows[0].id],
    );
    const idContaFixa = contaFixaInserida[0].id;
    contasFixasDeTeste.push(idContaFixa);

    const idPrimeiroDocumentoDaContaFixa = await commitDevePassar(async () => {
      const { rows } = await cliente.query(
        `insert into documentos (tipo, data, criado_por, conta_fixa_id, mes_referencia)
         values ('despesa', current_date, $1, $2, '2026-01-01') returning id`,
        [usuarioId, idContaFixa],
      );
      const documentoId = rows[0].id;
      await cliente.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
         values ($1, 1, 'Aluguel de teste', $2, 15000)`,
        [documentoId, (await cliente.query("select id from categorias where nome = 'Aluguel'")).rows[0].id],
      );
      await cliente.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma)
         values ($1, 1, current_date, 15000, 'pix')`,
        [documentoId],
      );
      return documentoId;
    }, "Primeiro documento da conta fixa de teste (2026-01-01)");
    documentosDeTeste.push(idPrimeiroDocumentoDaContaFixa);

    afirmar(
      await falha(() =>
        cliente.query(
          `insert into documentos (tipo, data, criado_por, conta_fixa_id, mes_referencia)
           values ('despesa', current_date, $1, $2, '2026-01-01')`,
          [usuarioId, idContaFixa],
        ),
      ),
      "Um segundo documento com o MESMO par (conta_fixa_id, mes_referencia) deveria ser recusado.",
    );

    // 7. Configuração: uma segunda linha em configuracao_financeira é recusada.
    await cliente.query("insert into configuracao_financeira (linha_unica) values (true)");
    afirmar(
      await falha(() => cliente.query("insert into configuracao_financeira (linha_unica) values (true)")),
      "Uma segunda linha em configuracao_financeira deveria ser recusada (linha única).",
    );
    await cliente.query("delete from configuracao_financeira where linha_unica = true");

    // 8. Privilégios: sem delete nas seis tabelas de lançamento; com delete em documento_linhas/
    // ficha_tecnica; select/insert/update nas oito; amassa_app consegue inserir documento (com
    // linha e parcela, número gerado pelo banco) sem privilégio extra, e a transação é revertida.
    const TABELAS_SEM_DELETE = [
      "documentos",
      "parcelas",
      "categorias",
      "itens_catalogo",
      "contas_fixas",
      "configuracao_financeira",
    ];
    const TABELAS_COM_DELETE = ["documento_linhas", "ficha_tecnica"];
    for (const tabela of TABELAS_SEM_DELETE) {
      const { rows } = await cliente.query(
        "select has_table_privilege('amassa_app', $1, 'delete') as pode_deletar",
        [tabela],
      );
      afirmar(
        rows[0].pode_deletar === false,
        `O papel amassa_app não deveria ter privilégio de delete sobre "${tabela}" (FNC-10).`,
      );
    }
    for (const tabela of TABELAS_COM_DELETE) {
      const { rows } = await cliente.query(
        "select has_table_privilege('amassa_app', $1, 'delete') as pode_deletar",
        [tabela],
      );
      afirmar(
        rows[0].pode_deletar === true,
        `O papel amassa_app deveria manter o privilégio de delete sobre "${tabela}" (desfazer diferença / tirar insumo da ficha).`,
      );
    }
    for (const tabela of [...TABELAS_SEM_DELETE, ...TABELAS_COM_DELETE]) {
      const { rows } = await cliente.query(
        `select
           has_table_privilege('amassa_app', $1, 'select') as pode_select,
           has_table_privilege('amassa_app', $1, 'insert') as pode_insert,
           has_table_privilege('amassa_app', $1, 'update') as pode_update`,
        [tabela],
      );
      afirmar(
        rows[0].pode_select && rows[0].pode_insert && rows[0].pode_update,
        `O papel amassa_app deveria ter select/insert/update sobre "${tabela}".`,
      );
    }

    await cliente.query("begin");
    try {
      await cliente.query("set local role amassa_app");
      const idDocumentoComoAmassaApp = await inserirDocumentoDeTeste({
        usuarioId,
        categoriaId: idCategoriaReceita,
        valorLinha: 5000,
        valorParcela: 5000,
      });
      afirmar(
        Boolean(idDocumentoComoAmassaApp),
        "O papel amassa_app deveria conseguir inserir um documento com número gerado pelo banco, sem privilégio extra.",
      );
    } finally {
      // Revertida sempre — nunca commitada como amassa_app.
      await cliente.query("rollback");
    }

    // 9. Independência da Abertura: nenhuma FK de tabela do financeiro para abertura_*/cotacao*.
    const { rows: fksIndevidas } = await cliente.query(`
      select conname, conrelid::regclass::text as tabela_origem, confrelid::regclass::text as tabela_destino
      from pg_constraint
      where contype = 'f'
        and conrelid::regclass::text in (
          'categorias','itens_catalogo','ficha_tecnica','documentos','documento_linhas',
          'parcelas','contas_fixas','configuracao_financeira'
        )
        and confrelid::regclass::text in (
          'abertura_itens','abertura_tarefas','abertura_configuracao','cotacao_categorias','cotacoes'
        )
    `);
    afirmar(
      fksIndevidas.length === 0,
      "Chave(s) estrangeira(s) indevida(s) do financeiro para a Abertura/Comparador: " +
        JSON.stringify(fksIndevidas),
    );
  } finally {
    // Faxina: apaga só o que este grupo de funções criou — nunca a semente de categorias, que é
    // dado permanente do módulo.
    //
    // As duas restrições adiadas de soma do documento (migração 0015,
    // conferir_soma_do_documento) proíbem QUALQUER delete em documento_linhas/parcelas que deixe
    // a contagem em zero para aquele documento — existem para impedir a aplicação de zerar linha
    // OU parcela de um documento em produção (FNC-03), mas um documento de teste inteiro sendo
    // DESFEITO bate nelas do mesmo jeito: apagar a parcela zera "quantidade de parcelas" e
    // dispara "não tem nenhuma parcela lançada"; apagar a linha em seguida dispara o gêmeo do
    // lado da linha; e o delete de `documentos` que sobra falha por FK (a linha/parcela nunca
    // saiu). As três deleções abaixo sempre falhavam, sempre silenciadas pelo `.catch(() => {})`
    // — pensado só para tolerar "já apagado", nunca para engolir um gatilho de verdade — e
    // "Conta fixa de teste"/o documento "Aluguel de teste" sobreviviam à faxina inteira,
    // committados de verdade (`commitDevePassar`).
    //
    // Isso nunca apareceu localmente: `scripts/testar-e2e.mjs` sobe um Postgres efêmero PRÓPRIO
    // para o Playwright, destruído ao sair — o vazamento deste script nunca chegava ao banco que
    // o e2e local usa. Em CI, `.github/workflows/entrega.yml` roda `test:migracoes` e o
    // Playwright contra o MESMO contêiner de serviço do Postgres, na mesma execução — o
    // "banco vazio" que `cadastros-contas-fixas.spec.ts`/`financeiro-caixa.spec.ts` (@vazio-
    // global) exigem deixava de ser verdade, sempre, de forma determinística (nunca uma corrida).
    //
    // `DATABASE_URL_TESTE` conecta como dono das tabelas (mesmo papel de amassa_owner em
    // produção — é quem rodou `db:migrate`), então desligar as duas restrições, dentro de uma
    // transação, e religar antes do commit é seguro: nenhum outro cliente enxerga o estado
    // intermediário, e os gatilhos SEMPRE voltam a valer antes deste `commit`/`rollback`.
    try {
      await cliente.query("begin");
      await cliente.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
      await cliente.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
      for (const documentoId of documentosDeTeste) {
        await cliente.query("delete from parcelas where documento_id = $1", [documentoId]);
        await cliente.query("delete from documento_linhas where documento_id = $1", [documentoId]);
        await cliente.query("delete from documentos where id = $1", [documentoId]);
      }
      for (const contaFixaId of contasFixasDeTeste) {
        await cliente.query("delete from contas_fixas where id = $1", [contaFixaId]);
      }
      await cliente.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
      await cliente.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      // Nunca relançado daqui: um `throw` dentro de `finally` substitui silenciosamente uma
      // falha de asserção real que o `try` acima já tenha lançado. Visível no log em vez de
      // silenciado — a falha anterior deste `.catch(() => {})` (sempre falhando, nunca avisando)
      // é exatamente o defeito que este comentário existe para não repetir.
      console.error(`conferirFinanceiro: a faxina final não apagou o dado de teste — ${erro.message}`);
    }
    await cliente
      .query("delete from categorias where nome like 'Categoria de teste%'")
      .catch(() => {});
    await cliente.query("delete from usuarios where id = $1", [usuarioId]).catch(() => {});
  }
}

// Fase 04.5 — Financeiro, parte 2: Precificação e Orçamento (migrações 0017/0018). As duas
// regras que não podem depender da tela — valor de parâmetro não se reescreve (D-15), e nome de
// foto não carrega caminho (T-04.5-04) — mais as duas colunas novas de execucoes_backup (D-28),
// cada uma com veredito próprio na saída.
async function conferirPrecificacaoEOrcamentos(cliente) {
  console.log("  conferirPrecificacaoEOrcamentos...");

  async function falha(executar) {
    try {
      await executar();
      return false;
    } catch {
      return true;
    }
  }

  // (a) execucoes_backup ganhou fotos_bytes/fotos_destino_externo_ok (D-28), as duas anuláveis
  // — uma execução gravada sem mencioná-las (como toda linha escrita antes desta fase) continua
  // legível, com as duas colunas saindo nulas ("nenhuma tentativa registrada").
  const colunasDeFotos = await cliente.query(
    `select column_name, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'execucoes_backup'
       and column_name in ('fotos_bytes', 'fotos_destino_externo_ok')`,
  );
  const nulabilidadePorColuna = new Map(
    colunasDeFotos.rows.map((linha) => [linha.column_name, linha.is_nullable]),
  );
  afirmar(
    nulabilidadePorColuna.get("fotos_bytes") === "YES",
    "execucoes_backup.fotos_bytes deveria existir e aceitar nulo (D-28).",
  );
  afirmar(
    nulabilidadePorColuna.get("fotos_destino_externo_ok") === "YES",
    "execucoes_backup.fotos_destino_externo_ok deveria existir e aceitar nulo (D-28).",
  );
  const { rows: execucaoSemFotos } = await cliente.query(
    "insert into execucoes_backup (sucesso) values (true) returning id, fotos_bytes, fotos_destino_externo_ok",
  );
  const {
    id: idExecucaoDeTeste,
    fotos_bytes: fotosBytes,
    fotos_destino_externo_ok: fotosDestinoExternoOk,
  } = execucaoSemFotos[0];
  try {
    afirmar(
      fotosBytes === null && fotosDestinoExternoOk === null,
      "Uma execução de backup escrita sem mencionar as colunas de fotos deveria trazê-las nulas " +
        `— veio fotos_bytes=${fotosBytes}, fotos_destino_externo_ok=${fotosDestinoExternoOk}.`,
    );
  } finally {
    await cliente.query("delete from execucoes_backup where id = $1", [idExecucaoDeTeste]);
  }

  // Fixture compartilhada pelos grupos (b) e (c) abaixo.
  const { rows: usuarioInserido } = await cliente.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste da Precificação', 'usuaria-precificacao@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;
  let idParametroDeTeste = null;
  let idOrcamentoDeTeste = null;

  try {
    // (b) D-15 no banco: um update que altera valor_inteiro OU vigente_desde é recusado pelo
    // gatilho recusar_mudanca_de_valor_do_parametro; um update que muda só `medido` passa.
    // `vigente_desde` é ONTEM, de propósito — a semente de 0019 grava "material_argila" com
    // `vigente_desde = current_date` no mesmo dia em que este teste roda (`db:migrate` acabou de
    // aplicar 0019 acima), e a migração 0021 (WINDOWS #44) já corrigiu essa data para
    // `hoje_brasilia()` antes de este teste rodar — usar `hoje_brasilia() - 1`, não
    // `current_date - 1`, é o que garante "ontem" de verdade nos dois casos (dentro e fora da
    // janela ruim das 21h-meia-noite BRT, quando current_date e hoje_brasilia() divergem); a
    // mesma (chave, vigente_desde) colidiria com o `unique` do banco se os dois coincidissem.
    const { rows: parametroInserido } = await cliente.query(
      `insert into parametros_precificacao (chave, valor_inteiro, medido, vigente_desde)
       values ('material_argila', 1000, false, hoje_brasilia() - 1)
       returning id`,
    );
    idParametroDeTeste = parametroInserido[0].id;

    afirmar(
      await falha(() =>
        cliente.query("update parametros_precificacao set valor_inteiro = 2000 where id = $1", [
          idParametroDeTeste,
        ]),
      ),
      "Um update que muda valor_inteiro de um parâmetro deveria ser recusado pelo gatilho (D-15).",
    );
    afirmar(
      await falha(() =>
        cliente.query(
          "update parametros_precificacao set vigente_desde = hoje_brasilia() - 2 where id = $1",
          [idParametroDeTeste],
        ),
      ),
      "Um update que muda vigente_desde de um parâmetro deveria ser recusado pelo mesmo gatilho (D-15).",
    );
    afirmar(
      !(await falha(() =>
        cliente.query("update parametros_precificacao set medido = true where id = $1", [
          idParametroDeTeste,
        ]),
      )),
      "Um update que muda só `medido` deveria continuar livre.",
    );
    const { rows: parametroAposMedido } = await cliente.query(
      "select medido, valor_inteiro from parametros_precificacao where id = $1",
      [idParametroDeTeste],
    );
    afirmar(
      parametroAposMedido[0].medido === true && parametroAposMedido[0].valor_inteiro === 1000,
      "Depois de marcar `medido`, valor_inteiro deveria continuar 1000 — o gatilho não pode " +
        "afetar a própria coluna que o update pediu para mudar.",
    );

    // (b.1) Correção do gatilho (migração 0020, achado real do 04.5-02-PLAN.md, Tarefa 3; e a
    // própria função corrigida DE NOVO pela migração 0021, achado nº 2 de WINDOWS #44 — ver o
    // comentário daquele arquivo): a linha de HOJE (a semente de 0019 grava as 18 chaves com
    // `vigente_desde = current_date`, e 0021 já corrigiu essa data para `hoje_brasilia()` antes
    // de este teste rodar) PODE ter o valor corrigido no MESMO DIA — é exatamente o caminho que
    // `lib/precificacao/acoes.ts::definirParametro` usa (`insert ... on conflict (chave,
    // vigente_desde) do update`) sempre que a chave já foi editada hoje. Só uma linha de um DIA
    // ANTERIOR (como a de `idParametroDeTeste`, acima) continua congelada. `hoje_brasilia()`, não
    // `current_date`, é o que identifica "a linha de hoje" nos dois lados (dado e gatilho) — a
    // mesma correção de fuso que 0021 aplicou.
    const { rows: linhaDeHoje } = await cliente.query(
      "select id, valor_inteiro from parametros_precificacao where chave = 'preco_lucro' and vigente_desde = hoje_brasilia()",
    );
    afirmar(
      linhaDeHoje.length === 1,
      "A semente de 0019 deveria ter gravado 'preco_lucro' com vigente_desde = hoje.",
    );
    const idLinhaDeHoje = linhaDeHoje[0].id;
    const valorOriginalDeHoje = linhaDeHoje[0].valor_inteiro;
    afirmar(
      !(await falha(() =>
        cliente.query("update parametros_precificacao set valor_inteiro = 9999 where id = $1", [
          idLinhaDeHoje,
        ]),
      )),
      "Um update de valor_inteiro na linha de HOJE deveria ser aceito (correção no mesmo dia, D-15) — migração 0020.",
    );
    await cliente.query("update parametros_precificacao set valor_inteiro = $2 where id = $1", [
      idLinhaDeHoje,
      valorOriginalDeHoje,
    ]);
    afirmar(
      await falha(() =>
        cliente.query(
          "update parametros_precificacao set vigente_desde = hoje_brasilia() - 1 where id = $1",
          [idLinhaDeHoje],
        ),
      ),
      "Mesmo na linha de hoje, mudar vigente_desde continua recusado (D-15) — migração 0020.",
    );

    // (c) Travessia de caminho: orcamento_fotos.arquivo com '../' é recusado pelo check de
    // formato — a coluna guarda só o NOME do arquivo gerado pelo servidor, nunca um caminho.
    const { rows: orcamentoInserido } = await cliente.query(
      `insert into orcamentos (ano, sequencial, data, entrega_prevista, criado_por)
       values (2020, 900001, current_date, current_date + 45, $1)
       returning id`,
      [usuarioId],
    );
    idOrcamentoDeTeste = orcamentoInserido[0].id;

    afirmar(
      await falha(() =>
        cliente.query(
          `insert into orcamento_fotos (orcamento_id, ordem, arquivo, bytes, anexado_por)
           values ($1, 0, '../../etc/passwd.jpg', 1000, $2)`,
          [idOrcamentoDeTeste, usuarioId],
        ),
      ),
      "Um arquivo de orcamento_fotos com travessia de caminho ('../') deveria ser recusado pelo check de formato.",
    );
    afirmar(
      !(await falha(() =>
        cliente.query(
          `insert into orcamento_fotos (orcamento_id, ordem, arquivo, bytes, anexado_por)
           values ($1, 0, 'b3e1c9d2-4b7a-4e8a-9c1a-1a2b3c4d5e6f.jpg', 1000, $2)`,
          [idOrcamentoDeTeste, usuarioId],
        ),
      )),
      "Um nome de arquivo no formato certo (uuid.jpg, gerado pelo servidor) deveria ser aceito.",
    );
  } finally {
    await cliente
      .query("delete from orcamento_fotos where orcamento_id = $1", [idOrcamentoDeTeste])
      .catch(() => {});
    await cliente.query("delete from orcamentos where id = $1", [idOrcamentoDeTeste]).catch(() => {});
    await cliente
      .query("delete from parametros_precificacao where id = $1", [idParametroDeTeste])
      .catch(() => {});
    await cliente.query("delete from usuarios where id = $1", [usuarioId]).catch(() => {});
  }
}

// Fase 04.5 — Financeiro, parte 2 (04.5-01-PLAN.md, Tarefa 3, D-05/D-06/ORC-12): o sequencial de
// `ORC-2026-001` nasce do banco, nunca de uma contagem lida antes. UMA CONEXÃO POR TRANSAÇÃO —
// duas transações na mesma conexão não são concorrência real e o teste passaria sem provar nada.
const SQL_INCREMENTO_DE_CONTADOR = `
  insert into contadores_orcamento (ano, ultimo_numero) values ($1, 1)
  on conflict (ano) do update set ultimo_numero = contadores_orcamento.ultimo_numero + 1
  returning ultimo_numero
`;

// `begin` → `insert ... on conflict do update ... returning` → `commit`, tudo numa conexão só.
// Chamada concorrentemente (via `Promise.all`, cada instância com a PRÓPRIA conexão) para provar
// que o Postgres serializa o acesso à linha do ano sem precisar de `select ... for update`
// explícito: a segunda conexão fica bloqueada dentro do próprio servidor até a primeira
// commitar, exatamente o comportamento que `proximoSequencialDeOrcamento`
// (lib/orcamentos/numero.ts) depende.
async function abrirIncrementarECommitar(conexao, ano) {
  await conexao.query("begin");
  const { rows } = await conexao.query(SQL_INCREMENTO_DE_CONTADOR, [ano]);
  await conexao.query("commit");
  return rows[0].ultimo_numero;
}

async function conferirNumeracaoConcorrenteDeOrcamento() {
  console.log("  conferirNumeracaoConcorrenteDeOrcamento...");

  const ANO_DE_TESTE = 2031; // ano fictício, não usado por nenhuma outra conferência deste arquivo.
  const ANO_DE_TESTE_INDEPENDENTE = 2032;

  const conexaoA = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  const conexaoB = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  const conexaoC = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  const conexaoD = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  const conexaoE = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await Promise.all([
    conexaoA.connect(),
    conexaoB.connect(),
    conexaoC.connect(),
    conexaoD.connect(),
    conexaoE.connect(),
  ]);

  try {
    // 1. Duas transações concorrentes pedindo o sequencial do MESMO ano recebem números
    // DIFERENTES e CONSECUTIVOS — nunca o mesmo número, nunca um buraco.
    const [numeroA, numeroB] = await Promise.all([
      abrirIncrementarECommitar(conexaoA, ANO_DE_TESTE),
      abrirIncrementarECommitar(conexaoB, ANO_DE_TESTE),
    ]);
    afirmar(numeroA !== numeroB, `Duas transações concorrentes receberam o MESMO número: ${numeroA}.`);
    afirmar(
      Math.abs(numeroA - numeroB) === 1,
      `Os dois números deveriam ser consecutivos, vieram ${numeroA} e ${numeroB}.`,
    );
    afirmar(
      Math.max(numeroA, numeroB) === 2 && Math.min(numeroA, numeroB) === 1,
      `Os dois primeiros números do ano ${ANO_DE_TESTE} deveriam ser 1 e 2 (em alguma ordem), vieram ${numeroA} e ${numeroB}.`,
    );

    // 2. Uma transação que pede o sequencial e depois REVERTE não consome o número — a próxima
    // transação recebe o MESMO valor.
    await conexaoC.query("begin");
    const { rows: linhaRevertida } = await conexaoC.query(SQL_INCREMENTO_DE_CONTADOR, [ANO_DE_TESTE]);
    const numeroQueSeraRevertido = linhaRevertida[0].ultimo_numero;
    await conexaoC.query("rollback");

    const numeroAposReversao = await abrirIncrementarECommitar(conexaoD, ANO_DE_TESTE);
    afirmar(
      numeroAposReversao === numeroQueSeraRevertido,
      `Um número pedido numa transação revertida (${numeroQueSeraRevertido}) não deveria ser ` +
        `pulado — a próxima transação deveria recebê-lo de volta, veio ${numeroAposReversao}.`,
    );

    // 3. Anos diferentes têm contadores independentes: o primeiro orçamento de um ano novo é 1,
    // mesmo com vários orçamentos já numerados em outro ano.
    const numeroDoAnoIndependente = await abrirIncrementarECommitar(
      conexaoE,
      ANO_DE_TESTE_INDEPENDENTE,
    );
    afirmar(
      numeroDoAnoIndependente === 1,
      `O primeiro número de um ano novo (${ANO_DE_TESTE_INDEPENDENTE}) deveria ser 1, mesmo com ` +
        `orçamentos já numerados em ${ANO_DE_TESTE} — veio ${numeroDoAnoIndependente}.`,
    );
  } finally {
    // Faxina: os contadores de teste não são dado de produção — apagar é seguro e esperado.
    await conexaoA
      .query("delete from contadores_orcamento where ano in ($1, $2)", [
        ANO_DE_TESTE,
        ANO_DE_TESTE_INDEPENDENTE,
      ])
      .catch(() => {});
    await Promise.all([
      conexaoA.end(),
      conexaoB.end(),
      conexaoC.end(),
      conexaoD.end(),
      conexaoE.end(),
    ]);
  }
}

// Fase 04.5 (04.5-01-PLAN.md, Tarefa 3, D-17): a semente de `db/migrations/0019` cria os 18
// parâmetros, todos "estimado" — e reaplicá-la não duplica nenhuma linha (mesma disciplina do
// `on conflict do nothing` de 0016, provada em `conferirFinanceiro`).
async function conferirSementeDeParametros(cliente) {
  console.log("  conferirSementeDeParametros...");

  // As 18 da 0019; as duas da régua são da 0030 e são conferidas por `conferirQueimas`.
  const { rows: parametrosSemeados } = await cliente.query(
    "select chave, medido from parametros_precificacao where chave not in ('queima_regua_p_ate', 'queima_regua_m_ate')",
  );
  afirmar(
    parametrosSemeados.length === 18,
    `Deveriam existir exatamente 18 parâmetros semeados pela migração 0019, vieram ${parametrosSemeados.length}.`,
  );
  afirmar(
    parametrosSemeados.every((linha) => linha.medido === false),
    "Todo parâmetro semeado deveria nascer com medido = false (D-17) — nenhum é uma medição real.",
  );

  const caminhoDaSemente = path.join(
    process.cwd(),
    "db",
    "migrations",
    "0019_parametros-iniciais.sql",
  );
  const sqlDaSemente = readFileSync(caminhoDaSemente, "utf8");
  await cliente.query(sqlDaSemente);

  // Reaplicar 0019 sozinha, fora da janela ruim de fuso, não duplica nada (seu próprio
  // `on conflict (chave, vigente_desde) do nothing`). MAS 0019 grava `current_date` cru (0019 é
  // congelada por D-33, nunca editada) enquanto 0021 já normalizou as linhas existentes para
  // `hoje_brasilia()` — dentro da janela ruim (21h-meia-noite BRT) os dois valores DIVERGEM, e
  // reaplicar só 0019 criaria 18 linhas "duplicadas" (mesma chave, `vigente_desde` de amanhã). Na
  // prática isso nunca acontece pelo `db:migrate` real (o Drizzle nunca reaplica uma migração já
  // registrada) — mas 0019 e 0021 são companheiras (a Tarefa 1 do 04.5-13-PLAN.md, WINDOWS #44) e
  // sempre aplicadas em sequência (roteiro 13: "0017, 0018, 0019, 0020, 0021, nesta ordem");
  // reaplicar 0021 logo depois de 0019 é o que reflete essa ordem de verdade, e é exatamente o que
  // prova que a dupla continua idempotente mesmo dentro da janela ruim.
  const caminhoDaCorrecaoDeFuso = path.join(
    process.cwd(),
    "db",
    "migrations",
    "0021_corrigir-fuso-da-semente-de-parametros.sql",
  );
  const instrucoesDaCorrecaoDeFuso = readFileSync(caminhoDaCorrecaoDeFuso, "utf8")
    .split("--> statement-breakpoint")
    .map((bloco) =>
      bloco
        .split("\n")
        .filter((linha) => !linha.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((instrucao) => instrucao.length > 0);
  for (const instrucao of instrucoesDaCorrecaoDeFuso) {
    await cliente.query(instrucao);
  }

  const { rows: aposReaplicar } = await cliente.query(
    "select count(*)::int as total from parametros_precificacao where chave not in ('queima_regua_p_ate', 'queima_regua_m_ate')",
  );
  afirmar(
    aposReaplicar[0].total === 18,
    "Reaplicar a semente de parâmetros (0019) seguida da correção de fuso (0021) não deveria " +
      `duplicar nada — esperado 18, veio ${aposReaplicar[0].total}.`,
  );
}

// Fase 04.5-13 (WINDOWS #44): prova, contra Postgres de verdade, que a migração 0021 corrige
// qualquer parâmetro cujo `vigente_desde` tenha nascido no FUTURO em relação à data civil de
// Brasília — o defeito real da semente 0019 (`current_date` do Postgres, em UTC, aplicada entre
// 21h e meia-noite BRT). Um teste que só roda de dia não prova nada: em vez de esperar a janela
// ruim, FORÇAMOS o estado que ela produziria, direto no banco, usando a mesma tática (desligar o
// gatilho pela duração do ajuste) que a própria migração usa.
async function conferirCorrecaoDoFusoDaSemente(cliente) {
  console.log("  conferirCorrecaoDoFusoDaSemente...");

  const CHAVE_DE_TESTE = "material_argila"; // já semeada por 0019 — reaproveitada, não inventada.

  // 1. Força o estado "antes": desliga o gatilho só pela duração deste ajuste e grava
  // vigente_desde como o dia SEGUINTE ao de Brasília — exatamente a forma do defeito (a semente
  // grava o current_date do Postgres, que na janela ruim já é amanhã em relação a Brasília).
  await cliente.query(
    "alter table parametros_precificacao disable trigger recusar_mudanca_de_valor_do_parametro",
  );
  try {
    await cliente.query(
      `update parametros_precificacao set vigente_desde = hoje_brasilia() + 1 where chave = $1`,
      [CHAVE_DE_TESTE],
    );
  } finally {
    await cliente.query(
      "alter table parametros_precificacao enable trigger recusar_mudanca_de_valor_do_parametro",
    );
  }

  const { rows: hojeAntes } = await cliente.query("select hoje_brasilia()::text as hoje");
  const { rows: antes } = await cliente.query(
    "select vigente_desde::text as vigente_desde from parametros_precificacao where chave = $1",
    [CHAVE_DE_TESTE],
  );
  afirmar(
    antes[0].vigente_desde > hojeAntes[0].hoje,
    "A preparação do teste falhou — o parâmetro deveria estar datado no futuro antes da correção.",
  );

  // A MESMA consulta que lib/precificacao/consultas.ts::parametrosVigentes faz
  // (`vigente_desde <= hoje`) — provando que a tela realmente não encontraria este parâmetro no
  // estado "antes", o sintoma real do defeito ("Não deu para carregar os parâmetros").
  const { rows: encontradoAntes } = await cliente.query(
    "select 1 from parametros_precificacao where chave = $1 and vigente_desde <= hoje_brasilia()",
    [CHAVE_DE_TESTE],
  );
  afirmar(
    encontradoAntes.length === 0,
    "A preparação do teste falhou — antes da correção, o parâmetro já seria encontrado como " +
      "vigente (o cenário do defeito não foi reproduzido).",
  );

  // 2. Aplica a migração 0021 de verdade, lendo o arquivo do disco — não uma cópia da lógica.
  const caminhoDaMigracao = path.join(
    process.cwd(),
    "db",
    "migrations",
    "0021_corrigir-fuso-da-semente-de-parametros.sql",
  );
  const instrucoesDaMigracao = readFileSync(caminhoDaMigracao, "utf8")
    .split("--> statement-breakpoint")
    .map((bloco) =>
      bloco
        .split("\n")
        .filter((linha) => !linha.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((instrucao) => instrucao.length > 0);
  for (const instrucao of instrucoesDaMigracao) {
    await cliente.query(instrucao);
  }

  // 3. Depois: o parâmetro corrigido cai exatamente em hoje_brasilia(), e a MESMA consulta de
  // parametrosVigentes agora encontra o parâmetro — o defeito real está resolvido, não só o dado.
  const { rows: hojeDepois } = await cliente.query("select hoje_brasilia()::text as hoje");
  const { rows: depois } = await cliente.query(
    "select vigente_desde::text as vigente_desde from parametros_precificacao where chave = $1",
    [CHAVE_DE_TESTE],
  );
  afirmar(
    depois[0].vigente_desde === hojeDepois[0].hoje,
    `Depois da migração 0021, vigente_desde deveria ser ${hojeDepois[0].hoje} (hoje_brasilia()), ` +
      `veio ${depois[0].vigente_desde}.`,
  );

  const { rows: encontradoDepois } = await cliente.query(
    "select 1 from parametros_precificacao where chave = $1 and vigente_desde <= hoje_brasilia()",
    [CHAVE_DE_TESTE],
  );
  afirmar(
    encontradoDepois.length === 1,
    "Depois da migração 0021, o parâmetro ainda não é encontrado como vigente — a correção não " +
      "resolveu o defeito de verdade.",
  );

  // 4. Idempotência: reaplicar a migração de novo não falha (nenhuma linha mais satisfaz
  // vigente_desde > hoje_brasilia()) e não muda o valor já corrigido.
  for (const instrucao of instrucoesDaMigracao) {
    await cliente.query(instrucao);
  }
  const { rows: aposReaplicar } = await cliente.query(
    "select vigente_desde::text as vigente_desde from parametros_precificacao where chave = $1",
    [CHAVE_DE_TESTE],
  );
  afirmar(
    aposReaplicar[0].vigente_desde === hojeDepois[0].hoje,
    "Reaplicar a migração 0021 não deveria mudar um parâmetro já corrigido.",
  );
}

// Fase 04.6, plano 07 (D-08/GES-10) — Anotações da casa: a semente, a garantia de linha única,
// o gatilho, e a PRIMEIRA prova de detecção de escrita velha concorrente deste projeto. Não
// havia precedente a copiar: o mapa de padrões da fase (04.6-PATTERNS.md) achou zero casos de
// comparação "o que eu vi" contra "o que está agora" em todo o repositório antes deste plano.
async function conferirAnotacoesDaCasa(cliente) {
  console.log("  conferirAnotacoesDaCasa...");

  // (a) A semente existe: exatamente 1 linha, texto vazio, salvo_por nulo ("ninguém salvou
  // ainda") — é ela que faz lerFolhaDaCasa() nunca precisar tratar "a folha não existe".
  const { rows: sementeRows } = await cliente.query(
    "select texto, salvo_por from anotacoes_da_casa",
  );
  afirmar(
    sementeRows.length === 1,
    `Deveria existir exatamente 1 linha semeada em anotacoes_da_casa, vieram ${sementeRows.length}.`,
  );
  afirmar(
    sementeRows[0].texto === "",
    `A linha semeada deveria ter texto vazio, veio "${sementeRows[0].texto}".`,
  );
  afirmar(
    sementeRows[0].salvo_por === null,
    "A linha semeada deveria ter salvo_por nulo (ninguém salvou ainda) — veio um valor.",
  );

  // (b) A folha é única: um segundo insert é recusado pela restrição unique + check de
  // linha_unica (D-08: a garantia mora no banco, não na disciplina da aplicação).
  let segundoInsertFalhou = false;
  try {
    await cliente.query("insert into anotacoes_da_casa (texto) values ('uma segunda linha')");
  } catch {
    segundoInsertFalhou = true;
  }
  afirmar(
    segundoInsertFalhou,
    "Um segundo insert em anotacoes_da_casa deveria ter sido recusado pela restrição de linha " +
      "única (unique + check sobre linha_unica).",
  );

  // (c) O gatilho funciona: um update de texto muda atualizado_em, e o valor novo é MAIOR que o
  // anterior — é este gatilho (nunca a aplicação) que mantém a marca de versão que
  // decidirGravacao compara.
  const { rows: antesGatilho } = await cliente.query(
    "select atualizado_em from anotacoes_da_casa",
  );
  const atualizadoAntesDoGatilho = antesGatilho[0].atualizado_em;
  // Pausa pequena, mesma razão de conferirTriggerFuncionando (usuarios) acima: sem ela, "antes"
  // e "depois" podem cair no mesmo microssegundo por coincidência de relógio, não por defeito.
  await new Promise((resolve) => setTimeout(resolve, 50));
  const { rows: depoisGatilho } = await cliente.query(
    "update anotacoes_da_casa set texto = 'Prova do gatilho (script de migração)' returning atualizado_em",
  );
  const atualizadoDepoisDoGatilho = depoisGatilho[0].atualizado_em;
  afirmar(
    new Date(atualizadoDepoisDoGatilho).getTime() > new Date(atualizadoAntesDoGatilho).getTime(),
    "atualizado_em não avançou depois de um update que não mencionou essa coluna — o gatilho " +
      "tocar_atualizado_em_anotacoes_da_casa não está funcionando de verdade.",
  );

  // (d) 🔴 A prova de concorrência — duas transações de VERDADE, no molde de
  // conferirNumeracaoConcorrenteDeOrcamento (04.5-01) acima. `vistoEmComum` é o instante que as
  // DUAS transações "viram" antes de qualquer uma delas escrever — o mesmo papel que o
  // `atualizadoEm` capturado ao abrir a tela cumpre para dois gestores de verdade.
  const { rows: comumRows } = await cliente.query("select atualizado_em from anotacoes_da_casa");
  const vistoEmComumMs = new Date(comumRows[0].atualizado_em).getTime();

  const conexaoA = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  const conexaoB = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await Promise.all([conexaoA.connect(), conexaoB.connect()]);

  try {
    // A MESMA sequência que lib/anotacoes/acoes.ts::salvarAnotacoes usa dentro da transação:
    // `select ... for update` trava a linha única (a segunda conexão fica bloqueada dentro do
    // próprio servidor até a primeira commitar — nenhum "for update" explícito seria necessário
    // se o Postgres não serializasse aqui, exatamente como a numeração de orçamento acima); só
    // DEPOIS de travada é que o atualizado_em fresco é comparado contra o vistoEmComum captado
    // ANTES de qualquer uma das duas começar. Quem chega primeiro grava; quem chega depois vê o
    // atualizado_em JÁ avançado pela primeira, não bate com o que tinha visto, e é avisada — sem
    // nunca sobrescrever o texto da primeira.
    async function travarCompararEGravar(conexao, textoCandidato) {
      await conexao.query("begin");
      const { rows } = await conexao.query(
        "select atualizado_em from anotacoes_da_casa where linha_unica for update",
      );
      const atualizadoEmNoServidorMs = new Date(rows[0].atualizado_em).getTime();
      const decisao = atualizadoEmNoServidorMs === vistoEmComumMs ? "gravar" : "avisar";
      if (decisao === "gravar") {
        await conexao.query("update anotacoes_da_casa set texto = $1 where linha_unica", [
          textoCandidato,
        ]);
      }
      await conexao.query("commit");
      return decisao;
    }

    const [decisaoA, decisaoB] = await Promise.all([
      travarCompararEGravar(conexaoA, "Recado da primeira transação (prova de migração)"),
      travarCompararEGravar(conexaoB, "Recado da segunda transação — escrita velha, nunca deveria vencer"),
    ]);

    afirmar(
      [decisaoA, decisaoB].filter((decisao) => decisao === "gravar").length === 1,
      `Exatamente UMA das duas transações concorrentes deveria gravar, vieram: A="${decisaoA}", B="${decisaoB}".`,
    );
    afirmar(
      [decisaoA, decisaoB].filter((decisao) => decisao === "avisar").length === 1,
      `Exatamente UMA das duas transações concorrentes deveria ser avisada (escrita velha), vieram: A="${decisaoA}", B="${decisaoB}".`,
    );

    const { rows: textoFinalRows } = await cliente.query(
      "select texto from anotacoes_da_casa",
    );
    const textoDaQueGravou =
      decisaoA === "gravar"
        ? "Recado da primeira transação (prova de migração)"
        : "Recado da segunda transação — escrita velha, nunca deveria vencer";
    afirmar(
      textoFinalRows[0].texto === textoDaQueGravou,
      `O texto no banco deveria ser o da transação que realmente gravou ("${textoDaQueGravou}"), ` +
        `veio "${textoFinalRows[0].texto}" — a segunda transação (escrita velha) não deveria ter ` +
        "conseguido sobrescrever a primeira em silêncio.",
    );
  } finally {
    await Promise.all([conexaoA.end(), conexaoB.end()]);
  }

  // Faxina: devolve a folha ao estado de semente — as conferências deste script rodam em
  // sequência sobre o MESMO banco, e um texto de prova sobrando não é dado real de produção.
  await cliente.query("update anotacoes_da_casa set texto = '', salvo_por = null");
}

// ————————————————————————————————————————————————————————————————————————————————————————————
// Fase 06 — Estoque (plano 06-02, Tarefa 2). O livro `movimentacoes_estoque` (migração 0023)
// provado pelo Postgres de verdade: imutável para `amassa_app` (EST-06), coerente pelos `check`s,
// um estorno por linha, o consumo ligado à ORDEM de produção que não se apaga (desde a 0024 da Fase
// 06.1; até ela, "a encomenda apagada sem apagar o consumo", Pitfall 10), a unidade travada
// depois da primeira movimentação (Pitfall 6) — e, em `conferirConcorrenciaDoEstoque`, duas
// vendas do mesmo insumo sem impasse (Pitfall 2).
// ————————————————————————————————————————————————————————————————————————————————————————————

// O SQLSTATE de uma promessa que deveria falhar — `null` quando ela passa. No `pg` puro o código
// está no próprio erro (`erro.code`); é o Drizzle que o embrulha em `erro.cause.code`.
async function codigoDoErro(executar) {
  try {
    await executar();
    return null;
  } catch (erro) {
    return erro.code ?? `sem código (${erro.message})`;
  }
}

// `insert` numa linha do livro a partir de um objeto { coluna: valor } — as colunas vêm só deste
// arquivo, nunca de entrada externa. Devolve o id.
async function inserirMovimentacao(conexao, campos) {
  const colunas = Object.keys(campos);
  const marcadores = colunas.map((_, indice) => `$${indice + 1}`);
  const { rows } = await conexao.query(
    `insert into movimentacoes_estoque (${colunas.join(", ")}) values (${marcadores.join(", ")}) returning id`,
    Object.values(campos),
  );
  return rows[0].id;
}

// Q e V do item — a mesma soma que `lib/estoque/gravacao.ts::lerEstados` faz. `sum(bigint)` volta
// como texto do `pg` → `Number`.
async function estadoDoItemNoLivro(conexao, itemId) {
  const { rows } = await conexao.query(
    `select coalesce(sum(quantidade_milesimos), 0) as q, coalesce(sum(valor_centavos), 0) as v
       from movimentacoes_estoque where item_id = $1`,
    [itemId],
  );
  return { q: Number(rows[0].q), v: Number(rows[0].v) };
}

// Um documento com uma linha do item e a parcela que fecha a soma — a restrição ADIADA
// `conferir_soma_do_documento` (0015) só deixa comitar assim. Chamada DENTRO de uma transação
// aberta por quem chama. A linha com `item_id` faz a checagem de chave estrangeira segurar
// `FOR KEY SHARE` no item até o fim da transação — é isso que o Pitfall 2 é.
async function inserirDocumentoComItem(conexao, { tipo, itemId, categoriaId, usuarioId, valor }) {
  const { rows: documento } = await conexao.query(
    `insert into documentos (tipo, data, criado_por) values ($1, current_date, $2) returning id`,
    [tipo, usuarioId],
  );
  const documentoId = documento[0].id;
  const { rows: linha } = await conexao.query(
    `insert into documento_linhas (documento_id, ordem, item_id, descricao, categoria_id, valor_centavos, quantidade_estoque)
     values ($1, 1, $2, 'Linha de prova do estoque (migração)', $3, $4, $5) returning id`,
    [documentoId, itemId, categoriaId, valor, tipo === "despesa" ? "5" : null],
  );
  await conexao.query(
    `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
     values ($1, 1, current_date, $2, 'pix', current_date, $3)`,
    [documentoId, valor, usuarioId],
  );
  return { documentoId, linhaId: linha[0].id };
}

// Faxina do Estoque, como DONO das tabelas (o `revoke` vale só para `amassa_app`). O livro sai
// num `delete` só (estorno e original juntos: a chave `estorno_de_id` é NO ACTION, conferida no
// fim do comando). Os documentos saem com as duas restrições de soma desligadas dentro da
// transação — o mesmo motivo, e o mesmo cuidado, da faxina de `conferirFinanceiro`. Em CI o
// Playwright roda depois contra o MESMO banco, e o vazio do Estoque (`@vazio-global`) exige
// que nenhum material de prova sobre.
async function apagarDadosDeProvaDoEstoque(
  conexao,
  { itemIds = [], documentoIds = [], ordemIds = [], usuarioId = null },
) {
  try {
    await conexao.query("begin");
    await conexao.query("delete from movimentacoes_estoque where item_id = any($1::uuid[])", [itemIds]);
    await conexao.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from parcelas where documento_id = any($1::uuid[])", [documentoIds]);
    await conexao.query("delete from documento_linhas where documento_id = any($1::uuid[])", [
      documentoIds,
    ]);
    await conexao.query("delete from documentos where id = any($1::uuid[])", [documentoIds]);
    await conexao.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from itens_catalogo where id = any($1::uuid[])", [itemIds]);
    // A ordem de prova sai pela conexão de DONO — `amassa_app` não tem `delete` em
    // `ordens_producao` (revoke da 0024), e é exatamente isso que o caso (d) prova. Depois do
    // livro (o vínculo `encomenda_id` é NO ACTION).
    await conexao.query("delete from ordem_etapas where ordem_id = any($1::uuid[])", [ordemIds]);
    await conexao.query("delete from ordens_producao where id = any($1::uuid[])", [ordemIds]);
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado (ver a faxina de `conferirFinanceiro`): um `throw` aqui esconderia a falha
    // de asserção que o `try` de quem chama já tenha lançado.
    console.error(`Estoque: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

async function conferirEstoque(conexao) {
  console.log("  conferirEstoque...");

  const { rows: usuarioInserido } = await conexao.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste do Estoque', 'usuaria-estoque@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;
  const categoriaCompraId = (
    await conexao.query("select id from categorias where nome = 'Argila, esmalte e insumos'")
  ).rows[0].id;
  const categoriaVendaId = (await conexao.query("select id from categorias where nome = 'Peças prontas'"))
    .rows[0].id;

  const itemIds = [];
  const documentoIds = [];
  const ordemIds = [];

  try {
    // Dois materiais de prova, com nomes que nenhuma outra conferência usa. O primeiro também
    // aparece na venda — assim desligar o estoque próprio dele não esbarra no `check`
    // `itens_catalogo_aparece_ou_controla`, e a recusa do item (e) é do gatilho, não do check.
    const { rows: comLivro } = await conexao.query(
      `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id, aparece_na_venda, categoria_venda_id)
       values ('Argila de prova do livro (migração)', true, 'kg', $1, true, $2) returning id`,
      [categoriaCompraId, categoriaVendaId],
    );
    const itemId = comLivro[0].id;
    itemIds.push(itemId);
    const { rows: semLivro } = await conexao.query(
      `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id)
       values ('Esmalte de prova sem movimentação (migração)', true, 'kg', $1) returning id`,
      [categoriaCompraId],
    );
    const itemSemMovimentacaoId = semLivro[0].id;
    itemIds.push(itemSemMovimentacaoId);

    // Desde a 0024 (Fase 06.1) o vínculo `movimentacoes_estoque.encomenda_id` aponta para a ORDEM
    // DE PRODUÇÃO — o nome da coluna é histórico. A ordem de prova é da casa, ativa, com `inicio`
    // (o check `ordens_producao_aguardando_sem_inicio`).
    const { rows: ordemInserida } = await conexao.query(
      `insert into ordens_producao (tipo, caminho, status, nome, inicio, criado_por)
       values ('casa', 'completo', 'ativa', 'Ordem de prova do estoque (migração)', current_date, $1)
       returning id`,
      [usuarioId],
    );
    const ordemId = ordemInserida[0].id;
    ordemIds.push(ordemId);

    const base = { item_id: itemId, registrado_por: usuarioId };
    const entradaManual = {
      ...base,
      origem: "manual",
      tipo: "entrada",
      quantidade_milesimos: 5000,
      valor_centavos: 2100,
      valor_informado_centavos: 2100,
    };
    const saidaManual = {
      ...base,
      origem: "manual",
      tipo: "saida",
      destino: "atelie",
      area: "pecas",
      quantidade_milesimos: -2000,
      valor_centavos: -840,
    };

    // (b, parte válida) Um `insert` válido de cada tipo passa: entrada, saída e ajuste manuais,
    // saída de venda e entrada de compra (com documento que comita), e o estorno de venda (c).
    const idEntrada = await inserirMovimentacao(conexao, entradaManual);
    await inserirMovimentacao(conexao, saidaManual);
    await inserirMovimentacao(conexao, {
      ...base,
      origem: "manual",
      tipo: "ajuste",
      quantidade_milesimos: 500,
      valor_centavos: 210,
      saldo_contado_milesimos: 3500,
    });

    await conexao.query("begin");
    let idSaidaDeVenda;
    try {
      const venda = await inserirDocumentoComItem(conexao, {
        tipo: "venda",
        itemId,
        categoriaId: categoriaVendaId,
        usuarioId,
        valor: 3000,
      });
      documentoIds.push(venda.documentoId);
      idSaidaDeVenda = await inserirMovimentacao(conexao, {
        ...base,
        origem: "venda",
        tipo: "saida",
        area: "pecas",
        documento_id: venda.documentoId,
        documento_linha_id: venda.linhaId,
        quantidade_milesimos: -1000,
        valor_centavos: -420,
      });
      const compra = await inserirDocumentoComItem(conexao, {
        tipo: "despesa",
        itemId,
        categoriaId: categoriaCompraId,
        usuarioId,
        valor: 2500,
      });
      documentoIds.push(compra.documentoId);
      await inserirMovimentacao(conexao, {
        ...base,
        origem: "compra",
        tipo: "entrada",
        documento_id: compra.documentoId,
        documento_linha_id: compra.linhaId,
        quantidade_milesimos: 5000,
        valor_centavos: 2500,
        valor_informado_centavos: 2500,
      });
      await conexao.query("commit");
    } catch (erro) {
      await conexao.query("rollback").catch(() => {});
      throw new Error(
        `Uma venda e uma compra válidas, com a movimentação de cada uma, deveriam comitar — ${erro.message}`,
      );
    }

    // (a) EST-06: o livro não tem porta de edição para a aplicação.
    const { rows: privilegios } = await conexao.query(
      `select
         has_table_privilege('amassa_app', 'movimentacoes_estoque', 'select') as pode_select,
         has_table_privilege('amassa_app', 'movimentacoes_estoque', 'insert') as pode_insert,
         has_table_privilege('amassa_app', 'movimentacoes_estoque', 'update') as pode_update,
         has_table_privilege('amassa_app', 'movimentacoes_estoque', 'delete') as pode_delete`,
    );
    afirmar(
      privilegios[0].pode_select && privilegios[0].pode_insert,
      "O papel amassa_app deveria ter select e insert em movimentacoes_estoque — registrar é sempre uma linha nova.",
    );
    afirmar(
      !privilegios[0].pode_update && !privilegios[0].pode_delete,
      "O papel amassa_app NÃO deveria ter update nem delete em movimentacoes_estoque (EST-06) — " +
        "o `revoke update, delete` da migração 0023 não está valendo.",
    );

    // E não é só o catálogo de privilégios que diz: um `update` e um `delete` reais, como
    // `amassa_app`, sobre uma linha que existe, são recusados pelo banco com 42501.
    async function comoAmassaApp(sql, parametros) {
      await conexao.query("begin");
      try {
        await conexao.query("set local role amassa_app");
        return await codigoDoErro(() => conexao.query(sql, parametros));
      } finally {
        await conexao.query("rollback");
      }
    }
    const codigoDoUpdate = await comoAmassaApp(
      "update movimentacoes_estoque set nota = 'Reescrita proibida' where id = $1",
      [idEntrada],
    );
    afirmar(
      codigoDoUpdate === "42501",
      `Um update em movimentacoes_estoque como amassa_app deveria falhar com 42501 (sem privilégio), veio ${codigoDoUpdate}.`,
    );
    const codigoDoDelete = await comoAmassaApp("delete from movimentacoes_estoque where id = $1", [
      idEntrada,
    ]);
    afirmar(
      codigoDoDelete === "42501",
      `Um delete em movimentacoes_estoque como amassa_app deveria falhar com 42501 (sem privilégio), veio ${codigoDoDelete}.`,
    );
    const codigoDoInsert = await comoAmassaApp(
      `insert into movimentacoes_estoque (item_id, registrado_por, origem, tipo, quantidade_milesimos, valor_centavos, valor_informado_centavos)
       values ($1, $2, 'manual', 'entrada', 1000, 420, 420)`,
      [itemId, usuarioId],
    );
    afirmar(
      codigoDoInsert === null,
      `O papel amassa_app deveria conseguir inserir no livro (número gerado pelo banco), veio ${codigoDoInsert}.`,
    );

    // (b) Os `check`s da 0023: cada linha incoerente é recusada com 23514.
    const LINHAS_INCOERENTES = [
      ["saída com quantidade positiva", { ...saidaManual, quantidade_milesimos: 2000 }],
      ["entrada com quantidade negativa", { ...entradaManual, quantidade_milesimos: -5000 }],
      [
        "origem venda sem documento_id",
        { ...base, origem: "venda", tipo: "saida", area: "pecas", quantidade_milesimos: -1000, valor_centavos: -420 },
      ],
      [
        "saída manual sem destino",
        { ...base, origem: "manual", tipo: "saida", area: "pecas", quantidade_milesimos: -1000, valor_centavos: -420 },
      ],
      [
        "ajuste sem saldo_contado_milesimos",
        { ...base, origem: "manual", tipo: "ajuste", quantidade_milesimos: 1000, valor_centavos: 420 },
      ],
      [
        "encomenda_id com destino aula",
        { ...saidaManual, destino: "aula", area: "espaco", encomenda_id: ordemId },
      ],
      ["nota com 161 caracteres", { ...entradaManual, nota: "n".repeat(161) }],
      ["origem manual com estorno_de_id", { ...saidaManual, estorno_de_id: idEntrada }],
      ["entrada sem valor_informado_centavos", { ...entradaManual, valor_informado_centavos: null }],
    ];
    for (const [descricao, campos] of LINHAS_INCOERENTES) {
      const codigo = await codigoDoErro(() => inserirMovimentacao(conexao, campos));
      afirmar(
        codigo === "23514",
        `Uma movimentação com ${descricao} deveria ser recusada por um check (23514), veio ${codigo}.`,
      );
    }

    // (c) Um estorno por original: o primeiro estorno da saída de venda passa; o segundo, com o
    // MESMO estorno_de_id, é recusado pelo único `movimentacoes_estoque_estorno_de_uk` (23505).
    const estornoDaVenda = {
      ...base,
      origem: "venda",
      tipo: "entrada",
      area: "pecas",
      documento_id: documentoIds[0],
      estorno_de_id: idSaidaDeVenda,
      quantidade_milesimos: 1000,
      valor_centavos: 420,
      valor_informado_centavos: 420,
    };
    const codigoDoPrimeiroEstorno = await codigoDoErro(() =>
      inserirMovimentacao(conexao, estornoDaVenda),
    );
    afirmar(
      codigoDoPrimeiroEstorno === null,
      `O estorno da saída de venda deveria passar, veio ${codigoDoPrimeiroEstorno}.`,
    );
    const codigoDoSegundoEstorno = await codigoDoErro(() =>
      inserirMovimentacao(conexao, estornoDaVenda),
    );
    afirmar(
      codigoDoSegundoEstorno === "23505",
      `Um segundo estorno da MESMA movimentação deveria ser recusado com 23505, veio ${codigoDoSegundoEstorno}.`,
    );

    // (d) Fase 06.1 (migração 0024) — reescrito a partir do `set null` da Fase 06 (Pitfall 10): o
    // vínculo do livro agora aponta para a ORDEM DE PRODUÇÃO. Uma saída "consumo em encomenda"
    // ligada à ordem é aceita; e a ordem NÃO se apaga — `amassa_app` recebe 42501 (o `revoke
    // delete` da 0024), com o consumo intacto no livro e ainda ligado à ordem.
    const idConsumoDaOrdem = await inserirMovimentacao(conexao, {
      ...saidaManual,
      destino: "encomenda",
      encomenda_id: ordemId,
      quantidade_milesimos: -500,
      valor_centavos: -210,
    });
    const codigoDaExclusaoDaOrdem = await comoAmassaApp(
      "delete from ordens_producao where id = $1",
      [ordemId],
    );
    afirmar(
      codigoDaExclusaoDaOrdem === "42501",
      `Apagar, como amassa_app, uma ordem de produção deveria falhar com 42501 (revoke delete da 0024 — ordem só se cancela), veio ${codigoDaExclusaoDaOrdem}.`,
    );
    const { rows: consumoDepois } = await conexao.query(
      "select encomenda_id, destino from movimentacoes_estoque where id = $1",
      [idConsumoDaOrdem],
    );
    afirmar(
      consumoDepois.length === 1,
      "A movimentação de consumo em encomenda deveria continuar no livro depois da tentativa de apagar a ordem.",
    );
    afirmar(
      consumoDepois[0].encomenda_id === ordemId && consumoDepois[0].destino === "encomenda",
      `O consumo deveria continuar ligado à ordem, com destino "encomenda", veio encomenda_id ${consumoDepois[0].encomenda_id} e destino "${consumoDepois[0].destino}".`,
    );
    // O vínculo aponta para `ordens_producao` de verdade: um id que não é de ordem nenhuma é
    // recusado pela chave estrangeira nova (23503).
    const codigoDoVinculoSemOrdem = await codigoDoErro(() =>
      inserirMovimentacao(conexao, {
        ...saidaManual,
        destino: "encomenda",
        encomenda_id: "00000000-0000-4000-8000-000000000000",
        quantidade_milesimos: -500,
        valor_centavos: -210,
      }),
    );
    afirmar(
      codigoDoVinculoSemOrdem === "23503",
      `Uma saída ligada a um id que não é de ordem nenhuma deveria ser recusada pela chave estrangeira (23503), veio ${codigoDoVinculoSemOrdem}.`,
    );

    // (e) Pitfall 6: item com movimentação não muda de unidade nem deixa de controlar estoque
    // (gatilho `travar_unidade_do_item_com_movimentacao`, P0001); o resto do item continua livre.
    const codigoDaUnidade = await codigoDoErro(() =>
      conexao.query("update itens_catalogo set unidade = 'g' where id = $1", [itemId]),
    );
    afirmar(
      codigoDaUnidade === "P0001",
      `Mudar a unidade de um item com movimentação deveria ser recusado pelo gatilho (P0001), veio ${codigoDaUnidade}.`,
    );
    const codigoDoEstoqueProprio = await codigoDoErro(() =>
      conexao.query("update itens_catalogo set controla_estoque = false where id = $1", [itemId]),
    );
    afirmar(
      codigoDoEstoqueProprio === "P0001",
      `Desligar o estoque próprio de um item com movimentação deveria ser recusado pelo gatilho (P0001), veio ${codigoDoEstoqueProprio}.`,
    );
    const codigoDoNome = await codigoDoErro(() =>
      conexao.query("update itens_catalogo set nome = 'Argila de prova renomeada (migração)' where id = $1", [
        itemId,
      ]),
    );
    afirmar(
      codigoDoNome === null,
      `Renomear um item com movimentação deveria continuar livre, veio ${codigoDoNome}.`,
    );
    const codigoDaUnidadeSemLivro = await codigoDoErro(() =>
      conexao.query("update itens_catalogo set unidade = 'g' where id = $1", [itemSemMovimentacaoId]),
    );
    afirmar(
      codigoDaUnidadeSemLivro === null,
      `Mudar a unidade de um item SEM movimentação deveria passar, veio ${codigoDaUnidadeSemLivro}.`,
    );

    // (f) As colunas novas de `itens_catalogo`: nascem ativo e com mínimo zero; mínimo negativo e
    // observação vazia ou longa demais são recusados pelos `check`s.
    const { rows: colunasNovas } = await conexao.query(
      "select ativo, estoque_minimo_milesimos, observacoes from itens_catalogo where id = $1",
      [itemSemMovimentacaoId],
    );
    afirmar(
      colunasNovas[0].ativo === true &&
        Number(colunasNovas[0].estoque_minimo_milesimos) === 0 &&
        colunasNovas[0].observacoes === null,
      `Item novo deveria nascer ativo, com mínimo 0 e sem observação, veio ${JSON.stringify(colunasNovas[0])}.`,
    );
    for (const [descricao, sql, parametros] of [
      ["mínimo negativo", "update itens_catalogo set estoque_minimo_milesimos = -1 where id = $1", []],
      ["observação só de espaços", "update itens_catalogo set observacoes = '   ' where id = $1", []],
      ["observação com 501 caracteres", "update itens_catalogo set observacoes = $2 where id = $1", ["o".repeat(501)]],
    ]) {
      const codigo = await codigoDoErro(() =>
        conexao.query(sql, [itemSemMovimentacaoId, ...parametros]),
      );
      afirmar(codigo === "23514", `Um item com ${descricao} deveria ser recusado por um check (23514), veio ${codigo}.`);
    }

    // (g) D-20 corrigido pela pesquisa: item se desativa, nunca se apaga — `itens_catalogo`
    // continua sem delete para `amassa_app` (a mesma lista `TABELAS_SEM_DELETE` de
    // `conferirFinanceiro`, que a fase não muda).
    const { rows: deleteDoItem } = await conexao.query(
      "select has_table_privilege('amassa_app', 'itens_catalogo', 'delete') as pode_deletar",
    );
    afirmar(
      deleteDoItem[0].pode_deletar === false,
      "O papel amassa_app não deveria ter delete em itens_catalogo — item com histórico se desativa, nunca se apaga.",
    );
  } finally {
    await apagarDadosDeProvaDoEstoque(conexao, { itemIds, documentoIds, ordemIds, usuarioId });
  }
}

// Espera até a conexão `pid` estar parada numa trava — é o que garante que "B pediu a trava e
// está esperando" antes de A seguir, sem depender de `setTimeout` e sorte.
async function esperarBloqueada(observador, pid, contexto) {
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const { rows } = await observador.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${contexto}: a conexão ${pid} deveria estar esperando uma trava, e não ficou.`);
}

// Nunca deixar uma promessa pendente rejeitar sem dono (o Node derrubaria o processo): toda
// consulta que fica esperando uma trava vira { ok, erro } no instante em que é criada.
function semRejeicaoSolta(promessa) {
  return promessa.then(
    (resultado) => ({ ok: true, resultado }),
    (erro) => ({ ok: false, erro }),
  );
}

// Plano 06-02, Tarefa 2 — duas conexões de verdade, no molde de
// `conferirNumeracaoConcorrenteDeOrcamento`. A trava é a MESMA consulta de
// `lib/estoque/gravacao.ts::travarItens`: uma consulta, ids em ordem, `for no key update`.
async function conferirConcorrenciaDoEstoque(url = process.env.DATABASE_URL_TESTE) {
  console.log("  conferirConcorrenciaDoEstoque...");

  const TRAVA_NO_KEY_UPDATE =
    "select id from itens_catalogo where id = any($1::uuid[]) order by id for no key update";
  const TRAVA_EXCLUSIVA = "select id from itens_catalogo where id = any($1::uuid[]) order by id for update";

  const conexaoA = new Client({ connectionString: url });
  const conexaoB = new Client({ connectionString: url });
  const observador = new Client({ connectionString: url });
  await Promise.all([conexaoA.connect(), conexaoB.connect(), observador.connect()]);
  const pidA = (await conexaoA.query("select pg_backend_pid() as pid")).rows[0].pid;
  const pidB = (await conexaoB.query("select pg_backend_pid() as pid")).rows[0].pid;

  let usuarioId = null;
  const itemIds = [];
  const documentoIds = [];

  try {
    const { rows: usuarioInserido } = await observador.query(
      `insert into usuarios (nome, email, senha_hash)
       values ('Usuária de Teste da Concorrência do Estoque', 'usuaria-estoque-concorrencia@exemplo.test', 'hash-fake-de-teste')
       returning id`,
    );
    usuarioId = usuarioInserido[0].id;
    const categoriaCompraId = (
      await observador.query("select id from categorias where nome = 'Argila, esmalte e insumos'")
    ).rows[0].id;
    const categoriaVendaId = (
      await observador.query("select id from categorias where nome = 'Peças prontas'")
    ).rows[0].id;
    const { rows: itemInserido } = await observador.query(
      `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id, aparece_na_venda, categoria_venda_id)
       values ('Argila de prova da concorrência (migração)', true, 'kg', $1, true, $2) returning id`,
      [categoriaCompraId, categoriaVendaId],
    );
    const itemX = itemInserido[0].id;
    itemIds.push(itemX);
    // 10 kg por R$ 50,00: R$ 0,50 por 1000 milésimos — toda baixa abaixo em milhares é exata.
    await inserirMovimentacao(observador, {
      item_id: itemX,
      registrado_por: usuarioId,
      origem: "manual",
      tipo: "entrada",
      quantidade_milesimos: 10000,
      valor_centavos: 5000,
      valor_informado_centavos: 5000,
    });

    async function abrirVenda(conexao) {
      await conexao.query("begin");
      const venda = await inserirDocumentoComItem(conexao, {
        tipo: "venda",
        itemId: itemX,
        categoriaId: categoriaVendaId,
        usuarioId,
        valor: 1000,
      });
      documentoIds.push(venda.documentoId);
      return venda;
    }

    // Lê Q e V JÁ sob a trava e grava a saída da venda ao custo médio do instante.
    async function gravarSaidaDaVenda(conexao, venda, milesimos) {
      const estado = await estadoDoItemNoLivro(conexao, itemX);
      await inserirMovimentacao(conexao, {
        item_id: itemX,
        registrado_por: usuarioId,
        origem: "venda",
        tipo: "saida",
        area: "pecas",
        documento_id: venda.documentoId,
        documento_linha_id: venda.linhaId,
        quantidade_milesimos: -milesimos,
        valor_centavos: -Math.round((milesimos * estado.v) / estado.q),
      });
      return estado;
    }

    // Ajuste para o contado C: d = C − Q lido sob a trava (D-18), ao custo médio do instante.
    async function gravarAjuste(conexao, contadoMilesimos) {
      const estado = await estadoDoItemNoLivro(conexao, itemX);
      const diferenca = contadoMilesimos - estado.q;
      afirmar(diferenca !== 0, "A prova do ajuste precisa de uma diferença diferente de zero.");
      await inserirMovimentacao(conexao, {
        item_id: itemX,
        registrado_por: usuarioId,
        origem: "manual",
        tipo: "ajuste",
        saldo_contado_milesimos: contadoMilesimos,
        quantidade_milesimos: diferenca,
        valor_centavos: Math.round((diferenca * estado.v) / estado.q),
      });
      return estado;
    }

    // (1) O CAMINHO ESCOLHIDO NÃO TRAVA. As duas vendas inserem a linha do MESMO item X (cada
    // uma segurando `FOR KEY SHARE` em X pela chave estrangeira); A trava X com `no key update`,
    // B pede a mesma trava e espera; A grava e comita; B segue e lê a soma JÁ com a saída de A
    // (READ COMMITTED: cada comando vê o que comitou antes dele), grava a sua e comita.
    const inicio = await estadoDoItemNoLivro(observador, itemX);
    const vendaA = await abrirVenda(conexaoA);
    const vendaB = await abrirVenda(conexaoB);
    await conexaoA.query(TRAVA_NO_KEY_UPDATE, [[itemX]]);
    const travaB = semRejeicaoSolta(conexaoB.query(TRAVA_NO_KEY_UPDATE, [[itemX]]));
    await esperarBloqueada(observador, pidB, "Venda × venda (no key update)");
    await gravarSaidaDaVenda(conexaoA, vendaA, 2000);
    await conexaoA.query("commit");
    const resultadoTravaB = await travaB;
    afirmar(
      resultadoTravaB.ok,
      `A segunda venda deveria conseguir a trava depois de a primeira comitar — veio ${resultadoTravaB.erro?.code} (${resultadoTravaB.erro?.message}). Um 40P01 aqui é o impasse do Pitfall 2.`,
    );
    const vistoPorB = await gravarSaidaDaVenda(conexaoB, vendaB, 3000);
    await conexaoB.query("commit");
    afirmar(
      vistoPorB.q === inicio.q - 2000,
      `Sob a trava, a segunda venda deveria ler o saldo JÁ com a saída da primeira (${inicio.q - 2000}), leu ${vistoPorB.q}.`,
    );
    const depoisDasVendas = await estadoDoItemNoLivro(observador, itemX);
    afirmar(
      depoisDasVendas.q === inicio.q - 5000,
      `Duas vendas concorrentes de 2000 e 3000 milésimos deveriam deixar ${inicio.q - 5000}, deixaram ${depoisDasVendas.q}.`,
    );
    afirmar(
      depoisDasVendas.v === inicio.v - 2500,
      `As duas saídas ao custo médio (R$ 0,50 por 1000) deveriam tirar 2500 centavos do valor, o valor ficou ${depoisDasVendas.v} (era ${inicio.v}).`,
    );

    // (2) O CONTROLE: a mesma sequência pedindo o bloqueio exclusivo de linha (`for update`).
    // A pede e espera o `FOR KEY SHARE` de B; B pede e espera o de A — ciclo, e o Postgres
    // derruba uma das duas com 40P01. É por isto que `gravacao.ts` usa `no key update` —
    // Pitfall 2; suposição A1 da pesquisa provada. Nada aqui comita.
    await abrirVenda(conexaoA);
    await abrirVenda(conexaoB);
    const travaExclusivaA = semRejeicaoSolta(conexaoA.query(TRAVA_EXCLUSIVA, [[itemX]]));
    await esperarBloqueada(observador, pidA, "Controle com for update");
    const travaExclusivaB = semRejeicaoSolta(conexaoB.query(TRAVA_EXCLUSIVA, [[itemX]]));
    const [resultadoA, resultadoB] = await Promise.all([travaExclusivaA, travaExclusivaB]);
    await conexaoA.query("rollback");
    await conexaoB.query("rollback");
    const codigosDoControle = [resultadoA, resultadoB].map((resultado) =>
      resultado.ok ? "ok" : resultado.erro.code,
    );
    afirmar(
      codigosDoControle.filter((codigo) => codigo === "40P01").length === 1 &&
        codigosDoControle.filter((codigo) => codigo === "ok").length === 1,
      `Com "for update", uma das duas vendas deveria terminar em impasse (40P01) e a outra seguir — vieram A=${codigosDoControle[0]}, B=${codigosDoControle[1]}.`,
    );
    const depoisDoControle = await estadoDoItemNoLivro(observador, itemX);
    afirmar(
      depoisDoControle.q === depoisDasVendas.q,
      "O controle do impasse foi todo revertido — o saldo não deveria ter mudado.",
    );

    // (3) AJUSTE × VENDA (EST-07/EST-08, D-18) — nas duas ordens o final é determinístico.
    // Ordem 1: o ajuste trava primeiro e leva o saldo ao contado C; a venda, que esperava, baixa
    // depois. Final = C − venda.
    const CONTADO_1 = 8000;
    await conexaoA.query("begin");
    await conexaoA.query(TRAVA_NO_KEY_UPDATE, [[itemX]]);
    const vendaDepoisDoAjuste = await abrirVenda(conexaoB);
    const travaDaVenda = semRejeicaoSolta(conexaoB.query(TRAVA_NO_KEY_UPDATE, [[itemX]]));
    await esperarBloqueada(observador, pidB, "Ajuste antes da venda");
    await gravarAjuste(conexaoA, CONTADO_1);
    await conexaoA.query("commit");
    const resultadoTravaDaVenda = await travaDaVenda;
    afirmar(
      resultadoTravaDaVenda.ok,
      `A venda deveria conseguir a trava depois do ajuste — veio ${resultadoTravaDaVenda.erro?.code}.`,
    );
    await gravarSaidaDaVenda(conexaoB, vendaDepoisDoAjuste, 1000);
    await conexaoB.query("commit");
    const depoisDaOrdem1 = await estadoDoItemNoLivro(observador, itemX);
    afirmar(
      depoisDaOrdem1.q === CONTADO_1 - 1000,
      `Ajuste para ${CONTADO_1} seguido de venda de 1000 deveria deixar ${CONTADO_1 - 1000}, deixou ${depoisDaOrdem1.q}.`,
    );

    // Ordem 2: a venda trava primeiro e baixa; o ajuste, que esperava, lê o saldo JÁ baixado e
    // leva ao contado. Final = C, exato.
    const CONTADO_2 = 9000;
    const vendaAntesDoAjuste = await abrirVenda(conexaoB);
    await conexaoB.query(TRAVA_NO_KEY_UPDATE, [[itemX]]);
    await conexaoA.query("begin");
    const travaDoAjuste = semRejeicaoSolta(conexaoA.query(TRAVA_NO_KEY_UPDATE, [[itemX]]));
    await esperarBloqueada(observador, pidA, "Venda antes do ajuste");
    await gravarSaidaDaVenda(conexaoB, vendaAntesDoAjuste, 1000);
    await conexaoB.query("commit");
    const resultadoTravaDoAjuste = await travaDoAjuste;
    afirmar(
      resultadoTravaDoAjuste.ok,
      `O ajuste deveria conseguir a trava depois da venda — veio ${resultadoTravaDoAjuste.erro?.code}.`,
    );
    const vistoPeloAjuste = await gravarAjuste(conexaoA, CONTADO_2);
    await conexaoA.query("commit");
    afirmar(
      vistoPeloAjuste.q === depoisDaOrdem1.q - 1000,
      `Sob a trava, o ajuste deveria ler o saldo JÁ baixado pela venda (${depoisDaOrdem1.q - 1000}), leu ${vistoPeloAjuste.q}.`,
    );
    const depoisDaOrdem2 = await estadoDoItemNoLivro(observador, itemX);
    afirmar(
      depoisDaOrdem2.q === CONTADO_2,
      `Venda seguida de ajuste para ${CONTADO_2} deveria deixar exatamente ${CONTADO_2}, deixou ${depoisDaOrdem2.q}.`,
    );
  } finally {
    await conexaoA.query("rollback").catch(() => {});
    await conexaoB.query("rollback").catch(() => {});
    // Os documentos das transações revertidas nunca existiram; apagar id inexistente não custa.
    await apagarDadosDeProvaDoEstoque(observador, { itemIds, documentoIds, usuarioId });
    await Promise.all([conexaoA.end(), conexaoB.end(), observador.end()]);
  }
}

// Retrato do CONTEÚDO das três tabelas da Abertura (contagem embutida no próprio JSON, ordenado
// por id) — comparado antes/depois da prova da virada para confirmar que o script de importação
// (04.4-04-PLAN.md, Tarefa 2) só LÊ `abertura_itens` e nunca escreve em tabela nenhuma da
// Abertura (T-04.4-26).
async function retratoDaAbertura(cliente) {
  // Sequencial, nunca `Promise.all` — `cliente` é um `pg.Client` de conexão única (não um
  // `Pool`), e disparar consultas concorrentes nele produz o aviso de depreciação "already
  // executing a query" e, sob transação/gatilho adiado, pode intercalar de um jeito que confunde
  // o servidor sobre qual consulta pertence a qual instrução.
  const itens = await cliente.query(
    `select id, nome, categoria, valor_centavos, forma_pagamento, parcelas, primeira_parcela_em,
            entrega_prevista_em, resolvido
     from abertura_itens order by id`,
  );
  const tarefas = await cliente.query(
    `select id, descricao, grupo, prazo_em, responsavel_id, item_id, concluida
     from abertura_tarefas order by id`,
  );
  const configuracao = await cliente.query(
    "select id, inauguracao_em from abertura_configuracao order by id",
  );
  return JSON.stringify({ itens: itens.rows, tarefas: tarefas.rows, configuracao: configuracao.rows });
}

// Roda `npm run importar-parcelas-abertura` como processo filho DE VERDADE (não reimplementa a
// lógica) e devolve o código de saída e a saída capturada mesmo quando o script recusa (código
// diferente de zero) — ao contrário de `rodarNpmCapturado`, que deixa o `execSync` lançar.
// Nenhum argumento usado nesta prova tem espaço, então nenhuma citação extra é necessária (mesma
// disciplina de `rodarNpmCapturado`, que já monta os argumentos como uma lista simples).
function rodarScriptDaVirada(argumentos, opcoes = {}) {
  const comando = `npm run importar-parcelas-abertura -- ${argumentos.join(" ")}`;
  try {
    const stdout = execSync(comando, { stdio: ["ignore", "pipe", "pipe"], ...opcoes }).toString();
    return { codigoDeSaida: 0, stdout };
  } catch (erro) {
    return {
      codigoDeSaida: typeof erro.status === "number" ? erro.status : 1,
      stdout: erro.stdout ? erro.stdout.toString() : "",
    };
  }
}

// Fase 04.4 — Financeiro (04.4-04-PLAN.md, Tarefa 2, briefing §7): prova a virada de ponta a
// ponta, rodando o script de verdade. Semeia um gestor e quatro itens de Abertura (nomes
// inventados e genéricos — o repositório é público): móveis a prazo em 10x começando seis meses
// antes da virada (entram as parcelas 7 a 10), material a prazo em 3x começando um mês antes
// (entram as parcelas 2 e 3), um equipamento à vista já quitado antes da virada (deveria ser
// ignorado) e uma obra à vista depois da virada (documento de uma parcela só, sem rótulo). Usa as
// categorias "Argila, esmalte e insumos" (grupo custo) e "Equipamento e obra" (grupo fora) já
// semeadas pela migração 0016 — os padrões do próprio script — sem precisar de
// `--categoria-material`/`--categoria-demais`.
async function conferirImportacaoDaVirada(cliente, url) {
  console.log("  conferirImportacaoDaVirada...");

  const envDoBancoDeTeste = { ...process.env, DATABASE_URL: url };
  const DATA_DA_VIRADA = "2026-07-01";
  const EMAIL_AUTOR = "gestora-de-teste-plano-04@exemplo.test";

  const { rows: gestorInserido } = await cliente.query(
    `insert into usuarios (nome, email, senha_hash) values
     ('Gestora de Teste do Plano 04', $1, 'hash-fake-de-teste') returning id`,
    [EMAIL_AUTOR],
  );
  const idDoGestor = gestorInserido[0].id;

  const { rows: configuracaoDaAberturaInserida } = await cliente.query(
    "insert into abertura_configuracao (inauguracao_em) values ('2026-12-01') returning id",
  );
  afirmar(
    configuracaoDaAberturaInserida.length === 1,
    "A semeadura de abertura_configuracao não inseriu a linha esperada.",
  );

  async function semearItemDaAbertura({
    nome,
    categoria,
    valorCentavos,
    formaPagamento,
    parcelas,
    primeiraParcelaEm,
  }) {
    const { rows } = await cliente.query(
      `insert into abertura_itens
         (nome, categoria, valor_centavos, forma_pagamento, parcelas, primeira_parcela_em)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [nome, categoria, valorCentavos, formaPagamento, parcelas, primeiraParcelaEm],
    );
    return rows[0].id;
  }

  const idMoveis = await semearItemDaAbertura({
    nome: "Item de móveis inventado (plano 04.4-04)",
    categoria: "moveis",
    valorCentavos: 1000000,
    formaPagamento: "prazo",
    parcelas: 10,
    primeiraParcelaEm: "2026-01-01",
  });
  const idMaterial = await semearItemDaAbertura({
    nome: "Item de material inventado (plano 04.4-04)",
    categoria: "material",
    valorCentavos: 300000,
    formaPagamento: "prazo",
    parcelas: 3,
    primeiraParcelaEm: "2026-06-01",
  });
  const idEquipamentoQuitado = await semearItemDaAbertura({
    nome: "Item de equipamento já quitado (plano 04.4-04)",
    categoria: "equipamentos",
    valorCentavos: 80000,
    formaPagamento: "vista",
    parcelas: 1,
    primeiraParcelaEm: "2026-05-01",
  });
  const idObra = await semearItemDaAbertura({
    nome: "Item de obra inventado (plano 04.4-04)",
    categoria: "obra",
    valorCentavos: 50000,
    formaPagamento: "vista",
    parcelas: 1,
    primeiraParcelaEm: "2026-08-01",
  });

  await cliente.query(
    `insert into abertura_tarefas (descricao, grupo, prazo_em, item_id) values
     ('Conferir a instalação (plano 04.4-04)', 'montagem', '2026-06-01', $1)`,
    [idMoveis],
  );

  const retratoAntes = await retratoDaAbertura(cliente);

  // 1. Ensaio (sem --aplicar): a frase do ensaio aparece, zero documentos gravados.
  const ensaio = rodarScriptDaVirada(
    ["--data-da-virada", DATA_DA_VIRADA, "--autor", EMAIL_AUTOR],
    { env: envDoBancoDeTeste },
  );
  afirmar(
    ensaio.codigoDeSaida === 0,
    `O ensaio (sem --aplicar) deveria sair 0, saiu ${ensaio.codigoDeSaida}.\nSaída:\n${ensaio.stdout}`,
  );
  afirmar(
    ensaio.stdout.includes("Nada foi gravado (ensaio). Rode de novo com --aplicar para gravar."),
    `O ensaio deveria terminar com a frase de ensaio. Saída:\n${ensaio.stdout}`,
  );
  const { rows: documentosAposEnsaio } = await cliente.query(
    "select count(*)::int as total from documentos where chave_de_importacao like 'abertura:%'",
  );
  afirmar(
    documentosAposEnsaio[0].total === 0,
    "O ensaio (sem --aplicar) não deveria gravar nenhum documento.",
  );

  // 2. Aplicação: os documentos esperados, com rótulo/categoria/soma corretos; saldo inicial e
  // data gravados; a Abertura continua idêntica (T-04.4-26).
  const aplicacao = rodarScriptDaVirada(
    [
      "--data-da-virada",
      DATA_DA_VIRADA,
      "--autor",
      EMAIL_AUTOR,
      "--saldo-inicial",
      "1.000,00",
      "--aplicar",
    ],
    { env: envDoBancoDeTeste },
  );
  afirmar(
    aplicacao.codigoDeSaida === 0,
    `A aplicação deveria sair 0, saiu ${aplicacao.codigoDeSaida}.\nSaída:\n${aplicacao.stdout}`,
  );

  const { rows: documentosGravados } = await cliente.query(
    `select d.id, d.chave_de_importacao, c.grupo as categoria_grupo
     from documentos d
     join documento_linhas dl on dl.documento_id = d.id
     join categorias c on c.id = dl.categoria_id
     where d.chave_de_importacao like 'abertura:%'
     order by d.chave_de_importacao`,
  );
  afirmar(
    documentosGravados.length === 3,
    "Deveriam existir 3 documentos importados (móveis, material, obra — o de equipamentos foi " +
      `quitado antes da virada), vieram ${documentosGravados.length}.`,
  );

  const documentoMoveis = documentosGravados.find(
    (linha) => linha.chave_de_importacao === `abertura:${idMoveis}`,
  );
  const documentoMaterial = documentosGravados.find(
    (linha) => linha.chave_de_importacao === `abertura:${idMaterial}`,
  );
  const documentoObra = documentosGravados.find(
    (linha) => linha.chave_de_importacao === `abertura:${idObra}`,
  );
  afirmar(
    Boolean(documentoMoveis) && Boolean(documentoMaterial) && Boolean(documentoObra),
    "Um dos três documentos esperados (móveis, material, obra) não foi encontrado.",
  );
  afirmar(
    documentosGravados.every((linha) => linha.chave_de_importacao !== `abertura:${idEquipamentoQuitado}`),
    "O item de equipamento já quitado antes da virada não deveria ter virado documento.",
  );

  afirmar(
    documentoMoveis.categoria_grupo === "fora",
    `O documento de móveis deveria cair na categoria dos demais (grupo "fora"), veio "${documentoMoveis.categoria_grupo}".`,
  );
  afirmar(
    documentoMaterial.categoria_grupo === "custo",
    `O documento de material deveria cair na categoria de material (grupo "custo"), veio "${documentoMaterial.categoria_grupo}".`,
  );
  afirmar(
    documentoObra.categoria_grupo === "fora",
    `O documento de obra deveria cair na categoria dos demais (grupo "fora"), veio "${documentoObra.categoria_grupo}".`,
  );

  const { rows: parcelasDoMoveis } = await cliente.query(
    "select rotulo, valor_centavos, forma from parcelas where documento_id = $1 order by numero",
    [documentoMoveis.id],
  );
  afirmar(
    parcelasDoMoveis.length === 4,
    `O documento de móveis deveria ter 4 parcelas em aberto (7 a 10 de 10), veio ${parcelasDoMoveis.length}.`,
  );
  afirmar(
    JSON.stringify(parcelasDoMoveis.map((parcela) => parcela.rotulo)) ===
      JSON.stringify(["7 de 10", "8 de 10", "9 de 10", "10 de 10"]),
    "Os rótulos das parcelas de móveis deveriam ser \"7 de 10\"..\"10 de 10\", vieram " +
      JSON.stringify(parcelasDoMoveis.map((parcela) => parcela.rotulo)) +
      ".",
  );
  afirmar(
    parcelasDoMoveis.every((parcela) => parcela.forma === "pix"),
    "As parcelas importadas deveriam ter a forma prevista pix (suposição 4 do plano).",
  );
  const somaMoveis = parcelasDoMoveis.reduce((total, parcela) => total + parcela.valor_centavos, 0);
  afirmar(somaMoveis === 400000, `A soma das parcelas de móveis deveria ser 400000, veio ${somaMoveis}.`);

  const { rows: parcelasDoMaterial } = await cliente.query(
    "select rotulo, valor_centavos from parcelas where documento_id = $1 order by numero",
    [documentoMaterial.id],
  );
  afirmar(
    JSON.stringify(parcelasDoMaterial.map((parcela) => parcela.rotulo)) ===
      JSON.stringify(["2 de 3", "3 de 3"]),
    "Os rótulos das parcelas de material deveriam ser \"2 de 3\" e \"3 de 3\", vieram " +
      JSON.stringify(parcelasDoMaterial.map((parcela) => parcela.rotulo)) +
      ".",
  );
  const somaMaterial = parcelasDoMaterial.reduce((total, parcela) => total + parcela.valor_centavos, 0);
  afirmar(
    somaMaterial === 200000,
    `A soma das parcelas de material deveria ser 200000, veio ${somaMaterial}.`,
  );

  const { rows: parcelasDaObra } = await cliente.query(
    "select rotulo, valor_centavos from parcelas where documento_id = $1",
    [documentoObra.id],
  );
  afirmar(parcelasDaObra.length === 1, "O documento de obra deveria ter uma parcela só (item à vista).");
  afirmar(parcelasDaObra[0].rotulo === null, "A parcela do item à vista não deveria ter rótulo.");
  afirmar(
    parcelasDaObra[0].valor_centavos === 50000,
    `A parcela de obra deveria valer 50000, veio ${parcelasDaObra[0].valor_centavos}.`,
  );

  const { rows: configuracaoGravada } = await cliente.query(
    "select saldo_inicial_centavos, data_saldo_inicial::text as data_saldo_inicial from configuracao_financeira where linha_unica = true",
  );
  afirmar(configuracaoGravada.length === 1, "A configuração financeira (saldo inicial) não foi gravada.");
  afirmar(
    configuracaoGravada[0].saldo_inicial_centavos === 100000,
    `O saldo inicial gravado deveria ser 100000 centavos, veio ${configuracaoGravada[0].saldo_inicial_centavos}.`,
  );
  afirmar(
    configuracaoGravada[0].data_saldo_inicial === DATA_DA_VIRADA,
    `A data do saldo inicial deveria ser ${DATA_DA_VIRADA}, veio ${configuracaoGravada[0].data_saldo_inicial}.`,
  );

  const retratoDepoisDaAplicacao = await retratoDaAbertura(cliente);
  afirmar(
    retratoDepoisDaAplicacao === retratoAntes,
    "O conteúdo das tabelas da Abertura mudou depois da aplicação — o script deveria só LER a Abertura.",
  );

  // 3. Idempotência (T-04.4-27): rodar de novo com --aplicar não cria documento novo.
  const segundaAplicacao = rodarScriptDaVirada(
    [
      "--data-da-virada",
      DATA_DA_VIRADA,
      "--autor",
      EMAIL_AUTOR,
      "--saldo-inicial",
      "1.000,00",
      "--aplicar",
    ],
    { env: envDoBancoDeTeste },
  );
  afirmar(
    segundaAplicacao.codigoDeSaida === 0,
    `A segunda aplicação deveria sair 0, saiu ${segundaAplicacao.codigoDeSaida}.\nSaída:\n${segundaAplicacao.stdout}`,
  );
  const { rows: documentosAposSegundaAplicacao } = await cliente.query(
    "select count(*)::int as total from documentos where chave_de_importacao like 'abertura:%'",
  );
  afirmar(
    documentosAposSegundaAplicacao[0].total === 3,
    "A segunda aplicação não deveria criar documento novo — esperado 3, veio " +
      `${documentosAposSegundaAplicacao[0].total}.`,
  );

  // 4. Guarda (T-04.4-28): parcela paga, de documento não cancelado, com pago_em antes da
  // virada — o script recusa, sai diferente de zero e não grava nada a mais.
  const { rows: categoriaReceita } = await cliente.query(
    "select id from categorias where nome = 'Uso do espaço'",
  );
  // Numa transação só — a restrição adiada `conferir_soma_do_documento()` (migração 0015) só
  // confere no COMMIT; sem `begin`/`commit` explícitos, cada `insert` seria seu próprio
  // autocommit e o primeiro (documento sem linha nem parcela ainda) seria recusado na hora.
  await cliente.query("begin");
  let idDaVendaAnterior;
  try {
    const { rows: vendaAnteriorInserida } = await cliente.query(
      "insert into documentos (tipo, data, criado_por) values ('venda', '2026-06-15', $1) returning id",
      [idDoGestor],
    );
    idDaVendaAnterior = vendaAnteriorInserida[0].id;
    await cliente.query(
      `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
       values ($1, 1, 'Venda de teste anterior à virada (plano 04.4-04)', $2, 15000)`,
      [idDaVendaAnterior, categoriaReceita[0].id],
    );
    await cliente.query(
      `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
       values ($1, 1, '2026-06-15', 15000, 'pix', '2026-06-15', $2)`,
      [idDaVendaAnterior, idDoGestor],
    );
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    throw erro;
  }

  const terceiraAplicacao = rodarScriptDaVirada(
    [
      "--data-da-virada",
      DATA_DA_VIRADA,
      "--autor",
      EMAIL_AUTOR,
      "--saldo-inicial",
      "9.999,00",
      "--aplicar",
    ],
    { env: envDoBancoDeTeste },
  );
  afirmar(
    terceiraAplicacao.codigoDeSaida !== 0,
    "O script deveria recusar aplicar com uma parcela paga antes da virada em documento não cancelado.",
  );
  const { rows: configuracaoAposRecusa } = await cliente.query(
    "select saldo_inicial_centavos from configuracao_financeira where linha_unica = true",
  );
  afirmar(
    configuracaoAposRecusa[0].saldo_inicial_centavos === 100000,
    "O saldo inicial não deveria ter mudado depois de uma aplicação recusada pela guarda de " +
      "pagamento anterior à virada.",
  );
  const { rows: documentosAposRecusa } = await cliente.query(
    "select count(*)::int as total from documentos where chave_de_importacao like 'abertura:%'",
  );
  afirmar(
    documentosAposRecusa[0].total === 3,
    "Nenhum documento novo deveria ter sido criado numa aplicação recusada pela guarda.",
  );

  const retratoFinal = await retratoDaAbertura(cliente);
  afirmar(
    retratoFinal === retratoAntes,
    "O conteúdo das tabelas da Abertura mudou depois de toda a prova — o script nunca escreve na Abertura.",
  );
}

// A prova da virada roda o script de importação DE VERDADE, com `--aplicar`. Por isso ela roda
// num banco só dela, criado aqui e apagado no fim — a mesma razão de `provarRemocaoEmBancoProprio`
// (ver o comentário longo acima dela): não pode compartilhar o banco dos outros passos.
async function provarViradaEmBancoProprio() {
  const url = new URL(process.env.DATABASE_URL_TESTE);
  const bancoOriginal = url.pathname.slice(1);
  const bancoDaProva = `${bancoOriginal}_virada`;

  const urlAdmin = new URL(url);
  urlAdmin.pathname = "/postgres";
  const urlDaProva = new URL(url);
  urlDaProva.pathname = `/${bancoDaProva}`;

  const admin = new Client({ connectionString: urlAdmin.toString() });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${bancoDaProva}"`);
    await admin.query(`create database "${bancoDaProva}"`);
  } finally {
    await admin.end();
  }

  try {
    console.log(`Provando a virada em banco proprio ("${bancoDaProva}")...`);
    rodarNpm("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: urlDaProva.toString() },
    });
    const cliente = new Client({ connectionString: urlDaProva.toString() });
    await cliente.connect();
    try {
      await conferirImportacaoDaVirada(cliente, urlDaProva.toString());
    } finally {
      await cliente.end();
    }
  } finally {
    const faxina = new Client({ connectionString: urlAdmin.toString() });
    await faxina.connect();
    try {
      await faxina.query(`drop database if exists "${bancoDaProva}"`);
    } finally {
      await faxina.end();
    }
  }
}

// ————————————————————————————————————————————————————————————————————————————————————————————
// Fase 06.1 — Produção (06.1-02-PLAN.md, Tarefa 2). Duas provas:
//
// `conferirProducao` — no banco comum, as invariantes das três tabelas novas (checks, uniques,
// o `revoke delete` para `amassa_app`, os três gatilhos `tocar_atualizado_em_*`) e os checks
// novos do livro do Estoque. Dado de prova com "[migracao]" no nome, apagado no fim pela conexão
// de DONO (o `revoke` vale só para `amassa_app`).
//
// `provarMigracaoDaProducaoEmBancoProprio` — o dado do D-02 sobre dado EXISTENTE. O banco comum
// sobe vazio e recebe todas as migrações de uma vez, então nunca tem um orçamento aprovado antes
// da 0024; a prova precisa de um banco próprio onde 0000..0023 são aplicadas à mão, o dado é
// semeado e só então a 0024 roda.
// ————————————————————————————————————————————————————————————————————————————————————————————

// SQLSTATE e nome da restrição de uma promessa que deveria falhar — `codigo: null` quando ela
// passa. Pelo `pg` puro (o Drizzle é que embrulha em `erro.cause`).
async function erroDoBanco(executar) {
  try {
    await executar();
    return { codigo: null, restricao: null };
  } catch (erro) {
    return {
      codigo: erro.code ?? `sem código (${erro.message})`,
      restricao: erro.constraint ?? null,
    };
  }
}

// Os previstos que a 0024 grava no bloco (b) do D-02 — HISTÓRICOS (esmaltação 1, queima de esmalte
// 4), não a constante `DIAS_PREVISTOS_PADRAO`: o dono trocou o par para 4/1 em 01/10/2026, depois
// de a 0024 já estar aplicada (30/09, 0 ordens convertidas em produção), e migração aplicada não
// se edita. A prova do D-02 confere o que a 0024 escreve, por isso compara com estes números;
// `tests/unit/producao-etapas.test.ts` fixa o texto da 0024 nos mesmos seis pares.
const ETAPAS_COMPLETO_DA_PROVA = [
  ["producao", 0, 5],
  ["secagem", 1, 15],
  ["queima1", 2, 1],
  ["esmaltacao", 3, 1],
  ["queima2", 4, 4],
  ["entrega", 5, 6],
];
const ETAPAS_BISCOITO_DA_PROVA = [
  ["producao", 0, 5],
  ["secagem", 1, 15],
  ["queima1", 2, 1],
  ["entrega", 3, 6],
];

// Um carimbo antigo, gravado no `insert` (que não tem gatilho): se o `update` seguinte o trocar, foi
// o gatilho `tocar_atualizado_em_*` — sem depender de dois `now()` caírem em instantes diferentes.
const CARIMBO_ANTIGO = "2000-01-01T00:00:00Z";

async function apagarDadosDeProvaDaProducao(conexao, { itemIds, ordemIds, usuarioId }) {
  try {
    await conexao.query("begin");
    await conexao.query("delete from movimentacoes_estoque where item_id = any($1::uuid[])", [itemIds]);
    await conexao.query("delete from itens_catalogo where id = any($1::uuid[])", [itemIds]);
    await conexao.query("delete from ordem_pecas where ordem_id = any($1::uuid[])", [ordemIds]);
    await conexao.query("delete from ordem_etapas where ordem_id = any($1::uuid[])", [ordemIds]);
    await conexao.query("delete from ordens_producao where id = any($1::uuid[])", [ordemIds]);
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado — mesma razão da faxina do Estoque.
    console.error(`Produção: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

async function conferirProducao(conexao) {
  console.log("  conferirProducao...");

  const { rows: usuarioInserido } = await conexao.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste da Produção [migracao]', 'usuaria-producao@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;
  const ordemIds = [];
  const itemIds = [];

  async function comoAmassaApp(sql, parametros) {
    await conexao.query("begin");
    try {
      await conexao.query("set local role amassa_app");
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }

  async function semearEtapas(ordemId, etapas) {
    for (const [etapa, posicao, dias] of etapas) {
      await conexao.query(
        `insert into ordem_etapas (ordem_id, etapa, posicao, dias_previstos, atualizado_em)
         values ($1, $2, $3, $4, $5)`,
        [ordemId, etapa, posicao, dias, CARIMBO_ANTIGO],
      );
    }
  }

  try {
    // Uma ordem da casa ATIVA (com início, caminho que termina no biscoito — quatro etapas, o que
    // deixa a posição 4 livre para isolar a recusa da etapa repetida) e uma encomenda AGUARDANDO
    // o sinal (sem início, caminho completo), cada uma com as etapas; a da casa com uma peça.
    const { rows: casaInserida } = await conexao.query(
      `insert into ordens_producao (tipo, caminho, status, nome, inicio, criado_por, atualizado_em)
       values ('casa', 'biscoito', 'ativa', '[migracao] Ordem da casa', current_date, $1, $2)
       returning id`,
      [usuarioId, CARIMBO_ANTIGO],
    );
    const casaId = casaInserida[0].id;
    ordemIds.push(casaId);
    const { rows: aguardandoInserida } = await conexao.query(
      `insert into ordens_producao (tipo, caminho, status, nome, cliente_nome, entrega_prometida, criado_por)
       values ('encomenda', 'completo', 'aguardando_sinal', '[migracao] Encomenda aguardando',
               'Cliente de prova [migracao]', current_date + 40, $1)
       returning id, inicio`,
      [usuarioId],
    );
    const aguardandoId = aguardandoInserida[0].id;
    ordemIds.push(aguardandoId);
    afirmar(
      aguardandoInserida[0].inicio === null,
      "Uma ordem aguardando o sinal deveria nascer sem início.",
    );
    await semearEtapas(casaId, ETAPAS_BISCOITO_DA_PROVA);
    await semearEtapas(aguardandoId, ETAPAS_COMPLETO_DA_PROVA);
    const { rows: pecaInserida } = await conexao.query(
      `insert into ordem_pecas (ordem_id, posicao, descricao, quantidade, a_mais, atualizado_em)
       values ($1, 0, '[migracao] Caneca de prova', 10, 2, $2)
       returning id`,
      [casaId, CARIMBO_ANTIGO],
    );
    const pecaId = pecaInserida[0].id;

    // (a) As recusas das três tabelas — cada uma com o SQLSTATE E o nome da restrição que recusou,
    // para uma recusa por outro motivo não passar por esta.
    const recusas = [
      [
        "ordem aguardando o sinal COM início",
        `insert into ordens_producao (tipo, status, nome, inicio)
         values ('casa', 'aguardando_sinal', '[migracao] Recusada', current_date)`,
        [],
        "23514",
        ["ordens_producao_aguardando_sem_inicio"],
      ],
      [
        "ordem ativa SEM início",
        `insert into ordens_producao (tipo, status, nome, inicio)
         values ('casa', 'ativa', '[migracao] Recusada', null)`,
        [],
        "23514",
        ["ordens_producao_aguardando_sem_inicio"],
      ],
      [
        "ordem concluída SEM início",
        `insert into ordens_producao (tipo, status, nome, inicio, concluida_em)
         values ('casa', 'concluida', '[migracao] Recusada', null, current_date)`,
        [],
        "23514",
        ["ordens_producao_aguardando_sem_inicio"],
      ],
      [
        "ordem da casa com cliente",
        `insert into ordens_producao (tipo, status, nome, inicio, cliente_nome)
         values ('casa', 'ativa', '[migracao] Recusada', current_date, 'Cliente [migracao]')`,
        [],
        "23514",
        ["ordens_producao_cliente_so_em_encomenda"],
      ],
      [
        "ordem concluída sem concluida_em",
        "update ordens_producao set status = 'concluida' where id = $1",
        [casaId],
        "23514",
        ["ordens_producao_concluida_com_data"],
      ],
      [
        "dias previstos 0",
        "update ordem_etapas set dias_previstos = 0 where ordem_id = $1 and etapa = 'secagem'",
        [casaId],
        "23514",
        ["ordem_etapas_dias_previstos_faixa"],
      ],
      [
        "dias previstos 366",
        "update ordem_etapas set dias_previstos = 366 where ordem_id = $1 and etapa = 'secagem'",
        [casaId],
        "23514",
        ["ordem_etapas_dias_previstos_faixa"],
      ],
      [
        "a mesma etapa duas vezes na mesma ordem",
        `insert into ordem_etapas (ordem_id, etapa, posicao, dias_previstos)
         values ($1, 'secagem', 4, 15)`,
        [casaId],
        "23505",
        ["ordem_etapas_ordem_etapa_uk"],
      ],
      [
        "duas etapas na mesma posição da mesma ordem",
        `insert into ordem_etapas (ordem_id, etapa, posicao, dias_previstos)
         values ($1, 'esmaltacao', 0, 1)`,
        [casaId],
        "23505",
        ["ordem_etapas_ordem_posicao_uk"],
      ],
      [
        "perdidas acima de quantidade + a mais",
        `update ordem_pecas set perdidas = quantidade + a_mais + 1, para_estoque = 0, sem_destino = 0
          where id = $1`,
        [pecaId],
        "23514",
        // As duas recusam o mesmo valor (os destinos também não cabem num total negativo).
        ["ordem_pecas_perdidas_faixa", "ordem_pecas_destinos_cabem"],
      ],
      [
        "conclusão da peça pela metade (só perdidas)",
        "update ordem_pecas set perdidas = 1 where id = $1",
        [pecaId],
        "23514",
        ["ordem_pecas_conclusao_junta"],
      ],
    ];
    for (const [descricao, sql, parametros, codigoEsperado, restricoes] of recusas) {
      const { codigo, restricao } = await erroDoBanco(() => conexao.query(sql, parametros));
      afirmar(
        codigo === codigoEsperado && restricoes.includes(restricao),
        `Produção: ${descricao} deveria ser recusada com ${codigoEsperado} por ${restricoes.join(" ou ")}, ` +
          `veio ${codigo} (${restricao}).`,
      );
    }
    // A mesma peça concluída com os três campos juntos, e cabendo, é aceita — o check não recusa tudo.
    const { codigo: codigoDaConclusaoValida } = await erroDoBanco(() =>
      conexao.query(
        "update ordem_pecas set perdidas = 1, para_estoque = 2, sem_destino = 0 where id = $1",
        [pecaId],
      ),
    );
    afirmar(
      codigoDaConclusaoValida === null,
      `Uma peça concluída com perdidas, para_estoque e sem_destino juntos, e cabendo, deveria ser aceita, veio ${codigoDaConclusaoValida}.`,
    );
    // A ordem cancelada aceita os dois inícios (06.1-06): sem início é a que caiu ainda aguardando
    // o sinal (D-07, "Cancelar ordem"); com início é a que já tinha sido liberada.
    for (const [descricao, inicio] of [
      ["SEM início (caiu aguardando o sinal)", null],
      ["COM início (já tinha sido liberada)", "2026-09-01"],
    ]) {
      const { rows: cancelada, codigo } = await conexao
        .query(
          `insert into ordens_producao (tipo, status, nome, inicio, cancelada_em, cancelada_por)
           values ('casa', 'cancelada', '[migracao] Cancelada', $1::date, now(), $2)
           returning id`,
          [inicio, usuarioId],
        )
        .then(
          (resultado) => ({ rows: resultado.rows, codigo: null }),
          (erro) => ({ rows: [], codigo: `${erro.code ?? "?"} (${erro.constraint ?? erro.message})` }),
        );
      if (cancelada[0]) ordemIds.push(cancelada[0].id);
      afirmar(
        codigo === null && cancelada.length === 1,
        `Produção: uma ordem cancelada ${descricao} deveria ser aceita, veio ${codigo}.`,
      );
    }

    // (b) Nada se apaga na Produção (T-06.1-10): `amassa_app` recebe 42501 num `delete` real de
    // cada uma das três tabelas, e as linhas continuam lá.
    for (const [tabela, coluna] of [
      ["ordens_producao", "id"],
      ["ordem_etapas", "ordem_id"],
      ["ordem_pecas", "ordem_id"],
    ]) {
      const { codigo } = await comoAmassaApp(`delete from ${tabela} where ${coluna} = $1`, [casaId]);
      afirmar(
        codigo === "42501",
        `Apagar de ${tabela}, como amassa_app, deveria falhar com 42501 (revoke delete da 0024), veio ${codigo}.`,
      );
      const { rows: privilegios } = await conexao.query(
        `select has_table_privilege('amassa_app', $1, 'select') as pode_select,
                has_table_privilege('amassa_app', $1, 'insert') as pode_insert,
                has_table_privilege('amassa_app', $1, 'update') as pode_update,
                has_table_privilege('amassa_app', $1, 'delete') as pode_delete`,
        [tabela],
      );
      const { pode_select, pode_insert, pode_update, pode_delete } = privilegios[0];
      afirmar(
        pode_select && pode_insert && pode_update && !pode_delete,
        `amassa_app deveria ter select, insert e update, e NÃO delete, em ${tabela} — veio ` +
          `select=${pode_select}, insert=${pode_insert}, update=${pode_update}, delete=${pode_delete}.`,
      );
    }
    const { rows: aindaLa } = await conexao.query(
      `select (select count(*) from ordens_producao where id = $1)::int as ordens,
              (select count(*) from ordem_etapas where ordem_id = $1)::int as etapas,
              (select count(*) from ordem_pecas where ordem_id = $1)::int as pecas`,
      [casaId],
    );
    afirmar(
      aindaLa[0].ordens === 1 && aindaLa[0].etapas === 4 && aindaLa[0].pecas === 1,
      `Depois das tentativas de apagar, a ordem, as 4 etapas e a peça deveriam continuar, veio ${JSON.stringify(aindaLa[0])}.`,
    );

    // (c) Os três gatilhos `tocar_atualizado_em_*`: um `update` que não menciona `atualizado_em`
    // troca o carimbo antigo gravado no `insert`.
    for (const [tabela, sql] of [
      [
        "ordens_producao",
        "update ordens_producao set nome = '[migracao] Ordem da casa (renomeada)' where id = $1 returning atualizado_em",
      ],
      [
        "ordem_etapas",
        "update ordem_etapas set feita_em = current_date where ordem_id = $1 and etapa = 'producao' returning atualizado_em",
      ],
      [
        "ordem_pecas",
        "update ordem_pecas set cor = 'Azul [migracao]' where ordem_id = $1 returning atualizado_em",
      ],
    ]) {
      const { rows } = await conexao.query(sql, [casaId]);
      afirmar(
        rows.length === 1 && new Date(rows[0].atualizado_em).getTime() > Date.parse("2001-01-01T00:00:00Z"),
        `O gatilho tocar_atualizado_em_${tabela} deveria ter atualizado atualizado_em num update, veio ${rows[0]?.atualizado_em}.`,
      );
    }

    // (d) Os checks novos do livro (0024). Um material de prova próprio.
    const categoriaCompraId = (
      await conexao.query("select id from categorias where nome = 'Argila, esmalte e insumos'")
    ).rows[0].id;
    const categoriaVendaId = (await conexao.query("select id from categorias where nome = 'Peças prontas'"))
      .rows[0].id;
    const { rows: itemInserido } = await conexao.query(
      `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id, aparece_na_venda, categoria_venda_id)
       values ('[migracao] Argila de prova da Produção', true, 'kg', $1, true, $2) returning id`,
      [categoriaCompraId, categoriaVendaId],
    );
    const itemId = itemInserido[0].id;
    itemIds.push(itemId);
    const base = { item_id: itemId, registrado_por: usuarioId };

    // (d.1) `material_da_ordem` numa saída de VENDA é recusado. O documento só existe dentro desta
    // transação (a soma adiada nunca chega a ser conferida): nada comita.
    await conexao.query("begin");
    let erroDoMaterialNaVenda;
    try {
      const venda = await inserirDocumentoComItem(conexao, {
        tipo: "venda",
        itemId,
        categoriaId: categoriaVendaId,
        usuarioId,
        valor: 3000,
      });
      await conexao.query("savepoint material_na_venda");
      erroDoMaterialNaVenda = await erroDoBanco(() =>
        inserirMovimentacao(conexao, {
          ...base,
          origem: "venda",
          tipo: "saida",
          area: "pecas",
          documento_id: venda.documentoId,
          documento_linha_id: venda.linhaId,
          quantidade_milesimos: -1000,
          valor_centavos: -420,
          material_da_ordem: "argila",
        }),
      );
      await conexao.query("rollback to savepoint material_na_venda");
    } finally {
      await conexao.query("rollback");
    }
    afirmar(
      erroDoMaterialNaVenda.codigo === "23514" &&
        erroDoMaterialNaVenda.restricao === "movimentacoes_estoque_material_da_ordem_so_na_baixa",
      `material_da_ordem numa saída de venda deveria ser recusado (23514, material_da_ordem_so_na_baixa), veio ${erroDoMaterialNaVenda.codigo} (${erroDoMaterialNaVenda.restricao}).`,
    );

    // (d.2) Entrada da produção sem ordem é recusada; com a ordem, aceita, e sem `motivo`.
    const entradaDaProducao = {
      ...base,
      origem: "producao",
      tipo: "entrada",
      quantidade_milesimos: 2000,
      valor_centavos: 0,
      valor_informado_centavos: 0,
    };
    const erroDaProducaoSemOrdem = await erroDoBanco(() =>
      inserirMovimentacao(conexao, entradaDaProducao),
    );
    afirmar(
      erroDaProducaoSemOrdem.codigo === "23514" &&
        erroDaProducaoSemOrdem.restricao === "movimentacoes_estoque_producao_com_ordem",
      `Uma entrada da produção sem ordem deveria ser recusada (23514, producao_com_ordem), veio ${erroDaProducaoSemOrdem.codigo} (${erroDaProducaoSemOrdem.restricao}).`,
    );
    const idEntradaDaProducao = await inserirMovimentacao(conexao, {
      ...entradaDaProducao,
      encomenda_id: casaId,
    });
    const { rows: entradaGravada } = await conexao.query(
      "select encomenda_id, motivo from movimentacoes_estoque where id = $1",
      [idEntradaDaProducao],
    );
    afirmar(
      entradaGravada[0].encomenda_id === casaId && entradaGravada[0].motivo === null,
      `A entrada da produção ligada à ordem deveria ficar com a ordem e sem motivo, veio ${JSON.stringify(entradaGravada[0])}.`,
    );

    // (d.3) A baixa "consumo em encomenda" com `material_da_ordem` e a ordem é aceita.
    const idBaixaComMaterial = await inserirMovimentacao(conexao, {
      ...base,
      origem: "manual",
      tipo: "saida",
      destino: "encomenda",
      area: "pecas",
      encomenda_id: casaId,
      material_da_ordem: "argila",
      quantidade_milesimos: -500,
      valor_centavos: 0,
    });
    const { rows: baixaGravada } = await conexao.query(
      "select encomenda_id, material_da_ordem from movimentacoes_estoque where id = $1",
      [idBaixaComMaterial],
    );
    afirmar(
      baixaGravada[0].encomenda_id === casaId && baixaGravada[0].material_da_ordem === "argila",
      `A baixa com material da ordem deveria gravar a ordem e "argila", veio ${JSON.stringify(baixaGravada[0])}.`,
    );

    // (d.4) O vínculo com a ordem continua recusado fora de "consumo em encomenda" e da produção.
    const erroDoVinculoNaAula = await erroDoBanco(() =>
      inserirMovimentacao(conexao, {
        ...base,
        origem: "manual",
        tipo: "saida",
        destino: "aula",
        area: "espaco",
        encomenda_id: casaId,
        quantidade_milesimos: -500,
        valor_centavos: 0,
      }),
    );
    afirmar(
      erroDoVinculoNaAula.codigo === "23514" &&
        erroDoVinculoNaAula.restricao ===
          "movimentacoes_estoque_ordem_so_no_destino_encomenda_ou_producao",
      `Uma saída para aula ligada a uma ordem deveria ser recusada (23514, ordem_so_no_destino_encomenda_ou_producao), veio ${erroDoVinculoNaAula.codigo} (${erroDoVinculoNaAula.restricao}).`,
    );
  } finally {
    await apagarDadosDeProvaDaProducao(conexao, { itemIds, ordemIds, usuarioId });
  }
}

// ————————————————————————————————————————————————————————————————————————————————————————————
// Fase 06.1 — as travas da Produção sob concorrência de verdade: os quatro
// `behavior_unverified_items` de 06.1-VERIFICATION.md. No molde de `conferirConcorrenciaDoEstoque`
// (Fase 06): duas conexões, transações intercaladas à mão, e `esperarBloqueada` garantindo que "B
// pediu a trava e está esperando" antes de A seguir — sem `setTimeout` e sorte.
//
// Cada ação é reproduzida pelas MESMAS consultas de trava, no MESMO modo e na MESMA ordem que o
// código emite (as constantes abaixo dizem de qual função vieram), e pelas mesmas escritas. O que a
// ação lê SEM trava (etapas, peças, categoria) fica de fora: leitura simples não trava linha e não
// muda quem espera quem. A e B rodam como `amassa_app` (`set local role`), o papel da aplicação, e
// com `lock_timeout` de 5 s: uma ordem de travas errada aparece como 40P01 (o detector de impasse
// age depois de 1 s, o `deadlock_timeout` padrão) ou como 55P03 — nunca como um processo pendurado.
// O controle do caso (1) inverte a ordem de propósito e PRECISA dar 40P01: é o que prova que a
// sonda enxergaria um impasse se a ordem do código estivesse errada.
// ————————————————————————————————————————————————————————————————————————————————————————————

const SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO = " — concorrência da produção [migracao]";

// Faxina da sonda, como DONO das tabelas (o `revoke delete` vale só para `amassa_app`). Os itens
// saem também pelo nome: o item que a promoção cria nasce numa transação da sonda, e se uma
// asserção falhar antes de o id ser anotado ele ainda precisa sair (o `@vazio-global` do
// Playwright roda depois contra o MESMO banco). Ordem: livro → peças → orçamentos → ordens →
// fichas → venda (restrições de soma desligadas, como na faxina do Estoque) → itens → usuária.
async function apagarDadosDeProvaDaConcorrenciaDaProducao(
  conexao,
  { itemIds, ordemIds, fichaIds, documentoIds, orcamentoIds, usuarioId },
) {
  try {
    await conexao.query("begin");
    const { rows: pelosNomes } = await conexao.query(
      "select id from itens_catalogo where nome like $1",
      [`%${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`],
    );
    const todosOsItens = [...new Set([...itemIds, ...pelosNomes.map((linha) => linha.id)])];
    await conexao.query(
      "delete from movimentacoes_estoque where item_id = any($1::uuid[]) or encomenda_id = any($2::uuid[])",
      [todosOsItens, ordemIds],
    );
    await conexao.query("delete from ordem_pecas where ordem_id = any($1::uuid[])", [ordemIds]);
    await conexao.query("delete from ordem_etapas where ordem_id = any($1::uuid[])", [ordemIds]);
    await conexao.query("delete from orcamentos where id = any($1::uuid[])", [orcamentoIds]);
    await conexao.query("delete from ordens_producao where id = any($1::uuid[])", [ordemIds]);
    await conexao.query("delete from fichas_precificacao where id = any($1::uuid[])", [fichaIds]);
    await conexao.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from parcelas where documento_id = any($1::uuid[])", [documentoIds]);
    await conexao.query("delete from documento_linhas where documento_id = any($1::uuid[])", [
      documentoIds,
    ]);
    await conexao.query("delete from documentos where id = any($1::uuid[])", [documentoIds]);
    await conexao.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from itens_catalogo where id = any($1::uuid[])", [todosOsItens]);
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado — mesma razão da faxina do Estoque.
    console.error(`Concorrência da Produção: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

async function conferirConcorrenciaDaProducao(url = process.env.DATABASE_URL_TESTE) {
  console.log("  conferirConcorrenciaDaProducao...");

  // `lib/producao/gravacao.ts::travarOrdem` (baixa, conclusão, liberar, cancelar ordem) — e
  // `lib/estoque/gravacao.ts::encomendaEmAndamento` (a folha do Estoque), a MESMA trava desde a
  // revisão 06.1, WR-04.
  const TRAVA_DA_ORDEM = `select id, nome, tipo, caminho, status, inicio, entrega_prometida
       from ordens_producao where id = $1 for no key update`;
  // `lib/estoque/gravacao.ts::travarItens` — uma consulta, ids em ordem de id, `for no key update`.
  const TRAVA_DOS_ITENS = `select id, nome, unidade, ativo, controla_estoque
       from itens_catalogo where id = any($1::uuid[]) order by id for no key update`;
  // `lib/precificacao/gravacao.ts::promoverFichaParaLinha` (conclusão D-12 e `editarFicha`).
  const TRAVA_DA_FICHA_NA_PROMOCAO =
    "select nome, item_catalogo_id from fichas_precificacao where id = $1 for no key update";
  // `lib/precificacao/acoes.ts::editarFicha`, a primeira instrução da transação.
  const TRAVA_DA_FICHA_NA_EDICAO =
    "select item_catalogo_id, exclusiva from fichas_precificacao where id = $1 for update";
  // `lib/financeiro/acoes.ts::cancelarDocumento`, a primeira instrução da transação.
  const TRAVA_DO_DOCUMENTO = "select numero, cancelado_em from documentos where id = $1 for update";
  // `lib/producao/gravacao.ts::cancelarOrdemDaVendaCancelada` — a ordem achada pelo orçamento, e só
  // ELA travada (`of ordens_producao`).
  const TRAVA_DA_ORDEM_DA_VENDA = `select ordens_producao.id, ordens_producao.status
       from ordens_producao inner join orcamentos on orcamentos.encomenda_id = ordens_producao.id
      where orcamentos.documento_id = $1 for no key update of ordens_producao`;

  const conexaoA = new Client({ connectionString: url });
  const conexaoB = new Client({ connectionString: url });
  const observador = new Client({ connectionString: url });
  await Promise.all([conexaoA.connect(), conexaoB.connect(), observador.connect()]);
  for (const conexao of [conexaoA, conexaoB]) {
    await conexao.query("set lock_timeout = '5s'");
    await conexao.query("set statement_timeout = '10s'");
  }
  const pidA = (await conexaoA.query("select pg_backend_pid() as pid")).rows[0].pid;
  const pidB = (await conexaoB.query("select pg_backend_pid() as pid")).rows[0].pid;
  const hoje = dataBrasiliaDeHoje();

  let usuarioId = null;
  const itemIds = [];
  const ordemIds = [];
  const fichaIds = [];
  const documentoIds = [];
  const orcamentoIds = [];

  try {
    const { rows: usuarioInserido } = await observador.query(
      `insert into usuarios (nome, email, senha_hash)
       values ('Usuária de Teste da Concorrência da Produção [migracao]', 'usuaria-producao-concorrencia@exemplo.test', 'hash-fake-de-teste')
       returning id`,
    );
    usuarioId = usuarioInserido[0].id;
    const categoriaCompraId = (
      await observador.query("select id from categorias where nome = 'Argila, esmalte e insumos'")
    ).rows[0].id;
    const categoriaVendaId = (
      await observador.query("select id from categorias where nome = 'Peças prontas'")
    ).rows[0].id;

    // O item do Estoque que a baixa e a conclusão disputam no caso (1) e a folha do Estoque baixa
    // no (4): em `un`, com estoque próprio, 10 unidades por R$ 30,00 — R$ 3,00 a unidade.
    const { rows: itemInserido } = await observador.query(
      `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id, aparece_na_venda, categoria_venda_id)
       values ($1, true, 'un', $2, true, $3) returning id`,
      [`Caneca de prova${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`, categoriaCompraId, categoriaVendaId],
    );
    const itemId = itemInserido[0].id;
    itemIds.push(itemId);
    await inserirMovimentacao(observador, {
      item_id: itemId,
      registrado_por: usuarioId,
      origem: "manual",
      tipo: "entrada",
      quantidade_milesimos: 10000,
      valor_centavos: 3000,
      valor_informado_centavos: 3000,
    });

    async function criarOrdem(rotulo, { tipo = "casa", status = "ativa" } = {}) {
      const { rows } = await observador.query(
        `insert into ordens_producao (tipo, caminho, status, nome, cliente_nome, inicio, criado_por)
         values ($1, 'completo', $2, $3, $4, $5, $6) returning id`,
        [
          tipo,
          status,
          `${rotulo}${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`,
          tipo === "encomenda" ? `Cliente${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}` : null,
          status === "ativa" ? hoje : null,
          usuarioId,
        ],
      );
      ordemIds.push(rows[0].id);
      return rows[0].id;
    }

    async function lerOrdem(ordemId) {
      const { rows } = await observador.query(
        // Datas civis como texto: o `pg` transformaria `date` em `Date` no fuso do Node.
        `select status, inicio::text as inicio, cancelada_em, cancelada_pela_venda,
                concluida_em::text as concluida_em
           from ordens_producao where id = $1`,
        [ordemId],
      );
      return rows[0];
    }

    async function contarNoLivro(ordemId, origem, tipo) {
      const { rows } = await observador.query(
        `select count(*)::int as quantas from movimentacoes_estoque
          where encomenda_id = $1 and origem = $2 and tipo = $3`,
        [ordemId, origem, tipo],
      );
      return rows[0].quantas;
    }

    // ——— Os passos das ações, com as consultas do código ———

    async function comecar(conexao) {
      await conexao.query("begin");
      await conexao.query("set local role amassa_app");
    }

    // A ação lança a recusa de dentro da transação (nada gravado, `rollback`); senão comita.
    async function terminar(conexao, resultado) {
      await conexao.query(resultado.recusa ? "rollback" : "commit");
      return resultado;
    }

    async function travarOrdem(conexao, ordemId) {
      return (await conexao.query(TRAVA_DA_ORDEM, [ordemId])).rows[0] ?? null;
    }

    const emAndamento = (ordem) =>
      ordem !== null && (ordem.status === "aguardando_sinal" || ordem.status === "ativa");

    // Depois da trava da ordem: `darBaixaNaOrdem` (lib/producao/acoes.ts) e
    // `registrarMovimentacao` com "Qual ordem?" (lib/estoque/acoes.ts) emitem a MESMA sequência —
    // ordem em andamento? → `travarItens` → `gravarMovimentacoes` (que trava de novo, já seguro,
    // lê o estado e insere a saída "consumo em encomenda" ligada à ordem).
    async function saidaSobAOrdem(conexao, ordem) {
      if (!emAndamento(ordem)) {
        return { recusa: `ordem ${ordem?.status ?? "inexistente"}` };
      }
      await conexao.query(TRAVA_DOS_ITENS, [[itemId]]);
      await conexao.query(TRAVA_DOS_ITENS, [[itemId]]);
      const estado = await estadoDoItemNoLivro(conexao, itemId);
      const movimentacaoId = await inserirMovimentacao(conexao, {
        item_id: itemId,
        registrado_por: usuarioId,
        origem: "manual",
        tipo: "saida",
        destino: "encomenda",
        area: "pecas",
        encomenda_id: ordem.id,
        nota: ordem.nome,
        quantidade_milesimos: -1000,
        valor_centavos: -Math.round((1000 * estado.v) / estado.q),
      });
      return { movimentacaoId };
    }

    async function darBaixa(conexao, ordemId) {
      await comecar(conexao);
      const ordem = await travarOrdem(conexao, ordemId);
      return terminar(conexao, await saidaSobAOrdem(conexao, ordem));
    }

    // `promoverFichaParaLinha`: trava a ficha, cria o item (ou atualiza o que ela já tem) e grava a
    // ficha de linha. Devolve o item.
    async function promover(conexao, fichaId) {
      const ficha = (await conexao.query(TRAVA_DA_FICHA_NA_PROMOCAO, [fichaId])).rows[0];
      let itemDaFicha = ficha.item_catalogo_id;
      if (itemDaFicha) {
        await conexao.query(
          `update itens_catalogo set nome = $2, categoria_venda_id = $3, preco_venda_centavos = 4500
            where id = $1`,
          [itemDaFicha, ficha.nome, categoriaVendaId],
        );
      } else {
        const { rows } = await conexao.query(
          `insert into itens_catalogo (nome, categoria_venda_id, preco_venda_centavos, aparece_na_venda)
           values ($1, $2, 4500, true) returning id`,
          [ficha.nome, categoriaVendaId],
        );
        itemDaFicha = rows[0].id;
      }
      await conexao.query(
        `update fichas_precificacao set preco_praticado_centavos = null, exclusiva = false, item_catalogo_id = $2
          where id = $1`,
        [fichaId, itemDaFicha],
      );
      return itemDaFicha;
    }

    // `concluirOrdem` depois da trava da ordem: ativa? → (D-12) a promoção da ficha exclusiva,
    // ORDEM → FICHA → ITENS → `travarItens` → (D-13) liga o estoque do item que ainda não controla
    // → `gravarMovimentacoes` (trava de novo, lê o estado, insere a entrada da produção) → a peça →
    // a ordem `concluida`.
    async function conclusaoSobAOrdem(conexao, ordem, { itemDaEntrada = null, fichaId = null, pecaId = null }) {
      if (ordem?.status !== "ativa") {
        return { recusa: `ordem ${ordem?.status ?? "inexistente"}` };
      }
      const itemFinal = fichaId ? await promover(conexao, fichaId) : itemDaEntrada;
      const [item] = (await conexao.query(TRAVA_DOS_ITENS, [[itemFinal]])).rows;
      if (!item.controla_estoque) {
        await conexao.query(
          `update itens_catalogo
              set controla_estoque = true, unidade = coalesce(unidade, 'un'),
                  categoria_compra_id = coalesce(categoria_compra_id, $2)
            where id = $1`,
          [itemFinal, categoriaCompraId],
        );
      }
      await conexao.query(TRAVA_DOS_ITENS, [[itemFinal]]);
      await estadoDoItemNoLivro(conexao, itemFinal);
      await inserirMovimentacao(conexao, {
        item_id: itemFinal,
        registrado_por: usuarioId,
        origem: "producao",
        tipo: "entrada",
        encomenda_id: ordem.id,
        nota: ordem.nome,
        quantidade_milesimos: 1000,
        valor_centavos: 900,
        valor_informado_centavos: 900,
      });
      if (pecaId) {
        await conexao.query(
          `update ordem_pecas set perdidas = 0, destino_extras = 'estoque', para_estoque = 1, sem_destino = 0
            where id = $1`,
          [pecaId],
        );
      }
      await conexao.query(
        "update ordens_producao set status = 'concluida', concluida_em = $2 where id = $1",
        [ordem.id, hoje],
      );
      return { itemDaEntrada: itemFinal };
    }

    async function concluir(conexao, ordemId, opcoes) {
      await comecar(conexao);
      const ordem = await travarOrdem(conexao, ordemId);
      return terminar(conexao, await conclusaoSobAOrdem(conexao, ordem, opcoes));
    }

    // `editarFicha` desmarcando "exclusiva": trava a ficha (`for update`), grava os campos (o nome
    // novo) e promove pela MESMA `promoverFichaParaLinha` (que pede de novo a trava, já sua).
    async function editarFichaPromovendo(conexao, fichaId, nomeNovo) {
      await comecar(conexao);
      const atual = (await conexao.query(TRAVA_DA_FICHA_NA_EDICAO, [fichaId])).rows[0];
      if (!atual) {
        return terminar(conexao, { recusa: "ficha inexistente" });
      }
      await conexao.query("update fichas_precificacao set nome = $2 where id = $1", [fichaId, nomeNovo]);
      const itemDaFicha = await promover(conexao, fichaId);
      return terminar(conexao, { itemDaFicha, eraExclusiva: atual.exclusiva });
    }

    // `cancelarDocumento` depois da trava do documento: já cancelado? → a ordem da venda
    // (`cancelarOrdemDaVendaCancelada`: só ela, `for no key update`; aguardando → cancelada junto;
    // senão nada) → o estorno do Estoque (venda só de valor: nenhuma original, `travarItens` de lista
    // vazia não emite consulta) → o documento cancelado. Nenhuma escrita em parcela.
    async function cancelamentoSobODocumento(conexao, documento, documentoId) {
      if (documento.cancelado_em) {
        return { recusa: "já cancelado" };
      }
      const [ordem] = (await conexao.query(TRAVA_DA_ORDEM_DA_VENDA, [documentoId])).rows;
      let naOrdem = "sem-ordem";
      if (ordem) {
        naOrdem = "so-aviso";
        if (ordem.status === "aguardando_sinal") {
          await conexao.query(
            `update ordens_producao
                set status = 'cancelada', cancelada_em = now(), cancelada_por = $2, cancelada_pela_venda = true
              where id = $1`,
            [ordem.id, usuarioId],
          );
          naOrdem = "cancelada-junto";
        }
      }
      await conexao.query(
        `select id from movimentacoes_estoque m
          where m.documento_id = $1 and m.estorno_de_id is null
            and not exists (select 1 from movimentacoes_estoque e where e.estorno_de_id = m.id)`,
        [documentoId],
      );
      await conexao.query(
        "update documentos set cancelado_em = now(), cancelado_por = $2 where id = $1",
        [documentoId, usuarioId],
      );
      return { naOrdem };
    }

    async function cancelarDocumento(conexao, documentoId) {
      await comecar(conexao);
      const [documento] = (await conexao.query(TRAVA_DO_DOCUMENTO, [documentoId])).rows;
      return terminar(conexao, await cancelamentoSobODocumento(conexao, documento, documentoId));
    }

    // `liberarOrdem` depois da trava da ordem: `planejarLiberacao` só aceita aguardando o sinal.
    async function liberacaoSobAOrdem(conexao, ordem) {
      if (ordem?.status !== "aguardando_sinal") {
        return { recusa: ordem?.status === "cancelada" ? "cancelada" : "ja-liberada" };
      }
      await conexao.query("update ordens_producao set status = 'ativa', inicio = $2 where id = $1", [
        ordem.id,
        hoje,
      ]);
      return { inicio: hoje };
    }

    async function liberarOrdem(conexao, ordemId) {
      await comecar(conexao);
      const ordem = await travarOrdem(conexao, ordemId);
      return terminar(conexao, await liberacaoSobAOrdem(conexao, ordem));
    }

    // `cancelarOrdem` depois da trava da ordem: `planejarCancelamento` só aceita aguardando ou
    // ativa; grava o cancelamento e NADA mais.
    async function cancelamentoDaOrdemSobATrava(conexao, ordem) {
      if (!emAndamento(ordem)) {
        return { recusa: "já encerrada" };
      }
      await conexao.query(
        "update ordens_producao set status = 'cancelada', cancelada_em = now(), cancelada_por = $2 where id = $1",
        [ordem.id, usuarioId],
      );
      return { cancelada: true };
    }

    async function cancelarOrdem(conexao, ordemId) {
      await comecar(conexao);
      const ordem = await travarOrdem(conexao, ordemId);
      return terminar(conexao, await cancelamentoDaOrdemSobATrava(conexao, ordem));
    }

    // Uma corrida que deveria terminar: devolve o resultado da ação, ou lança dizendo o SQLSTATE —
    // um 40P01 é o impasse; um 55P03, a trava que nunca veio.
    function exigirTermino(corrida, contexto) {
      if (!corrida.ok) {
        throw new Error(
          `${contexto}: a transação que esperava deveria terminar, e caiu com ${corrida.erro?.code} (${corrida.erro?.message}). 40P01 é impasse — a ordem de travas DOCUMENTO → ORDEM → (FICHA →) ITENS foi quebrada.`,
        );
      }
      return corrida.resultado;
    }

    // ——— (1) PRD-14: `darBaixaNaOrdem` × `concluirOrdem`, mesma ordem, mesmo item ———

    // (1a) A baixa chega primeiro: segura SÓ a trava da ordem quando a conclusão pede a mesma e
    // espera; a baixa então trava o item, grava e comita sem precisar de nada da conclusão; a
    // conclusão relê a ordem (ainda ativa) e conclui. Uma saída e UMA entrada.
    const ordem1a = await criarOrdem("Ordem 1a");
    await comecar(conexaoA);
    const ordemVistaPelaBaixa = await travarOrdem(conexaoA, ordem1a);
    const conclusao1a = semRejeicaoSolta(concluir(conexaoB, ordem1a, { itemDaEntrada: itemId }));
    await esperarBloqueada(observador, pidB, "(1a) Conclusão esperando a baixa");
    const baixa1a = await terminar(conexaoA, await saidaSobAOrdem(conexaoA, ordemVistaPelaBaixa));
    afirmar(!baixa1a.recusa, `(1a) A baixa com a ordem ativa deveria gravar, e recusou: ${baixa1a.recusa}.`);
    const concluida1a = exigirTermino(await conclusao1a, "(1a) Baixa antes da conclusão");
    afirmar(
      !concluida1a.recusa,
      `(1a) A conclusão, depois da baixa, deveria concluir a ordem ainda ativa, e recusou: ${concluida1a.recusa}.`,
    );
    afirmar(
      (await contarNoLivro(ordem1a, "manual", "saida")) === 1 &&
        (await contarNoLivro(ordem1a, "producao", "entrada")) === 1 &&
        (await lerOrdem(ordem1a)).status === "concluida",
      "(1a) Baixa seguida de conclusão deveria deixar uma saída, uma entrada da produção e a ordem concluída.",
    );

    // (1b) A conclusão chega primeiro: a baixa espera na ordem, relê `concluida` e recusa — nada
    // ligado a ela entra depois de fechada. Uma entrada só, nenhuma saída.
    const ordem1b = await criarOrdem("Ordem 1b");
    await comecar(conexaoA);
    const ordemVistaPelaConclusao = await travarOrdem(conexaoA, ordem1b);
    const baixa1b = semRejeicaoSolta(darBaixa(conexaoB, ordem1b));
    await esperarBloqueada(observador, pidB, "(1b) Baixa esperando a conclusão");
    const concluida1b = await terminar(
      conexaoA,
      await conclusaoSobAOrdem(conexaoA, ordemVistaPelaConclusao, { itemDaEntrada: itemId }),
    );
    afirmar(!concluida1b.recusa, `(1b) A conclusão deveria concluir, e recusou: ${concluida1b.recusa}.`);
    const recusada1b = exigirTermino(await baixa1b, "(1b) Conclusão antes da baixa");
    afirmar(
      recusada1b.recusa === "ordem concluida",
      `(1b) A baixa, depois da conclusão, deveria reler a ordem concluída e recusar — veio ${JSON.stringify(recusada1b)}.`,
    );
    afirmar(
      (await contarNoLivro(ordem1b, "manual", "saida")) === 0 &&
        (await contarNoLivro(ordem1b, "producao", "entrada")) === 1,
      "(1b) Conclusão seguida de baixa deveria deixar UMA entrada e nenhuma saída ligada à ordem fechada.",
    );

    // (1c) O CONTROLE: a baixa na ordem INVERSA (ITEM → ORDEM, como a folha do Estoque era antes da
    // revisão WR-04) contra a conclusão (ORDEM → ITEM). A conclusão segura a ordem, a baixa segura
    // o item; cada uma pede a da outra — ciclo, e o Postgres derruba uma com 40P01. Nada comita.
    const ordem1c = await criarOrdem("Ordem 1c");
    await comecar(conexaoA);
    await comecar(conexaoB);
    await travarOrdem(conexaoA, ordem1c);
    await conexaoB.query(TRAVA_DOS_ITENS, [[itemId]]);
    const conclusaoPedeItem = semRejeicaoSolta(conexaoA.query(TRAVA_DOS_ITENS, [[itemId]]));
    await esperarBloqueada(observador, pidA, "(1c) Controle com a ordem invertida");
    const baixaPedeOrdem = semRejeicaoSolta(conexaoB.query(TRAVA_DA_ORDEM, [ordem1c]));
    const codigosDoControle = (await Promise.all([conclusaoPedeItem, baixaPedeOrdem])).map(
      (corrida) => (corrida.ok ? "ok" : corrida.erro.code),
    );
    await conexaoA.query("rollback");
    await conexaoB.query("rollback");
    afirmar(
      codigosDoControle.filter((codigo) => codigo === "40P01").length === 1 &&
        codigosDoControle.filter((codigo) => codigo === "ok").length === 1,
      `(1c) Com a baixa na ordem invertida (ITEM → ORDEM), uma das duas deveria cair em impasse (40P01) e a outra seguir — vieram conclusão=${codigosDoControle[0]}, baixa=${codigosDoControle[1]}. Sem isso a sonda não enxerga impasse nenhum.`,
    );

    // ——— (2) PRD-16: conclusão com promoção (ORDEM → FICHA → ITENS) × `editarFicha` (FICHA → ITEM) ———

    async function criarFichaExclusivaComOrdem(rotulo) {
      const { rows: ficha } = await observador.query(
        `insert into fichas_precificacao (nome, exclusiva, criado_por) values ($1, true, $2) returning id`,
        [`Prato exclusivo ${rotulo}${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`, usuarioId],
      );
      fichaIds.push(ficha[0].id);
      const ordemId = await criarOrdem(`Ordem ${rotulo}`, { tipo: "encomenda" });
      const { rows: peca } = await observador.query(
        `insert into ordem_pecas (ordem_id, posicao, ficha_id, descricao, quantidade, a_mais)
         values ($1, 0, $2, 'Prato exclusivo de prova [migracao]', 1, 1) returning id`,
        [ordemId, ficha[0].id],
      );
      return { fichaId: ficha[0].id, ordemId, pecaId: peca[0].id };
    }

    async function conferirPromovidaUmaVez(caso, fichaId, ordemId, rotulo) {
      const { rows: ficha } = await observador.query(
        "select exclusiva, item_catalogo_id from fichas_precificacao where id = $1",
        [fichaId],
      );
      const { rows: itens } = await observador.query(
        "select id, controla_estoque from itens_catalogo where nome like $1",
        [`Prato exclusivo ${rotulo}%`],
      );
      itemIds.push(...itens.map((item) => item.id));
      const { rows: entradas } = await observador.query(
        "select item_id from movimentacoes_estoque where encomenda_id = $1 and origem = 'producao'",
        [ordemId],
      );
      afirmar(
        ficha[0].exclusiva === false &&
          itens.length === 1 &&
          ficha[0].item_catalogo_id === itens[0].id &&
          itens[0].controla_estoque === true &&
          entradas.length === 1 &&
          entradas[0].item_id === itens[0].id,
        `${caso} A ficha deveria ser promovida UMA vez: de linha, um item só (com estoque próprio) e uma entrada nele — veio ficha ${JSON.stringify(ficha[0])}, ${itens.length} item(ns), ${entradas.length} entrada(s).`,
      );
    }

    // (2a) A conclusão chega primeiro: segura a ordem e a ficha (`for no key update`) quando a
    // edição pede a ficha (`for update`) e espera; a conclusão cria o item, liga o estoque, grava
    // a entrada e comita; a edição relê a ficha JÁ de linha e atualiza o item dela — não cria outro.
    const caso2a = await criarFichaExclusivaComOrdem("2a");
    await comecar(conexaoA);
    const ordemDa2a = await travarOrdem(conexaoA, caso2a.ordemId);
    // A primeira consulta de `promoverFichaParaLinha`, para a edição chegar com a ficha já travada;
    // `conclusaoSobAOrdem` a repete logo abaixo — pedir de novo uma trava que é sua não espera.
    await conexaoA.query(TRAVA_DA_FICHA_NA_PROMOCAO, [caso2a.fichaId]);
    const edicao2a = semRejeicaoSolta(
      editarFichaPromovendo(
        conexaoB,
        caso2a.fichaId,
        `Prato exclusivo 2a (editado)${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`,
      ),
    );
    await esperarBloqueada(observador, pidB, "(2a) Edição da ficha esperando a conclusão");
    const concluida2a = await terminar(
      conexaoA,
      await conclusaoSobAOrdem(conexaoA, ordemDa2a, { fichaId: caso2a.fichaId, pecaId: caso2a.pecaId }),
    );
    afirmar(!concluida2a.recusa, `(2a) A conclusão deveria promover e concluir, e recusou: ${concluida2a.recusa}.`);
    const editada2a = exigirTermino(await edicao2a, "(2a) Conclusão antes da edição da ficha");
    afirmar(
      editada2a.eraExclusiva === false && editada2a.itemDaFicha === concluida2a.itemDaEntrada,
      `(2a) A edição deveria reler a ficha JÁ promovida e reaproveitar o item da conclusão — veio ${JSON.stringify(editada2a)} (item da conclusão ${concluida2a.itemDaEntrada}).`,
    );
    await conferirPromovidaUmaVez("(2a)", caso2a.fichaId, caso2a.ordemId, "2a");

    // (2b) A edição chega primeiro: segura a ficha (`for update`); a conclusão trava a ordem (livre)
    // e espera na ficha; a edição promove (cria o item) e comita; a conclusão relê a ficha JÁ de
    // linha, reaproveita o item, liga o estoque e grava a entrada nele.
    const caso2b = await criarFichaExclusivaComOrdem("2b");
    await comecar(conexaoA);
    const fichaVistaPelaEdicao = (await conexaoA.query(TRAVA_DA_FICHA_NA_EDICAO, [caso2b.fichaId])).rows[0];
    const conclusao2b = semRejeicaoSolta(
      concluir(conexaoB, caso2b.ordemId, { fichaId: caso2b.fichaId, pecaId: caso2b.pecaId }),
    );
    await esperarBloqueada(observador, pidB, "(2b) Conclusão esperando a edição da ficha");
    await conexaoA.query("update fichas_precificacao set nome = $2 where id = $1", [
      caso2b.fichaId,
      `Prato exclusivo 2b (editado)${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`,
    ]);
    const itemDaEdicao2b = await promover(conexaoA, caso2b.fichaId);
    await conexaoA.query("commit");
    afirmar(fichaVistaPelaEdicao.exclusiva === true, "(2b) A edição deveria ter achado a ficha ainda exclusiva.");
    const concluida2b = exigirTermino(await conclusao2b, "(2b) Edição da ficha antes da conclusão");
    afirmar(
      !concluida2b.recusa && concluida2b.itemDaEntrada === itemDaEdicao2b,
      `(2b) A conclusão deveria reaproveitar o item que a edição criou (${itemDaEdicao2b}) — veio ${JSON.stringify(concluida2b)}.`,
    );
    await conferirPromovidaUmaVez("(2b)", caso2b.fichaId, caso2b.ordemId, "2b");

    // ——— (3) PRD-11/PRD-18: `cancelarDocumento` (a venda) × `liberarOrdem` (a ordem dela) ———

    // Uma venda só de valor, com a parcela, e o orçamento aprovado que liga a venda à ordem
    // aguardando o sinal — o vínculo de D-07 mora só em `orcamentos`.
    async function criarVendaComOrdemAguardando(rotulo, sequencial) {
      const ordemId = await criarOrdem(`Ordem ${rotulo}`, { tipo: "encomenda", status: "aguardando_sinal" });
      // Documento, linha e parcela numa transação só: a restrição ADIADA de soma (0015) confere no
      // `commit`.
      await observador.query("begin");
      const { rows: documento } = await observador.query(
        "insert into documentos (tipo, data, criado_por) values ('venda', current_date, $1) returning id",
        [usuarioId],
      );
      const documentoId = documento[0].id;
      documentoIds.push(documentoId);
      await observador.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
         values ($1, 1, 'Venda do orçamento [migracao]', $2, 12000)`,
        [documentoId, categoriaVendaId],
      );
      await observador.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma)
         values ($1, 1, current_date, 12000, 'pix')`,
        [documentoId],
      );
      await observador.query("commit");
      const { rows: orcamento } = await observador.query(
        `insert into orcamentos (ano, sequencial, status, cliente_nome, data, entrega_prevista,
                                 snapshot, congelado_em, documento_id, encomenda_id, criado_por)
         values (2026, $1, 'aprovado', $2, current_date, current_date + 40, '{"linhas":[]}', now(), $3, $4, $5)
         returning id`,
        [sequencial, `Cliente${SUFIXO_DA_CONCORRENCIA_DA_PRODUCAO}`, documentoId, ordemId, usuarioId],
      );
      orcamentoIds.push(orcamento[0].id);
      return { ordemId, documentoId };
    }

    async function retratoDasParcelas(documentoId) {
      const { rows } = await observador.query(
        "select row_to_json(p)::text as linha from parcelas p where documento_id = $1 order by numero",
        [documentoId],
      );
      return rows.map((linha) => linha.linha).join("\n");
    }

    // (3a) A venda é cancelada primeiro: o cancelamento segura o documento e a ordem quando a
    // liberação pede a ordem e espera; a ordem aguardando cai junto com a venda; a liberação relê
    // `cancelada` e recusa ("Esta ordem foi cancelada…").
    const caso3a = await criarVendaComOrdemAguardando("3a", 900311);
    const parcelasAntes3a = await retratoDasParcelas(caso3a.documentoId);
    await comecar(conexaoA);
    const documentoDa3a = (await conexaoA.query(TRAVA_DO_DOCUMENTO, [caso3a.documentoId])).rows[0];
    // A trava da ordem que `cancelarOrdemDaVendaCancelada` pede, para a liberação chegar com a
    // ORDEM já presa (só com o documento ela passaria direto); `cancelamentoSobODocumento` a
    // repete logo abaixo — pedir de novo uma trava que é sua não espera.
    await conexaoA.query(TRAVA_DA_ORDEM_DA_VENDA, [caso3a.documentoId]);
    const liberacao3a = semRejeicaoSolta(liberarOrdem(conexaoB, caso3a.ordemId));
    await esperarBloqueada(observador, pidB, "(3a) Liberação esperando o cancelamento da venda");
    const cancelamento3a = await terminar(
      conexaoA,
      await cancelamentoSobODocumento(conexaoA, documentoDa3a, caso3a.documentoId),
    );
    afirmar(
      cancelamento3a.naOrdem === "cancelada-junto",
      `(3a) A venda cancelada com a ordem ainda aguardando deveria cancelar a ordem junto — veio ${JSON.stringify(cancelamento3a)}.`,
    );
    const liberada3a = exigirTermino(await liberacao3a, "(3a) Venda cancelada antes da liberação");
    const ordemDepois3a = await lerOrdem(caso3a.ordemId);
    afirmar(
      liberada3a.recusa === "cancelada" &&
        ordemDepois3a.status === "cancelada" &&
        ordemDepois3a.cancelada_pela_venda === true &&
        ordemDepois3a.inicio === null,
      `(3a) A liberação, depois da venda cancelada, deveria reler a ordem cancelada pela venda e recusar — veio liberação ${JSON.stringify(liberada3a)}, ordem ${JSON.stringify(ordemDepois3a)}.`,
    );
    afirmar(
      (await retratoDasParcelas(caso3a.documentoId)) === parcelasAntes3a,
      "(3a) Nenhuma parcela da venda deveria mudar.",
    );

    // (3b) A liberação chega primeiro: segura a ordem; o cancelamento trava o documento (livre) e
    // espera na ordem; a liberação grava `ativa` e comita sem precisar do documento; o cancelamento
    // relê a ordem `ativa`, não grava nada nela (só o aviso, derivado na leitura) e cancela a venda.
    const caso3b = await criarVendaComOrdemAguardando("3b", 900312);
    const parcelasAntes3b = await retratoDasParcelas(caso3b.documentoId);
    await comecar(conexaoA);
    const ordemVistaPelaLiberacao = await travarOrdem(conexaoA, caso3b.ordemId);
    const cancelamento3b = semRejeicaoSolta(cancelarDocumento(conexaoB, caso3b.documentoId));
    await esperarBloqueada(observador, pidB, "(3b) Cancelamento da venda esperando a liberação");
    const liberada3b = await terminar(conexaoA, await liberacaoSobAOrdem(conexaoA, ordemVistaPelaLiberacao));
    afirmar(!liberada3b.recusa, `(3b) A liberação deveria liberar, e recusou: ${liberada3b.recusa}.`);
    const cancelada3b = exigirTermino(await cancelamento3b, "(3b) Liberação antes da venda cancelada");
    const ordemDepois3b = await lerOrdem(caso3b.ordemId);
    const { rows: documentoDepois3b } = await observador.query(
      "select cancelado_em from documentos where id = $1",
      [caso3b.documentoId],
    );
    afirmar(
      cancelada3b.naOrdem === "so-aviso" &&
        ordemDepois3b.status === "ativa" &&
        ordemDepois3b.inicio === hoje &&
        ordemDepois3b.cancelada_em === null &&
        ordemDepois3b.cancelada_pela_venda === false &&
        documentoDepois3b[0].cancelado_em !== null,
      `(3b) Com a ordem já liberada, o cancelamento da venda deveria só cancelar a venda e deixar a ordem ativa — veio cancelamento ${JSON.stringify(cancelada3b)}, ordem ${JSON.stringify(ordemDepois3b)}.`,
    );
    afirmar(
      (await retratoDasParcelas(caso3b.documentoId)) === parcelasAntes3b,
      "(3b) Nenhuma parcela da venda deveria mudar.",
    );

    // ——— (4) WR-04: a folha do Estoque com "Qual ordem?" × `cancelarOrdem` ———

    // (4a) O cancelamento chega primeiro: a baixa PRECISA esperar — com a `for key share` de antes
    // da revisão ela não esperaria e leria "ativa" — relê `cancelada` e recusa. Nada no livro.
    const ordem4a = await criarOrdem("Ordem 4a", { tipo: "encomenda" });
    await comecar(conexaoA);
    const ordemVistaPeloCancelamento = await travarOrdem(conexaoA, ordem4a);
    const baixa4a = semRejeicaoSolta(darBaixa(conexaoB, ordem4a));
    await esperarBloqueada(observador, pidB, "(4a) Baixa do Estoque esperando o cancelamento da ordem");
    const cancelada4a = await terminar(
      conexaoA,
      await cancelamentoDaOrdemSobATrava(conexaoA, ordemVistaPeloCancelamento),
    );
    afirmar(!cancelada4a.recusa, `(4a) O cancelamento deveria cancelar, e recusou: ${cancelada4a.recusa}.`);
    const recusada4a = exigirTermino(await baixa4a, "(4a) Cancelamento antes da baixa do Estoque");
    afirmar(
      recusada4a.recusa === "ordem cancelada" && (await contarNoLivro(ordem4a, "manual", "saida")) === 0,
      `(4a) A baixa deveria reler a ordem cancelada e recusar, sem linha no livro — veio ${JSON.stringify(recusada4a)}.`,
    );

    // (4b) A baixa chega primeiro: o cancelamento espera, a baixa grava (a ordem estava ativa) e
    // comita; o cancelamento segue. O material baixado não volta sozinho (briefing §6) — o que se
    // prova aqui é só que a outra ordem de chegada também termina, sem impasse.
    const ordem4b = await criarOrdem("Ordem 4b", { tipo: "encomenda" });
    await comecar(conexaoA);
    const ordemVistaPelaBaixa4b = await travarOrdem(conexaoA, ordem4b);
    const cancelamento4b = semRejeicaoSolta(cancelarOrdem(conexaoB, ordem4b));
    await esperarBloqueada(observador, pidB, "(4b) Cancelamento da ordem esperando a baixa do Estoque");
    const baixa4b = await terminar(conexaoA, await saidaSobAOrdem(conexaoA, ordemVistaPelaBaixa4b));
    afirmar(!baixa4b.recusa, `(4b) A baixa com a ordem ativa deveria gravar, e recusou: ${baixa4b.recusa}.`);
    const cancelada4b = exigirTermino(await cancelamento4b, "(4b) Baixa do Estoque antes do cancelamento");
    afirmar(
      !cancelada4b.recusa &&
        (await lerOrdem(ordem4b)).status === "cancelada" &&
        (await contarNoLivro(ordem4b, "manual", "saida")) === 1,
      `(4b) Baixa seguida de cancelamento deveria deixar a saída gravada antes e a ordem cancelada — veio ${JSON.stringify(cancelada4b)}.`,
    );
  } finally {
    await conexaoA.query("rollback").catch(() => {});
    await conexaoB.query("rollback").catch(() => {});
    // A semente da venda abre transação no observador; uma falha no meio dela não pode deixar a
    // faxina presa numa transação abortada.
    await observador.query("rollback").catch(() => {});
    await apagarDadosDeProvaDaConcorrenciaDaProducao(observador, {
      itemIds,
      ordemIds,
      fichaIds,
      documentoIds,
      orcamentoIds,
      usuarioId,
    });
    await Promise.all([conexaoA.end(), conexaoB.end(), observador.end()]);
  }
}

function entradasDoJournal() {
  const journal = JSON.parse(
    readFileSync(path.join("db", "migrations", "meta", "_journal.json"), "utf8"),
  );
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

// Aplica À MÃO as migrações de `idxInicial` a `idxFinal` (inclusive), na ordem do `_journal.json`,
// numa transação só — como o migrador do Drizzle faz: lê cada `.sql`, parte no marcador de
// instrução do Drizzle e executa cada pedaço. Não grava o journal do Drizzle (`__drizzle_migrations`):
// o banco que usa isto é descartável e nunca vê `db:migrate`.
async function aplicarMigracoesAte(cliente, idxFinal, idxInicial = 0) {
  const entradas = entradasDoJournal().filter(
    (entrada) => entrada.idx >= idxInicial && entrada.idx <= idxFinal,
  );
  afirmar(
    entradas.length === idxFinal - idxInicial + 1,
    `O _journal.json deveria ter as migrações ${idxInicial}..${idxFinal}, achou ${entradas.length}.`,
  );
  await cliente.query("begin");
  try {
    for (const entrada of entradas) {
      const conteudo = readFileSync(path.join("db", "migrations", `${entrada.tag}.sql`), "utf8");
      for (const instrucao of conteudo.split("--> statement-breakpoint")) {
        if (instrucao.trim() === "") continue;
        try {
          await cliente.query(instrucao);
        } catch (erro) {
          throw new Error(`migração ${entrada.tag}: ${erro.message} (${erro.code})`);
        }
      }
    }
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    throw erro;
  }
}

// Cria um banco próprio, descartável, ao lado do banco de teste; devolve a URL dele e a faxina.
async function criarBancoProprio(sufixo) {
  const url = new URL(process.env.DATABASE_URL_TESTE);
  const bancoDaProva = `${url.pathname.slice(1)}_${sufixo}`;
  const urlAdmin = new URL(url);
  urlAdmin.pathname = "/postgres";
  const urlDaProva = new URL(url);
  urlDaProva.pathname = `/${bancoDaProva}`;

  async function comoAdmin(sql) {
    const admin = new Client({ connectionString: urlAdmin.toString() });
    await admin.connect();
    try {
      await admin.query(sql);
    } finally {
      await admin.end();
    }
  }
  await comoAdmin(`drop database if exists "${bancoDaProva}"`);
  await comoAdmin(`create database "${bancoDaProva}"`);
  return {
    nome: bancoDaProva,
    url: urlDaProva.toString(),
    apagar: () => comoAdmin(`drop database if exists "${bancoDaProva}"`),
  };
}

// Semeia, num banco em 0023, os três casos do D-02 (A: venda ativa e encomenda em produção — vira
// ordem; B: venda cancelada; C: encomenda concluída — nenhum dos dois vira) e duas baixas do
// Estoque ligadas às encomendas A e C. Devolve os ids que as afirmações conferem.
async function semearCasosDoD02(cliente) {
  await cliente.query("begin");
  try {
    const usuarioId = (
      await cliente.query(
        `insert into usuarios (nome, email, senha_hash)
         values ('Usuária do D-02 [migracao]', 'usuaria-d02@exemplo.test', 'hash-fake-de-teste')
         returning id`,
      )
    ).rows[0].id;
    const categoriaVendaId = (
      await cliente.query("select id from categorias where nome = 'Peças prontas'")
    ).rows[0].id;
    const categoriaCompraId = (
      await cliente.query("select id from categorias where nome = 'Argila, esmalte e insumos'")
    ).rows[0].id;
    const itemDeLinhaId = (
      await cliente.query(
        `insert into itens_catalogo (nome, aparece_na_venda, categoria_venda_id)
         values ('[migracao] Caneca de linha', true, $1) returning id`,
        [categoriaVendaId],
      )
    ).rows[0].id;
    const argilaId = (
      await cliente.query(
        `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id)
         values ('[migracao] Argila do D-02', true, 'kg', $1) returning id`,
        [categoriaCompraId],
      )
    ).rows[0].id;
    const fichaDeLinhaId = (
      await cliente.query(
        `insert into fichas_precificacao (nome, exclusiva, item_catalogo_id, criado_por)
         values ('[migracao] Ficha da caneca', false, $1, $2) returning id`,
        [itemDeLinhaId, usuarioId],
      )
    ).rows[0].id;
    const fichaExclusivaId = (
      await cliente.query(
        `insert into fichas_precificacao (nome, exclusiva, criado_por)
         values ('[migracao] Ficha do prato exclusivo', true, $1) returning id`,
        [usuarioId],
      )
    ).rows[0].id;

    const casos = {};
    for (const [letra, sequencial, statusDaEncomenda, vendaCancelada] of [
      ["A", 900201, "em_producao", false],
      ["B", 900202, "em_producao", true],
      ["C", 900203, "concluida", false],
    ]) {
      const encomendaId = (
        await cliente.query(
          `insert into encomendas (nome, cliente_nome, data_inicio, status, criado_por)
           values ($1, $2, '2026-09-01', $3, $4) returning id`,
          [`[migracao] Encomenda ${letra}`, `Cliente ${letra} [migracao]`, statusDaEncomenda, usuarioId],
        )
      ).rows[0].id;
      const documentoId = (
        await cliente.query(
          `insert into documentos (tipo, data, criado_por, cancelado_em, cancelado_por)
           values ('venda', '2026-09-01', $1, $2, $3) returning id`,
          [usuarioId, vendaCancelada ? "2026-09-02T12:00:00Z" : null, vendaCancelada ? usuarioId : null],
        )
      ).rows[0].id;
      await cliente.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
         values ($1, 1, 'Venda do orçamento [migracao]', $2, 12000)`,
        [documentoId, categoriaVendaId],
      );
      await cliente.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma)
         values ($1, 1, '2026-09-01', 12000, 'pix')`,
        [documentoId],
      );
      const snapshot = {
        linhas: [{ nome: `Caneca do snapshot ${letra}` }, { nome: `Prato do snapshot ${letra}` }],
      };
      const orcamentoId = (
        await cliente.query(
          `insert into orcamentos (ano, sequencial, status, cliente_nome, data, entrega_prevista,
                                   snapshot, congelado_em, documento_id, encomenda_id, criado_por)
           values (2026, $1, 'aprovado', $2, '2026-09-01', '2026-12-15', $3, now(), $4, $5, $6)
           returning id`,
          [sequencial, `Cliente ${letra} [migracao]`, JSON.stringify(snapshot), documentoId, encomendaId, usuarioId],
        )
      ).rows[0].id;
      // A linha de `ordem` 1 é inserida ANTES da de `ordem` 0: a posição da peça tem de vir de
      // `ordem`, não da ordem de inserção.
      await cliente.query(
        `insert into orcamento_linhas (orcamento_id, ficha_id, quantidade, preco_unitario_centavos, cor, personalizacao, ordem)
         values ($1, $2, 3, 2000, null, 'Com inicial [migracao]', 1)`,
        [orcamentoId, fichaExclusivaId],
      );
      await cliente.query(
        `insert into orcamento_linhas (orcamento_id, ficha_id, quantidade, preco_unitario_centavos, cor, personalizacao, ordem)
         values ($1, $2, 12, 500, 'Azul', null, 0)`,
        [orcamentoId, fichaDeLinhaId],
      );
      casos[letra] = { encomendaId, documentoId, orcamentoId };
    }

    // Duas baixas "consumo em encomenda" — uma da encomenda A (vira ordem, o vínculo fica), outra
    // da C (não vira, o vínculo sai e a nota fica).
    const baixas = {};
    for (const letra of ["A", "C"]) {
      baixas[letra] = (
        await cliente.query(
          `insert into movimentacoes_estoque (item_id, origem, tipo, destino, area, encomenda_id, nota,
                                              quantidade_milesimos, valor_centavos, registrado_por)
           values ($1, 'manual', 'saida', 'encomenda', 'pecas', $2, $3, -500, 0, $4) returning id`,
          [argilaId, casos[letra].encomendaId, `[migracao] Encomenda ${letra}`, usuarioId],
        )
      ).rows[0].id;
    }
    await cliente.query("commit");
    return { usuarioId, fichaDeLinhaId, fichaExclusivaId, casos, baixas };
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    throw new Error(`semear os casos do D-02 em 0023 falhou: ${erro.message}`);
  }
}

async function conferirDadoDoD02(cliente, semente) {
  const { usuarioId, fichaDeLinhaId, fichaExclusivaId, casos, baixas } = semente;

  // Só o caso A virou ordem — com o MESMO id da encomenda, aguardando o sinal, sem início.
  const { rows: ordens } = await cliente.query(
    `select id, tipo, caminho, status, nome, cliente_nome, entrega_prometida::text as entrega,
            inicio, concluida_em, cancelada_em, criado_por
       from ordens_producao`,
  );
  afirmar(
    ordens.length === 1,
    `D-02: só o orçamento aprovado com venda ativa e encomenda em andamento deveria virar ordem — ${ordens.length} ordens.`,
  );
  const ordem = ordens[0];
  afirmar(
    ordem.id === casos.A.encomendaId,
    `D-02: a ordem deveria ter o MESMO id da encomenda A (${casos.A.encomendaId}), veio ${ordem.id}.`,
  );
  afirmar(
    ordem.tipo === "encomenda" &&
      ordem.caminho === "completo" &&
      ordem.status === "aguardando_sinal" &&
      ordem.inicio === null &&
      ordem.concluida_em === null &&
      ordem.cancelada_em === null &&
      ordem.nome === "[migracao] Encomenda A" &&
      ordem.cliente_nome === "Cliente A [migracao]" &&
      ordem.entrega === "2026-12-15" &&
      ordem.criado_por === usuarioId,
    `D-02: a ordem deveria ser encomenda, completo, aguardando_sinal, sem início, com o nome da encomenda, o cliente e a entrega do orçamento — veio ${JSON.stringify(ordem)}.`,
  );

  const { rows: etapas } = await cliente.query(
    `select etapa, posicao, dias_previstos, feita_em, passaram
       from ordem_etapas where ordem_id = $1 order by posicao`,
    [ordem.id],
  );
  const etapasEsperadas = ETAPAS_COMPLETO_DA_PROVA.map(([etapa, posicao, dias]) => ({
    etapa,
    posicao,
    dias_previstos: dias,
    feita_em: null,
    passaram: null,
  }));
  afirmar(
    JSON.stringify(etapas) === JSON.stringify(etapasEsperadas),
    `D-02: a ordem deveria nascer com as seis etapas que a 0024 grava (5/15/1/1/4/6, par antigo — histórico), nenhuma feita — veio ${JSON.stringify(etapas)}.`,
  );

  const { rows: pecas } = await cliente.query(
    `select posicao, ficha_id, item_catalogo_id, descricao, quantidade, a_mais, cor, personalizacao
       from ordem_pecas where ordem_id = $1 order by posicao`,
    [ordem.id],
  );
  const pecasEsperadas = [
    {
      posicao: 0,
      ficha_id: fichaDeLinhaId,
      item_catalogo_id: null,
      descricao: "Caneca do snapshot A",
      quantidade: 12,
      a_mais: 0,
      cor: "Azul",
      personalizacao: null,
    },
    {
      posicao: 1,
      ficha_id: fichaExclusivaId,
      item_catalogo_id: null,
      descricao: "Prato do snapshot A",
      quantidade: 3,
      a_mais: 0,
      cor: null,
      personalizacao: "Com inicial [migracao]",
    },
  ];
  afirmar(
    JSON.stringify(pecas) === JSON.stringify(pecasEsperadas),
    `D-02: as peças deveriam vir das linhas do orçamento, na ordem de \`ordem\`, com a descrição do snapshot e a ficha — veio ${JSON.stringify(pecas)}.`,
  );
  const { rows: totais } = await cliente.query(
    `select (select count(*) from ordem_etapas)::int as etapas,
            (select count(*) from ordem_pecas)::int as pecas,
            (select count(*) from encomendas)::int as encomendas`,
  );
  afirmar(
    totais[0].etapas === 6 && totais[0].pecas === 2,
    `D-02: nenhuma etapa ou peça fora da ordem A — veio ${JSON.stringify(totais[0])}.`,
  );
  afirmar(
    totais[0].encomendas === 3,
    `A 0024 só cria, grava e religa — as três encomendas deveriam continuar (quem apaga é a 0025), veio ${totais[0].encomendas}.`,
  );

  // Os vínculos: A fica; B (venda cancelada) e C (concluída) perdem o `encomenda_id`.
  const { rows: vinculos } = await cliente.query(
    "select id, encomenda_id from orcamentos where id = any($1::uuid[])",
    [[casos.A.orcamentoId, casos.B.orcamentoId, casos.C.orcamentoId]],
  );
  const vinculoDe = new Map(vinculos.map((linha) => [linha.id, linha.encomenda_id]));
  afirmar(
    vinculoDe.get(casos.A.orcamentoId) === casos.A.encomendaId,
    "D-02: o orçamento A deveria continuar ligado ao mesmo id, agora da ordem.",
  );
  afirmar(
    vinculoDe.get(casos.B.orcamentoId) === null && vinculoDe.get(casos.C.orcamentoId) === null,
    `D-02: os orçamentos B (venda cancelada) e C (encomenda concluída) deveriam ter encomenda_id nulo, veio B=${vinculoDe.get(casos.B.orcamentoId)} C=${vinculoDe.get(casos.C.orcamentoId)}.`,
  );

  // O livro: a baixa da encomenda que virou ordem continua ligada; a da que não virou perde o
  // vínculo e guarda a nota (o nome congelado).
  const { rows: livro } = await cliente.query(
    "select id, encomenda_id, nota from movimentacoes_estoque where id = any($1::uuid[])",
    [[baixas.A, baixas.C]],
  );
  const baixaDe = new Map(livro.map((linha) => [linha.id, linha]));
  afirmar(
    baixaDe.get(baixas.A).encomenda_id === casos.A.encomendaId &&
      baixaDe.get(baixas.A).nota === "[migracao] Encomenda A",
    `D-02: a baixa da encomenda A deveria continuar ligada à ordem de mesmo id, veio ${JSON.stringify(baixaDe.get(baixas.A))}.`,
  );
  afirmar(
    baixaDe.get(baixas.C).encomenda_id === null &&
      baixaDe.get(baixas.C).nota === "[migracao] Encomenda C",
    `D-02: a baixa da encomenda C (concluída, não virou ordem) deveria ficar sem vínculo e com a nota intacta, veio ${JSON.stringify(baixaDe.get(baixas.C))}.`,
  );

  // A chave estrangeira é da ORDEM: um uuid qualquer em `orcamentos.encomenda_id` dá 23503.
  const { codigo, restricao } = await erroDoBanco(() =>
    cliente.query("update orcamentos set encomenda_id = gen_random_uuid() where id = $1", [
      casos.B.orcamentoId,
    ]),
  );
  afirmar(
    codigo === "23503" && restricao === "orcamentos_encomenda_id_ordens_producao_id_fk",
    `D-02: orcamentos.encomenda_id com um uuid que não é de ordem deveria dar 23503 pela FK para ordens_producao, veio ${codigo} (${restricao}).`,
  );
}

// ————————————————————————————————————————————————————————————————————————————————————————————
// Fase 06.1, plano 14 — a `0025_remover-encomendas`, no MESMO banco próprio da prova do D-02, logo
// depois da `0024` (a ordem em que o dono as aplica, D-09). Ela só pode apagar as três tabelas e os
// dois tipos de Encomendas (T-06.1-54): as chaves estrangeiras das outras tabelas, a função
// compartilhada `tocar_atualizado_em()`, os gatilhos das tabelas da Produção e o dado migrado pela
// `0024` (a ordem, as etapas, as peças, o vínculo do orçamento e o da baixa) ficam iguais.
// ————————————————————————————————————————————————————————————————————————————————————————————
const TABELAS_DE_ENCOMENDAS = ["encomendas", "encomenda_itens", "encomenda_etapas"];
const TIPOS_DE_ENCOMENDAS = ["status_encomenda", "etapa_encomenda"];

// O que a `0025` não pode mudar — lido antes e depois dela, comparado como texto.
async function retratoForaDeEncomendas(cliente, semente) {
  const { rows: chaves } = await cliente.query(
    `select conrelid::regclass::text as tabela, conname, pg_get_constraintdef(oid) as definicao
       from pg_constraint
      where contype = 'f' and connamespace = 'public'::regnamespace
        and conrelid::regclass::text <> all($1::text[])
      order by 1, 2`,
    [TABELAS_DE_ENCOMENDAS],
  );
  const { rows: gatilhos } = await cliente.query(
    `select tgrelid::regclass::text as tabela, tgname
       from pg_trigger
      where not tgisinternal and tgrelid::regclass::text <> all($1::text[])
      order by 1, 2`,
    [TABELAS_DE_ENCOMENDAS],
  );
  const ordemId = semente.casos.A.encomendaId;
  const { rows: ordem } = await cliente.query(
    `select id, tipo, caminho, status, nome, cliente_nome, entrega_prometida::text as entrega,
            inicio, criado_por
       from ordens_producao where id = $1`,
    [ordemId],
  );
  const { rows: etapas } = await cliente.query(
    `select etapa, posicao, dias_previstos, feita_em, passaram
       from ordem_etapas where ordem_id = $1 order by posicao`,
    [ordemId],
  );
  const { rows: pecas } = await cliente.query(
    `select posicao, ficha_id, descricao, quantidade, a_mais, cor, personalizacao
       from ordem_pecas where ordem_id = $1 order by posicao`,
    [ordemId],
  );
  const { rows: vinculos } = await cliente.query(
    `select (select encomenda_id from orcamentos where id = $1) as orcamento_a,
            (select encomenda_id from movimentacoes_estoque where id = $2) as baixa_a,
            (select count(*) from ordens_producao)::int as ordens`,
    [semente.casos.A.orcamentoId, semente.baixas.A],
  );
  return { chaves, gatilhos, ordem, etapas, pecas, vinculos };
}

async function conferirRemocaoDasEncomendas(cliente, antes, depois) {
  const { rows: tabelas } = await cliente.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1::text[])`,
    [TABELAS_DE_ENCOMENDAS],
  );
  afirmar(
    tabelas.length === 0,
    `0025: as tabelas de Encomendas deveriam ter sumido, ainda existem ${tabelas.map((t) => t.table_name).join(", ")}.`,
  );
  const { rows: tipos } = await cliente.query(
    "select typname from pg_type where typname = any($1::text[])",
    [TIPOS_DE_ENCOMENDAS],
  );
  afirmar(
    tipos.length === 0,
    `0025: os tipos status_encomenda e etapa_encomenda deveriam ter sumido, ainda existem ${tipos.map((t) => t.typname).join(", ")}.`,
  );
  const { rows: funcao } = await cliente.query(
    "select 1 from pg_proc where proname = 'tocar_atualizado_em' and pronamespace = 'public'::regnamespace",
  );
  afirmar(funcao.length === 1, "0025: a função compartilhada tocar_atualizado_em() deveria continuar existindo.");
  const { rows: gatilhosDeEncomendas } = await cliente.query(
    "select tgname from pg_trigger where tgname like 'tocar_atualizado_em_encomenda%'",
  );
  afirmar(
    gatilhosDeEncomendas.length === 0,
    `0025: os gatilhos das tabelas de Encomendas deveriam ter sumido com elas, restam ${gatilhosDeEncomendas.map((g) => g.tgname).join(", ")}.`,
  );
  for (const parte of ["chaves", "gatilhos", "ordem", "etapas", "pecas", "vinculos"]) {
    afirmar(
      JSON.stringify(depois[parte]) === JSON.stringify(antes[parte]),
      `0025: "${parte}" fora de Encomendas mudou — antes ${JSON.stringify(antes[parte])}, depois ${JSON.stringify(depois[parte])}.`,
    );
  }
  afirmar(
    antes.ordem.length === 1 && antes.etapas.length === 6 && antes.pecas.length === 2,
    `0025: a prova deveria comparar a ordem migrada com as 6 etapas e as 2 peças — veio ${JSON.stringify({ ordem: antes.ordem.length, etapas: antes.etapas.length, pecas: antes.pecas.length })}.`,
  );
  afirmar(
    antes.chaves.some((chave) => chave.conname === "orcamentos_encomenda_id_ordens_producao_id_fk") &&
      antes.gatilhos.some((gatilho) => gatilho.tgname === "tocar_atualizado_em_ordens_producao"),
    "0025: o retrato deveria incluir a chave do orçamento para a ordem e o gatilho da ordem (senão a comparação não prova nada).",
  );
}

async function provarMigracaoDaProducaoEmBancoProprio() {
  // (1) 0000..0023, os três casos, e só então a 0024 — e, no mesmo banco, a 0025.
  const comDado = await criarBancoProprio("producao");
  try {
    console.log(`Provando o D-02 da 0024 sobre dado existente, em banco proprio ("${comDado.nome}")...`);
    const cliente = new Client({ connectionString: comDado.url });
    await cliente.connect();
    try {
      await aplicarMigracoesAte(cliente, 23);
      const semente = await semearCasosDoD02(cliente);
      await aplicarMigracoesAte(cliente, 24, 24);
      await conferirDadoDoD02(cliente, semente);

      console.log("Provando a 0025 (apaga as tabelas de Encomendas) no mesmo banco, depois da 0024...");
      const antes = await retratoForaDeEncomendas(cliente, semente);
      await aplicarMigracoesAte(cliente, 25, 25);
      const depois = await retratoForaDeEncomendas(cliente, semente);
      await conferirRemocaoDasEncomendas(cliente, antes, depois);
    } finally {
      await cliente.end();
    }
  } finally {
    await comDado.apagar();
  }

  // (2) Sem nenhum orçamento, o D-02 não faz nada (PRD-02 · idempotency, D-02: "se não houver
  // nenhum, a migração não faz nada").
  const vazio = await criarBancoProprio("producao_vazio");
  try {
    console.log(`Provando o D-02 sem nenhum caso, em banco proprio ("${vazio.nome}")...`);
    const cliente = new Client({ connectionString: vazio.url });
    await cliente.connect();
    try {
      await aplicarMigracoesAte(cliente, 24);
      const { rows } = await cliente.query(
        `select (select count(*) from ordens_producao)::int as ordens,
                (select count(*) from ordem_etapas)::int as etapas,
                (select count(*) from ordem_pecas)::int as pecas`,
      );
      afirmar(
        rows[0].ordens === 0 && rows[0].etapas === 0 && rows[0].pecas === 0,
        `D-02 sem nenhum orçamento aprovado deveria não inserir nada, veio ${JSON.stringify(rows[0])}.`,
      );
    } finally {
      await cliente.end();
    }
  } finally {
    await vazio.apagar();
  }

  // (3) No banco comum, um segundo `db:migrate` não reaplica nada (journal do Drizzle): sai 0, o
  // journal não cresce e as ordens não mudam.
  console.log("Rodando o migrador uma segunda vez no banco comum (nao deve reaplicar nada)...");
  const comum = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await comum.connect();
  try {
    const contar = async () =>
      (
        await comum.query(
          `select (select count(*) from ordens_producao)::int as ordens,
                  (select count(*) from drizzle.__drizzle_migrations)::int as journal`,
        )
      ).rows[0];
    const antes = await contar();
    afirmar(
      antes.journal === entradasDoJournal().length,
      `O journal do Drizzle no banco comum deveria ter ${entradasDoJournal().length} migrações, tem ${antes.journal}.`,
    );
    // `execSync` lança se o migrador sair diferente de 0.
    rodarNpm("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
    });
    const depois = await contar();
    afirmar(
      depois.journal === antes.journal && depois.ordens === antes.ordens,
      `Um segundo db:migrate não deveria reaplicar nada — antes ${JSON.stringify(antes)}, depois ${JSON.stringify(depois)}.`,
    );
  } finally {
    await comum.end();
  }
}

// Fase 5 — Agenda. `conferirAgenda` prova, no banco comum, cada invariante da 0026 (plano 05-02;
// a versão mínima do 05-01 conferia só a semente, o gatilho e um 42501), no molde de
// `conferirProducao`: a conexão de DONO semeia e limpa; `amassa_app` (por `set local role`) prova
// privilégio. Cada recusa confere o SQLSTATE E o nome da restrição — uma recusa por outro motivo
// não passa por esta. Os casos que só testam rodam entre `begin`/`rollback`; o dado de prova que
// precisa existir é comitado e sai no fim por `apagarDadosDeProvaDaAgenda`.
//
//   1. privilégio — 42501 ao apagar clientes, turmas, turma_alunos, mensalidades; delete aceito
//      em eventos (fechado), inscricoes, usos_livres (reservado) e usos_livres_material (AGE-05);
//   2. chaves — 23505 (eventos_turma_data_uk, inscricoes_evento_cliente_uk,
//      mensalidades_turma_cliente_mes_uk, turma_alunos_ativo_uk que reabre depois de `saiu_em`);
//   3. D-02 na chave — dois `on conflict (turma_id, cliente_id, mes) do nothing` deixam UMA linha;
//   4. checks — 23514, um caso por check;
//   5. D-01 — documento sem `cliente_id` continua entrando;
//   6. D-06 — o destino `uso_livre` comparado como texto, usável depois do commit;
//   7. AGE-20 — uso livre com baixa não se apaga (23503);
//   8. D-17 — o gatilho `travar_item_do_sistema` (P0001) pelo dono e por `amassa_app`;
//   9. semente — os três itens e as duas categorias; reexecutar o trecho não duplica;
//  10. `nome_normalizado()`.
const FRASE_DO_ITEM_DO_SISTEMA = "Este item é usado pela Agenda e não se desativa";

async function apagarDadosDeProvaDaAgenda(
  conexao,
  { clienteIds = [], turmaIds = [], itemIds = [], usuarioId = null },
) {
  try {
    await conexao.query("begin");
    // Ordem das FKs: livro → material → uso livre → inscrição → mensalidade → matrícula → evento
    // → turma → cliente → item → usuária. Tudo pela conexão de DONO (o `revoke` vale só para
    // `amassa_app`; o livro não tem `delete` para ela desde a 0023).
    await conexao.query("delete from movimentacoes_estoque where item_id = any($1::uuid[])", [itemIds]);
    await conexao.query(
      `delete from usos_livres_material
        where uso_livre_id in (select id from usos_livres where cliente_id = any($1::uuid[]))`,
      [clienteIds],
    );
    await conexao.query("delete from usos_livres where cliente_id = any($1::uuid[])", [clienteIds]);
    await conexao.query("delete from inscricoes where cliente_id = any($1::uuid[])", [clienteIds]);
    await conexao.query("delete from mensalidades where cliente_id = any($1::uuid[])", [clienteIds]);
    await conexao.query("delete from turma_alunos where cliente_id = any($1::uuid[])", [clienteIds]);
    await conexao.query(
      "delete from eventos where turma_id = any($1::uuid[]) or titulo like '[prova]%'",
      [turmaIds],
    );
    await conexao.query("delete from turmas where id = any($1::uuid[])", [turmaIds]);
    await conexao.query("delete from clientes where id = any($1::uuid[])", [clienteIds]);
    await conexao.query("delete from itens_catalogo where id = any($1::uuid[])", [itemIds]);
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado — mesma razão da faxina do Estoque.
    console.error(`Agenda: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

// O trecho da semente da 0026, entre os marcadores, partido no marcador de instrução do Drizzle —
// só os pedaços com SQL de verdade (os comentários puros ficam de fora).
function trechoDaSementeDaAgenda() {
  const sql = readFileSync(path.join("db", "migrations", "0026_agenda.sql"), "utf8");
  const inicio = sql.indexOf("-- >>> semente da Agenda");
  const fim = sql.indexOf("-- <<< semente da Agenda");
  afirmar(inicio >= 0 && fim > inicio, "Agenda: os marcadores da semente sumiram da 0026.");
  return sql
    .slice(inicio, fim)
    .split("--> statement-breakpoint")
    .map((pedaco) =>
      pedaco
        .split(/\r?\n/)
        .filter((linha) => !linha.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((pedaco) => pedaco.length > 0);
}

async function conferirAgenda(conexao) {
  console.log("  conferirAgenda...");

  // ——— 9. Semente (D-04, AGE-17) ———————————————————————————————————————————————————————————————
  async function lerItensDoSistema() {
    const { rows } = await conexao.query(
      `select i.chave_do_sistema, i.nome, i.preco_venda_centavos, i.aparece_na_venda,
              i.controla_estoque, i.ativo, c.nome as categoria, c.grupo, c.area
         from itens_catalogo i
         join categorias c on c.id = i.categoria_venda_id
        where i.chave_do_sistema is not null
          -- a 0030 acrescentou os itens das Queimas; esta conferência é da Agenda
          and i.chave_do_sistema in ('mensalidade', 'inscricao_oficina', 'uso_livre_hora')
        order by i.chave_do_sistema`,
    );
    return rows;
  }
  async function contarCategoriasDaSemente() {
    const { rows } = await conexao.query(
      `select nome, count(*)::int as quantas from categorias
        where lower(trim(nome)) in (lower('Aulas e oficinas'), lower('Uso do espaço'))
        group by nome order by nome`,
    );
    return rows;
  }
  const esperados = [
    ["inscricao_oficina", "Inscrição em oficina", "Aulas e oficinas"],
    ["mensalidade", "Mensalidade", "Aulas e oficinas"],
    ["uso_livre_hora", "Uso livre (hora)", "Uso do espaço"],
  ];
  function conferirSemente(itens, momento) {
    afirmar(
      itens.length === esperados.length,
      `Agenda (${momento}): deveria haver ${esperados.length} itens do sistema, vieram ${itens.length}.`,
    );
    for (const [indice, [chave, nome, categoria]] of esperados.entries()) {
      const item = itens[indice];
      afirmar(
        item.chave_do_sistema === chave && item.nome === nome && item.categoria === categoria,
        `Agenda (${momento}): o item do sistema "${chave}" deveria se chamar "${nome}" na categoria "${categoria}", veio ${JSON.stringify(item)}.`,
      );
      afirmar(
        item.preco_venda_centavos === null &&
          item.aparece_na_venda === true &&
          item.controla_estoque === false &&
          item.ativo === true &&
          item.grupo === "receita" &&
          item.area === "espaco",
        `Agenda (${momento}): o item do sistema "${chave}" deveria nascer sem preço, na venda, sem estoque, ativo, numa categoria receita/espaco — veio ${JSON.stringify(item)}.`,
      );
    }
  }
  function conferirCategorias(categorias, momento) {
    afirmar(
      categorias.length === 2 && categorias.every((c) => c.quantas === 1),
      `Agenda (${momento}): "Aulas e oficinas" e "Uso do espaço" deveriam existir uma vez cada, veio ${JSON.stringify(categorias)}.`,
    );
  }
  conferirSemente(await lerItensDoSistema(), "depois da 0026");
  conferirCategorias(await contarCategoriasDaSemente(), "depois da 0026");

  // Idempotência: o trecho da semente roda DE NOVO — nada duplica (chave única e `where not exists`).
  const pedacosDaSemente = trechoDaSementeDaAgenda();
  afirmar(
    pedacosDaSemente.length === 5,
    `Agenda: o trecho da semente deveria ter 5 instruções (2 categorias + 3 itens), tem ${pedacosDaSemente.length}.`,
  );
  await conexao.query("begin");
  try {
    for (const pedaco of pedacosDaSemente) {
      await conexao.query(pedaco);
    }
    conferirSemente(await lerItensDoSistema(), "semente reexecutada");
    conferirCategorias(await contarCategoriasDaSemente(), "semente reexecutada");
  } finally {
    await conexao.query("rollback");
  }

  // ——— 10. nome_normalizado() ——————————————————————————————————————————————————————————————————
  const { rows: normalizados } = await conexao.query(
    "select nome_normalizado('  JOÃO  da  Silva ') as joao, nome_normalizado('Ação') as acao",
  );
  afirmar(
    normalizados[0].joao === "joao da silva" && normalizados[0].acao === "acao",
    `Agenda: nome_normalizado deveria tirar acento, baixar a caixa e colapsar espaços, veio ${JSON.stringify(normalizados[0])}.`,
  );

  // ——— Semente da prova (dono, comitada) ——————————————————————————————————————————————————————
  const { rows: usuarioInserido } = await conexao.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste da Agenda [migracao]', 'usuaria-agenda@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;
  const clienteIds = [];
  const turmaIds = [];
  const itemIds = [];

  async function umaLinha(sql, parametros = []) {
    const { rows } = await conexao.query(sql, parametros);
    return rows[0];
  }
  // Roda e desfaz: o código do erro (ou `null`) e o nome da restrição.
  async function tentar(sql, parametros = []) {
    await conexao.query("begin");
    try {
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }
  async function comoAmassaApp(sql, parametros = []) {
    await conexao.query("begin");
    try {
      await conexao.query("set local role amassa_app");
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }
  function esperar(resultado, codigoEsperado, restricoes, descricao) {
    afirmar(
      resultado.codigo === codigoEsperado &&
        (restricoes === null || restricoes.includes(resultado.restricao)),
      `Agenda: ${descricao} deveria dar ${codigoEsperado}` +
        (restricoes ? ` (${restricoes.join(" ou ")})` : "") +
        `, veio ${resultado.codigo} (${resultado.restricao}).`,
    );
  }

  try {
    const clienteA = (
      await umaLinha("insert into clientes (nome) values ('[prova] Cliente A') returning id")
    ).id;
    const clienteB = (
      await umaLinha("insert into clientes (nome) values ('[prova] Cliente B') returning id")
    ).id;
    clienteIds.push(clienteA, clienteB);
    const turmaId = (
      await umaLinha(
        `insert into turmas (nome, dia_semana, inicio, fim, vagas, mensalidade_centavos, dia_vencimento, criado_por)
         values ('[prova] Turma', 2, '19:00', '21:00', 8, 20000, 10, $1) returning id`,
        [usuarioId],
      )
    ).id;
    turmaIds.push(turmaId);
    const eventoDaTurma = (
      await umaLinha(
        `insert into eventos (tipo, data, inicio, fim, vagas, turma_id)
         values ('turma', current_date, '19:00', '21:00', 8, $1) returning id`,
        [turmaId],
      )
    ).id;
    const oficina = (
      await umaLinha(
        `insert into eventos (tipo, data, inicio, fim, vagas, titulo, preco_centavos)
         values ('avulsa', current_date, '14:00', '17:00', 10, '[prova] Oficina', 15000) returning id`,
      )
    ).id;
    const fechado = (
      await umaLinha(
        "insert into eventos (tipo, data, titulo) values ('fechado', current_date, '[prova] Fechado') returning id",
      )
    ).id;
    const inscricao = (
      await umaLinha(
        `insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos)
         values ($1, $2, 'oficina', true, 15000) returning id`,
        [oficina, clienteA],
      )
    ).id;
    const matricula = (
      await umaLinha(
        `insert into turma_alunos (turma_id, cliente_id, entrou_em)
         values ($1, $2, current_date) returning id`,
        [turmaId, clienteA],
      )
    ).id;
    await conexao.query(
      `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
       values ($1, $2, date_trunc('month', current_date)::date,
               20000, date_trunc('month', current_date)::date + 9)`,
      [turmaId, clienteA],
    );
    const usoReservado = (
      await umaLinha(
        `insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas)
         values ($1, current_date, '14:00', 2, 1) returning id`,
        [clienteA],
      )
    ).id;
    const usoComMaterial = (
      await umaLinha(
        `insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada)
         values ($1, current_date, '14:00', 2, 1, 'no_espaco', '14:05') returning id`,
        [clienteA],
      )
    ).id;
    const usoComBaixa = (
      await umaLinha(
        `insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada)
         values ($1, current_date, '15:00', 1, 1, 'no_espaco', '15:00') returning id`,
        [clienteB],
      )
    ).id;
    const categoriaCompraId = (
      await umaLinha("select id from categorias where nome = 'Argila, esmalte e insumos'")
    ).id;
    const itemId = (
      await umaLinha(
        `insert into itens_catalogo (nome, controla_estoque, unidade, categoria_compra_id)
         values ('Argila de prova da Agenda [migracao]', true, 'kg', $1) returning id`,
        [categoriaCompraId],
      )
    ).id;
    itemIds.push(itemId);
    const material = (
      await umaLinha(
        `insert into usos_livres_material (uso_livre_id, item_id, quantidade_milesimos, cobrar)
         values ($1, $2, 1000, false) returning id`,
        [usoComMaterial, itemId],
      )
    ).id;
    await inserirMovimentacao(conexao, {
      item_id: itemId,
      registrado_por: usuarioId,
      origem: "manual",
      tipo: "entrada",
      quantidade_milesimos: 5000,
      valor_centavos: 2100,
      valor_informado_centavos: 2100,
    });

    // ——— 1. Privilégio ——————————————————————————————————————————————————————————————————————
    for (const [tabela, id] of [
      ["clientes", clienteB],
      ["turmas", turmaId],
      ["turma_alunos", matricula],
    ]) {
      esperar(
        await comoAmassaApp(`delete from ${tabela} where id = $1`, [id]),
        "42501",
        null,
        `apagar de ${tabela} como amassa_app (revoke delete da 0026)`,
      );
    }
    esperar(
      await comoAmassaApp("delete from mensalidades where cliente_id = $1", [clienteA]),
      "42501",
      null,
      "apagar de mensalidades como amassa_app (revoke delete da 0026)",
    );
    // AGE-05: o que se remove, sempre por ação — aceito (e desfeito).
    for (const [tabela, id] of [
      ["eventos", fechado],
      ["inscricoes", inscricao],
      ["usos_livres", usoReservado],
      ["usos_livres_material", material],
    ]) {
      esperar(
        await comoAmassaApp(`delete from ${tabela} where id = $1`, [id]),
        null,
        null,
        `apagar de ${tabela} como amassa_app (AGE-05)`,
      );
    }

    // ——— 2. Chaves (23505) ———————————————————————————————————————————————————————————————————
    esperar(
      await tentar(
        `insert into eventos (tipo, data, inicio, fim, vagas, turma_id)
         values ('turma', current_date, '19:00', '21:00', 8, $1)`,
        [turmaId],
      ),
      "23505",
      ["eventos_turma_data_uk"],
      "uma segunda data da mesma turma no mesmo dia",
    );
    esperar(
      await tentar(
        `insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos)
         values ($1, $2, 'oficina', true, 15000)`,
        [oficina, clienteA],
      ),
      "23505",
      ["inscricoes_evento_cliente_uk"],
      "uma segunda inscrição do mesmo cliente no mesmo evento",
    );
    esperar(
      await tentar(
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
         values ($1, $2, date_trunc('month', current_date)::date,
                 20000, date_trunc('month', current_date)::date + 9)`,
        [turmaId, clienteA],
      ),
      "23505",
      ["mensalidades_turma_cliente_mes_uk"],
      "uma segunda mensalidade do mesmo trio turma/cliente/mês",
    );
    esperar(
      await tentar(
        "insert into turma_alunos (turma_id, cliente_id, entrou_em) values ($1, $2, current_date)",
        [turmaId, clienteA],
      ),
      "23505",
      ["turma_alunos_ativo_uk"],
      "um segundo vínculo ATIVO do mesmo aluno na mesma turma",
    );
    // Depois de `saiu_em` no primeiro, o índice parcial volta a aceitar o mesmo aluno.
    await conexao.query("begin");
    try {
      await conexao.query("update turma_alunos set saiu_em = current_date where id = $1", [matricula]);
      const reentrada = await erroDoBanco(() =>
        conexao.query(
          "insert into turma_alunos (turma_id, cliente_id, entrou_em) values ($1, $2, current_date)",
          [turmaId, clienteA],
        ),
      );
      esperar(reentrada, null, null, "voltar à turma depois de saiu_em (turma_alunos_ativo_uk é parcial)");
    } finally {
      await conexao.query("rollback");
    }
    // Duas avulsas no mesmo dia (turma_id nulo) não colidem na eventos_turma_data_uk.
    esperar(
      await tentar(
        `insert into eventos (tipo, data, inicio, fim, vagas, titulo, preco_centavos)
         values ('avulsa', current_date, '09:00', '11:00', 6, '[prova] Outra oficina', 9000)`,
      ),
      null,
      null,
      "uma segunda avulsa no mesmo dia, sem turma",
    );

    // ——— 3. D-02 na chave: on conflict do nothing duas vezes → uma linha ——————————————————————
    await conexao.query("begin");
    try {
      for (let vez = 0; vez < 2; vez += 1) {
        await conexao.query(
          `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
           values ($1, $2, date_trunc('month', current_date)::date,
                   20000, date_trunc('month', current_date)::date + 9)
           on conflict (turma_id, cliente_id, mes) do nothing`,
          [turmaId, clienteB],
        );
      }
      const { rows } = await conexao.query(
        "select count(*)::int as quantas from mensalidades where turma_id = $1 and cliente_id = $2",
        [turmaId, clienteB],
      );
      afirmar(
        rows[0].quantas === 1,
        `Agenda (D-02): dois inserts on conflict do nothing do mesmo trio deveriam deixar UMA mensalidade, deixaram ${rows[0].quantas}.`,
      );
    } finally {
      await conexao.query("rollback");
    }

    // ——— 4. Checks (23514) ——————————————————————————————————————————————————————————————————
    const MES = "date_trunc('month', current_date)::date";
    const recusas = [
      // eventos
      [
        "fechado com horário",
        "insert into eventos (tipo, data, titulo, inicio, fim) values ('fechado', current_date, '[prova] X', '09:00', '10:00')",
        [],
        ["eventos_fechado_sem_aula"],
      ],
      [
        "data de turma sem horário",
        "insert into eventos (tipo, data, vagas, turma_id) values ('turma', current_date + 1, 8, $1)",
        [turmaId],
        ["eventos_aula_com_horario"],
      ],
      [
        "avulsa com fim <= início",
        "insert into eventos (tipo, data, inicio, fim, vagas, titulo, preco_centavos) values ('avulsa', current_date, '10:00', '10:00', 6, '[prova] X', 100)",
        [],
        ["eventos_aula_com_horario"],
      ],
      [
        "avulsa sem preço",
        "insert into eventos (tipo, data, inicio, fim, vagas, titulo) values ('avulsa', current_date, '10:00', '11:00', 6, '[prova] X')",
        [],
        ["eventos_avulsa_com_titulo_e_preco"],
      ],
      [
        "tipo turma sem turma_id",
        "insert into eventos (tipo, data, inicio, fim, vagas) values ('turma', current_date, '10:00', '11:00', 6)",
        [],
        ["eventos_turma_so_no_tipo_turma"],
      ],
      [
        "avulsa com turma_id",
        "insert into eventos (tipo, data, inicio, fim, vagas, titulo, preco_centavos, turma_id) values ('avulsa', current_date + 2, '10:00', '11:00', 6, '[prova] X', 100, $1)",
        [turmaId],
        ["eventos_turma_so_no_tipo_turma"],
      ],
      [
        "evento com 0 vagas",
        "insert into eventos (tipo, data, inicio, fim, vagas, titulo, preco_centavos) values ('avulsa', current_date, '10:00', '11:00', 0, '[prova] X', 100)",
        [],
        ["eventos_vagas_faixa"],
      ],
      [
        "evento com 1000 vagas",
        "insert into eventos (tipo, data, inicio, fim, vagas, titulo, preco_centavos) values ('avulsa', current_date, '10:00', '11:00', 1000, '[prova] X', 100)",
        [],
        ["eventos_vagas_faixa"],
      ],
      // turmas
      [
        "turma com 0 vagas",
        "insert into turmas (nome, dia_semana, inicio, fim, vagas, mensalidade_centavos, dia_vencimento) values ('[prova] X', 1, '19:00', '21:00', 0, 100, 10)",
        [],
        ["turmas_vagas_faixa"],
      ],
      [
        "turma com vencimento no dia 29",
        "insert into turmas (nome, dia_semana, inicio, fim, vagas, mensalidade_centavos, dia_vencimento) values ('[prova] X', 1, '19:00', '21:00', 8, 100, 29)",
        [],
        ["turmas_dia_vencimento_faixa"],
      ],
      [
        "turma no dia da semana 7",
        "insert into turmas (nome, dia_semana, inicio, fim, vagas, mensalidade_centavos, dia_vencimento) values ('[prova] X', 7, '19:00', '21:00', 8, 100, 10)",
        [],
        ["turmas_dia_semana_faixa"],
      ],
      [
        "turma ativa com desativada_em",
        "update turmas set desativada_em = now(), desativada_por = $2 where id = $1",
        [turmaId, usuarioId],
        ["turmas_ativa_coerente"],
      ],
      [
        "turma com fim <= início",
        "update turmas set fim = '19:00' where id = $1",
        [turmaId],
        ["turmas_fim_depois_do_inicio"],
      ],
      // mensalidades (cliente B: a chave do trio não interfere)
      [
        "mensalidade com mês no dia 2",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento) values ($1, $2, ${MES} + 1, 100, ${MES} + 9)`,
        [turmaId, clienteB],
        ["mensalidades_mes_primeiro_dia", "mensalidades_vencimento_no_mes"],
      ],
      [
        "mensalidade com vencimento noutro mês",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento) values ($1, $2, ${MES}, 100, (${MES} + interval '1 month')::date)`,
        [turmaId, clienteB],
        ["mensalidades_vencimento_no_mes"],
      ],
      [
        "mensalidade com valor 0",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento) values ($1, $2, ${MES}, 0, ${MES} + 9)`,
        [turmaId, clienteB],
        ["mensalidades_valor_faixa"],
      ],
      [
        "mensalidade proporcional com aulas_restantes = aulas_no_mes",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento, aulas_restantes, aulas_no_mes) values ($1, $2, ${MES}, 100, ${MES} + 9, 4, 4)`,
        [turmaId, clienteB],
        ["mensalidades_proporcional_faixa"],
      ],
      [
        "mensalidade proporcional só com aulas_restantes",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento, aulas_restantes) values ($1, $2, ${MES}, 100, ${MES} + 9, 2)`,
        [turmaId, clienteB],
        ["mensalidades_proporcional_junto"],
      ],
      [
        "mensalidade com motivo de 201 caracteres",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento, dispensada_em, dispensada_por, motivo_dispensa) values ($1, $2, ${MES}, 100, ${MES} + 9, now(), $3, repeat('a', 201))`,
        [turmaId, clienteB, usuarioId],
        ["mensalidades_motivo_so_com_dispensa"],
      ],
      [
        "mensalidade dispensada sem dispensada_por",
        `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento, dispensada_em) values ($1, $2, ${MES}, 100, ${MES} + 9, now())`,
        [turmaId, clienteB],
        ["mensalidades_dispensada_por"],
      ],
      // inscrições (cliente B: a chave evento/cliente não interfere)
      [
        "reposição cobrando",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos) values ($1, $2, 'reposicao', true, 100)",
        [eventoDaTurma, clienteB],
        ["inscricoes_reposicao_nao_cobra"],
      ],
      [
        "aluno cobrando",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos) values ($1, $2, 'aluno', true, 100)",
        [eventoDaTurma, clienteB],
        ["inscricoes_aluno_nao_cobra"],
      ],
      [
        "oficina sem cobrar",
        "insert into inscricoes (evento_id, cliente_id, tipo) values ($1, $2, 'oficina')",
        [oficina, clienteB],
        ["inscricoes_oficina_cobra"],
      ],
      [
        "cobrar sem valor",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar) values ($1, $2, 'experimental', true)",
        [eventoDaTurma, clienteB],
        ["inscricoes_cobrar_com_valor"],
      ],
      [
        "direito a repor sem falta",
        "insert into inscricoes (evento_id, cliente_id, tipo, direito_a_repor) values ($1, $2, 'aluno', true)",
        [eventoDaTurma, clienteB],
        ["inscricoes_direito_so_com_falta"],
      ],
      [
        "direito a repor numa oficina",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos, presenca, direito_a_repor) values ($1, $2, 'oficina', true, 100, 'faltou', true)",
        [oficina, clienteB],
        ["inscricoes_direito_so_com_falta"],
      ],
      [
        // O check roda antes da chave estrangeira: um id qualquer basta para isolar a recusa.
        "venda numa inscrição que não cobra",
        "insert into inscricoes (evento_id, cliente_id, tipo, documento_id) values ($1, $2, 'aluno', gen_random_uuid())",
        [eventoDaTurma, clienteB],
        ["inscricoes_venda_so_cobrada"],
      ],
      [
        "dispensa sem dispensada_por",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos, dispensada_em) values ($1, $2, 'oficina', true, 100, now())",
        [oficina, clienteB],
        ["inscricoes_dispensada_por"],
      ],
      [
        "motivo sem dispensa",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos, motivo_dispensa) values ($1, $2, 'oficina', true, 100, 'motivo')",
        [oficina, clienteB],
        ["inscricoes_motivo_so_com_dispensa"],
      ],
      [
        "motivo de dispensa com 201 caracteres",
        "insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos, dispensada_em, dispensada_por, motivo_dispensa) values ($1, $2, 'oficina', true, 100, now(), $3, repeat('a', 201))",
        [oficina, clienteB, usuarioId],
        ["inscricoes_motivo_so_com_dispensa"],
      ],
      // usos livres
      [
        "uso livre reservado com chegada",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, chegada) values ($1, current_date, '14:00', 2, 1, '14:00')",
        [clienteB],
        ["usos_livres_chegada_por_estado"],
      ],
      [
        "uso livre encerrado sem saída",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada) values ($1, current_date, '14:00', 2, 1, 'encerrado', '14:00')",
        [clienteB],
        ["usos_livres_encerrado_completo"],
      ],
      [
        "uso livre com saída <= chegada",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada, saida, horas_cheias, preco_hora_centavos, valor_centavos) values ($1, current_date, '14:00', 2, 1, 'encerrado', '14:00', '13:00', 1, 100, 100)",
        [clienteB],
        ["usos_livres_saida_depois_da_chegada"],
      ],
      [
        "uso livre com 13 horas previstas",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas) values ($1, current_date, '14:00', 13, 1)",
        [clienteB],
        ["usos_livres_horas_previstas_faixa"],
      ],
      [
        "uso livre com 51 pessoas",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas) values ($1, current_date, '14:00', 2, 51)",
        [clienteB],
        ["usos_livres_pessoas_faixa"],
      ],
      // A dispensa do uso livre (0027 — decisão do dono no chat, 02/10/2026: só com a venda cancelada; a
      // venda cancelada é conferida pela ação sob trava, o check garante encerrado com venda). O check
      // roda antes da chave estrangeira: `gen_random_uuid()` basta como documento para isolar a recusa.
      [
        "uso livre dispensado sem dispensada_por",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada, saida, horas_cheias, preco_hora_centavos, valor_centavos, documento_id, dispensada_em) values ($1, current_date, '14:00', 2, 1, 'encerrado', '14:00', '16:00', 2, 100, 200, gen_random_uuid(), now())",
        [clienteB],
        ["usos_livres_dispensada_por"],
      ],
      [
        "uso livre com motivo sem dispensa",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, motivo_dispensa) values ($1, current_date, '14:00', 2, 1, 'motivo')",
        [clienteB],
        ["usos_livres_motivo_so_com_dispensa"],
      ],
      [
        "uso livre dispensado com motivo de 201 caracteres",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada, saida, horas_cheias, preco_hora_centavos, valor_centavos, documento_id, dispensada_em, dispensada_por, motivo_dispensa) values ($1, current_date, '14:00', 2, 1, 'encerrado', '14:00', '16:00', 2, 100, 200, gen_random_uuid(), now(), $2, repeat('a', 201))",
        [clienteB, usuarioId],
        ["usos_livres_motivo_so_com_dispensa"],
      ],
      [
        "uso livre reservado dispensado",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, dispensada_em, dispensada_por) values ($1, current_date, '14:00', 2, 1, now(), $2)",
        [clienteB, usuarioId],
        ["usos_livres_dispensa_so_com_venda"],
      ],
      [
        "uso livre encerrado dispensado sem venda",
        "insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada, saida, horas_cheias, preco_hora_centavos, valor_centavos, dispensada_em, dispensada_por) values ($1, current_date, '14:00', 2, 1, 'encerrado', '14:00', '16:00', 2, 100, 200, now(), $2)",
        [clienteB, usuarioId],
        ["usos_livres_dispensa_so_com_venda"],
      ],
      // material do uso livre
      [
        "material com quantidade 0",
        "insert into usos_livres_material (uso_livre_id, item_id, quantidade_milesimos, cobrar) values ($1, $2, 0, false)",
        [usoComMaterial, itemId],
        ["usos_livres_material_quantidade_positiva"],
      ],
      [
        "material incluso com preço congelado",
        "insert into usos_livres_material (uso_livre_id, item_id, quantidade_milesimos, cobrar, preco_unitario_centavos, valor_centavos) values ($1, $2, 1000, false, 100, 100)",
        [usoComMaterial, itemId],
        ["usos_livres_material_incluso_sem_preco"],
      ],
      [
        "material com preço sem valor",
        "insert into usos_livres_material (uso_livre_id, item_id, quantidade_milesimos, cobrar, preco_unitario_centavos) values ($1, $2, 1000, true, 100)",
        [usoComMaterial, itemId],
        ["usos_livres_material_preco_junto"],
      ],
      // documentos (D-01)
      [
        "documento com cliente_id e sem pessoa_nome",
        "insert into documentos (tipo, data, criado_por, cliente_id) values ('venda', current_date, $1, $2)",
        [usuarioId, clienteA],
        ["documentos_cliente_exige_pessoa_nome"],
      ],
    ];
    for (const [descricao, sql, parametros, restricoes] of recusas) {
      esperar(await tentar(sql, parametros), "23514", restricoes, descricao);
    }

    // A dispensa completa do uso livre encerrado com venda entra (0027). Entre begin/rollback, numa
    // instrução só: o documento nasce no CTE e a soma dele (0015, adiada) nunca chega a ser conferida.
    esperar(
      await tentar(
        `with venda as (
           insert into documentos (tipo, data, criado_por, cancelado_em, cancelado_por)
           values ('venda', current_date, $2, now(), $2) returning id
         )
         insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada, saida, horas_cheias, preco_hora_centavos, valor_centavos, documento_id, dispensada_em, dispensada_por, motivo_dispensa)
         select $1, current_date, '14:00', 2, 1, 'encerrado', '14:00', '16:00', 2, 100, 200, venda.id, now(), $2, 'venda cancelada no Caixa' from venda`,
        [clienteB, usuarioId],
      ),
      null,
      null,
      "um uso livre encerrado, com venda (cancelada) e dispensa completa",
    );

    // ——— 5. D-01: a Venda de hoje, sem cliente_id, continua entrando ————————————————————————
    // Entre begin/rollback: a soma do documento (0015) é adiada e nunca chega a ser conferida.
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por, pessoa_nome) values ('venda', current_date, $1, 'Pessoa de prova')",
        [usuarioId],
      ),
      null,
      null,
      "um documento de venda sem cliente_id (as colunas de hoje)",
    );
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por) values ('venda', current_date, $1)",
        [usuarioId],
      ),
      null,
      null,
      "um documento de venda sem cliente_id nem pessoa_nome",
    );

    // ——— 6. D-06: o valor novo do enum, usável depois do commit, e os dois checks em texto ———
    const saidaParaUsoLivre = {
      item_id: itemId,
      registrado_por: usuarioId,
      origem: "manual",
      tipo: "saida",
      area: "espaco",
      quantidade_milesimos: -1000,
      valor_centavos: -420,
    };
    const codigoDaBaixa = await codigoDoErro(() =>
      inserirMovimentacao(conexao, { ...saidaParaUsoLivre, destino: "uso_livre", uso_livre_id: usoComBaixa }),
    );
    afirmar(
      codigoDaBaixa === null,
      `Agenda (D-06): uma saída manual com destino uso_livre e o vínculo deveria passar, veio ${codigoDaBaixa}.`,
    );
    esperar(
      await tentar(
        `insert into movimentacoes_estoque (item_id, registrado_por, origem, tipo, area, quantidade_milesimos, valor_centavos, destino)
         values ($1, $2, 'manual', 'saida', 'espaco', -1000, -420, 'uso_livre')`,
        [itemId, usuarioId],
      ),
      "23514",
      ["movimentacoes_estoque_destino_uso_livre_com_vinculo"],
      "destino uso_livre sem uso_livre_id",
    );
    esperar(
      await tentar(
        `insert into movimentacoes_estoque (item_id, registrado_por, origem, tipo, area, quantidade_milesimos, valor_centavos, destino, uso_livre_id)
         values ($1, $2, 'manual', 'saida', 'espaco', -1000, -420, 'aula', $3)`,
        [itemId, usuarioId, usoComBaixa],
      ),
      "23514",
      ["movimentacoes_estoque_uso_livre_so_no_destino_uso_livre"],
      "uso_livre_id com destino aula",
    );

    // ——— 7. AGE-20: uso livre com baixa não se apaga ————————————————————————————————————————
    esperar(
      await comoAmassaApp("delete from usos_livres where id = $1", [usoComBaixa]),
      "23503",
      ["movimentacoes_estoque_uso_livre_id_usos_livres_id_fk"],
      "apagar, como amassa_app, um uso livre com movimentação ligada (AGE-20)",
    );
    const { rows: baixaQueFica } = await conexao.query(
      "select count(*)::int as quantas from movimentacoes_estoque where uso_livre_id = $1",
      [usoComBaixa],
    );
    afirmar(
      baixaQueFica[0].quantas === 1,
      `Agenda (AGE-20): a baixa do uso livre deveria continuar no livro, há ${baixaQueFica[0].quantas}.`,
    );

    // ——— 8. D-17: o gatilho, pelo dono e por amassa_app ———————————————————————————————————
    const categoriaUsoDoEspaco = (
      await umaLinha("select id from categorias where nome = 'Uso do espaço'")
    ).id;
    for (const [quem, executar] of [
      ["o dono", tentar],
      ["amassa_app", comoAmassaApp],
    ]) {
      for (const [descricao, sql] of [
        ["desativar", "update itens_catalogo set ativo = false where chave_do_sistema = 'mensalidade'"],
        ["tirar da venda", "update itens_catalogo set aparece_na_venda = false where chave_do_sistema = 'mensalidade'"],
        ["trocar a chave", "update itens_catalogo set chave_do_sistema = 'uso_livre_hora' where chave_do_sistema = 'mensalidade'"],
        ["apagar", "delete from itens_catalogo where chave_do_sistema = 'mensalidade'"],
      ]) {
        await conexao.query("begin");
        try {
          if (quem === "amassa_app") {
            await conexao.query("set local role amassa_app");
          }
          let mensagem = "";
          let codigo = null;
          try {
            await conexao.query(sql);
          } catch (erro) {
            codigo = erro.code;
            mensagem = erro.message;
          }
          // `amassa_app` já não tem `delete` em `itens_catalogo` desde a 0015: o privilégio a barra
          // (42501) antes de o gatilho rodar. O gatilho no `delete` é provado pelo dono.
          if (quem === "amassa_app" && descricao === "apagar") {
            afirmar(
              codigo === "42501",
              `Agenda (D-17): apagar um item do sistema, por amassa_app, deveria falhar com 42501 (revoke da 0015), veio ${codigo} (${mensagem}).`,
            );
          } else {
            afirmar(
              codigo === "P0001" && mensagem.includes(FRASE_DO_ITEM_DO_SISTEMA),
              `Agenda (D-17): ${descricao} um item do sistema, por ${quem}, deveria falhar com P0001 e a frase do gatilho, veio ${codigo} (${mensagem}).`,
            );
          }
        } finally {
          await conexao.query("rollback");
        }
      }
      for (const [descricao, sql, parametros] of [
        ["renomear", "update itens_catalogo set nome = 'Mensalidade da turma' where chave_do_sistema = 'mensalidade'", []],
        ["pôr preço", "update itens_catalogo set preco_venda_centavos = 3500 where chave_do_sistema = 'uso_livre_hora'", []],
        ["trocar a categoria", "update itens_catalogo set categoria_venda_id = $1 where chave_do_sistema = 'mensalidade'", [categoriaUsoDoEspaco]],
      ]) {
        esperar(await executar(sql, parametros), null, null, `${descricao} um item do sistema, por ${quem}`);
      }
    }
    // Os updates aceitos foram desfeitos (rollback): a semente continua intacta.
    conferirSemente(await lerItensDoSistema(), "depois das provas do gatilho");
  } finally {
    await apagarDadosDeProvaDaAgenda(conexao, { clienteIds, turmaIds, itemIds, usuarioId });
  }

  const { rows: sobras } = await conexao.query(
    `select (select count(*) from clientes where nome like '[prova]%')::int as clientes,
            (select count(*) from turmas where nome like '[prova]%')::int as turmas,
            (select count(*) from eventos where titulo like '[prova]%')::int as eventos`,
  );
  afirmar(
    sobras[0].clientes === 0 && sobras[0].turmas === 0 && sobras[0].eventos === 0,
    `Agenda: a faxina deveria apagar todo o dado de prova, sobrou ${JSON.stringify(sobras[0])}.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Fase 06.2 — Fornecedores (plano 06.2-01, Tarefa 2): as bordas da 0028 no Postgres efêmero. Toda
// linha de prova leva "[mig]" no nome e é criada e apagada pela conexão de DONO (o `revoke delete`
// vale só para `amassa_app`); nenhum dado real, nenhum nome do protótipo.

async function apagarDadosDeProvaDosFornecedores(conexao, usuarioId) {
  try {
    await conexao.query("begin");
    // Ordem das FKs: anexo → fornecedor → usuária. Nenhum documento de prova é comitado (todos
    // vivem entre begin/rollback), então nada em `documentos` aponta para estes fornecedores.
    await conexao.query(
      `delete from fornecedor_anexos
        where fornecedor_id in (select id from fornecedores where nome ilike '%[mig]%' or criado_por = $1)`,
      [usuarioId],
    );
    await conexao.query("delete from fornecedores where nome ilike '%[mig]%' or criado_por = $1", [
      usuarioId,
    ]);
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado — mesma razão da faxina do Estoque e da Agenda.
    console.error(`Fornecedores: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

async function conferirFornecedores(conexao, url = process.env.DATABASE_URL_TESTE) {
  console.log("  conferirFornecedores...");

  async function umaLinha(sql, parametros = []) {
    const { rows } = await conexao.query(sql, parametros);
    return rows[0];
  }
  // Roda e desfaz: o código do erro (ou `null`) e o nome da restrição.
  async function tentar(sql, parametros = []) {
    await conexao.query("begin");
    try {
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }
  async function comoAmassaApp(sql, parametros = []) {
    await conexao.query("begin");
    try {
      await conexao.query("set local role amassa_app");
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }
  function esperar(resultado, codigoEsperado, restricoes, descricao) {
    afirmar(
      resultado.codigo === codigoEsperado &&
        (restricoes === null || restricoes.includes(resultado.restricao)),
      `Fornecedores: ${descricao} deveria dar ${codigoEsperado ?? "certo"}` +
        (restricoes ? ` (${restricoes.join(" ou ")})` : "") +
        `, veio ${resultado.codigo} (${resultado.restricao}).`,
    );
  }

  // ——— Nada retroativo (BRIEFING §4, D-04): antes de qualquer prova desta função, nenhum documento
  // do banco de teste tem fornecedor — a coluna nasceu nula em toda linha que já existia.
  const { rows: retroativos } = await conexao.query(
    `select count(*)::int as todos,
            count(*) filter (where fornecedor_id is not null)::int as com_fornecedor
       from documentos`,
  );
  afirmar(
    retroativos[0].com_fornecedor === 0,
    `Fornecedores: nenhum documento anterior deveria ter fornecedor_id (nada retroativo), mas ` +
      `${retroativos[0].com_fornecedor} de ${retroativos[0].todos} têm.`,
  );

  const { rows: usuarioInserido } = await conexao.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste dos Fornecedores [mig]', 'usuaria-fornecedores@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;

  async function inserirFornecedor(nome, extras = {}) {
    const colunas = ["nome", "area", "criado_por", "atualizado_por", ...Object.keys(extras)];
    const valores = [nome, "pecas", usuarioId, usuarioId, ...Object.values(extras)];
    const marcadores = valores.map((_, indice) => `$${indice + 1}`).join(", ");
    return (
      await umaLinha(
        `insert into fornecedores (${colunas.join(", ")}) values (${marcadores}) returning id`,
        valores,
      )
    ).id;
  }

  try {
    // ——— 1. Unicidade entre ativos, sem distinção de caixa nem de acento (D-06) ——————————————
    const argilaSul = await inserirFornecedor("[mig] Argila Sul");
    const repetidoDeOutraCaixa =
      "insert into fornecedores (nome, area, criado_por, atualizado_por) values (' [mig] argila sul ', 'pecas', $1, $1)";
    esperar(
      await tentar(repetidoDeOutraCaixa, [usuarioId]),
      "23505",
      ["fornecedores_nome_ativo_uk"],
      "um segundo ativo “ [mig] argila sul ” ao lado de “[mig] Argila Sul”",
    );
    // Com o primeiro desativado, o segundo grava — a unicidade é só entre ATIVOS.
    await conexao.query("update fornecedores set ativo = false where id = $1", [argilaSul]);
    const argilaSulDeNovo = await inserirFornecedor(" [mig] argila sul ");
    // Reativar o primeiro agora bate no índice (Pitfall 11).
    esperar(
      await tentar("update fornecedores set ativo = true where id = $1", [argilaSul]),
      "23505",
      ["fornecedores_nome_ativo_uk"],
      "reativar “[mig] Argila Sul” com “ [mig] argila sul ” ativo",
    );
    // Acento NÃO conta (D-06, troca do dono no chat, 03/10/2026 — `nome_normalizado()`):
    // “Argila Goias” e “Argila Goiás” não convivem ativos, nem com espaço dobrado no meio.
    const argilaGoias = await inserirFornecedor("[mig] Argila Goias");
    const goiasComAcento =
      "insert into fornecedores (nome, area, criado_por, atualizado_por) values ('[mig] ARGILA  Goiás', 'pecas', $1, $1)";
    esperar(
      await tentar(goiasComAcento, [usuarioId]),
      "23505",
      ["fornecedores_nome_ativo_uk"],
      "“[mig] ARGILA  Goiás” ativo ao lado de “[mig] Argila Goias” (acento não conta)",
    );
    // Com um dos dois desativado, o outro grava — de novo, a unicidade é só entre ATIVOS.
    await conexao.query("update fornecedores set ativo = false where id = $1", [argilaGoias]);
    esperar(
      await tentar(goiasComAcento, [usuarioId]),
      null,
      null,
      "“[mig] ARGILA  Goiás” ativo com “[mig] Argila Goias” desativado",
    );

    // ——— 2. Concorrência: dois gestores cadastrando o mesmo nome ao mesmo tempo ——————————————
    // Duas conexões de verdade: a segunda espera a trava do índice único e, quando a primeira
    // comita, recebe 23505 — só um grava.
    {
      const conexaoA = new Client({ connectionString: url });
      const conexaoB = new Client({ connectionString: url });
      await Promise.all([conexaoA.connect(), conexaoB.connect()]);
      try {
        const pidB = (await conexaoB.query("select pg_backend_pid() as pid")).rows[0].pid;
        const inserirConcorrente =
          "insert into fornecedores (nome, area, criado_por, atualizado_por) values ($1, 'pecas', $2, $2)";
        await conexaoA.query("begin");
        await conexaoA.query(inserirConcorrente, ["[mig] Barro Concorrente", usuarioId]);
        await conexaoB.query("begin");
        const segunda = semRejeicaoSolta(
          conexaoB.query(inserirConcorrente, ["[MIG] barro concorrente", usuarioId]),
        );
        await esperarBloqueada(conexao, pidB, "Fornecedores (concorrência do nome)");
        await conexaoA.query("commit");
        const resultado = await segunda;
        afirmar(
          !resultado.ok &&
            resultado.erro.code === "23505" &&
            resultado.erro.constraint === "fornecedores_nome_ativo_uk",
          "Fornecedores: o segundo cadastro simultâneo do mesmo nome deveria dar 23505 " +
            `(fornecedores_nome_ativo_uk), veio ${resultado.ok ? "sucesso" : `${resultado.erro.code} (${resultado.erro.constraint})`}.`,
        );
        await conexaoB.query("rollback");
        const { rows } = await conexao.query(
          "select count(*)::int as quantos from fornecedores where nome_normalizado(nome) = nome_normalizado('[MIG] Barro Concorrente')",
        );
        afirmar(
          rows[0].quantos === 1,
          `Fornecedores: só um dos dois cadastros simultâneos deveria gravar, gravaram ${rows[0].quantos}.`,
        );
      } finally {
        await conexaoA.query("rollback").catch(() => {});
        await conexaoB.query("rollback").catch(() => {});
        await Promise.all([conexaoA.end(), conexaoB.end()]);
      }
    }

    // ——— 3. Privilégio: fornecedor não se apaga; anexo se tira (FRN-03, FRN-10) —————————————
    const { rows: privilegios } = await conexao.query(
      `select has_table_privilege('amassa_app', 'fornecedores', 'DELETE') as apaga_fornecedor,
              has_table_privilege('amassa_app', 'fornecedores', 'SELECT')
                and has_table_privilege('amassa_app', 'fornecedores', 'INSERT')
                and has_table_privilege('amassa_app', 'fornecedores', 'UPDATE') as usa_fornecedor,
              has_table_privilege('amassa_app', 'fornecedor_anexos', 'DELETE') as apaga_anexo`,
    );
    afirmar(
      privilegios[0].apaga_fornecedor === false,
      "Fornecedores: o papel amassa_app NÃO deveria ter delete sobre fornecedores (revoke da 0028, FRN-03).",
    );
    afirmar(
      privilegios[0].usa_fornecedor === true,
      "Fornecedores: o papel amassa_app deveria ter select/insert/update sobre fornecedores.",
    );
    afirmar(
      privilegios[0].apaga_anexo === true,
      "Fornecedores: o papel amassa_app deveria MANTER o delete sobre fornecedor_anexos — tirar anexo é o único “apagar” do módulo (FRN-10).",
    );
    esperar(
      await comoAmassaApp("delete from fornecedores where id = $1", [argilaSulDeNovo]),
      "42501",
      null,
      "um delete em fornecedores como amassa_app",
    );

    // ——— 4. Gatilho: um update muda atualizado_em ——————————————————————————————————————————
    const tocado = await inserirFornecedor("[mig] Fornecedor do Gatilho", {
      atualizado_em: CARIMBO_ANTIGO,
    });
    await conexao.query("update fornecedores set vende = 'argila' where id = $1", [tocado]);
    const { atualizado_em: depoisDoUpdate } = await umaLinha(
      "select atualizado_em from fornecedores where id = $1",
      [tocado],
    );
    afirmar(
      new Date(depoisDoUpdate).getTime() > new Date(CARIMBO_ANTIGO).getTime(),
      `Fornecedores: o gatilho tocar_atualizado_em_fornecedores deveria trocar atualizado_em no update, ficou ${depoisDoUpdate}.`,
    );

    // ——— 5. Checks de fornecedores (23514) e as bordas aceitas ——————————————————————————————
    const inserirComCampo = (coluna) =>
      `insert into fornecedores (nome, area, criado_por, atualizado_por, ${coluna}) values ($1, 'pecas', $2, $2, $3)`;
    const aceitos = [
      ["um nome com 120 caracteres", "insert into fornecedores (nome, area, criado_por, atualizado_por) values ($1, 'pecas', $2, $2)", ["[mig]" + "x".repeat(115), usuarioId]],
      // Encoding: 120 caracteres acentuados são 240 bytes — o teto conta caracteres.
      ["um nome com 120 caracteres acentuados", "insert into fornecedores (nome, area, criado_por, atualizado_por) values ($1, 'pecas', $2, $2)", ["[mig]" + "é".repeat(115), usuarioId]],
      ["whatsapp com 40", inserirComCampo("whatsapp"), ["[mig] W40", usuarioId, "9".repeat(40)]],
      ["site com 300", inserirComCampo("site"), ["[mig] S300", usuarioId, "s".repeat(300)]],
      ["vende com 160", inserirComCampo("vende"), ["[mig] V160", usuarioId, "v".repeat(160)]],
      ["observações com 4000", inserirComCampo("observacoes"), ["[mig] O4000", usuarioId, "o".repeat(4000)]],
    ];
    for (const [descricao, sql, parametros] of aceitos) {
      esperar(await tentar(sql, parametros), null, null, descricao);
    }
    const recusasDoFornecedor = [
      ["um nome com 121 caracteres", "insert into fornecedores (nome, area, criado_por, atualizado_por) values ($1, 'pecas', $2, $2)", ["[mig]" + "x".repeat(116), usuarioId], "fornecedores_nome_comprimento"],
      ["um nome só com espaços", "insert into fornecedores (nome, area, criado_por, atualizado_por) values ($1, 'pecas', $2, $2)", ["   ", usuarioId], "fornecedores_nome_comprimento"],
      ["whatsapp com 41", inserirComCampo("whatsapp"), ["[mig] W41", usuarioId, "9".repeat(41)], "fornecedores_whatsapp_comprimento"],
      ["site com 301", inserirComCampo("site"), ["[mig] S301", usuarioId, "s".repeat(301)], "fornecedores_site_comprimento"],
      ["vende com 161", inserirComCampo("vende"), ["[mig] V161", usuarioId, "v".repeat(161)], "fornecedores_vende_comprimento"],
      ["cidade/entrega com 161", inserirComCampo("cidade_entrega"), ["[mig] C161", usuarioId, "c".repeat(161)], "fornecedores_cidade_entrega_comprimento"],
      ["pessoa de contato com 161", inserirComCampo("pessoa_contato"), ["[mig] P161", usuarioId, "p".repeat(161)], "fornecedores_pessoa_contato_comprimento"],
      ["e-mail com 161", inserirComCampo("email"), ["[mig] E161", usuarioId, "e".repeat(161)], "fornecedores_email_comprimento"],
      ["pagamento e prazo com 161", inserirComCampo("pagamento_prazo"), ["[mig] PP161", usuarioId, "p".repeat(161)], "fornecedores_pagamento_prazo_comprimento"],
      ["observações com 4001", inserirComCampo("observacoes"), ["[mig] O4001", usuarioId, "o".repeat(4001)], "fornecedores_observacoes_comprimento"],
      // Opcional vazio é `null`, nunca "" — o Zod troca; o banco recusa se o Zod for contornado.
      ["vende como texto vazio", inserirComCampo("vende"), ["[mig] Vazio", usuarioId, ""], "fornecedores_vende_comprimento"],
      ["whatsapp só com espaços", inserirComCampo("whatsapp"), ["[mig] Espacos", usuarioId, "   "], "fornecedores_whatsapp_comprimento"],
    ];
    for (const [descricao, sql, parametros, restricao] of recusasDoFornecedor) {
      esperar(await tentar(sql, parametros), "23514", [restricao], descricao);
    }

    // ——— 6. fornecedor_anexos: checks (23514) e a FK (23503) ————————————————————————————————
    const inserirAnexo = `insert into fornecedor_anexos
        (fornecedor_id, nome, tipo, vale_desde, arquivo_caminho, arquivo_tipo, arquivo_bytes, extensao, criado_por)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
    const uuidDoArquivo = "0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e";
    const anexo = (campos = {}) => {
      const base = {
        fornecedor_id: argilaSulDeNovo,
        nome: "[mig] Tabela de preços",
        tipo: "tabela",
        vale_desde: null,
        arquivo_caminho: `${uuidDoArquivo}.pdf`,
        arquivo_tipo: "application/pdf",
        arquivo_bytes: 1000,
        extensao: "pdf",
        criado_por: usuarioId,
        ...campos,
      };
      return [
        base.fornecedor_id,
        base.nome,
        base.tipo,
        base.vale_desde,
        base.arquivo_caminho,
        base.arquivo_tipo,
        base.arquivo_bytes,
        base.extensao,
        base.criado_por,
      ];
    };
    const anexosAceitos = [
      ["uma tabela de preços em PDF com vale_desde", anexo({ vale_desde: "2026-09-01" })],
      ["um PDF de 20 MiB (o maior limite do briefing)", anexo({ arquivo_bytes: 20971520 })],
      ["uma planilha .xlsx", anexo({ arquivo_caminho: `${uuidDoArquivo}.xlsx`, extensao: "xlsx" })],
      ["uma foto .jpg do tipo outro", anexo({ tipo: "outro", arquivo_caminho: `${uuidDoArquivo}.jpg`, extensao: "jpg" })],
    ];
    for (const [descricao, parametros] of anexosAceitos) {
      esperar(await tentar(inserirAnexo, parametros), null, null, descricao);
    }
    const recusasDoAnexo = [
      ["vale_desde num catálogo", anexo({ tipo: "catalogo", vale_desde: "2026-09-01" }), ["fornecedor_anexos_vale_desde_so_tabela"]],
      ["extensão .exe", anexo({ arquivo_caminho: `${uuidDoArquivo}.exe`, extensao: "exe" }), ["fornecedor_anexos_extensao_valida", "fornecedor_anexos_arquivo_formato"]],
      ["caminho com travessia (../x.pdf)", anexo({ arquivo_caminho: "../x.pdf" }), ["fornecedor_anexos_arquivo_formato"]],
      ["caminho absoluto", anexo({ arquivo_caminho: `/dados/anexos-fornecedores/${uuidDoArquivo}.pdf` }), ["fornecedor_anexos_arquivo_formato"]],
      ["arquivo .pdf gravado com extensão csv", anexo({ extensao: "csv" }), ["fornecedor_anexos_arquivo_coerente"]],
      ["arquivo de 0 byte", anexo({ arquivo_bytes: 0 }), ["fornecedor_anexos_bytes_no_intervalo"]],
      ["arquivo acima de 21 000 000 bytes", anexo({ arquivo_bytes: 21000001 }), ["fornecedor_anexos_bytes_no_intervalo"]],
      ["nome do anexo só com espaços", anexo({ nome: "   " }), ["fornecedor_anexos_nome_comprimento"]],
    ];
    for (const [descricao, parametros, restricoes] of recusasDoAnexo) {
      esperar(await tentar(inserirAnexo, parametros), "23514", restricoes, `um anexo com ${descricao}`);
    }
    esperar(
      await tentar(inserirAnexo, anexo({ fornecedor_id: "00000000-0000-4000-8000-000000000000" })),
      "23503",
      ["fornecedor_anexos_fornecedor_id_fornecedores_id_fk"],
      "um anexo de fornecedor inexistente",
    );
    // Tirar anexo como amassa_app funciona (o delete que a tabela de anexos mantém).
    const { id: anexoDeVerdade } = await umaLinha(`${inserirAnexo} returning id`, anexo());
    esperar(
      await comoAmassaApp("delete from fornecedor_anexos where id = $1", [anexoDeVerdade]),
      null,
      null,
      "tirar um anexo como amassa_app",
    );

    // ——— 7. documentos: o vínculo da despesa (D-04) ————————————————————————————————————————
    // Cada `insert` vive entre begin/rollback: `documentos` tem a soma das linhas adiada (0015), que
    // nunca chega a ser conferida porque nada é comitado.
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por, pessoa_nome, fornecedor_id) values ('despesa', current_date, $1, '[mig] Argila Sul', $2)",
        [usuarioId, argilaSulDeNovo],
      ),
      null,
      null,
      "uma despesa com fornecedor_id e o nome congelado",
    );
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por, fornecedor_id) values ('despesa', current_date, $1, $2)",
        [usuarioId, argilaSulDeNovo],
      ),
      "23514",
      ["documentos_fornecedor_exige_pessoa_nome"],
      "uma despesa com fornecedor_id e sem pessoa_nome",
    );
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por, pessoa_nome, fornecedor_id) values ('venda', current_date, $1, '[mig] Argila Sul', $2)",
        [usuarioId, argilaSulDeNovo],
      ),
      "23514",
      ["documentos_fornecedor_so_em_despesa"],
      "uma venda com fornecedor_id",
    );
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por, pessoa_nome, fornecedor_id) values ('despesa', current_date, $1, '[mig] Ninguém', $2)",
        [usuarioId, "00000000-0000-4000-8000-000000000000"],
      ),
      "23503",
      ["documentos_fornecedor_id_fornecedores_id_fk"],
      "uma despesa com fornecedor inexistente",
    );
    // A despesa de hoje, sem fornecedor_id, continua entrando como antes.
    esperar(
      await tentar(
        "insert into documentos (tipo, data, criado_por, pessoa_nome) values ('despesa', current_date, $1, '[mig] Texto livre')",
        [usuarioId],
      ),
      null,
      null,
      "uma despesa sem fornecedor_id (as colunas de hoje)",
    );
  } finally {
    await apagarDadosDeProvaDosFornecedores(conexao, usuarioId);
  }

  const { rows: sobras } = await conexao.query(
    `select (select count(*) from fornecedores where nome ilike '%[mig]%')::int as fornecedores,
            (select count(*) from fornecedor_anexos where nome ilike '%[mig]%')::int as anexos,
            (select count(*) from documentos where fornecedor_id is not null)::int as documentos`,
  );
  afirmar(
    sobras[0].fornecedores === 0 && sobras[0].anexos === 0 && sobras[0].documentos === 0,
    `Fornecedores: a faxina deveria apagar todo o dado de prova, sobrou ${JSON.stringify(sobras[0])}.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Fase 06.3 — Lembretes (plano 06.3-01, Tarefa 2): as bordas da 0029 no Postgres efêmero. Toda
// linha de prova leva "[mig]" no texto e é criada pela conexão de DONO; uma usuária de prova é
// criada e apagada aqui. Nenhum dado real, nenhum texto do protótipo.

async function apagarDadosDeProvaDosLembretes(conexao, usuarioId) {
  try {
    await conexao.query("begin");
    await conexao.query(
      `delete from lembretes
        where texto ilike '%[mig]%' or criado_por = $1 or quem = $1 or feito_por = $1`,
      [usuarioId],
    );
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado — mesma razão da faxina do Estoque, da Agenda e dos Fornecedores.
    console.error(`Lembretes: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

async function conferirLembretes(conexao) {
  console.log("  conferirLembretes...");

  async function umaLinha(sql, parametros = []) {
    const { rows } = await conexao.query(sql, parametros);
    return rows[0];
  }
  // Roda e desfaz: o código do erro (ou `null`) e o nome da restrição.
  async function tentar(sql, parametros = []) {
    await conexao.query("begin");
    try {
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }
  function esperar(resultado, codigoEsperado, restricoes, descricao) {
    afirmar(
      resultado.codigo === codigoEsperado &&
        (restricoes === null || restricoes.includes(resultado.restricao)),
      `Lembretes: ${descricao} deveria dar ${codigoEsperado ?? "certo"}` +
        (restricoes ? ` (${restricoes.join(" ou ")})` : "") +
        `, veio ${resultado.codigo} (${resultado.restricao}).`,
    );
  }

  // ——— 1. Colunas e tipos (BRIEFING §2) ———————————————————————————————————————————————————————
  const COLUNAS_ESPERADAS = {
    id: ["uuid", "NO"],
    texto: ["text", "NO"],
    para_quando: ["date", "YES"],
    quem: ["uuid", "YES"],
    feito_em: ["timestamp with time zone", "YES"],
    feito_por: ["uuid", "YES"],
    criado_em: ["timestamp with time zone", "NO"],
    criado_por: ["uuid", "NO"],
    atualizado_em: ["timestamp with time zone", "NO"],
  };
  const { rows: colunas } = await conexao.query(
    `select column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'lembretes'`,
  );
  const colunasNoBanco = Object.fromEntries(
    colunas.map((coluna) => [coluna.column_name, [coluna.data_type, coluna.is_nullable]]),
  );
  afirmar(
    JSON.stringify(Object.keys(colunasNoBanco).sort()) ===
      JSON.stringify(Object.keys(COLUNAS_ESPERADAS).sort()),
    `Lembretes: as colunas deveriam ser ${Object.keys(COLUNAS_ESPERADAS).sort().join(", ")}, ` +
      `vieram ${Object.keys(colunasNoBanco).sort().join(", ")}.`,
  );
  for (const [nome, [tipo, anulavel]] of Object.entries(COLUNAS_ESPERADAS)) {
    afirmar(
      colunasNoBanco[nome][0] === tipo && colunasNoBanco[nome][1] === anulavel,
      `Lembretes: a coluna ${nome} deveria ser ${tipo} ${anulavel === "YES" ? "anulável" : "not null"}, ` +
        `veio ${colunasNoBanco[nome][0]} (is_nullable ${colunasNoBanco[nome][1]}).`,
    );
  }

  // ——— 2. Índice (BRIEFING §4) ————————————————————————————————————————————————————————————————
  const indice = await umaLinha(
    "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'lembretes_feito_em_para_quando_idx'",
  );
  afirmar(
    indice !== undefined && indice.indexdef.includes("(feito_em, para_quando)"),
    `Lembretes: o índice lembretes_feito_em_para_quando_idx em (feito_em, para_quando) deveria existir, ` +
      `veio ${indice ? indice.indexdef : "nada"}.`,
  );

  const { rows: usuarioInserido } = await conexao.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste dos Lembretes [mig]', 'usuaria-lembretes@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;
  const NINGUEM = "00000000-0000-4000-8000-000000000000";

  async function inserirLembrete(texto, extras = {}) {
    const colunasDoInsert = ["texto", "criado_por", ...Object.keys(extras)];
    const valores = [texto, usuarioId, ...Object.values(extras)];
    const marcadores = valores.map((_, indiceDoValor) => `$${indiceDoValor + 1}`).join(", ");
    return (
      await umaLinha(
        `insert into lembretes (${colunasDoInsert.join(", ")}) values (${marcadores}) returning id`,
        valores,
      )
    ).id;
  }

  try {
    // ——— 3. 🔴 Privilégio: o delete PERMITIDO ————————————————————————————————————————————————
    // EXCEÇÃO DELIBERADA (LMB-08, decisão do dono em 02/10/2026): `lembretes` é a única tabela de
    // registro em que apagar é normal. Esta conferência afirma o CONTRÁRIO das outras de propósito.
    // Se ela falhar porque alguém acrescentou uma retirada do privilégio de apagar na 0029 ou numa
    // migração nova, o erro é a retirada — não corrija esta conferência.
    const { rows: privilegios } = await conexao.query(
      `select has_table_privilege('amassa_app', 'lembretes', 'DELETE') as apaga,
              has_table_privilege('amassa_app', 'lembretes', 'SELECT')
                and has_table_privilege('amassa_app', 'lembretes', 'INSERT')
                and has_table_privilege('amassa_app', 'lembretes', 'UPDATE') as usa`,
    );
    afirmar(
      privilegios[0].apaga === true,
      "Lembretes: o papel amassa_app DEVE poder apagar lembretes (LMB-08, decisão do dono em 02/10/2026) — " +
        "alguém acrescentou uma retirada do privilégio de apagar? O erro é a retirada, não esta conferência.",
    );
    afirmar(
      privilegios[0].usa === true,
      "Lembretes: o papel amassa_app deveria ter select/insert/update sobre lembretes.",
    );
    // Um delete REAL, comitado, como amassa_app — não só o privilégio no catálogo.
    const paraApagar = await inserirLembrete("[mig] lembrete para apagar");
    let resultadoDoDelete;
    let apagadas = 0;
    await conexao.query("begin");
    try {
      await conexao.query("set local role amassa_app");
      resultadoDoDelete = await erroDoBanco(async () => {
        const { rowCount } = await conexao.query("delete from lembretes where id = $1", [paraApagar]);
        apagadas = rowCount;
      });
      await conexao.query(resultadoDoDelete.codigo === null ? "commit" : "rollback");
    } catch (erro) {
      await conexao.query("rollback").catch(() => {});
      throw erro;
    }
    esperar(resultadoDoDelete, null, null, "um delete em lembretes como amassa_app (LMB-08)");
    const { rows: restantes } = await conexao.query(
      "select count(*)::int as quantos from lembretes where id = $1",
      [paraApagar],
    );
    afirmar(
      apagadas === 1 && restantes[0].quantos === 0,
      `Lembretes: o delete como amassa_app deveria apagar a linha de verdade — apagou ${apagadas}, ` +
        `sobraram ${restantes[0].quantos}.`,
    );

    // ——— 4. Checks (23514) e as bordas aceitas ———————————————————————————————————————————————
    const inserirTexto = "insert into lembretes (texto, criado_por) values ($1, $2)";
    esperar(
      await tentar(inserirTexto, ["   ", usuarioId]),
      "23514",
      ["lembretes_texto_comprimento"],
      "um lembrete só com espaços",
    );
    esperar(
      await tentar(inserirTexto, ["[mig]" + "x".repeat(196), usuarioId]),
      "23514",
      ["lembretes_texto_comprimento"],
      "um lembrete com 201 caracteres",
    );
    // 200 pontos de código com um emoji fora do BMP (dois códigos UTF-16, um ponto de código): grava —
    // o teto conta caracteres, como o Zod (`[...texto].length`).
    esperar(
      await tentar(inserirTexto, ["[mig]" + "x".repeat(194) + "🏺", usuarioId]),
      null,
      null,
      "um lembrete com 200 caracteres terminando num emoji fora do BMP",
    );
    esperar(
      await tentar(
        "insert into lembretes (texto, criado_por, feito_em) values ('[mig] feito sem quem', $1, now())",
        [usuarioId],
      ),
      "23514",
      ["lembretes_feito_coerente"],
      "feito_em sem feito_por",
    );
    esperar(
      await tentar(
        "insert into lembretes (texto, criado_por, feito_por) values ('[mig] quem sem feito', $1, $1)",
        [usuarioId],
      ),
      "23514",
      ["lembretes_feito_coerente"],
      "feito_por sem feito_em",
    );
    esperar(
      await tentar(
        "insert into lembretes (texto, criado_por, feito_em, feito_por) values ('[mig] feito inteiro', $1, now(), $1)",
        [usuarioId],
      ),
      null,
      null,
      "feito_em e feito_por juntos",
    );

    // ——— 5. Chaves estrangeiras (23503) ——————————————————————————————————————————————————————
    esperar(
      await tentar(
        "insert into lembretes (texto, criado_por, quem) values ('[mig] para ninguém', $1, $2)",
        [usuarioId, NINGUEM],
      ),
      "23503",
      ["lembretes_quem_usuarios_id_fk"],
      "um lembrete com quem inexistente",
    );
    esperar(
      await tentar(inserirTexto, ["[mig] criado por ninguém", NINGUEM]),
      "23503",
      ["lembretes_criado_por_usuarios_id_fk"],
      "um lembrete com criado_por inexistente",
    );

    // ——— 6. Gatilho: um update de texto muda atualizado_em ————————————————————————————————————
    const tocado = await inserirLembrete("[mig] lembrete do gatilho", {
      atualizado_em: CARIMBO_ANTIGO,
    });
    await conexao.query("update lembretes set texto = '[mig] lembrete do gatilho, editado' where id = $1", [
      tocado,
    ]);
    const { atualizado_em: depoisDoUpdate } = await umaLinha(
      "select atualizado_em from lembretes where id = $1",
      [tocado],
    );
    afirmar(
      new Date(depoisDoUpdate).getTime() > new Date(CARIMBO_ANTIGO).getTime(),
      `Lembretes: o gatilho tocar_atualizado_em_lembretes deveria trocar atualizado_em no update, ficou ${depoisDoUpdate}.`,
    );
  } finally {
    await apagarDadosDeProvaDosLembretes(conexao, usuarioId);
  }

  const { rows: sobras } = await conexao.query(
    "select count(*)::int as quantos from lembretes where texto ilike '%[mig]%'",
  );
  afirmar(
    sobras[0].quantos === 0,
    `Lembretes: a faxina deveria apagar todo o dado de prova, sobraram ${sobras[0].quantos}.`,
  );
}

// Fase 06.4 — Queimas: contagem (migração 0030). `conferirQueimas` prova, no banco comum, as duas
// tabelas novas, a semente e o gatilho por chave, no molde de `conferirLembretes`: a conexão de DONO
// semeia e limpa; cada recusa confere o SQLSTATE E o nome da restrição. Os casos que só testam rodam
// entre `begin`/`rollback`; o dado de prova que precisa existir é comitado e sai no fim por
// `apagarDadosDeProvaDasQueimas` (que nunca relança).
//
//   1. colunas EXATAS de `queima_contagens` e `queima_vendas` (nenhuma coluna de dono da peça, de
//      pagamento, de situação nem de venda na contagem — as proibições do plano 06.4-01);
//   2. índice `queima_vendas_queima_idx` e o `confdeltype` das chaves estrangeiras;
//   3. contagem: `saiu_cheio` padrão verdadeiro, checks de faixa e de "alguma peça" (23514), PK
//      (23505), `on conflict (queima_id) do update` deixa uma linha e o gatilho troca `atualizado_em`;
//   4. vínculos (D-07): checks, uma venda é de UMA queima (23505), não há vínculo sem contagem
//      (23503), várias vendas por queima;
//   5. cascade: apagar a queima leva contagem e vínculos e deixa a venda em `documentos`;
//   6. D-05: os três itens por chave, idempotência da semente, adoção (só de item ativo, sem chave e
//      sem estoque, o mais antigo);
//   7. o gatilho `travar_item_do_sistema` com a frase por chave (a da Agenda intacta);
//   8. D-03: a régua semeada e idempotente.
const CHAVES_DAS_QUEIMAS = ["queima_externa_g", "queima_externa_m", "queima_externa_p"];
const FRASE_DO_ITEM_DAS_QUEIMAS =
  "Este item é usado pelas Queimas e não se desativa. Nome, preço e categoria podem mudar.";
const FRASE_INTEIRA_DO_ITEM_DA_AGENDA =
  "Este item é usado pela Agenda e não se desativa. Nome, preço e categoria podem mudar.";

// O trecho da 0030 entre `-- >>> {marcador}` e `-- <<< {marcador}`, partido no marcador de instrução
// do Drizzle — só os pedaços com SQL de verdade (molde `trechoDaSementeDaAgenda`).
function trechoDaMigracaoDasQueimas(marcador) {
  const sql = readFileSync(path.join("db", "migrations", "0030_queimas-contagem.sql"), "utf8");
  const inicio = sql.indexOf(`-- >>> ${marcador}`);
  const fim = sql.indexOf(`-- <<< ${marcador}`);
  afirmar(inicio >= 0 && fim > inicio, `Queimas: os marcadores "${marcador}" sumiram da 0030.`);
  return sql
    .slice(inicio, fim)
    .split("--> statement-breakpoint")
    .map((pedaco) =>
      pedaco
        .split(/\r?\n/)
        .filter((linha) => !linha.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((pedaco) => pedaco.length > 0);
}

async function apagarDadosDeProvaDasQueimas(conexao, { fornoIds, documentoIds, usuarioId }) {
  try {
    await conexao.query("begin");
    // Ordem das FKs: vínculo → (queima e contagem, por cascade do forno) → forno → venda → usuária.
    await conexao.query("delete from queima_vendas where documento_id = any($1::uuid[])", [documentoIds]);
    await conexao.query("delete from fornos where id = any($1::uuid[])", [fornoIds]);
    await conexao.query("alter table documento_linhas disable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas disable trigger conferir_soma_apos_parcela");
    await conexao.query("delete from parcelas where documento_id = any($1::uuid[])", [documentoIds]);
    await conexao.query("delete from documento_linhas where documento_id = any($1::uuid[])", [
      documentoIds,
    ]);
    await conexao.query("delete from documentos where id = any($1::uuid[])", [documentoIds]);
    await conexao.query("alter table documento_linhas enable trigger conferir_soma_apos_linha");
    await conexao.query("alter table parcelas enable trigger conferir_soma_apos_parcela");
    if (usuarioId) {
      await conexao.query("delete from usuarios where id = $1", [usuarioId]);
    }
    await conexao.query("commit");
  } catch (erro) {
    await conexao.query("rollback").catch(() => {});
    // Nunca relançado — mesma razão da faxina do Estoque, da Agenda e dos Lembretes.
    console.error(`Queimas: a faxina não apagou o dado de prova — ${erro.message}`);
  }
}

async function conferirQueimas(conexao) {
  console.log("  conferirQueimas...");

  async function umaLinha(sql, parametros = []) {
    const { rows } = await conexao.query(sql, parametros);
    return rows[0];
  }
  // Roda e desfaz: o código do erro (ou `null`) e o nome da restrição.
  async function tentar(sql, parametros = []) {
    await conexao.query("begin");
    try {
      return await erroDoBanco(() => conexao.query(sql, parametros));
    } finally {
      await conexao.query("rollback");
    }
  }
  // Roda e desfaz: o código e a MENSAGEM do erro (a frase do gatilho).
  async function tentarComMensagem(sql, parametros = []) {
    await conexao.query("begin");
    try {
      await conexao.query(sql, parametros);
      return { codigo: null, mensagem: null };
    } catch (erro) {
      return { codigo: erro.code ?? null, mensagem: erro.message ?? null };
    } finally {
      await conexao.query("rollback");
    }
  }
  function esperar(resultado, codigoEsperado, restricoes, descricao) {
    afirmar(
      resultado.codigo === codigoEsperado &&
        (restricoes === null || restricoes.includes(resultado.restricao)),
      `Queimas: ${descricao} deveria dar ${codigoEsperado ?? "certo"}` +
        (restricoes ? ` (${restricoes.join(" ou ")})` : "") +
        `, veio ${resultado.codigo} (${resultado.restricao}).`,
    );
  }
  async function conferirColunas(tabela, esperadas) {
    const { rows: colunas } = await conexao.query(
      `select column_name, data_type, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = $1`,
      [tabela],
    );
    const noBanco = Object.fromEntries(
      colunas.map((coluna) => [coluna.column_name, [coluna.data_type, coluna.is_nullable]]),
    );
    afirmar(
      JSON.stringify(Object.keys(noBanco).sort()) === JSON.stringify(Object.keys(esperadas).sort()),
      `Queimas: as colunas de ${tabela} deveriam ser EXATAMENTE ${Object.keys(esperadas).sort().join(", ")} ` +
        `(nenhuma de dono da peça, de pagamento ou de situação), vieram ${Object.keys(noBanco).sort().join(", ")}.`,
    );
    for (const [nome, [tipo, anulavel]] of Object.entries(esperadas)) {
      afirmar(
        noBanco[nome][0] === tipo && noBanco[nome][1] === anulavel,
        `Queimas: ${tabela}.${nome} deveria ser ${tipo} ${anulavel === "YES" ? "anulável" : "not null"}, ` +
          `veio ${noBanco[nome][0]} (is_nullable ${noBanco[nome][1]}).`,
      );
    }
  }

  // ——— 1. Colunas exatas ————————————————————————————————————————————————————————————————————————
  await conferirColunas("queima_contagens", {
    queima_id: ["uuid", "NO"],
    internas_p: ["integer", "NO"],
    internas_m: ["integer", "NO"],
    internas_g: ["integer", "NO"],
    externas_p: ["integer", "NO"],
    externas_m: ["integer", "NO"],
    externas_g: ["integer", "NO"],
    saiu_cheio: ["boolean", "NO"],
    contado_por: ["uuid", "YES"],
    criado_em: ["timestamp with time zone", "NO"],
    atualizado_em: ["timestamp with time zone", "NO"],
  });
  await conferirColunas("queima_vendas", {
    documento_id: ["uuid", "NO"],
    queima_id: ["uuid", "NO"],
    quantidade_p: ["integer", "NO"],
    quantidade_m: ["integer", "NO"],
    quantidade_g: ["integer", "NO"],
    lancado_por: ["uuid", "YES"],
    criado_em: ["timestamp with time zone", "NO"],
  });

  // ——— 2. Índice e o que cada chave estrangeira faz ao apagar ———————————————————————————————————
  const indice = await umaLinha(
    "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'queima_vendas_queima_idx'",
  );
  afirmar(
    indice !== undefined && indice.indexdef.includes("(queima_id)"),
    `Queimas: o índice queima_vendas_queima_idx em (queima_id) deveria existir, veio ${indice ? indice.indexdef : "nada"}.`,
  );
  const { rows: chavesEstrangeiras } = await conexao.query(
    `select rel.relname as tabela, att.attname as coluna, con.confdeltype::text as ao_apagar
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
      where con.contype = 'f' and rel.relname in ('queima_contagens', 'queima_vendas')`,
  );
  const aoApagar = Object.fromEntries(
    chavesEstrangeiras.map((linha) => [`${linha.tabela}.${linha.coluna}`, linha.ao_apagar]),
  );
  for (const [coluna, esperado, descricao] of [
    ["queima_contagens.queima_id", "c", "cascade (apagar a queima leva a contagem)"],
    ["queima_vendas.queima_id", "c", "cascade (apagar a contagem leva os vínculos)"],
    ["queima_vendas.documento_id", "a", "no action (venda não se apaga, cancela)"],
    ["queima_contagens.contado_por", "n", "set null"],
    ["queima_vendas.lancado_por", "n", "set null"],
  ]) {
    afirmar(
      aoApagar[coluna] === esperado,
      `Queimas: a chave estrangeira de ${coluna} deveria ser ${descricao} (confdeltype '${esperado}'), veio '${aoApagar[coluna]}'.`,
    );
  }

  // ——— 6. D-05: os três itens do sistema ————————————————————————————————————————————————————————
  async function lerItensDasQueimas() {
    const { rows } = await conexao.query(
      `select i.id, i.chave_do_sistema, i.nome, i.preco_venda_centavos, i.aparece_na_venda,
              i.controla_estoque, i.ativo, c.nome as categoria
         from itens_catalogo i
         left join categorias c on c.id = i.categoria_venda_id
        where i.chave_do_sistema = any($1::text[])
        order by i.chave_do_sistema`,
      [CHAVES_DAS_QUEIMAS],
    );
    return rows;
  }
  async function contarItensComOsNomes() {
    const linha = await umaLinha(
      `select count(*)::int as quantos from itens_catalogo
        where nome_normalizado(nome) in (nome_normalizado('Queima externa P'),
                                         nome_normalizado('Queima externa M'),
                                         nome_normalizado('Queima externa G'))`,
    );
    return linha.quantos;
  }
  function conferirSementeDasQueimas(itens, momento) {
    afirmar(
      itens.length === 3,
      `Queimas (${momento}): deveria haver 3 itens do sistema das Queimas, vieram ${itens.length}.`,
    );
    for (const [indiceDoItem, [chave, nome]] of [
      ["queima_externa_g", "Queima externa G"],
      ["queima_externa_m", "Queima externa M"],
      ["queima_externa_p", "Queima externa P"],
    ].entries()) {
      const item = itens[indiceDoItem];
      afirmar(
        item.chave_do_sistema === chave &&
          item.nome === nome &&
          item.categoria === "Queima externa" &&
          item.preco_venda_centavos === null &&
          item.aparece_na_venda === true &&
          item.controla_estoque === false &&
          item.ativo === true,
        `Queimas (${momento}): o item "${chave}" deveria se chamar "${nome}", na categoria "Queima externa", ` +
          `sem preço, na venda, sem estoque, ativo — veio ${JSON.stringify(item)}.`,
      );
    }
  }
  const sementeDasQueimas = trechoDaMigracaoDasQueimas("semente das Queimas");
  afirmar(
    sementeDasQueimas.length === 7,
    `Queimas: o trecho da semente deveria ter 7 instruções (1 categoria + 3 × adotar e criar), tem ${sementeDasQueimas.length}.`,
  );
  conferirSementeDasQueimas(await lerItensDasQueimas(), "depois da 0030");
  const nomesAntes = await contarItensComOsNomes();
  await conexao.query("begin");
  try {
    for (const pedaco of sementeDasQueimas) {
      await conexao.query(pedaco);
    }
    conferirSementeDasQueimas(await lerItensDasQueimas(), "semente reexecutada");
    const nomesDepois = await contarItensComOsNomes();
    afirmar(
      nomesDepois === nomesAntes,
      `Queimas: reexecutar a semente não deveria criar item — ${nomesAntes} itens com esses nomes antes, ${nomesDepois} depois.`,
    );
  } finally {
    await conexao.query("rollback");
  }

  // ——— 8. D-03: a régua ——————————————————————————————————————————————————————————————————————
  async function lerRegua() {
    const { rows } = await conexao.query(
      `select chave, valor_inteiro, medido, vigente_desde::text as vigente_desde
         from parametros_precificacao
        where chave in ('queima_regua_p_ate', 'queima_regua_m_ate')
        order by chave`,
    );
    return rows;
  }
  function conferirRegua(linhas, momento) {
    afirmar(
      JSON.stringify(linhas) ===
        JSON.stringify([
          { chave: "queima_regua_m_ate", valor_inteiro: 25000, medido: false, vigente_desde: "2026-09-20" },
          { chave: "queima_regua_p_ate", valor_inteiro: 10000, medido: false, vigente_desde: "2026-09-20" },
        ]),
      `Queimas (${momento}): a régua deveria ser P até 10000 e M até 25000, estimadas, desde 2026-09-20 — veio ${JSON.stringify(linhas)}.`,
    );
  }
  conferirRegua(await lerRegua(), "depois da 0030");
  const blocoDaRegua = trechoDaMigracaoDasQueimas("régua das Queimas");
  afirmar(
    blocoDaRegua.length === 1,
    `Queimas: o trecho da régua deveria ter 1 instrução, tem ${blocoDaRegua.length}.`,
  );
  await conexao.query("begin");
  try {
    for (const pedaco of blocoDaRegua) {
      await conexao.query(pedaco);
    }
    conferirRegua(await lerRegua(), "régua reexecutada");
  } finally {
    await conexao.query("rollback");
  }

  // ——— 7. O gatilho com a frase por chave ——————————————————————————————————————————————————————
  const desativarDasQueimas = await tentarComMensagem(
    "update itens_catalogo set ativo = false where chave_do_sistema = 'queima_externa_g'",
  );
  afirmar(
    desativarDasQueimas.codigo === "P0001" && desativarDasQueimas.mensagem === FRASE_DO_ITEM_DAS_QUEIMAS,
    `Queimas: desativar "queima_externa_g" deveria dar P0001 com "${FRASE_DO_ITEM_DAS_QUEIMAS}", veio ` +
      `${desativarDasQueimas.codigo} (${desativarDasQueimas.mensagem}).`,
  );
  const desativarDaAgenda = await tentarComMensagem(
    "update itens_catalogo set ativo = false where chave_do_sistema = 'uso_livre_hora'",
  );
  afirmar(
    desativarDaAgenda.codigo === "P0001" && desativarDaAgenda.mensagem === FRASE_INTEIRA_DO_ITEM_DA_AGENDA,
    `Queimas: desativar "uso_livre_hora" deveria continuar dando P0001 com a frase da 0026, ` +
      `"${FRASE_INTEIRA_DO_ITEM_DA_AGENDA}", veio ${desativarDaAgenda.codigo} (${desativarDaAgenda.mensagem}).`,
  );

  // ——— 6b. D-05: a adoção ———————————————————————————————————————————————————————————————————————
  // Com o gatilho desligado PELA CONEXÃO DO DONO (molde `conferirCorrecaoDoFusoDaSemente`): o item
  // `queima_externa_p` perde a chave e vira "[mig] original"; nascem três homônimos — um SEM estoque e
  // antigo (deve ser adotado), um SEM estoque e mais novo (não), e um COM estoque e o mais antigo de
  // todos (nunca: vender daria baixa no livro). Reaplicar a semente adota o primeiro e não cria nada.
  const original = await umaLinha(
    "select id, nome from itens_catalogo where chave_do_sistema = 'queima_externa_p'",
  );
  const categoriaDaQueima = await umaLinha(
    "select id from categorias where lower(trim(nome)) = lower(trim('Queima externa'))",
  );
  const categoriaDeCompra = await umaLinha(
    "select id from categorias where grupo = 'custo' order by nome limit 1",
  );
  const homonimos = [];
  try {
    await conexao.query("alter table itens_catalogo disable trigger travar_item_do_sistema");
    try {
      await conexao.query(
        "update itens_catalogo set chave_do_sistema = null, nome = '[mig] original' where id = $1",
        [original.id],
      );
    } finally {
      await conexao.query("alter table itens_catalogo enable trigger travar_item_do_sistema");
    }
    const adotavel = await umaLinha(
      `insert into itens_catalogo (nome, aparece_na_venda, categoria_venda_id, controla_estoque, ativo, criado_em)
       values ('queima EXTERNA  p', true, $1, false, true, '2020-01-01T00:00:00Z') returning id`,
      [categoriaDaQueima.id],
    );
    homonimos.push(adotavel.id);
    const maisNovo = await umaLinha(
      `insert into itens_catalogo (nome, aparece_na_venda, categoria_venda_id, controla_estoque, ativo, criado_em)
       values ('Queima Externa P', true, $1, false, true, '2021-01-01T00:00:00Z') returning id`,
      [categoriaDaQueima.id],
    );
    homonimos.push(maisNovo.id);
    const comEstoque = await umaLinha(
      `insert into itens_catalogo (nome, aparece_na_venda, categoria_venda_id, controla_estoque, unidade,
                                   categoria_compra_id, ativo, criado_em)
       values ('Queima externa P', true, $1, true, 'un', $2, true, '2019-01-01T00:00:00Z') returning id`,
      [categoriaDaQueima.id, categoriaDeCompra.id],
    );
    homonimos.push(comEstoque.id);

    const totalAntes = (await umaLinha("select count(*)::int as quantos from itens_catalogo")).quantos;
    for (const pedaco of sementeDasQueimas) {
      await conexao.query(pedaco);
    }
    const totalDepois = (await umaLinha("select count(*)::int as quantos from itens_catalogo")).quantos;
    afirmar(
      totalDepois === totalAntes,
      `Queimas: a adoção não deveria criar item — ${totalAntes} itens antes, ${totalDepois} depois.`,
    );
    const { rows: depoisDaAdocao } = await conexao.query(
      `select id, chave_do_sistema, aparece_na_venda, categoria_venda_id from itens_catalogo
        where id = any($1::uuid[])`,
      [[...homonimos, original.id]],
    );
    const porId = Object.fromEntries(depoisDaAdocao.map((item) => [item.id, item]));
    afirmar(
      porId[adotavel.id].chave_do_sistema === "queima_externa_p" &&
        porId[adotavel.id].aparece_na_venda === true &&
        porId[adotavel.id].categoria_venda_id !== null,
      `Queimas: o item ativo, sem chave e sem estoque mais antigo ("queima EXTERNA  p") deveria ter sido ` +
        `adotado como queima_externa_p, na venda e com categoria — veio ${JSON.stringify(porId[adotavel.id])}.`,
    );
    afirmar(
      porId[maisNovo.id].chave_do_sistema === null,
      "Queimas: o homônimo sem estoque MAIS NOVO não deveria ter sido adotado (o mais antigo ganha).",
    );
    afirmar(
      porId[comEstoque.id].chave_do_sistema === null,
      "Queimas: o homônimo COM controle de estoque nunca deveria ser adotado (vender daria baixa no livro).",
    );
    afirmar(
      porId[original.id].chave_do_sistema === null,
      "Queimas: a preparação da adoção falhou — o item original não deveria ter recuperado a chave.",
    );
  } finally {
    // Devolve a chave ao item original, restaura o nome e apaga os homônimos — com o gatilho
    // desligado (item com chave não se apaga nem troca de chave). Nunca relança.
    try {
      await conexao.query("alter table itens_catalogo disable trigger travar_item_do_sistema");
      await conexao.query(
        "update itens_catalogo set chave_do_sistema = null where id = any($1::uuid[])",
        [homonimos],
      );
      await conexao.query(
        "update itens_catalogo set chave_do_sistema = 'queima_externa_p', nome = $2 where id = $1",
        [original.id, original.nome],
      );
      await conexao.query("delete from itens_catalogo where id = any($1::uuid[])", [homonimos]);
    } catch (erro) {
      console.error(`Queimas: a faxina da adoção falhou — ${erro.message}`);
    } finally {
      await conexao.query("alter table itens_catalogo enable trigger travar_item_do_sistema");
    }
  }
  conferirSementeDasQueimas(await lerItensDasQueimas(), "depois da faxina da adoção");

  // ——— 3 a 5. Contagem, vínculos e cascade, com dado de prova ———————————————————————————————————
  const { rows: usuarioInserido } = await conexao.query(
    `insert into usuarios (nome, email, senha_hash)
     values ('Usuária de Teste das Queimas [mig]', 'usuaria-queimas@exemplo.test', 'hash-fake-de-teste')
     returning id`,
  );
  const usuarioId = usuarioInserido[0].id;
  const fornoIds = [];
  const documentoIds = [];

  async function novaQueima(fornoId) {
    return (
      await umaLinha("insert into queimas (forno_id, tipo) values ($1, 'biscoito') returning id", [fornoId])
    ).id;
  }
  // Uma venda de prova completa (documento + linha + parcela numa transação só — a restrição adiada
  // `conferir_soma_do_documento()` da 0015 confere no commit).
  async function novaVenda() {
    await conexao.query("begin");
    try {
      const documento = await umaLinha(
        "insert into documentos (tipo, data, criado_por) values ('venda', current_date, $1) returning id",
        [usuarioId],
      );
      await conexao.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
         values ($1, 1, 'Queima externa de prova [mig]', $2, 1000)`,
        [documento.id, categoriaDaQueima.id],
      );
      await conexao.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma)
         values ($1, 1, current_date, 1000, 'pix')`,
        [documento.id],
      );
      await conexao.query("commit");
      documentoIds.push(documento.id);
      return documento.id;
    } catch (erro) {
      await conexao.query("rollback").catch(() => {});
      throw erro;
    }
  }

  try {
    const forno = await umaLinha("insert into fornos (nome) values ('[mig] Forno das Queimas') returning id");
    fornoIds.push(forno.id);
    const queimaContada = await novaQueima(forno.id);
    const outraContada = await novaQueima(forno.id);
    const semContagem = await novaQueima(forno.id);

    // Contagem com só `queima_id` e `internas_p` → `saiu_cheio` nasce verdadeiro (marcado por padrão).
    await conexao.query(
      "insert into queima_contagens (queima_id, internas_p, atualizado_em) values ($1, 1, $2)",
      [queimaContada, CARIMBO_ANTIGO],
    );
    const nascida = await umaLinha(
      "select saiu_cheio, internas_p from queima_contagens where queima_id = $1",
      [queimaContada],
    );
    afirmar(
      nascida.saiu_cheio === true && nascida.internas_p === 1,
      `Queimas: uma contagem sem saiu_cheio deveria nascer com saiu_cheio = true, veio ${JSON.stringify(nascida)}.`,
    );

    // Checks da contagem (QMC-03): faixa 0..10000 e "alguma peça". No caso do −1 outra coluna sobe
    // junto: com só `internas_p = 1`, a soma daria 0 e o "alguma peça" recusaria primeiro.
    esperar(
      await tentar("update queima_contagens set externas_g = -1, internas_m = 5 where queima_id = $1", [queimaContada]),
      "23514",
      ["queima_contagens_externas_g_faixa"],
      "externas_g = −1",
    );
    esperar(
      await tentar("update queima_contagens set externas_g = 10001 where queima_id = $1", [queimaContada]),
      "23514",
      ["queima_contagens_externas_g_faixa"],
      "externas_g = 10001",
    );
    esperar(
      await tentar("update queima_contagens set internas_m = 10000 where queima_id = $1", [queimaContada]),
      null,
      null,
      "internas_m = 10000",
    );
    esperar(
      await tentar("insert into queima_contagens (queima_id) values ($1)", [outraContada]),
      "23514",
      ["queima_contagens_alguma_peca"],
      "uma contagem com os seis contadores em 0",
    );
    // PK: uma contagem por queima.
    esperar(
      await tentar("insert into queima_contagens (queima_id, internas_g) values ($1, 2)", [queimaContada]),
      "23505",
      ["queima_contagens_pkey"],
      "uma segunda contagem para a mesma queima",
    );
    // Regravar os mesmos números: uma linha só, mesmos valores, e o gatilho troca `atualizado_em`.
    await conexao.query(
      `insert into queima_contagens (queima_id, internas_p, saiu_cheio) values ($1, 1, true)
       on conflict (queima_id) do update set internas_p = excluded.internas_p, saiu_cheio = excluded.saiu_cheio`,
      [queimaContada],
    );
    const regravada = await umaLinha(
      `select (select count(*)::int from queima_contagens where queima_id = $1) as linhas,
              internas_p, saiu_cheio, atualizado_em
         from queima_contagens where queima_id = $1`,
      [queimaContada],
    );
    afirmar(
      regravada.linhas === 1 && regravada.internas_p === 1 && regravada.saiu_cheio === true,
      `Queimas: regravar a mesma contagem deveria deixar uma linha com os mesmos valores, veio ${JSON.stringify(regravada)}.`,
    );
    afirmar(
      new Date(regravada.atualizado_em).getTime() > new Date(CARIMBO_ANTIGO).getTime(),
      `Queimas: o gatilho tocar_atualizado_em_queima_contagens deveria trocar atualizado_em, ficou ${regravada.atualizado_em}.`,
    );

    // Vínculos (D-07). As externas da contagem não importam ao banco: o piso é da aplicação.
    await conexao.query(
      "update queima_contagens set externas_p = 3, externas_g = 1 where queima_id = $1",
      [queimaContada],
    );
    await conexao.query("insert into queima_contagens (queima_id, externas_m) values ($1, 2)", [outraContada]);
    const vendaUm = await novaVenda();
    const vendaDois = await novaVenda();
    await conexao.query(
      "insert into queima_vendas (documento_id, queima_id, quantidade_p, lancado_por) values ($1, $2, 1, $3)",
      [vendaUm, queimaContada, usuarioId],
    );
    esperar(
      await tentar("insert into queima_vendas (documento_id, queima_id, quantidade_p, quantidade_g) values ($1, $2, 2, -1)", [
        vendaDois,
        queimaContada,
      ]),
      "23514",
      ["queima_vendas_g_faixa"],
      "um vínculo com quantidade_g = −1",
    );
    esperar(
      await tentar("insert into queima_vendas (documento_id, queima_id, quantidade_g) values ($1, $2, 10001)", [
        vendaDois,
        queimaContada,
      ]),
      "23514",
      ["queima_vendas_g_faixa"],
      "um vínculo com quantidade_g = 10001",
    );
    esperar(
      await tentar("insert into queima_vendas (documento_id, queima_id) values ($1, $2)", [
        vendaDois,
        queimaContada,
      ]),
      "23514",
      ["queima_vendas_alguma_peca"],
      "um vínculo com as três quantidades em 0",
    );
    esperar(
      await tentar("insert into queima_vendas (documento_id, queima_id, quantidade_m) values ($1, $2, 1)", [
        vendaUm,
        outraContada,
      ]),
      "23505",
      ["queima_vendas_pkey"],
      "um segundo vínculo da MESMA venda (uma venda é de uma queima só)",
    );
    esperar(
      await tentar("insert into queima_vendas (documento_id, queima_id, quantidade_p) values ($1, $2, 1)", [
        vendaDois,
        semContagem,
      ]),
      "23503",
      ["queima_vendas_queima_id_queima_contagens_queima_id_fk"],
      "um vínculo para uma queima sem contagem",
    );
    await conexao.query(
      "insert into queima_vendas (documento_id, queima_id, quantidade_p, quantidade_g) values ($1, $2, 1, 1)",
      [vendaDois, queimaContada],
    );
    const vinculos = await umaLinha(
      "select count(*)::int as quantos from queima_vendas where queima_id = $1",
      [queimaContada],
    );
    afirmar(
      vinculos.quantos === 2,
      `Queimas: uma queima deveria aceitar várias vendas (D-07), vieram ${vinculos.quantos} vínculos.`,
    );

    // Cascade: apagar a queima leva a contagem e os vínculos; as vendas ficam no Caixa.
    await conexao.query("delete from queimas where id = $1", [queimaContada]);
    const depoisDeApagar = await umaLinha(
      `select (select count(*)::int from queima_contagens where queima_id = $1) as contagens,
              (select count(*)::int from queima_vendas where documento_id = any($2::uuid[])) as vinculos,
              (select count(*)::int from documentos where id = any($2::uuid[])) as vendas`,
      [queimaContada, [vendaUm, vendaDois]],
    );
    afirmar(
      depoisDeApagar.contagens === 0 && depoisDeApagar.vinculos === 0 && depoisDeApagar.vendas === 2,
      `Queimas: apagar a queima deveria levar a contagem e os vínculos e deixar as duas vendas em documentos — ` +
        `veio ${JSON.stringify(depoisDeApagar)}.`,
    );
  } finally {
    await apagarDadosDeProvaDasQueimas(conexao, { fornoIds, documentoIds, usuarioId });
  }

  const sobras = await umaLinha(
    "select count(*)::int as quantos from fornos where nome like '[mig] Forno das Queimas%'",
  );
  afirmar(
    sobras.quantos === 0,
    `Queimas: a faxina deveria apagar todo o dado de prova, sobraram ${sobras.quantos} fornos.`,
  );
}

// Fase 06.5 — Polimento (migração 0031_polimento). A cláusula de conflito EXATA que o Drizzle gera para
// o `onConflictDoNothing({ target, where })` de `gerarContasDoMes` (lida com `toSQL()` no plano 06.5-11):
// a mesma frase prova, no banco comum, o índice parcial e, em banco próprio, a janela antes da 0031.
const CONFLITO_DA_GERACAO_DE_CONTAS =
  'on conflict ("conta_fixa_id","mes_referencia") where "documentos"."cancelado_em" is null do nothing';

// `conferirPolimento` prova, no banco comum, o que a 0031 cria (D-18, D-26, UI-D9): o índice único
// PARCIAL das contas fixas no lugar da única antiga (cancelada libera o mês; duas ativas → 23505), os
// três índices de leitura e `correcoes_de_documento` (colunas, únicas, check, chaves estrangeiras e os
// privilégios de `amassa_app`: `select`/`insert`, sem `update`/`delete`). Todo dado de prova vive numa
// transação só, desfeita no fim — os gatilhos de soma do documento (`deferrable initially deferred`)
// nunca chegam a disparar, e nada sobra no banco que os outros passos compartilham.
async function conferirPolimento(conexao) {
  console.log("  conferirPolimento...");

  async function umaLinha(sql, parametros = []) {
    const { rows } = await conexao.query(sql, parametros);
    return rows[0];
  }
  // Dentro da transação aberta: roda num savepoint, devolve o código e a restrição, e volta ao
  // savepoint — a transação de fora continua utilizável.
  async function tentarNoSavepoint(sql, parametros = []) {
    await conexao.query("savepoint tentativa_polimento");
    const resultado = await erroDoBanco(() => conexao.query(sql, parametros));
    await conexao.query("rollback to savepoint tentativa_polimento");
    return resultado;
  }
  function esperar(resultado, codigoEsperado, restricao, descricao) {
    afirmar(
      resultado.codigo === codigoEsperado && (restricao === null || resultado.restricao === restricao),
      `Polimento: ${descricao} deveria dar ${codigoEsperado ?? "certo"}` +
        (restricao ? ` (${restricao})` : "") +
        `, veio ${resultado.codigo} (${resultado.restricao}).`,
    );
  }

  // ——— (a) O índice parcial existe com o predicado; a única antiga, não ————————————————————————————
  const parcial = await umaLinha(
    "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'documentos_conta_fixa_mes_ativo_uk'",
  );
  afirmar(
    parcial !== undefined &&
      parcial.indexdef.startsWith("CREATE UNIQUE INDEX") &&
      parcial.indexdef.includes("(conta_fixa_id, mes_referencia)") &&
      parcial.indexdef.includes("WHERE (cancelado_em IS NULL)"),
    "Polimento: o índice único parcial documentos_conta_fixa_mes_ativo_uk (conta_fixa_id, mes_referencia) " +
      `where cancelado_em is null deveria existir, veio ${parcial ? parcial.indexdef : "nada"}.`,
  );
  const antiga = await umaLinha(
    `select (select count(*) from pg_constraint where conname = 'documentos_conta_fixa_mes_uk')::int as restricoes,
            (select count(*) from pg_indexes where schemaname = 'public'
                and indexname = 'documentos_conta_fixa_mes_uk')::int as indices`,
  );
  afirmar(
    antiga.restricoes === 0 && antiga.indices === 0,
    `Polimento: a única antiga documentos_conta_fixa_mes_uk deveria ter saído, veio ${JSON.stringify(antiga)}.`,
  );

  // ——— (c) Os três índices de leitura ———————————————————————————————————————————————————————————
  for (const [indice, tabela, coluna] of [
    ["movimentacoes_estoque_encomenda_idx", "movimentacoes_estoque", "encomenda_id"],
    ["mensalidades_cliente_idx", "mensalidades", "cliente_id"],
    ["usos_livres_cliente_idx", "usos_livres", "cliente_id"],
  ]) {
    const linha = await umaLinha(
      "select tablename, indexdef from pg_indexes where schemaname = 'public' and indexname = $1",
      [indice],
    );
    afirmar(
      linha !== undefined && linha.tablename === tabela && linha.indexdef.endsWith(`USING btree (${coluna})`),
      `Polimento: o índice ${indice} em ${tabela} (${coluna}) deveria existir, veio ${linha ? linha.indexdef : "nada"}.`,
    );
  }

  // ——— (d) A tabela do vínculo da correção: colunas, chaves estrangeiras e privilégios ————————————
  const { rows: colunas } = await conexao.query(
    `select column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'correcoes_de_documento' order by column_name`,
  );
  const colunasEsperadas = {
    corrigido_id: ["uuid", "NO"],
    criado_em: ["timestamp with time zone", "NO"],
    criado_por: ["uuid", "NO"],
    id: ["uuid", "NO"],
    original_id: ["uuid", "NO"],
  };
  afirmar(
    JSON.stringify(Object.fromEntries(colunas.map((c) => [c.column_name, [c.data_type, c.is_nullable]]))) ===
      JSON.stringify(colunasEsperadas),
    `Polimento: as colunas de correcoes_de_documento deveriam ser ${JSON.stringify(colunasEsperadas)}, ` +
      `vieram ${JSON.stringify(colunas)}.`,
  );
  const { rows: chaves } = await conexao.query(
    `select a.attname as coluna, con.confrelid::regclass::text as destino, con.confdeltype as ao_apagar
       from pg_constraint con
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.contype = 'f' and con.conrelid = 'public.correcoes_de_documento'::regclass
      order by 1`,
  );
  afirmar(
    JSON.stringify(chaves) ===
      JSON.stringify([
        { coluna: "corrigido_id", destino: "documentos", ao_apagar: "a" },
        { coluna: "criado_por", destino: "usuarios", ao_apagar: "a" },
        { coluna: "original_id", destino: "documentos", ao_apagar: "a" },
      ]),
    "Polimento: as chaves de correcoes_de_documento deveriam ir a documentos (original e corrigido) e a " +
      `usuarios, todas sem on delete — vieram ${JSON.stringify(chaves)}.`,
  );
  const privilegios = await umaLinha(
    `select has_table_privilege('amassa_app', 'correcoes_de_documento', 'select') as pode_select,
            has_table_privilege('amassa_app', 'correcoes_de_documento', 'insert') as pode_insert,
            has_table_privilege('amassa_app', 'correcoes_de_documento', 'update') as pode_update,
            has_table_privilege('amassa_app', 'correcoes_de_documento', 'delete') as pode_delete`,
  );
  afirmar(
    privilegios.pode_select && privilegios.pode_insert && !privilegios.pode_update && !privilegios.pode_delete,
    "Polimento: amassa_app deveria ter select e insert em correcoes_de_documento, e NÃO update nem delete " +
      `(o vínculo só cresce) — veio ${JSON.stringify(privilegios)}.`,
  );

  // ——— (b) e (d) com dado: tudo numa transação desfeita no fim ——————————————————————————————————
  await conexao.query("begin");
  try {
    const usuarioId = (
      await umaLinha(
        `insert into usuarios (nome, email, senha_hash)
         values ('Usuária de Teste do Polimento [mig]', 'usuaria-polimento@exemplo.test', 'hash-fake-de-teste')
         returning id`,
      )
    ).id;
    const categoriaId = (await umaLinha("select id from categorias where nome = 'Aluguel'")).id;
    const contaFixaId = (
      await umaLinha(
        `insert into contas_fixas (nome, categoria_id, valor_esperado_centavos, dia_vencimento)
         values ('[mig] Conta fixa do Polimento', $1, 15000, 5) returning id`,
        [categoriaId],
      )
    ).id;
    async function documentoDaConta({ cancelado }) {
      return (
        await umaLinha(
          `insert into documentos (tipo, data, criado_por, conta_fixa_id, mes_referencia, cancelado_em, cancelado_por)
           values ('despesa', '2026-02-05', $1, $2, '2026-02-01',
                   case when $3::boolean then now() end, case when $3::boolean then $1::uuid end)
           returning id`,
          [usuarioId, contaFixaId, cancelado],
        )
      ).id;
    }

    // (b) Cancelada libera o mês: um documento CANCELADO e outro ATIVO convivem no mesmo conta/mês.
    const cancelado = await documentoDaConta({ cancelado: true });
    const ativo = await documentoDaConta({ cancelado: false });
    // Um segundo cancelado também entra (o índice só olha os ativos).
    await documentoDaConta({ cancelado: true });
    // Um segundo ATIVO no mesmo conta/mês cai em 23505 pelo índice parcial.
    esperar(
      await tentarNoSavepoint(
        `insert into documentos (tipo, data, criado_por, conta_fixa_id, mes_referencia)
         values ('despesa', '2026-02-05', $1, $2, '2026-02-01')`,
        [usuarioId, contaFixaId],
      ),
      "23505",
      "documentos_conta_fixa_mes_ativo_uk",
      "um segundo documento ATIVO no mesmo conta fixa/mês",
    );
    // E a frase de `gerarContasDoMes` infere o índice parcial: com um ativo, não insere nem falha.
    const { rows: ignoradas } = await conexao.query(
      `insert into documentos (tipo, data, criado_por, conta_fixa_id, mes_referencia)
       values ('despesa', '2026-02-05', $1, $2, '2026-02-01') ${CONFLITO_DA_GERACAO_DE_CONTAS} returning id`,
      [usuarioId, contaFixaId],
    );
    afirmar(
      ignoradas.length === 0,
      `Polimento: com um documento ativo no mês, a geração deveria ignorar a inserção, criou ${ignoradas.length}.`,
    );

    // (d) O check e as duas únicas do vínculo; e `amassa_app` insere e lê, mas não altera nem apaga.
    esperar(
      await tentarNoSavepoint(
        "insert into correcoes_de_documento (original_id, corrigido_id, criado_por) values ($1, $1, $2)",
        [cancelado, usuarioId],
      ),
      "23514",
      "correcoes_de_documento_original_diferente_do_corrigido",
      "um vínculo com original = corrigido",
    );
    const outroCorrigido = await documentoDaConta({ cancelado: true });
    await conexao.query("set local role amassa_app");
    esperar(
      await tentarNoSavepoint(
        "insert into correcoes_de_documento (original_id, corrigido_id, criado_por) values ($1, $2, $3)",
        [cancelado, ativo, usuarioId],
      ),
      null,
      null,
      "amassa_app inserindo um vínculo de correção",
    );
    await conexao.query(
      "insert into correcoes_de_documento (original_id, corrigido_id, criado_por) values ($1, $2, $3)",
      [cancelado, ativo, usuarioId],
    );
    const lido = await umaLinha(
      "select count(*)::int as quantos from correcoes_de_documento where original_id = $1",
      [cancelado],
    );
    afirmar(lido.quantos === 1, `Polimento: amassa_app deveria ler o vínculo que gravou, leu ${lido.quantos}.`);
    esperar(
      await tentarNoSavepoint("update correcoes_de_documento set criado_em = now() where original_id = $1", [
        cancelado,
      ]),
      "42501",
      null,
      "amassa_app alterando um vínculo de correção",
    );
    esperar(
      await tentarNoSavepoint("delete from correcoes_de_documento where original_id = $1", [cancelado]),
      "42501",
      null,
      "amassa_app apagando um vínculo de correção",
    );
    await conexao.query("reset role");
    esperar(
      await tentarNoSavepoint(
        "insert into correcoes_de_documento (original_id, corrigido_id, criado_por) values ($1, $2, $3)",
        [cancelado, outroCorrigido, usuarioId],
      ),
      "23505",
      "correcoes_de_documento_original_uk",
      "a MESMA original corrigida duas vezes",
    );
    esperar(
      await tentarNoSavepoint(
        "insert into correcoes_de_documento (original_id, corrigido_id, criado_por) values ($1, $2, $3)",
        [outroCorrigido, ativo, usuarioId],
      ),
      "23505",
      "correcoes_de_documento_corrigido_uk",
      "o MESMO corrigido corrigindo duas originais",
    );
  } finally {
    // Desfeita sempre: o usuário, a conta, os documentos e o vínculo de prova somem juntos.
    await conexao.query("rollback");
  }

  const sobras = await umaLinha(
    "select count(*)::int as quantos from contas_fixas where nome = '[mig] Conta fixa do Polimento'",
  );
  afirmar(sobras.quantos === 0, `Polimento: o dado de prova deveria ter sido desfeito, sobraram ${sobras.quantos}.`);
}

// `provarJanelaDoPolimentoEmBancoProprio` prova a janela entre o `implantar` e o `db:migrate` do dono
// (T-06.5-26): num banco próprio parado na 0030 — o esquema da produção até o Roteiro 22 —, a geração
// de contas com o predicado novo NÃO falha (o Postgres infere a única antiga) e é idempotente; um mês
// cancelado continua sem ser gerado de novo (é o comportamento de hoje). Aplicada a 0031 sozinha
// sobre esse dado, ela entra sem erro e a MESMA frase passa a gerar o documento ativo do mês cancelado
// — uma vez só. Cada geração é como a de `gerarContasDoMes`: documento + linha + parcela, numa
// transação commitada (os gatilhos de soma conferem). O banco inteiro é apagado no fim.
async function provarJanelaDoPolimentoEmBancoProprio() {
  const banco = await criarBancoProprio("polimento");
  try {
    console.log(`Provando a janela da 0031 (geração de contas antes e depois), em banco proprio ("${banco.nome}")...`);
    const cliente = new Client({ connectionString: banco.url });
    await cliente.connect();
    try {
      await aplicarMigracoesAte(cliente, 30);
      const usuarioId = (
        await cliente.query(
          `insert into usuarios (nome, email, senha_hash)
           values ('Usuária da Janela do Polimento [mig]', 'usuaria-janela@exemplo.test', 'hash-fake-de-teste')
           returning id`,
        )
      ).rows[0].id;
      const categoriaId = (await cliente.query("select id from categorias where nome = 'Aluguel'")).rows[0].id;
      const contaFixaId = (
        await cliente.query(
          `insert into contas_fixas (nome, categoria_id, valor_esperado_centavos, dia_vencimento)
           values ('[mig] Conta da janela', $1, 15000, 5) returning id`,
          [categoriaId],
        )
      ).rows[0].id;

      // Uma geração do mês de março, como `gerarContasDoMes`: o id criado, ou `null` se ignorada.
      async function gerarMarco(momento) {
        await cliente.query("begin");
        try {
          const { rows } = await cliente.query(
            `insert into documentos (tipo, data, titulo, criado_por, conta_fixa_id, mes_referencia)
             values ('despesa', '2026-03-05', 'Conta da janela — março', $1, $2, '2026-03-01')
             ${CONFLITO_DA_GERACAO_DE_CONTAS} returning id`,
            [usuarioId, contaFixaId],
          );
          const id = rows[0]?.id ?? null;
          if (id) {
            await cliente.query(
              `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, valor_centavos)
               values ($1, 0, 'Conta da janela', $2, 15000)`,
              [id, categoriaId],
            );
            await cliente.query(
              `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma)
               values ($1, 1, '2026-03-05', 15000, 'pix')`,
              [id],
            );
          }
          await cliente.query("commit");
          return id;
        } catch (erro) {
          await cliente.query("rollback").catch(() => {});
          throw new Error(`Polimento (janela, ${momento}): a geração de contas falhou — ${erro.message} (${erro.code})`);
        }
      }
      async function documentosDeMarco() {
        return (
          await cliente.query(
            `select count(*)::int as todos, count(*) filter (where cancelado_em is null)::int as ativos
               from documentos where conta_fixa_id = $1 and mes_referencia = '2026-03-01'`,
            [contaFixaId],
          )
        ).rows[0];
      }

      // Antes da 0031: gera, é idempotente, e o mês cancelado não volta (a única antiga segura).
      const primeiro = await gerarMarco("antes da 0031");
      afirmar(primeiro !== null, "Polimento (janela): antes da 0031, a primeira geração deveria criar o documento.");
      afirmar(
        (await gerarMarco("antes da 0031, de novo")) === null,
        "Polimento (janela): antes da 0031, gerar o mesmo mês de novo deveria ser ignorado (idempotente).",
      );
      await cliente.query(
        "update documentos set cancelado_em = now(), cancelado_por = $1 where id = $2",
        [usuarioId, primeiro],
      );
      afirmar(
        (await gerarMarco("antes da 0031, com o mês cancelado")) === null,
        "Polimento (janela): antes da 0031, um mês cancelado deveria continuar sem ser gerado (sem falhar).",
      );
      const antes = await documentosDeMarco();
      afirmar(
        antes.todos === 1 && antes.ativos === 0,
        `Polimento (janela): antes da 0031 deveria haver 1 documento, cancelado — veio ${JSON.stringify(antes)}.`,
      );

      // A 0031 sozinha, sobre o dado da produção.
      await aplicarMigracoesAte(cliente, 31, 31);

      // Depois: o mesmo pedido gera o documento ativo do mês cancelado — uma vez só.
      const regenerado = await gerarMarco("depois da 0031");
      afirmar(
        regenerado !== null && regenerado !== primeiro,
        "Polimento (janela): depois da 0031, o mês cancelado deveria ser gerado de novo (documento novo).",
      );
      afirmar(
        (await gerarMarco("depois da 0031, de novo")) === null,
        "Polimento (janela): depois da 0031, gerar o mesmo mês de novo deveria ser ignorado (idempotente).",
      );
      const depois = await documentosDeMarco();
      afirmar(
        depois.todos === 2 && depois.ativos === 1,
        `Polimento (janela): depois da 0031 deveria haver 2 documentos, 1 ativo — veio ${JSON.stringify(depois)}.`,
      );

      // O caminho de volta do Roteiro 22: o código ANTERIOR à 06.5 (sem o predicado) sobre o banco
      // COM a 0031 não acha índice para inferir — 42P10. Reverter a publicação depois da migração
      // deixa o “Gerar as contas” quebrado (e só ele); o roteiro diz isso. Roda e desfaz.
      await cliente.query("begin");
      const semPredicado = await erroDoBanco(() =>
        cliente.query(
          `insert into documentos (tipo, data, criado_por, conta_fixa_id, mes_referencia)
           values ('despesa', '2026-04-05', $1, $2, '2026-04-01')
           on conflict ("conta_fixa_id","mes_referencia") do nothing`,
          [usuarioId, contaFixaId],
        ),
      );
      await cliente.query("rollback");
      afirmar(
        semPredicado.codigo === "42P10",
        "Polimento (janela): depois da 0031, a geração SEM o predicado (o código antigo) deveria cair em " +
          `42P10 — o Roteiro 22 conta com isso no caminho de volta —, veio ${semPredicado.codigo}.`,
      );
      console.log("  provarJanelaDoPolimentoEmBancoProprio: antes e depois da 0031, ok.");
    } finally {
      await cliente.end();
    }
  } finally {
    // O banco inteiro — usuário, conta, documentos — some com ele.
    await banco.apagar();
  }
}

// As corridas da Agenda achadas na revisão de código da Fase 5 (05-REVIEW-A.md: CR-01, WR-01, WR-03),
// provadas com o CÓDIGO DA APLICAÇÃO (`lib/agenda/gravacao.ts`, `gravarVenda`) e duas transações que se
// sobrepõem de fato — a primeira trava e para numa barreira, a segunda espera a trava. Roda num processo
// filho com `tsx` (o código é TypeScript com o alias `@/`), contra o MESMO banco de teste; sai diferente
// de 0 se qualquer afirmação falhar, e `execSync` lança.
function provarCorridasDaAgenda() {
  console.log("  provarCorridasDaAgenda...");
  rodarNpm("npx", ["tsx", "scripts/provar-corridas-da-agenda.ts"], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
  });
}

// As corridas da cobrança das externas das Queimas (Fase 06.4, plano 04 — D-07): Recebi × Recebi por
// tamanho, Recebi × corrigir/apagar a contagem, Recebi × excluir a queima, contagem × contagem, a venda
// cancelada devolvendo a quantidade e a idempotência — o CÓDIGO da aplicação (`lib/queimas/gravacao.ts`)
// com duas transações sobrepostas de fato, no molde de `provarCorridasDaAgenda`.
function provarCorridasDasQueimas() {
  console.log("  provarCorridasDasQueimas...");
  rodarNpm("npx", ["tsx", "scripts/provar-corridas-das-queimas.ts"], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
  });
}

async function conferirBanco() {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await conferirFusoDoBanco(cliente);
    await conferirTabelas(cliente);
    await conferirTabelaExecucoesBackup(cliente);
    await conferirExtensaoEFuncoes(cliente);
    await conferirTriggerFuncionando(cliente);
    await conferirPapelEPrivilegios(cliente);
    await conferirContas(cliente);
    await conferirFinanceiro(cliente);
    await conferirPrecificacaoEOrcamentos(cliente);
    await conferirNumeracaoConcorrenteDeOrcamento();
    await conferirSementeDeParametros(cliente);
    await conferirCorrecaoDoFusoDaSemente(cliente);
    await conferirAnotacoesDaCasa(cliente);
    await conferirEstoque(cliente);
    await conferirProducao(cliente);
    await conferirAgenda(cliente);
    await conferirFornecedores(cliente);
    await conferirLembretes(cliente);
    await conferirQueimas(cliente);
    await conferirPolimento(cliente);
    await conferirConcorrenciaDoEstoque();
    await conferirConcorrenciaDaProducao();
    provarCorridasDaAgenda();
    provarCorridasDasQueimas();
  } finally {
    await cliente.end();
  }

  // Em banco PROPRIO, descartavel, criado agora e apagado no fim — nunca no banco que os
  // outros passos compartilham. Ver o comentario de `provarRemocaoEmBancoProprio`.
  await provarRemocaoEmBancoProprio();

  // Idem — o D-02 da 0024 sobre dado existente precisa de um banco parado em 0023 (ver o
  // comentario de `provarMigracaoDaProducaoEmBancoProprio`).
  await provarMigracaoDaProducaoEmBancoProprio();

  // Idem — a virada roda o script de importação de verdade, num banco só dela (ver o
  // comentário de `provarViradaEmBancoProprio`, abaixo).
  await provarViradaEmBancoProprio();

  // Idem — a janela da 0031 precisa de um banco parado na 0030 (ver o comentário de
  // `provarJanelaDoPolimentoEmBancoProprio`).
  await provarJanelaDoPolimentoEmBancoProprio();
}

async function main() {
  const emCI = Boolean(process.env.CI);

  if (emCI) {
    // O runner já entrega o banco de teste pronto e alcançável — nada para subir aqui.
    console.log("CI detectado: usando o banco de teste já fornecido pelo runner.");
  } else {
    await subirBancoDeTeste();
  }

  let codigoDeSaida = 1;
  try {
    console.log("Aplicando migrações no banco de teste...");
    rodarNpm("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
    });

    console.log("Conferindo o resultado, de fora, pelo cliente pg...");
    await conferirBanco();

    console.log("Todas as afirmações passaram.");
    codigoDeSaida = 0;
  } catch (erro) {
    console.error("test:migracoes falhou:", erro.message);
    codigoDeSaida = 1;
  } finally {
    if (!emCI) {
      console.log("Derrubando o Postgres de teste — nada sobrevive ao contêiner.");
      tentarRodarDocker(["compose", "-f", "docker/compose.teste.yml", "down", "--remove-orphans"]);
    }
  }

  process.exit(codigoDeSaida);
}

main();
