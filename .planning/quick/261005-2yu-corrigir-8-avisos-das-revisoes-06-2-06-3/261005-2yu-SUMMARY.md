---
quick_id: 261005-2yu
phase: quick-261005-2yu
plan: 1
status: complete
subsystem: fornecedores, lembretes, queimas
tags: [revisao-de-codigo, concorrencia-otimista, sonner, route-handler, middleware]
requires: []
provides:
  - "ehFaltaDeSessao (lib/auth/exigir-usuario.ts)"
  - "ehNavegacao (lib/rotas/gestao.ts)"
  - "destinoDoAvisoDeAnexo (lib/fornecedores/cabecalhos.ts)"
  - "avisoDaMarcacao, chegouAoTeto (lib/lembretes/lista.ts)"
  - "manterExclusaoNaFrente (components/amassa/lembretes/avisos.ts)"
  - "contagemMudou, vendasAtivasMudaram, numerosDasVendasAtivas (lib/queimas/contagem.ts)"
  - "excluirQueimaNaTransacao (lib/queimas/gravacao.ts)"
affects: [06.2-fornecedores, 06.3-lembretes, 06.4-queimas-contagem]
tech-stack:
  added: []
  patterns:
    - "Concorrência otimista sob travarContagem: o navegador manda o retrato da tela (esperada, vendasVistas) e o servidor recusa com telaMudou"
    - "303 com Location relativo para navegação; JSON para fetch/request"
    - "Um aviso sonner só para todas as exclusões pendentes, reemitido na frente"
key-files:
  created: []
  modified:
    - lib/auth/exigir-usuario.ts
    - lib/rotas/gestao.ts
    - lib/fornecedores/cabecalhos.ts
    - lib/fornecedores/textos.ts
    - lib/fornecedores/consultas.ts
    - app/gestao/api/fornecedores/anexos/route.ts
    - app/gestao/api/fornecedores/anexos/[id]/route.ts
    - middleware.ts
    - lib/cadastros/avisos.ts
    - app/gestao/(app)/cadastros/page.tsx
    - components/amassa/cadastros/aviso-cadastros.tsx
    - components/amassa/cadastros/fornecedores/folha-anexo.tsx
    - lib/lembretes/acoes.ts
    - lib/lembretes/lista.ts
    - lib/lembretes/textos.ts
    - components/amassa/lembretes/avisos.ts
    - components/amassa/lembretes/linha-de-criar.tsx
    - components/amassa/lembretes/linha-lembrete.tsx
    - components/amassa/lembretes/lista-completa.tsx
    - lib/queimas/contagem.ts
    - lib/queimas/textos.ts
    - lib/queimas/esquemas.ts
    - lib/queimas/gravacao.ts
    - lib/queimas/acoes.ts
    - scripts/provar-corridas-das-queimas.ts
    - components/amassa/queimas/folha-contagem.tsx
    - components/amassa/queimas/confirmar-apagar-contagem.tsx
    - components/amassa/queimas/folha-recebi-queima.tsx
    - components/amassa/queimas/confirmar-excluir-queima.tsx
    - components/amassa/queimas/registrar-queima.tsx
decisions:
  - "WR-02 das Queimas por concorrência otimista (vendasVistas congeladas), sem coluna de idempotência e sem migração"
  - "Ordem no cobrarQueimaNaTransacao: null/externas zero → falta zero (fraseTudoJaLancado) → vendas mudaram (tela velha) → cabeNoQueFalta"
  - "Exclusões de lembrete agrupadas num aviso só, reemitido na frente depois de todo aviso dos Lembretes; resíduo aceito: aviso de outro módulo depois de sair das telas dos Lembretes"
  - "Navegação a anexo com erro: 303 com Location relativo para a ficha (uuid validado + aviso de união fechada); sem sessão, ao login"
  - "Lançar na Venda NÃO manda retrato (fora dos oito avisos)"
metrics:
  duration: "~45 min (01:24–02:08 UTC de 05/10/2026)"
  completed: 2026-10-05
actuals:
  tokens: 39700   # chars/4 sobre `git diff ed9c46e HEAD` (158 724 caracteres, com o contexto do diff)
  tasks: 3
  commits: 3
---

# Quick 261005-2yu: os 8 avisos das revisões 06.2, 06.3 e 06.4 corrigidos

**Concorrência otimista sob a trava da queima (contagem esperada, vendas vistas) para os três avisos das Queimas; um aviso só de exclusão sempre na frente e "Desfazer" do feito só para quem gravou nos Lembretes; 401 só para falta de sessão e 303 relativo de volta à ficha nos anexos de Fornecedores — sem migração, sem push.**

## Commits (locais, em `main`, NÃO publicados)

| Tarefa | Commit | Avisos |
|---|---|---|
| 1 — Fornecedores | `ef06703` | 06.2-WR-01, 06.2-WR-02 |
| 2 — Lembretes | `cf57938` | 06.3-WR-01, 06.3-WR-02 (mínimo), 06.3-WR-03 |
| 3 — Queimas | `a866128` | 06.4-WR-01, 06.4-WR-02, 06.4-WR-03 |

`git log origin/main..main --oneline` (sem `git fetch`, 05/10/2026 ~02:08 UTC): `a866128`, `cf57938`, `ef06703` e o
`ed9c46e` (docs de estado, já estava não publicado antes deste quick). Publicar = push simples, **sem `db:migrate`**.

**TABELAS_ESPERADAS não mudou; nenhuma migração.** Como sei: `git diff ed9c46e -- db/ scripts/testar-migracoes.mjs`
vazio; nenhum arquivo em `db/` no diff dos três commits.

## Por aviso: a correção, os arquivos e o teste que prova

### 06.2-WR-01 — falha do servidor no envio virava "Sua sessão terminou" e o arquivo se perdia
- **Correção:** `ehFaltaDeSessao(erro)` — só objeto com `digest` começando por `NEXT_REDIRECT;` (o `redirect()` de
  `exigirUsuario()`) é falta de sessão. No PUT, só ela vira 401; outra falha vira 500 com `FRASE_ENVIO_SEM_CONFERIR`
  ("Não deu para conferir o envio agora — o servidor não respondeu. O arquivo continua escolhido: toque em “Guardar
  anexo” de novo em instantes."), detalhe só no `console.error`. `situacaoParaEnvio` ganhou `try` com a mesma
  resposta. O GET também distingue (falta de sessão → 401/login; outra → 500 `FRASE_NAO_DEU_PARA_LER_ANEXO`). A folha,
  num 5xx com `{ ok: false, erro }`, mostra a frase do servidor e mantém arquivo e prévia; o ramo do 401 não mudou.
- **Arquivos:** `lib/auth/exigir-usuario.ts`, `app/gestao/api/fornecedores/anexos/route.ts`,
  `app/gestao/api/fornecedores/anexos/[id]/route.ts`, `lib/fornecedores/textos.ts`,
  `components/amassa/cadastros/fornecedores/folha-anexo.tsx`.
- **Testes:** unit `tests/unit/exigir-usuario.test.ts` (`ehFaltaDeSessao` com o **`redirect` real de
  `next/navigation`, importável no Vitest** — o digest literal não foi necessário; `Error("ECONNREFUSED")`,
  `NEXT_NOT_FOUND`, `null`, `undefined` = falso). e2e `fornecedores-anexos.spec.ts` **(p)**: PUT interceptado com 500 +
  `FRASE_ENVIO_SEM_CONFERIR` → a folha mostra a frase, o arquivo continua escolhido, "Guardar anexo" habilitado;
  sem a rota, guarda. *RED:* no código anterior a folha ignorava a frase do servidor num 5xx e mostrava
  `FRASE_FALHA_AO_ENVIAR` — a afirmação da frase falharia.

### 06.2-WR-02 — "Baixar"/"Abrir" um anexo com erro trocava a aba pelo JSON cru
- **Correção:** `ehNavegacao(cabecalhos)` (puro: `Sec-Fetch-Mode: navigate`, ou sem ele `Accept` com `text/html`).
  No GET, todo erro em navegação vira **303 com `Location` RELATIVO** para
  `destinoDoAvisoDeAnexo({ aviso, fornecedorId, referer })` = `/gestao/cadastros?sub=fornecedores[&fornecedor=<uuid>]&aviso=…`
  (o uuid é o da linha do anexo; sem linha, o do `Referer` se ele for a ficha de Cadastros; nunca texto da
  requisição); sem sessão → `/gestao/login?sessao=encerrada`. Fora de navegação, exatamente o JSON e o status de
  antes. `obterAnexoParaLeitura` devolve `fornecedorId` e ganhou `try`. **Middleware:** o 401 JSON de rota de API não
  pública só vale fora de navegação; em navegação, 303 para o login. Cadastros: `anexo-sumiu`,
  `anexo-nao-encontrado`, `anexo-nao-abriu` em `avisoDaUrl`, frases da 06.2, `AvisoCadastros` com `tom="erro"`
  (`toast.error`). Os links não mudaram.
- **Arquivos:** `lib/rotas/gestao.ts`, `lib/fornecedores/cabecalhos.ts`, `lib/fornecedores/consultas.ts`,
  `app/gestao/api/fornecedores/anexos/[id]/route.ts`, `middleware.ts`, `lib/cadastros/avisos.ts`,
  `app/gestao/(app)/cadastros/page.tsx`, `components/amassa/cadastros/aviso-cadastros.tsx`,
  `tests/e2e/apoio/semear-fornecedores.ts` (`semearAnexoSemArquivo(…, extensao)`).
- **Testes:** unit `rotas-gestao.test.ts` (`ehNavegacao`), `fornecedores-cabecalhos.test.ts`
  (`destinoDoAvisoDeAnexo`: linha, referer, referer inválido/de outro caminho/uuid falso, prefixo =
  `rotaDeGestao("/cadastros")`, nunca outro host), `cadastros-categorias.test.ts` (os três avisos). e2e
  `fornecedores-rota-anexos.spec.ts` **(m)** "Baixar" planilha sem arquivo → ficha com `FRASE_ARQUIVO_SUMIU`, sem
  `{"erro"`; **(n)** `goto` a uuid inexistente com `referer` da ficha → ficha com "Esse anexo não existe."; **(o)** sem
  sessão → `/gestao/login`. **(c)** e **(l)** (JSON por `request`) continuam verdes. *RED:* no código anterior a
  navegação recebia o JSON (404/401) e nenhum aviso aparecia — (m), (n) e (o) falhariam.

### 06.3-WR-01 — o "Desfazer" da exclusão sumia atrás de outro aviso, e a exclusão seguia
- **Correção:** registro de módulo em `avisos.ts` (Map id → trecho, id do aviso atual, sequência). Um aviso só para
  todas as exclusões pendentes (`textoExcluido(trecho)` com 1, `textoExcluidos(N)` = "N lembretes excluídos." com N);
  cada reemissão gera id novo, grava-o como atual ANTES de `toast.dismiss` do velho (o `onDismiss` do velho é
  ignorado) e começa relógio novo de 6 s. "Desfazer" devolve todas; `onAutoClose`/`onDismiss` efetivam todas (a que
  falhar volta e avisa). `manterExclusaoNaFrente()` é chamado depois de TODO aviso dos Lembretes: feito, já feito,
  reaberto, falhas, "Lembrete reaberto.", "Lembrete guardado." (`linha-de-criar.tsx`), "Lembrete atualizado." e
  "não existe" (`linha-lembrete.tsx`). Garantias da D-03 preservadas e reescritas no comentário.
- **Arquivos:** `components/amassa/lembretes/avisos.ts`, `linha-de-criar.tsx`, `linha-lembrete.tsx`,
  `lib/lembretes/textos.ts`.
- **Testes:** unit `textoExcluidos`. e2e `lembretes-acoes.spec.ts` **(r)** exclui A, marca B feito, SEM mouse: o
  aviso de A tem `data-front="true"` e o "Desfazer" `opacity: 1`; devolve A; 7 s depois A no banco e B feito.
  **(s)** dois excluídos → um aviso "2 lembretes excluídos.", "Desfazer" devolve os dois; segunda rodada expira e
  apaga os dois. *RED (não rodado, por regra de uma invocação):* no código anterior o "Feito: B" ficava na frente e o
  aviso de A atrás, com o conteúdo em opacidade 0 do sonner recolhido — `data-front` e `opacity` de (r) falhariam; e
  (s) veria dois avisos "Lembrete excluído: …".

### 06.3-WR-02 — "Ver todos" parava em 500 sem dizer (correção mínima, decisão do dono)
- **Correção:** `chegouAoTeto({ haMais, quantos })` (teto `TETO_DE_QUANTOS` = 500) e `fraseNoTetoDaLista(500)`
  ("Mostrando os 500 primeiros — há mais lembretes que esta lista não mostra. Use o filtro “De quem” para ver menos
  de cada vez."), num `<p data-testid="lembretes-no-teto">` onde o botão some. **Paginação por cursor não feita.**
- **Arquivos:** `lib/lembretes/lista.ts`, `lib/lembretes/textos.ts`, `components/amassa/lembretes/lista-completa.tsx`.
- **Testes:** unit `chegouAoTeto` (true só com `haMais` E 500) e `fraseNoTetoDaLista`. Sem e2e (semear 501
  lembretes não foi pedido no plano).

### 06.3-WR-03 — o "Desfazer" do "Feito" podia desfazer o feito de outra pessoa
- **Correção:** `marcarFeito` usa `.returning({ id })` nos dois updates (reabrir passou a filtrar
  `feito_em is not null`) e devolve `{ lembrete, gravadoAgora }` (`MarcacaoDoLembrete`). `avisoDaMarcacao` decide:
  `"feito"` → "Feito: …" com "Desfazer"; `"ja_feito"` → "Já estava feito por {nome}: …" sem "Desfazer";
  `"voltou_aberto"` → `FRASE_REABERTO_POR_OUTRA_PESSOA`. `exigirUsuario()` continua a primeira linha.
- **Arquivos:** `lib/lembretes/acoes.ts`, `lib/lembretes/lista.ts`, `lib/lembretes/textos.ts`,
  `components/amassa/lembretes/avisos.ts`, `tests/e2e/apoio/semear-lembretes.ts` (`criarUsuarioDeTeste`,
  `marcarFeitoNoBanco`).
- **Testes:** unit `avisoDaMarcacao` (os 4 casos) e `textoJaEstavaFeito`. e2e **(q)**: outro usuário marca no banco;
  o toque diz "Já estava feito por [e2e] Outra …", sem botão "Desfazer", e `feito_por` continua o outro. *RED (não
  rodado):* o código anterior mostrava "Feito: …" com "Desfazer" — as duas afirmações de (q) falhariam.

### 06.4-WR-01 — salvar uma contagem "nova" sobrescrevia em silêncio a de outra pessoa
- **Correção:** `esquemaContagem` exige `esperada` (contagem ou `null`; ausente → "Esta tela está desatualizada —
  recarregue a página e tente de novo."), `esquemaApagarContagem` exige `esperada`. `gravarContagem(tx, queimaId,
  contagem, esperada, contadoPor)` e `apagarContagemNaTransacao(tx, queimaId, esperada)` recusam sob a trava com
  `contagemMudou(travada.contagem, esperada)` → `fraseContagemMudou(atual)` + `{ telaMudou, contagemAtual }` (antes do
  piso; no apagar, depois do "sem contagem = ok"). A folha guarda `esperada` (começa na contagem da abertura),
  manda nos dois caminhos; na recusa mostra a frase, troca `esperada` pela atual, relê a página e os números ficam.
- **Arquivos:** `lib/queimas/contagem.ts`, `textos.ts`, `esquemas.ts`, `gravacao.ts`, `acoes.ts`,
  `components/amassa/queimas/folha-contagem.tsx`, `confirmar-apagar-contagem.tsx`.
- **Testes:** unit `contagemMudou` (6 casos), `fraseContagemMudou`, esquemas. Corrida **(6)** reescrito e **(6b)** novo.
  e2e `queimas-contagem.spec.ts` "WR-01": folha do Histórico aberta; 31 P semeadas por baixo; digita 12 e Salvar →
  frase com "agora estão gravadas 31 peças", o 12 fica, banco = 31; Salvar de novo → "Contagem corrigida: 12
  peças.", banco = 12.

### 06.4-WR-02 — resposta perdida do "Recebi agora": "Nenhuma venda foi criada" e um novo toque cobrava de novo
- **Correção:** `esquemaReceberQueima` exige `vendasVistas`; a folha as **congela na abertura**
  (`useState(() => vendas ativas)`). `cobrarQueimaNaTransacao`, nesta ordem: null/externas zero → falta zero
  (`fraseTudoJaLancado`, o (8) não muda) → **`vendasAtivasMudaram`** → `fraseVendasMudaram(novas)` com `telaMudou` →
  `cabeNoQueFalta` e o resto. A folha trata `telaMudou` como `telaJaFoiAtualizada` (aviso, fecha, relê). No `catch`:
  `FRASE_RECEBER_SEM_RESPOSTA` ("Não deu para confirmar se a venda foi registrada — a conexão falhou. Pode tocar de
  novo: se ela já tiver entrado, a folha avisa e não cria outra.") + `router.refresh()`, folha aberta. A
  `FRASE_FALHA_AO_RECEBER` continua sendo a frase do SERVIDOR para a transação desfeita (verdadeira).
- **Arquivos:** os de cima mais `components/amassa/queimas/folha-recebi-queima.tsx`.
- **Testes:** unit `vendasAtivasMudaram` (6 casos), `fraseVendasMudaram`, esquemas. Corrida **(12)** novo. e2e
  `queimas-cobranca.spec.ts` "WR-02": `page.route` sobre o POST com `next-action` → `route.fetch()` + `route.abort("failed")`
  **fez a ação rejeitar** (a folha mostrou `FRASE_RECEBER_SEM_RESPOSTA`, aberta; 1 venda no banco); sem a rota, o
  segundo toque → "Esta queima ganhou a venda nº N desde que a folha abriu…", folha fecha, continua 1 venda (2 P).

### 06.4-WR-03 — `excluirQueima` não conferia no servidor as vendas ativas
- **Correção:** `esquemaExcluirQueima = { id, vendasVistas }`; `excluirQueimaNaTransacao(tx, queimaId, vendasVistas)`:
  `travarContagem` → `null` = "Essa queima não existe mais." → `vendasAtivasMudaram` →
  `fraseExclusaoComVendasNovas(ativas)` com `telaMudou` → `delete` na mesma transação. `excluirQueima` valida, usa a
  transação e revalida também na recusa. O diálogo manda `numerosDasVendasAtivas` que mostra; na recusa a frase fica
  (`role="alert"`) e a página é relida (a descrição passa a citar a venda). O "Desfazer" do registro manda `[]`; na
  recusa com `telaMudou`, `toast.error(frase)` + refresh no lugar de `FRASE_FALHA_AO_DESFAZER`.
- **Arquivos:** `lib/queimas/esquemas.ts`, `gravacao.ts`, `acoes.ts`, `textos.ts`,
  `components/amassa/queimas/confirmar-excluir-queima.tsx`, `registrar-queima.tsx`.
- **Testes:** unit `esquemaExcluirQueima`, `fraseExclusaoComVendasNovas`. Corrida **(11)** novo. e2e
  `queimas-cobranca.spec.ts` "WR-03" (no spec onde o Histórico já exclui queima com vendas e onde está a trava dos
  preços; `queimas-detalhe` não precisou mudar): aba A no detalhe; outra aba faz "Recebi agora" 1 P (venda nº N); na
  aba A "Excluir" → frase no diálogo, queima e vínculo continuam; o diálogo passa a dizer "A venda nº N continua no
  Caixa"; confirmar de novo exclui e a venda continua em `documentos`.

## Prova de corrida (`scripts/provar-corridas-das-queimas.ts`) — RED → GREEN e os casos que mudaram de sentido

O `main` do script agora **roda todos os casos e junta as falhas** (antes parava no primeiro). **RED** (com as três
conferências desligadas por `if (false && …)` numa cópia temporária de `gravacao.ts`, restaurada em seguida):
`npm run test:migracoes` exit 1, **7 casos falharam**: (1), (2), (6), (6b), (9b), (11), (12) — o (12) "passou",
isto é, gravou a segunda venda paga das mesmas peças. **GREEN** com o código real: exit 0, "Corridas das Queimas:
todas as afirmações passaram."

**Casos antigos cuja expectativa mudou, e por quê:**
- **(1)** Recebi × Recebi na mesma peça: o segundo continua recusado, mas pela **tela velha** (cita a venda nº N) em vez
  de "só faltam 1 P" — a folha dele abriu antes da venda; a ordem das conferências põe "vendas mudaram" antes de
  `cabeNoQueFalta`. Σ P = 2 como antes.
- **(2)** Recebi × Recebi com partes que cabem (1 P e 2 P de 3 P): **antes as duas passavam; agora a segunda é
  RECUSADA**. É o comportamento certo porque o servidor não consegue distinguir "outra pessoa cobrou outra parte" de
  "o meu toque anterior já valeu" (exatamente o WR-02); decidir pelo que a pessoa VIU é o lado seguro — no pior caso
  ela relê e toca de novo. O caso passou a provar isso também: com a tela relida (`[nº]`), os 2 P passam e Σ = 3.
- **(6)** Duas gravações sobrepostas sem contagem: **antes as duas passavam e a segunda sobrescrevia em silêncio** —
  era o defeito do WR-01. Agora a primeira cria, a segunda é recusada com `fraseContagemMudou` + `telaMudou` +
  `contagemAtual`, e fica uma linha com os números da primeira.
- **(9b)** Lançar × Recebi (Lançar primeiro): o "Recebi" de folha aberta antes da venda nova recusa pela tela velha
  (cita a venda), não mais "só faltam 1 P". Σ P = 2 como antes.
- **Sem mudança de expectativa:** (3) e (4) (passam a mandar a contagem semeada como `esperada`; quem recusa continua
  o piso / as vendas), (5) (delete cru por outra conexão), (7)/(8) (o (8) continua `fraseTudoJaLancado` pela ordem
  das conferências), (9a) e (10) (o "Lançar na Venda" não manda retrato, e o "Recebi" trava primeiro).
- **Novos:** (6b), (11), (12). **A invariante da D-07 (Σ ativa ≤ externas, por tamanho) continua afirmada em todos.**

## Comandos e2e rodados de fato

| # | Comando | Resultado |
|---|---|---|
| 1 | `npm run test:e2e -- --grep "fornecedores-rota-anexos\|fornecedores-anexos\|fornecedores-tabela\|sessao\|fundacao"` | **25 failed, 1 passed, 127 did not run** — ambiente: um contêiner velho `amassa_app_e2e` (imagem de 31/08) segurava a porta 3000 e o `reuseExistingServer` o usou (login em `/login`, rota anterior à 04.6). Nenhum teste do código novo rodou. Contêiner parado (`docker stop`, não removido). |
| 2 | o mesmo | **não chegou a testar** — "Failed to type check" no `next build`: o teste unitário RED da Tarefa 2 já estava escrito (importava exports que ainda não existiam). Defeito de sequência meu. |
| 3 | o mesmo | **152 passed, 1 failed**: (m) no `celular` — por um instante, logo depois do redirecionamento, a ficha aparece duas vezes (troca do streaming) e o `getByTestId("fornecedor-ficha")` caiu no modo estrito; o retrato da falha mostra uma ficha só. Corrigido no TESTE (`.first()` num seletor com o `data-fornecedor-id`); o (n) recebeu a mesma blindagem (já tinha passado). |
| 4 | `npm run test:e2e -- --grep "\(m\) WR-02"` | **75 passed** (inclui a cadeia `vazio-*`; (m) verde em desktop e celular). |
| 5 | `npm run test:e2e -- --grep "lembretes-"` | **145 passed** — (q), (r), (s) verdes nos dois projetos; (l)/(m) existentes sem mudança. |
| 6 | `npm run test:e2e -- --grep "queimas-contagem\|queimas-cobranca\|queimas-detalhe\|queimas-registro\|queimas-venda\|queimas-atalhos\|queimas-manutencao"` | **159 passed**, 0 failed — WR-01/02/03 verdes nos dois projetos. `queimas-atalhos` e `queimas-manutencao` acrescentados porque também usam a folha de contagem/registro (grep). |

Nunca `npm run build` separado. Tarefa 1 gastou 4 invocações (2 por ambiente/sequência, 1 por falha de teste, 1 do
reteste); Tarefas 2 e 3, uma cada.

## Outras verificações
- Unit RED → GREEN: Tarefa 1 **13 falhando → 69 passando** (4 arquivos); Tarefa 2 **7 → 46**; Tarefa 3 **19 → 181**.
- `npm run verificar` **exit 0** antes de cada commit (o da Tarefa 2 com os arquivos da Tarefa 3 postos de lado e
  restaurados; o da Tarefa 3 é o final: lint, `tsc --noEmit`, `verificar-acoes` 125 ações e 0 violações — as duas
  "1 violação" do log são os fixtures de propósito do próprio verificador —, 3038 testes, `test:migracoes` com as
  corridas).

## Decidido sem o Theo
- **Concorrência otimista no lugar da coluna de idempotência do WR-02.** As `vendasVistas` congeladas na abertura
  da folha fazem um novo toque depois de uma resposta perdida sempre ver a venda que já entrou; nenhuma migração.
  Consequência aceita: dois "Recebi agora" legítimos e simultâneos de partes diferentes — o segundo é recusado e
  precisa reler (caso (2)).
- **Ordem no `cobrarQueimaNaTransacao`:** null/sem externas → falta zero (`fraseTudoJaLancado`) → vendas mudaram
  (tela velha) → `cabeNoQueFalta` → preços/pessoa.
- **"Lançar na Venda" não manda retrato:** `vincularQueimaNaVenda` ficou como estava (fora dos oito avisos); ele
  continua protegido pelo piso/falta sob a mesma trava.
- **Exclusões de lembrete agrupadas num aviso só**, reemitido na frente por todo aviso dos Lembretes, com relógio
  novo a cada reemissão. **Resíduo aceito:** um aviso de OUTRO módulo dentro dos 6 s só acontece depois de sair das
  telas dos Lembretes (o Início não tem outro aviso — grep de 05/10/2026).
- **Usuário de teste do (q) nasce inativo:** as pílulas "De quem" são os usuários ATIVOS; um ativo a mais mudaria as
  pílulas de outros specs em paralelo. Usuário não se apaga (AUTH-09), então não há faxina.
- **Texto das frases novas:** `FRASE_ENVIO_SEM_CONFERIR`, `textoExcluidos`, `textoJaEstavaFeito`,
  `FRASE_REABERTO_POR_OUTRA_PESSOA`, `fraseNoTetoDaLista`, `fraseContagemMudou` (com a variante "Alguém apagou esta
  contagem enquanto a folha estava aberta…"), `fraseVendasMudaram`, `FRASE_RECEBER_SEM_RESPOSTA`,
  `fraseExclusaoComVendasNovas`, `FRASE_TELA_DESATUALIZADA` — as do plano, com variantes de plural/lista vazia.
- **303 com `Location` relativo** no Route Handler. No **middleware** o adaptador do Next exige URL absoluta num
  `Location` (`new NextURL(redirect)` sem base em `next/dist/server/web/adapter.js`): a URL é montada sobre
  `requisicao.nextUrl` e o próprio adaptador a devolve relativa (`getRelativeURL`) quando o host é o da requisição.
- **`app/gestao/api/orcamentos/fotos/[id]/route.ts` tem o mesmo `catch {}` em volta de `exigirUsuario()`** — NÃO
  tocado, fora dos oito avisos. Candidato a um quick próprio.

## Deviations from Plan

### Auto-fixed Issues
1. **[Rule 3 - Bloqueio de ambiente] Contêiner `amassa_app_e2e` velho na porta 3000** — encontrado na 1ª invocação
   e2e da Tarefa 1; parado com `docker stop amassa_app_e2e` (política de reinício "no"; não removido; para voltar:
   `docker start amassa_app_e2e`). Enquanto ele estiver de pé, qualquer `npm run test:e2e` local testa a imagem de
   31/08, não o código.
2. **[Rule 1 - Teste] (m)/(n) no celular:** seletor tolerante à ficha duplicada por um instante (ver tabela).
3. **[Rule 2] `main` da prova de corrida junta todas as falhas** em vez de parar na primeira — necessário para
   mostrar o RED dos casos novos, e útil daqui em diante.
4. **[Rule 2] `excluirQueima` com `try/catch`** e frase humana para falha inesperada (antes um erro de banco no
   `delete` escapava cru).
5. **Plano × e2e da WR-03:** ficou em `queimas-cobranca.spec.ts`, não em `queimas-detalhe.spec.ts` (o plano previa
   "ou o spec onde o Histórico já exclui queima").

### Não feito (pelas restrições do orquestrador desta execução)
A **Parte D da Tarefa 3** (notas datadas nas três REVIEW.md, `STATE.md`, `PROXIMA-SESSAO.md`, os documentos fora do
git e o commit `docs(estado)`) **não foi feita**: o orquestrador mandou não atualizar STATE/ROADMAP e não commitar
documentos. Linhas prontas para as REVIEW.md, abaixo de cada WR:
- 06.2 WR-01: *Corrigido em 05/10/2026, quick 261005-2yu (commit `ef06703`): só a falta de sessão (`ehFaltaDeSessao`) vira 401; outra falha vira 500 com frase própria e a folha mantém o arquivo.*
- 06.2 WR-02: *Corrigido em 05/10/2026, quick 261005-2yu (commit `ef06703`): navegação a anexo com erro recebe 303 relativo de volta à ficha com aviso de erro (ou ao login); `fetch` continua com o JSON.*
- 06.3 WR-01: *Corrigido em 05/10/2026, quick 261005-2yu (commit `cf57938`): um aviso só para as exclusões pendentes, reemitido na frente depois de todo aviso dos Lembretes.*
- 06.3 WR-02: *Corrigido em 05/10/2026, quick 261005-2yu (commit `cf57938`): só o aviso no teto, por decisão do dono; paginação por cursor não feita.*
- 06.3 WR-03: *Corrigido em 05/10/2026, quick 261005-2yu (commit `cf57938`): `marcarFeito` devolve `gravadoAgora`; "Desfazer" só para quem gravou, "Já estava feito por …" para os outros.*
- 06.4 WR-01: *Corrigido em 05/10/2026, quick 261005-2yu (commit `a866128`): a folha manda a contagem esperada e o servidor recusa sob a trava se a gravada mudou.*
- 06.4 WR-02: *Corrigido em 05/10/2026, quick 261005-2yu (commit `a866128`): vendas vistas congeladas na abertura da folha; o toque repetido é recusado citando a venda; a falha de rede tem frase honesta.*
- 06.4 WR-03: *Corrigido em 05/10/2026, quick 261005-2yu (commit `a866128`): `excluirQueimaNaTransacao` confere as vendas ativas sob a trava contra as que a confirmação mostrou.*

## Known Stubs
Nenhum.

## Threat Flags
Nenhuma superfície nova fora do `<threat_model>`: o 303 do GET e do middleware é a T-2yu-02 (destino fixo, uuid
validado, união fechada), e o retrato forjado é a T-2yu-04 (só causa recusa).

## Self-Check: PASSED
- Commits `ef06703`, `cf57938`, `a866128` presentes em `git log`.
- Arquivos-chave presentes: `lib/auth/exigir-usuario.ts` (`ehFaltaDeSessao`), `lib/rotas/gestao.ts` (`ehNavegacao`),
  `lib/fornecedores/cabecalhos.ts` (`destinoDoAvisoDeAnexo`), `lib/lembretes/lista.ts` (`avisoDaMarcacao`),
  `components/amassa/lembretes/avisos.ts` (`manterExclusaoNaFrente`), `lib/queimas/contagem.ts`
  (`vendasAtivasMudaram`), `lib/queimas/gravacao.ts` (`excluirQueimaNaTransacao`).
