# Phase 06: Estoque - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 22 (new + modified)
**Analogs found:** 21 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/estoque/saldo.ts` (new) | utility (pure rule) | transform | `lib/queimas/filtros.ts`, `lib/cadastros/catalogo.ts` | exact |
| `lib/estoque/custo.ts` (new) | utility (pure rule) | transform | `lib/financeiro/efeito-estoque.ts` (integer milésimos) | exact |
| `lib/estoque/destinos.ts` (new) | utility (pure) | transform | `lib/financeiro/abas.ts` (closed union, zero imports) | exact |
| `lib/estoque/textos.ts` (new) | config (copy) | — | `lib/anotacoes/textos.ts` | exact |
| `lib/estoque/esquemas.ts` (new) | validation | request-response | `lib/anotacoes/esquemas.ts` / `lib/financeiro/esquemas.ts` | exact |
| `lib/estoque/consultas.ts` (new) | service (read) | CRUD read | `lib/anotacoes/consultas.ts`; aggregate+Map: `lib/precificacao/consultas.ts:278-333`, `lib/cadastros/consultas.ts:153-181` | exact |
| `lib/estoque/gravacao.ts` (new, NOT "use server") | service (write with tx) | CRUD write / locking | `lib/anotacoes/acoes.ts:19,63-76` (TransacaoDoBanco + lock) | role-match |
| `lib/estoque/acoes.ts` (new, "use server") | controller (Server Actions) | request-response | `lib/financeiro/acoes.ts:508-554` (`cancelarDocumento`), `lib/anotacoes/acoes.ts` | exact |
| `lib/financeiro/acoes.ts` (modify: lancarVenda 58-255, lancarDespesa 266-452, cancelarDocumento 508-554, active-item checks 149-177/298-321) | controller | request-response | itself + `lib/estoque/gravacao.ts` | exact |
| `lib/financeiro/consultas.ts` (modify: 203-216, 230-245 filter `ativo`) | service | CRUD read | itself | exact |
| `lib/cadastros/consultas.ts`, `lib/cadastros/acoes.ts`, `lib/cadastros/catalogo.ts` (modify: expose `ativo`, move non-async helpers 303-324 out of "use server") | service/utility | CRUD | itself | exact |
| `db/schema.ts` (modify: `movimentacoes_estoque`, `itens_catalogo.ativo/minimo/observacoes`) | model | — | `db/schema.ts:79,89` (bigint mode number), `anotacoesDaCasa` at 1317 | exact |
| `db/migrations/0023_estoque.sql` (new) | migration | — | `db/migrations/0022_anotacoes-da-casa.sql` | exact |
| `scripts/testar-migracoes.mjs` (modify `TABELAS_ESPERADAS`, line 26) | config/test | — | itself | exact |
| `app/gestao/(app)/estoque/page.tsx` (replace empty state) | route (Server Component) | request-response | `app/gestao/(app)/financeiro/page.tsx` (`?aba=` + consultas) | exact |
| `components/amassa/estoque/abas-estoque.tsx` | component | — | `components/amassa/financeiro/abas-financeiro.tsx` | exact |
| `components/amassa/estoque/filtro-*.tsx` (Ativos/Desativados/Todos) | component | — | `components/amassa/queimas/filtro-fornos.tsx` | exact |
| `components/amassa/estoque/folha-movimentacao.tsx`, `contagem`, `editar-material`, `novo-material` (dialogs) | component (form) | request-response | `components/amassa/queimas/formulario-forno.tsx` | exact |
| `components/amassa/estoque/cartao-saldo.tsx`, lists/history/para-onde-foi | component | read | `components/amassa/queimas/cartao-forno.tsx`, `financeiro/lista-completa.tsx`, `linha-carrinho.tsx` | role-match |
| `components/amassa/inicio/bloco-estoque.tsx` (modify: real query) | component (async RSC) | read | `components/amassa/inicio/bloco-producao.tsx:40-131` | exact |
| `components/amassa/financeiro/efeito-estoque.tsx` (possibly text only) | component | — | itself — e2e `financeiro-venda.spec.ts` reads its text; do not change format | exact |
| `tests/unit/estoque-*.test.ts` | test | — | `tests/unit/financeiro-efeito-estoque.test.ts`, `filtros-fornos.test.ts` | exact |
| e2e `tests/e2e/estoque*.spec.ts` + `@vazio-global` chain | test | — | `playwright.config.ts` `vazio-*` projects | role-match |

## Pattern Assignments

### `lib/estoque/saldo.ts`, `custo.ts`, `destinos.ts` (pure modules)

**Analog header discipline:** `lib/cadastros/catalogo.ts:1-17` — only `import type`, never React/Next/drizzle/`@/db`; types redeclared structurally:
```typescript
// Módulo puro do Catálogo — só `import type` é permitido aqui ...; nenhuma
// linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano). `Unidade` é
// REDECLARADO ...
import type { AreaFinanceira } from "./categorias";
```
**Closed union + normalizer** (`lib/financeiro/abas.ts:6-20`) — model for `destinos.ts` and the tab reader:
```typescript
export type AbaFinanceiro = "venda" | "despesa" | "caixa" | "mes" | "orcamentos" | "pecas";
export function abaDaUrl(valor: string | null | undefined): AbaFinanceiro {
  if (valor === "despesa") return "despesa";
  ...
  return "venda";
}
```
**Filter never reorders** (`lib/queimas/filtros.ts:7-20`): `export type FiltroDeForno = "ativos" | "desativados" | "todos";` + generic `filtrarPorAtivo<T extends { readonly ativo: boolean }>`. Copy for the Estoque active filter.
**Integer arithmetic** (`lib/financeiro/efeito-estoque.ts:1-8, 55-70`): all math in milésimos inteiros; `custo.ts` uses `BigInt` for `quantidade × valor` and "meio-para-cima" rounding (`lib/financeiro/taxa.ts`, cited in `lib/precificacao/calculo.ts:75-80`). "Hoje" is passed as an argument, never `new Date()` inside a pure module.

---

### `lib/estoque/textos.ts`
**Analog:** `lib/anotacoes/textos.ts:1-25` — zero imports, `export const FRASE_*` / `ROTULO_*`, comment citing the prototype source for each verbatim phrase. Include `ROTULO_FILTRO_ATIVOS/DESATIVADOS/TODOS` (as `lib/queimas/textos.ts`) and the erro/vazio strings.

---

### `lib/estoque/esquemas.ts`
**Analog:** `lib/anotacoes/esquemas.ts:1-40`
```typescript
import { z } from "zod";
export const esquemaSalvarAnotacoes = z.object({
  texto: z.string().transform((valor) => valor.normalize("NFC")).refine(..., MENSAGEM_...),
```
Messages in pt-BR. Quantity/money parsing reuses `converterQuantidade` / `converterReaisParaCentavos` (`lib/financeiro/dinheiro.ts`; note line 161-164 rejects `<= 0` — contagem needs a zero-accepting variant).

---

### `lib/estoque/consultas.ts` (no "use server")
**Analog:** `lib/anotacoes/consultas.ts:1-30`
```typescript
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { anotacoesDaCasa, usuarios } from "@/db/schema";

export async function lerFolhaDaCasa(): Promise<FolhaDaCasa> {
  const [linha] = await db
    .select({ texto: ..., salvoPorNome: usuarios.nome, atualizadoEm: ... })
    .from(anotacoesDaCasa)
    .leftJoin(usuarios, eq(anotacoesDaCasa.salvoPor, usuarios.id))
```
`listarSaldos()`: main query of items (`controla_estoque`, two categories via `alias` as `listarCatalogoCompleto`, `lib/cadastros/consultas.ts:153-181`) + one `SUM ... GROUP BY item_id`, joined in TS with a `Map` (`lib/precificacao/consultas.ts:278-333`). Classification via `lib/estoque/saldo.ts`. Author name via `leftJoin(usuarios)`.

---

### `lib/estoque/gravacao.ts` (receives `tx`, NO "use server")
**Analog:** `lib/anotacoes/acoes.ts`
Transaction type (line 19):
```typescript
type TransacaoDoBanco = Parameters<Parameters<typeof db.transaction>[0]>[0];
```
Lock-then-decide (lines 63-76), adapted per RESEARCH Pattern 2 to `"no key update"` and ordered ids (avoids FK deadlock with `for("update")`):
```typescript
const travados = await tx
  .select({ id: itensCatalogo.id })
  .from(itensCatalogo)
  .where(inArray(itensCatalogo.id, idsAfetados))
  .orderBy(asc(itensCatalogo.id))
  .for("no key update");
// only after: select sum(...) group by item_id, then lib/estoque/custo.ts, then insert
```
Reason it is not in `acoes.ts`: every export of a "use server" file becomes a Server Action and `scripts/verificar-acoes.mjs:12-16` requires `exigirUsuario()` first line (RESEARCH Pattern 4 / Pitfall 7).

---

### `lib/estoque/acoes.ts` ("use server")
**Analog:** `lib/financeiro/acoes.ts:505-554` (`cancelarDocumento`) — full shape to copy:
```typescript
class DocumentoNaoEncontrado extends Error {}

export async function cancelarDocumento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ documentoId: string; numero: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCancelamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  ...
  try {
    const numero = await db.transaction(async (tx) => { ... .for("update"); ... });
    revalidatePath("/gestao/financeiro");
    return { ok: true, dados: { documentoId, numero } };
  } catch (erro) {
    if (erro instanceof DocumentoNaoEncontrado) {
      return { ok: false, erro: FRASE_LANCAMENTO_NAO_EXISTE_MAIS };
    }
    console.error("Falha ao cancelar lançamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}
```
Imports (from `lib/anotacoes/acoes.ts:1-14`):
```typescript
"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";
```

---

### `lib/financeiro/acoes.ts` (modify)
- `lancarVenda`/`lancarDespesa`: after inserting document lines, call `gravacao.ts` per line within the same `tx` (RESEARCH Pattern 3, using `efeitoNoEstoque([linha], itensParaEfeito, "venda")`). Load items with `tx`, not `db` (`listarItensParaEfeito` at `lib/financeiro/consultas.ts:250-283` uses `db`).
- `cancelarDocumento` (above): inside the existing transaction, **mirror** recorded movements as reversals; never recompute the effect.
- Active-item refusal at 149-177 and 298-321 reuses the phrase "Um dos itens saiu do catálogo — tire a linha e tente de novo."

---

### `db/schema.ts` + `db/migrations/0023_estoque.sql`
**Schema analog:** `db/schema.ts:79,89` — `bytes: bigint("bytes", { mode: "number" })`.
**Migration analog:** `db/migrations/0022_anotacoes-da-casa.sql` — header "APLICADA À MÃO, pelo dono, depois de backup", generated `CREATE TABLE` block, then hand-written sections separated by `--> statement-breakpoint`:
```sql
drop trigger if exists tocar_atualizado_em_anotacoes_da_casa on anotacoes_da_casa;
--> statement-breakpoint
create trigger ... for each row execute function tocar_atualizado_em();
--> statement-breakpoint
grant select, insert, update on anotacoes_da_casa to amassa_app;
--> statement-breakpoint
revoke delete on anotacoes_da_casa from amassa_app;
```
For `movimentacoes_estoque`: `grant select, insert` only; `revoke update, delete` (immutable ledger); unique index for the reversal. Update `TABELAS_ESPERADAS` in `scripts/testar-migracoes.mjs:26`.

---

### `app/gestao/(app)/estoque/page.tsx`
**Current file** (to replace): `await exigirUsuario();` first instruction, `CabecalhoPagina titulo="Estoque"`, `EstadoVazio`. Keep that opening.
**Analog:** `app/gestao/(app)/financeiro/page.tsx:1-60` — reads `?aba=` via a pure `abaDaUrl`, imports consultas from `@/lib/<modulo>/consultas`, renders `<AbasFinanceiro abaAtual={aba} />`. Estoque tabs: `saldos | historico | para-onde-foi`.

---

### `components/amassa/estoque/abas-estoque.tsx`
**Analog:** `components/amassa/financeiro/abas-financeiro.tsx:1-70` — `"use client"`, `role="tablist"`, neutral pills (never terracota, UI-SPEC), `<Link>` to same route with `?aba=`, `rotaDeGestao`, `cn`, `min-w-0 break-words`, `memo` inner component. Only one row needed (3 tabs).

### `components/amassa/estoque/filtro-*.tsx`
**Analog:** `components/amassa/queimas/filtro-fornos.tsx` (entire file, 60 lines) — dumb component, `role="radiogroup"` + `role="radio"` + `aria-checked`, `min-h-[44px]`, selected = `border-tinta bg-superficie-2 text-tinta`, others `border-borda bg-superficie text-tinta-fraca`, `data-testid`.

### Dialogs (movimentação, contagem, editar/novo material)
**Analog:** `components/amassa/queimas/formulario-forno.tsx:90-200`
- `"use client"`, react-hook-form, `toast` from `sonner`, `router.refresh()` on success.
- Server error kept inline, form stays open:
```tsx
if (!resposta.ok) { setErro(resposta.erro); return; }
toast.success("Forno cadastrado.");
```
- Responsive `DialogContent` classes (mobile full-screen `h-[100dvh]` bottom sheet, `md:max-w-lg` centered), footer pinned by flex, never `sticky` (G-03-1). `sheet.tsx` is reserved for the user menu.
- `<p role="alert" aria-live="assertive">` for erro; `Field`/`FieldLabel`/`FieldError`, `CLASSE_DO_CAMPO` (>=16px).

### `components/amassa/inicio/bloco-estoque.tsx`
**Current** is sync with static empty state. **Analog:** `components/amassa/inicio/bloco-producao.tsx:40-131`:
```tsx
export async function BlocoProducao({ hoje }: BlocoProducaoProps) {
  let falhou = false;
  let linhas: LinhaDeProducao[] = [];
  try {
    const encomendas = await listarEncomendasAtivas();
    linhas = producaoEmAndamento(...);
  } catch (erro) {
    console.error("Falha ao carregar a produção no Início:", erro);
    falhou = true;
  }
  return (
    <BlocoDoInicio titulo=... acaoRotulo=... acaoHref={rotaDeGestao("/encomendas")} dataTestId=...>
      {falhou ? (
        <EstadoErro titulo="Algo não funcionou." corpo={TEXTOS_DOS_BLOCOS.producao.erro} acao={<TentarDeNovo />} />
      ) : linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.producao.vazio}</p>
      ) : ( ... )}
```
Keep `titulo="Estoque acabando"`, `acaoHref={rotaDeGestao("/estoque")}`, `dataTestId="inicio-bloco-estoque"`. `TEXTOS_DOS_BLOCOS.estoque.erro` already exists (`lib/inicio/textos.ts:23-26`); Suspense already in `app/gestao/(app)/page.tsx:71-73`. Query from `lib/estoque/consultas.ts`, rule from `lib/estoque/saldo.ts` (`lib/inicio/` stays presentation-only).

### Unit tests
**Analog:** `tests/unit/financeiro-efeito-estoque.test.ts:1-25` — `import { describe, expect, it } from "vitest";`, `@/lib/...` imports, typed fixtures (`const grao: ItemParaEfeito = {...}`). Name files `tests/unit/estoque-saldo.test.ts`, `estoque-custo.test.ts`, `estoque-destinos.test.ts`, `estoque-esquemas.test.ts`. Add new contrast pairs to `tests/unit/contraste.test.ts`.

## Shared Patterns

### Authorization
**Source:** `lib/auth/exigir-usuario.ts`; enforced by `scripts/verificar-acoes.mjs`
**Apply to:** every export of `lib/estoque/acoes.ts`, and `page.tsx`. `const usuario = await exigirUsuario();` as first statement.

### Postgres errors
**Source:** `lib/erro/postgres.ts:11-30` — `codigoDoErroPostgres(erro)` reads `erro.cause.code` (Drizzle wraps); `ehViolacaoDeChaveEstrangeira` for 23503. Never check `erro.code` directly.

### Result shape
`ResultadoDeAcao<T>` = `{ ok: true; dados } | { ok: false; erro: string }` with `primeiraMensagemDeErro(resultado)` on Zod failure (`lib/financeiro/acoes.ts`). Domain errors as private `class X extends Error {}` mapped to pt-BR phrases; unexpected errors `console.error` + generic phrase.

### Routes and formatting
`rotaDeGestao("/estoque")` (never literal; `tests/unit/sem-rota-antiga.test.ts`); `formatarReais`, `formatarQuantidade` (`lib/financeiro/formato.ts:37,78`) with `tabular-nums`; `ROTULO_UNIDADE`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Moving-average cost valuation inside `lib/estoque/custo.ts` (algorithm) | utility | transform | No weighted-average/ledger valuation exists; follow RESEARCH §Pergunta 3 (R1-R6) with integer/BigInt discipline from `efeito-estoque.ts` |

## Metadata

**Analog search scope:** `lib/{anotacoes,financeiro,cadastros,queimas,erro}`, `components/amassa/{queimas,financeiro,inicio}`, `app/gestao/(app)`, `db/`, `scripts/`, `tests/unit/`
**Files scanned:** ~20
**Pattern extraction date:** 2026-09-29
