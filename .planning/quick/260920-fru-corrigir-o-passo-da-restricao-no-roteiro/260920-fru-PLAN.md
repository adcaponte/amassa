---
quick_id: 260920-fru
description: Corrigir o passo da restrição no Roteiro 10 e registrar a evidência da migração de produção
mode: quick
---

# Quick 260920-fru — Roteiro 10: passo da restrição e evidência da migração

Executado inline: são duas edições de documento, feitas com o dono na linha, durante a própria
migração de produção.

## Tarefa 1 — Corrigir o passo da restrição no Roteiro 10
- files: `docs/operacao/10-migracao-financeiro.md`
- problema: o comando usava `returning id \gset`, e `\gset` é meta-comando do `psql` — não funciona
  com `-c`. Além disso o texto dizia que o erro apareceria no `rollback`; o `check` de valor da
  parcela é imediato, não adiado.
- action: trocar pelo comando com `with ... returning` (roda igual em `-c` e em sessão interativa),
  corrigir a descrição do que esperar e acrescentar a conferência de que nada sobrou.
- done: commit `docs(operacao)`.

## Tarefa 2 — Registrar a evidência da Tarefa 3 do plano 04.4-11
- files: `.planning/phases/04.4-financeiro-parte-1/04.4-11-SUMMARY.md`
- action: registrar a saída real da conferência em produção (2026-09-20) — 8 tabelas, 8 gatilhos de
  `atualizado_em`, travas de soma e de categoria, 5 tipos, 24 categorias com 1 de diferença,
  privilégios de `delete` como esperado, e a recusa da parcela de valor zero.
- done: commit `docs(04.4-11)`.
