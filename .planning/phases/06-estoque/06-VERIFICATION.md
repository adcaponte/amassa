---
phase: 06-estoque
verified: 2026-09-29T16:22:17Z
status: passed
score: 30/30 must-haves verified (9 ROADMAP success criteria + 21 requirements EST-01..21)
behavior_unverified: 0
overrides_applied: 0
human_gate:
  status: approved
  by: owner (chat, 2026-09-29 afternoon — "repassei toda verificação. o cowork tambem verificou. Aprovado.")
  independent_evidence: "Claude outputs/estoque/VERIFICACAO-COWORK-06.md (outside git) — 19 steps in production on 2345850, no red"
  resting_only_on_blanket_approval:
    - "SC5 / EST-09 — baixa under 15 s on the phone: no stopwatch time recorded (the e2e proves 4 taps from Saldos, not time)"
    - "EST-09 simultaneous baixa with Andressa, timing part (the concurrency itself is proven by test:migracoes)"
    - "D1 (part) — toast appears above the fixed bar at 320px (Cowork measured scrollWidth=320 only)"
    - "D2 — selector shows EstadoErro + Tentar de novo when the list fails to load"
    - "D4 — R$ 123.456,78 in Para onde foi at 320px"
    - "D5 — −1.234,567 kg quantity column in Histórico at 320px"
    - "D7 — material sheet summary with large values at 320px"
    - "D8 — Gasto por with 8+ products"
    - "D9 — Novo material with no active purchase category"
    - "D10 — contagem first paint under 1 s with 60+ materials"
    - "D11 — contagem row at 320px with Custou ao todo visible"
    - "Extent of the real initial count (Cowork saw 2 of 7 counted at 12:46; later counts not recorded)"
---

# Phase 6: Estoque — Verification Report

**Phase Goal:** Saber o que existe, o que está acabando e para onde o material foi — saldo sempre
derivado das movimentações, nunca uma coluna editável. Rewritten by the ADENDO of 20/09: no
materials table; the Estoque works over `itens_catalogo` + `ficha_tecnica` and turns
`lib/financeiro/efeito-estoque.ts` from showing into recording, in the same transaction as the
document.
**Verified:** 2026-09-29T16:22:17Z
**Status:** passed
**Re-verification:** No — initial verification (no previous `06-VERIFICATION.md`).

## How this was verified

I did not rely on the SUMMARYs. Evidence I gathered myself in this session:

- **Code read directly:** `db/migrations/0023_estoque.sql`, `db/schema.ts` (the ledger section),
  `lib/estoque/{custo,gravacao,pedidos,acoes,consultas,saldo,destinos}.ts`,
  `lib/financeiro/acoes.ts` (`lancarVenda`, `lancarDespesa`, `cancelarDocumento`),
  `components/amassa/inicio/bloco-estoque.tsx`, `components/amassa/financeiro/painel-venda.tsx`,
  and `app/api/health/estoque/route.ts`.
- **`npm run verificar` ran here, on `main` (HEAD `32ebdfd`, code identical to `2345850`), and
  exited 0.** Lint was clean. `tsc` was clean. `verificar-acoes` checked 80 actions with 0
  violations; the two "1 violação" lines in the log are the checker's own self-test fixtures
  (`tests/fixtures/acoes/violando*.ts`). The unit run was **92 files, 1627 tests passed**.
  `test:migracoes` printed "Todas as afirmações passaram.", including `conferirEstoque` and
  `conferirConcorrenciaDoEstoque`.
- **CI on the deployed commit:** `gh run view 36587755269`. The head SHA is `2345850`, the
  conclusion is success, and all 4 jobs passed, including "E2E contra a imagem real". That job
  runs every `tests/e2e/estoque-*.spec.ts` against the production image. I did not run
  `npm run test:e2e`, as instructed.
- **Production, measured now (read-only GETs):**
  - `/api/health/estoque` → 200 `{"status":"ok"}`. This proves the published app can see the
    `0023` structure.
  - `/api/health` → 200.
  - `/gestao/estoque` → 307 to login.
  - `git ls-remote origin main` = `2345850…`. `git log origin/main..main` shows only `32ebdfd`,
    which is docs.
- **D-33 ordering:** the migration-only commit `0848b8c` was published before the code
  (09:34 UTC). It is an ancestor of the merge `2345850` (15:07 UTC).
  `git diff 0848b8c 2345850 -- db/migrations` is empty, so the migration in production is the one
  in `main`.
- **Human evidence:** the owner's approved gate (`06-VERIFICACAO-HUMANA.md`, `status: approved`)
  and the Cowork production walk (`VERIFICACAO-COWORK-06.md`). Items that rest only on the
  owner's blanket approval are listed explicitly below.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg | ✓ VERIFIED | Quantities are integer thousandths (`bigint`). The balance is `sum(quantidade_milesimos)` in `lerSaldos` (`consultas.ts:102-111`). Unit test "caso 1: entrada de 5 kg por R$ 21,00…". e2e `estoque-tracador` and `estoque-material cadastro (a)`, green in CI on `2345850`. Cowork steps 3–4 in production (footer "O saldo passa de 5 para 3 kg"). |
| 2 | Item abaixo do mínimo aparece destacado na lista e no bloco "Estoque acabando" do Início | ✓ VERIFIED | One classifier, `situacaoDoSaldo` (`saldo.ts:61`), with `minimo > 0 && saldo <= minimo`. `BlocoEstoque` reads `listarSaldos` + `itensParaOInicio` and is mounted in `app/gestao/(app)/page.tsx:72`. e2e `estoque-saldos (a)` and `estoque primeira abertura (4)`. Cowork step 5: banner, chip, and the Início line. |
| 3 | O histórico mostra toda movimentação com autor e data | ✓ VERIFIED | `registrado_por` is NOT NULL in `0023`. e2e `estoque-abas (b)`. Cowork step 6: "Hoje, 12:43 · admin" (15:43 UTC, so the time zone is correct). |
| 4 | Não existe nenhuma forma de editar ou apagar uma movimentação pela interface — só registrar um ajuste | ✓ VERIFIED | `revoke update, delete … from amassa_app` in `0023`. `test:migracoes` proves 42501 on both, as the app role, and it ran here. There is no `update(`/`delete(` on `movimentacoesEstoque` anywhere in `lib/`, `app/` or `components/` (grep). The only `insert` is `gravacao.ts:227`. `linha-movimentacao.tsx` has no button, handler or gesture (grep). Cowork steps 7–8. |
| 5 | Registrar uma baixa no celular leva menos de 15 segundos | ✓ VERIFIED (owner gate, **time not recorded**) | e2e `estoque-movimentacao (a)` proves the 4-tap path from Saldos: Dar baixa → +1 → Uso do ateliê → Registrar baixa. Cowork counted 4 taps with a shortcut quantity and 5 for 2 kg. **The under-15 s claim rests only on the owner's blanket approval. No stopwatch time was recorded** (`06-VERIFICACAO-HUMANA.md` §B.5). |
| 6 | O saldo mostrado bate com a soma manual do histórico | ✓ VERIFIED | The balance is a sum over immutable rows, so it cannot diverge by construction. e2e `estoque-material folha (a)(b)` parses the listed quantities to thousandths and compares them to the card, including the negative and single-row cases. Cowork step 6 ("Somando de cima para baixo você chega ao saldo de 3 kg"). |
| 7 | Uma venda lançada no Financeiro baixa o estoque na mesma transação — o item ou, com ficha técnica, cada insumo —, e cancelá-la gera estorno, nunca apaga | ✓ VERIFIED | `lancarVenda` inserts the document lines and then calls `gravarMovimentacoes` inside the same `db.transaction` (`financeiro/acoes.ts:236-271`). `pedidosDaVenda` calls `efeitoNoEstoque` once per line, and no second ficha × quantity calculation exists. `cancelarDocumento` locks the document `FOR UPDATE`, then `originaisSemEstorno` → `pedidosDoEstorno` (mirrors the ledger, never recomputes). The unique `estorno_de_id` index is in place. e2e `estoque-financeiro (a)(b)(f)(g)` and `estoque-abas (c)`. Cowork steps 10, 11 and 13 in production. |
| 8 | A primeira abertura do Estoque conduz a contagem inicial; vendas e compras anteriores não geram movimentação retroativa | ✓ VERIFIED | There is no backfill code; a pre-Estoque document has zero originals, so cancelling it yields zero reversals. e2e `estoque-financeiro (h)`. `estadoDoEstoque` drives the first-open panel; e2e `estoque primeira abertura (1)(2)`. `/gestao/estoque/contagem` exists. Roteiro 15 Passo 5 SQL showed **0 rows** right after migrating. Cowork step 15 (blind count, conference). |
| 9 | Saldo negativo aparece com aviso e nunca impede uma venda | ✓ VERIFIED | There is no `check` on the balance, and there is no balance comparison on the sale path. `podeLancar` in `painel-venda.tsx:437-443` does not look at negative stock. `materiaisQueFicamNegativos` only drives the warning. e2e `estoque-financeiro (a)`, `estoque-saldos (b)`, `estoque-movimentacao (h)`. Cowork step 12 (sale nº 23 launched to −0,5 kg with the warning). |

**Score:** 9/9 success criteria verified, with 0 present-but-behavior-unverified. SC5 is verified
by the owner's gate only; the time was not recorded.

### Requirements Coverage (EST-01..21)

All 21 IDs appear in the plans' `requirements:` frontmatter. The union of 06-01..06-11 covers
EST-01..21, and 06-11 lists all of them. `REQUIREMENTS.md` maps EST-01..21 to Phase 6 and to no
other phase. **No orphaned requirements.**

| Req | Source plans | Status | Evidence (code → test → human) |
|-----|------------|--------|-------------------------------|
| EST-01 | 01, 02, 09, 11 | ✓ SATISFIED | SC1 above |
| EST-02 | 01, 02, 04, 09, 11 | ✓ SATISFIED | There is no `materiais` table, view or saldo column (schema grep; comment at `schema.ts:1359`). `itens_catalogo` gained exactly `estoque_minimo_milesimos`, `observacoes` and `ativo`. "Editar material" edits only the minimum and the notes. |
| EST-03 | 04, 10, 11 | ✓ SATISFIED | SC2 |
| EST-04 | 04, 11 | ✓ SATISFIED | The `minimo > 0` guard in `situacaoDoSaldo`. e2e `estoque-saldos (c)`. Cowork step 1: "sem mínimo", no alert. |
| EST-05 | 07, 11 | ✓ SATISFIED | SC3. The type is shown per row via `descreverMovimentacao`. |
| EST-06 | 01, 02, 07, 11 | ✓ SATISFIED | SC4 |
| EST-07 | 05, 06, 10, 11 | ✓ SATISFIED | `ROTULO_CONTADO = "Quanto tem na prateleira agora?"`. `gravarAjuste` computes the difference under the lock. e2e `estoque-movimentacao (c)(d)`. Cowork step 8. |
| EST-08 | 05, 06, 10, 11 | ✓ SATISFIED | `planejarAjuste` returns "nada", and nothing is inserted. The literal `TOAST_CONFERIDO = "Conferido. O saldo já estava correto."` is used in `folha-movimentacao.tsx`. e2e `estoque-movimentacao (b)`. Cowork step 7. |
| EST-09 | 06, 11 | ✓ SATISFIED (owner gate) | The 4 taps are proven by e2e. **The under-15 s time rests only on the owner's blanket approval**; `REQUIREMENTS.md:137` says so too. |
| EST-10 | 09, 11 | ✓ SATISFIED | SC6 |
| EST-11 | 01, 05, 06, 11 | ✓ SATISFIED | DB enum origin = `venda`, `compra`, `producao`, `manual`. There are five manual destinations in `destinos.ts:31-35`, with no "venda" destination. The encomenda is linked by a real `encomenda_id` chosen from active orders (`encomendaEmAndamento`). The `check` ties destination to manual exits. |
| EST-12 | 04, 11 | ✓ SATISFIED | `areaDoItemNoEstoque`: purchase area, then sale area, then "geral" (`saldo.ts:112-121`). e2e `estoque-saldos (d)(e)`, covering search without accents and the area pill. |
| EST-13 | 08, 09, 11 | ✓ SATISFIED | `criarMaterial` validates with `esquemaItem` from Cadastros (`estoque/acoes.ts:372`). It is the same table, so items created in Cadastros appear on their own. e2e `estoque-material cadastro (a)(f)`. Cowork step 1. |
| EST-14 | 03, 11 | ✓ SATISFIED | SC7. `efeitoNoEstoque` is the only calculation. A unit test proves Σ per line == document aggregate. |
| EST-15 | 03, 11 | ✓ SATISFIED | `lancarDespesa`, in compra mode, calls `pedidosDaCompra` inside the same tx, with `valor_informado_centavos` = the line value. The unit cost is never stored and is displayed as value ÷ qty. e2e `estoque-financeiro (c)(d)`. Cowork saw purchase nº 21 at R$ 2,00/un. |
| EST-16 | 03, 07, 11 | ✓ SATISFIED | SC7. Sale reversal is shown in production (Cowork step 13). Purchase reversal is covered only by e2e `estoque-financeiro (g)`. |
| EST-17 | 03, 10, 11 | ✓ SATISFIED | SC8 |
| EST-18 | 03, 04, 08, 11 | ✓ SATISFIED | SC9 |
| EST-19 | 01, 02, 03, 11 | ✓ SATISFIED | `valorarMovimento` is all-`BigInt`, with a single half-up rounding. It is valued under `for no key update` after the lock, in READ COMMITTED. There is a 500-step invariant walk. `test:migracoes` proves the concurrency with two connections and a 40P01 control on `for update`. |
| EST-20 | 09, 11 | ✓ SATISFIED | "Gasto por" (`historico.ts:417+`) is read-only, with a link to the Catálogo. e2e `estoque-material folha (c)`. Cowork step 10 (one product only). |
| EST-21 | 05, 06, 11 | ✓ SATISFIED | `itemTemFichaDePrecificacao` decides `peca_pronta` on the server, and cost 0 is refused for it (`estoque/acoes.ts:122-135`). The cost comes pre-filled from `calcularPeca`. Covered only by e2e `estoque-movimentacao (g)` and unit tests; the Cowork walk did not exercise it. The "Produção da casa" seed (D-29) is in `0023` and was counted as 1 in production SQL. |

### Owner rulings of 29/09 — applied in code, not only in documents

| Ruling | Where in code | Pinned by test |
|---|---|---|
| D-23: a sale reversal with Q > 0 returns the value the sale took | `custo.ts` R7, `q > ZERO` branch | `estoque-custo` "D-23…", "caso 6…" |
| D-23a / WR-01: with Q ≤ 0 it returns at the current rate (like R6); R1 still goes first | `custo.ts` R7 else branch | four "WR-01 decidido pelo dono…" tests |
| WR-02: a sale reversal never becomes "última entrada com preço" | `valorarMovimento` only updates it on `entrada_com_preco`, and `isNull(estornoDeId)` is applied in both `lerEstados` (`gravacao.ts:161`) and `lerSaldos` (`consultas.ts:126`) | two "WR-02 decidido pelo dono…" tests |
| D-24: a purchase reversal goes out at the current average | `movimentoDoEstorno` → `saida` | "D-24…" tests and e2e `estoque-financeiro (g)` |
| D-29: "Produção da casa" is seeded | `0023` block (3), idempotent `where not exists` | `test:migracoes` (25 categories; reapply stays at 1) |

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `db/migrations/0023_estoque.sql` | ✓ VERIFIED | Ledger table, 17 checks, revoke, unit-lock trigger, unique reversal index and the seed. Applied in production: Passo 5 SQL and health 200 now. |
| `lib/estoque/custo.ts` | ✓ VERIFIED | Pure (no imports). R1–R7. |
| `lib/estoque/gravacao.ts` | ✓ VERIFIED | The single write port, with no `"use server"`. Lock → read → value → insert. |
| `lib/estoque/pedidos.ts` | ✓ VERIFIED | Pure. Wraps `efeitoNoEstoque` per line. Reversal mirrors the ledger. |
| `lib/estoque/acoes.ts` | ✓ VERIFIED | Every export starts with `exigirUsuario()` and validates with Zod `safeParse`. Area, value, difference, mode and `peca_pronta` are decided on the server. |
| `lib/estoque/consultas.ts` | ✓ VERIFIED | `listarSaldos` reads `SUM` over the ledger: real data, not static. |
| `lib/estoque/{saldo,contagem,historico,destinos,esquemas,textos,abas}.ts` | ✓ VERIFIED | Pure rule modules with unit tests. |
| `app/gestao/(app)/estoque/{page,loading,error}.tsx`, `…/contagem/{page,loading,error}.tsx` | ✓ VERIFIED | The loading and error states exist, as the "Estados" rule requires. |
| `components/amassa/estoque/*` (30 files) | ✓ VERIFIED | Wired through `ProvedorDoEstoque`; exercised by 8 e2e specs green in CI. |
| `components/amassa/inicio/bloco-estoque.tsx` | ✓ VERIFIED | Mounted in the Início. It has its own try/catch → `EstadoErro`, and a "never counted" state. |
| `app/api/health/estoque/route.ts` | ✓ VERIFIED | Public. Returns 200 `{status:"ok"}` in production now. |
| `docs/operacao/15-migracao-estoque.md` | ✓ VERIFIED | Executed by the owner; the outputs are recorded in the 06-11 SUMMARY. |
| `scripts/testar-migracoes.mjs` `TABELAS_ESPERADAS` | ✓ VERIFIED | Includes `movimentacoes_estoque`; the migration test passed here. |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `lancarVenda` | `gravarMovimentacoes` | same `db.transaction`, after the `documento_linhas` insert with `returning` | ✓ WIRED |
| `lancarDespesa` (compra mode) | `gravarMovimentacoes` | same tx, one entry per line | ✓ WIRED |
| `cancelarDocumento` | `originaisSemEstorno` → `pedidosDoEstorno` → `gravarMovimentacoes` | document `FOR UPDATE` first, then items (no lock cycle) | ✓ WIRED |
| `pedidosDaVenda`/`pedidosDaCompra` | `lib/financeiro/efeito-estoque.ts::efeitoNoEstoque` | import; called per line | ✓ WIRED |
| `gravarMovimentacoes` | `custo.ts::valorarMovimento` | sequential valuation of the state read under `for no key update` | ✓ WIRED |
| `BlocoEstoque` (Início) | `listarSaldos` + `estadoDoEstoque` | the same query as the Saldos tab | ✓ WIRED |
| Financeiro page | `listarSaldos` → `PainelVenda` `saldos` | try/catch; on failure the panel is unchanged | ✓ WIRED |
| `criarMaterial` | `esquemaItem` (Cadastros) | the same validation factory | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| Saldos tab, cards and table | `saldoMilesimos`, `valorCentavos` | `lerSaldos`: `sum()` over `movimentacoes_estoque` | Yes (Cowork saw live values) | ✓ FLOWING |
| Início "Estoque acabando" | `itensParaOInicio(saldos)` | `listarSaldos` | Yes (Cowork step 5) | ✓ FLOWING |
| Venda "fica com" | `saldos` map | `listarSaldos` on the Financeiro page | Yes (Cowork steps 11–12) | ✓ FLOWING |
| Histórico / material sheet | ledger rows | `consultas.ts` ledger reads with `numero desc` | Yes (Cowork steps 6, 8, 13) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Lint, types, action authorization, unit rules, migrations and DB concurrency/immutability | `npm run verificar` | exit 0; 1627 unit tests; "Todas as afirmações passaram." | ✓ PASS |
| e2e of all Estoque specs against the real image | `gh run view 36587755269` (SHA `2345850`) | success; job "E2E contra a imagem real" success | ✓ PASS |
| Published app sees migration 0023 | `curl https://amassacerrado.com.br/api/health/estoque` | 200 `{"status":"ok"}` | ✓ PASS |
| `/gestao/estoque` is behind auth | `curl` | 307 to `/gestao/login` | ✓ PASS |

### Probe Execution

Step 7c is not applicable. The phase declares no `scripts/*/tests/probe-*.sh`; its operational
check is `/api/health/estoque`, which I measured above.

### Prohibitions (must-NOT)

- **Test-tier, all with wired enforcement:**
  - No saldo column: schema grep.
  - Ledger never updated or deleted: revoke + `test:migracoes` 42501 + grep.
  - D-23/D-24 live only in `movimentoDoEstorno` and R7.
  - Negative stock never blocks a sale: `podeLancar` + e2e.
  - Reversals never recompute from today's ficha: `pedidosDoEstorno` mirrors rows.
  - No "frente" in the UI: the only grep hits are code comments.
  - No catalog item deleted: `revoke delete` from 0015 is kept; `definirItemAtivo` only.
  - The count never shows the balance first: e2e and Cowork step 15.
  - No count draft: the table does not exist.
  - The health route never leaks data: `{status}` only, plus IN-03 below.
- **Judgment-tier, resolved with evidence:**
  - No executor push before the migration: `0848b8c` was published at 09:34 UTC, before the
    merge `2345850` at 15:07 UTC, and both pushes were done by the owner.
  - No real or prototype data: grep for the prototype names returns nothing; the Cowork test data
    is prefixed `[teste cowork]` and deactivated.
  - No retroactive movements: Passo 5 SQL showed 0 rows after migrating.
  - D-23/D-24 were confirmed by the owner before any server step (Parte 0, morning of 29/09).
  - Requirements were marked `[x]` only after the gate (commit `32ebdfd`, after approval).
  - Historical lines were preserved: dated annotations are used throughout ROADMAP and
    REQUIREMENTS.

None of these is flagged or unverified.

### Anti-Patterns Found

I scanned 70 phase-modified `lib`, `app`, `components`, `db` and `scripts` files. There are **no
`TBD`, `FIXME` or `XXX` markers.** The `TODO`/`placeholder` hits are the Portuguese word "TODOS"
("all") and HTML input `placeholder` attributes.

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `lib/estoque/gravacao.ts` + `consultas.ts` vs `custo.ts` | 148-164 / 114-128 | A purchase line with value 0 is written as `entrada_sem_preco` (the pure function does not treat it as "última entrada com preço"). The two queries still read it as one at R$ 0,00, because `valor_informado_centavos = 0`. | ℹ️ Info | Pure and DB disagree only for a zero-value purchase line. It is known and recorded ("Registrado, não corrigido" in 06-11-SUMMARY; STATE.md Pending Todos line ~1343; Cowork obs. 5). It does not affect any EST requirement on the normal path. |
| `app/api/health/estoque/route.ts` | 37-43 | The 503 body names "migração 0023" (IN-03) | ℹ️ Info | A minor disclosure on a public route. It is open in 06-REVIEW and listed in STATE.md. |
| `db/migrations/0023_estoque.sql` | 84-90 | No explicit `grant select, insert` (IN-01) | ℹ️ Info | It relies on 0003's default privileges. Production SQL confirmed `insert = t`, so there is no current impact. |
| `lib/cadastros/acoes.ts` / `lib/financeiro/acoes.ts` | — | IN-05 (`FOR UPDATE` in `definirItemAtivo`); IN-06 (`ativo` checked outside the tx) | ℹ️ Info | Rare races at the atelier's volume; documented in 06-REVIEW. |

The 06-REVIEW warnings are all resolved:
- WR-01 and WR-02: resolved by the owner's ruling and implemented in `f05c373`, as verified above.
- WR-03: fixed in `68bacb0`. `conferirSaldoDoCusto` is present in `gravarContagem`, and the fix
  is covered by e2e `estoque contagem (f)`.
- WR-04: fixed in `9460e8f` (roteiro).
- WR-05: fixed in `f9216d1`.

### Human Verification

**No pending items.** The phase's human gate (`06-VERIFICACAO-HUMANA.md`) is `status: approved` by
the owner (chat, 29/09 afternoon). An independent production walk by Cowork (19 steps on
`2345850`, no red) backs it for SC 1, 2, 3, 4, 6, 7, 8 and 9.

To be explicit, these items rest **only on the owner's blanket approval**. They have no per-item
note, no measurement and no Cowork coverage:

1. **SC5 / EST-09: under 15 s.** No stopwatch time was recorded, for either Saldos or Início.
   Automated evidence covers the 4-tap path only.
2. **EST-09 simultaneous baixa with Andressa.** The concurrency correctness is proven by
   `test:migracoes`, but the timing and two-name outcome on real phones rests on the approval.
3. **D1, the toast part.** Cowork measured `scrollWidth = 320`, but not that the toast sits above
   the fixed bar.
4. **D2:** the selector's error state when the list fails.
5. **D4:** a large value in "Para onde foi" at 320px.
6. **D5:** a long quantity in the Histórico at 320px.
7. **D7:** the material sheet summary at 320px.
8. **D8:** "Gasto por" with 8+ products (Cowork saw one).
9. **D9:** "+ Novo material" with no active purchase category.
10. **D10:** the contagem first paint under 1 s with 60+ materials (production has about 7).
11. **D11:** the contagem row at 320px with "Custou ao todo".
12. **Extent of the real initial count.** Cowork saw "2 de 7 contados hoje" at 12:46; whether the
    other 5 were counted later is not recorded.

Some of the phase's backstops are also covered by automation:
- D3 (160-letter link text): e2e `estoque-abas (h)`, 320px, no horizontal scroll.
- D6 (the Venda effect line with a long name at 320px): e2e in `financeiro-venda.spec.ts:888-942`.
- Reactivation: e2e `estoque-material cadastro (d)`.

I did not re-open these as `human_needed` because the owner's gate already covers them by
approval. If the owner wants the record to hold measured evidence, the cheapest follow-up is two
stopwatch times for EST-09 in STATE.md. Every other item above is visual or layout only and
cannot corrupt data.

### Deferred Items

None. No gap needed deferral.

### Gaps Summary

**No gaps.** Every ROADMAP success criterion and every EST-01..21 requirement has code that
exists, is substantive, is wired, and carries real data:
- The ledger is the only source of the balance, and the database keeps it immutable.
- Sale, purchase and cancellation write stock inside the document's own transaction.
- `efeitoNoEstoque` is the single calculation.
- The owner's 29/09 money rulings (D-23/D-23a/WR-02/D-24) are implemented and pinned by tests.
- The phase is live in production: `2345850`, CI green including e2e, and
  `/api/health/estoque` 200 measured just now.

The one honest caveat is evidentiary, not functional. The "under 15 seconds" criterion (SC5/EST-09)
and the 320px, error and scale backstops listed above rest on the owner's blanket approval with no
recorded measurement. Four ℹ️ Info items remain open and tracked, and none of them blocks the
goal.

---

_Verified: 2026-09-29T16:22:17Z_
_Verifier: Claude (gsd-verifier)_
