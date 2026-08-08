---
phase: 02a-login-banco-base-e-backup
fixed_at: 2026-08-08T09:12:14Z
review_path: .planning/phases/02a-login-banco-base-e-backup/02a-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02a: Code Review Fix Report

**Fixed at:** 2026-08-08T09:12:14Z
**Source review:** .planning/phases/02a-login-banco-base-e-backup/02a-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04 — scope `critical_warning`; IN-01 excluded per instruction)
- Fixed: 5
- Skipped: 0

**Verification ran in:** the main checkout (no worktree isolation — `workflow.use_worktrees` was
turned off for this phase per commit `8b7a78d`, since `.env.local`, `node_modules/`, and the
Docker Postgres the phase's gates depend on don't exist inside a hand-rolled worktree). The gate
results below (`npm run lint`, `npm test`, `npm run verificar-acoes`, `npm run build`,
`npm run test:migracoes`) are reproducible directly from this tree/branch.

## Fixed Issues

### CR-01: `verificar-acoes.mjs` only saw a file's own static imports — a Server Action reaching the database through a helper module was invisible to the gate

**Files modified:** `scripts/verificar-acoes.mjs`, `tests/unit/verificar-acoes.test.ts`, `tests/fixtures/acoes/apoio-alcanca-banco.ts` (new), `tests/fixtures/acoes/violando-transitivo.ts` (new)
**Commit:** `0485f04`
**Applied fix:** Replaced the file-local `arquivoAlcancaBanco()` check with a transitive graph
walk (`moduloAlcancaBancoTransitivo`) that follows every relative (`./`, `../`) and `@/`-alias
import from the checked file, recursively, with a memoization cache and an in-progress `Set` to
guard against import cycles. Third-party (`node_modules`) imports are never followed, matching
the deliberate boundary already documented in `tests/fixtures/acoes/sem-banco.ts` and mirroring
the resolution logic already proven in `tests/unit/auth-borda.test.ts`'s
`coletarGrafoDeModulos`/`resolverEspecificador`.

Added a narrow, named exemption (`EXCECOES_DE_AUTORIZACAO`, keyed by absolute file path AND
function name — not a blanket per-file escape hatch) for `entrar`/`sair` in
`lib/auth/acoes.ts`: under the new transitive check this file now correctly "reaches the
database" (via `lib/auth/auth.ts` → `@/db`), but these two functions are the authentication
entry/exit points that run before a session exists and therefore cannot call
`exigirUsuario()`. Any other function added to that file, or any other file, is still covered
normally.

Added a regression fixture pair (`apoio-alcanca-banco.ts`, a helper that imports `@/db`
directly, and `violando-transitivo.ts`, a `"use server"` action that only imports the helper
and has no `exigirUsuario()` call) plus a corresponding test case in
`tests/unit/verificar-acoes.test.ts` proving the gate now goes red for this case, citing file,
line, and function. A second new test case confirms `lib/auth/acoes.ts` still passes (proving
the exemption works) alongside the pre-existing `sem-banco.ts` case.

Updated the header comment in `scripts/verificar-acoes.mjs` to describe the new transitive rule
and to document why the auth exemption exists and how it's scoped.

**Verified both directions**, matching the phase's own gate pattern:
- `node scripts/verificar-acoes.mjs tests/fixtures/acoes/violando-transitivo.ts` → exit 1,
  citing `tests/fixtures/acoes/violando-transitivo.ts:9 (listarNomesPorHelperSemAutorizar)`.
- `node scripts/verificar-acoes.mjs lib/auth/acoes.ts` → exit 0, `2 ação(ões) conferida(s), 0
  violações` (both `entrar` and `sair` correctly exempted).
- `node scripts/verificar-acoes.mjs tests/fixtures/acoes/sem-banco.ts` → exit 0, `0
  ação(ões) conferida(s)` (file genuinely never reaches the database, direct or transitive).
- `node scripts/verificar-acoes.mjs tests/fixtures/acoes/conforme.ts tests/fixtures/acoes/violando.ts`
  → still behaves as before (conforme passes, violando fails).
- Full `npm run verificar-acoes` (default `app lib` scan) → exit 0.

### WR-01: `avaliarCredenciais` returned the same shared object reference for every failed login, process-wide

**Files modified:** `lib/auth/credenciais.ts`
**Commit:** `252b709`
**Applied fix:** Wrapped the module-level `RECUSA` constant in `Object.freeze(...)` and typed it
as `Readonly<{ autenticado: false; mensagem: string }>`, so a future accidental
`resultado.mensagem = ...` fails at both compile time (readonly) and runtime (frozen object),
instead of silently corrupting the shared refusal message for every concurrent request in the
process.

### WR-02: `/login`'s "bloqueado" message rendered the `minutos` query parameter without validating it

**Files modified:** `app/(auth)/login/page.tsx`
**Commit:** `6282cb1`
**Applied fix:** `minutos` is now parsed with `Number(...)` and only used if it is a defined,
positive integer (`Number.isInteger(numeroMinutos) && numeroMinutos > 0`); any other value
(missing, non-numeric, negative, fractional) falls back to the existing generic `"alguns"`
wording, closing the URL-tampering path (`/login?erro=bloqueado&minutos=qualquer-coisa`) while
leaving the normal flow (real caller always passes a computed integer) unchanged.

### WR-03: Credential validation schema was duplicated between `lib/auth/acoes.ts` and `lib/auth/auth.ts`

**Files modified:** `lib/auth/acoes.ts`, `lib/auth/auth.ts`, `lib/auth/credenciais.ts`, `lib/auth/entrada-credenciais.ts` (new)
**Commit:** `124b6bc`
**Applied fix:** The REVIEW.md fix suggestion named `lib/auth/credenciais.ts` as the shared home
for the schema ("já é o módulo compartilhado"), but that module is bound by a real, already
enforced test (`tests/unit/credenciais.test.ts` — "não referencia nenhum módulo de runtime
(zero imports — os tipos são locais)"), which reads the source file and asserts it has literally
zero `import` lines. Adding `zod` there broke that test on the first verification pass. Adapted
the fix: extracted `credenciaisEntradaSchema` into a new dedicated pure module,
`lib/auth/entrada-credenciais.ts` (its only import is `zod`), and pointed both
`lib/auth/acoes.ts`'s `entrar()` and `lib/auth/auth.ts`'s `authorize()` at that single
definition. `lib/auth/credenciais.ts` itself is unchanged except for a comment explaining where
the schema now lives and why it isn't here. `authorize()` still independently re-validates (any
caller of `signIn("credentials", ...)` must go through it) — only the schema *definition* is
now shared, not the validation call.

### WR-04: `scripts/testar-backup.mjs` left restored test rows in the shared CI database with no teardown

**Files modified:** `scripts/testar-backup.mjs`
**Commit:** `cd1999e`
**Applied fix:** Added a `finally` block around the etapa1–8 sequence in `conferirTudo()` that
deletes the two known rows (`usuarios` by `EMAIL_CONHECIDO`, `verificacao_infraestrutura` by
`NOTA_CONHECIDA`) after Etapa 8 restores them, mirroring the teardown discipline already used
by `scripts/testar-migracoes.mjs` and by this same script's own `etapa6_apagarLinhasConhecidas`.
Each delete is wrapped in `.catch(() => {})` so cleanup is a no-op (not a hard failure) if the
rows never existed or an earlier etapa already threw. Verified end-to-end with
`npm run test:backup` against the ephemeral Docker Postgres — all 8 etapas passed.

## Skipped Issues

None — all in-scope findings (CR-01, WR-01, WR-02, WR-03, WR-04) were fixed. IN-01 (duplicated
`lerArgumento` CLI parser) was intentionally left untouched — it is an Info-severity finding,
and this run's scope was `critical_warning`.

---

_Fixed: 2026-08-08T09:12:14Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
