#!/usr/bin/env node
// Prova scripts/backup.sh e scripts/restaurar.sh de ponta a ponta, sem servidor: os dois
// scripts rodam DENTRO do contêiner efêmero do Postgres de teste — ele já tem o cliente, o
// gerador de dump, o compressor e um shell POSIX, e (de propósito) não tem `rclone`, o que
// exercita de graça o caminho sem destino externo (D2). Os scripts chegam por `docker cp`, não
// por volume montado — caminho de host montado em volume é a peça que quebra no Windows, a
// mesma lição já paga em 01-07-SUMMARY.md.
//
// Orquestração no molde de scripts/testar-e2e.mjs e scripts/testar-migracoes.mjs: localmente
// sobe o Postgres efêmero de docker/compose.teste.yml e o derruba no finally; em CI (a mesma
// variável CI que o runner sempre define) reaproveita o *service container* que o job `e2e` já
// entrega, descoberto pela imagem — nada para subir nem para derrubar.

import { execFileSync, execSync } from "node:child_process";
import { Client } from "pg";

const NOME_CONTAINER_LOCAL = "amassa_postgres_teste_backup";
const PORTA_HOST = 5436;
const USUARIO = "amassa_teste";
const SENHA = "efemero_de_teste_sem_valor_real";
const BANCO = "amassa_teste";

// Caminhos usados DENTRO do contêiner — nunca no host.
const SCRIPTS_DIR_CONTAINER = "/tmp/scripts-amassa";
const BACKUP_DIR_CONTAINER = "/tmp/amassa-backups";
const BACKUP_DIR_MENSAL_CONTAINER = `${BACKUP_DIR_CONTAINER}/mensais`;
const DESTINO_EXTERNO_CONTAINER = "/tmp/amassa-destino-externo";

const EMAIL_CONHECIDO = "backup-teste-plano-07@exemplo.test";
const NOME_CONHECIDO = "Usuária Conhecida do Teste de Backup";
const NOTA_CONHECIDA = "linha conhecida para prova de restauração — plano 07";

const emCI = Boolean(process.env.CI);
let nomeContainer = NOME_CONTAINER_LOCAL;

// --- Infraestrutura: subir/descobrir o Postgres de teste, no molde dos outros scripts. ---

function tentarRodarDocker(args) {
  try {
    execFileSync("docker", args, { stdio: "ignore" });
  } catch {
    // Sem problema — usado só para limpeza best-effort.
  }
}

function rodarNpm(comando, args, opcoes = {}) {
  // npm/npx são scripts .cmd no Windows — precisam do shell para rodar.
  execSync(`${comando} ${args.join(" ")}`, { stdio: "inherit", ...opcoes });
}

function statusDeSaude(nome) {
  try {
    return execFileSync("docker", ["inspect", "-f", "{{.State.Health.Status}}", nome])
      .toString()
      .trim();
  } catch {
    return "";
  }
}

async function esperarSaudavel(nome, tentativasMax = 30) {
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    if (statusDeSaude(nome) === "healthy") return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Postgres de teste (${nome}) não ficou saudável a tempo.`);
}

async function subirBancoDeTeste() {
  console.log("Subindo o Postgres de teste (efêmero, porta só desta execução)...");
  tentarRodarDocker(["compose", "-f", "docker/compose.teste.yml", "down", "--remove-orphans"]);
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "docker/compose.teste.yml",
      "run",
      "-d",
      "--rm",
      "--name",
      NOME_CONTAINER_LOCAL,
      "-p",
      `127.0.0.1:${PORTA_HOST}:5432`,
      "postgres_teste",
    ],
    { stdio: "inherit" },
  );
  await esperarSaudavel(NOME_CONTAINER_LOCAL);
  process.env.DATABASE_URL_TESTE = `postgresql://${USUARIO}:${SENHA}@127.0.0.1:${PORTA_HOST}/${BANCO}`;
  console.log("Banco de teste no ar.");
}

// Em CI, o serviço `postgres_teste` do job `e2e` já está de pé (entrega.yml) — descobre o nome
// real do contêiner pela imagem, em vez de supor um nome fixo que o runner não garante.
function descobrirContainerEmCI() {
  const saida = execFileSync("docker", [
    "ps",
    "--filter",
    "ancestor=postgres:17-alpine",
    "--format",
    "{{.Names}}",
  ])
    .toString()
    .trim();
  const nomes = saida.split("\n").filter(Boolean);
  if (nomes.length !== 1) {
    throw new Error(
      "Esperava encontrar exatamente um contêiner da imagem postgres:17-alpine em execução " +
        `(o service container do job e2e), encontrei ${nomes.length}: ${nomes.join(", ") || "nenhum"}.`,
    );
  }
  return nomes[0];
}

// --- Comandos dentro do contêiner. ---

function dockerExecComCodigo(argsAposContainer, { env = {} } = {}) {
  const envArgs = Object.entries(env).flatMap(([chave, valor]) => ["-e", `${chave}=${valor}`]);
  const args = ["exec", ...envArgs, nomeContainer, ...argsAposContainer];
  try {
    const saida = execFileSync("docker", args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
    return { codigo: 0, saida };
  } catch (erro) {
    const saida = `${erro.stdout ? erro.stdout.toString() : ""}${erro.stderr ? erro.stderr.toString() : ""}`;
    return { codigo: typeof erro.status === "number" ? erro.status : 1, saida };
  }
}

function listarArquivos(diretorio) {
  const { codigo, saida } = dockerExecComCodigo(["sh", "-c", `ls -1 "${diretorio}" 2>/dev/null`]);
  if (codigo !== 0) return [];
  return saida
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
}

function tamanhoArquivo(caminho) {
  const { codigo, saida } = dockerExecComCodigo(["sh", "-c", `stat -c%s "${caminho}" 2>/dev/null`]);
  if (codigo !== 0) return -1;
  return Number(saida.trim());
}

function gzipIntegro(caminho) {
  return dockerExecComCodigo(["gzip", "-t", caminho]).codigo === 0;
}

// Variáveis comuns a toda invocação de backup.sh dentro do contêiner: comandos do Postgres
// trocados pelos binários locais (o contêiner não tem `rclone`, o que já exercita de graça o
// caminho "sem destino externo"), e os diretórios internos de backup.
function envBackupBase(extra = {}) {
  return {
    PG_DUMP_CMD: "pg_dump --clean --if-exists",
    PG_CLIENT_CMD: "psql",
    POSTGRES_USER: USUARIO,
    POSTGRES_DB: BANCO,
    BACKUP_DIR: BACKUP_DIR_CONTAINER,
    BACKUP_DIR_MENSAL: BACKUP_DIR_MENSAL_CONTAINER,
    RCLONE_REMOTE: "",
    ...extra,
  };
}

function rodarBackup(argumentos, envExtra = {}) {
  return dockerExecComCodigo(["sh", `${SCRIPTS_DIR_CONTAINER}/backup.sh`, ...argumentos], {
    env: envBackupBase(envExtra),
  });
}

function rodarRestaurar(argumentos, envExtra = {}) {
  return dockerExecComCodigo(["sh", `${SCRIPTS_DIR_CONTAINER}/restaurar.sh`, ...argumentos], {
    env: { PG_CLIENT_CMD: "psql", POSTGRES_USER: USUARIO, ...envExtra },
  });
}

// --- Afirmações. Lança no primeiro erro, com a etapa no início da mensagem — é o que faz
// `npm run test:backup` sair diferente de 0 e a falha ser localizável. ---
function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

const PADRAO_ARQUIVO_DIARIO = /^amassa-\d{4}-\d{2}-\d{2}\.sql\.gz$/;
const PADRAO_ARQUIVO_SOB_DEMANDA = /^amassa-\d{4}-\d{2}-\d{2}-\d{4}\.sql\.gz$/;

async function ultimaExecucaoRegistrada(cliente) {
  const { rows } = await cliente.query(
    "select sucesso, bytes, destino_externo_ok, mensagem from execucoes_backup order by quando desc limit 1",
  );
  return rows[0];
}

// --- Etapa 1: banco migrado, com as duas linhas conhecidas que provam a volta. ---
async function etapa1_prepararBancoELinhasConhecidas(cliente) {
  console.log("Etapa 1/8: migrando o banco de teste e inserindo linhas conhecidas...");
  rodarNpm("npm", ["run", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
  });

  await cliente.query(
    `insert into usuarios (nome, email, senha_hash)
     values ($1, $2, 'hash-fake-de-teste-do-plano-07')`,
    [NOME_CONHECIDO, EMAIL_CONHECIDO],
  );
  await cliente.query("insert into verificacao_infraestrutura (nota) values ($1)", [NOTA_CONHECIDA]);

  const { rows: usuariosRows } = await cliente.query("select count(*) from usuarios where email = $1", [
    EMAIL_CONHECIDO,
  ]);
  const { rows: infraRows } = await cliente.query(
    "select count(*) from verificacao_infraestrutura where nota = $1",
    [NOTA_CONHECIDA],
  );
  afirmar(
    Number(usuariosRows[0].count) === 1 && Number(infraRows[0].count) === 1,
    "Etapa 1: as linhas conhecidas não foram inseridas corretamente antes do backup.",
  );
}

// --- Copia os dois scripts para dentro do contêiner (docker cp, nunca volume). ---
function copiarScriptsParaOContainer() {
  console.log("Copiando scripts/backup.sh e scripts/restaurar.sh para dentro do contêiner...");
  dockerExecComCodigo(["mkdir", "-p", SCRIPTS_DIR_CONTAINER]);
  execFileSync("docker", ["cp", "scripts/backup.sh", `${nomeContainer}:${SCRIPTS_DIR_CONTAINER}/backup.sh`], {
    stdio: "inherit",
  });
  execFileSync(
    "docker",
    ["cp", "scripts/restaurar.sh", `${nomeContainer}:${SCRIPTS_DIR_CONTAINER}/restaurar.sh`],
    { stdio: "inherit" },
  );
}

// --- Etapa 2: backup do dia. ---
async function etapa2_backupDoDia(cliente) {
  console.log("Etapa 2/8: backup do dia (sem destino externo configurado)...");
  const { codigo, saida } = rodarBackup([]);
  afirmar(codigo === 0, `Etapa 2: scripts/backup.sh saiu com código ${codigo}, esperava 0.\n${saida}`);

  const arquivos = listarArquivos(BACKUP_DIR_CONTAINER).filter((nome) => nome !== "mensais");
  const diarios = arquivos.filter((nome) => PADRAO_ARQUIVO_DIARIO.test(nome));
  afirmar(
    diarios.length === 1,
    `Etapa 2: esperava exatamente um arquivo no padrão do dia em ${BACKUP_DIR_CONTAINER}, encontrei ${diarios.length}: ${arquivos.join(", ")}.`,
  );
  const caminho = `${BACKUP_DIR_CONTAINER}/${diarios[0]}`;
  afirmar(tamanhoArquivo(caminho) > 0, `Etapa 2: o arquivo ${caminho} está vazio.`);
  afirmar(gzipIntegro(caminho), `Etapa 2: o arquivo ${caminho} não passou no teste de integridade do gzip.`);

  const ultima = await ultimaExecucaoRegistrada(cliente);
  afirmar(ultima, "Etapa 2: nenhuma linha foi registrada em execucoes_backup.");
  afirmar(ultima.sucesso === true, `Etapa 2: execucoes_backup.sucesso deveria ser true, veio ${ultima.sucesso}.`);
  afirmar(
    Number(ultima.bytes) > 0,
    `Etapa 2: execucoes_backup.bytes deveria ser maior que zero, veio ${ultima.bytes}.`,
  );
  afirmar(
    ultima.destino_externo_ok === false,
    "Etapa 2: execucoes_backup.destino_externo_ok deveria ser false sem destino configurado " +
      `(sucesso silencioso nunca é aceitável) — veio ${ultima.destino_externo_ok}.`,
  );
  return diarios[0];
}

// --- Etapa 3: backup sob demanda (--agora) não sobrescreve o dump do dia. ---
function etapa3_backupSobDemanda(arquivoDiario) {
  console.log("Etapa 3/8: backup sob demanda (--agora)...");
  const { codigo, saida } = rodarBackup(["--agora"]);
  afirmar(codigo === 0, `Etapa 3: scripts/backup.sh --agora saiu com código ${codigo}, esperava 0.\n${saida}`);

  const arquivos = listarArquivos(BACKUP_DIR_CONTAINER).filter((nome) => nome !== "mensais");
  afirmar(
    arquivos.includes(arquivoDiario),
    `Etapa 3: o dump do dia (${arquivoDiario}) desapareceu depois do disparo sob demanda — ` +
      "o --agora não pode sobrescrever a única cópia limpa do dia.",
  );
  const sobDemanda = arquivos.filter((nome) => PADRAO_ARQUIVO_SOB_DEMANDA.test(nome));
  afirmar(
    sobDemanda.length === 1,
    `Etapa 3: esperava exatamente um arquivo com hora e minuto no nome, encontrei ${sobDemanda.length}: ${arquivos.join(", ")}.`,
  );
}

// --- Etapa 4: rotação de 14 dias e retenção mensal (o par em sentidos opostos). ---
function etapa4_rotacaoERetencaoMensal() {
  console.log("Etapa 4/8: rotação de 14 dias e retenção mensal...");
  const antigoDiario = `${BACKUP_DIR_CONTAINER}/amassa-2000-01-01.sql.gz`;
  const antigoMensal = `${BACKUP_DIR_MENSAL_CONTAINER}/amassa-2000-01-01.sql.gz`;

  // Escreve o conteúdo ANTES de tocar o carimbo — escrever depois do touch atualiza o mtime
  // de volta para "agora" e derruba o próprio teste.
  dockerExecComCodigo(["mkdir", "-p", BACKUP_DIR_MENSAL_CONTAINER]);
  dockerExecComCodigo(["sh", "-c", `echo antigo > "${antigoDiario}" && touch -t 200001010000 "${antigoDiario}"`]);
  dockerExecComCodigo([
    "sh",
    "-c",
    `echo antigo-mensal > "${antigoMensal}" && touch -t 200001010000 "${antigoMensal}"`,
  ]);

  const { codigo, saida } = rodarBackup([], { BACKUP_DIA_DO_MES: "01" });
  afirmar(
    codigo === 0,
    `Etapa 4: scripts/backup.sh com BACKUP_DIA_DO_MES=01 saiu com código ${codigo}, esperava 0.\n${saida}`,
  );

  const arquivosDiarios = listarArquivos(BACKUP_DIR_CONTAINER).filter((nome) => nome !== "mensais");
  afirmar(
    !arquivosDiarios.includes("amassa-2000-01-01.sql.gz"),
    "Etapa 4: o arquivo antigo do primeiro nível não foi apagado pela rotação — " +
      `arquivos atuais: ${arquivosDiarios.join(", ")}.`,
  );
  const diariosRecentes = arquivosDiarios.filter((nome) => PADRAO_ARQUIVO_DIARIO.test(nome));
  afirmar(
    diariosRecentes.length === 1,
    "Etapa 4: o dump recente do dia deveria continuar existindo depois da rotação.",
  );

  const arquivosMensais = listarArquivos(BACKUP_DIR_MENSAL_CONTAINER);
  afirmar(
    arquivosMensais.includes("amassa-2000-01-01.sql.gz"),
    "Etapa 4: o arquivo antigo da pasta MENSAL foi apagado — a rotação nunca deveria descer " +
      "nessa pasta (ela não é limpa).",
  );
  afirmar(
    diariosRecentes.some((nome) => arquivosMensais.includes(nome)),
    "Etapa 4: o dia 1º deveria copiar o dump de hoje para a pasta mensal, e a cópia não apareceu.",
  );
}

// --- Etapa 5: envio externo confirmado — o outro lado do par da etapa 2. ---
async function etapa5_envioExternoConfirmado(cliente) {
  console.log("Etapa 5/8: envio externo confirmado (rclone trocado por cp)...");
  dockerExecComCodigo(["mkdir", "-p", DESTINO_EXTERNO_CONTAINER]);
  const { codigo, saida } = rodarBackup([], {
    BACKUP_ENVIO_CMD: "cp",
    RCLONE_REMOTE: `${DESTINO_EXTERNO_CONTAINER}/`,
  });
  afirmar(codigo === 0, `Etapa 5: scripts/backup.sh com envio externo saiu com código ${codigo}, esperava 0.\n${saida}`);

  const arquivosDestino = listarArquivos(DESTINO_EXTERNO_CONTAINER);
  afirmar(
    arquivosDestino.some((nome) => PADRAO_ARQUIVO_DIARIO.test(nome)),
    `Etapa 5: nenhum arquivo chegou ao destino externo simulado (${DESTINO_EXTERNO_CONTAINER}).`,
  );

  const ultima = await ultimaExecucaoRegistrada(cliente);
  afirmar(
    ultima.destino_externo_ok === true,
    "Etapa 5: execucoes_backup.destino_externo_ok deveria ser true com o envio configurado e " +
      `bem-sucedido — veio ${ultima.destino_externo_ok}. Sem este caso, um "sempre falso" ` +
      "passaria despercebido (é o par oposto da Etapa 2).",
  );
}

// --- Etapa 6: apaga as linhas conhecidas antes de restaurar. ---
async function etapa6_apagarLinhasConhecidas(cliente) {
  console.log("Etapa 6/8: apagando as linhas conhecidas antes de restaurar...");
  await cliente.query("delete from usuarios where email = $1", [EMAIL_CONHECIDO]);
  await cliente.query("delete from verificacao_infraestrutura where nota = $1", [NOTA_CONHECIDA]);

  const { rows: usuariosRows } = await cliente.query("select count(*) from usuarios where email = $1", [
    EMAIL_CONHECIDO,
  ]);
  const { rows: infraRows } = await cliente.query(
    "select count(*) from verificacao_infraestrutura where nota = $1",
    [NOTA_CONHECIDA],
  );
  afirmar(
    Number(usuariosRows[0].count) === 0 && Number(infraRows[0].count) === 0,
    "Etapa 6: as linhas conhecidas deveriam ter sumido depois do delete.",
  );
}

// --- Etapa 7: restauração recusada sem confirmação — nada escrito. ---
async function etapa7_restauracaoRecusadaSemConfirmacao(cliente, arquivoParaRestaurar) {
  console.log("Etapa 7/8: restauração sem --confirmar deve recusar e não escrever nada...");
  const { codigo, saida } = rodarRestaurar([
    "--arquivo",
    `${BACKUP_DIR_CONTAINER}/${arquivoParaRestaurar}`,
    "--banco",
    BANCO,
  ]);
  afirmar(
    codigo !== 0,
    "Etapa 7: scripts/restaurar.sh sem --confirmar deveria sair diferente de zero.\n" + saida,
  );

  const { rows: usuariosRows } = await cliente.query("select count(*) from usuarios where email = $1", [
    EMAIL_CONHECIDO,
  ]);
  afirmar(
    Number(usuariosRows[0].count) === 0,
    "Etapa 7: a restauração sem --confirmar escreveu no banco — isso nunca pode acontecer.",
  );
}

// --- Etapa 8: restauração aceita com confirmação — os dados voltam, campo a campo. ---
async function etapa8_restauracaoAceitaComConfirmacao(cliente, arquivoParaRestaurar) {
  console.log("Etapa 8/8: restauração com --confirmar deve devolver os dados...");
  const { codigo, saida } = rodarRestaurar([
    "--arquivo",
    `${BACKUP_DIR_CONTAINER}/${arquivoParaRestaurar}`,
    "--banco",
    BANCO,
    "--confirmar",
  ]);
  afirmar(codigo === 0, `Etapa 8: scripts/restaurar.sh --confirmar saiu com código ${codigo}, esperava 0.\n${saida}`);
  afirmar(
    saida.includes("usuarios") && /linha\(s\)/.test(saida),
    "Etapa 8: a saída da restauração deveria listar tabela e contagem de linhas.",
  );

  const { rows: usuariosRows } = await cliente.query(
    "select nome, email from usuarios where email = $1",
    [EMAIL_CONHECIDO],
  );
  afirmar(
    usuariosRows.length === 1 && usuariosRows[0].nome === NOME_CONHECIDO,
    "Etapa 8: a linha conhecida de usuarios não voltou com o mesmo conteúdo depois da restauração.",
  );

  const { rows: infraRows } = await cliente.query(
    "select nota from verificacao_infraestrutura where nota = $1",
    [NOTA_CONHECIDA],
  );
  afirmar(
    infraRows.length === 1,
    "Etapa 8: a linha conhecida de verificacao_infraestrutura não voltou depois da restauração.",
  );
}

async function conferirTudo() {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await etapa1_prepararBancoELinhasConhecidas(cliente);
    copiarScriptsParaOContainer();

    const arquivoDiario = await etapa2_backupDoDia(cliente);
    etapa3_backupSobDemanda(arquivoDiario);
    etapa4_rotacaoERetencaoMensal();
    await etapa5_envioExternoConfirmado(cliente);

    // O dump usado na volta é o mesmo arquivo diário — nenhuma das etapas 3 a 5 apaga as linhas
    // conhecidas, só a Etapa 6 apaga, então o dump mais recente do dia ainda contém os dados.
    await etapa6_apagarLinhasConhecidas(cliente);
    await etapa7_restauracaoRecusadaSemConfirmacao(cliente, arquivoDiario);
    await etapa8_restauracaoAceitaComConfirmacao(cliente, arquivoDiario);
  } finally {
    await cliente.end();
  }
}

async function main() {
  if (emCI) {
    console.log("CI detectado: reaproveitando o service container do job e2e.");
    nomeContainer = descobrirContainerEmCI();
  } else {
    await subirBancoDeTeste();
    nomeContainer = NOME_CONTAINER_LOCAL;
  }

  let codigoDeSaida = 1;
  try {
    await conferirTudo();
    console.log("Todas as etapas passaram.");
    codigoDeSaida = 0;
  } catch (erro) {
    console.error("test:backup falhou:", erro.message);
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
