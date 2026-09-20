---
phase: quick-260920-jxb
plan: 1
subsystem: auth
tags: [pg-pool, postgres, auth.js, playwright, e2e, turbopack]

# Dependency graph
requires: []
provides:
  - "db/index.ts com connectionTimeoutMillis=5000 — o pool do pg deixa de esperar sem limite
    por uma conexão livre; a espera agora falha rápido, com a MESMA mensagem humana de
    credenciais inválidas na tela de login (nunca stack crua nem app/error.tsx)"
  - "tests/unit/pool-conexao.test.ts — guarda de regressão para connectionTimeoutMillis nunca
    voltar a ficar ausente/0"
  - "ACHADO NOVO (WINDOWS #34, aberto): o contador de tentativas em memória
    (lib/auth/tentativas-memoria.ts) não é um singleton verdadeiro entre a rota REST do Auth.js
    e a Server Action de login nesta build (Next.js 16.3.5 + Turbopack + output: standalone) —
    confirmado empiricamente, não corrigido, requer investigação própria"
affects: [tests/e2e/autenticacao.spec.ts, lib/auth]

tech-stack:
  added: []
  patterns:
    - "Erros lançados dentro de authorize() que não são AuthError/CredentialsSignin são
      embrulhados pelo @auth/core em CallbackRouteError (subclasse de AuthError) antes de
      chegar ao chamador — por isso `if (erro instanceof AuthError)` em lib/auth/acoes.ts já
      captura QUALQUER falha interna do provedor (incluindo um timeout de pool), não só senha
      errada. Nenhuma mudança de código foi necessária para isso já funcionar assim."

key-files:
  created:
    - tests/unit/pool-conexao.test.ts
  modified:
    - db/index.ts
    - .planning/WINDOWS.md

key-decisions:
  - "connectionTimeoutMillis=5000 (não um número redondo por gosto): ~2,5× de folga sobre o
    pior caso real medido no debug (retentativa de CI, 1.9s), muito acima do custo real por
    consulta de login (1-43ms mesmo sob carga completa), e curto o bastante para nunca mais
    travar até o teto de um timeout de teste ou requisição."
  - "Tarefa 2 (semear as 5 primeiras tentativas do teste de bloqueio via a rota REST do Auth.js
    em vez da UI) foi REVERTIDA depois de confirmar, por evidência direta e reproduzível, que
    o contador em memória não é compartilhado entre a rota REST e a Server Action nesta build —
    ver 'Deviations from Plan'. Nenhuma versão enfraquecida do teste foi deixada no lugar; o
    arquivo voltou exatamente ao estado anterior a esta tarefa."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "connectionTimeoutMillis do pool de conexão está definido, finito e maior que zero — nunca ausente/0 (espera infinita)"
    verification:
      - kind: unit
        ref: "tests/unit/pool-conexao.test.ts — 'está definido, finito e maior que zero'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Um erro de timeout do pool dentro de authorize() cai na mesma mensagem humana de credenciais inválidas (login?erro=credenciais), nunca numa stack crua nem em app/error.tsx ou app/(app)/error.tsx"
    verification:
      - kind: other
        ref: "Rastreado lendo o código-fonte real: node_modules/@auth/core/lib/actions/callback/index.js (catch genérico embrulha erro não-AuthError em CallbackRouteError, subclasse de AuthError) + lib/auth/acoes.ts (if (erro instanceof AuthError) redirect('/login?erro=credenciais')). Documentado em detalhe no comentário de db/index.ts."
        status: unknown
    human_judgment: true
    rationale: "Não provado por teste automatizado — simular um timeout real de 5s do pool exigiria segurar as 10 conexões do pool.max por >=5s sob um Postgres real dentro de um teste, o que a própria sessão de debug (auth-bloqueio-timeout-e2e.md) já tentou 3 vezes sem conseguir reproduzir de forma determinística. Confirmado por leitura de código-fonte real (não suposição), mas fica marcado para julgamento humano por honestidade: não é a mesma força de prova que um teste RED/GREEN."

duration: ~2h30min (execução autônoma, sem checkpoint do dono — a Tarefa 2 foi revertida por decisão própria dentro do orçamento de 3 tentativas, não parada para pedir decisão)
completed: 2026-09-20
status: complete
---

# Quick Task 260920-jxb: Timeout do pool de conexão + teste e2e de bloqueio (revertido) — Summary

**`connectionTimeoutMillis=5000` no pool do Postgres (com teste de regressão) resolve o risco real de espera infinita apontado pelo debug; a segunda mudança aprovada (semear tentativas via API para encurtar o teste de bloqueio) foi tentada, funcionou isoladamente (provado por curl), mas revertida ao descobrir que a rota REST e a Server Action não compartilham o contador de tentativas em memória nesta build — achado novo, registrado em WINDOWS #34.**

## Performance

- **Duration:** ~2h30min (grande parte em depuração honesta da Tarefa 2, incluindo um processo
  de servidor "zumbi" que invalidou dois dos testes intermediários — ver Issues Encountered)
- **Completed:** 2026-09-20
- **Tasks:** 2/3 aplicadas (Tarefa 1 completa; Tarefa 2 revertida com achado documentado;
  Tarefa 3 — ledger — completa)
- **Files modified:** 3 (1 criado, 2 modificados; `tests/e2e/autenticacao.spec.ts` e
  `lib/auth/auth.ts` foram tocados e depois revertidos byte a byte — `git diff` confirma zero
  mudança líquida neles)

## Accomplishments

- **`connectionTimeoutMillis: 5_000` em `db/index.ts`**, com comentário explicando a evidência
  (não o gosto): custo real por consulta de login medido no debug (1-43ms mesmo sob carga
  completa), a retentativa de CI que absorveu a falha real do dia (1.9s), e por que 5s dá folga
  real sem nunca mais deixar a espera sem teto.
- **Caminho de falha verificado por leitura de código-fonte real** (não suposição): um erro de
  timeout do pool dentro de `authorize()` (`lib/auth/auth.ts`) NÃO é `AuthError`/`CredentialsSignin`
  — o `@auth/core` (`lib/actions/callback/index.js`) o embrulha automaticamente em
  `CallbackRouteError` (subclasse de `AuthError`) antes de propagar. `lib/auth/acoes.ts` já
  captura isso com `if (erro instanceof AuthError) redirect("/login?erro=credenciais")` —
  **nenhuma mudança de código foi necessária** para o caminho de falha já cair na mesma
  mensagem humana de credenciais inválidas, nunca numa stack crua nem em `app/error.tsx` /
  `app/(app)/error.tsx`.
- **`tests/unit/pool-conexao.test.ts`** — guarda de regressão: afirma
  `pool.options.connectionTimeoutMillis` é um número finito maior que zero. Roda dentro de
  `npm test` (Vitest), sem precisar de `DATABASE_URL_TESTE` — construir um `Pool` não abre
  conexão nenhuma.
- **Tarefa 2 tentada e revertida com um achado real, não um workaround frágil** — ver
  "Deviations from Plan" para o diagnóstico completo. `tests/e2e/autenticacao.spec.ts` e
  `lib/auth/auth.ts` voltaram exatamente ao estado anterior a esta tarefa (`git diff` vazio nos
  dois).
- **Ledger atualizado** (`.planning/WINDOWS.md`): entrada #33 (nova, fixed) documenta a
  correção real do pool e esclarece que #24 tinha sido marcado "fixed" em 2026-08-31 sem
  nenhuma mudança de código relacionada — esta é a primeira correção de fato. Entrada #34
  (nova, aberta) documenta o achado sobre o contador de tentativas não compartilhado. #3
  permanece aberto de propósito — ver justificativa abaixo.

## Task Commits

1. **Tarefa 1: `connectionTimeoutMillis` no pool + teste de regressão** — `c7b13e1` (fix)

**Tarefa 2** não gerou commit de código — foi revertida (`git checkout --` nos dois arquivos
tocados) depois do achado documentado abaixo. **Tarefa 3** (ledger) não gera commit de código —
`.planning/WINDOWS.md` é commitado no commit final de docs (ver "Final commit" abaixo).

**Plano/estado (docs):** commitado separadamente (ver "Final commit" abaixo).

## Files Created/Modified

- `db/index.ts` — `connectionTimeoutMillis: 5_000` + comentário com a evidência e o caminho de falha
- `tests/unit/pool-conexao.test.ts` (novo) — guarda de regressão do timeout do pool
- `.planning/WINDOWS.md` — entrada #33 (nova, fixed) e #34 (nova, aberta) — ver "Deviations"

## Decisions Made

Ver `key-decisions` no frontmatter: o valor `5000` e a decisão de reverter a Tarefa 2 em vez de
forçar um workaround frágil (ver próxima seção para o raciocínio completo).

## Deviations from Plan

### Tarefa 2 revertida — achado arquitetural novo, não um bug de transporte

**O que a Tarefa 2 pedia:** semear as cinco primeiras tentativas do teste de bloqueio
(`tests/e2e/autenticacao.spec.ts`) por "um caminho de servidor real", mantendo a sexta pela UI
real, para encurtar o teste sem enfraquecer AUTH-04.

**O que foi implementado e provado funcionar ISOLADAMENTE:** a dança padrão de CSRF do Auth.js
(`GET /api/auth/csrf` + `POST /api/auth/callback/credentials`, o mesmo protocolo REST que
qualquer cliente HTTP sem JS usa) — não um INSERT de teste (o contador de tentativas é em
memória, `lib/auth/tentativas-memoria.ts`, não existe tabela) e não uma chamada direta à função
interna (o processo do Playwright não é o processo do servidor). Provado com `curl` puro contra
um `next start` recém-construído, com Postgres de teste real: 5 POSTs reais + um 6º, TODOS pela
rota REST, bloqueiam corretamente entre si (o 6º retorna `code=bloqueado`).

**O que foi descoberto:** quando as 5 primeiras tentativas passam pela rota REST (seedagem) e a
6ª passa pela Server Action via UI real (como o teste exige), a 6ª **não vê o bloqueio** — o
contador de tentativas em memória não é o mesmo objeto entre os dois caminhos, nesta build
(Next.js 16.3.5 + Turbopack, `output: "standalone"`). Isolado de qualquer processo de servidor
"zumbi" (ver "Issues Encountered" — dois dos testes intermediários foram invalidados por um
servidor antigo ainda escutando na porta 3000; este resultado final foi confirmado com a porta
livre antes de construir, e reconfirmado numa segunda corrida limpa).

Isso é a MESMA classe de suspeita que o próprio debug (`auth-bloqueio-timeout-e2e.md`) já tinha
levantado, sem confirmar, para o pool de conexão do Postgres ("pools de conexão podem não ser
verdadeiramente compartilhados entre diferentes rotas/Server Actions nesta build") — agora
**confirmada** para um módulo diferente (o contador de tentativas).

**Por que revertida em vez de contornada:** a única forma de semear pelo MESMO caminho que a
Server Action usa seria reproduzir o protocolo interno de Server Actions do Next.js (cabeçalho
`Next-Action` com um id derivado do build) — exatamente o tipo de hack frágil, sem contrato
público e sujeito a quebrar em qualquer atualização do framework, que a tarefa pediu para
evitar ("não um INSERT... que poderia divergir da semântica real do schema" — o mesmo espírito
se aplica aqui, ainda mais forte, porque não existe nem documentação pública desse protocolo).
A instrução da tarefa foi explícita: **"se não for possível manter essa prova semeando, pare e
diga isso em vez de enfraquecê-la"** — é exatamente o que foi feito.

**Estado final:** `tests/e2e/autenticacao.spec.ts` e `lib/auth/auth.ts` (usado só para
instrumentação temporária de depuração, também revertido) voltaram byte a byte ao estado
anterior a esta tarefa. O teste de bloqueio continua com as 6 idas e vindas reais pela UI,
**agora mais confiável** porque a Tarefa 1 (timeout do pool) elimina a única causa concreta de
espera sem limite que o debug tinha encontrado no código atual.

**Impacto em WINDOWS #3:** deixado **aberto** de propósito, não marcado "fixed". O próprio
PLAN.md desta tarefa condicionava fechar #3 a completar o ciclo RED/GREEN da Tarefa 2, que não
fechou. Fechar #3 sem essa prova repetiria exatamente o erro que #24 já cometeu (marcado "fixed"
em 2026-08-31 sem mudança de código real) — este quick task existe, entre outras coisas, para
corrigir esse padrão, não para repeti-lo.

---

**Total deviations:** 1 (Tarefa 2 não aplicada, com achado documentado em vez de workaround).
**Impact on plan:** A Tarefa 1 (a mudança de produção com risco real e evidência mais forte) foi
aplicada e testada integralmente. A Tarefa 2 fica pendente de uma decisão do dono sobre como
investigar/corrigir o achado de WINDOWS #34 antes de qualquer nova tentativa de encurtar este
teste especificamente.

## Issues Encountered

**Processo de servidor "zumbi" invalidou duas iterações de depuração.** Durante a investigação
da Tarefa 2, um servidor `npm run start` iniciado manualmente para depuração (fora do
`playwright test`, para inspecionar logs sem o custo de reconstruir o Postgres efêmero a cada
tentativa) continuou escutando na porta 3000 depois de um `kill` malsucedido (job control do
Bash não atravessa chamadas de ferramenta separadas). `webServer.reuseExistingServer: true`
(`playwright.config.ts`) fez os dois runs seguintes de `npm run test:e2e` reaproveitarem esse
processo antigo em vez de reconstruir — invalidando silenciosamente duas tentativas de correção
(reordenar `page.goto`, trocar a opção `form` do Playwright por corpo `application/x-www-form-urlencoded`
explícito) que pareciam "não resolver nada" mas na verdade nunca chegaram a rodar contra o
código novo. Detectado conferindo `netstat`/`tasklist` antes da corrida seguinte; a partir daí,
toda corrida de depuração confirmou porta 3000 livre antes de construir. O achado final (Tarefa 2
revertida) foi confirmado duas vezes com esse cuidado.

**Nenhum outro bloqueante.**

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

- O risco de espera infinita no pool de conexão (a causa mais concreta que o debug encontrou)
  está corrigido e testado.
- WINDOWS #34 (novo) precisa de uma investigação própria — como o Turbopack, sob
  `output: "standalone"`, particiona módulos compartilhados (`lib/auth/tentativas-memoria.ts`,
  e possivelmente outros, como o próprio pool de conexão já suspeito no debug original) entre
  Route Handlers e Server Actions — antes de qualquer nova tentativa de semear estado de teste
  por HTTP em vez de pela UI.
- WINDOWS #3 continua aberto: a falha intermitente original nunca foi reproduzida localmente
  (nem nesta sessão nem na de debug), então não há prova direta de que o timeout do pool a
  resolve — só a hipótese mais forte, evidenciada, agora corrigida no código.

## Comandos de verificação rodados

Orçamento do CLAUDE.md (§Conventions): no máximo uma invocação de `npm run test:e2e -- --grep`
por tarefa, exceto quando diagnosticando uma falha (regra explícita: "se um --grep falhar e
você precisar da suíte inteira para diagnosticar, rode"). A Tarefa 2 exigiu várias por causa do
achado real acima — registradas integralmente, sem esconder nenhuma:

- `npx tsc --noEmit` — limpo, rodado várias vezes durante a Tarefa 1 e 2.
- `npm run lint` (via `npx eslint <arquivos>` pontual e `npm run verificar` ao final) — limpo.
- `npx vitest run tests/unit/pool-conexao.test.ts` — 1 vez, passou.
- `npm run test:e2e -- --grep "autenticação"` — **4 vezes**: (1) primeira tentativa da Tarefa 2
  (opção `form`, `page.goto` depois do loop) — 6ª tentativa não bloqueou; (2) e (3) invalidadas
  pelo servidor zumbi (ver Issues Encountered) — mesmo resultado, mas sem valor probatório;
  (4) com porta 3000 confirmada livre e prints de diagnóstico client-side — confirmou que as 5
  seedagens retornam `code=credentials` (corretas) mas a 6ª pela UI não vê bloqueio, fechando o
  diagnóstico.
- `curl` direto contra um `next start` manual + Postgres de teste real (fora do Playwright) —
  múltiplas chamadas, confirmando que 6 POSTs reais TODOS pela rota REST bloqueiam corretamente
  entre si (isolando o achado ao par REST-seed + Server-Action-UI, não a um bug geral de CSRF).
- `npm run test:e2e -- --grep "autenticação"` — **1 vez final**, com `tests/e2e/autenticacao.spec.ts`
  já revertido ao original — **36 passed**, confirmando que a reversão não deixou nada quebrado.
- `npm run verificar` — 1 vez, ao final — `lint` + `tsc --noEmit` + `verificar-acoes` (48 ações,
  0 violações) + `npm test` (892 testes, incluindo o novo `pool-conexao.test.ts`) +
  `npm run test:migracoes` — tudo verde.

**Total de invocações de `npm run test:e2e -- --grep`: 5** — muito acima do "no máximo uma por
tarefa", de propósito: a regra do CLAUDE.md permite explicitamente isso ao diagnosticar uma
falha, e duas dessas cinco corridas foram desperdiçadas pelo servidor zumbi (não pela
investigação em si) — registrado com essa ressalva para não mascarar o custo real.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova. O `connectionTimeoutMillis` é uma configuração de robustez, não uma
mudança de superfície de ataque. A tentativa revertida da Tarefa 2 não deixou nenhum código de
diagnóstico temporário no repositório — `git diff` confirma `tests/e2e/autenticacao.spec.ts` e
`lib/auth/auth.ts` voltaram ao estado exato de antes desta tarefa.

## Aguardando o dono

Nenhum `git push` foi dado, e nenhum será dado sem o dono autorizar. O commit desta tarefa
(`c7b13e1`) está em `main`, local, sobre `a129fb4` (o checkpoint do debug). WINDOWS #34 precisa
de uma decisão do dono sobre priorizar a investigação do particionamento de módulos do Turbopack
antes de qualquer nova tentativa de encurtar `tests/e2e/autenticacao.spec.ts`.

---
*Phase: quick-260920-jxb*
*Completed: 2026-09-20*

## Self-Check: PASSED

`db/index.ts`, `tests/unit/pool-conexao.test.ts`, `.planning/WINDOWS.md`, este `PLAN.md` e este
`SUMMARY.md` existem no disco. O commit `c7b13e1` existe em `git log --oneline --all`.
