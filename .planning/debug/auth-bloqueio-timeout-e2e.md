---
status: investigating
trigger: "Investigar e corrigir a falha e2e de longa data em tests/e2e/autenticacao.spec.ts —
  'a sexta tentativa seguida no mesmo e-mail mostra a mensagem de bloqueio com os minutos' —
  que supostamente barra deploys. Ledger: WINDOWS.md #3 (fase 02b, aberto desde 2026-08-08) e
  #24 (fase 04.2, fechado como 'fixed' sem correção de código real). Falhou hoje (2026-09-20)
  em runs de CI, mais recente https://github.com/adcaponte/amassa/actions/runs/35508463753,
  desktop, autenticacao.spec.ts:84, 2.0m, 'Test timeout of 120000ms exceeded' em
  page.waitForResponse. Regra de negócio (AUTH-04, cinco erros bloqueiam 15min) não pode ser
  enfraquecida. Hipótese a verificar: seis conferências reais de argon2id por tentativa
  sequencial custam caro sob carga de CI."
created: 2026-09-20T12:00:00Z
updated: 2026-09-20T12:46:15Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

**CHECKPOINT — decisão do dono necessária antes de qualquer mudança em código de produção.**

hypothesis: |
  Hipótese ORIGINAL da tarefa (custo do argon2id × 6 tentativas sequenciais) foi MEDIDA e
  REFUTADA — ver Eliminated. A hipótese líder agora é: espera SEM LIMITE por uma conexão do
  pool do Postgres (`db/index.ts` não define `connectionTimeoutMillis`, que por padrão do
  `pg-pool` é 0 = espera infinita) combinada com contenção real de CPU/rede no runner do CI
  (4 vCPUs compartilhadas entre Postgres, o servidor da app e dois navegadores Chromium reais
  rodando 634 testes). Isso bate com TODA a evidência histórica (ver Evidence), mas não foi
  reproduzida diretamente apesar de três tentativas honestas de reprodução sob carga real e
  sintética — por isso este é um CHECKPOINT, não uma causa raiz confirmada.
test: "Ver as três tentativas de reprodução em Evidence. Nenhuma reproduziu a trava real."
expecting: "N/A — aguardando decisão do dono sobre os dois caminhos possíveis descritos abaixo."
next_action: |
  Apresentar ao dono os achados (ver corpo da mensagem de retorno) e as duas opções de
  mitigação, ambas exigindo mudança em código de produção (nenhuma delas enfraquece AUTH-04):
  (A) limitar `connectionTimeoutMillis` no pool do `pg` (db/index.ts) — falha rápida e visível
  em vez de travar sem limite; a retentativa que o CI já tem (`retries: 2`) absorve o caso raro
  em segundos, como já aconteceu hoje mesmo com a retentativa #1 do teste (1.9s, passou). (B)
  reduzir de 6 para 1 as idas e vindas reais pela UI no teste de bloqueio, semeando as cinco
  primeiras tentativas por um caminho direto de teste (não enfraquece a regra: os cinco erros
  continuam reais, só o TRANSPORTE muda) — também exige uma pequena superfície nova de código,
  então também precisa de aval. Se o dono aprovar (A), (B), ou ambas, um agente de continuação
  implementa, roda `npm run verificar` + o `--grep "autenticação"` necessário, e fecha a sessão.
  Se o dono preferir não mudar nada agora, registrar a decisão aqui e fechar como aceito como
  débito monitorado (a retentativa do CI já absorve o caso na prática, como mostrado hoje).

## Symptoms

expected: |
  AUTH-04: errar a senha 5 vezes no mesmo e-mail em 15 minutos bloqueia esse e-mail por 15
  minutos; a sexta tentativa mostra a mensagem de bloqueio com os minutos restantes, na UI real,
  nos dois projetos (desktop e celular). O teste faz isso com um e-mail fictício e exclusivo,
  cinco POSTs reais com senha errada (confirmando a mensagem única de credencial inválida em
  cada um) e um sexto POST que deve mostrar a mensagem de bloqueio.
actual: |
  Na maior parte das execuções (locais e em CI), o teste passa em ~1-2 segundos para as seis
  idas e vindas. Ocasionalmente — sem padrão determinístico conhecido — uma das chamadas ao
  servidor não retorna dentro do timeout configurado do teste (testado historicamente com 30s,
  60s, 90s e, atualmente, 120s — nenhum desses valores mudou o resultado: ou o teste passa em
  segundos, ou trava até o teto configurado, nunca em algo intermediário). Em CI, com
  `retries: 2` (só em CI; local é 0), a retentativa seguinte tipicamente passa em segundos.
errors: |
  `Error: page.waitForResponse: Test timeout of 120000ms exceeded.` em
  tests/e2e/autenticacao.spec.ts:114 (dentro do loop das cinco primeiras tentativas, ou na
  sexta — a run de hoje foi na primeira tentativa do teste, antes da retentativa).
reproduction: |
  Não determinística. Rodar `npm run test:e2e -- --grep "autenticação"` isoladamente NUNCA
  reproduziu a trava (nesta sessão nem em sessões anteriores documentadas). Só apareceu,
  historicamente, sob a carga da suíte completa (com ou sem retentativa dependendo do
  ambiente) — mas mesmo três tentativas de reprodução sob carga completa/sintética nesta sessão
  não conseguiram forçar a trava (ver Evidence).
started: |
  WINDOWS.md #3: fase 02b, 2026-08-08 (T-02a-14, comentário original do teste já reconhecia o
  risco). Nunca resolvido de fato — #24 (04.2, 2026-08-31) foi fechado como "fixed" no ledger
  sem nenhuma mudança de código relacionada (confirmado lendo 04.2-05-SUMMARY.md e o histórico
  de commits). O padrão se repete em quase toda fase desde então (relatado como pré-existente
  em 04.3, 04.4 e na sessão de depuração e2e-toque-nao-navega-ci.md de 2026-09-19, mesmo já
  com o Next.js 16.3.5).

## Eliminated

- hypothesis: |
    O custo computacional de seis conferências reais de argon2id em sequência (parâmetros
    padrão do @node-rs/argon2: memoryCost 4096 KiB, timeCost 3, parallelism 1) é alto o
    suficiente, sob a carga da suíte completa em CI, para estourar mesmo um timeout de 120s.
  evidence: |
    Medido diretamente com instrumentação temporária em `authorize()` (timestamps antes/depois
    de `avaliarPedidoAgora`, da consulta `db.select()` e de `avaliarCredenciais` — que chama
    `conferirHash`), rodando contra um servidor `standalone` (idêntico ao alvo `app` do
    Dockerfile, não o `next start` — que tem incompatibilidade conhecida com
    `output: "standalone"`, ver quick 260811-2jb) e a suíte completa local (634 testes, 2
    workers — o MESMO número de workers da run de CI de hoje, confirmado no log: "Running 634
    tests using 2 workers"):
      - Sem nenhuma carga: 6 tentativas reais em 147+93+91+81+75+57 = 544ms (a sexta é barata
        de propósito: `avaliarPedidoAgora` recusa ANTES de tocar o banco ou o hash).
      - Sob a suíte completa (2 workers, 634 testes, ~10 minutos de corrida): AUTH_TIMING do
        servidor mostra cada `avaliarCredenciais(hash)` em 22-43ms e cada `db_select` em 1-18ms;
        os dois testes reais de bloqueio (desktop e celular) passaram em 1.2s cada. `npm run
        verificar`-equivalente e a suíte inteira: **0 falhas, 599 passed, 35 skipped** (nenhuma
        falha em `autenticacao.spec.ts` nesta corrida).
    Custo real por tentativa (~25-150ms) é ordens de grandeza menor que o teto de 120s, mesmo
    sob a mesma contagem de workers do CI. A hipótese original da tarefa está refutada pelos
    números.
  timestamp: 2026-09-20T12:35:50Z

## Evidence

- timestamp: 2026-09-20T11:50:00Z
  checked: |
    `gh run view 35508463753 --log` (log completo da run de CI mais recente, baixado para
    análise local em vez de confiar só no resumo).
  found: |
    A run tem DUAS falhas distintas, não uma: (1) `autenticacao.spec.ts:84` [desktop] falhou na
    tentativa original (2.0m, timeout) mas **passou na retentativa #1 em 1.9s** — Playwright
    classificou como "1 flaky", não "1 failed". (2) `acessibilidade.spec.ts:219` [celular] —
    varredura de contraste axe-core em `/cadastros?sub=fixas` — falhou **três vezes seguidas**
    (original + 2 retentativas esgotadas), de forma determinística, e É esse o "1 failed" que
    de fato barrou o job (`Process completed with exit code 1`). O "1 did not run" é outro
    teste que nunca chegou a rodar por causa do tempo consumido pela cadeia de
    retentativas/timeout, não relacionado ao teste de autenticação.
  implication: |
    A run de CI mais recente NÃO foi bloqueada pelo teste de bloqueio de login — foi bloqueada
    por um problema de contraste de acessibilidade, completamente não relacionado, e
    determinístico (não flaky). O teste de autenticação se comportou exatamente como desenhado:
    falhou uma vez sob contenção, e a retentativa (`retries: 2`, só em CI) absorveu o caso.
- timestamp: 2026-09-20T11:55:00Z
  checked: |
    `gh run view 35500761873 --log` (a outra falha de hoje, 08:52 UTC, "docs(state): parada da
    Fase 04.4 no checkpoint do dono").
  found: |
    Falhou em 2m41s, muito antes de chegar perto de `autenticacao.spec.ts` na ordem de execução
    — `[vazio-celular] cadastros-contas-fixas.spec.ts:81` e `financeiro-caixa.spec.ts:67`
    (ambos sobre estado vazio) falharam de forma determinística 3/3 vezes cada, derrubando 604
    testes em cascata (dependência de projeto: `vazio-celular → vazio-desktop → ...`).
    `autenticacao.spec.ts` nunca chegou a rodar nesta run.
  implication: |
    Nenhuma das duas falhas de CI de hoje foi de fato causada por `autenticacao.spec.ts`. A
    premissa da tarefa ("falhou duas vezes hoje e bloqueou o deploy nas duas") está correta
    quanto ao RESULTADO (dois deploys bloqueados), mas a ATRIBUIÇÃO da causa a
    `autenticacao.spec.ts` está incorreta para as duas runs — provavelmente porque o teste de
    bloqueio é o mais chamativo no log (2.0m de duração, timeout explícito) mesmo quando não é
    o motivo real do "exit code 1". Isso não invalida o pedido do dono de corrigir o defeito
    real e de longa data (WINDOWS #3 está aberto desde 2026-08-08 e nunca foi corrigido de
    fato) — só corrige o diagnóstico de QUAL falha bloqueou QUAL run especificamente hoje.
- timestamp: 2026-09-20T12:00:00Z
  checked: |
    `lib/auth/senha.ts`, `lib/auth/credenciais.ts`, `lib/auth/auth.ts`, `lib/auth/tentativas.ts`,
    `lib/auth/tentativas-memoria.ts` — leitura completa da cadeia real de `authorize()`.
  found: |
    A sexta tentativa (a que mostra a mensagem de bloqueio) NUNCA toca o banco nem o hash — 
    `avaliarPedidoAgora` recusa e lança `ErroBloqueado` antes do passo 2. Só as cinco primeiras
    tentativas fazem `db.select()` + `conferirHash()` reais. `@node-rs/argon2` 2.0.2, `hash()`
    sem opções explícitas usa os padrões do binding nativo: memoryCost 4096 KiB, timeCost 3,
    parallelism 1 (confirmado em `node_modules/@node-rs/argon2/index.d.ts`) — não são
    parâmetros "caros" (bem abaixo de perfis tipo OWASP para hashing interativo).
  implication: |
    O ponto de maior custo por requisição (o hash) é modesto por padrão; a exposição real do
    teste é "5 idas e vindas de rede a um servidor único", não "6 hashes caros".
- timestamp: 2026-09-20T12:10:00Z
  checked: |
    `db/index.ts` (pool de conexão do Postgres usado por toda a aplicação).
  found: |
    `new Pool({ connectionString: process.env.DATABASE_URL })` — sem `max` explícito (padrão do
    `pg-pool`: 10) e sem `connectionTimeoutMillis` explícito. Lido o código-fonte de
    `node_modules/pg-pool/index.js`: quando `connectionTimeoutMillis` é falso/0 (nosso caso), a
    espera por um cliente livre do pool (ou por uma nova conexão) **não tem limite nenhum** —
    fica na fila até uma conexão ser liberada, por quanto tempo for. Há muitos `db.transaction()`
    em `lib/*/acoes.ts` (abertura, cadastros, cotacoes, encomendas, financeiro, queimas) que
    seguram uma conexão do pool pela duração da transação.
  implication: |
    Existe um caminho concreto, no código de hoje, para uma espera SEM LIMITE por uma conexão
    de banco — que bate exatamente com o padrão observado (raise do timeout do TESTE nunca
    muda o resultado, porque o limite real não é o do teste, é "zero" no lado do servidor).
    Candidato a causa raiz, mas ver as três tentativas de reprodução abaixo — nenhuma confirmou
    isso diretamente contra ESTE mecanismo específico.
- timestamp: 2026-09-20T12:25:00Z
  checked: |
    Tentativa de reprodução 1 — suíte completa local (634 testes, `--workers=2`, mesma
    contagem de workers do CI) contra o servidor `standalone` real (não `next start`),
    instrumentado com AUTH_TIMING.
  found: 0 falhas, 599 passed, 35 skipped. autenticacao.spec.ts:84 passou em 1.2s nos dois
    projetos. Ver detalhes em Eliminated.
  implication: |
    Carga real de 634 testes/2 workers, numa máquina de 16 núcleos, não reproduz a trava. Ou a
    trava exige contenção mais severa que a que 16 núcleos conseguem produzir sob esta carga,
    ou depende de alguma característica específica do runner do GitHub Actions (4 vCPUs
    compartilhadas) que este ambiente não reproduz.
- timestamp: 2026-09-20T12:40:00Z
  checked: |
    Tentativas de reprodução 2 e 3 — exaustão sintética e direta do pool de conexão: uma rota
    de diagnóstico TEMPORÁRIA (`app/api/health/debug-segurar-conexao/route.ts`, removida antes
    de fechar a sessão) que segura uma transação real (`select pg_sleep(N)`) por N segundos.
    Disparadas 10 chamadas concorrentes (= `pool.max`) segurando por 6-8s cada, confirmado via
    `pg_stat_activity` que as 10 conexões reais do Postgres ficaram ocupadas o tempo todo;
    durante essa janela, rodado o teste sequencial de 6 tentativas de login contra o MESMO
    servidor.
  found: |
    As 6 tentativas de login completaram em 1.2-1.8s, SEM esperar pela liberação do pool
    exaurido pela rota de diagnóstico — nenhuma fila observada. `pg_stat_activity` mostrou só
    as 10 conexões da rota de diagnóstico ocupadas; a consulta do login não apareceu competindo
    por elas dentro da janela observada.
  implication: |
    Ou o pool de conexão NÃO é um singleton verdadeiramente compartilhado entre todas as rotas
    nesta build (Next.js 16.3.5 + Turbopack, saída `standalone` — plausível que rotas/Server
    Actions em "chunks" diferentes do build instanciem `db/index.ts` separadamente, cada uma
    com seu próprio `pool.max=10`), ou a hipótese de exaustão de pool como ESTE mecanismo
    específico está incompleta. Não é uma refutação total da hipótese (a autenticação pode ter
    seu PRÓPRIO orçamento de até 10 conexões, que sob a carga agregada de MUITAS rotas
    diferentes rodando ao mesmo tempo em CI poderia, ele mesmo, esgotar) — mas não é uma
    confirmação direta, e o achado sobre pools possivelmente não-compartilhados entre rotas é
    novo e não estava mapeado antes desta sessão.

## Resolution

root_cause: |
  NÃO CONFIRMADA com evidência direta. Hipótese eliminada: custo do argon2id (refutada com
  números). Hipótese líder, mas não comprovada por reprodução direta: espera sem limite
  (`connectionTimeoutMillis` ausente, padrão 0 = infinito) por uma conexão do pool do Postgres
  em `db/index.ts`, sob contenção real de recursos específica do runner do GitHub Actions (4
  vCPUs compartilhadas entre Postgres, app e 2 navegadores reais), que não foi possível
  reproduzir localmente em três tentativas honestas (carga real de 634 testes/2 workers; e
  exaustão sintética direta do pool via 10 conexões seguradas por 6-8s). Consistente com toda a
  evidência histórica (raise do timeout do teste nunca mudou o resultado; padrão binário
  rápido-ou-trava-no-teto; nunca reproduzido localmente; auto-recuperação via retentativa do
  CI). Achado novo e não totalmente explorado: a rota de diagnóstico usada na tentativa 2/3
  sugere que pools de conexão podem NÃO ser verdadeiramente compartilhados entre diferentes
  rotas/Server Actions nesta build — mereceria uma investigação própria, fora do escopo desta
  sessão.
fix: |
  NENHUMA mudança de código de produção foi aplicada nesta sessão — ver Current Focus para as
  duas opções levantadas (limitar connectionTimeoutMillis no pool; reduzir de 6 para 1 as idas
  e vindas reais pela UI), ambas pendentes de decisão do dono porque tocam código de produção
  fora do arquivo de teste, e a instrução explícita da tarefa foi não decidir isso sozinho.
verification: |
  N/A — sem fix aplicado. Toda a instrumentação e código de diagnóstico temporário (rota
  `app/api/health/debug-segurar-conexao`, logs AUTH_TIMING em `lib/auth/auth.ts`) foi revertida;
  `git status` confirma árvore de trabalho limpa antes do checkpoint.
files_changed: []
