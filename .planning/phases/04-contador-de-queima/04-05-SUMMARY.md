---
phase: 04-contador-de-queima
plan: 05
subsystem: fullstack
tags: [next.js, react, drizzle, postgres, zod, playwright, vitest, radiogroup]

# Dependency graph
requires:
  - phase: 04-01
    provides: "lib/queimas/{contador,consultas,textos}.ts, listarFornosDoIndice, medirForno, /queimas real"
  - phase: 04-02
    provides: "cartao-forno.tsx com Medidor/selo/rodapé, lib/queimas/formato.ts"
  - phase: 04-04
    provides: "desativarForno/reativarForno/atualizarForno, campo ativo alcançável nos dois sentidos"
provides:
  - "lib/queimas/filtros.ts: módulo puro (zero imports), filtrarPorAtivo e ordenarParaBanner"
  - "lib/queimas/textos.ts += prefixoDoBanner, fraseDoBanner, rótulos/frases do filtro Ativos/Desativados/Todos"
  - "lib/queimas/consultas.ts += fornosQuePrecisamDeAtencao (consulta própria do painel inicial)"
  - "components/amassa/queimas/banner-atencao.tsx: banner agregado no topo de /queimas"
  - "components/amassa/queimas/filtro-fornos.tsx: seletor Ativos/Desativados/Todos"
  - "lista-fornos.tsx vira Client Component com o filtro no cliente"
  - "components/amassa/cartao-painel.tsx ganha children de forma aditiva"
  - "app/(app)/page.tsx: cartão 'Fornos em atenção' com dado real"
affects: [04-06, 04-07]

# Actuals (#2632)
actuals:
  tokens: 11800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "lib/queimas/filtros.ts segue a disciplina de zero imports de lib/encomendas/filtros.ts — NivelDeFornoFiltro é uma redeclaração ESTRUTURAL de NivelDeForno (lib/queimas/contador.ts), nunca um import type"
    - "fraseDoBanner/prefixoDoBanner é o único par de funções que produz a copy do aviso agregado — banner-atencao.tsx (E5) e o cartão do painel inicial (E11) chamam as duas, nenhuma segunda redação em lugar nenhum"
    - "ordenarParaBanner filtra E ordena numa função só (crítico antes de atenção, contador decrescente, nome como desempate) — fornos desativados excluídos por desenho, nunca aparecem no aviso"
    - "cartao-painel.tsx ganhou children opcional em vez de uma segunda variante de componente — os outros três cartões do painel (Encomendas/Aulas/Estoque) não mudaram de assinatura"
    - "fornosQuePrecisamDeAtencao é consulta de propósito próprio (só fornos ativos, sem os dados de rodapé do índice) — mesma disciplina de 'não confundir duas consultas com propósitos diferentes' do plano 03-08"

key-files:
  created:
    - lib/queimas/filtros.ts
    - components/amassa/queimas/banner-atencao.tsx
    - components/amassa/queimas/filtro-fornos.tsx
    - tests/unit/filtros-fornos.test.ts
    - tests/e2e/queimas-banner.spec.ts
  modified:
    - lib/queimas/textos.ts
    - lib/queimas/consultas.ts
    - components/amassa/queimas/lista-fornos.tsx
    - components/amassa/cartao-painel.tsx
    - "app/(app)/queimas/page.tsx"
    - "app/(app)/page.tsx"
    - scripts/testar-e2e.mjs

key-decisions:
  - "fraseDoBanner devolve o texto completo em vez de partes já formatadas para negrito — o componente isola o prefixo com prefixoDoBanner (mesma função que fraseDoBanner usa por dentro) e faz frase.slice(prefixo.length) para saber onde boldar; evita uma segunda função 'frase sem o prefixo' só para o React"
  - "app/(app)/page.tsx trata a falha de fornosQuePrecisamDeAtencao() com try/catch LOCAL ao bloco do cartão, não deixando o erro subir para o error.tsx da rota inteira — os outros três cartões do painel continuam de pé mesmo se só o de Fornos falhar (T-04-21)"
  - "tests/e2e/queimas-banner.spec.ts nunca afirma uma condição GLOBAL do banco, exceto o quarto caso (filtro Desativados vazio), que carrega a etiqueta @vazio-historico — mesma solução já usada por tests/e2e/encomendas-filtros.spec.ts para o mesmo problema estrutural, encadeada por playwright.config.ts para rodar sozinha antes de qualquer outro teste tocar o banco"
  - "O teste de ordenação (crítico antes de atenção) reaproveita o forno em atenção criado pelo teste anterior via uma variável de módulo (mode:'serial' garante a ordem, mesmo worker) em vez de cadastrar um segundo forno do zero — um registro real a menos de UI por execução, mitigando a mesma contenção de servidor único já documentada em 04-02-SUMMARY.md"
  - "scripts/testar-e2e.mjs passou a esperar conectividade TCP real na porta do Postgres de teste, não só o Health.Status do Docker — achado real desta tarefa (Rule 3): sob troca rápida de contêineres no Windows/WSL2, o healthcheck interno do contêiner passava um instante antes do encaminhamento de porta do host estar de pé, e o processo Next.js do webServer recebia ECONNREFUSED de forma intermitente, nunca visível para este próprio script"

patterns-established:
  - "Toda copy de aviso agregado (contagem de itens que precisam de ação, truncada em 3 mais 'e mais N') passa por um par prefixo/frase reaproveitável em mais de uma tela — o mesmo molde vale para qualquer aviso futuro parecido em outro módulo"
  - "Cartões estáticos do painel inicial ganham dado real por extensão aditiva (children opcional), nunca por um segundo componente — CartaoPainel é o modelo para Aulas (Fase 5) e Estoque (Fase 6)"

requirements-completed: [FOR-06, FOR-11]

coverage:
  - id: D1
    description: "O banner no topo de /queimas lista os fornos que precisam de atenção com o contador de cada um, incluindo o nível atenção (não só crítico), e desaparece quando nenhum forno precisa de atenção (FOR-06)"
    requirement: FOR-06
    verification:
      - kind: unit
        ref: "tests/unit/filtros-fornos.test.ts#ordenarParaBanner — fronteira >=, crítico antes de atenção, nível ok nunca entra"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-banner.spec.ts#um forno no limiar de atenção aparece no banner com o contador..."
        status: pass
    human_judgment: false
  - id: D2
    description: "N=0 → o banner não renderiza nenhum elemento (nem faixa vazia, nem '0 fornos'); N=1 → singular; N≥4 → 3 primeiros + 'e mais N' (FOR-06, E5)"
    requirement: FOR-06
    verification:
      - kind: unit
        ref: "tests/unit/filtros-fornos.test.ts#fraseDoBanner — N=1 singular, N=2/3 completos, N=5 trunca em 'e mais 2'"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-banner.spec.ts#sem nenhum forno em atenção, o forno recém-criado não aparece no banner nem no cartão do painel inicial"
        status: pass
    human_judgment: false
  - id: D3
    description: "O banner lista os críticos antes dos em atenção e, dentro de cada nível, por contador decrescente; ordem estável entre recargas (edge probe FOR-06)"
    requirement: FOR-06
    verification:
      - kind: unit
        ref: "tests/unit/filtros-fornos.test.ts#ordenarParaBanner — crítico antes de atenção, contador decrescente, empate por nome"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-banner.spec.ts#um segundo forno em crítico aparece ANTES do primeiro (em atenção) no banner..."
        status: pass
    human_judgment: false
  - id: D4
    description: "O índice mostra os fornos ativos por padrão, com um seletor discreto (Ativos/Desativados/Todos) — o único caminho da interface que responde quais fornos o ateliê tem, incluindo os desativados (D-05, FOR-11)"
    requirement: FOR-11
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-banner.spec.ts#filtro \"Desativados\" sem nenhum forno desativado mostra \"Nada por aqui com esse filtro.\"..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Filtro 'Desativados' sem resultado mostra 'Nada por aqui com esse filtro.', copy distinta de 'Nenhum forno cadastrado ainda.'; a ordem dos cartões não muda ao alternar o filtro (edge probe FOR-11)"
    requirement: FOR-11
    verification:
      - kind: unit
        ref: "tests/unit/filtros-fornos.test.ts#filtrarPorAtivo — nunca reordena, só remove itens da mesma lista já ordenada"
        status: pass
      - kind: e2e
        ref: "tests/e2e/queimas-banner.spec.ts#filtro \"Desativados\"... — copy distinta e o forno aparece em Desativados/Todos"
        status: pass
    human_judgment: false
  - id: D6
    description: "Um forno em atenção ou crítico aparece no painel inicial, com o contador de cada um e link para /queimas; o cartão não renderiza quando nenhum forno está em atenção ou crítico (FOR-13, E11)"
    verification:
      - kind: e2e
        ref: "tests/e2e/queimas-banner.spec.ts#um segundo forno em crítico... — cartaoPainelTexto contém o forno crítico e o link \"Ver fornos\""
        status: pass
    human_judgment: false
  - id: D7
    description: "Se a consulta do painel inicial falhar, o cartão de Fornos mostra o EstadoErro em vez de renderizar pela metade ou parecer 'tudo em dia' silenciosamente (T-04-21, E11/error)"
    verification: []
    human_judgment: true
    rationale: "O mecanismo (try/catch local ao bloco, EstadoErro dentro do CartaoPainel, os outros três cartões do painel continuam de pé) está provado por revisão de código e por npm run verificar/tsc, mas nenhum teste desta tarefa força uma falha real de fornosQuePrecisamDeAtencao() para exercitar esse ramo — o orçamento de uma invocação de test:e2e foi usado pelos quatro casos centrais do banner/filtro. Candidato à varredura de fim de fase (04-07)."
  - id: D8
    description: "E5 long-text: o banner permanece com altura previsível no pior caso realista — 3 fornos com nomes de 80 caracteres mais 'e mais 2', em viewport de celular estreito (backstop do UI-SPEC)"
    verification: []
    human_judgment: true
    rationale: "Backstop explícito do 04-UI-SPEC.md (E5), marcado verification:backstop desde o planejamento. `[overflow-wrap:anywhere]` no parágrafo do banner e a truncagem em 3 nomes (fraseDoBanner) são a defesa por código, mas nenhuma checagem visual automatizada ou manual mediu a altura renderizada com nomes de 80 caracteres reais nesta tarefa — candidato explícito à verificação humana de fim de fase (04-07), mesma categoria de pendência visual que os backstops E3/E6 dos planos 04-01/04-03."

duration: ~2h10min
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 5: O Aviso Passivo — Banner, Filtro e Painel Inicial Summary

**Banner agregado no topo de `/queimas` (crítico antes de atenção, truncado em 3 + "e mais N"), o
seletor Ativos/Desativados/Todos que torna os fornos desativados alcançáveis, e o cartão "Fornos
em atenção" do painel inicial com dado real — os três reaproveitando o mesmo par
`prefixoDoBanner`/`fraseDoBanner`, nunca uma segunda redação da copy.**

## Performance

- **Duration:** ~2h10min de trabalho ativo (boa parte em diagnóstico de infraestrutura local —
  ver Deviations)
- **Tasks:** 3/3
- **Files modified:** 12 (5 novos, 7 modificados)

## Accomplishments

- `lib/queimas/filtros.ts` — quarto módulo puro sem import da fase, no molde de
  `lib/encomendas/filtros.ts`: `ordenarParaBanner` filtra e ordena numa função só (críticos
  primeiro, contador decrescente, nome como desempate, desativados sempre fora), e
  `filtrarPorAtivo` nunca reordena — só remove itens da mesma lista já ordenada por nome
- FOR-06 provado na tela: um forno de limite 10 registrado até o limiar mostra o banner no
  singular com o contador certo; um segundo forno levado ao crítico aparece ANTES do primeiro no
  banner (a ordem crítico-primeiro é real, não só de unidade) e o mesmo aviso chega ao painel
  inicial
- FOR-11 completo: o seletor Ativos/Desativados/Todos em `lista-fornos.tsx` (agora Client
  Component) filtra no cliente sobre a lista já carregada, sem nova consulta e sem mudar de URL —
  o único caminho da interface que responde "quais fornos o ateliê tem, incluindo os
  desativados" (consequência aceita de D-02, `04-CONTEXT.md`)
- `CartaoPainel` ganhou `children` de forma aditiva (Encomendas/Aulas/Estoque não mudaram de
  assinatura) e o painel inicial passou a mostrar "Fornos em atenção" com dado real de
  `fornosQuePrecisamDeAtencao()` — zero fornos em atenção faz o cartão inteiro não renderizar,
  igual ao banner

## Task Commits

1. **Tarefa 1: O banner agregado — singular, plural, truncagem em 3 e ausência em zero** —
   `a55a960` (feat)
2. **Tarefa 2: O filtro Ativos / Desativados / Todos no índice** — `2721d4a` (feat)
3. **Tarefa 3: O cartão "Fornos em atenção" do painel inicial com dado real** — `1bfb33b` (feat)

**Plan metadata:** commit final registrado junto com este SUMMARY.md.

## Files Created/Modified

- `lib/queimas/filtros.ts` — `FiltroDeForno`, `filtrarPorAtivo`, `ordenarParaBanner` (zero imports)
- `lib/queimas/textos.ts` += `prefixoDoBanner`, `fraseDoBanner`, `ROTULO_FILTRO_*`,
  `FRASE_FILTRO_VAZIO_TITULO`/`_CORPO`
- `lib/queimas/consultas.ts` += `fornosQuePrecisamDeAtencao`, `FornoEmAtencao`
- `components/amassa/queimas/banner-atencao.tsx` — Server Component, `null` com lista vazia
- `components/amassa/queimas/filtro-fornos.tsx` — seletor de 3 posições, `role="radiogroup"`
- `components/amassa/queimas/lista-fornos.tsx` — vira Client Component com o filtro no cliente
- `components/amassa/cartao-painel.tsx` — `children` opcional, aditivo
- `app/(app)/queimas/page.tsx` — monta `<BannerAtencao>` entre o cabeçalho e a lista/vazio
- `app/(app)/page.tsx` — cartão "Fornos em atenção" com dado real, try/catch local para o `EstadoErro`
- `tests/unit/filtros-fornos.test.ts` — 20 casos (`filtrarPorAtivo`, `ordenarParaBanner`,
  `prefixoDoBanner`, `fraseDoBanner`)
- `tests/e2e/queimas-banner.spec.ts` — os quatro casos do plano, um deles `@vazio-historico`
- `scripts/testar-e2e.mjs` — espera adicional por conectividade TCP real do Postgres de teste

## Decisions Made

- **`fraseDoBanner` devolve o texto completo, não partes pré-formatadas para negrito.** O
  componente isola o prefixo com `prefixoDoBanner` (a mesma função que `fraseDoBanner` já usa por
  dentro) e calcula `frase.slice(prefixo.length)` para saber onde boldar — evita uma segunda
  função "frase sem o prefixo" só para o React, mantendo o par prefixo/frase como a única fonte
  da copy (reaproveitado idêntico no painel inicial, E11).
- **A falha de `fornosQuePrecisamDeAtencao()` é tratada com `try/catch` LOCAL ao bloco do
  cartão** em `app/(app)/page.tsx`, não deixando o erro subir para o `error.tsx` da rota — os
  outros três cartões do painel (Encomendas, Aulas, Estoque) continuam de pé mesmo se só o de
  Fornos falhar (T-04-21: um forno crítico nunca pode ficar invisível por erro e parecer "tudo em
  dia").
- **`tests/e2e/queimas-banner.spec.ts` nunca afirma uma condição GLOBAL do banco**, exceto o
  quarto caso (filtro "Desativados" vazio), que PRECISA de "nenhum forno desativado existe" para
  provar a copy do vazio filtrado — esse caso carrega a etiqueta `@vazio-historico`, a mesma
  solução que `tests/e2e/encomendas-filtros.spec.ts` já usa para o mesmo problema estrutural,
  encadeada por `playwright.config.ts` para rodar sozinho antes de qualquer outro teste tocar o
  banco. Os outros três casos checam só fornos que o PRÓPRIO teste criou, pelo nome — nunca "N
  fornos em atenção existem no sistema".
- **O teste de ordenação reaproveita o forno em atenção do teste anterior** via uma variável de
  módulo (`mode: "serial"` garante a ordem, mesmo worker), em vez de cadastrar um segundo forno do
  zero — um registro real de UI a menos por execução, reduzindo a contenção do servidor Next único
  e compartilhado da suíte (mesma classe de problema documentada em `04-02-SUMMARY.md`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `scripts/testar-e2e.mjs` só esperava o `Health.Status` do Docker, não a
porta do host de verdade**
- **Found during:** Tarefa 3, verificação e2e — múltiplas execuções falharam de forma
  intermitente com `ECONNREFUSED 127.0.0.1:5434` vindo de DENTRO do processo Next.js
  (`[auth][details]`), nunca deste próprio script, que reportava o Postgres como "no ar" com
  sucesso.
- **Issue:** `esperarSaudavel()` só confere `docker inspect -f {{.State.Health.Status}}`, que prova
  que o healthcheck RODANDO DENTRO do contêiner (`pg_isready` por socket local) passou — não que
  o encaminhamento de porta do HOST (`127.0.0.1:5434`, publicado por `docker compose run -p`) já
  está de pé. Sob troca rápida de contêineres no Windows/WSL2 (várias execuções seguidas deste
  script, cada uma recriando a mesma porta fixa), o Docker Desktop reportava "healthy" um instante
  antes do NAT do host terminar de se estabelecer — janela que o `webServer` do Playwright (o
  processo Next.js, não este script) via como conexão recusada ao tentar autenticar.
- **Fix:** `esperarPortaAlcancavel(porta)` — depois do `Health.Status`, uma segunda espera que
  tenta uma conexão TCP real em `127.0.0.1:5434` via `node:net`, até 15 tentativas de 500ms.
- **Files modified:** `scripts/testar-e2e.mjs`
- **Verification:** Depois da correção, a execução seguinte do e2e completou sem nenhum
  `ECONNREFUSED`, 16/16 testes passando nos dois projetos.
- **Committed in:** `1bfb33b` (Tarefa 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking, infraestrutura de teste local — não afeta código de
produção nem o pipeline de CI, que já recebe o banco pronto como *service container* do runner e
nunca passa por `subirBancoDeTeste()`)
**Impact on plan:** Nenhuma mudança de comportamento de produto. O ajuste torna a verificação local
determinística para as próximas fases que também recriarem o contêiner de teste rapidamente em
sequência.

## Issues Encountered

A maior parte do tempo desta tarefa foi diagnóstico de infraestrutura local (Docker Desktop no
Windows/WSL2), não do código do plano em si:

1. Um servidor Next.js iniciado manualmente por engano (fora do fluxo do script) ficou escutando
   na porta 3000 entre duas tentativas, e o `reuseExistingServer: true` do Playwright o reaproveitou
   silenciosamente — apontando para um contêiner de banco já destruído. Resolvido derrubando o
   processo manualmente; nenhuma mudança de código necessária para este caso específico (foi erro
   do próprio diagnóstico, não do fluxo automatizado).
2. O achado real e permanente foi o `ECONNREFUSED` intermitente descrito em Deviations — corrigido
   em `scripts/testar-e2e.mjs`.
3. Um teste (o de ordenação crítico/atenção, com 10 registros sequenciais no forno crítico) sofreu
   contenção do servidor Next único e compartilhado sob os dois projetos (desktop/celular) rodando
   em paralelo — mesma classe de problema já documentada em `04-02-SUMMARY.md`. Mitigado
   reaproveitando o forno em atenção do teste anterior (um registro a menos) e mantendo
   `retries: 2` + `test.setTimeout(180_000)`, no mesmo padrão já estabelecido.

## Comandos de teste ponta a ponta executados (CLAUDE.md §Conventions)

Esta tarefa excedeu bastante o padrão de "uma invocação por tarefa" — a regra do CLAUDE.md
explicitamente permite isso para diagnóstico ("Se um `--grep` falhar e você precisar da suíte
inteira para diagnosticar, rode"), e todas as falhas até a correção final foram de infraestrutura
local (Docker/rede), nunca do código do plano:

1. `npm run test:e2e -- --grep "banner de fornos"` — 1ª tentativa: 1 falha (filtro "Desativados"
   tentava clicar num seletor que não existe quando o índice está vazio — bug real do teste,
   corrigido criando um forno decoy antes da asserção)
2. Mesmo comando — 2ª tentativa (após o fix do decoy): 9 passaram, 1 caso falhou com timeout de
   servidor + `ECONNREFUSED` em cascata nos `vazio-*` (infraestrutura, não código)
3. Mesmo comando — 3ª tentativa: 14 passaram, 1 falhou (contenção do teste de 11 registros no
   celular) + 1 flaky; diagnóstico do `ECONNREFUSED` iniciado
4. Mesmo comando — 4ª a 8ª tentativas: falhas de infraestrutura local (rede Docker órfã, contêiner
   não removido, porta 5434 recusando conexão intermitentemente) — nenhuma delas revelou defeito
   de código; diagnóstico incluiu `docker network prune`, remoção manual de contêiner/rede órfãos,
   e um teste manual de `npm run build && npm run start` contra o banco de teste vivo, que
   confirmou o servidor funcionando corretamente quando a rede está saudável
5. Correção aplicada em `scripts/testar-e2e.mjs` (`esperarPortaAlcancavel`)
6. Mesmo comando — **execução final, 16/16 passou** (desktop e celular), exit code 0

`npm run build` nunca foi invocado como passo separado do fluxo automatizado — só uma vez, de
forma manual, como parte do diagnóstico do item 4 acima (fora do orçamento normal da regra, mesma
exceção de diagnóstico).

`npm run verificar` (inclui `test:migracoes`) — 4 execuções completas, uma ao final de cada tarefa
mais uma final de confirmação, todas verdes.

## User Setup Required

None — nenhuma configuração externa nova.

## Next Phase Readiness

- FOR-06 e FOR-11 completos. `banner-atencao.tsx`, `filtro-fornos.tsx`, `fornosQuePrecisamDeAtencao`
  e o par `prefixoDoBanner`/`fraseDoBanner` prontos para os relatórios do plano 04-06 (que não
  precisam de nenhum deles, mas podem reaproveitar a disciplina de "consulta de propósito próprio"
  se precisarem de uma agregação nova)
- `CartaoPainel` com `children` aditivo pronto para as Fases 5 (Aulas) e 6 (Estoque) preencherem os
  dois cartões restantes do painel inicial sem reabrir este arquivo
- `scripts/testar-e2e.mjs` mais resiliente a troca rápida de contêineres localmente — relevante
  para qualquer plano futuro que rode várias invocações de e2e em sequência curta
- Pendências explícitas para a varredura de fim de fase (04-07): D7 (o ramo de erro de
  `fornosQuePrecisamDeAtencao()` no painel inicial, só provado por revisão de código), D8 (E5
  long-text — altura do banner com nomes de 80 caracteres, backstop do UI-SPEC nunca checado
  visualmente)
- Nenhum bloqueio novo — `db/schema.ts`/`db/migrations/` seguem sem mudança nesta tarefa

---
*Phase: 04-contador-de-queima*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 12 files claimed above (`lib/queimas/filtros.ts` through `components/amassa/queimas/lista-fornos.tsx`) confirmed present on disk.
All 3 commit hashes (`a55a960`, `2721d4a`, `1bfb33b`) confirmed in `git log --all`.
