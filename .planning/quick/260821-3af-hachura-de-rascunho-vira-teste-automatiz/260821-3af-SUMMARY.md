---
phase: quick-260821-3af
plan: 01
subsystem: testing
tags: [playwright, e2e, encomendas, gantt, css-computado, d-10]

requires:
  - phase: 03-gestor-de-encomendas
    provides: "gantt.tsx e trilha-segmentos.tsx com o tratamento visual de rascunho (D-10) já
      implementado, aprovado só por leitura de código"
provides:
  - "Dois testes e2e (`tests/e2e/encomendas-indice.spec.ts`) que provam, por CSS computado, a
    hachura diagonal e a preservação da cor cheia da etapa em encomendas rascunho, no Gantt do
    desktop e no cartão do celular"
  - "Item de verificação humana C da Fase 3 anotado com `fechado_por_teste`, sem ser apagado"
affects: [03-gestor-de-encomendas, 03-VERIFICATION]

actuals:
  tokens: 3070
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Par rascunho + controle no mesmo teste, localizado só pelo id que o próprio teste
      descobriu (idDaEncomenda) — nunca por contagem global do banco"
    - "Asserção de 'cor cheia preservada' por comparação direta de string entre o
      background-image do rascunho e o background-color computado do controle, em vez de
      recalcular a cor"

key-files:
  created: []
  modified:
    - tests/e2e/encomendas-indice.spec.ts
    - .planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md

key-decisions:
  - "A asserção de cor cheia NÃO precisou do caminho de reserva (regex de canais numéricos) —
    o Chromium serializa o `background-color` do controle e o stop de cor dentro do
    `background-image` do rascunho na mesma representação, então `toContain` bateu direto."
  - "Confirmado por leitura de trilha-segmentos.tsx: o segmento da trilha do celular nunca tem
    borda tracejada em nenhum status (só 2px sólidos na etapa atual) — o teste do cartão não
    afirma borda, e documenta em comentário que a ausência é do componente, não esquecimento."

requirements-completed: [VERIF-03-C, D-10]

coverage:
  - id: D1
    description: "Gantt desktop: barra e losango de encomenda rascunho mostram
      background-image repeating-linear-gradient, borda tracejada de 1px e opacity 1,
      preservando a background-color do controle dentro do gradiente"
    requirement: "D-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#Gantt desktop (ENC-03, ENC-06, ENC-07) › uma encomenda em rascunho desenha barra e losango com hachura diagonal, preservando a cor cheia da etapa (D-10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lista mobile: segmentos produção/secagem da trilha em rascunho mostram
      repeating-linear-gradient e opacity 1, preservando a cor do controle"
    requirement: "D-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#Lista mobile (ENC-08, ENC-09) › uma encomenda em rascunho desenha os segmentos da trilha com hachura diagonal, preservando a cor cheia da etapa (D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selo RASCUNHO conta exatamente 1 vez na linha/cartão da encomenda em rascunho
      e 0 vezes na de controle, nos dois viewports"
    requirement: "VERIF-03-C"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#Gantt desktop (ENC-03, ENC-06, ENC-07) › uma encomenda em rascunho desenha barra e losango com hachura diagonal, preservando a cor cheia da etapa (D-10)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/encomendas-indice.spec.ts#Lista mobile (ENC-08, ENC-09) › uma encomenda em rascunho desenha os segmentos da trilha com hachura diagonal, preservando a cor cheia da etapa (D-10)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-21
status: complete
---

# Quick 260821-3af: Hachura de rascunho vira teste automatizado Summary

**Dois testes e2e novos provam por CSS computado (não por texto na tela) que a hachura diagonal e
o selo RASCUNHO existem no Gantt do desktop e no cartão do celular, e que a hachura preserva a cor
cheia da etapa em vez de reduzir opacidade (D-10) — fechando a verificação humana C da Fase 3.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 1
- **Files modified:** 2 (1 comitado, 1 anotação de doc sem commit)

## Accomplishments

- Teste "Gantt desktop ... hachura diagonal" cria uma encomenda rascunho e uma de controle,
  compara `background-image`, `border-top-style/width` e `opacity` computados da barra e do
  losango `queima1`, e confirma que o gradiente do rascunho contém a `background-color` exata do
  controle.
- Teste "Lista mobile ... hachura diagonal" espelha a mesma prova nos segmentos `producao` e
  `secagem` da trilha do cartão.
- Auxiliar `idDaEncomenda` novo, que descobre o `id` de uma encomenda pelo nome lendo o
  `data-testid` do cartão (sempre presente no HTML nos dois viewports, D-02) — sem tocar no
  `criarEncomenda` compartilhado por ~20 testes deste arquivo.
- `.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md`: item de `human_verification`
  "Semear duas encomendas 'rascunho' por SQL direto..." ganhou a chave `fechado_por_teste`
  (arquivo, títulos dos dois testes, hash do commit) — mantido no relatório, não apagado, com nota
  explicando que o motivo original era falta de teste, agora resolvido.

## Task Commits

1. **Tarefa única: a hachura de rascunho vira asserção de CSS computado, no Gantt e no cartão** —
   `8446d48` (test)

_Nenhum commit de metadata de plano separado — este quick não gera SUMMARY/STATE/ROADMAP em
commit próprio; o orquestrador cuida do commit de docs._

## Files Created/Modified

- `tests/e2e/encomendas-indice.spec.ts` — dois testes novos + auxiliar `idDaEncomenda` + import de
  `SELO_RASCUNHO` e `marcarComoRascunho` (comitado em `8446d48`)
- `.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md` — anotação `fechado_por_teste` no
  item de verificação humana C (deixado no disco, sem commit — cabe ao orquestrador)

## Decisões e observações registradas pelo plano

**A asserção de cor cheia não precisou do afrouxamento previsto.** O plano previa que, se o
Chromium serializasse a parada de cor dentro de `background-image` num espaço de cor diferente do
de `background-color`, o afrouxamento permitido seria comparar trios numéricos de canais via regex
(nunca `toContain("gradient")`). Isso não foi necessário: `toContain` direto entre o
`background-image` do rascunho e o `background-color` do controle passou de primeira, nos dois
testes, porque as duas leituras saem do mesmo `getComputedStyle`/mesmo documento e usam a mesma
serialização.

**Pergunta de coerência visual para o dono (não resolvida aqui, por instrução do plano):** o Gantt
dá 1px de borda tracejada a toda barra/losango em rascunho; a trilha do cartão do celular
(`trilha-segmentos.tsx`) nunca tem borda tracejada em nenhum status — só 2px sólidos na etapa
atual. O teste do cartão não afirma borda tracejada (deixaria de existir para afirmar) e documenta
em comentário que a ausência é do componente, intencional para este plano. Fica em aberto se a
trilha deveria ganhar uma borda tracejada equivalente para consistência visual entre as duas
superfícies — decisão de design do dono, não deste quick.

## e2e: quantas vezes rodou e por quê

**Uma única invocação**, exatamente como o orçamento do plano manda:

```
npm run test:e2e -- --grep "hachura"
```

Resultado: 16 testes elegíveis pela cadeia de `dependencies` do `playwright.config.ts`
(`vazio-* → desktop/celular`) rodaram — os 12 testes `@vazio-*` (dependências de setup dos
projetos) mais os 2 testes novos de "hachura", cada um instanciado nos dois projetos
(`desktop`/`celular`) com `test.skip` no espelho errado. 14 passed, 2 skipped, 0 failed. Nenhuma
segunda rodada foi necessária — a asserção de cor passou na primeira tentativa.

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma mudança em código de produção
(`gantt.tsx`, `trilha-segmentos.tsx`, `cartao-encomenda.tsx`, `textos.ts`, `db/schema.ts`
permanecem intactos — confirmado por `git show --stat --name-only --format= HEAD`, que lista só
`tests/e2e/encomendas-indice.spec.ts`). Nenhuma dependência nova instalada. Nenhuma migração.

## Known Stubs

Nenhum. Este plano só acrescenta teste sobre código de produção já existente e completo.

## Issues Encountered

None.

## `npm run verificar`

Rodou limpo ao final: `lint` (0 avisos), `tsc --noEmit` (0 erros), `verificar-acoes` (17 ações
conferidas, 0 violações fora das fixtures propositalmente violadoras), `vitest run` (432 testes,
26 arquivos, todos passed) e `test:migracoes` (Postgres efêmero próprio, migrações aplicadas,
todas as afirmações passaram). `db/schema.ts` e `TABELAS_ESPERADAS` não foram tocados, como
esperado.

## Next Phase Readiness

- O item de verificação humana C da Fase 3 (hachura de rascunho) está fechado por teste
  automatizado — não bloqueia mais nenhum ship/milestone por falta de prova.
- A pergunta de design sobre a trilha do celular não ter borda tracejada (ver acima) fica como
  item para o dono decidir num momento futuro; não é bloqueante e não foi resolvida aqui por
  instrução explícita do plano.
- A pergunta de produto sobre rascunho ser alcançável pela UI (ou sumir do produto) continua
  parqueada em `STATE.md` §Deferred Items, como já estava — não reaberta por este plano.

---
*Quick task: 260821-3af*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: tests/e2e/encomendas-indice.spec.ts
- FOUND: .planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md
- FOUND: .planning/quick/260821-3af-hachura-de-rascunho-vira-teste-automatiz/260821-3af-SUMMARY.md
- FOUND commit: 8446d48
