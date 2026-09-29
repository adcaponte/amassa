---
phase: 06-estoque
plan: 03
subsystem: estoque
status: complete
tags: [estoque, financeiro, venda, compra, estorno, transacao, D-33]
requires:
  - "06-01: lib/estoque/gravacao.ts (gravarMovimentacoes, travarItens), custo.ts (movimentoDoEstorno), a migração 0023"
  - "06-02: a prova de que a trava `no key update` depois das linhas não entra em impasse"
provides:
  - "lib/estoque/pedidos.ts — pedidosDaVenda, pedidosDaCompra, pedidosDoEstorno, LinhaDeVendaGravada, LinhaDeCompraGravada, MovimentacaoOriginal"
  - "lib/estoque/gravacao.ts — carregarItensParaEfeito(tx, ids), areasDasCategorias(tx, ids), originaisSemEstorno(tx, documentoId)"
  - "lancarVenda / lancarDespesa (modo compra) / cancelarDocumento gravam no livro dentro da transação do documento"
  - "item desativado recusado na Venda, na Compra e no atalho; seletores da Venda e da Compra filtram ativo"
  - "tests/e2e/estoque-financeiro.spec.ts (casos a–h) e tests/e2e/apoio/semear-documento-antigo.ts"
  - "movimentacoesDoItem devolve id, documentoId, documentoLinhaId e estornoDeId"
affects: [06-04, 06-05, 06-06, 06-07, 06-08, 06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "efeito por linha: efeitoNoEstoque([linha]) uma vez por linha gravada; o id da linha vem do returning"
    - "estorno espelha o livro (originaisSemEstorno → pedidosDoEstorno → gravarMovimentacoes), nunca a ficha de hoje"
key-files:
  created:
    - tests/unit/estoque-pedidos.test.ts
    - tests/e2e/estoque-financeiro.spec.ts
    - tests/e2e/apoio/semear-documento-antigo.ts
  modified:
    - lib/estoque/pedidos.ts
    - lib/estoque/gravacao.ts
    - lib/financeiro/acoes.ts
    - lib/financeiro/consultas.ts
    - tests/unit/financeiro-efeito-estoque.test.ts
    - tests/e2e/apoio/semear-estoque.ts
decisions:
  - "O documentoId entra no pedido pela ação (map depois de pedidosDaVenda/pedidosDaCompra); a assinatura pura ficou a do plano"
  - "pedidosDaVenda lança erro se a categoria da linha não tiver área: o check venda_exige_area recusaria de qualquer jeito, e o erro diz o porquê no log (a venda volta inteira e o gestor lê FRASE_FALHA_AO_SALVAR)"
  - "Na Compra, item desativado recebe a frase da Venda ('Um dos itens saiu do catálogo…') antes da frase de 'sem estoque próprio'"
  - "As revalidações de Estoque e Início na despesa só acontecem no modo compra (outra despesa não mexe no estoque)"
metrics:
  duration: "~14 min (05:09 → 05:23 UTC, 29/09/2026)"
  completed: 2026-09-29
estimate:
  tokens: 95000
  tasks: 2
actuals:
  tokens: 13300
  tasks: 2
  commits: 4
---

# Phase 06 Plan 03: O Financeiro grava o efeito no estoque Summary

**A venda baixa o que a ficha manda e a compra dá entrada com o valor da nota, as duas dentro da
transação do documento e por `efeitoNoEstoque` chamado uma vez por linha. Cancelar espelha o livro:
uma movimentação por original, com `estorno_de_id`, sem recalcular pela ficha de hoje. Documento de
antes do Estoque cancela sem inventar movimento.**

🔴 **D-33:** a partir deste plano, `lancarVenda`, `lancarDespesa` (compra) e `cancelarDocumento`
dependem da tabela `movimentacoes_estoque`. Se este código chegar à produção antes da `0023`, toda
venda, toda compra de material e todo cancelamento quebram. O código está só no branch
`gsd/phase-06-estoque`: nada foi publicado, `main` continua em `a8c7bad` e nenhuma migração foi
aplicada fora dos Postgres efêmeros.

## O que foi entregue

### Tarefa 1 — a venda baixa e a compra dá entrada (`bd9d27d` RED, `d8c043f` GREEN)

- **`pedidosDaVenda(linhas, itens, areaPorCategoria)`** (puro): chama
  `efeitoNoEstoque([linha], itens, "venda")` para cada linha e cria um pedido de saída por entrada
  do efeito. A área é a da categoria de venda da linha (D-27) e cada pedido leva o
  `documentoLinhaId` da sua linha. Linha livre e item sem ficha nem estoque próprio não geram
  pedido. Saldo não é consultado (D-06).
- **`pedidosDaCompra(linhas, itens)`** (puro): uma entrada por linha. Valor maior que zero vira
  `entrada_com_preco` com `pagoCentavos` igual ao valor da linha. Valor 0 vira `entrada_sem_preco`.
  Nos dois casos `valorInformadoCentavos` é o valor da linha, e o custo unitário nunca é gravado
  arredondado (D-19).
- **`carregarItensParaEfeito(tx, ids)`** lê com a `tx` a ficha dos itens vendidos, depois esses itens
  e os insumos das fichas, **sem filtrar `ativo`**. **`areasDasCategorias(tx, ids)`** devolve um
  `Map<id, área>`.
- **`lancarVenda`:**
  - lê `ativo` e recusa item desativado com a frase de sempre;
  - `insert(documentoLinhas)…returning({ id: documentoLinhas.id, ordem: documentoLinhas.ordem })`;
  - depois da inserção das linhas chama `carregarItensParaEfeito`, `areasDasCategorias`,
    `pedidosDaVenda` (+ `documentoId`) e `gravarMovimentacoes`, na mesma transação;
  - no sucesso, revalida `/gestao/estoque` e `/gestao`;
  - o comentário cita D-03, D-06 e D-33.
- **`lancarDespesa` (só no modo compra):** o mesmo caminho, com `pedidosDaCompra`. O modo "outra"
  não mudou.
- **`listarCatalogoDaVenda`/`listarCatalogoDaCompra`** passaram a filtrar `ativo = true`.
  `listarItensParaEfeito` não mudou.
- **Testes:**
  - `tests/unit/estoque-pedidos.test.ts`: 14 `it`s para Venda e Compra (os comportamentos do plano,
    mais a ordem das linhas, 0,001 kg e o erro de categoria sem área);
  - novo `describe("efeitoNoEstoque — por linha = documento inteiro")` com três documentos,
    incluindo o mesmo insumo em duas linhas e uma compra com o mesmo material repetido.

### Tarefa 2 — cancelar estorna o gravado (`bd71874` RED, `19a3053` GREEN)

- **`pedidosDoEstorno(originais)`** (puro): cria um espelho por original. `movimentoDoEstorno`
  decide o movimento (D-23/D-24). O tipo é o oposto, a origem é a mesma e
  `estornoDeId = original.id`; documento, linha e área são copiados. Estorno que é entrada leva
  `valorInformadoCentavos = |valor|`.
- **`originaisSemEstorno(tx, documentoId)`** busca as movimentações do documento com
  `estorno_de_id` nulo e `not exists` estorno apontando para elas, em ordem de `numero`.
- **`cancelarDocumento`:** o estorno roda depois do `select … for update` do documento e da checagem
  de "já cancelado", e antes do `update` de `canceladoEm`. Revalida também Estoque e Início. O
  comentário cita D-04, D-05, D-23/D-24, Pitfall 4 e D-33.
- **`definirAtalhoDoItem`** recusa item desativado com "Esse item está desativado — reative em
  Cadastros → Catálogo para marcar atalho.".
- **`semearVendaSemMovimentacao`** cria documento de venda, linha de item e parcela paga, sem livro.

## O que o e2e `estoque financeiro` prova (desktop e celular)

| Caso | Prova |
|---|---|
| (a) | 2 canecas com ficha de 0,08 kg geram UMA saída de −160, origem `venda`, área `pecas`, com documento e linha. O valor é 0 porque não havia entrada (D-26). O cartão mostra −0,16: o negativo não bloqueou (EST-14 + EST-18). |
| (b) | Caneca (Peças prontas) e xícara (Bebidas e comidas) com o mesmo insumo geram duas saídas, `pecas` −80 e `cafeteria` −50, no mesmo documento e em linhas diferentes. |
| (c) | Compra de 25 kg por R$ 125,00 pela tela grava +25000 / 12500, com `valor_informado` 12500. O cartão mostra 25. |
| (d) | Uma venda leva o saldo a −1 kg. Depois, compra de 25 kg por R$ 125,00: `valor_informado` 12500 e `valor_centavos` 12000 (R3). |
| (e) | Venda só de valor livre: zero movimentações para o material semeado. |
| (f) | Compra de 25 kg, venda de 0,16 kg (−80) e cancelamento pelo Caixa. O saldo volta a 25000. O livro tem compra, saída e estorno (+160 / +80, `estorno_de_id` = saída, mesmo documento, mesma linha e mesma área — D-23). |
| (g) | Compra de 10 un por R$ 30,00, venda de 4 (−1200) e cancelamento da compra. O estorno sai −10000 / −3000 ao custo médio corrente (D-24). O final é −4000 / −1200, sem o valor trocar de sinal em relação à quantidade. |
| (h) | Venda de antes do Estoque, semeada direto no banco: cancela pela tela, aparece "cancelada" e continua sem nenhuma movimentação (EST-17/D-05). |

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/estoque-pedidos.test.ts tests/unit/financeiro-efeito-estoque.test.ts` (RED, T1) | 13 falharam por falta de módulo; os 3 de linearidade passaram. Isso era esperado: eles provam uma propriedade do `efeitoNoEstoque` que já existia. |
| o mesmo (GREEN, T1) | 36 passaram |
| `npx vitest run tests/unit/estoque-pedidos.test.ts` (RED, T2) | 4 falharam, 14 passaram |
| o mesmo (GREEN, T2) | 18 passaram |
| `npm run verificar` (T1) | **exit 0**. Lint limpo, `tsc` limpo, `verificar-acoes: 75 ação(ões) conferida(s), 0 violações` (as duas linhas "1 violação" são os fixtures do próprio verificador), `Test Files 89 passed`, `Tests 1379 passed`, `test:migracoes`: "Todas as afirmações passaram." |
| `npm run test:e2e -- --grep "estoque financeiro\|financeiro venda\|financeiro despesa"` | **invocação 1 de 2**: `108 passed (1.2m)`, com os casos (a)–(e) nos dois projetos. Todos os e2e existentes da Venda e da Despesa passaram. |
| `npm run verificar` (T2) | **exit 0**. Mesmos números, com `Tests 1383 passed`. |
| `npm run test:e2e -- --grep "estoque financeiro\|financeiro caixa"` | **invocação 2 de 2**: `82 passed (1.3m)`, com os casos (a)–(h) nos dois projetos. Todo o `financeiro caixa` passou. |

Nenhum `npm run build` separado e nenhuma varredura sem `--grep`, porque essa fica para o último
plano da fase.

O log do webserver mostra algumas linhas `⨯ Error: The destination stream closed early.`. É o
streaming do Next interrompido quando o teste navega. Nenhum teste falhou por isso, e nenhuma
dessas linhas vem de "Falha ao lançar/cancelar".

**Greps de aceite:**
- `gravarMovimentacoes` em `acoes.ts` → 4;
- `returning({ id: documentoLinhas.id` → 2;
- `itensCatalogo.ativo` → 3 em `acoes.ts` e 2 em `consultas.ts`;
- imports proibidos em `pedidos.ts` → nada;
- `efeitoNoEstoque(` fora de comentário em `acoes.ts`/`gravacao.ts` → nada, e em `pedidos.ts` → 2;
- `efeitoNoEstoque(` dentro de `cancelarDocumento` → 0;
- `grep -rln movimentoDoEstorno lib` → só `custo.ts` e `pedidos.ts`;
- `pedidosDoEstorno` e `originaisSemEstorno` em `acoes.ts` → **2 cada**, e não 1 como o plano
  escreveu. A contagem inclui a linha do `import`: cada função é chamada uma vez, dentro de
  `cancelarDocumento`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `movimentacoesDoItem` não devolvia os vínculos que os casos (a)–(h) conferem**
- **Found during:** Tarefa 1, ao escrever o e2e
- **Issue:** o auxiliar do 06-01 não devolvia `id`, `documento_id`, `documento_linha_id` nem
  `estorno_de_id`, mas o plano pede para conferir "documento_linha_id preenchido" e "estorno_de_id =
  id da saída".
- **Fix:** os quatro campos foram acrescentados ao tipo e ao `select`. Os campos antigos não mudaram,
  e o `toMatchObject` do traçador continua valendo.
- **Files modified:** `tests/e2e/apoio/semear-estoque.ts` (fora da lista `files_modified` do plano) ·
  **Commit:** `d8c043f`

**2. [Aceite] Comentário ajustado para o grep de `movimentoDoEstorno`**
- O comentário de `cancelarDocumento` citava `movimentoDoEstorno`, e isso punha `acoes.ts` no
  `grep -rln`. Passou a dizer "decidido em `lib/estoque/custo.ts` (D-23/D-24)". A mudança é só de
  comentário e foi feita antes do commit.

### Escolhas dentro do plano (registradas)

- Os cenários do (f) e do (g) usam uma compra pela tela antes da venda. Assim a saída e o estorno
  têm valor diferente de zero, e D-23/D-24 são conferidas com números, em vez de todas as linhas
  valerem 0.
- (g): com um preço só, a D-24 (custo corrente) e o custo original dão o mesmo número nesse cenário.
  O e2e prova o caminho de ponta a ponta e a coerência de sinal. O caso que distingue as duas regras
  continua na bateria unitária do 06-02.

## Known Stubs

Nenhum.

## Threat surface

Nenhuma superfície fora do `<threat_model>`:
- **T-06-10 e T-06-12:** o efeito é calculado no servidor, e o estorno é derivado do livro. O aceite
  prova que não há `efeitoNoEstoque(` em `cancelarDocumento`.
- **T-06-11:** o estorno nasce só depois da trava do documento, e o índice único continua no banco.
- **T-06-14:** não há checagem de saldo. O e2e (a) lança com o insumo indo a negativo.
- **T-06-15:** o `ativo` é lido do banco na venda, na compra e no atalho.
- **T-06-16:** tudo fica no branch.
- **T-06-17:** a falha da gravação cai no `catch` existente, que mostra `FRASE_FALHA_AO_SALVAR`; o
  erro vai só para o log.

Nenhuma Server Action nova: `verificar-acoes` continua com 75.

## Self-Check: PASSED

- Os arquivos existem: `lib/estoque/pedidos.ts`, `lib/estoque/gravacao.ts`, `lib/financeiro/acoes.ts`,
  `lib/financeiro/consultas.ts`, `tests/unit/estoque-pedidos.test.ts`,
  `tests/e2e/estoque-financeiro.spec.ts` e `tests/e2e/apoio/semear-documento-antigo.ts`.
- Os commits `bd9d27d`, `d8c043f`, `bd71874` e `19a3053` estão no branch `gsd/phase-06-estoque`.
  `main` continua em `a8c7bad`.
- `STATE.md` e `ROADMAP.md` não foram modificados por este plano (são do orquestrador).
