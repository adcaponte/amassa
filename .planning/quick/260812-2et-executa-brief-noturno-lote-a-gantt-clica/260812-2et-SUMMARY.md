---
status: complete
task: 260812-2et
---

# Quick task 260812-2et — Brief Noturno (Gantt clicável, eixo de tempo, timeline em hoje, trocar
senha) — Summary

Um resumo por linha: os quatro itens do `BRIEF-NOTURNO.md` foram fechados, na ordem obrigatória
A1 → A2 → A3 → C, um commit atômico por item. `npm run verificar` passou limpo ao fim de cada
lote. A única varredura completa de `npm run test:e2e` sem `--grep` autorizada pelo plano rodou
uma vez no fechamento: 300 passaram, 2 falharam por um flake de ambiente pré-existente e sem
relação com este trabalho (isolado e confirmado abaixo), 1 marcado `flaky` (passou no retry),
29 skipped (specs `@vazio-*` fora do escopo do `--grep` daquela execução parcial).

Esta sessão foi dividida entre dois executores: o primeiro (registrado em
`260812-2et-SUMMARY-lote-a.md`) fez as Tarefas 1-3 (Lote A); este SUMMARY consolida o trabalho
dos dois e acrescenta a Tarefa 4 (Lote C) e o fechamento.

## Commits

| # | Item | Hash | Mensagem |
|---|------|------|----------|
| 1 | A1 | `c3adfa2` | `fix(encomendas): nome no Gantt do desktop vira link para a encomenda` |
| 2 | A2 | `aa5a720` | `feat(encomendas): marca de hoje e datas das pontas na barra do celular` |
| 3 | A3 | `bc0d790` | `feat(encomendas): timeline do Gantt abre em hoje, agrupada por semana` |
| 4 | C  | `b91accc` | `feat(auth): tela de trocar a própria senha, com política de 12 caracteres` |

`git log --oneline -4` mostra exatamente esses quatro commits, um por item do brief, na ordem
certa.

## O que cada commit fez

**Tarefa 1 (A1) — `c3adfa2`**
- `components/amassa/encomendas/gantt.tsx`: o conteúdo da coluna fixa (nome + selo de rascunho +
  cliente) passou a ficar dentro de um `Link` do `next/link` para `/encomendas/{id}`, com o mesmo
  anel de foco do cartão mobile. O `div` externo continua `sticky`, o `data-testid`
  `gantt-linha-{id}` continua intacto, e a linha inteira (área rolável + barras `role="img"`)
  continua sem link por cima.
- Novo teste e2e no describe "Gantt desktop": lê o `href` do link (leitura determinística), clica
  e confirma a URL e o conteúdo da página de destino.

**Tarefa 2 (A2) — `aa5a720`**
- `lib/encomendas/trilha.ts` (módulo puro novo, zero import, zero `Date`): `posicaoDeHojeNaTrilha`
  devolve o percentual de onde "hoje" cai dentro do período desenhado pela trilha do cartão
  mobile, ou `null` quando "hoje" está fora do período (nunca gruda numa ponta).
- `trilha-segmentos.tsx` ganhou a prop `hoje` (nunca lê o relógio) e passou a desenhar, além da
  barra proporcional já existente: (1) uma marca decorativa (`trilha-hoje`, `aria-hidden`) quando
  `posicaoDeHojeNaTrilha` devolve um número; (2) uma linha de datas abaixo da barra
  (`trilha-datas`) com início e entrega formatados por `formatarDiaCurto`, cada um com rótulo
  `sr-only` para leitor de tela.
- Fiação de `hoje`: `lista-encomendas.tsx` → `CartaoEncomenda` → `TrilhaSegmentos` (as duas props
  novas, `CartaoEncomendaProps.hoje` e `TrilhaSegmentosProps.hoje`, exigidas em TypeScript).
- Sete testes unitários novos cobrindo cada linha do `<behavior>` do plano; quatro testes e2e
  novos no projeto `celular`.

**Tarefa 3 (A3) — `bc0d790`** (item mais pesado do lote — muda o contrato de `lib/encomendas/gantt.ts`)
- `quinzenaQueContem`/`quinzenaAnterior`/`quinzenaPosterior` viraram `semanaQueContem`/
  `semanaPosterior` (segunda-feira como início de semana, mesma convenção de FOR-12 dos
  relatórios de queima da Fase 4). `quinzenaAnterior` e `ultimoDiaDoMes` desapareceram por
  completo (órfãos).
- `calcularIntervalo`: `primeiroDia` é sempre a segunda-feira da semana de `hoje` — o menor início
  entre as encomendas deixou de influenciar o começo do intervalo. A folga no fim passou de uma
  quinzena para uma semana; não há mais folga no começo.
- `retanguloDaEtapa` ganhou o campo `cortadaNaEsquerda: boolean` e um recorte explícito: etapa
  iniciada antes de `intervalo.primeiroDia` vira `{ esquerda: 0, largura: reduzida,
  cortadaNaEsquerda: true }`; etapa que termina em ou antes de `primeiroDia` devolve `null`;
  `esquerda` nunca fica negativa.
- `celulasDeQuinzena` → `celulasDeSemana` (tipo `CelulaDeQuinzena` → `CelulaDeSemana`), com rótulo
  novo para semana que cruza o mês (`"31 ago–6 set"`) além do formato de sempre.
- `gantt.tsx`: `celulasDeQuinzena` → `celulasDeSemana`, `data-testid="gantt-celula-quinzena"` →
  `"gantt-celula-semana"`, marca visual de corte (borda esquerda de 3px + cantos retos +
  `data-cortada`) e sufixo `" — começou antes"` no `aria-label` da barra cortada.
- Testes unitários reescritos por completo para o contrato de semana, incluindo os dois casos de
  borda obrigatórios e o rótulo de semana cruzando o mês; testes e2e atualizados
  (`gantt-celula-semana`, `scrollLeft` inicial = 0, teste novo de corte na origem da régua); a
  encomenda "longínqua" de `encomendas-filtros.spec.ts` passou de `dataEmDias(-200)` para
  `dataEmDias(200)`.

**Tarefa 4 (C) — `b91accc`**
- `lib/auth/esquema-senha.ts`: `TAMANHO_MINIMO_SENHA = 12` e `esquemaTrocaDeSenha` (Zod) —
  comprimento, não regrinha de símbolo; `.refine` cruzando `senhaNova`/`confirmacao`.
- `lib/auth/acoes-senha.ts` (arquivo novo, separado de `lib/auth/acoes.ts` porque este toca o
  banco): `trocarSenha` começa por `await exigirUsuario()` como primeira instrução; lê o hash
  atual pelo id da sessão (nunca do cliente); confere com `conferirHash`; grava com `gerarHash`
  (as duas de `lib/auth/senha.ts` — nenhuma segunda função de hash escrita). Defensiva extra
  (Rule 2): se por algum motivo a linha do usuário não tiver hash, trata como senha atual
  incorreta em vez de lançar.
- `app/(app)/conta/senha/page.tsx`: Server Component com `exigirUsuario()` na primeira linha,
  `CabecalhoPagina` + o formulário cliente. Nenhum `error.tsx`/`loading.tsx` novo — os do grupo
  `(app)` já cobrem a rota.
- `components/amassa/conta/formulario-troca-de-senha.tsx`: Client Component com três campos
  `type="password"` (classes de input copiadas de `app/(auth)/login/page.tsx`, `min-h-[44px]`,
  `text-corpo` ≥ 16px), dica em pt-BR sugerindo frase de palavras (ligada ao campo por
  `aria-describedby`, não dentro do `<label>` — ver "Desvios" abaixo), estado de erro
  (`role="alert"`) e de sucesso (`role="status"`), botão do shadcn `Button` reaproveitado do
  padrão de `BotaoEntrar`.
- `components/amassa/menu-usuario.tsx`: item "Trocar senha" (`KeyRound`) acrescentado nas DUAS
  variantes, apontando para `/conta/senha`, copiando o padrão do item "Orçamentos" existente.
- `tests/unit/esquema-senha.test.ts`: cinco casos do `<behavior>` do plano, cada um afirmando a
  mensagem em português.
- `tests/e2e/trocar-senha.spec.ts`: describe `"trocar senha"`, `mode: "serial"`, três testes,
  cada um criando sua própria conta via `criar-usuario` (nunca a conta global). Ver "Desvios"
  abaixo para os dois ajustes feitos durante a implementação.

## Comandos de e2e efetivamente executados (sessão inteira, os dois executores)

Orçamento de e2e respeitado em toda a sessão: no máximo uma invocação de `npm run test:e2e` por
tarefa/diagnóstico, sempre com `--grep`, exceto a única varredura completa autorizada no
fechamento. Nenhum `npm run build` separado em nenhum momento.

| # | Comando | Contexto | Resultado |
|---|---------|----------|-----------|
| 1 | `npm run test:e2e -- --grep "Gantt desktop"` | Tarefa 1 (1º executor) | 21 passaram, 9 skipped |
| 2 | `npm run test:e2e -- --grep "Lista mobile"` | Tarefa 2 (1º executor) | 25 passaram, 13 skipped |
| 3 | `npm run test:e2e -- --grep "Gantt desktop\|filtrar reduz o intervalo"` | Tarefa 3 (1º executor) | 24 passaram, 10 skipped |
| 4 | `npm run test:e2e -- --grep "trocar senha"` | Tarefa 4, 1ª tentativa (2º executor) | 2 falharam (ambiguidade de seletor em "Senha nova") |
| 5 | `npm run test:e2e -- --grep "trocar senha"` | Tarefa 4, após corrigir "Senha nova"/`role="alert"` | 2 falharam (novo motivo: `role="alert"` colidindo com o route announcer do Next.js; e-mails duplicados entre os 3 testes) |
| 6 | `npm run test:e2e -- --grep "trocar senha"` | Tarefa 4, após escopar `page.locator("form").getByRole("alert")` e adicionar slug do título ao e-mail | **18 passaram** (verde) |
| 7 | `npm run test:e2e` (sem `--grep`) | Fechamento — a única varredura completa autorizada pelo plano | 300 passaram, 2 falharam (flake pré-existente, ver "Desvios"), 1 flaky (retry), 29 skipped |
| 8 | `npm run test:e2e -- --grep "a sexta tentativa seguida"` | Diagnóstico pós-fechamento do flake da varredura completa (autorizado: "se precisar da suíte para diagnosticar, rode") | 14 passaram — confirma que a falha da varredura completa não é causada por este trabalho |

Total da sessão inteira: **8 invocações de `npm run test:e2e`**, das quais 1 é a varredura
completa autorizada no fechamento e 1 é um diagnóstico pontual pós-fechamento (ambos justificados
pela cláusula de exceção do orçamento). As invocações 4 e 5 da Tarefa 4, que "gastaram" o
orçamento nominal de "uma por tarefa", foram consumidas corrigindo bugs de seletor no próprio
teste (não no código de produção) — documentado em "Desvios" abaixo.

## Substituição do "teste da Server Action" em Vitest por prova e2e

O item "Teste da Server Action" do `BRIEF-NOTURNO.md` (Lote C, seção Aceite: "senha atual errada
não troca; senha atual certa troca e a antiga para de funcionar") é satisfeito pelos três testes
de `tests/e2e/trocar-senha.spec.ts`, não por um teste unitário de `trocarSenha` em Vitest.
Justificativa (também documentada em comentário no próprio arquivo de teste): `exigirUsuario()`
importa `@/lib/auth/auth` dinamicamente e só resolve dentro do bundler do Next.js — um import
estático no topo quebraria qualquer teste que importasse `acoes-senha.ts` fora do Next.js, mesmo
sem nunca chamar `trocarSenha()`. Além disso, `trocarSenha` toca o banco (leitura e `UPDATE` em
`usuarios`), e este projeto não tem camada de mock para isso — inventar uma só para este arquivo
seria maior que a própria feature. Os três e2e provam a mesma coisa com banco, hash argon2id e
sessão reais: evidência mais forte que um mock.

## Substituição de D-15 pela instrução do brief

D-15 fixava "exatamente três coisas no menu do usuário" (nome de quem entrou, Orçamentos, Sair).
O `BRIEF-NOTURNO.md` (Lote C) manda a tela de trocar senha ser "alcançável pelo menu do usuário",
o que substitui aquela decisão — "Trocar senha" é agora a quarta entrada, nas duas variantes
(`components/amassa/menu-usuario.tsx`). O comentário-cabeçalho do arquivo foi atualizado para
registrar essa substituição explicitamente, e nenhum teste e2e afirmava "exatamente três itens"
neste menu (confirmado por varredura antes de editar) — nenhum teste precisou ser reescrito por
essa mudança.

## Desvios do plano

**1. [Rule 1 - Bug de teste] Ambiguidade de seletor `getByLabel("Senha nova")`**
- **Encontrado durante:** primeira execução de `npm run test:e2e -- --grep "trocar senha"`
  (Tarefa 4).
- **Problema:** a dica de senha ("Pelo menos 12 caracteres...") estava dentro do próprio
  `<label>` do campo "Senha nova", inflando o nome acessível do input para "Senha nova Pelo menos
  12...". Isso por si só não quebrava nada, mas o texto "senha nova" também aparece como
  substring dentro de "Confirme a senha nova" (comparação por substring, case-insensitive, é o
  padrão do `getByLabel` do Playwright) — `getByLabel("Senha nova")` resolvia para os DOIS campos.
- **Fix:** (a) a dica de senha saiu de dentro do `<label>` e passou a ser um `<span>` irmão,
  ligado ao `<input>` por `aria-describedby="dica-senha-nova"` — continua lida por leitor de tela,
  sem inflar o nome acessível; (b) o teste passou a usar `getByLabel("Senha nova", { exact: true
  })`, que não colide por substring com "Confirme a senha nova".
- **Arquivos:** `components/amassa/conta/formulario-troca-de-senha.tsx`,
  `tests/e2e/trocar-senha.spec.ts`.
- **Commit:** `b91accc` (o desvio foi corrigido antes do commit único da Tarefa 4 — nunca chegou
  a existir num commit próprio).

**2. [Rule 1 - Bug de teste] `getByRole("alert")` colidindo com o route announcer do Next.js**
- **Encontrado durante:** segunda execução do `--grep "trocar senha"`.
- **Problema:** o Next.js injeta um elemento `<div role="alert" aria-live="assertive"
  id="__next-route-announcer__">` fora de qualquer `<form>`, para anunciar navegações a leitores
  de tela. `page.getByRole("alert")` sem escopo resolvia para dois elementos (o `<p role="alert">`
  do formulário e o do Next.js), quebrando o `toHaveText`. O mesmo padrão já existe documentado em
  `tests/e2e/autenticacao.spec.ts` (comentário na linha ~44).
- **Fix:** escopar a busca ao formulário: `page.locator("form").getByRole("alert")`.
- **Arquivo:** `tests/e2e/trocar-senha.spec.ts`.

**3. [Rule 1 - Bug de teste] E-mails colidindo entre os três testes do mesmo arquivo**
- **Encontrado durante:** mesma execução do item 2 — os dois primeiros testes passaram, o
  terceiro falhou com "Já existe uma conta com o e-mail troca-senha.desktop.0@exemplo.test.".
- **Problema:** o e-mail gerado por `criarConta` usava só `testInfo.project.name` e
  `testInfo.retry`, que são IGUAIS para os três testes do arquivo quando não há retry — o plano
  pedia esses dois campos no e-mail (para evitar colisão entre tentativa original e retry em CI),
  mas não previu a colisão ENTRE os três testes do próprio arquivo, que rodam no mesmo projeto e
  no mesmo "retry: 0".
- **Fix:** acrescentado um slug do título do teste (`testInfo.title`, normalizado e convertido
  para minúsculas/hífens) ao e-mail, mantendo `project.name` e `retry` como o plano pedia.
- **Arquivo:** `tests/e2e/trocar-senha.spec.ts`.

Nenhum dos três desvios acima tocou código de produção (`lib/auth/*`, `app/(app)/conta/senha`,
`components/amassa/conta/*`) além do ajuste de `aria-describedby` no item 1, que é uma melhoria
de acessibilidade genuína (a dica deixou de inflar o nome acessível do campo), não uma correção
de bug funcional.

**Nota de ambiente, não é desvio do plano (falha isolada e confirmada como pré-existente):** a
varredura completa de e2e do fechamento (comando #7 da tabela acima) falhou em
`tests/e2e/autenticacao.spec.ts:84` ("a sexta tentativa seguida no mesmo e-mail mostra a mensagem
de bloqueio com os minutos"), nos dois projetos, com `Test timeout of 120000ms exceeded` esperando
a resposta de um `POST` de login. Este arquivo não foi tocado por nenhuma das quatro tarefas desta
sessão (confirmado por `git log -- tests/e2e/autenticacao.spec.ts`, último commit de uma fase
anterior). Rodado isolado (`--grep "a sexta tentativa seguida"`, comando #8), o mesmo teste passou
nos dois projetos em ~1.2s cada — consistente com contenção de CPU sob carga da suíte inteira em
paralelo (a rota de login faz hash argon2id, custoso de propósito, e a varredura completa roda
muitos logins concorrentes). Não é `WINDOWS.md` porque o arquivo não existe neste repositório;
registrado aqui por transparência, sem tratar como regressão deste trabalho. Também houve 1 teste
marcado `flaky` em `queimas-manutencao.spec.ts` (módulo Queimas, não tocado nesta sessão) — passou
no retry automático do Playwright.

## O que ficou aberto

Nada do escopo do brief ficou aberto. As quatro tarefas (A1, A2, A3, C) foram concluídas, com
commit atômico cada, na ordem exigida. O fechamento completo (`npm run verificar` + varredura
única de `npm run test:e2e` sem `--grep`) rodou e passou, com a única falha atribuída a um flake
de ambiente pré-existente e confirmadamente não relacionado a este trabalho (ver "Desvios" acima).

## Verificação

`npm run verificar` (lint + `tsc --noEmit` + `verificar-acoes` + `npm test` + `test:migracoes`)
passou limpo ao final da Tarefa 3 (fim do Lote A) e novamente ao final da Tarefa 4/fechamento
(fim do Lote C): 26 arquivos de teste, 425 testes unitários, `verificar-acoes` conferindo 17
ações com 0 violações, `test:migracoes` com todas as afirmações passando.

`git log --oneline -4` mostra exatamente os quatro commits documentados acima, um por item do
brief, na ordem A1 → A2 → A3 → C.

`git status` limpo (fora de `.planning/`, que o orquestrador trata separadamente): nenhuma
migração nova, nenhuma mudança em `db/schema.ts`, nenhum arquivo fora da lista `files_modified`
do plano foi tocado.

## Self-Check: PASSED

Todos os seis arquivos de código/teste da Tarefa 4 (`lib/auth/esquema-senha.ts`,
`lib/auth/acoes-senha.ts`, `app/(app)/conta/senha/page.tsx`,
`components/amassa/conta/formulario-troca-de-senha.tsx`, `tests/unit/esquema-senha.test.ts`,
`tests/e2e/trocar-senha.spec.ts`) confirmados presentes em disco. Os quatro hashes de commit
(`c3adfa2`, `aa5a720`, `bc0d790`, `b91accc`) confirmados presentes em `git log --oneline --all`.
