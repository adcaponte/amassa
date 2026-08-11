---
phase: quick
plan: 260811-uiy
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/erro/textos.ts
  - tests/unit/textos-erro.test.ts
  - app/error.tsx
  - app/global-error.tsx
  - app/(app)/error.tsx
  - .planning/WINDOWS.md
  - .planning/phases/04-contador-de-queima/04-UAT.md
autonomous: true
requirements: [G-04-5, WINDOWS-23]

estimate:
  tokens: 48000
  raw_tokens: 24000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Com o Postgres parado, uma rota autenticada mostra a tela de erro do AMASSA (\"Algo não funcionou.\"), não a tela padrão do Next.js"
    - "A tela de erro diz o que fazer e oferece um botão de nova tentativa com alvo de toque de no mínimo 44px"
    - "Nenhuma propriedade do objeto de erro (mensagem, pilha, digest) aparece na tela — só no console"
    - "As telas de erro da raiz ficam fora do grupo protegido e nunca renderizam dado de sessão"
    - "O título e o corpo da tela de erro vêm de um único módulo, e um teste falha se a voz divergir"
  artifacts:
    - lib/erro/textos.ts
    - app/error.tsx
    - app/global-error.tsx
    - tests/unit/textos-erro.test.ts
  key_links:
    - "app/error.tsx é a fronteira mais próxima ACIMA de app/(app)/layout.tsx — é ela que captura a falha de exigirUsuario()"
    - "app/global-error.tsx renderiza o próprio <html>/<body> e importa app/globals.css, porque substitui o layout raiz"
    - "app/(app)/error.tsx, app/error.tsx e app/global-error.tsx consomem as MESMAS constantes de lib/erro/textos.ts"
---

<objective>
Criar a fronteira de erro que falta ACIMA de `app/(app)/layout.tsx`, para que uma falha de
`exigirUsuario()` (banco inacessível é o caso realista) caia numa tela em linguagem humana em
vez da tela padrão do Next.js ("Application error: a server-side exception has occurred").

Purpose: o defeito atinge TODA rota autenticada — Encomendas, Agenda, Fornos, Estoque,
Orçamentos — e viola duas restrições explícitas do `CLAUDE.md` ("estados de erro em toda tela"
e "erro em linguagem humana, dizendo o que fazer"). É pré-existente da Fase 2b; a Fase 4 só
encontrou, no teste 5 do UAT (gap G-04-5, WINDOWS.md id 23).

Output: `lib/erro/textos.ts` (voz única), `app/error.tsx` (a correção de verdade),
`app/global-error.tsx` (último recurso), um teste unitário anti-deriva, e o rastro de papel
fechado em `WINDOWS.md` e `04-UAT.md`.
</objective>

<decisao_de_fronteira>
## `app/error.tsx` E `app/global-error.tsx` — os dois, com papéis distintos

A restrição do pedido é escolher e registrar o porquê. A escolha é **os dois**, e não é
simetria decorativa: cada arquivo cobre um caso que o outro não cobre.

**`app/error.tsx` é a correção de G-04-5.** No App Router, um `error.tsx` envolve os
*children* do layout do próprio segmento — nunca o layout em si. `app/(app)/` é um grupo de
rotas, não tem segmento de URL: `app/(app)/layout.tsx` renderiza como filho direto de
`app/layout.tsx`. Logo a fronteira mais próxima acima dele é `app/error.tsx`, que envolve os
children do layout raiz. É exatamente ela que captura o `throw` de `exigirUsuario()`.
Três consequências práticas que decidem a escolha:

1. Renderiza **dentro** do layout raiz — `<html lang="pt-BR">`, `app/globals.css` e as
   variáveis de fonte Archivo Narrow / Inter continuam valendo. A tela parece o resto do AMASSA.
2. Funciona em `next dev` **e** em produção — dá para provar localmente.
3. Recebe `reset()`, então o botão "Tentar de novo" tem o que chamar.

**`app/global-error.tsx` sozinho seria a escolha errada** para este defeito, por três motivos
que se somam: só dispara para erro do **layout raiz** (não pega o layout de `(app)`); o Next.js
**não o usa em desenvolvimento** (a sobreposição de erro do dev toma o lugar), então a falha
diária de banco não teria como ser verificada localmente; e ele **substitui** o layout raiz,
tendo de renderizar o próprio `<html>`/`<body>` — o que faz perder as variáveis de fonte e
entregar uma tela degradada como resposta padrão ao caso mais comum. Errado nos três eixos.

**Mas ele entra assim mesmo, como último recurso**, por uma razão específica: uma fronteira de
erro não captura erro lançado por ela mesma. Se `app/error.tsx` falhar ao renderizar, sem
`global-error.tsx` o usuário volta a ver a tela padrão do Next.js — exatamente o desfecho que
G-04-5 descreve. Ele também cobre uma falha no próprio layout raiz. É deliberadamente mínimo,
autossuficiente, e sua degradação de fonte é aceita e documentada no próprio arquivo.

**Limite honesto de verificação:** `global-error.tsx` não é observável em `next dev` — sua
prova nesta tarefa é estrutural (existe, renderiza `<html>`/`<body>` próprios, importa
`globals.css`), não comportamental. Isso vai registrado no SUMMARY, não escondido.
</decisao_de_fronteira>

<execution_context>
@C:/Users/Andre/amassa/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.claude/CLAUDE.md
@app/(app)/error.tsx
@app/layout.tsx
@app/not-found.tsx
@components/amassa/estado-erro.tsx
@lib/encomendas/textos.ts
</context>

<fatos_ja_estabelecidos>
Não reinvestigar. Tudo abaixo é medido, não suposto:

- A causa raiz está fechada (04-UAT.md G-04-5). Não reabrir.
- As fronteiras de **página** funcionam. Provado no teste 13 do UAT com método cirúrgico:
  renomear só a tabela `fornos`, deixando `usuarios` legível, para `exigirUsuario()` continuar
  passando. Derrubar o banco inteiro é o método ERRADO para elas — bate no layout primeiro.
- `app/globals.css:76` define `--font-sans: var(--fonte-inter), ui-sans-serif, system-ui,
  sans-serif`. Sem as classes `.variable` no `<html>`, a fonte cai em `ui-sans-serif` — é a
  degradação esperada de `global-error.tsx`, e ela é aceitável.
- `Button` do shadcn tem `size="default"` = `h-8` (32px). O padrão do projeto para chegar a
  44px é `className="min-h-[44px]"` (`estado-vazio.tsx:56`, `acoes-encomenda.tsx:36` e outros
  onze lugares). `min-height` vence `height` sem disputa de especificidade — não precisa de
  `style` inline aqui (a exceção do `Switch`, decisão 03-05, não se aplica).
- `EstadoErro` (`components/amassa/estado-erro.tsx`) é um componente puro sem import de
  servidor — `app/(app)/error.tsx` já o importa de dentro de um arquivo `"use client"`. Pode
  ser usado nas duas fronteiras novas.
- `EstadoErro` usa `flex flex-1` e depende de um pai flex para ocupar a altura. Em
  `app/(app)/error.tsx` esse pai é o `<main className="flex-1">` do layout. As fronteiras novas
  não têm esse pai e precisam envolver o `EstadoErro` num `<div className="flex min-h-screen
  flex-col">`.
- `scripts/testar-e2e.mjs:138` repassa `process.argv.slice(2)` para o Playwright — logo
  `npm run test:e2e -- --grep "UI-07"` funciona.
- Nenhum pacote npm novo. O portão de legitimidade de pacote não se aplica a este plano.
- Nenhuma mudança em `db/schema.ts` — `TABELAS_ESPERADAS` de `scripts/testar-migracoes.mjs`
  não precisa ser tocada.
- `.planning/WINDOWS.md` está **inconsistente**: a linha 40 da tabela markdown tem o id 23, mas
  o bloco JSON abaixo termina no id 22 e o frontmatter diz `total_count: 22`. Por isso
  `gsd-tools windows fixed 23` vai falhar — a Tarefa 3 reconcilia à mão.
</fatos_ja_estabelecidos>

<tasks>

<task type="tracer" tdd="true">
  <name>Tarefa 1: voz única de erro em lib/erro/textos.ts, com teste anti-deriva</name>
  <files>lib/erro/textos.ts, tests/unit/textos-erro.test.ts, app/(app)/error.tsx</files>
  <behavior>
    - `FRASE_ERRO_TITULO` de `lib/erro/textos.ts` é exatamente igual ao `FRASE_ERRO_TITULO`
      exportado por `lib/encomendas/textos.ts` (comparação estrita entre os dois módulos).
    - `FRASE_ERRO_CORPO_GENERICO` termina dizendo o que fazer, não só que falhou — o teste
      afirma que a frase contém "tente de novo".
    - `ROTULO_TENTAR_DE_NOVO` não é string vazia.
    - As três constantes são strings não vazias.
  </behavior>
  <action>
    Criar `lib/erro/textos.ts` como módulo puro (zero import — segue a disciplina de
    `lib/encomendas/textos.ts` e `lib/queimas/textos.ts`), com três exports:

    - `FRASE_ERRO_TITULO` — a frase que já existe hoje em `lib/encomendas/textos.ts:35` e,
      repetida como literal, em `app/(app)/error.tsx:30`. Copiar caractere por caractere.
    - `FRASE_ERRO_CORPO_GENERICO` — o corpo genérico que já existe como literal em
      `app/(app)/error.tsx:31` (o que fala em "esta página", não o de Encomendas, que fala em
      "as encomendas"). Copiar caractere por caractere.
    - `ROTULO_TENTAR_DE_NOVO` — o rótulo do botão que já existe em `app/(app)/error.tsx:34`.

    Nenhuma frase nova é inventada neste plano: as três já estão escritas no código, só não
    tinham dono. `lib/erro/` é a pasta certa porque a voz de erro é transversal aos cinco
    módulos, seguindo a mesma convenção de `lib/acessibilidade/rotulos.ts` e
    `lib/navegacao/itens.ts`.

    Comentário de cabeçalho do arquivo registrando o motivo do nome colidir com
    `lib/encomendas/textos.ts`: aquele módulo tem regra própria e documentada de só aceitar
    `import type`, nunca import de valor, então ele NÃO pode importar daqui e mantém o literal
    dele. Quem impede as duas cópias de divergirem é o teste unitário, não o compilador.

    Criar `tests/unit/textos-erro.test.ts` seguindo o formato de
    `tests/unit/textos-encomenda.test.ts`, importando os dois módulos e afirmando o `<behavior>`
    acima. O caso que importa é a igualdade estrita dos dois títulos.

    Editar `app/(app)/error.tsx`: trocar os três literais pelas constantes importadas de
    `@/lib/erro/textos`, e acrescentar `className="min-h-[44px]"` ao `Button` — hoje ele é
    `h-8` (32px), abaixo do alvo de toque mínimo do `CLAUDE.md`. Nada mais muda nesse arquivo:
    o `useEffect` com `console.error`, a ausência de qualquer propriedade do erro na tela e a
    escolha de `EstadoErro` continuam como estão.
  </action>
  <verify>
    <automated>npm test -- tests/unit/textos-erro.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>grep -c "min-h-\[44px\]" "app/(app)/error.tsx"</automated>
  </verify>
  <done>
    O teste unitário novo passa, `tsc --noEmit` fica limpo, `app/(app)/error.tsx` importa de
    `@/lib/erro/textos` e seu botão tem alvo de toque de 44px. A tela renderizada por
    `app/(app)/error.tsx` continua idêntica em texto ao que era antes — este é um refactor de
    origem das strings, não de conteúdo.
  </done>
</task>

<task type="auto">
  <name>Tarefa 2: as duas fronteiras acima do layout de (app)</name>
  <files>app/error.tsx, app/global-error.tsx</files>
  <action>
    Criar `app/error.tsx` — a correção de G-04-5, conforme a seção `decisao_de_fronteira`
    deste plano:

    - `"use client"` na primeira linha (exigência do App Router para qualquer `error.tsx`).
    - Props `{ error: Error & { digest?: string }, reset: () => void }`.
    - `useEffect` chamando `console.error(error)`, igual ao irmão `app/(app)/error.tsx`.
    - Renderiza `EstadoErro` com `FRASE_ERRO_TITULO` e `FRASE_ERRO_CORPO_GENERICO` de
      `@/lib/erro/textos`, e um `Button type="button"` com `ROTULO_TENTAR_DE_NOVO`,
      `onClick={() => reset()}` e `className="min-h-[44px]"`.
    - Envolver o `EstadoErro` num `<div className="flex min-h-screen flex-col">`: aqui não
      existe o `<main className="flex-1">` da casca para dar altura ao `flex-1` do componente.
    - Comentário de cabeçalho explicando POR QUE este arquivo existe: `error.tsx` não captura
      erro do layout do próprio segmento, `app/(app)/` é grupo de rotas sem segmento de URL,
      logo `app/(app)/layout.tsx` é filho direto do layout raiz e esta é a fronteira mais
      próxima acima dele. Citar o gap G-04-5 e o id 23 do WINDOWS.md como origem.
    - Comentário registrando que este arquivo vive FORA do grupo protegido: nunca pode
      renderizar dado de sessão, mesma restrição já documentada em `app/not-found.tsx`
      (T-02b-01). Ele mostra copy estática e nada mais.
    - Nenhuma propriedade do objeto `error` vai para a tela — nem mensagem, nem pilha, nem o
      `digest` que o Next.js anexa. Só para o console.

    Criar `app/global-error.tsx` — o último recurso:

    - `"use client"` na primeira linha.
    - `import "./globals.css"` como primeira importação: este arquivo SUBSTITUI o layout raiz,
      então a folha de estilos que o layout raiz importa não estaria carregada sem isto.
    - Renderiza a árvore inteira: `<html lang="pt-BR">` e
      `<body className="font-sans antialiased">`, com o mesmo `<div className="flex
      min-h-screen flex-col">` por dentro.
    - Mesmas três constantes de `@/lib/erro/textos`, mesmo botão com `min-h-[44px]` chamando
      `reset()`. A voz é idêntica à de `app/error.tsx` de propósito: o gestor vê uma tela só,
      independentemente de qual fronteira capturou.
    - `useEffect` com `console.error(error)`, e nenhuma propriedade do erro na tela.
    - Comentário de cabeçalho com os três fatos que o executor não deve redescobrir depois:
      (1) só dispara para erro do layout raiz ou quando `app/error.tsx` falha ao renderizar —
      uma fronteira não captura o próprio erro; (2) o Next.js não usa este arquivo em
      desenvolvimento, então ele não é observável com `next dev` e sua prova aqui é estrutural;
      (3) como as classes `.variable` do `next/font` moram no `<html>` do layout raiz que este
      arquivo substituiu, `--fonte-inter` fica indefinida e `--font-sans` cai no fallback
      `ui-sans-serif` de `app/globals.css:76` — degradação conhecida e aceita para uma tela de
      último recurso.

    Não tocar em `app/(app)/layout.tsx`. Mover `exigirUsuario()` para fora do layout mudaria a
    garantia de autorização da casca inteira e não é o que este plano faz — o layout continua
    podendo falhar; o que muda é que agora existe quem pegue.
  </action>
  <verify>
    <automated>npm run lint</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>grep -v '^\s*//' app/global-error.tsx | grep -cE 'html lang="pt-BR"'</automated>
    <automated>grep -c '^import "\./globals\.css"' app/global-error.tsx</automated>
    <automated>grep -l 'lib/erro/textos' app/error.tsx app/global-error.tsx</automated>
  </verify>
  <done>
    `app/error.tsx` e `app/global-error.tsx` existem, passam lint e `tsc --noEmit`, importam as
    três constantes de `@/lib/erro/textos`, e `app/global-error.tsx` renderiza o próprio
    `<html>` e importa `./globals.css` na primeira linha de importação. Nenhum dos dois
    renderiza qualquer propriedade do objeto de erro.
  </done>
</task>

<task type="auto">
  <name>Tarefa 3: provar com o banco no chão, e fechar o rastro de papel</name>
  <files>.planning/WINDOWS.md, .planning/phases/04-contador-de-queima/04-UAT.md</files>
  <precondition>Docker Desktop está rodando e o Postgres local sobe com `docker compose -f docker/compose.yml -f docker/compose.dev.yml up -d postgres`. Se não subir, a prova comportamental não roda — pare e registre.</precondition>
  <action>
    **Passo 1 — prova comportamental (o que este plano existe para consertar).**

    O caminho é o do pedido, mas conduzido pelo executor: derrubar o Postgres local e carregar
    uma rota autenticada. A parte que não dá para fazer com `curl` é o login — o cookie de
    sessão do Auth.js é `Secure`, e o `curl` se recusa a mandá-lo por `http://`, enquanto o
    Chromium trata `localhost` como contexto seguro (decisão 02a-04). Então:

    - Subir o Postgres local e `npm run dev` em segundo plano na porta 3000.
    - Escrever um script descartável **no diretório de rascunho da sessão, NUNCA no
      repositório**, usando o `@playwright/test` já instalado (`import { chromium }`), que:
      1. abre `/login` e entra com `E2E_EMAIL_TESTE` / `E2E_SENHA_TESTE`, esperando chegar em `/`;
      2. executa `docker compose -f docker/compose.yml -f docker/compose.dev.yml stop postgres`;
      3. navega para `/queimas` e afirma que o cabeçalho de nível 2 com o texto de
         `FRASE_ERRO_TITULO` está visível;
      4. afirma que o corpo da página **não** contém o texto que o Next.js escreve na tela
         padrão dele (a frase em inglês registrada em G-04-5 sobre exceção do lado do servidor);
      5. executa `docker compose -f docker/compose.yml -f docker/compose.dev.yml start postgres`
         num bloco que roda mesmo se a afirmação falhar, para o banco nunca ficar parado.
    - Em `next dev` a sobreposição de erro do Next.js aparece POR CIMA da fronteira, num portal
      separado. Isso não invalida a prova: a fronteira renderiza embaixo, e `toBeVisible()` do
      Playwright julga por CSS, não por oclusão. Consultar pelo papel (`getByRole("heading",
      { level: 2 })`), não por posição na tela.
    - Encerrar o `npm run dev` ao final. Registrar no SUMMARY a saída literal do script.
    - Se a prova falhar por motivo de ambiente (Docker fora do ar, porta ocupada, Chromium não
      instalado), NÃO declarar sucesso: registrar o motivo e escalar o roteiro manual do
      `<human-check>` abaixo.

    **Passo 2 — regressão, com o único e2e do plano.**

    `npm run test:e2e -- --grep "UI-07"` — uma invocação só, e é o orçamento inteiro. Ela cobre
    `tests/e2e/estados.spec.ts` ("404 e estado de erro (UI-07)"), que é justamente o que dois
    arquivos novos na raiz de `app/` poderiam perturbar: `app/not-found.tsx` é vizinho deles.
    Nunca rodar `npm run build` em passo separado — o próprio e2e constrói.

    **Passo 3 — `npm run verificar`** com o Postgres de volta no ar (ele inclui
    `test:migracoes`, que precisa de banco).

    **Passo 4 — rastro de papel.** `gsd-tools windows fixed 23` vai falhar: o id 23 só existe
    na tabela markdown; o bloco JSON termina no 22 e o frontmatter conta 22. Reconciliar à mão,
    nas três partes do arquivo `.planning/WINDOWS.md`:

    - na linha 40 da tabela, mudar o status de `open` para `fixed` e preencher `resolved_at`
      com o instante da correção;
    - acrescentar ao fim do array JSON a entrada de id 23 espelhando a linha da tabela, com
      `"status": "fixed"` e o mesmo `resolved_at`, no formato exato das entradas 1 a 22;
    - no frontmatter: `total_count` de 22 para 23, `fixed_count` de 6 para 7, `open_count`
      permanece 16 (o id 23 nunca chegou a ser contado como aberto), e `last_updated` atualizado.
      Conferir ao final que `open_count + fixed_count + waived_count` bate com `total_count`.

    Em `.planning/phases/04-contador-de-queima/04-UAT.md`, no bloco `gap_id: G-04-5`
    (linha 143): mudar `status: failed` para `status: resolved`, e acrescentar um campo
    `resolvido_em` apontando para este plano
    (`.planning/quick/260811-uiy-fronteira-de-erro-global-acima-do-layout/`) com uma linha
    dizendo qual fronteira resolveu e que `global-error.tsx` tem prova estrutural, não
    comportamental. Preservar intactos `root_cause`, `nota_de_metodo`, `decisao_do_dono` e
    `escopo` — são o registro histórico de como o defeito foi diagnosticado e não devem ser
    reescritos. O segundo item de `missing` ("reconferir se os demais estados de erro da fase
    sofrem do mesmo caminho") já foi respondido pelo teste 13 e está em `nota_de_metodo`:
    marcar como respondido, não deixar em aberto por omissão.

    Não mexer no `STATE.md` nem no `04-VERIFICACAO-HUMANA.md`: a Fase 4 continua aberta pelos
    26 itens de verificação humana, e este plano não fecha nenhum deles.
  </action>
  <verify>
    <automated>npm run test:e2e -- --grep "UI-07"</automated>
    <automated>npm run verificar</automated>
    <automated>node .claude/gsd-core/bin/gsd-tools.cjs windows status</automated>
    <automated>grep -c "G-04-5" .planning/phases/04-contador-de-queima/04-UAT.md</automated>
    <human-check>
      Se o script descartável do Passo 1 não puder rodar, o roteiro manual é este, e ele é o
      mesmo que o dono usou no UAT:
      1. `docker compose -f docker/compose.yml -f docker/compose.dev.yml up -d postgres` e
         `npm run dev`.
      2. Entrar no sistema normalmente pelo navegador.
      3. `docker compose -f docker/compose.yml -f docker/compose.dev.yml stop postgres`.
      4. Recarregar qualquer rota autenticada (`/`, `/encomendas`, `/queimas`).
      5. Confirmar: aparece a tela do AMASSA com "Algo não funcionou." e o botão "Tentar de
         novo", e NÃO a tela em inglês do Next.js com o número de digest.
      6. `docker compose -f docker/compose.yml -f docker/compose.dev.yml start postgres` e
         recarregar — o sistema volta ao normal.
      Os dados vivem no volume nomeado `docker_dados_postgres` e sobrevivem ao `stop`.
    </human-check>
  </verify>
  <done>
    Com o Postgres parado, uma rota autenticada mostra a tela de erro do AMASSA — provado por
    execução real, com a saída registrada no SUMMARY. O e2e `--grep "UI-07"` passa (uma
    invocação só, registrada). `npm run verificar` passa inteiro. `windows status` retorna
    `total_count: 23`, `fixed_count: 7`, `open_count: 16`, com o id 23 em `fixed`. O gap
    G-04-5 de `04-UAT.md` está `resolved` e aponta para este plano, com o histórico de
    diagnóstico preservado.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| servidor → tela de erro | O objeto `Error` do servidor (mensagem, pilha, `digest`) cruza para um componente de cliente |
| fora do grupo protegido | `app/error.tsx` e `app/global-error.tsx` renderizam sem a casca autenticada, para qualquer visitante que provoque um erro |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-uiy-01 | Information Disclosure | app/error.tsx, app/global-error.tsx | medium | mitigate | Nenhuma propriedade do objeto `error` é renderizada — nem `message`, nem a pilha, nem o `digest`. O erro só vai para `console.error` dentro de `useEffect`, mesma disciplina já aplicada em `app/(app)/error.tsx`. Verificado por leitura do arquivo na Tarefa 2. |
| T-uiy-02 | Information Disclosure | app/error.tsx, app/global-error.tsx | medium | mitigate | Os dois arquivos vivem FORA de `app/(app)/`, então nunca recebem `usuario` de `exigirUsuario()` e não podem vazar dado de sessão nem revelar quais rotas internas existem. Copy estática apenas — mesma restrição T-02b-01 já documentada em `app/not-found.tsx`. |
| T-uiy-03 | Denial of Service | banco de dados | low | accept | Uma fronteira de erro não deixa o banco menos indisponível: ela troca uma tela ilegível por uma legível com botão de nova tentativa. Recuperação continua sendo do operador. Aceito conscientemente — está dentro da perda de 24h já aceita no `CLAUDE.md`. |
| T-uiy-SC | Tampering | npm/pip/cargo installs | high | accept | Nenhum pacote novo é instalado neste plano — nem dependência, nem dev-dependency. `package.json` e `package-lock.json` não aparecem em `files_modified`. O portão de legitimidade de pacote não tem o que auditar. |
</threat_model>

<verification>
- `npm run verificar` passa inteiro (lint, `tsc --noEmit`, `verificar-acoes`, unitários,
  `test:migracoes`).
- `npm run test:e2e -- --grep "UI-07"` passa — invocação única do plano.
- Prova comportamental com o Postgres parado registrada no SUMMARY com a saída literal.
- `git status` limpo de arquivos descartáveis: o script de prova do Passo 1 mora no diretório
  de rascunho da sessão e nunca no repositório.
</verification>

<success_criteria>
- Com o banco no chão, qualquer rota autenticada mostra "Algo não funcionou." com botão de
  nova tentativa de 44px — nunca mais a tela em inglês do Next.js com número de digest.
- Uma única fonte de verdade para o título, o corpo genérico e o rótulo do botão
  (`lib/erro/textos.ts`), consumida pelas três fronteiras, com teste que falha se a voz
  divergir da de `lib/encomendas/textos.ts`.
- A escolha entre `app/error.tsx` e `app/global-error.tsx` está registrada com o porquê, e o
  limite de verificação de `global-error.tsx` está dito em voz alta, não escondido.
- WINDOWS.md id 23 em `fixed`, com o ledger internamente consistente; G-04-5 em `resolved` com
  o histórico de diagnóstico preservado.
- Fase 4 permanece aberta — este plano não fecha nenhum dos 26 itens de verificação humana.
</success_criteria>

<output>
Criar `.planning/quick/260811-uiy-fronteira-de-erro-global-acima-do-layout/260811-uiy-SUMMARY.md`
ao terminar, registrando: a saída literal da prova com o banco parado, quais comandos de e2e
foram efetivamente invocados (a regra é uma), e que `global-error.tsx` tem prova estrutural e
não comportamental.
</output>
