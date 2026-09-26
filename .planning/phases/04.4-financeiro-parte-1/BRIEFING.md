# Financeiro — parte 1: Venda, Compra, Caixa, Mês e Cadastros

> Briefing fechado com o Theo no Cowork em **19/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta mesma pasta). **O protótipo é a especificação de tela e de fluxo. Onde a prosa deste documento
> e o protótipo divergirem sobre a interface, o protótipo vence. Sobre regra de dado que a tela não
> mostra (§4 a §8), este documento vence.**
> Todos os nomes, preços e valores do protótipo são inventados. O repositório é público: nenhum dado
> real do negócio entra em arquivo versionado, nem em seed, nem em teste.

## 1. O que esta fase entrega

O financeiro do dia a dia, usado por duas pessoas no celular, de pé:

- **Venda** — carrinho com várias linhas, de áreas diferentes, num recebimento só; à vista ou em parcelas.
- **Despesa** — três caminhos: compra de material · outra despesa · pagar conta que já existe (leva ao Caixa).

  > **Nota do dono, 2026-09-26 (quick task 260926-qpv):** o terceiro caminho, "pagar conta que já
  > existe", foi REMOVIDO depois do dono usar o módulo no celular — o botão pareceu inútil e grande
  > no uso real. A Despesa fica com os dois caminhos de verdade: compra de material · outra despesa.
  > Quem quer pagar uma conta que já existe passa a ir por Caixa → "A pagar" → "Paguei" — nada na
  > Despesa leva mais lá. Esta linha acima descreve o desenho ORIGINAL de 19/09/2026; não foi
  > apagada para preservar o histórico da decisão.
- **Caixa** — saldo, a pagar, a receber (com "Paguei" / "Recebi"), e o extrato com o saldo depois de
  cada movimento.
- **Mês** — quanto cada área deixou, o bloco Geral sem rateio, o veredito do mês, o dinheiro que se
  mexeu e o que ficou fora do resultado.
- **Cadastros** — Catálogo, Categorias, Contas fixas, Taxas.

**Fora desta fase** (vêm depois, não antecipar): precificação e orçamento com PDF (parte 2) · baixa
real de estoque (fase do Estoque) · cadastro de Pessoas · relatórios além do Mês · emissão fiscal
(nunca — a plataforma é só gestão).

## 2. O que NÃO fazer — decisões tomadas para simplificar

O briefing anterior (v4) previa quatro níveis de custo, rateio, transferência interna, subsídio e
seis dimensões por lançamento. **Tudo isso caiu.** Não reintroduzir:

- nenhum rateio de custo geral entre áreas; nenhum "nível de custo"; nenhum código contábil na tela;
- nenhuma partida dobrada; nenhuma depreciação como lançamento;
- o usuário **nunca escolhe a área** ao lançar — ela vem da categoria;
- as palavras "competência" e "regime de caixa" não aparecem na interface.

## 3. Vocabulário

| Na tela | No modelo |
|---|---|
| Área | Cafeteria · Espaço · Peças · Loja · Geral (lista fixa no código, como enum) |
| Categoria | dado editável; pertence a um **grupo** e a uma **área** |
| Grupo | `receita` · `custo` (direto de uma área) · `geral` · `fora` (fora do resultado) — fixo |
| Venda / Despesa | um **documento** com linhas e parcelas |
| A pagar / A receber | parcelas sem data de pagamento |

## 4. Modelo de dados (proposta — nomes de tabela em português, conforme o projeto)

```
categorias          id, nome, grupo, area, ativa
itens_catalogo      id, nome, categoria_venda_id, preco_venda (nulo = "valor na hora"),
                    aparece_na_venda, atalho_venda, atalho_compra,
                    controla_estoque, unidade, categoria_compra_id
ficha_tecnica       item_id, insumo_id, quantidade           (um nível só; insumo controla_estoque)
documentos          id, numero (sequencial, visível), tipo (venda|despesa), data (date),
                    pessoa_nome (texto livre, opcional), titulo (opcional), rotulo_parcela (opcional),
                    conta_fixa_id + mes_referencia (únicos juntos, só para contas fixas),
                    cancelado_em, cancelado_por, criado_por
documento_linhas    documento_id, item_id (opcional), descricao, categoria_id, quantidade,
                    valor_unitario, quantidade_estoque (só compra: quanto entrou, na unidade do item)
parcelas            documento_id, numero, vencimento (date), valor, forma (dinheiro|pix|cartao),
                    pago_em (date, nulo = em aberto), taxa_percentual (congelada no pagamento)
contas_fixas        id, nome, categoria_id, valor_esperado, dia_vencimento, ativa
configuracao_financeira   taxa_cartao_percentual, saldo_inicial, data_saldo_inicial
```

🔴 **`itens_catalogo` é o cadastro único de itens da plataforma inteira.** O módulo Estoque (fase
futura) vai ligar saldo, custo médio e movimentações **a esta mesma tabela** — não criar depois uma
tabela "materiais" separada. Por isso `controla_estoque`, `unidade` e `categoria_compra_id` já nascem
aqui. O protótipo aprovado do Estoque (`.planning/phases/06-estoque/prototipo.html`) mostra o que virá.

Dinheiro em `numeric(12,2)`; quantidade em `numeric` (0,04 kg existe). Datas civis são `date`.

## 5. Regras que a tela não mostra

**Documento e parcelas**
- À vista = uma parcela, já paga na data do documento. "Sinal de 50% + saldo" = duas (a segunda em
  +30 dias). "Nx" = N parcelas mensais, a primeira na data do documento e já paga; centavos de
  arredondamento vão na primeira. Depois de geradas, data, valor e "já recebi/paguei" são editáveis.
- **A soma das parcelas tem de fechar com o total**, validado no servidor. A tela avisa quanto falta
  ou sobra e desabilita o botão.
- Total do documento é sempre derivado das linhas; nunca um campo gravado à parte.
- O documento aceita **data retroativa** — é assim que se fecha o dia da cafeteria no fim do
  expediente (uma venda, várias linhas com quantidade).
- O preço vem do catálogo e é **editável na venda** (negociação de balcão). Quando difere, a tela
  mostra a etiqueta "tabela R$ X". A linha guarda o valor praticado; mudar o preço no catálogo depois
  **não altera** vendas já lançadas.

**Cartão**
- O preço **não muda** pela forma de pagamento. A taxa sai do que entra no caixa e vira custo Geral.
- `taxa_percentual` é gravada na parcela **no momento em que ela é paga no cartão** (venda à vista
  ou "Recebi"). Mudar a taxa em Cadastros não reescreve o passado.
- Entrou no caixa = valor − taxa. No Mês, a soma das taxas das parcelas pagas no mês aparece como a
  linha "Taxa do cartão" dentro do Geral (linha calculada, não é documento).

**Pagar / receber**
- "Paguei"/"Recebi" pede valor, data e forma. Se o valor pago difere do previsto **e** o documento
  tem uma linha e uma parcela só (conta fixa, tipicamente), a linha é ajustada junto. Nos demais
  casos ajusta só a parcela — e aí a soma deixa de fechar: **decidir na discussão da fase** se isso é
  bloqueado ou se gera uma linha "diferença". O protótipo não cobre.
- Falta no protótipo e deve existir: **desfazer um "Paguei/Recebi"** dado por engano.

**Cancelamento**
- Cancelar não apaga: o documento fica riscado no extrato, sai do saldo e dos relatórios. Guarda
  quem e quando. Pede confirmação dizendo o que acontece (regra do projeto). Sem edição de documento
  lançado nesta fase: errou, cancela e lança de novo.
- Quando o Estoque existir, cancelar gera movimentação de estorno (não apaga a saída).

**Contas fixas**
- "Gerar as contas de <mês>" cria um documento de despesa por conta fixa ativa, em aberto, no dia de
  vencimento. **Idempotente** por (conta fixa, mês) — rodar duas vezes não duplica. É manual de
  propósito nesta fase (sem cron).
- O valor é "esperado"; o real se acerta no "Paguei".

**Categorias**
- Categoria com lançamento não se apaga — **desativa**: some das listas de escolha, continua nos
  relatórios. Grupo e área não mudam depois de a categoria ter lançamentos.
- O grupo `fora` (equipamento e obra, parcela de financiamento, aporte, retirada) mexe no caixa e
  **não** entra em "quanto cada área deixou" nem no veredito do mês.

**Mês**
- "Vendeu" e "Custou" contam pela **data do documento**. "Dinheiro que se mexeu" conta pela **data
  de pagamento** das parcelas. São dois quadros separados, de propósito.
- **Compra de material conta como custo no mês da compra** (decisão consciente do Theo; a versão
  "custo quando é usado" fica para depois do Estoque, se um dia incomodar).
- Veredito = soma do que as áreas deixaram − Geral.

**Extrato**
- "saldo" em cada linha = saldo acumulado em ordem de (data de pagamento, número do documento).
  Lançamento retroativo recalcula os saldos posteriores — é o esperado.

## 6. O efeito no estoque — nesta fase, só o contrato

O protótipo mostra "O que esta venda tira do estoque" e "O que esta compra põe no estoque". Nesta
fase isso é **cálculo puro exibido na tela** (`lib/financeiro/efeito-estoque.ts`, testado), sem gravar
movimentação. Regra: item com ficha técnica → baixa cada insumo (quantidade × linha); senão, item
com `controla_estoque` → baixa ele mesmo; compra → entra `quantidade_estoque`, com custo unitário =
valor da linha ÷ quantidade. Saldo negativo nunca bloqueia venda. A fase do Estoque troca a exibição
pela gravação, com origem `venda` / `compra`.

## 7. A virada: parcelas da Abertura

Importação feita **uma vez**, por script, perto da inauguração — não é tela. Planejar como plano
próprio, no fim da fase:

- Item da Abertura com parcelas a vencer **a partir do mês da virada** → um documento de despesa,
  com as parcelas em aberto e o rótulo "n de N" preservado.
- Categoria do item na Abertura = **Material** → categoria de custo da área correspondente (é insumo,
  não investimento). **Demais categorias** → "Equipamento e obra" (grupo `fora`).
- O que já foi pago antes da virada **não entra** no saldo novo: o saldo inicial é um número que o
  Theo informa (`saldo_inicial`, `data_saldo_inicial`).
- A Abertura **não é apagada nem alterada** por esse script (só leitura). Regra de dono único: gasto
  que está na Abertura não é lançado de novo à mão.

## 8. Encaixe na plataforma

- Rota do módulo: `/financeiro`, abrindo na Venda; sub-navegação Venda · Despesa · Caixa · Mês.
  **Cadastros é área própria** (vai servir a todos os módulos), alcançável pelo Início.
- A navegação nova (Início como índice; barra Início · Financeiro · Produção · Agenda) é de **outra
  fase** (`/gestao` + site). Aqui, só acrescentar o Financeiro ao menu do jeito menos invasivo — e
  lembrar que a barra do celular hoje já tem cinco itens: decidir na discussão o que sai dela.
- A rota `/orcamentos` (casca vazia de hoje) fica como está até a parte 2.
- Regras puras em `lib/financeiro/` (parcelas, totais, taxa, mês, extrato, efeito no estoque), sem
  React nem banco, com Vitest. Toda Server Action começa por `exigirUsuario()`; Zod no servidor.
- Os botões "Testar com as vendas/despesas que você descreveu" e "Voltar aos dados de exemplo" são
  **andaime do protótipo** — não existem na plataforma. Os treze exemplos viram casos de teste e2e.
- Seed de desenvolvimento: categorias iniciais do protótipo (o Theo edita depois). **Catálogo nasce
  vazio em produção.**

## 9. Em aberto para a discussão da fase

1. Pagamento com valor diferente em documento de várias linhas/parcelas (§5).
2. O que sai da barra de baixo do celular para o Financeiro entrar (§8).
3. Pagamento **misto** numa venda (parte Pix, parte dinheiro): o protótipo tem uma forma só por
   venda. Dá para contornar com duas parcelas pagas no mesmo dia; perguntar ao Theo se basta.
4. Desconto no total da venda (hoje só por edição do preço da linha).
5. Busca e filtro no extrato quando ele crescer (por mês, por pessoa, por forma).
