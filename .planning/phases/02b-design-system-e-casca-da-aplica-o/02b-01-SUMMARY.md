---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 01
subsystem: ui
tags: [tailwindcss-v4, shadcn, radix-ui, next-font, design-tokens, playwright, vitest]

# Dependency graph
requires:
  - phase: 02a-login-banco-base-e-backup
    provides: "tela de login mínima (mensagemDeErro, form action=entrar, role=alert
      aria-live=assertive, BotaoEntrar com useFormStatus) — a mecânica que este plano
      reestiliza sem tocar"
provides:
  - "app/globals.css com os tokens literais de 04-DESIGN-SYSTEM.md §2 e o mapeamento @theme
    inline completo (incluindo as oito --color-sidebar-*), mais a escala tipográfica e as
    famílias de fonte no namespace --font-*/--text-* — a base que os planos 02-05 desta fase
    consomem sem editar este arquivo de novo"
  - "shadcn/ui inicializado (components.json, lib/utils.ts) com dependências fixadas em versão
    exata, prontas para os próximos `shadcn add`"
  - "components/amassa/logo.tsx (Logo) e components/ui/button.tsx — os dois primeiros
    componentes da fronteira D-11"
  - "tela de login com a identidade visual do AMASSA"
  - "tests/unit/tokens.test.ts e tests/e2e/design-system.spec.ts — o portão de máquina contra a
    armadilha de silêncio de D-08/D-09, que qualquer `shadcn add` futuro sem mapeamento
    completo vai quebrar"
  - "scripts/testar-e2e.mjs repassando argumentos ao Playwright (`npm run test:e2e -- --grep
    ...`) para os planos seguintes rodarem recortes da suíte"
affects: [02b-02, 02b-03, 02b-04, 02b-05]

# Actuals (#2632)
actuals:
  tokens: 7900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added:
    - "shadcn/ui (CLI usada via npx, não instalada como dependência)"
    - "radix-ui@1.6.7 (pacote unificado — sucessor de @radix-ui/react-slot no registro atual do shadcn)"
    - "lucide-react@1.28.0"
    - "class-variance-authority@0.7.1"
    - "clsx@2.1.1"
    - "tailwind-merge@3.6.0"
    - "tw-animate-css@1.4.0"
  patterns:
    - "@theme (tokens crus, hex literais) seguido de @theme inline (mapeamento que o shadcn lê)
      em app/globals.css, sempre nesta ordem e sempre antes de qualquer `shadcn add` (D-08)"
    - "components/ui/ é território do shadcn (nunca editado à mão); components/amassa/ é código
      nosso (D-11)"
    - "next/font/google com a opção `variable` (não `.className`) para injetar a fonte como CSS
      custom property consumida pelo @theme — ver 'Decisões' abaixo para a armadilha que isso
      teve"
    - "Teste de unidade lendo um arquivo de configuração como texto plano (node:fs, não import
      de módulo) para provar presença de tokens que nenhum erro de build ou de console
      denunciaria se faltassem"

key-files:
  created:
    - components.json
    - lib/utils.ts
    - components/ui/button.tsx
    - components/amassa/logo.tsx
    - tests/unit/tokens.test.ts
    - tests/e2e/design-system.spec.ts
  modified:
    - app/globals.css
    - app/layout.tsx
    - "app/(auth)/login/page.tsx"
    - "app/(auth)/login/botao-entrar.tsx"
    - scripts/testar-e2e.mjs
    - package.json
    - package-lock.json

key-decisions:
  - "Card do shadcn NÃO foi instalado neste plano (chega no plano 02, D-06) — o cartão de login
    usa um <div> com bg-card/border-border/rounded-xl, que resolve para os mesmos tokens e a
    mesma prova de cor; o plano 02 pode trocar pelo componente depois sem mudar nada
    visualmente."
  - "shadcn CLI fixada em 3.8.5 (não '@latest' literal) para os comandos `init`/`add button` —
    a versão mais recente (4.x) teria como padrão o preset 'Nova', que instala @base-ui/react
    em vez de primitivas Radix, contrariando o 'Component library: Radix UI' declarado no
    02b-UI-SPEC.md e a lista literalmente auditada no portão de legitimidade da Tarefa 1. A
    3.8.5 ainda resolve os componentes contra o mesmo registro ao vivo do shadcn (ver desvio
    sobre radix-ui abaixo), mas preserva os aliases @/components e @/lib/utils do plano."
  - "next/font/google usa a opção `variable` (CSS custom property), não `.className` direto —
    é o padrão que D-10 pede e o único que permite ao @theme consumir a fonte via
    var(--fonte-inter)/var(--fonte-archivo)."
  - "Asserção de fonte no e2e usa o nome medido no navegador ('Archivo Narrow', com espaço,
    ancorado no início da lista com /^\"?Archivo Narrow\"?,/) em vez do nome com sublinhado que
    o texto original da Tarefa 3 do plano presumia — ver Deviations."

patterns-established:
  - "Âncora de início de string em asserção de font-family (/^\"?Nome\"?,/) em vez de
    toMatch/toContain solto — exige que a família real venha primeiro na pilha, não só em
    algum lugar dela."
  - "Regex tolerante a espaço em branco (`\\s*`) ao testar tokens CSS alinhados por
    espaçamento visual, em vez de comparação de substring exata com um único espaço."

requirements-completed: [UI-01, UI-09]

coverage:
  - id: D1
    description: "app/globals.css traz os tokens literais de 04-DESIGN-SYSTEM.md §2 e o
      mapeamento @theme inline completo, incluindo as oito --color-sidebar-*"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "tests/unit/tokens.test.ts — 56 casos, RED provado comentando uma linha e
          restaurando (ver Deviations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O botão 'Entrar' e o <body> da tela de login resolvem as cores exatas do
      design system no navegador, nos dois tamanhos de tela"
    requirement: "UI-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/design-system.spec.ts — 'botão Entrar resolve para o terracota' e 'o
          body resolve para o fundo areia', projetos desktop e celular"
        status: pass
    human_judgment: false
  - id: D3
    description: "O título 'AMASSA' usa Archivo Narrow e o corpo usa Inter, medido por
      font-family computada"
    requirement: "UI-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/design-system.spec.ts — 'o título AMASSA usa Archivo Narrow, e o corpo
          usa Inter', projetos desktop e celular"
        status: pass
    human_judgment: false
  - id: D4
    description: "Campos de login com fonte mínima de 16px e alvo de toque mínimo de 44px
      (UI-09)"
    requirement: "UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/design-system.spec.ts — 'os campos de login têm fonte de pelo menos
          16px e altura mínima de 44px'"
        status: pass
    human_judgment: false
  - id: D5
    description: "A tela de login está visualmente com a identidade do AMASSA (fundo areia,
      cartão elevado, logo em Archivo Narrow, botão terracota) — conferência visual real, não
      só medição de propriedades isoladas"
    verification:
      - kind: manual_procedural
        ref: "Portão de retorno do tracer (checkpoint interativo) — o coordenador mediu
          diretamente no DOM da página servida em http://localhost:3000/login (não a olho) e
          encontrou um bug real na primeira rodada (fontes não aplicadas); confirmou a
          correção na segunda rodada"
        status: pass
    human_judgment: true
    rationale: "A prova de cor/fonte isoladas já está automatizada (D1-D4); a composição visual
      do conjunto (cartão elevado, hierarquia, sombra) e a legitimidade dos pacotes npm exigem
      julgamento humano, que já ocorreu nos dois checkpoints desta execução."

# Metrics
duration: ~55min (inclui três rodadas de checkpoint humano — portão de pacotes, portão de
  retorno do tracer reprovado uma vez e reaprovado)
completed: 2026-08-08
status: complete
---

# Phase 2b Plan 01: Tracer da Identidade Visual Summary

**Tracer de ponta a ponta prova o mecanismo inteiro do design system — token cru em
`app/globals.css` → mapeamento `@theme inline` → `Button`/`Logo` → tela de login → cor e fonte
computadas no navegador, nos dois tamanhos de tela — antes de qualquer outro plano instalar mais
componente ou criar mais tela.**

## Performance

- **Duration:** ~55 min de execução, incluindo três checkpoints humanos (portão de pacotes,
  portão de retorno do tracer reprovado e depois aprovado)
- **Completed:** 2026-08-08
- **Tasks:** 3 (1 checkpoint de portão + 1 tracer com portão de retorno + 1 TDD)
- **Files modified:** 12 (6 criados, 6 modificados) + `package-lock.json`

## Accomplishments

- `app/globals.css` reescrito do zero com os dois blocos `@theme`/`@theme inline` literais,
  incluindo as oito `--color-sidebar-*` e a escala tipográfica completa (`--text-display` a
  `--text-nav`)
- `shadcn/ui` inicializado com dependências fixadas em versão exata, após dois portões de
  legitimidade humana (um antes da instalação, outro depois de descobrir que o registro atual
  do shadcn resolve pacotes diferentes dos nominalmente aprovados)
- `Button` (shadcn) e `Logo` (código nosso, D-13) instalados/criados; tela de login
  reestilizada com a identidade do AMASSA sem tocar em nenhum arquivo de autenticação
- Duas provas de máquina para UI-01: `tests/unit/tokens.test.ts` (56 casos, arquivo) e
  `tests/e2e/design-system.spec.ts` (8 casos × 2 projetos, navegador)
- Um bug real de silêncio encontrado e corrigido no portão de retorno do tracer: variáveis de
  fonte no `<body>` eram invisíveis ao `@theme` (que resolve no `:root`) — ver Decisões

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Portão de legitimidade dos pacotes npm** — checkpoint humano, aprovado duas
   vezes (lista inicial, depois lista corrigida após o registro do shadcn ter mudado). Sem
   commit próprio.
2. **Tarefa 2: A fatia inteira — tokens, mapeamento, fontes, Button e login** — `08d299e` (feat)
   + `dbe2302` (fix, achado no portão de retorno do tracer)
3. **Tarefa 3: As duas provas — unidade e e2e** — `50055e4` (test)

**Plan metadata:** commit deste SUMMARY (a seguir)

## Files Created/Modified

- `app/globals.css` — reescrito do zero: tokens literais + mapeamento `@theme inline` completo
  + escala tipográfica + `@layer base`
- `app/layout.tsx` — as duas fontes via `next/font/google`, classes `.variable` no `<html>`
- `components.json`, `lib/utils.ts` — gerados pelo `shadcn init`
- `components/ui/button.tsx` — gerado pelo `shadcn add button`
- `components/amassa/logo.tsx` — `Logo` (D-13), texto "AMASSA" em `font-titulo`, sem
  aproximação da Vinila Condensed
- `app/(auth)/login/page.tsx` — reestilizado (D-14): fundo/texto por token, `Logo`, cartão
  `bg-card`/`border-border`/`rounded-xl`, campos com `border-input`/`text-corpo`, mensagem de
  erro em `text-destructive`
- `app/(auth)/login/botao-entrar.tsx` — `Button` do shadcn no lugar do botão cru; mecânica
  (`useFormStatus`, `disabled`, `aria-busy`, os dois rótulos) intacta
- `tests/unit/tokens.test.ts` — 56 casos lendo `app/globals.css` como texto
- `tests/e2e/design-system.spec.ts` — 4 casos (× 2 projetos) de cor/fonte/toque computados
- `scripts/testar-e2e.mjs` — repassa `process.argv` ao Playwright, com aspas em argumentos com
  espaço
- `package.json`/`package-lock.json` — seis dependências novas, todas em versão exata

## Decisions Made

- **`@theme` do Tailwind v4 resolve no escopo `:root`; uma custom property declarada só no
  `<body>` não é visível um nível acima.** As classes `.variable` do `next/font/google` foram
  postas inicialmente no `<body>` (leitura natural do padrão Next.js), o que deixou
  `--font-sans`/`--font-titulo` resolvendo vazio no `:root` — nenhum erro de `lint`, `tsc` ou
  `build` denunciou isso; só uma leitura de `getComputedStyle` no navegador (o portão de
  retorno do tracer) pegou. Corrigido movendo as classes para o `<html>`. **Vale para as fases
  3-6**: qualquer variável CSS que o `@theme` precise ler tem que estar declarada no mesmo
  elemento que gera o escopo raiz, nunca um nível abaixo.
- **`next/font/google` com a opção `variable` produz o nome legível da família
  (`"Archivo Narrow"`, `"Inter"`), não o nome com hash (`__Archivo_Narrow_<hash>`).** O nome
  com hash só aparece no padrão de uso via `.className` direto no elemento — um padrão
  diferente do que D-10 pede (variável CSS consumida pelo `@theme`). Medido de verdade no
  navegador (regras `@font-face` cruas via CDP) antes de escrever a asserção do teste e2e.
  **Vale para qualquer teste futuro** que assine nome de família de fonte gerada pelo
  `next/font`: usar o nome medido, nunca o presumido.
- Card do shadcn não instalado neste plano — cartão de login montado com `<div>` +
  tokens (ver key-decisions no frontmatter).

## Deviations from Plan

### Auto-fixed / Escalated Issues

**1. [Checkpoint de pacotes — não Rule 3, mas mesma família] Registro do shadcn mudou entre a
aprovação nominal e a instalação real**
- **Found during:** Tarefa 2, primeiro `npx shadcn@latest init`
- **Issue:** O portão da Tarefa 1 aprovou nominalmente `@radix-ui/react-slot`,
  `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`. O
  registro atual do shadcn (testado em `shadcn@latest` 4.16.2 E `shadcn@3.8.5` — não é
  artefato de versão da CLI, é o registro do lado do servidor) resolve `radix-ui` (pacote
  unificado) no lugar de `@radix-ui/react-slot`, `lucide-react` numa linha 1.x, e a própria
  CLI `shadcn` tentou entrar como `devDependency` (contrariando "roda por npx, não fica
  instalada").
- **Fix:** Parei, apresentei um novo checkpoint com a lista real (conferida via `npm view`
  contra repositório/mantenedor/data de cada pacote) em vez de assumir a aprovação anterior
  ainda valia. O dono/orquestrador confirmou de forma independente e pediu um ajuste: fixar
  `lucide-react` em `1.28.0` (não `1.30.0`, publicado ~24h antes — higiene de cadeia de
  suprimentos por custo zero) e remover `shadcn` de `devDependencies`.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `node -e "..."` confirmando `package-lock.json` reflete `lucide-react
  1.28.0` e `radix-ui 1.6.7`; `shadcn` ausente de `devDependencies`
- **Committed in:** `08d299e`

**2. [Rule 1 - Bug, achado no portão de retorno do tracer] Variáveis de fonte invisíveis ao
`@theme`**
- **Found during:** portão de retorno do tracer (Tarefa 2), primeira rodada — reprovado pelo
  coordenador com medição real de DOM
- **Issue:** `${inter.variable} ${archivoNarrow.variable}` estavam no `<body>`; o `@theme` de
  `app/globals.css` referencia `var(--fonte-inter)`/`var(--fonte-archivo)` no escopo `:root`,
  que não enxerga uma variável declarada um nível abaixo. `--font-sans`/`--font-titulo`
  resolviam vazio, e a tela toda saía na pilha padrão do sistema — sem quebrar build, lint ou
  tsc.
- **Fix:** Movidas as classes `.variable` para o `<html>`; `font-sans antialiased` permaneceu
  no `<body>`.
- **Files modified:** `app/layout.tsx`
- **Verification:** Playwright real (não leitura visual) confirmando
  `getComputedStyle(document.documentElement).getPropertyValue('--font-titulo')` não-vazio,
  `<h1>` computando Archivo Narrow, `<body>` computando Inter — reconferido de forma
  independente pelo coordenador depois
- **Committed in:** `dbe2302` (commit de correção separado, não emendado em `08d299e`, por
  política de nunca usar `--amend`)

**3. [Correção de suposição do plano, aprovada explicitamente] Asserção de fonte usa o nome
medido, não o nome com sublinhado**
- **Found during:** portão de retorno do tracer, ao medir as regras `@font-face` cruas antes
  de escrever `tests/e2e/design-system.spec.ts`
- **Issue:** O texto da Tarefa 3 do `02b-01-PLAN.md` presumia que o `next/font/google` gera
  `__Archivo_Narrow_<hash>` (nome com sublinhado) e mandava usar
  `toMatch(/Archivo_Narrow/)`. Medido de verdade: com a opção `variable` (que D-10 exige para
  o `@theme` funcionar), o `next/font` gera o nome legível `"Archivo Narrow"` (com espaço) mais
  `"Archivo Narrow Fallback"` — sem hash. O `02b-UI-SPEC.md` já usava a versão com espaço; só o
  texto de ação da Tarefa 3 presumia o outro padrão.
- **Fix:** `tests/e2e/design-system.spec.ts` usa
  `expect(familia).toMatch(/^"?Archivo Narrow"?,/)` (ancorado no início da pilha de fontes,
  sugestão do coordenador para não passar só com `"Archivo Narrow Fallback"` sobrando em
  primeiro) e o mesmo padrão para `/^"?Inter"?,/` no `<body>`.
- **Files modified:** `tests/e2e/design-system.spec.ts`
- **Verification:** 8 testes passando (4 casos × 2 projetos), incluindo os dois de
  font-family
- **Committed in:** `50055e4`

---

**Total deviations:** 3 (1 escalada de legitimidade de pacote com aprovação humana explícita, 1
bug corrigido e reprovado/reaprovado no portão de retorno do tracer, 1 correção de suposição do
texto do plano aprovada pelo coordenador com evidência medida).
**Impact on plan:** Nenhum desvio de escopo. O bug de fonte é o exemplo concreto da "armadilha
de silêncio" que o `02b-UI-SPEC.md` já previa em prosa — este plano a encontrou de verdade e a
corrigiu antes de qualquer plano seguinte herdar o defeito.

## Issues Encountered

- O coordenador levantou uma segunda suspeita no mesmo portão de retorno — sombra do cartão de
  login computando `rgba(0,0,0,0)` (transparente). Investigação mostrou que a leitura pegou só
  a primeira das seis camadas do `box-shadow` composto (`ring`/`inset-ring` — sempre
  transparentes quando não usados — seguidas das duas camadas reais do `shadow-sm` em
  `rgba(0,0,0,0.1)`). Não era bug; nenhuma mudança foi feita. O próprio coordenador confirmou o
  engano na resposta seguinte. Registrado aqui só como contexto, não como desvio.

## Known Stubs

Nenhum. Este plano reestiliza uma tela existente e adiciona tokens/componentes de base — não
introduz nenhuma tela nova com dado vazio/mock.

## User Setup Required

None - nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

- `app/globals.css` está pronto para os planos 02-05 consumirem sem editar de novo (D-08
  satisfeita: mapeamento antes de qualquer `shadcn add`).
- `components/ui/` (só `button.tsx` por enquanto) e `components/amassa/` (`logo.tsx`) já
  estabelecem a fronteira D-11 que os próximos planos seguem.
- `npm run test:e2e -- --grep "..."` está disponível para os planos seguintes rodarem recortes
  da suíte em vez da corrida inteira.
- Nenhum bloqueio conhecido para o plano 02 (casca de navegação — sidebar, sheet, dropdown-menu,
  separator, card).

## Self-Check: PASSED

Todos os arquivos declarados como criados/modificados existem no disco; os três hashes de
commit (`08d299e`, `dbe2302`, `50055e4`) existem no histórico do repositório.

---
*Phase: 02b-design-system-e-casca-da-aplica-o*
*Completed: 2026-08-08*
