---
phase: 06-estoque
plan: 11
subsystem: estoque
status: checkpoint
tags: [estoque, portao, health-check, roteiro-15, migracao-0023, varredura-e2e, verificacao-humana]
requires:
  - "06-01..06-10 — todo o código do Estoque no branch gsd/phase-06-estoque"
provides:
  - "GET /api/health/estoque — 200 {status:'ok'} só com a 0023 aplicada; 503 com frase sem ela"
  - "docs/operacao/15-migracao-estoque.md — o Roteiro 15 na ordem do D-33, com o passo só-migração"
  - ".planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md — a caminhada do dono (Partes 0, 1, 2)"
  - "branch LOCAL gsd/phase-06-estoque-migracao (80a4b83) — só os quatro arquivos da 0023 sobre main"
  - "a única varredura e2e completa da fase, registrada em Claude outputs/RETRATO-DA-SUITE.md"
affects: [producao, roteiro-15, fase-07]
tech-stack:
  added: []
  patterns:
    - "rota de saúde pública que prova uma migração por select de coluna nova, corpo só {status}"
    - "publicar a migração antes do código por um branch que leva só db/migrations + o teste de migrações"
key-files:
  created:
    - app/api/health/estoque/route.ts
    - tests/e2e/estoque-saude.spec.ts
    - docs/operacao/15-migracao-estoque.md
    - .planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md
  modified:
    - tests/unit/arvore-de-rotas.test.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/PROXIMA-SESSAO.md
decisions:
  - "/api/health/estoque entrou na lista pública explícita de tests/unit/arvore-de-rotas.test.ts, com o porquê — o portão da 04.6 reprova rota fora de /gestao que não esteja nomeada, e esta é pública de propósito"
  - "O Roteiro 15 usa o nome real do Roteiro 3 (docs/operacao/03-backup-e-restauracao.md); o Roteiro 14 cita um arquivo que não existe (03-restauracao-de-backup.md) — não corrigido, fora do escopo"
  - "A caminhada separa as conferências de dado extremo (valor de R$ 123 mil, nome de 120 letras, 60 materiais, falha forçada) numa opção (b): capturas a 320px pelo agente no banco de teste — o livro de produção não se apaga, e dado falso ficaria nele para sempre"
  - "O material de teste da caminhada entra com custo R$ 0,00 e termina desativado, para não somar dinheiro no Para onde foi"
  - "abertura-edicao.spec.ts:73 (desktop), nova na varredura, classificada como contenção por reexecução isolada (passou nos dois projetos); nenhuma janela nova aberta, pelo precedente do 04.6-08"
metrics:
  duration: "~30 min (08:54 → 09:25 pelo relógio desta máquina; 07:54 → 08:25 UTC, 29/09/2026)"
  completed: null
estimate:
  tokens: 80000
  tasks: 3
actuals:
  tokens: 21500
  tasks: 2
  commits: 3
---

# Phase 06 Plan 11: O portão do Estoque — Summary (Tarefas 1 e 2; a Tarefa 3 aguarda o dono)

**`/api/health/estoque` prova de fora que o app publicado enxerga a `0023`; o Roteiro 15 publica a
migração antes do código, na ordem do D-33; a caminhada põe D-23/D-24 antes de qualquer comando no
servidor; e a única varredura completa da fase passou sem nenhuma falha do Estoque — com o branch
só-migração pronto, local, para o dono.**

> 🔴 **A Tarefa 3 NÃO foi feita e NÃO foi aprovada.** É o checkpoint humano bloqueante do dono:
> responder a Parte 0 (D-23/D-24/D-29), rodar o Roteiro 15 no servidor, fazer a contagem inicial
> real e percorrer a caminhada com cronômetro. Nada foi publicado, nenhuma migração foi aplicada,
> nenhum requisito EST foi marcado `[x]`, e o 06-11 não está marcado concluído em lugar nenhum.

## O que foi entregue

### Tarefa 1 (`01d643d`)

- **`app/api/health/estoque/route.ts`** — no molde de `/api/health/backup`: `runtime = "nodejs"`,
  `dynamic = "force-dynamic"`; `select` de `id` em `movimentacoes_estoque` e de
  `estoqueMinimoMilesimos`/`ativo` em `itens_catalogo`, ambos com `limit(1)` e o resultado
  descartado. 200 → `{ "status": "ok" }` e nada mais; falha → `console.error` + 503 com
  `{ status: "erro", motivo: "O banco não tem a estrutura do Estoque — a migração 0023 foi aplicada?" }`.
- **`tests/e2e/estoque-saude.spec.ts`** — sem sessão, `maxRedirects: 0`: 200, sem `location`, corpo
  `toEqual({ status: "ok" })` e `Object.keys` = `["status"]`.
- **`docs/operacao/15-migracao-estoque.md`** — Passos 0 a 9 e "O que NÃO muda", no molde do Roteiro
  14: decisões → guarda (host e banco) → **publicar só a migração** (com o porquê do pipeline e a
  proibição de `db:generate` em destaque dentro do passo) → backup conferido por linha e tamanho →
  `db:migrate` pela `ferramentas` → conferência SQL antes do código (tabela e livro vazio, três
  colunas com padrões, `update`/`delete` falsos para `amassa_app`, gatilho, índice, `/api/health`
  200) → `git merge --no-ff` + `push` → `/api/health/estoque` → primeira abertura e contagem →
  caminho de volta (caso A: restaurar do backup; caso B: `git revert -m 1`, a `0023` fica em `main`
  e no banco porque chegou antes).
- **`06-VERIFICACAO-HUMANA.md`** — Parte 0 (D-23 e D-24 com o exemplo numérico dos testes — 10 un a
  R$ 0,01, compra de 1 un por R$ 10,00, saem 5: ao custo médio sobram 5 un valendo R$ 4,59; ao
  custo original, −R$ 4,49 —, D-29 como pergunta, as 16 `[auto]` e as 16 UI-D com "como desfazer",
  e as escolhas da execução); Parte 1 (o registro de cada passo do roteiro); Parte 2 (a contagem
  inicial, os 9 critérios do ROADMAP um a um, EST-09 com cronômetro — 4 toques de Saldos, 5 do
  Início —, desativar/reativar, a trava de unidade no Cadastros, a baixa simultânea com a Andressa,
  e as 11 conferências `backstop` dos planos 06-06 a 06-10).

### Tarefa 2 (`57beeb9` para os documentos versionados)

- A varredura completa (abaixo), o retrato da suíte com a seção nova, o branch só-migração, e os
  sete documentos de estado — os três versionados neste commit, os quatro fora do git editados em
  disco (`ESTADO-ATUAL.md`, `Claude outputs/RETOMAR-AQUI.md`, `Claude outputs/FILA-DO-CODE.md` sem
  ✅, `Claude outputs/RETRATO-DA-SUITE.md`).

## O branch só-migração (para o Passo 2 do Roteiro 15)

**`git log origin/main..main --oneline`, medido em 29/09/2026 às 09:17:11 pelo relógio desta
máquina (08:17:11 UTC), ANTES do `git switch -c`** — `main` local em `a8c7bad`, `origin/main` em
`ecdca87` (confirmado com `git ls-remote origin refs/heads/main` às 08:04 UTC). **17 commits**, que o
`push` do Passo 2 publica junto com a migração:

```
a8c7bad docs(state): fase 06 em execucao — o codigo vai para o branch gsd/phase-06-estoque
c361e80 docs(06): create phase plan — 11 planos, aprovados na 2a rodada do verificador
81aa6e4 docs(state): fase 06 com o contrato de UI aprovado — e a posicao atual medida
8d3d310 docs(06): UI design contract
67177bc docs(phase-06): add validation strategy
b09d7a3 docs(06): pesquisa da fase, e o contexto refinado pelo que ela achou
ae7a9dc docs(state): fase 06 com contexto capturado — e as decisoes [auto] na lista do dono
5ad73a0 docs(06): capture phase context — Estoque discutido em --auto, sem o dono
0f03508 docs(06): passo 1 da fila — o adendo entra na fase e corrige o planejamento que o contradizia
230ff68 docs(04.6): documentos de estado dizem que a fase fechou — e o que foi decidido sem o dono
3668cf4 docs(phase-04.6): evolui PROJECT.md e corrige a frase que a fase tornou falsa
598fbc7 docs(phase-04.6): fase concluida — plataforma em /gestao, Inicio novo, navegacao e site publico
e3527e4 docs(04.6): verificacao da fase — passed, 9 de 9, depois de corrigir o unico item humano
2bc7b36 docs(04.6): registra a autorizacao ampliada do dono — seguir em opcoes recomendadas, com os mesmos limites
0f29a99 docs(04.6): GES-07 e um comentario do menu diziam o que o codigo nao faz
ddfecfd fix(04.6): SIT-10 barra de cima do site segue o prototipo no celular e nao corta na virada
748b1c6 test(04.6): SIT-10 barra de cima do site nao pode cortar alvo em nenhuma largura — vermelho
```

Só `748b1c6`/`ddfecfd` (o SIT-10, a barra de cima do site) são código; o resto é documento.

- **Pré-condição conferida:** `git log a8c7bad..main -- scripts/testar-migracoes.mjs db/migrations`
  vazio — `main` não mexeu no script de migrações depois da criação do branch da fase (`main` ainda
  é o ponto de partida dele, `git merge-base` = `a8c7bad`).
- `git switch -c gsd/phase-06-estoque-migracao main` (08:17:17 UTC) →
  `git checkout gsd/phase-06-estoque -- <os quatro>` → commit **`80a4b83`** "chore(06): só a
  migração 0023 — publicar antes do código (D-33, Roteiro 15 Passo 2)".
- `git diff --name-only main gsd/phase-06-estoque-migracao` → exatamente
  `db/migrations/0023_estoque.sql`, `db/migrations/meta/0023_snapshot.json`,
  `db/migrations/meta/_journal.json`, `scripts/testar-migracoes.mjs`.
- **`npm run verificar` nesse branch: exit 0** — lint limpo; `tsc` limpo;
  `verificar-acoes: 74 ação(ões) conferida(s), 0 violações`; `Test Files 85 passed (85)`,
  `Tests 1325 passed (1325)`; `test:migracoes` imprimiu `conferirEstoque...` e
  `conferirConcorrenciaDoEstoque...` e "Todas as afirmações passaram." É a prova de que o código
  antigo + a migração passam na parte do pipeline que não é e2e.
- De volta: `git switch gsd/phase-06-estoque`. `main` continua em `a8c7bad`;
  `git log main --oneline -- lib/estoque components/amassa/estoque` vazio; nada foi publicado
  (`git ls-remote origin 'refs/heads/gsd/*'` vazio).
- **Não provado localmente:** o e2e do código antigo com a `0023` no banco — o job `e2e` do run do
  Passo 2 é quem prova, e o roteiro manda esperar o run verde antes do backup.

## A varredura completa (a única da fase)

`npm run verificar` (exit 0: 80 ações/0 violações, 1617 testes, `test:migracoes` passou) e depois
`npm run test:e2e`, sem `--grep` e sem `--no-deps`, sobre `01d643d`, 09:03 → 09:15 pelo relógio local:

```
948 passed · 12 failed · 1 flaky · 38 skipped · 61 did not run   (11.5m)
```

**Nenhum teste do Estoque falhou** (os oito `estoque-*.spec.ts`, 132 linhas `ok`, nos dois projetos
e na cadeia `vazio-*`). Comparação spec a spec com a última medição (madrugada de 29/09:
`826 passed · 10 failed · 1 flaky · 37 skipped · 48 did not run`) e a tabela do 04.6-08:

| Spec : linha | Projeto | Classe e veredito |
|---|---|---|
| `autenticacao.spec.ts:84` | desktop e celular | Conhecida — WINDOWS #3/#34 |
| `cadastros-contas-fixas.spec.ts:112` | desktop | Conhecida — WINDOWS #58 |
| `orcamentos-fotos.spec.ts:175` (g) | desktop e celular | Conhecida — WINDOWS #50 |
| `orcamentos-aprovacao.spec.ts:364` (i) | desktop | Conhecida — WINDOWS #57 |
| `orcamentos-tracador.spec.ts:63` | desktop e celular | Conhecida — WINDOWS #35 |
| `encomendas-impressao.spec.ts:155` | celular | Conhecida — WINDOWS #22 |
| `orcamentos-editor.spec.ts:85` (a) | celular | Contenção já confirmada por reexecução isolada no 04.6-08 |
| `rotas.spec.ts:168` (l) | desktop | Contenção — passou isolada na madrugada e **de novo agora** |
| `abertura-edicao.spec.ts:73` | desktop | **Nova** — estado antigo depois do `reload` sob carga, a forma do `orcamentos-editor:85`; nenhum arquivo da Abertura mudou na fase; **passou isolada nos dois projetos** → contenção |
| `queimas-relatorios.spec.ts:96` | desktop | Flaky conhecida (contagem global) |

**Reexecução isolada, para classificar** (sem correção):
`npm run test:e2e -- --grep "um item com entrega vencida aparece destacado|o ciclo completo: entrar por /gestao/login" --workers=1`
→ **50 passed (54.2s)**. Os 61 "did not run" são a cadeia `parametros-*`, como nas três medições
anteriores. Os 38 skipped incluem os seriais pulados depois de falha; `test.skip` no código de
`tests/e2e/` = 15, igual a `main`. O log teve 601 linhas `The destination stream closed early.`
(o ruído já registrado nos planos 06-03/06-06/06-08) e nenhum teste falhou por ele. **Nenhuma falha
causada pela fase → nada a corrigir; nenhuma sem classe.** Tabela completa em
`Claude outputs/RETRATO-DA-SUITE.md`, seção "A medição da Fase 06".

## Invocações de e2e — a fase inteira

| Plano | Invocações | Fonte |
|---|---|---|
| 06-01 | 1 | `--grep "estoque tracador"`, 44 passed |
| 06-02 | 0 | proibido pelo plano |
| 06-03 | 2 | 108 e 82 passed |
| 06-04 | 1 | 80 passed |
| 06-05 | 0 | não pedido |
| 06-06 | 1 | 86 passed |
| 06-07 | 2 | 94+2 falhas (auxiliar de teste), depois 54 passed |
| 06-08 | 2 | 52 e 114 passed |
| 06-09 | 2 | 74 e 80 passed |
| 06-10 | 3 | duas falhas de teste corrigidas; a 3ª, 48 passed |
| **06-11** | **3** | Tarefa 1: `--grep "estoque saude"` (48 passed); Tarefa 2: a varredura completa + a reexecução isolada para classificar (50 passed) |
| **Total** | **17** | 14 nos planos 06-01..06-10 + 3 aqui |

Nenhum `npm run build` separado em nenhum plano.

## Medições de produção (evidência dos documentos de estado)

Entre 08:04 e 08:19 UTC de 29/09/2026: `git ls-remote origin refs/heads/main` = `ecdca87`;
`gh run list --limit 5` — o mais recente é o `36509335475`, `completed success`, de 01:44 UTC;
`git log origin/main..main` = 17 commits (lista acima); `curl` → `/api/health` 200,
`/api/health/backup` **200**, `/api/health/estoque` **404** (só existe no branch — esperado); raiz
com `grep -c 'hidden gap-2 md:flex'` = 0 (SIT-10 fora do ar).

## Verificação — comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npm run verificar` (Tarefa 1, 1ª) | exit 1 — `arvore-de-rotas.test.ts` reprovou `app/api/health/estoque/route.ts` fora da lista pública (Desvio 1) |
| `npm run verificar` (Tarefa 1, 2ª) | exit 0 — 80 ações/0 violações, 92 arquivos, 1617 testes, `test:migracoes` passou |
| `npm run test:e2e -- --grep "estoque saude"` | 48 passed (50.5s) — os dois projetos, mais a cadeia `vazio-*` |
| Greps de aceite da Tarefa 1 | `force-dynamic` = 1; `count(`/`sum(`/`saldo`/`valor` fora de comentário = 0; o roteiro tem `0023` (23), `gsd/phase-06-estoque-migracao` (3), `backup` (11), `has_table_privilege` (1), `/api/health/estoque` (6), `git revert -m 1` (2), `D-33` (2), `db:generate` (4); `db:generate` na linha 159, entre o `git merge gsd/phase-06-estoque-migracao` (139) e `## Passo 3` (168); ordem backup (13) < `db:migrate` (198) < `has_table_privilege` (242) < `git merge --no-ff gsd/phase-06-estoque` (280); caminhada com 9 critérios `####`, `D-23` 6×, `D-29` 4×, "15 s" 4× |
| `npm run test:e2e` (varredura) | 948 passed · 12 failed · 1 flaky · 38 skipped · 61 did not run (11.5m) |
| reexecução isolada (`--workers=1`) | 50 passed (54.2s) |
| `npm run verificar` no branch só-migração (1ª) | exit 2 — `tsc` leu `.next/types` gerado pelo build do branch da fase (Desvio 2) |
| `npm run verificar` no branch só-migração (2ª) | exit 0 — 74 ações, 85 arquivos, 1325 testes, `test:migracoes` passou |
| `npm run verificar` (fim da Tarefa 2, branch da fase) | exit 0 — 80 ações, 1617 testes, `test:migracoes` passou |
| `git diff main -- .planning/REQUIREMENTS.md` | nenhum `EST-` passando a `[x]` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O portão estrutural de rotas reprovou a rota pública nova**
- **Found during:** Tarefa 1, primeiro `npm run verificar`
- **Issue:** `tests/unit/arvore-de-rotas.test.ts` (T-04.6-01) reprova todo `route.ts` fora de
  `app/gestao/` que não esteja na lista pública explícita — e o plano pede a rota pública.
- **Fix:** a rota entrou em `ARQUIVOS_DE_ROTA_PUBLICOS`, com o comentário do porquê (Passo 7,
  monitor externo, corpo só `{ status }`), como a lista exige ("alargar esta lista é publicar uma
  rota").
- **Files modified:** `tests/unit/arvore-de-rotas.test.ts` · **Commit:** `01d643d`

**2. [Rule 3 - Blocking] `tsc` no branch só-migração leu tipos gerados pelo build do branch da fase**
- **Found during:** Tarefa 2, `npm run verificar` no branch só-migração
- **Issue:** `.next/types/validator.ts` (gerado pelo `next build` do e2e, fora do git) citava
  `app/api/health/estoque/route.js` e a página da contagem, que não existem nesse branch.
- **Fix:** `rm -rf .next/types` (artefato gerado e ignorado pelo `.gitignore`; o build seguinte o
  refaz). Nenhum arquivo versionado mudou. No CI não existe `.next` antes do build.

**3. [Orçamento] Uma invocação de e2e além da varredura, para classificar**
- A reexecução isolada de `abertura-edicao:73` e `rotas:168` — a classe "contenção confirmada por
  reexecução isolada" do próprio plano exige rodar. Nenhuma correção foi feita.

### Registrado, não corrigido

- O Roteiro 14 (Passo final) cita `docs/operacao/03-restauracao-de-backup.md`, que não existe — o
  arquivo é `03-backup-e-restauracao.md`. O Roteiro 15 usa o nome certo; o 14 ficou como está
  (fora dos arquivos do plano).

## Known Stubs

Nenhum. A caminhada tem campos em branco de propósito — são do dono.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>`: a rota pública é a T-06-49 (corpo só `{status}`,
provado pelo e2e e pelo grep de aceite); a ordem D-33 (T-06-50), a guarda do servidor (T-06-51),
D-23/D-24 antes do servidor (T-06-52) e o executor sem publicar nem migrar (T-06-53) estão no
roteiro e na caminhada, e foram respeitados nesta execução.

## Tarefa 3 — pendente (checkpoint humano, `gate="blocking"`)

Aguardando o dono, nesta ordem: Parte 0 de `06-VERIFICACAO-HUMANA.md` (D-23/D-24/D-29) → Roteiro 15
no servidor → contagem inicial real → Parte 2 da caminhada com cronômetro. Depois do "aprovado":
registrar as respostas em `06-CONTEXT.md` (sem apagar o `[auto]`), marcar em `REQUIREMENTS.md` e no
`ROADMAP.md` só o que a caminhada confirmou, e ✅ com data na fila — com `git log origin/main..main`,
`gh run list` e `curl /api/health/estoque` medidos.

## Self-Check: PASSED

- Arquivos existem: `app/api/health/estoque/route.ts`, `tests/e2e/estoque-saude.spec.ts`,
  `docs/operacao/15-migracao-estoque.md`, `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md`.
- Commits existem: `01d643d` e `57beeb9` em `gsd/phase-06-estoque`; `80a4b83` em
  `gsd/phase-06-estoque-migracao` (local).
- `git branch --show-current` = `gsd/phase-06-estoque`; `main` em `a8c7bad`; nada publicado.
