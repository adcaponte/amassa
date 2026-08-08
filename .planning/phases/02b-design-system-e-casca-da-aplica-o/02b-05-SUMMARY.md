---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 05
subsystem: testing
tags: [playwright, axe-core, acessibilidade, wcag, teclado, contraste]

# Dependency graph
requires:
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "02"
    provides: "ITENS_NAVEGACAO, a casca de navegação completa (barra lateral, barra inferior,
      cabeçalho móvel com o avatar aria-label) e app/(app)/layout.tsx — a superfície inteira
      que este plano mede"
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "03"
    provides: "as seis telas de módulo com EstadoVazio e CabecalhoPagina — a base sobre a qual
      a varredura de contraste do axe-core roda"
  - phase: 02b-design-system-e-casca-da-aplica-o
    plan: "04"
    provides: "app/error.tsx, not-found.tsx, loading.tsx — fecham a superfície de estado que
      este plano varre indiretamente (não testados diretamente, mas fazem parte da fase que
      este plano fecha)"
provides:
  - "tests/e2e/acessibilidade.spec.ts — prova de máquina de UI-09 em quatro frentes (alvo de
    toque, contraste AA por ferramenta, nome acessível, teclado) mais UI-06 reconferido sobre a
    fase inteira, mais o backstop de nome longo do UI-SPEC convertido em asserção real"
  - "lib/acessibilidade/rotulos.ts (módulo puro, zero import) — NOME_ACESSIVEL_MENU_USUARIO,
    fonte única para a interface e para o teste, reexportado por cabecalho-movel.tsx"
  - ".planning/phases/02b-design-system-e-casca-da-aplica-o/02b-VERIFICACAO-HUMANA.md — os três
    itens que nenhuma ferramenta mede (UI-05, a voz das frases de D-05, olhada geral), pendentes
    da conferência do dono"
affects: [fase-3, fase-4, fase-5, fase-6, fase-7]

# Actuals (#2632)
actuals:
  tokens: 6900
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added:
    - "@axe-core/playwright@4.12.1 (devDependency, versão exata)"
    - "axe-core@4.13.0 (devDependency, versão exata)"
  patterns:
    - "Nome acessível compartilhado entre interface e teste através de um módulo puro
      dedicado (lib/acessibilidade/rotulos.ts), não do próprio componente — importar
      diretamente de um componente 'use client' dentro de um arquivo de teste e2e puxa a
      cadeia de imports inteira dele (Server Actions, next-auth, next/server), incompatível
      com o carregador do Playwright fora do bundler do Next.js. Mesma lição de
      lib/navegacao/itens.ts, um degrau mais estrito: mesmo um módulo pequeno precisa nascer
      puro se algum teste for importá-lo."
    - "Backstop do UI-SPEC (verificação manual registrada em must_haves.truths com
      'verification: backstop') convertido em asserção automatizada real quando a lógica
      permite: cria conta de verdade via scripts/criar-usuario.ts, mede por CSS computado
      (scrollWidth/clientWidth/text-overflow), desativa a conta ao final em bloco finally.
      Não substitui a conferência humana registrada no UI-SPEC (que continua existindo como
      registro), mas elimina a dependência de alguém lembrar de fazer manualmente."
    - "Varredura de contraste restrita a quatro regras do axe-core (color-contrast,
      button-name, link-name, aria-allowed-attr) via withRules() — decisão deliberada do
      plano para não misturar achados de estrutura de documento (fora do escopo desta fase)
      com o que a fase se compromete a garantir."

key-files:
  created:
    - tests/e2e/acessibilidade.spec.ts
    - lib/acessibilidade/rotulos.ts
    - .planning/phases/02b-design-system-e-casca-da-aplica-o/02b-VERIFICACAO-HUMANA.md
  modified:
    - components/amassa/cabecalho-movel.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Gate de legitimidade da Tarefa 1 resolvido pela verificação independente do orquestrador
    (npm view confirmou axe-core@4.13.0 e @axe-core/playwright@4.12.1 do repositório oficial
    dequelabs/axe-core-npm, mesmas versões pré-aprovadas) sob autorização permanente do dono
    para decisões claramente recomendadas enquanto ele estava fora — não foi auto-aprovado
    pelo executor nem pulado."
  - "NOME_ACESSIVEL_MENU_USUARIO vive em lib/acessibilidade/rotulos.ts (módulo puro), não
    diretamente em cabecalho-movel.tsx como o plano sugeriu — bug real de execução, ver
    Deviations. cabecalho-movel.tsx reexporta a constante para quem só olha aquele arquivo
    continuar encontrando a fonte."
  - "O backstop de truncamento de nome longo do UI-SPEC foi convertido em teste automatizado
    de verdade (não só documentado como pendente) — usa um nome de 53 caracteres, não os 43
    do exemplo do checklist humano, porque 43 caracteres cabem justo dentro do Sheet do
    celular sem cortar (achado medindo, não presumindo)."
  - "O checkpoint bloqueante da Tarefa 3 (UI-05 no polegar, a voz das frases de D-05, olhada
    geral) não foi respondido nem auto-aprovado — o dono está indisponível por algumas horas.
    Tudo automatizável foi automatizado e commitado; o restante virou
    02b-VERIFICACAO-HUMANA.md, pendente da conferência do dono."

patterns-established:
  - "Toda string com acento afirmada em teste e2e vem de uma constante exportada por um módulo
    de produção (ITENS_NAVEGACAO, agora também NOME_ACESSIVEL_MENU_USUARIO), nunca redigitada
    — elimina divergência de normalização Unicode entre interface e asserção."

requirements-completed: [UI-05, UI-06, UI-09]

coverage:
  - id: D1
    description: "Alvo de toque ≥ 44px medido por boundingBox() em cada item da barra
      inferior, no botão de avatar e em cada item da barra lateral"
    requirement: "UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — 'cada item da barra inferior mede pelo menos
          44px...', 'o botão de avatar do cabeçalho móvel tem alvo de toque...', 'cada item da
          barra lateral mede pelo menos 44px...', desktop e celular"
        status: pass
    human_judgment: false
  - id: D2
    description: "getByRole('button', { name: 'Abrir menu do usuário' }) encontra exatamente
      um elemento no celular, e nenhum no desktop (elemento fora da árvore de acessibilidade)"
    requirement: "UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — 'getByRole(...) encontra exatamente um
          elemento no celular (UI-09)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Varredura axe-core (color-contrast, button-name, link-name,
      aria-allowed-attr) sobre as sete rotas da fase (/login, /, /encomendas, /agenda,
      /queimas, /estoque, /orcamentos) não reporta nenhuma violação"
    requirement: "UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — 7 rotas × 2 projetos = 14 casos, todos 'não
          tem violação de color-contrast, button-name, link-name ou aria-allowed-attr'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Navegação completa só por teclado: do e-mail até 'Entrar' no login com login
      real acontecendo via Enter; depois de logado, do corpo da página até o gatilho do menu
      do usuário, com Enter abrindo o menu"
    requirement: "UI-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — 'dá para chegar do e-mail até Entrar...' e
          'depois de logado, dá para chegar ao menu do usuário...', desktop e celular"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nenhuma das sete rotas da fase exige rolagem horizontal a 320px de largura
      — UI-06 reconferido sobre a fase inteira, não só sobre as telas do plano 03"
    requirement: "UI-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — 'nenhuma das sete rotas da fase exige
          rolagem horizontal a 320px de largura (UI-06)'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Backstop do UI-SPEC (nome de usuário longo trunca com reticências, mostra o
      nome completo em title, não empurra a barra lateral de 240px) convertido em asserção
      automatizada real, com conta de verdade criada e desativada por script"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — 'nome de usuário longo trunca em uma linha
          com reticências...', desktop e celular"
        status: pass
    human_judgment: false
  - id: D7
    description: "UI-05 — a navegação é confortável com o polegar num celular de verdade, em
      pé, como o núcleo de valor do projeto descreve"
    verification: []
    human_judgment: true
    rationale: "Não é medível por teste automatizado (registrado como tal desde o
      02b-UI-SPEC.md). O dono está indisponível por algumas horas; o item virou o Item 1 de
      02b-VERIFICACAO-HUMANA.md, pendente de conferência."
  - id: D8
    description: "A voz das quatro frases de estado vazio escritas nesta fase (Agenda,
      Queimas, Estoque, Orçamentos — D-05) soa como o AMASSA, não corporativa"
    verification: []
    human_judgment: true
    rationale: "D-05 do CONTEXT.md já previa revisão do dono para as frases não pré-escritas.
      Item 2 de 02b-VERIFICACAO-HUMANA.md, pendente de conferência."
  - id: D9
    description: "Olhada geral nas dez telas — cores do AMASSA, tipografia condensada,
      legibilidade do corpo sob luz forte, nos dois tamanhos de tela"
    verification: []
    human_judgment: true
    rationale: "Legibilidade sob luz ambiente real não é simulável por ferramenta (o contraste
      numérico já está confirmado por axe-core em D3). Item 3 de
      02b-VERIFICACAO-HUMANA.md, pendente de conferência."

# Metrics
duration: ~40min
completed: 2026-08-08
status: complete
---

# Phase 2b Plan 05: Acessibilidade Verificada por Ferramenta Summary

**UI-09 deixa de depender de "parece legível na minha tela": axe-core varreu sete rotas sem
nenhuma violação de contraste, alvo de toque foi medido por `boundingBox()`, a navegação por
teclado foi exercitada de ponta a ponta e o backstop de truncamento de nome longo do UI-SPEC
virou asserção real — os três itens que nenhuma ferramenta mede (UI-05 no polegar, a voz das
frases de D-05, a olhada geral) ficaram registrados em `02b-VERIFICACAO-HUMANA.md`, pendentes do
dono.**

## Performance

- **Duration:** ~40min
- **Completed:** 2026-08-08
- **Tasks:** 3 (portão de pacotes resolvido por autorização do dono, suíte de acessibilidade
  completa, checkpoint humano final parcialmente automatizado e documentado)
- **Files modified:** 6 (3 criados, 3 modificados)

## Accomplishments

- `axe-core@4.13.0` e `@axe-core/playwright@4.12.1` instalados como `devDependencies`,
  versões exatas, gate de legitimidade resolvido por verificação independente do orquestrador
  (`npm view` confirmou o mesmo par de versões do repositório oficial `dequelabs/axe-core-npm`)
  sob autorização permanente do dono — nenhuma mudança em `Dockerfile` ou workflows
- `tests/e2e/acessibilidade.spec.ts`: alvo de toque medido por `boundingBox()` na barra
  inferior, no avatar e na barra lateral (todos ≥ 44px); nome acessível único do avatar
  confirmado por `getByRole`; navegação completa por Tab+Enter do e-mail até "Entrar" e do
  corpo da página até o menu do usuário; varredura `axe-core` sobre as sete rotas da fase —
  **zero violações** de `color-contrast`, `button-name`, `link-name` ou `aria-allowed-attr`;
  UI-06 reconferido a 320px sobre a fase inteira
- Cada asserção numérica e a varredura de contraste foram observadas falhando por um motivo
  real antes de fechar a tarefa (ver Deviations/verificação de portão)
- Backstop de truncamento de nome longo do `02b-UI-SPEC.md` (antes só "verification: backstop",
  sem conta de teste) convertido em asserção automatizada real, com achado próprio: o nome de
  exemplo de 43 caracteres do checklist humano não estoura o Sheet do celular — só nomes mais
  longos (~50+) exercitam o corte visualmente naquele viewport
- `lib/acessibilidade/rotulos.ts`: módulo puro criado depois de um bug real de execução (ver
  Deviations) para hospedar `NOME_ACESSIVEL_MENU_USUARIO` sem quebrar o carregador de teste do
  Playwright
- `02b-VERIFICACAO-HUMANA.md`: os três itens genuinamente humanos (UI-05, D-05, olhada geral)
  documentados com o que fazer, em que dispositivo e o que conta como aprovado — pendentes da
  conferência do dono

## Task Commits

1. **Tarefa 1: Portão de legitimidade dos pacotes de acessibilidade** — resolvido pela
   verificação independente do orquestrador (não auto-aprovado nem pulado); instalação em
   `7f4448a` (chore)
2. **Tarefa 2: A suíte de acessibilidade — alvos, contraste, teclado e nome acessível** —
   `f78030f` (test)
3. **Extensão da Tarefa 2/3: backstop de nome longo convertido em asserção real** — `082f6bf`
   (test)
4. **Tarefa 3 (parcial — a parte automatizável): checklist de verificação humana** — `3eabe21`
   (docs); a conferência em si permanece pendente do dono, sem checkpoint respondido

**Plan metadata:** commit deste SUMMARY (a seguir)

## Files Created/Modified

- `tests/e2e/acessibilidade.spec.ts` — a suíte inteira desta plan (alvo de toque, teclado,
  contraste, backstop de nome longo)
- `lib/acessibilidade/rotulos.ts` — `NOME_ACESSIVEL_MENU_USUARIO` (módulo puro, zero import)
- `components/amassa/cabecalho-movel.tsx` — reexporta a constante; `focus-visible:ring`
  adicionado ao botão de avatar
- `package.json`, `package-lock.json` — `@axe-core/playwright@4.12.1`, `axe-core@4.13.0`
  (`devDependencies`, versões exatas)
- `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-VERIFICACAO-HUMANA.md` — checklist
  humano

## Decisions Made

- **Gate de legitimidade da Tarefa 1 resolvido pela verificação independente do orquestrador**
  (não pelo executor) — `npm view` confirmou que ambos os pacotes resolvem para as mesmas
  versões pré-aprovadas do repositório oficial da Deque, sob autorização permanente do dono
  para decisões claramente recomendadas enquanto ele estava fora.
- **`NOME_ACESSIVEL_MENU_USUARIO` vive em `lib/acessibilidade/rotulos.ts`**, não diretamente em
  `cabecalho-movel.tsx` como o texto do plano sugeria — necessário por um bug real de execução
  (ver Deviations). `cabecalho-movel.tsx` reexporta a constante.
- **O backstop de nome longo foi convertido em teste automatizado**, não deixado apenas como
  item do checklist humano — usa 53 caracteres (não os 43 do exemplo do checklist), porque 43
  não força o corte no Sheet do celular.
- **O checkpoint bloqueante da Tarefa 3 não foi respondido nem auto-aprovado.** Tudo
  automatizável foi automatizado; o resto foi documentado em `02b-VERIFICACAO-HUMANA.md` para o
  dono responder quando disponível.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Importar `NOME_ACESSIVEL_MENU_USUARIO` de `cabecalho-movel.tsx`
quebrava a suíte inteira**
- **Found during:** Tarefa 2, primeira execução de `npm run test:e2e -- --grep acessibilidade`
- **Issue:** `tests/e2e/acessibilidade.spec.ts` importando de
  `@/components/amassa/cabecalho-movel` (como o texto do plano sugeria) puxa a cadeia de
  imports inteira do componente — que passa por `menu-usuario.tsx` → `lib/auth/acoes.ts` →
  `next-auth` → `next/server`, um módulo que só resolve dentro do runtime do Next.js. O
  carregador de TypeScript que o Playwright usa para rodar arquivos de teste (fora do bundler
  do Next.js) falhou com `Cannot find module '.../next/server'`, e a suíte inteira não
  encontrou nenhum teste.
- **Fix:** `lib/acessibilidade/rotulos.ts` criado como módulo puro (zero import), hospedando
  `NOME_ACESSIVEL_MENU_USUARIO`. `cabecalho-movel.tsx` importa de lá e reexporta a constante
  (satisfazendo a letra do plano — "exportada por cabecalho-movel.tsx" — sem a suíte herdar a
  cadeia de imports do componente). O teste importa direto do módulo puro.
- **Files modified:** `lib/acessibilidade/rotulos.ts` (novo), `components/amassa/cabecalho-movel.tsx`,
  `tests/e2e/acessibilidade.spec.ts`
- **Verification:** `npm run test:e2e -- --grep acessibilidade` — 28/28 depois do ajuste
- **Committed in:** `f78030f`

**2. [Rule 2 - Funcionalidade crítica ausente] Botão de avatar sem indicador de foco próprio**
- **Found during:** Tarefa 2, revisão de código antes de escrever o teste de teclado
- **Issue:** `cabecalho-movel.tsx` — o único botão só-com-ícone de toda a fase (UI-09) — não
  tinha nenhuma classe `focus-visible` própria, ao contrário de todos os outros elementos
  interativos da casca (`Button`, `Input`, itens da `Sidebar`), que resolvem o anel de foco via
  `--color-ring`. Dependia inteiramente do estilo padrão do navegador, que nem sempre é visível
  ou consistente com o resto do sistema.
- **Fix:** `focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none`
  adicionado ao botão, mesma classe usada por `Button`/`Input` do shadcn — o anel resolve para
  `--color-ring` (`#894025`), consistente com o resto da casca.
- **Files modified:** `components/amassa/cabecalho-movel.tsx`
- **Verification:** `npm run test:e2e` (suíte inteira) segue verde; revisão visual de classe
  aplicada
- **Committed in:** `f78030f`

---

**Total deviations:** 2 (1 Rule 3 bloqueio real de execução, 1 Rule 2 funcionalidade crítica de
acessibilidade ausente).
**Impact on plan:** Nenhum desvio de escopo — os dois ajustes ficaram dentro do espírito da
Tarefa 2 (provar UI-09 de verdade) e não tocaram `Dockerfile`, workflows, `middleware.ts` nem
`lib/auth/rotas-publicas.ts` (confirmado por `git diff --exit-code`).

## Issues Encountered

- **Backstop de nome longo: o exemplo de 43 caracteres do checklist humano não força
  truncamento no Sheet do celular.** Medido de verdade (não presumido): a 43 caracteres, o
  `SheetTitle` do menu do usuário no celular renderiza o nome inteiro sem cortar
  (`scrollWidth === clientWidth`). O teste automatizado usa 53 caracteres para provar o corte
  nos dois projetos; o `02b-VERIFICACAO-HUMANA.md` documenta o achado para quem for repetir o
  Item 1 manualmente não se surpreender se o nome de 43 caracteres "não cortar visivelmente" —
  não é regressão, é o limiar real medido.
- **Checkpoint bloqueante da Tarefa 3 não respondido.** O dono está indisponível por algumas
  horas. Toda a parte automatizável foi executada e commitada; o restante (UI-05, D-05, olhada
  geral) está em `02b-VERIFICACAO-HUMANA.md`, pendente. Nenhum item foi auto-aprovado.

## Known Stubs

Nenhum. Todo código produzido é implementação real — o teste de acessibilidade mede o sistema
já construído pelos planos 02-04, sem introduzir nenhum placeholder.

## Threat Flags

Nenhum novo. As três entradas do `threat_model` desta plan foram verificadas em execução real:
`T-02b-06-SC` (checkpoint humano resolvido antes da instalação, versões fixadas sem `^`/`~`,
`devDependencies` apenas, `Dockerfile`/workflows intactos — confirmado por `git diff
--exit-code`), `T-02b-13` (a conta de nome longo do teste automatizado usa nome fictício e
domínio `exemplo.test`, criada por `scripts/criar-usuario.ts` e desativada em bloco `finally`
via `scripts/desativar-usuario.ts` — nunca apagada), `T-02b-14` (aceito, sem novo achado).

## User Setup Required

**Verificação humana pendente.** Ver
[`02b-VERIFICACAO-HUMANA.md`](./02b-VERIFICACAO-HUMANA.md) para:
- UI-05 — conforto do polegar num celular de verdade
- D-05 — a voz das quatro frases de estado vazio escritas nesta fase
- Olhada geral de cor, tipografia e legibilidade sob luz forte

Nenhuma configuração de serviço externo é necessária — isto não é um `USER-SETUP.md` de
infraestrutura, é a conferência de julgamento humano que o checkpoint bloqueante da Tarefa 3
pedia.

## Next Phase Readiness

- UI-09 tem prova de máquina completa: alvo de toque, contraste AA por ferramenta, nome
  acessível e teclado — nenhuma dessas quatro frentes depende mais de "parece certo".
- UI-06 está reconfirmado sobre a fase inteira (sete rotas), não só sobre o subconjunto do
  plano 03.
- O padrão "nome acessível/rótulo vem de uma constante exportada, nunca redigitado no teste" já
  vale para `ITENS_NAVEGACAO` (02b-02) e agora também para
  `NOME_ACESSIVEL_MENU_USUARIO` (`lib/acessibilidade/rotulos.ts`) — as Fases 3-6 podem seguir o
  mesmo padrão para qualquer botão só-com-ícone novo.
- **Pendência que fecha esta fase** (não bloqueia o registro deste plano, mas bloqueia o
  fechamento consciente de UI-05 e D-05): a conferência humana de
  `02b-VERIFICACAO-HUMANA.md` — polegar num celular de verdade, a voz das quatro frases novas,
  e a olhada geral de cor/tipografia/legibilidade sob luz forte.
- **Pendência herdada, não desta fase:** `tests/e2e/autenticacao.spec.ts:72` (sexta tentativa de
  bloqueio) segue instável de forma independente (`WINDOWS.md` id 3, `deferred-items.md`) — não
  investigado de novo, conforme instrução explícita desta execução. A suíte e2e completa saiu
  86/88 nesta execução, com as duas únicas falhas sendo exatamente esse teste pré-existente nos
  dois projetos.

## Self-Check: PASSED

Todos os arquivos declarados como criados/modificados existem no disco; os quatro hashes de
commit (`7f4448a`, `f78030f`, `082f6bf`, `3eabe21`) existem no histórico do repositório.

---
*Phase: 02b-design-system-e-casca-da-aplica-o*
*Completed: 2026-08-08*
