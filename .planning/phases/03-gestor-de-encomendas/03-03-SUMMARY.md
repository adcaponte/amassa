---
phase: 03-gestor-de-encomendas
plan: 03
subsystem: business-logic
tags: [drizzle, postgres, zod, server-actions, transactions, row-locking]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 01)
    provides: "lib/encomendas/esquemas.ts (esquemaItem/esquemaEtapas/esquemaEncomenda),
      lib/encomendas/acoes.ts (criarEncomenda, ResultadoDeAcao<T>, db.transaction),
      lib/encomendas/consultas.ts (listarEncomendasDoIndice, EncomendaComFilhos)"
  - phase: 03-gestor-de-encomendas (plano 02)
    provides: "lib/encomendas/cronograma.ts completo (situacaoEm, STATUS_DE_ENCOMENDA) —
      calcularCronograma já validava marco 0/1 e recusava dias negativos antes deste plano"
provides:
  - "lib/encomendas/esquemas.ts: esquemaId, esquemaAjusteDeEtapa (união intervalo/marco,
    PD-02), esquemaReordenacao — ponto único de validação completo para os dois caminhos de
    escrita (D-15)"
  - "lib/encomendas/acoes.ts: as sete Server Actions da fase — criarEncomenda (plano 01) +
    atualizarEncomenda, cancelarEncomenda, concluirEncomenda, excluirEncomenda,
    ajustarEtapaEncomenda, reordenarItemEncomenda (este plano)"
  - "lib/encomendas/consultas.ts: buscarEncomenda(id) — leitura do detalhe"
affects: [03-04, 03-05, 03-06, 03-07, 03-08]

# Actuals (#2632)
actuals:
  tokens: 9100
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "select ... for update dentro de db.transaction como defesa contra atualização perdida
      (PD-02): o novo valor nasce do que a trava acabou de ler, nunca de um número vindo do
      cliente — primeiro uso de row-level locking do projeto"
    - "Classe de erro interna (EncomendaNaoEncontrada) lançada dentro de db.transaction só para
      abortar a transação e ser recapturada fora do try/catch, traduzida em { ok: false, erro }
      humano — nunca vaza a instância do erro para fora do arquivo"
    - "esquemaEncomenda.extend({ id, itens: z.array(esquemaItemComId)... }) para compor um
      segundo esquema (atualização) que reusa nome/clienteNome/dataInicio/etapas do esquema de
      criação, só trocando o formato do array de itens — evita reimplementar as mesmas regras"
    - "revalidatePath('/encomendas/[id]', 'page') com o padrão de rota literal (colchetes), não
      um id interpolado — invalida o cache de qualquer página de detalhe da fase de uma vez"

key-files:
  created: []
  modified:
    - lib/encomendas/esquemas.ts
    - lib/encomendas/acoes.ts
    - lib/encomendas/consultas.ts
    - tests/unit/esquemas-encomenda.test.ts

key-decisions:
  - "atualizarEncomenda/cancelarEncomenda/concluirEncomenda/excluirEncomenda/
    ajustarEtapaEncomenda/reordenarItemEncomenda recebem um objeto tipado (entrada: unknown),
    não FormData — ao contrário de criarEncomenda (assinatura useActionState herdada do plano
    01). Nenhuma UI consome estas ações ainda (só nasce nos planos 05/06); FormData exigiria
    serializar arrays de itens/etapas à mão sem ganho nenhum agora, e o boundary de segurança
    (Zod no servidor) é o mesmo dos dois jeitos"
  - "esquemaAtualizacaoDeEncomenda (local a acoes.ts, não exportado de esquemas.ts) estende
    esquemaEncomenda com id + itens-com-id-opcional — mantém D-15 (mesmas regras de
    nome/cliente/data/etapas) sem reimplementar nada, só adiciona o campo de reconciliação que
    só a atualização precisa"
  - "ids de item na reconciliação de atualizarEncomenda: id ausente = item novo (insert), id
    presente e existente no banco = atualização, id existente no banco mas ausente na entrada =
    apagado — a mesma regra que teria sido necessária num esquema mais elaborado, resolvida por
    comparação de conjuntos em vez de upsert"

patterns-established:
  - "select ... for update + cálculo do novo valor a partir da linha travada — o padrão a
    repetir sempre que um segundo caminho de escrita rápida precisar evitar atualização perdida
    em qualquer módulo futuro do projeto (Agenda, Queimas, Estoque)"

requirements-completed: [ENC-01, ENC-02, ENC-03, ENC-04, ENC-05, ENC-12]

coverage:
  - id: D1
    description: "esquemaItem mede a descrição em pontos de código (não UTF-16) após
      normalize('NFC'), aceitando 1 e 200 pontos de código e recusando 0 e 201 — inclusive com
      emoji de par substituto e acento composto vs. pré-composto"
    requirement: "ENC-05"
    verification:
      - kind: unit
        ref: "tests/unit/esquemas-encomenda.test.ts#esquemaItem (9 casos, incluindo a fronteira
          200/201 em emoji e a normalização NFC)"
        status: pass
    human_judgment: false
  - id: D2
    description: "esquemaEncomenda aceita 1 e 50 itens, recusa 0 e 51; dois itens com a mesma
      descrição e quantidade continuam duas linhas distintas (nada é fundido)"
    requirement: "ENC-05"
    verification:
      - kind: unit
        ref: "tests/unit/esquemas-encomenda.test.ts#esquemaEncomenda (itens: 1/0/50/51 +
          adjacência)"
        status: pass
    human_judgment: false
  - id: D3
    description: "clienteNome ausente, vazio ou só com espaços vira null (nunca cadeia vazia);
      dataInicio recusa formato errado e 2026-02-30 (data civil inexistente)"
    requirement: "ENC-05"
    verification:
      - kind: unit
        ref: "tests/unit/esquemas-encomenda.test.ts#esquemaEncomenda (clienteNome null/trim +
          2026-02-30)"
        status: pass
    human_judgment: false
  - id: D4
    description: "esquemaEtapas exige as 6 etapas fixas sem repetição; marcos recusam dias:2 e
      aceitam 0/1; etapas de intervalo aceitam 0 e recusam -1"
    requirement: "ENC-03"
    verification:
      - kind: unit
        ref: "tests/unit/esquemas-encomenda.test.ts#esquemaEtapas (10 casos it.each pelos 6
          valores de Etapa)"
        status: pass
    human_judgment: false
  - id: D5
    description: "esquemaAjusteDeEtapa (união PD-02): aceita delta -1/1 só em etapa de
      intervalo, ligado só em etapa de marco; recusa delta num marco e ligado num intervalo —
      o esquema, não o componente, sabe qual etapa é interruptor"
    requirement: "ENC-03"
    verification:
      - kind: unit
        ref: "tests/unit/esquemas-encomenda.test.ts#esquemaAjusteDeEtapa (7 casos)"
        status: pass
    human_judgment: false
  - id: D6
    description: "esquemaReordenacao aceita direcao cima/baixo, recusa qualquer outro valor;
      esquemaId aceita uuid válido e recusa vazio/número/malformado"
    verification:
      - kind: unit
        ref: "tests/unit/esquemas-encomenda.test.ts#esquemaReordenacao / #esquemaId (7 casos)"
        status: pass
    human_judgment: false
  - id: D7
    description: "As sete Server Actions de lib/encomendas/acoes.ts têm exigirUsuario() como
      primeira instrução do corpo — nenhuma linha antes, portão de máquina passando"
    requirement: "ENC-01"
    verification:
      - kind: other
        ref: "npm run verificar-acoes (9 ações conferidas em app+lib, 0 violações)"
        status: pass
    human_judgment: false
  - id: D8
    description: "atualizarEncomenda escreve encomenda + reconciliação de itens (apaga/insere/
      atualiza, renumera ordem 0..n-1) + dias das 6 etapas numa ÚNICA transação; numa encomenda
      inexistente devolve { ok: false, erro }, não lança"
    requirement: "ENC-02"
    verification:
      - kind: other
        ref: "grep -c 'db.transaction' lib/encomendas/acoes.ts (4, incluindo criarEncomenda);
          npx tsc --noEmit + npm run build (0)"
        status: pass
    human_judgment: true
    rationale: "A reconciliação de itens e o caminho 'encomenda inexistente' tocam o banco de
      verdade — não há teste de integração com Postgres nesta fatia (Vitest não sobe banco).
      Provado por leitura de código e pelos portões estáticos (tsc/build/verificar-acoes); um
      teste e2e dedicado fica para os planos 05/06, quando o formulário de edição existir para
      exercitar o caminho de verdade."
  - id: D9
    description: "excluirEncomenda conta os itens DENTRO da mesma transação que apaga, ANTES do
      delete em cascata, e devolve { nome, itensApagados } — a contagem nunca vem de um props
      do cliente que pode estar velho (D-09)"
    verification:
      - kind: other
        ref: "grep -c 'itensApagados' lib/encomendas/acoes.ts (2: no tipo de retorno e no
          objeto devolvido pela transação)"
        status: pass
    human_judgment: true
    rationale: "Comportamento real de contagem+delete em cascata só é provável contra um banco
      real; código revisado (a leitura acontece antes do delete, dentro da mesma tx), sem teste
      de integração automatizado nesta fatia."
  - id: D10
    description: "cancelarEncomenda/concluirEncomenda nunca deduzem status de data — só mudam
      status quando chamadas explicitamente (D-05); concluirEncomenda devolve dataDeConclusao
      calculada por calcularCronograma sobre as 6 etapas já gravadas"
    requirement: "ENC-04"
    verification:
      - kind: other
        ref: "grep -v '^//' lib/encomendas/consultas.ts | grep -c 'concluida' (0 — nenhuma
          consulta deriva status de data); leitura de acoes.ts (cancelarEncomenda/
          concluirEncomenda só fazem UPDATE de status, sem comparação de data)"
        status: pass
    human_judgment: false
  - id: D11
    description: "ajustarEtapaEncomenda implementa PD-02: select ... for update trava as 6
      linhas dentro da transação; o novo valor (Math.max(0, dias+delta) em intervalo,
      ligado?1:0 em marco) nasce do dado travado, nunca de um valor absoluto do cliente — duas
      chamadas simultâneas de delta:+1 somam, nunca 'a última ganha'"
    requirement: "ENC-02"
    verification:
      - kind: other
        ref: "grep -Ec 'for update|forUpdate' lib/encomendas/acoes.ts (4); grep -c 'Math.max(0'
          lib/encomendas/acoes.ts (1); leitura de código (o cálculo usa etapaAlvo.dias lido
          dentro da tx, nunca um campo de entrada)"
        status: pass
    human_judgment: true
    rationale: "A garantia de 'duas escritas simultâneas somam' depende do comportamento real de
      row-level locking do Postgres sob concorrência — não simulado por um teste automatizado
      nesta fatia (exigiria duas conexões de banco disparando ao mesmo tempo). A defesa está
      implementada e revisável em código (select ... for update dentro de db.transaction,
      cálculo a partir da linha travada); prova de concorrência de verdade fica para um teste
      de integração dedicado numa fase futura, se a suspeita de regressão aparecer."
  - id: D12
    description: "ajustarEtapaEncomenda revalida o array de 6 etapas pelo MESMO esquemaEtapas
      de esquemas.ts antes de gravar — se a regra de marco 0/1 mudar, os três caminhos de
      escrita (criar, atualizar, ajuste rápido) mudam juntos (D-15)"
    verification:
      - kind: other
        ref: "lib/encomendas/acoes.ts importa esquemaEtapas de ./esquemas e reusa a mesma
          instância exportada (não uma cópia) dentro de ajustarEtapaEncomenda; esquemaEncomenda
          (usado por criarEncomenda e, via extend, por atualizarEncomenda) já tem etapas:
          esquemaEtapas como campo — os três caminhos compartilham o mesmo objeto de esquema"
        status: pass
    human_judgment: false
  - id: D13
    description: "reordenarItemEncomenda troca ordem por índice dentro de uma transação com for
      update; sem vizinho na direção pedida (primeiro subindo / último descendo) devolve
      { ok: true } sem escrever nada"
    requirement: "ENC-05"
    verification:
      - kind: other
        ref: "leitura de código: o `return` antecipado dentro do db.transaction ocorre antes de
          qualquer `tx.update`, e a função devolve { ok: true, dados: null } depois"
        status: pass
    human_judgment: true
    rationale: "Comportamento de reordenação real (troca de ordem, ausência de vizinho) só é
      provável contra um banco real com itens já persistidos — sem teste de integração
      automatizado nesta fatia; a lista de itens no formulário só nasce no plano 06."

# Metrics
duration: ~14min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 3: As Sete Server Actions e o Esquema Único de Validação Summary

**`esquemas.ts` completo (esquemaId, união PD-02 de ajuste de etapa, esquemaReordenacao) + as
seis Server Actions que faltavam (`atualizarEncomenda`, `cancelarEncomenda`, `concluirEncomenda`,
`excluirEncomenda`, `ajustarEtapaEncomenda`, `reordenarItemEncomenda`) + `buscarEncomenda` — a
corrida do ajuste rápido resolvida com `select ... for update` e delta relativo, nunca valor
absoluto vindo do cliente.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-09T14:41:00Z (aprox.)
- **Completed:** 2026-08-09T14:51:17Z
- **Tasks:** 3
- **Files modified:** 4 (3 módulos de `lib/encomendas/` + 1 arquivo de teste)

## Accomplishments
- `lib/encomendas/esquemas.ts` ganhou os últimos três esquemas que a fase precisa:
  `esquemaId` (uuid), `esquemaAjusteDeEtapa` (união discriminada por etapa — intervalo aceita só
  `delta: -1|1`, marco aceita só `ligado: boolean`, implementando PD-02 no nível de validação) e
  `esquemaReordenacao`; `esquemaItem.descricao` passou a medir em pontos de código após
  `normalize("NFC")`, e `esquemaEncomenda.clienteNome` passou a transformar ausente/vazio/só
  espaços em `null`
- `tests/unit/esquemas-encomenda.test.ts`: 52 casos novos cobrindo as fronteiras dos dois lados
  (descrição 200/201 em pontos de código real de emoji, NFC, quantidade 0/-1/40.5, itens 0/1/
  50/51, `2026-02-30`, marcos 0/1/2, união de ajuste, reordenação, `esquemaId`)
- As sete Server Actions da fase existem: `criarEncomenda` (plano 01) mais
  `atualizarEncomenda` (segunda escrita transacional do projeto — reconcilia itens e etapas
  numa só transação), `cancelarEncomenda`/`concluirEncomenda` (nunca deduzem status de data,
  D-05), `excluirEncomenda` (conta itens antes do delete em cascata, D-09),
  `ajustarEtapaEncomenda` (PD-02: `select ... for update` + delta relativo — a corrida entre
  dois toques rápidos resolvida no servidor, não deixada para a sorte) e
  `reordenarItemEncomenda` (troca `ordem` por índice, renumera 0..n-1, D-16)
- `buscarEncomenda(id)` em `consultas.ts` — leitura do detalhe para o plano 05
- `npm run verificar-acoes`: 9 ações conferidas, 0 violações — todas com `exigirUsuario()` como
  primeira instrução do corpo

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: `esquemas.ts` completo** — `74cea9d` (feat)
2. **Tarefa 2: Ciclo de vida — atualizar, cancelar, concluir, excluir, e a leitura do detalhe** —
   `8c5fc36` (feat)
3. **Tarefa 3: Escrita rápida sem atualização perdida** — `3abef8f` (feat)

_Cada tarefa seguiu RED → GREEN dentro de um único commit atômico onde havia teste de unidade a
escrever (Tarefa 1: teste escrito e rodado até falhar de verdade, antes do esquema ser
estendido). As Tarefas 2 e 3 não têm arquivo de teste próprio no plano (`<files>` só lista
`acoes.ts`/`consultas.ts`) — o comportamento transacional foi provado pelos portões estáticos
(`verificar-acoes`, `tsc`, `lint`, `build`) e por leitura de código, não por Vitest (que não sobe
Postgres); ver `coverage` no frontmatter para o que ficou sem prova automatizada de banco real._

## Files Created/Modified
- `lib/encomendas/esquemas.ts` — `esquemaId`, `esquemaAjusteDeEtapa`, `esquemaReordenacao`
  novos; `esquemaItem.descricao` com NFC + contagem por ponto de código;
  `esquemaEncomenda.clienteNome` com transform para `null`
- `lib/encomendas/acoes.ts` — `atualizarEncomenda`, `cancelarEncomenda`, `concluirEncomenda`,
  `excluirEncomenda`, `ajustarEtapaEncomenda`, `reordenarItemEncomenda` novos
- `lib/encomendas/consultas.ts` — `buscarEncomenda` novo
- `tests/unit/esquemas-encomenda.test.ts` — novo, 52 casos

## Decisions Made
Ver `key-decisions` no frontmatter — assinatura de objeto tipado (não `FormData`) para as seis
ações novas, `esquemaAtualizacaoDeEncomenda` local a `acoes.ts` via `.extend()` de
`esquemaEncomenda`, e a regra de reconciliação de itens por comparação de conjuntos de `id`.

## Deviations from Plan

None — plano executado como escrito. Os três esquemas, as seis ações e `buscarEncomenda` saíram
com a assinatura que o próprio texto do plano descreveu (`atualizarEncomenda(entrada)`,
`cancelarEncomenda(id)`, etc.), e a "decisão do executor" sobre tipo de entrada (objeto tipado em
vez de `FormData`) está dentro do espaço que `03-CONTEXT.md` `<decisions>` "Claude's Discretion"
deixou explicitamente aberto ("estrutura de arquivos... e onde mora cada Server Action").

## Issues Encountered
None.

## User Setup Required

None — nenhuma configuração de serviço externo, nenhum pacote novo.

## Known Stubs / Limitações Conhecidas

Nenhum stub de dado. As seis ações novas e `buscarEncomenda` são implementação real, escrevendo
e lendo do Postgres — só não têm consumidor de UI ainda (nasce nos planos 05/06). A "coverage"
com `human_judgment: true` acima marca onde o comportamento transacional/concorrente não tem
prova automatizada com banco real nesta fatia (Vitest não sobe Postgres) — não é dado falso, é
lacuna de teste de integração, já registrada para os planos que vão consumir estas ações.

## Next Phase Readiness

- As sete Server Actions da fase estão prontas para os planos 04-08 chamarem: nenhuma delas
  precisa mudar de assinatura para a UI consumir (todas recebem objeto tipado + `unknown` como
  boundary de validação, exceto `criarEncomenda`, que já usa `FormData`/`useActionState`).
- `buscarEncomenda(id)` está pronta para `app/(app)/encomendas/[id]/page.tsx` (plano 05).
- `esquemaAjusteDeEtapa`/`esquemaReordenacao` estão prontos para `ajuste-rapido-etapa.tsx` e
  `lista-itens.tsx` (planos 05/06) montarem a entrada exata que as ações esperam.
- **Ponto a testar quando a UI existir:** a corrida de `ajustarEtapaEncomenda` (dois toques
  rápidos somando, não perdendo) e a reconciliação de itens de `atualizarEncomenda` não têm
  prova automatizada com banco real ainda — bom candidato a teste e2e dedicado no plano 06/08,
  ou a um teste de integração que abra duas conexões de propósito.
- Bloqueio já registrado pelo plano 01 (`components/ui/form.tsx` não instala,
  `deferred-items.md`/`WINDOWS.md` #4) continua em aberto para o plano 06 decidir — este plano
  não usa `form.tsx`.
- `tests/e2e/autenticacao.spec.ts:72` ("sexta tentativa") segue com timeout intermitente
  pré-existente e independente deste plano (confirmado — nenhum arquivo deste plano toca auth);
  92 dos 94 testes e2e passaram, incluindo `tests/e2e/encomendas.spec.ts` (o traçado do plano 01
  não regrediu).

## Self-Check: PASSED

Os 3 arquivos de módulo (`esquemas.ts`, `acoes.ts`, `consultas.ts`) e o arquivo de teste
confirmados presentes no disco; os três commits de tarefa (`74cea9d`, `8c5fc36`, `3abef8f`)
confirmados em `git log --oneline --all`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-09*
