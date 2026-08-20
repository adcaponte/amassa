---
slug: rodape-formulario-desktop
status: resolved
confirmacao_do_dono: pendente — sera conferida na proxima passada em producao, junto dos demais gaps da Fase 3
trigger: "no celular ficou certo, no desktop o rodapé ta no centro da janela, dificultando inserir as informações"
created: 2026-08-20
updated: 2026-08-20
gap: G-03-1
criterio: "Fase 3, critério de sucesso 8"
---

# Debug: rodapé do formulário de encomenda no desktop

## Symptoms

**Comportamento esperado.** No desktop, o rodapé do formulário de encomenda — que mostra duração
total e data de conclusão ao vivo (critério de sucesso 8 da Fase 3) — deve ficar ao pé do diálogo,
visível, sem atrapalhar o preenchimento dos campos. É o que acontece no celular.

**Comportamento observado.** No desktop o rodapé "fica no centro da janela, dificultando inserir as
informações". Relato do dono na caminhada humana em produção de 2026-08-20.

**Mensagens de erro.** Nenhuma. Não é erro de runtime — é defeito de leiaute. Console não foi
inspecionado ainda.

**Linha do tempo.** Encontrado em 2026-08-20, na caminhada humana contra a imagem publicada pelo
run #49 do pipeline. **Nunca funcionou de forma verificada**: o critério 8 nunca tinha sido
percorrido item a item em produção — a verificação anterior (2026-08-10) o deu por atendido a
partir de revisão de código, não de comportamento observado. Ou seja, não há regressão a procurar;
provavelmente sempre foi assim.

**Reprodução.** Abrir `/encomendas` num viewport de desktop (≥ `md`), abrir o formulário de nova
encomenda (a URL vira `?nova`, conforme D-03), e olhar onde o rodapé se posiciona enquanto se
preenche os campos.

## Contexto já levantado (leitura de código, não reprodução)

O contêiner é um **único `Dialog` do Radix** estilizado por CSS para virar folha no celular e modal
no desktop — `components/amassa/encomendas/formulario-encomenda.tsx`, linhas ~203-227. A decisão de
usar um só `Root` está documentada ali mesmo: montar `Dialog` + `Sheet` ao mesmo tempo fez o Radix
marcar ambos `aria-hidden` (lição do plano 03-06).

Classes relevantes do `DialogContent`:

- **Celular (base):** `inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full
  max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none ... p-0`
- **Desktop (`md:`):** `md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto
  md:max-h-[85svh] md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl`

Dentro dele (linhas ~260, ~262, ~306):

- o `<form>` é `flex min-h-0 flex-1 flex-col`
- a área de campos é `flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4`
- o rodapé é `border-border bg-popover sticky bottom-0 flex flex-col gap-3 border-t px-6 py-4`,
  contendo `<RodapeFormulario control={control} />` e os botões

**A diferença estrutural é conhecida; o mecanismo NÃO.** No celular a altura é fixa (`h-[100dvh]`),
então a área rolável tem altura definida e o `sticky bottom-0` gruda no pé da tela. No desktop a
altura é `md:h-auto` com teto de `85svh`, e o diálogo é centralizado por `-translate-y-1/2`.
Hipótese a testar, não a assumir: com `h-auto`, o `flex-1` da área de campos não recebe base de
altura, então o `overflow-y-auto` pode nunca criar contexto de rolagem — e o rodapé `sticky` sem
ancestral rolável se comporta como `relative`, indo parar onde o conteúdo terminar, que num modal
centralizado é perto do meio da tela.

**Isso é hipótese, não diagnóstico.** Precisa reproduzir com o app rodando e medir de verdade —
alturas computadas, qual elemento realmente rola, e onde o rodapé cai em telas de alturas
diferentes.

## Restrições do projeto que valem para a correção

- Alvos de toque de no mínimo 44px; campo de formulário nunca abaixo de 16px (senão o iOS dá zoom
  ao focar).
- **Não pode quebrar o celular**, onde o comportamento está certo hoje.
- **Não voltar a montar dois `Root` do Radix** (`Dialog` + `Sheet`) — é a armadilha já documentada
  no arquivo, com custo de acessibilidade real.
- Orçamento de e2e: `npm run test:e2e` custa ~53s de imposto fixo. No máximo uma invocação por
  tarefa, sempre com `--grep`. `lint`, `tsc --noEmit` e `npm test` são baratos.

## Current Focus

- bug_class: "Bohrbug — determinístico, reproduz em 100% das aberturas em qualquer viewport `md:`+; magnitude é função linear e exata da altura da janela."
- hypothesis: "CONFIRMADA (revisada). O rodapé `sticky bottom-0` NÃO tem nenhum ancestral rolável dentro do diálogo — a área de campos é IRMÃ dele, não ancestral. O único scrollport na cadeia é o `body`/documento. O navegador então gruda o rodapé no pé da JANELA, calculado nas coordenadas de LEIAUTE do diálogo (antes do `translate`). Como `md:top-1/2` + `md:-translate-y-1/2` posiciona a caixa de leiaute em `top: 50vh` e só depois a sobe meia altura na pintura, o rodapé já vinha deslocado para cima por `(topo + altura) - alturaDaJanela` e ainda é arrastado junto pelo translate — parando no meio da janela."
- test: "Medido com Chromium headless contra o app rodando, em 6 viewports, com poucos e muitos campos, rolado e com campo focado. Experimento de falsificação: `position: static !important` no rodapé em tempo de execução."
- expecting: "CONFIRMADO em 6/6 viewports com previsão numérica exata (±1px de borda)."
- reasoning_checkpoint:
    hypothesis: "`position: sticky; bottom: 0` num elemento que é IRMÃO (não filho) do contêiner de rolagem se ancora ao scrollport do documento; sob `md:-translate-y-1/2` esse ponto de ancoragem é pintado meia altura de diálogo acima, deixando o rodapé no meio da janela."
    confirming_evidence:
      - "Cadeia de ancestrais do rodapé medida: form(overflow-y:visible) > div[dialog-content](overflow-y:visible) > body(overflow-y:hidden). Nenhum scrollport dentro do diálogo."
      - "Desalinhamento observado = (top do DialogContent + altura) − altura da janela, com erro de exatamente 1px (a borda `md:border`), em 1024/800/600/900 de altura."
      - "No celular `translate=0px` e o fundo de leiaute do diálogo coincide com o pé da janela → desalinhamento 0px. Mesma regra, resultado certo por coincidência geométrica."
      - "A área de campos SEMPRE rolou (sH=1990 vs cH=690 com 9 itens) — a hipótese original, de que o `flex-1` não recebia base de altura, está errada."
    falsification_test: "Forçar `position: static` no rodapé em tempo de execução. Se a hipótese estiver errada, o desalinhamento persiste."
    fix_rationale: "O rodapé nunca esteve dentro de um contêiner de rolagem — `sticky` é a ferramenta errada para essa estrutura. O flex do `<form>` (campos `flex-1`, rodapé tamanho natural) já prende o rodapé ao pé do diálogo nos dois viewports. Remover `sticky bottom-0` remove a causa, não o sintoma."
    blind_spots: "Medido em Chromium apenas (é o único motor da suíte). Medido em `next dev` e numa rota de medição descartável, não em `/encomendas` com banco — mas o `DialogContent` é portado para `document.body` e é `position: fixed`, então o invólucro da página não participa do leiaute dele."
    candidate_causes:
      - "código: `sticky bottom-0` sem ancestral rolável (CONFIRMADA)"
      - "código/configuração de estilo: `md:h-auto`/`md:max-h-[85svh]` não criando contexto de rolagem (ELIMINADA por medição)"
    and_gate: "não — uma única condição basta. Provado: neutralizar só o `sticky` zera o desalinhamento em todos os viewports de desktop, sem tocar em altura, `max-height` ou `translate`."
- next_action: "Remover `sticky bottom-0` do rodapé em components/amassa/encomendas/formulario-encomenda.tsx, registrar a lição inline, e adicionar teste de regressão e2e que afirma rodapé colado ao pé do diálogo no desktop E no celular."

## Evidence

- timestamp: 2026-08-20
  checked: "Classe final do `DialogContent` depois de `cn()`/tailwind-merge (`npx tsx`, chamando o `cn` real do projeto)."
  found: "`flex` vence `grid`; `md:h-auto` e `md:max-h-[85svh]` sobrevivem ao lado de `h-[100dvh]`/`max-h-[100dvh]`; `md:-translate-x-1/2 md:-translate-y-1/2` sobrevivem. Nenhuma classe se perde na mesclagem."
  implication: "A mesclagem de classes NÃO é a causa. O contrato desktop/celular chega intacto ao DOM."

- timestamp: 2026-08-20
  checked: "Leiaute real medido em Chromium headless com o app rodando (`next dev`), viewport 1280x1024, formulário de nova encomenda aberto, estado inicial (1 item)."
  found: "DialogContent: height=870.4px (= 85svh exatos), max-height=870.4px, position=fixed, top(css)=512px, translate=`-50% -50%`, rect top=76.8 bottom=947.2. form: flex-1, rect 142.8..946.2. area-de-campos: overflow-y=auto, height=690.4, **scrollHeight=950 vs clientHeight=690 → ROLA**. rodape: position=sticky, bottom=0px, rect **475.8..588.8**."
  implication: "**A hipótese original está ERRADA.** A área de campos recebe altura definida e cria contexto de rolagem normalmente. O `max-height: 85svh` funciona. O defeito é só a posição do rodapé: ele deveria estar em 833.2..946.2 (fim do form) e está 357.4px acima disso."

- timestamp: 2026-08-20
  checked: "Cadeia de ancestrais do rodapé, com `overflow-y` computado de cada um."
  found: "`form` (overflow-y: visible) > `div[data-slot=dialog-content]` (overflow-y: visible) > `body` (overflow-y: **hidden**, posto pelo react-remove-scroll do Radix)."
  implication: "**Não existe nenhum contêiner de rolagem entre o rodapé e o documento.** A área rolável (`overflow-y: auto`) é IRMÃ do rodapé, não ancestral — então não pode ancorá-lo. O scrollport a que o `sticky bottom-0` se ancora é o do documento."

- timestamp: 2026-08-20
  checked: "Desalinhamento (fim do form − fim do rodapé) contra a previsão do modelo `(top do DialogContent + altura) − altura da janela`, em 6 viewports."
  found: "1280x1024: previsto 358.4, observado 357.4. 1280x800: previsto 280.0, observado 279. 1280x600: previsto 210.0, observado 209. 1440x900: previsto 315.0, observado 314. 390x844: translate=0px, previsto 0, observado 0. 412x915 (Pixel 7): translate=0px, previsto 0, observado 0."
  implication: "Modelo exato: o erro constante de 1px é a borda `md:border` do diálogo. O rodapé é grudado no pé da JANELA em coordenadas de leiaute (antes do translate) e depois arrastado para cima pelo `md:-translate-y-1/2`. No celular a caixa de leiaute do diálogo já termina no pé da janela e o translate é zero — mesma regra, resultado certo por coincidência geométrica. **É por isso que o celular está certo e o desktop não.**"

- timestamp: 2026-08-20
  checked: "Invariância do defeito: poucos campos (1 item) vs muitos campos (9 itens), com a área de campos rolada até o fim e com o último campo focado."
  found: "rodapé em 475.8..588.8 em TODOS os estados a 1280x1024. Com 9 itens a área de campos tem scrollHeight=1990/clientHeight=690 e rola (scrollTop chegou a 1300); o rodapé não se move nem um pixel."
  implication: "Não depende de quantidade de conteúdo nem de rolagem — depende só da geometria do diálogo. O rodapé fica no meio do diálogo com campos passando POR BAIXO dele e uma faixa vazia de 357px sob ele: é literalmente 'no centro da janela, dificultando inserir as informações'."

- timestamp: 2026-08-20
  checked: "Experimento de falsificação: `[data-slot=dialog-content] form > div:last-child { position: static !important }` injetado em tempo de execução, nos 6 viewports, com muitos campos e com a área de campos rolada até o fim."
  found: "Desalinhamento cai para **0px em todos os viewports de desktop** (rodapé 833.2..946.2 a 1280x1024; 626..739 a 1280x800; 441..554 a 1280x600; 718.5..831.5 a 1440x900). No celular nada muda (802..915 antes e depois). A área de campos continua rolando e o rodapé fica parado enquanto ela rola."
  implication: "Hipótese confirmada por intervenção, não só por correlação. `sticky` é a ÚNICA causa, e o flex do `<form>` sozinho já prende o rodapé ao pé do diálogo — inclusive no celular, onde o `sticky` sempre foi inócuo."

## Eliminated

- hypothesis: "Com `md:h-auto`, a área de campos (`flex-1 overflow-y-auto`) não recebe base de altura, então não cria contexto de rolagem, e o rodapé `sticky` degrada para `relative`."
  evidence: "Medido: a área de campos tem `overflow-y: auto`, height=690.4px e scrollHeight=950 (1990 com 9 itens) — ela ROLA em todos os viewports. O `md:max-h-[85svh]` clampeia o diálogo corretamente (height computada = 870.4px = 85% de 1024). E o rodapé fica `position: sticky` computado, não `relative`."
  timestamp: 2026-08-20

- hypothesis: "A mesclagem `cn()`/tailwind-merge está perdendo alguma classe do contrato desktop (ex.: `md:h-auto` sendo comida por `h-[100dvh]`)."
  evidence: "Classe final impressa chamando o `cn` real: todas as classes `md:` sobrevivem, e as computadas no navegador batem com elas (height=870.4px, translate=`-50% -50%`)."
  timestamp: 2026-08-20

## Resolution

root_cause: |
  O rodapé do formulário era `sticky bottom-0` num `div` que é **irmão** da área rolável, não
  filho dela. Sem nenhum contêiner de rolagem entre ele e o documento (cadeia medida:
  `form` overflow-y:visible > `dialog-content` overflow-y:visible > `body` overflow-y:hidden), o
  `bottom: 0` se ancora no scrollport do DOCUMENTO — e faz essa conta nas coordenadas de
  **leiaute** do diálogo, isto é, antes do `md:-translate-y-1/2` que o centraliza na pintura.
  No desktop a caixa de leiaute do diálogo começa em `md:top-1/2` (metade da janela) e se estende
  para baixo além do pé da janela; o navegador sobe o rodapé em exatamente
  `(top + altura) − alturaDaJanela` para grudá-lo no pé da janela, e o `translate` de
  centralização depois arrasta esse ponto mais meia altura para cima. Resultado: o rodapé pinta
  no meio da janela, com campos passando por baixo dele e uma faixa vazia embaixo.
  No celular a mesma regra dá deslocamento zero, porque `translate` é `0px` e a caixa de leiaute
  do diálogo (`bottom-0` + `h-[100dvh]`) já termina exatamente no pé da janela — o `sticky`
  sempre foi inócuo ali. Foi essa coincidência geométrica que escondeu o defeito no celular.

fix: |
  Removidas as classes `sticky bottom-0` do `div` do rodapé em
  `components/amassa/encomendas/formulario-encomenda.tsx`. Nada mais mudou: nem altura, nem
  `max-height`, nem `translate`, nem estrutura, nem o número de `Root` do Radix.
  O `<form>` já é `flex min-h-0 flex-1 flex-col` e a área de campos já é `flex-1 min-h-0
  overflow-y-auto` — o flex sozinho prende o rodapé ao pé do diálogo nos dois tamanhos de tela,
  com os campos rolando por baixo. A lição ficou registrada inline, no estilo do arquivo.

verification:
  guardrail_verdict: accepted
  oracle_type: derived
  sinal_1_reproducao_antes: "REPRODUZIDO. Medido em 6 viewports: desalinhamento de 357.4px (1280x1024), 279px (1280x800), 209px (1280x600), 314px (1440x900); 0px nos dois viewports de celular."
  sinal_2_mecanismo: "EXPLICADO E QUANTIFICADO. Modelo `(md:top-1/2 + altura) − alturaDaJanela` prevê o desalinhamento com erro de exatamente 1px (a borda `md:border`) em 4 alturas de janela independentes, e prevê 0px no celular."
  sinal_3_correcao_verde: "e2e `npm run test:e2e -- --grep colado`: 14 passaram, incluindo o teste novo nos projetos `desktop` E `celular`, contra a rota REAL `/encomendas?nova` e uma build de produção."
  sinal_4_reversao_traz_o_defeito_de_volta: "PROVADO. Com o componente revertido por `git stash` e o teste novo no lugar, o projeto `desktop` REPROVA com `Expected: <= 2 / Received: 252` (viewport 1280x720 do preset Desktop Chrome: 85svh=612, top=360, 972−720=252 — o modelo previu o número exato). O projeto `celular` PASSA mesmo com o defeito presente, que é exatamente por que ele escapou."
  sinal_5_nao_e_diff_de_deleção_sem_causa: "A remoção de duas utilitárias é a correção da causa-raiz, não a supressão de um sintoma: `sticky` só faz sentido para um elemento DENTRO de um contêiner de rolagem, e este nunca esteve."
  medicoes_depois_da_correcao: "Desalinhamento 0px em 8 viewports (1280x1024, 1280x800, 1280x600, 1440x900, 1280x1400 com conteúdo menor que 85svh, 768x700 no limiar do `md`, 390x844, 412x915). Área de campos continua rolando; rodapé não se move quando ela rola. Celular idêntico antes e depois (731..844 e 802..915)."
  portoes_baratos: "npm run lint (limpo), npx tsc --noEmit (limpo), npm run verificar-acoes (17 ações, 0 violações), npm test (26 arquivos, 425 testes, todos passam)."
  nao_rodado: "npm run test:migracoes — nenhuma mudança em db/schema.ts nesta sessão. Varredura e2e completa sem `--grep` — cabe ao último plano da fase, conforme CLAUDE.md."

files_changed:
  - "components/amassa/encomendas/formulario-encomenda.tsx: removidas `sticky bottom-0` do rodapé + comentário registrando o mecanismo medido."
  - "tests/e2e/encomendas-formulario.spec.ts: teste de regressão que mede a geometria (rodapé colado ao pé do diálogo, com tolerância de 2px, e imóvel enquanto os campos rolam), rodando nos dois projetos de viewport."
