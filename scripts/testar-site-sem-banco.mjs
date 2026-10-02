#!/usr/bin/env node
// Prova, DE FORA, a promessa central do site público (D-15/SIT-02): a raiz continua no ar
// mesmo com o Postgres derrubado. Não é o relato de quem leu o código — é subir a aplicação de
// verdade, parar o contêiner do banco no meio do caminho, e pedir "/" de novo.
//
// Molde de scripts/testar-backup.mjs: etapas numeradas, veredito por etapa, guarda por nome de
// banco de scripts/testar-migracoes.mjs (barato de conferir, caro de errar). Container e porta
// PRÓPRIOS (nem 5434/test:e2e, nem 5435/migracoes, nem 5436/backup) — para este script poder
// rodar sozinho ou lado a lado com os outros sem disputar porta.
//
// NÃO é encadeado em `npm run verificar`: aquele alvo já paga o custo de Docker uma vez com
// `test:migracoes`, e somar uma build inteira do Next a cada plano encareceria tudo sem
// necessidade. Roda à mão quando a raiz muda e no portão de cada fase que mexe no site.
//
// Fase 5, plano 15: a seção `#agenda` passou a ler a agenda pública (ISR). A etapa 5 agora também
// afirma que, com o Postgres parado, a seção mostra o estado da 04.6 — a frase de aviso
// `CONTEUDO_SITE.agAviso` (o banco efêmero não tem evento público; e, se a leitura falhar, o
// try/catch de `AgendaPublica` cai no mesmo estado).

import { execFileSync, execSync, spawn } from "node:child_process";
import { setTimeout as esperar } from "node:timers/promises";

const NOME_CONTAINER = "amassa_postgres_teste_sem_banco";
const PORTA_HOST = 5437;
const USUARIO = "amassa_teste";
const SENHA = "efemero_de_teste_sem_valor_real";
const BANCO = "amassa_teste";
const BANCO_DE_PRODUCAO = "amassa";
const PORTA_APP = 3100;
const TITULO_DO_SITE = "AMASSA CERRADO";
const FRASE_SEM_AGENDA = "O calendário com as datas e vagas entra aqui em breve.";

function afirmar(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

function tentarRodarDocker(args) {
  try {
    execFileSync("docker", args, { stdio: "ignore" });
  } catch {
    // Sem problema — usado só para limpeza best-effort.
  }
}

// Achado (validação manual desta tarefa): `processoDoApp.kill()` sozinho não derruba a
// aplicação no Windows. `spawn(..., { shell: true })` cria uma árvore de processos (cmd.exe ->
// npm-cli.js -> next) e `.kill()" só sinaliza o processo imediato (o cmd.exe) — o `next start`
// de verdade sobrevive, órfão, com a porta ainda aberta. `taskkill /T /F` mata a árvore inteira;
// fora do Windows, `.kill()` já basta (não há árvore de shell no meio).
function encerrarArvoreDeProcessos(processo) {
  if (!processo || processo.pid == null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(processo.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // Já pode ter terminado sozinho.
    }
  } else {
    processo.kill();
  }
}

// npm/npx são scripts .cmd no Windows — precisam do shell para rodar.
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
    await esperar(1000);
  }
  throw new Error("Postgres de teste não ficou saudável a tempo.");
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
      NOME_CONTAINER,
      "-p",
      `127.0.0.1:${PORTA_HOST}:5432`,
      "postgres_teste",
    ],
    { stdio: "inherit" },
  );
  await esperarSaudavel();
  process.env.DATABASE_URL_TESTE = `postgresql://${USUARIO}:${SENHA}@127.0.0.1:${PORTA_HOST}/${BANCO}`;
  console.log("Banco de teste no ar.");

  // A mesma guarda de disciplina de scripts/testar-migracoes.mjs: barato de conferir, caro de
  // errar. Este script PARA o contêiner do Postgres de propósito (Etapa 4) — nunca pode ser o
  // banco de produção.
  const bancoConectado = new URL(process.env.DATABASE_URL_TESTE).pathname.slice(1);
  afirmar(
    bancoConectado !== BANCO_DE_PRODUCAO,
    `Recusado: o banco conectado ("${bancoConectado}") tem o nome do banco de PRODUÇÃO. Este ` +
      "script para o contêiner do Postgres de propósito e só pode rodar contra o banco efêmero.",
  );
}

async function esperarUrlResponder(url, tentativasMax = 60) {
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    try {
      const resposta = await fetch(url);
      if (resposta.status < 500) return; // qualquer resposta HTTP já prova que o servidor subiu.
    } catch {
      // Ainda subindo — tenta de novo.
    }
    await esperar(500);
  }
  throw new Error(`O servidor não respondeu em ${url} a tempo.`);
}

async function main() {
  let processoDoApp = null;
  let codigoDeSaida = 1;

  try {
    await subirBancoDeTeste();

    console.log("Etapa 1/6: aplicando migrações no banco de teste...");
    rodarNpm("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
    });

    console.log("Etapa 2/6: next build, apontado para o banco efêmero...");
    rodarNpm("npm", ["run", "build"], {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE },
    });

    console.log(`Subindo a aplicação em http://127.0.0.1:${PORTA_APP}...`);
    // npm é `.cmd` no Windows — precisa de shell para rodar (mesma disciplina de `rodarNpm`
    // acima). Passar o comando como STRING ÚNICA (não array de args) com `shell: true` é o que
    // o próprio Node recomenda para evitar o aviso de depreciação DEP0190 (array de args com
    // `shell: true` concatena sem escapar); como os argumentos aqui são todos literais fixos
    // deste script, não há entrada externa para escapar.
    processoDoApp = spawn(`npm run start -- -p ${PORTA_APP}`, {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL_TESTE,
        PORT: String(PORTA_APP),
        // Valores de teste descartáveis, no mesmo espírito de docker/compose.teste.yml —
        // nunca o AUTH_SECRET real. AUTH_TRUST_HOST é obrigatório atrás de proxy reverso.
        AUTH_SECRET: "segredo-de-teste-efemero-sem-valor-real",
        AUTH_TRUST_HOST: "true",
      },
      stdio: "inherit",
      shell: true,
    });

    const urlRaiz = `http://127.0.0.1:${PORTA_APP}/`;
    await esperarUrlResponder(urlRaiz);

    console.log("Etapa 3/6: pedindo / com o Postgres de pé — espera 200 com o título do site...");
    const respostaComBanco = await fetch(urlRaiz);
    afirmar(respostaComBanco.status === 200, `Etapa 3: esperava 200, veio ${respostaComBanco.status}.`);
    const corpoComBanco = await respostaComBanco.text();
    afirmar(
      corpoComBanco.includes(TITULO_DO_SITE),
      `Etapa 3: o corpo da resposta não contém o título do site ("${TITULO_DO_SITE}").`,
    );

    console.log("Etapa 4/6: derrubando o contêiner do Postgres...");
    execFileSync("docker", ["stop", NOME_CONTAINER], { stdio: "inherit" });

    console.log("Etapa 5/6: pedindo / de novo, com o Postgres PARADO — a prova de D-15/SIT-02...");
    const respostaSemBanco = await fetch(urlRaiz);
    afirmar(
      respostaSemBanco.status === 200,
      `Etapa 5: esperava 200 com o Postgres parado, veio ${respostaSemBanco.status} — a raiz ` +
        "não deveria depender do banco para responder.",
    );
    const corpoSemBanco = await respostaSemBanco.text();
    afirmar(
      corpoSemBanco.includes(TITULO_DO_SITE),
      `Etapa 5: o corpo da resposta não contém o título do site com o Postgres parado.`,
    );
    afirmar(
      corpoSemBanco.includes(FRASE_SEM_AGENDA),
      "Etapa 5: com o Postgres parado, a seção de aulas deveria mostrar o estado da 04.6 " +
        `("${FRASE_SEM_AGENDA}") — a queda de AgendaPublica não aconteceu.`,
    );
    afirmar(
      corpoSemBanco === corpoComBanco,
      "Etapa 5: o HTML mudou entre as duas respostas — a página é estática (force-static) e " +
        "deveria devolver exatamente o mesmo HTML, sem recalcular nada por visita.",
    );

    console.log(
      "Etapa 6/6: pedindo /gestao/financeiro — a plataforma pode falhar sem banco, mas não " +
        "pode contaminar a raiz nem devolver 200 com a tela do módulo...",
    );
    const respostaPlataforma = await fetch(`http://127.0.0.1:${PORTA_APP}/gestao/financeiro`, {
      redirect: "follow",
    });
    const acabouNoLogin = respostaPlataforma.url.includes("/gestao/login");
    afirmar(
      respostaPlataforma.status !== 200 || acabouNoLogin,
      `Etapa 6: /gestao/financeiro respondeu 200 fora da tela de login (${respostaPlataforma.url}) ` +
        "— sem banco, a plataforma só pode devolver a fronteira de erro ou redirecionar para o " +
        "login, nunca servir conteúdo de módulo.",
    );

    console.log("Todas as etapas passaram.");
    codigoDeSaida = 0;
  } catch (erro) {
    console.error("test:site-sem-banco falhou:", erro.message);
    codigoDeSaida = 1;
  } finally {
    encerrarArvoreDeProcessos(processoDoApp);
    // Sobe o Postgres de volta antes de derrubar o contêiner de teste — mesmo em falha, este
    // bloco sempre roda. Nada sobrevive além daqui: o próximo comando começa de um estado limpo.
    console.log("Subindo o Postgres de volta e derrubando o contêiner de teste...");
    tentarRodarDocker(["start", NOME_CONTAINER]);
    tentarRodarDocker(["compose", "-f", "docker/compose.teste.yml", "down", "--remove-orphans"]);
  }

  process.exit(codigoDeSaida);
}

main();
