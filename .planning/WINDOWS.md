---
schema_version: 1
open_count: 9
waived_count: 0
fixed_count: 0
total_count: 9
last_updated: 2026-08-09T17:35:34.500Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01-funda-o-e-primeiro-deploy | deviation | README.md |  | Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md | open |  | 2026-08-06T17:44:26.584Z |  |
| 2 | 02a-login-banco-base-e-backup | deviation | middleware.ts |  | callbackUrl do redirecionamento nao autenticado vaza o endereco interno do container (https://0.0.0.0:3000/...) em vez do dominio publico — confirmado de fora em producao (curl -I https://amassacerrado.com.br/encomendas). O cookie __Secure-authjs.callback-url resolve o dominio certo, mas o parametro de query da Location nao. Descoberto durante a verificacao externa do plano 02a-08 (Tarefa 3); fora do escopo de arquivos deste plano (nao toca middleware.ts nem lib/auth/) — precisa de investigacao dedicada em auth.config.ts / trustHost do Auth.js v5 | open |  | 2026-08-08T14:39:57.410Z |  |
| 3 | 02b | deviation | tests/e2e/autenticacao.spec.ts | 72 | Sexta tentativa de bloqueio trava/estoura timeout de forma pre-existente (confirmado via --grep-invert, independente da 02b-03) — ver deferred-items.md item 1 | open |  | 2026-08-08T18:37:46.938Z |  |
| 4 | 03 | deviation | .planning/phases/03-gestor-de-encomendas/deferred-items.md |  | shadcn 'form' registry item (radix-nova style, CLI 3.8.5) has no files to install; plan 06 must decide field vs hand-rolled wrapper vs direct react-hook-form before building the full formulario | open |  | 2026-08-09T14:15:31.870Z |  |
| 5 | 03 | deviation | tests/e2e/encomendas-indice.spec.ts |  | Teste 'com o banco vazio, a frase A roda ainda nao gira aparece uma unica vez' (ENC-13) so e confiavel quando rodado com --grep 'indice de encomendas' (comando de verificacao literal da Tarefa 3). No npm run test:e2e completo sem grep, outro arquivo de spec (encomendas.spec.ts) roda em paralelo e pode criar uma encomenda antes da asserção — limitação estrutural da suite (sem isolamento de banco por teste), nao um defeito do EstadoVazio/hrefBotao. | open |  | 2026-08-09T16:31:43.430Z |  |
| 6 | 03-gestor-de-encomendas | deviation | components/amassa/cabecalho-pagina.tsx |  | O <h1> do cabecalho de pagina (CabecalhoPagina) nao quebra em linha para um titulo muito comprido sem espaco (ex.: nome de encomenda de 120 caracteres colados) — causa rolagem horizontal da PAGINA inteira (nao dos dois alert-dialog de 03-05, que ja tem overflow-wrap:anywhere e foram provados por e2e). Descoberto durante 03-05 (pagina de detalhe usa o nome da encomenda como titulo); fora do escopo de arquivos deste plano (componente compartilhado da 2b). Precisa de break-words/overflow-wrap no h1 de cabecalho-pagina.tsx, revisavel numa fase futura de polimento. | open |  | 2026-08-09T17:35:18.070Z |  |
| 7 | 03-gestor-de-encomendas | unrun-verify | tests/e2e/encomendas-detalhe.spec.ts |  | E5 detalhe — vazio (backstop do plano 03-05): a trilha nunca deveria mostrar uma encomenda sem item (esquemaEncomenda exige >=1), mas isso depende do formulario recusar 0 itens (plano 06, ainda nao existe UI para isso) — nao verificado a mao nesta execucao; conferir quando o formulario de edicao de itens existir. | open |  | 2026-08-09T17:35:32.827Z |  |
| 8 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/confirmar-cancelar.tsx |  | E8 confirmar cancelar — erro (backstop do plano 03-05): o AlertDialog deve permanecer aberto mostrando o texto de falha sem fechar sozinho quando cancelarEncomenda falha; caminho implementado (estado erro + onOpenChange bloqueado por enviando) mas nao ha teste automatizado nem verificacao manual do caminho de falha nesta execucao (dificil de simular falha de rede/servidor de forma confiavel em e2e local). | open |  | 2026-08-09T17:35:33.701Z |  |
| 9 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/confirmar-excluir.tsx |  | E9 confirmar excluir — erro (backstop do plano 03-05): mesma situacao de E8 aplicada a excluirEncomenda — caminho implementado, sem prova automatizada nem verificacao manual do caminho de falha nesta execucao. | open |  | 2026-08-09T17:35:34.500Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01-funda-o-e-primeiro-deploy",
    "file": "README.md",
    "line": null,
    "description": "Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-06T17:44:26.584Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "02a-login-banco-base-e-backup",
    "file": "middleware.ts",
    "line": null,
    "description": "callbackUrl do redirecionamento nao autenticado vaza o endereco interno do container (https://0.0.0.0:3000/...) em vez do dominio publico — confirmado de fora em producao (curl -I https://amassacerrado.com.br/encomendas). O cookie __Secure-authjs.callback-url resolve o dominio certo, mas o parametro de query da Location nao. Descoberto durante a verificacao externa do plano 02a-08 (Tarefa 3); fora do escopo de arquivos deste plano (nao toca middleware.ts nem lib/auth/) — precisa de investigacao dedicada em auth.config.ts / trustHost do Auth.js v5",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T14:39:57.410Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "02b",
    "file": "tests/e2e/autenticacao.spec.ts",
    "line": 72,
    "description": "Sexta tentativa de bloqueio trava/estoura timeout de forma pre-existente (confirmado via --grep-invert, independente da 02b-03) — ver deferred-items.md item 1",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T18:37:46.938Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "03",
    "file": ".planning/phases/03-gestor-de-encomendas/deferred-items.md",
    "line": null,
    "description": "shadcn 'form' registry item (radix-nova style, CLI 3.8.5) has no files to install; plan 06 must decide field vs hand-rolled wrapper vs direct react-hook-form before building the full formulario",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T14:15:31.870Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "03",
    "file": "tests/e2e/encomendas-indice.spec.ts",
    "line": null,
    "description": "Teste 'com o banco vazio, a frase A roda ainda nao gira aparece uma unica vez' (ENC-13) so e confiavel quando rodado com --grep 'indice de encomendas' (comando de verificacao literal da Tarefa 3). No npm run test:e2e completo sem grep, outro arquivo de spec (encomendas.spec.ts) roda em paralelo e pode criar uma encomenda antes da asserção — limitação estrutural da suite (sem isolamento de banco por teste), nao um defeito do EstadoVazio/hrefBotao.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T16:31:43.430Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/cabecalho-pagina.tsx",
    "line": null,
    "description": "O <h1> do cabecalho de pagina (CabecalhoPagina) nao quebra em linha para um titulo muito comprido sem espaco (ex.: nome de encomenda de 120 caracteres colados) — causa rolagem horizontal da PAGINA inteira (nao dos dois alert-dialog de 03-05, que ja tem overflow-wrap:anywhere e foram provados por e2e). Descoberto durante 03-05 (pagina de detalhe usa o nome da encomenda como titulo); fora do escopo de arquivos deste plano (componente compartilhado da 2b). Precisa de break-words/overflow-wrap no h1 de cabecalho-pagina.tsx, revisavel numa fase futura de polimento.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:18.070Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "tests/e2e/encomendas-detalhe.spec.ts",
    "line": null,
    "description": "E5 detalhe — vazio (backstop do plano 03-05): a trilha nunca deveria mostrar uma encomenda sem item (esquemaEncomenda exige >=1), mas isso depende do formulario recusar 0 itens (plano 06, ainda nao existe UI para isso) — nao verificado a mao nesta execucao; conferir quando o formulario de edicao de itens existir.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:32.827Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/encomendas/confirmar-cancelar.tsx",
    "line": null,
    "description": "E8 confirmar cancelar — erro (backstop do plano 03-05): o AlertDialog deve permanecer aberto mostrando o texto de falha sem fechar sozinho quando cancelarEncomenda falha; caminho implementado (estado erro + onOpenChange bloqueado por enviando) mas nao ha teste automatizado nem verificacao manual do caminho de falha nesta execucao (dificil de simular falha de rede/servidor de forma confiavel em e2e local).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:33.701Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/encomendas/confirmar-excluir.tsx",
    "line": null,
    "description": "E9 confirmar excluir — erro (backstop do plano 03-05): mesma situacao de E8 aplicada a excluirEncomenda — caminho implementado, sem prova automatizada nem verificacao manual do caminho de falha nesta execucao.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:34.500Z",
    "resolved_at": null
  }
]
````
