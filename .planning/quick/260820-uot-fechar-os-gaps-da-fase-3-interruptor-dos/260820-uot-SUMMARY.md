---
status: complete
quick: 260820-uot
phase: 03-gestor-de-encomendas
tags: [encomendas, ui, e2e]
key-files:
  created: []
  modified:
    - lib/encomendas/textos.ts
    - components/amassa/encomendas/formulario-encomenda.tsx
    - tests/unit/textos-encomenda.test.ts
    - tests/e2e/encomendas-formulario.spec.ts
    - components/amassa/cabecalho-pagina.tsx
    - app/(app)/encomendas/[id]/page.tsx
    - tests/e2e/encomendas-detalhe.spec.ts
    - components/amassa/encomendas/gantt.tsx
    - components/amassa/encomendas/cartao-encomenda.tsx
    - tests/e2e/encomendas-indice.spec.ts
    - .planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md
decisions:
  - "Pílula de ajuste-rapido-etapa.tsx tem a mesma geometria de área de toque invisível de G-03-2, mas não foi tocada — registrada como observação para o dono decidir (ver seção abaixo)."
  - "As outras 8 páginas que usam CabecalhoPagina (agenda, estoque, orçamentos, painel, queimas, queimas/[id], queimas/relatorios, conta/senha) não ganharam o botão de voltar nesta tarefa — G-03-3 cobria só o detalhe da encomenda; a prop opcional deixa cada uma a uma linha de distância."
metrics:
  duration: "~1h40min"
  completed: 2026-08-20
actuals:
  tokens: 42000
  tasks: 3
  commits: 3
---

# Quick 260820-uot: Fechar os gaps da Fase 3 (interruptor dos marcos, voltar do detalhe, contagem de itens) Summary

Os três gaps que o dono achou na caminhada humana em produção de 2026-08-20 (G-03-2, G-03-3, e a
falta de pista de itens no índice) foram fechados com três commits atômicos, na ordem do plano,
sem tocar em `db/schema.ts`, `TABELAS_ESPERADAS` nem `lib/encomendas/consultas.ts`.

## Commits

1. `9a3beca` — `fix(encomendas): interruptor de marco vira controle visível dizendo acontece ou não acontece`
   - `lib/encomendas/textos.ts` ganhou `ROTULO_MARCO_ACONTECE`/`ROTULO_MARCO_NAO_ACONTECE` e
     `textoDoEstadoDoMarco`.
   - `formulario-encomenda.tsx`: a linha de cada marco (queima1/queima2/entrega) virou um
     contêiner com moldura (`border`, `rounded-md`, `min-h-[44px]`) e ganhou a palavra de estado
     ("Acontece"/"Não acontece") num `<Label for>` clicável antes do `Switch` — clicar na palavra
     alterna o interruptor. A geometria da pílula (`style={{width:44,height:44,...}}`,
     `background-clip: content-box`) não mudou nem um pixel.
   - Testes novos: 3 no unitário (`textoDoEstadoDoMarco`) e 3 no e2e (`interruptor dos marcos —
     visível e explícito`), medindo `boundingBox()`/`getComputedStyle`/`aria-checked`, nunca só
     texto.

2. `274aa72` — `fix(encomendas): detalhe ganha volta explícita para o índice no cabeçalho`
   - `CabecalhoPagina` ganhou a prop opcional `voltar?: { href; rotulo }`; ausente, o cabeçalho
     não muda (as outras 9 páginas continuam idênticas — confirmado por `tsc` limpo e pela
     varredura completa de e2e sem regressão em nenhuma delas).
   - `app/(app)/encomendas/[id]/page.tsx` passa `voltar={{ href: "/encomendas", rotulo: "Voltar
     para as encomendas" }}` e o comentário que apostava só no botão voltar do sistema
     operacional foi reescrito.
   - Teste e2e novo (`um controle de voltar para o índice aparece no cabeçalho, nas duas
     larguras`) roda nos dois projetos sem `test.skip`, medindo `>= 44x44` e a navegação real até
     `/encomendas`.

3. `0ff1b46` — `feat(encomendas): índice mostra a contagem de itens de cada encomenda`
   - `lib/encomendas/textos.ts` ganhou `textoDaContagemDeItens` (0 → "sem itens", 1 → "1 item",
     N → "N itens").
   - Gantt (desktop): a coluna fixa da linha ganhou `· N itens` ao lado do nome do cliente, com
     `min-w-0 truncate` no cliente para ele ser o sacrificado no aperto, nunca a contagem.
     `LARGURA_COLUNA_FIXA`/`ALTURA_LINHA` intactas.
   - Cartão (celular): mesmo separador `·` ao lado do cliente.
   - Nenhuma consulta nova — `itens` já vinha em memória via `EncomendaDoIndice`/D-13.
     `git diff --name-only` do commit confirma que `lib/encomendas/consultas.ts` e
     `app/(app)/encomendas/page.tsx` não aparecem.
   - `criarEncomenda` (helper de `encomendas-indice.spec.ts`) ganhou o parâmetro opcional
     `itensExtras?: string[]`, usado só pelos dois testes novos.
   - Testes e2e novos: um no Gantt, um no cartão, cada um provando singular e plural, ancorados
     na linha/cartão da própria encomenda.

## Comandos de e2e efetivamente executados

- Tarefa 1: `npm run test:e2e -- --grep "interruptor dos marcos"` — 1 vez, 18 passed.
- Tarefa 2: `npm run test:e2e -- --grep "voltar para o índice"` — 1 vez, 14 passed.
- Tarefa 3: `npm run test:e2e -- --grep "a contagem de itens"` — 1 vez, 14 passed + 2 skipped
  (espelhos de projeto, corretos).
- Fechamento: `npm run test:e2e` sem `--grep` (varredura completa) — 1 vez, **310 passed, 3
  failed, 1 flaky (passou na retentativa), 31 skipped, 1 did not run** em 5.1min. Nenhuma
  invocação extra além dessas quatro; `npm run build` nunca rodou como passo separado.

`npm run lint`, `npx tsc --noEmit` e `npm test` rodaram várias vezes ao longo das três tarefas
(baratos, conforme a regra), sempre limpos: 428 → 432 testes unitários passando ao final.

## Resultado da varredura completa (fechamento)

As 3 falhas + 1 flaky da varredura completa são, todas, incidentes **pré-existentes e já
registrados em `WINDOWS.md`**, não regressões desta tarefa:

- `autenticacao.spec.ts:84` (desktop e celular) — "a sexta tentativa seguida... mensagem de
  bloqueio" — `WINDOWS.md #3`, timeout intermitente pré-existente, confirmado independente de
  qualquer plano.
- `encomendas-detalhe.spec.ts:685` (desktop) — "concluir uma encomenda cuja data já passou...
  Concluída em ao atualizar" — `WINDOWS.md #21`, já registrado como flaky sob varredura completa
  por contenção do servidor Next único compartilhado; o mesmo teste passou no projeto celular
  nesta mesma execução.
- `queimas-manutencao.spec.ts:55` (desktop) — 1 flaky, passou na retentativa automática (`retry
  #1`); arquivo do módulo de Queimas, fora do escopo de qualquer arquivo tocado por este plano.

Nenhuma das três tarefas deste plano aparece na lista de falhas. Os testes novos das três
tarefas (`interruptor dos marcos`, `voltar para o índice`, `a contagem de itens`) já haviam sido
confirmados passando nos dois projetos pelas invocações com `--grep` de cada tarefa; a saída
bruta da varredura completa (capturada com `tail -250` por já ter mais de 300 testes) preservou
só a metade final do log, então as linhas `ok` do lado desktop desses três testes específicos não
aparecem no recorte salvo — mas nenhuma falha correspondente aparece na lista de erros, e as
corridas dedicadas por tarefa já haviam medido os dois projetos (desktop + celular) para os três,
então não há lacuna de cobertura real.

`npm run verificar` (fechamento, depois da Tarefa 3): **limpo** — `lint`, `tsc --noEmit`,
`verificar-acoes` (17 ações conferidas, 0 violações), `npm test` (432/432) e `test:migracoes`
(todas as afirmações passaram) sem nenhum erro.

`git log --oneline -3` mostra exatamente os três commits, na ordem Tarefa 1 → 2 → 3.
`git status --short` só mostra os artefatos de documentação deste quick (SUMMARY.md e
VERIFICATION.md, que o orquestrador cuida de commitar) — nenhuma mudança de código pendente.

## Observações registradas (não consertadas nesta tarefa, por instrução do plano)

1. **`ajuste-rapido-etapa.tsx` tem a mesma geometria de pílula invisível de G-03-2** (44×44 de
   área de toque com `paddingInline: 6`/`paddingBlock: 12.8`/`background-clip: content-box`,
   pílula visível de ~32×18px). Deliberadamente não tocada nesta tarefa: a linha da trilha do
   detalhe (`trilha-etapas.tsx`) já mostra "Desligada" no lugar das datas quando `dias === 0`,
   então a metade "nenhuma palavra diz o que significa" do defeito original não vale ali — mas a
   geometria pequena da pílula em si segue idêntica. Fica para o dono decidir se vale replicar a
   moldura/palavra também no ajuste rápido.

2. **`queimas/[id]`, `queimas/relatorios` e `conta/senha`** têm a mesma carência de botão de
   voltar que a encomenda tinha (G-03-3), mas ficaram fora do escopo desta tarefa — a prop
   `voltar` de `CabecalhoPagina` agora deixa cada uma delas a uma linha de distância quando o
   dono pedir.

## Desvios do plano

Nenhum desvio de escopo, arquitetura ou comportamento. Um ajuste de execução, sem impacto no
resultado: a varredura completa de e2e (~380 testes, 5.1min) excedeu o buffer de leitura do
comando em segundo plano usado para acompanhá-la em tempo real; o log salvo em disco ficou
truncado nas primeiras ~130 linhas (todas do projeto desktop rodando as suítes que não são
Encomendas). Isso não afeta o resultado relatado acima — a contagem final de passed/failed/flaky
do próprio Playwright (310 passed, 3 failed, 1 flaky, 31 skipped, 1 did not run) veio íntegra do
rodapé do log, e é ela que sustenta as conclusões desta seção.

## Self-Check

Arquivos criados/modificados:
- FOUND: lib/encomendas/textos.ts
- FOUND: components/amassa/encomendas/formulario-encomenda.tsx
- FOUND: tests/unit/textos-encomenda.test.ts
- FOUND: tests/e2e/encomendas-formulario.spec.ts
- FOUND: components/amassa/cabecalho-pagina.tsx
- FOUND: app/(app)/encomendas/[id]/page.tsx
- FOUND: tests/e2e/encomendas-detalhe.spec.ts
- FOUND: components/amassa/encomendas/gantt.tsx
- FOUND: components/amassa/encomendas/cartao-encomenda.tsx
- FOUND: tests/e2e/encomendas-indice.spec.ts

Commits:
- FOUND: 9a3beca
- FOUND: 274aa72
- FOUND: 0ff1b46

## Self-Check: PASSED
