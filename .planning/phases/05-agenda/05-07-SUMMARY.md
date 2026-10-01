---
phase: 05-agenda
plan: 07
subsystem: agenda
status: complete
tags: [agenda, mensalidade, d-02, age-07, age-16, age-20, pitfall-6, ficha-da-pessoa, turma-fixa]
requires:
  - "05-01: mensalidades (chave mensalidades_turma_cliente_mes_uk, checks de faixa e do proporcional), turma_alunos (turma_alunos_ativo_uk), RecusaDaAgenda, a ordem global de travas"
  - "05-04: o cadastro de pessoas, a ficha (?pessoa=) e a sub-linha subLinhaDaPessoa"
  - "05-06: travarTurma, inscreverAlunosNasDatas, editarTurma, FolhaTurma, semearAluno"
provides:
  - "lib/agenda/mensalidade.ts (puro): valorProporcional, valorDaAula (D-07, usado pelo plano 08), vencimentoDaMensalidade, arredondarMeioParaCima, mesDaData"
  - "lib/agenda/gravacao.ts: garantirMensalidadesDoMes (D-02 — o plano 11 a chama em “A receber”, o 14 no Início), travarCliente, inscreverAlunoDaquiParaFrente, tirarAlunoDasDatasFuturas; TurmaTravada ganha diaVencimento"
  - "lib/agenda/consultas.ts: datasDaTurmaNoMes, turmasDaPessoa (TurmaDaPessoa), turmasPorCliente"
  - "lib/agenda/acoes.ts: entrarNaTurma, sairDaTurma (102 ações no portão); editarTurma com a guarda do Pitfall 6"
  - "lib/agenda/turma.ts: NOMES_CURTOS_DOS_DIAS"
  - "TurmasDaPessoa, ConfirmarSairDaTurma; a ficha com “Turmas fixas”; a aba Pessoas abre a folha da turma por ?turma="
  - "tests/e2e/apoio/semear-agenda.ts: semearMensalidade, mensalidadesNoBanco, inscricoesDaPessoaNaTurma, vinculosNoBanco"
  - "data-testid: turmas-da-pessoa, turma-da-pessoa (data-turma-id), turma-da-pessoa-caixa, turma-da-pessoa-gravando, ver-turma, ficha-sem-turmas, confirmar-sair (-corpo, -sim, -nao, -erro)"
affects:
  - "Abrir a ficha da pessoa ESCREVE: a mensalidade do mês de todo aluno que já estava numa turma ativa no dia 1 nasce ali (D-02, idempotente)"
  - "Salvar a turma ESCREVE a mensalidade do mês dos alunos dela antes de gravar o valor novo"
  - "ListaPessoas recebe turmasPorPessoa, turmaAberta e hoje; FichaPessoa recebe aoAbrirTurma; ConteudoDaFicha ganha turmas e mes"
tech-stack:
  added: []
  patterns:
    - "Escrita idempotente no carregamento da página (insert … select … on conflict do nothing), sem revalidar rota no render"
    - "Dinheiro do proporcional em aritmética inteira: floor((2n + d) / 2d)"
    - "Caixa que grava na hora com estado local “confirmado pelo servidor” até a leitura nova chegar (não pisca)"
key-files:
  created:
    - lib/agenda/mensalidade.ts
    - components/amassa/agenda/turmas-da-pessoa.tsx
    - components/amassa/agenda/confirmar-sair-da-turma.tsx
    - tests/unit/agenda-mensalidade.test.ts
    - tests/e2e/agenda-entrar-na-turma.spec.ts
  modified:
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - lib/agenda/turma.ts
    - lib/clientes/lista.ts
    - app/gestao/(app)/agenda/page.tsx
    - components/amassa/agenda/ficha-pessoa.tsx
    - components/amassa/agenda/lista-pessoas.tsx
    - tests/unit/clientes-lista.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "D-02 conta como “vínculo ativo no dia 1” quem entrou ANTES do dia 1 (entrou_em < dia 1), não “<=” como no texto do plano — quem entra no próprio dia 1 tem a mensalidade decidida pela ação de entrar"
  - "Sair da turma não apaga a inscrição de aluno futura que já tem presença marcada (falta avisada)"
  - "Proporcional que arredondaria a 0 centavo não vira mensalidade"
  - "Um quarto toast de entrada: a mensalidade do mês já existia (voltou no mesmo mês)"
metrics:
  duration: "~20 min (19:40 → 20:00, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 17
actuals:
  tokens: 20650
  tasks: 3
  commits: 4
---

# Phase 5 Plan 07: entrar e sair da turma pela ficha, e a mensalidade do mês nascendo ao abrir a tela — Summary

**Na ficha da pessoa, o gestor marca a caixa de uma turma. A pessoa entra nas aulas de hoje em diante,
e a mensalidade do mês nasce na mesma transação: proporcional se entrou no meio do mês, em centavos
inteiros, e nenhuma se não sobra aula no mês. Desmarcar pede confirmação e tira a pessoa só das aulas
de aluno que ainda não aconteceram. Abrir a ficha faz nascer a mensalidade do mês de quem já era
aluno, uma só por pessoa e mês. Mudar o preço da turma no meio do mês não mexe na mensalidade que já
nasceu.**

## O que foi feito

### Tarefa 1: a conta no módulo puro (commits `04395f0` RED, `16b17e5` GREEN)

`lib/agenda/mensalidade.ts` só importa `TETO_CENTAVOS`, de `lib/financeiro/dinheiro.ts`, que também é
puro. Não lê relógio nem usa `toFixed`/`parseFloat`. O teste de pureza confere isso lendo o arquivo.

- `arredondarMeioParaCima(n, d)` calcula `floor((2n + d) / 2d)` só com inteiros. Recusa d ≤ 0,
  negativo e não inteiro.
- `valorProporcional({ valorCentavos, datasDoMes, entrouEm })` devolve um de três casos:
  - `cheia`: todas as datas do mês são ≥ a entrada;
  - `proporcional`: 32000 com 3 de 4 dá 24000; 10000 com 1 de 3 dá 3333 e com 2 de 3 dá 6667;
  - `nenhuma`: sem data no mês (sem dividir por zero), sem data restante, ou proporcional que
    arredondaria a 0.

  Datas repetidas contam uma vez. Valor fora de 1..`TETO_CENTAVOS`, não inteiro ou `NaN` lança
  `RangeError`, e data fora do formato AAAA-MM-DD também.
- `valorDaAula(32000, 4)` dá 8000, `(10000, 3)` dá 3333 e `(32000, 0)` dá `null`.
- `vencimentoDaMensalidade(28, "2027-02")` dá `"2027-02-28"`. Dia 0, 29 ou fracionário lança
  `RangeError`, e mês mal escrito também.
- São 20 testes.

### Tarefa 2: entrar e sair pela ficha (commit `17cda66`)

**`entrarNaTurma`.** Começa por `exigirUsuario()`, e o Zod aceita só os dois ids. Numa transação:
1. Trava a TURMA, a mesma trava de “Marcar mais semanas” (Pitfall 5). Recusa turma inexistente ou
   desativada.
2. Trava o CLIENTE com `travarCliente`, que usa `for no key update`.
3. Grava o vínculo com `entrou_em = hoje`. O índice parcial não deixa nascer um segundo vínculo
   ativo; se nada for inserido, a frase é “{nome} já está nesta turma — a tela foi atualizada.”.
4. Inscreve a pessoa como `aluno` nas datas ≥ hoje que não foram canceladas, com
   `on conflict (evento_id, cliente_id) do nothing` (Assumption A13).
5. Lê as datas não canceladas do mês (`datasDaTurmaNoMes`) e decide com `valorProporcional`. Se
   houver mensalidade, grava com `on conflict (turma_id, cliente_id, mes) do nothing`.
   `aulas_restantes` e `aulas_no_mes` só vão no proporcional. O vencimento vem de
   `vencimentoDaMensalidade`.

A ação devolve o caso para o toast e revalida com o `publico` da turma.

**`sairDaTurma`.** Começa por `exigirUsuario()` e trava TURMA → CLIENTE. Grava `saiu_em = hoje`; o
vínculo nunca se apaga. Depois, `tirarAlunoDasDatasFuturas` apaga só as inscrições `i.tipo = 'aluno'`
com `presenca is null` nas datas `> hoje`. Sem vínculo ativo, a frase é “{nome} já não está nesta
turma — a tela foi atualizada.”.

**Tela.**
- “Turmas fixas” na ficha tem uma caixa de 44px por turma ativa do sistema, com o rótulo “{nome} ·
  {dia} {hh:mm} · {R$}/mês, vence dia {d}”.
- Marcar grava na hora, mostra “Entrando…” na linha e depois o toast do caso.
- Desmarcar abre `ConfirmarSairDaTurma`. O título quebra livre, o erro aparece dentro do diálogo e
  “Manter na turma” deixa a caixa marcada.
- “ver turma” troca a ficha pela folha da turma (`?turma=` na aba Pessoas), e fechar a folha volta à
  ficha.
- Sem turma ativa, a ficha diz “Nenhuma turma fixa lançada ainda.”.
- A sub-linha da lista de Pessoas mostra as turmas (`turmasPorCliente`, com o dia abreviado).
- A folha da turma já listava os alunos ativos desde o plano 06, e não mudou.

### Tarefa 3: D-02 e Pitfall 6 (commit `3850449`)

- `garantirMensalidadesDoMes(executor, mes, turmaId?)` fica em `gravacao.ts`, sem a diretiva. É uma
  instrução `insert … select … from turma_alunos join turmas … on conflict (turma_id, cliente_id,
  mes) do nothing`, com `make_date(…, t.dia_vencimento)`. O comentário explica por que a escrita no
  carregamento é aceita, e a função não revalida rota.
- Ela é chamada em dois lugares:
  1. Em `lerFicha` da página, depois de achar a pessoa e ANTES de ler as turmas dela, com o mês de
     `hojeEmBrasilia`.
  2. Em `editarTurma`, dentro da transação, depois da trava e ANTES do `update` do valor, só para a
     turma editada.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-mensalidade.test.ts` (RED) | falhou como esperado: o módulo não existia |
| o mesmo depois de implementar | **20/20** |
| `npx vitest run tests/unit/clientes-lista.test.ts tests/unit/agenda-turma.test.ts tests/unit/agenda-abas.test.ts` | **76/76** |
| `npm run verificar` (Tarefa 2) | **verde**: 108 arquivos / 2070 testes, `verificar-acoes` **102 ações** e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "agenda entrar na turma"` (Tarefa 2) | **62 passed (1.1m)** na primeira: (a)-(e) × desktop e celular, mais a cadeia `vazio-*` |
| `npm run verificar` (Tarefa 3) | **verde**: 108 / 2070, 102 ações, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda entrar na turma"` (Tarefa 3) | **66 passed (57.6s)** na primeira: (a)-(g) × desktop e celular, mais a cadeia `vazio-*` |

Fiz **duas** invocações de e2e, uma por tarefa, como o orçamento pedia. A Tarefa 1 é unitária. Não
rodei `npm run build` separado nem a varredura sem `--grep`, que fica para o plano 16. Também rodei
`npx tsc --noEmit` (depois de apagar `.next/types`), `npx eslint` nos arquivos tocados e
`npm run verificar-acoes`, todos verdes. O log do e2e repete `destination stream closed early` e alguns
`[WebServer] … digest`, que já aparecem durante os testes `vazio-*`, antes dos deste plano. Nenhum
teste falhou.

**Hoje é dia 1º.** Por isso o caso (a) rodou pelo ramo “cheia”: as quatro datas do mês são de hoje em
diante. O teste escolhe as datas a partir do dia de Brasília e calcula o esperado com o próprio
`valorProporcional`. A partir de amanhã ele passa pelo ramo proporcional (“3 de 4”, ou “2 de 4” e
“1 de 4” nos dois últimos dias do mês). O arredondamento do proporcional está provado no unitário.

**Não rodei de novo** `agenda pessoas` nem `agenda turma`, que também abrem a ficha e salvam a turma.
Li os pontos de contato:
- A sub-linha “sem turma fixa” continua igual para quem não tem turma.
- A ficha só ganhou uma seção acima de “Últimas vindas”.
- `editarTurma` agora escreve mensalidades, mas nenhum caso de `agenda turma` lê mensalidades.

A varredura do plano 16 é a prova.

Greps de aceite:
- `valorProporcional` em `acoes.ts`: 3.
- `tipo = 'aluno'` em `gravacao.ts`: 2.
- `delete(turmaAlunos)` ou `delete from turma_alunos` em `lib/agenda`: nada.
- `on conflict (turma_id, cliente_id, mes) do nothing` em `gravacao.ts`: 1.
- `"use server"` em `gravacao.ts`: 0. `revalidatePath` em `gravacao.ts`: nada.
- `garantirMensalidadesDoMes`: 3 em `acoes.ts` e 3 em `page.tsx`.
- Nada de `@/db`, `react`, `next`, `drizzle-orm` ou `pg` em `mensalidade.ts`, e 0 `toFixed`/`parseFloat`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: Bug] A D-02 conta “entrou antes do dia 1” (`entrou_em < dia 1`), não “até o dia 1” (`<=`)**
- **Found during:** Tarefa 3.
- **Issue:** a verdade 4 do plano (e o SQL da pesquisa) escreve `entrou_em <= dia 1`. Com isso, quem
  entra NO dia 1 numa turma sem nenhuma aula no mês teria três coisas ao mesmo tempo:
  - a ação de entrar decide “nenhuma” (verdade AGE-07 · empty);
  - o toast diz “a mensalidade começa em {próximo mês}”;
  - na releitura da mesma tela, `garantirMensalidadesDoMes` criaria a mensalidade cheia do mês.

  As duas verdades se contradizem, e o toast mentiria. Hoje é dia 1º, e o caso (b) do e2e cairia
  exatamente aí.
- **Fix:** `a.entrou_em < dia 1`. Quem entra durante o mês, inclusive no dia 1, tem a mensalidade do
  mês decidida pela ação de entrar, como a própria verdade 4 diz (“Quem entrou DURANTE o mês não é
  tocado por ela”). Quem já era aluno antes do dia 1 continua recebendo a do mês ao abrir a tela.
  Nenhum outro caso muda, porque todo vínculo nasce pela ação de entrar.
- **Commit:** `3850449`. Está repetido em “Decidido sem o Theo” (item 1), por ser regra de dinheiro.

**2. [Rule 2: proibição do plano] Sair não apaga a inscrição de aluno futura que já tem presença**
- **Issue:** a verdade 3 diz “apaga as inscrições `tipo = 'aluno'` com `data > hoje`”. Mas uma falta
  avisada antes, ou seja, “faltou” marcado numa data futura, carrega o direito a repor. Apagá-la
  apagaria um crédito de reposição, e a proibição do plano diz que sair “nunca apaga presença, falta,
  reposição”.
- **Fix:** o `delete` também exige `i.presenca is null`. A contagem “Sai das {n} aulas” usa o mesmo
  critério e ignora datas canceladas.
- **Commit:** `17cda66`.

**3. [Rule 3] Arquivo fora da lista:** `lib/agenda/turma.ts` ganhou `NOMES_CURTOS_DOS_DIAS` para o “dia
abreviado” da sub-linha. Os nomes dos dias já moram lá.

**4. Na lista mas sem mudança:** `components/amassa/agenda/folha-turma.tsx`. “Alunos ({n})” já lista
os alunos ativos desde o plano 06.

**5. Nomes de artefato:** `inscreverAlunoDaquiParaFrente` e `tirarAlunoDasDatasFuturas` são funções
novas de `gravacao.ts` que o plano descrevia dentro das ações. `datasDaTurmaNoMes` recebe o leitor
porque roda dentro da transação, sob a trava. `mesDaData` é um ajudante a mais do módulo puro.

Nenhuma migração e nenhum pacote novo. A `0026` não mudou: a tabela `mensalidades`, a chave única e
os checks já existiam desde o plano 01.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado fora do
efêmero.

1. **Regra de dinheiro: quem entra no dia 1 não recebe a mensalidade “ao abrir a tela”, recebe a da
   entrada** (Deviation 1). Ela é cheia se há aula no mês e nenhuma se não há. Na prática, a única
   diferença para a letra do plano é que entrar no dia 1 numa turma sem aula no mês NÃO gera a
   mensalidade cheia daquele mês. *Desfazer:* trocar `a.entrou_em <` por `a.entrou_em <=` em
   `garantirMensalidadesDoMes` (`gravacao.ts`). O e2e (b) passa a falhar quando rodar num dia 1.
2. **Proporcional que arredondaria a 0 centavo não nasce.** Isso só acontece com mensalidade de 1 ou
   2 centavos. O check `mensalidades_valor_faixa` recusaria a linha de qualquer jeito. *Desfazer:*
   `valorProporcional` em `mensalidade.ts`.
3. **O terceiro toast** é decisão deste plano: “Entrou na turma: já está nas próximas aulas. Não sobra
   aula da turma em {mês} — a mensalidade começa em {próximo mês}.”.
4. **Há um quarto toast**, para quando a mensalidade do mês já existia, porque a pessoa saiu e voltou
   no mesmo mês: “Entrou na turma: já está nas próximas aulas. A mensalidade de {mês} já existia e
   continua como estava.”. Sem ele, o toast diria “foi criada” de algo que não foi criado. *Desfazer:*
   `toastEntrouMensalidadeJaExistia` em `textos.ts` e o caso `ja-existia` em `entrarNaTurma`.
5. **O corpo da confirmação de sair segue a quantidade de aulas e a mensalidade:**
   - 1 aula: “Sai da aula daqui para frente.”;
   - 0 aulas: “Não está em nenhuma aula daqui para frente.”;
   - a parte “a mensalidade de {mês} continua em “A receber” — dispense lá…” só aparece quando essa
     mensalidade existe, não foi dispensada e não virou venda ativa.

   Sem a mensalidade, o corpo termina em “O que já aconteceu fica.”. *Desfazer:*
   `corpoConfirmarSairDaTurma`.
6. **“ver turma” na aba Pessoas** abre a folha da turma no lugar da ficha, por `?turma=` mantendo o
   `?pessoa=`. Tanto “Voltar” quanto o X da folha devolvem à ficha. Não há o link “Voltar à data”,
   porque ela não veio de uma data. *Desfazer:* `voltarAFicha` em `lista-pessoas.tsx`.
7. **Ordem das turmas** na ficha e na sub-linha: segunda → domingo, depois o horário, depois o nome.
   Os dias abreviados são “dom, seg, ter, qua, qui, sex, sáb”. *Desfazer:* `compararTurmas` em
   `consultas.ts` e `NOMES_CURTOS_DOS_DIAS` em `turma.ts`.
8. **Entrar recusa turma desativada** (“Esta turma já foi desativada — a tela foi atualizada.”).
   **Sair de turma desativada é permitido**, porque não tira nada que não devesse. A ficha só mostra
   turmas ativas.
9. **`editarTurma` garante a mensalidade do mês em todo “Salvar turma”**, não só quando o valor muda.
   É a mesma escrita idempotente de abrir a tela.
10. **Frases que a UI-SPEC não fixa:**
    - “Não deu para colocar na turma. Verifique a internet e tente de novo.”;
    - “Não deu para tirar da turma. Verifique a internet e tente de novo.”;
    - “Entrando…” e “Tirando…”;
    - o `aria-label` “Ver a turma {nome}”.

    *Desfazer:* `lib/agenda/textos.ts`.
11. **Datas do e2e**, sempre a partir do dia de Brasília e nunca supondo o dia do mês:
    - (a) usa quatro dias seguidos dentro do mês (o primeiro é ontem quando o mês deixa) e um dia 10
      do mês seguinte;
    - (b) usa só o mês seguinte, mais o dia 1 quando ele já passou;
    - as datas não seguem o dia da semana da turma, o que o banco não confere e as ações não exigem.

## Para o dono olhar no portão (plano 16)

- **E28·long-text (backstop):** a 320px, uma pessoa de 160 caracteres saindo de uma turma de 120. O
  título “Tirar {nome} de {turma}?” deve quebrar, e “Manter na turma” e “Tirar da turma” devem
  continuar visíveis.
- **E13·empty:** “Nenhuma turma fixa lançada ainda.” só aparece num banco sem nenhuma turma ativa. Ficou
  sem e2e, porque afirmar isso é condição global do banco (CLAUDE.md) e a cadeia `vazio-*` não abre
  ficha. Conferir num banco novo.
- **Mensagem para o dono:** abrir a ficha de uma pessoa (e, a partir dos planos 11 e 14, “A receber” e o
  Início) cria as mensalidades do mês de TODOS os alunos de turmas ativas. É a D-02 funcionando, não um
  efeito colateral.

## Known Stubs

Nenhum. Os quadros “A REPOR” e “A RECEBER” da ficha são dos planos 08 e 11, como já estava registrado.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-32:** `entrarNaTurma` e `sairDaTurma` têm `exigirUsuario()` primeiro. O portão passou de 100
  para 102 ações, com 0 violações. A página chama `exigirUsuario()` antes de `garantirMensalidadesDoMes`.
- **T-05-33:** os esquemas aceitam só os dois uuids. Valor, datas e vencimento são lidos sob a trava e
  calculados pelo módulo puro.
- **T-05-34 (aceito):** a escrita no GET é só a instrução idempotente da D-02.
- **T-05-35:** a chave única + `on conflict do nothing`, e o índice parcial do vínculo ativo. O e2e
  (c) e o (f) provam isso com duas abas.

## TDD Gate Compliance

- Tarefa 1: `test(05-07)` `04395f0` (RED) → `feat(05-07)` `16b17e5` (GREEN). Sem refatoração.
- Tarefas 2 e 3: não eram `tdd`. Um commit cada, `17cda66` e `3850449`.

## Self-Check: PASSED

- Os cinco arquivos novos estão presentes: `mensalidade.ts`, `turmas-da-pessoa.tsx`,
  `confirmar-sair-da-turma.tsx`, `agenda-mensalidade.test.ts` e `agenda-entrar-na-turma.spec.ts`.
- Os commits `04395f0`, `16b17e5`, `17cda66` e `3850449` estão no branch `gsd/phase-05-agenda`. Não
  houve push nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff b639309..HEAD` nesses três
  arquivos não lista nada.
