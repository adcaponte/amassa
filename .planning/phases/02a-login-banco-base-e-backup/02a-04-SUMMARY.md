---
phase: 02a-login-banco-base-e-backup
plan: 04
subsystem: auth
tags: [next-auth, drizzle, playwright, vitest, session-lifecycle]

# Dependency graph
requires:
  - phase: 02a-01
    provides: "Auth.js v5 dividido em auth.config.ts/auth.ts, tabela usuarios, tela de login
      provisória, middleware.ts, e o globalSetup do Playwright
      (tests/e2e/apoio/preparar-usuario.ts) que cria a conta de teste rodando
      scripts/criar-usuario.ts de verdade"
  - phase: 02a-03
    provides: "lib/auth/acoes.ts (movido de app/(auth)/login/acoes.ts) já distinguindo
      ErroBloqueado de credenciais inválidas; tests/e2e/autenticacao.spec.ts como o padrão
      de spec serial contra a mesma conta global de teste"
provides:
  - "lib/auth/exigir-usuario.ts: avaliarAutorizacao() pura (usuário ativo/inativo/ausente,
    nunca devolve senhaHash) + exigirUsuario() casca — a única porta de autorização do
    sistema, confere `ativo` NO BANCO a cada chamada (nunca no token, que dura 30 dias)"
  - "lib/auth/acoes.ts ganha sair(): encerra a sessão pelo Auth.js, não toca o banco"
  - "lib/auth/auth.config.ts declara explicitamente maxAge (30 dias), updateAge (renovação
    diária) e as três propriedades do cookie de sessão (httpOnly/secure/sameSite=lax)"
  - "middleware.ts envolve o auth() do Auth.js para acrescentar Cache-Control: no-store só
    nas respostas de rota protegida — desabilita o bfcache do navegador para essas páginas"
  - "app/(app)/page.tsx chama exigirUsuario() na primeira linha (o padrão para toda página
    protegida futura) e tem o primeiro botão de sair real do sistema"
  - "tests/e2e/apoio/alternar-ativo.ts: auxiliar de teste que liga/desliga `ativo` por
    e-mail direto no banco (pg), sempre UPDATE, nunca DELETE"
  - "tests/e2e/sessao.spec.ts: quatro provas de ciclo de vida de sessão, nos dois projetos"
affects: [02a-05, 02a-06, 02a-07, 02a-08, 02b-design-system-e-casca]

# Actuals (#2632)
actuals:
  tokens: 6100
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "exigirUsuario() importa lib/auth/auth.ts de forma DINÂMICA (await import(...)) dentro
      do próprio corpo da função, não no topo do arquivo — é o que mantém
      avaliarAutorizacao() (a função pura) testável no Vitest sem herdar a resolução de
      next/server que next-auth exige do bundler do próprio Next.js e que quebra fora dele"
    - "vitest.config.ts ganhou resolve.alias para '@/' (espelhando tsconfig.json) — qualquer
      módulo testado que importe por @/ (o padrão do resto do app) precisa dele"
    - "Cache-Control: no-store nas respostas de rota protegida desabilita o bfcache do
      Chrome para essas páginas — é o mecanismo real por trás de 'o botão de voltar não
      deve devolver a tela depois da saída' (AUTH-06), não uma metáfora"
    - "Testes e2e que MUTAM um dado compartilhado (aqui, ativo de um usuário) usam uma conta
      dedicada criada na hora, exclusiva por projeto Playwright — reaproveitar a conta
      global de login só é seguro para leitura, nunca para mutação (ver Deviations)"

key-files:
  created:
    - lib/auth/exigir-usuario.ts
    - tests/unit/exigir-usuario.test.ts
    - tests/e2e/apoio/alternar-ativo.ts
    - tests/e2e/sessao.spec.ts
  modified:
    - lib/auth/auth.config.ts
    - middleware.ts
    - lib/auth/acoes.ts
    - "app/(app)/page.tsx"
    - "app/(auth)/login/page.tsx"
    - vitest.config.ts

key-decisions:
  - "exigirUsuario() localiza o usuário pelo e-mail da sessão (índice funcional
    lower(email), o mesmo do login), não por um `id` no token — o callback `session`
    padrão do Auth.js remove `id` do objeto de sessão por padrão, e adicioná-lo de volta
    exigiria um callback customizado + module augmentation de tipos só para isso. E-mail já
    é único e já é o identificador que o login usa; usar o mesmo aqui evita uma segunda
    forma de identidade"
  - "cookies.sessionToken.options.secure = true é estático (não dinâmico por protocolo) em
    lib/auth/auth.config.ts — funciona em desenvolvimento/teste local via http://localhost
    porque o Chrome trata 'localhost' como contexto seguro (aceita cookies Secure mesmo sem
    TLS), a mesma razão pela qual playwright.config.ts já usava 'localhost' em vez de
    '127.0.0.1' desde o plano 01"
  - "middleware.ts NÃO usa o padrão `auth((req) => {...})` de wrapping (que troca o auth.js
    a decidir o redirect padrão por deixar isso 100% a cargo do handler customizado,
    conforme o código-fonte de next-auth/lib/index.js) — em vez disso, chama `auth(req, ev)`
    diretamente e só pós-processa a Response resultante, preservando o redirect automático
    de authorized:false que já existia"

patterns-established:
  - "Import dinâmico dentro do corpo de uma função server-only para manter a parte pura do
    mesmo arquivo testável no Vitest sem herdar dependências problemáticas de resolução
    (next-auth → next/server) — reutilizável para qualquer módulo futuro que precise
    misturar lógica pura com uma casca que toca next-auth/next/navigation"

requirements-completed: [AUTH-05, AUTH-06]

coverage:
  - id: D1
    description: "A sessão persiste por 30 dias ao fechar e reabrir o navegador"
    requirement: "AUTH-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#o cookie de sessao e persistente e vale cerca de 30 dias"
        status: pass
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#um contexto novo com o estado salvo abre a raiz sem novo login"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sair encerra a sessão de verdade — voltar no histórico não devolve o acesso"
    requirement: "AUTH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#depois de sair o botao de voltar cai em /login"
        status: pass
    human_judgment: false
  - id: D3
    description: "Desativar um usuário (ativo = false) tira o acesso dele sem apagar o histórico de autoria"
    requirement: "AUTH-09"
    verification:
      - kind: unit
        ref: "tests/unit/exigir-usuario.test.ts#usuário inativo é recusado"
        status: pass
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#conta desativada perde o acesso na requisicao seguinte e a linha continua no banco"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 04: Ciclo de Vida da Sessão e a Única Porta de Autorização Summary

**Sessão de 30 dias renovada a cada uso, cabeçalho Cache-Control: no-store que desabilita o
bfcache do navegador em rota protegida, `exigirUsuario()` como a única porta de
autorização (conferindo `ativo` no banco a cada chamada, nunca no token), e a saída que
encerra a sessão de verdade — as três provadas por 4 testes e2e nos dois projetos.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-08-08T02:44:00Z (aproximado, primeiro `npx vitest run` da Tarefa 1)
- **Completed:** 2026-08-08T03:22:00Z (aproximado)
- **Tasks:** 3 (todas `type="auto"`)
- **Files modified:** 10 (4 novos, 6 modificados)

## Accomplishments

- `lib/auth/auth.config.ts` agora declara `maxAge`/`updateAge` como expressões legíveis
  (30 dias, renovação diária) em vez de números soltos, e as três propriedades do cookie de
  sessão (`httpOnly`, `secure`, `sameSite: "lax"`) explicitamente — o padrão de hoje da
  biblioteca, escrito para não depender de uma atualização silenciosa.
- `middleware.ts` envolve o `auth()` do Auth.js para acrescentar
  `Cache-Control: no-store, must-revalidate` só nas respostas de rota protegida, preservando
  o comportamento de redirect padrão do `authorized` callback (sem usar o padrão de wrapping
  `auth((req) => ...)`, que teria desligado esse redirect automático — confirmado lendo o
  código-fonte de `next-auth/lib/index.js`).
- `lib/auth/exigir-usuario.ts` é a única porta de autorização: `avaliarAutorizacao()` pura
  (testada com 4 casos: ativo devolvido, inativo recusado, ausente recusado, hash nunca no
  objeto devolvido) + `exigirUsuario()` casca, que confere `ativo` **no banco**, a cada
  chamada — nunca no token, que dura 30 dias.
- `app/(app)/page.tsx` chama `exigirUsuario()` na primeira linha e ganhou o primeiro botão
  de sair real do sistema (HTML puro, sem shadcn, alvo de toque ≥44px).
- `tests/e2e/sessao.spec.ts` prova, pela tela, nos dois projetos (desktop e celular): o
  cookie de sessão tem data de expiração perto de 30 dias E as três propriedades
  declaradas; um contexto novo com o estado salvo abre a raiz sem novo login (a tradução
  fiel de "fechar e reabrir o navegador"); sair e depois voltar no histórico cai em
  `/login` sem mostrar o nome de quem tinha entrado; e desativar uma conta tira o acesso na
  requisição seguinte enquanto a linha continua no banco (prova em par de AUTH-09).

## Task Commits

1. **Tarefa 1: Sessão de 30 dias renovada a cada uso, e rota protegida que não fica em cache**
   - `182227f` (feat)
2. **Tarefa 2: `exigirUsuario()` — a única porta — e a saída que encerra de verdade**
   - `383b4d3` (feat)
3. **Tarefa 3: Provar os 30 dias, a saída e a desativação — pela tela, nos dois projetos**
   - `0da52aa` (test)

**Plan metadata:** commit final deste SUMMARY, a seguir.

## Files Created/Modified

- `lib/auth/auth.config.ts` - `maxAge`/`updateAge` nomeados, `cookies.sessionToken.options`
  explícito (httpOnly/secure/sameSite=lax)
- `middleware.ts` - envolve `auth()` para acrescentar `Cache-Control: no-store` só em rota
  protegida
- `lib/auth/exigir-usuario.ts` (novo) - `avaliarAutorizacao()` pura + `exigirUsuario()`
  casca (import dinâmico de `lib/auth/auth.ts` dentro da função)
- `lib/auth/acoes.ts` - ação `sair()` (encerra a sessão, não toca o banco)
- `app/(app)/page.tsx` - chama `exigirUsuario()` na primeira linha, mostra o nome real e o
  botão de sair
- `app/(auth)/login/page.tsx` - mensagem única para `?sessao=encerrada` (sessão vencida OU
  conta desativada — mesma frase, T-02a-21)
- `vitest.config.ts` - `resolve.alias` para `@/` (necessário para testar qualquer módulo que
  importe pelo alias do resto do app)
- `tests/unit/exigir-usuario.test.ts` (novo) - 4 testes da função pura
- `tests/e2e/apoio/alternar-ativo.ts` (novo) - `alternarAtivo()` + `usuarioExiste()`, via `pg`
- `tests/e2e/sessao.spec.ts` (novo) - 4 casos × 2 projetos = 8 execuções, modo serial

## Decisions Made

- **`exigirUsuario()` busca o usuário pelo e-mail da sessão, não por um `id` de token.** O
  callback `session` padrão do Auth.js remove `id` do objeto de sessão (só devolve
  `name`/`email`/`image`); devolvê-lo exigiria um callback customizado em
  `lib/auth/auth.config.ts` mais module augmentation de tipos, só para esse fim. O e-mail já
  é único (índice funcional `lower(email)`) e já é o identificador que o próprio login usa
  em `lib/auth/auth.ts` — reutilizar a mesma chave evita uma segunda forma de identidade no
  sistema.
- **`secure: true` estático no cookie de sessão funciona em `http://localhost` porque o
  Chrome trata `localhost` como contexto seguro** (aceita cookies `Secure` mesmo sem TLS) —
  a mesma razão pela qual `playwright.config.ts` já usava `baseURL: "http://localhost:3000"`
  desde o plano 01. Confirmado empiricamente: os 22 testes e2e passam, incluindo a leitura
  do próprio atributo `secure` do cookie via `context.cookies()`.
- Ver também `key-decisions` no frontmatter (o porquê de `middleware.ts` não usar o padrão
  de wrapping `auth((req) => ...)`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vitest.config.ts` não resolvia imports `@/...`**
- **Found during:** Tarefa 2, primeira execução de `npx vitest run tests/unit/exigir-usuario.test.ts`
- **Issue:** `vitest.config.ts` não tinha nenhum alias configurado; o Vitest não lê
  `paths` de `tsconfig.json` sozinho. Qualquer módulo testado que importasse por `@/`
  (o padrão de todo o resto do app) falhava com "Cannot find package '@/...'".
- **Fix:** Acrescentado `resolve.alias` em `vitest.config.ts`, mapeando `@` para a raiz do
  projeto — o mesmo mapeamento de `tsconfig.json`.
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run` — 6 arquivos, 48 testes, todos verdes.
- **Committed in:** `383b4d3` (Tarefa 2)

**2. [Rule 3 - Blocking] Importar `lib/auth/auth.ts` estaticamente quebrava QUALQUER teste que tocasse `exigir-usuario.ts`**
- **Found during:** Tarefa 2, depois do fix acima, `npx vitest run tests/unit/exigir-usuario.test.ts`
- **Issue:** Com o alias resolvido, o Vitest chegava a importar `lib/auth/auth.ts` (via
  `exigir-usuario.ts`), que importa o pacote `next-auth`. `next-auth/lib/env.js` faz
  `import { NextResponse } from "next/server"` sem extensão — resolução que só o bundler do
  próprio Next.js faz (confirmado que falha até em `node --experimental-strip-types -e`
  puro, fora de qualquer contexto Next.js). Isso quebraria a testabilidade da função pura
  `avaliarAutorizacao()`, mesmo sem `exigirUsuario()` (a casca) nunca ser chamada.
- **Fix:** `auth.ts` passou a ser importado de forma DINÂMICA (`await import("@/lib/auth/auth")`)
  dentro do corpo de `exigirUsuario()`, não no topo do arquivo. `exigirUsuario()` só roda de
  verdade dentro do Next.js (nunca do Vitest), então o custo do import dinâmico é
  irrelevante em produção.
- **Files modified:** lib/auth/exigir-usuario.ts
- **Verification:** `npx vitest run tests/unit/exigir-usuario.test.ts` (4/4) e `npm run build`
  (rota `/` compila e roda) confirmados depois da mudança.
- **Committed in:** `383b4d3` (Tarefa 2)

**3. [Rule 1 - Bug] O caso de desativação, reaproveitando a conta global, colidia entre os dois projetos do Playwright**
- **Found during:** Tarefa 3, primeira execução completa de `npm run test:e2e`
- **Issue:** A primeira versão de `tests/e2e/sessao.spec.ts` seguia o texto do plano ao pé
  da letra: reaproveitava a conta global de `preparar-usuario.ts` no caso 4 e só "religava"
  `ativo` no `finally`. Rodando de verdade, o projeto `desktop` desativava essa conta
  exatamente no instante em que o projeto `celular` tentava logar com ela em OUTRO teste
  deste mesmo arquivo — `test.describe.configure({ mode: "serial" })` só serializa DENTRO de
  um projeto; os dois projetos rodam em paralelo entre si. Falha real observada:
  `erro=credenciais` num teste que deveria ter passado.
- **Fix:** O caso de desativação passou a rodar contra uma conta PRÓPRIA, criada na hora
  (mesmo `scripts/criar-usuario.ts` que o `globalSetup` usa), com e-mail exclusivo por
  projeto (`desativavel.${testInfo.project.name}@exemplo.test`) — elimina a colisão na raiz
  em vez de só apertar a janela de risco.
- **Files modified:** tests/e2e/sessao.spec.ts
- **Verification:** `npm run test:e2e` rodado de novo, do zero (banco de teste recriado) —
  22/22 testes passando (11 specs × 2 projetos), incluindo os 4 novos casos × 2 projetos.
- **Committed in:** `0da52aa` (Tarefa 3)

---

**Total deviations:** 3 auto-fixed (2 Rule 3 — bloqueios de ferramental descobertos rodando
os próprios comandos de verificação do plano; 1 Rule 1 — bug de teste real, capturado com o
`npm run test:e2e` completo, não só o arquivo novo isolado). **Impact on plan:** nenhum
desvio de escopo funcional; as três são correções necessárias para o `<verify>` de cada
tarefa passar de forma confiável, como o plano exige. Nenhum arquivo fora da lista
`files_modified` do plano foi tocado, exceto `vitest.config.ts` (ferramental de teste, não
código de aplicação).

## Issues Encountered

- **A resolução de `next/server` sem extensão fora do bundler do Next.js é um problema de
  ecossistema, não específico deste projeto.** Confirmado com `node -e` puro (sem Vite/Vitest
  no meio) que `import("next/server")` e `import("next/navigation")` falham da mesma forma
  fora do Next.js — mas `import("next/navigation")` funciona normalmente sob o resolvedor do
  próprio Vite/Vitest (testado isoladamente antes de decidir manter `redirect` como import
  estático). Só o caminho `next-auth → next/server` especificamente quebra sob Vitest; por
  isso o import dinâmico ficou limitado a `lib/auth/auth.ts`, não a `next/navigation`.
- **A colisão entre projetos do Playwright (deviation 3) só apareceu na execução completa
  (`npm run test:e2e`), nunca isolando o arquivo novo com `--grep`.** Reforça o padrão já
  registrado no SUMMARY do plano 03: bugs de contenção/concorrência em e2e só aparecem sob a
  carga real da suíte inteira.

## User Setup Required

None - nenhuma configuração externa necessária nesta etapa.

## Next Phase Readiness

- `exigirUsuario()` está pronto para ser a porta obrigatória de toda Server Action futura
  (regra de `.claude/CLAUDE.md`); o comentário no módulo já avisa que o plano 05 transforma
  essa regra num portão de máquina, não só de convenção.
- O padrão de import dinâmico para manter lógica pura testável (deviation 2) fica disponível
  para qualquer módulo futuro que precise misturar avaliação pura com uma casca que toque
  `next-auth`/`next/navigation`.
- O padrão "conta e2e dedicada para testes que MUTAM estado compartilhado" (deviation 3)
  fica registrado para qualquer spec futura que precise desligar/ligar algo no banco de
  teste — reaproveitar a conta global só é seguro para leitura.
- Sem bloqueios. AUTH-05, AUTH-06 e a parte de aplicação de AUTH-09 (a parte de schema já
  estava coberta desde o plano 01) estão completos e provados por e2e nos dois projetos.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*

## Self-Check: PASSED

Todos os 6 arquivos de `key-files` (4 novos + `vitest.config.ts` modificado, mais os já
existentes editados) confirmados com `[ -f ... ]`, e os 3 hashes citados (`182227f`,
`383b4d3`, `0da52aa`) confirmados em `git log --oneline --all`.
