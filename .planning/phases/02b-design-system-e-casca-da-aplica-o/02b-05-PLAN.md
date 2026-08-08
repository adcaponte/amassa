---
phase: 02b-design-system-e-casca-da-aplica-o
plan: 05
type: execute
wave: 4
depends_on: ["02b-03", "02b-04"]
files_modified:
  - tests/e2e/acessibilidade.spec.ts
  - package.json
  - package-lock.json
autonomous: false
requirements: [UI-05, UI-06, UI-09]
user_setup: []

estimate:
  tokens: 46000
  raw_tokens: 46000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Todo item da barra inferior mede pelo menos 44px de altura e de largura pela `boundingBox()` no viewport de celular (UI-09)"
    - "O botão de avatar do cabeçalho móvel tem alvo de toque de pelo menos 44px e é alcançável por `getByRole('button', { name: 'Abrir menu do usuário' })` (UI-09)"
    - "Todo item da barra lateral mede pelo menos 44px de altura no viewport de desktop (UI-09)"
    - "Nenhum elemento interativo da casca fica sem nome acessível — o único botão sem rótulo visível é o avatar, e ele responde pelo `aria-label` (UI-09, entrada vazia)"
    - "Os nomes acessíveis afirmados nos testes vêm das mesmas constantes que a interface usa (`ITENS_NAVEGACAO`), eliminando divergência de normalização de acento entre interface e asserção (UI-09, codificação)"
    - "A varredura de contraste com axe-core sobre as dez superfícies da fase não reporta nenhuma violação de `color-contrast` em nível AA (UI-09)"
    - "Dá para chegar do campo de e-mail até o botão 'Entrar' e entrar usando só Tab e Enter, sem mouse (UI-09)"
    - "Dá para chegar ao menu do usuário e acioná-lo usando só o teclado, com foco visível em cada parada (UI-09)"
    - "Nenhuma das dez telas exige rolagem horizontal a 320px de largura (UI-06, reconferido sobre a fase inteira)"
    - statement: "Um nome de usuário longo (40 caracteres ou mais) trunca com reticências em uma linha e mostra o nome completo em `title`, tanto no rodapé da barra lateral de 240px quanto no menu do celular — sem empurrar o leiaute"
      verification: backstop
  artifacts:
    - tests/e2e/acessibilidade.spec.ts
  key_links:
    - "`@axe-core/playwright` sobre a casca renderizada → violações de contraste que 'parece legível na minha tela' nunca pegaria"
    - "`ITENS_NAVEGACAO` → nomes acessíveis afirmados no teste: uma fonte só para interface e verificação"
  prohibitions:
    - statement: "Nenhuma violação de acessibilidade encontrada pela ferramenta é silenciada por lista de exceção, `disableRules` ou recorte do seletor só para o teste passar — ou a violação é corrigida, ou é registrada por escrito no SUMMARY com o motivo e vira item de verificação da fase"
---

<objective>
UI-09 verificado com ferramenta, não a olho: alvos de toque medidos, contraste varrido por
axe-core, navegação por teclado exercitada e nome acessível conferido — e, depois disso, a única
verificação que máquina nenhuma faz, que é o dono usando o sistema em pé, no celular, com o
polegar.

Purpose: o `04-DESIGN-SYSTEM.md` §2 pede explicitamente que o contraste seja conferido com
ferramenta antes de fechar a M1, e a lição mais cara da Fase 1 foi verificar de fora em vez de
aceitar o relato de quem executou. UI-05 é o critério que nenhum teste alcança, e por isso ganha
um portão humano em vez de um item de checklist automático.
Output: `tests/e2e/acessibilidade.spec.ts` e o registro da conferência humana.
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
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-03-SUMMARY.md
@.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-04-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Tarefa 1: Portão de legitimidade dos pacotes de acessibilidade</name>
  <what-built>Nada ainda. Mesma política dos planos 01 e 02: sem tabela de auditoria de pacotes,
  todo pacote entra como `[ASSUMED]` e passa por conferência humana antes de ser instalado. Nunca
  aprovado automaticamente.</what-built>
  <how-to-verify>
Confira em `npmjs.com/package/<nome>` — mantenedor, última publicação, repositório vinculado,
downloads semanais. Dois pacotes, ambos como `devDependencies` (nunca entram na imagem de
produção, que só recebe a saída `standalone`):

- `@axe-core/playwright`
- `axe-core`

O `axe-core` é a biblioteca de auditoria de acessibilidade da Deque Systems; o
`@axe-core/playwright` é a ligação oficial dela com o Playwright. Se o mantenedor não for a
Deque, pare e diga.
  </how-to-verify>
  <resume-signal>Digite "aprovado" para liberar a instalação, ou nomeie o pacote que não passou</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: A suíte de acessibilidade — alvos, contraste, teclado e nome acessível</name>
  <precondition>O Docker está rodando: `scripts/testar-e2e.mjs` sobe o Postgres de teste em contêiner antes do Playwright. `docker info` responde sem erro.</precondition>
  <files>tests/e2e/acessibilidade.spec.ts, package.json, package-lock.json</files>
  <read_first>
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-UI-SPEC.md` — a tabela
      "Acessibilidade (UI-09) — contrato de verificação": as cinco linhas dizem o que garantir e
      como verificar cada uma
    - `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-PATTERNS.md` — o padrão de
      `boundingBox()` para alvo de toque e a convenção `getByRole` com nome acessível
    - `tests/e2e/casca.spec.ts` e `tests/e2e/design-system.spec.ts` — as specs desta fase, para
      reaproveitar a forma de login e não duplicar cobertura
    - `tests/e2e/autenticacao.spec.ts` — a forma dos imports e do `test.describe` do projeto
    - `lib/navegacao/itens.ts` — `ITENS_NAVEGACAO`, a constante a importar em vez de redigitar
      rótulos acentuados
    - `app/(auth)/login/page.tsx` — os campos e a ordem de tabulação do formulário
    - `playwright.config.ts` — os dois projetos e o `baseURL`
  </read_first>
  <behavior>
    - no projeto celular, cada um dos 5 itens da barra inferior tem `boundingBox()` com altura
      >= 44 e largura >= 44
    - no projeto celular, o botão de avatar tem `boundingBox()` com altura >= 44 e largura >= 44
    - no projeto desktop, cada item da barra lateral tem `boundingBox()` com altura >= 44
    - `getByRole("button", { name: "Abrir menu do usuário" })` encontra exatamente um elemento no
      celular
    - em `/login`, começando do `<body>`, uma sequência de `Tab` chega ao campo de e-mail, depois
      ao de senha, depois ao botão "Entrar"; `Enter` no botão envia o formulário e o login
      acontece
    - depois de logado, uma sequência de `Tab` alcança o gatilho do menu do usuário, e `Enter`
      abre o menu
    - a varredura axe-core em `/login`, `/`, `/encomendas`, `/agenda`, `/queimas`, `/estoque` e
      `/orcamentos` não devolve nenhuma violação da regra `color-contrast`
    - a mesma varredura não devolve violação das regras `button-name`, `link-name` e
      `aria-allowed-attr`
    - a 320px de largura, `document.documentElement.scrollWidth` não excede o `clientWidth` em
      nenhuma das sete rotas acima
  </behavior>
  <action>
**1. Instalar.** `npm install --save-dev @axe-core/playwright axe-core`, e em seguida fixe as duas
versões exatas em `package.json` (sem `^`, sem `~`) e rode `npm install` para o lock refletir. As
duas são `devDependencies`: o estágio `app` do Dockerfile só recebe a saída `standalone`, então
nada disso viaja para produção. Nenhuma mudança no `Dockerfile` nem no workflow é necessária —
confirme isso em vez de presumir, e registre no SUMMARY.

**2. `tests/e2e/acessibilidade.spec.ts`.** Escreva os casos da seção `<behavior>` antes de rodá-los
e observe cada um falhar por um motivo real pelo menos uma vez (por exemplo, baixando
temporariamente a altura mínima de um item para ver a asserção de 44px reprovar). Um portão que
nunca foi visto falhando é indistinguível de um portão quebrado — é a lição da Fase 1.

Pontos concretos:

- **Alvos de toque:** meça com `boundingBox()`, não com `getComputedStyle` de `height` — o que
  importa é a caixa real que o dedo acerta, incluindo padding. Itere sobre `ITENS_NAVEGACAO` para
  o relatório dizer QUAL item reprovou.
- **Nome acessível:** afirme com `getByRole`, importando os rótulos de `ITENS_NAVEGACAO`. Não
  redigite "Início" no arquivo de teste: o acento tem mais de uma representação possível em
  Unicode, e uma divergência de forma normalizada entre a interface e a asserção produziria uma
  falha que consome uma tarde inteira para achar. O botão de avatar é a exceção — o nome dele
  ("Abrir menu do usuário") vem do `aria-label` e é literal no teste; para eliminar a mesma
  divergência, considere extrair essa cadeia para uma constante exportada por
  `components/amassa/cabecalho-movel.tsx` e importá-la aqui.
- **Contraste:** use `new AxeBuilder({ page })` do `@axe-core/playwright`, restrito às regras que
  esta fase se compromete a passar (`color-contrast`, `button-name`, `link-name`,
  `aria-allowed-attr`) com `withRules`. Restringir as regras é escolha deliberada: uma varredura
  completa traria também achados de estrutura de documento que pertencem à revisão da Fase 7, e
  um teste que falha por coisa fora do escopo é um teste que alguém desliga. O que NÃO é
  permitido é silenciar uma violação encontrada dentro dessas quatro regras.
- **Rolagem horizontal:** parametrize sobre a lista de sete rotas com `page.setViewportSize({
  width: 320, height: 640 })`. Um caso parametrizado, não sete copiados.
- **Teclado:** use `page.keyboard.press("Tab")` e afirme o elemento focado com
  `page.locator(":focus")`, comparando o nome acessível. No login, termine com `Enter` e afirme
  que a URL virou a raiz — é a prova de que o formulário é operável sem mouse.

Se alguma violação aparecer, corrija a interface. Se uma violação for genuinamente impossível de
corrigir nesta fase, NÃO a silencie: registre no SUMMARY com o motivo, e ela vira item da
verificação da fase.
  </action>
  <verify>
    <automated>npm run test:e2e -- --grep "acessibilidade"</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:e2e -- --grep "acessibilidade"` sai com 0 nos projetos `desktop` e `celular`
    - `tests/e2e/acessibilidade.spec.ts` importa `AxeBuilder` de `@axe-core/playwright` e
      `ITENS_NAVEGACAO` de `@/lib/navegacao/itens`
    - `tests/e2e/acessibilidade.spec.ts` contém `boundingBox`, `44`, `color-contrast` e
      `Abrir menu do usuário`
    - `grep -c 'disableRules\|exclude(' tests/e2e/acessibilidade.spec.ts` retorna 0 — nenhuma
      violação silenciada
    - `grep -c 'test.skip\|test.fixme' tests/e2e/acessibilidade.spec.ts` retorna 0
    - `@axe-core/playwright` e `axe-core` estão em `devDependencies` com versão exata, sem `^` e
      sem `~`
    - `npm run test:e2e` (suíte inteira) sai com 0
    - `npm run build` sai com 0 e `git diff --exit-code docker/Dockerfile .github/workflows/` retorna 0
  </acceptance_criteria>
  <done>UI-09 tem prova de máquina em quatro frentes — alvo de toque medido, contraste varrido por
  ferramenta, nome acessível conferido por papel e navegação por teclado exercitada — e UI-06 é
  reconferido sobre a fase inteira, não só sobre as telas do plano 03.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Tarefa 3: A conferência que máquina nenhuma faz — o polegar, o nome longo e a voz</name>
  <what-built>A fase inteira: identidade visual aplicada, casca de navegação nos dois tamanhos de
  tela, dez telas com vazio, carregamento e erro, e a suíte de acessibilidade passando. Falta o
  que nenhum teste alcança.</what-built>
  <how-to-verify>
Faça isto **num celular de verdade**, em pé, como o sistema vai ser usado no ateliê — não no
simulador de celular do navegador do desktop. Abra o endereço público, entre com a sua conta.

**1. UI-05 — o polegar.** Segurando o telefone com uma mão só, alcance cada um dos cinco itens da
barra inferior com o polegar, sem reposicionar o aparelho. Depois abra o menu do usuário pelo
avatar e chegue no "Sair". A pergunta: isso é confortável ou é ginástica? Se algum alvo exigir
esticar o polegar até doer, diga qual.

**2. O nome longo (verificação de retaguarda registrada no contrato de UI).** Nenhuma conta de
teste hoje tem nome longo, então nada automatizado exercita este caminho. Crie uma conta com um
nome de 40 caracteres ou mais — `npm run criar-usuario -- --nome "Maria Aparecida dos Santos
Nascimento Silva" --email "nome-longo@exemplo.test"` — entre com ela e confira duas coisas: no
desktop, o rodapé da barra lateral de 240px trunca o nome com reticências em uma linha sem
empurrar nada; no celular, o menu do usuário faz o mesmo. Passar o mouse (ou segurar) mostra o
nome completo. Desative a conta depois (`npm run desativar-usuario`). Use nome claramente
fictício — nenhum dado real de pessoa entra em conta de teste.

**3. A voz das frases (D-05).** Leia as frases de estado vazio de Agenda, Queimas e Estoque, e a
de `/orcamentos`. Só a de Encomendas ("A roda ainda não gira.") veio pronta do documento de
design; as outras foram escritas pelo executor seguindo a §9. Elas soam como o AMASSA — afetivas,
diretas, sensoriais — ou soam corporativas? Reescreva a que não soar.

**4. Olhada geral nas dez telas**, no celular e no desktop: as cores são as do AMASSA (areia,
terracota, tinta), o título é condensado, o corpo é legível sob luz forte, e nenhuma tela pede
rolagem de lado.
  </how-to-verify>
  <resume-signal>Digite "aprovado" ou descreva o que precisa mudar (item, tela e o que está errado)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| registro npm → repositório | duas devDependencies novas de auditoria entram na árvore |
| conta de teste com nome longo → banco de produção | a conferência humana cria uma conta real no ambiente onde ela for feita |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02b-06-SC | Tampering | `@axe-core/playwright`, `axe-core` | high | mitigate | Checkpoint humano bloqueante (Tarefa 1) antes da instalação; versões fixadas sem `^`/`~`; entram só como `devDependencies` e o estágio `app` do Dockerfile recebe apenas a saída `standalone`, então nenhum dos dois chega à imagem de produção |
| T-02b-13 | Spoofing | conta de nome longo criada na conferência humana | medium | mitigate | A conta usa nome claramente fictício e e-mail em `exemplo.test`, é criada pelo `scripts/criar-usuario.ts` (mesma senha forte gerada de sempre) e é desativada ao fim da conferência com `npm run desativar-usuario` — desativar nunca apaga a linha, então o rastro permanece auditável |
| T-02b-14 | Information Disclosure | relatório do axe-core em CI | low | accept | O relatório de violações pode citar texto de interface no log do runner; nesta fase todo texto de interface é copy fixa e pública, sem dado de pessoa. Aceito |
</threat_model>

<verification>
- `npm run lint`, `npx tsc --noEmit`, `npm run verificar-acoes`, `npm test`, `npm run build` e
  `npm run test:e2e` saem todos com 0.
- `git diff --exit-code docker/Dockerfile .github/workflows/ middleware.ts lib/auth/rotas-publicas.ts`
  retorna 0.
- A conferência humana da Tarefa 3 foi respondida, com o resultado dos quatro pontos registrado
  no SUMMARY — inclusive o do nome longo, que é a única verificação de retaguarda desta fase.
</verification>

<success_criteria>
UI-09 deixa de depender de "parece legível na minha tela": há medição de alvo de toque, varredura
de contraste com ferramenta, prova de nome acessível e prova de teclado. E UI-05, que nenhuma
ferramenta mede, foi conferido do único jeito que conta — com o polegar, em pé, num celular de
verdade.
</success_criteria>

<output>
Create `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-05-SUMMARY.md` when done
</output>

## Artefatos que este plano produz

**Arquivos novos:** `tests/e2e/acessibilidade.spec.ts`.

**Arquivos modificados:** `package.json`, `package-lock.json` (duas `devDependencies` novas).

**Símbolos exportados:** nenhum símbolo de aplicação. Se a cadeia do `aria-label` do avatar for
extraída para constante, ela passa a ser exportada por `components/amassa/cabecalho-movel.tsx` e
importada pelo teste — registre no SUMMARY se isso foi feito.

**Rotas novas:** nenhuma.

**Scripts npm novos:** nenhum.
