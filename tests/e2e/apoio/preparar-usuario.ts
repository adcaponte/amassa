// globalSetup do Playwright: garante uma conta real, criada pelos próprios scripts do projeto
// (`scripts/criar-usuario.ts` / `scripts/redefinir-senha.ts`) contra o banco de teste, em vez de
// semear a tabela por fora — isso faz o E2E exercitar AUTH-07 de verdade. Lê a senha impressa na
// linha `SENHA: ...` e publica e-mail/senha em variáveis de ambiente para as specs consumirem
// (herdadas pelos workers, que nascem depois deste setup rodar).
//
// Por que "garante" e não "cria". A versão anterior só chamava `criar-usuario` e explodia se a
// conta já existisse. Isso derrubava a corrida INTEIRA no globalSetup, antes do primeiro teste,
// de duas formas alternadas:
//
//   - `Já existe uma conta com o e-mail gestora.teste@exemplo.test.` (uma execução vê a outra)
//   - `DrizzleQueryError` na `insert into "usuarios"` (duas executam ao mesmo tempo e batem no
//     índice único de e-mail)
//
// Medido com banco controlado à mão: `usuarios` saía de 0 para 1 durante um único
// `npx playwright test` e o globalSetup falhava mesmo assim — ou seja, ele roda mais de uma vez
// por corrida. Aconteceu em 4 de 7 varreduras completas (quick 260811-2jb). Nenhuma retentativa
// de spec podia consertar isso, porque a falha é anterior a qualquer spec.
//
// A correção tem duas partes:
//
//   1. Trava consultiva do Postgres (`pg_advisory_lock`) em volta de "conferir e então gravar" —
//      sem ela, duas execuções concorrentes leem "não existe" ao mesmo tempo e as duas tentam
//      inserir. A trava é do banco, não do processo, então funciona mesmo entre processos
//      diferentes. Some sozinha quando a conexão fecha, e o banco de teste é efêmero de todo
//      jeito.
//   2. Dentro da trava, criar OU redefinir. `redefinir-senha` imprime a senha nova na mesma
//      linha `SENHA: ...` que `criar-usuario` — o próprio comentário daquele script diz que
//      existe para ser consumido por aqui. Quem chega depois redefine e sai com uma senha
//      válida em mãos, em vez de morrer.
import { execSync } from "node:child_process";

import { Client } from "pg";

const NOME_TESTE = "Gestora de Teste";
const EMAIL_TESTE = "gestora.teste@exemplo.test";

// Chave arbitrária e fixa da trava consultiva — só precisa ser um número que mais ninguém neste
// projeto use para o mesmo fim.
const CHAVE_DA_TRAVA = 480_260_811;

function bancoDeTeste(): string {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) {
    throw new Error(
      "O globalSetup precisa de DATABASE_URL_TESTE — quem a define é scripts/testar-e2e.mjs (ou o runner, em CI).",
    );
  }
  return url;
}

function rodarScript(comando: string): string {
  return execSync(comando, {
    env: { ...process.env, DATABASE_URL: bancoDeTeste() },
    encoding: "utf-8",
  });
}

function lerSenha(saida: string, comando: string): string {
  const linha = saida.split("\n").find((atual) => atual.startsWith("SENHA: "));
  if (!linha) {
    throw new Error(
      `O globalSetup não encontrou a linha 'SENHA: ' na saída de \`${comando}\` — a conta de teste não ficou pronta como esperado.`,
    );
  }
  return linha.slice("SENHA: ".length).trim();
}

export default async function prepararUsuario() {
  const cliente = new Client({ connectionString: bancoDeTeste() });
  await cliente.connect();

  let senha: string;
  try {
    // Serializa contra qualquer outra execução do globalSetup na mesma corrida. Bloqueia até a
    // outra soltar — não falha, que é justamente o ponto.
    await cliente.query("select pg_advisory_lock($1)", [CHAVE_DA_TRAVA]);
    try {
      const existente = await cliente.query(
        "select 1 from usuarios where lower(email) = lower($1) limit 1",
        [EMAIL_TESTE],
      );

      if ((existente.rowCount ?? 0) > 0) {
        const comando = `npm run redefinir-senha -- --email "${EMAIL_TESTE}"`;
        senha = lerSenha(rodarScript(comando), comando);
      } else {
        const comando = `npm run criar-usuario -- --nome "${NOME_TESTE}" --email "${EMAIL_TESTE}"`;
        senha = lerSenha(rodarScript(comando), comando);
      }
    } finally {
      await cliente.query("select pg_advisory_unlock($1)", [CHAVE_DA_TRAVA]);
    }
  } finally {
    await cliente.end();
  }

  process.env.E2E_EMAIL_TESTE = EMAIL_TESTE;
  process.env.E2E_SENHA_TESTE = senha;
}
