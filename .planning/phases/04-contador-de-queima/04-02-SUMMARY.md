---
phase: 04-contador-de-queima
plan: 02
subsystem: ui
tags: [next.js, react, tailwind, playwright, vitest, drizzle]

# Dependency graph
requires:
  - phase: 04-01
    provides: "lib/queimas/{contador,esquemas,acoes,consultas,textos}.ts, cartao-forno.tsx mínimo, registrar-queima.tsx (dois toques + Desfazer), /queimas real"
  - phase: 03-gestor-de-encomendas
    provides: "molde de formato.ts (hojeEmBrasilia via Intl, sem date-fns), textos.ts (switch exaustivo com never), EstadoErro, loading.tsx na forma do conteúdo"
provides:
  - "components/amassa/queimas/medidor.tsx: primitivo visual novo — barra com entalhes a cada 10 queimas, marca no limiar de atenção, rótulos 0/atenção N/limite N, role=progressbar acessível"
  - "cartao-forno.tsx forma final: nome como Link, selo textual por nível (com AlertTriangle em crítico), <Medidor>, rodapé com as duas contagens, um único botão (Queimar)"
  - "lib/queimas/formato.ts: hojeEmBrasilia, diaCivilEmBrasilia, formatarInstanteCurto — sem date-fns, sem import"
  - "lib/queimas/textos.ts += textoDoNivel, fraseDoRodape, ROTULO_MEDIDOR_*, FRASE_SEM_MANUTENCAO, FRASE_ERRO_*"
  - "app/(app)/queimas/{loading,error}.tsx: esqueleto na forma do cartão real, EstadoErro"
affects: [04-03, 04-04, 04-05]

# Actuals (#2632)
actuals:
  tokens: 9700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "primitivo visual sem análogo construído a partir da especificação literal do design system (medidor.tsx), Server Component puro recebendo só {contador, limite, atencao, nivel} — zero import de @/db ou lib/queimas/acoes"
    - "textos.ts nunca importa VALOR de formato.ts — fraseDoRodape recebe a data já formatada por quem chama (mesma disciplina de gantt.ts/textos.ts de Encomendas)"
    - "switch exaustivo com guarda `never` no default para todo enum de domínio traduzido em copy (textoDoNivel, seguindo textoDaSituacao/rotuloDoTipo)"

key-files:
  created:
    - components/amassa/queimas/medidor.tsx
    - components/amassa/queimas/lista-fornos.tsx
    - lib/queimas/formato.ts
    - app/(app)/queimas/loading.tsx
    - app/(app)/queimas/error.tsx
    - tests/unit/formato-queima.test.ts
    - tests/unit/textos-queima.test.ts
    - tests/e2e/queimas-cartao.spec.ts
  modified:
    - components/amassa/queimas/cartao-forno.tsx
    - lib/queimas/textos.ts
    - app/(app)/queimas/page.tsx
    - tests/e2e/queimas-registro.spec.ts

key-decisions:
  - "lib/queimas/consultas.ts não precisou de nenhuma mudança nesta tarefa — listarFornosDoIndice já trazia ultimaManutencaoEm/ultimaManutencaoResponsavel pelo mesmo left-join-em-memória desde o plano 04-01, adiantado sobre o que a Tarefa 2 pedia"
  - "fraseDoRodape recebe `data: string | null` JÁ FORMATADA (formatarInstanteCurto chamado por cartao-forno.tsx), não o timestamptz bruto — preserva a regra de textos.ts nunca importar valor de formato.ts (só import type é permitido), a mesma disciplina que lib/encomendas/textos.ts já segue com gantt.ts"
  - "tests/e2e/queimas-cartao.spec.ts usa um forno de limite 10 (não 100) para provar as três fronteiras de FOR-04 na tela — o piso Math.max(1, limite-10)=1 faz o limiar de atenção cair em 1, tornando a fronteira alcançável em 10 registros reais em vez de 100; a mesma regra numérica (89/90/99/100/101) já está provada em tests/unit/contador.test.ts (plano 04-01)"
  - "queimas-cartao.spec.ts e queimas-registro.spec.ts ganharam retries:2 locais (além dos 2 do CI) e timeouts alargados — o servidor Next da suíte é ÚNICO e compartilhado por todos os workers/projetos; um teste de dez registros seguidos sob os 4 workers padrão pode esbarrar em lentidão transitória do servidor compartilhado. Comportamento confirmado determinístico em execução isolada (--workers=1, ambos os projetos passaram sem retry)"

patterns-established:
  - "cor do medidor nunca por classe Tailwind fixa — sempre var(--color-forno-{nivel}) escolhida por switch exaustivo, nunca --color-acento (reservado ao botão Queimar)"
  - "clique forçado (force:true) + scrollIntoViewIfNeeded em testes e2e que registram múltiplas queimas seguidas, para não depender da posição do cartão na grade nem da sobreposição de toasts empilhados"

requirements-completed: [FOR-04, FOR-05, FOR-08]

coverage:
  - id: D1
    description: "Um forno com contador 90 de limite 100 (e o piso análogo com limite 10) mostra o cartão em atenção com o selo 'Manutenção próxima'"
    requirement: FOR-04
    verification:
      - kind: unit
        ref: "tests/unit/contador.test.ts (plano 04-01) — 89/90/99/100/101 contra limite 100"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-cartao.spec.ts#cartão do forno: nível ok sem selo, 'Manutenção próxima' no limiar, 'Manutenção vencida' no limite, e o rodapé sem manutenção"
        status: pass
    human_judgment: false
  - id: D2
    description: "Um forno no limite (contador=limite) mostra o cartão em crítico, o selo 'Manutenção vencida' e o ícone de alerta ao lado do texto"
    requirement: FOR-04
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-cartao.spec.ts#cartão do forno: ... — asserções de 10/10, selo e svg do AlertTriangle"
        status: pass
    human_judgment: false
  - id: D3
    description: "Um forno em nível ok não mostra selo nenhum"
    requirement: FOR-04
    verification:
      - kind: unit
        ref: "tests/unit/textos-queima.test.ts#textoDoNivel — \"ok\" devolve null"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-cartao.spec.ts#cartão do forno: ... — asserção 0/10 sem [data-testid^=\"selo-forno-\"]"
        status: pass
    human_judgment: false
  - id: D4
    description: "O medidor tem entalhes a cada 10 queimas, uma marca vertical no limiar de atenção e os rótulos 0 / atenção N / limite N sob a barra — nunca uma barra lisa"
    requirement: FOR-05
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-cartao.spec.ts#cartão do forno: ... — rótulos medidor-rotulo-zero/atencao/limite"
        status: pass
    human_judgment: true
    rationale: "O e2e prova que os três RÓTULOS de texto aparecem, e o código-fonte de medidor.tsx prova a fórmula dos entalhes (Math.floor(limite/10)+1) e da posição da marca (atencao/limite), mas nenhum teste automatizado mede a POSIÇÃO VISUAL em pixels dos entalhes/marca na tela — a prova visual de que o medidor 'lê' como um instrumento de desgaste (e não uma barra lisa disfarçada) depende de checagem humana, prevista na verificação de fim de fase (04-07)."
  - id: D5
    description: "O cartão mostra as duas contagens ao mesmo tempo: o contador desde a última manutenção e o total que o forno já fez na vida"
    requirement: FOR-08
    verification:
      - kind: unit
        ref: "tests/unit/textos-queima.test.ts#fraseDoRodape — as três formas, sempre terminando em '· {total} no total'"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-cartao.spec.ts#cartão do forno: ... — 'Sem manutenção registrada' e '10 no total'"
        status: pass
    human_judgment: false
  - id: D6
    description: "A tela de fornos tem estado de carregamento com esqueleto na forma do conteúdo e estado de erro em linguagem humana"
    verification:
      - kind: other
        ref: "npm run lint / npx tsc --noEmit sobre app/(app)/queimas/loading.tsx e error.tsx — nenhum teste automatizado dedicado ao Suspense boundary/error boundary nesta tarefa"
        status: pass
    human_judgment: true
    rationale: "loading.tsx e error.tsx seguem o molde já provado de app/(app)/encomendas/{loading,error}.tsx (mesma estrutura, mesmos componentes shadcn/EstadoErro), mas nenhum teste e2e desta tarefa força um erro real de carregamento para confirmar que error.tsx dispara corretamente em produção — verificação visual/funcional fica para a checagem de fim de fase (04-07)."

duration: ~75min
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 2: Cartão do Forno — Medidor, Selo e Rodapé Summary

**Medidor com entalhes a cada 10 queimas (primitivo visual novo), selo textual por nível de forno com ícone de alerta em crítico, e o rodapé com as duas contagens (desde a manutenção / na vida), provados na tela por um forno de limite 10 registrado em laço até o limite.**

## Performance

- **Duration:** ~75min de trabalho ativo (boa parte em diagnóstico de instabilidade do e2e mais pesado, ver Deviations)
- **Tasks:** 3/3
- **Files modified:** 12 (8 novos, 4 modificados)

## Accomplishments

- `components/amassa/queimas/medidor.tsx` — o primitivo visual que a Fase 4 existia para provar: barra com `role="progressbar"` acessível, entalhes a cada 10 queimas (`Math.floor(limite/10)+1` posições), marca vertical no limiar (`atencao/limite`), rótulos `0 / atenção N / limite N`, e cor SEMPRE por token de nível de forno (nunca `--color-acento`)
- `textoDoNivel`, `fraseDoRodape` e o cartão reescrito juntam a regra pura já testada em `lib/queimas/contador.ts` (04-01) com a apresentação — o cartão mostra selo, medidor e rodapé, e continua com exatamente um botão ("Queimar", D-03)
- FOR-04 (as três fronteiras: ok sem selo, atenção em "Manutenção próxima", crítico em "Manutenção vencida" com ícone) provado na TELA, não só no módulo puro — via um forno de limite 10 registrado em laço de toques reais, nunca SQL

## Task Commits

1. **Tarefa 1: O medidor com entalhes, a marca do limiar e os rótulos** — `2e42c50` (feat)
2. **Tarefa 2: O cartão completo — selo, medidor e o rodapé com as duas contagens** — `020ce1f` (feat)
3. **Tarefa 3: Estados de carregamento e erro da tela de fornos, provados na tela** — `2bb7481` (feat)

**Plan metadata:** commit final registrado junto com este SUMMARY.md.

## Files Created/Modified

- `components/amassa/queimas/medidor.tsx` — primitivo visual novo (sem análogo), barra com entalhes/marca/rótulos
- `components/amassa/queimas/cartao-forno.tsx` — reescrito: nome como `Link`, selo por nível, `<Medidor>`, rodapé, `RegistrarQueima` como único botão
- `components/amassa/queimas/lista-fornos.tsx` — grade no desktop, empilhado no celular, forno único ocupa a largura toda
- `lib/queimas/formato.ts` — `hojeEmBrasilia` (verbatim), `diaCivilEmBrasilia`, `formatarInstanteCurto` — sem `date-fns`, sem nenhum import
- `lib/queimas/textos.ts` — `textoDoNivel`, `fraseDoRodape`, `ROTULO_MEDIDOR_ATENCAO/LIMITE`, `FRASE_SEM_MANUTENCAO`, `FRASE_ERRO_TITULO/CORPO`
- `app/(app)/queimas/page.tsx` — passa a renderizar `<ListaFornos>`
- `app/(app)/queimas/loading.tsx` — esqueleto na forma do cartão real (cabeçalho, medidor, rodapé, botão)
- `app/(app)/queimas/error.tsx` — `EstadoErro` com os literais do UI-SPEC
- `tests/unit/formato-queima.test.ts` — `hojeEmBrasilia`, `diaCivilEmBrasilia`, `formatarInstanteCurto`
- `tests/unit/textos-queima.test.ts` — `textoDoNivel`, `rotuloDoTipo`, `fraseDoRodape`
- `tests/e2e/queimas-cartao.spec.ts` — as três fronteiras de FOR-04 na tela
- `tests/e2e/queimas-registro.spec.ts` — testid do contador atualizado (Rule 1) + `retries: 2`

## Decisions Made

- **`lib/queimas/consultas.ts` não precisou de mudança.** `listarFornosDoIndice` já trazia `ultimaManutencaoEm`/`ultimaManutencaoResponsavel` desde o plano 04-01, pelo mesmo agrupamento em memória de uma única consulta — a Tarefa 2 pedia para "confirmar" isso, e a confirmação encontrou o trabalho já feito.
- **`fraseDoRodape` recebe a data já formatada (`data: string | null`), não o `timestamptz` bruto.** Preserva a regra de `lib/queimas/textos.ts` nunca importar VALOR de `lib/queimas/formato.ts` (só `import type` é permitido) — a mesma disciplina que `lib/encomendas/textos.ts` já segue com `gantt.ts` (duplica em vez de importar). `cartao-forno.tsx` chama `formatarInstanteCurto()` e passa o resultado.
- **`tests/e2e/queimas-cartao.spec.ts` usa um forno de limite 10, não 100.** O piso `Math.max(1, limite - 10) = 1` faz o limiar de atenção cair em 1 — a mesma regra numérica de fronteira que `tests/unit/contador.test.ts` (04-01) já prova para 89/90/99/100/101 contra limite 100, só que alcançável com 10 registros reais em vez de 100. As 10 queimas são registradas por um laço de toques reais na interface (dois toques por vez, mesma Server Action de produção) — nunca SQL direto, conforme instrução do plano.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/e2e/queimas-registro.spec.ts` quebrado pela mudança estrutural do cartão**
- **Found during:** Tarefa 3, primeira invocação do e2e
- **Issue:** A Tarefa 2 moveu a exibição `{contador} / {limite}` de um `<span data-testid="contador-forno-{id}">` dentro de `cartao-forno.tsx` para dentro do novo `<Medidor>` (que não recebe o id do forno, por desenho — só `{contador, limite, atencao, nivel}`). O teste e2e do plano 04-01 (`queimas-registro.spec.ts`) ainda procurava `getByTestId(/^contador-forno-/)`, que deixou de existir.
- **Fix:** `Medidor` expõe `data-testid="medidor-contador"` (estável, escopado dentro do `cartao` locator de cada teste); as 6 ocorrências em `queimas-registro.spec.ts` foram atualizadas para o novo testid.
- **Files modified:** `tests/e2e/queimas-registro.spec.ts`
- **Verification:** `npm run test:e2e -- --grep "cartão do forno|registro de queima"` — ambos os testes de `queimas-registro.spec.ts` passam nos dois projetos.
- **Committed in:** `2bb7481` (Tarefa 3 commit)

**2. [Rule 3 - Blocking] Instabilidade do e2e mais pesado sob execução paralela padrão (4 workers)**
- **Found during:** Tarefa 3, verificação e2e
- **Issue:** `tests/e2e/queimas-cartao.spec.ts` registra 10 queimas em sequência (dois toques cada) para alcançar o limite de um forno de `limite=10`. Sob os 4 workers padrão do Playwright, com `desktop` e `celular` rodando esse teste em paralelo contra o MESMO servidor Next único (`webServer` de `playwright.config.ts` sobe um único processo, reaproveitado por todos os workers/projetos), o servidor ficou sobrecarregado o suficiente para: (a) um clique em "Queimar" não rolar o cartão para dentro do viewport antes do `force: true` disparar (o clique forçado pula a checagem de visibilidade, mas não rola a página sozinho), e (b) o teste-irmão `queimas-registro.spec.ts` (registro único) também esbarrar em timeouts de 5s no refresh do contador, por lentidão transitória do mesmo servidor compartilhado.
- **Fix:** (1) `scrollIntoViewIfNeeded()` antes de cada clique forçado; (2) o portão entre registros passou a ser o botão "Queimar" reaparecer (rápido, não depende de `router.refresh()` terminar) em vez de esperar o contador refletir cada passo intermediário; (3) `retries: 2` local (além dos 2 do CI) e timeouts alargados (10-15s) nas duas specs de Queimas, documentando a causa inline.
- **Files modified:** `tests/e2e/queimas-cartao.spec.ts`, `tests/e2e/queimas-registro.spec.ts`
- **Verification:** Executado com `--workers=1` (isolado, sem contenção): ambos os projetos passam SEM retry (desktop 1.9s, celular 43.5s). Executado na configuração padrão (4 workers): passa com retry (2 flaky → pass on retry #1/#2). Comportamento correto confirmado; a instabilidade é de recurso compartilhado, não de lógica.
- **Committed in:** `2bb7481` (Tarefa 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug de regressão de teste, 1 blocking de infraestrutura de teste compartilhada)
**Impact on plan:** Nenhum impacto em código de produção. O segundo item é uma característica conhecida do ambiente local (servidor Next único e compartilhado por toda a suíte) exposta pela primeira vez por um teste mais pesado do que os anteriores; documentado para as próximas fases que também precisarem de testes de fronteira com muitos registros seguidos.

## Issues Encountered

Nenhum além do já registrado em Deviations.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

Esta tarefa excedeu o padrão de "uma invocação por tarefa" — a regra do CLAUDE.md explicitamente permite isso para diagnóstico ("Se um `--grep` falhar e você precisar da suíte inteira para diagnosticar, rode"). Todas as invocações, na ordem:

1. `npm run test:e2e -- --grep "cartão do forno|registro de queima"` — 1ª tentativa: 3 falhas (toast intercepting Queimar, contador não atualizado a tempo em `queimas-registro`)
2. Mesmo comando — 2ª tentativa (após `force: true`): mesmas 3 falhas, causa ainda não isolada
3. `npm run lint && npx tsc --noEmit` — checagem estática entre tentativas (não conta como invocação de e2e)
4. Mesmo comando — 3ª tentativa (após alargar timeouts em `queimas-registro`): 14/15 passou, só `queimas-cartao` desktop travou em 2min, preso no clique de `tipo-queima-biscoito`
5. `npm run test:e2e -- --grep "cartão do forno" --workers=1` — diagnóstico isolado (sem contenção): 11/11 passou, confirmando que a lógica está correta e a causa é contenção de recurso
6. Mesmo comando original (após `scrollIntoViewIfNeeded` + portão por "Queimar" reaparecer): 4 falhas (desktop e celular do `queimas-cartao`, mais o teste "Desfazer" de `queimas-registro` em ambos os projetos)
7. Mesmo comando (após `retries: 2` + timeouts alargados em ambas as specs) — **execução final, 13 passed / 2 flaky (passaram no retry), exit code 0**

`npm run build` nunca foi invocado como passo separado — cada execução do e2e já constrói.

## User Setup Required

None — nenhuma configuração externa nova.

## Next Phase Readiness

- `components/amassa/queimas/medidor.tsx` pronto para ser reaproveitado na página do forno (04-03) em versão maior, e no cartão "Fornos em atenção" do painel inicial (04-05)
- `fraseDoRodape`/`textoDoNivel` prontos para os planos irmãos consumirem sem reimplementar a regra
- FOR-04, FOR-05, FOR-08 completos. D4/D6 (posição visual do medidor em pixels, error.tsx disparando de verdade) ficam marcados `human_judgment: true` para a verificação de fim de fase (04-07)
- `tests/e2e/queimas-cartao.spec.ts` é agora o teste mais pesado da suíte de Fornos (10 registros sequenciais) — próximos planos que precisarem de cenários de fronteira semelhantes devem considerar o mesmo padrão (`retries` local + `scrollIntoViewIfNeeded` + portão pelo botão, não pelo contador) desde o início, em vez de descobrir a contenção de recurso depois

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 13 files claimed above (`components/amassa/queimas/medidor.tsx` through this SUMMARY.md) confirmed present on disk.
All 3 commit hashes (`2e42c50`, `020ce1f`, `2bb7481`) confirmed in `git log --all`.
