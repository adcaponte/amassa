import { existsSync } from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Na máquina do desenvolvedor, DATABASE_URL vive em `.env.local` — um script solto (fora
// do runtime do Next.js) não o carrega sozinho. No servidor, a variável já vem do ambiente
// do contêiner `ferramentas`, então o arquivo não existe e este passo é ignorado.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Aplica as migrações versionadas em `db/migrations/`. Invocado à mão (`npm run
// db:migrate`), nunca pelo pipeline automático — ver `01-ARQUITETURA.md` §8.
async function main() {
  const { db, pool } = await import("./index");
  await migrate(db, { migrationsFolder: "db/migrations" });
  await pool.end();
  console.log("Migrações aplicadas com sucesso.");
}

main().catch((erro) => {
  console.error("Falha ao aplicar migrações:", erro);
  process.exit(1);
});
