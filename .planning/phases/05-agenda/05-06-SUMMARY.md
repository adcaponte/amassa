---
phase: 05-agenda
plan: 06
subsystem: agenda
status: complete
tags: [agenda, turma-fixa, d-03, d-13, age-03, folha-da-turma, marcar-mais-semanas, desativar-turma]
requires:
  - "05-01: eventos_turma_data_uk, turmas/turma_alunos/inscricoes, travarEvento, RecusaDaAgenda, FolhaEvento, semear-agenda.ts"
  - "05-03: FolhaLancar (pílulas, aviso D-13, conferirDiaParaLancar), CancelarEstaData, semearFechado, semearTurmaComDatas"
  - "05-05: inscricoesDoEvento, ligarVendaAInscricao, o molde de confirmação com erro dentro do diálogo"
provides:
  - "lib/agenda/turma.ts (puro): datasDaTurma, aPartirDeParaEstender, datasEmDiaFechado, diaDaSemanaDe, todoODia, rotuloDaTurmaNaGestao, quandoDaTurmaNoSite, NOMES_DOS_DIAS, ORDEM_DOS_DIAS_NA_TELA, SEMANAS_MINIMAS/MAXIMAS, FechadoDoDia"
  - "lib/agenda/abas.ts: turmaDaUrl"
  - "lib/agenda/semana.ts: nomeDoMes"
  - "lib/agenda/esquemas.ts: esquemaLancarTurma, esquemaEditarTurma, esquemaMarcarMaisSemanas, esquemaDesativarTurma; esquemaConferirDia aceita `ate` (até 366 dias)"
  - "lib/agenda/consultas.ts: fechadosEntre, obterTurma (TurmaCarregada), perdasAoDesativar; EventoDaSemana ganha turmaId e diaFechadoMotivo; DiaParaLancar ganha fechados"
  - "lib/agenda/gravacao.ts: marcarDatasDaTurma, travarTurma, inscreverAlunosNasDatas (usado também pelo plano 07), vendaAtivaEmDataFutura, contarPerdasAoDesativar, tirarDatasFuturasDaTurma"
  - "lib/agenda/acoes.ts: lancarTurma, editarTurma, marcarMaisSemanas, desativarTurma (100 ações no portão)"
  - "CamposTurma (+ CampoDeTexto, CampoControlado, capitalizar), FolhaTurma, ConfirmarDesativarTurma"
  - "tests/e2e/apoio/semear-agenda.ts: semearAluno, datasDaTurmaNoBanco, turmasComNome"
  - "data-testid: lancar-tipo-turma, lancar-dia-semana, lancar-mensalidade, lancar-semanas, lancar-vencimento, tag-dia-fechado, caixa-dia-fechado, abrir-turma, folha-turma, folha-turma-subtitulo, voltar-a-data, turma-nome/inicio/fim/vagas/mensalidade/vencimento/publica, turma-datas-marcadas, turma-marcar-mais-semanas, marcar-mais-semanas, turma-alunos-titulo, turma-sem-alunos, turma-aluno, desativar-turma, confirmar-desativar-turma(-sim|-nao|-erro), salvar-turma, folha-turma-voltar"
affects:
  - "FolhaLancar: a pílula “Turma fixa” é a PRIMEIRA (ordem da UI-SPEC); o padrão continua “Aula ou oficina avulsa”"
  - "FolhaEvento: link “Abrir a turma” em data de turma; em data de turma num dia fechado, “Cancelar esta data” sobe para a caixa do topo e o rodapé fica só com “Pronto”"
  - "SemanaDaAgenda: recebe hoje e turmaAberta; ?turma= abre a folha da turma no lugar da folha da data"
tech-stack:
  added: []
  patterns:
    - "Datas de turma garantidas pela chave única + on conflict do nothing, nunca por leitura prévia; trava da TURMA como primeiro elo"
    - "Apagar datas futuras: for update nas datas ANTES de apagar as inscrições (TURMA → EVENTO → INSCRIÇÃO) — nenhum insert concorrente deixa inscrição órfã"
    - "Folha que abre no lugar de outra por um segundo parâmetro de URL (?evento= + ?turma=), com o id aberto em estado local que muda no toque e segue a URL depois"
key-files:
  created:
    - lib/agenda/turma.ts
    - components/amassa/agenda/campos-turma.tsx
    - components/amassa/agenda/folha-turma.tsx
    - components/amassa/agenda/confirmar-desativar-turma.tsx
    - tests/unit/agenda-turma.test.ts
    - tests/e2e/agenda-turma.spec.ts
  modified:
    - lib/agenda/abas.ts
    - lib/agenda/semana.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - components/amassa/agenda/folha-lancar.tsx
    - components/amassa/agenda/cartao-evento.tsx
    - components/amassa/agenda/folha-evento.tsx
    - components/amassa/agenda/semana-da-agenda.tsx
    - tests/unit/agenda-abas.test.ts
    - tests/unit/agenda-esquemas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "Concordância de verdade no aviso e no toast da D-13 (1 → “cai … Ela é marcada”; k > 1 → “caem em dias fechados”), e “com a próxima aula” para N = 1"
  - "“todo sábado” / “todo domingo” (masculinos) em vez de “toda {dia}”"
  - "“Daqui para frente” é data > hoje em todo lugar (linha das datas, editar, desativar)"
  - "Desativar trava as datas futuras com for update antes de apagar as inscrições delas"
metrics:
  duration: "~26 min (19:12 → 19:38, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 21
actuals:
  tokens: 32600
  tasks: 3
  commits: 4
---

# Phase 5 Plan 06: a turma fixa — lançar N semanas, a folha da turma, marcar mais e desativar — Summary

**O gestor lança “toda terça, 19:00 às 21:00, por 8 semanas” uma vez só, pela pílula “Turma fixa”, e
vê as datas na agenda. A folha avisa antes das datas que caem em dia fechado, que são marcadas mesmo
assim com a etiqueta “dia fechado”. A folha da data abre com a caixa e o “Cancelar esta data” dentro
dela. Pela folha da turma ele muda o horário daqui para frente, marca mais semanas com os alunos já
dentro e desativa uma turma sem perder nenhuma aula que já aconteceu. A desativação recusa se uma
data futura já virou venda.**

## O que foi feito

### Tarefa 1: as datas no módulo puro (commits `486155f` RED, `39c08bf` GREEN)

- `lib/agenda/turma.ts` só importa `lib/producao/calendario.ts` e `./horario`. O teste de pureza
  confere isso lendo o arquivo.
- `datasDaTurma` acha a primeira ocorrência do dia da semana a partir de `aPartirDe` (inclusive) e
  depois uma por semana. Recusa semanas fora de 1..52 e dia fora de 0..6 com `RangeError`.
- `aPartirDeParaEstender` dá o dia seguinte à última data, ou hoje se ela já passou. Sem data
  nenhuma, também hoje.
- `datasEmDiaFechado` devolve as datas da turma que caem em dia fechado, na ordem das datas. Com dois
  fechados no mesmo dia, fica o primeiro.
- `rotuloDaTurmaNaGestao` dá “toda terça, 19:00 às 21:00”. `quandoDaTurmaNoSite` dá “toda terça, 19h
  às 21h”, e “19h30” na meia hora.
- `turmaDaUrl` aceita só uuid.
- 49 testes, entre eles 52 semanas atravessando a virada do ano e o domingo valendo 0.

### Tarefa 2: lançar a turma (commit `d0401f5`)

- **Servidor.**
  - `esquemaLancarTurma`:
    - nome 1..120;
    - dia 0..6 e data civil;
    - “HH:MM” com o fim depois do começo;
    - vagas 1..999;
    - mensalidade maior que zero, pela conversão única do Financeiro;
    - semanas 1..52 e vencimento 1..28, cada um com a frase do Copywriting.
  - `lancarTurma` começa por `exigirUsuario()`. Numa transação, faz o `insert` da turma e depois o
    `marcarDatasDaTurma`, com `onConflictDoNothing({ target: [eventos.turmaId, eventos.data] })`.
    Fora da transação, lê `fechadosEntre` para o toast.
  - `conferirDiaParaLancar` aceita `{ data, ate }`, limitado a 366 dias, e devolve os fechados do
    intervalo.
  - `lerSemana` e `obterEvento` trazem `turmaId` e `diaFechadoMotivo` (só na data de turma).
- **Tela.**
  - A pílula “Turma fixa” mostra os campos de `CamposTurma`, com o `Select` do shadcn para o dia
    (segunda → domingo).
  - O dia da semana vem do “+ lançar” do dia tocado. Sem dia tocado, segunda.
  - Nome, data, horário, vagas e o site são os mesmos estados da avulsa, então trocar de pílula
    mantém o que foi digitado.
  - O aviso D-13 da turma é calculado no cliente: `datasDaTurma` mais `datasEmDiaFechado` sobre os
    fechados do intervalo.
  - O primário diz “Lançar turma” e “Lançando…” enquanto grava. Depois, o toast e a semana da
    primeira data.
- **Cartão e folha.** O cartão ganha a tag âmbar “dia fechado” (`tag-dia-fechado`). Na data de
  turma num dia fechado, a folha abre com a caixa `caixa-dia-fechado`. O “Cancelar esta data” fica
  dentro dela, e o rodapé só com “Pronto”.

### Tarefa 3: a folha da turma (commit `14cd3a0`)

- **Servidor.** As três ações abaixo começam por `exigirUsuario()`, passam pelo Zod e travam a turma
  com `travarTurma` (`for no key update`).
  - `editarTurma`:
    - recusa a turma desativada;
    - grava a turma e, nas datas com `data > hoje` e não canceladas, o horário, as vagas e o público;
    - o nome não vai para as datas: elas leem o nome da turma ao vivo.
  - `marcarMaisSemanas`:
    - parte de `aPartirDeParaEstender(max(data), hoje)`;
    - grava com `marcarDatasDaTurma`;
    - na mesma transação, `inscreverAlunosNasDatas` inscreve quem está em `turma_alunos` com
      `saiu_em is null` como `aluno`, com `on conflict (evento_id, cliente_id) do nothing`.
  - `desativarTurma`:
    - procura a primeira inscrição de data futura com venda não cancelada
      (`vendaAtivaEmDataFutura`). Se houver, recusa com a frase da data e do número;
    - `tirarDatasFuturasDaTurma` trava as datas `> hoje` com `for update`, apaga as inscrições
      delas e depois as datas;
    - grava `ativa = false`, `desativada_em` e `desativada_por`. A turma nunca se apaga.
- **Leitura.** `obterTurma(id, hoje)` traz a turma, a última data, as datas futuras não canceladas,
  os alunos ativos em ordem de nome e as perdas ao desativar (datas e reposições).
- **Tela.**
  - `?turma=` abre `FolhaTurma` no lugar da folha da data. Ela abre na hora do toque, com o nome no
    cabeçalho e o esqueleto de 4 linhas. Vinda de uma data, tem “Voltar à data”.
  - O sub-título leva o plural de verdade: “1 aluno de 8 vagas” e “· no site”.
  - O formulário de edição mostra o dia da semana só para leitura, com a dica, e a dica do mês atual
    e do próximo.
  - O bloco “Datas” tem a linha “Marcada até…” e “Marcar mais [8] semanas”. “Alunos ({n})” só se lê,
    e tem frase própria quando está vazio.
  - “Desativar turma” fica no fim da área rolável. O rodapé preso tem “Voltar” e “Salvar turma”,
    que fica `disabled` sem mudança (“320” e “320,00” contam como a mesma mensalidade).
  - `ConfirmarDesativarTurma` mostra o erro dentro do diálogo, que continua aberto.
  - A turma desativada abre só para leitura, com “desativada em dd/mm”.
  - Um link velho para turma mostra o toast “não existe mais”. Uma falha de leitura mostra o erro
    dentro da folha, com “Tentar de novo”.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-turma.test.ts tests/unit/agenda-abas.test.ts` (RED) | falhou como esperado: `turma.ts` não existia e `turmaDaUrl` não era função |
| o mesmo depois de implementar | **49/49** |
| `npx vitest run tests/unit/agenda-esquemas.test.ts` | **39/39** (os casos novos de `esquemaLancarTurma` e do intervalo) |
| `npm run verificar` (Tarefa 2) | **verde**: 107 arquivos / 2049 testes, `verificar-acoes` **97 ações**, 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "agenda turma"` (Tarefa 2) | **58 passed (56.8s)** na primeira: (a)-(c) × desktop e celular, mais a cadeia `vazio-*` |
| `npm run verificar` (Tarefa 3) | **verde**: 107 / 2049, **100 ações**, 0 violações, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda turma"` (Tarefa 3) | **66 passed (1.0m)** na primeira: (a)-(g) × desktop e celular, mais a cadeia `vazio-*` |

Fiz **duas** invocações de e2e, uma por tarefa, como o orçamento pedia. A Tarefa 1 é unitária. Não
rodei `npm run build` separado nem a varredura sem `--grep`, que fica para o plano 16. O log repete
`Error: The destination stream closed early.`, o mesmo ruído dos planos 02-05, e nenhum teste falhou
por causa dele. Os outros comandos foram `npx tsc --noEmit`, `npx eslint` nos arquivos tocados e
`npm run verificar-acoes`, todos verdes.

**Não rodei de novo `agenda cancelamento`, `agenda colocar`, `agenda tracador`, `agenda lancamento` e
`agenda vistas`**, que tocam a folha do evento, a folha Lançar ou a semana. Li os pontos de contato:
- `agenda lancamento` afirma a pílula padrão “avulsa” e o “Lançar aula”, e os dois não mudaram.
- O caso de turma de `agenda cancelamento` clica `cancelar-data` numa data sem dia fechado, e lá o
  botão continua no rodapé.
- Nenhum teste conta pílulas nem anda por elas com as setas.

A varredura do plano 16 é a prova.

Greps de aceite:
- `grep -c "Uma delas cai num dia fechado" lib/agenda/textos.ts`: 1. `grep -c "delas caem em dias
  fechados"`: 1.
- `onConflictDoNothing`: 1 em `acoes.ts` (o de `colocarNaData`) e 1 em `gravacao.ts`
  (`marcarDatasDaTurma`, usado por lançar e por marcar mais).
- `saiu_em is null` em `gravacao.ts`: 1.
- `data > ` ou `gt(eventos.data`: 3 em `acoes.ts` e 9 em `gravacao.ts`.
- `delete(turmas)` ou `delete from turmas` em `lib/agenda`: nada.
- Nada de `react`, `next`, `drizzle-orm`, `pg` ou `@/db` em `turma.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2] Desativar trava as datas futuras antes de apagar as inscrições**
- **Found during:** Tarefa 3.
- **Issue:** apagar as inscrições e depois as datas deixa uma janela. Um “Colocar na lista”
  concorrente (que trava só o evento) podia inserir uma inscrição nova entre os dois `delete`, e o
  segundo falharia por chave estrangeira.
- **Fix:** `tirarDatasFuturasDaTurma` faz `select … for update` nas datas `> hoje` primeiro, na
  ordem TURMA → EVENTO → INSCRIÇÃO. Quem já estava colocando alguém termina, e a inscrição sai
  junto. Quem chega depois acha a data apagada.
- **Commit:** `14cd3a0`.

**2. [Rule 3] Três arquivos fora da lista do plano**
- `tests/unit/agenda-esquemas.test.ts` ganhou os casos de fronteira de `esquemaLancarTurma`. A
  verdade “AGE-03 · boundary” pede o servidor recusando 0, 53, 29 e vazio, e só o e2e (c) cobria
  isso, do lado do cliente.
- `lib/agenda/semana.ts` ganhou `nomeDoMes`, para a dica “a partir de {próximo mês}”. Os nomes dos
  meses já moravam lá.
- `components/amassa/agenda/semana-da-agenda.tsx` precisou receber `hoje` e `turmaAberta`, e passar
  `aoAbrirTurma` à folha do evento. A página sozinha não abre a folha da turma.

**3. Nomes de artefato diferentes da tabela do plano**
- `inscricoesFuturasComVendaAtiva`, que o plano punha em `consultas.ts`, virou
  `vendaAtivaEmDataFutura` em `gravacao.ts`. Ela é lida SOB a trava, dentro da transação de
  desativar, e por isso recebe a transação.
- `perdasAoDesativar` está em `consultas.ts`, como o plano pede, e embrulha
  `contarPerdasAoDesativar(leitor)`, no molde de `perdasAoCancelar`.

**4. Todas as frases da folha da turma entraram no commit da Tarefa 3**, e as do lançamento no da
Tarefa 2. `textos.ts` está na lista das duas tarefas.

Nenhuma migração, nenhum pacote novo. A `0026` não mudou: a chave `eventos_turma_data_uk` e as
colunas da turma já existiam.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado fora do
efêmero.

1. **Ordem das pílulas: “Turma fixa” primeiro.** O plano diz “terceira, antes de Fechado /
   bloqueio”. A UI-SPEC (“Turma fixa” · “Aula ou oficina avulsa” · “Uso livre” · “Fechado /
   bloqueio”) e o comentário do plano 03 (“turma entra antes da avulsa”) dizem primeiro. Segui o
   contrato da UI. A pílula marcada por padrão continua a avulsa. *Desfazer:* em `folha-lancar.tsx`,
   mover a linha `{ valor: "turma", … }` de `TIPOS`.
2. **Concordância do aviso D-13 da folha.** A UI-SPEC escreve “{k} das datas cai … Elas são
   marcadas” para qualquer k. Ficou assim:
   - k = 1: “1 das datas cai em dia fechado (dd/mm). Ela é marcada mesmo assim…”;
   - k > 1: “{k} das datas caem em dias fechados (…). Elas são marcadas…”.

   É a mesma correção que a verdade 3 do plano fez no toast. *Desfazer:*
   `avisoTurmaEmDiaFechado` em `textos.ts`.
3. **Toast com uma aula só.** Fica “Turma lançada, com a próxima aula.” e “Ela cai num dia fechado
   (…)”, em vez de “as próximas 1 aulas” e “Uma delas”. *Desfazer:* `toastTurmaLancada`.
4. **“todo sábado” / “todo domingo”.** A UI-SPEC escreve “toda {dia da semana}”, mas sábado e
   domingo são masculinos. Vale na gestão e no `quandoDaTurmaNoSite`, que o site usa no plano 15.
   *Desfazer:* `todoODia` em `turma.ts`.
5. **“Daqui para frente” é `data > hoje` em todo lugar**: a linha “Marcada até…”, editar e
   desativar. Se a única data que sobra é hoje, a folha diz “Nenhuma data marcada daqui para
   frente.”. A linha conta só datas não canceladas. A confirmação de desativar conta todas as datas
   futuras, inclusive canceladas, porque todas saem. *Desfazer:* `obterTurma` e
   `contarPerdasAoDesativar`.
6. **O toast de “Salvar turma” é só “Turma salva.”**, como na UI-SPEC. `editarTurma` devolve
   `mensalidadeMudou`, que o plano pediu, mas a tela não acrescenta frase. A dica do formulário já
   diz que a mensalidade nova vale a partir do próximo mês. *Desfazer:* usar
   `resposta.dados.mensalidadeMudou` em `folha-turma.tsx`.
7. **Desativar com erro não revalida a tela na hora.** A frase fica no diálogo, e a folha pede ao
   servidor a turma de agora quando o diálogo fecha, no molde de “Tirar da lista” do plano 05.
   *Desfazer:* revalidar no ramo da `RecusaDaAgenda` de `desativarTurma`.
8. **O rodapé “Voltar” da folha da turma volta à data** quando ela veio de uma data. Aberta direto,
   ele fecha a folha. *Desfazer:* `aoVoltar` em `FolhaTurma`.
9. **Frases que a UI-SPEC não fixa:**
   - “Escolha o dia da semana.” (só aparece com chamada forjada: o `Select` sempre tem um dia);
   - “Não deu para marcar mais semanas. Verifique a internet e tente de novo.”;
   - “Esta turma já foi desativada — a tela foi atualizada.”;
   - “1 data nova marcada, até {dd/mm}.”;
   - “Marcando…”;
   - o corpo de desativar com 0 ou 1 data: “Nenhuma data daqui para frente está marcada.” e “A data
     daqui para frente sai… dela”;
   - “(1 reposição marcada volta a ser crédito)”.

   *Desfazer:* `lib/agenda/textos.ts`.
10. **O toast longo da D-13 fica 8 s na tela** (o padrão do sonner é 4 s). O backstop E29 pede 5 s
    legíveis a 320px. *Desfazer:* tirar o `duration` em `folha-lancar.tsx`.
11. **Os nomes do dia no `Select` aparecem com inicial maiúscula** (“Terça”). Na folha da turma, a
    linha diz “Dia da semana: Terça”. *Desfazer:* tirar o `capitalizar` em `campos-turma.tsx` e
    `folha-turma.tsx`.
12. **Janelas de dias do e2e:** 500 + caso×40 + 20 no celular, longe das outras specs da Agenda. Os
    casos (a), (d) e (f) usam hoje, ±7 e +14, como o plano pede: lançar a partir de hoje, a data de
    hoje que não muda e a data passada que fica. Eles acham tudo pelo nome único ou pelo id.

## Para o dono olhar no portão (plano 16)

Itens da verificação de reserva (backstop), não automatizados:
- **E5·long-text:** abrir a pílula Turma fixa a 320px. “Mensalidade vence dia” e “Marcar quantas
  semanas” têm que quebrar o rótulo sem espremer o campo. Com 121 caracteres no nome, o erro aparece
  embaixo, com o limite.
- **E7·long-text:** fechar um dia com motivo de 120 caracteres e abrir a data de turma dele a 320px.
  A caixa quebra o texto, e o “Cancelar esta data” fica inteiro e com 44px.
- **E11·overflow:** a folha de uma turma com 30 alunos a 360×640. A área rola, “Desativar turma” fica
  no fim dela e o rodapé com “Salvar turma” continua preso. O e2e só prova 1 aluno.
- **E11·long-text:** nome de 120 caracteres a 320px. O título quebra ao lado do fechar e do “Voltar à
  data”, e o sub-título quebra sem cortar.
- **E28·error:** derrubar a rede e confirmar “Desativar turma”. O diálogo continua aberto com “Não deu
  para desativar…” e nada muda. A recusa da venda ativa já está provada no e2e (g), que usa o mesmo
  lugar no diálogo.
- **E29·long-text:** lançar 8 semanas com 2 datas em dia fechado e ler o toast a 320px. O e2e (b)
  prova o caso de 1 data.

## Known Stubs

Nenhum que impeça o objetivo do plano. Quatro faltas são de propósito e cada uma já tem dono:
- A tag “{n} a repor” ao lado do aluno, na folha da turma, entra no plano 08, que cria o crédito de
  reposição.
- Os alunos só entram na turma pela ficha, no plano 07. Até lá, o e2e semeia o vínculo com
  `semearAluno`.
- A guarda do Pitfall 6 em `editarTurma` (garantir a mensalidade do mês antes de gravar o valor
  novo) entra no plano 07, com a função que cria mensalidades. O comentário da ação diz isso.
- O “Colocar alguém” em data de turma entra no plano 08.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-28:** as quatro ações novas têm `exigirUsuario()` primeiro. O portão passou de 96 para 100
  ações, com 0 violações.
- **T-05-29:** o Zod recusa semanas fora de 1..52, vencimento fora de 1..28 e vagas fora de 1..999,
  e o banco tem os checks. A leitura do aviso aceita no máximo 366 dias.
- **T-05-30:** `eventos_turma_data_uk` + `on conflict do nothing`, com a trava da turma. O e2e (e)
  prova com duas abas: 6 datas, nenhuma repetida.
- **T-05-31:** só `data > hoje` sai, e a venda ativa recusa a desativação (e2e (g)). A turma é
  marcada, nunca apagada.

## TDD Gate Compliance

- Tarefa 1: `test(05-06)` `486155f` (RED) → `feat(05-06)` `39c08bf` (GREEN). Sem refatoração.
- Tarefas 2 e 3: não eram `tdd`. Um commit cada, `d0401f5` e `14cd3a0`.

## Self-Check: PASSED

- Os 6 arquivos novos estão presentes: `turma.ts`, `campos-turma.tsx`, `folha-turma.tsx`,
  `confirmar-desativar-turma.tsx`, `agenda-turma.test.ts` e `agenda-turma.spec.ts`.
- Os commits `486155f`, `39c08bf`, `d0401f5` e `14cd3a0` estão no branch `gsd/phase-05-agenda`. Não
  houve push nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff e03d26a..HEAD` nesses
  três arquivos não lista nada.
