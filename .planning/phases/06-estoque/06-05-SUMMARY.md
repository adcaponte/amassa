---
phase: 06-estoque
plan: 05
subsystem: estoque
status: complete
tags: [estoque, ajuste, saldo-contado, vinculos, peca-pronta, previa, EST-07, EST-08, EST-11, EST-21]
requires:
  - "06-01: gravarMovimentacoes/travarItens/lerEstados (a porta única), pedidos manuais, esquemaRegistrarMovimentacao, registrarMovimentacao"
  - "06-02: a prova com duas conexões de que ajuste × venda sob `for no key update` termina no contado"
  - "06-04: saldo.ts (situacaoDoSaldo, a regra única do alerta) e listarSaldos"
provides:
  - "converterQuantidade(texto, { aceitaZero: true }) — variante explícita que aceita zero"
  - "lib/estoque/saldo.ts — planejarAjuste, PlanoDeAjuste, previaDaMovimentacao, PreviaDaMovimentacao, EntradaDaPrevia, ParteDaPrevia, TomDaPrevia, atalhosDaUnidade, custoPreenchidoDaPecaPronta"
  - "lib/estoque/esquemas.ts — ramo `ajuste` (contadoTexto aceita zero, motivoTexto) e vínculos da saída (turmaTexto, encomendaId, oQueAconteceuTexto); contadoParaMilesimos"
  - "lib/estoque/pedidos.ts — pedidoDeAjuste; pedidoDeEntradaManual({ pecaPronta }); pedidoDeSaidaManual({ nota, encomendaId })"
  - "lib/estoque/gravacao.ts — gravarAjuste, ResultadoDoAjuste, itemTemFichaDePrecificacao, encomendaEmAndamento"
  - "lib/estoque/consultas.ts — listarEncomendasParaVinculo, EncomendaParaVinculo, custosDasPecasProntas, listarSaldosDaRequisicao"
  - "registrarMovimentacao com o ramo ajuste; MovimentacaoRegistrada ganhou tipo `ajuste`, `gravou` e `conferido`"
  - "lib/estoque/textos.ts — as frases da folha completa (prévia, ajuste, vínculos, Conferido, cafeteria, nota da compra UI-D14, peça pronta, toast do ajuste, rótulos por tipo)"
affects: [06-06, 06-08, 06-10]
tech-stack:
  added: []
  patterns:
    - "uma regra, duas leituras: a prévia do rodapé e o servidor chamam as mesmas funções puras; o servidor as aplica ao saldo lido sob a trava"
    - "prévia devolvida em partes { texto, forte } — a tela põe o negrito sem remontar a frase"
    - "texto livre normalizado em NFC e contado em pontos de código ([...texto]), espelhando o check `length(trim(nota))` do banco"
key-files:
  created: []
  modified:
    - lib/financeiro/dinheiro.ts
    - lib/estoque/saldo.ts
    - lib/estoque/esquemas.ts
    - lib/estoque/pedidos.ts
    - lib/estoque/gravacao.ts
    - lib/estoque/consultas.ts
    - lib/estoque/acoes.ts
    - lib/estoque/textos.ts
    - tests/unit/financeiro-dinheiro.test.ts
    - tests/unit/estoque-saldo.test.ts
    - tests/unit/estoque-esquemas.test.ts
    - tests/unit/estoque-pedidos.test.ts
decisions:
  - "Custo zero é recusado SÓ na entrada de peça pronta (EST-21), decidido no servidor pela ficha ligada, com a frase de custo obrigatório da UI-SPEC. A entrada manual comum continua aceitando R$ 0,00 (doação/amostra, decisão registrada no 06-01)."
  - "custosDasPecasProntas deixa fora do mapa a ficha cujo custo calculado é zero: o campo vem vazio e obrigatório, em vez de preenchido com um zero que o servidor recusaria."
  - "A encomenda do vínculo é lida com `for key share` depois da trava do item: ninguém a apaga entre a conferência e o insert, e não cria ciclo (excluirEncomenda não trava item)."
  - "O rótulo congelado em `nota` é o `nome` da encomenda, o título que o cartão do índice mostra."
  - "saldo.ts passou a importar formatarQuantidade/formatarReais (lib/financeiro/formato.ts) e ROTULO_UNIDADE (lib/cadastros/catalogo.ts), ambos puros, para montar a prévia; o grep de imports proibidos continua limpo."
  - "O ajuste conferido (diferença zero) não chama revalidatePath: nada foi gravado."
metrics:
  duration: "~9 min (05:46 → 05:55 UTC, 29/09/2026)"
  completed: 2026-09-29
estimate:
  tokens: 50000
  tasks: 1
actuals:
  tokens: 14400
  tasks: 1
  commits: 2
---

# Phase 06 Plan 05: A folha completa no servidor Summary

**O ajuste pelo que tem na prateleira: o cliente manda o contado, e o servidor trava o item, lê o
saldo do instante, calcula a diferença em milésimos inteiros e, se ela der zero, não grava nada e
responde `conferido`. As saídas guardam para qual turma, encomenda ou quebra o material foi. A
encomenda é conferida na transação e o nome dela fica congelado. A peça pronta é reconhecida pela
ficha de precificação e tem o custo preenchido por `calcularPeca`. A prévia "o saldo passa de X para
Y" vem das mesmas funções puras que o servidor usa.**

## O que foi entregue

### Tarefa 1 (`d619243` RED, `303229a` GREEN)

**`lib/financeiro/dinheiro.ts`**
- `converterQuantidade(texto, { aceitaZero: true })` aceita "0" e "0,000" e devolve "0".
- Sem a opção, nada mudou. Nenhum outro chamador foi mexido. O arquivo de teste só ganhou linhas:
  `git diff 060f1df -- tests/unit/financeiro-dinheiro.test.ts` tem 0 linhas removidas.

**`lib/estoque/saldo.ts`** (puro)
- `planejarAjuste` devolve `{ tipo: "nada" }` ou `{ tipo: "ajuste", diferencaMilesimos }`, e recusa
  contado negativo com `RangeError`.
- `previaDaMovimentacao` usa as frases literais da tabela "Pré-visualização" da UI-SPEC e devolve o
  tom (`neutra`, `acento`, `atencao` ou `erro`) e as partes, com os números em `forte`.
  - O valor da saída vem de `valorarMovimento`.
  - O aviso de mínimo e o de negativo vêm de `situacaoDoSaldo`, a regra única do alerta.
  - Não lê o relógio.
- `atalhosDaUnidade`: `un` e `L` e `m` → 1 2 5 10; `g` e `ml` → 50 100 250 500; `kg` → 1 5 10 25.
- `custoPreenchidoDaPecaPronta` arredonda meio-para-cima em `BigInt(...)`. O produto intermediário
  pode passar de 2^53, e literais `0n` não compilam no alvo ES2017.

**`lib/estoque/esquemas.ts`**
- Novo ramo `ajuste`. `contadoTexto` passa por `contadoParaMilesimos`:
  - vazio → "Diga quanto tem na prateleira — pode ser zero.";
  - negativo ou com 4 casas → a frase da quantidade.
- Saída com `turmaTexto`, `encomendaId` e `oQueAconteceuTexto`:
  - o texto passa por NFC e trim e é contado em pontos de código, de 0 a 160; vazio vira nulo;
  - `encomendaId` vazio ("Nenhuma") vira nulo;
  - vínculo de outro destino é zerado por um `transform` sobre a união.

**`lib/estoque/pedidos.ts`**
- `pedidoDeAjuste`: diferença negativa vira `saida`, positiva vira `entrada_sem_preco`. Grava
  `saldoContadoMilesimos` e nunca leva valor informado, destino, área ou encomenda. Diferença zero
  lança erro.
- `pedidoDeEntradaManual({ pecaPronta })` grava `motivo: "peca_pronta"`.
- `pedidoDeSaidaManual({ nota, encomendaId })`: a encomenda só é gravada no destino encomenda.

**`lib/estoque/gravacao.ts`**
- `gravarAjuste` segue esta ordem:
  1. `travarItens`;
  2. `lerEstados`, depois da trava;
  3. `planejarAjuste`;
  4. se deu "nada", devolve `{ gravou: false, saldoMilesimos }` sem inserir;
  5. senão, `pedidoDeAjuste` e `gravarMovimentacoes` na mesma `tx`.

  O comentário cita D-18 ("contra o saldo do instante da gravação").
- `itemTemFichaDePrecificacao(tx, itemId)` diz se o item é peça pronta.
- `encomendaEmAndamento(tx, id)` confere rascunho ou em produção, com `for key share`, e devolve o
  nome.

**`lib/estoque/consultas.ts`**
- `listarEncomendasParaVinculo()` usa o critério e a ordem de `listarEncomendasAtivas`. O rótulo é o
  `nome` da encomenda.
- `custosDasPecasProntas(itemIds, hoje)` lê só as fichas não exclusivas. Chama
  `parametrosVigentes(hoje)` uma vez e, para cada ficha, `quantasCabem` e
  `calcularPeca({ canal: "direto" }).custoCentavos`. Parâmetro ausente, peça que não cabe ou custo
  zero deixam o item fora do mapa.
- `listarSaldosDaRequisicao = cache(listarSaldos)`.

**`lib/estoque/acoes.ts` · `registrarMovimentacao`**
- `exigirUsuario()` continua a primeira instrução.
- **Ajuste:** chama `gravarAjuste`. Se nada foi gravado, devolve
  `{ ok: true, dados: { conferido: true, gravou: false, … } }`.
- **Saída com encomenda:** confere na transação que a encomenda existe e está em andamento. Se não,
  responde "Essa encomenda não está mais em andamento — escolha outra ou deixe em branco.". Se sim,
  congela o nome em `nota`.
- **Entrada:** decide `pecaPronta` pela ficha, dentro da transação.
- Nenhum documento, parcela ou linha do Financeiro é criado. O comentário T-06-26 fica no topo da
  ação.

**`lib/estoque/textos.ts`**
- a prévia, o contado, o motivo, os três vínculos, "Nenhuma" e a dica da cafeteria;
- a nota da compra (UI-D14) com "Ir para Compra de material" e a dica da peça pronta;
- "Conferido. O saldo já estava correto.", o toast do ajuste e `rotuloDoBotaoDeGravar`;
- "Trocar material", o rótulo do atalho e as frases de erro dos vínculos.

## Verificação: comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run` nos 4 arquivos do plano, antes do código | **RED**: 50 falharam e 113 passaram. As falhas eram funções inexistentes e o `aceitaZero` ignorado. |
| o mesmo, depois do código (1ª) | 6 falharam, todas em `estoque-saldo`. O `Intl` põe um espaço não separável depois de "R$", e o auxiliar do teste passou a trocá-lo por espaço comum. |
| o mesmo (2ª) | 1 falhou: um erro no próprio teste, que usava o acento agudo combinante onde "Conferência" tem circunflexo. |
| o mesmo (final) | **163 passaram** |
| `npx tsc --noEmit` | 2 erros em testes antigos de `estoque-esquemas`: `data.quantidadeTexto` sem estreitar o tipo, que agora tem o ramo ajuste. Estreitados com `tipo === "saida"`; depois, **limpo**. |
| `npx eslint lib/estoque lib/financeiro/dinheiro.ts` e os testes tocados | limpo |
| `npm run verificar-acoes` | `75 ação(ões) conferida(s), 0 violações` |
| `npm run verificar` | **exit 0**. lint e `tsc` limpos; `verificar-acoes` com 75 ações e 0 violações; `Test Files 90 passed (90)`, `Tests 1498 passed (1498)`; `test:migracoes`: "Todas as afirmações passaram." |
| `npm run test:e2e` | **não rodado**. O plano não pede e2e; o e2e da folha é do 06-06. |

**Greps de aceite:**
- "Conferido. O saldo já estava correto." em `textos.ts` → 1;
- `gravarAjuste` em `acoes.ts` → 3 (import, chamada e comentário) e `planejarAjuste` em
  `gravacao.ts` → 3;
- `insert(documentos|parcelas|documentoLinhas)` em `acoes.ts` e `gravacao.ts` → nada;
- imports proibidos em `saldo.ts` e `pedidos.ts` → nada.

**Branch:**
- o trabalho ficou em `gsd/phase-06-estoque` do começo ao fim;
- `main` continua em `a8c7bad`;
- nada foi publicado;
- nenhuma migração foi aplicada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Testes antigos de `estoque-esquemas` não compilavam com o ramo `ajuste`**
- **Found during:** Tarefa 1, `tsc --noEmit`
- **Issue:** dois `it` do 06-02 liam `resultado.data.quantidadeTexto` sem estreitar o tipo. Com o
  terceiro ramo da união, o campo não existe em todos os tipos.
- **Fix:** acrescentei `&& resultado.data.tipo === "saida"` na condição. As asserções não mudaram.
- **Files modified:** `tests/unit/estoque-esquemas.test.ts` · **Commit:** `303229a`

### Interpretações registradas

- **"custo 0 é recusado na entrada" (EST-21 · boundary)** foi lido como regra da peça pronta, que é
  onde a aresta está. O 06-01 decidiu e registrou que a entrada manual comum aceita R$ 0,00, para
  doação ou amostra. A recusa fica no servidor, porque só ele sabe se o item tem ficha, e usa a
  frase de custo obrigatório da UI-SPEC, sem copy nova. Se o dono quiser recusar zero em toda
  entrada manual, a mudança é uma linha em `pedidoDaFolha`.
- **Frases sem texto na UI-SPEC:** a UI-SPEC não diz o que mostrar para vínculo longo nem para
  vínculo que não é texto. Criei "Esse texto cabe em até 160 letras — resuma um pouco.", no molde
  de "As observações cabem em até 500 letras.". Criei também "Não deu para entender esse texto.
  Escreva de novo.", que só aparece com pedido forjado.
- **`previaDaMovimentacao` recebe os campos soltos do `SaldoDoItem`** (`saldoMilesimos`,
  `valorCentavos`, `ultimaEntradaComPreco`, mínimo, unidade) em vez de um objeto "estado". Assim a
  folha do 06-06 pode espalhar o saldo que já tem.

## Known Stubs

Nenhum. Um limite fica declarado para o 06-06: a folha de hoje ainda não desenha o segmento Ajuste,
os vínculos, os atalhos, a prévia nem o custo da peça pronta. As regras e o servidor estão prontos;
a tela é do 06-06. Hoje a folha manda só entrada e saída, sem vínculo, e o esquema aceita isso: os
vínculos são opcionais.

## Threat surface

Nenhuma superfície fora do `<threat_model>`:
- **T-06-22:** a diferença é calculada em `gravarAjuste`, sobre o saldo lido sob a trava.
- **T-06-23:** `pecaPronta` sai de `itemTemFichaDePrecificacao(tx)`, e a área sai de `areaDoDestino`.
- **T-06-24:** `encomendaEmAndamento` roda com `for key share`, e a chave estrangeira continua
  valendo.
- **T-06-25:** o Zod limita o texto a 160 pontos de código, e o `check` de `nota` faz o mesmo no
  banco.
- **T-06-26:** a ação não cria documento, e o grep confirma.
- **T-06-27:** `exigirUsuario()` continua a primeira instrução, e `verificar-acoes` passa.

Nenhuma Server Action nova: `verificar-acoes` continua com 75.
