---
phase: quick-260920-fk9
plan: 1
subsystem: error-handling
tags: [postgres, drizzle-orm, sqlstate, playwright, financeiro, cadastros]

# Dependency graph
requires:
  - phase: quick-260920-dx9
    provides: "lib/erro/postgres.ts (codigoDoErroPostgres, ehViolacaoDeChaveEstrangeira) já em main, aplicado em Abertura/Cotações/Queimas — este plano só fecha os dois consumidores deixados de propósito"
provides:
  - "lib/financeiro/acoes.ts e lib/cadastros/acoes.ts importam de @/lib/erro/postgres — zero duplicata de leitor de SQLSTATE no repositório"
  - "tests/e2e/apoio/apagar-referencia.ts::comecarExclusaoDeCategoria — auxiliar reutilizável para reproduzir uma corrida de verdade select-depois-insert via transação presa (DELETE sem commit)"
  - "tests/e2e/apoio/semear-financeiro.ts::criarCategoriaDeDespesa — categoria de teste que nada referencia, segura para apagar"
affects: []

actuals:
  tokens: 3258
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Transação de teste aberta (BEGIN + DELETE, sem COMMIT) para reproduzir uma corrida select-antes-do-insert sem instrumentar código de produção nem depender de timing best-effort — MVCC garante que leituras comuns não veem a exclusão até o COMMIT, e o INSERT dependente de FK bloqueia até lá."

key-files:
  created: []
  modified:
    - lib/financeiro/acoes.ts
    - lib/cadastros/acoes.ts
    - tests/e2e/apoio/apagar-referencia.ts
    - tests/e2e/apoio/semear-financeiro.ts
    - tests/e2e/erro-chave-estrangeira.spec.ts

key-decisions:
  - "ehViolacaoDeUnicidade (23505) e ehErroDoGatilhoDeTravamento (P0001) ficam LOCAIS em lib/cadastros/acoes.ts — decisão já tomada pelo dono no prompt desta tarefa (não reaberta). Cada um tem um único consumidor no arquivo e nome/comentário com contexto específico de Cadastros; só o leitor de SQLSTATE em si (codigoDoErroPostgres) é genérico o bastante para compartilhar. Nenhum segundo consumidor de nenhum dos dois foi encontrado no repositório — a condição para reabrir a decisão não se aplicou."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "lib/financeiro/acoes.ts não declara mais detector local de 23503 — importa ehViolacaoDeChaveEstrangeira de @/lib/erro/postgres, usado nos dois catches (lancarVenda, lancarDespesa)"
    verification:
      - kind: static
        ref: "grep -rn 'function ehViolacaoDeChaveEstrangeira' lib — 0 ocorrências fora de lib/erro/postgres.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/cadastros/acoes.ts não declara mais leitor local de SQLSTATE — importa codigoDoErroPostgres de @/lib/erro/postgres"
    verification:
      - kind: static
        ref: "grep -rn 'function codigoDoErroPostgres' lib — 0 ocorrências fora de lib/erro/postgres.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lançar uma despesa 'outra' cuja categoria some ENTRE a pré-conferência do servidor e a gravação mostra 'Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.'"
    verification:
      - kind: e2e
        ref: "tests/e2e/erro-chave-estrangeira.spec.ts — 'Financeiro (Despesa): a categoria some ENTRE a pré-conferência e a gravação...' (desktop + celular)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O e2e foi visto FALHAR com o detector antigo (local, quebrado) restaurado à mão em lib/financeiro/acoes.ts, e PASSAR com o compartilhado — RED antes de GREEN"
    verification:
      - kind: e2e
        ref: "par RED/GREEN medido nesta execução — ver seção 'Prova RED/GREEN do e2e' abaixo"
        status: pass
    human_judgment: false

duration: ~45min (execução autônoma, sem checkpoint)
completed: 2026-09-20
status: complete
---

# Quick Task 260920-fk9: Detector de SQLSTATE unificado em Financeiro e Cadastros — Summary

**Os dois últimos consumidores do detector compartilhado de SQLSTATE (`lib/erro/postgres.ts`) migrados — Financeiro e Cadastros — com prova e2e nova cobrindo uma corrida de verdade (select-antes-do-insert) que os outros três módulos não têm.**

## Performance

- **Duration:** ~45min de execução autônoma (Tarefas 1-3, sem checkpoint)
- **Completed:** 2026-09-20
- **Tasks:** 3/3
- **Files modified:** 5 (0 criados, 5 modificados)

## Accomplishments

- `lib/financeiro/acoes.ts` importa `ehViolacaoDeChaveEstrangeira` de `@/lib/erro/postgres` em vez do detector local de uma linha só (olhava só `erro.code`, nunca `erro.cause.code` — o mesmo defeito de origem já corrigido em Abertura/Cotações/Queimas pelo quick 260920-dx9). Os dois `catch` (`lancarVenda` ~linha 246, `lancarDespesa` ~linha 440) ficam letra por letra iguais — só a detecção mudou.
- `lib/cadastros/acoes.ts` importa `codigoDoErroPostgres` de `@/lib/erro/postgres` em vez de uma cópia local byte-a-byte idêntica (foi dali, aliás, que o detector compartilhado nasceu, no plano 04.4-02). `ehViolacaoDeUnicidade` (23505) e `ehErroDoGatilhoDeTravamento` (P0001) continuam declaradas neste arquivo — decisão de escopo já travada pelo dono no prompt, não reaberta (ver "Decisions Made").
- **Descoberta real durante a Tarefa 3, não prevista no PLAN.md inicial**: `lancarVenda`/`lancarDespesa` fazem uma PRÉ-CONFERÊNCIA fresca da categoria (um `select` antes do `insert`) — diferente de Abertura/Cotações/Queimas, que confiam direto na chave estrangeira. Isso significa que o truque usado nos outros três testes ("apagar a linha referenciada antes de enviar o formulário") NUNCA alcançaria o backstop de FK no Financeiro: a pré-conferência já veria a categoria sumida e devolveria a SUA PRÓPRIA frase (parecida, mas diferente). Provar o backstop de verdade exigiu simular a corrida real — a categoria sumindo DEPOIS da pré-conferência e ANTES do `insert` — sem instrumentar o código de produção. A solução: uma transação de teste que executa o `DELETE` mas não dá `commit` (`comecarExclusaoDeCategoria`, `tests/e2e/apoio/apagar-referencia.ts`). MVCC garante que a pré-conferência (uma leitura comum, sem lock) não vê a exclusão ainda não confirmada; o `insert` seguinte, que precisa do lock aprovado pela chave estrangeira, bloqueia na mesma linha até o teste chamar `commitar()` — o que só acontece depois de o formulário já ter sido enviado. Isso reproduz a janela exata sem depender de timing best-effort.
- `tests/e2e/erro-chave-estrangeira.spec.ts` ganhou um quarto caso (Financeiro/Despesa), provando com o servidor real que a frase humana aparece quando a categoria some sob esta corrida — 36/36 testes passaram (os 3 já existentes × 2 viewports + o novo × 2 viewports + os 24 `@vazio-*`/`@vazio-historico` da cadeia de dependências do Playwright).

## Task Commits

1. **Tarefa 1: Financeiro importa o detector compartilhado** - `638d372` (fix)
2. **Tarefa 2: Cadastros importa o leitor compartilhado** - `c19126b` (fix)
3. **Tarefa 3: prova e2e do caminho Financeiro, com RED/GREEN** - `035c570` (test)

**Plano/estado (docs):** commitado separadamente (ver "Final commit" abaixo).

## Files Modified

- `lib/financeiro/acoes.ts` - importa `ehViolacaoDeChaveEstrangeira`; detector local (5 linhas) apagado
- `lib/cadastros/acoes.ts` - importa `codigoDoErroPostgres`; leitor local (16 linhas) apagado; `ehViolacaoDeUnicidade`/`ehErroDoGatilhoDeTravamento` continuam locais
- `tests/e2e/apoio/apagar-referencia.ts` - `comecarExclusaoDeCategoria` (nova): abre a transação presa, expõe `commitar()`/`cancelar()`
- `tests/e2e/apoio/semear-financeiro.ts` - `criarCategoriaDeDespesa` (nova): categoria de teste grupo `custo`/área `cafeteria`, nova e sem uso
- `tests/e2e/erro-chave-estrangeira.spec.ts` - quarto caso, Financeiro (Despesa)

## Comandos de verificação rodados

Orçamento do CLAUDE.md (§Conventions): no máximo uma invocação de `npm run test:e2e -- --grep`
por tarefa; o par RED/GREEN desta prova excede isso de propósito, registrado abaixo.

- `npm run lint` — 3 vezes (uma por tarefa) — limpo nas três
- `npx tsc --noEmit` — 3 vezes (uma por tarefa) — limpo nas três
- `grep -rn "function codigoDoErroPostgres\|function ehViolacaoDeChaveEstrangeira" lib` — 1 vez, ao final — 0 ocorrências fora de `lib/erro/postgres.ts`
- `npm run test:e2e -- --grep "chave estrangeira"` — **2 vezes** (Tarefa 3):
  1. Com o detector local quebrado restaurado à mão em `lib/financeiro/acoes.ts` (RED) — **2 falharam** (o novo caso, desktop + celular), **34 passaram** (os 3 casos já existentes, que usam o detector compartilhado em outros módulos, permaneceram verdes — prova de que o RED é específico do Financeiro, não um efeito colateral de ambiente)
  2. Com a correção restaurada (idêntica ao commit `638d372`, conferido por `git diff` vazio antes de rodar) (GREEN) — **36 passaram** (os 34 de antes + o novo caso nos 2 viewports)
- `npm run verificar` — 1 vez, ao final — `lint` + `tsc --noEmit` + `verificar-acoes` (48 ações, 0 violações) + `npm test` (875 testes) + `npm run test:migracoes` — tudo verde

## Prova RED/GREEN do e2e

O novo caso (Financeiro/Despesa) foi escrito e, antes de ser aceito como prova, teve o
comportamento oposto verificado à mão: o detector local quebrado de `lib/financeiro/acoes.ts`
(`typeof erro === "object" && ... && erro.code === "23503"`, que olha só a raiz do erro, nunca
`erro.cause.code`) foi restaurado temporariamente, substituindo o import compartilhado. Rodar
`npm run test:e2e -- --grep "chave estrangeira"` nesse estado produziu, no log do servidor, o
23503 genuíno (`insert or update on table "documento_linhas" violates foreign key constraint
"documento_linhas_categoria_id_categorias_id_fk"`) — prova de que a técnica de transação presa
realmente reproduziu a corrida — mas a mensagem na tela ficou genérica (`FRASE_FALHA_AO_SALVAR`),
e a asserção da frase humana falhou nos dois viewports (`2 failed`), com os outros três casos
(que usam o detector já corrigido nos outros módulos) permanecendo verdes (`34 passed`). Restaurado
o import compartilhado (`git diff` conferido vazio antes de rodar de novo), a mesma corrida
resultou em `36 passed`. O par RED→GREEN está fechado: o teste é uma proteção de verdade contra a
regressão, não uma frase escrita depois do fato e nunca vista falhar.

| Rodada | Estado de `lib/financeiro/acoes.ts` | Resultado |
|---|---|---|
| RED | detector local quebrado (restaurado à mão) | 2 failed (Financeiro, desktop+celular), 34 passed |
| GREEN | import de `@/lib/erro/postgres` (correção real) | 36 passed |

## Decisions Made

**`ehViolacaoDeUnicidade`/`ehErroDoGatilhoDeTravamento` ficam locais em `lib/cadastros/acoes.ts`** — decisão já travada pelo dono no prompt desta tarefa, não reaberta por esta execução. Critério explícito para reabrir (buscar um segundo consumidor real de qualquer um dos dois): buscado (`grep -rn "ehViolacaoDeUnicidade\|ehErroDoGatilhoDeTravamento"` fora de `lib/cadastros/acoes.ts`) e **nenhum encontrado** — a condição para reabrir não se aplicou, a decisão do dono permanece como está.

## Deviations from Plan

### Auto-fixed Issues

Nenhuma. Os dois primeiros arquivos mudaram exatamente como o prompt descreveu (mesma forma do commit de referência `fcbb3c3`).

### Descoberta não prevista, tratada como ajuste de execução (não uma mudança de escopo)

**Financeiro tem pré-conferência de categoria que os outros três módulos não têm.** O PLAN.md inicial (escrito por este mesmo executor, antes de ler `lancarVenda`/`lancarDespesa` a fundo) assumia que o mesmo truque de "apagar a linha antes de enviar o formulário" dos outros três casos funcionaria aqui. Na prática, `lancarVenda` (linhas "livre") e `lancarDespesa` (modo "outra") leem a categoria de novo, fresca, ANTES do `insert` — apagar antes do envio faz essa pré-conferência (não o backstop de FK) responder, com uma frase parecida mas diferente. Isto não é uma decisão de arquitetura (Regra 4): é a mesma classe de ajuste de Regra 1/3 já prevista no processo — o teste precisava refletir o comportamento real do código, não uma suposição de que todos os quatro módulos seriam idênticos. A técnica de transação presa (`comecarExclusaoDeCategoria`) resolve sem tocar em nenhuma linha de código de produção. Documentado em `<descoberta_de_projeto>` no PLAN.md e na função-chave do auxiliar.

---

**Total deviations:** 0 correções de bug; 1 ajuste de abordagem de teste, sem mudança de escopo nem de código de produção.
**Impact on plan:** Nenhum nos entregáveis prometidos (D1-D4 continuam cumpridos); o único efeito foi a técnica usada na Tarefa 3.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova. `criarCategoriaDeDespesa`/`comecarExclusaoDeCategoria` só existem em `tests/e2e/apoio/`, nunca importados por código de produção, e usam exclusivamente `DATABASE_URL_TESTE` (nunca `DATABASE_URL`) — mesma disciplina já em vigor no restante de `tests/e2e/apoio/`.

## Issues Encountered

Nenhum. `npm run verificar` passou de primeira, na única invocação desta tarefa.

## Aguardando o dono

Nenhum `git push` foi dado, e nenhum será dado sem o dono autorizar. Todos os 3 commits desta tarefa estão em `main`, local, sobre `d98b2c6` (o merge do quick 260920-dx9).

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

- As duas pendências deixadas de propósito pelo quick 260920-dx9 ("Pendências deixadas de propósito", seção do SUMMARY daquele plano) estão fechadas: `lib/financeiro/acoes.ts` e `lib/cadastros/acoes.ts` agora importam do detector compartilhado.
- Zero duplicata de leitor de SQLSTATE no repositório (`lib/erro/postgres.ts` é o único lugar que declara `codigoDoErroPostgres`/`ehViolacaoDeChaveEstrangeira`).
- `tests/e2e/apoio/apagar-referencia.ts::comecarExclusaoDeCategoria` fica disponível para qualquer teste futuro que precise reproduzir uma corrida select-antes-do-insert sem instrumentar código de produção.
- Nenhum bloqueio para o próximo trabalho. `.planning/phases/04.4-financeiro-parte-1/04.4-12-PLAN.md` não foi tocado, conforme instruído (outro agente está escrevendo aquele plano).

---
*Phase: quick-260920-fk9*
*Completed: 2026-09-20*

## Self-Check: PASSED

Todos os 7 arquivos listados (5 de código/teste + PLAN.md + este SUMMARY.md) existem no disco.
Os 3 hashes de commit (`638d372`, `c19126b`, `035c570`) existem em `git log --oneline --all`.
