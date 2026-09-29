---
phase: 06
slug: estoque
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-29
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from the "Validation
> Architecture" section of `06-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (unit) · Playwright ^1.62.1 (e2e) · `scripts/testar-migracoes.mjs` (ephemeral Postgres) |
| **Config file** | `vitest.config.ts` (`include: ["tests/unit/**/*.test.ts"]`), `playwright.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/estoque-*.test.ts` |
| **Full suite command** | `npm run verificar` (lint, tsc, verificar-acoes, unit, test:migracoes) |
| **Estimated runtime** | ~5 s quick · ~3–4 min `verificar` (includes the ephemeral Postgres of `test:migracoes`) |

`npm run test:e2e` costs ~53 s of fixed tax before the first test (Postgres + `next build`). Per
`.claude/CLAUDE.md`: at most ONE invocation per task, always with `--grep` on what the task touched;
the un-grepped full sweep runs ONCE per phase, in the last plan.

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/unit/estoque-*.test.ts` + `npx tsc --noEmit`
- **After every plan wave:** `npm run verificar`
- **Before `/gsd-verify-work`:** `npm run verificar` green + one full `npm run test:e2e` sweep (last plan)
- **Max feedback latency:** ~10 s for the quick run

---

## Per-Task Verification Map

Requirement → test map from the research; the planner assigns Task IDs and waves.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| EST-01 | 5 kg in, 2 kg out → 3 kg | unit + e2e | `npx vitest run tests/unit/estoque-custo.test.ts` | ❌ W0 | ⬜ pending |
| EST-03/04 | "acabando" only with minimum > 0, `saldo <= mínimo` (D-28); negative is its own warning (D-21) | unit | `npx vitest run tests/unit/estoque-saldo.test.ts` | ❌ W0 | ⬜ pending |
| EST-06 | no `update`/`delete` on movements for `amassa_app` | migration | `npm run test:migracoes` | ✅ (add assertion) | ⬜ pending |
| EST-07/08 | adjustment asks the counted balance; zero difference writes nothing; zero accepted as counted (D-32) | unit + e2e | `estoque-saldo.test.ts`; `npm run test:e2e -- --grep "ajuste"` | ❌ W0 | ⬜ pending |
| EST-10 | shown balance = sum of the history | e2e | `npm run test:e2e -- --grep "soma do histórico"` | ❌ | ⬜ pending |
| EST-12 | item area = purchase category first, then sale (D-27) | unit | `estoque-saldo.test.ts` | ❌ | ⬜ pending |
| EST-14 | sale writes in the same transaction; per-line effect = document effect | unit + e2e | `tests/unit/financeiro-efeito-estoque.test.ts` (extend) + `--grep "venda baixa"` | ✅ partial | ⬜ pending |
| EST-15 | purchase enters with the line's cost | e2e | `--grep "compra entra"` | ❌ | ⬜ pending |
| EST-16 | cancelling writes a reversal; one reversal per movement | migration + e2e | `test:migracoes` (unique index) + `--grep "estorno"` | ❌ | ⬜ pending |
| EST-17 | earlier documents create no movement; initial count by difference (D-17) | e2e (`@vazio-global`) | the `vazio-*` project chain | ❌ | ⬜ pending |
| EST-18 | negative balance never blocks a sale | e2e | `--grep "negativo"` | ❌ | ⬜ pending |
| EST-19 | cost of the instant, rules R1–R6, invariants (D-25) | unit (table cases + seeded random sequences) | `estoque-custo.test.ts` | ❌ W0 | ⬜ pending |
| D-23/D-24 | reversal valuation: sale at original cost, purchase at current average | unit | `estoque-custo.test.ts` | ❌ W0 | ⬜ pending |
| Concurrency | two issues of one item; a sale × an adjustment | migration (two connections) or plan-level unit | `test:migracoes` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/estoque-custo.test.ts` — rules R1–R6, the 7 worked cases of the research table, the
      invariants `Q = 0 ⇒ V = 0` and `sinal(V) ∈ {sinal(Q), 0}`, reversal valuation (D-23/D-24)
- [ ] `tests/unit/estoque-saldo.test.ts` — "acabando", negative warning, adjustment, item area, the
      footer "o saldo passa de X para Y"
- [ ] `tests/unit/financeiro-efeito-estoque.test.ts` — extend with the per-line equivalence
- [ ] `scripts/testar-migracoes.mjs` — `TABELAS_ESPERADAS`, `revoke update/delete` on movements, sign
      `check`s, the unique reversal index, `on delete set null` for the encomenda reference
- [ ] `tests/e2e/estoque-*.spec.ts` — tests asserting global database state tagged `@vazio-global`
      (CLAUDE.md: a test may not assert a global condition without isolation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A stock issue on the phone in under 15 s, in 4 taps | EST-09 | Real hand, real phone, in the studio — the project's Core Value | Human-verification walk of the last plan |
| Migration applied in production BEFORE the code (D-33) | EST-14/15 | Migrations are applied by hand by the owner after a backup | The roteiro written by the last plan |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 s for the quick run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
