---
phase: 04-contador-de-queima
plan: 07
subsystem: fullstack
tags: [playwright, e2e, ci, postgres, drizzle, docker]

# Dependency graph
requires:
  - phase: 04-01
    provides: "db/migrations/0007_queimas.sql, 0008_gatilhos-queimas.sql (geradas, aplicadas em teste desde então)"
  - phase: 04-02
    provides: "tests/e2e/queimas-cartao.spec.ts"
  - phase: 04-03
    provides: "tests/e2e/queimas-detalhe.spec.ts"
  - phase: 04-04
    provides: "tests/e2e/queimas-manutencao.spec.ts, o filtro Ativos/Desativados/Todos"
  - phase: 04-05
    provides: "tests/e2e/queimas-banner.spec.ts, lista-fornos.tsx com filtro padrão 'ativos'"
  - phase: 04-06
    provides: "tests/e2e/queimas-relatorios.spec.ts"
provides:
  - "as migrações 0007_queimas/0008_gatilhos-queimas aplicadas em produção, verificadas no banco (tabelas, enum, os três gatilhos em pg_trigger, atualizado_em provado por edição real)"
  - "docs/operacao/05-migracao-queimas.md — Roteiro 5, reaproveitável em qualquer migração futura de Fornos"
  - "quatro regressões de fim de fase corrigidas na própria varredura que as achou (casca.spec.ts, queimas-manutencao.spec.ts, queimas-banner.spec.ts, queimas-relatorios.spec.ts) mais duas causas raiz de falha real de CI (autenticacao.spec.ts, queimas-manutencao.spec.ts de novo, achado diferente)"
  - ".planning/phases/04-contador-de-queima/04-VERIFICACAO-HUMANA.md — produzido, todo item em aberto, pronto para o dono percorrer"
affects: []

# Actuals (#2632)
actuals:
  tokens: 12300
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "teste que precisa de posição relativa num agregado truncado (banner top-3) entra na cadeia vazio-* — a mesma etiqueta que já resolvia 'banco vazio' também resolve 'condição global disputada por escritas concorrentes' quando a disputa é sobre RANKING, não sobre zero"
    - "sincronização de e2e por VALOR QUE MUDA, nunca por valor que se repete — quando o estado pós-ação é idêntico ao pré-ação (0/50 → 0/50), nenhuma asserção de conteúdo prova que o router.refresh() chegou; page.reload() força uma busca nova de verdade em vez de alargar timeout"
    - "e-mail de teste com contador server-side (rate limit) precisa ser único por retentativa (testInfo.retry), não só por projeto — sem isso, retries: N garante a falha em vez de resgatar o teste"
    - "diagnóstico de flake local deve rodar com --workers=2 (a concorrência real de CI), não no worker count default da máquina — um desktop de 16 núcleos usa ~8 workers por padrão, um ambiente MUITO mais hostil que os 2 workers reais do runner, o que produz falso-negativo (parece bug quando é só contenção local)"

key-files:
  created:
    - docs/operacao/05-migracao-queimas.md
    - .planning/phases/04-contador-de-queima/04-VERIFICACAO-HUMANA.md
  modified:
    - tests/e2e/casca.spec.ts
    - tests/e2e/queimas-banner.spec.ts
    - tests/e2e/queimas-manutencao.spec.ts
    - tests/e2e/queimas-relatorios.spec.ts
    - tests/e2e/autenticacao.spec.ts
    - docs/operacao/04-migracao-encomendas.md

key-decisions:
  - "COVERAGE.md já existia, escrito durante o planejamento da fase — nenhuma mudança necessária; a declaração de ausência de integração com API externa já estava correta"
  - "Roteiro de migração escrito em docs/operacao/05-migracao-queimas.md (o roteiro de servidor que a Fase 3 já usa), não em amassa-plataforma/05-GUIA-THEO.md — o próprio 04-07-PLAN.md permite essa substituição, e GUIA-THEO.md nunca referenciou roteiros individuais"
  - "queimas-banner.spec.ts: os dois casos que afirmam o NOME do forno no texto do banner (não só a existência do banner) entraram na cadeia @vazio-historico — o banner só mostra os 3 primeiros por ordenarParaBanner, e sob a suíte inteira outros arquivos levam vários fornos a crítico/atenção ao mesmo tempo, empurrando o forno do teste para fora dos 3 primeiros. Mesma classe de 'condição global disputada por escritas concorrentes' que a cadeia já existe para resolver, mesmo não sendo uma condição de ZERO"
  - "queimas-relatorios.spec.ts: os tetos dos deltas de total/biscoito viraram pisos (nunca tetos) — a premissa original ('um único escritor concorrente conhecido') só valia sob --grep isolado; sob a suíte inteira, TODOS os arquivos de Fornos escrevem biscoito em paralelo"
  - "autenticacao.spec.ts: e-mail de bloqueio ganhou testInfo.retry no sufixo — sem isso uma retentativa reaproveita um contador de tentativas já esgotado e falha instantaneamente, o que geraria falso-negativo de CI mesmo com o código de produção correto"
  - "queimas-manutencao.spec.ts: page.reload() entre a segunda chamada de registrarManutencao e as asserções seguintes — o contador fica em '0 / 50' antes e depois da segunda manutenção (idempotência do edge probe), então checar esse texto de novo não prova que o router.refresh() chegou; confirmado por execução isolada (sem o bug) e por --workers=2 (verde)"
  - "docs/operacao/04-migracao-encomendas.md também corrigido (curl.exe → curl -s) — o mesmo engano da Roteiro 5 já existia na Roteiro 4, nunca reportado antes por ninguém ter colado o comando dentro da sessão SSH"
  - "04-VERIFICACAO-HUMANA.md produzido com TODO item em aberto, por instrução explícita do coordenador (o dono está indisponível no momento da execução) — desvio deliberado e autorizado do texto literal do plano ('cada um com resultado escrito'), documentado aqui como Rule 4 (decisão arquitetural/de escopo, autorizada explicitamente, não uma omissão)"

patterns-established:
  - "roteiro de migração de servidor (docs/operacao/0N-migracao-*.md) sempre roda inteiro dentro da MESMA sessão SSH em bash — nenhum comando usa a forma curl.exe (PowerShell/máquina local), mesmo que os roteiros anteriores (02, 03) usem curl.exe deliberadamente para passos que rodam FORA da sessão SSH"

requirements-completed: []

coverage:
  - id: D1
    description: "npm run test:e2e sem --grep passa (a varredura completa da fase, rodada uma vez)"
    verification:
      - kind: e2e
        ref: "npm run test:e2e --workers=2 (concorrência representativa de CI) — só as duas falhas já documentadas e fora de escopo (WINDOWS.md ids 21, 22, arquivos da Fase 3) restaram, ambas auto-resolvidas por retentativa"
        status: pass
    human_judgment: false
  - id: D2
    description: "As migrações 0007/0008 estão aplicadas em produção e conferidas no schema/pg_trigger, não pelo relato de quem rodou"
    verification:
      - kind: other
        ref: "Consulta direta ao banco de produção (não local) — pg_trigger confirmou tocar_atualizado_em_{fornos,queimas,manutencoes} ao lado dos quatro gatilhos pré-existentes; /queimas funcional em produção confirma tabelas/enum indiretamente"
        status: pass
    human_judgment: false
  - id: D3
    description: "O gatilho atualizado_em é provado por uma alteração real de linha, não só declarado"
    verification:
      - kind: other
        ref: "Roteiro 5, passo 6 — editar um forno pela interface em produção e conferir atualizado_em avançando; executado pelo dono, evidência reportada ao coordenador"
        status: pass
    human_judgment: false
  - id: D4
    description: "04-VERIFICACAO-HUMANA.md tem os nove critérios do ROADMAP, os três backstops do UI-SPEC e os itens herdados dos seis planos, cada um pronto para o dono percorrer"
    verification: []
    human_judgment: true
    rationale: "O documento foi PRODUZIDO com todos os 26 itens (9 + 3 + 14) descritos com passo a passo de reprodução e critério de aprovação — mas NENHUM foi percorrido ainda. Por instrução explícita do coordenador (o dono está indisponível), esta tarefa foi redefinida em tempo real de 'percorrer o checklist' para 'produzir o checklist pronto para ser percorrido depois'. A fase NÃO está fechada — este é precisamente o portão que falta."

duration: ~5h (span de sessão; boa parte em diagnóstico de contenção de recursos local vs. CI)
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 7: O Fechamento da Fase — Varredura, Migração e Verificação Summary

**A varredura completa de `npm run test:e2e` achou e corrigiu quatro regressões genuínas de fim de fase mais duas causas raiz de falha real em CI; a migração `0007_queimas`/`0008_gatilhos-queimas` foi aplicada em produção e verificada no banco, não pelo relato; `04-VERIFICACAO-HUMANA.md` foi produzido com 26 itens, todos em aberto — a fase permanece executando, não fechada.**

## Performance

- **Duration:** ~5h de span de sessão (múltiplas pausas de checkpoint: decisão do usuário sobre o
  achado da varredura, blocker do coordenador reportando falha de CI, resposta do coordenador
  confirmando a migração aplicada)
- **Tasks:** 3/3 no sentido de "toda ação que o agente podia executar foi executada" — Tarefa 1
  completa, Tarefa 2 completa (incluindo a verificação em produção), Tarefa 3 **parcial por
  desenho**: o documento foi produzido, o checklist em si não foi percorrido (dono indisponível)
- **Files modified:** 8 (2 novos, 6 modificados) + `.planning`/`STATE.md`/`ROADMAP.md` nesta
  commit final

## Accomplishments

- A varredura completa (`npm run test:e2e` sem `--grep`) — a única de toda a Fase 4 — achou
  exatamente o que o `CLAUDE.md` prediz que ela acharia: quatro regressões genuínas, nenhuma
  visível sob `--grep`, todas corrigidas na própria tarefa que as achou, nunca contornadas
  - `casca.spec.ts` ainda testava `/queimas` como o placeholder vazio da Fase 2b
  - `queimas-manutencao.spec.ts` checava um forno recém-desativado sob um filtro que passou a
    escondê-lo desde o plano 04-05 (a mesma spec, sem ter sido re-rodada sem `--grep` desde então)
  - `queimas-banner.spec.ts`: dois casos afirmavam o NOME do forno no banner truncado — entraram
    na cadeia `@vazio-historico`
  - `queimas-relatorios.spec.ts`: os tetos dos deltas de total/biscoito viraram pisos — a premissa
    de "um único escritor concorrente conhecido" só valia sob `--grep` isolado
- A migração `0007_queimas`/`0008_gatilhos-queimas` está em produção — backup sob demanda antes,
  aplicação verificada no schema, os três gatilhos confirmados em `pg_trigger`, `atualizado_em`
  provado por uma edição real via interface, não SQL direto
- Duas causas raiz de falha REAL em CI (não achadas pela varredura local, reportadas pelo
  coordenador depois do primeiro push da fase) foram diagnosticadas e corrigidas: `testInfo.retry`
  ausente do e-mail de bloqueio (autodestruía as próprias retentativas) e uma sincronização de
  e2e baseada em um valor que não muda (`0/50` → `0/50`), confirmadas com execução isolada e com
  `--workers=2` (a concorrência real de CI)
- `docs/operacao/05-migracao-queimas.md` escrito no molde do Roteiro 4, e um erro real de execução
  (`curl.exe` não existe no servidor Linux) corrigido nos DOIS roteiros — o 05 novo e o 04
  pré-existente, que carregava o mesmo engano sem nunca ter sido reportado
- `04-VERIFICACAO-HUMANA.md` produzido: 26 itens (9 critérios do ROADMAP + 3 backstops do UI-SPEC
  + 14 itens herdados dos seis planos anteriores), cada um com passo a passo de reprodução e
  critério de aprovação — nenhum marcado, por instrução explícita (dono indisponível)

## Task Commits

1. **Tarefa 1: varredura completa — quatro correções** — `a76aa58` (fix)
2. **Tarefa 2 (prep): roteiro de migração** — `3cf0fe9` (docs)
3. **Correção de CI (blocker do coordenador, run #45)** — `26d3151` (fix)
4. **Correção do roteiro (curl.exe, achado na execução real)** — `de3e1a3` (fix)
5. **Tarefa 3: `04-VERIFICACAO-HUMANA.md` produzido** — `e49e0d5` (docs)

**Plan metadata:** commit final registrado junto com este SUMMARY.md.

## TDD Gate Compliance

Não aplicável — este plano não tem tarefa `tdd="true"` (nenhum módulo puro novo; é fechamento de
fase).

## Files Created/Modified

- `docs/operacao/05-migracao-queimas.md` — Roteiro 5, aplicação da migração de Fornos, no molde
  do Roteiro 4
- `.planning/phases/04-contador-de-queima/04-VERIFICACAO-HUMANA.md` — checklist de 26 itens,
  todos em aberto
- `tests/e2e/casca.spec.ts` — `/queimas` removido de `TELAS_DE_MODULO` (mesmo ajuste que
  `/encomendas` recebeu na Fase 3)
- `tests/e2e/queimas-banner.spec.ts` — dois casos ganharam `@vazio-historico`
- `tests/e2e/queimas-manutencao.spec.ts` — filtro "Todos" antes de checar forno desativado;
  `page.reload()` antes de checar o histórico após a segunda manutenção
- `tests/e2e/queimas-relatorios.spec.ts` — tetos de delta viraram pisos
- `tests/e2e/autenticacao.spec.ts` — `testInfo.retry` no e-mail de bloqueio; timeout 60s → 120s
- `docs/operacao/04-migracao-encomendas.md` — `curl.exe` → `curl -s`, mesmo achado do Roteiro 5

## Decisions Made

Ver `key-decisions` no frontmatter — a mais relevante para leitura futura: **`04-VERIFICACAO-HUMANA.md`
foi produzido com todo item em aberto, por instrução explícita do coordenador, não pelo texto
literal original do plano** (que pedia "cada um com resultado escrito"). O dono estava
indisponível no momento em que a Tarefa 2 (migração) foi concluída — o coordenador redefiniu a
Tarefa 3 em tempo real de "percorrer o checklist" para "produzir o checklist pronto para ser
percorrido depois", exatamente como um `checkpoint:human-verify` que não pode ser respondido
sozinho deveria ser tratado. Isso está registrado aqui como uma decisão de escopo autorizada, não
como uma omissão do agente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Quatro regressões de fim de fase achadas pela varredura completa**
- **Found during:** Tarefa 1, primeira execução de `npm run test:e2e` sem `--grep`
- **Issue:** ver "Accomplishments" acima — `casca.spec.ts` testando placeholder obsoleto,
  `queimas-manutencao.spec.ts` sem levar em conta o filtro padrão introduzido depois, dois casos
  de `queimas-banner.spec.ts` disputando posição num agregado truncado, e
  `queimas-relatorios.spec.ts` com premissa de concorrência válida só sob `--grep`
- **Fix:** ver arquivos modificados acima
- **Files modified:** `tests/e2e/casca.spec.ts`, `tests/e2e/queimas-manutencao.spec.ts`,
  `tests/e2e/queimas-banner.spec.ts`, `tests/e2e/queimas-relatorios.spec.ts`
- **Verification:** 4 execuções locais de `npm run test:e2e` (a última só com o `WINDOWS.md` id 3
  pré-existente restando)
- **Committed in:** `a76aa58`

**2. [Rule 3 - Blocking] Duas causas raiz de falha real de CI, fora do que a varredura local achou**
- **Found during:** blocker do coordenador reportando CI run #45 (commit `3cf0fe9`) com E2E
  falhando após o primeiro push da fase inteira (38 commits nunca publicados antes)
- **Issue:** `autenticacao.spec.ts` autodestruía as próprias retentativas (e-mail sem
  `testInfo.retry`); `queimas-manutencao.spec.ts` tinha uma sincronização por valor que não muda
  (`0/50` → `0/50`), mascarada localmente pela ordem de execução mas real sob a carga de CI
- **Fix:** ver `key-decisions`
- **Files modified:** `tests/e2e/autenticacao.spec.ts`, `tests/e2e/queimas-manutencao.spec.ts`
- **Verification:** execução isolada (`--grep "manutenção" --workers=1`, confirma ausência de bug
  de lógica) + `npm run test:e2e --workers=2` (concorrência real de CI, ambos os arquivos verdes)
  + CI run #46, que foi verde ponta a ponta (Qualidade → E2E → Publicar imagens → Implantar no
  VPS)
- **Committed in:** `26d3151`

**3. [Rule 1 - Bug] `curl.exe` (forma do PowerShell) usado dentro da sessão SSH do servidor Linux**
- **Found during:** execução real do Roteiro 5 pelo dono, reportado pelo coordenador
- **Issue:** o passo de conferência do backup usava `curl.exe`, que só existe no PowerShell da
  máquina local — dentro da sessão SSH em `bash`, o comando falha com
  `curl.exe: command not found`. O mesmo engano já existia em `docs/operacao/04-migracao-encomendas.md`
  desde a Fase 3, nunca reportado por ninguém ter colado o comando dentro da sessão SSH antes
- **Fix:** `curl -s` (forma portável de `bash`) nos dois roteiros
- **Files modified:** `docs/operacao/05-migracao-queimas.md`, `docs/operacao/04-migracao-encomendas.md`
- **Verification:** revisão de conteúdo (comando testável só num servidor real; a correção segue a
  mesma convenção "roda tudo dentro da sessão SSH" já declarada no topo do próprio roteiro)
- **Committed in:** `de3e1a3`

---

**Total deviations:** 3 grupos de auto-fix (Rules 1 e 3), todos dentro do escopo do fechamento de
fase que este plano existe para cobrir — nenhuma mudança de comportamento de produto, só de teste
e de documentação operacional.
**Impact on plan:** Sem essas correções, `npm run test:e2e` sem `--grep` continuaria vermelho por
razões que nenhum `--grep` teria revelado, e o CI da fase inteira ficaria bloqueado
indefinidamente — exatamente o modo de falha que este plano existe para fechar antes da próxima
fase herdar.

## Issues Encountered

- **Duas causas raiz de flakiness de teste em arquivos da Fase 3, fora do escopo de arquivos
  deste plano, sem correção pequena e óbvia** — registradas em `WINDOWS.md` (ids 21, 22) em vez
  de corrigidas aqui: `tests/e2e/encomendas-detalhe.spec.ts:657` e
  `tests/e2e/encomendas-impressao.spec.ts:155`, ambas com transições de estado observáveis reais
  (não o defeito de "valor que não muda" corrigido em `queimas-manutencao.spec.ts`), ambas
  autorresolvidas por retentativa.
- **Contenção de recurso local mascarando o sinal real de CI**: esta máquina (16 núcleos, default
  ~8 workers do Playwright) sob múltiplas execuções seguidas da varredura completa no mesmo dia
  ficou visivelmente mais lenta que uma execução isolada — `--workers=2` (a concorrência real do
  runner de CI) foi o que permitiu diferenciar "bug real" de "meu ambiente local está saturado".
  Registrado como padrão em `patterns-established` para qualquer diagnóstico futuro de flake.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

Este plano é a exceção documentada da regra de "uma invocação por tarefa" — é o próprio propósito
da Tarefa 1 rodar a suíte inteira sem `--grep`, e o diagnóstico de duas causas raiz de CI exigiu
invocações adicionais, ambas dentro da exceção explícita do `CLAUDE.md` ("se precisar da suíte
inteira para diagnosticar, rode"). Todas as invocações, na ordem:

1. `npm run test:e2e` (sem `--grep`) — 1ª execução: 9 falhas (4 regressões genuínas + 5
   contaminação/contenção)
2. Mesmo comando — 2ª execução (após corrigir as 4 regressões): 2 falhas (só o `WINDOWS.md` id 3
   pré-existente) + 2 flaky autorresolvidos
3. Mesmo comando — 3ª execução (confirmação): 3 falhas (2 pré-existentes + 1 nova, transitória,
   não reproduziu depois) + 3 flaky autorresolvidos
4. Mesmo comando — 4ª execução (confirmação final antes do checkpoint): só as 2 falhas
   pré-existentes, 0 flaky — **execução que fechou a Tarefa 1**
5. `npm run test:e2e -- --grep "manutenção" --workers=1` — diagnóstico isolado do achado de CI
   (blocker do coordenador): confirma ausência de bug de lógica em `queimas-manutencao.spec.ts`
6. `npm run test:e2e -- --workers=2` — 5ª execução completa, concorrência representativa de CI,
   antes da correção: 4 falhas + 3 flaky (inclui o achado real de `queimas-manutencao.spec.ts`)
7. Mesmo comando — 6ª execução (após as duas correções de CI): 1 falha nova (Fase 3, registrada em
   `WINDOWS.md` id 22) + 1 flaky autorresolvido — `autenticacao.spec.ts` e
   `queimas-manutencao.spec.ts` não aparecem mais entre falhas nem flaky
8. CI run #46 (commit `26d3151`) — verde ponta a ponta, confirmação externa e definitiva

`npm run build` nunca foi invocado como passo separado — cada execução do e2e já constrói.
`npm run verificar` (inclui `test:migracoes`) — 2 execuções completas, ambas verdes.

## User Setup Required

Nenhuma configuração nova. A aplicação da migração em produção (Tarefa 2) já foi executada pelo
dono, com evidência reportada e registrada no rodapé de `04-VERIFICACAO-HUMANA.md`.

**Pendência real, não uma configuração:** o dono precisa percorrer `04-VERIFICACAO-HUMANA.md`
quando estiver disponível — é o único portão que falta para fechar a Fase 4.

## Next Phase Readiness

**A Fase 4 NÃO está fechada.** Este plano executou tudo que um agente pode executar sozinho: a
varredura técnica, a migração de produção (com o dono presente para os passos que só ele pode
dar), e a produção do documento de verificação. O que falta — o dono percorrendo os 26 itens de
`04-VERIFICACAO-HUMANA.md` — é trabalho humano, não trabalho de agente, e não pode ser antecipado
nem presumido sem virar exatamente o erro que a Fase 3 cometeu (`03-08-SUMMARY.md`, verificação
parcial).

Quando o dono percorrer o checklist:
- Qualquer item que não passar vira correção ou entrada nova em `WINDOWS.md`
- Os seis itens que vieram de `WINDOWS.md` (ids 15-20) podem ser marcados `fixed` depois de
  confirmados
- Só então a Fase 4 pode ser considerada tecnicamente fechada, e a Fase 5 (Agenda de Aulas) pode
  começar

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

Todos os 8 arquivos citados acima (`docs/operacao/05-migracao-queimas.md` até
`docs/operacao/04-migracao-encomendas.md`) confirmados presentes em disco. Todos os 5 hashes de
commit (`a76aa58`, `3cf0fe9`, `26d3151`, `de3e1a3`, `e49e0d5`) confirmados em `git log --all`.
