---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 04
type: execute
wave: 3
depends_on: ["02b-02"]
files_modified:
  - components/amassa/estado-erro.tsx
  - app/(app)/error.tsx
  - app/(app)/not-found.tsx
  - app/not-found.tsx
  - app/(app)/loading.tsx
  - docs/convencoes-de-interface.md
  - tests/e2e/estados.spec.ts
autonomous: true
requirements: [UI-07, UI-08]
user_setup: []

estimate:
  tokens: 56000
  raw_tokens: 56000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Uma tela que quebra dentro do grupo protegido mostra 'Algo não funcionou.' e 'Não deu para carregar esta página. Verifique a internet e tente de novo.' com um botão 'Tentar de novo' — nunca 'Erro 500' nem mensagem de exceção (UI-07)"
    - "O botão 'Tentar de novo' de `app/(app)/error.tsx` chama a função `reset()` que o Next.js injeta no boundary"
    - "Uma URL inexistente com sessão válida mostra 'Esta página não existe.' e um link 'Voltar para o painel' que leva a `/` (UI-07)"
    - "Existe um `loading.tsx` no grupo protegido usando o `Skeleton` no formato do conteúdo que ele substitui — cabeçalho de página mais área de conteúdo — e não um 'carregando…' solto (UI-07, D-03)"
    - "A convenção de confirmação destrutiva de UI-08 está escrita em `docs/convencoes-de-interface.md` no formato 'Excluir {item}? {o que é perdido, nomeado}.', com o exemplo literal da fonte, para as Fases 3 a 6 implementarem com `alert-dialog` (UI-08, D-07)"
    - "E7 carregando — `EstadoErro` não carrega nada: é o destino de uma falha, não a origem de uma"
    - "E7 erro — é o próprio estado de erro, com `role=\"alert\"` e o botão ligado ao `reset()` do boundary"
    - "E7 transbordo — mesma largura máxima de leitura do `EstadoVazio`"
    - "E7 texto longo — a copy de erro é fixa no contrato, em duas linhas curtas"
    - "E8 transbordo — o esqueleto tem o formato do conteúdo que substitui e vive no mesmo contêiner; não pode transbordar mais que ele"
    - "E8 texto longo — o esqueleto não contém texto, por definição"
    - "E1/E3 erro (verificado aqui) — com a tela em estado de erro, a barra inferior e a barra lateral continuam renderizadas e clicáveis: a navegação vive no layout, fora do boundary"
  artifacts:
    - components/amassa/estado-erro.tsx
    - app/(app)/error.tsx
    - app/(app)/not-found.tsx
    - app/(app)/loading.tsx
    - docs/convencoes-de-interface.md
    - tests/e2e/estados.spec.ts
  key_links:
    - "`app/(app)/error.tsx` fica DENTRO de `app/(app)/layout.tsx`: é o que faz a casca sobreviver ao erro e dar saída ao usuário"
    - "`reset()` injetado pelo Next.js → botão 'Tentar de novo' — sem essa ligação o botão é decoração"
    - "`docs/convencoes-de-interface.md` é o único lugar onde UI-08 existe nesta fase; as Fases 3 a 6 leem de lá"
  prohibitions:
    - statement: "Nenhum esqueleto de carregamento é usado como espaço reservado permanente — esqueleto só aparece enquanto algo carrega de verdade; um esqueleto que nunca resolve lê como travamento (D-03)"
    - statement: "Nenhuma tela de erro renderiza mensagem de exceção, pilha de chamadas, caminho de arquivo do servidor ou identificador de digest — a copy é fixa e em linguagem humana"
---

<objective>
Os dois estados que faltam para UI-07 estar completo — erro em linguagem humana e carregamento
com esqueleto no formato do conteúdo — mais o 404 dentro da casca, e o registro escrito da
convenção de exclusão (UI-08) que as Fases 3 a 6 vão implementar.

Purpose: `CLAUDE.md` é explícito — estados vazios, de carregamento e de erro em TODA tela; tela em
branco enquanto carrega é defeito, não detalhe. O plano 03 entrega o vazio; este entrega os outros
dois. E UI-08, que D-07 adiou na implementação, precisa existir como contrato escrito nesta fase,
senão vira uma frase perdida num documento de planejamento.
Output: `components/amassa/estado-erro.tsx`, os três arquivos de convenção do Next.js sob
`app/(app)/`, o documento de convenções de interface e a spec e2e que prova os três estados.
</objective>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Andre/amassa/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: O componente de estado de erro e os três arquivos de convenção do Next.js</name>
  <files>components/amassa/estado-erro.tsx, app/(app)/error.tsx, app/(app)/not-found.tsx, app/not-found.tsx, app/(app)/loading.tsx</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seções "Contrato do
      componente de estado de erro", "Estado de carregamento — esqueletos (D-03)" e a linha do
      "Copywriting Contract" sobre o estado de erro: trazem a copy literal
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §7 (linhas 237–250) — carregamento com esqueleto no
      formato do conteúdo, nunca um "carregando…" solto; §9 (a partir da linha 294) — a voz: erro
      sempre diz o que fazer
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md` — a tabela "No Analog
      Found", que registra que estes são os primeiros `error.tsx` / `not-found.tsx` /
      `loading.tsx` do repositório, e a seção "`role=\"alert\" aria-live=\"assertive\"` for error
      messaging"
    - `app/(auth)/login/page.tsx` — o padrão existente de `role="alert"` no projeto
    - `components/amassa/estado-vazio.tsx` — a largura máxima de leitura e o alinhamento a espelhar
    - `components/ui/skeleton.tsx` e `components/ui/button.tsx` — as peças shadcn disponíveis
  </read_first>
  <action>
**`components/amassa/estado-erro.tsx`** — Server Component, em `components/amassa/` (D-11).
Assinatura: `{ titulo: string; corpo: string; acao?: React.ReactNode }`. Contêiner com
`role="alert"` (para o leitor de tela anunciar sem exigir foco), centralizado, mesma largura
máxima de leitura do `EstadoVazio`. Título em `text-titulo`, corpo em `text-corpo`. Se houver
selo ou marca visual, o fundo dele é `bg-erro-fundo` (o token `--color-erro-fundo`), nunca o
vermelho de alerta genérico do navegador. O `acao` é renderizado abaixo do corpo — é por onde o
botão ou o link entram, porque um deles precisa ser cliente e o outro não.

**`app/(app)/error.tsx`** — precisa ser `"use client"` (exigência do Next.js para boundary de
erro). Recebe `{ error, reset }`. Renderiza `<EstadoErro titulo="Algo não funcionou." corpo="Não
deu para carregar esta página. Verifique a internet e tente de novo." acao={...} />`, onde a ação
é um `Button` variante `default` com o rótulo "Tentar de novo" chamando `reset()`. Não renderize
na tela nenhuma propriedade do objeto de erro — nem a mensagem da exceção, nem a pilha de
chamadas, nem o identificador que o Next.js anexa a ele, nem caminho de arquivo do servidor. A
copy é fixa. Se quiser registrar o erro, use um `useEffect` com `console.error`, que sai no log e
não na tela. Por viver dentro de `app/(app)/layout.tsx`, a casca continua renderizada quando esta
tela aparece — é o que dá saída ao usuário.

**`app/(app)/not-found.tsx`** — usa o mesmo `EstadoErro` com copy própria: título "Esta página não
existe.", corpo "Verifique o endereço ou volte para o painel.", e a ação sendo um `<Link href="/">`
estilizado como `Button` com o rótulo "Voltar para o painel" (link de verdade, não `disabled`).

**Detalhe do Next.js que precisa ser conferido, não presumido:** um `not-found.tsx` dentro de um
grupo de rotas atende a chamadas de `notFound()` daquele segmento; uma URL que não casa com rota
nenhuma cai no `app/not-found.tsx` da raiz. Suba a aplicação e visite uma URL inventada com
sessão válida. Se a tela do grupo aparecer, ótimo — apague `app/not-found.tsx` se você o tiver
criado. Se aparecer a tela padrão do Next.js, crie `app/not-found.tsx` renderizando o mesmo
componente com a mesma copy (fora da casca, que é o que o Next.js permite nesse nível). Registre
no SUMMARY qual dos dois caminhos foi o real.

**`app/(app)/loading.tsx`** — esqueleto no FORMATO do conteúdo (D-03), montado com o `Skeleton` do
shadcn: um retângulo da altura do título de página, e abaixo dele blocos do tamanho da área de
conteúdo. Nada de texto "carregando". Este arquivo é o padrão que as Fases 3 a 6 vão copiar
quando houver consulta de verdade; nesta fase ele raramente aparece, porque `exigirUsuario()`
resolve no servidor antes de renderizar. Deixe um comentário curto dizendo exatamente isso, para
ninguém no futuro achar que o esqueleto é espaço reservado permanente.
  </action>
  <verify>
    <automated>npm run lint && npx tsc --noEmit && npm run verificar-acoes && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `components/amassa/estado-erro.tsx` exporta `EstadoErro` e contém `role="alert"`
    - `app/(app)/error.tsx` começa com `"use client"` e contém `reset()` e o rótulo
      `Tentar de novo`
    - `grep -c 'error.message\|error.stack\|error.digest' 'app/(app)/error.tsx'` retorna 0
    - `app/(app)/error.tsx` contém a string exata
      `Não deu para carregar esta página. Verifique a internet e tente de novo.`
    - `app/(app)/not-found.tsx` contém `Esta página não existe.` e `Voltar para o painel` e
      `href="/"`
    - `app/(app)/loading.tsx` importa `Skeleton` de `@/components/ui/skeleton`
    - `app/(app)/loading.tsx` não renderiza nenhuma cadeia de texto entre tags JSX — só
      componentes `Skeleton` e elementos de leiaute (conferência de fonte: o esqueleto tem o
      formato do conteúdo, nunca uma palavra solta)
    - `npm run lint` sai com 0; `npx tsc --noEmit` sai com 0; `npm run verificar-acoes` sai com 0;
      `npm run build` sai com 0
  </acceptance_criteria>
  <done>Toda tela do grupo protegido tem, além do vazio do plano 03, um estado de erro em
  linguagem humana com saída, um 404 que sabe voltar, e um esqueleto no formato do conteúdo.</done>
</task>

<task type="auto">
  <name>Tarefa 2: O documento de convenções de interface — onde UI-08 passa a existir</name>
  <files>docs/convencoes-de-interface.md</files>
  <read_first>
    - `amassa-plataforma/04-DESIGN-SYSTEM.md` §7 (linhas 237–250) — a confirmação destrutiva com o
      exemplo literal, a duração dos avisos e o padrão de estado vazio; §9 (a partir da linha 294)
      — a voz da interface
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — seção "Convenção
      adiada — Confirmação Destrutiva (UI-08, D-07)", com o formato e o exemplo
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md` — D-06, D-07, D-11 e
      a lista de decisões já fechadas nos documentos fonte
    - `docs/operacao/01-preparar-servidor.md` — o tom e a forma dos documentos deste projeto
      (português, direto, com o porquê junto do quê)
  </read_first>
  <action>
Crie `docs/convencoes-de-interface.md`, em português, curto e operacional — é documento para quem
vai implementar as Fases 3 a 6, não peça de marketing. Cobre:

**1. Confirmação destrutiva (UI-08).** O formato obrigatório, literal:
`Excluir {item}? {o que é perdido, nomeado}.` Com o exemplo da fonte:
*"Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão apagados."* Diga explicitamente que
nenhuma remoção é silenciosa, que o texto SEMPRE nomeia o que se perde (nunca "Tem certeza?"), e
que a implementação usa o `alert-dialog` do shadcn — que **não** foi instalado nesta fase (D-07)
porque não há nada para excluir ainda, e chega na Fase 3 junto da primeira exclusão real.

**2. Estados obrigatórios em toda tela (UI-07).** Aponte para os três componentes desta fase:
`components/amassa/estado-vazio.tsx` (vazio, com frase de contexto e botão),
`components/amassa/estado-erro.tsx` (erro em linguagem humana, com saída) e o padrão de
`loading.tsx` com `Skeleton` no formato do conteúdo. Registre a regra de D-03: esqueleto nunca é
espaço reservado permanente.

**3. A fronteira `components/ui/` × `components/amassa/` (D-11).** Por origem, não por assunto: o
que o `shadcn add` pode sobrescrever de um lado, o que é nosso do outro. `lib/utils.ts` também é
território do shadcn.

**4. O que cada fase instala.** Cada fase instala os componentes shadcn que ela própria usa; a 2b
instalou `button`, `card`, `sidebar`, `sheet`, `skeleton`, `dropdown-menu`, `separator`. Ficam
para depois: `alert-dialog` e `sonner` (Fase 3), `--color-chart-1` a `--color-chart-5` (Fase 4,
com Recharts).

**5. Avisos temporários.** 5 segundos, com a exceção nomeada de 7 segundos do "Desfazer" da
queima, na Fase 4.

**6. As regras duras herdadas** que valem para toda tela nova: um botão terracota por tela no
máximo; campo de formulário nunca abaixo de 16px; alvo de toque de no mínimo 44px; nenhuma tela
exige rolagem horizontal no celular; erro sempre diz o que fazer.

Não repita a tabela de tokens — ela já vive em `app/globals.css` e em
`amassa-plataforma/04-DESIGN-SYSTEM.md` §2. Aponte para lá.
  </action>
  <verify>
    <automated>grep -q 'Coleção Verão' docs/convencoes-de-interface.md; grep -q 'alert-dialog' docs/convencoes-de-interface.md; grep -q 'estado-vazio.tsx' docs/convencoes-de-interface.md</automated>
  </verify>
  <acceptance_criteria>
    - `docs/convencoes-de-interface.md` existe
    - Contém o formato `Excluir {item}?` e o exemplo literal `Coleção Verão`
    - Contém `alert-dialog` e `sonner` marcados como adiados para a Fase 3
    - Contém os sete nomes de componente instalados nesta fase
    - Contém `44px`, `16px` e a regra de um botão terracota por tela
    - Contém referência a `components/amassa/estado-vazio.tsx` e
      `components/amassa/estado-erro.tsx`
    - O documento está inteiramente em português
  </acceptance_criteria>
  <done>UI-08 deixa de ser uma frase num documento de planejamento e passa a ser contrato escrito
  no repositório, no lugar onde quem for implementar a Fase 3 vai procurar.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Prova dos três estados no navegador</name>
  <files>tests/e2e/estados.spec.ts</files>
  <read_first>
    - `tests/e2e/casca.spec.ts` — a spec do plano 03, para reaproveitar a forma de login e de
      asserção (se ainda não existir na sua árvore, use `tests/e2e/design-system.spec.ts`)
    - `tests/e2e/autenticacao.spec.ts` — o padrão de `getByRole("alert")` escopado, e o motivo do
      escopo (o Next.js injeta um anunciador de rota com o mesmo papel)
    - `app/(app)/not-found.tsx` e `app/(app)/error.tsx` — como ficaram na Tarefa 1
    - `tests/e2e/apoio/preparar-usuario.ts` — a conta de teste em `E2E_EMAIL_TESTE` /
      `E2E_SENHA_TESTE`
    - `playwright.config.ts` — os dois projetos
  </read_first>
  <action>
Spec nova `tests/e2e/estados.spec.ts`, rodando nos dois projetos. Três casos, todos com sessão:

**1. 404 dentro da casca.** Visite uma URL inventada e estável (por exemplo
`/rota-que-nao-existe-2b`) e afirme que aparece o texto "Esta página não existe." e o link
"Voltar para o painel", e que clicar nele leva a `/`. Este caso também é o que prova qual dos
dois `not-found.tsx` está de fato atendendo — se falhar, a Tarefa 1 precisa do arquivo de raiz.

**2. A casca sobrevive ao erro.** Afirme que, na tela de 404 (que é o estado de falha alcançável
sem instrumentar nada), a navegação continua presente e clicável: no celular a barra inferior
ainda tem os 5 links; no desktop a barra lateral ainda está lá. É a prova da linha do contrato
de UI que diz que a navegação vive no layout, fora do boundary. Não instrumente uma exceção
artificial nem crie rota de teste que quebra de propósito só para exercitar `error.tsx` — isso
mereceria código de produção existindo só para o teste. O `error.tsx` fica coberto por revisão de
código e pelo critério de aceite de fonte da Tarefa 1.

**3. Nenhum vazamento de detalhe técnico.** No 404, afirme que o corpo da página NÃO contém as
cadeias "Error", "stack", "digest" nem `at ` seguido de caminho de arquivo. A copy é fixa e
humana; a asserção existe para pegar o dia em que alguém "melhorar" a tela mostrando o erro real.
  </action>
  <verify>
    <automated>npm run test:e2e -- --grep "estados"</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e -- --grep "estados"` sai com 0 nos projetos `desktop` e `celular`
    - `tests/e2e/estados.spec.ts` contém `Esta página não existe.` e `Voltar para o painel`
    - `tests/e2e/estados.spec.ts` afirma a presença da navegação na tela de 404
    - `npm run test:e2e` (suíte inteira) sai com 0
  </acceptance_criteria>
  <done>O estado de erro tem prova de que não vaza detalhe técnico, o 404 tem prova de que sabe
  voltar, e a casca tem prova de que sobrevive a uma tela quebrada.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| exceção do servidor → tela de erro no navegador | mensagem de exceção pode atravessar para o cliente |
| URL arbitrária → `not-found` | qualquer pessoa com sessão pode digitar qualquer caminho |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02b-09 | Information Disclosure | `app/(app)/error.tsx` | medium | mitigate | Copy fixa; `error.message`, `error.stack` e `error.digest` não são renderizados (critério de aceite com `grep`), e `tests/e2e/estados.spec.ts` afirma a ausência de detalhe técnico no corpo da página |
| T-02b-12 | Information Disclosure | `app/(app)/not-found.tsx` | low | mitigate | A tela de 404 mostra a mesma copy para qualquer caminho inexistente — não confirma nem nega a existência de rota interna alguma |
| T-02b-01 | Elevation of Privilege | `app/not-found.tsx` (se criado na raiz) | high | mitigate | O arquivo de raiz fica fora do grupo protegido e por isso não pode exibir dado de sessão: renderiza apenas copy estática. O `middleware.ts` continua redirecionando quem não tem sessão para `/login` antes de chegar nele, e não é alterado |
</threat_model>

<verification>
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes`, `npm test`, `npm run build` e
  `npm run test:e2e` saem todos com 0.
- `git diff --exit-code middleware.ts lib/auth/rotas-publicas.ts app/globals.css` retorna 0.
- `docs/convencoes-de-interface.md` existe e cobre UI-08.
</verification>

<success_criteria>
Nenhuma tela do sistema pode terminar em branco ou em "Erro 500": há um vazio nomeado (plano 03),
um esqueleto no formato do conteúdo e um erro que diz o que fazer e deixa a navegação de pé. E a
regra de nunca excluir em silêncio está escrita onde a Fase 3 vai procurá-la.
</success_criteria>

<output>
Create `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-04-SUMMARY.md` when done
</output>

## Artefatos que este plano produz

**Arquivos novos:** `components/amassa/estado-erro.tsx`, `app/(app)/error.tsx`,
`app/(app)/not-found.tsx`, `app/(app)/loading.tsx`, `docs/convencoes-de-interface.md`,
`tests/e2e/estados.spec.ts`, e condicionalmente `app/not-found.tsx` (só se o 404 do grupo não
atender URL inexistente — conferido em execução, não presumido).

**Arquivos modificados:** nenhum arquivo pré-existente.

**Símbolos exportados:** `EstadoErro`
(`{ titulo: string; corpo: string; acao?: React.ReactNode }`); os três componentes default dos
arquivos de convenção do Next.js (`error.tsx`, `not-found.tsx`, `loading.tsx`).

**Rotas novas:** nenhuma rota de URL; nascem três boundaries do App Router no grupo `(app)` —
erro, 404 e carregamento.

**Scripts npm novos:** nenhum.
