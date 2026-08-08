// globalSetup do Playwright: cria uma conta real rodando o próprio `scripts/criar-usuario.ts`
// contra o banco de teste, em vez de semear a tabela por fora — isso faz o E2E exercitar
// AUTH-07 de verdade. Lê a senha impressa na linha `SENHA: ...` e publica e-mail/senha em
// variáveis de ambiente para as specs consumirem (herdadas pelos workers, que nascem depois
// deste setup rodar).
import { execSync } from "node:child_process";

const NOME_TESTE = "Gestora de Teste";
const EMAIL_TESTE = "gestora.teste@exemplo.test";

export default async function prepararUsuario() {
  const saida = execSync(`npm run criar-usuario -- --nome "${NOME_TESTE}" --email "${EMAIL_TESTE}"`, {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
    encoding: "utf-8",
  });

  const linhaSenha = saida.split("\n").find((linha) => linha.startsWith("SENHA: "));
  if (!linhaSenha) {
    throw new Error(
      "O globalSetup não encontrou a linha 'SENHA: ' na saída de scripts/criar-usuario.ts — a conta de teste não foi criada como esperado.",
    );
  }

  process.env.E2E_EMAIL_TESTE = EMAIL_TESTE;
  process.env.E2E_SENHA_TESTE = linhaSenha.slice("SENHA: ".length).trim();
}
