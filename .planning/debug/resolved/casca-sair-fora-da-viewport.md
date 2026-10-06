---
status: resolved
trigger: "“Sair” fora da viewport: `tests/e2e/casca.spec.ts:238` (desktop) falhou com “element is outside of the viewport” ao tocar “Sair” (06.5-23), e `sessao.spec.ts` “depois de sair…” (desktop) teve o “Sair” fora da área visível por 30 s (06.5-19). Os dois passaram na repetição."
created: 2026-10-06T13:00:00Z
updated: 2026-10-06T14:30:00Z
---

## Current Focus

hypothesis: CONFIRMADA — a barra lateral do desktop não é presa à janela; o rodapé com o gatilho do menu do usuário fica no FIM DA PÁGINA e desce quando a página cresce. O menu aberto (Radix Popper, `position: fixed`, `autoUpdate`) desce junto, para fora da janela, onde não dá para rolar até ele (fixed + rolagem travada pelo menu modal).
test: concluído — invocações 2 e 3 com a correção (casca e sessao verdes nos dois projetos, 2 de 2; teste novo verde; reverter no navegador devolve o defeito) + regressão nos specs que tocam a lateral + `npm run verificar`.
expecting: —
next_action: nenhuma nesta sessão. Para o dono: a lateral do desktop passa a ficar parada enquanto o conteúdo rola (mudança visível, só de leiaute). Confirmação estatística na varredura completa do 06.5-30.
bug_class: Mandelbug de leiaute no PRODUTO (posição do gatilho depende da altura da página, que muda por streaming depois do toque), exposto pelo teste que toca cedo. SBFL não se aplica; usado o roteiro de corrida: medir a janela (linha do tempo do Início) e forçá-la (crescimento injetado).

reasoning_checkpoint:
  hypothesis: "No desktop, `BarraLateral` estica até a altura da página (`SidebarProvider` com `min-h-svh`, sem `sticky`/`h-svh`, dentro de `flex min-h-screen`), então o gatilho do menu do usuário (rodapé da lateral) fica no fim da página e desce quando ela cresce. Os blocos do Início chegam por `Suspense` até ~500 ms depois da URL e levam a página de 720 para 2046 px; um menu aberto nessa janela acompanha o gatilho para baixo da janela e o “Sair” fica inalcançável (fixed + rolagem travada)."
  confirming_evidence:
    - "Invocação 1, natural: casca:238 abriu o menu com h=720 (Início ainda não chegou) e sessao:111 com 4 esqueletos; no sessao, logo depois do toque, gatilho em 1216 e “Sair” em 1184 numa janela de 720."
    - "Invocação 1, linha do tempo: 720 → 1234 → 2046 px em 495 ms; gatilho de 668 para 1994."
    - "Invocação 1, determinística: com a página crescendo 1200 px depois de abrir, “Sair” vai para 1836 e o toque falha com 'outside of the viewport'; com a lateral presa pelo navegador, nada se move e o toque sai."
  falsification_test: "Se, com a lateral presa, o casca:238/sessao:111 ainda falharem com 'outside of the viewport', ou o “Sair” sair da janela quando a página cresce, a causa não é o gatilho descer com a página."
  fix_rationale: "Prender a lateral à janela (`sticky top-0 h-svh`, como as variantes recolhíveis do próprio shadcn já fazem com `fixed inset-y-0 h-svh`) tira a posição do gatilho da dependência da altura da página: nenhum streaming, esqueleto ou página longa mexe nele. Corrige o teste (o toque cedo deixa de ser corrida) e a tela (o menu do usuário fica sempre no rodapé visível, sem rolar até o fim da página)."
  blind_spots: "Não medi a lateral presa com a janela muito baixa (<~560 px): aí a lista de 8 itens rola dentro de `SidebarContent` (já tem `overflow-auto`), o que é o comportamento certo, mas não está coberto por teste. Mudança visível para o dono: a lateral passa a ficar parada enquanto o conteúdo rola."
  candidate_causes:
    - "código de produto: lateral esticada até a altura da página, gatilho no fim da página (CONFIRMADO)"
    - "código de teste: o casca:238 abre o menu antes de o Início chegar; o sessao:111 espera só a saudação (contribui — é o que coloca o toque dentro da janela de crescimento)"
    - "ambiente: carga decide quanto tempo os blocos levam para chegar (contribui — intermitência)"
    - "06.5-05 (avisos dos Lembretes no topo, `--deslocamento-aviso-topo`) e demais mudanças da 06.5 no leiaute (ELIMINADO — só mexem no Toaster, camada própria; lateral/menu/Início não mudaram)"
  and_gate: "sim — falha exige (1) o gatilho preso à altura da página E (2) a página crescer depois do toque. (2) é o streaming do Início, legítimo; a correção remove (1)."

## Symptoms

expected: no desktop, abrir o menu do usuário no rodapé da lateral e tocar “Sair” leva a /gestao/login.
actual: o clique em “Sair” repete “element is outside of the viewport” até estourar (30 s); passa na repetição.
errors: "locator.click: … element is outside of the viewport" (casca:238, 06.5-23 lote 1; sessao:111, 06.5-19 Tarefa 2)
reproduction: intermitente, só desktop, sob carga (`--grep`/lote com muitos specs).
started: 06.5-19 (05–06/10/2026) primeiro registro; nenhum registro anterior em `06.5-FALHAS-PRE-EXISTENTES.md`.

## Eliminated

## Evidence

- timestamp: 2026-10-06T13:00:00Z
  checked: base de conhecimento (sem knowledge-base.md; sessões em resolved/)
  found: parentes: `queimas-medidor-detalhe-320` (streaming do loading.tsx convivendo com a página), `agenda-receber:75` na tabela de falhas (esqueleto e página juntos). Nenhum casamento sobre o menu do usuário.
  implication: hipótese candidata (leiaute que muda no streaming), não diagnóstico.

- timestamp: 2026-10-06T13:05:00Z
  checked: `git diff main...HEAD` em `components/amassa/menu-usuario.tsx`, `barra-lateral.tsx`, `components/ui/sidebar.tsx`, `components/ui/dropdown-menu.tsx`, `app/gestao/(app)/page.tsx`, `loading.tsx`, `components/amassa/inicio/*`
  found: nenhum desses arquivos mudou na 06.5. Mudaram `app/gestao/(app)/layout.tsx` (só as props `offset.top`/`mobileOffset.top` do `Toaster`, 06.5-05) e `app/globals.css` (`--deslocamento-aviso-topo`).
  implication: a 06.5 não mexeu na lateral, no menu nem no Início. O deslocamento novo dos avisos é só do sonner (camada própria, fora do fluxo da página): não muda a altura da página nem a posição do gatilho.

- timestamp: 2026-10-06T13:10:00Z
  checked: `app/gestao/(app)/layout.tsx`, `components/amassa/barra-lateral.tsx`, `components/ui/sidebar.tsx:128-178, 342-379`
  found: |
    Leiaute: `<div class="flex min-h-screen">` com a lateral e a coluna do conteúdo lado a lado. A lateral é `SidebarProvider` (`flex min-h-svh w-full` + `hidden w-auto md:flex`) com `Sidebar collapsible="none"` (`flex h-full flex-col`) — sem `sticky`, sem `h-svh`: estica (align-items: stretch) até a altura da linha, que é a altura do conteúdo. `SidebarFooter` (menu do usuário) vem depois de `SidebarContent` (`flex-1`), então fica no FIM da lateral, isto é, no fim da página. As variantes recolhíveis do shadcn usam `fixed inset-y-0 h-svh` (linha 232); a `none` não.
  implication: no desktop, numa página mais alta que a janela, o gatilho do menu fica abaixo da dobra, e qualquer crescimento da página depois de abrir o menu o leva mais para baixo.

- timestamp: 2026-10-06T13:40:00Z
  checked: invocação 1 — `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/zz-sonda-fotos-sair.spec.ts --trace retain-on-failure`, com sonda passiva no casca:238 e no sessao:111 (altura do documento, rolagem, posição do gatilho e do “Sair” em coordenadas da janela, esqueletos do Início) logo antes de abrir o menu e logo depois
  found: |
    "4 failed … 112 passed (2.2m)": casca:238 e sessao:111 FALHARAM NO DESKTOP, os dois com "element is outside of the viewport" (reproduziu na primeira tentativa, carga leve).
    casca desktop: antes de abrir `{"h":720,"y":0,"esq":0,"saud":false}` — o Início nem tinha chegado (a URL já era /gestao; o que estava na tela era o `loading.tsx`, altura = `min-h-screen`); menu aberto `{"h":720,"gatilho":"668..712","sair":"636..656"}` — dentro da janela naquele instante.
    sessao desktop: antes de abrir `{"h":1344,"y":0,"esq":4}` (saudação visível, 4 blocos ainda em esqueleto); menu aberto `{"h":1892,"inner":720,"y":624,"gatilho":"1216..1260","sair":"1184..1204","esq":3}` — o Playwright rolou 624 px para alcançar o gatilho, e DURANTE o toque a página cresceu 548 px: o gatilho e o “Sair” já estavam abaixo da janela (1184 > 720).
    celular (os dois specs): o “Sair” do Sheet em 779..823 com janela de 839 — não é afetado.
  implication: o “Sair” sai da janela porque o gatilho desce com a página. No casca, o menu abriu sobre o esqueleto e o Início chegou depois; no sessao, abriu com 4 blocos ainda em esqueleto. O teste do sessao já esperava a saudação — e isso não basta, porque os 5 blocos do Início têm `Suspense` próprio e chegam depois dela.

- timestamp: 2026-10-06T13:42:00Z
  checked: invocação 1, sonda (desktop) — linha do tempo do Início depois de a URL virar /gestao, amostra a cada 100 ms
  found: "+25ms h=720 esq=0 saud=false gatilho=668..712 | +241ms h=1234 esq=5 saud=true gatilho=1182..1226 | +495ms h=2046 esq=0 saud=true gatilho=1994..2038". Assentado: página de 2046 px numa janela de 720; com a rolagem no topo, o gatilho do menu do usuário fica em y=1994.
  implication: em ~500 ms depois da URL a página triplica de altura e o gatilho desce 1326 px. Qualquer toque no menu nessa janela de tempo abre um menu que vai fugir. E, fora do teste: no desktop, com o Início assentado, o “Sair”, o “Trocar senha” e a “Abertura do Espaço” só aparecem rolando até o fim da página.

- timestamp: 2026-10-06T13:45:00Z
  checked: invocação 1, sonda determinística (desktop) — Início assentado, abre o menu, a página cresce 1200 px (um bloco alto anexado ao `main`, no papel dos blocos que chegam por streaming), tenta “Sair” com limite de 5 s; depois o mesmo com a lateral PRESA à janela pelo navegador (`position: sticky; top: 0; height: 100svh; align-self: flex-start` no `[data-slot="sidebar-wrapper"]`), sem mudar código
  found: |
    como-esta: menu aberto `{"y":1326,"gatilho":"668..712","sair":"636..656","overflowBody":"hidden"}` → depois de crescer `{"gatilho":"1868..1912","menu":"1739..1864","sair":"1836..1856"}` → "FALHOU: locator.click: Timeout 5000ms exceeded. / element is outside of the viewport / element is outside of the viewport".
    lateral-presa: antes de abrir `{"h":2046,"y":0,"gatilho":"668..712"}` (o gatilho já está na janela sem rolar) → menu aberto `{"sair":"636..656"}` → depois de crescer `{"h":3246,"gatilho":"668..712","sair":"636..656"}` → "SAIU".
  implication: |
    Mecanismo provado dos dois lados (1 de 1 cada): com a lateral esticada até a altura da página, o menu (Radix Popper, `position: fixed`, `autoUpdate`) acompanha o gatilho para fora da janela; o menu modal trava a rolagem (`overflow: hidden` no body) e elemento `fixed` não rola para a vista — o Playwright repete "outside of the viewport" até o limite, exatamente a assinatura dos dois relatos. Com a lateral presa à janela, o gatilho não depende da altura da página: o crescimento não move nada e o “Sair” funciona.

- timestamp: 2026-10-06T14:00:00Z
  checked: invocação 2 — `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/zz-sonda-fotos-sair.spec.ts --trace retain-on-failure`, com `md:sticky md:top-0 md:h-svh md:self-start` na `BarraLateral`, o teste novo do casca e uma sonda que (1) repete o toque cedo do casca:238 e (2) desfaz a correção no navegador (`position: static; height: auto; align-self: stretch` no wrapper) × deixa aplicada
  found: |
    "126 passed, 2 skipped (2.1m)", EXIT=0. casca inteiro (incluindo :238 e o teste novo :272) e sessao inteiro (incluindo :111) verdes nos dois projetos.
    Toque cedo com a correção: antes `{"h":720,"saud":false,"gatilho":"668..712"}` → aberto `{"h":720,"gatilho":"668..712","sair":"636..656"}` → 1,5 s depois `{"h":2046,"saud":true,"gatilho":"668..712","sair":"636..656"}` → SAIU. A página cresceu 1326 px com o menu aberto, como no casca:238 da invocação 1, e nada se moveu.
    desfeita-no-navegador: `gatilhoNaJanelaNoTopo:false`; com o menu aberto e +1200 px, `{"y":3326,"gatilho":"1868..1912","sair":"1836..1856"}` → "FALHOU: locator.click: Timeout 5000ms exceeded. / element is outside of the viewport".
    aplicada: `gatilhoNaJanelaNoTopo:true`; depois de crescer `{"h":5246,"y":0,"gatilho":"668..712","sair":"636..656"}` → SAIU.
  implication: correção verde, e o reverter/reaplicar no mesmo navegador e mesmo servidor devolve e tira o defeito (1 de 1 cada; com a invocação 1, 2 de 2 no lado do defeito). As asserções do teste novo (`toBeInViewport` do gatilho com a rolagem no topo; do "Sair" depois de crescer) falhariam com a correção desfeita: o gatilho fora da janela no topo e o "Sair" em 1836 numa janela de 720.

- timestamp: 2026-10-06T14:10:00Z
  checked: invocação 3 — `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/abertura-tracador.spec.ts tests/e2e/acessibilidade.spec.ts tests/e2e/estados.spec.ts tests/e2e/lembretes-todos.spec.ts tests/e2e/rotas.spec.ts --trace retain-on-failure` (sem sonda; os specs que localizam `[data-slot="sidebar"]` ou o gatilho do rodapé)
  found: "260 passed (3.2m)", EXIT=0, nenhum ✘ nem flaky — inclusive os itens da lateral com 44 px, o truncamento do nome no rodapé, a ordem dos links com Lembretes, a varredura de contraste do axe-core e o 404 público sem casca (`estados`). A impressão NÃO foi exercitada por e2e nesta sessão: por leitura, `app/globals.css` (`@media print`) esconde `[data-slot="sidebar-wrapper"]` com `display: none !important`, que vence o `md:sticky` como já vencia o `md:flex`.
  implication: segunda passagem seguida do casca e do sessao com a correção; a lateral presa não quebrou nenhum spec que depende dela.

- timestamp: 2026-10-06T14:20:00Z
  checked: `npm run verificar` com as duas correções e a sonda apagada
  found: EXIT=0 — lint, tsc, verificar-acoes 125/0, vitest 145/3252, test:migracoes "Todas as afirmações passaram".
  implication: nenhuma regressão nos portões rápidos.

## Resolution

root_cause: |
  PRODUTO (leiaute), exposto pelo teste — no desktop, a `BarraLateral` (`components/amassa/barra-lateral.tsx`)
  esticava até a altura da PÁGINA: o `SidebarProvider` tem `min-h-svh` e nenhum `sticky`/`h-svh`, dentro de
  `<div class="flex min-h-screen">` (`app/gestao/(app)/layout.tsx`), e a `Sidebar collapsible="none"` é só
  `h-full`. O rodapé com o gatilho do menu do usuário ficava, portanto, no FIM da página — no Início assentado do
  e2e, a 1994 px numa janela de 720 — e descia sempre que a página crescia.

  O menu do desktop é um `DropdownMenu` do Radix: conteúdo `position: fixed`, ancorado no gatilho por `autoUpdate`
  (acompanha o gatilho quando ele se move) e modal (trava a rolagem: `overflow: hidden` no body). Os 5 blocos do
  Início chegam cada um no seu `Suspense` até ~500 ms depois de a URL virar /gestao (720 → 1234 → 2046 px). Um
  menu aberto nessa janela desce com o gatilho para baixo da janela; elemento `fixed` não rola para a vista e a
  rolagem está travada, então o Playwright repete "element is outside of the viewport" até estourar.

  Por que os testes caíam nessa janela: o casca:238 abre o menu logo depois de `toHaveURL(/gestao$/)` — medido com
  o Início ainda nem renderizado (h=720, sem saudação, o `loading.tsx`); o sessao:111 espera a saudação, mas a
  saudação chega antes dos blocos (medido com 4 esqueletos). Sob carga os blocos demoram mais e a janela cresce:
  daí a intermitência.

  AND-gate: a falha exige (1) o gatilho preso à altura da página E (2) a página crescer depois do toque. (2) é o
  streaming legítimo do Início; (1) é o defeito.

  Nada disso é da 06.5: lateral, menu e Início não mudaram na fase (`git diff main...HEAD`); o deslocamento novo
  dos avisos (06.5-05) é do Toaster, camada própria. Os planos de 06.5-04 (abas dos Cadastros) e 06.5-19
  (cabeçalhos) não tocam a casca. O defeito vem da Fase 02b (lateral `collapsible="none"`) e ficou mais exposto à
  medida que o Início cresceu.

  Efeito para o dono, fora do teste: no desktop, em toda página mais alta que a janela, "Sair", "Trocar senha" e
  "Abertura do Espaço" só apareciam rolando até o fim da página; e quem abrisse o menu enquanto a página ainda
  carregava via o menu "fugir" para baixo.

fix: |
  `components/amassa/barra-lateral.tsx`: `md:sticky md:top-0 md:h-svh md:self-start` no `SidebarProvider` — a
  lateral fica presa à janela, com a altura da janela; o rodapé (menu do usuário) fica sempre no pé da tela, e a
  lista de módulos rola dentro de `SidebarContent` (que já tem `overflow-auto`) se a janela for baixa. É o que as
  variantes recolhíveis do próprio shadcn já fazem (`fixed inset-y-0 h-svh`). Comentário no componente explica o
  porquê. Nenhum dado, nenhuma rota, nenhuma ação mudou; a impressão continua escondendo `[data-slot="sidebar-wrapper"]`
  (por leitura do `@media print` de app/globals.css — não exercitada por e2e nesta sessão).

  Teste de regressão novo em `tests/e2e/casca.spec.ts` ("no desktop, o menu do usuário fica na janela numa página
  longa e não foge quando a página cresce com ele aberto (UI-03)"): página 2000 px mais alta (bloco anexado ao
  `main`, determinístico), gatilho `toBeInViewport({ ratio: 1 })` com a rolagem no topo e no fim; menu aberto, a
  página cresce mais 1200 px, o "Sair" continua `toBeInViewport({ ratio: 1 })` e leva a /gestao/login. No celular
  ele volta cedo, como o teste dos 240 px.

  Os testes casca:238 e sessao:111 não mudaram: o toque cedo deixou de ser corrida (medido: com a correção, o menu
  aberto antes de o Início chegar não se move quando a página cresce 1326 px).

  MUDANÇA VISÍVEL PARA O DONO: no desktop, a lateral passa a ficar parada enquanto o conteúdo rola.

verification:
  target_test: { result: pass, detalhe: "casca inteiro (com :238 e o teste novo :272) e sessao inteiro (com :111), desktop e celular, 2 de 2 invocações (2: 126 passed; 3: 260 passed)" }
  mutation_check: { result: pass, detalhe: "Stryker não existe no projeto; substituto equivalente — desfazer a correção no navegador (wrapper `static`, `height: auto`, `align-self: stretch`): gatilho fora da janela no topo e 'Sair' em 1836..1856 → as duas asserções `toBeInViewport` do teste novo falhariam; o toque falhou com 'outside of the viewport' (invocação 2). Com a correção: gatilho e 'Sair' parados, toque saiu." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detalhe: "o diff só acrescenta classes, comentário e um teste" }
  adjacent_tests:
    result: pass
    suites_run:
      - "invocação 3: abertura-tracador, acessibilidade (axe-core e 44 px da lateral), estados (404 público sem casca), lembretes-todos (ordem da lateral), rotas — 260 passed"
      - "npm run verificar: EXIT=0"
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detalhe: "invocação 2: desfeita-no-navegador FALHOU 'outside of the viewport' × aplicada SAIU, mesma página e mesmo servidor; invocação 1 tinha dado o mesmo par com a correção emulada" }
  guardrail_verdict: accepted
  oracle_type: specified
  human_verify: "pendente — o dono confere a lateral presa no desktop (mudança visível); a varredura completa do 06.5-30 confirma sob a suíte cheia"
  comandos_e2e_rodados_nesta_sessao: "os mesmos 3 da sessão orcamentos-fotos-g-contagem (rodados juntos): 1 → 4 failed/112 passed (reproduziu os dois sinais); 2 → 126 passed; 3 → 260 passed."

fix_commit: 8940e2b

files_changed:
  - components/amassa/barra-lateral.tsx
  - tests/e2e/casca.spec.ts
