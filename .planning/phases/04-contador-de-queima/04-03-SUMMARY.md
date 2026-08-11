---
phase: 04-contador-de-queima
plan: 03
subsystem: fullstack
tags: [next.js, react, drizzle, postgres, playwright, alert-dialog]

# Dependency graph
requires:
  - phase: 04-01
    provides: "lib/queimas/{contador,esquemas,acoes,consultas,textos}.ts, excluirQueima (mesma ação que o Desfazer do toast usa), /queimas real"
  - phase: 04-02
    provides: "components/amassa/queimas/medidor.tsx (o medidor grande reutilizado aqui), lib/queimas/formato.ts, cartao-forno.tsx com o Link para /queimas/{id}"
provides:
  - "app/(app)/queimas/[id]/{page,loading,error}.tsx: a rota de verdade do forno (D-01) — medidor grande, contador desde a última manutenção, total na vida, últimas 25 queimas e histórico de manutenções"
  - "lib/queimas/consultas.ts: buscarForno(id), FornoComHistorico, QueimaDoHistorico, ManutencaoDoHistorico"
  - "components/amassa/queimas/{historico-queimas,historico-manutencoes,confirmar-excluir-queima}.tsx"
  - "exclusão confirmada de queima do histórico (FOR-10) — o único lugar do sistema onde uma queima antiga pode ser removida"
affects: [04-04, 04-05, 04-07]

# Actuals (#2632)
actuals:
  tokens: 7539
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "buscarForno reaproveita a consulta de manutenções (ordenada desc) para dois propósitos ao mesmo tempo: a PRIMEIRA linha é a última manutenção (equivalente ao left join lateral do índice) e a lista INTEIRA é o histórico de manutenções exibido — evita uma quarta consulta redundante só para ultimaManutencaoEm"
    - "historico-queimas.tsx é client component (estado local de QUAL queima está com o dialog de exclusão aberto) montando um único ConfirmarExcluirQueima reaproveitado pelo id corrente, não um dialog por linha"
    - "AlertDialog de exclusão confirmada não navega depois do sucesso (diferença deliberada do análogo de Encomendas) — fica em /queimas/[id] e router.refresh() busca os dados frescos do Server Component"

key-files:
  created:
    - app/(app)/queimas/[id]/page.tsx
    - app/(app)/queimas/[id]/loading.tsx
    - app/(app)/queimas/[id]/error.tsx
    - components/amassa/queimas/historico-queimas.tsx
    - components/amassa/queimas/historico-manutencoes.tsx
    - components/amassa/queimas/confirmar-excluir-queima.tsx
    - tests/e2e/queimas-detalhe.spec.ts
  modified:
    - lib/queimas/consultas.ts
    - lib/queimas/textos.ts
    - lib/queimas/acoes.ts

key-decisions:
  - "buscarForno faz 4 consultas de fato (a linha do forno primeiro, fora do Promise.all, igual buscarEncomenda), mas só 3 DENTRO do Promise.all — a consulta de manutenções serve dois propósitos (ultimaManutencao + histórico completo), reconciliando a descrição literal do plano ('três consultas em Promise.all') com a necessidade de checar existência do forno antes de tudo"
  - "ocorrenciasDeQueima de buscarForno traz TODAS as queimas do forno (sem limite), nunca só as 25 exibidas — o contador/total de medirForno precisa do dado bruto completo; só a lista de exibição (queimasRecentes) é limitada a 25"
  - "excluirQueima passou a revalidar também '/queimas/[id]', não só '/queimas' — gap deixado pelo plano 04-01 frente ao padrão que 04-PATTERNS.md já documentava para todo write path do módulo (Rule 1, ver Deviations)"
  - "historico-queimas.tsx virou client component — a Tarefa 3 precisa de estado local (qual linha está com o dialog de exclusão aberto); historico-manutencoes.tsx continua Server Component (sem interação nesta fase)"
  - "corpoExcluirQueima é uma função (camelCase), não uma constante — diverge da grafia 'CORPO_EXCLUIR_QUEIMA' da lista de artefatos do plano, mesma disciplina de fraseDoRodape (interpolação de nome nunca vira template solto)"

patterns-established:
  - "cor de TIPO de queima (ponto ao lado do rótulo) nunca se mistura com cor de NÍVEL do forno — historico-queimas.tsx usa --color-biscoito/-esmalte/-ouro, nunca --color-forno-*"
  - "botão de exclusão por linha com aria-label nomeando tipo+data (nunca 'Excluir' genérico) — necessário porque a lista pode ter até 25 linhas visualmente idênticas para um leitor de tela"

requirements-completed: [FOR-09, FOR-10]

coverage:
  - id: D1
    description: "A página do forno mostra o medidor grande, o contador desde a última manutenção, o total na vida, as últimas 25 queimas e o histórico de manutenções (FOR-09)"
    requirement: FOR-09
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-detalhe.spec.ts#registrar duas queimas mostra as duas no histórico, mais-recente-primeiro"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duas queimas com o mesmo ocorrida_em aparecem ambas na lista sem fundir, desempate por id, ordem estável; o limite de 25 é aplicado no banco"
    requirement: FOR-09
    verification:
      - kind: other
        ref: "lib/queimas/consultas.ts#buscarForno — .orderBy(desc(queimas.ocorridaEm), desc(queimas.id)).limit(25), revisão de código"
        status: pass
    human_judgment: true
    rationale: "O código prova a cláusula (ordenação por dois critérios, .limit no banco), mas nenhum teste automatizado desta tarefa cria duas queimas com o MESMO instante artificialmente (o registro em produção sempre grava defaultNow(), cada toque separado por pelo menos alguns milissegundos) para exercitar o desempate por id na tela. Fronteira zero-one-many (0/1/<25) está coberta pelo e2e; o caso exato de instante idêntico fica como prova de código, candidato a fechamento na varredura de fim de fase (04-07)."
  - id: D3
    description: "Remover uma queima do histórico pede confirmação nomeando o que se perde (FOR-10), e o contador é recalculado sem recarregar manualmente"
    requirement: FOR-10
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-detalhe.spec.ts#excluir uma queima pelo dialog: cancelar não exclui nada, confirmar remove a linha e baixa o contador em um"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-detalhe.spec.ts#excluir a última queima leva a lista ao vazio inline e o contador a 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Um id que não corresponde a nenhum forno cai no notFound() da rota, não numa tela em branco"
    verification:
      - kind: other
        ref: "app/(app)/queimas/[id]/page.tsx — buscarForno(id) null → notFound(), revisão de código; mecanismo idêntico ao já provado em tests/e2e/encomendas-detalhe.spec.ts#um id inexistente responde 404"
        status: pass
    human_judgment: true
    rationale: "Task 1 não pedia teste e2e dedicado (só npm run verificar/tsc --noEmit como verify), e o orçamento de uma invocação de test:e2e por tarefa já foi usado pela Tarefa 3 nos quatro casos de exclusão. O mecanismo (buscarForno devolve null → notFound()) é sintaticamente idêntico ao de buscarEncomenda/app/(app)/encomendas/[id]/page.tsx, já provado ponta a ponta na Fase 3. Candidato a fechamento explícito na varredura completa de fim de fase (04-07)."
  - id: D5
    description: "Excluir uma de duas queimas com o mesmo instante remove exatamente a linha do id confirmado, nunca a irmã; duas exclusões simultâneas resultam em uma remoção e uma mensagem de já-removida"
    verification: []
    human_judgment: true
    rationale: "Backstop do must_haves do plano (edge probe FOR-10, concorrência). excluirQueima é idempotente por construção (db.delete(...).returning(), zero linhas devolve 'Essa queima não existe mais.' — provado por código, lib/queimas/acoes.ts, plano 04-01), mas nenhum teste desta tarefa dispara duas exclusões concorrentes de fato. Backstop explícito no plano, não fechado nesta execução — candidato à varredura de fim de fase (04-07) ou a um teste de integração dedicado se a concorrência real vier a preocupar (hoje só 3 a 5 gestores usam o sistema)."

duration: ~50min
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 3: A Página do Forno — Históricos e Exclusão Confirmada Summary

**A rota `/queimas/[id]` com o medidor grande, os dois históricos (manutenções e últimas 25 queimas) e o único lugar do sistema onde uma queima pode ser removida — sempre com confirmação nomeando o que se perde e o contador recalculado sem recarregar.**

## Performance

- **Duration:** ~50min de trabalho ativo
- **Tasks:** 3/3
- **Files modified:** 10 (7 novos, 3 modificados)

## Accomplishments

- `buscarForno` prova que dado bruto (todas as `ocorrida_em`) e dado de exibição (últimas 25 com autor) são coisas diferentes: o contador/total continuam sendo decisão exclusiva de `medirForno`, nunca da consulta — a mesma disciplina que 04-01/04-02 já estabeleceram, agora com uma segunda tela consumindo o mesmo módulo puro
- FOR-09 na tela: medidor grande, contador desde a última manutenção, total na vida, últimas 25 queimas ordenadas por `ocorridaEm`+`id` decrescente, e histórico completo de manutenções com `queimasAcumuladas` — cada lista com o seu vazio inline distinto, nunca um `EstadoVazio` de página inteira
- FOR-10 provado ponta a ponta: excluir pelo dialog nomeia o forno e as duas consequências (sai do histórico, contador recalculado), cancelar não exclui nada, confirmar remove exatamente a linha certa e a página permanece em `/queimas/[id]` — nenhuma navegação, `router.refresh()` busca os dados frescos

## Task Commits

1. **Tarefa 1: `buscarForno` e a rota `/queimas/[id]` com os três estados** — `cab808f` (feat)
2. **Tarefa 2: Os dois históricos — últimas 25 queimas e todas as manutenções** — `dc3014f` (feat)
3. **Tarefa 3: Excluir uma queima do histórico, com confirmação nomeando o que se perde** — `a2f3ca9` (feat)

**Plan metadata:** commit final registrado junto com este SUMMARY.md.

## Files Created/Modified

- `app/(app)/queimas/[id]/page.tsx` — `exigirUsuario()` primeiro, `params` assíncrono, `notFound()` quando `buscarForno` devolve `null`, medidor grande + rodapé + descrição, as duas seções de histórico
- `app/(app)/queimas/[id]/loading.tsx` — esqueleto na forma do conteúdo (cabeçalho + medidor + linhas das duas listas)
- `app/(app)/queimas/[id]/error.tsx` — `EstadoErro` com corpo próprio desta tela, um único botão "Tentar de novo"
- `lib/queimas/consultas.ts` — `buscarForno`, `FornoComHistorico`, `QueimaDoHistorico`, `ManutencaoDoHistorico`
- `components/amassa/queimas/historico-queimas.tsx` — lista das últimas 25 queimas (client component, Tarefa 3), ponto de cor por tipo, autor com fallback em português, controle de exclusão de 44px por linha
- `components/amassa/queimas/historico-manutencoes.tsx` — lista completa de manutenções, `queimasAcumuladas`, observações em `max-w-prose`
- `components/amassa/queimas/confirmar-excluir-queima.tsx` — `AlertDialog` destrutivo nomeando forno e consequências, sem navegação pós-sucesso
- `lib/queimas/textos.ts` += `FRASE_ERRO_CORPO_FORNO`, `ROTULO_HISTORICO_MANUTENCOES`, `ROTULO_HISTORICO_QUEIMAS`, `FRASE_SEM_QUEIMAS`, `FRASE_SEM_MANUTENCOES`, `ROTULO_AUTOR_DESCONHECIDO`, `TITULO_EXCLUIR_QUEIMA`, `corpoExcluirQueima`, `FRASE_FALHA_AO_EXCLUIR`
- `lib/queimas/acoes.ts` — `excluirQueima` passa a revalidar `/queimas/[id]` além de `/queimas`
- `tests/e2e/queimas-detalhe.spec.ts` — os quatro casos da Tarefa 3, desktop + celular

## Decisions Made

- **`buscarForno` reaproveita a consulta de manutenções (ordenada `desc`) para dois propósitos ao mesmo tempo.** A primeira linha é a última manutenção (equivalente ao `left join lateral` de `fornos_medidos` já usado no índice); a lista inteira é o histórico completo exibido na tela. Isso reconcilia a descrição literal do plano ("três consultas em `Promise.all`") com a necessidade de checar a existência do forno antes de tudo (uma consulta prévia, fora do `Promise.all`, no mesmo molde de `buscarEncomenda`) — sem uma quarta consulta redundante só para `ultimaManutencaoEm`.
- **`ocorrenciasDeQueima` de `buscarForno` traz TODAS as queimas do forno, sem limite** — distinto de `queimasRecentes` (as 25 exibidas). O contador e o total que `medirForno` calcula precisam do dado bruto completo; limitar essa lista a 25 subestimaria o contador de qualquer forno com mais de 25 queimas desde a última manutenção.
- **`historico-queimas.tsx` virou client component.** A Tarefa 3 precisa de estado local para saber qual linha está com o dialog de exclusão aberto — um único `ConfirmarExcluirQueima` é montado e reaproveitado pelo `id` corrente, em vez de 25 instâncias de dialog simultâneas. `historico-manutencoes.tsx` continua Server Component, sem nenhuma interação nesta fase.
- **`corpoExcluirQueima` é uma função (camelCase), não uma constante.** A lista de artefatos do plano grafa "CORPO_EXCLUIR_QUEIMA" no estilo de constante, mas o corpo interpola o nome do forno — a mesma disciplina de `fraseDoRodape` (nunca um template solto com placeholder manual) pediu uma função.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `excluirQueima` só revalidava `/queimas`, nunca `/queimas/[id]`**
- **Found during:** Tarefa 3, ao ler `04-PATTERNS.md` ("revalidatePath after every write... apply `revalidatePath('/queimas')` and `revalidatePath('/queimas/[id]', 'page')`") contra o `lib/queimas/acoes.ts` herdado do plano 04-01, que só chamava `revalidatePath("/queimas")`.
- **Issue:** Este plano faz `ConfirmarExcluirQueima` permanecer em `/queimas/[id]` depois do sucesso (diferença deliberada do análogo de Encomendas) e depender de `router.refresh()` para mostrar o contador recalculado. `router.refresh()` refaz a busca de RSC da rota atual independentemente de `revalidatePath`, então o comportamento na prática já funcionava (confirmado pelo e2e) — mas o padrão documentado explicitamente em `04-PATTERNS.md` para todo write path do módulo não estava seguido, e um caminho futuro (ex.: revalidação vinda de outra aba/rota, cache de segmento estático) dependeria dele.
- **Fix:** acrescentada `revalidatePath("/queimas/[id]", "page")` logo após `revalidatePath("/queimas")` em `excluirQueima`, com comentário explicando por que as duas chamadas continuam necessárias (Desfazer em `/queimas`, exclusão confirmada em `/queimas/[id]`).
- **Files modified:** `lib/queimas/acoes.ts`
- **Verification:** `npm run verificar` completo (inclui `tsc`/`lint`/`verificar-acoes`/testes unitários/`test:migracoes`) e o e2e da Tarefa 3 (17/17) passaram depois da mudança.
- **Committed in:** `a2f3ca9` (Tarefa 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — gap documentado em `04-PATTERNS.md` mas não seguido em `04-01`)
**Impact on plan:** Nenhum comportamento visível mudou (o `router.refresh()` já cobria o caso na prática) — a mudança fecha uma divergência entre código e o padrão documentado do próprio projeto, relevante para os planos 04-04/04-05 que também vão escrever a partir da página do forno.

## Issues Encountered

Nenhum além do já registrado em Deviations.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

- `npm run test:e2e -- --grep "detalhe do forno"` — 1 execução (Tarefa 3), 17/17 passou (13 pré-existentes da cadeia `vazio-*`/outras specs + 8 novos casos de `queimas-detalhe.spec.ts`, desktop e celular). Nenhum `npm run build` separado — a execução do e2e já constrói.
- `npm run verificar` (inclui `test:migracoes`) — 3 execuções completas, uma ao final de cada tarefa, todas verdes.

## User Setup Required

None — nenhuma configuração externa nova.

## Next Phase Readiness

- `/queimas/[id]` está pronta para os planos 04-04 (editar/desativar/reativar forno, registrar manutenção — tudo nesta mesma página) e 04-05 (o banner de atenção leva para cá) acrescentarem só a ação nova, sem reconstruir a rota
- `HistoricoManutencoes`/`HistoricoQueimas` prontos para exibir o efeito de `registrarManutencao` (04-04) sem nenhuma mudança de forma — a nova manutenção simplesmente aparece na lista já existente
- Pendências explícitas para a varredura de fim de fase (04-07): D2 (desempate por `id` entre queimas de instante idêntico, só provado por código), D4 (404 de `/queimas/[id]` com `id` inexistente, mecanismo idêntico ao já provado em Encomendas mas sem teste e2e dedicado nesta tarefa), D5 (backstop de concorrência — duas exclusões simultâneas da mesma queima)
- `excluirQueima` agora revalida as duas rotas que a chamam (`/queimas` do Desfazer, `/queimas/[id]` da exclusão confirmada) — convenção que `registrarManutencao`/`atualizarForno`/`desativarForno`/`reativarForno` (04-04) devem seguir desde o início

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 10 files claimed above (`app/(app)/queimas/[id]/page.tsx` through `tests/e2e/queimas-detalhe.spec.ts`) confirmed present on disk.
All 3 commit hashes (`cab808f`, `dc3014f`, `a2f3ca9`) confirmed in `git log --all`.
