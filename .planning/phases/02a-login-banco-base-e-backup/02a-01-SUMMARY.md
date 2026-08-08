---
phase: 02a-login-banco-base-e-backup
plan: 01
subsystem: auth
tags: [next-auth, auth.js, argon2, drizzle, zod, playwright, postgres]

# Dependency graph
requires:
  - phase: 01-fundacao-e-primeiro-deploy
    provides: db/schema.ts + db/index.ts + db/migrate.ts (Drizzle já ligado ao Postgres), o
      estágio `ferramentas` do Dockerfile, a infraestrutura de E2E (Playwright, dois
      projetos, testar-e2e.mjs) e o workflow `entrega.yml` com o job `e2e` já provado
provides:
  - "Tabela `usuarios` (papel_usuario, índice funcional lower(email)) via migração gerada"
  - "A divisão obrigatória lib/auth/rotas-publicas.ts (puro) → auth.config.ts (borda,
    Edge-safe) → auth.ts (runtime Node, credenciais+hash+banco), provada por teste de grafo
    de imports (tests/unit/auth-borda.test.ts), não só por inspeção"
  - "lib/auth/senha.ts: gerarSenhaForte/gerarHash/conferirHash sobre @node-rs/argon2"
  - "middleware.ts + app/api/auth/[...nextauth]/route.ts, com matcher que exclui /api/auth"
  - "app/(auth)/login (tela mínima + Server Action) e app/(app)/page.tsx (rota protegida
    provisória) — a raiz deixou de ser pública"
  - "scripts/criar-usuario.ts + alias npm `criar-usuario`, imprime SENHA: uma única vez"
  - "tests/e2e/apoio/preparar-usuario.ts como globalSetup do Playwright — cria a conta de
    teste rodando o próprio script de produção, não semeando a tabela por fora"
  - "AUTH_TRUST_HOST/AUTH_SECRET exercitados de verdade no E2E local e no job `e2e` do CI"
affects: [02a-02, 02a-03, 02a-04, 02a-05, 02a-06, 02a-07, 02a-08, 02b-design-system-e-casca]

# Actuals (#2632)
actuals:
  tokens: 13900
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: ["next-auth@5.0.0-beta.32", "@node-rs/argon2@2.0.2", "zod@4.4.3"]
  patterns:
    - "Configuração do Auth.js dividida em auth.config.ts (Edge, zero import de runtime Node)
      e auth.ts (Node, credenciais+hash+banco) — middleware.ts só importa o primeiro"
    - "Prova por código do grafo de módulos alcançável a partir de um arquivo de borda, com
      regex sensível a fronteira de palavra para não confundir 'authorized' (callback
      legítimo) com 'authorize' (função proibida)"
    - "Scripts de CLI rodam pelo estágio `ferramentas`, nunca pela imagem `app`, e imprimem
      segredo gerado uma única vez com prefixo parseável (`SENHA: `)"
    - "globalSetup do Playwright roda o próprio script de produção contra o banco de teste,
      em vez de semear a tabela por fora — E2E exercita o caminho real"

key-files:
  created:
    - lib/auth/rotas-publicas.ts
    - lib/auth/auth.config.ts
    - lib/auth/auth.ts
    - lib/auth/senha.ts
    - middleware.ts
    - "app/api/auth/[...nextauth]/route.ts"
    - "app/(auth)/login/page.tsx"
    - "app/(auth)/login/acoes.ts"
    - "app/(app)/page.tsx"
    - scripts/criar-usuario.ts
    - tests/e2e/apoio/preparar-usuario.ts
    - tests/unit/rotas-publicas.test.ts
    - tests/unit/auth-borda.test.ts
    - db/migrations/0001_chubby_blonde_phantom.sql
  modified:
    - db/schema.ts
    - package.json
    - playwright.config.ts
    - tests/e2e/fundacao.spec.ts
    - .github/workflows/entrega.yml

key-decisions:
  - "next-auth fixado em 5.0.0-beta.32 (maior 5.x publicada; a tag `latest` do npm aponta
    para a linha 4.x legada) — aprovado no portão de legitimidade de pacote"
  - "@node-rs/argon2 fixado em 2.0.2 apesar de ~20 meses sem publicação — avaliado e aceito
    pelo dono no portão de legitimidade: é uma ligação nativa fina, estável, sobre a crate
    Rust `argon2`, com o monorepo napi-rs/node-rs ainda ativo"
  - "playwright.config.ts usa baseURL http://localhost:3000, não 127.0.0.1:3000 — o NextURL
    interno do Next.js normaliza qualquer host 127.x.x.x para o literal 'localhost' ao montar
    URLs (inclusive o redirect do middleware). Testar com 127.0.0.1 faria o próprio fluxo de
    login trocar de origem no meio do caminho (127.0.0.1 → localhost), o que descartaria o
    cookie de sessão entre a ida e a volta — não é comportamento do AUTH_TRUST_HOST, é um
    detalhe de teste local"
  - "lib/auth/senha.ts não importa o enum `Algorithm` de @node-rs/argon2 (é um enum ambiente,
    inacessível com `isolatedModules` do tsconfig.json) — confirmado empiricamente que
    hash() sem a opção `algorithm` já produz argon2id (prefixo $argon2id$ no hash resultante)"
  - "scripts/criar-usuario.ts valida e-mail com z.string().trim().toLowerCase().pipe(z.email())
    em vez de z.email().trim().toLowerCase() — a validação de formato de z.email() roda ANTES
    de qualquer transform encadeado depois dele, então .trim()/.toLowerCase() só depois do
    .email() não tinha efeito nenhum na checagem"

patterns-established:
  - "Teste de grafo de módulos: percorre imports relativos/@alias a partir de um arquivo raiz
    e afirma o que NÃO pode ser alcançado — reutilizável em qualquer fronteira Edge/Node
    futura do projeto"
  - "Regex com fronteira de palavra (`termo(?![a-zA-Z])`) para checar presença de um
    identificador de função sem falso positivo em nomes derivados (`authorized` vs
    `authorize`)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-07, AUTH-09]

coverage:
  - id: D1
    description: "Abrir qualquer endereço sem estar logado leva para /login"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/fundacao.spec.ts#sem sessao a raiz redireciona para /login"
        status: pass
    human_judgment: false
  - id: D2
    description: "Entrar com e-mail e senha dá acesso ao sistema"
    requirement: "AUTH-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fundacao.spec.ts#entrar com a conta criada pelo script abre a raiz"
        status: pass
    human_judgment: false
  - id: D3
    description: "Criar um usuário por linha de comando funciona e imprime uma senha forte uma única vez"
    requirement: "AUTH-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/apoio/preparar-usuario.ts — globalSetup roda scripts/criar-usuario.ts e lê a linha SENHA:"
        status: pass
    human_judgment: false
  - id: D4
    description: "A tabela usuarios tem a coluna ativo e nenhum caminho de código apaga uma linha de usuário"
    requirement: "AUTH-09"
    verification:
      - kind: unit
        ref: "tests/unit/auth-borda.test.ts#nenhum caminho de código apaga uma linha de usuarios (AUTH-09)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O middleware.ts carrega sem erro de módulo nativo no runtime Edge — a divisão auth.config.ts / auth.ts está correta"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "tests/unit/auth-borda.test.ts#divisão de borda: auth.config.ts nunca alcança runtime Node"
        status: pass
      - kind: integration
        ref: "npm run build com middleware.ts presente"
        status: pass
    human_judgment: false
  - id: D6
    description: "Os três pacotes novos (autenticação, hash, validação) foram conferidos como legítimos no registro público antes da instalação"
    requirement: "AUTH-02"
    verification: []
    human_judgment: true
    rationale: "Legitimidade de pacote é julgamento humano sobre o registro público (autoria,
      downloads, repositório de origem). Já resolvido nesta execução: o dono conferiu os três
      pacotes contra registry.npmjs.org (via dados que eu levantei com curl) e respondeu
      'aprovado' no checkpoint blocking-human da Tarefa 1, incluindo uma ressalva avaliada e
      aceita sobre o gap de publicação do @node-rs/argon2. Mantido como human_judgment: true
      porque a natureza da decisão (legitimidade de pacote) nunca deve auto-passar num rodapé
      de UAT futuro, mesmo já tendo sido decidida aqui."

duration: 32min
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 01: Tracer de Login e Divisão de Borda do Auth.js Summary

**Tracer completo de autenticação — Auth.js v5 (Credentials) + argon2id sobre a tabela
`usuarios`, dividido em `auth.config.ts`/`auth.ts` e provado por um teste que percorre o
grafo de módulos, não por inspeção visual.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-08-08T00:08:10Z (aproximado, marcado em STATE.md no início da execução da fase)
- **Completed:** 2026-08-08T00:38:13Z
- **Tasks:** 3 (1 checkpoint de legitimidade de pacote + 1 tracer + 1 auto)
- **Files modified:** 23 (18 novos, 5 modificados, 1 removido/renomeado)

## Accomplishments

- Migração real gera a tabela `usuarios` (enum `papel_usuario`, índice único funcional
  `usuarios_email_idx` sobre `lower(email)`, check de comprimento do nome) — conferida no
  Postgres de desenvolvimento com `\d usuarios`.
- A divisão de configuração do Auth.js — "o erro mais provável da fase" segundo
  `01-ARQUITETURA.md` §4 — está implementada E provada por código: `middleware.ts` carrega
  no runtime Edge sem tocar `@node-rs/argon2` nem `@/db`, e `tests/unit/auth-borda.test.ts`
  fica vermelho no instante em que alguém reintroduzir esse acoplamento (provado nos dois
  sentidos durante a execução, ver Issues Encountered).
- Caminho ponta a ponta funcionando: `scripts/criar-usuario.ts` cria a conta e imprime a
  senha uma única vez → a tela de login em `app/(auth)/login` autentica via Server Action →
  `middleware.ts` protege tudo fora de `/login` e `/api/health` → `app/(app)/page.tsx` abre
  autenticado. Provado por `npm run test:e2e` nos projetos desktop e celular, seis testes
  passando (3 specs × 2 projetos).
- `AUTH_TRUST_HOST` e `AUTH_SECRET` deixaram de ser variáveis só declaradas no `.env` do
  servidor: agora são exercitadas de verdade no E2E local (`playwright.config.ts`) e no job
  `e2e` do workflow, contra a imagem Docker real.

## Task Commits

1. **Tarefa 1: Conferir a legitimidade dos três pacotes antes de instalar** — portão
   `checkpoint:human-verify` (`gate="blocking-human"`). Sem artefato de código; resolvido por
   aprovação humana explícita no checkpoint (ver Decisions Made). Nenhum commit próprio.
2. **Tarefa 2: Da migração ao login que abre uma rota protegida — um caminho só** -
   `f9b1f2f` (feat)
3. **Tarefa 3: Provar a divisão de borda — o teste que falharia se ela estivesse errada** -
   `7566bf9` (test)

**Plan metadata:** commit final deste SUMMARY, a seguir.

## Files Created/Modified

- `db/schema.ts` - acrescenta `papelUsuario` (enum) e `usuarios` (tabela + índice funcional + check)
- `db/migrations/0001_chubby_blonde_phantom.sql` - migração gerada por `drizzle-kit generate`
- `lib/auth/rotas-publicas.ts` - módulo puro: `ROTAS_PUBLICAS`, `ehRotaPublica(caminho)`
- `lib/auth/auth.config.ts` - config Edge-safe: `pages`, sessão JWT, callback `authorized`
- `lib/auth/auth.ts` - config runtime Node: provedor `Credentials`, `handlers`/`auth`/`signIn`/`signOut`
- `lib/auth/senha.ts` - `gerarSenhaForte`, `gerarHash`, `conferirHash` sobre `@node-rs/argon2`
- `middleware.ts` - `NextAuth(configuracaoBase).auth` + `matcher` excluindo `/api/auth`
- `app/api/auth/[...nextauth]/route.ts` - reexporta `GET`/`POST`, `runtime = "nodejs"`
- `app/(auth)/login/page.tsx` - tela mínima (HTML + Tailwind), sem componente de biblioteca
- `app/(auth)/login/acoes.ts` - Server Action `entrar`, valida com Zod e chama `signIn`
- `app/(app)/page.tsx` - rota protegida provisória (era `app/page.tsx`; a raiz deixou de ser pública)
- `scripts/criar-usuario.ts` - CLI: valida, recusa e-mail duplicado, gera senha, imprime uma vez
- `playwright.config.ts` - `globalSetup`, `baseURL` localhost, `AUTH_SECRET`/`AUTH_TRUST_HOST` no `webServer.env`
- `tests/e2e/apoio/preparar-usuario.ts` - `globalSetup`: roda `criar-usuario` de verdade, publica credenciais
- `tests/e2e/fundacao.spec.ts` - reescrito para D1/D2; `/api/health` inalterado
- `tests/unit/rotas-publicas.test.ts` - prova `ehRotaPublica` nos dois sentidos
- `tests/unit/auth-borda.test.ts` - prova a divisão de borda por grafo de módulos + AUTH-09
- `.github/workflows/entrega.yml` - `AUTH_SECRET`/`AUTH_TRUST_HOST` no `docker run` do job `e2e`
- `package.json` / `package-lock.json` - `next-auth`, `@node-rs/argon2`, `zod` fixados; alias `criar-usuario`

## Decisions Made

- **Portão de legitimidade de pacote (Tarefa 1) aprovado pelo dono.** Levantei os dados do
  registro npm via `curl` (repositório de origem, downloads/semana, data da última
  publicação) para acelerar a conferência, mas o julgamento em si ficou com o dono, como o
  protocolo exige para um portão `blocking-human`. Resultado: `next-auth@5.0.0-beta.32`
  (repo `nextauthjs/next-auth`, 5,7M downloads/semana), `@node-rs/argon2@2.0.2` (repo
  `napi-rs/node-rs`, 936 mil downloads/semana, ~20 meses sem publicação — avaliado e aceito
  conscientemente), `zod@4.4.3` (repo `colinhacks/zod`, 251M downloads/semana).
- Ver também `key-decisions` no frontmatter (baseURL do Playwright, `Algorithm` do argon2,
  ordem de validação do `z.email()`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `z.email().trim().toLowerCase()` não trimava nem normalizava antes de validar o formato**
- **Found during:** Tarefa 2 (testando `scripts/criar-usuario.ts` manualmente)
- **Issue:** No Zod v4, o schema retornado por `z.email()` valida o formato usando o valor
  ORIGINAL, antes de qualquer `.trim()`/`.toLowerCase()` encadeado depois dele — a checagem
  de e-mail com espaço nas pontas falhava mesmo com os dois métodos encadeados.
- **Fix:** Trocado por `z.string().trim().toLowerCase().pipe(z.email(...))` em
  `scripts/criar-usuario.ts`, que aplica os transforms antes de validar o formato. Confirmado
  com teste manual isolado (`node -e`) antes e depois da mudança.
- **Files modified:** scripts/criar-usuario.ts
- **Verification:** `npm run criar-usuario -- --nome "..." --email "  ANA@Exemplo.TEST "`
  agora aceita e normaliza corretamente; testado também o caminho de rejeição.
- **Committed in:** f9b1f2f (Tarefa 2)

**2. [Rule 1 - Bug] `next build` falhava por causa de um enum ambiente do `@node-rs/argon2`**
- **Found during:** Tarefa 2 (`npm run build`)
- **Issue:** `Algorithm.Argon2id` é um `const enum` ambiente exportado por `@node-rs/argon2`;
  `tsconfig.json` tem `isolatedModules: true`, e TypeScript recusa acessar membros de enum
  ambiente nesse modo ("Cannot access ambient const enums when 'isolatedModules' is
  enabled").
- **Fix:** Removida a opção `algorithm` da chamada a `hash()` em `lib/auth/senha.ts`.
  Confirmado empiricamente com `node -e` que `hash()` sem essa opção já produz um hash
  `$argon2id$...` — é o padrão documentado do próprio pacote.
- **Files modified:** lib/auth/senha.ts
- **Verification:** `npm run build` volta a compilar; hash gerado manualmente confere o
  prefixo `$argon2id$`.
- **Committed in:** f9b1f2f (Tarefa 2)

**3. [Rule 1 - Bug] Testar com `baseURL: http://127.0.0.1:3000` quebrava o fluxo de login no E2E**
- **Found during:** Tarefa 2 (`npm run test:e2e`, primeira execução completa)
- **Issue:** O `NextURL` interno do Next.js normaliza qualquer hostname `127.x.x.x` para o
  literal `"localhost"` ao montar URLs (`node_modules/next/dist/server/web/next-url.js`,
  `REGEX_LOCALHOST_HOSTNAME`) — inclusive o `Location` do redirect que o middleware do
  Auth.js gera para usuários não autenticados. Testando com `baseURL: "http://127.0.0.1:3000"`,
  o próprio fluxo de redirecionamento trocava de origem no meio do caminho
  (`127.0.0.1:3000` → `localhost:3000`), o que descartaria o cookie de sessão entre a ida e a
  volta em um fluxo de login real — não é um bug do `AUTH_TRUST_HOST` nem da aplicação, é um
  detalhe de como o Next.js normaliza URLs internamente.
- **Fix:** `baseURL` trocado para `http://localhost:3000` em `playwright.config.ts` (o
  `webServer.url`, usado só para o probe de prontidão HTTP, continua em `127.0.0.1:3000` sem
  problema, já que não estabelece sessão).
- **Files modified:** playwright.config.ts
- **Verification:** `npm run test:e2e` — 6/6 testes passando (3 specs × 2 projetos), incluindo
  o teste que segue o redirect até `/login` e o teste que faz login e chega à raiz.
- **Committed in:** f9b1f2f (Tarefa 2)

---

**Total deviations:** 3 auto-fixed (todos Rule 1 — bugs descobertos ao rodar o próprio
código/testes, não faltas de funcionalidade). **Impact on plan:** nenhum desvio de escopo;
os três são correções necessárias para o tracer funcionar de ponta a ponta como o plano exige.

## Issues Encountered

- **A prova em dois sentidos do teste de borda (exigida pela Tarefa 3).** Acrescentei
  temporariamente `import { conferirHash } from "./senha";` a `lib/auth/auth.config.ts`,
  rodei `npx vitest run tests/unit/auth-borda.test.ts` e confirmei que a afirmação
  "nenhum arquivo alcançável a partir de auth.config.ts referencia o pacote nativo de hash
  (argon2)" fica vermelha, com mensagem apontando exatamente `lib/auth/senha.ts` como o
  arquivo culpado e o motivo. Removido o import em seguida; a suíte inteira (13 testes)
  volta a passar. Nenhum vestígio do import proibido ficou no commit.
- **O grep literal `grep -c 'authorize'` da Tarefa 3 sobre `lib/auth/auth.config.ts` retorna
  `1`, não `0` como o texto da tarefa pede — mas isso é esperado e correto, não um defeito.**
  O callback `authorized` do Auth.js (nome exigido pela própria API do framework, não uma
  escolha nossa) contém a substring `"authorize"` dentro de `"authorized"`. Um grep textual
  ingênuo não distingue os dois; por isso `tests/unit/auth-borda.test.ts` — o entregável real
  da tarefa — usa um regex com fronteira de palavra (`authorize(?![a-zA-Z])`) que aceita
  `"authorized("` (o callback legítimo) e rejeita `"authorize("` (a função proibida do
  provedor). O teste automatizado passa com 0 violações reais; só o comando de shell
  copiado literalmente do texto da tarefa produz esse falso positivo.

## User Setup Required

None - nenhuma configuração externa necessária nesta etapa. (O backup e o `RCLONE_REMOTE`
são de um plano posterior desta mesma fase.)

## Next Phase Readiness

- `usuarios`, a divisão de borda do Auth.js e o caminho de login estão prontos para os
  próximos planos da 2a (papel `amassa_app`, limite de tentativas, mensagem única de erro,
  `redefinir-senha`, backup).
- `lib/auth/auth.ts` e `lib/auth/senha.ts` são os pontos de extensão esperados pelo plano 03
  (mensagem única + tempo constante) — a mensagem de erro atual (`"E-mail ou senha
  inválidos."`) é deliberadamente provisória, como o plano 01 determina.
- Sem bloqueios. O padrão de teste de grafo de módulos (`tests/unit/auth-borda.test.ts`) fica
  disponível para qualquer fronteira Edge/Node futura do projeto.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*

## Self-Check: PASSED

Todos os 15 arquivos listados em `key-files` + este SUMMARY confirmados com `[ -f ... ]`, e
os 3 hashes citados (`f9b1f2f`, `7566bf9`, `eca2a0a`) confirmados em `git log --oneline --all`.
