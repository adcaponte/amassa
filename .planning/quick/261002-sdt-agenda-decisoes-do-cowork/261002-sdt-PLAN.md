---
quick_id: 261002-sdt
description: Agenda — três ajustes decididos pelo dono no chat em 02/10/2026 depois da verificação do Cowork (caixa pública desmarcada por padrão; Dispensar uso livre com venda cancelada; confirmação do lote de mensalidades)
mode: quick
phase: quick-261002-sdt
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [AGE-03, AGE-18, AGE-15, AGE-16]
files_modified:
  - components/amassa/agenda/folha-lancar.tsx
  - components/amassa/agenda/lote-de-mensalidades.tsx
  - components/amassa/agenda/confirmar-lancar-lote.tsx
  - lib/agenda/textos.ts
  - tests/unit/agenda-receber.test.ts
  - tests/unit/agenda-esquemas.test.ts
  - tests/e2e/agenda-lancamento.spec.ts
  - tests/e2e/agenda-turma.spec.ts
  - tests/e2e/agenda-no-site.spec.ts
  - tests/e2e/site-agenda.spec.ts
  - tests/e2e/agenda-mensalidades-lote.spec.ts
  - lib/agenda/receber.ts
  - db/schema.ts
  - db/migrations/0027_dispensa-do-uso-livre.sql
  - db/migrations/meta/_journal.json
  - db/migrations/meta/0027_snapshot.json
  - scripts/testar-migracoes.mjs
  - lib/agenda/gravacao.ts
  - lib/agenda/esquemas.ts
  - lib/agenda/acoes.ts
  - app/api/health/agenda/route.ts
  - lib/agenda/consultas.ts
  - components/amassa/agenda/linha-a-receber.tsx
  - components/amassa/agenda/confirmar-dispensar.tsx
  - components/amassa/agenda/dispensadas.tsx
  - tests/e2e/agenda-dispensar.spec.ts
  - tests/e2e/apoio/semear-agenda.ts
  - docs/operacao/18-migracao-dispensa-do-uso-livre.md
  - .planning/phases/05-agenda/05-CONTEXT.md
  - .planning/phases/05-agenda/05-UI-SPEC.md
  - .planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md
  - .planning/STATE.md
  - .planning/PROXIMA-SESSAO.md

estimate:
  tokens: 85000
  raw_tokens: 170000
  tasks: 4
  confidence: high

must_haves:
  truths:
    - "Decisão 1 do dono (02/10/2026): ao abrir “Lançar na agenda” em aula/oficina avulsa ou em turma fixa, a caixa “Mostrar no calendário público do site” vem DESMARCADA; lançar sem tocar nela grava eventos.publico = false (avulsa) / turmas.publica = false e as datas com publico = false — nada vai para o site"
    - "Marcar a caixa de propósito continua publicando: a turma marcada grava publica = true e as datas publico = true; a oficina marcada aparece no site e na aba “No site”"
    - "O servidor nunca decide pela pessoa: esquemaLancarAvulsa e esquemaLancarTurma continuam exigindo o booleano (sem .default), e nenhuma migração muda o default de turmas.publica — o único insert de turmas recebe o valor da ação"
    - "Decisão 3 do dono: tocar “Lançar estas N na Venda” abre a confirmação “Lançar N vendas?” (singular “Lançar 1 venda?”) com a quantidade e o total; só o botão de confirmar dela chama lancarMensalidadesEmLote; o de voltar fecha sem criar venda nenhuma"
    - "Decisão 2 do dono (se o checkpoint escolher migracao-0027): em “A receber”, o uso livre encerrado cuja venda foi cancelada no Caixa mostra “Dispensar a cobrança”; o uso livre sem venda continua sem o botão"
    - "Dispensar um uso livre pede confirmação com motivo opcional, tira a linha de “A receber”, põe em “Dispensadas” com quem, quando e o motivo, e não apaga nada; “Desfazer” devolve a linha com a etiqueta “venda nº N cancelada”"
    - "definirDispensa confere no servidor, sob a trava da cobrança, que o uso livre só se dispensa com a venda cancelada, e recusa os outros casos com frase humana; o banco também recusa (check usos_livres_dispensa_so_com_venda)"
    - "As três decisões estão registradas em 05-CONTEXT.md como nota datada (“decisão do dono no chat, 02/10/2026”), com o texto antigo da D-09 intacto"
  artifacts:
    - path: "components/amassa/agenda/folha-lancar.tsx"
      provides: "estado `publico` da folha começando em false (turma e avulsa compartilham)"
      contains: "[publico, setPublico] = useState(false)"
    - path: "components/amassa/agenda/confirmar-lancar-lote.tsx"
      provides: "AlertDialog “Lançar N vendas?” no padrão dos confirmar-*.tsx da Agenda"
    - path: "lib/agenda/textos.ts"
      provides: "tituloConfirmarLote, corpoConfirmarLote, rotuloConfirmarLote; frase da recusa do uso livre sem venda cancelada; título/corpo da dispensa do uso livre"
    - path: "lib/agenda/receber.ts"
      provides: "podeDispensar: uso_livre só com situacao venda_cancelada"
      contains: "venda_cancelada"
    - path: "db/migrations/0027_dispensa-do-uso-livre.sql"
      provides: "dispensada_em, dispensada_por, motivo_dispensa em usos_livres + três checks (NÃO aplicada)"
    - path: "docs/operacao/18-migracao-dispensa-do-uso-livre.md"
      provides: "roteiro do dono para publicar e aplicar a 0027"
  key_links:
    - from: "components/amassa/agenda/confirmar-lancar-lote.tsx"
      to: "lancarMensalidadesEmLote (lib/agenda/acoes.ts)"
      via: "só no clique do botão de confirmar do diálogo"
      pattern: "lancarMensalidadesEmLote"
    - from: "lib/agenda/acoes.ts definirDispensa"
      to: "lib/agenda/receber.ts podeDispensar"
      via: "situação lida sob travarCobranca"
      pattern: "podeDispensar"
    - from: "lib/agenda/gravacao.ts lerUsosLivresCobrados"
      to: "usos_livres.dispensada_em"
      via: "vendaLigada recebe a dispensa real (hoje força null) e o filtro soLivres a exclui"
      pattern: "usosLivres.dispensadaEm"
    - from: "lib/agenda/consultas.ts lerDispensadas"
      to: "usos_livres"
      via: "terceira leitura + contagem, misturada por ordenarDispensadas"
      pattern: "usosLivres.dispensadaEm"
---

<objective>
Implementar os três ajustes que o dono decidiu no chat em 02/10/2026 depois da verificação do Cowork
(`Claude outputs/agenda/VERIFICACAO-COWORK-05.md`, §2, itens 1–3) na Agenda, que está no ar:

1. A caixa “Mostrar no calendário público do site” vem **desmarcada** por padrão em todo lançamento
   (turma fixa e aula/oficina avulsa). Palavras dele: “Inverter a marcação do calendario publico. de
   padrão vem desmarcado.”
2. **Dispensar** um uso livre encerrado só quando a venda dele estiver cancelada (refina a D-09, que
   excluía o uso livre). Palavras dele: “seguir sugestão do cowork”.
3. O **lote de mensalidades** pede uma confirmação final (“Lançar N vendas?”, com quantas e o total)
   antes de criar as vendas.

Purpose: evitar publicar sem querer uma turma ou oficina no site (o WhatsApp do site é o real e o
site se atualiza ao salvar); acabar com o lixo permanente em “A receber”; evitar que um toque crie
20 vendas que só se desfazem uma a uma no Caixa.

**Achado do planejamento que muda o tamanho do item 2:** `usos_livres` **não tem** as colunas de
dispensa (`db/schema.ts`, tabela `usosLivres`, por volta da linha 1988). Só `mensalidades` e
`inscricoes` as têm, porque a D-09 excluía o uso livre. “Mesma mecânica/estado Dispensadas” (quem,
quando, motivo, desfazer, nada apagado) precisa de três colunas novas → uma migração `0027`. A D-09
já classificava essas colunas como one-way (“colunas novas por migração aplicada pelo dono”), e o
pedido diz para evitar migração. Por isso há um `checkpoint:decision` antes da Tarefa 2. O item 1 **não** precisa
de migração (ver Tarefa 1) e o item 3 não toca o banco.

Sem traçador: são três ajustes independentes numa arquitetura já provada em produção (equivale a
`--no-tracer`). Sem push, sem servidor, sem migração aplicada. Commits locais em `main`.

Output: código + testes dos três itens; se o dono escolher `migracao-0027`, também a migração
versionada (não aplicada), a prova em `test:migracoes`, o Roteiro 18 e as notas datadas nos
documentos de estado.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@.planning/phases/05-agenda/05-CONTEXT.md
@Claude outputs/agenda/VERIFICACAO-COWORK-05.md

Mapa do código (lido pelo planejador em 02/10/2026; confira antes de editar):

- Caixa pública: `components/amassa/agenda/folha-lancar.tsx`, `const [publico, setPublico] = useState(true)`
  (~linha 232); o mesmo estado vai para a turma (`publica: publico`, ~370, via `CamposTurma`) e para a
  avulsa (`publico`, ~373; checkbox `lancar-publico`, ~752). `campos-turma.tsx` só recebe a prop. A
  folha da turma (`folha-turma.tsx`, `turma-publica`) edita o valor que a turma já tem; não muda.
- Servidor: `lib/agenda/esquemas.ts` — `publico: z.boolean(...)` (~122) e `publica: z.boolean(...)`
  (~293, ~324), obrigatórios, sem `.default`. `lib/agenda/acoes.ts` — único `insert(turmas)` (~410)
  grava `publica: dados.publica`. Banco: `turmas.publica` com default true (`db/schema.ts` ~1752),
  `eventos.publico` com default false (~1826).
- Testes e2e que contam com a caixa marcada: `agenda-lancamento.spec.ts:84,91,118`,
  `agenda-turma.spec.ts:137,157,163`, `agenda-no-site.spec.ts` caso (a) (~45–62, lança e espera a
  oficina na aba “No site” sem tocar na caixa), `site-agenda.spec.ts` `lancarOficina` (~44–60, hoje
  desmarca quando `publica` é false).
- Lote: `components/amassa/agenda/lote-de-mensalidades.tsx` (botão `lote-lancar` chama
  `lancarMensalidadesEmLote` direto); textos em `lib/agenda/textos.ts` ~1052–1079
  (`rotuloDoBotaoDoLote`, `toastDoLote`, `FRASE_FALHA_AO_LANCAR_LOTE`); padrão de diálogo:
  `components/amassa/agenda/confirmar-tirar-bloqueio.tsx` (AlertDialog, `useRef` contra toque duplo,
  erro DENTRO do diálogo com `role="alert"`, diálogo continua aberto na falha);
  e2e `tests/e2e/agenda-mensalidades-lote.spec.ts` casos (a) ~146–149, (b) ~218–222, (c) ~245–247.
- Dispensa: regra pura `podeDispensar` em `lib/agenda/receber.ts` ~393 (hoje `uso_livre` → false);
  unit em `tests/unit/agenda-receber.test.ts` ~412–425. Ação `definirDispensa` em `lib/agenda/acoes.ts`
  ~2028 (já começa por `exigirUsuario()`, trava com `travarCobranca`, recusa `!podeDispensar` com
  `FRASE_COBRANCA_SUMIU`). `gravarDispensa` em `lib/agenda/gravacao.ts` ~1249 (só mensalidade/inscrição).
  `lerUsosLivresCobrados` em `gravacao.ts` ~985 passa `dispensadaEm: null` fixo e o filtro `soLivres`
  não olha dispensa. `esquemaDefinirDispensa` em `esquemas.ts` ~515 (`tipo` só mensalidade|inscricao).
  `lerDispensadas` em `lib/agenda/consultas.ts` ~1413 (duas leituras + duas contagens;
  `DispensadaCarregada.tipo` só mensalidade|inscricao). UI: `linha-a-receber.tsx` ~65 esconde o
  botão com `linha.tipo !== "uso_livre"`; `confirmar-dispensar.tsx` (prop `tipo` só mensalidade|inscricao);
  `tituloConfirmarDispensar` e `CORPO_CONFIRMAR_DISPENSAR` em `textos.ts` ~1085–1090.
  e2e `tests/e2e/agenda-dispensar.spec.ts` caso (d) ~266 (uso livre SEM venda não tem o botão —
  continua verdade); apoio `tests/e2e/apoio/semear-agenda.ts`: `semearUsoLivreEncerrado` (~851),
  `ligarVendaACobranca({ tipo: "uso_livre", …, paga: false, cancelada: true })` (~1110),
  `dispensaNoBanco` (~1079, só mensalidade|inscricao).
- Migrações: `db/migrations/` (última `0026_agenda.sql`, journal idx 26); `npm run db:generate`
  (`drizzle-kit generate`). Prova: `scripts/testar-migracoes.mjs` (`conferirAgenda` ~4847; checks de
  dispensa de mensalidades/inscrições ~5396–5470 são o molde). Saúde: `app/api/health/agenda/route.ts`
  (três `select … limit(1)`; corpo só `{ status }`).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: caixa pública desmarcada por padrão (item 1) e confirmação do lote de mensalidades (item 3)</name>
  <files>components/amassa/agenda/folha-lancar.tsx, components/amassa/agenda/lote-de-mensalidades.tsx, components/amassa/agenda/confirmar-lancar-lote.tsx, lib/agenda/textos.ts, tests/unit/agenda-receber.test.ts, tests/unit/agenda-esquemas.test.ts, tests/e2e/agenda-lancamento.spec.ts, tests/e2e/agenda-turma.spec.ts, tests/e2e/agenda-no-site.spec.ts, tests/e2e/site-agenda.spec.ts, tests/e2e/agenda-mensalidades-lote.spec.ts</files>
  <behavior>
    - tituloConfirmarLote(1) = "Lançar 1 venda?"; tituloConfirmarLote(4) = "Lançar 4 vendas?"
    - rotuloConfirmarLote(1) = "Lançar 1 venda"; rotuloConfirmarLote(20) = "Lançar 20 vendas"
    - corpoConfirmarLote(4, "R$ 900,00") contém "4 vendas", "R$ 900,00" e diz que desfazer é cancelar uma a uma no Caixa; corpoConfirmarLote(1, "R$ 320,00") fala de "1 venda" no singular
    - esquemaLancarAvulsa sem a chave `publico` → falha; esquemaLancarTurma sem `publica` → falha (o lançamento nunca fica público por omissão)
  </behavior>
  <action>
**Item 1 (decisão 1 do dono, 02/10/2026; refina o padrão “marcada por padrão (herdado)” da linha
“Turma/Aula — público” do 05-UI-SPEC):**
- Em `folha-lancar.tsx`, o estado `publico` da folha passa a começar em `false` (troque o valor
  inicial do `useState` dessa linha). Acima dela, um comentário em português: “Desmarcada por padrão
  — decisão do dono no chat, 02/10/2026 (VERIFICACAO-COWORK-05 §2 item 1): lançamento sem escolha
  explícita não vai para o site.” Não mexa em `campos-turma.tsx` (só recebe a prop) nem em
  `folha-turma.tsx` (edita o valor que a turma já tem).
- **Não** acrescente `.default(...)` aos booleanos `publico`/`publica` de `lib/agenda/esquemas.ts`: a
  ausência continua sendo erro. **Não** crie migração para o default `true` de `turmas.publica`.
  Ele nunca é usado pela aplicação, porque o único `insert(turmas)` (`lib/agenda/acoes.ts` ~410) grava
  `dados.publica`, validado como booleano obrigatório. O pedido proíbe migração nesse caso.
  Registre isso no SUMMARY, com essa evidência.
- Em `tests/unit/agenda-esquemas.test.ts`, acrescente dois casos: `esquemaLancarAvulsa` sem
  `publico` e `esquemaLancarTurma` sem `publica` falham. Monte a entrada a partir de uma entrada
  válida que o arquivo já use e remova só a chave.
- e2e (só editar; rodam na Tarefa 3):
  - `agenda-lancamento.spec.ts` (primeiro caso): o comentário de padrões passa a dizer “público
    DESmarcado (decisão do dono de 02/10/2026)”; a asserção da caixa passa a `aria-checked` `"false"`;
    não toque na caixa; na conferência do banco, `publico: false`. É a prova de ponta a ponta de que
    “sem escolha, não é público”.
  - `agenda-turma.spec.ts` caso (a): a asserção da caixa passa a `"false"`; logo depois, clique em
    `lancar-publico` e confira `"true"` antes de gravar. As conferências `publica: true` e
    `publico: true` ficam, e provam que a escolha explícita chega à turma e às datas.
  - `agenda-no-site.spec.ts` caso (a): antes de `lancar-gravar`, clique em `lancar-publico` e
    confira `aria-checked` `"true"`.
  - `site-agenda.spec.ts` `lancarOficina`: inverta a lógica. Com `publica` true, clique na caixa e
    confira `"true"`; com false, só confira `"false"`, sem clicar.
  - Procure outros lançamentos pela tela que esperam evento público:
    `grep -rn "lancar-gravar" tests/e2e`. Os conhecidos são os quatro acima, mais `agenda-uso-livre`,
    que lança uso livre e fechado e não tem a caixa. Ajuste qualquer outro que apareça.

**Item 3 (decisão 3 do dono, 02/10/2026; AGE-16):**
- Em `lib/agenda/textos.ts`, junto dos textos do lote (~1052), crie três funções, com
  singular de verdade para 1, como as vizinhas:
  - `tituloConfirmarLote(quantas)`;
  - `rotuloConfirmarLote(quantas)`;
  - `corpoConfirmarLote(quantas, total)`. No plural, diga quantas vendas (uma por mensalidade), o
    total, que cada uma tem a parcela em aberto vencendo no dia da turma, e que desfazer é cancelar
    uma a uma no Caixa. Use texto humano, em português, sem jargão.
  O botão de voltar reaproveita `ROTULO_VOLTAR` (“Voltar”), que já existe.
- Crie `components/amassa/agenda/confirmar-lancar-lote.tsx` no molde de
  `confirmar-tirar-bloqueio.tsx`:
  - recebe `ids`, `quantas` e o total já formatado;
  - o gatilho é o próprio botão primário atual, com o mesmo `data-testid="lote-lancar"`, as mesmas
    classes (44px, terracota, `whitespace-normal`) e o mesmo texto `rotuloDoBotaoDoLote`;
  - `AlertDialogContent` com `data-testid="confirmar-lote"`; título `tituloConfirmarLote` e
    descrição `corpoConfirmarLote`;
  - botão de confirmar `confirmar-lote-sim` com `rotuloConfirmarLote`, e `ROTULO_LANCANDO_LOTE`
    enquanto grava; botão de voltar `confirmar-lote-nao`;
  - em voo: `useRef` contra o toque duplo, os dois botões desabilitados, `aria-busy` e
    `preventDefault` no confirmar, para o diálogo não fechar antes da resposta;
  - sucesso: os mesmos toasts de hoje (`toastDoLote`, ou `fraseCorridaDoLote` quando `jaLancadas > 0`)
    e o diálogo fecha;
  - recusa ou falha (`FRASE_FALHA_AO_LANCAR_LOTE` no catch): a frase vai DENTRO do diálogo
    (`confirmar-lote-erro`, `role="alert"`) e o diálogo continua aberto, como nos outros
    confirmar-*.tsx.
- `lote-de-mensalidades.tsx` passa a renderizar `ConfirmarLancarLote` no lugar do botão e perde a
  função `lancar` e o `<p data-testid="lote-erro">`; a frase de erro mora no diálogo. Atualize o
  comentário do componente: “Um toque abre a confirmação (decisão do dono, 02/10/2026); só o
  confirmar cria as vendas.” O `<details open>`, a lista e a dica não mudam.
- Unit: em `tests/unit/agenda-receber.test.ts`, ao lado dos testes de `rotuloDoBotaoDoLote` (~396),
  os casos do `<behavior>` para as três funções novas.
- e2e `agenda-mensalidades-lote.spec.ts`:
  - (a): depois de clicar em `lote-lancar`, confira o título `tituloConfirmarLote(4)` e o corpo
    contendo `formatarReais(90000)` em `confirmar-lote`, depois clique em `confirmar-lote-sim`; o resto
    não muda.
  - (b): nas duas abas, `lote-lancar` e depois `confirmar-lote-sim`.
  - (c): clique em `lote-lancar`, confira “Lançar 1 venda?” e clique em `confirmar-lote-nao`. Confira
    que `vendasDoCliente` desse cliente segue vazio e que `lote-mensalidades` continua na tela. Só
    então clique em `lote-lancar` de novo e confirme; o toast no singular fica como está.
  - Importe as funções novas de `@/lib/agenda/textos`.
  </action>
  <verify>
    <automated>npm run verificar</automated>
    <automated>grep -n "\[publico, setPublico\] = useState(false)" components/amassa/agenda/folha-lancar.tsx</automated>
    <automated>grep -n "lancarMensalidadesEmLote" components/amassa/agenda/confirmar-lancar-lote.tsx</automated>
    <automated>grep -n "confirmar-lote-sim" tests/e2e/agenda-mensalidades-lote.spec.ts</automated>
  </verify>
  <done>`npm run verificar` verde, com os unit novos de texto do lote e de esquema passando. A folha
  “Lançar na agenda” começa com a caixa pública desmarcada. O lote só lança pelo botão de confirmar do
  diálogo. Os cinco specs e2e estão editados para a nova regra (rodam na Tarefa 3). Nenhuma migração
  criada. Commit local: `feat(agenda): caixa pública desmarcada por padrão e confirmação do lote (quick 261002-sdt)`.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Checkpoint: a migração 0027 do item 2 (one-way) — escrever agora ou adiar</name>
  <decision>Item 2 (Dispensar uso livre com venda cancelada) precisa de uma migração nova, a 0027. Escrever agora (não aplicada) ou adiar?</decision>
  <context>
Para usar “a mesma mecânica/estado Dispensadas das outras cobranças” (quem, quando, motivo opcional,
desfazer, nada apagado), o uso livre precisa das colunas `dispensada_em`, `dispensada_por` e
`motivo_dispensa`. Hoje elas só existem em `mensalidades` e `inscricoes` (`db/schema.ts`, `usosLivres`
~1988: não há nenhuma coluna de dispensa). Nenhuma coluna existente serve sem gambiarra: apagar o
vínculo da venda devolveria a cobrança a “A receber”, e mudar o enum de estado também é migração.

O que a migração seria: aditiva. Três colunas que aceitam nulo em `usos_livres` e três checks:
- `usos_livres_dispensada_por`: quem dispensou é obrigatório;
- `usos_livres_motivo_so_com_dispensa`: motivo só com dispensa, até 200 caracteres;
- `usos_livres_dispensa_so_com_venda`: só encerrado e com venda ligada.
Ela é escrita e provada no `test:migracoes` local, e **não aplicada**.

Custo: a próxima publicação deixa de ser um push simples e vira o Roteiro 18 (backup → push →
`implantar` verde → `db:migrate` logo depois → `/api/health/agenda` 200), como a D-15. Entre o
`implantar` e o `db:migrate`, reservar uso livre e abrir “A receber” falham, porque o Drizzle lista as
colunas novas, e `/api/health/agenda` fica 503 até a migração. A D-09 já classificava colunas assim
como one-way. O pedido desta tarefa dizia “evitar migração” ao falar do item 1, e aquele item
realmente não precisa (Tarefa 1).

As Tarefas 1 e 3 (itens 1 e 3 e as notas) não dependem desta escolha.
  </context>
  <options>
    <option id="migracao-0027">
      <name>Escrever a 0027 agora, não aplicada (recomendado)</name>
      <pros>Entrega a decisão do dono inteira. Mesmo desenho das dispensas existentes; nada apagado. Coluna aditiva e que aceita nulo: reverter é um `drop column` numa migração futura. O dono aplica quando publicar, pelo Roteiro 18, com backup, olhando.</pros>
      <cons>Publicar passa a pedir backup + db:migrate, com a janela da D-15 (reservar uso livre e “A receber” fora do ar entre o implantar e o migrate). Mais uma migração no histórico.</cons>
    </option>
    <option id="adiar-item-2">
      <name>Adiar o item 2</name>
      <pros>Itens 1 e 3 publicam com um push simples, sem migração nem janela.</pros>
      <cons>Todo uso livre cuja venda for cancelada no Caixa continua para sempre em “A receber” até a 0027 existir. Isso vale também para o uso livre de teste do Cowork, se a venda paga dele for cancelada. A decisão do dono fica registrada como pendente.</cons>
    </option>
  </options>
  <resume-signal>Responda "migracao-0027" ou "adiar-item-2"</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: regra pura, migração 0027 (não aplicada) e servidor do “Dispensar” do uso livre (item 2)</name>
  <reversibility rating="one-way">Colunas novas em usos_livres por migração que o dono aplica em produção; desfazer pede outra migração (drop column), como a D-09.</reversibility>
  <files>lib/agenda/receber.ts, tests/unit/agenda-receber.test.ts, db/schema.ts, db/migrations/0027_dispensa-do-uso-livre.sql, db/migrations/meta/_journal.json, db/migrations/meta/0027_snapshot.json, scripts/testar-migracoes.mjs, lib/agenda/gravacao.ts, lib/agenda/esquemas.ts, lib/agenda/acoes.ts, lib/agenda/textos.ts, app/api/health/agenda/route.ts</files>
  <behavior>
    - podeDispensar({ tipo: "uso_livre", situacao: "venda_cancelada" }) = true
    - podeDispensar({ tipo: "uso_livre", situacao: "a_receber" }) = false (sem venda: “Recebi agora” ou “Lançar na Venda”)
    - podeDispensar uso_livre com "lancado", "pago" ou "dispensada" = false
    - mensalidade e inscrição: comportamento atual inalterado (a_receber e venda_cancelada → true; o resto → false)
  </behavior>
  <action>
**Só se o checkpoint respondeu `migracao-0027`.** Se respondeu `adiar-item-2`, pule esta tarefa
inteira e registre no SUMMARY: “Tarefa 2 não executada por decisão do dono no checkpoint”.

Esta tarefa implementa a decisão 2 do dono (02/10/2026), que refina a D-09.

1. **Regra pura (RED primeiro).**
   - Em `tests/unit/agenda-receber.test.ts`, o `describe` de `podeDispensar` (~412) muda de título
     para dizer que o uso livre só se dispensa com a venda cancelada (decisão do dono, 02/10/2026).
     O caso atual “uso_livre a_receber → false” fica; acrescente os casos do `<behavior>`. Rode e
     veja falhar.
   - Depois, em `lib/agenda/receber.ts` `podeDispensar`: `uso_livre` → `situacao === "venda_cancelada"`.
     O resto não muda. Reescreva o comentário acima da função citando D-09 + “decisão do dono no
     chat, 02/10/2026”.
2. **Esquema e migração.**
   - Em `db/schema.ts`, `usosLivres` ganha `dispensadaEm` (timestamp com fuso), `dispensadaPor`
     (uuid, referência a `usuarios.id`, sem on delete, como em `mensalidades`) e `motivoDispensa`
     (text), copiando as definições de `mensalidades` (~1949–1951).
   - Ganha também três checks:
     - `usos_livres_dispensada_por`: `dispensada_em` nulo ou `dispensada_por` preenchido;
     - `usos_livres_motivo_so_com_dispensa`: a mesma expressão de `mensalidades_motivo_so_com_dispensa`;
     - `usos_livres_dispensa_so_com_venda`: `dispensada_em` nulo, ou `estado = 'encerrado'` e
       `documento_id` preenchido.
   - Comente o bloco: “dispensa do uso livre só com a venda cancelada — decisão do dono, 02/10/2026;
     a venda cancelada é conferida pela ação sob trava, o check garante que há venda”.
   - **Não** mude o default de `turmas.publica` aqui (Tarefa 1).
   - Gere com `npx drizzle-kit generate --name dispensa-do-uso-livre`; deve sair
     `0027_dispensa-do-uso-livre.sql`, o snapshot e a entrada no journal. Confira o SQL: só
     `add column` e `add constraint`, nada de `drop`. Se o drizzle-kit fizer pergunta interativa ou
     gerar outra coisa, pare e registre no SUMMARY.
   - No topo do `.sql`, acrescente o comentário: “NÃO APLICAR sem o Roteiro 18 (backup antes)”.
   - **Não** rode `db:migrate` em banco nenhum fora dos efêmeros dos testes.
3. **Prova da migração** em `scripts/testar-migracoes.mjs`. No molde dos casos de dispensa de
   mensalidades e inscrições (~5396–5470), dentro de `conferirAgenda` ou numa função
   `conferirDispensaDoUsoLivre` chamada logo depois dela (~5705):
   - um caso 23514 por check novo, conferindo o nome da restrição, entre `begin` e `rollback`:
     dispensa sem `dispensada_por`; motivo sem dispensa; motivo com 201 caracteres; dispensa em uso
     reservado; dispensa em uso encerrado sem `documento_id`;
   - um caso aceito: uso encerrado com documento e dispensa completa.
   Para semear o documento, reaproveite os ajudantes da Agenda que o arquivo já tem; o dado de prova
   sai pelo caminho de limpeza existente. `TABELAS_ESPERADAS` não muda (nenhuma tabela nova): diga
   isso no SUMMARY. Procure qualquer número fixo de migrações ou “última = 0026” no script e atualize.
4. **Escrita e leitura no servidor.**
   - `lib/agenda/gravacao.ts` `lerUsosLivresCobrados`: selecione `usosLivres.dispensadaEm` e passe
     o valor real a `vendaLigada`, no lugar do `null` fixo. No filtro `soLivres`, acrescente
     `isNull(usosLivres.dispensadaEm)`, como as inscrições fazem.
   - `gravarDispensa` aceita `tipo: "uso_livre"` e faz o `update` em `usosLivres`, com os mesmos
     valores, incluindo `atualizadoEm`.
   - `lib/agenda/esquemas.ts` `esquemaDefinirDispensa`: `tipo` aceita `"uso_livre"`.
5. **Ação `definirDispensa`** (`lib/agenda/acoes.ts` ~2028). `exigirUsuario()` continua a primeira
   instrução e a trava continua a mesma.
   - Antes da recusa genérica `!podeDispensar`, se `cobranca.tipo === "uso_livre"` e a situação é
     `a_receber`, recuse com uma frase nova em `textos.ts`, por exemplo `FRASE_USO_LIVRE_SEM_VENDA_CANCELADA`:
     “O uso livre só se dispensa depois que a venda dele for cancelada no Caixa. Sem venda, use
     “Recebi agora” ou “Lançar na Venda”.”
   - Venda ativa continua recusando com `fraseJaLancado`.
   - O desfazer de um uso livre dispensado limpa as três colunas, e ele volta para “A receber” com a
     etiqueta da venda cancelada.
   - Atualize o comentário da ação (“Só mensalidade e inscrição…”) para incluir o uso livre com
     venda cancelada.
6. **Saúde.** Em `app/api/health/agenda/route.ts`, acrescente
   `db.select({ dispensa: usosLivres.dispensadaEm }).from(usosLivres).limit(1)`. A rota fica 503
   até a 0027 ser aplicada; é o sinal do Roteiro 18.
   - Ajuste o `motivo` fixo para mencionar “0026 ou 0027” e o comentário do topo.
   - O corpo continua só `{ status }` no sucesso.
7. Commits locais separados:
   - (a) `feat(agenda): migração 0027 — dispensa do uso livre (versionada, não aplicada)`, com
     schema, sql, meta e testar-migracoes;
   - (b) `feat(agenda): dispensar uso livre com venda cancelada — regra e servidor`.
  </action>
  <verify>
    <automated>npm test -- agenda-receber</automated>
    <automated>npm run verificar</automated>
    <automated>grep -n "dispensada_em\|dispensa_so_com_venda" db/migrations/0027_dispensa-do-uso-livre.sql</automated>
    <automated>grep -n "usosLivres.dispensadaEm" lib/agenda/gravacao.ts app/api/health/agenda/route.ts</automated>
  </verify>
  <done>Os unit de `podeDispensar` cobrem os quatro casos do uso livre e passam. A 0027 está versionada
  e provada por `test:migracoes` (cinco recusas 23514 com o nome certo e um aceite), e **não está
  aplicada** em lugar nenhum. `definirDispensa` aceita o uso livre só com a venda cancelada e recusa
  sem venda com frase humana. `/api/health/agenda` passa a exigir a coluna nova. `npm run verificar`
  está verde.</done>
</task>

<task type="auto">
  <name>Tarefa 3: “Dispensar” do uso livre na tela e em “Dispensadas”, a única passada e2e, e as notas datadas</name>
  <files>lib/agenda/consultas.ts, components/amassa/agenda/linha-a-receber.tsx, components/amassa/agenda/confirmar-dispensar.tsx, components/amassa/agenda/dispensadas.tsx, lib/agenda/textos.ts, tests/e2e/agenda-dispensar.spec.ts, tests/e2e/apoio/semear-agenda.ts, docs/operacao/18-migracao-dispensa-do-uso-livre.md, .planning/phases/05-agenda/05-CONTEXT.md, .planning/phases/05-agenda/05-UI-SPEC.md, .planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md, .planning/STATE.md, .planning/PROXIMA-SESSAO.md</files>
  <action>
Os passos A e B só valem com `migracao-0027`. Os passos C, D e E valem sempre; com `adiar-item-2`,
eles registram o item 2 como pendente, dizendo por quê.

**A. Tela do item 2 (decisão 2 do dono, 02/10/2026).**
- `lib/agenda/consultas.ts` `lerDispensadas`:
  - terceira leitura, de `usosLivres` dispensados sem venda ATIVA: `isNotNull(usosLivres.dispensadaEm)`
    e `or(isNull(usosLivres.documentoId), isNotNull(documentos.canceladoEm))`, com `innerJoin` em
    `clientes` e em `usuarios` por `dispensadaPor`, `leftJoin` em `documentos`, e a mesma ordem e o
    mesmo `limit(quantas)`;
  - terceira contagem;
  - a mistura continua por `ordenarDispensadas` e o corte em `quantas`;
  - a descrição vem de `descricaoDaLinha({ tipo: "uso_livre", horas, pessoas, data })`;
  - `DispensadaCarregada.tipo` passa a aceitar `"uso_livre"`;
  - atualize o comentário (“Duas leituras” → “Três”).
- `linha-a-receber.tsx`: o botão passa a depender só de `linha.podeDispensar`. Tire a exclusão por
  tipo; a regra mora em `podeDispensar`. Atualize o comentário (~27).
- `confirmar-dispensar.tsx` e `dispensadas.tsx` aceitam `tipo: "uso_livre"`.
- `textos.ts`:
  - `tituloConfirmarDispensar` ganha o caso do uso livre: “Dispensar o uso livre de {nome}?”;
  - o corpo do uso livre diz que a cobrança sai de “A receber”, que a venda cancelada continua no
    Caixa, e que dá para desfazer em “Dispensadas”. Pode ser uma função `corpoConfirmarDispensar(tipo)`
    que mantém o texto atual para mensalidade e inscrição.
- Confira `folha-uso-livre.tsx` e `ficha-pessoa.tsx`: um uso livre encerrado e dispensado deve mostrar
  a etiqueta “dispensada” (`TAG_DISPENSADA`), nunca “a receber”. Corrija se não mostrar.
- Rode `npm run verificar`.

**B. e2e do item 2 e Roteiro 18.**
- `tests/e2e/apoio/semear-agenda.ts` `dispensaNoBanco`: aceita `"uso_livre"` (tabela `usos_livres`).
- `tests/e2e/agenda-dispensar.spec.ts`:
  - o comentário do topo (~30) e o título do caso (d) passam a dizer “o uso livre SEM venda não tem
    Dispensar”; as asserções do (d) continuam.
  - caso novo (f), com `semearCliente`, `semearUsoLivreEncerrado` e
    `ligarVendaACobranca({ tipo: "uso_livre", id, valorCentavos, data: hojeNoAtelie(), paga: false, cancelada: true })`:
    - a linha `uso_livre` tem `tag-venda-cancelada` e `dispensar` visível;
    - dispensa com motivo: o título confere com `tituloConfirmarDispensar("uso_livre", nome)`, depois
      `confirmar-dispensar-sim`;
    - a linha sai de “A receber”; em “Dispensadas” aparecem quem e o motivo;
    - `dispensaNoBanco("uso_livre", id)` dá `{ existe: true, dispensada: true }`;
    - “Desfazer” em “Dispensadas” devolve a linha com a etiqueta da venda cancelada.
  - Use `hojeNoAtelie()` para o “hoje”, nunca `toISOString()`.
- `docs/operacao/18-migracao-dispensa-do-uso-livre.md`, curto, no molde do
  `17-migracao-agenda.md`. Leia o 17 e copie os comandos de backup, publicação e `db:migrate` exatos
  dele, trocando a migração:
  - antes: guarda “a plataforma continua fora de uso real hoje?” e backup;
  - publicar: `git push`, esperar o `implantar` verde, `db:migrate` logo em seguida;
  - conferir: `/api/health/agenda` 200, e um SQL que mostra as três colunas e os três checks em
    `usos_livres`;
  - a janela: entre o implantar e o migrate, reservar uso livre e “A receber” falham, e a saúde
    fica 503;
  - desfazer: o que fazer se precisar voltar.
  Copie o roteiro para `Claude outputs/agenda/` (fora do git, cópia de leitura, como o 17).

**C. A ÚNICA invocação e2e desta tarefa (e do plano)**, cobrindo todo spec tocado:
`npm run test:e2e -- --grep "agenda-lancamento|agenda-turma|agenda-no-site|agenda-mensalidades-lote|agenda-dispensar|agenda-saude|site-agenda"`.
Com `adiar-item-2`, tire `agenda-dispensar|agenda-saude` do padrão.
- Se falhar, corrija a causa e rode de novo só o que falhou.
- Se precisar da suíte inteira para diagnosticar, rode, conforme a regra do CLAUDE.md.
- Registre no SUMMARY todo comando e2e que rodou de fato, com o resultado.
- Nunca `npm run build` separado.

**D. Notas datadas.** Preserve o texto antigo; cada nota diz a evidência: “decisão do dono no chat,
02/10/2026, depois de `Claude outputs/agenda/VERIFICACAO-COWORK-05.md` §2”.
- `05-CONTEXT.md`:
  - logo abaixo da D-09, uma linha em itálico: “*Nota de 02/10/2026 — decisão do dono no chat: o uso
    livre encerrado também se dispensa, só quando a venda dele estiver cancelada (VERIFICACAO-COWORK-05
    §2 item 2); colunas na 0027, quick 261002-sdt.*” Com `adiar-item-2`, a nota diz “decidido;
    adiado no quick 261002-sdt porque exige a migração 0027”.
  - uma subseção nova antes de “### Claude's Discretion”: “### Ajustes do dono depois da verificação
    do Cowork (02/10/2026, no chat)”, com os três itens, as palavras dele entre aspas, o que mudou e
    os commits.
- `05-UI-SPEC.md`: nota datada na linha “Turma/Aula — público” (~426, “marcada por padrão”), na
  “A receber — lote” (~403, a confirmação nova e os textos) e na “A receber — linha” (~402, “só
  mensalidade e inscrição — D-09”).
- `05-VERIFICACAO-HUMANA.md`, a caminhada do dono, ainda pendente:
  - na ~529 (“🔴 a caixa … vem MARCADA”), nota datada: em produção a caixa continua marcada até a
    publicação deste quick; depois dela vem desmarcada;
  - no passo do lote (~826): depois da publicação, o toque abre “Lançar 1 venda?” antes de lançar;
  - copie o arquivo atualizado para `Claude outputs/agenda/05-VERIFICACAO-HUMANA.md`.

**E. Estado** (regra do CLAUDE.md: documento de estado desatualizado é defeito).
- `.planning/STATE.md`, à mão, sem `gsd-tools state`:
  - em Pending Todos, o item “Decisões do dono antes de a Agenda virar real” ganha, no começo, a
    data e o que foi feito: decididas no chat em 02/10/2026; os itens 1 e 3 implementados no quick
    261002-sdt; o item 2 implementado com a 0027 não aplicada, ou adiado. Diga o que falta: push, e
    o Roteiro 18 se houver 0027. Não apague o texto antigo.
  - Não mexa na tabela de quick tasks nem no frontmatter; isso é do orquestrador.
- `.planning/PROXIMA-SESSAO.md`: as linhas ~17 e ~19 falam das “duas decisões do Cowork” como
  pendentes do Theo. Elas viram “decididas em 02/10 e implementadas, não publicadas”, e o “Próximo”
  ganha “publicar: push simples” ou “Roteiro 18”. Use o padrão “*Até 02/10/2026 esta linha dizia…*”.
- Fora do git, com o mesmo conteúdo curto: `ESTADO-ATUAL.md` e `Claude outputs/RETOMAR-AQUI.md`.
  Em `Claude outputs/FILA-DO-CODE.md`, só se houver item para isto; nesse caso, ✅ com data.
- Toda afirmação diz como se sabe: o hash do commit; `git log origin/main..main` mostrando os
  commits não publicados; a 0027 “versionada, não aplicada” porque nenhum `db:migrate` rodou fora
  dos bancos efêmeros.
- Commit local: `docs(agenda): decisões do dono de 02/10 registradas (quick 261002-sdt)`. Sem push.
  </action>
  <verify>
    <automated>npm run verificar</automated>
    <automated>npm run test:e2e -- --grep "agenda-lancamento|agenda-turma|agenda-no-site|agenda-mensalidades-lote|agenda-dispensar|agenda-saude|site-agenda"</automated>
    <automated>grep -n "02/10/2026" .planning/phases/05-agenda/05-CONTEXT.md</automated>
    <automated>git log origin/main..main --oneline</automated>
  </verify>
  <done>
- Com `migracao-0027`: o uso livre com venda cancelada se dispensa pela tela, aparece em
  “Dispensadas” e volta pelo “Desfazer”; o uso livre sem venda não tem o botão; o Roteiro 18 existe.
- A passada e2e única está verde para os specs tocados, e os comandos rodados estão registrados no
  SUMMARY.
- 05-CONTEXT, 05-UI-SPEC, 05-VERIFICACAO-HUMANA, STATE (Pending Todos), PROXIMA-SESSAO,
  ESTADO-ATUAL e RETOMAR-AQUI estão atualizados com nota datada e evidência; o texto antigo foi
  preservado.
- Tudo commitado localmente; nada publicado, nenhuma migração aplicada.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → Server Action (`definirDispensa`, `lancarTurma`, `lancarAvulsa`, `lancarMensalidadesEmLote`) | entrada não confiável; o estado da tela pode estar velho (outro celular) |
| gestão → site público | o que está marcado como público vai para a raiz, sem login, com o WhatsApp real |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-sdt-01 | Information disclosure | `folha-lancar.tsx` → `eventos.publico` / `turmas.publica` → site | medium | mitigate | Caixa começa desmarcada (Tarefa 1). Zod continua exigindo o booleano (sem default no servidor). O e2e `agenda-lancamento` prova que lançar sem tocar grava `publico = false` |
| T-sdt-02 | Tampering | `definirDispensa` com `tipo: "uso_livre"` forjado para um uso sem venda ou com venda ativa | medium | mitigate | `exigirUsuario()` na primeira linha. Situação relida sob `travarCobranca` (`for no key update`). Venda ativa → `fraseJaLancado`; sem venda → frase nova. Check `usos_livres_dispensa_so_com_venda` no banco, provado por `test:migracoes` |
| T-sdt-03 | Repudiation | dispensa do uso livre | low | mitigate | `dispensada_por` obrigatório (check `usos_livres_dispensada_por`) e `dispensada_em`. A linha nunca se apaga (só `update`) |
| T-sdt-04 | Tampering | motivo da dispensa | low | mitigate | Zod `max(200)` existente + check `usos_livres_motivo_so_com_dispensa` |
| T-sdt-05 | Denial of service (dado) | lote cria N vendas num toque | low | mitigate | Diálogo de confirmação com quantas e total; `useRef` + `disabled` contra o toque duplo. A corrida já é tratada pelo servidor (pula e conta) |
| T-sdt-06 | Tampering | migração 0027 em produção | medium | mitigate | Não aplicada pelo executor. Roteiro 18 com backup antes e `/api/health/agenda` 503 até ela existir; aplicação só pelo dono (CLAUDE.md: Migrações) |
</threat_model>

<verification>
- `npm run verificar` verde ao fim de cada tarefa (lint, tsc, verificar-acoes, unit, test:migracoes).
- Uma única invocação e2e, na Tarefa 3, com `--grep` nos specs tocados. Sem varredura completa: é um
  quick, não o último plano de uma fase.
- `git log origin/main..main` mostra os commits do quick e nada foi publicado.
- Nenhum `db:migrate` fora dos bancos efêmeros de teste.
</verification>

<success_criteria>
- Lançar turma ou oficina sem tocar na caixa não publica nada no site.
- O lote de mensalidades só cria vendas depois de “Lançar N vendas?”.
- Com `migracao-0027`: o uso livre com venda cancelada se dispensa e se desfaz, e nada é apagado.
  Com `adiar-item-2`: a pendência fica registrada com o motivo.
- As decisões do dono de 02/10/2026 estão registradas com nota datada em 05-CONTEXT.md, e os
  documentos de estado estão corrigidos.
</success_criteria>

<output>
Crie `.planning/quick/261002-sdt-agenda-decisoes-do-cowork/261002-sdt-SUMMARY.md` ao terminar, com:
- a resposta do checkpoint;
- os commits;
- os comandos e2e rodados de fato;
- “turmas.publica mantém default true no banco — nenhum escritor depende dele (evidência:
  `lib/agenda/acoes.ts` insert único + Zod obrigatório)”;
- “TABELAS_ESPERADAS não mudou”;
- “## Decidido sem o Theo”: textos dos diálogos, nomes dos checks, número do roteiro;
- o que o dono faz para publicar: push simples, ou o Roteiro 18.
</output>
