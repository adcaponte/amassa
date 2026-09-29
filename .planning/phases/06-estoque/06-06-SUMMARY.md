---
phase: 06-estoque
plan: 06
subsystem: estoque
status: complete
tags: [estoque, folha, seletor, barra-fixa, previa, ajuste, peca-pronta, EST-07, EST-08, EST-09, EST-11, EST-21]
requires:
  - "06-01: FolhaMovimentacao do traçador e o contrato de data-testid (folha-*, estoque-*)"
  - "06-04: AbaSaldos, CartaoSaldo (ChipDoSaldo, PontoDaArea, formatarMilesimos), areasComMaterial, normalizarBusca, alertaDoItem"
  - "06-05: previaDaMovimentacao, atalhosDaUnidade, custoPreenchidoDaPecaPronta, contadoParaMilesimos, o ramo ajuste de registrarMovimentacao (conferido), listarEncomendasParaVinculo, custosDasPecasProntas, listarSaldosDaRequisicao e as frases da folha"
provides:
  - "ProvedorDoEstoque, useEstoque (lista, abrirSeletor, abrirFolha), EntregaDoEstoque, ListaDoEstoque, DadosDoEstoque, TipoDeMovimentacao, PedidoDeFolha — components/amassa/estoque/provedor-estoque.tsx"
  - "SeletorMaterial (\"Qual material?\"), GradeDestinos (radiogroup), PreviaDoSaldo, BarraAcaoFixa, BotaoRegistrarMovimentacao"
  - "FolhaMovimentacao completa (Entrada · Saída · Ajuste) e CLASSE_DA_FOLHA (o contêiner de tela toda das folhas do Estoque)"
  - "--altura-acao-fixa: 68px e :root:has([data-acao-fixa]) em app/globals.css (UI-D6)"
  - "data-testid: folha-tipo-ajuste, folha-atalho (data-valor), folha-atalhos, folha-contado, folha-motivo, folha-vinculo-turma/-encomenda/-perda, folha-previa (data-tom), folha-nota-compra, folha-trocar-material, folha-escolhido, folha-custo-dica, folha-destinos, folha-dica-cafeteria, seletor-material, seletor-busca, seletor-linha (data-item-id), seletor-contador, seletor-pilula-tudo/-area-{area}, seletor-area-{area}, seletor-categoria, seletor-selo, seletor-erro, seletor-carregando, seletor-vazio, seletor-sem-resultado, seletor-fechar, seletor-lista, estoque-registrar-movimentacao, estoque-acao-fixa"
  - "tests/e2e/apoio/semear-estoque.ts: semearEncomendaAtiva, ligarFichaDePrecificacao, vinculosDoItem"
  - "tests/e2e/estoque-movimentacao.spec.ts (a–k)"
affects: [06-07, 06-08, 06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "um provedor cliente é o único que abre folha e seletor; a seção async ENTREGA a lista a ele por um componente cliente que não desenha nada (efeito sobre as props do servidor)"
    - "cada abertura de folha/seletor ganha uma chave nova (ref contadora) — nasce limpa, sem efeito que zere estado"
    - "campo derivado com 'editado' nulo: o custo da peça pronta é calculado da quantidade enquanto custoDigitado === null"
key-files:
  created:
    - components/amassa/estoque/provedor-estoque.tsx
    - components/amassa/estoque/seletor-material.tsx
    - components/amassa/estoque/grade-destinos.tsx
    - components/amassa/estoque/previa-do-saldo.tsx
    - components/amassa/estoque/barra-acao-fixa.tsx
    - tests/e2e/estoque-movimentacao.spec.ts
  modified:
    - app/gestao/(app)/estoque/page.tsx
    - app/globals.css
    - components/amassa/estoque/folha-movimentacao.tsx
    - components/amassa/estoque/secao-saldos.tsx
    - components/amassa/estoque/aba-saldos.tsx
    - lib/estoque/textos.ts
    - tests/e2e/apoio/semear-estoque.ts
    - tests/e2e/estoque-tracador.spec.ts
decisions:
  - "A grade de destinos virou radiogroup (role=radio + aria-checked, tabulação itinerante, setas movem) — o traçador afirmava aria-pressed; o e2e dele passou a afirmar aria-checked (a interface mudou de contrato, o data-testid não)"
  - "A barra fixa e o botão do cabeçalho abrem o seletor sempre em Saída; 'Trocar material' volta ao seletor com o tipo que estava marcado"
  - "O link 'Ir para Compra de material' vai a /gestao/financeiro?aba=despesa — o painel de Despesa já abre no modo compra (useState('compra')); não existe parâmetro de URL para o modo, e criar um estaria fora do plano"
  - "Falha nas encomendas ou nos custos das peças prontas conta como falha da seção inteira (EstadoErro): mostrar 'Nenhuma' encomenda ou um custo vazio por uma falha escondida seria mentir"
  - "Os erros do servidor que têm campo (custo, destino, encomenda fora de andamento, texto longo, quantidade, contado) voltam para baixo do campo deles, pela frase; o resto fica no topo do rodapé"
  - "Seletor sem nenhum material ativo (todos desativados) tem frase própria, que a UI-SPEC não trazia: 'Nenhum material ativo.' + 'Material desativado não se movimenta. Reative um pelo filtro Desativados da aba Saldos.'"
  - "O selo '⚠ {n}' aparece só no nível da área (UI-SPEC); o protótipo o repetia na categoria"
metrics:
  duration: "~26 min (05:46 → 06:12 UTC, 29/09/2026)"
  completed: 2026-09-29
estimate:
  tokens: 65000
  tasks: 1
actuals:
  tokens: 22800
  tasks: 1
  commits: 2
---

# Phase 06 Plan 06: A folha que se usa de pé Summary

**"Dar baixa", "+1", "Uso do ateliê", "Registrar baixa": quatro toques e o saldo passa de 10 para
9, provado no celular e no desktop. O ajuste pergunta quanto tem na prateleira (aceita zero) e,
quando o servidor acha diferença zero, fecha com "Conferido. O saldo já estava correto." sem gravar
nada. Um provedor único abre a folha e o seletor "Qual material?", e a barra fixa do celular leva
"Registrar movimentação" acima da navegação, com o toast subindo junto.**

## O que foi entregue

### Tarefa 1 (`55c721c`)

**`ProvedorDoEstoque` / `useEstoque` / `EntregaDoEstoque`**
- O provedor guarda a lista (`carregando` → `pronta` ou `erro`), a área lembrada do seletor e a
  folha ou o seletor abertos. Expõe `abrirSeletor(tipo?)` e `abrirFolha({ itemId, tipo })`.
- Cada abertura ganha uma chave nova, então folha e seletor nascem limpos.
- `EntregaDoEstoque` é um componente cliente que não desenha nada. A `SecaoSaldos` o desenha com a
  lista, as encomendas e os custos. Cada `router.refresh()` traz props novas e o efeito entrega a
  lista atualizada.
- Se "Dar baixa" for tocado antes de a lista chegar, a folha abre quando ela chegar.

**`SecaoSaldos`**
- Lê `listarSaldosDaRequisicao()`. Em paralelo, lê `listarEncomendasParaVinculo()` e
  `custosDasPecasProntas(ids das peças prontas, hojeEmBrasilia(new Date()))`.
- O `Map` vira objeto simples antes de atravessar para o cliente.
- Na falha, o provedor recebe `erro` e a tela mostra o `EstadoErro` de sempre.

**`AbaSaldos`**
- "Dar baixa" (cartão e tabela) chama `abrirFolha({ itemId, tipo: "saida" })`. A folha local saiu.

**`FolhaMovimentacao`** (todos os `data-testid` do traçador foram preservados)
- **Estrutura:**
  - cabeçalho com o nome e o fechar de 44×44 (`showCloseButton={false}`);
  - caixa "escolhido" (`superficie-2`), com nome, "saldo de agora: X un" e "Trocar material";
  - segmentado Entrada · Saída · Ajuste em `radiogroup` de 3 colunas, onde as setas circulam;
  - o campo grande de 60px, `inputMode="decimal"`, `enterKeyHint="done"`.
- **Atalhos** vêm de `atalhosDaUnidade` e **somam** ao campo. Levam `aria-label="Somar {n} {un}"`
  e não aparecem no Ajuste. O campo recebe o texto sem separador de milhar (`milesimosParaCampo`),
  porque "1.000" voltaria como 1.
- **Saída:**
  - `GradeDestinos`: os cinco destinos na ordem de `DESTINOS_DE_SAIDA`, com a área embaixo, em
    `radiogroup` com `aria-required="true"`; tocar de novo no marcado desmarca;
  - o vínculo do destino marcado: turma em texto, encomenda num `select` com "Nenhuma" primeiro, e
    perda em texto;
  - a dica da cafeteria quando ela está marcada.
- **Entrada:**
  - material comum: a nota UI-D14 com o link "Ir para Compra de material", antes da quantidade;
  - "Quanto custou ao todo";
  - peça pronta com ficha: o custo vem de `custoPreenchidoDaPecaPronta` e é recalculado a cada
    quantidade até a pessoa editar o campo. A dica é "Pela ficha de precificação: R$ X por peça.
    Pode mudar.";
  - peça pronta com custo zero é recusada no cliente, com a mesma frase do servidor.
- **Ajuste:**
  - "Quanto tem na prateleira agora?", que aceita 0, com a dica "conte, não calcule a diferença";
  - "Por quê?", opcional.
- Trocar de tipo preserva o que foi digitado em cada tipo (entrada e saída têm quantidades
  separadas).
- **Rodapé preso:**
  - o erro de gravação no topo;
  - a `PreviaDoSaldo`;
  - o botão de largura total com `rotuloDoBotaoDeGravar(tipo)`. Enquanto grava, mostra
    "Registrando…" com `disabled` e `aria-busy`, e uma referência síncrona barra o toque duplo.
- **Respostas:**
  - `conferido` → toast "Conferido. O saldo já estava correto." e a folha fecha;
  - senão, o toast conta o GRAVADO: "Baixa de…", "Entrada de…" ou "Ajuste em {nome}: ±d un.".
- **Erros:**
  - de campo: embaixo do campo, `role="alert"`, com o foco indo até ele;
  - os do servidor que têm campo voltam para o campo deles.
- Sem foco automático abaixo de 768px. A partir dele, o foco vai à quantidade (ou ao contado).

**`PreviaDoSaldo`**
- Só lê `previaDaMovimentacao`, em `aria-live="polite"`.
- A cor segue o tom: acento-fundo/acento-hover (P6), atenção (P1), erro (P4), neutra (P8).
- Os números saem em `<b>` com `tabular-nums`.

**`SeletorMaterial`**
- Mesma folha de tela toda (`CLASSE_DA_FOLHA`), "Qual material?" / "Filtre pela área ou busque pelo
  nome".
- Busca de 44px. Pílulas "Tudo" + áreas com contagem, com a área lembrada no provedor.
- Sem busca, a sanfona fica toda fechada:
  - área: 52px, Título, ponto, selo "⚠ {n}" com " acabando" oculto e contador;
  - categoria da compra: 48px, com a linha-guia de 2px;
  - material: 56px, com nome que quebra, chip e saldo `whitespace-nowrap`.
  - Os botões têm `aria-expanded`/`aria-controls`, e o chevron gira só com `motion-safe`.
- Com busca, a lista é plana e alfabética, com "1 material encontrado" / "{N} materiais
  encontrados".
- Só materiais ativos. Estados: carregando (esqueleto), erro (`EstadoErro` + "Tentar de novo"),
  sem ativo e busca sem resultado.
- O foco vai à busca só a partir de 768px.

**`BarraAcaoFixa` / `BotaoRegistrarMovimentacao`**
- A barra é `md:hidden`, `fixed`, e fica em
  `bottom: calc(var(--altura-barra-inferior) + env(safe-area-inset-bottom))`, com
  `h-[var(--altura-acao-fixa)]`, `bg-fundo/94`, `backdrop-blur`, borda de cima e `data-acao-fixa`.
- O botão tem 52px, `flex-1` e `whitespace-normal`, então pode quebrar a 320px.
- O botão do cabeçalho é `hidden md:inline-flex`.
- A página reserva `pb-[calc(var(--altura-acao-fixa)+16px)]` abaixo de 768px.

**`app/globals.css`**
- `--altura-acao-fixa: 68px`.
- Em `@media (width < 48rem)`, `:root:has([data-acao-fixa])` soma essa altura ao
  `--deslocamento-aviso`, com comentário no molde da 04.4.
- A condição de largura é obrigatória: a regra tem especificidade maior que o bloco de desktop.

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` + `npx eslint components/amassa/estoque app/gestao/(app)/estoque lib/estoque/textos.ts` | limpos na primeira passada |
| `npm run verificar` | **exit 0**. `eslint --max-warnings=0` limpo; `tsc` limpo; `verificar-acoes: 75 ação(ões) conferida(s), 0 violações` (as duas linhas "1 violação" são os fixtures do próprio verificador); `Test Files 90 passed (90)`, `Tests 1498 passed (1498)`; `test:migracoes`: "Todas as afirmações passaram." Rodado duas vezes, a segunda só para capturar as linhas de resumo. |
| `npm run test:e2e -- --grep "estoque movimentacao\|estoque tracador\|estoque saldos"` | **1 invocação, a única do plano**: `86 passed (1.1m)`. Passaram `estoque movimentacao` (a–k), `estoque tracador` (3) e `estoque saldos` (a–j) nos projetos desktop e celular, mais os `@vazio-global` da cadeia. |

No log do servidor do e2e apareceram várias linhas `[WebServer] ⨯ Error: The destination stream
closed early.` (digest `1591381167`). Nenhum teste falhou. A leitura mais provável é o navegador
fechar a página no fim de cada teste com uma resposta em fluxo (Suspense/`router.refresh`) ainda
aberta. Não investiguei além disso e registro como ruído observado.

Nenhum `npm run build` separado e nenhuma varredura sem `--grep`: essa é do último plano da fase.

**Greps de aceite:**
- "Venda na loja" fora de comentário em `components/amassa/estoque` e `lib/estoque` → nada;
- `data-acao-fixa` em `barra-acao-fixa.tsx` → 2; `altura-acao-fixa` em `globals.css` → 2;
- `aria-live="polite"` em `previa-do-saldo.tsx` → 1;
- `showCloseButton={false}` → 1 em `folha-movimentacao.tsx` e 1 em `seletor-material.tsx`;
- `previaDaMovimentacao` → 3 em `previa-do-saldo.tsx` e 0 em `folha-movimentacao.tsx`, soma 3. A
  folha só entrega a entrada à prévia;
- `dangerouslySetInnerHTML` e hex de 6 dígitos em `components/amassa/estoque` → nada.

**Branch:**
- tudo ficou em `gsd/phase-06-estoque`;
- `main` continua em `a8c7bad`;
- nada foi publicado;
- nenhuma migração foi aplicada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O e2e do traçador afirmava `aria-pressed` no destino**
- **Found during:** Tarefa 1, ao fazer a grade `radiogroup` (exigência de EST-11 · adjacency)
- **Issue:** `role="radio"` usa `aria-checked`. O `aria-pressed` não vale em rádio.
- **Fix:** uma linha de `estoque-tracador.spec.ts` passou a afirmar `aria-checked`, com um
  comentário. O `data-testid` não mudou, e o plano já previa atualizar o traçador "só onde a
  interface mudou de contrato".
- **Commit:** `55c721c`

**2. [Rule 2 - Correção] O texto que vai para o campo não usa `formatarQuantidade`**
- **Issue:** somar atalhos até 1000 daria "1.000". A conversão do campo lê isso como 1 com três
  casas.
- **Fix:** `milesimosParaCampo`, sem separador de milhar. O custo preenchido usa
  `centavosParaCampo` ("1234,56"), no molde de `painel-despesa.tsx`.
- **Commit:** `55c721c`

**3. [Fora da lista `files_modified`] `lib/estoque/textos.ts`**
- As frases do seletor e da caixa "escolhido" entraram no módulo de textos, onde mora toda frase
  do Estoque, e não soltas nos componentes. É uma mudança só aditiva.
- **Commit:** `55c721c`

### Escolhas dentro do plano (registradas)

- **O vazio sem material nenhum ainda mostra a barra fixa.** A decisão "vazio → sem barra, sem
  ações no cabeçalho" é do plano 06-09 (`estadoDoEstoque`, tomada no servidor antes de pintar).
  Aqui, tocar na barra nesse estado abre o seletor com "Nenhum material ativo.".
- **"Ir para Compra de material"** leva à aba Despesa, que já abre em Compra de material. Não criei
  parâmetro de URL para o modo.
- **Encomendas e custos de peça pronta fazem parte da mesma leitura da seção.** Se falharem, a
  seção inteira mostra o erro (ver `decisions`).

## Known Stubs

Nenhum stub que impeça o objetivo do plano. Limites declarados, cada um com o plano que o resolve:
- "+ Material" na barra fixa e "+ Novo material" no cabeçalho são do 06-09;
- "Contar estoque" é do 06-10;
- a barra de abas e o `CarregadorDoSeletor` fora da aba Saldos são do 06-07;
- a barra fixa ainda aparece no vazio sem nenhum material (06-09).

O cronômetro de EST-09 (< 15 s) e as duas conferências `backstop` (a barra fixa a 320px e o seletor
com a consulta forçada a falhar) são do dono, no portão do plano 06-11.

## Threat surface

Nenhuma superfície fora do `<threat_model>`:
- **T-06-54:** a prévia só lê `previaDaMovimentacao`. O toast conta o que o servidor gravou, e o
  e2e (b) prova o "Conferido" vindo do servidor, sem linha nova.
- **T-06-55:** nenhum `dangerouslySetInnerHTML`. Nomes de material e de encomenda são texto do
  React.
- **T-06-56:** o botão fica `disabled` com `aria-busy` e a referência síncrona barra o segundo
  toque. O e2e (k) e o traçador contam UMA linha.

Nenhuma Server Action nova: `verificar-acoes` continua com 75.

## Self-Check: PASSED

- Os 6 arquivos criados e os 8 modificados estão no commit `55c721c` (`git show --stat`).
- O commit `55c721c` está no branch `gsd/phase-06-estoque`. `main` continua em `a8c7bad`.
- `STATE.md` e `ROADMAP.md` não foram modificados por este plano (são do orquestrador).
