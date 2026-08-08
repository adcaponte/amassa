---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 03
type: execute
wave: 3
depends_on: ["02b-02"]
files_modified:
  - components/amassa/estado-vazio.tsx
  - components/amassa/cabecalho-pagina.tsx
  - components/amassa/cartao-painel.tsx
  - app/(app)/page.tsx
  - app/(app)/encomendas/page.tsx
  - app/(app)/agenda/page.tsx
  - app/(app)/queimas/page.tsx
  - app/(app)/estoque/page.tsx
  - app/(app)/orcamentos/page.tsx
  - tests/e2e/casca.spec.ts
  - tests/e2e/fundacao.spec.ts
  - tests/e2e/sessao.spec.ts
  - tests/e2e/autenticacao.spec.ts
autonomous: true
requirements: [UI-02, UI-04, UI-06, UI-07]
user_setup: []

estimate:
  tokens: 74000
  raw_tokens: 74000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Os 5 itens da barra inferior abrem cada um a sua tela no celular: tocar em Encomendas leva a `/encomendas`, e o item correspondente fica ativo (UI-02)"
    - "Existem as rotas `/encomendas`, `/agenda`, `/queimas`, `/estoque` e `/orcamentos`, todas exigindo sessão (UI-02, UI-04)"
    - "`/orcamentos` não aparece na navegação principal — nem na barra inferior nem no meio da barra lateral — e é alcançável só pelo menu do usuário (UI-04)"
    - "Cada tela de módulo tem título, frase de contexto e um botão principal desabilitado com nota explicativa visível ao lado (UI-07, D-01)"
    - "A tela de Encomendas mostra a frase literal 'A roda ainda não gira.' (D-05, ENC-13 antecipado)"
    - "`/orcamentos` mostra 'A calculadora ainda não existe.' e não tem botão nenhum (D-04)"
    - "O painel inicial mostra os quatro cartões nomeados — Encomendas por etapa, Aulas de hoje, Fornos em atenção, Estoque baixo — cada um com a própria frase de vazio (D-02, D-16)"
    - "Nenhuma das dez telas exige rolagem horizontal a 320px de largura: `document.documentElement.scrollWidth` nunca ultrapassa a largura do viewport (UI-06)"
    - "E4 carregando — o cabeçalho de página é conteúdo estático renderizado no servidor; não há dado a esperar"
    - "E4 erro — falha na tela é delegada ao boundary de erro do grupo, que substitui a página inteira dentro do layout"
    - "E4 transbordo — no celular o botão principal desce para a linha de baixo em vez de espremer o título"
    - "E4 texto longo — 'Encomendas', 'Agenda', 'Queimas' e 'Estoque' são constantes; o mais longo cabe em uma linha a 320px no papel display"
    - "E5 vazio — cada um dos quatro cartões do painel mostra a frase própria da tabela de estados vazios, sem botão (D-02)"
    - "E5 carregando — nesta fase nenhum cartão busca dado; o esqueleto no formato do cartão fica especificado para as fases 3 a 6"
    - "E5 erro — não há consulta por cartão que possa falhar isoladamente nesta fase; a falha é delegada ao boundary de erro"
    - "E5 transbordo — a grade é 1 coluna no celular e 2×2 no desktop, e quebra para 1 coluna antes de qualquer cartão encolher abaixo do legível (UI-06)"
    - "E5 zero-um-muitos — nesta fase o estado é sempre zero e o vazio de cada cartão está escrito; singular e plural do conteúdo pertencem à fase que fornece o dado"
    - "E5 texto longo — os quatro títulos de cartão são constantes definidas no contrato de UI"
    - "E6 carregando — `EstadoVazio` é componente puro sem dado e sem efeito; nunca tem estado intermediário"
    - "E6 erro — `EstadoVazio` não busca nada e não pode falhar"
    - "E6 transbordo — centralizado com largura máxima de leitura; o texto quebra em linhas, nunca horizontalmente"
    - "E6 texto longo — as frases de estado vazio são constantes do contrato; a mais longa cabe em duas linhas a 320px"
    - "E10 transbordo — `/orcamentos` tem uma linha de título e um parágrafo curto, na mesma largura máxima de leitura"
    - "E10 texto longo — a copy de `/orcamentos` é fixa no contrato"
  artifacts:
    - components/amassa/estado-vazio.tsx
    - components/amassa/cabecalho-pagina.tsx
    - components/amassa/cartao-painel.tsx
    - app/(app)/page.tsx
    - app/(app)/encomendas/page.tsx
    - app/(app)/agenda/page.tsx
    - app/(app)/queimas/page.tsx
    - app/(app)/estoque/page.tsx
    - app/(app)/orcamentos/page.tsx
    - tests/e2e/casca.spec.ts
  key_links:
    - "`ITENS_NAVEGACAO` (plano 02) → as cinco rotas que este plano cria: se um `href` não tiver página, o item leva a um 404"
    - "`EstadoVazio` sem `rotuloBotao` → nenhum botão renderizado: é o que faz `/orcamentos` diferir das telas de módulo sem um componente separado"
    - "`exigirUsuario()` na primeira linha de cada uma das seis páginas → `middleware.ts` inalterado → rotas novas protegidas sem configuração"
  prohibitions:
    - statement: "Nenhum nome, e-mail ou dado real de aluna, cliente ou gestor do ateliê entra em copy, em fixture de teste ou em captura de tela desta fase — só nomes claramente fictícios"
---

<objective>
As dez telas por onde se navega: o painel inicial com os quatro cartões nomeados, as quatro telas
de módulo com cabeçalho, estado vazio e botão inerte, e a tela de `/orcamentos` dizendo que o
módulo está por vir.

Purpose: é o que transforma a casca do plano 02 em navegação que leva a algum lugar, e é onde
UI-07 ganha prova real nesta fase — "frase de contexto **e botão**" existindo de verdade em cada
tela, não como promessa das fases seguintes.
Output: três componentes compartilhados em `components/amassa/`, seis páginas sob `app/(app)/`,
a spec e2e da navegação, e a suíte antiga consertada onde o painel real a quebra.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Os três componentes compartilhados — estado vazio, cabeçalho de página e cartão do painel</name>
  <files>components/amassa/estado-vazio.tsx, components/amassa/cabecalho-pagina.tsx, components/amassa/cartao-painel.tsx</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seções "Contrato do
      componente de estado vazio", "Cabeçalho de Página — padrão compartilhado (D-01)" e "Painel
      Inicial (D-02, D-16)": os três trazem a assinatura e o leiaute já resolvidos
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §7 (linhas 237–250) — estados vazios sempre com frase
      de contexto e botão; §9 (a partir da linha 294) — a voz da interface, para a nota do botão
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md` — D-01 (a moldura de
      cada tela), D-02 (os quatro cartões), a "Claude's Discretion" que manda transformar UI-07 em
      componentes compartilhados
    - `components/ui/card.tsx` e `components/ui/button.tsx` — as peças shadcn a compor
    - `app/globals.css` — as classes de tipografia disponíveis (`text-display`, `text-titulo`,
      `text-corpo`, `text-apoio`, `text-micro`)
  </read_first>
  <action>
Os três são Server Components (sem `"use client"`), em `components/amassa/` (D-11).

**`components/amassa/estado-vazio.tsx`** — a assinatura vem literal do contrato de UI:
`type EstadoVazioProps = { titulo: string; corpo: string; rotuloBotao?: string; notaBotao?: string }`.
Centralizado vertical e horizontalmente na área de conteúdo, com largura máxima de leitura
(algo em torno de `max-w-prose`) para o texto quebrar em linhas em vez de esticar. Título em
`text-titulo`, corpo em `text-corpo` na cor `text-muted-foreground`. Quando `rotuloBotao` estiver
presente, renderiza um `Button` variante `default` com `disabled` e `aria-disabled="true"`, e
logo abaixo dele a `notaBotao` em `text-apoio` — visível no documento, nunca escondida em `title`
ou tooltip, porque precisa ser lida sem interação, inclusive por leitor de tela. Quando
`rotuloBotao` for omitido, nenhum botão é renderizado (é o caso de `/orcamentos`). Sem ícone
decorativo: o texto carrega a voz do produto.

**`components/amassa/cabecalho-pagina.tsx`** — `{ titulo: string; children?: React.ReactNode }`.
Renderiza um `<h1>` em `text-display` com o título, e o `children` (o botão de ação) alinhado à
direita no desktop. No celular o botão desce para a linha de baixo em vez de espremer o título —
resolva com `flex-wrap`, não com truncamento do título.

**`components/amassa/cartao-painel.tsx`** — `{ titulo: string; vazio: string }`. Usa o `Card` do
shadcn: `CardHeader`/`CardTitle` com o `titulo` em `text-titulo`, e o corpo com a frase `vazio` em
`text-corpo` na cor `text-muted-foreground`. Sem botão e sem esqueleto (D-02, D-03) — nesta fase
nenhum cartão busca dado, e um esqueleto que nunca resolve leria como travamento.

Deixe em `cartao-painel.tsx` um comentário curto registrando o formato do esqueleto que as fases
3 a 6 vão usar quando houver consulta de verdade — retângulo do tamanho do título mais duas
linhas do tamanho do corpo — para o padrão não se perder. Comentário, não código morto.
  </action>
  <verify>
    <automated>npm run lint && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `components/amassa/estado-vazio.tsx` exporta `EstadoVazio` e o tipo tem exatamente as quatro
      propriedades `titulo`, `corpo`, `rotuloBotao?`, `notaBotao?`
    - `components/amassa/estado-vazio.tsx` contém `aria-disabled="true"`
    - `grep -c 'title=' components/amassa/estado-vazio.tsx` retorna 0 — a nota do botão é texto no
      documento, não atributo de tooltip
    - `components/amassa/cabecalho-pagina.tsx` contém `<h1` e `text-display`
    - `components/amassa/cartao-painel.tsx` importa de `@/components/ui/card`
    - `grep -c 'components/ui/skeleton' components/amassa/cartao-painel.tsx` retorna 0 — o cartão
      não importa esqueleto, porque esqueleto não é espaço reservado permanente (D-03)
    - `npm run lint` sai com 0; `npx tsc --noEmit` sai com 0
  </acceptance_criteria>
  <done>UI-07 tem componentes reais em vez de convenção: um estado vazio com frase e botão, uma
  moldura de cabeçalho e um cartão de painel — os três reaproveitáveis pelas Fases 3 a 6.</done>
</task>

<task type="auto">
  <name>Tarefa 2: As seis páginas — painel inicial e as cinco rotas novas</name>
  <files>app/(app)/page.tsx, app/(app)/encomendas/page.tsx, app/(app)/agenda/page.tsx, app/(app)/queimas/page.tsx, app/(app)/estoque/page.tsx, app/(app)/orcamentos/page.tsx</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — a tabela "Estados
      vazios por tela" (título, corpo, rótulo do botão e nota, por tela — copie os textos
      LITERALMENTE), a seção "`/orcamentos` — tela 'por vir'" e a seção "Painel Inicial"
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md` — seções
      "`app/(app)/page.tsx` → painel inicial" e "as cinco páginas de módulo": trazem o esqueleto
      exato e a regra de `exigirUsuario()` como primeira instrução
    - `app/(app)/page.tsx` — a página provisória que será substituída (D-16); o comentário no topo
      dela já anuncia esta substituição
    - `lib/auth/exigir-usuario.ts` — o que a função devolve; `usuario.nome` alimenta a saudação
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §9 (a partir da linha 294) — a voz, para conferir que
      as frases das telas além de Encomendas seguem o registro afetivo e direto
    - `components/amassa/estado-vazio.tsx`, `cabecalho-pagina.tsx`, `cartao-painel.tsx` — como
      ficaram na Tarefa 1
  </read_first>
  <action>
As seis páginas são Server Components assíncronos com `exigirUsuario()` como PRIMEIRA instrução
do corpo do componente — sem exceção, é a regra do `CLAUDE.md` e o padrão que a página provisória
já demonstra. `middleware.ts` e `lib/auth/rotas-publicas.ts` não são tocados: as rotas novas
nascem protegidas por já estarem fora de `ROTAS_PUBLICAS`.

**As quatro telas de módulo** (`encomendas`, `agenda`, `queimas`, `estoque`) têm o mesmo
esqueleto e diferem só nas cadeias de texto: `<CabecalhoPagina titulo="..." />` seguido de
`<EstadoVazio titulo corpo rotuloBotao notaBotao />`. Copie os quatro conjuntos de texto
LITERALMENTE da tabela "Estados vazios por tela" do `02b-UI-SPEC.md`, com acentuação e pontuação
exatas — inclusive "A roda ainda não gira." em Encomendas, que é a única frase que veio pronta do
documento de design (D-05). Os títulos de página são "Encomendas", "Agenda", "Queimas" e
"Estoque".

O botão desabilitado de cada tela é o único botão terracota daquela tela — não acrescente
nenhum outro botão de ação.

**`/orcamentos`** (D-04) usa o mesmo `EstadoVazio`, mas OMITINDO `rotuloBotao` e `notaBotao`:
título "A calculadora ainda não existe." e corpo "Ela depende das planilhas de precificação do
ateliê. Assim que estiverem prontas, o orçamento sai daqui." Sem botão — um botão desabilitado
sugeriria uma ação que vai existir em breve, e não é o caso. O `CabecalhoPagina` desta tela leva
o título "Orçamentos" sem `children`.

**`app/(app)/page.tsx`** (D-02, D-16) — substitua a página provisória inteira. Estrutura: `<h1>`
em `text-display` com a saudação "Olá, {usuario.nome}." (reaproveita o nome que `exigirUsuario()`
já devolve, sem consulta nova), um rótulo de seção em `text-micro` caixa alta com o texto
"SEU DIA HOJE", e a grade dos quatro `CartaoPainel`: "Encomendas por etapa" / "Nenhuma encomenda
em andamento.", "Aulas de hoje" / "Nenhuma aula hoje.", "Fornos em atenção" / "Nenhum forno em
atenção.", "Estoque baixo" / "Nenhum material em alerta." — nesta ordem, os textos literais da
tabela do contrato. Grade em 1 coluna no celular e 2×2 a partir de `md`; ela quebra para 1 coluna
antes de qualquer cartão encolher abaixo do legível. O painel não usa `CabecalhoPagina` — a
saudação faz esse papel.

Nenhuma dessas páginas cria Server Action, tabela ou consulta. Se `npm run verificar-acoes`
apontar algo, é sinal de que uma ação foi criada sem querer.
  </action>
  <verify>
    <automated>npm run lint && npx tsc --noEmit && npm run verificar-acoes && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Existem os seis arquivos: `app/(app)/page.tsx`, `app/(app)/encomendas/page.tsx`,
      `app/(app)/agenda/page.tsx`, `app/(app)/queimas/page.tsx`, `app/(app)/estoque/page.tsx`,
      `app/(app)/orcamentos/page.tsx`
    - Em cada um dos seis, a primeira instrução dentro do componente é uma chamada a
      `exigirUsuario()` (com ou sem atribuição a variável)
    - `app/(app)/encomendas/page.tsx` contém a string exata `A roda ainda não gira.`
    - `app/(app)/orcamentos/page.tsx` contém `A calculadora ainda não existe.` e
      `grep -c 'components/ui/button' 'app/(app)/orcamentos/page.tsx'` retorna 0 — a tela não tem
      botão nenhum, nem desabilitado
    - `app/(app)/page.tsx` contém `SEU DIA HOJE` e os quatro títulos `Encomendas por etapa`,
      `Aulas de hoje`, `Fornos em atenção` e `Estoque baixo`
    - `grep -c 'Você está autenticado' 'app/(app)/page.tsx'` retorna 0 — a página provisória foi
      substituída, não emendada
    - `git diff --exit-code middleware.ts lib/auth/rotas-publicas.ts app/globals.css` retorna 0
    - `npm run lint` sai com 0; `npx tsc --noEmit` sai com 0; `npm run verificar-acoes` sai com 0;
      `npm run build` sai com 0
  </acceptance_criteria>
  <done>Os cinco itens da navegação levam a cinco telas reais, `/orcamentos` existe e diz por que
  não existe, e o painel inicial mostra os quatro cartões que as Fases 3 a 6 vão preencher.</done>
</task>

<task type="auto">
  <name>Tarefa 3: A prova da navegação e o conserto das asserções que o painel real quebra</name>
  <files>tests/e2e/casca.spec.ts, tests/e2e/fundacao.spec.ts, tests/e2e/sessao.spec.ts, tests/e2e/autenticacao.spec.ts</files>
  <read_first>
    - `tests/e2e/fundacao.spec.ts` — a asserção `getByRole("heading", { name: "AMASSA" })` depois
      do login na raiz (a de `/login` continua válida e não muda)
    - `tests/e2e/sessao.spec.ts` — as três asserções do mesmo cabeçalho na raiz
    - `tests/e2e/autenticacao.spec.ts` — a asserção do mesmo cabeçalho no caso do login que dá
      certo
    - `tests/e2e/design-system.spec.ts` — a forma da spec criada no plano 01
    - `lib/navegacao/itens.ts` — `ITENS_NAVEGACAO`, a constante que esta spec importa em vez de
      redigitar os rótulos acentuados
    - `playwright.config.ts` — os dois projetos e o `baseURL`
    - `tests/e2e/apoio/preparar-usuario.ts` — a conta de teste publicada em
      `E2E_EMAIL_TESTE` / `E2E_SENHA_TESTE`
  </read_first>
  <action>
**1. Consertar as quatro asserções que o painel real invalida.** Hoje `fundacao.spec.ts`,
`sessao.spec.ts` (três ocorrências) e `autenticacao.spec.ts` afirmam
`getByRole("heading", { name: "AMASSA" })` DEPOIS do login, na raiz — e a página provisória tinha
esse `<h1>`. O painel inicial tem `<h1>Olá, {nome}.</h1>`, e no celular a barra lateral com o logo
nem é renderizada. Troque essas quatro asserções por
`getByRole("heading", { name: /^Olá, / })`, que vale nos dois projetos. A asserção de
`getByRole("heading", { name: "AMASSA" })` em `/login` (`fundacao.spec.ts`, o caso sem sessão)
NÃO muda — o `Logo como="h1"` do plano 01 a mantém válida, e ela é a prova pública de INFRA-02.

Não remova nem afrouxe nenhum outro caso. Se alguma asserção passar a casar com dois elementos,
escope o localizador (como `autenticacao.spec.ts` já faz com `page.locator("form")`), nunca
apague o caso.

**2. `tests/e2e/casca.spec.ts`**, spec nova, rodando nos dois projetos. Faça login uma vez por
caso com a conta do `globalSetup` e prove:

- **UI-02:** no viewport de celular, a barra inferior (`getByRole("navigation", { name: "Navegação
  principal" })`) tem exatamente 5 links, e os nomes acessíveis deles são exatamente os `rotulo`
  de `ITENS_NAVEGACAO`, na ordem do array. Importe a constante em vez de redigitar os textos: é o
  que impede a interface e a asserção divergirem em forma de normalização de acento.
- **UI-02:** para cada item, clicar leva à URL do `href` correspondente e o item passa a expor
  `aria-current="page"`, enquanto nenhum outro o expõe.
- **UI-04:** nenhum dos 5 links da barra inferior tem nome acessível "Orçamentos"; e
  `/orcamentos` é alcançável abrindo o menu do usuário e clicando no item de lá.
- **UI-03:** no projeto desktop, a barra lateral tem `boundingBox().width` igual a 240.
- **UI-06:** em cada uma das seis rotas protegidas mais `/login`, com o viewport reduzido a 320px
  de largura, `document.documentElement.scrollWidth` não é maior que
  `document.documentElement.clientWidth`. Um único caso parametrizado sobre a lista de rotas
  basta — não escreva sete casos copiados.
- **UI-07:** cada tela de módulo mostra o título dela, a frase de vazio e um botão desabilitado
  com a nota visível; `/orcamentos` mostra o título e o corpo e nenhum botão.

Use `getByRole` com nome acessível em toda parte, como o resto da suíte faz — nunca seletor de
classe de estilo, que quebraria a cada ajuste visual sem indicar nada de real.
  </action>
  <verify>
    <automated>npm run test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e` sai com 0, com `fundacao`, `autenticacao`, `sessao`, `backup`,
      `design-system` e `casca` passando nos projetos `desktop` e `celular`
    - `tests/e2e/casca.spec.ts` importa `ITENS_NAVEGACAO` de `@/lib/navegacao/itens`
    - `tests/e2e/casca.spec.ts` contém `scrollWidth` e `aria-current`
    - `grep -c 'Olá, ' tests/e2e/sessao.spec.ts` retorna 3 — as três asserções da raiz foram
      trocadas pela saudação do painel
    - `grep -c 'Olá, ' tests/e2e/autenticacao.spec.ts` retorna 1 e
      `grep -c 'Olá, ' tests/e2e/fundacao.spec.ts` retorna 1
    - `grep -c 'name: "AMASSA"' tests/e2e/fundacao.spec.ts` retorna 1 — sobrevive só a asserção do
      logo em `/login`, que é a prova pública de INFRA-02
    - A soma de casos de teste em `fundacao`, `sessao` e `autenticacao` é a mesma de antes deste
      plano: nenhum caso removido
    - `grep -rl 'test.skip\|test.fixme' tests/e2e/` não devolve nenhuma linha — nenhum caso foi
      desligado para a suíte passar
  </acceptance_criteria>
  <done>UI-02, UI-03, UI-04, UI-06 e UI-07 têm prova de máquina nos dois tamanhos de tela, e a
  suíte herdada das fases 1 e 2a continua verde sem nenhum caso apagado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → cinco rotas novas sob `app/(app)/` | rotas que não existiam passam a existir e precisam exigir sessão |
| navegador anônimo → `/orcamentos` | a rota mais provável de virar pública "para mostrar a tela" |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02b-01 | Elevation of Privilege | as seis páginas sob `app/(app)/` | high | mitigate | `exigirUsuario()` como primeira instrução em cada uma; `middleware.ts` e `lib/auth/rotas-publicas.ts` não são tocados (critério de aceite com `git diff --exit-code`); `npm run verificar-acoes` roda no pipeline |
| T-02b-02 | Elevation of Privilege | `/orcamentos` | high | mitigate | A rota não é acrescentada a `ROTAS_PUBLICAS`; `tests/e2e/fundacao.spec.ts` já prova que sem sessão qualquer rota cai em `/login`, e o teste unitário de `rotas-publicas` roda sem edição |
| T-02b-10 | Information Disclosure | copy dos estados vazios e do painel | low | mitigate | Todas as frases vêm do contrato de UI; nenhum nome, e-mail ou dado real de aluna, cliente ou gestor entra em texto de interface ou fixture (proibição registrada em `must_haves`) |
| T-02b-11 | Spoofing | botões desabilitados das telas de módulo | low | accept | O botão inerte não dispara nada e não tem `formAction`; aceito — não há caminho de execução por trás dele nesta fase |
</threat_model>

<verification>
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes`, `npm test`, `npm run build` e
  `npm run test:e2e` saem todos com 0.
- `git diff --exit-code middleware.ts lib/auth/rotas-publicas.ts app/globals.css` retorna 0.
- As dez telas da fase existem e nenhuma exige rolagem horizontal a 320px.

## Considerações de UI dispensadas com motivo (não são omissões)

O `02b-UI-SPEC.md` marca três linhas como `❌ dismissed`, com motivo escrito. Ficam registradas
aqui como decididas, e por isso NÃO viram truth nem backstop:

1. **`populated` nos cartões do painel** — nenhum cartão recebe dado nesta fase. O estado populado
   de "Encomendas por etapa" é definido pela Fase 3, "Aulas de hoje" pela Fase 5, "Fornos em
   atenção" pela Fase 4 e "Estoque baixo" pela Fase 6. Especificá-lo aqui seria inventar contrato
   para dado que este contrato não conhece.
2. **`partial` nos cartões do painel** — mesmo motivo: não há dado parcial possível sem dado.
3. **`zero-one-many`, lado "muitos", nos cartões do painel** — o limite de itens por cartão e o
   "ver todos" são decisão da fase que fornece o dado; PNL-01 (Fase 7) fecha o painel real.
</verification>

<success_criteria>
Dá para entrar no sistema, tocar em qualquer um dos cinco itens no celular e chegar a uma tela
que diz o que vai morar ali, com um botão que anuncia a ação e a fase em que ela chega — e nada
disso exige rolar de lado.
</success_criteria>

<output>
Create `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-03-SUMMARY.md` when done
</output>

## Artefatos que este plano produz

**Arquivos novos:** `components/amassa/estado-vazio.tsx`, `components/amassa/cabecalho-pagina.tsx`,
`components/amassa/cartao-painel.tsx`, `app/(app)/encomendas/page.tsx`,
`app/(app)/agenda/page.tsx`, `app/(app)/queimas/page.tsx`, `app/(app)/estoque/page.tsx`,
`app/(app)/orcamentos/page.tsx`, `tests/e2e/casca.spec.ts`.

**Arquivos modificados:** `app/(app)/page.tsx` (substituído pelo painel real),
`tests/e2e/fundacao.spec.ts`, `tests/e2e/sessao.spec.ts`, `tests/e2e/autenticacao.spec.ts`.

**Símbolos exportados:** `EstadoVazio` e `EstadoVazioProps`
(`{ titulo: string; corpo: string; rotuloBotao?: string; notaBotao?: string }`); `CabecalhoPagina`
(`{ titulo: string; children?: React.ReactNode }`); `CartaoPainel`
(`{ titulo: string; vazio: string }`).

**Rotas novas:** `/encomendas`, `/agenda`, `/queimas`, `/estoque`, `/orcamentos` — todas
protegidas. `/` deixa de ser a rota provisória e passa a ser o painel inicial.

**Scripts npm novos:** nenhum.
