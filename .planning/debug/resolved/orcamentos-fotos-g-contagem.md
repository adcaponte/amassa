---
status: resolved
trigger: "tests/e2e/orcamentos-fotos.spec.ts (g) “…toque mede ao menos 44px”: espera 3 fotos em `fotos-grade` e vê 1 ou 2. No 06.5-23 o (e) viu 3 na grade e logo depois o (g), reabrindo o editor, viu 1 (desktop) e 2 (celular). Antes: uma vez no branch, passou no `main` 0b646f7. Teste ou produto (foto mostrada e não gravada)?"
created: 2026-10-06T13:00:00Z
updated: 2026-10-06T14:30:00Z
---

## Current Focus

hypothesis: CONFIRMADA — o (e) afirma o estado OTIMISTA, não o gravado. `fotos-contagem`, `fotos-limite` e a contagem de `foto-celula` contam a célula "Enviando foto…" como vaga ocupada; o (e) termina ~200 ms depois de escolher a 3ª foto, com o envio da 2ª em voo e o da 3ª na fila do roteador (server actions são seriais), a página fecha e o que não terminou morre.
test: concluído — invocações 2 e 3 com a correção (arquivo inteiro verde nos dois projetos, 2 de 2) + sonda determinística repetida + `npm run verificar`.
expecting: —
next_action: nenhuma nesta sessão. Confirmação estatística na varredura completa do 06.5-30. A proposta de produto (aviso ao sair com envio em andamento) fica para o dono decidir — ver Resolution.
bug_class: Mandelbug de corrida no TESTE (fim do teste × envio assíncrono serializado). SBFL não se aplica (sem espectro por teste no e2e); usado o roteiro de corrida: observar a janela e depois forçá-la (POST segurado).

reasoning_checkpoint:
  hypothesis: "O (e) de tests/e2e/orcamentos-fotos.spec.ts dá o envio por concluído olhando sinais que aparecem no MESMO render que põe a célula de espera (contagem 'N de 3', frase do limite, número de `foto-celula`); ele acaba antes de as server actions de envio responderem, a página fecha, e o (g) — que abre o editor do zero, do banco — acha só as fotos que de fato chegaram."
  confirming_evidence:
    - "Invocação 1, natural, nos dois projetos: fim do (e) com 'células 3 enviando 2 img 1 banco [1 linha]'; um POST só saiu; o (g) achou 2 linhas no banco e falhou com 2 células."
    - "Invocação 1, determinística: com o POST segurado 2 s, o (e) ao pé da letra passa com banco=1 e o editor reaberto mostra 1; esperando a célula virar `<img>`, banco=3 e reaberto=3."
    - "Código: `vagasOcupadas` conta `enviando`; a célula só vira `<img>` com a resposta `ok` + id; o roteador do Next serializa server actions (app-router-instance.js)."
  falsification_test: "Se, com o (e) esperando as células virarem `<img>`, o (g) ainda vir menos de 3, a causa não é o fim do teste antes do envio (seria limpeza cruzada ou perda no servidor). Se a sonda 'corrigido' tivesse dado banco<3, a hipótese cairia — deu 3."
  fix_rationale: "Esperar a célula virar foto é esperar a resposta `ok` da ação, que só vem depois do commit da linha e da gravação do arquivo: o (e) passa a provar o que o nome dele diz (3 fotos ENVIADAS) e entrega ao (g)/(f) um orçamento com 3 fotos gravadas. Nenhuma asserção sai; ganham-se duas (`foto-enviando` zerado e `img` = total)."
  blind_spots: "Não vi o desktop do 06.5-23 (1 em vez de 2) por dentro — os traces daquela rodada não existem mais; pelo mecanismo, é a 2ª foto que nem saiu (ou foi cortada antes de o corpo chegar). A correção cobre os dois casos, porque espera a resposta, não o POST sair."
  candidate_causes:
    - "código de teste: o (e) espera sinais otimistas (CONFIRMADO)"
    - "código de produto: foto mostrada como gravada sem estar (ELIMINADO — a `<img>` e o aviso só vêm com `ok` + id; toda linha tem arquivo)"
    - "dados/estado: outro teste apagando fotos do orçamento compartilhado (ELIMINADO — o orçamento é por projeto, criado no (a); só `polimento-banco` apaga orçamento, o próprio, por id)"
    - "ambiente: carga/latência da server action decide se o envio cabe nos ~200 ms (contribui — explica a intermitência e por que já passou no main)"
  and_gate: "sim — falha exige (1) o (e) acabar sem esperar a resposta E (2) a ação levar mais que o resto do (e) (~200 ms). (2) é ambiente e não se controla; a correção remove (1)."

## Symptoms

expected: o (e) deixa o orçamento com 3 fotos GRAVADAS; o (g), abrindo o editor do zero, vê 3.
actual: o (g) vê 1 (desktop) e 2 (celular) na rodada do lote 2 do 06.5-23; o (e) da mesma rodada passou vendo 3 células.
errors: "expect(locator).toHaveCount(3) … getByTestId('fotos-grade').getByTestId('foto-celula') … received 1" (linha 192)
reproduction: intermitente sob carga; `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts` isolado passou 94/94.
started: registrado em 05/10 (varredura acidental do 06.5-04); repetiu no 06.5-19 (celular, 2 fotos) e no 06.5-23 (dois projetos).

## Eliminated

## Evidence

- timestamp: 2026-10-06T13:00:00Z
  checked: base de conhecimento (.planning/debug/knowledge-base.md não existe; sessões em resolved/)
  found: parente direto `queimas-banner-144-intermitente` (asserção que não espera o efeito real; corrida de fim de toque). Nenhum casamento por fotos.
  implication: hipótese candidata, não diagnóstico.

- timestamp: 2026-10-06T13:05:00Z
  checked: `git diff main...HEAD` em `components/amassa/orcamentos/fotos-de-referencia.tsx`, `lib/orcamentos/acoes.ts` (`anexarFotoDeOrcamento`), `tests/e2e/orcamentos-fotos.spec.ts`
  found: o componente das fotos e a ação de anexar NÃO mudaram na 06.5; o spec só trocou o `criarOrcamento` (agora pelo auxiliar do 06.5-14) e o `boundingBox` do (g). `acoes.ts` mudou só em `criarOrcamento` (cliente/título gravados junto).
  implication: nenhuma mudança de produto da 06.5 no caminho do envio. O 06.5-14 só mudou COMO o orçamento nasce; a tela nova (`orcamento-novo.tsx`) não tem fotos ("as fotos … precisam de um orçamento que exista"), e o auxiliar só devolve o id depois da navegação completa para o editor do orçamento criado. Envio de foto antes do orçamento existir não é possível pela tela.

- timestamp: 2026-10-06T13:10:00Z
  checked: `fotos-de-referencia.tsx` linhas 88–142 e o (e) do spec
  found: |
    `vagasOcupadas = celulas.filter(c => c.status !== "erro").length` — a célula "enviando" conta. "2 de 3" aparece no MESMO render que põe a célula de espera, antes de o POST sair; `fotos-limite` aparece quando a 3ª entra em espera; `foto-celula` existe nas três variantes (pronta, enviando, erro). O (e) espera exatamente esses três sinais e termina. A célula só vira foto (`pronta`, com `<img>`) e o aviso "Foto de referência anexada." só sai depois de `anexarFotoDeOrcamento` responder `ok` com o id.
  implication: o (e) pode passar com zero fotos novas gravadas. A tela é honesta (spinner + "Enviando foto…" até a resposta); a asserção é que mede a coisa errada. Falta medir se o envio de fato não chega ao banco quando o (e) acaba.

- timestamp: 2026-10-06T13:15:00Z
  checked: `node_modules/next/dist/client/components/app-router-instance.js:108-170` (Next 16.3.5)
  found: server action entra na fila única do roteador; com algo pendente, vai para o FIM e só começa quando a anterior termina. Navegação passa na frente, mas a fila restante continua depois dela.
  implication: os envios do (e) são SERIAIS: o POST da 3ª foto só sai depois de a 2ª responder. Fechar a página (fim do teste) mata o que está na fila e o que está em voo no navegador.

- timestamp: 2026-10-06T13:40:00Z
  checked: invocação 1 — `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/zz-sonda-fotos-sair.spec.ts --trace retain-on-failure`, com sonda passiva no (e) e no (g) (eventos de POST de server action; contagem de células, `foto-enviando` e `img` no fim do (e); linhas de `orcamento_fotos` pelo `pg` e existência de cada arquivo em `.dados/fotos-orcamentos`)
  found: |
    "4 failed, 2 skipped, 8 did not run, 112 passed (2.2m)". O (g) falhou NOS DOIS PROJETOS, com 2 células (o defeito reproduziu sem carga extra, só 4 arquivos de spec).
    desktop: `(e) +56ms banco no início [{ordem:0,noDisco:true}]` · `+106ms POST de ação saiu` · `+303ms fim do (e): células 3 enviando 2 img 1 banco [{ordem:0}]` · `+311ms página fechou` · `(g) banco no início [{ordem:0,noDisco:true},{ordem:1,noDisco:true}]`.
    celular: `+87ms POST saiu` · `+264ms fim do (e): células 3 enviando 2 img 1 banco [1 linha]` · `+277ms página fechou` · `(g) banco no início [2 linhas, as duas com arquivo]`.
    Um POST só saiu no (e) inteiro (o da 2ª foto); nenhum "terminou" antes de a página fechar; a 3ª foto nunca saiu da fila do roteador. Log do servidor: nenhuma linha "Falha ao anexar foto" nem "Falha ao processar foto"; só os "The destination stream closed early" genéricos de resposta em streaming cortada, espalhados pela cadeia `vazio-*` toda.
  implication: |
    H1 confirmada por observação direta: o (e) PASSA com as três asserções olhando duas células "Enviando foto…" e UMA foto gravada. A 2ª foto, já em voo, o servidor terminou de gravar depois de a página fechar (o (g) achou a linha 1 com arquivo); a 3ª nunca foi enviada. É exatamente o "3 no (e), 2 no (g)" do 06.5-23 (celular); o "1" do desktop no 06.5-23 é o mesmo mecanismo com a 2ª foto ainda sem sair (ou cortada antes de o corpo chegar). Toda linha no banco tinha o arquivo no disco: nenhum órfão, nenhuma foto mostrada como gravada sem estar.

- timestamp: 2026-10-06T13:45:00Z
  checked: invocação 1, sonda determinística (desktop) — orçamento próprio, 1ª foto esperada de verdade, depois cada POST de server action segurado 2 s no navegador (`page.route`), e o laço do (e) repetido ao pé da letra ("como-esta") × o laço esperando a célula virar foto ("corrigido"); conta no banco no fim, 5 s depois de fechar a página, e reabre o editor numa página nova
  found: |
    como-esta: `{"asserçõesDoE":"passaram","enviandoNoFim":2,"bancoNoFim":1,"bancoDepoisDeFechar5s":1,"celulasAoReabrir":1}`
    corrigido: `{"asserçõesDoE":"passaram","enviandoNoFim":0,"bancoNoFim":3,"bancoDepoisDeFechar5s":3,"celulasAoReabrir":3}`
  implication: |
    Mecanismo provado dos dois lados, 1 de 1 em cada variante: com o servidor lento, as asserções do (e) passam com 1 foto gravada de 3, e o editor reaberto mostra 1 — a assinatura do desktop no 06.5-23. Esperando a célula virar `<img>` (que só acontece com a resposta `ok` e o id da linha já gravada), o banco tem 3 antes de o teste acabar.

- timestamp: 2026-10-06T13:50:00Z
  checked: o que a TELA mostra durante o envio (`fotos-de-referencia.tsx`) × o que a pessoa vê
  found: a célula em envio mostra o ícone girando e "Enviando foto…"; vira foto (`<img>`) e o aviso "Foto de referência anexada." só sai depois de `anexarFotoDeOrcamento` devolver `ok` com o id da linha gravada (a transação insere a linha e grava o arquivo antes do commit). A contagem "N de 3" e a frase do limite contam a vaga reservada pelo envio em andamento, como manda 04.5-UI-SPEC.md ponto 2.
  implication: produto honesto: nenhuma foto aparece como gravada sem estar. O que se perde é o envio que a pessoa abandona fechando a aba (ou recarregando) enquanto a célula ainda diz "Enviando foto…" — não há aviso de "sair agora perde o envio". Isso é melhoria de produto no fluxo de envio, não defeito desta investigação: vai como proposta, não como correção (regra do pedido: mexer no envio de fotos → não corrigir).

- timestamp: 2026-10-06T14:00:00Z
  checked: invocação 2 — `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/zz-sonda-fotos-sair.spec.ts --trace retain-on-failure`, com o (e) corrigido e a sonda determinística repetida
  found: |
    "126 passed, 2 skipped (2.1m)", EXIT=0. orcamentos-fotos inteiro verde nos dois projetos: (a)(b), (c), (d), (e) 4,0 s, (g), (f), (h). O (e) leva 4,0 s com login e abertura do editor, agora incluindo as duas ações de envio em série — o (e) antigo terminava ~0,3 s depois de escolher as fotos.
    Sonda: como-esta `{"enviandoNoFim":2,"bancoNoFim":1,"bancoDepoisDeFechar5s":1,"celulasAoReabrir":1}` × corrigido `{"enviandoNoFim":0,"bancoNoFim":3,"bancoDepoisDeFechar5s":3,"celulasAoReabrir":3}` — mesmo resultado da invocação 1 (2 de 2).
  implication: correção verde e mecanismo reconfirmado: reverter (laço antigo) devolve o defeito, reaplicar (esperar a `<img>`) o tira.

- timestamp: 2026-10-06T14:10:00Z
  checked: invocação 3 — `npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/abertura-tracador.spec.ts tests/e2e/acessibilidade.spec.ts tests/e2e/estados.spec.ts tests/e2e/lembretes-todos.spec.ts tests/e2e/rotas.spec.ts --trace retain-on-failure` (sem sonda)
  found: "260 passed (3.2m)", EXIT=0, nenhum ✘ nem flaky — segunda passagem seguida do orcamentos-fotos inteiro, nos dois projetos.
  implication: 2 de 2 com a correção. O defeito reproduzia em 1 de 1 na invocação 1 (dois projetos), então duas passagens verdes já distinguem; a varredura do 06.5-30 confirma sob a suíte cheia.

- timestamp: 2026-10-06T14:20:00Z
  checked: `npm run verificar` com as duas correções e a sonda apagada
  found: EXIT=0 — eslint `--max-warnings=0` limpo, `tsc --noEmit` limpo, verificar-acoes "125 ação(ões) conferida(s), 0 violações" (as duas linhas "1 violação" são das fixtures de autoteste), vitest "145 passed (145) / 3252 passed (3252)", `test:migracoes` "Todas as afirmações passaram".
  implication: nenhuma regressão nos portões rápidos.

## Resolution

root_cause: |
  TESTE — o (e) de `tests/e2e/orcamentos-fotos.spec.ts` dava cada envio por concluído olhando a contagem
  "N de 3", a frase do limite e o número de `foto-celula`. Os três contam a célula "Enviando foto…" como vaga
  ocupada (`vagasOcupadas` em `fotos-de-referencia.tsx`, por decisão de 04.5-UI-SPEC.md ponto 2) e aparecem no
  mesmo render que a põe na tela, antes de o POST sair. As server actions são seriais na fila do roteador do Next
  (`app-router-instance.js`): o POST da 3ª foto só sai depois de a 2ª responder. O (e) acabava ~200–300 ms depois
  de escolher a 3ª foto, com a 2ª em voo e a 3ª na fila; o Playwright fechava a página, e o que não tinha
  terminado morria. O (g) — e o (f) — abrem o editor do zero, do banco, e acham 2 (a 2ª ainda chegou ao servidor e
  foi gravada depois do fechamento) ou 1 (a 2ª nem saiu, ou foi cortada antes de o corpo chegar).

  AND-gate: a falha exige (1) o (e) não esperar a resposta E (2) a ação de envio levar mais que o resto do (e).
  (2) é ambiente (carga, latência da ação — o POST da 2ª foto não tinha terminado ~200 ms depois de sair, nos dois
  projetos, numa invocação leve; o (e) corrigido leva 4,0 s com login e abertura do editor) e explica a intermitência e
  por que já passou no `main`. Nada da 06.5 mudou no caminho do envio (`git diff main...HEAD`): o defeito do teste
  é da Fase 04.5.

  NÃO é perda de dado no produto: a célula só vira foto (`<img>`) e o aviso "Foto de referência anexada." só sai
  com a resposta `ok` e o id da linha, que a transação grava junto com o arquivo antes do commit. Medido: toda linha
  de `orcamento_fotos` tinha o arquivo em `.dados/fotos-orcamentos`, e nunca houve `<img>` sem linha. O envio do
  plano 06.5-14 também não entra: a tela "Novo orçamento" não tem fotos e o auxiliar só devolve o id depois da
  navegação completa para o editor do orçamento criado.

fix: |
  `tests/e2e/orcamentos-fotos.spec.ts`, teste (e): cada envio agora espera a célula VIRAR FOTO
  (`fotos-grade` com `img` = total esperado, timeout 15 s) e nenhuma `foto-enviando` sobrar, ANTES das asserções
  que já existiam (contagem / frase do limite); no fim, além das 3 células, 3 `<img>`. Nenhuma asserção saiu, nenhum
  timeout afrouxou, nenhum arquivo de produto mudou. Comentário no teste explica o porquê.

  PROPOSTA DE PRODUTO — NÃO APLICADA (mexe no fluxo de envio de fotos; regra do pedido): hoje, quem fecha a aba,
  recarrega ou sai por navegação completa enquanto uma célula diz "Enviando foto…" perde aquele envio sem aviso — a
  tela é honesta, mas não avisa. Proposta: em `FotosDeReferencia`, enquanto houver célula `enviando`, registrar um
  `beforeunload` (o navegador pergunta "Sair do site? As alterações podem não ser salvas") e retirá-lo quando a fila
  zerar. Não muda como a foto é gravada, só pede confirmação ao abandonar. Opcional e separado: considerar se a
  frase "Limite de 3 fotos atingido" deveria esperar o envio terminar (hoje ela conta a vaga reservada, como manda o
  UI-SPEC 04.5 ponto 2). Decisão do dono.

verification:
  target_test: { result: pass, detalhe: "orcamentos-fotos inteiro, desktop e celular, 2 de 2 invocações (2: 126 passed; 3: 260 passed)" }
  mutation_check: { result: pass, detalhe: "Stryker não existe no projeto; substituto equivalente — a 'mutação' é o laço antigo do (e). Com o POST segurado 2 s, o laço antigo passa com banco=1 e reaberto=1; o corrigido dá banco=3 e reaberto=3 (invocações 1 e 2, 2 de 2 cada)" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detalhe: "o diff só ACRESCENTA esperas e asserções; nada removido além de reaproveitar o localizador `grade`" }
  adjacent_tests:
    result: pass
    suites_run:
      - "npm run verificar: EXIT=0 (lint, tsc, verificar-acoes 125/0, vitest 145/3252, test:migracoes)"
      - "cadeia vazio-* inteira nas 3 invocações (roda em toda invocação), verde nas 2 com a correção"
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detalhe: "sonda 'como-esta' (laço antigo) × 'corrigido', mesma página e mesmo servidor lento, invocações 1 e 2" }
  guardrail_verdict: accepted
  oracle_type: specified
  human_verify: "pendente — a varredura completa do 06.5-30 confirma sob a suíte cheia; a proposta do beforeunload é decisão do dono"
  comandos_e2e_rodados_nesta_sessao: |
    1. npm run test:e2e -- tests/e2e/orcamentos-fotos.spec.ts tests/e2e/casca.spec.ts tests/e2e/sessao.spec.ts tests/e2e/zz-sonda-fotos-sair.spec.ts --trace retain-on-failure  (sondas, sem correção) → 4 failed (fotos (g) ×2, casca:238 e sessao:111 desktop), 112 passed (2.2m)
    2. o mesmo comando, com as duas correções e sondas de reverter/reaplicar → 126 passed, 2 skipped (2.1m)
    3. npm run test:e2e -- (os 3 specs) + abertura-tracador, acessibilidade, estados, lembretes-todos, rotas --trace retain-on-failure  (sem sonda) → 260 passed (3.2m)
    Três invocações, dentro do teto "~5". Nenhum `@parametro-global`, nenhum `npm run build` avulso. Antes de cada uma, `docker ps` mostrou só `docker-postgres-1`. A sonda (`tests/e2e/zz-sonda-fotos-sair.spec.ts`) e a instrumentação dos specs foram apagadas antes do commit.

fix_commit: 753f69e

files_changed:
  - tests/e2e/orcamentos-fotos.spec.ts
