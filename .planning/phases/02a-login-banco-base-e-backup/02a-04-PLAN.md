---
phase: 02a-login-banco-base-e-backup
plan: 04
type: execute
wave: 3
depends_on: ["02a-01", "02a-03"]
files_modified:
  - lib/auth/auth.config.ts
  - lib/auth/exigir-usuario.ts
  - lib/auth/acoes.ts
  - middleware.ts
  - app/(app)/page.tsx
  - app/(auth)/login/page.tsx
  - tests/unit/exigir-usuario.test.ts
  - tests/e2e/apoio/alternar-ativo.ts
  - tests/e2e/sessao.spec.ts
autonomous: true
requirements: [AUTH-05, AUTH-06, AUTH-09]

estimate:
  tokens: 56000
  raw_tokens: 56000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Depois de entrar, fechar e reabrir o navegador mantém a sessão — ela dura 30 dias e se renova a cada uso (critério 4 do ROADMAP)"
    - "Sair encerra a sessão de verdade: voltar no histórico não devolve o acesso (critério 4 do ROADMAP)"
    - "Um usuário com `ativo` falso perde o acesso na requisição seguinte, sem que nenhuma linha seja apagada (critério 5 do ROADMAP)"
    - "Toda página e toda ação que precisa de identidade a obtém por uma função só"
  artifacts:
    - lib/auth/exigir-usuario.ts
    - tests/unit/exigir-usuario.test.ts
    - tests/e2e/sessao.spec.ts
  key_links:
    - "A duração da sessão é declarada em `lib/auth/auth.config.ts`, que é o arquivo que o middleware importa — declarar só em `lib/auth/auth.ts` deixaria o middleware com outra régua"
    - "`exigirUsuario()` confere `ativo` **no banco**, não no token: o token continua válido por 30 dias depois de a conta ser desativada"
    - "O cabeçalho que impede armazenamento em cache das rotas protegidas é o que faz o botão de voltar do navegador não devolver a tela"

coverage:
  - id: D1
    description: "A sessão persiste por 30 dias ao fechar e reabrir o navegador"
    requirement: "AUTH-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#o cookie de sessao e persistente e vale cerca de 30 dias"
        status: unknown
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#um contexto novo com o estado salvo abre a raiz sem novo login"
        status: unknown
    human_judgment: false
  - id: D2
    description: "Sair encerra a sessão de verdade — voltar no histórico não devolve o acesso"
    requirement: "AUTH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#depois de sair o botao de voltar cai em /login"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Desativar um usuário (ativo = false) tira o acesso dele sem apagar o histórico de autoria"
    requirement: "AUTH-09"
    verification:
      - kind: unit
        ref: "tests/unit/exigir-usuario.test.ts#usuario inativo nao e devolvido"
        status: unknown
      - kind: e2e
        ref: "tests/e2e/sessao.spec.ts#conta desativada perde o acesso na requisicao seguinte e a linha continua no banco"
        status: unknown
    human_judgment: false
---

<objective>
Fechar o ciclo de vida da sessão: 30 dias renovados a cada uso, saída que encerra de verdade, e
`exigirUsuario()` como a única porta que devolve identidade a quem precisa dela.

Purpose: `exigirUsuario()` é o que ocupa o lugar da segurança em nível de linha que este projeto
deliberadamente não tem (`02-MODELO-DE-DADOS.md` §0). Ele existe a partir daqui porque é dele que
todas as fases seguintes vão depender — e porque sem conferência de `ativo` **no banco**, desativar
alguém só teria efeito 30 dias depois, quando o token dela vencesse.

Output: a duração da sessão declarada onde o middleware a enxerga, o cabeçalho que impede o botão
de voltar de devolver a tela, a função de autorização, e as três provas de ponta a ponta.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md
@.planning/phases/02a-login-banco-base-e-backup/02a-01-SUMMARY.md
@.planning/phases/02a-login-banco-base-e-backup/02a-03-SUMMARY.md
</context>

<constraints>
- **A divisão de borda continua valendo.** Nada que este plano acrescentar a
  `lib/auth/auth.config.ts` pode alcançar o módulo nativo de hash nem o cliente do banco.
  `tests/unit/auth-borda.test.ts` é o guarda e precisa continuar verde.
- **Desativar é marcar `ativo` como falso.** Nenhum caminho de código apaga usuário.
- **D-03: nenhum componente shadcn.** O botão de sair é HTML com classes utilitárias.
- Alvo de toque de no mínimo 44px; botão só com ícone precisa de rótulo acessível.
</constraints>

<tasks>

<task type="auto">
  <name>Tarefa 1: Sessão de 30 dias renovada a cada uso, e rota protegida que não fica em cache</name>
  <files>lib/auth/auth.config.ts, middleware.ts</files>
  <read_first>
    - `lib/auth/auth.config.ts`, `lib/auth/rotas-publicas.ts` e `middleware.ts` como ficaram no
      plano 01
    - `tests/unit/auth-borda.test.ts` (o que este arquivo tem permissão de importar)
    - `amassa-plataforma/01-ARQUITETURA.md` §4 ("Sessão longa (30 dias, renovada a cada uso).
      Ninguém quer digitar senha com barro na mão.") e §6 (a caixa sobre confiança no host)
    - `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md`, lista de decisões fechadas
      (cookie `httpOnly` + `secure` + `sameSite=lax`)
  </read_first>
  <action>
    Em `lib/auth/auth.config.ts`, declare explicitamente a duração da sessão em 30 dias e a
    renovação a cada uso (o intervalo a partir do qual o token é reescrito — 24 horas é uma
    escolha razoável e barata: renova uma vez por dia de uso em vez de a cada requisição).
    Declare também, de forma explícita, as três propriedades do cookie de sessão: só acessível
    pelo servidor, exigindo canal seguro, e política de mesmo sítio relaxada. Elas são o padrão da
    biblioteca hoje; escrevê-las é o que impede que uma atualização mude a política em silêncio.

    Este arquivo é o que o middleware importa. Declarar a duração só no arquivo de runtime deixaria
    o middleware medindo a sessão com outra régua — o tipo de divergência que produz
    "funciona, mas às vezes desloga".

    Em `middleware.ts`, envolva o manipulador para acrescentar, **apenas nas respostas de rota
    protegida**, o cabeçalho que proíbe o navegador de guardar a página. Sem ele, o botão de
    voltar serve a tela do cache do próprio navegador depois da saída, e a pessoa vê conteúdo do
    ateliê sem sessão — que é exatamente o que AUTH-06 proíbe. As rotas públicas de
    `lib/auth/rotas-publicas.ts` não recebem o cabeçalho.

    Não acrescente nenhum import novo a `lib/auth/auth.config.ts` além de tipos e do módulo puro
    de rotas públicas.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/auth-borda.test.ts &amp;&amp; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/unit/auth-borda.test.ts` continua saindo 0 — a divisão de borda
      sobreviveu.
    - `npm run build` compila com `middleware.ts` presente.
    - A duração declarada corresponde a 30 dias em segundos, e está escrita como expressão legível
      (dias × horas × minutos × segundos), não como um número solto.
    - Uma requisição a uma rota protegida devolve o cabeçalho que proíbe armazenamento; uma
      requisição a `/login` e a `/api/health` não devolve.
  </acceptance_criteria>
  <done>A sessão dura 30 dias pela régua que o middleware usa, e rota protegida não fica guardada no navegador.</done>
</task>

<task type="auto">
  <name>Tarefa 2: `exigirUsuario()` — a única porta — e a saída que encerra de verdade</name>
  <files>lib/auth/exigir-usuario.ts, lib/auth/acoes.ts, app/(app)/page.tsx, app/(auth)/login/page.tsx, tests/unit/exigir-usuario.test.ts</files>
  <read_first>
    - `amassa-plataforma/02-MODELO-DE-DADOS.md` §0, subseção "Sem RLS — e o que ocupa o lugar dela"
    - `amassa-plataforma/01-ARQUITETURA.md` §4 (última lista) e §5
    - `lib/auth/auth.ts`, `lib/auth/acoes.ts` e `app/(app)/page.tsx` como ficaram nos planos 01 e 03
    - `db/schema.ts` (a tabela `usuarios`)
    - `lib/saude.ts` (o padrão de separar decisão pura de efeito)
  </read_first>
  <action>
    Crie `lib/auth/exigir-usuario.ts` com duas coisas, deliberadamente separadas:

    - Uma função **pura** que recebe o registro de usuário lido do banco (ou nada) e devolve o
      usuário autorizado ou uma recusa com o motivo. É o que o teste unitário exercita, sem banco
      e sem sessão.
    - `exigirUsuario()`, a casca: lê a sessão pelo Auth.js, busca o usuário pelo identificador do
      token na tabela `usuarios`, passa o resultado pela função pura e, na recusa, redireciona
      para `/login` com um marcador na consulta indicando que a sessão foi encerrada. Na
      aceitação, devolve identificador, nome, e-mail e papel — nunca o hash.

    A conferência de `ativo` acontece **no banco, a cada uso**, não no token. O token vale 30 dias:
    conferir nele faria "desativar alguém" significar "daqui a um mês". Deixe isso escrito no
    comentário do módulo, junto com a regra de que toda Server Action que toca o banco começa por
    esta função na primeira linha — o plano 05 transforma essa regra num portão de máquina.

    Em `lib/auth/acoes.ts`, acrescente a ação de saída: encerra a sessão pelo Auth.js e leva para
    `/login`. Ela não toca o banco, e um comentário registra isso para que o portão do plano 05
    não seja lido como esquecimento.

    Em `app/(app)/page.tsx`, chame `exigirUsuario()` na primeira linha do componente de servidor e
    mostre o nome de quem entrou, mais um botão de sair que dispara a ação. HTML e classes
    utilitárias; alvo de toque de no mínimo 44px. Continua sendo a tela provisória — a Fase 2b
    substitui o conteúdo, não a autorização.

    Em `app/(auth)/login/page.tsx`, quando o marcador de sessão encerrada estiver presente na
    consulta, mostre uma frase curta em linguagem humana dizendo que a sessão foi encerrada e para
    entrar de novo. A frase é a mesma para sessão vencida e conta desativada — dizer "sua conta foi
    desativada" para quem só ficou 31 dias sem entrar seria confuso, e dizer para quem está sondando
    seria informação de graça.

    `tests/unit/exigir-usuario.test.ts` cobre a função pura: usuário ativo devolvido; usuário
    inativo recusado; usuário ausente recusado; o objeto devolvido não contém o hash da senha.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/exigir-usuario.test.ts &amp;&amp; npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/unit/exigir-usuario.test.ts` sai 0 com os quatro casos.
    - O teste afirma explicitamente que a chave do hash de senha não existe no objeto devolvido.
    - `app/(app)/page.tsx` chama `exigirUsuario()` antes de qualquer outra instrução do componente.
    - `npx vitest run tests/unit/auth-borda.test.ts` continua saindo 0 — nada do que foi criado
      aqui vazou para o arquivo de configuração de borda.
    - O botão de sair é alcançável por papel e por rótulo em português.
  </acceptance_criteria>
  <done>Existe uma função só que devolve identidade autorizada, e a saída encerra a sessão pela ação de servidor.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Provar os 30 dias, a saída e a desativação — pela tela, nos dois projetos</name>
  <files>tests/e2e/apoio/alternar-ativo.ts, tests/e2e/sessao.spec.ts</files>
  <read_first>
    - `tests/e2e/apoio/preparar-usuario.ts` (como a conta de teste chega às specs)
    - `tests/e2e/autenticacao.spec.ts` e `tests/e2e/fundacao.spec.ts`
    - `playwright.config.ts` (os dois projetos e o reaproveitamento de servidor)
    - `db/index.ts` (o cliente já disponível para o apoio de teste)
    - `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md`, o padrão "teste de porta em
      par": uma afirmação sozinha costuma ser ambígua; duas em sentidos opostos localizam a causa
  </read_first>
  <action>
    Crie `tests/e2e/apoio/alternar-ativo.ts`: um auxiliar que liga e desliga a coluna `ativo` de um
    e-mail no banco de teste, pelo cliente `pg` que o projeto já usa. Ele **atualiza**, nunca
    apaga — e um comentário registra que apagar quebraria o histórico de autoria, que é a razão de
    a coluna existir.

    `tests/e2e/sessao.spec.ts`, rodando nos dois projetos:

    1. **Cookie persistente de 30 dias.** Depois de entrar, leia os cookies do contexto, encontre
      o cookie de sessão do Auth.js e afirme duas coisas: que ele **tem** data de expiração (um
      cookie de sessão sem data morreria ao fechar o navegador, que é o oposto de AUTH-05) e que
      essa data cai a cerca de 30 dias dali, com folga de um dia para os dois lados. Afirme também
      que o cookie não é acessível por script e que a política de mesmo sítio é a relaxada.
    2. **Reabrir o navegador.** Salve o estado de armazenamento, crie um contexto novo a partir
      dele, abra a raiz e afirme que ela responde autenticada sem passar pela tela de login. É a
      tradução fiel de "fechar e reabrir o navegador".
    3. **Sair de verdade.** Entre, abra a raiz, clique em sair, confirme que caiu em `/login`, e
      então volte no histórico do navegador. Afirme que o endereço final é `/login` e que o nome
      de quem tinha entrado **não** está visível. Este é o caso que o cabeçalho de não-cache da
      tarefa 1 existe para fazer passar; sem ele o navegador serve a tela antiga.
    4. **Conta desativada.** Entre, confirme o acesso à raiz, desligue `ativo` pelo auxiliar,
      recarregue a raiz e afirme que caiu em `/login` com a frase de sessão encerrada. Em seguida
      afirme, consultando o banco, que a linha do usuário **continua existindo** — a prova em par
      de AUTH-09: o acesso saiu, o registro ficou. Religue `ativo` ao final para não contaminar as
      outras specs.

    Use e-mails exclusivos desta spec, com nomes inventados e domínio `exemplo.test`, para não
    esbarrar no contador de tentativas nem nas contas das outras specs.
  </action>
  <verify>
    <automated>npm run test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e` sai 0 nos projetos desktop e celular com os quatro casos acima.
    - O caso do cookie afirma presença de data de expiração **e** proximidade de 30 dias — as duas,
      não uma.
    - O caso da saída afirma o endereço final **e** a ausência do nome na tela.
    - O caso da desativação afirma a perda de acesso **e** a permanência da linha no banco.
    - Nenhum e-mail ou nome real aparece na spec.
    - `npm test` e `npm run lint` continuam saindo 0.
  </acceptance_criteria>
  <done>Os três comportamentos de sessão estão provados por teste que roda no portão do pipeline.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → cookie de sessão | o token vive no cliente por 30 dias; é o alvo mais valioso do sistema |
| cache do navegador → tela protegida | conteúdo do ateliê guardado fora do controle do servidor |
| token válido → usuário desativado | a janela entre desativar alguém e o token dela vencer |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02a-18 | Spoofing | cookie de sessão | high | mitigate | Cookie só do servidor, exigindo canal seguro, com política de mesmo sítio relaxada, declarados explicitamente em `lib/auth/auth.config.ts` e afirmados na spec de sessão |
| T-02a-19 | Elevation of Privilege | usuário desativado com token válido | high | mitigate | `exigirUsuario()` confere `ativo` no banco a cada uso, não no token; provado pelo caso de desativação da spec |
| T-02a-20 | Information Disclosure | cache do navegador depois da saída | medium | mitigate | Cabeçalho de não-armazenamento nas respostas de rota protegida; provado pelo caso do botão de voltar |
| T-02a-21 | Information Disclosure | mensagem de sessão encerrada | low | mitigate | Uma frase só para sessão vencida e conta desativada — não confirma o estado da conta de ninguém |
| T-02a-22 | Spoofing | sessão longa de 30 dias | medium | accept | Sessão longa é decisão de produto escrita (`01-ARQUITETURA.md` §4): o sistema é usado de pé, no ateliê, com a mão suja. Compensada pelo cookie endurecido, pela conferência de `ativo` a cada uso e pela ausência de porta pública para o banco |
</threat_model>

<verification>
1. `npm test` sai 0, incluindo `tests/unit/exigir-usuario.test.ts` e `tests/unit/auth-borda.test.ts`.
2. `npm run test:e2e` sai 0 nos dois projetos.
3. `npm run build` compila com `middleware.ts` presente.
4. `npm run lint` sai 0.
</verification>

<success_criteria>
- A sessão dura 30 dias e sobrevive a fechar e reabrir o navegador (AUTH-05).
- Sair encerra de verdade, inclusive contra o botão de voltar (AUTH-06).
- Desativar tira o acesso na requisição seguinte e não apaga nada (AUTH-09).

## Artifacts this phase produces

Criados por este plano:

| Artefato | Símbolo / conteúdo |
|---|---|
| `lib/auth/exigir-usuario.ts` | avaliação pura de autorização + `exigirUsuario()` |
| `lib/auth/acoes.ts` | ação de servidor de saída |
| `lib/auth/auth.config.ts` | duração de 30 dias, renovação e propriedades explícitas do cookie |
| `middleware.ts` | cabeçalho de não-armazenamento nas rotas protegidas |
| `tests/e2e/apoio/alternar-ativo.ts` | auxiliar de teste que liga e desliga `ativo` |
| `tests/e2e/sessao.spec.ts` | quatro provas de ciclo de vida de sessão |
| `tests/unit/exigir-usuario.test.ts` | prova da regra de autorização |
</success_criteria>

## Risks

- O botão de voltar do navegador é servido por cache em alguns motores mesmo com o cabeçalho
  correto. Se o caso 3 ficar instável, a correção é fortalecer o cabeçalho, nunca enfraquecer a
  afirmação do teste — o comportamento é o requisito.
- A leitura do cookie de sessão depende do nome que a biblioteca usa, que muda entre ambiente
  seguro e inseguro. Localize o cookie por sufixo do nome, não por igualdade exata.

<output>
Create `.planning/phases/02a-login-banco-base-e-backup/02a-04-SUMMARY.md` when done
</output>
