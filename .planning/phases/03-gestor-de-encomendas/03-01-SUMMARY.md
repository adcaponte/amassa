---
phase: 03-gestor-de-encomendas
plan: 01
subsystem: database
tags: [drizzle, postgres, zod, server-actions, nextjs-15, shadcn, sonner, react-19]

# Dependency graph
requires:
  - phase: 02b-design-system-e-casca-da-aplicacao
    provides: casca de navegação (CabecalhoPagina, EstadoVazio, Button), tokens de design,
      shadcn inicializado (style radix-nova), padrão "Server Component form + pequeno Client
      Component para useFormStatus" (botao-entrar.tsx)
  - phase: 02a-login-banco-base-e-backup
    provides: exigirUsuario(), db (Drizzle), verificar-acoes gate, padrão de migração
      customizada (0002/0003)
provides:
  - "db/schema.ts: statusEncomenda, etapaEncomenda, encomendas, encomendaItens, encomendaEtapas"
  - "lib/encomendas/cronograma.ts: módulo puro de cascata de datas (ORDEM_DAS_ETAPAS,
    ETAPAS_MARCO, DIAS_PADRAO, calcularCronograma) — base de todos os planos 02-08 desta fase"
  - "lib/encomendas/esquemas.ts: ponto único de validação Zod (D-15) — o ajuste rápido do
    plano 03 importa daqui"
  - "lib/encomendas/acoes.ts: criarEncomenda, o primeiro db.transaction do projeto"
  - "lib/encomendas/consultas.ts: listarEncomendasDoIndice"
  - "/encomendas?nova': contrato de URL do formulário (D-03), consumido pelo plano 06"
  - "6 dos 7 componentes shadcn desta fase instalados (alert-dialog, dialog, label, select,
    sonner, switch) e o ponto de montagem do <Toaster/> em app/(app)/layout.tsx"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08]

# Actuals (#2632)
actuals:
  tokens: 27950
  tasks: 3
  commits: 2

tech-stack:
  added: [sonner@2.0.8, next-themes@0.4.6]
  patterns:
    - "Módulo puro sem imports com aritmética de calendário por inteiros (dias desde a época,
      algoritmo de Howard Hinnant) em vez de Date — evita deslocamento de fuso e satisfaz o
      grep de 'nenhum new Date(' do próprio plano"
    - "Server Action com assinatura (estadoAnterior, FormData) pronta para useActionState,
      usada hoje via .bind(null, null) + cast de tipo a partir de um Server Component — adia
      a migração para useActionState até o dia em que o formulário precisar mostrar erro
      inline (plano 06), sem reescrever a assinatura da action"
    - "Client Component sibling minúsculo só para useFormStatus (mesmo idioma de
      botao-entrar.tsx), mantendo o formulário como Server Component"

key-files:
  created:
    - lib/encomendas/cronograma.ts
    - lib/encomendas/esquemas.ts
    - lib/encomendas/acoes.ts
    - lib/encomendas/consultas.ts
    - components/amassa/encomendas/formulario-encomenda.tsx
    - components/amassa/encomendas/botao-salvar-encomenda.tsx
    - db/migrations/0005_encomendas.sql
    - db/migrations/0006_gatilhos-encomendas.sql
    - tests/unit/cronograma.test.ts
    - tests/e2e/encomendas.spec.ts
  modified:
    - db/schema.ts
    - app/(app)/encomendas/page.tsx
    - app/(app)/layout.tsx
    - tests/e2e/casca.spec.ts
    - package.json

key-decisions:
  - "Data de conclusão formatada por split/reverse/join direto em page.tsx (sem Date, sem
    módulo novo) em vez de criar lib/encomendas/formato.ts (PD-04) — este plano não precisa da
    formatação genérica que PD-04 antecipa; a decisão de quando criar esse módulo fica para o
    plano que primeiro precisar de mais de um lugar formatando data"
  - "criarEncomenda(estadoAnterior, FormData) — assinatura de useActionState usada hoje via
    .bind(null, null) a partir de um Server Component, com um cast de tipo documentado no
    formulário (o retorno ResultadoDeAcao não é lido por <form action> sem useActionState)"
  - "botao-salvar-encomenda.tsx criado como arquivo irmão (não estava no files_modified do
    plano) — necessário para manter formulario-encomenda.tsx como Server Component (exigido
    pela Tarefa 2) enquanto ainda se ganha o pending state do useFormStatus (mesmo idioma de
    botao-entrar.tsx); documentado como deviation Rule 2 abaixo"

patterns-established:
  - "Aritmética de data em módulo puro por dias-desde-a-época (sem Date, sem date-fns) —
    lib/encomendas/cronograma.ts é o modelo para qualquer módulo de data futuro do projeto"
  - "Ponto único de validação Zod por domínio (esquemas.ts), importado por todos os caminhos
    de escrita do mesmo domínio (D-15)"

requirements-completed: [ENC-01, ENC-05, ENC-12]

coverage:
  - id: D1
    description: "Criar uma encomenda com um item grava encomendas + encomenda_itens +
      encomenda_etapas numa única transação (db.transaction) — nenhuma escrita parcial"
    requirement: "ENC-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas.spec.ts#criar uma encomenda com um item mostra a data de
          conclusão em cascata, e sobrevive a um recarregamento"
        status: pass
      - kind: other
        ref: "grep -c 'db.transaction' lib/encomendas/acoes.ts (>= 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "As 6 etapas nascem com os padrões literais (producao 3, secagem 6, queima1
      1, esmaltacao 1, queima2 1, entrega 1), na ordem de ORDEM_DAS_ETAPAS"
    requirement: "ENC-01"
    verification:
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#DIAS_PADRAO está na mesma ordem de
          ORDEM_DAS_ETAPAS"
        status: pass
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#duracaoTotalEmDias é a soma dos dias das 6 etapas
          padrão (3+6+1+1+1+1 = 13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "calcularCronograma respeita o fim exclusivo (a etapa seguinte começa no
      mesmo dia em que a anterior termina) e ultimoDia é o dia anterior ao fimExclusivo"
    requirement: "ENC-01"
    verification:
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#cascata com os padrões: producao de 2026-08-12 a
          2026-08-15 (fim exclusivo)"
        status: pass
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#ultimoDia é o dia anterior ao fimExclusivo"
        status: pass
    human_judgment: false
  - id: D4
    description: "lib/encomendas/cronograma.ts é um módulo puro: zero imports, nenhuma
      instância de Date, hoje sempre como argumento (nesta fatia, dataInicio)"
    verification:
      - kind: other
        ref: "grep -c '^import' lib/encomendas/cronograma.ts (== 0)"
        status: pass
      - kind: other
        ref: "grep -c 'new Date(' lib/encomendas/cronograma.ts (== 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "criarEncomenda tem exigirUsuario() como primeira instrução do corpo;
      npm run verificar-acoes sai com 0"
    requirement: "ENC-01"
    verification:
      - kind: other
        ref: "npm run verificar-acoes (0 violações, 3 ações conferidas)"
        status: pass
    human_judgment: false
  - id: D6
    description: "criado_por recebe o id do objeto devolvido por exigirUsuario(), nunca um
      usuário buscado de novo"
    verification:
      - kind: other
        ref: "lib/encomendas/acoes.ts — criadoPor: usuarioAtual.id (código inspecionável)"
        status: pass
    human_judgment: false
  - id: D7
    description: "ENC-12: recarregar /encomendas depois de criar mostra a encomenda com as
      datas calculadas — persistência real, não estado de cliente"
    requirement: "ENC-12"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas.spec.ts (page.reload() + getByText(nomeDaEncomenda) visível)"
        status: pass
    human_judgment: false
  - id: D8
    description: "ENC-12 (idempotência): enviar o mesmo formulário duas vezes cria duas
      encomendas distintas — não existe deduplicação por chave natural, o botão disabled do
      useFormStatus é a única defesa contra o toque duplo"
    requirement: "ENC-12"
    verification: []
    human_judgment: true
    rationale: "Nenhum teste automatizado desta fatia envia o mesmo formulário duas vezes de
      propósito para contar as linhas resultantes — o e2e prova criação única. A ausência de
      chave natural de deduplicação é verificável por leitura do schema (nenhum unique além de
      (encomenda_id, etapa)), mas o comportamento de duas linhas distintas em duplo envio
      requer confirmação humana ou um teste dedicado (plano 08/UAT)."
  - id: D9
    description: "As três tabelas têm gatilho tocar_atualizado_em_<tabela> e atualizado_em
      muda sozinho em UPDATE"
    verification:
      - kind: other
        ref: "db/migrations/0006_gatilhos-encomendas.sql (3x create trigger, conferido por
          grep)"
        status: pass
    human_judgment: true
    rationale: "O trigger existe na migração e foi aplicado no banco de teste efêmero (a
      migração roda com sucesso antes de cada suíte e2e), mas nenhum teste automatizado desta
      fatia executa um UPDATE e confirma que atualizado_em mudou — a Tarefa 2 só exercita
      INSERT. Fica para um teste futuro ou verificação humana direta no banco."
  - id: D10
    description: "A restrição marcos_zero_ou_um existe no banco e rejeitaria dias=2 em
      queima1/queima2/entrega"
    verification:
      - kind: other
        ref: "grep -c 'marcos_zero_ou_um' db/migrations/0005_encomendas.sql (>= 1)"
        status: pass
    human_judgment: true
    rationale: "A restrição está no SQL gerado e replicada como refine no Zod (defesa dupla),
      mas nenhum teste automatizado tenta de fato inserir dias=2 direto no banco para provar
      que o Postgres rejeita — o Zod barra antes disso no caminho normal da aplicação."
  - id: D11
    description: "amassa_app consegue select/insert/update/delete nas três tabelas novas sem
      grant adicional (0003 já cobre)"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas.spec.ts (insert bem-sucedido via a aplicação rodando com as
          credenciais de amassa_app do banco de teste)"
        status: pass
    human_judgment: false
  - id: D12
    description: "Instalação de 6 dos 7 componentes shadcn aprovados (alert-dialog, dialog,
      label, select, sonner, switch) e ponto de montagem do Toaster em app/(app)/layout.tsx"
    verification:
      - kind: other
        ref: "componentes/ui/{alert-dialog,dialog,label,select,sonner,switch}.tsx existem;
          npm run build sai com 0"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 1: Traçado de Ponta a Ponta — Encomendas Summary

**Schema Drizzle de 3 tabelas (encomendas/itens/etapas) + módulo puro de cascata de datas sem
`Date` + `criarEncomenda` transacional + tela real, provados por um e2e que cria, lê a cascata
e sobrevive a um recarregamento, em desktop e celular.**

## Performance

- **Duration:** 36 min (incluindo a espera pela aprovação humana do portão de pacotes)
- **Started:** 2026-08-09T13:39:58Z
- **Completed:** 2026-08-09T14:16:04Z
- **Tasks:** 3 (1 checkpoint de portão + 1 tracer + 1 auto)
- **Files modified:** 27

## Accomplishments
- As três tabelas do módulo Encomendas (`encomendas`, `encomenda_itens`, `encomenda_etapas`)
  migradas com o SQL literal de `02-MODELO-DE-DADOS.md` §1 — dois `pgEnum`, quatro índices,
  `unique(encomenda_id, etapa)` e a restrição `marcos_zero_ou_um`
- `lib/encomendas/cronograma.ts`: módulo puro de verdade — zero imports, zero `Date`,
  aritmética de calendário por inteiros (dias desde a época), cascata com fim exclusivo, 9
  testes de unidade cobrindo as fronteiras exigidas por este plano
- `criarEncomenda`: primeira escrita transacional (`db.transaction`) do projeto, cobrindo
  encomenda + itens + etapas numa operação atômica, com `exigirUsuario()` como primeira
  instrução do corpo (portão de máquina `verificar-acoes` passando)
- `/encomendas` trocou o miolo estático da Fase 2b por dados reais — lista, estado vazio
  condicional, contrato de URL `?nova` (D-03) nascendo aqui para o plano 06 herdar
- `tests/e2e/encomendas.spec.ts`: prova ponta a ponta (criar → ver cascata na lista →
  recarregar → continuar lá), rodando em `desktop` e `celular`
- 6 dos 7 componentes shadcn desta fase instalados nas versões exatas aprovadas, `<Toaster/>`
  montado em `app/(app)/layout.tsx`

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Portão de legitimidade dos pacotes npm** — checkpoint, aprovado pelo dono
   (evidência registrada nas Deviations abaixo)
2. **Tarefa 2: Uma encomenda de ponta a ponta** — `ba5b11e` (feat)
3. **Tarefa 3: Instalar componentes shadcn e montar o Toaster** — `ce41521` (feat)

_Nenhuma tarefa TDD isolada — Tarefa 2 seguiu a ordem "teste vermelho → schema → módulo puro →
ação → tela" dentro de um único commit atômico, como o próprio plano pediu (tracer, não TDD por
task separado)._

## Files Created/Modified
- `db/schema.ts` — `statusEncomenda`, `etapaEncomenda`, `encomendas`, `encomendaItens`,
  `encomendaEtapas`
- `db/migrations/0005_encomendas.sql` — migração gerada, conferida linha a linha contra o SQL
  fonte
- `db/migrations/0006_gatilhos-encomendas.sql` — os três `tocar_atualizado_em_*`, escritos à
  mão, sem `grant`
- `lib/encomendas/cronograma.ts` — `calcularCronograma`, `ORDEM_DAS_ETAPAS`, `ETAPAS_MARCO`,
  `DIAS_PADRAO`
- `lib/encomendas/esquemas.ts` — `esquemaItem`, `esquemaEtapas`, `esquemaEncomenda` (validação
  de data civil sem `Date`, incluindo ano bissexto)
- `lib/encomendas/acoes.ts` — `criarEncomenda`
- `lib/encomendas/consultas.ts` — `listarEncomendasDoIndice`
- `app/(app)/encomendas/page.tsx` — miolo trocado por dados reais, botão "Nova encomenda"
  ativo, `notaBotao` removida
- `components/amassa/encomendas/formulario-encomenda.tsx` — Server Component com `<form>` real
- `components/amassa/encomendas/botao-salvar-encomenda.tsx` — Client Component sibling
  (`useFormStatus`)
- `app/(app)/layout.tsx` — `<Toaster/>` montado
- `tests/unit/cronograma.test.ts`, `tests/e2e/encomendas.spec.ts` — novos
- `tests/e2e/casca.spec.ts` — `/encomendas` removida de `TELAS_DE_MODULO` (ver deviations)
- `package.json`/`package-lock.json` — `sonner@2.0.8`, `next-themes@0.4.6`, ambos fixados
- `components/ui/{alert-dialog,dialog,label,select,sonner,switch}.tsx` — instalados

## Decisions Made
- Ver `key-decisions` no frontmatter — formatação de data inline sem novo módulo, assinatura
  `criarEncomenda` pronta para `useActionState` usada hoje via `.bind()`, e o Client Component
  `botao-salvar-encomenda.tsx` como arquivo novo necessário.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `tests/e2e/casca.spec.ts` quebrava por causa da própria mudança que
este plano exige**
- **Found during:** Tarefa 2, verificação `npm run test:e2e` (suíte completa)
- **Issue:** `casca.spec.ts` (Fase 2b) tem uma tabela genérica `TELAS_DE_MODULO` que afirma,
  para `/encomendas`, `/agenda`, `/queimas` e `/estoque`, o mesmo contrato "botão inerte +
  nota 'Chega na Fase N.'". A Tarefa 10 deste plano EXIGE remover exatamente essa nota e tornar
  o botão de `/encomendas` ativo — as duas mudanças são o objetivo do plano, não uma regressão,
  mas quebravam a asserção genérica da Fase 2b.
- **Fix:** Removida a entrada `/encomendas` de `TELAS_DE_MODULO`, com um comentário explicando
  o porquê e apontando para `tests/e2e/encomendas.spec.ts` como a cobertura substituta. As
  outras três telas (`agenda`, `queimas`, `estoque`) continuam com o contrato antigo, intocado.
- **Files modified:** `tests/e2e/casca.spec.ts`
- **Verification:** `npm run test:e2e` — o teste "cada tela de módulo..." volta a passar em
  `desktop` e `celular`
- **Committed in:** `ba5b11e` (Tarefa 2)

**2. [Rule 2 — Missing Critical] `components/amassa/encomendas/botao-salvar-encomenda.tsx`
criado (não estava em `files_modified`)**
- **Found during:** Tarefa 2, implementação de `formulario-encomenda.tsx`
- **Issue:** A Tarefa 2 exige que `formulario-encomenda.tsx` seja um Server Component, mas
  também pede o idioma `useFormStatus` de `botao-entrar.tsx` para o botão "Salvar" — os dois
  não cabem no mesmo arquivo (`"use client"` é por arquivo inteiro). Sem um Client Component
  próprio, ou o formulário vira Client Component (contrariando a Tarefa 2) ou o botão perde o
  estado de carregamento — que é exatamente a defesa contra o toque duplo do ENC-12 (`disabled`
  enquanto a ação está em voo).
- **Fix:** Criado `components/amassa/encomendas/botao-salvar-encomenda.tsx`, réplica do idioma
  de `botao-entrar.tsx` (`useFormStatus`, `disabled`, `aria-busy`).
- **Files modified:** `components/amassa/encomendas/botao-salvar-encomenda.tsx` (novo)
- **Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build` — todos 0; o e2e clica
  em "Salvar" e o formulário se comporta como esperado
- **Committed in:** `ba5b11e` (Tarefa 2)

**3. [Rule 3 — Blocking, workaround documentado] Tipo de retorno de `criarEncomenda` não bate
com o tipo exigido por `<form action>`**
- **Found during:** Tarefa 2, `npx tsc --noEmit`
- **Issue:** `criarEncomenda` devolve `Promise<ResultadoDeAcao<...>>` (exigido pelo plano, para
  compatibilidade futura com `useActionState`), mas o tipo de `<form action>` do React exige
  `(formData) => void | Promise<void>` — TypeScript não aplica a leniência de `void` dentro de
  `Promise<T>` aninhado.
- **Fix:** `criarEncomenda.bind(null, null) as unknown as (formData: FormData) => Promise<void>`,
  documentado com comentário explicando que o valor de retorno nunca é lido sem
  `useActionState`.
- **Files modified:** `components/amassa/encomendas/formulario-encomenda.tsx`
- **Verification:** `npx tsc --noEmit` sai com 0
- **Committed in:** `ba5b11e` (Tarefa 2)

**4. [Rule 4 — flagged, não decidido unilateralmente] `components/ui/form.tsx` não instalou**
- **Found during:** Tarefa 3
- **Issue:** `npx shadcn@3.8.5 add form` roda sem erro mas não cria nenhum arquivo — o item de
  registro `form` (confirmado via `npx shadcn@3.8.5 view form` e `view @shadcn/form`) não tem
  `files`, só metadados. O item vizinho `field` (`view @shadcn/field`) tem conteúdo completo,
  sugerindo que o preset "radix-nova" (`components.json`, fixado desde a 02b) substituiu o
  wrapper clássico `Form` (react-hook-form + Zod) por uma primitiva `Field` diferente.
- **Ação tomada:** NÃO decidido por conta própria — documentado em detalhe em
  `deferred-items.md` e registrado como entrada aberta no ledger `WINDOWS.md` (#4). As outras
  seis instalações da Tarefa 3 prosseguiram normalmente; nenhum pacote fora da lista aprovada
  na Tarefa 1 entrou na árvore (`package.json`/`package-lock.json` só ganharam `sonner@2.0.8` e
  `next-themes@0.4.6`, exatamente os dois que a instalação de `sonner` trouxe).
- **Files modified:** nenhum arquivo de produto — só o registro em `deferred-items.md` e
  `WINDOWS.md`
- **Verification:** `git diff package.json` mostra só `sonner`/`next-themes`; nenhum
  `react-hook-form`/`@hookform/resolvers` entrou (porque `form` nunca processou dependências)
- **Committed in:** `ce41521` (Tarefa 3)

---

**Total deviations:** 4 (2 Rule 3 — blocking, 1 Rule 2 — missing critical, 1 Rule 4 — flagged
sem decisão unilateral)
**Impact on plan:** Nenhuma mudança de escopo além do estritamente necessário para completar a
Tarefa 2/3 como escritas. A ausência de `form.tsx` não bloqueia nada desta fatia (nenhum código
deste plano usa react-hook-form) — só precisa de decisão antes do plano 06.

## Issues Encountered
- `grep -c 'new Date(' lib/encomendas/cronograma.ts` inicialmente retornava 1 por causa de um
  comentário que citava `new Date("...")` como exemplo do que NÃO fazer — reescrito para não
  conter a substring literal, sem mudar o sentido da explicação.
- `diasDesdeAEpoca` ficou sem uso na primeira versão de `cronograma.ts` (a função `somarDias`
  usava `Date.UTC` para achar o dia da entrada, mas convertia de volta com o algoritmo puro) —
  refatorado para usar `diasDesdeAEpoca` também na entrada, eliminando a única chamada a
  `Date.UTC` e o aviso de lint de função não usada ao mesmo tempo.

## User Setup Required

None — no external service configuration required. `sonner`/`next-themes` são pacotes npm
comuns, sem chave de API nem variável de ambiente nova.

## Known Stubs / Limitações Conhecidas

- **Falha de validação Zod no formulário não mostra mensagem visível ao usuário nesta fatia.**
  `criarEncomenda` devolve `{ ok: false, erro: "..." }` quando o Zod rejeita a entrada, mas
  `formulario-encomenda.tsx` chama a ação via `<form action={...}>` sem `useActionState` — o
  valor de retorno é descartado (ver Deviation #3). Na prática, a maioria dos casos de erro já
  é barrada no navegador por `required`/`type="date"`/`type="number" min="1"`; o que passa
  disso (ex.: nome com mais de 120 caracteres) falha silenciosamente do ponto de vista do
  usuário — sem navegação, sem mensagem. Isto viola a diretriz de `CLAUDE.md` "erro em
  linguagem humana, dizendo o que fazer" para esse caso estreito. **Resolução planejada:** o
  plano 06, que já precisa de `useActionState` para o rodapé com recálculo ao vivo (D-17) e
  para o Dialog/Sheet, é o lugar natural para wire este retorno a uma mensagem visível. Não é
  um stub de dado falso (a escrita é real), é uma lacuna de feedback de erro — registrada aqui
  para não ser esquecida antes do plano 06.

## Next Phase Readiness

- O par `cronograma.ts`/`esquemas.ts` está pronto para os planos 02 (geometria do Gantt, mais
  casos de borda) e 03 (segundo caminho de escrita — ajuste rápido) importarem sem
  reimplementar nada.
- O contrato de URL `?nova` (D-03) está vivo; o plano 06 troca o `<section>` por
  `Dialog`/`Sheet` sem mudar esse contrato.
- **Bloqueio para o plano 06:** decidir a composição do formulário completo sem `form.tsx`
  disponível (usar `field`, escrever um wrapper próprio, ou `react-hook-form` direto) — ver
  `deferred-items.md` e `WINDOWS.md` #4. Precisa ser resolvido antes ou no início do plano 06.
- `<Toaster/>` já montado — planos 05, 06 e 07 podem chamar `toast()` sem trabalho adicional.

## Self-Check: PASSED

Todos os 19 arquivos listados em Files Created/Modified confirmados presentes no disco; ambos
os commits de tarefa (`ba5b11e`, `ce41521`) confirmados em `git log --oneline --all`.

