---
phase: 06-estoque
plan: 08
subsystem: cadastros, financeiro
status: complete
tags: [estoque, desativar-item, fnc-10, trava-de-unidade, venda, saldo-negativo, d-20, d-21]
requires:
  - "06-01: coluna itens_catalogo.ativo, tabela movimentacoes_estoque e o gatilho travar_unidade_do_item_com_movimentacao (0023, não aplicada)"
  - "06-03: Venda/Compra já escondem item desativado e o servidor o recusa"
  - "06-04: listarSaldos, formatarMilesimos"
provides:
  - "lib/cadastros/acoes.ts::definirItemAtivo: a porta ÚNICA de ativar/desativar item. O Estoque (06-09) chama a mesma ação"
  - "lib/cadastros/catalogo.ts::podeDesativarItem, categoriaDeVendaValida, categoriaDeCompraValida (puras, exportadas)"
  - "lib/cadastros/esquemas.ts::esquemaAtivacaoDeItem"
  - "lib/cadastros/textos.ts::FRASE_ITEM_COM_MOVIMENTACAO, textoItemDesativado, textoMaterialDesativado, textoItemReativado e as frases da confirmação"
  - "components/amassa/cadastros/confirmar-desativacao.tsx::ConfirmarDesativacao (substantivo item | material)"
  - "editarItem trava unidade e 'Tem estoque próprio' de item com movimentação; o P0001 do gatilho da 0023 vira a mesma frase"
  - "listarCatalogoCompleto devolve ativo, movimentacoes, saldoMilesimos; desativados depois dos ativos"
  - "lib/financeiro/efeito-estoque.ts::formatarEfeitoComSaldo, materiaisQueFicamNegativos"
  - "lib/financeiro/textos.ts::textoAvisoVendaNegativa e as dicas novas do efeito"
  - "EfeitoEstoque/PainelVenda/PainelDespesa com prop saldos; aviso venda-aviso-negativo fora do details"
affects: [06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "desativar, nunca apagar: booleano com reativação na mesma tela, regra pura decidida sob a trava do item"
    - "leitura de outro módulo no Server Component num try/catch próprio, com null como fallback, para uma falha do Estoque não derrubar a Venda"
    - "o formato novo da linha só ACRESCENTA ao fim do texto antigo, e os e2e que leem o prefixo continuam valendo"
key-files:
  created:
    - components/amassa/cadastros/confirmar-desativacao.tsx
  modified:
    - lib/cadastros/catalogo.ts
    - lib/cadastros/esquemas.ts
    - lib/cadastros/textos.ts
    - lib/cadastros/acoes.ts
    - lib/cadastros/consultas.ts
    - components/amassa/cadastros/lista-catalogo.tsx
    - components/amassa/cadastros/dialogo-item-catalogo.tsx
    - components/amassa/cadastros/ficha-tecnica.tsx
    - tests/unit/cadastros-catalogo.test.ts
    - tests/e2e/cadastros-catalogo.spec.ts
    - lib/financeiro/efeito-estoque.ts
    - lib/financeiro/textos.ts
    - components/amassa/financeiro/efeito-estoque.tsx
    - components/amassa/financeiro/painel-venda.tsx
    - components/amassa/financeiro/painel-despesa.tsx
    - app/gestao/(app)/financeiro/page.tsx
    - tests/unit/financeiro-efeito-estoque.test.ts
    - tests/e2e/financeiro-venda.spec.ts
decisions:
  - "O toast de desativar no Cadastros é '{nome} desativado.', sem o 'Continua no filtro Desativados.' da UI-SPEC. O Catálogo não tem filtro e o item continua na lista com o chip. A frase do Estoque ficou pronta para o 06-09 em textoMaterialDesativado."
  - "O corpo da confirmação diz '1 movimentação' no singular. A UI-SPEC tem só '{N} movimentações'."
  - "Desativar/reativar no Cadastros fecha o diálogo e faz router.refresh() com toast no cliente. Não usa ?aviso= porque o toast leva o nome do item. É o molde de ConfirmarCancelar (Encomendas)."
  - "A trava de unidade é só do servidor, sem erro ao vivo no diálogo. O e2e (c) passa por editarItem de verdade, como o plano descreve ('trocar a unidade e salvar')."
  - "Os saldos descem da página para os painéis como Map (o React 19 serializa Map em prop de Client Component), e a mesma Map é a entrada das funções puras."
  - "O aviso de negativo só avalia materiais cujo saldo a consulta conhece. Um material fora de listarSaldos fica sem 'fica com' e sem aviso."
metrics:
  duration: "~18 min"
  started: "2026-09-29T06:39:59Z"
  completed: "2026-09-29T06:57:57Z"
  tasks: 2
  files: 19
actuals:
  tokens: 20800
  tasks: 2
  commits: 5
---

# Phase 06 Plan 08: O Estoque fora do Estoque — desativar item e o "fica com" da Venda Summary

O Cadastros → Catálogo agora desativa e reativa item e não apaga nunca. O `revoke delete` do FNC-10
continua. A regra "insumo de ficha ativa não desativa" é pura e roda sob a trava do item. A unidade
e o "Tem estoque próprio" travam quando o item já tem movimentação. A validação de categoria
passou para o módulo puro, para o 06-09 usar. No Financeiro, cada linha do efeito diz "fica com X".
Quando a venda deixa um material negativo, um aviso aparece fora do recolhível, e "Lançar venda"
continua habilitado.

## O que foi feito

### Tarefa 1: desativar em vez de apagar (`eac7706` RED, `5764dbf` GREEN)

- **`podeDesativarItem`** vive em `catalogo.ts`, no molde de `podeDeixarDeTerEstoque`.
  **`categoriaDeVendaValida`/`categoriaDeCompraValida`** foram movidas para lá sem mudar
  comportamento e são exportadas. O `acoes.ts` importa as duas. `grep "^function
  categoriaDeCompraValida" acoes.ts` dá 0.
- **`definirItemAtivo`** tem `exigirUsuario()` na primeira linha e usa `esquemaAtivacaoDeItem`.
  Numa transação, faz `for update` no item. Só ao desativar, lê as fichas em que o item é insumo de
  um produto `ativo = true` e aplica `podeDesativarItem`. Grava `ativo`, revalida Cadastros,
  Financeiro, `/gestao/estoque` e `/gestao` e devolve `{ id, ativo, nome }`. Nenhum caminho apaga
  linha: `grep -rn "delete(itensCatalogo)" lib app` não acha nada.
- **`editarItem`** lê também `unidade` sob a trava. Se a unidade muda ou se o estoque próprio é
  desligado, e o item tem movimentação, ele recusa com `FRASE_ITEM_COM_MOVIMENTACAO`. Um P0001 de
  `travar_unidade_do_item_com_movimentacao` também vira a mesma frase. A detecção olha
  `where`/`message` na raiz e na `cause` e lê o código por `codigoDoErroPostgres`.
- **`carregarInsumosDisponiveis(itemIdEmEdicao?)`** traz os itens ativos e os que já estão na ficha
  daquele item. No `criarItem`, traz só os ativos.
- **`listarCatalogoCompleto`** ganhou um agregado do livro, casado por `Map`, com contagem e soma
  por item. Devolve `ativo`, `movimentacoes` e `saldoMilesimos`, com os ativos antes dos
  desativados e a ordem de criação mantida dentro de cada grupo. **`listarInsumosDisponiveis`**
  passou a trazer só os ativos.
- **`ConfirmarDesativacao`** é um `AlertDialog` com a copy da UI-SPEC. Os botões têm 44px:
  "Voltar" (`outline`) e "Desativar {item|material}" (primário). Durante a gravação mostra
  "Desativando…", com os dois botões desabilitados e `aria-busy="true"`. O erro da ação aparece
  dentro do diálogo com `role="alert"`. O link "Abrir Cadastros → Catálogo" só aparece com
  `substantivo="material"`.
- **Lista e diálogo:** o chip "Desativado" é neutro, sem opacidade. "Desativar item" abre a
  confirmação. "Reativar item" grava direto, mostra "Reativando…" e o toast "{nome} reativado.".
- **e2e `cadastros catalogo ativo`**, casos (a) a (d). O (d) também prova que o produto que já tinha
  o insumo desativado na ficha salva sem erro. Esse é o caminho de `carregarInsumosDisponiveis(id)`.

### Tarefa 2: "fica com" e o aviso de negativo (`070626c` RED, `003b4a9` GREEN)

- **`formatarEfeitoComSaldo`/`materiaisQueFicamNegativos`** são puras e trabalham em milésimos
  inteiros. Usam o "−" tipográfico e o "L" maiúsculo. `formatarEfeito` não mudou.
- **`textoAvisoVendaNegativa`** dá o nome e o saldo quando é um material só. Com dois ou mais, diz
  "{N} materiais". As duas dicas do efeito foram trocadas pelas frases novas.
- **Página do Financeiro:** a `carregarSaldosParaOEfeito()` só roda nas abas Venda e Despesa. Ela
  tem um `try`/`catch` próprio: se falhar, faz `console.error` e devolve `null`.
- **`EfeitoEstoque`** acrescenta " · " e o `span` `efeito-fica-com` ao fim da linha, com
  `text-erro font-semibold` quando fica negativo. A linha quebra por palavra (`break-words`).
- **`PainelVenda`:** a caixa `venda-aviso-negativo` (`role="status"`, `bg-atencao-fundo`/
  `text-atencao`, Apoio) fica fora do `<details>`, logo acima dos botões. `podeLancar` não mudou.
  **`PainelDespesa`** só repassa `saldos`.
- **e2e novo**, "o efeito diz como o material fica e avisa do negativo sem bloquear". O aviso
  aparece com o recolhível fechado, a linha termina em "fica com −15 g" e nada rola a 320px com um
  nome de ~105 caracteres. "Lançar venda" fica habilitado, a venda lança e o livro termina em
  −15000 milésimos.

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/cadastros-catalogo.test.ts` (RED) | 14 falharam, 24 passaram |
| `npx vitest run tests/unit/financeiro-efeito-estoque.test.ts` (RED) | 14 falharam, 22 passaram |
| `npm run verificar` (Tarefa 1) | saiu 0 — lint, tsc, `verificar-acoes` 76 ações/0 violações, 1550 testes, `test:migracoes` "Todas as afirmações passaram" |
| **e2e invocação 1** — `npm run test:e2e -- --grep "cadastros catalogo"` | **52 passed**, desktop e celular |
| `npm run verificar` (Tarefa 2) | saiu 0 — 76 ações/0 violações, **1564 testes**, `test:migracoes` passou |
| **e2e invocação 2** — `npm run test:e2e -- --grep "financeiro venda\|financeiro despesa\|cadastros catalogo"` | **114 passed (1.4m)**, desktop e celular |

**Duas invocações de e2e no plano, uma por tarefa**, o orçamento do plano. O log da invocação 1
mostrou várias linhas `[WebServer] ⨯ Error: The destination stream closed early.`, e nenhum teste
falhou por isso. Parece ruído de navegação interrompida no servidor de produção local. Não investiguei.

Os greps de aceite:

| Grep | Resultado |
|---|---|
| `export function categoriaDeCompraValida` em `catalogo.ts` | 1 |
| `^function categoriaDeCompraValida` em `acoes.ts` | 0 |
| `export async function definirItemAtivo` | 1 |
| `delete(itensCatalogo)` em `lib` e `app` | nada |
| `"itens_catalogo"` em `testar-migracoes.mjs` | 2 no início, 2 no fim |
| "Aparece aqui para validar a regra" em `lib/financeiro/textos.ts` | 0 |
| "Ao lançar a venda, isto sai do estoque." | 1 |
| `venda-aviso-negativo` em `painel-venda.tsx` | 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no teste] O uuid de fantasia do teste não passava no `esquemaId`**
- **Found during:** Tarefa 1, GREEN.
- **Issue:** `ITEM_ID = "5555…-5555…"` não tem versão nem variante RFC 4122, e o Zod recusa. O
  caso "aceita { id: uuid, ativo }" falhava por causa do dado de teste, não do esquema.
- **Fix:** criei a constante `UUID_VALIDO` (v4 de verdade), com um comentário, para os casos do
  `esquemaAtivacaoDeItem`. O esquema não mudou.
- **Commit:** `5764dbf`

**2. [Rule 2 - Correção] O diálogo perderia o insumo desativado que já está na ficha**
- **Issue:** com `listarInsumosDisponiveis` trazendo só os ativos, o diálogo não acharia um insumo
  desativado que já está na ficha. A `validarItem` do cliente acusaria "Esse insumo não existe
  mais" e a linha da ficha mostraria "?". Isso contradiz a verdade "continua lá e continua válido
  ao salvar".
- **Fix:** o diálogo junta aos disponíveis os insumos da ficha atual, tirados do catálogo que a
  tela já carregou. Nenhuma consulta nova. A `FichaTecnica` ganhou a prop opcional
  `insumosConhecidos`, usada só para descrever a linha. O arquivo está fora de `files_modified` e a
  mudança só acrescenta. Os candidatos a insumo NOVO continuam sendo só os ativos.
- **Files modified:** `components/amassa/cadastros/ficha-tecnica.tsx`, `dialogo-item-catalogo.tsx`
- **Commit:** `5764dbf`

**3. [Rule 3 - Tipagem] `textoAvisoVendaNegativa` virou genérica**
- A checagem de propriedade extra do TS recusava passar os objetos de
  `materiaisQueFicamNegativos`, que têm `itemId`, para um tipo `{ nome, saldoFinalTexto }`. A
  assinatura passou a ser `<T extends { nome; saldoFinalTexto }>`. O comportamento não mudou.
- **Commit:** `003b4a9`

### Não coberto por teste automático (registrado, não é stub)

- **O P0001 do gatilho da 0023 em `editarItem`.** A checagem da ação vem antes do `UPDATE`, então
  o e2e (c) só exercita a primeira camada. Pôr o gatilho à prova exigiria uma corrida real entre
  movimentação e edição. O gatilho em si é provado por `test:migracoes` (`conferirEstoque`, 06-01).
- **A falha de `listarSaldos` na página do Financeiro.** Um e2e não consegue derrubar só essa
  consulta. O fallback (`saldos` nulo → sem "fica com" e sem aviso) é provado nas funções puras:
  `formatarEfeitoComSaldo(…, undefined)` e `materiaisQueFicamNegativos(…, null)`.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>` do plano. `definirItemAtivo` é a T-06-33 e está
contada no `verificar-acoes` (76 ações, 0 violações). A leitura de saldos na página é a T-06-37.

## TDD Gate Compliance

- Tarefa 1: `test(06-08)` `eac7706` → `feat(06-08)` `5764dbf`
- Tarefa 2: `test(06-08)` `070626c` → `feat(06-08)` `003b4a9`

## Self-Check: PASSED

- `components/amassa/cadastros/confirmar-desativacao.tsx`: FOUND
- Commits `eac7706`, `5764dbf`, `070626c`, `003b4a9`: FOUND em `gsd/phase-06-estoque`
- STATE.md e ROADMAP.md não foram tocados (ficam com o orquestrador)
