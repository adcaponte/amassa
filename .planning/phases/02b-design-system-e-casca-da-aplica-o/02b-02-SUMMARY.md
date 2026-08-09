---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 02
subsystem: ui
tags: [navegacao, shadcn, sidebar, radix-ui, casca-da-aplicacao, playwright]

# Dependency graph
requires:
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "01"
    provides: "app/globals.css com o mapeamento @theme inline completo (incluindo as oito
      --color-sidebar-*), shadcn/ui inicializado com dependências fixadas, components/amassa/logo.tsx
      e components/ui/button.tsx — a base que este plano consome sem editar globals.css de novo"
provides:
  - "lib/navegacao/itens.ts (ITENS_NAVEGACAO, ehItemAtivo) — a fonte única dos 5 itens de
    navegação e a regra de item ativo, módulo puro testado, que os planos 03-05 desta fase
    consomem sem reimplementar"
  - "components/amassa/barra-lateral.tsx, barra-inferior.tsx, cabecalho-movel.tsx,
    menu-usuario.tsx — a casca de navegação completa nos dois tamanhos de tela"
  - "app/(app)/layout.tsx — primeiro layout do grupo (app), envolve toda rota protegida
    existente e futura; chama exigirUsuario() uma vez e passa usuario.nome para a casca"
  - "components/ui/card.tsx, sidebar.tsx, sheet.tsx, skeleton.tsx, dropdown-menu.tsx,
    separator.tsx, tooltip.tsx, input.tsx, hooks/use-mobile.ts — os sete componentes shadcn de
    D-06 mais os dois arrastados pelo registro (tooltip, input) e o hook de detecção mobile"
  - "Sair (Server Action já existente) agora vive só no menu do usuário — app/(app)/page.tsx
    não importa mais lib/auth/acoes"
affects: [02b-03, 02b-04, 02b-05]

# Actuals (#2632)
actuals:
  tokens: 16300
  tasks: 4
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo puro de navegação (lib/navegacao/itens.ts): zero import, ITENS_NAVEGACAO como
      readonly array e ehItemAtivo(caminho, href) com igualdade exata para a raiz e
      startsWith(href + '/') para os demais — mesmo padrão de lib/auth/rotas-publicas.ts"
    - "TDD real de RED para GREEN: tests/unit/navegacao.test.ts commitado sozinho primeiro
      (falha por 'Cannot find module'), lib/navegacao/itens.ts commitado depois (8/8 passam)"
    - "DropdownMenuItem do Radix com asChild: o alvo do asChild vira role='menuitem' e um
      <button type='submit'> dentro de <form> como alvo direto nunca submete de verdade —
      quando é preciso preservar role='button' E disparar a Server Action, o alvo do asChild
      é um elemento neutro (<div>) e o <button> real fica DENTRO dele, chamando a ação
      diretamente no onClick em vez de depender de submissão nativa de formulário"
    - "Helper de teste por visibilidade, não por nome de projeto: abrirMenuDoUsuario(page) em
      tests/e2e/sessao.spec.ts tenta o gatilho visível (avatar no celular vs. rodapé da
      lateral no desktop) via isVisible(), nunca ramificando por testInfo.project.name"

key-files:
  created:
    - lib/navegacao/itens.ts
    - tests/unit/navegacao.test.ts
    - components/amassa/barra-lateral.tsx
    - components/amassa/barra-inferior.tsx
    - components/amassa/cabecalho-movel.tsx
    - components/amassa/menu-usuario.tsx
    - "app/(app)/layout.tsx"
    - components/ui/card.tsx
    - components/ui/sidebar.tsx
    - components/ui/sheet.tsx
    - components/ui/skeleton.tsx
    - components/ui/dropdown-menu.tsx
    - components/ui/separator.tsx
    - components/ui/tooltip.tsx
    - components/ui/input.tsx
    - hooks/use-mobile.ts
  modified:
    - "app/(app)/page.tsx"
    - tests/e2e/sessao.spec.ts

key-decisions:
  - "shadcn CLI mantida em 3.8.5 (não @latest), repetindo a decisão da 02b-01 — consistência
    de convenção com components.json (style: radix-nova) e components/ui/button.tsx já
    commitados; usar 4.x arriscaria gerar os seis componentes novos com convenções diferentes
    do button.tsx existente."
  - "Zero pacote npm novo nesta onda: os quatro primitivos Radix que sidebar/sheet/
    dropdown-menu/separator precisam (react-dialog, react-dropdown-menu, react-separator,
    react-tooltip) já vêm vendidos por radix-ui@1.6.7, aprovado na 02b-01. Confirmado por
    diff vazio de package.json/package-lock.json antes/depois do shadcn add — não só
    presumido, medido."
  - "tooltip.tsx e input.tsx entraram junto com sidebar (dependência do próprio componente no
    registro do shadcn, não escolha deste plano) — D-06 continua satisfeita porque nenhum
    componente foi adicionado por decisão nossa além dos sete listados; alert-dialog e sonner
    (D-07) seguem ausentes."
  - "MenuUsuario é autossuficiente na variante desktop (DropdownMenu com gatilho + conteúdo)
    mas só entrega o CONTEÚDO na variante celular — o botão de avatar com o aria-label
    obrigatório vive em cabecalho-movel.tsx, que também é dono do Sheet raiz. Isso satisfaz o
    critério de aceite que exige a string aria-label='Abrir menu do usuário' literalmente no
    arquivo cabecalho-movel.tsx."
  - "Server Action sair() chamada diretamente no onClick do item de menu do desktop, não via
    <form action={sair}> — ver Deviations."

patterns-established:
  - "Ícones de navegação mapeados por ChaveDeIcone → componente lucide-react em um Record
    local a cada componente que precisa renderizar (barra-inferior.tsx, barra-lateral.tsx) —
    o módulo puro de lib/navegacao/itens.ts nunca importa React nem lucide-react."
  - "Largura fixa de Sidebar via SidebarProvider local (não global): style={{ '--sidebar-width':
    '240px' }} num SidebarProvider que envolve só a barra lateral, com className w-auto para
    sobrescrever o w-full padrão do wrapper — collapsible='none' evita todo o estado de
    colapso/cookie que o componente traria por padrão."

requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-09]

coverage:
  - id: D1
    description: "ITENS_NAVEGACAO tem exatamente 5 itens na ordem Início/Encomendas/Agenda/
      Queimas/Estoque; nenhum tem href /orcamentos"
    requirement: "UI-02, UI-04"
    verification:
      - kind: unit
        ref: "tests/unit/navegacao.test.ts — 'tem exatamente 5 itens, nesta ordem' e 'nenhum
          item leva a /orcamentos'"
        status: pass
    human_judgment: false
  - id: D2
    description: "ehItemAtivo casa a raiz só por igualdade exata, os demais por prefixo com
      barra separadora, nunca por prefixo de texto solto; caminho vazio/desconhecido nunca
      casa; exatamente um item ativo por caminho"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "tests/unit/navegacao.test.ts — 8 casos (RED provado: módulo ausente falha por
          'Cannot find module', depois 8/8 passam)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Botão de avatar do celular tem aria-label='Abrir menu do usuário' e é
      clicável de verdade (abre o Sheet com o menu do usuário)"
    requirement: "UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts — abrirMenuDoUsuario() usa exatamente esse
          getByRole('button', {name: 'Abrir menu do usuário'}) no projeto celular, e o teste
          'depois de sair...' passa nos dois projetos"
        status: pass
    human_judgment: false
  - id: D4
    description: "O botão Sair funciona nos dois tamanhos de tela depois de mudar de
      endereço (D-15), sem duplicar getByRole('button', {name: 'Sair'})"
    requirement: "UI-02, UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts — 'depois de sair o botao de voltar cai em /login',
          projetos desktop e celular, npm run test:e2e 40/40"
        status: pass
    human_judgment: false
  - id: D5
    description: "app/(app)/layout.tsx chama exigirUsuario() como primeira instrução; nenhuma
      rota nova foi acrescentada a ROTAS_PUBLICAS nem ao matcher do middleware"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "npm run verificar-acoes (0 violações) + git diff --exit-code
          lib/auth/rotas-publicas.ts middleware.ts app/globals.css (retorna 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A barra lateral de 240px usa a paleta --color-sidebar-* do plano 01 (não a
      paleta padrão do Tailwind) — a armadilha de silêncio que D-09 documenta"
    requirement: "UI-01, UI-03"
    verification:
      - kind: manual_procedural
        ref: "Sidebar/SidebarFooter/SidebarMenuButton do shadcn (components/ui/sidebar.tsx)
          usam as classes bg-sidebar/text-sidebar-foreground/bg-sidebar-accent/etc. por
          construção — essas classes só resolvem cor porque o mapeamento @theme inline da
          02b-01 já existe. Não há teste e2e específico de cor computada da barra lateral
          nesta onda (D-09 cobriu login); a tentativa de medir via script Playwright ad hoc
          esbarrou em configuração de ambiente do servidor manual (ver Issues Encountered) e
          foi abandonada em favor de rodar a suíte e2e real, que exercita a casca em ambas as
          telas com o servidor corretamente configurado"
        status: pass
    human_judgment: true
    rationale: "Nenhum e2e desta onda lê getComputedStyle da barra lateral especificamente
      (só do login, herdado da 02b-01). A prova é estrutural (as classes shadcn certas estão
      no lugar certo) mais o fato de toda a suíte passar sem erro de console. Recomendado
      conferir visualmente na verificação de fim de fase, no espírito de D-09."
  - id: D7
    description: "UI-05 (navegação confortável com o polegar) não é medível por teste
      automatizado"
    requirement: "UI-05"
    verification:
      - kind: manual_procedural
        ref: "Não executado nesta plan — fica para a verificação humana de fim de fase
          (human_verify_mode: end-of-phase), como o próprio 02b-UI-SPEC.md já registra"
        status: pending
    human_judgment: true
    rationale: "Célula do próprio contrato de UI: precisa de um celular de verdade, em pé,
      não de asserção de código."

# Metrics
duration: ~2h (inclui checkpoint de portão de pacotes e um ciclo de achar/corrigir bug real
  do Radix DropdownMenuItem rodando o e2e)
completed: 2026-08-08
status: complete
---

# Phase 2b Plan 02: Casca de Navegação Summary

**A casca por onde se navega nasce de ponta a ponta: barra lateral fixa de 240px no desktop,
barra inferior de 5 itens e cabeçalho com avatar no celular, e o menu do usuário (nome,
Orçamentos, Sair) funcionando nos dois tamanhos de tela — incluindo um bug real do Radix
DropdownMenuItem achado e corrigido rodando o e2e de verdade, não por leitura de código.**

## Performance

- **Duration:** ~2h, incluindo o checkpoint humano de legitimidade de pacotes (aprovado sem
  nenhum pacote novo) e um ciclo completo de descoberta/correção de bug no menu do usuário
  do desktop
- **Completed:** 2026-08-08
- **Tasks:** 4 (1 checkpoint de portão + 1 TDD RED/GREEN + 1 implementação da casca + 1 fix
  de e2e que virou também um fix de bug real de produto)
- **Files modified:** 18 (16 criados, 2 modificados)

## Accomplishments

- `lib/navegacao/itens.ts`: módulo puro (zero import) com `ITENS_NAVEGACAO` (5 itens,
  ordem travada) e `ehItemAtivo` (igualdade exata para `/`, prefixo com barra separadora para
  os demais) — construído em TDD real: teste commitado sozinho primeiro (RED, falha por
  módulo inexistente), implementação commitada depois (GREEN, 8/8 passam)
- Seis componentes shadcn restantes instalados (`card`, `sidebar`, `sheet`, `skeleton`,
  `dropdown-menu`, `separator`) via `shadcn@3.8.5` — **zero pacote npm novo**: os quatro
  primitivos Radix necessários já vinham vendidos por `radix-ui@1.6.7`, aprovado na 02b-01.
  Confirmado por diff vazio de `package.json`/`package-lock.json`, não só presumido
- `app/globals.css` intacto (`git diff --exit-code` confirma) — o mapeamento `@theme inline`
  da 02b-01 sobrevive à instalação, incluindo as oito `--color-sidebar-*`
- Quatro componentes novos em `components/amassa/`: `barra-lateral.tsx` (Sidebar do shadcn
  com `collapsible="none"`, 240px fixos), `barra-inferior.tsx` (5 itens, `min-h-[56px]`,
  `aria-current`, `safe-area-inset-bottom`), `cabecalho-movel.tsx` (avatar com
  `aria-label="Abrir menu do usuário"` obrigatório) e `menu-usuario.tsx` (três itens
  exatamente — nome truncado, Orçamentos, Sair)
- `app/(app)/layout.tsx`: primeiro layout do grupo, `exigirUsuario()` como primeira
  instrução, monta a casca inteira e passa `usuario.nome` para os componentes sem consulta
  nova ao banco
- Bug real do Radix `DropdownMenuItem` achado e corrigido: o botão Sair do desktop não
  funcionava por duas armadilhas simultâneas do `asChild` — ver Deviations
- `tests/e2e/sessao.spec.ts` consertado com `abrirMenuDoUsuario(page)`, que escolhe o gatilho
  pela visibilidade real (nunca pelo nome do projeto do Playwright) — suíte e2e inteira volta
  ao verde (40/40, dois projetos)

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Portão de legitimidade dos pacotes Radix** — checkpoint humano, aprovado sem
   nenhum pacote novo (confirmado por ambas as partes antes da instalação). Sem commit
   próprio.
2. **Tarefa 2: Seis componentes shadcn + módulo puro da navegação** — `27c6b75` (test, RED)
   + `f507a4d` (feat, GREEN)
3. **Tarefa 3: Casca de navegação e layout do grupo protegido** — `b0f35c2` (feat)
4. **Tarefa 4: Conserto do e2e de sessão + bug real do Sair no desktop** — `c1d4770` (fix)

**Plan metadata:** commit deste SUMMARY (a seguir)

## Files Created/Modified

- `lib/navegacao/itens.ts` — módulo puro, `ITENS_NAVEGACAO` e `ehItemAtivo`
- `tests/unit/navegacao.test.ts` — 8 casos (igualdade, prefixo, prefixo falso, vazio,
  desconhecido, unicidade, ordem, ausência de `/orcamentos`)
- `components/ui/card.tsx`, `sidebar.tsx`, `sheet.tsx`, `skeleton.tsx`, `dropdown-menu.tsx`,
  `separator.tsx` — os seis componentes de D-06 instalados nesta onda
- `components/ui/tooltip.tsx`, `input.tsx`, `hooks/use-mobile.ts` — arrastados pelo `sidebar`
  no registro do shadcn (comportamento do registro, não escolha deste plano)
- `components/amassa/barra-lateral.tsx` — `SidebarProvider` local com `--sidebar-width: 240px`,
  `Sidebar collapsible="none"`, `Logo` no topo, `ITENS_NAVEGACAO` no meio, `MenuUsuario`
  variante desktop no rodapé
- `components/amassa/barra-inferior.tsx` — `nav` fixo no rodapé, 5 itens, `aria-current` no
  ativo, `pb-[env(safe-area-inset-bottom)]`
- `components/amassa/cabecalho-movel.tsx` — `header` sticky, título + botão de avatar
  (`aria-label="Abrir menu do usuário"`) que abre o `Sheet`
- `components/amassa/menu-usuario.tsx` — três itens (nome, Orçamentos, Sair);
  autossuficiente no desktop, só conteúdo no celular
- `app/(app)/layout.tsx` — a casca completa envolvendo `children`
- `app/(app)/page.tsx` — removido `<form action={sair}>` e o import de `lib/auth/acoes`
- `tests/e2e/sessao.spec.ts` — `abrirMenuDoUsuario(page)` por visibilidade

## Decisions Made

- **shadcn CLI mantida em `3.8.5`** (não `@latest`), repetindo a decisão da 02b-01, por
  consistência com `components.json` (`style: radix-nova`) e `components/ui/button.tsx` já
  commitados.
- **Zero pacote npm novo** — os quatro primitivos Radix necessários (`react-dialog`,
  `react-dropdown-menu`, `react-separator`, `react-tooltip`) já vinham vendidos por
  `radix-ui@1.6.7`. Verificado por inspeção de `node_modules/@radix-ui/` e confirmado por
  diff vazio de `package.json`/`package-lock.json` antes e depois do `shadcn add` — nenhuma
  suposição não verificada.
- **`tooltip.tsx` e `input.tsx` entram junto com `sidebar`** — dependência do próprio
  componente no registro do shadcn (o texto da Tarefa 2 já previa isso), não uma escolha
  deste plano. D-06/D-07 continuam satisfeitas: nenhum componente extra foi adicionado por
  decisão nossa, `alert-dialog` e `sonner` seguem ausentes.
- **`MenuUsuario` tem responsabilidade diferente por variante**: autossuficiente no desktop
  (dono do `DropdownMenu` inteiro, gatilho incluído), só conteúdo no celular (o botão de
  avatar com o `aria-label` obrigatório vive em `cabecalho-movel.tsx`). Isso é o que faz o
  critério de aceite "`cabecalho-movel.tsx` contém `aria-label='Abrir menu do usuário'`"
  passar de verdade — a string literal precisa estar naquele arquivo, não delegada.
- **`sair()` chamada diretamente no `onClick` do item de menu do desktop**, não via
  `<form action={sair}>` — ver Deviations para o motivo (bug real do Radix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug real do Radix, achado rodando o e2e] Botão Sair do desktop não
funcionava**
- **Found during:** Tarefa 4, primeira rodada de `npm run test:e2e`
- **Issue:** Duas armadilhas simultâneas do `DropdownMenuItem asChild` do Radix, nenhuma
  visível por leitura de código:
  1. Com `<DropdownMenuItem asChild><form action={sair}><button type="submit">Sair</button>
     </form></DropdownMenuItem>` (o padrão literal do `02b-PATTERNS.md`), clicar em "Sair"
     nunca disparava a submissão nativa do formulário — o clique era capturado, mas a
     navegação para `/login` nunca acontecia (confirmado: `toHaveURL` ficava preso em `/`).
  2. Na segunda tentativa, mover o `<button onClick={() => sair()}>` para ser o próprio alvo
     do `asChild` resolveu o disparo da ação, mas quebrou a busca por papel: `asChild` aplica
     `role="menuitem"` no elemento raiz recebido, então o botão deixou de responder por
     `getByRole("button", { name: "Sair" })` — passou a ser `menuitem`, não `button`
     (confirmado no snapshot de acessibilidade do Playwright: `menuitem "Sair" [ref=e5]`).
- **Fix:** O alvo do `asChild` passou a ser um `<div>` neutro (que absorve o `role="menuitem"`
  do Radix), com o `<button type="button" onClick={() => void sair()}>` real DENTRO dele —
  preserva o papel de botão para o teste e dispara a Server Action diretamente, sem depender
  de submissão nativa de formulário. A variante celular (dentro do `Sheet`) não tem esse
  problema — `Sheet` (Radix `Dialog`) não intercepta o clique da mesma forma, e
  `<form action={sair}>` continua funcionando lá sem mudança.
- **Files modified:** `components/amassa/menu-usuario.tsx`
- **Verification:** `npm run test:e2e` — 40/40 nos dois projetos, incluindo
  "depois de sair o botao de voltar cai em /login" em `desktop` e `celular`
- **Committed in:** `c1d4770`

**2. [Correção de padrão do plano, aprovada implicitamente pela verificação] Padrão de
`<form action={sair}>` de `02b-PATTERNS.md` não vale dentro de `DropdownMenuItem`**
- **Found during:** mesma investigação acima
- **Issue:** `02b-PATTERNS.md` generalizava o padrão `<form action={sair}><button
  type="submit">Sair</button></form>` de `app/(app)/page.tsx` (um contexto sem Radix) para
  `menu-usuario.tsx` sem prever que o mesmo padrão, dentro de um `DropdownMenuItem`, não
  funciona por causa do comportamento de clique do Radix.
- **Fix:** documentado inline em `menu-usuario.tsx` (comentário extenso explicando as duas
  armadilhas) para qualquer manutenção futura não reintroduzir o padrão quebrado.
- **Files modified:** `components/amassa/menu-usuario.tsx`
- **Committed in:** `c1d4770`

**Total deviations:** 2 (mesma causa raiz — comportamento do Radix `DropdownMenuItem` com
`asChild`), ambas encontradas rodando a suíte e2e real, nunca por inspeção estática, e ambas
corrigidas sem alterar o que o teste prova (AUTH-06: sair encerra de verdade).
**Impact on plan:** Nenhum desvio de escopo — o comportamento funcional final (Sair
alcançável em um toque, nos dois tamanhos de tela) é exatamente o que o plano pedia. O
padrão de código mudou (chamada direta em vez de `<form action>`) só onde o Radix exigiu.

## Issues Encountered

- Tentativa de medir a cor computada da barra lateral com um script Playwright ad hoc
  (fora da suíte oficial) falhou por configuração de ambiente: `npm run start` sem as
  variáveis que `playwright.config.ts` injeta no `webServer` (`AUTH_SECRET`,
  `AUTH_TRUST_HOST`, `DATABASE_URL` de teste) produz "problema de configuração do servidor"
  no NextAuth. A tentativa foi abandonada em favor de rodar `npm run test:e2e` de verdade,
  que já resolve esse ambiente corretamente — nenhuma mudança de código motivada por isso.
  Registrado em D6 (coverage) como item sem prova automatizada específica de cor computada da
  barra lateral nesta onda.
- Uma conta de verificação visual (`verificacao.02b02@exemplo.test`) foi criada no banco de
  desenvolvimento local durante a investigação acima e desativada (`ativo = false`, nunca
  apagada) ao final — não afeta nenhum ambiente de teste ou produção.

## Known Stubs

Nenhum. Este plano entrega a casca de navegação funcional (não estados vazios de módulo,
que são o plano 03) — não há dado mock nem placeholder introduzido.

## Threat Flags

Nenhum novo. As três mitigações do `threat_model` desta plan (`T-02b-01`, `T-02b-02`,
`T-02b-03`) foram verificadas: `exigirUsuario()` como primeira instrução do layout,
`ROTAS_PUBLICAS`/`middleware.ts` intactos (`git diff --exit-code` retorna 0), e
`menu-usuario.tsx` só recebe `usuario.nome` como prop — nenhum dado adicional atravessa a
fronteira servidor→cliente.

## User Setup Required

None — nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

- `lib/navegacao/itens.ts` está pronto para os planos 03-05 consumirem sem reimplementar a
  regra de item ativo.
- A fronteira `components/ui/` × `components/amassa/` (D-11) continua íntegra: nenhum arquivo
  gerado pelo shadcn foi editado à mão.
- `app/(app)/layout.tsx` já envolve `app/(app)/page.tsx`; os planos 03-05 só precisam criar
  as páginas de módulo (`encomendas`, `agenda`, `queimas`, `estoque`, `orcamentos`) — a casca
  já está pronta para recebê-las.
- **Pendência para a verificação de fim de fase** (não bloqueia este plano): D6 e D7 da
  cobertura acima — conferir visualmente a cor da barra lateral em navegador de verdade
  (backstop da armadilha de silêncio de D-09) e UI-05 (navegação confortável com o polegar,
  num celular de verdade). Também o item de backstop já registrado no `must_haves` do
  `02b-02-PLAN.md`: truncamento do nome do usuário com um nome longo real (≥ 40 caracteres) —
  `truncate` e `title={nome}` já estão aplicados nas duas variantes, mas não há conta de
  teste com nome longo hoje para exercitar automaticamente.

## Self-Check: PASSED

Todos os arquivos declarados como criados/modificados existem no disco; os quatro hashes de
commit (`27c6b75`, `f507a4d`, `b0f35c2`, `c1d4770`) existem no histórico do repositório.

---
*Phase: 02b-design-system-e-casca-da-aplica-o*
*Completed: 2026-08-08*
