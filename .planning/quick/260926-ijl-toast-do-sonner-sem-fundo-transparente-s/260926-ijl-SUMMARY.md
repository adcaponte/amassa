---
phase: quick-260926-ijl
plan: 1
subsystem: ui
tags: [sonner, toast, tailwind-v4, design-tokens, financeiro, queimas]

# Dependency graph
requires: []
provides:
  - "components/ui/sonner.tsx pinta fundo opaco (rgb(255, 255, 255)) — o mesmo Toaster único que
    serve Financeiro (Caixa/Venda/Despesa), Queimas (registro/Desfazer), Abertura, Cotações e
    Cadastros passa a ser legível sobre qualquer cartão atrás dele"
  - "tests/e2e/financeiro-caixa.spec.ts ganha asserção de background-color computado — qualquer
    regressão futura de --normal-bg volta a falhar de forma explícita, não só de geometria"
affects: []

actuals:
  tokens: 4200
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Tailwind v4 (@theme/@theme inline) só expõe as variáveis CSS pelo nome LITERAL declarado no
      bloco @theme — --color-popover, --color-border, --radius-xl. Um componente de terceiro
      (aqui, o sonner.tsx padrão do shadcn) que referencia var(--popover) ou var(--radius) sem o
      prefixo --color-/--radius- aponta para uma variável que nunca existiu no CSS gerado; sem
      fallback, var() resolve para nada, e a propriedade (aqui, background) fica vazia — não é
      erro de build nem de console, só um elemento sem a cor que deveria ter."
    - "Teste de geometria (bounding boxes) prova POSIÇÃO, nunca legibilidade. Um toast totalmente
      transparente passa em qualquer asserção de 'está acima da barra' — só uma asserção de
      getComputedStyle(...).backgroundColor pega um fundo ausente."

key-files:
  modified:
    - components/ui/sonner.tsx
    - tests/e2e/financeiro-caixa.spec.ts

key-decisions:
  - "As quatro variáveis do style inline (--normal-bg/--normal-text/--normal-border/
    --border-radius) foram remapeadas para os tokens REAIS do projeto (--color-popover,
    --color-popover-foreground, --color-border, --radius-xl) — os mesmos que dialog.tsx,
    dropdown-menu.tsx e select.tsx já usam para superfícies flutuantes. Nenhum token novo,
    nenhum valor de cor inventado."
  - "classNames.toast: \"cn-toast\" foi REMOVIDA, não definida. grep -rn \"cn-toast\" no
    repositório inteiro (incluindo todo *.css) não encontra nenhuma regra para essa classe —
    é um hook de estilização morto, provavelmente herdado de um boilerplate de referência do
    shadcn. Definir uma regra .cn-toast vazia só para justificar a classe seria inventar
    trabalho; remover a chave é o menor código que resolve o achado."
  - "Nenhuma sombra/borda extra foi adicionada. O próprio CSS do sonner
    (node_modules/sonner/dist/styles.css) já embute box-shadow e border na regra
    [data-sonner-toast][data-styled='true'] — uma vez que --normal-border resolve para um
    token real, a borda aparece de graça; a sombra (0px 4px 12px rgba(0,0,0,0.1)) nunca
    dependeu de nenhuma variável quebrada e sempre esteve lá, só invisível sem um fundo atrás
    dela para o olho notar a borda do toast."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "O aviso pinta background-color opaco (rgb(255, 255, 255)), nunca transparente"
    verification:
      - kind: e2e
        ref: "tests/e2e/financeiro-caixa.spec.ts:388 — par RED/GREEN, ver seção abaixo"
        status: pass
    human_judgment: false
  - id: D2
    description: "A asserção nova foi vista FALHAR (RED) antes da correção e PASSAR (GREEN) depois"
    verification:
      - kind: e2e
        ref: "par RED/GREEN medido nesta execução, commits 22166e8 (RED) e ef898ee (GREEN)"
        status: pass
    human_judgment: false
  - id: D3
    description: "sonner.tsx não referencia mais nenhuma variável CSS inexistente"
    verification:
      - kind: static
        ref: "grep -n \"popover\\|border\\|radius\" components/ui/sonner.tsx — só --color-popover/-popover-foreground/-border e --radius-xl"
        status: pass
    human_judgment: false
  - id: D4
    description: "cn-toast (classe morta) removida, com o motivo registrado"
    verification:
      - kind: static
        ref: "grep -rn \"cn-toast\" --include=\"*.tsx\" --include=\"*.css\" . — nenhuma ocorrência fora do PLAN/SUMMARY desta tarefa"
        status: pass
    human_judgment: false
  - id: D5
    description: "queimas-registro.spec.ts ('Desfazer' remove a queima) continua passando"
    verification:
      - kind: e2e
        ref: "npm run test:e2e -- --grep \"'Desfazer' remove a queima\" — 30/30 passed (desktop + celular)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run verificar passa limpo"
    verification:
      - kind: unit
        ref: "npm run verificar — lint, tsc --noEmit, verificar-acoes (48 ações, 0 violações), 893 testes unitários, test:migracoes — tudo verde"
        status: pass
    human_judgment: false

duration: ~35min (execução autônoma, sem checkpoint)
completed: 2026-09-26
status: complete
---

# Quick Task 260926-ijl: Toast do sonner sem fundo — Summary

**O `<Toaster>` único do sistema pintava `background: var(--normal-bg)` sem valor nenhum — as quatro variáveis do `components/ui/sonner.tsx` gerado pelo shadcn apontavam para nomes (`--popover`, `--border`, `--radius`) que nunca existiram neste projeto (Tailwind v4 usa `--color-popover`/`--color-border`/`--radius-xl`); remapeadas para os tokens reais, com uma asserção nova de `background-color` computado provada RED antes e GREEN depois.**

## Performance

- **Duration:** ~35min de execução autônoma (Tarefas 1-3, sem checkpoint)
- **Completed:** 2026-09-26
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- **Causa raiz confirmada, não só reparada por tentativa e erro.** `components/ui/sonner.tsx` é o
  arquivo padrão instalado pelo shadcn (`git log --follow` mostra um único commit,
  `ce41521` — "feat(03-01): instala 6 dos 7 componentes shadcn da fase e monta o Toaster" —
  nunca tocado depois). Ele referenciava `--popover`, `--popover-foreground`, `--border` e
  `--radius`; `app/globals.css` só define esses conceitos com o prefixo do namespace Tailwind v4
  (`--color-popover`, `--color-popover-foreground`, `--color-border`, e o namespace de raio
  `--radius-sm/md/lg/xl`, sem um `--radius` puro). Um `var()` para um nome que nunca existiu, sem
  fallback, resolve para nada — `background: var(--normal-bg)` no CSS do próprio sonner
  (`node_modules/sonner/dist/styles.css`) ficava sem valor, e o toast se desenhava totalmente
  transparente.
- **Correção do momento em que o defeito ficou visível confirmada.** O objetivo original supunha
  o `<Toaster>` montado "desde a fase 02b" — o `git log --follow -- components/ui/sonner.tsx`
  mostra que na verdade foi a fase **03-01** (o log de `app/(app)/layout.tsx`, que monta o
  `<Toaster>`, confirma a mesma origem). O defeito em si é o mesmo há três fases: sempre
  transparente, só invisível até o plano 04.4-13 subir o aviso para cima da barra inferior no
  celular, diretamente sobre os cartões do Caixa, onde a transparência virou o achado
  fotografado pelo dono.
- **Mapeamento feito token a token contra `app/globals.css`, nenhum nome inventado:**
  `--normal-bg → var(--color-popover)` (= `--color-superficie`, `#FFFFFF`), `--normal-text →
  var(--color-popover-foreground)` (= `--color-tinta`), `--normal-border → var(--color-border)`
  (= `--color-borda`), `--border-radius → var(--radius-xl)` (18px, o mesmo raio de Card/Dialog,
  `rounded-xl`). Os mesmos quatro conceitos já são consumidos com o padrão `bg-popover
  text-popover-foreground` por `dialog.tsx`, `dropdown-menu.tsx` e `select.tsx` — nenhum token
  novo foi criado, nenhum valor de cor foi alterado.
- **Sombra e borda não precisaram de nada novo.** `node_modules/sonner/dist/styles.css` já
  embute `box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1)` e `border: 1px solid var(--normal-border)`
  na própria regra `[data-sonner-toast][data-styled='true']` — assim que `--normal-border`
  resolveu para um token real, a borda apareceu de graça, e a sombra (que nunca dependeu de
  nenhuma variável quebrada) ficou visível pela primeira vez com um fundo atrás dela.
- **`cn-toast` (classe morta) removida, não definida.** `grep -rn "cn-toast" --include="*.tsx"
  --include="*.css" --include="*.ts" .` (repositório inteiro, fora `node_modules`) não encontra
  NENHUMA regra `.cn-toast` em lugar nenhum. É um hook de estilização que nunca foi implementado
  — provavelmente copiado de um boilerplate de referência do shadcn que tinha essa classe.
  Decisão: remover a chave `classNames.toast` do `toastOptions` (menos código morto) em vez de
  inventar uma regra CSS só para justificar sua existência. `className="toaster group"`, já
  presente no componente, continua disponível para qualquer seletor `.group` futuro.
- **A asserção que teria pego isso, escrita ANTES da correção.** Estendida
  `tests/e2e/financeiro-caixa.spec.ts` (o teste de geometria "Desfazer acima da barra" do plano
  04.4-13) com `getComputedStyle(aviso).backgroundColor` — a geometria provava só POSIÇÃO, nunca
  legibilidade; um toast inteiramente transparente já passava nas duas asserções de bounding box
  existentes. A nova asserção afirma que a cor não é `rgba(0, 0, 0, 0)` (transparente) E que é
  exatamente `rgb(255, 255, 255)` (o branco de `--color-superficie`/`--color-popover`).

## Task Commits

1. **Tarefa 1a: escrever a asserção nova, provar RED com o código não corrigido** — `22166e8` (test)
2. **Tarefa 1b: corrigir sonner.tsx, remover cn-toast, provar GREEN** — `ef898ee` (fix)

Tarefa 2 (confirmar Queimas Desfazer) não alterou código — sem commit próprio.
**Plano/estado (docs):** commitado separadamente (ver "Final commit" abaixo).

## Files Modified

- `components/ui/sonner.tsx` — as quatro variáveis do `style` inline remapeadas para
  `--color-popover`/`--color-popover-foreground`/`--color-border`/`--radius-xl`;
  `classNames.toast: "cn-toast"` removida
- `tests/e2e/financeiro-caixa.spec.ts` — asserção de `getComputedStyle(...).backgroundColor`
  acrescentada ao teste "no celular, o aviso do 'Desfazer' fica inteiro acima da barra inferior..."

## Comandos de verificação rodados

Orçamento do CLAUDE.md (§Conventions): no máximo uma invocação de `npm run test:e2e -- --grep`
por tarefa; o par RED/GREEN da Tarefa 1 é a exceção explícita de diagnóstico, registrada no
PLAN.md (`<orcamento_de_e2e>`):

- `npm run test:e2e -- --grep "fica inteiro acima da barra"` — **2 vezes** (Tarefa 1):
  1. Com `sonner.tsx` ainda quebrado (RED) — **2 failed** (desktop + celular), ambos com a mesma
     mensagem: `o aviso precisa de um fundo opaco...; veio "rgba(0, 0, 0, 0)"` — 28 passed.
  2. Com `sonner.tsx` corrigido (GREEN) — **30 passed** (desktop + celular).
- `npm run test:e2e -- --grep "'Desfazer' remove a queima"` — **1 vez** (Tarefa 2) — **30 passed**
  (desktop + celular), confirmando que o mesmo `<Toaster>` único não regrediu para o outro
  consumidor.
- `npm run verificar` — 1 vez, ao final — `lint` + `tsc --noEmit` + `verificar-acoes` (48 ações,
  0 violações) + `npm test` (893 testes) + `npm run test:migracoes` — tudo verde.

**Total de invocações de `npm run test:e2e -- --grep`: 3** (o par RED/GREEN da Tarefa 1 + a
confirmação isolada da Tarefa 2) — dentro do orçamento previsto no PLAN.md.

## Prova RED/GREEN do e2e

O caso "no celular, o aviso do 'Desfazer' fica inteiro acima da barra inferior e o botão é
clicável" foi rodado ANTES de qualquer correção em `sonner.tsx`, já com a asserção de
`background-color` escrita (commit `22166e8`, de propósito, para o teste ter algo de verdade
para medir). Com as quatro variáveis do `style` inline ainda quebradas, o Chromium mediu
`getComputedStyle(aviso).backgroundColor === "rgba(0, 0, 0, 0)"` — transparência total,
byte a byte com o achado fotografado pelo dono. Corrigido `sonner.tsx` (commit `ef898ee`), a
mesma rota passou nos dois viewports com `rgb(255, 255, 255)`.

| Rodada | Estado de `components/ui/sonner.tsx` | Resultado |
|---|---|---|
| RED | `--normal-bg: var(--popover)` (variável inexistente) | 2 failed (desktop + celular), 28 passed |
| GREEN | `--normal-bg: var(--color-popover)` (token real) | 30 passed (desktop + celular) |

## Decisions Made

Ver `key-decisions` no frontmatter: remapeamento das quatro variáveis para tokens reais (nenhum
token novo, nenhum valor inventado); `cn-toast` removida em vez de definida (classe morta sem
nenhuma regra em nenhum CSS do repositório); nenhuma sombra/borda extra acrescentada (o próprio
CSS do sonner já resolve as duas assim que `--normal-border` aponta para algo real).

## Deviations from Plan

Nenhuma. O plano já previa exatamente esta causa raiz e esta correção — a única correção
descoberta durante a execução foi de detalhe histórico (a fase de origem do `<Toaster>` é 03-01,
não 02b como o objetivo original supunha), documentada acima em "Accomplishments", sem impacto no
escopo do plano.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova. A mudança é puramente de apresentação (variáveis CSS/estilo inline);
nenhuma rota, autorização ou acesso a dado foi tocado.

## Issues Encountered

Nenhum bloqueante.

## Aguardando o dono

Nenhum `git push` foi dado, e nenhum será dado sem o dono autorizar. Os 2 commits de código desta
tarefa (mais o commit de documentação a seguir) estão em `main`, local, sobre `1fe0386` (o último
commit da fase 04.4-13).

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

- O toast volta a ser legível sobre qualquer cartão em qualquer módulo (Financeiro, Queimas,
  Abertura, Cotações, Cadastros) — o mesmo `<Toaster>` único de `app/(app)/layout.tsx` serve
  todos.
- A regressão futura de `--normal-bg`/`--normal-border`/`--border-radius` para um nome inexistente
  volta a falhar de forma explícita e legível (`rgba(0, 0, 0, 0)` != esperado), não silenciosa.
- Nenhum bloqueio para o próximo trabalho.

---
*Phase: quick-260926-ijl*
*Completed: 2026-09-26*

## Self-Check: PASSED

`components/ui/sonner.tsx` e `tests/e2e/financeiro-caixa.spec.ts` existem no disco com as
mudanças descritas. Os commits `22166e8` (RED) e `ef898ee` (GREEN) existem em
`git log --oneline --all`.
