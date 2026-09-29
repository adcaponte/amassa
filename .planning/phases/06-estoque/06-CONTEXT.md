# Phase 6: Estoque - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

> **Como esta discussão aconteceu — leia antes das decisões.** Discussão feita em `--auto` durante a
> noite de 29/09/2026, com o dono dormindo, sob autorização dele em chat: *"vai seguindo. jaja eu
> acordo. roda o maximo que puder em opçoes recomendadas."* Em modo automático o orquestrador escolhe
> a opção recomendada em cada ponto, sem perguntar. Por isso as decisões abaixo estão separadas em
> duas classes, e a diferença importa:
>
> - **Travadas pelo dono** — vêm do `ADENDO.md` de 20/09, que ele revisou e aprovou ("onde este adendo
>   contradiz o briefing de 18/09, o adendo vence"). Não reabrir.
> - **`[auto]`** — escolhidas pelo orquestrador como a opção recomendada, cada uma com o porquê e a
>   alternativa descartada. **O dono pode desfazer qualquer uma ao acordar.** Estão listadas também em
>   "Decidido sem o Theo", no topo de `.planning/STATE.md`.

<domain>
## Phase Boundary

Saber o que existe, o que está acabando e para onde o material foi — com o saldo **sempre derivado
das movimentações**, nunca uma coluna editável. O Estoque **não tem cadastro próprio**: trabalha sobre
os itens de `itens_catalogo` (Fase 04.4) com `controla_estoque`, acrescenta a eles só o que é dele
(mínimo, observações), e passa a **gravar** o efeito que a Fase 04.4 só **mostra**: toda venda e toda
compra lançadas no Financeiro movimentam o estoque na mesma transação do documento.

Entregas: as três abas do protótipo (Saldos · Histórico · Para onde foi) com as áreas do Financeiro no
lugar das "frentes"; entrada, saída e ajuste pensados para o celular; a contagem geral (primeira
abertura e inventário); venda e compra gravando movimentação; estorno no cancelamento; o bloco
"Estoque acabando" do Início alimentado de verdade; a categoria "Peça pronta".

Fora desta fase: entrada automática pela Produção (a origem `producao` existe no modelo, mas nada a
produz até o redesenho da Produção); consignação; vínculo de aula como referência real (só quando a
Agenda existir); cadastro de embalagem.

</domain>

<decisions>
## Implementation Decisions

### Travado pelo dono no ADENDO de 20/09 — não reabrir
- **D-01:** 🔴 **Não existe tabela de materiais.** O Estoque se apoia em `itens_catalogo` e
  `ficha_tecnica` (04.4). "Novo material" no Estoque cria um item do catálogo com
  `controla_estoque = true`, com a mesma validação do Cadastros; item criado pelo Cadastros com
  `controla_estoque` aparece no Estoque sozinho (ADENDO §1). O Estoque acrescenta ao item só
  **mínimo** e **observações** (§1).
- **D-02:** A origem de toda movimentação é `venda` · `compra` · `producao` · `manual` (§3).
- **D-03:** Venda e compra gravam a movimentação **na mesma transação do documento**, usando o cálculo
  que `lib/financeiro/efeito-estoque.ts` já faz — **sem recalcular por outro caminho** (§3). Venda:
  item com ficha técnica baixa cada insumo (quantidade × linha); senão, item com `controla_estoque`
  baixa ele mesmo. Compra: entra `quantidade_estoque`, custo unitário = valor da linha ÷ quantidade.
- **D-04:** Cancelar venda ou compra gera **movimentação de estorno** com a mesma referência; nada é
  apagado (§3). O cancelamento de documento já é suave hoje (`documentos.cancelado_em/por`).
- **D-05:** Vendas e compras lançadas **antes** de o Estoque existir **não** geram movimentação
  retroativa. O Estoque começa por **contagem** (§3). O estoque inicial **não** vem de importação da
  Abertura (§6).
- **D-06:** Saldo negativo é permitido **com aviso** e **nunca bloqueia uma venda** (§3).
- **D-07:** Cada saída grava o **custo médio do instante** do lançamento; no cálculo, dinheiro em
  centavos inteiros e quantidade em milésimos inteiros, como a 04.4 já faz (§4).
- **D-08:** O item-insumo mostra onde é gasto pela ficha técnica ("gasto por: Café 200 ml (15 g), …");
  editar a ficha continua em Cadastros → Catálogo (§4).
- **D-09:** Categoria **"Peça pronta"** (área Peças): itens vendáveis com estoque; até a Produção ser
  redesenhada, a entrada é manual, informando o custo (§4).
- **D-10:** O bloco **"Estoque acabando"** do Início passa a ser alimentado por `lib/estoque/consultas`
  (§4). Hoje `components/amassa/inicio/bloco-estoque.tsx` é um estado vazio estático.
- **D-11:** Continuam **exatamente** como no protótipo (§5): três abas (Saldos · Histórico · Para onde
  foi) · banner de alerta · sanfona e busca ao registrar · folha única com o rodapé "o saldo passa de X
  para Y" · **movimentação nunca é editada nem apagada** · **ajuste pergunta o saldo contado** e
  diferença zero não grava · mínimo zero nunca alerta · **baixa em 4 toques** · o custo entra pela
  entrada ("quanto custou ao todo") · remover item com movimentação pede confirmação dizendo o que se
  perde, e item do catálogo usado em venda é **desativado em vez de apagado**.

### As frentes viram as áreas do Financeiro
- **D-12 (travado, §2):** A "frente" do protótipo (Ateliê · Loja · Cafeteria) é substituída pela
  **área do Financeiro** (Cafeteria · Espaço · Peças · Loja · Geral) **em todo lugar** onde o protótipo
  a usa — o filtro da lista de saldos, o campo obrigatório "Para onde foi?" da saída ("é o que diz qual
  frente pagou"), a aba "Para onde foi" e os estados vazios. A área do item vem da categoria de compra
  e, na falta, da de venda. As categorias próprias do protótipo (Cerâmica, Pintura, Papelaria…) caem.
- **D-13 `[auto]` — ADENDO §7.1:** **Sem um segundo filtro "só insumos / só o que se vende"** nesta
  fase. O filtro é a área, mais a busca (EST-12).
  - *Por quê:* na prática a área já separa — o que o protótipo chamava de "Ateliê" são os itens de
    Peças e Espaço que não aparecem na venda. Um terceiro controle na lista do celular custa toque
    contra a baixa em 4 toques e os 15 s do EST-09. E acrescentá-lo depois é barato: é derivável de
    `aparece_na_venda`, sem estrutura nova.
  - *Alternativa descartada:* um alternador "insumos / vendáveis" ao lado do filtro de área.
- **D-14 `[auto]`:** Área de cada destino manual da saída — o protótipo já usava nome de área do
  Financeiro em três (aula → **Espaço**, encomenda → **Peças**, cafeteria → **Cafeteria**); os dois
  que iam para "Ateliê produtivo" (**uso do ateliê**, **perda ou quebra**) vão para **Peças**.
  - *Por quê:* o adendo diz que cada destino "continua carregando a área que consome, agora com os
    nomes do Financeiro", e que "Ateliê" corresponde a Peças. É a leitura mais fiel.
  - *Alternativa descartada:* "perda ou quebra" cobrada da área do **próprio item** (uma xícara da
    cafeteria quebrada iria para Cafeteria). Mais precisa em alguns casos, mas contraria o protótipo,
    que cobra toda perda do ateliê produtivo. Se o dono preferir, é trocar um mapeamento.

### Destinos da saída manual (travado, §3)
- **D-15:** Os destinos são: consumo em aula (**texto livre** até a Agenda existir) · consumo em
  encomenda (**referência opcional à encomenda real**, não texto livre) · consumo na cafeteria (só o que
  **não** passa por venda — degustação, consumo interno; o vendido com ficha técnica já baixa pela
  venda) · uso do ateliê · perda ou quebra. **"Venda na loja" sai da lista** e some o aviso provisório
  do protótipo: venda só nasce no Financeiro.

### Contagem: primeira abertura e inventário
- **D-16 `[auto]` — ADENDO §7.3:** **Existe uma tela de contagem geral**, além do ajuste item a item
  do protótipo, que continua.
  - *Por quê:* o §3 do adendo exige que a **primeira abertura conduza a contagem inicial** de todos os
    itens — e isso é, por natureza, uma contagem de muitos itens de uma vez. O protótipo não desenha
    esse fluxo (o único "primeira" nele é um estado vazio de categoria). Uma tela resolve as duas
    necessidades: a contagem inicial agora e o inventário periódico depois.
  - *Alternativa descartada:* só o ajuste item a item — obrigaria a contagem inicial a ser feita item
    por item pela folha de ajuste, sem visão do todo nem de quem já foi contado.
- **D-17 `[auto]`:** Na **primeira abertura**, a contagem geral roda em modo **"saldo inicial"**: para
  cada item, a quantidade contada e "quanto custou ao todo" viram uma **entrada manual com custo**
  (D-05, D-11). Item deixado em branco não é tocado. **Refinado pela pesquisa (29/09):** a entrada
  grava a **diferença** entre o contado e o saldo do instante — se já houver movimentação antes da
  contagem (uma venda entre o deploy e a contagem), o saldo termina exatamente no contado. A tela diz
  "o saldo passa de −2 para 10", que é a regra do rodapé do protótipo (06-RESEARCH.md, Pitfall 3).
- **D-18 `[auto]`:** Depois da primeira, a contagem geral roda em modo **inventário**: cada item contado
  com diferença gera um **ajuste** com a semântica de EST-07/EST-08 (pede o saldo contado; diferença
  zero não grava). **Cada item grava ao ser confirmado** — não existe rascunho de contagem.
  - *Por quê:* sem estado de rascunho não há o que perder numa contagem interrompida, e o ajuste
    calcula a diferença contra o saldo **do instante da gravação** — uma venda feita no meio da
    contagem continua correta.
  - *Alternativa descartada:* contagem como rascunho aplicado de uma vez no fim — exigiria tabela de
    rascunho e ficaria errada se houvesse venda entre o início e o fim da contagem.

### Conversão de unidade na compra
- **D-19 `[auto]` — ADENDO §7.2:** **Digitar a quantidade já convertida** para a unidade de controle
  do item (comprou um saco de 25 kg de argila controlada em kg → digita 25). **Sem cadastro de
  embalagem.**
  - *Por quê:* é a proposta do próprio adendo, e **não exige estrutura nova**: o campo onde se digita
    isso já existe — `documento_linhas.quantidade_estoque`, no formulário de compra da 04.4.
  - *Alternativa descartada:* cadastrar embalagem por item (saco = 25 kg, caixa = 12 un) com conversão
    automática — tabela nova, mais tela no Cadastros, e ganho só quando digitar a conversão incomodar de
    verdade. Fica em "Deferred Ideas".

### Desativar em vez de apagar
- **D-20 `[auto]`:** Item do catálogo com movimentação ou usado em venda é **desativado, nunca
  apagado** (D-11 manda; o como é esta decisão): coluna `ativo` em `itens_catalogo`, no **mesmo padrão**
  de `categorias.ativa` e `contas_fixas.ativa` (ações `definirCategoriaAtiva`/`definirContaFixaAtiva`).
  Desativado: some dos seletores de Venda e de Compra e da lista padrão do Estoque; continua no
  histórico e nos relatórios; pode ser reativado. A lista de saldos ganha o filtro
  **Ativos · Desativados · Todos**, como o das Queimas (`components/amassa/queimas/filtro-fornos.tsx`).
  ~~Item **sem** movimentação e **sem** venda pode ser apagado, com confirmação dizendo o que se perde.~~
  **Corrigido pela pesquisa (29/09): nesta fase o item só se DESATIVA, nunca se apaga.** O banco já
  proíbe apagar de `itens_catalogo` — `revoke delete` para `amassa_app` desde a migração `0015`, regra
  FNC-10 do dono — e `scripts/testar-migracoes.mjs` afirma essa proibição. Liberar o apagar mexeria
  numa garantia dele; desativar cobre tudo o que o D-11 pede. Apagar fica para quando ele confirmar.
  — **Reversibility:** costly — a coluna nova entra por migração; enquanto a migração estiver só
  escrita e versionada é trivial desfazer, e ela só vira definitiva quando o dono a aplica à mão depois
  de backup (regra do projeto), que é o momento natural de revisar.
  - *Por quê:* hoje o catálogo só tem criar e editar — nenhum apagar, nenhum desativar. Seguir o padrão
    que o projeto já usa em dois lugares é a opção de menor surpresa.

### Aviso de saldo negativo
- **D-21 `[auto]`:** O aviso de saldo negativo (D-06) aparece em três lugares, **nunca bloqueando**:
  na pré-visualização que o painel de Venda já mostra ("O que esta venda tira do estoque"), como "fica
  com −X"; na lista de saldos; e no bloco "Estoque acabando" do Início. **Refinado pela pesquisa
  (29/09):** saldo negativo é um **aviso próprio** ("saldo negativo"), **separado** de "abaixo do
  mínimo" — assim o EST-04 ("mínimo zero nunca alerta", travado) continua literalmente verdadeiro. O
  bloco do Início mostra os dois, com rótulos diferentes.

### Custo da Peça pronta
- **D-22 `[auto]`:** A entrada manual de uma Peça pronta **preenche o custo** a partir da ficha de
  precificação ligada ao item (`fichas_precificacao.item_catalogo_id`), quando houver; o valor é
  editável. Sem ficha, o campo vem vazio e é obrigatório.
  - *Por quê:* o §4 do adendo diz "informando o custo — o da ficha de precificação, quando houver";
    preencher é a leitura que poupa digitação sem tirar o controle.

### Refinamentos da pesquisa — decisões novas `[auto]` (29/09/2026)
Cada uma resolve uma questão que a pesquisa (`06-RESEARCH.md`, "Open Questions" e "Assumptions Log")
deixou aberta, pela opção que ela recomendou.

- **D-23 `[auto]` — valor do estorno de VENDA:** o estorno devolve o material **ao custo que a venda
  levou**, não ao custo de hoje. É o espelho exato da saída: o "Para onde foi" de uma venda cancelada
  zera certinho, e a regra é simples de explicar. (Assumption A4.)
- **D-24 `[auto]` — valor do estorno de COMPRA:** o estorno sai **ao custo médio corrente**, não ao
  custo original da compra. **Não é preferência, é correção:** devolver ao custo original pode deixar o
  estoque com **valor negativo e quantidade positiva** quando houve consumo entre a compra e o
  cancelamento — contraexemplo na pesquisa (Pergunta 3): 10 un a R$ 0,01, compra 1 un a R$ 10,00,
  saem 5, cancelar a compra ao custo original deixa o valor negativo. Ao custo corrente o invariante
  `sinal(valor) ∈ {sinal(quantidade), 0}` nunca quebra; o preço é o médio não "desmisturar" a compra
  cancelada. (Assumption A3.)
  — **Reversibility:** reversible — é um ramo do módulo puro `lib/estoque/custo.ts`, coberto por teste.
  > 🔴 **D-23 e D-24 são as únicas decisões desta fase que tocam o valor do cancelamento.** A regra do
  > dono manda não decidir sozinho regra de cancelamento que ele não decidiu. Adotadas mesmo assim
  > porque **nada da Fase 06 chega à produção sem ele**: o código fica num branch separado e a
  > migração só ele aplica — ele revisa antes do merge. Estão no topo da lista dele para confirmar.
- **D-25 `[auto]` — algoritmo de custo:** **custo médio móvel**, com os grampos do ERPNext para
  estoque negativo, exatamente como a pesquisa especifica (Pergunta 3: regras R1–R6, a tabela de sete
  casos com números, arredondamento meio-para-cima em `BigInt`). Mora em `lib/estoque/custo.ts`,
  puro. Cada movimentação grava o seu `valor_centavos`; o histórico mostra o valor da nota
  (`valor_informado_centavos`) quando ele difere (entrada com saldo negativo reprecifica).
- **D-26 `[auto]`:** Saída com saldo zero usa o custo da **última entrada com preço**; sem nenhuma,
  custo zero (aparece como R$ 0,00 no "Para onde foi"). (Assumption A5.)
- **D-27 `[auto]` — área que "paga" cada movimentação:** a **área do item** (filtro da lista, D-12) vem
  da categoria de **compra** primeiro, e da de venda na falta — como o adendo §2 manda. A pesquisa
  achou que `areaDoItem` de hoje faz o contrário (venda primeiro): o Estoque usa a ordem do adendo,
  **sem alterar** a atribuição que o Financeiro já faz. Já a baixa **por venda** é paga pela área da
  **categoria de venda da linha** — é quem vendeu. (Assumption A6.)
- **D-28 `[auto]`:** `saldo <= mínimo` conta como acabando — igual ao protótipo
  (`prototipo.html:607-608`). (Assumption A7.)
- **D-29 `[auto]` — "Peça pronta":** identificada pela **ficha de precificação ligada**
  (`fichas_precificacao.item_catalogo_id`), não por nome de categoria. A pesquisa achou que item com
  estoque exige categoria de **compra** (grupo custo/geral), e a semente só tem "Peças prontas" como
  categoria de **venda** — peça produzida não tem categoria de compra natural. **Pergunta para o dono,
  não decidida:** se quer uma categoria de compra própria semeada para a produção da casa.
- **D-30 `[auto]`:** Compra paga depois com valor diferente do lançado: o custo do estoque é o **da
  nota lançada**; nenhuma movimentação de correção de custo nesta fase. Registrado. (Pesquisa, Pitfall 14.)
- **D-31 `[auto]` — "Para onde foi" inclui as vendas:** a baixa por venda aparece como barra própria,
  **"Vendido · pelo Financeiro"**, com a área da linha — é consumo real de insumo. "Venda na loja" segue
  fora das saídas **manuais** (D-15).
- **D-32 `[auto]` — contagem com saldo zero:** a contagem e o ajuste aceitam **zero** como saldo
  contado (prateleira vazia). A pesquisa achou que `converterQuantidade` de hoje recusa zero; o
  Estoque precisa aceitá-lo.

### Ordem de publicação — 🔴 obrigatória
- **D-33:** A gravação de movimentação vai **dentro** da transação da venda e da compra. **Se esse
  código chegar à produção antes da migração, TODA venda e toda compra de material quebram** — não um
  bloco isolado, o lançamento inteiro. A migração da fase só **acrescenta** (tabela nova, colunas com
  padrão, `grant`s), então é segura com o código antigo. **A ordem é: backup → aplicar a migração →
  só então publicar o código.** O último plano da fase (o portão humano) escreve o roteiro nessa ordem.
  Enquanto isso, o código da fase vive **fora de `main`**, num branch próprio, para que um `git push`
  de rotina em `main` nunca o publique antes da hora. (06-RESEARCH.md, Pitfall 1.)

### Claude's Discretion
Decisões técnicas que o dono não precisa ver — ficam com a pesquisa e o planejamento:
- Onde moram `minimo`, `observacoes` e `ativo`: colunas em `itens_catalogo` (recomendado — o adendo diz
  "acrescenta **ao item**", e `ativo` espelha `categorias.ativa`) ou tabela 1:1.
- Desenho da tabela de movimentações, índices, e se o saldo derivado é consulta ou view.
- Como a referência do estorno aponta para a movimentação original e para o documento.
- O cálculo do custo médio ponderado, inclusive o caso de borda de entrada com saldo negativo.
- Qualquer migração é **escrita e versionada, nunca aplicada** — aplicação é do dono, à mão, depois de
  backup (`.claude/CLAUDE.md`), e `TABELAS_ESPERADAS` em `scripts/testar-migracoes.mjs` é atualizada.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação da fase
- `.planning/phases/06-estoque/06-RESEARCH.md` — **ler antes de planejar**: as sete perguntas de
  integração respondidas pelo código (arquivo e linha), o algoritmo de custo com os sete casos, a
  concorrência (`for("no key update")`, não `for("update")`), e os 16 pitfalls — o 1 é a ordem de
  publicação (D-33).
- `.planning/phases/06-estoque/ADENDO.md` — **vence o briefing de 18/09 onde o contradiz.** §1 o
  catálogo único, §2 frentes × áreas, §3 origens e destinos, §4 o que é novo, §5 o que continua, §6
  correções de planejamento, §7 os três pontos em aberto (decididos acima em D-13, D-16..D-19).
- `.planning/phases/06-estoque/prototipo.html` — telas e fluxo aprovados em 18/09 e revistos pelo
  dono em 20/09. **O protótipo vence sobre a interface; o adendo vence sobre regra de dado.** Onde o
  protótipo diz "frente", ler "área do Financeiro" (D-12); "Venda na loja" não existe (D-15).

### O que a Fase 04.4 deixou pronto (e o Estoque troca de "mostrar" para "gravar")
- `.planning/phases/04.4-financeiro-parte-1/BRIEFING.md` §6 — o contrato do efeito no estoque.
- `.planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md` — decisões do Financeiro parte 1.
- `lib/financeiro/efeito-estoque.ts` — o cálculo puro e testado que a venda e a compra já exibem.

### Planejamento
- `.planning/REQUIREMENTS.md` §"Estoque" — **EST-01 a EST-21** (EST-02/03/04/11/12 corrigidos e
  EST-13..21 acrescentados em 29/09 pela §6 do adendo, commit `0f03508`).
- `.planning/ROADMAP.md` §"Phase 6: Estoque" — objetivo e os 9 critérios de sucesso.

### Regras do projeto
- `.claude/CLAUDE.md` — `exigirUsuario()` na primeira linha de toda Server Action; Zod no servidor;
  regra de negócio em módulo puro e testado (`lib/estoque/saldo.ts` é citado ali pelo nome);
  migração aplicada à mão; `TABELAS_ESPERADAS`; estados vazio/carregando/erro em toda tela; nada de
  exclusão silenciosa; alvos de 44px; o custo do e2e.
- Fora do git, só neste computador: `ESTADO-ATUAL.md` §3 — o que do briefing de 18/09 continua
  valendo (o briefing em si não está no repositório).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/financeiro/efeito-estoque.ts` (`efeitoNoEstoque`, `formatarEfeito`): o cálculo de venda e compra.
  Hoje chamado por `components/amassa/financeiro/painel-venda.tsx`, `painel-despesa.tsx`,
  `lib/financeiro/consultas.ts` e `lib/cadastros/catalogo.ts`. A Fase 6 grava o que ele calcula.
- `db/schema.ts`: `itens_catalogo` (tem `controla_estoque`, `unidade`, `categoria_compra_id`,
  `categoria_venda_id`, `aparece_na_venda`; **não tem** `minimo`, `observacoes` nem `ativo`),
  `ficha_tecnica` (`quantidade` numeric(12,3)), `categorias` (`area`, `ativa`), `documento_linhas`
  (`quantidade_estoque` numeric(12,3) — o campo da conversão, D-19), `documentos`
  (`cancelado_em`/`cancelado_por` — o gatilho do estorno), `fichas_precificacao` (`item_catalogo_id` —
  o custo da Peça pronta, D-22).
- Enum `unidade_estoque`: `un`, `g`, `kg`, `ml`, `l`, `m`.
- `components/amassa/inicio/bloco-estoque.tsx`: hoje estado vazio estático, sem consulta; ganha a
  consulta real e o `try`/`catch` próprio do padrão do Início (cada bloco no seu `Suspense`).
- `components/amassa/queimas/filtro-fornos.tsx`: o filtro Ativos · Desativados · Todos a imitar (D-20).
- `lib/cadastros/acoes.ts`: `definirCategoriaAtiva`, `definirContaFixaAtiva` — o padrão de ativar e
  desativar a imitar; `criarItem`/`editarItem` — a validação que "Novo material" reusa (D-01).

### Established Patterns
- Dinheiro em centavos inteiros; quantidade em milésimos no cálculo (04.4).
- Regra de negócio em módulo puro em `lib/<modulo>/`, sem React nem cliente do banco.
- Toda rota da plataforma vive sob `/gestao` e passa por `rotaDeGestao(...)` — o portão
  `tests/unit/sem-rota-antiga.test.ts` barra literal de rota antiga.
- Drizzle embrulha o SQLSTATE: o código do Postgres está em `erro.cause.code`, nunca em `erro.code`.
- Cada bloco do Início em seu próprio `Suspense`, com vazio, carregando e erro próprios (GES-08).

### Integration Points
- A transação de lançamento de venda e de compra no Financeiro — onde a movimentação passa a ser
  gravada (D-03).
- O cancelamento de documento — onde nasce o estorno (D-04).
- O painel de Venda — onde aparece o aviso de "fica com −X" (D-21).
- O Cadastros → Catálogo — onde "Novo material" e o filtro de ativos encostam (D-01, D-20).
- O bloco "Estoque acabando" do Início (D-10).
- Navegação: o Estoque **não está na barra de baixo** (Fase 04.6: Início · Financeiro · Produção ·
  Agenda) — chega-se a ele pelo índice e pelas pílulas do Início e pela lateral. Conta para a baixa em
  4 toques e os 15 s do EST-09.

</code_context>

<specifics>
## Specific Ideas

- O rodapé da folha de movimentação diz **"o saldo passa de X para Y"** (§5) — é o que dá confiança de
  que a baixa foi a certa antes de gravar.
- O campo "Para onde foi?" é **obrigatório** na saída: é ele que diz qual área pagou (protótipo).
- A primeira abertura do Estoque **não é uma tela vazia**: ela conduz a contagem inicial (D-16, D-17).

</specifics>

<deferred>
## Deferred Ideas

- **Cadastro de embalagem com conversão automática** (saco = 25 kg, caixa = 12 un) — se digitar a
  quantidade convertida (D-19) incomodar no uso real.
- **Filtro "só insumos / só o que se vende"** — se o filtro por área (D-13) não bastar; derivável de
  `aparece_na_venda`.
- **Vínculo da saída com uma fornada** — o EST-11 antigo previa; o adendo não o lista entre os destinos
  e ele saiu em 29/09. Pode voltar com o redesenho das Queimas (item 7 da fila).
- **Entrada automática de Peça pronta pela Produção** (origem `producao`) — quando a Produção for
  redesenhada (item 5 da fila).
- **Aula como referência real** na saída — quando a Agenda existir (item 6 da fila).
- **Consignação** (repasse ao dono da peça) — fora de escopo pelo §4 do adendo.

</deferred>

---

*Phase: 06-estoque*
*Context gathered: 2026-09-29*
