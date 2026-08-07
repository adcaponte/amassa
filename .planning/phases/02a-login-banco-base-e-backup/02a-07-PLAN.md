---
phase: 02a-login-banco-base-e-backup
plan: 07
type: execute
wave: 5
depends_on: ["02a-06"]
files_modified:
  - scripts/backup.sh
  - scripts/restaurar.sh
  - scripts/testar-backup.mjs
  - package.json
  - .github/workflows/entrega.yml
  - .env.example
  - README.md
autonomous: true
requirements: [BKP-01, BKP-02, BKP-03, BKP-05, BKP-06]

estimate:
  tokens: 66000
  raw_tokens: 66000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Rodar `scripts/backup.sh` produz um arquivo comprimido íntegro, com o nome do dia, e registra uma linha em `execucoes_backup`"
    - "Dumps com mais de 14 dias são apagados, e o do dia 1º é copiado para uma pasta mensal que nunca é limpa"
    - "Um backup pode ser disparado sob demanda antes de qualquer migração, sem sobrescrever o dump do dia"
    - "O dump do dia é enviado para o armazenamento externo, e a linha registrada diz se o envio deu certo"
    - "Um dump volta a virar banco: restaurar num Postgres limpo devolve os dados conferidos"
    - "Uma execução que falha registra a falha — ela não desaparece"
  artifacts:
    - scripts/backup.sh
    - scripts/restaurar.sh
    - scripts/testar-backup.mjs
  key_links:
    - "O script é POSIX puro para rodar tanto pelo `cron` do host quanto dentro do contêiner do Postgres durante o teste — é isso que permite prová-lo sem servidor"
    - "Os comandos do Postgres entram por variável, com o padrão apontando para o contêiner de produção; o teste os troca pelos binários locais"
    - "A gravação em `execucoes_backup` acontece em toda saída, inclusive na de erro — é a linha que `/api/health/backup` lê"
    - "O envio externo é opcional por configuração ausente, e a ausência vira `destino_externo_ok` falso, nunca sucesso silencioso"

coverage:
  - id: D1
    description: "Um dump do banco é gerado, comprimido e nomeado pelo dia, com registro em execucoes_backup"
    requirement: "BKP-01"
    verification:
      - kind: integration
        ref: "npm run test:backup — gera o dump dentro do contêiner do Postgres de teste e confere arquivo, integridade e linha registrada"
        status: unknown
    human_judgment: false
  - id: D2
    description: "O dump é enviado ao armazenamento externo e o resultado do envio é registrado"
    requirement: "BKP-02"
    verification:
      - kind: integration
        ref: "npm run test:backup — sem destino configurado, o envio é pulado e destino_externo_ok fica falso; com um destino local simulado, fica verdadeiro"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Rotação de 14 dias e retenção mensal no dia 1º"
    requirement: "BKP-03"
    verification:
      - kind: integration
        ref: "npm run test:backup — arquivos antigos plantados somem, os recentes ficam, e com o dia forçado em 01 a cópia mensal aparece"
        status: unknown
    human_judgment: false
  - id: D4
    description: "Um backup pode ser disparado sob demanda antes de qualquer migração"
    requirement: "BKP-05"
    verification:
      - kind: integration
        ref: "npm run test:backup — a execução sob demanda produz arquivo com hora no nome e não sobrescreve o dump do dia"
        status: unknown
    human_judgment: false
  - id: D5
    description: "Um dump é restaurado num Postgres limpo e os dados conferem"
    requirement: "BKP-06"
    verification:
      - kind: integration
        ref: "npm run test:backup — os dados são apagados, o dump é restaurado e as linhas conhecidas voltam idênticas"
        status: unknown
    human_judgment: false
  - id: D6
    description: "Restaurar sem confirmação explícita é recusado, sem escrever nada"
    requirement: "BKP-06"
    verification:
      - kind: integration
        ref: "npm run test:backup — a chamada sem a confirmação sai diferente de zero e o banco continua intacto"
        status: unknown
    human_judgment: false
---

<objective>
Escrever os dois scripts que são o coração desta fase — o que gera o backup e o que o transforma
de volta em banco — e prová-los **sem servidor**, dentro do Postgres efêmero de teste.

Purpose: sem serviço gerenciado, o dump é a única rede de proteção que existe. E um backup nunca
testado não é um backup: descobrir que o arquivo estava vazio no dia em que você precisa dele é o
pior momento possível. Provar a ida e a volta num teste automatizado é o que impede que essa
descoberta aconteça em produção.

Output: `scripts/backup.sh`, `scripts/restaurar.sh` e `npm run test:backup`, que exercita os dois
de ponta a ponta contra um banco de verdade.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-06-SUMMARY.md
</context>

<constraints>
- **O `cron` do host dispara o backup, nunca o Compose** — ele não tem agendador; um serviço
  declarado nele roda uma vez e morre. Este plano escreve o script; instalar o agendamento é
  roteiro do plano 08.
- **Shell POSIX puro** (`#!/bin/sh`), sem construções exclusivas de um interpretador. O mesmo
  arquivo precisa rodar no host Ubuntu e dentro da imagem alpine do Postgres, que é o que torna o
  teste possível sem servidor.
- **Nenhum segredo em arquivo versionado.** O script lê o arquivo de ambiente do servidor; o
  endereço da conta do Drive do ateliê **não aparece em lugar nenhum do repositório**, nem em
  comentário — só o nome do destino configurado, que vem de variável.
- **Nada de exclusão silenciosa.** Restaurar substitui dados; o script diz o que será perdido e
  exige confirmação explícita.
- Mensagens em português, dizendo o que fazer.
</constraints>

<tasks>

<task type="auto">
  <name>Tarefa 1: `scripts/backup.sh` — dump, rotação, retenção mensal, envio externo e registro</name>
  <files>scripts/backup.sh, .env.example, package.json</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §7 inteiro (as quatro camadas, o caminho e o nome do
      arquivo, a rotação, a retenção mensal, a linha do agendador, o disparo sob demanda) e §9
      (as colunas que o script grava e por que registrar em tabela é mais robusto que inspecionar
      arquivo)
    - `docker/compose.yml` (nomes de serviço e de variáveis de ambiente)
    - `db/schema.ts`, tabela `execucoes_backup` (as colunas exatas)
    - `docs/operacao/01-preparar-servidor.md`, passo 8 (o formato do arquivo de ambiente do
      servidor e onde ele vive)
    - `scripts/testar-e2e.mjs` (o tom de comentário e de mensagem já em uso)
  </read_first>
  <action>
    Escreva `scripts/backup.sh` em shell POSIX, com `set -eu` e um cabeçalho comentado explicando,
    em três frases, o que ele faz, quem o dispara e por que não é um serviço do Compose.

    **Configuração, toda por variável com padrão de produção**, para que o teste possa trocar cada
    peça sem editar o script:

    - o arquivo de ambiente a carregar (padrão: o do diretório de produção; carregado só se
      existir);
    - o diretório dos backups (padrão: o subdiretório `backups` do diretório de produção) e o
      subdiretório `mensais` dentro dele;
    - o comando de dump e o comando de cliente do Postgres (padrão: a forma que executa dentro do
      contêiner `postgres` pelo Compose, sem alocar terminal — é assim que o host alcança o banco,
      já que ele não tem porta publicada);
    - usuário e banco (vindos do arquivo de ambiente);
    - o destino externo (vindo do arquivo de ambiente; **vazio significa não enviar**);
    - os dias de retenção (padrão 14);
    - o dia do mês (padrão: o dia corrente) — parametrizado de propósito, para que a regra da
      retenção mensal seja testável sem esperar o dia 1º.

    **Fluxo:**

    1. Aceita a opção de disparo sob demanda. Sem ela, o arquivo se chama pelo padrão
      `amassa-AAAA-MM-DD.sql.gz`. Com ela, o nome ganha hora e minuto, para não sobrescrever o
      dump do dia — este é o comando que se roda antes de toda migração, e ele não pode destruir
      a única cópia limpa do dia.
    2. Cria o diretório de backups se não existir.
    3. Gera o dump, comprime, e **confere o resultado**: o arquivo existe, tem tamanho maior que
      zero, e passa no teste de integridade do compressor. Um dump que falhou no meio produz um
      arquivo truncado que parece um backup — conferir a integridade é o que separa os dois. Se a
      conferência falhar, apague o arquivo defeituoso: um arquivo quebrado no diretório é pior que
      nenhum, porque a rotação vai preservá-lo e alguém vai confiar nele.
    4. Se o dia do mês for o primeiro, copia o arquivo para o subdiretório mensal, que **nunca** é
      limpo.
    5. Rotação: apaga do diretório de backups os arquivos com o padrão de nome do dump e idade
      maior que os dias de retenção. **Não** desça no subdiretório mensal — limite a busca ao
      primeiro nível. Esse é o detalhe que, se esquecido, faz a retenção mensal existir por dois
      meses e sumir depois.
    6. Se houver destino externo configurado, envia o arquivo com `rclone`. Registre o resultado.
      Sem destino configurado, pule o envio e registre a cópia externa como **não** confirmada —
      nunca como sucesso.
    7. Grava a linha em `execucoes_backup` com sucesso, tamanho em bytes, estado da cópia externa
      e a mensagem de erro quando houver. Passe a mensagem ao cliente do Postgres por **variável
      do próprio cliente**, com aspas aplicadas por ele, e não interpolada na instrução — uma
      mensagem de erro do sistema pode conter aspas, e concatenar texto em instrução SQL é como
      esse tipo de script quebra em silêncio.
    8. A gravação acontece **em toda saída**, inclusive na de erro: instale uma armadilha de saída
      que registre a falha antes de o script morrer. Um backup que falha sem registrar é
      indistinguível, para `/api/health/backup`, de um backup que nem tentou.
    9. Sai zero no sucesso e diferente de zero em qualquer falha, para que a linha no log do
      agendador seja legível.

    Cada bloco com um comentário curto em português dizendo o que resolve.

    Em `.env.example`, confirme que a variável do destino externo já está declarada sem valor e
    acrescente, se faltar, a do diretório de backups. Acrescente ao `package.json` um alias que
    roda o teste do próximo passo.
  </action>
  <verify>
    <automated>sh -n scripts/backup.sh</automated>
  </verify>
  <acceptance_criteria>
    - `sh -n scripts/backup.sh` sai 0 — o arquivo é shell POSIX válido.
    - `head -1 scripts/backup.sh` é a linha de interpretador POSIX, não a de um interpretador
      estendido.
    - `grep -cE '\[\[|function |local ' scripts/backup.sh` devolve `0` — nenhuma construção
      exclusiva de interpretador estendido.
    - `grep -c 'gmail\|@gmail\|drive.google' scripts/backup.sh` devolve `0` — nenhum endereço de
      conta em lugar nenhum.
    - Toda variável de configuração tem padrão e pode ser trocada por ambiente.
    - `.env.example` continua sem nenhum valor preenchido.
  </acceptance_criteria>
  <done>Existe um script POSIX que gera, gira, guarda, envia e registra o backup, com toda configuração injetável.</done>
</task>

<task type="auto">
  <name>Tarefa 2: `scripts/restaurar.sh` — a volta, com confirmação e conferência</name>
  <files>scripts/restaurar.sh, README.md</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §7, subseção "Um backup nunca testado não é um backup"
    - `scripts/backup.sh` da tarefa 1 (as mesmas variáveis de configuração, o mesmo tom)
    - `amassa-plataforma/00-BRIEFING.md` §11, item 10 (nada de exclusão silenciosa)
    - `db/schema.ts` (as tabelas cujas contagens servem de conferência)
  </read_first>
  <action>
    Escreva `scripts/restaurar.sh`, também em shell POSIX, com as mesmas variáveis injetáveis do
    script de backup.

    Recebe o caminho do arquivo comprimido e o nome do banco de destino, mais uma opção de
    confirmação. **Sem a confirmação, ele não escreve nada**: imprime o que faria — qual arquivo,
    qual banco, e as contagens de linha atuais de cada tabela que serão substituídas — e sai
    diferente de zero com uma frase dizendo qual comando repetir com a confirmação. Restaurar
    substitui dados; a pessoa que roda isto está tendo um dia ruim, e o script tem que ser o
    adulto da conversa.

    Com a confirmação: confere primeiro a integridade do arquivo comprimido (recusar cedo um
    arquivo truncado evita destruir o banco atual para descobrir depois que o substituto estava
    quebrado), descomprime para a entrada do cliente do Postgres com a opção que **para no primeiro
    erro** — sem ela, o cliente engole erros e devolve zero, e você comemora uma restauração que
    não aconteceu — e ao final imprime as contagens de linha por tabela, para conferência imediata.

    A saída final é um resumo em português: arquivo restaurado, banco de destino, tabelas e
    quantas linhas cada uma tem. Esse resumo é o que transforma "rodei o comando" em "os dados
    conferem".

    No `README.md`, registre os dois scripts numa seção de operação, com a frase de que restaurar
    exige confirmação e por quê. Não escreva ali nenhum endereço de conta nem nome de destino
    real — apenas o nome da variável.
  </action>
  <verify>
    <automated>sh -n scripts/restaurar.sh</automated>
  </verify>
  <acceptance_criteria>
    - `sh -n scripts/restaurar.sh` sai 0.
    - Rodar sem a confirmação sai diferente de zero, imprime as contagens atuais e **não** executa
      nenhuma escrita.
    - Rodar com um arquivo truncado sai diferente de zero **antes** de tocar o banco.
    - A restauração usa a opção que interrompe no primeiro erro.
    - A saída final lista tabela e contagem de linhas.
    - `grep -cE '\[\[|function |local ' scripts/restaurar.sh` devolve `0`.
  </acceptance_criteria>
  <done>Existe um script que devolve um dump ao banco, recusa fazer isso por acidente e mostra o resultado para conferência.</done>
</task>

<task type="auto">
  <name>Tarefa 3: `npm run test:backup` — a ida e a volta provadas sem servidor</name>
  <files>scripts/testar-backup.mjs, package.json, .github/workflows/entrega.yml, README.md</files>
  <read_first>
    - `scripts/testar-e2e.mjs` inteiro (como o Postgres efêmero sobe, espera ficar saudável, e é
      derrubado no `finally`; e o cuidado com programas que no Windows são script e precisam de
      interpretador)
    - `docker/compose.teste.yml`
    - `db/migrate.ts` e `db/index.ts`
    - `scripts/backup.sh` e `scripts/restaurar.sh` das tarefas 1 e 2
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md` (os defeitos que só
      apareceram fora da máquina de desenvolvimento — este teste existe para antecipar os
      equivalentes desta fase)
  </read_first>
  <action>
    `scripts/testar-backup.mjs` orquestra a prova completa contra o Postgres efêmero. A ideia
    central: os dois scripts rodam **dentro do contêiner do Postgres**, que já tem o cliente, o
    gerador de dump, o compressor e um shell POSIX — e não tem `rclone`, o que exercita de graça o
    caminho sem destino externo. Copie os scripts para dentro com `docker cp` em vez de montar
    volume: caminho de host montado em volume é a peça que quebra no Windows, e a Fase 1 já pagou
    por essa lição uma vez.

    Sequência:

    1. Sobe o Postgres efêmero e espera ficar saudável (mesmo padrão do teste de ponta a ponta),
      publicando a porta só pela linha de comando.
    2. Aplica as migrações e insere linhas conhecidas: uma em `usuarios`, com nome e e-mail
      inventados de domínio `exemplo.test`, e uma na tabela de verificação de infraestrutura, com
      um texto reconhecível. São elas que provam que os dados voltaram — e não apenas que o
      comando saiu zero.
    3. Copia o diretório de scripts para dentro do contêiner.
    4. **Backup do dia.** Executa o script com os comandos do Postgres apontando para os binários
      locais, o diretório de backups num caminho interno, e o destino externo vazio. Afirma: saída
      zero; existe um arquivo com o nome do dia; o arquivo tem tamanho maior que zero; ele passa
      no teste de integridade do compressor; e `execucoes_backup` ganhou uma linha com sucesso
      verdadeiro, tamanho maior que zero e cópia externa **falsa**.
    5. **Backup sob demanda.** Executa de novo com a opção de disparo imediato. Afirma que o
      arquivo do dia **continua existindo** e que apareceu um segundo arquivo com hora no nome —
      é o requisito de disparar antes de uma migração sem perder o dump limpo do dia.
    6. **Rotação e retenção mensal.** Planta arquivos com data antiga no diretório (usando a opção
      de definir carimbo do utilitário de toque) e um arquivo antigo dentro do subdiretório
      mensal. Executa o script com o dia do mês forçado em `01`. Afirma: os arquivos antigos do
      primeiro nível sumiram; os recentes ficaram; a cópia mensal do dia apareceu; e **o arquivo
      antigo do subdiretório mensal continua lá** — o par que prova que a rotação não desce.
    7. **Envio externo confirmado.** Repita uma execução com o destino externo apontando para um
      caminho local dentro do contêiner e o comando de envio trocado por uma cópia simples, e
      afirme que a linha registrada sai com a cópia externa **verdadeira**. É o outro lado do
      par do passo 4: sem ele, "sempre falso" passaria despercebido.
    8. **A volta.** Apaga as linhas conhecidas das duas tabelas, confirma que sumiram, executa a
      restauração **sem** a confirmação e afirma que ela recusou e não escreveu nada; executa
      **com** a confirmação e afirma que as duas linhas conhecidas voltaram, com o mesmo conteúdo,
      e que a saída lista tabela e contagem.
    9. Derruba tudo no `finally`, sempre.

    Cada afirmação com mensagem em português dizendo o que faltou. Acrescente o alias
    `test:backup` ao `package.json` e um passo no job `e2e` do workflow que o executa — o runner
    tem Docker e já usa o Postgres de teste, então o custo é baixo e o retorno é um backup que não
    apodrece em silêncio entre uma fase e outra. Registre no `README.md` o comando e o que ele
    garante.
  </action>
  <verify>
    <automated>npm run test:backup</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:backup` sai 0 na máquina de desenvolvimento, subindo e derrubando o Postgres
      efêmero sozinho.
    - As oito etapas afirmam explicitamente, cada uma, e a mensagem de falha nomeia a etapa.
    - Os três pares em sentidos opostos estão presentes: cópia externa falsa e verdadeira;
      restauração recusada e aceita; arquivo antigo do primeiro nível apagado e arquivo antigo do
      subdiretório mensal preservado.
    - As linhas conhecidas voltam com o mesmo conteúdo depois da restauração, conferido campo a
      campo — não apenas pela contagem.
    - `npm run test:backup` sai diferente de zero se `scripts/backup.sh` for alterado para não
      registrar a linha; prove essa inversão e registre a observação no SUMMARY.
    - O teste não monta volume de host no contêiner.
    - `grep -c 'db:migrate' .github/workflows/entrega.yml` continua devolvendo `0`.
  </acceptance_criteria>
  <done>Um comando único prova que o backup gera, gira, envia, registra — e que um dump volta a ser banco com os dados conferidos.</done>
</task>

</tasks>

<!-- planner-discipline-allow: db:migrate -->

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `cron` do host → contêiner do Postgres | um processo do host executa comando dentro do contêiner do banco |
| script de backup → armazenamento externo | os dados do ateliê saem do servidor aqui |
| arquivo de dump em disco → sistema de arquivos do host | o dump é o banco inteiro, em texto, fora do contêiner |
| operador → `restaurar.sh` | um comando substitui o banco de produção |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-32 | Information Disclosure | arquivos em `/opt/amassa/backups` | high | mitigate | O diretório é criado sob o diretório de produção, cujo acesso já é restrito; o roteiro do plano 08 fixa permissão restritiva no diretório e nos arquivos |
| T-02a-33 | Information Disclosure | credencial do destino externo | high | mitigate | A configuração do envio vive fora do repositório; o script só lê o nome do destino por variável, e nenhum endereço de conta aparece em arquivo versionado |
| T-02a-34 | Tampering | instrução SQL montada com mensagem de erro do sistema | medium | mitigate | A mensagem entra por variável do cliente do Postgres, com aspas aplicadas por ele, nunca concatenada na instrução |
| T-02a-35 | Denial of Service | dump truncado tratado como válido | high | mitigate | Conferência de integridade do arquivo comprimido logo após a geração, e remoção do arquivo defeituoso; a restauração confere de novo antes de tocar o banco |
| T-02a-36 | Repudiation | execução que falha sem deixar rastro | high | mitigate | Armadilha de saída grava a linha de falha em `execucoes_backup` em qualquer caminho de término |
| T-02a-37 | Denial of Service | restauração acidental sobre o banco de produção | critical | mitigate | Confirmação explícita obrigatória; sem ela o script apenas mostra o que seria perdido e sai diferente de zero |
| T-02a-38 | Tampering | rotação apagando a retenção mensal | high | mitigate | A busca da rotação é limitada ao primeiro nível; o teste afirma o par "antigo do primeiro nível apagado, antigo do mensal preservado" |
</threat_model>

<verification>
1. `sh -n scripts/backup.sh` e `sh -n scripts/restaurar.sh` saem 0.
2. `npm run test:backup` sai 0 com as oito etapas.
3. O job `e2e` do workflow executa `test:backup` e continua verde.
4. `npm run lint`, `npm test`, `npm run verificar-acoes`, `npm run test:migracoes` e
   `npm run test:e2e` continuam saindo 0.
5. Nenhum endereço de conta, nenhum segredo e nenhum dado real em arquivo versionado.
</verification>

<success_criteria>
- O dump diário é gerado, comprimido, conferido e registrado (BKP-01).
- O envio externo acontece e seu resultado é registrado, inclusive quando não acontece (BKP-02).
- A rotação de 14 dias funciona e a retenção mensal sobrevive a ela (BKP-03).
- O disparo sob demanda existe e não destrói o dump do dia (BKP-05).
- Um dump volta a ser banco, com os dados conferidos campo a campo (BKP-06, provado sem servidor).

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `scripts/backup.sh` | dump, compressão, conferência de integridade, retenção mensal, rotação, envio externo, registro em `execucoes_backup`, opção de disparo sob demanda |
| `scripts/restaurar.sh` | conferência prévia, confirmação obrigatória, restauração que para no primeiro erro, resumo de contagens |
| `scripts/testar-backup.mjs` | alias npm `test:backup`, oito etapas com três pares em sentidos opostos |
| `.github/workflows/entrega.yml` | passo `test:backup` no job `e2e` |
</success_criteria>

## Risks

- Rodar os scripts dentro da imagem alpine do Postgres depende de utilitários do conjunto
  reduzido (compressor, busca, toque com carimbo). Se algum não aceitar a opção usada, a correção
  é escolher a forma que o conjunto reduzido aceita — **não** trocar o interpretador para um
  estendido, porque é justamente a portabilidade que permite provar o script sem servidor.
- A prova local não cobre o envio real para a conta do Drive do ateliê, que exige credencial. Esse
  lado é do plano 08, e é por isso que o par "cópia externa falsa e verdadeira" existe aqui: ele
  prova a lógica, e o roteiro prova o caminho.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-07-SUMMARY.md` when done
</output>
