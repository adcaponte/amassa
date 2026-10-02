---
status: awaiting_human_verify
trigger: "CI run 36956290624 falhou em tests/e2e/agenda-vistas.spec.ts:129 (desktop, 3/3): a 320px, /gestao/agenda?semana=2026-12-28, document.documentElement.scrollWidth <= innerWidth é false. Passou no celular e na varredura local de 02/10."
created: 2026-10-02T00:00:00Z
updated: 2026-10-02T05:00:00Z
---

## Current Focus

bug_class: Bohrbug (3/3 no CI; determinístico dado o ambiente — métrica de fonte do Linux)
hypothesis: CONFIRMADA — o h2 `whitespace-nowrap` da BarraDaAgenda força o nav "‹ título ›" a 286px num contêiner de 272px; no Linux do CI o título é ~14px mais largo e o "›" passa de 320px
reasoning_checkpoint:
  hypothesis: "a rolagem lateral vem do nav da BarraDaAgenda: o h2 `whitespace-nowrap` não deixa o título '28/12/2026 a 03/01/2027' quebrar, o nav (44+8+título+8+44) fica maior que os 272px do contêiner e, com a métrica de fonte do Linux do CI, o '›' termina em ~328px"
  confirming_evidence:
    - "sonda local: nav 286,4px em contêiner 272px, right 310,4 (estoura o contêiner, ainda dentro da tela)"
    - "screencast do CI: '›' cortado; título ≈196px contra 182,4 local; botão ≈284–328px"
    - "error-context do CI: semana vazia — nenhum dado semeado entra na conta"
  falsification_test: "com o h2 livre para quebrar, o nav deve caber nos 272px (right ≤ 296) e, mesmo com o título artificialmente alargado (letter-spacing), scrollWidth ≤ clientWidth; se ainda estourar, a hipótese está errada"
  fix_rationale: "o UI-SPEC (linha 1390) manda o título quebrar em duas linhas, nunca o botão; tirar o nowrap deixa o nav encolher até o min-content (as datas inteiras), independentemente da fonte do ambiente"
  blind_spots: "não há Chromium Linux local para medir a largura exata do CI; outros elementos com conteúdo longo (tags nowrap do cartão) podem estourar e são medidos na sonda 2"
  candidate_causes:
    - "code: h2 whitespace-nowrap num nav flex sem quebra (barra-da-agenda.tsx)"
    - "environment: métrica de fonte do Chromium no Linux do CI (~+14px no título) — por isso não falha no Windows"
    - "data: conteúdo semeado na semana por outros specs — ELIMINADO (semana vazia)"
    - "test: régua scrollWidth <= innerWidth cega no projeto celular (isMobile alarga innerWidth)"
  and_gate: "sim — defeito de código (nav maior que o contêiner) E ambiente com título ≥ 9,6px mais largo que o do Windows; o celular não acusa por causa da régua. A correção ataca o código, que é necessário em todos os ambientes"
test: sonda 2 com a correção — semana 28/12 (linhas do título, nav vs coluna), título alargado artificialmente, semana distante com o pior conteúdo e o mês
expecting: nenhum elemento além da coluna nem da tela nos dois projetos
next_action: aguardar o dono autorizar o push de 9b640e2 e conferir o job e2e do CI (Linux) verde

## Symptoms

expected: a 320px, a semana 28/12/2026 e o mês 2026-12 não criam rolagem lateral (scrollWidth <= innerWidth)
actual: no CI, projeto desktop, scrollWidth > innerWidth na semana (linha 138), 3/3 tentativas; celular passou
errors: expect(received).toBe(expected) — Expected: true, Received: false (agenda-vistas.spec.ts:138)
reproduction: CI run 36956290624, suíte e2e completa
started: merge da Fase 5 em main (627c1d9); não falhou na varredura local de 02/10 ~00:50 UTC

## Eliminated

- hypothesis: outro spec semeia dados na semana 28/12/2026–03/01/2027 e um cartão/cabeçalho de dia estoura a 320px
  evidence: error-context.md do artefato `playwright-falhas` do run 36956290624 mostra os 7 dias da semana com "nada marcado" — semana vazia no momento da falha
  timestamp: 2026-10-02

## Evidence

- timestamp: 2026-10-02
  checked: log do run 36956290624 (gh run view --log-failed)
  found: só falha o [desktop] agenda-vistas.spec.ts:129, 3/3 (814ms/923ms/630ms); [celular] mesmo teste passou; 1155 passed
  implication: falha determinística no CI, só no projeto desktop

- timestamp: 2026-10-02
  checked: artefato playwright-falhas (error-context.md das 3 tentativas)
  found: semana vazia; abas "Agenda · Pessoas · A receber · 43 | No site · Números"; barra com título "28/12/2026 a 03/01/2027"
  implication: o estouro vem do esqueleto da página, não de dado semeado

- timestamp: 2026-10-02
  checked: quadro final do screencast no trace.zip (retry1) — page@…-1790908876016.jpeg
  found: o botão "›" aparece cortado na borda direita; abas e "Lançar na agenda"/"Hoje" quebram e cabem
  implication: quem estoura é a linha `nav` "‹ título ›" da BarraDaAgenda (h2 `whitespace-nowrap` entre dois botões de 44px)

- timestamp: 2026-10-02
  checked: sonda e2e local (Windows, Chromium do Playwright), 320×720, /gestao/agenda?semana=2026-12-28 vazia, nos dois projetos
  found: h2 "28/12/2026 a 03/01/2027" = 182,4px; nav = 286,4px num contêiner de 272px; nav.right = 310,4px; scrollWidth = 320 (passa). Mês 2026-12: h2 140,4px, nav 244,4px (cabe)
  implication: o nav JÁ estoura o contêiner localmente, em 14,4px — só os 24px do px-6 da direita escondem; qualquer +9,6px no título vira rolagem lateral

- timestamp: 2026-10-02
  checked: quadro do screencast do CI medido por pixel (sharp, 200px de imagem = 320px CSS, escala 0,625)
  found: texto do título de ~76px a ~272px CSS (≈196px, contra 182,4 no Windows); chevron do "›" em ~305px CSS → botão ≈284–328px
  implication: no Chromium do Linux do CI o título é ~14px mais largo (métrica/hinting da fonte); nav.right ≈ 328 > 320 → scrollWidth > innerWidth

- timestamp: 2026-10-02
  checked: sonda — div de 400px forçado dentro do main, nos dois projetos
  found: desktop {innerWidth 320, clientWidth 320, scrollWidth 400, régua false}; celular (Pixel 7, isMobile) {innerWidth 400, clientWidth 320, scrollWidth 400, régua TRUE}
  implication: no celular a emulação móvel alarga innerWidth até o conteúdo — a régua `scrollWidth <= innerWidth` é cega nesse projeto; por isso o celular "passou". A régua certa é `clientWidth`

- timestamp: 2026-10-02
  checked: sonda 2/3 com o h2 livre (sem `whitespace-nowrap`), nos dois projetos
  found: semana 28/12: h2 168px em 2 linhas ["28/12/2026 a ", "03/01/2027"], nav 272px, right 296 (= borda da coluna); com +0,7px de letter-spacing no título (simulando o Linux) continua 272/296; mês 2026-12 inalterado (1 linha). Semana distante com o pior conteúdo (títulos 120 com e sem espaço, nomes 160 com e sem espaço, 999 vagas, 50 pessoas, cancelada, dia fechado): nada fora da coluna
  implication: a correção do título vale para qualquer métrica de fonte

- timestamp: 2026-10-02
  checked: sonda 3 — texto da tag "venda nº N cancelada" (TagDePagamento, `whitespace-nowrap`) trocado no DOM do cartão de uso livre encerrado
  found: sub-linha do cartão = 163px; N=1234 → tag 184,8px (right 300,8 > coluna 296); N=99999 → 196,5px (right 312,5); N=2147483647 → 236px, right 352, scrollWidth 352 > 320
  implication: SEGUNDO defeito da mesma classe no cartão da semana: com número de venda de 4+ dígitos a tag sai do cartão; com 10 dígitos a página rola de lado

- timestamp: 2026-10-02
  checked: execução VERMELHA — testes novos com as duas correções de produto revertidas, `npm run test:e2e -- --grep "agenda vistas"`
  found: 4 falhas (2 testes × desktop e celular): 28/12 → "<nav> vai de 24.0 a 310.4px; a coluna, de 24.0 a 296.0px" (+ o "›"); pior conteúdo → "a página rola de lado: scrollWidth 357 > clientWidth 320" + "<span> 'venda nº 2009202602 cancelada' vai de 116.0 a 356.7px"
  implication: a régua nova (clientWidth + borda da coluna) pega os dois defeitos localmente, no Windows, e no projeto celular — o defeito volta quando a correção sai

- timestamp: 2026-10-02
  checked: 05-UI-SPEC.md linha 1390 (backstop E2 overflow)
  found: "conferir que '›' não sai da tela nem cria rolagem lateral; se sair, o título pode quebrar em duas linhas (nunca o botão)"
  implication: a correção prevista pelo próprio contrato é deixar o título quebrar

## Resolution

root_cause: "(1) components/amassa/agenda/barra-da-agenda.tsx: o h2 do título era `whitespace-nowrap` dentro do `nav` flex '‹ título ›'; '28/12/2026 a 03/01/2027' (182px no Chromium do Windows, ~196px no do Linux) + 2×44px + 2×8px passa dos 272px da coluna a 320px — o nav estourava a coluna em 14px no Windows (escondido pelos 24px do px-6) e em ~32px no Linux do CI, empurrando o '›' para 328px → rolagem lateral; (2) a régua do teste (`scrollWidth <= innerWidth`) é cega no projeto celular (isMobile alarga innerWidth), por isso só o desktop acusou; (3) achado na sonda: a tag 'venda nº N cancelada' (`whitespace-nowrap`) no cartão de uso livre encerrado passa dos 163px da sub-linha a partir de N com 4 dígitos e cria rolagem lateral com N de 10 dígitos"
fix: "h2 sem `whitespace-nowrap` (+ `text-center`): o título quebra nos espaços, nunca dentro de dd/mm/aaaa, e o nav encolhe até caber (UI-SPEC linha 1390: 'o título pode quebrar em duas linhas, nunca o botão'); `data-testid='agenda-barra'` na raiz da barra (para a régua da coluna); no cartão, a TagDePagamento com `whitespace-normal`. Teste: régua `estourosA320` (scrollWidth <= clientWidth + nada da barra/semana/mês além da borda da coluna) no caso de 28/12 e num caso novo com o pior conteúdo numa semana distante (+2600/+2614 dias), nos dois projetos; `ligarVendaACobranca` aceita `numero` (overriding system value)"
verification: "vermelho: 4 falhas (2 casos × desktop e celular) com a correção revertida. verde: npm run verificar (lint, tsc, verificar-acoes, 115 arquivos/2287 testes unitários, test:migracoes) e UMA npm run test:e2e -- --grep \"agenda vistas|agenda turma|agenda uso livre|agenda lancamento\" = 121 passed (1.7m). Commit 9b640e2 em main, NÃO publicado. guardrail_verdict: accepted. Falta: o CI no Linux (o ambiente onde falhou) — só o push mostra"
files_changed:
  - components/amassa/agenda/barra-da-agenda.tsx
  - components/amassa/agenda/cartao-evento.tsx
  - tests/e2e/agenda-vistas.spec.ts
  - tests/e2e/apoio/semear-agenda.ts
oracle_type: specified (UI-SPEC E2/E4: nenhuma rolagem lateral a 320px; nada sai da coluna)
