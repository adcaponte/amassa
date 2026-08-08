# Phase 2b: Design System e Casca da Aplicação - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 20 (5 new components already existing as pages/layout to modify + 15 new)
**Analogs found:** 15 / 20 (5 shadcn-init files have no in-repo analog — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/globals.css` | config | transform (CSS tokens) | `app/globals.css` (itself, 1 line today) | modify-in-place |
| `components.json` | config | — | none in repo | no-analog (shadcn init artifact) |
| `app/layout.tsx` | config/provider | request-response | `app/layout.tsx` (itself) | modify-in-place |
| `app/(app)/layout.tsx` | route/layout | request-response | `app/(app)/page.tsx` (exigirUsuario pattern) + `app/layout.tsx` (shell shape) | role-match |
| `app/(app)/page.tsx` | route | request-response | `app/(app)/page.tsx` (itself, being replaced) | modify-in-place |
| `app/(app)/error.tsx` | route (error boundary) | event-driven | none — first `error.tsx` in project | no-analog (Next.js convention file, follow RESEARCH-free Next.js API: `"use client"`, `reset()`) |
| `app/(app)/not-found.tsx` | route (404 boundary) | request-response | none — first `not-found.tsx` in project | no-analog |
| `app/(app)/loading.tsx` | route (loading boundary) | request-response | none — first `loading.tsx` in project | no-analog |
| `app/(app)/encomendas/page.tsx` | route | request-response | `app/(app)/page.tsx` (exigirUsuario + Server Component pattern) | exact (auth pattern) |
| `app/(app)/agenda/page.tsx` | route | request-response | `app/(app)/page.tsx` | exact (auth pattern) |
| `app/(app)/queimas/page.tsx` | route | request-response | `app/(app)/page.tsx` | exact (auth pattern) |
| `app/(app)/estoque/page.tsx` | route | request-response | `app/(app)/page.tsx` | exact (auth pattern) |
| `app/(app)/orcamentos/page.tsx` | route | request-response | `app/(app)/page.tsx` | exact (auth pattern) |
| `app/(auth)/login/page.tsx` | route | request-response | itself — restyle only, mechanics untouched | modify-in-place |
| `app/(auth)/login/botao-entrar.tsx` | component (client) | event-driven (form status) | itself — untouched mechanics, only className/Button swap | modify-in-place |
| `components/amassa/logo.tsx` | component | static | none — new pattern; closest structural analog is any small presentational unit; use `app/frase-no-ar.ts` for the "constant, swappable content" idea | role-match (loose) |
| `components/amassa/barra-lateral.tsx` | component (nav) | static/interactive | none in repo (first nav component); shadcn `Sidebar` primitive is the base | no-analog (new pattern, build on shadcn primitive) |
| `components/amassa/barra-inferior.tsx` | component (nav) | static/interactive | none in repo | no-analog (new pattern) |
| `components/amassa/cabecalho-movel.tsx` | component (nav) | static/interactive | none in repo | no-analog (new pattern) |
| `components/amassa/menu-usuario.tsx` | component | event-driven (Server Action `sair`) | `app/(app)/page.tsx` (the `<form action={sair}>` block) | exact (action-invocation pattern) |
| `components/amassa/cabecalho-pagina.tsx` | component | static | UI-SPEC "Cabeçalho de Página" contract | role-match |
| `components/amassa/estado-vazio.tsx` | component | static | UI-SPEC component contract (already fully specified with props) | exact (spec-defined) |
| `components/amassa/estado-erro.tsx` | component | static | UI-SPEC component contract | exact (spec-defined) |
| `components/amassa/cartao-painel.tsx` | component | static | UI-SPEC "Painel Inicial" contract | role-match |
| `lib/auth/rotas-publicas.ts` | utility (pure module) | transform | itself — unchanged, but is the reference pure-module pattern | reference-only |
| `tests/e2e/design-system.spec.ts` (new, implied by D-09/UI-01) | test | event-driven (browser assertions) | `tests/e2e/autenticacao.spec.ts` | exact |
| `tests/e2e/acessibilidade.spec.ts` (new, implied by UI-09 verification table) | test | event-driven (browser assertions) | `tests/e2e/autenticacao.spec.ts` | exact |

## Pattern Assignments

### `app/globals.css`

**Analog:** itself (currently `@import "tailwindcss";` only — see `app/globals.css` line 1)

**Pattern:** Append the `@theme { ... }` block (raw tokens) and `@theme inline { ... }` block (shadcn mapping) literally from `02b-UI-SPEC.md` "Design Tokens" section, in that exact order, **before** running any `shadcn add` (D-08). No existing project convention to reconcile — this is a greenfield addition to a one-line file.

---

### `app/layout.tsx`

**Analog:** itself (`app/layout.tsx`, full file, 19 lines)

**Current pattern to preserve:**
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMASSA",
  description: "Plataforma de gestão do ateliê AMASSA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

**Change needed:** add `next/font/google` imports for Archivo Narrow and Inter (D-10), assign their `variable` class names to `<body>` alongside a base font-family class. Keep `lang="pt-BR"` (already correct) and the `Metadata` export shape unchanged.

---

### `app/(app)/page.tsx` → painel inicial

**Analog:** itself, being replaced (`app/(app)/page.tsx`, full file, 28 lines — see Read above)

**Auth pattern to copy verbatim (this is the load-bearing line):**
```tsx
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

export default async function Painel() {
  const usuario = await exigirUsuario();
  // ...
}
```
`exigirUsuario()` **must remain the first statement inside the component**, exactly as in the current provisional page — `scripts/verificar-acoes.mjs` gates on this convention over `app` and `lib`.

**What changes:** the JSX body — replace the centered "Olá, {usuario.nome}. Você está autenticado." + logout button with the D-02/D-16 dashboard: greeting title ("Olá, {usuario.nome}.") + "SEU DIA HOJE" micro-label + 2×2 grid of `CartaoPainel` (Card from shadcn) for Encomendas/Aulas/Fornos/Estoque, each showing its empty-state line from the UI-SPEC copy table. The `sair` form is removed from here — it moves into `menu-usuario.tsx` (D-15).

---

### `app/(app)/encomendas/page.tsx`, `agenda/page.tsx`, `queimas/page.tsx`, `estoque/page.tsx`, `orcamentos/page.tsx`

**Analog:** `app/(app)/page.tsx` (auth pattern) + UI-SPEC "Cabeçalho de Página" contract for the body shape.

**Pattern (every one of these 5 files, identical skeleton, only copy strings differ):**
```tsx
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export default async function PaginaEncomendas() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Encomendas" />
      <EstadoVazio
        titulo="A roda ainda não gira."
        corpo="Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui."
        rotuloBotao="Nova encomenda"
        notaBotao="Chega na Fase 3."
      />
    </>
  );
}
```
`/orcamentos` omits `rotuloBotao`/`notaBotao` (D-04 — no button, per `EstadoVazioProps` contract where `rotuloBotao` omitted means no button). Copy per module comes verbatim from the UI-SPEC "Estados vazios por tela" table.

**exigirUsuario() rule applies identically to every one of these five files** — same first-line placement as `app/(app)/page.tsx`.

---

### `app/(app)/layout.tsx` (new — the shell)

**Analog:** No direct analog exists (first `layout.tsx` for a route group in this repo besides the root). Compose from:
1. `app/(app)/page.tsx`'s `exigirUsuario()` pattern — the layout is also a protected Server Component, so it can call `exigirUsuario()` once and pass `usuario.nome` down to `menu-usuario.tsx`/`cabecalho-movel.tsx` instead of every page re-fetching it (reduces DB reads vs. calling it in every page too — but note UI-SPEC still expects every *page* to call it independently per the `verificar-acoes` gate; both layout and page can each call it safely since it's idempotent).
2. `app/layout.tsx`'s shape for how a layout wraps `children`.

**Structure:**
```tsx
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
// shadcn Sidebar wrapper components, BarraLateral, BarraInferior, CabecalhoMovel

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();

  return (
    <div className="flex min-h-screen">
      <BarraLateral nome={usuario.nome} className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <CabecalhoMovel nome={usuario.nome} className="md:hidden" />
        <main className="flex-1">{children}</main>
        <BarraInferior className="md:hidden" />
      </div>
    </div>
  );
}
```

---

### `components/amassa/menu-usuario.tsx`

**Analog:** `app/(app)/page.tsx` lines 18-25 (the `sair` Server Action form)

**Exact pattern to reuse:**
```tsx
import { sair } from "@/lib/auth/acoes";

<form action={sair}>
  <button type="submit">Sair</button>
</form>
```
Wrap this `<form action={sair}>` inside the `DropdownMenu.Item` (desktop, sidebar footer) and inside the `Sheet` (mobile, avatar-triggered). Import `sair` from `@/lib/auth/acoes` exactly as `app/(app)/page.tsx` line 1 does — no new Server Action needed, D-15 explicitly reuses this existing one.

**LogOut icon** (`lucide-react`) sits next to the label per UI-SPEC icon table.

---

### `app/(auth)/login/page.tsx` (restyle only)

**Analog:** itself, full file (see Read above)

**Mechanics to preserve exactly (do not touch):**
- `mensagemDeErro()` function — untouched logic, all three branches (`bloqueado`, `credenciais`, `sessao`).
- `<form action={entrar} ...>` — same Server Action import from `@/lib/auth/acoes`.
- `role="alert" aria-live="assertive"` on the message paragraph — required by `tests/e2e/autenticacao.spec.ts` which does `page.locator("form").getByRole("alert")`. **Do not remove or rename this role/aria-live pair or the existing e2e suite breaks.**
- `<BotaoEntrar />` import and usage — untouched.

**What changes (only className / component swaps):**
- `<main className="... bg-[#F6F3F0] ... text-[#1D2221]">` → replace inline hex with token classes (`bg-background text-foreground` per the `@theme inline` mapping) or wrap content in the shadcn `Card`.
- Inputs' `border-[#D8D2CB]` → `border-input` (or `--color-borda-forte` token class).
- Error text `text-red-700` → `text-destructive` (resolves to `--color-erro` per D-14/spec).
- `<h1>AMASSA</h1>` text → replaced by `<Logo />` component (D-13).

---

### `app/(auth)/login/botao-entrar.tsx` (restyle only)

**Analog:** itself, full file (see Read above)

**Mechanics to preserve exactly:**
```tsx
"use client";
import { useFormStatus } from "react-dom";

export function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}
```
Keep `useFormStatus`, `disabled={pending}`, `aria-busy={pending}`, and the `"Entrando…"` label exactly — `getByRole("button", { name: "Entrar" })` assertions in existing e2e tests depend on the resting-state accessible name staying `"Entrar"`. Only the `className` changes to use the shadcn `Button` component (`variant="default"`) instead of the current inline `bg-[#1D2221]` hardcoded class.

---

### `lib/auth/exigir-usuario.ts` — shared auth pattern (reference only, not modified)

**Source:** `lib/auth/exigir-usuario.ts` full file (see Read above)

**Apply to:** every new page under `app/(app)/` and the new `app/(app)/layout.tsx`.

```ts
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

export default async function AlgumaPagina() {
  const usuario = await exigirUsuario(); // PRIMEIRA LINHA — sem exceção
  // ...
}
```
This is gated by `npm run verificar-acoes` (`scripts/verificar-acoes.mjs app lib`) — every new/modified page file under `app/` must have this as the first statement or the pipeline gate fails.

---

### `lib/auth/rotas-publicas.ts` — pure module convention (reference only, not modified)

**Source:** `lib/auth/rotas-publicas.ts` full file (see Read above), same shape as `lib/saude.ts` and `lib/backup/frescor.ts`.

**Convention for any pure logic introduced in this phase** (e.g., if "detect active nav item from pathname" gets extracted into a `lib/` helper instead of living inline in a component):
```ts
// Módulo puro, sem nenhum import: ...
export function algumaFuncaoPura(entrada: TipoEntrada): TipoSaida {
  // recebe dados, devolve dados — zero side effects, zero React, zero DB client
}
```
Not required for this phase (CONTEXT.md says "não há regra de negócio nesta fase, mas o padrão vale se aparecer alguma"), but if the active-nav-item logic is factored out, it must be a zero-import pure function unit-testable like `tests/unit/rotas-publicas.test.ts` presumably tests `ehRotaPublica`.

---

### `tests/e2e/*.spec.ts` (new specs for D-09 color-computation test and UI-09 accessibility checks)

**Analog:** `tests/e2e/autenticacao.spec.ts` (full file, see Read above)

**Imports / setup pattern:**
```ts
import { test, expect } from "@playwright/test";
```

**Core pattern — computed style assertions (for D-09):**
```ts
test("botão primário resolve para a cor terracota do design system", async ({ page }) => {
  await page.goto("/login");
  const botao = page.getByRole("button", { name: "Entrar" });
  const cor = await botao.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(cor).toBe("rgb(137, 64, 37)");
});
```

**Bounding-box pattern for touch targets (UI-09, no direct analog exists yet — build from the same `test`/`expect` shape):**
```ts
test("itens da barra inferior têm alvo de toque de pelo menos 44px", async ({ page }) => {
  await page.goto("/");
  const item = page.getByRole("link", { name: "Início" });
  const caixa = await item.boundingBox();
  expect(caixa?.height).toBeGreaterThanOrEqual(44);
});
```

**Project convention to follow:** both desktop and mobile Playwright projects run every spec (see `playwright.config.ts`); no `test.describe.configure({ mode: "serial" })` needed for these new specs since they don't share mutable state like the login-attempt counter does — only copy that pattern if a new test introduces shared server-side state.

**getByRole with accessible name convention:** `page.getByRole("button", { name: "Abrir menu do usuário" })` for the avatar button (`aria-label` requirement from UI-SPEC), matching the existing `getByRole("button", { name: "Entrar" })` idiom.

---

## Shared Patterns

### Server Action invocation (`<form action={...}>`)
**Source:** `app/(app)/page.tsx` lines 18-25, `app/(auth)/login/page.tsx` line 56
**Apply to:** `menu-usuario.tsx` (sair), `app/(auth)/login/page.tsx` (entrar, unchanged)
```tsx
<form action={sair}>
  <button type="submit">Sair</button>
</form>
```

### exigirUsuario() as first line of every protected page/layout
**Source:** `lib/auth/exigir-usuario.ts`, demonstrated in `app/(app)/page.tsx` line 9
**Apply to:** ALL files under `app/(app)/**/page.tsx` and the new `app/(app)/layout.tsx`
```tsx
export default async function Pagina() {
  const usuario = await exigirUsuario();
  // ...
}
```
Enforced by `npm run verificar-acoes` (`scripts/verificar-acoes.mjs app lib`) — a machine gate, not just convention.

### Pure module convention (`lib/`)
**Source:** `lib/saude.ts`, `lib/backup/frescor.ts`, `lib/auth/rotas-publicas.ts`
**Apply to:** any business logic extracted from components in this phase (e.g., active-nav-path matching, if factored out of a component)
```ts
// Módulo puro: recebe dados, devolve dados. Não importa React nem o cliente do banco.
export function funcaoPura(entrada: X): Y { /* ... */ }
```

### `role="alert" aria-live="assertive"` for error messaging
**Source:** `app/(auth)/login/page.tsx` lines 79-83
**Apply to:** `estado-erro.tsx` (`role="alert"` per UI-SPEC contract) — keep consistent with the existing login error pattern, though `estado-erro.tsx` uses `role="alert"` without necessarily needing `aria-live` since it's not dynamically injected into an already-mounted DOM the way the login message is.

### Portuguese file/route names, English code identifiers
**Source:** `lib/auth/exigir-usuario.ts`, `lib/auth/tentativas-memoria.ts`, `app/frase-no-ar.ts`
**Apply to:** all new files — e.g. `barra-lateral.tsx` (not `sidebar.tsx`, that name is reserved for the shadcn primitive in `components/ui/`), `cabecalho-movel.tsx`, `menu-usuario.tsx`, `estado-vazio.tsx`. Internal identifiers (`EstadoVazioProps`, `titulo`, `corpo`) are already specified in the UI-SPEC using this same Portuguese-domain/English-keyword mix (`type EstadoVazioProps = { titulo: string; ... }`).

### `components/ui/` vs `components/amassa/` boundary (D-11)
**Source:** no existing analog (first `components/` directory in the repo) — this is a new convention introduced by this phase's own decisions, not the codebase, but every downstream file classification in this map depends on it: shadcn-generated files (`button.tsx`, `card.tsx`, `sidebar.tsx`, `sheet.tsx`, `skeleton.tsx`, `dropdown-menu.tsx`, `separator.tsx`) go untouched into `components/ui/`; all hand-written composition lives in `components/amassa/`.

## No Analog Found

Files with no close match in the codebase (planner should use UI-SPEC contract instead, which already fully specifies these):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components.json` | config | — | shadcn/ui is not installed yet in this repo; generated by `npx shadcn init`, no prior version to diff against |
| `components/ui/*.tsx` (button, card, sidebar, sheet, skeleton, dropdown-menu, separator) | component | static/interactive | Generated verbatim by `shadcn add`; not hand-written, so no in-repo pattern applies — only the D-11 boundary rule (never edit these except via `shadcn add` again) |
| `app/(app)/error.tsx` | route (error boundary) | event-driven | First Next.js `error.tsx` convention file in this repo; must be `"use client"` per Next.js App Router requirement, follow the `estado-erro.tsx` contract in UI-SPEC for content/copy |
| `app/(app)/not-found.tsx` | route (404 boundary) | request-response | First `not-found.tsx` in this repo; follow the UI-SPEC copy ("Esta página não existe.") |
| `app/(app)/loading.tsx` | route (loading boundary) | request-response | First `loading.tsx` in this repo; compose from the shadcn `Skeleton` per UI-SPEC "Estado de carregamento" section |
| `components/amassa/logo.tsx`, `barra-lateral.tsx`, `barra-inferior.tsx`, `cabecalho-movel.tsx` | component (nav/brand) | static/interactive | First navigation/brand components in this repo — no prior nav pattern exists; build directly from the shadcn `Sidebar`/`Sheet` primitives and the UI-SPEC "Navegação" section, which is fully specified (breakpoint, sizes, icons, ARIA) |

## Metadata

**Analog search scope:** `app/`, `lib/`, `components/` (does not exist yet), `tests/e2e/`, root config files (`package.json`, `playwright.config.ts`, `app/globals.css`, `app/layout.tsx`)
**Files scanned:** `app/(auth)/login/page.tsx`, `app/(auth)/login/botao-entrar.tsx`, `app/(app)/page.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/auth/exigir-usuario.ts`, `lib/auth/acoes.ts`, `lib/auth/rotas-publicas.ts`, `lib/saude.ts`, `lib/backup/frescor.ts`, `package.json`, `tests/e2e/autenticacao.spec.ts`
**Pattern extraction date:** 2026-08-08
