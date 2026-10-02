---
phase: 05-agenda
plan: 13
subsystem: agenda
status: complete
tags: [agenda, a-receber, dispensar, pagamento, financeiro, age-06, age-15, age-20, d-02, d-08, d-09, ui-d15]
requires:
  - "05-11: situacaoDaCobranca, lerCobrancas/travarCobranca, A receber, Recebi agora, tag “venda nº N cancelada”"
  - "05-12: lote de mensalidades, Lançar na Venda, dispensarMensalidadeNoBanco/ligarVendaCanceladaAMensalidade"
  - "05-01: colunas dispensada_em/dispensada_por/motivo_dispensa em mensalidades e inscricoes (0026)"
provides:
  - "lib/agenda/receber.ts: podeDispensar, ordenarDispensadas, quantasDispensadasDaUrl, DISPENSADAS_POR_VEZ"
  - "lib/agenda/esquemas.ts: esquemaDefinirDispensa (motivo até 200)"
  - "lib/agenda/gravacao.ts: gravarDispensa; lerCobrancas com tipos/clienteIds/eventoIds/turmaId+mes/usoIds"
  - "lib/agenda/acoes.ts: definirDispensa (114 ações no portão)"
  - "lib/agenda/consultas.ts: lerDispensadas, situacoesDasInscricoes, situacaoDaMensalidadeDoMes, aReceberPorEvento, situacoesDosUsos, cobrancasDaPessoa, aReceberPorCliente, SituacaoDePagamento; VindaDaPessoa com uso livre"
  - "components: ConfirmarDispensar (+ avisarDispensada), Dispensadas, TagDePagamento (em cartao-evento.tsx)"
  - "data-testid: dispensar, confirmar-dispensar(-sim/-nao/-erro), motivo-dispensa(-erro), dispensadas, dispensadas-resumo, dispensadas-mais, dispensada-linha, dispensada-titulo, dispensada-sub, desfazer-dispensa(-erro), tag-pagamento (data-situacao), tag-dispensada, tag-venda-cancelada, tag-a-receber, quadro-a-receber(-valor), ficha-vinda[data-tipo]"
affects:
  - "“A receber” ganha “Dispensar a cobrança” na mensalidade e na inscrição e a sanfona “Dispensadas”"
  - "Lista da data, cartão da semana, folha do uso livre, ficha e Pessoas mostram o pagamento derivado do Financeiro"
  - "A aba Pessoas escreve a mensalidade do mês antes de contar (D-02)"
tech-stack:
  added: []
  patterns:
    - "Dispensa = estado desejado sob a MESMA trava da cobrança do Recebi agora/Lançar na Venda/lote; só update, nunca delete"
    - "Toda tag de pagamento passa por lerCobrancas + situacaoDaCobranca/itensAReceber — nenhuma coluna de pagamento na Agenda"
    - "Prova do AGE-20 sem afirmar estado global: retrato linha a linha das vendas do caso + “nenhum id pré-existente sumiu”"
key-files:
  created:
    - components/amassa/agenda/confirmar-dispensar.tsx
    - components/amassa/agenda/dispensadas.tsx
    - tests/e2e/agenda-dispensar.spec.ts
    - tests/e2e/agenda-pagamento.spec.ts
    - tests/e2e/agenda-venda-cancelada.spec.ts
  modified:
    - lib/agenda/receber.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - components/amassa/agenda/a-receber.tsx
    - components/amassa/agenda/linha-a-receber.tsx
    - components/amassa/agenda/linha-inscrito.tsx
    - components/amassa/agenda/cartao-evento.tsx
    - components/amassa/agenda/folha-uso-livre.tsx
    - components/amassa/agenda/ficha-pessoa.tsx
    - components/amassa/agenda/lista-pessoas.tsx
    - tests/unit/agenda-receber.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "“Mostrar mais 20” por ?dispensadas= (o padrão de Pessoas); a sanfona vem aberta quando a pessoa pediu mais"
  - "O “{n} a receber” do cartão conta o que está em “A receber” — inclusive a de venda cancelada (D-08) e a experimental cobrada numa data de turma"
  - "Na folha do uso encerrado, a tag de pagamento vem depois do texto “Encerrado · …”, na mesma linha"
  - "Últimas vindas: inscrições e usos livres encerrados juntos, por data e hora, até 8"
metrics:
  duration: "~31 min (22:46 → 23:17, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 21
actuals:
  tokens: 33000
  tasks: 3
  commits: 4
---

# Phase 5 Plan 13: dispensar sem apagar, o pagamento em toda tela e a venda cancelada que volta sozinha — Summary

**O gestor dispensa a mensalidade ou a inscrição que não vai cobrar — com motivo opcional, quem e quando —, e
desfaz pelo toast ou pela sanfona “Dispensadas”; nada é apagado. A situação do pagamento (“a receber”,
“lançado na Venda”, “pago”, “venda nº N cancelada”, “dispensada”) aparece na lista da data, no cartão da
semana, na folha do uso livre, na ficha (quadro “A RECEBER”) e em Pessoas (“{n} a receber”), sempre derivada do
Financeiro. Cancelada no Caixa de verdade, a cobrança volta para “A receber” e se lança de novo; e nenhum gesto
da Agenda apaga ou muda venda, parcela ou movimentação — medido no banco.**

## O que foi feito

### Tarefa 1 — dispensar, com “Dispensadas” e desfazer (D-09) — `d59ffc4`

- **Puro** (`receber.ts`): `podeDispensar` (só mensalidade e inscrição, a receber ou de venda cancelada),
  `ordenarDispensadas` (mais recentes primeiro, desempate por id), `quantasDispensadasDaUrl` (múltiplos de 20,
  teto 500). 11 testes novos, incluindo “a dispensada sai da lista, do total e do lote”.
- **Servidor**: `esquemaDefinirDispensa` (tipo `mensalidade|inscricao`, id, `dispensada`, motivo aparado,
  vazio → nulo, até 200 com “O motivo pode ter até 200 caracteres.”). `definirDispensa`: `exigirUsuario()`
  primeiro; `travarCobranca` (a mesma trava do Recebi agora, do Lançar na Venda e do lote); estado desejado (já
  no estado → sucesso sem gravar); venda ativa → “Este item já foi lançado (venda nº N). A tela foi
  atualizada.”; data cancelada → a frase existente; grava ou limpa os três campos com `gravarDispensa` (só
  `update`). `lerDispensadas({ quantas })` com o nome de quem dispensou e o total.
- **Tela**: “Dispensar a cobrança” (link-botão 44px, `tinta-media`, à esquerda da fileira de ações, só quando
  `podeDispensar`); `ConfirmarDispensar` com o campo “Motivo (opcional)” e o placeholder da UI-SPEC, o erro
  embaixo do campo (Zod no cliente e no servidor), “Dispensando…”, a falha dentro da confirmação; toast
  “Dispensada. Ela não vai virar venda.” com “Desfazer” (decisão E29: só o primeiro toque age; falha → “Não deu
  para desfazer. A cobrança continua dispensada — use “Desfazer” em “Dispensadas”.”). `Dispensadas` no fim de “A
  receber”: `<details>` fechado, só com N > 0, linha “{nome} · {descrição}” + “dispensada por {quem} em {dd/mm}”
  + “ · {motivo}”, “Desfazer” `outline` com o `aria-label` da UI-SPEC, “Mostrar mais 20”.

### Tarefa 2 — o pagamento onde o gestor olha (D-02, D-08, D-09) — `63068d5`

- `lerCobrancas` ganhou recortes só de leitura (`tipos`, `clienteIds`, `eventoIds`, `turmaId`+`mes`,
  `usoIds`). Em cima dele, todas pela mesma derivação: `situacoesDasInscricoes`, `situacaoDaMensalidadeDoMes`,
  `aReceberPorEvento`, `situacoesDosUsos`, `cobrancasDaPessoa` (= `totalAReceber(itensAReceber(...))` da
  pessoa) e `aReceberPorCliente`.
- `TagDePagamento` (cores da UI-SPEC: “a receber” erro, “pago” sucesso, “lançado na Venda”/“dispensada”
  neutras, “venda nº N cancelada” atenção) em `LinhaInscrito` (aluno → mensalidade do mês da data; oficina e
  experimental cobrada → a inscrição; gratuita e reposição → nenhuma), no cartão do uso encerrado e na folha
  dele; “{n} a receber” no cartão da data e na linha de Pessoas; quadro “A RECEBER” na ficha (Display,
  `tabular-nums`, “R$ 0,00” quando nada).
- Pessoas chama `garantirMensalidadesDoMes` antes de listar e contar, com o comentário da D-02.
- **Lacuna do 05-09 (pedido do orquestrador):** “Últimas vindas” da ficha traz os usos livres encerrados
  (“{dd/mm} · Uso livre {h} h” + tag de pagamento) junto com as inscrições, mais recentes primeiro, até 8.

### Tarefa 3 — venda cancelada no Caixa e AGE-20 — `89940cc`

- A frase do fim de “A receber” e a tag já estavam certas (grep abaixo); nada mudou em `textos.ts` nem em
  `a-receber.tsx` nesta tarefa.
- `agenda-venda-cancelada.spec.ts`: (a)(b) venda ativa sem “tirar da lista”, a recusa verbatim da D-08 na tela
  velha, “Cancelar esta venda” no Caixa, a volta com a tag, “dispensar” disponível, e um novo “Recebi agora” com
  número novo; (c) a mensalidade de venda cancelada entra no lote e a dispensada não (backstop E16 partial,
  sem tocar o lote); (d) AGE-20 com cancelar data → desfazer → cancelar de novo → cancelar outra vez pela tela
  velha (sem efeito) → desfazer → tirar da lista a de venda cancelada → desativar a turma (apaga a data e a
  inscrição da experimental de venda cancelada) → dispensar e desfazer.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-receber.test.ts` | 33/33 antes de escrever os testes novos; **44/44** depois |
| `npm run verificar` (Tarefa 1) | **saiu 0**: 112 arquivos / **2210** testes, **114 ações** e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| **`npm run test:e2e -- --grep "agenda dispensar"`** (Tarefa 1) | **67 passed (1.1m)**, na primeira — (a)-(e) em desktop e celular + a cadeia `vazio-*` |
| `npm run verificar` (Tarefa 2) | **saiu 0**, mesmos números |
| **`npm run test:e2e -- --grep "agenda pagamento"`** (Tarefa 2) | **67 passed (1.2m)**, na primeira — (a)-(e) nos dois projetos |
| **`npm run test:e2e -- --grep "agenda venda cancelada"`** (Tarefa 3, 1ª) | **61 passed, 2 failed** — o caso (d) nos dois projetos: o véu da folha (modal) cobria o “Desfazer” do toast. Defeito do TESTE, não do produto |
| **`npm run test:e2e -- --grep "agenda venda cancelada"`** (Tarefa 3, 2ª) | **63 passed (1.0m)** — o teste fecha a folha com “Pronto” antes de tocar no toast, como `agenda-cancelamento.spec.ts:95` |
| `npm run verificar` (final) | **saiu 0**: 2210 testes, 114 ações, `test:migracoes` verde |

**Quatro** invocações de e2e (uma a mais que o orçamento, na Tarefa 3, para confirmar a correção do teste).
Nenhum `npm run build` separado; a varredura sem `--grep` fica para o plano 16.

Greps de aceite:
- `delete((mensalidades|inscricoes))` em `lib/agenda/acoes.ts`: só a linha **809** (`tirarDaLista`); nenhum
  dentro de `definirDispensa` (linha 1977 em diante). Os `delete` de sair da turma/desativar ficam em
  `gravacao.ts` (453-454), como antes.
- “O motivo pode ter até 200 caracteres”: `textos.ts` 1 + `esquemas.ts` 0 (o esquema importa a constante) = 1.
- `garantirMensalidadesDoMes` em `page.tsx`: **8** (contador, “A receber”, ficha, Pessoas + import e
  comentários).
- `situacaoDaCobranca` em `lib/agenda/consultas.ts`: **6**.
- “Devolução e cancelamento se resolvem no Caixa” em `textos.ts`: **1**.
- `git diff main -- lib/financeiro/acoes.ts`: os 12 trechos alterados estão todos entre as linhas 12 e 281
  (imports e `lancarVenda`, dos planos 11-12); `cancelarDocumento` começa na **592** e nenhum `+`/`-` cai nele —
  o cancelamento do Caixa não foi tocado nesta fase.

## Deviations from Plan

1. **[Conformidade com o protótipo — lacuna do 05-09]** “Últimas vindas” agora lista os usos livres
   encerrados (`prototipo.html` `folhaPessoa`: `e.tipo==='livre' && e.estado==='encerrado'`) com a tag de
   pagamento, junto com as inscrições, até 8. `VindaDaPessoa` virou união (`tipo: "inscricao" | "uso_livre"`,
   chave `id`). Asserção no e2e `agenda pagamento` (d). Feito na Tarefa 2, que já mexia em `ficha-pessoa.tsx`.
2. **[Rule 3] Arquivos fora da lista do plano**: `lib/agenda/gravacao.ts` (`gravarDispensa` e os recortes de
   `lerCobrancas`) e `tests/e2e/apoio/semear-agenda.ts` (`nomeDoGestorDeTeste`, `dispensaNoBanco`,
   `ligarVendaACobranca`, `retratoDoDinheiro`, `idsDoDinheiro`, `idsQueSumiram`).
3. **`lib/clientes/lista.ts` não mudou** (estava na lista): a frase “{n} a receber” é da Agenda e foi para
   `textos.ts`; `subLinhaDaPessoa` continua igual, como o plano pede.
4. **O cartão conta o que está em “A receber”, não só o “sem venda”.** O caso (a) do plano espera “1 a receber”
   numa oficina que tem também uma inscrição de venda cancelada; pela D-08 essa volta a “A receber”, então o
   cartão diz **“2 a receber”** — o mesmo número da lista. O e2e afirma 2.
5. **AGE-20 sem contagem global.** “Contar `documentos`, `parcelas`, `movimentacoes_estoque` antes e depois”
   disputaria com as outras specs em paralelo (regra do CLAUDE.md). O e2e (d) compara o retrato linha a linha
   das três vendas do caso, das parcelas e das movimentações ligadas a elas (igual antes e depois), e confere
   que **nenhum id** que existia nas três tabelas sumiu. As vendas da Agenda não geram movimentação (itens do
   sistema sem estoque), então o retrato das movimentações é vazio — a prova delas é a dos ids globais.
6. **`TagDePagamento` mora em `cartao-evento.tsx`** (junto de `TagDoUsoLivre`), sem arquivo novo.
7. **Prettier** rodou em `linha-a-receber.tsx`, `confirmar-dispensar.tsx`, `dispensadas.tsx` e
   `agenda-dispensar.spec.ts`; em `linha-a-receber.tsx` ele também reformatou linhas que eu não mudei.

Nenhuma migração, nenhum pacote novo; `0026`, `db/schema.ts` e `TABELAS_ESPERADAS` intocados. Nenhum teste do
Financeiro mudou.

## Decidido sem o Theo

Nada saiu da máquina: branch `gsd/phase-05-agenda`, sem push, nenhum banco além do efêmero.

1. **“Mostrar mais 20” por `?dispensadas=`** (o padrão de “Mostrar mais 50” de Pessoas); a sanfona vem aberta
   quando a pessoa pediu mais. *Desfazer:* estado local em `dispensadas.tsx` e tirar o parâmetro de `page.tsx`.
2. **“Dispensadas” não lista a inscrição de data cancelada** — desfazer não a traria de volta a “A receber”.
   *Desfazer:* tirar `isNull(eventos.canceladoEm)` em `lerDispensadas`.
3. **O “{n} a receber” do cartão** conta a de venda cancelada (D-08) e aparece também na data de turma, pela
   experimental cobrada. A mensalidade é do aluno, não da data: não entra. *Desfazer:* `aReceberPorEvento`.
4. **Aluno na data de turma:** a tag é a da mensalidade do **mês da data**; sem mensalidade nascida nesse mês,
   nenhuma tag. *Desfazer:* `obterEvento`.
5. **Data cancelada:** a inscrição “a receber”/“venda cancelada” perde a tag (saiu de “A receber”); “pago” e
   “lançado na Venda” continuam. *Desfazer:* `saiDeAReceberAoCancelar`.
6. **Folha do uso encerrado:** a tag vem depois de “Encerrado · {h} h · estoque baixado (…)”, na mesma linha que
   quebra, e não no meio do texto como a UI-SPEC escreve — assim o texto continua inteiro num elemento e os e2e
   dos planos 09-10 valem. *Desfazer:* `folha-uso-livre.tsx`.
7. **`aria-label` do link:** “Dispensar a cobrança de {descrição} de {nome}” (várias linhas têm o mesmo texto).
8. **Campo do motivo sem `maxLength`:** com 201 caracteres a frase aparece e nada é gravado, em vez de cortar em
   silêncio.
9. **Falha do “Desfazer” da sanfona:** “Não deu para desfazer. Verifique a internet e tente de novo.” embaixo
   da linha. A recusa com venda ativa (corrida) fica dentro da confirmação; ao fechar, a tela pede a lista de
   novo.
10. **Últimas vindas:** inscrições e usos juntos por data e depois hora (começo da aula, chegada do uso).
11. **A dispensa revalida também o Início.**

## Para o dono olhar no portão (plano 16)

Os backstops do plano, a olho:
- **E4 overflow:** cartão de oficina com “cancelada”, “dia fechado”, “marcar presença”, “3 a receber”, “no
  site” a 320px — as tags quebram na sub-linha e “12 / 12” fica na coluna da direita.
- **E6 long-text:** nome de 160 caracteres com “reposição” e “venda nº 123 cancelada” a 320px — o nome quebra
  e “Veio · Faltou” continua inteiro.
- **E12 zero-one-many:** 50 e 51 pessoas — “Mostrar mais 50” só acima de 50; “1 a repor” / “2 a receber”.
- **E13 overflow:** ficha com R$ 1.234,56 a receber e 12 aulas a repor a 320px — o número cabe no quadro.
- **E17 long-text:** motivo de 200 caracteres na sanfona a 320px — a sub-linha quebra e “Desfazer” fica
  inteiro (o 201 → frase embaixo do campo virou e2e, `agenda dispensar` (c)).
- **E28 overflow:** as confirmações a 320px — os dois botões empilham ou cabem com 44px.

## Known Stubs

Nenhum. Nada registrado em `.planning/WINDOWS.md`.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-62:** `definirDispensa` começa por `exigirUsuario()` (114 ações, 0 violações).
- **T-05-63:** trava da cobrança + recusa com venda ativa; o e2e (a)(b) da venda cancelada e o caso (d) da
  dispensa (só com venda cancelada) passam.
- **T-05-64:** `dispensada_por` sempre gravado (check da 0026), nunca `delete`, desfazível — e2e (a)/(b).
- **T-05-65:** Zod até 200 nos dois lados; o motivo é texto do React.

## Self-Check: PASSED

- Arquivos novos presentes: `components/amassa/agenda/{confirmar-dispensar,dispensadas}.tsx`,
  `tests/e2e/{agenda-dispensar,agenda-pagamento,agenda-venda-cancelada}.spec.ts`.
- Commits `d59ffc4`, `63068d5`, `89940cc` no branch `gsd/phase-05-agenda`; sem push nem merge;
  `git diff --diff-filter=D ed21775 HEAD` não lista nada.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados.
