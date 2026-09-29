---
phase: 06-estoque
plan: 07
subsystem: estoque
status: complete
tags: [estoque, historico, para-onde-foi, abas, livro-imutavel, EST-05, EST-06, EST-16, D-31, Pitfall-15]
requires:
  - "06-01: movimentacoes_estoque (numero identity, estorno_de_id único, registrado_por not null), DESTINOS_DE_SAIDA"
  - "06-03: venda, compra e estorno gravados pelo Financeiro (origem, documento, estorno_de_id)"
  - "06-04: SecaoSaldos/AbaSaldos, BannerEstoque, EsqueletoSaldos, PontoDaArea"
  - "06-06: ProvedorDoEstoque/EntregaDoEstoque, BarraAcaoFixa, SeletorMaterial, a folha que grava e dá router.refresh"
provides:
  - "lib/estoque/abas.ts — AbaDoEstoque, TipoDoHistorico, PeriodoDoParaOndeFoi, abaDoEstoqueDaUrl, tipoDoHistoricoDaUrl, limiteDaUrl, periodoDaUrl, diasDoPeriodo, LIMITE_DO_HISTORICO/PASSO_DO_HISTORICO/LIMITE_MAXIMO_DO_HISTORICO"
  - "lib/estoque/historico.ts — descreverMovimentacao, DescricaoDaMovimentacao, MovimentacaoParaDescrever, ChipDaMovimentacao, quandoTexto, inicioDoPeriodo, agregarParaOndeFoi, SaidaParaOndeFoi, BarraDoParaOndeFoi, ParaOndeFoi"
  - "lib/estoque/consultas.ts — listarHistorico, contarHistorico, saidasParaOndeFoi, LinhaDoHistorico"
  - "components/amassa/estoque — AbasEstoque, SecaoHistorico, AbaHistorico, PilulaDeFiltro, LinhaMovimentacao (prop comNome, para a folha do material do 06-09), SecaoParaOndeFoi, BarrasParaOndeFoi, EsqueletoHistorico, EsqueletoParaOndeFoi, CarregadorDoSeletor, lerDadosDoEstoque, BannerDoEstoque"
  - "ProvedorDoEstoque ganhou registrarVerSoAcabando/verSoAcabando (o banner acima das abas liga a pílula Acabando da aba Saldos)"
  - "data-testid: estoque-abas, estoque-aba-{saldos,historico,destino}, historico-lista, historico-linha (data-numero, data-item-id), historico-quantidade (data-tom), historico-material, historico-detalhe, historico-quando, historico-chip, historico-pilula-{tudo,entrada,saida,ajuste}, historico-contador, historico-mais, historico-vazio, historico-erro, historico-carregando, destino-total, destino-barras, destino-barra (data-destino, data-valor-centavos), destino-barra-grafico, destino-barra-area, destino-periodo-{30,90,tudo}, destino-contador, destino-vazio, destino-erro, destino-carregando"
  - "tests/e2e/apoio/semear-estoque.ts — semearMovimentacoesEmMassa, nomeDoUsuario"
  - "tests/e2e/estoque-abas.spec.ts (a–i)"
affects: [06-08, 06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "o livro se lê por numero desc, nunca criado_em; limite + 1 para saber se há mais"
    - "estornada = left join com o estorno que aponta para a linha (a restrição única garante no máximo um)"
    - "corte de período em Brasília no próprio Postgres: (data::date)::timestamp at time zone 'America/Sao_Paulo'"
    - "o que conta como consumo é regra pura testada (agregarParaOndeFoi), mesmo com o where da consulta filtrando antes"
    - "filtros de aba como links de URL com aria-current; Suspense por aba sem key (a lista antiga fica até a nova chegar)"
    - "fora da aba Saldos, um carregador que não desenha nada entrega a lista ao provedor"
key-files:
  created:
    - lib/estoque/abas.ts
    - lib/estoque/historico.ts
    - components/amassa/estoque/abas-estoque.tsx
    - components/amassa/estoque/aba-historico.tsx
    - components/amassa/estoque/secao-historico.tsx
    - components/amassa/estoque/linha-movimentacao.tsx
    - components/amassa/estoque/secao-para-onde-foi.tsx
    - components/amassa/estoque/barras-para-onde-foi.tsx
    - components/amassa/estoque/esqueleto-abas.tsx
    - components/amassa/estoque/carregador-do-seletor.tsx
    - tests/unit/estoque-historico.test.ts
    - tests/e2e/estoque-abas.spec.ts
  modified:
    - lib/estoque/consultas.ts
    - lib/estoque/textos.ts
    - app/gestao/(app)/estoque/page.tsx
    - components/amassa/estoque/banner-estoque.tsx
    - components/amassa/estoque/secao-saldos.tsx
    - components/amassa/estoque/aba-saldos.tsx
    - components/amassa/estoque/provedor-estoque.tsx
    - tests/e2e/apoio/semear-estoque.ts
decisions:
  - "O número de um ajuste no Histórico leva o sentido da diferença ('+1' / '−0,9') em terracota, e não um '±' literal: é o que o protótipo faz (linhaMov) e o que o toast do ajuste do 06-06 já mostra; o '{±d}' da UI-SPEC foi lido como notação de 'diferença com sinal'. SinalDaMovimentacao ficou '+' | '−'"
  - "O banner saiu da AbaSaldos e mora acima das abas (BannerDoEstoque), derivado da lista do provedor; 'Ver só esses' chama a ação registrada pela AbaSaldos e, com ela desmontada, navega para ?aba=saldos&acabando=1"
  - "role=img fica num div dentro de cada item da lista (cabeçalho, trilho e sub-linha), não no li inteiro: um img esconde os filhos do leitor de tela e as linhas '● {Área} {R$}' da barra de vendas precisam ser lidas"
  - "'Últimos 30 dias' = hoje e os 29 dias civis anteriores, a partir da meia-noite de Brasília (o protótipo subtraía 30×24h do relógio)"
  - "'Mostrar mais 50' some ao chegar no teto de 1000 (T-06-28); o que passa disso não aparece nesta tela"
  - "Período sem nenhuma saída mostra o vazio 'Nenhuma saída no período' no lugar das seis barras, como o protótipo; com qualquer saída, as seis barras aparecem"
  - "Chips neutros (Estornada, Estorno, Saldo inicial) em tinta-fraca sobre superficie-2 (P9); a UI-SPEC só dá cor ao Estornada"
  - "Saldo inicial de ajuste para menos (06-10: contagem abaixo do saldo, sem custo) mostra 'Saldo inicial · contado X un' sem valor"
metrics:
  duration: "~24 min (06:14 → 06:38 UTC, 29/09/2026)"
  completed: 2026-09-29
estimate:
  tokens: 90000
  tasks: 2
actuals:
  tokens: 29700
  tasks: 2
  commits: 3
---

# Phase 06 Plan 07: Histórico e Para onde foi Summary

**O livro ficou legível. O Histórico mostra cada entrada, saída e ajuste pela ordem de gravação,
com "Hoje, 14:32 · {quem registrou}" no fuso de Brasília, a frase certa de cada tipo e nenhum botão
em nenhuma linha. Uma venda cancelada deixa as duas linhas: a original "Estornada" e o estorno "do
Financeiro". O Para onde foi soma, por destino e com a barra "Vendido · pelo Financeiro" aberta por
área, o que cada área consumiu, sem contar venda cancelada, estorno de compra ou ajuste. As três
abas vivem numa barra neutra, e "Registrar movimentação" funciona em qualquer uma delas.**

## O que foi entregue

### Tarefa 1: puros e testados (`50c8cdb` RED, `a904ce6` GREEN)

**`lib/estoque/abas.ts`** (sem nenhum import)
- `abaDoEstoqueDaUrl`, `tipoDoHistoricoDaUrl`, `limiteDaUrl`, `periodoDaUrl`, todos em uniões
  fechadas.
- Um parâmetro repetido (`?aba=a&aba=b`, que chega como lista) cai no padrão.
- `limiteDaUrl` só aceita dígitos, em múltiplos de 50, de 50 a 1000.

**`lib/estoque/historico.ts`** (puro; não lê o relógio)
- `descreverMovimentacao` segue a tabela da UI-SPEC linha a linha:
  - saída manual → "{Destino} · paga por {Área} · {vínculo} · {R$}";
  - baixa por venda → "Vendido · venda nº N · paga por {Área}", com os chips Venda e do Financeiro;
  - compra → "Compra nº N · {R$ da nota} · {R$}/{un}";
  - entrada manual e peça pronta, também com o valor da nota;
  - saldo inicial, ajuste e estorno de venda ou de compra → "… nº N cancelada".
  - A original estornada ganha o chip "Estornada" sem mudar o texto.
  - O valor da entrada é o da nota (D-25). O da saída é o gravado no instante dela, em absoluto
    (D-07).
- `quandoTexto(instante, agora)` compara o dia civil de Brasília dos dois lados. "Hoje" continua
  valendo às 23h30 de Brasília, quando em UTC já é o dia seguinte.
- `agregarParaOndeFoi`:
  - sempre seis barras;
  - fica fora a saída estornada, o estorno de compra, o ajuste e a entrada;
  - vendas com linhas por área;
  - ordem decrescente, com empate na ordem fixa;
  - percentual sobre o total e largura mínima de 2%.
  - O comentário cita Pitfall 15 e D-31.
- `inicioDoPeriodo` devolve a data civil de início.

**`lib/estoque/consultas.ts`**
- `listarHistorico` faz UMA consulta, com `orderBy(desc(movimentacoesEstoque.numero))`, `limite + 1`
  e as junções com material, usuário, documento e o estorno que marca `estornada`.
- `contarHistorico` faz o `count()` do tipo.
- `saidasParaOndeFoi` traz as saídas de origem manual ou venda que não são estorno, com o corte
  `(desde::date)::timestamp at time zone 'America/Sao_Paulo'`.

**`lib/estoque/textos.ts`**
- as frases das duas abas: vazios, erros e as quatro notas de rodapé (a nota "do Financeiro"
  foi reescrita para valer também para compra);
- as pílulas, os períodos, "Mostrar mais 50" e "Vendido · pelo Financeiro".

### Tarefa 2: a tela (`02b0aa6`)

- **`page.tsx`**
  - `exigirUsuario()` continua sendo a primeira instrução.
  - Ordem na página: cabeçalho → `BannerDoEstoque` → `AbasEstoque` → a aba num `Suspense` próprio,
    com o esqueleto dela → `BarraAcaoFixa`.
  - Fora de Saldos, `<Suspense fallback={null}><CarregadorDoSeletor /></Suspense>`.
  - Os quatro parâmetros passam por `lib/estoque/abas.ts`.
- **`AbasEstoque`** copia a estrutura de `abas-financeiro.tsx`:
  - `role="tablist"` com `aria-label="Ver"`;
  - três `Link role="tab"` com `aria-selected`;
  - `bg-muted p-1`; a ativa é `bg-background font-semibold shadow-sm` e a inativa tem peso 400;
  - 44px, com `min-w-0 break-words`;
  - nenhum terracota.
- **`SecaoHistorico` + `AbaHistorico`**
  - estados: `try`/`catch` com `EstadoErro` (`historico-erro`) e "Tentar de novo";
  - pílulas que são links com `aria-current`, e o contador "1 movimentação" / "N movimentações";
  - a lista `ol` num painel `superficie`, com `max-w-3xl` a partir de 980px;
  - "Mostrar mais 50" (`outline`, `scroll={false}`) só aparece quando há mais e abaixo de 1000;
  - os dois vazios: "Nada deste tipo ainda." vem com "Ver tudo" em `outline`;
  - as duas notas.
- **`LinhaMovimentacao`** (prop `comNome`, pronta para a folha do material do 06-09)
  - quantidade à esquerda, em 76px alinhados à direita, `tabular-nums`, na cor do tom, com a
    unidade embaixo;
  - nome (Corpo 600) e chips; o detalhe em `tinta-media` com `[overflow-wrap:anywhere]`;
  - "quando · autor" em `tinta-fraca`;
  - **nenhum** elemento interativo nem manipulador de evento.
- **`SecaoParaOndeFoi` + `BarrasParaOndeFoi`**
  - pílulas de período e "N saídas no período";
  - o resumo "MATERIAL CONSUMIDO NO PERÍODO" com o total em Display e a nota do topo;
  - seis barras em HTML, com o valor em `whitespace-nowrap` 600 e o trilho de 8px `superficie-2`;
  - o preenchimento é `acento`, ou `erro` na perda;
  - a parte gráfica de cada barra é `role="img"`, com o `aria-label` da UI-SPEC;
  - as linhas "● {Área} {R$}" da barra de vendas;
  - o vazio tem "Ver tudo" fora do período Tudo; a nota "Como o valor é calculado.".
- **`EsqueletoHistorico`** (6 linhas) e **`EsqueletoParaOndeFoi`** (resumo + 6 barras).
- **`CarregadorDoSeletor` + `lerDadosDoEstoque`**: é a mesma leitura que a `SecaoSaldos` faz, agora
  numa função só, e entrega ao provedor `pronta` ou `erro`.
- **Banner acima das abas:** `BannerDoEstoque` lê a lista do provedor e devolve `null` enquanto ela
  carrega ou quando falha.

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/estoque-historico.test.ts` (antes do código) | falhou: módulos inexistentes (RED) |
| o mesmo, depois do código | **38 passaram**, na primeira passada |
| `npx tsc --noEmit` + `npx eslint lib/estoque …` (T1 e T2) | limpos |
| `npm run verificar` | **exit 0**. Lint limpo, `tsc` limpo, `verificar-acoes: 75 ação(ões) conferida(s), 0 violações` (as duas linhas "1 violação" são os fixtures do próprio verificador), `Test Files 91 passed (91)`, `Tests 1536 passed (1536)`, `test:migracoes`: "Todas as afirmações passaram." |
| `npm run test:e2e -- --grep "estoque abas\|estoque movimentacao\|estoque saldos"` | **invocação 1**: `94 passed`, `2 failed`. Passaram todo `estoque movimentacao` (a–k), todo `estoque saldos` (a–j), `estoque abas` (a–e, g–i) e o `@vazio-global` (a) nas duas cadeias. As duas falhas foram o caso (f), no desktop e no celular: `column "manual" does not exist` no auxiliar novo (ver Desvio 2). |
| `npm run test:e2e -- --grep "estoque abas"` | **invocação 2**, depois da correção: `54 passed (52.4s)`, com `estoque abas` (a–i) nos dois projetos e toda a cadeia `vazio-*` que o `--grep` arrasta. |

**Duas invocações de e2e**, e não uma como o orçamento do plano previa. A segunda só confirmou a
correção de uma linha no auxiliar de teste. Não houve nenhum `npm run build` separado nem varredura
sem `--grep`, que fica para o último plano da fase.

**Greps de aceite**
- T1:
  - imports proibidos em `abas.ts` e `historico.ts` → nada;
  - `Date.now|new Date()` em `historico.ts` → 0;
  - `orderBy(desc(movimentacoesEstoque.numero))` → 1 e `…criadoEm))` → 0.
- T2:
  - elementos interativos em `linha-movimentacao.tsx`, sem contar comentários → 0;
  - `role="tablist"` → 1;
  - acento em `abas-estoque.tsx`, sem contar comentários → 0;
  - `Suspense` em `page.tsx` → 10 (o mínimo pedido era 2);
  - `agregarParaOndeFoi` em `secao-para-onde-foi.tsx` → 3;
  - `dangerouslySetInnerHTML` e hex em `components/amassa/estoque` → nada.

**Branch**
- tudo ficou em `gsd/phase-06-estoque`;
- `main` continua em `a8c7bad`;
- nada foi publicado;
- nenhuma migração foi aplicada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `provedor-estoque.tsx` ganhou o canal "Ver só esses"**
- **Found during:** Tarefa 2, ao subir o banner para cima das abas.
- **Issue:** a pílula "Acabando" é estado da `AbaSaldos`. Acima das abas, o banner não tinha como
  ligá-la, e nas outras abas a `AbaSaldos` nem está montada.
- **Fix:** `registrarVerSoAcabando`/`verSoAcabando` no provedor, guardados numa referência, sem
  estado.
  - A `AbaSaldos` registra a ação dela.
  - O banner chama a ação; sem aba registrada, navega para `?aba=saldos&acabando=1`.
  - O e2e `estoque saldos (f)` ("Ver só esses" → pílula ligada e `acabando=1` na URL) passou sem
    mudança.
- **Files modified:** `components/amassa/estoque/provedor-estoque.tsx` e
  `components/amassa/estoque/aba-saldos.tsx` (o primeiro fica fora da lista `files_modified`) ·
  **Commit:** `02b0aa6`

**2. [Rule 1 - Bug] O SQL de `semearMovimentacoesEmMassa` perdeu as aspas simples**
- **Found during:** Tarefa 2, invocação 1 do e2e.
- **Issue:** o trecho foi escrito por um `node -e '…'` do shell. As aspas simples de `'manual'` e
  `'entrada'` fecharam a string do shell, e o Postgres recebeu `manual` como nome de coluna.
- **Fix:** as aspas foram devolvidas. Conferi os outros `node -e` da sessão: nenhum inseria aspas
  simples.
- **Files modified:** `tests/e2e/apoio/semear-estoque.ts` · **Commit:** `02b0aa6`

**3. [Rule 2 - Consistência] `SecaoSaldos` passou a ler por `lerDadosDoEstoque`**
- A aba Saldos e o `CarregadorDoSeletor` agora fazem a mesma leitura (saldos em `cache`,
  encomendas e custos das peças prontas) pela mesma função. Assim o provedor nunca recebe listas
  diferentes conforme a aba. O comportamento não mudou.

### Interpretações registradas (ver `decisions`)

- O ajuste mostra o sentido real da diferença, e não "±". O e2e (b) afirma "+1" com
  `data-tom="acento"`.
- `role="img"` fica na parte gráfica da barra, e não no `li` inteiro.
- "Últimos 30 dias" = hoje e os 29 dias civis anteriores.
- O teto de 1000 esconde "Mostrar mais 50".
- Período sem saída mostra o vazio no lugar das barras.

### Observação não verificada

O `loading.tsx` da rota continua sendo o esqueleto da aba Saldos. Ao trocar de aba, ele pode
aparecer por um instante antes do esqueleto da aba de destino, porque o `loading.tsx` não recebe
`searchParams`. Não medi. Se incomodar, a correção é um `loading.tsx` neutro.

## Known Stubs

Nenhum. Os três itens `backstop` do plano ficam para o dono, no portão do 06-11:
- vínculo de 160 caracteres a 320px;
- "R$ 123.456,78" na barra a 320px;
- "−1.234,567 kg" na coluna de 76px.

O e2e (h) já roda um vínculo de 160 letras, um nome de 120 e uma entrada de 1.234,567 kg a 320px
sem rolagem horizontal. O olho do dono continua sendo o critério.

## Threat surface

Nenhuma superfície fora do `<threat_model>`:
- **T-06-28:** `limiteDaUrl` aceita só múltiplos de 50 até 1000.
- **T-06-29:** uniões fechadas, e o Drizzle parametriza.
- **T-06-30:** a `LinhaMovimentacao` não tem nenhum elemento interativo, o que o grep e os e2e (b) e
  (c) provam, e continua valendo o `revoke` da 0023.
- **T-06-31:** o React escapa, e não há `dangerouslySetInnerHTML`.
- **T-06-32:** `exigirUsuario()` continua sendo a primeira instrução.

Nenhuma Server Action nova: `verificar-acoes` continua com 75. O único `insert` direto no livro fora
de `lib/estoque/gravacao.ts` é o auxiliar de TESTE `semearMovimentacoesEmMassa`, que roda só contra o
Postgres efêmero do e2e.

## Self-Check: PASSED

- Os 12 arquivos criados e os 8 modificados estão nos commits `50c8cdb`, `a904ce6` e `02b0aa6`.
- Os três commits estão no branch `gsd/phase-06-estoque`. `main` continua em `a8c7bad`.
- `STATE.md` e `ROADMAP.md` não foram modificados por este plano (são do orquestrador).
