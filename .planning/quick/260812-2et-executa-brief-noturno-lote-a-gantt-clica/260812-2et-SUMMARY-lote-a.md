---
status: complete
task: 260812-2et
lote: A (Tarefas 1, 2 e 3 — A1, A2, A3)
---

# Quick task 260812-2et — Lote A (Gantt clicável, eixo de tempo, timeline em hoje) — Summary

Um resumo por linha: as três encomendas do Lote A do `BRIEF-NOTURNO.md` foram fechadas, na ordem
A1 → A2 → A3, um commit atômico por item, `npm run verificar` limpo ao final. A Tarefa 4 (C — tela
de trocar senha) **não foi executada** por instrução explícita — fica para um segundo executor.

## Commits

| # | Hash | Mensagem |
|---|------|----------|
| 1 (A1) | `c3adfa2` | `fix(encomendas): nome no Gantt do desktop vira link para a encomenda` |
| 2 (A2) | `aa5a720` | `feat(encomendas): marca de hoje e datas das pontas na barra do celular` |
| 3 (A3) | `bc0d790` | `feat(encomendas): timeline do Gantt abre em hoje, agrupada por semana` |

## O que cada commit fez

**Tarefa 1 (A1) — `c3adfa2`**
- `components/amassa/encomendas/gantt.tsx`: o conteúdo da coluna fixa (nome + selo de rascunho +
  cliente) passou a ficar dentro de um `Link` do `next/link` para `/encomendas/{id}`, com o mesmo
  anel de foco do cartão mobile. O `div` externo continua `sticky`, o `data-testid`
  `gantt-linha-{id}` continua intacto, e a linha inteira (área rolável + barras `role="img"`)
  continua sem link por cima.
- Novo teste e2e no describe "Gantt desktop": lê o `href` do link (leitura determinística), clica
  e confirma a URL e o conteúdo da página de destino.

**Tarefa 2 (A2) — `aa5a720`**
- `lib/encomendas/trilha.ts` (módulo puro novo, zero import, zero `Date`): `posicaoDeHojeNaTrilha`
  devolve o percentual de onde "hoje" cai dentro do período desenhado pela trilha do cartão
  mobile, ou `null` quando "hoje" está fora do período (nunca gruda numa ponta).
- `trilha-segmentos.tsx` ganhou a prop `hoje` (nunca lê o relógio) e passou a desenhar, além da
  barra proporcional já existente: (1) uma marca decorativa (`trilha-hoje`, `aria-hidden`) quando
  `posicaoDeHojeNaTrilha` devolve um número; (2) uma linha de datas abaixo da barra
  (`trilha-datas`) com início e entrega formatados por `formatarDiaCurto`, cada um com rótulo
  `sr-only` para leitor de tela.
- Fiação de `hoje`: `lista-encomendas.tsx` → `CartaoEncomenda` → `TrilhaSegmentos` (as duas props
  novas, `CartaoEncomendaProps.hoje` e `TrilhaSegmentosProps.hoje`, exigidas em TypeScript).
- Sete testes unitários novos cobrindo cada linha do `<behavior>` do plano; quatro testes e2e
  novos no projeto `celular`.

**Tarefa 3 (A3) — `bc0d790`** (item mais pesado do lote — muda o contrato de `lib/encomendas/gantt.ts`)
- `quinzenaQueContem`/`quinzenaAnterior`/`quinzenaPosterior` viraram `semanaQueContem`/
  `semanaPosterior` (segunda-feira como início de semana, mesma convenção de FOR-12 dos
  relatórios de queima da Fase 4). `quinzenaAnterior` e `ultimoDiaDoMes` desapareceram por
  completo (órfãos).
- `calcularIntervalo`: `primeiroDia` é sempre a segunda-feira da semana de `hoje` — o menor início
  entre as encomendas deixou de influenciar o começo do intervalo (mesmo uma encomenda de
  2025-01-01 não recua `primeiroDia` além da segunda da semana de hoje, provado em teste). A
  folga no fim passou de uma quinzena para uma semana; não há mais folga no começo.
- `retanguloDaEtapa` ganhou o campo `cortadaNaEsquerda: boolean` e um recorte explícito: etapa
  iniciada antes de `intervalo.primeiroDia` vira `{ esquerda: 0, largura: reduzida,
  cortadaNaEsquerda: true }`; etapa que termina em ou antes de `primeiroDia` devolve `null`
  (mesmo tratamento que `dias === 0` já tinha); `esquerda` nunca fica negativa.
- `celulasDeQuinzena` → `celulasDeSemana` (tipo `CelulaDeQuinzena` → `CelulaDeSemana`), com rótulo
  novo para semana que cruza o mês (`"31 ago–6 set"`) além do formato de sempre para semana
  dentro do mesmo mês (`"10–16 ago"`).
- `gantt.tsx`: `celulasDeQuinzena` → `celulasDeSemana`, `data-testid="gantt-celula-quinzena"` →
  `"gantt-celula-semana"`, marca visual de corte (borda esquerda de 3px + cantos retos +
  `data-cortada`) e sufixo `" — começou antes"` no `aria-label` da barra cortada.
- Testes unitários (`tests/unit/gantt.test.ts`) reescritos por completo para o contrato de semana,
  incluindo os dois casos de borda obrigatórios (recorte à esquerda; faixa que termina em/antes de
  `primeiroDia`) e o rótulo de semana cruzando o mês.
- Testes e2e atualizados: `gantt-celula-quinzena` → `gantt-celula-semana` nos dois pontos;
  `expect(esperado).toBe(0)` acrescentado ao teste de `scrollLeft` inicial (prova de que a
  timeline abre em hoje); teste "com uma encomenda só" retitulado (folga só no fim); **teste novo
  obrigatório** — encomenda iniciada 10 dias antes de hoje: nenhuma barra/marco desenha à esquerda
  da régua, e qualquer elemento `data-cortada="true"` encosta exatamente na origem da régua
  (formulado sem depender de qual etapa especificamente fica cortada — isso varia com o dia da
  semana em que o teste roda, como o próprio plano avisa).
- `tests/e2e/encomendas-filtros.spec.ts`: a encomenda "longínqua" do teste D-14 passou de
  `dataEmDias(-200)` para `dataEmDias(200)` — com a timeline abrindo em hoje, uma encomenda no
  passado não alarga mais o intervalo; só o futuro ainda estica.

## Comandos de e2e efetivamente executados

Orçamento de e2e respeitado: no máximo uma invocação de `npm run test:e2e` por tarefa, sempre com
`--grep`. Nenhum `npm run build` separado. Nenhuma varredura completa sem `--grep` (essa é do
fechamento, depois da Tarefa 4, responsabilidade do segundo executor).

| # | Comando | Resultado |
|---|---------|-----------|
| 1 | `npm run test:e2e -- --grep "Gantt desktop"` (Tarefa 1) | 21 passaram, 9 skipped (celular) |
| 2 | `npm run test:e2e -- --grep "Lista mobile"` (Tarefa 2) | 25 passaram, 13 skipped (desktop) |
| 3 | `npm run test:e2e -- --grep "Gantt desktop\|filtrar reduz o intervalo"` (Tarefa 3) | 24 passaram, 10 skipped |

Total: **3 invocações de `npm run test:e2e`**, uma por tarefa, todas com `--grep`. `npm run
verificar` (que inclui `npm run test:migracoes`, não `test:e2e`) rodou uma vez ao final da Tarefa
3, limpo.

## Desvios do plano

**Nenhum desvio de código** — o plano foi executado ao pé da letra: nomes de funções, campos,
`data-testid`s, mensagens e testes seguem exatamente o que `260812-2et-PLAN.md` especificou.

**Nota de ambiente (não é desvio do plano, registrado por transparência):** o Docker Desktop não
estava em execução no início da sessão (`docker info` falhou com "failed to connect to the docker
API"). Foi iniciado manualmente (`Docker Desktop.exe`) e levou cerca de 2-3 minutos para o daemon
ficar pronto antes da primeira invocação de `npm run test:e2e`. Não é um item de código a corrigir
— é um estado da máquina Windows local no começo da sessão.

## O que ficou aberto

Nada do escopo do Lote A ficou aberto. A **Tarefa 4 (C — tela de trocar senha)** não foi
executada, por instrução explícita do orquestrador — cabe ao segundo executor, junto com o
fechamento completo do plano (`npm run verificar` final + varredura completa de `npm run
test:e2e` sem `--grep`, uma vez só).

## Verificação

`npm run verificar` (lint + `tsc --noEmit` + `verificar-acoes` + `npm test` + `test:migracoes`)
passou limpo ao final da Tarefa 3, fechando o Lote A conforme o brief exige ("Rode `npm run
verificar` ao fim de cada lote").

`git log --oneline -3` mostra exatamente os três commits acima, um por item do Lote A.
`git status` não mostra migração nova nem mudança em `db/schema.ts` — nenhum arquivo fora da lista
`files_modified` do plano foi tocado.
