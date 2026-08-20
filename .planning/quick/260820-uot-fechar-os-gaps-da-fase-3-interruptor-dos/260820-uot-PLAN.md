---
phase: quick-260820-uot
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [G-03-2, G-03-3, ITENS-NO-INDICE]
files_modified:
  - lib/encomendas/textos.ts
  - components/amassa/encomendas/formulario-encomenda.tsx
  - components/amassa/cabecalho-pagina.tsx
  - app/(app)/encomendas/[id]/page.tsx
  - components/amassa/encomendas/gantt.tsx
  - components/amassa/encomendas/cartao-encomenda.tsx
  - tests/unit/textos-encomenda.test.ts
  - tests/e2e/encomendas-formulario.spec.ts
  - tests/e2e/encomendas-detalhe.spec.ts
  - tests/e2e/encomendas-indice.spec.ts

estimate:
  tokens: 120000
  raw_tokens: 60000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "No formulário, cada marco (queima1/queima2/entrega) é uma linha com moldura visível de no mínimo 44px de altura, dizendo em português o que o estado atual significa — 'Acontece' ou 'Não acontece' — sem ninguém precisar adivinhar onde clicar (G-03-2)."
    - "Clicar no nome da etapa OU na palavra de estado alterna o marco — a superfície clicável deixa de ser só a pílula de ~32x18px (G-03-2)."
    - "Os marcos continuam sendo interruptor, nunca campo numérico: nenhum input[type=number] existe para queima1, queima2 e entrega (ENC-03, critério 3, não regride)."
    - "A tela de detalhe da encomenda tem um controle de voltar para /encomendas visível no desktop E no celular, com alvo de toque de no mínimo 44x44 (G-03-3)."
    - "A lista de encomendas dá pista de que há itens: a linha do Gantt (desktop) e o cartão (celular) mostram a contagem, com singular e plural corretos em português."
    - "A contagem sai dos itens que a consulta do índice JÁ carrega — nenhuma consulta nova, nenhum N+1: lib/encomendas/consultas.ts fica intacto."
  artifacts:
    - lib/encomendas/textos.ts
    - components/amassa/cabecalho-pagina.tsx
    - tests/unit/textos-encomenda.test.ts
    - tests/e2e/encomendas-formulario.spec.ts
    - tests/e2e/encomendas-detalhe.spec.ts
    - tests/e2e/encomendas-indice.spec.ts
  key_links:
    - "A palavra de estado do marco e a contagem de itens nascem em lib/encomendas/textos.ts — módulo puro, só `import type`, testado no Vitest; nenhum componente redigita a frase."
    - "CabecalhoPagina ganha uma prop OPCIONAL de voltar; as 9 outras páginas que o usam não mudam nem uma linha, e nenhuma segunda moldura de cabeçalho é criada."
    - "A contagem no Gantt vem de `encomenda.itens.length` — o mesmo array que D-13 já manda carregar no índice para a busca varrer descrição de item."
---

<objective>
Fechar os três gaps restantes da Fase 3, achados pelo dono na caminhada humana em produção de
2026-08-20: o interruptor dos marcos que ninguém vê nem entende (G-03-2), a tela de detalhe sem
volta no desktop (G-03-3) e o índice que não dá nenhuma pista de que a encomenda tem itens.

Purpose: os três são a mesma classe de defeito — o sistema faz a coisa certa e não conta a ninguém.
O dono teve de adivinhar onde clicar, teve de usar o botão do navegador para voltar, e concluiu que
os itens não existiam. Nenhum deles é uma regra de negócio errada; todos são a interface calada.

Output: 3 commits atômicos. Nenhuma migração, nenhuma mudança em `db/schema.ts`, nenhuma mudança em
`TABELAS_ESPERADAS` de `scripts/testar-migracoes.mjs`, nenhuma consulta nova ao banco.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md

As causas dos três itens já estão diagnosticadas (seção "Caminhada humana em produção (2026-08-20)"
do VERIFICATION.md e o `<escopo>` deste plano). Não reabra o diagnóstico, não proponha alternativas
ao dono, não peça confirmação de decisão de produto. Execute.
</context>

<orcamento_de_e2e>
Regra dura do `CLAUDE.md`, medida: `npm run test:e2e` custa ~53s de imposto fixo (15s de Postgres
efêmero + 38s de `next build`) ANTES do primeiro teste rodar. O imposto é o mesmo para a suíte
inteira e para um `--grep` que pega um teste só. Na Fase 3 esse descuido custou ~30 minutos.

- **No máximo UMA invocação de `npm run test:e2e` por tarefa**, sempre com `--grep`.
- **Nunca `npm run build` como passo separado** — o e2e já constrói.
- **Uma varredura completa sem `--grep`, UMA vez só, no fechamento** (depois da Tarefa 3). É a
  varredura de fim de fase, e esta é a hora dela.
- Se um `--grep` falhar e você precisar da suíte inteira para diagnosticar, **rode** — a regra é
  sobre o padrão, não uma proibição. Registre no SUMMARY quais comandos rodou de fato.
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes` e `npm test` são baratos: rode à
  vontade.
</orcamento_de_e2e>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1 (G-03-2): o interruptor dos marcos vira um controle visível e falante</name>
  <files>
    lib/encomendas/textos.ts,
    tests/unit/textos-encomenda.test.ts,
    components/amassa/encomendas/formulario-encomenda.tsx,
    tests/e2e/encomendas-formulario.spec.ts
  </files>
  <read_first>
    components/amassa/encomendas/formulario-encomenda.tsx (a função `EtapaDoFormulario`, ~linha
    334 — o ramo `if (marco)` inteiro),
    components/amassa/encomendas/ajuste-rapido-etapa.tsx (linhas 24-27 e 86-96 — o padrão da casa
    para alvo de toque de 44px com desenho visual menor, e o comentário que explica por que o
    tamanho vem de `style` e não de classe),
    components/ui/switch.tsx (as classes `data-[size=default]:h-[18.4px]`/`w-[32px]` e o
    `translate-x-[calc(100%-2px)]` do thumb — é o que amarra a geometria da pílula)
  </read_first>
  <behavior>
    `lib/encomendas/textos.ts` ganha as duas frases do estado de um marco, na linguagem literal de
    ENC-03 ("acontece / não acontece"):
    - marco ligado (`dias === 1`) → "Acontece"
    - marco desligado (`dias === 0`) → "Não acontece"
    Exporte as duas como constantes nomeadas (`ROTULO_MARCO_ACONTECE`,
    `ROTULO_MARCO_NAO_ACONTECE`) e, se preferir, um helper puro que escolhe entre elas a partir do
    booleano. O módulo continua com `import type` e nada mais — é a disciplina do arquivo.
    Teste unitário em `tests/unit/textos-encomenda.test.ts`: ligado devolve a primeira, desligado
    devolve a segunda.
  </behavior>
  <action>
Reescreva SÓ o ramo `if (marco)` de `EtapaDoFormulario`. O ramo de intervalo (campo numérico) não
muda em nada.

O defeito, literal: o `Switch` declara `style={{ width: 44, height: 44, paddingInline: 6,
paddingBlock: 12.8 }}` com `[background-clip:content-box]`, então os 44px são área de toque
INVISÍVEL e o que a pessoa vê é uma pílula de ~32x18px, solta na borda direita de uma linha sem
moldura, sem nenhuma palavra dizendo o que ligado e desligado significam.

O conserto tem duas partes, ambas obrigatórias:

1. **Moldura visível.** A linha do marco passa a ser um contêiner com borda, cantos arredondados e
   altura mínima de 44px — algo como `flex min-h-[44px] items-center justify-between gap-3
   rounded-md border border-border bg-background px-3 py-2`. É isso que faz a linha ler como um
   controle em vez de uma legenda solta. Dê a ela `data-testid={`linha-marco-${etapa}`}`.

2. **Palavra de estado.** À esquerda continua o nome da etapa (`ROTULO_ETAPA[etapa]`). À direita,
   ANTES da pílula, a palavra de estado vinda de `textos.ts`, num `<Label htmlFor={`etapa-${etapa}`}
   className="... cursor-pointer">` com `data-testid={`estado-marco-${etapa}`}`. Ser um `<label
   for>` (e não um `<span>`) é o ponto: clicar na palavra alterna o interruptor, então a superfície
   clicável passa a ser a linha inteira e não a pílula. O `<Label>` do nome da etapa já aponta para
   o mesmo `id` hoje — mantenha, e dê a ele `cursor-pointer` também.

Restrições que fazem parte do contrato desta tarefa:

- **Continua interruptor.** ENC-03 manda "nunca um campo numérico", e o critério 3 da Fase 3 PASSOU
  na caminhada. Não introduza `<Input type="number">`, nem `-/+`, nem select no ramo de marco.
- **Não mexa na geometria da pílula.** O `style={{ width: 44, height: 44, paddingInline: 6,
  paddingBlock: 12.8 }}` e a classe `rounded-full [background-clip:content-box]` do `Switch` ficam
  exatamente como estão. Motivo concreto: o thumb de `components/ui/switch.tsx` é `size-4` (16px) e
  anda `translate-x-[calc(100%-2px)]`, dois valores calculados para o track de 32px do
  `data-size=default`. Alargar o track sem alargar o thumb deixaria o thumb parado no meio da
  pílula quando ligado — um defeito pior que o de agora. Quem ganha tamanho é a MOLDURA, não a
  pílula.
- **Preserve `id={`etapa-${etapa}`}`, `checked`, `onCheckedChange` e o `aria-label`** que descreve a
  AÇÃO ("Ativar {etapa}" / "Desativar {etapa}"), não o estado. Os testes existentes casam o
  interruptor por `getByRole("switch", { name: ... })` — o `aria-label` é contrato.
- A palavra de estado NÃO pode virar o nome acessível do interruptor. O `aria-label` do `Switch`
  vence qualquer `<label for>`, então isso já está resolvido — só não remova o `aria-label`.
- Não toque em `components/ui/switch.tsx`. É arquivo de fornecedor; um variante novo ali seria
  perdido no próximo `shadcn add`.
- Não toque em `components/amassa/encomendas/ajuste-rapido-etapa.tsx`. A pílula de lá tem a mesma
  geometria, mas a linha da trilha do detalhe já mostra "Desligada" no lugar das datas quando
  `dias === 0` (`trilha-etapas.tsx`), então a metade "nenhuma palavra diz o que significa" não vale
  ali. Fica registrado no SUMMARY como observação para o dono decidir, não como conserto silencioso
  nem como omissão.

**Teste e2e novo** em `tests/e2e/encomendas-formulario.spec.ts`, num `test.describe` próprio
chamado `interruptor dos marcos — visível e explícito`. Use os helpers do arquivo (`fazerLogin`,
`botaoVisivel`) e filtre por `:visible` como o resto do arquivo faz. O teste mede GEOMETRIA e
COMPORTAMENTO, nunca só presença de texto — foi exatamente a confiança em asserção de texto que
deixou o defeito do rodapé passar:

1. Para cada uma das três etapas de marco: `boundingBox()` da linha `linha-marco-{etapa}` tem
   `height >= 44`, e `getComputedStyle` da mesma linha devolve `borderTopWidth >= 1px` com
   `borderTopStyle` diferente de `none` — a prova de que existe moldura desenhada, não só um
   `div` invisível.
2. O interruptor de cada marco continua medindo `>= 44` de largura E de altura em `boundingBox()`
   (a área de toque invisível segue lá — não regride).
3. Estado inicial de `entrega` (nasce em `dias: 1` pelos padrões): `estado-marco-entrega` mostra a
   frase de ligado importada de `@/lib/encomendas/textos`, nunca redigitada no teste.
4. Clicar em `estado-marco-entrega` (a PALAVRA, não a pílula) alterna: o `role="switch"` de Entrega
   passa a `aria-checked="false"` e a frase vira a de desligado. É esta asserção que prova que a
   superfície clicável cresceu.
5. Clicar de novo volta ao estado inicial.

O teste existente `as etapas de marco (queima1, queima2, entrega) têm Switch, nunca campo numérico`
continua verde sem edição — se ele quebrar, a moldura virou campo e o conserto está errado.
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npx tsc --noEmit &amp;&amp; npm test</automated>
    <automated>npm run test:e2e -- --grep "interruptor dos marcos"</automated>
  </verify>
  <done>
    Nos dois projetos de viewport, cada linha de marco mede >= 44px de altura, tem borda desenhada,
    mostra "Acontece"/"Não acontece" e alterna ao clique na palavra; o `role="switch"` continua com
    >= 44x44 de área de toque e com `aria-label` de ação; nenhum `input[type=number]` existe para
    queima1/queima2/entrega. `lint`, `tsc` e `npm test` limpos. Commit atômico:
    `fix(encomendas): interruptor de marco vira controle visível dizendo acontece ou não acontece`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2 (G-03-3): voltar para o índice a partir do detalhe, nas duas larguras</name>
  <files>
    components/amassa/cabecalho-pagina.tsx,
    app/(app)/encomendas/[id]/page.tsx,
    tests/e2e/encomendas-detalhe.spec.ts
  </files>
  <read_first>
    components/amassa/cabecalho-pagina.tsx (o arquivo inteiro — 19 linhas),
    app/(app)/encomendas/[id]/page.tsx (linhas 11-14 — o comentário que registra a aposta original
    no "botão voltar do celular", e que precisa ser corrigido junto),
    components/amassa/encomendas/acoes-encomenda.tsx (linhas 33-60 — o padrão de alvo de toque
    `size-11` e o anel de foco usados no cabeçalho de hoje)
  </read_first>
  <behavior>
    `CabecalhoPagina` ganha UMA prop opcional de voltar. Quando ausente (as 9 outras páginas que
    usam o componente), o cabeçalho renderiza como hoje. Quando presente, aparece um controle de
    voltar à ESQUERDA do `<h1>`, na mesma linha, nas duas larguras de tela.
  </behavior>
  <action>
Estenda `CabecalhoPaginaProps` com uma prop opcional — `voltar?: { href: string; rotulo: string }`
(um objeto, para que destino e rótulo acessível nunca cheguem separados). O `rotulo` é o
`aria-label` do controle, em português.

Estrutura do cabeçalho quando `voltar` existe:

- O `div` externo mantém `flex flex-wrap items-center justify-between gap-4 border-b border-border
  px-6 py-6 md:px-8` — não mexa nele. Ele continua com DOIS filhos diretos, senão o
  `justify-between` espalha três blocos e o cabeçalho desmonta.
- Primeiro filho passa a ser um agrupador `flex min-w-0 items-center gap-2` contendo, nessa ordem, o
  controle de voltar (só quando a prop existe) e o `<h1>`.
- O `<h1>` mantém `className="text-display text-foreground"` intacto — `getByRole("heading", {
  level: 1 })` é contrato de vários e2e (casca, design-system, encomendas, detalhe).
- O controle de voltar é um `Link` do `next/link` para `voltar.href`, com
  `aria-label={voltar.rotulo}`, `data-testid="voltar-pagina"`, um `ChevronLeft` de `lucide-react`
  com `aria-hidden="true"`, e classes que garantam 44x44 e foco visível — o padrão da casa é
  `flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring
  focus-visible:ring-2 focus-visible:outline-none` mais um `hover:bg-muted`. Use `-ml-2` para o
  ícone alinhar opticamente com o `px-6` da moldura.

Por que `Link` com destino fixo, e não `router.back()`: o destino é determinístico. `back()`
devolveria a pessoa ao formulário que acabou de salvar, ou ao histórico de outra aba — que é
justamente o tipo de surpresa que o dono relatou. Isto é "subir para o índice", não "voltar no
histórico". Vale nas duas larguras de propósito: no celular o botão do sistema operacional
continua funcionando e passa a ter um par visível dentro do app.

Em `app/(app)/encomendas/[id]/page.tsx`: passe `voltar={{ href: "/encomendas", rotulo: "Voltar para
as encomendas" }}` ao `CabecalhoPagina`, sem mexer no `titulo` nem no `AcoesEncomenda` que já são
filhos dele. Corrija o comentário das linhas 11-14: a frase sobre "botão voltar do celular" é a
aposta que reprovou na caminhada humana, e deixá-la ali faria o próximo leitor repetir o erro.
Reescreva-a dizendo que a encomenda tem endereço próprio (D-01) e que a volta ao índice é explícita
no cabeçalho, nas duas larguras.

Restrições:
- Nenhuma outra página passa a prop nesta tarefa. `queimas/[id]`, `queimas/relatorios` e
  `conta/senha` são telas com a mesma carência, mas estão fora do escopo do gap G-03-3 — a prop
  opcional deixa cada uma delas a uma linha de distância quando o dono pedir. Registre isso no
  SUMMARY.
- Não crie um segundo componente de cabeçalho, nem uma variante `md:`-only. Um componente, uma
  prop, os dois tamanhos de tela.
- Não mude a assinatura existente (`titulo`, `children`) nem o comportamento com a prop ausente.

**Teste e2e novo** em `tests/e2e/encomendas-detalhe.spec.ts`, dentro do `test.describe` `detalhe da
encomenda`, com o título contendo a frase `voltar para o índice` (é por ela que o `--grep` desta
tarefa pega o teste). Roda nos DOIS projetos, sem `test.skip` — é a divergência desktop/celular que
este teste existe para vigiar. Usando os helpers já existentes do arquivo (`fazerLogin`,
`criarEncomenda`, `nomeUnico`, `hojeBrasilia`, `abrirDetalhe`):

1. Cria uma encomenda e abre o detalhe.
2. `page.getByTestId("voltar-pagina")` está visível e tem `href` exatamente `/encomendas`.
3. `boundingBox()` mede `>= 44` de largura E de altura — medição, não presença.
4. O `<h1>` com o nome da encomenda continua visível ao lado (`getByRole("heading", { name: nome,
   level: 1 })`) — prova que o agrupador não quebrou o cabeçalho.
5. Clicar leva a `/encomendas` (`toHaveURL(/\/encomendas$/)`) e o índice mostra
   `getByRole("heading", { name: "Encomendas", level: 1 })`.
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npx tsc --noEmit &amp;&amp; npm test</automated>
    <automated>npm run test:e2e -- --grep "voltar para o índice"</automated>
  </verify>
  <done>
    Nos dois projetos, o detalhe da encomenda mostra o controle de voltar com >= 44x44, `href`
    `/encomendas`, e clicar nele chega ao índice; o `<h1>` do nome continua sendo o heading de nível
    1 da página; nenhuma outra página que usa `CabecalhoPagina` mudou de aparência (`tsc` limpo
    prova que a prop é opcional). Commit atômico:
    `fix(encomendas): detalhe ganha volta explícita para o índice no cabeçalho`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: o índice mostra quantos itens a encomenda tem</name>
  <files>
    lib/encomendas/textos.ts,
    tests/unit/textos-encomenda.test.ts,
    components/amassa/encomendas/gantt.tsx,
    components/amassa/encomendas/cartao-encomenda.tsx,
    tests/e2e/encomendas-indice.spec.ts
  </files>
  <read_first>
    components/amassa/encomendas/gantt.tsx (o tipo `EncomendaDoGantt`, ~linha 26, e a coluna fixa
    da linha, ~linhas 152-180 — o `Link` com nome, selo e cliente),
    components/amassa/encomendas/cartao-encomenda.tsx (o arquivo inteiro — 65 linhas),
    components/amassa/encomendas/lista-encomendas.tsx (o tipo `EncomendaDoIndice`, ~linha 31 — o
    campo `itens` que D-13 já obriga a carregar no índice para a busca varrer descrição de item)
  </read_first>
  <behavior>
    `lib/encomendas/textos.ts` ganha uma função pura que traduz a contagem em frase de interface,
    com singular e plural corretos em português:
    - `0` → "sem itens" (impossível pela interface — `esquemaEncomenda.itens.min(1)` —, mas
      alcançável por linha semeada direto no banco; "0 itens" seria uma frase que ninguém escreve)
    - `1` → "1 item" (o mínimo obrigatório, o caso que mais vai aparecer)
    - `2` → "2 itens"
    - `17` → "17 itens"
    Teste unitário em `tests/unit/textos-encomenda.test.ts` cobrindo os quatro casos acima
    (zero-um-muitos, mais o plural genérico). O módulo continua com `import type` e nada mais.
  </behavior>
  <action>
Mudança PURAMENTE de apresentação. `listarEncomendasDoIndice` já devolve `EncomendaComFilhos[]` com
`itens` em memória, e `app/(app)/encomendas/page.tsx` já repassa `itens` para
`EncomendaDoIndice`. **Nenhuma consulta nova, nenhum `N+1`, nenhum campo novo no Server Component:
`lib/encomendas/consultas.ts` e `app/(app)/encomendas/page.tsx` NÃO aparecem no diff desta tarefa.**

**Gantt (desktop), `components/amassa/encomendas/gantt.tsx`:**
- Acrescente `itens: { descricao: string }[]` ao tipo `EncomendaDoGantt`. É o mesmo formato que
  `EncomendaDoIndice` já tem, então o `<Gantt encomendas={ativasFiltradas} />` de
  `lista-encomendas.tsx` continua compilando sem nenhuma mudança lá.
- Na coluna fixa, a contagem entra na LINHA DO CLIENTE, não numa terceira linha: a linha do Gantt
  tem 64px (`ALTURA_LINHA`) e já carrega nome + selo + cliente. Transforme o `span` do cliente num
  contêiner `flex items-baseline gap-1 overflow-hidden`, com o nome do cliente em `min-w-0 truncate`
  (o `min-w-0` é o que faz `truncate` funcionar dentro de flex) e, ao lado, um `span shrink-0` com
  `data-testid="contagem-de-itens"` mostrando `· ` seguido da frase da contagem. Quem é sacrificado
  no aperto é o nome do cliente, nunca a contagem.
- Não mexa em `LARGURA_COLUNA_FIXA`, `ALTURA_LINHA` nem em nenhuma constante de geometria — o e2e
  mede 18px/dia e a posição da linha de "Hoje" a partir delas.
- Preserve `data-testid={`gantt-linha-${encomenda.id}`}` e o `Link` da coluna fixa exatamente como
  estão: o critério 13 (nome no Gantt abre a encomenda) passou na caminhada e não pode regredir.

**Cartão (celular), `components/amassa/encomendas/cartao-encomenda.tsx`:**
- O cartão tem altura livre, então a contagem entra no mesmo `span` do cliente, com o mesmo
  separador `·`, num `span` interno com `data-testid="contagem-de-itens"`. `EncomendaDoIndice` já
  tem `itens` — nenhuma prop nova.
- Mantenha `break-words`/`text-apoio text-muted-foreground`: o teste de 320px sem rolagem horizontal
  e o de nome longo continuam valendo.

**Testes e2e** em `tests/e2e/encomendas-indice.spec.ts`. Os dois títulos começam com `a contagem de
itens` — é assim que um `--grep` só pega os dois:
- Um dentro do describe `Gantt desktop (ENC-03, ENC-06, ENC-07)` (que já tem o `test.skip` de
  projeto não-desktop), localizando a linha com `linhaDoGantt(page, nome)`.
- Um dentro do describe `Lista mobile (ENC-08, ENC-09)`, localizando com
  `cartaoDoCelular(page, nome)`.

Cada um cria DUAS encomendas e afirma as duas formas, importando a função de frase de
`@/lib/encomendas/textos` em vez de redigitar o texto: uma com o único item que o helper já cria
(singular) e outra com dois itens (plural). Para a de dois itens, estenda o helper `criarEncomenda`
com um parâmetro OPCIONAL de itens extras (por exemplo `itensExtras?: string[]`), que depois de
preencher o item 1 clica em `Adicionar item` e preenche `Descrição do item N`/`Quantidade do item N`
para cada extra. Parâmetro opcional, ausente por padrão: as ~25 chamadas existentes do arquivo não
mudam nem de comportamento nem de texto.

Nada de asserção só por texto solto na página: ancore sempre dentro da linha do Gantt ou do cartão
daquela encomenda (`linha.getByTestId("contagem-de-itens")`), senão o teste passa por causa de dado
de outro teste rodando no mesmo banco.
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npx tsc --noEmit &amp;&amp; npm test</automated>
    <automated>npm run test:e2e -- --grep "a contagem de itens"</automated>
    <automated>npm run verificar</automated>
  </verify>
  <done>
    A linha do Gantt e o cartão do celular mostram a contagem de itens da própria encomenda, com
    "1 item" no singular e "N itens" no plural, provado por e2e nos dois viewports e por teste
    unitário nos quatro casos; `git diff --name-only` do commit NÃO contém
    `lib/encomendas/consultas.ts` nem `app/(app)/encomendas/page.tsx`; `npm run verificar` passa
    limpo. Commit atômico: `feat(encomendas): índice mostra a contagem de itens de cada encomenda`.

    Depois do commit, execute o fechamento descrito em `<verification>`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (nenhuma nova) | As três tarefas são apresentação: nenhuma Server Action nova, nenhuma entrada de usuário nova, nenhuma consulta nova, nenhuma rota nova. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-uot-01 | Information Disclosure | `gantt.tsx` / `cartao-encomenda.tsx` | low | mitigate | A contagem exposta é `itens.length` de dados que o índice JÁ envia ao cliente para a busca de D-13 — nenhum campo novo atravessa a fronteira servidor→cliente. |
| T-uot-02 | Elevation of Privilege | `app/(app)/encomendas/[id]/page.tsx` | low | mitigate | A página continua com `exigirUsuario()` como primeira instrução; o controle de voltar é um `Link` para uma rota do mesmo grupo protegido, sem parâmetro vindo do cliente. |
| T-uot-SC | Tampering | npm/pip/cargo installs | high | accept | Nenhuma instalação de pacote neste plano — nada é adicionado a `package.json`. Se alguma tarefa exigir dependência nova, PARE e volte ao planejamento. |
</threat_model>

<o_que_nao_fazer>
- **Não** transformar marco em campo numérico, `-/+` ou select. ENC-03 é explícito ("nunca um campo
  numérico") e o critério 3 passou na caminhada.
- **Não** alterar a geometria da pílula do `Switch` nem editar `components/ui/switch.tsx`.
- **Não** criar migração, não tocar em `db/schema.ts`, não mexer em `TABELAS_ESPERADAS` de
  `scripts/testar-migracoes.mjs`.
- **Não** acrescentar consulta ao banco para a contagem de itens — os itens já estão em memória.
- **Não** quebrar o teste de regressão geométrico do rodapé (`o rodapé fica colado ao pé do
  diálogo...`, corrigido em `ab7bce5`), nem o critério 13 (nome no Gantt abre a encomenda).
- **Não** remover ou renomear nenhum `data-testid` existente — são contrato de e2e.
- **Não** marcar teste como `skip` nem afrouxar asserção para fazer a suíte passar. Se um teste
  quebrar, o conserto é o trabalho.
- **Não** atacar as datas por marco (o dono pediu, mas exige migração — é o lote de datas), nem a
  hachura de rascunho, nem G-03-1 (já fechado), nem os itens do `WINDOWS.md`.
- **Não** rodar `npm run build` como passo separado, nem invocar o e2e mais de uma vez por tarefa.
</o_que_nao_fazer>

<verification>
Fechamento, depois dos três commits:

1. `npm run verificar` — tem que passar limpo (`lint`, `tsc --noEmit`, `verificar-acoes`, unitários
   e `test:migracoes`).
2. **Uma** varredura completa de `npm run test:e2e` **sem `--grep`**, uma vez só. É a única
   invocação de suíte inteira autorizada neste plano, e é a varredura de fim de fase.
3. Se algum teste falhar e a causa for ambiente Windows já conhecido, consulte `WINDOWS.md` antes de
   tratar como regressão.
4. `git log --oneline -3` mostra exatamente três commits, um por gap.
5. `git status` limpo; nenhuma migração nova; `db/schema.ts` e `scripts/testar-migracoes.mjs`
   intactos.
6. Registre no SUMMARY **quais comandos de e2e rodou de fato e quantas vezes**.
</verification>

<success_criteria>
- Três commits atômicos, na ordem Tarefa 1 → 2 → 3.
- Formulário: cada marco é uma linha com moldura de >= 44px de altura dizendo "Acontece"/"Não
  acontece", e clicar na palavra alterna — medido por geometria e por `aria-checked`, não por texto.
- O interruptor continua interruptor: zero `input[type=number]` para queima1/queima2/entrega.
- Detalhe da encomenda: controle de voltar para `/encomendas` com >= 44x44, visível e funcional no
  desktop E no celular, com o `<h1>` do nome intacto ao lado.
- `CabecalhoPagina` tem prop de voltar OPCIONAL; nenhuma das outras páginas que o usam mudou.
- Índice: contagem de itens na linha do Gantt e no cartão, "1 item" no singular, "N itens" no
  plural, com frase vinda de `lib/encomendas/textos.ts` e coberta por teste unitário.
- `lib/encomendas/consultas.ts` intacto — a contagem não custou nenhuma consulta.
- `npm run verificar` limpo e uma varredura completa de e2e verde no fechamento.
</success_criteria>

<output>
Ao terminar, crie
`.planning/quick/260820-uot-fechar-os-gaps-da-fase-3-interruptor-dos/260820-uot-SUMMARY.md`
registrando: os três commits, os comandos de e2e efetivamente executados (e quantas vezes), a
observação sobre a pílula de `ajuste-rapido-etapa.tsx` (mesma geometria, deliberadamente não tocada,
porque a trilha do detalhe já mostra "Desligada"), e a observação sobre as outras páginas que usam
`CabecalhoPagina` e agora podem ganhar o voltar com uma linha cada.

Depois disso, atualize `.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md`: os gaps
`G-03-2` e `G-03-3` do frontmatter passam a fechados, com o hash do commit que os fechou.
</output>
