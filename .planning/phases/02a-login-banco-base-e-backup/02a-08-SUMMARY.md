---
phase: 02a-login-banco-base-e-backup
plan: 08
subsystem: infra
tags: [postgres, rclone, cron, docker, backup, disaster-recovery, docs-operacao]

# Dependency graph
requires:
  - phase: 02a-07
    provides: "scripts/backup.sh, scripts/restaurar.sh e npm run test:backup provados de ponta a
      ponta sem servidor — é o que este plano instala e executa de verdade"
  - phase: 02a-06
    provides: "tabela execucoes_backup e GET /api/health/backup — é o que o roteiro confere em
      produção e o monitor externo vigia"
  - phase: 02a-02
    provides: "DATABASE_URL vs DATABASE_URL_MIGRACAO, papel amassa_app com grants — é o papel
      para o qual a aplicação vira neste plano"
  - phase: 02a-05
    provides: "scripts/criar-usuario.ts pelo estágio ferramentas — é o comando que cria as contas
      de gestor no passo 5 do roteiro"
provides:
  - "docs/operacao/03-backup-e-restauracao.md — roteiro 3 (passos 0-14), corrigido 11 vezes
    durante a execução real em produção, cobrindo virada de DATABASE_URL, contas de gestor,
    backup diário agendado, monitor externo testado e restauração real"
  - "Produção: papel amassa_app com senha própria, DATABASE_URL virado, conta(s) de gestor
    criadas com login real confirmado, scripts de backup no host, rclone autorizado contra a
    conta do Drive do ateliê, cron agendado (06:15 UTC), monitor externo cadastrado com alerta
    por e-mail provado nos dois sentidos, ensaio de restauração provado (D-11 satisfeita)"
  - "docker/Dockerfile: estágio ferramentas agora copia lib/ — scripts de conta dependiam dele
    e falhavam com MODULE_NOT_FOUND na primeira conta criada em produção"
  - "scripts/restaurar.sh: corrigido o bug em que o laço de contagem de tabelas engolia o
    próprio stdin dentro de um docker exec, mostrando só a primeira tabela no aviso de perda"
  - ".planning/phases/02a-login-banco-base-e-backup/deferred-items.md — o bug de callbackUrl
    descoberto na conferência externa, fora do escopo de arquivos deste plano"
affects: [02b-design-system-e-casca, qualquer fase futura que precise repetir a restauração]

# Actuals (#2632)
actuals:
  tokens: 12400
  tasks: 3
  commits: 23

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Teste comprimido do disparo do cron (uma linha temporária, poucos minutos à frente) em
      vez de esperar 24h pelo passo 11 original — descobre um daemon parado NA HORA, não a 26
      horas de distância do sintoma. Virou o passo 9.1, formal, do roteiro."
    - "Reiniciar o daemon do cron depois de qualquer mudança de fuso do sistema — ele lê TZ só
      na inicialização; crontab -l, systemctl is-active e o journal continuam todos 'normais'
      enquanto o job simplesmente nunca dispara, sem nenhuma mensagem de erro"
    - "docker compose pull <serviço> antes de docker compose run --rm <serviço> para imagens de
      tag móvel (:ferramentas) que o job implantar do pipeline não atualiza sozinho — só puxa
      :latest (o app)"
    - "< /dev/null obrigatório em todo laço `while read` que chama docker exec/docker compose
      exec por dentro — o cliente do Docker lê o stdin do processo mesmo com -T, engolindo o
      resto da lista que o laço ainda não consumiu"
    - "O dump não carrega CREATE ROLE (papéis são objetos do cluster inteiro, não do banco) —
      restaurar num cluster novo exige migrar antes, nunca só restaurar"

key-files:
  created:
    - docs/operacao/03-backup-e-restauracao.md
    - .planning/phases/02a-login-banco-base-e-backup/deferred-items.md
  modified:
    - README.md
    - docker/Dockerfile
    - scripts/restaurar.sh
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/WINDOWS.md

key-decisions:
  - "Servidor normalizado para Etc/UTC em vez de compensar o fuso de Brasília só dentro da linha
    do cron — mais simples de auditar (a linha do agendamento não muda dependendo de como o
    servidor foi provisionado), ao custo de o roteiro precisar converter 3h15 de Brasília para
    6h15 UTC por escrito."
  - "O teste comprimido do disparo do cron virou passo formal 9.1 do roteiro, e não uma nota de
    rodapé — esperar o dia seguinte (o passo 11 original) teria escondido a causa (fuso mudado
    sem reiniciar o daemon) a 26 horas de distância do sintoma, tempo suficiente para a
    investigação começar pelo lugar errado (o script, o rclone, o Drive)."
  - "execucoes_backup diverge por construção entre o banco do ensaio de restauração e a
    produção — o próprio backup.sh grava uma linha nessa tabela DEPOIS de gerar o dump, então
    todo dump carrega uma linha a menos do que a produção tem no momento da comparação. Só
    usuarios e verificacao_infraestrutura precisam bater exatamente; a diferença de 1 linha em
    execucoes_backup não é falha, é a ordem das operações."
  - "O bug de callbackUrl vazando o endereço interno do contêiner (0.0.0.0:3000) foi registrado
    em WINDOWS.md e deferred-items.md, não corrigido agora — está fora de files_modified deste
    plano (a causa provável mora em lib/auth/auth.config.ts / middleware.ts, território das
    fases 02a-03/02a-04), e a regra de fronteira de escopo do executor só autoriza correção
    automática do que a mudança da tarefa atual causou."

patterns-established:
  - "Teste comprimido de agendamento (cron) como passo formal do roteiro, sempre que uma prova
    dependeria de esperar um ciclo inteiro (24h) — comprimir o intervalo para minutos localiza a
    causa na hora"
  - "< /dev/null em laços que envolvem docker exec/docker compose exec, sempre que o laço lê sua
    própria lista de itens do stdin"

requirements-completed: [AUTH-07, BKP-01, BKP-02, BKP-04, BKP-06, BKP-07]

coverage:
  - id: D1
    description: "Existe um roteiro comentado, em português, que leva o servidor do estado atual ao backup diário funcionando"
    requirement: "BKP-07"
    verification:
      - kind: manual_procedural
        ref: "Execução real completa do roteiro em produção pelo dono, passos 0-12, com 20 commits durante a execução (11 correções no próprio roteiro, 2 correções de código — ver Deviations)"
        status: pass
    human_judgment: true
    rationale: "A qualidade de um roteiro só se mede por alguém executando-o de verdade — a Fase 1 já tinha provado isso, e este plano confirmou de novo: a execução real rendeu 11 correções que nenhuma revisão de texto pegaria. Este agente não presenciou a sessão de terminal, só os commits resultantes e os endpoints externamente observáveis."
  - id: D2
    description: "As contas de gestor foram criadas em produção pela linha de comando, e o login real funciona"
    requirement: "AUTH-07"
    verification:
      - kind: manual_procedural
        ref: "Relato do dono via orquestrador: docker compose run --rm ferramentas npm run criar-usuario executado no servidor; login real no navegador; a tela protegida respondeu 'Você está autenticado' (critérios 5 e 6 do ROADMAP)"
        status: pass
      - kind: other
        ref: "curl -s -o /dev/null -w '%{http_code}' https://amassacerrado.com.br/login → 200, verificado por este agente de fora depois do relato"
        status: pass
    human_judgment: true
    rationale: "Nomes e e-mails reais nunca passam pelo agente nem pelo chat (D-07) — só o dono confirma que a conta existe e loga."
  - id: D3
    description: "O backup de ontem existe no servidor e também no armazenamento externo"
    requirement: "BKP-01, BKP-02"
    verification:
      - kind: manual_procedural
        ref: "Relato do dono: mesmo arquivo, mesmo tamanho em bytes, no diretório local e na conta do Drive do ateliê; três execuções em execucoes_backup, todas sucesso=t e destino_externo_ok=t"
        status: pass
      - kind: other
        ref: "curl -s https://amassacerrado.com.br/api/health/backup, verificado por este agente de fora depois do relato: {\"status\":\"ok\",\"ultimoBackupEm\":\"2026-08-08T14:25:44.605Z\",\"idadeEmHoras\":0.21}"
        status: pass
    human_judgment: true
    rationale: "Exige acesso por SSH ao VPS e à conta do Drive do ateliê, que o agente não tem (D-03, D-09)."
  - id: D4
    description: "/api/health/backup responde ok em produção e um monitor externo o vigia, com alerta provado"
    requirement: "BKP-04"
    verification:
      - kind: other
        ref: "curl da rota de saúde do backup pelo domínio público, conferido por este agente de fora, depois do relato do dono: status ok, idade 0.21h"
        status: pass
      - kind: manual_procedural
        ref: "Relato do dono: rota forçada a reprovar (linha envelhecida em execucoes_backup, 503), o monitor externo detectou e o e-mail de alerta chegou; rota restaurada para ok em seguida"
        status: pass
    human_judgment: true
    rationale: "A resposta da rota é conferível de fora e este agente já reconferiu; o cadastro do monitor externo e a chegada real do e-mail só o dono vê a caixa de entrada."
  - id: D5
    description: "Um dump baixado do armazenamento externo foi restaurado num Postgres limpo e os dados conferem"
    requirement: "BKP-06"
    verification:
      - kind: manual_procedural
        ref: "Relato do dono: dump baixado da conta do Drive do ateliê, restaurado num Postgres temporário e descartável (fora do compose.yml de produção); contagens usuarios 1=1 e verificacao_infraestrutura 1=1 batendo com produção; execucoes_backup diferiu em exatamente 1 linha, a diferença esperada por construção (ver key-decisions)"
        status: pass
    human_judgment: true
    rationale: "Depende do dump real na conta do Drive do ateliê e de um Postgres temporário no VPS — fora do alcance do agente (D-03, D-09). É a prova que D-11 exigia antes de qualquer dado real do ateliê entrar no sistema."

duration: ~4h50min de execução real no servidor (Tarefa 3), mais a autoria do roteiro (Tarefas 1-2)
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 08: Roteiro 3 — Virada de Produção e Backup Diário Summary

**`docs/operacao/03-backup-e-restauracao.md` executado de ponta a ponta em produção — papel
`amassa_app` ativo, contas de gestor com login real, backup diário agendado e provado em três
lugares (disco, Drive, `/api/health/backup`), monitor externo com alerta por e-mail confirmado, e
o ensaio de restauração que D-11 exigia, com as contagens batendo.**

## Performance

- **Duration:** ~4h50min de execução real no servidor (10:40-15:30, Tarefa 3), dominada por
  troubleshooting ao vivo (fuso do `cron`, imagem `ferramentas` desatualizada, assistente do
  `rclone`), mais a autoria do roteiro nas Tarefas 1-2
- **Tasks:** 3 (Tarefas 1 e 2 autorais; Tarefa 3 é o checkpoint `human-action` executado pelo
  dono, acompanhado pelo orquestrador comando a comando)
- **Files modified:** 8 (2 novos, 6 modificados — ver `key-files`)

## Accomplishments

- `docs/operacao/03-backup-e-restauracao.md` escrito no formato dos roteiros 01 e 02 (passos 0
  a 14, cada comando com "o que faz" e "o que você deve ver"), e depois **corrigido 11 vezes**
  durante a execução real — a mesma proporção de descoberta-por-uso que a Fase 1 já tinha
  registrado (9 correções em 15 critérios).
- Produção virou de fato: `DATABASE_URL` aponta para o papel `amassa_app` (sem posse de tabela,
  sem privilégio de definição de estrutura), a senha foi definida pelo `\password` do `psql`
  (nunca em argumento de linha de comando), e `/api/health` confirmou os privilégios certos na
  hora.
- Pelo menos uma conta de gestor existe em produção, criada pela linha de comando, com login
  real confirmado no navegador — a tela protegida respondeu "Você está autenticado".
- O backup diário roda sozinho: agendado no `cron` do host (06:15 UTC, servidor normalizado
  para `Etc/UTC`), enviado à conta do Drive do ateliê via `rclone`, registrado em
  `execucoes_backup`, e `/api/health/backup` responde `ok` — reconferido por este agente, de
  fora, depois do relato (`idadeEmHoras: 0.21`).
- O monitor externo foi cadastrado e **provado nos dois sentidos**: a rota foi forçada a
  reprovar (envelhecendo a linha mais recente de `execucoes_backup`) e o e-mail de alerta
  chegou; a rota foi restaurada e voltou a responder `ok`.
- O ensaio de restauração — a prova que D-11 exige antes de qualquer dado real do ateliê entrar
  no sistema — aconteceu de verdade: um dump baixado da conta do Drive do ateliê restaurado num
  Postgres limpo e descartável, isolado da produção, com as contagens de `usuarios` e
  `verificacao_infraestrutura` batendo exatamente.
- O achado mais importante da execução: o `cron` não estava disparando depois de o servidor ser
  normalizado para UTC, porque o daemon só lê o fuso na inicialização — nada no `crontab -l`,
  `systemctl is-active` ou no journal denunciava isso. Um teste comprimido (linha temporária
  poucos minutos à frente, em vez de esperar o dia seguinte) pegou o problema na hora; virou o
  passo 9.1, formal, do roteiro.

## Task Commits

Cada tarefa foi commitada atomicamente. A Tarefa 3 (checkpoint `human-action`) gerou uma série
de commits durante a execução real — agrupados abaixo por assunto, na ordem em que aconteceram:

**Tarefa 1+2: o roteiro e o apontamento do README**
1. `287e6c1` (docs) — roteiro completo, passos 0-14, autorado de uma vez
2. `611926b` (docs) — README aponta para o roteiro 3

**Tarefa 3: execução real e correções nascidas dela**
3. `d83c687` / `9b83a6b` (docs) — passo 1: publicar exige `git push`, não só commit; diagnóstico do 404
4. `2d92754` (docs) — passo 3: `docker compose pull ferramentas` antes de migrar (tag móvel)
5. `cb161c5` (docs) — passo 3: `db:migrate` não lista migrações; quem prova são as conferências
6. `438567a` (fix) — `docker/Dockerfile`: estágio `ferramentas` passa a copiar `lib/`
7. `b202c8d` / `01c2476` (docs) — passo 7: `sudo -v` antes, `curl -fsSL`; registro dos passos 1-5
8. `4ceeb85`, `79e7d86`, `a8e1851` (docs) — passo 7: texto variável do assistente do `rclone`, `client_id`/`client_secret` em branco, a negativa dupla do cliente compartilhado
9. `6db91da` (docs) — passo 9: normalizar o servidor para UTC em vez de compensar no `cron`
10. `7a10aba` (docs) — passo 10: envelhecer TODAS as linhas de `execucoes_backup`, não só a mais recente
11. `639eeee` (docs) — passo 12: `execucoes_backup` diverge por construção, não é falha
12. `32a8435` (docs) — passos 12/13: o dump não carrega `CREATE ROLE`; migrar antes de restaurar em cluster novo
13. `95a932f` (fix) — `scripts/restaurar.sh`: `< /dev/null` no laço de contagem, o `docker exec` engolia o próprio stdin
14. `3dc999c` (docs) — registro de D4 e D-11 provadas em produção
15. `11dbcc0` (docs) — passo 9: reiniciar o `cron` depois da mudança de fuso, e o novo passo 9.1

**Registro do checkpoint e achados fora de escopo**
16. `3fa36f1` (docs) — STATE.md registrando a pausa no checkpoint `human-action`
17. (este commit) `docs` — `.planning/WINDOWS.md` e `deferred-items.md`: bug de `callbackUrl` vazando endereço interno, descoberto na conferência externa, fora do escopo de arquivos deste plano

**Plan metadata:** este `SUMMARY.md`, e o commit final com `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md`, a seguir.

## Files Created/Modified

- `docs/operacao/03-backup-e-restauracao.md` (novo) — o roteiro 3 completo, passos 0-14
- `README.md` — aponta para o roteiro 3 ao lado dos roteiros 1 e 2
- `docker/Dockerfile` — estágio `ferramentas` copia `lib/` (scripts de conta dependem de
  `lib/auth/senha`)
- `scripts/restaurar.sh` — `< /dev/null` no laço de contagem de tabelas
- `.planning/phases/02a-login-banco-base-e-backup/deferred-items.md` (novo) — o bug de
  `callbackUrl` fora do escopo deste plano
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
  `.planning/WINDOWS.md` — posição, requisitos completos e o registro do achado fora de escopo

## Decisions Made

Ver `key-decisions` no frontmatter — resumo: servidor normalizado para UTC (mais simples de
auditar que compensar no `cron`); teste comprimido do disparo do `cron` virou passo formal 9.1;
`execucoes_backup` diverge por construção entre ensaio e produção, só `usuarios` e
`verificacao_infraestrutura` precisam bater; o bug de `callbackUrl` foi registrado, não
corrigido, por estar fora dos `files_modified` deste plano.

## Deviations from Plan

### Auto-fixed Issues (corrigidas durante a execução real, pelo dono, acompanhado pelo orquestrador)

**1. [Rule 1 - Bug] Passo 1 do roteiro assumia publicação automática sem checar o `push`**
- **Found during:** Tarefa 3, passo 1
- **Issue:** 42 commits estavam parados na máquina do dono sem `git push`; `/login` respondia
  404 enquanto `/api/health` respondia `ok`, porque só as rotas novas da fase faltavam publicar.
- **Fix:** Roteiro corrigido para explicitar que publicar exige `push`, com o diagnóstico do 404
  incluído.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `d83c687`, `9b83a6b`

**2. [Rule 1 - Bug] Passo 3 rodava `db:migrate` sem garantir a imagem `ferramentas` atualizada**
- **Found during:** Tarefa 3, passo 3
- **Issue:** O job `implantar` do pipeline só puxa a tag `:latest` (o serviço `app`); a tag
  `:ferramentas` é móvel e `docker compose run` usa a cópia local, que pode estar desatualizada.
- **Fix:** `docker compose pull ferramentas` acrescentado antes de migrar.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `2d92754`

**3. [Rule 1 - Bug] Passo 3 não avisava que `db:migrate` não lista as migrações aplicadas**
- **Found during:** Tarefa 3, passo 3
- **Issue:** O `migrate()` do Drizzle é silencioso; o roteiro dava a entender que a saída
  provaria o resultado.
- **Fix:** Texto corrigido para deixar claro que quem prova são as três conferências seguintes
  (tabelas, função, papel), não a saída do comando.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `cb161c5`

**4. [Rule 3 - Blocking] Estágio `ferramentas` não copiava `lib/`, quebrando `criar-usuario`**
- **Found during:** Tarefa 3, passo 5 (primeira conta de gestor)
- **Issue:** `criar-usuario.ts`/`redefinir-senha.ts` importam `gerarHash`/`gerarSenhaForte` de
  `../lib/auth/senha`. A imagem `ferramentas` só copiava `db/` e `scripts/`; a falha só
  aparecia como `MODULE_NOT_FOUND` na hora de criar a primeira conta em produção — longe da
  causa (`db:migrate` funciona normalmente, porque `db/` não depende de `lib/`).
- **Fix:** `docker/Dockerfile` ganhou `COPY lib ./lib` no estágio `ferramentas`, com comentário
  explicando por quê.
- **Files modified:** docker/Dockerfile
- **Committed in:** `438567a`

**5. [Rule 1 - Bug] Passo 7 não preparava a barra de progresso do `curl` nem a senha do `sudo`**
- **Found during:** Tarefa 3, passo 7 (instalação do `rclone`)
- **Issue:** `curl https://rclone.org/install.sh | sudo bash` pede a senha do `sudo` no meio da
  barra de progresso do `curl`, e o pedido fica atropelado — parece travado.
- **Fix:** Roteiro corrigido para autenticar `sudo -v` antes e usar `curl -fsSL` (silencioso).
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `b202c8d`

**6. [Rule 1 - Bug] Passo 7 citava o texto exato da pergunta sobre abrir o navegador**
- **Found during:** Tarefa 3, passo 7
- **Issue:** O texto da pergunta do `rclone config` muda conforme a versão instalada; o roteiro
  citava uma frase específica que não bateu.
- **Fix:** Corrigido para orientar por sentido da pergunta, não pelo texto exato, e acrescentado
  como sair caso a resposta `y` seja dada por engano.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `4ceeb85`

**7. [Rule 1 - Bug] Passo 7 não explicava os campos `client_id`/`client_secret` do `rclone`**
- **Found during:** Tarefa 3, passo 7
- **Issue:** O assistente pergunta por esses dois campos sem contexto; o roteiro não dizia que
  deviam ficar em branco nem por quê.
- **Fix:** Explicado que ficam em branco (usam o cliente compartilhado do `rclone`), e por que
  nunca se deve digitar uma senha real ali — o valor vai em texto claro para dentro do
  `config_token`, que é só base64, não criptografia.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `79e7d86`

**8. [Rule 1 - Bug] Passo 7 não cobria a pergunta de confirmação do cliente compartilhado**
- **Found during:** Tarefa 3, passo 7
- **Issue:** `Continue using the shared client_id anyway?` é uma negativa dupla — responder `n`
  faz o assistente exigir um `client_id` próprio, o oposto do esperado por quem lê rápido.
- **Fix:** Roteiro corrigido explicitando a resposta certa e o efeito da errada.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `a8e1851`

**9. [Rule 1 - Bug] Passo 9 compensava o fuso dentro do `cron` e não reiniciava o daemon após mudar o fuso do sistema**
- **Found during:** Tarefa 3, passo 9 — o achado mais importante da execução
- **Issue:** O dono normalizou o fuso do servidor de `Europe/Berlin` para `Etc/UTC` durante a
  sessão. O daemon do `cron` lê o fuso só na inicialização (o processo já estava de pé desde o
  boot); a linha agendada nunca disparou, sem uma única mensagem de erro em `crontab -l`,
  `systemctl is-active cron` ou no journal.
- **Fix:** Roteiro corrigido para normalizar o servidor para UTC (mais simples de auditar do que
  compensar no `cron`) e **reiniciar o `cron`** logo depois de qualquer mudança de fuso.
  Acrescentado o passo 9.1: um teste comprimido do disparo (linha temporária, poucos minutos à
  frente) em vez de esperar o dia seguinte — esperar teria escondido a causa a 26 horas de
  distância do sintoma.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `6db91da`, `11dbcc0`

**10. [Rule 1 - Bug] Passo 10 envelhecia só a linha mais recente de `execucoes_backup`, mascarando o teste com duas linhas**
- **Found during:** Tarefa 3, passo 10 (teste do alerta do monitor externo)
- **Issue:** Com duas linhas na tabela, `UPDATE 1` (a mais recente) ainda deixa a rota
  respondendo `ok` pela linha anterior, se ela também estiver dentro da janela — o teste do
  alerta passaria sem testar nada de verdade.
- **Fix:** Roteiro corrigido para envelhecer TODAS as linhas, e restaurar pelo inverso exato do
  que foi feito (não por `now()`, que mudaria o instante real).
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `7a10aba`

**11. [Rule 1 - Bug] Passo 12 tratava a diferença de contagem em `execucoes_backup` como falha**
- **Found during:** Tarefa 3, passo 12 (ensaio de restauração)
- **Issue:** `execucoes_backup` do banco restaurado tem sempre uma linha a menos que a produção
  no momento da comparação — o próprio `backup.sh` grava a linha DEPOIS de gerar o dump, então
  o dump nunca inclui o registro da sua própria execução. O roteiro original pedia contagens
  batendo em TODAS as tabelas, o que teria feito um ensaio bem-sucedido parecer reprovado.
- **Fix:** Roteiro corrigido explicando a divergência por construção; só `usuarios` e
  `verificacao_infraestrutura` precisam bater exatamente.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `639eeee`

**12. [Rule 1 - Bug] Passos 12/13 não avisavam que o dump não carrega papéis do cluster**
- **Found during:** Tarefa 3, passo 12
- **Issue:** `CREATE ROLE` não é um objeto do dump lógico de um banco — é do cluster inteiro.
  Restaurar sobre um Postgres genuinamente novo (sem os papéis já criados por outra migração)
  falharia sem essa migração prévia, e o roteiro não explicava a ordem.
- **Fix:** Roteiro corrigido para deixar explícito: migrar antes de restaurar, sempre que o
  cluster de destino for novo.
- **Files modified:** docs/operacao/03-backup-e-restauracao.md
- **Committed in:** `32a8435`

**13. [Rule 1 - Bug] `scripts/restaurar.sh` mostrava só a primeira tabela no aviso "será perdido"**
- **Found during:** Tarefa 3, passo 12 — descoberto rodando o script de verdade, não por
  inspeção do código
- **Issue:** O laço que lista as tabelas chamava `$PG_CLIENT_CMD` (um `docker compose exec`)
  dentro de um `while read`. O cliente do Docker lê o stdin do processo mesmo com `-T`,
  engolindo a lista de tabelas que o laço ainda não tinha consumido — resultado: a primeira
  volta do laço consumia o resto do stdin, e o aviso de "o que será perdido" mostrava só a
  primeira tabela em ordem alfabética, escondendo todas as outras que a restauração ia
  substituir. Justamente o que aquele aviso existe para impedir.
- **Fix:** `< /dev/null` acrescentado ao comando interno do laço, com comentário explicando por
  que a linha não pode ser "limpa" no futuro.
- **Files modified:** scripts/restaurar.sh
- **Verification:** Reproduzido e corrigido; `npm run test:backup` roda as 8 etapas verdes depois
  da correção (reconfirmado por este agente antes de escrever este SUMMARY). O teste nunca tinha
  pegado isso porque roda os scripts DENTRO do contêiner com `psql` puro, sem `docker exec` no
  meio do laço — é uma lacuna de teste conhecida, não corrigida aqui (fora do escopo de arquivos
  deste plano).
- **Committed in:** `95a932f`

---

**Total deviations:** 13 auto-corrigidas durante a execução real (11 correções no roteiro,
1 correção de código bloqueante — imagem `ferramentas` sem `lib/` —, 1 correção de código com
consequência de segurança/confiabilidade — o aviso de perda de dados escondendo tabelas).
**Impact on plan:** Nenhum desvio de escopo funcional — o roteiro e os dois scripts continuam
fazendo exatamente o que o `PLAN.md` e `01-ARQUITETURA.md` especificam. Todas as correções
tornam o roteiro mais correto, nunca mudam o que ele entrega.

### Achado fora do escopo deste plano (não corrigido)

**Bug de `callbackUrl` vazando o endereço interno do contêiner.** Descoberto na conferência
externa feita por este agente depois do relato do dono: o redirecionamento para `/login` de uma
rota protegida sem sessão inclui `callbackUrl=https://0.0.0.0:3000/...` em vez do domínio
público. Confirmado com `curl -sI https://amassacerrado.com.br/encomendas` — a `Location`
carrega o parâmetro errado, enquanto o cookie `__Secure-authjs.callback-url` da mesma resposta
resolve o domínio certo. **Não corrigido** por estar fora de `files_modified` deste plano (a
causa provável mora em `lib/auth/auth.config.ts`/`middleware.ts`, território das fases
02a-03/02a-04) — regra de fronteira de escopo do executor. Registrado em
`.planning/WINDOWS.md` (id 2) e detalhado em
`.planning/phases/02a-login-banco-base-e-backup/deferred-items.md`.

## Issues Encountered

- **O `cron` não disparava depois da normalização de fuso do servidor** — ver Deviation 9, o
  achado central da execução. Nenhuma ferramenta de diagnóstico padrão (`crontab -l`,
  `systemctl is-active`, o journal) apontava a causa; só o teste comprimido revelou o problema.
- **O bug de `callbackUrl`** (ver acima) é uma descoberta relevante para a saúde geral da
  aplicação, mas não bloqueia o fechamento desta fase por si só: o login manual funciona (a
  Server Action de login redireciona para dentro da aplicação sem depender deste parâmetro de
  query — foi assim que o dono conseguiu entrar de verdade). O defeito afetaria especificamente
  quem chega a uma rota protegida sem sessão e seria redirecionado de volta para ela depois de
  logar.
- Nenhum outro problema fora dos já documentados em Deviations.

## User Setup Required

None — toda a configuração externa necessária (conta do Drive do ateliê, `rclone` autorizado,
monitor externo cadastrado, `cron` agendado) já foi feita pelo dono durante a execução real desta
Tarefa 3, e está documentada acima e no próprio roteiro.

## Next Phase Readiness

- A Fase 2a está com todos os seus 8 planos executados e as 5 provas de cobertura do
  `02a-08-PLAN.md` (D1-D5) satisfeitas. A verificação formal de fechamento de fase é do
  orquestrador, não deste SUMMARY.
- `AUTH-07`, `BKP-01`, `BKP-02`, `BKP-04`, `BKP-06` e `BKP-07` marcados completos em
  `REQUIREMENTS.md`.
- **Bloqueio conhecido, registrado em `WINDOWS.md` (id 2), que impede `/gsd-ship` até resolvido
  ou dispensado conscientemente:** o bug de `callbackUrl` vazando `0.0.0.0:3000`. Candidato
  natural a uma tarefa pequena e dedicada antes do próximo `/gsd-ship`, investigando
  `lib/auth/auth.config.ts`/`trustHost` do Auth.js v5.
- `docs/operacao/03-backup-e-restauracao.md` fica disponível como referência operacional
  permanente — é o documento que a fase de Polimento final (`03-ROADMAP.md`) referencia para
  "Restauração real de um backup, cronometrada e documentada em português", já satisfeito aqui.
- Nenhum outro bloqueio novo.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*
