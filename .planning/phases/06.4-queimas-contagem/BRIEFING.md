# Queimas — a contagem "o que queimou"

> Briefing escrito com o Theo no Cowork em **20/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Queimas AMASSA"). **O protótipo vence sobre a interface; este documento vence sobre
> regra de dado.** Dados e preços do protótipo são inventados.
> É **acréscimo** ao módulo Contador de Queima que já está no ar (Fase 4): fornos, contador de
> manutenção, registro em dois toques, manutenções e relatórios **continuam como estão**.

## 1. O que esta fase entrega

1. Um **segundo passo opcional** depois de registrar a queima: contar as peças, por tamanho (internas e externas).
2. A **cobrança da queima externa**, a partir da contagem.
3. **Números**: queimas por tipo e peças por fornada medidas.

🔴 **O registro em dois toques não pode ficar mais lento.** Queimar → tipo → pronto, já gravado. A
contagem abre em seguida e tem "Pular": pular não perde nada, e a queima entra numa lista "Sem
contagem", com "Contar agora". Contagem pode ser corrigida depois, pelo Histórico.

## 2. Categorias — decisão do Theo (20/09, segunda rodada)

**Seis contadores: Internas P · M · G e Externas P · M · G.** Mais a marca "o forno saiu cheio".

| Grupo | O que é | Paga queima? |
|---|---|---|
| **Internas** | tudo o que nasceu no espaço: encomenda, produção da casa, peça de **aula**, de **uso livre** (pagando as horas) e **biscoito pintado pelo cliente** no café | **não** — já está no preço da peça ou no que a pessoa pagou |
| **Externas** | peça feita **fora** (em casa, em outro ateliê) e trazida só para queimar | **sim**, por peça e por tamanho |

- Por que tamanho e não origem: o que ocupa o forno é o **tamanho**. É ele que serve à precificação
  (quantas cabem) e ao preço da queima externa. De quem é a peça interna a Produção (ordens) e a
  Agenda (aulas, uso livre) já sabem — a Queima **não guarda** encomenda × casa × espaço.
- ⚠️ Isto **corrige** a revisão de 19/09, que dizia que peça de uso livre paga queima externa. **Não paga.**
- **P · M · G é no olho**, pela maior medida da peça. Faixas **definidas pelo Theo em 20/09**: P até 10 cm · M de 10 a
  25 cm · G maior que 25 cm — **editáveis** — uma só régua, a mesma para internas e externas, guardada
  junto dos parâmetros. Nada de medir peça por peça.
- **"O forno saiu cheio"** (marcado por padrão): só fornada cheia entra nas médias de capacidade.

## 3. Atalhos da contagem

- **"Repetir a última"**: copia a contagem da última fornada contada **do mesmo tipo**.
- **Ordens da Produção esperando esta queima**: chips no topo ("+16 · Canecas para a loja"); um
  toque soma as peças pendentes da ordem no contador **interno do tamanho certo**, deduzido das
  medidas da ficha da peça pela mesma régua P · M · G. ✅ **Decisão do Theo:
  o atalho fica, mas NÃO escreve nada na Produção** nesta fase (não atualiza "já passaram" nem marca
  etapa). É só leitura. Enquanto a Produção nova não existir, o atalho simplesmente não aparece.

## 4. Cobrança da queima externa

- Preço = os itens **"Queima externa P / M / G" do Catálogo** (Financeiro), editáveis lá. Nenhum
  preço no código.
- Fornada com externas entra em **"Queimas externas a cobrar"** com o valor. Duas saídas:
  **"Lançar na Venda"** (abre a Venda do Financeiro com as linhas e quantidades preenchidas — o Theo
  ajusta, divide entre pessoas se for o caso, e lança por lá) e **"Recebi agora"** (pergunta a forma
  — dinheiro · pix · cartão — e cria a Venda **já paga**, que entra no Caixa na hora). ✅ **Ajuste de
  26/09 (mesma regra da Agenda): os dois botões criam a Venda; nada de "pago" que não exista no
  Caixa.** A Queima não cria venda sem um dos dois toques.
- Guardar na queima se as externas já foram cobradas e, quando houver, o vínculo com a venda.

## 5. Números

- **Quantas queimas de cada tipo** (biscoito · esmalte · ouro), ao todo desde a última manutenção e
  no mês — pedido explícito do Theo. O cartão do forno fica só com "Contagem: N queimas até a manutenção." (pedido do Theo).
- **Peças por fornada cheia**: média no biscoito e no esmalte, cada uma com o **mix médio por
  tamanho** ("12 P · 7,5 M · 1,5 G"), e a razão entre as duas = **fator do biscoito medido**. É o
  parâmetro que a precificação usa como estimado. A tela avisa quando ainda há poucas fornadas
  cheias contadas. Levar o número para Parâmetros continua **manual**. Com meses de uso, o mix por
  tamanho permite conferir quanto uma G ocupa perto de uma P (e o preço P/M/G da externa) — nesta
  fase basta **guardar e mostrar**; nenhum cálculo de equivalência.
- **O que o forno queimou**: internas × externas, cada uma aberta em P · M · G. Só visão: **não
  divide custo entre áreas**.

## 6. Dados

Uma tabela de contagem ligada à queima (uma linha por queima, seis colunas + "saiu cheio") ou filha por
contador — o planejador escolhe. Inteiros ≥ 0. Queima sem contagem é estado válido e permanente.
Apagar uma queima (já existe, com confirmação) leva a contagem junto e a confirmação diz isso.

## 7. Em aberto para a discussão da fase

1. Dois fornos: a contagem e os números são **por forno** (o módulo já é por forno) — confirmar que
   "fator do biscoito" é calculado por forno.
2. Queima de **ouro**: usa os mesmos contadores? (proposta: sim.)
4. Onde as faixas de P · M · G ficam editáveis (os valores já estão na §2).
3. Aproveitar a fase para os dois consertos visuais da vistoria de 19/09 (rótulos "atenção" e
   "limite" sobrepostos no medidor) ou manter como `/gsd-quick` à parte.
