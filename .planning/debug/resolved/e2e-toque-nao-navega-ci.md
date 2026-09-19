---
status: awaiting_human_verify
trigger: "Testes e2e da família 'toque que não navega' estão barrando o deploy (pipeline run 35391824317, commit a6cbac5, 2026-09-18). Ver Symptoms."
created: 2026-09-18T21:05:00Z
updated: 2026-09-18T22:50:00Z
deadline: 2026-09-18T23:32:00Z
symptoms_prefilled: true
goal: find_and_fix
parent_session: .planning/debug/abertura-navegacao-trava.md
---

## HARD CONSTRAINTS (owner, 2026-09-18) — read before anything

- **DEADLINE 2026-09-18T23:32:00Z (20h32 Brasília).** Check `date -u` before every experiment. At or
  before the deadline, STOP: write the checkpoint (what was measured, what was eliminated, current
  hypothesis, exact next_action) so the session resumes tomorrow with `/gsd-debug continue
  e2e-toque-nao-navega-ci`. Deliver *something* by the deadline — cause, fix, or measured
  eliminations. Do not start a long experiment that cannot finish before the deadline.
- **Never raise a timeout** and **never declare "environmental flake" without proof** (owner rule
  since Phase 4.2, see parent session trigger).
- **Never `git push`** (a push deploys to production). Commit locally only.
- **Never `git add -A`**: the untracked `Claude outputs/` folder (owner's, public repo) and
  `.planning/phases/06-estoque/` (belongs to the next phase) must not be committed. Stage specific files.
- **e2e budget:** each `npm run test:e2e` costs ~53s fixed (15s ephemeral Postgres + 38s next build).
  Prefer targeted measurement scripts against one production build over repeated full runs.
  `lint`, `tsc --noEmit`, `npm test` are cheap.
- `gsd-tools query commit` leaves a stale `.git/index.lock` on this machine — prefer plain
  `git commit`; if a lock appears with no git process alive, it is stale: remove it.
- Repository is public: no secrets, hostnames, IPs, e-mails or real person names in any file.

## Current Focus

ciclo_2026-09-18T22:22Z: |
  CICLO DE CONTINUAÇÃO (escopo fechado, pedido do session-manager): o WINDOWS #12 (sessao.spec.ts:110)
  é sessão que REALMENTE sobrevive à saída? A causa da navegação está fechada (faba475, daad36c) e não
  é reaberta. RESPOSTA: SIM — ressurreição CONFIRMADA (16.3.5: 28/80; 15.5.22 no ar: 3/80), causa
  medida (resposta de prefetch com o token renovado chegando depois da saída, 43/43) e CORRIGIDA em
  a92c44c (0/80 e 0/80; verificar ok; varredura completa só com WINDOWS #3). Método (Apêndice B):
  por repetição, contexto novo -> login -> Sair (fluxo exato do :110) -> cookies ao chegar em /login
  -> goBack (como o spec) -> page.goto('/') NOVO no mesmo contexto. 'cookie presente + goto mostra o
  painel' = ressurreição REAL; 'cookie ausente + goto -> /login mas goBack mostra o painel' = exibição
  de conteúdo velho no cliente.
reasoning_checkpoint_windows12:
  hypothesis: "Sair não encerra a sessão quando uma resposta de PREFETCH do roteador, pedida com o cookie ainda válido, chega depois da resposta da ação de saída: o middleware do Auth.js reemite o JWT (sem estado no servidor) em toda resposta, e esse Set-Cookie regrava o cookie apagado."
  confirming_evidence:
    - "22:25Z: 28/80 com cookie PRESENTE (valor NOVO) em /login e goto('/') novo abrindo o painel; 0/80 'só conteúdo velho no cliente'."
    - "22:28Z HAR: 43/43 ressurreições com resposta de prefetch DEFINE chegando depois da APAGA da saída; 0/17 nos limpos."
    - "Código instalado: handleAuth anexa o Set-Cookie da sessão em toda resposta; session.js reemite o JWT a cada chamada (updateAge só vale para 'database')."
  falsification_test: "Com o middleware sem renovar em resposta de prefetch, a mesma medição (8 workers, 40x por projeto) ainda mostrar cookie presente em /login ou goto('/') abrindo o painel."
  fix_rationale: "Tira o vetor medido na origem (a renovação do token em resposta a GET por fetch(), que é o prefetch — o Next esconde do middleware o cabeçalho que separaria prefetch de navegação RSC, então a regra usa Sec-Fetch-Dest: empty) sem mudar o modelo de sessão: AUTH-05 continua renovando em carregamento de página e Server Action."
  blind_spots: "Não fecha a classe inteira: uma navegação RSC ou Server Action REAL em voo no instante da saída ainda poderia reemitir (exige o usuário tocar num link e em Sair em ~100-400ms; não medido). O fechamento completo é revogação no servidor (id de sessão no token + tabela), que exige migração e decisão do dono."
  candidate_causes:
    - "config/dependência: middleware do Auth.js reemite o JWT em toda resposta (CONFIRMADO por leitura e pelo HAR)"
    - "environment/framework: o roteador do Next 16 dispara prefetch em duas fases ao abrir o menu e tocar em Sair, e a 2ª fase sai depois do POST (CONFIRMADO pelo HAR)"
    - "code: a saída como navegação suave / bfcache (ELIMINADO às 22:10Z: navegação completa e guarda de pageshow não mudaram a taxa)"
  and_gate: "sim — exige (1) renovação do token na resposta do prefetch E (2) prefetch em voo que termina depois da saída E (3) sessão sem estado no servidor. Tirar (1) basta para o vetor medido."
bug_class: "Mandelbug de DEPENDÊNCIA (React embutido no Next 15.5 descarta um ping de chunk Flight que chega durante a renderização; a transição fica suspensa para sempre) — tornado DETERMINÍSTICO localmente com 10 categorias; somado a um Bohrbug de TESTE (portão falso em cotacoes-categorias.spec.ts:128)."
hypothesis: "CONFIRMADA e CORRIGIDA — ver Resolution. Guardrail aceito (revert 15.5.22 volta a travar 3/3; reaplicar 16.3.5 confirma 3/3)."
test: "FEITO: varredura completa #1 na 16.3.5 = 3 failed | 33 skipped | 1 did not run | 413 passed (7.2m); varredura #2 com a92c44c = 2 failed | 33 skipped | 415 passed (6.7m) — só autenticacao:84 (WINDOWS #3, pré-existente)."
expecting: "Confirmação do dono: o pipeline do CI (depois do push, que é dele) passa nos testes da família e publica."
next_action: "AGUARDANDO verificação humana (amanhã): o dono faz o push da main (leva faba475 + daad36c + a92c44c + o commit desta sessão). Conferir no CI (gh run watch; lembrar de exportar o PATH do gh no Git Bash) que cotacoes-categorias:94, abertura-edicao:165/:234, encomendas-formulario:99, cotacoes-tracador:44 E sessao:110 passam sem retentativa e que o deploy sai; depois, no celular de produção: entrar, Sair, fechar a aba, abrir de novo a raiz -> tem que pedir login. Se confirmar: arquivar em resolved/, marcar WINDOWS #12/#29/#30/#31 como fixed no ledger, e registrar no backlog a revogação da sessão no servidor (ponto cego de a92c44c). Se falhar: gh run view --log-failed e voltar ao investigating."
historico_hipoteses_iniciais: |
  H1 (descartada como causa primária, mas o mecanismo é real): o pushState de '+ Nova cotação'
  (ACTION_RESTORE) marca a navegação pendente da pílula como `discarded` (app-router-instance.js:131-134).
  H2 (real, não causal): 'Editar' é o único abridor que ainda depende de navegação RSC (fora do D-23).
reasoning_checkpoint:
  hypothesis: "O toque que não navega é um defeito do React embutido no Next 15.5 (um 'ping' de chunk Flight que chega durante a renderização é descartado; a lane da transição fica suspensa para sempre com a thread ociosa). A chance cresce com o tamanho/nº de linhas 'outlined' do payload da página (10 pílulas = 100% local). No CI, :94 roda depois de os testes de cotação dos dois projetos criarem dezenas de categorias — por isso 3/3 no celular. O portão falso do :94 transforma a trava em 'Expected 2 Received 0' ao deixar as cotações caírem em C."
  confirming_evidence:
    - "Reprodução determinística: N=10 pílulas nunca confirma na 15.5.22 (26/26 somando os experimentos 2-7), N<=5 sempre confirma."
    - "FiberRoot travado: pending=suspended=0b111<<12, pinged=0, sem callback, sem commit suspenso, sem throttle; 70s sem confirmar; thread 99,9% ociosa."
    - "Thenable em que o React suspendeu já está 'fulfilled' e o React não foi pingado; chamar .then() extra nos thenables faz confirmar (Heisenbug) — assinatura dos relatos upstream #98303/#98305."
    - "Mesmo app, sem mudar uma linha, na next 16.3.5: 5/5 confirmam (inclusive N=10); na 15.5.25: 4/4 travam (inclusive N=3)."
    - "O estado entregue pelo roteador ao React está correto (actionQueue: canonicalUrl/árvore da pílula A, rsc da página no cache, pending=null) — descarta roteador, apelido de prefetch e server-patch."
  falsification_test: "Se, com next 16.3.5, a varredura completa ainda mostrar a família (edição 'Editar item/tarefa' que não abre, pílula que não troca, URL que não muda depois de router.push), a hipótese de causa única no React embutido cai."
  fix_rationale: "Remove a causa (o React com o defeito) em vez de contornar sintomas tela a tela; a sessão pai mostrou que alavancas locais (memo, contextos, mover componentes) só reduzem a taxa. A correção do portão falso do :94 é independente: o teste precisa afirmar o que diz afirmar."
  blind_spots: "Next 16 é versão MAJOR: Turbopack passa a ser o empacotador padrão do build, middleware.ts vira 'proxy' (depreciado, ainda funciona), podem mudar tipos/avisos. A imagem Docker (npm ci + next build em Alpine) não foi construída localmente ainda. Não medi o caso de Server Action (#98303) isolado na 16 — a varredura cobre."
  candidate_causes:
    - "environment/dependency: React embutido no Next 15.5.x descarta o ping (CONFIRMADO por troca de versão)"
    - "code (teste): portão falso em cotacoes-categorias.spec.ts:124-125 (CONFIRMADO por leitura e pelo banco no experimento 1)"
    - "code (app): Editar ainda abre por navegação RSC, fora do padrão D-23 (real, mas só expõe à causa 1; sem a causa 1, não trava)"
    - "data: volume de categorias no banco da suíte (amplificador, não causa)"
  and_gate: "sim — a falha de CI de :94 exige (1) a trava do React embutido E (2) o portão falso que deixa o teste seguir e gravar na categoria errada; sem (1) a navegação confirma; sem (2) o teste falharia no lugar certo (timeout do aria-selected), não com contagem errada."

## Symptoms

expected: |
  The full e2e suite passes in CI (Playwright retries: 2) so the pipeline publishes images and deploys.
  Locally (retries: 0) the suite should also be green.
actual: |
  Pipeline run 35391824317, attempt 1 (commit a6cbac5 — only change vs. the previous deployed commit
  is a Tailwind variant in components/ui/checkbox.tsx plus docs): 1 failed on all 3 attempts +
  6 flaky; deploy blocked. Attempt 2 (re-run of failed jobs) passed and deployed.
  - FAILED x3: tests/e2e/cotacoes-categorias.spec.ts:94 [celular] — "Expected: 2 Received: 0" at
    line 145 `expect(Number(contagemTexto)).toBe(linhasDesenhadas)`: pill A shows count 0 while 2
    rows are drawn → the click on pill A did not switch category, so the quotations created next
    went to the category that stayed active.
  - FLAKY (failed then passed on retry): abertura-edicao.spec.ts:165 and :234 (desktop AND
    celular), cotacoes-categorias.spec.ts:94 (desktop), encomendas-formulario.spec.ts:99 (desktop).
  Previous run 35383667389 (same app code except the checkbox variant): passed, 2 flaky
  (abertura-edicao.spec.ts:165 desktop, cotacoes-tracador.spec.ts:44 desktop).
  Local full sweep during plan 04.3-05 (retries 0): 402 passed, 6 failed — autenticacao.spec.ts:84
  (pre-existing, WINDOWS #3), cotacoes-categorias:94 (desktop+celular), cotacoes-tracador:44
  (desktop), abertura-edicao:165 (celular). Open ledger entries: .planning/WINDOWS.md #29, #30, #31.
errors: |
  No server error reported. Failures are assertion/timeouts consistent with a navigation that never
  committed (URL/category did not change after a click on a next/link RSC <Link>).
reproduction: |
  Full suite under load (`npm run test:e2e` with no --grep, or CI). Isolated they pass:
  `npm run test:e2e -- --grep "cotacoes categorias|cotacoes tracador"` → 36/36;
  `--grep "editar um item com tarefa ligada" --project celular` → pass.
  Orchestrator measurement on a production build (next build + next start), Pixel 7, fresh browser
  context per tap, 24 taps per path, 8s wait (script at the orchestrator scratchpad, method below):
    control "aba Itens → Tarefas" 0/24; "aba Itens → Cotações" 1/24; "pílula A → B" 0/24.
  Measurement method (reusable): a Playwright config OUTSIDE the repo with testDir pointing to a
  scratch folder whose `node_modules` is a directory junction to the repo's node_modules, run via
  `node scripts/testar-e2e.mjs --config <that config>` (the script forwards args to Playwright and
  provisions the ephemeral Postgres + DATABASE_URL_TESTE; globalSetup =
  tests/e2e/apoio/preparar-usuario.ts; webServer cwd = repo root). No repo file is touched.
started: |
  Phase 04.3 (Comparador de Compras) added ~9 Client Component references rendered directly in
  app/(app)/abertura/page.tsx (ProvedorNavegacaoCotacoes, DialogoCategoria, ConfirmarRemoverCategoria,
  FormularioCotacao, ConfirmarRemoverCotacao, DetalheCotacao, SubAbasCategorias, PainelCotacoes,
  BotaoVazioCotacoes) next to the 4.2 ones (FormularioItem, FormularioTarefa, AbasAbertura, ...).
  Parent session (.planning/debug/abertura-navegacao-trava.md, Phase 4.2) root-caused an upstream
  Next.js/React race: a transition-wrapped router state update sometimes never commits in
  production builds, with probability scaling with the number of Client Component references in
  page.tsx's own JSX; 4.2 fixed navigation by moving client components out of page.tsx (rate went
  from ~20-37% to 0/24). encomendas-formulario.spec.ts:99 is outside /abertura — check whether it
  is the same class.

## Eliminated

- hypothesis: "H1 como causa primária: a navegação da pílula só se perde porque o pushState de '+ Nova cotação' a supera (ACTION_RESTORE marca a pendente como discarded)."
  evidence: "Experimento 1, variante B: sem nenhum clique depois da pílula, a navegação também não confirma em 10s (3/3). A supersessão existe no código, mas aqui ela só mata uma navegação que já estava morta."
  timestamp: 2026-09-18T21:13Z

- hypothesis: "Clique antes da hidratação / cedo demais depois do carregamento completo."
  evidence: "Experimento 2: esperando 3s ou até `__reactProps` no elemento, a trava continua (15/16)."
  timestamp: 2026-09-18T21:18Z

- hypothesis: "Caminho de prefetch 'aliased' (produção apenas) + server-patch descartado deixa `use(unresolvedThenable)` suspenso para sempre."
  evidence: "Experimento 4: o server-patch devolve estado NOVO (nunca o mesmo), e com o prefetchCache LIMPO (sem aliased, sem server-patch) a trava continua 2/2 em N=10."
  timestamp: 2026-09-18T21:27Z

- hypothesis: "Descarte no roteador (actionQueue.pending.discarded) ou estado errado entregue ao React."
  evidence: "Experimento 4: `pending=null`, canonicalUrl e árvore da fila já apontam para a pílula A, página com rsc no cache."
  timestamp: 2026-09-18T21:27Z

## Evidence

- timestamp: 2026-09-18T21:06Z
  checked: "Log do CI, run 35391824317 tentativa 1 (`gh run view --attempt 1 --log-failed`)."
  found: |
    cotacoes-categorias:94 falha RÁPIDO (1.9s-3.1s por tentativa, desktop e celular), sempre na
    linha 145 com 'Expected: 2 Received: 0' — nunca um timeout. abertura-edicao:165/:234 (desktop e
    celular) falham por timeout de 15s esperando o cabeçalho 'Editar item'/'Editar tarefa' logo após
    o clique no lápis. encomendas-formulario:99 (desktop): após clicar 'Cancelar', a URL fica
    `/encomendas?nova` por 5s (o fechar faz `router.push("/encomendas")`). Resumo: 1 failed, 6 flaky,
    33 skipped, 4 did not run, 406 passed (7.5m), 2 workers.
  implication: "Duas assinaturas diferentes: (a) cotacoes-categorias falha em ~2s, sem esperar nada — não é um toque que 'trava', é uma asserção lendo o estado errado; (b) edicao/encomendas esperam o tempo todo por algo que nunca confirma."

- timestamp: 2026-09-18T21:07Z
  checked: "tests/e2e/cotacoes-categorias.spec.ts:124-145 + components/amassa/cotacoes/painel-cotacoes.tsx:132-141 + sub-abas-categorias.tsx (leitura)."
  found: |
    Linha 124-125: `await pilulaA.click(); await expect(page).toHaveURL(/&categoria=[0-9a-f-]+$/);`.
    Antes do clique a página está em `/abertura?aba=cotacoes&categoria=<C>` (criada por Enter) — a
    regex JÁ casa, então o portão passa instantaneamente sem provar nada (o Next só atualiza a URL no
    COMMIT da navegação RSC). Em seguida `criarCotacao` clica em "+ Nova cotação", cujo onClick é
    `preventDefault(); irParaSemNavegar(hrefNovaCotacao)`, com `hrefNovaCotacao` montado a partir do
    `categoriaId` que o servidor entregou (ainda C). O formulário grava com `categoriaId` (prop, ainda
    C) e faz `window.location.assign(...categoria=<C>)`.
  implication: "Portão falso confirmado por leitura. Se a navegação da pílula A ainda não confirmou quando o teste toca em '+ Nova cotação', as cotações vão para C — exatamente 'pílula A = 0, linhas = 2'."

- timestamp: 2026-09-18T21:08Z
  checked: "node_modules/next/dist/client/components/app-router.js:293-331 e app-router-instance.js:66-150 (Next 15.5.22, leitura do código instalado)."
  found: |
    `window.history.pushState` é substituído pelo Next: toda chamada externa (a nossa
    `irParaSemNavegar`) chama `applyUrlFromHistoryPushReplace`, que faz
    `startTransition(() => dispatchAppRouterAction({ type: ACTION_RESTORE, ... }))`. Em
    `dispatchAction`, se há ação pendente e a nova é ACTION_NAVIGATE ou ACTION_RESTORE:
    `actionQueue.pending.discarded = true` — e `handleResult` de uma ação descartada retorna sem
    `resolve`: o estado dela nunca é aplicado.
  implication: |
    (1) O comentário de url-sem-navegar.ts ('escreve a URL SEM transição') está errado para o Next
    15.5: a URL do navegador muda na hora, mas `useSearchParams()` só muda quando a ACTION_RESTORE
    confirma (reducer síncrono, sem ida ao servidor). (2) Um pushState feito enquanto uma navegação
    RSC está em voo CANCELA essa navegação, em silêncio. Mecanismo de perda determinístico, não
    probabilístico.

- timestamp: 2026-09-18T21:09Z
  checked: "components/amassa/abertura/ferramentas-linha.tsx + git show 8c552fd (commit que passou os abridores para pushState)."
  found: |
    8c552fd converteu 'Remover' para `preventDefault + irParaSemNavegar + abridor`, mas deixou
    'Editar' como `<Link href={hrefEditar} onClick={abrirEditar}>` SEM preventDefault — ou seja,
    Editar ainda abre por navegação RSC (a do payload maior, o resíduo 'editar' isolado na sessão
    pai: ~21% de trava isolado). E `aberto` em formulario-item.tsx/formulario-tarefa.tsx vem SÓ de
    `useItemAberto()`/`useTarefaAberta()` (URL) — o dado local (`abrirItem(id, dados)`) garante o
    modo de edição, mas não abre o diálogo. Editar é o único abridor de diálogo da tela que ainda
    depende de uma navegação RSC confirmar.
  implication: "abertura-edicao:165/:234 falham na única porta de abertura que ficou fora da correção D-23. Candidato a correção de produto mínima e coerente com o desenho já documentado."

- timestamp: 2026-09-18T21:13Z
  checked: |
    Experimento 1 (scratchpad medicao/supersessao.spec.ts + supersessao.config.ts, 1 invocação,
    build de produção local, Pixel 7, workers 1). Fluxo EXATO de cotacoes-categorias:94 até a linha
    145: login, criar A, B, C (C por Enter), clicar pílula A, criar 2 cotações, comparar. Variantes:
    A = todo request `rsc: 1` atrasado 1500ms + portão original (x3); B = mesmo atraso + portão que
    prova o commit (`expect(pilulaA).toHaveAttribute("aria-selected","true",{timeout:10000})`) (x3);
    C = sem atraso, portão original (x2). Onde cada cotação caiu foi lido direto no Postgres.
  found: |
    8/8 FALHARAM, inclusive o controle sem atraso:
      A #1-3: contagemA=0 linhas=2, cotação1->C cotação2->C, URL não mudou nem no clique nem no portão.
      B #1-3: pílula A NUNCA ficou aria-selected em 10s (Received "false").
      C #1-2: contagemA=0 linhas=2, cotação1->C cotação2->C.
  implication: |
    (1) A consequência da H1 está provada no banco: as cotações vão para C. (2) MAS a supersessão pelo
    pushState NÃO é a causa primária: na variante B nada foi clicado depois da pílula, e mesmo assim
    a navegação da pílula A não confirmou em 10s. Neste fluxo, a navegação da pílula nunca confirma —
    determinístico (8/8) aqui, ao contrário da medição do orquestrador (0/24 em 'pílula A→B' com
    contexto novo). A diferença entre este fluxo e a medição do orquestrador/da execução isolada (que
    passa) é o MOMENTO do clique: aqui o clique sai logo depois do carregamento completo
    (`window.location.assign`) que a criação da categoria C faz. O portão corrigido sozinho só
    trocaria 'Expected 2 Received 0' por um timeout: não é conserto.

- timestamp: 2026-09-18T21:18Z
  checked: |
    Experimento 2 (medicao/momento.spec.ts, 16 casos): origem 'goto' (categorias semeadas por SQL,
    abre a C por page.goto) e 'fluxo' (criadas pelo diálogo, como o teste) x modo do clique
    (imediato / espera 3s / prefetch abortado por page.route / só depois de o elemento ter
    `__reactProps` = hidratado). Banco acumulando: cada caso soma 3 categorias.
  found: |
    15/16 NUNCA confirmaram em 8s — em TODOS os modos, inclusive esperando 3s e com a pílula
    comprovadamente hidratada. O único que confirmou foi o PRIMEIRO caso (banco com 3 categorias).
    Em toda falha a requisição RSC da navegação sai e volta 200 em ~30ms (às vezes 'FIM', às vezes
    ERR_ABORTED — as duas formas aparecem também em casos que confirmam: ERR_ABORTED não é sinal).
    Nenhuma requisição de prefetch das pílulas aparece na rede (só as 5 rotas da casca).
  implication: "Não é hidratação, não é momento do clique, não é prefetch em voo. Correlaciona com a quantidade de categorias no banco."

- timestamp: 2026-09-18T21:22Z
  checked: |
    Experimento 3 (medicao/contagem.spec.ts): cada caso ZERA cotacoes/cotacao_categorias, semeia N,
    abre a ÚLTIMA por goto, espera hidratar + 500ms, clica na pílula de índice `alvo`; conta commits
    do React por um gancho __REACT_DEVTOOLS_GLOBAL_HOOK__ mínimo; tenta um 2º clique se falhar.
  found: |
    N=2 ok; N=3 ok (x3); N=4 ok; N=5 ok; N=6 alvo=0 NUNCA (2º clique confirmou); N=6 alvo=3 ok;
    N=10 alvo=0 NUNCA (2º clique também não). Commits do React depois do clique: 4 quando
    confirma, 1 quando trava (só o estado 'pendente' do Link). URL inalterada nas travas.
  implication: |
    Reprodução DETERMINÍSTICA e barata: com ~10 categorias a navegação da pílula nunca confirma
    (15/15 no experimento 2 com 6-48 categorias). Mesma alavanca da sessão pai ('mais referências de
    Client Component na página → mais trava'): cada pílula é um <Link>. Em CI, quando :94 roda,
    os testes de cotação dos dois projetos já criaram muitas categorias — daí 3/3 no celular.

- timestamp: 2026-09-18T21:26Z
  checked: "Leitura do roteador instalado (Next 15.5.22): prefetch-cache-utils.js getExistingCacheEntry, create-initial-router-state (semeia o cache de prefetch com a página do carregamento inicial), navigate-reducer.js:185-219, aliased-prefetch-navigations.js, layout-router.js:268-312, server-patch-reducer.js; e `find app -name loading.tsx`."
  found: |
    (1) Em PRODUÇÃO APENAS (`process.env.NODE_ENV !== 'development'`), uma navegação para
    `/abertura?...&categoria=A` sem entrada exata de prefetch reaproveita QUALQUER entrada com o mesmo
    pathname como 'aliased' — inclusive a entrada SEMEADA pelo carregamento inicial da página (chave
    `/abertura`, sem query, tipo AUTO). (2) Com entrada aliased e um loading.tsx na árvore,
    `handleAliasedPrefetchEntry` monta o estado novo reaproveitando os layouts da semente e deixa o
    `rsc` da PÁGINA nulo; o layout-router então busca a página preguiçosamente e fica em
    `use(unresolvedThenable)` até um ACTION_SERVER_PATCH preencher o cache. (3) `serverPatchReducer`
    DESCARTA o patch em silêncio (`if (newTree === null) return state`) quando a árvore não casa —
    e aí o `use(unresolvedThenable)` suspende para sempre: nenhum erro, nenhum commit, URL parada.
    (4) Há `app/(app)/loading.tsx` além de `app/(app)/abertura/loading.tsx` — a eliminação da sessão
    pai ('remover loading.tsx da abertura não muda a taxa') não desligou este caminho, porque
    `hasLoadingComponentInSeedData` olha a árvore inteira.
  implication: |
    Explica, sem supor bug de agendamento do React: 'só em produção' (o apelido é desligado em dev),
    'navigate seguido de server-patch em TODA navegação' (visto pela sessão pai com logpoints) e
    'fetch 200 completo, zero commit, zero erro'. AINDA NÃO PROVADO em execução: falta mostrar que a
    trava passa pelo caminho aliased e que o server-patch é descartado. Próximo experimento lê o
    `actionQueue` do AppRouter (props do fiber) antes/depois do clique.

- timestamp: 2026-09-18T21:27Z
  checked: |
    Experimento 4 (medicao/fila.spec.ts): gancho do DevTools guarda a raiz do React; acha o
    `actionQueue` nas props do fiber do AppRouter; embrulha `actionQueue.action` para registrar cada
    ação, se devolveu estado NOVO ou o MESMO (descarte), a URL canônica e a árvore; depois do clique
    lê o estado da FILA (que pode não ter sido confirmado pelo React) e o nó de cache da página.
    Variante `limparPrefetch` esvazia o `prefetchCache` antes do clique (desliga o caminho aliased).
  found: |
    N=10 (x2): navigate -> estado novo em 1-2ms (caminho aliased, dado semeado) -> server-patch
    -> estado NOVO (não descartado), página no cache com rsc ok. N=10 com cache LIMPO (x2): navigate
    faz fetch próprio, estado novo em ~30ms, sem server-patch, rsc ok. N=3: mesma sequência do N=10
    normal. Em TODOS: `actionQueue.pending = null`, `canonicalUrl` = URL da pílula A, árvore com a
    página A. Os N=10 NUNCA confirmaram (4/4), o N=3 confirmou em 50ms.
  implication: |
    ELIMINA o caminho aliased/server-patch como causa (desligado e a trava continua) e ELIMINA
    qualquer descarte no roteador. O Next entrega ao React um estado correto e completo; o React não
    confirma a transição. Reproduz a conclusão da sessão pai, agora de forma determinística. Com a
    árvore nova maior (10 pílulas), a transição não termina — suspeita nova: a renderização da
    transição é INTERROMPIDA repetidamente (inanição) por atualizações de prioridade maior, ou fica
    suspensa em algo que nunca resolve. Discrimina-se medindo se a thread principal fica ocupada.

- timestamp: 2026-09-18T21:30Z
  checked: "Experimento 5 (medicao/cpu.spec.ts): CDP Performance.getMetrics + Profiler numa janela de 2s, 1,5s depois do clique; N=10 sem clique, N=10 com clique (x2), N=3 com clique."
  found: "Em todos os casos, travado ou não: TaskDuration ~170ms em 2000ms, ScriptDuration 0ms, perfil 99,9% (idle)."
  implication: "Não é inanição/laço de renderização: com a navegação travada a thread principal está OCIOSA. O React está esperando alguma coisa."

- timestamp: 2026-09-18T21:34Z
  checked: "A1 (mudança TEMPORÁRIA, revertida com git checkout, working tree conferido limpo): cópias das props repetidas (`{...categoriaAtiva}` no BotaoEditarCategoria, `structuredClone(cotacoesDaCategoria)` em DetalheCotacao e PainelCotacoes) para eliminar as referências Flight por caminho `$2:4:props:...`. generico.spec.ts CASOS=10:0 x3, 3:0."
  found: "N=10: 3/3 NUNCA confirmaram. N=3: confirmou em 50ms."
  implication: "H5 (referências de deduplicação por caminho no Flight) ELIMINADA. Também conferido no payload capturado (experimento 3): todas as linhas referenciadas estão definidas — payload completo, sem linha faltando."

- timestamp: 2026-09-18T21:37Z
  checked: "Experimento 6 (medicao/raiz.spec.ts): gancho do DevTools guarda o FiberRoot; lê pendingLanes/suspendedLanes/pingedLanes/warmLanes/entangledLanes/callbackNode/cancelPendingCommit/timeoutHandle antes e 2,5s depois do clique; e um caso N=10 esperando 70s."
  found: |
    Travado (N=10, 2/2): pendingLanes = suspendedLanes = warmLanes = entangledLanes = 0b111000000000000
    (três lanes de transição), pingedLanes = 0, callbackNode = null, cancelPendingCommit = null,
    timeoutHandle = -1. Confirmado (N=3): tudo 0. N=10 esperando 70s: NUNCA confirmou.
  implication: |
    O React SUSPENDEU as lanes da transição esperando um 'ping' que nunca chega. NÃO é commit
    suspenso por recurso (stylesheet/fonte: cancelPendingCommit null, e passou dos 60s de limite do
    React), NÃO é throttle (timeoutHandle -1), NÃO é agendamento perdido (as lanes estão marcadas
    como suspensas, não pendentes-sem-callback). Algum componente da árvore nova fez `use()` de um
    thenable que nunca resolve. Próximo: capturar QUAIS thenables o React está esperando
    (interceptando `WeakMap.prototype.set` do pingCache).

- timestamp: 2026-09-18T21:43Z
  checked: "next@15.5.25 (último 15.5, dist-tag backport) instalado com --no-save, generico.spec CASOS=10:0 x3, 3:0. Revertido para 15.5.22 (npm install next@15.5.22 --no-save; `npm ls next` = 15.5.22; git status limpo)."
  found: "15.5.25: 4/4 NUNCA confirmaram — inclusive N=3, que na 15.5.22 confirma sempre."
  implication: "O último patch da linha 15.5 NÃO corrige; piora. Atualizar dentro da 15.5 não é saída."

- timestamp: 2026-09-18T21:47Z
  checked: |
    Experimento 7 (medicao/espera.spec.ts e espera2.spec.ts): intercepta `WeakMap.prototype.set` para
    registrar cada thenable que o React põe no pingCache do FiberRoot (wakeable -> Set de lanes)
    depois do clique; 2,5s depois descreve o estado de cada um. Versão 1 também chamava `.then()` em
    cada thenable (perturba); versão 2 só registra.
  found: |
    Versão 2 (sem perturbar), N=10 travado 2/2: 5 thenables — a promessa do fetch da navegação
    (fulfilled), o `unresolvedThenable` do layout-router `{then(){}, status:'pending'}`, dois chunks
    Flight (fulfilled, arrays) e um QUINTO chunk Flight (ReactPromise) cujo valor é um elemento React
    — status 'fulfilled' 2,5s depois, mas o React nunca foi pingado (lanes seguem suspensas, pingedLanes
    0, experimento 6). N=3 confirmado: só os 4 primeiros (sem o quinto). Versão 1 (chamando `.then()`
    extra nos thenables), N=10: CONFIRMOU — a observação mudou o resultado (Heisenbug clássico).
  implication: |
    Mecanismo observado diretamente: o React suspendeu a transição num chunk Flight de elemento
    'outlined' (com 10 pílulas o servidor tira elementos da linha principal em linhas preguiçosas
    `$L19..$L24`), esse chunk foi resolvido depois, e o aviso ('ping') de que ele resolveu se perdeu —
    a transição fica suspensa para sempre, com a thread ociosa. Isto é um defeito do React/Next, não do
    código do app (o app não chama `use()` nem cria Suspense nesses caminhos; conferido por grep).

- timestamp: 2026-09-18T21:48Z
  checked: "Busca na web pela assinatura."
  found: |
    Relatos upstream abertos com a MESMA assinatura: vercel/next.js #98303 ('Server Action update never
    commits: a transition lane stays suspended and is never pinged') e #98305 ('App Router 15.5.25: a
    <Link> clicked at hydration can park a transition lane that is never pinged (38/160; 0/160 on
    16.3.4)'); descrição: RSC 200 com payload completo, DOM antigo para sempre, lane suspensa nunca
    pingada embora os thenables já estejam resolvidos; causa no React 19.2 (um ping que chega DURANTE
    uma renderização é descartado; o React main passou a registrar a lane pingada). Também waku PR
    'keep a Flight wake-up that lands during a render'. Segundo o relato, Next 16.3.4 não reproduz.
  implication: |
    Explica todos os fatos medidos: 'só em produção', 'mais Client Components/linhas outlined → mais
    trava' (renderização mais longa → mais chance de o ping chegar durante ela), 'memo não ajuda'
    (sessão pai), 'thread ociosa', 'thenable já resolvido', 'a observação muda o resultado', e o
    `router.refresh()`/Server Action da sessão pai (#98303). Falta CONFIRMAR no nosso app que a
    linha 16.3 não trava na reprodução determinística.

- timestamp: 2026-09-18T21:51Z
  checked: "next@16.3.5 (dist-tag latest) instalado com --no-save --legacy-peer-deps, SEM nenhuma mudança de código; `next build` + `next start` pela mesma harness; generico.spec CASOS=10:0 x3, 6:0, 3:0."
  found: "5/5 CONFIRMARAM em 50ms, inclusive N=10 (100% travado na 15.5.22: 4/4 no exp. 4, 3/3 no A1, 2/2 nos exp. 6 e 7, 15/15 no exp. 2) e N=6 alvo=0 (travado na 15.5.22). Build e login (middleware + Auth.js beta.32) funcionaram sem ajuste."
  implication: "Confirma no NOSSO app o relato upstream: a linha 16.3 não tem o defeito. Peer deps conferidos: next-auth 5.0.0-beta.32 aceita next ^16; next 16.3.5 aceita react ^19.0.0 (temos 19.1.0); engines node >=20.9 (Dockerfile e local: 24.19.0)."

- timestamp: 2026-09-18T21:53Z
  checked: "Correção aplicada: `npm install next@16.3.5 --save-exact` (package.json + package-lock.json; lockfile traz @next/swc-linux-x64-musl 16.3.5 para o build Alpine do Dockerfile); tsconfig.json reescrito pelo próprio `next build` da 16 (jsx react-jsx, include .next/dev/types) — mantido para o build não sujar a árvore; portão real em cotacoes-categorias.spec.ts:127-134. `npm run verificar` completo."
  found: "EXIT=0: eslint limpo (--max-warnings=0), tsc --noEmit limpo, verificar-acoes 32 ações / 0 violações, vitest 31 arquivos / 572 testes passaram, test:migracoes 'Todas as afirmações passaram'. (As linhas '1 violação' no log vêm do fixture de tests/unit/verificar-acoes.test.ts, como já registrado na sessão refresh-nao-chega-no-celular.)"
  implication: "Nenhuma quebra de tipo, lint ou unitário com a 16.3.5. Falta a varredura e2e completa."

- timestamp: 2026-09-18T22:01Z
  checked: "Varredura e2e COMPLETA #1 na 16.3.5 (`npm run test:e2e`, sem --grep, retries 0, local)."
  found: |
    Linha literal do Playwright: '3 failed | 33 skipped | 1 did not run | 413 passed (7.2m)'.
    TODA a família passou nos dois projetos: cotacoes-categorias:94 (desktop+celular),
    abertura-edicao:165 e :234 (desktop+celular), encomendas-formulario:99 (desktop+celular),
    cotacoes-tracador:44 (desktop+celular). Falhas: autenticacao.spec.ts:84 desktop+celular (WINDOWS
    #3, pré-existente) e sessao.spec.ts:110 celular (WINDOWS #12: 'depois de sair o botão de voltar
    cai em /login'); o 'did not run' é sessao.spec.ts:129 celular (serial, depois do :110).
  implication: "A família alvo sumiu da varredura. Resta checar se sessao:110 é o mesmo antigo #12 ou regressão da 16."

- timestamp: 2026-09-18T22:05Z
  checked: "sessao.spec.ts:110 isolado, `--grep \"botao de voltar cai em /login\" --repeat-each=6` (12 execuções: 6 desktop + 6 celular), na 16.3.5 e, para comparação, na 15.5.22 (node_modules trocado com --no-save e tsconfig do HEAD; depois restaurados: `npm install` -> 16.3.5, tsconfig da 16)."
  found: |
    15.5.22: 1/12 falhou (celular). 16.3.5: 5/12 falharam (2 desktop, 3 celular). Mesma assinatura nas
    duas versões: depois de 'Sair' e `page.goBack()`, a URL fica em '/' e o snapshot da página mostra o
    painel PROTEGIDO ('Olá, Gestora de Teste.', 'SEU DIA HOJE') sem sessão.
  implication: |
    WINDOWS #12 não é 'timing sob carga': é um defeito de privacidade PRÉ-EXISTENTE (AUTH-06) — a saída
    é uma navegação SUAVE (Server Action `sair` -> `signOut({redirectTo:'/login'})` -> redirect tratado
    pelo roteador do cliente), então o 'voltar' é restaurado do cache do roteador do Next, sem ida ao
    servidor, e o `Cache-Control: no-store` do middleware nunca entra em jogo. A 16 deixa isso mais
    frequente (1/12 -> 5/12; n pequeno, mas no CI com 2 retentativas ~0,4^3 por projeto = risco real
    de barrar deploy). Não dá para subir a 16 sem tratar isto. Correção proporcional: a saída passa a
    ser navegação COMPLETA (documento novo), que é o que o teste e o comentário do middleware já
    presumiam. [REFUTADO logo abaixo — 22:10Z]

- timestamp: 2026-09-18T22:10Z
  checked: |
    Duas tentativas para sessao:110, cada uma medida com `--grep "botao de voltar cai em /login"
    --repeat-each=10` (20 execuções) e depois REVERTIDAS (git checkout + rm; árvore conferida):
    (a) saída por navegação COMPLETA: `sair()` com `signOut({ redirect: false })` e o cliente fazendo
    `window.location.assign("/login")` nas duas variantes do menu; (b) (a) + um guarda `pageshow`
    (`event.persisted` -> `location.reload()`) montado no layout protegido, contra bfcache.
  found: "(a) 7/20 falharam; (b) 7/20 falharam — mesma assinatura: depois do voltar, URL '/' com o painel ('SEU DIA HOJE')."
  implication: |
    Nem cache do roteador do Next (a) nem bfcache (b) explicam: com documento novo E recarregamento
    forçado, o servidor ainda desenha o painel — ou seja, no momento do voltar o servidor enxerga uma
    SESSÃO VÁLIDA. Hipótese nova (não medida): alguma resposta que saiu ANTES da saída (ex.: prefetch
    RSC em voo — a 'tempestade de prefetch' registrada na sessão refresh-nao-chega-no-celular) volta
    DEPOIS dela trazendo `Set-Cookie` com o token de sessão renovado pelo middleware do Auth.js e
    ressuscita a sessão. Se confirmado, é defeito de SEGURANÇA pré-existente (sair não sai), fora do
    escopo desta sessão: registrar e abrir sessão própria. Mudanças revertidas; sessao:110 fica como
    está (WINDOWS #12, pré-existente, medido 1/12 na 15.5.22 e 5/12-7/20 na 16.3.5).

- timestamp: 2026-09-18T22:13Z
  checked: "Diagnóstico da hipótese acima (medicao/saida.spec.ts, 10x celular + 10x desktop, 16.3.5): registra todo `Set-Cookie` do token de sessão a partir do clique em 'Sair', e os cookies do contexto antes/depois do voltar."
  found: |
    TODA resposta RSC/prefetch do app devolve `Set-Cookie: authjs.session-token=<499 caracteres>`
    (o middleware reemite a sessão a cada requisição). No celular, abrir o menu dispara prefetch de
    /abertura, /orcamentos e /conta/senha, e uma SEGUNDA rodada sai no mesmo instante do clique em
    'Sair' (+70ms), 8ms antes do POST da ação (+78ms); as respostas desses prefetch (DEFINE) chegaram
    ANTES da resposta da ação (que traz DEFINE+APAGA). Nesta rodada instrumentada: 0/20 falhas.
  implication: |
    O mecanismo de ressurreição da sessão EXISTE (prefetch em voo com Set-Cookie de sessão válida
    cruzando a saída) mas não foi flagrado — a instrumentação pode ter mudado o tempo. Hipótese
    PLAUSÍVEL, NÃO CONFIRMADA. Não corrigido aqui. Próximo passo sugerido (sessão própria): repetir o
    diagnóstico sem listeners pesados (só `context.cookies()` antes do voltar, 40+ repetições) e,
    se confirmar, a saída deve impedir que uma resposta atrasada reemita a sessão (ex.: o middleware
    não reemitir o cookie em requisições de prefetch, ou invalidar o token no servidor).

- timestamp: 2026-09-18T22:16Z
  checked: "(a) docker build -f docker/Dockerfile --target app com a árvore da correção (npm ci + next build no node:24.19.0-alpine); (b) revert-and-reconfirm na reprodução determinística: node_modules em 15.5.22 (--no-save, tsconfig do HEAD) e depois de volta a 16.3.5 (npm install, tsconfig da 16)."
  found: "(a) EXIT=0, 'Next.js 16.3.5 (Turbopack)', 'Compiled successfully', standalone copiado; único aviso: middleware depreciado em favor de proxy. (b) REVERT 15.5.22: 3/3 NUNCA confirmaram (N=10, N=10, N=6); REAPPLY 16.3.5: 3/3 confirmaram em 50ms. npm run verificar de novo na árvore final: EXIT=0."
  implication: "A correção é a versão do framework, e só ela: tirar a 16 devolve a trava, pôr de volta tira. A imagem de produção constrói."

- timestamp: 2026-09-18T22:25Z
  checked: |
    CICLO WINDOWS #12. Medição LEVE (medicao/ressurreicao.spec.ts, corpo no Apêndice B), next 16.3.5
    (HEAD), build de produção, 8 workers + fullyParallel (o mesmo paralelismo da suíte, que deu 5/12 e
    7/20), 40 repetições por projeto, contexto novo por repetição, NENHUM listener de request/response:
    só `context.cookies()` ao chegar em /login, depois do goBack e depois de um `page.goto('/')` novo.
  found: |
    Linha do Playwright: '80 passed (48.9s)' (o harness registra, não afirma). Tabela:
      celular 28 LIMPO | 12 cookie PRESENTE ao chegar em /login -> goBack mostra o painel -> goto('/') NOVO mostra o painel
      desktop 24 LIMPO | 14 idem | 1 cookie PRESENTE, goBack voltou para /login (o spec PASSARIA) mas goto('/') mostra o painel
              | 1 cookie PRESENTE, goBack mostrou o painel, goto('/') ficou em url '/' (o middleware DEIXOU passar) mas o
                texto 'SEU DIA HOJE' ainda não estava visível no instante do isVisible (leitura instantânea) — conta como sessão viva.
    Correlação perfeita: TODO caso com cookie presente em /login é sessão viva no servidor; TODO caso LIMPO tem o cookie
    AUSENTE em /login. Em 28/28 ressurreições o valor do cookie é NOVO (não é o do login): foi REEMITIDO por uma resposta
    depois do login. Nenhum caso 'cookie ausente + goBack mostra o painel' (conteúdo velho só no cliente): 0/80.
  implication: |
    RESSURREIÇÃO CONFIRMADA: 28/80 (celular 12/40 = 30%, desktop 16/40 = 40%) na 16.3.5 sob a carga da suíte. 'Sair' NÃO
    encerra a sessão nesses casos: um documento novo, sem histórico e sem cache, abre o painel protegido. É defeito de
    SEGURANÇA/PRIVACIDADE (AUTH-06), não do teste. O teste do :110 subestima (1 caso em que o goBack passou e a sessão
    estava viva). Próximo: qual resposta reemite o cookie e quando ela chega em relação à resposta da saída.

- timestamp: 2026-09-18T22:28Z
  checked: |
    Identificação (medicao/ressurreicao-har.spec.ts): mesmo fluxo, sem goBack (Sair -> /login -> goto('/')), contexto
    criado com `recordHar: { content: 'omit' }` (gravado pelo Playwright/navegador, nenhum listener no processo do
    teste), 30 repetições por projeto, 8 workers. Do HAR: cada resposta com `Set-Cookie` do token de sessão, com o
    instante em que os CABEÇALHOS chegaram (blocked+dns+connect+send+wait) em relação ao clique em 'Sair'.
    Leitura do código instalado: next-auth/lib/index.js `handleAuth` (linhas ~141-184) anexa `sessionResponse`
    Set-Cookie em TODA resposta do middleware; @auth/core/lib/actions/session.js: na estratégia 'jwt' o token é
    re-codificado e reemitido a CADA chamada (o `updateAge` só vale para a estratégia 'database', linha 77).
  found: |
    '60 passed (34.0s)'. celular 28/30 ressurreição, desktop 15/30. Separação PERFEITA:
      43/43 ressurreições têm >=1 resposta 'DEFINE' (token válido) chegando DEPOIS da resposta da ação de saída
            (que traz 'DEFINE+APAGA', nessa ordem); em 43/43 é resposta de PREFETCH do roteador (`next-router-prefetch`);
            em 43/43 pelo menos uma dessas requisições SAIU depois do POST da saída (ainda com o cookie válido, porque a
            resposta da saída não tinha chegado). Em 5 casos do desktop o GET RSC /login também reemite — consequência
            (o cookie já tinha voltado), não causa.
      17/17 casos limpos: nenhuma resposta DEFINE depois da APAGA.
    Exemplo (celular #0): +1ms prefetch /abertura,/orcamentos,/conta/senha (abrir o menu) | +32ms sai o POST da ação
    'sair' | +170..186ms SAEM mais 3 prefetch (2ª fase, segmentos) com o cookie ainda válido | +424ms chega a ação:
    DEFINE+APAGA | +446, +456, +503ms chegam os 3 prefetch: DEFINE -> cookie de sessão de volta, válido por 30 dias.
    O app não usa `prefetch={true}` em lugar nenhum (grep): todo prefetch do Next 16 leva `next-router-prefetch`
    (segment-cache/cache.js: '1'/'2'/'3'; só a estratégia Full vai sem o cabeçalho, e ela não é usada).
  implication: |
    CAUSA DA RESSURREIÇÃO MEDIDA: sessão JWT sem estado no servidor + middleware do Auth.js que reemite o token em
    TODA resposta + prefetch do roteador em voo no instante da saída (abrir o menu e passar pelo 'Sair' disparam
    prefetch; a 2ª fase sai depois do POST). A resposta atrasada do prefetch regrava o cookie que a saída acabou de
    apagar. Um prefetch é especulativo — não é 'uso' da sessão (AUTH-05 fala em renovar a cada USO). Correção
    proporcional: o middleware não deixa a renovação do token sair em resposta de prefetch.

- timestamp: 2026-09-18T22:32Z
  checked: |
    1ª tentativa de correção: middleware tira o Set-Cookie do token quando `requisicao.headers.has('next-router-prefetch')`
    (lib/auth/renovacao-sessao.ts + teste unitário verde + tsc limpo). Mesma medição leve (ressurreicao.spec.ts, 8
    workers, 40x por projeto). Depois, leitura de node_modules/next/dist/server/web/adapter.js:150-180.
  found: |
    '80 passed (49.0s)': celular 16 ressurreição real + 1 (cookie presente, painel ainda não visível no goto) / 40,
    desktop 11/40 — a MESMA taxa de antes (28/80). Causa: o Next REMOVE os FLIGHT_HEADERS (`rsc`,
    `next-router-state-tree`, `next-router-prefetch`, `next-router-segment-prefetch`, `next-hmr-refresh`) da requisição
    que o middleware enxerga, e tira o `_rsc` da URL (adapter.js:156-172; só não faz isso com
    skipMiddlewareUrlNormalize). No middleware, prefetch e navegação RSC são indistinguíveis; o teste unitário passava
    porque testava a função pura, não o que o middleware recebe.
  implication: |
    A regra 'só prefetch' não é implementável no middleware sem mudar a configuração do framework
    (skipMiddlewareUrlNormalize, efeito global). Alternativa com sinal que o Next NÃO remove: `Sec-Fetch-Dest` (do
    navegador). GET com `sec-fetch-dest: empty` = fetch() do roteador (prefetch OU navegação RSC); documento = 'document';
    Server Action = POST. Renovar só em carregamento de página e em Server Action mantém AUTH-05 (a sessão persiste 30
    dias ao reabrir; reabrir é documento) e tira o vetor medido.

- timestamp: 2026-09-18T22:34Z
  checked: |
    Correção final: lib/auth/renovacao-sessao.ts `podeRenovarSessao(metodo, cabecalhos)` = não (GET com
    `sec-fetch-dest: empty`); middleware.ts tira do Set-Cookie as linhas do token de sessão (`semRenovacaoDaSessao`)
    quando não pode renovar. tests/unit/renovacao-sessao.test.ts 10/10, tsc limpo. MESMA medição leve
    (ressurreicao.spec.ts, 8 workers, 40x por projeto, 16.3.5).
  found: "'80 passed (37.6s)': celular 40/40 LIMPO, desktop 40/40 LIMPO — cookie AUSENTE em /login, goBack cai em /login, goto('/') novo cai em /login, 80/80. Antes da correção, mesma medição: 28/80 ressurreição real (22:25Z)."
  implication: "A correção tira a ressurreição medida (28/80 -> 0/80) e, junto, a falha do sessao.spec.ts:110 (goBack 80/80 em /login). Falta: regressão no e2e, npm run verificar, sessao repetido e varredura completa."

- timestamp: 2026-09-18T22:35Z
  checked: "Regressão no e2e: sessao.spec.ts:110 ganha, depois do goBack, um `page.goto('/')` NOVO que precisa cair em /login sem 'SEU DIA HOJE' (o oráculo de AUTH-06 é o servidor, não o histórico). `npm run verificar` completo na árvore com a correção."
  found: "EXIT=0: eslint limpo, tsc --noEmit limpo, verificar-acoes 32 ações / 0 violações (as linhas '1 violação' vêm do fixture de tests/unit/verificar-acoes.test.ts), vitest 32 arquivos / 583 testes, test:migracoes 'Todas as afirmações passaram.'"
  implication: "Nada quebra em lint, tipo, ações ou unitários. Sem mudança de schema (TABELAS_ESPERADAS intocada)."

- timestamp: 2026-09-18T22:36Z
  checked: "`npm run test:e2e -- --grep \"botao de voltar cai em /login\" --repeat-each=10` (config do projeto, 8 workers), com a correção e a asserção nova."
  found: "'42 passed (40.1s)', 0 falhas: sessao.spec.ts:110 10/10 desktop + 10/10 celular (os outros 22 são os testes @vazio-global dos projetos de dependência). Antes, na 16.3.5 sem correção e sem a asserção nova: 5/12 e 7/20 falhavam."
  implication: "O WINDOWS #12 some com a correção, agora com um teste que afirma o que AUTH-06 diz."

- timestamp: 2026-09-18T22:43Z
  checked: "Varredura e2e COMPLETA #2 (`npm run test:e2e`, sem --grep, retries 0, local), 16.3.5 + correção."
  found: |
    Linha literal do Playwright: '2 failed | 33 skipped | 415 passed (6.7m)'. As 2 falhas: autenticacao.spec.ts:84
    desktop+celular ('Test timeout of 120000ms exceeded' em `page.waitForResponse` do POST, linha 114) — WINDOWS #3,
    pré-existente, a mesma da varredura #1 (22:01Z, antes desta correção) e da 04.3-05. sessao.spec.ts:110 passou nos
    dois projetos (com a asserção nova) e o :129 rodou (na #1 ficou 'did not run'). A família do toque segue verde.
  implication: "Sem regressão: +2 passados em relação à varredura #1 (sessao:110 e :129 no celular), mesmas 2 falhas pré-existentes."

- timestamp: 2026-09-18T22:46Z
  checked: |
    Comparação com a versão que está NO AR: node_modules em next 15.5.22 (`npm install next@15.5.22 --no-save
    --legacy-peer-deps`), tsconfig.json de a6cbac5 e middleware.ts de daad36c (SEM a correção), mesma medição leve
    (40x por projeto, 8 workers). Depois restaurado: `git checkout -- middleware.ts tsconfig.json` + `npm install`
    (next 16.3.5, `npm ls next` ok, git status só com a sessão e as duas pastas não rastreadas esperadas).
  found: |
    '80 passed (1.5m)': desktop 40/40 LIMPO; celular 37/40 LIMPO e 3/40 com cookie PRESENTE (valor novo) em /login,
    goBack mostrando o painel e goto('/') novo terminando em url '/' (o middleware deixou passar = sessão aceita pelo
    servidor; o classificador marcou 'CONTEUDO_VELHO_CLIENTE' só porque o texto 'SEU DIA HOJE' ainda não estava visível
    no instante da leitura). Ou seja: 3/80 ressurreições reais na 15.5.22, todas no celular.
  implication: |
    O defeito JÁ ESTÁ EM PRODUÇÃO (15.5.22), mais raro: ~3/80 (celular ~7,5%) contra 28/80 na 16.3.5 sem correção. A
    16 dispara mais prefetch em volta do 'Sair' (2ª fase de segmentos), por isso a taxa sobe. Subir a 16 SEM a
    correção pioraria um defeito de segurança; subir COM a correção (a92c44c) o elimina.

- timestamp: 2026-09-18T22:48Z
  checked: "Reconfirmação na árvore restaurada (HEAD a92c44c, next 16.3.5): mesma medição leve, 40x por projeto."
  found: "'80 passed (55.0s)': 80/80 LIMPO. Somando as duas rodadas com a correção: 160/160 sem ressurreição."
  implication: "Guardrail revert-and-reconfirm: sem a correção 28/80 (22:25Z) e 28/80 com a regra inerte (22:31Z, 'mutante' que nunca dispara); com a correção 0/80 e 0/80."

## Specialist Review

- 2026-09-18T22:21Z (session-manager): specialist_hint `react` -> skill `typescript-expert`; nenhuma
  skill instalada nesta máquina (~/.claude/skills e .claude/skills vazios) — revisão de especialista
  não executada. Conferência feita pelo session-manager sobre faba475: peer deps OK (next-auth
  beta.32 aceita next ^16; next 16.3.5 aceita react ^19; node >=20.9 vs 24.19.0 no CI e no
  Dockerfile); `npm ls --depth=0` sem erro; CI usa `npm ci` (o docker build com `npm ci` passou).
  Ressalva do manager: a própria correção piora a taxa do WINDOWS #12 (sessao:110, 1/12 -> 5/12 e
  7/20). Se esse #12 for sessão que REALMENTE sobrevive à saída, subir a 16 piora um defeito de
  segurança — por isso o manager abriu um ciclo de continuação para confirmar/refutar antes de
  recomendar o push.
- 2026-09-18T22:51Z (session-manager): ressalva resolvida pelo ciclo 22:22Z — ressurreição
  CONFIRMADA (16.3.5 sem correção 28/80; 15.5.22 3/80) e corrigida em a92c44c (0/80 + 0/80).
  Revisão do diff de a92c44c pelo manager: o filtro só remove linhas `Set-Cookie` do token de sessão
  em GET com `Sec-Fetch-Dest: empty`; redirecionamento/proteção do middleware não mudam; remover
  também uma eventual linha de APAGAR o cookie num GET por fetch é inofensivo (o token inválido
  continua rejeitado e o próximo documento o apaga). Conferência independente na HEAD c42acb3:
  `node_modules/next` = 16.3.5; `npm run verificar` EXIT=0 (vitest 32 arquivos / 583 testes,
  test:migracoes ok); árvore limpa (só `.planning/phases/06-estoque/` e `Claude outputs/` fora do git).

## Resolution

root_cause: |
  Duas causas em conjunção (AND-gate), de categorias diferentes:

  (1) DEPENDÊNCIA — o React embutido no Next 15.5.x perde o 'ping' de um chunk Flight que resolve
  enquanto uma renderização está em andamento. Na navegação por <Link> (e em Server Action /
  router.refresh, ver sessão pai), o React suspende a transição num elemento 'outlined' do payload
  RSC (linhas preguiçosas `$L..` que o servidor cria quando a página tem muitos elementos); o chunk
  resolve, o aviso se perde, e as lanes de transição ficam SUSPENSAS PARA SEMPRE (FiberRoot:
  pending=suspended=0b111<<12, pinged=0, sem callback, sem commit suspenso), com a thread ociosa,
  sem erro, a URL parada e o DOM antigo. Medido direto (experimentos 4-7), com o thenable em que o
  React suspendeu já 'fulfilled'. A chance cresce com o tamanho da árvore nova: com 10 categorias
  na aba Cotações a troca de pílula trava em 100% das vezes na 15.5.22 (26/26), com <=5 nunca.
  É a mesma causa que a sessão pai (abertura-navegacao-trava) mediu e não conseguiu nomear — 'o
  React não confirma a transição, mais provável com mais Client Components' — e bate com os
  relatos upstream vercel/next.js #98303 e #98305. Não existe correção na linha 15.5 (a 15.5.25
  trava até com 3 categorias); a 16.3.x não tem o defeito (medido: 0 travas).

  (2) TESTE — portão falso em tests/e2e/cotacoes-categorias.spec.ts:128:
  `await expect(page).toHaveURL(/&categoria=[0-9a-f-]+$/)` já casava ANTES do clique na pílula A (a
  página estava em `&categoria=<C>`), então o teste seguia sem esperar a troca; '+ Nova cotação'
  abria o formulário da categoria C (prop do servidor), as duas cotações iam para C (conferido no
  Postgres, experimento 1) e a falha aparecia 17 linhas depois como 'Expected 2 Received 0'.

  Por que 3/3 no celular do CI: quando :94 roda, os testes de cotação dos dois projetos já criaram
  dezenas de categorias no banco da suíte — muitas pílulas, trava quase certa.

  Mecanismo real mas NÃO causal aqui (registrado para não reinvestigar): um `history.pushState`
  feito enquanto uma navegação RSC está em voo (ex.: '+ Nova cotação' via `irParaSemNavegar`) é
  interceptado pelo Next e despacha ACTION_RESTORE, que marca a navegação pendente como `discarded`
  (app-router-instance.js:131-134). O comentário de components/amassa/abertura/url-sem-navegar.ts
  ('escreve a URL sem transição') está errado para o Next: a URL do navegador muda na hora, mas
  `useSearchParams()` só muda quando essa ACTION_RESTORE confirma.

fix: |
  - package.json / package-lock.json: `next` 15.5.22 -> 16.3.5 (versão exata, dist-tag latest).
    Peer deps conferidos: next-auth 5.0.0-beta.32 aceita ^16; next 16.3.5 aceita react ^19.0.0 (o
    app segue em 19.1.0 — o App Router usa o React embutido no próprio Next); node >=20.9 (Dockerfile
    e local: 24.19.0). eslint-config-next MANTIDO em 15.5.22 (lint passa; trocar mudaria regras de
    lint, fora do escopo).
  - tsconfig.json: as duas mudanças que o `next build` da 16 grava sozinho (jsx 'react-jsx', include
    '.next/dev/types/**/*.ts') — versionadas para o build não sujar a árvore a cada execução.
  - tests/e2e/cotacoes-categorias.spec.ts: o portão falso vira
    `await expect(pilulaA).toHaveAttribute("aria-selected", "true")` — só passa quando a troca de
    categoria CONFIRMOU; se um dia travar de novo, o teste falha na linha certa.
  Nenhum timeout foi aumentado. Nenhum arquivo de produto mudou além da versão do framework.

verification:
  target_test: { result: pass, detalhe: "cotacoes-categorias:94 desktop+celular verdes na varredura completa #1 (16.3.5); reprodução determinística (10 pílulas) 5/5 + 3/3 confirmam na 16.3.5" }
  mutation_check: { result: skipped, reason_if_skipped: "Stryker não configurado no projeto; a correção principal é troca de versão de dependência (sem 'linha' para mutar). Substituto: experimento 1 variante B provou que o portão novo FALHA quando a navegação não confirma (3/3 com 'Received false')." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detalhe: "o diff não apaga comportamento: troca a versão do framework e FORTALECE uma asserção (a antiga não provava nada)" }
  adjacent_tests:
    result: pass
    suites_run:
      - "npm run verificar (2x, a última às 22:17Z sobre a árvore final): eslint limpo, tsc --noEmit limpo, verificar-acoes 32/0, vitest 31 arquivos/572 testes, test:migracoes ok"
      - "npm run test:e2e SEM --grep (varredura #1, 16.3.5): '3 failed | 33 skipped | 1 did not run | 413 passed (7.2m)'. As 3 falhas: autenticacao.spec.ts:84 desktop+celular (WINDOWS #3, pré-existente) e sessao.spec.ts:110 celular (WINDOWS #12, pré-existente — ver abaixo). Toda a família alvo verde nos dois projetos: cotacoes-categorias:94, abertura-edicao:165 e :234, encomendas-formulario:99, cotacoes-tracador:44."
      - "docker build -f docker/Dockerfile --target app (npm ci + next build no Alpine, Turbopack 16.3.5, saída standalone): EXIT=0. Aviso: 'The middleware file convention is deprecated. Please use proxy instead' — funciona, fica como pendência."
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detalhe: "22:14-22:16Z, mesma reprodução (generico.spec CASOS=10:0,10:0,6:0): REVERT para 15.5.22 -> 3/3 NUNCA confirmaram; REAPPLY 16.3.5 -> 3/3 confirmaram em 50ms." }
  guardrail_verdict: accepted
  oracle_type: specified
  comandos_e2e_rodados_nesta_sessao: |
    Harness de medição (fora da suíte, 1 build por invocação): supersessao, momento, contagem, fila,
    cpu, generico(A1), raiz, espera, espera2, generico(15.5.25), generico(16.3.5), saida,
    generico(revert 15.5.22), generico(reapply 16.3.5). Suíte do projeto: 1 varredura completa
    (`npm run test:e2e`), 4 `--grep "botao de voltar cai em /login" --repeat-each` (6, 6 na 15.5.22,
    10, 10) para o WINDOWS #12.
  verificacao_a92c44c_windows12:
    target_test: { result: pass, detalhe: "sessao.spec.ts:110 (com o goto novo em /) 20/20 com --repeat-each=10; medição leve 0/80 + 0/80 (antes 28/80)" }
    mutation_check: { result: pass, detalhe: "Stryker não configurado; substituto medido: a 1ª versão da regra (cabeçalho next-router-prefetch, que o Next remove antes do middleware) é um mutante que nunca dispara — com ela, 28/80 ressurreições (22:31Z), igual a sem correção. A asserção nova do :110 pega esse caso (goto novo cai no painel)." }
    no_op_deletion: { result: pass, deletion_justified_by_rca: true, detalhe: "o diff só acrescenta: filtra o Set-Cookie do token em GET por fetch(); nenhum comportamento apagado além da renovação especulativa" }
    adjacent_tests: { result: pass, detalhe: "npm run verificar EXIT=0 (32 arquivos/583 testes unitários); varredura completa '2 failed | 33 skipped | 415 passed (6.7m)' — as 2 falhas são autenticacao:84 (WINDOWS #3), iguais às da varredura #1, anterior à correção" }
    revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detalhe: "sem a correção: 28/80 (16.3.5) e 3/80 (15.5.22); com: 0/80 (22:34Z) e 0/80 na árvore restaurada (22:48Z)" }
    guardrail_verdict: accepted
    oracle_type: specified
    comandos_rodados_no_ciclo: "harness de medição em 6 invocações (16.3.5 sem correção; HAR; regra inerte; correção; 15.5.22 sem correção; HEAD restaurado), npm run verificar x1, npm run test:e2e --grep 'botao de voltar cai em /login' --repeat-each=10 x1, npm run test:e2e completo x1"
  pendencias_fora_do_escopo:
    - |
      WINDOWS #12 (sessao.spec.ts:110) — RESOLVIDO no ciclo 22:22Z, commit local a92c44c. Era RESSURREIÇÃO REAL da
      sessão, não conteúdo velho no cliente: medição leve (sem listeners), 16.3.5, 8 workers, 40x por projeto -> 28/80
      com o cookie de sessão PRESENTE (valor novo) ao chegar em /login e um `page.goto('/')` NOVO abrindo o painel
      protegido (celular 12/40, desktop 16/40); 0/80 casos de 'só conteúdo velho no cliente'. Na 15.5.22 (a que está no
      ar) sem correção: 3/80, todos no celular — o defeito já existe em produção, mais raro. Quem reemite: respostas de
      PREFETCH do roteador (HAR: 43/43 ressurreições com uma resposta de prefetch DEFINE chegando depois da resposta
      da saída 'DEFINE+APAGA'; 0/17 nos limpos), porque a sessão é JWT sem estado e o middleware do Auth.js reemite o
      token em toda resposta. Correção: o middleware não deixa a renovação sair em resposta a GET feito por fetch()
      (`Sec-Fetch-Dest: empty`); o Next tira `next-router-prefetch`/`rsc` da requisição antes do middleware, por isso
      a regra 'só prefetch' (1ª tentativa, 22:31Z) era inerte. Resultado: 0/80 e 0/80; sessao:110 20/20 (com a
      asserção nova do goto novo); verificar ok; varredura completa '2 failed | 33 skipped | 415 passed' (só
      autenticacao:84, WINDOWS #3). Atualizar o ledger WINDOWS #12 para 'fixed' quando o CI confirmar.
    - |
      Ponto cego da correção a92c44c (fechar em sessão própria, não urgente): ela tira o vetor MEDIDO (prefetch), mas
      a sessão continua sem estado no servidor. Uma Server Action de verdade (POST, que ainda renova) em voo no
      instante do 'Sair' ainda poderia devolver a sessão — exige tocar em salvar e em Sair em ~100-400ms; não medido.
      Fechamento completo = revogação no servidor (id de sessão no token + tabela de sessões encerradas, conferida em
      exigirUsuario()), o que pede migração (aplicada à mão, com backup) e decisão do dono sobre o modelo de sessão.
    - "Mudança de comportamento assumida em a92c44c: a sessão de 30 dias é renovada em carregamento de página e em Server Action, não mais em cada prefetch/navegação RSC. AUTH-05 ('persiste 30 dias ao fechar e reabrir') continua valendo — reabrir é sempre carregamento de página. Sem o cabeçalho Sec-Fetch-Dest (navegador antigo), renova como antes."
    - "middleware.ts está depreciado na 16 (renomear para proxy.ts com o codemod oficial) — funciona hoje, é aviso."
    - "Fechar no ledger WINDOWS #29, #30, #31 depois que o CI confirmar a correção (não mexi no ledger)."
    - "components/amassa/abertura/url-sem-navegar.ts: comentário diz que pushState não dispara transição — dispara (ACTION_RESTORE). Corrigir o comentário numa próxima passada."
    - "O botão 'Editar' da linha (ferramentas-linha.tsx) ainda abre por navegação RSC, fora do padrão D-23 que 'Remover' segue. Com a 16 não trava; fica como observação de consistência."

commit_local: "faba475 (versão do Next) + a92c44c (sair encerra a sessão mesmo com prefetch em voo) — NENHUM enviado; o push é do dono e leva os dois juntos"
files_changed:
  - package.json
  - package-lock.json
  - tsconfig.json
  - tests/e2e/cotacoes-categorias.spec.ts
  - "middleware.ts (a92c44c)"
  - "lib/auth/renovacao-sessao.ts (a92c44c, novo, módulo puro)"
  - "tests/unit/renovacao-sessao.test.ts (a92c44c, novo, 10 testes)"
  - "tests/e2e/sessao.spec.ts (a92c44c, :110 confere um documento novo em / depois da saída)"

nota_para_o_dono_sobre_o_push: |
  Pode fazer o push. Ele leva junto duas correções: a atualização do Next.js (faba475) e uma correção
  no "Sair" (a92c44c). As duas precisam ir juntas — e vão, porque estão em sequência na main.

  O que descobri sobre o "Sair": em algumas saídas, a sessão NÃO acabava de verdade. Se alguém
  abrisse a plataforma de novo no mesmo aparelho, o painel aparecia sem pedir senha. Isso já
  acontece hoje no ar (medi 3 em 80 saídas, todas no celular). Com o Next.js novo, sem a correção,
  ficaria bem pior (28 em 80). O motivo: logo depois do toque em "Sair", o navegador ainda estava
  carregando páginas em segundo plano (o Next faz isso para a navegação ficar rápida), e a resposta
  dessas cargas, chegando depois da saída, devolvia a sessão.

  A correção: essas cargas em segundo plano não renovam mais a sessão. A sessão de 30 dias continua
  sendo renovada quando você abre a plataforma ou salva qualquer coisa. Depois da correção, 160 de 160
  saídas medidas encerraram a sessão de verdade, e todos os testes automáticos passaram, menos um
  que já falhava antes e não tem relação com isto (o bloqueio depois de várias senhas erradas).

  Depois do push, vale conferir no celular: entrar, tocar em "Sair", fechar a aba, abrir de novo o
  endereço da plataforma — tem que pedir o login.

resumo_para_o_dono: |
  O que travava o deploy não era um defeito do nosso código, e sim da versão do Next.js que a
  plataforma usava (15.5). Nessa versão, às vezes o toque num link chega ao servidor, a resposta
  volta certinha, mas a tela simplesmente não troca — sem erro nenhum. Consegui fazer isso
  acontecer TODA vez de propósito (com 10 categorias no Comparador de Compras, tocar numa
  categoria nunca trocava a tela), o que permitiu medir a causa em vez de adivinhar. Atualizei o
  Next.js para a versão 16.3.5: o mesmo teste passou a funcionar toda vez, e a suíte inteira de
  testes automáticos rodou verde nessa família de problemas (troca de categoria, abrir "Editar",
  fechar formulário). Também corrigi um teste que "passava sem verificar nada" e escondia o
  problema. Nada muda na aparência da plataforma.

  [Atualizado no ciclo 22:22Z] O ponto do "Sair" que tinha ficado em aberto foi medido e corrigido
  no mesmo dia — ver `nota_para_o_dono_sobre_o_push` abaixo. Nada foi enviado ao servidor: os
  commits são só locais; o deploy acontece quando você fizer o push.

## Apêndice — reprodução determinística (a harness vivia num scratchpad de sessão; cópia aqui)

Uso (da raiz do repo, sem tocar arquivo nenhum do repo): salvar os dois arquivos numa pasta fora do
repo cuja `node_modules` seja uma junção para a do repo, trocar `<raiz-do-repo>` pelo caminho real e
rodar `CASOS="10:0,10:0,3:0" node scripts/testar-e2e.mjs --config "<pasta>/generico.config.ts"`.
Na 15.5.22: N=10 nunca confirma, N=3 confirma. Na 16.3.5: tudo confirma.

Instrumentação dos experimentos 4-7 (resumo): um `__REACT_DEVTOOLS_GLOBAL_HOOK__` mínimo via
`page.addInitScript` guarda o FiberRoot em `onCommitFiberRoot`; o `actionQueue` do Next é achado
varrendo o fiber por `memoizedProps.actionQueue`, e `actionQueue.action` é embrulhado para registrar
cada ação; os thenables em que o React suspende são capturados embrulhando `WeakMap.prototype.set`
(o pingCache guarda wakeable -> Set). NÃO chamar `.then()` nos thenables capturados: isso muda o
resultado (Heisenbug medido no experimento 7).

generico.config.ts:
```ts
import { defineConfig, devices } from "@playwright/test";

// Experimento da sessão e2e-toque-nao-navega-ci: a navegação da pílula é CANCELADA por um
// pushState feito enquanto ela está em voo? Fora da suíte do projeto (nenhum arquivo do repo muda).
export default defineConfig({
  testDir: ".",
  testMatch: /generico.spec\.ts$/,
  globalSetup: "<raiz-do-repo>/tests/e2e/apoio/preparar-usuario.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "celular", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run build && npm run start",
    cwd: "<raiz-do-repo>",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "",
      AUTH_SECRET: "segredo-de-teste-efemero-sem-valor-real",
      AUTH_TRUST_HOST: "true",
    },
  },
});
```

generico.spec.ts:
```ts
import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

// Reprodução determinística (experimentos 3-5): zera as categorias, semeia N, abre a ÚLTIMA por
// goto, clica na pílula de índice `alvo`, espera 5s pelo aria-selected. CASOS="10:0,10:0,3:0".

async function sql<T = unknown>(q: string, p: unknown[] = []): Promise<T[]> {
  const cl = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cl.connect();
  try {
    return (await cl.query(q, p)).rows as T[];
  } finally {
    await cl.end();
  }
}

async function zerarESemear(n: number) {
  await sql("delete from cotacoes");
  await sql("delete from cotacao_categorias");
  const out: { id: string; nome: string }[] = [];
  for (let i = 0; i < n; i++) {
    const nome = `[exp] Cat${i} ${Math.random().toString(36).slice(2, 6)}`;
    const [r] = await sql<{ id: string }>("insert into cotacao_categorias (nome) values ($1) returning id", [nome]);
    out.push({ id: r.id, nome });
  }
  return out;
}

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

const casos = (process.env.CASOS ?? "10:0,10:0,10:0,3:0").split(",").map((c) => {
  const [n, alvo] = c.split(":").map(Number);
  return { n, alvo };
});

let k = 0;
for (const caso of casos) {
  const idx = ++k;
  test(`N=${caso.n} alvo=${caso.alvo} #${idx}`, async ({ page }) => {
    await fazerLogin(page);
    const cats = await zerarESemear(caso.n);
    const origem = cats[cats.length - 1];
    const alvo = cats[caso.alvo];
    await page.goto(`/abertura?aba=cotacoes&categoria=${origem.id}`);
    const pilula = page.getByTestId("cotacoes-sub-aba").filter({ hasText: alvo.nome });
    await expect(pilula).toBeVisible();
    await expect
      .poll(() => pilula.evaluate((el) => Object.keys(el).some((x) => x.startsWith("__reactProps"))))
      .toBe(true);
    await page.waitForTimeout(500);
    await pilula.click();
    let ms = -1;
    for (let t = 0; t < 5000; t += 50) {
      if ((await pilula.getAttribute("aria-selected")) === "true") {
        ms = t;
        break;
      }
      await page.waitForTimeout(50);
    }
    console.log(
      `RESULTADO | ${process.env.ROTULO ?? ""} | N=${caso.n} alvo=${caso.alvo} #${idx} | ${ms >= 0 ? `CONFIRMOU ${ms}ms` : "NUNCA CONFIRMOU 5s"} | url=${page.url().includes(alvo.id) ? "mudou" : "parada"}`,
    );
  });
}
```

## Apêndice B — medição da ressurreição da sessão (WINDOWS #12, ciclo 22:22Z)

Uso: mesma técnica do Apêndice A (pasta fora do repo com `node_modules` em junção para a do repo).
`REPS=40 WORKERS=8 ROTULO=x node scripts/testar-e2e.mjs --config "<pasta>/ressurreicao.config.ts"`.
A config é a do Apêndice A com `testMatch: /ressurreicao.spec\.ts$/`, `fullyParallel: true`,
`workers: Number(process.env.WORKERS ?? 8)`, `timeout: 60_000` e os dois projetos (celular = Pixel 7,
desktop = Desktop Chrome). Resultados: 16.3.5 sem correção 28/80 RESSURREICAO_REAL; com a correção 0/80.
A variante de identificação (ressurreicao-har.spec.ts) cria o contexto com
`browser.newContext({ ...devices[...], recordHar: { path, content: "omit", mode: "full" } })`, faz o mesmo
fluxo sem o goBack e lê do HAR cada resposta com `Set-Cookie` do token, com o instante de chegada dos
cabeçalhos (startedDateTime + blocked+dns+connect+send+wait) relativo ao clique em Sair.

ressurreicao.spec.ts:
```ts
import { test, expect, type Page, type Cookie } from "@playwright/test";

// WINDOWS #12 (sessao.spec.ts:110) — medição LEVE: nenhum listener de request/response.
// Por repetição (contexto novo do Playwright): login -> Sair (fluxo exato do :110) -> cookies ao
// chegar em /login -> goBack e as MESMAS asserções do spec -> cookies -> page.goto('/') NOVO
// (documento novo, sem histórico/cache) no mesmo contexto -> cookies.
// 'cookie presente + goto mostra o painel' = ressurreição REAL da sessão;
// 'cookie ausente + goto -> /login, mas o goBack mostrou o painel' = conteúdo velho no cliente.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function abrirMenuDoUsuario(page: Page) {
  const gatilhoCelular = page.getByRole("button", { name: "Abrir menu do usuário" });
  const gatilhoDesktop = page.locator('[data-slot="sidebar-footer"] button').first();
  if (await gatilhoCelular.isVisible()) await gatilhoCelular.click();
  else await gatilhoDesktop.click();
}

function sessao(cookies: Cookie[]) {
  return cookies.find((c) => c.name.endsWith("session-token"))?.value ?? null;
}
function desc(v: string | null, login: string | null) {
  if (!v) return "AUSENTE";
  return v === login ? "PRESENTE(=login)" : "PRESENTE(novo)";
}

const REPS = Number(process.env.REPS ?? 40);
for (let i = 0; i < REPS; i++) {
  test(`ressurreicao #${i}`, async ({ page, context }, info) => {
    await fazerLogin(page);
    await expect(page.getByRole("heading", { name: /^Olá, / })).toBeVisible();
    const cLogin = sessao(await context.cookies());

    await abrirMenuDoUsuario(page);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
    const cNaLogin = sessao(await context.cookies());

    await page.goBack();
    let voltar = "OK";
    try {
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(page.getByText("SEU DIA HOJE")).not.toBeVisible();
    } catch {
      voltar = "FALHOU";
    }
    const urlVoltar = new URL(page.url()).pathname;
    const painelVoltar = await page.getByText("SEU DIA HOJE").isVisible();
    const cVoltar = sessao(await context.cookies());

    await page.goto("/");
    const urlGoto = new URL(page.url()).pathname;
    const painelGoto = await page.getByText("SEU DIA HOJE").isVisible();
    const cGoto = sessao(await context.cookies());

    const real = cGoto && painelGoto;
    const classe = real ? "RESSURREICAO_REAL" : voltar === "FALHOU" ? "CONTEUDO_VELHO_CLIENTE" : "LIMPO";
    console.log(
      `RESULTADO | ${process.env.ROTULO ?? ""} | ${info.project.name} | #${i} | ${classe} | naLogin=${desc(cNaLogin, cLogin)} | voltar=${voltar} url=${urlVoltar} painel=${painelVoltar} cookie=${desc(cVoltar, cLogin)} | gotoRaiz url=${urlGoto} painel=${painelGoto} cookie=${desc(cGoto, cLogin)}`,
    );
  });
}
```
