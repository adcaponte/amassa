# Deferred items — Phase 3 (Gestor de Encomendas)

Items discovered during execution that are out of scope for the current plan (pre-existing,
unrelated to the task's own changes) — logged, not fixed, per the executor's scope boundary.

## 03-06

- **`components/amassa/encomendas/gantt.tsx` não tem um `Link` por linha até hoje.** Já
  registrado como gap pré-existente em `03-05-SUMMARY.md` ("Next Phase Readiness"), confirmado
  de novo aqui: `tests/e2e/encomendas-formulario.spec.ts` precisou extrair o `href` do cartão
  mobile (`CartaoEncomenda`, sempre no DOM nos dois tamanhos de tela por D-02) em vez de clicar
  numa linha do Gantt no projeto `desktop`, porque não existe elemento clicável ali. Fora do
  escopo de arquivos deste plano (`gantt.tsx` não está em `files_modified`); um bom candidato
  para uma fase futura de polimento junto do item #6 do `WINDOWS.md` (quebra de linha do `<h1>`
  do cabeçalho).

## 03-01

- **`tests/e2e/autenticacao.spec.ts` — "a sexta tentativa seguida no mesmo e-mail mostra a
  mensagem de bloqueio com os minutos" times out intermittently on the `desktop` project
  (`page.waitForResponse` exceeds the 60s test timeout).** Reproduced in isolation (running only
  this test, `--grep "sexta tentativa"`), unrelated to any file this plan touches (auth, rate
  limiting, login) — confirmed pre-existing flakiness in the rate-limit e2e test's timing
  assumptions, not a regression introduced by Phase 3. Out of scope for 03-01 (scope boundary:
  "Only auto-fix issues DIRECTLY caused by the current task's changes"). Worth a dedicated look
  in a future phase/plan if it keeps recurring.

- **`components/ui/form.tsx` could not be installed — architectural finding requiring a
  decision before plan 06.** Tarefa 3 ran `npx shadcn@3.8.5 add alert-dialog dialog form label
  select sonner switch`; six of the seven created a file. `form` did not: `npx shadcn@3.8.5 view
  form` (and the fully-qualified `view @shadcn/form`) returns a registry item with NO `files`
  array — there is nothing to write. Confirmed this is a real content gap, not a fluke: the
  neighboring `field` registry item (`npx shadcn@3.8.5 view @shadcn/field`), which the CLI's own
  `search @shadcn` output surfaces right next to `form`, returns a full `field.tsx` with real
  content. This strongly suggests the "radix-nova" style/preset (`components.json`, pinned since
  Fase 2b) has superseded the classic react-hook-form + Zod `Form` wrapper with a `Field`
  primitive, and the `form` registry name is a vestigial, empty stub kept only for
  search-discoverability.
  - **Why this wasn't auto-resolved:** substituting `field` for `form` changes the actual
    component API plan 06's formulário (`react-hook-form` + Zod resolver + shadcn `form`
    wrapper, per `03-UI-SPEC.md` "Design System" and `03-PATTERNS.md`) would be built against —
    a different shape of composition (`FieldSet`/`FieldGroup`/`FieldLabel`/`FieldError` vs.
    `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage`). That is an architectural choice
    (deviation Rule 4), not a bug fix, and it affects a component this plan does not itself
    consume — `formulario-encomenda.tsx` in 03-01 is plain HTML `<form>`/`<label>`, no
    react-hook-form anywhere yet.
  - **No unapproved package entered the tree because of this.** `react-hook-form` and
    `@hookform/resolvers` were on the Tarefa 1 approved list (in case `form`'s dependencies
    array pulled them in, the way `sonner`'s did for `sonner`/`next-themes`) but were never
    installed — `form` never triggered a dependency install because it has no content to
    process. `package.json`/`package-lock.json` only gained `sonner@2.0.8` and
    `next-themes@0.4.6`, both pinned exact, both on the approved list.
  - **What plan 06 needs to decide before it starts:** (a) build the form on `field` instead
    (verify it composes with `react-hook-form`'s `Controller`/`useForm` the same way `Form` did,
    since `field.tsx`'s content shown above has no visible react-hook-form integration of its
    own — it may need pairing with `react-hook-form` by hand rather than a ready-made wrapper),
    or (b) hand-author a `Form` wrapper outside `components/ui/` (since `components/ui/` is
    shadcn's own territory, D-11 of 02b-CONTEXT — a hand-written file does not belong there), or
    (c) skip a Form/Field wrapper altogether and wire `react-hook-form` directly against plain
    labeled inputs, closer to what 03-01's `formulario-encomenda.tsx` already does. Left
    unresolved here on purpose — this is squarely a plan-06 planning decision, not something the
    03-01 executor should pick unilaterally.
