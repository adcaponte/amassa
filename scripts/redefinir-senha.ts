// Redefine a senha de uma conta já existente. Roda pelo estágio `ferramentas` do Dockerfile —
// a imagem `app` não tem `tsx` nem devDependencies (ver `01-ARQUITETURA.md` §4):
//
//   docker compose run --rm ferramentas npm run redefinir-senha -- --email "..."
//
// Imprime a senha nova uma única vez, na mesma linha `SENHA: ...` que `criar-usuario` usa — o
// apoio de teste de ponta a ponta consome esse formato. Não há como recuperá-la depois; se for
// perdida de novo, rode este script outra vez. Se o e-mail não existir, sai diferente de zero
// com uma frase dizendo isso — aqui, ao contrário da tela de login, dizer a verdade é correto:
// quem roda este comando já está dentro do servidor.
import { existsSync } from "node:fs";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { gerarHash, gerarSenhaForte } from "../lib/auth/senha";

// Na máquina do desenvolvedor, DATABASE_URL vem de `.env.local` — scripts soltos não
// herdam o carregamento de ambiente do Next.js. No servidor a variável já vem do ambiente
// do contêiner `ferramentas`.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const argumentosSchema = z.object({
  // `z.email()` valida o formato ANTES de qualquer `.trim()`/`.toLowerCase()` encadeado
  // depois dele — por isso o pré-processamento vem primeiro, via `.pipe()`.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("e-mail inválido")),
});

function lerArgumento(nomeArgumento: string): string | undefined {
  const prefixo = `--${nomeArgumento}=`;
  const comIgual = process.argv.find((argumento) => argumento.startsWith(prefixo));
  if (comIgual) return comIgual.slice(prefixo.length);

  const indice = process.argv.indexOf(`--${nomeArgumento}`);
  if (indice !== -1 && process.argv[indice + 1] !== undefined) {
    return process.argv[indice + 1];
  }

  return undefined;
}

async function main() {
  const resultado = argumentosSchema.safeParse({
    email: lerArgumento("email"),
  });

  if (!resultado.success) {
    console.error('Uso: redefinir-senha --email "nome@exemplo.com"');
    for (const problema of resultado.error.issues) {
      console.error(`  - ${problema.path.join(".")}: ${problema.message}`);
    }
    process.exit(1);
    return;
  }

  const { email } = resultado.data;

  const { db, pool } = await import("../db");
  const { usuarios } = await import("../db/schema");

  try {
    const [existente] = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(eq(sql`lower(${usuarios.email})`, email))
      .limit(1);

    if (!existente) {
      console.error(
        `Não há conta com o e-mail ${email}. Se a conta ainda não existe, rode "criar-usuario".`,
      );
      process.exitCode = 1;
      return;
    }

    const senha = gerarSenhaForte();
    const senhaHash = await gerarHash(senha);

    await db.update(usuarios).set({ senhaHash }).where(eq(usuarios.id, existente.id));

    console.log(`Senha redefinida para ${existente.nome} <${email}>.`);
    console.log(`SENHA: ${senha}`);
    console.log(
      "Guarde esta senha agora — ela não pode ser recuperada depois. A senha anterior deixou de funcionar.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao redefinir senha:", erro);
  process.exitCode = 1;
});
