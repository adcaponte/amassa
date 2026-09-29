---
phase: 06-estoque
reviewed: 2026-09-29T08:35:56Z
depth: standard
files_reviewed: 71
files_reviewed_list:
  - app/api/health/estoque/route.ts
  - app/gestao/(app)/estoque/contagem/error.tsx
  - app/gestao/(app)/estoque/contagem/loading.tsx
  - app/gestao/(app)/estoque/contagem/page.tsx
  - app/gestao/(app)/estoque/error.tsx
  - app/gestao/(app)/estoque/loading.tsx
  - app/gestao/(app)/estoque/page.tsx
  - app/gestao/(app)/financeiro/page.tsx
  - app/globals.css
  - components/amassa/cadastros/confirmar-desativacao.tsx
  - components/amassa/cadastros/dialogo-item-catalogo.tsx
  - components/amassa/cadastros/ficha-tecnica.tsx
  - components/amassa/cadastros/lista-catalogo.tsx
  - components/amassa/estoque/aba-historico.tsx
  - components/amassa/estoque/aba-saldos.tsx
  - components/amassa/estoque/abas-estoque.tsx
  - components/amassa/estoque/banner-estoque.tsx
  - components/amassa/estoque/barra-acao-fixa.tsx
  - components/amassa/estoque/barra-ferramentas-saldos.tsx
  - components/amassa/estoque/barras-para-onde-foi.tsx
  - components/amassa/estoque/carregador-do-seletor.tsx
  - components/amassa/estoque/cartao-saldo.tsx
  - components/amassa/estoque/esqueleto-abas.tsx
  - components/amassa/estoque/esqueleto-saldos.tsx
  - components/amassa/estoque/filtro-situacao.tsx
  - components/amassa/estoque/folha-editar-material.tsx
  - components/amassa/estoque/folha-material.tsx
  - components/amassa/estoque/folha-movimentacao.tsx
  - components/amassa/estoque/folha-novo-material.tsx
  - components/amassa/estoque/grade-destinos.tsx
  - components/amassa/estoque/linha-contagem.tsx
  - components/amassa/estoque/linha-movimentacao.tsx
  - components/amassa/estoque/lista-contagem.tsx
  - components/amassa/estoque/painel-primeira-abertura.tsx
  - components/amassa/estoque/previa-do-saldo.tsx
  - components/amassa/estoque/provedor-estoque.tsx
  - components/amassa/estoque/secao-historico.tsx
  - components/amassa/estoque/secao-para-onde-foi.tsx
  - components/amassa/estoque/secao-saldos.tsx
  - components/amassa/estoque/seletor-material.tsx
  - components/amassa/estoque/tabela-saldos.tsx
  - components/amassa/financeiro/efeito-estoque.tsx
  - components/amassa/financeiro/painel-despesa.tsx
  - components/amassa/financeiro/painel-venda.tsx
  - components/amassa/inicio/bloco-estoque.tsx
  - db/migrations/0023_estoque.sql
  - db/schema.ts
  - docs/operacao/15-migracao-estoque.md
  - lib/cadastros/acoes.ts
  - lib/cadastros/catalogo.ts
  - lib/cadastros/consultas.ts
  - lib/cadastros/esquemas.ts
  - lib/cadastros/textos.ts
  - lib/estoque/abas.ts
  - lib/estoque/acoes.ts
  - lib/estoque/consultas.ts
  - lib/estoque/contagem.ts
  - lib/estoque/custo.ts
  - lib/estoque/destinos.ts
  - lib/estoque/esquemas.ts
  - lib/estoque/gravacao.ts
  - lib/estoque/historico.ts
  - lib/estoque/pedidos.ts
  - lib/estoque/saldo.ts
  - lib/estoque/textos.ts
  - lib/financeiro/acoes.ts
  - lib/financeiro/consultas.ts
  - lib/financeiro/dinheiro.ts
  - lib/financeiro/efeito-estoque.ts
  - lib/financeiro/textos.ts
  - lib/inicio/textos.ts
findings:
  critical: 0
  warning: 5
  info: 9
  total: 14
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-09-29T08:35:56Z
**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

## Summary

I spent most of the review on the write path: `lib/estoque/gravacao.ts`, `lib/estoque/custo.ts`,
`lib/estoque/pedidos.ts`, the three Financeiro actions in `lib/financeiro/acoes.ts` that now write
stock, migration `0023`, and Roteiro 15. I read the UI components for error, loading and empty
states, touch targets and double-submit handling.

**What holds up (checked, not assumed):**
- **Invariants.** I checked each rule R1–R6 for sign and rounding. The value never takes the sign
  opposite to the quantity. Quantity zero always gives value zero, because R1 sets V' = 0 whenever
  Q' = 0, so Q = 0 always means V = 0. When R5 or R6 crosses zero, half-up rounding cannot flip the
  sign: V' stays within 0.5 of the exact value V·Q'/Q, which has the right sign.
- **Locking.** Items are locked in one `SELECT … ORDER BY id FOR NO KEY UPDATE`. LockRows runs after
  the Sort, so rows are locked in id order. Every path locks document first, then items. The
  `for no key update` choice avoids the FK `KEY SHARE` deadlock.
- **Double reversal.** It is blocked three ways: the document `FOR UPDATE` plus the `cancelado_em`
  re-check (READ COMMITTED re-reads the locked row), the `not exists` in `originaisSemEstorno`, and
  the unique `estorno_de_id`.
- **Checks versus requests.** Every request the code builds (sale, sale reversal, purchase, purchase
  reversal, manual entry and exit, adjustment, first count) passes every `CHECK` in `0023`.
- **Schema.** `db/schema.ts` matches `0023`.
- **Grants.** Only `update` and `delete` are revoked.
- **Old code with the new migration.** `0023` is purely additive and safe with the old code
  running.
- **Branch parity.** The migration-only branch holds the same four files as the phase branch and
  descends from `main`, so the Passo 2 merge is a fast-forward.
- **Authorization and validation.** Every exported Server Action calls `exigirUsuario()` first. Area,
  value, difference, mode and `peca_pronta` are decided on the server.

**What needs attention:**
- **Money rule (WR-01, WR-02).** D-23 only holds when the stock is positive at the moment of
  cancellation. With negative stock, cancelling an old sale records a different value and reprices
  the whole shelf. The owner's Parte 0 example does not cover this case.
- **First count (WR-03).** The first count applies the typed cost to the server's difference. The
  person was told they were pricing a different, stale difference.
- **Roteiro (WR-04).** Passo 9 describes a rollback that cannot be undone by re-merging the branch.
- **Cadastros dialog (WR-05).** The deactivate/reactivate dialog can lock up for good on a network
  failure.

No finding reaches BLOCKER. None of these corrupts data silently on the normal path (positive stock,
no concurrency), and the migration and roteiro contain no command that would publish code before
the migration.

## Warnings

### WR-01: D-23 is not what the code does when stock is ≤ 0 at cancellation — cancelling an old sale reprices the shelf

**File:** `lib/estoque/custo.ts:118-129` (R2/R3/R4 applied to the reversal), `lib/estoque/custo.ts:163-173` (`movimentoDoEstorno`)

**Issue:** A sale reversal is fed back as `entrada_com_preco` with `pagoCentavos = |value the sale
took|`. D-23 ("the material comes back at the cost the sale took") only holds on the R2 branch,
where Q > 0. If the stock is at zero or negative when the sale is cancelled, R3, R4 or R1 decide
the value instead:
- the recorded `valor_centavos` differs from what the sale took;
- on R3, the average cost of the WHOLE shelf becomes the old sale's cost.

Reproduced with the real `valorarMovimento`:

| Step | Q (milésimos) | V (centavos) | Row value |
|---|---|---|---|
| Last priced entry R$ 10,00/un, stock 0 | 0 | 0 | — |
| Sale A, 2 un | −2000 | −2000 | −2000 (took R$ 20,00) |
| Purchase 5 un for R$ 250,00 (R3) | 3000 | 15000 | +17000 |
| Sale B, 4 un | −1000 | −5000 | −20000 |
| **Cancel sale A (R3)** | **1000** | **1000** | **+6000** (not +2000) |

After the cancellation, the one unit on the shelf is worth R$ 10,00, although the last purchase
was R$ 50,00/un. The reversal row also becomes the "última entrada com preço" (see WR-02).

D-06 explicitly allows negative stock, and Roteiro 15 Passo 8 says sales made before the first count
leave materials negative. So Q ≤ 0 at cancellation time is an expected state, not an edge case. The
Parte 0 example in `06-VERIFICACAO-HUMANA.md` §0.1 only shows the positive-stock case. The owner is
being asked to approve D-23 without seeing this behavior. The code comment at `custo.ts:158-159`
also claims the rule "zera exatamente", which is true only for "Para onde foi" (because cancelled
sales are excluded there), not for the stock value.

Forcing value = P literally would break the sign invariant: in the example, Q' = 1000 with
V' = −3000. So this is a rule decision, not a one-line fix.

**Fix:** Add this case, with numbers, to Parte 0 §0.1 before the owner answers. Pin the behavior in
`tests/unit/estoque-custo.test.ts`. One option to offer the owner: when Q ≤ 0, value the sale
reversal at the current rate (R6-style) instead of letting R3 reset the rate to the old sale's cost.
The shelf is then not repriced by a cancellation. Also correct the comment at `custo.ts:158-159` to
say where the "zera" guarantee actually comes from.

### WR-02: Reversals count as "última entrada com preço", which drives D-26 and the displayed average

**File:** `lib/estoque/gravacao.ts:143-169`, `lib/estoque/consultas.ts:114-122,161-164`, `lib/estoque/custo.ts:138-141`

**Issue:** "Última entrada com preço" is taken as the last row with `tipo = 'entrada'`. A sale
reversal is `tipo = 'entrada'` with `valor_informado_centavos = |sale value|`. Two consequences:
1. **A cancelled sale redefines D-26.** Once stock returns to zero, the next sale is valued at the
   cancelled sale's historical cost, not at the last purchase price that D-26 intends.
2. **"R$ 0,00" appears where "—" is promised.** Suppose a sale is made before any priced entry
   (valued at R$ 0 per D-26) and is then cancelled. The reversal row has
   `valor_informado_centavos = 0`, so `custoMedioParaExibir` finds a non-null "última entrada" and
   shows "R$ 0,00/un". `saldo.ts:289-291` and `SEM_CUSTO_CONHECIDO` promise "—" in exactly this
   situation.

**Fix:** Exclude reversals from the "last priced entry", in three places kept in sync:
- add `isNull(movimentacoesEstoque.estornoDeId)` to both `selectDistinctOn` queries (`lerEstados`
  and `lerSaldos`);
- in `valorarMovimento`, keep `estado.ultimaEntradaComPreco` unchanged for reversals, for example
  with an `estorno: true` flag on the `entrada_com_preco` returned by `movimentoDoEstorno`.

Also add a unit test that cancels a zero-cost sale and expects `custoMedioParaExibir(...) === null`.

### WR-03: The first-count cost is typed for the page's difference but applied to the server's difference

**File:** `components/amassa/estoque/linha-contagem.tsx:107-124,160-164`; `lib/estoque/gravacao.ts:474-516`; `lib/estoque/contagem.ts:77-88`

**Issue:**
1. The hint under "Custou ao todo" (`dicaCustouAoTodo`) tells the person the cost is "o que você
   pagou por {diferença} {un}". That difference is computed from `item.saldoMilesimos` as loaded
   with the page.
2. A full count takes a long time while the shop keeps selling (Roteiro 15 Passo 8 anticipates
   this), so the page's saldo goes stale.
3. `gravarContagem` recomputes the difference under the lock and passes the typed `custouCentavos`
   as the price of that new Δ.

Example: the page shows saldo −2 and the person counts 10. The hint says they are pricing 12 un, so
they type R$ 120,00 (R$ 10/un). Meanwhile another sale made the real saldo −3. The server records
Δ = 13 at R$ 120,00, a rate of R$ 9,23/un. The initial stock value, which every later exit uses, is
~8% off. Nothing is reported. `saldoMilesimos` only comes back on a refusal.

**Fix:** Send the saldo the client priced against (`saldoEsperadoMilesimos`) in
`esquemaConfirmarContagem`. In `gravarContagem`, when the plan is `entrada`, a cost was sent, and
the saldo under the lock differs from the expected one, return a refusal ("O saldo mudou de X para
Y enquanto você contava — confira o custo") with the new saldo. The row already handles
`saldoMilesimos` on error, so it will re-render the hint.

### WR-04: Roteiro 15 Passo 9 Caso B — after `git revert -m 1`, re-merging the branch does NOT bring the code back

**File:** `docs/operacao/15-migracao-estoque.md:354-374`

**Issue:** Caso B reverts the integration merge. The text says "quando o código voltar, confira a
contagem" but never says how to bring it back. Git treats the reverted merge's commits as already
merged. Running Passo 6 again (`git merge --no-ff gsd/phase-06-estoque`) reports "Already up to
date", or brings only later fixes. The Estoque code silently stays out, while the owner believes it
was republished and `/api/health/estoque` stays 404 or old. This is a known git trap in a roteiro
the owner runs by hand under pressure.

**Fix:** Add a "Voltar com o código" sub-step: `git revert <hash do commit de revert>` (a revert of
the revert), plus any fix commits, then `git push` and the Passo 7 check. State explicitly that
re-running Passo 6 does not work after Caso B.

### WR-05: Deactivate/reactivate in the Catalog dialog has no try/finally — a failed call locks the dialog permanently

**File:** `components/amassa/cadastros/dialogo-item-catalogo.tsx:345-383`

**Issue:** `desativar()` and `reativar()` call `await definirItemAtivo(...)`, then
`setAlternandoAtivo(false)`, with no `try/catch/finally`. If the Server Action rejects (connection
drop on the phone, deploy in progress, server error before the result), `alternandoAtivo` stays
`true` forever. `ConfirmarDesativacao` receives `pendente = true`, and its `onOpenChange` refuses to
close while pending (`confirmar-desativacao.tsx:60-64`). Both buttons are disabled, so the person
is stuck in the dialog with "Desativando…" and no error message. The equivalent Estoque sheets
(`folha-material.tsx`, `folha-editar-material.tsx`) wrap the same call in try/catch; this one was
missed.

**Fix:**
```tsx
async function desativar() {
  if (!itemParaEditar || alternandoAtivo) return;
  setErroDaDesativacao(null);
  setAlternandoAtivo(true);
  try {
    const resposta = await definirItemAtivo({ id: itemParaEditar.id, ativo: false });
    if (!resposta.ok) { setErroDaDesativacao(resposta.erro); return; }
    toast.success(textoItemDesativado(resposta.dados.nome));
    setConfirmandoDesativacao(false);
    onFechar();
    router.refresh();
  } catch (falha) {
    console.error("Falha ao desativar item:", falha);
    setErroDaDesativacao(FRASE_FALHA_AO_SALVAR);
  } finally {
    setAlternandoAtivo(false);
  }
}
```
Apply the same fix to `reativar()`.

## Info

### IN-01: `0023` has no explicit `grant select, insert`; it relies on 0003's default privileges

**File:** `db/migrations/0023_estoque.sql:84-90`

**Issue:** 0022 grants explicitly (`grant select, insert, update on anotacoes_da_casa to
amassa_app`). 0023 only revokes and relies on `alter default privileges` from 0003. That only works
if the table is created by `amassa_owner`. If it is ever applied by another role (a superuser in an
incident), `amassa_app` gets no `INSERT` and every sale fails once the code is published.
Roteiro 5.3 does check the privilege, so today this is covered by procedure only.
`/api/health/estoque` only tests `SELECT`, so it would not notice a missing `INSERT`.

**Fix:** Add `grant select, insert on movimentacoes_estoque to amassa_app;` before the revoke (same
pattern as 0022). Optionally have the health route check
`has_table_privilege(current_user, 'movimentacoes_estoque', 'insert')`.

### IN-02: Roteiro Passo 4 migrates without first confirming the pulled image contains `0023`

**File:** `docs/operacao/15-migracao-estoque.md:196-205`

**Issue:** Roteiros 04 and 05 list `db/migrations` inside `ferramentas` before `db:migrate`.
Roteiro 15 skips that step. If the image is stale, `db:migrate` prints "Migrações aplicadas com
sucesso." and exits 0 having done nothing. Passo 5.1 catches it afterwards, but the owner will
already have read a success message.

**Fix:** Before migrating, add
`docker compose run --rm ferramentas ls db/migrations | grep 0023_estoque` with "deve aparecer
`0023_estoque.sql`; senão pare".

### IN-03: The public `/api/health/estoque` body names the migration and misattributes any DB failure

**File:** `app/api/health/estoque/route.ts:37-43`

**Issue:** The requirement was that nothing beyond `{status}` leaks. The 503 body adds
`motivo: "…a migração 0023 foi aplicada?"`, which exposes an internal migration identifier to
anyone. It also blames the migration when the real cause is a DB outage or connection-pool
exhaustion.

**Fix:** Return `{ status: "erro" }` only, and keep the detail in `console.error`. Or use a neutral
fixed `motivo`, such as "estrutura do Estoque indisponível".

### IN-04: The claim "fora de `main`, nenhum push publica" ignores `workflow_dispatch`

**File:** `docs/operacao/15-migracao-estoque.md:14-15` (pipeline: `.github/workflows/entrega.yml:11,249-250`)

**Issue:** The pipeline also runs on `workflow_dispatch`, and `implantar` is gated only by
`vars.DEPLOY_ATIVO`, not by the ref. A manual "Run workflow" on `gsd/phase-06-estoque` would publish
the phase code before the migration (D-33).

**Fix:** Add `if: github.ref == 'refs/heads/main'` to `implantar`, or at least warn in Roteiro 15
not to dispatch the workflow on the phase branch.

### IN-05: `definirItemAtivo` locks the item `FOR UPDATE`, against the rationale in `gravacao.ts`

**File:** `lib/cadastros/acoes.ts:657-661`

**Issue:** `FOR UPDATE` conflicts with the `FOR KEY SHARE` that every sale line insert takes on the
item. The header of `gravacao.ts` explains why the write path uses `FOR NO KEY UPDATE` instead.
While an item is being (de)activated, sales of it block. When sales hold `KEY SHARE` and queue
behind this waiter, the Postgres tuple-lock queue can produce a deadlock that aborts one side with
`FRASE_FALHA_AO_SALVAR`. This is rare at the atelier's volume. The column being updated (`ativo`)
is not a key, so `NO KEY UPDATE` suffices.

**Fix:** Use `.for("no key update")` in `definirItemAtivo`. `editarItem` has the same pattern and
predates this phase.

### IN-06: `ativo` is checked outside the transaction in `lancarVenda` / `lancarDespesa`

**File:** `lib/financeiro/acoes.ts:157-188,354-385`

**Issue:** The item is read and checked (`ativo`, `aparecenaVenda`, `controlaEstoque`) before
`db.transaction`. If the item is deactivated between that check and the transaction, the sale or
purchase is still recorded against a deactivated item. The guarantee claimed by T-06-15 is weaker
than it reads.

**Fix:** Re-read `ativo` for the line items with the `tx` (the rows are locked, or at least
`KEY SHARE`d, by the line insert), or accept the race and document it.

### IN-07: The migration header claims re-running the blocks by hand is safe, but most of the file is not idempotent

**File:** `db/migrations/0023_estoque.sql:17-18`

**Issue:** Only the function and the trigger are recreatable. `CREATE TYPE`, `CREATE TABLE`,
`ADD COLUMN` and `ADD CONSTRAINT` all fail on a second run. Someone following this comment during
a Caso A incident would get errors. `db:migrate` runs in one transaction, so a partial state is
unlikely anyway.

**Fix:** Reword the comment to say that only blocks (1) and (2) are safe to re-run.

### IN-08: The count row's double-submit guard is state-based, not ref-based

**File:** `components/amassa/estoque/linha-contagem.tsx:127,157`

**Issue:** `if (gravando) return` reads React state. An Enter key press plus a click in the same
frame, or two fast Enter presses, can both pass before the re-render. `folha-movimentacao.tsx` uses
a `useRef` guard (T-06-56) for exactly this reason. It is harmless today, because the second call
finds difference 0 under the lock and writes nothing, but it makes an extra round-trip and can
flash a "Conferido" state.

**Fix:** Mirror the `emVoo` ref guard from `folha-movimentacao.tsx`.

### IN-09: The phase branch and the migration-only branch exist only on this machine

**File:** `docs/operacao/15-migracao-estoque.md:105-112`

**Issue:** `git branch -r` shows only `origin/main`. All of Phase 06, including
`gsd/phase-06-estoque-migracao`, which Passo 2 needs, lives on one local disk. The pipeline only
triggers on pushes to `main`, so pushing these branches to `origin` would not deploy anything (see
IN-04 for the dispatch caveat).

**Fix:** With the owner's consent, push both branches to `origin` as a backup, and have Passo 2
state that it must run from this clone, or after `git fetch` of the branch.

---

_Reviewed: 2026-09-29T08:35:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
