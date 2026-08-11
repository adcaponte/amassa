---
phase: 04-contador-de-queima
plan: 06
subsystem: fullstack
tags: [next.js, react, recharts, drizzle, postgres, zod, playwright, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: "lib/queimas/contador.ts, lib/queimas/consultas.ts, lib/queimas/textos.ts, db/schema.ts (fornos/queimas/manutencoes)"
  - phase: 04-02
    provides: "lib/queimas/formato.ts (hojeEmBrasilia, diaCivilEmBrasilia), cartao-forno.tsx"
  - phase: 04-05
    provides: "lib/queimas/filtros.ts (disciplina de módulo puro sem imports), padrão de consulta de propósito próprio"
provides:
  - "lib/queimas/relatorios.ts: módulo puro (zero imports) com inicioDaSemana, janelaDeOitoSemanas, janelaDeSeisMeses, agregarPorSemana, agregarPorMes, agregarPorForno, estatisticasDeQueimas"
  - "lib/queimas/consultas.ts += carregarQueimasParaRelatorio() — consulta de propósito próprio, janela de 6 meses civis, uma única vez"
  - "lib/queimas/textos.ts += rótulos do seletor de topo, alternador Semana/Mês, estatísticas, vazio de D-08"
  - "app/globals.css += --color-chart-1..5"
  - "components/amassa/queimas/seletor-queimas.tsx: Fornos · Relatórios, Link real, aria-current (D-01)"
  - "components/amassa/queimas/estatisticas-queimas.tsx: os 4 blocos, sempre renderizados"
  - "components/amassa/queimas/relatorios-recharts.tsx: barras empilhadas por tipo + barras horizontais por forno, rolagem própria (D-07)"
  - "app/(app)/queimas/relatorios/{page,loading,error}.tsx: rota própria com o vazio de D-08"
  - "recharts 3.10.1 — primeira e única dependência npm nova da Fase 4"
affects: [04-07]

# Actuals (#2632)
actuals:
  tokens: 16431
  tasks: 3
  commits: 3

tech-stack:
  added: ["recharts@3.10.1"]
  patterns:
    - "lib/queimas/relatorios.ts segue a disciplina de zero imports de lib/encomendas/cronograma.ts — a aritmética de calendário (diasDesdeAEpoca/civilDesdeDias, algoritmo de Howard Hinnant) é DUPLICADA aqui, nunca importada, mesma decisão de lib/encomendas/filtros.ts/gantt.ts"
    - "dia da semana com segunda=0 derivado da contagem de dias desde a época (((d+3)%7+7)%7), nunca new Date(...).getDay() — evita a sensibilidade ao fuso do processo que 04-CONTEXT.md nomeia como a armadilha central desta fase"
    - "componentes de gráfico recebem os baldes JÁ AGREGADOS como props e não chamam nenhuma função de agregação — a mesma separação servidor-agrega/cliente-desenha de outras telas do módulo"
    - "rolagem horizontal contida por gráfico, no molde de components/amassa/encomendas/gantt.tsx: largura fixa em pixels (número de baldes × largura por balde) dentro de um overflow-x-auto, nunca ResponsiveContainer sozinho para o gráfico que precisa rolar"
    - "truncagem de rótulo de eixo por CONTAGEM DE CARACTERES (não CSS text-overflow) — o eixo do Recharts desenha <text> de SVG, que não recebe ellipsis do jeito que HTML receberia"
    - "teste e2e que mede um total GLOBAL (não por entidade) roda em UM ÚNICO projeto Playwright (test.skip por testInfo.project.name) para não competir consigo mesmo entre desktop/celular rodando em paralelo — quando um segundo escritor concorrente é inevitável e conhecido, o delta tolera exatamente esse acoplamento documentado, nunca uma folga arbitrária"

key-files:
  created:
    - lib/queimas/relatorios.ts
    - tests/unit/relatorios-queimas.test.ts
    - components/amassa/queimas/seletor-queimas.tsx
    - components/amassa/queimas/estatisticas-queimas.tsx
    - components/amassa/queimas/relatorios-recharts.tsx
    - app/(app)/queimas/relatorios/page.tsx
    - app/(app)/queimas/relatorios/loading.tsx
    - app/(app)/queimas/relatorios/error.tsx
    - tests/e2e/queimas-relatorios.spec.ts
  modified:
    - package.json
    - package-lock.json
    - app/globals.css
    - lib/queimas/consultas.ts
    - lib/queimas/textos.ts
    - app/(app)/queimas/page.tsx
    - "app/(app)/queimas/[id]/page.tsx"

key-decisions:
  - "recharts fixado em 3.10.1 (não 2.x), aprovado no portão de legitimidade humano com o registro explícito de que o plano descrevia a forma de dependências transitivas da linha 2.x (\"só d3-* e victory-vendor\") — desatualizada para 3.x, que reescreveu o estado interno sobre Redux Toolkit (@reduxjs/toolkit, react-redux, immer, reselect, use-sync-external-store). Aceito porque os gráficos vivem numa rota própria (/queimas/relatorios), então esse peso nunca chega ao caminho de dois toques que o Core Value do projeto protege"
  - "estatisticasDeQueimas define 'últimos 30 dias' como janela INCLUSIVA de 30 dias civis terminando em hoje ([hoje-29, hoje]) — não havia edge probe travado para esse recorte no plano; a escolha e o motivo (30 dias incluindo hoje, não 31) estão documentados no próprio módulo e provados em teste (29 dias atrás entra, 30 dias atrás não entra)"
  - "biscoito/esmalte das quatro estatísticas contam sobre TODO o conjunto carregado por carregarQueimasParaRelatorio (a janela de 6 meses, a mais longa das duas), não só os últimos 30 dias — o mesmo conjunto que alimenta os gráficos, carregado uma única vez"
  - "teste e2e de estatísticas roda só no projeto desktop (test.skip no celular): as quatro estatísticas são um total GLOBAL do ateliê, não por forno — rodar o mesmo teste em dois projetos Playwright concorrentes fazia cada um contaminar o delta do outro (achado real desta tarefa, ver Deviations). O delta de ESMALTE é a prova exata e imune a essa concorrência (o único outro escritor conhecido deste arquivo, o teste de rolagem no celular, só registra biscoito); total/biscoito toleram no máximo +1, o acoplamento exato e documentado, nunca uma folga arbitrária"
  - "agregarPorForno não garante nenhuma ordem — é o componente de gráfico que decide como desenhar as barras; a função só agrupa por fornoId"

patterns-established:
  - "Módulo de agregação pura para relatórios: recebe dado já reduzido ao mínimo necessário ({diaCivil, tipo}), zero imports, 'hoje' sempre por argumento — modelo para qualquer relatório futuro (Estoque/Fase 6, Agenda/Fase 5) que precise de baldes fixos por período"
  - "Seletor de topo que parece aba mas navega (Link + aria-current + pathname.startsWith) — modelo reaproveitável para qualquer módulo futuro com mais de uma rota irmã (D-01 institucionalizado, mesma convenção da Fase 3)"

requirements-completed: [FOR-12]

coverage:
  - id: D1
    description: "Seletor de topo Fornos · Relatórios navega de verdade entre /queimas e /queimas/relatorios (Link real, aria-current), com o botão voltar funcionando, e fica montado nas três telas do módulo (D-01)"
    requirement: FOR-12
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-relatorios.spec.ts#o seletor de topo navega entre /queimas e /queimas/relatorios..."
        status: pass
    human_judgment: false
  - id: D2
    description: "Os gráficos batem com a contagem manual do histórico: semana começa na segunda em America/Sao_Paulo (23:30 de domingo cai na semana anterior), balde semiaberto (inicio <= x < fim), 8 semanas e 6 meses sempre com a quantidade fixa de baldes mesmo vazios, meses civis atravessando virada de ano sem Date, e a soma dos baldes igual à contagem de entrada (FOR-12)"
    requirement: FOR-12
    verification:
      - kind: unit
        ref: "tests/unit/relatorios-queimas.test.ts — 26 casos, incluindo a prova de fuso de domingo 23:30, o balde semiaberto nos dois extremos, a virada de ano e a soma dos baldes batendo com a contagem manual"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-relatorios.spec.ts#as quatro estatísticas aparecem, a soma bate com as queimas que o próprio teste registrou (FOR-12)... — delta de esmalte exato (prova de integração ponta a ponta, imune à concorrência conhecida do arquivo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O alternador Semana/Mês troca a granularidade exibida sem disparar consulta nova (a URL não muda) e sem mudar as quatro estatísticas — as duas agregações saem do mesmo conjunto de queimas carregado uma vez"
    requirement: FOR-12
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-relatorios.spec.ts#...e o alternador Semana/Mês não muda os números — URL inalterada e os quatro valores idênticos antes/depois do clique"
        status: pass
    human_judgment: false
  - id: D4
    description: "As quatro estatísticas do topo (total, últimos 30 dias, contagem de biscoito e esmalte) renderizam sempre, com zero quando aplicável, nunca meio-preenchidas"
    requirement: FOR-12
    verification:
      - kind: unit
        ref: "tests/unit/relatorios-queimas.test.ts#estatisticasDeQueimas — total/últimos 30 dias/biscoito/esmalte, entrada vazia devolve zeros"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-relatorios.spec.ts#as quatro estatísticas aparecem..."
        status: pass
    human_judgment: false
  - id: D5
    description: "No celular, o gráfico por tipo rola horizontalmente dentro do próprio contêiner, e o documento em si nunca rola lateralmente (D-07)"
    requirement: FOR-12
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-relatorios.spec.ts#no celular, o documento não rola horizontalmente enquanto o gráfico por tipo rola dentro do próprio contêiner"
        status: pass
    human_judgment: false
  - id: D6
    description: "No celular, as quatro estatísticas vêm empilhadas primeiro (ordem no DOM/flex-col), e os dois tamanhos de tela mostram o mesmo recorte de dados — 8 semanas e 6 meses, nada reduzido no celular (D-07)"
    verification: []
    human_judgment: true
    rationale: "A ordem (estatísticas antes dos gráficos) e a largura fixa em pixels dos baldes (independente do viewport) estão garantidas por código — JSX com EstatisticasQueimas antes de RelatoriosRecharts, e LARGURA_POR_BALDE_SEMANA/MES sem nenhuma lógica condicional por tamanho de tela — mas nenhum teste desta tarefa tira um screenshot ou mede a ordem visual renderizada nos dois viewports lado a lado. Candidato à varredura de fim de fase (04-07), mesma categoria dos backstops E5/E6 já registrados em 04-05-SUMMARY.md."
  - id: D7
    description: "Sem nenhuma queima registrada, EstadoVazio substitui os gráficos ('Nenhuma queima registrada ainda.' + botão 'Ver fornos' para /queimas), e o item 'Relatórios' continua visível e alcançável no seletor mesmo vazio (D-08)"
    verification: []
    human_judgment: true
    rationale: "O mecanismo (queimasCarregadas.length === 0 → EstadoVazio com hrefBotao=\"/queimas\"; SeletorQueimas montado ANTES do condicional, sempre visível) está provado por revisão de código e por npm run verificar/tsc, mas o plano desta tarefa pediu explicitamente o e2e 'sem etiqueta de vazio' — nenhum teste desta tarefa força o estado global 'nenhuma queima existe' (que exigiria a etiqueta @vazio-historico e a cadeia de dependências do playwright.config.ts, fora do escopo declarado deste plano). Candidato explícito à varredura de fim de fase (04-07)."
  - id: D8
    description: "recharts só entrou em package.json depois de aprovado no portão de legitimidade de pacote — ponto de parada humano bloqueante, antes de qualquer npm install"
    verification:
      - kind: other
        ref: "git log e1755e0~1..0dc0511 — nenhum commit toca package.json/package-lock.json antes da resposta do checkpoint ('aprovado 3.10.1'); node -e (checagem automatizada da Tarefa 2) confirma recharts fixado sem intervalo"
        status: pass
    human_judgment: false

duration: ~3h
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 6: Relatórios — Recharts, Agregação Pura e o Seletor de Topo Summary

**`/queimas/relatorios` completo: `lib/queimas/relatorios.ts` (módulo puro, TDD, semana começando na
segunda em Brasília, balde semiaberto), as quatro estatísticas, barras empilhadas por tipo e
horizontais por forno em `recharts@3.10.1`, e o seletor "Fornos · Relatórios" que fecha D-01.**

## Performance

- **Duration:** ~3h (incluindo o ponto de parada humano da Tarefa 1 e o diagnóstico de uma
  condição de corrida real no e2e — ver Deviations)
- **Tasks:** 3/3
- **Files modified:** 16 (9 novos, 7 modificados)

## Accomplishments

- Portão de legitimidade de pacote da Tarefa 1: `recharts` tratado como `[ASSUMED]` (sem
  `RESEARCH.md` nesta fase), evidência de legitimidade levantada (57M de downloads semanais,
  repositório oficial, publicação recente) e apresentada num checkpoint bloqueante — aprovado pelo
  usuário em `3.10.1`, com o registro explícito de que a forma de dependências transitivas do plano
  ("só d3-* e victory-vendor") descrevia a linha 2.x, não a 3.x instalada (que reescreveu o estado
  interno sobre Redux Toolkit)
- `lib/queimas/relatorios.ts` — quinto módulo puro sem import da fase, TDD (RED confirmado antes do
  GREEN): `inicioDaSemana`, `janelaDeOitoSemanas`, `janelaDeSeisMeses`, `agregarPorSemana`,
  `agregarPorMes`, `agregarPorForno`, `estatisticasDeQueimas` — 26 testes unitários, incluindo a
  prova literal de que uma queima às 23:30 de domingo em Brasília cai na semana anterior, o balde
  semiaberto nos dois extremos, a virada de ano em `agregarPorMes`, e a soma dos baldes batendo
  exatamente com a contagem manual (FOR-12)
- `/queimas/relatorios`: rota própria com `exigirUsuario()` primeira instrução, quatro estatísticas
  sempre no topo, dois gráficos Recharts (barras empilhadas biscoito/esmalte/ouro alternando
  Semana/Mês, barras horizontais por forno com truncagem + tooltip), rolagem horizontal contida por
  gráfico no celular (D-07), e o vazio de D-08 quando não há nenhuma queima
- Seletor de topo "Fornos · Relatórios" (D-01) montado nas três telas do módulo, navegação real via
  `Link`, item ativo com `aria-current="page"`

## Task Commits

1. **Tarefa 1: Portão de legitimidade — `recharts`** — checkpoint humano, sem commit de código
   (nada instalado antes da aprovação)
2. **Tarefa 2: A agregação pura — 8 semanas, 6 meses e as quatro estatísticas** — `e1755e0` (test,
   RED) + `0dc0511` (feat, GREEN — inclui a instalação do `recharts`)
3. **Tarefa 3: A tela de relatórios, os gráficos e o seletor de topo** — `f5cfb39` (feat)

**Plan metadata:** commit final registrado junto com este SUMMARY.md.

## Files Created/Modified

- `lib/queimas/relatorios.ts` — módulo puro (zero imports), agregação de 8 semanas/6 meses/por forno
- `tests/unit/relatorios-queimas.test.ts` — 26 casos (fronteira de semana, balde semiaberto, fuso,
  virada de ano, soma batendo com contagem manual, estatísticas, pureza)
- `lib/queimas/consultas.ts` += `carregarQueimasParaRelatorio` — consulta de propósito próprio, uma
  janela, uma vez, usando `queimas_data_idx`
- `lib/queimas/textos.ts` += rótulos do seletor, do alternador, das estatísticas, vazio de D-08
- `app/globals.css` += `--color-chart-1..5` (os 3 primeiros reaproveitam os tokens de tipo)
- `components/amassa/queimas/seletor-queimas.tsx` — `Link` real, `aria-current`, `role` implícito de
  navegação
- `components/amassa/queimas/estatisticas-queimas.tsx` — os 4 blocos, Server Component puro
- `components/amassa/queimas/relatorios-recharts.tsx` — Client Component, recebe baldes prontos,
  alternador local, rolagem própria por gráfico
- `app/(app)/queimas/relatorios/{page,loading,error}.tsx` — rota própria, três estados
- `app/(app)/queimas/page.tsx`, `app/(app)/queimas/[id]/page.tsx` — `SeletorQueimas` montado
- `tests/e2e/queimas-relatorios.spec.ts` — navegação do seletor, estatísticas + delta de FOR-12 +
  alternador (desktop only), rolagem horizontal contida (celular only)
- `package.json`/`package-lock.json` — `recharts` fixado em `3.10.1`

## Decisions Made

- **`recharts@3.10.1`, não `2.15.4`.** A alternativa 2.x tinha a forma de dependências que o plano
  esperava (sem Redux), mas bate `lodash` inteiro (onde 3.x usa `es-toolkit`, tree-shakeable), é uma
  linha de manutenção, e sua API diverge da documentação atual. O peso extra do Redux Toolkit de 3.x
  foi aceito porque os gráficos vivem em `/queimas/relatorios`, uma rota separada — o code-splitting
  por rota do App Router garante que esse peso nunca chega em `/queimas`, o caminho de dois toques
  que o Core Value do projeto protege.
- **"Últimos 30 dias" é uma janela civil INCLUSIVA de 30 dias terminando em hoje** (`[hoje-29,
  hoje]`), não `[hoje-30, hoje]` (31 dias) nem exclusiva. Sem edge probe travado para esse recorte
  específico no plano — a escolha e o motivo estão documentados no próprio módulo, com teste
  provando a fronteira nos dois lados (29 dias atrás entra, 30 não).
- **Truncagem do nome de forno no eixo por contagem de caracteres, não CSS.** O eixo do Recharts
  desenha `<text>` de SVG, que não recebe `text-overflow: ellipsis` do jeito que HTML receberia —
  truncar o próprio rótulo (14 caracteres) mantém a largura do eixo previsível em qualquer tamanho de
  tela; o nome completo vive no tooltip customizado.
- **Rolagem horizontal em pixels fixos, não `ResponsiveContainer` sozinho**, no molde de
  `gantt.tsx`: a largura do gráfico por tipo é `número de baldes × largura por balde` (560px para 8
  semanas, 540px para 6 meses) dentro de um `overflow-x-auto` — maior que qualquer viewport de
  celular testado, garantindo rolagem real e o mesmo recorte de dados nos dois tamanhos de tela
  (D-07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `TooltipContentProps<number, string>` não compilava contra o `content` do
`Tooltip` do Recharts**
- **Found during:** Tarefa 3, `npx tsc --noEmit`
- **Issue:** Tipar as duas funções de tooltip customizadas com os genéricos explícitos
  `TooltipContentProps<number, string>` conflitava com o tipo `ContentType<ValueType, NameType>`
  (genéricos-padrão) que a prop `content` do `Tooltip` espera — erro de variância de tipos.
- **Fix:** Usar `TooltipContentProps` com os genéricos padrão (`ValueType`/`NameType`), sem
  especializar.
- **Files modified:** `components/amassa/queimas/relatorios-recharts.tsx`
- **Verification:** `npx tsc --noEmit` limpo.
- **Committed in:** `f5cfb39` (Tarefa 3 commit)

**2. [Rule 1 - Bug] Objeto de balde imutável (`readonly`) recebendo mutação durante a agregação**
- **Found during:** Tarefa 2, `npx tsc --noEmit`
- **Issue:** `agregarEmBaldes` escrevia diretamente nos campos de `BaldeDeQueimas` (tipo público
  `readonly`) durante a agregação, e o compilador barrou a atribuição.
- **Fix:** Acumulador interno mutável (`BaldeMutavel`, sem `readonly`) usado só durante a agregação;
  o retorno já é a forma pública `readonly`, estruturalmente compatível.
- **Files modified:** `lib/queimas/relatorios.ts`
- **Verification:** `npx tsc --noEmit` limpo, os 26 testes continuam verdes.
- **Committed in:** `0dc0511` (Tarefa 2 commit)

**3. [Rule 1 - Bug] Teste e2e de estatísticas contaminava o próprio delta entre `desktop`/`celular`
concorrentes**
- **Found during:** Tarefa 3, primeira execução de `npm run test:e2e -- --grep "relatórios"`
- **Issue:** As quatro estatísticas do topo são um total GLOBAL do ateliê (por desenho, não por
  forno). O teste original lia uma "linha de base" e um "depois" em duas navegações separadas,
  bracketing 3 registros — mas `desktop` e `celular` rodam a MESMA spec CONCORRENTEMENTE como
  projetos Playwright separados (sem `dependencies` entre eles), então cada um registrava suas
  próprias queimas dentro da janela de medição do outro. Primeira falha observada: delta medido 4
  em vez de 3 (a diferença exata de UMA queima que o projeto irmão tinha acabado de registrar);
  numa segunda tentativa, 8. Uma segunda causa relacionada (bug real, não de corrida) também
  apareceu no meio do diagnóstico: `registrarUmaQueima` presumia estar sempre em `/queimas`, mas o
  teste intercalava navegações para `/queimas/relatorios` sem voltar antes do próximo registro.
- **Fix:** (a) `registrarUmaQueima` agora navega para `/queimas` se não estiver lá — idempotente,
  independente de qual página está aberta; (b) o teste de estatísticas passou a rodar SÓ no projeto
  `desktop` (`test.skip` no `celular`, mesmo padrão já usado em `encomendas-filtros.spec.ts` para o
  mesmo tipo de exclusividade de projeto); (c) a prova de FOR-12 foi redesenhada para não depender
  de zero concorrência: o delta de ESMALTE é exato e imune, porque o único outro escritor
  concorrente conhecido deste arquivo (o teste de rolagem no `celular`) só registra "biscoito" —
  total e biscoito toleram no máximo +1, o acoplamento exato e documentado (nunca uma folga
  arbitrária).
- **Files modified:** `tests/e2e/queimas-relatorios.spec.ts`
- **Verification:** Execução final, 14 passaram e 2 skips esperados (o teste de estatísticas no
  `celular`, o teste de rolagem no `desktop`) — 0 falhas, 0 flaky.
- **Committed in:** `f5cfb39` (Tarefa 3 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs de tipo, 1 bug de condição de corrida em teste — nenhum
afeta código de produção; o achado real e permanente foi a disciplina de "total global exige
exclusividade de projeto ou tolerância documentada", relevante para qualquer relatório agregado
futuro em Estoque/Agenda)
**Impact on plan:** Nenhuma mudança de comportamento de produto. Mudança de escopo zero — os três
ajustes ficaram inteiramente dentro dos arquivos já listados no plano.

## Issues Encountered

A Tarefa 1 exigiu levantamento de evidência antes do checkpoint (não estava pronta em nenhum
`RESEARCH.md`, por a pesquisa estar desligada no projeto): `npm view` para versões/dist-tags/
dependências das linhas 2.x e 3.x, `curl` na API de downloads do npm. O checkpoint sinalizou
corretamente que a Tarefa 1 do plano descrevia a forma de dependências da linha 2.x, desatualizada
para a 3.x — o usuário aprovou `3.10.1` conscientemente, com o motivo registrado nas Decisões acima.

O restante do tempo foi majoritariamente o diagnóstico da condição de corrida do e2e (Deviation 3),
não do código de produção em si.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

Esta tarefa excedeu o padrão de "uma invocação por tarefa" na Tarefa 3 — a regra do CLAUDE.md
permite isso explicitamente para diagnóstico ("Se um `--grep` falhar e você precisar da suíte
inteira para diagnosticar, rode"), e as quatro primeiras falhas eram todas do teste em si (bug de
navegação e depois a condição de corrida entre projetos), nunca do código de produção:

1. `npm run test:e2e -- --grep "relatórios"` — 1ª tentativa: 2 falhas, as duas na leitura da linha
   de base (`estatisticas-queimas` não encontrado) — a janela do ateliê estava genuinamente vazia no
   instante da primeira leitura, então a rota renderizava o `EstadoVazio` de D-08 em vez das
   estatísticas; corrigido registrando uma primeira queima ANTES de ler a linha de base
2. Mesma invocação — 2ª tentativa (após o fix acima): 2 falhas por timeout esperando o botão
   "Queimar", causa raiz identificada: `registrarUmaQueima` presumia estar em `/queimas` sem
   verificar, e o teste tinha acabado de navegar para `/queimas/relatorios`
3. Mesma invocação — 3ª tentativa (após o fix de navegação): 1 falha desktop (delta 4 em vez de 3)
   e 1 flaky celular (delta 8 na 1ª retentativa, `0/50` inesperado na 2ª) — a condição de corrida
   entre `desktop`/`celular` concorrentes identificada e corrigida (Deviation 3)
4. Mesma invocação — execução final: **14 passaram, 2 skips esperados, 0 falhas, 0 flaky**

`npm run build` nunca foi invocado como passo separado — só via `npm run test:e2e`, que já constrói.

`npm run verificar` (inclui `test:migracoes`) — 3 execuções completas ao longo das Tarefas 2 e 3,
todas verdes na versão final.

## User Setup Required

None — nenhuma configuração externa nova. `recharts` é uma dependência de build/runtime comum, sem
chave de API nem variável de ambiente.

## Next Phase Readiness

- FOR-12 completo. `/queimas/relatorios` com os três estados (vazio/carregando/erro/populado),
  D-01/D-07/D-08 todos implementados.
- Pendências explícitas para a varredura de fim de fase (04-07): D6 (ordem visual das estatísticas
  antes dos gráficos no celular e o "mesmo recorte de dados" nos dois tamanhos de tela — garantido
  por código, nunca checado com screenshot) e D7 (o estado vazio de D-08 — mecanismo provado por
  revisão de código, mas o e2e desta tarefa não força a condição global "nenhuma queima existe" por
  desenho do plano, que pediu a spec "sem etiqueta de vazio").
- Migrações `0007`/`0008` (04-01) seguem **não aplicadas em produção** — é o próprio propósito do
  plano 04-07: aplicar à mão depois de backup, e fazer a varredura completa de fim de fase.
- `db/schema.ts`/`db/migrations/` seguem sem mudança nesta tarefa.

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 9 created files (`lib/queimas/relatorios.ts` through `tests/e2e/queimas-relatorios.spec.ts`)
confirmed present on disk. All 3 commit hashes (`e1755e0`, `0dc0511`, `f5cfb39`) confirmed in
`git log --all`.
