---
phase: 05-agenda
plan: 08
subsystem: agenda
status: complete
tags: [agenda, presenca, reposicao, experimental, d-07, age-04, age-08, age-09, age-10, age-11, pitfall-7, valor-central]
requires:
  - "05-01: inscricoes (direito_a_repor, tipo reposicao/experimental, checks inscricoes_direito_so_com_falta / _reposicao_nao_cobra / _cobrar_com_valor / _valor_faixa), planejarPresenca, ordenarInscritos, definirPresenca, RecusaDaAgenda"
  - "05-04: cancelarData (trava for no key update do evento), a ficha da pessoa e a lista de Pessoas"
  - "05-05: seletor de pessoa (gruposDoSeletor, buscarPessoasParaData), colocarNaData, tirarDaLista, ConfirmarTirarDaLista"
  - "05-06: folha da turma, semearTurmaComDatas"
  - "05-07: travarCliente, valorDaAula, datasDaTurmaNoMes, mesDaData"
provides:
  - "lib/agenda/reposicao.ts (puro): creditosDeReposicao({ faltasComDireito, reposicoesUsadas }) → { comDireito, usadas, saldo, excedido }"
  - "lib/agenda/presenca.ts: precisaMarcarPresenca({ data, cancelada, inscritos }, hoje)"
  - "lib/agenda/seletor.ts: gruposDoSeletor recebe aRepor: { cliente, saldo }[]; PessoaDoSeletor.aRepor; PessoaComSaldo"
  - "lib/agenda/consultas.ts: creditosDoCliente(leitor, id), creditosPorCliente(ids), saldosDeReposicao(ids), aulasDaTurmaNoMes(turmaId, mes), SugestaoDaAula; lerSemana(segunda, hoje) e obterEvento(id, hoje) com marcarPresenca; EventoCarregado.sugestaoDaAula; InscritoCarregado.aRepor; VindaDaPessoa.direitoARepor; AlunoDaTurma.aRepor"
  - "lib/agenda/gravacao.ts: travarEventoParaLeitura (for share), eventoDaInscricao; EventoTravado.turmaId; InscricaoComVenda.cobrar"
  - "lib/agenda/acoes.ts: definirDireitoARepor (103 ações no portão); colocarNaData com modo oficina|reposicao|experimental; tirarDaLista aceita reposição e experimental (devolve tipo); definirPresenca trava o evento antes da inscrição"
  - "lib/agenda/esquemas.ts: MODOS_DE_COLOCAR, esquemaColocarNaData com modo/cobrar/valor, esquemaDefinirDireitoARepor"
  - "components/amassa/agenda/escolha-experimental.tsx (EscolhaExperimental, centavosParaCampo), components/amassa/agenda/gravacoes-pendentes.ts (registrarGravacao, depoisDasGravacoes)"
  - "data-testid: direito-a-repor, grupo-a-repor, grupo-do-contexto, tag-reposicao, tag-experimental, tag-gratuita, tag-marcar-presenca, tag-repoe, escolha-experimental, escolha-cobrar, escolha-gratuita, escolha-sem-escolha, valor-da-aula, valor-da-aula-dica, valor-da-aula-erro, quadro-a-repor, quadro-a-repor-numero, pessoa-a-repor, turma-aluno-a-repor, confirmar-tirar-da-lista-corpo"
  - "tests/e2e/apoio/semear-agenda.ts: marcarFaltaComDireitoNoBanco, saldoDeReposicaoNoBanco, cancelarDataNoBanco, inscricoesDaPessoaNaData"
affects:
  - "O seletor de pessoa numa data de turma ou oficina mostra “Tem aula a repor” primeiro — também com o campo vazio"
  - "“Colocar alguém” agora aparece também na data de turma (reposição ou experimental)"
  - "Fechar a folha da data (Pronto, X) troca a URL só depois das gravações de presença no ar (até 8 s)"
  - "Quem tem aula a repor só aparece no grupo 1: numa oficina, essa pessoa entra como reposição (não paga) — ver “Para o dono olhar”"
tech-stack:
  added: []
  patterns:
    - "Crédito derivado por contagens filtradas (count(*) filter) sobre as linhas, nunca coluna de saldo"
    - "Subconsulta correlacionada do saldo como restrição do listarClientes (grupo 1 e grupo do contexto sem repetição)"
    - "Trava for share do evento antes da inscrição para ações que só precisam que a data não mude de estado"
    - "Contador de gravações no ar no navegador para adiar a troca de URL até as Server Actions terminarem"
key-files:
  created:
    - lib/agenda/reposicao.ts
    - components/amassa/agenda/escolha-experimental.tsx
    - components/amassa/agenda/gravacoes-pendentes.ts
    - tests/unit/agenda-reposicao.test.ts
    - tests/e2e/agenda-reposicao.spec.ts
    - tests/e2e/agenda-presenca.spec.ts
  modified:
    - lib/agenda/presenca.ts
    - lib/agenda/seletor.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - components/amassa/agenda/linha-inscrito.tsx
    - components/amassa/agenda/colocar-alguem.tsx
    - components/amassa/agenda/seletor-pessoa.tsx
    - components/amassa/agenda/folha-evento.tsx
    - components/amassa/agenda/cartao-evento.tsx
    - components/amassa/agenda/confirmar-tirar-da-lista.tsx
    - components/amassa/agenda/ficha-pessoa.tsx
    - components/amassa/agenda/lista-pessoas.tsx
    - components/amassa/agenda/folha-turma.tsx
    - components/amassa/agenda/semana-da-agenda.tsx
    - tests/unit/agenda-presenca.test.ts
    - tests/unit/agenda-seletor.test.ts
    - tests/unit/agenda-esquemas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
    - tests/e2e/agenda-entrar-na-turma.spec.ts
decisions:
  - "O grupo “Tem aula a repor” aparece também com a busca vazia; “Digite para buscar.” continua acima dele"
  - "Experimental “Cobrar” com R$ 0,00 é recusada (“Diga o valor…”): quem não paga é “Gratuita”"
  - "A ordem da lista “Quem vem” (backstop AGE-11) é a de ordenarInscritos: alunos, reposições, experimentais, oficina; nome pt-BR sem acento/caixa; desempate por id"
  - "“Pronto” fecha a folha na hora e adia a troca da URL até as gravações de presença terminarem (máx. 8 s)"
metrics:
  duration: "~42 min (20:03 → 20:45, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 29
actuals:
  tokens: 25900
  tasks: 3
  commits: 5
---

# Phase 5 Plan 08: presença de uma turma inteira em um toque por pessoa, a falta com direito a repor, a reposição e a aula experimental — Summary

**Na data de uma turma, o gestor toca o cartão, “Veio” ou “Faltou” de cada pessoa e “Pronto”: 8 toques
para uma turma de 6, sem teclado. Quem faltou ganha a caixa “tem direito a repor esta aula”, e isso vira
uma aula a repor, contada sobre as linhas e nunca guardada num contador. Ao colocar alguém numa data,
quem tem aula a repor aparece primeiro. A aula é usada uma vez só, mesmo com dois celulares, e volta se a
reposição sair. Quem vem experimentar entra só naquela data, e o gestor decide na hora se é cobrado
(valor de uma aula sugerido, editável) ou se é de graça.**

## O que foi feito

### Tarefa 1: o módulo puro (commits `221f804` RED, `108a32c` GREEN)

- `creditosDeReposicao` faz `saldo = max(0, comDireito − usadas)` e marca `excedido` quando as usadas
  passam das faltas com direito. Contagem negativa, fracionária ou `NaN` lança `RangeError`. Zero imports.
- `precisaMarcarPresenca` só é verdadeiro para data **anterior** a hoje, não cancelada e com alguém sem
  marcação. Hoje, futuro, cancelada e lista vazia dão falso.
- `gruposDoSeletor` recebe `aRepor: { cliente, saldo }[]`. Saldo 0 fica fora do grupo 1, e a pessoa
  continua no grupo do contexto. Cada pessoa do grupo 1 leva `aRepor` (o saldo). Quem está no grupo 1 não
  se repete no do contexto.
- 30 testes nos três arquivos. Os testes de pureza leem o arquivo.

### Tarefa 2: direito a repor e reposição (commit `b6dca82`)

**Servidor.**
- `travarEventoParaLeitura` usa `for share`. `definirPresenca` e `definirDireitoARepor` leem o
  `evento_id`, travam o EVENTO e só então a INSCRIÇÃO. Com isso, cancelar e marcar ao mesmo tempo terminam
  coerentes (AGE-04).
- `definirDireitoARepor` começa por `exigirUsuario()` e grava o estado desejado. Ele só aceita data de
  turma não cancelada e inscrição `aluno` ou `experimental` com `faltou`. Fora disso, a frase é “Só quem
  faltou numa aula de turma pode ter direito a repor.”. Desmarcar o que já está desmarcado converge sem
  conferir mais nada.
- `colocarNaData` com `modo: 'reposicao'` funciona em data de turma ou de oficina e segue estes passos:
  1. trava o EVENTO;
  2. trava o CLIENTE com `travarCliente` (`acoes.ts:629`);
  3. recusa quem já está na lista;
  4. recalcula o crédito com `creditosDoCliente(tx, …)` **sob a trava** (`acoes.ts:644`, depois da 629);
  5. com saldo 0, recusa com “{nome} não tem mais aula a repor — talvez tenha sido usada em outro celular.
     A tela foi atualizada.”;
  6. senão insere `tipo = 'reposicao'` sem cobrar.
- `pessoasParaData` monta o grupo 1 no servidor. Ele usa o mesmo `listarClientes`, com uma subconsulta
  correlacionada do saldo (`> 0`), e tira quem está na data. O grupo do contexto usa `<= 0` e não repete
  ninguém.
- `tirarDaLista` aceita reposição e devolve o `tipo`.

**Tela.**
- A caixa “tem direito a repor esta aula” aparece na linha de baixo de quem faltou numa data de turma,
  com `Checkbox` 20px dentro de `label` de 44px. É otimista, junto com a presença: sair de “Faltou” tira
  a caixa e o direito.
- A linha do inscrito ganha a tag “reposição”, e a reposição ganha “tirar da lista”. A confirmação diz
  “A reposição volta a ser crédito: {nome} fica com 1 aula a repor.”, e o toast acrescenta “ A aula a
  repor voltou para o crédito.”.
- No seletor, o grupo 1 fica em âmbar, com “{nome} — reposição · {n} a repor”. A faixa diz “{nome} entra
  como reposição e usa 1 das {n} aulas a repor.”.
- A tag “marcar presença” aparece no cartão da semana e no sub-título da folha.
- A ficha ganha o quadro “A REPOR {n} aula/aulas” (Display), e as últimas vindas mostram “faltou” +
  “repõe”. A lista de Pessoas e a folha da turma (no aluno) ganham a tag “{n} a repor”.

### Tarefa 3: experimental e o Valor central (commit `1eded3d`)

**Servidor.**
- `colocarNaData` com `modo: 'experimental'` só funciona em data de turma. Ele recusa o aluno ativo da
  turma com “{nome} já é aluno desta turma — já está nas datas.”.
- O Zod exige `cobrar` (“Diga se esta aula é cobrada ou gratuita.”). Cobrando, converte o valor com
  `converterReaisParaCentavos`. Vazio, ilegível, negativo ou 0 dão “Diga o valor — por exemplo, 40 ou
  37,50.”.
- A ação grava `tipo = 'experimental'`, `cobrar` e `valor_centavos`.
- A sugestão (`SugestaoDaAula`) vem pronta em `obterEvento`: `valorDaAula(mensalidade da turma, aulas não
  canceladas da turma no mês da data)`.

**Tela.**
- `EscolhaExperimental` é o segmentado `radiogroup` “Cobrar · Gratuita” (`aria-label` “Esta aula é
  cobrada?”, 52px, setas movem a escolha), com nada marcado de início. Enquanto nada está escolhido,
  “Colocar na lista” fica desabilitado, e a frase “Diga se…” é o `aria-describedby` dele.
- “Cobrar” mostra “Valor desta aula (R$)” já preenchido, com a dica “sugestão: mensalidade de {R$} ÷ {n}
  aulas em {mês}”. O valor é validado no cliente (por conveniência) e de novo no servidor.
- O toast é “Entrou só nesta data (experimental). Para virar aluno fixo, é pela ficha da pessoa.”. Na
  cobrada, acrescenta “ A aula de {R$} foi para “A receber”.”.
- A experimental ganha a tag “experimental”, e a gratuita também “gratuita”. Tirar a gratuita diz “{nome}
  sai só desta data.”; tirar a cobrada diz o texto de oficina.
- A ordem da lista é a de `ordenarInscritos` (verdade 7), provada no e2e (d).

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-reposicao.test.ts tests/unit/agenda-presenca.test.ts tests/unit/agenda-seletor.test.ts` (RED) | falhou como esperado: 9 testes e a suíte de `reposicao` sem módulo |
| o mesmo (GREEN) | **30/30** |
| `npm run verificar` (Tarefa 2) | **verde**: 109 arquivos / 2085 testes, `verificar-acoes` **103 ações** e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "agenda reposicao"` (1ª) | 60 passed, **2 failed**: (d) nos dois projetos. O auxiliar `cancelarDataNoBanco` esquecia `cancelado_por` (check `eventos_cancelado_por`) |
| o mesmo (2ª, depois de corrigir o auxiliar) | **62 passed** |
| `npm run verificar` (Tarefa 3) | **verde**: 109 / 2092, 103 ações, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda presenca"` (1ª) | 61 passed, **1 failed**: (a) no celular. A tag “marcar presença” ficava no cartão depois de “Pronto” (Deviation 1) |
| o mesmo (2ª, depois da correção) | **62 passed** |
| `npm run test:e2e -- --grep "agenda"` (1ª) | 169 passed, **2 failed**, 1 skipped: `agenda vistas` contou minha oficina no dia +11, e `agenda entrar na turma` (g) tinha premissa global |
| `npm run test:e2e -- --grep "agenda"` (2ª) | 169 passed, **2 failed**: `agenda entrar na turma` (d) e (f), a mesma premissa global da D-02 |
| `npm run test:e2e -- --grep "agenda"` (3ª) | **171 passed**, 1 skipped. O pulado é `site-abertura` (k), que o próprio teste pula no celular |
| `npm run verificar` (final) | **verde**: 109 / 2092, 103 ações, `test:migracoes` verde |

**Foram 7 invocações de e2e, não as 2 do orçamento.** Cada repetição veio de uma falha que precisava de
diagnóstico:
- duas foram a mesma `--grep` da tarefa, depois de uma correção;
- três foram `--grep "agenda"`. Mudei como a folha da semana fecha e a ordem das travas da presença, e
  isso toca todas as specs da Agenda. As duas primeiras acharam premissas de outras specs que meus testes
  passaram a derrubar.

Não rodei `npm run build` separado nem a varredura completa sem `--grep`, que fica para o plano 16.
Também rodei `npx tsc --noEmit` (depois de apagar `.next/types`), `npx eslint` nos arquivos tocados e
`npm run verificar-acoes`, todos verdes.

**Valor central (e2e `agenda presenca` (a)), medido pelo teste:**
- **8 toques**: o cartão, 6 pessoas e “Pronto”, sem teclado e sem confirmação.
- **Celular**: 355 ms, 309 ms e 295 ms do primeiro ao último toque de presença.
- **Desktop**: 429 ms, 392 ms e 427 ms.

São toques de robô; a medição de verdade é humana, no portão.

Greps de aceite:
- `creditosDoCliente` em `acoes.ts`: 2 (o import e a chamada na linha 644, depois de `travarCliente` na
  linha 629).
- `saldo_reposicao|creditos_reposicao|credito integer` em `db/schema.ts`: nada.
- `for("share"` em `gravacao.ts`: 1.
- `valorDaAula`: 3 em `consultas.ts`.
- “Esta aula é cobrada?”: 1 em `textos.ts`. O componente usa a constante.
- Nada de `@/db`, `react`, `next`, `drizzle-orm` ou `pg` nos três puros.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: Bug] “Pronto” com gravações no ar deixava a semana velha (a tag “marcar presença” ficava)**
- **Found during:** Tarefa 3, e2e (a) no celular. O banco tinha as 6 marcações, mas o retrato da página
  mostrava todos os cartões da semana como estavam antes, inclusive o do outro projeto.
- **Issue:** fechar a folha faz `router.push` (tira `?evento=`) enquanto as Server Actions de presença
  ainda estão no ar. A semana era lida de novo antes das últimas gravações, e o resultado revalidado
  delas não voltava à tela.
- **Fix:** `components/amassa/agenda/gravacoes-pendentes.ts` conta as gravações no ar
  (`registrarGravacao` em `LinhaInscrito`, na presença e no direito). `SemanaDaAgenda.fechar` fecha a
  folha **na hora** e só troca a URL em `depoisDasGravacoes`, nunca mais que 8 s depois. Se o gestor
  abrir outro cartão antes, a troca adiada é descartada.
- **Files modified:** `components/amassa/agenda/gravacoes-pendentes.ts` (novo),
  `components/amassa/agenda/linha-inscrito.tsx`, `components/amassa/agenda/semana-da-agenda.tsx`.
- **Commit:** `1eded3d`.

**2. [Rule 3] Arquivos fora da lista do plano**
- `app/gestao/(app)/agenda/page.tsx`: `lerSemana(segunda, hoje)` e `obterEvento(id, hoje)`, os saldos da
  lista de Pessoas e o `aRepor` da ficha.
- `components/amassa/agenda/seletor-pessoa.tsx`: a linha “— reposição · {n} a repor” e os `data-testid`
  dos grupos.
- `components/amassa/agenda/semana-da-agenda.tsx`: o Deviation 1.
- `tests/unit/agenda-esquemas.test.ts`: 7 testes do `esquemaColocarNaData` e do
  `esquemaDefinirDireitoARepor`.

**3. [Rule 1: teste] Auxiliar `cancelarDataNoBanco`** sem `cancelado_por` violava `eventos_cancelado_por`.
Agora grava os dois carimbos com o gestor de teste. Commit `b6dca82`.

**4. [Rule 1: teste] Datas das specs novas colidiam com dias que outra spec conta**
- **Issue:** `agenda vistas` reserva os dias +10/+11 e afirma “1 oficina”. Minha `agenda reposicao` (b)
  punha uma oficina no +11.
- **Fix:** as datas futuras de `agenda reposicao` vão para `diaReservado` (700+, um dia por projeto), e
  as de `agenda presenca` para 760 e o mês de +800. Assim nenhuma data cai num dia que outra spec conta.
- **Commit:** `1eded3d`.

**5. [Rule 1: teste de outro plano] `agenda entrar na turma` (d), (f), (g) afirmavam condição global do banco**
- **Issue:** abrir a ficha de QUALQUER pessoa faz nascer a mensalidade do mês de **todos** os alunos
  (D-02, plano 07). Os três casos semeavam um aluno anterior ao mês e supunham que ninguém criaria a
  mensalidade dele no meio:
  - (g) afirmava “ainda não nasceu”;
  - (f) afirmava “só 1 mensalidade”;
  - (d) semeava a do mês **depois** do vínculo, e a D-02 de outro caso chegava antes, o que dava chave
    duplicada.

  Com as minhas specs abrindo fichas em paralelo, isso passou a falhar. É exatamente o tipo de premissa
  que o CLAUDE.md proíbe.
- **Fix, sem afrouxar o que o caso prova:**
  - (d) semeia a mensalidade **antes** do vínculo;
  - (f) confere só que a do mês passado é a única semeada;
  - (g) aceita “não nasceu, ou nasceu com o valor antigo”. A prova final do Pitfall 6 (valor antigo
    depois de mudar o preço) continua igual.
- **Commit:** `1eded3d`.

**6. Na lista mas sem mudança: `lib/clientes/lista.ts`.** A UI-SPEC (§“Aba Pessoas”, item 3) põe a tag
“{n} a repor” **ao lado do nome**, não na sub-linha. Ela foi para `lista-pessoas.tsx`, e
`subLinhaDaPessoa` (que Cadastros → Clientes também usa) ficou como estava.

**7. Nomes:**
- `saldosDeReposicao` é um ajudante a mais sobre `creditosPorCliente`.
- `eventoDaInscricao` existe para travar o evento antes da inscrição.
- O e2e (b) prova “a pessoa não aparece mais no grupo” numa **outra** data (uma oficina), porque na
  própria data ela já está na lista.

Nenhuma migração e nenhum pacote novo. A `0026` não mudou: as colunas e os checks já existiam desde o
plano 01. Também não houve mudança em `db/schema.ts` nem em `TABELAS_ESPERADAS`.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado fora do
efêmero.

1. **“Tem aula a repor” aparece também com o campo vazio.** A UI-SPEC só fixa o texto do caso “busca
   vazia, sem ninguém a repor”. Com gente a repor, o grupo aparece e “Digite para buscar.” continua acima,
   para os demais. *Desfazer:* em `pessoasParaData` (`consultas.ts`), só montar `aRepor` quando
   `busca !== ""`.
2. **Experimental “Cobrar” com R$ 0,00 é recusada**, com a frase “Diga o valor — por exemplo, 40 ou
   37,50.”. Quem não paga é “Gratuita”; uma cobrança de zero iria para “A receber” sem nada a receber.
   *Desfazer:* `convertido.centavos < 1` em `esquemaColocarNaData` e em `colocar-alguem.tsx`.
3. **Saldo “excedido”** acontece quando o direito é desmarcado depois de a reposição ser usada, ou quando
   uma data cancelada com reposição é descancelada. A tela mostra 0, sem aviso. *Desfazer/estender:* o
   campo `excedido` já vem do módulo puro.
4. **A dica da sugestão tem plural de verdade** (“÷ 1 aula” / “÷ 4 aulas”). Sem aula no mês (todas
   canceladas), não há sugestão e o campo vem vazio.
5. **Frases que a UI-SPEC não fixa:**
   - “Reposição só entra numa aula de turma ou numa oficina.”;
   - “A aula experimental só entra numa data de turma.”;
   - “Não deu para marcar o direito a repor. Verifique a internet e tente de novo.” e “Não deu para
     marcar o direito a repor de {nome}. Toque de novo.”.

   *Desfazer:* `lib/agenda/textos.ts`.
6. **Enquanto nada está escolhido**, a frase “Diga se esta aula é cobrada ou gratuita.” aparece embaixo do
   segmentado, em `tinta-fraca`, como descrição do botão desabilitado. O botão desabilitado nunca deixa a
   frase virar erro.
7. **O quadro “A REPOR” ocupa a primeira coluna de um `grid-cols-2`**. A segunda é do “A RECEBER”, no
   plano 11.
8. **“Pronto” adia a troca da URL por até 8 s** (Deviation 1). A folha some na hora, e o gestor não
   espera nada.

## Para o dono olhar no portão (plano 16)

- **Regra de dinheiro herdada do plano, não decidida aqui:** quem tem aula a repor aparece **só** no
  grupo “Tem aula a repor” (verdade 4 e Tarefa 1: “quem está nos dois aparece só no primeiro”). Numa
  **oficina**, essa pessoa só pode entrar como **reposição, sem pagar**. Pelo seletor, não há como
  inscrevê-la paga na oficina enquanto ela tiver crédito. O BRIEFING §4 diz “a lista oferece primeiro
  quem tem aula a repor … e depois qualquer pessoa”, e o protótipo oferece reposição na oficina. Se a
  oficina não deveria aceitar reposição, ou se a pessoa com crédito deveria poder entrar paga, é decisão
  sua.
- **Valor central no celular de verdade:** 8 toques medidos pelo teste. Falta o tempo com a mão, em pé,
  no ateliê.
- **E8:** “Tem aula a repor” com muita gente a repor e o campo vazio mostra as 8 primeiras e “Há mais
  pessoas com esse nome — continue digitando.”. A frase fala de “nome” mesmo sem nada digitado.

## Known Stubs

Nenhum que impeça o objetivo do plano. Ficam para planos já marcados:
- o quadro “A RECEBER” da ficha (plano 11);
- a tag de pagamento da experimental cobrada, ou seja, a situação dela em “A receber” (plano 11).

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-36:** `definirDireitoARepor` tem `exigirUsuario()` primeiro. O portão passou de 102 para 103
  ações, com 0 violações.
- **T-05-37:** a trava do cliente `for no key update` e o recálculo sob a trava. O e2e (c) prova isso com
  duas abas: uma aceita, a outra recebe a frase e o saldo fica 0.
- **T-05-38:** Zod mais os checks do banco.
- **T-05-39:** `for share` contra `for no key update`. O e2e (e) de `agenda presenca` prova que o fim
  fica sem falta e sem crédito.
- **T-05-40:** `converterReaisParaCentavos`, inteiro e sem sinal, e mais o “maior que zero” do item 2.

## TDD Gate Compliance

- Tarefa 1: `test(05-08)` `221f804` (RED) → `feat(05-08)` `108a32c` (GREEN). Sem refatoração.
- Tarefas 2 e 3: não eram `tdd`. Um commit cada, `b6dca82` e `1eded3d`.

## Self-Check: PASSED

- Os seis arquivos novos estão presentes: `lib/agenda/reposicao.ts`, `escolha-experimental.tsx`,
  `gravacoes-pendentes.ts`, `agenda-reposicao.test.ts`, `agenda-reposicao.spec.ts` e
  `agenda-presenca.spec.ts`.
- Os commits `221f804`, `108a32c`, `b6dca82` e `1eded3d` estão no branch `gsd/phase-05-agenda`. Não houve
  push nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff 882788c..HEAD` nesses três
  arquivos não lista nada.
