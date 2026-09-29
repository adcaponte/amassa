# Phase 6: Estoque - Discussion Log

**Date:** 2026-09-29
**Phase:** 06-estoque
**Areas discussed:** Filtro (frentes → áreas), Área dos destinos, Contagem (primeira abertura e inventário), Conversão de unidade, Desativar em vez de apagar, Aviso de saldo negativo, Custo da Peça pronta

> **Modo `--auto`, sem o dono presente.** Discussão feita na noite de 29/09/2026 sob autorização dele
> em chat ("roda o maximo que puder em opçoes recomendadas"). Em cada ponto o orquestrador escolheu a
> opção recomendada, sem perguntar. **Nenhuma linha "User's choice" abaixo é resposta do dono** — são
> todas escolhas automáticas, marcadas `[auto]`, para ele auditar e desfazer se quiser. As decisões
> travadas pelo `ADENDO.md` de 20/09 não foram rediscutidas; estão no CONTEXT como D-01..D-12 e D-15.

---

## Filtro da lista de saldos (ADENDO §7.1)

| Option | Description | Selected |
|--------|-------------|----------|
| Só a área do Financeiro | O filtro é a área (Cafeteria · Espaço · Peças · Loja · Geral), mais a busca | ✓ |
| Área + alternador "insumos / vendáveis" | Um segundo filtro ao lado, derivado de `aparece_na_venda` | |

**User's choice:** `[auto]` Só a área do Financeiro (D-13).
**Notes:** A área já separa na prática — o "Ateliê" do protótipo são os itens de Peças e Espaço que não
aparecem na venda. Um terceiro controle na tela do celular custa toque contra a baixa em 4 toques e os
15 s do EST-09. Acrescentar depois é barato (derivável de `aparece_na_venda`). Vai para Deferred Ideas.

---

## Área de cada destino manual

| Option | Description | Selected |
|--------|-------------|----------|
| Uso do ateliê e perda → Peças | Os dois que iam para "Ateliê produtivo" no protótipo vão para Peças, a área que o adendo diz corresponder a "Ateliê" | ✓ |
| Perda → área do próprio item | Uma xícara da cafeteria quebrada iria para Cafeteria | |

**User's choice:** `[auto]` Uso do ateliê e perda → Peças (D-14).
**Notes:** O protótipo já usava nome de área do Financeiro em três destinos (aula → Espaço, encomenda →
Peças, cafeteria → Cafeteria). O adendo diz que cada destino "continua carregando a área que consome,
agora com os nomes do Financeiro". A alternativa é mais precisa em alguns casos, mas contraria o
protótipo, que cobra toda perda do ateliê produtivo. Trocar é mudar um mapeamento.

---

## Contagem: primeira abertura e inventário (ADENDO §7.3)

| Option | Description | Selected |
|--------|-------------|----------|
| Tela de contagem geral + ajuste item a item | Uma tela que conta muitos itens de uma vez, servindo à primeira abertura e ao inventário; o ajuste do protótipo continua | ✓ |
| Só o ajuste item a item do protótipo | A contagem inicial e o inventário feitos pela folha de ajuste, um item de cada vez | |

**User's choice:** `[auto]` Tela de contagem geral + ajuste item a item (D-16).
**Notes:** O §3 do adendo exige que a primeira abertura conduza a contagem inicial de todos os itens —
por natureza, contagem de muitos itens de uma vez. O protótipo não desenha esse fluxo (o único
"primeira" nele é um estado vazio de categoria). Uma tela resolve as duas necessidades.

**Sub-decisões `[auto]`:**
- Primeira abertura em modo "saldo inicial": quantidade + "quanto custou ao todo" viram entrada manual
  com custo; item em branco não é tocado (D-17).
- Depois, modo inventário: cada item contado com diferença vira um ajuste (EST-07/08); cada item grava
  ao ser confirmado, sem rascunho (D-18). Descartado: rascunho aplicado de uma vez no fim — exigiria
  tabela de rascunho e ficaria errado se houvesse venda no meio da contagem.

---

## Conversão de unidade na compra (ADENDO §7.2)

| Option | Description | Selected |
|--------|-------------|----------|
| Digitar a quantidade já convertida | Comprou um saco de 25 kg → digita 25 kg. Usa `documento_linhas.quantidade_estoque`, que já existe | ✓ |
| Cadastrar embalagem por item | Saco = 25 kg, caixa = 12 un, com conversão automática | |

**User's choice:** `[auto]` Digitar a quantidade já convertida (D-19).
**Notes:** É a proposta do próprio adendo, e não exige estrutura nova — o campo onde se digita isso já
existe no formulário de compra da 04.4. A embalagem vai para Deferred Ideas.

---

## Desativar em vez de apagar

| Option | Description | Selected |
|--------|-------------|----------|
| Coluna `ativo` no padrão de `categorias.ativa` | Desativado some de Venda, Compra e da lista padrão; fica no histórico; reativável; filtro Ativos · Desativados · Todos como nas Queimas | ✓ |
| Outro mecanismo | Tabela à parte, marca de exclusão lógica, etc. | |

**User's choice:** `[auto]` Coluna `ativo`, padrão de `categorias.ativa` (D-20).
**Notes:** O adendo §5 já manda desativar em vez de apagar; a escolha é só o como. Hoje o catálogo só
tem criar e editar. O projeto já usa `ativa` + `definir…Ativa` em categorias e contas fixas, e o filtro
de três estados nas Queimas — seguir o precedente é a opção de menor surpresa.

---

## Aviso de saldo negativo

| Option | Description | Selected |
|--------|-------------|----------|
| Nos três lugares, sem bloquear | Pré-visualização da venda ("fica com −X"), lista de saldos e bloco do Início | ✓ |
| Só na lista de saldos | O aviso aparece só no Estoque | |

**User's choice:** `[auto]` Nos três lugares, sem bloquear (D-21).
**Notes:** O painel de Venda já mostra "O que esta venda tira do estoque" — é o lugar natural do aviso
na hora em que a venda acontece. Nunca bloqueia (adendo §3).

---

## Custo da Peça pronta

| Option | Description | Selected |
|--------|-------------|----------|
| Preencher com o custo da ficha de precificação, editável | Via `fichas_precificacao.item_catalogo_id`; sem ficha, campo vazio e obrigatório | ✓ |
| Sempre digitar o custo | Sem preenchimento | |

**User's choice:** `[auto]` Preencher, editável (D-22).
**Notes:** O adendo §4 diz "informando o custo — o da ficha de precificação, quando houver".

---

## Claude's Discretion

- Onde moram `minimo`, `observacoes` e `ativo` (colunas em `itens_catalogo` — recomendado — ou 1:1).
- Desenho da tabela de movimentações, índices, saldo derivado por consulta ou view.
- Referência do estorno à movimentação original e ao documento.
- Custo médio ponderado, inclusive entrada com saldo negativo.

## Deferred Ideas

- Cadastro de embalagem com conversão automática.
- Filtro "só insumos / só o que se vende".
- Vínculo da saída com uma fornada (saiu do EST-11 em 29/09; pode voltar com o redesenho das Queimas).
- Entrada automática de Peça pronta pela Produção.
- Aula como referência real, quando a Agenda existir.
- Consignação (fora de escopo pelo adendo §4).
