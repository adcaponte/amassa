---
phase: 06-estoque
plan: 09
subsystem: estoque
status: complete
tags: [estoque, folha-do-material, novo-material, editar-material, desativar, EST-01, EST-02, EST-10, EST-13, EST-20, D-01, D-20, UI-D3, UI-D12]
requires:
  - "06-04: listarSaldos, CartaoSaldo/TabelaSaldos (ChipDoSaldo, formatarMilesimos, textoDoCustoMedio, textoDoMinimo)"
  - "06-06: ProvedorDoEstoque (abrirFolha), FolhaMovimentacao, CLASSE_DA_FOLHA, BarraAcaoFixa"
  - "06-07: LinhaMovimentacao (comNome), descreverMovimentacao, listarHistorico, LIMITE/PASSO do histórico, semearMovimentacoesEmMassa"
  - "06-08: definirItemAtivo, categoriaDeCompraValida em catalogo.ts, ConfirmarDesativacao, textoMaterialDesativado"
provides:
  - "lib/estoque/historico.ts: textoGastoPor, ordenarGastoPor, ProdutoQueGasta (puros)"
  - "lib/estoque/esquemas.ts: esquemaLerMaterial, esquemaNovoMaterial, esquemaSalvarMaterial, entradaDeItemDoMaterial, campoDoMaterial, CampoDoMaterial"
  - "lib/estoque/consultas.ts: historicoDoMaterial (mesma consulta de listarHistorico), resumoDoMaterial, gastoPor, estadoDoEstoque ({ temMaterial, temManual }), listarCategoriasDeCompraAtivas"
  - "lib/estoque/acoes.ts: lerFolhaDoMaterial, criarMaterial, salvarMaterial (verificar-acoes: 79 ações, 0 violações)"
  - "components/amassa/estoque: FolhaMaterial, FolhaNovoMaterial, FolhaEditarMaterial, BotaoNovoMaterial; provedor com abrirFolhaDoMaterial, abrirNovoMaterial e abrirFolha aceitando o material recém-cadastrado"
  - "DadosDoEstoque.categoriasDeCompra (lido por lerDadosDoEstoque junto com a lista)"
  - "data-testid: estoque-historico-material, folha-material(-resumo/-saldo/-observacoes/-gasto-por/-gasto-por-lista/-lista/-mais/-nota-soma/-vazio/-erro/-carregando/-editar/-registrar/-reativar/-fechar), estoque-novo-material, estoque-acao-fixa-material, estoque-vazio-novo-material, folha-novo-material, novo-material-(nome/unidade/categoria/minimo/observacoes/cadastrar/sem-categoria/motivo), folha-editar-material, editar-material-(catalogo/minimo/observacoes/desativar/salvar), material-erro (data-campo)"
  - "tests/e2e/estoque-material.spec.ts: estoque material folha (a–g) e estoque material cadastro (a–f)"
affects: [06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "leitura de folha por Server Action disparada NO TOQUE e lida com use() dentro de Suspense — sem efeito que busque dado; 'Mostrar mais' e recarga trocam a promessa numa transição"
    - "validação emprestada: a ação do Estoque monta a entrada no formato de esquemaItem e usa a fábrica do Cadastros, e as frases saem sozinhas"
    - "erro de ação volta com o campo (ResultadoDoMaterial { erro, campo }), decidido pelo caminho do Zod ou pela frase de validarItem"
key-files:
  created:
    - components/amassa/estoque/folha-material.tsx
    - components/amassa/estoque/folha-novo-material.tsx
    - components/amassa/estoque/folha-editar-material.tsx
    - tests/e2e/estoque-material.spec.ts
  modified:
    - lib/estoque/historico.ts
    - lib/estoque/esquemas.ts
    - lib/estoque/consultas.ts
    - lib/estoque/acoes.ts
    - lib/estoque/textos.ts
    - app/gestao/(app)/estoque/page.tsx
    - components/amassa/estoque/provedor-estoque.tsx
    - components/amassa/estoque/cartao-saldo.tsx
    - components/amassa/estoque/tabela-saldos.tsx
    - components/amassa/estoque/aba-saldos.tsx
    - components/amassa/estoque/barra-acao-fixa.tsx
    - components/amassa/estoque/secao-saldos.tsx
    - components/amassa/estoque/carregador-do-seletor.tsx
    - components/amassa/estoque/folha-movimentacao.tsx
    - tests/unit/estoque-historico.test.ts
    - tests/unit/estoque-esquemas.test.ts
    - tests/e2e/estoque-tracador.spec.ts
decisions:
  - "temMaterial de estadoDoEstoque conta QUALQUER item com estoque próprio, ativo ou desativado. É a mesma condição do vazio da SecaoSaldos (listarSaldos sem linha). O plano dizia 'controla_estoque e ativo'; com essa leitura, um estoque só de desativados perderia a barra e o cabeçalho sem mostrar o vazio, e não haveria como cadastrar material pelo Estoque. O seletor já tem a frase 'Nenhum material ativo.' (06-06) para esse caso."
  - "'Gasto por' lista só produtos ATIVOS. Produto desativado não vende, então não gasta. É a mesma leitura de definirItemAtivo, que só olha fichas de produto ativo."
  - "Mínimo vazio vale zero ('sem mínimo'). O campo começa em 0, e apagá-lo não é erro. Negativo, texto e 4 casas levam 'O mínimo precisa ser zero ou mais.'; acima de 999.999, a frase de converterQuantidade."
  - "criarMaterial valida primeiro pela fábrica do Cadastros (nome, unidade, categoria) e só depois o mínimo e as observações, para o primeiro erro seguir a ordem dos campos da folha."
  - "Depois de salvar ou desativar, a folha de editar fecha tudo (o molde do protótipo, salvarMat → fecharFolha). Reativar fica na folha do material, que se relê e troca o rodapé para 'Registrar movimentação'."
  - "O cabeçalho da folha Novo material é 'Novo material' / 'O que passa a ser controlado' (sub do protótipo); o de editar é 'Editar material' / o nome. A UI-SPEC não fixa esses títulos."
  - "Sem categoria de compra ativa, o motivo à vista ao lado do botão indisponível é 'Sem uma categoria de compra ativa, o material não tem área — crie a categoria primeiro.' (frase nova; a UI-SPEC só pede o motivo visível). D-29 continua aberta: nenhuma categoria foi semeada."
  - "'Mostrar mais 50' da folha some no teto de 1000, como na aba Histórico. Nesse caso a nota da soma também não aparece, porque a lista continua incompleta."
metrics:
  duration: "~27 min (07:58 → 08:25 horário local, 29/09/2026)"
  completed: 2026-09-29
  tasks: 2
  files: 21
estimate:
  tokens: 95000
  tasks: 2
actuals:
  tokens: 34000
  tasks: 2
  commits: 3
---

# Phase 06 Plan 09: O material de perto e o material novo Summary

**O dono cadastra "Argila" em kg pelo "+ Novo material". A folha de movimentação abre sozinha em
Entrada; ele registra 5 kg por R$ 21,00, dá baixa de 2 kg e o cartão mostra 3 kg. Isso foi provado
no celular e no desktop. O botão "Histórico" do cartão abre o livro daquele material, e a soma das
quantidades listadas dá o saldo do cartão, mesmo com ajuste, saldo negativo e venda cancelada. Um
insumo mostra em quais produtos é gasto. "Editar material" muda só o mínimo e as observações.
Desativar passa pela ação única do Cadastros, e a confirmação diz que nada é apagado.**

## O que foi feito

### Tarefa 1: a folha de um material (`631be74` RED, `0bb2e26` GREEN)

**Funções puras (`historico.ts`)**
- `textoGastoPor` monta "Café 200 ml (15 g) · Café refil (30 g)" com `formatarQuantidade` e o
  rótulo da unidade ("L").
- `ordenarGastoPor` ordena por `Intl.Collator("pt-BR")` e não muta a entrada.

**Esquema (`esquemas.ts`)**
- `esquemaLerMaterial` aceita um limite múltiplo de 50, entre 50 e 1000. Qualquer outro vira 50
  (T-06-42).

**Consultas (`consultas.ts`)**
- `listarHistorico` e `historicoDoMaterial` dividem a mesma consulta, `lerLinhasDoLivro`, e só o
  filtro muda. O `orderBy(desc(numero))` continua existindo uma vez.
- `listarSaldos` passou a delegar para `lerSaldos(filtroExtra)`. `resumoDoMaterial` é essa linha
  mais as observações e a contagem de movimentações.
- `gastoPor` faz um `join` de `ficha_tecnica` com o produto ativo.

**Ação `lerFolhaDoMaterial`**
- `exigirUsuario()` vem primeiro, depois o Zod.
- Devolve o resumo, o "gasto por", a página do livro, `temMais` e o `agora` do servidor.
- Falha de banco vira a frase da UI-SPEC e fica só no log com o SQLSTATE.

**`FolhaMaterial`**
- A leitura começa no toque, no provedor, e a folha a lê com `use()` dentro de um `Suspense` com 3
  linhas de esqueleto. O erro aparece dentro da folha, com "Tentar de novo".
- O resumo fica em `superficie-2`, com o saldo em `text-display` na cor da situação (P17a/P17b) e a
  linha "{R$}/{un} · {R$} em estoque · mínimo…". Depois vêm as observações e o "Gasto por", com o
  link para o Catálogo.
- A lista usa a mesma `LinhaMovimentacao comNome={false}`. "Mostrar mais 50" roda numa transição,
  e a lista antiga fica na tela até a nova chegar.
- A nota da soma só aparece quando a lista está completa.
- Rodapé: "Editar" · "Registrar movimentação", ou "Reativar material" ("Reativando…",
  `aria-busy`), que chama `definirItemAtivo` e relê a folha.

**Cartão, tabela e provedor**
- Cartão e tabela ganharam o botão "Histórico" (`outline`, 44px, `aria-label="Histórico de
  {nome}"`), inclusive no material desativado, onde ele fica sozinho.
- O provedor ganhou `abrirFolhaDoMaterial`. Uma folha por vez: `fecharTudo` fecha qualquer outra.

### Tarefa 2: "+ Novo material", "Editar material" e desativar (`7731da4`)

**`criarMaterial`**
- `exigirUsuario()` vem primeiro.
- Valida com `esquemaItem(new Map())` sobre `entradaDeItemDoMaterial(entrada)`: sem venda, com
  estoque, sem ficha. As frases do Cadastros saem sozinhas.
- Depois aplica `esquemaNovoMaterial` (mínimo e observações), lê a categoria e confere com
  `categoriaDeCompraValida(categoria, id, null)`.
- Faz o `insert` e revalida Estoque, Cadastros, Financeiro e Início. Devolve id, nome, unidade,
  mínimo, área e categoria.

**`salvarMaterial`**
- Faz `.set({ estoqueMinimoMilesimos, observacoes })` num item com estoque próprio. Nenhuma outra
  coluna.

**Erros**
- Os erros voltam com `campo`, e cada folha mostra a frase embaixo do campo, com
  `data-testid="material-erro"`, `data-campo` e `role="alert"`. O foco vai até o campo.

**Página**
- `estadoDoEstoque()` roda antes de pintar.
- Sem material: sem ações no cabeçalho, sem a barra fixa e sem a reserva de altura dela. O vazio
  ganha "+ Novo material" primário.
- Se a leitura falha, a página segue como se houvesse material.
- A partir de 768px, o cabeçalho ganha "+ Novo material" (`outline`) antes de "Registrar
  movimentação". A barra fixa ganhou "+ Material" (`outline`, 52px).

**`FolhaNovoMaterial`**
- Campos: Nome; Unidade (un, g, kg, ml, L, m); Categoria da compra, com as opções "{categoria} ·
  {área}" e a dica "diz a área — {área}"; Estoque mínimo, que começa em "0"; Observações.
- Traz a nota da contagem e a linha do Catálogo.
- Sem categoria de compra ativa, a frase com o link para Cadastros → Categorias entra no lugar do
  seletor, e o botão fica indisponível com o motivo à vista.
- "Cadastrando…" e uma guarda síncrona barram o toque duplo.
- No sucesso, o provedor mostra o toast e abre a folha de movimentação em Entrada com um
  `SaldoDoItem` sintético (saldo 0). A linha da lista vale assim que o `router.refresh()` a traz.

**`FolhaEditarMaterial`**
- Nome, unidade e categoria (com a área) aparecem só para leitura, com o link "Nome, unidade e
  categoria mudam em Cadastros → Catálogo". Os campos são o mínimo "em {un}" e as observações.
- Rodapé: "Desativar material" (`outline`, texto na cor da tinta; não aparece no material
  desativado) · "Salvar material".
- `ConfirmarDesativacao` recebe `substantivo="material"`, o N de movimentações e o saldo. A recusa
  (insumo de ficha ativa) aparece dentro do diálogo, com o link. Toast "{nome} desativado.
  Continua no filtro Desativados.".

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/estoque-historico.test.ts` (RED) | 11 falharam, 38 passaram (funções e esquema inexistentes) |
| o mesmo, depois do código | 49 passaram |
| `npx vitest run tests/unit/estoque-esquemas.test.ts` (Tarefa 2) | 39 passaram |
| `npm run verificar` (Tarefa 1) | exit 0: lint e `tsc` limpos; `verificar-acoes: 77 ação(ões) conferida(s), 0 violações` (as duas linhas "1 violação" são os fixtures do próprio verificador); `Test Files 91 passed`, `Tests 1575 passed`; `test:migracoes`: "Todas as afirmações passaram." |
| **e2e invocação 1** (`npm run test:e2e -- --grep "estoque material folha\|estoque saldos"`) | **74 passed (1.0m)**, desktop e celular, com a cadeia `vazio-*` |
| `npm run verificar` (Tarefa 2) | exit 0: `verificar-acoes: 79 ação(ões) conferida(s), 0 violações`; `Tests 1589 passed`; `test:migracoes` passou |
| **e2e invocação 2** (`npm run test:e2e -- --grep "estoque material cadastro\|estoque tracador\|estoque movimentacao"`) | **80 passed (1.2m)**: `estoque material cadastro` (a–f) nos dois projetos, `estoque tracador` (com o `@vazio-global` atualizado) e `estoque movimentacao` (a–k) |

**Duas invocações de e2e, uma por tarefa**, como o orçamento do plano previa. Nenhuma falhou.
Não rodei `npm run build` separado nem a varredura sem `--grep`, que fica para o último plano da
fase.

**Greps de aceite**

| Grep | Resultado |
|---|---|
| `LinhaMovimentacao` em `folha-material.tsx` | 3 |
| `export async function lerFolhaDoMaterial` | 1 |
| `esquemaItem(` em `lib/estoque/acoes.ts` | 1 |
| `categoriaDeCompraValida` em `lib/estoque/acoes.ts` | 3 |
| o `awk` do `.set(` de `salvarMaterial` procurando `nome\|unidade\|categoriaCompraId` | 0 |
| `delete(itensCatalogo)` em `lib` e `app` | nada |
| `definirItemAtivo` em `folha-editar-material.tsx` + `folha-material.tsx` | 5 |
| `set({…ativo` em `lib/estoque` | nada |

**Branch**
- Tudo ficou em `gsd/phase-06-estoque`. `main` continua em `a8c7bad`.
- Nada foi publicado e nenhuma migração foi aplicada. Este plano não criou migração: todas as
  colunas usadas já existem na 0023.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Consistência] `temMaterial` conta item desativado**
- **Issue:** o plano define `temMaterial` como "itens com `controla_estoque` e `ativo`". Com só
  materiais desativados, a página esconderia a barra e o "+ Novo material" do cabeçalho, mas a aba
  Saldos não mostraria o vazio (a lista tem os desativados). Não sobraria caminho para cadastrar
  material pelo Estoque.
- **Fix:** `temMaterial` usa a mesma condição do vazio da seção: existe item com estoque próprio.
  As duas decisões não podem discordar. O caso "só desativados" continua coberto pela frase
  "Nenhum material ativo." do seletor (06-06).
- **Commit:** `7731da4`

**2. [Rule 3 - Blocking] `milesimosParaCampo` exportado de `folha-movimentacao.tsx`**
- A folha de editar precisa pôr o mínimo no campo sem separador de milhar ("1.000" voltaria como 1).
  A função era privada. Ganhou `export` para não ser duplicada. O arquivo está fora de
  `files_modified`, e a mudança é uma palavra.
- **Commit:** `7731da4`

**3. [Rule 3 - Blocking] `carregador-do-seletor.tsx` lê as categorias de compra**
- `lerDadosDoEstoque` passou a trazer `listarCategoriasDeCompraAtivas()` em paralelo, e
  `DadosDoEstoque` ganhou `categoriasDeCompra`. Assim o "+ Novo material" abre sem consulta nova, em
  qualquer aba. O arquivo está fora de `files_modified`.
- **Commit:** `7731da4`

**4. [Processo] Formatação revertida no meio da Tarefa 1**
- Rodei `prettier --write` sobre `lib/estoque/*.ts` e componentes. Ele reformatou código antigo, em
  `printWidth` 90, que o projeto não segue, inclusive em cinco arquivos fora do plano (`custo.ts`,
  `destinos.ts`, `gravacao.ts`, `pedidos.ts`, `saldo.ts`).
- Voltei os cinco e reapliquei as minhas mudanças sobre a versão do HEAD nos arquivos do plano.
- Nada disso chegou a commit: os diffs commitados só têm as linhas deste plano. Só
  `folha-material.tsx`, arquivo novo, ficou no formato do prettier.

### Escolhas dentro do plano (ver `decisions`)

- "Gasto por" mostra só produtos ativos.
- Mínimo vazio vale zero.
- A ordem da validação segue os campos da folha.
- Salvar e desativar fecham a folha de editar.
- Títulos das folhas novas e a frase do motivo sem categoria.
- Teto de 1000 na folha do material.

### Testes além do pedido

- `esquemaLerMaterial` está em `estoque-historico.test.ts`, que é o arquivo listado na Tarefa 1.
  Os casos de `esquemaNovoMaterial`, `esquemaSalvarMaterial`, `entradaDeItemDoMaterial` +
  `esquemaItem` e `campoDoMaterial` estão em `estoque-esquemas.test.ts`: NFC e pontos de código no
  nome e nas observações, 500/501, 4 casas, vazio → nulo, nome repetido aceito.
- No e2e (a) da folha, afirmei também que a ordem é a do livro (`numero` decrescente) e que a linha
  não repete o nome do material. No (e), depois de "Mostrar mais 50", as 51 linhas e a nota
  aparecem.

## Known Stubs

Nenhum. As três conferências `backstop` do plano ficam para o dono, no portão do 06-11:
- "Gasto por" com 8 fichas ou mais: a lista quebra por palavra e não é truncada.
- O resumo a 320px com "−1.234,5 kg" e valores de 6 dígitos.
- O "+ Novo material" sem nenhuma categoria de compra ativa, desativando as categorias no banco de
  teste (ligado a D-29).

O painel da primeira abertura (UI-D3, `temManual`) é do plano 06-10. `estadoDoEstoque` já devolve
`temManual`, e a página ainda não usa esse valor.

## Threat Flags

Nenhuma superfície fora do `<threat_model>`:
- **T-06-39:** `exigirUsuario()` é a primeira instrução das três ações novas (`verificar-acoes`: 79,
  0 violações).
- **T-06-40:** `esquemaItem` + `categoriaDeCompraValida` com a categoria lida do banco.
- **T-06-41:** o `set` de `salvarMaterial` escreve só duas colunas (grep do `awk` = 0), e o gatilho
  da 0023 guarda a unidade.
- **T-06-42:** `esquemaLerMaterial` limita a página.
- **T-06-43:** aceito. As observações só aparecem dentro da plataforma, atrás do login.

## TDD Gate Compliance

- Tarefa 1: `test(06-09)` `631be74` → `feat(06-09)` `0bb2e26`
- Tarefa 2 (sem `tdd="true"`): `feat(06-09)` `7731da4`, com os testes unitários no mesmo commit

## Self-Check: PASSED

- `components/amassa/estoque/folha-material.tsx`, `folha-novo-material.tsx`,
  `folha-editar-material.tsx` e `tests/e2e/estoque-material.spec.ts`: FOUND
- Os commits `631be74`, `0bb2e26` e `7731da4` estão em `gsd/phase-06-estoque`.
- `STATE.md` e `ROADMAP.md` não foram tocados (ficam com o orquestrador).
