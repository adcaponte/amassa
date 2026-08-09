---
phase: 03-gestor-de-encomendas
plan: 07
subsystem: ui
tags: [nextjs-15, react-19, tailwind-v4, radix-ui, drizzle, playwright, client-filter]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 02)
    provides: "lib/encomendas/gantt.ts (calcularIntervalo, ordenarParaGantt), cronograma.ts
      (situacaoEm, Situacao — a base estrutural que filtros.ts redeclara), textos.ts
      (as frases fixas) — consumidos sem recalcular nada"
  - phase: 03-gestor-de-encomendas (plano 04)
    provides: "lista-encomendas.tsx (casca cliente do índice, D-02), gantt.tsx (calcularIntervalo
      já rodando internamente a cada render), cartao-encomenda.tsx"
  - phase: 03-gestor-de-encomendas (plano 06)
    provides: "o achado de Dialog único vs. Dialog+Sheet simultâneos (03-06-SUMMARY.md) — o mesmo
      princípio de D-02 (dois halves sempre no DOM, um escondido por CSS) aplicado aqui à barra de
      filtro nas duas larguras"
provides:
  - "lib/encomendas/filtros.ts: módulo puro zero-import — normalizarParaBusca/combina (D-13, busca
    sem acento em nome+cliente+itens), filtrarPorStatus, compararPorDataDeInicio/
    compararPorUrgencia/compararPorNome (comparadores totais), aplicarFiltros,
    calcularJanelaDoHistorico (o corte de 12 meses do histórico)"
  - "components/amassa/encomendas/filtro-encomendas.tsx: os três controles de D-11/D-12/D-13 nas
    duas larguras — barra fixa de 56px + Sheet no celular, lado a lado no desktop"
  - "components/amassa/encomendas/linha-historico.tsx: a linha de lista do histórico (D-07) —
    nome, badge de status, cliente, período, resumo de itens, min-h-14"
  - "components/amassa/encomendas/lista-encomendas.tsx: estado do filtro (useState local, D-11),
    aplicarFiltros rodando no cliente, o branch de histórico (D-07) e o reajuste explícito do
    intervalo do Gantt (D-14)"
  - "lib/encomendas/consultas.ts: listarEncomendasDoIndice(hoje) com a janela de 12 meses"
  - "components/amassa/estado-vazio.tsx: aoClicar?: () => void aditivo — segunda forma de botão
    ativo (ação de cliente, não navegação)"
affects: [03-08]

# Actuals (#2632)
actuals:
  tokens: 21200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Quarto módulo puro sem import da fase: filtros.ts redeclara estruturalmente o `Situacao`
      de cronograma.ts (SituacaoDeUrgencia, um subconjunto de campos por ramo) em vez de importar
      — TypeScript aceita por tipagem estrutural, sem precisar de `import type`, porque o grep de
      aceite exige zero linhas `^import` no arquivo inteiro"
    - "Recalcular explicitamente com a mesma função de produção (calcularIntervalo) no componente
      PAI (lista-encomendas.tsx) além do cálculo que o Gantt já faz sozinho internamente —
      redundante em termos de resultado (os dois sempre concordam, mesma função pura, mesmos
      dados), mas expõe o intervalo como atributo `data-*` num wrapper próprio, deixando o e2e
      confirmar D-14 sem depender de nenhum detalhe interno do Gantt"
    - "Segunda forma de botão ativo em EstadoVazio (aoClicar, ação de cliente) ao lado da primeira
      (hrefBotao, navegação) — mutuamente exclusivas na prática, cada tela usa uma; nenhuma das
      duas rotas quebra o botão inerte padrão que quatro outras telas ainda usam"
    - "e2e: `page.waitForLoadState('networkidle')` depois de navegar para uma rota com botão
      interativo que será clicado no PRÓXIMO passo do teste — sem isso, um clique imediato pode
      chegar antes do React terminar de anexar o `onClick` (o Playwright vê o elemento visível e
      estável por checagem de DOM/CSS, não por presença de listener JS), e o clique se perde em
      silêncio, sem erro nenhum. Achado real, não suposição — ver Deviations"

key-files:
  created:
    - lib/encomendas/filtros.ts
    - tests/unit/filtros-encomendas.test.ts
    - components/amassa/encomendas/filtro-encomendas.tsx
    - components/amassa/encomendas/linha-historico.tsx
    - tests/e2e/encomendas-filtros.spec.ts
  modified:
    - components/amassa/encomendas/lista-encomendas.tsx
    - components/amassa/estado-vazio.tsx
    - lib/encomendas/textos.ts
    - lib/encomendas/consultas.ts
    - app/(app)/encomendas/page.tsx

key-decisions:
  - "compararPorUrgencia (D-12, 'urgência') traduz cada Situacao num único número de proximidade:
    atrasada é a mais urgente de todas (mais negativo quanto maior o atraso), um marco 'já está
    acontecendo agora' (0), depois as três proximidades em dias (não-começou/intervalo/última
    etapa) na ordem natural; concluída/cancelada/sem-etapas (sem próxima etapa) vão sempre para o
    FIM. Não estava especificado em fórmula no plano — decisão do executor, documentada aqui e no
    próprio código"
  - "resumoDeItens (linha do histórico): 1 item mostra só a própria descrição (já é a pista de
    conteúdo, um '+0' atrás dela seria ruído); mais de um mostra 'primeira descrição · +N'. A
    frase '3 itens' do UI-SPEC foi lida como exemplo do RESULTADO ('ou seja') dessa segunda forma,
    não como uma terceira opção de formato"
  - "Estado vazio do histórico ('Nada concluído ou cancelado ainda.'): a frase única que o plano
    nomeia (FRASE_HISTORICO_VAZIO) virou o TÍTULO (papel `título`, mesmo padrão de FRASE_VAZIO_
    TITULO/FRASE_FILTRO_VAZIO_TITULO); o corpo é uma frase nova, não exportada ('Quando uma
    encomenda for concluída ou cancelada, ela aparece bem aqui.'), porque o componente EstadoVazio
    exige os dois campos e o plano só nomeou uma constante"
  - "atualizadoEm (timestamptz, tocado pelo gatilho tocar_atualizado_em na migração 0006) é a
    aproximação de 'quando cancelou' — o schema não tem coluna dedicada de cancelamento.
    hojeEmBrasilia() é reaproveitada para converter esse instante (não só 'agora') no dia civil de
    Brasília — a função já era genérica, só o nome sugere um uso mais comum"
  - "cancelarEncomenda/concluirEncomenda continuam sem alteração de assinatura — nenhum caminho de
    escrita da fase 03 precisou mudar para este plano; só a leitura (consultas.ts) e a UI mudaram"

patterns-established:
  - "Módulo puro redeclarando estruturalmente o tipo de união discriminada de um irmão (em vez de
    import type) quando o grep de aceite exige zero imports no arquivo inteiro — o padrão a seguir
    sempre que um novo módulo zero-import precisar do formato de dado calculado por outro"

requirements-completed: [ENC-10]

coverage:
  - id: D1
    description: "normalizarParaBusca/combina (D-13): busca sem acento e sem caixa varrendo nome,
      cliente e descrição de item; termo vazio/só espaço não filtra nada; termo é subcadeia
      literal da cadeia normalizada, nunca quebrado em palavras"
    requirement: "ENC-10"
    verification:
      - kind: unit
        ref: "tests/unit/filtros-encomendas.test.ts#normalizarParaBusca / #combina (11 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "filtrarPorStatus e os três comparadores (data de início/urgência/nome) são
      totais — duas encomendas empatadas sempre desempatam até o id, e aplicar sort duas vezes
      sobre a mesma lista devolve a mesma ordem"
    requirement: "ENC-10"
    verification:
      - kind: unit
        ref: "tests/unit/filtros-encomendas.test.ts#filtrarPorStatus / #compararPorDataDeInicio /
          #compararPorNome / #compararPorUrgencia / #os três comparadores são totais (13 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "calcularJanelaDoHistorico(hoje) devolve a data de corte de 12 meses, com o
      ajuste de dia em 29 de fevereiro de ano bissexto voltando para um fevereiro comum"
    verification:
      - kind: unit
        ref: "tests/unit/filtros-encomendas.test.ts#calcularJanelaDoHistorico (2 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Digitar um termo reduz a lista sem recarregar a página e sem nenhuma requisição
      de rede (D-11); termo sem resultado mostra 'Nada por aqui com esse filtro.' com 'Limpar
      filtros' ativo, que devolve a lista inteira ao clicar; com o banco vazio aparece 'A roda
      ainda não gira.' e nunca 'Nada por aqui com esse filtro.'"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#filtro de encomendas (3 casos: banco vazio,
          busca sem reload, Nada por aqui + Limpar filtros)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Filtrar reduz o intervalo do Gantt (D-14): a largura do contêiner rolável
      diminui e passa a cobrir só o que sobrou, com o valor exato recomputado por
      calcularIntervalo sobre os cronogramas reais que sobraram"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#filtro de encomendas#filtrar reduz o intervalo
          do Gantt (D-14)..."
        status: pass
    human_judgment: false
  - id: D6
    description: "Trocar a ordenação para 'Nome' reordena o Gantt e os cartões juntos (mesma
      ordem nas duas metades); recarregar a página perde o filtro e volta ao padrão (D-11,
      consequência aceita)"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#filtro de encomendas#trocar a ordenação... /
          #recarregar a página perde o filtro..."
        status: pass
    human_judgment: false
  - id: D7
    description: "Desktop: busca + Select de status + Select de ordenação lado a lado, sempre
      visíveis. Celular: busca numa barra fixa de 56px, botão SlidersHorizontal de 44×44px abrindo
      um Sheet com os dois Select"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#filtro de encomendas#no desktop... / #no
          celular..."
        status: pass
    human_judgment: false
  - id: D8
    description: "listarEncomendasDoIndice(hoje): uma encomenda concluída com data de início de 13
      meses atrás NÃO aparece no índice, em nenhum filtro — a janela de 12 meses corta antes de
      chegar ao navegador"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#histórico de encomendas#uma encomenda
          concluída com data de início de 13 meses atrás..."
        status: pass
    human_judgment: false
  - id: D9
    description: "Trocar o filtro para 'Concluídas' mostra a lista de linhas do histórico
      (nenhum Gantt em nenhum projeto), com nome, badge, cliente, período e o resumo 'primeira
      descrição · +N' de itens; a linha tem no mínimo 56px e leva a /encomendas/{id}"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#histórico de encomendas#trocar o filtro para
          'Concluídas'..."
        status: pass
    human_judgment: false
  - id: D10
    description: "Badge 'Cancelada' nunca usa a cor de erro (fundo diferente de rgb(254,226,226));
      o período de uma cancelada mostra 'cancelada em {data}', nunca a conclusão prevista que
      nunca aconteceu"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#histórico de encomendas#badge 'Cancelada'..."
        status: pass
    human_judgment: false
  - id: D11
    description: "Com o filtro em 'Todas', as ativas continuam no Gantt/lista normal e as
      históricas aparecem ABAIXO, sempre como lista; o Gantt nunca desenha uma linha para uma
      encomenda concluída/cancelada, provado de novo especificamente sob 'Todas' (D-06)"
    requirement: "ENC-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-filtros.spec.ts#histórico de encomendas#com o filtro em
          'Todas'..."
        status: pass
    human_judgment: false
  - id: D12
    description: "Enquanto o índice carrega, os controles de filtro estão desabilitados"
    verification: []
    human_judgment: true
    rationale: "Não se aplica na arquitetura construída: FiltroEncomendas só monta DEPOIS que
      page.tsx (Server Component) já resolveu os dados — o estado 'carregando' é inteiramente
      coberto pelo Skeleton de loading.tsx (plano 04), nunca por um FiltroEncomendas desabilitado
      simultaneamente presente. Revisão de código confirma a estrutura; nenhum teste automatizado
      dedicado, porque não há estado intermediário real para provar."
  - id: D13
    description: "Registrado no SUMMARY, como consequência aceita e já decidida em D-11:
      recarregar a página perde o filtro; encomendas mais antigas que 12 meses continuam no
      banco e continuam alcançáveis — só não vêm no carregamento padrão"
    verification: []
    human_judgment: false

duration: ~65min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 7: Filtro, Busca, Ordenação e Histórico Summary

**`filtros.ts` (quarto módulo puro sem import da fase) resolve busca sem acento em três campos,
três comparadores totais e a janela de 12 meses; a barra de filtro nas duas larguras e o histórico
como o próprio índice com outro filtro (D-07) fecham ENC-10.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-09T18:57:00Z (aprox., logo após 03-06)
- **Completed:** 2026-08-09T19:59:00Z (aprox.)
- **Tasks:** 3
- **Files modified:** 10 (5 novos, 5 modificados)

## Accomplishments

- `lib/encomendas/filtros.ts`: quarto módulo puro sem import da fase — `normalizarParaBusca`
  (`normalize("NFD")` + remoção de `\p{Diacritic}` + `toLocaleLowerCase("pt-BR")`, D-13),
  `combina` (varre nome + cliente + descrições de item, termo nunca quebrado em palavras),
  `filtrarPorStatus`, três comparadores TOTAIS (`compararPorDataDeInicio`/`compararPorUrgencia`/
  `compararPorNome`, sempre desempatando até o `id`), `aplicarFiltros` (interseção das três
  dimensões) e `calcularJanelaDoHistorico` (o corte de 12 meses). 28 testes de unidade
- `filtro-encomendas.tsx`: os três controles nas duas larguras — desktop lado a lado, sempre
  visíveis; celular numa barra fixa de 56px com busca sempre à mão e um botão
  `SlidersHorizontal` de 44×44px abrindo um `Sheet` com os dois `Select`
- `lista-encomendas.tsx`: o estado do filtro (`useState`) e `aplicarFiltros` rodando no navegador
  sobre a lista já carregada (D-11) — sem nenhuma ida ao servidor a cada tecla, comprovado por um
  marcador de `window` que só sobrevive sem recarregamento de página. O intervalo do Gantt é
  recalculado explicitamente aqui com `calcularIntervalo` (D-14), exposto como atributo `data-*`
  para o e2e confirmar sem depender de detalhe interno do `Gantt`
- `linha-historico.tsx` + o branch de histórico em `lista-encomendas.tsx` (D-07): filtro
  "Concluídas"/"Canceladas" vira LISTA nas duas larguras, sem Gantt nenhum; filtro "Todas" mantém
  as ativas no Gantt/lista normal com as históricas abaixo. Badge "Cancelada" nunca usa a cor de
  erro (cancelar não é erro); período de uma cancelada mostra "cancelada em {data}", nunca a
  conclusão prevista que nunca aconteceu
- `consultas.ts`: `listarEncomendasDoIndice(hoje)` ganha a janela de 12 meses — todas as
  `rascunho`/`em_producao`, só as `concluida`/`cancelada` cuja `data_inicio` está dentro do último
  ano. Data de corte calculada em TypeScript, nunca `current_date` do Postgres
- `estado-vazio.tsx` ganha `aoClicar?: () => void` aditivo — a segunda forma de botão ativo do
  projeto (ação de cliente, não navegação), sem tocar nas quatro telas que continuam com o botão
  inerte
- `tests/e2e/encomendas-filtros.spec.ts`: 19 casos novos nos dois projetos, em dois describes que
  casam com os dois comandos de verificação do plano ("filtro de encomendas", "histórico de
  encomendas")

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: `filtros.ts` — normalização sem acento, busca em três campos e comparadores
   totais** — `7af5b85` (feat)
2. **Tarefa 2: A barra de filtro nas duas larguras e o reajuste do intervalo do Gantt** —
   `a5565ee` (feat)
3. **Tarefa 3: Histórico — janela de 12 meses no servidor e linhas de lista inclusive no
   desktop** — `4cb7c37` (feat)

_Cada tarefa seguiu "teste vermelho → implementação → teste verde" dentro de um único commit
atômico, o mesmo padrão que os planos 01-06 já registraram como decisão para esta fase — não há
commits `test(...)`/`feat(...)` separados por tarefa._

## Files Created/Modified

- `lib/encomendas/filtros.ts` — novo: módulo puro, zero import
- `tests/unit/filtros-encomendas.test.ts` — novo: 28 casos
- `components/amassa/encomendas/filtro-encomendas.tsx` — novo: os três controles nas duas
  larguras
- `components/amassa/encomendas/linha-historico.tsx` — novo: linha de lista do histórico
- `tests/e2e/encomendas-filtros.spec.ts` — novo: 19 casos, dois describes
- `components/amassa/encomendas/lista-encomendas.tsx` — estado do filtro, branch de histórico,
  reajuste do intervalo
- `components/amassa/estado-vazio.tsx` — `aoClicar?` aditivo
- `lib/encomendas/textos.ts` — `ROTULO_LIMPAR_FILTROS`, `PLACEHOLDER_BUSCA`,
  `ROTULO_FILTRAR_E_ORDENAR`, `ROTULO_STATUS`, `ROTULO_ORDENACAO`, `FRASE_HISTORICO_VAZIO`
- `lib/encomendas/consultas.ts` — `listarEncomendasDoIndice(hoje)` com a janela de 12 meses
- `app/(app)/encomendas/page.tsx` — `hoje` calculado antes da consulta, todas as encomendas
  (ativas + histórico) ganham cronograma/situação, `itens` mapeados para a busca

## Decisions Made

Ver `key-decisions` no frontmatter — a fórmula de `compararPorUrgencia`, a regra de
`resumoDeItens` (1 item = só a descrição, >1 = "primeira · +N"), o título/corpo do estado vazio
do histórico, e o reaproveitamento de `hojeEmBrasilia` para converter `atualizadoEm` (não só
"agora") no dia civil de Brasília para "cancelada em {data}".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Comentários com a própria substring proibida quebravam os greps de aceite**
- **Found during:** Tarefa 1 (`filtros.ts`) e Tarefa 3 (`consultas.ts`, `linha-historico.tsx`)
- **Issue:** Mesma armadilha já documentada em 03-04-SUMMARY.md — comentários que EXPLICAM a
  proibição continham a própria palavra proibida: "nunca `unaccent()`" em `filtros.ts` (o critério
  exige `grep -ci 'unaccent...' ` = 0), "nunca `current_date`" em `consultas.ts` (exige `grep -c
  'current_date'` = 0) e "nunca `--color-erro`" em `linha-historico.tsx` (exige `grep -c
  'color-erro...'` = 0).
- **Fix:** Reescritos sem a substring literal, preservando o aviso (ex.: "nunca a função de
  índice funcional do banco documentada em..." em vez de citar `unaccent()` por extenso).
- **Files modified:** `lib/encomendas/filtros.ts`, `lib/encomendas/consultas.ts`,
  `components/amassa/encomendas/linha-historico.tsx`
- **Verification:** os três greps de aceite confirmados em 0 depois da correção
- **Committed in:** `7af5b85`, `4cb7c37`

**2. [Rule 1 — Bug] `use-mobile` como substring literal no próprio comentário explicativo de
`filtro-encomendas.tsx`**
- **Found during:** Tarefa 2, checagem do critério de aceite `grep -c 'use-mobile'`
- **Issue:** Mesma classe do item acima — o comentário que explica para nunca usar o hook de
  detecção de largura de tela continha a própria substring proibida.
- **Fix:** Reescrito sem a substring literal.
- **Files modified:** `components/amassa/encomendas/filtro-encomendas.tsx`
- **Committed in:** `a5565ee`

**3. [Rule 1 — Bug, achado por teste real] Clique num botão da trilha logo após a navegação podia
chegar antes da hidratação do React anexar o `onClick`**
- **Found during:** Tarefa 3, `npm run test:e2e -- --grep "histórico de encomendas"` no projeto
  `celular`
- **Issue:** `abrirDetalhe()` navegava para `/encomendas/{id}` e o teste clicava em "Marcar como
  concluída"/"Cancelar encomenda" na sequência seguinte. `page.goto()` só espera o evento `load`;
  sob os dois workers do Playwright disputando CPU, o clique por vezes chegava antes do React
  terminar de anexar o listener. O Playwright via o botão visível e estável (checagem de DOM/CSS)
  e clicava — mas nada acontecia, sem erro nenhum reportado (o botão continuava lá, a encomenda
  continuava `em_producao`). Descoberto por leitura do `page snapshot` do teste falho, não por
  suposição: mostrava a encomenda ainda "ATRASADA"/com o botão "Marcar como concluída" intacto
  depois do "clique".
- **Fix:** `abrirDetalhe()` passou a esperar `page.waitForLoadState("networkidle")` depois da
  navegação; `concluirViaDetalhe`/`cancelarViaDetalhe` passaram a confirmar sucesso pelo texto
  real da página ("Concluída em"/"Cancelada" no `body`, o mesmo critério mais forte que
  `encomendas-detalhe.spec.ts` já usa) em vez de "o botão sumiu" (um diálogo aberto por cima
  também tira um botão da árvore de acessibilidade via `aria-hidden`, o que seria um falso
  positivo), com um segundo clique de tentativa se a primeira reação não vier em poucos segundos.
- **Files modified:** `tests/e2e/encomendas-filtros.spec.ts`
- **Verification:** `npm run test:e2e -- --grep "histórico de encomendas"` — 9/9 (1 skip
  esperado) nos dois projetos, repetido para confirmar
- **Committed in:** `4cb7c37`

**4. [Rule 1 — Bug em teste] O primeiro teste do describe "histórico de encomendas" competia com
o projeto irmão pelo total GLOBAL de encomendas concluídas**
- **Found during:** Tarefa 3, `npm run test:e2e -- --grep "histórico de encomendas"`
- **Issue:** `test.describe.configure({ mode: "serial" })` só serializa DENTRO de um projeto —
  desktop e celular rodam o describe inteiro em paralelo, sobre o MESMO banco de teste. O teste
  "sem nenhuma encomenda concluída/cancelada, o filtro mostra o estado vazio" depende do total
  GLOBAL de `concluida` estar em zero; um teste mais adiante do projeto irmão (que conclui uma
  encomenda de verdade) podia terminar antes, tornando a contagem positiva e o teste flakey.
- **Fix:** Esse teste específico passou a rodar só no projeto `desktop` (`test.skip` no
  `celular`) — a condição fica garantida pela ORDEM DE DECLARAÇÃO (primeiro teste do describe)
  sem depender de quão rápido o projeto irmão avança. O segundo teste (13 meses) parou de
  depender do total global — passou a verificar só a AUSÊNCIA da própria encomenda, robusta
  independente do que outros testes concorrentes façam.
- **Files modified:** `tests/e2e/encomendas-filtros.spec.ts`
- **Verification:** `npm run test:e2e -- --grep "histórico de encomendas"` — 9/9 (1 skip
  esperado) nos dois projetos
- **Committed in:** `4cb7c37`

**5. [Rule 1 — Bug em teste] `Select` escolhido dentro do `Sheet` do celular não fechava a folha
sozinho, bloqueando cliques seguintes**
- **Found during:** Tarefa 3, `npm run test:e2e -- --grep "histórico de encomendas"` no projeto
  `celular`
- **Issue:** Escolher uma opção do `Select` de status fecha o próprio `Select`, mas não o `Sheet`
  por baixo — o overlay do `Sheet` continuava aberto e interceptando cliques em qualquer elemento
  atrás dele (ex.: clicar numa linha do histórico depois de filtrar).
- **Fix:** `selecionarOpcao()` passou a fechar o `Sheet` (tecla Escape) depois de escolher a
  opção, quando ele estava aberto.
- **Files modified:** `tests/e2e/encomendas-filtros.spec.ts`
- **Committed in:** `a5565ee`

---

**Total deviations:** 7 (4 Rule 1 — bugs no próprio e2e/teste ou em comentários, 1 delas achada
por teste real de hidratação, não por suposição; nenhuma mudança na lógica de produção além do
esperado pelo plano).
**Impact on plan:** Nenhum no comportamento entregue. Todas as correções foram descobertas e
resolvidas dentro da tarefa que as descobriu, antes do commit; o código de produção
(`filtros.ts`, `filtro-encomendas.tsx`, `lista-encomendas.tsx`, `linha-historico.tsx`,
`consultas.ts`, `page.tsx`, `estado-vazio.tsx`) corresponde ao que o plano descreveu.

## Issues Encountered

- A investigação da Deviation 3 (clique perdido por hidratação) exigiu ler o `page snapshot` do
  teste falho em detalhe (a árvore de acessibilidade completa da página no momento da falha) para
  confirmar que a encomenda continuava ativa em vez de assumir "flakiness genérica" — a mesma
  disciplina de "verificar de fora" que a Fase 1 já estabeleceu para este projeto.
- `tests/e2e/autenticacao.spec.ts:72` ("sexta tentativa") continua com o timeout intermitente
  pré-existente já documentado em `WINDOWS.md` (#3), independente deste plano — não exercitado
  nesta execução (fora do escopo dos comandos rodados).

## User Setup Required

None — nenhuma configuração de serviço externo, nenhum pacote novo.

## Known Stubs / Limitações Conhecidas

- **"Controles de filtro desabilitados enquanto o índice carrega" (E3/loading do UI-SPEC)** — não
  se aplica na arquitetura construída: `FiltroEncomendas` só monta depois que o Server Component
  já resolveu os dados; o estado "carregando" é inteiramente coberto pelo `Skeleton` de
  `loading.tsx` (plano 04), nunca simultâneo com um `FiltroEncomendas` desabilitado. Revisão de
  código confirma; sem teste automatizado dedicado por não haver estado intermediário real a
  provar (ver `coverage` D12 no frontmatter).
- **Mais antigo que 12 meses continua no banco e continua alcançável** — só não vem no
  carregamento padrão. O filtro de período explícito que consultaria o servidor para esse caso é
  o caminho de volta já registrado por D-11/03-UI-SPEC.md, e não faz parte desta fase.

## Verification Commands Actually Run

Por instrução explícita do dono para esta execução (test_scoping_directive — as três fases de UI
anteriores levaram ~4h dominadas por sweeps completos do Playwright), **rodei apenas comandos
com escopo**, nunca `npm run test:e2e` sem `--grep`. A varredura completa fica para o plano 03-08:

- `npm test` (unidade completa, 314 testes) — 3 vezes, sempre 0
- `npm run test:e2e -- --grep "filtro de encomendas"` — 0 (14 passaram, 2 skips esperados por
  projeto)
- `npm run test:e2e -- --grep "histórico de encomendas"` — 0 (9 passaram, 1 skip esperado)
- `npm run test:e2e -- --grep "casca"` — 0 (20 passaram) — regressão das quatro telas com botão
  inerte
- `npm run test:e2e -- --grep "índice de encomendas"` — 0 (21 passaram) — regressão do plano 04,
  rodado ISOLADO (o teste de "banco vazio" é documentadamente instável sob a suíte completa,
  WINDOWS.md #5 — não é sintoma deste plano)
- `npm run test:e2e -- --grep "detalhe da encomenda"` — 0 (17 passaram) — regressão do plano 05
- `npm run test:e2e -- --grep "formulário de encomenda"` — 0 (15 passaram) — regressão do plano 06
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes` — 0, várias vezes ao longo da
  execução
- `npm run build` — 0, duas vezes (uma ao fim da Tarefa 2, uma ao fim da Tarefa 3 — a autoridade
  final)

**Não rodado nesta execução:** `npm run test:e2e` sem `--grep` (a varredura completa de todos os
specs juntos). Cobertura não perdida — adiada de propósito para o plano 03-08, que já é dono da
varredura final da fase.

## Next Phase Readiness

- ENC-10 fechado — encomendas filtram por status, buscam sem acento em três campos e ordenam por
  três critérios, tudo no cliente (D-11), com o histórico (D-07) e a janela de 12 meses (o teto
  que impede D-11 de crescer sem limite) resolvidos juntos.
- `lib/encomendas/filtros.ts` está pronto para o plano 08 (impressão, ENC-14) reaproveitar se a
  folha impressa precisar do mesmo filtro/ordenação vigente na tela — a decisão de escopo próprio
  vs. herdado é do plano 08 (D-18 já registra essa pergunta em aberto).
- O padrão "e2e espera `networkidle` antes de clicar num botão que acabou de aparecer numa
  navegação nova" (Deviation 3) é reaproveitável para qualquer teste futuro desta fase ou de
  módulos futuros (Agenda, Queimas, Estoque) que naveguem e cliquem em sequência rápida.
- Nenhum bloqueio novo.

## Self-Check: PASSED

Os 5 arquivos novos (`filtros.ts`, `filtros-encomendas.test.ts`, `filtro-encomendas.tsx`,
`linha-historico.tsx`, `encomendas-filtros.spec.ts`) e os 5 arquivos modificados
(`lista-encomendas.tsx`, `estado-vazio.tsx`, `textos.ts`, `consultas.ts`, `page.tsx`) confirmados
presentes no disco; os três commits de tarefa (`7af5b85`, `a5565ee`, `4cb7c37`) confirmados em
`git log --oneline --all`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-09*
