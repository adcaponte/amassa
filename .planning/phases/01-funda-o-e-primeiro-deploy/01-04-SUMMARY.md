---
phase: 01-funda-o-e-primeiro-deploy
plan: 04
subsystem: testing
tags: [docker, postgres, playwright, e2e, drizzle]

requires:
  - phase: 01-funda-o-e-primeiro-deploy (01-01, 01-02, 01-03)
    provides: Next.js app com página mínima, /api/health real, Drizzle+Postgres em Docker,
      docker/compose.yml de produção (postgres/app/caddy/ferramentas)
provides:
  - Postgres de teste separado, efêmero (tmpfs) e sem porta publicada no arquivo versionado
    (docker/compose.teste.yml)
  - Playwright configurado com dois projetos (desktop e celular) contra a build real
  - tests/e2e/fundacao.spec.ts cobrindo a página mínima e /api/health
  - npm run test:e2e — comando único que orquestra banco, migração e Playwright, com portão
    real (sai não-zero quando um teste quebra)
affects: [01-05 (workflow do GitHub Actions vai chamar este mesmo test:e2e ou seu equivalente
  em CI), Fase 2 (qualquer módulo de produto herda esta infraestrutura de E2E)]

actuals:
  tokens: 2200
  tasks: 2
  commits: 2

tech-stack:
  added: ["@playwright/test ^1.62"]
  patterns:
    - "Banco de teste como serviço Docker fisicamente separado (credenciais e nome de banco
      próprios), nunca uma segunda base na mesma instância"
    - "Porta do banco de teste publicada só em tempo de invocação via CLI (docker compose run
      -p), nunca na chave `ports:` do arquivo compose versionado"
    - "webServer do Playwright sobe a build real (build && start), nunca o modo dev"

key-files:
  created:
    - docker/compose.teste.yml
    - playwright.config.ts
    - tests/e2e/fundacao.spec.ts
    - scripts/testar-e2e.mjs
  modified:
    - .env.example
    - package.json

key-decisions:
  - "docker/compose.teste.yml não publica porta (D-09 respeitada ao pé da letra); a
    reachability local vem de scripts/testar-e2e.mjs, que publica uma porta pontual via
    `docker compose run -p` — uma flag de CLI, nunca a chave `ports:` do YAML versionado"
  - "Projeto 'celular' do Playwright usa o preset Pixel 7 (Chromium) em vez de um preset
    iPhone (WebKit), para não precisar instalar um segundo motor de navegador"
  - "scripts/testar-e2e.mjs detecta CI e pula a orquestração Docker — assume que o runner já
    entrega o banco de teste alcançável (D-10), só roda migração + Playwright"

patterns-established:
  - "Publicar porta de banco efêmero só via CLI no momento do uso, nunca na declaração do
    compose file"

requirements-completed: [INFRA-07]

coverage:
  - id: D1
    description: "Postgres de teste fisicamente separado (tmpfs, sem ports:, credenciais
      próprias), nunca referenciado por docker/compose.yml"
    requirement: "INFRA-07"
    verification:
      - kind: other
        ref: "docker compose -f docker/compose.teste.yml config (exit 0); grep -c
          'postgres_teste' docker/compose.yml == 0; grep -c 'tmpfs'/'ports:'/'volumes:' em
          docker/compose.teste.yml"
        status: pass
      - kind: manual_procedural
        ref: "subir via docker compose run, gravar linha com psql, derrubar, subir de novo,
          confirmar to_regclass('public.prova') retorna nulo"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run test:e2e roda 4 testes (2 casos x 2 projetos) contra o banco de
      teste e sai 0 quando tudo passa"
    requirement: "INFRA-07"
    verification:
      - kind: e2e
        ref: "npm run test:e2e — tests/e2e/fundacao.spec.ts, projetos desktop+celular"
        status: pass
    human_judgment: false
  - id: D3
    description: "Um teste ponta a ponta quebrado faz npm run test:e2e sair com código
      diferente de zero (prova do portão de INFRA-07)"
    requirement: "INFRA-07"
    verification:
      - kind: e2e
        ref: "expectativa invertida em fundacao.spec.ts, npm run test:e2e => exit 1
          (revertido antes do commit)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 4: Banco de Testes e Playwright Summary

**Postgres de teste separado (tmpfs, sem porta publicada no YAML) e Playwright em dois
projetos (desktop + celular Chromium) rodando contra a build real, com portão comprovado:
teste quebrado derruba `npm run test:e2e` com código diferente de zero.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 7 (2 modificados, 5 criados)

## Accomplishments
- `docker/compose.teste.yml`: serviço único `postgres_teste`, armazenamento `tmpfs` (nada
  sobrevive a um `down`), credenciais e nome de banco distintos de produção, sem `ports:` — não
  referenciado por `docker/compose.yml` e nunca copiado para o servidor
- `playwright.config.ts`: dois projetos (`desktop`, `celular`), `webServer` sobe a build real
  (`npm run build && npm run start`), `DATABASE_URL` do servidor vem de `DATABASE_URL_TESTE`
- `tests/e2e/fundacao.spec.ts`: página inicial (nome + frase no ar) e `/api/health` (banco em
  ordem), cobrindo os dois únicos pedaços da fundação que existem nesta fase
- `scripts/testar-e2e.mjs`: orquestra o banco efêmero, a migração e o Playwright localmente;
  detecta `CI` e pula a orquestração Docker, assumindo o banco que o runner do GitHub Actions
  vai fornecer (plano 01-05)
- Portão provado empiricamente: com uma expectativa invertida, `npm run test:e2e` sai com
  código `1`; revertido antes do commit

## Task Commits

1. **Task 1: Postgres de teste separado, efêmero e inalcançável** - `ee3f487` (feat)
2. **Task 2: Playwright no desktop e no celular, e a prova do portão** - `92f056a` (feat)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `docker/compose.teste.yml` - serviço `postgres_teste`, tmpfs, sem porta, sem `restart`
- `.env.example` - `DATABASE_URL_TESTE=` acrescentada, sem valor
- `playwright.config.ts` - dois projetos, `webServer` na build real
- `tests/e2e/fundacao.spec.ts` - página mínima + `/api/health`
- `scripts/testar-e2e.mjs` - orquestração local do banco efêmero + migração + Playwright
- `package.json` - script `test:e2e`, dependência de desenvolvimento `@playwright/test`
- `package-lock.json` - lockfile atualizado pelo `npm install`

## Decisions Made

- **Reachability local sem violar "sem porta publicada" (D-09).** `docker/compose.teste.yml`
  não tem nenhuma chave `ports:` — subir com `docker compose up` simples não abre nada para o
  host (confirmado empiricamente nesta máquina: nem IP do container, nem `network_mode: host`,
  nem o nome do serviço são alcançáveis do host Windows sem publicar porta — testado nos três
  caminhos antes de decidir). A solução: `scripts/testar-e2e.mjs` publica uma porta só durante a
  própria execução via `docker compose run -p 127.0.0.1:...` — uma *flag* de linha de comando, e
  portanto nunca aparece como texto `ports:` no arquivo versionado. Um `docker compose -f
  docker/compose.teste.yml up -d` "cru" continua sem publicar nada, que é a garantia que a
  decisão original pedia.
- **Projeto "celular" usa o preset `Pixel 7` (Chromium), não um preset iPhone (WebKit).**
  Evita instalar um segundo motor de navegador — a orientação do ambiente pedia instalar só o
  necessário. O preset ainda cobre viewport, toque e user agent de um Android real.
- **`scripts/testar-e2e.mjs` detecta `CI` e pula toda a orquestração Docker.** Em GitHub
  Actions (plano 01-05), o Postgres de teste chega pronto como *service container* do runner
  (D-10) — rodar `docker compose` de novo ali seria redundante e poderia colidir com o banco que
  o workflow já subiu.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O `<verify>` automatizado da Task 1, como escrito, não é executável
nesta máquina**
- **Found during:** Task 1, ao tentar `docker compose -f docker/compose.teste.yml up -d &&
  DATABASE_URL="$DATABASE_URL_TESTE" npm run db:migrate` sem nenhuma porta publicada
- **Issue:** testei empiricamente três caminhos de alcance host→contêiner sem publicar porta
  (IP do bridge do contêiner, resolução de nome do serviço a partir do host, e
  `network_mode: host`) — nenhum funciona neste Docker Desktop para Windows sem publicar porta.
  O comando de verificação literal do plano pressupõe que `DATABASE_URL_TESTE` já é alcançável
  do host, o que é impossível sem publicar algo, em conflito direto com a exigência de zero
  `ports:` no arquivo.
- **Fix:** mantive `docker/compose.teste.yml` inalterado quanto a essa exigência (nenhuma chave
  `ports:`, verificado por `grep`) e movi a responsabilidade de alcance para
  `scripts/testar-e2e.mjs`, que publica a porta só via `docker compose run -p` (CLI, não YAML),
  só durante a execução do teste, e derruba tudo depois — inclusive a rede — no `finally`.
- **Files modified:** scripts/testar-e2e.mjs (novo), package.json (script `test:e2e` aponta
  para ele em vez do comando literal do plano)
- **Verification:** `npm run test:e2e` roda de ponta a ponta (banco sobe, migra, 4 testes
  passam, banco desce, sem sobra de contêiner nem rede) — rodado várias vezes, inclusive com uma
  expectativa quebrada para provar o portão
- **Committed in:** `92f056a` (Task 2 commit — o script depende do Playwright instalado nessa
  mesma tarefa)

**2. [Rule 1 - Bug] `execFileSync` de `npm`/`npx` no Windows falhava com `EINVAL`**
- **Found during:** Task 2, primeira execução de `npm run test:e2e`
- **Issue:** `npm.cmd`/`npx.cmd` não são executáveis diretos no Windows; `execFileSync` sem
  shell falha. A primeira correção (`shell: true` com array de argumentos) funcionava mas gerava
  o aviso de depreciação `DEP0190` do Node (argumentos não escapados com shell).
- **Fix:** troquei para `execSync` com uma única string de comando para as chamadas de
  npm/npx (seguro, porque nenhum argumento tem espaço ou caractere especial), mantendo
  `execFileSync` sem shell para as chamadas ao `docker` (executável direto, sem esse problema).
- **Files modified:** scripts/testar-e2e.mjs
- **Verification:** `npm run test:e2e` roda sem avisos de depreciação
- **Committed in:** `92f056a`

---

**Total deviations:** 2 auto-fixed (1 blocking — orquestração de porta local, 1 bug — spawn do
npm no Windows)
**Impact on plan:** Nenhum recuo em nenhum critério de aceite ou decisão travada — D-09, D-10 e
D-11 continuam verdadeiras ao pé da letra no arquivo versionado. O ajuste foi só em *como* o
comando `test:e2e` alcança o banco durante a própria execução, não *o que* fica declarado no
compose file.

## Issues Encountered

- O aviso `"next start" does not work with "output: standalone" configuration` aparece toda vez
  que o `webServer` sobe. É esperado e inofensivo: `next build` sempre produz a saída normal em
  `.next/` além da pasta `standalone` (usada só pela imagem Docker de produção); `next start`
  local usa a saída normal, então o servidor de teste funciona igual. Não é um defeito desta
  fase.

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

- `npm run test:e2e` está pronto para o plano 01-05 chamar (ou reaproveitar via
  `scripts/testar-e2e.mjs` com `CI=true`) dentro do workflow do GitHub Actions — o script já
  detecta `CI` e pula a orquestração Docker local, assumindo que o *service container* do runner
  entrega o banco.
- O `docker/compose.yml` do servidor segue sem nenhum vestígio do banco de teste — confirmado
  por `grep -c 'postgres_teste' docker/compose.yml` = 0.
- Nenhum bloqueio para o plano 01-05.

---
*Phase: 01-funda-o-e-primeiro-deploy*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: docker/compose.teste.yml
- FOUND: playwright.config.ts
- FOUND: tests/e2e/fundacao.spec.ts
- FOUND: scripts/testar-e2e.mjs
- FOUND commit: ee3f487
- FOUND commit: 92f056a
