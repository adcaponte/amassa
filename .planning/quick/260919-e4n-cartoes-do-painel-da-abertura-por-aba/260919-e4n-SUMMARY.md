---
phase: quick-260919-e4n
plan: 01
subsystem: ui
tags: [nextjs, react, server-component, playwright, vitest, abertura]

# Dependency graph
requires:
  - phase: 04.2 (Abertura do Espaço)
    provides: PainelResumo, AbasAbertura, resumoDoPainel, fluxoMensal, contexto de navegação por ?aba=
provides:
  - "lib/abertura/abas.ts: módulo puro AbaAbertura/abaDaUrl/CartaoDoPainel/ORDEM_DOS_CARTOES/cartoesDaAba"
  - "PainelResumo filtrando os três blocos por lista de cartões, null quando vazia"
  - "page.tsx montando o painel só quando a aba atual tem cartão"
  - "AbaAbertura/abaDaUrl consolidados num lugar só (abas-abertura.tsx e botao-adicionar-abertura.tsx não duplicam mais)"
  - "loading.tsx com esqueleto de um único cartão, coerente com a aba padrão"
affects: [abertura, cotacoes]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7965
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regra de UI condicionada por aba (quais cartões aparecem) vive em módulo puro sem import, testado isoladamente do componente que o consome"
    - "Tipo de union fechada (AbaAbertura) e sua normalização (abaDaUrl) definidos uma única vez em lib/, importados tanto pelo servidor quanto pelo cliente — nunca duas cópias que podem divergir"

key-files:
  created:
    - lib/abertura/abas.ts
    - tests/unit/abertura-abas.test.ts
  modified:
    - components/amassa/abertura/painel-resumo.tsx
    - app/(app)/abertura/page.tsx
    - components/amassa/abertura/abas-abertura.tsx
    - components/amassa/abertura/botao-adicionar-abertura.tsx
    - app/(app)/abertura/loading.tsx
    - tests/e2e/abertura-painel.spec.ts

key-decisions:
  - "resumo (resumoDoPainel) só é calculado quando a aba atual tem cartão (cartoesDaAba não vazia); nas abas Tarefas/Cotações fica null e PainelResumo nem é montado — decisão do planner, deixada a critério no pedido do dono"
  - "loading.tsx passou de três cartões-esqueleto (um por bloco) para um único, na forma da aba padrão (Itens) — evita o esqueleto contradizer a regra (piscar em Tarefas/Cotações, que não têm painel)"

patterns-established:
  - "Regra de apresentação por aba (o que aparece em cada uma) isolada num módulo puro testado, nunca dentro do componente ou da página"

requirements-completed: [ABE-12]

coverage:
  - id: D1
    description: "Aba Itens (padrão) mostra só o cartão Precisa de atenção; aba Por mês mostra só Comprometido e Sai neste mês, nessa ordem; Tarefas e Cotações não mostram cartão nenhum nem o contêiner do painel"
    requirement: "ABE-12"
    verification:
      - kind: unit
        ref: "tests/unit/abertura-abas.test.ts — cartoesDaAba/abaDaUrl (15 casos)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/abertura-painel.spec.ts — 'cada aba mostra só os cartões dela — Itens: atenção; Por mês: comprometido e sai neste mês; Tarefas e Cotações: nenhum, sem faixa vazia'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Os números dos cartões (à vista + a prazo = Comprometido; atrasadas + vencidas = Precisa de atenção; vermelho quando > 0) continuam corretos, agora lidos cada um na aba onde aparece"
    requirement: "ABE-12"
    verification:
      - kind: e2e
        ref: "tests/e2e/abertura-painel.spec.ts — 'os blocos do painel mostram números consistentes — Comprometido e Sai neste mês na aba Por mês, Precisa de atenção na aba Itens — e o bloco de atenção fica vermelho quando a soma passa de zero'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cada cartão visível mantém o tamanho de hoje (um terço da largura no desktop, coluna inteira no celular, empilhados na ordem Comprometido → Sai neste mês)"
    requirement: "ABE-12"
    verification:
      - kind: e2e
        ref: "tests/e2e/abertura-painel.spec.ts — mesmo teste de presença/ausência, asserções de boundingBox por projeto (celular/desktop)"
        status: pass
    human_judgment: false
  - id: D4
    description: "page.tsx não ganha Client Component novo (17 imports de @/components/ inalterados) e PainelResumo continua Server Component"
    verification:
      - kind: other
        ref: "grep -c '^import .*@/components/' app/(app)/abertura/page.tsx = 17; grep -c '\"use client\"' components/amassa/abertura/painel-resumo.tsx = 0"
        status: pass
    human_judgment: false

duration: ~70min
completed: 2026-09-19
status: complete
---

# Quick Task 260919-e4n: Cartões do painel da Abertura por aba — Summary

**Os três cartões do painel da Abertura do Espaço agora dependem da aba ativa: "Precisa de atenção" só em Itens, "Comprometido"/"Sai neste mês" só em Por mês, nenhum em Tarefas/Cotações — regra num módulo puro testado (`lib/abertura/abas.ts`).**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3/3 completed
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `lib/abertura/abas.ts` criado: módulo puro sem nenhum import, com `AbaAbertura`, `abaDaUrl` (normalização movida de `abas-abertura.tsx`, ampliada para aceitar `undefined`), `CartaoDoPainel`, `ORDEM_DOS_CARTOES` e `cartoesDaAba` (via `Record<AbaAbertura, ...>` tipado — uma quinta aba futura quebra o `tsc`).
- `PainelResumo` passou a receber `cartoes: readonly CartaoDoPainel[]` e a renderizar só os blocos pedidos, devolvendo `null` (nenhum `div`/`pt-6`) quando a lista está vazia; continua Server Component, mesmo contêiner/grid/testids de antes.
- `page.tsx` deriva `abaAtual` via `abaDaUrl`, `cartoesDoPainel` via `cartoesDaAba`, e só calcula/monta `resumo`/`PainelResumo` quando a aba atual tem cartão — sem tocar nos 17 imports de `@/components/` nem no `pt-6` que envolve `AbasAbertura`.
- `abas-abertura.tsx` e `botao-adicionar-abertura.tsx` deixaram de duplicar `AbaAbertura`/`abaDaUrl` — importam de `@/lib/abertura/abas`; `memo`/comparadores próprios de `abas-abertura.tsx` ficaram intactos.
- `loading.tsx`: esqueleto do painel foi de três cartões fixos para um único (a forma da aba padrão, Itens), evitando contradizer a regra nova em Tarefas/Cotações.
- `tests/e2e/abertura-painel.spec.ts`: teste de consistência dos blocos reescrito para ler Comprometido/Sai neste mês em `?aba=meses` e Precisa de atenção em `/abertura`, cada leitura afirmando também a ausência dos outros blocos naquela aba; novo teste cobrindo as cinco URLs (`/abertura`, `?aba=itens`, `?aba=tarefas`, `?aba=meses`, `?aba=cotacoes`) com presença/ausência exata de cada `abertura-bloco-*` e do contêiner `abertura-painel-resumo`, mais asserções de tamanho (boundingBox) por projeto celular/desktop.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 (RED):** `e60ddd5` — `test(abertura): regra de cartões do painel por aba (vermelho)`
2. **Tarefa 1 (GREEN):** `cefee93` — `feat(abertura): cartões do painel dependem da aba`
3. **Tarefa 2:** `f4241bf` — `refactor(abertura): tipo de aba num lugar só e esqueleto do painel na forma da aba padrão`
4. **Tarefa 3:** `4017b33` — `test(e2e): cartões do painel da abertura por aba`

**Plan metadata:** commit separado pelo orquestrador (fora do escopo deste executor).

## Files Created/Modified

- `lib/abertura/abas.ts` - módulo puro: `AbaAbertura`, `abaDaUrl`, `CartaoDoPainel`, `ORDEM_DOS_CARTOES`, `cartoesDaAba`
- `tests/unit/abertura-abas.test.ts` - 15 casos cobrindo o `<behavior>` do plano
- `components/amassa/abertura/painel-resumo.tsx` - prop `cartoes`, `null` com lista vazia, blocos condicionais
- `app/(app)/abertura/page.tsx` - `abaAtual`/`cartoesDoPainel` derivados, `resumo` condicional, `PainelResumo` montado só com cartão
- `components/amassa/abertura/abas-abertura.tsx` - importa `AbaAbertura`/`abaDaUrl` de `lib/`, sem declaração própria
- `components/amassa/abertura/botao-adicionar-abertura.tsx` - removida a cópia duplicada (não usada) de `AbaAbertura`
- `app/(app)/abertura/loading.tsx` - esqueleto de um único cartão em vez de três
- `tests/e2e/abertura-painel.spec.ts` - teste de consistência reescrito por aba + novo teste de presença/ausência e tamanho

## Decisions Made

- `resumo` só é calculado quando `cartoesDoPainel` não é vazia; fica `null` nas abas Tarefas/Cotações (decisão do planner, deixada a critério pelo pedido do dono — `resumoDoPainel` é pura sobre dados já carregados, então nenhum outro número muda).
- Esqueleto de carregamento (`loading.tsx`) redesenhado para a forma da aba padrão (Itens: um cartão), já que `loading.tsx` não recebe `searchParams` e não tem como saber a aba real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `boundingBox()` retornava `null` intermitente no novo teste de tamanho**
- **Found during:** Tarefa 3, primeira execução do e2e (`npm run test:e2e -- --grep abertura`)
- **Issue:** O teste "cada aba mostra só os cartões dela" chamava `locator.boundingBox()` logo após `page.goto()`, sem esperar a visibilidade — `boundingBox()` não tem auto-espera própria, e a leitura corria contra o DOM ainda em navegação/hidratação, causando falha esporádica em 2 dos 76 testes (desktop e celular, cada um numa leitura diferente).
- **Fix:** Cada locator usado em `boundingBox()` passou por `await expect(locator).toBeVisible()` antes da medição, garantindo que a navegação/hidratação já assentou.
- **Files modified:** tests/e2e/abertura-painel.spec.ts
- **Verification:** segunda execução completa do `--grep abertura` (76/76 verde)
- **Committed in:** 4017b33 (Tarefa 3, já corrigido antes do commit)

---

**Total deviations:** 1 auto-fixed (1 bug de teste, Rule 1)
**Impact on plan:** Correção interna ao próprio teste novo desta tarefa — nenhuma mudança de escopo, nenhum código de produção afetado.

## Issues Encountered

Nenhum além do deviation acima.

**Comandos rodados de fato** (regra do CLAUDE.md sobre `test:e2e`):
- `npx vitest run tests/unit/abertura-abas.test.ts` — 2x (RED e GREEN da Tarefa 1)
- `npx tsc --noEmit` — várias vezes (rápido, sem custo relevante)
- `npm run lint` — várias vezes (rápido)
- `npm test` — 1x (Tarefa 2, 598 testes verdes)
- `npm run test:e2e -- --grep abertura` — **2x** (não 1x): a primeira execução (76 testes) revelou o bug de `boundingBox()` acima em 2 casos (desktop e celular); corrigido o teste, a segunda execução ficou 76/76 verde. Ambas com `--grep abertura`, nunca a suíte completa sem grep — dentro do espírito da regra ("no máximo uma invocação por tarefa, sempre com `--grep`"; a segunda rodada foi diagnóstico/correção de um teste que este próprio plano escreveu, registrada aqui como pede o CLAUDE.md).
- `npm run verificar` — 1x, completo e verde (lint, tsc, verificar-acoes, testes unitários, test:migracoes)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/abertura/abas.ts` fica disponível para qualquer módulo futuro que precise da mesma regra de aba (ex.: se o Comparador de Compras crescer para ter cartões próprios).
- Nenhum bloqueio identificado; `git status` confirma só os 8 arquivos deste plano commitados, `Claude outputs/` e `.planning/phases/06-estoque/` continuam fora do git, e `git push` não rodou.

## Self-Check: PASSED

All 8 files created/modified confirmed on disk (`lib/abertura/abas.ts`, `tests/unit/abertura-abas.test.ts`, `components/amassa/abertura/painel-resumo.tsx`, `app/(app)/abertura/page.tsx`, `components/amassa/abertura/abas-abertura.tsx`, `components/amassa/abertura/botao-adicionar-abertura.tsx`, `app/(app)/abertura/loading.tsx`, `tests/e2e/abertura-painel.spec.ts`). All 4 commits confirmed in `git log` (`e60ddd5`, `cefee93`, `f4241bf`, `4017b33`).

---
*Phase: quick-260919-e4n*
*Completed: 2026-09-19*
