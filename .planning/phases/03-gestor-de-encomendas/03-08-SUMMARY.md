---
phase: 03-gestor-de-encomendas
plan: 08
subsystem: ui
tags: [nextjs-15, react-19, css-print, playwright, axe-core, drizzle, ci-cd, docker]

# Dependency graph
requires:
  - phase: 03-gestor-de-encomendas (plano 01)
    provides: "db/migrations/0005_encomendas.sql, 0006_gatilhos-encomendas.sql — as
      migrações que este plano finalmente aplica em produção"
  - phase: 03-gestor-de-encomendas (plano 02)
    provides: "lib/encomendas/cronograma.ts (calcularCronograma, situacaoEm),
      lib/encomendas/textos.ts (textoDaSituacao com a variante semCor já prevista desde o
      plano 02 especificamente para esta folha)"
  - phase: 03-gestor-de-encomendas (plano 04)
    provides: "lib/encomendas/gantt.ts (ordenarParaGantt) — o mesmo comparador que a folha
      impressa reusa para nunca discordar da ordem do índice"
provides:
  - "app/(app)/encomendas/imprimir/page.tsx: a folha A4 (D-18, ENC-14) — escopo próprio e
    fixo, quatro colunas exatas, sem biblioteca de PDF"
  - "lib/encomendas/consultas.ts: listarEncomendasAtivas() — consulta de propósito
    DIFERENTE de listarEncomendasDoIndice(hoje), nunca confundidas"
  - "app/globals.css: bloco @media print (@page A4/15mm + ocultação da casca) acrescentado
    ao fim, nenhum token existente tocado"
  - "tests/e2e/encomendas.spec.ts: o fluxo completo criar→editar→excluir e a prova de
    ENC-12 com dois browser.newContext() independentes"
  - "docs/operacao/04-migracao-encomendas.md: o roteiro que o dono executou de verdade
    contra o banco de produção"
  - "O módulo de Encomendas inteiro (ENC-01 a ENC-14) migrado e em uso em produção —
    fecha a Fase 3"
affects: [04-contador-de-queima]

# Actuals (#2632)
actuals:
  tokens: 22000
  tasks: 4
  commits: 9

tech-stack:
  added: []
  patterns:
    - "Consulta de escopo próprio e fixo (listarEncomendasAtivas) vivendo ao lado de uma
      consulta de escopo dinâmico (listarEncomendasDoIndice) no mesmo arquivo, com um
      helper interno (anexarItensEEtapas) compartilhando só a parte de itens/etapas — o
      WHERE de cada uma nunca é compartilhado, de propósito"
    - "@media print como bloco ÚNICO em app/globals.css, nunca por página — esconde a
      casca da aplicação (sidebar/cabeçalho móvel/barra inferior) sempre que qualquer
      rota for impressa, com !important justificado por escrito (única ocorrência do
      projeto) porque as classes utilitárias responsivas da casca têm a mesma
      especificidade de um seletor de atributo"
    - "table-layout: fixed + overflow-wrap: anywhere no <th> — a lição de que um
      cabeçalho de coluna comprido ('Conclusão prevista') pode forçar uma tabela além do
      viewport a 320px mesmo com as células do corpo já preparadas para quebrar"
    - "Client Component sibling criado só para chamar window.print() (botao-imprimir-folha.tsx)
      — mesmo idioma de botao-salvar-encomenda.tsx (plano 01): a página que precisa de
      exigirUsuario() como Server Component não pode ter onClick, então o gatilho de
      interação vira um arquivo próprio, pequeno, sem estado"
    - "Auxiliar de teste com cliente pg direto (tests/e2e/apoio/marcar-rascunho.ts) para
      alcançar um estado que nenhum caminho de escrita da aplicação alcança — mesmo
      padrão já estabelecido por alternar-ativo.ts/registrar-backup.ts"

key-files:
  created:
    - app/(app)/encomendas/imprimir/page.tsx
    - app/(app)/encomendas/imprimir/impressao.module.css
    - components/amassa/encomendas/botao-imprimir.tsx
    - components/amassa/encomendas/botao-imprimir-folha.tsx
    - tests/e2e/encomendas-impressao.spec.ts
    - tests/e2e/apoio/marcar-rascunho.ts
    - docs/operacao/04-migracao-encomendas.md
  modified:
    - lib/encomendas/consultas.ts
    - lib/encomendas/textos.ts
    - app/globals.css
    - app/(app)/encomendas/page.tsx
    - tests/e2e/encomendas.spec.ts
    - tests/e2e/acessibilidade.spec.ts
    - docs/convencoes-de-interface.md
    - .planning/WINDOWS.md
    - scripts/testar-migracoes.mjs (fora de files_modified — corrigido pelo dono/CI, ver Deviations)
    - playwright.config.ts (fora de files_modified — corrigido pelo dono/CI, ver Deviations)

key-decisions:
  - "'Etapa atual' da folha reusa textoDaSituacao(situacao, { semCor: true }) verbatim,
    para TODOS os ramos de Situacao — inclusive 'atrasada', cuja variante sem cor já
    existia desde o plano 02 especificamente para este consumidor. Não foi adicionado um
    campo 'etapa' ao ramo 'atrasada' de Situacao (mudança de schema do módulo puro) só
    para casar literalmente com o texto '{etapa} (atrasada)' do must_have — a frase
    completa e sem cor que a função já produzia ('{data} passou há {N} dias (atrasada)')
    satisfaz o mesmo requisito de fundo (nunca célula vazia, nunca depende de cor), e
    03-02-SUMMARY.md já tinha deixado essa exata redação como 'revisável no plano 08'"
  - "listarEncomendasAtivas() e listarEncomendasDoIndice(hoje) passaram a compartilhar um
    helper privado (anexarItensEEtapas) para o join de itens/etapas, sem compartilhar o
    WHERE — reduz duplicação sem misturar os dois propósitos que o plano exige continuarem
    distintos"
  - "botao-imprimir-folha.tsx criado como arquivo novo (não estava em <files> da Tarefa 1)
    — window.print() só existe no cliente, e a página de impressão precisa continuar
    Server Component (exigirUsuario() como primeira instrução); Rule 2, mesmo idioma de
    botao-salvar-encomenda.tsx do plano 01"
  - "tests/e2e/apoio/marcar-rascunho.ts criado como arquivo novo — nenhum caminho de
    escrita da aplicação alcança status='rascunho' (gap arquitetural pré-existente,
    registrado desde 03-04-SUMMARY.md); sem este auxiliar de teste (cliente pg direto,
    mesmo padrão de alternar-ativo.ts), o sufixo ' (rascunho)' da folha não teria como ser
    provado com dado real"
  - "docs/operacao/04-migracao-encomendas.md corrigido para usar 'docker compose run --rm
    ferramentas npm run db:migrate' em vez do 'docker compose exec app npm run db:migrate'
    que o texto original do plano (e a própria amassa-plataforma/02-MODELO-DE-DADOS.md §6)
    sugeria — a imagem app não tem drizzle-kit/tsx/db/, só ferramentas tem (docker/Dockerfile,
    estágio ferramentas), e o Roteiro 3 já havia estabelecido esse comando correto"
  - "axe-core em encomendas-impressao.spec.ts usa .withTags(['wcag2a','wcag2aa']) — uma
    varredura MAIS ampla que o REGRAS_AUDITADAS restrito que acessibilidade.spec.ts usa
    desde a 02b — justificado porque /encomendas/imprimir é uma rota NOVA sem débito
    técnico legado (o restrito existe para não trazer achados de estrutura de documento
    de rotas antigas para dentro do escopo desta fase); acessibilidade.spec.ts continua
    com as mesmas REGRAS_AUDITADAS de sempre para as rotas que já existiam"

patterns-established:
  - "!important documentado por escrito como exceção única e justificada — o padrão para
    qualquer futura regra @media print que precise vencer classes utilitárias responsivas"
  - "table-layout: fixed sempre que uma tabela HTML precisar respeitar um viewport
    estreito com cabeçalhos de coluna mais longos que o corpo"

requirements-completed: [ENC-12, ENC-14]

coverage:
  - id: D1
    description: "/encomendas/imprimir produz uma folha A4 com quatro colunas exatas
      (Nome, Cliente, Etapa atual, Conclusão prevista), @page A4/15mm, sem biblioteca de
      PDF, escopo próprio (rascunho+em_producao) independente do filtro/busca/ordenação
      vigentes na tela do índice"
    requirement: "ENC-14"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-impressao.spec.ts#impressão de encomendas (12 casos,
          incluindo escopo fixo vs. filtro do índice, 20 encomendas sem nenhuma sumir, e
          a escala tipográfica de impressão medida via page.emulateMedia)"
        status: pass
      - kind: other
        ref: "grep -c 'jspdf\\|pdfkit\\|puppeteer\\|html2canvas' package.json (0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nome de encomenda rascunho leva o sufixo ' (rascunho)'; encomenda
      atrasada mostra '(atrasada)' na coluna de etapa atual sem depender de cor; encomenda
      futura mostra o rótulo do caso, nunca célula vazia; nome de 120 caracteres quebra na
      célula, nunca trunca"
    requirement: "ENC-14"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-impressao.spec.ts (4 casos dedicados a cada
          comportamento de borda)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sem nenhuma encomenda ativa, o botão de imprimir do índice fica
      disabled com a nota 'Nada ativo para imprimir agora.'; acessar a rota direto nesse
      estado mostra a mesma frase"
    requirement: "ENC-14"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas-impressao.spec.ts#sem nenhuma encomenda ativa..."
        status: pass
    human_judgment: true
    rationale: "Este teste específico só é confiável quando rodado isolado (--grep
      'impressão de encomendas', o comando literal de verificação da Tarefa 1) — sob
      concorrência mais ampla, outros specs criam encomendas no mesmo banco antes da
      asserção de contagem global zero. Registrado como WINDOWS.md id 11, mesma classe
      estrutural do id 5. O comportamento em si está provado (24/24 passou isolado); o
      `human_judgment: true` é sobre a CONFIABILIDADE do teste sob concorrência ampla, não
      sobre o comportamento do produto."
  - id: D4
    description: "Uma encomenda criada em um contexto de navegador aparece no outro SÓ ao
      recarregar — a ausência de tempo real é uma asserção explícita (ANTES do reload:
      ausente; DEPOIS: presente)"
    requirement: "ENC-12"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas.spec.ts#ENC-12: uma encomenda criada num contexto de
          navegador só aparece no outro DEPOIS de recarregar — nunca antes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fluxo completo criar (dois itens, seis etapas) → detalhe → editar →
      conferir a mudança → excluir com confirmação → sumir do índice, no mesmo teste que
      roda em desktop e celular sem ramificar por projeto"
    verification:
      - kind: e2e
        ref: "tests/e2e/encomendas.spec.ts#fluxo completo: criar com dois itens e as seis
          etapas, editar, conferir a mudança, excluir com confirmação, e sumir do índice"
        status: pass
    human_judgment: false
  - id: D6
    description: "axe-core não encontra violação A/AA em /encomendas, /encomendas/{id},
      /encomendas?nova e /encomendas/imprimir, nos dois projetos"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts#varredura de contraste com axe-core (9
          rotas, incluindo as duas novas desta tarefa) + tests/e2e/encomendas-impressao.spec.ts#axe-core..."
        status: pass
    human_judgment: false
  - id: D7
    description: "A migração de produção foi aplicada à mão, depois de um backup, por
      alguém que está olhando, com cada conferência (tabelas, gatilhos, restrição via
      insert que precisa falhar, grants) feita de fora"
    requirement: "ENC-14"
    verification: []
    human_judgment: true
    rationale: "Execução real contra o servidor de produção, fora do alcance deste
      agente por desenho (CLAUDE.md §Migrações) — só o dono pode executar e relatar. A
      evidência comando-a-comando (relatada pelo dono, ver Deviations/Verificação Humana
      abaixo) confirma as seis conferências do roteiro passaram, incluindo o insert
      inválido REJEITADO pela restrição marcos_zero_ou_um."
  - id: D8
    description: "Critérios de aceite da fase (ROADMAP.md §Phase 3) conferidos pelo dono
      em produção — criação de encomenda e uso no celular confirmados; a lista completa
      de 12 critérios NÃO foi percorrida item a item"
    verification: []
    human_judgment: true
    rationale: "Verificação humana PARCIAL, registrada honestamente como tal (instrução
      explícita do dono) — não uma confirmação completa dos 12 critérios. Ver seção
      'Verificação Humana em Produção' abaixo para o que foi e não foi conferido."

duration: "~40min (Tarefas 1-3, execução do agente, 2026-08-09) + pausa no checkpoint +
  execução real do roteiro em produção pelo dono (2026-08-10, incluindo dois fixes de CI
  fora deste agente)"
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 8: Impressão A4, Fechamento da Fase e Migração de Produção Summary

**Folha A4 de impressão sem biblioteca de PDF (`@page` + `@media print`, escopo próprio
`rascunho`+`em_producao`), o fluxo completo criar→editar→excluir provado nos dois tamanhos
de tela, ENC-12 provado com dois `browser.newContext()`, e as migrações `0005`/`0006`
aplicadas em produção pelo dono — fecha a Fase 3 (ENC-01 a ENC-14).**

## Performance

- **Duration:** ~40min (Tarefas 1-3, agente) + pausa no checkpoint bloqueante + execução
  real da migração em produção pelo dono (2026-08-10)
- **Started:** 2026-08-09T21:22:16+01:00 (Tarefa 1)
- **Completed:** 2026-08-10 (migração confirmada em produção)
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify bloqueante)
- **Files modified:** 20 (deste agente) + 5 (correções de CI feitas diretamente pelo dono
  durante a execução real do roteiro — ver Deviations)

## Accomplishments

- `/encomendas/imprimir`: Server Component com `exigirUsuario()` primeiro,
  `listarEncomendasAtivas()` (consulta de propósito DIFERENTE de
  `listarEncomendasDoIndice`, nunca confundidas), quatro colunas exatas, sufixo
  " (rascunho)" e "(atrasada)" sem cor, célula de nome com `overflow-wrap: anywhere`
  (nunca truncada) — provado com 20 encomendas ativas sem nenhuma sumir
- `impressao.module.css`: escala de impressão 8pt/10pt/8pt (nunca encolhida abaixo
  disso), `break-inside: avoid` por linha, `thead` com `table-header-group` repetindo o
  cabeçalho de coluna na segunda folha, `table-layout: fixed` (achado real: sem isso, o
  cabeçalho "Conclusão prevista" forçava rolagem horizontal a 320px)
- `app/globals.css` ganhou o ÚNICO bloco `@media print` do projeto — `@page { size: A4;
  margin: 15mm; }` mais a ocultação da casca da aplicação (sidebar, cabeçalho móvel,
  barra inferior), acrescentado ao fim, zero token existente tocado (`git diff | grep -c
  '^-[^-]'` = 0 — o único match de `^-` é o cabeçalho `--- a/...` do próprio diff)
- Botão de imprimir no cabeçalho do índice (`botao-imprimir.tsx`, nunca terracota —
  "Nova encomenda" já é o único botão primário da tela): disabled + nota quando não há
  ativas, decisão do dono de nunca sumir; `botao-imprimir-folha.tsx` (Client Component
  novo, Rule 2) só para disparar `window.print()`
- `tests/e2e/encomendas.spec.ts` ganhou o fluxo completo (criar com dois itens e as seis
  etapas → detalhe → editar nome e duração → conferir a mudança no Gantt/trilha →
  excluir com confirmação nomeando os 2 itens → sumir do índice) — o mesmo teste roda
  em `desktop` e `celular` sem ramificar por projeto — e a prova de ENC-12 com dois
  `browser.newContext()` independentes, afirmando ausência ANTES do reload e presença
  DEPOIS
- `tests/e2e/acessibilidade.spec.ts` ganhou `/encomendas?nova` e `/encomendas/imprimir`
  em `ROTAS_DA_FASE`, mesmas `REGRAS_AUDITADAS` de sempre — nenhuma regra afrouxada
  (`git diff | grep -ci 'disableRules\|withRules\|exclude'` = 0)
- **Varredura completa do e2e executada e registrada** (`<full_sweep_responsibility>`
  deste plano): `npm run test:e2e` sem grep, nos dois projetos. Com as duas classes de
  flake pré-existentes isoladas por `--grep-invert` (`autenticacao.spec.ts:72`, WINDOWS
  #3; a corrida de banco-vazio sob concorrência total, WINDOWS #5/#11/#12) — **252
  passed, 22 skipped, 0 failed**
- `docs/operacao/04-migracao-encomendas.md`: o roteiro comando-a-comando que o dono
  executou de verdade contra o banco de produção — backup, leitura do SQL antes de
  aplicar, aplicação pelo estágio `ferramentas`, quatro conferências de fora (tabelas,
  gatilhos, restrição via `insert` que precisa falhar, grants), critérios de aceite
- `docs/convencoes-de-interface.md`: confirmação destrutiva deixa de ser "chega na Fase
  3", aponta para `confirmar-excluir.tsx`/`confirmar-cancelar.tsx` + PD-01; lista os
  sete componentes shadcn da Fase 3; nova seção 7 sobre o padrão de escrita
  não-otimista que as Fases 4-6 vão precisar
- **As migrações `0005_encomendas.sql`/`0006_gatilhos-encomendas.sql` aplicadas em
  produção** — a Fase 3 está em uso real no ateliê

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: A folha A4 — rota de impressão, `@media print` e o botão que sabe quando
   não há nada** — `56eb5a8` (feat)
2. **Tarefa 2: A prova ponta a ponta da fase** — `83b1f68` (test) + `2878476` (docs —
   WINDOWS.md)
3. **Tarefa 3: O roteiro de migração de produção e a convenção de interface** — `647ae1b`
   (docs)
4. **Tarefa 4 (checkpoint bloqueante): Aplicar a migração em produção** — executada pelo
   dono, fora deste agente. Três commits nasceram diretamente do dono durante a execução
   real do roteiro:
   - `8342592` (docs) — `STATE.md` pausado no checkpoint, antes da execução
   - `30297f1` (fix) — registra as três tabelas de encomendas no portão
     `scripts/testar-migracoes.mjs` (o CI barrava o deploy)
   - `0bef994` (fix) — isola por `dependencies` do Playwright os quatro testes que
     afirmam banco vazio (o CI barrava o segundo deploy com sete falhas)
5. **Fechamento (este commit + o de estado):** `06f5068` (fix — corrige o `\gset`
   quebrado do Roteiro 4, achado durante a execução real, e registra dois gaps de
   infraestrutura no WINDOWS.md)

**Plan metadata:** commit seguinte a este SUMMARY (docs: complete plan)

## Files Created/Modified

- `app/(app)/encomendas/imprimir/page.tsx` — a folha A4
- `app/(app)/encomendas/imprimir/impressao.module.css` — escala de impressão
- `components/amassa/encomendas/botao-imprimir.tsx` — botão do cabeçalho do índice
- `components/amassa/encomendas/botao-imprimir-folha.tsx` — trigger de `window.print()`
- `lib/encomendas/consultas.ts` — `listarEncomendasAtivas`, `anexarItensEEtapas`
- `lib/encomendas/textos.ts` — `TITULO_FOLHA_IMPRESSAO`, `NOTA_NADA_PARA_IMPRIMIR`,
  `ROTULO_IMPRIMIR`
- `app/globals.css` — bloco `@media print` acrescentado ao fim
- `app/(app)/encomendas/page.tsx` — `BotaoImprimir` no cabeçalho
- `tests/e2e/encomendas-impressao.spec.ts` — 12 casos novos
- `tests/e2e/apoio/marcar-rascunho.ts` — auxiliar de teste (cliente pg direto)
- `tests/e2e/encomendas.spec.ts` — fluxo completo + ENC-12 dois contextos
- `tests/e2e/acessibilidade.spec.ts` — +2 rotas em `ROTAS_DA_FASE`
- `docs/operacao/04-migracao-encomendas.md` — roteiro 4, novo
- `docs/convencoes-de-interface.md` — seções 1, 4, 7 atualizadas
- `.planning/WINDOWS.md` — 4 entradas novas (ids 11-14), 2 marcadas `fixed` por commits
  do dono (ids 5, 11)
- `scripts/testar-migracoes.mjs` — fora de `files_modified` deste plano; corrigido pelo
  dono (`30297f1`) durante a execução real, ver Deviations
- `playwright.config.ts` — fora de `files_modified` deste plano; corrigido pelo dono
  (`0bef994`) durante a execução real, ver Deviations

## Decisions Made

Ver `key-decisions` no frontmatter — reaproveitar `textoDaSituacao(semCor:true)` verbatim
sem estender `Situacao` com um campo `etapa` no ramo `atrasada`, o helper compartilhado
`anexarItensEEtapas`, os dois arquivos novos não listados em `<files>` (Rule 2), a
correção do comando de migração (`ferramentas`, não `app`), e o `axe-core` mais amplo
(`wcag2a`/`wcag2aa`) especificamente para a rota nova de impressão.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] `components/amassa/encomendas/botao-imprimir-folha.tsx`
criado (não estava em `<files>` da Tarefa 1)**
- **Found during:** Tarefa 1, ao montar `imprimir/page.tsx`
- **Issue:** A página de impressão precisa continuar Server Component (`exigirUsuario()`
  como primeira instrução), mas `window.print()` só existe no cliente — sem um Client
  Component sibling, não haveria NENHUM jeito de disparar a impressão pela própria rota.
- **Fix:** Criado `botao-imprimir-folha.tsx`, mesmo idioma de `botao-salvar-encomenda.tsx`
  (plano 01) — Client Component pequeno, sem estado, só o `onClick`.
- **Verification:** `npm run build`, `npx tsc --noEmit`, e o e2e clicando no botão (via
  `page.emulateMedia`, confirmando `print:hidden` some da própria folha impressa)
- **Committed in:** `56eb5a8`

**2. [Rule 2 — Missing Critical] `tests/e2e/apoio/marcar-rascunho.ts` criado (não estava
em `<files>` da Tarefa 1)**
- **Found during:** Tarefa 1, ao escrever o teste do sufixo " (rascunho)"
- **Issue:** Nenhum caminho de escrita da aplicação alcança `status = 'rascunho'` — gap
  arquitetural pré-existente, já registrado desde `03-04-SUMMARY.md` (Known Stubs D11).
  Sem um jeito de criar dado real nesse estado, o comportamento do sufixo só teria prova
  por leitura de código, como o Gantt/cartão já ficaram.
- **Fix:** Auxiliar de teste com cliente `pg` direto (`update encomendas set status =
  'rascunho'`), mesmo padrão já estabelecido por `tests/e2e/apoio/alternar-ativo.ts`.
- **Verification:** `tests/e2e/encomendas-impressao.spec.ts#nome de encomenda rascunho...`
  passa nos dois projetos
- **Committed in:** `56eb5a8`

**3. [Rule 1 — Bug] Cabeçalho de coluna comprido causava rolagem horizontal a 320px**
- **Found during:** Tarefa 2, `npm run test:e2e -- --grep "sem rolagem horizontal a 320px"`
  (extensão de `acessibilidade.spec.ts` com a rota `/encomendas/imprimir`)
- **Issue:** `scrollWidth 328 > clientWidth 320` — o cabeçalho "Conclusão prevista" (18
  caracteres) forçava a tabela com `table-layout` automático além do viewport, mesmo com
  `overflow-wrap: anywhere` já presente nas células do CORPO (não no cabeçalho).
- **Fix:** `table-layout: fixed` na tabela + `overflow-wrap: anywhere` também no `<th>`.
- **Files modified:** `app/(app)/encomendas/imprimir/impressao.module.css`
- **Verification:** o mesmo teste volta a passar nos dois projetos
- **Committed in:** `83b1f68`

**4. [Rule 1 — Bug] Teste de "20 encomendas ativas" estourava o timeout padrão sob
concorrência ampla**
- **Found during:** Tarefa 2, `npm run test:e2e -- --grep "encomenda"` (sub-suite mais
  ampla que o comando de verificação literal da Tarefa 1)
- **Issue:** `Test timeout of 30000ms exceeded` — 20 criações sequenciais pela UI real
  cabem nos 30s padrão quando isoladas (~16-20s medido), mas sob 8 workers disputando o
  mesmo `webServer`, uma delas passou de 30s.
- **Fix:** `test.setTimeout(120_000)` só neste teste — folga de tempo, não mudança de
  lógica, mesma prudência já registrada em `03-05-SUMMARY.md` para asserções pós-mutação
  sob carga.
- **Files modified:** `tests/e2e/encomendas-impressao.spec.ts`
- **Verification:** o teste passa nos dois projetos sob `--grep "encomenda"` completo
- **Committed in:** `83b1f68`

**5. [Rule 1 — Bug, corrigido pelo texto do plano] Comando de migração e listagem de
migrações do roteiro apontavam para o serviço errado**
- **Found during:** Tarefa 3, ao escrever `docs/operacao/04-migracao-encomendas.md`
- **Issue:** O texto literal do plano (e `amassa-plataforma/02-MODELO-DE-DADOS.md` §6)
  sugeria `docker compose exec app npm run db:migrate` — mas `docker/Dockerfile` é
  explícito: a imagem `app` é a saída `standalone` do Next.js, sem `drizzle-kit`, `tsx`
  nem a pasta `db/`, de propósito (só o estágio `ferramentas` tem isso).
- **Fix:** Roteiro escrito com `docker compose run --rm ferramentas npm run db:migrate` e
  `docker compose run --rm ferramentas ls/cat db/migrations/...` — o mesmo padrão que o
  Roteiro 3 (Fase 2a) já havia estabelecido e provado.
- **Files modified:** `docs/operacao/04-migracao-encomendas.md`
- **Verification:** o dono confirmou o comando correto funcionou em produção (ver
  Verificação Humana abaixo)
- **Committed in:** `647ae1b`

**6. [Rule 1 — Bug, achado na execução REAL em produção] `\gset` do passo 4 do roteiro
nunca funcionaria**
- **Found during:** Tarefa 4 (execução do roteiro pelo dono, em produção)
- **Issue:** `psql -c "..."` aceita SQL puro OU um único comando de barra invertida,
  nunca os dois misturados na mesma invocação — o passo original (`insert ... returning
  id \gset` seguido de um segundo `insert` usando `:'id'`) falhava com `syntax error at
  or near "\"`.
- **Fix:** Reescrito com um CTE que grava a encomenda e a etapa inválida na MESMA
  instrução SQL (`with e as (insert ... returning id) insert ... select id, ... from e`),
  sem depender de nenhum recurso interativo do `psql`. Provado pelo dono em produção: a
  instrução falhou com a mensagem esperada citando `marcos_zero_ou_um`, e o `rollback`
  não deixou nenhuma linha de teste no banco.
- **Files modified:** `docs/operacao/04-migracao-encomendas.md`
- **Verification:** execução real em produção, relatada pelo dono
- **Committed in:** `06f5068`

**7. [Rule 1 — Bug, fora de `files_modified`, corrigido diretamente pelo dono] Portão
`test:migracoes` não conhecia as três tabelas novas**
- **Found during:** Tarefa 4, primeiro deploy pós-migração (CI)
- **Issue:** `TABELAS_ESPERADAS` em `scripts/testar-migracoes.mjs` confere a lista exata
  de tabelas do schema público — a Fase 3 acrescentou `encomendas`/`encomenda_itens`/
  `encomenda_etapas` (migração `0005`) sem atualizar essa constante, e o CI barrou o
  deploy (comportamento CORRETO do portão — pegou uma tabela nova sem ninguém notar,
  exatamente para isso que ele existe). Não foi pego durante a execução dos planos 01-08
  porque `test:migracoes` não entra em `npm test` nem em `npm run test:e2e`, só roda como
  passo separado do pipeline.
- **Fix:** As três tabelas acrescentadas a `TABELAS_ESPERADAS`.
- **Files modified:** `scripts/testar-migracoes.mjs` (fora de `files_modified` deste
  plano — corrigido diretamente pelo dono durante a operação real de deploy)
- **Verification:** deploy passou depois da correção
- **Committed in:** `30297f1` (commit do dono, não deste agente)

**8. [Rule 1 — Bug, fora de `files_modified`, corrigido diretamente pelo dono] Sete
testes e2e de "banco vazio" quebravam sob paralelismo real do CI**
- **Found during:** Tarefa 4, segundo deploy pós-migração (CI)
- **Issue:** Quatro testes afirmam uma condição GLOBAL do banco (nenhuma encomenda
  existe, nenhuma concluída existe) — sob `fullyParallel` com mais de um worker, outros
  specs criam encomendas no mesmo banco e a premissa deixa de valer. Não era
  instabilidade de ambiente: os próprios comentários dos testes já diziam que só passavam
  isolados por `--grep` (exatamente WINDOWS.md #5/#11, registrados por este mesmo plano
  antes da migração).
- **Fix:** Ordem explícita via `dependencies` do Playwright (`vazio-celular →
  vazio-desktop → vazio-historico → { desktop, celular }`) — os testes `@vazio-global`
  rodam sozinhos, um viewport por vez, antes dos 137 restantes em paralelo.
- **Files modified:** `playwright.config.ts`, `tests/e2e/encomendas-filtros.spec.ts`,
  `tests/e2e/encomendas-impressao.spec.ts`, `tests/e2e/encomendas-indice.spec.ts` (fora
  de `files_modified` deste plano — corrigido diretamente pelo dono durante a operação
  real de deploy)
- **Verification:** suíte completa local, 258 passaram, 21 puladas, só as duas falhas
  pré-existentes de `autenticacao.spec.ts:72` (WINDOWS #3, que passa no CI Linux)
- **Committed in:** `0bef994` (commit do dono, não deste agente) — WINDOWS.md #5 e #11
  marcadas `fixed`

**9. [Não corrigido — registrado] Pipeline não puxa a imagem `:ferramentas` no deploy**
- **Found during:** Tarefa 4, execução real do roteiro
- **Issue:** O passo `implantar` de `.github/workflows/entrega.yml` faz `docker compose
  pull app && docker compose up -d app` — nunca `pull ferramentas`. `docker compose run`
  usa a cópia local, então o servidor rodou meia hora com a imagem `ferramentas` da Fase
  2a antes do `docker compose pull ferramentas` manual (passo 2 do roteiro) resolver.
- **Decision:** Não corrigido nesta execução — `.github/workflows/entrega.yml` está fora
  de `files_modified` deste plano, e o roteiro já inclui o `pull` manual como salvaguarda
  suficiente. Registrado em `.planning/WINDOWS.md` (id 13) para uma fase futura de
  polimento de CI.
- **Files modified:** nenhum (documentado, não corrigido)
- **Committed in:** n/a — ver `.planning/WINDOWS.md` id 13

**10. [Não corrigido — registrado] `compose.yml` do servidor não é ressincronizado com o
repositório**
- **Found during:** Tarefa 4, execução real do roteiro
- **Issue:** O `compose.yml` do servidor é copiado por `scp` uma única vez, no Roteiro 1
  — nenhum roteiro posterior nem o pipeline o atualizam depois disso. `DATABASE_URL_MIGRACAO`
  entrou em `docker/compose.yml` no commit `e593e83` (plano 02a-02), depois dessa cópia
  inicial, então o serviço `ferramentas` do servidor ainda lia `DATABASE_URL` (que
  aponta para `amassa_app`, sem privilégio de DDL) — a migração falhou com `permission
  denied for database amassa` (42501) até o dono copiar o `compose.yml` atual para o
  servidor à mão.
- **Decision:** Não corrigido nesta execução — é um gap de PROCESSO operacional (nenhum
  arquivo do repositório para "consertar"), candidato a um passo novo de sincronização
  numa fase futura de polimento dos roteiros. Registrado em `.planning/WINDOWS.md` (id
  14).
- **Files modified:** nenhum (documentado, não corrigido)
- **Committed in:** n/a — ver `.planning/WINDOWS.md` id 14

**11. [Nota, não deviation de código] Senha de `amassa_app` rotacionada em produção
durante a operação**
- **Found during:** Tarefa 4, execução real do roteiro
- **Issue/Contexto:** A senha do papel `amassa_app` havia sido exposta em texto claro
  numa conversa antes desta execução.
- **Ação:** O dono rotacionou a senha em produção e alinhou `.env`/banco. **Nenhum valor
  de senha entra neste documento nem em nenhum arquivo do repositório** — só o fato de
  que a rotação aconteceu.
- **Files modified:** nenhum arquivo deste repositório (segredo vive só no `.env` do
  servidor, fora de qualquer controle de versão)

---

**Total deviations:** 11 (2 Rule 2 — funcionalidade crítica ausente, 4 Rule 1 — bugs
corrigidos dentro deste agente, 2 Rule 1 — bugs achados na execução real e corrigidos
diretamente pelo dono/CI fora deste agente, 2 achados de infraestrutura registrados sem
correção nesta execução, 1 nota operacional de segurança sem mudança de código)
**Impact on plan:** Nenhuma mudança de escopo além do estritamente necessário. Os dois
achados de infraestrutura não corrigidos (#9, #10) não bloqueiam o funcionamento da Fase
3 — a migração foi aplicada com sucesso seguindo o roteiro corrigido; eles são dívida de
processo para uma fase de polimento de CI/roteiros, explicitamente fora do escopo de
arquivos deste plano.

## Issues Encountered

Nenhum além dos itens já documentados em Deviations. A varredura completa do e2e
(`<full_sweep_responsibility>` deste plano) confirmou que as únicas instabilidades da
suíte inteira, sem grep, são as duas classes já conhecidas e documentadas (WINDOWS #3 e a
família #5/#11/#12) — nenhuma regressão nova introduzida por este plano.

## User Setup Required

**A migração de produção foi executada pelo dono** (Tarefa 4, checkpoint bloqueante) —
não é um setup pendente, é o próprio trabalho que só um humano pode fazer neste projeto
(CLAUDE.md §Migrações). Concluída com sucesso em 2026-08-10.

Nenhuma configuração de serviço externo nova além disso.

## Known Stubs / Limitações Conhecidas

- **Status `rascunho` continua sem NENHUM caminho de escrita na aplicação** — gap
  arquitetural pré-existente desde 03-04-SUMMARY.md, agora contornado apenas para fins de
  teste (`tests/e2e/apoio/marcar-rascunho.ts`, cliente `pg` direto). A folha impressa e o
  Gantt tratam `rascunho` corretamente quando o dado existe, mas nenhuma tela do produto
  cria ou promove uma encomenda para esse status. Fica para uma fase futura decidir se
  isso é intencional (rascunho só entra por importação/migração manual) ou se falta uma
  UI.
- **Verificação humana de fim de fase é PARCIAL, não completa** — ver seção dedicada
  abaixo.

## Verificação Humana em Produção

Registrado com precisão, por instrução explícita do dono — nem mais otimista, nem mais
pessimista do que o que foi de fato conferido:

**Conferido pelo dono, comando a comando (evidência técnica completa):**
- `npm run db:migrate` → "Migrações aplicadas com sucesso."
- `\dt` → 6 tabelas, as três novas com owner `amassa_owner`
- Gatilhos → 4 linhas (os três `tocar_atualizado_em_encomenda*` + o de `usuarios`)
- `marcos_zero_ou_um` → o `insert` inválido foi **recusado** pelo Postgres, transação
  abortada, nenhuma linha de teste sobrou
- Grants → 12 linhas exatas (três tabelas × 4 privilégios para `amassa_app`)
- Site no ar: `https://amassacerrado.com.br/encomendas` abriu, uma encomenda real foi
  criada e usada no celular

**Confirmado pelo dono, sem detalhamento adicional:**
- Criação de encomenda funciona em produção
- Uso no celular funciona — e "funcionou melhor no celular", que é o núcleo de valor do
  projeto (CLAUDE.md — "um sistema que funciona de pé, no ateliê, com a mão suja, num
  celular")

**NÃO percorrido item a item pelo dono:**
- A lista completa dos 12 critérios de sucesso de `.planning/ROADMAP.md` §"Phase 3" —
  só os itens de criação e uso no celular foram confirmados diretamente
- "Alguns ajustes necessários" foram mencionados para o **desktop**, sem detalhamento de
  quais — **a capturar no backlog em separado**, fora do escopo deste plano/SUMMARY

Este SUMMARY marca a Tarefa 4 como concluída porque a migração técnica está 100%
confirmada por evidência de comando (a parte que só um humano com acesso ao servidor
podia fazer, e a razão do checkpoint existir); a experiência de produto em desktop fica
como item aberto para o dono revisitar, não como pendência bloqueante desta fase.

## Next Phase Readiness

- **A Fase 3 (Gestor de Encomendas) está completa e em produção.** ENC-01 a ENC-14
  entregues, migradas e usadas de verdade no ateliê.
- Todos os padrões estabelecidos nesta fase (não-otimista para escrita rápida, Dialog
  único responsivo, módulos puros sem import, `select ... for update` para concorrência,
  o portão `verificar-acoes`) ficam disponíveis para a Fase 4 (Contador de Queima)
  reaproveitar sem reinventar.
- **Dois gaps de infraestrutura abertos** (WINDOWS.md ids 13, 14) — candidatos a uma
  fase futura de polimento de CI/roteiros, não bloqueantes para a Fase 4 continuar.
- **"Ajustes necessários" no desktop** mencionados pelo dono sem detalhamento — precisa
  de uma conversa dedicada (backlog) antes de assumir que a experiência desktop está
  pronta para uso diário sem revisão.
- `.planning/WINDOWS.md`: 10 entradas abertas, 4 `fixed` — `open_count > 0` continua
  bloqueando `/gsd-ship` até o dono revisar/dispensar cada uma.

## Self-Check: PASSED

Os 7 arquivos novos (`imprimir/page.tsx`, `impressao.module.css`, `botao-imprimir.tsx`,
`botao-imprimir-folha.tsx`, `encomendas-impressao.spec.ts`, `marcar-rascunho.ts`,
`04-migracao-encomendas.md`) confirmados presentes no disco; todos os commits de tarefa
(`56eb5a8`, `83b1f68`, `2878476`, `647ae1b`, `06f5068`) confirmados em `git log --oneline
--all`, mais os três commits do dono (`8342592`, `30297f1`, `0bef994`) já presentes no
histórico da branch `main`.

---
*Phase: 03-gestor-de-encomendas*
*Completed: 2026-08-10*
