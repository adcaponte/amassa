---
phase: quick-260920-dx9
plan: 1
subsystem: error-handling
tags: [postgres, drizzle-orm, sqlstate, playwright, vitest]

# Dependency graph
requires:
  - phase: 04.4-financeiro-parte-1 (04.4-02)
    provides: "codigoDoErroPostgres/ehViolacaoDeChaveEstrangeira já corrigidos em lib/cadastros/acoes.ts — implementação de referência copiada, não reinventada"
provides:
  - "lib/erro/postgres.ts — detector compartilhado de SQLSTATE (codigoDoErroPostgres, ehViolacaoDeChaveEstrangeira), lê erro.code e erro.cause.code"
  - "Abertura, Cotações e Queimas mostram a mensagem humana de chave estrangeira em vez da frase genérica de falha"
  - "components/amassa/queimas/registrar-queima.tsx repassa resposta.erro ao toast"
  - "tests/e2e/apoio/apagar-referencia.ts — auxiliar reutilizável para reproduzir a corrida real 'a linha sumiu entre a montagem do formulário e o envio'"
affects: ["04.4-financeiro-parte-1 (lib/financeiro/acoes.ts tem o mesmo defeito, não corrigido aqui)", "lib/cadastros (migração da cópia privada de codigoDoErroPostgres para @/lib/erro/postgres, não feita aqui)"]

actuals:
  tokens: 5021
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "lib/erro/postgres.ts — terceiro módulo sem domínio e zero import, ao lado de lib/erro/textos.ts e lib/acessibilidade/rotulos.ts, seguindo a mesma disciplina de codigoDoErroPostgres já estabelecida em lib/cadastros/acoes.ts"

key-files:
  created:
    - lib/erro/postgres.ts
    - tests/unit/erro-postgres.test.ts
    - tests/e2e/apoio/apagar-referencia.ts
    - tests/e2e/erro-chave-estrangeira.spec.ts
  modified:
    - lib/abertura/acoes.ts
    - lib/cotacoes/acoes.ts
    - lib/queimas/acoes.ts
    - components/amassa/queimas/registrar-queima.tsx

key-decisions:
  - "Nenhuma decisão de arquitetura tomada sem o dono — este plano só extraiu e aplicou um detector já corrigido e aprovado em lib/cadastros/acoes.ts (plano 04.4-02)."

patterns-established:
  - "Qualquer detector futuro de SQLSTATE deve importar de lib/erro/postgres.ts, nunca redeclarar (mesma disciplina já em vigor para lib/erro/textos.ts)."

requirements-completed: []

coverage:
  - id: D1
    description: "codigoDoErroPostgres/ehViolacaoDeChaveEstrangeira leem tanto erro.code solto quanto erro.cause.code embrulhado pelo drizzle-orm/node-postgres, com o fall-through preservado"
    verification:
      - kind: unit
        ref: "tests/unit/erro-postgres.test.ts — 21 casos (codigoDoErroPostgres + ehViolacaoDeChaveEstrangeira)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Registrar uma queima num forno apagado há um segundo mostra 'Esse forno não existe mais. Recarregue a página.'"
    requirement: null
    verification:
      - kind: e2e
        ref: "tests/e2e/erro-chave-estrangeira.spec.ts — 'Queimas: o forno apagado com o cartão na tela mostra...' (desktop + celular)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Salvar uma tarefa de Abertura ligada a um item apagado há um segundo mostra a frase humana e o formulário permanece aberto com o texto digitado"
    verification:
      - kind: e2e
        ref: "tests/e2e/erro-chave-estrangeira.spec.ts — 'Abertura: o item apagado com o formulário de tarefa na tela mostra...' (desktop + celular)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Salvar uma cotação numa categoria apagada há um segundo mostra a frase humana e o formulário permanece aberto com o texto digitado"
    verification:
      - kind: e2e
        ref: "tests/e2e/erro-chave-estrangeira.spec.ts — 'Cotações: a categoria apagada com o formulário de cotação na tela mostra...' (desktop + celular)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O spec e2e realmente pega o defeito: com a correção revertida à mão, os três casos falham nos dois viewports (6 falhas); com ela restaurada, 34/34 passam"
    verification:
      - kind: e2e
        ref: "par RED/GREEN medido na conferência — ver a seção 'Prova RED/GREEN do e2e'; o RED exigiu remover o test.describe.configure({ mode: 'serial' }), que escondia dois dos três casos (commit cc399ae)"
        status: pass
    human_judgment: false

duration: ~20min (execução automatizada; sessão anterior já tinha o PLAN.md pronto)
completed: 2026-09-20
status: complete
---

# Quick Task 260920-dx9: Detectar SQLSTATE embrulhado pelo Drizzle — Summary

**Detector compartilhado `lib/erro/postgres.ts` (portado de `lib/cadastros/acoes.ts`) aplicado em Abertura, Cotações e Queimas, com prova e2e real de apagar a linha referenciada com o formulário já na tela.**

## Performance

- **Duration:** ~20min de execução autônoma (Tarefas 1-3, sem checkpoint)
- **Completed:** 2026-09-20
- **Tasks:** 3/3
- **Files modified:** 8 (4 criados, 4 modificados)

## Accomplishments
- `lib/erro/postgres.ts` criado com TDD real: teste falho commitado primeiro (RED, confirmado por execução — `Cannot find module`), depois a implementação (GREEN, 21 testes verdes).
- `lib/abertura/acoes.ts`, `lib/cotacoes/acoes.ts` e `lib/queimas/acoes.ts` importam `ehViolacaoDeChaveEstrangeira` de `@/lib/erro/postgres` e não declaram mais detector próprio — as mensagens humanas continuam letra por letra iguais, só a detecção mudou.
- `components/amassa/queimas/registrar-queima.tsx` passou a repassar `resposta.erro` ao toast em vez da frase genérica fixa — sem essa troca a mensagem humana de Queimas nunca chegava à tela, mesmo com o detector certo.
- `tests/e2e/erro-chave-estrangeira.spec.ts` prova, com uma linha apagada de verdade direto no banco enquanto o formulário já está na tela, que as três telas mostram a frase humana — 34/34 testes passaram (as 3 novas × 2 viewports + a suíte `@vazio-*` que roda antes na cadeia de dependências do Playwright).

## Task Commits

Cada tarefa foi commitada atomicamente (Tarefa 1 seguiu o ciclo RED/GREEN completo):

1. **Tarefa 1 (RED — teste falho)** - `6288f67` (test)
2. **Tarefa 1 (GREEN — implementação)** - `b23b81e` (feat)
3. **Tarefa 2: aplicar nos três módulos e destravar Queimas** - `fcbb3c3` (fix)
4. **Tarefa 3: prova e2e** - `865e338` (test)
5. **Conferência: os três casos deixam de esconder um ao outro** - `cc399ae` (test) — feito pelo orquestrador, ver "Prova RED/GREEN do e2e"

**Plano/estado (docs):** commitados separadamente pelo orquestrador — não incluídos aqui.

## Files Created/Modified
- `lib/erro/postgres.ts` - módulo puro (zero import) com `codigoDoErroPostgres`/`ehViolacaoDeChaveEstrangeira`
- `tests/unit/erro-postgres.test.ts` - 21 casos cobrindo raiz solta, causa embrulhada, e os oito formatos inválidos do plano
- `lib/abertura/acoes.ts` - importa o detector compartilhado; os dois `catch` (tarefa nova e atualizada) inalterados
- `lib/cotacoes/acoes.ts` - importa o detector compartilhado; o `catch` de criação de cotação inalterado
- `lib/queimas/acoes.ts` - importa o detector compartilhado; o `catch` de registro de queima inalterado
- `components/amassa/queimas/registrar-queima.tsx` - `toast.error(resposta.erro)` no lugar da frase genérica fixa
- `tests/e2e/apoio/apagar-referencia.ts` - três funções estreitas (`apagarFornoPeloNome`, `apagarItemDeAberturaPeloNome`, `apagarCategoriaDeCotacaoPeloNome`), cada uma exigindo `rowCount === 1`
- `tests/e2e/erro-chave-estrangeira.spec.ts` - os três casos reais, com o título do `describe` contendo "chave estrangeira" para o `--grep`

## Comandos de verificação rodados

Orçamento do CLAUDE.md (§Conventions): o executor gastou **uma** invocação de `npm run test:e2e`.
O orquestrador gastou **mais três**, na conferência final, para provar o que faltava — a
contagem honesta do plano é **quatro**. O porquê está em "Prova RED/GREEN do e2e" abaixo; em
resumo, o e2e foi escrito DEPOIS da correção, então ele afirmava a frase certa sem nunca ter
sido visto pegar o defeito. A regra do CLAUDE.md permite explicitamente rodar a mais para
diagnosticar; o que ela exige é registrar, e é o que esta seção faz.

- `npx vitest run tests/unit/erro-postgres.test.ts` — 2 vezes (RED, antes de `lib/erro/postgres.ts` existir; GREEN, depois)
- `npx tsc --noEmit` — 3 vezes (uma por tarefa)
- `npm run lint` — 3 vezes (uma por tarefa)
- `grep -c '^import ' lib/erro/postgres.ts` — 1 vez (Tarefa 1, confirmou 0)
- `npm run verificar-acoes` — 2 vezes (Tarefa 2 e dentro de `npm run verificar` na Tarefa 3) — 48 ações conferidas, 0 violações
- `npm test` — 2 vezes (Tarefa 2 e dentro de `npm run verificar`) — 875 testes verdes
- `npm run test:e2e -- --grep "chave estrangeira"` — **4 vezes no total**:
  1. Tarefa 3, pelo executor — 34/34 passaram (GREEN, mas sem RED anterior que lhe desse sentido)
  2. Conferência, com a correção revertida à mão — **2 falharam, 4 não rodaram** (revelou o
     `mode: "serial"`)
  3. Conferência, ainda revertida, já sem o `mode: "serial"` — **6 falharam** (o RED de verdade)
  4. Conferência, correção restaurada — **34/34 passaram** (o GREEN que fecha o par)
- `npm run verificar` — 2 vezes (Tarefa 3 pelo executor; e de novo pelo orquestrador, conferindo
  de forma independente: lint + tsc + verificar-acoes + npm test + test:migracoes) — tudo verde
  nas duas
- `npm run lint` + `npx tsc --noEmit` — 1 vez a mais cada, sobre a mudança do `mode: "serial"`
- `npm ci` — 1 vez, fora do orçamento de teste (ver "Issues Encontrados" abaixo — não é comando de verificação do plano, é setup de ambiente)

## Prova de que a mensagem humana voltou

| Módulo | Teste (arquivo#nome) | Frase exata provada na tela |
|---|---|---|
| Queimas | `tests/e2e/erro-chave-estrangeira.spec.ts` — "Queimas: o forno apagado com o cartão na tela mostra..." | `Esse forno não existe mais. Recarregue a página.` |
| Abertura | `tests/e2e/erro-chave-estrangeira.spec.ts` — "Abertura: o item apagado com o formulário de tarefa na tela mostra..." | `O item ligado a esta tarefa não existe mais. Recarregue a página e tente de novo.` |
| Cotações | `tests/e2e/erro-chave-estrangeira.spec.ts` — "Cotações: a categoria apagada com o formulário de cotação na tela mostra..." | `Essa categoria não existe mais. Recarregue a página e tente de novo.` |

Cada um dos três passou nos dois projetos do Playwright (`desktop` e `celular`) — seis execuções reais, uma construção. Nos casos de Abertura e Cotações, o teste também afirma que o campo digitado (`O que fazer` / `Empresa`) mantém o valor depois do erro — a prova de que nada se perde em silêncio (CLAUDE.md).

## Prova RED/GREEN do e2e (feita na conferência, não pelo executor)

O e2e nasceu DEPOIS da correção. Um teste assim afirma a frase certa, mas ninguém nunca o viu
pegar o defeito — ele podia estar passando por qualquer outro motivo. A conferência fechou esse
buraco revertendo à mão os quatro arquivos de código para o estado pré-correção
(`git checkout 9d33bdf -- lib/{abertura,cotacoes,queimas}/acoes.ts components/amassa/queimas/registrar-queima.tsx`),
rodando o mesmo `--grep`, e restaurando depois.

**A primeira rodada RED pegou um segundo defeito, este no próprio teste.** Com
`test.describe.configure({ mode: "serial" })`, a falha do caso de Queimas PULOU os outros dois:
o relatório dizia `2 failed, 4 did not run`. Abertura e Cotações jamais teriam sido exercitadas
contra o código quebrado — o spec provava um módulo e dava a impressão de provar três. Os três
casos são independentes (cada um cria os próprios dados, com nome único, num módulo diferente),
então o modo serial não comprava nada e escondia dois terços da prova. Removido em `cc399ae`.

Com o modo serial fora, a mesma corrida reverteu para **6 falhas** — os três módulos, nos dois
viewports, cada um mostrando a frase genérica no lugar da humana, que é exatamente o defeito
relatado. Restaurada a correção: **34/34**. O par RED→GREEN está fechado, e agora o teste é uma
proteção de verdade contra a regressão, não só uma afirmação verdadeira.

## Decisions Made
Nenhuma decisão de arquitetura nova. O plano extraiu uma implementação já corrigida e aprovada (`lib/cadastros/acoes.ts`, plano 04.4-02) — não houve escolha de design a fazer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm ci` executado no worktree antes do e2e**
- **Found during:** Tarefa 3, primeira tentativa de `npm run test:e2e -- --grep "chave estrangeira"`
- **Issue:** `node_modules/` deste worktree estava praticamente vazio (só uma pasta `.vite`). `lint`/`tsc`/`vitest`/`verificar-acoes` funcionaram porque a resolução de módulo do Node subiu até o `node_modules` do repositório principal (`C:/Users/Andre/amassa/node_modules`), mas o Turbopack do Next.js restringe a resolução à raiz do workspace que ele mesmo detecta — que é este worktree — e falhou com `Could not find the Next.js package`.
- **Fix:** `npm ci` dentro do worktree, instalando exatamente o que `package-lock.json` já fixa (nenhum pacote novo, nenhuma versão diferente da já aprovada no repositório principal — não é uma instalação sujeita ao portão de legitimidade de pacote, é sincronizar dependências já vetadas).
- **Files modified:** nenhum arquivo versionado (só `node_modules/` local, fora do git)
- **Verificação:** `npm run test:e2e -- --grep "chave estrangeira"` rodou e os 34 testes passaram na segunda tentativa.
- **Committed in:** não aplicável — `node_modules/` não é versionado.

---

**Total deviations:** 1 auto-fixed (1 blocking, ambiental — nada de código de produção).
**Impact on plan:** Nenhum. Não é um desvio do que o plano pedia, é uma lacuna de ambiente deste worktree específico (provavelmente nunca teve `npm install` rodado nele). Não afeta nenhum dos três commits de tarefa.

## Issues Encountered
- Ver "Auto-fixed Issues" acima — o worktree não tinha `node_modules` própria. Resolvido com `npm ci` antes da única invocação autorizada de `npm run test:e2e`.

## Pendências deixadas de propósito

Travado com o dono (`<fora_de_escopo>` do PLAN.md) — **não tocado nesta execução**:

1. **`lib/financeiro/acoes.ts:51-53` tem EXATAMENTE o mesmo defeito** (detector de uma linha que olha só a raiz do erro, nunca `erro.cause.code`). Não foi corrigido porque a Fase 04.4 está parada no checkpoint do dono (Tarefas 3-4 do plano 04.4-11 aguardando), e mexer nesse arquivo agora atravessaria o trabalho dele. **Para quem retomar a Fase 04.4:** importar `ehViolacaoDeChaveEstrangeira` de `@/lib/erro/postgres` em `lib/financeiro/acoes.ts` e apagar a declaração local — mesmo padrão exato aplicado aqui em Abertura/Cotações/Queimas (ver commit `fcbb3c3`).
2. **`lib/cadastros/acoes.ts` mantém a cópia privada de `codigoDoErroPostgres`** (linhas 63-75, a implementação de referência que este plano copiou) e os detectores de `23505`/`P0001` que ela alimenta (`ehViolacaoDeUnicidade`, `ehErroDoGatilhoDeTravamento`). Não migrado porque, de novo, a Fase 04.4 está no checkpoint do dono. **Para quem retomar:** trocar a função privada por um import de `@/lib/erro/postgres` (a função `codigoDoErroPostgres` de lá tem semântica idêntica) e, se fizer sentido, promover `ehViolacaoDeUnicidade`/`ehErroDoGatilhoDeTravamento` para `lib/erro/postgres.ts` também — mas isso é uma decisão de escopo do módulo compartilhado, não uma extração mecânica, então vale confirmar com o dono antes.

Nenhuma das duas pendências foi "corrigida de brinde" apesar de ser tentador — ambas ficam para depois que a Fase 04.4 fechar, por decisão travada com o dono no PLAN.md.

## Aguardando o dono

Nenhum `git push` foi dado, e nenhum será dado sem o dono autorizar.

**Correção de fato, medida durante a conferência:** os "46 commits locais, NENHUM push" que o
`STATE.md` registra **já foram empurrados**. `git merge-base --is-ancestor 9d33bdf origin/main`
confirma que a base desta tarefa está em `origin/main`, e `origin/main` está hoje em `c97f595`
(20/09, 10:25 — `docs(04.4-11): adenda ao SUMMARY com a causa raiz do CI...`), um commit que esta
ramificação **não** contém. Ou seja: o passo 1 da lista do dono ("autorizar o `git push`") saiu,
por ele ou por outra sessão, depois de o `STATE.md` ter sido escrito.

O que de fato aguarda autorização, então, são só os **6 commits desta ramificação**
(`claude/determined-satoshi-eecf21`): `983eeed` (plano) + os 5 de código. Eles estão sobre
`9d33bdf`, e não sobre o topo atual de `origin/main` — quem for integrar precisa fazer o
merge/rebase com `c97f595`. O único ponto de conflito previsível é o `.planning/STATE.md`, que
os dois lados editaram.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- O detector compartilhado está pronto para qualquer módulo futuro que precise checar SQLSTATE — basta importar de `@/lib/erro/postgres`.
- As duas pendências acima (Financeiro, Cadastros) ficam registradas para quando a Fase 04.4 sair do checkpoint do dono.
- Nenhum bloqueio para o próximo trabalho.

---
*Phase: quick-260920-dx9*
*Completed: 2026-09-20*

## Self-Check: PASSED

Todos os 8 arquivos listados em "Files Created/Modified" existem no disco. Os 4 hashes de
commit (`6288f67`, `b23b81e`, `fcbb3c3`, `865e338`) existem em `git log --oneline --all`.
