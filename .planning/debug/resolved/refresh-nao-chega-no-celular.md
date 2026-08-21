---
slug: refresh-nao-chega-no-celular
status: resolved
confirmacao_do_dono: pendente — sera conferida em producao depois do deploy
decisao_do_dono: "ajuste rapido apos concluir/cancelar fica como esta; a inconsistencia das duas datas vai para o backlog como divida conhecida"
trigger: "CI vermelho: 3 falhas no projeto celular da varredura completa, todas esperando o resultado de um router.refresh() depois de uma Server Action. O deploy está bloqueado."
created: 2026-08-21
updated: 2026-08-21
bloqueia: "job implantar do entrega.yml — exit code 1 no job e2e"
---

# Debug: `router.refresh()` não chega, no projeto celular

## Symptoms

**Comportamento esperado.** Depois de uma Server Action que muda o estado no banco, a página
reflete o novo estado — `router.refresh()` traz a árvore do servidor de novo e a interface atualiza.
É o padrão em toda a Fase 3 e a Fase 4.

**Comportamento observado.** Três testes do projeto `celular` falham no CI, na varredura completa,
todos esperando exatamente isso. **Os mesmos testes passam no projeto `desktop`.**

**Mensagens de erro.** Nenhum erro de runtime. São asserções de espera estourando.

**Linha do tempo.** O run **#49** (commit `cf8c49c`) fechou **verde**, com a suíte inteira. Este run,
depois dos commits `9a3beca`, `274aa72`, `0ff1b46` e `8446d48`, fechou **vermelho**. Resultado desta
execução: 312 passaram, 2 falharam, 1 flaky, 33 skipped, 2 não rodaram, em 7,5 min, 2 workers.

**Reprodução.** `npm run test:e2e` sem `--grep`, no CI. Ainda **não** foi tentada reprodução local.

## As três falhas, e por que são a mesma

### 1. `tests/e2e/encomendas-detalhe.spec.ts:701` — falhou 3 de 3 (com as duas retentativas)

Asserção: `expect(page.locator("body")).toContainText("Concluída em", { timeout: 10000 })`.

**A evidência que importa está na sequência de amostras do corpo:**

- primeira amostra: `…Conclusão prevista: 4 jul` **`Concluindo…`** `Itens…`
- as 23 seguintes: `…Conclusão prevista: 4 jul` **`Marcar como concluída`** `Itens…`

Ou seja: o botão entrou no estado de gravação e **voltou ao repouso**. Em
`components/amassa/encomendas/trilha-etapas.tsx` (função `concluir`, linhas ~117-129) isso só
acontece depois que `concluirEncomenda` **retorna**; e o ramo de falha chama
`toast.error(FRASE_FALHA_AO_SALVAR)`, cujo texto **não aparece** em nenhuma das 24 amostras.

**Leitura: a ação retornou `ok`. O que não chegou foi o `router.refresh()`.**

Nota: a asserção anterior (`toHaveCount(0)` sobre o botão "Marcar como concluída") **passou** — mas
passou pelo motivo errado: durante `Concluindo…` o nome acessível do botão muda, então a contagem
vai a zero sem nada ter sido concluído. Isso mascara o defeito e deve entrar no diagnóstico.

### 2. `tests/e2e/encomendas-filtros.spec.ts:171` — falhou uma vez, passou na retentativa (flaky)

Mesma asserção `toContainText("Concluída em")`, dentro do auxiliar `concluirViaDetalhe`. Mesmo
corpo, mesmo `Marcar como concluída` de volta.

### 3. `tests/e2e/queimas-manutencao.spec.ts:79` — falhou 3 de 3

Erro: **strict mode violation**. `getByText("Manutenção registrada.")` resolveu para DOIS elementos:

1. `<p data-testid="historico-manutencoes-vazio">Sem manutenção registrada.</p>`
2. `<div data-title="">Manutenção registrada.</div>` (o toast)

`getByText` casa por **substring**, e `"Sem manutenção registrada."` contém
`"manutenção registrada."`. Os dois estarem no DOM ao mesmo tempo é a mesma corrida: o toast
apareceu **antes** de o refresh remover o estado vazio.

Na retentativa #2 o erro muda: resolveu para **dois toasts empilhados**, ambos
`"Manutenção registrada."`. Isso mostra que `exact: true` sozinho **não** conserta.

**Este localizador está errado independentemente da corrida** — é o único conserto certo hoje, e
vale fazer de qualquer forma, mas ele NÃO é a causa raiz das outras duas.

## Hipótese principal, e por que ela não basta

`.planning/WINDOWS.md` já registra esta classe, duas vezes, ambas `open`:

- **#21** (`encomendas-detalhe.spec.ts:657`) — *"'Concluída em' aparece via `router.refresh()` após
  `concluirEncomenda` … passou na retentativa sem mudança de código, mesma classe de contenção de
  servidor Next único compartilhado já registrada em WINDOWS #12"*
- **#12** (`sessao.spec.ts:110`) — timing de navegação sob concorrência da varredura completa

**Mas o caráter mudou, e é isso que precisa ser explicado:** o #21 está registrado como *flaky, passa
na retentativa*. Aqui a falha 1 reprovou **3 de 3, com saída idêntica**. Determinístico não é flaky,
e aceitar o rótulo antigo seria conveniente demais.

**Suspeita honesta, não medida:** esta sessão acrescentou cerca de **seis testes e2e** — os marcos
(`encomendas-formulario`), o voltar (`encomendas-detalhe`), a contagem de itens e a hachura
(`encomendas-indice`) —, **todos criando encomendas**. Mais carga sobre o mesmo servidor Next
compartilhado, que é exatamente o recurso que o #21 diz estar em disputa. É plausível que uma
instabilidade conhecida tenha sido empurrada até virar determinística. **Plausível, não provado.**

**Contra-hipóteses que merecem eliminação, não descarte:**

- É mesmo carga? Então rodar só o teste 1 isolado deve passar, e rodar a suíte com menos workers
  também. Se ele falhar isolado, a hipótese de contenção morre.
- Por que só `celular`? O `desktop` roda os MESMOS testes e passa. Se fosse carga pura, a
  distribuição entre projetos seria menos limpa. O projeto `celular` usa o preset Pixel 7 do
  Playwright; o `desktop`, Desktop Chrome. Há diferença de viewport, de user agent, e de emulação
  de toque.
- Algum dos quatro commits desta sessão mexeu em código que participa do caminho de conclusão? A
  resposta aparente é não (`274aa72` só acrescentou um controle de voltar no cabeçalho e um teste;
  `9a3beca` mexeu no formulário, não no detalhe), mas isso é leitura, não medição.
- A ordem/`dependencies` do `playwright.config.ts` (`vazio-* → desktop/celular`) coloca `celular`
  por último. Ele herda o banco mais cheio de todos. Isso é testável.

## Restrições

- **Orçamento de e2e (regra medida do CLAUDE.md):** `npm run test:e2e` custa ~53s de imposto fixo.
  Aqui a suíte inteira custa ~7,5 min no CI. Use `--grep` para as tentativas de reprodução; a
  varredura completa só quando for necessária para provar o comportamento sob carga — e registre
  quantas vezes rodou.
- **Não "consertar" enfraquecendo asserção.** Aumentar timeout ou trocar por espera frouxa esconde
  o defeito; foi exatamente esse padrão que deixou o rodapé do formulário quebrado desde a Fase 3.
- **Não pode quebrar o `desktop`**, onde os três passam hoje.
- Windows na máquina local; o CI é Ubuntu. A diferença de ambiente é relevante e deve ser dita se
  a reprodução local não bater com o CI.

## Current Focus

- bug_class: "Mandelbug de PRODUTO no roteador do cliente (perda de atualizacao pos-Server-Action), em conjuncao com dois Bohrbugs de teste (portao falso e colisao de localizador)."
- hypothesis: "CONFIRMADA por medicao — ver Resolution. CICLO 2: o defeito apontado pela revisao de especialista (a trava de conclusao nunca soltava) foi CONFIRMADO por leitura independente de codigo e FECHADO."
- test: "Invocacao e2e #10 (dirigida, 40 amostras) e #11 (varredura completa). npm run verificar EXIT=0."
- expecting: "—"
- next_action: "Aguardando verificacao humana do ciclo 2. Nada commitado, nada arquivado. Se confirmado, arquivar em resolved/ e commitar."

## Evidence

- timestamp: 2026-08-21 (medição 1 — reprodução isolada instrumentada)
  checked: "Spec temporário `zz-diagnostico-refresh.spec.ts` com escuta de `request`/`response`/`requestfailed`/`console`/`pageerror`, rodando o fluxo exato do teste 1 nos DOIS projetos, --workers=1 --no-deps."
  found: "PASSOU nos dois projetos, 2,4s cada. Sequência de rede idêntica em desktop e celular: `POST /encomendas/{id}` com header `Next-Action` -> 200 `text/x-component` -> `GET /encomendas/{id}?_rsc=...` com `RSC:1` (este É o router.refresh()) -> 200. A amostra de 500ms após o clique já tinha `concluidaEm=true botao=false` nos dois. Zero `pageerror`, zero erro de console."
  implication: "O `router.refresh()` funciona e é rápido com o servidor ocioso. A hipótese de contenção NÃO morreu — sobreviveu ao critério de eliminação que estava registrado. E o caminho 'ação retorna ok -> refresh dispara' passou de leitura a medição de rede."

- timestamp: 2026-08-21 (medição 2 — tempestade de prefetch)
  checked: "Os mesmos logs de rede, contando requisições com header `Next-Router-Prefetch`."
  found: "Cada navegação dispara uma RODADA de prefetch RSC das 5 rotas da casca (`/`, `/encomendas`, `/agenda`, `/queimas`, `/estoque`), e as rodadas se REPETEM com a mesma URL e o mesmo `_rsc=` várias vezes por segundo, quase sempre terminando em `net::ERR_ABORTED` e sendo refeitas. No `/encomendas` do celular somam-se os prefetch de cada `<Link>` de cartão visível; no detalhe soma-se `/encomendas?editar={id}`. `staleTimes.dynamic` do Next 15 é 0 por padrão e TODA rota aqui é dinâmica (cookie de sessão) — nenhum desses prefetch é reaproveitado."
  implication: "O servidor Next único da suíte gasta a maior parte do trabalho re-renderizando páginas que ninguém vai ver. `/encomendas` (a mais cara: todas as encomendas da janela + itens + etapas, Gantt e lista) é a mais prefetchada. É o amplificador de carga que deixa o `router.refresh()` do detalhe faminto — e explica por que a classe de WINDOWS #12/#21 só aparece na varredura completa."

- timestamp: 2026-08-21 (medição 3 — diff desde o último verde)
  checked: "`git diff cf8c49c..HEAD` restrito a código de produção."
  found: "Só 6 arquivos de produção mudaram: `cabecalho-pagina.tsx` + `encomendas/[id]/page.tsx` (voltar, 274aa72), `cartao-encomenda.tsx`/`gantt.tsx`/`textos.ts` (contagem de itens, 0ff1b46, PURAMENTE de exibição) e `formulario-encomenda.tsx` (9a3beca). `lib/encomendas/consultas.ts` NÃO mudou: `anexarItensEEtapas` já carregava os itens. `8446d48` é só teste."
  implication: "Nenhum commit mexeu no caminho de conclusão (`trilha-etapas.tsx`, `acoes.ts`, `consultas.ts`), e a contagem de itens NÃO acrescentou consulta. A única mudança de comportamento de REDE é o `<Link href=/encomendas>` novo no cabeçalho do detalhe — um alvo de prefetch a mais da página mais cara do sistema, exatamente na página que falha."

- timestamp: 2026-08-21 (medição 4 — falha 3, por leitura de código)
  checked: "`lib/queimas/textos.ts` e a semântica de `page.getByText(string)` do Playwright."
  found: "`FRASE_SEM_MANUTENCOES = 'Sem manutenção registrada.'` (linha 52) e o toast é 'Manutenção registrada.'. `getByText` com string casa por SUBSTRING, ignorando caixa: a frase de vazio CONTÉM a frase do toast. Vale para as linhas 79 E 98. Conferido também `FRASE_SEM_QUEIMAS = 'Nenhuma queima registrada ainda.'` — NÃO colide com 'Queima registrada.' (o ponto final quebra a substring), então as 4 asserções de queima na suíte estão corretas."
  implication: "A falha 3 é um Bohrbug de localizador, provado sem rodar nada, e é causa SEPARADA das falhas 1 e 2. `exact: true` sozinho não basta (o CI mostrou dois toasts empilhados na retentativa #2) — a asserção precisa ser ancorada no contêiner do sonner."

## Eliminated

- hypothesis: "A Server Action `concluirEncomenda` falhou e o ramo de erro foi tomado."
  evidence: "Medição 1: o POST com `Next-Action` responde 200 e o `GET ...?_rsc=` do refresh sai logo depois. E `FRASE_FALHA_AO_SALVAR` ('Não deu para salvar. Verifique a internet e tente de novo.') não aparece em nenhuma das 24 amostras do CI — um toast do sonner fica 5s no DOM, tempo de sobra para ser amostrado."
  timestamp: 2026-08-21

- hypothesis: "A contagem de itens do índice (0ff1b46) acrescentou consulta ao banco e encareceu /encomendas."
  evidence: "Medição 3: `lib/encomendas/consultas.ts` não aparece no diff desde `cf8c49c`. `listarEncomendasDoIndice` já chamava `anexarItensEEtapas`, que já trazia os itens."
  timestamp: 2026-08-21

- hypothesis: "O teste 1 falha por si só, independentemente de carga (o que mataria a hipótese de contenção)."
  evidence: "Medição 1: passa isolado nos DOIS projetos, em 2,4s, com o refresh chegando em menos de 500ms."
  timestamp: 2026-08-21

- timestamp: 2026-08-21 (medição 5 — REPRODUÇÃO LOCAL da varredura completa, --workers=2, invocação e2e #2)
  checked: "`npm run test:e2e -- --workers=2` no Windows local, 6,9 min, 304 passaram / 3 falharam / 1 flaky / 33 skipped / 9 não rodaram."
  found: "REPRODUZIU — e TODAS as falhas caíram no projeto `desktop`, nenhuma no `celular`. (1) `encomendas-detalhe.spec.ts:685` [desktop], mesma asserção 'Concluída em', com o MESMO formato de amostras do CI: 1 amostra com 'Concluindo…' e 22 com 'Marcar como concluída'. (2) `encomendas-impressao.spec.ts:155` [desktop] (= WINDOWS #22). (3) `autenticacao.spec.ts:84` [desktop] (= WINDOWS #3, pré-existente). (4) `queimas-manutencao.spec.ts:55` [desktop] flaky, falhando em `lista-historico-manutencoes` com 1 li em vez de 2 DEPOIS de um `page.reload()`."
  implication: "A assimetria desktop/celular é ARTEFATO, não causa. O preset Pixel 7 é irrelevante: local reproduz o inverso exato do CI. A contra-hipótese 'por que só celular?' está eliminada por medição. O que resta é uma condição de carga que atinge QUALQUER projeto — a mesma classe já registrada em WINDOWS #3/#12/#21/#22."

- timestamp: 2026-08-21 (medição 6 — o portão falso, por observação direta)
  checked: "O `Call log` do Playwright na falha de `encomendas-detalhe.spec.ts:701`, amostra por amostra."
  found: "A PRIMEIRA amostra do `toContainText` mostra o corpo com 'Concluindo…' ainda na tela. Ou seja: a asserção ANTERIOR (`toHaveCount(0)` sobre 'Marcar como concluída', linha 697) retornou ENQUANTO a Server Action ainda estava em voo — porque durante a gravação o rótulo do botão vira 'Concluindo…', o nome acessível muda, e a contagem cai a zero no mesmo quadro do clique. O teste levou 11,7s no total = ~1,7s de preparo + exatamente 10s de polling: o portão consumiu ZERO."
  implication: "`toHaveCount(0)` é um PORTÃO FALSO — não sincroniza nada. O irmão que PASSA sob a mesma carga (`encomendas-detalhe.spec.ts:568`, cancelar) tem um portão REAL: o toast 'Encomenda cancelada.'. `concluirEncomenda` não emite toast nenhum, então o teste de concluir nunca teve portão. `concluirViaDetalhe` (encomendas-filtros.spec.ts, linhas 141-144) JÁ documenta esse engano por escrito — a spec de detalhe não aplicou a lição."

- timestamp: 2026-08-21 (medição 7 — o mesmo portão falso em queimas-manutencao)
  checked: "Falha 4 da varredura local: `lista-historico-manutencoes` com 1 li em vez de 2, DEPOIS de `page.reload()`."
  found: "A linha 98 (`getByText('Manutenção registrada.')`) é atingida poucos segundos depois da linha 79 — e o toast do sonner dura 5000ms. O toast da PRIMEIRA manutenção ainda está na tela quando a segunda é confirmada, então a asserção da linha 98 passa NA HORA, sem a segunda gravação ter chegado ao servidor. O `page.reload()` seguinte busca dados anteriores à segunda escrita, e o histórico volta com 1. É exatamente o que o CI viu como 'dois toasts empilhados' na retentativa #2."
  implication: "O mesmo padrão da medição 6, em outra spec: uma asserção que PARECE portão e retorna imediatamente. Isso confirma que a falha 3 tem DUAS causas sobrepostas (colisão de substring E portão falso), e que `exact: true` sozinho realmente não bastaria."

- timestamp: 2026-08-21 (medição 8 — o mecanismo de estagnação, candidato concreto)
  checked: "`db/index.ts`, `lib/auth/exigir-usuario.ts` e `lib/encomendas/consultas.ts`."
  found: "`new Pool({ connectionString })` SEM `max` — o padrão do node-postgres é **10** conexões, e `connectionTimeoutMillis` padrão é 0 (espera para sempre, sem erro). Cada render RSC gasta de 3 a 5 saídas do pool em SEQUÊNCIA: `exigirUsuario()` consulta o banco no layout E de novo na página (a conferência de `ativo` é por chamada, T-02a-19, deliberada), mais 3 consultas de `buscarEncomenda` (ou 3 de `listarEncomendasDoIndice`). `anexarItensEEtapas` NÃO é N+1 (usa `inArray`) — a contagem de consultas está sã."
  implication: "Com a tempestade de prefetch da medição 2 (5 a 7 renders RSC concorrentes por navegação, vezes dois workers), um pool de 10 vira fila. Uma requisição que espera no `pool.connect()` não dá erro, não dá timeout: ela simplesmente PARA — que é exatamente o sintoma de 9,5s sem nada. CANDIDATO FORTE, ainda NÃO PROVADO: não medi `pg_stat_activity` nem o tempo de espera do pool. Não mexi no pool por isso."

## Reasoning Checkpoint

reasoning_checkpoint:
  hypothesis: "Três causas, duas delas em conjunção. (A) `getByText` casa por substring e a frase de vazio contém a do toast — colisão de localizador. (B) Portões falsos: `toHaveCount(0)` sobre um botão cujo rótulo muda durante a gravação, e a reutilização de um toast de 5s que ainda está na tela. (C) Contenção do servidor Next único sob a varredura, com um pool de 10 conexões como estrangulamento candidato."
  confirming_evidence:
    - "Observação direta: a primeira amostra do `toContainText` mostra 'Concluindo…' na tela — o portão anterior retornou com a ação em voo (medição 6)."
    - "Aritmética do relógio: 11,7s de teste = 1,7s de preparo + exatamente 10s de polling; o portão consumiu zero (medição 6)."
    - "O irmão que passa sob a MESMA carga (cancelar, linha 568) tem portão real — o toast; concluir não emite toast nenhum (leitura de código + resultado da varredura)."
    - "Isolado passa nos dois projetos em 2,4s com o refresh chegando em <500ms (medição 1); sob a varredura falha (medição 5)."
    - "`FRASE_SEM_MANUTENCOES` ('Sem manutenção registrada.') contém literalmente 'Manutenção registrada.' (medição 4)."
  falsification_test: "A instrumentação de rede acrescentada ao teste de detalhe. Se o `GET ...?_rsc=` do refresh SAI e a resposta NÃO volta em 10s, é fome de servidor (ambiente). Se a resposta volta rápido e a tela não muda, é defeito de cliente/React (produto). Se a requisição nunca sai, o ramo `ok` da ação não foi alcançado e toda a leitura acima está errada."
  fix_rationale: "As correções aplicadas atacam causas provadas por observação, não sintomas: o localizador ancorado no contêiner do sonner elimina a ambiguidade estrutural (dois elementos e dois toasts) em vez de mascarar; os portões passam a ser a resposta da Server Action, que é o único sinal que não existe antes da escrita. Nenhum timeout foi aumentado e nenhuma asserção foi trocada por espera frouxa."
  blind_spots: "Não medi o pool de conexões nem `pg_stat_activity`. Não medi se a tempestade de prefetch é reaproveitada pelo Next (prefetch parcial até o `loading.tsx` PODE ser útil). Não sei ainda se o refresh estagna no servidor ou no cliente — é o que a instrumentação vai dizer."
  candidate_causes:
    - "código/teste: portão falso em `toHaveCount(0)` e no toast reusado (categoria: código de teste)"
    - "código/teste: `getByText` por substring colidindo com a frase de vazio (categoria: código de teste)"
    - "configuração: pool de 10 conexões sem `max` nem `connectionTimeoutMillis` (categoria: configuração)"
    - "ambiente: servidor Next único compartilhado por 2 workers e ~340 testes (categoria: ambiente)"
    - "dados: banco cresce durante a varredura; `/encomendas` fica mais caro a cada teste (categoria: dados)"
  and_gate: "SIM para as falhas 1 e 2 — exigem DUAS condições ao mesmo tempo. O portão falso sozinho é inofensivo (isolado passa). A contenção sozinha é sobrevivível (o irmão cancelar, com portão real, passa sob a mesma carga). Só a conjunção quebra. Para a falha 3 o AND também vale: colisão de substring E portão falso de toast, cada uma capaz de derrubar o teste por conta própria em momentos diferentes."

- timestamp: 2026-08-21 (medição 9 — primeira varredura de verificação, invocação e2e #3)
  checked: "Varredura completa local --workers=2 com as correções de portão e de localizador aplicadas."
  found: "317 passaram, 0 falharam, 0 flaky, 33 skipped, 6,0 min. MAS: `autenticacao.spec.ts:84` e `encomendas-impressao.spec.ts:155` — que eu NÃO toquei — também passaram, e tinham falhado na invocação #2. A execução foi 0,9 min mais curta."
  implication: "Verde, mas CONFUNDIDO: parte da melhora pode ser só uma execução menos carregada. Para uma falha dependente de carga, uma varredura verde não é prova. E a instrumentação só imprimia em caso de falha, então não colheu número nenhum. Verificação INCONCLUSIVA nesta rodada — falta medir a folga."

- timestamp: 2026-08-21 (medição 10 — A LATÊNCIA REAL DO REFRESH SOB CARGA, invocação e2e #4)
  checked: "Varredura completa local --workers=2 com instrumentação de rede imprimindo SEMPRE (não só na falha), medindo o intervalo entre o clique, a resposta da Server Action e a resposta do `router.refresh()`."
  found: "desktop: `acao=388ms refresh=97ms` — POST em +360ms, 200 em +389ms, GET do refresh em +394ms, 200 em +410ms. celular: `acao=374ms refresh=37ms` — POST +361ms, 200 +376ms, refresh +380ms, 200 +391ms. Ida e volta do refresh: cerca de 15ms de rede."
  implication: "ISTO DERRUBA A HIPÓTESE PRINCIPAL DA SESSÃO. Sob a varredura completa, com dois workers, o `router.refresh()` volta em 37-97ms contra um orçamento de 10.000ms — de 100 a 270 vezes de folga. O servidor NÃO está lento. Portanto o rótulo 'contenção de servidor Next único compartilhado', que WINDOWS #12/#21/#22 carrega desde a Fase 3 e que esta sessão herdou como hipótese principal, está ERRADO. A parada de 9,5s do run vermelho não foi lentidão: foi um evento BINÁRIO — o refresh se perdeu, ou voltou com árvore velha. Lentidão gradual não produz 22 amostras idênticas e depois nada."

- timestamp: 2026-08-21 (medição 11 — o elenco rotativo)
  checked: "Comparação das três varreduras completas locais desta sessão."
  found: "#2 (antes das correções): falharam `encomendas-detalhe:685`, `autenticacao:84`, `encomendas-impressao:155` (todas desktop) + `queimas-manutencao:55` flaky. #3 (depois): 0 falhas. #4 (depois, instrumentada): 1 falha NOVA, `queimas-registro.spec.ts:84` [celular], estourando os 30s do teste esperando o botão 'Desfazer' — que mora num toast de 7s de vida, alcançado só DEPOIS de uma asserção de contador com orçamento de 10s."
  implication: "A cada execução falha um teste DIFERENTE, e sempre pela mesma assinatura: uma espera pós-mutação que consome o tempo de vida da própria affordance que o passo seguinte precisa (um toast), ou que finge sincronizar sem sincronizar. As três falhas do CI eram uma AMOSTRA dessa população, não uma regressão específica dos quatro commits. `queimas-registro:84` é um defeito latente da mesma classe, fora do conjunto do CI — candidato a WINDOWS, não corrigido aqui para não inflar o escopo."

- timestamp: 2026-08-21 (medição 12 — CAUSA RAIZ CAPTURADA, invocação e2e #5)
  checked: "Estresse dirigido: `--grep 'concluir uma encomenda cuja data já passou' --repeat-each=15 --workers=4 --no-deps` = 30 amostras do caminho exato, com a instrumentação de rede imprimindo sempre."
  found: "Distribuição BIMODAL. 29 amostras com o refresh entre 35ms e 256ms. UMA amostra em 10028ms — ou seja, nunca chegou. E o traço de rede dessa amostra é o achado da sessão: `+370ms REQ POST ACTION` / `+388ms RES 200 POST` / `+405ms REQ GET REFRESH` / `+424ms FAIL POST net::ERR_ABORTED` / `+428ms RES 200 GET`. O servidor respondeu TUDO: a ação em 18ms e o refresh em 23ms. O navegador RECEBEU as duas respostas — e a tela mesmo assim nunca mudou, por mais 10 segundos."
  implication: "Não é lentidão, não é contenção, não é o pool, não é o preset do celular. É uma CORRIDA NO CLIENTE. A resposta da Server Action já carrega a árvore re-renderizada (o Next atualiza a rota atual sozinho depois de uma Server Action com `revalidatePath`). O `router.refresh()` da linha 128 de `trilha-etapas.tsx` dispara um SEGUNDO refresh 17ms depois, e o stream da ação é ABORTADO (`FAIL POST` em +424) antes de o React terminar de aplicar a árvore que já tinha chegado. A resposta do segundo refresh chega 4ms depois do aborto e é descartada junto. As duas atualizações se perdem. Nas 29 amostras boas o aborto cai DEPOIS da aplicação, e por isso passam. O `router.refresh()` não é só redundante — ele DESTRÓI a atualização que a própria ação já tinha entregue."

- timestamp: 2026-08-21 (medição 13 — HIPÓTESE DERRUBADA, invocação e2e #6)
  checked: "Experimento de produção: removi o `router.refresh()` de `trilha-etapas.tsx` e rodei 60 amostras do mesmo caminho (`--repeat-each=30 --workers=4`), para testar a leitura da medição 12 de que o refresh explícito era redundante e destrutivo."
  found: "PIOROU CINCO VEZES. 10 falhas em 60 (16,7%) contra 1 em 30 (3,3%) com o `router.refresh()` no lugar. Distribuição: mediana de 50ms, mas dez amostras em ~10.000ms (nunca chegaram)."
  implication: "A leitura da medição 12 estava ERRADA na parte causal. A atualização automática que o Next faz depois de uma Server Action com `revalidatePath` NÃO é confiável nesta configuração — o `router.refresh()` explícito é o mecanismo PRINCIPAL de atualização, não um concorrente redundante. O padrão de `04-PATTERNS.md` está certo. O aborto do stream da ação visto no traço é consequência, não causa. Código de produção REVERTIDO — `git diff` de `components/`, `app/` e `lib/` está vazio."
  timestamp_reversao: "2026-08-21 — nenhuma linha de produção alterada nesta sessão."

- timestamp: 2026-08-21 (medição 14 — RISCO RESIDUAL das correções de teste, invocação e2e #7)
  checked: "Com as três correções de portão/localizador aplicadas e a instrumentação removida: 50 amostras do caminho de conclusão em concorrência de CI (`--repeat-each=25 --workers=2`)."
  found: "3 falhas em 50 (6%). Duas no `desktop`, uma no `celular`."
  implication: "As correções de teste NÃO bastam. Elas removem defeitos determinísticos reais (e devem ficar), mas a causa dominante é o canal com perda do `router.refresh()`. Honestidade obriga: dizer 'corrigido' aqui seria falso. E os 6% não são só um problema de CI — são a taxa em que uma gestora conclui uma encomenda no celular e a tela continua dizendo 'Marcar como concluída', sem erro nenhum. É defeito de produto, no caminho do Core Value."

- timestamp: 2026-08-21 (medição 15 — a taxa dos dois canais)
  checked: "Comparação das três configurações medidas no mesmo caminho."
  found: "Com `router.refresh()` e sem estado confirmado: 1/30 a 4 workers, 3/50 a 2 workers (~6%). SEM `router.refresh()` (só a atualização automática da Server Action): 10/60 (~17%). Os dois canais perdem."
  implication: "Nem a atualização automática pós-Server-Action nem o `router.refresh()` são confiáveis isoladamente nesta configuração; juntos ainda perdem ~6%. A correção certa não é escolher um canal melhor — é não depender de canal nenhum para o dado que a ação JÁ devolveu. `concluirEncomenda` retorna `{ nome, dataDeConclusao }`: o cliente pode fechar a tela com isso, que é exatamente o padrão não-otimista que `AjusteRapidoEtapa` já usa nesta mesma tela (03-UI-SPEC.md)."

- timestamp: 2026-08-21 (medição 16 — VERIFICAÇÃO DA CORREÇÃO DE RAIZ, invocação e2e #8)
  checked: "Com `trilha-etapas.tsx` fechando a tela a partir da resposta confirmada da Server Action: as MESMAS 50 amostras, na MESMA configuração que acabara de dar 3 falhas (`--repeat-each=25 --workers=2 --no-deps`)."
  found: "50 de 50 passaram. Zero falhas, contra 3 em 50 imediatamente antes, sem nenhuma outra diferença."
  implication: "A correção não depende de sorte de rede: as duas asserções que falhavam ('Concluída em' e o botão sumir) agora são função de estado React posto de forma síncrona a partir de dado que o servidor JÁ confirmou. Não há mais canal com perda no caminho delas — não é que a corrida ficou mais rara, é que ela deixou de existir para esse dado. O `router.refresh()` continua no lugar para o resto da árvore."

- timestamp: 2026-08-21 (medição 17 — varredura completa final, invocação e2e #9)
  checked: "`npm run test:e2e -- --workers=2`, suíte inteira, com todas as correções."
  found: "316 passaram, 1 falhou, 33 skipped, 6,9 min. A única falha é `autenticacao.spec.ts:84` — que é WINDOWS #3, registrado como pré-existente desde a Fase 2b ('Sexta tentativa de bloqueio trava/estoura timeout de forma pre-existente, independente da 02b-03'). Ela também falhou na varredura #2, ANTES de qualquer mudança minha, e NÃO estava entre as falhas do CI que abriram esta sessão. Local roda com `retries: 0`; o CI tem 2 retentativas, e neste teste o CI passou."
  implication: "As TRÊS falhas do CI estão verdes na varredura completa. Nenhuma regressão: os 316 incluem todo o `desktop` e todo o `celular`."

- timestamp: 2026-08-21 (medição 18 — CICLO 2, o defeito da revisão conferido por conta própria, sem rodar nada)
  checked: "Não aceitei o achado do especialista de graça: li `components/amassa/encomendas/acoes-encomenda.tsx`, `lib/encomendas/acoes.ts` e `app/(app)/encomendas/[id]/page.tsx` para conferir a alcançabilidade da sequência concluir → cancelar."
  found: "CONFIRMADO, nos três arquivos. (1) `AcoesEncomenda` (linhas 40-47) renderiza 'Cancelar encomenda' SEM nenhuma condição de status — nem `podeConcluir`, nem nada. (2) `cancelarEncomenda` (acoes.ts:227-231) é `update ... set status='cancelada'` com `where eq(id)` e NENHUMA guarda de status: funciona numa encomenda já concluída e devolve `ok`. (3) `AcoesEncomenda` e `TrilhaEtapas` são IRMÃOS na mesma página (page.tsx:50 e :58), sem estado compartilhado — o cancelamento não tem como avisar a trilha. E `ConfirmarCancelar` fecha com `router.refresh()` (linha 54), que re-renderiza sem REMONTAR: a trava sobrevive."
  implication: "O defeito é real e alcançável por uma gestora, na mesma tela, sem recarregar nada: concluir, mudar de ideia, cancelar — e a trilha continuaria dizendo 'Concluída em …' numa encomenda cancelada. É a mesma classe de mentira silenciosa que a trava existe para matar, só que ao contrário. Fechado neste ciclo."

- timestamp: 2026-08-21 (medição 19 — a guarda ESCOLHIDA não é a que o especialista sugeriu, e por quê)
  checked: "`grep` por toda escrita de `encomendas.status` em `lib/`, `app/` e `components/`."
  found: "O sistema INTEIRO escreve `status` em exatamente DOIS lugares: `acoes.ts:229` ('cancelada') e `acoes.ts:259` ('concluida'). Ambos são estados finais. NADA devolve uma encomenda para 'em_producao' ou 'rascunho' — nem o formulário de edição, que não toca em `status`."
  implication: "Isso permite uma guarda ESTRITAMENTE mais segura que o `statusVisto !== status` genérico sugerido pela revisão. A guarda genérica solta a trava a QUALQUER mudança de prop — inclusive uma resposta ATRASADA, emitida antes da gravação, que ainda diz 'em_producao': ela soltaria a trava e a tela voltaria a mentir, que é exatamente o defeito. A guarda que usei solta só quando a prop chega num estado FINAL ('concluida' ou 'cancelada'), o que é monotônico (só anda no sentido da verdade) e, pela contagem acima, cobre TODA transição alcançável pós-conclusão. Bônus: dispensa o `useState(statusVisto)` — é uma variável de estado a menos, não a mais."

- timestamp: 2026-08-21 (medição 20 — verificação dirigida do ciclo 2, invocação e2e #10)
  checked: "`--grep 'cancelar DEPOIS de concluir|concluir uma encomenda cuja data já passou' --repeat-each=10 --workers=2 --no-deps` = 40 amostras, 20 do caminho de conclusão e 20 da sequência concluir→cancelar, nos dois projetos."
  found: "40 de 40 passaram, 1,7 min. Mediana de ~1,8s por amostra. UMA amostra (a #35, celular) levou 12,3s — passou, mas destoa."
  implication: "As duas coisas que precisavam ser provadas juntas estão provadas: a soltura FUNCIONA (a trilha vira 'Cancelada' em 20 de 20) e NÃO quebrou a correção de raiz (20 de 20 no caminho de conclusão). O `setState` na renderização também está descartado como laço infinito — 40 amostras verdes o teriam pegado na primeira. HONESTIDADE sobre a amostra #35: NÃO instrumentei essa execução, então não sei em qual passo os ~10,5s extras foram gastos (login, criação, conclusão ou o refresh do cancelamento). Não vou atribuí-la a nada sem medir. O que dá para dizer com evidência é que o caminho de CANCELAMENTO não tem trava de estado confirmado — ele depende inteiro do `router.refresh()`, o canal com perda — e que a suíte JÁ carregava uma amostra dessa exposição (encomendas-detalhe.spec.ts:568, `toContainText('Cancelada', 10000)` depois do mesmo portão de toast). O novo teste dobra essa amostragem de 1 para 2 por projeto. É risco conhecido, já registrado no ledger como plano próprio para os outros 10 pontos de `router.refresh()` — não um risco novo criado aqui."

- timestamp: 2026-08-21 (medição 21 — varredura completa do ciclo 2, invocação e2e #11)
  checked: "`npm run test:e2e -- --workers=2`, suíte inteira, com a soltura da trava, o `data-testid` da linha de situação e o novo teste de regressão."
  found: "319 passaram, 0 falharam, 0 flaky, 33 skipped, 6,2 min. A conta bate exatamente: a varredura #9 rodou 317 testes (316 verdes + 1 vermelho) e o teste novo acrescenta 2 (um por projeto) = 319. `autenticacao.spec.ts:84` (WINDOWS #3), que falhou nas varreduras #2 e #9, passou desta vez — confirmando o caráter intermitente já registrado desde a Fase 2b."
  implication: "Zero regressões em toda a suíte, incluindo as specs que concluem encomendas fora do `--grep` da invocação #10 (`encomendas-filtros` via `concluirViaDetalhe`, `encomendas-indice`, o teste D-06). Rodei a varredura completa mesmo com o orçamento apertado porque este é o último portão antes de devolver ao humano num assunto que BLOQUEIA deploy, e é exatamente o que o CI vai fazer — 6,2 min é barato contra outro ciclo de CI vermelho. Total da sessão: 11 invocações de e2e."

## Specialist Review

Revisão de especialista TypeScript/React 19/Next.js 15 sobre o conserto **ainda não commitado** de
`trilha-etapas.tsx`. Veredito: **SUGGEST_CHANGE** — a direção está certa, mas há um desync alcançável.

**Direção confirmada.** Ler o estado confirmado da promessa resolvida da Server Action é o único
canal de entrega confiável aqui. Reforço decisivo: `concluirEncomenda` **já chama**
`revalidatePath("/encomendas/[id]", "page")` (linhas 274-275). Ou seja, "mover a revalidação para
dentro da Server Action" não é uma opção inexplorada — já está lá e é comprovadamente insuficiente.
Isso é o argumento mais forte de que o conserto é correção, não contorno.

**Alternativas idiomáticas descartadas com razão.** `useOptimistic` **reintroduziria exatamente o
bug**: seu valor é descartado quando a transição assenta, revertendo para a prop — e se o que se
perde é o payload do refresh, a reversão cai na prop velha mostrando "Marcar como concluída" (além
de violar a regra não-otimista do projeto). `useActionState` guardaria o mesmo estado com mais
reestruturação e zero ganho de entrega. `startTransition` em volta do `router.refresh()` é
agendamento — não torna a entrega confiável.

**Defeito alcançável, a corrigir antes do commit — a trava nunca é liberada.**
`AcoesEncomenda` renderiza "Cancelar encomenda" sem porta de status, e `cancelarEncomenda` é um
`update ... set status='cancelada'` sem guarda: ele funciona numa encomenda já concluída. Sequência:
concluir (trava armada) → cancelar → toast "Encomenda cancelada." → `router.refresh()` **chega** com
`status:"cancelada"` → `TrilhaEtapas` continua mostrando "Concluída em …", porque `conclusaoConfirmada`
vence e o refresh não remonta o componente. É a mesma classe de mentira que o conserto existe para
matar, só que mais estreita.

Correção mínima sugerida (padrão React "ajustar estado quando uma prop muda", sem levantar estado —
`ConfirmarCancelar` é irmão e não compartilha estado):

```
const [statusVisto, setStatusVisto] = useState(status);
if (statusVisto !== status) { setStatusVisto(status); setConclusaoConfirmada(null); }
```

Os três casos passam a se comportar: refresh perdido → prop não muda → trava segura (bug segue
consertado); refresh chega "concluida" → trava libera, props concordam; refresh chega "cancelada" →
trava libera, a verdade vence. Seguro porque as leituras acontecem depois da escrita commitada num
único primário Postgres, então um payload não pode chegar dizendo `em_producao`.

**Observações menores, não bloqueantes:**

- A chamada a `situacaoEm` é segura mas hoje é no-op: com status `"concluida"` ela retorna na linha
  260 antes de tocar `hoje` ou `faixas`. Manter mesmo assim — passar pelo módulo puro honra a regra
  de regras de negócio fora do componente.
- Terceira cópia da "data de conclusão" dentro do mesmo componente: depois de concluir, os seis
  `AjusteRapidoEtapa` seguem renderizados e `aoConfirmar` atualiza `dataDeConclusao` (linha 106) mas
  não `conclusaoConfirmada.dataDeConclusao` — rodapé e linha de situação podem imprimir datas
  diferentes. Deriva pré-existente, piorada em um grau. Baixa severidade; vale um comentário ou
  fechar os controles de ajuste quando `!podeConcluir`.
- Reúso de instância por `encomendaId` **não** é alcançável hoje (o App Router remonta a subárvore
  na troca do segmento dinâmico), mas fica a uma refatoração de distância: se o detalhe virar rota
  interceptada/modal ou o id migrar para search param, a trava acompanha o usuário para outra
  encomenda.
- Confirma o achado do ledger: este é um remendo por ponto de chamada sobre uma fraqueza estrutural
  do `router.refresh()`. `confirmar-cancelar.tsx` é o gêmeo mais exposto — mesma página, mesma
  transição terminal, mesma mentira silenciosa.

## Resolution

root_cause: |
  Três causas, e as duas primeiras em CONJUNÇÃO (o AND-gate disparou).

  (1) CAUSA DOMINANTE, de PRODUTO — `router.refresh()` é um canal COM PERDA. Depois de
  `concluirEncomenda`, `trilha-etapas.tsx` dependia de `router.refresh()` para a tela refletir o
  novo status. Medido: em 3 de 50 conclusões sob dois workers (~6%), o servidor responde 200 ao
  refresh em ~23ms, o navegador RECEBE a resposta, e a árvore nunca é aplicada — a tela fica
  mentindo para sempre, mostrando "Marcar como concluída" numa encomenda já concluída, sem erro,
  sem toast, sem retentativa. O traço de rede da amostra perdida é literal: `RES 200 POST` em
  +388ms, `REQ GET REFRESH` em +405ms, `FAIL POST net::ERR_ABORTED` em +424ms, `RES 200 GET` em
  +428ms — e mais 10 segundos de nada. Não é lentidão: as outras 29 amostras chegaram entre 35 e
  256ms. É um evento BINÁRIO de perda, no cliente.

  (2) PORTÕES FALSOS nos testes. `toHaveCount(0)` sobre "Marcar como concluída" não sincroniza
  nada: durante a gravação o rótulo do botão vira "Concluindo…", o nome acessível muda, e a
  contagem cai a zero no mesmo quadro do clique. Provado por observação direta — a primeira
  amostra do `toContainText` seguinte ainda mostrava "Concluindo…". O mesmo padrão em
  `queimas-manutencao.spec.ts:98`, que reusava um toast de 5s ainda na tela como se fosse prova
  da SEGUNDA gravação, fazendo o `page.reload()` seguinte ler o banco antes dela.

  (3) COLISÃO DE LOCALIZADOR. `page.getByText("Manutenção registrada.")` casa por SUBSTRING, e
  `FRASE_SEM_MANUTENCOES` = "Sem manutenção registrada." contém a frase do toast — dois elementos,
  strict mode estoura. `exact: true` sozinho não resolveria (dois toasts podem coexistir).

  NÃO era contenção de servidor. NÃO era o pool de conexões. NÃO era o preset Pixel 7.

fix: |
  CICLO 1 — o canal de entrega:

  - `components/amassa/encomendas/trilha-etapas.tsx`: a tela passa a fechar a conclusão a partir
    da RESPOSTA CONFIRMADA da Server Action (`resposta.dados.dataDeConclusao`), derivando a
    `Situacao` pelo módulo puro `situacaoEm` — o mesmo padrão não-otimista que `AjusteRapidoEtapa`
    já usa nesta mesma tela (03-UI-SPEC.md). `router.refresh()` CONTINUA no lugar para o resto da
    árvore: medido, removê-lo piora cinco vezes (10 falhas em 60).

    Correção de uma suposição da revisão: a chamada a `situacaoEm` NÃO é no-op. Com status
    "concluida" ela devolve `{ tipo: "concluida", dataDeConclusao: cronograma.dataDeConclusao }`
    (cronograma.ts) — é justamente por ela que a data devolvida pela ação chega ao texto
    "Concluída em …". O que ela não toca é `hoje` e `faixas`, só isso. A chamada é carregadora,
    não decorativa.

  - `tests/e2e/encomendas-detalhe.spec.ts`: o portão falso vira a resposta da Server Action.
  - `tests/e2e/encomendas-filtros.spec.ts`: `concluirViaDetalhe` separa "o clique não pegou"
    (corrida de hidratação, merece novo clique) de "a gravação foi, o refresh não voltou" (não
    merece clique nenhum) — antes clicava de novo às cegas.
  - `tests/e2e/queimas-manutencao.spec.ts`: localizador ancorado no contêiner do sonner, e a
    segunda manutenção ganha portão real.

  CICLO 2 — a trava agora SOLTA (defeito alcançável apontado pela revisão, conferido por leitura
  independente na medição 18 antes de ser aceito):

  - `components/amassa/encomendas/trilha-etapas.tsx`: ajuste de estado na renderização (padrão
    React de "ajustar estado quando uma prop muda", nunca em efeito):

        if (conclusaoConfirmada && (status === "concluida" || status === "cancelada")) {
          setConclusaoConfirmada(null);
        }

    A guarda é "a prop chegou num estado FINAL", e NÃO o `statusVisto !== status` genérico que a
    revisão sugeriu. Isso é deliberado, e é uma correção da sugestão, não uma cópia dela: a
    guarda genérica solta a trava a QUALQUER mudança de prop, inclusive uma resposta ATRASADA
    (emitida antes da gravação) que ainda diz "em_producao" — e nesse caso a tela volta a mentir,
    que é o defeito de novo. A guarda usada é monotônica, só anda no sentido da verdade, e cobre
    TODA transição alcançável pós-conclusão, porque o sistema inteiro escreve `status` em dois
    lugares só, ambos finais (medição 19). Efeito colateral bom: dispensa o `useState(statusVisto)`
    da sugestão — é uma variável de estado a MENOS, não a mais.

  - `components/amassa/encomendas/trilha-etapas.tsx`: `data-testid="situacao-encomenda"` na linha
    de situação, para a regressão poder afirmar o texto EXATO daquele elemento (`toHaveText`) em
    vez de caçar substring no `body` inteiro — onde o toast "Encomenda cancelada." e o rodapé
    "Conclusão prevista" moram junto e deixariam a asserção passar pelo motivo errado.

  - `tests/e2e/encomendas-detalhe.spec.ts`: teste de regressão novo — "cancelar DEPOIS de
    concluir: a trilha diz 'Cancelada', a trava de conclusão solta". Portão real de conclusão (a
    resposta da ação), depois o cancelamento, depois `toHaveText("Cancelada")` exato na linha de
    situação. Falha se a trava prender.

  NÃO corrigido, de propósito (nota (b) da revisão — a deriva das três cópias da data): depois de
  concluir, as seis `AjusteRapidoEtapa` seguem na tela e `aoConfirmar` atualiza o `useState` do
  rodapé sem tocar na linha de situação, então as duas podem imprimir datas diferentes. Escolhi
  COMENTAR a deriva no arquivo em vez de fechar os controles quando `!podeConcluir`, por dois
  motivos. (1) Fechá-los é mudança de comportamento de PRODUTO — passa a proibir corrigir a
  duração de uma etapa numa encomenda encerrada —, decisão do dono, não conserto de defeito, e
  não cabe num debug sob pressão de deploy. (2) Conferido que a trava NÃO piora a deriva: ela
  nasce com o mesmo valor do rodapé (as duas vêm do mesmo `calcularCronograma` sobre as mesmas
  linhas do banco) e se solta assim que a árvore do servidor chega. A causa real é anterior e
  estrutural — `duracaoTotalEmDias` e `dataDeConclusao` são `useState(prop)` semeados uma vez, que
  nenhum refresh ressincroniza. Registrada no ledger.

verification: |
  CICLO 1 (canal de entrega):
  - Correção de raiz: 50 de 50 amostras verdes na MESMA configuração que dera 3 falhas em 50
    minutos antes (`--repeat-each=25 --workers=2 --no-deps`).
  - Varredura completa: 316 passaram, 1 falhou — e essa é WINDOWS #3, pré-existente,
    reproduzida ANTES das mudanças e ausente do conjunto de falhas do CI.
  - Experimento de falsificação executado e REVERTIDO: remover `router.refresh()` piora para
    10/60. A hipótese "o refresh explícito é redundante e destrutivo" foi testada e derrubada.

  CICLO 2 (soltura da trava):
  - Invocação e2e #10, dirigida: 40 de 40 verdes em 1,7 min — 20 amostras de concluir→cancelar
    (a soltura funciona: a trilha vira "Cancelada" em 20 de 20) e 20 do caminho de conclusão (a
    correção de raiz sobreviveu). Descarta também laço infinito de renderização no `setState`
    durante a render: 40 amostras verdes o teriam pegado na primeira.
  - Invocação e2e #11, varredura completa (`--workers=2`): 319 passaram, 0 falharam, 0 flaky,
    33 skipped, 6,2 min. A conta bate exatamente: 317 testes rodados na varredura anterior + 2 do
    teste novo (um por projeto) = 319. `autenticacao.spec.ts:84` (WINDOWS #3) passou desta vez,
    confirmando o caráter intermitente registrado desde a Fase 2b.
  - `npm run verificar` completo (lint, tsc --noEmit, verificar-acoes, 432 testes unitários,
    test:migracoes): EXIT=0. Nota de leitura: a linha "1 violação(ões) em 1 ação(ões) conferida(s)"
    na saída vem do fixture de `tests/unit/verificar-acoes.test.ts`, não do código de produção —
    `npm run verificar-acoes` isolado dá "17 ação(ões) conferida(s), 0 violações", EXIT=0.
  - NÃO reexecutei a campanha de 50 amostras do ciclo 1, de propósito: a soltura só pode disparar
    quando a árvore do servidor CHEGA, e o caso que a campanha mede é exatamente aquele em que
    ela NÃO chega (a prop nunca vira "concluida", a trava segura). Repetir 50 amostras mediria de
    novo o que já está medido. As 20 amostras da invocação #10 servem de checagem de regressão: à
    taxa pré-correção de 6%, 20 amostras esperariam ~1,2 falha, e deram zero.

  Limites honestos desta verificação:
  - Uma amostra das 40 da invocação #10 (a #35, celular) levou 12,3s contra uma mediana de ~1,8s.
    Passou. NÃO instrumentei essa execução, então não sei em qual passo o tempo foi gasto e não
    vou atribuí-la a nada sem medir.
  - Nenhuma destas medições cobre o caminho de CANCELAMENTO isolado, que segue 100% dependente do
    `router.refresh()` (sem trava de estado confirmado) e portanto mantém a exposição de ~6% já
    registrada no ledger para os outros 10 pontos de refresh.
  - Total de invocações de e2e na sessão: 11.

files_changed:
  - components/amassa/encomendas/trilha-etapas.tsx
  - tests/e2e/encomendas-detalhe.spec.ts
  - tests/e2e/encomendas-filtros.spec.ts
  - tests/e2e/queimas-manutencao.spec.ts

oracle_type: specified

achados_para_o_ledger:
  - "Os outros 10 pontos de `router.refresh()` (`confirmar-cancelar`, `registrar-queima` x2, `registrar-manutencao`, `acoes-forno` x2, `formulario-encomenda`, `formulario-forno`, `confirmar-excluir-queima`) têm a MESMA exposição de ~6% e NÃO foram corrigidos aqui — merecem plano próprio, não um debug sob pressão de deploy."
  - "`tests/e2e/queimas-registro.spec.ts:84` espera até 10s pelo contador ANTES de clicar em 'Desfazer', que mora num toast de 7s de vida. Defeito latente da mesma classe, apareceu numa das varreduras. Fora do conjunto do CI."
  - "WINDOWS #12/#21/#22 estão rotulados como 'contenção de servidor Next único'. A medição desta sessão mostra que esse rótulo está ERRADO: sob a varredura, o refresh volta em 37-97ms. O rótulo deve ser corrigido para 'perda de atualização no roteador do cliente'."
  - "Tempestade de prefetch: cada navegação refaz o prefetch RSC das 5 rotas da casca, repetidamente e quase sempre abortado, porque `staleTimes.dynamic` do Next 15 é 0 e toda rota aqui é dinâmica. Custo de servidor e de dados móveis por zero benefício — merece investigação própria."
  - "`cancelarEncomenda` (acoes.ts:227-231) é um `update ... set status='cancelada'` SEM guarda de status: cancela uma encomenda já concluída e devolve `ok`. E `AcoesEncomenda` mostra 'Cancelar encomenda' sem porta de status nenhuma. Neste ciclo tratei só a CONSEQUÊNCIA na interface (a trilha agora conta a verdade); a pergunta de produto — cancelar uma encomenda já concluída deveria ser possível? — é do dono, e a guarda no servidor, se a resposta for 'não', é plano próprio."
  - "`TrilhaEtapas` guarda `duracaoTotalEmDias` e `dataDeConclusao` como `useState(prop)` semeados UMA vez: nenhum `router.refresh()` os ressincroniza, porque o componente não remonta. Depois de concluir, as seis `AjusteRapidoEtapa` continuam ativas e podem fazer o rodapé imprimir uma 'Conclusão prevista' que discorda da linha de situação. Deriva pré-existente e estrutural, comentada no arquivo e NÃO corrigida aqui — fechar os controles de ajuste quando `!podeConcluir` é decisão de produto."
  - "O teste novo 'cancelar DEPOIS de concluir' assere sobre o caminho de CANCELAMENTO, que não tem trava de estado confirmado e depende inteiro do `router.refresh()`. Ele herda a exposição de ~6% do canal com perda, igual ao teste irmão que já existia (encomendas-detalhe.spec.ts:568) — a suíte passa de 1 para 2 amostras dessa exposição por projeto. Some quando o plano dos 10 pontos de `router.refresh()` alcançar `confirmar-cancelar.tsx`."
