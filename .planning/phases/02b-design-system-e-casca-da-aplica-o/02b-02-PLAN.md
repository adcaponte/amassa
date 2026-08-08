---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 02
type: execute
wave: 2
depends_on: ["02b-01"]
files_modified:
  - components/ui/card.tsx
  - components/ui/sidebar.tsx
  - components/ui/sheet.tsx
  - components/ui/skeleton.tsx
  - components/ui/dropdown-menu.tsx
  - components/ui/separator.tsx
  - components/ui/tooltip.tsx
  - components/ui/input.tsx
  - components/ui/button.tsx
  - hooks/use-mobile.ts
  - lib/navegacao/itens.ts
  - tests/unit/navegacao.test.ts
  - components/amassa/barra-lateral.tsx
  - components/amassa/barra-inferior.tsx
  - components/amassa/cabecalho-movel.tsx
  - components/amassa/menu-usuario.tsx
  - app/(app)/layout.tsx
  - app/(app)/page.tsx
  - tests/e2e/sessao.spec.ts
  - package.json
  - package-lock.json
autonomous: false
requirements: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-09]
user_setup: []

estimate:
  tokens: 82000
  raw_tokens: 82000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "No celular (< 768px) a barra inferior mostra exatamente 5 links — Início, Encomendas, Agenda, Queimas, Estoque — nessa ordem, e nenhum deles se chama Orçamentos (UI-02, UI-04)"
    - "No desktop (>= 768px) a barra lateral mede exatamente 240px de largura, não recolhe, e traz os mesmos 5 itens mais o menu do usuário no rodapé (UI-03, D-12)"
    - "O menu do usuário mostra três coisas e só três: o nome de quem entrou, Orçamentos e Sair (D-15)"
    - "No celular o menu do usuário vem de um botão de avatar no cabeçalho, nunca de um sexto item na barra inferior (D-15, UI-02)"
    - "O botão de avatar responde a `getByRole('button', { name: 'Abrir menu do usuário' })` — é o único botão só com ícone da fase (UI-09)"
    - "`ehItemAtivo('/encomendas', '/')` é falso: `/` casa só por igualdade exata, então navegar para um módulo não deixa Início aceso junto (UI-02, adjacência)"
    - "`ehItemAtivo('/encomendasx', '/encomendas')` é falso: o casamento por prefixo exige a barra separadora, não um prefixo de texto solto (UI-02, adjacência)"
    - "Com um caminho vazio ou desconhecido, nenhum item fica ativo — a barra nunca acende dois nem chuta um (UI-02, entrada vazia)"
    - "Para qualquer caminho das 5 rotas, exatamente um item de `ITENS_NAVEGACAO` está ativo, e a ordem de renderização é a ordem do array — não depende de iteração de objeto (UI-02, ordenação)"
    - "Os rótulos acentuados vivem em `ITENS_NAVEGACAO` e os testes importam essa mesma constante em vez de redigitar o texto — não há como o acento divergir em forma de normalização entre a interface e a asserção (UI-09, codificação)"
    - "E1/E3 carregando — a casca é Server Component dentro de `app/(app)/layout.tsx`: existe no primeiro paint e não tem estado de carregando próprio"
    - "E1/E3 erro — a navegação vive no layout, fora do boundary de erro; quando uma tela quebra, a barra continua utilizável e dá saída"
    - "E1 transbordo — a 320px de largura os 5 itens cabem, cada um em 1/5 da largura, sem quebra e sem rolagem horizontal (UI-06)"
    - "E3 transbordo — 240px fixos com rótulos curtos e constantes; nenhum item chega perto do limite"
    - "E1 texto longo — os cinco rótulos são constantes do código, nunca dado do usuário; não existe texto variável a truncar na navegação"
    - "E2 carregando — `usuario.nome` vem de `exigirUsuario()` no servidor, já resolvido antes do render; o menu nunca aparece sem nome"
    - "E2 erro — o único ponto de falha do menu é a Server Action `sair`, e a falha cai no boundary de erro do grupo; o menu não carrega estado de erro próprio"
    - "E2 transbordo — o `Sheet` do menu tem três itens e rola verticalmente se um dia crescer"
    - statement: "O nome do usuário trunca com reticências em uma linha, com o nome completo em `title`, tanto no rodapé da barra lateral de 240px quanto no menu do celular"
      verification: backstop
  artifacts:
    - lib/navegacao/itens.ts
    - tests/unit/navegacao.test.ts
    - components/amassa/barra-lateral.tsx
    - components/amassa/barra-inferior.tsx
    - components/amassa/cabecalho-movel.tsx
    - components/amassa/menu-usuario.tsx
    - app/(app)/layout.tsx
  key_links:
    - "`app/(app)/layout.tsx` chama `exigirUsuario()` e passa `usuario.nome` para o menu — sem consulta nova ao banco"
    - "`ITENS_NAVEGACAO` é a fonte única dos 5 itens: barra inferior, barra lateral e testes leem o mesmo array"
    - "`menu-usuario.tsx` reaproveita a Server Action `sair` de `lib/auth/acoes.ts` — nenhuma ação nova é criada"
    - "`--color-sidebar-*` do plano 01 → componente `Sidebar` do shadcn → cor real da barra lateral; é o elo que não quebra nada quando falta"
  prohibitions:
    - statement: "Nenhuma rota nova é acrescentada a `ROTAS_PUBLICAS` nem ao `matcher` do `middleware.ts` para facilitar teste ou demonstração — `lib/auth/rotas-publicas.ts` e `middleware.ts` saem desta fase byte a byte iguais"
---

<objective>
A casca por onde se navega: barra lateral fixa de 240px no desktop, barra inferior de 5 itens e
cabeçalho com avatar no celular, e o menu do usuário com nome, Orçamentos e Sair. O layout do
grupo `app/(app)/` passa a existir e envolve toda tela protegida.

Purpose: sem a casca, as telas dos módulos (plano 03) e os estados de erro (plano 04) não têm
onde nascer. Este plano também é onde as oito variáveis `--color-sidebar-*` escritas no plano 01
finalmente têm alguém que as consuma — e onde o botão Sair sai da página provisória e vai para o
lugar definitivo.
Output: `lib/navegacao/itens.ts` (módulo puro, testado), quatro componentes em
`components/amassa/`, `app/(app)/layout.tsx`, e os seis componentes shadcn restantes instalados.
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
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-01-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Tarefa 1: Portão de legitimidade dos pacotes Radix desta onda</name>
  <what-built>Nada ainda. Mesma política do plano 01: sem tabela de auditoria de pacotes em
  RESEARCH.md, todo pacote entra como `[ASSUMED]` e passa por conferência humana antes de ser
  instalado. Nunca aprovado automaticamente.</what-built>
  <how-to-verify>
Confira em `npmjs.com/package/<nome>` — mantenedor, última publicação, repositório vinculado,
downloads semanais. São as dependências que `shadcn add card sidebar sheet skeleton dropdown-menu
separator` traz:

- `@radix-ui/react-dialog` (base do `Sheet`)
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-separator`
- `@radix-ui/react-tooltip` (dependência do `Sidebar`)

Todas do mesmo `@radix-ui` conferido no plano 01, pelo registro oficial do shadcn. Se alguma
tiver mantenedor diferente do resto da família, pare e diga qual.
  </how-to-verify>
  <resume-signal>Digite "aprovado" para liberar a instalação, ou nomeie o pacote que não passou</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Os seis componentes restantes e o módulo puro da navegação</name>
  <files>components/ui/card.tsx, components/ui/sidebar.tsx, components/ui/sheet.tsx, components/ui/skeleton.tsx, components/ui/dropdown-menu.tsx, components/ui/separator.tsx, components/ui/tooltip.tsx, components/ui/input.tsx, components/ui/button.tsx, hooks/use-mobile.ts, lib/navegacao/itens.ts, tests/unit/navegacao.test.ts, package.json, package-lock.json</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md` — D-06 (só estes sete
      componentes), D-07 (`alert-dialog` e `sonner` NÃO entram), D-11 (fronteira `ui/` × `amassa/`)
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seção "Navegação —
      Casca da Aplicação", subseção "Detecção do item ativo" e a tabela de ícones
    - `lib/auth/rotas-publicas.ts` — o padrão de módulo puro deste projeto: zero imports, recebe
      dados e devolve dados
    - `tests/unit/rotas-publicas.test.ts` — a forma do teste de unidade correspondente
    - `app/globals.css` — para confirmar que os oito `--color-sidebar-*` continuam lá depois de
      cada `shadcn add`
  </read_first>
  <behavior>
    - `ehItemAtivo("/", "/")` é verdadeiro
    - `ehItemAtivo("/encomendas", "/")` é falso — a raiz casa só por igualdade exata
    - `ehItemAtivo("/encomendas", "/encomendas")` é verdadeiro
    - `ehItemAtivo("/encomendas/42", "/encomendas")` é verdadeiro — sub-rota futura acende o pai
    - `ehItemAtivo("/encomendasx", "/encomendas")` é falso — prefixo de texto não basta, a barra
      separadora é obrigatória
    - `ehItemAtivo("", href)` é falso para todos os cinco `href`
    - `ehItemAtivo("/rota-que-nao-existe", href)` é falso para todos os cinco `href`
    - para cada um dos cinco caminhos de `ITENS_NAVEGACAO`, a contagem de itens ativos sobre o
      array inteiro é exatamente 1
    - `ITENS_NAVEGACAO` tem comprimento 5 e a ordem dos rótulos é exatamente Início, Encomendas,
      Agenda, Queimas, Estoque
    - nenhum item de `ITENS_NAVEGACAO` tem `href` igual a `/orcamentos`
  </behavior>
  <action>
**1. Instalar os componentes** (D-06 — só estes, nenhum a mais):
`npx shadcn@latest add card sidebar sheet skeleton dropdown-menu separator`.
O `sidebar` arrasta consigo `tooltip`, `input`, `separator`, `sheet`, `skeleton`, `button` e o
gancho `hooks/use-mobile.ts` — é o comportamento do registro, não uma escolha nossa; deixe
acontecer e registre no SUMMARY o que apareceu. Se o comando pedir para sobrescrever
`components/ui/button.tsx`, aceite: é o mesmo arquivo gerado.

Depois de instalar, fixe em `package.json` a versão exata de toda dependência nova, sem `^` e sem
`~`, e rode `npm install` para o lock refletir. NÃO instale `alert-dialog` nem `sonner` (D-07) —
eles chegam na Fase 3, junto com a primeira exclusão de verdade.

**Confira imediatamente que `app/globals.css` não foi tocado.** Versões recentes do `shadcn add`
injetam variáveis de barra lateral no CSS quando não as encontram no formato que esperam — se
isso acontecer aqui, o mapeamento do plano 01 é sobrescrito e a barra lateral sai com a paleta
errada sem nenhum erro. `git diff --exit-code app/globals.css` precisa retornar 0; se não
retornar, restaure o arquivo do plano 01 e siga.

**2. `lib/navegacao/itens.ts`** — módulo puro, sem nenhum import, no padrão de
`lib/auth/rotas-publicas.ts`. Exporta:

- `type ChaveDeIcone = "inicio" | "encomendas" | "agenda" | "queimas" | "estoque"`
- `type ItemDeNavegacao = { href: string; rotulo: string; icone: ChaveDeIcone }`
- `const ITENS_NAVEGACAO: readonly ItemDeNavegacao[]` com exatamente cinco entradas, nesta ordem:
  `/` "Início" `inicio`, `/encomendas` "Encomendas" `encomendas`, `/agenda` "Agenda" `agenda`,
  `/queimas` "Queimas" `queimas`, `/estoque` "Estoque" `estoque`
- `function ehItemAtivo(caminho: string, href: string): boolean`

A regra de `ehItemAtivo`, escrita por extenso porque é a única lógica desta fase: quando `href`
é `/`, só há casamento por igualdade exata; para qualquer outro `href`, casa quando `caminho` é
igual a `href` ou quando começa com `href` seguido de `/`. Caminho vazio nunca casa. O ícone é
uma CHAVE de texto, não o componente do `lucide-react` — é o que mantém o módulo puro e
testável no Vitest sem tocar em React. O mapeamento chave → ícone (`Home`, `Package`,
`CalendarDays`, `Flame`, `Archive`) vive nos componentes.

Orçamentos NÃO entra neste array (UI-04) — ele é item do menu do usuário, e a Tarefa 3 o
coloca lá com o ícone `Calculator`.

**3. `tests/unit/navegacao.test.ts`** — escreva os casos da seção `<behavior>` antes de olhar a
implementação passar, incluindo o caso que conta quantos itens ficam ativos por caminho. Esse
último é o que prova que a barra nunca acende dois.
  </action>
  <verify>
    <automated>npm test && npm run lint && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Existem `components/ui/card.tsx`, `components/ui/sidebar.tsx`, `components/ui/sheet.tsx`,
      `components/ui/skeleton.tsx`, `components/ui/dropdown-menu.tsx` e
      `components/ui/separator.tsx`
    - Não existe `components/ui/alert-dialog.tsx` nem `components/ui/sonner.tsx` (D-07)
    - `git diff --exit-code app/globals.css` retorna 0
    - `npm test` sai com 0 e o relatório inclui os casos de `tests/unit/navegacao.test.ts`
    - `grep -c "^import\|^const .* = require" lib/navegacao/itens.ts` retorna 0 — módulo puro,
      sem nenhum import
    - O caso de `tests/unit/navegacao.test.ts` que afirma que nenhum item de `ITENS_NAVEGACAO`
      tem `href` de orçamentos passa — a exclusão é provada por teste, não por busca em texto
    - `npm run lint` sai com 0; `npx tsc --noEmit` sai com 0
    - Nenhuma dependência nova em `package.json` começa com `^` ou `~`
  </acceptance_criteria>
  <done>Os sete componentes de D-06 estão instalados, o mapeamento de tokens sobreviveu à
  instalação, e a regra do item ativo é um módulo puro com teste que cobre igualdade, prefixo,
  prefixo falso, entrada vazia e unicidade.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Os quatro componentes da casca e o layout do grupo protegido</name>
  <files>components/amassa/barra-lateral.tsx, components/amassa/barra-inferior.tsx, components/amassa/cabecalho-movel.tsx, components/amassa/menu-usuario.tsx, app/(app)/layout.tsx, app/(app)/page.tsx</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seção "Navegação —
      Casca da Aplicação" inteira: breakpoint 768px, barra inferior, cabeçalho móvel (incluindo o
      contrato obrigatório de `aria-label` do botão de avatar), barra lateral, ícones, e o
      componente `Logo`
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §5 (linhas 206–218) — os 5 itens, os 56px e os 240px
      na fonte original; §6 (linhas 221–234) — a regra dura de nenhuma rolagem horizontal
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md` — D-12 (fixa, não
      recolhe), D-13 (Logo), D-15 (as três coisas do menu, e o avatar no celular)
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md` — seções
      "`app/(app)/layout.tsx` (new — the shell)" e "`components/amassa/menu-usuario.tsx`": o
      esqueleto do layout e o padrão exato de `<form action={sair}>`
    - `app/(app)/page.tsx` — a página provisória, de onde o formulário de sair vai sair
    - `lib/auth/acoes.ts` — a Server Action `sair` já existente, a reaproveitar sem criar nada
    - `lib/auth/exigir-usuario.ts` — o que `exigirUsuario()` devolve (`nome` é o campo que o menu
      exibe)
    - `components/amassa/logo.tsx` e `lib/navegacao/itens.ts` — as duas peças que estes
      componentes consomem
    - `components/ui/sidebar.tsx` — para ver como o `SidebarProvider` define a largura e o que
      `collapsible="none"` faz
  </read_first>
  <action>
Todos os quatro componentes ficam em `components/amassa/` (D-11), com nome de arquivo em
português e identificadores em inglês/misto, como o resto do projeto.

**`components/amassa/barra-inferior.tsx`** — cliente (`"use client"`, precisa de
`usePathname()`). Renderiza um `<nav aria-label="Navegação principal">` fixo no rodapé
(`fixed bottom-0 inset-x-0`), fundo `bg-sidebar`, borda superior `border-border`, escondido a
partir de `md`. Itera `ITENS_NAVEGACAO` e renderiza um `<Link>` do `next/link` por item, cada um
ocupando 1/5 da largura, com `min-h-[56px]`, ícone do `lucide-react` de 20–24px empilhado sobre o
rótulo em `text-nav` (a classe criada no plano 01: 12px/16, peso 500, sem caixa alta e sem
letter-spacing). Item ativo — decidido por `ehItemAtivo(pathname, item.href)` — usa
`text-primary`; inativo usa `text-muted-foreground`. Acrescente `aria-current="page"` no ativo.
O contêiner leva `pb-[env(safe-area-inset-bottom)]` para não ficar sob a faixa de gestos do iOS.
Cada item já tem rótulo visível, então nenhum deles precisa de `aria-label`.

**`components/amassa/barra-lateral.tsx`** — cliente (mesmo motivo). Envolve o `Sidebar` do shadcn
com `collapsible="none"` (D-12 — fixa, sem recolher, sem estado em cookie), escondida abaixo de
`md` (`hidden md:flex`). A largura de 240px é imposta no `SidebarProvider` pela variável do
próprio componente: `style={{ "--sidebar-width": "240px" } as React.CSSProperties}`. Topo:
`<Logo />` (variante padrão, `span` — o `h1` da página é de quem está no conteúdo). Meio: os
mesmos `ITENS_NAVEGACAO`, ícone e rótulo lado a lado, altura de item de no mínimo 44px; item
ativo com fundo `bg-sidebar-accent` e texto `text-sidebar-accent-foreground`, também com
`aria-current="page"`. Rodapé: `<MenuUsuario nome={nome} variante="desktop" />`, separado por um
`Separator`. Assinatura: `{ nome: string; className?: string }`.

**`components/amassa/menu-usuario.tsx`** — cliente. Assinatura
`{ nome: string; variante: "desktop" | "celular" }`. Três itens, exatamente três (D-15): o nome
de quem entrou (não é ação, é rótulo), "Orçamentos" com ícone `Calculator` levando a
`/orcamentos` por `<Link>`, e "Sair" com ícone `LogOut` dentro de `<form action={sair}>` com um
`<button type="submit">`, importando `sair` de `@/lib/auth/acoes` exatamente como a página
provisória faz hoje. Nenhuma Server Action nova.

- `variante="desktop"`: `DropdownMenu` do shadcn, gatilho no rodapé da barra lateral mostrando o
  nome.
- `variante="celular"`: o conteúdo de dentro de um `Sheet`, aberto pelo botão de avatar do
  cabeçalho.

O nome do usuário é o único texto variável da casca: aplique `truncate` (uma linha, reticências)
e `title={nome}` nas duas variantes, para um nome longo não empurrar o leiaute dos 240px.

**`components/amassa/cabecalho-movel.tsx`** — cliente. `<header>` `sticky top-0`, altura 56px,
fundo `bg-sidebar`, borda inferior `border-border`, escondido a partir de `md`. À esquerda o
título da página em `text-titulo`; à direita o botão que abre o `Sheet` do menu do usuário:
círculo de 40px dentro de um alvo de toque de 44px, ícone `CircleUserRound`, e
`aria-label="Abrir menu do usuário"` — obrigatório, é o único botão só com ícone da fase inteira
e a asserção de UI-09 procura exatamente por esse nome acessível. Se você usar iniciais em vez do
ícone, elas levam `aria-hidden` e o `aria-label` continua sendo a única fonte do nome acessível.
Assinatura: `{ nome: string; titulo?: string; className?: string }`. Nesta fase o cabeçalho não
leva busca nem filtro.

**`app/(app)/layout.tsx`** — Server Component novo, com `const usuario = await exigirUsuario();`
como PRIMEIRA instrução do corpo (é a regra do `CLAUDE.md`, e as páginas continuam chamando por
conta própria — a chamada é idempotente). Monta a casca no formato do `02b-PATTERNS.md`: barra
lateral à esquerda a partir de `md`, e à direita uma coluna com cabeçalho móvel, `<main>` com o
`children` e a barra inferior abaixo de `md`. Passe `usuario.nome` para os componentes; não faça
nenhuma consulta nova. Reserve no `<main>` um espaço inferior equivalente à altura da barra
(`pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0`) para o conteúdo não terminar embaixo dela.

**`app/(app)/page.tsx`** — mexa o mínimo: remova o `<form action={sair}>` e o import de `sair`.
O botão de sair agora vive no menu do usuário (D-15), e deixá-lo nos dois lugares faria
`getByRole("button", { name: "Sair" })` casar com dois elementos e quebrar a suíte em modo
estrito. Mantenha o resto da página provisória como está — o plano 03 a substitui inteira pelo
painel inicial.
  </action>
  <verify>
    <automated>npm run lint && npx tsc --noEmit && npm run verificar-acoes && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `app/(app)/layout.tsx` existe e sua primeira instrução dentro do componente é
      `const usuario = await exigirUsuario();`
    - `grep -c 'lib/auth/acoes' 'app/(app)/page.tsx'` retorna 0 — a página não importa mais
      nenhuma ação de servidor
    - `components/amassa/menu-usuario.tsx` contém `action={sair}` e importa de `@/lib/auth/acoes`
    - `components/amassa/menu-usuario.tsx` contém `/orcamentos` e `title={nome}` e `truncate`
    - `components/amassa/cabecalho-movel.tsx` contém `aria-label="Abrir menu do usuário"`
    - `components/amassa/barra-inferior.tsx` contém `ITENS_NAVEGACAO`, `min-h-[56px]`,
      `aria-current` e `env(safe-area-inset-bottom)`
    - `components/amassa/barra-lateral.tsx` contém `collapsible="none"` e `240px`
    - `git diff --exit-code lib/auth/rotas-publicas.ts middleware.ts app/globals.css` retorna 0
    - `npm run lint` sai com 0; `npx tsc --noEmit` sai com 0; `npm run verificar-acoes` sai com 0;
      `npm run build` sai com 0
  </acceptance_criteria>
  <done>Existe uma casca de verdade: no desktop uma barra lateral de 240px com logo, 5 itens e o
  menu do usuário no rodapé; no celular um cabeçalho com avatar e uma barra inferior de 5 itens.
  O botão Sair mudou de endereço e não está mais duplicado.</done>
</task>

<task type="auto">
  <name>Tarefa 4: Consertar a suíte que a mudança de endereço do Sair quebra</name>
  <files>tests/e2e/sessao.spec.ts</files>
  <read_first>
    - `tests/e2e/sessao.spec.ts` — em especial a linha que faz
      `page.getByRole("button", { name: "Sair" }).click()` na raiz, e as asserções de
      `getByRole("heading", { name: "AMASSA" })`
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seção "Cabeçalho
      móvel" e "Barra lateral", para saber como se chega ao Sair em cada tamanho de tela
    - `components/amassa/menu-usuario.tsx` e `components/amassa/cabecalho-movel.tsx` — como
      construídos na Tarefa 3
    - `playwright.config.ts` — os dois projetos, `desktop` e `celular`, e o fato de que toda spec
      roda nos dois
  </read_first>
  <action>
Este teste existe e passa hoje; a Tarefa 3 muda o caminho até o botão. Conserte o caminho, não a
asserção: o que `sessao.spec.ts` prova (AUTH-06 — sair encerra de verdade e o botão de voltar
não devolve o acesso) continua exatamente o mesmo.

Escreva uma função auxiliar local no arquivo, algo como `abrirMenuDoUsuario(page)`, que funcione
nos dois projetos sem ramificar por nome de projeto: no celular ela clica em
`getByRole("button", { name: "Abrir menu do usuário" })`; no desktop ela abre o `DropdownMenu` do
rodapé da barra lateral. A forma robusta é tentar o gatilho visível — só um dos dois está visível
em cada largura de viewport — usando a visibilidade como critério, nunca ramificando pelo nome do
projeto do Playwright (ramificar assim esconderia uma regressão real em um dos dois tamanhos).
Note que o arquivo já usa o nome do projeto em OUTRO ponto, legítimo e pré-existente: a conta
dedicada do teste de desativação. Não mexa nele. Depois de aberto,
`getByRole("button", { name: "Sair" }).click()` volta a funcionar.

As asserções de `getByRole("heading", { name: "AMASSA" })` na raiz continuam válidas nesta onda —
a página provisória ainda tem o `<h1>AMASSA</h1>`. Não as mexa aqui; o plano 03, que substitui a
página pelo painel, é quem as atualiza.

Rode a suíte inteira, não só esta spec: a Tarefa 3 mudou o layout de toda rota protegida, e é
justamente aqui que se descobre se alguma outra asserção passou a casar com dois elementos.
  </action>
  <verify>
    <automated>npm run test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e` sai com 0, com as specs `fundacao`, `autenticacao`, `sessao`, `backup` e
      `design-system` passando nos projetos `desktop` e `celular`
    - `tests/e2e/sessao.spec.ts` contém `Abrir menu do usuário`
    - O corpo da função auxiliar que abre o menu não referencia o nome do projeto do Playwright
      (conferência de fonte — o arquivo continua usando essa referência apenas no caso da conta
      dedicada de desativação, que já existia)
    - A quantidade de casos de teste em `tests/e2e/sessao.spec.ts` é a mesma de antes: nenhum caso
      foi removido para fazer a suíte passar
  </acceptance_criteria>
  <done>A suíte e2e inteira volta ao verde com o Sair no lugar novo, e nenhuma prova de sessão foi
  enfraquecida para isso.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → rota protegida sob `app/(app)/` | toda rota nova precisa continuar exigindo sessão |
| componente cliente → Server Action `sair` | o menu do usuário aciona uma ação de servidor existente |
| registro npm → repositório | seis componentes shadcn e suas dependências Radix entram na árvore |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02b-01 | Elevation of Privilege | `app/(app)/layout.tsx` | high | mitigate | O layout chama `exigirUsuario()` como primeira instrução; `middleware.ts` e `lib/auth/rotas-publicas.ts` não são alterados, então tudo sob `app/(app)/` nasce protegido por já estar fora de `ROTAS_PUBLICAS`. Critério de aceite exige `git diff --exit-code` vazio nesses dois arquivos |
| T-02b-02 | Elevation of Privilege | `lib/auth/rotas-publicas.ts` | high | mitigate | `ROTAS_PUBLICAS` continua com exatamente dois prefixos (`/login`, `/api/health`); `tests/unit/rotas-publicas.test.ts` roda sem edição em `npm test` |
| T-02b-03 | Information Disclosure | `components/amassa/menu-usuario.tsx` | medium | mitigate | O menu exibe apenas `usuario.nome`, recebido como prop do layout. E-mail, papel e id não atravessam a fronteira servidor→cliente. Nenhuma consulta nova ao banco |
| T-02b-06-SC | Tampering | `@radix-ui/*` instalados nesta onda | high | mitigate | Checkpoint humano bloqueante (Tarefa 1) antes da instalação; versões fixadas sem `^`/`~`; `git diff --exit-code app/globals.css` prova que o `shadcn add` não alterou o mapeamento de tokens |
| T-02b-07 | Tampering | `components/ui/*` e `hooks/use-mobile.ts` gerados | medium | accept | Código de terceiro copiado para dentro do repositório, auditável em diff no PR; D-11 proíbe edição manual. Aceito |
</threat_model>

<verification>
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes`, `npm test`, `npm run build` e
  `npm run test:e2e` saem todos com 0.
- `git diff --exit-code lib/auth/rotas-publicas.ts middleware.ts app/globals.css` retorna 0.
- Nenhum componente shadcn além dos sete de D-06 existe em `components/ui/`.
</verification>

<success_criteria>
Entrar no sistema passa a mostrar uma casca de verdade nos dois tamanhos de tela: 240px fixos à
esquerda no desktop, cinco itens no rodapé no celular, e o Sair alcançável em um toque sem
navegar nem rolar. A regra do item ativo é um módulo puro com teste, não uma comparação
espalhada por dois componentes.
</success_criteria>

<output>
Create `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-02-SUMMARY.md` when done
</output>

## Artefatos que este plano produz

**Arquivos novos:** `lib/navegacao/itens.ts`, `tests/unit/navegacao.test.ts`,
`components/amassa/barra-lateral.tsx`, `components/amassa/barra-inferior.tsx`,
`components/amassa/cabecalho-movel.tsx`, `components/amassa/menu-usuario.tsx`,
`app/(app)/layout.tsx`, `components/ui/card.tsx`, `components/ui/sidebar.tsx`,
`components/ui/sheet.tsx`, `components/ui/skeleton.tsx`, `components/ui/dropdown-menu.tsx`,
`components/ui/separator.tsx`, `components/ui/tooltip.tsx`, `components/ui/input.tsx`,
`hooks/use-mobile.ts`.

**Arquivos modificados:** `app/(app)/page.tsx` (só a remoção do formulário de sair),
`components/ui/button.tsx` (possível regeneração pelo `shadcn add`), `tests/e2e/sessao.spec.ts`,
`package.json`, `package-lock.json`.

**Símbolos exportados:** `ChaveDeIcone`, `ItemDeNavegacao`, `ITENS_NAVEGACAO`, `ehItemAtivo`
(`lib/navegacao/itens.ts`); `BarraLateral` (`{ nome: string; className?: string }`);
`BarraInferior` (`{ className?: string }`); `CabecalhoMovel`
(`{ nome: string; titulo?: string; className?: string }`); `MenuUsuario`
(`{ nome: string; variante: "desktop" | "celular" }`); `useIsMobile` (`hooks/use-mobile.ts`,
gerado); os componentes shadcn gerados (`Card`, `CardHeader`, `CardTitle`, `CardContent`,
`Sidebar` e família, `Sheet` e família, `Skeleton`, `DropdownMenu` e família, `Separator`,
`Tooltip` e família, `Input`).

**Rotas novas:** nenhuma rota nova de URL; nasce o layout `app/(app)/layout.tsx`, que passa a
envolver toda rota protegida existente e futura.

**Scripts npm novos:** nenhum.
