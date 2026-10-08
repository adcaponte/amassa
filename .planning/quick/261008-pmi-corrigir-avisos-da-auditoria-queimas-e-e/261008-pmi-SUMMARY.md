---
phase: quick-261008-pmi
plan: 1
subsystem: queimas/financeiro + estoque
status: complete
tags: [auditoria, concorrencia-otimista, custo-medio, contagem, tdd, sem-migracao]
requires:
  - phase: quick-261005-2yu
    provides: "vendasVistas + vendasAtivasMudaram + RecusaDasQueimas com telaMudou (a866128) — reusados sem mecanismo novo"
provides:
  - "Lançar na Venda (Queimas) com o retrato das vendas ativas, conferido sob travarContagem; o reenvio depois de resposta perdida é recusado citando a venda"
  - "Frases de rede da Venda que não afirmam que nada foi gravado (com origem: pode tocar de novo; manual: confira no Caixa)"
  - "Estoque: entrada de R$ 0 não vira referência de custo — em memória e nas duas leituras do banco; teveEntrada decide “—”"
  - "Estoque: tiraDaPrimeiraContagem (pura) decide o modo da contagem na tela e no servidor"
affects: [lancarVenda, PainelVenda, provar-corridas-das-queimas, valorarMovimento, lerEstados, lerSaldos, gravarContagem, listarParaContagem]
tech-stack:
  added: []
  patterns:
    - "Retrato da tela (vendasVistas) obrigatório só na origem que o tem, proibido nas outras (pedido forjado)"
    - "Painel não relê a página numa falha de rede — o retrato congelado é o que faz o segundo toque ser recusado; relê (router.refresh) só na recusa telaMudou, e a key da página remonta o painel"
    - "Regra de modo por combinações distintas (tipo, motivo, comCusto) aplicadas à mesma função pura na tela e no servidor"
key-files:
  created: []
  modified:
    - lib/queimas/gravacao.ts
    - lib/queimas/textos.ts
    - lib/queimas/consultas.ts
    - lib/queimas/contagem.ts
    - lib/financeiro/esquemas.ts
    - lib/financeiro/textos.ts
    - lib/financeiro/acoes.ts
    - components/amassa/financeiro/painel-venda.tsx
    - app/gestao/(app)/financeiro/page.tsx
    - scripts/provar-corridas-das-queimas.ts
    - lib/estoque/custo.ts
    - lib/estoque/saldo.ts
    - lib/estoque/contagem.ts
    - lib/estoque/gravacao.ts
    - lib/estoque/consultas.ts
    - components/amassa/estoque/provedor-estoque.tsx
    - components/amassa/estoque/lista-contagem.tsx
    - tests/unit/textos-queima.test.ts
    - tests/unit/financeiro-esquemas.test.ts
    - tests/unit/estoque-custo.test.ts
    - tests/unit/estoque-saldo.test.ts
    - tests/unit/estoque-contagem.test.ts
    - tests/unit/estoque-textos.test.ts
    - tests/e2e/queimas-venda.spec.ts
    - tests/e2e/polimento-estoque.spec.ts
    - tests/e2e/estoque-contagem.spec.ts
decisions:
  - "Decisão 1: a frase de rede foi ajustada em GERAL (só texto, ramo não-correção): com origem (Agenda ou Queimas) diz que pode tocar de novo; Venda manual manda conferir no Caixa. O ramo da correção ficou intacto (P2)"
  - "Decisão 1: na recusa telaMudou o painel mostra só o toast (não o alerta) e relê a página; a key do PainelVenda nas Queimas inclui as vistas, então a releitura remonta o painel com o que falta agora"
  - "Decisão 1: lancarVenda recusa com FRASE_VENDA_DESATUALIZADA se a origem queima chegar sem vistas (defesa além do esquema); nunca pula a conferência"
  - "Decisão 2: custoMedioParaExibir = null sem teveEntrada; senão custoMedioCentavosPorUnidade ?? 0 (só doação com saldo zerado = “sem custo”)"
  - "Decisão 3: as leituras das combinações manuais (tela e servidor) filtram estorno_de_id is null — movimentações manuais não têm estorno hoje; é só robustez"
metrics:
  duration: "~1 h 40 min (08/10/2026, tarde)"
  completed: 2026-10-08
actuals:
  tokens: 23400
  tasks: 3
  commits: 4
requirements-completed: [AUDITORIA-0810-QUEIMAS-AVISO-1, AUDITORIA-0810-ESTOQUE-AVISO-1, AUDITORIA-0810-ESTOQUE-AVISO-2]
---

# Quick 261008-pmi: os três avisos confirmados da auditoria de 08/10 corrigidos (Queimas e Estoque) Summary

**O "Lançar na Venda" das Queimas leva o retrato das vendas ativas e é recusado sob a trava num reenvio depois de resposta perdida; a entrada de R$ 0 deixa de ser referência de custo do Estoque; e uma baixa manual antes da primeira contagem não impede mais o "Custou ao todo". Tudo com teste antes da correção, sem migração, no `main` local, não publicado.**

## O que mudou, por defeito

### Queimas, aviso 1 — "Lançar na Venda" duplicava no reenvio (Decisão 1)
- `queimaParaVenda` devolve `vendasVistas` (`numerosDasVendasAtivas`); a página as põe no `OrigemNoPainel` e na `key` do `PainelVenda` (origem + ":" + números).
- `esquemaVenda`: `vendasVistas` (inteiros positivos, no máximo 500, redeclarado — D-15) **obrigatório só com origem `queima`** (ausente → `FRASE_VENDA_DESATUALIZADA`); presente sem origem, com origem da Agenda ou com `correcao` → recusa (pedido forjado). Saída ganha `vendasVistas: number[] | null`.
- `vincularQueimaNaVenda(tx, queimaId, vendasVistas)`: depois de "nada falta" e antes de ler os itens/`cabeNoQueFalta`, `vendasAtivasMudaram` → `RecusaDasQueimas(fraseVendasMudaramNaVenda(novas), { telaMudou: true })`. `vendasAtivasMudaram` agora é chamada três vezes em `gravacao.ts` (Recebi agora, excluir, Lançar na Venda).
- `lancarVenda`: `exigirUsuario()` continua a primeira instrução; `ResultadoDoLancamento` ganha `telaMudou?: true`; o `catch` traduz a recusa de tela velha.
- `PainelVenda`: manda `vendasVistas` (cópia) quando há origem das Queimas; `telaMudou` → `toast.error` + `router.refresh()`; `catch` de rede (fora da correção) → `FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM` ou `FRASE_VENDA_SEM_RESPOSTA`, **sem** `router.refresh()` (o retrato precisa continuar o da abertura). `FRASE_FALHA_AO_SALVAR` saiu do import do painel.

### Estoque, aviso 1 — entrada de R$ 0 virava a última entrada com preço (Decisão 2)
- `valorarMovimento`: só `entrada_com_preco` com `pagoCentavos > 0` vira `ultimaEntradaComPreco`; R2/R3/R4 intactos (a doação continua somando quantidade e diluindo o médio).
- `lerEstados` (gravacao.ts) e `lerSaldos` (consultas.ts): `gt(movimentacoesEstoque.valorInformadoCentavos, 0)` no filtro da última entrada — a mesma regra.
- Exibição de 06.5 preservada: `SaldoDoItem`/`SaldoParaLista` ganham `teveEntrada` (5ª consulta do `Promise.all` de `lerSaldos`, `selectDistinct` de `item_id` com `tipo = 'entrada'` e sem estorno); `custoMedioParaExibir` → `null` ("—") sem `teveEntrada`, senão `custoMedioCentavosPorUnidade(...) ?? 0` ("sem custo" quando só entrou de graça e o saldo zerou). `saldoDoMaterialNovo` com `teveEntrada: false`.

### Estoque, aviso 2 — baixa manual tirava o material da primeira contagem (Decisão 3)
- `lib/estoque/contagem.ts`: `MovimentacaoParaOModo` e `tiraDaPrimeiraContagem` (motivo `saldo_inicial` → sim; tipo `ajuste` → sim; entrada com custo → sim; saída e entrada de R$ 0 sem motivo → não). `modoDoMaterial({ jaTemReferencia })`; `MaterialParaContagem.jaTemReferencia`.
- `gravarContagem` (sob a trava, como antes) e `listarParaContagem`: `selectDistinct` de `tipo`, `motivo`, `comCusto` (`coalesce(valor_informado_centavos > 0, false)`) das linhas `origem = 'manual'` sem estorno → a MESMA `tiraDaPrimeiraContagem`. `estadoDoEstoque` (painel global UI-D3) não mudou.
- `ListaContagem` congela `jaTemReferencia` na carga.

## RED visto (antes de cada correção)

| Tarefa | Comando | Resultado RED | Commit RED | GREEN |
|---|---|---|---|---|
| 1 | `npx vitest run tests/unit/textos-queima.test.ts tests/unit/financeiro-esquemas.test.ts` | **11 failed / 63 passed** — `fraseVendasMudaramNaVenda is not a function` (3); esquema aceitava sem retrato / `vendasVistas` indefinido (6); `.toMatch() expects to receive a string, but got undefined` nas frases de rede (2) | `7205508` | `dadb520` — os 4 arquivos do `<verify>`: 204 passed |
| 2 | `npx vitest run tests/unit/estoque-custo.test.ts tests/unit/estoque-saldo.test.ts tests/unit/estoque-contagem.test.ts` | **13 failed / 129 passed** — `tiraDaPrimeiraContagem is not a function` (6); `expected 'primeira' to be 'conferencia'` e agrupamento (3); estado depois da doação com `ultimaEntradaComPreco {0, …}` (2); `expected null to be +0` em `custoMedioParaExibir` (2) | `7ec9cc0` | `5d47231` — os 5 arquivos do `<verify>`: 183 passed |

## Prova das Queimas (`scripts/provar-corridas-das-queimas.ts`, dentro de `npm run test:migracoes`)
- `lancar(tx, queimaId, quantidades, vistas)` passa as vistas a `vincularQueimaNaVenda`.
- **Mudaram de sentido:** **(9a)** o "Lançar" de uma Venda aberta antes do "Recebi" (`[]`) agora é recusado pela tela velha citando a venda do Recebi ("desde que esta Venda abriu"), em vez de "só faltam 1 P"; relido (`[nº]`), cai em "Desta queima só faltam 1 P…" (a cobertura de `cabeNoQueFalta` continua). **(10)** o "Lançar" sobreposto com `[]` agora é RECUSADO (antes passava); relido (`[nº do Recebi]`), passa — dois vínculos, Σ P = 3. **(9b)** igual a antes (o "Lançar" trava primeiro com `[]` e passa).
- **Novo (13):** 5 P; "Lançar" 2 P com `[]` grava a nº N; repetido com `[]` → recusado com `telaMudou` citando "venda nº N"; Σ ativa P = 2 num vínculo; com `[N]` → passa, Σ = 4 em dois vínculos.
- Saída: "(13) “Lançar na Venda” repetido da mesma Venda depois de uma resposta perdida..." e "Corridas das Queimas: todas as afirmações passaram."

## Comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run` (RED da Tarefa 1) | 11 failed / 63 passed (esperado) |
| `npx tsc --noEmit` (várias vezes, Tarefas 1 e 2) | limpo no fim de cada tarefa |
| `npx vitest run` 4 arquivos do `<verify>` da Tarefa 1 | 204 passed |
| `npm run lint` (Tarefas 1 e 2) | 0 avisos |
| `npm run verificar-acoes` | 125 ações, 0 violações |
| `npm run test:migracoes` (Tarefa 1) — **2 vezes**: a 1ª saída foi cortada pelo `tail` antes das linhas das Queimas; a 2ª com log inteiro | exit 0 nas duas; "(13)" listado; "Corridas das Queimas: todas as afirmações passaram." |
| `npx vitest run` (RED da Tarefa 2) | 13 failed / 129 passed (esperado) |
| `npx vitest run` 5 arquivos do `<verify>` da Tarefa 2 | 183 passed |
| `npm test` (Tarefa 2) | 147 arquivos / 3338 testes passed |
| `npm run verificar` (Tarefa 3) | **exit 0** — lint, tsc, verificar-acoes 125/0, 3338 testes, `test:migracoes` ("Corridas das Queimas: todas as afirmações passaram.", "Todas as afirmações passaram.") |
| `docker ps` antes do e2e | só `docker-postgres-1` (5433); nenhum `amassa_app_e2e` |
| `npm run test:e2e -- --grep "auditoria 08/10\|estoque contagem\|polimento estoque\|lan.ar na venda\|venda: bordas"` — **a ÚNICA invocação** | **125 passed, 0 failed** (2,3 min; exit 0) — inclui os vazio-* da cadeia de `dependencies`, a contagem, o "sem custo" de 06.5, as bordas e o traçador da Venda das Queimas, os "Lançar na Venda" da Agenda (mesmo `PainelVenda`) e as **três "(auditoria 08/10)" em desktop e celular (6 execuções, todas ok)**. O `[WebServer] Error: The destination stream closed early.` no log é o `route.abort` do teste da resposta perdida (esperado). |
| `git diff 831b0f6 --stat -- db/` | vazio — nenhuma migração, `TABELAS_ESPERADAS` intacta |
| `git fetch origin` + `git log origin/main..main --oneline` | `5d47231`, `7ec9cc0`, `dadb520`, `7205508`, `831b0f6` — nada publicado (o `831b0f6`, docs de estado da sessão anterior, também não estava publicado) |
| `gh run list -L 2` | último run `37733245678` (08/10 05:36 UTC, success, o do `5d0e145`) — nada novo publicado |

## Commits
- `7205508` test(quick-261008-pmi): o reenvio do Lançar na Venda e as frases de rede — vermelho
- `dadb520` fix(queimas): Lançar na Venda recusa o reenvio depois de resposta perdida — o retrato das vendas ativas sob a trava
- `7ec9cc0` test(quick-261008-pmi): doação como referência e o modo da contagem — vermelho
- `5d47231` fix(estoque): entrada de R$ 0 não vira referência de custo e baixa manual não tira o material da primeira contagem

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Testes existentes chamavam `custoMedioParaExibir` com um `EstadoDoItem` (sem `teveEntrada`)**
- **Found during:** Tarefa 2 (GREEN), pelo `tsc`
- **Issue:** `tests/unit/estoque-custo.test.ts` (WR-02, 3 chamadas) e `tests/unit/estoque-textos.test.ts` (o helper `rotuloDoEstado`) passavam o estado em memória direto; com `teveEntrada` obrigatório, não compilavam — e o significado ("houve entrada no livro") não vem do estado em memória.
- **Fix:** as chamadas passam `{ ...estado, teveEntrada }` explícito; `rotuloDoEstado(estado, teveEntrada)`. As afirmações (“—” / “sem custo” / “R$ 4,20/kg”) não mudaram. `estoque-textos.test.ts` não estava na lista `files_modified` do plano.
- **Commit:** `5d47231`

**2. [Rule 1 - Bug, mínimo] narrowing de `let` dentro de closure no caso (9a)**
- `a.valor.numero` dentro do callback de `db.transaction` não compilava (o `a` é `let`); guardado em `const numeroDoRecebi` antes. Commit `dadb520`.

**3. [Escolha] `isNull(estornoDeId)` nas leituras das combinações manuais** (tela e servidor iguais) — não existe estorno de movimentação manual hoje; só robustez. Registrado em `decisions`.

Nenhuma migração foi necessária.

## Pendências descobertas (não corrigidas aqui)
- **P1** — a Venda MANUAL ainda pode duplicar num reenvio depois de resposta perdida: não há retrato possível. A frase de rede agora manda conferir no Caixa; fechar de verdade pede chave de envio em `lancarVenda` (avaliar antes se exige tabela/migração).
- **P2** — a frase de rede do "Corrigir" (`fraseCorrecaoSemRede`, ramo intacto) continua afirmando que nada novo entrou; a versão sob a trava protege o reenvio, mas é a mesma raiz. O e2e `polimento-corrigir (e)` a fixa letra por letra.
- **P3** — o "Ajustar pelo contado" da folha do material antes da primeira contagem continua gravando ajuste à taxa corrente sem perguntar custo, e conta como contagem (`tiraDaPrimeiraContagem`: tipo ajuste) — a outra metade do achado do auditor, fora do critério travado da Decisão 3.

## Documentos de estado atualizados
- `.planning/STATE.md` (à mão): frontmatter `stopped_at`, `last_updated`, `last_activity`, `last_activity_desc`; "Current focus"; Pending Todos (os avisos corrigidos-não-publicados + P1–P3); linha nova em "Quick Tasks Completed". Narrativa anterior preservada com "*Até 08/10/2026 (tarde) …*".
- `.planning/PROXIMA-SESSAO.md`: título e bloco novo no topo (publicar quando o Theo quiser — push e pipeline, sem migração nem roteiro de servidor; depois o que resta da auditoria e P1–P3).
- `ESTADO-ATUAL.md` e `Claude outputs/RETOMAR-AQUI.md` (fora do git): bloco novo no topo com a mesma evidência.
- `Claude outputs/auditoria/ACOMPANHAMENTO.md` (fora do git): a frase do topo ganhou data e correção ao lado; seção nova "Correções — 08/10/2026 (quick 261008-pmi)" com os três avisos **CORRIGIDO no `main` local, NÃO PUBLICADO**, hashes, provas, P1–P3.
- `Claude outputs/FILA-DO-CODE.md`: **não havia item da auditoria** (`grep -n -i auditoria` vazio) — nada criado.
- `ROADMAP.md` não tocado (instrução do orquestrador). Os documentos versionados ficaram modificados e NÃO commitados — o orquestrador os commita.

## Threat Flags
Nenhuma superfície nova além do `<threat_model>`: `vendasVistas` (T-pmi-01) validado por Zod no servidor; a conferência sob a trava (T-pmi-02); `exigirUsuario()` primeiro (T-pmi-03, `verificar-acoes` 125/0); o modo da contagem decidido sob a trava pelo livro (T-pmi-06); a mesma regra `valor > 0` nas três leituras (T-pmi-07).

## Known Stubs
Nenhum — os arquivos de código tocados não têm valor vazio indo para a tela, texto provisório nem componente sem dado.

## Self-Check: PASSED
- Commits `7205508`, `dadb520`, `7ec9cc0`, `5d47231` encontrados no `git log`.
- Arquivos-chave presentes; as três e2e "(auditoria 08/10)" presentes em `queimas-venda`, `polimento-estoque` e `estoque-contagem` e passando em desktop e celular.
- `git diff 831b0f6 --stat -- db/` vazio; nada publicado (`git log origin/main..main` depois de `git fetch`).
