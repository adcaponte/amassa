---
quick_id: 260920-fru
status: complete
commits: [08754ef, aaa6a71]
---

# Quick 260920-fru — resumo

- `08754ef` — Roteiro 10: o passo da restrição não usa mais `\gset` (meta-comando do `psql`, que
  não funciona com `-c`) e o texto deixou de dizer que o erro aparece no `rollback`; o `check` do
  valor da parcela é imediato. Acrescentada a conferência de que nada sobra no banco.
- `aaa6a71` — evidência real da migração de produção de 2026-09-20 registrada no
  `04.4-11-SUMMARY.md`, com a saída de cada conferência.

Sem código de aplicação alterado; nenhum teste rodado (mudança só de documento). A Fase 04.4
continua aberta: falta a Tarefa 4 do plano 11 (conferência humana e as 8 perguntas).
