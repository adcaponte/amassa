---
phase: 05-agenda
plan: 12
subsystem: agenda
status: complete
tags: [agenda, financeiro, venda, lancar-na-venda, lote, age-15, age-16, d-01, d-04, d-08, d-09, pitfall-8, pitfall-10, ui-d26]
requires:
  - "05-11: gravarVenda (escritor único), travarCobranca/vincularVenda/lerCobranca, linhasDaVenda, descricaoDaLinha, situacaoDaCobranca, A receber"
  - "05-07: garantirMensalidadesDoMes (D-02), mensalidades proporcionais"
  - "Fase 04.4: PainelVenda, rascunho comum em sessionStorage (CHAVE_RASCUNHO_VENDA), BlocoPagamento (à vista em aberto + Vence em), hrefDoCaixa"
provides:
  - "lib/financeiro/abas.ts: OrigemDaVenda, TipoDaOrigemDaVenda, origemDaUrl, textoDaOrigem"
  - "lib/financeiro/navegacao.ts: hrefDaVendaComOrigem"
  - "lib/financeiro/esquemas.ts: origem opcional em esquemaVendaEntrada, FRASE_ORIGEM_INVALIDA"
  - "lib/financeiro/acoes.ts: lancarVenda com origem (devolve também origem)"
  - "lib/agenda/gravacao.ts: vincularCobranca, CobrancaVinculada, travarMensalidades"
  - "lib/agenda/consultas.ts: cobrancaParaVenda, CobrancaParaVenda, itensDoSistemaParaVenda (movida de acoes.ts), AReceberCarregado.lote"
  - "lib/agenda/receber.ts: loteDeMensalidades, LinhaDoLote, LoteDeMensalidades"
  - "lib/agenda/esquemas.ts: esquemaLoteDeMensalidades, LIMITE_DO_LOTE"
  - "lib/agenda/acoes.ts: lancarMensalidadesEmLote, LoteLancado (113 ações no portão)"
  - "lib/agenda/textos.ts: frases da Venda da Agenda, da volta e do lote"
  - "components: FaixaDaAgenda, OrigemIndisponivel, LoteDeMensalidades, AvisoDaAgenda; PainelVenda com origem e rascunhoInicial; LinhaCarrinho com fixa"
  - "data-testid: faixa-da-agenda, faixa-da-agenda-texto, faixa-em-montagem, voltar-a-agenda, pessoa-travada, pessoa-travada-dica, origem-indisponivel, origem-ver-no-caixa, lancar-na-venda, lote-mensalidades, lote-resumo, lote-linha, lote-lancar, lote-erro"
affects:
  - "A Venda do Financeiro ganha o modo “aberta pela Agenda” por ?origem=; sem origem, nada muda"
  - "lancarVenda pode travar uma cobrança da Agenda e gravar o vínculo na mesma transação"
  - "“A receber” ganha a sanfona do lote e o “Lançar na Venda” por linha"
tech-stack:
  added: []
  patterns:
    - "Origem na URL só diz QUAL cobrança; o servidor resolve o carrinho na renderização e sobrescreve pessoa, cliente e descrição sob a trava"
    - "Ajudante da Agenda devolve um gravador do vínculo (gravar(documentoId)) para quem chama gravarVenda no meio"
    - "Painel em modo origem nunca lê para aplicar nem grava o rascunho comum (só detecta que existia)"
    - "Lote: trava em ordem de id, pula e conta, uma venda por linha, tudo numa transação"
key-files:
  created:
    - components/amassa/financeiro/faixa-da-agenda.tsx
    - components/amassa/agenda/lote-de-mensalidades.tsx
    - components/amassa/agenda/aviso-da-agenda.tsx
    - tests/e2e/agenda-venda-preenchida.spec.ts
    - tests/e2e/agenda-mensalidades-lote.spec.ts
  modified:
    - lib/financeiro/abas.ts
    - lib/financeiro/navegacao.ts
    - lib/financeiro/esquemas.ts
    - lib/financeiro/acoes.ts
    - app/gestao/(app)/financeiro/page.tsx
    - components/amassa/financeiro/painel-venda.tsx
    - components/amassa/financeiro/linha-carrinho.tsx
    - lib/agenda/receber.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - components/amassa/agenda/a-receber.tsx
    - components/amassa/agenda/linha-a-receber.tsx
    - components/amassa/agenda/folha-uso-livre.tsx
    - tests/unit/financeiro-abas.test.ts
    - tests/unit/agenda-receber.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "Valor e quantidade da linha de origem continuam editáveis (UI-SPEC UI-D26); o servidor decide pessoa, cliente e descrição, e o valor inicial vem do banco"
  - "Origem dispensada, de data cancelada, de valor 0 ou mal formada mostra “Não achei este item da Agenda…”"
  - "“Limpar” na Venda da Agenda volta ao carrinho da origem e não toca no rascunho comum"
  - "Rodapé do uso encerrado a receber: “Voltar à agenda” + “Recebi agora” + “Lançar na Venda” (primário)"
  - "No lote, a dispensada que chega pela corrida conta em “já estavam lançadas”"
metrics:
  duration: "~20 min (22:23 → 22:43, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 25
actuals:
  tokens: 29000
  tasks: 3
  commits: 6
---

# Phase 5 Plan 12: “Lançar na Venda” abre a Venda já preenchida, e o lote lança as mensalidades do mês — Summary

**“Lançar na Venda” abre a Venda do Financeiro já montada pela cobrança: a faixa “Da Agenda”, a pessoa
travada, a linha de origem sem o “tirar” e o pagamento à vista em aberto, vencendo no dia da cobrança.
O gestor ajusta desconto, sinal ou parcelas e lança. O servidor trava a cobrança, sobrescreve pessoa,
cliente e descrição, grava a venda e o vínculo na mesma transação e volta à Agenda com “Lançado na venda
nº N…”. A venda que estava em montagem no Financeiro não é apagada nem misturada. O lote de “A receber”
cria uma venda por mensalidade, cada uma com uma parcela em aberto no dia da turma, sem duplicar nada,
nem com duas abas.**

## O que foi feito

### Tarefa 1: a origem na URL e no servidor (commits `d261b5a` RED, `5d4ce42` GREEN)

- Funções puras:
  - `origemDaUrl` aceita só `mensalidade|inscricao|uso_livre:{uuid}`. Tipo desconhecido, uuid inválido,
    texto vazio, caixa alta no tipo, espaço ou lista viram `null`.
  - `textoDaOrigem` faz o caminho inverso.
  - `hrefDaVendaComOrigem` monta a URL por `URLSearchParams`, que escapa o “:” como `%3A`.
  - 17 casos novos em `financeiro-abas.test.ts`.
- `cobrancaParaVenda(origem)` em `consultas.ts` devolve uma de três situações:
  - `livre`: cliente, nome, descrição D-04, vencimento (o da mensalidade ou a data do evento ou do uso),
    as linhas de `linhasDaVenda` e o item do sistema;
  - `ja_lancada { numero }`;
  - `nao_achada`.
- `vincularCobranca(tx, origem)` em `gravacao.ts`, sem a diretiva de Server Action (grep `"use server"`
  = 0):
  - trava a cobrança com `for no key update`;
  - confere que ela está livre: sem venda ou com venda cancelada (D-08), não dispensada, com valor e com
    a data de pé;
  - acha o item do sistema pela chave;
  - devolve `{ clienteId, clienteNome, descricao, itemDoSistemaId, gravar(documentoId) }`.
- `lancarVenda` com `origem`, dentro do `db.transaction`:
  1. `vincularCobranca` na **linha 248** de `lib/financeiro/acoes.ts`, antes do `gravarVenda` da
     **linha 263**;
  2. procura a primeira linha com o item do sistema; se não houver, recusa com “A linha que veio da
     Agenda precisa continuar na venda.”;
  3. sobrescreve `pessoaNome`, `clienteId` e a `descricao` dessa linha;
  4. chama `gravarVenda` e depois `vinculo.gravar(id)`.

  A recusa chega como `RecusaDaAgenda` e vira `{ ok: false, erro: frase }`. Sem origem, o caminho é o
  `gravarVenda` de antes, sem mudança.

### Tarefa 2: a Venda preenchida pela Agenda (commit `40e7fea`)

- A página do Financeiro resolve `?origem=` no servidor:
  - `livre`: monta `PainelVenda` com `origem` e `rascunhoInicial`, e com `key` própria, para nunca
    herdar o estado da tela anterior;
  - `ja_lancada`: mostra `OrigemIndisponivel` com “Este item da Agenda já virou a venda nº N.” e o link
    “ver no Caixa”;
  - não achada ou mal formada: mostra “Não achei este item da Agenda…” com “Voltar à Agenda”.
- `PainelVenda` com origem:
  - começa do carrinho da origem já na renderização do servidor, sem piscar o outro;
  - o pagamento nasce à vista em aberto, com `vencimentoAvistaAberto` igual ao vencimento;
  - a pessoa fica travada (`readOnly`), com a dica “vem da Agenda”;
  - a linha de origem não tem “tirar” e o “−” fica desabilitado em 1, por `LinhaCarrinho fixa`;
  - `FaixaDaAgenda` fica no topo;
  - o rascunho comum só é lido, para saber se havia uma venda em montagem e mostrar a segunda linha da
    faixa. Ele nunca é aplicado nem regravado, e o sucesso não o apaga;
  - depois de lançar, volta para `/gestao/agenda?aba=receber&aviso=lancado&documento={id}`.
- Do lado da Agenda:
  - “Lançar na Venda” é `outline`, com 44px, ao lado de “Recebi agora”;
  - na folha do uso encerrado e a receber, ele é o primário do rodapé;
  - `AvisoDaAgenda` mostra o toast uma vez e limpa `aviso` e `documento` com `replaceState`. O número
    da venda é lido no servidor.

### Tarefa 3: o lote (commits `5a9cd3a` RED, `e855818` GREEN, `3e9e1e4`)

- `loteDeMensalidades` (puro):
  - entram só as mensalidades livres, a receber ou com venda cancelada;
  - a ordem é turma, depois nome (sem acento nem caixa), depois id;
  - devolve o total exato e a quantidade;
  - 9 testes novos, contando os rótulos.
- `lancarMensalidadesEmLote({ ids })`:
  1. `exigirUsuario()` primeiro;
  2. Zod aceita de 1 a 500 uuids;
  3. hoje, a taxa e os itens do sistema são lidos fora da transação;
  4. numa transação só, `travarMensalidades` trava em ordem de id (`orderBy(asc(id))` +
     `for no key update`);
  5. as mensalidades lançadas, pagas ou dispensadas são puladas e contadas;
  6. para cada livre: `linhasDaVenda`, `conferirParcelas`, `gravarVenda` com uma parcela
     `{ vencimento: mensalidade.vencimento, forma: "pix", pago: false }` e o `clienteId`, e depois
     `vincularVenda`.

  Qualquer recusa ou falha desfaz tudo. A ação revalida a Agenda, `/financeiro` e o Início.
- `LoteDeMensalidades`:
  - fica no topo de “A receber” e só aparece com mensalidade livre;
  - é um `<details open>` com borda tracejada `borda-forte` e `summary` de 44px;
  - a lista quebra sem rolagem interna;
  - o botão primário mostra o total, troca para “Lançando…” com `disabled`/`aria-busy` e tem um
    `useRef` contra o toque duplo;
  - o toast segue a concordância: “1 mensalidade lançada…” ou “N mensalidades lançadas…”. Na corrida,
    o toast é “{n} lançadas; {m} já estavam lançadas.”;
  - a falha aparece dentro da sanfona, com `role=alert`.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/financeiro-abas.test.ts` (RED) | 17 falharam, como esperado |
| o mesmo (GREEN) | **27/27** |
| `npm run verificar` (Tarefa 1) | **saiu 0**: 112 arquivos e 2190 testes, 112 ações, `test:migracoes` “Todas as afirmações passaram.” |
| `npx tsc --noEmit`, `npx eslint …`, `npm run verificar-acoes` (Tarefa 2) | limpos, 112 ações e 0 violações |
| **`npm run test:e2e -- --grep "agenda venda preenchida\|financeiro venda"`** (Tarefa 2) | **106 passed, 2 skipped (1.8m)**, na primeira. Os 5 casos (a)-(e) passaram em desktop e celular. Os 2 pulados são o caso de `financeiro-venda.spec.ts`, que se pula quando hoje é dia 1, um por projeto. O total inclui a cadeia `vazio-*`, que roda pelo `grep` próprio de cada projeto |
| `npx vitest run tests/unit/agenda-receber.test.ts` (RED) | 5 falharam: `loteDeMensalidades` não existia |
| o mesmo (GREEN) | **33/33** |
| **`npm run test:e2e -- --grep "agenda mensalidades lote"`** (Tarefa 3) | **45 passed (59.3s)**, na primeira. (a), (b) e (c) rodaram em `vazio-historico` |
| `npm run verificar` (Tarefa 3, final) | **saiu 0**: 112 arquivos e **2199** testes, **113 ações** e 0 violações, `test:migracoes` verde |

Foram **duas** invocações de e2e, uma por tarefa com e2e, dentro do orçamento. Não rodei `npm run build`
separado nem a varredura sem `--grep`, que fica para o plano 16.

Greps de aceite:
- `vincularCobranca` em `lib/financeiro/acoes.ts`: 3 ocorrências (o import, o comentário e a chamada na
  linha 248, antes do `gravarVenda` da 263);
- `"use server"` em `lib/agenda/gravacao.ts`: 0;
- “Da Agenda” em `faixa-da-agenda.tsx` + `textos.ts`: ≥ 1;
- `hrefDaVendaComOrigem` em `linha-a-receber.tsx` + `folha-uso-livre.tsx`: 2 imports e 2 usos;
- “Lançar esta 1 na Venda” em `textos.ts`: 2;
- `pago: false` em `lib/agenda/acoes.ts`: 1, a parcela do lote.

## Deviations from Plan

**1. [Rule 3] `LinhaCarrinho` ganhou `fixa`**
- **Arquivo:** `components/amassa/financeiro/linha-carrinho.tsx`, que não estava na lista do plano.
- **O que muda:** a linha de origem precisa ficar sem o “tirar” e sem descer abaixo de 1.
- **Venda manual:** o padrão é `false`, então ela não muda.

**2. [Rule 3] `itensDoSistemaParaVenda` saiu de `acoes.ts` e foi para `consultas.ts`**
- **Por quê:** `cobrancaParaVenda` e o lote também precisam dela, e uma exportação de um arquivo com a
  diretiva de Server Action viraria endpoint.
- **`receberAgora`:** agora importa a função de `consultas.ts`. O comportamento é o mesmo.

**3. [Rule 3] Semeadores de e2e em `tests/e2e/apoio/semear-agenda.ts`**
- `semearMensalidade` aceita `aulasRestantes`/`aulasNoMes` opcionais. Quem já chamava a função continua
  igual.
- Funções novas: `ligarVendaCanceladaAMensalidade` e `dispensarMensalidadeNoBanco`.

**4. `lerMensalidadesCobradas` sempre ordena por id**
- **Por quê:** a trava do lote precisa seguir uma ordem determinística.
- **Efeito na lista de “A receber”:** nenhum. O módulo puro reordena por vencimento.

**5. TDD: as frases do lote entraram já no commit da Tarefa 1**
- **O que aconteceu:** os rótulos foram para `textos.ts` junto com as frases da Venda da Agenda.
- **Efeito no RED da Tarefa 3:** ele falhou só nos 5 casos de `loteDeMensalidades`. Os 4 casos de
  rótulo passaram desde o início.

**6. Na Tarefa 2 não rodei o `npm run verificar` inteiro como passo separado**
- **O que rodei:** `tsc`, `eslint` e `verificar-acoes`, todos limpos. Os testes unitários dela não
  mudaram.
- **Onde o verificar inteiro rodou:** no fim da Tarefa 1 e no fim da Tarefa 3, este já com a Tarefa 2
  dentro.

Nenhum teste do Financeiro foi alterado ou afrouxado. Nenhuma migração e nenhum pacote novo: a `0026`,
`db/schema.ts` e `TABELAS_ESPERADAS` ficaram como estavam.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado além do
efêmero.

1. **Valor e quantidade da linha de origem continuam editáveis.** É o que dizem a UI-SPEC (UI-D26) e a
   verdade 2 do plano.
   - **O que o servidor decide:** pessoa, cliente e descrição, sobrescritas sob a trava.
   - **O valor:** o inicial vem do banco, e o navegador nunca manda o valor-base. Mudar o valor é um
     ajuste do gestor, como o desconto.
   - **Se a regra de dinheiro for “valor fixo”:** *desfazer* desabilitando o campo “cada” com `fixa` e
     fazendo `lancarVenda` recusar quando o valor da linha de origem difere do da cobrança.
2. **Origem dispensada, de data cancelada, de valor 0 ou mal formada → “Não achei este item da
   Agenda…”.** A UI-SPEC só tem as duas frases, e a cobrança saiu de “A receber”.
   *Desfazer:* `cobrancaParaVenda` e `vincularCobranca`.
3. **“Limpar” na Venda da Agenda volta ao carrinho da origem** e não toca no rascunho comum. Sem isso,
   “Limpar” tiraria a linha que a venda precisa ter. *Desfazer:* `limpar()` em `painel-venda.tsx`.
4. **Rodapé do uso encerrado e a receber: “Voltar à agenda” + “Recebi agora” + “Lançar na Venda”
   (primário).**
   - **O que a UI-SPEC prevê:** só os dois últimos.
   - **Por que mantive o terceiro:** o e2e do plano 09 toca `uso-voltar` num uso encerrado e a receber.
     A decisão 4 do plano 11 adiou esta escolha para cá.
   - *Desfazer:* tirar o botão de `folha-uso-livre.tsx` e ajustar `agenda-uso-livre.spec.ts:462`.
5. **Lote: a mensalidade dispensada pela corrida conta em “já estavam lançadas”.** A verdade 7 diz “pula
   e CONTA as que já viraram venda ativa ou foram dispensadas”, numa conta só.
   *Desfazer:* `lancarMensalidadesEmLote`.
6. **Corrida do lote em `toast.info`; falha dentro da sanfona (`role=alert`).**
   - **Por que a falha fica dentro:** a sanfona continua aberta e o gestor tenta de novo. A UI-SPEC não
     fixa o lugar.
   - *Desfazer:* `lote-de-mensalidades.tsx`.
7. **Pessoa travada com o rótulo “Pessoa”, e não “Pessoa (opcional)”.**
   - **O campo:** `readOnly`; um nome longo rola dentro dele, com `title` mostrando o nome inteiro. A
     UI-SPEC aceita “quebra ou rola”.
   - *Desfazer:* `ROTULO_PESSOA_DA_AGENDA` e `painel-venda.tsx`.
8. **A linha de origem não mostra a etiqueta “tabela R$”.**
   - **Por quê:** no uso livre, o valor é a soma das horas com quantidade 1, e a etiqueta acusaria uma
     diferença falsa.
   - **O material cobrado:** vira linha livre, removível como qualquer outra. O servidor só sobrescreve
     a linha de origem.
9. **A volta (“Voltar à Agenda” e o pós-lançamento) vai para `?aba=receber`.** O toast da volta não traz
   o link “ver no Caixa”, porque a UI-SPEC não traz.
10. **Frase própria para origem adulterada no esquema do Financeiro (`FRASE_ORIGEM_INVALIDA`):**
    - **Texto:** “Esse item da Agenda não é válido — volte à Agenda e toque em “Lançar na Venda” de novo.”
    - **Quando aparece:** a tela nunca manda uma origem inválida. A frase existe só para um pedido
      forjado.

## Para o dono olhar no portão (plano 16)

Os backstops do plano, para conferir a olho:
- **E16 overflow:** 40 mensalidades a 360px. A sanfona não pode rolar por dentro, e o botão do lote
  precisa ficar no fim da lista.
- **E16 long-text:** um nome de 160 caracteres numa turma de nome com 120, a 320px. A linha do lote
  precisa quebrar dentro da borda tracejada.
- **E24 loading:** uma venda em montagem e a rede lenta. O carrinho da origem precisa aparecer direto,
  sem piscar o outro. Ele vem pronto do servidor, então não deveria piscar.
- **E24 overflow:** a faixa a 320px com uma turma de nome com 120 caracteres. O texto precisa quebrar, e
  “Voltar à Agenda” precisa continuar com 44px.
- **E24 long-text:** a pessoa travada com 160 caracteres. O nome precisa rolar dentro do campo, e a dica
  “vem da Agenda” precisa continuar visível.

O E16 zero-one-many virou e2e: o caso (c) confere o singular na sanfona, no botão e no toast.

E a regra da decisão 1 acima: confirmar se a linha que vem da Agenda pode ter o valor mudado na Venda.

## Known Stubs

Nenhum. A dica do fim de “A receber” (“Os dois botões…”) agora é verdade. Não registrei nada em
`.planning/WINDOWS.md`.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-57:** `lancarMensalidadesEmLote` e `lancarVenda` começam por `exigirUsuario()`. São 113 ações e
  0 violações.
- **T-05-58:** a origem é resolvida no servidor, e pessoa, cliente e descrição são sobrescritos sob a
  trava. O e2e (d) forja o nome pelo DOM, e o banco grava o do cliente.
- **T-05-59:** a cobrança é travada e conferida na mesma transação, e o lote pula e conta. O e2e (b) do
  lote usa duas abas, e nenhuma venda duplica. O e2e (c) da Venda reabre uma origem já lançada.
- **T-05-60:** o lote só lê `mensalidades` pelos ids.
- **T-05-61:** o lote aceita até 500 ids e roda numa transação.

## TDD Gate Compliance

- **Tarefa 1:** `test(05-12)` `d261b5a` (RED) → `feat(05-12)` `5d4ce42` (GREEN).
- **Tarefa 3:** `test(05-12)` `5a9cd3a` (RED) → `feat(05-12)` `e855818` (GREEN) → `feat(05-12)` `3e9e1e4`
  (servidor e tela). Sem refatoração.

## Self-Check: PASSED

- Os arquivos novos estão presentes:
  - `components/amassa/financeiro/faixa-da-agenda.tsx`
  - `components/amassa/agenda/{lote-de-mensalidades,aviso-da-agenda}.tsx`
  - `tests/e2e/{agenda-venda-preenchida,agenda-mensalidades-lote}.spec.ts`
- Os commits `d261b5a`, `5d4ce42`, `40e7fea`, `5a9cd3a`, `e855818` e `3e9e1e4` estão no branch
  `gsd/phase-05-agenda`. Não houve push nem merge, e nenhum commit apagou arquivo:
  `git diff --diff-filter=D b19df45 HEAD` não lista nada.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados.
