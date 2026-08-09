---
phase: 03-gestor-de-encomendas
plan: 06
subsystem: ui
tags: [nextjs-15, react-19, react-hook-form, zod, radix-ui, playwright, tailwind-v4]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 01)
    provides: "esquemaEncomenda/esquemaItem/esquemaEtapas (lib/encomendas/esquemas.ts),
      criarEncomenda (lib/encomendas/acoes.ts), o contrato de URL `?nova` (D-03), o formulário
      mínimo Server Component que este plano substitui inteiramente"
  - phase: 03-gestor-de-encomendas (plano 02)
    provides: "lib/encomendas/cronograma.ts (calcularCronograma — a MESMA função que o rodapé ao
      vivo chama), formato.ts (formatarDiaCurto), textos.ts (ROTULO_ETAPA, FRASE_FALHA_AO_SALVAR)"
  - phase: 03-gestor-de-encomendas (plano 03)
    provides: "atualizarEncomenda, reordenarItemEncomenda (lib/encomendas/acoes.ts) — consumidos
      sem alterar assinatura"
  - phase: 03-gestor-de-encomendas (plano 04)
    provides: "lista-encomendas.tsx (casca cliente do índice, D-02), CartaoEncomenda com href
      real por encomenda — usado pelos testes deste plano para navegar independente do viewport"
  - phase: 03-gestor-de-encomendas (plano 05)
    provides: "acoes-encomenda.tsx com o link 'Editar' para `/encomendas?editar={id}` — o
      destino que este plano finalmente implementa"
provides:
  - "components/amassa/encomendas/formulario-encomenda.tsx: Client Component com
    react-hook-form + zodResolver, um único Dialog (Radix) com conteúdo responsivo por CSS
    (modal centralizado no desktop, folha de baixo no celular), abertura derivada de
    `?nova`/`?editar={id}`"
  - "components/amassa/encomendas/lista-itens.tsx: useFieldArray com linha em branco inicial,
    última linha não removível, setas de 44px (D-16), reordenação local na criação e persistida
    na edição"
  - "components/amassa/encomendas/rodape-formulario.tsx: duração total/conclusão prevista
    recalculando a cada tecla via a MESMA `calcularCronograma` do servidor (D-15/D-17/ENC-11)"
  - "lib/encomendas/acoes.ts: criarEncomenda migrado para o formato de objeto tipado das outras
    seis ações (D-15 estruturado) — não usa mais FormData/useActionState"
  - "components/ui/field.tsx: Field/FieldLabel/FieldError instalados do registro shadcn"
affects: [03-07, 03-08]

# Actuals (#2632)
actuals:
  tokens: 22400
  tasks: 3
  commits: 3

tech-stack:
  added: ["react-hook-form@7.85.0", "@hookform/resolvers@5.7.1"]
  patterns:
    - "Um único Radix Dialog com DialogContent responsivo por classe Tailwind (mobile-first:
      folha de baixo; `md:`: modal centralizado) em vez de dois Root (Dialog + Sheet) montados
      simultaneamente — a técnica 'hidden md:contents' de D-02 (Gantt/lista) NÃO funciona para
      componentes que usam Portal do Radix, porque o Portal escapa de qualquer `hidden` de um
      ancestral e, com dois modais abertos ao mesmo tempo, o próprio Radix marca ambos
      aria-hidden. Vale para qualquer par Dialog/Sheet responsivo futuro do projeto."
    - "Zod local ao componente reaproveitando pedaços do esquema do servidor via `.shape` e
      `.extend()` (não uma cópia) para o `zodResolver` do react-hook-form — `idDoBanco` como
      nome do campo de reconciliação de item (não `id`) para não colidir com a chave `id` que
      `useFieldArray` reserva para si mesmo em cada linha."
    - "`useWatch` (não os `fields` de `useFieldArray`) para qualquer valor que precise refletir
      o que foi DIGITADO nesta renderização — `fields` só carrega o valor de quando a linha
      nasceu (append/move), nunca atualiza por tecla em campos registrados via `register()`."

key-files:
  created:
    - components/amassa/encomendas/lista-itens.tsx
    - components/amassa/encomendas/rodape-formulario.tsx
    - components/ui/field.tsx
    - tests/e2e/encomendas-formulario.spec.ts
  modified:
    - components/amassa/encomendas/formulario-encomenda.tsx
    - components/amassa/encomendas/lista-encomendas.tsx
    - app/(app)/encomendas/page.tsx
    - lib/encomendas/acoes.ts
    - tests/e2e/encomendas.spec.ts
    - tests/e2e/encomendas-indice.spec.ts
    - tests/e2e/encomendas-detalhe.spec.ts
    - package.json
    - package-lock.json
  deleted:
    - components/amassa/encomendas/botao-salvar-encomenda.tsx

key-decisions:
  - "Branch (b) do form_component_decision tomada: `field` do shadcn foi instalado e USADO
    (Field/FieldLabel/FieldError, composição de rótulo+erro), mas não tinha integração própria
    com react-hook-form (confirmado lendo o registro antes de instalar) — react-hook-form +
    @hookform/resolvers/zod entraram como a máquina real, wireados à mão dentro de
    components/amassa/, nunca em components/ui/ (D-11 de 02b-CONTEXT)"
  - "criarEncomenda mudou de (estadoAnterior, FormData) para (entradaBruta: unknown) — o mesmo
    formato das outras seis ações. O formulário agora chama a action direto de um `onSubmit`
    (não `<form action>`), então o par useActionState deixou de fazer falta; `redirect()` do
    servidor virou `router.push` no cliente, compatível com fechar o Dialog"
  - "Um único Radix Dialog, não Dialog+Sheet simultâneos — ver tech-stack/patterns acima e a
    seção Deviations abaixo para o porquê (achado por teste real, não suposição)"
  - "Rótulos de item passam a ser indexados ('Descrição do item 1', não mais 'Descrição do
    item' sem número) — necessário para múltiplos itens terem nomes acessíveis únicos;
    documentado como ajuste nos três specs pré-existentes que dependiam do rótulo antigo"

patterns-established:
  - "Dialog único com conteúdo responsivo por CSS — o padrão a repetir para qualquer par
    Dialog/Sheet futuro do projeto, em vez de dois Root simultâneos"
  - "useWatch para valores ao vivo dentro de uma lista de useFieldArray"

requirements-completed: [ENC-01, ENC-02, ENC-03, ENC-04, ENC-05, ENC-11]

coverage:
  - id: D1
    description: "O formulário abre como Dialog centralizado no desktop e como folha de baixo
      ocupando a tela toda no celular, com endereço próprio na URL (?nova / ?editar={id}),
      fecha removendo o parâmetro, reabre ao recarregar, e no celular o botão voltar do sistema
      fecha o formulário sem sair da tela"
    requirement: "ENC-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#formulário de encomenda — contêiner, URL
          e estados (8 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Falha ao salvar mostra banner inline (role=alert) mantendo o formulário
      aberto e o que foi digitado; todo campo tem font-size >=16px e altura >=44px; navegação
      só por teclado do campo nome até Salvar passa pelos campos em ordem lógica"
    requirement: "ENC-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#falha ao salvar... / #todo campo tem
          font-size... / #navegar só pelo teclado..."
        status: pass
    human_judgment: false
  - id: D3
    description: "A lista de itens nasce com uma linha em branco ao criar; a última linha não
      pode ser removida (botão disabled); 'Adicionar item' foca a descrição da nova linha;
      setas de reordenar de 44x44px, desabilitadas nas pontas mas nunca escondidas, com
      aria-label descrevendo o item ou a posição quando a descrição está vazia"
    requirement: "ENC-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#itens da encomenda — linha em branco,
          setas de 44px e a última linha que não sai (7 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reordenar na criação muda só o array local, e a ordem correta chega ao banco
      no criarEncomenda; na edição, um item já persistido chama reordenarItemEncomenda na hora
      e a nova ordem sobrevive a um recarregamento de verdade"
    requirement: "ENC-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#reordenar na criação... / #na edição,
          reordenar grava na hora..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Descrição de item com 201 caracteres é barrada pelo Zod no envio, com
      mensagem visível, sem gravar"
    requirement: "ENC-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#uma descrição de 201 caracteres..."
        status: pass
    human_judgment: false
  - id: D6
    description: "producao/secagem/esmaltacao têm campo numérico; queima1/queima2/entrega têm
      Switch — nunca um campo numérico num marco, decidido por ETAPAS_MARCO, não por lista
      escrita à mão"
    requirement: "ENC-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#as etapas de marco... têm Switch, nunca
          campo numérico"
        status: pass
    human_judgment: false
  - id: D7
    description: "O rodapé recalcula duração total e conclusão prevista a cada tecla (sem
      clique), reage ao Switch de marco, mostra 'Duração total: 0 dias' e um traço quando as
      seis etapas estão em 0, e os números usam papel mono com tabular-nums"
    requirement: "ENC-11"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#rodapé do formulário — duração total e
          conclusão prevista ao vivo (5 casos)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Editar preenche o formulário com nome/cliente/itens/etapas da encomenda
      buscada no servidor (buscarEncomenda), a partir do link 'Editar' da página de detalhe"
    requirement: "ENC-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-formulario.spec.ts#editar={id} abre o formulário com os
          campos preenchidos daquela encomenda"
        status: pass
    human_judgment: false
  - id: D9
    description: "T-03-38 (dois cliques rápidos na mesma seta de reordenar não gravam fora de
      ordem): o par de setas do item pendente fica disabled com opacidade reduzida até a
      resposta do servidor, implementado por leitura de código; sem teste automatizado de
      corrida de rede real nesta execução"
    verification: []
    human_judgment: true
    rationale: "Backstop explícito do must_haves do plano. Simular duas requisições
      verdadeiramente concorrentes de forma confiável num e2e local não foi tentado nesta
      execução; registrado em .planning/WINDOWS.md (unrun-verify) para verificação manual ou
      teste de integração dedicado futuro."

duration: ~100min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 6: Formulário de Encomenda — Dialog Responsivo, Itens Reordenáveis e Rodapé ao Vivo Summary

**`formulario-encomenda.tsx` reescrito como Client Component (`react-hook-form` + `zodResolver`),
com um único `Dialog` do Radix cujo conteúdo responde a `md:` (achado real: dois `Root` de
Dialog/Sheet abertos ao mesmo tempo quebram a árvore de acessibilidade inteira via `aria-hidden`
espúrio do próprio Radix), itens reordenáveis por setas de 44px e o rodapé que chama a MESMA
`calcularCronograma` do servidor a cada tecla.**

## Performance

- **Duration:** ~100 min
- **Started:** 2026-08-09T17:41:00Z (aprox., logo após 03-05)
- **Completed:** 2026-08-09T18:54:00Z
- **Tasks:** 3 (contêiner/URL, itens/reordenação, etapas/rodapé)
- **Files modified:** 14 (4 novos, 9 modificados, 1 removido)

## Accomplishments

- `formulario-encomenda.tsx` deixou de ser o `<section>` mínimo do plano 01 e passou a ser o
  formulário completo: `react-hook-form` + `zodResolver(esquemaFormulario)` reaproveitando
  `esquemaEncomenda`/`esquemaItem`/`esquemaEtapas` do servidor via `.shape`/`.extend()` (D-15) —
  validação de cliente é conveniência, a do servidor (inalterada) é a que vale
- Um único `Dialog` (Radix) com `DialogContent` respondendo por classe Tailwind: folha ocupando a
  tela toda vindo de baixo no celular, modal centralizado a partir de `md:` — sem nenhuma
  detecção de dispositivo por JavaScript. A leitura literal do plano (`Dialog` e `Sheet`
  montados ao mesmo tempo, cada um escondido por `hidden`/`md:hidden`) foi tentada primeiro,
  testada com Playwright real, e **provou-se quebrada**: o `Portal` do Radix escapa de qualquer
  `hidden` ancestral (ambos os elementos ficavam fora da árvore de acessibilidade, `aria-hidden`
  em ambos), o que apagava o formulário inteiro nos dois tamanhos de tela. Corrigido para um
  único `Root`, documentado em detalhe no comentário do componente
- `lista-itens.tsx`: `useFieldArray`, uma linha em branco ao criar, última linha não removível,
  setas de reordenar de 44×44px nunca escondidas (D-16). Reordenar na criação é só o array
  local; na edição, um item já persistido chama `reordenarItemEncomenda` na hora, revertendo com
  `toast.error` se falhar — mesmo padrão do ajuste rápido do plano 05
- `rodape-formulario.tsx`: `useWatch` + a MESMA `calcularCronograma` do servidor, recalculando a
  cada tecla sem ida à rede (ENC-11/concurrency) e sempre derivado do estado atual, nunca
  acumulado (ENC-11/idempotency)
- As 6 etapas do formulário decidem número vs. `Switch` a partir de `ETAPAS_MARCO` (nunca uma
  lista escrita à mão) — um campo numérico num marco contrariaria ENC-03 pela fonte
- `criarEncomenda` migrado de `(estadoAnterior, FormData)` para `(entradaBruta: unknown)`, o
  mesmo formato das outras seis ações — o formulário chama a ação direto de um `onSubmit`,
  `useActionState` deixou de fazer falta
- `react-hook-form@7.85.0`/`@hookform/resolvers@5.7.1` instalados — pacotes já aprovados no
  portão da Tarefa 1 do plano 01, nunca consumidos até agora porque `form.tsx` do shadcn não
  instala nada nesta versão; `field.tsx` instalado e usado para composição de rótulo/erro
- `tests/e2e/encomendas-formulario.spec.ts`: 21 casos novos nos três grupos do plano, todos
  passando nos dois projetos; os três specs pré-existentes que interagiam com o formulário
  antigo (`encomendas.spec.ts`, `encomendas-indice.spec.ts`, `encomendas-detalhe.spec.ts`)
  ajustados e confirmados sem regressão

## Task Commits

Each task was committed atomically, agrupado por natureza da mudança (produção → correção de
regressão em teste pré-existente → teste novo) em vez de por número de tarefa, porque as três
tarefas do plano produzem um único componente interdependente (a Tarefa 1 cria
`formulario-encomenda.tsx`, que já importa `ListaItens`/`RodapeFormulario` das Tarefas 2/3 —
splitar por tarefa quebraria a árvore de import em cada commit intermediário):

1. **feat(03-06): formulário completo — Dialog responsivo, itens reordenáveis, rodapé ao vivo**
   — `0e9780f`
2. **fix(03-06): ajusta e2e pré-existentes ao novo formulário** — `770d732`
3. **test(03-06): e2e do formulário — contêiner, itens reordenáveis e rodapé ao vivo** —
   `d66c4a1`

## Files Created/Modified

- `components/amassa/encomendas/formulario-encomenda.tsx` — reescrito: Client Component,
  `Dialog` único responsivo, `CorpoDoFormulario`, campos das 6 etapas
- `components/amassa/encomendas/lista-itens.tsx` — novo: itens reordenáveis
- `components/amassa/encomendas/rodape-formulario.tsx` — novo: duração total/conclusão prevista
  ao vivo
- `components/ui/field.tsx` — novo: instalado do shadcn (`Field`/`FieldLabel`/`FieldError`)
- `components/amassa/encomendas/lista-encomendas.tsx` — comentário atualizado (o formulário NÃO
  é montado aqui — ver decisão abaixo)
- `components/amassa/encomendas/botao-salvar-encomenda.tsx` — removido (pending state agora vem
  de `formState.isSubmitting`)
- `app/(app)/encomendas/page.tsx` — busca `buscarEncomenda(editar)` no servidor, monta
  `FormularioEncomenda` uma única vez fora do condicional vazio/populado
- `lib/encomendas/acoes.ts` — `criarEncomenda` migrado para objeto tipado
- `tests/e2e/encomendas-formulario.spec.ts` — novo, 21 casos
- `tests/e2e/encomendas.spec.ts`, `encomendas-indice.spec.ts`, `encomendas-detalhe.spec.ts` —
  helpers ajustados ao contêiner dual-render e aos rótulos indexados de item
- `package.json`/`package-lock.json` — `react-hook-form@7.85.0`, `@hookform/resolvers@5.7.1`

## Decisions Made

Ver `key-decisions` no frontmatter. Duas merecem destaque:

**1. `FormularioEncomenda` montado em `page.tsx`, não em `lista-encomendas.tsx` (correção sobre
a instrução literal do plano).** O plano pedia "monte `<FormularioEncomenda>` uma única vez,
fora das duas metades, dentro de `lista-encomendas.tsx`" — mas `lista-encomendas.tsx` só é
renderizado quando existe ao menos uma encomenda (`page.tsx` troca por `EstadoVazio` quando a
lista está vazia). Isso quebraria `?nova` na PRIMEIRA encomenda do ateliê (E1/E4 `empty` do
UI-SPEC exige que o botão do estado vazio funcione). Corrigido montando `FormularioEncomenda`
direto em `page.tsx`, fora do condicional vazio/populado — Rule 2 (funcionalidade crítica
ausente), descoberto antes de qualquer commit.

**2. Um único `Dialog`, não `Dialog`+`Sheet` simultâneos (correção sobre a instrução literal do
plano, provada por teste real).** Ver a seção Deviations abaixo para o relato completo — a
correção é mais simples e mais correta que a instrução original: mesma aparência dos dois
contratos de D-03, um só `Root`/`FocusScope` do Radix, zero problema de acessibilidade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `FormularioEncomenda` não pode viver só em `lista-encomendas.tsx`**
- **Found during:** Tarefa 1, revisão da instrução de montagem antes de escrever `page.tsx`
- **Issue:** `lista-encomendas.tsx` só renderiza quando `encomendasDoIndice.length > 0` —
  montar o formulário só ali deixaria `/encomendas?nova` sem formulário nenhum na primeira
  encomenda do ateliê (banco vazio → `EstadoVazio`, nunca `ListaEncomendas`).
- **Fix:** `FormularioEncomenda` montado direto em `app/(app)/encomendas/page.tsx`, fora do
  condicional vazio/populado; `lista-encomendas.tsx` só ganhou um comentário explicando por
  quê o componente não vive ali.
- **Files modified:** `app/(app)/encomendas/page.tsx`, `components/amassa/encomendas/lista-encomendas.tsx`
- **Verification:** `npm run test:e2e -- --grep "recarregar /encomendas?nova reabre"` e o
  caso do estado vazio de `encomendas-indice.spec.ts` continuam passando
- **Committed in:** `0e9780f`

**2. [Rule 1 — Bug, achado por teste real] Dois `Root` de Dialog/Sheet simultâneos quebram a
árvore de acessibilidade inteira**
- **Found during:** Tarefa 1, `npm run test:e2e -- --grep "abre como Dialog"` (a primeira
  versão real do componente, seguindo a instrução literal do plano)
- **Issue:** A leitura literal de "renderize `Dialog` dentro de `hidden md:contents` e `Sheet`
  dentro de `md:hidden contents`" monta os DOIS `Root` do Radix com `open={aberto}`
  simultaneamente quando o formulário está aberto. Provado com `document.querySelectorAll` no
  navegador real: os dois `Portal` anexam o conteúdo em `document.body`, então a classe `hidden`
  do wrapper ancestral NUNCA os esconde (o portal escapa da árvore local) — e com dois modais
  abertos ao mesmo tempo, o próprio Radix marca AMBOS `aria-hidden="true"` (o mecanismo de
  camadas que normalmente esconde o conteúdo de TRÁS de um diálogo passou a esconder os dois
  diálogos um do outro). Resultado: `getByRole('dialog')` não encontrava nada em nenhum dos dois
  tamanhos de tela — o formulário inteiro tinha sumido da árvore de acessibilidade, uma quebra
  bem mais séria do que a que a proibição de `hooks/use-mobile.ts` evita.
- **Fix:** Um único `Dialog`, com a classe do `DialogContent` respondendo ao breakpoint
  (mobile-first: folha de baixo, tela toda; `md:`: modal centralizado, `max-w-2xl`) — mesma
  aparência dos dois contratos de D-03, um só `Root`, um só `FocusScope`, zero `aria-hidden`
  espúrio. Medido de verdade: `boundingBox()` do diálogo no projeto `desktop` dá `672×612` a
  `x=304` (centralizado); no `celular`, `412×839` (tela cheia).
- **Files modified:** `components/amassa/encomendas/formulario-encomenda.tsx`
- **Verification:** `npm run test:e2e -- --grep "formulário de encomenda"` — 15/16 (1 skip
  esperado) nos dois projetos
- **Committed in:** `0e9780f`

**3. [Rule 1 — Bug] `text-corpo` perdia para o `md:text-sm` embutido do `Input`**
- **Found during:** Tarefa 1, `npm run test:e2e -- --grep "font-size"`
- **Issue:** `components/ui/input.tsx` tem `md:text-sm` (14px) no próprio componente. Como
  `text-corpo` (16px, sem prefixo de variante) não conflita — para o `tailwind-merge` — com uma
  classe `md:`-prefixada, os dois sobreviviam à mesclagem, e `md:text-sm` vencia no desktop por
  aparecer depois no CSS gerado. O campo media 16px no celular e 14px no desktop.
- **Fix:** `CLASSE_DO_CAMPO` (e as duas ocorrências equivalentes em `lista-itens.tsx`) passou a
  incluir `md:text-corpo` explicitamente, no mesmo escopo de variante do conflito.
- **Files modified:** `components/amassa/encomendas/formulario-encomenda.tsx`,
  `components/amassa/encomendas/lista-itens.tsx`
- **Verification:** `getComputedStyle(...).fontSize` mede >=16px nos dois projetos
- **Committed in:** `0e9780f`

**4. [Rule 1 — Bug] `descricaoAtual` das setas de reordenar usava valor desatualizado**
- **Found during:** Tarefa 2, `npm run test:e2e -- --grep "reordenar na criação"`
- **Issue:** `fields` (de `useFieldArray`) só reflete o valor de quando a linha nasceu
  (`append`/`move`), nunca o que foi digitado depois — os campos são registrados via
  `register()` (não controlados). O `aria-label` "Mover {descrição} para cima" ficava sempre
  com a descrição em branco do momento do `append`, mesmo depois de a pessoa digitar.
- **Fix:** Trocado para `useWatch({control, name: "itens"})`, que reflete o valor ao vivo.
- **Files modified:** `components/amassa/encomendas/lista-itens.tsx`
- **Verification:** o teste de reordenar por `aria-label` com a descrição digitada passa
- **Committed in:** `0e9780f`

**5. [Rule 1 — Bug] `botao-salvar-encomenda.tsx` órfão**
- **Found during:** Tarefa 1, ao reescrever o formulário como Client Component
- **Issue:** O componente existia só para dar `useFormStatus` a um `<form action>` — o novo
  formulário não usa mais `<form action>` (chama a Server Action direto de um `onSubmit`), então
  o arquivo ficaria morto (nunca importado).
- **Fix:** Removido. O estado de "salvando" agora vem de `formState.isSubmitting` do
  `react-hook-form`, no mesmo botão "Salvar".
- **Files modified:** `components/amassa/encomendas/botao-salvar-encomenda.tsx` (removido)
- **Verification:** `npm run build` sai com 0, nenhum import quebrado
- **Committed in:** `0e9780f`

**6. [Rule 1 — Bug em teste] `getByLabel` sem `exact` colidia com `aria-label` do Gantt/cartão**
- **Found during:** `npm run test:e2e` completo (sem `--grep`), depois de passar isolado
- **Issue:** Os rótulos de etapa do formulário ("Produção", "Secagem") são SUBSTRING de
  `aria-label`s que já existem no Gantt/cartão para cada barra/segmento ("Produção — 3 dias").
  Sob a suíte completa, com outras encomendas já no banco (criadas por specs em paralelo),
  `getByLabel(rotulo)` sem `exact: true` resolvia para dezenas de elementos — violação de modo
  estrito do Playwright.
- **Fix:** `campoVisivel` (helper do novo spec) passou a usar `{ exact: true }` por padrão.
- **Files modified:** `tests/e2e/encomendas-formulario.spec.ts`
- **Verification:** `npm run test:e2e` completo — os únicos 4 casos restantes são os dois flakes
  pré-existentes já documentados (WINDOWS.md #3 e #5), confirmados independentes deste plano
- **Committed in:** `d66c4a1`

---

**Total deviations:** 6 (5 Rule 1 — bugs descobertos e corrigidos antes de qualquer commit ou
dentro do commit que os descobriu, 1 delas achada por teste real de acessibilidade, não por
suposição).
**Impact on plan:** A correção #2 (Dialog único) é uma mudança de arquitetura sobre o texto
literal do plano, mas produz exatamente o mesmo contrato visual/funcional de D-03 (Dialog
centralizado no desktop, folha de baixo tela cheia no celular) com uma implementação
estritamente mais correta (sem o `aria-hidden` espúrio descoberto por teste). Nenhuma das seis
correções mudou o comportamento que o usuário final vê — só a implementação por baixo.

## Issues Encountered

- A investigação da deviation #2 exigiu instrumentação temporária (`document.querySelectorAll`
  com um spec de debug descartável, capturando `aria-hidden`/`display`/`className` computados) —
  a única forma de confirmar a causa raiz em vez de adivinhar. O spec de debug foi apagado antes
  do commit final.
- `tests/e2e/autenticacao.spec.ts:72` (sexta tentativa) e
  `tests/e2e/encomendas-indice.spec.ts:171` (banco vazio, só na suíte completa sem `--grep`)
  continuam com as instabilidades pré-existentes já documentadas em `WINDOWS.md` (#3, #5) —
  confirmadas independentes deste plano (nenhum arquivo deste plano toca autenticação; o banco
  vazio some por causa de OUTRO spec criando dado em paralelo, comportamento de suíte, não do
  `EstadoVazio`).

## User Setup Required

None — `react-hook-form`/`@hookform/resolvers` são pacotes npm comuns, já aprovados no portão de
legitimidade da Tarefa 1 do plano 01 (registrados como dependência esperada do bloco `form` do
shadcn, nunca consumidos até este plano por `form.tsx` não instalar nada nesta versão do
registro). Nenhuma variável de ambiente nova, nenhum serviço externo.

## Known Stubs / Limitações Conhecidas

- **T-03-38 (dois cliques rápidos na mesma seta não gravam fora de ordem)** — implementado
  (par de setas `disabled` com opacidade reduzida enquanto pendente), sem prova automatizada de
  corrida de rede real nesta execução (backstop explícito do plano). Registrado em
  `.planning/WINDOWS.md` (unrun-verify, novo id).
- **`components/amassa/encomendas/gantt.tsx` ainda não tem um `Link` por linha** — gap
  pré-existente de 03-04/03-05, confirmado de novo aqui: os testes de edição/reordenação deste
  plano precisaram extrair o `href` do cartão mobile (sempre no DOM por D-02) em vez de clicar
  numa linha do Gantt no projeto `desktop`. Fora do escopo de arquivos deste plano; registrado em
  `deferred-items.md`.

## Next Phase Readiness

- O formulário completo fecha o bloqueio que os planos 01–05 vinham carregando
  (`deferred-items.md`/`WINDOWS.md` #4, agora `fixed`) — `field.tsx` + `react-hook-form` direto
  provou-se a composição certa, sem precisar de um `form.tsx` que o registro shadcn não serve.
- `criarEncomenda`/`atualizarEncomenda`/`reordenarItemEncomenda` seguem sem alteração de
  assinatura própria (só `criarEncomenda` mudou, de `FormData` para objeto tipado) — os planos
  07/08 podem chamá-las sem reescrever nada.
- O padrão "Dialog único com conteúdo responsivo por CSS" fica pronto para qualquer par
  Dialog/Sheet futuro do projeto (Agenda, Queimas, Estoque) — evita reencontrar o mesmo bug de
  `aria-hidden` espúrio por tentativa e erro.
- Bloqueio já registrado pelo plano 05 (E5 "vazio" — trilha sem item, dependia deste formulário
  recusar 0 itens) está **resolvido**: `esquemaEncomenda.itens.min(1)` no cliente e no servidor,
  mais a última linha não removível na UI, fecham o caminho. `WINDOWS.md` #7 marcado `fixed`.

## Self-Check: PASSED

Os 4 arquivos novos (`lista-itens.tsx`, `rodape-formulario.tsx`, `components/ui/field.tsx`,
`tests/e2e/encomendas-formulario.spec.ts`) e os 9 arquivos modificados confirmados presentes no
disco; os três commits de tarefa (`0e9780f`, `770d732`, `d66c4a1`) confirmados em
`git log --oneline --all`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-09*
