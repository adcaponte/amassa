---
phase: 06-estoque
plan: 11
subsystem: estoque
status: complete
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
  duration: "Tarefas 1 e 2: ~30 min (07:54 → 08:25 UTC, 29/09/2026); a Tarefa 3 (o dono) fechou às ~16:15 UTC do mesmo dia"
  completed: 2026-09-29
estimate:
  tokens: 80000
  tasks: 3
actuals:
  tokens: 40000   # chars/4 sobre as linhas acrescentadas pelos 11 commits do 06-11 e por este fechamento (era 21500 só com as Tarefas 1 e 2)
  tasks: 3
  commits: 13   # 01d643d 57beeb9 e9a45d7 0df5d55 b9bb4e8 f05c373 b13d300 a69bb69 c545e81 922604b, os dois do só-migração que chegaram ao main (2907667, 0848b8c) e o fechamento
---

# Phase 06 Plan 11: O portão do Estoque — Summary (as três tarefas; o portão aprovado pelo dono em 29/09/2026)

**`/api/health/estoque` prova de fora que o app publicado enxerga a `0023`; o Roteiro 15 publica a
migração antes do código, na ordem do D-33; a caminhada põe D-23/D-24 antes de qualquer comando no
servidor; e a única varredura completa da fase passou sem nenhuma falha do Estoque — com o branch
só-migração pronto, local, para o dono.**

> ✅ **Atualização de 29/09/2026, tarde — a Tarefa 3 foi feita e APROVADA pelo dono** ("repassei
> toda verificação. o cowork tambem verificou. Aprovado."). A migração `0023` está aplicada em
> produção e o código da fase está no ar desde o merge `2345850`. Evidência na seção "Tarefa 3 —
> aprovada", no fim. **O parágrafo abaixo é o retrato da manhã, mantido como registro.**
>
> 🔴 *(29/09/2026, manhã)* **A Tarefa 3 NÃO foi feita e NÃO foi aprovada.** É o checkpoint humano bloqueante do dono:
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

## Tarefa 3 — pendente (checkpoint humano, `gate="blocking"`) — *registro da manhã; aprovada à tarde, ver "Tarefa 3 — aprovada" no fim*

*(29/09/2026, manhã: a Parte 0 foi respondida e aplicada — ver o segundo adendo, no fim. Falta o
resto.)* Aguardando o dono, nesta ordem: Parte 0 de `06-VERIFICACAO-HUMANA.md` (D-23/D-24/D-29) → Roteiro 15
no servidor → contagem inicial real → Parte 2 da caminhada com cronômetro. Depois do "aprovado":
registrar as respostas em `06-CONTEXT.md` (sem apagar o `[auto]`), marcar em `REQUIREMENTS.md` e no
`ROADMAP.md` só o que a caminhada confirmou, e ✅ com data na fila — com `git log origin/main..main`,
`gh run list` e `curl /api/health/estoque` medidos.

## Self-Check: PASSED *(o das Tarefas 1 e 2, 29/09 de manhã; o do fechamento está no fim)*

- Arquivos existem: `app/api/health/estoque/route.ts`, `tests/e2e/estoque-saude.spec.ts`,
  `docs/operacao/15-migracao-estoque.md`, `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md`.
- Commits existem: `01d643d` e `57beeb9` em `gsd/phase-06-estoque`; `80a4b83` em
  `gsd/phase-06-estoque-migracao` (local).
- `git branch --show-current` = `gsd/phase-06-estoque`; `main` em `a8c7bad`; nada publicado.

## Adendo do orquestrador — 29/09/2026, 08:50–08:55 UTC (depois das Tarefas 1 e 2)

Escrito depois do que está acima, que continua valendo como registro das Tarefas 1 e 2.

- **Revisão de código da fase, antes do portão** (`06-REVIEW.md`, `cc466af`): 71 arquivos, 0
  bloqueios, 5 avisos, 9 informativos. Corrigidos WR-03, WR-04 e WR-05 e duas conferências de
  roteiro (IN-02, IN-04), em `68bacb0`, `9460e8f`, `f9216d1` e `3e3ff21`; WR-01 e WR-02 são regras
  de dinheiro do cancelamento e foram postos na Parte 0, §0.1, sem mudar o código (`c99d9c9`,
  `7c2612f`). Relatório: `06-REVIEW-FIX.md` (`e82a19e`) — `npm run verificar` verde e UM e2e com
  `--grep "estoque contagem|estoque primeira abertura|cadastros catalogo ativo"`, 66 passed. **A
  varredura completa desta tarefa rodou antes dessas correções.**
- **O `main` ganhou dois commits depois do corte do branch só-migração, só de documentos:**
  `c4713e1` "docs(state): main com o estado da fase 06 — igual ao branch gsd/phase-06-estoque" e
  `f44f6dc` "docs(state): main com o estado da fase 06 — ressincronizado com o branch" — só
  `STATE.md`, `ROADMAP.md` e `PROXIMA-SESSAO.md`, iguais aos do branch da fase (o `main` dizia "em
  execução"). Portanto **`git log origin/main..main` lista agora 19 commits: os 17 da lista acima
  mais `c4713e1` e `f44f6dc`** (medido às 08:55 UTC).
- **O branch só-migração foi refeito sobre esse `main`** (`git rebase main`, duas vezes, uma por
  commit de documentos): `80a4b83` → `a4aefbc` → **`2907667`** (o atual). `git diff --name-only main gsd/phase-06-estoque-migracao` continua listando
  exatamente os quatro arquivos, e eles são idênticos aos do branch da fase (`git diff --quiet
  gsd/phase-06-estoque gsd/phase-06-estoque-migracao -- <os quatro>` sai 0).
- **`npm run verificar` em `a4aefbc`** (08:53–08:54 UTC) **e de novo em `2907667`** (08:55–08:56
  UTC): exit 0 nas duas — `verificar-acoes` 74 ações, 0
  violações; 85 arquivos, 1325 testes; `test:migracoes` "Todas as afirmações passaram.". A primeira
  tentativa falhou no `tsc` por tipos gerados de um `next build` anterior do branch da fase em
  `.next/types/` (artefato local, ignorado pelo git, que o CI não tem); apagado esse diretório
  gerado, passou.

## Adendo — 29/09/2026, ~09h00–09h30 UTC: a Parte 0 respondida pelo dono e aplicada

Continuação da Tarefa 3 (sem aprová-la: o Roteiro 15 e a caminhada continuam do dono). O dono
respondeu a Parte 0 **no chat, em 29/09/2026, pela manhã, por formulário**: **D-23 vale**, **D-24
vale**, **WR-01 → a alternativa**, **WR-02 → a alternativa (a venda cancelada não conta)**, **D-29 →
sim, "Produção da casa"**, área Peças.

**Commits no branch `gsd/phase-06-estoque`:**

- `f05c373` fix(06-11): estorno de venda pela regra decidida pelo dono em 29/09 (WR-01, WR-02) —
  novo `Movimento` `estorno_de_venda` (regra R7 de `lib/estoque/custo.ts`: R1 primeiro; saldo
  positivo → o valor que a venda levou, D-23; saldo zero ou negativo → round(Δ × A), como R6) que
  não atualiza a última entrada com preço; `isNull(estornoDeId)` em `lerEstados`
  (`lib/estoque/gravacao.ts`) e `listarSaldos` (`lib/estoque/consultas.ts`). Os três testes
  "comportamento atual — a confirmar pelo dono" trocados por seis "WR-01/WR-02 decidido pelo dono em
  29/09" (o exemplo da revisão: a 1 un fica valendo R$ 50,00; a baixa com prateleira vazia sai pela
  última compra; o material nunca comprado continua `null`/"—"; R1 primeiro; saldo positivo = D-23).
- `b13d300` feat(06-11): semente da categoria de compra "Produção da casa" na 0023 (D-29) —
  `insert … select 'Produção da casa', 'custo', 'pecas' where not exists (… lower(trim(nome)) …)` no
  fim da `0023`; `scripts/testar-migracoes.mjs` passa a esperar 25 categorias semeadas e confere
  que a nova existe uma vez depois de migrar e continua uma ao reaplicar a instrução. `db/schema.ts`,
  `_journal.json` e `0023_snapshot.json` sem mudança (dado, não estrutura — o snapshot descreve só
  estrutura).
- `a69bb69` docs(06-11): Parte 0 marcada na caminhada, `06-CONTEXT.md` (D-23/D-24 confirmadas,
  D-23a, D-26 emendada, D-29 respondida) e Roteiro 15 (Passo 0 feito; Passo 5.5 novo:
  `select count(*) from categorias where nome = 'Produção da casa'` → 1; o antigo 5.5 virou 5.6).
- O commit de documentos de estado (este adendo, `STATE.md`, `PROXIMA-SESSAO.md`) vem logo depois.

**Branch só-migração:** `0848b8c` "chore(06): só a migração 0023 — com a semente da categoria
Produção da casa (D-29, dono 29/09)", **commit novo sobre `2907667`** (sem amend). `git diff
--name-only main gsd/phase-06-estoque-migracao` = exatamente `db/migrations/0023_estoque.sql`,
`db/migrations/meta/0023_snapshot.json`, `db/migrations/meta/_journal.json`,
`scripts/testar-migracoes.mjs`; `git diff --quiet gsd/phase-06-estoque gsd/phase-06-estoque-migracao
-- <os quatro>` saiu **0**. `main` não foi tocado.

**Verificação:**

- `npm run verificar` no branch da fase (antes dos commits, sobre o mesmo conteúdo): **exit 0** —
  lint, `tsc`, `verificar-acoes` 80 ações e 0 violações, 92 arquivos e **1627 testes**,
  `test:migracoes` "Todas as afirmações passaram.".
- `npm run verificar` no só-migração `0848b8c`, depois de `rm -rf .next/types .next/dev/types`:
  **exit 0** — 74 ações e 0 violações, 85 arquivos e **1325 testes**, `test:migracoes` "Todas as
  afirmações passaram.".
- **Um** e2e: `npm run test:e2e -- --grep "estoque financeiro|estoque abas|estoque material|cadastros"`
  → **140 passed, 2 skipped** (1,9 min de testes; ~2 min no total). Cobre os cancelamentos
  (`estoque financeiro` (f)(g)(h), `estoque abas` (c), `estoque material` (a)) e as telas de
  Cadastros (listas de categorias e o catálogo, onde a categoria nova aparece) — e, de carona, testes de
24 specs cujo título cita "cadastros" (abertura, encomendas, queimas, acessibilidade…). Nenhum teste contava
  categorias nem listava as de compra por posição (grep em `tests/e2e` e `tests/unit`); o único que
  contava — "exatamente 24" em `test:migracoes` — foi atualizado para 25.

**Desvios (regras 1–3):**

- **[Rule 1] O passeio aleatório do teste de invariantes quase não exercitava a entrada com preço.**
  O gerador usava os bits baixos de um LCG módulo 2^32 (`s % 4`), que têm período curto: em 500
  passos, a entrada com preço aparecia **uma** vez. Achado ao pôr o estorno de venda no passeio (ele
  também não aparecia). Correção: `(s >>> 8) % n`, seis escolhas (com preço, sem preço, estorno de
  venda e três de saída), e o teste agora afirma que cada tipo aparece e que o estorno ocorre com
  saldo positivo e com saldo negativo. Os invariantes `Q = 0 ⇒ V = 0` e `sinal(V) ∈ {sinal(Q), 0}`
  continuam valendo em todos os passos. Arquivo: `tests/unit/estoque-custo.test.ts` (`f05c373`).
- `tests/unit/estoque-pedidos.test.ts` esperava o espelho antigo (`entrada_com_preco`) em
  `pedidosDoEstorno` — atualizado para `estorno_de_venda` (`f05c373`). O `valorInformadoCentavos`
  gravado continua o absoluto da original (o `check` da 0023 o exige em toda entrada).

**Registrado, não corrigido:** uma compra com valor zero grava `tipo = 'entrada'` com
`valor_informado_centavos = 0` e `Movimento` `entrada_sem_preco` — `valorarMovimento` não a guarda
como última entrada com preço, mas as duas consultas a leem como uma (R$ 0,00). É anterior a esta
mudança e fora do que o dono decidiu; fica para a próxima revisão.

**Ainda pendente (Tarefa 3)** *(retrato da manhã — feito à tarde, ver abaixo)*: Roteiro 15 no servidor (o Passo 2 publica o só-migração `0848b8c`) →
contagem inicial real → Parte 2 da caminhada com cronômetro. 06-11 **não** concluído; nenhum
requisito EST marcado.

## Tarefa 3 — aprovada (29/09/2026, tarde)

**O dono aprovou no chat:** "repassei toda verificação. o cowork tambem verificou. Aprovado."

### Parte 1 — o Roteiro 15, feito por ele (saídas coladas no chat, conferidas pelo orquestrador)

- **Passo 0:** a Parte 0, respondida de manhã (adendo acima).
- **Passo 2:** `git log origin/main..main` = **19 commits** — os 17 da lista acima mais `c4713e1` e
  `f44f6dc`, como o primeiro adendo previa; merge do só-migração em fast-forward; `push`;
  `origin/main` = `0848b8c`; run **`36550036925`** verde (20m47s). O SIT-10 subiu junto:
  `curl … | grep -c 'hidden gap-2 md:flex'` = **1**, medido pelo orquestrador.
- **Passo 3:** backup antes de migrar — declaração do dono no chat (a linha de `sucesso`, o horário
  e o tamanho não foram colados).
- **Passo 4:** `docker compose pull ferramentas`; `ls db/migrations | grep 0023_estoque` →
  `0023_estoque.sql`; `npm run db:migrate` → "Migrações aplicadas com sucesso."
- **Passo 5 (SQL colado):** `movimentacoes_estoque` existe com **0 linhas**; `itens_catalogo` com
  `ativo` (padrão `true`, NOT NULL), `estoque_minimo_milesimos` (padrão `0`, NOT NULL) e
  `observacoes` (anulável) — 14 itens, 14 ativos, 14 com mínimo zero; `amassa_app` select `t`,
  insert `t`, **update `f`, delete `f`**; gatilho `travar_unidade_do_item_com_movimentacao` em
  `itens_catalogo`; índice `movimentacoes_estoque_estorno_de_uk`; "Produção da casa" contada **1**
  (custo, pecas, ativa); `/api/health` 200.
- **Passo 6:** `git merge --no-ff gsd/phase-06-estoque`, com conflito só em `.planning/STATE.md`,
  `ROADMAP.md` e `PROXIMA-SESSAO.md`, resolvido com a versão do branch (`--theirs`); merge
  **`2345850`** (commit às 15:07 UTC, pelo carimbo do próprio commit); `push`. O orquestrador
  conferiu `git diff gsd/phase-06-estoque main` vazio e nenhum marcador de conflito. Run
  **`36587755269`** verde (24m44s).
- **Passo 7:** `/api/health/estoque` → **200 `{"status":"ok"}`** (curl do dono; confirmado pelo
  orquestrador, junto com `/`, `/api/health` e `/api/health/backup` 200 e `/gestao/estoque` → 307
  para o login).
- O Passo 1 (guarda) não teve saída colada — o Passo 5 prova a estrutura nova no banco de produção.

### Parte 2 — o celular

Percorrida pelo dono em 29/09/2026 — aprovado no chat, **sem anotação por item nem os tempos
medidos da baixa**. As caixas da Parte 2 em `06-VERIFICACAO-HUMANA.md` ficaram em branco de
propósito; cada seção ganhou uma linha "Registro de 29/09" dizendo o que a cobre.

### Evidência independente — a verificação do Cowork

`Claude outputs/estoque/VERIFICACAO-COWORK-06.md` (fora do git), 29/09/2026, 12h35–13h05 de
Brasília (15h35–16h05 UTC). **Estático**, num clone limpo em `2345850`: `lint` 0 avisos, `tsc`
limpo, `verificar-acoes` 80 ações e 0 violações, **1627 testes**, `test:migracoes` passou (a primeira
rodada dele falhou por reaproveitar um banco de teste de 26/09; em banco novo passou — não é
defeito do código). **Online**, 19 passos em produção com um material de teste só, **nenhum 🔴**;
provou pelo browser os critérios **1, 2, 3, 4, 6, 7, 8 e 9**; o **5** (cronômetro) e a contagem
inicial real ficam com o dono — ele viu "Bolo do dia" contado pelo dono às 12h35 e, às 12h46, "2
de 7 contados hoje". *(O relatório diz "origin/main às 16:07 UTC" para o merge; 16:07 é o relógio
desta máquina, UTC+1 — o commit é de 15:07 UTC.)*

**Dados de teste que ele deixou em produção** (todos `[teste cowork]`): o item `[teste cowork]
argila da caminhada` desativado (7 movimentações, saldo 2,5 kg, R$ 0,00); as vendas **nº 22** e
**nº 23** canceladas; a ficha técnica de `[teste cowork] Caneca 300 ml` posta e retirada.

**O que ele achou que merece um olhar (nenhum bloqueia)** — levado a `.planning/STATE.md`, Pending
Todos, com a fonte:

1. Custo obrigatório na entrada manual: vazio recusa, "0" aceita — coerente com o "obrigatório" da
   UI-SPEC; se a intenção era "vazio = zero", falta um padrão. Regra do dono.
2. Baixa de 2 kg = 5 toques (atalhos fixos 1 · 5 · 10 · 25).
3. Páginas com blocos em streaming levando 10–25 s para trocar o esqueleto pelo conteúdo (Início,
   Histórico, Catálogo) — do carregamento do `/gestao`, não desta fase; candidato ao Polimento.
4. Anotações do Início mostrando "15h45" — hora em UTC (04.6) ou data faltando.
5. Compra com valor 0 lida como "R$ 0,00/un" (já registrado no adendo acima).
6. Busca da Venda por trecho contíguo ("cowork Caneca" não acha "[teste cowork] Caneca").
7. As decisões `[auto]` das §0.3/§0.4 da caminhada ainda sem resposta.

### O que foi marcado, e com que evidência

- **`REQUIREMENTS.md`:** EST-01..21 `[x]` e Complete na rastreabilidade, com um bloco de evidência
  requisito a requisito (passo do Cowork + e2e/unitários). **EST-09** só pela aprovação do dono,
  "sem o tempo medido registrado". De carona: a linha da Fase 6 na cobertura dizia "EST-01..12 ·
  12" e o total 160 — os EST-13..21 de 29/09 não tinham entrado nessas contas; agora 21 e 169.
- **`ROADMAP.md`:** 06-11 `[x]` (`roadmap.update-plan-progress 06 06-11 complete` — conferido no
  diff que só trocou o `[ ]`, o "10/11" → "11/11" e a linha da tabela, sem comer texto), com a nota
  datada; os 9 critérios de sucesso `[x]` com a fonte de cada um. **A fase NÃO foi marcada
  concluída** — a verificação da fase e o `phase.complete` vêm depois.
- **`06-VERIFICACAO-HUMANA.md`:** `status: approved`; Parte 1 com o Resultado de cada passo; Parte 2
  com o bloco do fechamento e o registro por seção.

## Self-Check (fechamento, 29/09/2026 tarde): PASSED

- `git branch --show-current` = `main`; `main` = `origin/main` = `2345850` antes deste fechamento
  (nada foi enviado por ele).
- Commits existem em `main`: `01d643d`, `57beeb9`, `f05c373`, `b13d300`, `a69bb69`, `2907667`,
  `0848b8c`, `2345850`.
- `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md` e `Claude outputs/estoque/VERIFICACAO-COWORK-06.md`
  existem; `grep -c '^- \[x\] \*\*EST-' .planning/REQUIREMENTS.md` = 21.
- Só documentos em `.planning/` mudaram neste fechamento — `npm run verificar` não foi necessário.
