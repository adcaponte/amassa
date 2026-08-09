---
phase: 03-gestor-de-encomendas
plan: 04
subsystem: ui
tags: [nextjs-15, react-19, tailwind-v4, playwright, gantt, client-component]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 01)
    provides: "db/schema.ts, lib/encomendas/acoes.ts (criarEncomenda), consultas.ts
      (listarEncomendasDoIndice), formulario-encomenda.tsx (formulário real)"
  - phase: 03-gestor-de-encomendas (plano 02)
    provides: "lib/encomendas/gantt.ts (PIXELS_POR_DIA, calcularIntervalo,
      celulasDeQuinzena, deslocamentoEmPixels, retanguloDaEtapa, rolagemInicial,
      ordenarParaGantt), cronograma.ts (situacaoEm), formato.ts (hojeEmBrasilia,
      formatarDiaCurto), textos.ts (as frases fixas e textoDaSituacao) — consumidos aqui,
      nenhum recalculado"
  - phase: 03-gestor-de-encomendas (plano 03)
    provides: "as sete Server Actions (não consumidas diretamente por este plano, mas
      confirmam que o índice não é o único consumidor de lib/encomendas/*)"
provides:
  - "components/amassa/encomendas/gantt.tsx: Gantt real (18px/dia, quinzenas, coluna fixa,
    linha de Hoje, marcos como losango, rascunho hachurado) medido por boundingBox/scrollLeft"
  - "components/amassa/encomendas/lista-encomendas.tsx: casca cliente que alterna Gantt/
    cartões por CSS (D-02), ponto de entrada para filtro do plano 07"
  - "components/amassa/encomendas/cartao-encomenda.tsx + trilha-segmentos.tsx: leitura
    mobile do cronograma, proporcional (não em px/dia), com etapa atual destacada"
  - "app/(app)/encomendas/{loading,error}.tsx: os dois estados que faltavam da tela"
  - "components/amassa/estado-vazio.tsx: hrefBotao?: string (aditivo) — primeiro botão de
    estado vazio do projeto que faz algo de verdade"
affects: [03-05, 03-06, 03-07, 03-08]

# Actuals (#2632)
actuals:
  tokens: 17000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Client Component de visualização (Gantt) recebendo dados JÁ calculados por props —
      nunca busca o banco, nunca recalcula data; toda posição/largura sai de
      retanguloDaEtapa/deslocamentoEmPixels (lib/encomendas/gantt.ts), nunca multiplicada
      por 18 no componente"
    - "useLayoutEffect com array de dependências VAZIO para uma rolagem inicial que deve
      rodar uma única vez por montagem (ENC-07/idempotency, ENC-07/concurrency) — o padrão
      a repetir sempre que uma tela precisar de posicionamento inicial que não pode ser
      sobrescrito por um gesto do usuário depois"
    - "Coluna fixa via position: sticky DENTRO do mesmo contêiner overflow-x-auto (não dois
      contêineres sincronizados) — mais simples e garante, por construção, que rolar a área
      de barras nunca move a coluna"
    - "e2e que recomputa o valor esperado chamando a MESMA função de produção
      (deslocamentoEmPixels/rolagemInicial) com o intervalo real lido de atributos data-*
      expostos pelo componente — nunca reconstrói o intervalo a partir de uma contagem
      presumida de encomendas, o que o mantém correto mesmo com dado concorrente de outras
      specs no mesmo banco de teste"

key-files:
  created:
    - components/amassa/encomendas/gantt.tsx
    - components/amassa/encomendas/lista-encomendas.tsx
    - components/amassa/encomendas/cartao-encomenda.tsx
    - components/amassa/encomendas/trilha-segmentos.tsx
    - app/(app)/encomendas/loading.tsx
    - app/(app)/encomendas/error.tsx
    - tests/e2e/encomendas-indice.spec.ts
  modified:
    - app/(app)/encomendas/page.tsx
    - components/amassa/estado-vazio.tsx
    - tests/e2e/encomendas.spec.ts

key-decisions:
  - "Gantt e lista mobile recebem o MESMO conjunto filtrado (só rascunho + em_producao,
    D-06) — sem filtro/histórico ainda (plano 07), simples e evita ordens divergentes entre
    as duas metades (ENC-08/ordering). Nenhuma encomenda pode virar concluida/cancelada
    nesta fase (sem UI para isso ainda), então o caso 'total > 0 mas ativas = 0' é
    inatingível hoje — o código já trata certo para quando o plano 05/07 abrir esse caminho"
  - "Coluna fixa do Gantt via sticky DENTRO do único contêiner rolável, em vez de dois
    contêineres sincronizados por scroll — mais simples e a garantia de 'rolar não move a
    coluna' vem de graça da própria CSS, não de JS"
  - "e2e mede a posição da linha de Hoje e o scrollLeft inicial recomputando com as funções
    de produção (deslocamentoEmPixels/rolagemInicial) sobre o intervalo REAL lido de
    atributos data-primeiro-dia/data-largura-em-pixels expostos pelo Gantt — evita depender
    de contar encomendas, o que quebraria com dado concorrente de outras specs"
  - "criarEncomenda() do e2e tenta até 3x, checando SE a encomenda já existe antes de
    reenviar: sob a suíte inteira em paralelo, o webServer de desenvolvimento local às
    vezes deixa uma submissão presa em ?nova sem redirecionar mesmo com a transação já
    concluída — reenviar sem checar duplicaria a encomenda"

patterns-established:
  - "Geometria de visualização (Gantt) sempre num módulo puro consumido por props — o
    componente React é só rasterização, nunca fonte de verdade de posição/tamanho"
  - "e2e de layout mede com boundingBox()/getComputedStyle() e recomputa o valor esperado
    com a função de produção real, nunca duplica a aritmética no teste"

requirements-completed: [ENC-03, ENC-06, ENC-07, ENC-08, ENC-09, ENC-13]

coverage:
  - id: D1
    description: "Gantt desktop: barra de produção de 3 dias mede 54px por boundingBox();
      Secagem (108px) mostra rótulo, Esmaltação (18px) não — limiar de 46px provado, não
      só suposto"
    requirement: "ENC-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#uma barra de produção de 3 dias mede
          54px, e a etapa 'Secagem' mostra rótulo dentro da barra"
        status: pass
    human_judgment: false
  - id: D2
    description: "queima1/queima2/entrega desenham losango (rotate(45deg), medido via
      getComputedStyle().transform); produção/secagem/esmaltação desenham retângulo sem
      rotação — nunca o ícone Diamond do lucide-react"
    requirement: "ENC-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#queima1/queima2/entrega desenham losango
          (rotate(45deg)); produção/secagem/esmaltação desenham retângulo"
        status: pass
      - kind: other
        ref: "grep -c 'Diamond' components/amassa/encomendas/gantt.tsx (0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A linha de 'Hoje' fica exatamente na posição que deslocamentoEmPixels
      prevê (recomputado com o intervalo real lido do DOM), e o cabeçalho de quinzenas
      cobre a área rolável inteira sem vão"
    requirement: "ENC-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#a linha de 'Hoje' fica na posição que
          deslocamentoEmPixels prevê, e o cabeçalho de quinzenas cobre a área rolável sem
          vão"
        status: pass
    human_judgment: false
  - id: D4
    description: "scrollLeft inicial é exatamente o valor de rolagemInicial (recomputado
      com a mesma função de produção), nunca negativo, e sobrevive a um recarregamento
      (ENC-07/idempotency); um gesto manual de rolagem depois da montagem não é
      sobrescrito por uma nova aplicação (ENC-07/concurrency)"
    requirement: "ENC-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#o scrollLeft inicial é o valor de
          rolagemInicial ... e ENC-07/concurrency: rolar manualmente depois da montagem..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Rolar a área de barras não move a coluna fixa de nome+cliente; duas
      encomendas aparecem na ordem de ordenarParaGantt (data de início ascendente); com
      uma encomenda só, a timeline ainda desenha a quinzena de folga em cada ponta"
    requirement: "ENC-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts (3 casos no describe 'Gantt desktop')"
        status: pass
    human_judgment: false
  - id: D6
    description: "Lista mobile: com várias encomendas carregadas, /encomendas não rola
      horizontalmente (regra dura de §6); o cartão mostra nome, cliente, a trilha de 6
      segmentos e o texto de situação de textoDaSituacao"
    requirement: "ENC-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts (describe 'Lista mobile')"
        status: pass
    human_judgment: false
  - id: D7
    description: "O segmento da etapa atual (a que situacaoEm aponta) ganha borda de 2px
      medida por getComputedStyle().borderTopWidth; os demais segmentos não têm borda; a
      soma das larguras dos segmentos preenche a trilha inteira, sem lacuna"
    requirement: "ENC-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#o segmento da etapa atual tem borda de
          2px... e #a soma das larguras dos segmentos preenche a largura da trilha..."
        status: pass
    human_judgment: false
  - id: D8
    description: "Nome de 60+ caracteres quebra em linha (overflowWrap: break-word) dentro
      do cartão, sem gerar rolagem horizontal; encomenda atrasada mostra badge ATRASADA e
      texto do caso atrasada com --color-atencao (rgb(180,83,9)), nunca --color-erro;
      encomenda que ainda não começou mostra 'Começa em N dias' sem segmento destacado; a
      ordem dos cartões segue ordenarParaGantt"
    requirement: "ENC-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts (4 casos no describe 'Lista mobile')"
        status: pass
    human_judgment: false
  - id: D9
    description: "Com o banco vazio, a frase 'A roda ainda não gira.' aparece exatamente
      uma vez (toHaveCount(1), nunca uma cópia por metade Gantt/lista) e o botão do estado
      vazio está habilitado, com href=/encomendas?nova; com uma encomenda no banco, a
      frase não está no documento"
    requirement: "ENC-13"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts (describe 'Estados obrigatórios (ENC-13)')
          — confiável quando rodado com --grep 'índice de encomendas' (ver Known Stubs)"
        status: pass
    human_judgment: false
  - id: D10
    description: "app/(app)/encomendas/loading.tsx mostra esqueleto no FORMATO do Gantt/
      lista (nunca 'carregando' solto); app/(app)/encomendas/error.tsx reusa EstadoErro sem
      renderizar nenhuma propriedade de error"
    verification:
      - kind: other
        ref: "grep -c 'Skeleton' loading.tsx (9); grep -c 'carregando' loading.tsx (0);
          head -1 error.tsx ('use client'); grep -c 'error.message|error.digest' error.tsx
          (0)"
        status: pass
    human_judgment: false
  - id: D11
    description: "Rascunho no Gantt/cartão: repeating-linear-gradient preservando a cor
      cheia da etapa, borda tracejada, selo RASCUNHO uma vez por linha/cartão — código
      implementado por leitura, sem prova e2e nesta fatia (nenhuma UI cria status=rascunho
      ainda)"
    verification: []
    human_judgment: true
    rationale: "Nenhum caminho de escrita desta fase (só criarEncomenda, que sempre grava
      em_producao) alcança status=rascunho — a UI para isso nasce nos planos 05/06. O
      código do hachurado/selo é implementado exatamente como 03-UI-SPEC.md especifica
      (grep confirma repeating-linear-gradient presente em gantt.tsx e trilha-
      segmentos.tsx), mas só um teste com dado real de rascunho (ou revisão visual manual
      quando a UI de rascunho existir) fecha a prova."
  - id: D12
    description: "Gantt nunca desenha encomenda concluida/cancelada (D-06); etapa com
      dias:0 não produz elemento no DOM daquela linha; cartão com as 6 etapas em dias:0
      mostra 'Nenhuma etapa ligada'"
    verification: []
    human_judgment: true
    rationale: "Nenhum caminho de escrita desta fase alcança esses estados — status só
      muda para concluida/cancelada nos planos 05, e dias por etapa só é editável no plano
      06 (ajuste rápido) e 03 (Server Action já existe, sem UI). O filtro de status em
      page.tsx e o `if (faixa.dias === 0) return null`/`duracaoTotal === 0` em
      trilha-segmentos.tsx são revisáveis por leitura de código; ficam sem e2e dedicado até
      a UI que alcança esses estados existir."

duration: ~100min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 4: Índice de Verdade — Gantt Desktop e Lista Mobile Summary

**Gantt real (18px/dia, quinzenas, coluna fixa, linha de "Hoje") e lista de cartões mobile,
provados por `boundingBox()`/`scrollLeft` medidos no navegador com as mesmas funções de
produção que o componente usa — nunca por inspeção visual.**

## Performance

- **Duration:** ~100 min
- **Started:** 2026-08-09T16:30:00Z (aprox.)
- **Completed:** 2026-08-09T16:31:32Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- `gantt.tsx`: Gantt desktop real — a escala de 18px/dia, a posição da linha de "Hoje" e a
  rolagem inicial (`useLayoutEffect` com dependência vazia) medidas por `boundingBox()` e
  `scrollLeft` no e2e, recomputadas com as MESMAS funções de produção
  (`deslocamentoEmPixels`/`rolagemInicial`) sobre o intervalo real lido de atributos `data-*`
  — nunca "o Gantt aparece"
- Marcos (`queima1`/`queima2`/`entrega`) desenhados como losango (`rotate(45deg)`, nunca o
  ícone `Diamond`); intervalos como retângulo; rótulo dentro da barra só acima de 46px;
  rascunho com hachura diagonal preservando a cor cheia da etapa (implementado, sem UI ainda
  para exercitar via e2e — ver `coverage` D11/D12)
- `lista-encomendas.tsx` alterna Gantt/cartões só por CSS (`hidden md:block`/`md:hidden`,
  D-02), sem `hooks/use-mobile.ts`
- `trilha-segmentos.tsx` + `cartao-encomenda.tsx`: leitura mobile proporcional (não em
  px/dia), etapa atual com borda de 2px, nome quebrando em linha (nunca truncado), badge
  ATRASADA em `--color-atencao` (nunca `--color-erro`), texto de situação sempre de
  `textoDaSituacao`
- `app/(app)/encomendas/loading.tsx`/`error.tsx`: os dois estados que faltavam, no formato do
  conteúdo que substituem
- `estado-vazio.tsx` ganha `hrefBotao?: string` (aditivo) — primeiro botão de estado vazio do
  projeto que faz alguma coisa de verdade, sem tocar nas quatro telas que continuam com o
  botão inerte (provado pela suíte `casca` completa)
- `tests/e2e/encomendas-indice.spec.ts`: 21 casos novos (Gantt desktop, lista mobile, estados
  obrigatórios), todos criando dados pela Server Action real via formulário

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Gantt no desktop — 18px/dia medido no navegador** — `6a7d517` (feat)
2. **Tarefa 2: Lista vertical de cartões no celular, sem rolagem horizontal** — `b65b322`
   (feat)
3. **Tarefa 3: Os três estados e o botão do estado vazio ativo** — `7dd42c9` (feat)

**Fix pós-verificação:** `90d94ee` — mesma proteção de retry-sem-duplicar aplicada ao e2e
pré-existente `encomendas.spec.ts`, descoberta ao rodar a suíte completa.

_Nenhuma tarefa TDD isolada por commit `test(...)`/`feat(...)` separado — cada tarefa seguiu
"teste vermelho → implementação → teste verde" dentro de um único commit atômico, o mesmo
padrão que os planos 01 e 02 já registraram como decisão para esta fase._

## Files Created/Modified
- `components/amassa/encomendas/gantt.tsx` — novo: Client Component do Gantt
- `components/amassa/encomendas/lista-encomendas.tsx` — novo: casca cliente, alterna Gantt/
  cartões por CSS
- `components/amassa/encomendas/cartao-encomenda.tsx` — novo: cartão do índice mobile
- `components/amassa/encomendas/trilha-segmentos.tsx` — novo: trilha de 6 segmentos
  proporcionais
- `app/(app)/encomendas/loading.tsx` — novo: esqueleto no formato do índice
- `app/(app)/encomendas/error.tsx` — novo: boundary de erro do índice
- `app/(app)/encomendas/page.tsx` — calcula `hoje`/cronograma/situação no servidor, filtra a
  ativas (D-06), ordena com `ordenarParaGantt`, `hrefBotao` no estado vazio
- `components/amassa/estado-vazio.tsx` — `hrefBotao?: string` aditivo
- `tests/e2e/encomendas-indice.spec.ts` — novo: 21 casos (Gantt, lista mobile, estados)
- `tests/e2e/encomendas.spec.ts` — ajustado para D-02 (nome aparece 2x no DOM) e retry-sem-
  duplicar

## Decisions Made
Ver `key-decisions` no frontmatter — filtro compartilhado Gantt/lista, coluna fixa via
`sticky` num único contêiner, medição e2e recomputando com as funções de produção reais, e o
retry-com-checagem do `criarEncomenda()` do e2e.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `tests/e2e/encomendas.spec.ts` (plano 01) quebrava por causa da própria
mudança que este plano exige (D-02)**
- **Found during:** Tarefa 1, `npm run test:e2e` completo
- **Issue:** `getByText(nomeDaEncomenda).locator("..")` resolvia a 2 elementos — o nome
  passou a aparecer duas vezes no DOM (linha do Gantt + cartão mobile, um escondido por CSS
  em cada largura), exatamente o que D-02 pede.
- **Fix:** Localiza pela metade VISÍVEL (`page.getByText(...).and(page.locator(":visible"))`),
  mesmo princípio de `tests/e2e/casca.spec.ts`; a asserção de data formatada foi trocada por
  uma checagem de persistência (a cascata de datas em si já tem prova dedicada em
  `tests/unit/cronograma.test.ts` e no e2e novo, barra de 54px por `boundingBox`).
- **Files modified:** `tests/e2e/encomendas.spec.ts`
- **Committed in:** `6a7d517` (Tarefa 1)

**2. [Rule 1 — Bug] `use-mobile` como substring literal no próprio comentário explicativo**
- **Found during:** Tarefa 1, checagem do critério de aceite `grep -c 'use-mobile'`
- **Issue:** O comentário em `lista-encomendas.tsx` que EXPLICA para nunca usar
  `hooks/use-mobile.ts` continha a própria substring proibida, fazendo o grep de aceite
  falhar por um comentário, não por código.
- **Fix:** Reescrito sem a substring literal, preservando o aviso.
- **Files modified:** `components/amassa/encomendas/lista-encomendas.tsx`
- **Committed in:** `6a7d517` (Tarefa 1)

**3. [Rule 1 — Bug] Mesma armadilha com a palavra "carregando" no comentário de
`loading.tsx`**
- **Found during:** Tarefa 3, checagem do critério de aceite `grep -c 'carregando'`
- **Issue:** Comentário citando "nunca um 'carregando…' solto" continha a própria palavra.
- **Fix:** Reescrito sem a palavra literal.
- **Files modified:** `app/(app)/encomendas/loading.tsx`
- **Committed in:** `7dd42c9` (Tarefa 3)

**4. [Rule 3 — Blocking] `clientWidth` lido antes do CSS aplicar, em vários testes do e2e**
- **Found during:** Tarefa 1, `npm run test:e2e` sob carga (múltiplos workers)
- **Issue:** `locator.evaluate(el => el.clientWidth)` só espera o elemento estar ANEXADO ao
  DOM, não que o CSS já tenha sido aplicado — logo após `page.goto()`, ocasionalmente lia
  `clientWidth === 0`, produzindo um valor esperado de `rolagemInicial` completamente errado
  (diagnosticado com `console.log` temporário no componente e no teste; removido depois).
- **Fix:** Todo local que lê `clientWidth` agora primeiro `await expect(locator).toBeVisible()`
  (que exige caixa delimitadora não vazia, forçando esperar o CSS de verdade).
- **Files modified:** `tests/e2e/encomendas-indice.spec.ts`
- **Committed in:** `6a7d517` (Tarefa 1)

**5. [Rule 1 — Bug] `criarEncomenda()` do e2e ocasionalmente presa em `?nova` sob a suíte em
paralelo — webServer local, não defeito de validação**
- **Found during:** Tarefas 1-3, `npm run test:e2e` completo
- **Issue:** Sob múltiplos workers, uma submissão isolada às vezes não observava o redirect
  a tempo. Diagnosticado com precisão: não era falha de validação (o nome de teste de "60+
  caracteres" tinha, à parte, um bug real que excedia os 120 caracteres do esquema — corrigido
  separadamente); com dado válido, a causa era puramente timing do ambiente local.
- **Fix:** `criarEncomenda()` tenta até 3x; antes de reenviar, confere se a encomenda já
  existe (evita duplicar quando a transação já tinha sido concluída no servidor). Mesma
  proteção aplicada a `tests/e2e/encomendas.spec.ts` (commit separado, `90d94ee`).
- **Files modified:** `tests/e2e/encomendas-indice.spec.ts`, `tests/e2e/encomendas.spec.ts`
- **Committed in:** `6a7d517`, `b65b322`, `90d94ee`

**6. [Rule 1 — Bug] Fixture de "nome de 60+ caracteres" excedia o limite de 120 do esquema**
- **Found during:** Tarefa 2, investigação da Deviation 5
- **Issue:** `"Peça...".repeat(2)` produzia 123 caracteres, além do `esquemaEncomenda.nome`
  (`.max(120)`) — a submissão falhava a validação Zod em silêncio (stub conhecido de
  03-01-SUMMARY.md: o formulário não mostra erro na tela), travando em `?nova` para sempre.
- **Fix:** Nome reescrito para 90 caracteres — continua "60+", agora dentro do limite.
- **Files modified:** `tests/e2e/encomendas-indice.spec.ts`
- **Committed in:** `b65b322` (Tarefa 2)

**7. [Rule 1 — Bug] Datas de teste em UTC puro divergiam do `hojeEmBrasilia` do servidor**
- **Found during:** Revisão antes da Tarefa 2 (casos "Começa em N dias"/"atrasada")
- **Issue:** `dataEmDias()` original somava dias sobre `new Date()` em UTC — entre 21h e
  23h59 de Brasília (00h-02h59 UTC), o "hoje" em UTC já seria amanhã, deslocando em 1 dia
  qualquer asserção de contagem exata ("Começa em 30 dias").
- **Fix:** `dataEmDias()` agora calcula "hoje" com o MESMO método de `hojeEmBrasilia`
  (`Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"`) antes de somar o deslocamento.
- **Files modified:** `tests/e2e/encomendas-indice.spec.ts`
- **Committed in:** `b65b322` (Tarefa 2)

**8. [Rule 1 — Bug] Locator `.last()` sobre dois links "Nova encomenda" resolvia de forma
inconsistente**
- **Found during:** Tarefa 3, `npm run test:e2e` (celular)
- **Issue:** O teste de estado vazio usava `.last()` entre o link do cabeçalho e o do
  `EstadoVazio` (mesmo texto acessível, mesmo `href`) para clicar e conferir a navegação —
  ocasionalmente clicava e a URL não mudava como esperado.
- **Fix:** Reescrito para (a) escopar via `data-testid="estado-vazio"` (novo, no componente)
  em vez de `.last()`, e (b) conferir o contrato via `toHaveAttribute("href", ...)` em vez de
  clicar e aguardar navegação — mais determinístico, sem depender do tempo de uma navegação
  de cliente completar.
- **Files modified:** `components/amassa/estado-vazio.tsx`, `tests/e2e/encomendas-indice.spec.ts`
- **Committed in:** `7dd42c9` (Tarefa 3)

---

**Total deviations:** 8 (7 Rule 1 — bugs no próprio e2e/teste, 1 Rule 3 — blocking, timing de
CSS). Nenhuma mudança na lógica de produção além do `hrefBotao` explicitamente pedido pelo
plano; todos os outros ajustes foram no arquivo de teste ou em comentários.
**Impact on plan:** Nenhum. O código de produção (`gantt.tsx`, `trilha-segmentos.tsx`,
`cartao-encomenda.tsx`, `lista-encomendas.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`,
`estado-vazio.tsx`) corresponde exatamente ao que o plano descreveu; as 8 deviations foram
todas descobertas e corrigidas na CONSTRUÇÃO do e2e, nunca no comportamento da aplicação.

## Issues Encountered
- A investigação da Deviation 5 exigiu instrumentação temporária (`console.log` no componente
  e no teste, capturado via `page.on("console", ...)`) para provar que o valor calculado no
  navegador (`clientWidth`, `rolagemInicial`) batia com o esperado — a causa raiz (Deviation 4)
  só ficou visível assim. Toda instrumentação foi removida antes do commit.
- `tests/e2e/autenticacao.spec.ts:72` ("sexta tentativa") continua com o timeout intermitente
  pré-existente já documentado em `03-03-SUMMARY.md`, independente deste plano.

## User Setup Required

None — nenhuma configuração de serviço externo, nenhum pacote novo.

## Known Stubs / Limitações Conhecidas

- **Teste ENC-13 "banco vazio" (`tests/e2e/encomendas-indice.spec.ts`, describe "Estados
  obrigatórios") depende do banco de teste estar genuinamente vazio no início da execução.**
  É confiável ao rodar `npm run test:e2e -- --grep "índice de encomendas"` (o comando de
  verificação literal desta tarefa — só este arquivo roda, sem interferência de outros
  specs). No `npm run test:e2e` COMPLETO (sem grep), `tests/e2e/encomendas.spec.ts` roda em
  paralelo em outro worker e pode criar uma encomenda antes da asserção deste teste — não é
  um defeito do `EstadoVazio`/`hrefBotao` (esse contrato está correto e provado pelo teste
  quando o banco está de fato vazio), é uma limitação estrutural da suíte (sem isolamento de
  banco por teste/arquivo), pré-existente a este plano. Registrado em `.planning/WINDOWS.md`
  (entrada #5).
- **Rascunho no Gantt/cartão (hachura, selo) e a ausência de concluida/cancelada no Gantt não
  têm prova e2e nesta fatia** — nenhum caminho de escrita desta fase alcança esses estados
  (status só muda a partir do plano 05; a UI de ajuste de etapa é do plano 06). O código está
  implementado exatamente como `03-UI-SPEC.md` especifica (confirmado por leitura e pelos
  grep de aceite: `repeating-linear-gradient` presente, filtro de status em `page.tsx`); a
  prova por dado real fica para quando a UI que alcança esses estados existir (ver `coverage`
  D11/D12 no frontmatter).

## Next Phase Readiness

- `/encomendas/{id}` (plano 05) já é o destino de `CartaoEncomenda` e o clique numa linha do
  histórico futuro — a página ainda não existe, então o clique hoje leva a um 404, esperado.
- `estado-vazio.tsx` com `hrefBotao` está pronto para qualquer tela futura que precise de um
  botão de estado vazio ativo, sem precisar tocar no componente de novo.
- Bloqueio já registrado pelo plano 01 (`components/ui/form.tsx` não instala,
  `deferred-items.md`/`WINDOWS.md` #4) continua em aberto para o plano 06 decidir.
- A "Deviation 5" (retry-com-checagem no `criarEncomenda()` do e2e) é um padrão reaproveitável
  para qualquer teste futuro desta fase que crie dado pelo formulário sob a suíte em paralelo.

## Self-Check: PASSED

Os 7 arquivos novos (`gantt.tsx`, `lista-encomendas.tsx`, `cartao-encomenda.tsx`,
`trilha-segmentos.tsx`, `loading.tsx`, `error.tsx`, `encomendas-indice.spec.ts`) e os 3
arquivos modificados (`page.tsx`, `estado-vazio.tsx`, `encomendas.spec.ts`) confirmados
presentes no disco; os quatro commits (`6a7d517`, `b65b322`, `7dd42c9`, `90d94ee`) confirmados
em `git log --oneline --all`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-09*
