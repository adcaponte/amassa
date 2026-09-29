---
phase: 06-estoque
plan: 02
subsystem: estoque
status: complete
tags: [estoque, custo-medio, livro-imutavel, concorrencia, test-migracoes]
requires:
  - "06-01: lib/estoque/custo.ts, destinos.ts, esquemas.ts e a migração 0023 (tabela movimentacoes_estoque, revoke, gatilho da unidade)"
provides:
  - "tests/unit/estoque-custo.test.ts completo — os sete casos de 06-RESEARCH.md §Pergunta 3, bordas, invariantes com semente fixa e o describe D-23/D-24"
  - "tests/unit/estoque-destinos.test.ts e tests/unit/estoque-esquemas.test.ts"
  - "scripts/testar-migracoes.mjs: conferirEstoque(cliente) e conferirConcorrenciaDoEstoque() chamadas em conferirBanco, com os auxiliares codigoDoErro, inserirMovimentacao, estadoDoItemNoLivro, inserirDocumentoComItem, apagarDadosDeProvaDoEstoque, esperarBloqueada e semRejeicaoSolta"
affects: [06-03, 06-11]
tech-stack:
  added: []
  patterns:
    - "prova de impasse determinística: esperar pg_stat_activity.wait_event_type = 'Lock' antes de seguir, em vez de setTimeout"
    - "promessa que espera uma trava vira { ok, erro } no instante em que nasce (nenhuma rejeição solta derruba o Node)"
    - "faxina do livro como dono: um delete só no livro, soma dos documentos desligada dentro da transação"
key-files:
  created:
    - tests/unit/estoque-destinos.test.ts
    - tests/unit/estoque-esquemas.test.ts
  modified:
    - tests/unit/estoque-custo.test.ts
    - scripts/testar-migracoes.mjs
decisions:
  - "Nenhuma correção nos módulos puros: os sete casos da pesquisa, o arredondamento e os invariantes bateram com o custo.ts do 06-01 na primeira execução"
  - "D-23/D-24 testadas como estão (tomadas sem o dono), num describe próprio para ele ler; o contraexemplo do custo original está só em comentário"
  - "As suposições A1 (FK segura FOR KEY SHARE e for update causa impasse) e A2 (on delete set null funciona para amassa_app apesar do revoke update) da pesquisa deixaram de ser suposições: provadas no Postgres efêmero"
metrics:
  duration: "~9 min (04:58 → 05:07 UTC, 29/09/2026)"
  completed: 2026-09-29
estimate:
  tokens: 45000
  tasks: 2
actuals:
  tokens: 13600
  tasks: 2
  commits: 3
---

# Phase 06 Plan 02: A prova do traçador nas bordas Summary

**O custo médio provado nos sete casos da pesquisa e em 500 movimentos com semente fixa. O Postgres
de verdade recusa editar ou apagar o livro (42501), recusa linha incoerente (23514) e o segundo
estorno da mesma linha (23505). Deixa apagar a encomenda sem apagar o consumo e trava a unidade de
item com histórico (P0001). Duas vendas do mesmo insumo comitam sem impasse com `for no key update`,
e o controle com `for update` termina em 40P01.**

## O que foi entregue

### Tarefa 1 — a bateria do custo médio (`7e99910`)

- **`tests/unit/estoque-custo.test.ts`** (21 → 23 `it`s depois do ajuste do gerador; eram 7 no
  06-01):
  - **Os sete casos da tabela**, com os números literais: 1, 1b, 2, 3, 4, 5 e 7 no `describe` dos
    casos, e o 6 no `describe` do estorno. Cada `it` cita "06-RESEARCH.md §Pergunta 3, caso N".
  - **Bordas:** uma saída 1 milésimo além do saldo não é recusada e deixa Q = −1 com V = 0; entrada
    sem preço e saída sobre estado vazio valem 0 (D-26); argila em g a R$ 78/kg sai 100 g por vez a
    exatos −780, dez vezes, fechando em (0, 0), porque nenhum custo unitário arredondado é gravado;
    milésimos zero, negativos ou fracionários lançam `RangeError`.
  - **Invariantes:** 500 movimentos gerados por um LCG de 32 bits com semente `20260929` (sem
    `Math.random`). Metade são entradas (com e sem preço), metade saídas de 1 a 30000 milésimos, e
    a cada 50 passos uma saída do saldo exato força o R1. Em todo passo valem `Q = 0 ⇒ V = 0` e
    `sinal(V) ∈ {sinal(Q), 0}`. O teste exige que a sequência passe pelo negativo, pelo zero e pelo
    positivo, e duas execuções dão a mesma sequência de valores.
  - **`describe("D-23/D-24 — o valor do estorno (tomado sem o dono; confirmar antes do merge)")`:**
    o mapeamento de `movimentoDoEstorno` nos dois sentidos e o caso 6: +840, estado (26000, 12840),
    R$ 4,94/kg. Também o cenário D-24: 10 un a R$ 0,01, compra de 1 un por R$ 10,00 e saída de 5 un
    a −459. O estorno da compra sai a −92 e deixa (5000, 459), sem valor negativo. O contraexemplo
    pelo custo original (V = −449 com Q = 5000) fica documentado em comentário, sem implementação.
- **`tests/unit/estoque-destinos.test.ts`:**
  - os cinco destinos na ordem da grade;
  - a área que paga cada um: espaco, pecas, cafeteria, pecas, pecas;
  - `ehDestinoDeSaida("venda")` e outros valores recusados;
  - os rótulos.
- **`tests/unit/estoque-esquemas.test.ts`:**
  - "2,5" vira 2500 e "0,001" vira 1;
  - são recusados "0" (com a frase da quantidade zero), "-1", "1,2345", o texto vazio e o texto só
    de espaços;
  - entrada sem custo, seja sem o campo ou com o campo vazio, é recusada com "Diga quanto custou ao
    todo — é daí que sai o custo médio.";
  - saída sem destino é recusada com "Escolha para onde o material foi.";
  - destinos fora dos cinco são recusados, inclusive "venda".

### Tarefa 2 — o banco prova o livro (`7bac218`)

**`conferirEstoque(cliente)`**, com os próprios itens, encomenda e usuária de prova:
- **(a)** `amassa_app` tem `select` e `insert` em `movimentacoes_estoque`, e não tem `update` nem
  `delete`. Numa transação com `set local role amassa_app`, um `update` e um `delete` reais sobre
  uma linha existente dão **42501**, e um `insert` como `amassa_app` passa (EST-06).
- **(b)** Os nove `insert`s incoerentes da lista do plano dão **23514**. Passa um `insert` válido de
  cada tipo: entrada, saída e ajuste manuais, e saída de venda e entrada de compra, cada uma com
  documento que comita pela restrição adiada de soma.
- **(c)** O primeiro estorno da saída de venda passa, e o segundo com o mesmo `estorno_de_id` dá
  **23505**.
- **(d)** Como `amassa_app`, apagar a encomenda referenciada por uma saída com destino encomenda
  **funciona**. A movimentação continua no livro com `encomenda_id` nulo e destino "encomenda".
  Isso prova a suposição A2 e o Pitfall 10.
- **(e)** Num item com movimentação, trocar a unidade dá **P0001**, desligar `controla_estoque` também
  dá P0001, e renomear passa. Trocar a unidade de um item sem movimentação passa. O item de prova
  também aparece na venda, de modo que a recusa vem do gatilho e não do `check`
  `aparece_ou_controla`.
- **(f)** O item nasce com `ativo = true`, mínimo 0 e sem observação. Mínimo negativo, observação só
  de espaços e observação com 501 caracteres dão 23514.
- **(g)** `amassa_app` continua sem `delete` em `itens_catalogo`.

**`conferirConcorrenciaDoEstoque()`**, com três conexões próprias (A, B e um observador que confirma
em `pg_stat_activity` que a conexão está parada numa trava antes de a outra seguir):
- **(1)** Duas vendas do mesmo item, cada uma com a linha inserida (FOR KEY SHARE pela chave
  estrangeira), pedem a trava com `for no key update`. B espera A. Quando A comita, B lê Q já com a
  saída de A (10000 − 2000) e grava a sua. As duas comitam, sem 40P01, e o final é 10000 − 5000 com
  o valor −2500.
- **(2)** O controle é a mesma sequência com `for update`. Uma das duas conexões termina em
  **40P01** e a outra segue; as duas são revertidas e o saldo fica intacto. Isso prova a suposição
  A1 e o Pitfall 2.
- **(3)** Ajuste × venda, nas duas ordens:
  - ajuste para 8000 seguido de venda de 1000 deixa 7000 (C − venda);
  - venda de 1000 seguida de ajuste para 9000: o ajuste lê o saldo já baixado e o final é
    exatamente 9000 (D-18, EST-07/EST-08).
- Todas as conexões fecham no `finally`.

**Faxina:** as duas conferências apagam o que criaram, como dono das tabelas. O livro sai num
`delete` só. Os documentos saem com as duas restrições de soma desligadas dentro da transação, no
mesmo molde de `conferirFinanceiro`. Em CI o Playwright roda depois no mesmo banco, e o
`@vazio-global` do Estoque exige que não sobre material de prova. O log do `verificar` não mostra
nenhuma linha "a faxina não apagou".

## Verificação: comandos rodados de fato

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/estoque-custo.test.ts tests/unit/estoque-destinos.test.ts tests/unit/estoque-esquemas.test.ts` (1ª) | 36 passaram e 1 falhou. A falha foi a guarda de cobertura do próprio teste: o passeio com 2/3 de entradas nunca ficava negativo. Os invariantes em si passaram. |
| o mesmo, depois do ajuste do gerador | **3 arquivos, 37 testes passaram** |
| `npx tsc --noEmit` | limpo |
| `npx eslint tests/unit/estoque-*.test.ts` | limpo |
| `npm run verificar` | **exit 0**. lint sem aviso; `tsc` limpo; `verificar-acoes: 75 ação(ões) conferida(s), 0 violações` (as duas linhas "1 violação" do log são os fixtures `tests/fixtures/acoes/violando*.ts` do próprio verificador); `Test Files 88 passed (88)`, `Tests 1362 passed (1362)`; `test:migracoes` imprimiu `conferirEstoque...` e `conferirConcorrenciaDoEstoque...` e depois "Todas as afirmações passaram." |
| `npm run test:e2e` | **não rodado**. O plano proíbe e2e aqui; a prova é unitária e do Postgres efêmero. |

**Greps de aceite:**
- `Math.random` em `estoque-custo.test.ts` → 0;
- `D-23` → 4 e `D-24` → 5;
- `grep -rln movimentoDoEstorno lib` → só `lib/estoque/custo.ts`;
- `42501` no script: 0 no `main`, 5 agora;
- `40P01` → 4 e `P0001` → 5;
- `conferirEstoque(cliente)` → 1 e `conferirConcorrenciaDoEstoque()` → 1. As definições usam
  `(conexao)` e `(url = process.env.DATABASE_URL_TESTE)`, então a contagem pega só a chamada em
  `conferirBanco`;
- `update/delete(movimentacoesEstoque)` em `lib/` e `app/` → nada.

**Branch:**
- o trabalho ficou em `gsd/phase-06-estoque` do começo ao fim;
- `main` continua em `a8c7bad`;
- nada foi publicado;
- nenhuma migração foi aplicada fora dos Postgres efêmeros.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no teste] O gerador pseudoaleatório não cobria o saldo negativo**
- **Found during:** Tarefa 1, primeira execução
- **Issue:** com a escolha em 0..2 (duas entradas para uma saída), o passeio só subia. Os
  invariantes passaram, mas a guarda "a sequência atravessa o negativo" falhou, então os invariantes
  não estavam provando nada sobre R3/R4/R5 em saldo negativo.
- **Fix:** escolha em 0..3 (metade entradas, metade saídas, passeio sem deriva) e, a cada 50 passos
  com saldo positivo, uma saída do saldo exato para forçar o R1. A guarda agora exige também um
  passo com Q = 0. O módulo puro não mudou.
- **Files modified:** `tests/unit/estoque-custo.test.ts` · **Commit:** `7e99910`

### Escolhas dentro do plano (registradas)

- Os três arquivos de teste novos passaram pelo `prettier --write`. O `prettier` não faz parte do
  `verificar`, e os arquivos existentes, inclusive `custo.ts`, não estão formatados por ele. Não
  foram mexidos.
- O `.planning/ROADMAP.md` já estava modificado no início da sessão, antes do plano. Não foi tocado
  nem incluído em commit (é do orquestrador).

## Known Stubs

Nenhum. O plano só acrescenta testes e conferências.

## Threat surface

Nenhuma superfície nova: nenhum código de produção mudou. As mitigações do `<threat_model>` agora
têm prova:
- T-06-04: 42501 no `update` e no `delete` reais como `amassa_app`;
- T-06-05: duas conexões sem impasse com `no key update`, e o controle em 40P01 com `for update`;
- T-06-06: P0001 do gatilho da unidade.

Os dados de prova são inventados (`@exemplo.test`, "Argila de prova …") e apagados ao fim.

## Self-Check: PASSED

- `tests/unit/estoque-custo.test.ts`, `tests/unit/estoque-destinos.test.ts`,
  `tests/unit/estoque-esquemas.test.ts` e `scripts/testar-migracoes.mjs` existem e estão nos
  commits `7e99910` e `7bac218`.
- Os commits `7e99910` e `7bac218` existem no branch `gsd/phase-06-estoque`.
- `STATE.md` e `ROADMAP.md` não foram modificados por este plano.
