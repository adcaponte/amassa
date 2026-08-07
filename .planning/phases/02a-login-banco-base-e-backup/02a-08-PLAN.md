---
phase: 02a-login-banco-base-e-backup
plan: 08
type: execute
wave: 6
depends_on: ["02a-07"]
files_modified:
  - docs/operacao/03-backup-e-restauracao.md
  - README.md
autonomous: false
requirements: [AUTH-07, BKP-01, BKP-02, BKP-04, BKP-06, BKP-07]

estimate:
  tokens: 62000
  raw_tokens: 62000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "O backup de ontem existe no servidor e também no armazenamento externo (critério 7 do ROADMAP)"
    - "`/api/health/backup` responde `ok` em produção e é vigiado por um monitor externo (critério 8 do ROADMAP)"
    - "As contas de gestor existem em produção, criadas pela linha de comando no servidor (critério 5 do ROADMAP)"
    - "Um dump baixado do armazenamento externo foi restaurado num Postgres limpo e os dados conferem"
    - "Existe um documento em português que permite repetir a restauração sozinho num dia ruim"
  artifacts:
    - docs/operacao/03-backup-e-restauracao.md
  key_links:
    - "O agendamento vive no `cron` do host, nunca no Compose — ele não tem agendador"
    - "A autorização do `rclone` acontece na máquina do dono, que tem navegador, e o resultado é colado no servidor — o VPS não tem navegador"
    - "A virada de `DATABASE_URL` para o papel de aplicação e a definição da senha dele acontecem juntas; `/api/health` é a prova imediata"
    - "O dump manual do passo 2 é a rede de proteção da própria migração desta fase, que é quem cria a tabela onde o backup se registra"

coverage:
  - id: D1
    description: "Existe um roteiro comentado, em português, que leva o servidor do estado atual ao backup diário funcionando"
    requirement: "BKP-07"
    verification:
      - kind: manual_procedural
        ref: "docs/operacao/03-backup-e-restauracao.md — cada comando com o que faz e o que você deve ver, no formato dos roteiros 01 e 02"
        status: unknown
    human_judgment: true
    rationale: "A qualidade de um roteiro só se mede por alguém executando-o. A Fase 1 provou isso: nove das quinze correções vieram da execução real, não de revisão."
  - id: D2
    description: "As contas de gestor foram criadas em produção pela linha de comando"
    requirement: "AUTH-07"
    verification: []
    human_judgment: true
    rationale: "Nomes e e-mails reais são informados na hora, no servidor, e nunca entram no repositório nem no chat (D-07). Só o dono pode executar e confirmar."
  - id: D3
    description: "O backup de ontem existe no servidor e também no armazenamento externo"
    requirement: "BKP-01, BKP-02"
    verification: []
    human_judgment: true
    rationale: "Exige acesso por SSH ao VPS e acesso à conta do Drive do ateliê. O agente não entra no servidor (D-03 da Fase 1) e não tem credencial do Drive."
  - id: D4
    description: "/api/health/backup responde ok em produção e um monitor externo o vigia"
    requirement: "BKP-04"
    verification:
      - kind: other
        ref: "curl da rota pelo domínio público, conferido de fora do servidor pelo orquestrador"
        status: unknown
    human_judgment: true
    rationale: "A resposta da rota é conferível de fora, mas o cadastro do monitor externo e a chegada do alerta por e-mail só o dono vê."
  - id: D5
    description: "Um dump baixado do armazenamento externo foi restaurado num Postgres limpo e os dados conferem"
    requirement: "BKP-06"
    verification: []
    human_judgment: true
    rationale: "A restauração real depende do arquivo que está na conta do Drive do ateliê e de um Postgres limpo no VPS. É a prova que D-11 exige antes de qualquer dado real do ateliê entrar no sistema."
---

<objective>
Escrever o terceiro roteiro de servidor — a virada de produção e o backup diário — e acompanhar a
execução real dele pelo dono, até a restauração de verdade.

Purpose: `D-11` é explícito: **nenhum dado real do ateliê entra no sistema antes de o dump existir
E ter sido restaurado uma vez.** Enquanto essa prova não acontecer, tudo que a Fase 2a construiu é
promessa. E `D-10` lembra que o Auto Backup da Contabo estava com incidente aberto no encerramento
da Fase 1 — hoje o ateliê tem uma camada só de proteção, e degradada.

Output: `docs/operacao/03-backup-e-restauracao.md` no formato dos dois roteiros existentes, e a
execução real conferida de fora.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-07-SUMMARY.md
</context>

<constraints>
- **O agente não entra no servidor por SSH.** Vale a decisão D-03 da Fase 1: os passos de servidor
  são entregues como roteiro comentado que o dono executa, cada comando com **o que faz** e **o
  que você deve ver**. O papel do agente é escrever o roteiro, guiar a execução e conferir de fora.
- **D-09: o endereço da conta do Drive do ateliê não aparece em nenhum arquivo do repositório**,
  nem no roteiro. Refira-se sempre a "a conta do Drive do ateliê".
- **D-07: nenhum nome ou e-mail real** em nenhum arquivo. Os exemplos usam nomes inventados e o
  domínio `exemplo.test`.
- **Nenhuma migração pelo pipeline.** Migração à mão, depois de backup, por alguém olhando.
- Comandos da máquina do dono são de **Windows/PowerShell**; comandos do servidor são de Ubuntu.
  A Fase 1 perdeu tempo com utilitários que não existem no Windows — não repita.
- Marcadores entre sinais angulares saem junto com o valor, como nos roteiros 01 e 02.
</constraints>

<tasks>

<task type="auto">
  <name>Tarefa 1: Roteiro 3, parte 1 — da migração ao backup diário rodando sozinho</name>
  <files>docs/operacao/03-backup-e-restauracao.md</files>
  <read_first>
    - `docs/operacao/01-preparar-servidor.md` e `docs/operacao/02-publicar-e-dominio.md` inteiros —
      o formato é o produto aqui: cabeçalho de marcadores, aviso sobre os sinais angulares, cada
      bloco com "o que faz" e "o que você deve ver", e o pedido de parar quando a tela divergir
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md`, seção "Desvios e
      descobertas" — as nove correções que vieram de alguém executando (senha invisível ao digitar,
      editor que fecha sem gravar, paginador que prende o terminal, utilitários ausentes no Windows)
    - `amassa-plataforma/01-ARQUITETURA.md` §7 (a linha do agendador e as quatro camadas) e §6
      (o arquivo de ambiente do servidor)
    - `scripts/backup.sh` e as variáveis que ele lê
    - `docker/compose.yml` e `docs/operacao/01-preparar-servidor.md` passo 8 (o `.env` atual, que
      hoje aponta a aplicação para o dono do banco)
  </read_first>
  <action>
    Escreva `docs/operacao/03-backup-e-restauracao.md` no mesmo formato dos dois anteriores, com
    esta sequência de passos. A ordem importa e cada passo diz por que vem onde vem.

    **0. Reconferir o Auto Backup da Contabo.** No encerramento da Fase 1 havia incidente aberto,
    com restores indisponíveis. Confira no painel se está ativo e se há cópia recente. Se ainda
    estiver degradado, siga assim mesmo — é justamente por isso que as camadas 1 a 3 existem — mas
    registre o estado.

    **1. Conferir que a versão nova está no ar.** A publicação é automática desde a Fase 1: confira
    pelo domínio que `/api/health` responde e que `/login` já aparece.

    **2. Dump manual, antes de qualquer migração.** Um comando só, gerando o dump direto do
    contêiner do Postgres para um arquivo em `/opt/amassa`. Explique por que este é manual e não
    usa o script: o script registra o resultado numa tabela que **esta migração ainda vai criar**.
    É o único momento do projeto em que essa ordem se inverte, e escrever isso evita que pareça
    descuido. Confira o tamanho do arquivo antes de seguir.

    **3. Aplicar as migrações desta fase**, à mão, pelo estágio `ferramentas`, com a saída na tela.
    Depois, conferir do lado do banco: as três tabelas esperadas, a função de data, o trigger e o
    papel de aplicação.

    **4. Virar a conexão da aplicação para o papel de aplicação.** Três movimentos, nesta ordem:
    gerar uma senha aleatória no próprio servidor; defini-la para o papel de aplicação usando o
    comando do cliente do Postgres que **pede a senha sem exibi-la** (não a passe como argumento —
    ela ficaria no histórico do terminal); e editar o arquivo de ambiente acrescentando a variável
    de conexão de migração com o dono e trocando a conexão da aplicação para o papel novo. Avise,
    como o roteiro 01 faz, que a senha digitada não aparece na tela e que isso é esperado. Em
    seguida recrie **apenas o serviço da aplicação** e confira `/api/health` pelo domínio — é a
    prova imediata de que os privilégios estão certos. Se a rota devolver erro de banco, a causa
    é sempre uma destas três: senha divergente entre o comando e o arquivo, privilégio faltando,
    ou o serviço não recriado. Liste-as no roteiro.

    **5. Criar as contas de gestor.** O comando pelo estágio `ferramentas`, com o exemplo usando
    nome inventado e domínio `exemplo.test`. Avise em destaque: a senha aparece **uma única vez**;
    copie para um gerenciador de senhas antes de fechar o terminal; perder significa rodar o
    comando de redefinição, não recuperar. Repita para cada gestora. Ao final, entre pela tela de
    login com uma das contas para confirmar.

    **6. Instalar os scripts de backup no host.** Explique por que eles precisam estar no **host** e
    não dentro de um contêiner: quem dispara é o agendador do sistema, e o Compose não tem
    agendador — um serviço declarado nele roda uma vez e morre. Extraia os dois scripts da imagem
    `ferramentas` já publicada, redirecionando a saída para arquivos em `/opt/amassa/scripts`;
    assim a versão no host é exatamente a que está no ar, e não uma cópia que envelhece sozinha.
    Dê permissão de execução, crie o diretório de backups e o subdiretório mensal, e restrinja o
    acesso ao diretório — o conteúdo é o banco inteiro em texto.

    **7. Configurar o envio externo.** Instale o `rclone` no servidor. Ao configurar o destino da
    conta do Drive do ateliê, o programa vai perguntar se pode abrir um navegador para autorizar:
    responda que **não** — o VPS não tem navegador. Ele então imprime um comando para rodar na
    máquina do dono. Instale o `rclone` no Windows, rode esse comando lá, autorize no navegador
    com a conta do Drive do ateliê, e cole o texto devolvido de volta no servidor.

    > Trate essa colagem com o mesmo cuidado da chave SSH da Fase 1, que chegou corrompida por
    > copiar-e-colar: é **uma linha só**, longa; a quebra visual na tela é normal, mas não aperte
    > Enter no meio. Se o programa recusar, refaça o comando na máquina do dono em vez de tentar
    > consertar o texto à mão.

    Crie a pasta de destino na conta do Drive, defina a variável do destino no arquivo de ambiente,
    e confira listando o conteúdo do destino a partir do servidor — a listagem funcionando é a
    prova de que a autorização chegou inteira.

    **8. Primeiro backup de verdade.** Rode o script com a opção de disparo sob demanda. Confira
    quatro coisas, nesta ordem: o arquivo apareceu no diretório local; o arquivo apareceu na conta
    do Drive; a tabela de execuções ganhou uma linha com sucesso e cópia externa confirmada; e a
    rota de saúde do backup responde `ok` pelo domínio público.

    **9. Agendar.** Acrescente a linha ao agendador do host, com a saída indo para um arquivo de
    log, e confira listando o agendamento. Explique o horário escolhido e diga como conferir o log
    no dia seguinte. Avise que o agendador roda no fuso do servidor.

    **10. Vigiar de fora.** Cadastre um monitor externo apontando para a rota de saúde do backup, a
    cada cinco minutos, com alerta por e-mail — o mesmo serviço que a Fase 1 já usa. Prove o alerta
    como a Fase 1 provou: force a rota a reprovar (o modo mais simples é adiantar o relógio da
    janela registrando uma execução antiga, ou simplesmente esperar o alerta se algo estiver
    errado) e confirme que o e-mail chega. Um monitor que nunca alertou é um monitor não testado.

    Cada bloco de comando com **o que faz** e **o que você deve ver**. Onde a Fase 1 tropeçou,
    antecipe: paginador que prende a tela, editor que fecha sem gravar, senha invisível ao digitar,
    e utilitário que não existe no Windows.
  </action>
  <verify>
    <automated>test -f docs/operacao/03-backup-e-restauracao.md &amp;&amp; grep -c 'O que você deve ver' docs/operacao/03-backup-e-restauracao.md</automated>
  </verify>
  <acceptance_criteria>
    - O arquivo existe e tem os passos 0 a 10, numerados, na ordem acima.
    - `grep -c 'O que você deve ver' docs/operacao/03-backup-e-restauracao.md` devolve um número
      maior ou igual ao número de blocos de comando do documento.
    - `grep -ci 'gmail\|@gmail\|drive.google.com/drive/folders' docs/operacao/03-backup-e-restauracao.md`
      devolve `0` — nenhum endereço da conta do Drive.
    - `grep -cE '[a-z0-9._%+-]+@(?!exemplo\.test)[a-z0-9.-]+\.[a-z]{2,}' docs/operacao/03-backup-e-restauracao.md`
      devolve `0` — nenhum e-mail que não seja do domínio reservado de exemplo.
    - O passo 2 explica por que o dump é manual naquele momento.
    - O passo 7 diz explicitamente para recusar a abertura de navegador no servidor e traz o aviso
      sobre a colagem em uma linha só.
    - O passo 9 usa o agendador do host, e o documento não sugere em nenhum lugar declarar o
      backup como serviço do Compose.
  </acceptance_criteria>
  <done>Existe um roteiro que leva o servidor da situação atual ao backup diário rodando sozinho e vigiado de fora.</done>
</task>

<task type="auto">
  <name>Tarefa 2: Roteiro 3, parte 2 — restaurar sozinho num dia ruim</name>
  <files>docs/operacao/03-backup-e-restauracao.md, README.md</files>
  <read_first>
    - `scripts/restaurar.sh` (as opções, a confirmação obrigatória e o resumo de contagens)
    - `amassa-plataforma/01-ARQUITETURA.md` §7, subseções "Um backup nunca testado não é um backup"
      e "O que continua exposto, declarado por escrito"
    - `docs/operacao/02-publicar-e-dominio.md` (o tom das conferências finais)
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md`, D-11
  </read_first>
  <action>
    Acrescente ao mesmo documento a segunda metade, que é a razão de o backup existir. Escreva
    para uma pessoa em pânico: frases curtas, um comando por vez, nenhuma decisão implícita.

    **11. Conferir o backup de ontem.** No dia seguinte ao agendamento: o arquivo do dia anterior
    existe no diretório local, existe na conta do Drive, o log do agendador não tem erro, e a rota
    de saúde do backup responde `ok`. Os quatro juntos, não um deles.

    **12. Ensaio de restauração — a prova que falta.** Explique em duas frases por que este passo
    não é opcional e por que ele acontece **antes** de qualquer dado real do ateliê entrar no
    sistema (D-11). Depois:

    - Baixe um dump **da conta do Drive** para um diretório temporário do servidor. Não use o
      arquivo local: o objetivo é provar a camada externa, que é a que existe para quando o
      servidor morre.
    - Suba um Postgres limpo e temporário, isolado do banco de produção, com nome de banco
      diferente. Diga em destaque que ele é descartável e que nada do que acontecer nele toca a
      produção.
    - Restaure com o script, primeiro **sem** a confirmação para ver o que ele diz que faria, e
      depois com a confirmação.
    - Confira os dados: as contas de gestor aparecem com os nomes certos, a contagem de linhas por
      tabela bate com a de produção, e a rota de saúde... aqui, apenas as contagens — a aplicação
      não é apontada para o banco temporário.
    - Derrube e apague o banco temporário e o arquivo baixado.

    **13. Restauração de verdade — o dia ruim.** A versão sem ensaio: o que fazer quando o banco de
    produção se perdeu. Ordem exata: parar a aplicação (não o banco); baixar o dump mais recente da
    conta do Drive; conferir a integridade do arquivo; restaurar sobre o banco de produção com a
    confirmação; conferir as contagens; subir a aplicação; entrar pela tela de login. Diga quanto
    se perde no pior caso — até 24 horas, o intervalo entre o último dump e a falha — e que isso foi
    avaliado e aceito. Termine com a saída barata, caso um dia incomode: rodar o dump de hora em
    hora, uma linha no agendador, custo zero.

    **14. Perguntas que você vai fazer às três da manhã.** Uma lista curta: onde ficam os arquivos,
    quanto tempo cada um é guardado, o que é a pasta mensal, o que fazer se a rota de saúde ficou
    vermelha, o que fazer se o envio externo parou mas o dump local continua, e como saber qual
    dump usar.

    No `README.md`, aponte para o roteiro 3 ao lado dos outros dois, com uma frase dizendo o que
    ele cobre.
  </action>
  <verify>
    <automated>grep -c 'O que você deve ver' docs/operacao/03-backup-e-restauracao.md &amp;&amp; grep -c '03-backup-e-restauracao' README.md</automated>
  </verify>
  <acceptance_criteria>
    - O documento tem os passos 11 a 14.
    - O passo 12 baixa o dump **do armazenamento externo**, não do diretório local, e diz por quê.
    - O passo 13 lista a ordem exata da restauração de produção, começando por parar a aplicação e
      não o banco.
    - O documento declara por escrito a perda máxima aceita e a saída barata.
    - `grep -c '03-backup-e-restauracao' README.md` devolve pelo menos `1`.
    - Nenhum endereço de conta, nome real ou e-mail real aparece no documento.
  </acceptance_criteria>
  <done>Uma pessoa com acesso ao servidor consegue restaurar o banco sozinha seguindo o documento, sem perguntar nada a ninguém.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 3: Executar o roteiro no servidor e provar a restauração de verdade</name>
  <read_first>
    - `docs/operacao/03-backup-e-restauracao.md` completo, escrito nas tarefas 1 e 2
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md` (como a execução real da
      Fase 1 foi conduzida: o dono executa, o orquestrador guia e confere de fora)
  </read_first>
  <action>
    Esta tarefa não pode ser automatizada, e a razão é específica de cada parte:

    - **O agente não entra no servidor por SSH** — decisão D-03 da Fase 1, e ele não tem a chave.
    - **A autorização do armazenamento externo exige um navegador** e as credenciais da conta do
      Drive do ateliê, que só o dono tem.
    - **Os nomes e e-mails das gestoras são informados na hora, no servidor** (D-07), e nunca podem
      passar pelo repositório nem pelo chat.
    - **O painel da Contabo** não tem interface pública que confirme o estado do Auto Backup.

    O que o dono executa, na ordem do documento: os passos 0 a 10 numa sessão, o passo 11 no dia
    seguinte, e o passo 12 (o ensaio de restauração) logo depois.
  </action>
  <instructions>
    Para o dono, na ordem:

    1. Abra `docs/operacao/03-backup-e-restauracao.md` e siga os passos **0 a 10** numa sessão de
      terminal, comando a comando. Se a tela divergir muito do "o que você deve ver", pare naquele
      passo e relate — não siga para o próximo. É assim que o problema fica localizável onde
      aconteceu, em vez de aparecer três passos depois sem explicação.
    2. Tenha à mão, antes de começar: acesso por SSH ao VPS, o gerenciador de senhas aberto (a
      senha do papel de aplicação e as das gestoras aparecem uma única vez), as credenciais da
      conta do Drive do ateliê, e o `rclone` instalado na sua máquina Windows para o passo 7.
    3. No passo 5, decida quantas contas de gestor criar e com quais nomes e e-mails. Eles são
      digitados no servidor, na hora. Não os escreva no chat, em nenhum arquivo, em nenhum commit.
    4. No dia seguinte, execute o passo **11**.
    5. Logo depois, execute o passo **12** — o ensaio de restauração. Ele é obrigatório: enquanto
      ele não acontecer, nenhum dado real do ateliê pode entrar no sistema (D-11).
    6. Relate ao orquestrador, para cada conferência, o que apareceu na tela — contagens e estados,
      nunca nomes ou e-mails.
  </instructions>
  <verification>
    O orquestrador confere **de fora**, sem aceitar o relato de quem executou — foi assim que a
    Fase 1 encontrou os problemas que encontrou:

    1. `curl` da rota de saúde do backup pelo domínio público devolve `ok` com idade menor que 26
      horas. No dia seguinte ao agendamento, devolve `ok` de novo — é a diferença entre "rodou uma
      vez" e "está rodando".
    2. `curl` da raiz do domínio sem cookie devolve redirecionamento para `/login`, e `/login`
      responde 200 — a autenticação está no ar em produção, atrás do proxy, com a confiança no
      host valendo.
    3. O dono relata, e o orquestrador registra: quantas contas de gestor existem (só a contagem,
      nunca os nomes), que o arquivo do dia anterior aparece na conta do Drive, e que o log do
      agendador não tem erro.
    4. Do ensaio de restauração, o dono relata as contagens por tabela do banco temporário e do
      banco de produção. Elas precisam bater. Essa é a prova que D-11 exige.
    5. O monitor externo foi cadastrado e o alerta chegou pelo menos uma vez.

    Se qualquer conferência divergir, pare e corrija o roteiro — a correção vai para o documento,
    como aconteceu nove vezes na Fase 1. O roteiro é entregável tanto quanto o servidor.
  </verification>
  <acceptance_criteria>
    - A rota de saúde do backup responde `ok` pelo domínio público, conferido de fora, em dois dias
      diferentes.
    - A raiz do domínio sem sessão redireciona para `/login`, conferido de fora.
    - Existe pelo menos uma conta de gestor em produção e o dono conseguiu entrar por ela.
    - O arquivo do dia anterior existe no servidor **e** na conta do Drive do ateliê.
    - O ensaio de restauração foi feito a partir do arquivo baixado do armazenamento externo, num
      Postgres limpo, e as contagens por tabela batem com as de produção.
    - O monitor externo está cadastrado e o alerta foi recebido ao menos uma vez.
    - Toda correção descoberta durante a execução foi commitada em
      `docs/operacao/03-backup-e-restauracao.md`.
    - Nenhum nome, e-mail ou endereço de conta real entrou em nenhum commit.
  </acceptance_criteria>
  <resume-signal>Responda "executado" com o resultado de cada conferência, ou descreva onde o roteiro divergiu da tela.</resume-signal>
  <done>O backup diário está rodando, vigiado de fora, e um dump do armazenamento externo já virou banco de novo com os dados conferidos.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| máquina do dono → servidor | a autorização do armazenamento externo e a senha do papel de aplicação atravessam por colagem no terminal |
| servidor → conta do Drive do ateliê | os dados do ateliê saem do VPS aqui, com credencial guardada no servidor |
| documento público → operação real | o roteiro fica num repositório público e descreve como operar o sistema |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-39 | Information Disclosure | roteiro em repositório público | high | mitigate | Nenhum endereço, nome, e-mail, senha, IP ou identificador de pasta real no documento; só marcadores entre sinais angulares e o domínio reservado de exemplo. Conferido por critério de aceite com busca |
| T-02a-40 | Information Disclosure | senha do papel de aplicação no histórico do terminal | high | mitigate | O roteiro usa a forma do cliente do Postgres que pede a senha sem exibi-la, em vez de passá-la como argumento de comando |
| T-02a-41 | Tampering | credencial do armazenamento externo corrompida na colagem | medium | mitigate | Aviso explícito de linha única, com a listagem do destino a partir do servidor como conferência imediata; refazer é a orientação, nunca consertar o texto à mão |
| T-02a-42 | Denial of Service | migração aplicada sem rede de proteção | high | mitigate | Passo 2 gera um dump manual antes da migração, e o roteiro explica por que naquele momento ele não pode usar o script |
| T-02a-43 | Repudiation | backup que para de rodar em silêncio | critical | mitigate | Monitor externo a cada cinco minutos sobre a rota de saúde do backup, com alerta por e-mail provado ao menos uma vez |
| T-02a-44 | Denial of Service | dump que nunca foi restaurado | critical | mitigate | Ensaio de restauração obrigatório no passo 12, a partir do arquivo baixado do armazenamento externo, com conferência de contagens — é o que D-11 exige antes de qualquer dado real entrar |
</threat_model>

<verification>
1. O documento existe, cobre os passos 0 a 14 e não contém nenhum dado real.
2. As conferências de fora (rota de saúde do backup, redirecionamento da raiz) passam pelo domínio
   público, em dois dias diferentes.
3. O ensaio de restauração foi feito a partir do armazenamento externo, com contagens conferidas.
4. Toda correção da execução real está commitada no roteiro.
</verification>

<success_criteria>
- O backup de ontem existe no servidor e no armazenamento externo (BKP-01, BKP-02).
- A rota de saúde do backup responde `ok` em produção e é vigiada de fora (BKP-04).
- Um dump do armazenamento externo foi restaurado num Postgres limpo e os dados conferem (BKP-06).
- Existe um documento em português que permite repetir a restauração sozinho (BKP-07).
- As contas de gestor existem em produção, criadas pela linha de comando (AUTH-07).

## Artifacts this phase produces

Criados por este plano:

| Artefato | Conteúdo |
|---|---|
| `docs/operacao/03-backup-e-restauracao.md` | passos 0 a 10 (virada de produção, contas, scripts no host, envio externo, agendamento, monitor), 11 a 13 (conferência do dia seguinte, ensaio de restauração, restauração de verdade) e 14 (perguntas das três da manhã) |
| `README.md` | apontamento para o roteiro 3 |
| Em produção | papel de aplicação com senha, conexão da aplicação virada, contas de gestor, scripts no host, destino externo configurado, agendamento ativo, monitor externo cadastrado |
</success_criteria>

## Risks

- A execução real vai encontrar problemas que nenhuma revisão pega — a Fase 1 encontrou quinze.
  Isso é esperado e é metade do valor deste plano. Cada correção vira commit no roteiro.
- O incidente aberto no Auto Backup da Contabo pode continuar. Não bloqueia esta fase; ao
  contrário, é o argumento de urgência dela. Registre o estado observado no SUMMARY.
- Se o ensaio de restauração falhar, **a fase não fecha**. Não há como afirmar BKP-06 por
  inspeção, e D-11 impede que dados reais entrem antes dele.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-08-SUMMARY.md` when done
</output>
