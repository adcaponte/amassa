// Desativa (ou reativa) uma conta de gestor. Marcar `ativo = false` tira o acesso na próxima
// requisição — `exigirUsuario()` confere isso NO BANCO a cada chamada, nunca no token, que
// dura 30 dias. Roda pelo estágio `ferramentas` do Dockerfile (ver `01-ARQUITETURA.md` §4):
//
//   docker compose run --rm ferramentas npm run desativar-usuario -- --email "..."
//   docker compose run --rm ferramentas npm run desativar-usuario -- --email "..." --reativar
//
// Nenhuma instrução de exclusão aparece neste arquivo — desativar existe justamente para que
// apagar não seja necessário, e apagar quebraria o histórico de autoria das Fases 3 a 6.
import { existsSync } from "node:fs";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

// Na máquina do desenvolvedor, DATABASE_URL vem de `.env.local` — scripts soltos não
// herdam o carregamento de ambiente do Next.js. No servidor a variável já vem do ambiente
// do contêiner `ferramentas`.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const argumentosSchema = z.object({
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

function lerBandeira(nomeArgumento: string): boolean {
  return process.argv.includes(`--${nomeArgumento}`);
}

async function main() {
  const reativar = lerBandeira("reativar");

  const resultado = argumentosSchema.safeParse({
    email: lerArgumento("email"),
  });

  if (!resultado.success) {
    console.error('Uso: desativar-usuario --email "nome@exemplo.com" [--reativar]');
    for (const problema of resultado.error.issues) {
      console.error(`  - ${problema.path.join(".")}: ${problema.message}`);
    }
    process.exit(1);
    return;
  }

  const { email } = resultado.data;
  const ativoDesejado = reativar;

  const { db, pool } = await import("../db");
  const { usuarios } = await import("../db/schema");

  try {
    const [existente] = await db
      .select({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo })
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

    if (existente.ativo === ativoDesejado) {
      console.log(
        `A conta de ${existente.nome} <${email}> já estava ${ativoDesejado ? "ativa" : "desativada"} — nada foi alterado.`,
      );
      return;
    }

    await db.update(usuarios).set({ ativo: ativoDesejado }).where(eq(usuarios.id, existente.id));

    if (ativoDesejado) {
      console.log(
        `Conta de ${existente.nome} <${email}> reativada. O acesso volta a valer na próxima requisição.`,
      );
    } else {
      console.log(
        `Conta de ${existente.nome} <${email}> desativada (ativo = false). A pessoa perde o acesso ` +
          "na próxima requisição; nenhuma linha foi apagada.",
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao alterar o estado da conta:", erro);
  process.exitCode = 1;
});
