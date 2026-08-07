---
phase: 02a-login-banco-base-e-backup
plan: 03
type: execute
wave: 2
depends_on: ["02a-01"]
files_modified:
  - lib/auth/tentativas.ts
  - lib/auth/tentativas-memoria.ts
  - lib/auth/credenciais.ts
  - lib/auth/acoes.ts
  - lib/auth/auth.ts
  - app/(auth)/login/page.tsx
  - tests/unit/tentativas.test.ts
  - tests/unit/credenciais.test.ts
  - tests/e2e/autenticacao.spec.ts
autonomous: true
requirements: [AUTH-03, AUTH-04]

estimate:
  tokens: 58000
  raw_tokens: 58000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Senha errada e e-mail inexistente mostram exatamente a mesma mensagem, em português, dizendo o que fazer (critério 2 do ROADMAP)"
    - "A comparação de hash é executada mesmo quando o e-mail não existe, para que o tempo de resposta não denuncie quais e-mails existem"
    - "Cinco erros no mesmo e-mail em 15 minutos bloqueiam aquele e-mail por 15 minutos (critério 3 do ROADMAP)"
    - "O bloqueio expira sozinho depois de 15 minutos, sem intervenção"
    - "Um acerto zera o contador de erros daquele e-mail"
  artifacts:
    - lib/auth/tentativas.ts
    - lib/auth/tentativas-memoria.ts
    - lib/auth/credenciais.ts
    - lib/auth/acoes.ts
    - tests/unit/tentativas.test.ts
    - tests/unit/credenciais.test.ts
    - tests/e2e/autenticacao.spec.ts
  key_links:
    - "A função de checagem de credenciais de `lib/auth/auth.ts` consulta o contador ANTES de tocar o banco e registra o resultado DEPOIS"
    - "A mesma constante de mensagem é usada nos dois caminhos de falha — não há dois textos parecidos"
    - "O contador vive em memória do processo: é uma instância só, e reiniciar a aplicação zera o bloqueio (aceito por escrito)"

coverage:
  - id: D1
    description: "Senha errada mostra uma mensagem clara em português, idêntica à de e-mail inexistente"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "tests/unit/credenciais.test.ts#os dois caminhos de falha devolvem a mesma constante de mensagem"
        status: unknown
      - kind: e2e
        ref: "tests/e2e/autenticacao.spec.ts#senha errada e e-mail inexistente mostram o mesmo texto"
        status: unknown
    human_judgment: false
  - id: D2
    description: "A comparação de hash é sempre executada, mesmo com e-mail inexistente"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "tests/unit/credenciais.test.ts#a conferencia de hash e chamada uma vez mesmo sem usuario"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Errar a senha 5 vezes no mesmo e-mail em 15 minutos bloqueia por 15 minutos"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "tests/unit/tentativas.test.ts#o sexto pedido dentro da janela e recusado"
        status: unknown
      - kind: e2e
        ref: "tests/e2e/autenticacao.spec.ts#a sexta tentativa mostra a mensagem de bloqueio"
        status: unknown
    human_judgment: false
  - id: D4
    description: "O bloqueio expira sozinho depois de 15 minutos e um acerto zera o contador"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "tests/unit/tentativas.test.ts#o bloqueio expira e o acerto zera o contador"
        status: unknown
    human_judgment: false
---

<objective>
Fechar as três proteções mínimas de login que `01-ARQUITETURA.md` §4 exige: mensagem única para
os dois motivos de falha, comparação de hash sempre executada, e limite de tentativas por e-mail.

Purpose: as duas primeiras impedem que a tela de login vire um verificador de "esse e-mail existe
aqui?" — pelo texto ou pelo tempo de resposta. A terceira transforma um ataque de dicionário de
minutos num de semanas. Nenhuma das três é visível quando funciona, e é justamente por isso que
cada uma precisa nascer com teste próprio.

Output: dois módulos puros testados, o contador em memória, a ligação com o provedor de
credenciais, e o estado de erro da tela de login em linguagem humana.
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
- **D-03: nenhum componente shadcn.** O estado de erro é HTML com classes utilitárias.
- **D-07: nenhum e-mail ou nome real** em teste algum. Domínio `exemplo.test`.
- Regras de decisão em **módulos puros** (`lib/auth/tentativas.ts`, `lib/auth/credenciais.ts`):
  recebem dados, devolvem dados, não importam React nem o cliente do banco. É a regra da pasta
  `lib/` e é o que torna estes testes rápidos e determinísticos.
- Mensagem de erro em linguagem humana, dizendo o que fazer. Nada de código de status como texto.
- Toda entrada validada com Zod no servidor.
- Nenhum log registra senha, hash, nem diferencia os dois motivos de falha.
</constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: `lib/auth/tentativas.ts` — o contador de erros, como decisão pura</name>
  <files>lib/auth/tentativas.ts, lib/auth/tentativas-memoria.ts, tests/unit/tentativas.test.ts</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §4, subseção "Proteções mínimas de login"
    - `lib/saude.ts` e `tests/unit/saude.test.ts` (o formato de módulo puro e de teste já em uso)
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md`, "Claude's Discretion"
      (onde o contador mora é decisão sua)
  </read_first>
  <behavior>
    Todas as funções recebem o instante atual como argumento — nunca leem o relógio por dentro.
    É isso que torna as janelas de tempo testáveis sem esperar 15 minutos.

    - Estado vazio, primeiro pedido para `alguem@exemplo.test`: liberado.
    - Quatro erros registrados, quinto pedido: ainda liberado. O limite são cinco **erros**, e o
      bloqueio começa depois deles.
    - Cinco erros registrados dentro de 15 minutos, sexto pedido: **recusado**, e a decisão
      informa quantos segundos faltam para liberar.
    - Cinco erros registrados, sexto pedido 15 minutos e um segundo depois do quinto erro:
      liberado, e o estado daquele e-mail volta a zero.
    - Quatro erros, o quinto 16 minutos depois do primeiro: liberado — erros fora da janela não
      contam. A janela desliza, não é um balde que só esvazia no fim.
    - Um acerto registrado zera o contador daquele e-mail imediatamente.
    - Erros em `alguem@exemplo.test` não afetam `outra@exemplo.test`: o limite é por e-mail.
    - E-mails que diferem só na caixa são o mesmo e-mail: `Alguem@Exemplo.test` e
      `alguem@exemplo.test` compartilham contador.
    - Registrar erro para um e-mail que não existe no sistema funciona igual — o contador não
      consulta o banco e portanto não sabe nem pode vazar quais e-mails existem.
  </behavior>
  <action>
    Escreva primeiro `tests/unit/tentativas.test.ts` com os casos acima, rode e confirme que
    falham, e só então implemente.

    `lib/auth/tentativas.ts` é puro e sem estado global: exporta as constantes do limite (cinco
    erros), da janela (15 minutos) e da duração do bloqueio (15 minutos), mais funções que
    recebem o estado atual, o e-mail e o instante, e devolvem a decisão e o **novo** estado. Não
    mutar o estado recebido facilita o teste e elimina uma classe inteira de bug.

    `lib/auth/tentativas-memoria.ts` é a casca suja: guarda o estado num mapa no escopo do módulo
    e expõe duas funções de conveniência que leem o relógio e delegam ao módulo puro. Um
    comentário no topo registra que o contador em memória basta porque é **uma instância só** —
    decisão escrita em `01-ARQUITETURA.md` §4 — e que reiniciar a aplicação zera os bloqueios,
    o que é aceito. Inclua também uma limpeza preguiçosa das entradas vencidas, para o mapa não
    crescer sem fim com e-mails inventados por quem estiver sondando.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/tentativas.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/unit/tentativas.test.ts` sai 0 com todos os casos do bloco de
      comportamento cobertos, inclusive os três de fronteira de tempo.
    - Nenhum teste do arquivo chama `setTimeout`, dorme, nem depende do relógio real — todos
      passam o instante como argumento.
    - `lib/auth/tentativas.ts` não tem nenhum import.
    - O teste do limite prova os dois lados: o quinto pedido passa e o sexto é recusado.
  </acceptance_criteria>
  <done>O contador de tentativas é uma decisão pura, testada nas fronteiras, e a casca em memória o envolve.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: `lib/auth/credenciais.ts` — uma mensagem só, e o hash sempre conferido</name>
  <files>lib/auth/credenciais.ts, tests/unit/credenciais.test.ts</files>
  <read_first>
    - `amassa-plataforma/01-ARQUITETURA.md` §4, subseção "Proteções mínimas de login"
    - `lib/auth/senha.ts` (o envoltório de hash criado no plano 01)
    - `lib/auth/auth.ts` (a função de checagem de credenciais que vai consumir este módulo)
    - `tests/unit/saude.test.ts`
  </read_first>
  <behavior>
    A função recebe: o registro de usuário encontrado (ou nada), a senha digitada, e a função de
    conferência de hash injetada como argumento. Devolve o usuário autenticado ou uma recusa.

    - Usuário existe, está ativo, senha confere: devolve o usuário.
    - Usuário existe, está ativo, senha não confere: recusa com a constante de mensagem.
    - Usuário **não** existe: recusa com **exatamente a mesma constante**, e a função de
      conferência de hash foi chamada **uma vez** — contra um hash de referência fixo, para que o
      tempo gasto seja o mesmo do caminho em que o usuário existe.
    - Usuário existe mas está com `ativo` falso: recusa com a mesma constante, e a conferência de
      hash também foi executada. Um usuário desativado não pode ser distinguido de um inexistente
      nem pelo texto nem pelo tempo.
    - A conferência de hash lança (hash corrompido no banco): recusa com a mesma constante, sem
      vazar o erro interno para a tela.
    - Em todos os caminhos de recusa, o objeto devolvido é indistinguível: mesmo texto, mesma
      forma, nenhum campo extra dizendo qual foi o motivo.
  </behavior>
  <action>
    Escreva primeiro `tests/unit/credenciais.test.ts`, com uma função de conferência de hash falsa
    que conta chamadas, rode e confirme que falha, e só então implemente.

    `lib/auth/credenciais.ts` exporta a constante `MENSAGEM_CREDENCIAIS_INVALIDAS` — texto único,
    em português, em linguagem humana, dizendo o que fazer ("Confira o e-mail e a senha e tente de
    novo." é a forma; ajuste a redação se soar melhor, mas mantenha uma só constante) — e a função
    de avaliação descrita no bloco de comportamento. A função é pura: recebe a conferência de hash
    como argumento em vez de importar o módulo nativo, e por isso não arrasta o hash para o grafo
    de módulos de quem a importa.

    O hash de referência usado no caminho sem usuário é gerado **uma vez, na inicialização do
    processo**, a partir de um valor aleatório descartado em seguida — nunca uma constante escrita
    no arquivo, que num repositório público é só um convite a alguém conferir o custo do
    parâmetro. Um comentário registra que ele existe para igualar o tempo de resposta, não para
    autenticar ninguém.

    Deixe escrito no comentário do módulo que a mensagem é única de propósito: dizer "e-mail não
    encontrado" transformaria a tela de login num verificador de quem tem conta no ateliê.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/credenciais.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/unit/credenciais.test.ts` sai 0 com os seis casos do bloco de
      comportamento.
    - O teste afirma explicitamente que a conferência de hash foi chamada exatamente uma vez no
      caminho sem usuário e no caminho com usuário desativado.
    - O teste compara os objetos de recusa dos quatro caminhos e afirma que são iguais.
    - `lib/auth/credenciais.ts` importa apenas tipos — nenhum módulo de runtime.
    - `grep -c 'não encontrado' lib/auth/credenciais.ts` devolve `0` e `grep -c 'inexistente' lib/auth/credenciais.ts` devolve `0`.
  </acceptance_criteria>
  <done>Os dois motivos de falha são indistinguíveis pelo texto e pelo tempo, e isso está provado por teste.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Ligar as proteções ao login e provar pela tela</name>
  <files>lib/auth/auth.ts, lib/auth/acoes.ts, app/(auth)/login/page.tsx, tests/e2e/autenticacao.spec.ts</files>
  <read_first>
    - `lib/auth/auth.ts` e `app/(auth)/login/page.tsx` como ficaram no plano 01
    - `lib/auth/tentativas.ts`, `lib/auth/tentativas-memoria.ts` e `lib/auth/credenciais.ts` das
      tarefas 1 e 2
    - `tests/e2e/fundacao.spec.ts` e `tests/e2e/apoio/preparar-usuario.ts` (como a conta de teste
      chega às specs)
    - `amassa-plataforma/00-BRIEFING.md` §11, itens 7 e 9 (estados de tela e mensagem humana)
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §4, o aviso sobre campo de formulário abaixo de 16px
  </read_first>
  <action>
    Extraia a ação de entrada da página para `lib/auth/acoes.ts`, marcado como código de servidor.
    A ação valida e-mail e senha com Zod, normaliza o e-mail para minúsculas, e chama a entrada do
    Auth.js. Ela devolve à tela um estado de erro com texto pronto — nunca uma exceção crua, nunca
    um código. Este arquivo **não** toca o banco: quem consulta é a função de checagem de
    credenciais do provedor, dentro de `lib/auth/auth.ts`. Deixe isso escrito num comentário, para
    que o portão de autorização do plano 05 não seja confundido com um esquecimento aqui.

    Em `lib/auth/auth.ts`, a função de checagem passa a fazer, nesta ordem:

    1. Consultar o contador em memória para o e-mail normalizado. Se estiver bloqueado, recusar
      imediatamente com uma **segunda** mensagem, distinta e específica, dizendo quantos minutos
      faltam — bloqueio não é credencial inválida, e esconder o bloqueio faria a pessoa certa
      achar que esqueceu a própria senha. Não consultar o banco neste caminho.
    2. Buscar o usuário por `lower(email)`, aproveitando o índice funcional.
    3. Chamar a avaliação de credenciais da tarefa 2, injetando a conferência de hash de
      `lib/auth/senha.ts`.
    4. Registrar erro ou acerto no contador conforme o resultado, e devolver.

    Na tela de login, mostre o estado de erro num elemento com papel de alerta, anunciado a leitor
    de tela, com contraste AA. Mantenha o campo de formulário com no mínimo 16px e o botão com
    alvo de toque de no mínimo 44px. Acrescente o estado de carregamento enquanto a ação corre —
    uma tela parada durante a espera é defeito, não detalhe. Sem componente de biblioteca: HTML e
    classes utilitárias.

    `tests/e2e/autenticacao.spec.ts` cobre, nos dois projetos:

    - Senha errada para a conta que existe: a mensagem aparece.
    - E-mail que não existe (domínio `exemplo.test`, nome inventado): a mensagem é **o mesmo
      texto**, comparado como string, não "parecida".
    - Cinco erros seguidos no mesmo e-mail e uma sexta tentativa: a mensagem de bloqueio aparece e
      cita minutos. Use um e-mail exclusivo desta spec para não bloquear a conta que as outras
      specs usam — o contador é por e-mail e vive no processo do servidor durante a corrida
      inteira. Registre esse cuidado num comentário: é o tipo de acoplamento que quebra um teste
      vizinho três semanas depois, sem explicação.
    - Entrar com a senha certa depois de erros anteriores (abaixo do limite) funciona — o acerto
      zera o contador.
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npm test &amp;&amp; npm run test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e` sai 0 nos projetos desktop e celular.
    - A spec afirma igualdade exata entre o texto mostrado para senha errada e o texto mostrado
      para e-mail inexistente.
    - A sexta tentativa seguida mostra a mensagem de bloqueio com o número de minutos, e a
      quinta ainda mostra a mensagem de credencial inválida.
    - O elemento de erro tem papel de alerta e é encontrado pela spec por papel, não por classe
      de estilo.
    - Nenhum componente sob `components/ui/` foi criado — `ls components/ui 2>/dev/null | wc -l`
      devolve `0`.
    - Nenhum arquivo de fonte foi acrescentado: `git ls-files | grep -cE '\.(woff2?|ttf|otf)$'`
      devolve `0`.
  </acceptance_criteria>
  <done>A tela de login recusa igual nos dois motivos, bloqueia na sexta tentativa e diz tudo isso em português.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → ação de entrada | e-mail e senha não confiáveis; ponto único de tentativa de adivinhação |
| ação de entrada → contador em memória | estado compartilhado entre pedidos dentro do processo |
| função de checagem → tabela `usuarios` | a consulta que revelaria, pelo tempo, quem tem conta |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-12 | Spoofing | tela de login | high | mitigate | Cinco erros por e-mail em 15 minutos bloqueiam por 15 minutos; janela deslizante testada nas fronteiras em `tests/unit/tentativas.test.ts` |
| T-02a-13 | Information Disclosure | mensagem de erro | high | mitigate | Constante única de mensagem para senha errada, e-mail inexistente e usuário desativado; igualdade exata afirmada em teste unitário e de ponta a ponta |
| T-02a-14 | Information Disclosure | tempo de resposta | medium | mitigate | Conferência de hash executada em todos os caminhos, inclusive sem usuário, contra um hash de referência gerado na inicialização |
| T-02a-15 | Denial of Service | contador em memória | medium | accept | Sondagem com e-mails inventados infla o mapa; mitigado por limpeza preguiçosa das entradas vencidas. Aceito porque é uma instância só, atrás de proxy, com 3 a 5 usuários reais — e porque bloquear por origem exigiria estado compartilhado que este sistema não tem |
| T-02a-16 | Tampering | entrada do formulário | medium | mitigate | Validação com Zod no servidor antes de qualquer consulta; validação no cliente é conveniência, não segurança |
| T-02a-17 | Information Disclosure | registros de log | medium | mitigate | Nenhum log grava senha, hash ou o motivo específico da recusa |
</threat_model>

<verification>
1. `npm test` sai 0, incluindo os dois arquivos novos de teste unitário.
2. `npm run test:e2e` sai 0 nos dois projetos.
3. `npm run lint` sai 0.
4. Nenhum componente de biblioteca, nenhum token de cor e nenhuma fonte foram acrescentados.
</verification>

<success_criteria>
- Senha errada e e-mail inexistente mostram o mesmo texto, provado por igualdade exata (AUTH-03).
- O hash é conferido em todos os caminhos, provado por contagem de chamadas (AUTH-03).
- A sexta tentativa dentro de 15 minutos é bloqueada, e o bloqueio expira sozinho (AUTH-04).

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `lib/auth/tentativas.ts` | `LIMITE_DE_ERROS`, `JANELA_EM_MINUTOS`, `BLOQUEIO_EM_MINUTOS`, decisão e transição de estado puras |
| `lib/auth/tentativas-memoria.ts` | contador no escopo do módulo + limpeza preguiçosa |
| `lib/auth/credenciais.ts` | `MENSAGEM_CREDENCIAIS_INVALIDAS`, avaliação pura de credenciais |
| `lib/auth/acoes.ts` | ação de servidor de entrada (validada com Zod) |
| `tests/unit/tentativas.test.ts`, `tests/unit/credenciais.test.ts` | provas das duas regras |
| `tests/e2e/autenticacao.spec.ts` | provas pela tela, nos dois projetos |
</success_criteria>

## Risks

- O contador vive no processo: reiniciar a aplicação libera bloqueios em curso. Aceito por
  escrito em `01-ARQUITETURA.md` §4 — é uma instância só, com 3 a 5 usuários.
- Specs de ponta a ponta que compartilham e-mail podem se bloquear entre si. Mitigado usando um
  e-mail exclusivo na spec de bloqueio, com o motivo comentado no arquivo.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-03-SUMMARY.md` when done
</output>
