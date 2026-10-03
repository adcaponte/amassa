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

// Fase 04.5 (D-28/ORC-16): as fotos de orçamento. Um script de mentira (não `cp`, que não sabe
// copiar diretório sem `-r`) faz o papel de BACKUP_ENVIO_CMD aqui — ele registra com QUE
// argumentos foi chamado e pode ser instruído a falhar por variável de ambiente
// (ENVIO_FOTOS_DEVE_FALHAR), sem precisar de `rclone` de verdade dentro do contêiner.
const FOTOS_DIR_CONTAINER = "/tmp/amassa-fotos-orcamentos";
const FOTOS_DESTINO_EXTERNO_CONTAINER = "/tmp/amassa-fotos-destino-externo";
const ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER = `${SCRIPTS_DIR_CONTAINER}/envio-fotos-fake.sh`;
const ENVIO_FOTOS_LOG_CONTAINER = "/tmp/amassa-envio-fotos-chamadas.log";

// Fase 06.2 (D-05/A-02): os anexos dos fornecedores, gêmeos das fotos. O MESMO envio de mentira
// serve aos dois; ENVIO_DEVE_FALHAR_PARA o faz falhar SÓ quando o primeiro argumento é aquela
// pasta — é o que deixa a etapa da falha dos anexos distinguir essa falha da das fotos. O "remoto"
// falso é uma pasta do contêiner: com RCLONE_REMOTE apontando para ela (com barra no fim, de
// propósito), backup.sh deriva sozinho "${RCLONE_REMOTE%/}/anexos-fornecedores", e é esse caminho
// derivado que a etapa dos anexos enviados confere.
const ANEXOS_DIR_CONTAINER = "/tmp/amassa-anexos-fornecedores";
const REMOTO_FALSO_CONTAINER = "/tmp/amassa-remoto-falso";
const ANEXOS_DESTINO_EXTERNO_CONTAINER = `${REMOTO_FALSO_CONTAINER}/anexos-fornecedores`;
// Dois anexos de tamanho fixo (1500 + 2500 = 4000) e um temporário do PUT em curso (`.envio-*`,
// 700 bytes), que é COPIADO com a pasta mas NUNCA entra na soma de anexos_bytes.
const ANEXOS_BYTES_ESPERADOS = 4000;

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
    "select sucesso, bytes, destino_externo_ok, mensagem, fotos_bytes, fotos_destino_externo_ok, " +
      "anexos_bytes, anexos_destino_externo_ok " +
      "from execucoes_backup order by quando desc limit 1",
  );
  return rows[0];
}

async function ultimasExecucoesRegistradas(cliente, quantidade) {
  const { rows } = await cliente.query(
    "select sucesso, anexos_bytes, anexos_destino_externo_ok " +
      "from execucoes_backup order by quando desc limit $1",
    [quantidade],
  );
  return rows;
}

// --- Etapa 1: banco migrado, com as duas linhas conhecidas que provam a volta. ---
async function etapa1_prepararBancoELinhasConhecidas(cliente) {
  console.log("Etapa 1/13: migrando o banco de teste e inserindo linhas conhecidas...");
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

// --- Instala, dentro do contêiner, o script de mentira que faz o papel de BACKUP_ENVIO_CMD
// para as fotos: registra com que argumentos foi chamado (para provar que backup.sh de fato
// invoca o envio também para o diretório de fotos) e falha sob comando
// (ENVIO_FOTOS_DEVE_FALHAR=1), sem depender de `rclone` real dentro do contêiner de teste.
// Fase 06.2: falha também SÓ para uma pasta (ENVIO_DEVE_FALHAR_PARA=<primeiro argumento>) e,
// quando a origem é uma PASTA, copia o conteúdo dela para o destino (`cp -R origem/. destino/`, o
// mesmo efeito de `rclone copy` entre pastas) — é o que permite à etapa da restauração dos anexos
// provar que os arquivos voltam de fato, e que repetir não duplica nada. Arquivo solto (o dump)
// continua só registrado, como antes. ---
function instalarEnvioDeFotosFake() {
  const script = [
    "#!/bin/sh",
    `echo "$@" >> "${ENVIO_FOTOS_LOG_CONTAINER}"`,
    'if [ "${ENVIO_FOTOS_DEVE_FALHAR:-0}" = "1" ]; then',
    '  echo "falha simulada no envio das fotos" >&2',
    "  exit 1",
    "fi",
    'if [ -n "${ENVIO_DEVE_FALHAR_PARA:-}" ] && [ "$1" = "${ENVIO_DEVE_FALHAR_PARA}" ]; then',
    '  echo "falha simulada no envio de $1" >&2',
    "  exit 1",
    "fi",
    'if [ -d "$1" ]; then',
    '  mkdir -p "$2" && cp -R "$1"/. "$2"/ || exit 1',
    "fi",
    "exit 0",
  ].join("\n");
  dockerExecComCodigo(["mkdir", "-p", SCRIPTS_DIR_CONTAINER]);
  dockerExecComCodigo([
    "sh",
    "-c",
    `cat > "${ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER}" <<'SCRIPT_DE_ENVIO_FAKE'\n${script}\nSCRIPT_DE_ENVIO_FAKE\nchmod +x "${ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER}"`,
  ]);
}

// Duas fotos falsas, com tamanho FIXO (1000 e 2000 bytes, via `dd`, sem depender de `seq`) —
// soma esperada: 3000. Nenhum conteúdo de imagem de verdade é necessário (o script de backup
// só soma bytes e chama o comando de envio; nunca abre o arquivo).
function criarDuasFotosFalsas() {
  dockerExecComCodigo(["mkdir", "-p", FOTOS_DIR_CONTAINER]);
  dockerExecComCodigo([
    "sh",
    "-c",
    `dd if=/dev/zero of="${FOTOS_DIR_CONTAINER}/foto-um.jpg" bs=1000 count=1 2>/dev/null && ` +
      `dd if=/dev/zero of="${FOTOS_DIR_CONTAINER}/foto-dois.jpg" bs=2000 count=1 2>/dev/null`,
  ]);
}

// Fase 06.2: dois anexos falsos (1500 e 2500 bytes — soma 4000) e um temporário `.envio-x` de 700
// bytes, o que o PUT do upload deixa na própria pasta enquanto o arquivo chega (06.2-RESEARCH.md,
// Pitfall 5). backup.sh copia a pasta inteira, mas a soma de anexos_bytes ignora o temporário.
function criarAnexosFalsos() {
  dockerExecComCodigo(["mkdir", "-p", ANEXOS_DIR_CONTAINER]);
  dockerExecComCodigo([
    "sh",
    "-c",
    `dd if=/dev/zero of="${ANEXOS_DIR_CONTAINER}/anexo-um.pdf" bs=1500 count=1 2>/dev/null && ` +
      `dd if=/dev/zero of="${ANEXOS_DIR_CONTAINER}/anexo-dois.xlsx" bs=2500 count=1 2>/dev/null && ` +
      `dd if=/dev/zero of="${ANEXOS_DIR_CONTAINER}/.envio-x" bs=700 count=1 2>/dev/null`,
  ]);
}

// "nome tamanho" de cada arquivo da pasta, em ordem — a fotografia que as etapas de idempotência
// comparam antes e depois de repetir o backup ou a restauração.
function fotografiaDaPasta(diretorio) {
  const { saida } = dockerExecComCodigo([
    "sh",
    "-c",
    `cd "${diretorio}" 2>/dev/null && find . -type f -exec stat -c '%n %s' {} \\; | sort`,
  ]);
  return saida.trim();
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
  console.log("Etapa 2/13: backup do dia (sem destino externo configurado)...");
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
  // Fase 04.5 (D-28): diretório de fotos inexistente (BACKUP_FOTOS_DIR não configurado nesta
  // etapa) NÃO é falha — fotos_bytes vem 0, e sem destino configurado fotos_destino_externo_ok
  // vem false, nunca nulo (esta é uma execução NOVA).
  afirmar(
    Number(ultima.fotos_bytes) === 0,
    `Etapa 2: execucoes_backup.fotos_bytes deveria ser 0 sem diretório de fotos, veio ${ultima.fotos_bytes}.`,
  );
  afirmar(
    ultima.fotos_destino_externo_ok === false,
    "Etapa 2: execucoes_backup.fotos_destino_externo_ok deveria ser false sem destino " +
      `configurado, veio ${ultima.fotos_destino_externo_ok}.`,
  );
  // Fase 06.2 (D-05): o mesmo para os anexos — pasta inexistente (BACKUP_ANEXOS_DIR no padrão,
  // que não existe dentro do contêiner) não é falha, e sem destino o resultado é false, nunca nulo.
  afirmar(
    Number(ultima.anexos_bytes) === 0,
    `Etapa 2: execucoes_backup.anexos_bytes deveria ser 0 sem pasta de anexos, veio ${ultima.anexos_bytes}.`,
  );
  afirmar(
    ultima.anexos_destino_externo_ok === false,
    "Etapa 2: execucoes_backup.anexos_destino_externo_ok deveria ser false sem destino " +
      `configurado (sucesso silencioso nunca) — veio ${ultima.anexos_destino_externo_ok}.`,
  );
  return diarios[0];
}

// --- Etapa 3: backup sob demanda (--agora) não sobrescreve o dump do dia. ---
function etapa3_backupSobDemanda(arquivoDiario) {
  console.log("Etapa 3/13: backup sob demanda (--agora)...");
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
  console.log("Etapa 4/13: rotação de 14 dias e retenção mensal...");
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
  console.log("Etapa 5/13: envio externo confirmado (rclone trocado por cp)...");
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

// --- Etapa 6: fotos enviadas com sucesso — o backup.sh chama o envio TAMBÉM para o diretório
// de fotos, grava fotos_bytes igual à soma dos dois arquivos falsos, e fotos_destino_externo_ok
// verdadeiro. RCLONE_REMOTE (do dump) fica vazio de propósito, para isolar o que esta etapa
// prova: o comportamento do passo de FOTOS, não do dump. ---
async function etapa6_fotosEnviadasComSucesso(cliente) {
  console.log("Etapa 6/13: fotos enviadas com sucesso (envio fake, sem rclone real)...");
  instalarEnvioDeFotosFake();
  criarDuasFotosFalsas();
  dockerExecComCodigo(["sh", "-c", `rm -f "${ENVIO_FOTOS_LOG_CONTAINER}"`]);

  const { codigo, saida } = rodarBackup([], {
    BACKUP_FOTOS_DIR: FOTOS_DIR_CONTAINER,
    RCLONE_REMOTE_FOTOS: `${FOTOS_DESTINO_EXTERNO_CONTAINER}/`,
    BACKUP_ENVIO_CMD: ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER,
    ENVIO_FOTOS_DEVE_FALHAR: "0",
  });
  afirmar(
    codigo === 0,
    `Etapa 6: scripts/backup.sh com fotos configuradas saiu com código ${codigo}, esperava 0.\n${saida}`,
  );

  const { saida: log } = dockerExecComCodigo(["sh", "-c", `cat "${ENVIO_FOTOS_LOG_CONTAINER}" 2>/dev/null`]);
  afirmar(
    log.includes(FOTOS_DIR_CONTAINER) && log.includes(FOTOS_DESTINO_EXTERNO_CONTAINER),
    "Etapa 6: o script de envio fake não foi chamado com o diretório de fotos e o destino " +
      `externo — backup.sh precisa chamar o envio TAMBÉM para as fotos. Log: "${log}".`,
  );

  const ultima = await ultimaExecucaoRegistrada(cliente);
  afirmar(
    Number(ultima.fotos_bytes) === 3000,
    `Etapa 6: execucoes_backup.fotos_bytes deveria ser 3000 (soma dos dois arquivos falsos), veio ${ultima.fotos_bytes}.`,
  );
  afirmar(
    ultima.fotos_destino_externo_ok === true,
    `Etapa 6: execucoes_backup.fotos_destino_externo_ok deveria ser true, veio ${ultima.fotos_destino_externo_ok}.`,
  );
}

// --- Etapa 7: envio de fotos falhando — grava false, sai diferente de zero, e a mensagem
// registrada menciona as fotos (nunca sucesso silencioso, o mesmo princípio do dump). ---
async function etapa7_fotosFalhamAoEnviar(cliente) {
  console.log("Etapa 7/13: envio de fotos falhando registra false e sai diferente de zero...");
  dockerExecComCodigo(["sh", "-c", `rm -f "${ENVIO_FOTOS_LOG_CONTAINER}"`]);

  const { codigo, saida } = rodarBackup([], {
    BACKUP_FOTOS_DIR: FOTOS_DIR_CONTAINER,
    RCLONE_REMOTE_FOTOS: `${FOTOS_DESTINO_EXTERNO_CONTAINER}/`,
    BACKUP_ENVIO_CMD: ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER,
    ENVIO_FOTOS_DEVE_FALHAR: "1",
  });
  afirmar(
    codigo !== 0,
    "Etapa 7: scripts/backup.sh deveria sair diferente de zero quando o envio das fotos falha.\n" +
      saida,
  );

  const ultima = await ultimaExecucaoRegistrada(cliente);
  afirmar(
    ultima.fotos_destino_externo_ok === false,
    `Etapa 7: execucoes_backup.fotos_destino_externo_ok deveria ser false, veio ${ultima.fotos_destino_externo_ok}.`,
  );
  afirmar(
    Boolean(ultima.mensagem) && /foto/i.test(ultima.mensagem),
    `Etapa 7: a mensagem registrada deveria mencionar as fotos — veio "${ultima.mensagem}".`,
  );
}

// --- Etapa 8 (Fase 06.2, D-05/A-02): anexos enviados com sucesso, pelo destino DERIVADO. Só
// RCLONE_REMOTE é configurado (com barra no fim); backup.sh precisa chamar o envio com a pasta dos
// anexos e "${RCLONE_REMOTE%/}/anexos-fornecedores", gravar anexos_bytes = 4000 (o `.envio-x` fora
// da soma) e anexos_destino_externo_ok = true. Roda DUAS vezes no mesmo dia: a pasta local e a
// cópia no remoto falso ficam iguais depois da segunda (idempotência — nada duplica, nada some). ---
async function etapa8_anexosEnviadosComSucesso(cliente) {
  console.log("Etapa 8/13: anexos enviados com sucesso, pelo destino derivado, duas vezes no mesmo dia...");
  criarAnexosFalsos();
  dockerExecComCodigo(["sh", "-c", `rm -rf "${REMOTO_FALSO_CONTAINER}" && rm -f "${ENVIO_FOTOS_LOG_CONTAINER}"`]);
  const pastaAntes = fotografiaDaPasta(ANEXOS_DIR_CONTAINER);

  const env = {
    RCLONE_REMOTE: `${REMOTO_FALSO_CONTAINER}/`,
    BACKUP_FOTOS_DIR: FOTOS_DIR_CONTAINER,
    BACKUP_ANEXOS_DIR: ANEXOS_DIR_CONTAINER,
    BACKUP_ENVIO_CMD: ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER,
    ENVIO_FOTOS_DEVE_FALHAR: "0",
  };
  const primeira = rodarBackup([], env);
  afirmar(
    primeira.codigo === 0,
    `Etapa 8: scripts/backup.sh com anexos configurados saiu com código ${primeira.codigo}, esperava 0.\n${primeira.saida}`,
  );
  const remotoDepoisDaPrimeira = fotografiaDaPasta(ANEXOS_DESTINO_EXTERNO_CONTAINER);
  const segunda = rodarBackup([], env);
  afirmar(
    segunda.codigo === 0,
    `Etapa 8: a SEGUNDA execução do dia saiu com código ${segunda.codigo}, esperava 0.\n${segunda.saida}`,
  );

  const { saida: log } = dockerExecComCodigo(["sh", "-c", `cat "${ENVIO_FOTOS_LOG_CONTAINER}" 2>/dev/null`]);
  const linhasDoLog = log.split("\n").map((linha) => linha.trim());
  afirmar(
    linhasDoLog.includes(`${ANEXOS_DIR_CONTAINER} ${ANEXOS_DESTINO_EXTERNO_CONTAINER}`),
    "Etapa 8: o envio não foi chamado com a pasta dos anexos e o destino derivado " +
      `"${ANEXOS_DESTINO_EXTERNO_CONTAINER}" — backup.sh precisa derivar ` +
      `\${RCLONE_REMOTE%/}/anexos-fornecedores. Log: "${log}".`,
  );

  const [ultima, penultima] = await ultimasExecucoesRegistradas(cliente, 2);
  for (const [rotulo, linha] of [
    ["segunda", ultima],
    ["primeira", penultima],
  ]) {
    afirmar(
      Number(linha.anexos_bytes) === ANEXOS_BYTES_ESPERADOS,
      `Etapa 8: anexos_bytes da ${rotulo} execução deveria ser ${ANEXOS_BYTES_ESPERADOS} ` +
        `(soma dos dois anexos, sem o temporário .envio-x), veio ${linha.anexos_bytes}.`,
    );
    afirmar(
      linha.anexos_destino_externo_ok === true,
      `Etapa 8: anexos_destino_externo_ok da ${rotulo} execução deveria ser true, veio ${linha.anexos_destino_externo_ok}.`,
    );
  }
  const ultimaCompleta = await ultimaExecucaoRegistrada(cliente);
  afirmar(
    ultimaCompleta.destino_externo_ok === true && ultimaCompleta.fotos_destino_externo_ok === true,
    "Etapa 8: com RCLONE_REMOTE configurado, o dump e as fotos também deveriam ter destino " +
      `confirmado — veio dump ${ultimaCompleta.destino_externo_ok}, fotos ${ultimaCompleta.fotos_destino_externo_ok}.`,
  );

  afirmar(
    fotografiaDaPasta(ANEXOS_DIR_CONTAINER) === pastaAntes,
    "Etapa 8: o backup alterou a pasta local dos anexos — ele só pode ler dela.",
  );
  const remotoDepoisDaSegunda = fotografiaDaPasta(ANEXOS_DESTINO_EXTERNO_CONTAINER);
  afirmar(
    remotoDepoisDaSegunda === pastaAntes && remotoDepoisDaSegunda === remotoDepoisDaPrimeira,
    "Etapa 8: a cópia no destino deveria ser igual à pasta local (temporário incluído) e não " +
      `mudar com a segunda execução do dia.\nLocal:\n${pastaAntes}\nRemoto:\n${remotoDepoisDaSegunda}`,
  );
}

// --- Etapa 9 (Fase 06.2, D-05): envio dos anexos falhando — e SÓ ele. O envio falso falha só
// quando a origem é a pasta dos anexos; as fotos, com destino próprio, continuam true. A linha
// grava anexos false, a mensagem cita os anexos (e não as fotos), e o script sai diferente de
// zero — nunca sucesso silencioso. ---
async function etapa9_anexosFalhamAoEnviar(cliente) {
  console.log("Etapa 9/13: envio dos anexos falhando (só ele) registra false e sai diferente de zero...");
  dockerExecComCodigo(["sh", "-c", `rm -f "${ENVIO_FOTOS_LOG_CONTAINER}"`]);

  const { codigo, saida } = rodarBackup([], {
    BACKUP_FOTOS_DIR: FOTOS_DIR_CONTAINER,
    RCLONE_REMOTE_FOTOS: `${FOTOS_DESTINO_EXTERNO_CONTAINER}/`,
    BACKUP_ANEXOS_DIR: ANEXOS_DIR_CONTAINER,
    RCLONE_REMOTE_ANEXOS: ANEXOS_DESTINO_EXTERNO_CONTAINER,
    BACKUP_ENVIO_CMD: ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER,
    ENVIO_FOTOS_DEVE_FALHAR: "0",
    ENVIO_DEVE_FALHAR_PARA: ANEXOS_DIR_CONTAINER,
  });
  afirmar(
    codigo !== 0,
    "Etapa 9: scripts/backup.sh deveria sair diferente de zero quando o envio dos anexos falha.\n" +
      saida,
  );

  const ultima = await ultimaExecucaoRegistrada(cliente);
  afirmar(
    ultima.anexos_destino_externo_ok === false,
    `Etapa 9: execucoes_backup.anexos_destino_externo_ok deveria ser false, veio ${ultima.anexos_destino_externo_ok}.`,
  );
  afirmar(
    ultima.fotos_destino_externo_ok === true,
    "Etapa 9: as fotos deveriam continuar true — só a pasta dos anexos foi instruída a falhar; " +
      `veio ${ultima.fotos_destino_externo_ok}.`,
  );
  afirmar(
    Number(ultima.anexos_bytes) === ANEXOS_BYTES_ESPERADOS,
    `Etapa 9: anexos_bytes é contado antes do envio e deveria ser ${ANEXOS_BYTES_ESPERADOS}, veio ${ultima.anexos_bytes}.`,
  );
  afirmar(
    Boolean(ultima.mensagem) && /anexos/i.test(ultima.mensagem) && !/foto/i.test(ultima.mensagem),
    `Etapa 9: a mensagem registrada deveria citar os anexos (e não as fotos) — veio "${ultima.mensagem}".`,
  );
}

// --- Etapa 10: apaga as linhas conhecidas antes de restaurar. ---
async function etapa10_apagarLinhasConhecidas(cliente) {
  console.log("Etapa 10/13: apagando as linhas conhecidas antes de restaurar...");
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
    "Etapa 10: as linhas conhecidas deveriam ter sumido depois do delete.",
  );
}

// --- Etapa 11: restauração recusada sem confirmação — nada escrito. ---
async function etapa11_restauracaoRecusadaSemConfirmacao(cliente, arquivoParaRestaurar) {
  console.log("Etapa 11/13: restauração sem --confirmar deve recusar e não escrever nada...");
  const { codigo, saida } = rodarRestaurar([
    "--arquivo",
    `${BACKUP_DIR_CONTAINER}/${arquivoParaRestaurar}`,
    "--banco",
    BANCO,
  ]);
  afirmar(
    codigo !== 0,
    "Etapa 11: scripts/restaurar.sh sem --confirmar deveria sair diferente de zero.\n" + saida,
  );

  const { rows: usuariosRows } = await cliente.query("select count(*) from usuarios where email = $1", [
    EMAIL_CONHECIDO,
  ]);
  afirmar(
    Number(usuariosRows[0].count) === 0,
    "Etapa 11: a restauração sem --confirmar escreveu no banco — isso nunca pode acontecer.",
  );
}

// --- Etapa 12: restauração aceita com confirmação — os dados voltam, campo a campo. ---
async function etapa12_restauracaoAceitaComConfirmacao(cliente, arquivoParaRestaurar) {
  console.log("Etapa 12/13: restauração com --confirmar deve devolver os dados...");
  const { codigo, saida } = rodarRestaurar([
    "--arquivo",
    `${BACKUP_DIR_CONTAINER}/${arquivoParaRestaurar}`,
    "--banco",
    BANCO,
    "--confirmar",
  ]);
  afirmar(codigo === 0, `Etapa 12: scripts/restaurar.sh --confirmar saiu com código ${codigo}, esperava 0.\n${saida}`);
  afirmar(
    saida.includes("usuarios") && /linha\(s\)/.test(saida),
    "Etapa 12: a saída da restauração deveria listar tabela e contagem de linhas.",
  );

  const { rows: usuariosRows } = await cliente.query(
    "select nome, email from usuarios where email = $1",
    [EMAIL_CONHECIDO],
  );
  afirmar(
    usuariosRows.length === 1 && usuariosRows[0].nome === NOME_CONHECIDO,
    "Etapa 12: a linha conhecida de usuarios não voltou com o mesmo conteúdo depois da restauração.",
  );

  const { rows: infraRows } = await cliente.query(
    "select nota from verificacao_infraestrutura where nota = $1",
    [NOTA_CONHECIDA],
  );
  afirmar(
    infraRows.length === 1,
    "Etapa 12: a linha conhecida de verificacao_infraestrutura não voltou depois da restauração.",
  );
  // Fase 06.2 (D-05): sem RCLONE_REMOTE_ANEXOS, restaurar.sh avisa e segue — o banco voltou, e
  // restaurá-lo não exige os anexos.
  afirmar(
    saida.includes("RCLONE_REMOTE_ANEXOS não configurado"),
    "Etapa 12: sem destino dos anexos, a restauração deveria avisar que pulou os anexos e seguir.\n" +
      saida,
  );
}

// --- Etapa 13 (Fase 06.2, D-05/A-02): restaurar.sh traz os anexos de volta. A pasta local é
// apagada (a perda que a restauração existe para cobrir) e restaurar.sh, com RCLONE_REMOTE_ANEXOS,
// chama o envio no sentido REMOTO → PASTA; os arquivos voltam iguais aos que a Etapa 8 enviou. Roda
// DUAS vezes: a pasta fica igual depois da segunda (idempotência — nada duplica, nada corrompe). ---
async function etapa13_restaurarTrazOsAnexos(arquivoParaRestaurar) {
  console.log("Etapa 13/13: restaurar.sh traz os anexos de volta, duas vezes...");
  const esperado = fotografiaDaPasta(ANEXOS_DESTINO_EXTERNO_CONTAINER);
  afirmar(
    esperado.split("\n").length === 3,
    `Etapa 13: o remoto falso deveria ter os 3 arquivos enviados na Etapa 8, tem:\n${esperado}`,
  );
  dockerExecComCodigo(["sh", "-c", `rm -rf "${ANEXOS_DIR_CONTAINER}" && rm -f "${ENVIO_FOTOS_LOG_CONTAINER}"`]);

  const argumentos = [
    "--arquivo",
    `${BACKUP_DIR_CONTAINER}/${arquivoParaRestaurar}`,
    "--banco",
    BANCO,
    "--confirmar",
  ];
  const env = {
    BACKUP_ENVIO_CMD: ENVIO_FOTOS_FAKE_SCRIPT_CONTAINER,
    BACKUP_ANEXOS_DIR: ANEXOS_DIR_CONTAINER,
    RCLONE_REMOTE_ANEXOS: ANEXOS_DESTINO_EXTERNO_CONTAINER,
  };
  const primeira = rodarRestaurar(argumentos, env);
  afirmar(
    primeira.codigo === 0,
    `Etapa 13: scripts/restaurar.sh com os anexos saiu com código ${primeira.codigo}, esperava 0.\n${primeira.saida}`,
  );
  afirmar(
    /Anexos restaurados: 3 arquivo\(s\)/.test(primeira.saida),
    `Etapa 13: a saída deveria contar os 3 arquivos dos anexos restaurados.\n${primeira.saida}`,
  );

  const { saida: log } = dockerExecComCodigo(["sh", "-c", `cat "${ENVIO_FOTOS_LOG_CONTAINER}" 2>/dev/null`]);
  afirmar(
    log.split("\n").map((linha) => linha.trim()).includes(`${ANEXOS_DESTINO_EXTERNO_CONTAINER} ${ANEXOS_DIR_CONTAINER}`),
    "Etapa 13: restaurar.sh deveria chamar o envio com o REMOTO como origem e a pasta dos anexos " +
      `como destino. Log: "${log}".`,
  );
  const depoisDaPrimeira = fotografiaDaPasta(ANEXOS_DIR_CONTAINER);
  afirmar(
    depoisDaPrimeira === esperado,
    `Etapa 13: a pasta restaurada difere do que foi enviado.\nEsperado:\n${esperado}\nVeio:\n${depoisDaPrimeira}`,
  );

  const segunda = rodarRestaurar(argumentos, env);
  afirmar(
    segunda.codigo === 0,
    `Etapa 13: a SEGUNDA restauração saiu com código ${segunda.codigo}, esperava 0.\n${segunda.saida}`,
  );
  afirmar(
    fotografiaDaPasta(ANEXOS_DIR_CONTAINER) === esperado,
    "Etapa 13: repetir a restauração mudou a pasta dos anexos — ela deveria ficar igual.",
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
    await etapa6_fotosEnviadasComSucesso(cliente);
    await etapa7_fotosFalhamAoEnviar(cliente);
    await etapa8_anexosEnviadosComSucesso(cliente);
    await etapa9_anexosFalhamAoEnviar(cliente);

    // O dump usado na volta é o mesmo arquivo diário — nenhuma das etapas 3 a 9 apaga as linhas
    // conhecidas, só a Etapa 10 apaga, então o dump mais recente do dia ainda contém os dados.
    await etapa10_apagarLinhasConhecidas(cliente);
    await etapa11_restauracaoRecusadaSemConfirmacao(cliente, arquivoDiario);
    await etapa12_restauracaoAceitaComConfirmacao(cliente, arquivoDiario);
    // A Etapa 13 restaura o MESMO dump outra vez (o banco volta igual) — o que ela prova são os
    // arquivos dos anexos, que só restaurar.sh traz.
    await etapa13_restaurarTrazOsAnexos(arquivoDiario);
  } finally {
    // As Etapas 12 e 13 devolvem de propósito as duas linhas conhecidas (é a prova de que a
    // restauração funcionou) — sem esta limpeza elas ficariam no banco `postgres_teste`
    // compartilhado que entrega.yml reaproveita logo em seguida para a suíte Playwright (mesmo
    // contêiner de serviço em CI: test:migracoes -> test:backup -> e2e). scripts/testar-migracoes.mjs
    // já evita essa armadilha de isolamento apagando tudo que insere; este script fazia o mesmo
    // até a Etapa 11 (ver etapa10_apagarLinhasConhecidas), só a restauração ficava de fora (WR-04
    // da revisão de 02a-08, quando ela era a Etapa 10). `delete` aqui é seguro mesmo se as linhas
    // nunca chegaram a existir (0 linhas afetadas) ou se uma etapa anterior lançou antes.
    await cliente.query("delete from usuarios where email = $1", [EMAIL_CONHECIDO]).catch(() => {});
    await cliente
      .query("delete from verificacao_infraestrutura where nota = $1", [NOTA_CONHECIDA])
      .catch(() => {});
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
