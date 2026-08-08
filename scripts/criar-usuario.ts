// Cria uma conta de gestor. Roda pelo estágio `ferramentas` do Dockerfile — a imagem `app`
// não tem `tsx` nem devDependencies (ver `01-ARQUITETURA.md` §4):
//
//   docker compose run --rm ferramentas npm run criar-usuario -- --nome "Fernanda" --email "..."
//
// Imprime a senha gerada uma única vez, numa linha `SENHA: ...` — não há como recuperá-la
// depois. Sai 0 no sucesso, diferente de 0 em qualquer falha.
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
  nome: z
    .string()
    .trim()
    .min(2, "o nome precisa ter entre 2 e 120 caracteres")
    .max(120, "o nome precisa ter entre 2 e 120 caracteres"),
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
    nome: lerArgumento("nome"),
    email: lerArgumento("email"),
  });

  if (!resultado.success) {
    console.error('Uso: criar-usuario --nome "Nome Completo" --email "nome@exemplo.com"');
    for (const problema of resultado.error.issues) {
      console.error(`  - ${problema.path.join(".")}: ${problema.message}`);
    }
    process.exit(1);
    return;
  }

  const { nome, email } = resultado.data;

  const { db, pool } = await import("../db");
  const { usuarios } = await import("../db/schema");

  try {
    const [existente] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(sql`lower(${usuarios.email})`, email))
      .limit(1);

    if (existente) {
      console.error(`Já existe uma conta com o e-mail ${email}.`);
      process.exitCode = 1;
      return;
    }

    const senha = gerarSenhaForte();
    const senhaHash = await gerarHash(senha);

    await db.insert(usuarios).values({ nome, email, senhaHash });

    console.log(`Conta criada para ${nome} <${email}>.`);
    console.log(`SENHA: ${senha}`);
    console.log(
      "Guarde esta senha agora — ela não pode ser recuperada depois. Se for perdida, rode o script de redefinição de senha.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao criar usuário:", erro);
  process.exitCode = 1;
});
