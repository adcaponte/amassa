---
phase: 05-agenda
plan: 16
status: awaiting-owner
started: 2026-10-02
updated: 2026-10-02  # Parte 0 respondida pelo dono em 02/10/2026
---

# Verificação Humana — Fase 5: Agenda

**Gerado por:** execução do plano `05-16-PLAN.md`, Tarefa 1, em 02/10/2026 — com você fora.

**Status (02/10/2026, ~14h30 UTC): falta só a Parte 2, no seu celular.** A Parte 0 foi respondida e o Roteiro 17 feito: código no ar desde o run `36959745229` (implantar 03:46 UTC), `0026` aplicada por você (~10h30 UTC), `/api/health/agenda` 200; as correções da revisão de código no ar pelo run `37013475323` (13:59 UTC). O Cowork caminhou 22 passos em produção sem nenhum 🔴 (`Claude outputs/agenda/VERIFICACAO-COWORK-05.md`) — ficam com você o C.1 com cronômetro, o lado positivo do critério 8 (uma oficina pública real no site) e as D.1–D.53.

*Até ~14h30 UTC de 02/10/2026 este parágrafo dizia o que vem a seguir — verdade quando foi escrito (~01h15 UTC), hoje registro:* **Status (02/10/2026): aguardando você** — *Parte 0 respondida em 02/10/2026 (ver o quadro no topo da Parte 0); falta o Roteiro 17 e a Parte 2.* Nada da Fase 5 está no ar. O código inteiro mora no branch
local `gsd/phase-05-agenda`, **não publicado**; a migração `0026_agenda.sql` (só acrescenta: oito
tabelas, três colunas vazias, um valor de enum, a semente de três itens do Catálogo) está escrita e
provada no Postgres de teste, mas **não aplicada** em lugar nenhum; nenhum requisito AGE foi marcado
cumprido. Esta fase fecha por esta caminhada, não por contagem de planos.

**São três partes, nesta ordem, sem pular:**

1. **Parte 0 — antes do servidor** (dá para ler deitado): as decisões tomadas sem você, cada uma com
   "como desfazer", e a conferência do número do WhatsApp do site. Uma troca aqui é barata; depois do
   Roteiro 17 algumas ficam caras.
2. **Parte 1 — o servidor:** o Roteiro 17 (`docs/operacao/17-migracao-agenda.md`) — guarda e "fora de
   uso real", contagem antes, backup, publicar, esperar o `implantar`, migrar logo em seguida (D-15),
   conferir. Aqui você só registra o que cada passo mostrou.
3. **Parte 2 — o celular, no ateliê:** os 9 critérios do ROADMAP, a presença de uma turma inteira com
   cronômetro (o valor central), o site numa janela anônima, e as 50 conferências que só um celular de
   verdade revela.

**Como preencher:** marque a caixa (`- [x]`) e escreva o que viu na linha **Resultado** — "ok" basta.
Se algo não passar, descreva o que apareceu na tela, sem precisar ser técnico. Caixa marcada sem
Resultado não conta como percorrida.

**Nenhum dado real de cliente em nenhum lançamento de teste** — o repositório é público, e este
documento também. Use nomes inventados com "[teste]" na frente.

> **Sobre dado de teste em produção — leia antes da Parte 2.** Na Agenda, **pessoa, turma, matrícula e
> mensalidade não se apagam** (a `0026` tira o `delete` dessas quatro tabelas até do app). Toda pessoa
> "[teste]" que você cadastrar fica em Cadastros → Clientes para sempre; toda turma de teste fica
> (desativada); toda mensalidade de teste fica (dispensada). Por isso a Parte 2 usa **poucas pessoas de
> teste** (as seis da turma do valor central, mais uma ou duas), todas com "[teste]" no nome, e a seção
> E diz como deixar tudo quieto no fim. As vendas de teste se cancelam no Caixa (ficam riscadas). As
> conferências que pedem dado extremo (nome de 160 letras, 200 pessoas, 50 e 51 clientes, 40
> mensalidades, 30 alunos) têm uma segunda opção: **(b)** pedir ao agente as capturas de tela a 320px
> ou 360px, feitas no banco de teste, e você só olha.

---

## Parte 0 — Antes do servidor: as decisões tomadas sem você

> **Respostas do dono à Parte 0 — 02/10/2026, no chat, por formulário (registradas aqui pelo executor do 05-16):**
> §0.1: o número real do WhatsApp é **`5562994817661`** — trocado no branch em `6dc5417`. §0.2 (a–u): **fica tudo**. §0.3, §0.5 (as seis UI-D e as outras) e §0.6: **fica tudo**, nenhuma troca de interface. §0.7 (as decisões de cada plano, "para você saber") não foi perguntada no formulário.
> Única mudança no código por causa da Parte 0: o número (`6dc5417`); `npm run verificar` saiu 0 depois dela, antes de qualquer passo do Roteiro 17.

**Nenhuma delas guarda dinheiro fora da Venda, apaga venda ou movimentação, ou bloqueia lista cheia**
— essas eram proibições escritas nos planos, e nenhum executor as quebrou. Mesmo assim, várias mudam
quanto se cobra, de quem e quando; estão primeiro. Onde diz **"Fica"**, marque; onde quiser trocar,
escreva no Resultado — o executor ajusta no branch e roda `npm run verificar` antes do Passo 4 do
Roteiro.

### 0.1 O número do WhatsApp do site — confirme antes de publicar

`conteudo/site.ts` tem `CONTEUDO_SITE.zap = "5562900000000"` — o número do protótipo, com cara de
inventado (o comentário no arquivo diz "placeholder do protótipo; o dono manda o número real"). Ele já
está no ar desde a Fase 04.6, no botão geral de WhatsApp do site (medido: `git show main:conteudo/site.ts`
tem a mesma linha); com esta fase ele passa a ir também em **todo "Reservar pelo WhatsApp"** de cada
aula e oficina pública (`components/site/botao-reservar.tsx`). Um visitante que toca "Reservar" num
número que não é seu não chega a ninguém.

- **Como trocar:** me diga o número (só dígitos, com 55 e DDD, ex.: `5562912345678`); é uma linha em
  `conteudo/site.ts`, sem migração, e os testes do site leem a constante.
- [x] **CONTEUDO_SITE.zap — o número real é:**
  - **Resultado:** `5562994817661` — dono, 02/10/2026, no chat (formulário). Trocado no branch em `6dc5417` (a constante, o comentário, e os testes do site passaram a conferir o link `wa.me` contra ela); `npm run verificar` verde e `npm run test:e2e -- --grep "site"` 108 passed.

### 0.2 As decisões que mudam quanto se cobra, de quem e quando

- **(a) A mensalidade que nasce ao abrir a tela (D-02) vale para quem já era aluno ANTES do dia 1**
  (plano 05-07, desvio 1 — regra de dinheiro corrigida pelo executor). O plano escrevia "até o dia 1"
  (`<=`). Com isso, quem entrasse **no dia 1** numa turma sem nenhuma aula restante no mês teria, ao
  mesmo tempo, "nenhuma mensalidade" decidida pela ação de entrar, o toast "a mensalidade começa em
  {próximo mês}" — e, na releitura da tela, a mensalidade **cheia** do mês criada sozinha. O toast
  mentiria. Agora quem entra durante o mês, inclusive no dia 1, tem a do mês decidida só pela ação de
  entrar (cheia se há aula, proporcional se faltam aulas, nenhuma se não sobra aula). **Como desfazer:**
  trocar `a.entrou_em <` por `a.entrou_em <=` em `garantirMensalidadesDoMes` (`lib/agenda/gravacao.ts`)
  — e o e2e `agenda entrar na turma` (b) passa a falhar num dia 1.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(b) Quem tem aula a repor também aparece em "qualquer pessoa" — e numa oficina pode entrar
  pagando** (plano 05-08, desvio 8, pedido pelo orquestrador). O plano dizia "quem está nos dois grupos
  aparece só no primeiro" — e aí quem tinha crédito só podia entrar numa oficina **como reposição, sem
  pagar**. O BRIEFING §4 ("primeiro quem tem aula a repor … e DEPOIS QUALQUER PESSOA (… em oficina, como
  inscrição paga)") e o protótipo decidem o contrário. Agora: escolhida em "Tem aula a repor", entra
  como reposição e gasta o crédito; escolhida no grupo de baixo, entra paga pelo preço do evento, e o
  crédito fica. **Como desfazer:** tirar quem tem saldo do grupo do contexto em `gruposDoSeletor`
  (`lib/agenda/seletor.ts`) e em `pessoasParaData` (`lib/agenda/consultas.ts`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(c) Lançar de novo uma cobrança cuja venda foi cancelada re-aponta o vínculo para a venda nova**
  (05-11, decisão 5). A cancelada continua no Caixa, riscada, mas a mensalidade (ou inscrição, ou uso)
  passa a apontar só a nova — não há histórico de vínculos. A D-08 diz que a cobrança "pode ser lançada
  de novo" e não pede histórico. **Como desfazer:** exige uma tabela de vínculos — migração nova,
  decisão sua; barato antes do Passo 5, caro depois.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(d) Na Venda que vem da Agenda, o valor (e a quantidade) da linha continuam editáveis** (05-12,
  decisão 1; UI-D26 da UI-SPEC). Pessoa, cliente e descrição o servidor sobrescreve sob a trava; o
  valor inicial vem do banco e o navegador nunca o manda — mas você pode mudá-lo na tela, como um
  desconto. **Como desfazer (se a regra for "valor fixo"):** desabilitar o campo "cada" da linha de
  origem (`fixa` em `components/amassa/financeiro/linha-carrinho.tsx`) e fazer `lancarVenda` recusar
  quando o valor difere do da cobrança.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(e) Entrar numa turma sem nenhuma aula restante no mês não cria mensalidade daquele mês** — ela
  começa no mês seguinte (planejamento, as bordas do AGE-07; contra a Assumption A7 da pesquisa).
  **Como desfazer:** em `lib/agenda/mensalidade.ts`, fazer o "nenhuma" virar "cheia".
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(f) Quem estava na turma no dia 1 e saiu depois fica com a mensalidade do mês** (planejamento; a
  leitura de "aluno ativo na abertura" do AGE-16). Ela nasce no dia 1 e não some quando a pessoa sai —
  dispense em "A receber" se não for cobrar. A confirmação de "Tirar da turma" avisa isso. **Como
  desfazer:** em `sairDaTurma` (`lib/agenda/acoes.ts`), dispensar sozinha a mensalidade do mês ainda
  sem venda.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(g) Abrir a Agenda faz nascer as mensalidades do mês de todos os alunos** (05-07 e 05-11, decisão
  1). Abrir a ficha de qualquer pessoa, "A receber", o Início — e, desde o 05-11, **qualquer carga de
  `/gestao/agenda`**, por causa do contador "A receber · {N}" da aba — cria as mensalidades do mês de
  **todos** os alunos de turmas ativas (um `insert … on conflict do nothing`). É a D-02 funcionando, não
  um efeito colateral; sem isso o contador mostraria menos do que a lista. **Como desfazer:** tirar a
  chamada de `AbasComContagem` em `app/gestao/(app)/agenda/page.tsx` (o contador volta a ficar menor
  até alguém abrir "A receber").
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(h) O lote faz uma venda por mensalidade** (planejamento, A6), e uma mensalidade dispensada no meio
  do lote (corrida) conta em "já estavam lançadas" (05-12, decisão 5). **Como desfazer:**
  `lancarMensalidadesEmLote` (`lib/agenda/acoes.ts`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(i) Oficina de preço R$ 0 é aceita e nunca entra em "A receber"** (planejamento, item 4). **Como
  desfazer:** recusar `preco < 1` em `esquemaLancarAvulsa` (`lib/agenda/esquemas.ts`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(j) A aula experimental que falta pode ganhar "direito a repor"** (planejamento, item 3; o check
  `inscricoes_direito_so_com_falta` da `0026` aceita `aluno` e `experimental`). **Como desfazer:** trocar
  `in ('aluno','experimental')` por `= 'aluno'` na `0026`, em `db/schema.ts` e no snapshot — **só antes do
  Passo 5**.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(k) Experimental "Cobrar" com R$ 0,00 é recusada** ("Diga o valor — por exemplo, 40 ou 37,50."). Quem
  não paga é "Gratuita"; uma cobrança de zero iria para "A receber" sem nada a receber (05-08, decisão
  2). **Como desfazer:** `convertido.centavos < 1` em `esquemaColocarNaData` e em `colocar-alguem.tsx`.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(l) Mensalidade proporcional que arredondaria a 0 centavo não nasce** (só com mensalidade de 1 ou 2
  centavos; 05-07, decisão 2). **Como desfazer:** `valorProporcional` em `lib/agenda/mensalidade.ts`.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(m) No uso livre, a linha de material nasce em "Incluso"** — nem a UI-SPEC nem o BRIEFING davam
  padrão; cobrar por descuido é pior que esquecer de cobrar, e cobrar custa um toque (05-10, decisão 1).
  **Como desfazer:** `useState(false)` de `cobrar` em `LinhaDeAcrescentar`
  (`components/amassa/agenda/material-do-uso-livre.tsx`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(n) A saída prevista do uso livre conta da chegada REAL** quando já houve "Chegou" (chegou 15:20 com
  2 h previstas → 17:20), nunca passa de 23:59 (05-09, decisão 2). Muda a hora cheia sugerida e, com
  ela, o valor. **Como desfazer:** `saidaPrevista(linha.chegadaPrevista, …)` em `usoLivreDaSemana` e
  `obterUsoLivre` (`lib/agenda/consultas.ts`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(o) Desativar uma turma APAGA as datas futuras dela e as inscrições dessas datas** (planejamento,
  A14), e recusa se alguma dessas datas já virou venda ativa. As datas de hoje para trás ficam. O
  executor travou as datas antes de apagar (05-06, desvio 1), para um "Colocar na lista" ao mesmo tempo
  não deixar inscrição órfã. **Como desfazer:** marcar as datas futuras como canceladas em vez de apagar
  (`tirarDatasFuturasDaTurma`, `lib/agenda/gravacao.ts`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(p) Editar horário, vagas ou "no site" de uma turma vale de amanhã em diante** (planejamento, A9);
  as datas de hoje para trás guardam o que eram. **Como desfazer:** `editarTurma` (`lib/agenda/acoes.ts`).
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(q) Sair da turma não apaga a inscrição futura que já tem presença marcada** (05-07, desvio 2): uma
  falta avisada antes ("faltou" numa data futura) carrega o direito a repor, e a proibição do plano diz
  que sair nunca apaga falta nem reposição. **Como desfazer:** tirar o `i.presenca is null` do `delete`
  em `tirarAlunoDasDatasFuturas`.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(r) A reposição também vale numa data de oficina** (planejamento, item 16, como o protótipo). **Como
  desfazer:** recusar reposição fora de data de turma em `colocarNaData`.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(s) Saldo de reposição "excedido" aparece como 0, sem aviso** — acontece quando o direito é
  desmarcado depois de a reposição ser usada, ou quando uma data cancelada com reposição é
  descancelada (05-08, decisão 3). O campo `excedido` já vem do módulo puro, se quiser um aviso.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(t) As etiquetas de pagamento** (05-13, decisões 3, 4 e 5): o "{n} a receber" do cartão conta também
  a inscrição de venda cancelada (D-08) e a experimental cobrada; a mensalidade não entra (é do aluno,
  não da data); na data de turma, o aluno mostra a etiqueta da mensalidade **do mês da data**; numa data
  cancelada, "a receber"/"venda cancelada" somem (a inscrição saiu de "A receber"), "pago" e "lançado na
  Venda" ficam. **Como desfazer:** `aReceberPorEvento`, `obterEvento` e `saiDeAReceberAoCancelar`.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **(u) "Dispensadas" não lista a inscrição de data cancelada** — desfazer a dispensa não a traria de
  volta a "A receber" (05-13, decisão 2). **Como desfazer:** tirar `isNull(eventos.canceladoEm)` em
  `lerDispensadas`.
  - [x] **Fica** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)

### 0.3 O modelo de dados — custoso de trocar depois do Passo 5

Todas do planejamento e do plano 05-01. Antes do Passo 5, cada uma se troca mudando `db/schema.ts`,
apagando a `0026` e o snapshot e gerando de novo; **depois, só com migração nova de dado**.

- **Uma migração só, `0026_agenda`, para a fase inteira** — dividir obrigaria você a aplicar várias.
- **O código no branch `gsd/phase-05-agenda` até este portão**, mesmo com a D-15: uma fase pela metade
  em `main` iria ao ar no primeiro `push`. *Desfazer:* não há o que desfazer — o Roteiro 17 integra.
- **Os nomes** de tabelas, colunas e checks (a proposta da pesquisa); o enum `presenca` se chama
  `presencaDaInscricao` no código.
- **`time` para hora de parede** (início e fim da turma e do evento, chegada e saída do uso livre);
  `timestamptz` só para os carimbos.
- **`usos_livres` em tabela própria**, e **o valor do uso livre congelado no encerramento**
  (`valor_centavos` do uso e o preço e valor de cada material) — mudar o preço da hora depois não muda
  um uso já encerrado.
- **`uso_livre` no FIM do tipo `destino_saida`** — depois de aplicado, só sai recriando o tipo.
- **O check `inscricoes_direito_so_com_falta` corrigido antes de você o ver** (05-02, desvio 1): como o
  plano 01 o escreveu, uma inscrição com "direito a repor" e presença **nunca marcada** entrava (o
  Postgres aceita check que dá nulo). Agora exige `presenca is not null and presenca = 'faltou'`.
  *Desfazer:* tirar o `presenca is not null and` nos três arquivos — e o furo volta.
- **Apagar um item do sistema como app dá "sem permissão" (42501), não a frase do gatilho** (05-02,
  decisão 2) — o `revoke delete` da `0015` barra antes. As duas camadas valem.
- **Os três itens do sistema aparecem no Catálogo com uma marca, e não se desativam** (05-02; o gatilho
  `travar_item_do_sistema` da `0026`). Nome, preço e categoria você muda à vontade.
- **A barra "Uso livre do espaço" aparece no "Para onde foi" do Estoque**, com zero até a primeira baixa
  de uso livre — sete barras com o Vendido (05-01, decisão 8). *Desfazer:* tirar `uso_livre` de
  `DESTINOS_DE_SAIDA` (aí o consumo do uso livre some do gráfico).
- **O teste `@vazio-global` do Catálogo foi reescrito** (05-01, desvio 2): depois da `0026` o Catálogo
  nunca mais está vazio (os três itens do sistema), então a tela "Nada no catálogo ainda." deixa de ser
  alcançável.

- [x] **0.3 inteira — Fica** (ou diga qual troca)
  - **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)

### 0.4 O que só produção sabe — conferido no Roteiro, não aqui

- **Itens do Catálogo com o mesmo nome dos três do sistema** ("Mensalidade", "Inscrição em oficina",
  "Uso livre (hora)") e **as categorias "Aulas e oficinas" e "Uso do espaço" desativadas**: o nome de
  item não é único, e a semente procura pelo código. O Roteiro 17, Passos 2.2 e 2.3, conta antes e diz o
  que fazer (05-01, "para o dono olhar").
- **O build da imagem baixa fontes do Google** (janela 60 do `WINDOWS.md`): o run `36802909361` (push do
  documento `b019cbb`, 01/10/2026) falhou ao montar a imagem porque o `next/font/google` não baixou a
  fonte; o run seguinte passou sem mudança. Risco de rede no build, sem relação com a Agenda — se
  acontecer no Passo 4.3, `gh run rerun <id> --failed`.

### 0.5 As escolhas de interface que você mais provavelmente queira rever

Do UI-SPEC (`05-UI-SPEC.md`, "Decisões desta UI-SPEC"). As quatro que mudam o que você faz no celular
(UI-D4, UI-D5, UI-D6, UI-D7) **você já respondeu** em 01/10/2026, todas na opção recomendada. Estas seis
foram decididas sem você:

- **UI-D9 — O botão de gravar da folha "Lançar na agenda" tem o verbo do tipo:** "Lançar turma", "Lançar
  aula", "Reservar uso livre", "Fechar o dia". Por quê: "Lançar" com a pílula errada marcada é o engano
  mais provável. **Como desfazer:** um rótulo só em `folha-lancar.tsx` (os rótulos estão em
  `lib/agenda/textos.ts`).
  - [x] **UI-D9** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **UI-D10 — Campo "Primeira aula a partir de" na turma fixa** (padrão hoje). Por quê: uma turma lançada
  em outubro para começar em dezembro marcaria oito semanas vazias de outubro e novembro. **Como
  desfazer:** tirar o campo de `components/amassa/agenda/campos-turma.tsx` (sempre a partir de hoje).
  - [x] **UI-D10** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **UI-D13 — Confirmação para cancelar reserva, tirar bloqueio, tirar da lista, tirar material, sair da
  turma e desativar turma — e para cancelar uma data SÓ quando apaga presença ou tira inscrição de "A
  receber"**; senão a data cancela direto, com "Desfazer" no toast. Por quê: a regra do projeto (toda
  remoção pede confirmação e diz o que se perde) sem quebrar o "cancela com um toque" da D-13. **Como
  desfazer:** os `confirmar-*.tsx` de `components/amassa/agenda/`.
  - [x] **UI-D13** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **UI-D14 — Com venda ativa, "tirar da lista" nem aparece;** no lugar, a frase da D-08 com "ver no
  Caixa". Por quê: um botão que só existe para ser recusado é um toque perdido (o servidor continua
  recusando, se dois celulares disputarem). **Como desfazer:** `linha-inscrito.tsx`.
  - [x] **UI-D14** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **UI-D17 — No site, o alternador "Próximas · Calendário"** com o visual do site da 04.6 (cartão com
  borda de tipo, grade, legenda; calendário e lista lado a lado a partir de 880px). **Como desfazer:**
  `components/site/agenda-publica.tsx` (só a grade, como o protótipo do site).
  - [x] **UI-D17** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)
- **UI-D19 — No Início, a Agenda de hoje mostra até 6 linhas**, cada uma abre a folha do evento (do
  Início à presença em 2 toques), com as cores de tipo da Agenda e "{n} de {vagas} inscritos". **Como
  desfazer:** `LINHAS_DA_AGENDA_DE_HOJE` em `lib/agenda/consultas.ts` e
  `components/amassa/inicio/bloco-agenda-de-hoje.tsx`.
  - [x] **UI-D19** — **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)

As outras escolhas (UI-D1..UI-D3, UI-D8, UI-D11, UI-D12, UI-D15, UI-D16, UI-D18, UI-D20..UI-D26) estão na
tabela do UI-SPEC, com a alternativa descartada ao lado.

- [x] **Quero trocar alguma das outras UI-D:**
  - **Resultado:** nenhuma troca — dono, 02/10/2026, no chat (formulário)

### 0.6 O site público — o que vai ao ar

- **A janela do calendário vai de hoje até o fim do 6º mês, contando o mês de hoje** (out/26 → mar/27;
  planejamento A11, 05-15 decisão 3). *Desfazer:* `MESES_NO_SITE` em `lib/agenda/publico/agenda.ts`.
- **Se a leitura do banco falhar, o site mostra a seção de aulas da 04.6** (sem erro na tela), e a raiz
  é revalidada a cada 5 minutos ou na hora por uma ação da Agenda (planejamento A10).
- **Na lista "Em {mês}", a turma mostra as vagas da turma menos os alunos ativos**; a lista de um dia
  mostra a lista daquela data (05-15, decisão 2). *Desfazer:* `agendaPublica`.
- **Dia da semana da oficina com maiúscula** ("Quinta, 03/12 · 14h às 17h") (05-15, decisão 4).
- **Colocar, tirar, entrar e sair só revalidam o site quando o evento ou a turma é público** — mudança
  num evento privado não muda o site (05-15, decisão 5; o plano dizia "sempre"). *Desfazer:* passar
  `{ publico: true }` nas quatro chamadas.
- **Sem JavaScript, o alternador aparece mas não troca** — o HTML já traz "Próximas" inteira (05-15,
  decisão 6). *Desfazer:* esconder o `tablist` até a hidratação.

- [x] **0.6 inteira — Fica**
  - **Resultado:** Fica — dono, 02/10/2026, no chat (formulário)

### 0.7 As decisões de cada plano da execução — para você saber

Frases e comportamentos que a UI-SPEC não fixava. Nenhuma mexe em dinheiro (as que mexem estão em 0.2).
Cada uma está no SUMMARY do plano com o "como desfazer" exato; aqui, o resumo e o arquivo.

**Plano 05-01 (traçador):**
1. Ao abrir uma data, a folha abre **na hora** com o cabeçalho e o esqueleto, e a lista entra quando o
   servidor responde (`router.push`, não `history.pushState`). *Desfazer:* `semana-da-agenda.tsx`.
2. *(Revogada pelo 05-03, item 1 abaixo: a ordem do dia por título.)*

**Plano 05-02 (itens do sistema):**
3. O rótulo da caixa é "Aparece na venda", com v minúsculo, como o resto de Cadastros. *Desfazer:*
   `ROTULO_APARECE_NA_VENDA`.

**Plano 05-03 (avulsa, fechado, semana e mês):**
4. A ordem do dia é fechado → início → título (sem acento nem caixa) → tipo. *Desfazer:* `comparar` em
   `lib/agenda/semana.ts`.
5. "Hoje" na vista Mês leva ao mês de hoje (e fica no Mês). *Desfazer:* `hrefHoje` em `VistaDoMes`.
6. Ao abrir sem `?semana=`, a rolagem até hoje é instantânea; o "Hoje" e o `#dia-` rolam suave (salvo com
   "reduzir movimento" no celular). *Desfazer:* `semana-da-agenda.tsx`.
7. O esqueleto do mês fica num `Suspense` da página (o `loading.tsx` não sabe a vista).
8. "Semana · Mês" são links com papel de aba; a semana aponta para o mês dela (o de hoje, ou o da
   quinta-feira). *Desfazer:* `hrefsDaVista`.
9. A folha do evento continua aberta depois de cancelar, mostrando "· cancelada" e "Desfazer
   cancelamento"; "Pronto" fecha. *Desfazer:* chamar `aoFechar` em `avisarCancelada`.
10. Frases: "O nome pode ter até 120 caracteres.", "O motivo pode ter até 120 caracteres.", "Não deu
    para cancelar a data. …", "Não deu para desfazer o cancelamento. …", "Não deu para tirar o
    bloqueio. …", "Tirando…", "Desfazendo…", "O dia fechado não se cancela — use "Tirar o bloqueio"."
    (`lib/agenda/textos.ts`).
11. Tirar um bloqueio que não é de fechado responde "Isso já tinha sido removido." (não revela o tipo).
12. `cancelarData` confere as perdas sob a trava: se alguém marcou presença em outro celular depois de
    você abrir a folha, a confirmação aparece com os números de agora (desvio 2).

**Plano 05-04 (clientes):**
13. Ao editar, o aviso de homônimo só aparece quando o **nome** muda para o de outro cadastro.
    *Desfazer:* `editarCliente`, tirar `&& !atual.mesmoNome`.
14. "Usar {nome} que já existe" em Cadastros fecha o formulário e **filtra a lista** por aquele nome
    (planejamento, item 14). *Desfazer:* `aoUsarExistente` em `lista-clientes.tsx`.
15. "Últimas vindas" só conta datas de hoje para trás, não canceladas. *Desfazer:* `ultimasVindas`.
16. A validação do formulário de pessoa é só do servidor (uma ida e volta e a frase embaixo do campo).
17. Frases: "Cadastro salvo.", as dicas "até 160 caracteres" e "até 40 caracteres, do jeito que você
    escreve", "Não deu para salvar. …", "Ficha da pessoa" (título quando a ficha falha), e "Ninguém com
    esse nome." + "Cadastrar "{busca}"" também em Cadastros (`lib/clientes/textos.ts`).
18. A busca de Cadastros usa o mesmo rótulo da Agenda ("Buscar pessoa" / "Buscar pelo nome").
19. No máximo 10 homônimos no aviso, os mais antigos primeiro (`TETO_DE_HOMONIMOS`).
20. As abas da Agenda são links: as setas movem o foco e o Enter navega (`abas-da-agenda.tsx`).

**Plano 05-05 (seletor e colocar alguém):**
21. "Cadastrar "…"" do seletor salva e **escolhe** a pessoa, sem colocá-la: depois aparece a faixa e
    "Colocar na lista" — um toque a mais (o mesmo seletor serve ao uso livre e à experimental, que pede
    "Cobrar · Gratuita" antes). *Desfazer:* `ColocarAlguem` chama `colocarNaData` logo depois do cadastro.
22. A caixa "A lista já está cheia…" aparece assim que a lista enche, antes de escolher a pessoa.
23. Recusa ao colocar revalida a tela; recusa ao tirar fica dentro do diálogo e a folha só se atualiza
    ao fechar.
24. `tirarDaLista` recusa data cancelada e inscrição que não é de oficina (o aluno sai pela ficha).
25. Frases: "Não deu para colocar na lista. …", "Não deu para tirar da lista. …", "Tirando…".
26. Com a busca vazia e ninguém a repor, o seletor mostra "Digite para buscar." e não lista ninguém;
    o seletor mostra **até 8 por grupo** (planejamento, item 12) e "Há mais pessoas com esse nome —
    continue digitando.".

**Plano 05-06 (turma fixa):**
27. "Turma fixa" é a **primeira** pílula da folha (como a UI-SPEC; o plano dizia terceira); a marcada por
    padrão continua "Aula ou oficina avulsa". *Desfazer:* ordem de `TIPOS` em `folha-lancar.tsx`.
28. Concordância do aviso de dia fechado: "1 das datas cai … Ela é marcada" / "{k} das datas caem …
    Elas são marcadas"; toast com uma aula só: "Turma lançada, com a próxima aula." e "Ela cai num dia
    fechado (…)" (planejamento, item 13).
29. "todo sábado" / "todo domingo" (masculino), também no site. *Desfazer:* `todoODia` em `turma.ts`.
30. "Daqui para frente" é `data > hoje` em todo lugar; a confirmação de desativar conta todas as datas
    futuras, inclusive canceladas.
31. O toast de "Salvar turma" é só "Turma salva." (a dica do formulário já diz que a mensalidade nova vale
    a partir do próximo mês).
32. Desativar com erro não revalida na hora; a frase fica no diálogo.
33. "Voltar" da folha da turma volta à data quando ela veio de uma data.
34. Frases: "Escolha o dia da semana.", "Não deu para marcar mais semanas. …", "Esta turma já foi
    desativada — a tela foi atualizada.", "1 data nova marcada, até {dd/mm}.", "Marcando…", os corpos de
    desativar com 0 ou 1 data, "(1 reposição marcada volta a ser crédito)".
35. O toast longo do dia fechado fica 8 s na tela (o padrão é 4 s). *Desfazer:* `duration` em
    `folha-lancar.tsx`.
36. Os dias no `Select` com inicial maiúscula ("Terça").

**Plano 05-07 (entrar e sair da turma):**
37. Terceiro toast: "Entrou na turma: já está nas próximas aulas. Não sobra aula da turma em {mês} — a
    mensalidade começa em {próximo mês}."; e um quarto, para quem saiu e voltou no mesmo mês: "… A
    mensalidade de {mês} já existia e continua como estava.".
38. O corpo de "Tirar da turma" segue a quantidade de aulas e só fala da mensalidade quando ela existe,
    não foi dispensada e não virou venda.
39. "ver turma" na aba Pessoas abre a folha da turma; "Voltar" e o X devolvem à ficha.
40. Ordem das turmas na ficha: segunda → domingo, horário, nome; dias abreviados "dom, seg, ter, qua,
    qui, sex, sáb".
41. Entrar recusa turma desativada; sair de turma desativada é permitido.
42. `editarTurma` garante a mensalidade do mês em todo "Salvar turma" (a mesma escrita idempotente).
43. Frases: "Não deu para colocar na turma. …", "Não deu para tirar da turma. …", "Entrando…",
    "Tirando…", `aria-label` "Ver a turma {nome}".

**Plano 05-08 (presença, reposição, experimental):**
44. "Tem aula a repor" aparece também com o campo vazio. *Desfazer:* `pessoasParaData`.
45. A dica da sugestão tem plural ("÷ 1 aula" / "÷ 4 aulas"); sem aula no mês, sem sugestão.
46. Frases: "Reposição só entra numa aula de turma ou numa oficina.", "A aula experimental só entra numa
    data de turma.", "Não deu para marcar o direito a repor. …", "Não deu para marcar o direito a repor
    de {nome}. Toque de novo.".
47. Enquanto nada está escolhido, "Diga se esta aula é cobrada ou gratuita." aparece embaixo do
    segmentado, em cinza, como descrição do botão desabilitado.
48. O quadro "A REPOR" ocupa a primeira coluna de uma grade de duas na ficha (a segunda é "A RECEBER").
49. "Pronto" fecha a folha na hora e adia a troca da URL até as presenças gravarem (no máximo 8 s) —
    correção de um defeito real no celular (desvio 1).
50. **A ordem da lista "Quem vem"**: alunos, reposições, experimentais, oficina; dentro de cada grupo,
    por nome (planejamento, item 15) — conferida na Parte 2, D.25.

**Plano 05-09 (uso livre):**
51. Uso de dia passado ainda no espaço mostra só a etiqueta "encerrar".
52. Reservado mostra na conta só "Pessoas" (sem valor estimado); sem preço da hora, "{h} h" e Valor "—".
53. "Chegou" num uso que já começou é sucesso, com a hora que já estava gravada.
54. "Este uso livre já foi encerrado…" vai num toast; a recusa de "Cancelar reserva" fica dentro do
    diálogo.
55. Frases: "Diga a hora de chegada.", "Diga a hora de saída.", "Este uso livre ainda não começou —
    marque "Chegou" primeiro.", "Não deu para marcar a chegada. …", "Não deu para corrigir a hora de
    chegada. …", "Não deu para cancelar a reserva. …".
56. "Chega às" nasce vazio; "Chegou às" corrige ao sair do campo, sem toast.
57. No cartão, o uso encerrado fica sem etiqueta de estado (a de pagamento veio no 05-11).

**Plano 05-10 (material do uso livre):**
58. O toast diz "+ material" só quando há material **cobrado**, e "Estoque baixado." quando alguma linha
    saiu do Estoque.
59. Na linha "Horas cheias", o "= {R$}" é só a parte das horas; o "Valor" soma o material.
60. O seletor "Qual material?" abre por cima da folha do uso (na Produção ele troca a folha).
61. O `ProvedorDoEstoque` envolve sempre a semana; o carregador só roda com um uso no espaço aberto.
62. Quantidade inválida volta com a frase da 06; a tela troca pela da UI-SPEC com a unidade.
63. Linha cobrada cujo item perdeu o preço mostra as duas opções (dá para voltar a "Incluso").
64. No uso encerrado, "Material usado" aparece mesmo sem material, com "nenhum".
65. A nota do Estoque ("{nome} · {dd/mm}") corta o **nome** para caber nos 160 caracteres (desvio 1).
66. Frases: "Não deu para acrescentar o material. …", "Não deu para mudar a cobrança do material. Toque
    de novo.", "Não deu para tirar o material. …", "Acrescentando…", "Trocar", `aria-label` "Cobrar
    este material?".

**Plano 05-11 ("A receber" e "Recebi agora"):**
67. Uso livre de uma pessoa: "Uso livre · 3 h · 12/10", sem "× 1 pessoas" (como o protótipo).
68. O topo do "Recebi agora" é "{nome} · {sub-linha} · {R$}" (com "vence dia {d}" e "material {R$}").
69. Recusas decididas sob a trava ("Este item já foi lançado (venda nº N)…", item dispensado, data
    cancelada) fecham a folha e vão para um toast; a falha genérica fica dentro da folha.
70. Frases: "Este item não está mais em "A receber" — a tela foi atualizada.", "Esta cobrança foi
    dispensada — a tela foi atualizada.", o toast com a forma em minúscula ("paga em pix").
71. A lista de "A receber" filtra no banco as cobranças com venda ativa e as dispensadas.

**Plano 05-12 ("Lançar na Venda" e o lote):**
72. Origem dispensada, de data cancelada, de valor 0 ou adulterada → "Não achei este item da Agenda…".
73. "Limpar" na Venda da Agenda volta ao carrinho da origem e não toca no rascunho comum.
74. O rodapé do uso encerrado e a receber tem três botões: "Voltar à agenda" + "Recebi agora" + "Lançar
    na Venda" (a UI-SPEC prevê só os dois últimos). *Desfazer:* `folha-uso-livre.tsx`.
75. A corrida do lote vai num aviso; a falha fica dentro da sanfona.
76. A pessoa travada tem o rótulo "Pessoa" (não "Pessoa (opcional)"); nome longo rola dentro do campo.
77. A linha de origem não mostra a etiqueta "tabela R$" (no uso livre ela acusaria diferença falsa); o
    material cobrado vira linha livre, removível.
78. A volta vai para `?aba=receber`, sem o link "ver no Caixa" no toast.
79. Frase para origem adulterada: "Esse item da Agenda não é válido — volte à Agenda e toque em "Lançar
    na Venda" de novo." (só aparece com pedido forjado).

**Plano 05-13 (dispensar e etiquetas):**
80. "Mostrar mais 20" das dispensadas pela URL (`?dispensadas=`).
81. Na folha do uso encerrado, a etiqueta de pagamento vem depois de "Encerrado · {h} h · estoque
    baixado (…)".
82. `aria-label` do link: "Dispensar a cobrança de {descrição} de {nome}".
83. O campo do motivo não corta em 200: com 201 aparece a frase e nada se grava.
84. "Não deu para desfazer. Verifique a internet e tente de novo." embaixo da linha.
85. "Últimas vindas" lista inscrições e usos livres encerrados juntos, por data e hora (fecha a lacuna
    achada no 05-09).
86. A dispensa revalida também o Início.

**Plano 05-14 (Início e Números):**
87. A linha do fechado no Início mostra "dia todo" na coluna da hora.
88. "e mais {N}" leva à semana de hoje, já rolada até hoje.
89. Números não faz nascer mensalidade (só leitura).
90. Título "outubro, até hoje" com o mês em minúscula; horas com ponto de milhar ("1.234 h").

**Plano 05-15 (site e aba "No site"):** as decisões estão em 0.6.

- [ ] **0.7 — li; quero trocar** (diga o número do item, ou "nenhuma"):
  - **Resultado:**

---

## Parte 1 — O servidor: o Roteiro 17

Siga `docs/operacao/17-migracao-agenda.md`, **na ordem, sem pular**. Aqui você só anota o que cada passo
mostrou (pode colar a saída — **sem nome de cliente**; números bastam).

- [ ] **Passo 0 — Parte 0 respondida** (acima), com o número do WhatsApp; trocas feitas no branch e
  `npm run verificar` verde **antes** do Passo 4
  - **Resultado:**
- [ ] **Passo 1.1 — Guarda** (host do VPS, `theo`, `/opt/amassa`, banco `amassa`)
  - **Resultado:**
- [ ] **Passo 1.2 — A plataforma continua fora de uso real hoje?** (os lançamentos dos últimos 14 dias
  são só teste; ninguém lançando venda real no Caixa) — **a condição da D-15**
  - **Resultado:**
- [ ] **Passo 2 — Contagem ANTES** (2.1 `documentos` / `parcelas` / `movimentacoes`; 2.2 itens com os
  nomes da semente — esperado `(0 rows)`; 2.3 as duas categorias, `ativa = t`; 2.4 migrações aplicadas —
  esperado `26`)
  - **Resultado:**
- [ ] **Passo 3 — Backup** (`sucesso = t`, horário de agora, tamanho plausível)
  - **Resultado:**
- [ ] **Passo 4 — Publicar** (`git log origin/main..main` — vazio em 02/10/2026 00h38 UTC, ou só commits
  que você reconhece; `git log gsd/phase-05-agenda..main` vazio; merge sem conflito; hash do merge;
  número do run e os quatro jobs verdes, com o **`implantar` concluído**)
  - **Resultado:**
- [ ] **Entre o fim do `implantar` e o fim do Passo 5 (a janela da D-15): ninguém lança nada.** Com o
  código novo sobre o banco velho falham toda venda, despesa, aprovação de orçamento, conta fixa, baixa
  de estoque e conclusão da Produção, e a Agenda inteira.
  - **Resultado:**
- [ ] **Passo 5 — `db:migrate`** (5.1 se precisou; `0026_agenda.sql` listada na imagem; "Migrações
  aplicadas com sucesso." e `0`)
  - **Resultado:**
- [ ] **Passo 6 — `/api/health/agenda`** → `200` e `{"status":"ok"}` — **com data e hora**; e
  `/api/health`, `/api/health/estoque`, `/api/health/producao`, `/api/health/backup` em `200`
  - **Resultado:**
- [ ] **Passo 7 — Conferência SQL depois** (7.1 as **oito** tabelas; 7.2 `pode_apagar = f` em `clientes`,
  `turmas`, `turma_alunos`, `mensalidades`; 7.3 o enum termina em `uso_livre`; 7.4 os três itens do
  sistema, preço vazio, ativos; 7.5 `joao da silva`; 7.6 `documentos`, `parcelas`, `movimentacoes`
  **iguais** ao 2.1, `vendas_com_pessoa = 0`, migrações = 2.4 + 1)
  - **Resultado:**
- [ ] **Passo 8 — No celular** (o preço do "Uso livre (hora)" cadastrado em Cadastros → Catálogo; a
  Agenda abre com as cinco abas; "A receber" com "Ninguém devendo."; o Início com o bloco da Agenda; os
  itens anotados no 2.2/2.3 resolvidos)
  - **Resultado:**
- [ ] **Data da publicação** (o dia em que o `implantar` terminou verde, horário de Brasília)
  - **Resultado:**

---

## Parte 2 — O celular, no ateliê

Abra `amassacerrado.com.br/gestao` no **celular do ateliê**, logado. Faça de pé, como no dia a dia.

**O que você vai criar de teste** (e a seção E deixa quieto no fim): seis pessoas
"[teste] Aluna 1" a "[teste] Aluna 6", mais "[teste] Visitante"; uma turma "[teste] Turma da caminhada"
com 4 semanas; uma oficina "[teste] Oficina da caminhada"; um uso livre; um dia fechado. Tudo em datas
**de hoje a 14 dias**, e **privado**: 🔴 a caixa **"Mostrar no calendário público do site" vem MARCADA**
na folha de turma e de aula — **desmarque-a** em cada lançamento de teste, senão a turma e a oficina de
teste aparecem no site para qualquer visitante. Só a conferência D.0 liga o site, de propósito.
*Nota de 02/10/2026 — decisão do dono no chat, 02/10/2026, depois de `Claude outputs/agenda/VERIFICACAO-COWORK-05.md` §2 item 1: em produção a caixa continua MARCADA até a publicação do quick
`261002-sdt`; depois dela, vem **desmarcada** — aí não precisa desmarcar, e quem liga o site é a
conferência D.0, marcando de propósito.*

### A. As conferências do Roteiro, no dia a dia

Feitas no Passo 8 do Roteiro. Marque aqui só se algo mudou desde então.

- [ ] **Nada mudou desde o Passo 8**
  - **Resultado:**

### B. Os 9 critérios do ROADMAP

#### 1. Os quatro tipos (turma fixa, aula/oficina avulsa, uso livre, fechado) são lançados pela mesma folha "Lançar na agenda" e aparecem nas vistas semana (padrão no celular) e mês

- [ ] **Critério 1**
  - **O que abrir:** Agenda → "+ Lançar na agenda".
  - **O que fazer:** lance, um de cada, **com "Mostrar no calendário público do site" desmarcado**: a
    turma (Turma fixa, dia da semana = **o de hoje**, primeira aula a partir de hoje, um horário que já
    começou ou começa logo, 4 semanas, 6 vagas), a oficina (Aula ou oficina avulsa, daqui a 3 dias, preço
    R$ 50, **6 vagas**), um uso livre ("[teste] Visitante" — cadastre pelo seletor —, hoje, 2 h, 1
    pessoa) e um dia fechado (daqui a 10 dias, motivo "[teste] caminhada"). Depois troque para **Mês**.
  - **O que esperar:** os quatro pela mesma folha, cada um com o botão do seu verbo ("Lançar turma",
    "Lançar aula", "Reservar uso livre", "Fechar o dia"); a semana é a vista que abre; os quatro
    aparecem na semana (cada tipo com sua cor na borda) e como pontos no mês.
  - **Resultado:**

#### 2. Lançar uma turma fixa já marca as N semanas pedidas (padrão 8); cada data tem lista própria e pode ser cancelada sozinha, sem contar falta para ninguém

- [ ] **Critério 2**
  - **O que abrir:** a turma lançada no critério 1 (o campo "Marcar quantas semanas" veio com 8, e você
    pôs 4).
  - **O que fazer:** confira as 4 datas na semana e na seguinte; abra a 2ª data e toque "Cancelar esta
    data" (sem presença, cancela direto, com "Desfazer" no toast).
  - **O que esperar:** 4 datas; a 2ª fica riscada, "· cancelada"; as outras continuam; ninguém ganha
    falta (a ficha das alunas, no critério 3, não mostra falta nessa data).
  - **Resultado:**

#### 3. Marcar Veio/Faltou de uma turma inteira no celular é um toque por pessoa; falta com "tem direito a repor" gera um crédito que aparece primeiro ao colocar alguém numa data

- [ ] **Critério 3**
  - **O que abrir:** Pessoas → cadastre as seis "[teste] Aluna 1..6" e, na ficha de cada uma, marque a
    caixa da turma em "Turmas fixas" (entra na hora, "Entrando…"). Depois abra a **1ª data** da turma
    (hoje).
  - **O que fazer:** a presença da turma inteira — é a seção C abaixo, cronometrada. Na "[teste] Aluna 6",
    marque **Faltou** e "tem direito a repor". Depois abra a oficina e toque "Colocar alguém".
  - **O que esperar:** um toque por pessoa; a "[teste] Aluna 6" aparece **primeiro**, em "Tem aula a
    repor", com "1 a repor".
  - **Resultado:**

#### 4. Quem faz aula é o mesmo cliente do Financeiro — nenhum cadastro paralelo de pessoas

- [ ] **Critério 4**
  - **O que abrir:** Cadastros → **Clientes**.
  - **O que fazer:** procure "[teste] Aluna 1" (e tente "aluna 1", sem o colchete e em minúscula).
  - **O que esperar:** é a **mesma** pessoa da aba Pessoas da Agenda (editar o telefone num lado aparece
    no outro); cadastrar "[teste] aluna 1" de novo avisa "Já existe…" e oferece usar a existente.
  - **Resultado:**

#### 5. "Recebi agora" cria a Venda já paga, que aparece no Caixa do dia; "Lançar na Venda" abre o rascunho preenchido; nos dois casos o item sai de "A receber" e o "pago" passa a vir do Financeiro

- [ ] **Critério 5**
  - **O que abrir:** Agenda → **A receber** (as mensalidades das seis alunas nasceram ao abrir a tela —
    0.2 (g)).
  - **O que fazer:** (a) na mensalidade da "[teste] Aluna 1", "Recebi agora" → "Pix" (dois toques — seção
    C conta). (b) Na da "[teste] Aluna 2", "Lançar na Venda". (c) No Caixa do dia, cancele a venda da
    "[teste] Aluna 1".
  - **O que esperar:** (a) toast com "ver no Caixa"; a venda está no Caixa de hoje, **paga**; a linha
    some de "A receber"; na ficha da aluna, "pago". (b) a Venda abre com a faixa "Da Agenda", a pessoa
    travada e a linha da mensalidade; ao lançar, a linha some de "A receber". (c) a mensalidade da
    "[teste] Aluna 1" **volta** a "A receber", com a etiqueta "venda nº … cancelada" — o "pago" vem do
    Financeiro.
  - **Resultado:**

#### 6. Encerrar um uso livre cobra horas cheias × pessoas × preço da hora + material cobrado, e cada material vira saída no Estoque com vínculo ao uso, mesmo quando "incluso"

- [ ] **Critério 6**
  - **O que abrir:** o uso livre do "[teste] Visitante" (critério 1). Toque "Chegou".
  - **O que fazer:** acrescente **dois** materiais do Estoque — um "Cobrar" (precisa ser um item com
    preço de venda; sem preço, só "Incluso" — D-14), um "Incluso" (a linha nasce em "Incluso", 0.2 (m));
    depois "Encerrar e cobrar" com o "Saiu às" que vier. Depois abra Estoque → Histórico.
  - **O que esperar:** o valor = horas cheias × 1 pessoa × o preço da hora do Passo 8 + **só** o material
    cobrado; no Histórico, **duas** saídas "Uso livre do espaço · [teste] Visitante · {dd/mm}" — a
    cobrada **e** a inclusa; o uso vai para "A receber".
  - **Resultado:**

#### 7. Lista cheia avisa e não bloqueia; nenhum aviso de lotação do espaço ou de sobreposição

- [ ] **Critério 7**
  - **O que abrir:** a oficina (6 vagas; a "[teste] Aluna 6" já entrou nela como reposição no critério
    3). Ponha as "[teste] Aluna 1..5" (no grupo de baixo — entram pagando) até encher, e então o
    "[teste] Visitante" como 7º.
  - **O que fazer:** lance também, no mesmo dia e horário da oficina, um uso livre do "[teste] Visitante".
  - **O que esperar:** "A lista já está cheia…" **avisa**, e "Colocar na lista" **continua funcionando**
    (fica 7 / 6); nenhum aviso de lotação do espaço; nenhum aviso de sobreposição de horário.
  - **Resultado:**

#### 8. O site mostra só aulas e oficinas públicas e não canceladas, com vagas restantes e "Reservar pelo WhatsApp", sem nome de ninguém

- [ ] **Critério 8** — a seção D.0 abaixo (o site numa janela anônima).
  - **Resultado:**

#### 9. Cancelar nunca apaga: fica riscado; venda e movimentação de estoque já geradas nunca são apagadas pela Agenda

- [ ] **Critério 9**
  - **O que abrir:** a **1ª data** da turma (a de hoje, com as presenças da seção C), e a oficina (com as
    inscrições pagas do critério 7).
  - **O que fazer:** cancele a 1ª data da turma — tem presença, então a confirmação diz o que se perde;
    confirme, e depois "Desfazer cancelamento". Cancele a oficina (a confirmação diz quantas inscrições
    saem de "A receber"). Depois abra o Caixa e o Histórico do Estoque.
  - **O que esperar:** as duas ficam **riscadas** ("· cancelada"), não somem; "Desfazer cancelamento" traz
    a data de volta; a venda do critério 5 e as saídas do critério 6 **continuam** no Caixa e no
    Histórico — a Agenda nunca as apaga (venda só se cancela no Caixa).
  - **Resultado:**

### C. O valor central — 🔴 com cronômetro

**A presença de uma turma inteira de 6 pessoas, no celular, de pé, um toque por pessoa.** É o motivo da
fase: se isso não for confortável, a Agenda não é usada.

- [ ] **C.1 — Presença da turma inteira**
  - **O que fazer:** de pé, celular numa mão. Comece o cronômetro ao tocar a linha da aula no Início (ou
    o cartão na semana). Marque "Veio" para 5 e "Faltou" para 1. Pare ao tocar "Pronto".
  - **O que esperar:** um toque por pessoa (6), mais abrir e "Pronto" — **8 toques**, como o teste
    mediu (05-08); cada marca grava na hora e sobrevive a recarregar.
  - **Toques contados:**
  - **Tempo, do primeiro ao último toque:**
  - **Resultado (confortável? algo atrapalhou?):**
- [ ] **C.2 — Encerrar um uso livre em dois toques** (o cartão do uso no espaço → "Encerrar e cobrar",
  com o "Saiu às" já preenchido com a hora de agora — UI-D7, escolha sua)
  - **Toques / tempo:**
  - **Resultado:**
- [ ] **C.3 — "Recebi agora" em dois toques** ("Recebi agora" → "Pix"/"Dinheiro"/"Cartão" já registra —
  UI-D4, escolha sua)
  - **Toques / tempo:**
  - **Resultado:**
- [ ] **C.4 — Do Início à lista de presença em 2 toques** (a linha da aula de hoje no Início abre a folha
  — UI-D19)
  - **Resultado:**

### D. As conferências que só um celular de verdade (ou o olho) revela

#### D.0 O site numa janela anônima (critério 8)

- [ ] **D.0 — conferir o site**
  - **O que fazer:** lance uma oficina nova, "[teste] Oficina do site", daqui a 5 dias, R$ 50, 6 vagas,
    **com** "Mostrar no calendário público do site" marcado, e ponha a "[teste] Aluna 1" nela. No celular,
    abra uma **janela anônima** em `amassacerrado.com.br` (sem login). Se ela não aparecer, espere até 5
    minutos (lançar e colocar revalidam o site na hora; o resto, a cada 5 minutos).
  - **O que esperar:** a seção de aulas com "Próximas · Calendário"; o cartão da oficina com o preço,
    "5 vagas" restantes e **"Reservar pelo WhatsApp"** levando ao **número real** (0.1) com a mensagem
    "Oi! Quero reservar: [teste] Oficina do site (…)."; **nenhum nome** de aluna em lugar nenhum; a turma
    e os eventos privados de teste **não** aparecem. Na gestão, a aba **"No site"** mostra o mesmo
    calendário. Depois **cancele** a oficina do site e confira, na janela anônima, que ela **some**.
  - **Resultado:**

#### D.1 a D.50 — as conferências `backstop` dos planos 03 a 15

Cada uma diz o que olhar. Muitas pedem tela de 320px (um celular pequeno, ou o navegador do computador
em modo celular, 320 de largura) ou dado extremo — para essas, a opção **(b)**: peça ao agente as
capturas feitas no banco de teste, e marque olhando as imagens. Não precisa fazer as 50 de uma vez;
precisa que cada uma tenha Resultado antes do "aprovado".

**Plano 05-03 — semana, mês, fechado, desfazer**

- [ ] **D.1 (backstop 05-03 · E2·overflow):** abrir a semana de 28/12/2026 a 03/01/2027 a 320px —
  conferir que o "›" não sai da tela nem cria rolagem lateral (o título pode quebrar, nunca o botão).
  - **Resultado:**
- [ ] **D.2 (backstop 05-03 · E3·overflow):** um dia com 8 lançamentos no mês a 320px — conferir que os
  pontos quebram em duas linhas dentro da célula sem vazar, e que o leitor de tela conta os 8.
  - **Resultado:**
- [ ] **D.3 (backstop 05-03 · E10·overflow):** a folha de um fechado a 320px — conferir que "Tirar o
  bloqueio" e "Voltar à agenda" cabem (ou quebram em duas linhas), cada um com 44px, sem rolagem lateral.
  - **Resultado:**
- [ ] **D.4 (backstop 05-03 · E10·long-text):** fechar um dia com motivo de 120 caracteres e abrir a
  folha a 320px — conferir que o título quebra ao lado do fechar sem empurrá-lo para fora.
  - **Resultado:**
- [ ] **D.5 (backstop 05-03 · E29·loading):** cancelar uma data sem presença e tocar duas vezes rápido
  no "Desfazer" do toast — conferir que só um desfazer acontece.
  - **Resultado:**
- [ ] **D.6 (backstop 05-03 · E29·error):** cancelar uma data, derrubar a rede (modo avião) e tocar
  "Desfazer" — conferir uma frase humana ("Não deu para desfazer o cancelamento. …").
  - **Resultado:**

**Plano 05-04 — clientes**

- [ ] **D.7 (backstop 05-04 · E12·long-text):** pessoa de nome com 160 caracteres, com as duas tags, em
  Pessoas a 320px — conferir que o nome quebra e o "Abrir" (44px) continua inteiro à direita.
  - **Resultado:**
- [ ] **D.8 (backstop 05-04 · E13·long-text):** a ficha dessa pessoa a 320px — conferir que o título
  quebra e "Editar" e o fechar continuam visíveis com 44px.
  - **Resultado:**
- [ ] **D.9 (backstop 05-04 · E22·loading):** `/gestao/cadastros?sub=clientes` com a rede lenta —
  conferir o esqueleto (busca + linhas), nunca a tela em branco.
  - **Resultado:**
- [ ] **D.10 (backstop 05-04 · E22·error):** com o banco fora (só no banco de teste — peça a captura) —
  conferir "Não deu para carregar os clientes…" + "Tentar de novo".
  - **Resultado:**
- [ ] **D.11 (backstop 05-04 · E22·zero-one-many):** com 50 e com 51 clientes — conferir que "Mostrar mais
  50" só aparece no segundo caso.
  - **Resultado:**
- [ ] **D.12 (backstop 05-04 · E22·long-text):** a 320px, conferir que a pílula "Clientes" cabe na
  primeira fileira (Catálogo · Categorias · Clientes) sem quebrar, e que um nome de 160 caracteres
  quebra com o "Editar" inteiro.
  - **Resultado:**

**Plano 05-05 — o seletor**

- [ ] **D.13 (backstop 05-05 · E6·overflow):** uma oficina com 20 inscritos num celular de 360×640 —
  conferir que a lista rola dentro da folha e que o rodapé com "Pronto" e "Cancelar esta data" fica
  preso e visível.
  - **Resultado:**
- [ ] **D.14 (backstop 05-05 · E8·overflow):** com 200 pessoas, digitar "a" no "Colocar alguém" a 360px
  — conferir que a lista para em 8 com "Há mais pessoas com esse nome — continue digitando." e que a
  faixa e o "Colocar na lista" ficam alcançáveis.
  - **Resultado:**
- [ ] **D.15 (backstop 05-05 · E8·long-text):** digitar 160 caracteres a 320px — conferir que
  "Cadastrar "{texto}"" quebra sem estourar, e que um resultado de 160 caracteres quebra dentro da opção.
  E, **no celular de verdade:** tocar numa linha do seletor com o teclado aberto escolhe a pessoa.
  - **Resultado:**

**Plano 05-06 — turma fixa**

- [ ] **D.16 (backstop 05-06 · E5·partial):** na folha "Lançar", digitar nome, horário e vagas em "Aula
  ou oficina avulsa", trocar para "Turma fixa" e voltar — conferir que os campos comuns continuam
  preenchidos.
  - **Resultado:**
- [ ] **D.17 (backstop 05-06 · E5·long-text):** a pílula Turma fixa a 320px — conferir que "Mensalidade
  vence dia" e "Marcar quantas semanas" quebram o rótulo sem espremer o campo; um nome de 121
  caracteres mostra o erro embaixo, com o limite.
  - **Resultado:**
- [ ] **D.18 (backstop 05-06 · E7·long-text):** dia fechado com motivo de 120 caracteres e uma data de
  turma nele, a 320px — conferir que a caixa "Este dia está fechado: …" quebra e o "Cancelar esta data"
  continua inteiro, com 44px.
  - **Resultado:**
- [ ] **D.19 (backstop 05-06 · E11·overflow):** a folha de uma turma com 30 alunos a 360×640 — conferir
  que a área rola, "Desativar turma" fica no fim dela e o rodapé com "Salvar turma" fica preso.
  - **Resultado:**
- [ ] **D.20 (backstop 05-06 · E11·zero-one-many):** uma turma com 1 aluno — conferir "1 aluno de {v}
  vagas", "Alunos (1)" e "1 data daqui para frente".
  - **Resultado:**
- [ ] **D.21 (backstop 05-06 · E11·long-text):** turma com nome de 120 caracteres a 320px — conferir que
  o título quebra ao lado do fechar e do "Voltar à data", e que o sub-título quebra sem cortar.
  - **Resultado:**
- [ ] **D.22 (backstop 05-06 · E28·error):** derrubar a rede e confirmar "Desativar turma" — conferir que
  o diálogo continua aberto com "Não deu para desativar…" e nada muda.
  - **Resultado:**
- [ ] **D.23 (backstop 05-06 · E29·long-text):** lançar uma turma de 8 semanas com 2 datas em dia
  fechado — conferir a 320px que o toast "… 2 delas caem num dia fechado (…)" cabe e se lê (fica 8 s).
  - **Resultado:**

**Plano 05-07 — entrar e sair**

- [ ] **D.24 (backstop 05-07 · E28·long-text):** "Desativar {turma}?" com turma de 120 caracteres e
  "Tirar {nome} de {turma}?" com nome de 160, a 320px — conferir que o título quebra e os botões
  continuam visíveis.
  - **Resultado:**

**Plano 05-08 — a ordem da lista**

- [ ] **D.25 (backstop 05-08 · AGE-11 · ordering):** abrir a lista "Quem vem" de uma data com 8 pessoas
  (alunos, uma reposição, uma experimental), recarregar duas vezes — conferir que a ordem não muda e é:
  alunos, reposições, experimentais, oficina; dentro de cada um, por nome.
  - **Resultado:**

**Plano 05-10 — material do uso livre**

- [ ] **D.26 (backstop 05-10 · E9·overflow):** 8 materiais num uso livre a 320px — conferir que a linha
  de acrescentar quebra sem rolagem lateral e "Encerrar e cobrar" fica preso no rodapé.
  - **Resultado:**
- [ ] **D.27 (backstop 05-10 · E9·zero-one-many):** encerrar com 1 pessoa, 1 hora e 1 material — conferir
  "1 h × R$ …" (sem "× 1 pessoas"), "1 hora cheia" no toast e "estoque baixado (1 material)".
  - **Resultado:**
- [ ] **D.28 (backstop 05-10 · E9·long-text):** material de nome com 120 caracteres a 320px — conferir
  que "{q} {un} · {nome}" quebra e o valor (ou "incluso") e o "tirar" ficam à direita.
  - **Resultado:**
- [ ] **D.29 (backstop 05-10 · E30·long-text):** uso livre de uma pessoa de nome com 160 caracteres, e o
  Histórico do Estoque a 320px — conferir que "Uso livre do espaço · {nome} · {dd/mm}" quebra sem
  empurrar a quantidade.
  - **Resultado:**

**Plano 05-11 — "A receber" e "Recebi agora"**

- [ ] **D.30 (backstop 05-11 · E15·long-text):** turma de nome com 120 caracteres em "A receber" a 320px
  — conferir que "Mensalidade · {turma} (proporcional) · {mês} · vence dia {d}" e a etiqueta quebram sem
  empurrar o valor.
  - **Resultado:**
- [ ] **D.31 (backstop 05-11 · E18·long-text):** "Recebi agora" de uma pessoa de 160 caracteres a 320px —
  conferir que o topo quebra e os três botões de forma ficam visíveis com no máximo um gesto.
  - **Resultado:**

**Plano 05-12 — "Lançar na Venda" e o lote**

- [ ] **D.32 (backstop 05-12 · E16·overflow):** 40 mensalidades a 360px — conferir que a sanfona aberta
  não esconde linhas atrás de uma rolagem interna e o botão do lote fica no fim da lista.
  - **Resultado:**
- [ ] **D.33 (backstop 05-12 · E16·zero-one-many):** uma só mensalidade a receber — conferir "Lançar
  todas as mensalidades de uma vez (1)", "Lançar esta 1 na Venda · R$" e "1 mensalidade lançada na
  Venda".
  *Nota de 02/10/2026 — decisão do dono no chat, 02/10/2026, depois de `Claude outputs/agenda/VERIFICACAO-COWORK-05.md` §2 item 3: depois da publicação do quick `261002-sdt`, o toque em
  "Lançar esta 1 na Venda" abre **"Lançar 1 venda?"** antes de lançar; "Voltar" fecha sem criar venda.*
  - **Resultado:**
- [ ] **D.34 (backstop 05-12 · E16·long-text):** pessoa de 160 caracteres numa turma de 120, a 320px —
  conferir que o item do lote quebra dentro da borda tracejada.
  - **Resultado:**
- [ ] **D.35 (backstop 05-12 · E24·loading):** uma venda em montagem e a rede lenta; tocar "Lançar na
  Venda" — conferir que o carrinho da origem aparece direto, sem piscar o outro antes.
  - **Resultado:**
- [ ] **D.36 (backstop 05-12 · E24·overflow):** a Venda de uma mensalidade de turma com nome de 120
  caracteres a 320px — conferir que a faixa "Da Agenda · …" quebra e o "Voltar à Agenda" tem 44px.
  - **Resultado:**
- [ ] **D.37 (backstop 05-12 · E24·long-text):** pessoa travada com 160 caracteres — conferir que o nome
  rola (ou quebra) dentro do campo e a dica "vem da Agenda" fica visível.
  - **Resultado:**

**Plano 05-13 — etiquetas e dispensar**

- [ ] **D.38 (backstop 05-13 · E4·overflow):** cartão de oficina com "cancelada", "dia fechado", "marcar
  presença", "3 a receber", "no site" a 320px — conferir que as etiquetas quebram e "12 / 12" fica na
  coluna da direita.
  - **Resultado:**
- [ ] **D.39 (backstop 05-13 · E6·long-text):** pessoa de 160 caracteres com "reposição" e "venda nº 123
  cancelada", a 320px — conferir que o nome quebra e "Veio · Faltou" continua inteiro (44px cada).
  - **Resultado:**
- [ ] **D.40 (backstop 05-13 · E12·zero-one-many):** 50 e 51 pessoas — conferir "Mostrar mais 50" só acima
  de 50, e "1 a repor" / "2 a receber" com plural certo.
  - **Resultado:**
- [ ] **D.41 (backstop 05-13 · E13·overflow):** ficha com R$ 1.234,56 a receber e 12 aulas a repor a 320px
  — conferir que o número cabe no quadro sem cortar nem empurrar o outro.
  - **Resultado:**
- [ ] **D.42 (backstop 05-13 · E16·partial):** uma mensalidade com a venda cancelada no Caixa e outra
  dispensada — conferir que a de venda cancelada **entra** no lote (D-08) e a dispensada **não** (D-09).
  - **Resultado:**
- [ ] **D.43 (backstop 05-13 · E17·long-text):** dispensar com motivo de 200 caracteres e abrir a sanfona
  a 320px — conferir que a sub-linha quebra e o "Desfazer" fica inteiro; com 201, a frase de erro aparece
  embaixo do campo.
  - **Resultado:**
- [ ] **D.44 (backstop 05-13 · E28·overflow):** cada confirmação a 320px — conferir que os dois botões
  ("Manter a data" · "Cancelar esta data", "Manter na turma" · "Tirar da turma") empilham ou cabem, com
  44px, sem rolagem lateral.
  - **Resultado:**

**Plano 05-14 — Números**

- [ ] **D.45 (backstop 05-14 · E20·overflow):** um mês com 1.234 horas-pessoa em Números a 360px —
  conferir que "PRESENÇA NAS AULAS" quebra sem cortar e "1.234 h" cabe no quadro.
  - **Resultado:**

**Plano 05-15 — site e "No site"**

- [ ] **D.46 (backstop 05-15 · E1·long-text):** `/gestao/agenda` a 320px e a 360px com 120 cobranças a
  receber ("A receber · 120") — conferir que a primeira fileira de abas cabe sem quebrar o rótulo no
  meio da palavra nem estourar a borda.
  - **Resultado:**
- [ ] **D.47 (backstop 05-15 · E19·error):** com o banco fora (banco de teste — peça a captura), trocar
  para "No site" — conferir o erro da Agenda ("Não deu para carregar a agenda…" + "Tentar de novo") e
  **não** "nenhuma aula pública".
  - **Resultado:**
- [ ] **D.48 (backstop 05-15 · E25·zero-one-many):** um único evento público, o site a 1280px — conferir
  que o cartão sozinho não fica esticado, e os rótulos "1 vaga"/"última vaga" e "2 vagas"/"últimas 2
  vagas".
  - **Resultado:**
- [ ] **D.49 (backstop 05-15 · E25·long-text):** oficina pública de nome com 120 caracteres, o site a
  320px — conferir que o título quebra sem estourar o cartão e que o WhatsApp leva a mensagem inteira.
  - **Resultado:**
- [ ] **D.50 (backstop 05-15 · E26·overflow):** o Calendário do site a 320px num dia com 4 eventos
  públicos — conferir que os pontos quebram dentro da célula e o número do dia não é coberto.
  - **Resultado:**

**Mais três que os SUMMARYs pediram (não são backstop dos planos, mas só o olho vê):**

- [ ] **D.51 (conferir · 05-07 E13·empty):** num banco sem nenhuma turma ativa, a ficha mostra "Nenhuma
  turma fixa lançada ainda." (em produção, antes do critério 1 — ou peça a captura).
  - **Resultado:**
- [ ] **D.52 (conferir · 05-14):** "Agora no espaço" no Início num momento real: uma aula acontecendo +
  um uso livre com "Chegou" — os dois contados.
  - **Resultado:**
- [ ] **D.53 (conferir · 05-15):** a aba "No site" com **nenhum** evento público mostra o estado vazio
  dela (condição global — em produção, antes do D.0).
  - **Resultado:**

### E. Deixar quieto o que ficou de teste

Nada disso se apaga (0.2 e o aviso do topo); fica parado e fora das contas.

- [ ] **E.1** — Caixa: cancele as vendas de teste (critérios 5 e 6). As cobranças voltam a "A receber";
  dispense-as lá, com o motivo "[teste] caminhada".
- [ ] **E.2** — A turma de teste: folha da turma → "Desativar turma" (apaga as datas futuras — 0.2 (o)).
- [ ] **E.3** — As duas oficinas e o dia fechado de teste: cancele as oficinas (se ainda não) e tire o
  bloqueio. Confira na janela anônima que o site não mostra nada "[teste]".
- [ ] **E.4** — As saídas de material do critério 6 ficam no Histórico (a Agenda nunca apaga movimento);
  se quiser o saldo de volta, uma **entrada** de ajuste no Estoque com a mesma quantidade.
- [ ] **E.5** — As pessoas "[teste] …" ficam em Clientes. Renomeie se quiser ("[teste] não usar").
  - **Resultado:**

---

## Fechamento

- [ ] **Aprovado** — com: as respostas da Parte 0 (e o número do WhatsApp), a data da publicação, e os
  toques e o tempo da presença da turma inteira (C.1).
  - **Resultado:**

Depois do "aprovado", o orquestrador mede e registra (`git log origin/main..main`, `gh run list`,
`curl /api/health/agenda` = 200, `/gestao/agenda` = 307 para o login sem sessão), marca em
`REQUIREMENTS.md` **só** os AGE que esta caminhada confirmou, e fecha a fase.
