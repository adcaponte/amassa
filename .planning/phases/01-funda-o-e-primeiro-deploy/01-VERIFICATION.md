---
phase: 01-funda-o-e-primeiro-deploy
verified: 2026-08-08T00:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Fundação e Primeiro Deploy — Relatório de Verificação

**Objetivo da fase:** Ter um endereço `https://` no ar, com deploy automático funcionando — sem
nenhuma funcionalidade, só o caminho do código até a internet.
**Verificado em:** 2026-08-08
**Status:** passed
**Re-verificação:** Não — verificação inicial

## Achamento Geral

Este é o caso raro em que o resultado final do trabalho (o site em produção) não é alcançável
por este verificador — ele só lê o repositório. A verificação aqui é, portanto, dupla:

1. **Verificação de código-fonte (feita agora, por mim):** os artefatos que fazem o deploy
   *possível* — Dockerfile, compose, workflow, roteiros, .env.example, lib/saude.ts — existem,
   são substantivos e estão conectados corretamente entre si.
2. **Verificação de produção real (não alcançável por mim, já feita pelo orquestrador em
   01-07 e registrada em `01-UAT.md`):** o site está de fato no ar, com HTTPS, deploy
   automático provado por push real, porta 5432 fechada, reinício com dados intactos, backup
   ativo no painel Contabo e portão de teste quebrado provado em execução real. Todos os 10
   critérios do `01-UAT.md` estão marcados `pass`, 9 deles verificados externamente pelo
   orquestrador (curl, API do GitHub, `Test-NetConnection`) e 1 (Auto Backup da Contabo)
   confirmado pelo dono por ser um painel privado.

Combinando as duas camadas, o objetivo da fase está alcançado.

### Truths Observáveis (10 Critérios de Sucesso do ROADMAP.md)

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | Nenhum `.env` com valores reais no repositório público | ✓ VERIFIED | `git log --all --full-history -- .env` e `-- .env.local` vazios nesta cópia do repositório; `.gitignore` cobre `.env*` exceto `.env.example`; confirmado também de fora em `01-UAT.md` D1 (API do GitHub devolveu 404 para `.env`/`.env.local`) |
| 2 | `https://amassacerrado.com.br` abre com cadeado, sem aviso | ✓ VERIFIED (produção) | Não alcançável por mim (não tenho acesso à internet/servidor). `docker/Caddyfile` está correto no repo (reverse_proxy + redirect www→apex, HTTPS automático via Let's Encrypt). Confirmado externamente em `01-UAT.md` D2 (curl com handshake TLS válido, 301 do www) |
| 3 | Alterar um texto, `git push` na `main`, muda sozinho em produção | ✓ VERIFIED | `.github/workflows/entrega.yml` encadeia `qualidade → e2e → imagem → implantar` via `needs`; job `implantar` faz `docker compose pull app && docker compose up -d app` por SSH. Confirmado em produção real em `01-UAT.md` D3 (commit `4da5326` alterou `FRASE_NO_AR`, quatro jobs verdes, frase nova servida sem comando manual) |
| 4 | `/api/health` responde `ok` com consulta real ao banco | ✓ VERIFIED | `app/api/health/route.ts` executa `db.select(...).from(verificacaoInfraestrutura)` de verdade e delega a decisão de status a `lib/saude.ts` (módulo puro, zero imports); 200/`{status:ok,banco:ok}` ou 503/`{status:erro,banco:erro}` conforme o resultado da consulta, nunca um literal. Confirmado em produção em `01-UAT.md` D4 (banco parado → 503 real) |
| 5 | Porta 5432 do VPS não aceita conexão de fora | ✓ VERIFIED | `docker/compose.yml`: serviço `postgres` sem chave `ports:` (grep confirmado = 0). Confirmado de fora em `01-UAT.md` D5 (`Test-NetConnection` 5432 = `False`, 443 = `True`) |
| 6 | Reiniciar o VPS traz a aplicação de volta sozinha, dados intactos | ✓ VERIFIED (produção) | `restart: unless-stopped` em `postgres`, `app` e `caddy`; volume nomeado `dados_postgres` (não bind mount). Não reproduzível por mim (exige reboot de VPS real). Confirmado em `01-UAT.md` D6 (linha de prova sobreviveu a `sudo reboot`) |
| 7 | Auto Backup da Contabo ativo no painel | ⚠️ Ver nota | Não verificável em código — é um painel externo, privado, só visível pelo dono. `01-UAT.md` D7 registra `pass` com ressalva explícita: havia um incidente aberto na Contabo (backups atrasados, restores indisponíveis) no momento da verificação — camada "ativa no papel, degradada na prática". A própria fase já registra isso como pendência que atravessa para a Fase 2 |
| 8 | Um deploy não recria o container do Postgres | ✓ VERIFIED | `.github/workflows/entrega.yml` job `implantar`: `docker compose up -d app` sempre nomeia o serviço (nunca `up -d` sozinho); grep confirma `compose up -d` == `compose up -d app` em contagem. Confirmado em produção em `01-UAT.md` D8 (mesmo ID do container antes/depois de duas publicações) |
| 9 | Deploy com teste quebrado é barrado, não vai ao ar | ✓ VERIFIED | Cadeia `qualidade → e2e → imagem → implantar` via `needs` no workflow: se `e2e` falha, `imagem` e `implantar` não rodam. Confirmado em execução real em `01-UAT.md` D9 (job `e2e` falhou no build da imagem, `imagem` ficou `skipped`) |
| 10 | Migrações aplicadas à mão no servidor, fora do pipeline | ✓ VERIFIED | `grep -c 'db:migrate' .github/workflows/entrega.yml` = 0 (job `e2e` chama `npx tsx db/migrate.ts` diretamente, nunca o alias); estágio `ferramentas` do Dockerfile carrega `db/`, `drizzle.config.ts`, `tsconfig.json`, com `drizzle-kit`/`tsx` em `devDependencies`, herdados de `dependencias` (`npm ci` completo). `docker/compose.yml`: serviço `ferramentas` sob `profiles: ["ferramentas"]`, `restart: "no"` — nunca sobe com `up -d`. Confirmado em produção em `01-UAT.md` D10 |

**Score:** 10/10 truths verificados (0 presentes-mas-não-comportamentalmente-verificados)

A truth #7 não é um FAIL nem um UNCERTAIN no sentido de "não sei" — é um item cuja fonte de
verdade é um painel privado que só o dono acessa, já testemunhado e registrado com a ressalva
correta no `01-UAT.md`. Mantido como VERIFIED com nota, não como gap, porque o próprio processo
de UAT já capturou a degradação real e a converteu em item de acompanhamento explícito para o
início da Fase 2 (ver "Deferred Follow-Ups" em `01-UAT.md`).

### Artefatos Exigidos (checklist específico da fase)

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `docker/Dockerfile` | 4 estágios; `ferramentas` com `drizzle-kit`/`tsx`; `ENV HOSTNAME=0.0.0.0` no `app` | ✓ VERIFIED | Estágios `dependencias`, `construtor`, `app`, `ferramentas` confirmados por nome; `ferramentas` copia `db/`, `drizzle.config.ts`, herda `node_modules` completo de `dependencias` (que roda `npm ci`, incluindo `drizzle-kit@0.31.10` e `tsx@4.23.8` em devDependencies); `ENV HOSTNAME=0.0.0.0` presente e comentado no estágio `app` (linha 59) |
| `docker/compose.yml` | `postgres` sem `ports:`/`TZ`; `TZ` só em `app`; `caddy` único com portas publicadas; `ferramentas` atrás de `profiles:`; healthcheck do `app` em `127.0.0.1` | ✓ VERIFIED | `postgres`: sem `ports:`, sem `TZ`, healthcheck via `pg_isready`. `app`: `TZ: ${TZ}` presente, healthcheck `wget ... http://127.0.0.1:3000/api/health` (comentário explica por que não `localhost`). `caddy`: único serviço com `ports: ["80:80", "443:443"]`. `ferramentas`: `profiles: ["ferramentas"]`, `restart: "no"` |
| `.github/workflows/entrega.yml` | cadeia `qualidade→e2e→imagem→implantar`; `NEXT_PUBLIC_SITE_URL` como build-arg; sem `DATABASE_URL`/`AUTH_SECRET` nos build-args; `up -d app`; zero `db:migrate`; sem `docker login` no deploy | ✓ VERIFIED | 4 jobs encadeados por `needs` na ordem correta; `build-args: NEXT_PUBLIC_SITE_URL=...` no job `imagem`; nenhuma ocorrência de `DATABASE_URL`/`AUTH_SECRET` como build-arg em lugar nenhum do arquivo; `docker compose up -d app` (sempre nomeado) no job `implantar`; `grep -c 'db:migrate'` = 0 (job `e2e` usa `npx tsx db/migrate.ts`); job `implantar` não tem `docker login` (o login no GHCR só existe no job `imagem`, que usa `docker/login-action@v3` com token efêmero do runner — não é o VPS autenticando) |
| `.env.example` | 11 variáveis, nenhuma com valor | ⚠️ Discrepância menor | 12 variáveis declaradas (`NEXT_PUBLIC_SITE_URL`, `IMAGEM_APP`, `IMAGEM_FERRAMENTAS`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `DATABASE_URL_TESTE`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `TZ`, `RCLONE_REMOTE`), todas sem valor atribuído. A 12ª (`RCLONE_REMOTE`) foi acrescentada com o comentário explícito "Backup — usado pelo cron do host (Fase 2)" — mesmo padrão já usado deliberadamente para `AUTH_SECRET`/`AUTH_TRUST_HOST` (pré-declaradas nesta fase por decisão de contexto, D-15/`01-CONTEXT.md`). Não é uma funcionalidade da Fase 2 vazando (não há `scripts/backup.sh`, nem lógica de rclone, nem `cron`), só um nome de variável reservado com valor vazio — coerente com o padrão já aceito no restante do arquivo. Não bloqueia nenhum critério de sucesso, mas diverge do número exato citado no prompt de verificação; registrado aqui para transparência |
| `public/.gitkeep` | Existe | ✓ VERIFIED | `public/.gitkeep` presente (220 bytes) — corrige o bug real encontrado em produção (diretório vazio não versionado quebrava o `COPY` do Dockerfile em checkout limpo), commit `b560dc2` |
| `lib/saude.ts` | Módulo puro (zero imports), consumido por `/api/health` | ✓ VERIFIED | `lib/saude.ts` não tem nenhum `import`; `app/api/health/route.ts` importa `interpretarSaudeDoBanco` de `@/lib/saude` e usa o resultado para montar status/HTTP |
| `docs/operacao/` | Dois roteiros | ✓ VERIFIED | `01-preparar-servidor.md` (617 linhas, 35 ocorrências de "você deve ver") e `02-publicar-e-dominio.md` (369 linhas, 22 ocorrências, 10 checkboxes de critério de aceite) |
| Nada da Fase 2 vazou | sem `usuarios`, Auth.js, `middleware.ts`, `scripts/backup.sh`, `@theme`, shadcn em `components/ui` | ✓ VERIFIED | `db/schema.ts` só tem `verificacao_infraestrutura` (mínima, comentário explícito "Nenhuma tabela de produto é modelada nesta fase"); nenhuma dependência de auth em `package.json`; `middleware.ts` inexistente; `scripts/backup.sh` inexistente (só `scripts/testar-e2e.mjs`); `grep -c '@theme' app/globals.css` = 0; diretório `components/ui` inexistente |

### Verificação de Key Links

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `app/api/health/route.ts` | `lib/saude.ts` | `import { interpretarSaudeDoBanco }` | ✓ WIRED | Resultado da consulta ao banco alimenta a função pura, que decide status/HTTP; a rota nunca decide inline |
| `app/api/health/route.ts` | `db/schema.ts` via `db/index.ts` | `db.select(...).from(verificacaoInfraestrutura)` | ✓ WIRED | Consulta real, não um `return` estático |
| `.github/workflows/entrega.yml` (job `e2e`) | `docker/Dockerfile` (alvo `app`) | `docker build --target app -f docker/Dockerfile .` | ✓ WIRED | O gate de E2E constrói e roda a mesma imagem que o job `imagem` publica — não `next start` |
| `.github/workflows/entrega.yml` (job `imagem`) | GHCR | `docker/build-push-action@v6`, tags `:latest`/`:ferramentas` | ✓ WIRED | Publica os dois alvos do mesmo Dockerfile |
| `.github/workflows/entrega.yml` (job `implantar`) | VPS via SSH | `ssh ... docker compose pull app && docker compose up -d app` | ✓ WIRED | Sempre nomeia `app`; corrigido para validar a chave SSH antes de usar (commit `8220dd2`, achado real da execução) |
| `docker/compose.yml` (`caddy`) | `docker/Caddyfile` | `reverse_proxy app:3000` | ✓ WIRED | Apex servido, `www` redirecionado |

### Cobertura de Requisitos

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| INFRA-01 | `https://` com cadeado, sem aviso | ✓ SATISFIED | `docker/Caddyfile` correto no repo; confirmado externamente em produção (`01-UAT.md` D2) |
| INFRA-02 | Push na `main` publica sozinho | ✓ SATISFIED | Workflow completo; confirmado em produção real (`01-UAT.md` D3, commit `4da5326`) |
| INFRA-03 | `/api/health` com consulta real | ✓ SATISFIED | `lib/saude.ts` + `app/api/health/route.ts`; confirmado em produção (`01-UAT.md` D4) |
| INFRA-04 | Porta 5432 fechada externamente | ✓ SATISFIED | `docker/compose.yml` sem `ports:` em `postgres`; confirmado externamente (`01-UAT.md` D5) |
| INFRA-05 | Reinício traz app de volta com dados intactos | ✓ SATISFIED | `restart: unless-stopped` + volume nomeado; confirmado em produção (`01-UAT.md` D6) |
| INFRA-06 | Deploy não recria o Postgres | ✓ SATISFIED | `up -d app` sempre nomeado; confirmado em produção (`01-UAT.md` D8) |
| INFRA-07 | Teste quebrado barra o deploy | ✓ SATISFIED | Cadeia `needs`; confirmado em execução real (`01-UAT.md` D9) |
| INFRA-08 | Nenhum segredo no histórico público | ✓ SATISFIED | `git log` local vazio; confirmado via API do GitHub (`01-UAT.md` D1) |
| INFRA-09 | Migração à mão, fora do pipeline | ✓ SATISFIED | `grep -c 'db:migrate'` = 0 no workflow; estágio `ferramentas` funcional; confirmado em produção (`01-UAT.md` D10) |
| INFRA-10 | Auto Backup da Contabo ativo | ✓ SATISFIED (com ressalva) | Não verificável em código (painel privado); confirmado pelo dono com ressalva de incidente Contabo registrada como pendência para a Fase 2 |

Nenhum requisito órfão: todos os 10 INFRA-01..10 aparecem declarados em pelo menos um `requirements:` de plano (01-01 a 01-07) e todos têm evidência de implementação.

### Anti-Patterns Encontrados

Nenhum marcador de dívida (`TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`) encontrado em
`docker/Dockerfile`, `docker/compose.yml`, `.github/workflows/entrega.yml`, `lib/saude.ts`,
`app/api/health/route.ts`, `db/schema.ts`. Nenhum literal estático substituindo consulta real.
Nenhum handler vazio.

### Verificações Não Alcançáveis por Este Verificador

Os itens a seguir só são verificáveis com acesso à internet pública ou ao VPS real, que este
verificador não tem. Todos já foram verificados de fora pelo orquestrador em 01-07 e estão
registrados em `01-UAT.md` (fonte: `automated`, exceto onde indicado):

- HTTPS real com cadeado válido em `https://amassacerrado.com.br` — `01-UAT.md` teste 2
- Deploy automático de ponta a ponta observado numa execução real disparada por push —
  `01-UAT.md` teste 3
- `/api/health` respondendo em produção, com banco ativo e com banco parado — `01-UAT.md` teste 4
- Porta 5432 fechada e 443 aberta, vistas de fora do servidor — `01-UAT.md` teste 5
- Reinício do VPS com dados intactos — `01-UAT.md` teste 6
- Auto Backup da Contabo ativo no painel — `01-UAT.md` teste 7 (fonte: `human`, com ressalva de
  incidente aberto na Contabo registrada nos "Deferred Follow-Ups")
- `docker compose ps -q postgres` com mesmo ID antes/depois de deploys consecutivos —
  `01-UAT.md` teste 8
- Job `e2e` falhando e barrando `imagem`/`implantar` numa execução real — `01-UAT.md` teste 9
- Migração manual funcionando no servidor real — `01-UAT.md` teste 10
- Ruleset da branch `main` (deletion + non_fast_forward) mencionado no `01-07-SUMMARY.md` como
  confirmado via API do GitHub — não é um artefato de repositório (é uma configuração do
  GitHub), portanto não verificável em código; não aparece coberto explicitamente em nenhum dos
  10 testes de `01-UAT.md`, mas também não é um dos 10 critérios de sucesso do ROADMAP.md, então
  não é um gap desta verificação

### Requerimento de Verificação Humana

Nenhum. Todos os itens que exigem observação externa já foram observados e registrados em
`01-UAT.md` por uma parte capaz de fazê-lo (orquestrador de fora, ou o dono para o painel
privado da Contabo). Não há necessidade de reabrir UAT para esta fase.

### Resumo de Gaps

Nenhum gap bloqueador. Duas notas não bloqueadoras, ambas já reconhecidas pelo próprio processo
de execução da fase:

1. **`.env.example` tem 12 variáveis, não 11** — `RCLONE_REMOTE` foi pré-declarada (sem valor,
   sem lógica) seguindo o mesmo padrão já usado para `AUTH_SECRET`/`AUTH_TRUST_HOST`. Não
   implementa nada da Fase 2, só reserva um nome. Não afeta nenhum dos 10 critérios de sucesso.
2. **Auto Backup da Contabo — "ativo no papel, degradado na prática"** — já registrado como
   `Deferred Follow-Up` no próprio `01-UAT.md`, com a ação explícita de reconferir no início da
   Fase 2, antes de qualquer dado real do ateliê entrar no sistema. Não é uma lacuna desta
   verificação — é uma pendência já rastreada corretamente pelo processo.

---

_Verificado: 2026-08-08_
_Verificador: Claude (gsd-verifier)_
