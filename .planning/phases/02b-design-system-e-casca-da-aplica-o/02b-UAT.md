---
status: complete
phase: 02b-design-system-e-casca-da-aplica-o
source: [02b-01-SUMMARY.md, 02b-02-SUMMARY.md, 02b-03-SUMMARY.md, 02b-04-SUMMARY.md, 02b-05-SUMMARY.md]
started: 2026-08-09T00:00:00Z
updated: 2026-08-09T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Tela de login com a identidade do AMASSA
expected: Em `/login` — fundo areia claro (não branco), "AMASSA" em fonte condensada (Archivo Narrow), frase abaixo em fonte normal (Inter), cartão branco com cantos arredondados, campos de e-mail e senha confortáveis ao toque, e um único botão terracota escrito "Entrar". Nenhum erro no console.
result: pass
nota: "Erro de hidratação relatado na primeira tentativa foi rastreado até uma extensão do navegador do dono (atributos `bis_register` e `__processed_<uuid>__` injetados no <body>). Reproduzido em navegador limpo pelo orquestrador: zero erro no console, `<body>` com um único atributo (`class`). Confirmado pelo dono em janela anônima."
coverage_id: 02b-01/D5

### 2. Casca no desktop — a lateral de 240px com a paleta do AMASSA
expected: Depois de entrar, no desktop — barra lateral à esquerda com o logo no topo, os 5 itens (Início, Encomendas, Agenda, Queimas, Estoque), e o menu do usuário no rodapé com o seu nome. A lateral usa os tons do AMASSA (superfície branca, borda areia, item ativo em terracota), não o cinza padrão do shadcn. Orçamentos aparece só no menu do usuário, nunca na navegação principal.
result: pass
nota: "Login local exigiu criar conta de desenvolvimento — o banco local tinha 3 usuários, todos com `ativo = false`. A recusa veio com a mensagem genérica de credenciais, comportamento correto por T-02a-21 (não revelar se a conta existe ou foi desativada)."
coverage_id: 02b-02/D6

### 3. Cabeçalho de página no celular — o botão não espreme o título
expected: No celular (ou janela estreita), em `/encomendas`, `/agenda`, `/queimas` e `/estoque` — o título da tela aparece inteiro e o botão de ação principal (desabilitado) desce para a linha de baixo em vez de espremer o título. Nenhuma tela pede rolagem horizontal.
result: pass
coverage_id: 02b-03/D9

### 4. Erro e 404 — a navegação sobrevive
expected: Ao abrir um endereço que não existe (ex.: `/naoexiste`) estando logado — aparece "Esta página não existe." com o link "Voltar para o painel", que leva ao painel. A mensagem é humana, sem código de erro nem detalhe técnico na tela.
result: pass
nota: "Metade não-autenticada conferida pelo orquestrador: /naoexiste sem sessão devolve 307 para /login sem revelar se a rota existe (T-02b-01). Vista logada confirmada pelo dono."
coverage_id: 02b-04/D6

### 5. UI-05 — a navegação é confortável com o polegar
expected: Num celular de verdade, em pé, segurando com uma mão só — o polegar alcança os cinco itens da barra inferior (Início, Encomendas, Agenda, Queimas, Estoque) e o "Sair" no menu do avatar, sem esticar até doer e sem trocar a pega do aparelho. Este é o núcleo de valor do projeto e o único item que exige aparelho físico.
result: pass
nota: "Testado no celular contra o site publicado (commit 102accb), com conta de gestor real. Os cinco itens da barra inferior alcançam confortavelmente. Sobre o Sair ficar no canto superior: o dono avaliou e considerou irrelevante — a sessão dura 30 dias e ninguém desloga na prática; abrir o app já logado é o comportamento desejado. Decisão de produto registrada, não concessão."
coverage_id: 02b-02/D7, 02b-05/D7

### 6. A voz das quatro frases de estado vazio
expected: As quatro frases escritas nesta fase soam como o AMASSA — afetivas, diretas, sensoriais, como "A roda ainda não gira." — e não corporativas como "Nenhum registro encontrado no sistema."
result: pass
nota: "D-05 fechada. As quatro frases (Agenda, Queimas, Estoque, Orçamentos) aprovadas pelo dono como definitivas — não são mais rascunho do executor."
coverage_id: 02b-05/D8

### 7. Olhada geral nas dez telas
expected: Percorrendo as dez telas — cores do AMASSA em toda parte, títulos em fonte condensada, nada visivelmente quebrado, desalinhado ou fora do lugar. Nenhum erro no console do navegador.
result: pass
nota: "Dez superfícies percorridas no desktop e em janela estreita. O 404 fora da casca (sem barra lateral nem inferior) foi conferido e aceito como desenho consciente — o app/not-found.tsx da raiz sempre atende, e não desenhar a navegação para um endereço digitado por qualquer um é a escolha mais segura (T-02b-01)."
coverage_id: 02b-05/D9

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Cobertura automática (não apresentada como checkpoint)

29 entregáveis das cinco SUMMARYs estão cobertos de forma determinística por testes que passam —
`uat classify-coverage` os classificou como `auto_passed` e por isso não viram pergunta aqui:

| Plano | Auto-cobertos | Provados por |
|-------|---------------|--------------|
| 02b-01 | 4 de 5 | `tests/unit/tokens.test.ts`, `tests/e2e/design-system.spec.ts` (cor computada e família de fonte lidas no navegador) |
| 02b-02 | 5 de 7 | `tests/unit/navegacao.test.ts`, `tests/e2e/casca.spec.ts` |
| 02b-03 | 9 de 10 | `tests/e2e/casca.spec.ts` (14 casos, desktop e celular) |
| 02b-04 | 5 de 6 | `tests/e2e/estados.spec.ts` |
| 02b-05 | 6 de 9 | `tests/e2e/acessibilidade.spec.ts` (axe-core sem violação de contraste em 7 rotas, alvos de toque, teclado, nomes acessíveis, truncamento de nome longo) |

## Notas de ambiente (não são lacunas de código)

Encontradas durante o UAT, na máquina de desenvolvimento do dono. Nenhuma é defeito da Fase 2b —
todas valem como material para o documento de operação da Fase 7 (PNL-04).

- **`AUTH_SECRET` ausente no `.env.local`.** O `npm run dev` falhava com
  `MissingSecret` e o login devolvia `{"message":"There was a problem with the server
  configuration."}`. A suíte e2e não expõe isso porque `playwright.config.ts` injeta um
  `AUTH_SECRET` efêmero para o servidor de teste; a produção tem o seu no `.env` do VPS.
  Quem clonar o repositório bate na mesma parede — o `.env.example` declara a variável sem valor.
  **Para o manual:** gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  e acrescentar ao `.env.local`. Não precisa ser o mesmo segredo da produção; é melhor que não seja.
- **Política de execução do PowerShell bloqueia `npm`/`npx`.** No Windows, `npm` e `npx` são
  scripts `.ps1` e caem em `UnauthorizedAccess`. Contorno sem mexer na política do sistema: usar
  os shims `.cmd` (`npm.cmd run dev`), ou chamar `node.exe` direto.
- **Erro de hidratação do React no navegador do dono**, rastreado até uma extensão que injeta
  `bis_register` e `__processed_<uuid>__` no `<body>`. Reproduzido em navegador limpo: zero erro.
  Não é do código.

## Gaps

[nenhum ainda]
