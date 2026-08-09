# Phase 3: Gestor de Encomendas - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 21 (new/modified) + shared cross-cutting concerns
**Analogs found:** 14 strong / role-match, 7 with **no close analog** (honestly flagged below)

**Context note for the planner:** Phases 1, 2a and 2b built infrastructure, auth, backup and the
visual shell. Nothing in the codebase yet does product CRUD, a pure business-rule calculation
module of this complexity, a transactional multi-table write, a client-side filtered list, or a
`Dialog`/`Sheet` responsive form. Where a file below has no close analog, this is stated plainly —
the planner should lean on `RESEARCH.md`-equivalent sources (03-CONTEXT.md canonical refs,
03-UI-SPEC.md) rather than a forced weak analog.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `db/schema.ts` (append: 2 pgEnums + 3 tables) | model | CRUD | `db/schema.ts` (own file, `usuarios`/`execucoesBackup` tables) | exact (same file, same conventions) |
| `lib/encomendas/cronograma.ts` | utility (pure business rule) | transform | `lib/backup/frescor.ts` | exact — same "zero imports, data in/data out, decision object with reasons" shape |
| `tests/unit/cronograma.test.ts` | test | transform | `tests/unit/frescor.test.ts` | exact — same fixed-`AGORA`, boundary-testing style |
| `lib/encomendas/acoes.ts` (Server Actions: criar, atualizar, cancelar, excluir, ajustarEtapa, reordenarItem, concluir) | controller (Server Action) | CRUD (transactional) | `lib/auth/acoes.ts` | role-match — first Server Actions that touch the DB; `acoes.ts` shows the `"use server"` + validate + redirect/throw shape but not DB writes. `tests/fixtures/acoes/conforme.ts` is closer for the DB-touching + `exigirUsuario()` shape |
| `app/(app)/encomendas/page.tsx` (REPLACED) | route/page (Server Component) | request-response | `app/(app)/encomendas/page.tsx` (current version) + `app/(app)/page.tsx` | exact for frame (exigirUsuario, CabecalhoPagina), no analog for data-fetching body |
| `app/(app)/encomendas/[id]/page.tsx` | route/page (Server Component) | request-response | `app/(app)/encomendas/page.tsx` | role-match — same protected-page skeleton, no analog for dynamic-segment DB fetch + 404 handling |
| `app/(app)/encomendas/imprimir/page.tsx` | route/page (Server Component) | request-response | `app/(app)/encomendas/page.tsx` | role-match — protected-page skeleton only; **no analog** for `@media print`/`@page` in this codebase |
| `app/(app)/encomendas/loading.tsx` | route (loading UI) | request-response | `app/(app)/loading.tsx` (generic shell loading, read below) | role-match |
| `app/(app)/encomendas/error.tsx` | route (error boundary) | request-response | `app/(app)/error.tsx` + `components/amassa/estado-erro.tsx` | exact |
| `components/amassa/encomendas/gantt.tsx` | component | transform (render from data) | **no analog** | none — first data-visualization component in the project |
| `components/amassa/encomendas/lista-encomendas.tsx` | component | CRUD (list + client filter) | **no analog** | none — first Client Component list with local filter/sort/search |
| `components/amassa/encomendas/cartao-encomenda.tsx` | component | request-response (display) | `components/amassa/cartao-painel.tsx` | role-match — Card wrapper convention only, no data-shape analog |
| `components/amassa/encomendas/trilha-etapas.tsx` | component | transform (render from data) | **no analog** | none |
| `components/amassa/encomendas/ajuste-rapido-etapa.tsx` | component (Client) | CRUD (optimistic-like, non-optimistic per spec) | `app/(auth)/login/botao-entrar.tsx` | role-match — closest example of a small `"use client"` island with `useFormStatus`-style pending state; the "revert on failure + toast" pattern itself has **no analog** |
| `components/amassa/encomendas/formulario-encomenda.tsx` | component (Client, form) | CRUD | `app/(auth)/login/page.tsx` + `botao-entrar.tsx` | role-match — the project's only existing "Server Component page wraps a form, Client Component owns pending state" split; no analog for react-hook-form + Zod + shadcn `form`/`Dialog`/`Sheet` |
| `components/amassa/encomendas/lista-itens.tsx` | component (Client) | CRUD (reorder) | **no analog** | none — first reorder-by-arrows list |
| `components/amassa/encomendas/filtro-encomendas.tsx` | component (Client) | transform (client-side filter/sort) | **no analog** | none |
| `components/amassa/encomendas/confirmar-cancelar.tsx` | component (Client, dialog) | request-response | **no analog** (no `alert-dialog` used anywhere yet) | none — but see Shared Patterns: `estado-erro.tsx`'s `role="alert"` convention and `04-DESIGN-SYSTEM.md` §7 apply |
| `components/amassa/encomendas/confirmar-excluir.tsx` | component (Client, dialog) | request-response | same as above | none |

---

## Pattern Assignments

### `lib/encomendas/cronograma.ts` (utility, transform) — the most important file in this phase

**Analog:** `lib/backup/frescor.ts` (`C:/Users/Andre/amassa/lib/backup/frescor.ts`)

**Module shape** (whole file, lines 1-110): zero imports, a documented constant at module scope
(`JANELA_EM_HORAS`), a discriminated-union return type (`DecisaoFrescor` = `{status:"ok",...} |
{status:"erro",...}`), and a pure function taking **only plain data + the current instant as an
explicit argument** — never reading the clock internally:

```typescript
// Módulo puro: recebe dados, devolve dados. Nenhum import, nenhuma leitura do relógio por
// dentro (regra da pasta `lib/` em `01-ARQUITETURA.md` §3) — o instante atual entra sempre
// como argumento, o que é o que torna as duas fronteiras de 26 horas testáveis sem esperar
// um dia de verdade.
export type DecisaoFrescor =
  | { status: "ok"; http: 200; motivo: string; ultimoBackupEm: string; idadeEmHoras: number }
  | { status: "erro"; http: 503; motivo: string; ultimoBackupEm: string | null; idadeEmHoras: number | null };

export function decidirFrescorDoBackup(
  ultimaExecucao: ExecucaoBackup | null,
  agora: Date,
): DecisaoFrescor {
  // early-return per case, each branch explains itself in a human-readable `motivo` string
}
```

**Apply this shape to `cronograma.ts` as:**
- No imports at all (not even `date-fns` — `00-BRIEFING.md` §5 and D-13 both treat this module as
  the delicate one; if date arithmetic needs a library, that decision belongs in the plan, not
  silently here).
- The current date (`hoje`) is always a parameter, never read from the clock — same reason as
  `agora` in `frescor.ts`: the fixed-boundary tests (fim exclusivo, virada de mês, ano bissexto)
  need a controllable "today".
- Output is a plain data object per encomenda that already contains everything ENC-09's "Etapa
  Atual e Dias Restantes" table (03-UI-SPEC.md) needs — computed once, not recomputed per UI
  surface. Model it as a discriminated union or explicit fields per case (normal-intervalo,
  normal-marco, ultima-etapa, ainda-nao-comecou, atrasada, rascunho, concluida, cancelada) mirroring
  `DecisaoFrescor`'s `status`-tagged branches.
- Each stage's **dates are computed, never stored** (`02-MODELO-DE-DADOS.md` §1 "Regras" — datas
  não são armazenadas) — the module takes `dataInicio` + the 6 `{etapa, dias}` rows and produces
  the cascade, respecting **fim exclusivo** (next stage starts the same day the previous ends).

**Error/edge handling pattern** (lines 42-101 of `frescor.ts`): one `if` per edge case, each
returning early with its own `motivo` string — no shared "default" fallthrough that could hide a
case. `cronograma.ts` should follow this exactly for: marco com `dias` fora de {0,1} (should never
happen given the DB constraint, but the pure function should not silently coerce), etapa de 0 dias
(excluded from Gantt drawing, per D-06/§8), virada de ano/mês, encomenda "atrasada" (D-05).

---

### `tests/unit/cronograma.test.ts` (test) — written BEFORE the code, per M2

**Analog:** `tests/unit/frescor.test.ts` (`C:/Users/Andre/amassa/tests/unit/frescor.test.ts`)

**Structure to copy** (lines 1-60):
```typescript
import { describe, expect, it } from "vitest";
import { JANELA_EM_HORAS, decidirFrescorDoBackup } from "../../lib/backup/frescor";

const AGORA = new Date("2026-08-08T12:00:00.000Z"); // fixed "now"

function horasAtras(horas: number): Date { /* helper to build fixture dates */ }

describe("decidirFrescorDoBackup", () => {
  it("<one plain-language sentence per case, boundary explicit in the name>", () => {
    const decisao = decidirFrescorDoBackup(/* fixture */, AGORA);
    expect(decisao.status).toBe("...");
    expect(decisao.motivo).toMatch(/regex asserting on the human sentence/i);
  });
  // one `it` per boundary: "25h59 atrás (dentro da janela)" / "26h01 atrás (fora da janela)"
});
```
Apply the same "one test per named boundary, boundary value in the test name" convention to
cronograma.test.ts's required cases (03-CONTEXT.md `<specifics>`): cascata, fim exclusivo, marcos
0/1, etapas 0 dias ignoradas, duração total, data de conclusão, etapa atual vs. hoje, virada de
mês, ano bissexto. Also assert **pixel position** of "Hoje" and the 18px/day scale as a *rendering*
test if that math lives in a pure helper too (03-CONTEXT.md `<specifics>`: "vale testar a posição
em pixels... não só que 'o Gantt aparece'").

---

### `db/schema.ts` (model, CRUD) — append 2 pgEnums + 3 tables

**Analog:** the file itself (`C:/Users/Andre/amassa/db/schema.ts`), existing `usuarios` and
`execucoesBackup` table definitions.

**Conventions to copy** (lines 1-84):
- `uuid("id").primaryKey().default(sql\`gen_random_uuid()\`)` for every PK.
- `timestamp(..., { withTimezone: true }).notNull().defaultNow()` for `criadoEm`/`atualizadoEm` —
  **never** `date` for a moment in time (PROJECT.md fuso rule).
- `pgEnum` declared above the table that uses it, one word, snake_case DB name matching the
  Portuguese column/enum name in `02-MODELO-DE-DADOS.md` (see `papelUsuario` as the exact template
  for `statusEncomenda`/`etapaEncomenda`).
- `check(...)` constraints written with `sql` tag directly in the table's array-returning callback
  (see `usuarios_nome_comprimento` for the length-check shape) — use this exact shape for
  `encomendas.nome` (1-120 chars) and `encomenda_itens.descricao` (1-200 chars).
- `index(...)`/`uniqueIndex(...)` declared in the same trailing callback array (see
  `execucoes_backup_quando_idx`) — apply to `encomendas_data_inicio_idx`, `encomendas_status_idx`,
  `encomenda_itens_encomenda_idx`, `encomenda_etapas_encomenda_idx`.
- FK with `.references(() => usuarios.id, { onDelete: "set null" })` for `criado_por` (mirrors no
  existing FK exactly, but `execucoesBackup` shows the table-comment convention to follow: explain
  *why* a column exists, in Portuguese, directly above it).
- `unique(...)` composite constraint on `(encomenda_id, etapa)` and the `marcos_zero_ou_um` CHECK
  constraint (`02-MODELO-DE-DADOS.md` §1, lines 182-193) have no Drizzle precedent in this schema
  yet — this is new ground; use Drizzle's `check()` + `unique()` table-level builders together,
  verify the generated SQL matches the literal SQL in `02-MODELO-DE-DADOS.md` §1 before applying by
  hand.

**Canonical source SQL to match exactly** (`amassa-plataforma/02-MODELO-DE-DADOS.md` lines 153-195)
is the literal contract — the Drizzle schema must generate equivalent SQL, not merely similar.

**Migration workflow — no analog needed, it's documented procedure:** edit `db/schema.ts` →
`drizzle-kit generate` → apply by hand on the server after a backup (`02-MODELO-DE-DADOS.md` §6,
`db/migrations/` already has 4 applied migrations 0000-0004 as the numbering precedent).

---

### `lib/encomendas/acoes.ts` (controller / Server Actions, CRUD transactional)

**Analog for the `exigirUsuario()`-first + `"use server"` shape:** `lib/auth/acoes.ts`
(`C:/Users/Andre/amassa/lib/auth/acoes.ts`) and `tests/fixtures/acoes/conforme.ts` for the
DB-touching variant.

**Imports + first-line pattern** (mandatory, machine-gated by `npm run verificar-acoes`):
```typescript
"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { encomendas /* , ... */ } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

export async function criarEncomenda(/* ... */) {
  const usuarioAtual = await exigirUsuario(); // MUST be the first statement in the body
  // ...
}
```
This is verbatim from `tests/fixtures/acoes/conforme.ts` (lines 1-18), which exists specifically to
prove the machine gate accepts this shape. `lib/auth/acoes.ts` (lines 16-50) additionally shows the
project's `redirect()`-on-validation-failure and `try/catch` narrowing-by-`instanceof` pattern for
distinguishing expected vs. rethrown errors — reuse that `catch` narrowing style for `AppError`-like
Zod/DB-constraint failures, but note **this phase's actions return data/toast state to a Client
Component instead of redirecting** (D-15's non-optimistic ajuste rápido, D-08's alert-dialog
confirms) — so the shape is closer to "return a discriminated result object" than "redirect".　No
existing action does this yet — **no exact analog for the return-shape convention**; the planner
should pick one and document it (e.g. `{ ok: true, data } | { ok: false, erro: string }`).

**Transaction pattern — no analog exists.** This is the first phase writing to more than one table
atomically (encomenda + itens + etapas in one transaction, per `<specifics>` "meia encomenda
gravada é pior que nenhuma"). Use Drizzle's `db.transaction(async (tx) => { ... })`; no precedent in
the codebase for this call, confirm against Drizzle version in `package.json` before planning the
exact API.

**`criado_por` fill pattern:** `criado_por: usuarioAtual.id` — `usuarioAtual` here is exactly the
`UsuarioAutorizado` object `exigirUsuario()` returns (`lib/auth/exigir-usuario.ts` lines 18-23),
never re-fetched.

---

### `app/(app)/encomendas/page.tsx` (REPLACED — route/page, request-response)

**Analog:** the current version of the same file
(`C:/Users/Andre/amassa/app/(app)/encomendas/page.tsx`, 22 lines) plus `app/(app)/page.tsx` for a
second protected-page example.

**Frame to keep verbatim** (lines 1-13 of the current file):
```typescript
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export default async function PaginaEncomendas() {
  await exigirUsuario(); // FIRST statement — non-negotiable, machine-gated
  return (
    <>
      <CabecalhoPagina titulo="Encomendas">{/* "Nova encomenda" button now goes here, no longer inert */}</CabecalhoPagina>
      {/* body replaced: fetch encomendas + itens + etapas here, pass to Client Component list/gantt */}
    </>
  );
}
```
Body is new ground: this Server Component now needs to `await db.select()...` (joining
`encomendas`+`encomenda_itens` per D-13's "itens precisam vir carregados junto da lista do
índice"), branch on empty (`EstadoVazio`, same component/props already used) vs. populated (hand
off to a new Client Component per D-11's client-side filter). **No analog exists in the codebase
for a page that fetches a joined dataset and hands it to a Client Component for local
filtering/sorting** — this is genuinely new.

---

### `app/(app)/encomendas/[id]/page.tsx`, `imprimir/page.tsx` (route/page)

**Analog:** same protected-page skeleton as above (`exigirUsuario()` first line, `CabecalhoPagina`).
**No analog** for: dynamic segment param handling + "not found" (D-01, D-07's history item can be
deleted by someone else mid-session per the error-state table in 03-UI-SPEC.md), or for
`@media print`/`@page` CSS (nothing in `app/globals.css` or any existing component currently uses
print media queries — confirmed by absence, not by a negative grep result requiring re-verification
here).

---

### `components/amassa/encomendas/cartao-encomenda.tsx` (component, display)

**Analog:** `components/amassa/cartao-painel.tsx` (`C:/Users/Andre/amassa/components/amassa/cartao-painel.tsx`)

**Card wrapper convention** (lines 1-27, whole file):
```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CartaoPainelProps = { titulo: string; vazio: string };

export function CartaoPainel({ titulo, vazio }: CartaoPainelProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-titulo text-foreground">{titulo}</CardTitle></CardHeader>
      <CardContent><p className="text-corpo text-muted-foreground">{vazio}</p></CardContent>
    </Card>
  );
}
```
Only the `Card`/`CardHeader`/`CardContent`/`CardTitle` import + typography class convention
(`text-titulo`, `text-corpo`, `text-apoio`, `text-muted-foreground`) transfers — `cartao-painel.tsx`
has no data shape in common with `cartao-encomenda.tsx` (which needs nome, cliente, 6-segment
trilha, etapa atual, dias restantes per 03-UI-SPEC.md "Lista Vertical Mobile").

---

### `formulario-encomenda.tsx` + wiring into `page.tsx` (Dialog desktop / Sheet mobile, D-03)

**Analog:** `app/(auth)/login/page.tsx` + `app/(auth)/login/botao-entrar.tsx` — the **only**
existing example in the codebase of "Server Component page renders a form, small Client Component
owns the pending/loading state":

**Client Component pending-state pattern** (`botao-entrar.tsx`, whole file, lines 1-27):
```typescript
"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="default" disabled={pending} aria-busy={pending} className="min-h-[44px] w-full text-base font-medium">
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}
```
Reuse this exact `useFormStatus` + `disabled`/`aria-busy` idiom for the formulário's "Salvar"
button, and for `ajuste-rapido-etapa.tsx`'s spinner-replaces-number pending state (03-UI-SPEC.md
"Comportamento de salvamento — não é otimista", step 2: spinner for ~1s while the Server Action
confirms).

**Server-error-message-above-form pattern** (`app/(auth)/login/page.tsx` lines 83-87):
```typescript
{mensagem && (
  <p role="alert" aria-live="assertive" className="text-apoio text-destructive">{mensagem}</p>
)}
```
Reuse for the formulário's inline error banner on load failure (03-UI-SPEC.md "Estados de
Carregamento e Erro" row "Formulário (editar)").

**No analog exists** for: `Dialog`/`Sheet` responsive swap by breakpoint, `react-hook-form` +
shadcn `form`/`label` wiring, Zod resolver, live-recalculating footer (D-17), or the `?nova` /
`?editar={id}` URL-driven open/close (D-03) — these are net-new patterns for this codebase; base
them on the shadcn/react-hook-form standard idiom, not on an internal analog.

---

### `EstadoVazio` reuse for "Nada encontrado" (D-11 empty-filter state) and history empty state

**Analog:** `components/amassa/estado-vazio.tsx` (whole file, 39 lines) — already designed to omit
`notaBotao`:
```typescript
export type EstadoVazioProps = { titulo: string; corpo: string; rotuloBotao?: string; notaBotao?: string };
```
Both new empty states ("Nada por aqui com esse filtro." and "Nada concluído ou cancelado ainda.")
pass `rotuloBotao` **without** `notaBotao` and the button must be **enabled** this time (unlike the
current inert "Nova encomenda" button) — `estado-vazio.tsx`'s button is currently hardcoded
`disabled` (line 30: `<Button type="button" variant="default" disabled aria-disabled="true">`).
**This is a required modification, not just reuse** — the component needs an `aoClicar`/`href` prop
or equivalent to support an active button, since Phase 3 is the first phase where the empty-state
CTA actually does something (open the form / clear filters).

---

## Shared Patterns

### Authorization — `exigirUsuario()` first line, no exceptions
**Source:** `lib/auth/exigir-usuario.ts` (lines 67-89), enforced by `npm run verificar-acoes`
(`scripts/verificar-acoes.mjs`, tested by `tests/unit/verificar-acoes.test.ts` and the fixtures in
`tests/fixtures/acoes/`).
**Apply to:** every Server Component page in `app/(app)/encomendas/**` and every exported function
in `lib/encomendas/acoes.ts`, as the literal first statement of the function body.
```typescript
export async function algumaAcaoOuPagina() {
  await exigirUsuario(); // or: const usuarioAtual = await exigirUsuario();
  // ...
}
```

### Empty / Error state components
**Source:** `components/amassa/estado-vazio.tsx`, `components/amassa/estado-erro.tsx`.
**Apply to:** index (Gantt/lista), detalhe, formulário-loading, histórico. All error states reuse
`EstadoErro` with `titulo="Algo não funcionou."` and the two standard corpo strings already in
03-UI-SPEC.md ("Não deu para carregar as encomendas..." / detail page's extra "Voltar para
Encomendas" button via the `acao` prop, `estado-erro.tsx` lines 14-18).

### Page header
**Source:** `components/amassa/cabecalho-pagina.tsx` (whole file, 20 lines) — `flex-wrap` handles
button overflow to a second line on mobile automatically; no new pattern needed, pass the
"Nova encomenda"/"Editar" button as `children`.

### Pure business-rule modules
**Source:** `lib/saude.ts` (12 lines, simplest example) and `lib/backup/frescor.ts` (110 lines,
richest example — see full extraction above). **Apply to:** `lib/encomendas/cronograma.ts` only.
Zero imports, discriminated-union or tagged return type, "now" always a parameter.

### Server Action shape (`"use server"`, exigirUsuario, db import path)
**Source:** `lib/auth/acoes.ts`, `tests/fixtures/acoes/conforme.ts`.
**Apply to:** all functions in `lib/encomendas/acoes.ts`. Note: `lib/auth/acoes.ts` never touches
`db` directly (comment on line 9-11 explicitly says so) — `conforme.ts` is the actual DB-touching
template to copy, despite being a test fixture, not the auth action file.

### Tests — pure module test style
**Source:** `tests/unit/frescor.test.ts`. **Apply to:** `tests/unit/cronograma.test.ts` — written
before the implementation per M2's stated order.

### E2E — login helper + desktop/mobile project split
**Source:** `tests/e2e/apoio/preparar-usuario.ts` (globalSetup, creates a real account) and the
`fazerLogin(page)` helper duplicated at the top of specs like `tests/e2e/casca.spec.ts` (lines
17-23) — reads `E2E_EMAIL_TESTE`/`E2E_SENHA_TESTE` from env, fills by `getByLabel`, submits, awaits
redirect to `/`. **Apply to:** the new `tests/e2e/encomendas.spec.ts` (or similar); reuse the same
"locate by accessible role/name, never branch by `testInfo.project.name`" principle demonstrated in
`casca.spec.ts` lines 25-34 for anything that differs between the Gantt (desktop) and lista
(mobile) — e.g. locate whichever of the two is actually visible, don't special-case by project.

---

## shadcn Components — installed vs. to add

| Component | Status |
|---|---|
| `button`, `card`, `dropdown-menu`, `input`, `separator`, `sheet`, `sidebar`, `skeleton`, `tooltip` | already installed (`components/ui/`) — reuse as-is |
| `alert-dialog`, `sonner`, `select`, `dialog`, `form`, `label`, `switch` | **not yet installed** — 03-UI-SPEC.md "Design System" table names exactly these 7 and their exact use in this phase; install only these, per the "each phase installs what it uses" convention (`02b-CONTEXT.md` D-06/D-07, reaffirmed in 03-CONTEXT.md `<code_context>` "Established Patterns") |

---

## No Analog Found

Files/patterns with no close match in the codebase — planner should treat these as new ground and
document assumptions explicitly rather than infer from an internal precedent:

| File / Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| `components/amassa/encomendas/gantt.tsx` | component | transform | First data-visualization/canvas-like component; nothing in the project draws a scaled timeline |
| `components/amassa/encomendas/lista-encomendas.tsx`, `filtro-encomendas.tsx` | component | transform (client filter) | First Client Component that filters/sorts/searches an already-loaded list (D-11) |
| `components/amassa/encomendas/trilha-etapas.tsx` | component | transform | First vertical-timeline-with-markers component |
| `components/amassa/encomendas/lista-itens.tsx` | component | CRUD (reorder) | First arrow-based reorder-and-persist-`ordem` component |
| `components/amassa/encomendas/confirmar-cancelar.tsx`, `confirmar-excluir.tsx` | component | request-response | First use of `alert-dialog` anywhere in the project (explicitly deferred to this phase by 02b-CONTEXT D-07) |
| `app/(app)/encomendas/imprimir/page.tsx` `@media print` styling | route | request-response | No print stylesheet exists anywhere in `app/globals.css` or components today |
| `db.transaction(...)` multi-table atomic write | data-access pattern | CRUD (transactional) | First transactional write in the codebase — encomenda + itens + etapas insert together |

---

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `db/`, `tests/` (whole repo except
`node_modules`, `.next`, `amassa-plataforma/` docs).
**Files scanned:** ~45 (all of `lib/`, `components/amassa/`, `app/(app)/`, `app/(auth)/login/`,
`db/schema.ts`, representative files from `tests/unit/`, `tests/e2e/`, `tests/fixtures/acoes/`).
**Pattern extraction date:** 2026-08-09.
