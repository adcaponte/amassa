---
phase: 02a-login-banco-base-e-backup
plan: 03
subsystem: auth
tags: [next-auth, argon2, rate-limiting, playwright, vitest]

# Dependency graph
requires:
  - phase: 02a-01
    provides: "Auth.js v5 dividido em auth.config.ts/auth.ts, tabela usuarios, lib/auth/senha.ts
      (gerarHash/conferirHash sobre @node-rs/argon2), a tela de login provisória e o globalSetup
      do Playwright (tests/e2e/apoio/preparar-usuario.ts) que cria a conta de teste"
provides:
  - "lib/auth/tentativas.ts: módulo puro sem nenhum import — decisão e transição de estado do
    limite de tentativas (5 erros / 15min de janela / 15min de bloqueio), com janela deslizante"
  - "lib/auth/tentativas-memoria.ts: casca em memória (mapa no escopo do módulo + limpeza
    preguiçosa das entradas vencidas) que envolve o módulo puro com Date.now() real"
  - "lib/auth/credenciais.ts: avaliação de credenciais em tempo constante — a conferência de
    hash roda em todos os caminhos (usuário certo, senha errada, sem usuário, desativado, hash
    corrompido), e os quatro caminhos de recusa são objetos idênticos"
  - "lib/auth/auth.ts: authorize() consulta o contador ANTES do banco, avalia credenciais
    (senha.ts injetado), e registra erro/acerto no fim; classe ErroBloqueado (CredentialsSignin)
    carrega os segundos restantes até liberar"
  - "lib/auth/acoes.ts (movido de app/(auth)/login/acoes.ts): distingue ErroBloqueado de
    credenciais inválidas e redireciona para mensagens diferentes"
  - "Tela de login com mensagem única por role=alert, mensagem distinta de bloqueio com
    minutos, e estado de carregamento no botão (app/(auth)/login/botao-entrar.tsx)"
affects: [02a-04, 02a-05, 02a-06, 02a-07, 02a-08]

# Actuals (#2632)
actuals:
  tokens: 8200
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo puro sem NENHUM import (lib/auth/tentativas.ts): recebe estado + instante como
      argumento, nunca lê o relógio — janelas de tempo testadas em milissegundos, sem
      setTimeout nem dependência do relógio real"
    - "Avaliação de credenciais recebe a função de conferência de hash como argumento
      (lib/auth/credenciais.ts) em vez de importar @node-rs/argon2 — tempo constante provado
      por contagem de chamadas do mock, não por inspeção"
    - "Hash de referência gerado uma única vez, na inicialização do processo, a partir de um
      valor aleatório descartado em seguida — nunca uma constante escrita no arquivo"
    - "CredentialsSignin subclassada (ErroBloqueado) para carregar dado estruturado
      (segundosParaLiberar) através da fronteira signIn()/Server Action, sem serialização —
      confirmado lendo @auth/core que rethrow preserva a instância original quando raw+!isRedirect"

key-files:
  created:
    - lib/auth/tentativas.ts
    - lib/auth/tentativas-memoria.ts
    - lib/auth/credenciais.ts
    - lib/auth/acoes.ts
    - app/(auth)/login/botao-entrar.tsx
    - tests/unit/tentativas.test.ts
    - tests/unit/credenciais.test.ts
    - tests/e2e/autenticacao.spec.ts
  modified:
    - lib/auth/auth.ts
    - app/(auth)/login/page.tsx
  removed:
    - app/(auth)/login/acoes.ts

key-decisions:
  - "ErroBloqueado.code = 'bloqueado' e segundosParaLiberar carregam a decisão de bloqueio até
    lib/auth/acoes.ts sem precisar de uma segunda consulta — verificado nas fontes de
    @auth/core (node_modules/@auth/core/index.js) que o erro lançado por authorize() chega
    intacto ao catch da Server Action (raw + !isRedirect → rethrow do objeto original)"
  - "avaliarCredenciais compara contra usuario.senhaHash quando o usuário existe (mesmo
    desativado) e contra um hashDeReferencia só quando não existe — ambos os casos chamam a
    conferência de hash exatamente uma vez, igualando o tempo de resposta sem precisar de um
    hash literal no arquivo"
  - "tests/e2e/autenticacao.spec.ts roda em modo serial (test.describe.configure) — sem isso, a
    contenção de recursos (seis idas e voltas reais com argon2 em cada um dos dois projetos,
    somadas às outras specs, tudo em paralelo) fazia o teste de bloqueio estourar o timeout por
    concorrência de CPU/conexões de banco neste ambiente, não por defeito de lógica (isolado ou
    com --workers=2 o mesmo teste sempre passou em ~1s)"

patterns-established:
  - "page.waitForResponse((r) => r.request().method() === 'POST') para sincronizar cada volta
    de um laço de submissões de formulário com mensagem de erro IDÊNTICA entre iterações —
    sem isso, expect().toHaveText() passa sobre o DOM da iteração anterior antes da resposta
    da atual chegar, e o laço avança rápido demais (bug real encontrado e corrigido nesta
    execução, ver Deviations)"
  - "getByRole('alert') escopado a page.locator('form') nas specs de login — o Next.js injeta
    um route announcer próprio com role=alert fora do formulário, e sem o escopo o modo
    estrito do Playwright falha com dois elementos"

requirements-completed: [AUTH-03, AUTH-04]

coverage:
  - id: D1
    description: "Senha errada e e-mail inexistente mostram exatamente a mesma mensagem, em português"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "tests/unit/credenciais.test.ts#os quatro caminhos de recusa devolvem objetos indistinguíveis"
        status: pass
      - kind: e2e
        ref: "tests/e2e/autenticacao.spec.ts#e-mail que não existe mostra exatamente a mesma mensagem que senha errada"
        status: pass
    human_judgment: false
  - id: D2
    description: "A comparação de hash é executada mesmo quando o e-mail não existe"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "tests/unit/credenciais.test.ts#usuário não existe: recusa com a MESMA constante, e a conferência de hash roda uma vez contra o hash de referência"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cinco erros no mesmo e-mail em 15 minutos bloqueiam por 15 minutos"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "tests/unit/tentativas.test.ts#o quinto pedido passa e o sexto é recusado (prova os dois lados do limite)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/autenticacao.spec.ts#a sexta tentativa seguida no mesmo e-mail mostra a mensagem de bloqueio com os minutos"
        status: pass
    human_judgment: false
  - id: D4
    description: "O bloqueio expira sozinho depois de 15 minutos e um acerto zera o contador"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "tests/unit/tentativas.test.ts#o bloqueio expira sozinho 15 minutos e um segundo depois do quinto erro"
        status: pass
      - kind: e2e
        ref: "tests/e2e/autenticacao.spec.ts#entrar com a senha certa depois de um erro anterior (abaixo do limite) funciona"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 03: Mensagem Única e Limite de Tentativas Summary

**Contador de tentativas puro com janela deslizante (5 erros/15min → bloqueio de 15min),
avaliação de credenciais em tempo constante com hash de referência gerado no boot, e a tela de
login ligando os dois — provado por 19 testes unitários e 4 specs e2e nos dois projetos.**

## Performance

- **Duration:** ~31 min
- **Started:** 2026-08-08T02:05:39+01:00 (primeiro commit RED da Tarefa 1)
- **Completed:** 2026-08-08T02:36:37+01:00
- **Tasks:** 3 (2 com ciclo TDD RED/GREEN + 1 auto)
- **Files modified:** 11 (9 novos, 2 modificados, 1 removido/movido)

## Accomplishments

- `lib/auth/tentativas.ts` é um módulo puro **sem nenhum import**, testado nas fronteiras da
  janela de 15 minutos (o quinto erro ainda libera, o sexto recusa; um erro fora da janela não
  conta; o bloqueio expira sozinho 15 minutos e um segundo depois do quinto erro).
- `lib/auth/credenciais.ts` prova por teste que os quatro caminhos de recusa (senha errada,
  e-mail sem conta, usuário desativado, hash corrompido) são **objetos idênticos** e que a
  conferência de hash roda **exatamente uma vez** em todos eles — inclusive contra um hash de
  referência gerado uma única vez, na inicialização do processo, a partir de um valor aleatório
  descartado em seguida.
- `lib/auth/auth.ts` liga as duas peças: o contador decide antes de qualquer consulta ao banco
  (bloqueio nunca consulta a tabela `usuarios`), e uma segunda mensagem, distinta, avisa quantos
  minutos faltam quando bloqueado — sem confundir bloqueio com senha errada.
- `tests/e2e/autenticacao.spec.ts` prova pela tela, nos dois projetos (desktop e celular): a
  igualdade exata de texto entre senha errada e e-mail inexistente, a sexta tentativa bloqueada
  com o número de minutos, a quinta ainda liberada, e o acerto zerando o contador.

## Task Commits

1. **Tarefa 1: `lib/auth/tentativas.ts` — o contador de erros, como decisão pura**
   - `6c8920c` (test — RED: teste falho, módulo ainda não existia)
   - `071b845` (feat — GREEN: módulo puro + casca em memória)
2. **Tarefa 2: `lib/auth/credenciais.ts` — uma mensagem só, e o hash sempre conferido**
   - `200c119` (test — RED: teste falho, módulo ainda não existia)
   - `9e44685` (feat — GREEN: avaliação de credenciais em tempo constante)
3. **Tarefa 3: Ligar as proteções ao login e provar pela tela**
   - `3fcb82a` (feat: auth.ts, acoes.ts, tela de login, e2e)

**Plan metadata:** commit final deste SUMMARY, a seguir.

## Files Created/Modified

- `lib/auth/tentativas.ts` - constantes (`LIMITE_DE_ERROS`, `JANELA_EM_MINUTOS`,
  `BLOQUEIO_EM_MINUTOS`) e `avaliarPedido`/`registrarErro`/`registrarAcerto` puras, sem nenhum
  import
- `lib/auth/tentativas-memoria.ts` - mapa no escopo do módulo + `avaliarPedidoAgora`/
  `registrarErroAgora`/`registrarAcertoAgora`, com limpeza preguiçosa das entradas vencidas
- `lib/auth/credenciais.ts` - `MENSAGEM_CREDENCIAIS_INVALIDAS` e `avaliarCredenciais` (hash
  injetado, hash de referência injetado, zero imports de runtime)
- `lib/auth/auth.ts` - `authorize()` reordenado (contador → banco → credenciais → registro) e
  classe `ErroBloqueado` (subclasse de `CredentialsSignin`)
- `lib/auth/acoes.ts` (novo local; era `app/(auth)/login/acoes.ts`) - distingue `ErroBloqueado`
  de `AuthError` genérico e redireciona para mensagens diferentes
- `app/(auth)/login/page.tsx` - mensagem por `role="alert"`, texto único importado da mesma
  constante de `credenciais.ts`, mensagem de bloqueio com minutos
- `app/(auth)/login/botao-entrar.tsx` - componente cliente minúsculo com `useFormStatus` para o
  estado de carregamento do botão
- `tests/unit/tentativas.test.ts` - 11 testes cobrindo o bloco de comportamento completo
- `tests/unit/credenciais.test.ts` - 8 testes cobrindo os seis casos + igualdade dos quatro
  caminhos de recusa
- `tests/e2e/autenticacao.spec.ts` - 4 specs × 2 projetos = 8 execuções, modo serial

## Decisions Made

- **`ErroBloqueado` carrega `segundosParaLiberar` através da exceção**, não por uma segunda
  consulta: confirmado nas fontes do `@auth/core` que o erro lançado por `authorize()` chega
  intacto ao `catch` da Server Action (nenhuma serialização de rede envolvida, é tudo o mesmo
  processo Node).
- **`avaliarCredenciais` compara contra `usuario.senhaHash`** quando o usuário existe (mesmo
  desativado) **e contra `hashDeReferencia`** só quando não existe — os dois caminhos chamam a
  conferência de hash exatamente uma vez, sem precisar de um hash literal escrito no arquivo.
- Ver também `key-decisions` no frontmatter (modo serial da spec e2e).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `getByRole("alert")` colidia com o "route announcer" do Next.js**
- **Found during:** Tarefa 3 (`npm run test:e2e`, primeira execução)
- **Issue:** O Next.js injeta um elemento próprio com `role="alert"` fora do formulário (para
  leitores de tela anunciarem navegação). Sem escopo, `page.getByRole("alert")` resolvia dois
  elementos e falhava em modo estrito.
- **Fix:** Todas as buscas por alerta escopadas a `page.locator("form").getByRole("alert")` —
  ainda uma busca por papel, não por classe de estilo (mantém a exigência do plano).
- **Files modified:** tests/e2e/autenticacao.spec.ts
- **Verification:** `npm run test:e2e` — os quatro specs passam a resolver o elemento certo.
- **Committed in:** `3fcb82a` (Tarefa 3)

**2. [Rule 1 - Bug] Laço de 5 tentativas perdia submissões por causa de mensagem idêntica entre iterações**
- **Found during:** Tarefa 3 (`npm run test:e2e`, depurado com `console.error` temporário em
  `authorize()` e `tentativas-memoria.ts`)
- **Issue:** As cinco primeiras tentativas do teste de bloqueio mostram o MESMO texto
  (`MENSAGEM_CREDENCIAIS_INVALIDAS`). `await expect(alerta).toHaveText(...)` passava sobre o DOM
  da iteração ANTERIOR antes da resposta da tentativa ATUAL chegar, e o laço avançava rápido
  demais — a depuração mostrou o servidor recebendo `senha-errada-1`, `senha-errada-2`,
  `senha-errada-4`, `senha-errada-6` (pulando exatamente a metade das submissões), então só 4
  dos 5 erros esperados chegavam a ser registrados e a sexta tentativa nunca via o bloqueio.
- **Fix:** Cada iteração agora monta `page.waitForResponse((r) => r.request().method() ===
  "POST")` ANTES do clique e aguarda essa resposta antes de checar o texto — sincroniza
  explicitamente cada volta do laço com o pedido que ela mesma disparou.
- **Files modified:** tests/e2e/autenticacao.spec.ts
- **Verification:** depuração isolada (`--grep "sexta tentativa" --workers=1`) confirmou as seis
  chamadas a `authorize()` na ordem certa (`senha-errada-1` a `senha-errada-6`), com o sexto
  bloqueado corretamente.
- **Committed in:** `3fcb82a` (Tarefa 3)

**3. [Rule 1 - Bug] Teste de bloqueio estourava o timeout sob a carga cheia da suíte**
- **Found during:** Tarefa 3 (`npm run test:e2e`, execuções completas subsequentes)
- **Issue:** Com os quatro testes de `autenticacao.spec.ts` e os três de `fundacao.spec.ts`
  rodando em paralelo nos dois projetos (14 execuções simultâneas, `fullyParallel: true`), o
  teste de bloqueio do projeto `desktop` estourava consistentemente o timeout (`page.waitForResponse`
  nunca resolvia). Isolado (`--grep`, `--workers=1`, ou `--workers=2`) o mesmo teste sempre
  passava em ~1 a 3 segundos — não é uma trava de lógica, é contenção de recursos (CPU/conexões
  de banco) deste ambiente sob carga máxima.
- **Fix:** `tests/e2e/autenticacao.spec.ts` roda em modo serial
  (`test.describe.configure({ mode: "serial" })`) — os quatro testes do arquivo deixam de
  competir entre si, o que também elimina a corrida teórica (já documentada e limitada) sobre a
  conta de e-mail compartilhada entre os testes de senha errada/senha certa. Custa alguns
  segundos a mais na corrida completa da suíte.
- **Files modified:** tests/e2e/autenticacao.spec.ts
- **Verification:** `npm run test:e2e` (comando exato do `<verify>` do plano) rodado duas vezes
  seguidas, 14/14 testes passando nas duas vezes.
- **Committed in:** `3fcb82a` (Tarefa 3)

---

**Total deviations:** 3 auto-fixed (todos Rule 1 — bugs de teste descobertos ao rodar o próprio
`npm run test:e2e`, não faltas de funcionalidade da aplicação). **Impact on plan:** nenhum
desvio de escopo; os três são correções necessárias para o `<verify>` da Tarefa 3 passar de
forma confiável, como o plano exige.

## Issues Encountered

- **Depuração do laço de 5 tentativas exigiu instrumentação temporária.** Adicionei
  `console.error` em `authorize()` (contando chamadas e mostrando `decisaoDeTentativas`) e em
  `tentativas-memoria.ts` (mostrando o estado antes/depois de cada leitura e escrita), rodei
  `npx playwright test --grep "sexta tentativa" --workers=1` isoladamente contra um banco de
  teste recém-criado, e só então a causa real (mensagens idênticas mascarando submissões
  perdidas) ficou visível na ordem das senhas recebidas pelo servidor. Toda a instrumentação foi
  removida antes do commit — confirmado com `grep -n "console\." lib/auth/*.ts` retornando
  vazio.
- **A hipótese inicial (custo de argon2) estava errada.** Medi diretamente: uma conferência de
  hash argon2id leva ~20ms neste ambiente, e 16 em paralelo levam ~137ms no total — muito abaixo
  do necessário para explicar um timeout de 30s. A causa real era a corrida de sincronização do
  teste (deviation 2), não o custo do algoritmo. A deviation 3 (modo serial) foi uma decisão de
  robustez separada, tomada depois de confirmar que o teste sempre passa isolado.

## User Setup Required

None - nenhuma configuração externa necessária nesta etapa.

## Next Phase Readiness

- As três proteções mínimas de login exigidas por `01-ARQUITETURA.md` §4 estão completas e
  testadas: mensagem única, tempo constante, e limite de tentativas com bloqueio.
- `lib/auth/acoes.ts` (novo local) é o ponto de extensão esperado pelos próximos planos da 2a —
  o comentário no arquivo já avisa que ele não toca o banco, para o portão `exigirUsuario()` do
  plano 05 não ser confundido com um esquecimento aqui.
- Sem bloqueios. O padrão `page.waitForResponse` para sincronizar laços de submissão com
  mensagens idênticas fica disponível para qualquer spec e2e futura com o mesmo formato.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*

## Self-Check: PASSED

Todos os 11 arquivos de `key-files` + este SUMMARY confirmados com `[ -f ... ]`, a remoção de
`app/(auth)/login/acoes.ts` confirmada, e os 5 hashes citados (`6c8920c`, `071b845`, `200c119`,
`9e44685`, `3fcb82a`) confirmados em `git log --oneline --all`.
