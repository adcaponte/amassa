# Deferred items — Phase 3 (Gestor de Encomendas)

Items discovered during execution that are out of scope for the current plan (pre-existing,
unrelated to the task's own changes) — logged, not fixed, per the executor's scope boundary.

## 03-01

- **`tests/e2e/autenticacao.spec.ts` — "a sexta tentativa seguida no mesmo e-mail mostra a
  mensagem de bloqueio com os minutos" times out intermittently on the `desktop` project
  (`page.waitForResponse` exceeds the 60s test timeout).** Reproduced in isolation (running only
  this test, `--grep "sexta tentativa"`), unrelated to any file this plan touches (auth, rate
  limiting, login) — confirmed pre-existing flakiness in the rate-limit e2e test's timing
  assumptions, not a regression introduced by Phase 3. Out of scope for 03-01 (scope boundary:
  "Only auto-fix issues DIRECTLY caused by the current task's changes"). Worth a dedicated look
  in a future phase/plan if it keeps recurring.
