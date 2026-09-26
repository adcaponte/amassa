---
phase: quick-260926-qpv
plan: 1
subsystem: ui
tags: [react, financeiro, playwright, e2e, planning-docs]

# Dependency graph
requires:
  - phase: 04.4-financeiro-parte-1 (plano 07)
    provides: "painel-despesa.tsx — as três pílulas originais (compra · outra · pagar conta que já existe)"
  - phase: 04.4-financeiro-parte-1 (plano 13)
    provides: "role=group/aria-label 'Tipo de despesa' agrupando as duas escolhas de verdade — o
      atalho removido aqui já vivia FORA desse grupo desde o 04.4-13"
provides:
  - "painel-despesa.tsx com exatamente duas pílulas (Compra de material/Outra despesa) — nenhum
    terceiro modo, nenhum código morto"
  - "BRIEFING.md/REQUIREMENTS.md (FNC-06)/04.4-UI-SPEC.md/04.4-CONTEXT.md carregam a decisão
    datada do dono (2026-09-26) e a consequência (Caixa → 'A pagar' → 'Paguei') para quem ler
    depois, sem reescrever a história do desenho original de 19/09/2026"
affects: [04.4-financeiro-parte-1 (a fase já estava fechando; esta mudança é pós-fechamento, pedida
  pelo dono depois de usar o módulo no celular)]

actuals:
  tokens: 13200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "O 'terceiro caminho' de uma tela pode ser puramente um atalho de navegação (<Link>
      client-side), nunca um valor persistido — confirmar isso ANTES de tocar em schema/
      validação evita mudança de servidor desnecessária. Aqui, lib/financeiro/esquemas.ts e
      lib/financeiro/rascunho.ts já eram uma união fechada de dois membros ('compra'|'outra')
      desde o plano 07; o atalho nunca passou por Zod nem pelo banco."
    - "Decisão do dono que contradiz um documento aprovado (briefing/protótipo) vira uma NOTA
      datada por cima da frase original, nunca uma reescrita silenciosa — quem ler o documento
      mais tarde vê o que foi decidido, quando, e por quê, sem perder o registro do desenho
      original."

key-files:
  created: []
  modified:
    - components/amassa/financeiro/painel-despesa.tsx
    - lib/financeiro/textos.ts
    - lib/financeiro/acoes.ts
    - tests/e2e/financeiro-despesa.spec.ts
    - .planning/phases/04.4-financeiro-parte-1/BRIEFING.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md
    - .planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md

key-decisions:
  - "Nenhuma mudança de schema, migração ou Server Action foi necessária — confirmado por leitura
    de lib/financeiro/esquemas.ts e lib/financeiro/rascunho.ts antes de qualquer edição: o `modo`
    já era uma união fechada de 'compra'|'outra' desde o plano 07. O atalho 'pagar conta que já
    existe' sempre foi um <Link href=\"/financeiro?aba=caixa\"> puramente de navegação."
  - "O teste 'a aba Despesa existe e abre nas três pílulas' foi RENOMEADO e teve só a asserção do
    atalho removida — a asserção de que o grupo acessível NUNCA contém o atalho (que já provava
    algo verdadeiro mesmo antes desta tarefa) foi preservada, não descartada, por continuar
    documentando o desenho do grupo 'Tipo de despesa'."
  - "Os quatro documentos de planejamento (BRIEFING, REQUIREMENTS, UI-SPEC, CONTEXT) ganharam
    NOTAS datadas por cima da frase original que descrevia 'três caminhos' — a frase original não
    foi apagada, preservando o histórico da decisão de 19/09/2026 (briefing) e 2026-09-20
    (resposta do dono documentada em FNC-06)."
  - "Passe de revisão adicional (pedido do coordenador, depois da Tarefa 3): três comentários de
    código ainda descreviam o atalho no PRESENTE, como se existisse —
    lib/financeiro/acoes.ts:257-258, lib/financeiro/textos.ts:86-88 e
    components/amassa/financeiro/painel-despesa.tsx:540-543. Reescritos no passado, citando a
    remoção de 26/09/2026 e o caminho que passou a valer (Caixa → 'A pagar' → 'Paguei'), no mesmo
    tom da nota já deixada em painel-despesa.tsx:99-102. `grep -rn \"conta que já existe\" lib
    components app tests` confirmou que não sobrou nenhum outro comentário de código no presente."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "A Despesa mostra exatamente duas pílulas; nenhum data-testid=\"despesa-modo-conta\"
      existe mais na árvore"
    verification:
      - kind: e2e
        ref: "tests/e2e/financeiro-despesa.spec.ts — 'a aba Despesa existe e abre nas duas
          pílulas' (desktop + celular)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ROTULO_PILULA_CONTA, o import de Link/ChevronRight e qualquer comentário citando
      'três pílulas'/'três caminhos' no componente foram removidos — nenhum resíduo do terceiro modo"
    verification:
      - kind: static
        ref: "grep -rn \"ROTULO_PILULA_CONTA\\|despesa-modo-conta\" --include=\"*.ts\"
          --include=\"*.tsx\" . (fora .planning/) — nenhuma ocorrência"
        status: pass
    human_judgment: false
  - id: D3
    description: "e2e sem o atalho, cobertura do que continua existindo intacta; acessibilidade
      passa"
    verification:
      - kind: e2e
        ref: "npm run test:e2e -- --grep \"financeiro despesa|acessibilidade\" — 96/96 (desktop +
          celular)"
        status: pass
    human_judgment: false
  - id: D4
    description: "BRIEFING, REQUIREMENTS (FNC-06), UI-SPEC e CONTEXT registram a decisão datada e
      a consequência"
    verification:
      - kind: static
        ref: "grep -n \"260926-qpv\\|26/09/2026\" nos quatro arquivos — todos citam a data e o motivo"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run verificar passa limpo"
    verification:
      - kind: unit
        ref: "npm run verificar — lint, tsc --noEmit, verificar-acoes (48 ações, 0 violações), 893
          testes unitários, test:migracoes — tudo verde"
        status: pass
    human_judgment: false

duration: ~40min (execução autônoma, sem checkpoint)
completed: 2026-09-26
status: complete
---

# Quick Task 260926-qpv: Remove o atalho "Pagar conta que já existe" da Despesa — Summary

**O dono usou o módulo Financeiro no celular e decidiu tirar o terceiro caminho da Despesa — o atalho "Pagar conta que já existe" (link para o Caixa) pareceu inútil e grande no uso real; a Despesa fica com as duas escolhas de verdade (Compra de material/Outra despesa), e os quatro documentos de planejamento que descreviam "três caminhos" ganharam uma nota datada explicando a mudança e a consequência: quem quer pagar uma conta que já existe vai por Caixa → "A pagar" → "Paguei".**

## Performance

- **Duration:** ~50min de execução autônoma (Tarefas 1-3, sem checkpoint, mais ~10min de um passe
  de revisão adicional pedido pelo coordenador)
- **Completed:** 2026-09-26
- **Tasks:** 3/3 (mais 1 commit de correção pós-Tarefa-3)
- **Files modified:** 8 (mais os 2 artefatos deste quick task e o STATE.md)

## Accomplishments

- **Confirmado, antes de qualquer edição, que nada no servidor precisava mudar.** `lib/financeiro/esquemas.ts::esquemaDespesaEntrada`
  e `lib/financeiro/rascunho.ts::RascunhoDeDespesa.modo` já eram uniões fechadas de exatamente dois
  membros ("compra"|"outra") desde o plano 07 — o "terceiro caminho" sempre foi um
  `<Link href="/financeiro?aba=caixa">` puramente client-side em `painel-despesa.tsx`, nunca um
  valor validado por Zod nem persistido no banco. Nenhuma migração, nenhuma mudança de Server
  Action.
- **`painel-despesa.tsx`** — removidos: o `import Link from "next/link"` e `import { ChevronRight }
  from "lucide-react"` (só usados pelo atalho), `ROTULO_PILULA_CONTA` do bloco de import, o
  `<Link data-testid="despesa-modo-conta">` inteiro (ficava FORA do `role="group"` das duas
  pílulas reais, por desenho do plano 04.4-13), e os dois comentários que citavam "as três
  pílulas"/"pagar conta que já existe" — reescritos para descrever só as duas pílulas que restam,
  com a data e o motivo da remoção registrados no comentário de cabeçalho da função.
- **`lib/financeiro/textos.ts`** — `ROTULO_PILULA_CONTA` removida; o comentário acima do bloco de
  constantes da Despesa deixou de dizer "as três pílulas do topo" e ganhou a nota da remoção.
- **`tests/e2e/financeiro-despesa.spec.ts`** — dois pontos:
  1. O teste "a aba Despesa existe e abre nas três pílulas" foi renomeado para "... nas duas
     pílulas"; a asserção de visibilidade do atalho (`despesa-modo-conta`) foi removida, mas a
     asserção de que o grupo acessível "Tipo de despesa" contém só as duas pílulas reais foi
     PRESERVADA (ela já provava um fato verdadeiro sobre o desenho do grupo, independente do
     atalho existir ou não).
  2. O teste dedicado "'Pagar conta que já existe' leva a ?aba=caixa" — que só exercitava o
     atalho, sem nenhuma outra asserção — foi removido inteiro.
- **Quatro documentos de planejamento ganharam a decisão datada, sem apagar a história:**
  `BRIEFING.md` §1 (a lista original de "três caminhos" fica, com uma nota de bloco de citação
  logo abaixo), `REQUIREMENTS.md` FNC-06 (o texto do requisito foi reescrito para "dois caminhos",
  com uma frase de atualização registrando o que era antes e por quê mudou — a linha da tabela de
  rastreabilidade não mudou, "Complete" continua valendo), `04.4-UI-SPEC.md` §Foco Visual
  Principal (a linha da Despesa) e `04.4-CONTEXT.md` §Phase Boundary (nota de bloco de citação
  logo abaixo da lista de módulos).
- **Passe de revisão adicional (comentários de código alinhados ao passado):** o coordenador
  apontou que três comentários ainda descreviam o atalho removido no PRESENTE, como se existisse
  — risco real de enganar quem lesse o código depois. `grep -rn "conta que já existe" lib
  components app tests` confirmou os três pontos exatos e nenhum outro fora do estado correto:
  - `lib/financeiro/acoes.ts:257-258` (cabeçalho de `lancarDespesa`) — reescrito no passado, com a
    data da remoção e o caminho que passou a valer.
  - `lib/financeiro/textos.ts:86-88` (comentário de `ROTULO_GRUPO_MODO_DESPESA`) — reescrito no
    passado, mesma disciplina.
  - `components/amassa/financeiro/painel-despesa.tsx:540-543` (comentário acima do
    `role="group"`) — já estava no passado ("foi REMOVIDO"), mas sem a consequência; acrescentada
    a frase "Quem quer pagar uma conta que já existe vai por Caixa → 'A pagar' → 'Paguei'" para
    igualar o tom da nota já existente em `painel-despesa.tsx:99-102`.

## Task Commits

1. **Tarefa 1: remover o terceiro modo do componente, dos textos e dos testes e2e** — `366cfcd` (fix)
2. **Tarefa 2: registrar a decisão datada do dono nos quatro documentos de planejamento** — `64f6b46` (docs)
3. **Correção pós-Tarefa-3: alinhar três comentários de código que ainda descreviam o atalho no
   presente** (pedido do coordenador) — commit registrado abaixo, junto com este SUMMARY
   atualizado.

Tarefa 3 original (verificação completa + SUMMARY + STATE) foi commitada em `2082e32`, antes deste
passe adicional.

## Files Modified

- `components/amassa/financeiro/painel-despesa.tsx` — terceiro modo removido (import, JSX,
  comentários); depois, o comentário do `role="group"` ganhou a consequência (Caixa → "A pagar" →
  "Paguei")
- `lib/financeiro/textos.ts` — `ROTULO_PILULA_CONTA` removida; depois, o comentário de
  `ROTULO_GRUPO_MODO_DESPESA` reescrito no passado
- `lib/financeiro/acoes.ts` — comentário de cabeçalho de `lancarDespesa` reescrito no passado, com
  data e consequência (achado no passe de revisão adicional, não estava no escopo original das
  Tarefas 1-3)
- `tests/e2e/financeiro-despesa.spec.ts` — teste do atalho removido; teste do grupo renomeado e
  ajustado, cobertura preservada
- `.planning/phases/04.4-financeiro-parte-1/BRIEFING.md` — nota datada em §1
- `.planning/REQUIREMENTS.md` — FNC-06 reescrito com a atualização de 2026-09-26
- `.planning/phases/04.4-financeiro-parte-1/04.4-UI-SPEC.md` — linha da Despesa em §Foco Visual
  Principal reescrita
- `.planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md` — nota datada em §Phase Boundary

## Comandos de verificação rodados

Orçamento do CLAUDE.md (§Conventions): no máximo uma invocação de `npm run test:e2e -- --grep` por
tarefa — usada uma única vez, cobrindo `financeiro despesa` e `acessibilidade` juntos (mesmo
padrão do plano 04.4-13):

- `npx tsc --noEmit` — limpo.
- `npm run lint` — limpo (0 warnings, `--max-warnings=0`).
- `npm run test:e2e -- --grep "financeiro despesa|acessibilidade"` — **96 passed** (desktop +
  celular), incluindo a varredura axe-core em `/financeiro?aba=despesa` (rota específica da
  Despesa) e em todas as outras rotas do módulo.
- `npm run verificar` (ao final da Tarefa 3, completo) — `lint` + `tsc --noEmit` +
  `verificar-acoes` (48 ações, 0 violações) + `npm test` (893 testes unitários) +
  `npm run test:migracoes` — tudo verde. Nenhuma alteração de `db/schema.ts`; `TABELAS_ESPERADAS`
  não precisou de atualização.
- `npm run verificar` (repetido depois do passe de comentários) — mesma bateria completa, tudo
  verde de novo. Nenhum e2e novo rodado para este passe (mudança é só de comentário, sem
  comportamento observável) — decisão explícita do coordenador ("não precisa de e2e, é só
  comentário").

**Total de invocações de `npm run test:e2e -- --grep`: 1** — dentro do orçamento (uma por tarefa).
Nenhuma invocação sem `--grep`; nenhum `npm run build` separado (o `test:e2e` já constrói).

## Decisions Made

Ver `key-decisions` no frontmatter: nenhuma mudança de servidor (o `modo` já era fechado em dois
membros); o teste do grupo acessível foi preservado, não descartado (Rule "nunca deletar uma
asserção que ainda prova algo verdadeiro"); os quatro documentos ganharam notas datadas por cima
da frase original, sem reescrever a história da decisão de 19/09/2026.

## Deviations from Plan

Nenhuma nas Tarefas 1-3. O plano já previa exatamente esta remoção e este escopo — a confirmação
de que o servidor não precisava de nenhuma mudança (feita ANTES de editar qualquer arquivo, lendo
`lib/financeiro/esquemas.ts`/`lib/financeiro/rascunho.ts`) confirmou a suposição do PLAN.md, sem
surpresa.

**Passe adicional pós-Tarefa-3 (fora do PLAN.md original):** o coordenador revisou o resultado e
apontou que `lib/financeiro/acoes.ts:257-258`, `lib/financeiro/textos.ts:86-88` e
`components/amassa/financeiro/painel-despesa.tsx:540-543` ainda descreviam o atalho removido no
PRESENTE — um achado real de código morto em comentário que poderia enganar quem lesse depois
(mesma classe de risco de "Rule 1 - Bug", aplicada aqui a comentário, não a comportamento). Os
três foram reescritos no passado, com a data da remoção e o caminho que passou a valer, no mesmo
tom da nota já correta em `painel-despesa.tsx:99-102`. `npm run verificar` completo rodou de novo,
verde; nenhum e2e novo (mudança sem comportamento observável).

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova. A mudança remove uma rota de navegação client-side (um `<Link>`); nenhuma
autorização, validação de servidor ou acesso a dado foi tocado.

## Issues Encountered

Nenhum bloqueante.

## Aguardando o dono

Nenhum `git push` foi dado, e nenhum será dado sem o dono autorizar. Os commits desta tarefa
(fix `366cfcd`, docs `64f6b46`, docs `2082e32`, e o passe de alinhamento de comentários commitado
junto com esta atualização do SUMMARY) estão em `main`, local, sobre `bf0f809` (o último commit da
tarefa rápida anterior, 260926-ijl).

## User Setup Required

None — nenhuma configuração externa necessária.

## Next Phase Readiness

- A Despesa mostra exatamente duas pílulas em produção assim que este trabalho for pushado e
  implantado; até lá, o código está commitado localmente em `main`.
- Quem procurar "pagar uma conta que já existe" na Despesa não encontra mais nada — o caminho é
  Caixa → "A pagar" → "Paguei", registrado nos quatro documentos de planejamento para quem
  precisar explicar isso a Andressa (a outra usuária, que ainda não aprendeu o layout).
- Nenhum bloqueio para o próximo trabalho.

---
*Phase: quick-260926-qpv*
*Completed: 2026-09-26*

## Self-Check: PASSED

`components/amassa/financeiro/painel-despesa.tsx`, `lib/financeiro/textos.ts`,
`lib/financeiro/acoes.ts`, `tests/e2e/financeiro-despesa.spec.ts` e os quatro documentos de
planejamento existem no disco com as mudanças descritas. Os commits `366cfcd` (fix) e `64f6b46`
(docs) existem em `git log --oneline --all`; o commit do passe de alinhamento de comentários
(que inclui esta própria atualização do SUMMARY) foi feito logo em seguida — conferir
`git log --oneline -1` para o hash exato. `grep -rn "conta que já existe" lib components app
tests` não encontra mais nenhum comentário de código no presente sobre o atalho removido.
`npm run verificar` (lint, `tsc --noEmit`, `verificar-acoes`, 893 testes unitários,
`test:migracoes`) rodou verde depois deste passe.
