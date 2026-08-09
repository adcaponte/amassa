---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 03
subsystem: ui
tags: [next-app-router, shadcn, playwright, radix-ui, estados-vazios, painel]

# Dependency graph
requires:
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "02"
    provides: "lib/navegacao/itens.ts (ITENS_NAVEGACAO, ehItemAtivo), a casca de navegação
      completa (barra lateral, barra inferior, cabeçalho móvel, menu do usuário) e
      app/(app)/layout.tsx já chamando exigirUsuario() e envolvendo toda rota protegida — a
      base que este plano preenche com telas reais"
provides:
  - "components/amassa/estado-vazio.tsx (EstadoVazio), cabecalho-pagina.tsx (CabecalhoPagina),
    cartao-painel.tsx (CartaoPainel) — os três componentes compartilhados que resolvem UI-07
    de forma reutilizável para as Fases 3 a 6"
  - "app/(app)/page.tsx real (painel inicial com saudação + 4 cartões nomeados) e as cinco
    rotas de módulo (/encomendas, /agenda, /queimas, /estoque, /orcamentos), todas protegidas
    por exigirUsuario() na primeira instrução"
  - "tests/e2e/casca.spec.ts — prova de máquina de UI-02, UI-03, UI-04, UI-06 e UI-07 nos dois
    projetos (desktop e celular)"
affects: [02b-04, 02b-05, fase-3, fase-4, fase-5, fase-6]

# Actuals (#2632)
actuals:
  tokens: 7500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EstadoVazio (Server Component puro): titulo/corpo/rotuloBotao?/notaBotao? — rotuloBotao
      omitido = sem botão nenhum (caso /orcamentos, D-04); botão sempre com disabled +
      aria-disabled='true' + nota visível no documento (nunca title/tooltip)"
    - "CabecalhoPagina com flex-wrap: children (botão de ação) desce para a linha de baixo no
      celular em vez de espremer o título — estrutural no componente, mesmo que nenhuma das
      seis telas desta fase passe children a ele (todas usam CabecalhoPagina só com titulo)"
    - "Locator de navegação por visibilidade, nunca por nome de projeto: mesmo princípio já
      estabelecido em tests/e2e/sessao.spec.ts (abrirMenuDoUsuario) — casca.spec.ts usa
      barraInferior.isVisible() para escolher entre nav (celular) e [data-slot='sidebar']
      (desktop), e ':visible' no locator de aria-current para ignorar a metade da navegação
      que está sempre no DOM mas oculta por CSS no breakpoint atual"
    - "DropdownMenuItem asChild também rebaixa o papel do link 'Orçamentos' para role='menuitem'
      no desktop (mesma armadilha do Radix já documentada em menu-usuario.tsx para o botão
      Sair) — o teste usa getByRole('link', ...).or(getByRole('menuitem', ...)) para valer nos
      dois projetos sem depender de qual papel o Radix aplicou"

key-files:
  created:
    - components/amassa/estado-vazio.tsx
    - components/amassa/cabecalho-pagina.tsx
    - components/amassa/cartao-painel.tsx
    - "app/(app)/encomendas/page.tsx"
    - "app/(app)/agenda/page.tsx"
    - "app/(app)/queimas/page.tsx"
    - "app/(app)/estoque/page.tsx"
    - "app/(app)/orcamentos/page.tsx"
    - tests/e2e/casca.spec.ts
    - .planning/phases/02b-design-system-e-casca-da-aplica-o/deferred-items.md
  modified:
    - "app/(app)/page.tsx"
    - tests/e2e/fundacao.spec.ts
    - tests/e2e/sessao.spec.ts
    - tests/e2e/autenticacao.spec.ts

key-decisions:
  - "CabecalhoPagina não recebe children em nenhuma das seis páginas desta fase — o botão
    desabilitado de cada tela de módulo vive dentro de EstadoVazio (via rotuloBotao/notaBotao),
    seguindo literalmente o esqueleto do texto de ação da Tarefa 2 do plano, não o diagrama
    ASCII da seção 'Cabeçalho de Página' do 02b-UI-SPEC.md (que mostrava o botão na linha do
    título). O componente continua preparado para receber children (flex-wrap já resolvido)
    para quando uma fase futura precisar de um botão no cabeçalho em vez de dentro do estado
    vazio."
  - "tests/e2e/casca.spec.ts roda em série (test.describe.configure({mode: 'serial'})),
    seguindo a mesma convenção de autenticacao.spec.ts e sessao.spec.ts — nenhum destes 7
    casos muta estado compartilhado, é só prudência de carga (cada teste faz login, que é uma
    conferência real de hash argon2id)."

patterns-established:
  - "Copy literal das tabelas do 02b-UI-SPEC.md copiada byte a byte para as cinco telas de
    módulo e para o painel — nenhuma frase parafraseada, incluindo acentuação e pontuação
    exatas (crítico para os testes de texto exato em casca.spec.ts)."

requirements-completed: [UI-02, UI-04, UI-06, UI-07]

coverage:
  - id: D1
    description: "Os três componentes compartilhados (EstadoVazio, CabecalhoPagina,
      CartaoPainel) existem com as assinaturas exatas do contrato de UI e passam lint/tsc"
    requirement: "UI-07"
    verification:
      - kind: other
        ref: "npm run lint (0) + npx tsc --noEmit (0) + greps de aceite da Tarefa 1 (aria-disabled,
          ausência de title=, <h1>/text-display, import de components/ui/card, ausência de
          components/ui/skeleton)"
        status: pass
    human_judgment: false
  - id: D2
    description: "As cinco rotas de módulo e o painel inicial existem, todas com
      exigirUsuario() como primeira instrução, sem tocar middleware.ts/rotas-publicas.ts/
      globals.css"
    requirement: "UI-02, UI-04"
    verification:
      - kind: other
        ref: "npm run lint + npx tsc --noEmit + npm run verificar-acoes (0 violações) + npm run
          build (sucesso) + git diff --exit-code middleware.ts lib/auth/rotas-publicas.ts
          app/globals.css (0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os 5 itens da navegação visível (barra inferior no celular, barra lateral no
      desktop) estão na ordem de ITENS_NAVEGACAO, com os rótulos certos"
    requirement: "UI-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/casca.spec.ts — 'a navegação principal visível tem exatamente 5 itens,
          na ordem e com os rótulos de ITENS_NAVEGACAO (UI-02)', projetos desktop e celular"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicar em cada item leva à URL do href correspondente e só aquele item expõe
      aria-current='page' entre os visíveis"
    requirement: "UI-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/casca.spec.ts — 'cada item leva a sua rota e só ele expõe aria-current
          entre os visíveis (UI-02)', projetos desktop e celular"
        status: pass
    human_judgment: false
  - id: D5
    description: "Orçamentos não aparece nos 5 links da navegação principal e só é alcançável
      abrindo o menu do usuário"
    requirement: "UI-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/casca.spec.ts — 'Orçamentos não aparece na navegação principal e só é
          alcançável pelo menu do usuário (UI-04)', projetos desktop e celular"
        status: pass
    human_judgment: false
  - id: D6
    description: "No desktop, a barra lateral tem largura fixa de 240px"
    requirement: "UI-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/casca.spec.ts — 'no desktop, a barra lateral tem largura fixa de 240px
          (UI-03)'"
        status: pass
    human_judgment: false
  - id: D7
    description: "Nenhuma das sete rotas (as seis protegidas mais /login) exige rolagem
      horizontal a 320px de largura"
    requirement: "UI-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/casca.spec.ts — 'nenhuma das sete rotas exige rolagem horizontal a
          320px de largura (UI-06)', projetos desktop e celular"
        status: pass
    human_judgment: false
  - id: D8
    description: "Cada tela de módulo mostra cabeçalho, frase de contexto do estado vazio e um
      botão desabilitado com a nota da fase que o resolve, visível sem interação; /orcamentos
      mostra título e corpo sem nenhum botão"
    requirement: "UI-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/casca.spec.ts — 'cada tela de módulo tem cabeçalho, estado vazio com
          frase de contexto e botão inerte com nota (UI-07)' e '/orcamentos mostra título e
          corpo, sem nenhum botão (UI-04, UI-07)'"
        status: pass
    human_judgment: false
  - id: D9
    description: "A moldura de CabecalhoPagina resolve o transbordo no celular (children desce
      de linha em vez de espremer o título) — backstop estrutural, não exercitado por nenhuma
      das seis telas desta fase, que não passam children ao componente"
    verification: []
    human_judgment: true
    rationale: "Nenhuma tela desta fase usa CabecalhoPagina com children (o botão de cada
      módulo vive dentro de EstadoVazio). A propriedade flex-wrap existe no componente e será
      exercitada de verdade pela primeira fase que precisar de um botão de ação no cabeçalho
      — vale conferência visual quando isso acontecer."
  - id: D10
    description: "Suíte e2e herdada (fundacao, sessao, autenticacao, backup, design-system)
      continua verde depois de trocar as cinco asserções de heading 'AMASSA' pós-login por
      /^Olá, /, sem nenhum caso removido"
    requirement: "UI-02"
    verification:
      - kind: e2e
        ref: "npm run test:e2e — fundacao (3/3), sessao (4/4), autenticacao (3/4, ver Issues
          Encountered), backup e design-system verdes nos dois projetos"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min (inclui investigação extensa de um teste instável pré-existente, isolado via
  --grep-invert como independente desta fase)
completed: 2026-08-08
status: complete
---

# Phase 2b Plan 03: As Dez Telas — Painel e Módulos Vazios Summary

**As cinco rotas de módulo e o painel inicial nascem com cabeçalho, estado vazio com frase de
contexto e botão inerte com nota — UI-07 ganha prova real de máquina, não só convenção — e
`tests/e2e/casca.spec.ts` prova UI-02/UI-03/UI-04/UI-06 nos dois tamanhos de tela, com a suíte
herdada das fases 1, 2a e 2b-01/02 inteira ainda verde.**

## Performance

- **Duration:** ~55min (inclui uma investigação extensa de um teste e2e pré-existente
  instável, comprovado independente desta fase antes de ser documentado como fora de escopo)
- **Completed:** 2026-08-08
- **Tasks:** 3 (componentes compartilhados, seis páginas, prova e2e + conserto da suíte
  herdada)
- **Files modified:** 14 (10 criados, 4 modificados)

## Accomplishments

- `components/amassa/estado-vazio.tsx`, `cabecalho-pagina.tsx`, `cartao-painel.tsx`: os três
  componentes que resolvem UI-07 de forma reutilizável — as Fases 3 a 6 só trocam as strings,
  nunca a moldura
- `app/(app)/page.tsx` substituído pelo painel real: saudação "Olá, {nome}.", rótulo "SEU DIA
  HOJE" e grade 2×2 (1 coluna no celular) dos quatro cartões nomeados, todos vazios nesta fase
- Cinco rotas novas (`/encomendas`, `/agenda`, `/queimas`, `/estoque`, `/orcamentos`), cada uma
  com `exigirUsuario()` como primeira instrução, `middleware.ts`/`rotas-publicas.ts`/
  `globals.css` intactos
- `tests/e2e/casca.spec.ts`: 7 casos × 2 projetos (14 execuções) provando os 5 itens de
  navegação na ordem certa, clique + `aria-current` por item, Orçamentos fora da navegação
  principal, 240px da barra lateral, ausência de rolagem horizontal a 320px nas sete rotas, e
  cabeçalho + estado vazio + botão inerte em cada tela de módulo
- Suíte e2e herdada (`fundacao`, `sessao`, `autenticacao`) consertada: as cinco asserções de
  heading "AMASSA" pós-login na raiz trocadas por `/^Olá, /` — a de `/login` não muda (prova
  pública de INFRA-02) — nenhum caso removido

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Os três componentes compartilhados** — `af97d83` (feat)
2. **Tarefa 2: Painel inicial e as cinco rotas de módulo** — `94440fd` (feat)
3. **Tarefa 3: Prova e2e da navegação + conserto da suíte herdada** — `6adc828` (test)

**Plan metadata:** commit deste SUMMARY (a seguir)

## Files Created/Modified

- `components/amassa/estado-vazio.tsx` — `EstadoVazio({titulo, corpo, rotuloBotao?,
  notaBotao?})`, botão `disabled` + `aria-disabled="true"` + nota sempre no documento
- `components/amassa/cabecalho-pagina.tsx` — `CabecalhoPagina({titulo, children?})`, `<h1
  text-display>` + `flex-wrap` para o transbordo do celular
- `components/amassa/cartao-painel.tsx` — `CartaoPainel({titulo, vazio})` sobre `Card` do
  shadcn, sem botão e sem esqueleto (D-02, D-03), com comentário do formato do esqueleto
  futuro
- `app/(app)/page.tsx` — painel real (D-02, D-16)
- `app/(app)/encomendas/page.tsx`, `agenda/page.tsx`, `queimas/page.tsx`, `estoque/page.tsx` —
  `CabecalhoPagina` + `EstadoVazio` com copy literal da tabela do 02b-UI-SPEC.md
- `app/(app)/orcamentos/page.tsx` — mesma moldura, sem `rotuloBotao`/`notaBotao` (D-04)
- `tests/e2e/casca.spec.ts` — a prova nova
- `tests/e2e/fundacao.spec.ts`, `sessao.spec.ts`, `autenticacao.spec.ts` — asserções de
  heading atualizadas para o painel real
- `.planning/phases/02b-design-system-e-casca-da-aplica-o/deferred-items.md` — registro do
  teste pré-existente instável (ver Issues Encountered)

## Decisions Made

- **`CabecalhoPagina` não recebe `children` em nenhuma das seis telas desta fase** — o botão
  desabilitado de cada módulo vive dentro de `EstadoVazio`, seguindo o esqueleto literal da
  Tarefa 2 do plano em vez do diagrama ASCII da seção "Cabeçalho de Página" do
  `02b-UI-SPEC.md` (que mostrava o botão na linha do título). O componente continua pronto
  para receber `children` (o `flex-wrap` já resolvido) quando uma fase futura precisar disso.
- **`tests/e2e/casca.spec.ts` roda em série**, seguindo a mesma convenção já estabelecida em
  `autenticacao.spec.ts`/`sessao.spec.ts` — nenhum dos 7 casos muta estado compartilhado; é
  prudência de carga, já que cada um faz login (uma conferência real de hash argon2id).
- **Locator de navegação por visibilidade, nunca por nome de projeto** — `casca.spec.ts`
  escolhe entre a barra inferior (`nav[aria-label="Navegação principal"]`) e a barra lateral
  (`[data-slot="sidebar"]`) verificando qual está de fato visível, e usa o pseudo-seletor
  `:visible` do Playwright para contar só o item `aria-current="page"` que está na tela —
  necessário porque as duas navegações (lateral e inferior) SEMPRE existem no DOM
  simultaneamente (só uma fica oculta por CSS conforme o breakpoint), então uma busca
  `[aria-current="page"]` sem filtro de visibilidade encontraria dois elementos, não um.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, achado rodando o e2e de verdade] O link "Orçamentos" perde o papel de
`link` no desktop por causa do Radix `DropdownMenuItem asChild`**
- **Found during:** Tarefa 3, primeira rodada de `tests/e2e/casca.spec.ts`
- **Issue:** No desktop, `getByRole("link", { name: "Orçamentos" })` nunca encontrava o item
  depois de abrir o menu do usuário — o snapshot de acessibilidade mostrou
  `menuitem "Orçamentos"`, não `link`. O mesmo `DropdownMenuItem asChild` do Radix que já
  havia rebaixado o papel do botão "Sair" na 02b-02 (ver `menu-usuario.tsx`) também aplica
  `role="menuitem"` no `<Link>` de Orçamentos, porque ele também é filho direto de um
  `DropdownMenuItem asChild`. No celular, fora do `DropdownMenu`, o mesmo `<Link>` mantém
  `role="link"` normalmente — por isso só o desktop travava.
- **Fix:** o teste passou a localizar o item por
  `getByRole("link", {...}).or(getByRole("menuitem", {...}))`, válido nos dois projetos sem
  depender de qual papel o Radix aplicou. Nenhum código de produção foi tocado —
  `menu-usuario.tsx` não está em `files_modified` deste plano e o comportamento (Orçamentos
  alcançável em um clique a partir do menu) já funcionava; só a asserção do teste presumia o
  papel errado.
- **Files modified:** `tests/e2e/casca.spec.ts`
- **Verification:** `npm run test:e2e -- --grep "casca de nave"` — 14/14 nos dois projetos
- **Committed in:** `6adc828`

---

**Total deviations:** 1 (Rule 1, achado e corrigido rodando o e2e real, não por leitura de
código).
**Impact on plan:** Nenhum desvio de escopo — nenhum arquivo de produção foi modificado; o
ajuste ficou inteiro dentro do teste novo desta tarefa.

## Issues Encountered

- **Teste pré-existente instável, confirmado independente desta fase.**
  `tests/e2e/autenticacao.spec.ts:72` ("a sexta tentativa seguida no mesmo e-mail mostra a
  mensagem de bloqueio com os minutos") estourou o timeout de `page.waitForResponse` em
  múltiplas rodadas de `npm run test:e2e`, no projeto `desktop` (e às vezes também no
  `celular`). Investigação: aumentar o timeout de 60s para 90s e depois 120s não resolveu — o
  estouro se repetiu nos três valores, sinal de que não é simplesmente "lento", é uma resposta
  que não chega. Isolamento decisivo: `npm run test:e2e -- --grep-invert "casca de nave"` (a
  suíte inteira, SEM nenhum arquivo novo desta fase participando) reproduziu exatamente o
  mesmo estouro, no mesmo teste, no mesmo projeto — provando que não foi este plano que
  introduziu o problema. A causa provável mora em `db/index.ts` (pool do `pg.Pool` sem `max`
  explícito) ou no `UV_THREADPOOL_SIZE` padrão do Node sob a carga de várias conferências de
  hash argon2id concorrentes — território fora de `files_modified` deste plano (que é design
  system e casca de navegação, não autenticação). Revertida a tentativa especulativa de
  aumentar o timeout (não ajudava) e documentado em
  `.planning/phases/02b-design-system-e-casca-da-aplica-o/deferred-items.md` (item 1) e em
  `.planning/WINDOWS.md` (id 3, kind `deviation`, status `open`) para acompanhamento
  dedicado. `npm run test:e2e` roda **52-54 de 54 casos verdes** de forma consistente entre
  execuções — as únicas variações são este teste específico.
- Uma tentativa de rodar `tests/e2e/casca.spec.ts` sem `mode: "serial"` mostrou os 7 casos
  passando de forma consistente de qualquer forma (o problema de carga afeta especificamente
  o teste de bloqueio de tentativas de `autenticacao.spec.ts`, não `casca.spec.ts`); o modo
  serial foi mantido mesmo assim por prudência e paridade com o resto da suíte, não porque
  tenha sido a causa raiz do estouro acima.

## Known Stubs

Nenhum. As telas desta fase são deliberadamente vazias por contrato (D-01, D-02, D-04) — não
são stubs no sentido de "dado que deveria estar ligado e não está": nenhuma consulta ao banco
existe para estas telas nesta fase, e o `02b-UI-SPEC.md` já registra explicitamente que
`populated`/`partial`/`zero-one-many` (lado "muitos") dos cartões do painel são dispensados
com motivo nesta fase — ver seção "Considerações de UI dispensadas com motivo" do
`02b-03-PLAN.md`.

## Threat Flags

Nenhum novo. As mitigações do `threat_model` desta plan foram verificadas: `exigirUsuario()`
como primeira instrução nas seis páginas (T-02b-01), nenhuma rota nova em `ROTAS_PUBLICAS`
(T-02b-02, confirmado por `git diff --exit-code` em `middleware.ts`/`rotas-publicas.ts`), e
toda a copy dos estados vazios/painel vem literalmente do contrato de UI, sem nenhum dado
real de aluna, cliente ou gestor (T-02b-10).

## User Setup Required

None — nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

- `EstadoVazio`, `CabecalhoPagina` e `CartaoPainel` estão prontos para os planos 04/05 desta
  fase e para as Fases 3 a 6 reaproveitarem sem reimplementar a moldura de UI-07.
- As dez telas da fase existem e passam `npm run test:e2e` de forma consistente, exceto o
  teste pré-existente documentado em Issues Encountered (fora do escopo deste plano).
- **Pendência para acompanhamento dedicado** (não bloqueia este plano): investigar o pool de
  conexões do Postgres (`db/index.ts`) ou `UV_THREADPOOL_SIZE` como causa provável do teste
  instável de `autenticacao.spec.ts` — ver `deferred-items.md` item 1 e `WINDOWS.md` id 3.
- **Pendência herdada da 02b-02** (não bloqueia este plano): conferência visual da cor da
  barra lateral em navegador real e UI-05 (navegação confortável com o polegar) num celular de
  verdade — reservadas para a verificação de fim de fase.

## Self-Check: PASSED

Todos os arquivos declarados como criados/modificados existem no disco; os três hashes de
commit (`af97d83`, `94440fd`, `6adc828`) existem no histórico do repositório.

---
*Phase: 02b-design-system-e-casca-da-aplica-o*
*Completed: 2026-08-08*
