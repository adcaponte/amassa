---
quick_id: 261008-pmi
description: Corrigir três avisos confirmados da auditoria de 08/10/2026 — Queimas "Lançar na Venda" duplica no reenvio; Estoque entrada de R$ 0 vira a última entrada com preço; Estoque modo da contagem decidido por qualquer linha manual
mode: quick-full
phase: quick-261008-pmi
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [AUDITORIA-0810-QUEIMAS-AVISO-1, AUDITORIA-0810-ESTOQUE-AVISO-1, AUDITORIA-0810-ESTOQUE-AVISO-2]
files_modified:
  # Tarefa 1 — Queimas: "Lançar na Venda" com o retrato das vendas ativas (Decisão 1)
  - lib/queimas/textos.ts
  - lib/queimas/gravacao.ts
  - lib/queimas/consultas.ts
  - lib/financeiro/esquemas.ts
  - lib/financeiro/textos.ts
  - lib/financeiro/acoes.ts
  - components/amassa/financeiro/painel-venda.tsx
  - app/gestao/(app)/financeiro/page.tsx
  - scripts/provar-corridas-das-queimas.ts
  - tests/unit/textos-queima.test.ts
  - tests/unit/financeiro-esquemas.test.ts
  - tests/e2e/queimas-venda.spec.ts
  # Tarefa 2 — Estoque: R$ 0 não vira referência (Decisão 2) e o modo da contagem (Decisão 3)
  - lib/estoque/custo.ts
  - lib/estoque/saldo.ts
  - lib/estoque/contagem.ts
  - lib/estoque/gravacao.ts
  - lib/estoque/consultas.ts
  - components/amassa/estoque/provedor-estoque.tsx
  - components/amassa/estoque/lista-contagem.tsx
  - tests/unit/estoque-custo.test.ts
  - tests/unit/estoque-saldo.test.ts
  - tests/unit/estoque-contagem.test.ts
  - tests/e2e/polimento-estoque.spec.ts
  - tests/e2e/estoque-contagem.spec.ts
  # Tarefa 3 — verificação final, a ÚNICA e2e, documentos de estado
  - .planning/STATE.md
  - .planning/PROXIMA-SESSAO.md
  - ESTADO-ATUAL.md                                   # fora do git (.gitignore)
  - Claude outputs/RETOMAR-AQUI.md                    # fora do git
  - Claude outputs/auditoria/ACOMPANHAMENTO.md        # fora do git
  - Claude outputs/FILA-DO-CODE.md                    # fora do git; só se houver item da auditoria

estimate:
  tokens: 150000
  raw_tokens: 300000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "Queimas (Decisão 1): a Venda aberta por “Lançar na Venda” leva os números das vendas ATIVAS da queima que a página leu (`vendasVistas`); sob `travarContagem`, `vincularQueimaNaVenda` recusa com `telaMudou` e uma frase humana citando a venda nova quando as ativas de agora são outras — um segundo toque depois de uma resposta perdida NUNCA cria uma segunda venda das mesmas peças. Provado contra Postgres (caso (13) de `scripts/provar-corridas-das-queimas.ts`, dentro de `npm run test:migracoes`) e no navegador (e2e “(auditoria 08/10) a resposta do Lançar venda se perde…”)"
    - "Queimas: a Venda com origem `queima` sem o retrato (aba velha depois do deploy) é recusada pelo esquema com frase de tela desatualizada; o retrato forjado só causa recusa ou equivale a ter visto o estado atual; a Venda manual e a da Agenda seguem exatamente como antes (sem retrato)"
    - "Queimas: na recusa `telaMudou`, a tela se atualiza (toast com a frase + `router.refresh()`; a página remonta o painel pela `key`, com o carrinho do que falta AGORA); na falha de rede o painel NÃO relê a página — o retrato continua o da abertura, e é por isso que o segundo toque é recusado"
    - "A falha de rede no “Lançar venda” nunca afirma que nada foi gravado: com origem (Queimas ou Agenda) diz que pode tocar de novo com segurança; na Venda manual pede para conferir no Caixa antes de lançar de novo; o caminho da correção fica como está"
    - "Estoque (Decisão 2): entrada com valor 0 (doação, sobra) soma quantidade e dilui o médio como hoje, mas NÃO substitui a última entrada com preço de verdade (> 0) — nem em memória (`valorarMovimento`) nem nas duas leituras do banco (`lerEstados`, `lerSaldos`). Cenário do auditor: entrada 5 kg R$ 21 → doação 1 kg → baixa 6 kg → saída de 1 kg vale R$ 4,20 (−420), nunca R$ 0; com o saldo zerado o cartão mostra “R$ 4,20/kg”"
    - "Estoque: a regra de exibição de 06.5 continua — material só com doação diz “sem custo”; material sem nenhuma entrada diz “—” (agora decidido por `teveEntrada`, lido do banco, e não pela última entrada com preço)"
    - "Estoque (Decisão 3): uma saída manual (ou uma entrada manual de R$ 0) antes da primeira contagem NÃO tira o material de “Ainda sem contagem”; ele só vai para “Conferência” depois de uma contagem (motivo `saldo_inicial` ou ajuste) ou de uma entrada manual com custo > 0. Tela (`listarParaContagem`) e servidor (`gravarContagem`, sob a trava) decidem pela MESMA função pura `tiraDaPrimeiraContagem`. Cenário do auditor: saída manual 0,5 kg → a contagem de 10 kg pergunta “Custou ao todo” e grava entrada `saldo_inicial` de 10,5 kg com o custo"
    - "Nenhuma migração (`git diff 831b0f6 --stat -- db/` vazio); `TABELAS_ESPERADAS` não muda; `exigirUsuario()` continua a primeira linha de toda Server Action; `npm run verificar` sai 0; exatamente UMA invocação de `npm run test:e2e`, com `--grep`; nada publicado (sem push)"
  artifacts:
    - path: "lib/queimas/gravacao.ts"
      provides: "vincularQueimaNaVenda(tx, queimaId, vendasVistas) confere vendasAtivasMudaram sob a trava, depois de “nada falta” e antes de cabeNoQueFalta"
      contains: "fraseVendasMudaramNaVenda"
    - path: "lib/queimas/textos.ts"
      provides: "fraseVendasMudaramNaVenda(novas) — a recusa da Venda velha, com o número da venda nova"
      contains: "export function fraseVendasMudaramNaVenda"
    - path: "lib/financeiro/esquemas.ts"
      provides: "esquemaVenda com vendasVistas obrigatório só na origem queima; FRASE_VENDA_DESATUALIZADA"
      contains: "vendasVistas"
    - path: "lib/financeiro/textos.ts"
      provides: "FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM e FRASE_VENDA_SEM_RESPOSTA"
      contains: "FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM"
    - path: "scripts/provar-corridas-das-queimas.ts"
      provides: "caso (13): Lançar na Venda repetido depois de resposta perdida; (9a) e (10) com o novo sentido"
      contains: "(13)"
    - path: "lib/estoque/custo.ts"
      provides: "valorarMovimento só atualiza ultimaEntradaComPreco com pagoCentavos > 0"
      contains: "pagoCentavos > 0"
    - path: "lib/estoque/contagem.ts"
      provides: "tiraDaPrimeiraContagem (regra pura) e modoDoMaterial({ jaTemReferencia })"
      contains: "export function tiraDaPrimeiraContagem"
    - path: "lib/estoque/saldo.ts"
      provides: "custoMedioParaExibir decide “—” por teveEntrada"
      contains: "teveEntrada"
    - path: "tests/e2e/queimas-venda.spec.ts"
      provides: "e2e da resposta perdida no Lançar venda"
      contains: "auditoria 08/10"
    - path: "tests/e2e/polimento-estoque.spec.ts"
      provides: "e2e da doação que não vira referência"
      contains: "auditoria 08/10"
    - path: "tests/e2e/estoque-contagem.spec.ts"
      provides: "e2e da saída manual antes da primeira contagem"
      contains: "auditoria 08/10"
  key_links:
    - from: "components/amassa/financeiro/painel-venda.tsx"
      to: "lib/financeiro/acoes.ts::lancarVenda"
      via: "payload leva vendasVistas quando origem.modulo === queimas; resposta telaMudou → toast + router.refresh"
      pattern: "vendasVistas"
    - from: "app/gestao/(app)/financeiro/page.tsx"
      to: "lib/queimas/consultas.ts::queimaParaVenda"
      via: "origemNoPainel.vendasVistas = venda.vendasVistas; key do PainelVenda inclui as vistas"
      pattern: "vendasVistas"
    - from: "lib/financeiro/acoes.ts::lancarVenda"
      to: "lib/queimas/gravacao.ts::vincularQueimaNaVenda"
      via: "vincularQueimaNaVenda(tx, origem.id, vendasVistas) dentro da transação; RecusaDasQueimas com telaMudou vira { ok: false, telaMudou: true }"
      pattern: "vincularQueimaNaVenda\\(tx, origem\\.id,"
    - from: "lib/queimas/gravacao.ts::vincularQueimaNaVenda"
      to: "lib/queimas/contagem.ts::vendasAtivasMudaram"
      via: "mesma regra pura do Recebi agora e da exclusão"
      pattern: "vendasAtivasMudaram"
    - from: "lib/estoque/gravacao.ts::lerEstados e lib/estoque/consultas.ts::lerSaldos"
      to: "movimentacoes_estoque.valor_informado_centavos"
      via: "gt(valorInformadoCentavos, 0) no filtro da última entrada com preço — a mesma regra de valorarMovimento"
      pattern: "gt\\(movimentacoesEstoque\\.valorInformadoCentavos, 0\\)"
    - from: "lib/estoque/gravacao.ts::gravarContagem e lib/estoque/consultas.ts::listarParaContagem"
      to: "lib/estoque/contagem.ts::tiraDaPrimeiraContagem"
      via: "as duas leem as combinações (tipo, motivo, comCusto) das linhas manuais e aplicam a MESMA função pura"
      pattern: "tiraDaPrimeiraContagem"
---

<objective>
Corrigir, com teste antes da correção, os três avisos confirmados da auditoria de 08/10/2026 (`Claude outputs/auditoria/ACOMPANHAMENTO.md`;
detalhe em `agenda-queimas.md` AVISO 1 e `estoque.md` AVISOS 1 e 2), exatamente como travado no `261008-pmi-CONTEXT.md`:

1. **Decisão 1 — Queimas › "Lançar na Venda" cobra duas vezes num reenvio depois de resposta perdida.** Reusar o padrão do
   "Recebi agora" (commit `a866128`): `vendasVistas` + `vendasAtivasMudaram` + `RecusaDasQueimas` com `telaMudou`, sem mecanismo
   novo. E a frase do `catch` do painel deixa de afirmar que nada ficou no banco quando não sabe — ajuste GERAL (pequeno e
   seguro: só texto no ramo não-correção), com a Venda manual mandando conferir no Caixa.
2. **Decisão 2 — Estoque › entrada "sem custo" (R$ 0) vira a "última entrada com preço".** Em memória e nas duas leituras do
   banco; a exibição de 06.5 ("sem custo" × "—") continua igual.
3. **Decisão 3 — Estoque › material com baixa manual antes da primeira contagem nunca pergunta "Custou ao todo".** Critério
   exato (escolha do planejador, lendo `contagem.ts`, `pedidos.ts`, `gravacao.ts`, `consultas.ts` e os testes): o material sai de
   "primeira" só com uma movimentação MANUAL que seja contagem (motivo `saldo_inicial` ou tipo `ajuste`) ou entrada com custo
   > 0. Compra, venda e produção continuam sem mexer no modo (é o que o e2e `estoque contagem (b)` — compra antes da primeira
   contagem, grupo "primeira" — fixa hoje).

Purpose: dinheiro e custo certos antes da inauguração — o sistema está em produção com os dados recém-limpos (item 10, 08/10),
então todo material é novo e os dois avisos do Estoque deixariam de ser borda.
Output: três correções no `main` LOCAL (não publicadas), testes unitários + prova contra Postgres + três e2e novas, e os
documentos de estado corrigidos com evidência.

Fora do escopo (CONTEXT): o AVISO-01 do Financeiro ("Corrigir" com mudança de data troca a taxa — espera o Theo), a nota da
Agenda (mensalidade de mês sem visita), as NOTAS dos relatórios. Nenhuma migração: se alguma correção pedir migração, PARAR e
reportar (migração é aplicada à mão pelo Theo). Nada de push; nada em produção.
</objective>

<execution_context>
@C:/Users/apont/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/apont/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261008-pmi-corrigir-avisos-da-auditoria-queimas-e-e/261008-pmi-CONTEXT.md
@.claude/CLAUDE.md
@.planning/STATE.md

Ambiente (Windows 11, Git Bash): antes de qualquer `node`/`npm`/`npx`, rodar
`eval "$(/c/Users/apont/AppData/Local/Microsoft/WinGet/Packages/Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe/fnm env --shell bash)"; fnm use 24.19.0 >/dev/null`.
Docker precisa estar de pé (`test:migracoes` e `test:e2e` sobem Postgres efêmero). `.env.local` não é legível por permissão — não
tente ler. Trabalhar no `main`, sem worktree, sem push. Base desta tarefa: `831b0f6`.

Lições da memória que valem aqui:
- `.next/types` velhos dão TS2307 no `tsc` → apagar `.next/types` e rodar de novo.
- Contêiner `amassa_app_e2e` velho na porta 3000 faz o e2e testar imagem velha → `docker ps` antes do e2e.
- "Hoje" no e2e é `hojeNoAtelie()`, nunca `toISOString()`.
- STATE.md à mão (as ferramentas do gsd corrompem). `index.lock` órfão no git: conferir a idade e remover.

Modelo da correção das Queimas (ler o diff inteiro antes da Tarefa 1): `git show a866128` — sobretudo
`lib/queimas/gravacao.ts::cobrarQueimaNaTransacao`, `components/amassa/queimas/folha-recebi-queima.tsx` (o `catch` e o
`telaMudou`), `tests/e2e/queimas-cobranca.spec.ts` (o teste WR-02 que perde a resposta com `route.fetch()` + `route.abort`) e o
caso (12) de `scripts/provar-corridas-das-queimas.ts`.

Interfaces atuais (extraídas do código em `831b0f6`):
- `lib/queimas/gravacao.ts`: `vincularQueimaNaVenda(tx: TransacaoDoBanco, queimaId: string): Promise<VinculoDaQueimaNaVenda>`;
  `cobrarQueimaNaTransacao` faz, depois de "nada falta": `if (vendasAtivasMudaram(travada.vendas, pedido.vendasVistas))` →
  `novas = numerosDasVendasAtivas(travada.vendas).filter(n => !vistas.has(n))` → `throw new RecusaDasQueimas(fraseVendasMudaram(novas), { telaMudou: true })`.
- `lib/queimas/contagem.ts`: `vendasAtivasMudaram(vendas, vistas): boolean`, `numerosDasVendasAtivas(vendas): number[]`.
- `lib/queimas/textos.ts`: `fraseVendasMudaram(novas)` (fala de "folha"), `nomeDasVendas(numeros)` ("venda nº 7" / "vendas nº 12 e 15"),
  `FRASE_RECEBER_SEM_RESPOSTA`.
- `lib/queimas/consultas.ts`: `queimaParaVenda(queimaId, hoje): Promise<VendaDaQueima>`; o ramo `situacao: "livre"` já tem as `vendas`
  lidas (`lerVendasLigadas`).
- `lib/financeiro/acoes.ts`: `ResultadoDoLancamento<T> = { ok: true; dados: T } | { ok: false; erro: string; motivoDaCorrecao?: MotivoDaCorrecaoNaTela }`;
  ramo `if (!ehOrigemDaAgenda(origem))` chama `vincularQueimaNaVenda(tx, origem.id)`; o `catch` traduz `RecusaDasQueimas` em `{ ok: false, erro: erro.frase }`.
- `lib/financeiro/esquemas.ts`: `esquemaVendaEntrada` (campo `origem: z.string().optional()`, `correcao`), `esquemaVenda = esquemaVendaEntrada.transform(...)`
  devolve `{ data, pessoa, linhas, parcelas, desconto, origem, correcao }`; não importa nada de `lib/queimas` (D-15 do projeto: cada módulo com a sua cópia).
- `components/amassa/financeiro/painel-venda.tsx`: `OrigemNoPainel = { modulo; origem; descricao; nome; vencimento; itensDaOrigem }`;
  `aoLancar()` → `lancarVenda({... , ...(origem !== null && comOrigem ? { origem: origem.origem } : {}) })`; `catch` (linhas ~859-867)
  usa `FRASE_FALHA_AO_SALVAR` fora da correção. O painel hoje não importa `useRouter` nem `toast`.
- `app/gestao/(app)/financeiro/page.tsx` (~440-460): monta `origemNoPainel`; `<PainelVenda key={correcao ? ... : origemNoPainel ? origemNoPainel.origem : "manual"}>`.
- `lib/estoque/custo.ts`: `valorarMovimento` (linhas ~158-162) faz da entrada `entrada_com_preco` a `ultimaEntradaComPreco` sem olhar o valor.
- `lib/estoque/gravacao.ts`: `lerEstados` (~128-180, `selectDistinctOn` com `tipo = 'entrada'` e `estornoDeId is null`); `gravarContagem` (~490-520) decide
  o modo por QUALQUER linha `origem = 'manual'`.
- `lib/estoque/consultas.ts`: `lerSaldos` (~100-175, mesma leitura da última entrada); `SaldoDoItem`; `listarParaContagem` (~648-708,
  `comManual` = qualquer linha manual); `estadoDoEstoque` (global, UI-D3 "primeira abertura" — NÃO muda).
- `lib/estoque/contagem.ts`: `modoDoMaterial({ temManual })`; `MaterialParaContagem.temManual`; `agruparContagem` chama `modoDoMaterial(item)`.
- `lib/estoque/saldo.ts`: `SaldoParaLista` (com `ultimaEntradaComPreco`); `custoMedioParaExibir(item)` devolve `null` ("—") quando
  `ultimaEntradaComPreco === null`; `lib/estoque/textos.ts::rotuloDoCustoMedio`: `null` → "—", `0` → "sem custo".
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Tarefa 1: Queimas — "Lançar na Venda" leva o retrato das vendas ativas e recusa o reenvio sob a trava (Decisão 1)</name>
  <files>lib/queimas/textos.ts, lib/queimas/gravacao.ts, lib/queimas/consultas.ts, lib/financeiro/esquemas.ts, lib/financeiro/textos.ts, lib/financeiro/acoes.ts, components/amassa/financeiro/painel-venda.tsx, app/gestao/(app)/financeiro/page.tsx, scripts/provar-corridas-das-queimas.ts, tests/unit/textos-queima.test.ts, tests/unit/financeiro-esquemas.test.ts, tests/e2e/queimas-venda.spec.ts</files>
  <read_first>
    - `git show a866128` (a correção modelo, inteira)
    - lib/queimas/gravacao.ts (cabeçalho 1-40, `cobrarQueimaNaTransacao` ~356-400, `excluirQueimaNaTransacao` ~480-497, `vincularQueimaNaVenda` ~500-573)
    - lib/queimas/textos.ts (~370-390 `nomeDasVendas`; ~580-620 frases da tela velha; ~740-760 frases da Venda das Queimas)
    - lib/queimas/consultas.ts (~820-905, `VendaDaQueima` e `queimaParaVenda`)
    - lib/financeiro/esquemas.ts (~125-337), lib/financeiro/acoes.ts (~80-110 e ~147-432), lib/financeiro/textos.ts (~270-280)
    - components/amassa/financeiro/painel-venda.tsx (~95-130 tipos; ~265-280; ~805-925 `aoLancar`)
    - app/gestao/(app)/financeiro/page.tsx (~240-300 e ~436-470 e ~780-805)
    - scripts/provar-corridas-das-queimas.ts (~140-210 `cobrar`/`lancar`; ~540-665 casos 9-12; ~716-784 `main`)
    - tests/e2e/queimas-cobranca.spec.ts (~390-445, o WR-02) e tests/e2e/queimas-venda.spec.ts (~1-100 apoios; ~226-306 "venda: bordas")
  </read_first>
  <behavior>
    - fraseVendasMudaramNaVenda([10]) contém "venda nº 10", "desde que esta Venda abriu", "já valeu" e "antes de lançar de novo"; não contém "folha"
    - fraseVendasMudaramNaVenda([10, 11]) contém "vendas nº 10 e 11"; fraseVendasMudaramNaVenda([]) diz que as vendas mudaram e que a tela foi atualizada
    - esquemaVenda com origem "queima:{uuid}" SEM vendasVistas → falha com FRASE_VENDA_DESATUALIZADA
    - esquemaVenda com origem "queima:{uuid}" e vendasVistas [3, 7] → sucesso, data.vendasVistas = [3, 7]; com [] → sucesso, data.vendasVistas = []
    - vendasVistas com origem "mensalidade:{uuid}", sem origem, ou junto de correcao → falha (pedido forjado); 0, negativo, fracionário ou 501 itens → falha
    - Venda manual sem vendasVistas → sucesso com data.vendasVistas = null (nada muda para a Venda manual e a da Agenda)
    - FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM e FRASE_VENDA_SEM_RESPOSTA contêm "conexão falhou"; a com origem diz que pode tocar de novo; a manual cita o Caixa; nenhuma das duas começa por "Não deu para salvar"
    - (Postgres, caso 13) 5 P; Lançar 2 P com vistas [] grava a nº N; repetir com [] é recusado com telaMudou citando "venda nº N"; Σ ativa P = 2 num vínculo; repetir com [N] passa (Σ = 4, dois vínculos)
  </behavior>
  <action>
    RED primeiro (o executor VÊ falhar e registra no SUMMARY):
    1. `tests/unit/textos-queima.test.ts`: novo `describe("Lançar na Venda repetido (auditoria 08/10, aviso 1)")` com os casos de
       `fraseVendasMudaramNaVenda` do `<behavior>`.
    2. `tests/unit/financeiro-esquemas.test.ts`: novo `describe("esquemaVenda — o retrato das Queimas (auditoria 08/10)")` com os
       casos de `vendasVistas` do `<behavior>` (use um uuid fixo inventado e linhas/parcelas mínimas válidas, no molde dos testes de
       `correcao` já existentes no arquivo) e um `describe` para as duas frases de rede de `lib/financeiro/textos.ts`.
    3. Rodar `npx vitest run tests/unit/textos-queima.test.ts tests/unit/financeiro-esquemas.test.ts` → falha (exports inexistentes /
       esquema aceita sem retrato). Commit `test(quick-261008-pmi): o reenvio do Lançar na Venda e as frases de rede — vermelho`.

    GREEN, de baixo para cima (o fio inteiro, uma origem só — a das Queimas):
    4. `lib/queimas/textos.ts`: `fraseVendasMudaramNaVenda(novas: readonly number[])` ao lado de `fraseVendasMudaram`, usando
       `nomeDasVendas`, no tom das frases vizinhas (português do Brasil, diz o que fazer). Comentário: auditoria 08/10, aviso 1.
    5. `lib/queimas/gravacao.ts::vincularQueimaNaVenda`: novo parâmetro `vendasVistas: readonly number[]`. Depois da recusa de "nada
       falta" (`fraseOrigemQueimaTudoLancado`) e ANTES de ler os itens e de devolver `conferir` (que faz `cabeNoQueFalta`), a mesma
       conferência de `cobrarQueimaNaTransacao`: `vendasAtivasMudaram(travada.vendas, vendasVistas)` → `novas` = ativas que não
       estão nas vistas → `throw new RecusaDasQueimas(fraseVendasMudaramNaVenda(novas), { telaMudou: true })`. Atualizar o comentário
       do cabeçalho (o parágrafo da CONCORRÊNCIA OTIMISTA passa a citar o "Lançar na Venda", quick 261008-pmi) e o comentário de
       recusas acima de `VinculoDaQueimaNaVenda`. Atualizar também o comentário de `vendasAtivasMudaram` em
       `lib/queimas/contagem.ts` se ele listar só "Recebi agora e excluir" (é um comentário; a função não muda).
    6. `lib/queimas/consultas.ts`: o ramo `situacao: "livre"` de `VendaDaQueima` ganha `vendasVistas: number[]` =
       `numerosDasVendasAtivas(vendas)` (importar de `@/lib/queimas/contagem`, já importado lá), com comentário (o retrato que a Venda
       leva de volta; congelado pela página).
    7. `lib/financeiro/esquemas.ts`: `export const FRASE_VENDA_DESATUALIZADA` (ex.: "Esta Venda está desatualizada — volte às Queimas e
       toque em “Lançar na Venda” de novo."); em `esquemaVendaEntrada`, `vendasVistas` opcional — array de inteiros positivos, no
       máximo 500, toda mensagem = `FRASE_VENDA_DESATUALIZADA` — REDECLARADO aqui (nenhum import de `lib/queimas`, D-15 do projeto);
       no `transform`: origem do tipo `queima` sem `vendasVistas` → issue; `vendasVistas` presente sem origem `queima` (sem origem,
       origem da Agenda, ou com `correcao`) → issue (pedido forjado — a tela nunca manda); saída ganha `vendasVistas: number[] | null`.
       Atualizar o comentário do campo `origem` (hoje fala só da Agenda).
    8. `lib/financeiro/textos.ts`: `FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM` (ex.: "Não deu para confirmar se a venda foi lançada — a
       conexão falhou. Pode tocar em “Lançar venda” de novo: se ela já tiver entrado, a tela avisa e não lança outra.") e
       `FRASE_VENDA_SEM_RESPOSTA` para a Venda manual (ex.: "Não deu para confirmar se a venda foi lançada — a conexão falhou. Antes
       de lançar de novo, confira no Caixa se ela já aparece."). A da Agenda é segura porque `vincularCobranca` recusa a cobrança já
       lançada; a manual não tem proteção (pendência registrada na Tarefa 3).
    9. `lib/financeiro/acoes.ts::lancarVenda`: `exigirUsuario()` continua a PRIMEIRA instrução. `ResultadoDoLancamento` ganha
       `telaMudou?: true` no ramo `ok: false`. No ramo das Queimas: `vincularQueimaNaVenda(tx, origem.id, vistas)` com as vistas do
       esquema — se vierem `null` ali (não deve acontecer, o esquema recusa), recusar com `FRASE_VENDA_DESATUALIZADA`; nunca pular a
       conferência. No `catch`: `RecusaDasQueimas` com `detalhe?.telaMudou` → `{ ok: false, erro: erro.frase, telaMudou: true }`;
       as outras recusas como hoje. Atualizar o comentário do ramo das Queimas.
    10. `components/amassa/financeiro/painel-venda.tsx`: `OrigemNoPainel` ganha `vendasVistas: readonly number[] | null` (Queimas: os
        números que a página leu; Agenda: `null`), com comentário. Em `aoLancar`, quando há origem, mandar `vendasVistas` (cópia do
        array) só se não for `null`. Resposta `!ok` com `telaMudou` → `toast.error(resposta.erro)` + `router.refresh()`
        (`useRouter` de `next/navigation`, `toast` de `sonner`, como `folha-recebi-queima.tsx`) e `return` — comentário explicando
        que é o único ponto em que o painel relê a página e que a `key` da página o remonta com o carrinho do que falta agora. No
        `catch` (fora da correção, que fica intacta): com origem → `FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM`; manual →
        `FRASE_VENDA_SEM_RESPOSTA`; SEM `router.refresh()` (o retrato precisa continuar o da abertura — é ele que faz o segundo toque
        ser recusado). Reescrever o comentário do `catch`: a chamada pode ter chegado e gravado; o que torna tocar de novo seguro com
        origem; por que a manual manda ao Caixa. Remover o import de `FRASE_FALHA_AO_SALVAR` se ficar sem uso (lint).
    11. `app/gestao/(app)/financeiro/page.tsx`: `origemNoPainel` das Queimas leva `vendasVistas: vendaDaOrigem.venda.vendasVistas`; o da
        Agenda, `vendasVistas: null`. A `key` do `PainelVenda` para a origem das Queimas passa a incluir as vistas (ex.: o texto da
        origem + ":" + os números unidos por vírgula) — uma releitura que vê outras vendas remonta o painel com o carrinho e o retrato
        novos; a da Agenda e a manual ficam como estão. Atualizar o comentário da `key`.
    12. `scripts/provar-corridas-das-queimas.ts`: `lancar(tx, queimaId, quantidades, vistas: readonly number[])` passa as vistas a
        `vincularQueimaNaVenda`. Casos que MUDAM DE SENTIDO (registrar no SUMMARY, como `a866128` fez com (1), (2) e (9b)):
        (9a) o "Lançar" de uma tela aberta antes do "Recebi" (`[]`) passa a ser recusado com `telaMudou` citando a venda do Recebi; e
        um segundo "Lançar" com as vistas relidas (`[a.numero]`) cai em "só faltam 1 P" — preserva a cobertura de `cabeNoQueFalta`;
        (9b) o "Lançar" trava primeiro com `[]` (nenhuma venda ainda) e passa, como antes; (10) o "Lançar" sobreposto com `[]` passa a
        ser recusado (tela velha) e, relido (`[numero do Recebi]`), passa — dois vínculos, Σ P = 3, preservando "as partes cabem
        juntas". Caso NOVO (13), molde do (12): 5 P; "Lançar" 2 P com `[]` grava a nº N; repetido com `[]` → recusado com `telaMudou`
        citando "venda nº N"; Σ ativa P = 2 num vínculo; com `[N]` → passa, Σ = 4 em dois vínculos. Incluir `["(13)", ...]` em `casos`
        e corrigir o comentário que diz que o "Lançar na Venda" não manda retrato.
    13. `tests/e2e/queimas-venda.spec.ts`: no `describe("cobrança da queima — venda: bordas")`, novo teste com título começando por
        "(auditoria 08/10)" — ex.: "(auditoria 08/10) a resposta do Lançar venda se perde — a tela diz o que fazer, e o segundo toque é
        recusado citando a venda, sem criar outra". Passos (molde do WR-02 de `queimas-cobranca.spec.ts`): `travarPrecosDasQueimas`;
        `semearQueimaComExternas(..., { p: 5 })`; `page.goto(hrefDaVendaComOrigem({ tipo: "queima", id }))`; baixar P de 5 para 2 com o
        botão "menos um" (`ROTULO_MENOS_UM`) da linha; interceptar SÓ o primeiro POST com cabeçalho `next-action` (`route.fetch()` e
        depois `route.abort("failed")`); tocar "Lançar venda"; esperar o alerta com `FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM`; conferir
        por `lerVendasDaQueima` que há 1 venda com `quantidadeP` 2; `unroute`; tocar "Lançar venda" de novo; esperar o texto de
        `fraseVendasMudaramNaVenda([numero])`; conferir que continua 1 venda; e que o painel remontou com o que falta agora (a linha de
        P com quantidade "3"). `finally` solta a trava. NÃO rodar o e2e nesta tarefa — a única invocação é a da Tarefa 3.

    Rodar o `<verify>`. Commit `fix(queimas): Lançar na Venda recusa o reenvio depois de resposta perdida — o retrato das vendas
    ativas sob a trava (quick 261008-pmi, auditoria 08/10 aviso 1)`, terminando com a linha
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/textos-queima.test.ts tests/unit/financeiro-esquemas.test.ts tests/unit/queimas-contagem.test.ts tests/unit/esquemas-queima.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npm run lint</automated>
    <automated>npm run verificar-acoes</automated>
    <automated>npm run test:migracoes</automated>
    <automated>grep -n "vendasAtivasMudaram" lib/queimas/gravacao.ts</automated>
    <automated>grep -n "vincularQueimaNaVenda(tx, origem.id," lib/financeiro/acoes.ts</automated>
    <automated>grep -n "vendasVistas" lib/financeiro/esquemas.ts lib/queimas/consultas.ts components/amassa/financeiro/painel-venda.tsx "app/gestao/(app)/financeiro/page.tsx"</automated>
    <automated>grep -n "\"(13)\"" scripts/provar-corridas-das-queimas.ts</automated>
    <automated>grep -n "FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM\|FRASE_VENDA_SEM_RESPOSTA\b\|telaMudou\|router.refresh" components/amassa/financeiro/painel-venda.tsx</automated>
  </verify>
  <done>
    RED visto (saída das falhas registrada no SUMMARY) e depois verde nos quatro arquivos de unidade; `tsc`, `lint` e
    `verificar-acoes` limpos; `npm run test:migracoes` sai 0 com "(13)" e os (9a)/(10) reescritos passando ("Corridas das Queimas:
    todas as afirmações passaram."); `vendasAtivasMudaram` é chamada em `lib/queimas/gravacao.ts` por `cobrarQueimaNaTransacao`,
    `excluirQueimaNaTransacao` e `vincularQueimaNaVenda` (três chamadas, além do import);
    o painel usa as duas frases novas no `catch`, trata `telaMudou` com `router.refresh()` e o comentário do `catch` não afirma mais
    que a chamada não chegou; e2e nova escrita (não rodada); dois commits (vermelho e verde) no `main` local.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Estoque — entrada de R$ 0 não vira referência de custo (Decisão 2) e baixa manual não tira o material da primeira contagem (Decisão 3)</name>
  <files>lib/estoque/custo.ts, lib/estoque/saldo.ts, lib/estoque/contagem.ts, lib/estoque/gravacao.ts, lib/estoque/consultas.ts, components/amassa/estoque/provedor-estoque.tsx, components/amassa/estoque/lista-contagem.tsx, tests/unit/estoque-custo.test.ts, tests/unit/estoque-saldo.test.ts, tests/unit/estoque-contagem.test.ts, tests/e2e/polimento-estoque.spec.ts, tests/e2e/estoque-contagem.spec.ts</files>
  <read_first>
    - lib/estoque/custo.ts (inteiro, 227 linhas — as linhas citadas pelo auditor não batem; o trecho é ~158-162)
    - lib/estoque/gravacao.ts (~120-180 `lerEstados`; ~470-562 `gravarContagem`)
    - lib/estoque/consultas.ts (~40-175 `SaldoDoItem`/`lerSaldos`; ~510-545 `resumoDoMaterial`; ~570-600 `estadoDoEstoque`; ~620-708 contagem)
    - lib/estoque/contagem.ts (1-140 e 160-215), lib/estoque/saldo.ts (~38-50 `SaldoParaLista`; ~288-305 `custoMedioParaExibir`), lib/estoque/textos.ts (~110-135 `rotuloDoCustoMedio`)
    - lib/estoque/pedidos.ts (~50-200: entrada manual com custo 0 → `entrada_com_preco` com `pagoCentavos: 0`; contagem; ajuste)
    - components/amassa/estoque/lista-contagem.tsx (~70-85), components/amassa/estoque/linha-contagem.tsx (~95-110), components/amassa/estoque/provedor-estoque.tsx (~105-120)
    - tests/unit/estoque-custo.test.ts (~1-60 apoios; ~495-575 WR-01/WR-02), tests/unit/estoque-saldo.test.ts (~30-45; ~349-364), tests/unit/estoque-contagem.test.ts (~25-50; ~180-215)
    - tests/e2e/polimento-estoque.spec.ts (1-125) e tests/e2e/estoque-contagem.spec.ts (1-110 apoios; ~299-420), tests/e2e/apoio/semear-estoque.ts (`movimentacoesDoItem`, `contagensDoItem`, `saldoNoBanco`, `semearMaterial*`), lib/estoque/destinos.ts
  </read_first>
  <behavior>
    - valorarMovimento em cadeia a partir de ESTADO_VAZIO: entrada_com_preco 5000/2100 → entrada_com_preco 1000/0 (estado: Q 6000, V 2100, ultimaEntradaComPreco {2100, 5000}) → saida 6000 (Q 0, V 0) → saida 1000 vale −420
    - a primeira entrada de um material com pagoCentavos 0 deixa ultimaEntradaComPreco null; com Q > 0 a entrada de R$ 0 dilui o médio como hoje (V não muda, Q sobe)
    - custoMedioParaExibir: só doação (Q 5000, V 0, ultima null, teveEntrada true) → 0 ("sem custo"); compra+doação+baixa total (Q 0, V 0, ultima {2100, 5000}, teveEntrada true) → 420; nunca entrou (Q −160, teveEntrada false) → null ("—"); doação e baixa total (Q 0, ultima null, teveEntrada true) → 0
    - tiraDaPrimeiraContagem: saída manual → false; entrada manual sem custo (comCusto false, sem motivo) → false; entrada manual com custo → true; motivo saldo_inicial (entrada de R$ 0 ou ajuste) → true; ajuste sem motivo → true; entrada peca_pronta com custo → true, sem custo → false
    - modoDoMaterial({ jaTemReferencia: false }) → "primeira"; { jaTemReferencia: true } → "conferencia"; agruparContagem separa pelo campo novo
  </behavior>
  <action>
    RED primeiro (o executor VÊ falhar e registra no SUMMARY):
    1. `tests/unit/estoque-custo.test.ts`: `describe("auditoria 08/10, aviso 1 — a entrada de R$ 0 não vira a referência de custo")` com
       a cadeia do auditor e os dois casos de R$ 0 do `<behavior>` (mais `custoMedioCentavosPorUnidade` com Q 0 depois da doação = 420).
    2. `tests/unit/estoque-saldo.test.ts`: o apoio `item()` ganha `teveEntrada: false` por padrão; o caso existente "com entrada com
       preço → 420" passa `teveEntrada: true`; novos casos de `custoMedioParaExibir` do `<behavior>`.
    3. `tests/unit/estoque-contagem.test.ts`: o apoio `material()` troca o campo do modo pelo novo `jaTemReferencia`; os testes de
       `modoDoMaterial` e de `agruparContagem` passam a usá-lo; novo `describe("tiraDaPrimeiraContagem (auditoria 08/10, aviso 2)")`.
    4. Rodar `npx vitest run tests/unit/estoque-custo.test.ts tests/unit/estoque-saldo.test.ts tests/unit/estoque-contagem.test.ts` →
       falha. Commit `test(quick-261008-pmi): doação como referência e o modo da contagem — vermelho`.

    GREEN — Decisão 2 (custo):
    5. `lib/estoque/custo.ts::valorarMovimento`: só uma `entrada_com_preco` com `pagoCentavos > 0` vira `ultimaEntradaComPreco`; R2/R3/R4
       (a diluição do médio) NÃO mudam. Atualizar os comentários: o "Estado" do cabeçalho (a última entrada com preço nunca é o estorno
       de uma venda NEM uma entrada de R$ 0 — auditoria 08/10, aviso 1), o comentário da união `Movimento` ("Só ela vira a última
       entrada com preço" → só com pago > 0; a de R$ 0, D-04, soma quantidade e dilui o médio, mas não é referência).
    6. `lib/estoque/gravacao.ts::lerEstados` e `lib/estoque/consultas.ts::lerSaldos`: no filtro da última entrada, acrescentar
       `gt(movimentacoesEstoque.valorInformadoCentavos, 0)` (importar `gt` de `drizzle-orm`), com comentário "a mesma regra de
       `valorarMovimento`". Isso também fecha a suspeita do auditor da compra de R$ 0 (hoje inalcançável).
    7. Exibição (preservar 06.5 — "sem custo" × "—", e2e `polimento estoque`): `SaldoParaLista` (`lib/estoque/saldo.ts`) e `SaldoDoItem`
       (`lib/estoque/consultas.ts`) ganham `teveEntrada: boolean` (houve alguma linha `tipo = 'entrada'` não estorno, de qualquer valor —
       o significado que a última entrada tinha até hoje); `lerSaldos` o lê numa 4ª consulta do mesmo `Promise.all`
       (`selectDistinct` do `itemId` com `tipo = 'entrada'` e `estornoDeId is null`, casada por `Set`). `custoMedioParaExibir` passa a:
       sem `teveEntrada` → `null` ("—"); senão `custoMedioCentavosPorUnidade(...)` e, se ela der `null` (saldo zero e nenhuma entrada com
       preço > 0, só doações), `0` ("sem custo"). Atualizar o comentário. `components/amassa/estoque/provedor-estoque.tsx::saldoDoMaterialNovo`
       ganha `teveEntrada: false`. Os outros consumidores (`folha-movimentacao.tsx`, `folha-baixa.tsx`, `resumoDoMaterial`) seguem por
       tipo — o `tsc` aponta qualquer construção de `SaldoDoItem` esquecida.

    GREEN — Decisão 3 (modo da contagem):
    8. `lib/estoque/contagem.ts`: tipo `MovimentacaoParaOModo = { tipo: "entrada" | "saida" | "ajuste"; motivo: "saldo_inicial" |
       "peca_pronta" | null; comCusto: boolean }` e `export function tiraDaPrimeiraContagem(m)`: verdadeiro para `motivo ===
       "saldo_inicial"`, para `tipo === "ajuste"` e para `tipo === "entrada"` com `comCusto`; falso para saída e entrada sem custo.
       `modoDoMaterial({ jaTemReferencia })` (o parâmetro troca de nome); `MaterialParaContagem` troca o campo do modo por
       `jaTemReferencia`. Reescrever o comentário do cabeçalho (hoje: "material sem nenhuma movimentação manual está na primeira
       contagem") com o critério novo e o porquê (auditoria 08/10, aviso 2: uma baixa para aula antes de contar punha o material em
       conferência e a contagem gravava ajuste a taxa 0).
    9. `lib/estoque/gravacao.ts::gravarContagem`: no lugar da consulta "existe linha manual", um `selectDistinct` de `tipo`, `motivo` e
       `comCusto` (`sql<boolean>` com `coalesce(valor_informado_centavos > 0, false)`) das linhas `origem = 'manual'` do item, lido
       DEPOIS da trava como hoje; `jaTemReferencia = linhas.some(tiraDaPrimeiraContagem)`. O modo continua decidido no servidor, sob a
       trava (T-06-45). Atualizar o comentário.
    10. `lib/estoque/consultas.ts::listarParaContagem`: no lugar de `comManual`, o mesmo `selectDistinct` (com `itemId`) para os ids;
        o conjunto de itens em que alguma combinação `tiraDaPrimeiraContagem`; o campo devolvido é `jaTemReferencia` (comentário do
        tipo `MaterialDaContagem` atualizado). `estadoDoEstoque` (o painel GLOBAL da primeira abertura, UI-D3) NÃO muda — não decide o
        modo de material nenhum.
    11. `components/amassa/estoque/lista-contagem.tsx`: o mapa congelado na carga passa a guardar `jaTemReferencia` (renomear a variável
        e o comentário: confirmar uma primeira contagem dá referência ao material e ele não pode pular de grupo no meio da contagem).
        `linha-contagem.tsx` não precisa mudar (`modoDoMaterial(item)` segue pelo tipo) — se o `tsc` pedir, ajuste e registre.

    e2e (escritas aqui, rodadas UMA vez na Tarefa 3; títulos começando por "(auditoria 08/10)"; cada teste com o SEU material, sufixo
    único, nenhuma afirmação global):
    12. `tests/e2e/polimento-estoque.spec.ts`, dentro de `describe("polimento estoque — custo")`: material em kg (`semearMaterial`);
        entrada 5 kg com custo "21,00" (`registrarEntrada`); entrada 1 kg com o custo vazio; saída de 6 kg pela folha (destino válido de
        `lib/estoque/destinos.ts`, ex. "perda"); o cartão mostra `${formatarReais(420)}/kg` (nunca "sem custo" nem "R$ 0,00/kg"); saída
        de 1 kg; a última linha de `movimentacoesDoItem` tem `valorCentavos` −420.
    13. `tests/e2e/estoque-contagem.spec.ts`, dentro de `describe("estoque contagem")` (nunca no bloco serial `@vazio-historico`):
        material em kg sem movimentação; saída manual de "0,5" pela folha (abrir `/gestao/estoque` e buscar pelo sufixo antes de
        `saidaPelaFolha`); `saldoNoBanco` = −500; na contagem a linha está em `contagem-grupo-primeira`; contado "10" → `contagem-custou`
        visível; custo "40,00"; confirmar → "✓ Contado: 10 kg"; a última de `contagensDoItem` é `{ origem: "manual", tipo: "entrada",
        motivo: "saldo_inicial", quantidadeMilesimos: 10500, valorInformadoCentavos: 4000, saldoContadoMilesimos: 10000 }`; saldo 10000.

    Rodar o `<verify>`. Commit `fix(estoque): entrada de R$ 0 não vira referência de custo e baixa manual não tira o material da
    primeira contagem (quick 261008-pmi, auditoria 08/10 avisos 1 e 2)`, com a linha
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push. Se em algum ponto a correção parecer pedir migração, PARAR e
    reportar.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/estoque-custo.test.ts tests/unit/estoque-saldo.test.ts tests/unit/estoque-contagem.test.ts tests/unit/estoque-textos.test.ts tests/unit/estoque-pedidos.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npm run lint</automated>
    <automated>npm test</automated>
    <automated>grep -n "pagoCentavos > 0" lib/estoque/custo.ts</automated>
    <automated>grep -n "gt(movimentacoesEstoque.valorInformadoCentavos, 0)" lib/estoque/gravacao.ts lib/estoque/consultas.ts</automated>
    <automated>grep -n "tiraDaPrimeiraContagem" lib/estoque/contagem.ts lib/estoque/gravacao.ts lib/estoque/consultas.ts</automated>
    <automated>grep -n "jaTemReferencia" lib/estoque/contagem.ts lib/estoque/consultas.ts lib/estoque/gravacao.ts components/amassa/estoque/lista-contagem.tsx</automated>
    <automated>grep -n "teveEntrada" lib/estoque/saldo.ts lib/estoque/consultas.ts components/amassa/estoque/provedor-estoque.tsx</automated>
    <automated>git diff 831b0f6 --stat -- db/</automated>
  </verify>
  <done>
    RED visto e registrado, depois verde; `npm test` inteiro verde; `tsc` e `lint` limpos; `pagoCentavos > 0` em `custo.ts`; o filtro
    `gt(...valorInformadoCentavos, 0)` nas DUAS leituras; `tiraDaPrimeiraContagem` definida em `contagem.ts` e usada em `gravacao.ts`
    e `consultas.ts`; `teveEntrada` em `saldo.ts`, `consultas.ts` e `provedor-estoque.tsx`; `git diff 831b0f6 --stat -- db/` vazio;
    duas e2e novas escritas (não rodadas); dois commits (vermelho e verde) no `main` local.
  </done>
</task>

<task type="auto">
  <name>Tarefa 3: verificação final, a ÚNICA invocação de e2e, e os documentos de estado com evidência</name>
  <files>.planning/STATE.md, .planning/PROXIMA-SESSAO.md, ESTADO-ATUAL.md, Claude outputs/RETOMAR-AQUI.md, Claude outputs/auditoria/ACOMPANHAMENTO.md, Claude outputs/FILA-DO-CODE.md</files>
  <precondition>Docker de pé (`docker info` responde) — `test:migracoes` e `test:e2e` sobem Postgres efêmero; Tarefas 1 e 2 commitadas.</precondition>
  <read_first>
    - .claude/CLAUDE.md (seção Conventions: documento de estado, `npm run verificar`, o imposto do e2e)
    - .planning/STATE.md (frontmatter 1-20; "### Quick Tasks Completed" ~1799; "### Pending Todos" ~1715; "### Blockers/Concerns" ~1782 — ler por trechos, o arquivo tem ~1890 linhas)
    - .planning/PROXIMA-SESSAO.md, ESTADO-ATUAL.md, Claude outputs/RETOMAR-AQUI.md, Claude outputs/auditoria/ACOMPANHAMENTO.md (inteiros)
    - Claude outputs/FILA-DO-CODE.md (só `grep -n -i "auditoria"` para achar item correspondente)
  </read_first>
  <action>
    1. `npm run verificar` (lint, `tsc --noEmit`, `verificar-acoes`, unidade e `test:migracoes`) → sai 0. TS2307 de `.next/types` velho:
       apagar `.next/types` e rodar de novo. Qualquer falha real: corrigir no arquivo da tarefa de origem, commit
       `fix(quick-261008-pmi): ...`, e registrar no SUMMARY.
    2. `docker ps` — se houver `amassa_app_e2e` velho ocupando a porta 3000, derrubá-lo antes (lição da memória).
    3. A ÚNICA invocação de e2e desta tarefa inteira (CLAUDE.md: ~53 s fixos de Postgres + `next build`; a varredura completa é coisa de
       fim de fase, não de quick): `npm run test:e2e -- --grep "auditoria 08/10|estoque contagem|polimento estoque|lan.ar na venda|venda: bordas"`
       — pega as três e2e novas, os vizinhos da Venda das Queimas (inclusive os títulos com "Lançar na Venda" da Agenda, que passam pelo
       mesmo `PainelVenda`), a contagem e o "sem custo" de 06.5; o bloco serial `@vazio-historico` fica de fora de propósito. Se algo
       falhar e for preciso rodar de novo para diagnosticar, rodar (a regra é sobre o padrão) e registrar no SUMMARY cada comando rodado
       de fato, com a contagem passou/falhou.
    4. Evidência para os documentos: `git diff 831b0f6 --stat -- db/` (vazio = nenhuma migração); `git fetch origin` e
       `git log origin/main..main --oneline` (os commits desta tarefa, NÃO publicados); `git log --oneline -6`.
    5. Documentos de estado — regra do dono (CLAUDE.md): corrigir afirmação de estado atual, preservar a narrativa histórica (linha que
       muda ganha "*Até 08/10/2026 (tarde) dizia: …*"), e toda afirmação nova com a evidência (hash, nome do teste, saída do comando):
       - `.planning/STATE.md`, À MÃO com Edit (nunca as ferramentas do gsd): `stopped_at` (o presente: os três avisos corrigidos no
         `main` local pela quick 261008-pmi, com os hashes, não publicados; próximo: o Theo decide publicar — push e pipeline, sem
         migração), `last_updated`, `last_activity`; uma linha nova em "### Quick Tasks Completed"; em Pending Todos/Blockers, o que
         falar dos avisos da auditoria passa a dizer corrigido-não-publicado, e entram as três pendências do item 6.
       - `.planning/PROXIMA-SESSAO.md`: o que vem a seguir (publicar quando o Theo quiser — nenhuma migração, nenhum roteiro de servidor;
         depois o que resta da auditoria: AVISO-01 do Financeiro esperando decisão dele, a nota da Agenda, as NOTAS, e as pendências do
         item 6).
       - `ESTADO-ATUAL.md` e `Claude outputs/RETOMAR-AQUI.md` (fora do git): o mesmo presente, com a mesma evidência.
       - `Claude outputs/auditoria/ACOMPANHAMENTO.md`: a frase do topo de que nada foi corrigido ganha a data e a correção ao lado
         (preservada como histórico); nova seção "Correções — 08/10/2026 (quick 261008-pmi)" marcando Queimas aviso 1, Estoque aviso 1 e
         Estoque aviso 2 como **CORRIGIDO no `main` local, NÃO PUBLICADO**, cada um com: o que mudou em uma frase, os hashes, os testes
         que provam (unidade, caso (13) de `provar-corridas-das-queimas`, as três e2e "(auditoria 08/10)") e a saída de
         `npm run verificar` e do e2e.
       - `Claude outputs/FILA-DO-CODE.md`: se houver item da auditoria, marcar com a data e o estado real (sem ✅ de concluído enquanto
         não estiver publicado — o ✅ é do que está no ar, conforme o padrão do arquivo); se não houver item, não criar — registrar no
         SUMMARY que não havia.
    6. Pendências descobertas (não corrigidas aqui; registrar no SUMMARY, no ACOMPANHAMENTO e na PROXIMA-SESSAO, sem apagar nada):
       (P1) a Venda MANUAL ainda pode duplicar num reenvio depois de resposta perdida — não há retrato possível; a frase de rede agora
       manda conferir no Caixa; fechar de verdade pede chave de envio em `lancarVenda` (avaliar se exige tabela/migração antes);
       (P2) a frase de rede da correção (`fraseCorrecaoSemRede`, ramo intacto) continua afirmando que nada novo entrou — a versão sob a
       trava protege o reenvio, mas a frase é a mesma raiz; e2e de `polimento-corrigir (e)` a fixa verbatim;
       (P3) o "Ajustar pelo contado" da folha do material antes da primeira contagem continua gravando ajuste à taxa corrente sem
       perguntar custo, e conta como contagem (`tiraDaPrimeiraContagem`: tipo ajuste) — é a outra metade do achado do auditor, fora do
       critério travado da Decisão 3.
    7. NÃO commitar os documentos versionados aqui: o commit final do orquestrador (`docs(quick-261008-pmi): …`) leva CONTEXT, PLAN,
       SUMMARY, `.planning/STATE.md` e `.planning/PROXIMA-SESSAO.md` juntos, como na quick 261008-6f1 (`5d0e145`). Deixá-los
       modificados e prontos; os de fora do git ficam só salvos. SEM push.
  </action>
  <verify>
    <automated>npm run verificar</automated>
    <automated>npm run test:e2e -- --grep "auditoria 08/10|estoque contagem|polimento estoque|lan.ar na venda|venda: bordas"</automated>
    <automated>git diff 831b0f6 --stat -- db/</automated>
    <automated>grep -n "261008-pmi" .planning/STATE.md .planning/PROXIMA-SESSAO.md ESTADO-ATUAL.md "Claude outputs/RETOMAR-AQUI.md" "Claude outputs/auditoria/ACOMPANHAMENTO.md"</automated>
    <automated>git log origin/main..main --oneline</automated>
  </verify>
  <done>
    `npm run verificar` sai 0; a única invocação de e2e passa, com as três "(auditoria 08/10)" entre as que rodaram (contagem
    passou/falhou registrada no SUMMARY; invocações extras só se necessárias, cada uma registrada); nenhuma mudança em `db/`; os cinco
    documentos citam `261008-pmi` com hashes e evidência; o ACOMPANHAMENTO marca os três como corrigidos-não-publicados e lista P1-P3;
    `git log origin/main..main` mostra os commits desta tarefa e nada foi publicado.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → `lancarVenda` (Server Action) | `vendasVistas` e `origem` vêm do cliente; podem ser forjados ou velhos (aba aberta antes do deploy) |
| rede do ateliê (4G) → resposta da Server Action | a resposta pode se perder DEPOIS do commit; o cliente não sabe se gravou |
| navegador → `confirmarContagem`/`registrarMovimentacao` (Estoque) | o modo e o custo nunca vêm do cliente; o livro decide sob a trava |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pmi-01 | Tampering | `esquemaVenda.vendasVistas` | medium | mitigate | Zod no servidor: inteiros positivos, no máximo 500; obrigatório SÓ com origem `queima` (ausente = frase de tela desatualizada, nunca pula a conferência); presente sem origem `queima` ou com `correcao` = recusa. Forjar só causa recusa ou equivale a ter visto o estado atual (mesma análise do T-2yu-04) |
| T-pmi-02 | Repudiation / integridade do dinheiro | `vincularQueimaNaVenda` | high | mitigate | `vendasAtivasMudaram` sob `travarContagem` (mesma trava e releitura CR-01 do Recebi agora), depois de "nada falta" e antes de `cabeNoQueFalta`; prova contra Postgres no caso (13) e e2e da resposta perdida |
| T-pmi-03 | Elevation of Privilege | `lancarVenda` | high | mitigate | `exigirUsuario()` continua a primeira instrução (conferido por `npm run verificar-acoes`); nenhuma ação nova |
| T-pmi-04 | Information Disclosure | frase `fraseVendasMudaramNaVenda` | low | accept | cita só números de venda que o usuário autenticado já vê no Caixa e no Histórico |
| T-pmi-05 | Repudiation | Venda MANUAL depois de resposta perdida | medium | accept | sem retrato possível; a frase de rede passa a mandar conferir no Caixa (não afirma mais que nada gravou); pendência P1 registrada para chave de envio |
| T-pmi-06 | Tampering | modo da contagem (`gravarContagem`) | medium | mitigate | decidido no servidor, sob a trava, pelo livro (`tiraDaPrimeiraContagem` sobre as linhas manuais lidas depois da trava) — fingir "primeira" no cliente continua sem efeito (T-06-45 preservado) |
| T-pmi-07 | Tampering | valoração do Estoque (`lerEstados`/`lerSaldos`/`valorarMovimento`) | medium | mitigate | a mesma regra (`valor > 0`) nas três leituras — memória e banco nunca divergem; unidade + e2e do cenário do auditor |
| T-pmi-08 | Denial of Service | `selectDistinct` das combinações manuais | low | accept | no máximo 3 tipos × 3 motivos × 2 = 18 combinações por item; uma consulta por lista, nunca uma por item |
</threat_model>

<verification>
- `npm run verificar` sai 0 (lint, `tsc --noEmit`, `verificar-acoes`, unidade, `test:migracoes` com o caso (13) das Queimas).
- Exatamente uma invocação de `npm run test:e2e` (Tarefa 3), com `--grep`, verde, incluindo as três "(auditoria 08/10)".
- `git diff 831b0f6 --stat -- db/` vazio — nenhuma migração, `TABELAS_ESPERADAS` intacta.
- Comandos rodados de fato (com resultado) listados no SUMMARY; RED de cada defeito visto e registrado.
- Nada publicado: `git log origin/main..main` lista os commits locais; nenhum `git push`.
</verification>

<success_criteria>
- O reenvio do "Lançar na Venda" depois de resposta perdida é recusado citando a venda que já entrou, e a tela se atualiza; a Venda
  manual e a da Agenda não mudam de comportamento além da frase de rede.
- Doação de R$ 0 nunca vira referência de custo: a saída com o saldo zerado vale o custo da última compra (R$ 4,20 no cenário do
  auditor) e o cartão mostra "R$ 4,20/kg"; "sem custo" e "—" continuam como em 06.5.
- Saída manual antes da primeira contagem não impede o "Custou ao todo"; tela e servidor decidem pela mesma função pura.
- Documentos de estado corrigidos com evidência; três pendências (P1-P3) registradas; nada em produção.

## Auditoria de cobertura (fontes)

| Fonte | Item | Onde |
|-------|------|------|
| GOAL | três avisos confirmados corrigidos | Tarefas 1 e 2 |
| REQ | AUDITORIA-0810-QUEIMAS-AVISO-1 | Tarefa 1 |
| REQ | AUDITORIA-0810-ESTOQUE-AVISO-1 | Tarefa 2, passos 1-2 e 5-7, 12 |
| REQ | AUDITORIA-0810-ESTOQUE-AVISO-2 | Tarefa 2, passos 3 e 8-11, 13 |
| CONTEXT Decisão 1 | `vendasVistas` + `vendasAtivasMudaram` + `RecusaDasQueimas`/`telaMudou`, reusando as peças | Tarefa 1, passos 4-12 |
| CONTEXT Decisão 1 | frase do `catch` sem afirmar o que não sabe — geral, pequena e segura | Tarefa 1, passos 8 e 10; resto como P1/P2 |
| CONTEXT Decisão 2 | R$ 0 soma e dilui, mas não substitui a referência; leituras do banco na mesma regra; teste do cenário do auditor | Tarefa 2, passos 1-2, 5-7, 12 |
| CONTEXT Decisão 3 | critério exato definido pelo planejador; tela e servidor iguais; teste do cenário do auditor | Tarefa 2, passos 3, 8-11, 13 |
| CONTEXT Discricionário | frases pt-BR humanas; `exigirUsuario()` primeiro; Zod no servidor; regra em módulo puro; `verificar`; uma e2e com `--grep`; sem push | todo o plano |
| Restrições do orquestrador | um plano, 1-3 tarefas, TDD com RED visto, PARAR se migração, documentos de estado à mão com evidência | Tarefas 1-3 |
| Fora do escopo (não é lacuna) | AVISO-01 do Financeiro; nota da Agenda; NOTAS | registrados como restantes na Tarefa 3 |
</success_criteria>

<output>
Criar `.planning/quick/261008-pmi-corrigir-avisos-da-auditoria-queimas-e-e/261008-pmi-SUMMARY.md` ao terminar: o que mudou por
defeito, o RED visto de cada um (saída resumida), os casos da prova das Queimas que mudaram de sentido ((9a), (10)) e o novo (13),
cada comando rodado de fato com resultado (inclusive a única e2e, com passou/falhou), os hashes, as pendências P1-P3, e o que foi
atualizado em cada documento de estado.
</output>
