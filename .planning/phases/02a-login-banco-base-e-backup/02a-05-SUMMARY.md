---
phase: 02a-login-banco-base-e-backup
plan: 05
subsystem: auth
tags: [cli, typescript-compiler-api, ci-gate, drizzle, rbac]

# Dependency graph
requires:
  - phase: 02a-01
    provides: "scripts/criar-usuario.ts (o padrão de leitura de argumentos/validação/saída),
      lib/auth/senha.ts (gerarSenhaForte/gerarHash), db/schema.ts (usuarios), db/index.ts"
  - phase: 02a-02
    provides: "scripts/testar-migracoes.mjs (orquestração do Postgres efêmero e o padrão de
      afirmações de fora, pelo cliente pg) para o cenário de contas ser anexado"
  - phase: 02a-04
    provides: "lib/auth/exigir-usuario.ts — o contrato exato (avaliarAutorizacao() pura +
      exigirUsuario() casca, import dinâmico de lib/auth/auth) que o verificador precisa
      reconhecer como a chamada de autorização válida"
provides:
  - "scripts/redefinir-senha.ts e scripts/desativar-usuario.ts: as duas operações de conta
    que faltavam, no mesmo padrão de criar-usuario.ts (Zod, saída de erro em português,
    código de saída diferente de zero)"
  - "scripts/testar-migracoes.mjs ganha conferirContas(): roda os dois scripts reais como
    processo filho contra o Postgres efêmero e confere hash mudou/senha antiga não confere/
    ativo falso com a linha presente/reativação"
  - "scripts/verificar-acoes.mjs: o portão de máquina do exigirUsuario() (AUTH-10) — percorre
    .ts/.tsx pela árvore sintática do compilador do TypeScript (nunca regex), reprova ação
    de servidor num arquivo que alcança o banco sem exigirUsuario() como primeira instrução"
  - "tests/fixtures/acoes/{conforme,violando,sem-banco}.ts: prova o verificador nos três
    sentidos; tests/unit/verificar-acoes.test.ts: prova via processo filho"
  - "job qualidade do pipeline roda verificar-acoes entre o lint e os testes unitários — uma
    violação futura barra a corrida antes de qualquer imagem existir"
affects: [02a-06, 02a-07, 02a-08, 03-encomendas, 04-fornos, 05-agenda, 06-estoque]

# Actuals (#2632)
actuals:
  tokens: 7600
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verificação de autorização por árvore sintática do TypeScript (pacote typescript, já
      devDependency), nunca por expressão regular — casar texto erraria dentro de comentário
      e de cadeia de caracteres, e um portão que decide a regra mais importante do projeto
      precisa ser confiável para valer alguma coisa"
    - "listarArquivosTs() em verificar-acoes.mjs aceita arquivo OU diretório no mesmo
      argumento (statSync decide), o que permite ao teste unitário apontar arquivos
      individuais das fixtures sem precisar de subpastas por cenário"
    - "'Alcança o banco' decidido pelos imports do próprio arquivo (@/db, caminho relativo
      equivalente, ou @/db/schema) — não pelo conteúdo da função. Um arquivo de ações que
      não importa nada disso não é cobrado, e um comentário no topo de sem-banco.ts registra
      essa fronteira como deliberada"
    - "scripts/testar-migracoes.mjs roda os scripts de conta reais como processo filho
      (rodarNpmCapturado, com stdio 'pipe' para o stdout) em vez de reimplementar a lógica —
      o teste prova o comando que a pessoa vai digitar, não uma cópia dele"

key-files:
  created:
    - scripts/redefinir-senha.ts
    - scripts/desativar-usuario.ts
    - scripts/verificar-acoes.mjs
    - tests/fixtures/acoes/conforme.ts
    - tests/fixtures/acoes/violando.ts
    - tests/fixtures/acoes/sem-banco.ts
    - tests/unit/verificar-acoes.test.ts
  modified:
    - scripts/testar-migracoes.mjs
    - package.json
    - README.md
    - .github/workflows/entrega.yml

key-decisions:
  - "verificar-acoes.mjs aceita arquivo OU diretório no mesmo argumento de linha de comando —
    decidido cedo porque o teste unitário (tarefa 3) precisava apontar arquivos individuais
    das fixtures para provar 'aprova conforme.ts e sem-banco.ts sem violando.ts' sem duplicar
    fixtures numa subpasta só de aprovados"
  - "A 'primeira instrução' aceita corpo de bloco (function/arrow com chaves) E corpo de
    expressão única (arrow concisa, ainda que hoje nenhuma ação real use essa forma) — evita
    um falso positivo se uma ação futura for escrita como `export const foo = async () =>
    exigirUsuario()`"
  - "redefinir-senha e desativar-usuario reusam literalmente o padrão de leitura de
    argumentos de criar-usuario.ts (lerArgumento com --chave=valor e --chave valor) — nenhuma
    biblioteca de parsing de CLI foi introduzida, e os três scripts continuam lendo igual"

patterns-established:
  - "Prova de portão nos dois sentidos (vermelho com violação real → verde depois de
    removida), mesmo padrão que 01-07 e 02a-02 já estabeleceram para outros portões do
    pipeline — reutilizável para qualquer gate futuro"

requirements-completed: [AUTH-08, AUTH-09, AUTH-10]

coverage:
  - id: D1
    description: "Redefinir a senha de um usuário por linha de comando funciona"
    requirement: "AUTH-08"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — conferirContas() em scripts/testar-migracoes.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Desativar um usuário por linha de comando tira o acesso sem apagar a linha"
    requirement: "AUTH-09"
    verification:
      - kind: integration
        ref: "npm run test:migracoes — conferirContas() em scripts/testar-migracoes.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nenhuma Server Action toca o banco sem passar por exigirUsuario() na
      primeira linha — verificado por máquina, não por inspeção"
    requirement: "AUTH-10"
    verification:
      - kind: unit
        ref: "tests/unit/verificar-acoes.test.ts — reprova violando.ts citando o nome da
          função, aprova conforme.ts e sem-banco.ts"
        status: pass
      - kind: integration
        ref: "npm run verificar-acoes contra app e lib, no job qualidade do pipeline"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-08-08
status: complete
---

# Phase 2a Plan 05: Operações de Conta Restantes e o Portão de Máquina do `exigirUsuario()` Summary

**`redefinir-senha`/`desativar-usuario` completam a operação de contas por linha de comando, e
`scripts/verificar-acoes.mjs` transforma a regra mais importante do projeto — toda Server
Action começa por `exigirUsuario()` — num portão que reprova por análise da árvore sintática
do TypeScript, ligado ao primeiro job do pipeline.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (todas `type="auto"`)
- **Files modified:** 11 (7 novos, 4 modificados)

## Accomplishments

- `scripts/redefinir-senha.ts` e `scripts/desativar-usuario.ts` seguem literalmente o padrão
  de `criar-usuario.ts` (Zod, `lerArgumento`, saída de erro em português, código de saída
  diferente de zero em falha). `desativar-usuario` aceita `--reativar` e avisa, em vez de
  fingir, quando a conta já estava no estado pedido. Nenhum dos dois arquivos contém `delete`
  nem `drop` (`grep` confirmado, `0` ocorrências).
- `scripts/testar-migracoes.mjs` ganhou `conferirContas()`: cria uma conta com um hash
  conhecido, roda `redefinir-senha` e `desativar-usuario` como **processo filho de verdade**
  (não uma reimplementação), e confere pelo cliente `pg` que o hash mudou, que a senha antiga
  não confere mais com o hash novo (e vice-versa), que a senha nova impressa por
  `redefinir-senha` bate com o hash gravado, e que desativar/reativar nunca remove a linha.
  `npm run test:migracoes` passou com o cenário incluído.
- `scripts/verificar-acoes.mjs` monta a árvore sintática de cada `.ts`/`.tsx` com o
  compilador do TypeScript (`ts.createSourceFile`), decide se o arquivo "alcança o banco"
  pelos próprios imports (`@/db`, caminho relativo equivalente, ou `@/db/schema`), reconhece
  as duas formas de marcação de ação (`"use server"` de arquivo inteiro, cobrando toda função
  exportada; `"use server"` de função, cobrando só aquela) e reprova qualquer ação cuja
  primeira instrução real (ignorando a diretiva e declarações de tipo) não seja uma chamada a
  `exigirUsuario()`. Contra `app` e `lib` hoje, sai `0` com `0 ação(ões) conferida(s)` — a
  fase ainda não tem Server Action de produto que toque o banco, exatamente como o plano
  previu.
- Três fixtures (`conforme.ts`, `violando.ts`, `sem-banco.ts`) provam o verificador nos três
  sentidos, e `tests/unit/verificar-acoes.test.ts` prova isso via processo filho de verdade
  (não chamando funções internas do script). O job `qualidade` do pipeline roda
  `verificar-acoes` entre o lint e os testes unitários.
- **Prova manual do portão nos dois sentidos**, exigida pela tarefa 3: inseri temporariamente
  uma ação sem autorização (`acaoDeTesteTemporariaSemAutorizar`, tocando `usuarios` sem
  chamar `exigirUsuario()`) no final de `lib/auth/exigir-usuario.ts` — um arquivo real, não
  uma fixture. `npm run verificar-acoes` saiu `1`, citando
  `lib\auth\exigir-usuario.ts:92 (acaoDeTesteTemporariaSemAutorizar)`. Removi a função e
  `git diff --stat` confirmou o arquivo voltou byte a byte ao estado do commit anterior;
  `npm run verificar-acoes` voltou a sair `0`. Nenhum vestígio ficou em nenhum commit.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: `redefinir-senha` e `desativar-usuario`** — `471f79a` (feat)
2. **Tarefa 2: `verificar-acoes` — o portão de máquina do `exigirUsuario()`** — `1a19522` (feat)
3. **Tarefa 3: Ligar o portão ao pipeline e provar que ele barra** — `b791761` (test)

**Plan metadata:** commit final deste SUMMARY, a seguir.

## Files Created/Modified

- `scripts/redefinir-senha.ts` (novo) — `--email`, busca por `lower(email)`, gera e grava
  hash novo, imprime `SENHA: ...` uma única vez
- `scripts/desativar-usuario.ts` (novo) — `--email` e `--reativar`, marca `ativo`, avisa se
  já estava no estado pedido, nunca apaga
- `scripts/verificar-acoes.mjs` (novo) — o verificador por árvore sintática
- `tests/fixtures/acoes/conforme.ts`, `violando.ts`, `sem-banco.ts` (novos)
- `tests/unit/verificar-acoes.test.ts` (novo) — prova via processo filho, nos dois sentidos
- `scripts/testar-migracoes.mjs` — `conferirContas()` + `rodarNpmCapturado()`, chamada em
  `conferirBanco()`
- `package.json` — aliases `redefinir-senha`, `desativar-usuario`, `verificar-acoes`
- `README.md` — seção "Operações de conta" (os três comandos completos) e nota sobre
  `verificar-acoes` na lista de portões de qualidade e na descrição do pipeline
- `.github/workflows/entrega.yml` — passo `npm run verificar-acoes` no job `qualidade`,
  depois do lint e antes dos testes unitários

## Decisions Made

- Ver `key-decisions` no frontmatter — a aceitação de arquivo OU diretório como argumento do
  verificador, o suporte a corpo de expressão única, e a reutilização literal do padrão de
  `lerArgumento` de `criar-usuario.ts`.

## Deviations from Plan

None — plano executado exatamente como escrito. Os dois scripts de conta, o verificador por
árvore sintática, as fixtures, o teste unitário e a ligação ao pipeline seguem a
especificação do `PLAN.md` sem ajuste de escopo.

## Issues Encountered

None além do já documentado como prova exigida pela tarefa 3 (a violação temporária inserida
e removida em `lib/auth/exigir-usuario.ts`, ver Accomplishments acima).

## User Setup Required

None — nenhuma configuração externa necessária nesta etapa.

## Next Phase Readiness

- `scripts/verificar-acoes.mjs` está pronto para reprovar, desde a primeira ação de produto
  das Fases 3 a 6, qualquer Server Action que toque o banco sem `exigirUsuario()` na primeira
  linha — o portão nasce agora, enquanto custa um script, e não depois, quando custaria uma
  auditoria manual sobre dezenas de ações.
- As três operações de conta (`criar-usuario`, `redefinir-senha`, `desativar-usuario`) estão
  completas e documentadas no README, todas pelo estágio `ferramentas`.
- Sem bloqueios. AUTH-08, AUTH-09 e AUTH-10 estão completos e provados: as duas primeiras por
  `npm run test:migracoes` contra um Postgres de verdade, a terceira por unidade (processo
  filho) e pela observação real de vermelho→verde registrada acima.

---
*Phase: 02a-login-banco-base-e-backup*
*Completed: 2026-08-08*

## Self-Check: PASSED

Todos os 11 arquivos de `key-files` (7 novos + `scripts/testar-migracoes.mjs`, `package.json`,
`README.md`, `.github/workflows/entrega.yml` modificados) confirmados com `[ -f ... ]`, e os
3 hashes citados (`471f79a`, `1a19522`, `b791761`) confirmados em `git log --oneline --all`.
