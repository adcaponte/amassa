---
phase: 02a-login-banco-base-e-backup
reviewed: 2026-08-08T00:00:00Z
depth: standard
files_reviewed: 54
files_reviewed_list:
  - .gitattributes
  - .github/workflows/entrega.yml
  - README.md
  - app/(app)/page.tsx
  - app/(auth)/login/botao-entrar.tsx
  - app/(auth)/login/page.tsx
  - app/api/auth/[...nextauth]/route.ts
  - app/api/health/backup/route.ts
  - db/migrations/0001_chubby_blonde_phantom.sql
  - db/migrations/0002_base-comum-datas-e-trigger.sql
  - db/migrations/0003_papel-amassa-app-e-grants.sql
  - db/migrations/0004_curved_colossus.sql
  - db/schema.ts
  - docker/compose.yml
  - docs/operacao/03-backup-e-restauracao.md
  - lib/auth/acoes.ts
  - lib/auth/auth.config.ts
  - lib/auth/auth.ts
  - lib/auth/credenciais.ts
  - lib/auth/exigir-usuario.ts
  - lib/auth/rotas-publicas.ts
  - lib/auth/senha.ts
  - lib/auth/tentativas-memoria.ts
  - lib/auth/tentativas.ts
  - lib/backup/frescor.ts
  - middleware.ts
  - package.json
  - playwright.config.ts
  - scripts/backup.sh
  - scripts/criar-usuario.ts
  - scripts/desativar-usuario.ts
  - scripts/redefinir-senha.ts
  - scripts/restaurar.sh
  - scripts/testar-backup.mjs
  - scripts/testar-migracoes.mjs
  - scripts/verificar-acoes.mjs
  - tests/e2e/apoio/alternar-ativo.ts
  - tests/e2e/apoio/preparar-usuario.ts
  - tests/e2e/apoio/registrar-backup.ts
  - tests/e2e/autenticacao.spec.ts
  - tests/e2e/backup.spec.ts
  - tests/e2e/fundacao.spec.ts
  - tests/e2e/sessao.spec.ts
  - tests/fixtures/acoes/conforme.ts
  - tests/fixtures/acoes/sem-banco.ts
  - tests/fixtures/acoes/violando.ts
  - tests/unit/auth-borda.test.ts
  - tests/unit/credenciais.test.ts
  - tests/unit/exigir-usuario.test.ts
  - tests/unit/frescor.test.ts
  - tests/unit/rotas-publicas.test.ts
  - tests/unit/tentativas.test.ts
  - tests/unit/verificar-acoes.test.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 02a: Code Review Report

**Reviewed:** 2026-08-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 54 (`.env.example` could not be read — blocked by tool-level permission settings on `.env*` files. This is a limitation of the review environment, not a finding; it should be verified manually to contain only variable names, per the project's own rule.)
**Status:** issues_found

## Summary

This phase built Auth.js v5 credential login, the shared database base (extension, `hoje_brasilia()`, the `atualizado_em` trigger, the `amassa_app` role and grants), and the backup/restore system, plus the `verificar-acoes.mjs` machine gate that is supposed to make `exigirUsuario()`-first mandatory for every database-touching Server Action.

The implementation is careful and unusually well-documented in Portuguese comments; most of the security-sensitive design decisions called out in the phase context (Edge/Node split, constant-time credential evaluation, single error message, destructive-path confirmation in `restaurar.sh`) are implemented correctly and are backed by targeted unit/e2e tests. However, the review found one structural gap in the machine gate itself that undermines the "verificável em revisão" guarantee the project explicitly relies on (CLASSIFIED CRITICAL below), plus four maintainability/robustness issues that should be fixed.

No hardcoded secrets, no real student/customer data, and no SQL/command-injection patterns were found in the reviewed files. `scripts/backup.sh` and `scripts/restaurar.sh` correctly avoid string-concatenated SQL (using `psql -v` substitution and `information_schema`-sourced identifiers) and correctly gate every destructive path behind `--confirmar` plus an integrity check.

## Critical Issues

### CR-01: `verificar-acoes.mjs` only sees a file's *own* static imports — a Server Action that reaches the database through a helper module is invisible to the gate

**File:** `scripts/verificar-acoes.mjs:56-71`
**Issue:**

`arquivoAlcancaBanco()` decides whether a file needs to be checked for `exigirUsuario()` purely by scanning that file's own top-level `import`/`export ... from` declarations for a specifier matching `@/db`, `db/schema`, or the relative equivalent:

```js
function especificadorAlcancaBanco(especificador) {
  return /^(@\/|(\.\.?\/)*)db(\/schema)?$/.test(especificador);
}

function arquivoAlcancaBanco(sourceFile) {
  for (const instrucao of sourceFile.statements) {
    if (
      ts.isImportDeclaration(instrucao) &&
      ts.isStringLiteral(instrucao.moduleSpecifier) &&
      especificadorAlcancaBanco(instrucao.moduleSpecifier.text)
    ) {
      return true;
    }
  }
  return false;
}
```

If a file's `"use server"` actions reach the database **transitively**, through some other module that itself imports `@/db`, this function returns `false` and `conferirArquivo()` skips the whole file (`{ conferidas: 0, violacoes: [] }`) — no action in it is even collected, let alone checked for `exigirUsuario()`.

This is not a hypothetical: it is demonstrated in the very code this phase shipped. `lib/auth/acoes.ts` has `"use server"` at the top and exports `entrar`/`sair`, which call `signIn`/`signOut` from `@/lib/auth/auth` — a module that itself does `import { db } from "@/db"` and queries `usuarios`. `lib/auth/acoes.ts` never imports `@/db` or `db/schema` directly, so `arquivoAlcancaBanco("lib/auth/acoes.ts")` returns `false`, and the gate silently reports `0` actions checked for this file. `entrar`/`sair` are intentionally exempt today (they are the authentication entry/exit point, not an authorization-gated action — correctly documented in the file's own header comment), so there is no *live* violation right now.

But that safety is accidental, not enforced: any future Server Action added to this file, or to any other file that reaches the database only via a service/helper module (a completely ordinary refactor — e.g. extracting a `buscarPedido()` helper into `lib/encomendas/repositorio.ts` and calling it from a `"use server"` action file that only imports that helper), will pass `npm run verificar-acoes` with **zero warnings** even if it never calls `exigirUsuario()`. Given `.claude/CLAUDE.md`'s explicit statement that this gate is the *only* enforcement of the project's *only* authorization boundary ("não há RLS por trás para salvar um esquecimento" / "verificável em revisão"), a gate that can be defeated by an unremarkable refactor is a real exposure, not a cosmetic one.

**Fix:** Walk the import graph transitively (the project already has exactly this capability in `tests/unit/auth-borda.test.ts`'s `coletarGrafoDeModulos`) and mark a file as "reaches the database" if *any* module reachable from it — not just its own top-level imports — imports `@/db`/`db/schema`. For example:

```js
// scripts/verificar-acoes.mjs — replace arquivoAlcancaBanco with a transitive check
function especificadoresDeImport(sourceFile) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter((i) => ts.isStringLiteral(i.moduleSpecifier))
    .map((i) => i.moduleSpecifier.text);
}

function arquivoAlcancaBancoTransitivo(caminhoInicial, cache = new Map()) {
  const pilha = [caminhoInicial];
  const visitados = new Set();
  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (visitados.has(atual)) continue;
    visitados.add(atual);
    const sf = obterSourceFile(atual); // parse + cache
    for (const especificador of especificadoresDeImport(sf)) {
      if (especificadorAlcancaBanco(especificador)) return true;
      const resolvido = resolverParaCaminho(especificador, atual); // só relativo/@ alias
      if (resolvido) pilha.push(resolvido);
    }
  }
  return false;
}
```

Alternatively (cheaper, and closes the dynamic-`import()` gap too — see `scripts/criar-usuario.ts` for an example of the pattern, though those files are outside the gate's scanned directories today): flag any function marked as a Server Action that contains a call to anything imported from a module reachable from `@/db`, rather than gating on the *file's* imports at all. Either way, add a regression fixture (a `"use server"` file that reaches the DB only through a one-hop helper, with no `exigirUsuario()`) to `tests/fixtures/acoes/` and a corresponding case in `tests/unit/verificar-acoes.test.ts` proving the gate now catches it — mirroring the existing `violando.ts` fixture.

## Warnings

### WR-01: `avaliarCredenciais` returns the same shared object reference for every failed login, process-wide

**File:** `lib/auth/credenciais.ts:20-23, 45-52`
**Issue:** `RECUSA` is a single module-level object:

```ts
const RECUSA: { autenticado: false; mensagem: string } = {
  autenticado: false,
  mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS,
};
```

`avaliarCredenciais()` returns this exact same reference (not a copy) on every failed authentication — wrong password, unknown email, inactive user, and corrupted hash all `return RECUSA;`. Nothing in the type (`{ autenticado: false; mensagem: string }`) marks it `readonly`, so nothing prevents a future caller from doing `resultado.mensagem = algumaCoisa` and silently corrupting the shared constant for every concurrent request in the same Node process from then on — a very hard bug to diagnose (wrong error message shown to unrelated users, at random, until the process restarts). No current caller mutates it, so this is not live today, but it is a foot-gun sitting in the single most security-sensitive function in the codebase.
**Fix:** Freeze it or return a fresh object each time:
```ts
const RECUSA = Object.freeze({ autenticado: false, mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS } as const);
// or, simplest:
return { autenticado: false, mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS };
```

### WR-02: `/login`'s "bloqueado" message renders the `minutos` query parameter without validating it

**File:** `app/(auth)/login/page.tsx:14-20`
**Issue:**
```ts
if (erro === "bloqueado") {
  const quantidade = minutos ?? "alguns";
  return `Muitas tentativas com este e-mail. Tente novamente em ${quantidade} minuto(s).`;
}
```
`minutos` comes straight from `searchParams` with no validation that it is a positive integer. The only real caller (`lib/auth/acoes.ts`) always sets it to a computed number, so in the normal flow this is fine — but this is a user-controlled URL (anyone can browse directly to `/login?erro=bloqueado&minutos=qualquer-coisa`), and PROJECT.md is explicit that error messages must be "linguagem humana, dizendo o que fazer." React's escaping means this isn't an XSS vector, but it does mean the app will happily show `"Tente novamente em qualquer-coisa minuto(s)."` to anyone who edits the URL, undermining the message contract this exact code was written to protect (see `T-02a-12` in the surrounding comment).
**Fix:** Parse and clamp before formatting:
```ts
const numero = Number(minutos);
const quantidade = Number.isInteger(numero) && numero > 0 ? String(numero) : "alguns";
```

### WR-03: Credential validation schema duplicated between `lib/auth/acoes.ts` and `lib/auth/auth.ts`

**File:** `lib/auth/acoes.ts:13-16`, `lib/auth/auth.ts:20-23`
**Issue:** The exact same Zod object
```ts
const credenciaisSchema = z.object({
  email: z.email(),
  senha: z.string().min(1),
});
```
is defined independently in both files. Having `authorize()` re-validate independently is correct defense-in-depth (any caller of `signIn("credentials", ...)`, not just this form, must go through it) — but the schema itself being copy-pasted means the two validation rules can drift silently (e.g. a future minimum password length added in one file and forgotten in the other), which is exactly the kind of inconsistency the project's "toda entrada do usuário validada com Zod no servidor" rule is meant to prevent from happening unnoticed.
**Fix:** Extract to a shared `credenciaisEntradaSchema` (e.g. in `lib/auth/credenciais.ts`, which is already the shared module for this concern) and import it from both call sites.

### WR-04: `scripts/testar-backup.mjs` leaves restored test rows in the shared CI database with no teardown

**File:** `scripts/testar-backup.mjs:400-432`
**Issue:** `etapa8_restauracaoAceitaComConfirmacao` (the last step of `conferirTudo()`) intentionally restores the "known" `usuarios` and `verificacao_infraestrutura` rows created in `etapa1_prepararBancoELinhasConhecidas` to prove the restore round-trip worked — but nothing after it removes them. Contrast with `scripts/testar-migracoes.mjs`, which meticulously deletes every row it inserts in a `finally` block (see `conferirTriggerFuncionando`, `conferirContas`, `conferirTabelaExecucoesBackup`). In CI, `entrega.yml`'s `e2e` job runs `test:migracoes` → `test:backup` → Playwright, **all against the same shared `postgres_teste` service container** — so after `test:backup` finishes, the database that the Playwright suite then runs against contains a leftover `usuarios` row (`backup-teste-plano-07@exemplo.test`, with a non-argon2 placeholder hash) and a leftover `verificacao_infraestrutura` row. No current E2E spec enumerates or counts these tables, so nothing fails today, but it is a latent test-isolation trap: the first future E2E test that asserts an exact row count, iterates "all users," or tries to log in with a colliding fixture email will fail for reasons unrelated to the change that triggered it.
**Fix:** After `etapa8`, delete the known rows the same way `testar-migracoes.mjs` does, or document explicitly (as a comment, matching the codebase's own documentation style) that these two rows are deliberately left behind and why, so a future maintainer doesn't have to rediscover this by debugging a flaky E2E run.

## Info

### IN-01: `lerArgumento` (CLI flag parser) is copy-pasted verbatim across three scripts

**File:** `scripts/criar-usuario.ts:37-48`, `scripts/desativar-usuario.ts:30-41`, `scripts/redefinir-senha.ts:35-46`
**Issue:** The same 12-line function (parses `--nome valor` / `--nome=valor` from `process.argv`) is duplicated identically in all three account-management scripts. Harmless today, but any future fix to argument parsing (e.g. supporting `=` inside a value, or quoting) needs to be applied three times and will drift if it isn't.
**Fix:** Extract to `scripts/apoio/argumentos.ts` (or similar) and import from all three.

---

_Reviewed: 2026-08-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
