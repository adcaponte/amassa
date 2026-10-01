# Fase 5: Agenda - Mapa de Padrões

**Mapeado:** 2026-10-01
**Arquivos analisados:** 46 (novos + modificados, agrupados por papel)
**Análogos encontrados:** 43 / 46

> Muitos análogos repetem os da Fase 06.1 — onde o excerto já está em
> `.planning/phases/06.1-producao/06.1-PATTERNS.md`, este mapa cita a seção de lá em vez de recopiar.
> Linhas conferidas em 01/10/2026 contra `main` em `2c5c4e0`.

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Análogo mais próximo | Qualidade |
|---|---|---|---|---|
| `lib/agenda/{semana,horario,turma,mensalidade,uso-livre,reposicao,presenca,vagas,receber,numeros,publico}.ts` (novos, PUROS) | utility (regra pura) | transform | `lib/estoque/destinos.ts:1-60` (cabeçalho de pureza, união redeclarada), `lib/producao/calendario.ts` (aritmética civil `somarDias`, `diasEntre`, `ehDataCivil`) | exato |
| `lib/agenda/espaco.ts` (mod: `pessoasAgoraNoEspaco`) | utility pura | transform | ele mesmo (1-28) | exato |
| `lib/agenda/abas.ts` (novo) | utility pura (normalizador de URL) | transform | `lib/cadastros/abas.ts:2-7` (`subDaUrl`), `abaDoEstoqueDaUrl` | exato |
| `lib/agenda/textos.ts` (novo) | config (frases) | — | `lib/estoque/textos.ts`, `lib/inicio/textos.ts` | exato |
| `lib/agenda/esquemas.ts` (novo) | validação | request-response | `lib/estoque/esquemas.ts:180-191` (ver 06.1) | exato |
| `lib/agenda/consultas.ts` (novo, sem diretiva) | service (leitura) | CRUD read | `lib/estoque/consultas.ts:1-20` / `lib/producao/consultas.ts` | exato |
| `lib/agenda/gravacao.ts` (novo, SEM `use server`) | service (escrita com tx) | CRUD write / trava / batch idempotente | `lib/producao/gravacao.ts:1-30` + `lib/cadastros/acoes.ts:830-900` (`gerarContasDoMes`, `onConflictDoNothing`) | exato |
| `lib/agenda/acoes.ts` (novo, `use server`) | controller (Server Actions) | request-response | `lib/estoque/acoes.ts:156-265`; estado desejado: `lib/cadastros/acoes.ts:795-823` | exato |
| `lib/agenda/publico/consultas.ts` (novo, sem diretiva) | service (leitura pública) | read | `lib/producao/consultas.ts` (forma) — exceção nomeada no isolamento do site | parcial |
| `lib/clientes/{consultas,acoes,esquemas,textos}.ts` (novos, D-01) | service/controller | CRUD | `lib/cadastros/{consultas,acoes,esquemas,textos}.ts` | exato |
| `lib/financeiro/gravacao.ts` (novo: `gravarVenda(tx,…)` extraído) | service (escrita com tx) | CRUD write | `lib/producao/gravacao.ts:1-30` (cabeçalho), corpo de `lib/financeiro/acoes.ts:67-312` | exato |
| `lib/financeiro/acoes.ts` (mod: `lancarVenda` aceita `origem`, chama `gravarVenda`) | controller | request-response | ele mesmo (67-130) | exato |
| `lib/financeiro/navegacao.ts` (mod: `hrefDaVendaComOrigem`) | utility | — | `hrefDoCaixa` (16-25) | exato |
| `lib/estoque/{destinos,pedidos}.ts` (mod: destino `uso_livre`, `usoLivreId`) | utility pura | transform | eles mesmos (`DESTINOS_DE_SAIDA` 30-36; `pedidoDeSaidaManual` 69-88) | exato |
| `db/schema.ts` (mod: 4 enums, 8 tabelas, colunas em `documentos`, `movimentacoes_estoque`, `itens_catalogo`) | model | — | `db/schema.ts` (`ordensProducao`, `movimentacoesEstoque`) — ver 06.1 "db/schema.ts" | exato |
| `db/migrations/0026_agenda.sql` (gerado + à mão) | migration | — | `db/migrations/0024_producao.sql` (blocos numerados, `revoke`, gatilhos) | exato |
| `scripts/testar-migracoes.mjs` (mod `TABELAS_ESPERADAS`, provas) | teste/config | batch | ele mesmo (ver 06.1) | exato |
| `app/api/health/agenda/route.ts` (novo) | route | request-response | `app/api/health/producao/route.ts` (1-46) | exato |
| `app/gestao/(app)/agenda/{page,loading,error}.tsx` (page mod; loading/error novos) | route (RSC) | request-response | `app/gestao/(app)/estoque/{page,loading,error}.tsx`; `producao/*` | exato |
| `components/amassa/agenda/*` (abas, barra de navegação, grupo de dia, cartão, grade do mês, legenda) | component | read | `components/amassa/financeiro/abas-financeiro.tsx`, `producao/alternador-vista.tsx`, `estoque/barra-ferramentas-saldos.tsx` (`classeDaPilula`) | role-match |
| `components/amassa/agenda/folha-*.tsx` (lançar, evento, uso livre, fechado, turma, recebi agora) + seletor de pessoa | component (formulário) | request-response | `components/amassa/estoque/folha-movimentacao.tsx`, `producao/folha-nova-ordem.tsx:543-739`, `estoque/seletor-material.tsx` | exato |
| `components/amassa/agenda/{lista-pessoas,ficha-pessoa,a-receber,numeros,moldura-no-site}.tsx` + confirmações | component | read / request-response | `components/amassa/estoque/cartao-saldo.tsx`; `components/ui/alert-dialog.tsx` em diálogos de apagar existentes | role-match |
| `components/amassa/inicio/bloco-agenda-de-hoje.tsx` (mod: consulta real + try/catch) | component (async RSC) | read | `components/amassa/inicio/bloco-producao.tsx` (ver 06.1) | exato |
| `components/amassa/cadastros/{sub-abas-cadastros,lista-catalogo,dialogo-item-catalogo}.tsx` + lista de Clientes nova | component | CRUD | eles mesmos / `lista-catalogo.tsx` | exato |
| `components/amassa/financeiro/painel-venda.tsx` (mod: faixa "Da Agenda", pessoa travada) | component | request-response | ele mesmo | exato |
| `components/amassa/estoque/{secao-para-onde-foi,linha-movimentacao}.tsx` (mod: sexto destino) | component | read | eles mesmos | exato |
| `components/site/agenda-publica.tsx` (Server, lê com queda) | component (RSC site) | read | `components/site/aulas-e-oficinas.tsx` (vira a queda) | parcial |
| `components/site/agenda-publica-calendario.tsx` (Client) + cartão de evento | component (client) | read | `components/site/cartao-do-site.tsx`, `botao-whatsapp.tsx` | role-match |
| `app/page.tsx` (mod: `revalidate` em vez de `force-static` puro, seção viva) | route (site) | read | ele mesmo (1-70) | exato |
| `tests/unit/site-isolamento.test.ts` (mod: exceção nomeada `lib/agenda/publico/consultas.ts`) | test | — | ele mesmo (17-24) | exato |
| `scripts/testar-site-sem-banco.mjs` (mod: prova da queda) | teste | batch | ele mesmo | exato |
| `tests/unit/agenda-*.test.ts`, `clientes-*.test.ts` | test | — | `tests/unit/producao-horas.test.ts:55-60` (pureza), `producao-etapas.test.ts:20-30` (paridade) | exato |
| `tests/unit/{arvore-de-rotas,contraste,tokens,sem-rota-antiga,cadastros-catalogo}.test.ts` (religar) | test | — | eles mesmos | exato |
| `tests/e2e/agenda-*.spec.ts` + `tests/e2e/apoio/semear-agenda.ts` | test | — | `tests/e2e/apoio/semear-producao.ts`, `semear-estoque.ts` (ver 06.1) | exato |
| `tests/e2e/casca.spec.ts` (mod: tirar Agenda de `TELAS_DE_MODULO` 90-99) | test | — | ele mesmo | exato |
| `docs/operacao/17-migracao-agenda.md` | doc | — | `docs/operacao/16-migracao-producao.md` | exato |

## Atribuição de padrões

### `lib/agenda/*.ts` puros

**Análogo do cabeçalho e da união redeclarada:** `lib/estoque/destinos.ts:1-4, 16, 30-36`
```typescript
// Módulo puro do Estoque — ... Só `import type`: nenhuma
// linha alcança React, Next, drizzle-orm, pg ou `@/db` ... `DestinoDeSaida` é REDECLARADO à mão, espelhando o enum
// `destino_saida` do banco (migração 0023) — nenhum import de `@/db/schema` é permitido aqui.
export type DestinoDeSaida = "aula" | "encomenda" | "cafeteria" | "atelie" | "perda";
export const DESTINOS_DE_SAIDA: readonly DescricaoDoDestino[] = [ ... ];
```
- Uniões `TipoEvento`, `TipoInscricao`, `Presenca`, `EstadoUsoLivre` redeclaradas + teste de paridade
  no molde `tests/unit/producao-etapas.test.ts:23-27`:
```typescript
describe("paridade com os enums de db/schema.ts", () => {
  it("ORDEM_DAS_COLUNAS ... casam, na mesma ordem, com etapaProducao.enumValues", () => {
    expect(ORDEM_DAS_COLUNAS).toEqual(etapaProducao.enumValues);
```
- Aritmética de data: importar de `lib/producao/calendario.ts` (`ehDataCivil` 60, `diasEntre` 76,
  `somarDias` 81, `subtrairMeses` 95) — único import permitido além de outros puros. `vencimentoNoMes`
  já existe no Financeiro (usado em `lib/cadastros/acoes.ts:866`); reaproveitar de `lib/financeiro/calendario.ts`
  em vez de reescrever.
- "Hoje"/"agora" sempre argumento; `hojeEmBrasilia(new Date())` só na borda (ação/página).

### `lib/agenda/espaco.ts` (mod)

**Análogo:** ele mesmo. Manter `ocupacaoDoEspaco` (26-28) e o comentário do dono (6-22, sem capacidade);
acrescentar `pessoasAgoraNoEspaco(...)` sem import. Atualizar o trecho "AGD-02/03/04" (19-22) para os
IDs AGE atuais — afirmação de estado.

### `lib/agenda/abas.ts`

**Análogo:** `lib/cadastros/abas.ts:2-7`
```typescript
export type SubCadastros = "catalogo" | "categorias" | "fixas" | "taxas" | "parametros";
export function subDaUrl(valor: string | null | undefined): SubCadastros {
```
→ `abaDaAgendaDaUrl` (`agenda|pessoas|receber|site|numeros`, padrão `agenda`), `vistaDaUrl`,
`semanaDaUrl` (normaliza para segunda), `mesDaUrl`. Desconhecido ou lista → padrão, nunca erro.

### `lib/agenda/gravacao.ts` (SEM diretiva)

**Análogo do cabeçalho:** `lib/producao/gravacao.ts:1-30` — explica a ausência de `use server`, recebe
`tx: TransacaoDoBanco` (de `@/lib/estoque/gravacao`) e documenta a ordem global de travas. Para a Agenda:
**COBRANÇA → (documento novo) → ITENS** (RESEARCH Pattern 1); trava com `for("no key update")`.

**`garantirMensalidadesDoMes` (D-02) — idempotência pelo banco:** `lib/cadastros/acoes.ts:870-884`
```typescript
        const [documentoCriado] = await tx
          .insert(documentos)
          .values({ ... contaFixaId: conta.id, mesReferencia, criadoPor: usuario.id })
          .onConflictDoNothing({ target: [documentos.contaFixaId, documentos.mesReferencia] })
          .returning({ id: documentos.id });
        // Sem linha devolvida: o `on conflict` ignorou a inserção ...
        if (!documentoCriado) { continue; }
```
→ uma instrução `insert … select … on conflict (turma_id, cliente_id, mes) do nothing` (RESEARCH
"Code Examples / D-02"); nunca leitura prévia de "já existe?". Chamado no carregamento da página/Início,
sem `exigirUsuario` (quem chama já autorizou).

### `lib/agenda/acoes.ts` (`"use server"`)

**Análogo:** `lib/estoque/acoes.ts` — ver 06.1 seção "`lib/producao/acoes.ts`" (imports 1-60;
`exigirUsuario` → `safeParse` → `db.transaction` com trava → `planejar*` puro → grava; SQLSTATE só no log
via `codigoDoErroPostgres`; `revalidatePath` fora do `try`).

**Estado desejado, nunca "inverter" (Veio/Faltou, AGE-08):** `lib/cadastros/acoes.ts:790-823`
```typescript
// Recebe o estado DESEJADO, nunca "inverte" ...: duas chamadas com o mesmo valor convergem sempre.
export async function definirContaFixaAtiva(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string; ativa: boolean }>> {
  await exigirUsuario();
  const resultado = esquemaAtivacaoDeContaFixa.safeParse(entradaBruta);
  if (!resultado.success) { return { ok: false, erro: primeiraMensagemDeErro(resultado) }; }
  ...
    if (!linha) { return { ok: false, erro: FRASE_CONTA_FIXA_NAO_EXISTE_MAIS }; }
```
→ `definirPresenca({ inscricaoId, presenca: "veio" | "faltou" | null })`. Revalidar
`rotaDeGestao("/agenda")`, `rotaDeGestao("/")`, `"/"` quando muda o público, `rotaDeGestao("/estoque")`
no encerramento do uso livre, `rotaDeGestao("/financeiro")` em "Recebi agora". **Atenção:** o análogo
usa literal `"/gestao/cadastros"` (817) — não copiar; usar `rotaDeGestao`.

**Encerrar uso livre (D-06):** `pedidoDeSaidaManual` com destino `uso_livre` + `usoLivreId` →
`gravarMovimentacoes(tx, pedidos, { registradoPor })`, depois da trava do uso livre (ver 06.1
"lib/estoque/pedidos.ts").

### `lib/financeiro/gravacao.ts` + `lancarVenda` com `origem`

**Análogo:** `lib/financeiro/acoes.ts:67-130` (`lancarVenda`): a validação (`esquemaVenda`, data,
`repartirDesconto`, `conferirParcelas`, categorias ativas) **fica** na ação; só o bloco de escrita dentro
da transação vai para `gravarVenda(tx, …)` com cabeçalho no molde `lib/producao/gravacao.ts:1-8`.
`lancarVenda` com `origem` chama `vincularCobranca(tx, origem, documentoId)` na mesma tx (Pattern 1).
Primeira linha `const usuario = await exigirUsuario();` (70) não muda. `gravarVenda` grava
`documentos.cliente_id` (D-01).

### `lib/financeiro/navegacao.ts::hrefDaVendaComOrigem`

**Análogo:** `hrefDoCaixa` (16-25)
```typescript
export function hrefDoCaixa(destino: DestinoDoCaixa = {}): string {
  // `URLSearchParams` escapa sozinho — nenhuma concatenação crua de id na query string.
  const parametros = new URLSearchParams({ aba: "caixa" });
  if (destino.parcelaFoco) { parametros.set("parcelaFoco", destino.parcelaFoco); }
  return `${PREFIXO_GESTAO}/financeiro?${parametros.toString()}`;
}
```
→ `aba: "venda"`, `origem: \`${tipo}:${id}\``.

### `lib/estoque/destinos.ts` (mod, D-06)

**Análogo:** ele mesmo (30-36). Acrescentar à união (16) e à lista:
`{ valor: "uso_livre", rotulo: "Uso livre", area: "espaco", vinculo: "uso-livre" }` — `VinculoDoDestino`
(21) ganha `"uso-livre"`. A folha de movimentação manual **não** oferece esse destino (só o encerramento
grava); `secao-para-onde-foi.tsx` lê a lista. O comentário "turma em texto livre até a Agenda existir"
(18-20) é afirmação de estado — corrigir.

### `lib/clientes/*` (D-01)

**Análogo:** `lib/cadastros/{acoes,esquemas,consultas,textos}.ts` — mesmo envelope
`ResultadoDeAcao`, `primeiraMensagemDeErro`, frases em `textos.ts`. Busca por `nome_normalizado`
(função a criar na `0026`; RESEARCH Pergunta 1). Nada se apaga (`revoke delete`).

### `db/schema.ts` e `db/migrations/0026_agenda.sql`

**Análogo:** ver 06.1 seções "db/schema.ts" e "0024/0025". Específico desta fase:
- Datas civis `date(..., { mode: "string" })`; `time` para `inicio/fim/chegada/saida` (volta com
  segundos — Pitfall 9; `minutosDe` aceita os dois); dinheiro `integer` centavos; material `bigint` milésimos.
- Enum `destino_saida` + `uso_livre`: `alter type … add value` **não** pode ser usado na mesma tx —
  os `check`s em `movimentacoes_estoque` são escritos em texto (`::text`) no SQL e no `schema.ts`
  (Pitfall 1; RESEARCH "Code Examples / D-06").
- Bloco à mão: `revoke delete` em `clientes`, `turmas`, `turma_alunos`, `mensalidades`; gatilhos
  `tocar_atualizado_em_*`; semente dos 3 itens com `chave_do_sistema`.
- `scripts/testar-migracoes.mjs`: `TABELAS_ESPERADAS` com comentário
  `// Fase 5 — Agenda (migração 0026_agenda).` + `clientes, turmas, turma_alunos, eventos, inscricoes,
  mensalidades, usos_livres, usos_livres_material`.

### `app/api/health/agenda/route.ts`

**Análogo:** `app/api/health/producao/route.ts` (arquivo inteiro, 1-46)
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.select({ id: ordensProducao.id }).from(ordensProducao).limit(1);
    await db.select({ material: movimentacoesEstoque.materialDaOrdem }).from(movimentacoesEstoque).limit(1);
  } catch (erro) {
    console.error("Falha ao conferir a estrutura da Produção:", erro);
    return NextResponse.json({ status: "erro", motivo: "O banco não tem a estrutura da Produção — a migração 0024 foi aplicada?" }, { status: 503 });
  }
  return NextResponse.json({ status: "ok" });
}
```
→ `clientes.id`, `documentos.clienteId`, `movimentacoesEstoque.usoLivreId`; motivo "…da Agenda — a
migração 0026 foi aplicada?". Entrar em `tests/unit/arvore-de-rotas.test.ts:23-34`.

### `app/gestao/(app)/agenda/{page,loading,error}.tsx`

**Ponto de partida:** `app/gestao/(app)/agenda/page.tsx:1-20` — mantém `await exigirUsuario();` como
primeira instrução (7) e `CabecalhoPagina titulo="Agenda"` (11); sai o `EstadoVazio` com
`notaBotao="Chega na Fase 5."` (12-17).
**Molde de estrutura:** `app/gestao/(app)/estoque/page.tsx` (ver 06.1): `searchParams` passam por
`lib/agenda/abas.ts` antes de qualquer consulta; `garantirMensalidadesDoMes(hoje)` antes das leituras;
`Suspense` por seção. `loading.tsx` / `error.tsx`: copiar `estoque/{loading,error}.tsx` (06.1).

### Componentes `components/amassa/agenda/*`

- **Abas (UI-D1, neutras, 3+2 abaixo de 768px):** `components/amassa/financeiro/abas-financeiro.tsx` /
  `cadastros/sub-abas-cadastros.tsx` (`mx-6 md:mx-8`, `bg-muted p-1 rounded-md`).
- **Semana · Mês:** `components/amassa/producao/alternador-vista.tsx`.
- **Pílulas de tipo:** `classeDaPilula` de `components/amassa/estoque/barra-ferramentas-saldos.tsx`.
- **Folhas:** `components/amassa/estoque/folha-movimentacao.tsx` (tela toda no celular, erro embaixo do
  campo com foco, `toast.success` com o que foi gravado, segmentado de 52px) e
  `producao/folha-nova-ordem.tsx:543-739`; material do uso livre reaproveita `seletor-material.tsx` +
  `carregador-do-seletor.tsx`. Seletor de pessoa segue a mesma forma de busca do seletor de material.
- **Barra fixa no celular:** `components/amassa/estoque/barra-acao-fixa.tsx` (ver 06.1, `data-acao-fixa`).
- **Confirmações destrutivas:** `components/ui/alert-dialog.tsx` — dizem o que será perdido.

### `components/amassa/inicio/bloco-agenda-de-hoje.tsx` (religar, D-05)

**Ponto de partida:** ele mesmo (1-37) — mantém `BlocoDoInicio` com `acaoHref={rotaDeGestao("/agenda")}`,
`dataTestId="inicio-bloco-agenda"` e a linha permanente `data-testid="inicio-ocupacao"` (27-33);
troca `ocupacaoDoEspaco(0)` pela contagem real. **Envelope async com try/catch:** `bloco-producao.tsx`
(ver 06.1, `let falhou = false; try { … } catch { console.error(…); falhou = true }` →
`EstadoErro` + `TentarDeNovo`). O comentário "GES-09: o módulo de consultas da Agenda ainda não
existe" (14-18) é afirmação de estado — reescrever.

### Site: `components/site/agenda-publica*.tsx` + `app/page.tsx`

**Queda:** `components/site/aulas-e-oficinas.tsx` (1-80) continua intacto e vira o `catch`; o comentário
(6-29) já descreve o destino ("Server Component lendo as consultas públicas daquele módulo com cache curto
e revalidação por tempo… os dois botões de WhatsApp ficam exatamente como estão") — atualizar para presente.
Reaproveitar `Secao id="agenda" testId="site-agenda"`, `CartaoDoSite`, `BotaoWhatsapp`, `CONTEUDO_SITE`.

**Página:** `app/page.tsx:19` `export const dynamic = "force-static";` + comentário (15-18) e (51-54)
que afirmam "nenhum import alcança banco" — passam a `revalidate = 300` (RESEARCH State of the Art) e a
exceção nomeada; trocar `<AulasEOficinas />` (62) pela seção viva.

**Cerca:** `tests/unit/site-isolamento.test.ts:17-24`
```typescript
const ESPECIFICADORES_PROIBIDOS = ["@/db", "drizzle-orm", "pg", "next-auth", "next/headers", "@/lib/auth/"] as const;
```
→ **reescrita, não afrouxada**: `@/db` alcançável só via `lib/agenda/publico/consultas.ts` (lista de
exceção nomeada); um teste próprio prova que o tipo público não tem campo de pessoa. Prova de fora:
`scripts/testar-site-sem-banco.mjs` (raiz 200 com Postgres derrubado, mostrando a queda).

### Testes

- **Pureza:** `tests/unit/producao-horas.test.ts:55-60`
```typescript
describe("pureza", () => {
  it("lib/producao/horas.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/producao/horas.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
```
  (para módulos que importam `lib/producao/calendario.ts`, afirmar a lista de imports permitidos).
- **e2e:** `tests/e2e/apoio/semear-agenda.ts` no molde `semear-producao.ts` (cliente `pg`, nomes `[e2e]`);
  "hoje" por `hojeNoAtelie()`, nunca `toISOString()`. Contagens globais (Números, A receber) só na cadeia
  `@vazio-historico` de `playwright.config.ts`.
- **casca.spec.ts:** remover a entrada da Agenda de `TELAS_DE_MODULO` (90-99) — fica vazia; conferir o
  laço em 317.

## Padrões compartilhados

### Autorização
**Fonte:** `lib/financeiro/acoes.ts:70`, `lib/cadastros/acoes.ts:833`, `app/gestao/(app)/agenda/page.tsx:7`
**Aplica-se a:** toda exportação de `lib/agenda/acoes.ts`, `lib/clientes/acoes.ts` e toda `page.tsx`
```typescript
const usuario = await exigirUsuario();
```
Escritas compartilhadas (`gravacao.ts` da Agenda e do Financeiro) e `publico/consultas.ts` sem diretiva.

### Validação
**Fonte:** `lib/cadastros/acoes.ts:835-839` — `esquemaX.safeParse(entradaBruta)` →
`{ ok: false, erro: primeiraMensagemDeErro(resultado) }`. Faixa de data/mês conferida no servidor
(molde `mesPermitidoParaGeracao`, 844-847).

### Idempotência
`on conflict … do nothing` + `returning` vazio = já existia (`lib/cadastros/acoes.ts:870-884`); estado
desejado em vez de alternância (`definirContaFixaAtiva`, 795-823).

### Erro do banco
SQLSTATE só no log via `codigoDoErroPostgres(erro)` (lê `erro.cause.code`); frase humana de `textos.ts`.

### Travas
`for no key update` na cobrança/uso livre/evento; ordem global **DOCUMENTO → ORDEM → COBRANÇA → ITENS**
documentada no topo de `lib/agenda/gravacao.ts` (estende `lib/producao/gravacao.ts:19-25`).

### URLs
`rotaDeGestao("/agenda")`, `hrefDoCaixa`, `hrefDaVendaComOrigem`; nunca literal `"/gestao/..."`
(`tests/unit/sem-rota-antiga.test.ts`).

## Sem análogo

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `lib/agenda/publico/consultas.ts` | service | read público | Primeira leitura de banco alcançável pelo site; forma de consulta comum, mas a fronteira é nova — seguir RESEARCH Pergunta 10 |
| `components/site/agenda-publica-calendario.tsx` | component (client, site) | read | O site não tem nenhum Client Component com navegação; usar UI-SPEC + `CartaoDoSite` só para estilo |
| Grade do mês (`components/amassa/agenda/grade-do-mes.tsx`) | component | read | Nenhuma grade de calendário no projeto; regra em `lib/agenda/semana.ts::gradeDoMes`, visual pelo UI-SPEC |

## Metadados

**Escopo da busca:** `lib/{agenda,cadastros,financeiro,estoque,producao}`, `app/page.tsx`,
`app/gestao/(app)/agenda`, `app/api/health`, `components/{site,amassa/inicio}`, `tests/unit`,
`tests/e2e/{casca.spec.ts,apoio}`; mais o mapa da 06.1
**Arquivos lidos:** ~16
**Data:** 2026-10-01
