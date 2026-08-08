---
phase: 02a-login-banco-base-e-backup
plan: 07
subsystem: infra
tags: [postgres, pg_dump, backup, shell, docker, disaster-recovery]

# Dependency graph
requires:
  - phase: 02a-06
    provides: "tabela execucoes_backup (id/quando/sucesso/bytes/destino_externo_ok/mensagem) —
      é nela que scripts/backup.sh grava cada execução"
  - phase: 02a-02
    provides: "DATABASE_URL_MIGRACAO vs DATABASE_URL (papéis do banco); padrão de conferência
      de fora, sem binário do Postgres no host"
provides:
  - "scripts/backup.sh: dump via pg_dump --clean --if-exists, comprimido e conferido antes de
    confiar nele, rotação de 14 dias, retenção mensal, envio externo opcional, registro em
    execucoes_backup em toda saída (inclusive erro)"
  - "scripts/restaurar.sh: restauração com confirmação explícita obrigatória, conferência de
    integridade antes de tocar o banco, ON_ERROR_STOP=1, resumo de contagens por tabela"
  - "npm run test:backup (scripts/testar-backup.mjs): prova os dois scripts de ponta a ponta,
    dentro do Postgres efêmero de teste, sem servidor"
affects: [02a-08]

# Actuals (#2632)
actuals:
  tokens: 9300
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pg_dump --clean --if-exists como formato padrão de dump: o MESMO arquivo restaura tanto
      num Postgres vazio (as instruções DROP não encontram nada) quanto por cima de um banco
      já populado com o mesmo schema (tabelas são descartadas e recriadas antes dos dados
      voltarem) — evita precisar de dois formatos de dump para os dois cenários de restauração"
    - "Variável do próprio cliente psql (-v nome=valor, referenciada como :'nome' no SQL) para
      passar texto arbitrário (inclusive mensagem de erro do sistema, que pode conter aspas)
      para dentro de uma instrução SQL sem concatenação de string — mas só funciona com o SQL
      entrando pela ENTRADA PADRÃO do psql (stdin ou -f); a flag -c NÃO substitui :'nome',
      descoberta empírica que mudou o desenho do script (ver Deviations)"
    - "Dump primeiro para um arquivo bruto, gzip depois, nunca um `pg_dump | gzip` direto — sh
      POSIX sem pipefail não expõe a falha do lado esquerdo de um cano; escrever em arquivo e
      checar o código de saída do comando isolado é o que torna um dump truncado detectável
      antes da conferência de integridade"
    - "scripts/testar-backup.mjs descobre o nome do contêiner do Postgres de teste em CI pela
      imagem (docker ps --filter ancestor=postgres:17-alpine), em vez de supor um nome fixo —
      o service container do GitHub Actions não tem o nome que o `services:` do workflow
      declara"

key-files:
  created:
    - scripts/backup.sh
    - scripts/restaurar.sh
    - scripts/testar-backup.mjs
  modified:
    - .env.example
    - .gitattributes
    - package.json
    - README.md
    - .github/workflows/entrega.yml

key-decisions:
  - "pg_dump gerado sempre com --clean --if-exists — decisão de implementação necessária para
    que o mesmo arquivo sirva tanto a 'restaurar num banco vazio' (D5, ARQUITETURA.md §7)
    quanto ao cenário de teste da Etapa 8 (restaurar sobre o MESMO banco de onde o dump saiu,
    só com as linhas conhecidas apagadas) — sem --clean, o segundo cenário falharia com
    'relation already exists' na primeira CREATE TABLE."
  - "Mensagem de erro/registro entra no psql por variável de cliente via ENTRADA PADRÃO (stdin
    do processo), nunca por 'psql -c' — descoberto empiricamente que -c não substitui :'nome'
    nesta versão (psql 17.10), ao contrário do que a documentação sugere à primeira leitura.
    O SQL de registro é agora um heredoc/printf encanado para o psql, não um argumento -c."
  - ".gitattributes novo, forçando LF em *.sh — sem ele, o resultado dependeria do core.autocrlf
    de cada máquina que commitasse; um CRLF num script POSIX quebra o interpretador no servidor
    Linux mesmo que o arquivo pareça idêntico no Windows (Rule 2 — funcionalidade crítica
    ausente, ver Deviations)."
  - "restaurar.sh lista as tabelas do schema público dinamicamente (information_schema.tables),
    não por um nome fixo — a conferência de contagens continua valendo à medida que módulos de
    produto (Fase 3 em diante) acrescentam tabelas novas, sem exigir edição do script."

patterns-established:
  - "Dump com --clean --if-exists para restauração idempotente nos dois sentidos (banco vazio /
    banco já populado com o mesmo schema)"
  - "Registro de mensagem de sistema em SQL via variável de cliente do psql pela entrada padrão
    (nunca -c, nunca concatenação de string)"
  - "Descoberta de contêiner de teste por imagem (docker ps --filter ancestor=...) quando o
    nome real não é garantido pelo ambiente de CI"

requirements-completed: [BKP-01, BKP-02, BKP-03, BKP-05, BKP-06]

coverage:
  - id: D1
    description: "scripts/backup.sh gera um dump comprimido íntegro, nomeado pelo dia, e registra uma linha em execucoes_backup"
    requirement: "BKP-01"
    verification:
      - kind: integration
        ref: "npm run test:backup — Etapa 2/8 (backup do dia)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dumps com mais de 14 dias são apagados, e o do dia 1º é copiado para uma pasta mensal que nunca é limpa (par arquivo antigo apagado / preservado)"
    requirement: "BKP-03"
    verification:
      - kind: integration
        ref: "npm run test:backup — Etapa 4/8 (rotação e retenção mensal)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Um backup pode ser disparado sob demanda (--agora) antes de qualquer migração, sem sobrescrever o dump do dia"
    requirement: "BKP-05"
    verification:
      - kind: integration
        ref: "npm run test:backup — Etapa 3/8 (backup sob demanda)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O dump é enviado ao armazenamento externo quando configurado, e destino_externo_ok reflete o resultado (falso sem destino, verdadeiro com envio bem-sucedido — par oposto)"
    requirement: "BKP-02"
    verification:
      - kind: integration
        ref: "npm run test:backup — Etapas 2/8 e 5/8"
        status: pass
    human_judgment: false
  - id: D5
    description: "scripts/restaurar.sh recusa restaurar sem confirmação explícita (mostra o que seria perdido, não escreve nada) e restaura com confirmação, devolvendo os dados conferidos campo a campo"
    requirement: "BKP-06"
    verification:
      - kind: integration
        ref: "npm run test:backup — Etapas 7/8 e 8/8"
        status: pass
    human_judgment: false
  - id: D6
    description: "Uma execução que falha (dump quebrado, opção inválida) registra a falha em execucoes_backup em vez de desaparecer — armadilha de saída"
    requirement: "BKP-01"
    verification:
      - kind: manual_procedural
        ref: "Prova de inversão: registrar_execucao comentada em backup.sh → npm run test:backup falha na Etapa 2 com mensagem exata ('nenhuma linha foi registrada'); testado também com opção inválida e com pg_dump apontando para banco inexistente"
        status: pass
    human_judgment: false

duration: ~100min
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 07: Backup e Restauração — `scripts/backup.sh`, `scripts/restaurar.sh` e `npm run test:backup` Summary

**Dois scripts POSIX shell (dump com `pg_dump --clean --if-exists`, rotação de 14 dias, retenção
mensal, envio externo opcional e restauração com confirmação obrigatória) provados de ponta a
ponta por `npm run test:backup`, dentro do Postgres efêmero de teste, sem nenhum servidor real.**

## Performance

- **Duration:** ~100 min (a maior parte em validação empírica interativa — ver Decisions/Deviations)
- **Tasks:** 3
- **Files modified:** 8 (3 novos, 5 modificados/gerados)

## Accomplishments

- `scripts/backup.sh` gera o dump primeiro para um arquivo bruto (nunca por um `pg_dump | gzip`
  direto — `sh` POSIX sem `pipefail` não vê a falha do lado esquerdo de um cano), comprime,
  confere tamanho e integridade (`gzip -t`) antes de confiar no resultado, copia para a pasta
  mensal no dia 1º, gira o diretório limitando-se ao primeiro nível (nunca desce na pasta
  mensal), envia ao destino externo quando configurado e registra tudo em `execucoes_backup` —
  inclusive a falha, por uma armadilha de saída (`trap ao_sair EXIT`) que grava antes do script
  morrer, em qualquer caminho de término.
- `scripts/restaurar.sh` recusa restaurar sem `--confirmar`, mostrando as contagens de linha
  atuais por tabela (descobertas dinamicamente via `information_schema.tables`, não uma lista
  fixa) e saindo diferente de zero sem tocar no banco. Com `--confirmar`, confere a integridade
  do arquivo antes de qualquer escrita, restaura com `ON_ERROR_STOP=1` (para no primeiro erro) e
  termina com um resumo de tabela/contagem para conferência imediata.
- `npm run test:backup` (`scripts/testar-backup.mjs`) sobe o Postgres efêmero, migra, insere duas
  linhas conhecidas (`usuarios`, `verificacao_infraestrutura`), copia os dois scripts para dentro
  do contêiner via `docker cp` (nunca volume — a lição de `01-07-SUMMARY.md`) e roda os dois com
  os binários locais de `pg_dump`/`psql`. Oito etapas nomeadas, cada uma com mensagem de falha
  específica, incluindo os três pares em sentidos opostos exigidos pelo `PLAN.md`: cópia externa
  falsa/verdadeira, arquivo antigo do primeiro nível apagado/arquivo antigo mensal preservado, e
  restauração recusada/aceita. Rodado repetidamente durante a execução, sempre verde.
- `.github/workflows/entrega.yml` ganhou um passo `test:backup` no job `e2e`, logo após
  `test:migracoes`, reaproveitando o mesmo *service container* — descoberto em CI pela imagem
  (`docker ps --filter ancestor=postgres:17-alpine`), já que o nome real do contêiner que o
  GitHub Actions cria para um `services:` não é garantido pelo nome declarado no YAML.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: `scripts/backup.sh` — dump, rotação, retenção mensal, envio externo e registro** — `6c602d4` (feat)
2. **Tarefa 2: `scripts/restaurar.sh` — a volta, com confirmação e conferência** — `38e42e5` (feat)
3. **Tarefa 3: `npm run test:backup` — a ida e a volta provadas sem servidor** — `5a05ef0` (test)

**Plan metadata:** commit final deste SUMMARY, a seguir.

## Files Created/Modified

- `scripts/backup.sh` (novo) — dump, compressão, conferência, rotação, retenção mensal, envio
  externo, registro em `execucoes_backup`, disparo sob demanda (`--agora`)
- `scripts/restaurar.sh` (novo) — confirmação obrigatória, conferência prévia, restauração que
  para no primeiro erro, resumo de contagens
- `scripts/testar-backup.mjs` (novo) — orquestra a prova de ponta a ponta, oito etapas
- `.env.example` — acrescenta `BACKUP_DIR` (sem valor)
- `.gitattributes` (novo) — força LF em `*.sh`
- `package.json` — alias `test:backup`
- `README.md` — nova seção "Backup e restauração"; `test:migracoes`/`test:backup` nos portões
  de qualidade locais
- `.github/workflows/entrega.yml` — passo `test:backup` no job `e2e`

## Decisions Made

- **`pg_dump --clean --if-exists` como formato padrão de dump.** É o que faz o MESMO arquivo
  restaurar tanto sobre um Postgres vazio (D5 do `PLAN.md`) quanto sobre o mesmo banco de onde
  saiu, já com as linhas conhecidas apagadas (o cenário da Etapa 8 do teste) — sem isso, a
  segunda restauração falharia em `CREATE TABLE` porque as tabelas já existiriam. Confirmado
  empiricamente contra um Postgres real antes de escrever o script definitivo.
- **Mensagem de registro entra no `psql` pela entrada padrão, nunca por `-c`.** Descoberta
  empírica (ver Deviations): `psql -c "select :'x';"` não substitui a variável nesta versão
  (17.10), apesar de a documentação sugerir o contrário à primeira leitura. `registrar_execucao`
  encana o SQL para o `psql` via `printf ... |`, mantendo a garantia de T-02a-34 (aspas
  aplicadas pelo próprio cliente, nunca concatenação de string).
- **`.gitattributes` novo, forçando LF em `*.sh`.** Sem ele, o resultado do commit dependeria do
  `core.autocrlf` de cada máquina — um CRLF num script POSIX quebra o interpretador no servidor
  Linux mesmo que o arquivo pareça idêntico no Windows. Ver Deviations (Rule 2).
- **`scripts/testar-backup.mjs` descobre o contêiner de teste em CI pela imagem
  (`postgres:17-alpine`), não por um nome fixo.** O *service container* que o GitHub Actions cria
  a partir de `services:` no workflow não recebe o nome declarado no YAML — só o hostname interno
  de rede. Descobrir pela imagem evita depender de um nome que o ambiente não garante.
- **README.md da Tarefa 2 já inclui a menção a `npm run test:backup`** (forward reference ao que
  a Tarefa 3 entrega) — a seção "Backup e restauração" é uma unidade de documentação só, e
  dividi-la por commit exigiria um corte artificial no meio de um parágrafo. A Tarefa 3 reutiliza
  o `package.json` já commitado na Tarefa 1 (o alias) sem nova alteração nesse arquivo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `psql -c` não substitui variáveis `:'nome'` — mecanismo de registro redesenhado**
- **Found during:** Tarefa 1, ao validar empiricamente o mecanismo de registro contra um
  Postgres real antes de escrever a versão final do script (ver metodologia abaixo)
- **Issue:** O desenho inicial de `registrar_execucao()` passava o SQL por `psql -c "insert
  into ... values (:'sucesso'::boolean, ...);"`. Testado contra um Postgres 17.10 real, essa
  forma sempre falhou com `ERROR: syntax error at or near ":"` — `-c` não aplica a substituição
  de variáveis de cliente, ao contrário do que uma leitura rápida da documentação sugere. Sem
  esta correção, TODA gravação em `execucoes_backup` teria falhado silenciosamente por trás da
  armadilha de saída (que engoliria o erro com `|| true`), deixando a tabela sempre vazia e
  `/api/health/backup` permanentemente vermelho.
- **Fix:** O SQL passou a ser enviado pela ENTRADA PADRÃO do `psql` (`printf '%s\n' "..." |
  $PG_CLIENT_CMD ...`), onde a substituição de variável funciona normalmente — confirmado por
  teste isolado contra um contêiner Postgres real antes e depois da mudança.
- **Files modified:** scripts/backup.sh (a função nasceu já com o desenho correto na primeira
  versão commitada, então não há um segundo commit de correção — a descoberta aconteceu durante
  a validação empírica, antes do primeiro commit do arquivo)
- **Verification:** `npm run test:backup` (todas as oito etapas dependem de leitura de
  `execucoes_backup`) mais a prova de inversão descrita no `PLAN.md` (ver D6 acima)
- **Committed in:** `6c602d4` (Tarefa 1 — o desenho corrigido já é o que foi commitado)

**2. [Rule 2 - Missing Critical] `.gitattributes` ausente — CRLF quebraria os scripts no servidor Linux**
- **Found during:** Tarefa 1, ao estagiar `scripts/backup.sh` pela primeira vez (aviso do git
  "LF will be replaced by CRLF the next time Git touches it")
- **Issue:** O repositório não tinha `.gitattributes`. Com `core.autocrlf=true` nesta máquina o
  blob commitado ficou correto (confirmado byte a byte: `0a`, nunca `0d 0a`), mas isso depende
  da configuração local de quem commita — um contribuidor futuro com `core.autocrlf=false` (ou
  sem configuração alguma, comum em instalação padrão do Git no Windows) poderia commitar um
  `scripts/backup.sh` com `\r\n`, que quebra o interpretador `#!/bin/sh` no servidor Linux sem
  nenhum aviso local. É exatamente o modo de falha "funciona em desenvolvimento, quebra em
  produção" que `PROJECT.md` lista como armadilha conhecida do projeto.
- **Fix:** `.gitattributes` novo com `*.sh text eol=lf`, fixando o comportamento independente de
  configuração individual.
- **Files modified:** .gitattributes (novo)
- **Verification:** `git show :scripts/backup.sh | xxd` confirmado só com `0a` (LF) no blob
  staged, antes e depois de acrescentar `.gitattributes`.
- **Committed in:** `6c602d4` (Tarefa 1)

---

**Total deviations:** 2 auto-fixed (1 bug real corrigido antes do primeiro commit, 1
funcionalidade crítica ausente).
**Impact on plan:** Nenhum desvio de escopo funcional — os dois scripts e o teste seguem
exatamente o que o `PLAN.md` especifica. A correção do mecanismo de registro é o motivo pelo
qual, antes de escrever a versão final de `scripts/backup.sh`, `scripts/restaurar.sh` e
`scripts/testar-backup.mjs`, cada peça (dump em arquivo bruto, `gzip -t`, `find -mtime -delete`,
`touch -t`, `psql -v`) foi validada isoladamente contra um Postgres real rodando neste ambiente
Docker — abordagem mais lenta que escrever direto, mas que evitou pelo menos três desenhos que
pareciam corretos na leitura e não funcionariam na prática (o `psql -c` acima, um `pg_dump | gzip`
por pipe direto que esconderia falha do dump, e um `touch` seguido de escrita que resetaria o
carimbo de tempo no teste de rotação).

## Issues Encountered

- **`npm run test:e2e` completo rodou uma vez durante esta execução, com os 32 casos passando**,
  inclusive o caso de flakiness conhecido (`autenticacao.spec.ts`, "a sexta tentativa") registrado
  em `02a-03-SUMMARY.md` e `02a-06-SUMMARY.md` — não reapareceu desta vez. Continua sendo
  contenção de recursos da máquina, não um defeito de lógica; nenhum arquivo deste plano toca
  `lib/auth/tentativas-memoria.ts`.
- **Metodologia de validação empírica antes de escrever a versão final dos scripts.** Como os
  três artefatos entregam comportamento crítico e de recuperação de desastre (dump/restauração),
  cada mecanismo (dump em arquivo bruto vs. pipe, `gzip -t`, `find -mtime -delete` com `-maxdepth
  1`, `touch -t` para simular arquivos antigos, `pg_dump --clean --if-exists` restaurando sobre
  banco populado, `psql -v` com variáveis) foi testado isoladamente contra um Postgres 17-alpine
  real rodando neste ambiente Docker, ANTES de escrever a versão definitiva de cada script. Isso
  levou mais tempo do que escrever direto e verificar depois, mas evitou os três desenhos
  incorretos listados acima em Deviations/Impact — nenhum deles teria sido pego por `sh -n`
  (sintaxe válida) nem por uma leitura cuidadosa do `PLAN.md`, só por execução real.

## User Setup Required

None — nenhuma configuração externa necessária nesta etapa. Instalar o `cron` do host que
dispara `scripts/backup.sh` diariamente, e configurar `RCLONE_REMOTE` com uma conta real de
armazenamento externo, são passos do roteiro de servidor do próximo plano (08), como o `PLAN.md`
já declarava desde o início ("instalar o agendamento é roteiro do plano 08").

## Next Phase Readiness

- `scripts/backup.sh` e `scripts/restaurar.sh` estão prontos para o roteiro de servidor do plano
  08 instalar no `cron` do host e documentar em português para o Theo seguir num dia ruim —
  ambos já usam as mesmas variáveis injetáveis (`AMASSA_DIR`, `AMBIENTE_ARQUIVO`, `PG_DUMP_CMD`,
  `PG_CLIENT_CMD`) com padrão de produção (`/opt/amassa`), então rodar sem NENHUMA variável de
  ambiente extra já é o comportamento correto no servidor real.
- `RCLONE_REMOTE` continua vazio em todo arquivo versionado — o plano 08 é quem escolhe o
  destino real (Cloudflare R2, Backblaze B2 ou Google Drive, per `01-ARQUITETURA.md` §7) e o
  configura só no `/opt/amassa/.env` do servidor.
- `BACKUP_DIR` acrescentado a `.env.example` sem valor — o plano 08 decide se usa o padrão
  (`/opt/amassa/backups`) ou um caminho diferente (ex.: um volume dedicado), sem precisar tocar
  em `scripts/backup.sh`.
- A restauração real cronometrada e documentada em português (item do Polimento em `PROJECT.md`,
  "Restauração real de um backup") continua para uma fase futura — este plano prova a lógica dos
  dois scripts sem servidor; o roteiro operacional (com cronômetro e passo a passo para o Theo)
  é trabalho à parte.
- Sem bloqueios. A flakiness pré-existente de `autenticacao.spec.ts` permanece um risco
  conhecido e documentado, não deste plano.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*

## Self-Check: PASSED

Todos os 8 arquivos citados em `key-files` (3 novos + 5 modificados/gerados) confirmados com
`[ -f ... ]`, e os 3 hashes citados (`6c602d4`, `38e42e5`, `5a05ef0`) confirmados em
`git log --oneline --all`.
