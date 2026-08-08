---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-08T14:39:57.410Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01-funda-o-e-primeiro-deploy | deviation | README.md |  | Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md | open |  | 2026-08-06T17:44:26.584Z |  |
| 2 | 02a-login-banco-base-e-backup | deviation | middleware.ts |  | callbackUrl do redirecionamento nao autenticado vaza o endereco interno do container (https://0.0.0.0:3000/...) em vez do dominio publico — confirmado de fora em producao (curl -I https://amassacerrado.com.br/encomendas). O cookie __Secure-authjs.callback-url resolve o dominio certo, mas o parametro de query da Location nao. Descoberto durante a verificacao externa do plano 02a-08 (Tarefa 3); fora do escopo de arquivos deste plano (nao toca middleware.ts nem lib/auth/) — precisa de investigacao dedicada em auth.config.ts / trustHost do Auth.js v5 | open |  | 2026-08-08T14:39:57.410Z |  |

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
  }
]
````
