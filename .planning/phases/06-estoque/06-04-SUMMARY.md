---
phase: 06-estoque
plan: 04
subsystem: estoque
status: complete
tags: [estoque, saldos, alerta, banner, busca, filtros, tabela, contraste]
requires:
  - "06-01: listarSaldos, CartaoSaldo/AbaSaldos/FolhaMovimentacao e os data-testid do traçador"
  - "06-03: movimentacoesDoItem ampliado e o e2e estoque financeiro (que lê o cartão)"
provides:
  - "lib/estoque/saldo.ts — situacaoDoSaldo, alertaDoItem, ordenarSaldos, areaDoItemNoEstoque, normalizarBusca, filtrarSaldos, FiltroDeSituacao, areasComMaterial, ORDEM_DAS_AREAS, resumoDoBanner, contadorDaLista, custoMedioParaExibir, SaldoParaLista"
  - "SaldoDoItem ampliado: area, categoriaCompraNome, ehPecaPronta, ultimaEntradaComPreco (quatro consultas casadas por Map)"
  - "SecaoSaldos (async, dentro de Suspense), AbaSaldos, CartaoSaldo, TabelaSaldos, BarraFerramentasSaldos, BannerEstoque, FiltroSituacao, EsqueletoSaldos"
  - "PontoDaArea, ChipDoSaldo, COR_DO_SALDO, textoDoCustoMedio, textoDoMinimo exportados de cartao-saldo.tsx"
  - "data-testid: estoque-busca, estoque-pilula-tudo/-area-{area}/-acabando, estoque-contador, estoque-banner(-titulo/-nomes/-negativos/-ver), estoque-chip-negativo/-acabando/-desativado, estoque-tabela, estoque-filtro-situacao(-{valor}), estoque-saldos-erro, estoque-vazio-filtro/-acabando/-desativados, estoque-cartao-meta/-custo, data-alerta"
  - "tests/e2e/apoio/semear-estoque.ts::desativarNoBanco"
  - "pares P1–P17b em tests/unit/contraste.test.ts"
affects: [06-05, 06-06, 06-07, 06-08, 06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "uma regra de alerta pura (situacaoDoSaldo/alertaDoItem) lida pela lista, pelo banner e pelo contador"
    - "cartões e tabela no DOM ao mesmo tempo, trocados por CSS em 980px, com os mesmos data-testid; e2e filtra pelo visível"
    - "?acabando=1 sincronizado por window.history.replaceState, sem ida ao servidor"
key-files:
  created:
    - lib/estoque/saldo.ts
    - components/amassa/estoque/secao-saldos.tsx
    - components/amassa/estoque/banner-estoque.tsx
    - components/amassa/estoque/barra-ferramentas-saldos.tsx
    - components/amassa/estoque/tabela-saldos.tsx
    - components/amassa/estoque/filtro-situacao.tsx
    - components/amassa/estoque/esqueleto-saldos.tsx
    - tests/unit/estoque-saldo.test.ts
    - tests/e2e/estoque-saldos.spec.ts
  modified:
    - lib/estoque/consultas.ts
    - lib/estoque/textos.ts
    - app/gestao/(app)/estoque/page.tsx
    - app/gestao/(app)/estoque/loading.tsx
    - components/amassa/estoque/aba-saldos.tsx
    - components/amassa/estoque/cartao-saldo.tsx
    - tests/unit/contraste.test.ts
    - tests/e2e/apoio/semear-estoque.ts
    - tests/e2e/estoque-tracador.spec.ts
    - tests/e2e/estoque-financeiro.spec.ts
decisions:
  - "Material desativado não alerta: alertaDoItem devolve 'ok' para ele (fora do banner, fora de Acabando, borda e número neutros, só o chip Desativado) — lido da UI-SPEC §Aba Saldos, que dá ao desativado só o chip neutro"
  - "Cartões e tabela ficam os dois no DOM, trocados por CSS em 980px (sem flash e sem decidir largura no servidor); a linha da tabela repete os data-testid do cartão, e cartaoDoItem nos e2e do traçador e do Financeiro passou a filtrar pelo visível"
  - "O banner é renderizado pela AbaSaldos (cliente), a partir da mesma lista que a SecaoSaldos entrega — é ela que tem o estado da pílula que “Ver só esses” liga"
  - "A pílula Acabando mantém ?acabando=1 na URL nos dois sentidos (liga e desliga), por history.replaceState"
  - "Vazio a mostrar: busca/área → “Nada com esse filtro”; senão Acabando → “Nada acabando.”; senão Desativados → “Nenhum material desativado.”. “Limpar filtros” volta para Ativos (ou Todos, se não houver ativo nenhum)"
  - "Custo médio “—” quando o material nunca teve entrada com preço (custoMedioParaExibir), nunca “R$ 0,00/kg”"
  - "Sem o botão “Histórico” no cartão e na tabela: o destino dele (a folha do material) é de um plano seguinte — botão sem destino é defeito, a mesma regra que o plano aplica às ações do cabeçalho"
metrics:
  duration: "~18 min (05:25 → 05:43 UTC, 29/09/2026)"
  completed: 2026-09-29
estimate:
  tokens: 90000
  tasks: 2
actuals:
  tokens: 21600
  tasks: 2
  commits: 3
---

# Phase 06 Plan 04: A aba Saldos Summary

**A aba Saldos inteira sobre UMA regra pura: `situacaoDoSaldo` compara milésimos inteiros, põe o
negativo antes de tudo e nunca alerta com mínimo zero. Lista, banner e contador leem essa regra.
A área vem da categoria de compra (`areaDoItemNoEstoque`). A busca ignora acento e caixa. No
celular a lista é de cartões com borda de alerta; a partir de 980px, uma tabela que rola só dentro
do próprio painel.**

## O que foi entregue

### Tarefa 1 — a regra do alerta, pura, e a consulta (`5781519` RED, `862dd53` GREEN)

- **`lib/estoque/saldo.ts`** (sem React, Next, drizzle, pg nem `@/db`; não lê o relógio):
  - `situacaoDoSaldo`: `saldo < 0` → negativo; `minimo > 0 && saldo <= minimo` → acabando (D-21,
    D-28, EST-04).
  - `alertaDoItem`: a mesma regra, mas material desativado é sempre "ok".
  - `ordenarSaldos`: negativo, depois acabando, depois o resto; `localeCompare` pt-BR com o id
    como desempate. Devolve cópia, não muta a entrada.
  - `areaDoItemNoEstoque`: compra, depois venda, depois geral. Tem comentário explicando por que
    não reusa `areaDoItem` (Pitfall 5).
  - `normalizarBusca`: NFD sem diacríticos, minúsculas pt-BR, sem espaço nas pontas.
  - `filtrarSaldos` (só remove, nunca reordena), `areasComMaterial` (na ordem fixa) e
    `resumoDoBanner` (título, tom, até 3 nomes e "e mais N", linha própria dos negativos).
  - `contadorDaLista`: soma só os saldos positivos. `custoMedioParaExibir`: "—" sem entrada com
    preço.
- **`listarSaldos`** faz quatro consultas casadas por `Map`: itens com as duas categorias por
  `alias`, e em paralelo as somas do livro, a última entrada (a mesma regra de `lerEstados`) e
  `select distinct item_catalogo_id from fichas_precificacao`. Os campos antigos não mudaram.
- **`lib/estoque/textos.ts`** ganhou as frases da UI-SPEC para esta aba:
  - os três vazios de filtro, o banner (singular, plural, só negativos, a linha de negativos, "e
    mais N", "Ver só esses") e o contador;
  - a nota de rodapé em partes (negrito e itálico), os chips, "sem mínimo", "peça pronta" e as
    colunas da tabela;
  - `ROTULO_FILTRO_ATIVOS`, `ROTULO_FILTRO_DESATIVADOS` e `ROTULO_FILTRO_TODOS`.
- **`tests/unit/estoque-saldo.test.ts`** tem 36 `it`s, um por comportamento do plano, mais as
  arestas de EST-02/03/04/12.
- **`tests/unit/contraste.test.ts`** ganhou o `describe` "contraste do Estoque (06-UI-SPEC.md)":
  - os 18 pares, de P1 a P17b, lidos por `tokenDaPlataforma`. P7 usa `primary-foreground`, para
    não repetir hex;
  - P1 e P11 comentados como de margem quase nula;
  - P17a e P17b afirmados com o limite de texto grande (≥ 3,0), e um `it` que prova que P17a
    reprovaria como texto normal.

### Tarefa 2 — a tela (`13c17b4`)

- **`page.tsx`**:
  - `exigirUsuario()` continua a primeira instrução;
  - lê só `?acabando=1`;
  - o cabeçalho sai na hora, e `SecaoSaldos` fica dentro de `<Suspense fallback={<EsqueletoSaldos />}>`;
  - não há botões no cabeçalho: cada um entra no plano que constrói o destino dele.
- **`SecaoSaldos`** segue o molde de `bloco-producao.tsx`:
  - na falha, `console.error` e `EstadoErro` com "Não deu para carregar os saldos…" +
    `TentarDeNovo`, `data-testid="estoque-saldos-erro"`;
  - sem nenhum item, o vazio do traçador;
  - senão, a `AbaSaldos`.
- **`AbaSaldos`** guarda o estado de busca, área, Acabando e situação, e ordena uma vez só:
  - mostra os três vazios nomeados, com "Limpar filtros" e "Ver todos" em `outline`;
  - desenha os cartões abaixo de 980px e a `TabelaSaldos` a partir de 980px;
  - põe o `FiltroSituacao` no fim, a nota de rodapé em `superficie-2` e a folha do traçador, que
    continua abrindo por "Dar baixa".
- **`BannerEstoque`**:
  - devolve `null` quando não há alerta;
  - usa `atencao-fundo`/`atencao` e `AlertTriangle` 20px `aria-hidden`;
  - o título só-negativos e a linha "Com saldo negativo" saem em `erro` (P16);
  - os nomes usam `[overflow-wrap:anywhere]`;
  - "Ver só esses" (44px, borda `atencao`) liga a pílula e grava `?acabando=1`.
- **`BarraFerramentasSaldos`**:
  - a busca tem 44px, fonte de 16px mesmo no desktop (`md:text-corpo`), ícone `Search`
    `aria-hidden` e o `aria-label` e o placeholder da UI-SPEC;
  - as pílulas usam `aria-pressed`, com o ponto de 8px da área e o nome escrito. Marcada:
    `acento-fundo`/`acento`/600; desmarcada: 400;
  - `flex-wrap` e o contador com `aria-live="polite"` e `tabular-nums`.
- **`CartaoSaldo`** manteve os `data-testid` do traçador e ganhou:
  - borda esquerda de 4px na cor do alerta;
  - a linha "● Área · categoria · mínimo X un / sem mínimo · peça pronta";
  - o saldo em Display na cor do alerta;
  - o chip (negativo vence acabando), "Dar baixa" só para ativo e o custo médio à direita.
  - Desativado: borda neutra e só o chip, sem opacidade reduzida.
- **`TabelaSaldos`**:
  - fica em `hidden min-[980px]:block` com `overflow-x-auto`, e a tabela tem `min-w-[760px]`;
  - os cabeçalhos são Apoio 600 em caixa alta com `tracking-[0.06em]`, e "Ações" fica `sr-only`;
  - os números ficam à direita com `tabular-nums`, e o Mínimo mostra "—" quando é zero;
  - nenhuma linha tem fundo colorido.
- **`FiltroSituacao`** é a cópia estrutural de `filtro-fornos.tsx`, com `radiogroup`, `radio` +
  `aria-checked`, 44px e peso 400/600.
- **`EsqueletoSaldos`** mostra a barra, 4 cartões abaixo de 980px e 6 linhas de tabela acima.
  `loading.tsx` passou a usar o mesmo esqueleto.
- **E2E `estoque saldos` (a–j)**, com `desativarNoBanco` no auxiliar.

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/estoque-saldo.test.ts` (antes do código) | falhou: módulo inexistente (RED) |
| `npx vitest run tests/unit/estoque-saldo.test.ts tests/unit/contraste.test.ts` | **2 arquivos, 81 testes passaram** |
| `npx tsc --noEmit` (T1 e T2) | limpo |
| `npx eslint` nos arquivos tocados (T1 e T2) | limpo |
| `npm run verificar` | **exit 0**. lint limpo; `tsc` limpo; `verificar-acoes: 75 ação(ões) conferida(s), 0 violações` (as duas linhas "1 violação" são os fixtures do próprio verificador); `Test Files 90 passed (90)`, `Tests 1440 passed (1440)`; `test:migracoes`: "Todas as afirmações passaram." |
| `npm run test:e2e -- --grep "estoque saldos\|estoque tracador\|estoque financeiro"` | **1 invocação, a única do plano**: `80 passed (1.1m)`. Passaram `estoque saldos` (a–j), `estoque tracador` e `estoque financeiro` (a–h) nos projetos desktop e celular, mais o `@vazio-global` do traçador na cadeia. |

Nenhum `npm run build` separado, nenhuma varredura sem `--grep` (essa é do último plano) e nenhuma
nova rodada de `acessibilidade.spec.ts`, que também visita `/gestao/estoque`: ela entra na varredura
completa da fase.

**Greps de aceite:**
- Tarefa 1:
  - `from "(@/db|react|next|drizzle-orm|pg)` em `saldo.ts` → nada;
  - `\bareaDoItem\(` fora de comentário em `saldo.ts`/`consultas.ts` → nada;
  - `fichasPrecificacao` em `consultas.ts` → 5.
- Tarefa 2:
  - "frente" (palavra inteira) fora de comentário → nada;
  - hex de 6 dígitos em `components/amassa/estoque` → nada;
  - `role="radiogroup"` → 1 e `min-h-[44px]` → 1 em `filtro-situacao.tsx`;
  - `situacaoDoSaldo|resumoDoBanner|filtrarSaldos` nos componentes soma 8 (`aba-saldos` 4,
    `banner-estoque` 3, `filtro-situacao` 1);
  - `estoqueMinimoMilesimos *[<>]` nos componentes → nada;
  - `Suspense` em `page.tsx` → 4;
  - `dangerouslySetInnerHTML` → nada.

**Branch:**
- o trabalho ficou em `gsd/phase-06-estoque` do começo ao fim;
- `main` continua em `a8c7bad`;
- nada foi publicado;
- nenhuma migração foi aplicada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O localizador do cartão nos e2e de 06-01 e 06-03 pegaria dois elementos**
- **Found during:** Tarefa 2, ao desenhar cartões e tabela
- **Issue:** o plano exige tabela a partir de 980px e que os `data-testid` do traçador continuem
  os mesmos. Com cartões e tabela no DOM, trocados por CSS, `[data-testid="estoque-cartao"][data-item-id=…]`
  casa com o cartão escondido e com a linha visível, e o modo estrito do Playwright recusa isso. A
  alternativa, escolher o layout por JavaScript, faria o desktop piscar cartões antes da tabela a
  cada carga.
- **Fix:** a linha da tabela leva os mesmos `data-testid` do cartão. `cartaoDoItem` em
  `estoque-tracador.spec.ts` e em `estoque-financeiro.spec.ts` ganhou `.filter({ visible: true })`,
  com um comentário. Nenhuma asserção desses testes mudou, e os dois passaram nos dois projetos.
- **Files modified:** `tests/e2e/estoque-tracador.spec.ts`, `tests/e2e/estoque-financeiro.spec.ts`
  (fora da lista `files_modified` do plano) · **Commit:** `13c17b4`

**2. [Rule 2 - Consistência] `loading.tsx` passou a usar o `EsqueletoSaldos`**
- O esqueleto antigo da rota tinha só cartões. No desktop ele não batia com a tabela que aparece
  logo depois. Agora a rota e o `Suspense` mostram o mesmo esqueleto. O arquivo está fora da lista
  do plano. · **Commit:** `13c17b4`

**3. [Aceite] Mínimo zero comparado com `=== 0` nos componentes**
- A linha "mínimo X / sem mínimo" usava `estoqueMinimoMilesimos > 0`. É só exibição, mas o grep de
  aceite (`estoqueMinimoMilesimos *[<>]`) o contaria. Virou `=== 0`: o banco garante mínimo ≥ 0.
  Quem diz se o material alerta continua sendo só `alertaDoItem`.

### Escolhas dentro do plano (registradas)

- **Desativado não alerta.** Isso vale para o banner, para "Acabando", para a borda e para o
  número. A UI-SPEC dá ao desativado "borda `--color-borda`, chip Desativado (neutro)". Um aviso
  sobre material que não se movimenta treinaria a pessoa a ignorar avisos.
- **O banner mora na `AbaSaldos`, não na `SecaoSaldos`.** A lista é a mesma e o efeito é o mesmo:
  carregando ou com erro, o banner não existe. Ele fica na aba porque é ela que tem o estado que
  "Ver só esses" liga.
- **`saldo.ts` importa valor de `textos.ts`.** O plano cita só `custo.ts` e `destinos.ts`, mas
  `textos.ts` também é puro e sem import nenhum. Assim as frases do banner e do contador ficam num
  lugar só. O grep de aceite dos imports proibidos passa.
- **Os e2e (a) e (b) nomeiam o material com "0-…".** O banner mostra só 3 nomes, e a lista é global
  e paralela. Dígito vem antes de letra na ordem pt-BR, então esses materiais ficam entre os 3
  primeiros sem que o teste precise afirmar nada sobre o banco inteiro. O (b) semeia também um
  material acabando, para o negativo cair na linha "Com saldo negativo".
- **Nenhum botão "Histórico" no cartão.** O destino dele, a folha do material, é de um plano
  seguinte.

## Known Stubs

Nenhum stub que impeça o objetivo do plano. Estes limites são declarados, cada um com o plano que
o resolve:
- o cabeçalho ainda não tem "Registrar movimentação", "+ Novo material" nem "Contar estoque"
  (planos 06-06, 06-09 e 06-10);
- o cartão ainda não tem o botão "Histórico" (folha do material, plano seguinte da fase);
- não existe o painel de primeira abertura (UI-D3), porque ainda não há contagem.

O "—" do custo médio e do mínimo zero é a regra da UI-SPEC, não um espaço reservado.

## Threat surface

Nenhuma superfície fora do `<threat_model>`:
- **T-06-18:** `exigirUsuario()` continua a primeira instrução da página.
- **T-06-19:** `acabando` só liga um filtro no cliente, e qualquer outro valor é ignorado.
- **T-06-20:** o `try`/`catch` manda o erro só para o log do servidor, e a tela mostra a frase
  humana.
- **T-06-21:** não há `dangerouslySetInnerHTML`. Os nomes são texto do React.

Nenhuma Server Action nova: `verificar-acoes` continua com 75.

## Self-Check: PASSED

- Os 9 arquivos criados e os 10 modificados estão nos commits `5781519`, `862dd53` e `13c17b4`.
- Os três commits estão no branch `gsd/phase-06-estoque`. `main` continua em `a8c7bad`.
- `STATE.md` e `ROADMAP.md` não foram modificados por este plano (são do orquestrador).
