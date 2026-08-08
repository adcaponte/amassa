---
phase: 02a-login-banco-base-e-backup
plan: 06
subsystem: infra
tags: [postgres, drizzle, nextjs, observability, backup]

# Dependency graph
requires:
  - phase: 02a-02
    provides: "npm run test:migracoes (constante TABELAS_ESPERADAS, cliente pg de fora),
      migrações custom idempotentes como padrão"
  - phase: 02a-04
    provides: "lib/auth/rotas-publicas.ts liberando /api/health por prefixo — a rota nova
      herda a liberação sem precisar tocar nesse arquivo"
provides:
  - "Tabela execucoes_backup (id, quando, sucesso, bytes, destino_externo_ok, mensagem) +
    índice descendente sobre quando — deliberadamente sem atualizado_em/trigger, mesma
    exceção de movimentacoes_estoque"
  - "lib/backup/frescor.ts: decidirFrescorDoBackup(), módulo puro, janela de 26 horas,
    sete casos testados incluindo as duas fronteiras"
  - "GET /api/health/backup: rota pública, consulta real, decisão delegada ao módulo puro,
    corpo de resposta minimalista (T-02a-28)"
  - "tests/e2e/apoio/registrar-backup.ts: insere/apaga linha de teste + advisory lock do
    Postgres que serializa backup.spec.ts entre os dois projetos do Playwright"
affects: [02a-07, 02a-08]

# Actuals (#2632)
actuals:
  tokens: 8000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabela só de inserção (sem atualizado_em, sem trigger) como segunda instância da
      exceção que 02-MODELO-DE-DADOS.md §0 abre para movimentacoes_estoque — o script
      testar-migracoes.mjs agora confere essa AUSÊNCIA explicitamente (nenhuma coluna
      atualizado_em, nenhum trigger em pg_trigger), não só a presença do que deveria
      existir"
    - "Advisory lock do Postgres (pg_advisory_lock/unlock) para serializar um spec e2e
      inteiro entre os dois projetos do Playwright quando a tabela mutada não tem chave
      natural de particionamento (diferente de usuarios, particionável por e-mail) —
      alternativa ao padrão 'conta dedicada por projeto' do plano 04 quando não existe
      uma chave para particionar"
    - "index(nome).on(coluna.desc()) do drizzle-orm/pg-core para índice descendente —
      gera CREATE INDEX ... USING btree (coluna DESC NULLS LAST)"

key-files:
  created:
    - lib/backup/frescor.ts
    - tests/unit/frescor.test.ts
    - app/api/health/backup/route.ts
    - tests/e2e/apoio/registrar-backup.ts
    - tests/e2e/backup.spec.ts
    - db/migrations/0004_curved_colossus.sql
  modified:
    - db/schema.ts
    - scripts/testar-migracoes.mjs
    - README.md

key-decisions:
  - "execucoes_backup nasce sem atualizado_em e sem trigger — é a segunda tabela do
    sistema (depois de movimentacoes_estoque, ainda não implementada) na exceção 'só
    inserção' de 02-MODELO-DE-DADOS.md §0. Deixado em comentário no schema para o
    checklist de tabela nova não parecer descumprido em revisão futura."
  - "decidirFrescorDoBackup() checa o relógio no futuro (quando > agora) ANTES de checar
    sucesso/destino_externo_ok — um timestamp inconsistente deveria invalidar a leitura
    inteira, não só disparar um dos outros dois motivos por acaso."
  - "/api/health/backup nunca expõe bytes no corpo da resposta (só status/motivo/instante/
    idade) — T-02a-28 do threat_model do plano: o tamanho absoluto do dump revelaria o
    volume de dados do ateliê a qualquer pessoa na internet, já que a rota é pública."
  - "tests/e2e/apoio/registrar-backup.ts usa um advisory lock do Postgres
    (pg_advisory_lock/unlock, chave fixa 726623) para serializar a execução de todo o
    backup.spec.ts entre os dois projetos do Playwright — execucoes_backup não tem uma
    chave natural de particionamento como usuarios tem por e-mail (ver Deviations)."

patterns-established:
  - "Tabela só de inserção: comentário explícito no schema + conferência NEGATIVA no
    script de migração (nenhum atualizado_em, nenhum trigger) — reutilizável quando
    movimentacoes_estoque for implementada"
  - "Advisory lock do Postgres para serializar specs e2e entre projetos do Playwright
    quando a tabela mutada não tem chave de particionamento"

requirements-completed: [BKP-04]

coverage:
  - id: D1
    description: "A tabela execucoes_backup existe com quando, sucesso, bytes e destino_externo_ok, sem atualizado_em nem trigger, com índice sobre quando"
    requirement: "BKP-04"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — conferirTabelaExecucoesBackup() em scripts/testar-migracoes.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A decisão de frescor do backup é um módulo puro com a janela de 26 horas testada nas duas fronteiras (25h59 aprova, 26h01 reprova)"
    requirement: "BKP-04"
    verification:
      - kind: unit
        ref: "tests/unit/frescor.test.ts — nove casos, incluindo os sete do PLAN.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "/api/health/backup responde ok com backup fresco e 503 com tabela vazia, backup velho, falha registrada ou cópia externa ausente; responde sem sessão"
    requirement: "BKP-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/backup.spec.ts — cinco casos × 2 projetos (desktop, celular) = 10 execuções"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 06: O Vigia do Backup — `execucoes_backup`, Frescor Puro e `/api/health/backup` Summary

**Tabela `execucoes_backup` só de inserção, `lib/backup/frescor.ts` decidindo a janela de 26
horas com nove testes (as duas fronteiras incluídas), e `GET /api/health/backup` — a rota
pública que um monitor externo consulta a cada cinco minutos, provada nos dois sentidos por
cinco casos × 2 projetos do Playwright.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (a Tarefa 2 com `tdd="true"`: RED → GREEN em commits separados)
- **Files modified:** 11 (6 novos, 5 modificados/gerados)

## Accomplishments

- `db/schema.ts` ganhou `execucoesBackup`: `id`, `quando` (timestamptz, instante da
  execução, nunca `hoje_brasilia()`), `sucesso`, `bytes` (bigint, aceita nulo), 
  `destino_externo_ok` (padrão `false`, pessimista de propósito) e `mensagem`, com um
  índice descendente sobre `quando` — a única consulta que a tabela recebe. Deliberadamente
  sem `atualizado_em` nem trigger, a mesma exceção de `movimentacoes_estoque` em
  `02-MODELO-DE-DADOS.md` §0; `scripts/testar-migracoes.mjs` agora confere essa AUSÊNCIA
  explicitamente (nenhuma coluna, nenhum trigger em `pg_trigger`), não só a presença do que
  deveria existir.
- `lib/backup/frescor.ts` exporta `JANELA_EM_HORAS` (26) e `decidirFrescorDoBackup()` — zero
  imports, nunca lê o relógio por dentro (o instante entra como argumento). Nove testes: os
  sete casos do plano (sem registro, dentro/fora da janela nas duas fronteiras — 25h59 e
  26h01 —, execução com `sucesso=false`, cópia externa não confirmada, relógio no futuro)
  mais dois auxiliares (constante da janela, motivo nunca menciona "503" como texto). Segue
  RED → GREEN: o teste foi escrito e rodado falho antes de qualquer linha de implementação.
- `GET /api/health/backup` faz uma consulta real (última linha por `quando` decrescente) e
  delega toda a decisão ao módulo puro. O corpo da resposta só traz
  `status`/`motivo`/`ultimoBackupEm`/`idadeEmHoras` — nunca `bytes`, caminho de arquivo ou
  nome de destino externo (T-02a-28: a rota é pública, e o volume de dados do ateliê não
  pode vazar). Se a própria consulta falhar, responde 503 com um motivo genérico —
  indistinguível de "sem backup" para o monitor, que é o comportamento certo.
- `tests/e2e/backup.spec.ts` prova a rota nos dois sentidos, em `desktop` e `celular`: tabela
  vazia reprova (503), backup de 2h com sucesso e cópia externa aprova (200 `ok`), backup de
  27h reprova citando a idade, backup recente sem cópia externa reprova, e um contexto
  totalmente novo (sem cookie nenhum) recebe resposta normal — a rota é pública de verdade.
  Rodado 10 vezes (5 casos × 2 projetos) em quatro execuções completas da suíte, sempre
  verde.
- `README.md` ganhou a seção "Observabilidade", documentando `/api/health` e
  `/api/health/backup` lado a lado, com o que cada uma garante.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: A tabela `execucoes_backup`** — `b8152f5` (feat)
2. **Tarefa 2: `lib/backup/frescor.ts` — a janela de 26 horas como decisão pura**
   - RED: `effbb19` (test) — teste falho, confirmado antes de qualquer implementação
   - GREEN: `d4e1518` (feat)
3. **Tarefa 3: `/api/health/backup` e a prova nos dois sentidos** — `fd45969` (feat)

**Plan metadata:** commit final deste SUMMARY, a seguir.

## Files Created/Modified

- `db/schema.ts` — tabela `execucoesBackup` (id/quando/sucesso/bytes/destino_externo_ok/
  mensagem) + índice `execucoes_backup_quando_idx`
- `db/migrations/0004_curved_colossus.sql`, `db/migrations/meta/0004_snapshot.json`,
  `db/migrations/meta/_journal.json` — gerados por `npm run db:generate`
- `scripts/testar-migracoes.mjs` — `TABELAS_ESPERADAS` inclui `execucoes_backup`;
  `conferirTabelaExecucoesBackup()` prova colunas, ausência de `atualizado_em`/trigger, o
  índice e o padrão pessimista de `destino_externo_ok`
- `lib/backup/frescor.ts` (novo) — `JANELA_EM_HORAS`, `decidirFrescorDoBackup()`
- `tests/unit/frescor.test.ts` (novo) — nove casos
- `app/api/health/backup/route.ts` (novo) — `GET`, runtime nó, `force-dynamic`
- `tests/e2e/apoio/registrar-backup.ts` (novo) — `registrarBackup`/`removerBackup`/
  `limparTodasAsExecucoesDeBackup` + `travarExecucoesBackupParaTeste`/
  `destravarExecucoesBackupDeTeste` (advisory lock)
- `tests/e2e/backup.spec.ts` (novo) — cinco casos, modo serial, nos dois projetos
- `README.md` — seção "Observabilidade" com as duas rotas `/api/health*`

## Decisions Made

- **`execucoes_backup` sem `atualizado_em`/trigger.** Segunda tabela do sistema (depois de
  `movimentacoes_estoque`, ainda não implementada) na exceção "só inserção" de
  `02-MODELO-DE-DADOS.md` §0. Comentário explícito no schema para o checklist de tabela nova
  não parecer descumprido numa revisão futura que não tenha este contexto.
- **A checagem de relógio no futuro vem antes das checagens de sucesso/cópia externa** em
  `decidirFrescorDoBackup()`. Um `quando` inconsistente invalida a leitura inteira; não faz
  sentido reportar "cópia externa ausente" quando o próprio instante não é confiável.
- **`/api/health/backup` nunca expõe `bytes`.** O corpo da resposta pública traz só
  status/motivo/instante/idade — o tamanho absoluto do dump revelaria o volume de dados do
  ateliê para qualquer pessoa na internet (T-02a-28 do `threat_model` do plano).
- **Advisory lock do Postgres em `tests/e2e/apoio/registrar-backup.ts`** para serializar
  `backup.spec.ts` entre os dois projetos do Playwright. `execucoes_backup` não tem uma
  chave natural de particionamento como `usuarios` tem por e-mail (o padrão usado em
  `sessao.spec.ts`, plano 04) — o endpoint sempre lê a última linha da tabela INTEIRA, então
  não existe uma linha "própria de cada projeto" para isolar. Ver Deviations abaixo para o
  raciocínio completo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `backup.spec.ts` precisava de exclusão mútua entre os dois
projetos do Playwright, não só de modo serial dentro de um projeto**
- **Found during:** Tarefa 3, ao desenhar `tests/e2e/apoio/registrar-backup.ts` a partir do
  padrão de `alternar-ativo.ts`/`sessao.spec.ts` (plano 04)
- **Issue:** O padrão estabelecido no plano 04 (`test.describe.configure({ mode: "serial" })`
  + uma conta e-mail exclusiva por projeto) resolve colisão porque `usuarios` tem uma chave
  natural de particionamento (e-mail). `execucoes_backup` não tem: `/api/health/backup`
  sempre lê a ÚLTIMA linha da tabela inteira, então os dois projetos (`desktop` e `celular`),
  rodando esta spec em paralelo entre si (mesmo com `mode: "serial"` dentro de cada um),
  poderiam interferir um no outro — um projeto inserindo uma linha durante o caso "tabela
  vazia" do outro quebraria a asserção sem ser um bug real da aplicação. Sem correção, este
  teria sido o mesmo tipo de falha capturada em `sessao.spec.ts` (deviation 3 do
  `02a-04-SUMMARY.md`), mas descoberto na hora de projetar, não rodando o teste quebrado.
- **Fix:** `registrar-backup.ts` ganhou `travarExecucoesBackupParaTeste()`/
  `destravarExecucoesBackupDeTeste()`, um advisory lock do Postgres
  (`pg_advisory_lock`/`pg_advisory_unlock`, chave fixa `726623`) acionado em
  `test.beforeAll`/`test.afterAll` de `backup.spec.ts` — serializa a execução do arquivo
  inteiro entre os dois projetos (o segundo espera o primeiro terminar), ao custo de rodar
  em série em vez de paralelo, aceitável para cinco casos rápidos contra uma tabela de uma
  linha.
- **Files modified:** tests/e2e/apoio/registrar-backup.ts, tests/e2e/backup.spec.ts
- **Verification:** `npm run test:e2e` rodado quatro vezes completas — os 10 casos de
  `backup.spec.ts` (5 × 2 projetos) passaram em todas as quatro execuções, sem nenhuma
  interferência entre projetos.
- **Committed in:** `fd45969` (Tarefa 3)

---

**Total deviations:** 1 auto-fixed (Rule 2 — funcionalidade crítica ausente: sem exclusão
mútua, a suíte teria uma janela de corrida real entre os dois projetos do Playwright).
**Impact on plan:** nenhum desvio de escopo funcional; a tabela e a rota seguem exatamente o
que o `PLAN.md` especifica. O advisory lock é infraestrutura de teste, não código de
aplicação.

## Issues Encountered

- **`npm run test:e2e` completo falhou de forma intermitente em `tests/e2e/autenticacao.spec.ts`
  ("a sexta tentativa..."), alternando entre os projetos `desktop` e `celular` em três das
  quatro execuções completas rodadas durante esta tarefa.** Esta é a mesma flakiness já
  documentada em `02a-03-SUMMARY.md` (deviation 3 daquele plano): seis idas e voltas reais com
  hash `argon2id` sob a carga cheia da suíte inteira competem por CPU e estouram o timeout de
  60s já estendido — não é uma trava de lógica, é contenção de recursos desta máquina. Nenhum
  arquivo tocado por este plano (`06`) tem relação com `lib/auth/tentativas-memoria.ts` ou
  `autenticacao.spec.ts`; está fora de `files_modified` do `02a-06-PLAN.md` e é anterior a
  esta execução (fora de escopo pela regra de fronteira de escopo do executor). Confirmado por
  isolamento: os 10 casos de `backup.spec.ts` (a entrega desta tarefa) passaram nas quatro
  vezes, incluindo uma execução com `--retries=1` explícito onde o próprio retry falhou por um
  motivo diferente e mais revelador — a conta de e-mail do teste de bloqueio já estava
  bloqueada pelo contador em memória do servidor (`lib/auth/tentativas-memoria.ts`), efeito
  colateral do timeout anterior, não um bug novo.
- **`git diff` do `_journal.json`** foi gerado limpo desta vez (só a entrada `idx: 4`
  acrescentada por uma única chamada de `npm run db:generate`) — não repetiu o problema de
  edição manual encontrado no plano 02.

## User Setup Required

None — nenhuma configuração externa necessária nesta etapa. O script `backup.sh` que grava
linhas em `execucoes_backup` é o próximo plano (roteiro de servidor); esta tarefa só constrói
onde ele escreve e quem lê o resultado.

## Next Phase Readiness

- `execucoes_backup`, `lib/backup/frescor.ts` e `GET /api/health/backup` estão prontos para o
  script `backup.sh` (próximo plano) escrever nesta tabela ao final de cada execução —
  `quando`/`sucesso`/`bytes`/`destino_externo_ok`/`mensagem` já são exatamente as colunas que
  `01-ARQUITETURA.md` §9 especifica.
- `scripts/testar-migracoes.mjs` continua disponível como o mecanismo de verificação de banco
  de qualquer fase futura — a constante `TABELAS_ESPERADAS` agora tem três nomes e nenhum
  comentário apontando um próximo plano específico (o próximo a mexer aqui é quem quer que
  acrescente a primeira tabela de produto, na Fase 3 em diante).
- O padrão de advisory lock para serializar specs e2e entre projetos do Playwright, quando a
  tabela mutada não tem chave natural de particionamento, fica disponível para qualquer spec
  futura no mesmo formato (ex.: futuras tabelas operacionais sem coluna de autoria).
- Sem bloqueios de escopo. A flakiness pré-existente de `autenticacao.spec.ts` (Issues
  Encountered acima) permanece um risco conhecido e documentado, não deste plano — se voltar
  a incomodar, é candidata a um ajuste dedicado no roteiro do próprio `02a-03`/`02a-04`, não
  aqui.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*

## Self-Check: PASSED

Todos os 9 arquivos de `key-files` (6 novos + `db/schema.ts`, `scripts/testar-migracoes.mjs`
e `README.md` modificados) confirmados com `[ -f ... ]`, e os 4 hashes citados (`b8152f5`,
`effbb19`, `d4e1518`, `fd45969`) confirmados em `git log --oneline --all`.
