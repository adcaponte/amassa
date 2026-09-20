---
phase: quick-260920-wcg
plan: 1
subsystem: accessibility
tags: [wcag, axe-core, playwright, tailwind, cadastros, cotacoes, queimas, abertura]

# Dependency graph
requires: []
provides:
  - "lista-contas-fixas.tsx sem opacity-70 condicional na linha — a rota /cadastros?sub=fixas
    volta a passar 4.5:1 com uma conta fixa desativada em cena, desbloqueando o deploy da fase
    04.4-12"
  - "tests/e2e/apoio/semear-conta-fixa.ts (criarContaFixaInativa/apagarContaFixaPeloNome) —
    auxiliar reutilizável para qualquer teste futuro que precise de uma conta fixa já inativa,
    sem passar pela UI"
  - "Padrão 'opacity-NN condicional sobre texto secundário' eliminado em mais oito arquivos
    (lista-categorias.tsx, sub-abas-categorias.tsx, cartao-cotacao.tsx, linha-cotacao.tsx,
    comparacao-cotacoes.tsx, detalhe-cotacao.tsx, cartao-forno.tsx, lista-meses.tsx) — nenhum
    deles pego pela varredura de CI hoje, por falta de rota com o estado em cena"
affects: []

actuals:
  tokens: 42500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "CSS opacity sobre um elemento cria um novo contexto de empilhamento — todo o subtree é
      composto num buffer só depois de ter o alfa aplicado, então nenhum filho consegue
      'desfazer' a diluição com o próprio opacity-100. Onde um estado 'esmaecido' precisa
      preservar contraste de texto, a técnica correta é remover a opacidade do texto (se outra
      pista textual já existir) ou trocar o fundo do container por uma cor SÓLIDA mais escura
      (bg-muted em vez de bg-card), nunca aplicar opacity sobre um ancestral que contém texto no
      limite da AA."
    - "Nenhum valor de opacidade preserva ao mesmo tempo o efeito visual 'nitidamente mais apagado'
      e o contraste AA de --color-tinta-fraca (5.4:1 em opacidade cheia): a 70% cai para 2.99:1, a
      60% cai ainda mais, e só a partir de ~92% o texto volta a passar — visualmente indistinguível
      de 'ativo'. Confirmado por cálculo (blend alfa em sRGB) batendo byte a byte com o valor
      medido pelo axe-core (#978b84)."

key-files:
  created:
    - tests/e2e/apoio/semear-conta-fixa.ts
  modified:
    - components/amassa/cadastros/lista-contas-fixas.tsx
    - components/amassa/cadastros/lista-categorias.tsx
    - components/amassa/cotacoes/sub-abas-categorias.tsx
    - components/amassa/cotacoes/cartao-cotacao.tsx
    - components/amassa/cotacoes/linha-cotacao.tsx
    - components/amassa/cotacoes/comparacao-cotacoes.tsx
    - components/amassa/cotacoes/detalhe-cotacao.tsx
    - components/amassa/queimas/cartao-forno.tsx
    - components/amassa/abertura/lista-meses.tsx
    - tests/e2e/acessibilidade.spec.ts

key-decisions:
  - "Onde já existia outra pista textual de 'estado alterado' (nome riscado + rótulo
    Reativar/Desativar, ou o selo de situação com texto próprio 'descartado'), a opacidade foi
    REMOVIDA sem substituto — a informação não se perde, só o reforço visual redundante que
    estava quebrando o contraste."
  - "Onde a opacidade recaía sobre um container com fundo próprio (cartao-forno.tsx,
    lista-meses.tsx, a coluna de comparacao-cotacoes.tsx) e perder o 'esmaecido' seria uma
    regressão visual maior, a troca foi bg-card (branco) → bg-muted (--color-superficie-2, cor
    SÓLIDA e mais escura) — sem composição alfa, o texto nunca perde contraste (na verdade
    melhora, porque o fundo ficou mais escuro)."
  - "disabled:opacity-NN sobre CONTROLES interativos (caixa-marcacao.tsx, valor-conta-fixa.tsx,
    financeiro/lista-completa.tsx) foi deixado intacto — WCAG 1.4.3 e o próprio axe-core tratam
    controle desabilitado como fora do escopo de contraste de texto (não operável); é outro caso,
    não o mesmo padrão."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "O span de metadado de uma conta fixa desativada mede pelo menos 4.5:1, medido por axe-core, com a linha de verdade em cena"
    verification:
      - kind: e2e
        ref: "tests/e2e/acessibilidade.spec.ts — '/cadastros?sub=fixas não tem violação de color-contrast...' (desktop + celular) — par RED/GREEN, ver seção abaixo"
        status: pass
    human_judgment: false
  - id: D2
    description: "O teste foi visto FALHAR (RED) antes da correção e PASSAR (GREEN) depois, não uma asserção nunca vista falhar"
    verification:
      - kind: e2e
        ref: "par RED/GREEN medido nesta execução — ver seção 'Prova RED/GREEN do e2e' abaixo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Todo outro lugar do repositório com o mesmo padrão foi encontrado por grep e corrigido ou justificado por escrito"
    verification:
      - kind: static
        ref: "grep -rn \"opacity-6[0-9]\\|opacity-70\\|opacity-75\" components/ app/ --include=\"*.tsx\" — só resta disabled:opacity-NN sobre controle interativo (3 arquivos, caso diferente, documentado) e comentários explicando a correção"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verificar passa limpo"
    verification:
      - kind: unit
        ref: "npm run verificar — lint, tsc --noEmit, verificar-acoes (48 ações, 0 violações), 891 testes unitários, test:migracoes — tudo verde"
        status: pass
    human_judgment: false

duration: ~1h40min (execução autônoma, sem checkpoint)
completed: 2026-09-20
status: complete
---

# Quick Task 260920-wcg: Contraste AA de conta fixa desativada (e o mesmo achado em mais oito lugares) — Summary

**A violação real de axe-core que barrou o deploy da fase 04.4 — `opacity-70` diluindo `--color-tinta-fraca` de 5.4:1 para 2.99:1 numa conta fixa desativada — corrigida na causa raiz (a técnica de opacidade sobre texto, não um valor de cor), e o mesmo padrão eliminado em mais oito componentes que nenhuma rota de CI hoje exercita no estado que o quebra.**

## Performance

- **Duration:** ~1h40min de execução autônoma (Tarefas 1-3, sem checkpoint)
- **Completed:** 2026-09-20
- **Tasks:** 3/3
- **Files modified:** 11 (1 criado, 10 modificados)

## Accomplishments

- **Causa raiz identificada com precisão matemática, não por tentativa e erro.** `#978b84` (o
  foreground que o axe mediu) é exatamente `--color-tinta-fraca` (`#6E5F56`) composto a 70% de
  opacidade sobre `--color-fundo` (`#F6F3F0`) — confirmado calculando o blend alfa em sRGB e
  batendo byte a byte com o valor real medido pelo axe. Isso provou que o defeito não é o TOKEN
  (já é o mais escuro disponível para texto secundário, 5.4:1 aprovado AA em opacidade cheia) —
  é a TÉCNICA: `opacity-70` na `<li>` inteira cria um contexto de empilhamento que dilui tudo por
  dentro, e nenhum filho consegue escapar disso com `opacity-100` próprio.
- **Testado analiticamente que nenhum valor de opacidade resolve.** Mesmo diluindo o token mais
  escuro do sistema (`--color-tinta`, 14.6:1 sem diluir) a 60% de opacidade, o contraste cai para
  ~4.15:1 — ainda reprova. A 70% sobe pra ~5.67:1 (passa, por pouco, só para o token MAIS escuro).
  Para o texto secundário (`tinta-fraca`) voltar a passar seria preciso ~92% de opacidade —
  visualmente indistinguível de "ativo", o que anularia o próprio propósito de "esmaecer". Por
  isso a correção nunca foi "trocar o valor de opacity-70 por outro número": era estrutural.
- `lista-contas-fixas.tsx` — `opacity-70` removida da linha; nome riscado + rótulo "Reativar"
  continuam comunicando "desativada" sem depender de composição alfa.
- `tests/e2e/apoio/semear-conta-fixa.ts` (novo) — `criarContaFixaInativa`/`apagarContaFixaPeloNome`
  criam e apagam, direto no banco de teste, uma conta fixa JÁ INATIVA — a prova de acessibilidade
  antes era vacuamente vazia (nenhuma conta fixa inativa em cena para o axe medir); agora semeia,
  varre e limpa dentro do próprio caso, sem depender de outro spec deixar estado pra trás (a causa
  original da falha determinística: um teste do plano 04.4-12 desativava uma conta fixa e nunca
  a reativava, e a corrida entre workers `desktop`/`celular` no CI decidia se a varredura de
  acessibilidade via essa linha antes de rodar).
- **Blast radius: grep por `text-muted-foreground` cruzado com `opacity-NN` condicional** encontrou
  o MESMO padrão em mais oito arquivos, nenhum pego pela varredura de CI hoje porque nenhuma rota
  testada tem, no estado atual do banco, uma linha "desativada/descartada/passada" em cena:
  - `lista-categorias.tsx` (categoria desativada, `opacity-70`) — removida, mesmo motivo de
    `lista-contas-fixas.tsx`.
  - `sub-abas-categorias.tsx` (contagem da pílula inativa, `opacity-70`, incondicional) — removida
    sem substituto.
  - `cartao-cotacao.tsx` / `linha-cotacao.tsx` (cotação descartada, `opacity-60`) — removida de
    empresa/especificação/preço; o SELO (`SeloSituacao`, texto "descartado") já era, por desenho
    original do próprio código, a pista real ("o texto dele já é a pista não visual").
  - `comparacao-cotacoes.tsx` (mesma coisa, coluna de comparação) — texto sem opacidade; a coluna
    troca `bg-card`→`bg-muted` (cor sólida) quando descartada, preservando "menos em destaque" sem
    tocar o texto.
  - `detalhe-cotacao.tsx` (mesma coisa, diálogo de detalhe) — removida sem substituto (uma cotação
    por vez em tela, sem outra "normal" ao lado para comparar).
  - `cartao-forno.tsx` (forno desativado, `opacity-75`) — **achado histórico confirmado**: o
    comentário original ("a base já folga bem acima do mínimo AA neste tema") nunca foi medido —
    `04-04-SUMMARY.md` já registrava isso como pendência de propósito desde a fase 04. A medição
    real dá ~3.29:1 no rodapé. Trocado `opacity-75` por `bg-muted` (cor sólida).
  - `lista-meses.tsx` (Abertura, mês passado, `opacity-60`) — mesma troca por `bg-muted`.
  - **Deixados intactos, por serem outro caso genuíno**: `caixa-marcacao.tsx`,
    `valor-conta-fixa.tsx`, `financeiro/lista-completa.tsx` usam `disabled:opacity-NN` sobre
    controles INTERATIVOS desabilitados — WCAG 1.4.3 trata controle não-operável como fora do
    escopo de contraste; não é "texto secundário estático diluído".

## Task Commits

1. **Tarefa 1: correção do achado reportado + prova RED/GREEN** — `48a8676` (fix)
2. **Tarefa 2a: mesmo achado em Categorias e na contagem de cotações** — `cf4a94d` (fix)
3. **Tarefa 2b: mesmo achado nas cotações (cartão/linha/comparação/detalhe)** — `4e22cf6` (fix)
4. **Tarefa 2c: mesmo achado em Queimas e Abertura (bg-muted em vez de opacity)** — `a492da8` (fix)

**Plano/estado (docs):** commitado separadamente (ver "Final commit" abaixo).

## Files Modified

- `components/amassa/cadastros/lista-contas-fixas.tsx` — `opacity-70` condicional removida da `<li>`
- `components/amassa/cadastros/lista-categorias.tsx` — mesma remoção
- `components/amassa/cotacoes/sub-abas-categorias.tsx` — `opacity-70` removida da contagem
- `components/amassa/cotacoes/cartao-cotacao.tsx` — `opacity-60` removida (empresa/especificação/preço); `descartada`/`cn` agora não usados, removidos
- `components/amassa/cotacoes/linha-cotacao.tsx` — mesma remoção, forma de tabela
- `components/amassa/cotacoes/comparacao-cotacoes.tsx` — texto sem opacidade; coluna troca `bg-card`/`bg-muted`
- `components/amassa/cotacoes/detalhe-cotacao.tsx` — `opacity-60` removida; `descartada` agora não usada, removida
- `components/amassa/queimas/cartao-forno.tsx` — `opacity-75` → `bg-muted`
- `components/amassa/abertura/lista-meses.tsx` — `opacity-60` → `bg-muted`
- `tests/e2e/apoio/semear-conta-fixa.ts` (novo) — `criarContaFixaInativa`/`apagarContaFixaPeloNome`
- `tests/e2e/acessibilidade.spec.ts` — a rota `/cadastros?sub=fixas` semeia+apaga uma conta fixa inativa dentro do próprio caso

## Comandos de verificação rodados

Orçamento do CLAUDE.md (§Conventions): no máximo uma invocação de `npm run test:e2e -- --grep`
por tarefa; o par RED/GREEN e a varredura completa desta prova excedem isso de propósito,
registrados no PLAN.md (`<orcamento_de_e2e>`) e aqui:

- `npx tsc --noEmit` — limpo (0 erros)
- `npm run lint` — limpo (`eslint . --max-warnings=0`)
- `npm run test:e2e -- --grep "cadastros\?sub=fixas não tem violação"` — **2 vezes** (Tarefa 1):
  1. Com `opacity-70` ainda em `lista-contas-fixas.tsx` (RED) — **1 falhou** (celular, 2
     nós de color-contrast — desktop e celular semearam contas próprias em paralelo, ambas
     inativas e visíveis na varredura de celular por corrida entre workers, o que só reforça o
     achado), **29 passaram**.
  2. Com `opacity-70` removida (GREEN) — **30 passaram** (desktop + celular).
- `npm run test:e2e -- --grep "acessibilidade"` — **1 vez** (Tarefa 2, varredura completa do
  arquivo, todas as 17 rotas × 2 viewports + os testes de alvo de toque/teclado/rolagem/nome
  longo) — **78 passaram**, confirmando que as outras oito correções não introduziram nenhuma
  regressão de `button-name`/`link-name`/`aria-allowed-attr` nem quebraram nenhuma rota já
  coberta.
- `npm run verificar` — 1 vez, ao final — `lint` + `tsc --noEmit` + `verificar-acoes` (48 ações,
  0 violações) + `npm test` (891 testes) + `npm run test:migracoes` — tudo verde.

**Total de invocações de `npm run test:e2e -- --grep`: 3** (o par RED/GREEN da Tarefa 1 + a
varredura completa da Tarefa 2) — acima do "no máximo uma por tarefa" do CLAUDE.md de propósito,
pelos dois motivos registrados no PLAN.md.

## Prova RED/GREEN do e2e

O caso `/cadastros?sub=fixas não tem violação de color-contrast...` foi rodado ANTES de qualquer
correção de componente, já com a semeadura de conta fixa inativa em `tests/e2e/acessibilidade.spec.ts`
(escrita primeiro, de propósito, para o teste ter algo de verdade para medir). Com
`opacity-70` ainda presente em `lista-contas-fixas.tsx`, o axe mediu exatamente o mesmo achado do
CI: `contrastRatio: 2.99`, `fgColor: "#978b84"`, `bgColor: "#f6f3f0"`, no `<span
class="text-apoio text-muted-foreground break-words">todo dia 10 · Contabilidade</span>` —
prova de que a semeadura reproduziu o defeito relatado byte a byte, não um achado parecido.
Removida a `opacity-70`, a mesma rota passou nos dois viewports.

| Rodada | Estado de `lista-contas-fixas.tsx` | Resultado |
|---|---|---|
| RED | `opacity-70` condicional presente | 1 failed (celular, 2 nós de color-contrast), 29 passed |
| GREEN | `opacity-70` removida | 30 passed (desktop + celular) |

## Decisions Made

**Duas técnicas de correção, escolhidas por caso** (ver "Accomplishments" e `<key-decisions>`
acima): remover a opacidade sem substituto onde já existe outra pista textual de estado
("Reativar", selo "descartado"); trocar `bg-card` por `bg-muted` (cor sólida) onde o elemento tem
fundo próprio e perder o "esmaecido" seria uma regressão visual maior. Nenhum token de cor novo,
nenhum valor de token alterado — só a técnica de compor o estado "inativo" mudou.

**`disabled:opacity-NN` sobre controle interativo, fora de escopo.** `caixa-marcacao.tsx`,
`valor-conta-fixa.tsx` e `financeiro/lista-completa.tsx` usam opacidade condicionada a `disabled`,
não a um estado de dado "inativo". WCAG 1.4.3 e o próprio axe-core tratam controle não-operável
como fora do escopo de contraste de texto — não é o mesmo achado, então não foi tocado.

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — bug real de acessibilidade)

**1. [Rule 1 - Bug] `opacity-70` diluindo `--color-tinta-fraca` abaixo de 4.5:1 em conta fixa desativada**
- **Found during:** Tarefa 1 (o próprio objetivo da tarefa)
- **Issue:** violação de WCAG 1.4.3 relatada pelo CI, causa raiz identificada acima
- **Fix:** `opacity-70` removida da `<li>`, sem substituto (nome riscado + rótulo já bastam)
- **Files modified:** `components/amassa/cadastros/lista-contas-fixas.tsx`
- **Commit:** `48a8676`

**2. [Rule 1 - Bug, blast radius] Mesmo padrão em mais oito componentes**
- **Found during:** Tarefa 2, por grep deliberado (`text-muted-foreground` × `opacity-NN`
  condicional a estado de dado)
- **Issue:** mesma classe de defeito, nunca pega por CI por falta de rota com o estado em cena
- **Fix:** removida onde havia pista textual alternativa; trocada por `bg-muted` (cor sólida)
  onde o "esmaecido" valia a pena preservar visualmente
- **Files modified:** `lista-categorias.tsx`, `sub-abas-categorias.tsx`, `cartao-cotacao.tsx`,
  `linha-cotacao.tsx`, `comparacao-cotacoes.tsx`, `detalhe-cotacao.tsx`, `cartao-forno.tsx`,
  `lista-meses.tsx`
- **Commits:** `cf4a94d`, `4e22cf6`, `a492da8`

---

**Total deviations:** 0 correções fora de escopo; 2 grupos de correção de bug real (o achado
reportado + o blast radius do mesmo achado), ambos dentro do objetivo desta tarefa.
**Impact on plan:** Nenhum — o PLAN.md já previa o blast radius como parte do escopo, não como
descoberta que o alterou.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova. `tests/e2e/apoio/semear-conta-fixa.ts` só existe em `tests/e2e/apoio/`,
nunca importado por código de produção, usa exclusivamente `DATABASE_URL_TESTE` (nunca
`DATABASE_URL`) — mesma disciplina do resto de `tests/e2e/apoio/` — e apaga (`DELETE`, não só
desativa) a linha que cria, para não inflar a tabela `contas_fixas` do banco de teste a cada
execução da suíte.

## Issues Encountered

Nenhum bloqueante. Ressalva visual menor registrada, não corrigida por estar fora do escopo de
contraste: em `lista-meses.tsx`, a trilha da barra de progresso (`bg-muted`, decorativa,
`role="img"` com `aria-label` textual) agora pode ficar visualmente pouco distinta do próprio
cartão quando o mês é passado (cartão também `bg-muted`) — um efeito de camadas, não uma nova
falha de contraste (a informação em si já é textual via `aria-label`). Deixado para uma eventual
revisão visual de UI, não é um achado de acessibilidade.

## Aguardando o dono

Nenhum `git push` foi dado, e nenhum será dado sem o dono autorizar. Os 4 commits desta tarefa
estão em `main`, local, sobre `7bfc61a` (o último commit da fase 04.4-12). Depois do push, o
workflow de CI deve reprocessar "E2E contra a imagem real" e, se verde, publicar a imagem e
implantar no VPS — a fase 04.4-12 fica desbloqueada.

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

- O bloqueio de deploy da fase 04.4-12 está resolvido no código local; falta só o push e o CI
  reprocessar.
- O padrão "opacity condicional sobre texto secundário" está eliminado do repositório inteiro
  (conferido por grep) — qualquer novo "estado esmaecido" que alguém adicionar no futuro tem os
  dois exemplos corretos (`bg-muted` sólido, ou remoção sem substituto) para copiar.
- Nenhum bloqueio para o próximo trabalho.

---
*Phase: quick-260920-wcg*
*Completed: 2026-09-20*

## Self-Check: PASSED

Os 11 arquivos de código/teste listados + PLAN.md + este SUMMARY.md existem no disco. Os 4
hashes de commit (`48a8676`, `cf4a94d`, `4e22cf6`, `a492da8`) existem em `git log --oneline --all`.
