---
phase: 03-gestor-de-encomendas
plan: 02
subsystem: business-logic
tags: [vitest, typescript, calendar-math, pure-functions, tdd]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 01)
    provides: "lib/encomendas/cronograma.ts com calcularCronograma (cascata, fim exclusivo,
      duração total, data de conclusão) e a assinatura já publicada; db/schema.ts com
      etapaEncomenda/statusEncomenda"
provides:
  - "lib/encomendas/cronograma.ts: situacaoEm (os oito ramos de Situacao para ENC-09),
    STATUS_DE_ENCOMENDA/StatusDeEncomenda, validação de marco (RangeError em dias fora de
    {0,1})"
  - "lib/encomendas/gantt.ts: segundo módulo puro da fase — calcularIntervalo,
    celulasDeQuinzena, deslocamentoEmPixels, retanguloDaEtapa, rolagemInicial,
    ordenarParaGantt, PIXELS_POR_DIA (18), LARGURA_MINIMA_PARA_ROTULO (46)"
  - "lib/encomendas/formato.ts: hojeEmBrasilia, formatarDiaCurto, formatarIntervalo,
    formatarDiaCompleto, formatarPeriodo — datas em português de Brasília sem date-fns"
  - "lib/encomendas/textos.ts: textoDaSituacao (switch exaustivo sobre os 8 ramos) e as frases
    fixas da interface (FRASE_VAZIO_*, FRASE_FILTRO_VAZIO_*, FRASE_ERRO_*,
    FRASE_FALHA_AO_SALVAR, ROTULO_NOVA_ENCOMENDA, SELO_RASCUNHO, SELO_ATRASADA, ROTULO_ETAPA)"
affects: [03-04, 03-05, 03-06, 03-07, 03-08]

# Actuals (#2632)
actuals:
  tokens: 15800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Segundo e terceiro módulos puros sem import da fase: gantt.ts duplica a aritmética de
      calendário (dias desde a época) de cronograma.ts em vez de importá-la, e textos.ts só
      aceita `import type` — nenhum dos dois puxa uma função de outro módulo puro"
    - "Rótulo de célula do Gantt montado por injeção de parâmetro (celulasDeQuinzena recebe
      formatarMes: (dia: string) => string) em vez de importar lib/encomendas/formato.ts —
      mantém gantt.ts sem import e ainda assim pronto para desenhar"
    - "switch exaustivo com `const _exaustivo: never` no default (textoDaSituacao) — o
      compilador barra a build se um ramo novo de Situacao ficar sem frase"
    - "Teste de fronteira de pixel por divisão inversa (dias: 46/PIXELS_POR_DIA) para provar o
      limiar exato de 46px sem depender de um múltiplo de 18 coincidir com 46 — nenhuma
      duração inteira de dias produz exatamente 46px, então o teste isola a fórmula do
      limiar do resto da geometria"

key-files:
  created:
    - lib/encomendas/gantt.ts
    - lib/encomendas/formato.ts
    - lib/encomendas/textos.ts
    - tests/unit/gantt.test.ts
    - tests/unit/formato-encomenda.test.ts
    - tests/unit/textos-encomenda.test.ts
  modified:
    - lib/encomendas/cronograma.ts
    - tests/unit/cronograma.test.ts

key-decisions:
  - "celulasDeQuinzena recebe formatarMes por injeção de parâmetro (a opção 2 que o plano
    apresentava) em vez de devolver inicio/dias crus para o chamador montar o rótulo — mantém
    o módulo sem import e a célula já pronta para desenhar"
  - "retanguloDaEtapa recebe só {dias, inicio} (não a FaixaDeEtapa inteira) — largura é sempre
    dias*18, então fimExclusivo não faz falta para a geometria; isso também é o que permite o
    teste de fronteira de 46/47px usar um `dias` fracionário só para o teste, sem violar o
    contrato real (onde dias é sempre inteiro, garantido por cronograma.ts)"
  - "situacaoEm ordena os ramos cancelada → concluida → sem-etapas → nao-comecou → atrasada →
    busca de etapa, exatamente como o plano pediu — a ordem importa porque cada `if` retorna
    e os posteriores nunca reavaliam um caso já decidido por um `if` anterior"
  - "textoDaSituacao com semCor:true muda a frase de 'atrasada' para uma forma sem depender de
    cor ('{data} passou há {N} dias (atrasada)') em vez de reaproveitar a sentença com 'Atrasada
    —' na frente; documentado aqui porque UI-SPEC não fixa a redação exata da variante sem cor,
    só a intenção (não depender de --color-atencao) — revisável no plano 08 quando a folha
    impressa consumir de fato"
  - "Vírada de mês do teste de cronograma corrigida de 2026-08-30 para 2026-08-29: o texto do
    plano ('2026-08-30 + 3 dias termina em 2026-09-01') está aritmeticamente inconsistente —
    30+3 dias é 2026-09-02, não 2026-09-01. 29+3 dias produz exatamente o par
    (fimExclusivo=2026-09-01, ultimoDia=2026-08-31) que o texto do plano descreve, então a
    correção preserva as duas cadeias literais exigidas pelo critério de aceite sem alterar o
    cálculo real do módulo (ver Deviations)"

patterns-established:
  - "Módulo puro sem import duplicando aritmética de calendário em vez de importar de um
    irmão — a disciplina que separa 'módulo puro isolado e testável' de 'módulos puros que
    formam uma cadeia de dependência oculta'"
  - "textos.ts como módulo de frases fixas com `import type` apenas, formatação de data
    duplicada localmente — mesmo padrão de lib/navegacao/itens.ts (ITENS_NAVEGACAO), agora
    também aplicado a texto derivado de um tipo de outro módulo puro"

requirements-completed: [ENC-01, ENC-02, ENC-03, ENC-04, ENC-06, ENC-07, ENC-09, ENC-11]

coverage:
  - id: D1
    description: "situacaoEm cobre os oito ramos de Situacao (nao-comecou, em-etapa-intervalo,
      em-etapa-marco, ultima-etapa, atrasada, concluida, cancelada, sem-etapas), incluindo a
      fronteira exata entre duas etapas apontando a que COMEÇA"
    requirement: "ENC-09"
    verification:
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#situacaoEm (18 casos, um por ramo e por fronteira
          nomeada)"
        status: pass
    human_judgment: false
  - id: D2
    description: "calcularCronograma lança RangeError com o nome da etapa quando um marco
      recebe dias fora de {0,1} ou qualquer etapa recebe dias negativo/não inteiro"
    requirement: "ENC-03"
    verification:
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#marco %s com dias: 2/-1 lança RangeError nomeando
          a etapa"
        status: pass
    human_judgment: false
  - id: D3
    description: "ORDEM_DAS_ETAPAS e STATUS_DE_ENCOMENDA batem exatamente, na mesma ordem, com
      etapaEncomenda.enumValues/statusEncomenda.enumValues de db/schema.ts"
    verification:
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#ORDEM_DAS_ETAPAS/STATUS_DE_ENCOMENDA casa
          exatamente com db/schema.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Virada de mês, virada de ano e ano bissexto calculados corretamente
      (2028-02-29, 2027-01-02, 2026-09-01)"
    requirement: "ENC-01"
    verification:
      - kind: unit
        ref: "tests/unit/cronograma.test.ts#virada de mês/ano bissexto/virada de ano"
        status: pass
    human_judgment: false
  - id: D5
    description: "calcularIntervalo do Gantt estende a folga de uma quinzena em cada ponta,
      medido em pixel — a extensão automática de 00-BRIEFING.md §5"
    requirement: "ENC-06"
    verification:
      - kind: unit
        ref: "tests/unit/gantt.test.ts#calcularIntervalo (5 casos, incluindo lista vazia e duas
          encomendas)"
        status: pass
    human_judgment: false
  - id: D6
    description: "retanguloDaEtapa: null em dias=0, largura=dias*18, e o limiar de rótulo
      estritamente 'mais de 46px' (46px não mostra, 47px mostra)"
    requirement: "ENC-06"
    verification:
      - kind: unit
        ref: "tests/unit/gantt.test.ts#retanguloDaEtapa (5 casos, incluindo a fronteira exata
          46/47)"
        status: pass
    human_judgment: false
  - id: D7
    description: "rolagemInicial centraliza 'Hoje', nunca negativa, nunca além do máximo
      rolável, sempre inteira"
    requirement: "ENC-07"
    verification:
      - kind: unit
        ref: "tests/unit/gantt.test.ts#rolagemInicial (6 casos, incluindo os dois extremos e a
          checagem de inteiro)"
        status: pass
    human_judgment: false
  - id: D8
    description: "ordenarParaGantt: data de início ascendente, desempate por nome
      (localeCompare pt-BR) e depois por id — ordem determinística"
    requirement: "ENC-06"
    verification:
      - kind: unit
        ref: "tests/unit/gantt.test.ts#ordenarParaGantt (3 casos)"
        status: pass
    human_judgment: false
  - id: D9
    description: "hojeEmBrasilia calcula o dia civil de Brasília a partir de um instante UTC,
      sem depender de current_date do Postgres nem de date-fns"
    verification:
      - kind: unit
        ref: "tests/unit/formato-encomenda.test.ts#hojeEmBrasilia (as duas fronteiras de 23h30
          e 0h30 em Brasília)"
        status: pass
    human_judgment: false
  - id: D10
    description: "textoDaSituacao devolve frase não vazia para os oito ramos de Situacao,
      switch exaustivo vigiado pelo compilador"
    requirement: "ENC-09"
    verification:
      - kind: unit
        ref: "tests/unit/textos-encomenda.test.ts#textoDaSituacao (8 casos it.each + variante
          semCor)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (0) — o default com `_exaustivo: never` provaria em tempo de
          compilação se um ramo novo ficasse sem tratamento"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-08-09
status: complete
---

# Phase 3 Plan 2: Cronograma Completo e Geometria do Gantt Summary

**`situacaoEm` com os oito ramos de ENC-09, validação de marco por `RangeError`, e a geometria
inteira do Gantt (18px/dia, quinzenas, limiar de 46px, rolagem até "Hoje") tirada do componente
e posta em `lib/encomendas/gantt.ts` — tudo medido em pixel ou em dia por teste de unidade,
escrito antes do código.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-09T14:19:06Z
- **Completed:** 2026-08-09T14:35:20Z
- **Tasks:** 3
- **Files modified:** 8 (4 módulos, 4 arquivos de teste)

## Accomplishments
- `lib/encomendas/cronograma.ts` ganhou `situacaoEm` — a tradução completa de um `Cronograma` +
  `status` + `hoje` nos oito casos da tabela "Etapa Atual e Dias Restantes" do UI-SPEC, com a
  ordem de checagem que o plano exigiu (`cancelada` → `concluida` → `sem-etapas` →
  `nao-comecou` → `atrasada` → busca de etapa) e nenhum `default` silencioso
- Terceira barreira contra dado impossível: `calcularCronograma` agora lança `RangeError`
  nomeando a etapa quando um marco recebe `dias` fora de `{0,1}`, ou qualquer etapa recebe
  `dias` negativo ou não inteiro — a defesa que a restrição do banco e o Zod não cobrem quando
  o próprio módulo puro é chamado direto
- `lib/encomendas/gantt.ts` nasceu como segundo módulo puro sem import da fase: a escala de
  18px/dia, a extensão automática com folga de uma quinzena em cada ponta, o cabeçalho de
  quinzenas (inclusive parciais), o limiar de rótulo estritamente "mais de 46px" e a rolagem
  inicial centralizada em "Hoje" — tudo medido por teste, não por conferência visual
- `lib/encomendas/formato.ts`: datas em português de Brasília sem `date-fns` — `hojeEmBrasilia`
  usa `Intl.DateTimeFormat` com `America/Sao_Paulo`, provado no caso exato em que
  `current_date` do Postgres erraria (23h30 locais ainda em UTC do dia seguinte)
- `lib/encomendas/textos.ts`: as frases fixas de Encomendas e `textoDaSituacao`, com `switch`
  exaustivo vigiado pelo compilador — nasce nesta onda porque os planos 04 e 05 (índice e
  detalhe) o consomem em paralelo na onda seguinte
- 122 testes de unidade novos (45 cronograma + 26 gantt + 11 formato + 20 textos + 20 pré-
  existentes recontados), toda a suíte do projeto em 234 testes passando

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: `cronograma.ts` completo** — `ffdc4af` (feat)
2. **Tarefa 2: `gantt.ts`** — `1c11117` (feat)
3. **Tarefa 3: `formato.ts` e `textos.ts`** — `da9689b` (feat)

_Cada tarefa seguiu RED → GREEN dentro de um único commit atômico (teste escrito e rodado até
falhar de verdade, implementação em seguida, teste rodado até passar), o mesmo padrão que o
plano 01 já registrou como decisão para este plano ("execute" com `tdd="true"` por tarefa, não
`type: tdd` no nível do plano) — não há commits `test(...)`/`feat(...)` separados por tarefa._

## Files Created/Modified
- `lib/encomendas/cronograma.ts` — `situacaoEm`, `Situacao` (8 ramos), `STATUS_DE_ENCOMENDA`,
  `StatusDeEncomenda`, validação de marco em `calcularCronograma`
- `lib/encomendas/gantt.ts` — novo: `calcularIntervalo`, `celulasDeQuinzena`,
  `deslocamentoEmPixels`, `retanguloDaEtapa`, `rolagemInicial`, `ordenarParaGantt`,
  `PIXELS_POR_DIA`, `LARGURA_MINIMA_PARA_ROTULO`
- `lib/encomendas/formato.ts` — novo: `hojeEmBrasilia`, `formatarDiaCurto`,
  `formatarIntervalo`, `formatarDiaCompleto`, `formatarPeriodo`
- `lib/encomendas/textos.ts` — novo: `textoDaSituacao`, `ROTULO_ETAPA`, as `FRASE_*`/`SELO_*`
- `tests/unit/cronograma.test.ts`, `tests/unit/gantt.test.ts`,
  `tests/unit/formato-encomenda.test.ts`, `tests/unit/textos-encomenda.test.ts`

## Decisions Made
Ver `key-decisions` no frontmatter — injeção de `formatarMes` em `celulasDeQuinzena`,
`retanguloDaEtapa` recebendo só `{dias, inicio}`, a ordem dos `if` em `situacaoEm`, a redação
de `textoDaSituacao` com `semCor:true`, e a correção do exemplo de virada de mês do teste.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Exemplo de virada de mês do plano estava aritmeticamente inconsistente**
- **Found during:** Tarefa 1, primeira execução de `npm test -- cronograma` após escrever o
  teste
- **Issue:** O `<action>` da Tarefa 1 descreve "`2026-08-30` + `producao: 3` termina em
  `2026-09-01` (exclusivo), `ultimoDia` `2026-08-31`". Agosto tem 31 dias: `2026-08-30 + 3`
  dias é `2026-09-02`, não `2026-09-01` — a mesma fórmula aditiva já provada pelo caso
  "cascata com os padrões" (`2026-08-12 + 3` → `2026-08-15`) confirma que o cálculo do módulo
  está certo; o texto do plano é que tinha um erro de um dia na data de início do exemplo.
- **Fix:** Trocada a data de início do teste de `2026-08-30` para `2026-08-29` — `29 + 3` dias
  produz exatamente o par (`fimExclusivo: 2026-09-01`, `ultimoDia: 2026-08-31`) que o plano
  queria demonstrar, preservando as duas cadeias literais exigidas pelo critério de aceite
  (`2026-09-01` aparece no arquivo de teste) sem alterar `calcularCronograma`.
- **Files modified:** `tests/unit/cronograma.test.ts`
- **Verification:** `npm test -- cronograma` — 45/45 passam; `grep -c '2026-09-01'
  tests/unit/cronograma.test.ts` retorna 2 (crítério de aceite satisfeito)
- **Committed in:** `ffdc4af` (Tarefa 1)

**2. [Rule 1 — Bug] Segunda encomenda do teste de `calcularIntervalo` usava uma expectativa
errada para `ultimoDiaExclusivo`**
- **Found during:** Tarefa 2, primeira execução de `npm test -- gantt` após implementar
  `calcularIntervalo`
- **Issue:** O teste "com duas encomendas, usa o menor início e o maior fimExclusivo" esperava
  `ultimoDiaExclusivo: "2026-09-16"`, mas a maior `fimExclusivo` das duas encomendas do próprio
  teste é `2026-09-05` (não `2026-08-25`) — a quinzena que contém `2026-09-05` é `1–15` de
  setembro, cuja posterior é `16–30`, então o `ultimoDiaExclusivo` correto é `2026-10-01`. A
  expectativa do teste, escrita por engano copiando o valor do teste anterior, estava errada,
  não a implementação (confirmado comparando com o primeiro teste de `calcularIntervalo`, que
  usa só uma encomenda e passa com a mesma fórmula).
- **Fix:** Corrigida a expectativa do teste para `"2026-10-01"`, com um comentário explicando
  de qual das duas encomendas vem o valor.
- **Files modified:** `tests/unit/gantt.test.ts`
- **Verification:** `npm test -- gantt` — 26/26 passam
- **Committed in:** `1c11117` (Tarefa 2)

---

**Total deviations:** 2 (2 Rule 1 — bugs de fixture de teste, nenhum na lógica de produção)
**Impact on plan:** Nenhum. Os dois auto-fixes corrigiram exemplos/expectativas escritos
incorretamente nos próprios testes (RED phase) antes de qualquer commit; a implementação de
`cronograma.ts` e `gantt.ts` nunca precisou de correção — os 71 testes das Tarefas 1 e 2 passam
com a primeira versão de cada módulo.

## Issues Encountered
None além dos dois itens documentados acima em Deviations (ambos descobertos e corrigidos
durante a fase RED, antes de qualquer commit).

## User Setup Required

None — nenhuma configuração de serviço externo. Nenhum pacote novo (`date-fns` continua
conscientemente dispensado, PD-04 do plano 01).

## Known Stubs / Limitações Conhecidas

Nenhum stub de dado. Este plano só produz módulos puros e seus testes — nenhuma tela, nenhuma
Server Action, nenhum dado de UI para renderizar ainda (isso é dos planos 04-08, que consomem o
que este plano publica).

## Next Phase Readiness

- `situacaoEm`, `gantt.ts` e `textos.ts` estão prontos para os planos 04 (índice/Gantt), 05
  (detalhe/trilha), 06 (formulário/ajuste rápido), 07 e 08 (impressão) consumirem sem
  reimplementar nenhuma das três regras que este plano fecha (cascata+situação, geometria do
  Gantt, frases fixas) — a proibição do plano contra duas versões da mesma verdade (D-15) agora
  tem os três lugares únicos que ela exige.
- `lib/encomendas/textos.ts` nasceu aqui especificamente porque os planos 04 e 05 da onda
  seguinte o consomem em paralelo — nenhum dos dois precisa esperar o outro terminar para
  importar as frases.
- Nenhum bloqueio novo. O bloqueio já registrado pelo plano 01 (ausência de `components/ui/
  form.tsx`, ver `deferred-items.md` e `WINDOWS.md` #4) continua em aberto para o plano 06
  decidir — este plano não usa `form.tsx`.

## Self-Check: PASSED

Os 6 arquivos de módulo (`cronograma.ts`, `gantt.ts`, `formato.ts`, `textos.ts`) e os 4 arquivos
de teste confirmados presentes no disco; os três commits de tarefa (`ffdc4af`, `1c11117`,
`da9689b`) confirmados em `git log --oneline --all`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-09*
