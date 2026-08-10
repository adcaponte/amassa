---
phase: 04-contador-de-queima
plan: 01
subsystem: fullstack
tags: [drizzle, postgres, zod, server-actions, react-hook-form, sonner, playwright, vitest, next.js]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas
    provides: "molde de esquemas/ações/consultas/textos por entidade (D-15), Dialog único com CSS responsivo (achado do 03-06), EstadoVazio com hrefBotao"
  - phase: 02b-design-system-e-casca-da-aplicacao
    provides: "moldura de /queimas (placeholder), tokens --color-biscoito/-esmalte/-ouro e --color-forno-*, papéis text-mono/text-corpo/text-apoio"
provides:
  - "tabelas fornos/queimas/manutencoes com gatilhos tocar_atualizado_em_*, geradas e prontas para aplicação em produção no plano 04-07"
  - "lib/queimas/contador.ts (módulo puro, testado antes do código): limiarDeAtencao, medirForno"
  - "lib/queimas/{esquemas,acoes,consultas,textos}.ts: criarForno, registrarQueima, excluirQueima, listarFornosDoIndice"
  - "/queimas real: cadastro de forno pelo botão do estado vazio (D-02), registro de queima em dois toques (D-04), Desfazer de 7 segundos"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07]

# Actuals (#2632)
actuals:
  tokens: 20605
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "módulo puro testado antes do código (RED commit -> GREEN commit), zero imports, sem leitura de relógio"
    - "consulta devolve dado BRUTO (ocorrenciasDeQueima[], ultimaManutencaoEm) — quem decide contador/total/nível é o módulo puro chamado pelo componente, nunca a consulta nem SQL agregado"
    - "fluxo de dois toques NÃO otimista: nada muda na tela antes da resposta do servidor (diverge de propósito do padrão otimista de AjusteRapidoEtapa)"
    - "SQLSTATE 23503 (foreign_key_violation) traduzido em mensagem humana via checagem de erro.code"

key-files:
  created:
    - db/migrations/0007_queimas.sql
    - db/migrations/0008_gatilhos-queimas.sql
    - lib/queimas/contador.ts
    - lib/queimas/esquemas.ts
    - lib/queimas/acoes.ts
    - lib/queimas/consultas.ts
    - lib/queimas/textos.ts
    - components/amassa/queimas/cartao-forno.tsx
    - components/amassa/queimas/formulario-forno.tsx
    - components/amassa/queimas/registrar-queima.tsx
    - tests/unit/contador.test.ts
    - tests/e2e/queimas-tracador.spec.ts
    - tests/e2e/queimas-registro.spec.ts
  modified:
    - db/schema.ts
    - scripts/testar-migracoes.mjs
    - app/(app)/queimas/page.tsx

key-decisions:
  - "Checkpoint humano (Tarefa 1): aplicar-no-fim-da-fase — migração gerada agora, aplicada em produção só no plano de fechamento 04-07, após backup, à mão"
  - "consultas.ts devolve dado bruto (ocorrenciasDeQueima/ultimaManutencaoEm), não contador/total pré-agregados — reconciliação da descrição literal da Tarefa 2 (SQL 'left join lateral') com o key_link explícito da Tarefa 3 (cartao-forno.tsx chama medirForno())"
  - "Numeração 0007_queimas/0008_gatilhos-queimas confirmada (não 0004, que era só rótulo do ROADMAP pré-antecipação de fase)"
  - "View fornos_medidos deliberadamente NÃO criada — lib/queimas/contador.ts + consultas.ts reproduzem a mesma lógica sem um segundo lugar fora de TABELAS_ESPERADAS"

patterns-established:
  - "Server Action de escrita única para exclusão de queima (excluirQueima) reaproveitada tanto pelo Desfazer sem confirmação quanto pela exclusão confirmada do histórico (plano 04-03) — a diferença é só quem confirma"
  - "esquemaQueima com exatamente dois campos (fornoId, tipo) — autoria nunca aceita do cliente, sempre de exigirUsuario()"

requirements-completed: [FOR-01, FOR-02, FOR-03, FOR-13]

coverage:
  - id: D1
    description: "Um forno é cadastrado pela interface pelo botão do estado vazio/índice (D-02, sem tela de cadastro dedicada) e sobrevive a um recarregamento imediato"
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-tracador.spec.ts#um forno cadastrado pelo botão do estado vazio aparece como cartão no índice, e sobrevive a um recarregamento"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma queima é registrada em exatamente dois toques — 'Queimar' e depois o tipo — sem formulário, e o toast aparece em menos de 5 segundos"
    requirement: FOR-01
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-registro.spec.ts#dois toques — 'Queimar' e depois o tipo — registram a queima, o toast aparece em menos de 5s, e o contador sobrevive a um recarregamento"
        status: pass
    human_judgment: false
  - id: D3
    description: "O aviso de 7 segundos com 'Desfazer' remove a queima recém-registrada e o contador volta ao valor anterior, inclusive depois de recarregar"
    requirement: FOR-02
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-registro.spec.ts#'Desfazer' remove a queima recém-registrada e o contador volta ao valor anterior, também depois de recarregar"
        status: pass
    human_judgment: false
  - id: D4
    description: "Os três tipos de queima disponíveis são biscoito, esmalte e ouro, em ordem fixa Biscoito · Esmalte · Ouro"
    requirement: FOR-03
    verification: []
    human_judgment: true
    rationale: "O enum do Postgres (tipo_queima) e o z.enum de esquemaQueima garantem os três valores; o seletor sempre renderiza os três (TIPOS_EM_ORDEM.map, sem gate condicional). Mas o e2e desta tarefa só CLICOU biscoito e esmalte (orçamento de uma invocação por tarefa) — ouro nunca foi exercitado ponta a ponta. Verificado visualmente pelo dono durante o checkpoint do tracer (fornos 'Adao'/'teste' criados manualmente), mas não com o terceiro tipo especificamente. Candidato a fechamento num plano futuro ou na varredura completa de fim de fase (04-07)."
  - id: D5
    description: "registrado_por vem sempre do usuário da sessão (exigirUsuario()), nunca aceito do cliente (T-04-02, FOR-13)"
    requirement: FOR-13
    verification:
      - kind: other
        ref: "npm run verificar-acoes (árvore sintática: registrarQueima/excluirQueima têm exigirUsuario() como primeira instrução)"
        status: pass
    human_judgment: true
    rationale: "verificar-acoes prova a POSIÇÃO da chamada, e esquemaQueima (revisão de código) prova que 'registradoPor' não é um campo aceito do cliente — mas nenhum teste automatizado lê a coluna registrado_por do banco depois do registro para confirmar que o valor gravado é de fato o id do usuário logado. Renderizar o nome do autor na tela é escopo do plano 04-03 (página do forno)."
  - id: D6
    description: "As três tabelas novas (fornos, queimas, manutencoes) com os três gatilhos tocar_atualizado_em_* existem num Postgres limpo depois de 0000..0008, e TABELAS_ESPERADAS as conhece"
    verification:
      - kind: integration
        ref: "npm run test:migracoes"
        status: pass
    human_judgment: false

duration: ~55min (útil; span real maior por causa de duas pausas de checkpoint)
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 1: Traçado do Módulo de Fornos Summary

**Três tabelas (fornos/queimas/manutencoes) com gatilhos, `lib/queimas/contador.ts` testado antes do código, e `/queimas` real: cadastro de forno e registro de queima em dois toques com Desfazer de 7s, tudo provado ponta a ponta.**

## Performance

- **Duration:** ~55min de trabalho ativo, span de sessão maior por duas pausas de checkpoint (Tarefa 1 — decisão de aplicação da migração; gate do tracer após a Tarefa 2)
- **Tasks:** 3/3 (Tarefa 1 checkpoint:decision resolvida, Tarefa 2 tracer, Tarefa 3 auto/tdd)
- **Files modified:** 18 (14 novos, 4 modificados) + `.planning`/`STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` nesta commit final

## Accomplishments

- O módulo de Fornos existe de ponta a ponta: banco → Zod → Server Action → consulta → Server Component → Client Component → teste e2e, exatamente a arquitetura que a Fase 4 precisa provar antes de expandir horizontalmente
- `lib/queimas/contador.ts` escrito e testado ANTES do código (RED commit `ba5a02b`, GREEN commit `ec7d92b`) — 13/13 casos verdes, cobrindo os limiares 89/90/99/100/101, o piso `Math.max(1, ...)`, o corte estritamente maior que a última manutenção, forno sem queima, `RangeError` de limite inválido e idempotência
- Registrar uma queima leva dois toques medidos por e2e, sem nenhum indicador de carregamento entre eles, e o fluxo NUNCA é otimista — a queima existe porque o banco confirmou

## Task Commits

1. **Tarefa 1: checkpoint:decision (porta de mão única)** — resolvida via `AskUserQuestion`, sem commit de código (decisão registrada nesta SUMMARY)
2. **Tarefa 2: Traçado — tabelas + forno cadastrado no índice** — `d464905` (feat)
3. **Tarefa 3a: teste vermelho de `medirForno`/`limiarDeAtencao`** — `ba5a02b` (test, RED)
4. **Tarefa 3b: módulo puro `lib/queimas/contador.ts`** — `ec7d92b` (feat, GREEN)
5. **Tarefa 3c: registrar queima em dois toques + Desfazer** — `c195c1f` (feat)

**Plan metadata:** commit final registrado junto com este SUMMARY.md (ver rodapé do PR/log).

## TDD Gate Compliance

Tarefa 3 (`tdd="true"`) — gate sequence confirmado no git log: `test(04-01)` em `ba5a02b` ANTES de `feat(04-01)` em `ec7d92b`. RED confirmado rodando `npx vitest run tests/unit/contador.test.ts` antes de `lib/queimas/contador.ts` existir (`Cannot find module '../../lib/queimas/contador'`); GREEN confirmado com os 13 testes passando depois. Sem REFACTOR — o módulo saiu limpo na primeira escrita, nenhuma limpeza pós-GREEN foi necessária.

## Files Created/Modified

- `db/schema.ts` — enum `tipo_queima` e tabelas `fornos`/`queimas`/`manutencoes`
- `db/migrations/0007_queimas.sql` — gerado por `drizzle-kit generate`, renomeado (Desvio 1 do plano)
- `db/migrations/0008_gatilhos-queimas.sql` — os três gatilhos `tocar_atualizado_em_*`, escritos à mão
- `db/migrations/meta/_journal.json`, `meta/0007_snapshot.json` — bookkeeping do Drizzle
- `scripts/testar-migracoes.mjs` — `TABELAS_ESPERADAS` += `fornos`, `queimas`, `manutencoes`
- `lib/queimas/contador.ts` — `NivelDeForno`, `MedidaDoForno`, `limiarDeAtencao`, `medirForno` (zero imports)
- `lib/queimas/esquemas.ts` — `esquemaId`, `esquemaForno`, `esquemaQueima`
- `lib/queimas/acoes.ts` — `criarForno`, `registrarQueima`, `excluirQueima`
- `lib/queimas/consultas.ts` — `FornoMedido`, `listarFornosDoIndice` (dado bruto, não pré-agregado)
- `lib/queimas/textos.ts` — frases fixas + `rotuloDoTipo`
- `app/(app)/queimas/page.tsx` — índice real (estado vazio ligado, grade de cartões, `?novo`)
- `components/amassa/queimas/cartao-forno.tsx` — chama `medirForno()`, monta `RegistrarQueima`
- `components/amassa/queimas/formulario-forno.tsx` — Dialog único responsivo, criação de forno
- `components/amassa/queimas/registrar-queima.tsx` — o fluxo de dois toques não otimista
- `tests/unit/contador.test.ts` — 13 casos do módulo puro
- `tests/e2e/queimas-tracador.spec.ts` — `@vazio-global` + cadastro sobrevivendo a reload
- `tests/e2e/queimas-registro.spec.ts` — dois toques medidos + Desfazer

## Decisions Made

- **Checkpoint Tarefa 1 (porta de mão única):** `aplicar-no-fim-da-fase`. A migração `0007`/`0008` é gerada e commitada agora, mas só é aplicada num banco de produção real no plano de fechamento `04-07`, depois de um backup, à mão — nunca pelo pipeline. `npm run test:migracoes` e o e2e já a exercitam de verdade contra um Postgres efêmero a cada execução.
- **`consultas.ts` devolve dado bruto, não contador/total pré-agregados.** A Tarefa 2 descreve literalmente um `left join lateral` com `count filter` (espelhando `fornos_medidos`); a Tarefa 3 diz explicitamente que `cartao-forno.tsx` chama `medirForno()`. As duas leituras juntas só fazem sentido se a consulta expuser o dado bruto (`ocorrenciasDeQueima: string[]`, `ultimaManutencaoEm: string | null`) e o módulo puro decidir contador/total/nível — nunca SQL e TypeScript com a mesma regra em dois lugares. Implementado com duas consultas (fornos, queimas+manutencoes por `inArray`) e agrupamento em memória, no mesmo molde de `anexarItensEEtapas` (`lib/encomendas/consultas.ts`) — sem `db.execute(sql\`...\`)` cru, que não tem nenhum precedente no projeto.
- **Erro de chave estrangeira (forno excluído entre a leitura da tela e o toque) traduzido via `erro.code === "23503"`** (SQLSTATE `foreign_key_violation`) — primeira vez que o projeto checa um código de erro do Postgres diretamente; documentado inline em `acoes.ts` para não virar um `instanceof` genérico que capturaria também erro de conexão.
- **`FormularioForno` não reaproveita `esquemaForno.shape.limite` diretamente** — o `.default(100)` do servidor tornaria o tipo do formulário `number | undefined`, mas o campo sempre nasce preenchido com 100; reescrito como schema local equivalente (mesma mensagem de erro), sem o `.default`.
- **FOR-11 ("fornos podem ser cadastrados e desativados, mas nunca excluídos") listado no frontmatter deste plano, mas NÃO marcado como concluído.** Este plano entrega só metade — o cadastro (`criarForno`). Desativar/reativar é escopo explícito do plano `04-04` ("Produzidos pelos planos irmãos" no próprio `04-01-PLAN.md`). Marcar FOR-11 completo agora deixaria a matriz de rastreabilidade de `REQUIREMENTS.md` incorreta; fica pendente até `04-04`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Servidor `next dev` remanescente na porta 3000 desviou o e2e para o Postgres de dev local**
- **Found during:** primeira tentativa de `npm run test:e2e -- --grep "registro de queima"` (Tarefa 3)
- **Issue:** durante a verificação humana do tracer (checkpoint anterior), um `next dev` foi iniciado na porta 3000 contra o Postgres de dev local (`127.0.0.1:5433`, com usuários reais seedados). `playwright.config.ts` tem `reuseExistingServer: true`: ao rodar o e2e, o Playwright reaproveitou esse servidor em vez de subir o seu próprio (contra o Postgres efêmero de teste), fazendo os quatro testes `@vazio-global` falharem no login com `erro=credenciais` — a conta `gestora.teste@exemplo.test` criada pelo `globalSetup` só existe no banco de teste, não no banco de dev.
- **Fix:** identifiquei o processo (`node.exe`, PID na porta 3000 via `netstat`) e o encerrei (`taskkill /F`) antes de rodar o e2e de novo. A segunda execução usou o próprio servidor controlado do Playwright, contra o Postgres efêmero correto.
- **Files modified:** nenhum arquivo do repositório — só estado de processo local.
- **Verification:** `npm run test:e2e -- --grep "registro de queima"` — 13/13 passou na segunda tentativa (todos os `@vazio-global` e os 4 casos novos de registro).
- **Note:** o servidor de dev do dono não foi recriado por mim — ele estava a serviço só da verificação visual do checkpoint anterior, que já havia sido concluída.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking, estado de processo local, não código)
**Impact on plan:** Nenhum impacto em código ou no comportamento entregue. Sem esse ajuste, o e2e desta tarefa teria continuado falhando por uma causa externa ao código escrito nesta tarefa.

## Issues Encountered

Nenhum além do já registrado acima em Deviations. O checkpoint da Tarefa 1 (decisão) e o gate humano do traçado (Tarefa 2, tracer) foram os dois pontos de parada previstos pelo próprio plano — ambos resolvidos pelo dono, documentados nas seções acima.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

- `npm run test:e2e -- --grep "tracador"` — 1 execução (Tarefa 2), 11/11 passou
- `npm run test:e2e -- --grep "registro de queima"` — 2 execuções (Tarefa 3): a primeira falhou por causa externa (servidor de dev na porta 3000, documentado acima), a segunda passou 13/13 depois do ajuste. Nenhum `npm run build` separado em nenhuma das duas — a execução do e2e já constrói.
- `npm run verificar` (inclui `test:migracoes`) — 2 execuções completas (uma ao final da Tarefa 2, outra ao final da Tarefa 3), ambas verdes.

## User Setup Required

None — nenhuma configuração externa nova. A aplicação da migração `0007`/`0008` em produção fica para o plano `04-07`, por decisão do dono no checkpoint da Tarefa 1.

## Next Phase Readiness

- `lib/queimas/{esquemas,acoes,consultas,textos,contador}.ts` prontos para os planos 04-02 a 04-06 estenderem (medidor visual, página do forno, manutenção, banner, relatórios)
- `excluirQueima` já existe e é reaproveitável pelo histórico do plano 04-03 (com confirmação) sem nenhuma ação nova
- Pendências explícitas para planos futuros: nível visual/entalhes do medidor (04-02), rodapé "Última manutenção em..." e nome do autor renderizado na tela (04-03), desativar/reativar forno — completando FOR-11 (04-04), banner agregado (04-05), Recharts (04-06), aplicação da migração em produção com backup (04-07)
- Nenhum bloqueio novo — `db/schema.ts` e `db/migrations/` já em sincronia (`npm run db:generate` confirmado sem drift)

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 17 files claimed above (`db/schema.ts` through this SUMMARY.md) confirmed present on disk.
All 4 commit hashes (`d464905`, `ba5a02b`, `ec7d92b`, `c195c1f`) confirmed in `git log --all`.
