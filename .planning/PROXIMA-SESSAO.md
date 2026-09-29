# Próxima sessão — ATUALIZADO em 2026-09-29 (tarde, portão da Fase 06 aprovado)

> **🟢 ATUALIZAÇÃO DE 29/09/2026, FIM DA TARDE — A FASE 06 (ESTOQUE) ESTÁ CONCLUÍDA E NO AR.**
> Como sei: verificação da fase `passed`, 30 de 30 (`.planning/phases/06-estoque/06-VERIFICATION.md`,
> commit `2ed2d0b`); portão 06-11 aprovado pelo Theo no chat; `phase.complete` no ROADMAP; produção
> em `2345850` (run `36587755269` verde, `/api/health/estoque` 200). Os blocos abaixo que dizem
> "próximo: verificação da fase" foram superados. Três commits só de documentos no `main` local
> esperam o `push` do Theo (`32ebdfd`, `2ed2d0b`, `af142f0`).
>
> **Próximo:** item 5 da fila (Produção) e/ou 6 (Agenda) — fases ainda por criar. O Theo já confirmou
> para a Produção: "pode sim zerar todos os dados. nada é real ainda." (29/09). Pendências pequenas
> e as 7 observações do Cowork estão em Pending Todos do `STATE.md`.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, TARDE — O ESTOQUE ESTÁ NO AR E O PORTÃO FOI APROVADO.** Você fez o
> Roteiro 15 e a caminhada e aprovou no chat ("repassei toda verificação. o cowork tambem verificou.
> Aprovado."). O plano 06-11 está concluído; os 11 planos da fase também. **Próximo: a verificação
> da fase e o `phase.complete`** (do orquestrador — nada depende de você para isso).
>
> **Como sei:**
> - **Produção em `2345850`** (o merge da fase): `git ls-remote origin refs/heads/main` =
>   `234585063890…` (16:15 UTC); run `36587755269` verde; `/api/health/estoque` 200
>   `{"status":"ok"}`; a `0023` conferida no banco pelo SQL que você colou (Passo 5).
> - **Cowork** verificou em produção (`Claude outputs/estoque/VERIFICACAO-COWORK-06.md`): 19 passos,
>   nenhum 🔴, 7 observações que não bloqueiam — em `.planning/STATE.md`, Pending Todos.
> - **EST-01..21 marcados** em `REQUIREMENTS.md`, com a evidência de cada um; o EST-09 (< 15 s) só
>   pela sua aprovação, porque os tempos não vieram.
>
> **O que fica com você, sem pressa:**
> 1. **Terminar a contagem inicial**, se ainda não terminou: às 12h46 o Cowork viu "2 de 7 contados
>    hoje" — só o "Bolo do dia" era seu. `/gestao/estoque/contagem`.
> 2. **As decisões `[auto]`** das §0.3/§0.4/§0.5 de `06-VERIFICACAO-HUMANA.md` — valem como estão até
>    você pedir troca. O Cowork destacou perda paga por Peças (D-14), saldo negativo dentro de
>    "Acabando" (D-21) e material desativado nunca avisar.
> 3. **Custo vazio na entrada manual** recusa (zero digitado aceita) — está certo assim?
> 4. **"Andressa salvou às 15h45"** nas Anotações do Início às 13h de Brasília — hora em UTC ou data
>    faltando? Confira com ela.
> 5. **O `push` deste fechamento** (só documentos em `.planning/`) é seu, quando quiser.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, MANHÃ (~09h30 UTC) — PARTE 0 RESPONDIDA E APLICADA. O PRÓXIMO PASSO
> É O ROTEIRO 15.** Você respondeu a Parte 0 no chat, por formulário: **D-23 vale, D-24 vale, WR-01 e
> WR-02 pela alternativa, D-29 sim ("Produção da casa", área Peças).**
>
> **Como sei (medido nesta manhã):**
> - **Código (WR-01, WR-02):** `f05c373` no branch `gsd/phase-06-estoque` — estorno de venda com
>   saldo zero ou negativo volta ao custo médio do instante; estorno de venda não conta como "última
>   entrada com preço". **Migração (D-29):** `b13d300` — a semente idempotente no fim da `0023`.
>   **Documentos:** `a69bb69` (caminhada, contexto, Roteiro 15 com o novo Passo 5.5).
> - **Branch só-migração em `0848b8c`** (um commit novo sobre `2907667`): `git diff --name-only main
>   gsd/phase-06-estoque-migracao` = os quatro arquivos, idênticos aos do branch da fase.
> - **`npm run verificar` exit 0 nos dois branches** (fase: 1627 testes; só-migração: 1325 testes;
>   `test:migracoes` passou nos dois, com a categoria contada 1 depois de migrar e depois de
>   reaplicar). E2e `--grep "estoque financeiro|estoque abas|estoque material|cadastros"`: 140
>   passed, 2 skipped.
> - Nada publicado, nenhuma migração aplicada, nenhum requisito EST marcado.
>
> **🔴 O que depende de você, nesta ordem:**
> 1. **Roteiro 15** (`docs/operacao/15-migracao-estoque.md`, a partir do Passo 1; o Passo 0 está
>    feito). O Passo 2 publica o só-migração `0848b8c`; o Passo 5.5 é novo (a categoria, contada 1).
> 2. **A contagem inicial real e a Parte 2 da caminhada**, no celular, com cronômetro na baixa.

> **🟡 ATUALIZAÇÃO DE 29/09/2026, MANHÃ (antes da Parte 0) — A FASE 06 (ESTOQUE) ESTÁ PRONTA NO BRANCH E ESPERA VOCÊ.**
> Nada dela está no ar, de propósito: o código grava dentro de toda venda e compra, e se subir antes
> da migração `0023`, toda venda quebra (D-33).
>
> **Como sei (medido nesta manhã):**
> - **Código completo no branch `gsd/phase-06-estoque`** — 11 planos, 06-01 a 06-10 concluídos e o
>   06-11 (o portão) com as Tarefas 1 e 2 feitas: `/api/health/estoque`, o Roteiro 15, a caminhada
>   `06-VERIFICACAO-HUMANA.md`, e a única varredura completa da fase — `948 passed · 12 failed · 1
>   flaky · 38 skipped · 61 did not run`, **nenhuma falha do Estoque**, todas classificadas
>   (`Claude outputs/RETRATO-DA-SUITE.md`). `npm run verificar` verde.
> - **Revisão de código rodada ANTES do seu portão** (`06-REVIEW.md`): 0 bloqueios, 5 avisos. Três
>   corrigidos (WR-03 custo da contagem, WR-04 roteiro, WR-05 diálogo do Catálogo — `06-REVIEW-FIX.md`,
>   `verificar` verde e um e2e com `--grep`, 66 passed). **WR-01 e WR-02 são regras de dinheiro do
>   cancelamento: ficaram com você**, na Parte 0, §0.1, com números.
> - **Pronto para o Passo 2 do roteiro:** o branch LOCAL `gsd/phase-06-estoque-migracao` leva só os
>   quatro arquivos da `0023` sobre o seu `main` local, com `npm run verificar` verde (refeito às ~09h
>   UTC sobre o `main` com os documentos sincronizados — hash no adendo do `06-11-SUMMARY.md`).
> - **Produção continua em `ecdca87`** (`git ls-remote`), run `36509335475` verde o mais recente
>   (`gh run list`), `/api/health/backup` 200, `/api/health/estoque` 404 (esperado: não publicado).
>   `git log origin/main..main` = **17 commits** locais — o bloco da madrugada, logo abaixo, dizia 7;
>   vieram depois o fechamento da 04.6 e o planejamento da Fase 06 (só documentos). O SIT-10 continua
>   fora do ar (`grep -c 'hidden gap-2 md:flex'` = 0).
>
> **🔴 O que depende de você, nesta ordem:** *(retrato de antes da Parte 0 — o item 1 foi FEITO em
> 29/09 de manhã, ver o bloco acima; o branch só-migração agora está em `0848b8c`)*
> 1. ~~**`06-VERIFICACAO-HUMANA.md`, Parte 0**~~ — ✅ respondida em 29/09/2026, manhã — confirmar ou trocar **D-23/D-24** (o valor do estorno,
>    com o exemplo em números), responder **D-29**, e escolher nas duas questões da revisão (**WR-01**:
>    estorno de venda com saldo zerado ou negativo; **WR-02**: se o estorno conta como "última
>    entrada com preço"). Antes de qualquer comando no servidor.
> 2. **Roteiro 15** (`docs/operacao/15-migracao-estoque.md`): publicar só a migração → backup →
>    `0023` → conferência SQL → publicar o código → `/api/health/estoque`. O `push` do Passo 2 leva
>    junto os commits locais de `main` — os 17 da lista do `06-11-SUMMARY.md` mais os commits
>    de documentos que sincronizaram o `main` (entre eles o SIT-10).
> 3. **A contagem inicial real e a Parte 2 da caminhada**, no celular, com cronômetro na baixa.
> 4. As decisões tomadas sem você: "Decidido sem o Theo" no topo de `.planning/STATE.md` (itens 1 a
>    28) e a Parte 0 da caminhada.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, MADRUGADA — A FASE 04.6 ESTÁ FECHADA.** O que vem logo abaixo
> deste bloco é o retrato de 29/09 de manhã cedo e dizia, no presente, "falta o fechamento formal e
> o push de 6 commits" — as duas coisas aconteceram depois. Mantido como registro.
>
> **Como sei (medido, não afirmado):**
> - **Fechamento formal feito:** verificação da fase `passed`, 9 de 9 — os 8 critérios do ROADMAP e
>   os 24 requisitos (commit `e3527e4`); `phase.complete` em `598fbc7`; ROADMAP com a 04.6 marcada.
> - **Revisão de código rodou antes** (`82ac7c2`): 4 bloqueadores, **todos conferidos no código**
>   pelo orquestrador, e o dono mandou corrigir antes de fechar. Corrigidos 7 achados em 9 commits
>   (`2604b1a`..`9605a8d`, relatório `d835434`) — entre eles **perda de texto nas Anotações** (a
>   gravação pendente era cancelada ao sair da tela, com o indicador dizendo "salvo") e o **aviso de
>   conflito contra a própria gravação**; encomenda atrasada aparecendo como "Em espera"; e ~65
>   navegações ainda nos endereços antigos, que só funcionavam pelo redirecionamento temporário.
> - **Essas correções ESTÃO no ar:** o dono deu o push; `gh run list` mostra o run `36509335475`
>   verde nos quatro jobs, inclusive `Implantar no VPS`; e o `<html>` de produção traz
>   `data-scroll-behavior="smooth"`, atributo que só essas correções introduziram.
> - **Varredura completa sobre o código corrigido:** `826 passed · 10 failed · 1 flaky · 37 skipped ·
>   48 did not run`. Spec a spec: 7 falhas são as janelas antigas conhecidas; 3 eram novas
>   (`rotas.spec.ts:168`, `sessao.spec.ts:111`, `financeiro-venda.spec.ts:495`) e **passaram
>   isoladas nos dois viewports** — contenção de carga, não regressão. Os "did not run" são a cadeia
>   `parametros-*`, estrutural e anterior à fase.
> - **O verificador achou um defeito que ninguém tinha visto:** no celular, a barra de cima do site
>   cortava o botão "Encomendas" (em 375px lia-se "Encom"). Confirmado em produção por screenshot,
>   corrigido em `748b1c6` (teste vermelho) → `ddfecfd` (verde), seguindo o protótipo aprovado,
>   que esconde esses botões no celular. **Esta correção NÃO está no ar ainda.**
>
> **🔴 O que depende de você:**
> 1. **`git push`** — 7 commits locais (`git log origin/main..main` em 29/09 madrugada): a correção
>    da barra do site (`748b1c6`, `ddfecfd`) e documentos. Depois do deploy, confira:
>    `curl -s https://amassacerrado.com.br/ | grep -c 'hidden gap-2 md:flex'` deve dar **1**.
> 2. **As decisões tomadas sem você esta noite**, todas reversíveis e cada uma com o jeito de desfazer — ver "Decidido sem o Theo" no
>    topo do `.planning/STATE.md`.
> 3. **Uma mudança de comportamento para saber:** nas Anotações, com o aviso de conflito na tela,
>    digitar não o esconde mais — ele espera você escolher "manter o meu" ou "ver o dela". O jeito
>    antigo entrava em laço.
>
> **Em seguida:** Fase **06 — Estoque** (item 4 da fila), que o orquestrador segue durante a noite
> sob a sua autorização de 29/09 ("roda o máximo que puder em opções recomendadas").


> **A porta de entrada de qualquer sessão agora é `ESTADO-ATUAL.md`, na raiz do projeto** (mora só
> neste computador; está no `.gitignore`). Ele tem o negócio, o que está no ar, a ordem de trabalho e
> as pendências. Este arquivo continua valendo pelas **lições técnicas** da seção "O que a Fase 4.2
> ensinou". Se os dois divergirem sobre prioridade, o `ESTADO-ATUAL.md` vence.

## Ordem atual

> ⚠️ **A lista de 2026-09-17 abaixo está cumprida ou superada.** Atualizada em 2026-09-29. A ordem
> de trabalho de verdade mora em `Claude outputs/FILA-DO-CODE.md`, mantida pelo Cowork; esta seção
> só a espelha.

1. ~~**Fase 04.3 — Comparador de Compras**~~ — **concluída em 2026-09-18.** Depois dela vieram a
   **04.4** (Financeiro, parte 1, concluída em 26/09, verificada 9/9 + 17/17) e a **04.5**
   (Financeiro, parte 2 — Precificação e Orçamento, **concluída em 27/09**, 14 planos, 23 dos 25
   itens da verificação humana passando de primeira e os dois outros corrigidos no plano 14).

2. ~~**Fase 04.6 — plataforma em `/gestao`, Início novo, navegação e site público.**~~ **Executada em
   28/09 e com o portão humano percorrido em 28-29/09/2026** — 8 planos. *Fechamento formal feito na madrugada de 29/09 (`598fbc7`, verificação `e3527e4`); até então esta linha dizia "faltando apenas o
   fechamento formal pelo orquestrador (`phase.complete` + verificador)".* **Como sei:**
   `04.6-VERIFICACAO-HUMANA.md` tem os 16 itens respondidos, nenhum reprovado; o dono aplicou a
   migração `0022` pelo Roteiro 14 e colou as quatro conferências de fora (tabela, semente de 1
   linha, gatilho, `delete` revogado); `gh run list` em 29/09 mostra o run `36443052672` verde
   (2ª tentativa, commit `72b8881` — a 1ª caiu na busca de fonte do Google, transitório, janela 60
   do `WINDOWS.md` segue aberta); e `curl` de fora em 29/09 devolve `/gestao` → 307 com
   `callbackUrl` no domínio público (GES-04 fechada). Detalhe: `04.6-08-SUMMARY.md`.
   **A última varredura e2e (`798 passed · 13 failed · 37 skipped · 74 did not run`) não
   exercitou tudo: os ~74 que não rodaram são a cadeia `parametros-*`**, estrutural e anterior à
   fase. **Não publicado ainda:** `223748a` (o espaço sem capacidade fixa) e `41ba169`
   (correção do Roteiro 14) estão só locais — `git log origin/main..main` em 29/09 mostrava 5
   commits antes do de fechamento; o `git push` é do dono.

   **Abertos que esta fase deixa:** os textos do site (o dono está preparando um lote de edições;
   registrado em `WINDOWS.md`) e a **ambiguidade do limite por turma** — ele decidiu que o
   *espaço* não tem capacidade fixa, mas a frase sobre "remover os avisos de lotação na agenda"
   servia também às *turmas*, e o máximo por turma é algo que ele disse querer. AGD-02/03/04 não
   foram tocados; voltar à mesa quando a Fase 5 for discutida.

   **Corrigido em 28/09 (execução do plano 08):** este arquivo dizia "falta executar
   `/gsd-execute-phase 04.6`". Os 8 planos executaram no mesmo dia (28/09) — o texto acima descrevia
   o estado ANTES da execução, preservado como registro logo abaixo. **A metade "não dar push sem
   confirmar" continua valendo:** o plano 08 é `autonomous: false` e põe o push, a migração `0022`
   e GES-04 em produção nas mãos dele — em 28/09 nada tinha sido publicado nem migrado em produção; **em 29/09 isso deixou de ser verdade** (ver o parágrafo do item 2 acima: o dono publicou, migrou e conferiu). O que continua sem push são só `223748a`, `41ba169` e o commit de fechamento.

   **Correção do que este arquivo dizia antes:** o planejamento do site **não** está mais fora do
   repositório, e **não há mais "Em breve"**. O dono aprovou o protótipo do site inteiro em
   26/09 (`Claude outputs/site/`), que substituiu a página provisória; o marco "M8 — Página Em
   breve" do `amassa-cerrado` foi superado por essa decisão. Continua valendo o resto: não apague
   nem altere nada em `C:\Users\Andre\amassa-cerrado`.

3. **Fase 6 — Estoque**, com protótipo antes da execução — 🔒 depois da 04.6 estar no ar (item 4
   da fila). *(Condição cumprida em 29/09/2026: a 04.6 está no ar — deploy `72b8881`, run
   `36443052672` verde. **Atualizado em 29/09 de manhã:** a fase foi discutida em `--auto`, planejada e executada na noite de 29/09 sob a autorização dele; o código está no branch `gsd/phase-06-estoque`, não publicado, e o portão 06-11 espera o dono — ver o bloco do topo.)* O protótipo já foi aprovado em 18/09 e revisto em 20/09, e o **adendo**
   (`Claude outputs/estoque/ADENDO.md`) vence o briefing antigo. O restante deste arquivo, a
   partir de "Como começar", foi escrito para ela e continua valendo nas lições técnicas.

---

# Fase 6: Estoque (instruções originais de 2026-09-01)

## Como começar

O dono pediu, explicitamente, **protótipo antes da execução** — o mesmo caminho que deu certo na
Abertura do Espaço:

1. **Protótipo primeiro.** Um HTML interativo, publicado como Artifact (nunca arquivo estático: um
   arquivo fora da pasta do projeto vira captura sem interação, e os botões não funcionam). Iterar
   com o dono até ele dizer "vamos levar isso para a plataforma".
2. **Versionar o protótipo aprovado** em `.planning/phases/06-estoque/prototipo.html`. Na 4.2 ele
   virou a especificação: onde a prosa e o protótipo divergiam, **o protótipo vencia**.
3. Só então `/gsd-discuss-phase 6`, `/gsd-plan-phase 6`, `/gsd-execute-phase 6`.

Não comece pelo `/gsd-discuss-phase`. O dono decide melhor olhando uma tela do que respondendo
perguntas sobre uma tela.

## O que o ROADMAP já fixa (não reabra sem motivo)

**Objetivo**: saber o que existe, o que está acabando e para onde o material foi — **saldo sempre
derivado das movimentações, nunca uma coluna editável**.

Critérios de sucesso, verbatim:
1. Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
2. Material abaixo do mínimo aparece destacado na lista e no painel inicial
3. O histórico mostra toda movimentação com autor e data
4. **Não existe nenhuma forma de editar ou apagar uma movimentação pela interface** — só registrar um ajuste
5. Registrar uma baixa no celular leva menos de 15 segundos
6. O saldo mostrado bate com a soma manual do histórico

Requisitos: EST-01 a EST-12. Depende só da Fase 2b. `UI hint: yes` (tem fase de UI-SPEC).

## O que a Fase 4.2 ensinou e vale para o Estoque

Isto não é história — é o que vai economizar horas.

**1. Atualização de tela depois de gravar.** Existe um defeito de agendamento do React/Next em
produção: a confirmação de uma transição falha em silêncio numa fração dos toques. Medido no
servidor `standalone` (o mesmo do VPS): marcar um item não atualizava a tela em **83%** dos toques.
O padrão que resolveu, e que o Estoque deve nascer com ele:

- **Abrir diálogo, marcar, editar, fechar**: nunca dependem do servidor. A URL é escrita por
  `window.history.pushState` (ver `components/amassa/abertura/url-sem-navegar.ts`), que não dispara
  transição, e o estado que a tela mostra vem do cliente, que já o tem no instante do toque.
- **Gravar**: usa navegação COMPLETA (`window.location.assign`), porque só o servidor sabe o
  resultado. Custa um carregamento numa ação pouco frequente e sempre mostra a verdade.
- **`router.refresh()` depois de Server Action é o antipadrão.** O módulo Abertura não tem nenhum.

**Registro aberto nº 26**: Queimas e Encomendas ainda usam esse padrão. `queimas-registro.spec.ts:84`
("Desfazer") já falhou por isso numa varredura. Tem menos testes batendo nele, não é menos real.

**2. Prova destrutiva tem banco próprio.** `scripts/testar-migracoes.mjs` prova a migração de
remoção com `drop table` de verdade. Ela recebia o banco compartilhado; localmente era inofensivo
(Postgres efêmero próprio), mas em CI apagava as tabelas que o e2e ia usar em seguida — pipeline
vermelho sem defeito nenhum no módulo. Hoje ela cria `<banco>_remocao`, prova e apaga. **Se o
Estoque acrescentar qualquer verificação destrutiva, ela nasce com banco próprio.**

**3. O pipeline agora enxerga.** Quando o e2e reprova, ele guarda o log do contêiner e os artefatos
do Playwright (`error-context.md` traz o retrato da página no instante da falha). Foi isso que deu a
causa raiz em uma linha depois de horas de adivinhação. **Use os artefatos antes de tentar
reproduzir o ambiente do runner.**

**4. Rodapé de diálogo é preso por flex, nunca por `position: sticky`.** Ver
`.planning/debug/resolved/rodape-formulario-desktop.md`. Já reincidiu uma vez.

**5. Orçamento de e2e.** `npm run test:e2e` custa ~53s de imposto fixo. No máximo uma invocação por
tarefa, com `--grep`. A varredura completa roda uma vez por fase, no último plano. Na 4.2 ela rodou
oito vezes — foi necessário por causa do defeito, mas não é o padrão.

## Estado do projeto

- Fase 4.2 **completa e no ar**. Migrações 0010/0011 aplicadas à mão em produção em 2026-09-01,
  verificadas pelo psql (3 tabelas, 12 grants, 3 gatilhos). O dono testou no celular real.
- Pipeline verde nos quatro jobs. 385 testes passando.
- Ordem de execução: **4.2 (feita) → 6 (Estoque) → 5 (Agenda) → 7 (Polimento)**. A Agenda está em
  espera por decisão do dono.
- Registro de defeitos: 17 abertos em `.planning/WINDOWS.md`. O nº 26 é o mais relevante para quem
  for mexer em Queimas ou Encomendas.

## O que só o dono faz

- Aplicar migração em produção, à mão, depois de backup verificado. Nunca o agente, nunca o pipeline.
- Editar o `.env` do servidor.
- Testar no celular de verdade. Todos os números do agente vêm de navegador automatizado; a mão
  suja no ateliê é o único teste que decide.
