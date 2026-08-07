---
phase: 02a-login-banco-base-e-backup
plan: 05
type: execute
wave: 3
depends_on: ["02a-01", "02a-02"]
files_modified:
  - scripts/redefinir-senha.ts
  - scripts/desativar-usuario.ts
  - scripts/verificar-acoes.mjs
  - tests/fixtures/acoes/conforme.ts
  - tests/fixtures/acoes/violando.ts
  - tests/fixtures/acoes/sem-banco.ts
  - tests/unit/verificar-acoes.test.ts
  - package.json
  - .github/workflows/entrega.yml
  - README.md
autonomous: true
requirements: [AUTH-08, AUTH-09, AUTH-10]

estimate:
  tokens: 60000
  raw_tokens: 60000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Redefinir a senha de um usuário pela linha de comando funciona e imprime a senha nova uma única vez (critério 5 do ROADMAP)"
    - "Desativar um usuário pela linha de comando funciona e não apaga nenhuma linha (critério 5 do ROADMAP)"
    - "Existe um comando que reprova, com nome de arquivo e linha, qualquer Server Action que toque o banco sem começar por `exigirUsuario()`"
    - "Esse comando roda no portão `qualidade` do pipeline, então uma violação barra o deploy"
  artifacts:
    - scripts/redefinir-senha.ts
    - scripts/desativar-usuario.ts
    - scripts/verificar-acoes.mjs
    - tests/unit/verificar-acoes.test.ts
    - tests/fixtures/acoes/
  key_links:
    - "Os três scripts de conta rodam pelo estágio `ferramentas`, nunca pela imagem `app` — ela não tem `tsx` nem devDependencies"
    - "O verificador usa o analisador de TypeScript já instalado; casar texto com expressão regular erraria em comentário e em cadeia de caracteres"
    - "O portão `qualidade` é o primeiro job da fila: uma violação para antes de qualquer imagem ser publicada"

coverage:
  - id: D1
    description: "Redefinir a senha de um usuário por linha de comando funciona"
    requirement: "AUTH-08"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — cenário que cria, redefine e confere que o hash mudou e que a senha antiga deixou de valer"
        status: unknown
    human_judgment: false
  - id: D2
    description: "Desativar um usuário por linha de comando tira o acesso sem apagar a linha"
    requirement: "AUTH-09"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — cenário que desativa e confere ativo falso com a linha ainda presente"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Nenhuma Server Action toca o banco sem passar por exigirUsuario() na primeira linha — verificado por máquina, não por inspeção"
    requirement: "AUTH-10"
    verification:
      - kind: unit
        ref: "tests/unit/verificar-acoes.test.ts#o verificador reprova a fixture violando e aprova a conforme"
        status: unknown
      - kind: integration
        ref: "npm run verificar-acoes contra o repositório inteiro, no job qualidade"
        status: unknown
    human_judgment: false
---

<objective>
Completar a operação de contas pela linha de comando — redefinir senha e desativar — e transformar
a regra mais importante de autorização do projeto num **portão de máquina**.

Purpose: `AUTH-10` diz que nenhuma Server Action toca o banco sem passar por `exigirUsuario()` na
primeira linha. `00-BRIEFING.md` §11 chama isso de "verificável em revisão de código". Revisão de
código é uma pessoa cansada às onze da noite. Nesta fase quase não existem Server Actions de
produto, então afirmar o critério por inspeção seria afirmar o vazio — e nas Fases 3 a 6 vão
existir dezenas. O portão precisa nascer agora, enquanto custa um script, e não depois, quando
custa uma auditoria.

Output: dois scripts de conta, um verificador baseado no analisador de TypeScript, fixtures que o
provam nos dois sentidos, e a ligação com o primeiro job do pipeline.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-01-SUMMARY.md
@.planning/phases/02a-login-banco-base-e-backup/02a-02-SUMMARY.md
</context>

<constraints>
- **D-07/D-08: nenhum nome, e-mail ou senha real** em arquivo algum. As senhas são geradas e
  impressas uma única vez no terminal do servidor; não há recuperação.
- Os comandos documentados são sempre `docker compose run --rm ferramentas npm run <alias> -- ...`.
- **Desativar é `ativo = false`.** Nenhum script apaga usuário.
- Toda entrada validada com Zod no servidor.
- Nenhuma dependência nova: o analisador de TypeScript já é dependência de desenvolvimento, e
  usá-lo evita abrir outro portão de legitimidade de pacote.
</constraints>

<tasks>

<task type="auto">
  <name>Tarefa 1: `redefinir-senha` e `desativar-usuario`</name>
  <files>scripts/redefinir-senha.ts, scripts/desativar-usuario.ts, package.json, README.md</files>
  <read_first>
    - `scripts/criar-usuario.ts` (o padrão de leitura de argumentos, validação, saída e código de
      saída, criado no plano 01)
    - `lib/auth/senha.ts` (geração e hash)
    - `amassa-plataforma/01-ARQUITETURA.md` §4 (os dois comandos, a caixa do estágio `ferramentas`
      e a decisão de imprimir a senha uma única vez)
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseção `usuarios`
    - `db/index.ts` e `db/schema.ts`
  </read_first>
  <action>
    `scripts/redefinir-senha.ts` — recebe `--email`, valida com Zod, busca o usuário por
    `lower(email)`, gera uma senha nova com o mesmo gerador de `criar-usuario`, grava o hash novo e
    imprime a senha uma única vez, na mesma linha de formato fixo que o script de criação usa (o
    formato é contrato: o apoio de teste de ponta a ponta o consome). Se o e-mail não existir, sai
    diferente de zero com uma frase em português dizendo que não há conta com aquele e-mail e
    sugerindo `criar-usuario` — aqui, ao contrário da tela de login, dizer a verdade é correto:
    quem roda isto já está dentro do servidor.

    `scripts/desativar-usuario.ts` — recebe `--email` e, opcionalmente, `--reativar`. Marca `ativo`
    como falso (ou verdadeiro com a opção), imprime o estado resultante e o aviso de que a pessoa
    perde o acesso na próxima requisição, sem que nada seja apagado. Emite um aviso claro se o
    usuário já estava no estado pedido, em vez de fingir que fez algo. **Nenhuma instrução de
    exclusão aparece neste arquivo** — desativar existe justamente para que apagar não seja
    necessário, e apagar quebraria o histórico de autoria das Fases 3 a 6.

    Acrescente os dois aliases ao `package.json`, no mesmo formato do alias de criação. Atualize a
    seção de operação do `README.md` com os três comandos completos, sempre pelo estágio
    `ferramentas` e sempre com nomes inventados no exemplo.

    Estenda `scripts/testar-migracoes.mjs` (criado no plano 02) com um cenário de contas que roda
    contra o Postgres efêmero: cria uma conta com dados inventados, confere que o hash grava, roda
    a redefinição e confere que o hash **mudou** e que a senha antiga deixou de conferir, roda a
    desativação e confere `ativo` falso **com a linha ainda presente**, roda a reativação e confere
    a volta. O par "mudou o hash" e "a senha antiga não confere mais" é o que distingue redefinir
    de reescrever o mesmo valor.
  </action>
  <verify>
    <automated>npm run test:migracoes</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:migracoes` sai 0 com o cenário de contas incluído.
    - Redefinir imprime uma linha começando pelo mesmo prefixo fixo que `criar-usuario` usa.
    - Depois da redefinição, o hash anterior não confere mais com a senha nova nem a senha antiga
      com o hash novo.
    - Depois da desativação, a consulta pela linha do usuário continua devolvendo uma linha, com
      `ativo` falso.
    - `grep -riE '\bdelete\b|\bdrop\b' scripts/desativar-usuario.ts scripts/redefinir-senha.ts | wc -l`
      devolve `0`.
    - Rodar qualquer um dos dois com um e-mail inexistente sai diferente de zero e imprime uma
      frase em português dizendo o que fazer.
  </acceptance_criteria>
  <done>As três operações de conta existem pela linha de comando e estão provadas contra um banco de verdade.</done>
</task>

<task type="auto">
  <name>Tarefa 2: `verificar-acoes` — o portão de máquina do `exigirUsuario()`</name>
  <files>scripts/verificar-acoes.mjs, tests/fixtures/acoes/conforme.ts, tests/fixtures/acoes/violando.ts, tests/fixtures/acoes/sem-banco.ts</files>
  <read_first>
    - `amassa-plataforma/00-BRIEFING.md` §11, item 3
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseção "Sem RLS — e o que ocupa o lugar dela"
    - `amassa-plataforma/01-ARQUITETURA.md` §5
    - `lib/auth/exigir-usuario.ts` e `lib/auth/acoes.ts` (os dois casos reais que o verificador vai
      encontrar hoje)
    - `scripts/testar-e2e.mjs` (o formato de script de nó já em uso, com saída em português)
  </read_first>
  <action>
    `scripts/verificar-acoes.mjs` recebe um ou mais diretórios raiz (padrão: `app` e `lib`) e
    percorre os arquivos `.ts` e `.tsx`. Para cada arquivo, use o analisador do compilador de
    TypeScript — que já é dependência de desenvolvimento — para montar a árvore sintática. Casar
    texto com expressão regular erraria dentro de comentário e de cadeia de caracteres, e o
    portão precisa ser confiável para valer alguma coisa.

    A regra, escrita em uma frase no topo do arquivo: **toda função marcada como código de servidor
    que esteja num arquivo que alcança o cliente do banco precisa ter, como primeira instrução do
    corpo, uma chamada a `exigirUsuario()`.**

    Detalhes que decidem se o portão é útil ou barulhento:

    - Reconheça as duas formas de marcação: a diretiva no topo do arquivo, que torna toda função
      exportada uma ação, e a diretiva dentro do corpo de uma função, que torna só aquela uma ação.
    - "Alcança o cliente do banco" é decidido pelos imports do próprio arquivo: o alias do
      diretório de banco, o caminho relativo equivalente, ou o módulo de schema. Um arquivo de
      ações que não importa nada disso não é cobrado — e um comentário registra que essa é a
      fronteira deliberada, porque a ação de entrada e a de saída não tocam o banco.
    - "Primeira instrução" ignora a própria diretiva e as declarações de tipo, e aceita tanto a
      chamada com espera quanto a atribuição do resultado a uma variável.
    - A saída lista **arquivo, linha, nome da função e o que fazer**, em português. Uma por linha,
      no formato que um terminal e um log de pipeline mostram igual. Código de saída diferente de
      zero se houver qualquer violação; zero e uma linha de resumo com a contagem de ações
      conferidas se não houver. Um portão que passa em silêncio absoluto é indistinguível de um
      portão quebrado — o resumo é o que prova que ele rodou.

    Crie três fixtures em `tests/fixtures/acoes/`, todas TypeScript válido que passa no lint:

    - `conforme.ts` — arquivo de ações que importa o cliente do banco e chama `exigirUsuario()` na
      primeira instrução. Deve ser aprovado.
    - `violando.ts` — mesma coisa, mas com uma consulta antes da chamada de autorização. Deve ser
      reprovado, e a mensagem precisa citar o nome da função.
    - `sem-banco.ts` — arquivo de ações que não importa o banco. Deve ser aprovado sem ser cobrado,
      provando que a fronteira funciona e que o portão não vai virar ruído.

    As fixtures nunca são importadas por código de produção. Um comentário no topo de cada uma diz
    que ela existe para exercitar o verificador.
  </action>
  <verify>
    <automated>node scripts/verificar-acoes.mjs app lib</automated>
  </verify>
  <acceptance_criteria>
    - `node scripts/verificar-acoes.mjs app lib` sai 0 e imprime uma linha de resumo com a
      contagem de ações conferidas.
    - `node scripts/verificar-acoes.mjs tests/fixtures/acoes` sai diferente de 0 e a saída cita o
      nome do arquivo, a linha e o nome da função de `violando.ts`.
    - `node scripts/verificar-acoes.mjs tests/fixtures/acoes` **não** cita `conforme.ts` nem
      `sem-banco.ts` na lista de violações.
    - O verificador não usa expressão regular para decidir a regra — a decisão vem da árvore
      sintática.
    - `npm run lint` continua saindo 0 com as fixtures no repositório.
  </acceptance_criteria>
  <done>Existe um comando que encontra, por análise sintática, qualquer ação que toque o banco sem autorização na primeira linha.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Ligar o portão ao pipeline e provar que ele barra</name>
  <files>tests/unit/verificar-acoes.test.ts, package.json, .github/workflows/entrega.yml, README.md</files>
  <read_first>
    - `.github/workflows/entrega.yml`, job `qualidade` (o primeiro da fila, e por que ele é o mais
      barato)
    - `scripts/verificar-acoes.mjs` e as fixtures da tarefa 2
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md` (o portão do pipeline provado
      nos dois sentidos, com um teste quebrado de propósito)
    - `tests/unit/saude.test.ts`
  </read_first>
  <action>
    `tests/unit/verificar-acoes.test.ts` invoca o verificador como processo filho contra o
    diretório de fixtures e afirma os dois sentidos: código de saída diferente de zero com a
    fixture violando presente, e código de saída zero quando apenas as duas fixtures aprovadas são
    apontadas. Afirma também que a mensagem de violação contém o nome da função — a mensagem é o
    produto, e um portão que só diz "falhou" devolve o problema ao ponto de partida.

    Acrescente ao `package.json` o alias `verificar-acoes`, apontando para os diretórios `app` e
    `lib`. No job `qualidade` do workflow, acrescente um passo que o executa, **depois** do lint e
    **antes** dos testes unitários: é o portão mais barato da fila e barra a corrida inteira antes
    de qualquer imagem ser construída.

    No `README.md`, registre em duas frases o que o portão garante e o que fazer quando ele
    reprovar — a pessoa que o encontrar vermelho daqui a seis meses vai chegar por ali.

    Prove o portão nos dois sentidos como a Fase 1 fez: introduza temporariamente uma violação num
    arquivo real de `lib/`, confirme que `npm run verificar-acoes` sai diferente de zero, desfaça e
    confirme que volta a zero. Registre a observação no SUMMARY; não deixe a violação no commit.
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run verificar-acoes &amp;&amp; npm test</automated>
  </verify>
  <acceptance_criteria>
    - `npm run verificar-acoes` sai 0 no repositório como está.
    - `npx vitest run tests/unit/verificar-acoes.test.ts` sai 0 e cobre os dois sentidos.
    - `grep -c 'verificar-acoes' .github/workflows/entrega.yml` devolve pelo menos `1`, e o passo
      está dentro do job `qualidade`.
    - O SUMMARY registra a observação da violação introduzida de propósito: portão vermelho,
      violação removida, portão verde.
    - `grep -c 'db:migrate' .github/workflows/entrega.yml` continua devolvendo `0` — nenhuma
      migração entrou no pipeline.
  </acceptance_criteria>
  <done>O portão do `exigirUsuario()` roda no primeiro job do pipeline e já foi observado barrando uma violação real.</done>
</task>

</tasks>

<!-- planner-discipline-allow: db:migrate -->

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| terminal do servidor → scripts de conta | quem roda já está dentro; o risco aqui é operar na conta errada, não invadir |
| código futuro → banco | toda Server Action das Fases 3 a 6 atravessa esta fronteira; o portão é o que a vigia |
| pipeline → publicação | uma violação precisa barrar antes de a imagem existir |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-23 | Elevation of Privilege | Server Actions das fases seguintes | critical | mitigate | `scripts/verificar-acoes.mjs` reprova, por análise sintática, ação que toque o banco sem `exigirUsuario()` na primeira instrução; roda no job `qualidade`, o primeiro da fila |
| T-02a-24 | Repudiation | remoção de usuário | high | mitigate | Nenhum script emite exclusão; desativar é `ativo` falso, afirmado por critério de aceite e pelo cenário de contas do teste de migrações |
| T-02a-25 | Information Disclosure | senha impressa no terminal | medium | accept | Decisão escrita (`01-ARQUITETURA.md` §4): a senha é impressa uma única vez, num terminal do servidor acessível só por chave SSH. A alternativa seria SMTP, domínio e mais uma conta para manter, para 3 a 5 pessoas que se conhecem |
| T-02a-26 | Tampering | argumentos de linha de comando | medium | mitigate | Validação com Zod antes de qualquer escrita; e-mail comparado em minúsculas contra o índice funcional |
| T-02a-27 | Denial of Service | portão barulhento demais | low | mitigate | A fronteira "só cobra arquivo que alcança o banco" e a fixture sem banco existem para impedir que o portão vire ruído e acabe desligado |
</threat_model>

<verification>
1. `npm run lint`, `npm run verificar-acoes`, `npm test` e `npm run test:migracoes` saem 0.
2. O job `qualidade` do workflow executa o verificador e continua verde.
3. O portão foi observado vermelho com uma violação real e verde depois de removida.
4. Nenhum e-mail, nome ou senha real aparece em arquivo versionado.
</verification>

<success_criteria>
- Redefinir senha pela linha de comando funciona e imprime a senha uma única vez (AUTH-08).
- Desativar pela linha de comando tira o acesso sem apagar nada (AUTH-09).
- A regra do `exigirUsuario()` é verificada por máquina e barra o pipeline (AUTH-10).

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `scripts/redefinir-senha.ts` | alias npm `redefinir-senha` |
| `scripts/desativar-usuario.ts` | alias npm `desativar-usuario` (com opção de reativar) |
| `scripts/verificar-acoes.mjs` | alias npm `verificar-acoes`; regra de autorização por árvore sintática |
| `tests/fixtures/acoes/` | `conforme.ts`, `violando.ts`, `sem-banco.ts` |
| `tests/unit/verificar-acoes.test.ts` | prova do portão nos dois sentidos |
| `.github/workflows/entrega.yml` | passo `verificar-acoes` no job `qualidade` |
| `scripts/testar-migracoes.mjs` | cenário de contas (criar, redefinir, desativar, reativar) |
</success_criteria>

## Risks

- O verificador pode reprovar código correto se a fronteira de "alcança o banco" for larga demais.
  Mitigado pela fixture sem banco e pelo comentário que documenta a fronteira. Se aparecer um
  falso positivo legítimo, a correção é ajustar a regra e registrar o caso — nunca desligar o
  portão nem abrir uma exceção por comentário, que é como esse tipo de portão morre.
- Fixtures são código TypeScript real dentro do repositório. Elas precisam continuar passando no
  lint e na compilação; se o `next build` reclamar delas, a saída é ajustá-las, não excluí-las da
  verificação.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-05-SUMMARY.md` when done
</output>
