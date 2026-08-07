---
phase: 02a-login-banco-base-e-backup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - db/schema.ts
  - db/migrations/
  - lib/auth/auth.config.ts
  - lib/auth/auth.ts
  - lib/auth/rotas-publicas.ts
  - lib/auth/senha.ts
  - middleware.ts
  - app/api/auth/[...nextauth]/route.ts
  - app/(auth)/login/page.tsx
  - app/(app)/page.tsx
  - app/page.tsx
  - scripts/criar-usuario.ts
  - playwright.config.ts
  - tests/e2e/apoio/preparar-usuario.ts
  - tests/e2e/fundacao.spec.ts
  - tests/unit/rotas-publicas.test.ts
  - tests/unit/auth-borda.test.ts
  - .github/workflows/entrega.yml
autonomous: false
requirements: [AUTH-01, AUTH-02, AUTH-07, AUTH-09]

estimate:
  tokens: 78000
  raw_tokens: 78000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Abrir `/` sem sessão leva para `/login` (critério 1 do ROADMAP)"
    - "Entrar com e-mail e senha de uma conta criada pelo script dá acesso a `/`"
    - "Rodar o script de criação de conta imprime uma senha forte uma única vez e sai 0"
    - "O `middleware.ts` carrega sem erro de módulo nativo — a divisão `auth.config.ts` / `auth.ts` está correta (critério 6 do ROADMAP)"
  artifacts:
    - lib/auth/auth.config.ts
    - lib/auth/auth.ts
    - lib/auth/rotas-publicas.ts
    - lib/auth/senha.ts
    - middleware.ts
    - app/api/auth/[...nextauth]/route.ts
    - app/(auth)/login/page.tsx
    - app/(app)/page.tsx
    - scripts/criar-usuario.ts
    - tests/unit/auth-borda.test.ts
  key_links:
    - "`middleware.ts` importa APENAS `lib/auth/auth.config.ts` — nunca `lib/auth/auth.ts`"
    - "`lib/auth/auth.ts` é o único módulo que junta o provedor de credenciais, o hash e o banco"
    - "`scripts/criar-usuario.ts` roda pelo estágio `ferramentas`, nunca pela imagem `app`"
    - "A tabela `usuarios` do Drizzle é a mesma que o `authorize` consulta e que o script grava"

coverage:
  - id: D1
    description: "Abrir qualquer endereço sem estar logado leva para /login"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/fundacao.spec.ts#sem sessao a raiz redireciona para /login"
        status: unknown
    human_judgment: false
  - id: D2
    description: "Entrar com e-mail e senha dá acesso ao sistema"
    requirement: "AUTH-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fundacao.spec.ts#entrar com a conta criada pelo script abre a raiz"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Criar um usuário por linha de comando funciona e imprime uma senha forte uma única vez"
    requirement: "AUTH-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/apoio/preparar-usuario.ts — o globalSetup do Playwright cria a conta rodando o proprio script e lê a senha impressa"
        status: unknown
    human_judgment: false
  - id: D4
    description: "A tabela usuarios tem a coluna ativo e nenhum caminho de código apaga uma linha de usuário"
    requirement: "AUTH-09"
    verification:
      - kind: unit
        ref: "tests/unit/auth-borda.test.ts#nenhum modulo de autenticacao emite delete sobre usuarios"
        status: unknown
    human_judgment: false
  - id: D5
    description: "O middleware.ts carrega sem erro de módulo nativo no runtime Edge — a divisão auth.config.ts / auth.ts está correta"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "tests/unit/auth-borda.test.ts#auth.config.ts nao alcanca hash, banco nem authorize"
        status: unknown
      - kind: integration
        ref: "npm run build com middleware.ts presente"
        status: unknown
    human_judgment: false
  - id: D6
    description: "Os três pacotes novos (autenticação, hash, validação) foram conferidos como legítimos no registro público antes da instalação"
    requirement: "AUTH-02"
    verification: []
    human_judgment: true
    rationale: "Legitimidade de pacote é julgamento humano sobre o registro público (autoria, downloads, repositório de origem). Não há RESEARCH.md nesta fase — a pesquisa está desativada por configuração do projeto — logo o portão de legitimidade cai no caminho de fallback [ASSUMED], que nunca é auto-aprovável."
---

<objective>
Provar de ponta a ponta o caminho de autenticação do AMASSA: a migração cria `usuarios`, o
script cria uma conta no servidor, a tela de login autentica, o middleware protege o resto e
uma rota protegida abre. É o **tracer** desta fase — a fatia mais fina que atravessa todas as
camadas que a 2a vai mexer, com verificação de verdade em cada ponta.

Purpose: a divisão `auth.config.ts` / `auth.ts` é, por escrito, o erro mais provável desta fase
(`01-ARQUITETURA.md` §4). Provar a arquitetura inteira num caminho só, agora, custa um commit;
descobrir o erro depois de dez camadas prontas custa a fase.

Output: `usuarios` no banco, a configuração de autenticação dividida em dois arquivos, o
middleware, a tela de login mínima, uma rota protegida, o script `criar-usuario` e os testes
que provam cada um dos quatro.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
</context>

<constraints>
Decisões travadas que valem para TODAS as tarefas deste plano:

- **D-03: nenhum componente shadcn é instalado nesta fase.** A tela de login usa HTML e classes
  utilitárias do Tailwind, como `app/page.tsx` da Fase 1. A Fase 2b reestiliza.
- **D-04/D-05/D-06: nenhuma fonte é carregada nesta fase.** Nenhum arquivo de fonte licenciada
  entra no repositório, nunca.
- **D-07: nenhum nome ou e-mail real** aparece em arquivo nenhum. Onde um exemplo for
  necessário, use nomes inventados e o domínio reservado `exemplo.test`.
- Prosa, mensagens de erro e nomes de tabela e coluna em **português do Brasil**.
  Identificadores de código (variáveis, funções, tipos) em inglês.
- TypeScript estrito. `any` só com comentário justificando.
- `npm run lint` e `npm test` continuam saindo 0 ao fim de cada tarefa.
</constraints>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Tarefa 1: Conferir a legitimidade dos três pacotes antes de instalar</name>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §2 (a lista de tecnologias e a seção "O que **não**
      usar") e §4 (Auth.js v5, o provedor de credenciais e o hash argon2id)
    - `package.json` (as versões fixadas hoje e o padrão de fixação sem faixa já em uso)
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md`, lista de decisões fechadas
      (a exigência de fixar a versão exata da biblioteca de autenticação)
  </read_first>
  <what-built>
    Nada ainda. Este é o portão de legitimidade de pacote, obrigatório antes de qualquer
    instalação pelo gerenciador de pacotes. A pesquisa está desativada por configuração do
    projeto, então não existe `RESEARCH.md` com a tabela de auditoria — o que joga os três
    pacotes no caminho de fallback `[ASSUMED]`, e `[ASSUMED]` nunca é auto-aprovável.

    Os três pacotes são nomeados por escrito em `amassa-plataforma/01-ARQUITETURA.md` §2 e §4:

    | Pacote | Para quê | Página a conferir |
    |---|---|---|
    | `next-auth` (v5) | Auth.js, provedor de credenciais e sessão JWT | https://www.npmjs.com/package/next-auth |
    | `@node-rs/argon2` | hash de senha com argon2id | https://www.npmjs.com/package/@node-rs/argon2 |
    | `zod` | validação de entrada no servidor | https://www.npmjs.com/package/zod |
  </what-built>
  <how-to-verify>
    Abra as três páginas acima e confirme, para cada uma:

    1. O campo **Repository** aponta para o projeto de origem esperado
       (`nextauthjs/next-auth`, `napi-rs/node-rs`, `colinhacks/zod`) — e não para uma conta
       recém-criada com nome parecido.
    2. O volume semanal de downloads está na casa dos milhões (`next-auth`, `zod`) ou das
       centenas de milhares (`@node-rs/argon2`). Um pacote com dezenas de downloads e nome
       parecido com o famoso é o padrão clássico de typosquatting.
    3. A data da última publicação é recente (meses, não anos).
    4. O nome está escrito exatamente como na tabela — sem hífen extra, sem letra trocada,
       sem escopo diferente.
  </how-to-verify>
  <acceptance_criteria>
    - Os três pacotes foram conferidos no registro público e o repositório de origem de cada um
      corresponde ao esperado.
    - Nenhum pacote adicional entra nesta fase sem passar por esta mesma conferência — se a
      implementação descobrir que precisa de um quarto, ela para e pede o portão de novo.
    - O SUMMARY registra, para cada pacote, o repositório de origem observado e a versão exata
      fixada.
  </acceptance_criteria>
  <resume-signal>Responda "aprovado" para liberar a instalação, ou nomeie o pacote que não conferiu.</resume-signal>
  <done>Os três pacotes estão conferidos como legítimos e a instalação está liberada.</done>
</task>

<task type="tracer">
  <name>Tarefa 2: Da migração ao login que abre uma rota protegida — um caminho só</name>
  <files>package.json, db/schema.ts, db/migrations/, lib/auth/auth.config.ts, lib/auth/auth.ts, lib/auth/rotas-publicas.ts, lib/auth/senha.ts, middleware.ts, app/api/auth/[...nextauth]/route.ts, app/(auth)/login/page.tsx, app/(app)/page.tsx, app/page.tsx, scripts/criar-usuario.ts, playwright.config.ts, tests/e2e/apoio/preparar-usuario.ts, tests/e2e/fundacao.spec.ts, tests/unit/rotas-publicas.test.ts, .github/workflows/entrega.yml</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §3 (estrutura de pastas), §4 (autenticação — a caixa
      de aviso sobre a divisão de configuração e o porquê do estágio `ferramentas`) e §6
      (variáveis de ambiente — a caixa sobre `AUTH_TRUST_HOST`)
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseção `usuarios` (colunas exatas e o
      índice funcional de e-mail) e §6 (fluxo com Drizzle e o que precisa de `--custom`)
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md` (D-03, D-07, D-08 e a
      lista "Decisões já fechadas nos documentos fonte")
    - `db/schema.ts`, `db/index.ts`, `db/migrate.ts` (o padrão de schema e migração já em uso)
    - `app/page.tsx`, `app/frase-no-ar.ts`, `app/layout.tsx`
    - `playwright.config.ts` e `tests/e2e/fundacao.spec.ts`
    - `.github/workflows/entrega.yml`, job `e2e` (o passo que sobe o contêiner da imagem real)
  </read_first>
  <action>
    Instale e **fixe a versão exata** (sem `^`, sem `~`) de `next-auth` na maior versão 5.x
    publicada, de `@node-rs/argon2` e de `zod` — a fixação da versão de autenticação é exigência
    escrita do `02a-CONTEXT.md`. Descubra a versão a fixar com `npm view next-auth versions --json`
    e registre no SUMMARY qual foi fixada.

    **Banco.** Acrescente a `db/schema.ts` o enum `papel_usuario` com o único valor `gestor` e a
    tabela `usuarios` com exatamente as colunas de `02-MODELO-DE-DADOS.md` §0: `id` uuid chave
    primária com `gen_random_uuid()`, `nome` text não nulo com verificação de comprimento entre 2
    e 120 sobre o texto sem espaços nas pontas, `email` text não nulo, `senha_hash` text não nulo,
    `papel` não nulo com padrão `gestor`, `ativo` boolean não nulo com padrão verdadeiro,
    `criado_em` e `atualizado_em` timestamptz não nulos com padrão `now()`. A unicidade do e-mail
    é um índice único **funcional** sobre `lower(email)`, chamado `usuarios_email_idx` — não uma
    restrição de coluna. Gere a migração com `npm run db:generate` e versione o SQL e o journal.
    Não escreva a migração à mão: ela é gerada. As funções, o trigger e o papel de banco NÃO
    entram aqui — são do plano 02.

    **A divisão obrigatória, e ela é o ponto inteiro desta tarefa.**

    `lib/auth/rotas-publicas.ts` — módulo puro, sem nenhum import: exporta a lista de prefixos
    livres de sessão (`/login` e tudo sob `/api/health`) e a função `ehRotaPublica(caminho)` que
    decide a partir dela. É o que permite testar a regra de proteção sem subir nada.

    `lib/auth/auth.config.ts` — exporta `configuracaoBase`, do tipo de configuração do Auth.js.
    Contém `pages` apontando a tela de entrada para `/login`, a estratégia de sessão em JWT, e o
    callback `authorized` que usa `ehRotaPublica` para decidir. Este arquivo é importado pelo
    `middleware.ts`, que roda no runtime Edge. Por isso ele **não pode alcançar, nem por
    transitividade, o módulo nativo de hash, o cliente do banco (`@/db`), nem a função de
    checagem de credenciais do provedor** — qualquer um deles quebra o middleware na
    inicialização, e o sintoma não aponta para a causa. Os únicos imports permitidos aqui são
    tipos do Auth.js e `lib/auth/rotas-publicas.ts`.

    `lib/auth/auth.ts` — importa `configuracaoBase`, acrescenta o provedor de credenciais com a
    função de checagem que consulta `usuarios` pelo e-mail em minúsculas, confere o hash e recusa
    quem estiver com `ativo` falso, e exporta `handlers`, `auth`, `signIn` e `signOut`. É o que
    rotas, páginas e Server Actions importam. Nunca o middleware.

    `lib/auth/senha.ts` — envoltório do módulo nativo de hash: `gerarSenhaForte()` (aleatória,
    forte, legível de digitar uma vez), `gerarHash(senha)` e `conferirHash(hash, senha)`, todos
    com argon2id. Roda só em Node.

    `middleware.ts` na raiz — constrói o Auth.js a partir de `configuracaoBase` e exporta o
    manipulador como padrão, mais o `matcher` que deixa passar os arquivos internos do Next, os
    arquivos estáticos e a própria rota de callback de autenticação.

    `app/api/auth/[...nextauth]/route.ts` — reexporta `GET` e `POST` dos `handlers` de
    `lib/auth/auth.ts`, com runtime `nodejs` declarado explicitamente.

    **Telas.** Mova `app/page.tsx` para `app/(app)/page.tsx` — a raiz passa a exigir sessão, e o
    grupo `(app)` é onde a Fase 2b vai pendurar a casca. Crie `app/(auth)/login/page.tsx`: um
    formulário com campo de e-mail, campo de senha e botão, em HTML com classes utilitárias, sem
    componente de biblioteca. Campo de formulário nunca abaixo de 16px e alvo de toque de no
    mínimo 44px — o iOS dá zoom sozinho ao focar campo menor. A tela de login exibe o nome AMASSA
    e a constante `FRASE_NO_AR`: ela era a prova pública do critério INFRA-02 da Fase 1 e precisa
    continuar visível sem sessão, agora aqui. A entrada é feita por Server Action que valida
    e-mail e senha com Zod e chama `signIn`. Trate a mensagem de erro como provisória neste plano
    — o texto definitivo e a regra de mensagem única são do plano 03.

    **Script de conta.** `scripts/criar-usuario.ts` — recebe `--nome` e `--email`, valida os dois
    com Zod, recusa e-mail já existente comparando em minúsculas, gera a senha com
    `gerarSenhaForte()`, grava o hash e imprime a senha **uma única vez** numa linha de formato
    fixo e parseável (prefixo `SENHA: `), mais uma frase avisando que não há como recuperá-la.
    Sai 0 no sucesso e diferente de 0 em qualquer falha. Acrescente o alias `criar-usuario` aos
    scripts do `package.json` chamando o arquivo por `tsx`, como `db:migrate` já faz. O comando
    documentado é sempre `docker compose run --rm ferramentas npm run criar-usuario -- ...` — a
    imagem `app` não tem `tsx` nem devDependencies, e isso já foi provado empiricamente na Fase 1.

    **Testes e ambiente de teste.** `tests/e2e/apoio/preparar-usuario.ts` vira o `globalSetup` do
    Playwright: roda o próprio `scripts/criar-usuario.ts` contra o banco de teste com um nome e um
    e-mail inventados (domínio `exemplo.test`), lê a senha da linha de formato fixo e publica
    e-mail e senha em variáveis de ambiente para as specs. Isso faz o E2E exercitar AUTH-07 de
    verdade em vez de semear a tabela por fora. Em `playwright.config.ts`, registre o
    `globalSetup` e acrescente ao ambiente do `webServer` as variáveis `AUTH_SECRET` e
    `AUTH_TRUST_HOST=true` — a primeira com um valor de teste explicitamente descartável, no mesmo
    espírito da senha efêmera que já existe em `docker/compose.teste.yml`. No job `e2e` do
    workflow, passe as mesmas duas variáveis ao `docker run` do contêiner da imagem real.

    **`AUTH_TRUST_HOST=true` não é opcional e precisa ser exercitado aqui.** Ela já existe no
    `.env` do servidor desde a Fase 1, mas nunca foi usada — não havia autenticação. Sem ela o
    Auth.js v5 ignora os cabeçalhos `X-Forwarded-*` e monta URLs de callback erradas atrás do
    Caddy: o login funciona em `localhost` e falha em produção. É a mesma classe dos três defeitos
    que a Fase 1 só encontrou fora da máquina de desenvolvimento, e o E2E rodando contra a imagem
    real é o lugar mais barato de pegá-la.

    Reescreva `tests/e2e/fundacao.spec.ts`: o caso que hoje afirma que a raiz é pública passa a
    afirmar que **sem sessão a raiz redireciona para `/login`**, e ganha um caso que entra com a
    conta preparada e chega à raiz autenticado. O caso de `/api/health` continua como está — a
    rota segue pública. `tests/unit/rotas-publicas.test.ts` cobre `ehRotaPublica` nos dois
    sentidos.
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npm test &amp;&amp; npm run build &amp;&amp; npm run test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `npm run build` compila com `middleware.ts` presente e sem nenhum erro de módulo nativo
      no runtime Edge.
    - `npm run test:e2e` sai 0 nos dois projetos (desktop e celular): sem sessão a raiz
      redireciona para `/login`; com a conta criada pelo script, entrar leva à raiz autenticado.
    - O `globalSetup` do Playwright imprime uma linha começando por `SENHA: ` — prova de que o
      script criou a conta e imprimiu a senha uma única vez.
    - `psql -c "\d usuarios"` (ou equivalente pelo contêiner de teste) lista as oito colunas de
      `02-MODELO-DE-DADOS.md` §0 e o índice único `usuarios_email_idx` sobre `lower(email)`.
    - `git ls-files app/page.tsx` devolve vazio e `git ls-files "app/(app)/page.tsx"` devolve o
      arquivo — a raiz deixou de ser pública.
    - `node -e "const p=require('./package.json');for(const d of ['next-auth','@node-rs/argon2','zod']){if(!/^[0-9]/.test(p.dependencies[d]))throw new Error(d)}"` sai 0 — as três
      versões estão fixadas sem faixa.
    - `grep -c 'AUTH_TRUST_HOST' playwright.config.ts` devolve pelo menos `1` e
      `grep -c 'AUTH_TRUST_HOST' .github/workflows/entrega.yml` devolve pelo menos `1` — a
      variável é exercitada nos dois ambientes de teste, não só declarada no `.env` do servidor.
    - Nenhum e-mail ou nome real aparece em arquivo algum: o e-mail usado nos testes termina em
      `exemplo.test`.
  </acceptance_criteria>
  <done>Uma conta criada pelo script entra pela tela de login e abre uma rota protegida, e o caminho inteiro está commitado.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Provar a divisão de borda — o teste que falharia se ela estivesse errada</name>
  <files>tests/unit/auth-borda.test.ts</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §4, a caixa "A divisão de configuração que todo mundo
      esquece"
    - `lib/auth/auth.config.ts`, `lib/auth/auth.ts`, `lib/auth/rotas-publicas.ts` e `middleware.ts`
      recém-criados na tarefa 2
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md`, seção "Specific Ideas"
    - `tests/unit/saude.test.ts` (o formato de teste unitário já em uso)
  </read_first>
  <action>
    O critério 6 do ROADMAP pede prova de que o **middleware carrega**, não só de que o login
    funciona. Um build verde prova isso hoje e volta a mentir amanhã, quando alguém acrescentar
    um import inocente ao arquivo importado pelo middleware. Crie um teste unitário que falha
    nesse instante, não seis semanas depois em produção.

    `tests/unit/auth-borda.test.ts` faz três afirmações, todas sobre o **grafo de módulos
    alcançável** a partir de `lib/auth/auth.config.ts`, não sobre a primeira linha do arquivo —
    a falha real desta classe chega por transitividade.

    1. Percorra recursivamente os imports relativos e por alias a partir de `lib/auth/auth.config.ts`
       e monte o conjunto de arquivos alcançados. Nenhum arquivo desse conjunto pode conter
       referência ao pacote nativo de hash, ao cliente do banco (`@/db` ou `db/index`), nem à
       função de checagem de credenciais do provedor. Compare o texto **sem as linhas de
       comentário** (`//` e `/* */`), senão a própria prosa explicativa do arquivo invalida o
       teste.
    2. `middleware.ts` importa o arquivo de configuração de borda e **não** importa
       `lib/auth/auth.ts`. Mesma limpeza de comentários.
    3. Nenhum módulo sob `lib/auth/` e nenhum script sob `scripts/` emite exclusão de linha sobre
       `usuarios` — desativar é marcar `ativo` como falso, e apagar quebraria o histórico de
       autoria (AUTH-09). Procure a operação de exclusão do Drizzle e o comando SQL correspondente.

    Cada afirmação com mensagem de falha em português dizendo **qual arquivo** trouxe o import
    proibido e **por qual caminho** — a mensagem é o produto aqui; um teste que só diz "falhou"
    devolve o problema ao ponto de partida.

    Depois de escrever o teste, prove-o nos dois sentidos como a Fase 1 fez com os portões:
    acrescente temporariamente o import proibido ao arquivo de configuração de borda, confirme
    que o teste falha, e desfaça. Registre a observação no SUMMARY; não deixe o import no commit.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/auth-borda.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/unit/auth-borda.test.ts` sai 0 com as três afirmações passando.
    - `grep -v '^\s*//' lib/auth/auth.config.ts | grep -c 'argon2'` devolve `0`.
    - `grep -v '^\s*//' lib/auth/auth.config.ts | grep -c 'authorize'` devolve `0`.
    - `grep -v '^\s*//' lib/auth/auth.config.ts | grep -c '@/db'` devolve `0`.
    - `grep -v '^\s*//' middleware.ts | grep -c 'auth/auth\"'` devolve `0` — o middleware não
      importa o arquivo de runtime Node.
    - O SUMMARY registra a observação da falha provocada de propósito (import proibido inserido,
      teste vermelho, import removido, teste verde).
  </acceptance_criteria>
  <done>Existe um teste automatizado no portão `qualidade` que fica vermelho se a divisão de borda for desfeita.</done>
</task>

</tasks>

<!-- planner-discipline-allow: argon2 -->
<!-- planner-discipline-allow: authorize -->
<!-- planner-discipline-allow: @/db -->

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → `/login` | credenciais não confiáveis atravessam aqui; é a única rota pública que aceita entrada |
| navegador → qualquer rota `(app)` | pedido sem sessão precisa ser barrado antes de qualquer consulta |
| terminal do servidor → `scripts/criar-usuario.ts` | argumentos de linha de comando viram linha na tabela `usuarios` |
| registro npm → imagem de build | pacote de terceiro entra na cadeia de suprimento do sistema de autenticação |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-01 | Spoofing | `lib/auth/auth.ts`, função de checagem de credenciais | critical | mitigate | Hash argon2id em `lib/auth/senha.ts`; a checagem recusa `ativo` falso; senha em texto nunca é gravada nem registrada em log |
| T-02a-02 | Elevation of Privilege | `middleware.ts` | critical | mitigate | Tudo fora de `/login` e `/api/health` exige sessão; a lista vive em `lib/auth/rotas-publicas.ts`, é módulo puro e é testada nos dois sentidos |
| T-02a-03 | Denial of Service | `middleware.ts` na borda | high | mitigate | A divisão de configuração impede que o módulo nativo alcance o runtime Edge; `tests/unit/auth-borda.test.ts` falha se a divisão for desfeita — sem ela o middleware quebra na inicialização e o sistema inteiro fica fora do ar |
| T-02a-04 | Information Disclosure | `app/(auth)/login/page.tsx` | medium | mitigate | A tela de login não confirma existência de e-mail; a regra de mensagem única e tempo constante é completada no plano 03 |
| T-02a-05 | Tampering | `scripts/criar-usuario.ts` | medium | mitigate | Entradas validadas com Zod no servidor; e-mail comparado em minúsculas contra o índice funcional para impedir conta duplicada por diferença de caixa |
| T-02a-06 | Repudiation | tabela `usuarios` | medium | mitigate | Nenhum caminho de código apaga usuário; desativar é `ativo` falso, e o teste de borda afirma a ausência de exclusão |
| T-02a-SC | Tampering | instalações npm (`next-auth`, `@node-rs/argon2`, `zod`) | high | mitigate | Sem `RESEARCH.md` nesta fase, os três pacotes são `[ASSUMED]`; a tarefa 1 é um portão humano bloqueante que confere repositório de origem, volume de downloads e grafia exata no registro público antes de instalar |
</threat_model>

<verification>
1. `npm run lint` e `npm test` saem 0.
2. `npm run build` compila com `middleware.ts` presente.
3. `npm run test:e2e` sai 0 nos projetos desktop e celular.
4. `npx vitest run tests/unit/auth-borda.test.ts` sai 0, e provou-se vermelho ao receber o
   import proibido de propósito.
5. Nenhum nome, e-mail ou segredo real aparece em arquivo versionado.
</verification>

<success_criteria>
- Sem sessão, a raiz leva para `/login` (AUTH-01).
- Uma conta criada pelo script entra e chega à raiz autenticada (AUTH-02, AUTH-07).
- A tabela `usuarios` tem `ativo` e nenhum caminho de código a apaga (AUTH-09).
- A divisão de borda está provada por teste, não por inspeção (critério 6 do ROADMAP).
</success_criteria>

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `db/schema.ts` | `papelUsuario` (enum `papel_usuario`), `usuarios` (tabela), índice `usuarios_email_idx` |
| `db/migrations/` | migração gerada com o enum, a tabela e o índice funcional |
| `lib/auth/rotas-publicas.ts` | `ROTAS_PUBLICAS`, `ehRotaPublica(caminho)` |
| `lib/auth/auth.config.ts` | `configuracaoBase` |
| `lib/auth/auth.ts` | `handlers`, `auth`, `signIn`, `signOut` |
| `lib/auth/senha.ts` | `gerarSenhaForte()`, `gerarHash()`, `conferirHash()` |
| `middleware.ts` | manipulador padrão + `config.matcher` |
| `app/api/auth/[...nextauth]/route.ts` | `GET`, `POST` |
| `app/(auth)/login/page.tsx` | tela de login mínima + Server Action de entrada |
| `app/(app)/page.tsx` | rota protegida provisória (a Fase 2b substitui) |
| `scripts/criar-usuario.ts` | alias npm `criar-usuario` |
| `tests/e2e/apoio/preparar-usuario.ts` | `globalSetup` do Playwright |
| `tests/unit/auth-borda.test.ts` | prova da divisão de borda |
| `tests/unit/rotas-publicas.test.ts` | prova da regra de rota pública |

## Risks

- A versão 5.x do Auth.js passou muito tempo em beta. A versão exata é fixada e registrada no
  SUMMARY; atualizar exige ler o changelog.
- Mover `app/page.tsx` para trás da sessão tira do ar a prova pública do critério INFRA-02 da
  Fase 1. Mitigado exibindo `FRASE_NO_AR` na tela de login, que continua pública.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-01-SUMMARY.md` when done
</output>
