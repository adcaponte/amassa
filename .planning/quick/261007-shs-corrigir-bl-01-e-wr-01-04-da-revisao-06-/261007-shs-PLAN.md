---
quick_id: 261007-shs
description: Corrigir o bloqueio BL-01 e os avisos WR-01..WR-04 da revisão de código da Fase 06.5 — decisão do dono em 07/10/2026
mode: quick
phase: quick-261007-shs
plan: 1
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [POL-08, POL-07, POL-13, POL-12]
files_modified:
  # Tarefa 1 — BL-01 + WR-01 (o "Corrigir", dinheiro)
  - lib/financeiro/correcao.ts
  - lib/financeiro/gravacao.ts
  - lib/financeiro/acoes.ts
  - lib/financeiro/consultas.ts
  - lib/financeiro/taxa.ts
  - lib/financeiro/textos.ts
  - components/amassa/financeiro/bloco-pagamento.tsx
  - components/amassa/financeiro/painel-venda.tsx
  - app/gestao/(app)/financeiro/page.tsx
  - scripts/provar-corridas-da-correcao.ts
  - tests/unit/financeiro-correcao.test.ts
  - tests/unit/financeiro-taxa.test.ts
  - tests/e2e/polimento-corrigir.spec.ts
  # Tarefa 2 — WR-03 + WR-02 (contas fixas canceladas; cancelar uma correção)
  - lib/cadastros/contas-fixas.ts
  - lib/cadastros/esquemas.ts
  - lib/cadastros/acoes.ts
  - lib/cadastros/textos.ts
  - lib/cadastros/avisos.ts
  - lib/financeiro/avisos.ts
  - app/gestao/(app)/cadastros/page.tsx
  - components/amassa/cadastros/geracao-de-contas.tsx
  - components/amassa/cadastros/botao-gerar-contas.tsx
  - components/amassa/cadastros/aviso-cadastros.tsx
  - components/amassa/financeiro/aviso-contas-fixas.tsx
  - components/amassa/financeiro/aviso-financeiro.tsx
  - components/amassa/financeiro/confirmar-cancelar-documento.tsx
  - tests/unit/cadastros-contas-fixas.test.ts
  - tests/unit/cadastros-textos.test.ts
  - tests/unit/cadastros-categorias.test.ts
  - tests/unit/financeiro-avisos.test.ts
  - tests/e2e/polimento-banco.spec.ts
  - tests/e2e/polimento-caixa.spec.ts
  # Tarefa 3 — WR-04 (CI) + roteiro + documentos de estado
  - .github/workflows/entrega.yml
  - scripts/conferir-migracoes-da-imagem.mjs
  - tests/unit/conferir-migracoes-da-imagem.test.ts
  - tests/unit/entrega-digests.test.ts
  - docs/operacao/23-correcoes-da-revisao-06-5.md
  - .planning/phases/06.5-polimento/06.5-REVIEW.md
  - .planning/phases/06.5-polimento/06.5-UI-SPEC.md
  - .planning/STATE.md
  - .planning/PROXIMA-SESSAO.md

estimate:
  tokens: 140000
  raw_tokens: 280000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "BL-01: corrigir uma venda com parcela JÁ RECEBIDA no cartão grava, na parcela da nova que corresponde a ela (mesmo dia de pagamento, cartão), a taxa congelada da original — inclusive `null` —, mesmo que a taxa de Cadastros tenha mudado; só parcela nova (ou em aberto e marcada paga agora) usa a taxa de hoje. Provado contra Postgres com a original a 4,99% e a correção a 3,49%: o líquido da parcela, o saldo de tudo o que foi pago antes do mês seguinte ao pagamento e o `resumoDoMes` daquele mês ficam IDÊNTICOS antes e depois da correção"
    - "BL-01 (despesa): a correção de uma despesa paga no cartão continua sem taxa (`null`) e o saldo do passado fica igual — provado no mesmo script"
    - "BL-01 (defesa no núcleo): `lancarCorrecaoNaTransacao` relê as parcelas gravadas da nova e RECUSA (desfaz tudo) se alguma parcela já recebida ficaria com taxa diferente da original — um chamador futuro que esqueça de passar a herança não reescreve o passado"
    - "BL-01 (tela): na Venda aberta por “Corrigir”, o aviso do cartão diz a taxa que de fato vai ser gravada — a da original para as parcelas já recebidas, a de hoje só para as novas"
    - "WR-01: o rascunho da correção e a versão que a tela leva saem do MESMO retrato do banco (uma transação `repeatable read, read only`); um par velho (rascunho sem o recebimento + versão sem o recebimento) é recusado com `mudou` sob a trava, e nada é gravado"
    - "WR-02: a confirmação de “Cancelar esta venda/despesa” de um documento que corrige outro diz que a original (nº N) continua cancelada e que cancelar esta não a traz de volta, e oferece “Corrigir esta venda/despesa”; nenhum dado muda de forma"
    - "WR-03: “Gerar as contas de {mês}” (Cadastros e o atalho do Caixa) NUNCA recria em silêncio uma conta cancelada naquele mês: antes de gravar qualquer coisa, lista essas contas pelo nome, desmarcadas; só as marcadas voltam; as outras contas que faltam são criadas como hoje; se outra conta for cancelada enquanto a pessoa escolhe, o servidor pergunta de novo; o índice parcial da 0031 continua impedindo duas contas ativas no mesmo mês"
    - "WR-04: `e2e`, `banco` e `publicar` usam os DIGESTS que `construir` subiu, nunca a tag mutável `:<sha>`; `banco` migra o Postgres efêmero PELA imagem `ferramentas` (pelo digest) e confere, pelo hash de cada arquivo, que ela aplicou exatamente as migrações do commit, antes do `test:migracoes`; `publicar` promove `:latest` e `:ferramentas` pelos digests e confere o resultado"
    - "Nenhuma migração nova (`git diff 83c3837 -- db/` vazio); `TABELAS_ESPERADAS` não muda; `exigirUsuario()` continua a primeira linha de toda Server Action (`verificar-acoes`: 125, 0 violações); `npm run verificar` sai 0; nada publicado"
  artifacts:
    - path: "lib/financeiro/correcao.ts"
      provides: "taxasHerdadasDaCorrecao(pagasDaOriginal, parcelasDaNova) — a regra pura de qual parcela herda a taxa congelada; `ParcelaPagaDaOriginal`; `rascunhoDaCorrecao` devolve `pagasDaOriginal`"
      contains: "export function taxasHerdadasDaCorrecao"
    - path: "lib/financeiro/gravacao.ts"
      provides: "gravarVenda aplica a herança quando `contexto.pagasDaOriginal` vem; lancarCorrecaoNaTransacao lê as pagas sob a trava, passa a gravarNova e confere depois"
      contains: "pagasDaOriginal"
    - path: "lib/financeiro/consultas.ts"
      provides: "lerDocumentoParaCorrecao(leitor, id) — rascunho e versão do mesmo leitor; obterDocumentoParaCorrecao numa transação repeatable read, read only"
      contains: "export async function lerDocumentoParaCorrecao"
    - path: "scripts/provar-corridas-da-correcao.ts"
      provides: "casos (f1)–(f4) do BL-01 e (g) do WR-01 contra Postgres de verdade"
      contains: "(f1)"
    - path: "lib/cadastros/contas-fixas.ts"
      provides: "planejarGeracaoDoMes — perguntar × criar/recriar/manter, puro"
      contains: "export function planejarGeracaoDoMes"
    - path: "components/amassa/cadastros/geracao-de-contas.tsx"
      provides: "o fluxo cliente compartilhado da geração (chamada, pergunta, diálogo das canceladas, navegação) usado pelos Cadastros e pelo Caixa"
      contains: "canceladasVistas"
    - path: "lib/financeiro/textos.ts"
      provides: "fraseCancelarCorrecao (WR-02) e os dois textos do aviso do cartão na correção (BL-01)"
      contains: "export function fraseCancelarCorrecao"
    - path: "scripts/conferir-migracoes-da-imagem.mjs"
      provides: "compararMigracoes (puro) + CLI que confere `drizzle.__drizzle_migrations` contra o `_journal.json` e o sha256 de cada .sql do checkout"
      contains: "export function compararMigracoes"
    - path: "tests/unit/entrega-digests.test.ts"
      provides: "guarda de regressão do workflow: digests, `needs` × `needs.construir.outputs`, migração pela imagem no `banco`, nenhum banco que não seja o efêmero"
    - path: "docs/operacao/23-correcoes-da-revisao-06-5.md"
      provides: "Roteiro 23: publicar (push simples, sem migração), o que olhar no run novo e as duas consultas só de leitura da taxa das correções já gravadas em produção"
  key_links:
    - from: "lib/financeiro/acoes.ts lancarVenda"
      to: "lib/financeiro/gravacao.ts gravarVenda"
      via: "gravarNova(tx, pagasDaOriginal) → contexto.pagasDaOriginal; as pagas vêm do servidor, sob a trava da original, nunca do navegador"
      pattern: "pagasDaOriginal"
    - from: "lib/financeiro/gravacao.ts lancarCorrecaoNaTransacao"
      to: "lib/financeiro/correcao.ts taxasHerdadasDaCorrecao"
      via: "conferência depois de gravarNova — taxa herdada diferente da gravada lança e desfaz"
      pattern: "taxasHerdadasDaCorrecao"
    - from: "lib/financeiro/consultas.ts obterDocumentoParaCorrecao"
      to: "lib/financeiro/consultas.ts lerDocumentoParaCorrecao"
      via: "db.transaction com isolationLevel repeatable read e accessMode read only; versaoAtualDoDocumento(tx, id) dentro dela"
      pattern: "repeatable read"
    - from: "components/amassa/cadastros/botao-gerar-contas.tsx e components/amassa/financeiro/aviso-contas-fixas.tsx"
      to: "lib/cadastros/acoes.ts gerarContasDoMes"
      via: "components/amassa/cadastros/geracao-de-contas.tsx — { mes, canceladasVistas, recriar }"
      pattern: "canceladasVistas"
    - from: "lib/cadastros/acoes.ts gerarContasDoMes"
      to: "lib/cadastros/contas-fixas.ts planejarGeracaoDoMes"
      via: "a decisão pura sobre o estado lido na transação; o insert continua com o predicado da 0031"
      pattern: "planejarGeracaoDoMes"
    - from: "components/amassa/financeiro/confirmar-cancelar-documento.tsx"
      to: "lib/financeiro/textos.ts fraseCancelarCorrecao + lib/financeiro/navegacao.ts hrefDaCorrecao"
      via: "documento.corrigeNumero !== null"
      pattern: "fraseCancelarCorrecao"
    - from: ".github/workflows/entrega.yml construir (outputs digest_app / digest_ferramentas)"
      to: "e2e, banco, publicar"
      via: "needs.construir.outputs.digest_*; cada job que lê as saídas tem `construir` no `needs`"
      pattern: "needs.construir.outputs.digest_"
    - from: ".github/workflows/entrega.yml banco"
      to: "scripts/conferir-migracoes-da-imagem.mjs"
      via: "depois da migração pela imagem ferramentas, antes do test:migracoes"
      pattern: "conferir-migracoes-da-imagem"
---

<objective>
Corrigir o bloqueio BL-01 e os quatro avisos WR-01..WR-04 da revisão de código da Fase 06.5
(`.planning/phases/06.5-polimento/06.5-REVIEW.md`), como o dono decidiu no chat em 07/10/2026:

- **Tarefa 1 — o “Corrigir” (dinheiro): BL-01 + WR-01.**
  - **BL-01:** a parcela já recebida mantém a taxa com que foi recebida. Só as parcelas novas, ou as em aberto
    que forem marcadas pagas agora, usam a taxa de hoje.
  - **WR-01:** o rascunho e a versão saem de um único retrato do banco.
- **Tarefa 2 — WR-03 + WR-02.**
  - **WR-03 (“Perguntar antes”):** antes de recriar uma conta fixa cancelada no mês, a tela lista essas contas
    pelo nome, e a pessoa escolhe quais voltam. Vale nos Cadastros e no atalho do Caixa.
  - **WR-02:** cancelar uma correção avisa que a original continua cancelada.
- **Tarefa 3 — WR-04 (CI) + o Roteiro 23 + os documentos de estado.** As duas imagens passam a circular pelo
  digest. A `ferramentas` migra o banco efêmero antes de ser promovida.

**Sem migração.** A `0031` está aplicada em produção e nada aqui pede mudança de esquema:

- a taxa da parcela já tem coluna (`parcelas.taxa_pontos_base`);
- a escolha das contas canceladas é uma leitura antes do `insert` de sempre;
- a CI não toca o banco real.

`TABELAS_ESPERADAS` não muda. Publicar é um push simples (Roteiro 23).

Sem traçador (equivale a `--no-tracer`): são correções pontuais numa arquitetura que já está em produção e já foi
provada. O dono fixou as três tarefas. Commits locais em `main`, sem push: um por tarefa, e a Tarefa 3 tem dois
(o da CI e o dos documentos).

Purpose: o BL-01 reescreve em silêncio o líquido e o saldo do passado de uma venda paga no cartão; é dinheiro. Os
avisos tratam de:

- um recebimento que some numa corrida;
- uma venda real que sai do Caixa sem aviso;
- uma conta cancelada de propósito que volta e pode ser paga duas vezes;
- a imagem que migra produção, promovida sem nunca ter rodado.

Output:

- código e testes dos cinco itens;
- casos novos na prova de corrida da correção;
- um script e dois testes da CI;
- o Roteiro 23;
- notas datadas na REVIEW e na UI-SPEC;
- os documentos de estado corrigidos.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@.planning/phases/06.5-polimento/06.5-REVIEW.md
@.planning/phases/06.5-polimento/06.5-16-SUMMARY.md
@.planning/phases/06.5-polimento/06.5-17-SUMMARY.md
@.planning/phases/06.5-polimento/06.5-18-SUMMARY.md
@.planning/phases/06.5-polimento/06.5-11-SUMMARY.md
@.planning/phases/06.5-polimento/06.5-12-SUMMARY.md
@.planning/phases/06.5-polimento/06.5-22-SUMMARY.md

Mapa do código lido pelo planejador em 07/10/2026, no `main` = `83c3837`. Confira antes de editar.

**O “Corrigir” — servidor**
- `lib/financeiro/gravacao.ts`:
  - `gravarVenda` (~106) grava `taxaPontosBase: pagaNoCartao ? contexto.taxaCartaoPontosBase : null` (~209). A
    taxa vem de `obterConfiguracaoFinanceira()`, lida por `lancarVenda` (`acoes.ts:187`). **É aqui o BL-01.**
  - `gravarDespesa` (~249) grava sempre `taxaPontosBase: null` (~339): despesa nunca tem taxa.
  - `lerParaVersao` / `versaoAtualDoDocumento` (~410/~447) aceitam o `db` ou uma `tx` (`LeitorDaVersao`).
  - `lancarCorrecaoNaTransacao` (~481), em ordem:
    1. trava a original com `for update`;
    2. confere tipo, cancelada e já corrigida;
    3. lê as cinco origens;
    4. compara a versão relida sob a trava;
    5. chama `cancelarDocumentoNaTransacao`;
    6. chama `gravarNova(tx)`;
    7. grava o vínculo.
- `lib/financeiro/acoes.ts`:
  - `lancarVenda` (~147) monta `gravarNova` (~326–330) com a taxa de hoje.
  - `lancarDespesa` (~439) monta o dela com `gravarDespesa`.
  - Falha inesperada com correção → `respostaDaFalhaDaCorrecao` (frase “rede”).
  - `registrarPagamento` (~752) trava o DOCUMENTO e depois a parcela (`for update`, ~791/~810). Por isso, sob a
    trava da original, nenhum “Recebi” entra entre a conferência da versão e a leitura das parcelas pagas.
- O esquema de `parcelas` (`db/schema.ts` ~891–930): `pago_em` é `date` em modo `string`; `taxa_pontos_base` é
  `integer`. O `check` só aceita taxa com `pago_em is not null and forma = 'cartao'`.
- `lib/financeiro/correcao.ts` é puro e só importa `./calendario` e `./parcelas`:
  - `dataCivil` (~104, interna) normaliza `Date`/texto para `YYYY-MM-DD`;
  - `ParcelaDaOriginal` (~203) não tem `numero` nem `taxaPontosBase`;
  - `rascunhoDaCorrecao` (~284) põe a parcela paga vencendo em `pago_em`.
- `lib/financeiro/taxa.ts`:
  - `liquidoDaParcela` só desconta taxa de venda com taxa não nula;
  - `avisoDoCartao` (~51) recebe UMA taxa para todas as parcelas.
- `components/amassa/financeiro/bloco-pagamento.tsx` (~117–123, ~256–264) monta o aviso com a taxa de hoje e
  `textoAvisoCartao` (`lib/financeiro/textos.ts` ~119).
- `components/amassa/financeiro/painel-venda.tsx`:
  - `CorrecaoNoPainel` (~130);
  - a `BlocoPagamento` recebe `taxaPontosBase={configuracao.taxaCartaoPontosBase}` (~1041);
  - no modo correção existe o estado `desligada` (depois de “Lançar como venda nova”, plano 18).
- `app/gestao/(app)/financeiro/page.tsx` (~394–432): monta `rascunhoDaCorrecao(...)` e `correcaoNoPainel`.
- O Mês e o saldo:
  - `listarDocumentosDoMes` e `listarParcelasPagasNoMes` (`consultas.ts` ~961/~1012) alimentam `resumoDoMes`
    (`lib/financeiro/mes.ts` ~99);
  - `somarMovimentosAntesDe` (`consultas.ts` ~165) alimenta `saldoAntesDaJanela` (`lib/financeiro/extrato.ts` ~89).
  - Os dois agrupam ou leem pela taxa congelada. A equivalência com o extrato linha a linha foi provada no 06.5-12.
- **WR-01:** `obterDocumentoParaCorrecao` (`consultas.ts` ~756–848) faz seis leituras em `Promise.all` sobre o pool,
  sem transação. `origensDaAgendaEDasQueimas` (~546) usa `db` direto, inclusive dentro dos `unionAll`.
- A prova de corrida está em `scripts/provar-corridas-da-correcao.ts` e é chamada por `scripts/testar-migracoes.mjs`
  (~7453).
  - Ela importa `@/db` e `@/lib/financeiro/gravacao`. `consultas.ts` não tem `server-only` e pode ser importado.
  - Tem os casos (a)–(e) e os auxiliares `semearVenda`, `corrigir`, `primeiraTravaEPara`, `estado`,
    `afirmarTudoOuNada` e `faxina`.
  - A categoria da semente é de `receita`. Para despesa, crie uma categoria nova e confira os `check` de
    `categorias` em `db/schema.ts`.
- O e2e é `tests/e2e/polimento-corrigir.spec.ts`:
  - describes `— venda` (a)(b), `— detalhe` (a)(b)(c), `— despesa` (a) e `— recusas` (a)–(e);
  - auxiliares `abrirCorrecao`, `documentoNoBanco` e `corrigidaPor`;
  - semeia com `semearContaAPagar` (`tests/e2e/apoio/semear-conta-a-pagar.ts`: uma parcela EM ABERTO).
- A taxa de hoje está em `configuracao_financeira.taxa_cartao_pontos_base`. O e2e só LÊ esse valor, nunca o muda:
  mudar a taxa seria `@parametro-global`.

**Contas fixas (WR-03)**
- `lib/cadastros/acoes.ts`:
  - `gerarContasDoMes` (~892–989) devolve `ResultadoDeAcao<{ criadas, mes }>`;
  - percorre as contas `ativa = true` e insere com `onConflictDoNothing({ target, where: cancelado_em is null })`;
  - `esquemaGeracao` (`lib/cadastros/esquemas.ts` ~285) só tem `mes`.
- `lib/cadastros/contas-fixas.ts` é puro: `vencimentoNoMes`, `tituloDaContaFixa`, `mesPermitidoParaGeracao`; teste
  em `tests/unit/cadastros-contas-fixas.test.ts`.
- `lib/cadastros/textos.ts` (~263–279) tem `rotuloGerarContas` e `textoContasGeradas(quantidade, mesPorExtenso)`. É
  sem import: quem chama formata o mês.
- Os dois botões:
  - `components/amassa/cadastros/botao-gerar-contas.tsx`: sem `try`; no sucesso, navega para
    `?sub=fixas&aviso=contas-geradas&quantidade=&mes=`;
  - `components/amassa/financeiro/aviso-contas-fixas.tsx`: com `try` → `FRASE_FALHA_AO_GERAR_CONTAS`; navega para
    `?aba=caixa&aviso=contas-geradas&quantidade=&mesGerado=`.
- Avisos da URL:
  - `lib/cadastros/avisos.ts` e `lib/financeiro/avisos.ts` validam `quantidade` (0..500) e o mês;
  - as páginas montam `textoContasGeradas` (`cadastros/page.tsx` ~208, `financeiro/page.tsx` ~544);
  - `aviso-cadastros.tsx` e `aviso-financeiro.tsx` limpam os parâmetros da URL.
- e2e:
  - `tests/e2e/polimento-banco.spec.ts`, “polimento banco — conta fixa”, `@vazio-historico`: gera o ÚLTIMO mês da
    faixa, cancela pelo Caixa e gera de novo esperando “criada(s)” (~87–148);
  - `tests/e2e/polimento-caixa.spec.ts`, “polimento caixa — aviso das contas fixas”, `@vazio-historico`, `serial`:
    mês corrente, com `criarContaFixaAtiva` e `devolverOBanco` (~112–301).
  - “Gerar” é GLOBAL (toda conta ativa do banco): nunca afirme contagem global.

**Cancelar uma correção (WR-02)**
- `components/amassa/financeiro/confirmar-cancelar-documento.tsx` é um `AlertDialog` destrutivo com
  `fraseConfirmarCancelamento` (`lib/financeiro/textos.ts` ~500).
- O `documento` (`DocumentoParaDetalhe`) já traz `corrigeNumero` e `origemParaCorrecao`.
- `hrefDaCorrecao(tipo, id)` está em `lib/financeiro/navegacao.ts`.
- O detalhe (`dialogo-documento.tsx` ~211–231) põe “Corrigir” e “Cancelar” lado a lado.

**CI (WR-04)**
- `.github/workflows/entrega.yml`:
  - `construir` (~75–113) sobe `:<sha>` e `:ferramentas-<sha>` sem `id` nos passos;
  - `e2e` (~126–278) faz `docker pull`/`docker run` de `:${{ github.sha }}`;
  - `banco` (~283–338) tem `needs: qualidade` e migra pelo checkout (`npx tsx db/migrate.ts`) antes de
    `test:migracoes` e `test:backup`;
  - `publicar` (~346–378) promove pela TAG;
  - `concurrency` cancela runs em andamento na mesma ref.
- `docker/Dockerfile`, alvo `ferramentas` (~110–122): `FROM dependencias` (`npm ci` completo, com `tsx`), copia
  `package.json`, `tsconfig.json`, `drizzle.config.ts`, `db`, `scripts` e `lib`; `WORKDIR /app`. O
  `package.json` mapeia o alias de migração do npm para `tsx db/migrate.ts`.
- A regra 01-ARQUITETURA §8 e a T-06.5-68:
  - o workflow nunca cita o alias de migração do npm, e por isso migra o efêmero por `npx tsx db/migrate.ts`;
  - nenhuma migração de PRODUÇÃO pelo pipeline.
- Drizzle (`node_modules/drizzle-orm/migrator.js` e `pg-core/dialect.js`, lidos):
  - cada migração aplicada vira uma linha em `drizzle.__drizzle_migrations(hash, created_at)`;
  - `hash` = sha256 do conteúdo inteiro do `.sql`;
  - `created_at` = o `when` da entrada no `db/migrations/meta/_journal.json`.
- **Medido pelo planejador em 07/10/2026, run `37667733188`** (`gh run view --log`), o digest bate nas três pontas:

  | Onde | Digest |
  |---|---|
  | `construir`, `containerimage.digest` | `sha256:40c5d3aa…819364` |
  | `e2e (desktop)`, `docker pull` | `sha256:40c5d3aa…819364` |
  | `publicar`, `imagetools inspect …:latest` | `sha256:40c5d3aa…819364` |

  Portanto `imagetools create` com uma origem PRESERVA o digest do índice, e o `outputs.digest` do
  `build-push-action@v6` é o digest que `docker pull IMAGEM@digest` aceita. A linha do inspect tem o formato
  `Digest:    sha256:…`, no começo da linha.
- `js-yaml` 4.3.1 está em `node_modules` (dependência transitiva, já usada à mão no 06.5-22). Não há
  `@types/js-yaml`.
- `tsconfig.json` tem `allowJs: true`. Por isso um teste em TS importa os exports de um `.mjs` de `scripts/` (molde
  `tests/unit/verificar-acoes.test.ts`).

**Armadilhas da casa (memória do projeto)**
- O Drizzle embrulha o SQLSTATE: use `codigoDoErroPostgres` (`erro.cause.code`).
- `.next/types` velhos quebram o `tsc` (TS2307): apague `.next/types .next/dev/types` e rode de novo.
- Antes de cada e2e, rode `docker ps`. Um `amassa_app_e2e` velho na porta 3000 faz o teste rodar contra uma
  imagem velha.
- `index.lock` órfão: confira a idade e remova.
- O “hoje” do e2e vem de `hojeNoAtelie()`.
- O STATE.md se edita à mão, nunca com `gsd-tools state …`.
- Para usar `gh` pelo Git Bash, exporte antes `export PATH="/c/Program Files/GitHub CLI:$PATH"`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: o “Corrigir” — a parcela já recebida mantém a taxa com que foi recebida (06.5-BL-01) e o rascunho e a versão saem do mesmo retrato (06.5-WR-01)</name>
  <files>lib/financeiro/correcao.ts, lib/financeiro/gravacao.ts, lib/financeiro/acoes.ts, lib/financeiro/consultas.ts, lib/financeiro/taxa.ts, lib/financeiro/textos.ts, components/amassa/financeiro/bloco-pagamento.tsx, components/amassa/financeiro/painel-venda.tsx, app/gestao/(app)/financeiro/page.tsx, scripts/provar-corridas-da-correcao.ts, tests/unit/financeiro-correcao.test.ts, tests/unit/financeiro-taxa.test.ts, tests/e2e/polimento-corrigir.spec.ts</files>
  <precondition>Docker em execução (`docker info` sai 0): o `test:migracoes` local sobe o Postgres de `docker/compose.teste.yml` e o e2e sobe o dele.</precondition>
  <behavior>
    - taxasHerdadasDaCorrecao(original [{numero 1, pagoEm D, cartao, 10000, taxa 499}], nova [{vencimento D, 10000, cartao, pago true}]) → [{ herdada: true, pontosBase: 499 }]
    - Original com taxa null (pago no cartão sem taxa gravada) → [{ herdada: true, pontosBase: null }]. Herdar null NÃO vira a taxa de hoje.
    - Nova paga no cartão com vencimento D2 ≠ D → [{ herdada: false }]. Nova em aberto (pago false) → herdada false. Nova paga em pix no dia D → herdada false.
    - Original paga em pix no dia D e nova paga no cartão no dia D → herdada false (a forma mudou: é pagamento novo).
    - Duas originais no dia D, as duas de 10000 (taxas 499 e 450), e duas novas iguais → [499, 450]: cada original casa UMA vez, na ordem do número.
    - Segunda passada, mesmo dia e cartão com valor diferente: original {D, 10000, 499}, nova {D, 15000, cartao, pago} → herdada 499.
    - A primeira passada tem prioridade. Originais {D, 10000, 499} e {D, 5000, 450}, novas {D, 5000} e {D, 10000} → [450, 499].
    - pagoEm como `Date` (00:00 UTC ou 03:00 UTC do dia D) casa com vencimento "D" em texto.
    - rascunhoDaCorrecao devolve `pagasDaOriginal`, só com as parcelas pagas: numero, pagoEm, forma, valorCentavos e taxaPontosBase da original.
    - Dinheiro (puro):
      - venda paga no cartão a 4,99% e corrigida com a taxa de hoje a 3,49%. Com a herança: o liquidoDaParcela da nova é igual ao da original; saldoAntesDaJanela dos grupos da nova é igual ao da original; resumoDoMes (as parcelas pagas do mês) é igual.
      - Controle sem a herança (3,49% na nova): os três DIFEREM. Isso prova que o teste morde.
    - avisoDoCartao com taxa por parcela: a parcela com `taxaPontosBase` definido usa a dela (null conta 0); sem o campo, usa a taxa global de sempre. As chamadas antigas dão o mesmo resultado de antes.
    - textoAvisoCartaoHerdado("4,99", "R$ 4,99", "R$ 95,01") diz que a maquininha FICOU com 4,99% (R$ 4,99), que é a taxa de quando a venda foi recebida e que a correção a mantém, e que entram R$ 95,01. textoAvisoCartaoMisto("R$ 8,48", "R$ 191,52", "3,49") diz que as já recebidas mantêm a taxa de quando entraram e que as novas usam a de hoje (3,49%).
  </behavior>
  <action>
**RED primeiro.** Escreva o `<behavior>` em `tests/unit/financeiro-correcao.test.ts`:

- um describe novo “taxasHerdadasDaCorrecao — BL-01”;
- um describe “a correção não mexe no dinheiro do passado (BL-01)”, que usa `liquidoDaParcela` (`taxa.ts`),
  `saldoAntesDaJanela` (`extrato.ts`) e `resumoDoMes` (`mes.ts`) sobre fixtures montadas à mão;
- os casos do rascunho ajustados.

O caso do `avisoDoCartao` por parcela vai em `tests/unit/financeiro-taxa.test.ts`, e os dois textos novos podem ir
no mesmo arquivo da correção.

Escreva também, já agora, os casos (f1)–(f4) e (g) da prova de corrida, descritos no passo D. Rode
`npx vitest run tests/unit/financeiro-correcao.test.ts tests/unit/financeiro-taxa.test.ts` e
`npm run test:migracoes`, e veja os dois falharem. O (f1) falha porque a nova grava 349 e não 499; o (f4) falha
porque o núcleo ainda não confere; o (g) falha porque a função ainda não existe. Só então implemente.

**A. A regra pura** (`lib/financeiro/correcao.ts`; BL-01, decisão do dono de 07/10/2026; D-18/UI-D9).

1. Exporte os tipos:
   - `ParcelaPagaDaOriginal = { numero: number; pagoEm: Date | string; forma: string; valorCentavos: number;
     taxaPontosBase: number | null }`;
   - `TaxaDaParcelaDaCorrecao = { herdada: true; pontosBase: number | null } | { herdada: false }`.
2. Exporte `taxasHerdadasDaCorrecao(pagasDaOriginal, parcelasDaNova)`. As `parcelasDaNova` vêm na forma
   `{ vencimento, valorCentavos, forma, pago }` e a função devolve um array alinhado com elas.
   - Candidatas: as originais com `forma === "cartao"`, em ordem de `numero`. Só se consideram as novas com
     `pago && forma === "cartao"`; todas as outras recebem `{ herdada: false }`.
   - **1ª passada:** para cada nova, na ordem, a primeira candidata livre com o mesmo dia (`dataCivil(pagoEm) ===
     vencimento`, porque a parcela paga vence no dia do pagamento — `gravarVenda` grava
     `pago_em = vencimento`) e o mesmo valor.
   - **2ª passada:** para as novas que sobraram, a primeira candidata livre com o mesmo dia, com qualquer valor.
   - Cada original casa uma vez. O que casou herda o `taxaPontosBase` dela, mesmo `null`.
   - Reuse o `dataCivil` interno; não duplique a normalização.
   - No comentário: a regra da casa (“mudar a taxa em Cadastros depois não reescreve o passado”), a decisão do
     dono e por que a 2ª passada existe. O dinheiro daquele dia passou pela maquininha com a taxa daquele dia;
     mudar o valor de uma parcela recebida é escolha visível na tela, e trocar a taxa não seria.
3. `ParcelaDaOriginal` ganha `numero` e `taxaPontosBase`. `RascunhoDaCorrecao` ganha
   `pagasDaOriginal: ParcelaPagaDaOriginal[]`, só com as parcelas que têm `pagoEm`. O resto do rascunho não muda.

**B. O escritor e o núcleo** (`lib/financeiro/gravacao.ts`, `lib/financeiro/acoes.ts`).

4. `ContextoDaVenda` ganha `pagasDaOriginal?: readonly ParcelaPagaDaOriginal[]`. Em `gravarVenda`, calcule as taxas
   com `taxasHerdadasDaCorrecao(contexto.pagasDaOriginal, pedido.parcelas)` só quando `pagasDaOriginal` vier.
   - A taxa de cada parcela fica assim: se não é paga no cartão, `null`; se herdou, `pontosBase`; senão,
     `contexto.taxaCartaoPontosBase`.
   - Sem `pagasDaOriginal`, o comportamento é exatamente o de hoje. Isso vale para Agenda, Queimas, lote e Venda
     comum.
   - Atualize o comentário da taxa congelada (~194).
5. `lancarCorrecaoNaTransacao`:
   - O tipo de `gravarNova` passa a ser `(tx, pagasDaOriginal: readonly ParcelaPagaDaOriginal[]) => Promise<{ id;
     numero }>`.
   - **Depois** da conferência da versão (passo 4) e **antes** do cancelamento (passo 5), leia sob a trava as
     parcelas pagas da original: `numero`, `pagoEm`, `forma`, `valorCentavos`, `taxaPontosBase`, com `pago_em is
     not null`, ordenadas por `numero`. Passe-as a `gravarNova`.
   - **Depois** de `gravarNova`, a defesa no núcleo, no molde da restrição adiada da soma (duas camadas):
     - releia as parcelas GRAVADAS da nova (`numero`, `vencimento`, `valorCentavos`, `forma`, `pagoEm`,
       `taxaPontosBase`, por `numero`);
     - monte as `parcelasDaNova` como `{ vencimento: pagoEm ?? vencimento, valorCentavos, forma, pago: pagoEm !==
       null }` e rode `taxasHerdadasDaCorrecao`;
     - para toda parcela herdada cuja taxa gravada difira de `pontosBase`, lance
       `new Error("Correção recusada: a taxa de uma parcela já recebida mudaria")`. A transação desfaz tudo, e a ação
       cai no `console.error` + frase “rede” de sempre.
     - Vale para venda e despesa (a despesa grava `null` e a original tem `null`).
   - Acrescente as duas leituras à ordem descrita no comentário do topo da função.
6. Em `acoes.ts`:
   - `lancarVenda` passa `(txDaNova, pagasDaOriginal) => gravarVenda(txDaNova, pedido, { registradoPor,
     taxaCartaoPontosBase, pagasDaOriginal })`;
   - `lancarDespesa` continua com `gravarDespesa`, com um comentário dizendo que a despesa nunca tem taxa e que as
     pagas são ignoradas de propósito;
   - `exigirUsuario()` continua a primeira linha. Nada do navegador entra na taxa: as pagas vêm do banco, sob a
     trava.
   - Não herde `pagoPor` (IN-01): fica fora da decisão do dono. Registre isso no SUMMARY.

**C. WR-01, o mesmo retrato** (`lib/financeiro/consultas.ts`; decisão do dono de 07/10/2026).

7. Crie `export async function lerDocumentoParaCorrecao(leitor, id)`, com o leitor no molde `LeitorDaVersao` de
   `gravacao.ts`.
   - Faça as mesmas leituras de hoje, EM SEQUÊNCIA e todas pelo `leitor`: o documento com o join do orçamento, as
     linhas, as parcelas (agora com `numero` e `taxaPontosBase`), as origens, a contagem do livro e
     `versaoAtualDoDocumento(leitor, id)`.
   - `origensDaAgendaEDasQueimas` ganha o parâmetro `leitor`, com padrão `db` para o detalhe continuar igual; os
     `unionAll` também usam o `leitor`.
   - Devolve o mesmo `DocumentoParaCorrecao`.
   - A versão continua saindo da MESMA leitura e do mesmo normalizador da transação (a regra do plano 16). Por isso
     não se recalcula a versão a partir das linhas da página.
8. `obterDocumentoParaCorrecao(id)` passa a ser `db.transaction((tx) => lerDocumentoParaCorrecao(tx, id), {
   isolationLevel: "repeatable read", accessMode: "read only" })`. Reescreva o comentário (~731–735): todas as
   leituras veem um retrato só, e por isso um “Recebi” confirmado no meio não separa o rascunho da versão (WR-01).
   A assinatura não muda, e a página não muda neste ponto.

**D. A prova contra Postgres** (`scripts/provar-corridas-da-correcao.ts`). Siga o molde dos casos (a)–(e): cada caso
semeia o seu, roda todos e junta as falhas. A semente ganha uma categoria de despesa.

- **(f1)** Uma venda de valor livre com data D1 = hoje − 40 dias, gravada por `gravarVenda` com
  `taxaCartaoPontosBase: 499` e duas parcelas no cartão: a 1/2, de R$ 100,00, paga em D1; a 2/2, de R$ 100,00, em
  aberto.
  - Meça ANTES:
    - o `liquidoDaParcela` da 1/2;
    - `saldoAntesDaJanela(await somarMovimentosAntesDe(primeiroDiaDoMes(mesSeguinte(D1 do mês))))`;
    - `resumoDoMes` do mês de D1, com `listarDocumentosDoMes` e `listarParcelasPagasNoMes`.
  - Corrija com a versão de `versaoAtualDoDocumento(db, …)`. `gravarNova` grava pela `gravarVenda` com
    `taxaCartaoPontosBase: 349` (a taxa “de hoje”, mudada em Cadastros) e as `pagasDaOriginal`. A nova tem a
    pessoa trocada, a mesma data, a mesma linha e as parcelas {D1, 10000, cartão, paga} e {hoje, 10000, cartão,
    paga}.
  - Afirme:
    - a 1/2 da nova tem taxa 499 e a 2/2 tem 349;
    - os três números de antes são IGUAIS aos de depois (`deepStrictEqual` no resumo);
    - `afirmarTudoOuNada` deu “tudo”.
  - As leituras do saldo e do Mês são globais. Vale porque os casos rodam em sequência e nada mais escreve nesse
    banco; diga isso num comentário.
- **(f2)** A cadeia: corrija de novo a nova do (f1), agora com a taxa de hoje a 300. A 1/2 continua com 499.
- **(f3)** Uma despesa “outra” por `gravarDespesa`, paga no cartão em D1. Corrija pela `gravarDespesa`: a parcela da
  nova tem taxa `null`, e o saldo antes do mês seguinte é igual.
- **(f4)** A defesa do núcleo: uma correção cujo `gravarNova` IGNORA as `pagasDaOriginal` (grava 349 na parcela de
  D1). Ela é recusada (o erro do passo 5), e `afirmarTudoOuNada` dá “nada”.
- **(g)** WR-01, o retrato:
  1. Semeie uma venda em aberto e guarde a `versaoAntes`.
  2. Abra `db.transaction(..., { isolationLevel: "repeatable read", accessMode: "read only" })` e faça um primeiro
     `select 1`. O retrato do RR nasce no primeiro comando, não no `begin`.
  3. Fora da transação, pela `conexao`, marque a parcela como paga, como um “Recebi” de outro celular.
  4. Dentro da transação, chame `lerDocumentoParaCorrecao(tx, id)` e afirme que a parcela vem em aberto E que a
     versão é `versaoAntes`: o par é coerente.
  5. Fora, corrigir com essa versão é recusado com `mudou`, e nada é gravado.
  6. `lerDocumentoParaCorrecao` relido fora traz a parcela paga e outra versão.
- Importe de `@/lib/financeiro/consultas`, `@/lib/financeiro/extrato`, `@/lib/financeiro/mes`,
  `@/lib/financeiro/taxa` e `@/lib/financeiro/calendario`. A faxina já apaga pelos `documentoIds`; registre as
  despesas e a categoria nova.
- Rode `npm run test:migracoes`: tudo verde, e nenhum 40P01.

**E. A tela diz a taxa que vai ser gravada** (BL-01; o aviso não pode afirmar 3,49% quando o servidor vai gravar
4,99%).

9. Em `lib/financeiro/taxa.ts`, `ParcelaParaAvisoDoCartao` ganha `taxaPontosBase?: number | null`:
   - `undefined` usa a taxa global;
   - `null` conta 0.
   Atualize o comentário.
10. Em `lib/financeiro/textos.ts`, que continua sem formatar dinheiro sozinho, crie:
    - `textoAvisoCartaoHerdado(percentual, taxa, entram)`: “Cartão: a maquininha ficou com {4,99}% ({R$ 4,99}) — a
      taxa de quando a venda foi recebida, que a correção mantém. Entram {R$ 95,01} no caixa e a taxa vira custo do
      mês.” Use-o quando TODAS as parcelas no cartão herdaram a mesma taxa.
    - `textoAvisoCartaoMisto(taxa, entram, percentualDeHoje)`: “Cartão: a maquininha fica com {R$ 8,48} — as
      parcelas já recebidas mantêm a taxa de quando entraram, e as novas usam a de hoje ({3,49}%). Entram
      {R$ 191,52} no caixa e a taxa vira custo do mês. A taxa muda em Cadastros → Taxas.” Use-o quando há herdadas
      E (novas no cartão OU taxas herdadas diferentes).
11. O caminho dos dados até o bloco:
    - a página passa `rascunhoDaCorrecaoNoPainel.pagasDaOriginal` em `CorrecaoNoPainel.pagasDaOriginal`;
    - `painel-venda.tsx` passa `pagasDaOriginal` a `BlocoPagamento` só com `correcao` e não `desligada`. Depois de
      “Lançar como venda nova”, o lançamento é uma venda comum, com a taxa de hoje;
    - `bloco-pagamento.tsx` calcula `taxasHerdadasDaCorrecao(pagasDaOriginal, parcelasConvertidas)`, passa a taxa
      por parcela ao `avisoDoCartao` e escolhe entre os três textos.
    - O `data-testid="pagamento-aviso-cartao"` não muda. A despesa não muda: não tem aviso.

**F. e2e** (edite agora, rode uma vez ao fim). Crie “polimento corrigir — venda (c) uma venda recebida no cartão
corrigida mantém a taxa com que foi recebida”:

1. Leia a taxa de hoje (`select taxa_cartao_pontos_base from configuracao_financeira limit 1`) e calcule
   `taxaDaOriginal = taxaDeHoje + 150`.
2. Semeie com `semearContaAPagar({ tipo: "venda", valorCentavos: 10000, vencimento: hojeNoAtelie(), … })`. Então,
   no banco, faça a parcela `forma = 'cartao'`, `pago_em = hoje`, `pago_por` = o gestor de teste e
   `taxa_pontos_base = taxaDaOriginal`.
3. Chame `abrirCorrecao`. O `pagamento-aviso-cartao` contém o percentual da original, formatado com vírgula, e “a
   taxa de quando a venda foi recebida”.
4. Troque só a pessoa (placeholder “quem comprou”) e toque em `lancar-correcao`. Aparece o toast da correção.
5. No banco:
   - a nova tem UMA parcela com `forma = 'cartao'`, `pago_em = hoje` e `taxa_pontos_base = taxaDaOriginal`;
   - a original está cancelada;
   - `corrigidaPor` aponta para a nova.

Nunca mude a taxa global no e2e. Use `medirCaixa` se medir caixa; não force clique.

**G. Fechar.**
12. Rode a ÚNICA invocação e2e desta tarefa:
    `npm run test:e2e -- --grep "polimento corrigir|financeiro-venda|financeiro-pagamento"`.
    - O `financeiro-pagamento` prova que o aviso do cartão fora da correção não mudou.
    - Não rode a e2e duas vezes só para mostrar o RED. Registre o GREEN e explique no SUMMARY por que o (c) falharia
      no código velho: a nova gravaria a taxa de hoje.
13. Rode `npm run verificar` (exit 0). Commit local:
    `fix(financeiro): Corrigir mantém a taxa do cartão das parcelas já recebidas e lê rascunho e versão do mesmo retrato (quick 261007-shs, 06.5-BL-01/WR-01)`,
    terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/financeiro-correcao.test.ts tests/unit/financeiro-taxa.test.ts</automated>
    <automated>npm run test:migracoes</automated>
    <automated>npm run test:e2e -- --grep "polimento corrigir|financeiro-venda|financeiro-pagamento"</automated>
    <automated>npm run verificar</automated>
    <automated>grep -n "taxasHerdadasDaCorrecao" lib/financeiro/gravacao.ts components/amassa/financeiro/bloco-pagamento.tsx</automated>
    <automated>grep -n "repeatable read" lib/financeiro/consultas.ts</automated>
    <automated>grep -n "(f1)\|(f4)\|(g)" scripts/provar-corridas-da-correcao.ts</automated>
  </verify>
  <done>
- Uma correção não muda a taxa, o líquido, o saldo nem o Mês de uma parcela já recebida no cartão. Só as parcelas
  novas usam a taxa de hoje.
- O núcleo recusa uma nova que reescreveria o passado. Isso está provado contra Postgres em (f1)–(f4).
- O rascunho e a versão saem do mesmo retrato (g).
- O aviso do cartão na correção diz a taxa verdadeira.
- Unit, `test:migracoes`, a e2e da tarefa e `npm run verificar` verdes. Um commit local.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: “Gerar as contas de {mês}” pergunta antes de recriar conta fixa cancelada no mês (06.5-WR-03) e cancelar uma correção avisa que a original fica cancelada (06.5-WR-02)</name>
  <files>lib/cadastros/contas-fixas.ts, lib/cadastros/esquemas.ts, lib/cadastros/acoes.ts, lib/cadastros/textos.ts, lib/cadastros/avisos.ts, lib/financeiro/avisos.ts, lib/financeiro/textos.ts, app/gestao/(app)/cadastros/page.tsx, app/gestao/(app)/financeiro/page.tsx, components/amassa/cadastros/geracao-de-contas.tsx, components/amassa/cadastros/botao-gerar-contas.tsx, components/amassa/cadastros/aviso-cadastros.tsx, components/amassa/financeiro/aviso-contas-fixas.tsx, components/amassa/financeiro/aviso-financeiro.tsx, components/amassa/financeiro/confirmar-cancelar-documento.tsx, tests/unit/cadastros-contas-fixas.test.ts, tests/unit/cadastros-textos.test.ts, tests/unit/cadastros-categorias.test.ts, tests/unit/financeiro-avisos.test.ts, tests/unit/financeiro-correcao.test.ts, tests/e2e/polimento-banco.spec.ts, tests/e2e/polimento-caixa.spec.ts, tests/e2e/polimento-corrigir.spec.ts</files>
  <behavior>
    - planejarGeracaoDoMes sem conta cancelada → { tipo: "gerar", criar: [as que não têm despesa no mês], recriar: [], mantidas: [] }. Conta com despesa ATIVA no mês nunca entra em lista nenhuma.
    - Conta só com despesa CANCELADA no mês, ausente de `canceladasVistas` → { tipo: "perguntar", canceladas: [todas as canceladas de agora, em ordem de nome], novas: quantas seriam criadas }. Nada a gravar.
    - Com `canceladasVistas` cobrindo todas as canceladas de agora → gerar. `recriar` = as canceladas de agora que vieram em `recriar`; `mantidas` = as outras canceladas; `criar` = as sem despesa nenhuma.
    - Uma conta de `recriar` que não está mais só cancelada (alguém a gerou no meio) não entra em `recriar` nem em `mantidas`.
    - Uma conta cancelada nova (não vista) junto com uma vista → perguntar de novo, com a lista inteira de agora.
    - esquemaGeracao: `{ mes }` sozinho passa, com `canceladasVistas` e `recriar` valendo [] (aba aberta antes da publicação). `recriar` fora de `canceladasVistas` falha com frase humana. Id que não é uuid falha. Mais de 500 itens falha.
    - textoContasGeradas(0, "novembro de 2026", 0) = "As contas de novembro de 2026 já existiam." (igual a hoje). (2, …, 0) = "2 contas de novembro de 2026 criadas no Caixa." (igual a hoje). (1, …, 1) = "1 conta de novembro de 2026 criada no Caixa. A cancelada continua cancelada." (0, …, 2) = "Nenhuma conta de novembro de 2026 criada. As 2 canceladas continuam canceladas."
    - tituloContasCanceladas(1, "novembro de 2026") = "Uma conta de novembro de 2026 foi cancelada no Caixa"; (2, …) = "2 contas de novembro de 2026 foram canceladas no Caixa".
    - dicaContasCanceladas(1) = "Marque se ela deve voltar para “A pagar”. Desmarcada, continua cancelada."; (2) = "Marque as que devem voltar para “A pagar”. As desmarcadas continuam canceladas."
    - textoOutrasContasDoMes(0, m) = "As outras contas de {m} já estão no Caixa."; (1, m) = "A outra conta que falta em {m} será criada."; (3, m) = "As outras 3 contas que faltam em {m} serão criadas."
    - frasePerguntaContasCanceladas(["Internet"], m) = "Internet foi cancelada em {m} — recarregue a página e gere de novo para escolher se ela volta."; com ["Internet", "Água"], "Internet e Água foram canceladas em {m} — recarregue a página e gere de novo para escolher quais voltam."
    - avisoDaUrl, dos Cadastros e do Financeiro, aceita `mantidas` inteiro de 0 a 500; sem `mantidas` = 0; inválido = sem aviso.
    - fraseCancelarCorrecao("venda", 33) = "Esta venda corrige a nº 33, que continua cancelada — cancelar esta não traz a nº 33 de volta. Se a correção é que estava errada, use “Corrigir esta venda”." (despesa: o mesmo, com “despesa”).
  </behavior>
  <action>
**RED primeiro.** Escreva o `<behavior>` nos testes:

- `tests/unit/cadastros-contas-fixas.test.ts`: `planejarGeracaoDoMes` e `esquemaGeracao`;
- `tests/unit/cadastros-textos.test.ts`;
- `tests/unit/cadastros-categorias.test.ts`: o `avisoDaUrl` dos Cadastros;
- `tests/unit/financeiro-avisos.test.ts`;
- `tests/unit/financeiro-correcao.test.ts`: `fraseCancelarCorrecao`.

Rode `npx vitest run tests/unit/cadastros-contas-fixas.test.ts tests/unit/cadastros-textos.test.ts tests/unit/cadastros-categorias.test.ts tests/unit/financeiro-avisos.test.ts tests/unit/financeiro-correcao.test.ts`
e veja falhar.

**WR-03 — perguntar antes** (decisão do dono de 07/10/2026; a D-26 continua: cancelar e gerar de novo é o caminho
para corrigir uma conta, mas por escolha explícita).

1. Em `lib/cadastros/contas-fixas.ts`, que continua puro, exporte `planejarGeracaoDoMes({ contas, canceladasVistas,
   recriar })`.
   - `contas` = `{ id, nome, valorCentavos, temAtiva, temCancelada }[]`.
   - O resultado é `{ tipo: "perguntar", canceladas: { id, nome, valorCentavos }[], novas: number }` ou
     `{ tipo: "gerar", criar: id[], recriar: id[], mantidas: id[] }`.
   - Regras do `<behavior>`. Comente citando o WR-03 e a D-26.
2. Em `lib/cadastros/esquemas.ts`, `esquemaGeracao` ganha:
   - `canceladasVistas` e `recriar`, como arrays do MESMO validador de id que `esquemaAtivacaoDeContaFixa` usa, com
     `.max(500)` e `.default([])`;
   - um `superRefine` que exige `recriar ⊆ canceladasVistas`, com a frase “Essa escolha não vale mais — recarregue
     a página e tente de novo.”
   - O padrão `[]` existe para a aba aberta antes da publicação: ela não manda as chaves, e o servidor PERGUNTA.
     Nunca recria em silêncio.
3. `gerarContasDoMes` em `lib/cadastros/acoes.ts`. `exigirUsuario()` continua a primeira linha; o mês continua
   conferido por `mesPermitidoParaGeracao`.
   - O retorno passa a ser:
     - `{ ok: true; dados: { criadas; mes; mantidas: number } }`, ou
     - `{ ok: false; erro: string; pergunta?: { canceladas; novas } }`.
     Exporte o tipo.
   - Na transação:
     1. as contas ativas, AGORA ordenadas por `id`;
     2. UMA consulta agrupada de `documentos` do mês (`mes_referencia` = o primeiro dia, `conta_fixa_id` não
        nulo, agrupado por conta) que diz, por conta, se tem despesa ativa e se tem cancelada (`bool_or`);
     3. `planejarGeracaoDoMes`.
   - **Perguntar:** devolve `{ ok: false, erro: frasePerguntaContasCanceladas(nomes, nomeDoMes(mes)), pergunta }`
     SEM gravar nada. A aba velha mostra o `erro` num toast e não grava nada.
   - **Gerar:** para cada id de `criar ∪ recriar`, na ordem de `id`, faça o MESMO `insert` de hoje, com o MESMO
     `onConflictDoNothing({ target, where: cancelado_em is null })`. Não toque no SQL, que é a constante
     `CONFLITO_DA_GERACAO_DE_CONTAS` do `test:migracoes`. Depois vêm a linha e a parcela de sempre e a contagem de
     `criadas`.
   - Conta `mantida` não é tocada.
   - Comente:
     - por que nada se grava antes da escolha;
     - que o índice parcial da 0031 continua segurando duas ativas;
     - o resíduo aceito: outra pessoa gerar E cancelar a mesma conta entre a leitura e o `insert`, no mesmo
       instante.
4. Em `lib/cadastros/textos.ts`, que continua sem import, crie:
   - `tituloContasCanceladas`, `dicaContasCanceladas`, `textoOutrasContasDoMes` e `frasePerguntaContasCanceladas`;
   - `FRASE_CANCELADAS_MUDARAM`: “Outra conta deste mês foi cancelada enquanto você escolhia — a lista foi
     atualizada. Confira e gere de novo.”;
   - `ROTULO_VOLTAR_SEM_GERAR`: “Voltar”.
   - `textoContasGeradas` ganha o 3º parâmetro `mantidas = 0`, com o texto do `<behavior>`. Os textos com
     `mantidas = 0` ficam idênticos aos de hoje.
5. Avisos da URL:
   - `lib/cadastros/avisos.ts` e `lib/financeiro/avisos.ts` aceitam `mantidas` (0..500; ausente = 0) no aviso
     `contas-geradas`;
   - as duas páginas passam `mantidas` a `textoContasGeradas`;
   - `aviso-cadastros.tsx` e `aviso-financeiro.tsx` tiram `mantidas` da URL junto com os outros.
6. Crie `components/amassa/cadastros/geracao-de-contas.tsx` (`"use client"`), o fluxo compartilhado. Exporte um hook
   `useGeracaoDeContas({ aoGerar })`, que devolve `{ gerar(mes, mesPorExtenso), enviando, dialogo }`.
   - `gerar` chama `gerarContasDoMes({ mes, canceladasVistas: [], recriar: [] })`:
     - `ok` → `aoGerar(dados)`;
     - `pergunta` → abre o diálogo;
     - outra recusa → `toast.error(resposta.erro)`;
     - exceção → `toast.error(FRASE_FALHA_AO_GERAR_CONTAS)`. Isto também fecha o buraco do `BotaoGerarContas`, que
       não tinha `try`.
   - O diálogo é um `AlertDialog` no molde de `confirmar-cancelar-documento.tsx`, com
     `data-testid="gerar-canceladas"`:
     - título `tituloContasCanceladas`, a dica e `textoOutrasContasDoMes`;
     - uma linha por conta, com `data-testid="gerar-cancelada-opcao"` e `data-conta-id`: um `Checkbox` com o
       rótulo “{nome} · {valor}” (valor por `formatarReais`). Linha inteira clicável, ≥ 44 px, texto ≥ 16 px;
     - **todas desmarcadas ao abrir** (o lado seguro);
     - “Voltar” (`gerar-canceladas-voltar`) fecha sem gravar nada;
     - a confirmação (`gerar-canceladas-confirmar`) tem o rótulo `rotuloGerarContas(mesPorExtenso)`, “Gerando…”
       durante o envio e `aria-busy`. Ela chama de novo com `canceladasVistas` = os ids listados e `recriar` = os
       marcados.
   - Se o servidor perguntar de novo, a lista é trocada pela nova, as marcas das que continuam são mantidas e
     `FRASE_CANCELADAS_MUDARAM` aparece com `role="alert"`.
   - O foco vai à primeira caixa ao abrir. O teclado funciona.
7. `BotaoGerarContas` e `AvisoContasFixas` passam a usar o hook. Cada um mantém a sua navegação de sucesso de hoje,
   acrescentando `&mantidas=${dados.mantidas}`. Atualize os comentários: “sem confirmação” deixou de ser verdade
   quando há conta cancelada no mês.

**WR-02 — o cancelamento de uma correção avisa** (decisão do dono de 07/10/2026; nenhuma mudança de dado).

8. Em `lib/financeiro/textos.ts`, crie `fraseCancelarCorrecao(tipo, numeroOriginal)`, com o texto do `<behavior>`.
9. Em `confirmar-cancelar-documento.tsx`, quando `documento.corrigeNumero !== null`:
   - abaixo do título, um parágrafo com `data-testid="cancelar-correcao-aviso"` e essa frase;
   - no rodapé, entre “Voltar” e o botão destrutivo, o `outline` “Corrigir esta venda/despesa”
     (`rotuloCorrigir`), como `<a href={hrefDaCorrecao(tipo, id)}>` dentro de `Button asChild`,
     `data-testid="cancelar-correcao-corrigir"`, ≥ 44 px.
   - Fora desse caso, o diálogo não muda. Comente citando o WR-02.

**e2e** (edite agora, rode uma vez).

10. Em `polimento-banco.spec.ts` (Cadastros), o teste da conta fixa passa a provar a escolha. Mantenha o
    `@vazio-historico` e o último mês da faixa.
    - O auxiliar `gerarContasDoMes` deixa de afirmar “criada(s)” por conta própria.
    - A 1ª geração e o cancelamento ficam como estão. No cancelamento, afirme que `cancelar-correcao-aviso` NÃO
      aparece: não é uma correção.
    - **2ª geração:** aparece o diálogo `gerar-canceladas`, com a opção da conta pelo `data-conta-id`, desmarcada.
      Confirme SEM marcar. O toast termina em “A cancelada continua cancelada.” ou em “As {N} canceladas continuam
      canceladas.”, por regex. No Caixa, a conta tem 0 cartões.
    - **3ª geração:** o diálogo de novo. Marque a conta e confirme. O toast diz “criada(s)”, e a conta volta UMA
      vez.
    - A faxina continua.
11. Em `polimento-caixa.spec.ts` (atalho do Caixa), um terceiro teste no describe `serial` do aviso, depois dos dois
    de hoje: “uma conta cancelada no mês corrente: gerar pergunta, Voltar não grava, marcada volta uma vez”.
    - Crie a conta C com `criarContaFixaAtiva`.
    - Semeie a despesa CANCELADA de C no mês corrente: `semearContaAPagar` (despesa, com o título
      `tituloDaContaFixa`) e depois `update documentos set conta_fixa_id, mes_referencia, cancelado_em = now(),
      cancelado_por` = o gestor.
    - No Caixa, o aviso do mês corrente fica visível. Toque o botão com o padrão `toPass` de hoje: aparece o
      diálogo, com a opção de C desmarcada.
    - **“Voltar”:** C continua com 0 despesas ativas no banco, e o aviso continua.
    - **Gerar de novo:** marque C e confirme. Aparece o toast “criada(s)”. No banco, C tem exatamente 1 despesa
      ativa no mês. O aviso do mês corrente some.
    - `finally`: `devolverOBanco`.
    - Afirme sobre C pelo `data-conta-id`, nunca pela contagem de opções: outras contas canceladas do banco podem
      aparecer, e ficam desmarcadas e canceladas.
12. Em `polimento-corrigir.spec.ts`, “— detalhe (a)”: depois da correção, no detalhe da NOVA, toque “Cancelar esta
    venda”. Afirme:
    - `cancelar-correcao-aviso` = `fraseCancelarCorrecao("venda", original.numero)`;
    - `cancelar-correcao-corrigir` com o `href` da correção da nova e ≥ 44 px (`medirCaixa`).
    Toque “Voltar”: `documentoNoBanco(nova.id).cancelado` = false.
13. Rode a ÚNICA invocação e2e desta tarefa:
    `npm run test:e2e -- --grep "polimento-banco|polimento-caixa|cadastros-contas-fixas|polimento corrigir — detalhe"`.
    - O `cadastros-contas-fixas` prova que gerar sem conta cancelada continua como hoje, inclusive o “já existiam”.
    - Nunca ponha `@parametro-global` no grep. Não force clique.
    - Registre no SUMMARY os comandos e2e rodados e o resultado.
14. Rode `npm run verificar` (exit 0; `verificar-acoes` continua 125). Commit local:
    `fix(cadastros,financeiro): Gerar pergunta antes de recriar conta fixa cancelada no mês e cancelar uma correção avisa que a original fica cancelada (quick 261007-shs, 06.5-WR-03/WR-02)`,
    terminando com o `Co-Authored-By`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/cadastros-contas-fixas.test.ts tests/unit/cadastros-textos.test.ts tests/unit/cadastros-categorias.test.ts tests/unit/financeiro-avisos.test.ts tests/unit/financeiro-correcao.test.ts</automated>
    <automated>npm run test:e2e -- --grep "polimento-banco|polimento-caixa|cadastros-contas-fixas|polimento corrigir — detalhe"</automated>
    <automated>npm run verificar</automated>
    <automated>grep -n "planejarGeracaoDoMes" lib/cadastros/acoes.ts lib/cadastros/contas-fixas.ts</automated>
    <automated>grep -n "useGeracaoDeContas" components/amassa/cadastros/botao-gerar-contas.tsx components/amassa/financeiro/aviso-contas-fixas.tsx</automated>
    <automated>grep -n "fraseCancelarCorrecao" components/amassa/financeiro/confirmar-cancelar-documento.tsx</automated>
  </verify>
  <done>
- Uma conta cancelada no mês só volta se alguém a marcar, nos Cadastros e no Caixa. As que faltam são geradas como
  hoje. “Voltar” não grava nada, e a aba velha recebe uma frase em vez de recriar.
- Cancelar uma correção diz que a original continua cancelada e oferece “Corrigir”.
- Unit e a e2e da tarefa verdes; `npm run verificar` sai 0. Um commit local.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: a CI promove as imagens pelo digest que testou e a `ferramentas` migra o banco efêmero antes de ser promovida (06.5-WR-04); o Roteiro 23 e os documentos de estado</name>
  <files>.github/workflows/entrega.yml, scripts/conferir-migracoes-da-imagem.mjs, tests/unit/conferir-migracoes-da-imagem.test.ts, tests/unit/entrega-digests.test.ts, docs/operacao/23-correcoes-da-revisao-06-5.md, .planning/phases/06.5-polimento/06.5-REVIEW.md, .planning/phases/06.5-polimento/06.5-UI-SPEC.md, .planning/STATE.md, .planning/PROXIMA-SESSAO.md</files>
  <precondition>Docker em execução (`docker info` sai 0), para a prova local da imagem `ferramentas`.</precondition>
  <behavior>
    - compararMigracoes({ jornal: [{tag "0030_x", when 1, hash A}, {tag "0031_y", when 2, hash B}], aplicadas: [{created_at "1", hash A}, {created_at "2", hash B}] }) → [] (sem problema). `created_at` chega como texto (bigint do pg).
    - Sem a linha de when 2 → um problema que cita "0031_y" e diz que a imagem não aplicou essa migração.
    - Linha de when 2 com hash C ≠ B → um problema que cita "0031_y" e diz que o arquivo da imagem difere do commit.
    - Linha aplicada com when 3, que não está no jornal → um problema dizendo que o banco tem uma migração que o commit não conhece.
    - lerJornalDoCheckout("db/migrations") devolve uma entrada por linha de `_journal.json`, com o sha256 do .sql do disco. O número de entradas é igual ao de arquivos .sql.
    - O workflow (entrega.yml, lido com js-yaml):
      - `construir` tem passos `id: app` e `id: ferramentas` e as saídas `digest_app` / `digest_ferramentas` = `${{ steps.<id>.outputs.digest }}`;
      - todo job cujo texto cita `needs.construir.outputs` tem `construir` no `needs`;
      - `e2e` baixa e roda `@${{ needs.construir.outputs.digest_app }}`;
      - nenhum `run` de `e2e`, `banco` ou `publicar` consome `:${{ github.sha }}` ou `ferramentas-${{ github.sha }}`;
      - `banco` roda `db/migrate.ts` só dentro de `docker run … digest_ferramentas`, e o passo de `conferir-migracoes-da-imagem.mjs` vem depois dele e antes de `test:migracoes`;
      - `publicar` tem `needs` ⊇ construir, e2e e banco, promove pelos dois digests e confere o resultado;
      - todo valor de `DATABASE_URL` aponta para a URL efêmera de teste;
      - o texto não contém o alias de migração do npm (a cadeia "db:" seguida de "migrate").
  </behavior>
  <action>
**RED primeiro.**

- `tests/unit/conferir-migracoes-da-imagem.test.ts` importa os exports do `.mjs` novo (molde
  `tests/unit/verificar-acoes.test.ts`: `allowJs`).
- `tests/unit/entrega-digests.test.ts` lê `.github/workflows/entrega.yml` e carrega o `js-yaml` por
  `createRequire(import.meta.url)("js-yaml")`, com cast para `{ load(texto: string): unknown }`. Não há
  `@types/js-yaml`, e nada se instala. A cadeia do alias de migração do npm é montada por concatenação no próprio
  teste.
- Rode `npx vitest run tests/unit/conferir-migracoes-da-imagem.test.ts tests/unit/entrega-digests.test.ts`. O
  primeiro falha porque o script não existe. O segundo falha contra o workflow de HOJE: sem `id` nem saídas, puxa
  pela tag. Só então implemente.

**A. O conferidor** (`scripts/conferir-migracoes-da-imagem.mjs`, ESM, Node puro + `pg`).

1. Exporte:
   - `lerJornalDoCheckout(pasta)`: `{ tag, when, hash }` por entrada de `meta/_journal.json`, com o hash = sha256
     hex do conteúdo inteiro de `{tag}.sql` (`node:crypto`), igual ao migrador do Drizzle;
   - `compararMigracoes({ jornal, aplicadas })`, puro, que devolve a lista de problemas em frases humanas.
2. O `main` só roda quando o arquivo é o script chamado (`import.meta.url` × `process.argv[1]` via `pathToFileURL`).
   - Conecta com `DATABASE_URL`. Recusa se `current_database()` for `amassa` (molde das provas de corrida).
   - Lê `select hash, created_at from drizzle.__drizzle_migrations`, compara e imprime “N migrações conferidas, iguais
     às do commit” ou os problemas. Sai 1 se houver algum.
3. No topo, comente para que serve: provar que a imagem `ferramentas` que o dono vai rodar à mão em produção aplica
   exatamente as migrações do commit. É o WINDOWS #13 / WR-04.

**B. O workflow** (`.github/workflows/entrega.yml`; WR-04, decisão do dono de 07/10/2026; a D-22 continua).

4. `construir`: dê `id: app` e `id: ferramentas` aos dois `build-push-action` e declare
   `outputs: { digest_app: ${{ steps.app.outputs.digest }}, digest_ferramentas: ${{ steps.ferramentas.outputs.digest }} }`.
   As tags `:<sha>` e `:ferramentas-<sha>` continuam sendo empurradas: servem para rastrear e para voltar à mão.
   Ninguém mais as CONSOME.
5. `e2e`:
   - um primeiro passo que falha com `::error::` se `needs.construir.outputs.digest_app` vier vazio;
   - `docker pull` e `docker run` de `"${{ env.IMAGEM_BASE }}@${{ needs.construir.outputs.digest_app }}"`;
   - atualize os comentários desses passos. O resto não muda: a migração do banco do e2e continua pelo checkout.
6. `banco`:
   - `needs: [qualidade, construir]`;
   - depois do `npm ci`, nesta ordem:
     1. falhar se `digest_ferramentas` vier vazio;
     2. `docker pull` da `ferramentas` pelo digest;
     3. **“Aplicar o schema no banco de teste PELA imagem ferramentas”**: `docker run --rm --network host -e
        DATABASE_URL="${{ env.DATABASE_URL_TESTE }}" "…@${{ needs.construir.outputs.digest_ferramentas }}" npx tsx
        db/migrate.ts`, no lugar do `npx tsx db/migrate.ts` do checkout. Comente: é o mesmo arquivo que o alias do
        npm roda no Roteiro, e o alvo é só o Postgres efêmero deste job (regra §8);
     4. **“Conferir que a imagem aplicou exatamente as migrações do commit”**: `node
        scripts/conferir-migracoes-da-imagem.mjs` com `DATABASE_URL` = a URL efêmera;
     5. **“Conferir que o atalho de migração da imagem aponta para o mesmo arquivo”**: `docker run --rm … node -e`,
        que sai 1 se nenhum valor de `require('./package.json').scripts` for igual a `tsx db/migrate.ts`. Não
        escreva o nome do alias;
     6. `test:migracoes` e `test:backup`, como hoje.
   - Atualize o comentário do job.
   - O `banco` passa a esperar o `construir`. O `e2e` já esperava, então o caminho mais longo do pipeline não muda.
     Diga isso no comentário.
7. `publicar`:
   - `needs: [construir, e2e, banco]`. As saídas só são lidas de `needs` diretos;
   - falhar se algum digest vier vazio;
   - `imagetools create -t "$IMAGEM_BASE:latest" "$IMAGEM_BASE@$DIGEST_APP"` e o mesmo para `:ferramentas`, com os
     digests em `env` do passo;
   - **“Conferir que as tags apontam para os digests testados”**: extraia o digest de `docker buildx imagetools
     inspect "$IMAGEM_BASE:latest"` pela linha que começa com `Digest:` (o formato medido no run `37667733188`) e
     compare com o digest de entrada; o mesmo para `:ferramentas`. Diferente → `::error::` e exit 1.
   - Comente o resíduo aceito: um run cancelado ENTRE os dois `create` pode deixar `:latest` e `:ferramentas` de
     commits diferentes. O `implantar` não roda, e o Roteiro 23 diz para não usar a `ferramentas` até o próximo run
     verde.
8. Reescreva o cabeçalho do arquivo (linhas 3–16), com a data 07/10/2026 e o quick:
   - as duas imagens circulam pelo digest;
   - a `ferramentas` migra o efêmero antes de ser promovida;
   - “o pipeline publica a mesma imagem que testou” passa a valer para as duas.
   Preserve a narrativa: “*até 07/10/2026 a ferramentas era promovida sem ser executada*”. Nenhum segredo novo.
   `permissions` iguais.

**C. O que só se prova localmente** (registre cada comando e resultado no SUMMARY; nada vai a registro nenhum).

9. Rode `npx vitest run tests/unit/conferir-migracoes-da-imagem.test.ts tests/unit/entrega-digests.test.ts`: verde.
10. A imagem `ferramentas`, de verdade:
    1. `docker build -f docker/Dockerfile --target ferramentas -t amassa-ferramentas-prova:local .`;
    2. uma rede `docker network create amassa-prova-ferramentas`;
    3. um `postgres:17-alpine` descartável nela, com usuário, senha e banco de teste e a porta publicada só em
       127.0.0.1;
    4. `docker run --rm --network amassa-prova-ferramentas -e DATABASE_URL=…@<nome do contêiner do
       postgres>:5432/… amassa-ferramentas-prova:local npx tsx db/migrate.ts`, que deve sair 0;
    5. do host, `DATABASE_URL=…@127.0.0.1:<porta>/… node scripts/conferir-migracoes-da-imagem.mjs`, que deve sair 0
       e citar a contagem de migrações;
    6. **a mordida:** apague no banco descartável a linha mais nova de `drizzle.__drizzle_migrations` e rode o
       conferidor de novo. Ele deve sair 1 citando `0031_polimento`;
    7. o `node -e` do atalho de migração contra a imagem local, que deve sair 0.
    - Depois remova o contêiner, a rede e a imagem `amassa-ferramentas-prova:local`. A imagem nunca é empurrada: ela
      pode carregar arquivos locais desta máquina no contexto.
11. A extração do digest: rode o mesmo `imagetools inspect` + extração do passo 7 contra
    `ghcr.io/adcaponte/amassa:latest` (pacote público, leitura anônima). Compare com o `docker pull` da mesma tag.
    Iguais.
12. Diga no SUMMARY o que SÓ o primeiro push prova: o GitHub aceitar `outputs`/`needs`; o `docker run` da
    `ferramentas` no runner com `--network host`; e os digests conferidos no `publicar`. O dono vê isso no Roteiro
    23.

**D. O Roteiro 23** (`docs/operacao/23-correcoes-da-revisao-06-5.md`, no molde curto do 22; “escrito em 07/10/2026
pelo quick 261007-shs, sem ter sido rodado”).

13. O roteiro tem estas partes:
    - **Quando:** uma vez, quando o dono disser “publica”. **Sem migração nenhuma.** A 0031 é a última, e nenhum
      passo do Roteiro 22 se repete.
    - **Passo 1:** o push (do dono).
    - **Passo 2:** `gh run list` / `gh run watch`, e o que olhar:
      - no `banco`, os três passos novos verdes;
      - no `publicar`, “Conferir que as tags apontam para os digests testados” verde;
      - o `implantar` verde.
      Se o run for cancelado no meio do `publicar`, não use a `ferramentas` até o próximo run verde.
    - **Passo 3:** `curl` de `/api/health` e de `/api/health/polimento`, que devem dar 200.
    - **Passo 4 — a taxa das correções já gravadas (BL-01), só leitura.** Use a forma
      `docker compose exec postgres psql -U amassa_owner -d amassa -c "…"` do Roteiro 22, Passo 5.
      - **Consulta 1:** as correções cuja original tinha parcela recebida no cartão. Liste `o.numero`, `n.numero` e
        `c.criado_em` de `correcoes_de_documento c`, com joins em `documentos o` (original) e `documentos n`
        (corrigida), onde `o.tipo = 'venda'` e existe parcela da original com `forma = 'cartao'` e `pago_em is not
        null`, ordenadas por `c.criado_em`.
      - **Consulta 2:** a de `06.5-REVIEW.md` (linhas 331–336), com os números dos documentos.
      - Zero linhas na 1 → nada a fazer.
      - Alguma linha → **pare** e cole as duas saídas para o Code. Uma correção de dados é outro quick, com backup
        antes, e as cadeias (correção de correção) pedem a taxa da RAIZ. Nunca corrija à mão no `psql`.
      - Diga que a caminhada de 07/10 pode ter gravado correções de teste, que a limpeza do item 10 vai tirar.

**E. Fechar o código.**
14. Rode `npm run verificar` (exit 0). Commit local:
    `ci(entrega): imagens pelo digest testado e a ferramentas migra o banco efêmero antes de ser promovida (quick 261007-shs, 06.5-WR-04)`,
    incluindo o Roteiro 23 e terminando com o `Co-Authored-By`.

**F. Documentos de estado** (regra do CLAUDE.md: documento de estado desatualizado é defeito). Preserve a narrativa
com “*Até 07/10/2026 esta linha dizia…*”. Toda afirmação nova traz a evidência.

15. Em `06.5-REVIEW.md`, abaixo de BL-01 e de cada WR, uma linha em itálico: “*Corrigido em 07/10/2026, quick
    261007-shs (commit `<hash>`): <a correção numa frase>. Não publicado.*” Os hashes vêm de `git log`. Os INFO não
    se tocam.
16. Em `06.5-UI-SPEC.md`, nas Confirmações (“Gerar contas pelo aviso do Caixa — sem confirmação” e “Cancelar
    documento”), uma nota datada com o comportamento novo (WR-03 e WR-02). Na tabela de Toasts, a variante de
    `textoContasGeradas` com `mantidas`.
17. `.planning/STATE.md`, à mão (nunca `gsd-tools state`):
    - o “Current focus” passa a dizer que BL-01 e WR-01..04 estão corrigidos no `main` local, não publicados, e que
      publicar é o Roteiro 23 (push simples, sem migração, com a consulta da taxa).
    - A evidência: os hashes, `git log origin/main..main --oneline`, `git diff 83c3837 -- db/` vazio e `npm run
      verificar` exit 0.
    - O frontmatter `stopped_at` só se a sua linha for presente desatualizado: corrija com nota.
    - Não mexa na tabela de quick tasks: é do orquestrador.
18. `.planning/PROXIMA-SESSAO.md`: “A decidir com o Theo: … BL-01 … WR-01..04” vira “decidido em 07/10, feito no
    quick 261007-shs, não publicado; publicar = Roteiro 23; depois, o item 10”.
19. Fora do git, com o mesmo conteúdo curto:
    - `ESTADO-ATUAL.md` e `Claude outputs/RETOMAR-AQUI.md`;
    - `Claude outputs/FILA-DO-CODE.md`: ✅ com data, se houver item para isto.
20. Commit local:
    `docs(estado): BL-01 e WR-01..04 da revisão 06.5 corrigidos no quick 261007-shs (não publicado)`, com o
    `Co-Authored-By`. Sem push.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/conferir-migracoes-da-imagem.test.ts tests/unit/entrega-digests.test.ts</automated>
    <automated>npm run verificar</automated>
    <automated>grep -n "needs.construir.outputs.digest_" .github/workflows/entrega.yml</automated>
    <automated>grep -n "conferir-migracoes-da-imagem" .github/workflows/entrega.yml</automated>
    <automated>grep -n "261007-shs" .planning/phases/06.5-polimento/06.5-REVIEW.md .planning/STATE.md .planning/PROXIMA-SESSAO.md docs/operacao/23-correcoes-da-revisao-06-5.md</automated>
    <automated>git diff 83c3837 --stat -- db/</automated>
    <automated>git log origin/main..main --oneline</automated>
  </verify>
  <done>
- O workflow consome as duas imagens só pelo digest de `construir`. O `banco` migra o efêmero pela `ferramentas` e
  confere o hash de cada migração. O `publicar` promove pelos digests e confere.
- Os unit da CI, a prova local da imagem (a positiva e a mordida) e `npm run verificar` estão verdes.
- O Roteiro 23 está escrito.
- A REVIEW, a UI-SPEC, o STATE, o PROXIMA-SESSAO e os documentos fora do git estão atualizados com evidência.
- Dois commits locais; nada publicado.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → Server Actions (`lancarVenda`/`lancarDespesa` com `correcao`, `gerarContasDoMes`, `cancelarDocumento`) | entrada não confiável; `correcao`, `canceladasVistas` e `recriar` podem ser velhos ou forjados |
| página (Server Component) → banco | leitura do rascunho e da versão da correção; nunca grava |
| CI (GitHub Actions) → GHCR e Postgres efêmero | a identidade da imagem testada e promovida; a migração só no banco do job |
| dono → produção (`ferramentas`, `psql`) | a imagem que migra produção à mão; as consultas do Roteiro 23 só leem |

## STRIDE Threat Register (ASVS L1)

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-shs-01 | Tampering (dinheiro) | `gravarVenda` / `lancarCorrecaoNaTransacao` | high | mitigate | A taxa da parcela já recebida vem do banco, lida sob a trava `for update` da original depois da conferência da versão. `registrarPagamento` trava o documento primeiro, então nenhum “Recebi” entra no meio. A regra pura `taxasHerdadasDaCorrecao` decide; a conferência pós-gravação no núcleo desfaz tudo se divergir. Provado em (f1)–(f4) contra Postgres e no e2e (c) |
| T-shs-02 | Tampering | taxa vinda do navegador | low | mitigate | O servidor nunca lê taxa do cliente. As `pagasDaOriginal` que a tela recebe servem só ao aviso estimado (V5 — validação no servidor) |
| T-shs-03 | Tampering / corrida | `obterDocumentoParaCorrecao` (WR-01) | medium | mitigate | Todas as leituras numa transação `repeatable read, read only` e a versão pela mesma leitura; a trava e a versão sob a trava continuam. Provado em (g) |
| T-shs-04 | Tampering | `gerarContasDoMes` com `recriar` forjado | medium | mitigate | Zod: uuid, no máximo 500, `recriar ⊆ canceladasVistas`. O servidor recalcula, para o mês pedido (`mesPermitidoParaGeracao`) e as contas ATIVAS, quem está só cancelada; id fora desse conjunto é ignorado. `exigirUsuario()` na primeira linha |
| T-shs-05 | Tampering / perda de dinheiro | recriar conta cancelada em silêncio (pagar duas vezes) | high | mitigate | Nada é gravado antes da escolha explícita; as opções abrem desmarcadas; conta cancelada nova no meio faz perguntar de novo; o índice parcial da 0031 impede duas ativas (predicado intocado). e2e nos dois caminhos |
| T-shs-06 | Tampering (corrida residual) | gerar × gerar+cancelar de outra pessoa entre a leitura e o `insert` | low | accept | Janela de milissegundos e exige duas ações de outra pessoa; o resultado visível é uma conta em “A pagar” que ela mesma acabou de gerar. Comentado no código |
| T-shs-07 | Repudiation / perda de dado | cancelar uma correção (WR-02) | medium | mitigate | A confirmação diz que a original continua cancelada e oferece “Corrigir”; quem cancelou e quando continuam registrados (herdado) |
| T-shs-08 | Tampering (integridade da cadeia) | `:ferramentas` / `:latest` | high | mitigate | Consumo e promoção só pelo digest de `construir`. A `ferramentas` migra o efêmero, e o hash de cada migração é conferido antes de `test:migracoes`. O `publicar` confere o digest das tags. Guarda unitária no workflow |
| T-shs-09 | Elevation of privilege | CI migrando produção | high | mitigate | Nenhum segredo de banco no workflow; todo `DATABASE_URL` aponta para o efêmero (afirmado no unit); o alias de migração do npm não aparece no arquivo (§8, T-06.5-68); o conferidor recusa o banco `amassa` |
| T-shs-10 | Tampering | run cancelado no meio do `publicar` | low | accept | `:latest` e `:ferramentas` podem ficar de commits diferentes. O `implantar` não roda; o Roteiro 23 manda esperar o próximo run verde antes de usar a `ferramentas` |
| T-shs-11 | Information disclosure | build local da `ferramentas` com arquivos privados no contexto | low | mitigate | A imagem local nunca é empurrada e é removida ao fim; o alvo só copia `package.json`, `tsconfig.json`, `drizzle.config.ts`, `db`, `scripts` e `lib` |
| T-shs-12 | Information disclosure | Roteiro 23 em produção | low | mitigate | As consultas só leem e devolvem números de documento e de taxa. Achado → o dono cola para o Code; nenhuma correção à mão |
| T-shs-SC | Tampering | dependências | low | accept | Nenhum pacote novo; o `js-yaml` (4.3.1, transitivo, já no lockfile) só é lido pelo teste |
</threat_model>

<verification>
- `npm run verificar` verde ao fim de cada tarefa: lint, tsc, `verificar-acoes` (125 ações, 0 violações), unit e
  `test:migracoes` com as corridas novas (f1)–(f4) e (g).
- Uma invocação e2e por tarefa, com `--grep` só no que a tarefa tocou. A Tarefa 3 não tem e2e: ela não muda a
  aplicação. Não há varredura completa: é um quick.
- Nenhuma migração: `git diff 83c3837 -- db/` vazio, e `TABELAS_ESPERADAS` igual.
- `git log origin/main..main` mostra os quatro commits do quick. Nada publicado.
- A CI só se prova inteira no push (Roteiro 23). Antes dele, ficam provados: a estrutura do YAML (unit), o
  conferidor (unit), a imagem `ferramentas` migrando um Postgres de verdade e a mordida do conferidor (prova local),
  e a extração do digest contra a imagem pública.
</verification>

<success_criteria>
- BL-01 corrigido como o dono decidiu. Com a taxa mudada entre o pagamento e a correção, o líquido, o saldo e o Mês
  do passado ficam idênticos, provado em unit e contra Postgres. A despesa também foi coberta.
- WR-01, WR-02, WR-03 (perguntar antes, nos dois caminhos) e WR-04 (digests + execução da `ferramentas`) corrigidos.
  Cada um tem um teste que falha sem a correção e passa com ela: unit, prova de corrida ou e2e.
- Publicar continua sendo um push simples, sem migração. O Roteiro 23 diz o que olhar e como saber se alguma
  correção já gravada em produção levou a taxa errada.
- A REVIEW, a UI-SPEC e os documentos de estado dizem o que foi corrigido, com hash e evidência.
</success_criteria>

## Coverage audit (fontes × plano)

| Fonte | Item | Coberto por |
|---|---|---|
| Decisão do dono, 07/10/2026 | BL-01: a parcela recebida mantém a taxa; prova unit + corrida (líquido, saldo, Mês); despesa | Tarefa 1 (A, B, D, E, F) |
| Decisão do dono | WR-01: um retrato só | Tarefa 1 (C, D-(g)) |
| Decisão do dono | WR-02: a confirmação diz que a original fica cancelada, sem mudar o modelo | Tarefa 2 (8, 9, 12) |
| Decisão do dono | WR-03: perguntar antes, pelo nome, desmarcadas ficam canceladas, Zod, à prova de corrida com a 0031, Cadastros e Caixa, texto pt-BR | Tarefa 2 (1–7, 10, 11) |
| Decisão do dono | WR-04: promover pelo digest exercitado, executar a `ferramentas` antes, digest para as duas | Tarefa 3 (A–C) |
| Restrições do orquestrador | um plano, três tarefas, sem migração, regras da casa, uma e2e por tarefa, commits pt-BR, `<threat_model>`, artefatos | todo o plano |
| CLAUDE.md | documentos de estado corrigidos com evidência | Tarefa 3 (F) |
| 06.5-REVIEW | IN-01..IN-09 | **fora**: o dono não os decidiu. O IN-01 (`pagoPor`) é registrado no SUMMARY como não feito |

## Artifacts this phase produces

| Artefato | Tipo | Tarefa |
|---|---|---|
| `lib/financeiro/correcao.ts` — `taxasHerdadasDaCorrecao`, `ParcelaPagaDaOriginal`, `TaxaDaParcelaDaCorrecao`; `rascunhoDaCorrecao` com `pagasDaOriginal` | código puro | 1 |
| `lib/financeiro/gravacao.ts` — herança em `gravarVenda`; leitura sob a trava e conferência pós-gravação em `lancarCorrecaoNaTransacao` | código | 1 |
| `lib/financeiro/consultas.ts` — `lerDocumentoParaCorrecao`; `obterDocumentoParaCorrecao` em `repeatable read, read only` | código | 1 |
| `lib/financeiro/taxa.ts` + `textos.ts` + `bloco-pagamento.tsx` + `painel-venda.tsx` + `page.tsx` — o aviso do cartão com a taxa verdadeira na correção | código e UI | 1 |
| `scripts/provar-corridas-da-correcao.ts` — casos (f1)–(f4), (g) | prova contra Postgres | 1 |
| e2e “polimento corrigir — venda (c)” | teste | 1 |
| `lib/cadastros/contas-fixas.ts` — `planejarGeracaoDoMes`; `esquemas.ts`, `acoes.ts`, `textos.ts`, `avisos.ts` (dois) | código | 2 |
| `components/amassa/cadastros/geracao-de-contas.tsx` (novo) — `useGeracaoDeContas` e o diálogo das canceladas | UI | 2 |
| `confirmar-cancelar-documento.tsx` + `fraseCancelarCorrecao` | UI | 2 |
| e2e alterados: `polimento-banco`, `polimento-caixa` (teste 3), `polimento-corrigir — detalhe (a)` | teste | 2 |
| `.github/workflows/entrega.yml` — digests, migração pela `ferramentas`, conferência no `publicar` | CI | 3 |
| `scripts/conferir-migracoes-da-imagem.mjs` (novo) | script | 3 |
| `tests/unit/conferir-migracoes-da-imagem.test.ts`, `tests/unit/entrega-digests.test.ts` (novos) | teste | 3 |
| `docs/operacao/23-correcoes-da-revisao-06-5.md` (novo) — Roteiro 23 | operação | 3 |
| Notas datadas em `06.5-REVIEW.md` e `06.5-UI-SPEC.md`; `STATE.md`, `PROXIMA-SESSAO.md`; fora do git: `ESTADO-ATUAL.md`, `RETOMAR-AQUI.md`, `FILA-DO-CODE.md` | documentos de estado | 3 |
| `261007-shs-SUMMARY.md` | resumo | fim |

Nenhuma migração, nenhuma rota nova, nenhuma Server Action nova exportada, nenhum pacote novo.

<output>
Ao terminar, crie `.planning/quick/261007-shs-corrigir-bl-01-e-wr-01-04-da-revisao-06-/261007-shs-SUMMARY.md`. Ele
deve trazer:

- os quatro commits;
- os comandos e2e rodados de fato, com o resultado;
- a saída do `test:migracoes` para (f1)–(f4) e (g), e os números medidos em (f1): a taxa da nova, o líquido, o
  saldo e o resumo antes e depois;
- a prova local da `ferramentas`: o build, a migração, o conferidor verde, a mordida vermelha citando
  `0031_polimento`, o atalho e a limpeza;
- a comparação de digest contra a imagem pública;
- o que só o primeiro push prova;
- a frase “TABELAS_ESPERADAS não mudou; nenhuma migração”.

Inclua uma seção “## Decidido sem o Theo”, com alternativa e como desfazer, para:

- a 2ª passada da herança: mesmo dia e cartão, valor diferente, herda. A alternativa é o casamento estrito da
  revisão;
- herdar `null` como `null`;
- a conferência pós-gravação no núcleo;
- os dois textos novos do aviso do cartão;
- o IN-01 (`pagoPor`) NÃO feito;
- o WR-01 pelo retrato `repeatable read`, e não pela versão recalculada das linhas da página;
- WR-03:
  - as opções abrem desmarcadas;
  - a pergunta vem antes de qualquer gravação, numa chamada só;
  - a aba velha recebe uma frase;
  - `mantidas` vai na URL do toast;
  - o resíduo de corrida aceito;
- WR-02: o “Corrigir” oferecido dentro da confirmação;
- WR-04:
  - o `banco` migra pela imagem, e não mais pelo checkout;
  - `npx tsx db/migrate.ts` no lugar do alias, pela regra §8;
  - o resíduo do cancelamento no meio do `publicar`;
  - o e2e continua migrando pelo checkout;
- o Roteiro 23: só leitura, e achado vai ao Code.
</output>
