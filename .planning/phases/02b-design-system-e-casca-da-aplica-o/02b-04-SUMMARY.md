---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 04
subsystem: ui
tags: [next-app-router, error-boundary, not-found, skeleton, playwright, threat-model]

# Dependency graph
requires:
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "02"
    provides: "app/(app)/layout.tsx (a casca de navegação) e a barra lateral/inferior que este
      plano confirma sobreviver — ou não — a um estado de falha"
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "03"
    provides: "components/amassa/estado-vazio.tsx como o modelo estrutural (props, largura
      máxima de leitura) que estado-erro.tsx espelha"
provides:
  - "components/amassa/estado-erro.tsx (EstadoErro) — terceiro e último componente
    compartilhado de UI-07 (vazio, esqueleto, erro), reutilizado por app/(app)/error.tsx e
    pelos dois not-found.tsx"
  - "app/(app)/error.tsx, app/(app)/not-found.tsx, app/(app)/loading.tsx, app/not-found.tsx —
    os quatro arquivos de convenção do Next.js que fecham a cobertura de estado da fase"
  - "docs/convencoes-de-interface.md — onde UI-08 (confirmação destrutiva) passa a existir como
    contrato escrito para as Fases 3 a 6, junto da fronteira components/ui/ x
    components/amassa/, o que cada fase instala e as regras duras herdadas"
  - "tests/e2e/estados.spec.ts — prova de que o 404 alcançável por URL fica fora da casca por
    construção do App Router (achado em execução, documentado para as fases seguintes não
    reintroduzir a suposição errada)"
affects: [fase-3, fase-4, fase-5, fase-6]

# Actuals (#2632)
actuals:
  tokens: 4400
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EstadoErro (Server Component puro): { titulo, corpo, acao? } — acao é ReactNode porque
      quem usa decide se é botão de cliente (reset(), em error.tsx) ou link de servidor (em
      not-found.tsx); o componente em si nunca precisa de 'use client'"
    - "app/(app)/error.tsx é o único arquivo novo desta fase que precisa de 'use client'
      (exigência do Next.js para todo error.tsx) — chama console.error(error) num useEffect e
      nunca renderiza error.message/error.stack/error.digest na tela"
    - "loading.tsx no formato do conteúdo: Skeleton dimensionado como o cabeçalho de página
      (altura do título) + blocos do tamanho da área de conteúdo, zero cadeia de texto entre
      as tags — o padrão que as Fases 3-6 copiam quando ganharem consulta real ao banco"

key-files:
  created:
    - components/amassa/estado-erro.tsx
    - "app/(app)/error.tsx"
    - "app/(app)/not-found.tsx"
    - app/not-found.tsx
    - "app/(app)/loading.tsx"
    - docs/convencoes-de-interface.md
    - tests/e2e/estados.spec.ts
  modified: []

key-decisions:
  - "app/not-found.tsx (raiz) foi criado, não descartado — confirmado em execução real
    (servidor de produção + login com conta real + duas formas de URL inexistente) que é
    SEMPRE ele quem responde a uma URL sem casamento nenhum, nunca app/(app)/not-found.tsx.
    Isso vale inclusive para uma sub-rota de um módulo existente (/encomendas/algo-que-nao-
    existe), não só para um caminho de primeiro nível — o Next.js só entra na árvore de
    layout de um segmento depois de casar a URL com uma rota definida dentro dele."
  - "app/(app)/not-found.tsx foi mantido mesmo sendo código morto nesta fase (nenhuma URL o
    alcança hoje) — ele é o contrato correto para quando uma página futura chamar notFound()
    de dentro do grupo protegido (ex.: /encomendas/[id] na Fase 3), e removê-lo obrigaria a
    Fase 3 a recriar exatamente este arquivo do zero."
  - "tests/e2e/estados.spec.ts substitui a suposição do plano ('a navegação sobrevive na tela
    de 404') pela asserção oposta e verdadeira ('a navegação está ausente do 404 alcançável
    por URL, por construção') — ver Deviations. A propriedade que o plano queria provar
    (navegação sobrevive a error.tsx/not-found.tsx aninhado) continua válida por garantia do
    próprio framework (arquivo físico dentro de app/(app)/), só não é alcançável por e2e nesta
    fase sem instrumentar uma rota que quebra de propósito — o que a Tarefa 3 já proíbe para
    error.tsx pelo mesmo motivo."

patterns-established:
  - "Verificação de roteamento do Next.js feita com sessão real, não presumida: dois usuários
    de verificação (verificacao.02b04@exemplo.test, verificacao.02b04b@exemplo.test) foram
    criados no banco de desenvolvimento, usados para logar de verdade num servidor de produção
    local (npm run build && npm run start com AUTH_TRUST_HOST/AUTH_SECRET), e desativados
    (ativo = false, nunca apagados) ao final — mesmo padrão de limpeza já usado na 02b-02."

requirements-completed: [UI-07, UI-08]

coverage:
  - id: D1
    description: "EstadoErro existe com a assinatura do contrato (titulo/corpo/acao?),
      role=\"alert\" no contêiner, e app/(app)/error.tsx usa 'use client' + reset() + a copy
      literal do contrato, sem renderizar nenhuma propriedade de error na tela"
    requirement: "UI-07"
    verification:
      - kind: automated
        ref: "npm run lint (0) + npx tsc --noEmit (0) + grep -c 'error.message\\|error.stack\\|error.digest' app/(app)/error.tsx (0) + grep de role=\"alert\"/Tentar de novo/copy literal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma URL inexistente com sessão válida mostra 'Esta página não existe.' e o
      link 'Voltar para o painel' leva a /"
    requirement: "UI-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/estados.spec.ts — 'uma URL inexistente com sessão válida mostra o 404 e o link volta para o painel (UI-07)', desktop e celular"
        status: pass
    human_judgment: false
  - id: D3
    description: "app/(app)/loading.tsx usa Skeleton no formato do conteúdo (cabeçalho +
      área de conteúdo), sem nenhuma cadeia de texto solta entre as tags"
    requirement: "UI-07"
    verification:
      - kind: automated
        ref: "npm run lint (0) + npx tsc --noEmit (0) + npm run build (sucesso) + revisão de
          código (só componentes Skeleton e elementos de leiaute no JSX)"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/convencoes-de-interface.md registra UI-08 (formato + exemplo literal
      'Coleção Verão'), os três componentes de UI-07, a fronteira components/ui/ x
      components/amassa/, o que cada fase instala, a duração dos avisos e as regras duras
      herdadas (44px, 16px, um botão terracota por tela), inteiramente em português"
    requirement: "UI-08"
    verification:
      - kind: automated
        ref: "grep -q 'Coleção Verão'/'alert-dialog'/'sonner'/'estado-vazio.tsx'/'estado-erro.tsx'/'44px'/'16px' docs/convencoes-de-interface.md — todos encontrados"
        status: pass
    human_judgment: false
  - id: D5
    description: "O 404 alcançável por URL não expõe a casca de navegação (barra lateral/
      inferior ausentes, não só ocultas por CSS) e não vaza detalhe técnico (error/stack/
      digest/caminho de pilha) no corpo da página"
    requirement: "UI-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/estados.spec.ts — 'o 404 de uma URL inexistente não expõe a casca de navegação' e 'o 404 não vaza nenhum detalhe técnico', desktop e celular"
        status: pass
    human_judgment: false
  - id: D6
    description: "A navegação sobrevive a app/(app)/error.tsx e a app/(app)/not-found.tsx
      quando algum deles de fato renderizar (ambos vivem fisicamente dentro de
      app/(app)/layout.tsx, garantia estrutural do App Router) — propriedade não exercitável
      por e2e nesta fase"
    verification: []
    human_judgment: true
    rationale: "Nem error.tsx nem app/(app)/not-found.tsx são alcançáveis por nenhuma URL
      nesta fase: não há rota dinâmica que chame notFound(), e instrumentar uma rota que
      quebra de propósito só para exercitar error.tsx é exatamente o que a Tarefa 3 do plano
      proíbe. A garantia vem da posição física do arquivo na árvore de app/ (contrato do
      framework) mais revisão de código — vale reconferir quando a Fase 3 criar a primeira
      rota dinâmica com notFound() de verdade."

# Metrics
duration: ~50min (inclui duas rodadas de verificação manual com servidor real e conta de teste
  para confirmar qual not-found.tsx responde a uma URL inexistente)
completed: 2026-08-08
status: complete
---

# Phase 2b Plan 04: Estado de Erro, 404 e Esqueleto de Carregamento Summary

**UI-07 fecha com `EstadoErro` (role="alert") reutilizado por `error.tsx`/`not-found.tsx`, um
`loading.tsx` no formato do conteúdo, e UI-08 vira contrato escrito em
`docs/convencoes-de-interface.md` — com um achado real de roteamento do Next.js que corrige a
suposição do próprio plano: o 404 alcançável por qualquer URL inexistente é sempre
`app/not-found.tsx` da raiz, fora da casca, nunca o arquivo aninhado do grupo protegido.**

## Performance

- **Duration:** ~50min, incluindo duas rodadas de verificação manual (servidor de produção
  local + contas de teste reais) para confirmar em execução, não presumir, qual dos dois
  `not-found.tsx` de fato responde
- **Completed:** 2026-08-08
- **Tasks:** 3 (componente + 4 arquivos de convenção do Next.js, documento de convenções,
  prova e2e)
- **Files modified:** 7 (7 criados, 0 modificados)

## Accomplishments

- `components/amassa/estado-erro.tsx`: `EstadoErro` (Server Component, `role="alert"`, mesma
  largura máxima de leitura de `EstadoVazio`), terceiro e último componente compartilhado de
  UI-07
- `app/(app)/error.tsx`: boundary de erro (`"use client"`), copy fixa e humana, botão "Tentar
  de novo" ligado a `reset()`, nenhuma propriedade de `error` (mensagem/pilha/digest)
  renderizada na tela
- `app/(app)/loading.tsx`: esqueleto no formato do cabeçalho de página + área de conteúdo
  (D-03), sem nenhuma cadeia de texto solta
- `app/(app)/not-found.tsx` e `app/not-found.tsx`: os dois 404, com a descoberta real de qual
  dos dois efetivamente atende uma URL inexistente — ver Deviations
- `docs/convencoes-de-interface.md`: UI-08 (formato + exemplo literal de confirmação
  destrutiva), os três componentes de UI-07, a fronteira `components/ui/` ×
  `components/amassa/`, o que cada fase instala, duração dos avisos e as regras duras herdadas
- `tests/e2e/estados.spec.ts`: 3 casos × 2 projetos provando a copy do 404, o link de volta
  funcionando, a ausência estrutural de navegação no 404 alcançável, e a ausência de
  vazamento técnico

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Componente de erro e arquivos de convenção do Next.js** — `1a01685` (feat)
2. **Tarefa 2: Documento de convenções de interface (UI-08)** — `8fbbb61` (docs)
3. **Tarefa 3: Prova e2e dos três estados** — `29e0f36` (test)

**Plan metadata:** commit deste SUMMARY (a seguir)

## Files Created/Modified

- `components/amassa/estado-erro.tsx` — `EstadoErro({titulo, corpo, acao?})`, `role="alert"`
- `app/(app)/error.tsx` — boundary de erro do grupo protegido, `"use client"`, `reset()`
- `app/(app)/not-found.tsx` — 404 para `notFound()` chamado de dentro do grupo (código morto
  nesta fase, sem rota dinâmica que o dispare ainda)
- `app/not-found.tsx` — 404 real, fora da casca, que responde a qualquer URL sem casamento
- `app/(app)/loading.tsx` — esqueleto de navegação entre módulos, formato do conteúdo
- `docs/convencoes-de-interface.md` — o documento novo
- `tests/e2e/estados.spec.ts` — a prova nova

## Decisions Made

- **`app/not-found.tsx` foi criado** (não descartado) — comportamento confirmado em execução
  real: qualquer URL sem casamento nenhum, inclusive uma sub-rota de módulo existente
  (`/encomendas/algo-que-nao-existe`), cai neste arquivo de raiz, nunca no aninhado. Ver
  Deviations para os detalhes da verificação.
- **`app/(app)/not-found.tsx` foi mantido mesmo sem nenhuma URL alcançá-lo hoje** — é o
  contrato correto para quando a Fase 3 introduzir a primeira rota dinâmica que chama
  `notFound()` (ex.: `/encomendas/[id]`); removê-lo só empurraria o trabalho de recriá-lo para
  a fase seguinte.
- **`EstadoErro.acao` é `ReactNode`, não uma prop mais específica** — `error.tsx` precisa de um
  botão de cliente (`onClick={() => reset()}`), `not-found.tsx` precisa de um link de servidor
  (`<Link href="/">`); o componente compartilhado não decide isso por quem usa, só reserva o
  espaço abaixo do corpo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Suposição do plano corrigida por execução real] A navegação NÃO sobrevive no
404 alcançável por URL — é o contrário do que o plano presumia**
- **Found during:** Tarefa 1 (verificação obrigatória do plano: "suba a aplicação e visite uma
  URL inventada com sessão válida... registre no SUMMARY qual dos dois caminhos foi o real")
- **Issue:** O `02b-04-PLAN.md` (Tarefa 3, caso 2, e o `must_have` "E1/E3 erro") presumia que a
  tela de 404 alcançável por uma URL inexistente ficaria DENTRO da casca — com a barra lateral
  e a barra inferior ainda visíveis, provando que "a navegação vive no layout, fora do
  boundary". A verificação em execução real (build de produção, servidor local com
  `AUTH_TRUST_HOST`/`AUTH_SECRET`, login com uma conta real criada para o teste, visita a
  `/rota-que-nao-existe-2b` e, numa segunda rodada, também a `/encomendas/inexistente-xyz` —
  uma sub-rota de um módulo que EXISTE) mostrou o oposto: o corpo da página não tinha nenhum
  vestígio de navegação, e `getByRole("navigation", ...)`/`[data-slot="sidebar"]` não
  encontravam nada (ausência estrutural, não CSS escondendo). Isso acontece porque o Next.js
  App Router só entra na árvore de layout de um segmento depois de casar a URL com uma rota
  definida dentro dele — uma URL sem casamento nenhum (mesmo uma sub-rota de um módulo real)
  nunca "entra" no grupo `(app)`, então o layout dele (e a casca que ele monta) nunca chega a
  rodar. Quem responde é sempre `app/not-found.tsx` da raiz, fora do grupo protegido.
- **Fix:** `tests/e2e/estados.spec.ts` foi escrito provando o comportamento REAL (navegação
  ausente do 404, com `toHaveCount(0)`, não `isVisible()`) em vez do presumido, com um
  comentário extenso no topo do arquivo explicando o porquê e apontando para esta seção do
  SUMMARY. A propriedade que a Tarefa 3 original queria provar (navegação sobrevive a um
  boundary de falha) continua logicamente válida para `app/(app)/error.tsx` e
  `app/(app)/not-found.tsx` — ambos vivem fisicamente dentro de `app/(app)/layout.tsx`, o que é
  garantia do próprio framework — só não é alcançável por nenhuma URL nesta fase (não há rota
  dinâmica que chame `notFound()` ainda, e instrumentar uma rota que quebra de propósito só
  para o teste é exatamente o que a Tarefa 3 já proíbe para `error.tsx` pelo mesmo motivo).
  Documentado como item D6 de cobertura (`human_judgment: true`), a reconferir quando a Fase 3
  criar a primeira rota dinâmica com `notFound()` de verdade.
- **Files modified:** `tests/e2e/estados.spec.ts` (nenhum arquivo de produção precisou mudar —
  o comportamento do framework já era esse; só a suposição escrita no plano estava errada)
- **Verification:** `npm run test:e2e -- --grep "estados"` — 6/6 nos dois projetos; duas contas
  de verificação criadas e desativadas (`ativo = false`, nunca apagadas) no banco de
  desenvolvimento durante a investigação, mesmo padrão de limpeza da 02b-02
- **Committed in:** `29e0f36`

---

**Total deviations:** 1 (Rule 1, achado e corrigido rodando o servidor real, não por leitura de
código — exatamente o tipo de verificação que o próprio plano pedia para esta tarefa).
**Impact on plan:** Nenhum código de produção mudou por causa deste achado — `app/not-found.tsx`
já estava previsto no plano como possibilidade condicional, e acabou sendo o caminho real. O
único ajuste foi o texto do teste e2e e a documentação da suposição corrigida.

## Issues Encountered

- **Verificação manual exigiu contorno de configuração do NextAuth.** `npm run start` (sem os
  mesmos env vars do `webServer` de `playwright.config.ts`) falha com `UntrustedHost` do
  Auth.js ao tentar logar — precisa de `AUTH_TRUST_HOST=true` e `AUTH_SECRET` explícitos, os
  mesmos valores efêmeros que o `playwright.config.ts` já usa. Resolvido reproduzindo
  exatamente esses dois env vars na verificação manual; nenhuma mudança de código motivada por
  isso (mesma classe de problema documentada como "Issues Encountered" na 02b-02, para a
  cor computada da barra lateral).
- **Teste pré-existente instável, confirmado de novo como independente desta fase.**
  `tests/e2e/autenticacao.spec.ts:72` estourou o timeout nos dois projetos durante
  `npm run test:e2e` completo (58/60 verdes) — o mesmo teste já documentado em
  `deferred-items.md` e `WINDOWS.md` (id 3) desde a 02b-03, não relacionado a nenhum arquivo
  deste plano. Não investigado de novo, por instrução explícita do carried_forward desta
  execução.

## Known Stubs

Nenhum. Todos os componentes e telas desta fase são implementações reais, não placeholders —
`EstadoErro` renderiza a copy fixa do contrato, `loading.tsx` é o padrão de esqueleto real que
as Fases 3-6 vão reaproveitar, e `docs/convencoes-de-interface.md` é o registro definitivo de
UI-08 (não um rascunho a substituir depois).

## Threat Flags

Nenhum novo. As três mitigações do `threat_model` desta plan foram verificadas em execução real,
não só por leitura: `T-02b-09` (nenhuma propriedade de `error` na tela — confirmado por grep e
pela ausência de "error"/"stack"/"digest" no corpo da página de teste), `T-02b-12` (a mesma copy
de 404 para qualquer caminho inexistente — confirmado com dois padrões de URL diferentes) e
`T-02b-01` (o `app/not-found.tsx` de raiz nunca exibe dado de sessão — confirmado: o corpo da
página de 404 não contém nome de usuário, e-mail nem qualquer outro dado que só apareceria
autenticado; o `middleware.ts` não foi tocado, `git diff --exit-code middleware.ts
lib/auth/rotas-publicas.ts app/globals.css` retorna 0).

## User Setup Required

None — nenhuma configuração de serviço externo é necessária.

## Next Phase Readiness

- UI-07 está completo: vazio (plano 03), esqueleto (este plano) e erro em linguagem humana
  (este plano) cobrem toda tela do sistema.
- UI-08 está registrado em `docs/convencoes-de-interface.md` — a Fase 3 instala `alert-dialog`
  e segue o formato literal de lá na primeira exclusão real.
- **Pendência para a Fase 3** (não bloqueia este plano): quando a primeira rota dinâmica com
  `notFound()` existir (ex.: `/encomendas/[id]`), vale exercitar `app/(app)/not-found.tsx` por
  e2e de verdade pela primeira vez, fechando o item D6 de cobertura deste plano (hoje
  `human_judgment: true`, verificado só por posição estrutural do arquivo).
- **Pendências herdadas de planos anteriores desta fase** (não bloqueiam este plano): a
  conferência visual da cor da barra lateral em navegador real, UI-05 num celular de verdade, e
  o teste pré-existente instável de `autenticacao.spec.ts:72` (ver `deferred-items.md` e
  `WINDOWS.md` id 3) — todas reservadas para a verificação de fim de fase.

## Self-Check: PASSED

Todos os arquivos declarados como criados existem no disco; os três hashes de commit
(`1a01685`, `8fbbb61`, `29e0f36`) existem no histórico do repositório.

---
*Phase: 02b-design-system-e-casca-da-aplica-o*
*Completed: 2026-08-08*
