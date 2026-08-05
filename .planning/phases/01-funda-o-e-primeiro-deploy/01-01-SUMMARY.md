---
phase: 01-funda-o-e-primeiro-deploy
plan: 01
subsystem: infra
tags: [nextjs, react, tailwindcss, drizzle-orm, postgres, docker, vitest, eslint, prettier]

# Dependency graph
requires: []
provides:
  - "Projeto Next.js 15.5.22 na raiz do repo (App Router, TypeScript estrito, Tailwind v4, sem src/)"
  - "Página mínima da marca em app/page.tsx com FRASE_NO_AR em app/frase-no-ar.ts"
  - "/api/health consultando o Postgres de verdade via Drizzle, 200/503 conforme a consulta"
  - "db/schema.ts, db/index.ts, db/migrate.ts, drizzle.config.ts e migração versionada em db/migrations/"
  - "docker/compose.yml (postgres sem porta publicada, volume nomeado, sem TZ) e docker/compose.dev.yml"
  - ".env.example com todas as variáveis do projeto declaradas sem valor"
  - "lib/saude.ts (módulo puro) + tests/unit/saude.test.ts, ESLint flat config, Prettier e Vitest como portões de qualidade"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07]

# Actuals (#2632)
actuals:
  tokens: 3900
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added:
    - "next@15.5.22, react@19.1.0, react-dom@19.1.0"
    - "drizzle-orm@0.45.2, drizzle-kit@0.31.10, pg@8.22.0, @types/pg@8.20.4, tsx@4.23.8"
    - "vitest@4.1.10, prettier@3.9.6"
    - "eslint@^9, eslint-config-next@15.5.22, @eslint/eslintrc@^3 (flat config)"
  patterns:
    - "Regras de decisão puras em lib/*.ts (sem import de React nem do cliente do banco), consumidas pelas rotas"
    - "Rota de API monta a resposta HTTP a partir do resultado de um módulo puro, nunca decide status inline"
    - "docker/compose.yml é a base de produção; docker/compose.dev.yml é uma sobreposição só de desenvolvimento (nunca vai ao servidor)"

key-files:
  created:
    - app/page.tsx
    - app/frase-no-ar.ts
    - app/layout.tsx
    - app/globals.css
    - app/api/health/route.ts
    - db/schema.ts
    - db/index.ts
    - db/migrate.ts
    - db/migrations/0000_curvy_magus.sql
    - drizzle.config.ts
    - docker/compose.yml
    - docker/compose.dev.yml
    - .env.example
    - lib/saude.ts
    - tests/unit/saude.test.ts
    - vitest.config.ts
    - .prettierrc
  modified:
    - package.json
    - tsconfig.json
    - next.config.ts
    - eslint.config.mjs
    - .gitignore

key-decisions:
  - "FRASE_NO_AR movida para app/frase-no-ar.ts (não para dentro de app/page.tsx) porque o validador de exports de página do Next.js 15 rejeita qualquer export nomeado além do conjunto fechado (default, metadata, generateStaticParams etc.); exportar a frase direto de page.tsx quebra `next build` com erro de tipo"
  - "db/migrate.ts e drizzle.config.ts carregam .env.local com process.loadEnvFile() quando o arquivo existe — scripts soltos (fora do runtime do Next.js) não herdam .env.local sozinhos, e sem isso npm run db:migrate falhava com ECONNREFUSED"
  - "Postgres 17-alpine escolhido como imagem oficial mais recente disponível (mínimo exigido: 15)"
  - "eslint.config.mjs ignora .claude/, .planning/ e amassa-plataforma/ — ferramentas do GSD e documentos de planejamento não são código da aplicação e não devem ser cobertos por --max-warnings=0"

patterns-established:
  - "Módulo puro em lib/: recebe dados primitivos, devolve dados, zero imports — testável sem subir nada"
  - "Consulta real ao banco antes de responder 200 em qualquer endpoint de saúde"

requirements-completed: [INFRA-03]

coverage:
  - id: D1
    description: "/api/health executa uma consulta real a verificacao_infraestrutura e responde 200/{banco:ok} com o Postgres no ar, 503/{banco:erro} com o Postgres parado"
    requirement: "INFRA-03"
    verification:
      - kind: integration
        ref: "curl -sf http://localhost:3000/api/health (banco ativo) e com docker compose stop postgres (banco parado) — verificado duas vezes, pelo executor e de forma independente pelo orquestrador"
        status: pass
      - kind: unit
        ref: "tests/unit/saude.test.ts#interpretarSaudeDoBanco"
        status: pass
    human_judgment: false
  - id: D2
    description: "Página inicial mostra AMASSA e a frase FRASE_NO_AR sobre o fundo #F6F3F0 com tinta #1D2221, sem tokens de design nem shadcn"
    verification:
      - kind: automated_ui
        ref: "curl -sf http://localhost:3000/ | grep 'A plataforma do ateliê está no ar.'; grep '#F6F3F0'/'#1D2221' app/page.tsx; grep -c '@theme' app/globals.css = 0; ls components/ui = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "docker/compose.yml roda o Postgres sem porta publicada, com volume nomeado dados_postgres e sem TZ injetado; docker/compose.dev.yml é a sobreposição de desenvolvimento"
    verification:
      - kind: other
        ref: "grep -c 'ports:'/'5432:5432'/'env_file'/'America/Sao_Paulo' docker/compose.yml = 0; grep -c 'dados_postgres' > 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run lint e npm test existem, saem com código 0 no estado correto, e npm test sai com código diferente de 0 quando um teste é invertido"
    verification:
      - kind: unit
        ref: "npm run lint && npm test (código 0); inversão temporária em tests/unit/saude.test.ts confirmada saindo com código 1, revertida antes do commit"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-05
status: complete
---

# Phase 1 Plan 1: Fundação — Fatia Traçadora Fundação/Deploy Summary

**Next.js 15 com App Router e TypeScript estrito, `/api/health` consultando Postgres real via Drizzle, contêiner de banco sem porta publicada, e ESLint/Prettier/Vitest como portões de qualidade que falham de verdade.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-05T22:50:00Z (aprox., scaffolding inicial)
- **Completed:** 2026-08-05T22:48:31Z (commit final, horário local UTC+1)
- **Tasks:** 2/2
- **Files modified:** 26

## Accomplishments
- Caminho completo do arquivo-fonte ao navegador provado localmente: `app/page.tsx` → `/api/health` → Drizzle → Postgres em contêiner, com migração versionada
- Página mínima da marca (D-12/D-13) mostrando AMASSA e `FRASE_NO_AR`, sem antecipar nenhum token de design da Fase 2
- `docker/compose.yml` com o serviço `postgres` seguindo as três regras inegociáveis: sem porta publicada, volume nomeado `dados_postgres`, sem `TZ` injetado; `docker/compose.dev.yml` como sobreposição só de desenvolvimento
- Regra de negócio da saúde do banco extraída para o módulo puro `lib/saude.ts`, coberto por teste unitário, com a inversão de expectativa executada de verdade para provar que `npm test` falha quando deve falhar
- ESLint (flat config, `--max-warnings=0`), Prettier e Vitest configurados como os portões que o pipeline da Fase 1 vai usar antes de qualquer publicação

## Task Commits

Each task was committed atomically:

1. **Task 1: Caminho completo — página, /api/health e Postgres em contêiner** - `27c26c3` (feat)
2. **Task 2 (RED): Teste falho para interpretarSaudeDoBanco** - `87ce1da` (test)
3. **Task 2 (GREEN): interpretarSaudeDoBanco em lib/saude.ts e portões de qualidade** - `1fde1e8` (feat)

_Nota: Task 2 é `tdd="true"`, por isso tem dois commits (RED → GREEN); não houve refatoração adicional além da implementação mínima._

## Files Created/Modified
- `app/page.tsx` - página mínima da marca, consome `FRASE_NO_AR`
- `app/frase-no-ar.ts` - constante exportada `FRASE_NO_AR` (ver Deviations)
- `app/layout.tsx` - `lang="pt-BR"`, título AMASSA, sem fonte customizada
- `app/globals.css` - só a importação do Tailwind v4, sem `@theme`
- `app/api/health/route.ts` - `GET` consultando o banco e montando a resposta via `lib/saude.ts`
- `db/schema.ts` - tabela mínima `verificacao_infraestrutura`
- `db/index.ts` - `pool` (node-postgres) e `db` (Drizzle)
- `db/migrate.ts` - aplica migrações versionadas, carrega `.env.local` se existir
- `db/migrations/0000_curvy_magus.sql` - migração gerada pelo `drizzle-kit generate`
- `drizzle.config.ts` - schema, out e dialeto do drizzle-kit
- `docker/compose.yml` - serviço `postgres` de produção
- `docker/compose.dev.yml` - sobreposição de desenvolvimento (porta 127.0.0.1:5433)
- `.env.example` - todas as variáveis do projeto, sem valores
- `lib/saude.ts` - módulo puro `interpretarSaudeDoBanco`
- `tests/unit/saude.test.ts` - cobre os dois casos (consulta ok/erro)
- `vitest.config.ts`, `.prettierrc`, `eslint.config.mjs` (modificado) - portões de qualidade
- `package.json` - scripts `lint`, `format`, `test`, `db:generate`, `db:migrate`
- `.gitignore` (modificado) - acrescenta `next-env.d.ts` e `*.tsbuildinfo`

## Decisions Made
- `FRASE_NO_AR` mora em `app/frase-no-ar.ts`, não em `app/page.tsx` diretamente — ver Deviations
- `db/migrate.ts`/`drizzle.config.ts` carregam `.env.local` via `process.loadEnvFile()` quando o arquivo existe, sem depender de pacote extra (Node 24 já tem essa API nativa)
- Imagem `postgres:17-alpine` (estável mais recente, acima do mínimo de 15 exigido)
- `eslint.config.mjs` ignora `.claude/`, `.planning/` e `amassa-plataforma/` — não são código da aplicação

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FRASE_NO_AR movida de app/page.tsx para app/frase-no-ar.ts**
- **Found during:** Task 1, ao rodar `npm run build` pela primeira vez
- **Issue:** O plano pedia `FRASE_NO_AR` como constante exportada no topo de `app/page.tsx`. O Next.js 15 valida em tempo de build que arquivos de página só exportam um conjunto fechado de símbolos (`default`, `metadata`, `generateStaticParams` etc.) — qualquer export extra falha `next build` com um erro de tipo (`checkFields` em `.next/types/app/page.ts`). Isso não é preferência de estilo, é uma restrição real do framework.
- **Fix:** `FRASE_NO_AR` passou a viver em `app/frase-no-ar.ts`, importada por `app/page.tsx`. Continua exportada e trivialmente encontrável — `grep -c 'FRASE_NO_AR' app/page.tsx` retorna 2 (import + uso), e o valor é idêntico ao pedido no plano.
- **Files modified:** app/page.tsx, app/frase-no-ar.ts (novo)
- **Verification:** `npm run build` compila e passa a checagem de tipos; `curl http://localhost:3000/` contém a frase
- **Committed in:** `27c26c3`
- **Aprovado pelo coordenador** na verificação do checkpoint do tracer, como desvio já esperado (restrição real do Next.js 15, não preferência).

**2. [Rule 3 - Blocking] .env.local carregado manualmente em scripts soltos**
- **Found during:** Task 1, ao rodar `npm run db:migrate` pela primeira vez
- **Issue:** `DATABASE_URL` vive em `.env.local`, mas esse arquivo só é carregado automaticamente pelo runtime do Next.js (`next dev`/`build`/`start`). Um script solto como `db/migrate.ts`, rodado via `tsx`, não o herda — a conexão falhava com `ECONNREFUSED` porque `pg.Pool` caía no host/porta padrão.
- **Fix:** `db/migrate.ts` e `drizzle.config.ts` chamam `process.loadEnvFile(".env.local")` quando o arquivo existe, antes de qualquer import que leia `process.env.DATABASE_URL`. No servidor, onde `.env.local` não existe e a variável já vem do ambiente do contêiner `ferramentas`, o carregamento é pulado silenciosamente.
- **Files modified:** db/migrate.ts, drizzle.config.ts
- **Verification:** `npm run db:migrate` aplica a migração com sucesso
- **Committed in:** `27c26c3`

**3. [Rule 3 - Blocking] eslint.config.mjs ignorando .claude/, .planning/ e amassa-plataforma/**
- **Found during:** Task 2, ao rodar `npm run lint` pela primeira vez
- **Issue:** `eslint . --max-warnings=0` varria o repositório inteiro, incluindo a instalação do GSD em `.claude/scripts/` (JavaScript com `require()`, que o `eslint-config-next` proíbe). 612 erros vinham de arquivos que não são código da aplicação.
- **Fix:** Acrescentado `.claude/**`, `.planning/**` e `amassa-plataforma/**` à lista de `ignores` do ESLint.
- **Files modified:** eslint.config.mjs
- **Verification:** `npm run lint` sai com código 0
- **Committed in:** `1fde1e8`

---

**Total deviations:** 3 auto-fixed (1 bug/restrição real de framework, 2 bloqueantes)
**Impact on plan:** Nenhum dos três altera o objetivo do plano ou o escopo da fase. Os dois primeiros são consequência direta de rodar o plano contra o Next.js 15 e o Node 24 de verdade; o terceiro é escopo de ferramenta (lint), não de aplicação.

## Issues Encountered
None além dos três desvios já documentados acima.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária nesta fase. `.env.local` já foi criado na máquina com valores reais de desenvolvimento (senha aleatória gerada localmente, nunca versionada).

## Next Phase Readiness
- A base está pronta para as próximas plans da Fase 1: Dockerfile multi-estágio (`standalone` + `ferramentas`), repositório GitHub com secret scanning, VPS Contabo, GitHub Actions e DNS.
- Nenhum bloqueio conhecido. O Postgres de desenvolvimento continua rodando localmente (`docker-postgres-1`, healthy) para as próximas plans que dependam dele.
- `npm run lint` e `npm test` já existem e falham de verdade — pré-requisito direto para o portão de CI que a Fase 1 vai configurar (INFRA-07).

---
*Phase: 01-funda-o-e-primeiro-deploy*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 17 files listed in `key-files` confirmed present on disk. All 3 task commits (`27c26c3`, `87ce1da`, `1fde1e8`) confirmed present in `git log --oneline --all`.
