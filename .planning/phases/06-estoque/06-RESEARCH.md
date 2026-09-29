# Phase 06: Estoque - Research

**Researched:** 2026-09-29
**Domain:** Livro de movimentações imutável em Postgres (Drizzle), custo médio ponderado em
inteiros, gravação na mesma transação do documento do Financeiro, travas de linha contra corrida
e deadlock, e as telas de celular do protótipo aprovado — tudo dentro do Next.js 16 / React 19 /
Drizzle 0.45 já em produção, sem pacote novo.
**Confidence:** HIGH nas sete perguntas de integração (cada uma respondida lendo o código nesta
sessão, com arquivo e linha); MEDIUM no algoritmo de custo médio (derivado do comportamento do
ERPNext e provado por exemplos numéricos aqui, mas nenhuma regra dele foi decidida pelo dono); LOW
nas quatro tensões de produto listadas em "Open Questions".

<user_constraints>
## User Constraints (from CONTEXT.md)

> **Como esta discussão aconteceu.** Discussão feita em `--auto` durante a noite de 29/09/2026, com
> o dono dormindo, sob autorização dele em chat. Duas classes de decisão: **travadas pelo dono**
> (vêm do `ADENDO.md` de 20/09, que ele revisou e aprovou — não reabrir) e **`[auto]`** (escolhidas
> pelo orquestrador como a opção recomendada; **o dono pode desfazer qualquer uma ao acordar**;
> listadas também em "Decidido sem o Theo", no topo de `.planning/STATE.md`).

### Locked Decisions

#### Travado pelo dono no ADENDO de 20/09 — não reabrir
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

#### As frentes viram as áreas do Financeiro
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

#### Destinos da saída manual (travado, §3)
- **D-15:** Os destinos são: consumo em aula (**texto livre** até a Agenda existir) · consumo em
  encomenda (**referência opcional à encomenda real**, não texto livre) · consumo na cafeteria (só o que
  **não** passa por venda — degustação, consumo interno; o vendido com ficha técnica já baixa pela
  venda) · uso do ateliê · perda ou quebra. **"Venda na loja" sai da lista** e some o aviso provisório
  do protótipo: venda só nasce no Financeiro.

#### Contagem: primeira abertura e inventário
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
  (D-05, D-11). Item deixado em branco não é tocado.
- **D-18 `[auto]`:** Depois da primeira, a contagem geral roda em modo **inventário**: cada item contado
  com diferença gera um **ajuste** com a semântica de EST-07/EST-08 (pede o saldo contado; diferença
  zero não grava). **Cada item grava ao ser confirmado** — não existe rascunho de contagem.
  - *Por quê:* sem estado de rascunho não há o que perder numa contagem interrompida, e o ajuste
    calcula a diferença contra o saldo **do instante da gravação** — uma venda feita no meio da
    contagem continua correta.
  - *Alternativa descartada:* contagem como rascunho aplicado de uma vez no fim — exigiria tabela de
    rascunho e ficaria errada se houvesse venda entre o início e o fim da contagem.

#### Conversão de unidade na compra
- **D-19 `[auto]` — ADENDO §7.2:** **Digitar a quantidade já convertida** para a unidade de controle
  do item (comprou um saco de 25 kg de argila controlada em kg → digita 25). **Sem cadastro de
  embalagem.**
  - *Por quê:* é a proposta do próprio adendo, e **não exige estrutura nova**: o campo onde se digita
    isso já existe — `documento_linhas.quantidade_estoque`, no formulário de compra da 04.4.
  - *Alternativa descartada:* cadastrar embalagem por item (saco = 25 kg, caixa = 12 un) com conversão
    automática — tabela nova, mais tela no Cadastros, e ganho só quando digitar a conversão incomodar de
    verdade. Fica em "Deferred Ideas".

#### Desativar em vez de apagar
- **D-20 `[auto]`:** Item do catálogo com movimentação ou usado em venda é **desativado, nunca
  apagado** (D-11 manda; o como é esta decisão): coluna `ativo` em `itens_catalogo`, no **mesmo padrão**
  de `categorias.ativa` e `contas_fixas.ativa` (ações `definirCategoriaAtiva`/`definirContaFixaAtiva`).
  Desativado: some dos seletores de Venda e de Compra e da lista padrão do Estoque; continua no
  histórico e nos relatórios; pode ser reativado. A lista de saldos ganha o filtro
  **Ativos · Desativados · Todos**, como o das Queimas (`components/amassa/queimas/filtro-fornos.tsx`).
  Item **sem** movimentação e **sem** venda pode ser apagado, com confirmação dizendo o que se perde.
  — **Reversibility:** costly — a coluna nova entra por migração; enquanto a migração estiver só
  escrita e versionada é trivial desfazer, e ela só vira definitiva quando o dono a aplica à mão depois
  de backup (regra do projeto), que é o momento natural de revisar.
  - *Por quê:* hoje o catálogo só tem criar e editar — nenhum apagar, nenhum desativar. Seguir o padrão
    que o projeto já usa em dois lugares é a opção de menor surpresa.

#### Aviso de saldo negativo
- **D-21 `[auto]`:** O aviso de saldo negativo (D-06) aparece em três lugares, **nunca bloqueando**:
  na pré-visualização que o painel de Venda já mostra ("O que esta venda tira do estoque"), como "fica
  com −X"; na lista de saldos, destacado junto com os abaixo do mínimo; e no bloco "Estoque acabando"
  do Início, onde saldo negativo conta como acabando.

#### Custo da Peça pronta
- **D-22 `[auto]`:** A entrada manual de uma Peça pronta **preenche o custo** a partir da ficha de
  precificação ligada ao item (`fichas_precificacao.item_catalogo_id`), quando houver; o valor é
  editável. Sem ficha, o campo vem vazio e é obrigatório.
  - *Por quê:* o §4 do adendo diz "informando o custo — o da ficha de precificação, quando houver";
    preencher é a leitura que poupa digitação sem tirar o controle.

### Claude's Discretion
Decisões técnicas que o dono não precisa ver — ficam com a pesquisa e o planejamento:
- Onde moram `minimo`, `observacoes` e `ativo`: colunas em `itens_catalogo` (recomendado — o adendo diz
  "acrescenta **ao item**", e `ativo` espelha `categorias.ativa`) ou tabela 1:1.
- Desenho da tabela de movimentações, índices, e se o saldo derivado é consulta ou view.
- Como a referência do estorno aponta para a movimentação original e para o documento.
- O cálculo do custo médio ponderado, inclusive o caso de borda de entrada com saldo negativo.
- Qualquer migração é **escrita e versionada, nunca aplicada** — aplicação é do dono, à mão, depois de
  backup (`.claude/CLAUDE.md`), e `TABELAS_ESPERADAS` em `scripts/testar-migracoes.mjs` é atualizada.

### Deferred Ideas (OUT OF SCOPE)
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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EST-01 | 5 kg de argila, baixa de 2 kg, saldo exatamente 3 kg | Quantidade em milésimos inteiros, saldo = `SUM` (§Padrão 1); exemplo numérico 1 da tabela de custo |
| EST-02 | Sem cadastro próprio; mínimo e observações no item; saldo e custo médio derivados | Colunas novas em `itens_catalogo`; saldo e valor como `SUM` sobre movimentações imutáveis (§Padrão 1, §Padrão 2) |
| EST-03 | Abaixo do mínimo destacado na lista e no bloco do Início | `lib/estoque/saldo.ts::situacaoDoSaldo` + `listarSaldos()`; molde do bloco do Início (§Pergunta 7) |
| EST-04 | Mínimo zero nunca alerta | Regra pura, mesma do protótipo (`prototipo.html:607-608`); ver Open Question 2 (tensão com D-21) |
| EST-05 | Histórico com autor, data e tipo | `registrado_por` → `usuarios.nome`; `criado_em`; `tipo` (§Padrão 1) |
| EST-06 | Nenhuma forma de editar/apagar movimentação | Nenhuma ação de `update`/`delete` + `revoke update, delete ... from amassa_app` (antecipado pela própria `0003`, linhas 2-4) + teste em `test:migracoes` |
| EST-07 | Ajuste pede saldo contado | `planejarAjuste` puro; campo aceita **zero** (Pitfall 9: `converterQuantidade` recusa zero) |
| EST-08 | Diferença zero não grava, "Conferido. O saldo já estava correto." | Decidido **sob a trava**, dentro da transação (§Pergunta 5) |
| EST-09 | Baixa no celular < 15 s | Folha única do protótipo; orçamento de toques contado a partir do Início (Pitfall 12); verificação humana no fim da fase |
| EST-10 | Saldo bate com a soma manual do histórico | Saldo é literalmente `SUM(quantidade_milesimos)`; teste de migração/e2e compara as duas contas |
| EST-11 | Origens `venda`/`compra`/`producao`/`manual`; os cinco destinos manuais | Enums novos `origem_movimentacao` e `destino_saida`; `encomenda_id` opcional (§Padrão 1, Pitfall 10) |
| EST-12 | Busca e filtro por área (compra → venda → geral) | **Não** reusar `areaDoItem` — ele prefere a de VENDA (Pitfall 5) |
| EST-13 | "Novo material" cria item de catálogo com a validação do Cadastros | Reusar `esquemaItem` + validadores de categoria movidos para módulo não-"use server" (Pitfall 7) |
| EST-14 | Venda grava movimentação na mesma transação, via `efeitoNoEstoque` | Ponto exato de inserção em `lancarVenda` (§Pergunta 1); chamada **por linha** (§Padrão 3) |
| EST-15 | Compra dá entrada na mesma transação, custo = valor ÷ quantidade | Ponto exato em `lancarDespesa`; guardar o valor da linha, não o unitário arredondado (§Pergunta 1) |
| EST-16 | Cancelar gera estorno com a mesma referência | Dentro de `cancelarDocumento`, depois da trava do documento (§Pergunta 2); estorno espelha o GRAVADO, nunca recalcula |
| EST-17 | Sem retroativo; começa por contagem; primeira abertura conduz | Estorno só espelha o que existe → documento antigo não gera nada; contagem inicial pela diferença (Pitfall 3) |
| EST-18 | Saldo negativo com aviso, nunca bloqueia venda | Nenhum `check` de saldo ≥ 0; regras de custo cobrem saldo negativo (§Pergunta 3) |
| EST-19 | Cada saída grava o custo médio do instante, em inteiros | `lib/estoque/custo.ts` (§Pergunta 3), calculado sob trava (§Pergunta 5) |
| EST-20 | "Gasto por" no item-insumo | Leitura de `ficha_tecnica` por `insumo_id` + nome/unidade do produto (sem estrutura nova) |
| EST-21 | Categoria "Peça pronta"; entrada manual com custo da ficha de precificação | Custo = `calcularPeca(...).custoCentavos` (mesmo caminho de `lib/orcamentos/acoes.ts:303-333`); ver Open Question 3 (a categoria de compra exigida) |
</phase_requirements>

## Summary

A fase é, no fundo, **um livro de movimentações imutável** (`movimentacoes_estoque`) mais **três
pontos de escrita que já existem** e passam a gravar nele: `lancarVenda` e `lancarDespesa` (modo
compra) em `lib/financeiro/acoes.ts`, e `cancelarDocumento` no mesmo arquivo. Nenhuma outra ação do
sistema cria linha de documento com `item_id` — confirmado lendo os quatro outros criadores de
`documentos` (orçamento aprovado, contas fixas, importação da Abertura): nenhum põe `itemId` na
linha, então nenhum tem efeito no estoque. O resto da fase é leitura (saldos, histórico, "para onde
foi", bloco do Início) e três ações manuais (entrada, saída, ajuste/contagem).

O saldo e o **valor em estoque** devem ser **somas** sobre as linhas imutáveis — `SUM(quantidade_milesimos)`
e `SUM(valor_centavos)` —, não um "fold" recalculado a cada leitura. Isso só funciona se cada linha
gravar, no instante do lançamento, o seu próprio efeito em dinheiro, calculado por um módulo puro
(`lib/estoque/custo.ts`) a partir do estado corrente do item **lido sob trava de linha**. O
algoritmo recomendado é o custo médio móvel no estilo do ERPNext (verificado no código-fonte dele
nesta sessão), com três grampos que mantêm o livro consistente com saldo negativo: saldo que zera
zera o valor; entrada que tira o saldo do negativo redefine o custo para o da entrada; saída sobre
saldo zero usa o último custo conhecido.

Os três riscos que mais podem derrubar a fase: (1) **ordem de implantação** — o código que grava
movimentação na venda quebra TODA venda em produção se subir antes de o dono aplicar a migração;
(2) **deadlock** entre duas vendas se a trava for `FOR UPDATE` (a inserção de `documento_linhas`
já segura `FOR KEY SHARE` no item vendido) — use `FOR NO KEY UPDATE`, em ordem de id, numa única
consulta; (3) **o estorno não pode recalcular** o efeito a partir das linhas (a ficha técnica pode
ter mudado e documentos anteriores ao Estoque não têm o que estornar) — ele espelha as movimentações
gravadas.

**Primary recommendation:** Uma migração `0023` (tabela `movimentacoes_estoque` com `revoke update,
delete`, três colunas novas em `itens_catalogo`, dois enums, trava de unidade), um módulo puro de
custo e um de saldo em `lib/estoque/`, e um único ponto de escrita não-"use server"
(`lib/estoque/gravacao.ts`) que recebe a `tx` e é chamado de dentro das transações que já existem —
com o dono aplicando a `0023` **antes** do push do código que grava.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Saldo e valor em estoque | Database / Storage (`SUM` sobre linhas imutáveis) | API (`lib/estoque/consultas.ts`) | Derivado, nunca coluna (EST-02/EST-10); a consulta vive em TS para as regras de alerta ficarem no módulo puro |
| Custo médio do instante | API / Backend (módulo puro `lib/estoque/custo.ts`) | Database (trava de linha) | Regra de negócio → módulo puro testado (CLAUDE.md); a correção depende da trava, que é do banco |
| Efeito da venda/compra | API (`lib/financeiro/efeito-estoque.ts`, já existe) | — | D-03: mesmo cálculo, sem outro caminho |
| Gravação de movimentação | API (Server Actions + `lib/estoque/gravacao.ts` com `tx`) | Database (FK, `check`, `revoke`, índice único do estorno) | Toda Server Action abre com `exigirUsuario()`; o banco é a última camada |
| Imutabilidade | Database (`revoke update, delete` para `amassa_app`) | API (nenhuma ação de editar/apagar) | 0003 existe justamente para esse `revoke` valer |
| Alerta "acabando"/negativo | API (módulo puro `lib/estoque/saldo.ts`) | Browser (destaque visual) | Regra testável fora do React |
| Pré-visualização "o saldo passa de X para Y" / "fica com −X" | Browser (Client Component) | API (saldos passados como prop pelo Server Component) | Mesma função pura nos dois lados, como `conferirParcelas` |
| Bloco "Estoque acabando" | Frontend Server (Server Component `async` em `Suspense` próprio) | API (`listarSaldos`) | Molde existente do Início (GES-08/D-09) |

## Standard Stack

Nenhuma biblioteca nova. Tudo o que a fase precisa já está no `package.json` (lido nesta sessão):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 `[VERIFIED: package.json]` | Tabela, `tx`, `.for("no key update")` | Já é o ORM do projeto; o tipo `LockStrength` inclui `'no key update'` `[VERIFIED: node_modules/drizzle-orm/pg-core/query-builders/select.types.d.ts:60]` |
| drizzle-kit | 0.31.10 `[VERIFIED: package.json]` | `npm run db:generate` → `0023_*.sql` | Molde de todas as migrações; grants/revoke/gatilho acrescentados à mão (molde `0022`) |
| pg | 8.22.0 `[VERIFIED: package.json]` | Driver; isolamento padrão READ COMMITTED | Nada muda em `db/index.ts` |
| zod | 4.4.3 `[VERIFIED: package.json]` | Validação no servidor | Regra do projeto |
| next | 16.3.5 `[VERIFIED: package.json]` | App Router, Server Actions, `Suspense` | (O CLAUDE.md diz "15+"; o instalado é 16.3.5) |
| vitest | 4.1.10 `[VERIFIED: package.json]` | Testes dos módulos puros | `tests/unit/**/*.test.ts` |
| @playwright/test | ^1.62.1 `[VERIFIED: package.json]` | e2e | cadeia `vazio-*` para estado global |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bigint(..., { mode: "number" })` do Drizzle | — | Quantidade e valor da movimentação | Já usado em `execucoes_backup.bytes` `[VERIFIED: db/schema.ts:79,89]`; evita estouro de `integer` (Pitfall 11) |
| `BigInt` nativo do JS | — | Multiplicação/divisão com arredondamento em `lib/estoque/custo.ts` | Produto `quantidade × valor` pode passar de 2^53 em extremos |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Consulta `SUM` em TS | `create view saldos_estoque` (como `02-MODELO-DE-DADOS.md` §4 propunha) | O ROADMAP já registra "nem view `saldos_materiais`" (`.planning/ROADMAP.md:779`); view põe a regra de alerta em SQL, fora do módulo puro testado, e acrescenta objeto que o `drizzle-kit` e o `test:migracoes` precisam acompanhar |
| Trava de linha em `itens_catalogo` | `pg_advisory_xact_lock(hashtext(id))` | Funciona, mas foge do molde do projeto (`anotacoes`, `cancelarDocumento`, `editarCategoria` usam trava de linha) |
| READ COMMITTED + trava | `serializable` na transação | Exigiria laço de nova tentativa em toda venda (erro 40001); trava de linha é determinística e já é o padrão da casa |

**Installation:** nenhuma.

## Package Legitimacy Audit

Nenhum pacote externo é instalado nesta fase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## As sete perguntas de integração — respondidas pelo código

### Pergunta 1 — Onde a venda e a compra gravam hoje, e onde a movimentação entra

**Venda — `lancarVenda`, `lib/financeiro/acoes.ts:58-255`** `[VERIFIED: lido nesta sessão]`
- Os itens são carregados **fora** da transação, só com `id, nome, categoriaVendaId, aparecenaVenda`
  (linhas 149-164) — **sem** ficha técnica e sem `controlaEstoque`. A validação está em 166-177
  (`if (!item || !item.aparecenaVenda || !item.categoriaVendaId)` → "Um dos itens saiu do catálogo").
- A transação é `db.transaction(async (tx) => { ... })` em **180-242**: insere `documentos` (181-189),
  insere `documentoLinhas` (191-217) **sem `returning`**, insere `parcelas` (219-239), devolve
  `{ id, numero }` (241).
- **Onde a movimentação entra:** dentro do mesmo callback, entre a inserção das linhas e o `return`
  da linha 241. A inserção das linhas (191) precisa ganhar
  `.returning({ id: documentoLinhas.id, ordem: documentoLinhas.ordem })` para cada movimentação
  apontar para a sua linha (`documento_linha_id`).
- Nenhuma outra criação de `documentos` põe `itemId` na linha: `lib/orcamentos/acoes.ts:1262-1271`
  (linhas só com `descricao, categoriaId, quantidade, valorCentavos`),
  `lib/cadastros/acoes.ts:751-758` (contas fixas, idem) e `scripts/importar-parcelas-abertura.ts:349-356`
  (idem) `[VERIFIED: lidos nesta sessão]`. Logo, só `lancarVenda` e `lancarDespesa` têm efeito.

**Compra — `lancarDespesa`, `lib/financeiro/acoes.ts:266-452`** `[VERIFIED]`
- Modo compra carrega `id, nome, controlaEstoque, categoriaCompraId` fora da transação (298-311) e
  recusa item sem estoque próprio (313-321).
- Transação em **398-439**; as linhas de compra são gravadas com `quantidade: 1` e
  `quantidadeEstoque: linha.quantidadeEstoque` (409-420, verbatim: `quantidade: 1,` /
  `quantidadeEstoque: linha.quantidadeEstoque,` / `valorCentavos: linha.valorCentavos,`).
- **Onde a movimentação entra:** depois da inserção das linhas (409-420, também sem `returning`
  hoje), antes do `return` da linha 438, **só quando `dados.modo === "compra"`**.

**Como a saída de `efeitoNoEstoque` vira linhas de movimentação** `[VERIFIED: lib/financeiro/efeito-estoque.ts]`
- Assinatura (62-66): `efeitoNoEstoque(linhas, itens, sentido)` devolve `EntradaDoEfeito[]` com
  (41-47) `itemId`, `nome`, `unidade`, `variacaoMilesimos` ("Positivo (compra) ou negativo (venda),
  em MILÉSIMOS inteiros da unidade do item") e, só na compra, `custoUnitarioCentavos`.
- Venda: ficha técnica vence (97-107: `milesimosPorUnidade * linha.quantidade * sinal` por insumo);
  sem ficha e `controlaEstoque` → `linha.quantidade * 1000 * sinal` (110-113).
- Compra: `paraMilesimos(linha.quantidadeEstoque)` (86) e
  `custoUnitarioPorId.set(item.id, Math.round(linha.valorCentavos / quantidadeReal))` (88-91).
- **Mapeamento recomendado:** chamar `efeitoNoEstoque([linha], itens, sentido)` **uma vez por linha
  do documento** (não uma vez para o documento inteiro) e gravar **uma movimentação por (linha,
  item afetado)**:

  | Campo da movimentação | Venda | Compra |
  |---|---|---|
  | `item_id` | `entrada.itemId` (o próprio item ou cada insumo) | `entrada.itemId` |
  | `quantidade_milesimos` | `entrada.variacaoMilesimos` (negativo) | `entrada.variacaoMilesimos` (positivo) |
  | `tipo` / `origem` | `saida` / `venda` | `entrada` / `compra` |
  | `valor_centavos` | `lib/estoque/custo.ts` → −custo médio do instante × quantidade | `lib/estoque/custo.ts` com valor pago = `linha.valorCentavos` |
  | `valor_informado_centavos` | nulo | `linha.valorCentavos` (o que a nota diz) |
  | `documento_id` / `documento_linha_id` | o documento / a linha | idem |
  | `area` | área da categoria da linha (`item.categoriaVendaId` → `categorias.area`) | nulo (entrada não "paga" área) |

  Por que por linha, e não por documento: (a) o efeito agregado **perde a linha** e, com ela, a área
  que pagou (dois produtos de áreas diferentes gastando o mesmo insumo); (b) na compra,
  `custoUnitarioPorId.set` **sobrescreve** o custo quando o mesmo item aparece em duas linhas (a
  quantidade é somada, o custo fica o da última) — o cliente evita duplicata
  (`painel-despesa.tsx`, `tocarItemDaCompra`), mas **o servidor não**: `esquemaDespesaCompraEntrada`
  (`lib/financeiro/esquemas.ts:305-317`) não recusa item repetido. Por linha, o defeito some.
  Continua sendo "o cálculo que `efeito-estoque.ts` já faz" (D-03): a função é linear em inteiros, e
  um teste unitário prova que `Σ efeito([linha_i]) == efeito(linhas)` por item.
- **Custo da compra:** guardar o **valor da linha** (`valor_informado_centavos`) e deixar o custo
  unitário ser `valor ÷ quantidade` na exibição. Gravar o `custoUnitarioCentavos` já arredondado
  perde centavos (3 un por R$ 10,00 → 333 × 3 = R$ 9,99). É a mesma definição do D-03 ("valor da
  linha ÷ quantidade"), guardando numerador e denominador em vez do quociente arredondado.
- **Itens para o efeito dentro da transação:** `listarItensParaEfeito()`
  (`lib/financeiro/consultas.ts:250-283`) usa `db`, não `tx`, e carrega o catálogo inteiro. Criar uma
  variante que recebe `tx` e os ids vendidos (produto + insumos da ficha) — ver §Pergunta 5 para a
  ordem ler-ficha → travar → ler-saldos.

### Pergunta 2 — Como o cancelamento funciona, e onde nasce o estorno

- **`cancelarDocumento`, `lib/financeiro/acoes.ts:508-554`** `[VERIFIED]`: uma transação (520-540)
  faz `select ... from documentos where id = ? for update` (521-525), lança `DocumentoJaCancelado` se
  `canceladoEm` já existe (530-532), e grava
  `.set({ canceladoEm: new Date(), canceladoPor: usuario.id })` (534-537). Nenhum `delete`.
- **Onde o estorno entra:** no mesmo callback, **depois** da checagem de "já cancelado" (530) e antes
  do `return documento.numero` (539): ler as movimentações do documento que ainda não têm estorno,
  travar os itens delas (ordem de id), e gravar uma movimentação espelho por original, com
  `estorno_de_id = original.id`, `documento_id` igual, `origem` igual.
- **Documento cancelado é reaberto?** Não. `grep` por `canceladoEm: null`, `canceladoPor: null`,
  `cancelado_em = null` em `lib/ app/ components/ scripts/ db/migrations/` não acha nenhuma escrita
  que desfaça um cancelamento `[VERIFIED: Grep nesta sessão]`; o único `update` de `canceladoEm` é
  o da linha 536. BRIEFING 04.4 §5 confirma: "Sem edição de documento lançado nesta fase: errou,
  cancela e lança de novo." Portanto um estorno nunca precisa ser "desestornado".
- **Duas proteções contra estorno duplo:** a trava `for update` do documento já existente (duas
  pessoas cancelando o mesmo documento serializam, a segunda cai em `DocumentoJaCancelado`) e, no
  banco, **índice único em `estorno_de_id`** — uma movimentação só pode ser estornada uma vez.
- **O estorno espelha o gravado, nunca recalcula:** não chamar `efeitoNoEstoque` de novo no
  cancelamento. A ficha técnica pode ter mudado desde a venda (`editarItem` troca a ficha inteira,
  `lib/cadastros/acoes.ts:533-542`), e um documento anterior ao Estoque não tem movimentação
  nenhuma — espelhar o que existe dá "zero estorno" sozinho, que é exatamente o D-05.
- **Revalidação:** `cancelarDocumento` já faz `revalidatePath("/gestao/financeiro")` (542); acrescentar
  `rotaDeGestao("/estoque")` e `rotaDeGestao("/")` (o bloco do Início).

### Pergunta 3 — Custo médio ponderado com as regras do dono

**Onde vive:** `lib/estoque/custo.ts`, puro (sem React, sem `@/db`), com `import type` apenas —
mesma disciplina de `lib/cadastros/catalogo.ts` (cabeçalho, linhas 1-17). O CLAUDE.md nomeia
`lib/estoque/saldo.ts`; recomenda-se **dois** módulos puros: `saldo.ts` (situação do saldo, alerta,
ajuste, "o saldo passa de X para Y") e `custo.ts` (valoração). Ambos testados em `tests/unit/`.

**Representação:** estado do item = `Q` (Σ `quantidade_milesimos`, pode ser negativo) e `V`
(Σ `valor_centavos`, mesmo sinal de `Q` ou zero). Custo médio corrente `A = V / Q` mantido como
**razão exata** (nunca um decimal arredondado por unidade: um item controlado em **g** a R$ 78/kg
custa 7,8 centavos por g — arredondar o unitário erraria 2,5%). Cada movimentação grava o seu
`valor_centavos` (efeito com sinal no valor em estoque); o "custo médio do instante" exibido é
`|valor| ÷ |quantidade|`.

**Algoritmo recomendado** (custo médio móvel, com os grampos do ERPNext para estoque negativo —
`get_moving_average_values`, verificado no código-fonte:
"`if flt(self.wh_data.qty_after_transaction) <= 0: self.wh_data.valuation_rate = sle.incoming_rate`"
`[CITED: github.com/frappe/erpnext/blob/develop/erpnext/stock/stock_ledger.py]`):

```
Entrada: Q, V, últimaEntrada (valor, milésimos) | null; movimento com Δ (milésimos, com sinal)
Q' = Q + Δ
Taxa corrente A:  Q ≠ 0 → V/Q ;  Q = 0 → últimaEntrada.valor / últimaEntrada.milésimos ;  senão 0

R1  Q' = 0                                   → valor = −V            (zera resíduo de arredondamento)
R2  entrada COM preço (pago P), Q > 0        → valor = P
R3  entrada COM preço, Q ≤ 0 e Q' > 0        → V' = round(Q' × P / Δ); valor = V' − V   (custo vira o da entrada)
R4  entrada COM preço, Q < 0 e Q' < 0        → valor = round(Δ × A)  (mantém a taxa, como o ERPNext)
R5  saída (Δ < 0)                            → valor = −round(|Δ| × A)
R6  entrada SEM preço (ajuste para mais)     → valor = round(Δ × A)
Ajuste: d = contado − Q (sob a trava); d = 0 → nada a gravar (EST-08); d < 0 → R5; d > 0 → R6.
Ordem: R1 primeiro; depois a regra do tipo.
```

"Entrada com preço" = compra, entrada manual ("quanto custou ao todo"), saldo inicial, peça pronta e
**estorno de venda** (P = |valor da saída original|, Δ = |quantidade original|). "Saída" = venda,
saída manual e **estorno de compra** (ao custo corrente — ver o porquê abaixo). Invariante testável:
depois de qualquer sequência, `Q = 0 ⇒ V = 0` e `sinal(V) ∈ {sinal(Q), 0}`.

**Os casos de borda pedidos, com números** (argila em kg; 1 kg = 1000 milésimos):

| # | Situação | Antes (Q, V) | Movimento | valor gravado | Depois (Q, V) | Custo médio |
|---|---|---|---|---|---|---|
| 1 | EST-01 | 0, 0 | entrada 5 kg por R$ 21,00 | +2100 (R2/R3) | 5000, 2100 | R$ 4,20/kg |
| 1b | baixa de 2 kg | 5000, 2100 | saída 2000 | −round(2000×2100/5000) = −840 | **3000**, 1260 | R$ 4,20/kg |
| 2 | saída que zera | 3000, 1260 | saída 3000 | −1260 (R1) | 0, 0 | — |
| 3 | saída com saldo zero | 0, 0 | saída 1000 | −round(1000 × 2100/5000) = −420 (última entrada) | −1000, −420 | R$ 4,20/kg |
| 4 | **entrada com saldo negativo, fica positivo** | −1000, −420 | compra 25 kg por R$ 125,00 | V' = round(24000×12500/25000) = 12000 → valor = +12420 (R3) | 24000, 12000 | **R$ 5,00/kg** (o da compra) |
| 5 | entrada com saldo negativo, continua negativo | −3000, −1260 | entrada 1 kg por R$ 5,00 | +round(1000×0,42) = +420 (R4) | −2000, −840 | R$ 4,20/kg |
| 6 | **estorno de venda antiga depois de o médio mudar** | 24000, 12000 (médio R$ 5,00) | estorno da saída do caso 1b (2 kg, 840) | +840 (R2, P = 840) | 26000, 12840 | R$ 4,94/kg |
| 7 | **arredondamento**: 3 un por R$ 10,00 | 3000, 1000 | 3 saídas de 1 un | −333; −round(1000×667/2000)= −334; −333 (R1) | 0, 0 | soma = 1000, nenhum centavo perdido |

- Caso 4: a movimentação grava `valor_centavos = 12420`, **não** os R$ 125,00 pagos — a diferença
  reprecifica o quilo "devido". Por isso a tabela precisa de `valor_informado_centavos` (o valor da
  nota), que é o que o histórico mostra ("Entrada · R$ 125,00 · R$ 5,00/kg").
- Caso 6: o estorno devolve o material **ao custo que a venda levou**, não ao custo de hoje. Assim o
  "Para onde foi" de uma venda cancelada zera exatamente, e a regra é simples de explicar.
- Estorno de **compra** ao custo corrente (R5), não ao custo original: devolver ao custo original pode
  deixar `V < 0` com `Q > 0` quando houve consumo entre a compra e o cancelamento (ex.: 10 un a
  R$ 0,01; compra 1 un a R$ 10,00; saem 5; cancelar a compra ao custo original deixa V negativo). Ao
  custo corrente o invariante nunca quebra; o preço disso é o médio não "desmisturar" a compra
  cancelada. Documentar como decisão técnica (Assumption A3).
- Arredondamento: meio-para-cima, em `BigInt`, sobre valores absolutos, reaplicando o sinal — o
  mesmo "meio-para-cima" de `lib/financeiro/taxa.ts` citado em `lib/precificacao/calculo.ts:75-80`.

### Pergunta 4 — Saldo derivado: forma da tabela e consulta × view

**Colunas novas em `itens_catalogo`** (recomendado sobre tabela 1:1 — o adendo diz "acrescenta ao
item", e `ativo` espelha `categorias.ativa`, `db/schema.ts:568`):
`estoque_minimo_milesimos bigint not null default 0 check (>= 0)`, `observacoes text null check
(length(trim) between 1 and 500)`, `ativo boolean not null default true`. Mínimo em milésimos
inteiros, como a quantidade da movimentação.

**Tabela `movimentacoes_estoque`** (nome antecipado pela própria migração `0003`, linhas 2-4:
"É o que faz o `revoke update, delete on movimentacoes_estoque` da Fase 6 valer alguma coisa"
`[VERIFIED: db/migrations/0003_papel-amassa-app-e-grants.sql:2-4]`):

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `numero` | bigint `generated always as identity`, único | **Chave de ordem**. `criado_em` não serve: `now()` é o instante de INÍCIO da transação — todas as linhas de uma venda empatam, e uma transação que começou antes e comitou depois fica "antes" |
| `item_id` | uuid → `itens_catalogo`, not null | restrict |
| `origem` | enum `origem_movimentacao` (`venda`,`compra`,`producao`,`manual`) | D-02 |
| `tipo` | enum `tipo_movimentacao` (`entrada`,`saida`,`ajuste`) | pílulas do Histórico: Entradas · Saídas · Ajustes |
| `motivo` | enum ou nulo (`saldo_inicial`, `peca_pronta`, …) | distingue a entrada da contagem inicial |
| `destino` | enum `destino_saida` (`aula`,`encomenda`,`cafeteria`,`atelie`,`perda`) nulo | obrigatório em saída `manual` (`check`) |
| `area` | `area_financeira` (enum existente) nulo | quem pagou — saída manual pelo D-14, venda pela categoria da linha |
| `quantidade_milesimos` | bigint, `check (<> 0)` | sinal coerente com `tipo` por `check` (molde de `02-MODELO-DE-DADOS.md` §4) |
| `valor_centavos` | bigint | efeito no valor em estoque (com sinal) |
| `valor_informado_centavos` | bigint nulo, `check (> 0)` | o que se pagou/digitou (compra, entrada manual, saldo inicial) |
| `saldo_contado_milesimos` | bigint nulo, `check (>= 0)` | só ajuste — o protótipo mostra "contado 4,1 kg na prateleira" |
| `documento_id` | uuid → `documentos` nulo | obrigatório em `venda`/`compra` (`check`) |
| `documento_linha_id` | uuid → `documento_linhas` nulo | a linha de origem |
| `encomenda_id` | uuid → `encomendas` nulo, **`on delete set null`** | Pitfall 10 |
| `vinculo_texto` | text nulo, até 160 | turma (texto livre), "o que aconteceu?", nome da encomenda congelado |
| `estorno_de_id` | uuid → `movimentacoes_estoque` nulo, **único** | um estorno por original |
| `registrado_por` | uuid → `usuarios`, not null | EST-05 |
| `criado_em` | timestamptz default now() | **sem `atualizado_em` e sem gatilho** — exceção já prevista em `02-MODELO-DE-DADOS.md:80` |

Índices: `(item_id, numero)` (saldo por item e histórico do item), `(documento_id)` (estorno),
`(criado_em)` (Histórico e "Para onde foi" por período).

**Consulta, não view.** `lib/estoque/consultas.ts::listarSaldos()` no molde "consulta principal +
agregado casados por `Map`" que o projeto já usa (`lib/precificacao/consultas.ts:278-333`,
`lib/cadastros/consultas.ts:51` `listarCategoriasComUso`): itens com `controla_estoque` (e as duas
categorias via `alias`, como `listarCatalogoCompleto`, `lib/cadastros/consultas.ts:153-181`) + um
`select item_id, sum(quantidade_milesimos), sum(valor_centavos), max(criado_em) ... group by item_id`.
A lista, o banner, o bloco do Início, a contagem e o painel de Venda (D-21) leem **a mesma função**;
a classificação (abaixo do mínimo, negativo) é `lib/estoque/saldo.ts`, pura. Motivos: o ROADMAP
registra "nem view `saldos_materiais`" (`.planning/ROADMAP.md:779`); a regra de alerta fica no módulo
testado e não num `CASE` de SQL; um objeto a menos para `drizzle-kit` e `test:migracoes`. `sum()` de
`bigint` volta como texto do `pg` → `Number(...)` (seguro abaixo de 2^53).

**Migração:** `0023` (a última é `0022_anotacoes-da-casa` `[VERIFIED: db/migrations/meta/_journal.json]`),
um arquivo só no molde de `0022`: bloco gerado por `drizzle-kit generate` + à mão
`revoke update, delete on movimentacoes_estoque from amassa_app;` e o gatilho de trava de unidade
(Pitfall 6). **Escrita e versionada, nunca aplicada.** `TABELAS_ESPERADAS`
(`scripts/testar-migracoes.mjs:26-75`) ganha `"movimentacoes_estoque"`.

### Pergunta 5 — Concorrência

**O saldo não precisa de trava** — ele é `SUM` de linhas imutáveis; duas baixas concorrentes somam
certo sempre. **O que precisa de trava** é tudo que **decide a partir do saldo corrente**:
(a) o valor da saída (custo do instante), (b) os grampos R1/R3, (c) a diferença do ajuste (D-18:
"contra o saldo do instante da gravação"), (d) "diferença zero não grava". Sem trava, duas baixas
leem o mesmo `Q, V`; a que "zera" aplica R1 contra um `V` velho e deixa resíduo; um ajuste lê `Q`
antes de uma venda comitar e o saldo final fica `contado − venda`.

**Recomendação — trava de linha, no molde de `lib/anotacoes/acoes.ts:63-76`** (transação +
`select ... for update` + decidir depois da trava) **com duas mudanças**:

1. **`.for("no key update")`, não `.for("update")`.** A inserção em `documento_linhas` com
   `item_id = X` faz a checagem de chave estrangeira segurar um lock `FOR KEY SHARE` na linha `X` de
   `itens_catalogo` `[ASSUMED: comportamento das checagens de FK do Postgres]`. `FOR UPDATE` conflita
   com `FOR KEY SHARE`; `FOR NO KEY UPDATE` não ("this lock will not block `SELECT FOR KEY SHARE`"
   `[CITED: postgresql.org/docs/current/explicit-locking.html]`). Com `FOR UPDATE`, duas vendas do
   mesmo item controlado entram em deadlock: A insere a linha (KEY SHARE em X), B idem, A pede UPDATE
   em X (espera B), B pede UPDATE em X (espera A).
2. **Uma única consulta, em ordem de id:** `select id from itens_catalogo where id in (...) order by
   id for no key update` — todos os itens afetados (produtos com estoque próprio + todos os insumos),
   de uma vez. Ordem fixa elimina deadlock entre duas vendas que tocam os mesmos insumos em ordens
   diferentes.

**Sequência dentro da transação (venda):** ler fichas dos produtos vendidos (com `tx`) → calcular o
conjunto de itens afetados → travar esse conjunto (acima) → ler `Q`, `V` e a última entrada com
preço de cada um (`tx`) → aplicar `lib/estoque/custo.ts` **em sequência** para movimentos do mesmo
item dentro do mesmo documento → inserir. Usar a ficha lida **antes** da trava para o cálculo
inteiro: se uma edição de ficha comitar entre a leitura e a trava, a venda fica equivalente a ter
acontecido um instante antes da edição — consistente, porque todo insumo daquela ficha foi travado.
Depois da trava, `editarItem` (que faz `for update` no produto, `lib/cadastros/acoes.ts:453-461`)
espera a venda terminar.

**Isolamento:** manter o padrão do Postgres (READ COMMITTED; `db/index.ts` não muda nada). Em READ
COMMITTED cada comando vê o que foi comitado antes de ele começar
`[CITED: postgresql.org/docs/current/transaction-iso.html]` — então o `SUM` lido **depois** da trava
enxerga a gravação de quem segurava a trava antes. **Não** usar `repeatable read`: o retrato seria
tirado no primeiro comando da transação, antes da trava, e o `SUM` sairia velho.

**Contagem (D-18) e venda ao mesmo tempo:** cada item confirmado na contagem é uma Server Action
com a sua transação que trava **só aquele item** e calcula `d = contado − Q` depois da trava. Se a
venda chegou primeiro, o ajuste vê o saldo já baixado; se a contagem chegou primeiro, a venda baixa
depois do ajuste. Nas duas ordens o resultado é determinístico.

**Ordem de travas no sistema inteiro (para não criar ciclo):** `cancelarDocumento` trava documento →
itens; `lancarVenda`/`lancarDespesa` criam o documento (linha nova, ninguém mais a vê) → itens;
`registrarPagamento`/`desfazerPagamento` travam documento → parcela, sem itens; `editarItem` trava
só o item. Nenhum caminho trava itens e depois um documento existente → sem ciclo.

### Pergunta 6 — Leitores de `itens_catalogo` afetados pela coluna `ativo`

Todas as leituras de `itensCatalogo` em `lib/ app/ components/ scripts/` `[VERIFIED: Grep nesta
sessão; cada uma lida]`:

| Leitor | Arquivo:linha | O que fazer |
|---|---|---|
| Seletor da Venda | `lib/financeiro/consultas.ts:203-216` (`listarCatalogoDaVenda`, `where aparecenaVenda = true`) | **Filtrar `ativo = true`** |
| Seletor da Compra | `lib/financeiro/consultas.ts:230-245` (`listarCatalogoDaCompra`, `where controlaEstoque = true`) | **Filtrar `ativo = true`** |
| Validação da venda no servidor | `lib/financeiro/acoes.ts:149-177` | **Recusar item inativo** (a frase "Um dos itens saiu do catálogo — tire a linha e tente de novo." já serve) |
| Validação da compra no servidor | `lib/financeiro/acoes.ts:298-321` | **Recusar item inativo** |
| Itens do efeito | `lib/financeiro/consultas.ts:250-283` (`listarItensParaEfeito`) | **NÃO filtrar** — um insumo desativado dentro da ficha de um produto ativo continua sendo baixado; ver regra abaixo |
| Atalho de venda/compra | `lib/financeiro/acoes.ts:464-497` (`definirAtalhoDoItem`) | Recusar marcar atalho em item inativo (opcional; o seletor já o esconde) |
| Catálogo do Cadastros | `lib/cadastros/consultas.ts:147-236` (`listarCatalogoCompleto`) | **Devolver `ativo`**; a tela mostra desativados marcados e oferece reativar |
| Insumos candidatos da ficha | `lib/cadastros/consultas.ts:250-263` (`listarInsumosDisponiveis`) e `lib/cadastros/acoes.ts:287-297` (`carregarInsumosDisponiveis`) | Esconder inativo como **novo** insumo; manter o que já está na ficha (mesma regra de "categoria desativada continua como opção atual", `lib/cadastros/acoes.ts:299-312`) |
| Contagem de uso por categoria | `lib/cadastros/consultas.ts:74-81` | Não filtrar (item inativo ainda usa a categoria) |
| Fichas de precificação ↔ item | `lib/precificacao/consultas.ts:208-214, 302-305`; `lib/orcamentos/acoes.ts:360-372` | Não filtrar (histórico/ficha); ver Open Question 4 |
| Criação/edição por ficha de preço | `lib/precificacao/acoes.ts:251-259, 360-378` | Nada (nasce `ativo` pelo `default true`) |
| Detalhe do documento | `lib/financeiro/consultas.ts:468-475` | Não filtrar (histórico) |
| Estoque (novo) | `lib/estoque/consultas.ts` | Filtro Ativos · Desativados · Todos (molde `components/amassa/queimas/filtro-fornos.tsx:15-19`) |

**Regra que falta e o plano precisa escrever:** desativar um item que é **insumo** da ficha de um
item ativo deve ser recusado com a frase que já existe — `fraseItemEhInsumoDe` (`lib/cadastros/catalogo.ts`,
usada por `podeDeixarDeTerEstoque`). Senão uma venda baixa estoque de um item que ninguém vê mais.

**Apagar item "sem movimentação e sem venda" (D-20):** hoje `amassa_app` **não tem** `delete` em
`itens_catalogo` — `revoke delete on documentos, parcelas, categorias, itens_catalogo, contas_fixas,
configuracao_financeira from amassa_app;` `[VERIFIED: db/migrations/0015_gatilhos-financeiro.sql:199-200]`
— e `test:migracoes` **afirma** isso (`TABELAS_SEM_DELETE` inclui `"itens_catalogo"`,
`scripts/testar-migracoes.mjs:1198-1215`). Ver Pitfall 8 e Open Question 1.

### Pergunta 7 — O bloco do Início

- Hoje `components/amassa/inicio/bloco-estoque.tsx:8-19` é síncrono e sem consulta (comentário 5-7:
  "Quando o Estoque entrar, este bloco ganha a consulta real (e um `try`/`catch` próprio, D-09)").
- O `Suspense` **já existe** na página: `app/gestao/(app)/page.tsx:71-73`,
  `<Suspense fallback={<BlocoEsqueleto titulo="Estoque acabando" linhas={2} />}>` `[VERIFIED]`.
- **Molde a copiar — `components/amassa/inicio/bloco-producao.tsx:40-131`:** `export async function`,
  `let falhou = false`, `try { ... } catch (erro) { console.error("Falha ao carregar ... no Início:", erro); falhou = true; }`,
  e no JSX `falhou ? <EstadoErro titulo="Algo não funcionou." corpo={TEXTOS_DOS_BLOCOS.producao.erro} acao={<TentarDeNovo />} />
  : linhas.length === 0 ? <p ...>{TEXTOS_DOS_BLOCOS.producao.vazio}</p> : (...)`.
- Os textos do bloco já existem: `estoque: { vazio: "Nenhum material abaixo do mínimo.", erro: "Não deu
  para carregar o estoque." }` `[VERIFIED: lib/inicio/textos.ts:23-26]`.
- `TentarDeNovo` (`components/amassa/inicio/tentar-de-novo.tsx:21-34`) é `router.refresh()`.
- `lib/inicio/` só aceita apresentação pura (cabeçalho de `lib/inicio/textos.ts`) → a consulta vem de
  `lib/estoque/consultas.ts`, a regra de "acabando" de `lib/estoque/saldo.ts`.

## Architecture Patterns

### System Architecture Diagram

```
                ┌──────────────── Financeiro (já existe) ─────────────────┐
 celular ──►  lancarVenda / lancarDespesa(compra)          cancelarDocumento
               │ exigirUsuario → Zod → validações            │ exigirUsuario → Zod
               ▼                                              ▼
            db.transaction(tx) ─────────────────────────  db.transaction(tx)
               │ insert documentos, documento_linhas         │ select documentos FOR UPDATE
               │ (returning id, ordem)                       │ já cancelado? → erro
               ▼                                              ▼
        efeitoNoEstoque([linha], itens, sentido)   select movimentações do documento sem estorno
          (por linha — mesmo cálculo da 04.4)                 │
               └──────────────┬───────────────────────────────┘
                              ▼
                lib/estoque/gravacao.ts (recebe tx; NÃO é "use server")
                  1. travar itens afetados: ORDER BY id FOR NO KEY UPDATE
                  2. ler Q=Σqtd, V=Σvalor, última entrada com preço  (READ COMMITTED)
                  3. lib/estoque/custo.ts (puro) → valor_centavos de cada linha, em sequência
                  4. insert movimentacoes_estoque  (revoke update/delete no banco)
                              │
 Estoque (novo) ──► lib/estoque/acoes.ts ("use server": entrada, saída, ajuste, contagem,
                    mínimo/observações, ativar, apagar, novo material) ──► gravacao.ts
                              │
                              ▼
            lib/estoque/consultas.ts: listarSaldos() = itens ⨝ Σ por item
               │            │              │                 │
               ▼            ▼              ▼                 ▼
          Saldos/banner  Histórico   Para onde foi    Bloco do Início / painel de Venda (D-21)
          (saldo.ts classifica: abaixo do mínimo · negativo)
```

### Recommended Project Structure
```
lib/estoque/
├── saldo.ts        # PURO: situacaoDoSaldo, estaAcabando, planejarAjuste, textoSaldoPassaDe, areaDoItemNoEstoque
├── custo.ts        # PURO: valorarMovimento (R1–R6), arredondamento em BigInt
├── destinos.ts     # PURO: os 5 destinos, rótulos e a área de cada um (D-14)
├── textos.ts       # frases pt-BR (vazios, erros, "Conferido. O saldo já estava correto.")
├── esquemas.ts     # Zod das ações do Estoque
├── consultas.ts    # leituras (sem "use server"): listarSaldos, listarHistorico, paraOndeFoi, gastoPor
├── gravacao.ts     # escrita com tx (sem "use server"): travar, ler estado, valorar, inserir
└── acoes.ts        # "use server": toda função abre com exigirUsuario()
app/gestao/(app)/estoque/page.tsx          # substitui o estado vazio atual
components/amassa/estoque/*                 # abas, cartões, folha de movimentação, contagem
db/migrations/0023_estoque.sql              # gerado + grants/revoke/gatilho à mão
```

### Pattern 1: Livro imutável com soma derivada
**What:** toda mudança de estoque é uma linha nova; saldo e valor são `SUM`. **When:** sempre.
Correção = ajuste; cancelamento = estorno. O banco garante com `revoke update, delete`.

### Pattern 2: Decidir sob a trava
**What:** travar → ler → decidir → gravar, na mesma transação. **Example (molde do projeto):**
```typescript
// Source: lib/anotacoes/acoes.ts:63-76 (molde) — adaptado: "no key update" e várias linhas em ordem
const travados = await tx
  .select({ id: itensCatalogo.id })
  .from(itensCatalogo)
  .where(inArray(itensCatalogo.id, idsAfetados))
  .orderBy(asc(itensCatalogo.id))
  .for("no key update");
// só DEPOIS disto: select sum(...) group by item_id, e lib/estoque/custo.ts
```

### Pattern 3: O efeito por linha
```typescript
// Source: contrato de lib/financeiro/efeito-estoque.ts:62-66; chamada por linha é recomendação desta pesquisa
for (const [indice, linha] of linhasGravadas.entries()) {
  const efeito = efeitoNoEstoque([paraLinhaDoEfeito(dados.linhas[indice])], itensParaEfeito, "venda");
  for (const entrada of efeito) pedidos.push({ linhaId: linha.id, itemId: entrada.itemId, milesimos: entrada.variacaoMilesimos });
}
```

### Pattern 4: Escrita compartilhada fora de arquivo "use server"
`lib/financeiro/acoes.ts` e `lib/cadastros/acoes.ts` têm `"use server"` na linha 1 — **toda função
exportada deles vira Server Action**, e `npm run verificar-acoes` (`scripts/verificar-acoes.mjs:12-16`)
cobra `exigirUsuario()` na primeira linha de cada uma. O ajudante que recebe `tx` precisa morar em
`lib/estoque/gravacao.ts`, sem a diretiva.

### Anti-Patterns to Avoid
- **Recalcular o efeito no cancelamento:** a ficha mudou, ou o documento é anterior ao Estoque.
  Espelhe as movimentações gravadas.
- **Ordenar por `criado_em`:** empata dentro da transação e não segue a ordem de commit. Use `numero`.
- **`.for("update")` em `itens_catalogo` dentro de venda:** deadlock com a FK (Pergunta 5).
- **Guardar custo unitário arredondado:** perde centavos; guarde valor e quantidade.
- **Coluna `saldo` em `itens_catalogo`:** proibido pelo EST-02 e pelo adendo.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Efeito da venda/compra no estoque | Um segundo cálculo de ficha × quantidade | `efeitoNoEstoque` (por linha) | D-03 proíbe outro caminho |
| Conversão de texto para quantidade/dinheiro | Parser novo | `converterQuantidade`, `converterReaisParaCentavos` (`lib/financeiro/dinheiro.ts`) — com variante que aceite **zero** para o saldo contado | Mesma vírgula/ponto do resto do sistema |
| Formatação | `toLocaleString` solto | `formatarQuantidade`, `formatarReais` (`lib/financeiro/formato.ts:37,78`) | pt-BR consistente |
| SQLSTATE | `erro.code` | `codigoDoErroPostgres` / `ehViolacaoDeChaveEstrangeira` (`lib/erro/postgres.ts:11-30`) | Drizzle embrulha: o código está em `erro.cause.code` |
| Custo da peça pronta | Fórmula nova | `parametrosVigentes` → `quantasCabem` → `calcularPeca({canal:"direto"}).custoCentavos` (caminho de `lib/orcamentos/acoes.ts:308-333`) | Mesmo número que a Precificação mostra |
| Filtro Ativos/Desativados/Todos | Componente novo do zero | Molde `components/amassa/queimas/filtro-fornos.tsx` | Acessibilidade (`radiogroup`) já resolvida |
| Estado de erro/vazio/carregando no Início | Novo envelope | `BlocoDoInicio`, `EstadoErro`, `TentarDeNovo`, `BlocoEsqueleto` | GES-08/D-09 |
| Rota | Literal `"/estoque"` | `rotaDeGestao("/estoque")` | `tests/unit/sem-rota-antiga.test.ts` barra literal antigo |

**Key insight:** o domínio parece simples ("some e subtraia"), mas tudo o que dá errado mora na
fronteira — cancelamento, saldo negativo, arredondamento, corrida. Cada uma dessas já tem ou uma
peça pronta no projeto ou uma regra de três linhas testável; nada disso deve nascer dentro de um
componente.

## Common Pitfalls

### Pitfall 1: Subir o código antes da migração quebra TODA venda
**What goes wrong:** `lancarVenda` passa a inserir em `movimentacoes_estoque`; se o deploy (automático
no push) chegar antes de o dono aplicar a `0023`, toda venda e toda compra de material falham com
"tabela não existe" — funcionalidade de produção que hoje funciona.
**Why:** migração é aplicada à mão (CLAUDE.md); o pipeline só publica código.
**How to avoid:** a migração é **aditiva** (tabela nova, colunas com `default`) — o código velho roda
com ela aplicada. O plano de fechamento ordena: backup → dono aplica `0023` → conferências de fora
→ **só então** push. Registrar isso no roteiro do portão humano.
**Warning signs:** `git log origin/main..main` contendo a mudança de `lancarVenda` sem a migração
aplicada.

### Pitfall 2: Deadlock com `FOR UPDATE`
Ver Pergunta 5. Use `for("no key update")`, uma consulta, `order by id`.

### Pitfall 3: Contagem inicial como entrada soma com baixas anteriores à contagem
**What goes wrong:** a partir do deploy, toda venda grava. Se houver vendas entre o deploy e a
contagem inicial, o saldo já está negativo; o D-17 ("a quantidade contada vira entrada") somaria o
contado ao negativo e o saldo ficaria `contado − vendido`, embora a prateleira mostre `contado`.
**How to avoid:** gravar o saldo inicial como entrada **pela diferença** (`contado − Q` sob a trava),
com preço = "quanto custou ao todo" pelo R3 — quando `Q = 0` (caso normal) é exatamente o D-17; quando
não, o saldo fica igual ao contado e o valor igual ao digitado. Ver Open Question 5.

### Pitfall 4: Estorno recalculado
Ver Pergunta 2 e Anti-Patterns.

### Pitfall 5: `areaDoItem` prefere a categoria de VENDA
`lib/cadastros/catalogo.ts:150-161`: "`if (categoriaVenda) { return categoriaVenda.area; }`" antes da
de compra. O adendo §2 e o EST-12 pedem **compra primeiro, venda na falta**. Criar
`areaDoItemNoEstoque` em `lib/estoque/saldo.ts`. Nota: para item com `controla_estoque`, a categoria
de compra é **obrigatória no banco** (`itens_catalogo_controla_exige_unidade_e_categoria_compra`,
`db/schema.ts:621-624`), então na prática a área do Estoque é sempre a de compra.

### Pitfall 6: Mudar a unidade (ou desligar o estoque) de um item com movimentação
**What goes wrong:** `editarItem` grava `unidade` e `controlaEstoque` livremente
(`lib/cadastros/acoes.ts:518-531`); 5 kg viram 5 g, ou o item some do Estoque com saldo.
**How to avoid:** recusar em `editarItem` quando houver movimentação, e um gatilho no banco no molde
de `travar_grupo_e_area_da_categoria` (`0015`, `raise exception` → SQLSTATE `P0001`, já tratado em
`lib/cadastros/acoes.ts:75-77`).

### Pitfall 7: Arquivo "use server" só exporta função assíncrona
Os validadores `categoriaDeVendaValida`/`categoriaDeCompraValida` são privados de
`lib/cadastros/acoes.ts:303-324`. Para o "Novo material" do Estoque reusá-los (EST-13), movê-los
para um módulo sem a diretiva (ex.: `lib/cadastros/catalogo.ts`, que é puro) — exportá-los do
arquivo de ações quebra o build (Next exige funções assíncronas ali) e o `verificar-acoes`.

### Pitfall 8: Apagar item exige mudar uma garantia testada
`amassa_app` não tem `delete` em `itens_catalogo` (0015:199-200) e o `test:migracoes` afirma isso
(1198-1215). Duas saídas: (a) `grant delete on itens_catalogo to amassa_app` na `0023`, mover
`"itens_catalogo"` de `TABELAS_SEM_DELETE` para `TABELAS_COM_DELETE`, e deixar as FKs `restrict`
(de `documento_linhas`, `ficha_tecnica`, `fichas_precificacao`, `movimentacoes_estoque`) serem a
guarda — apagar item usado dá 23503, que vira "desative em vez de apagar"; a ação apaga antes as
linhas de `ficha_tecnica` em que o item é o **produto**; (b) não apagar nesta fase, só desativar.
É mudança de postura de segurança sobre uma regra do dono (FNC-10) → Open Question 1.

### Pitfall 9: `converterQuantidade` recusa zero
`lib/financeiro/dinheiro.ts:161-164`: `if (valor <= 0) { return { ok: false, ... } }`. Prateleira
vazia é um saldo contado válido (ajuste para zero). Variante que aceite `>= 0` só para o campo
"Quanto tem na prateleira agora?" (o protótipo usa `min="0"`).

### Pitfall 10: Encomenda apagada com movimentação apontando para ela
`excluirEncomenda` apaga de verdade (`lib/encomendas/acoes.ts:337`) e **relança** erro inesperado
(linha 350, `throw erro`). FK `restrict` em `encomenda_id` transformaria "excluir encomenda" em tela de
erro. Usar `on delete set null` + nome da encomenda congelado em `vinculo_texto`. Como a tabela não
aceita `update` de `amassa_app`, **provar no `test:migracoes`** que `amassa_app` consegue apagar uma
encomenda referenciada (a ação referencial roda com privilégio do dono da tabela
`[ASSUMED: semântica dos gatilhos de integridade referencial do Postgres]`).

### Pitfall 11: Estouro de `integer`
Linha de venda aceita quantidade até 99999 (`db/schema.ts:857-860`) e a ficha até 999.999 por
unidade (`converterQuantidade`, 165-167) → milésimos podem passar de 2^31. `bigint` modo `number`
nas colunas de quantidade e valor; `BigInt` dentro de `custo.ts`.

### Pitfall 12: O orçamento de 4 toques começa no Estoque, não no Início
Desde a 04.6 o Estoque não está na barra de baixo; do Início é a pílula "Estoque" (derivada de
`lib/navegacao/itens.ts`, `components/amassa/inicio/pilulas-de-atalho.tsx:10-13`). Os 4 toques do
protótipo são contados na tela do Estoque ("Dar baixa" → atalho de quantidade → destino → Registrar);
do Início é 1 a mais. Declarar isso no roteiro de verificação humana do EST-09.

### Pitfall 13: Teste que afirma estado global
"Primeira abertura conduz a contagem" e "Nenhum material abaixo do mínimo" são condições **globais**
do banco. Sob `fullyParallel`, qualquer spec que crie movimentação as quebra. Usar a cadeia
`vazio-*` do `playwright.config.ts` (tag `@vazio-global`), nunca `--grep` como muleta (CLAUDE.md).

### Pitfall 14: "Paguei" com valor diferente altera a linha da compra depois da entrada
`registrarPagamento` ajusta `documento_linhas.valor_centavos` quando o documento tem uma linha e uma
parcela (`lib/financeiro/acoes.ts:648-659`). Uma compra de material de uma linha lançada "em aberto"
e paga depois com outro valor fica com a nota diferente do `valor_informado_centavos` gravado.
Movimentação não se edita → Open Question 6.

### Pitfall 15: "Para onde foi" contando venda cancelada
A saída da venda e o estorno ficam os dois no histórico (o protótipo diz "as duas linhas ficam").
No relatório por destino/área, excluir saídas que têm estorno (junção por `estorno_de_id`), senão
o material de uma venda cancelada aparece como consumido.

### Pitfall 16: O aviso "fica com −X" da Venda cairia dentro de um `<details>` fechado
`EfeitoEstoque` nasce fechado na Venda (`components/amassa/financeiro/efeito-estoque.tsx`,
`abertoPorPadrao = false`). O "fica com −X" (D-21) dentro dele pode não ser visto. O painel precisa
receber os saldos (`listarSaldos`) como prop; decidir na UI-SPEC se o aviso aparece também fora do
recolhível. Os e2e de `financeiro-venda.spec.ts` leem esse texto — mudar o formato quebra testes.

## Code Examples

### Valoração pura (esqueleto)
```typescript
// Source: regras R1–R6 desta pesquisa; nomes das funções são proposta
export type EstadoDoItem = {
  saldoMilesimos: number;
  valorCentavos: number;
  ultimaEntradaComPreco: { valorCentavos: number; milesimos: number } | null;
};

function arredondarRazao(numerador: bigint, denominador: bigint): bigint {
  // meio-para-cima sobre valores absolutos, sinal reaplicado
  const negativo = (numerador < 0n) !== (denominador < 0n);
  const n = numerador < 0n ? -numerador : numerador;
  const d = denominador < 0n ? -denominador : denominador;
  const q = (2n * n + d) / (2n * d);
  return negativo ? -q : q;
}
```

### Bloco do Início (forma)
```typescript
// Source: molde de components/amassa/inicio/bloco-producao.tsx:40-83
export async function BlocoEstoque() {
  let falhou = false;
  let acabando: ItemAcabando[] = [];
  try {
    acabando = itensAcabando(await listarSaldos()); // lib/estoque/saldo.ts, puro
  } catch (erro) {
    console.error("Falha ao carregar o estoque no Início:", erro);
    falhou = true;
  }
  // falhou → <EstadoErro corpo={TEXTOS_DOS_BLOCOS.estoque.erro} acao={<TentarDeNovo />} />
  // vazio  → <p>{TEXTOS_DOS_BLOCOS.estoque.vazio}</p>
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tabela `materiais` + view `saldos_materiais` (`02-MODELO-DE-DADOS.md` §4) | `itens_catalogo` + `movimentacoes_estoque` + consulta | ADENDO 20/09; ROADMAP corrigido 29/09 | Nada de `materiais`, nada de view |
| `origem manual \| financeiro` | `venda \| compra \| producao \| manual` | ADENDO §3 | Enum novo |
| Custo médio = média simples de todas as entradas (protótipo `custoMedio`, `prototipo.html:592-598`) | Custo médio do instante, gravado por saída | ADENDO §4 | Histórico não muda de valor quando entra compra nova |
| Destino "Venda na loja" | Removido; venda só pelo Financeiro | ADENDO §3 | Saídas manuais: 5 destinos |

**Deprecated/outdated:**
- `06-CONTEXT.md` ("Reusable Assets") diz que `lib/cadastros/catalogo.ts` chama
  `efeitoNoEstoque` — **não chama**; a única menção é um comentário na linha 26 sobre
  `unidadeExibida`. Os chamadores reais são `painel-venda.tsx:433`, `painel-despesa.tsx:399` e o
  `import type` de `lib/financeiro/consultas.ts:21` `[VERIFIED: Grep]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A checagem de FK segura `FOR KEY SHARE` na linha referenciada | Pergunta 5 | Se não segurar, `FOR UPDATE` também funcionaria; `NO KEY UPDATE` continua correto — risco nulo na recomendação |
| A2 | `on delete set null` funciona mesmo com `revoke update` de `amassa_app` (ação referencial roda como dono) | Pitfall 10 | Excluir encomenda com baixa daria erro; o teste de migração pedido detecta |
| A3 | Estorno de compra ao custo corrente (não ao original) é aceitável para o dono | Pergunta 3 | O médio não "desmistura" compra cancelada; é regra de dinheiro — o dono pode preferir outra |
| A4 | Estorno de venda ao custo que a venda levou (não ao atual) | Pergunta 3 | Idem; afeta o valor em estoque, não o saldo |
| A5 | Saída com saldo zero usa o custo da última entrada com preço; sem nenhuma, custo zero | Pergunta 3 | Saída sem custo aparece como R$ 0,00 no "Para onde foi" |
| A6 | A área que "paga" a baixa de uma venda é a área da categoria de venda da linha | Pergunta 1 | "Para onde foi" atribuiria consumo à área errada |
| A7 | `saldo <= mínimo` (igual ao protótipo, `prototipo.html:607-608`) conta como "acabando" | EST-03 | Com `<`, item exatamente no mínimo não alerta |

## Open Questions (RESOLVED)

> Todas as sete resolvidas em 29/09/2026 — pelas decisões do `06-CONTEXT.md` (D-17 refinado, D-20
> corrigido, D-21 refinado, D-29, D-30, D-31) e pelos planos `06-01`..`06-11` (numeração da revisão 1
> do planejamento). O texto original de cada pergunta foi mantido; a linha **RESOLVED** embaixo diz
> como ficou e onde está.

1. **Apagar item do catálogo (D-20) versus `revoke delete` do FNC-10.**
   - O que se sabe: o D-20 `[auto]` permite apagar item sem movimentação e sem venda; o banco hoje
     proíbe e o teste de migração afirma a proibição.
   - Recomendação: `grant delete` + FKs como guarda (Pitfall 8, opção a) é seguro e testável, mas
     mexe numa garantia do dono. Se o planejador não quiser esperar o dono, entregar **só desativar**
     nesta fase e deixar o apagar para quando ele confirmar — desativar cobre toda a necessidade do
     D-11.
   - **RESOLVED (29/09/2026):** só desativar nesta fase (D-20 corrigido pela pesquisa). Nenhum
     `grant delete`: o `revoke delete on itens_catalogo` da `0015` continua e `itens_catalogo` segue em
     `TABELAS_SEM_DELETE`. Plano 06-08 (`definirItemAtivo`, a ação única de desativar/reativar, no
     Cadastros), plano 06-09 (desativar pelo Estoque, pela mesma ação) e plano 06-02 (`test:migracoes`
     confirma a tabela em `TABELAS_SEM_DELETE`). Apagar fica para quando o dono confirmar.
2. **Saldo negativo com mínimo zero alerta?** EST-04 (travado): "mínimo zero nunca entra em alerta";
   D-21 `[auto]`: "saldo negativo conta como acabando" no Início. Recomendação: tratar negativo como
   **aviso próprio** ("saldo negativo"), distinto de "abaixo do mínimo", para o EST-04 continuar
   literalmente verdadeiro; mostrar os dois no bloco do Início com rótulos diferentes.
   - **RESOLVED (29/09/2026):** como recomendado — D-21 refinado: saldo negativo é aviso próprio
     (“Saldo negativo”, em `--color-erro`), separado de “abaixo do mínimo” (“Acabando”, âmbar), e
     mínimo zero nunca alerta, então o EST-04 continua literal. A regra é uma função só,
     `situacaoDoSaldo` (plano 06-04: negativo vence, nunca os dois chips); o bloco do Início mostra os
     dois com rótulos diferentes (plano 06-10).
3. **O que é a "categoria Peça pronta" (D-09/EST-21) no banco.** A semente tem `('Peças prontas',
   'receita', 'pecas')` `[VERIFIED: db/migrations/0016_categorias-iniciais.sql]` — categoria de
   **venda**. Mas item com estoque exige categoria de **compra** (grupo `custo`/`geral`), e a
   Precificação cria itens com `aparecenaVenda: true` e sem estoque (`lib/precificacao/acoes.ts:251-259`).
   Para uma peça pronta ter saldo, alguém precisa ligar "Tem estoque próprio" e escolher uma
   categoria de compra — qual? (`Argila, esmalte e insumos` é `custo/pecas`.) Recomendação: o
   Estoque identifica peça pronta por **ter ficha de precificação ligada** (`fichas_precificacao.item_catalogo_id`
   — é o que o D-22 precisa), sem depender de nome de categoria; perguntar ao dono se quer uma
   categoria de compra própria semeada.
   - **RESOLVED (29/09/2026):** D-29 — peça pronta é o material com ficha de precificação ligada,
     nunca um nome de categoria. `ehPecaPronta` em `listarSaldos` (plano 06-04); `peca_pronta` e o
     custo pela ficha decididos no servidor (plano 06-05); o custo preenchido e editável na folha
     (plano 06-06, D-22). Nenhuma categoria é semeada nesta fase; a pergunta da categoria de compra
     própria vai ao dono na Parte 0 da caminhada (plano 06-11).
4. **Ficha de preço "exclusiva" desliga o item** (`lib/precificacao/acoes.ts:328-343`) — o item
   continua existindo e vendável. Deveria virar `ativo = false`? Fora do escopo declarado; registrar.
   - **RESOLVED (29/09/2026):** fora do escopo da Fase 06, registrado aqui. Nenhum plano muda
     `lib/precificacao/acoes.ts`: o comportamento de hoje continua (o item fica existindo, vendável e
     com `ativo` verdadeiro, o padrão da coluna nova). Se o dono quiser que a ficha exclusiva desative
     o item, é trabalho para depois, sobre o `definirItemAtivo` do plano 06-08.
5. **Saldo inicial pela diferença (Pitfall 3).** Muda a letra do D-17 ("entrada manual") só no caso de
   já haver movimentação antes da contagem. Recomendação: implementar pela diferença e dizer isso na
   tela ("o saldo passa de −2 para 10"), que é a regra "o saldo passa de X para Y" do protótipo.
   - **RESOLVED (29/09/2026):** pela diferença, contra o saldo do instante, sob a trava — D-17
     refinado pela pesquisa. Plano 06-10: `planejarContagem` (sobre o `planejarAjuste` do plano 06-05)
     e `gravarContagem`, que decide o modo e a diferença depois da trava; a tela diz “o saldo passa de
     −2 para 10”, e o e2e `estoque contagem` prova o caso da venda antes da contagem.
6. **Compra paga com valor diferente depois da entrada (Pitfall 14).** Opções: aceitar (o custo do
   estoque é o da nota lançada) ou gravar uma movimentação de correção de custo (quantidade zero não
   é permitida pelo `check`, então seria outro tipo). Recomendação: aceitar nesta fase e registrar.
   - **RESOLVED (29/09/2026):** aceito e registrado — D-30: o custo do estoque é o da nota lançada;
     nenhuma movimentação de correção de custo nesta fase (fora do escopo). O plano 06-03 tem a
     verdade que o afirma (“Paguei” com valor diferente não gera movimentação).
7. **"Para onde foi" inclui as vendas?** O protótipo mostrava "Venda na loja" como destino; o adendo
   tirou-o das saídas **manuais**. Recomendação: mostrar a baixa por venda como uma barra própria
   ("Vendido · pelo Financeiro"), com a área da linha, porque é consumo real de insumo.
   - **RESOLVED (29/09/2026):** sim, como recomendado — D-31: a barra própria “Vendido · pelo
     Financeiro”, com uma linha por área que vendeu, entre as seis barras sempre presentes; venda
     cancelada não conta (Pitfall 15). Plano 06-07 (`agregarParaOndeFoi`). “Venda na loja” segue fora
     das saídas manuais (D-15; plano 06-06 afirma a ausência).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, testes | ✓ | v24.19.0 | — |
| Docker (daemon) | `npm run test:migracoes`, `npm run test:e2e` (Postgres efêmero) | ✓ | 29.6.2 (servidor respondeu) | — |
| Postgres de produção | aplicar `0023` | — (servidor do dono) | — | Dono aplica à mão depois de backup |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** nenhuma.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (unit) · Playwright ^1.62.1 (e2e) · `scripts/testar-migracoes.mjs` (banco efêmero) |
| Config file | `vitest.config.ts` (`include: ["tests/unit/**/*.test.ts"]`), `playwright.config.ts` |
| Quick run command | `npx vitest run tests/unit/estoque-*.test.ts` |
| Full suite command | `npm run verificar` (lint, tsc, verificar-acoes, unit, test:migracoes) + `npm run test:e2e` (uma varredura completa por fase, no último plano) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EST-01 | 5 kg − 2 kg = 3 kg | unit + e2e | `npx vitest run tests/unit/estoque-custo.test.ts` | ❌ Wave 0 |
| EST-03/04 | acabando só com mínimo > 0; `<=` | unit | `npx vitest run tests/unit/estoque-saldo.test.ts` | ❌ Wave 0 |
| EST-06 | sem update/delete para `amassa_app` | migração | `npm run test:migracoes` | ✅ (acrescentar asserção) |
| EST-07/08 | ajuste pede contado; zero não grava | unit + e2e | `estoque-saldo.test.ts`; `npm run test:e2e -- --grep "ajuste"` | ❌ Wave 0 |
| EST-10 | saldo = soma do histórico | e2e | `--grep "soma do histórico"` | ❌ |
| EST-12 | área compra → venda | unit | `estoque-saldo.test.ts` | ❌ |
| EST-14 | venda grava na mesma transação; efeito por linha = efeito do documento | unit + e2e | `tests/unit/financeiro-efeito-estoque.test.ts` (acrescentar) + `--grep "venda baixa"` | ✅ parcial |
| EST-15 | compra dá entrada com custo da linha | e2e | `--grep "compra entra"` | ❌ |
| EST-16 | cancelar estorna; estorno único | migração + e2e | `test:migracoes` (índice único) + `--grep "estorno"` | ❌ |
| EST-17 | documento anterior não estorna; contagem inicial | e2e (`@vazio-global`) | cadeia `vazio-*` | ❌ |
| EST-18 | negativo não bloqueia venda | e2e | `--grep "negativo"` | ❌ |
| EST-19 | custo do instante, R1–R6, invariantes | unit (casos da tabela + sequências aleatórias com semente fixa) | `estoque-custo.test.ts` | ❌ |
| EST-09 | < 15 s no celular | manual | roteiro de verificação humana | — |
| Concorrência | duas baixas / venda × ajuste | migração (duas conexões) ou unit do plano | `test:migracoes` | ❌ |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/estoque-*.test.ts` + `npx tsc --noEmit`
- **Per wave merge:** `npm run verificar`
- **Phase gate:** `npm run verificar` verde + uma varredura `npm run test:e2e` completa no último plano

### Wave 0 Gaps
- [ ] `tests/unit/estoque-custo.test.ts` — R1–R6, os 7 casos da tabela, invariantes
- [ ] `tests/unit/estoque-saldo.test.ts` — acabando, negativo, ajuste, área, "o saldo passa de X para Y"
- [ ] `tests/unit/financeiro-efeito-estoque.test.ts` — acrescentar a equivalência por linha
- [ ] `scripts/testar-migracoes.mjs` — `TABELAS_ESPERADAS`, `revoke update/delete`, `check`s de sinal,
      índice único do estorno, `on delete set null` da encomenda, (se Open Question 1 → a) delete em `itens_catalogo`
- [ ] `tests/e2e/estoque-*.spec.ts` — com os testes de estado global marcados `@vazio-global`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (nada muda) | Auth.js existente |
| V3 Session Management | não | — |
| V4 Access Control | sim | `exigirUsuario()` na primeira linha de toda ação; `verificar-acoes`; `revoke update, delete` no banco |
| V5 Input Validation | sim | Zod no servidor; quantidade/valor/área/destino **nunca** vindos do cliente sem conferência (a área de venda e o custo vêm do banco) |
| V6 Cryptography | não | — |
| V11 Business Logic | sim | trava de linha; estorno único; custo calculado no servidor |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cliente forja custo/quantidade da movimentação | Tampering | Servidor recalcula tudo (efeito, custo) dentro da transação; cliente manda só ids e textos |
| Estorno duplo / estorno forjado | Tampering | Trava do documento + índice único em `estorno_de_id`; estorno só nasce dentro de `cancelarDocumento` |
| Apagar/editar histórico | Repudiation | `revoke update, delete` para `amassa_app`; nenhuma ação de edição |
| Função auxiliar exportada de arquivo "use server" vira endpoint sem autenticação | Elevation of Privilege | Ajudante com `tx` em `lib/estoque/gravacao.ts` sem a diretiva; `verificar-acoes` barra |
| Corrida entre gestores | Tampering | `for no key update` ordenado |
| Mensagem de erro do banco na tela | Information Disclosure | Frase humana; SQLSTATE só no log via `codigoDoErroPostgres` |

## Sources

### Primary (HIGH confidence — lidos nesta sessão)
- `lib/financeiro/acoes.ts` (inteiro), `lib/financeiro/efeito-estoque.ts` (inteiro), `lib/financeiro/consultas.ts:1-420`, `lib/financeiro/esquemas.ts:295-434`, `lib/financeiro/dinheiro.ts:154-170`
- `db/schema.ts:530-1058, 1300-1334`; `db/migrations/0003`, `0015`, `0016`, `0022`; `db/migrations/meta/_journal.json`
- `lib/cadastros/acoes.ts:1-781`, `lib/cadastros/consultas.ts:60-263`, `lib/cadastros/catalogo.ts:1-60,150-161`
- `lib/anotacoes/acoes.ts`, `lib/encomendas/acoes.ts:303-352`, `lib/orcamentos/acoes.ts:290-334, 1150-1320`, `lib/precificacao/acoes.ts:236-385`, `lib/precificacao/calculo.ts:30-160`
- `components/amassa/inicio/*` (bloco-estoque, bloco-do-inicio, bloco-producao, tentar-de-novo, bloco-esqueleto, pilulas-de-atalho), `app/gestao/(app)/page.tsx`, `lib/inicio/textos.ts`
- `scripts/testar-migracoes.mjs:26-75, 1190-1235`, `scripts/verificar-acoes.mjs:1-60`, `playwright.config.ts:40-160`, `package.json`
- `.planning/phases/06-estoque/{06-CONTEXT.md, ADENDO.md, prototipo.html:425-1400}`, `.planning/REQUIREMENTS.md` §Estoque, `.planning/ROADMAP.md:768-798`, `amassa-plataforma/02-MODELO-DE-DADOS.md:70-110, 555-662`
- `node_modules/drizzle-orm/pg-core/query-builders/select.types.d.ts:60`

### Secondary (MEDIUM)
- PostgreSQL docs, Explicit Locking (FOR NO KEY UPDATE × FOR KEY SHARE) — https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL docs, Transaction Isolation (READ COMMITTED por comando) — https://www.postgresql.org/docs/current/transaction-iso.html

### Tertiary (LOW pelo classificador — `webfetch`; é o código-fonte primário)
- ERPNext `get_moving_average_values` — https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/stock_ledger.py

## Metadata

**Confidence breakdown:**
- Integração (perguntas 1, 2, 4, 6, 7): HIGH — cada afirmação com arquivo e linha lidos.
- Concorrência (pergunta 5): HIGH na recomendação; A1 é suposição sobre FK que não muda a recomendação.
- Custo médio (pergunta 3): MEDIUM — algoritmo consistente e com exemplos; as regras de estorno (A3/A4) são decisões de dinheiro que o dono não tomou.
- Pitfalls: HIGH nos que citam código; MEDIUM no 16 (depende da UI-SPEC).

**Research date:** 2026-09-29
**Valid until:** 2026-10-29 (código estável; revalidar se `lib/financeiro/acoes.ts` mudar antes do planejamento)
