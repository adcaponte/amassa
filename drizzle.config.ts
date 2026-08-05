import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Em desenvolvimento, DATABASE_URL vem de `.env.local` — o drizzle-kit não o carrega
// sozinho fora do runtime do Next.js.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
