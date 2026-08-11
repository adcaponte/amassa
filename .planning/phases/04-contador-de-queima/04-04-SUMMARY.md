---
phase: 04-contador-de-queima
plan: 04
subsystem: fullstack
tags: [next.js, react, drizzle, postgres, zod, react-hook-form, playwright, vitest, dropdown-menu, alert-dialog]

# Dependency graph
requires:
  - phase: 04-01
    provides: "lib/queimas/{contador,esquemas,acoes,consultas,textos}.ts, criarForno, tabela manutencoes com queimasAcumuladas"
  - phase: 04-02
    provides: "cartao-forno.tsx com Medidor/selo/rodapé, lib/queimas/formato.ts"
  - phase: 04-03
    provides: "app/(app)/queimas/[id]/page.tsx (a rota de verdade do forno), buscarForno, historico-queimas.tsx/historico-manutencoes.tsx, revalidatePath duplo (/queimas + /queimas/[id]) em todo write path"
provides:
  - "lib/queimas/esquemas.ts += esquemaManutencao (queimasAcumuladas DELIBERADAMENTE ausente), esquemaAtualizacaoDeForno"
  - "lib/queimas/acoes.ts += registrarManutencao (transação com select...for update, insert puro em manutencoes, nunca toca queimas), atualizarForno, desativarForno, reativarForno (transição pelo valor oposto de ativo)"
  - "components/amassa/queimas/registrar-manutencao.tsx: dialog com a frase 'O contador vai de N para 0.', Responsável/Observações opcionais, botão nasce habilitado"
  - "components/amassa/queimas/acoes-forno.tsx: menu ⋮ Mais ações — editar/desativar/reativar, nunca exclusão"
  - "formulario-forno.tsx passa a servir criação E edição (atualizarForno); cartao-forno.tsx esmaece forno desativado e some com o botão Queimar"
affects: [04-05, 04-06, 04-07]

# Actuals (#2632)
actuals:
  tokens: 13247
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "registrarManutencao é a primeira ação do módulo com db.transaction + select...for update: trava a linha do forno para serializar duas manutenções concorrentes, conta as queimas posteriores à última manutenção DENTRO da transação (a mesma regra de corte de lib/queimas/contador.ts#medirForno, reproduzida em SQL) e insere — nenhum delete/update sobre queimas em nenhum ramo"
    - "desativarForno/reativarForno filtram o WHERE pelo valor OPOSTO de ativo (never eq(ativo, true) sem o filtro anterior) — a transição inválida casa zero linhas e devolve mensagem em português, nunca um sucesso mudo"
    - "fraseDoContadorZerando/fraseDesativarForno/rotuloMaisAcoes são funções (camelCase), não constantes FRASE_*/ROTULO_* — mesma disciplina que corpoExcluirQueima (04-03) já estabeleceu: toda frase que interpola um valor vira função, nunca uma constante com placeholder manual"
    - "FormularioForno ganha um segundo modo (fornoParaEditar) em vez de um segundo componente — mesmo Dialog, mesmo esquema, só troca criarForno por atualizarForno e o alvo do router.push no fechamento; abre por ?novo em /queimas ou ?editar em /queimas/[id], nunca os dois na mesma rota"

key-files:
  created:
    - components/amassa/queimas/registrar-manutencao.tsx
    - components/amassa/queimas/acoes-forno.tsx
    - tests/unit/esquemas-queima.test.ts
    - tests/e2e/queimas-manutencao.spec.ts
  modified:
    - lib/queimas/esquemas.ts
    - lib/queimas/acoes.ts
    - lib/queimas/textos.ts
    - components/amassa/queimas/formulario-forno.tsx
    - components/amassa/queimas/cartao-forno.tsx
    - app/(app)/queimas/[id]/page.tsx

key-decisions:
  - "lib/queimas/consultas.ts NÃO precisou de nenhuma mudança, apesar de listado em files_modified do plano — FornoMedido/FornoComHistorico já expunham `ativo` desde o plano 04-01/04-02, e registrarManutencao conta queimas via SQL direto dentro da transação (select({total: count()})), sem passar por nenhuma função de consultas.ts"
  - "Não existe um shadcn Textarea instalado (04-UI-SPEC.md lista os componentes já presentes e textarea não está entre eles) — Observações usa um <textarea> nativo com classe própria (resize-none, overflow-y-auto, altura máxima fixa), espelhando as classes de input.tsx em vez de instalar um novo primitivo para um único campo"
  - "AlertDialogAction de 'Desativar forno' usa variant='secondary', não o default (que resolve para --color-acento/terracota) nem 'destructive' — terracota é reservado para o único botão de acento por tela (aqui, 'Registrar manutenção'), e desativar não é exclusão"
  - "RegistrarManutencao abre por estado local (useState), não por searchParams como FormularioForno — é dono do próprio gatilho (não um deep-link compartilhado entre /queimas e /queimas/[id]), então não precisa da convenção ?novo/?editar"
  - "AcoesForno usa router.push(\"?editar\") relativo (mantém os demais searchParams via URLSearchParams) em vez de reconstruir o pathname — já estamos em /queimas/[id], então só o parâmetro muda"

patterns-established:
  - "Toda transição de estado boolean (ativo) filtra o WHERE pelo valor oposto do alvo — não checa 'existe' e depois decide, deixa o próprio banco recusar a transição inválida com zero linhas devolvidas"
  - "Confirmação leve (não-destrutiva) reaproveita AlertDialog com variant neutro em vez de variant='destructive' — reversível não pede o mesmo peso visual de 'apagar'"

requirements-completed: [FOR-07, FOR-11]

coverage:
  - id: D1
    description: "Registrar manutenção mostra, em texto, 'O contador vai de N para 0.' antes de gravar, com N vindo pronto do servidor (FOR-07)"
    requirement: FOR-07
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-manutencao.spec.ts#registrar manutenção zera o contador sem apagar nenhuma queima — asserção da frase 'O contador vai de 3 para 0.'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Responsável e observações são ambos opcionais e o botão de confirmação já nasce habilitado — submeter vazio grava uma manutenção válida (FOR-07, E7/empty)"
    requirement: FOR-07
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-manutencao.spec.ts#registrar manutenção... — confirmar-registrar-manutencao está habilitado e a submissão vazia é aceita"
        status: pass
    human_judgment: false
  - id: D3
    description: "Depois de registrar a manutenção o contador é 0 e nenhuma queima foi apagada — o total na vida (linhas de queimas) permanece o mesmo antes e depois (FOR-07, a prova central do plano)"
    requirement: FOR-07
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-manutencao.spec.ts#registrar manutenção... — contador 0/50 e lista-historico-queimas com 3 linhas, antes e depois"
        status: pass
    human_judgment: false
  - id: D4
    description: "Registrar manutenção duas vezes seguidas: a segunda frase lê 'de 0 para 0', duas linhas em manutencoes, contador continua 0, e o histórico de queimas não muda (idempotência, edge probe FOR-07)"
    requirement: FOR-07
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-manutencao.spec.ts#registrar manutenção... — segunda chamada, frase 'O contador vai de 0 para 0.', lista-historico-manutencoes com 2 linhas"
        status: pass
    human_judgment: true
    rationale: "O e2e prova as duas gravações sequenciais e o resultado final, mas não dispara um duplo-toque real (clique simultâneo) no botão de confirmação para provar que o `disabled` durante `formState.isSubmitting` de fato bloqueia uma segunda submissão em voo — a defesa existe por código (mesmo padrão de RegistrarQueima/ConfirmarExcluirQueima), mas o cenário de corrida do cliente não foi exercitado. Candidato à varredura de fim de fase (04-07)."
  - id: D5
    description: "'Registrar manutenção' existe apenas na página do forno, nunca no cartão do índice (D-03)"
    verification:
      - kind: other
        ref: "components/amassa/queimas/cartao-forno.tsx — revisão de código, nenhum import de RegistrarManutencao; grep confirma ausência"
        status: pass
    human_judgment: false
  - id: D6
    description: "Editar nome, descrição e limite acontece na página do próprio forno, via o menu ⋮ Mais ações → Editar forno, reaproveitando FormularioForno em modo edição (D-02)"
    verification: []
    human_judgment: true
    rationale: "O código prova o mecanismo (FormularioForno aceita fornoParaEditar, chama atualizarForno, abre por ?editar em /queimas/[id]) e npm run verificar/tsc passam, mas nenhum teste e2e desta tarefa exercita o fluxo de edição fim a fim (o orçamento de uma invocação de test:e2e por tarefa foi usado pelos quatro casos de manutenção/desativar-reativar, que são o núcleo do plano). Candidato a fechamento em plano futuro ou na varredura de fim de fase (04-07)."
  - id: D7
    description: "Um forno pode ser desativado e reativado pela página dele; o contador volta exatamente de onde parou, porque nada foi apagado (D-06)"
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-manutencao.spec.ts#desativar tira o botão Queimar... — medidor-contador '2 / 50' antes de desativar e depois de reativar, idêntico"
        status: pass
    human_judgment: false
  - id: D8
    description: "Um forno desativado aparece esmaecido no índice e sem o botão 'Queimar', e a página dele continua abrindo com todo o histórico (D-05)"
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-manutencao.spec.ts#desativar tira o botão Queimar... — ausência do botão Queimar no cartão, e /queimas/{id} abre com o medidor e o cabeçalho"
        status: pass
    human_judgment: true
    rationale: "A AUSÊNCIA do botão 'Queimar' e a página continuando a abrir são provadas por e2e. O tratamento ESMAECIDO em si (opacity-75 sobre o Card) é uma classe CSS provada só por revisão de código — nenhum teste mede contraste de cor renderizado. A nota inline no código argumenta que a base de contraste do tema já folga bem acima do mínimo AA, mas essa é uma alegação de projeto, não uma medição; mesma categoria de pendência visual que D4/D6 de 04-02 (posição em pixels do medidor) — candidato à checagem humana de fim de fase (04-07)."
  - id: D9
    description: "A interface não oferece, em lugar nenhum, apagar um forno (FOR-11) — nenhuma ação de exclusão de forno existe no módulo"
    requirement: FOR-11
    verification:
      - kind: other
        ref: "lib/queimas/acoes.ts — revisão de código, grep por 'delete(fornos' não encontra ocorrência; verificar-acoes confirma as 4 ações novas com exigirUsuario() primeiro"
        status: pass
    human_judgment: false
  - id: D10
    description: "desativarForno/reativarForno filtram pelo valor OPOSTO de ativo — a transição já feita (desativar o que já está desativado) devolve mensagem em português, não sucesso mudo (edge probe FOR-11)"
    verification: []
    human_judgment: true
    rationale: "Provado por revisão de código (o WHERE inclui eq(ativo, <oposto>), returning() vazio vira { ok: false, erro }) — nenhum teste e2e desta tarefa dispara a transição inválida (ex.: dois cliques rápidos em 'Desativar forno' ou reabrir o menu depois de já desativado). Backstop do must_haves do plano, candidato à varredura de fim de fase (04-07) ou a um teste de integração dedicado."

duration: ~40min
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 4: Manutenção e o Ciclo Desativar/Reativar Summary

**`registrarManutencao` zera o contador por corte de data dentro de uma transação com `select...for update`, sem tocar `queimas`; `desativarForno`/`reativarForno` completam FOR-11 filtrando o `WHERE` pelo valor oposto de `ativo`; e o cartão do índice esmaece um forno desativado e some com "Queimar".**

## Performance

- **Duration:** ~40min de trabalho ativo
- **Tasks:** 3/3
- **Files modified:** 10 (4 novos, 6 modificados)

## Accomplishments

- A regra central do módulo — "o contador zera por consequência do corte de data, nunca por exclusão" — ficou visível na interface: `registrarManutencao` roda dentro de `db.transaction`, trava a linha do forno com `select ... for update` (serializa duas manutenções concorrentes), conta as queimas posteriores à última manutenção com a MESMA regra de `lib/queimas/contador.ts#medirForno` (agora em SQL), e faz um único `insert` em `manutencoes` — provado por e2e que o total na vida (linhas de `queimas`) não muda depois de registrar
- FOR-11 completo: `atualizarForno`, `desativarForno`, `reativarForno` — as quatro ações novas com `exigirUsuario()` como primeira instrução (`verificar-acoes` confere as 16 ações do projeto, 0 violações), e nenhum caminho de exclusão de forno em lugar nenhum do módulo
- Um estado sem caminho de criação vira código inalcançável (lição da Fase 3, `03-VERIFICATION.md`) — por isso reativar existe desde o início, não como um ajuste posterior: o e2e prova o ciclo completo desativar → reativar com o contador voltando exatamente ao valor anterior

## Task Commits

1. **Tarefa 1: `registrarManutencao` — o zero que não apaga nada** — `00c35dc` (feat)
2. **Tarefa 2: O dialog "Registrar manutenção" com a frase literal e os dois campos opcionais** — `fcb5569` (feat)
3. **Tarefa 3: Editar, desativar e reativar o forno — e o cartão esmaecido no índice** — `c407eb2` (feat)

**Plan metadata:** commit final registrado junto com este SUMMARY.md.

## Files Created/Modified

- `lib/queimas/esquemas.ts` += `esquemaManutencao` (sem `queimasAcumuladas` — derivado no servidor), `esquemaAtualizacaoDeForno`
- `lib/queimas/acoes.ts` += `registrarManutencao`, `atualizarForno`, `desativarForno`, `reativarForno`, `FornoNaoEncontrado`
- `lib/queimas/textos.ts` += `ROTULO_REGISTRAR_MANUTENCAO`, `fraseDoContadorZerando`, `ROTULO_RESPONSAVEL`, `ROTULO_OBSERVACOES`, `ROTULO_DESATIVAR_FORNO`, `ROTULO_REATIVAR_FORNO`, `fraseDesativarForno`, `rotuloMaisAcoes`, `ROTULO_SALVAR`
- `components/amassa/queimas/registrar-manutencao.tsx` — Dialog único responsivo, frase por prop do servidor, `textarea` nativo com rolagem própria
- `components/amassa/queimas/acoes-forno.tsx` — menu ⋮ Mais ações, editar/desativar/reativar, confirmação leve (não destrutiva) para desativar
- `components/amassa/queimas/formulario-forno.tsx` — passa a servir criação (`?novo`, `/queimas`) e edição (`?editar`, `/queimas/[id]`)
- `components/amassa/queimas/cartao-forno.tsx` — `opacity-75` e sem `RegistrarQueima` quando `ativo` é falso
- `app/(app)/queimas/[id]/page.tsx` — monta `AcoesForno` no cabeçalho, `FormularioForno` de edição, `RegistrarManutencao` junto do medidor
- `tests/unit/esquemas-queima.test.ts` — 12 casos (`esquemaManutencao` × 7, `esquemaForno` × 5)
- `tests/e2e/queimas-manutencao.spec.ts` — os quatro casos do plano: frase do contador, total inalterado, idempotência, ciclo desativar/reativar

## Decisions Made

- **`lib/queimas/consultas.ts` não precisou de nenhuma mudança**, apesar de listado em `files_modified` do plano. `FornoMedido`/`FornoComHistorico` já expunham `ativo` desde os planos 04-01/04-02, e `registrarManutencao` conta queimas via `select({ total: count() })` direto dentro da própria transação — sem passar por nenhuma função de `consultas.ts`. Nenhuma funcionalidade ficou faltando; o arquivo simplesmente já tinha o que este plano precisava.
- **`textarea` nativo em vez de um novo primitivo shadcn.** `04-UI-SPEC.md` lista os componentes já instalados e `textarea` não está entre eles. Em vez de rodar o gate de instalação de um componente shadcn para um único campo, `registrar-manutencao.tsx` usa um `<textarea>` com classe própria (`resize-none`, `overflow-y-auto`, altura máxima fixa) espelhando as classes de `input.tsx` — mesmo padrão visual, sem dependência nova.
- **Botão "Desativar forno" do `AlertDialogAction` usa `variant="secondary"`, não o `default`** (que resolveria para `--color-acento`/terracota, reservado ao único botão de acento por tela — aqui, "Registrar manutenção") **nem `"destructive"`** (reversível, não é exclusão — D-06 é explícito sobre isso).
- **`RegistrarManutencao` abre por `useState` local, não por `searchParams`** como `FormularioForno`. Ele não é um deep-link compartilhado entre duas rotas (`FormularioForno` abre por `?novo` em `/queimas` OU `?editar` em `/queimas/[id]`); é dono do próprio gatilho numa única tela, então a convenção de URL não se aplica.

## Deviations from Plan

None — plano executado exatamente como escrito. A única divergência da lista literal de artefatos (`FRASE_DESATIVAR_FORNO`, `ROTULO_MAIS_ACOES` descritos como constantes no plano) é a mesma disciplina que o plano 04-03 já havia estabelecido para `corpoExcluirQueima`: toda frase que interpola um valor (aqui, o nome do forno) vira função `camelCase`, não uma constante `ALL_CAPS` com placeholder manual — consistente com o padrão do próprio módulo, não uma mudança de comportamento.

## Issues Encountered

Nenhum. Porta 3000 estava livre antes da execução do e2e; nenhum processo remanescente para encerrar.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

- `npm run test:e2e -- --grep "manutenção"` — 1 execução (Tarefa 3), 15/15 passou (11 pré-existentes das cadeias `vazio-*`/`queimas-cartao` + 4 novos casos de `queimas-manutencao.spec.ts`, desktop e celular). Nenhum `npm run build` separado — a execução do e2e já constrói.
- `npm run verificar` (inclui `test:migracoes`) — 3 execuções completas, uma ao final de cada tarefa, todas verdes.

## User Setup Required

None — nenhuma configuração externa nova.

## Next Phase Readiness

- `desativarForno`/`atualizarForno` prontos para o plano 04-05 (o filtro `Ativos/Desativados/Todos` do índice, D-05) — o campo `ativo` já é alcançável nos dois sentidos pela interface, a condição que `03-VERIFICATION.md` cobrou
- `registrarManutencao` pronto para os relatórios do plano 04-06 lerem o histórico de `manutencoes` sem nenhuma mudança de forma
- Pendências explícitas para a varredura de fim de fase (04-07): D4 (corrida de duplo-toque no botão de confirmação da manutenção, só provada por código), D6 (fluxo de edição de forno fim a fim, sem e2e dedicado nesta tarefa — orçamento usado pelos quatro casos centrais), D8 (tratamento esmaecido — contraste AA é alegação de projeto, não medição), D10 (transição inválida de `ativo`, backstop do must_haves)
- Nenhum bloqueio novo — `db/schema.ts`/`db/migrations/` seguem sem mudança nesta tarefa (nenhuma coluna nova precisou de migração)

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 10 files claimed above (`lib/queimas/esquemas.ts` through `tests/e2e/queimas-manutencao.spec.ts`) confirmed present on disk.
All 3 commit hashes (`00c35dc`, `fcb5569`, `c407eb2`) confirmed in `git log --all`.
