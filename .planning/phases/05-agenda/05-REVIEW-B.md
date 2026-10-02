---
phase: 05-agenda
reviewed: 2026-10-02T12:00:00Z
depth: deep
scope: "UI/page source files changed by cfd0990..9b640e2 (64 files) — review B"
files_reviewed: 64
files_reviewed_list:
  - app/gestao/(app)/agenda/error.tsx
  - app/gestao/(app)/agenda/loading.tsx
  - app/gestao/(app)/agenda/page.tsx
  - app/gestao/(app)/cadastros/loading.tsx
  - app/gestao/(app)/cadastros/page.tsx
  - app/gestao/(app)/financeiro/page.tsx
  - app/gestao/(app)/page.tsx
  - app/page.tsx
  - components/amassa/agenda/a-receber.tsx
  - components/amassa/agenda/abas-da-agenda.tsx
  - components/amassa/agenda/aviso-da-agenda.tsx
  - components/amassa/agenda/barra-da-agenda.tsx
  - components/amassa/agenda/campos-turma.tsx
  - components/amassa/agenda/campos-uso-livre.tsx
  - components/amassa/agenda/cartao-evento.tsx
  - components/amassa/agenda/colocar-alguem.tsx
  - components/amassa/agenda/confirmar-cancelar-data.tsx
  - components/amassa/agenda/confirmar-cancelar-reserva.tsx
  - components/amassa/agenda/confirmar-desativar-turma.tsx
  - components/amassa/agenda/confirmar-dispensar.tsx
  - components/amassa/agenda/confirmar-sair-da-turma.tsx
  - components/amassa/agenda/confirmar-tirar-bloqueio.tsx
  - components/amassa/agenda/confirmar-tirar-da-lista.tsx
  - components/amassa/agenda/confirmar-tirar-material.tsx
  - components/amassa/agenda/dispensadas.tsx
  - components/amassa/agenda/escolha-experimental.tsx
  - components/amassa/agenda/ficha-pessoa.tsx
  - components/amassa/agenda/folha-evento.tsx
  - components/amassa/agenda/folha-fechado.tsx
  - components/amassa/agenda/folha-lancar.tsx
  - components/amassa/agenda/folha-recebi-agora.tsx
  - components/amassa/agenda/folha-turma.tsx
  - components/amassa/agenda/folha-uso-livre.tsx
  - components/amassa/agenda/grade-do-mes.tsx
  - components/amassa/agenda/gravacoes-pendentes.ts
  - components/amassa/agenda/linha-a-receber.tsx
  - components/amassa/agenda/linha-inscrito.tsx
  - components/amassa/agenda/lista-pessoas.tsx
  - components/amassa/agenda/lote-de-mensalidades.tsx
  - components/amassa/agenda/material-do-uso-livre.tsx
  - components/amassa/agenda/moldura-no-site.tsx
  - components/amassa/agenda/numeros-da-agenda.tsx
  - components/amassa/agenda/seletor-pessoa.tsx
  - components/amassa/agenda/semana-da-agenda.tsx
  - components/amassa/agenda/turmas-da-pessoa.tsx
  - components/amassa/agenda/url-da-agenda.ts
  - components/amassa/cadastros/dialogo-item-catalogo.tsx
  - components/amassa/cadastros/lista-catalogo.tsx
  - components/amassa/cadastros/lista-clientes.tsx
  - components/amassa/cadastros/sub-abas-cadastros.tsx
  - components/amassa/clientes/aviso-homonimo.tsx
  - components/amassa/clientes/formulario-cliente.tsx
  - components/amassa/clientes/usar-busca-na-url.ts
  - components/amassa/estoque/folha-movimentacao.tsx
  - components/amassa/estoque/grade-destinos.tsx
  - components/amassa/financeiro/faixa-da-agenda.tsx
  - components/amassa/financeiro/linha-carrinho.tsx
  - components/amassa/financeiro/painel-venda.tsx
  - components/amassa/inicio/bloco-agenda-de-hoje.tsx
  - components/site/agenda-publica-calendario.tsx
  - components/site/agenda-publica.tsx
  - components/site/aulas-e-oficinas.tsx
  - components/site/botao-reservar.tsx
  - components/site/cartao-evento-site.tsx
findings:
  critical: 2
  warning: 7
  info: 9
  total: 18
status: issues_found
---

# Phase 05 (Agenda): Code Review Report — B (UI and pages)

**Reviewed:** 2026-10-02
**Depth:** deep (UI files plus the server actions and pure modules they call, where a finding depended on them)
**Files Reviewed:** 64
**Status:** issues_found

## How this was read

**Read in full (line 1 to the end):** `agenda/error.tsx`, `agenda/loading.tsx`, `agenda/page.tsx`, `app/gestao/(app)/page.tsx`,
`app/page.tsx`, and every file under `components/amassa/agenda/` except the three listed below. Also read in full:
`components/amassa/clientes/*` (3 files), `cadastros/lista-clientes.tsx`, `financeiro/faixa-da-agenda.tsx`,
`inicio/bloco-agenda-de-hoje.tsx`, and all 5 files in `components/site/*`.

**Read partly (the hunk changed in Phase 5 plus enough context around it, not the whole file):**
- `confirmar-tirar-material.tsx` 40–143, `confirmar-cancelar-reserva.tsx` 35–158 and `confirmar-tirar-bloqueio.tsx` 35–139.
  The skipped top of each file is imports and props.
- `financeiro/page.tsx`: the Phase 5 diff plus 440–534.
- `painel-venda.tsx`: the Phase 5 diff plus 160–359.
- `dialogo-item-catalogo.tsx`, `folha-movimentacao.tsx`, `grade-destinos.tsx`, `linha-carrinho.tsx`, `lista-catalogo.tsx`,
  `sub-abas-cadastros.tsx`, `cadastros/page.tsx` and `cadastros/loading.tsx`: the Phase 5 diff only. These files existed
  before Phase 5 and changed by 4 to 46 lines each.

**Read to check a finding:**
- `lib/agenda/acoes.ts`: `definirPresenca`, `definirDireitoARepor`, `cancelarData`, `receberAgora`, the batch action and
  `definirDispensa`.
- `lib/financeiro/acoes.ts`: `lancarVenda`.
- `lib/agenda/publico/agenda.ts`, `lib/agenda/seletor.ts` and `lib/agenda/esquemas.ts` (price schema).
- `lib/agenda/gravacao.ts`: `contarPerdasAoCancelar`.
- `lib/agenda/textos.ts`, `05-CONTEXT.md` and `05-UI-SPEC.md` (error copy, E6, line 618).

No decision D-01..D-18 is flagged as a defect.

## Summary

These areas hold up well:
- **Double-submit guards.** Every sheet has a synchronous `emVoo` ref.
- **Server decides money.** "Recebi agora" and `lancarVenda` with `origem` re-read value, person and description under a
  lock, and the batch skips charges already launched.
- **Sale draft (Pitfall 10).** The draft in sessionStorage is read but never applied or written back when the sale comes
  from the Agenda. `limpar()` does not delete it.
- **Public site data.** It goes through a field-by-field whitelist (`cartao()`) with no person, phone or closed-day
  reason. Price appears only on event cards, and the WhatsApp link comes only from `hrefDoWhatsapp`.

The two blockers are both "the screen says one thing, the database says another":
1. A nested form submit leaks through the React portal and can create a reservation for the wrong person.
2. With the Valor-central flow (tap Veio/Faltou, then "Pronto"), a presence that fails to save is never reported. The
   screen showed it as saved, and nobody is told.

## Critical Issues

### CR-01: Saving a new person inside "Lançar na agenda → Uso livre" also submits the outer launch form, which can reserve for the wrong person

**Files:**
- `components/amassa/agenda/folha-lancar.tsx:550-556`: the outer `<form onSubmit>` calls `gravar()`.
- `components/amassa/clientes/formulario-cliente.tsx:182-187`: the inner `<form onSubmit>` calls `preventDefault` but
  not `stopPropagation`.
- `components/amassa/agenda/seletor-pessoa.tsx:407-427`: `FormularioCliente` is rendered inside the selector.
- `components/amassa/agenda/campos-uso-livre.tsx:45-50`: the selector sits inside the outer form.

**Issue:** `FormularioCliente` is a Radix `Dialog`, so it is portaled to `<body>`. In the React tree, though, it is a
descendant of `FormularioLancar`'s `<form>`. React's synthetic `submit` bubbles along the React tree, not the DOM tree,
including through portals (known React behavior). Tapping "Salvar pessoa" (`type="submit"`) or pressing Enter in the
name or phone field runs the inner handler and then the outer `onSubmit`, which calls `gravar()`.

**Failure scenario (wrong-record write):**
1. In "Lançar na agenda → Uso livre", the manager picks "Ana Souza" from the list. `pessoa` is now Ana's id.
2. She realizes it is a different Ana, taps the field again, and the list reopens with `busca = "Ana Souza"`.
3. She taps "Cadastrar “Ana Souza”", adds the surname or phone, and taps "Salvar pessoa".
   - The inner save runs, and the D-16 homonym warning will appear.
   - At the same time the outer `gravar()` runs with `clienteId` = the old Ana. It passes `esquemaReservarUsoLivre` and
     calls `reservarUsoLivre`.
4. The toast says "Uso livre reservado". `replaceState` removes `?lancar`, and the whole sheet unmounts, including the
   new-person form.

The reservation now belongs to the wrong person — the exact case D-16 exists to prevent.

In the common path (the user typed a new name, so `aoDigitar` set `pessoa` to null), nothing is written, but the
background form flashes "Escolha quem vem." and moves focus.

**Fix:** stop the event at the inner form, and make the outer form ignore submits that did not come from itself:
```tsx
// formulario-cliente.tsx
onSubmit={(evento) => {
  evento.preventDefault();
  evento.stopPropagation(); // the dialog is portaled, but React bubbles submit through the React tree
  void gravar(confirmarPeloPrimario);
}}

// folha-lancar.tsx (defense in depth)
onSubmit={(evento) => {
  evento.preventDefault();
  if (evento.target !== evento.currentTarget) return; // a nested form (portaled dialog) is not this one
  void gravar();
}}
```
Add an e2e test: pick a person, tap "Cadastrar “…”", save, and check that no `usos_livres` row was created.

### CR-02: Presence (UI-D11) that fails to save after "Pronto" is never reported — the optimistic "Veio" was the last thing the manager saw

**Files:**
- `components/amassa/agenda/linha-inscrito.tsx:68-90`: the error goes into this component's own state, via `setErro`.
- `components/amassa/agenda/semana-da-agenda.tsx:249-259`: `fechar()` unmounts the sheet right away.
- `components/amassa/agenda/gravacoes-pendentes.ts:26-32`: it counts writes but not failures.

**Issue:** The flow the code itself documents is: tap Veio/Faltou for each person without waiting, then tap "Pronto"
(05-08-SUMMARY, gravacoes-pendentes header).
- `fechar()` calls `setAberto(null)`. `FolhaEvento` and every `LinhaInscrito` unmount at once, and only the URL change
  waits for pending writes.
- If a `definirPresenca` then returns `{ ok: false }` (network, a refusal such as a date cancelled on another phone, a
  DB error), `setErro(fraseFalhaAoMarcarPresenca(...))` runs on an unmounted component. The UI-SPEC E6 error ("Não deu
  para marcar a presença de {nome}. Toque de novo.") is never shown.
- If the action rejects outright (fetch failed), the error is thrown from a transition whose component is already gone.
  Again, nothing visible.

**Failure scenario:**
1. At the class on a weak signal, the manager marks 8 students "Veio" and taps "Pronto" while 2 writes are still in
   flight.
2. One fails. The sheet is already closed and no toast fires.
3. For today's class the card has no "marcar presença" tag (that tag only appears on past dates, AGE-08), so the missing
   presence goes unnoticed until someone audits it.

This is the core-value flow, and the screen showed a state the server did not save.

**Fix:** report failures at a level that survives the unmount. For example, have `registrarGravacao` take a failure
callback that raises a global `toast.error` (sonner lives outside the sheet):
```ts
// linha-inscrito.tsx
const resultado = await registrarGravacao(definirPresenca({...})).catch(() => ({ ok: false as const, erro: "" }));
if (!resultado.ok) {
  const frase = fraseFalhaAoMarcarPresenca(inscrito.nome);
  setErro(frase);
  if (!montado.current) toast.error(frase, { duration: 10000 }); // the sheet already closed
}
```
Or simpler: on "Pronto" with `pendentes > 0`, keep the sheet open ("Gravando…") until `depoisDasGravacoes` runs, then
close only if no row has an error.

## Warnings

### WR-01: A network failure while marking presence replaces the whole Agenda with "Não deu para carregar a agenda"

**File:** `components/amassa/agenda/linha-inscrito.tsx:72-78` and `83-89`

**Issue:** Every other mutating component in the Agenda wraps its server action in `try/catch`. `colocar-alguem`,
`confirmar-*`, `folha-*` and `material-do-uso-livre` all do (grep: 19 call sites). `LinhaInscrito` does not, in either
`marcar` or `marcarDireito`. When the action promise rejects ("Failed to fetch" on a dropped mobile connection), the
async function passed to `startTransition` throws. React 19 sends that to the nearest error boundary, which is
`app/gestao/(app)/agenda/error.tsx`.

**Failure scenario:** the manager loses signal for a second while marking presence. The open sheet and the week vanish
and are replaced by "Não deu para carregar a agenda… Tentar de novo". That is the wrong message (it was a save, not a
load), the optimistic marks on screen are lost, and so is the UI-SPEC E6 behavior (segment goes back, phrase under the
row).

**Fix:**
```ts
let resultado;
try {
  resultado = await registrarGravacao(definirPresenca({ inscricaoId: inscrito.id, presenca: desejada }));
} catch {
  resultado = { ok: false as const, erro: FRASE_FALHA_PRESENCA_GENERICA };
}
```
Apply the same to `marcarDireito`.

### WR-02: Presence refusal drops the server's reason, and the sheet is never refreshed, so "Toque de novo" fails forever

**Files:** `components/amassa/agenda/linha-inscrito.tsx:75-77` and `86-88`; `lib/agenda/acoes.ts:235-238`

**Issue:**
- When `definirPresenca` refuses with `FRASE_DATA_CANCELADA` ("Esta data foi cancelada — a tela foi atualizada.") or
  `FRASE_LANCAMENTO_NAO_EXISTE`, the row throws away `resultado.erro` and shows "Não deu para marcar a presença de {nome}.
  Toque de novo."
- On a `RecusaDaAgenda`, `definirPresenca` returns without calling `revalidarTelasDaAgenda`. (`definirDireitoARepor` does
  call it, at line 299.) So the sheet stays on the stale "not cancelled" state.

**Failure scenario:** Andressa cancels the date on her phone while Theo is marking presence on his. Each of Theo's taps
shows "Toque de novo", he taps again, it is refused again, and the reason is never shown.

**Fix:** show `resultado.erro` when it is one of the `RecusaDaAgenda` phrases (or always, since the server phrases are
already human), and call `router.refresh()` on refusal. On the server, revalidate in the `RecusaDaAgenda` branch, as
`definirDireitoARepor` already does.

### WR-03: The "Cancelar esta data" confirmation can show a stale loss count, and the confirmed cancel wipes more presences and repor credits than it said

**Files:** `components/amassa/agenda/confirmar-cancelar-data.tsx:138-145`, `111`; `lib/agenda/acoes.ts:548-568`

**Issue:** `aoTocarEmCancelar` opens the confirmation from the snapshot `evento.perdasAoCancelar`, taken when the sheet
was last rendered. Confirming sends `confirmado: true`, which skips `contarPerdasAoCancelar` on the server entirely. The
server then clears `presenca` and `direito_a_repor` for every enrolment of the date, however many there are now. The
comment at lines 56-58 ("o servidor confere de novo sob a trava…") is only true for the unconfirmed path.

**Failure scenario:**
1. Theo opens the date and sees 1 presence marked.
2. Meanwhile Andressa marks 6 more on her phone, two of them "Faltou + tem direito a repor".
3. Theo taps Cancelar, and the dialog says "1 presença já marcada nesta data se perde."
4. He confirms. 7 presences and 2 repor credits are erased, and "Desfazer" does not bring them back (by design).

This breaks the CLAUDE.md rule "toda remoção … diz o que será perdido".

**Fix:** send the snapshot the user saw, `confirmado: { presencas, inscricoesAReceber }`. Have the server recount under
the lock and return `situacao: "confirmar"` with the fresh numbers whenever the current losses exceed what was confirmed.

### WR-04: A failed read of `?evento=` takes down the whole Agenda page instead of erroring inside the sheet (UI-SPEC line 618)

**Files:** `app/gestao/(app)/agenda/page.tsx:398-403`; `components/amassa/agenda/folha-evento.tsx` (no error state);
`lib/agenda/textos.ts:61` (`FRASE_ERRO_CARREGAR_AULA` is unused, confirmed by grep)

**Issue:**
- `obterEvento(idDoEvento, hoje)` sits in the `Promise.all` with no `try`. `lerTurma` and `lerUsoLivre` beside it each
  catch errors and return `{ estado: "erro" }`.
- The UI-SPEC copy table says loading a sheet (event, use, class, profile…) fails with "Não deu para carregar esta
  aula…" plus "Tentar de novo", inside the sheet.
- The phrase exists in `lib/agenda/textos.ts` but nothing renders it.

**Failure scenario:** a transient DB error while tapping a card, or opening the Início link `?evento=`, replaces the week
with `error.tsx`. The manager loses the week view and her scroll position for a single sheet's read.

**Fix:** wrap it the way `lerTurma` is wrapped (`EventoDoServidor = nenhum | carregado | inexistente | erro`). Add
`erroAoCarregar` to `FolhaEvento`, rendering `FRASE_ERRO_CARREGAR_AULA` and a `router.refresh()` button in place of the
skeleton.

### WR-05: The payment tag in the "Quem vem" row is still `whitespace-nowrap` — the same 320px overflow 9b640e2 fixed on the card

**Files:** `components/amassa/agenda/linha-inscrito.tsx:105, 129`; `components/amassa/agenda/cartao-evento.tsx:69`

**Issue:** `TagDePagamento` always includes `whitespace-nowrap`. 9b640e2 overrode it with `whitespace-normal` only in
`CartaoEvento`. In `LinhaInscrito` the row is `grid-cols-[1fr_auto]`, and the right column holds the Veio/Faltou
segment.

Arithmetic at 320px (estimated, not measured):
- Content width: 272px.
- Segment width: about 145–165px, depending on which side is marked (icon included).
- Gap: 16px.
- That leaves the name and tag column about 90–110px.
- "lançado na Venda" at 14px semibold plus `px-2` is about 130px, and "venda nº 1234 cancelada" is about 185px (the
  figure 9b640e2 measured).

The tag therefore overflows its column under the segment buttons. The sheet body is `overflow-y-auto`, which makes
`overflow-x` compute to `auto`, so the sheet scrolls sideways. No e2e `estourosA320` check covers `folha-evento`
(grep of `tests/e2e`).

**Failure scenario:** a 320px phone opens a class date where a student's monthly fee is "lançado na Venda". The row
overlaps the Veio button and the sheet scrolls sideways, on the screen the Valor central lives on.

**Fix:** pass `className="whitespace-normal"` in `linha-inscrito.tsx:129`, or better, drop `whitespace-nowrap` from
`TagDePagamento`'s default and opt in only where width is guaranteed. Extend the `estourosA320` ruler to an open
`folha-evento` with a "venda nº {10 digits} cancelada" student.

### WR-06: A lost response on "Lançar turma/aula/reserva" lets a retry create a duplicate

**File:** `components/amassa/agenda/folha-lancar.tsx:422-427`

**Issue:** On `catch`, `emVoo` is released and the sheet invites a retry ("FRASE_FALHA_AO_LANCAR"). `lancarTurma`,
`lancarAvulsa`, `reservarUsoLivre` and `fecharDia` are plain inserts with no idempotency key. `lib/agenda/acoes.ts:315-319`
says it explicitly: two launches create two independent records.

**Failure scenario:** the turma insert commits on the server, but the response is lost on mobile. The manager sees the
error and taps "Lançar turma" again. That creates a second turma with N duplicate dates, and a second public card once
it is marked public. "Recebi agora", the batch and "Dispensar" are protected under a lock; this path is not.

**Fix:** generate a `chaveDeEnvio = crypto.randomUUID()` when the form mounts. Send it with the launch and store it in a
unique column (or check it inside the transaction), and treat a repeat as success that returns the original id.

### WR-07: `cobrancaParaVenda` is started before an unrelated `await Promise.all` and can reject unhandled

**File:** `app/gestao/(app)/financeiro/page.tsx` (diff hunk: `const cobrancaDaOrigem = … cobrancaParaVenda(origemDaVenda)`,
awaited only after the big `Promise.all`, at `const vendaDaAgenda = await cobrancaDaOrigem;`)

**Issue:** The promise has no handler attached while the `Promise.all` runs.
- If `cobrancaParaVenda` rejects first (DB hiccup), Node records an unhandled rejection at the next microtask
  checkpoint.
- If the `Promise.all` rejects first, the page throws and `cobrancaDaOrigem` is never awaited at all.

Next does register a process-level handler, so this is log noise plus `PromiseRejectionHandledWarning` rather than a
crash. It is still a floating promise on the Venda page.

**Fix:** put it inside the same `Promise.all`, or attach a handler where it is created:
```ts
const cobrancaDaOrigem = (...).catch((erro) => { console.error(...); return { situacao: "nao_achada" } as const; });
```
Showing `OrigemIndisponivel` on failure is also the safe UI: never a cart built from unknown data.

## Info

### IN-01: Enter in the person search box (no option highlighted) submits the launch form

**File:** `components/amassa/agenda/seletor-pessoa.tsx:194-197` with `folha-lancar.tsx:550`

**Issue:** Enter is only intercepted when `expandido && ativa >= 0`. After typing, `ativa` is -1, so Enter is an
implicit submit of the outer form: `gravar()` runs with `pessoa = null` and all the "Escolha quem vem." errors flash.

**Fix:** in the combobox `onKeyDown`, always `preventDefault()` Enter. If there is exactly one option, choose it.

### IN-02: Enter in "Marcar mais N semanas" runs "Salvar turma", not "Marcar mais"

**File:** `components/amassa/agenda/folha-turma.tsx:390-395, 469-483`

**Issue:** The input sits inside the turma edit `<form>`. If other fields are dirty, Enter saves those edits.

**Fix:** use `onKeyDown` with Enter → `preventDefault(); void marcarMais()`.

### IN-03: Toggling Cobrar/Incluso twice quickly makes the value flicker

**File:** `components/amassa/agenda/material-do-uso-livre.tsx:161-181`

**Issue:** The first call's `finally` deletes `cobrancaPendente[linha.id]` while the second toggle is still in flight. For
one round-trip the line shows the server value from the first response ("Cobrar"). It ends consistent, because the
actions are serialized.

**Fix:** track a request counter per line and only clear the pending value when the latest request finishes.

### IN-04: A free workshop shows "R$ 0,00 por pessoa" on the public site and in the sheet

**Files:** `lib/agenda/publico/agenda.ts:205`, rendered by `components/site/cartao-evento-site.tsx:33`;
`components/amassa/agenda/folha-evento.tsx:55-57`

**Issue:** The price schema accepts "0" as a free workshop (`esquemas.ts:101`), so the card reads
"R$ 0,00 por pessoa · material incluso".

**Fix:** show "Gratuita" when `precoCentavos === 0`.

### IN-05: The public page bakes "hoje" into the ISR render

**File:** `app/page.tsx:24-25, 68`

**Issue:** With `force-static` and `revalidate = 300`, the first visitor after an idle night gets the page generated
yesterday. That page shows yesterday's classes under "Próximas" and the wrong first month; background regeneration fixes
it for the next visitor.

**Fix:** accept this (low traffic), or note it in the plan. Optionally filter `data >= hoje` on the client in
`AgendaPublicaCalendario`, computing `hoje` in Brasília after mount.

### IN-06: The route skeleton draws the week while the Pessoas tab is loading

**File:** `components/amassa/agenda/a-receber.tsx:116-134` (`EsqueletoPelaAba`), used by `agenda/loading.tsx`

**Issue:** There is no branch for `aba === "pessoas"`, so it falls back to `EsqueletoDaSemana`. Then the page-level
`EsqueletoDasPessoas` replaces it, a visible change of shape.

**Fix:** add `pessoas={<EsqueletoDasPessoas />}`.

### IN-07: "Desfazer" in Dispensadas hides the server's reason

**File:** `components/amassa/agenda/dispensadas.tsx:99-101`

**Issue:** A refusal (for example, the charge was launched on another phone) shows the generic
`FRASE_FALHA_AO_DESFAZER_DISPENSA` instead of `resposta.erro`, and does not refresh.

**Fix:** show `resposta.erro`, then call `router.refresh()`.

### IN-08: After a refusal, "Tirar o bloqueio" closes without refreshing

**File:** `components/amassa/agenda/confirmar-tirar-bloqueio.tsx:95-102`

**Issue:** Unlike `ConfirmarCancelarReserva`, `ConfirmarTirarMaterial` and `ConfirmarTirarDaLista`, closing the dialog
after a refusal ("Isso já tinha sido removido.") does not re-read, so the closed-day sheet stays on screen showing a block
that no longer exists.

**Fix:** mirror `aoFecharDepoisDaRecusa` with `router.refresh()`.

### IN-09: The turma edit form remounts and drops typed edits when a background revalidation changes a keyed field

**File:** `components/amassa/agenda/folha-turma.tsx:197-198`

**Issue:** The `key` includes every editable field. Any action that revalidates `/agenda` while the form is open (for
example, the other manager saving the same turma) remounts `ConteudoDaTurma` with the server values, and the unsaved
input is lost without notice.

**Fix:** key only on `id` and `ativa`. After a successful save, reset `valores` from the new props explicitly. Optionally
show "Esta turma mudou em outro celular" when the props diverge from `originais`.

---

_Reviewed: 2026-10-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
