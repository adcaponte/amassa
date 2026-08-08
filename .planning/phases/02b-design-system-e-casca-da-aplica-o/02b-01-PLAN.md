---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components.json
  - app/globals.css
  - app/layout.tsx
  - lib/utils.ts
  - components/ui/button.tsx
  - components/amassa/logo.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/login/botao-entrar.tsx
  - tests/unit/tokens.test.ts
  - tests/e2e/design-system.spec.ts
  - scripts/testar-e2e.mjs
  - package.json
  - package-lock.json
autonomous: false
requirements: [UI-01, UI-09]
user_setup: []

estimate:
  tokens: 68000
  raw_tokens: 68000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "O botão 'Entrar' da tela de login resolve `background-color` para `rgb(137, 64, 37)` no navegador, nos dois projetos do Playwright (D-09, UI-01)"
    - "O `<body>` resolve `background-color` para `rgb(246, 243, 240)` e a família de fonte do corpo casa com `/Inter/` (D-10, UI-01)"
    - "O logo 'AMASSA' resolve `font-family` casando com `/Archivo_Narrow/` — o nome que o `next/font/google` gera, não a string com espaço (D-10, D-13)"
    - "`app/globals.css` traz as OITO variáveis `--color-sidebar-*` do mapeamento, mesmo sem nenhuma barra lateral existir ainda — é a armadilha de silêncio que D-08 e D-09 existem para barrar"
    - "O mapeamento `@theme inline` está escrito no arquivo ANTES de qualquer `shadcn add` ter rodado (D-08)"
    - "E9 login — vazio: o primeiro carregamento mostra os dois campos vazios com `required` no cliente; a reestilização não toca a mecânica (`app/(auth)/login/page.tsx`)"
    - "E9 login — carregando: `BotaoEntrar` continua usando `useFormStatus`; o rótulo vira 'Entrando…' com `disabled` e `aria-busy` enquanto a Server Action roda"
    - "E9 login — erro: as três mensagens de `mensagemDeErro` continuam em `role=\"alert\" aria-live=\"assertive\"`; só a cor muda para `text-destructive`"
    - "E9 login — parcial: só e-mail ou só senha continua barrado por `required` no cliente e devolvido pelo servidor com a mesma mensagem de credenciais inválidas, sem revelar qual campo faltou"
    - "E9 login — texto longo: e-mail longo rola dentro do próprio `input`, sem alargar o cartão de login"
    - "Todo campo de formulário do login tem fonte de no mínimo 16px e altura mínima de 44px (UI-09, CLAUDE.md)"
  artifacts:
    - components.json
    - app/globals.css
    - app/layout.tsx
    - components/ui/button.tsx
    - components/amassa/logo.tsx
    - tests/unit/tokens.test.ts
    - tests/e2e/design-system.spec.ts
  key_links:
    - "`@theme` (tokens crus) → `@theme inline` (nomes que o shadcn lê) → classe utilitária do componente → cor computada no navegador — se qualquer elo faltar, nada quebra e nada aparece no console"
    - "`next/font/google` em `app/layout.tsx` → variável CSS no `<body>` → `--font-sans`/`--font-titulo` no `@theme` → utilitário `font-titulo`"
    - "`scripts/testar-e2e.mjs` passa a repassar argumentos ao `playwright test`, o que permite às fases seguintes rodar um recorte da suíte"
  prohibitions:
    - statement: "Nenhuma aproximação da fonte Vinila Condensed é desenhada em curvas, e nenhum arquivo de fonte licenciada (`.woff`, `.woff2`, `.otf`, `.ttf`) é versionado neste repositório público (D-13, D-10, D-06 da 02a)"
    - statement: "Nenhuma asserção do teste de cor computada é afrouxada para passar — nada de comparação por substring genérica, regex permissiva sobre a cor ou `toBeTruthy()`. A prova de UI-01 é igualdade exata da string `rgb(...)`"
---

<objective>
Traçado ponta a ponta da identidade visual: token cru → mapeamento que o shadcn lê → componente
instalado → nossa composição → uma rota real → cor lida no navegador por teste automatizado.

É a fatia mais fina que atravessa todas as camadas que esta fase vai mexer, e prova justamente o
elo que falha em silêncio: sem o `@theme inline`, o build passa, o console fica limpo, e todo
componente sai com a paleta padrão do Tailwind.

Purpose: provar o mecanismo inteiro antes que qualquer outro plano instale mais componente ou
crie mais tela. Se o mapeamento estiver errado, descobrimos com um componente instalado, não
com sete.
Output: `components.json`, `app/globals.css` com os dois blocos `@theme`, as duas fontes no
`app/layout.tsx`, `components/ui/button.tsx`, `components/amassa/logo.tsx`, a tela de login
reestilizada (D-14) e as duas provas — `tests/unit/tokens.test.ts` e
`tests/e2e/design-system.spec.ts`.
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
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Tarefa 1: Portão de legitimidade dos pacotes npm desta fase</name>
  <what-built>Nada ainda. Este portão vem ANTES da primeira instalação. Não existe
  `## Package Legitimacy Audit` em nenhum RESEARCH.md desta fase (a pesquisa foi dispensada pelo
  dono), então a política de retorno vale: todo pacote entra como `[ASSUMED]` e precisa de
  conferência humana antes de ser instalado. Este portão nunca é aprovado automaticamente,
  mesmo com `auto_advance` ligado.</what-built>
  <how-to-verify>
Confira cada pacote abaixo em `npmjs.com/package/<nome>` — olhe o mantenedor, a data da última
publicação, o repositório vinculado e o volume de downloads semanais. A pergunta é uma só: este
é o pacote que eu acho que é, publicado por quem eu acho que publica?

Ferramenta de linha de comando (executada com `npx`, não instalada como dependência):

- `shadcn`

Dependências que o `shadcn init` e o `shadcn add button` trazem:

- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `tw-animate-css`
- `lucide-react`
- `@radix-ui/react-slot`

Os planos seguintes desta fase instalam mais pacotes do mesmo registro oficial do shadcn
(`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`,
`@radix-ui/react-tooltip`) e, no plano 05, `@axe-core/playwright` + `axe-core`. Cada um tem o
próprio portão no plano correspondente — este aqui cobre só a lista acima.

Nenhum registro de terceiros do shadcn é usado nesta fase (`02b-UI-SPEC.md` §"Registry Safety").
Se qualquer pacote da lista parecer suspeito — mantenedor desconhecido, publicado há poucos
dias, nome parecido com outro mais popular — pare e diga qual.
  </how-to-verify>
  <resume-signal>Digite "aprovado" para liberar a instalação, ou nomeie o pacote que não passou</resume-signal>
</task>

<task type="tracer">
  <name>Tarefa 2: A fatia inteira — tokens, mapeamento, fontes, um componente e a tela de login</name>
  <precondition>A máquina tem acesso à internet durante o `next build`: o `next/font/google` baixa Archivo Narrow e Inter em tempo de build. Sem rede, `npm run build` falha alto (nunca em silêncio).</precondition>
  <reversibility rating="costly">D-08 — inverter a ordem (instalar componente antes do mapeamento) obriga a revisar componente por componente depois. Não é irreversível, mas o custo de desfazer cresce a cada `shadcn add`.</reversibility>
  <files>components.json, app/globals.css, app/layout.tsx, lib/utils.ts, components/ui/button.tsx, components/amassa/logo.tsx, app/(auth)/login/page.tsx, app/(auth)/login/botao-entrar.tsx, package.json, package-lock.json</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seção "Design Tokens
      — CSS literal para `app/globals.css`" (o bloco a copiar sem alteração), "Typography",
      "Componente `Logo` (D-13)" e "Tela de Login — reestilizada (D-14)"
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §2 (linhas 28–144) — a fonte original dos tokens e o
      texto do passo obrigatório de ligação ao shadcn; §4 (linhas 175–203) — a escala tipográfica
      e o aviso do zoom do iOS abaixo de 16px
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md` — seções
      "`app/globals.css`", "`app/layout.tsx`", "`app/(auth)/login/page.tsx` (restyle only)" e
      "`app/(auth)/login/botao-entrar.tsx` (restyle only)": trazem o conteúdo atual dos arquivos e
      a lista do que NÃO pode ser tocado
    - `app/globals.css` — o arquivo de uma linha que será substituído
    - `app/layout.tsx` — o esqueleto atual, a preservar em forma
    - `app/(auth)/login/page.tsx` e `app/(auth)/login/botao-entrar.tsx` — a mecânica a preservar
    - `tests/e2e/autenticacao.spec.ts` e `tests/e2e/fundacao.spec.ts` — as asserções existentes que
      dependem do login (`getByLabel("E-mail")`, `getByLabel("Senha")`,
      `getByRole("button", { name: "Entrar" })`, `page.locator("form").getByRole("alert")`,
      `getByRole("heading", { name: "AMASSA" })` em `/login`)
  </read_first>
  <action>
Ordem obrigatória, e ela importa: `shadcn init` PRIMEIRO, tokens DEPOIS, `shadcn add` POR ÚLTIMO.
O `init` escreve conteúdo próprio em `app/globals.css`; escrever os tokens antes dele significa
perdê-los. D-08 fala do `add`, não do `init`.

**1. Inicializar o shadcn.** Rode `npx shadcn@latest init` com: TypeScript sim, estilo
`new-york`, cor base `neutral` (irrelevante — todo token é sobrescrito no passo 2), variáveis CSS
sim, alias `@/components` e `@/lib/utils`. Isso cria `components.json`, `lib/utils.ts` com `cn()`
e instala `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` e `lucide-react`.
Depois de instalar, fixe TODA dependência nova em `package.json` na versão exata resolvida — sem
`^` e sem `~` — e rode `npm install` de novo para o `package-lock.json` refletir isso.
`lib/utils.ts` e `components/ui/` são território do shadcn (D-11): não edite à mão.

**2. Reescrever `app/globals.css` do zero.** Substitua integralmente o que o `init` deixou. O
arquivo final tem, nesta ordem: `@import "tailwindcss";`, `@import "tw-animate-css";`, o bloco
`@theme { ... }` copiado LITERALMENTE da seção "Design Tokens" do `02b-UI-SPEC.md` (todas as
superfícies, linhas, texto, ação, as cores marcadas "NÃO ALTERAR" de etapa/modalidade/tipo de
queima/nível de forno, as semânticas e os quatro `--radius-*`), o bloco `@theme inline { ... }`
igualmente literal — inclusive as OITO variáveis `--color-sidebar-*`, que são o ponto exato onde
esta fase falha em silêncio — e um `@layer base` com `* { @apply border-border outline-ring/50; }`
e `body { @apply bg-background text-foreground; }`. Nenhuma variável de cor gerada pelo `init`
sobrevive no arquivo, e nenhum comentário do arquivo cita valor de cor descartado.

Acrescente ao bloco `@theme` (não vêm do §2, que só cobre cor e raio — são o que torna a §4
utilizável no Tailwind v4):

- `--font-sans: var(--fonte-inter), ui-sans-serif, system-ui, sans-serif;`
- `--font-titulo: var(--fonte-archivo), ui-sans-serif, system-ui, sans-serif;`
- a escala tipográfica no namespace `--text-*`, com os modificadores `--line-height` e
  `--font-weight` do Tailwind v4: `display` 28px/32px/700, `titulo` 20px/28px/600, `corpo`
  16px/24px/400, `apoio` 14px/20px/400, `micro` 12px/16px/500 com
  `--text-micro--letter-spacing: 0.06em`, `mono` 13px/18px/400.
- `--text-nav: 12px` com `--text-nav--line-height: 16px` e `--text-nav--font-weight: 500`, SEM
  letter-spacing — é a exceção tipográfica dos rótulos de navegação registrada no
  `02b-UI-SPEC.md` ("Typography", parágrafo da exceção). Os planos 02 e 03 consomem `text-nav`.

**3. Fontes em `app/layout.tsx`.** Importe `Inter` e `Archivo_Narrow` de `next/font/google`
(D-10). `Inter`: `subsets: ["latin"]`, `weight: ["400", "500"]`, `variable: "--fonte-inter"`,
`display: "swap"`. `Archivo_Narrow`: `subsets: ["latin"]`, `weight: ["600", "700"]`,
`variable: "--fonte-archivo"`, `display: "swap"`. Ponha as duas classes `.variable` no `<body>`
junto de `font-sans antialiased`. Preserve `lang="pt-BR"` e o export `metadata` como estão. Não
use `<link>` para CDN e não versione nenhum arquivo de fonte.

**4. Instalar o primeiro componente.** Só agora: `npx shadcn@latest add button`. Isso cria
`components/ui/button.tsx` e traz `@radix-ui/react-slot`. Fixe a versão exata dele também.
Confira que `app/globals.css` não foi tocado pelo comando — se o `git diff` do arquivo não vier
vazio, o `add` mexeu nele e é preciso restaurar o conteúdo do passo 2.

**5. `components/amassa/logo.tsx`** (D-13, D-11 — código nosso). Componente de servidor, sem
`"use client"`. Renderiza a palavra `AMASSA` com `font-titulo`, peso 700, cor `text-foreground`.
Assinatura: `type LogoProps = { como?: "h1" | "span"; className?: string }`, padrão `"span"`.
O elemento renderizado é `h1` quando `como === "h1"`. Esse detalhe é carga: a asserção
`getByRole("heading", { name: "AMASSA" })` em `/login` de `tests/e2e/fundacao.spec.ts` continua
válida só porque a tela de login usa `como="h1"`. Deixe no arquivo um comentário curto dizendo
onde o SVG da Vinila será encaixado quando o dono exportar — sem desenhar aproximação nenhuma.

**6. Reestilizar `app/(auth)/login/page.tsx`** (D-14) — só aparência. NÃO toque em:
`mensagemDeErro()` e seus três ramos, `<form action={entrar}>`, o par
`role="alert" aria-live="assertive"` no parágrafo da mensagem, os `name="email"` / `name="senha"`,
os `required`, os `autoComplete`, `<BotaoEntrar />`, nem os textos dos rótulos "E-mail" e "Senha"
(há testes amarrados a todos eles). O que muda: `<main>` perde os valores de cor escritos à mão e
passa a usar as classes de token (`bg-background`, `text-foreground`); o `<h1>AMASSA</h1>` dá
lugar a `<Logo como="h1" />`; o conteúdo do formulário vai para dentro de um `Card` do shadcn com
`rounded-xl` e sombra leve sobre `bg-card`; a borda dos `input` passa a `border-input`; os campos
mantêm `text-corpo` (16px) e `min-h-[44px]`, com anel de foco em `--color-ring`; e o parágrafo da
mensagem passa a usar `text-destructive` no lugar da classe utilitária vermelha genérica do
Tailwind que está lá hoje. A `FRASE_NO_AR` continua logo abaixo do logo.

Observação: `Card` ainda não está instalado nesta fase. Se preferir não antecipar o `shadcn add
card` (que é do plano 02), monte o cartão de login com um `<div>` usando `bg-card border-border
rounded-xl` — o resultado visual e a prova de cor são os mesmos, e o plano 02 pode trocar depois.
Escolha um dos dois e registre a escolha no SUMMARY.

**7. Reestilizar `app/(auth)/login/botao-entrar.tsx`** — só o `className`/componente. Mantenha
`"use client"`, `useFormStatus`, `type="submit"`, `disabled={pending}`, `aria-busy={pending}` e
exatamente os rótulos `"Entrando…"` e `"Entrar"`. Troque o botão cru pelo `Button` do shadcn com
`variant="default"` e `className` garantindo `min-h-[44px]` e largura total. É este botão que a
prova de UI-01 vai medir.
  </action>
  <verify>
    <automated>npm run lint && npx tsc --noEmit && npm run verificar-acoes && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `components.json` existe na raiz e declara os aliases `@/components` e `@/lib/utils`
    - `grep -c '@theme' app/globals.css` retorna 2 (um `@theme {` e um `@theme inline {`)
    - `grep -ci oklch app/globals.css` retorna 0
    - `grep -c '8A7A70' app/globals.css` retorna 0
    - `app/globals.css` contém `--color-acento: #894025;`
    - `app/globals.css` contém `--color-fundo: #F6F3F0;`
    - `app/globals.css` contém `--color-tinta-fraca: #6E5F56;`
    - `app/globals.css` contém `--radius-xl: 18px;`
    - `app/globals.css` contém `--color-primary: var(--color-acento);`
    - `grep -c -- '--color-sidebar' app/globals.css` retorna 8 ou mais, e as oito chaves
      `--color-sidebar`, `--color-sidebar-foreground`, `--color-sidebar-primary`,
      `--color-sidebar-primary-foreground`, `--color-sidebar-accent`,
      `--color-sidebar-accent-foreground`, `--color-sidebar-border` e `--color-sidebar-ring`
      aparecem cada uma pelo menos uma vez
    - `app/globals.css` contém `--font-titulo:` e `--text-display:` e `--text-nav:`
    - `app/layout.tsx` contém `next/font/google`, `Archivo_Narrow`, `Inter`, `--fonte-inter` e
      `--fonte-archivo`, e o `<html>` continua com `lang="pt-BR"`
    - `components/ui/button.tsx` existe; `components/amassa/logo.tsx` exporta `Logo`
    - `app/(auth)/login/page.tsx` contém `<Logo como="h1"` e contém `role="alert"` e
      `aria-live="assertive"`
    - `grep -c 'text-red-700' 'app/(auth)/login/page.tsx'` retorna 0
    - `app/(auth)/login/botao-entrar.tsx` contém `useFormStatus`, `aria-busy={pending}` e
      `"Entrando…"`
    - `git diff --exit-code lib/auth/ middleware.ts` retorna 0 — nenhum arquivo de autenticação
      foi tocado pela reestilização
    - `git ls-files '*.woff' '*.woff2' '*.otf' '*.ttf'` não devolve nenhuma linha
    - Nenhuma dependência nova em `package.json` começa com `^` ou `~`
    - `npm run lint` sai com 0; `npx tsc --noEmit` sai com 0; `npm run verificar-acoes` sai com 0;
      `npm run build` sai com 0
  </acceptance_criteria>
  <done>O shadcn está inicializado, os tokens e o mapeamento completo estão no `app/globals.css`,
  as duas fontes carregam pelo próprio domínio, o `Button` está instalado e a tela de login já
  está com a identidade do AMASSA — sem que nenhum arquivo de autenticação tenha sido tocado.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: As duas provas — o mapeamento no arquivo e a cor no navegador</name>
  <precondition>O Docker está rodando: `scripts/testar-e2e.mjs` sobe o Postgres de teste em contêiner antes do Playwright. `docker info` responde sem erro.</precondition>
  <files>tests/unit/tokens.test.ts, tests/e2e/design-system.spec.ts, scripts/testar-e2e.mjs</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seção "Prova
      automatizada de UI-01 (D-09)", com os quatro passos do teste
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md` — seção
      "`tests/e2e/*.spec.ts`": o padrão de asserção por cor computada e a convenção
      `getByRole` com nome acessível
    - `tests/e2e/autenticacao.spec.ts` — a forma dos imports, do `test.describe` e o motivo de
      escopar `getByRole("alert")` ao `<form>`
    - `tests/unit/rotas-publicas.test.ts` — a forma de um teste de unidade neste projeto
    - `scripts/testar-e2e.mjs` — a chamada `rodarNpm("npx", ["playwright", "test"])` que passa a
      repassar argumentos
    - `app/globals.css` — o arquivo que o teste de unidade vai ler
  </read_first>
  <behavior>
    - `tests/unit/tokens.test.ts` lê `app/globals.css` como texto e falha se faltar qualquer uma
      das oito chaves `--color-sidebar-*` do mapeamento
    - falha se `--color-primary` não apontar para `var(--color-acento)`
    - falha se `--color-acento` não for `#894025`, `--color-fundo` não for `#F6F3F0` ou
      `--color-tinta-fraca` não for `#6E5F56`
    - falha se faltar `--radius-xl: 18px`
    - falha se qualquer uma das quinze cores marcadas "NÃO ALTERAR" (6 de etapa, 3 de modalidade,
      3 de tipo de queima, 3 níveis de forno com seus fundos e textos) estiver ausente
    - `tests/e2e/design-system.spec.ts`, em `/login`, nos dois projetos: o botão "Entrar" resolve
      `background-color` exatamente para `rgb(137, 64, 37)`
    - o `<body>` resolve `background-color` exatamente para `rgb(246, 243, 240)`
    - o cabeçalho "AMASSA" resolve `font-family` casando com `/Archivo_Narrow/`
    - o `<body>` resolve `font-family` casando com `/Inter/`
  </behavior>
  <action>
Escreva os testes antes de conferir que passam, e rode-os uma vez com uma linha do
`app/globals.css` propositalmente comentada para ver o teste de unidade FALHAR — um portão que
nunca foi visto falhando é indistinguível de um portão quebrado. Restaure a linha depois.

`tests/unit/tokens.test.ts`: usa `readFileSync` sobre `app/globals.css` e afirma presença de cada
token pelo texto. Não é teste de "configuração por configurar" — é o único guarda contra a falha
que não quebra build nem aparece no console. Escreva as chaves esperadas como um array e itere,
para o relatório dizer QUAL faltou.

`tests/e2e/design-system.spec.ts`: mesma forma de `tests/e2e/autenticacao.spec.ts`. Roda em
`/login`, que é rota pública — não precisa de sessão. Leia o estilo com
`elemento.evaluate((el) => getComputedStyle(el).backgroundColor)` e compare com `toBe` e a string
exata. Para a fonte, atenção ao detalhe que custa uma hora: o `next/font/google` NÃO deixa a
família com o nome legível; ele gera um nome como `__Archivo_Narrow_<hash>`. A asserção correta é
`expect(familia).toMatch(/Archivo_Narrow/)` (sublinhado), nunca uma comparação com o nome
separado por espaço.

`scripts/testar-e2e.mjs`: troque `rodarNpm("npx", ["playwright", "test"])` por uma chamada que
repassa `process.argv.slice(2)` ao Playwright, para que `npm run test:e2e -- --grep "..."` funcione.
É o que permite aos planos seguintes rodar um recorte da suíte em vez da corrida inteira. Mantenha
todo o resto do script intacto — a subida do Postgres efêmero, a migração e a derrubada no
`finally`.
  </action>
  <verify>
    <automated>npm test && npm run test:e2e -- --grep "design system"</automated>
  </verify>
  <acceptance_criteria>
    - `npm test` sai com 0 e o relatório inclui os casos de `tests/unit/tokens.test.ts`
    - `npm run test:e2e -- --grep "design system"` sai com 0 e executa nos projetos `desktop` e
      `celular` (o relatório `list` mostra os dois)
    - `tests/e2e/design-system.spec.ts` contém a string literal `rgb(137, 64, 37)` e a string
      literal `rgb(246, 243, 240)`
    - `tests/e2e/design-system.spec.ts` contém `Archivo_Narrow` com sublinhado
    - `grep -c 'toBeTruthy\|toContain("rgb")' tests/e2e/design-system.spec.ts` retorna 0
    - `scripts/testar-e2e.mjs` contém `process.argv.slice(2)`
    - `npm run test:e2e` (sem recorte) sai com 0 — a suíte antiga continua passando inteira
  </acceptance_criteria>
  <done>UI-01 tem prova de máquina em duas alturas: o arquivo (unidade, rápida, roda em todo
  `npm test`) e o navegador (e2e, nos dois tamanhos de tela). Instalar um componente sem o
  mapeamento passa a quebrar o portão em vez de passar despercebido.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador anônimo → `/login` | única rota pública com formulário; entrada não confiável atravessa aqui |
| registro npm → repositório | código de terceiro entra na árvore do projeto via `shadcn init`/`add` |
| rede pública → `next build` | o `next/font/google` baixa arquivos de fonte durante o build |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02b-04 | Information Disclosure | `app/(auth)/login/page.tsx` | high | mitigate | A reestilização troca só `className` e o elemento do logo. `mensagemDeErro()`, os três ramos e o par `role="alert" aria-live="assertive"` não são tocados; `tests/e2e/autenticacao.spec.ts` (igualdade exata de string entre senha errada e e-mail inexistente) roda sem edição e precisa continuar passando |
| T-02b-05 | Denial of Service | `app/(auth)/login/botao-entrar.tsx` | medium | mitigate | O botão continua `type="submit"` com `disabled={pending}`; nenhum caminho novo de reenvio é criado, e a mensagem de bloqueio por tentativas continua exibida pelo mesmo alerta |
| T-02b-06-SC | Tampering | instalações npm (`shadcn`, Radix, `lucide-react`) | high | mitigate | Checkpoint humano bloqueante (Tarefa 1) antes da primeira instalação; versões fixadas sem `^`/`~`; `package-lock.json` versionado; nenhum registro de terceiros do shadcn |
| T-02b-07 | Tampering | `components/ui/*` gerado pelo shadcn | medium | accept | Código de terceiro copiado para dentro do repositório, auditável em diff no PR; D-11 proíbe edição manual. Aceito: é o modelo do shadcn, e o diff é a revisão |
| T-02b-08 | Information Disclosure | `next/font/google` no `next build` | low | accept | O download acontece só no build (GitHub Actions / estágio `construtor` do Dockerfile), nunca no navegador de quem usa — nenhum IP de usuário do ateliê chega ao Google. Aceito: a dependência de rede em tempo de build falha alto, o build quebra |
</threat_model>

<verification>
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes`, `npm test`, `npm run build` e
  `npm run test:e2e` saem todos com 0.
- `git diff --exit-code lib/auth/ middleware.ts` retorna 0.
- A suíte e2e anterior (`fundacao`, `autenticacao`, `sessao`, `backup`) passa sem nenhuma edição.
</verification>

<success_criteria>
Um `shadcn add` feito sem o mapeamento passa a ser barrado por teste, e a tela de login já é a
tela do AMASSA — cor terracota no botão, fundo areia, Archivo Narrow no logo, Inter no corpo,
tudo lido do navegador por asserção exata, nos dois tamanhos de tela.
</success_criteria>

<output>
Create `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-01-SUMMARY.md` when done
</output>

## Artefatos que este plano produz

**Arquivos novos:** `components.json`, `lib/utils.ts` (gerado pelo shadcn, com `cn()`),
`components/ui/button.tsx`, `components/amassa/logo.tsx`, `tests/unit/tokens.test.ts`,
`tests/e2e/design-system.spec.ts`.

**Arquivos modificados:** `app/globals.css` (reescrito), `app/layout.tsx`,
`app/(auth)/login/page.tsx`, `app/(auth)/login/botao-entrar.tsx`, `scripts/testar-e2e.mjs`,
`package.json`, `package-lock.json`.

**Símbolos exportados:** `Logo` (`components/amassa/logo.tsx`), com
`type LogoProps = { como?: "h1" | "span"; className?: string }`; `Button` e `buttonVariants`
(`components/ui/button.tsx`, gerados); `cn` (`lib/utils.ts`, gerado).

**Propriedades CSS novas em `app/globals.css`:** bloco `@theme` — `--color-fundo`,
`--color-superficie`, `--color-superficie-2`, `--color-borda`, `--color-borda-forte`,
`--color-tinta`, `--color-tinta-media`, `--color-tinta-fraca`, `--color-acento`,
`--color-acento-hover`, `--color-acento-fundo`, `--color-destaque`, `--color-producao`,
`--color-secagem`, `--color-queima1`, `--color-esmaltacao`, `--color-queima2`, `--color-entrega`,
`--color-modelagem`, `--color-torno`, `--color-pintura`, `--color-biscoito`, `--color-esmalte`,
`--color-ouro`, `--color-forno-ok`, `--color-forno-ok-fundo`, `--color-forno-ok-texto`,
`--color-forno-atencao`, `--color-forno-atencao-fundo`, `--color-forno-atencao-texto`,
`--color-forno-critico`, `--color-forno-critico-fundo`, `--color-forno-critico-texto`,
`--color-sucesso`, `--color-sucesso-fundo`, `--color-atencao`, `--color-atencao-fundo`,
`--color-erro`, `--color-erro-fundo`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`,
`--font-sans`, `--font-titulo`, `--text-display`, `--text-titulo`, `--text-corpo`, `--text-apoio`,
`--text-micro`, `--text-mono`, `--text-nav`; bloco `@theme inline` — `--color-background`,
`--color-foreground`, `--color-card`, `--color-card-foreground`, `--color-popover`,
`--color-popover-foreground`, `--color-primary`, `--color-primary-foreground`,
`--color-secondary`, `--color-secondary-foreground`, `--color-muted`, `--color-muted-foreground`,
`--color-accent`, `--color-accent-foreground`, `--color-destructive`,
`--color-destructive-foreground`, `--color-border`, `--color-input`, `--color-ring`,
`--color-sidebar`, `--color-sidebar-foreground`, `--color-sidebar-primary`,
`--color-sidebar-primary-foreground`, `--color-sidebar-accent`,
`--color-sidebar-accent-foreground`, `--color-sidebar-border`, `--color-sidebar-ring`.

**Rotas novas:** nenhuma (a tela de login já existia).

**Scripts npm novos:** nenhum — `npm run test:e2e` passa a aceitar argumentos repassados
(`npm run test:e2e -- --grep "..."`).

---

## Auditoria de cobertura das fontes (vale para o conjunto dos cinco planos)

Nenhum item de fonte fica sem plano. RESEARCH.md não existe nesta fase (pesquisa dispensada pelo
dono, decisões já travadas em CONTEXT.md e UI-SPEC.md) — a coluna RESEARCH não se aplica.

**GOAL (ROADMAP, Fase 2b)** — "Navegar por telas vazias de todos os módulos já com a identidade
visual do AMASSA aplicada, no celular e no desktop."

| Item | Plano | Status |
|------|-------|--------|
| Critério 1 — cores e fontes do AMASSA em todo componente shadcn instalado | 01, 02 | COBERTO |
| Critério 2 — 5 itens no celular, 240px + menu no desktop, Orçamentos só no menu | 02, 03 | COBERTO |
| Critério 3 — navegação confortável com o polegar, nenhuma rolagem horizontal | 03, 05 | COBERTO |
| Critério 4 — vazio com frase e botão, carregamento com esqueleto, erro humano, remoção com confirmação | 03, 04 | COBERTO |
| Critério 5 — 44px, contraste AA, teclado, `aria-label` em botão só com ícone | 02, 05 | COBERTO |

**REQ (REQUIREMENTS.md §"Casca e Design System")**

| ID | Plano(s) | Status |
|----|----------|--------|
| UI-01 | 01, 02 | COBERTO |
| UI-02 | 02, 03 | COBERTO |
| UI-03 | 02 | COBERTO |
| UI-04 | 02, 03 | COBERTO |
| UI-05 | 02, 05 | COBERTO |
| UI-06 | 03, 05 | COBERTO |
| UI-07 | 03, 04 | COBERTO |
| UI-08 | 04 | COBERTO (como convenção escrita — D-07 adia a implementação para a Fase 3) |
| UI-09 | 02, 05 | COBERTO |

UI-10 e UI-11 pertencem à Fase 7 (exclusão declarada no ROADMAP) — não são lacuna.

**CONTEXT (D-01 a D-16, decisões travadas)**

| Decisão | Plano | Status |
|---------|-------|--------|
| D-01 cabeçalho + vazio + botão inerte por tela | 03 | COBERTO |
| D-02 painel com os quatro cartões nomeados | 03 | COBERTO |
| D-03 esqueleto não é espaço reservado permanente | 04 | COBERTO |
| D-04 `/orcamentos` como rota real "por vir" | 03 | COBERTO |
| D-05 só a frase de Encomendas vem pronta | 03 (escrita), 05 (revisão do dono) | COBERTO |
| D-06 instalar só os sete componentes | 01 (button), 02 (os seis) | COBERTO |
| D-07 sem `alert-dialog`/`sonner`; UI-08 como convenção | 04 | COBERTO |
| D-08 mapeamento antes de qualquer `shadcn add`, com as oito `--color-sidebar-*` | 01 | COBERTO |
| D-09 UI-01 provado por cor computada no navegador | 01 | COBERTO |
| D-10 Archivo Narrow e Inter por `next/font/google` | 01 | COBERTO |
| D-11 fronteira `components/ui/` × `components/amassa/` | 01, 02, 04 (documentada) | COBERTO |
| D-12 barra lateral fixa em 240px, sem recolher | 02 | COBERTO |
| D-13 `Logo` como componente, sem desenhar a Vinila | 01 | COBERTO |
| D-14 login e página de erro reestilizados | 01 (login), 04 (erro) | COBERTO |
| D-15 menu do usuário com nome, Orçamentos e Sair; avatar no celular | 02 | COBERTO |
| D-16 rota provisória substituída pelo painel real | 02 (move o Sair), 03 (substitui) | COBERTO |

**Ideias adiadas (não são lacuna, por decisão registrada):** barra lateral recolhível, página de
amostra `/estilo`, `alert-dialog` e `sonner`, `--color-chart-1` a `--color-chart-5`, logo em SVG
da Vinila, favicon e ícones de aplicação, kit shadcn completo.

---

## Suposições sinalizadas (sonda determinística de bordas, fase sem SPEC)

A sonda determinística de bordas rodou sobre UI-01..UI-09 e devolveu 12 linhas. Cinco viraram
critério verificável e estão em `must_haves.truths` dos planos indicados; sete ficaram
`unclassified` e permanecem **unresolved** — registradas aqui, nunca convertidas em silêncio.
Equação sem perda: 12 linhas = 5 autoradas + 7 sinalizadas.

**Autoradas como truths:**

| Linha | Categoria | Onde virou truth |
|-------|-----------|------------------|
| UI-02 | adjacency | plano 02 — `ehItemAtivo` com raiz por igualdade exata e prefixo com barra |
| UI-02 | empty | plano 02 — caminho vazio não acende item nenhum |
| UI-02 | ordering | plano 02 — exatamente um item ativo, na ordem do array |
| UI-09 | empty | plano 05 — nenhum interativo sem nome acessível; o avatar responde pelo `aria-label` |
| UI-09 | encoding | plano 05 (e 03) — asserções importam `ITENS_NAVEGACAO` em vez de redigitar acento |

**Sinalizadas como suposição, sem resolução automática (7):** UI-01, UI-03, UI-04, UI-05, UI-06,
UI-07 e UI-08 voltaram `unclassified` — a sonda raciocina sobre valor e limite numérico, e estes
sete requisitos são afirmações de interface (cor e fonte aplicadas, largura de barra lateral,
onde um item de menu aparece, conforto do polegar, ausência de rolagem lateral, presença de três
estados por tela, texto de confirmação de exclusão). Não existe borda de valor a extrair deles, e
inventar uma seria pior do que registrar a ausência. **A suposição do planejador é que a
verificação correta desses sete é comportamental, não de fronteira de valor** — e é assim que
eles foram planejados: cor computada lida do navegador (UI-01), `boundingBox()` de 240px (UI-03),
ausência do rótulo na barra e presença no menu (UI-04), conferência humana no celular (UI-05),
`scrollWidth` a 320px (UI-06), presença dos três componentes de estado em cada tela (UI-07) e
documento de convenção com o formato literal (UI-08). Se o dono discordar dessa leitura em algum
dos sete, é aqui que se discute.
