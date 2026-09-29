---
phase: 06-estoque
plan: 11
status: approved
approved: 2026-09-29
started: 2026-09-29
updated: 2026-09-29
---

# Verificação Humana — Fase 06: Estoque

**Gerado por:** execução do plano `06-11-PLAN.md`, Tarefa 1, em 29/09/2026 — na sessão noturna,
sem você.

**Status (29/09/2026, tarde): APROVADA pelo dono no chat** — "repassei toda verificação. o cowork
tambem verificou. Aprovado." A Parte 0 foi respondida de manhã; a Parte 1 (o Roteiro 15) foi feita
por ele, com as saídas coladas no chat e conferidas pelo orquestrador; a Parte 2 foi percorrida por
ele **sem anotação por item nem os tempos medidos da baixa**; e o Cowork fez uma verificação
independente em produção (`Claude outputs/estoque/VERIFICACAO-COWORK-06.md`, fora do git). O
registro está no início da Parte 1 e da Parte 2. A Fase 06 está no ar desde o merge `2345850`.
*O parágrafo seguinte é o status da manhã, mantido como registro — "nada da Fase 06 está no ar" era
verdade até o Roteiro 15.*

**Status (29/09/2026, manhã):** **Parte 0 respondida** (respondido pelo dono no chat em 29/09/2026, pela manhã, por formulário) e aplicada no código e na
migração — ver o fim de cada item da Parte 0. **Partes 1 e 2 não percorridas.** Nada da Fase 06 está no ar: o código mora no branch
`gsd/phase-06-estoque`, a migração `0023` está escrita e versionada mas **não aplicada**, e nenhum
requisito EST foi marcado cumprido. Esta fase fecha por esta caminhada, não por contagem de planos.

**São três partes, nesta ordem, sem pular:**

1. **Parte 0 — antes do servidor** (dá para ler deitado): as decisões que foram tomadas sem você. Duas
   delas — **D-23 e D-24** — mexem no valor do cancelamento, e só você decide regra de dinheiro.
2. **Parte 1 — o servidor:** o Roteiro 15 (`docs/operacao/15-migracao-estoque.md`), que publica a
   migração antes do código. Aqui você só registra o que cada passo mostrou.
3. **Parte 2 — o celular, no ateliê:** a contagem inicial real, os 9 critérios do ROADMAP, a baixa
   com cronômetro, e as conferências que só um celular de verdade revela.

**Como preencher:** marque a caixa (`- [x]`) e escreva o que viu na linha **Resultado** — "ok"
basta. Se algo não passar, descreva o que apareceu na tela, sem precisar ser técnico. Caixa marcada
sem Resultado não conta como percorrida.

**Nenhum dado real de cliente em nenhum lançamento de teste** — o repositório é público, e este
documento também. Use nomes inventados com "[teste]" na frente.

> **Sobre dado de teste em produção.** O livro do estoque **não se apaga nem se edita** — é a
> garantia do EST-06. Tudo o que você lançar para testar fica lá para sempre. A Parte 2 usa, por
> isso, **um material de teste só** ("[teste] argila da caminhada"), com custo **R$ 0,00** — assim ele
> não soma dinheiro nenhum no "Para onde foi" — e o desativa no fim. As conferências que pedem dado
> extremo (valor de R$ 123 mil, nome de 120 letras, 60 materiais) têm uma segunda opção: pedir ao
> agente as capturas de tela a 320px, feitas no banco de teste, e você só olha as imagens.

---

## Parte 0 — Antes do servidor: as decisões tomadas sem você

> ✅ **Respondida em 29/09/2026, pela manhã** (respondido pelo dono no chat em 29/09/2026, pela manhã, por formulário). Resumo: **D-23 vale**, **D-24 vale**,
> **WR-01 → a alternativa** (com saldo zero ou negativo, a venda cancelada volta ao custo médio do
> momento), **WR-02 → a alternativa** (a venda cancelada não conta como "última entrada com preço"),
> **D-29 → sim, "Produção da casa"**, área Peças, semeada na `0023`. Os textos de explicação abaixo
> ficam como estavam — são o registro da escolha; onde dizem "o que o código faz hoje", leia "o que o
> código fazia até 29/09 de manhã". Os commits e o `npm run verificar` estão no adendo de
> `06-11-SUMMARY.md`.

### 0.1 🔴 D-23 e D-24 — o valor do estorno (responda antes do Roteiro 15)

Quando uma venda ou uma compra é **cancelada**, o material volta (ou sai) do estoque por uma
movimentação de **estorno** — nada é apagado. A quantidade é óbvia: a mesma do lançamento. A
pergunta é **a que valor**, porque o valor em estoque e o custo médio dependem disso.

**D-23 — venda cancelada: o material volta ao custo que a venda levou.**

Exemplo: você tinha 5 kg de argila a R$ 4,20/kg. Uma venda levou 2 kg, gravados a **R$ 8,40**.
Depois chega uma compra nova, e o médio sobe para R$ 5,00/kg. Aí a venda é cancelada: os 2 kg voltam
a **R$ 8,40** (o que saíram), não a R$ 10,00 (o médio de hoje). O "Para onde foi" daquela venda
zera certinho, e o médio fica em R$ 4,94/kg.

- *Alternativa:* voltar ao custo médio de hoje (R$ 10,00 no exemplo). Também funciona; o "Para onde
  foi" da venda cancelada deixa de zerar exato.

**D-23 quando o estoque está zerado ou negativo na hora de cancelar — o caso que o exemplo acima não
mostra.** *(Achado da revisão de código de 29/09, `06-REVIEW.md` WR-01. Nada foi mudado no código:
a escolha é sua.)*

O exemplo acima tem estoque sobrando quando a venda é cancelada. Mas o saldo pode estar em zero ou
negativo nessa hora — o sistema permite saldo negativo (D-06), e toda venda feita antes da contagem
inicial deixa o material negativo (Roteiro 15, Passo 8). Nesse caso o código de hoje **não** devolve
o material ao valor que a venda levou: ele trata a devolução como uma entrada que tira o estoque do
negativo, e o custo da prateleira inteira passa a ser o custo daquela venda antiga.

Exemplo, com um item em unidades:

| | Quantidade | Valor em estoque | Custo por unidade |
|---|---|---|---|
| A última compra foi a R$ 10,00/un; a prateleira está vazia | 0 un | R$ 0,00 | R$ 10,00 |
| Venda A leva 2 un (a R$ 10,00 cada) | −2 un | −R$ 20,00 | |
| Compra de 5 un por R$ 250,00 (R$ 50,00/un) | 3 un | R$ 150,00 | R$ 50,00 |
| Venda B leva 4 un | −1 un | −R$ 50,00 | |
| **Cancela a venda A — o que o código faz hoje** | **1 un** | **R$ 10,00** | **R$ 10,00** |
| *Cancela a venda A — a alternativa* | *1 un* | *R$ 50,00* | *R$ 50,00* |

- **O que o código faz hoje:** a venda A tinha levado R$ 20,00, mas o cancelamento grava **+R$ 60,00**,
  e a unidade que sobrou passa a valer **R$ 10,00**, embora a última compra tenha sido a R$ 50,00. O
  valor em estoque fica mais baixo, e as próximas baixas desse material saem a R$ 10,00/un até a
  próxima compra. O "Para onde foi" continua certo: a venda cancelada sai de lá de qualquer jeito.
- **A alternativa que a revisão sugere:** quando o estoque está em zero ou negativo na hora de
  cancelar, o material volta ao **custo médio daquele momento** (a mesma conta de um ajuste para
  mais), e a prateleira não muda de preço: a unidade continua valendo **R$ 50,00**. O cancelamento
  grava +R$ 100,00 — também diferente dos R$ 20,00 da venda.
- **Nenhuma das duas consegue gravar exatamente os R$ 20,00 nesse caso:** a conta deixaria 1 unidade
  valendo −R$ 30,00, um número que não existe. Com estoque positivo na hora de cancelar, as duas
  fazem a mesma coisa — o exemplo de cima.

Trocar para a alternativa mexe em `movimentoDoEstorno` e `valorarMovimento` (`lib/estoque/custo.ts`)
e no teste "comportamento atual — a confirmar pelo dono (WR-01)" de
`tests/unit/estoque-custo.test.ts`. Não mexe na migração.

- [x] **D-23 com estoque zerado ou negativo:** fica como hoje (a prateleira passa ao custo da venda
  antiga) / **troco para a alternativa (volta ao custo médio do momento)** / outra: ____________
- **Resultado:** alternativa — respondido pelo dono no chat em 29/09/2026, pela manhã, por formulário. Aplicado no branch da fase: o estorno de venda com saldo zero
  ou negativo grava ao custo médio do instante (`lib/estoque/custo.ts`, regra R7); no exemplo, a
  1 un fica valendo R$ 50,00 (teste "WR-01 decidido pelo dono em 29/09" em
  `tests/unit/estoque-custo.test.ts`).

**A venda cancelada conta como "a última entrada com preço"?** *(Achado da revisão de código de
29/09, `06-REVIEW.md` WR-02. Nada foi mudado no código: a escolha é sua. Mexe na D-26.)*

A D-26 diz: quando a prateleira está em zero, a baixa sai pelo custo da **última entrada com preço**.
Hoje, o cancelamento de uma venda **conta** como entrada com preço — a pesquisa da fase o definiu
assim (`06-RESEARCH.md`, Pergunta 3). Duas consequências:

- **O custo de uma baixa com prateleira vazia pode vir de uma venda cancelada, não da última
  compra.** Exemplo: a última compra foi a R$ 50,00/un e a prateleira está vazia. Cancela-se uma
  venda antiga, que tinha levado 1 un a R$ 10,00. Essa unidade volta, sai de novo, e a prateleira
  zera. A baixa seguinte, com a prateleira vazia, sai a **R$ 10,00** (o custo da venda cancelada), e
  não a R$ 50,00 (a última compra).
- **A tela pode mostrar "R$ 0,00/un" onde promete "—".** Um material que nunca teve compra nem
  entrada com preço mostra "—" no custo médio (não se sabe o custo). Se ele for vendido antes da
  primeira compra (a venda sai a R$ 0,00, pela D-26) e essa venda for cancelada, o cancelamento
  vira uma "entrada com preço" de R$ 0,00, e a tela passa a mostrar **"R$ 0,00/un"** — como se o
  custo fosse zero, e não desconhecido.

- **O que o código faz hoje:** o cancelamento de venda conta como a última entrada com preço (as
  duas consequências acima acontecem).
- **A alternativa que a revisão sugere:** o cancelamento **não** conta. A "última entrada com
  preço" passa a ser só compra, entrada manual e contagem. No exemplo, a baixa com prateleira vazia
  sairia a R$ 50,00, e o material nunca comprado continuaria mostrando "—".

Trocar para a alternativa mexe em três lugares que andam juntos — `valorarMovimento`
(`lib/estoque/custo.ts`) e as duas consultas da última entrada (`lerEstados` em
`lib/estoque/gravacao.ts`, `listarSaldos` em `lib/estoque/consultas.ts`) — e nos testes "comportamento
atual — a confirmar pelo dono (WR-02)" de `tests/unit/estoque-custo.test.ts`. Não mexe na migração.

- [x] **Venda cancelada como "última entrada com preço":** fica como hoje (conta) / **troco para a
  alternativa (não conta)** / outra: ____________
- **Resultado:** alternativa (não conta) — respondido pelo dono no chat em 29/09/2026, pela manhã, por formulário. Aplicado nos três lugares: `valorarMovimento`
  não guarda o estorno como última entrada, e `lerEstados`/`listarSaldos` filtram
  `estorno_de_id is null`. No exemplo, a baixa com prateleira vazia sai a R$ 50,00, e o material
  nunca comprado continua mostrando "—".

**D-24 — compra cancelada: o material sai ao custo médio de agora, não ao que a compra custou.**

Não é gosto, é conserto de um defeito. Exemplo com números:

| | Quantidade | Valor em estoque |
|---|---|---|
| 10 un a R$ 0,01 cada | 10 un | R$ 0,10 |
| Compra de 1 un por R$ 10,00 | 11 un | R$ 10,10 |
| Saem 5 un (ao médio, R$ 4,59) | 6 un | R$ 5,51 |
| **Cancela a compra — D-24 (médio de agora, R$ 0,92)** | **5 un** | **R$ 4,59** ✅ |
| *Cancela a compra — pelo que ela custou (R$ 10,00)* | *5 un* | ***−R$ 4,49*** ❌ |

Pelo custo original, o estoque ficaria com **5 unidades valendo menos que zero** — um número que não
existe. Ao custo médio, isso nunca acontece. O preço: o médio não "desmistura" a compra cancelada.

**Como trocar, se quiser:** é um ramo só, `movimentoDoEstorno` em `lib/estoque/custo.ts`, e o bloco
"D-23/D-24" de `tests/unit/estoque-custo.test.ts`. Nenhum outro lugar do sistema calcula o valor de
um estorno. O agente troca, roda `npm run verificar`, e só então o Roteiro 15 segue. A troca não
mexe na migração.

- [x] **D-23 (venda cancelada volta ao custo que a venda levou):** **vale** / troco para ____________
- [x] **D-24 (compra cancelada sai ao custo médio de agora):** **vale** / troco para ____________
- **Resultado:** as duas valem, sem mudança — respondido pelo dono no chat em 29/09/2026, pela manhã, por formulário.

### 0.2 D-29 — uma pergunta, não uma decisão

A "Peça pronta" (peça produzida na casa que vai para o estoque) é reconhecida pela **ficha de
precificação ligada** ao item, não por nome de categoria. Mas todo material com estoque precisa de
uma **categoria de compra** (é dela que sai a área que "paga"), e a semente só tem "Peças prontas"
como categoria de **venda** — a peça produzida não tem categoria de compra natural.

**Quer uma categoria de compra própria para a produção da casa?** (ex.: "Produção da casa", área
Peças.) Nada foi semeado nesta fase. Se sim, ela entra como semente numa migração futura, ou você a
cria em Cadastros → Categorias.

- [x] **D-29:** **sim (nome: Produção da casa)** / não / depois
- **Resultado:** sim — respondido pelo dono no chat em 29/09/2026, pela manhã, por formulário. Semeada no fim da própria `db/migrations/0023_estoque.sql` (área
  Peças, grupo custo — o das categorias de compra da semente 0016), idempotente; o Roteiro 15,
  Passo 5.5, confere no servidor que ela existe uma vez. Por isso o branch só-migração ganhou um
  commit novo em 29/09.

### 0.3 As decisões `[auto]` do contexto — para você saber, e como desfazer cada uma

Tomadas pela opção recomendada; o porquê completo está em `06-CONTEXT.md`. Nenhuma pede resposta
agora — marque só as que quiser trocar.

| Decisão | O que ficou | Como desfazer |
|---|---|---|
| D-13 | Sem filtro "só insumos / só o que se vende"; o filtro é a área + a busca | Acrescentar o alternador derivado de `aparece_na_venda` — sem migração |
| D-14 | Destinos "uso do ateliê" e "perda ou quebra" são pagos pela área **Peças** | Trocar o mapeamento em `DESTINOS_DE_SAIDA` (`lib/estoque/destinos.ts`) — ex.: perda paga pela área do próprio item |
| D-16 | Existe uma tela de contagem geral, além do ajuste item a item | Tirar a rota `/gestao/estoque/contagem` e o botão "Contar estoque" |
| D-17 | Primeira contagem de cada material vira entrada com custo, pela **diferença** contra o saldo do instante | Um ramo de `planejarContagem` (`lib/estoque/contagem.ts`) |
| D-18 | Depois, a contagem é conferência: grava ajuste só do que mudou; cada material grava ao confirmar, sem rascunho | Idem; rascunho exigiria tabela nova |
| D-19 | Na compra, digita-se a quantidade já convertida (saco de 25 kg → 25); sem cadastro de embalagem | Cadastro de embalagem é tabela nova — ficou em "Deferred Ideas" |
| D-20 | Item com histórico **se desativa, nunca se apaga** (coluna `ativo`) | Liberar o apagar mexeria no `revoke delete` da 0015 (regra FNC-10 sua) |
| D-21 | Saldo negativo é aviso **próprio**, separado de "abaixo do mínimo", em 3 lugares (Venda, lista, Início) | Juntar os rótulos em `alertaDoItem` (`lib/estoque/saldo.ts`) |
| D-22 | A entrada de Peça pronta vem com o custo da ficha preenchido (editável) | Deixar o campo vazio em `custosDasPecasProntas` |
| D-25 | Custo médio móvel, com os grampos do ERPNext para saldo negativo | Trocar o algoritmo em `valorarMovimento` (`lib/estoque/custo.ts`) |
| D-26 | Saída com saldo zero usa o custo da última entrada com preço; sem nenhuma, R$ 0,00 | Um ramo de `valorarMovimento` |
| D-27 | A área do item vem da categoria de **compra** primeiro; a baixa por venda é paga pela área da categoria de **venda** da linha | Trocar a ordem em `areaDoItemNoEstoque` |
| D-28 | `saldo <= mínimo` conta como acabando (igual ao protótipo) | Trocar `<=` por `<` em `alertaDoItem` |
| D-30 | Compra paga depois com valor diferente: o custo do estoque é o da nota lançada; sem correção de custo | Correção de custo seria movimentação nova — não existe nesta fase |
| D-31 | "Para onde foi" inclui as vendas, numa barra própria "Vendido · pelo Financeiro" | Tirar a barra em `agregarParaOndeFoi` (`lib/estoque/historico.ts`) |
| D-32 | Contagem e ajuste aceitam **zero** (prateleira vazia) | Uma linha no esquema da contagem |

- [ ] **Quero trocar alguma destas:** ____________ (ou "nenhuma")
- **Resultado:** *(29/09/2026)* sem resposta do dono — a aprovação não trocou nenhuma; ficam como estão até ele pedir. Lembrete em `.planning/STATE.md`, Pending Todos (o Cowork destacou D-14, D-21 e "material desativado nunca avisa").

### 0.4 As decisões de interface (UI-D1 a UI-D16)

| Decisão | O que ficou | Como desfazer |
|---|---|---|
| UI-D1 | Barra de abas **neutra**, não terracota como no protótipo | Cor da aba marcada em `abas-estoque.tsx` |
| UI-D2 | Contagem em rota própria, com o modo decidido por material | Voltar a uma folha — perde recarregar sem perder o lugar |
| UI-D3 | A primeira abertura mostra só o painel de contagem, sem lista, alertas ou barra de baixo | `estadoDoEstoque` na página do Estoque |
| UI-D4 | Filtro Ativos · Desativados · Todos **no fim** da lista, não no topo | Mudar o filtro de lugar em `aba-saldos.tsx` |
| UI-D5 | "+ Material" na barra do celular, "+ Novo material" no resto | Um rótulo só (quebra a 360px) |
| UI-D6 | O aviso (toast) sobe acima da barra fixa do celular | Variável `--altura-acao-fixa` em `globals.css` |
| UI-D7 | "Acabando" inclui o saldo negativo, com chip próprio | Pílula "Saldo negativo" separada — mais um controle no topo |
| UI-D8 | Prévia com frase neutra quando o campo está vazio (o botão não pula de lugar) | Prévia vazia, como no protótipo |
| UI-D9 | Erro embaixo do campo, não em toast | Toast como no protótipo |
| UI-D10 | Folha de tela toda no celular, com fechar próprio de 44px em português | Usar o fechar padrão (diz "Close" e é menor que 44px — achado para a Fase 7) |
| UI-D11 | Material desativado não se movimenta; reativa-se pela folha dele | Permitir baixa em desativado |
| UI-D12 | Depois de cadastrar material, a folha abre em **Entrada** para ele | Só o aviso |
| UI-D13 | No celular, nenhuma folha abre o teclado sozinha | Foco automático sempre |
| UI-D14 | Entrada manual avisa: "Comprou? Lance em Financeiro → Despesa → Compra de material" | Tirar o aviso |
| UI-D15 | Histórico em páginas de 50, com "Mostrar mais 50" | Navegação por mês |
| UI-D16 | Contagem às cegas: o saldo do sistema só aparece depois de digitar | Mostrar "o sistema diz X" ao lado do campo |

- [ ] **Quero trocar alguma destas:** ____________ (ou "nenhuma")
- **Resultado:** *(29/09/2026)* sem resposta do dono — ficam como estão até ele pedir (lembrete em `.planning/STATE.md`).

### 0.5 Escolhas feitas durante a execução (29/09) — para você saber

Estão também em `.planning/STATE.md`, "Decidido sem o Theo", com o porquê e como desfazer.

- Material **desativado nunca alerta** (fora do banner, de "Acabando" e do Início).
- A entrada manual comum **aceita R$ 0,00** (doação, amostra); a entrada de peça pronta e a primeira
  contagem acima do saldo **recusam** custo zero.
- No Histórico, o ajuste mostra o sinal real ("+1", "−0,9"), não um "±" literal.
- "Gasto por" lista só produtos **ativos**.
- "Ir para Compra de material" leva a Financeiro → Despesa, que já abre em Compra de material.
- Os cinco destinos da baixa são uma escolha única (tocar de novo no marcado desmarca).
- O Roteiro 15 publica **só a migração** antes do backup (Passo 2) — sem isso a `0023` não chegaria ao
  servidor antes do código.

- [ ] **Quero trocar alguma destas:** ____________ (ou "nenhuma")
- **Resultado:** *(29/09/2026)* sem resposta do dono — ficam como estão até ele pedir (lembrete em `.planning/STATE.md`). O Cowork viu que a entrada manual **recusa o campo de custo vazio** e aceita "0" digitado — a frase acima ("aceita R$ 0,00") vale para o zero digitado.

---

## Parte 1 — O servidor: o Roteiro 15

> ✅ **Feita pelo dono em 29/09/2026**, com as saídas coladas no chat e conferidas pelo orquestrador
> (as conferências feitas de fora estão marcadas como tal em cada passo). Resumo: o só-migração foi
> publicado (`origin/main` = `0848b8c`, run `36550036925` verde), backup antes de migrar,
> `db:migrate` com sucesso, a conferência SQL bateu inteira, o código da fase entrou no merge
> `2345850` (run `36587755269` verde) e `/api/health/estoque` responde 200 `{"status":"ok"}`. **O
> Estoque está no ar desde esse merge.**

Siga `docs/operacao/15-migracao-estoque.md`, **na ordem, sem pular**. Aqui você só anota o que cada
passo mostrou (pode colar a saída).

- [ ] **Passo 1 — Guarda** (host, `theo`, `/opt/amassa`, banco `amassa`)
  - **Resultado:** *(29/09/2026)* saída não colada no chat — o dono fez o roteiro e aprovou; o
    Passo 5 conferiu a estrutura nova no banco de produção, o que implica o banco certo. Caixa
    deixada em branco por não haver saída registrada.
- [x] **Passo 2 — Publicar só a migração** (`git log origin/main..main` bateu com a lista do
  `06-11-SUMMARY.md`; `git diff --name-only` com os 4 arquivos; run verde — número do run)
  - **Resultado:** *(29/09/2026, colado no chat)* `git log origin/main..main` = **19 commits** — os
    17 da lista do SUMMARY mais `c4713e1` e `f44f6dc` (os dois só de documentos, previstos no adendo
    do SUMMARY); merge do só-migração em fast-forward; `push` feito; `origin/main` = `0848b8c`; run
    **`36550036925`** verde (20m47s). O SIT-10 subiu junto: `curl … | grep -c 'hidden gap-2 md:flex'`
    = **1**, medido pelo orquestrador (era 0 de manhã).
- [x] **Passo 3 — Backup** (`sucesso = t`, horário de agora, tamanho plausível)
  - **Resultado:** *(29/09/2026)* backup feito antes de migrar — **declaração do dono no chat**; a
    linha de `sucesso`, o horário e o tamanho não foram colados.
- [x] **Passo 4 — `db:migrate`** (`0023_estoque.sql` listada na imagem antes; "Migrações aplicadas
  com sucesso.", código 0)
  - **Resultado:** *(29/09/2026, colado no chat)* `docker compose pull ferramentas`;
    `ls db/migrations | grep 0023_estoque` → `0023_estoque.sql`; `npm run db:migrate` → "Migrações
    aplicadas com sucesso."
- [x] **Passo 5 — Conferência SQL, antes do código** (tabela e 0 movimentações; 3 colunas com os
  padrões; `pode_editar = f` e `pode_apagar = f`; gatilho; índice; "Produção da casa" contada
  `1` (5.5, D-29); `/api/health` 200)
  - **Resultado:** *(29/09/2026, colado no chat)* `movimentacoes_estoque` existe, **0 linhas**;
    `itens_catalogo` com as colunas novas — `ativo` padrão `true` NOT NULL,
    `estoque_minimo_milesimos` padrão `0` NOT NULL, `observacoes` anulável — 14 itens, 14 ativos, 14
    com mínimo zero; `amassa_app`: select `t`, insert `t`, **update `f`, delete `f`**; gatilho
    `travar_unidade_do_item_com_movimentacao` em `itens_catalogo`; índice
    `movimentacoes_estoque_estorno_de_uk`; categoria **"Produção da casa"** contada **1** (custo,
    pecas, ativa); `/api/health` 200.
- [x] **Passo 6 — Publicar o código da fase** (merge sem conflito fora de `.planning/`; run verde —
  número do run)
  - **Resultado:** *(29/09/2026)* `git merge --no-ff gsd/phase-06-estoque` com conflito **só** em
    `.planning/STATE.md`, `ROADMAP.md` e `PROXIMA-SESSAO.md`, resolvido com a versão do branch
    (`--theirs`); merge **`2345850`**; `push` feito. O orquestrador conferiu `git diff
    gsd/phase-06-estoque main` vazio e nenhum marcador de conflito. Run **`36587755269`** verde
    (24m44s).
- [x] **Passo 7 — `/api/health/estoque`** → `200` e `{"status":"ok"}` — **com data e hora**
  - **Resultado:** *(29/09/2026, tarde)* **200 `{"status":"ok"}`** pelo `curl` do dono, confirmado
    de fora pelo orquestrador — junto com `/`, `/api/health` e `/api/health/backup` 200, e
    `/gestao/estoque` → 307 para o login. O Cowork também o mediu 200 às 12h35 (Brasília).

---

## Parte 2 — O celular, no ateliê

> ✅ **Percorrida pelo dono em 29/09/2026 — aprovado no chat, sem anotação por item nem os tempos
> medidos da baixa.** Nas palavras dele: "repassei toda verificação. o cowork tambem verificou.
> Aprovado."
>
> **Evidência independente — a verificação do Cowork** (`Claude outputs/estoque/VERIFICACAO-COWORK-06.md`,
> fora do git): 29/09/2026, 12h35–13h05 de Brasília. **Estático** num clone limpo em `2345850`:
> `lint` 0 avisos, `tsc` limpo, `verificar-acoes` 80 ações e 0 violações, **1627** testes unitários,
> `test:migracoes` passou. **Online**, em produção, 19 passos com um material de teste só
> (`[teste cowork] argila da caminhada`, custo R$ 0,00, desativado no fim), **nenhum 🔴**; provou pelo
> browser os critérios **1, 2, 3, 4, 6, 7, 8 e 9**. O **5** (cronômetro) e a contagem inicial real
> são do dono — o Cowork viu, às 12h35, "Bolo do dia" contado por ele (3 un · R$ 8,00 · saldo
> inicial) e, às 12h46, "2 de 7 contados hoje" (o Bolo do dia e o material de teste).
>
> **As caixas abaixo continuam em branco de propósito:** o dono não relatou item a item. Cada seção
> ganhou uma linha "Registro de 29/09" dizendo o que cobre o item — a aprovação dele e, onde ele o
> fez de fato, o passo do Cowork.
>
> **O que o Cowork deixou em produção** (fica para sempre; tudo com o prefixo `[teste cowork]`): o
> item `[teste cowork] argila da caminhada`, **desativado**, com 7 movimentações e saldo 2,5 kg a R$
> 0,00; as vendas **nº 22** (R$ 2,00) e **nº 23** (R$ 4,00), Pix, **canceladas**; a ficha técnica de
> `[teste cowork] Caneca 300 ml` posta e retirada. Nenhuma compra, orçamento, encomenda ou pessoa.
>
> **O que ele achou que merece um olhar** (nenhum é bloqueio — registrado em `.planning/STATE.md`,
> Pending Todos): custo obrigatório na entrada manual (vazio recusa, 0 aceita); baixa de 2 kg em 5
> toques (atalhos fixos 1 · 5 · 10 · 25); páginas com streaming levando 10–25 s (Início, Histórico,
> Catálogo — do carregamento do `/gestao`, não desta fase); "15h45" nas Anotações do Início talvez
> em UTC; compra de valor 0 lida como "R$ 0,00/un"; busca da Venda por trecho contíguo; as
> decisões `[auto]` das §0.3 e §0.4 ainda sem resposta (a §0.5 também).

Peça **no celular**, de pé, no ateliê. Comece pela contagem: sem ela o Estoque mostra só o painel da
primeira abertura.

### A. A primeira abertura e a contagem inicial real (Passo 8 do roteiro)

- **O que abrir:** `amassacerrado.com.br/gestao/estoque`.
- **O que esperar primeiro:** o painel **"Antes de tudo, conte o que tem na prateleira."** no lugar da
  lista — sem saldos, sem o aviso de acabando, sem a barra de baixo. No Início, o bloco "Estoque
  acabando" diz **"O estoque ainda não foi contado."**
- **O que fazer:** "Começar a contagem" → para cada material, "Contado" e "Custou ao todo" →
  "Confirmar contagem". Pare no meio uma vez, saia e volte: os já contados aparecem com ✓ e
  "N de M contados hoje".
- **O que esperar:** o saldo do sistema só aparece **depois** que você digita ("o saldo passa de X
  para Y") — é a contagem às cegas. Se houve venda entre a publicação e a contagem, o material
  aparece negativo e termina **exatamente** no que você contou.
- [ ] **Resultado:** (quantos materiais contou, e se algo estranhou)
  - *Registro de 29/09:* contagem do dono — quantos materiais ele contou não foi relatado. O Cowork viu, às 12h35, o painel da primeira abertura já resolvido e "Bolo do dia" contado pelo dono (3 un · R$ 8,00 · saldo inicial · 12:35); às 12h46, a tela de contagem dizia "2 de 7 contados hoje" (o Bolo do dia e o material de teste dele) e "Ainda sem contagem · 5 materiais". Coberto pela aprovação do dono; se os outros cinco foram contados depois, não está registrado.

### B. Os 9 critérios do ROADMAP

Copiados de `.planning/ROADMAP.md` §"Phase 6: Estoque". Os critérios 1, 4, 5 e 6 usam o material de
teste — crie-o uma vez, no começo: **"+ Material"** → nome "[teste] argila da caminhada", unidade
**kg**, uma categoria de compra qualquer → "Cadastrar material".

#### 1. Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg

- **O que fazer:** a folha abre em **Entrada** para o material novo → quantidade **5**, "Quanto custou
  ao todo" **0,00** → "Registrar entrada". Depois, no cartão dele, "Dar baixa" → **2** → "Uso do
  ateliê" → "Registrar baixa".
- **O que esperar:** o cartão mostra **3 kg**.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pela verificação do Cowork, passos 1, 3 e 4 — entrada de 5 kg a R$ 0,00, baixa em "Uso do ateliê", o rodapé "O saldo passa de 5 para 3 kg" e o cartão em 3 kg.

#### 2. Item abaixo do mínimo aparece destacado na lista e no bloco "Estoque acabando" do Início

- **O que fazer:** no material de teste, "Histórico" → "Editar" → mínimo **5** → salvar.
- **O que esperar:** na aba Saldos, o cartão com o chip **"Acabando"** e o aviso no topo; a pílula
  "Acabando" filtra só ele (e os reais que estiverem acabando). No **Início**, o bloco "Estoque
  acabando" lista "[teste] argila da caminhada — 3 kg · mínimo 5 kg".
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pelo Cowork, passo 5 — chip "Acabando", banner "1 material está acabando · … · Ver só esses", cartão "mínimo 5 kg" e, no Início, "Estoque acabando · [teste cowork] argila da caminhada · Acabando · 3 kg · mínimo 5 kg".

#### 3. O histórico mostra toda movimentação com autor e data

- **O que abrir:** a aba **Histórico**.
- **O que esperar:** cada linha — a contagem, a entrada, a baixa — com **quem** registrou e
  **quando** (dia e hora de Brasília). As da Andressa com o nome dela.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pelo Cowork, passo 6 — "Hoje, 12:43 · admin" (15:43 UTC, ou seja, hora de Brasília). Linhas com o nome da Andressa não foram vistas: o Cowork entrou como `admin`.

#### 4. Não existe nenhuma forma de editar ou apagar uma movimentação pela interface — só registrar um ajuste

- **O que fazer:** toque, segure e procure, em cada linha do Histórico e na folha do material, algo
  que edite ou apague uma movimentação.
- **O que esperar:** nada — as linhas não são botões. O único jeito de corrigir é "Registrar
  movimentação" → **Ajuste** → "Quanto tem na prateleira agora?". Faça um: no material de teste,
  ajuste para **2,5** → a linha nova aparece como ajuste, e a antiga continua lá.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pelo Cowork, passos 7 e 8 — ajuste igual ao saldo: "O saldo já está certo. Nada será gravado."; ajuste para 2,5 kg: linha nova "−0,5 · Ajuste de conferência" e as anteriores intactas; nenhum botão de editar ou apagar em lugar nenhum.

#### 5. Registrar uma baixa no celular leva menos de 15 segundos — 🔴 com cronômetro (EST-09)

- **O que fazer:** cronômetro na outra mão (ou alguém cronometrando). **A partir da aba Saldos:**
  1. "Dar baixa" no cartão do material de teste;
  2. um atalho de quantidade ("1");
  3. um destino ("Uso do ateliê");
  4. "Registrar baixa".
  São **4 toques**. **A partir do Início** é um toque a mais — a pílula **"Estoque"** antes: **5
  toques**.
- **O que esperar:** menos de **15 s** nos dois caminhos, com a mão como ela fica no ateliê.
- [ ] **Tempo a partir de Saldos:** ____ s  ·  **Tempo a partir do Início:** ____ s
- **Resultado:** *(29/09/2026)* **tempo não registrado — aprovado pelo dono** no chat, sem os dois tempos. O Cowork não cronometrou; contou **4 toques** a partir de Saldos quando a quantidade é um atalho (1 · 5 · 10 · 25) e **5** para 2 kg (passo 4). O e2e da 06-06 prova os 4 toques, não o tempo.

#### 6. O saldo mostrado bate com a soma manual do histórico

- **O que fazer:** no material de teste, "Histórico" (a folha dele). Some as quantidades na mão.
- **O que esperar:** +5 − 2 + o ajuste − 1 (a baixa cronometrada) = o saldo do topo da folha. A folha
  mesma diz que a soma das linhas bate com o saldo.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pelo Cowork, passo 6 — a folha do material diz "Somando de cima para baixo você chega ao saldo de 3 kg".

#### 7. Uma venda lançada no Financeiro baixa o estoque na mesma transação — o item ou, com ficha técnica, cada insumo —, e cancelá-la gera estorno, nunca apaga

- **O que fazer:** em Financeiro → **Venda**, lance uma venda de teste ("[teste]" na descrição) de um
  produto com ficha técnica (um café, por exemplo) **ou** de um item com estoque próprio. Antes de
  lançar, veja o quadro "O que esta venda tira do estoque". Depois, cancele essa venda.
- **O que esperar:** logo depois de lançar, no Estoque, cada insumo da ficha (ou o próprio item)
  baixou a quantidade certa, e o Histórico tem a linha da venda. Depois de cancelar: a linha da venda
  fica, marcada **"Estornada"**, e aparece uma linha nova **"Estorno"** devolvendo o material — nada
  some. O saldo volta ao de antes.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pelo Cowork, passos 10, 11 e 13 — um produto com ficha técnica (`[teste cowork] Caneca 300 ml` gasta 0,5 kg da argila); a venda nº 22 mostrou o quadro "O que esta venda tira do estoque" e gravou "−1 kg · Venda · do Financeiro · venda nº 22"; ao cancelar as nº 22 e 23, linhas novas "Estorno", as originais com o chip "Estornada", o saldo de volta a 2,5 kg.

#### 8. A primeira abertura do Estoque conduz a contagem inicial; vendas e compras anteriores não geram movimentação retroativa

- **O que conferir:** o item A acima (o painel apareceu, e a contagem foi feita por ele); e, no
  Histórico, **nenhuma** linha de venda ou compra com data anterior à publicação da fase.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat), pela conferência SQL do Roteiro 15 (Passo 5: **0 movimentações** logo depois da migração — nada retroativo) e pelo Cowork, passo 15 (a contagem diz "vendas e compras de antes não entram") e o painel da primeira abertura já resolvido pela contagem do dono.

#### 9. Saldo negativo aparece com aviso e nunca impede uma venda

- **O que fazer:** em Financeiro → Venda, monte (sem lançar ainda) uma venda que tire mais do que
  algum material tem — o jeito mais fácil é um item com estoque próprio cujo saldo seja 0.
- **O que esperar:** no quadro "O que esta venda tira do estoque", a linha diz **"fica com −X"**; e,
  **fora** do quadro recolhível, o aviso **"Esta venda deixa {material} com saldo negativo (−X). Pode
  lançar — depois confira a prateleira."** Lance: **a venda é lançada** normalmente. No Estoque, o
  material aparece com o chip **"Saldo negativo"**. Cancele a venda de teste em seguida.
- [ ] **Resultado:**
  - *Registro de 29/09:* coberto pela aprovação do dono em 29/09 (chat) e pelo Cowork, passo 12 — "−2 kg · fica com −0,5 kg" e o aviso "Esta venda deixa [material] com saldo negativo (−0,5 kg). Pode lançar — depois confira a prateleira."; a venda nº 23 foi lançada; no Estoque, o banner "1 material com saldo negativo (−0,5 kg)"; cancelada em seguida (passo 13).

### C. O resto da caminhada

- [ ] **Desativar e reativar.** No material de teste, "Histórico" → "Editar" → "Desativar
  material". Esperado: ele some da lista padrão, do seletor da baixa e do Início; aparece no filtro
  **Desativados** (no fim da lista); não tem "Dar baixa". Reative pela folha dele ("Reativar
  material") e desative de novo — **ele fica desativado ao fim da caminhada.**
  - **Resultado:** *(registro de 29/09)* desativar coberto pela aprovação do dono e pelo Cowork, passos 17 e 18 — recusou com o item na ficha técnica; sem a ficha, a confirmação disse o que se perde, o item sumiu do banner e do Início ("Nenhum material abaixo do mínimo."), apareceu em "Desativados" com o chip e sem "Dar baixa". **Reativar não foi feito pelo Cowork** — só pela aprovação do dono. O material dele ficou desativado.
- [ ] **Um material real no Cadastros.** Em Cadastros → Catálogo, abra um item com movimentação e
  tente trocar a unidade. Esperado: recusa, com "a unidade e o “Tem estoque próprio” não mudam mais.
  Se ele saiu de uso, desative." Nada é apagado — só há "Desativar".
  - **Resultado:** *(registro de 29/09)* coberto pela aprovação do dono e pelo Cowork, passo 9 — no material de teste com movimentação (não num material real), trocar kg→g recusou com "Este item já tem movimentação no Estoque — a unidade e o "Tem estoque próprio" não mudam mais…".
- [ ] **EST-09 com a Andressa, ao mesmo tempo** (backstop). Os dois no mesmo material real, cada um no
  seu celular, contam "já" e tocam "Registrar baixa" juntos. Esperado: **as duas gravam**, o saldo
  reflete as duas baixas, o Histórico tem as duas linhas (uma com cada nome), e a baixa continua
  abaixo de 15 s — a trava do banco dura só a gravação.
  - **Resultado:** *(registro de 29/09)* **não coberto pelo Cowork** — só pela aprovação do dono, sem anotação. A concorrência é provada pelo `test:migracoes` (`conferirConcorrenciaDoEstoque`) e pela 06-02.

### D. As conferências que só um celular de verdade revela (backstops)

A automação provou o comportamento; estas são as de **tela** — texto que quebra, coisa que corta.
Para cada uma: **(a)** confira no celular, com dado real, quando ele existir; ou **(b)** peça ao
agente as capturas a 320px feitas no banco de teste, e marque depois de olhar. As que pedem dado
extremo estão com "(b) recomendado" — fazê-las em produção deixaria dado falso no livro para sempre.

"320px" é a largura do celular mais estreito (iPhone SE). Se o seu for mais largo, a conferência vale
no seu, e a de 320px pode ir pela opção (b).

- [ ] **D1 — A barra de baixo a 320px** (06-06). "Registrar movimentação" pode quebrar em duas linhas;
  nada corta, e o aviso (toast) de uma baixa aparece **acima** da barra, nunca por cima.
  - **Resultado:** *(registro de 29/09)* em parte pelo Cowork, passo 16 — a 320 px, `scrollWidth` = 320 na lista e no diálogo de baixa, nada passa da borda (cosmético: a aba "Para onde foi" quebra em duas linhas). O toast acima da barra não foi registrado. O resto, pela aprovação do dono.
- [ ] **D2 — Seletor com a lista em erro** (06-06) — (b) recomendado: exige forçar a falha da
  consulta. Esperado: com a lista sem carregar, o seletor mostra "Tentar de novo", nunca uma lista
  vazia que pareça "nenhum material".
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork — só pela aprovação do dono; nenhuma captura (b) registrada.
- [ ] **D3 — Vínculo de 160 letras no Histórico** (06-07). Numa baixa do material de teste, destino
  "Perda ou quebra", escreva um "O que aconteceu" longo (até 160 letras). No Histórico, a linha 2
  quebra por palavra, sem cortar.
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork — só pela aprovação do dono.
- [ ] **D4 — Valor alto no "Para onde foi" a 320px** (06-07) — (b) recomendado ("R$ 123.456,78").
  Esperado: o valor não quebra, o nome do destino quebra.
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork — só pela aprovação do dono; nenhuma captura (b) registrada.
- [ ] **D5 — Quantidade longa no Histórico a 320px** (06-07) — (b) recomendado ("−1.234,567 kg").
  Esperado: a coluna da quantidade não corta nem empurra o texto.
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork — só pela aprovação do dono; nenhuma captura (b) registrada.
- [ ] **D6 — O efeito na Venda a 320px** (06-08) — (b) recomendado (nome de 120 letras). Esperado:
  "−2 kg · {nome} · fica com −1 kg" quebra por palavra, sem rolar para o lado.
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork a 320 px (ele viu o efeito na Venda, passos 11 e 12, sem registrar a largura) — só pela aprovação do dono; nenhuma captura (b) registrada.
- [ ] **D7 — O resumo da folha do material a 320px** (06-09). Saldo grande e valores de 6 dígitos:
  a linha de apoio quebra sem cortar. (a) com um material real de valor alto, ou (b).
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork — só pela aprovação do dono.
- [ ] **D8 — "Gasto por" com muitos produtos** (06-09). Um insumo usado em 8 ou mais fichas (a
  argila, talvez): a folha dele lista todos, separados por " · ", sem cortar. (a) se existir, ou (b).
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork com 8+ fichas (ele viu o "Gasto por" com uma, passo 10) — só pela aprovação do dono.
- [ ] **D9 — Sem nenhuma categoria de compra ativa** (06-09, ligado a D-29) — (b) recomendado
  (desativar as categorias em produção quebraria a Compra). Esperado: "+ Novo material" diz
  "Nenhuma categoria de compra ativa — crie uma em Cadastros → Categorias." com o link, e o botão
  fica indisponível com o motivo à vista.
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork — só pela aprovação do dono; nenhuma captura (b) registrada.
- [ ] **D10 — Contagem com 60+ materiais** (06-10). Na tela de contagem, a primeira pintura aparece
  em até 1 s no celular (com o esqueleto antes). (a) se você tiver 60 materiais, ou (b).
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork (7 materiais, não 60) — só pela aprovação do dono.
- [ ] **D11 — A linha da contagem a 320px** (06-10). Com "Custou ao todo" visível (primeira contagem
  acima do saldo), nada corta e o botão "Confirmar contagem" mantém o tamanho de toque.
  - **Resultado:** *(registro de 29/09)* não coberto pelo Cowork a 320 px — só pela aprovação do dono.

---

## Fechamento

- [ ] **Todos os itens acima têm Resultado**, e o material de teste ficou **desativado**.
  - *Registro de 29/09:* caixa em branco — os Resultados da Parte 2 são o registro acima, não
    anotação do dono item a item. O material de teste do Cowork ficou desativado (passo 18); se o
    dono criou um "[teste] argila da caminhada" próprio, não foi relatado.
- **Aprovado?** Responda ao agente "aprovado", com D-23/D-24/D-29 e os dois tempos da baixa — ou diga
  o que falhou e em que passo parou.
- **Resposta (29/09/2026, tarde, no chat):** **aprovado** — "repassei toda verificação. o cowork
  tambem verificou. Aprovado." D-23/D-24/D-29 já tinham sido respondidas de manhã (Parte 0). **Os
  dois tempos da baixa não foram enviados.**
