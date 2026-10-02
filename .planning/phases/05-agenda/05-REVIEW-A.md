---
phase: 05-agenda
reviewed: 2026-10-02T00:00:00Z
depth: deep
files_reviewed: 46
files_reviewed_list:
  - app/api/health/agenda/route.ts
  - conteudo/site.ts
  - db/migrations/0026_agenda.sql
  - db/schema.ts
  - lib/agenda/abas.ts
  - lib/agenda/acoes.ts
  - lib/agenda/consultas.ts
  - lib/agenda/espaco.ts
  - lib/agenda/esquemas.ts
  - lib/agenda/gravacao.ts
  - lib/agenda/horario.ts
  - lib/agenda/mensalidade.ts
  - lib/agenda/numeros.ts
  - lib/agenda/presenca.ts
  - lib/agenda/publico/agenda.ts
  - lib/agenda/publico/consultas.ts
  - lib/agenda/receber.ts
  - lib/agenda/reposicao.ts
  - lib/agenda/seletor.ts
  - lib/agenda/semana.ts
  - lib/agenda/textos.ts
  - lib/agenda/tipos.ts
  - lib/agenda/turma.ts
  - lib/agenda/uso-livre.ts
  - lib/agenda/vagas.ts
  - lib/cadastros/abas.ts
  - lib/cadastros/acoes.ts
  - lib/cadastros/consultas.ts
  - lib/cadastros/textos.ts
  - lib/clientes/acoes.ts
  - lib/clientes/consultas.ts
  - lib/clientes/esquemas.ts
  - lib/clientes/lista.ts
  - lib/clientes/textos.ts
  - lib/estoque/destinos.ts
  - lib/estoque/esquemas.ts
  - lib/estoque/gravacao.ts
  - lib/estoque/pedidos.ts
  - lib/financeiro/abas.ts
  - lib/financeiro/acoes.ts
  - lib/financeiro/esquemas.ts
  - lib/financeiro/formato.ts
  - lib/financeiro/gravacao.ts
  - lib/financeiro/navegacao.ts
  - scripts/testar-migracoes.mjs
  - scripts/testar-site-sem-banco.mjs
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 05: Code Review Report (A, server side)

**Reviewed:** 2026-10-02
**Depth:** deep (cross-file: Agenda → Financeiro `gravarVenda`/`lancarVenda` → Estoque `gravarMovimentacoes`)
**Range:** `cfd0990..9b640e2` (live in production, 0026 applied)
**Status:** issues_found

## Summary

I focused on money integrity, authorization and validation, deletes, the public site query, the D-06 stock exits, and time handling.

Most of the phase holds up. Every exported Server Action in `lib/agenda/acoes.ts` (27), `lib/clientes/acoes.ts` (2) and `lancarVenda` calls `exigirUsuario()` as its first statement. Prices, people, descriptions, areas and origin tokens are all read or derived on the server; the client only sends ids, desired states and wall-clock times. Drizzle errors are read through `codigoDoErroPostgres` (`erro.cause.code`), never `erro.code`. The enum checks compare `destino::text`. `gravarVenda` is a faithful extraction: I compared the diff line by line and the documento → linhas → baixa → parcelas order, the frozen card fee and the `areasDasCategorias` lookup are the same. The public query never selects people, contacts, presence, uso livre or the reason a day is closed.

**One BLOCKER, proven empirically.** The "one charge → at most one active sale" guard can be bypassed when two requests on the same charge overlap. The guard requires `numeroDaVenda !== null`, but that value comes from a LEFT JOIN on `documentos`, which is not locked. In Postgres READ COMMITTED, when the second transaction finishes waiting for the row lock, it re-reads only the row it locked (EvalPlanQual). It sees the new `documento_id`, but the joined `documentos` columns come back NULL. I reproduced this on a throwaway `postgres:17-alpine` container with the exact join shape used by `lerMensalidadesCobradas`. Result after the wait: `documento_id=11, numero=NULL, cancelado_em=NULL`. The guard then lets the second request through and a second active sale is created.

The existing e2e "toque duplo / duas abas" test does not cover this. Next.js runs Server Actions from one browser one after another, and the two-tab case in the test is sequential, so neither ever waits on the lock.

### Files read

- **Read in full:** `lib/agenda/{acoes,gravacao,consultas,receber,esquemas,mensalidade,uso-livre,numeros,presenca,reposicao,vagas,horario,tipos,turma,espaco,semana,seletor,abas}.ts`, `lib/agenda/publico/{agenda,consultas}.ts`, `lib/clientes/{acoes,consultas,esquemas,lista}.ts`, `lib/financeiro/gravacao.ts`, `db/migrations/0026_agenda.sql`.
- **Read in full as diffs:** `lib/financeiro/{acoes,esquemas,navegacao,formato,abas}.ts`, `lib/cadastros/{abas,acoes,consultas,textos}.ts`, `lib/estoque/{destinos,esquemas,gravacao,pedidos}.ts`, `app/api/health/agenda/route.ts`, `conteudo/site.ts`, `scripts/testar-site-sem-banco.mjs`.
- **Read partially:**
  - `db/schema.ts`: diff head plus targeted greps. The migration it mirrors was read in full.
  - `lib/agenda/textos.ts`: the list of exported functions plus the sections the findings depend on. The rest is string constants.
  - `scripts/testar-migracoes.mjs`: only `TABELAS_ESPERADAS`. It is test code.
- **Not opened:** `lib/clientes/textos.ts` (string constants only).
- **Read as context (outside the list):** `app/page.tsx`, `components/site/agenda-publica.tsx`, `lib/erro/postgres.ts`, `lib/estoque/gravacao.ts::travarItens`, `tests/e2e/agenda-receber.spec.ts`.

## Critical Issues

### CR-01 (BLOCKER): Two "Recebi agora" / "Lançar na Venda" / lote requests on the same charge create two active sales

**Files:**
- `lib/agenda/acoes.ts:1812-1814` (`receberAgora`)
- `lib/agenda/gravacao.ts:1067-1070` (`vincularCobranca`, called by `lancarVenda` in `lib/financeiro/acoes.ts`)
- Root cause: `lib/agenda/gravacao.ts:760-761, 783` / `811-812, 837` / `873-874, 889` (`documentos.numero` and `canceladoEm` come from a LEFT JOIN on a table that is not locked, under `for no key update of <cobrança>`)
- Same root cause, delete path: `lib/agenda/gravacao.ts:252-279` (`travarInscricaoComVenda`) and `lib/agenda/acoes.ts:806` (`tirarDaLista`)

**Issue:** The guard is

```ts
if ((situacao === "lancado" || situacao === "pago") && cobranca.numeroDaVenda !== null) throw …
```

`situacao` is derived from `documentoId`, which belongs to the locked row, so it is correct after the wait. `numeroDaVenda` belongs to the joined `documentos` row, which is not locked. On a lock wait, Postgres re-checks the locked row (EvalPlanQual) but re-fetches the non-locked relations from the original snapshot. The nullable side of the LEFT JOIN had no row, so its columns come back NULL. (In the re-launch case the old cancelled document no longer matches the new `documento_id`, so the same thing happens.)

**Failure scenario:** Two gestores on two phones, or "Recebi agora" racing the lote or "Lançar na Venda":
1. T1 locks mensalidade M, creates venda nº 8, sets `documento_id`, commits.
2. T2 was waiting on M's lock. It wakes up with `documentoId = <nº 8>`, `numeroDaVenda = null`, `canceladoEm = null`.
3. `situacaoDaCobranca` returns `"lancado"` or `"pago"`, but `numeroDaVenda !== null` is false, so no refusal. The dispensada, cancelled-date and valor checks all pass.
4. T2 runs `gravarVenda` and creates venda nº 9, then `vincularVenda` points M at nº 9.

Result: two active sales for one charge, both counted in the Caixa (paid twice in cash/PIX/card for "Recebi agora"). Venda nº 8 is orphaned with no link, so the D-08 derivation can never surface it again.

I reproduced this on Postgres 17: the second session got `documento_id=11, numero=NULL, cancelado_em=NULL`.

The same mechanism lets `tirarDaLista` delete an inscription that was linked to an active sale a moment earlier. `travarInscricaoComVenda` does not even select `inscricoes.documentoId`, so `venda` comes back `null` and D-08's refusal is skipped.

`definirDispensa` (`acoes.ts:2010`) passes the same guard, but `podeDispensar` then refuses it. That path is safe, but the user gets the wrong message.

The lote (`acoes.ts:1909-1912`) checks only `situacao`, so it is not affected.

The comment at `gravacao.ts:976-981` ("o segundo lê o `documento_id` que o primeiro gravou") is true but misleading: it reads the id, not the venda behind it.

**Fix:** Decide on the column from the locked row, never on the joined one. After the lock, re-read the venda in a fresh statement (a new READ COMMITTED snapshot):

```ts
// receberAgora / vincularCobranca / definirDispensa
const situacao = situacaoDaCobranca(cobranca);
if (situacao === "lancado" || situacao === "pago") {
  // numeroDaVenda can be null after a lock wait (EPQ): look it up by documentoId in its own statement.
  const numero = cobranca.numeroDaVenda ?? (await numeroDaVenda(tx, cobranca.documentoId!));
  throw new RecusaDaAgenda(fraseJaLancado(numero));
}
```

Better still: in `cobrancaPorReferencia`, when `travar` is true, lock only the charge table (no join to `documentos`). Then read `documentos.numero` and `cancelado_em` for the `documento_id` you got back in a second query, which always sees committed state.

Do the same in `travarInscricaoComVenda`: select `inscricoes.documentoId` and resolve the venda in a second statement. Add an integration test that runs two transactions that really overlap: hold T1 open with a `pg_sleep`, or use a second connection with a barrier.

## Warnings

### WR-01 (WARNING): `desativarTurma` can delete an inscription that just became an active sale

**File:** `lib/agenda/acoes.ts:1006-1010`, `lib/agenda/gravacao.ts:396-410, 444-455`

**Issue:** `vendaAtivaEmDataFutura` is checked under the TURMA lock only. "Recebi agora" or "Lançar na Venda" on a charged experimental in a future date of that turma locks only the INSCRIÇÃO (it never touches the turma or the event lock).

Failure interleaving:
1. Desativar checks and finds no active sale.
2. Receber locks the inscription, creates venda nº N, sets `documento_id`.
3. Desativar's `delete from inscricoes where evento_id in (…)` waits on that row.
4. Receber commits. The delete's WHERE is re-checked, still matches, and deletes the inscription.

Venda nº N stays active with no Agenda link, which violates D-08 ("a Agenda nunca some com uma venda ativa").

**Fix:** In `tirarDatasFuturasDaTurma`, first lock the future inscriptions with `for update`, in id order. Then re-run the active-sale check in a new statement and refuse if anything turned up. Alternatively, restrict the delete to `documento_id is null or exists (select 1 from documentos d where d.id = documento_id and d.cancelado_em is not null)` and refuse when the deleted count is smaller than the locked count.

### WR-02 (WARNING): Undoing a date cancellation brings back stale `publico`, time and vacancies; a private turma reappears on the public site

**File:** `lib/agenda/acoes.ts:540-545` (undo), `lib/agenda/acoes.ts:876-880` (`editarTurma` updates only `data > hoje AND cancelado_em IS NULL`), `lib/agenda/publico/consultas.ts:55-63`

**Issue / scenario:**
1. Turma T is public. The gestor cancels its 15/10 date.
2. Later the gestor edits T to `publica = false` and moves it from 19:00 to 18:00. The cancelled date is skipped by the edit.
3. The gestor undoes the 15/10 cancellation.

The date comes back with `publico = true`, the old 19:00 time and the old vacancies. The public query filters only `eventos.publico` and `turmas.ativa`, so the private turma's name, schedule and price reappear on the site. The internal agenda also shows the wrong time.

Related: today's date of a turma that was just made private stays on the site until the day ends, because A9 only updates `data > hoje`.

**Fix:** In `cancelarData`, when undoing (`!dados.cancelada`) on a `turma` event, copy `inicio, fim, vagas, publico` from the turma, read under the lock. Alternatively, make `editarTurma` also update cancelled future dates. For the site, join `turmas` in `lerAgendaPublica` and require `turmas.publica = true` for `tipo = 'turma'`.

### WR-03 (WARNING): D-02 generation bills full mensalidades for months with zero classes

**File:** `lib/agenda/gravacao.ts:547-558` vs `lib/agenda/mensalidade.ts:76-78`

**Issue:** `garantirMensalidadesDoMes` inserts a full mensalidade for every active student of every active turma, whatever the turma's dates in that month. `entrarNaTurma`, through `valorProporcional`, decides `"nenhuma"` when the month has no classes. The two rules contradict each other.

**Concrete scenario (likely now, with the December 2026 opening):**
1. In October, the gestor launches a turma "a partir de" 01/12 and enrolls students. Entry decides "nenhuma" for October, correctly.
2. On 01/11, opening the Início creates a full November mensalidade for every student. That month has no class.
3. These show up in "A receber" and in the lote. One tap on "Lançar estas N na Venda" turns them into sales.

The same happens when a turma's generated weeks run out without "Marcar mais semanas".

D-02 says "uma por aluno e mês", so confirm with the owner. The current behavior contradicts AGE-07's own "nenhuma" rule.

**Fix:** Add `and exists (select 1 from eventos e where e.turma_id = t.id and e.cancelado_em is null and e.data between <dia 1> and <último dia>)` to the insert-select. Alternatively, ask the owner and record the rule in CONTEXT.

### WR-04 (WARNING): "Desativar turma" confirmation does not say everything it deletes

**File:** `lib/agenda/gravacao.ts:417-433` (`contarPerdasAoDesativar`), `453` (delete), `lib/agenda/textos.ts:514-528`

**Issue:** `tirarDatasFuturasDaTurma` deletes every inscription in the future dates. The count only tells the user about dates and reposições. Not disclosed:
- charged experimentals still in "A receber", plus dispensed ones and ones with a cancelled sale; they leave "A receber" silently;
- faltas avisadas in advance with `direito_a_repor`, which are credits; their deletion lowers the student's balance, can make an already-used reposição "excedido", and is invisible;
- presence marks already recorded on future dates.

CLAUDE.md §Exclusão: "Toda remoção pede confirmação e diz o que será perdido."

**Fix:** Extend `PerdasAoDesativar` with `aReceber` (charged, not dispensed, no active sale) and `creditos` (`presenca = 'faltou' and direito_a_repor`), and say both in `corpoConfirmarDesativarTurma`. The server should re-count under the lock and return `confirmar` when the numbers changed, the same pattern as `cancelarData`.

## Info

### IN-01 (INFO): Reposição credit is serialized on one side only

**File:** `lib/agenda/acoes.ts:294` (`definirDireitoARepor`), `229-232` (`definirPresenca` clears `direito`), `558-567` (`cancelarData` clears it)

**Issue:** Only "use a credit" (`colocarNaData`, `reposicao`) locks the CLIENTE. Removing a credit takes no client lock. A concurrent "untick direito" and "use last credit" can both commit, leaving a negative balance (`excedido`).

**Fix:** Lock the inscription's client (`travarCliente`) before clearing `direito_a_repor`. Order: EVENT → CLIENT → INSCRIPTION.

### IN-02 (INFO): Deterministic refusals tell the user to "check the internet"

**File:** `lib/agenda/acoes.ts:803-805` (`tirarDaLista` on an `aluno` returns `FRASE_FALHA_AO_TIRAR_DA_LISTA`), `683-685` (`oficina` mode on a non-avulsa date returns `FRASE_FALHA_AO_COLOCAR`)

**Issue:** Both phrases say "Verifique a internet e tente de novo". These are rule refusals, not network failures, which breaks CLAUDE.md §Mensagens.

**Fix:** Use a dedicated phrase, e.g. "Aluno sai pela ficha da pessoa, em “Sair da turma”."

### IN-03 (INFO): The system items' "Tem estoque próprio" can still be edited

**File:** `lib/cadastros/acoes.ts:614-625`

**Issue:** D-17 protects `ativo`, `aparece_na_venda` and the key, but `controla_estoque` and `unidade` remain editable on "Mensalidade", "Inscrição em oficina" and "Uso livre (hora)". If one is ticked, every Agenda sale (an item line with quantity 1) writes a stock exit through `pedidosDaVenda`.

**Fix:** Keep `controlaEstoque` and `unidade` from `itemAtual` when `chaveDoSistema !== null`, as is already done for `aparecenaVenda`. Optionally add it to the trigger too.

### IN-04 (INFO): `marcarChegada` on a closed uso returns success

**File:** `lib/agenda/acoes.ts:1319-1323`

**Issue:** Any uso with `chegada` set, including `encerrado`, returns `{ jaEstavaMarcada: true }` (ok). The screen shows "chegada marcada" for a uso that was already closed on another phone.

**Fix:** When `atual.estado === "encerrado"`, return `FRASE_USO_JA_ENCERRADO`.

---

_Reviewed: 2026-10-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
