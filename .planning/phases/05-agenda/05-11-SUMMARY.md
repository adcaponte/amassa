---
phase: 05-agenda
plan: 11
subsystem: agenda
status: complete
tags: [agenda, a-receber, recebi-agora, financeiro, venda, age-15, d-01, d-04, d-08, d-14, pitfall-8, ui-d4]
requires:
  - "05-01: mensalidades/inscricoes/usos_livres com documento_id e dispensada_em, documentos.cliente_id + check documentos_cliente_exige_pessoa_nome, itens do sistema por chave (D-17)"
  - "05-07: garantirMensalidadesDoMes (D-02)"
  - "05-08: inscrições cobradas (oficina, experimental cobrada), ligarVendaAInscricao, cancelarDocumentoNoBanco"
  - "05-09/05-10: uso livre encerrado com valor e material cobrado de preço congelado, FolhaUsoLivre"
  - "Fase 04.4/06: lancarVenda, conferirParcelas, obterConfiguracaoFinanceira, hrefDoCaixa, pedidosDaVenda + gravarMovimentacoes"
provides:
  - "lib/financeiro/gravacao.ts (sem a diretiva): gravarVenda(tx, pedido, contexto), PedidoDeVenda, ContextoDaVenda, LinhaDoPedidoDeVenda, ParcelaDoPedidoDeVenda — o escritor único da venda"
  - "lib/financeiro/acoes.ts: lancarVenda valida e chama gravarVenda (sem mudança de comportamento)"
  - "lib/agenda/receber.ts (puro): TIPOS_DE_COBRANCA, TipoDeCobranca, SituacaoDaCobranca, situacaoDaCobranca, CobrancaDaAgenda, itensAReceber, totalAReceber, dataDeVencimento, descricaoDaLinha, subLinhaDaCobranca, subLinhaDoUsoLivre, linhasDaVenda, ItensDoSistema"
  - "lib/agenda/gravacao.ts: lerCobrancas(leitor, { soLivres }), lerCobranca, travarCobranca, vincularVenda, ReferenciaDaCobranca"
  - "lib/agenda/consultas.ts: lerAReceber (LinhaAReceber, AReceberCarregado), quantosAReceber; UsoLivreCarregado.cobranca (CobrancaDoUsoLivre)"
  - "lib/agenda/acoes.ts: receberAgora (112 ações no portão)"
  - "lib/agenda/esquemas.ts: esquemaReceberAgora, FORMAS_DE_RECEBER, FormaDeReceber"
  - "lib/agenda/abas.ts: AbaDaAgenda com receber"
  - "lib/agenda/textos.ts: rotuloDaAbaReceber, TITULO_A_RECEBER, FRASE_NINGUEM_DEVENDO, CORPO_NINGUEM_DEVENDO, DICA_FIM_A_RECEBER, tagVendaCancelada, frases do Recebi agora, toastRecebiAgora, fraseJaLancado, FRASE_FALHA_AO_RECEBER, FRASE_COBRANCA_SUMIU, FRASE_COBRANCA_DISPENSADA"
  - "components/amassa/agenda: AReceber, EsqueletoDoAReceber, EsqueletoPelaAba, LinhaAReceber, FolhaRecebiAgora; AbasDaAgenda com quantosAReceber"
  - "data-testid: aba-receber, a-receber, a-receber-total, a-receber-vazio, a-receber-carregando, a-receber-linha (data-tipo, data-id, data-situacao), a-receber-nome, a-receber-valor, a-receber-sub, tag-venda-cancelada, recebi-agora, folha-recebi-agora, recebi-agora-topo, recebi-agora-taxa, recebi-agora-erro, recebi-agora-voltar, forma-dinheiro, forma-pix, forma-cartao"
  - "tests/e2e/apoio/semear-agenda.ts: semearUsoLivreEncerrado, itemDoSistemaNoBanco, vendaDaCobranca, vendasDoCliente"
affects:
  - "Toda carga de /gestao/agenda (qualquer aba) faz nascer a mensalidade do mês (D-02) antes de contar o “ · {N}” da aba"
  - "A Agenda passa a criar vendas reais no Financeiro, com documentos.cliente_id preenchido"
  - "A folha do uso livre encerrado e a receber ganha “Recebi agora” no rodapé"
tech-stack:
  added: []
  patterns:
    - "Escritor de venda único fora de arquivo com a diretiva (gravarVenda recebe a transação de quem chama)"
    - "Cobrança → venda numa transação: trava for no key update da cobrança, conferência “livre” sob a trava, vínculo na mesma transação"
    - "“Pago” derivado por leitura (left join documentos + contagem de parcelas em aberto), nada gravado no cancelamento"
    - "Contador de aba num Suspense próprio, com as abas sem contador de fallback"
key-files:
  created:
    - lib/financeiro/gravacao.ts
    - lib/agenda/receber.ts
    - components/amassa/agenda/a-receber.tsx
    - components/amassa/agenda/linha-a-receber.tsx
    - components/amassa/agenda/folha-recebi-agora.tsx
    - tests/unit/agenda-receber.test.ts
    - tests/e2e/agenda-receber.spec.ts
  modified:
    - lib/financeiro/acoes.ts
    - lib/agenda/abas.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - app/gestao/(app)/agenda/loading.tsx
    - components/amassa/agenda/abas-da-agenda.tsx
    - components/amassa/agenda/folha-uso-livre.tsx
    - tests/unit/agenda-abas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "O contador da aba garante a mensalidade do mês antes de contar (D-02 em toda carga da Agenda)"
  - "Uso livre de uma pessoa: “Uso livre · {h} h · {dd/mm}”, sem “× 1 pessoas” (molde do protótipo)"
  - "O topo do “Recebi agora” usa a sub-linha de “A receber”, não a descrição da linha da venda"
  - "“Voltar à agenda” continua no rodapé do uso encerrado a receber, ao lado de “Recebi agora”, até o plano 12"
  - "Venda cancelada: o vínculo da cobrança passa a apontar a venda nova; a cancelada continua no Caixa"
metrics:
  duration: "~30 min (21:47 → 22:17, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 20
actuals:
  tokens: 31000
  tasks: 3
  commits: 5
---

# Phase 5 Plan 11: “A receber” e “Recebi agora” — a cobrança da Agenda vira Venda já paga no Caixa do dia — Summary

**A aba “A receber” lista mensalidades, inscrições cobradas e usos livres encerrados que ainda não viraram
venda, em ordem de vencimento, com o total. “Recebi agora” e um toque na forma criam a Venda já paga hoje,
pelo mesmo escritor da Venda manual (`gravarVenda`), ligada à cobrança e à pessoa. Ela entra no Caixa do
dia, e a linha sai de “A receber”. O “pago” vem do Financeiro: quando o Caixa cancela a venda, a cobrança
volta sozinha, com a tag “venda nº N cancelada”, e pode ser recebida de novo.**

## O que foi feito

### Tarefa 1: um escritor de venda só (commit `49cfa79`)

- `lib/financeiro/gravacao.ts` não tem a diretiva de Server Action. O cabeçalho explica por quê, quem
  chama a função (`lancarVenda`, `receberAgora` e, no plano 12, `lancarMensalidadesEmLote`) e a ordem de
  travas.
- `gravarVenda(tx, pedido, contexto)` é o miolo da transação de `lancarVenda`, movido com os comentários:
  1. grava o documento, com `pessoa_nome` sempre e `cliente_id` quando o pedido traz;
  2. grava as linhas; a descrição da linha de item vem do pedido;
  3. dá baixa no estoque das linhas de item (`pedidosDaVenda` + `gravarMovimentacoes`);
  4. grava as parcelas, com a taxa do cartão congelada e `pago_por` = quem registrou.
- `lancarVenda` mantém `exigirUsuario()`, a validação e o `try/catch`. Ela monta o pedido (linha de item
  com `descricao: item.nome` e valores já descontados) e chama `gravarVenda` em `db.transaction`. Nenhuma
  frase e nenhuma revalidação mudou. A Venda manual continua sem `clienteId`.

### Tarefa 2: o módulo puro (commits `48a8569` RED, `ea92d73` GREEN)

`lib/agenda/receber.ts`, com 24 testes, incluindo o de pureza:
- **`situacaoDaCobranca`** deriva a situação de uma cobrança:
  - sem venda: `a_receber`;
  - venda cancelada: `venda_cancelada`;
  - parcela em aberto: `lancado`;
  - nenhuma parcela em aberto: `pago`;
  - dispensada e sem venda ativa: `dispensada`. Uma venda ativa prevalece sobre a dispensa.
- **`itensAReceber`** monta a lista:
  - deixa de fora valor 0, `lancado`, `pago`, `dispensada` e inscrição de data cancelada;
  - mantém `venda_cancelada`;
  - ordena pelo vencimento da mensalidade ou pela data do evento, depois pelo nome (sem diferenciar
    acento nem maiúscula) e pelo id;
  - a mesma pessoa pode ter duas linhas.
- **`descricaoDaLinha`** aplica a D-04 e corta em 160 pontos de código, terminando em “…”.
- **`subLinhaDaCobranca` / `subLinhaDoUsoLivre`** montam a sub-linha da UI-SPEC.
- **`linhasDaVenda`**:
  - mensalidade, inscrição e uso livre dão UMA linha do item do sistema, com quantidade 1;
  - o uso livre ganha também uma linha LIVRE por material cobrado (“{nome} · {q} {un}”), com o valor
    congelado e na categoria do “Uso livre (hora)”;
  - se a soma das linhas for diferente do valor congelado, a função lança erro: isso é defeito, nunca
    desconto.

### Tarefa 3: a aba e “Recebi agora” (commit `aec2f25`)

**Servidor.**
- `lerCobrancas` lê as três tabelas com `left join documentos`, o material dos usos e, numa só consulta, a
  contagem de parcelas em aberto das vendas ativas. Com `soLivres`, o SQL já exclui as cobranças com venda
  ativa e as dispensadas; o resto da regra fica no puro.
- `travarCobranca` usa `for no key update of <cobrança>`. O documento é só lido, nunca travado.
- `vincularVenda` grava o `documento_id`.
- `receberAgora`:
  1. `exigirUsuario()` primeiro;
  2. Zod aceita só tipo, id e forma;
  3. a configuração e os itens do sistema são lidos fora da transação;
  4. dentro da transação, trava a cobrança;
  5. recusa a cobrança em quatro casos, cada um com a sua frase: já lançada, sumiu, dispensada, data
     cancelada;
  6. monta as linhas com `linhasDaVenda` e confere com `conferirParcelas`;
  7. chama `gravarVenda` com UMA parcela paga hoje e com o `clienteId`;
  8. grava o vínculo.

  Revalida a Agenda, `/financeiro` e o Início.

**Tela.**
- A aba “A receber” é a terceira, com “ · {N}” quando N > 0. A contagem fica num `Suspense` próprio, então
  as abas aparecem sem esperar por ela.
- Em `?aba=receber`, a ordem é `garantirMensalidadesDoMes` → `lerAReceber` → `AReceber`. O bloco tem
  cabeçalho e total, as linhas, o vazio “Ninguém devendo.” com “R$ 0,00” e a dica do fim.
- `LinhaAReceber` tem a grade `1fr auto`, a sub-linha, a tag âmbar “venda nº N cancelada” e o “Recebi
  agora” (`outline`, 44px). Abaixo de 360px, o botão ocupa a largura toda.
- `FolhaRecebiAgora` segue a UI-D4:
  - ocupa a tela toda no celular e é `md:max-w-sm` a partir de 768px;
  - tem o topo, a dica e três botões `outline` de 52px empilhados, e a taxa aparece embaixo do “Cartão”;
  - tocar uma forma já grava: o botão mostra “Registrando…” e os três ficam `disabled`, com um `useRef`
    contra o toque duplo;
  - o toast traz o link “ver no Caixa”.
- O esqueleto do `loading.tsx` muda pela aba (`EsqueletoPelaAba`), e a página tem o seu próprio
  (`EsqueletoDoAReceber`): cabeçalho, sanfona e 4 linhas.
- `FolhaUsoLivre` encerrada e ainda a receber mostra “Recebi agora” no rodapé, que abre a folha por cima.
  Depois de lançada ou paga, o botão some.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit`, `npx eslint` (Tarefa 1) | limpos |
| `npm run verificar` (Tarefa 1) | **saiu 0**, com `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "financeiro venda\|financeiro tracador\|estoque financeiro"` (Tarefa 1) | **114 passed, 2 skipped (1.4m)** na primeira. Os dois pulados são o caso de `financeiro-venda.spec.ts:564`, que se pula quando “hoje é dia 1” (hoje é 01/10), um por projeto |
| `npx vitest run tests/unit/agenda-receber.test.ts` (RED) | falhou como esperado: o módulo não existia |
| o mesmo (GREEN) | **24/24** |
| `npx vitest run tests/unit/agenda-abas.test.ts tests/unit/agenda-receber.test.ts` | **51/51** |
| `npm run verificar-acoes` | **112 ações**, 0 violações (era 111; entrou `receberAgora`) |
| `npm run verificar` (Tarefa 3) | **saiu 0**: 112 arquivos / **2173** testes, 112 ações, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda receber"` (Tarefa 3) | **64 passed (1.6m)** na primeira: (a) em `vazio-celular` e `vazio-desktop`, (b)-(f) × desktop e celular, mais a cadeia `vazio-*` |

Foram **duas** invocações de e2e, uma por tarefa com e2e, dentro do orçamento. A Tarefa 2 é unitária. Não
rodei `npm run build` separado nem a varredura sem `--grep`, que fica para o plano 16.

Greps de aceite:
- `insert(documentos)` em `lib/financeiro/acoes.ts`: 2 no `main`, **1** agora; em
  `lib/financeiro/gravacao.ts`: **1**.
- `"use server"` em `gravacao.ts`: **0**; `clienteId` nele: **2**.
- `gravarVenda` em `lib/agenda/acoes.ts`: **5**; `insert(documentos)` em `lib/agenda`: nada.
- `garantirMensalidadesDoMes` em `page.tsx`: **6**, contando a ficha, a aba e o contador.
- `pago_em|pagoEm` em `lib/agenda/acoes.ts` e `gravacao.ts`: uma ocorrência só, e é uma LEITURA
  (`isNull(parcelas.pagoEm)` na contagem de parcelas em aberto). A Agenda não escreve pagamento.
- Nada de `@/db`, `react`, `next`, `drizzle-orm` ou `pg` em `lib/agenda/receber.ts`.

## Deviations from Plan

### Auto-fixed Issues / ajustes

**1. [Rule 2] O grep do e2e da Tarefa 1 incluiu `estoque financeiro`**
- `gravarVenda` agora carrega a baixa de estoque da venda, e quem prova essa baixa (e o estorno no
  cancelamento) é `estoque-financeiro.spec.ts`. Por isso ele entrou no mesmo `--grep`, sem invocação a
  mais. Passou nos dois projetos.

**2. [Escopo] Artefatos da tabela que foram para o plano 13 (revisão 1 do verificador)**
- A tabela de artefatos do plano ainda lista `cobrancasDaPessoa`, `situacoesDasInscricoes`,
  `situacaoDaMensalidadeDoMes`, `semearCobrancaLancada` e os `data-testid` `tag-pagamento` e
  `quadro-a-receber`. A verdade 8 do próprio plano diz que as tags de pagamento fora de “A receber” são
  do plano 13, Tarefa 2, e a ação desta tarefa repete isso. Não criei esses artefatos.
- O plano 13 tem pronto o que precisa: `lerCobrancas` lê sem o filtro `soLivres`, devolve a contagem de
  parcelas, e `situacaoDaCobranca` deriva os cinco estados.

**3. [Rule 2] Acréscimos que a tela precisava**
- `lerCobranca` (sem trava) e `UsoLivreCarregado.cobranca`: o rodapé da folha do uso decide sozinho se
  mostra “Recebi agora”.
- `quantosAReceber`: o contador da aba.
- `subLinhaDaCobranca` e `subLinhaDoUsoLivre` no puro: a sub-linha é regra de texto com dinheiro, e o
  `textos.ts` não tem import nenhum.
- `EsqueletoPelaAba`: o `loading.tsx` não recebe a URL.

**4. Tipo de commit da Tarefa 1:** usei `refactor(05-11)`, porque a extração não muda comportamento.

Nenhuma migração e nenhum pacote novo. A `0026`, `db/schema.ts` e `TABELAS_ESPERADAS` não mudaram:
`documentos.cliente_id`, os `documento_id` das três cobranças e os itens do sistema já existiam desde o
plano 01.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado além do
efêmero.

1. **O contador “ · {N}” da aba faz nascer a mensalidade do mês antes de contar.** Isso põe a escrita
   idempotente da D-02 em toda carga de `/gestao/agenda`, e não só na ficha e em “A receber”. Sem ela, a
   aba mostraria um número menor que a lista até alguém abrir “A receber”. A escrita é uma instrução
   `insert … on conflict do nothing`. Se a contagem falhar, as abas aparecem sem contador e a página não
   cai. *Desfazer:* tirar a chamada de `AbasComContagem` em `page.tsx`.
2. **Uso livre de uma pessoa: “Uso livre · 3 h · 12/10”, sem “× 1 pessoas”**, tanto na sub-linha quanto
   na descrição da venda. A verdade 6 escreve “× {n} pessoas” sempre. O protótipo (`devidos()`) e a
   UI-SPEC só põem esse trecho com mais de uma pessoa, e o BRIEFING e a UI-SPEC prevalecem sobre o texto
   do plano. *Desfazer:* `textoDoUsoLivre` em `receber.ts`.
3. **O topo do “Recebi agora” é “{nome} · {sub-linha} · {R$}”**, a sub-linha de “A receber” (com “vence
   dia {d}” e “material {R$}”). A UI-SPEC diz “{descrição}” sem fixar qual. A sub-linha explica o valor,
   que no uso livre inclui o material. *Desfazer:* o `descricao` passado em `a-receber.tsx` e em
   `CobrancaDoUsoLivre`.
4. **Uso encerrado a receber: “Voltar à agenda” continua no rodapé, ao lado de “Recebi agora”.** A
   UI-SPEC prevê “Recebi agora” + “Lançar na Venda”, e este segundo botão é do plano 12. Assim a folha não
   fica com um botão só, e o e2e do plano 09, que toca `uso-voltar`, continua valendo. O plano 12 decide
   o rodapé final. *Desfazer:* `folha-uso-livre.tsx`, no bloco `encerrado`.
5. **Recebendo de novo uma cobrança cuja venda foi cancelada**, o `documento_id` passa a apontar a venda
   nova. A cancelada continua no Caixa, riscada. A D-08 diz que a cobrança “pode ser lançada de novo” e
   não guarda histórico de vínculos. *Desfazer:* exige uma tabela de vínculos (migração), o que é decisão
   do dono.
6. **Recusas decididas sob a trava fecham a folha e vão para um toast**, porque a ação já atualizou a
   tela. São elas: “Este item já foi lançado (venda nº N)…”, item sumido, item dispensado e data
   cancelada. A falha genérica (“Não deu para registrar…”) fica dentro da folha, que continua aberta.
   *Desfazer:* `telaJaFoiAtualizada` em `folha-recebi-agora.tsx`.
7. **Frases que a UI-SPEC não fixa:**
   - “Este item não está mais em “A receber” — a tela foi atualizada.”;
   - “Esta cobrança foi dispensada — a tela foi atualizada.”;
   - `aria-label` “Como recebeu” no grupo das formas e “O que falta receber” na lista;
   - o toast escreve a forma em minúscula (“paga em pix”, “em cartão”, “em dinheiro”), como o exemplo do
     plano.

   *Desfazer:* `lib/agenda/textos.ts`.
8. **A lista filtra no SQL** as cobranças com venda ativa e as dispensadas. O puro aplica a regra inteira
   de novo, então o histórico de mensalidades pagas não é lido a cada carga. *Desfazer:* `soLivres` em
   `lerCobrancas`.

## Para o dono olhar no portão (plano 16)

- Os dois backstops do plano, conferidos a olho:
  - **E15 long-text:** uma turma com nome de 120 caracteres em “A receber” a 320px. A sub-linha e a tag
    precisam quebrar sem empurrar o valor.
  - **E18 long-text:** “Recebi agora” para uma pessoa com nome de 160 caracteres a 320px. O topo precisa
    quebrar e os três botões precisam caber com no máximo um gesto.
- O fluxo de dois toques no celular de verdade: “Recebi agora” → “Pix”, e depois o toast com “ver no
  Caixa”.

## Known Stubs

Nenhum que impeça o objetivo do plano. O que falta já tem plano marcado na mesma fase:
- A dica do fim fala de “os dois botões” e de “Lançar na Venda”, mas por enquanto a linha só tem “Recebi
  agora”. O plano 12 traz “Lançar na Venda” e a sanfona do lote, e o plano 13 traz “Dispensar a
  cobrança”, “Dispensadas” e as tags de pagamento fora de “A receber”.
- Não registrei nada em `.planning/WINDOWS.md`. A lacuna fecha dentro desta fase, antes do portão.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-51:** `receberAgora` começa por `exigirUsuario()`. São 112 ações e 0 violações.
- **T-05-52:** `lib/financeiro/gravacao.ts` não tem a diretiva (grep 0).
- **T-05-53:** o esquema aceita só `cobranca.tipo`, `cobranca.id` e `forma`. Linhas, valor, cliente e
  categoria vêm do banco, sob a trava. O e2e (b) confere o documento inteiro.
- **T-05-54:** trava da cobrança, conferência sob a trava e vínculo na mesma transação. O e2e (c) prova
  o toque duplo (uma venda) e as duas abas (a segunda recebe “já foi lançado (venda nº N)”).
- **T-05-55:** os e2e de `financeiro venda`, `tracador` e `estoque financeiro` continuam verdes, e nenhum
  teste do Financeiro foi alterado.
- **T-05-56:** frases humanas na tela. O SQLSTATE só aparece no log (`codigoDoErroPostgres`).

## TDD Gate Compliance

- Tarefa 2: `test(05-11)` `48a8569` (RED: o módulo não existia) → `feat(05-11)` `ea92d73` (GREEN). Sem
  refatoração.
- Tarefas 1 e 3 não eram `tdd`.

## Self-Check: PASSED

- Os arquivos novos estão presentes:
  - `lib/financeiro/gravacao.ts`
  - `lib/agenda/receber.ts`
  - `components/amassa/agenda/{a-receber,linha-a-receber,folha-recebi-agora}.tsx`
  - `tests/unit/agenda-receber.test.ts`
  - `tests/e2e/agenda-receber.spec.ts`
- Os commits `49cfa79`, `48a8569`, `ea92d73` e `aec2f25` estão no branch `gsd/phase-05-agenda`. Não houve
  push nem merge, e nenhum commit apagou arquivo: `git diff --diff-filter=D cb433d7 HEAD` não lista nada.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados.
