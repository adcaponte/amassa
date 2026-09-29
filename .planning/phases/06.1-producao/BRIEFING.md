# Produção — redesenho do módulo de Encomendas

> Briefing escrito com o Theo no Cowork em **20/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Produção AMASSA"). **O protótipo vence sobre a interface; este documento vence sobre
> regra de dado que a tela não mostra.** Dados do protótipo são inventados.
> Executar depois do Financeiro (partes 1 e 2), do `/gestao` e do Estoque: usa o orçamento aprovado, o
> catálogo, as fichas de precificação e as movimentações de estoque.

## 1. O que muda, em uma frase

O módulo deixa de ser "cronograma de encomendas calculado pelo calendário" e vira **"o que está em
produção e em que etapa está"** — com etapas **marcadas como feitas**, produção da casa ao lado das
encomendas, e ligação real com Orçamento, Financeiro e Estoque.

✅ **Decisão do Theo (20/09): o módulo de Encomendas nunca foi usado com trabalho real.** Tudo o que
está lá é dado de teste e **pode ser apagado, e o esquema pode ser refeito** do jeito que for melhor
para a Produção — sem obrigação de migrar dados nem de manter as tabelas `encomendas*` como estão.
Reaproveitar o que servir (cronograma em módulo puro, Gantt, padrões de tela); descartar o resto.
Apagar tabela em produção continua sendo migração aplicada pelo Theo, à mão, depois de backup — e a
fase deve **conferir com ele, antes**, que não há mesmo nada real lá. Nome na interface: **Produção**;
rota proposta `/gestao/producao`.

## 2. Decisões do Theo (não reabrir)

1. **Etapa se marca como feita** ("Terminei: Secagem"), um toque, com desfazer da última. A situação
   deixa de ser deduzida da data. Cada etapa feita guarda a data real.
2. **Dois caminhos**: *completo* (produção → secagem → queima de biscoito → esmaltação → queima de
   esmalte → entrega) e *termina no biscoito* (produção → secagem → queima de biscoito → fim) — para
   peça em biscoito, seja para o cliente pintar no espaço, seja para vender a outro ateliê.
3. **A tela principal responde "o que está em produção e em que etapa"**: quadro por etapa. Horas de
   trabalho **não** aparecem no quadro (variam por muitos motivos); ficam só dentro da ordem.
4. **A ordem anda inteira**: a etapa só termina quando **todas** as peças passaram por ela. O parcial
   é um campo opcional ("já passaram 18 de 30") que aparece no cartão, mas não move a ordem.
5. **Linha do tempo** como segunda vista (alternador Quadro | Linha do tempo; lembra a escolha).
6. **Peças a mais, de segurança**: por peça da encomenda, quantas serão feitas além do pedido.
7. **O cliente não vê nem paga as peças a mais.** A perda embutida no preço é que as cobre. Se um
   dia o Theo concluir que pesam, acrescenta ao custo do orçamento — decisão futura, fora desta fase.

## 3. Tipos de ordem e de onde nascem

| Tipo | Nasce de | Tem cliente | Termina em |
|---|---|---|---|
| **Encomenda** | orçamento aprovado (normal) ou "Nova ordem" (pedido de boca) | sim | Entrega |
| **Produção da casa** | "Nova ordem" | não | Guardar no estoque |

- Ordem vinda de orçamento carrega: título, cliente, peças com quantidade, **cor, personalização**,
  **fotos de referência** (as do orçamento — não duplicar arquivo), **ficha de cada peça** (gramas,
  medidas, horas, custo) e os vínculos **orçamento ↔ venda ↔ ordem**, navegáveis nos dois sentidos.
  Substitui a criação provisória de encomenda feita na parte 2 do Financeiro.
- **Aguardando sinal**: a ordem vinda de orçamento nasce parada, fora do quadro, sem contar prazo.
  ✅ **Decisão do Theo (20/09): a liberação é manual, na própria Produção.** Enquanto aguarda, o Theo
  configura a ordem inteira (peças a mais, dias previstos) e então a **ativa**. Ao ativar, o início
  passa a ser a data da ativação. Sem ligação automática com o "Recebi" do Caixa nesta fase; a tela
  só mostra, para consulta, se a parcela do sinal já consta como recebida.

## 4. Etapas, prazos e leitura

- Cada etapa tem **dias previstos** (padrões atuais do módulo) e, quando feita, **data real**. Os
  previstos só se ajustam nas etapas **futuras** (− / +); atual e passadas valem pelo que aconteceu.
- "Dias nesta etapa" = hoje − data em que a anterior foi feita (ou o início).
- **Previsão de conclusão** = hoje + o que falta do previsto da etapa atual + previstos das futuras.
- Selo da ordem, nesta prioridade: *aguardando o sinal* · *vai atrasar N dias* (previsão depois da
  entrega prometida) · *+N dias nesta etapa* (passou do previsto) · *no ritmo*.
- A regra antiga dos marcos e da "espera" (Fase 04.1) **deixa de existir**: o que era espera entre
  etapas vira simplesmente tempo real decorrido. Sem dado real a preservar (§1), não há migração.
- Tudo isso em módulo puro (`lib/producao/`), testado, sem depender do relógio (recebe "hoje").

## 5. Quadro, fila do forno e linha do tempo

- Quadro: seis colunas no computador, seções empilhadas no celular; filtros Tudo · Encomendas · Da casa.
- Três números no topo: em produção (ordens e peças) · **esperando o forno** · aguardando sinal.
- **Esperando o forno**: ordens cuja etapa atual é uma queima, com estimativa de fornadas =
  Σ peças que ainda não passaram ÷ quantas cabem (o "cabem" vem da precificação, pelas medidas). O
  forno é pequeno (cúbico, 30–40 cm): esta é a fila que mais trava o ateliê. É estimativa, dita como tal.
- Linha do tempo: uma linha por ordem; trecho **cheio** = aconteceu (datas reais), **listrado** =
  previsto, linha vertical = hoje, traço = entrega prometida; nome fixo à esquerda, barras rolam de
  lado no celular. Aproveitar o que já existe do Gantt atual. Ordens aguardando sinal não aparecem.

## 6. Material usado

- **Previsto** por ordem = Σ (gramas da ficha × **peças feitas**, incluindo as a mais), para argila e
  esmalte. Mostra "baixado X de Y kg" e avisa quando passou do previsto.
- **Baixa total** (vem preenchida com o que falta) · **Baixa parcial** · **+ Dar baixa de outro
  material**. A ficha diz "argila" e "esmalte" sem dizer qual: a baixa **pergunta qual item do
  estoque**. Cada baixa é uma movimentação do Estoque com origem `manual`, destino "consumo em
  encomenda" e **vínculo real com a ordem**. Opcional: ordem sem baixa nenhuma é válida.
- Cancelar a ordem **não** devolve material ao estoque (a tela avisa).

## 7. Conclusão, extras e perdas

A tela pergunta **uma coisa por peça: quantas se perderam**. O resto é derivado:

```
feitas      = pedido + a mais
boas        = feitas − perdidas
entregues   = mín(pedido, boas)            (produção da casa: não há entrega)
extras boas = máx(0, boas − pedido)        (produção da casa: todas as boas)
faltam      = máx(0, pedido − boas)  → permite "Concluir como entrega parcial", com aviso
```

- **Destino das extras boas**: *entram no Estoque como pronta entrega* (origem `producao`, custo da
  ficha de precificação) ou *sem destino* (não será vendida). Sugestão automática: peça **exclusiva**
  → sem destino; peça **de linha** → Estoque. Sempre trocável. Peça exclusiva que for para o
  estoque precisa virar item do catálogo — a tela conduz isso.
- Guardar **dois números separados**, por ordem e por peça: **perda técnica** (perdidas ÷ feitas) e
  **extras sem destino**. Só a perda técnica calibra o parâmetro "perda" da precificação; misturar
  os dois faria a taxa parecer pior do que é. Nesta fase basta **guardar e mostrar** o acumulado
  ("perda medida nos últimos N meses: X%") ao lado do parâmetro; trocar o parâmetro continua manual.
- Encomenda concluída: o saldo a receber **continua no Caixa**; a Produção não mexe em parcela.
- Cancelar ordem **não cancela a venda** (a tela diz isso e manda decidir o sinal no Financeiro).

## 7.1 Folhas para imprimir (A4) — prototipadas em 20/09

Duas folhas, as duas no protótipo (botão "Imprimir" no quadro e "Imprimir folha" na ordem):

- **Folha da ordem** — para ficar junto das peças, na prateleira: nome, cliente, número, início e
  entrega; tabela de peças com **pedido · a mais · fazer**, argila por peça e medidas; cor e
  personalização; fotos de referência; **etapas com caixa de marcar, "feita em" e "quantas passaram"
  em branco para preencher à mão** (as já feitas vêm marcadas); material previsto; espaço "perdidas /
  extras boas"; pauta de anotações. **Sem preço, sem custo** — é folha de bancada.
- **Folha geral** — o quadro no papel: ordens agrupadas por etapa, com peças, dias na etapa, entrega
  e caixa de "feito"; aguardando sinal no fim.

Rodapé das duas: data da impressão e "o que vale é o que está na plataforma". CSS de impressão, sem
gerar PDF no servidor (diferente do orçamento, que vai para o cliente). Substitui a folha A4 atual
das Encomendas (ENC-14).

## 8. Fora desta fase

Aviso de capacidade ao prometer prazo no orçamento (precisa de semanas de uso real) · ligar a cor da
peça ao esmalte certo do estoque · etapas por peça dentro da mesma ordem · horas reais por etapa ·
cobrança das peças a mais no orçamento.

## 9. Em aberto para a discussão da fase

1. ~~Liberação pelo sinal~~ — respondido: manual (§3).
2. ~~Migração das encomendas~~ — respondido: nada a migrar; confirmar com o Theo antes de apagar (§1).
3. ~~Folha A4~~ — respondido e prototipado (§7.1).
4. Rota: `/gestao/producao` com redirecionamento, ou manter `/gestao/encomendas`.
