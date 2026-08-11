---
phase: 04-contador-de-queima
verified: 2026-08-11T22:15:00Z
status: human_needed
score: 9/9 must-haves verified (roadmap success criteria), 0 failed, 2 residual human-verification items
behavior_unverified: 0
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Backstop E3 (UI-SPEC, FOR-01) — nenhum indicador de carregamento entre os dois toques"
    expected: "No celular, tocar 'Queimar' abre o seletor de tipo IMEDIATAMENTE (troca de estado local síncrona) e nenhum spinner/skeleton aparece entre o primeiro e o segundo toque; o fluxo inteiro fecha em menos de 5s."
    why_human: "Declarado 'verification: backstop' desde o planejamento (04-UI-SPEC.md) porque nenhum teste automatizado consegue provar a AUSÊNCIA de uma janela de carregamento visual — só uma pessoa olhando a tela em tempo real pode confirmar. Revisão de código (registrar-queima.tsx) mostra que a abertura do seletor é um `setState` local síncrono sem chamada de rede, o que é consistente com 'sem carregamento', mas isso é evidência estrutural, não uma observação visual. Nunca verificado por ninguém — não está no UAT (17 testes) nem tem item correspondente em WINDOWS.md. É o único dos três backstops do UI-SPEC que ficou genuinamente sem prova de nenhum tipo."
  - test: "Percorrer 04-VERIFICACAO-HUMANA.md item a item e fechar formalmente"
    expected: "Os 26 itens do documento (9 critérios do ROADMAP, 3 backstops do UI-SPEC, 14 herdados) marcados com resultado escrito, e as entradas correspondentes de WINDOWS.md (ids 15, 16, 17, 18, 19, 20) movidas para 'fixed' com `gsd-tools windows fixed <id>`."
    why_human: "O UAT de 17 testes (16 pass / 1 issue) cobre substancialmente o mesmo terreno de ~17-19 dos 26 itens deste documento (mapeamento detalhado abaixo), mas o documento em si continua com literalmente 0/26 caixas marcadas — o próprio 04-07-SUMMARY.md declara 'a Fase 4 NÃO está fechada' e que este documento 'é o portão' que falta. Fechar formalmente (marcar os itens cobertos, escrever o resultado dos poucos que restam sem cobertura — principalmente o Backstop E3 acima) é trabalho humano de poucos minutos, não uma reexecução de teste."
gaps: []
deferred: []
---

# Phase 4: Contador de Queima Verification Report

**Phase Goal:** Controlar a vida útil das resistências dos fornos — saber quantas queimas cada um
acumulou desde a última manutenção, e ser avisado antes de estourar.
**Verified:** 2026-08-11T22:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary

I read all seven plans' SUMMARYs, the phase's UAT session, the unwalked 26-item human checklist,
the UI-SPEC's declared backstops, WINDOWS.md, and the CONTEXT's locked decisions — then verified
independently against the actual code and by running commands, not by trusting what the SUMMARYs
claimed. Findings:

- **The nine ROADMAP success criteria all hold**, backed by a combination of code inspection,
  passing automated tests I ran myself, and the UAT session's human results.
- **All 13 FOR-01..FOR-13 requirements are genuinely implemented**, not just checked off in
  REQUIREMENTS.md — I traced each to working code and a passing test.
- **The eight locked decisions (D-01..D-08) are honored in the shipped code**, verified by reading
  the actual components/actions, not the SUMMARYs' descriptions of them.
- **CLAUDE.md's non-negotiables hold across the Fornos module**, verified with `verificar-acoes`
  (16/16 Server Actions in the whole project, 0 violations — not just Fornos'), `tsc --noEmit`,
  `lint`, and direct code reading of the pure modules.
- **One real, confirmed defect exists (G-04-5 / WINDOWS id 23)** — a missing error boundary above
  `app/(app)/layout.tsx` that lets any `exigirUsuario()` database failure surface as Next.js's raw
  "Application error" screen. I confirmed `app/error.tsx` and `app/global-error.tsx` do not exist.
  This is correctly scoped to Phase 2b (the layout is Phase 2b's file, and the defect affects every
  authenticated route, not just Fornos) and the owner has explicitly, on record, decided to fix it
  as separate work outside Phase 4. I agree with that scoping and do **not** treat it as a Phase-4
  blocker — but it remains open in WINDOWS.md and is worth flagging loudly here so it doesn't get
  lost.
- **Two genuine residual gaps remain in the phase's OWN verification process** (not in the product):
  the E3 UI-SPEC backstop (no loading affordance between the two taps) was never checked by anyone,
  human or automated, and `04-VERIFICACAO-HUMANA.md` still has 0/26 items formally marked despite
  the UAT session having covered most of the same ground. Neither of these indicates the product is
  broken — my own code reading and test runs give me reasonable confidence the underlying behavior
  is correct — but they are exactly the kind of "unresolvable by an agent" gap this workflow exists
  to surface rather than paper over.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Registrar uma queima leva dois toques e menos de 5 segundos no celular | ✓ VERIFIED | `tests/e2e/queimas-registro.spec.ts` — I ran `npm run test:e2e -- --grep "registro de queima" --workers=1` myself: 16/16 pass on both desktop and celular, including the toast-under-5s assertion. Code (`registrar-queima.tsx`) confirms exactly two taps, no form. **But see human_verification**: the finer claim that *no loading indicator appears between the two taps* (UI-SPEC Backstop E3) was never checked by a human or a dedicated test — only inferred from the fact that opening the type selector is a synchronous local `setState`, not a network call. |
| 2 | O aviso com "Desfazer", por 7 segundos, remove a queima registrada por engano | ✓ VERIFIED | Same e2e run: "'Desfazer' remove a queima recém-registrada e o contador volta ao valor anterior, também depois de recarregar" — pass, both projects. `registrar-queima.tsx` confirms `duration: 7000` (the one 7s exception to the project's 5s default) and calls the same `excluirQueima` action. |
| 3 | Os três tipos aparecem: biscoito, esmalte e ouro | ✓ VERIFIED | `TIPOS_EM_ORDEM` in `registrar-queima.tsx` is a fixed array `["biscoito", "esmalte", "ouro"]`, rendered unconditionally (no gate). `tipoQueima` Postgres enum has exactly these three values (`db/schema.ts:207`). UAT test 2 ("Os três tipos de queima") — human registered a queima of type **ouro** specifically and confirmed it behaves like the others — result: pass. |
| 4 | Chegando a 90 de 100 o cartão fica em atenção; em 100, crítico | ✓ VERIFIED | `lib/queimas/contador.ts#medirForno` — 13 unit tests covering 89/90/99/100/101 boundaries, `Math.max(1, limite-10)` floor. e2e (`queimas-cartao.spec.ts`) proves the three tiers on a live card. UAT test 4 ("O medidor lê como instrumento") — human confirmed the two selos appear at the right points and the tick marks read as a wear gauge, not a plain bar — pass. |
| 5 | O banner no topo lista os fornos que precisam de atenção, com o contador de cada um | ✓ VERIFIED | `lib/queimas/filtros.ts#ordenarParaBanner` (20 unit tests: critical-before-attention ordering, truncation at 3 + "e mais N", singular/plural). `tests/e2e/queimas-banner.spec.ts` proves it on a live index page across three distinct scenarios. |
| 6 | Registrar manutenção mostra "o contador vai de N para 0", aceita responsável e observações opcionais, e zera sem apagar o histórico | ✓ VERIFIED | `lib/queimas/acoes.ts#registrarManutencao` — read the code directly: it runs inside `db.transaction` with `select ... for update`, contains **only** an `insert` into `manutencoes`, never a `delete`/`update` on `queimas`. e2e (`queimas-manutencao.spec.ts`) proves the exact phrase, empty-submission acceptance, and that the queima history count is unchanged before/after. UAT test 9 (registered manutenção twice in a row) — pass. |
| 7 | O cartão mostra quantas queimas o forno já fez na vida, além do contador desde a última manutenção | ✓ VERIFIED | `fraseDoRodape` (unit-tested, 3 forms) always appends "· {total} no total"; `medirForno` returns both `contador` and `total` from the same raw data, decided in one place, never duplicated in SQL. e2e confirms both numbers render together. |
| 8 | Os gráficos batem com a contagem manual do histórico, alternam entre 8 semanas e 6 meses, e a semana começa na segunda | ✓ VERIFIED | `lib/queimas/relatorios.ts` — 26 unit tests, including the literal case of a queima at 23:30 Sunday in Brasília falling into the *previous* week (the timezone trap the phase's own CONTEXT flags as the central risk), the half-open bucket boundary on both ends, year-boundary month aggregation, and the bucket sums matching manual counts exactly. e2e (`queimas-relatorios.spec.ts`) proves the four top stats match what the test itself registered, and that switching Semana/Mês never changes them. No human literally cross-checked the graphs against a real forno's history by hand (the UAT's closest test, #15, checks mobile layout, not the numeric cross-check) — given the exhaustiveness of the unit-test coverage on exactly this logic, I judge residual risk here to be low, not a genuine open question. |
| 9 | Um forno em atenção ou crítico aparece no painel inicial | ✓ VERIFIED | `fornosQuePrecisamDeAtencao()` + `app/(app)/page.tsx` (`try/catch` local to the card block, confirmed by reading the code — a failure here never takes down the other three panel cards). e2e proves a critical forno appears on `/` with the right count and a working "Ver fornos" link. UAT test 13 (forced failure via renamed table) — the card shows `EstadoErro`, others stay up — pass. |

**Score:** 9/9 truths verified at the literal roadmap wording. 0 failed. 2 items still need a human
look before the phase's own designated closing gate (`04-VERIFICACAO-HUMANA.md`) can be marked
complete — see Human Verification Required below.

### Requirements Coverage (FOR-01..FOR-13)

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| FOR-01 | Dois toques, <5s | ✓ SATISFIED | Code + e2e (self-run) + UAT |
| FOR-02 | Desfazer 7s | ✓ SATISFIED | Code + e2e (self-run) |
| FOR-03 | Três tipos, incl. ouro | ✓ SATISFIED | Code + UAT test 2 |
| FOR-04 | 90/100 atenção/crítico + selos | ✓ SATISFIED | Unit + e2e + UAT test 4 |
| FOR-05 | Medidor com entalhes, marca, rótulos | ✓ SATISFIED | Code (`medidor.tsx`) + e2e text assertions + UAT test 4 (visual read as instrument) |
| FOR-06 | Banner agregado | ✓ SATISFIED | Unit + e2e |
| FOR-07 | Manutenção "N→0", zera sem apagar | ✓ SATISFIED | Code (transaction, no delete on `queimas`) + e2e + UAT test 9 |
| FOR-08 | Cartão mostra total na vida + contador | ✓ SATISFIED | Unit + e2e |
| FOR-09 | Detalhe do forno: histórico de manutenções + últimas 25 queimas | ✓ SATISFIED | Code (`buscarForno`, `.limit(25)`) + e2e (`queimas-detalhe.spec.ts`, covers 0/1/few states) |
| FOR-10 | Excluir queima do histórico pede confirmação | ✓ SATISFIED | `confirmar-excluir-queima.tsx` (AlertDialog, destructive) + e2e (4 cases) |
| FOR-11 | Fornos cadastrados/desativados, nunca excluídos | ✓ SATISFIED | Grepped the entire codebase for `delete(fornos` — **zero occurrences**. `desativarForno`/`reativarForno` filter `WHERE` by the opposite value of `ativo` (confirmed reading `acoes.ts`). e2e proves the full cycle. |
| FOR-12 | Gráficos batem com contagem manual, 8sem/6mes, semana começa segunda | ✓ SATISFIED | 26 unit tests + e2e delta proof |
| FOR-13 | `registrado_por` sempre do usuário logado | ✓ SATISFIED | `esquemaQueima` has no `registradoPor` field; `acoes.ts` sets it from `usuarioAtual.id`, never from client input. UAT test 3 confirms the name shown matches the logged-in user. |

All 13 requirements are marked `[x]` in `.planning/REQUIREMENTS.md` and I confirm each is backed
by real, working code — not a checkbox-only claim.

### Locked Decisions (D-01..D-08, `04-CONTEXT.md`)

| Decision | Status | Evidence |
|---|---|---|
| D-01: real routes with a fake-tab selector | ✓ HONORED | `seletor-queimas.tsx` uses `Link` + `aria-current`, mounted on all three Fornos routes; e2e proves back-button works |
| D-02: no dedicated forno registration screen | ✓ HONORED | `criarForno` only reachable via the empty-state/`?novo` button; edit/deactivate live on the forno's own page |
| D-03: single "Queimar" button on the index card, nothing competes | ✓ HONORED | Read `cartao-forno.tsx` directly — the only interactive control rendered is `<RegistrarQueima>`. No "Registrar manutenção" anywhere near the card. |
| D-04: queima written at the instant of the tap, never optimistic | ✓ HONORED | Read `registrar-queima.tsx` directly — `router.refresh()` and the success toast both fire only **after** `await registrarQueima(...)` resolves `ok: true`. Nothing changes on screen before the server confirms. |
| D-05: filter Ativos/Desativados/Todos on the index itself, dimmed inactive card | ✓ HONORED | `filtro-fornos.tsx`, `lista-fornos.tsx`; `cartao-forno.tsx` applies `opacity-75` and omits the button when `!forno.ativo` |
| D-06: reactivate from the forno's own page, counter resumes exactly | ✓ HONORED | `reativarForno` never touches `queimas`/`manutencoes`; e2e proves the counter is identical before deactivation and after reactivation |
| D-07: mobile stats-first, charts scroll within their own container | ✓ HONORED | `relatorios-recharts.tsx` uses fixed-pixel-width charts inside `overflow-x-auto` (not `ResponsiveContainer` alone); e2e proves the document itself never scrolls horizontally; UAT test 15 confirms visually |
| D-08: empty state for `/queimas/relatorios` when no queima exists, "Relatórios" tab stays visible | ✓ HONORED | Code + e2e (`estado vazio` branch) + UAT test 16 |

### CLAUDE.md Non-Negotiables

| Rule | Status | Evidence |
|---|---|---|
| Every Server Action starts with `exigirUsuario()` | ✓ VERIFIED | `npm run verificar-acoes` — I ran it myself: **16/16 ações conferidas, 0 violações**, project-wide (not just Fornos). Read all 6 Fornos actions in `acoes.ts` directly — every one calls `exigirUsuario()` (or `await exigirUsuario()`) as the literal first statement. |
| Zod on the server | ✓ VERIFIED | Every write path in `acoes.ts` calls `.safeParse` before touching the database; `registradoPor`/`queimasAcumuladas` are deliberately absent from the client-facing schemas. |
| Business rules in pure modules, no React/DB imports | ✓ VERIFIED | Read `lib/queimas/contador.ts` and `lib/queimas/formato.ts` directly — literally zero imports in either file (confirmed by the file headers and content), "hoje" always received as an argument, never read from the clock internally except in the one documented case (`hojeEmBrasilia`, which takes `Date` as a parameter). Same pattern holds for `filtros.ts`/`relatorios.ts` per the SUMMARYs' documented zero-import discipline (spot-checked). |
| pt-BR copy | ✓ VERIFIED | All user-facing strings I read (`textos.ts`, component JSX) are Portuguese. |
| `America/Sao_Paulo` fixed | ✓ VERIFIED | `formato.ts` uses `Intl.DateTimeFormat` with `timeZone: "America/Sao_Paulo"` throughout; `relatorios.ts` (per its documented tests) proves the Sunday-23:30 boundary case explicitly. |
| Empty/loading/error states on every screen | ⚠ MOSTLY VERIFIED, one confirmed gap | `loading.tsx`/`error.tsx` exist for all three Fornos routes and I confirmed their logic reads correctly. **However**, I independently confirmed `app/error.tsx` and `app/global-error.tsx` do not exist in the repo — so a failure inside `exigirUsuario()` at the shared `app/(app)/layout.tsx` level (which runs before any page-level `error.tsx` can catch it) surfaces Next.js's raw error screen, not the project's humane error copy. This is real (I verified the files are absent), pre-existing to Phase 2b, affects every authenticated route (not Fornos-specific), and the owner has explicitly decided — on record, in the UAT gap log — to fix it as separate work outside Phase 4. I agree with not blocking Phase 4 on it, but it should not be forgotten (WINDOWS.md id 23, still `open`). |

### Requirements/Artifact Sanity Checks I Ran Myself

- `npx tsc --noEmit` — clean.
- `npm run lint` (`--max-warnings=0`) — clean.
- `npm run verificar-acoes` — 16/16 Server Actions, 0 violations.
- `npx vitest run` on all six Fornos unit-test files — **90/90 pass**.
- `npm run test:e2e -- --grep "registro de queima"` — first run hit a stray `next dev` process on
  port 3000 (the exact same known failure mode documented in `04-01-SUMMARY.md`); killed it and
  reran under `--workers=1` — **16/16 pass**, including the core two-tap and Desfazer flows on both
  desktop and celular. (Under default worker concurrency one test flaked with a timeout waiting on
  the "Desfazer" button — this matches the shared-Next-server contention pattern the phase's own
  SUMMARYs document extensively for this exact test file; it is not a logic defect.)
- Grepped for `delete(fornos` project-wide — zero matches, confirming FOR-11's "never excluded"
  claim in code, not just by absence of a button in the UI.
- Read `db/schema.ts` and `db/migrations/0008_gatilhos-queimas.sql` directly — `tipo_queima` enum
  has exactly `biscoito`/`esmalte`/`ouro`; the three `tocar_atualizado_em_*` triggers for
  `fornos`/`queimas`/`manutencoes` exist in the migration file (production application itself was
  not independently re-verified by me — I rely on the SUMMARY's documented `pg_trigger` query
  evidence, which is a reasonable, specific claim, not a vague "it worked" report).
- Confirmed `scripts/testar-migracoes.mjs`'s `TABELAS_ESPERADAS` includes `fornos`, `queimas`,
  `manutencoes`.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`PLACEHOLDER` markers found in the Fornos module files I read.
No stub returns, no hardcoded empty arrays feeding real UI, no optimistic-then-silently-wrong state.

## UAT / Human-Checklist Overlap Analysis

The phase produced two human-facing artifacts: `04-UAT.md` (17 conversational checks, 16 pass / 1
issue, completed) and `04-VERIFICACAO-HUMANA.md` (26-item checklist, produced but **literally 0/26
boxes checked**). I do not treat the unwalked checklist as satisfied — per the task instructions —
but the actual ground it covers overlaps substantially with the UAT session that DID happen. Mapping
UAT tests to `04-VERIFICACAO-HUMANA.md` items:

| VERIFICACAO-HUMANA item | Covered by UAT test | Result |
|---|---|---|
| Seção A #3 (três tipos incl. ouro) | UAT #2 | pass |
| Seção A #4 (90/100 selos + entalhes) | UAT #4 | pass |
| Seção A #9 (forno em atenção no painel) | UAT #13 | pass (via forced-failure variant) |
| Seção B Backstop B / E5 (banner nomes longos) | UAT #14 | pass |
| Seção C "posição visual do medidor" (WINDOWS #15) | UAT #4 | pass |
| Seção C "error.tsx disparando de verdade" (WINDOWS #16) | UAT #5 (note) | confirmed working in isolation, surfaced the bigger G-04-5 gap instead |
| Seção C "ramo de erro do painel" (WINDOWS #17) | UAT #13 | pass |
| Seção C "D-08 vazio de relatórios" (WINDOWS #19) | UAT #16 | pass |
| Seção C "D-07 ordem mobile" (WINDOWS #20) | UAT #15 | pass |
| Seção C "tipo ouro nunca exercitado" | UAT #2 | pass |
| Seção C "nome do autor no histórico" | UAT #3 | pass |
| Seção C "duas queimas mesmo instante" | UAT #6 | pass |
| Seção C "endereço de forno inexistente" | UAT #7 | pass |
| Seção C "duas exclusões simultâneas" | UAT #8 (close proxy — sequential, not truly concurrent) | pass |
| Seção C "clique duplo confirmar manutenção" | UAT #9 | pass |
| Seção C "editar forno ponta a ponta" | UAT #10 | pass |
| Seção C "contraste cartão esmaecido" | UAT #11 | pass |
| Seção C "desativar já desativado" | UAT #12 | pass |

**~18 of the 26 items** have a UAT result standing in for them, all passing (one, "error.tsx
disparando de verdade", surfaced the bigger G-04-5 finding rather than closing cleanly). The items
with **no UAT coverage at all**:

- **Backstop A / E3** (no loading affordance between the two taps) — genuinely never checked. See
  Human Verification Required.
- Seção A #1's literal stopwatch instruction, #2's literal "watch it disappear" instruction, #5's
  literal banner-reading instruction, #6/#7's literal reading instructions, #8's literal manual
  count against a real forno's history — these all rest on strong automated proof (unit + e2e) I
  independently re-ran, so I judge the residual risk as low, but the document's own instructions
  ("percorra... no celular de verdade") were not literally followed by a human for these specific
  items.

**WINDOWS.md ids 15, 16, 17, 18, 19, 20 are all still marked `open`** despite the UAT session
providing passing evidence for every one of them. This looks like a bookkeeping step that was
never done after the UAT session closed, not a functional problem — flagged as a human-verification
item above (close them with `gsd-tools windows fixed <id>`, referencing the corresponding UAT test).

## Human Verification Required

### 1. Backstop E3 — nenhum indicador de carregamento entre os dois toques (FOR-01)

**Test:** No celular, com `/queimas` aberta, toque "Queimar" em qualquer cartão e observe
atentamente a fração de segundo entre o primeiro e o segundo toque. Repita 2-3 vezes.
**Expected:** Nenhum spinner/skeleton/"carregando..." visível em nenhuma repetição; o fluxo inteiro
(do primeiro toque ao toast) fica abaixo de 5 segundos.
**Why human:** Declarado `verification: backstop` desde o planejamento (`04-UI-SPEC.md`) — nenhum
teste automatizado consegue provar a AUSÊNCIA de uma janela de carregamento visual. Código
(`registrar-queima.tsx`) mostra que abrir o seletor é um `setState` local síncrono, consistente com
"sem carregamento" — mas isso é inferência de código, não observação. Nunca verificado por ninguém.

### 2. Fechamento formal de `04-VERIFICACAO-HUMANA.md`

**Test:** Percorrer os 26 itens do documento; para os ~18 já cobertos pelo UAT (ver tabela acima),
copiar o resultado; para o item restante sem cobertura (Backstop E3, acima), verificar de fato.
**Expected:** Documento com 26/26 itens marcados e com resultado escrito; entradas WINDOWS.md ids
15, 16, 17, 18, 19, 20 movidas para `fixed`.
**Why human:** É o próprio portão que `04-07-SUMMARY.md` declara como faltante para a fase fechar
("Só então a Fase 4 pode ser considerada tecnicamente fechada"). É trabalho de minutos dado que a
maior parte já tem evidência — não uma reexecução de verificação do zero.

## Gaps Summary

No blocking gaps found in Phase 4's own deliverables. Every ROADMAP success criterion, every FOR
requirement, every locked decision, and every CLAUDE.md non-negotiable I checked holds up against
the actual code and against tests I ran myself (not just the SUMMARYs' claims). The phase goal —
controlling forno resistance lifespan with a two-tap burn log and threshold warnings — is
substantively achieved.

What keeps this from a clean `passed`: the phase's own designated human closing gate
(`04-VERIFICACAO-HUMANA.md`) has not been formally walked (0/26, despite a UAT session covering
most of the same ground), and one UI-SPEC backstop (E3, no loading flash between taps) has never
been checked by anyone in any form. Neither indicates a defect I found — they indicate work the
phase itself flagged as needing a human that hasn't happened yet. The one confirmed defect
(G-04-5 / WINDOWS #23, missing root error boundary) is real, correctly diagnosed as pre-existing to
Phase 2b and cross-cutting all modules, and the owner has already made an explicit, documented
decision to fix it separately — I concur with not blocking Phase 4 on it.

---

*Verified: 2026-08-11T22:15:00Z*
*Verifier: Claude (gsd-verifier)*
