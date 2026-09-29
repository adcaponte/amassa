---
phase: 06-estoque
plan: 10
subsystem: estoque
status: complete
tags: [estoque, contagem, primeira-abertura, inicio, e2e, vazio-historico]
requires:
  - "06-01: gravarMovimentacoes/travarItens/lerEstados (a porta única), migração 0023 (motivo saldo_inicial, saldo_contado_milesimos e os checks)"
  - "06-04: situacaoDoSaldo/alertaDoItem/ordenarSaldos, normalizarBusca, areasComMaterial, ORDEM_DAS_AREAS"
  - "06-05: planejarAjuste, pedidoDeAjuste, contadoParaMilesimos, custosDasPecasProntas, custoPreenchidoDaPecaPronta"
  - "06-06: ProvedorDoEstoque, BarraAcaoFixa, a folha que grava"
  - "06-09: estadoDoEstoque ({ temMaterial, temManual }), + Novo material pelo provedor, folha do material e Editar material"
provides:
  - "lib/estoque/contagem.ts (puro): ModoDaContagem, modoDoMaterial, planejarContagem, PlanoDeContagem, previaDaContagem, agruparContagem, MaterialParaContagem, FiltroDaContagem, GrupoDaContagem, progressoDaContagem"
  - "lib/estoque/saldo.ts: itensParaOInicio, LinhaDoInicio, LINHAS_NO_INICIO, estoqueNuncaContado; textoDeMilesimos passou a ser exportado"
  - "lib/estoque/esquemas.ts: esquemaConfirmarContagem, ConfirmarContagemValidado"
  - "lib/estoque/pedidos.ts: pedidoDeContagem"
  - "lib/estoque/gravacao.ts: gravarContagem, ResultadoDaContagem"
  - "lib/estoque/consultas.ts: listarParaContagem(hoje), MaterialDaContagem"
  - "lib/estoque/acoes.ts: confirmarContagem, ContagemConfirmada, ResultadoDaContagemConfirmada (verificar-acoes: 80 ações, 0 violações)"
  - "lib/estoque/historico.ts: horaEmBrasilia"
  - "lib/estoque/textos.ts: as frases da contagem e do painel da primeira abertura (FRASE_CUSTO_DA_CONTAGEM, FRASE_FALHA_AO_GRAVAR_CONTAGEM, TITULO_PRIMEIRA_ABERTURA …)"
  - "lib/inicio/textos.ts: TEXTOS_DOS_BLOCOS.estoque.naoContado e .linkNaoContado"
  - "Rota /gestao/estoque/contagem (page.tsx, loading.tsx com 6 linhas, error.tsx)"
  - "components/amassa/estoque: ListaContagem, LinhaContagem, PainelPrimeiraAbertura; BotaoContarEstoque e BotaoNovoMaterialNaLista em barra-acao-fixa.tsx"
  - "components/amassa/inicio/bloco-estoque.tsx: BlocoEstoque async com try/catch próprio"
  - "data-testid: estoque-primeira-abertura, estoque-primeira-abertura-novo-material, estoque-comecar-contagem, estoque-contar, contagem-progresso, contagem-busca, contagem-pilula-tudo/-area-{area}, contagem-grupo-primeira, contagem-grupo-conferencia, contagem-linha (data-item-id), contagem-contado, contagem-custou, contagem-previa, contagem-confirmar, contagem-feito, contagem-contar-de-novo, contagem-erro, contagem-vazio, contagem-vazio-novo-material, contagem-vazio-filtro, contagem-voltar, contagem-carregando, inicio-estoque-linha (data-item-id), inicio-estoque-mais, inicio-estoque-nao-contado"
  - "tests/e2e/apoio/semear-estoque.ts: semearMaterialSemMovimentacao, contagensDoItem"
  - "tests/e2e/estoque-contagem.spec.ts: estoque primeira abertura @vazio-historico (serial, 1–6) e estoque contagem (a–e)"
affects:
  - "Todo e2e que abre /gestao/estoque num banco sem movimentação manual vê o painel da primeira abertura — na suíte completa o serial @vazio-historico cria a primeira movimentação manual antes de desktop/celular"
tech-stack:
  added: []
  patterns:
    - "Uma regra, duas leituras: planejarContagem na prévia da linha e em gravarContagem sob a trava; o modo é decidido pelo livro, dentro da transação"
    - "Grupo da linha congelado no primeiro render da lista (a revalidação da ação não faz a linha pular de grupo no meio da contagem)"
key-files:
  created:
    - lib/estoque/contagem.ts
    - app/gestao/(app)/estoque/contagem/page.tsx
    - app/gestao/(app)/estoque/contagem/loading.tsx
    - app/gestao/(app)/estoque/contagem/error.tsx
    - components/amassa/estoque/lista-contagem.tsx
    - components/amassa/estoque/linha-contagem.tsx
    - components/amassa/estoque/painel-primeira-abertura.tsx
    - tests/unit/estoque-contagem.test.ts
    - tests/e2e/estoque-contagem.spec.ts
  modified:
    - lib/estoque/saldo.ts
    - lib/estoque/esquemas.ts
    - lib/estoque/pedidos.ts
    - lib/estoque/gravacao.ts
    - lib/estoque/consultas.ts
    - lib/estoque/acoes.ts
    - lib/estoque/textos.ts
    - lib/estoque/historico.ts
    - lib/inicio/textos.ts
    - app/gestao/(app)/estoque/page.tsx
    - components/amassa/estoque/secao-saldos.tsx
    - components/amassa/estoque/barra-acao-fixa.tsx
    - components/amassa/inicio/bloco-estoque.tsx
    - tests/unit/estoque-saldo.test.ts
    - tests/e2e/apoio/semear-estoque.ts
    - tests/e2e/inicio.spec.ts
decisions:
  - "A recusa de custo é um resultado de planejarContagem ({ tipo: 'recusa' }), não uma exceção: a mesma frase ('Diga quanto custou — uma estimativa serve.') sai da linha, antes de ir ao servidor, e do servidor, quando a diferença só ficou positiva sob a trava (uma venda no meio). Nesse caso a ação devolve o saldo que viu, e a linha refaz a prévia e mostra 'Custou ao todo'."
  - "Custo zero numa primeira contagem positiva é recusado (maior que zero, como o plano pede) — diferente da entrada manual comum, que aceita R$ 0,00 (decisão do 06-01)."
  - "Linha contada HOJE (lido do banco) já abre compacta, com '✓ Contado: {contado} {un} · hoje {HH:MM}' do saldo_contado_milesimos daquela linha e 'Contar de novo'. É o que faz 'parar no meio' sobreviver a recarregar sem rascunho."
  - "'{c} de {t} contados hoje' soma o que o banco tem de hoje e o que foi confirmado nesta visita — inclusive '✓ Conferido — já estava certo', que não grava nada. Ao recarregar, um conferido sem diferença deixa de contar (não há linha no livro); aceito, na mesma linha da consequência registrada no plano (zero sobre zero continua em 'Ainda sem contagem')."
  - "O grupo de cada material é o da carga da página, congelado no primeiro render da ListaContagem: confirmarContagem revalida /estoque/contagem, e sem isso a linha recém-contada saltaria de 'Ainda sem contagem' para 'Conferência' (e perderia a linha compacta). Material novo que chega pela revalidação entra pelo que o servidor disser."
  - "Enter no 'Contado' vazio só passa o foco adiante (vazio não mexe no material); o botão 'Confirmar contagem' com o campo vazio mostra 'Diga quanto tem na prateleira — pode ser zero.'"
  - "'Contar estoque' é um link com aparência de botão outline, visível no celular e no desktop, antes de '+ Novo material' e 'Registrar movimentação' (que continuam só a partir de 768px)."
  - "O banner some na primeira abertura em TODAS as abas (não só na Saldos), e a barra fixa e as ações do cabeçalho também — a decisão é da página, pela mesma estadoDoEstoque."
  - "No Início, a linha de acabando diz '{X} {un} · mínimo {m} {un}' com o mesmo textoDeMilesimos do resto do Estoque; o chip é desenhado no próprio bloco (cartao-saldo.tsx é 'use client', e o bloco é Server Component)."
metrics:
  duration: "~1h40min"
  completed: "2026-09-29"
actuals:
  tokens: 30300
  tasks: 2
  commits: 3
---

# Phase 6 Plan 10: A contagem do estoque, a primeira abertura e o Início de verdade Summary

A contagem grava pela diferença contra o saldo do instante, sob a trava, com o modo (primeira ou
conferência) decidido pelo livro dentro da transação. A primeira abertura do Estoque troca a lista
por um painel que leva à contagem. O bloco "Estoque acabando" do Início lê `listarSaldos` e segue a
mesma regra de alerta — e, enquanto ninguém contou nada, convida a contar em vez de mostrar
negativos.

## O que foi construído

**Tarefa 1: a regra e o servidor (TDD: RED `0e86404`, GREEN `f503c12`).**
- `lib/estoque/contagem.ts`, módulo puro. `planejarContagem` usa `planejarAjuste` para a diferença,
  então existe uma regra só. Primeira contagem com Δ > 0 vira entrada com o preço de "Custou ao
  todo" (obrigatório, > 0) e motivo `saldo_inicial`. Primeira com Δ < 0 vira ajuste `saldo_inicial`
  sem custo. Conferência vira ajuste sem motivo. Δ = 0 não grava nada. O arquivo também tem
  `previaDaContagem` ("o saldo passa de −2 para 10 un" / "já está certo — nada será gravado"),
  `agruparContagem` (dois grupos, área na ordem fixa, nome pt-BR, só ativos, busca da aba Saldos)
  e `progressoDaContagem`.
- `gravarContagem`: trava o item. Depois da trava, lê o estado e se o item já tem movimentação
  `manual` — é aí que o modo é decidido (T-06-45). Chama `planejarContagem` e então
  `pedidoDeContagem` + `gravarMovimentacoes`, na mesma `tx` (T-06-46).
- `confirmarContagem`: começa por `exigirUsuario()`, valida com Zod e abre uma transação. Material
  inexistente ou sem estoque próprio devolve a frase de "não existe mais"; material desativado
  devolve `fraseMaterialDesativado`. Revalida `/estoque`, `/estoque/contagem` e `/`. Diz em que
  campo mora cada erro (`campo`) e, na recusa de custo, devolve o saldo que o servidor viu.
- `listarParaContagem(hoje)`: materiais ativos com saldo, `temManual`, a contagem de hoje (instante
  e contado, com o corte na meia-noite de Brasília) e o custo da peça pronta.
- `itensParaOInicio` (até 5 linhas, negativo antes de acabando, `maisN`) e `estoqueNuncaContado` em
  `saldo.ts`. No Início, `naoContado` e `linkNaoContado`.

**Tarefa 2: as telas e o e2e (`6723ecb`).**
- `/gestao/estoque` chama `estadoDoEstoque` antes de pintar. Na primeira abertura:
  `PainelPrimeiraAbertura` no lugar da lista, sem banner, sem barra fixa e sem ações no cabeçalho;
  as abas continuam. No estado normal aparece "Contar estoque" (`outline`, `ClipboardCheck`) antes
  das outras ações.
- Rota `/gestao/estoque/contagem`:
  - página com `exigirUsuario()` primeiro, dentro do `ProvedorDoEstoque`, com o `CarregadorDoSeletor`
    para o "+ Novo material";
  - `loading.tsx` com 6 linhas de esqueleto e `error.tsx` com a frase da UI-SPEC;
  - `ListaContagem`: progresso, busca, pílulas de área, os dois grupos com as frases e "1 material" /
    "{N} materiais", cabeçalhos de área com o ponto de cor, a nota "Dá para parar no meio…",
    "Voltar ao estoque" e o vazio "Nada para contar.";
  - `LinhaContagem`: contagem às cegas, "Contado" com 16px/44px, `inputMode="decimal"` e
    `enterKeyHint="next"`. "Custou ao todo" só aparece na primeira contagem com Δ > 0; na peça pronta
    vem preenchido pela ficha. Prévia com `aria-live`. "Gravando…" com `aria-busy`. Enter confirma e
    leva o foco ao próximo "Contado". A linha compacta fica em `text-sucesso`, com "Contar de novo" e
    o anúncio para leitor de tela. O erro aparece na linha (`role="alert"`) e o número digitado
    fica. A partir de 980px a linha vira fileira.
- `BlocoEstoque` async, no molde do `bloco-producao.tsx`. Sem contagem nenhuma mostra
  "O estoque ainda não foi contado." + "começar a contagem". Senão mostra até 5 linhas: chip
  "Saldo negativo" + "{−X} {un}", ou "Acabando" + "{X} {un} · mínimo {m} {un}". Mais que isso
  ganha "e mais {N}", que leva a `?aba=saldos&acabando=1`. Erro mostra `EstadoErro` + `TentarDeNovo`.
- `tests/e2e/estoque-contagem.spec.ts`:
  - serial `@vazio-historico`, passos 1–6, com os estados globais: o Início "nunca contado", o
    painel, a primeira contagem às cegas com custo, "1 de 1 contados hoje" depois de recarregar,
    "Nada acabando.", "Nenhum material desativado.", o banner no singular, a linha "10 un · mínimo
    10 un", o Para onde foi com R$ 20,00 e Vendido "nenhuma saída", e a conferência "já estava certo"
    que não grava, seguida de −1;
  - `estoque contagem` (a–e) em desktop e celular.

## Comandos que rodaram de fato

- `npx vitest run tests/unit/estoque-contagem.test.ts tests/unit/estoque-saldo.test.ts`: RED (faltava
  o módulo), depois GREEN, 93 testes.
- `npx tsc --noEmit`, `npx eslint …` e `npm run verificar-acoes` várias vezes (rápidos).
- `npm run verificar`: **3 vezes**, a última depois do último commit, com saída 0 — lint limpo,
  `tsc` limpo, `verificar-acoes: 80 ação(ões) conferida(s), 0 violações`, `Test Files 92 passed (92)`,
  `Tests 1617 passed (1617)`, `test:migracoes` "Todas as afirmações passaram."
- **E2E: 3 invocações** (o plano previa 1):
  1. `npm run test:e2e -- --grep "estoque contagem|estoque primeira abertura|inicio"`: o passo (6)
     do serial falhou porque o teste esperava a linha aberta, e ela abre compacta (contada hoje).
     Corrigido o teste: clicar "Contar de novo" antes.
  2. O mesmo `--grep`: 67 passaram e 1 falhou — `inicio.spec.ts` "a 320px o Início não rola…" no
     celular. O `count()` não espera, e o `main` ainda estava vazio (a mesma classe de WINDOWS
     #35/#51). Corrigido: o teste espera `inicio-indice` antes de contar.
  3. `npm run test:e2e -- --grep "a 320px o Início não rola"`: 48 passaram. A cadeia `vazio-*` rodou
     inteira, com o serial `@vazio-historico` 1–6 passando de novo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O teste de 320px do Início contava os links antes de a página pintar**
- **Found during:** Tarefa 2, segunda invocação do e2e
- **Issue:** `alvos.count()` não espera. Sob carga, `main` ainda estava vazio quando o `goto` voltou,
  e a contagem deu 0.
- **Fix:** `await expect(page.getByTestId("inicio-indice")).toBeVisible()` antes de medir.
- **Files modified:** `tests/e2e/inicio.spec.ts` (fora da lista do plano; o teste está no `--grep`
  da tarefa)
- **Commit:** `6723ecb`

**2. [Rule 3 - Blocking] Arquivos fora da lista do plano**
- `lib/estoque/historico.ts` passou a exportar `horaEmBrasilia` (a hora da linha compacta usa o
  formatador que já existia ali).
- `components/amassa/estoque/barra-acao-fixa.tsx` ganhou `BotaoContarEstoque` e
  `BotaoNovoMaterialNaLista`. O `BotaoNovoMaterial` do cabeçalho some abaixo de 768px, e o do painel
  e do vazio da contagem precisa aparecer em qualquer largura.
- **Commit:** `f503c12`, `6723ecb`

**3. [Rule 2 - Correção] Recusa de custo feita pelo servidor devolve o saldo que ele viu**
- Se uma venda cai entre a página carregar e a confirmação, uma primeira contagem que a tela
  achava ≤ 0 pode ficar positiva sob a trava. A ação devolve `campo: "custou"` e o saldo do
  servidor; a linha refaz a prévia e mostra "Custou ao todo" com a frase. O plano não previa esse
  retorno.
- **Commit:** `f503c12`, `6723ecb`

### Consequência a saber (não é defeito, mas muda o dia a dia dos testes)

Num banco sem nenhuma movimentação manual, `/gestao/estoque` mostra o painel da primeira abertura
em vez da lista (UI-D3, como pedido). Na suíte completa, o serial `@vazio-historico` grava a
primeira movimentação manual antes de `desktop`/`celular`. Um `--grep` que filtre só outro spec do
Estoque (por exemplo `"estoque saldos"`) num banco efêmero novo **também roda o serial**: a
terceira invocação acima mostrou a cadeia `vazio-*` inteira rodando com um `--grep` que não
casava com ela. Por isso o risco é baixo. Se algum dia o serial deixar de rodar junto, esses specs
vão ver o painel.

## Known Stubs

Nenhum. O bloco do Início perdeu o vazio estático do GES-09 e agora faz a consulta real.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>`. A rota e a ação novas são as de T-06-44; o modo
forjado (T-06-45) e a concorrência (T-06-46) estão mitigados em `gravarContagem`; a queda do
Estoque não derruba o Início (T-06-47).

## Backstops (verificação humana, fora da automação)

- UI · loading · E9: primeira pintura da contagem no celular com mais de 60 materiais, até 1 s.
- UI · overflow · E9: a 320px, com "Custou ao todo" visível, nada corta e o botão continua com 44px.

## Self-Check: PASSED

- Arquivos criados existem: `lib/estoque/contagem.ts`, `app/gestao/(app)/estoque/contagem/{page,loading,error}.tsx`,
  `components/amassa/estoque/{lista-contagem,linha-contagem,painel-primeira-abertura}.tsx`,
  `tests/unit/estoque-contagem.test.ts`, `tests/e2e/estoque-contagem.spec.ts`.
- Os commits existem na branch `gsd/phase-06-estoque`: `0e86404`, `f503c12`, `6723ecb`.
- Os greps de aceite batem: sem import proibido em `contagem.ts`; `planejarAjuste` 3×;
  `confirmarContagem` 1×; nenhuma tabela de contagem em `db/schema.ts`; migrações = só a 0023 +
  `meta/`; `lib/inicio/textos.ts` sem import de `@/db`/`@/lib/estoque`; `@vazio-historico` 2×;
  `describe.serial` 1×; `BlocoEstoque` async 1×; `itensParaOInicio` 3×; `exigirUsuario()` na página
  da contagem 1×; `estadoDoEstoque` na página do Estoque 4×.
- STATE.md e ROADMAP.md não foram tocados (quem os edita é o orquestrador).
