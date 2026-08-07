---
phase: 02a-login-banco-base-e-backup
plan: 02
type: execute
wave: 2
depends_on: ["02a-01"]
files_modified:
  - db/migrations/
  - docker/compose.yml
  - .env.example
  - scripts/testar-migracoes.mjs
  - package.json
  - .github/workflows/entrega.yml
  - README.md
autonomous: true
requirements: [AUTH-02]

estimate:
  tokens: 52000
  raw_tokens: 52000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A aplicação continua entrando e abrindo a rota protegida depois que ela passa a conectar com o papel `amassa_app`, e não mais com o dono do banco"
    - "O banco permanece em UTC — `TZ` não alcança o contêiner do Postgres em nenhum arquivo de composição"
    - "`hoje_brasilia()` devolve a data civil de Brasília mesmo quando o banco está em UTC e o relógio já virou o dia em UTC"
    - "Atualizar uma linha de `usuarios` mexe `atualizado_em` sozinho"
  artifacts:
    - db/migrations/ (migração custom da base comum)
    - db/migrations/ (migração custom do papel e dos grants)
    - scripts/testar-migracoes.mjs
  key_links:
    - "`DATABASE_URL` (serviço `app`) usa `amassa_app`; `DATABASE_URL_MIGRACAO` (serviço `ferramentas`) usa `amassa_owner`"
    - "`alter default privileges` roda como `amassa_owner`, que é quem cria as tabelas nas migrações — sem isso as tabelas das fases seguintes nascem invisíveis para a aplicação"
    - "O trigger de `atualizado_em` é por tabela: a função sozinha não faz nada"

coverage:
  - id: D1
    description: "A extensão unaccent, hoje_brasilia() e tocar_atualizado_em() existem no banco depois das migrações"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — afirma extensão, função de data e trigger contra um Postgres limpo"
        status: unknown
    human_judgment: false
  - id: D2
    description: "O papel amassa_app existe, sem posse de tabela, com os grants da seção 0 do modelo de dados, e a aplicação conecta por ele"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — afirma o papel, os privilégios e a ausência de posse"
        status: unknown
    human_judgment: false
  - id: D3
    description: "O contêiner do Postgres continua em UTC — TZ não aparece no bloco do serviço postgres de nenhum arquivo de composição"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — afirma que o banco responde UTC e que o bloco do serviço postgres não injeta fuso"
        status: unknown
    human_judgment: false
  - id: D4
    description: "Atualizar uma linha de usuarios mexe atualizado_em sozinho, pelo trigger"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — atualiza uma linha e compara o carimbo antes e depois"
        status: unknown
    human_judgment: false
---

<objective>
Fechar a base comum do banco que todas as fases seguintes vão herdar — extensão, funções de data,
trigger de `atualizado_em` e os **dois papéis de banco** — e virar a conexão da aplicação do dono
do banco para o papel `amassa_app`.

Purpose: `AUTH-02` ("entrar com e-mail e senha dá acesso ao sistema") passa a valer contra o papel
restrito, não contra o dono. Se os `grant` estiverem errados, o login para de funcionar em
produção enquanto continua funcionando na máquina de desenvolvimento — a mesma classe de defeito
que a Fase 1 encontrou três vezes. E sem os dois papéis, o `revoke` de imutabilidade do estoque
na Fase 6 seria decorativo: dono de tabela retém privilégio implícito e pode se reconceder.

Output: duas migrações customizadas, a separação de `DATABASE_URL` e `DATABASE_URL_MIGRACAO`, e
um teste que aplica tudo num Postgres limpo e confere o resultado de fora.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-01-SUMMARY.md
</context>

<constraints>
- **`TZ` continua proibido no serviço `postgres`.** Toda a lógica de datas do projeto depende de
  o banco permanecer em UTC. O fuso de Brasília existe só no serviço `app`.
- **Nenhuma migração roda no pipeline.** Migração é aplicada à mão, depois de um backup, por
  alguém que está olhando. O workflow pode aplicar o schema no banco de teste efêmero do job —
  nunca no banco real, e sem mencionar o alias reservado à migração de produção.
- Funções, triggers, papéis e `grant` o Drizzle **não** gera: vão em migração customizada
  (`drizzle-kit generate --custom`), versionada junto.
- **Não crie `nome_normalizado()` nem índice de busca de aluna** — são da fase da Agenda.
- Nenhum segredo em arquivo versionado. `.env.example` continua sem valores.
</constraints>

<tasks>

<task type="auto">
  <name>Tarefa 1: Migração da base comum — extensão, funções de data e o trigger de `atualizado_em`</name>
  <files>db/migrations/</files>
  <read_first>
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseções "Fuso horário", "`atualizado_em`" e
      a nota de que o trigger é por tabela
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §6 (o que precisa de `--custom` e por quê a
      numeração sai da ferramenta, não da tabela do documento)
    - `db/migrations/meta/_journal.json` e a migração gerada no plano 01
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md`
  </read_first>
  <action>
    Gere um arquivo de migração vazio com `npx drizzle-kit generate --custom` e escreva nele, nesta
    ordem:

    1. A extensão `unaccent`, criada só se ainda não existir. Ela é pré-requisito da normalização
      de nomes que a fase da Agenda vai precisar; a função `nome_normalizado()` **não** entra
      aqui.
    2. `hoje_brasilia()` — função SQL `stable` que devolve a data civil em `America/Sao_Paulo`,
      convertendo o instante atual do banco. É ela que toda coluna `date` com valor padrão vai
      usar nas fases seguintes, no lugar da data corrente crua: o contêiner do Postgres roda em
      UTC, e entre 21h e meia-noite a data crua já é a de amanhã.
    3. `tocar_atualizado_em()` — função de trigger em plpgsql que carimba a coluna
      `atualizado_em` da linha nova com o instante atual e devolve a linha.
    4. O trigger `tocar_atualizado_em_usuarios`, `before update`, por linha, sobre `usuarios`,
      executando a função acima. A função sozinha não faz nada — o trigger é o que a liga, e é
      o passo que costuma ser esquecido.

    Use forma idempotente (`create ... if not exists` / `create or replace` / recriação
    condicional do trigger) para que reaplicar o arquivo num banco parcialmente migrado não
    exploda. Comente cada bloco em português dizendo **o que** ele resolve, no mesmo tom dos
    comentários já existentes no repositório.

    Não toque em `db/schema.ts`: nada disto é expressável no schema do Drizzle, e é exatamente por
    isso que a migração é customizada.
  </action>
  <verify>
    <automated>npm run test:migracoes</automated>
  </verify>
  <acceptance_criteria>
    - A migração está versionada em `db/migrations/` e o `_journal.json` a lista depois da
      migração do plano 01.
    - Num Postgres limpo, aplicar todas as migrações termina sem erro.
    - `select extname from pg_extension where extname = 'unaccent'` devolve uma linha.
    - `select hoje_brasilia()` devolve a mesma data que o fuso `America/Sao_Paulo` naquele
      instante, inclusive quando o instante em UTC já pertence ao dia seguinte.
    - `select tgname from pg_trigger where tgname = 'tocar_atualizado_em_usuarios'` devolve uma
      linha.
    - Atualizar `nome` de uma linha de `usuarios` faz `atualizado_em` avançar sem que a instrução
      de atualização mencione essa coluna.
  </acceptance_criteria>
  <done>A base comum de datas existe no banco e o carimbo de atualização se mantém sozinho.</done>
</task>

<task type="auto">
  <name>Tarefa 2: Migração do papel `amassa_app` e a separação das duas conexões</name>
  <files>db/migrations/, docker/compose.yml, .env.example, README.md</files>
  <read_first>
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseção "Dois papéis de banco, não um" (a
      lista exata de `grant`) e "Sem RLS — e o que ocupa o lugar dela"
    - `amassa-plataforma/01-ARQUITETURA.md` §5 (segurança do banco) e §6 (variáveis de ambiente)
    - `docker/compose.yml` inteiro, com atenção ao serviço `ferramentas` e ao comentário do
      serviço `postgres`
    - `db/migrate.ts` e `drizzle.config.ts` (de onde a conexão de migração é lida)
    - `docs/operacao/01-preparar-servidor.md`, passo 8 (o `.env` que hoje aponta a aplicação para
      o dono do banco)
  </read_first>
  <action>
    Gere uma segunda migração customizada com `npx drizzle-kit generate --custom` que cria o papel
    de aplicação e concede a ele exatamente os privilégios da seção 0 do modelo de dados:

    - Cria o papel `amassa_app` com permissão de login e **sem senha**, dentro de um bloco
      condicional que não falha se ele já existir. Sem senha o papel não consegue abrir conexão
      por rede — o método de autenticação da imagem exige senha — então não existe janela de
      acesso entre a migração e o momento em que o dono define a senha no servidor. Isso também
      mantém o segredo fora do arquivo versionado, que é o ponto.
    - Concede conexão ao banco, uso do schema público, e as quatro operações de manipulação de
      dados sobre todas as tabelas existentes, mais uso e leitura sobre todas as sequências.
    - Declara privilégios padrão no schema público concedendo as mesmas quatro operações sobre
      tabelas futuras. Essa linha roda como o dono do banco, que é quem cria as tabelas nas
      migrações — é ela que faz as tabelas das Fases 3 a 6 nascerem visíveis para a aplicação.
    - **Não** concede nenhum privilégio de definição de estrutura. O papel de aplicação nunca
      cria, altera nem remove tabela.

    Comente o bloco explicando, em uma frase, que separar os dois papéis é o que faz a proibição
    de alterar movimentação de estoque valer alguma coisa na Fase 6: uma proibição contra o dono
    da tabela não vale nada, porque dono retém privilégio implícito e pode se reconceder.

    **Separação das duas conexões.** Em `docker/compose.yml`, o serviço `ferramentas` passa a
    receber a conexão de migração: mantenha o nome de variável que o código já lê, mas alimente-o
    a partir de `DATABASE_URL_MIGRACAO` do arquivo de ambiente. O serviço `app` continua recebendo
    `DATABASE_URL`, que a partir de agora aponta para `amassa_app`. Deixe um comentário curto
    dizendo qual serviço usa qual papel e por quê — é a única pista que alguém vai ter às três da
    manhã. **Não acrescente fuso ao serviço `postgres`**, nem por variável nem por arquivo de
    ambiente global: o serviço `app` continua sendo o único que recebe fuso.

    Em `.env.example`, acrescente `DATABASE_URL_MIGRACAO` sem valor, ao lado de `DATABASE_URL`,
    com um comentário de uma linha dizendo que a primeira usa o dono do banco e roda as migrações
    e a segunda usa o papel da aplicação. No `README.md`, atualize a seção de variáveis de
    ambiente com a mesma distinção.

    A virada no servidor — definir a senha do papel e trocar o valor de `DATABASE_URL` no `.env`
    de produção — **não é feita por este plano**. Ela é um passo do roteiro do plano 08, executado
    pelo dono. Aqui entram só os arquivos versionados.
  </action>
  <verify>
    <automated>npm run test:migracoes</automated>
  </verify>
  <acceptance_criteria>
    - `select rolname, rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = 'amassa_app'`
      devolve uma linha com os três atributos falsos.
    - `select tableowner from pg_tables where schemaname = 'public'` não devolve `amassa_app` em
      nenhuma linha — o papel de aplicação não é dono de tabela nenhuma.
    - `has_table_privilege('amassa_app', 'usuarios', 'select')` e as outras três operações
      devolvem verdadeiro; `has_table_privilege('amassa_app', 'usuarios', 'truncate')` devolve
      falso.
    - Uma tabela criada pelo dono **depois** da migração já nasce com as quatro operações
      concedidas a `amassa_app` — prova de que os privilégios padrão pegaram.
    - `awk '/^  postgres:/,/^  app:/' docker/compose.yml | grep -v '^ *#' | grep -c 'TZ'` devolve `0`.
    - `grep -c 'DATABASE_URL_MIGRACAO' .env.example` devolve pelo menos `1`, e nenhuma linha de
      `.env.example` tem valor depois do sinal de igual.
  </acceptance_criteria>
  <done>O papel de aplicação existe com os privilégios certos e as duas conexões estão separadas nos arquivos versionados.</done>
</task>

<task type="auto">
  <name>Tarefa 3: `npm run test:migracoes` — a conferência de fora, num Postgres limpo</name>
  <files>scripts/testar-migracoes.mjs, package.json, .github/workflows/entrega.yml</files>
  <read_first>
    - `scripts/testar-e2e.mjs` (o padrão de orquestração: sobe banco efêmero local, reaproveita o
      banco do runner em CI, derruba tudo no fim)
    - `docker/compose.teste.yml` e `db/migrate.ts`
    - `.github/workflows/entrega.yml`, job `e2e` (onde o banco de teste já chega pronto)
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md`, seção "Desvios e
      descobertas" (por que verificação de fora, e não pelo relato de quem executou)
  </read_first>
  <action>
    Crie `scripts/testar-migracoes.mjs` no molde de `scripts/testar-e2e.mjs`: em CI usa o banco de
    teste que o runner já entrega; localmente sobe o Postgres efêmero de `docker/compose.teste.yml`,
    publica a porta só pela linha de comando e derruba tudo no `finally`. Aplica todas as migrações
    e depois confere o resultado consultando o banco pelo cliente `pg`, que já é dependência do
    projeto — nada de depender de um binário de linha de comando do Postgres instalado na máquina
    de quem roda, porque a Fase 1 já provou que essa suposição quebra no Windows.

    As afirmações, cada uma com mensagem de falha em português dizendo o que ficou faltando:

    1. **Fuso do banco.** O fuso configurado do servidor Postgres é `UTC`. É a prova, do lado do
      banco, de que nenhum fuso alcançou a inicialização — o par da conferência estática feita no
      arquivo de composição.
    2. **Tabelas.** A lista de tabelas do schema público é exatamente a esperada, mantida como uma
      constante no topo do arquivo. Hoje: a tabela de verificação de infraestrutura da Fase 1 e
      `usuarios`. Uma tabela a mais reprova. Deixe um comentário dizendo que cada fase que
      acrescentar tabela atualiza essa constante — é o que impede uma tabela de produto de
      aparecer sem ninguém notar.
    3. **Extensão e funções.** `unaccent` instalada; `hoje_brasilia()` devolvendo a data de
      Brasília, conferida contra a data que o próprio Node calcula naquele fuso; o trigger de
      `atualizado_em` presente em `usuarios`.
    4. **Trigger funcionando.** Insere uma linha em `usuarios` com dados inventados, lê
      `atualizado_em`, atualiza `nome` sem mencionar o carimbo, lê de novo e afirma que avançou.
      Apaga a linha de teste ao final — este é o único lugar do sistema onde apagar uma linha de
      `usuarios` é legítimo, porque o banco é efêmero; deixe isso escrito no comentário.
    5. **Papel e privilégios.** `amassa_app` existe, não é superusuário, não cria banco nem papel,
      não é dono de tabela nenhuma, tem as quatro operações de manipulação sobre `usuarios` e não
      tem esvaziamento de tabela. Cria uma tabela descartável como dono, confere que ela já nasce
      com as quatro operações concedidas ao papel de aplicação, e a remove.

    Acrescente o alias `test:migracoes` ao `package.json` e um passo no job `e2e` do workflow que
    o roda contra o banco de teste do runner, depois do passo que aplica o schema e antes do
    Playwright. Não mencione no workflow o alias reservado à migração do banco de produção.
  </action>
  <verify>
    <automated>npm run test:migracoes</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:migracoes` sai 0 na máquina de desenvolvimento, subindo e derrubando o
      Postgres efêmero sozinho.
    - O mesmo comando sai diferente de 0 se qualquer uma das cinco afirmações falhar — prove pelo
      menos uma inversão de propósito (por exemplo, retirando o papel da constante de tabelas
      esperadas) e registre a observação no SUMMARY.
    - O job `e2e` do workflow roda `test:migracoes` e o job inteiro continua verde.
    - `grep -c 'db:migrate' .github/workflows/entrega.yml` devolve `0`.
    - O script não invoca nenhum binário de linha de comando do Postgres no host.
  </acceptance_criteria>
  <done>Um comando único prova, de fora, que o banco base saiu como especificado — e o portão do pipeline o executa.</done>
</task>

</tasks>

<!-- planner-discipline-allow: TZ -->
<!-- planner-discipline-allow: db:migrate -->

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| aplicação → Postgres | a conexão de runtime atravessa aqui; o que ela pode fazer é o teto do estrago de qualquer falha na camada de cima |
| migração → Postgres | a conexão de definição de estrutura, usada à mão, por alguém olhando |
| arquivo de ambiente do servidor → contêineres | o `.env` de `/opt/amassa` é a única fonte de segredo em produção |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-07 | Elevation of Privilege | conexão de runtime da aplicação | high | mitigate | `DATABASE_URL` passa a usar `amassa_app`, que não tem privilégio de definição de estrutura nem posse de tabela; `test:migracoes` afirma os três atributos falsos e a ausência de posse |
| T-02a-08 | Tampering | migração aplicada por engano pelo pipeline | high | mitigate | Nenhum job do workflow menciona o alias de migração de produção; a conferência é criterio de aceite desta tarefa |
| T-02a-09 | Information Disclosure | senha do papel de aplicação | high | mitigate | O papel nasce sem senha na migração versionada; a senha é gerada e definida no servidor pelo roteiro do plano 08, nunca em arquivo do repositório |
| T-02a-10 | Tampering | fuso do contêiner do Postgres | medium | mitigate | Conferência dupla: o bloco do serviço `postgres` não injeta fuso (estática) e o servidor responde UTC (dinâmica) |
| T-02a-11 | Denial of Service | privilégios padrão ausentes | medium | mitigate | Sem eles, as tabelas das Fases 3 a 6 nasceriam invisíveis para a aplicação; `test:migracoes` cria uma tabela descartável e afirma os privilégios herdados |
</threat_model>

<verification>
1. `npm run test:migracoes` sai 0 localmente e no job `e2e`.
2. `npm run lint`, `npm test`, `npm run build` e `npm run test:e2e` continuam saindo 0.
3. `awk '/^  postgres:/,/^  app:/' docker/compose.yml | grep -v '^ *#' | grep -c 'TZ'` devolve `0`.
4. `.env.example` continua sem nenhum valor preenchido.
</verification>

<success_criteria>
- A base comum de datas e o trigger de atualização existem e funcionam (`hoje_brasilia()`,
  `tocar_atualizado_em()`).
- O papel `amassa_app` existe com exatamente os privilégios da seção 0 do modelo de dados, sem
  posse e sem poder de definição de estrutura.
- As duas conexões estão separadas nos arquivos versionados, e o banco continua em UTC.
- Existe um comando único que prova tudo isso de fora, e o pipeline o executa.

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `db/migrations/` (custom, base comum) | extensão `unaccent`, `hoje_brasilia()`, `tocar_atualizado_em()`, trigger `tocar_atualizado_em_usuarios` |
| `db/migrations/` (custom, papéis) | papel `amassa_app`, `grant` de conexão/schema/DML/sequências, privilégios padrão no schema público |
| `docker/compose.yml` | serviço `ferramentas` alimentado por `DATABASE_URL_MIGRACAO` |
| `.env.example` | variável `DATABASE_URL_MIGRACAO` |
| `scripts/testar-migracoes.mjs` | alias npm `test:migracoes`, constante `TABELAS_ESPERADAS` |
| `.github/workflows/entrega.yml` | passo `test:migracoes` no job `e2e` |
</success_criteria>

## Risks

- Virar `DATABASE_URL` para o papel restrito é o tipo de mudança que funciona na máquina de
  desenvolvimento e falha em produção se um `grant` faltar. Mitigado pelo `test:migracoes`, que
  confere privilégio a privilégio, e pelo roteiro do plano 08, que faz a virada com o
  `/api/health` como prova imediata.
- A constante de tabelas esperadas precisa ser atualizada pelo plano 06, que acrescenta
  `execucoes_backup`. Está escrito no comentário do próprio arquivo.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-02-SUMMARY.md` when done
</output>
