---
phase: 02a-login-banco-base-e-backup
plan: 06
type: execute
wave: 4
depends_on: ["02a-02", "02a-04"]
files_modified:
  - db/schema.ts
  - db/migrations/
  - lib/backup/frescor.ts
  - app/api/health/backup/route.ts
  - tests/unit/frescor.test.ts
  - tests/e2e/apoio/registrar-backup.ts
  - tests/e2e/backup.spec.ts
  - scripts/testar-migracoes.mjs
  - README.md
autonomous: true
requirements: [BKP-04]

estimate:
  tokens: 54000
  raw_tokens: 54000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "`/api/health/backup` responde `ok` quando o último backup tem menos de 26 horas e falha quando não tem (critério 8 do ROADMAP)"
    - "A rota responde sem sessão, para que um monitor externo consiga vigiá-la"
    - "A resposta diz, em português, por que não está `ok` — nenhum backup registrado, backup velho, backup que falhou, ou cópia externa que não subiu"
    - "A tabela `execucoes_backup` existe e é a única fonte da resposta — o endpoint não olha arquivo"
  artifacts:
    - lib/backup/frescor.ts
    - app/api/health/backup/route.ts
    - tests/unit/frescor.test.ts
    - tests/e2e/backup.spec.ts
  key_links:
    - "`lib/auth/rotas-publicas.ts` já libera tudo sob `/api/health` — a rota nova herda isso e a spec confirma que ela responde sem sessão"
    - "O endpoint lê a **última** linha de `execucoes_backup`, não a última bem-sucedida: um backup que falhou ontem precisa aparecer como falha, não sumir atrás do sucesso de anteontem"
    - "`destino_externo_ok` entra na decisão: verificar só a geração local esconderia exatamente a falha contra a qual a cópia externa existe"

coverage:
  - id: D1
    description: "A tabela execucoes_backup existe com quando, sucesso, bytes e destino_externo_ok"
    requirement: "BKP-04"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — a constante de tabelas esperadas passa a incluir execucoes_backup e as colunas são conferidas"
        status: unknown
    human_judgment: false
  - id: D2
    description: "A decisão de frescor do backup é um módulo puro com a janela de 26 horas testada nas fronteiras"
    requirement: "BKP-04"
    verification:
      - kind: unit
        ref: "tests/unit/frescor.test.ts#os seis casos de decisao, incluindo as duas fronteiras de 26 horas"
        status: unknown
    human_judgment: false
  - id: D3
    description: "/api/health/backup responde ok com backup fresco e falha com tabela vazia, backup velho, backup com falha ou cópia externa ausente"
    requirement: "BKP-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/backup.spec.ts#a rota responde 503 sem registro e 200 com registro fresco"
        status: unknown
      - kind: e2e
        ref: "tests/e2e/backup.spec.ts#a rota responde sem sessao"
        status: unknown
    human_judgment: false
---

<objective>
Construir o vigia do backup: a tabela `execucoes_backup`, a regra de frescor como módulo puro, e
`/api/health/backup` — a rota pública que um monitor externo consulta a cada cinco minutos.

Purpose: `01-ARQUITETURA.md` §9 é direto — **um backup que para em silêncio é pior do que não ter
backup**, porque você acha que está protegido. Esta rota é o que transforma "o script disse que
enviou" em "existe uma cópia de menos de 26 horas, e ela chegou do outro lado". Ela vem **antes**
do script de backup de propósito: com ela pronta, o plano seguinte tem onde reportar e como ser
observado de fora.

Output: a tabela, o módulo puro de decisão, a rota, e as provas nos dois sentidos.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-02-SUMMARY.md
@.planning/phases/02a-login-banco-base-e-backup/02a-04-SUMMARY.md
</context>

<constraints>
- **Nenhuma tabela de produto nesta fase.** A migração acrescenta `execucoes_backup` e nada além.
- **`D-11`: nenhum dado real do ateliê entra no sistema** antes de o dump existir e ter sido
  restaurado uma vez. Esta fase não migra dado nenhum.
- Regra de decisão em módulo puro (`lib/backup/frescor.ts`): recebe dados, devolve dados, não
  importa React nem o cliente do banco.
- Mensagem em linguagem humana. A resposta desta rota é lida por alguém às sete da manhã, num
  e-mail de alerta.
- **D-03: nenhum componente shadcn.** Esta rota não tem tela.
</constraints>

<tasks>

<task type="auto">
  <name>Tarefa 1: A tabela `execucoes_backup`</name>
  <files>db/schema.ts, db/migrations/, scripts/testar-migracoes.mjs</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §9, a caixa "Como a aplicação sabe disso" (as quatro
      colunas nomeadas)
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseção "`atualizado_em`" (o checklist de
      toda tabela nova e a exceção conhecida de tabela não atualizável)
    - `db/schema.ts` como ficou nos planos 01 e 02
    - `scripts/testar-migracoes.mjs` e a constante de tabelas esperadas
  </read_first>
  <action>
    Acrescente a `db/schema.ts` a tabela `execucoes_backup` com: `id` uuid chave primária com
    `gen_random_uuid()`; `quando` timestamptz não nulo com padrão do instante atual — é o momento
    da execução, não uma data civil, e por isso não usa `hoje_brasilia()`; `sucesso` boolean não
    nulo; `bytes` inteiro grande, aceitando nulo (uma execução que falhou antes de gerar arquivo
    não tem tamanho); `destino_externo_ok` boolean não nulo com padrão falso — o padrão pessimista
    é deliberado, porque um registro escrito pela metade precisa parecer falha, não sucesso; e
    `mensagem` texto aceitando nulo, para a última linha de erro do script.

    A tabela é **acrescentada, nunca atualizada**: cada execução escreve uma linha nova. Por isso
    ela não recebe `atualizado_em` nem o trigger — é a mesma exceção que o modelo de dados abre
    para movimentação de estoque. Deixe isso escrito num comentário, senão o checklist de tabela
    nova vai parecer descumprido na próxima revisão.

    Acrescente também um índice descendente sobre `quando`: o endpoint sempre pede a última linha,
    e essa é a única consulta que a tabela recebe.

    Gere a migração com `npm run db:generate` e versione o SQL e o journal. Atualize a constante de
    tabelas esperadas em `scripts/testar-migracoes.mjs` para incluir a tabela nova, e acrescente ao
    script a conferência das colunas e do índice — a constante existe justamente para que uma
    tabela nova nunca apareça sem alguém decidir por ela.
  </action>
  <verify>
    <automated>npm run test:migracoes</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:migracoes` sai 0 com `execucoes_backup` na lista de tabelas esperadas.
    - A lista de tabelas do schema público tem exatamente três nomes: a tabela de verificação de
      infraestrutura da Fase 1, `usuarios` e `execucoes_backup`. Nenhuma tabela de produto.
    - Inserir uma linha informando apenas `sucesso` funciona, e `destino_externo_ok` sai falso por
      padrão.
    - O índice sobre `quando` existe.
    - A tabela **não** tem coluna `atualizado_em` e **não** tem trigger.
  </acceptance_criteria>
  <done>O banco tem onde registrar cada execução de backup, e o teste de migrações a conhece.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: `lib/backup/frescor.ts` — a janela de 26 horas como decisão pura</name>
  <files>lib/backup/frescor.ts, tests/unit/frescor.test.ts</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §7 (a perda máxima aceita de 24 horas) e §9 (as 26
      horas e por que a cópia externa entra na conta)
    - `lib/saude.ts` e `tests/unit/saude.test.ts` (o padrão de módulo puro que decide status e
      código HTTP)
  </read_first>
  <behavior>
    A função recebe a última linha de `execucoes_backup` (ou nada) e o instante atual, e devolve
    status, código HTTP e um motivo em português.

    - Nenhuma linha: `erro`, 503, motivo dizendo que nenhum backup foi registrado ainda.
    - Linha com sucesso, cópia externa confirmada, 2 horas atrás: `ok`, 200.
    - Linha com sucesso, cópia externa confirmada, 25 horas e 59 minutos atrás: `ok`, 200 — a
      janela é de 26 horas justamente para o dump diário das 3h15 não disparar alarme falso por
      alguns minutos de atraso.
    - Linha com sucesso, cópia externa confirmada, 26 horas e 1 minuto atrás: `erro`, 503, motivo
      citando há quantas horas foi o último backup.
    - Linha recente com `sucesso` falso: `erro`, 503, motivo dizendo que a última execução falhou
      e repetindo a mensagem registrada pelo script, quando houver.
    - Linha recente, com sucesso, mas com `destino_externo_ok` falso: `erro`, 503, motivo dizendo
      que o dump existe no servidor mas não chegou ao armazenamento externo. Um dump que só existe
      no servidor não protege contra a perda do servidor — deixar isso passar como `ok` esconderia
      exatamente a falha contra a qual a cópia externa existe.
    - Linha com `quando` no futuro (relógio errado): tratada como `erro`, 503, com motivo próprio.
      É improvável e barato de cobrir, e o contrário seria um `ok` permanente.

    A resposta sempre inclui, além do motivo, o instante do último backup e a idade em horas — o
    alerta que chega por e-mail precisa dizer alguma coisa por si só.
  </behavior>
  <action>
    Escreva primeiro `tests/unit/frescor.test.ts` com os sete casos, rode e confirme que falham, e
    só então implemente `lib/backup/frescor.ts`.

    O módulo exporta a constante da janela em horas e a função de decisão. Nenhum import, nenhuma
    leitura de relógio por dentro: o instante entra como argumento, que é o que torna as duas
    fronteiras testáveis sem esperar um dia.

    Deixe escrito no comentário do módulo por que a janela é de 26 horas e não de 24: o dump roda
    uma vez por dia, e uma janela de 24 horas transformaria qualquer atraso de minutos num alerta.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/frescor.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/unit/frescor.test.ts` sai 0 com os sete casos.
    - Os dois casos de fronteira (25h59 e 26h01) estão presentes e afirmam resultados opostos.
    - `lib/backup/frescor.ts` não tem nenhum import e não chama o relógio.
    - Todo motivo devolvido é uma frase em português, sem código de status como texto.
  </acceptance_criteria>
  <done>A regra de frescor é pura, testada nas fronteiras, e diz em português por que reprovou.</done>
</task>

<task type="auto">
  <name>Tarefa 3: `/api/health/backup` e a prova nos dois sentidos</name>
  <files>app/api/health/backup/route.ts, tests/e2e/apoio/registrar-backup.ts, tests/e2e/backup.spec.ts, README.md</files>
  <read_first>
    - `app/api/health/route.ts` (o padrão exato de rota de saúde já em uso: runtime, dinamismo,
      consulta real, decisão delegada ao módulo puro)
    - `lib/auth/rotas-publicas.ts` (a liberação de tudo sob `/api/health`)
    - `lib/backup/frescor.ts` da tarefa 2
    - `tests/e2e/apoio/alternar-ativo.ts` (o padrão de auxiliar que escreve no banco de teste)
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md`, item D4 (a rota de saúde
      provada nos dois sentidos: com o banco de pé e com ele parado)
  </read_first>
  <action>
    Crie `app/api/health/backup/route.ts` no mesmo molde de `app/api/health/route.ts`: runtime de
    nó, renderização sempre dinâmica, consulta real à última linha de `execucoes_backup` ordenada
    por `quando` decrescente, e a decisão inteiramente delegada a `lib/backup/frescor.ts`. O corpo
    da resposta traz status, motivo, instante do último backup e idade em horas. Se a própria
    consulta falhar, responda 503 com um motivo dizendo que não foi possível ler o registro de
    backups — indistinguível de "sem backup" para o monitor, e é o comportamento certo: os dois
    casos exigem alguém olhando.

    Confirme que a rota é pública. Ela precisa responder **sem sessão** para o monitor externo
    funcionar; a liberação já existe pelo prefixo, e a spec confirma em vez de supor.

    `tests/e2e/apoio/registrar-backup.ts` — auxiliar que insere uma linha em `execucoes_backup` no
    banco de teste com instante, sucesso e estado da cópia externa controlados, e que limpa as
    linhas que inseriu. É a única tabela do sistema em que apagar linha de teste é aceitável, e o
    comentário registra que é por ela ser um registro operacional, não histórico de autoria.

    `tests/e2e/backup.spec.ts`, nos dois projetos:

    1. Com a tabela vazia, a rota responde 503 e o corpo diz que nenhum backup foi registrado.
    2. Com uma linha de duas horas atrás, com sucesso e cópia externa confirmada, a rota responde
      200 com status `ok`.
    3. Com uma linha de 27 horas atrás, a rota volta a 503 e o motivo cita a idade.
    4. Com uma linha recente mas com a cópia externa não confirmada, a rota responde 503.
    5. A rota responde nos quatro casos **sem nenhum cookie de sessão** — pedido feito por um
      contexto novo, sem login.

    Limpe as linhas inseridas ao final de cada caso, para as specs não interferirem entre si.

    No `README.md`, registre a rota ao lado de `/api/health`, com uma frase dizendo o que ela
    garante e que ela deve ser monitorada externamente.
  </action>
  <verify>
    <automated>npm run test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e` sai 0 nos projetos desktop e celular com os cinco casos.
    - Os casos 1 e 2 são o par que prova a rota nos dois sentidos: sem registro reprova, com
      registro fresco aprova.
    - O caso 5 usa um contexto sem sessão e mesmo assim recebe resposta — a rota é pública.
    - `curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/health/backup` devolve `503` com
      a tabela vazia.
    - O corpo da resposta em falha traz uma frase em português, o instante do último backup
      (quando houver) e a idade em horas.
    - `npm run verificar-acoes` continua saindo 0.
  </acceptance_criteria>
  <done>Existe uma rota pública que um monitor externo consegue vigiar, e ela já foi vista aprovando e reprovando.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| internet → `/api/health/backup` | rota pública por necessidade; qualquer pessoa na internet pode consultá-la |
| script de backup do host → `execucoes_backup` | processo fora do contêiner da aplicação escreve nesta tabela |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-28 | Information Disclosure | corpo da resposta pública | medium | mitigate | A resposta traz apenas status, motivo, instante e idade — nunca caminho de arquivo, nome de destino externo, nome de banco ou tamanho absoluto que revele o volume de dados do ateliê |
| T-02a-29 | Denial of Service | rota pública consultada em laço | low | accept | Consulta única e indexada sobre uma tabela de uma linha por dia, atrás do Caddy. Limitar taxa exigiria estado compartilhado que este sistema não tem, e o monitor externo precisa de acesso livre |
| T-02a-30 | Spoofing | registro de backup forjado | medium | mitigate | Só quem tem acesso ao banco escreve na tabela, e o Postgres não tem porta publicada. A rota não aceita escrita — apenas leitura |
| T-02a-31 | Repudiation | falha de backup silenciosa | high | mitigate | O endpoint lê a **última** linha, não a última bem-sucedida, e reprova quando `destino_externo_ok` é falso; a spec cobre os dois casos |
</threat_model>

<verification>
1. `npm run test:migracoes` sai 0 com as três tabelas esperadas.
2. `npx vitest run tests/unit/frescor.test.ts` sai 0 com as duas fronteiras.
3. `npm run test:e2e` sai 0 nos dois projetos.
4. `npm run lint`, `npm test`, `npm run verificar-acoes` e `npm run build` saem 0.
</verification>

<success_criteria>
- `/api/health/backup` responde `ok` com backup de menos de 26 horas e falha quando não tem
  (BKP-04).
- A rota responde sem sessão, para ser vigiada de fora (BKP-04).
- A resposta explica em português por que reprovou.

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `db/schema.ts` | tabela `execucoes_backup` (`id`, `quando`, `sucesso`, `bytes`, `destino_externo_ok`, `mensagem`) + índice sobre `quando` |
| `db/migrations/` | migração gerada da tabela e do índice |
| `lib/backup/frescor.ts` | `JANELA_EM_HORAS`, decisão pura de frescor |
| `app/api/health/backup/route.ts` | `GET` |
| `tests/e2e/apoio/registrar-backup.ts` | auxiliar de teste |
| `tests/unit/frescor.test.ts`, `tests/e2e/backup.spec.ts` | provas nos dois sentidos |
</success_criteria>

## Risks

- Exigir `destino_externo_ok` deixa a rota vermelha quando só o envio externo falha, mesmo com o
  dump local em ordem. É deliberado: `01-ARQUITETURA.md` §9 diz que o envio externo também precisa
  ser verificado. O motivo devolvido distingue os dois casos, então quem receber o alerta sabe se
  perdeu a cópia externa ou o backup inteiro.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-06-SUMMARY.md` when done
</output>
