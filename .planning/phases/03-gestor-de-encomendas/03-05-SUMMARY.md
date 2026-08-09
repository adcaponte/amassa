---
phase: 03-gestor-de-encomendas
plan: 05
subsystem: ui
tags: [nextjs-15, react-19, tailwind-v4, radix-ui, playwright, server-actions, alert-dialog]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 02)
    provides: "lib/encomendas/cronograma.ts (situacaoEm, os oito ramos de Situacao),
      formato.ts (hojeEmBrasilia, formatarDiaCurto, formatarIntervalo, formatarDiaCompleto),
      textos.ts (textoDaSituacao, ROTULO_ETAPA, SELO_*, FRASE_*) — consumidos aqui, nenhum
      recalculado"
  - phase: 03-gestor-de-encomendas (plano 03)
    provides: "lib/encomendas/acoes.ts (cancelarEncomenda, concluirEncomenda, excluirEncomenda,
      ajustarEtapaEncomenda) e consultas.ts (buscarEncomenda) — consumidos sem alterar nenhuma
      assinatura (git diff --exit-code confirma)"
  - phase: 03-gestor-de-encomendas (plano 04)
    provides: "cartao-encomenda.tsx (Link para /encomendas/{id}, já existia), o padrão de
      e2e com criarEncomenda()-com-retry e nomeUnico(), e o gap documentado (Known Stubs) de que
      concluida/cancelada nunca tinham prova e2e real"
provides:
  - "app/(app)/encomendas/[id]/{page,loading,error}.tsx: a página de detalhe (D-01), com
    exigirUsuario() + notFound() para id inexistente"
  - "components/amassa/encomendas/trilha-etapas.tsx: trilha vertical das 6 etapas (D-04),
    Client Component com o estado do rodapé (duração total/data de conclusão) e 'Marcar como
    concluída'"
  - "components/amassa/encomendas/ajuste-rapido-etapa.tsx: segundo caminho de escrita de D-15 —
    -/+ numa etapa de intervalo, Switch num marco, nunca otimista"
  - "components/amassa/encomendas/acoes-encomenda.tsx + confirmar-cancelar.tsx +
    confirmar-excluir.tsx: a hierarquia visual de D-08 (cancelar à vista, excluir um passo mais
    fundo) e os dois textos de confirmação de UI-08/D-09"
affects: [03-06, 03-07, 03-08]

# Actuals (#2632)
actuals:
  tokens: 17000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Alvo de toque 44×44px com desenho visual menor via inline `style` (não classe Tailwind) —
      o Switch do shadcn tem `data-[size=default]:h-[18.4px]` embutido, um seletor de atributo
      que vence qualquer classe solta (`h-11`) por especificidade CSS; só `style` inline supera
      isso de forma confiável. Os botões -/+ usam o mesmo `style` explícito por consistência,
      com um `<span>` interno de 32×32px carregando a borda/fundo visual"
    - "`AlertDialogAction` com `event.preventDefault()` no onClick + `open`/`onOpenChange`
      controlado pelo componente pai — é o que impede o Radix de fechar o diálogo sozinho ao
      clicar em confirmar, permitindo o estado em trânsito (botão desabilita, diálogo espera a
      resposta do servidor) que 03-UI-SPEC.md exige nos dois `alert-dialog` desta fase"
    - "Ajuste rápido não-otimista: estado local (`useState`) muda no clique (passo 1), sobe para
      o pai só no passo 4 (resposta do servidor) via callback `aoConfirmar` — o pai
      (trilha-etapas.tsx) nunca recalcula o rodapé a partir do valor otimista, só do que o
      servidor confirmou"
    - "`router.refresh()` depois de uma Server Action bem-sucedida (cancelar/concluir) para
      re-buscar o Server Component sem navegação de página inteira — mas essa segunda ida ao
      servidor pode levar mais que os 5s padrão do Playwright sob a suíte inteira em paralelo;
      asserções pós-refresh usam timeout explícito de 10s (mesma prudência já registrada em
      03-04 para `useLayoutEffect`)"

key-files:
  created:
    - app/(app)/encomendas/[id]/page.tsx
    - app/(app)/encomendas/[id]/loading.tsx
    - app/(app)/encomendas/[id]/error.tsx
    - components/amassa/encomendas/trilha-etapas.tsx
    - components/amassa/encomendas/ajuste-rapido-etapa.tsx
    - components/amassa/encomendas/acoes-encomenda.tsx
    - components/amassa/encomendas/confirmar-cancelar.tsx
    - components/amassa/encomendas/confirmar-excluir.tsx
    - tests/e2e/encomendas-detalhe.spec.ts
  modified: []

key-decisions:
  - "trilha-etapas.tsx nasceu Server Component na Tarefa 1 (só leitura) e virou Client
    Component na Tarefa 2, quando precisou de estado próprio para o rodapé — a evolução que o
    plano já esperava (o arquivo aparece nas <files> das três tarefas)"
  - "acoes-encomenda.tsx precisou de uma versão mínima (só 'Editar') já na Tarefa 1, mesmo não
    estando nas <files> daquela tarefa — page.tsx (Tarefa 1) já renderiza <AcoesEncomenda> por
    instrução literal do plano ('recebendo <AcoesEncomenda> (Tarefa 3) como children'), então
    sem o stub o build da Tarefa 1 quebraria. Rule 3 (blocking): criado o mínimo necessário,
    substituído pela versão completa na Tarefa 3 — mesmo arquivo, dois commits"
  - "Excluir bem-sucedido: toast fixo 'Encomenda excluída.' na maioria dos casos; se a contagem
    real (itensApagados, lida na transação) divergir da contagem que a tela já mostrou antes de
    confirmar, o toast acrescenta a contagem real entre parênteses — resolve a instrução do
    plano ('o toast de sucesso informa a contagem real') sem contradizer a frase literal da
    tabela de Toasts do UI-SPEC no caso comum (sem divergência)"
  - "'Marcar como concluída' desaparece quando status já é concluida/cancelada (decisão do
    executor, dentro do espaço discricionário de 03-CONTEXT.md) — evita oferecer 'concluir de
    novo' numa encomenda que já terminou; 'Editar'/'Cancelar encomenda'/'⋮' no cabeçalho
    continuam sempre visíveis independente do status, seguindo o comentário de
    `cancelarEncomenda` sobre ser idempotente por construção"
  - "Diálogo de conclusão antecipada verificado no CLIENTE, comparando o `dataDeConclusao`
    já conhecido (prop inicial ou o que o ajuste rápido confirmou por último) com `hoje` — não
    espera uma primeira resposta de `concluirEncomenda` para decidir se avisa, porque o valor
    que o servidor devolveria é sempre o mesmo que o cliente já tem (as 6 etapas não mudam só
    por clicar em concluir)"

patterns-established:
  - "Componente shadcn com dimensão fixa via classe de atributo (`data-[size=...]`) só aceita
    override de tamanho por `style` inline — vale para qualquer primitivo Radix futuro que
    precise de alvo de toque maior que o desenho visual (Switch, Slider, etc.)"
  - "Diálogo de confirmação com estado em trânsito: `open`/`onOpenChange` controlado + `enviando`
    bloqueando `onOpenChange` + `AlertDialogAction` com `preventDefault()` — o trio que impede
    fechamento prematuro em qualquer ação destrutiva/irreversível futura do projeto"

requirements-completed: [ENC-02, ENC-03, ENC-04, ENC-05, ENC-09]

coverage:
  - id: D1
    description: "/encomendas/{id} é rota real com exigirUsuario() primeiro e notFound() para
      id inexistente (D-01); a trilha mostra as seis etapas sempre, com marcador circular
      (intervalo) ou losango (marco), nome, duração e datas — fim mostrado é ultimoDia, nunca
      fimExclusivo"
    requirement: "ENC-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-detalhe.spec.ts#detalhe da encomenda (9 casos: populado, 404,
          intervalo vs marco, fim=ultimoDia, item longo, sem rolagem no celular)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Etapa com dias:0 mostra 'Desligada' e continua na trilha (nunca some); o selo
      HOJE aparece em exatamente uma linha quando hoje cai no cronograma, nenhuma quando não
      começou/atrasada/concluída/cancelada, e na fronteira exata entre duas etapas vai para a
      que COMEÇA naquele dia"
    requirement: "ENC-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-detalhe.spec.ts#detalhe da encomenda (selo HOJE, fronteira,
          não começou) + ajuste rápido#Switch de um marco liga e desliga (etapa 'Desligada' após
          desligar Entrega)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ajuste rápido (D-15/PD-02): -/+ numa etapa de intervalo, Switch num marco,
      44×44px de toque com desenho menor; NÃO otimista (muda na hora, spinner até confirmar,
      reverte com aviso se falhar, rodapé só recalcula na resposta do servidor); nunca envia
      dias absoluto, só delta/ligado; piso 0; disabled durante a gravação; sem toast de sucesso"
    requirement: "ENC-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-detalhe.spec.ts#ajuste rápido (7 casos: alvo de toque,
          aria-label de ação, rodapé pós-confirmação, disabled em voo, piso zero, switch
          liga/desliga, ausência de toast)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ENC-04: cabeçalho com Editar (terracota único)/Cancelar encomenda
      (outline)/⋮ Mais ações; Excluir encomenda só dentro do menu, nunca solto ao lado de
      Cancelar; os dois alert-dialog com o texto literal de UI-08/D-09 (singular/plural),
      botão de confirmar desabilita e o diálogo não fecha até a resposta; PD-01 (nome de 120
      caracteres sem espaço não estoura o diálogo); 'Marcar como concluída' no fim da trilha
      com aviso quando a data prevista ainda não chegou"
    requirement: "ENC-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-detalhe.spec.ts#ações da encomenda (11 casos: hierarquia do
          cabeçalho, alvo de toque do ⋮, os dois textos de confirmação, estado em trânsito,
          PD-01, concluir antecipado vs no prazo, D-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-06 (o Gantt/lista do índice só desenha rascunho/em_producao) provado com
      dado real pela primeira vez na fase — antes deste plano nenhum caminho de escrita
      alcançava concluida/cancelada"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-detalhe.spec.ts#ações da encomenda#D-06: cancelar ou concluir
          tira a encomenda do Gantt/lista do índice"
        status: pass
    human_judgment: false
  - id: D6
    description: "Caminho de FALHA dos dois alert-dialog (E8/E9): o diálogo permanece aberto
      com o texto de erro, sem fechar sozinho, quando cancelarEncomenda/excluirEncomenda
      retornam { ok: false }"
    verification: []
    human_judgment: true
    rationale: "Backstop explícito do plano (verification: backstop no must_haves) — simular
      falha de rede/servidor de forma confiável num e2e local não foi tentado nesta execução.
      Caminho implementado por leitura de código (estado `erro` + `onOpenChange` bloqueado
      enquanto `enviando`); registrado em .planning/WINDOWS.md (unrun-verify) para verificação
      manual futura."
  - id: D7
    description: "E5 'vazio' (a trilha nunca mostra uma encomenda sem item) — depende do
      formulário recusar 0 itens, que só existe de verdade no plano 06"
    verification: []
    human_judgment: true
    rationale: "Backstop explícito do plano. Sem UI de edição de itens nesta fatia, não há
      caminho para criar/editar uma encomenda com zero itens e provar que 'Salvar' é barrado;
      registrado em .planning/WINDOWS.md (unrun-verify) para quando o plano 06 existir."

duration: ~110min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 5: Página de Detalhe — Trilha Vertical, Ajuste Rápido e a Hierarquia Cancelar/Excluir/Concluir Summary

**`/encomendas/[id]` completa: trilha vertical das seis etapas com o selo HOJE calculado por
`situacaoEm`, o segundo caminho de escrita de D-15 (-/+ e `Switch` sem otimismo), e os dois
`alert-dialog` de D-08/D-09 com o estado em trânsito que impede fechamento antes da resposta do
servidor.**

## Performance

- **Duration:** ~110 min
- **Started:** 2026-08-09T16:34:32Z (aprox.)
- **Completed:** 2026-08-09T18:20:00Z (aprox.)
- **Tasks:** 3
- **Files modified:** 9 (todos novos)

## Accomplishments

- `/encomendas/{id}`: rota real, compartilhável, com `exigirUsuario()` primeiro e `notFound()`
  para um id inexistente (sobe para `app/(app)/not-found.tsx`, já existente desde a 02b)
- `trilha-etapas.tsx`: seis linhas sempre visíveis (mesmo com etapa em 0 dias — "Desligada",
  marcador só de contorno, nome em `--color-tinta-fraca`), círculo para intervalo/losango para
  marco (mesma técnica visual do Gantt), fim mostrado é `ultimoDia` (nunca `fimExclusivo`),
  selo "HOJE" e destaque de fundo na linha exata que `situacaoEm` aponta — inclusive na
  fronteira entre duas etapas
- `ajuste-rapido-etapa.tsx`: segundo caminho de escrita de D-15, comprovadamente não-otimista —
  o número muda na hora, um spinner de 16px substitui até a resposta do servidor, o rodapé de
  duração total/conclusão prevista só recalcula no passo 4. `Switch` do shadcn num marco,
  botões -/+ num intervalo, os dois com 44×44px de área de toque medida por `boundingBox()`
  (o desenho visual continua menor — 32×32 nos botões, o track normal do `Switch`)
- `acoes-encomenda.tsx` + `confirmar-cancelar.tsx` + `confirmar-excluir.tsx`: a hierarquia de
  D-08 — "Editar" (terracota único), "Cancelar encomenda" (`outline`, à vista) e "⋮ Mais ações"
  (16px de distância do grupo) com "Excluir encomenda" como único item, em `--color-erro`.
  Os dois `alert-dialog` nomeiam a consequência real (D-09/UI-08), com PD-01 (nome de 120
  caracteres sem espaço quebra em linha no título, nunca estoura) e o estado em trânsito
  (botão desabilita, diálogo não fecha até a resposta)
- "Marcar como concluída" no fim da trilha (`outline`, nunca um quarto botão do cabeçalho), com
  aviso não-destrutivo quando a data de conclusão prevista ainda não chegou
- **D-06 provado com dado real pela primeira vez na fase**: cancelar ou concluir tira a
  encomenda do Gantt/lista do índice — antes deste plano isso só tinha revisão de código
  (03-04-SUMMARY.md, Known Stubs)
- `tests/e2e/encomendas-detalhe.spec.ts`: 27 casos novos nos dois projetos (desktop/celular)

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: A rota de detalhe e a trilha vertical das seis etapas** — `3f8b5c1` (feat)
2. **Tarefa 2: Ajuste rápido — mais/menos dia no intervalo, interruptor no marco, sem
   otimismo** — `0a9879e` (feat)
3. **Tarefa 3: Editar, cancelar, concluir e excluir — a hierarquia que separa o normal do
   irreversível** — `5247369` (feat)

**Extra (oportunidade sinalizada por 03-04-SUMMARY.md):** `8df84c1` (test) — prova e2e de D-06
(cancelar/concluir tiram a encomenda do índice), possível pela primeira vez porque este plano
criou os únicos caminhos de escrita que alcançam `concluida`/`cancelada`.

_Cada tarefa seguiu "teste vermelho → implementação → teste verde" dentro de um único commit
atômico, o mesmo padrão que os planos 01-04 já registraram como decisão para esta fase — não há
commits `test(...)`/`feat(...)` separados por tarefa._

## Files Created/Modified

- `app/(app)/encomendas/[id]/page.tsx` — Server Component: `exigirUsuario()`, `buscarEncomenda`
  + `notFound()`, cronograma/situação calculados no servidor
- `app/(app)/encomendas/[id]/loading.tsx` — esqueleto no formato da trilha (6 linhas)
- `app/(app)/encomendas/[id]/error.tsx` — `EstadoErro` com "Tentar de novo" + "Voltar para
  Encomendas"
- `components/amassa/encomendas/trilha-etapas.tsx` — a trilha vertical, Client Component com
  estado do rodapé e "Marcar como concluída"
- `components/amassa/encomendas/ajuste-rapido-etapa.tsx` — `-`/`+`/`Switch` não-otimistas
- `components/amassa/encomendas/acoes-encomenda.tsx` — Editar/Cancelar/⋮ do cabeçalho
- `components/amassa/encomendas/confirmar-cancelar.tsx` — `AlertDialog` não-destrutivo
- `components/amassa/encomendas/confirmar-excluir.tsx` — `AlertDialog` destrutivo
- `tests/e2e/encomendas-detalhe.spec.ts` — 27 casos novos (detalhe, ajuste rápido, ações)

## Decisions Made

Ver `key-decisions` no frontmatter — evolução de `trilha-etapas.tsx` de Server para Client
Component entre as Tarefas 1 e 2, stub inicial de `acoes-encomenda.tsx` na Tarefa 1 (Rule 3,
necessário para o build da própria Tarefa 1 passar), a regra do toast de exclusão com contagem
divergente, "Marcar como concluída" desaparecendo em status final, e a checagem cliente-side do
aviso de conclusão antecipada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `acoes-encomenda.tsx` precisou de uma versão mínima já na Tarefa 1**
- **Found during:** Tarefa 1, ao montar `page.tsx`
- **Issue:** O `<action>` da Tarefa 1 instrui explicitamente "Cabeçalho com `CabecalhoPagina`,
  recebendo `<AcoesEncomenda>` (Tarefa 3) como `children`" — mas `acoes-encomenda.tsx` só está
  nas `<files>` da Tarefa 3. Sem o componente existir, `npm run build` (exigido pela própria
  Tarefa 1) quebraria por import inexistente.
- **Fix:** Criada uma versão mínima de `acoes-encomenda.tsx` na Tarefa 1 (só o botão "Editar",
  o único terracota da tela), substituída pela versão completa (Cancelar + menu + os dois
  diálogos) na Tarefa 3 — mesmo arquivo, dois commits, cada um buildável e verificável de forma
  independente.
- **Files modified:** `components/amassa/encomendas/acoes-encomenda.tsx`
- **Verification:** `npm run build` passa nas Tarefas 1, 2 e 3
- **Committed in:** `3f8b5c1` (Tarefa 1, versão mínima), `5247369` (Tarefa 3, versão completa)

**2. [Rule 1 — Bug] Override de tamanho do `Switch` via classe Tailwind não vencia a classe
embutida do componente**
- **Found during:** Tarefa 2, `npm run test:e2e -- --grep "ajuste rápido"`
- **Issue:** `className="h-11 w-11 ..."` no `Switch` media 32px por `boundingBox()`, não 44 — o
  componente já vem com `data-[size=default]:h-[18.4px] data-[size=default]:w-[32px]`, um
  seletor de atributo mais específico em CSS do que uma classe solta, então a classe embutida
  vencia mesmo aparecendo depois na mesclagem do `tailwind-merge`.
- **Fix:** Trocado para `style={{ width: 44, height: 44, ... }}` (inline sempre vence classe) +
  `background-clip: content-box` para o desenho visual continuar do tamanho normal dentro da
  área de toque maior.
- **Files modified:** `components/amassa/encomendas/ajuste-rapido-etapa.tsx`
- **Verification:** `boundingBox()` do `Switch` mede 44×44 nos dois projetos
- **Committed in:** `0a9879e` (Tarefa 2)

**3. [Rule 1 — Bug] Teste do PD-01 media a página inteira em vez do diálogo**
- **Found during:** Tarefa 3, `npm run test:e2e -- --grep "ações da encomenda"`
- **Issue:** O teste de nome de 120 caracteres sem espaço checava
  `document.documentElement.scrollWidth`, que estourava por causa do `<h1>` do cabeçalho da
  própria página (não quebra em linha — gap pré-existente e fora do escopo deste plano, ver
  item 4 abaixo), mascarando a verificação real do PD-01 (o diálogo).
- **Fix:** Teste reescrito para medir a caixa do próprio `AlertDialog` (`boundingBox()` +
  `scrollWidth`/`clientWidth` do elemento do diálogo), que é o que PD-01 de fato especifica.
- **Files modified:** `tests/e2e/encomendas-detalhe.spec.ts`
- **Verification:** teste passa nos dois projetos
- **Committed in:** `5247369` (Tarefa 3)

**4. [Rule 4 — Architectural, fora do escopo] `<h1>` de `cabecalho-pagina.tsx` não quebra em
linha para um nome muito comprido sem espaço**
- **Found during:** Tarefa 3, investigação da Deviation 3
- **Issue:** Um nome de encomenda de 120 caracteres colados usado como título da página de
  detalhe estoura a largura do documento inteiro (rolagem horizontal), porque `CabecalhoPagina`
  (componente compartilhado da 2b) não tem `break-words`/`overflow-wrap` no `<h1>`.
- **Decision:** Não corrigido nesta execução — `cabecalho-pagina.tsx` é componente compartilhado
  fora dos arquivos deste plano, e corrigi-lo é mudança de escopo maior (afeta toda tela que usa
  o cabeçalho). Registrado em `.planning/WINDOWS.md` (id 6) para uma fase futura de polimento.
- **Files modified:** nenhum (documentado, não corrigido)
- **Committed in:** n/a — ver `.planning/WINDOWS.md`

---

**Total deviations:** 4 (1 Rule 3 — blocking necessário para o próprio build da Tarefa 1, 2
Rule 1 — bugs de implementação/teste corrigidos dentro da tarefa que os descobriu, 1 Rule 4 —
achado arquitetural fora do escopo, registrado e não corrigido).
**Impact on plan:** Nenhum no comportamento entregue — os quatro desvios foram descobertos e
resolvidos (ou conscientemente adiados, no caso do #4) antes de qualquer commit de tarefa. O
código de produção final corresponde ao que o plano descreveu.

## Issues Encountered

- Sob a suíte `test:e2e` completa (todos os specs, dois projetos, em paralelo), uma asserção
  pós-`router.refresh()` falhou uma vez por timeout padrão de 5s (celular) — corrigida com
  timeout explícito de 10s, mesma prudência já registrada em 03-04-SUMMARY.md para asserções
  que dependem de uma segunda ida ao servidor sob carga.
- O teste novo de D-06 (índice sem a encomenda cancelada/concluída) também precisou de
  `expect.poll` reabrindo `/encomendas` a cada tentativa, em vez de uma única leitura — a
  mesma classe de instabilidade sob carga, resolvida reconfirmando com navegação nova em vez de
  aumentar só o timeout de uma leitura estática.
- `tests/e2e/autenticacao.spec.ts:72` ("sexta tentativa") e
  `tests/e2e/encomendas-indice.spec.ts` ("banco vazio", só na suíte completa sem `--grep`)
  continuam com as instabilidades pré-existentes já documentadas em `WINDOWS.md` (#3, #5) —
  confirmadas independentes deste plano (nenhum arquivo deste plano toca autenticação ou o
  índice).

## User Setup Required

None — nenhuma configuração de serviço externo, nenhum pacote novo (`alert-dialog`, `switch`,
`sonner`, `dropdown-menu` já estavam instalados desde o plano 01/UI-SPEC).

## Known Stubs / Limitações Conhecidas

- **E8/E9 (caminho de falha dos dois `alert-dialog`)** — implementado por leitura de código,
  sem prova automatizada nem verificação manual nesta execução (backstop explícito do plano).
  Registrado em `.planning/WINDOWS.md` (unrun-verify, ids 8-9).
- **E5 "vazio" (trilha sem item)** — depende do formulário de edição de itens, que só existe no
  plano 06. Registrado em `.planning/WINDOWS.md` (unrun-verify, id 7).
- **`<h1>` de `cabecalho-pagina.tsx` não quebra para nome muito comprido sem espaço** — gap
  pré-existente descoberto nesta fase, fora do escopo de arquivos deste plano. Registrado em
  `.planning/WINDOWS.md` (deviation, id 6).

## Next Phase Readiness

- `/encomendas/[id]` está completa e navegável a partir do cartão mobile do índice (o Gantt
  desktop ainda não tem um `Link` por linha — gap pré-existente de 03-04, fora do escopo deste
  plano; os testes desta fatia descobrem o `id` pelo `data-testid` do cartão, presente no DOM
  nos dois projetos por D-02, sem depender de clique visível).
- `AcoesEncomenda` já linka "Editar" para `/encomendas?editar={id}` — a URL existe, mas
  `formulario-encomenda.tsx` ainda não trata o parâmetro `editar` (isso é do plano 06, que
  também resolve o bloqueio já registrado sobre `components/ui/form.tsx`).
- As sete Server Actions da fase (plano 03) continuam sem nenhuma alteração de assinatura —
  `git diff --exit-code lib/encomendas/acoes.ts lib/encomendas/esquemas.ts` confirma.
- O padrão de diálogo com estado em trânsito (`open` controlado + `enviando` bloqueando fechar +
  `preventDefault()` no `AlertDialogAction`) fica pronto para qualquer ação destrutiva futura do
  projeto (Agenda, Queimas, Estoque).

## Self-Check: PASSED

Os 9 arquivos (3 de rota, 5 de componente, 1 de teste e2e) confirmados presentes no disco; os
quatro commits (`3f8b5c1`, `0a9879e`, `5247369`, `8df84c1`) confirmados em
`git log --oneline --all`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-09*
