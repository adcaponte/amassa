---
phase: 01-funda-o-e-primeiro-deploy
plan: 03
subsystem: infra
tags: [docker, dockerfile, docker-compose, caddy, drizzle, postgres, ghcr]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Next.js standalone, /api/health real, db/migrate.ts, docker/compose.yml (postgres), .env.example"
provides:
  - "docker/Dockerfile em quatro estágios: dependencias, construtor, app (standalone), ferramentas (deps completas)"
  - "docker/compose.yml com os quatro serviços de produção: postgres, app, caddy, ferramentas (nesta ordem)"
  - "docker/Caddyfile servindo o apex amassacerrado.com.br com redirecionamento do www"
  - "docker/compose.dev.yml estendido com build: para app/ferramentas (só em desenvolvimento)"
  - ".dockerignore protegendo a imagem pública do GHCR contra vazamento de segredo"
  - "README.md como roteiro de operação: migração via ferramentas, publicação sempre nomeando app"
affects: [01-04, 01-05, 01-06, 01-07]

# Actuals (#2632)
actuals:
  tokens: 2837
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added:
    - "node:24.19.0-alpine (imagem base fixada, igual à versão local de desenvolvimento)"
    - "caddy:2-alpine (proxy reverso, HTTPS automático via Let's Encrypt)"
  patterns:
    - "Dockerfile em quatro estágios nomeados: dependencias (npm ci completo) → construtor (build) → app (standalone, mínima) / ferramentas (deps completas, sob demanda)"
    - "NEXT_PUBLIC_* como ARG de build, nunca runtime; DATABASE_URL/AUTH_SECRET nunca como ARG nem dentro da imagem"
    - "Ambiente do compose declarado serviço a serviço (sem env_file compartilhado) para impedir que TZ vaze para o postgres"
    - "ferramentas sob profile dedicado, restart: \"no\" — nunca sobe com `up -d`, só com `run --rm`"
    - "NPM_CONFIG_OFFLINE=true na imagem app: garante que um comando que dependa de devDependency ausente falhe de forma determinística, mesmo com rede disponível, em vez de silenciosamente baixar o pacote do registro"

key-files:
  created:
    - docker/Dockerfile
    - docker/Caddyfile
    - .dockerignore
    - scripts/.gitkeep
    - README.md
  modified:
    - docker/compose.yml
    - docker/compose.dev.yml
    - .env.example

key-decisions:
  - "Imagem base fixada em node:24.19.0-alpine — mesma versão exata do Node instalado na máquina de desenvolvimento (v24.19.0), confirmada por digest idêntico ao de node:24-alpine no momento da execução"
  - "NPM_CONFIG_OFFLINE=true no estágio app: sem essa variável, `npx drizzle-kit` na imagem de produção baixaria o pacote do registro npm (rede confirmada disponível dentro do contêiner) e o teste da armadilha do estágio ferramentas passaria por acidente, não por construção. Com a variável, a falha é determinística independentemente da conectividade do ambiente onde a imagem roda"
  - "docker/compose.dev.yml ganhou build: para app/ferramentas — só a sobreposição de desenvolvimento sabe construir imagem; o compose.yml de produção só sabe baixar (grep -c 'build:' docker/compose.yml = 0, gate do plano)"

patterns-established:
  - "Verificação de armadilha delimitada ao bloco do serviço (awk entre marcadores), não ao arquivo inteiro — a mesma técnica se aplica a qualquer gate futuro que precise garantir isolamento entre serviços do compose"

requirements-completed: [INFRA-04, INFRA-05, INFRA-06, INFRA-09]

coverage:
  - id: D1
    description: "Dockerfile em quatro estágios; a imagem ferramentas roda drizzle-kit, a imagem app não consegue (falha determinística mesmo com rede disponível)"
    requirement: "INFRA-05"
    verification:
      - kind: integration
        ref: "docker run --rm amassa-ferramentas:teste npx drizzle-kit --version (exit 0, imprime v0.31.10); docker run --rm amassa-app:teste npx drizzle-kit --version (exit 1, ENOTCACHED)"
        status: pass
    human_judgment: false
  - id: D2
    description: "NEXT_PUBLIC_SITE_URL como build ARG; DATABASE_URL e AUTH_SECRET nunca como ARG nem dentro da imagem"
    requirement: "INFRA-05"
    verification:
      - kind: other
        ref: "grep -cE 'ARG NEXT_PUBLIC_SITE_URL' docker/Dockerfile = 1; grep -cE 'ARG (DATABASE_URL|AUTH_SECRET)' docker/Dockerfile = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "postgres sem TZ e sem porta publicada no compose.yml de produção; TZ existe só no serviço app"
    requirement: "INFRA-04"
    verification:
      - kind: other
        ref: "awk '/^  postgres:/,/^  app:/' docker/compose.yml | grep -c 'TZ' = 0; mesmo range | grep -c 'ports:' = 0; awk '/^  app:/,/^  caddy:/' | grep -c 'TZ' = 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Migração aplicada pelo contêiner ferramentas funciona e é idempotente; a mesma operação pelo app falha"
    requirement: "INFRA-06"
    verification:
      - kind: integration
        ref: "docker compose run --rm ferramentas npm run db:migrate — duas execuções seguidas, ambas exit 0, tabela verificacao_infraestrutura criada uma única vez; docker compose exec app npm run db:migrate — exit 127, 'tsx: not found'"
        status: pass
    human_judgment: false
  - id: D5
    description: "docker compose up -d app não recria o contêiner do Postgres, e uma linha gravada antes da republicação continua legível depois"
    requirement: "INFRA-06"
    verification:
      - kind: integration
        ref: "ID do contêiner postgres capturado antes e depois de `docker compose up -d app` (ambiente estável) — idêntico; linha sentinela inserida via psql sobreviveu à recriação anterior do app e à republicação subsequente"
        status: pass
    human_judgment: false
  - id: D6
    description: "docker compose restart devolve postgres, app e caddy sozinhos, sem intervenção"
    requirement: "INFRA-09"
    verification:
      - kind: integration
        ref: "docker compose restart seguido de docker compose ps — os três serviços voltam Up/healthy sem comando adicional"
        status: pass
    human_judgment: false
  - id: D7
    description: "Caddyfile serve o apex amassacerrado.com.br via reverse_proxy para app:3000, com www redirecionando permanentemente; a topologia real de produção usa HTTPS automático (não testável localmente sem DNS real apontando para esta máquina)"
    requirement: "INFRA-09"
    verification:
      - kind: integration
        ref: "docker/Caddyfile commitado com HTTPS automático real (confirmado pelos logs do Caddy tentando ACME contra amassacerrado.com.br/www, falhando por NXDOMAIN — DNS ainda não aponta para esta máquina, esperado nesta fase); mecanismo de reverse_proxy provado à parte com um Caddyfile local efêmero (prefixo http://, não commitado) que retornou o corpo com 'AMASSA'"
        status: pass
      - kind: manual_procedural
        ref: "HTTPS real de ponta a ponta só é verificável depois de DNS apontar para o VPS (plano 01-05/01-06)"
        status: unknown
    human_judgment: true
    rationale: "A prova de HTTPS automático de verdade depende de DNS real apontando para um servidor público, que não existe nesta fase (D-01/D-02). O mecanismo do Caddyfile foi verificado por construção (sintaxe, reverse_proxy, redirecionamento do www) e o roteamento foi provado empiricamente com uma variante local sem TLS; a validação final do certificado emitido fica para os planos de DNS/VPS."

# Metrics
duration: 45min (tempo de trabalho ativo; a sessão total teve ~18h de duração de relógio por causa de duas quedas do Docker Desktop, documentadas em Issues Encountered)
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 3: Empacotamento de Produção Summary

**Dockerfile de quatro estágios (`dependencias`/`construtor`/`app`/`ferramentas`) e `docker/compose.yml` completo (postgres/app/caddy/ferramentas) com a armadilha do estágio `ferramentas` provada empiricamente: a migração funciona pela imagem de ferramentas e falha, de propósito, pela imagem `app`.**

## Performance

- **Duration:** ~45 min de trabalho ativo (sessão de relógio mais longa por duas interrupções do Docker Desktop, sem relação com o plano — ver Issues Encountered)
- **Started:** 2026-08-05T23:04:04Z
- **Completed:** 2026-08-06T17:36:01Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments
- `docker/Dockerfile` com quatro estágios nomeados: a imagem `app` (saída `standalone`) não consegue rodar `drizzle-kit` nem `npm run db:migrate` — comprovado por execução real, não por inspeção — enquanto a imagem `ferramentas` consegue as duas coisas
- `docker/compose.yml` completo com `postgres`, `app`, `caddy` e `ferramentas` nesta ordem exata; ambiente declarado serviço a serviço, `TZ` confinado ao `app`, nenhuma porta publicada em `postgres` nem `app`
- `docker compose up -d app` provado, com o daemon Docker real, preservando o identificador do contêiner do Postgres e uma linha gravada antes da republicação
- `docker compose restart` devolve os três serviços de produção sozinhos, sem intervenção manual
- `docker/Caddyfile` serve o apex com HTTPS automático real (confirmado pelos logs tentando emitir certificado — falha apenas porque o DNS ainda não aponta para esta máquina, o que é esperado nesta fase); o mecanismo de `reverse_proxy` foi comprovado à parte
- `README.md` como roteiro de operação do dia a dia: aplicar migração à mão pelo `ferramentas`, publicar sempre nomeando `app`

## Task Commits

Each task was committed atomically:

1. **Task 1: Dockerfile em quatro estágios** - `4597984` (feat)
2. **Task 2: compose.yml completo** - `fd5a0fe` (feat)
3. **Task 3: Migração verificada e README** - `c73be62` (feat)

## Files Created/Modified
- `docker/Dockerfile` - quatro estágios (`dependencias`, `construtor`, `app`, `ferramentas`); `NEXT_PUBLIC_SITE_URL` como `ARG`; `NPM_CONFIG_OFFLINE=true` no estágio `app`
- `docker/compose.yml` - serviços `app`, `caddy`, `ferramentas` acrescentados; `postgres` preservado de 01-01
- `docker/compose.dev.yml` - `build:` para `app`/`ferramentas`, só em desenvolvimento
- `docker/Caddyfile` (novo) - apex `amassacerrado.com.br` com `reverse_proxy`; `www` redirecionando
- `.dockerignore` (novo) - exclui `node_modules`, `.next`, `.git`, `.planning`, `amassa-plataforma` e arquivos de ambiente com valor real
- `scripts/.gitkeep` (novo) - versiona a pasta vazia que o estágio `ferramentas` copia
- `.env.example` - acrescenta `IMAGEM_FERRAMENTAS`
- `README.md` (novo) - roteiro de desenvolvimento local e operação de produção

## Decisions Made
- `node:24.19.0-alpine` como imagem base fixada — mesma versão exata do Node local (confirmado por digest idêntico a `node:24-alpine` no momento da execução), satisfazendo "versão fixada" sem depender de tag flutuante
- `NPM_CONFIG_OFFLINE=true` na imagem `app` — sem essa variável, o teste da armadilha (`npx drizzle-kit` deveria falhar na imagem de produção) passaria por acidente sempre que o ambiente de execução tivesse acesso à internet, porque `npx` baixaria o pacote do registro em vez de simplesmente não encontrá-lo. A variável torna a falha determinística e é, em si, um endurecimento correto: uma imagem de produção não deveria instalar nada em tempo de execução
- `docker compose exec app npm run db:migrate` falha com `tsx: not found` (não com "comando inexistente") — a saída `standalone` do Next.js copia um `package.json` mínimo com os scripts originais, mas não os `devDependencies`; o comando é *encontrado* e falha exatamente onde deveria, o que é uma prova ainda mais direta da necessidade do estágio `ferramentas` do que o teste isolado com `npx drizzle-kit`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verificação do `curl` através do Caddy usando um Caddyfile local efêmero, não commitado**
- **Found during:** Task 3, ao rodar `curl -sf http://localhost/ -H 'Host: amassacerrado.com.br' | grep -q 'AMASSA'` contra o `docker/Caddyfile` real
- **Issue:** O `docker/Caddyfile` commitado ativa HTTPS automático de verdade (comportamento correto e intencional — é exatamente o que a Fase 1 exige). Sem DNS real apontando para esta máquina de desenvolvimento, o Caddy tenta emitir certificado via Let's Encrypt, falha com `NXDOMAIN` (confirmado nos logs) e, enquanto isso, responde a qualquer requisição em `:80` com um redirecionamento permanente (`308`) para HTTPS — nunca com o conteúdo da página. O comando de verificação do plano, rodado ao pé da letra contra o Caddyfile de produção, portanto nunca teria corpo para o `grep` encontrar, em nenhum ambiente sem DNS real.
- **Fix:** Sem alterar o `docker/Caddyfile` commitado, subi um contêiner Caddy adicional, descartável, na mesma rede Docker, montando uma variante local com o prefixo `http://` (que desativa o HTTPS automático só para aquele teste). O `curl` contra esse contêiner confirmou que o `reverse_proxy app:3000` funciona e devolve a página com "AMASSA". O contêiner e o arquivo temporário foram removidos depois — nada disso entrou no repositório.
- **Files modified:** nenhum arquivo versionado — apenas um contêiner e um arquivo `docker/caddyfile-verificacao-local` temporários, ambos removidos ao final
- **Verification:** `curl -sf http://localhost:8080/ -H 'Host: amassacerrado.com.br' | grep -q 'AMASSA'` → `CADDY_ROUTE_OK`
- **Committed in:** não aplicável (nada versionado); documentado em D7 da tabela `coverage` acima

---

**Total deviations:** 1 auto-fixed (bloqueante de ambiente de teste, não de código)
**Impact on plan:** Nenhum. O `docker/Caddyfile` de produção está correto e inalterado; a validação de HTTPS real fica, corretamente, para os planos com DNS/VPS reais (01-05/01-06).

## Issues Encountered
- **Docker Desktop caiu duas vezes durante a execução**, por sockets de domínio Unix órfãos (`dockerInference`, depois `docker-secrets-engine/engine.sock`) — não relacionado ao plano. O orquestrador desabilitou `EnableDockerAI` em `settings-store.json` (recurso não usado por este projeto) e reiniciou o Docker Desktop entre as interrupções. As imagens `amassa-app:teste`/`amassa-ferramentas:teste` sobreviveram às quedas; o volume do Postgres foi perdido uma vez e recriado do zero antes da verificação final documentada aqui. Nenhum impacto no resultado — apenas no tempo de relógio total da sessão.
- Durante a depuração da primeira tentativa de migração, a senha usada no arquivo de ambiente de verificação não coincidia com a senha já gravada no volume do Postgres (inicializado em uma sessão anterior com valores de `.env.local`) — corrigido alinhando o arquivo de verificação aos valores reais de `.env.local` antes de repetir o teste.
- Uma primeira tentativa de medir "o contêiner do Postgres não é recriado por `up -d app`" deu falso negativo porque o arquivo de ambiente usado nessa chamada específica tinha um valor de senha diferente do da chamada anterior — o Compose recalcula a configuração efetiva do serviço e recria qualquer contêiner (mesmo fora do escopo nomeado) cuja configuração mudou. Repetido com um arquivo de ambiente estável entre as duas capturas do identificador, o resultado confirmou a garantia do plano: identificador idêntico antes e depois.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária nesta fase. `docker/verificacao-local.env` (usado só durante a verificação empírica desta execução) foi removido ao final; não é versionado.

## Next Phase Readiness
- A topologia completa de produção (`docker/Dockerfile`, `docker/compose.yml`, `docker/Caddyfile`) está pronta para os planos de repositório GitHub (01-02, já em andamento com o dono), VPS Contabo, GitHub Actions e DNS.
- Nenhum bloqueio conhecido. O Postgres de desenvolvimento voltou a rodar localmente (`docker-postgres-1`, `healthy`, porta `127.0.0.1:5433`) no mesmo estado em que 01-01 o deixou, para as próximas plans que dependam dele.
- A prova de HTTPS real (certificado emitido, sem erro de DNS) depende do domínio `amassacerrado.com.br` apontar para o VPS real — isso é escopo dos planos de DNS/VPS (01-05/01-06), não desta.

---
*Phase: 01-funda-o-e-primeiro-deploy*
*Completed: 2026-08-06*

## Self-Check: PASSED

All 8 key files (`docker/Dockerfile`, `docker/compose.yml`, `docker/compose.dev.yml`,
`docker/Caddyfile`, `.dockerignore`, `scripts/.gitkeep`, `.env.example`, `README.md`) confirmed
present on disk. All 3 task commits (`4597984`, `fd5a0fe`, `c73be62`) confirmed present in
`git log --oneline --all`.
