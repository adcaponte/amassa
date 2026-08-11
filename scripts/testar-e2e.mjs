#!/usr/bin/env node
// Orquestra o E2E localmente: sobe o Postgres de teste (docker/compose.teste.yml), aplica as
// migrações contra ele e roda o Playwright — depois derruba tudo, sempre, mesmo se algo falhar.
//
// docker/compose.teste.yml não publica porta nenhuma (D-09): subir com `docker compose up`
// simples não abre nada para o host. Este script é o único lugar que publica uma porta, e só
// pelo tempo da execução, via `docker compose run -p` — uma flag de linha de comando, nunca a
// chave `ports:` do arquivo versionado.
//
// No GitHub Actions (plano 01-05), o banco de teste já chega pronto como *service container* do
// runner (D-10) — este script não sobe nada e só roda migração + Playwright direto.

import { execFileSync, execSync } from "node:child_process";
import { connect } from "node:net";

const NOME_CONTAINER = "amassa_postgres_teste";
const PORTA_HOST = 5434;
const USUARIO = "amassa_teste";
const SENHA = "efemero_de_teste_sem_valor_real";
const BANCO = "amassa_teste";

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
// segura é uma única string (não um array de args não escapados). Qualquer argumento com
// espaço (ex.: `--grep "design system"` repassado de process.argv) precisa ficar entre aspas
// nessa string única — sem isso, o espaço interno vira um separador de argumento a mais para
// o shell, e o padrão do --grep chega partido em dois.
function rodarNpm(comando, args, opcoes = {}) {
  const argsSeguros = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
  execSync(`${comando} ${argsSeguros.join(" ")}`, { stdio: "inherit", ...opcoes });
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
  await esperarPortaAlcancavel(PORTA_HOST);
  process.env.DATABASE_URL_TESTE = `postgresql://${USUARIO}:${SENHA}@127.0.0.1:${PORTA_HOST}/${BANCO}`;
  console.log("Banco de teste no ar.");
}

async function esperarSaudavel(tentativasMax = 30) {
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    if (statusDeSaude() === "healthy") return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Postgres de teste não ficou saudável a tempo.");
}

// `docker inspect ... Health.Status` só prova que o healthcheck RODANDO DENTRO do contêiner
// (`pg_isready` via socket local) passou — não que o encaminhamento de porta do HOST
// (`127.0.0.1:5434`, publicado por `docker compose run -p`) já está de pé. Sob churn rápido de
// contêineres (várias execuções seguidas deste script, cada uma recriando a mesma porta fixa),
// o Docker Desktop/WSL2 no Windows pode reportar "healthy" um instante antes do encaminhamento
// NAT do host terminar de se estabelecer — janela que se manifestou como ECONNREFUSED em
// 127.0.0.1:5434 vindo de DENTRO do processo Next.js (webServer), não deste script, então nunca
// aparecia como falha aqui. Uma conexão TCP real e bem-sucedida no host é a única prova de que o
// caminho que o `webServer` do Playwright vai usar está pronto de verdade.
async function esperarPortaAlcancavel(porta, tentativasMax = 15) {
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    const conectou = await new Promise((resolve) => {
      const soquete = connect({ host: "127.0.0.1", port: porta, timeout: 1000 });
      soquete.once("connect", () => {
        soquete.destroy();
        resolve(true);
      });
      soquete.once("error", () => {
        soquete.destroy();
        resolve(false);
      });
      soquete.once("timeout", () => {
        soquete.destroy();
        resolve(false);
      });
    });
    if (conectou) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Porta ${porta} do Postgres de teste não ficou alcançável a tempo.`);
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

    console.log("Rodando o Playwright...");
    // Repassa os argumentos recebidos por este script para o Playwright — é o que permite
    // `npm run test:e2e -- --grep "..."` rodar um recorte da suíte em vez da corrida inteira
    // (02b-01, plano das fases seguintes).
    rodarNpm("npx", ["playwright", "test", ...process.argv.slice(2)]);
    codigoDeSaida = 0;
  } catch (erro) {
    console.error("E2E falhou:", erro.message);
    codigoDeSaida = typeof erro.status === "number" ? erro.status : 1;
  } finally {
    if (!emCI) {
      console.log("Derrubando o Postgres de teste — nada sobrevive ao contêiner.");
      tentarRodarDocker(["compose", "-f", "docker/compose.teste.yml", "down", "--remove-orphans"]);
    }
  }

  process.exit(codigoDeSaida);
}

main();
