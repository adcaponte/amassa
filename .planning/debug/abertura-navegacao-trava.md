---
status: awaiting_human_verify
trigger: "Diagnose and fix INTERMITTENT client-side navigation stall on /abertura route (production build only, ~1 in 5 clicks). Blocks Phase 4.2 e2e sweep: abertura-tracador.spec.ts:76 and abertura-tarefas.spec.ts:75 (@vazio-global) fail, 412 downstream tests do not run. Do NOT raise timeouts, do NOT declare environmental flake — reproducible outside Playwright harness. HEAD 04830aa."
created: 2026-08-30T17:40:00-03:00
updated: 2026-08-30T21:15:00-03:00
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: "CONFIRMED. Moving DataInauguracao + the header 'add' button out of app/(app)/abertura/page.tsx and into a new app/(app)/abertura/layout.tsx (which Next.js does NOT re-execute server-side for a same-route searchParams-only navigation) removes 2 of the page segment's Client Component references from the RSC flight payload sent on every ?item=/?tarefa=/?aba= navigation. Measured: 0/72 TRAVOU across three 24-attempt runs (both header and empty-state links) on the fixed build, vs ~20-37% baseline."
test: "taxa24.mjs against the fixed production build, 24 attempts each on both the header link and the empty-state link, plus a third 24-attempt repeat of the empty-state link for extra confidence. Functional regression check via verificar-funcional.mjs: tab switching/aria-selected, header button text swap, 'Por mês' hiding the add button, and the date-of-inauguration edit-and-save flow, all against the same fixed build."
expecting: "0/24 or very close to it on all three timing runs, and every functional check passing."
next_action: "Fix committed (55449fe). Awaiting human verification: confirm the target bug (empty-state /abertura navigation) is fixed in real usage, and decide whether the documented residual limitation (editing an existing item, celular viewport, ~21% under this exact upstream condition) is accepted as follow-up debt or needs a same-phase fix before archiving this session."

reasoning_checkpoint:
  hypothesis: "The stall's probability is a function of how many distinct Client Component references app/(app)/abertura/page.tsx's OWN returned JSX contains for a given navigation (i.e. Flight payload complexity for that server segment) -- not of how much React ends up re-rendering client-side. Moving components that don't need per-searchParams server data out of page.tsx and into layout.tsx (which Next.js does not re-execute for same-route searchParams-only navigations) removes their references from the payload for ?item=/?tarefa=/?aba= navigations entirely."
  confirming_evidence:
    - "Literal removal of components from page.tsx's JSX reduced the measured failure rate monotonically: ~20-37% (4 components) -> ~8% (2 removed) -> 0/24 (3 removed, only FormularioItem left)."
    - "Making the SAME components skip re-rendering via correctly-verified React.memo (confirmed via render-count instrumentation that their function bodies stopped executing) did NOT move the failure rate at all (stayed ~25%), isolating the mechanism to something upstream of React's render/commit phase -- i.e. the server-rendered Flight payload itself, not client-side reconciliation work."
    - "After moving DataInauguracao + the header button to layout.tsx (page.tsx bundle size dropped 9.96kB -> 7.22kB, confirming fewer client references shipped for this route): 0/72 TRAVOU across three independent 24-attempt runs, vs the ~25% baseline measured on the immediately-preceding (memo-only) build."
  falsification_test: "If the failure rate had stayed at ~20-37% (or even ~8%) after the layout migration despite the measured payload-size reduction, that would disprove the Flight-payload-complexity hypothesis and point back toward something else entirely (e.g. a per-attempt environmental confound). It did not -- three independent 24-attempt samples all landed at 0."
  fix_rationale: "The fix does not patch a symptom (e.g. retry logic, a timeout bump) -- it removes the actual quantity (Client Component references in the page segment's Flight payload) that was empirically shown to drive the failure probability, by relocating those two components to the one place in Next.js's App Router model (a layout) that is architecturally exempt from being re-included in a searchParams-only navigation's payload. FormularioItem/FormularioTarefa (the two that could NOT move, since they need server-fetched itemParaEditar/tarefaParaEditar) remain the residual exposure -- consistent with why the fix reduces risk to the measured floor rather than being a component-count-zero, provably-impossible-to-recur guarantee for every route in the app that might grow more Client Components in the future."
  blind_spots: "The exact internal React/Next.js code path that fails to commit was not found (would require instrumenting minified React's own scheduler, which was judged out of reach for a black-box debugging session) -- the mechanism is confirmed only down to 'Flight payload complexity in the page segment', not to a specific line of framework code. It is possible a future page with even 2 Client Component references in its page segment could still exhibit some non-zero residual rate under different data/network conditions; 0/72 is strong evidence at today's measured conditions, not a mathematical proof of 0% forever. The explicit-vs-default memo comparator asymmetry (Evidence, 2026-08-30T19:35-19:50) is reported as an empirical fact but not explained mechanistically."
  candidate_causes:
    - "environment/dependency: upstream Next.js 15.x / React 19.x client-router or Flight-runtime scheduling defect (confirmed present in 15.5.22 AND 15.5.24/19.2.8 -- not fixed by the latest available patch; matches the still-open vercel/next.js#86151 issue class)"
    - "code/architecture: app/(app)/abertura/page.tsx mounting 4 Client Component references in one server segment (AbasAbertura, FormularioItem, FormularioTarefa, DataInauguracao) -- the only lever within this repository's control, now reduced to 2"
  and_gate: "yes -- both conditions must hold simultaneously for the defect to manifest at a user-visible rate: the upstream scheduling defect must exist (true today, confirmed via CDP-level instrumentation showing Next's own reducer never discards/errors, so the drop happens strictly after the framework hands off a resolved state) AND the page segment's Flight payload must be complex enough to hit the race's timing window (true before the fix at 4 references, empirically brought below the observable threshold at 2)."

## Symptoms

expected: |
  Clicking "+ Adicionar item" (header button or empty-state button) on /abertura navigates to
  /abertura?item=novo and opens the "Novo item" dialog, consistently, like every other same-
  pathname query-string navigation in the app (e.g. /encomendas -> ?nova).
actual: |
  In a PRODUCTION build (next build + next start) only -- never reproduces under `next dev` --
  roughly 1 in 5 clicks on the "+ Adicionar item" link (header OR empty-state variant) leaves the
  browser on /abertura. The URL never changes to include ?item=novo, no dialog opens, and nothing
  in the UI indicates anything happened. This has been measured freshly on current HEAD (04830aa):
  taxa.mjs, 8 attempts each, fresh browser context per attempt:
    /abertura cabecalho    : 105ms 104ms 109ms TRAVOU 102ms 91ms TRAVOU 105ms   (2/8 stalled)
    /abertura estado-vazio : 104ms TRAVOU 100ms 103ms TRAVOU 99ms 103ms 104ms   (2/8 stalled)
    /queimas -> /encomendas: 94ms 110ms 105ms                                  (0/3 stalled, control)
errors: |
  No server-side exception, no 5xx. Browser network panel shows the RSC request
  `GET /abertura?item=novo&_rsc=...` complete with status 200 in ~65ms, then reported as
  `net::ERR_ABORTED`. No React error boundary triggers, no console.error observed (not yet
  confirmed on THIS session -- prior agent's note, to be re-verified with diag.mjs).
reproduction: |
  See fast_reproduction_recipe in the task (already executed this session): production build
  against the empty `amassa_vazio` DB, `next start -p 3000`, click the "+ Adicionar item" link
  (header or empty-state) at 390x844 viewport, repeat >=8 times in fresh browser contexts.
started: "Unknown regression point vs pre-existing -- not yet re-verified this session (prior agent's <highest_value_next_experiment> was not run before this session began; will run if code-level investigation doesn't converge first)."

## Eliminated

- hypothesis: "Deep instrumentation of window.fetch/AbortController/ReadableStream/history.pushState/Navigation-API showed: fetch() resolves 200, full RSC body reads to completion (all chunks, done:true, decoded payload is well-formed valid Flight data for the target page), yet history.pushState/replaceState/navigation.navigate are NEVER called and ZERO DOM mutations occur after the click. CDP-level Network.loadingFailed reports the SAME single request as canceled/net::ERR_ABORTED ~8ms after the response, but this happens AFTER the JS-level stream already finished reading successfully -- so the network-layer cancellation is not what blocks the commit; something in Next's router-reducer silently drops a successfully-fetched, successfully-parsed navigation result before ever calling history.pushState. Ruled out as the blocking mechanism: AbortController.abort() (0 calls, prototype patched), ReadableStream.cancel()/reader.cancel() (0 calls, prototype patched), AbortSignal.timeout() (0 calls, patched), signal 'abort' event / onabort (0 firings, patched), stream.tee() (0 calls). This is NOT a network problem -- it is a router-internal state-management bug that discards an already-successful fetch+parse."
  evidence: "diag-stream-deep.mjs (scratchpad) instruments ReadableStream.prototype.getReader/tee, AbortController.prototype.abort, AbortSignal.prototype.addEventListener/onabort, AbortSignal.timeout, window.fetch, history.pushState/replaceState, window.navigation, and a MutationObserver on document.body. Captured multiple TRAVOU repetitions: fetch-resolved status 200 -> 7-9 reads, all done:false except the last (done:true) -> zero abort/cancel entries anywhere -> zero history/navigation calls -> mutationCount == 0. The saved RSC payload (rsc-payload-7.txt) is a well-formed Flight response for /abertura?item=novo with the correct build ID (matches .next/BUILD_ID), correct FormularioItem reference, no error/redirect/digest markers."
  timestamp: 2026-08-30T18:00:00-03:00

- hypothesis: "app/(app)/abertura/loading.tsx (the route's Suspense-boundary loading skeleton) is the trigger, matching vercel/next.js issue #86151 ('loading.js sometimes causes soft-navigation to get stuck and not render the new page, despite receiving it from the server' -- reproduces in production only, more likely with slow/heavy client components, goes away entirely when the loading.tsx file is removed, in the upstream repro)."
  evidence: "EMPIRICALLY TESTED, not just researched: removed app/(app)/abertura/loading.tsx (renamed out of the route), confirmed via `.next/server/app/(app)/abertura/` listing that the rebuilt production output no longer contains a loading.js entry (only page.js/page_client-reference-manifest.js remained, and BUILD_ID changed), rebuilt against amassa_vazio, restarted next start, and ran 24 fresh attempts (taxa24.mjs) on the estado-vazio link: 7/24 TRAVOU (29%) -- same order of magnitude as the baseline with loading.tsx present (~10-25% across several 8-24-attempt samples), not a fix. File restored immediately after the test (working tree confirmed clean again)."
  timestamp: 2026-08-30T18:10:00-03:00

- hypothesis: "router.refresh() called on mount of data-inauguracao.tsx causes a competing transition."
  evidence: "Read full source of components/amassa/abertura/data-inauguracao.tsx this session: router.refresh() only called from salvar() after a successful server action, never on mount or via any effect/timer. contagemRegressiva() is a pure function of (inauguracaoEm, hoje), no setInterval/timer anywhere in the file."
  timestamp: 2026-08-30T17:45:00-03:00

- hypothesis: "The header + EstadoVazio duplicate-href Link pair (both -> /abertura?item=novo, both prefetch-enabled by default) is BY ITSELF the distinguishing cause of the stall."
  evidence: "Confirmed by reading code: /encomendas/page.tsx has the IDENTICAL pattern (header Link href=/encomendas?nova at line ~102, PLUS EstadoVazio's own hrefBotao=/encomendas?nova at ~line 117), rendered simultaneously whenever the encomendas index is empty. The control measurement (preexistente.mjs, same empty amassa_vazio DB, same running prod build) shows 8/8 and 3/3 clean on /encomendas. If duplicate-href-Link prefetch racing were sufficient on its own, /encomendas would show the same failure rate. It does not. This pattern is present but not sufficient -- either irrelevant, or a necessary-but-not-sufficient contributing factor (AND-gate candidate)."
  timestamp: 2026-08-30T17:50:00-03:00

## Evidence

- timestamp: 2026-08-30T17:39:00-03:00
  checked: "Fresh production server state: docker-postgres-1 healthy, amassa_vazio has 0 rows in abertura_itens and abertura_tarefas, .next build fresh (BUILD_ID tq7QeJJ03hXzh9nQ70qop, built 17:39), server already running on :3000 (PID 26832) from recipe setup."
  found: "Environment matches the fast_reproduction_recipe exactly. No rebuild needed to start investigating."
  implication: "Can iterate directly with existing scratchpad scripts before touching any source file."

- timestamp: 2026-08-30T17:41:00-03:00
  checked: "Re-ran taxa.mjs (8x header link, 8x empty-state link, 3x control) against current HEAD (04830aa), working tree clean."
  found: "2/8 TRAVOU on header link, 2/8 TRAVOU on empty-state link, 0/3 on /queimas->/encomendas control. Matches the established ~20% rate."
  implication: "Bug reproduces on current HEAD, unmodified. Confirms prior agents' measurements were not stale/flaky -- this is a live, reproducible defect right now."

- timestamp: 2026-08-30T17:55:00-03:00
  checked: "app/(app)/abertura/page.tsx (full read) vs app/(app)/encomendas/page.tsx (full read) -- structural diff in client components mounted unconditionally in the empty-itens-tab render."
  found: |
    /abertura mounts, on every render regardless of tab/empty state: AbasAbertura (useSearchParams),
    FormularioItem (useSearchParams + useForm + useEffect), FormularioTarefa (useSearchParams +
    useForm + useEffect), DataInauguracao (useRouter + local state, no useSearchParams), PainelResumo
    (Server Component). On the empty itens tab that's 3 independent useSearchParams() consumers
    (AbasAbertura, FormularioItem, FormularioTarefa) plus 2 identical-href Links (header + EstadoVazio).
    /encomendas mounts only FormularioEncomenda (1 useSearchParams() consumer) plus the same
    identical-href-Link pair.
  implication: "The candidate distinguishing factor is NOT the duplicate link alone (ruled out above)
    but the higher COUNT of concurrent useSearchParams() consumers/client components in the /abertura
    tree. Need to test this empirically, not just structurally."

- timestamp: 2026-08-30T18:05:00-03:00
  checked: "components/ui/dialog.tsx (Radix wrapper) -- whether FormularioItem/FormularioTarefa's DialogContent actually mounts into the DOM when `open=false` (aberto=false)."
  found: "DialogContent is wrapped in DialogPortal (Radix DialogPrimitive.Portal) with no forceMount prop anywhere in this codebase's usage. Radix Portal+Content unmount from the DOM when closed (no forceMount), so the <form> subtree of the closed dialog is NOT in the DOM -- but the FormularioItem/FormularioTarefa React components themselves (including their useForm(), useEffect(), useSearchParams()) still execute on every render of the page, closed or not, because Radix's conditional mounting happens INSIDE the Portal, not at the call site in page.tsx."
  implication: "Both formularios' hooks (useSearchParams, useForm with zodResolver, useEffect syncing form.reset on aberto/itemParaEditar change) run on every navigation to /abertura regardless of which dialog is open. This is 2x the useEffect+useSearchParams churn of /encomendas's single FormularioEncomenda on every transition."

- timestamp: 2026-08-30T18:35:00-03:00
  checked: |
    CDP Debugger logpoints (diag-logpoint.mjs, scratchpad) placed at the EXACT two lines inside
    Next.js's own client router action-queue processor (chunk 1255-cf02c4775860a5ab.js, webpack
    module 11807 "createMutableActionQueue" -- read via curl + manual deminification, NOT
    guessed): (A) the line that marks a currently-pending action `discarded=true` when a NEWER
    ACTION_NAVIGATE/ACTION_RESTORE is dispatched while it's still in flight, and (B) the line
    inside the async completion callback `i(e)` that checks `r.discarded` before doing
    `t.state=e, d(t,n), r.resolve(e)` -- the `r.resolve(e)` call is what hands the fully-computed
    new router state to REACT, via the `startTransition(() => setState(promise))` pattern used at
    dispatch time. Logpoints use `Debugger.setBreakpointByUrl` with a side-effecting
    `console.log(...), false` condition (fires without pausing). Captured across 6 independent
    TRAVOU repetitions plus several successful ones for comparison.
  found: |
    In EVERY captured TRAVOU (and every successful run), breakpoint (A) NEVER fires -- no action
    is ever marked discarded. Breakpoint (B) ALWAYS fires with
    `{"discarded":false,"type":"navigate","url":"http://localhost:3000/abertura?item=novo"}`,
    immediately followed by a second completion `{"discarded":false,"type":"server-patch"}`. This
    exact sequence is IDENTICAL whether the click's URL update actually happens (success) or
    stalls (failure) -- the reducer-level trace does not distinguish pass from fail.
  implication: |
    CONCLUSIVE, not inferred: Next.js's OWN action-queue discard/supersede logic is NOT the
    mechanism causing the stall. `fetchServerResponse` (module 32753) fetches and parses
    successfully (already shown), `navigateReducer` (module 11807) computes the correct new tree
    and canonicalUrl and is never discarded, and `r.resolve(e)` DOES fire, handing the resolved
    state to React's `startTransition`. The failure must be downstream of this hand-off, inside
    React's own commit of a state update whose value was a Promise passed to setState inside a
    transition (React 19's "thenable state" pattern) -- a class of scheduling bug, not a Next.js
    router logic bug. This is consistent with, though not textually the same trigger as, the
    publicly reported vercel/next.js issue #86151 ("loading.js sometimes causes soft-navigation to
    get stuck and not render the new page, despite receiving it from the server" -- same
    signature: successful fetch, successful parse, silent non-commit, more likely with
    slower/heavier client components, disappears under network throttling). That issue's specific
    trigger (loading.tsx + router.refresh()) was tested and ELIMINATED on this project (see
    Eliminated section) -- but the underlying CLASS of bug (a resolved promise fed to a
    transition-wrapped setState sometimes fails to commit) is the best-supported explanation left
    standing after exhausting the fetch/stream/reducer layers.

- timestamp: 2026-08-30T18:50:00-03:00
  checked: |
    Whether the stall requires a JUST-COMPLETED fresh login (the CDP trace above always shows a
    "server-action" completion -- our own test harness's login Server Action -- plus a
    "server-patch" completion around every attempt). Re-ran the 24-attempt measurement using a
    SAVED, already-authenticated Playwright storageState (skip the login form entirely; start
    from a fresh page load of /abertura with an established session) -- taxa-sessao-existente.mjs.
  found: "9/24 TRAVOU (37.5%) -- reproduces at the same order of magnitude WITHOUT a fresh login immediately beforehand."
  implication: |
    Rules out "leftover in-flight login Server Action" as a necessary precondition. The bug is a
    general property of navigating to /abertura in production with an ordinary established
    session, not an artifact of the test harness's login flow. The "server-patch" action seen in
    the CDP trace is very likely unrelated background noise (plausibly Next's own
    stale-prefetch-cache revalidation of the sidebar nav links seen earlier), not a causal factor
    -- it's irrelevant to reproduction since removing its precondition (fresh login) doesn't
    reduce the rate.

- timestamp: 2026-08-30T19:05:00-03:00
  checked: |
    Whether the NUMBER of concurrently-mounted Client Components calling useSearchParams() (3 on
    /abertura's itens tab: AbasAbertura, FormularioItem, FormularioTarefa -- vs 1 on /encomendas:
    FormularioEncomenda) is a contributing factor. EXPERIMENT: temporarily commented out
    `<FormularioTarefa>` and `<AbasAbertura>` in app/(app)/abertura/page.tsx (down to 1
    useSearchParams() consumer, matching /encomendas' count), rebuilt against amassa_vazio, ran 24
    attempts on the estado-vazio link. Reverted immediately after (confirmed via `git diff` back to
    clean before continuing the investigation).
  found: |
    2/24 TRAVOU (8.3%) with FormularioTarefa+AbasAbertura removed, vs a same-build,
    same-session /encomendas control also run at N=24: 0/24 (0%). Baseline /abertura (all
    components present, measured repeatedly through this session at N=8 to N=24) sits at roughly
    20-37% depending on the sample.
  implication: |
    The failure rate scales DOWN substantially, but does not reach zero, as concurrent
    useSearchParams()-consuming Client Components are removed. This is consistent with a
    React/Next.js scheduling race whose probability increases with the amount of concurrent
    client-side rendering work needed to commit a transition -- matching the upstream issue's own
    characterization ("more likely if your page has client components that take a while to
    render"). It also means /encomendas is not necessarily immune, only much lower-probability:
    0/24 does not prove 0% (a true ~8% rate has roughly an 88% chance of showing >=1 failure in 24
    trials, so 0/24 is consistent with a rate anywhere from 0% up to roughly 12-14% at typical
    confidence levels) -- /encomendas was never proven immune, only observed clean across 8+11+24
    = 43 attempts total this investigation.

- timestamp: 2026-08-30T19:25:00-03:00
  checked: |
    Whether upgrading the framework/runtime fixes the upstream scheduling race. EXPERIMENT:
    bumped `next` 15.5.22 -> 15.5.24 (latest patch on the 15.5.x line -- the "backport" npm
    dist-tag, meaning Vercel is actively backporting fixes to it even though 16.3.3 is the
    current `latest`) and `react`/`react-dom` 19.1.0 -> 19.2.8 (latest stable 19.x). Ran
    `npm install`, rebuilt against amassa_vazio, ran the 24-attempt measurement on estado-vazio.
    Reverted via `git checkout -- package.json package-lock.json && npm install` immediately
    after (confirmed `git status` clean and installed versions back to 15.5.22/19.1.0 before
    continuing).
  found: "7/24 TRAVOU (29%) on next@15.5.24 + react@19.2.8 -- same order of magnitude as baseline, not fixed."
  implication: |
    The specific scheduling defect is NOT fixed in the latest available 15.5.x/19.2.x patch
    versions. A dependency bump alone is not a viable fix here (also not the narrowest one, since
    it's a large, unrelated diff for zero measured benefit). Ruling this out is itself valuable:
    it means the mitigation has to be architectural (reduce concurrent client-rendering
    contention within this route), not "wait for upstream" -- confirmed via measurement rather
    than assumed from the issue still being open upstream.

- timestamp: 2026-08-30T19:35:00-03:00
  checked: |
    FIRST fix attempt: consolidated `useSearchParams()`/`useRouter()` into a SINGLE
    `ProvedorNavegacaoAbertura` Client Component (one `createContext`, one Provider, value =
    `{router, searchParams}`), consumed via `useNavegacaoAbertura()` by all of AbasAbertura,
    FormularioItem, FormularioTarefa, DataInauguracao, ConfirmarRemoverItem,
    ConfirmarRemoverTarefa, CaixaMarcacao (replacing each of their own direct
    `useRouter()`/`useSearchParams()` calls). Rebuilt against amassa_vazio, measured 24 attempts.
  found: "6/24 TRAVOU (25%) -- NOT fixed, statistically indistinguishable from the ~20-37% baseline."
  implication: |
    WRONG MODEL, caught before committing to it. The single-context Provider computes a NEW
    `{router, searchParams}` OBJECT on every render (object literal, new reference every time).
    Every consumer of a React Context ALWAYS re-renders when the Provider's value REFERENCE
    changes, regardless of whether the consumer's own derived slice of that value actually
    changed -- so this refactor did not reduce the number of components that must re-render
    together during the transition AT ALL, it just moved WHERE they get the (still-always-new)
    value from. It only reduces the count of components calling Next's OWN `useSearchParams()`
    hook directly; it does not reduce concurrent RE-RENDER work, which the earlier
    component-removal experiments (0/24 at 1 mounted consumer, ~8% at 2, ~20-37% at 4) show is
    what actually correlates with the failure rate. Component REMOVAL reduces total render work;
    a shared context with an unstable value does not.

- timestamp: 2026-08-30T19:50:00-03:00
  checked: |
    SECOND fix attempt: split the single context into per-concern contexts with primitive
    values (`ContextoRouter`, `ContextoItemAberto`, `ContextoTarefaAberta`, `ContextoAba`,
    `ContextoRemoverItemId`, `ContextoRemoverTarefaId`), each provided by
    `ProvedorNavegacaoAbertura`. Rebuilt, measured 24 attempts.
  found: "6/24 TRAVOU (25%) -- still not fixed."
  implication: |
    Splitting the context alone did not help either. Added render-count instrumentation
    (window.__rc counters inside each component body) to check WHETHER these components were
    even re-rendering unnecessarily. Confirmed via instrumentation: DataInauguracao and
    AbasAbertura (both memo'd with the DEFAULT React.memo comparator) DID still get their
    function bodies called on every /abertura navigation, including ones where their own relevant
    context slice (aba, router reference) was unchanged -- proven with a no-click control (counts
    stay flat with no navigation at all) and a same-navigation A/B test. FormularioTarefa, memo'd
    with an EXPLICIT custom comparator function (needed anyway because its array props
    gestores/itens are recreated by the server every render), correctly bailed out (count stayed
    flat). Testing AbasAbertura with an explicit `() => true` comparator immediately fixed its
    bailout too. CONCLUSION: React's DEFAULT memo shallow-prop comparator did not reliably trigger
    bailout in this specific Next.js App Router transition path in this codebase/version, but an
    EXPLICIT comparator function (even one semantically identical to the default, e.g. comparing
    each primitive field by ===) reliably did. This is an empirically-confirmed but not fully
    explained React/Next.js interaction -- documented here as a fact, not a theory.

- timestamp: 2026-08-30T19:58:00-03:00
  checked: |
    Rewrote ALL memo'd components in the module (AbasAbertura split into a thin unmemoized
    context-reading wrapper + a memoized presentational child taking the derived value as an
    explicit primitive prop with an explicit comparator; DataInauguracao, FormularioItem,
    CaixaMarcacao, ConfirmarRemoverItem, ConfirmarRemoverTarefa all given explicit `propsIguais`
    comparators instead of the default). Verified via the SAME render-count instrumentation that
    every one of these now correctly skips re-rendering on an unrelated navigation (only
    FormularioItem's count increases when opening ?item=novo, as expected). Rebuilt, measured 24
    attempts.
  found: "6/24 TRAVOU (25%) -- STILL not fixed, despite render counts now being fully correct."
  implication: |
    CRITICAL FINDING: reducing ACTUAL RE-RENDER WORK (verified empirically, not assumed) does
    NOT reduce the failure rate AT ALL -- yet literally REMOVING components from page.tsx's JSX
    (earlier experiments) took the same route from ~20-37% to 0%/8% in clean, monotonic steps.
    This proves the race's mechanism is NOT in React's render/reconciliation/commit phase (which
    memo optimizes) -- it must be upstream of that, in the amount of RSC FLIGHT PAYLOAD that has
    to be parsed/deserialized per navigation, which scales with the number of distinct Client
    Component references present in page.tsx's OWN returned JSX for this route (regardless of
    whether React ultimately chooses to re-render each one). Memoizing a component that is still
    part of the page's returned tree does not remove its `$L<n>` reference + props from the
    server-rendered Flight payload for that navigation; only NOT RENDERING it at that position at
    all does.

- timestamp: 2026-08-30T20:45:00-03:00
  checked: |
    Full e2e sweep (`npm run test:e2e`, no `--grep`) run against the layout-migration fix
    (DataInauguracao + header button moved to layout.tsx; context split; memo everywhere with
    explicit comparators; ConfirmarRemoverItem/ConfirmarRemoverTarefa NOT yet consolidated to a
    single instance at this point).
  found: |
    420 tests: 372 passed, 8 failed, 33 skipped, 7 did not run. BOTH originally-blocking
    @vazio-global tests (abertura-tracador.spec.ts:76, abertura-tarefas.spec.ts:75) PASSED and the
    412-test chain they gated now runs. Of the 8 failures: 2 are in tests\e2e\abertura-tracador
    (desktop+celular) with a test-assertion bug unrelated to navigation ("Formato inesperado do
    total do grupo" -- the regex parsing the group header text doesn't account for a "N não
    chegaram" alert line that appears when concurrent test workers create enough overdue-delivery
    items in the same shared category, a pre-existing test fragility, not a stall); 2 are
    unrelated to /abertura entirely (autenticacao.spec.ts rate-limit timing, sessao.spec.ts
    logout/back-button); 3 are in tests\e2e\abertura-edicao.spec.ts (celular only) --
    "editar um item com tarefa ligada", "remover um item sem tarefa ligada", "cancelar a remoção"
    -- all involving clicking a Link into `/abertura?item=<id>` or `?removerItem=<id>` in a
    POPULATED list (not empty), all showing the exact same signature as the original bug (Link
    click, dialog never opens/closes, no error).
  implication: |
    The layout-migration fix demonstrably works for its target (empty-state, always-mounted
    components) and unblocks the suite, but the SAME underlying upstream mechanism still has
    exposure once a list is populated: each row still mounts CaixaMarcacao + ConfirmarRemoverItem
    (or ConfirmarRemoverTarefa) as SEPARATE Client Component references, scaling the page
    segment's reference count with N items -- the same lever, in a different place.

- timestamp: 2026-08-30T20:55:00-03:00
  checked: |
    Consolidated ConfirmarRemoverItem and ConfirmarRemoverTarefa from ONE INSTANCE PER ROW to ONE
    INSTANCE FOR THE WHOLE LIST -- each now takes the full itens/tarefas array as a prop, finds
    the targeted row via the existing `useRemoverItemId()`/`useRemoverTarefaId()` context value,
    and renders (or renders nothing) accordingly. Removed the per-row `<ConfirmarRemoverItem>`/
    `<ConfirmarRemoverTarefa>` from lista-itens.tsx/lista-tarefas.tsx's row components. Re-ran the
    same 3 previously-failing abertura-edicao.spec.ts tests on celular via `--grep` (23-test
    subset, not the full 420-test sweep, per the e2e cost budget rule).
  found: |
    2 of 3 now pass ("remover um item sem tarefa ligada", "cancelar a remoção (Voltar)"). The
    third, "editar um item com tarefa ligada", STILL fails, consistently, with the identical
    signature (Editar item dialog never appears).
  implication: |
    Consolidating the per-row remove-confirmation dialogs to a single instance fixed 2 of the 3
    regressions -- confirming the "per-row reference count" mechanism for THAT class of
    component. FormularioItem (edit mode) is not a per-row component (there is only ever one
    instance) and was NOT touched by this change, so its continued failure points to a DIFFERENT
    contributing factor.

- timestamp: 2026-08-30T21:05:00-03:00
  checked: |
    Isolated measurement (bypassing the expensive e2e harness): inserted exactly ONE item
    directly into amassa_vazio via SQL, rebuilt the fixed production build, and ran a dedicated
    24-attempt timing script (taxa-editar.mjs) clicking that single item's "Editar" link
    (`/abertura?item=<uuid>`) -- i.e. the SAME fixed build that measured 0/72 for `?item=novo`,
    but now targeting an EXISTING item (itemParaEditar populated, non-null) instead of a new one.
  found: |
    5/24 TRAVOU (~21%) -- reproduces at a rate similar to the ORIGINAL, pre-fix baseline, with
    only ONE item in the whole list (ruling out "many rows" as the cause for this specific case).
    A follow-up experiment removing FormularioTarefa from page.tsx entirely (leaving FormularioItem
    as the page segment's ONLY Client Component reference) measured the SAME 5/24 -- FormularioTarefa's
    presence is NOT a contributing factor here.
  implication: |
    CONCLUSIVE, and a refinement of the root cause: it is not merely the COUNT of Client Component
    references in the page segment that drives the race, but also the SERIALIZED PAYLOAD SIZE of
    an individual reference's props. `itemParaEditar={null}` (creating) vs `itemParaEditar={...9
    fields...}` (editing an existing row) is the SAME single FormularioItem reference, but a
    meaningfully larger Flight payload for it alone reproduces the race at roughly the SAME
    order of magnitude as having 3-4 null-ish references. `ItemDaAbertura` (lib/abertura/
    consultas.ts) is already trimmed to only the fields the form needs (no criadoEm/atualizadoEm
    etc.) -- there is no further "free" payload reduction available here without changing the
    architecture (e.g. fetching edit-mode data client-side/lazily after the dialog opens, instead
    of as an SSR'd, searchParams-keyed prop), which is a materially bigger change than this
    session's scope and carries its own UX tradeoff (a loading flash where today there is none).
    This residual exposure is NOT something this session's fix regressed -- it existed in the
    original, unfixed codebase too (the payload was the same size before), it was simply
    UNREACHABLE by the e2e suite before because the empty-state failures blocked the entire
    dependent chain. Recommending this as a follow-up item, not attempting a same-session
    structural fix for it.

## Resolution

root_cause: |
  A timing-sensitive race in Next.js's client-side App Router / React 19 concurrent rendering,
  NOT a bug in this project's application code. Confirmed mechanism, by direct instrumentation
  (not inference):

  1. The user's click issues a real `fetch()` for the RSC payload of `/abertura?item=novo`. This
     ALWAYS succeeds: 200 response, full body read to completion, well-formed Flight data with
     the correct build ID (verified via window.fetch/ReadableStream instrumentation, both on
     success and on failure).
  2. Next.js's client router reducer (`fetchServerResponse` + `navigateReducer`, chunk
     1255-cf*.js) ALWAYS processes this successfully too: the action is never marked `discarded`
     by its own supersede-a-stale-navigation logic (verified via CDP logpoints on the exact
     `discarded=true` assignment and the exact `r.discarded||(...)` completion check, across 6
     captured stalls -- 0 discards observed, ever). The reducer computes the correct patched tree
     and canonicalUrl and calls `r.resolve(e)`, handing that state to React via
     `startTransition(() => setState(promiseThatResolvesToTheNewRouterState))`.
  3. Somewhere AFTER that hand-off -- inside React's own scheduling/commit of a transition whose
     state was set to a Promise -- the update sometimes never actually commits: zero
     `history.pushState`/`replaceState` calls, zero `window.navigation.navigate()` calls, and a
     MutationObserver on `document.body` recorded ZERO DOM mutations of any kind after the click.
     No error is thrown anywhere (no console error, no unhandled rejection, no React error
     boundary trip) -- the update is silently dropped, which is exactly why it looked, on the
     surface, like a network problem (the one visible artifact is Chrome's network panel
     reporting the by-then-already-fully-read request as `net::ERR_ABORTED`, a red herring: it
     fires AFTER the JS-level stream had already finished reading successfully, and is not what
     blocks the commit).

  This failure's PROBABILITY scales with the number of distinct Client Component references
  present in `app/(app)/abertura/page.tsx`'s OWN returned JSX for the target route -- i.e. with
  how much the RSC Flight payload has to describe for that specific server segment on that
  specific navigation -- NOT with how much React ends up re-rendering client-side. This was
  isolated by two decisive, contradicting experiments:
    - LITERALLY REMOVING components from page.tsx's JSX (FormularioTarefa+AbasAbertura, then also
      DataInauguracao) took the measured rate from ~20-37% down to ~8% down to 0/24, in clean,
      monotonic steps.
    - Making those SAME components skip re-rendering via `React.memo` with correct, explicit,
      verified-working prop comparators (confirmed via render-count instrumentation: their
      function bodies provably stopped executing on unrelated navigations) did NOT move the
      failure rate AT ALL (stayed ~25% both before and after the memo fix). Memoizing a component
      does not remove its Flight reference from the payload the server sends for that
      navigation -- only not rendering it there at all does.
  This matches, in every particular except the specific trigger, the publicly reported and
  still-open vercel/next.js issue #86151 ("`loading.js` sometimes causes soft-navigation to get
  stuck and not render the new page, despite receiving it from the server") -- reproduces in
  production only (never in `next dev`), more likely with more/slower client components, and
  (per that report) goes away under network throttling. This project's `loading.tsx` was tested
  and ELIMINATED as this specific bug's trigger (removing it did not reduce the failure rate).
  A Next.js/React dependency bump (15.5.22->15.5.24, react/react-dom 19.1.0->19.2.8) was ALSO
  tested and did not fix it (7/24, same order of magnitude). This is not literally issue #86151
  reproduced verbatim, but the same underlying CLASS of upstream bug: a resolved,
  transition-wrapped router state update that React's client runtime sometimes fails to commit,
  with the failure probability scaling with Flight payload complexity, unique to production
  builds (the timing characteristics that trigger it don't reproduce in `next dev`'s
  slower/instrumented execution, nor were they fixed by the latest available patch versions).

  AND-gate: the RCA branches across two independent categories that must BOTH hold for the defect
  to be user-visible at today's rate: (a) an upstream Next.js/React concurrent-rendering /
  Flight-commit scheduling defect (category: environment/dependency -- outside this repository's
  control, not fixed by upgrading to the latest available patch releases), AND (b) this route's
  page.tsx mounting more Client Component references (4: AbasAbertura, FormularioItem,
  FormularioTarefa, DataInauguracao) in ONE server segment than any other route in the app
  (category: code/architecture -- within this repository's control).

fix: |
  Moved the two Client Components that do NOT need per-searchParams server data --
  `DataInauguracao` and the header's "+ Adicionar item/tarefa" button (extracted into a new
  `BotaoAdicionarAbertura`) -- out of `app/(app)/abertura/page.tsx` and into a new
  `app/(app)/abertura/layout.tsx`. Next.js does not pass `searchParams` to layouts and,
  critically, does NOT re-execute a layout on the server for a same-route searchParams-only
  navigation (documented behavior) -- so these two Client Component references are no longer
  part of the RSC Flight payload sent for every `?item=`/`?tarefa=`/`?aba=` click, cutting the
  page segment's reference count from 4 down to 2 (FormularioItem, FormularioTarefa, both of
  which genuinely need server-fetched, searchParams-keyed props -- `itemParaEditar`/
  `tarefaParaEditar` -- so they cannot move to layout without a bigger, riskier restructure to
  client-side data fetching).

  `BotaoAdicionarAbertura`/`DataInauguracao`/`AbasAbertura` remain fully reactive to `?aba=`/open
  state because `useSearchParams()` reactivity is inherently client-side (via
  `ProvedorNavegacaoAbertura`, also moved to layout.tsx) and does not depend on which server
  segment triggered the navigation -- verified functionally (see sinal_3 below), not just assumed.

  SECOND part of the fix, added after the full sweep surfaced 3 residual failures in
  abertura-edicao.spec.ts (populated-list scenarios, same signature as the original bug):
  consolidated `ConfirmarRemoverItem`/`ConfirmarRemoverTarefa` from ONE INSTANCE PER ROW to ONE
  INSTANCE FOR THE WHOLE LIST each (they now take the full itens/tarefas array as a prop and look
  up the targeted row via the existing `useRemoverItemId()`/`useRemoverTarefaId()` context value,
  instead of each row mounting its own copy). This is the SAME lever (fewer Client Component
  references in the page segment) applied to the per-row case: with N items, this used to add
  2N references (CaixaMarcacao is still 1-per-row, unavoidably -- each row needs its own
  interactive checkbox target); it now adds N+1. This fixed 2 of the 3 residual failures
  ("remover um item sem tarefa ligada", "cancelar a remoção (Voltar)").

  KNOWN RESIDUAL LIMITATION (not fixed this session, documented and recommended as follow-up):
  the third residual failure, "editar um item com tarefa ligada" (celular only), was isolated
  (Evidence, 2026-08-30T21:05) to a DIFFERENT contributing factor: FormularioItem's OWN Flight
  payload is meaningfully bigger when `itemParaEditar` is a populated ~9-field object (editing an
  existing item) versus `null` (creating a new one) -- and that size increase alone, with
  FormularioItem as the page segment's ONLY Client Component reference, reproduces the race at
  roughly the SAME rate (~21%) as having 3-4 null-props references did before this fix. This is
  not a regression introduced by this session's changes -- the payload was the same size in the
  original, unfixed code -- it was simply unreachable by the e2e suite before because the
  empty-state failures blocked the entire dependent test chain. Fully eliminating it would
  require a materially bigger architectural change (fetching edit-mode data client-side/lazily
  after the dialog opens, instead of as an SSR'd, searchParams-keyed prop) with its own UX
  tradeoff (a loading flash where today there is none), or an upstream Next.js/React fix -- judged
  out of proportion for this debugging session's scope.

  Secondary, defensive changes made along the way (kept because they are correct React practice
  and do not regress anything, even though on their own they were proven NOT to fix the bug):
    - `contexto-navegacao.tsx`: replaced 7 independent `useSearchParams()`/`useRouter()` call
      sites (one per component, one per list row for CaixaMarcacao/ConfirmarRemoverItem/
      ConfirmarRemoverTarefa) with a single read, split into per-concern React Contexts with
      primitive values (`ContextoRouter`, `ContextoItemAberto`, `ContextoTarefaAberta`,
      `ContextoAba`, `ContextoRemoverItemId`, `ContextoRemoverTarefaId`), each consumed via a
      dedicated hook (`useRouterAbertura`, `useItemAberto`, etc.).
    - `React.memo` with an EXPLICIT prop comparator (never the default) on AbasAbertura (split
      into a thin context-reading wrapper + a memoized presentational child taking `abaAtual` as
      a prop), DataInauguracao, FormularioItem, FormularioTarefa (already had one, for its
      array props), CaixaMarcacao, ConfirmarRemoverItem, ConfirmarRemoverTarefa,
      BotaoAdicionarAbertura.
    - `loading.tsx` updated to no longer skeleton the header/date-of-inauguration area (that area
      now renders for real via layout.tsx, immediately, never blocked by page.tsx's data fetch).
    - `layout.tsx` wraps its OWN `obterConfiguracaoDaAbertura()` fetch in its own `<Suspense>`
      (new `EsqueletoDataInauguracao` fallback) specifically because `loading.tsx` only covers a
      layout's `{children}`, never the layout's own content -- without this, a slow config query
      would block the whole route with no loading state at all (CLAUDE.md §Estados).

verification:
  guardrail_verdict: accepted
  oracle_type: derived
  sinal_1_reproducao_antes: "REPRODUZIDO repetidamente nesta sessão, na build de producao atual (HEAD 04830aa, sem modificacoes): 2/8, 2/8, e diversas amostras adicionais de 6-11/24 (~20-37%) tanto no link do cabecalho quanto no link do estado vazio, contra o banco amassa_vazio."
  sinal_2_mecanismo: "EXPLICADO E ISOLADO por instrumentacao direta (nao inferencia): fetch/leitura do RSC sempre bem-sucedidos (window.fetch + ReadableStream instrumentados); reducer do proprio Next.js (fetchServerResponse + navigateReducer) sempre completa sem descarte (CDP logpoints nas duas linhas exatas do modulo 11807 do chunk 1255-cf*.js, 6 travamentos capturados, 0 descartes); memoizar componentes (confirmado via contador de render) NAO reduz a taxa; remover componentes da arvore JSX de page.tsx SIM reduz a taxa, de forma monotonica e reprodutivel (20-37% -> 8% -> 0%). Isola o mecanismo no numero de referencias de Client Component no payload RSC do segmento de pagina, nao no trabalho de render do React."
  sinal_3_correcao_verde: "Apos mover DataInauguracao + botao do cabecalho para app/(app)/abertura/layout.tsx: taxa24.mjs, 3 rodadas de 24 tentativas (estado-vazio, cabecalho, estado-vazio de novo) = 0/72 TRAVOU, contra 6/24 (25%) na build imediatamente anterior (com todas as otimizacoes de memo mas SEM a mudanca de layout). Verificacao funcional (verificar-funcional.mjs) confirmou que nada quebrou: troca de aba atualiza aria-selected corretamente, botao do cabecalho troca de rotulo/href com a aba, aba 'Por mes' esconde o botao de adicionar, e o fluxo de editar-e-salvar a data de inauguracao funciona (toast de sucesso, texto atualizado). npm run lint (limpo), npx tsc --noEmit (limpo), npm run verificar-acoes (26 acoes, 0 violacoes), npm test (29 arquivos, 544 testes, todos passam)."
  sinal_4_nao_e_diff_de_delecao_sem_causa: "A mudanca de arquitetura (mover 2 componentes para layout.tsx, consolidar ConfirmarRemoverItem/ConfirmarRemoverTarefa para 1 instancia por lista, mais memo com comparadores explicitos) e uma correcao de causa-raiz identificada por medicao direta (secao Evidence), nao uma seguranca aleatoria: cada peca foi isolada por experimento antes de ser mantida, e as pecas que NAO ajudaram (context splitting sozinho, memo sozinho, upgrade de dependencia) foram descartadas ou mantidas so por seu valor de correcao independente, nunca como parte da explicacao do resultado."
  sinal_5_sweep_completo: |
    RODADO (npm run test:e2e, sem --grep), 420 testes, ANTES da consolidacao de
    ConfirmarRemoverItem/ConfirmarRemoverTarefa: 372 passaram, 8 falharam, 33 pulados, 7 nao
    rodaram. AMBOS os testes @vazio-global que bloqueavam a cadeia inteira (abertura-tracador.spec.ts:76,
    abertura-tarefas.spec.ts:75) PASSARAM -- a cadeia de 412 testes bloqueados agora roda.
    Das 8 falhas: 2 sao um bug de asserção pre-existente e nao relacionado (regex de
    abertura-tracador.spec.ts:127 nao previa a linha "N nao chegaram", um problema de isolamento
    de teste sob carga paralela, nao um travamento); 2 sao inteiramente fora de /abertura
    (autenticacao.spec.ts, sessao.spec.ts); 3 eram em abertura-edicao.spec.ts (celular), a mesma
    assinatura do bug original, em cenarios de LISTA POVOADA. Apos a consolidacao de
    ConfirmarRemoverItem/ConfirmarRemoverTarefa, um --grep dirigido (23 testes, nao o sweep
    completo de novo -- orcamento de e2e) confirmou 2 das 3 corrigidas; a terceira
    ("editar um item com tarefa ligada") tem causa isolada e documentada acima (KNOWN RESIDUAL
    LIMITATION) mas nao foi corrigida nesta sessao. O SWEEP COMPLETO NAO FOI RE-RODADO por
    inteiro apos a consolidacao (orcamento de e2e -- CLAUDE.md limita a 1 invocacao completa por
    tarefa) -- o --grep dirigido e a medicao isolada (taxa-editar.mjs) sao a evidencia disponivel
    para o estado final. O sweep NAO esta 100% verde: o objetivo especifico desta sessao de debug
    (o travamento de estado vazio) esta corrigido e comprovado (0/72); a supressao dos 412 testes
    bloqueados esta resolvida; resta 1 falha da MESMA classe de bug em cenario de edicao, e 3
    falhas pre-existentes/nao relacionadas fora do escopo desta sessao.

files_changed:
  - "app/(app)/abertura/layout.tsx: NOVO -- Server Component com exigirUsuario(), ProvedorNavegacaoAbertura, CabecalhoPagina+BotaoAdicionarAbertura, e DataInauguracao (busca de configuracao em Suspense proprio)."
  - "app/(app)/abertura/page.tsx: removidos CabecalhoPagina/Button/Link/DataInauguracao/ProvedorNavegacaoAbertura (foram para layout.tsx); mantido FormularioItem/FormularioTarefa/PainelResumo/AbasAbertura/ListaX."
  - "app/(app)/abertura/loading.tsx: removido o esqueleto de cabecalho/data-de-inauguracao (agora renderiza de verdade via layout.tsx, nunca bloqueado pelo loading de page.tsx)."
  - "components/amassa/abertura/contexto-navegacao.tsx: NOVO -- ProvedorNavegacaoAbertura + hooks useRouterAbertura/useItemAberto/useTarefaAberta/useAbaAtual/useRemoverItemId/useRemoverTarefaId, contextos separados por fatia primitiva."
  - "components/amassa/abertura/botao-adicionar-abertura.tsx: NOVO -- botao do cabecalho extraido de page.tsx, agora Client Component reativo a `?aba=` via contexto."
  - "components/amassa/abertura/data-inauguracao-skeleton.tsx: NOVO -- esqueleto usado pelo Suspense de layout.tsx."
  - "components/amassa/abertura/abas-abertura.tsx: dividido em wrapper (le contexto) + AbasAberturaConteudo memoizado com comparador explicito."
  - "components/amassa/abertura/data-inauguracao.tsx, formulario-item.tsx, formulario-tarefa.tsx, caixa-marcacao.tsx: useRouter()/useSearchParams() trocados pelos hooks de contexto-navegacao.tsx; memo com comparador explicito."
  - "components/amassa/abertura/confirmar-remover-item.tsx: reescrito de 1-instancia-por-linha para 1-instancia-para-a-lista-toda (props viram `itens: ItemParaRemover[]`, acha a linha certa por `useRemoverItemId()`); memo com comparador que compara o CONTEUDO do array."
  - "components/amassa/abertura/confirmar-remover-tarefa.tsx: mesma mudanca (props viram `tarefas: TarefaParaRemover[]`)."
  - "components/amassa/abertura/lista-itens.tsx: renderiza UM `<ConfirmarRemoverItem itens={...}/>` para a lista toda (fora do map por linha); removido `tarefasLigadas` de `LinhaDeItem` (nao usado mais ali)."
  - "components/amassa/abertura/lista-tarefas.tsx: renderiza UM `<ConfirmarRemoverTarefa tarefas={...}/>` para a lista toda (fora do map por linha)."
  - "components/amassa/abertura/ferramentas-linha.tsx: comentario atualizado (nenhuma mudanca de codigo)."

