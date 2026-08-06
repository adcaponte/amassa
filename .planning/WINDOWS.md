---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-06T17:44:26.584Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01-funda-o-e-primeiro-deploy | deviation | README.md |  | Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md | open |  | 2026-08-06T17:44:26.584Z |  |

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
  }
]
````
