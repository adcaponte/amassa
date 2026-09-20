import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Pool único do node-postgres, reaproveitado entre requisições em runtime Node.
//
// `connectionTimeoutMillis` NÃO tem padrão seguro no `pg-pool`: quando ausente (ou `0`),
// a espera por uma conexão livre (ou por uma nova) É INFINITA — descoberto em
// `.planning/debug/auth-bloqueio-timeout-e2e.md` (2026-09-20) investigando uma trava
// intermitente e de longa data em `tests/e2e/autenticacao.spec.ts` (WINDOWS #3/#24): a
// hipótese inicial (custo do argon2id) foi medida e refutada (25-150ms por tentativa,
// ordens de grandeza abaixo de qualquer timeout razoável); a hipótese líder que restou é
// exatamente esta — nenhum limite do lado do servidor para a fila do pool, sob
// contenção real de CPU/rede do runner de CI.
//
// 5 segundos, não um número arbitrário: as consultas reais de login medidas no debug
// (mesmo sob a suíte completa, 2 workers) levaram 1-43ms; a retentativa de CI que
// absorveu a falha real do dia levou 1.9s do início ao fim. 5s dá ~2,5× de folga sobre
// esse pior caso observado — falha rápido o bastante para nunca mais "travar até o
// teto" (o padrão binário rápido-ou-trava-no-teto documentado no debug), e ainda cabe
// com folga dentro de qualquer timeout de requisição ou de teste. `max` (padrão do
// `pg-pool`, 10) não muda — não é o tamanho do pool que causava a espera sem limite, é a
// ausência de um teto para ela.
//
// Falha aqui NÃO vaza stack crua nem cai em `app/error.tsx`/`app/(app)/error.tsx`: o
// erro lançado por `db.select()` dentro de `authorize()` (lib/auth/auth.ts) é embrulhado
// pelo Auth.js em `CallbackRouteError` (subclasse de `AuthError`), capturado em
// `lib/auth/acoes.ts` (`if (erro instanceof AuthError) redirect("/login?erro=credenciais")`)
// e mostra a MESMA mensagem humana de credenciais inválidas que uma senha errada mostraria.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });
