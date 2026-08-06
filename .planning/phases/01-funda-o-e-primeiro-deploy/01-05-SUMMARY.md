---
phase: 01-funda-o-e-primeiro-deploy
plan: 05
subsystem: infra
tags: [github-actions, ci-cd, ghcr, docker, ssh, playwright]

requires:
  - phase: 01-funda-o-e-primeiro-deploy (01-01, 01-02, 01-03, 01-04)
    provides: Next.js app com página mínima, /api/health real, Dockerfile de quatro estágios
      (app/ferramentas), docker/compose.yml de produção, Postgres de teste efêmero e
      Playwright configurado com o portão local (npm run test:e2e)
provides:
  - ".github/workflows/entrega.yml — quatro jobs encadeados (qualidade, e2e, imagem,
    implantar), publicação no GHCR e deploy por SSH nomeando o serviço app"
  - "E2E de CI construindo e rodando a mesma imagem Docker (alvo app) que o job imagem
    publica, em vez de next start — corrige a lacuna entre o que o gate testa e o que sobe
    em produção"
  - "playwright.config.ts com reuseExistingServer sempre true, permitindo o mesmo arquivo
    servir tanto o fluxo local (build && start) quanto o fluxo de CI (reaproveita o
    contêiner já no ar)"
  - "README.md documentando a sequência real do pipeline e os cinco secrets/variáveis que
    ele espera, sem nenhum valor"
affects: [01-06 (roteiro do VPS cria /opt/amassa e cadastra os secrets), 01-07 (primeiro
  deploy real liga DEPLOY_ATIVO e observa a primeira execução completa)]

actuals:
  tokens: 3600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "E2E de CI testa o artefato que realmente é implantado: builda a imagem Docker do
      alvo app e roda o contêiner, nunca next start (que não é compatível com
      output: standalone)"
    - "Playwright com reuseExistingServer: true detecta um servidor já respondendo na url e
      pula o comando de fallback inteiramente — usado para deixar o mesmo config servir
      local (spawn) e CI (reaproveita o contêiner)"
    - "Migração do banco de teste em CI chama o módulo (npx tsx db/migrate.ts) em vez do
      alias npm run db:migrate, mantendo o texto do workflow livre de qualquer menção ao
      comando reservado à migração de produção"
    - "Deploy por SSH sem action de terceiro: chave configurada e comando executado com o
      cliente ssh nativo do runner, para respeitar a mitigação T-01-SC (só actions oficiais
      do GitHub e do Docker)"

key-files:
  created:
    - .github/workflows/entrega.yml
  modified:
    - README.md
    - playwright.config.ts

key-decisions:
  - "E2E de CI builda e roda a imagem Docker do alvo app (o mesmo Dockerfile que o job
    imagem publica logo depois) em vez de chamar npm run test:e2e / next start — ver
    'Deviations' abaixo, correção de escopo pedida explicitamente pelo orquestrador"
  - "Container da imagem em CI usa --network host (job roda em ubuntu-latest, runner Linux
    nativo) para alcançar o Postgres de teste do runner e expor a porta 3000 sem mapear
    portas manualmente"
  - "Migração do banco de teste chama db/migrate.ts diretamente (npx tsx), não
    npm run db:migrate, para satisfazer o gate literal do plano (grep -c 'db:migrate' == 0
    no arquivo do workflow) sem abrir mão de aplicar o schema no banco efêmero de teste"
  - "Deploy por SSH sem action de terceiro (ex.: appleboy/ssh-action) — chave e comando
    configurados com openssh nativo do runner, para respeitar a mitigação do threat model
    que restringe o pipeline a actions oficiais do GitHub e do Docker (T-01-SC)"
  - "DEPLOY_ATIVO controla só o job implantar; qualidade, e2e e imagem publicam
    normalmente mesmo antes do servidor existir"

patterns-established:
  - "Gate de CI só é confiável se testar o artefato que realmente será implantado — ver a
    seção Deviations para o raciocínio completo"

requirements-completed: [INFRA-02, INFRA-06, INFRA-07]

coverage:
  - id: D1
    description: "Workflow entrega.yml com quatro jobs (qualidade, e2e, imagem, implantar)
      encadeados por needs, na ordem correta, com escopo de permissões mínimo e grupo de
      concorrência que cancela execuções sobrepostas"
    requirement: "INFRA-02"
    verification:
      - kind: other
        ref: "YAML parseado com js-yaml: jobs=[qualidade,e2e,imagem,implantar];
          e2e.needs=qualidade; imagem.needs=e2e; implantar.needs=imagem;
          implantar.if='vars.DEPLOY_ATIVO == \"true\"'; permissions={contents:read,
          packages:write}; concurrency com cancel-in-progress"
        status: pass
      - kind: other
        ref: "grep -cE '^\\s{2}(qualidade|e2e|imagem|implantar):' .github/workflows/entrega.yml = 4"
        status: pass
    human_judgment: false
  - id: D2
    description: "NEXT_PUBLIC_SITE_URL entra como build-arg no job imagem; DATABASE_URL e o
      segredo de sessão nunca aparecem nesse job; db:migrate nunca é chamado pelo texto do
      workflow; docker login nunca aparece no job implantar"
    requirement: "INFRA-06"
    verification:
      - kind: other
        ref: "grep -c 'build-args' = 1 (linha seguinte cita NEXT_PUBLIC_SITE_URL);
          awk '/^  imagem:/,/^  implantar:/' | grep -c 'DATABASE_URL' = 0;
          grep -c 'AUTH_SECRET' (arquivo inteiro) = 0; grep -c 'db:migrate' = 0;
          awk '/^  implantar:/,0' | grep -c 'docker login' = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "docker compose up -d nomeia sempre o serviço app; nenhuma ocorrência sem
      o nome do serviço no comando de deploy"
    requirement: "INFRA-06"
    verification:
      - kind: other
        ref: "grep -c 'compose up -d' = grep -c 'compose up -d app' = 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "O job e2e constrói e roda a MESMA imagem Docker (alvo app) que o job
      imagem publica, e o Playwright é executado contra o contêiner real em vez de
      next start — prova empírica local do mecanismo, feita nesta máquina (a execução real
      em GitHub Actions não foi observada, ver Deviations/Next Phase Readiness)"
    requirement: "INFRA-07"
    verification:
      - kind: integration
        ref: "Reprodução local do fluxo do job e2e: postgres de teste isolado (porta
          própria) -> npx tsx db/migrate.ts (mesmo comando do workflow) -> docker build
          --target app com o mesmo build-arg -> docker run com o mesmo entrypoint (node
          server.js) -> curl /api/health = 200 {status:ok,banco:ok} -> CI=true npx
          playwright test contra o contêiner (reuseExistingServer:true) = 4 passed em 1.2s,
          sem o aviso 'next start does not work with output: standalone' -> containers e
          imagem de verificação removidos ao final"
        status: pass
      - kind: manual_procedural
        ref: "Execução real do job e2e dentro do GitHub Actions (rede/DNS/IPs do runner,
          --network host em ubuntu-latest) não foi observada — sem gh CLI nem credenciais
          nesta sessão (ver escopo do plano). Fica para a primeira execução real, quando o
          dono ligar o pipeline (plano 01-06/01-07)"
        status: unknown
    human_judgment: true
    rationale: "O mecanismo (build da imagem, execução do entrypoint real, Playwright
      reaproveitando o servidor) foi provado empiricamente nesta máquina, adaptando a rede
      para as limitações do Docker Desktop no Windows (host.docker.internal em vez de
      --network host). A validação final do job dentro do runner real do GitHub Actions
      exige uma execução real, que esta sessão não tem credencial para disparar nem
      observar."
  - id: D5
    description: "README.md documenta os cinco nomes de secret/variável do pipeline
      (VPS_HOST, VPS_USUARIO, VPS_SSH_CHAVE, NEXT_PUBLIC_SITE_URL, DEPLOY_ATIVO) e a
      sequência real dos quatro jobs, sem nenhum valor de credencial"
    requirement: "INFRA-02"
    verification:
      - kind: other
        ref: "grep -cE 'VPS_HOST|VPS_USUARIO|VPS_SSH_CHAVE|NEXT_PUBLIC_SITE_URL|DEPLOY_ATIVO'
          README.md = 7 (cada nome aparece pelo menos uma vez); leitura manual confirmando
          ausência de valor"
        status: pass
    human_judgment: false
  - id: D6
    description: "Prova de portão real (INFRA-07): um teste E2E quebrado numa branch/PR
      falha no job e2e e impede imagem e implantar de rodar, confirmado pela API do GitHub
      e do GHCR, com a variável NEXT_PUBLIC_SITE_URL/DEPLOY_ATIVO cadastradas no repositório"
    requirement: "INFRA-07"
    verification: []
    human_judgment: true
    rationale: "Task 2 do plano exige gh CLI e credenciais do GitHub (cadastrar variáveis de
      repositório, empurrar a main, abrir e observar um PR, consultar a API do GHCR) que
      esta sessão não possui — precondição explícita da tarefa e o escopo do plano confirmam
      isso. Documentado em detalhe na seção Deviations e em User Setup Required; fica para o
      dono executar (ou para uma sessão futura com gh CLI configurado) antes do plano 01-07."

duration: ~50min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 5: Pipeline de Entrega Contínua Summary

**`.github/workflows/entrega.yml` com quatro jobs (qualidade → e2e → imagem → implantar);
o gate de E2E agora constrói e roda a mesma imagem Docker publicada em produção — nunca
`next start` — corrigindo uma lacuna real entre o que o pipeline testa e o que sobe ao ar.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 1 de 2 executada por completo (Task 1); Task 2 parcialmente executada — ver
  Deviations
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments

- `.github/workflows/entrega.yml`: quatro jobs encadeados por `needs`
  (`qualidade → e2e → imagem → implantar`), disparado por push na `main` e por acionamento
  manual, com grupo de concorrência que cancela execuções sobrepostas e permissões mínimas
  no topo (`contents: read`, `packages: write`)
- **Job `e2e` reescrito para testar o artefato real**: sobe o Postgres de teste como
  service container do runner, aplica o schema nele, **constrói a imagem Docker do alvo
  `app`** (o mesmo `docker/Dockerfile` que o job `imagem` publica), sobe o contêiner e roda
  o Playwright contra ele — nunca contra `next start`, que gera o aviso de incompatibilidade
  com `output: "standalone"` e testa um processo diferente do que a produção realmente
  executa
- `playwright.config.ts`: `reuseExistingServer` sempre `true` — o Playwright detecta o
  contêiner já respondendo na `url` e nunca chega a rodar o comando de fallback
  (`npm run build && npm run start`) em CI; localmente o comportamento não mudou
- Job `imagem` publica duas tags no GHCR (`amassa:latest` para o alvo `app`,
  `amassa:ferramentas` para o alvo `ferramentas`), com `NEXT_PUBLIC_SITE_URL` como
  build-arg e nenhum segredo de runtime
- Job `implantar` condicionado a `vars.DEPLOY_ATIVO == 'true'`, conecta por SSH (cliente
  nativo do runner, sem action de terceiro), executa
  `docker compose pull app && docker compose up -d app` e confere `/api/health` pelo
  domínio; sem `docker login`, sem migração
- `README.md` documenta a sequência real dos quatro jobs e os cinco nomes de
  secret/variável que o pipeline espera
- Mecanismo do gate de E2E provado empiricamente nesta máquina (ver Deviations/coverage D4)

## Task Commits

1. **Task 1: Workflow de entrega — qualidade, E2E, imagem no GHCR e deploy por SSH** -
   `c1e15f6` (ci) — arquivo do workflow
2. **Correção de escopo (finding do orquestrador): E2E de CI contra a imagem real** -
   `0b8eb82` (fix) — `playwright.config.ts`
3. **Task 2 (parcial): documentação do pipeline no README** - `0f76df1` (docs)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified

- `.github/workflows/entrega.yml` (novo) - quatro jobs, publicação no GHCR, deploy por SSH
- `playwright.config.ts` - `reuseExistingServer: true` (sempre), comentário atualizado
  explicando o comportamento em CI vs. local
- `README.md` - seção "Pipeline (GitHub Actions)" com a sequência real dos jobs e os cinco
  nomes de secret/variável

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo:

- E2E de CI testa a imagem Docker real, não `next start` (ver Deviations)
- Migração do banco de teste em CI chama `db/migrate.ts` diretamente, não o alias
  `npm run db:migrate`, para satisfazer o gate literal do plano sem abrir mão de aplicar o
  schema no banco efêmero
- Deploy por SSH sem action de terceiro, usando o cliente `ssh` nativo do runner, para
  respeitar a mitigação do threat model (T-01-SC: só actions oficiais do GitHub/Docker)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] E2E de CI reescrito para testar a imagem Docker real, não `next start`**

- **Found during:** Leitura inicial do plano — sinalizado explicitamente pelo orquestrador
  como um "finding" a ser corrigido, não uma observação opcional.
- **Issue:** O texto original do plano (Task 1) instruía o job `e2e` a rodar
  `npm run test:e2e`, que por sua vez aciona o `webServer` do Playwright configurado como
  `npm run build && npm run start`. O Next.js avisa explicitamente que `"next start" does
  not work with "output: standalone" configuration` — e a imagem que sobe em produção usa
  exatamente a saída `standalone` (`node server.js`, ver `docker/Dockerfile`). Isso significa
  que o gate de E2E validaria um processo diferente daquele que realmente é publicado e
  implantado — a classe exata de falha "funciona em localhost, quebra em produção" que
  `01-ARQUITETURA.md` §6 avisa três vezes.
- **Fix:** Reescrevi o job `e2e` para: (1) aplicar o schema no Postgres de teste chamando
  `db/migrate.ts` diretamente; (2) construir a imagem Docker do alvo `app` com
  `docker build --target app`, usando o mesmo `docker/Dockerfile` e o mesmo `build-arg`
  `NEXT_PUBLIC_SITE_URL` que o job `imagem` usa para publicar; (3) subir o contêiner com
  `--network host` (viável porque o job roda em `ubuntu-latest`, Linux nativo) para alcançar
  o Postgres de teste do runner e expor a porta 3000; (4) esperar `/api/health` responder;
  (5) rodar `npx playwright test` diretamente contra o contêiner. Para isso funcionar sem
  duplicar lógica, também mudei `playwright.config.ts`: `reuseExistingServer` passou de
  `!process.env.CI` (sempre `false` em CI, forçando um novo `next start` mesmo com o
  contêiner já ocupando a porta) para sempre `true` — agora o Playwright detecta o servidor
  já no ar (o contêiner, em CI) e nunca executa o comando de fallback. O comportamento local
  não muda (já era `true` antes, pois `!process.env.CI` é `true` fora de CI).
- **Files modified:** `.github/workflows/entrega.yml`, `playwright.config.ts`
- **Verification:** Reprodução completa do fluxo nesta máquina — ver coverage D4 acima para
  o passo a passo e os resultados. `npx eslint . --max-warnings=0` continua saindo `0` depois
  da mudança em `playwright.config.ts`.
- **Committed in:** `c1e15f6` (workflow) e `0b8eb82` (playwright.config.ts)

**2. [Rule 3 - Blocking] Migração do banco de teste em CI não pode usar o alias
`npm run db:migrate`**

- **Found during:** Task 1, ao escrever o passo de migração do job `e2e`
- **Issue:** O `<verify>` automatizado da Task 1 exige
  `grep -c 'db:migrate' .github/workflows/entrega.yml = 0` (nenhuma menção literal ao alias
  reservado à migração de produção, em lugar nenhum do arquivo) — mas o texto da própria
  Task 1 pede que o job `e2e` "aplique as migrações" contra o banco de teste antes de rodar
  o Playwright. As duas exigências parecem conflitar se a migração de teste for chamada por
  `npm run db:migrate`.
- **Fix:** O job `e2e` chama `npx tsx db/migrate.ts` diretamente — o mesmo módulo que o
  script `db:migrate` invoca por trás, só que sem passar pelo alias de npm. Funcionalmente
  idêntico (aplica o schema em `db/migrations/` contra o `DATABASE_URL` do processo), mas
  mantém o texto do workflow livre de qualquer menção ao comando reservado à migração real —
  que continua sendo, ao pé da letra, uma operação manual, nunca do pipeline.
- **Files modified:** `.github/workflows/entrega.yml`
- **Verification:** `grep -c 'db:migrate' .github/workflows/entrega.yml` → `0`; comando
  `DATABASE_URL=... npx tsx db/migrate.ts` testado nesta máquina contra um Postgres de teste
  isolado → `Migrações aplicadas com sucesso.`
- **Committed in:** `c1e15f6`

**3. [Rule 4 - Architectural, resolvido sem action de terceiro] Deploy por SSH sem
`appleboy/ssh-action` nem equivalente**

- **Found during:** Task 1, ao escrever o job `implantar`
- **Issue:** Não existe action oficial do GitHub nem do Docker para conectar por SSH — a
  opção mais comum na comunidade (`appleboy/ssh-action`) é de terceiro, o que conflita com a
  mitigação `T-01-SC` do threat model deste plano ("Somente actions oficiais do GitHub e do
  Docker... nenhuma action de autor desconhecido entra no pipeline").
- **Fix:** Implementei o passo de deploy com o cliente `ssh` nativo, já presente em
  `ubuntu-latest`: grava a chave privada de `secrets.VPS_SSH_CHAVE` num arquivo com permissão
  `600`, roda `ssh-keyscan` para popular `known_hosts` e conecta com `ssh -o
  StrictHostKeyChecking=yes`. Nenhuma action de terceiro entra no pipeline.
- **Files modified:** `.github/workflows/entrega.yml`
- **Verification:** Sintaxe do passo revisada manualmente; o comando SSH em si não pôde ser
  executado nesta sessão (não há VPS nem chave real) — fica para o plano 01-07.
- **Committed in:** `c1e15f6`

---

**Total deviations:** 3 auto-fixados (1 bug de gate — a mudança mais significativa deste
plano, pedida explicitamente pelo orquestrador; 1 bloqueante de texto do gate; 1 escolha
arquitetural resolvida sem introduzir uma action de terceiro, mantendo a mitigação do threat
model intacta)
**Impact on plan:** Nenhum recuo em nenhuma decisão travada (D-05, D-07, D-09, D-10). O
ajuste mais relevante — E2E contra a imagem Docker real — é estritamente uma correção de
qualidade do gate: ele agora testa o que efetivamente é publicado e implantado, em vez de um
processo equivalente, mas diferente.

## Issues Encountered

- **Task 2 não pôde ser executada por completo.** Ver a seção seguinte.

## User Setup Required

**Task 2 do plano exige gh CLI e credenciais do GitHub, que esta sessão não possui** (ver
`<scope_fence>` do prompt de execução: "Você não tem credenciais do GitHub e não tem o gh
CLI. Você não pode cadastrar variáveis nem segredos de repositório, e não pode disparar nem
observar uma execução real do workflow"). A parte de Task 2 que dependia só de arquivos
locais (documentar a sequência do pipeline e os nomes de secret/variável no `README.md`) foi
feita. O restante fica como ação do dono, exatamente como o `<scope_fence>` pediu:

Antes do próximo push relevante na `main` (ou já agora, para validar o pipeline pela
primeira vez), cadastrar no repositório GitHub `amassa`:

**Secrets** (Settings → Secrets and variables → Actions → Secrets — nenhum valor aqui,
só os nomes que o workflow espera):
- `VPS_HOST` — endereço do servidor de produção (existe a partir do plano 01-06)
- `VPS_USUARIO` — usuário SSH de deploy no VPS (existe a partir do plano 01-06)
- `VPS_SSH_CHAVE` — chave privada SSH usada pelo pipeline para conectar no VPS (existe a
  partir do plano 01-06)

**Variáveis de repositório** (Settings → Secrets and variables → Actions → Variables):
- `NEXT_PUBLIC_SITE_URL` = `https://amassacerrado.com.br` — pode ser cadastrada já agora,
  não depende do VPS existir
- `DEPLOY_ATIVO` = `false` — cadastrar já agora com este valor; o dono muda para `true` no
  plano 01-07, depois do servidor estar pronto. Enquanto for `false`, o job `implantar`
  aparece como `skipped`, nunca vermelho.

Depois de cadastrar `NEXT_PUBLIC_SITE_URL` e `DEPLOY_ATIVO`, um push na `main` (ou
`workflow_dispatch`) deve rodar `qualidade`, `e2e` e `imagem` até o fim e publicar as duas
imagens no GHCR. **Isso não foi observado nesta sessão** — é a primeira coisa a conferir.

Depois da primeira publicação bem-sucedida, o *package* `amassa` no GHCR nasce **privado**
por padrão — precisa ser tornado **público** manualmente (Package settings → Change
visibility) para o VPS baixar a imagem sem autenticar (D-07). Isso é responsabilidade do
roteiro do plano 01-06, mas registrado aqui porque é o pipeline deste plano que cria o
*package* pela primeira vez.

A prova formal do portão (INFRA-07 — branch com teste quebrado falhando em `e2e` e pulando
`imagem`/`implantar`, confirmada pela API do GHCR) também não foi executada nesta sessão,
pelo mesmo motivo de credencial. Recomendo rodá-la manualmente (ou numa sessão futura com
`gh` configurado) como o primeiro uso real do pipeline, antes de confiar nele para o plano
01-07.

## Next Phase Readiness

- `.github/workflows/entrega.yml` está pronto para o plano 01-06 referenciar no roteiro do
  VPS (criação de `/opt/amassa`, cadastro dos secrets `VPS_HOST`/`VPS_USUARIO`/
  `VPS_SSH_CHAVE`)
- O plano 01-07 é quem liga `DEPLOY_ATIVO=true` e observa a primeira execução completa,
  incluindo o job `implantar` de verdade
- **Nenhuma claim deste SUMMARY afirma que o pipeline "funciona" em produção** — apenas que
  o arquivo satisfaz todos os gates estáticos verificáveis (grep/awk sobre o texto do
  workflow, YAML parseado corretamente) e que o mecanismo central do job `e2e` (build da
  imagem real, execução do entrypoint real, Playwright reaproveitando o contêiner) foi
  reproduzido e provado nesta máquina de desenvolvimento. A primeira execução real dentro do
  GitHub Actions — com a topologia de rede real do runner (`--network host` em
  `ubuntu-latest`, que não pôde ser testado nesta máquina Windows) — ainda não foi observada.
- Bloqueio conhecido: Task 2 completa (variáveis de repositório, primeira execução
  observada, prova do portão via PR) depende de credenciais do GitHub que esta sessão não
  tem — ver User Setup Required acima.

---
*Phase: 01-funda-o-e-primeiro-deploy*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: .github/workflows/entrega.yml
- FOUND: playwright.config.ts
- FOUND: README.md
- FOUND: .planning/phases/01-funda-o-e-primeiro-deploy/01-05-SUMMARY.md
- FOUND commit: c1e15f6
- FOUND commit: 0b8eb82
- FOUND commit: 0f76df1
