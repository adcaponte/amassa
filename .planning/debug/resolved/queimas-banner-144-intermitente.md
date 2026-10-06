---
status: resolved
trigger: "queimas-banner.spec.ts:144 (@vazio-historico, 10 queimas seguidas, limite 180 s) estoura esperando `tipo-queima-biscoito` em ~metade das invocações de e2e da 06.5 (planos 13 e 17), barrando desktop/celular. Passou nos planos 01–12 e isolado (`--grep \"banner de fornos\"`, 80 passed, 06/10)."
created: 2026-10-06T09:00:00Z
updated: 2026-10-06T11:40:00Z
---

## Current Focus

hypothesis: CONFIRMADA (mecanismo) — os dois toques de `registrarQueima` usavam `click({ force: true })`, que pula as checagens "estável" e "recebe eventos" do Playwright; qualquer obstrução ou deslocamento entre o cálculo do ponto e o `mousedown` engole o toque em silêncio, e o passo seguinte espera um elemento que nunca vem (tipo → 180 s; folha → 10 s).
test: concluído — invocação 5 (reverter/reaplicar determinístico) + duas passagens da cadeia com a correção + `npm run verificar`.
expecting: —
next_action: nenhuma nesta sessão. A confirmação estatística é a varredura completa do 06.5-30 (o defeito era ~1 em 3 invocações; duas passagens não bastam sozinhas).
bug_class: Mandelbug de corrida no TESTE (toque forçado × obstrução transitória). SBFL não se aplica (não há espectro de cobertura por teste no e2e); usado o roteiro de corrida: medir a janela, depois injetar a obstrução dentro dela.

reasoning_checkpoint:
  hypothesis: "`registrarQueima` (tests/e2e/queimas-banner.spec.ts) tocava 'Queimar' e o tipo com `force: true`; o Playwright despachava o mouse no ponto calculado antes, sem conferir o alvo; quando algo cobria ou deslocava o botão naquele instante (pilha de avisos do sonner no canto inferior direito; o botão descendo 54 px quando o forno entra em atenção e a árvore RSC nova chega depois da folha abrir; overlay do 'Novo forno' em fade-out), o toque caía em outro elemento e não fazia nada."
  confirming_evidence:
    - "Invocação 2: toque forçado em (1008,682) com `elementFromPoint` = aviso 'Forno cadastrado.' → seletor nunca abriu → 'waiting for … tipo-queima-biscoito' (a assinatura relatada)."
    - "Invocação 5: obstrução injetada no `mousemove` do próprio toque — deslocamento de 54 px: forçado 3/3 PERDIDO, normal 3/3 ABRIU (72–85 ms, o Playwright repetiu); overlay de 150 ms: forçado 3/3 PERDIDO, normal 3/3 ABRIU (236–256 ms)."
    - "Logs das rodadas que falharam: plano 17 tentativa 1 parou no registro #2 do crítico (banner do retry #2: crítico da tentativa 1 em 1/10) — o primeiro registro depois do deslocamento de 54 px medido na invocação 1 (556→610); retry #1 parou em 4/10, o toque #5, quando a pilha de 4 avisos chega a y≈601 sobre (1008,610)."
    - "Código: `server-action-reducer.js` resolve o resultado da ação ANTES do `navigate(RefreshAll)` da revalidação — a folha abre antes de o banner crescer; o crescimento chega uma ida-e-volta RSC depois."
  falsification_test: "Se, sem `force`, a cadeia voltar a falhar no :144 com o seletor ou a folha sem abrir, a causa não é o toque engolido. E se o forçado não perdesse o toque com a obstrução injetada dentro da janela (invocação 5), o mecanismo cairia — perdeu 6/6."
  fix_rationale: "Sem `force`, o Playwright espera o botão estável, confere o alvo no ponto ANTES de despachar (sem mover o mouse, logo sem pausar os avisos por hover) e intercepta/repete o toque se o alvo mudou entre o cálculo e o `mousedown`. Isso fecha a janela para TODAS as obstruções transitórias, não para uma em particular, e é o mesmo que `queimas-cartao.spec.ts` já faz desde f301e95."
  blind_spots: "A obstrução exata das duas tentativas 1 (planos 13 e 17) não foi capturada — nenhum trace sobreviveu, e amostrando 300+ toques forçados (invocações 3 e 4) a janela natural não abriu. Para o plano 17 resta uma alternativa não descartada por prova direta: o POST do registro #2 preso na fila do roteador atrás de fetches de revalidação >10 s (medido p95≈1,2 s, máx 1,4 s sob CPU 4× e ruído — implausível). Duas passagens da cadeia não provam ausência de um defeito de ~1 em 3; o 06.5-30 confirma."
  candidate_causes:
    - "código de teste: `force: true` nos dois toques (CONFIRMADO como mecanismo)"
    - "ambiente: mais carga no projeto `vazio-historico` desde 06.5-11/12 (`polimento-banco`, `polimento-caixa` entraram na cadeia) alonga a ida-e-volta RSC que traz o deslocamento — inferido pela coincidência de início, não medido"
    - "dados/estado: os retries do describe serial acumulam fornos no banco (estado global) — o crítico novo cai na coluna direita sob os avisos e o limiar novo sai dos 3 nomes do banner (CONFIRMADO pelos logs)"
    - "produto: remontagem do RegistrarQueima no push de ?novo, dadosDaFolha=null, hidratação — ELIMINADOS"
  and_gate: "sim — a falha FINAL exigiu (1) um toque engolido na tentativa 1 E (2) retries incapazes de recuperar. A correção remove (1) em todas as tentativas; (2) continua estrutural e fica como recomendação (ver Resolution)."

## Symptoms

expected: o caso "um segundo forno em crítico aparece ANTES do primeiro…" registra 10 queimas pelo "Queimar" e passa em toda invocação de e2e.
actual: em ~metade das invocações da 06.5 (planos 13 rodadas 2 e 5, plano 17 tarefa 2) o caso falha estourando 180 s esperando `tipo-queima-biscoito`, depois do "Queimar" com `force: true`. Como mora em `vazio-historico`, barra `desktop` e `celular` ("did not run").
errors: "Test timeout of 180000ms exceeded … waiting for getByTestId('tipo-queima-biscoito')" (06.5-13-SUMMARY.md: "o clique em `tipo-queima-biscoito` estourou 180 s depois de “Queimar” com `force: true`").
reproduction: `npm run test:e2e -- --grep "<qualquer coisa>"` — a cadeia `vazio-*` roda inteira em toda invocação, independente do `--grep`.
started: plano 06.5-13 (05–06/10/2026). Planos 01–12 passaram; 14, 15, 16 passaram; 13 (2 de 3) e 17 (1 de 1 com cadeia) falharam.

## Eliminated

- hypothesis: (1, como formulada no pedido) o 06.5-12 moveu `cadastros-contas-fixas` para a cadeia `@vazio-historico`.
  evidence: `git grep -c @vazio-historico main` × branch: `cadastros-contas-fixas.spec.ts` não tem a etiqueta em nenhum dos dois; o que entrou na cadeia na 06.5 foram `polimento-banco.spec.ts` (1 caso) e `polimento-caixa.spec.ts` (describe serial de 2). Nenhum deles toca fornos/queimas (grep) — no máximo somam CARGA ao projeto, o que entra como fator ambiental inferido, não como causa.
  timestamp: 2026-10-06T09:05:00Z

- hypothesis: (3) o teste toca "Queimar" antes da hidratação (streaming/esqueleto).
  evidence: por leitura — o formulário "Novo forno" é um `Dialog` do Radix num Portal, que não existe no HTML do servidor; `cadastrarForno` só consegue preencher "Nome" depois da hidratação, e daí em diante a página só troca por navegação de cliente (`router.push`). O primeiro "Queimar" de cada caso acontece numa página já hidratada. Medido depois: todo toque que acertou o botão abriu o seletor — `seletor=1` logo depois de cada um dos toques da invocação 1, e nenhuma perda em toque sem obstrução nas sondas das invocações 2 a 5.
  timestamp: 2026-10-06T09:15:00Z

- hypothesis: o `router.push` de `?novo` → `/gestao/queimas` remonta a página e zera o estado do `RegistrarQueima` (seletor aberto / folha) no meio do toque.
  evidence: `node_modules/next/dist/client/components/layout-router.js:549` — a chave de estado do segmento é `createRouterCacheKey(segment, true) // no search params`, então trocar só a query NÃO remonta; o `<Activity>` do bfcache só entra com `__NEXT_CACHE_COMPONENTS` (desligado: next.config sem `cacheComponents`).
  timestamp: 2026-10-06T10:10:00Z

- hypothesis: os dados da folha falham sob carga (`dadosDaFolha === null`, UI-D19) e a folha não abre por projeto.
  evidence: a página registra "Falha ao carregar os dados da folha de contagem no índice" quando isso acontece; zero ocorrências no log do servidor da rodada do plano 17 que falhou assim.
  timestamp: 2026-10-06T10:10:00Z

## Evidence

- timestamp: 2026-10-06T09:00:00Z
  checked: base de conhecimento (.planning/debug/knowledge-base.md não existe; sessões em resolved/)
  found: sem casamento direto. Parentes: `refresh-nao-chega-no-celular` (router.refresh com perda), `e2e-toque-nao-navega-ci` (transição do React que não confirma), `queimas-medidor-detalhe-320` (streaming do loading.tsx).
  implication: hipóteses candidatas, não diagnóstico.

- timestamp: 2026-10-06T09:05:00Z
  checked: `git grep -c @vazio-historico main` vs branch
  found: a 06.5 acrescentou à cadeia `vazio-historico` `polimento-banco.spec.ts` (1 caso, plano 11/12) e `polimento-caixa.spec.ts` (describe serial de 2 casos, plano 12). `cadastros-contas-fixas.spec.ts` NÃO tem a etiqueta (só ganhou `abrirContasDepoisDaJanela`).
  implication: a hipótese 1 do pedido ("o 12 moveu cadastros-contas-fixas para a cadeia") não é literal; o que entrou na cadeia foram os dois specs `polimento-*`. Mais carga paralela no mesmo projeto, a medir.

- timestamp: 2026-10-06T09:10:00Z
  checked: tests/e2e/queimas-banner.spec.ts `registrarQueima`, components/amassa/queimas/registrar-queima.tsx, folha-contagem.tsx, formulario-forno.tsx, components/ui/dialog.tsx, app/gestao/(app)/layout.tsx
  found: |
    - O helper toca "Queimar" e o tipo com `force: true` (comentário: "toasts empilhados podem cobrir o botão"). `force` NÃO faz o toque atravessar o que está por cima: o Playwright só pula as checagens de acionabilidade e despacha o mouse no centro do elemento — quem recebe é o elemento mais alto naquele ponto.
    - A folha "O que queimou?" fecha DESMONTANDO (o pai põe `folha=null`; o `<Dialog open>` some inteiro, sem animação de saída).
    - O diálogo "Novo forno" (`FormularioForno`) fecha por `searchParams` (o `?novo` some no commit do `router.push`) e TEM animação de saída (overlay `fixed inset-0 z-50`, `duration-100`, pointer-events:auto do Radix) — e `cadastrarForno` só espera a URL, não o diálogo sumir.
    - Toaster: `bottom-right` no desktop; cada registro gera um aviso de 7 s com "Desfazer".
  implication: dois candidatos concretos a "o que está por cima do Queimar": o overlay do "Novo forno" fechando (1º toque de cada caso) e a pilha de avisos (toques seguintes). A medição decide.

- timestamp: 2026-10-06T09:35:00Z
  checked: invocação 1 — `npm run test:e2e -- --grep "banner de fornos" --trace retain-on-failure`, com sonda temporária em `registrarQueima` (elementFromPoint no centro do "Queimar" antes do toque; contagem do seletor logo depois)
  found: "80 passed (1.5m)", EXIT=0 — NÃO reproduziu. Os 11 toques (1 do caso :127, 10 do :144) acertaram o botão (`acerta=true`), sem overlay, `body.style.pointerEvents` vazio, e o seletor existia logo depois de todos (`seletor=1`). Disposição: forno do caso :127 sozinho (x=760,y=486); forno crítico na COLUNA ESQUERDA (x=512, y=556→610 quando o banner aparece); avisos empilhados em x≥900, y≈600–700. As 10 queimas levaram ~6,5 s no total.
  implication: na disposição real da cadeia (só os fornos deste spec; `listarFornosDoIndice` ordena por nome e "[e2e] Forno crítico" < "[e2e] Forno limiar") o aviso NÃO cobre o "Queimar" — a interceptação por aviso não explica a 1ª tentativa. O caso não depende de nenhum forno de outro spec (nenhum outro spec da cadeia cria forno — grep). A falha precisa de outra coisa, e amostrar ~50% a 53 s por invocação é caro: próxima medição é de estresse.

- timestamp: 2026-10-06T09:50:00Z
  checked: invocação 2 — `npm run test:e2e -- --project vazio-historico --no-deps --trace retain-on-failure` com a sonda de estresse (6 laços extras na mesma grade)
  found: |
    "1 failed, 1 flaky, 1 did not run, 27 passed (2.1m)". Os 66 toques da sonda (que esperam o ponto ficar livre antes de tocar) não perderam nenhum; nenhuma navegação dura, nenhum fetch RSC falho. As falhas foram do spec real, contaminado pela grade cheia da sonda (o banner só mostra 3 nomes) — e UMA delas reproduziu a assinatura relatada: no retry #2 do :157 (o :123 de antes da sonda), o toque forçado em "Queimar" caiu em (1008,682) com `acerta=false`, `topo = div [toast=sim] "Forno cadastrado."` → o seletor nunca abriu → "locator.click: Test timeout … waiting for … getByTestId('tipo-queima-biscoito')".
  implication: mecanismo PROVADO por observação direta: com `force: true`, o aviso do sonner por cima do botão engole o toque e o passo seguinte espera `tipo-queima-biscoito` até o limite do teste. Acontece quando o cartão cai na coluna DIREITA, na faixa de baixo da janela (avisos em x≥900).

- timestamp: 2026-10-06T10:05:00Z
  checked: logs completos das rodadas que falharam, guardados no scratchpad da sessão do orquestrador — plano 17 (`scratchpad/e2e2.log`, `--grep "polimento corrigir|financeiro-caixa"`) e plano 13 (transcrição do executor `tasks/a03bcc217b95dc88a.output`, rodada `--grep "polimento textos — mês|financeiro-mes"`)
  found: |
    Plano 17: tentativa 1 do :144 falhou em 13,6 s com "expect(getByTestId('folha-contagem')).toBeVisible() … 10000ms … element(s) not found" (a folha não abriu depois do toque no tipo); retry #1 do :144 → 3,0 min, "waiting for … tipo-queima-biscoito" (forno crítico `…1791263591543`); retry #2 do :123 → banner "5 fornos precisam de atenção: [crítico 2] (4/10) · [crítico 1] (1/10) · [limiar 1] (1/10) · e mais 2" sem o limiar novo (só os 3 primeiros aparecem). Final: "1 failed (:144), 1 flaky (:123)".
    Plano 13 (rodada 2): tentativa 1 do :144 JÁ falhou com 3,0 min "waiting for … tipo-queima-biscoito"; retry #1 do :144 igual; retry #2 do :123 falhou (11,9 s). Final "1 failed, 1 flaky, 75 passed (7.2m)".
    Nenhuma linha "Falha ao carregar os dados da folha" no log do servidor da rodada do plano 17.
  implication: |
    (1) O que se relatou ("estoura 180 s esperando tipo-queima-biscoito") é sobretudo o sintoma do RETRY. Os retries deste describe serial NUNCA podem passar: cada um acrescenta fornos ao banco (estado global), o crítico novo cai na coluna direita sob os avisos (toque engolido → 180 s) e o limiar novo sai dos 3 nomes do banner (retry #2 do :123). Uma falha na tentativa 1 vira falha certa.
    (2) A tentativa 1 falha de duas formas — toque em "Queimar" sem efeito (plano 13) e toque no tipo sem folha em 10 s (plano 17) — com o forno crítico na coluna ESQUERDA, onde o aviso não chega. As duas são "o toque forçado não fez o que devia"; candidatos: deslocamento de layout entre o cálculo do ponto e o despacho (o banner cresce 54 px quando o crítico entra em atenção — medido 556→610 na invocação 1 — e o commit da árvore nova chega numa transição que pode cair no meio do toque), overlay do "Novo forno" em fade-out, ou ação lenta (>10 s) na fila do roteador. A próxima medição separa esses três.
    (3) Degradação `dadosDaFolha === null` eliminada para o plano 17 (nenhum log do servidor).
    (4) No plano 17 o banner do retry #2 mostra o crítico da tentativa 1 (`…1791263576037-o3bces`) em **1/10**: a tentativa 1 morreu no REGISTRO #2 desse forno — o primeiro depois de ele entrar em atenção, que é quando o banner cresce 54 px. O crítico do retry #1 (`…1791263591543`) parou em **4/10**: o toque #5, exatamente quando a pilha de avisos chega a y≈601 e cobre (1008,610) na coluna direita (medido na invocação 1: avisos em 900,644 / 908,626 / 917,614 / 926,601 no toque #5).

- timestamp: 2026-10-06T10:40:00Z
  checked: invocação 3 — `npm run test:e2e -- --grep @sonda --no-deps --project desktop --workers 5`, sonda A/B (geometria de 2 cartões, CPU 4×, 4 testes de ruído; nomes CURTOS "[e2e] Forno … sonda N …")
  found: "5 passed (4.1m)". [RESUMO] forçado: 50 toques, 0 perdas, seletor p50=158 ms p95=206; folha p50=878 ms p95=1109 max=1212. normal: 50 toques, 0 perdas, seletor p50=191 p95=271; folha p50=869 p95=1206 max=1399.
  implication: a ação "Queimar" leva ~1 s mesmo com CPU 4× e ruído — uma folha que não abre em 10 s não é lentidão plausível da ação; é toque que não registrou. Nenhuma perda no forçado aqui, mas a sonda NÃO reproduzia o deslocamento: com nomes curtos o banner de 2 fornos provavelmente não quebra linha (o real quebra: 556→610) e sem atraso de rede o commit da árvore nova chega antes do próximo toque. Inconclusiva para o deslocamento; a invocação 4 corrige as duas coisas.

- timestamp: 2026-10-06T10:45:00Z
  checked: `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:217-330` (Next 16.3.5)
  found: depois da resposta da ação, o redutor chama `resolve(actionResult)` PRIMEIRO; havendo revalidação (`revalidatePath("/gestao/queimas")` em `registrarQueima`) a árvore nova vem de um `navigate(...)` com `FreshnessPolicy.RefreshAll` (um fetch RSC próprio, quando a resposta não trouxe a árvore), além do `router.refresh()` que o próprio `RegistrarQueima` chama.
  implication: o `await registrarQueima(...)` do componente volta, o aviso sai e a folha abre ANTES de o banner crescer; o commit que desloca o cartão em 54 px chega uma ida-e-volta RSC depois (página pesada do índice), e sob carga cai no meio dos toques do registro seguinte. Com `force: true` o ponto do toque é calculado antes desse commit e despachado depois.

- timestamp: 2026-10-06T10:50:00Z
  checked: `node_modules/next/dist/client/components/app-router-instance.js:108-160` (fila de ações do roteador)
  found: ação que não é navegação (server action, refresh) entra no FIM da fila e espera a pendente; o redutor da server action só termina quando o `navigate(RefreshAll)` da revalidação termina.
  implication: o POST do registro N espera o fetch de revalidação + o `router.refresh()` do registro N-1. Uma folha que demora >10 s exigiria esses fetches lentíssimos — a invocação 3 mediu a latência ponta a ponta (fila incluída) em p95≈1,2 s, máx 1,4 s, com CPU 4× e ruído. Implausível; não descartada por prova direta para a rodada do plano 17.

- timestamp: 2026-10-06T11:05:00Z
  checked: invocação 4 — `npm run test:e2e -- --grep @sonda` (cadeia `vazio-*` inteira com o helper CORRIGIDO + A/B controlado no desktop: nomes reais, RSC atrasado 150–1200 ms, CPU 4×)
  found: |
    Cadeia: `ok 66 … queimas-banner.spec.ts:136 … (4.4s)`, `ok 70 … :157 … (7.2s)`, `ok 78 … :198 … (2.5s)`; "1 skipped, 79 passed (4.6m)", EXIT=0 — primeira passagem da cadeia com a correção.
    A/B: [RESUMO] forçado: toques=150 perdas=0; normal: toques=144 perdas=0. Os shifts gravados perto dos toques foram do rodapé "Gestora de Teste" e da lista "Sem contagem" (ambos fora do caminho) e, 3 vezes, da grade (`div "AtivosDesativadosTodos…" y208→228`, +20 px) a −49, +9 e −41 ms do início do toque.
  implication: nenhuma perda no forçado nem com RSC atrasado: o único deslocamento da grade que coincidiu com toque foi de 20 px (o banner ganhando uma linha), menor que a meia altura do botão (22 px), e chegou antes do cálculo do ponto. A janela do `force` é estreita; amostrar não basta. Próxima medição injeta a obstrução DENTRO da janela (no `mousemove` do próprio toque) para provar o mecanismo dos dois lados.

- timestamp: 2026-10-06T11:20:00Z
  checked: invocação 5 — `npm run test:e2e -- --grep @sonda` (cadeia `vazio-*` inteira com a correção + reverter/reaplicar determinístico no desktop: a obstrução nasce num `mousemove` de disparo único, ou seja, ENTRE o cálculo do ponto e o `mousedown` do próprio toque)
  found: |
    Cadeia: `ok 66 … :136`, `ok 70 … :157`, `ok 78 … :198`; "1 skipped, 79 passed (1.6m)", EXIT=0 — segunda passagem seguida da cadeia com a correção.
    [DETERMINISTICO]
    S (cartão desce 54 px): forçado #1/#2/#3 PERDIDO (11/15/14 ms); normal #1/#2/#3 ABRIU (72/73/85 ms).
    O (overlay fixed inset-0 por 150 ms): forçado #1/#2/#3 PERDIDO (15/11/14 ms); normal #1/#2/#3 ABRIU (256/236/254 ms).
    T (pilha natural de avisos sobre o cartão da coluna direita): nos 8 toques de cada variante o ponto (1008,590) NÃO ficou coberto (`aviso-por-cima=false`) — sem o banner de 2 linhas o botão fica 20 px acima do topo da pilha; inconclusivo aqui, provado na invocação 2.
  implication: mecanismo provado dos dois lados. O toque forçado é perdido em 100% das vezes em que a obstrução cai na janela; o toque normal sobrevive em 100% (o Playwright repete — 72–85 ms — ou espera o overlay sumir — ~250 ms). A correção fecha a janela para qualquer obstrução transitória, inclusive as que não foram capturadas nas tentativas 1 reais.

- timestamp: 2026-10-06T11:35:00Z
  checked: `npm run verificar` com a correção e a sonda temporária já apagada
  found: EXIT=0 — eslint limpo (`--max-warnings=0`), `tsc --noEmit` limpo, verificar-acoes "125 ação(ões) conferida(s), 0 violações", vitest "142 passed (142) / 3219 passed (3219)", `test:migracoes` "Todas as afirmações passaram".
  implication: nenhuma regressão nos portões rápidos.

## Resolution

root_cause: |
  TESTE — `registrarQueima` em `tests/e2e/queimas-banner.spec.ts` tocava "Queimar" e "Biscoito" com
  `click({ force: true })`. O comentário dizia que era "porque toasts empilhados podem cobrir o botão" — mas
  `force` não atravessa o que está por cima: só desliga as checagens "estável" e "recebe eventos" e despacha o
  mouse num ponto calculado ANTES. Quem recebe o toque é o que estiver lá no `mousedown`. Três coisas passam por
  cima do botão ou o deslocam nesse teste:
    (a) a pilha de avisos do sonner (canto inferior direito, x≥900) quando o cartão está na coluna direita —
        observado direto (invocação 2: alvo do toque = aviso "Forno cadastrado.");
    (b) o botão descendo 54 px quando o forno entra em atenção (banner e cartão crescem; medido 556→610) — a
        árvore nova vem de um fetch RSC próprio DEPOIS de a ação responder e a folha abrir
        (`server-action-reducer.js`: `resolve(actionResult)` antes do `navigate(RefreshAll)`), então sob carga
        pode cair no meio dos toques do registro seguinte;
    (c) o overlay do "Novo forno" (`fixed inset-0`, fade-out de 100 ms).
  O toque engolido não deixa rastro: ou o seletor nunca abre (180 s esperando `tipo-queima-biscoito`) ou a folha
  nunca abre (10 s em `pularContagem`).

  AMPLIFICADOR (AND-gate) — o describe serial com `retries: 2` não consegue se recuperar: cada tentativa deixa
  fornos no banco (estado global), o crítico do retry cai na coluna DIREITA, sob a pilha de avisos (toque #5
  engolido sempre — os dois retries #1 dos logs morreram assim, 180 s), e o limiar do retry #2 sai dos 3 nomes
  do banner. Uma perda na tentativa 1 virava falha certa, e o erro relatado ("180 s esperando
  tipo-queima-biscoito") era o do RETRY: na rodada do plano 17 a tentativa 1 tinha falhado em 13,6 s com a folha
  não abrindo no registro #2.

  POR QUE COMEÇOU NO 06.5-13 (inferido, não medido): os planos 11/12 puseram `polimento-banco` e
  `polimento-caixa` na cadeia `vazio-historico`, que roda em TODA invocação — mais carga simultânea ao :144
  alonga a ida-e-volta RSC de (b). O defeito do teste é anterior (o `force` vem da Fase 4); a carga só o expôs.

fix: |
  `tests/e2e/queimas-banner.spec.ts`, `registrarQueima`: os dois toques sem `force: true` (toque de verdade, com
  a checagem de alvo do Playwright), e o comentário reescrito com o porquê. Nenhuma asserção mudou, nenhum
  timeout mudou, nenhum arquivo de produto mudou. O mesmo que `queimas-cartao.spec.ts` fez em f301e95.
  Fora do escopo, RECOMENDADO: dar isolamento ao describe (apagar no começo os fornos "[e2e] Forno …
  vazio-historico …" de tentativas anteriores) ou tirar o `retries: 2` dele — hoje um retry deste grupo não
  tem como passar e só esconde o primeiro erro atrás de 6 minutos de 180 s.

verification:
  target_test: { result: pass, detalhe: "cadeia `vazio-*` com a correção, 2 de 2 invocações: :136/:157/:198 ok (invocação 4: 79 passed 4.6m; invocação 5: 79 passed 1.6m)" }
  mutation_check: { result: pass, detalhe: "Stryker não existe no projeto; substituto equivalente — a 'mutação' é recolocar `force: true` (o código anterior). Com a obstrução dentro da janela, o forçado perdeu 6/6 e o corrigido abriu 6/6 (invocação 5)." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detalhe: "o diff só remove `{ force: true }` de dois cliques — a remoção É a correção: devolve a checagem de alvo que o `force` desligava" }
  adjacent_tests:
    result: pass
    suites_run:
      - "npm run verificar: EXIT=0 (lint, tsc, verificar-acoes 125/0, vitest 142/3219, test:migracoes)"
      - "cadeia vazio-celular → vazio-desktop → vazio-historico inteira, 2×, verde"
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detalhe: "invocação 5, mesmo navegador e mesma página: forçado (revertido) S 3/3 e O 3/3 PERDIDO; sem force (reaplicado) S 3/3 e O 3/3 ABRIU" }
  guardrail_verdict: accepted
  oracle_type: specified
  human_verify: "pendente — a prova estatística é a varredura completa do 06.5-30 (o defeito aparecia em ~1 de 3 invocações; 2 passagens seguidas não bastam sozinhas)"
  comandos_e2e_rodados_nesta_sessao: |
    1. npm run test:e2e -- --grep "banner de fornos" --trace retain-on-failure  (sonda passiva no helper) → 80 passed (1.5m), não reproduziu
    2. npm run test:e2e -- --project vazio-historico --no-deps --trace retain-on-failure  (sonda de estresse, 6 laços) → 1 failed, 1 flaky, 27 passed; reproduziu o toque engolido pelo aviso
    3. npm run test:e2e -- --grep @sonda --no-deps --project desktop --workers 5  (A/B, CPU 4×, ruído) → 5 passed; 0/50 × 0/50 perdas; folha p95≈1,2 s
    4. npm run test:e2e -- --grep @sonda  (cadeia com a correção + A/B com RSC atrasado) → 79 passed; 0/150 × 0/144
    5. npm run test:e2e -- --grep @sonda  (cadeia com a correção + reverter/reaplicar determinístico) → 79 passed; forçado 6/6 perdido, normal 6/6 abriu
    Cinco invocações, uma acima do teto "~4" do pedido: a 5ª foi a que fechou o mecanismo dos dois lados e, de quebra, a segunda passagem da cadeia. Nenhum `@parametro-global` em `--grep`; nenhum `npm run build` avulso. A sonda (`tests/e2e/zz-sonda-queimas.spec.ts`) e a instrumentação do helper foram apagadas antes do commit.

fix_commit: b169b3d

files_changed:
  - tests/e2e/queimas-banner.spec.ts
