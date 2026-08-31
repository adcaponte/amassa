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
  // Fase 3 — Gestor de Encomendas (migração 0005_encomendas).
  "encomendas",
  "encomenda_itens",
  "encomenda_etapas",
  // Fase 4 — Contador de Queima (migração 0007_queimas).
  "fornos",
  "queimas",
  "manutencoes",
  // Fase 4.2 — Abertura do Espaço (migração 0010_abertura-do-espaco). MÓDULO TEMPORÁRIO: estas
  // três saem juntas na remoção do plano 04.2-05.
  "abertura_itens",
  "abertura_tarefas",
  "abertura_configuracao",
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
  const esperadas = ["id", "quando", "sucesso", "bytes", "destino_externo_ok", "mensagem"];
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
    "insert into execucoes_backup (sucesso) values (true) returning id, destino_externo_ok",
  );
  const { id, destino_externo_ok: destinoExternoOk } = inserida.rows[0];
  try {
    afirmar(
      destinoExternoOk === false,
      "destino_externo_ok deveria sair falso por padrão ao inserir só sucesso (o padrão " +
        `pessimista é deliberado) — veio ${destinoExternoOk}.`,
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
    // ÚLTIMA de todas — destrói tabelas, e qualquer verificação depois dela estaria olhando um
    // banco mutilado (ver o comentário da função acima).
    await conferirRemocaoDoModuloAbertura(cliente);
  } finally {
    await cliente.end();
  }
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
