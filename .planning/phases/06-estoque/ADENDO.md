# Estoque (Fase 6) — adendo de 20/09/2026 ao briefing de 18/09

> O protótipo aprovado em 18/09 (`.planning/phases/06-estoque/prototipo.html`) e o briefing
> (`claude/briefing-modulo-estoque.md`, no projeto "Amassa" do Claude) **continuam valendo para
> telas e fluxo**. Este adendo registra o que mudou com a revisão de 19/09 e com o que a Fase 04.4
> (Financeiro parte 1) já construiu. **Onde este adendo contradiz o briefing de 18/09, o adendo
> vence.** Revisto com o Theo em 20/09, que reviu o protótipo e mandou seguir.

## 1. A mudança que organiza todas as outras

Em 18/09 o Estoque viria **antes** do Financeiro e teria cadastro próprio de materiais. A ordem
inverteu: o Financeiro entrou primeiro e **já criou o cadastro único de itens**. Logo:

🔴 **Não existe tabela `materiais`.** O Estoque se apoia em `itens_catalogo` (04.4), que já tem
`controla_estoque`, `unidade`, `categoria_compra_id`, `atalho_compra`, e em `ficha_tecnica` (04.4).
O Estoque **acrescenta** ao item o que é dele: **mínimo** e **observações**. Saldo e custo médio
continuam **derivados** das movimentações, nunca gravados como campo editável.

"Novo material" no Estoque cria um item do catálogo com `controla_estoque = true` (mesma validação
do Cadastros). Item criado pelo Cadastros com `controla_estoque` aparece no Estoque sozinho.

## 2. Frentes do protótipo × áreas do Financeiro

O protótipo filtra por três frentes (Ateliê · Loja · Cafeteria). O Financeiro tem cinco áreas
(Cafeteria · Espaço · Peças · Loja · Geral), e o item herda a área pela **categoria**. Não criar uma
segunda classificação: **o filtro do Estoque passa a ser a área do item**, vinda da
`categoria_compra` (e, na falta, da `categoria_venda`). Na prática o que o protótipo chama de
"Ateliê" são os itens de **Peças** e **Espaço** que não aparecem na venda (argila, esmalte,
ferramenta de consumo). As categorias do próprio protótipo do Estoque (Cerâmica, Pintura,
Papelaria…) **caem**: a categoria do item é a do Financeiro, que já é editável em Cadastros.

## 3. De onde vem cada movimentação

`origem` deixa de ser `manual | financeiro` e passa a ser:

| Origem | Quem cria | Quando |
|---|---|---|
| `venda` | Financeiro | ao lançar a venda — item com estoque baixa ele mesmo; item com ficha técnica baixa cada insumo |
| `compra` | Financeiro | Despesa → Compra de material: entra `quantidade_estoque`, custo = valor da linha ÷ quantidade |
| `producao` | Produção (fase futura) | concluir ordem da casa → entrada de peça pronta, ao custo da precificação |
| `manual` | Estoque | saldo inicial, consumo (aula, encomenda, cafeteria, uso do ateliê), perda, ajuste |

- 🔴 O contrato já existe: `lib/financeiro/efeito-estoque.ts` calcula exatamente o que cada venda e
  cada compra fazem no estoque, e a 04.4 só **mostra** esse resultado. **A Fase 6 troca "mostrar"
  por "gravar", na mesma transação do documento** — sem recalcular por outro caminho.
- **Cancelar** venda ou compra gera **movimentação de estorno** com a mesma referência (nunca apaga).
- **Vendas e compras lançadas antes de o Estoque existir não geram movimentação retroativa.** O
  Estoque começa por **contagem**: saldo inicial por item, como entrada manual com custo. A tela de
  primeira abertura deve conduzir isso.
- O destino **"Venda na loja" sai da lista de saídas manuais** (e some o aviso provisório do
  protótipo): venda só nasce no Financeiro. Os destinos manuais ficam: consumo em aula · consumo em
  encomenda · consumo na cafeteria · uso do ateliê · perda ou quebra. Cada destino continua
  carregando a área que consome — agora com os nomes do Financeiro.
- **"Consumo na cafeteria"** vira exceção: o que se vende com ficha técnica já baixa pela venda.
  O destino manual cobre só o que não passa por venda (degustação, consumo interno).
- Vínculo de "consumo em encomenda": referência real à encomenda (opcional), não texto livre.
  Aula continua texto livre até a Agenda existir.
- **Saldo negativo é permitido com aviso e nunca bloqueia uma venda** (fecha o item 3 do "em
  aberto" do briefing de 18/09).

## 4. O que é novo em relação ao protótipo

- **Ficha técnica visível no Estoque**: no item-insumo, "gasto por: Café 200 ml (15 g), Café refil
  (30 g)…". Editar a ficha continua em Cadastros → Catálogo.
- **Categoria "Peça pronta"** (área Peças): itens vendáveis com estoque; entrada pela Produção. Até
  a Produção ser redesenhada, a entrada é manual, informando o custo (o da ficha de precificação,
  quando houver — o custo da peça vem da precificação e a Loja aplica a margem).
- **Custo médio no instante do lançamento**: cada saída grava o custo médio daquele momento (fecha o
  item 4 do "em aberto" de 18/09). Dinheiro em **centavos inteiros** e quantidade em **milésimos
  inteiros** no cálculo, como a 04.4 já faz.
- **Bloco "Estoque acabando" do Início** (fase do `/gestao`) passa a ser alimentado por
  `lib/estoque/consultas`.
- **Peça de terceiros em consignação**: fora desta fase. Entra como item comum se o ateliê comprou;
  consignação de verdade (repasse ao dono da peça) fica para quando o caso aparecer.

## 5. O que continua exatamente como no briefing de 18/09

Três abas (Saldos · Histórico · Para onde foi) · banner de alerta · sanfona e busca ao registrar ·
folha única com o rodapé "o saldo passa de X para Y" · **movimentação nunca é editada nem apagada**
· **ajuste pergunta o saldo contado**, diferença zero não grava · mínimo zero nunca alerta · baixa em
4 toques · custo entra pela entrada ("quanto custou ao todo") · remover item com movimentação pede
confirmação dizendo o que se perde (e, sendo item do catálogo usado em venda, **desativa em vez de
apagar**).

## 6. Correções de planejamento que a fase carrega

- `REQUIREMENTS.md` EST-02 e EST-11 (já apontados em 18/09) **mais**: todo requisito EST que fale em
  "material" como cadastro próprio, em categorias do Estoque ou em origem `financeiro`.
- A virada: o **estoque inicial não vem mais da Abertura por importação** — vem da contagem (§3).
  Os itens de categoria "Material" da Abertura viram compra de material no Financeiro (já previsto
  no briefing da 04.4).

## 7. Em aberto para a discussão da fase

1. O filtro por área substitui bem o filtro por frente na tela, ou o Theo sente falta de um filtro
   "só insumos / só o que se vende"?
2. Conversão de unidade na compra (comprou saco de 25 kg, controla em kg; comprou caixa com 12,
   controla em unidade): digitar a quantidade já convertida (proposta) ou cadastrar embalagem?
3. Inventário periódico: uma tela de "contagem geral" que gera todos os ajustes de uma vez, ou só
   o ajuste item a item do protótipo?
