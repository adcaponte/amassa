---
phase: 05-agenda
plan: 16
subsystem: agenda
status: complete
tags: [agenda, portao, health, roteiro-17, migracao-0026, verificacao-humana, d-15]
requires:
  - "05-01..05-15: todo o código da fase; a 0026 escrita e provada no Postgres efêmero"
provides:
  - "app/api/health/agenda/route.ts (Tarefa 1, f82261f): GET público, 200 {status:ok} só com a estrutura da Agenda no banco"
  - "docs/operacao/17-migracao-agenda.md (Tarefa 1): o Roteiro 17 na ordem da D-15"
  - ".planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md (Tarefa 1; Parte 0 respondida em 29ab8de)"
  - "Tarefa 3: o portão do dono — aprovado em 03/10/2026"
affects:
  - "AGE-01..AGE-20 marcados em REQUIREMENTS.md; 05-16 [x] e a Fase 5 16/16 no ROADMAP"
  - "a 0027 (quick 261002-sdt, dispensa do uso livre) continua fora do ar: sai com o Roteiro 19 (Roteiro 18 de carona)"
metrics:
  completed: 2026-10-03
  tasks: "3 de 3 (a 3 é do dono)"
---

# Phase 5 Plan 16: O portão da Agenda — aprovado pelo dono — Summary

**A Fase 5 passou no portão do dono em 03/10/2026.** As Tarefas 1 e 2 foram feitas pelo executor em 02/10/2026
(commit `f82261f` e seguintes, no branch `gsd/phase-05-agenda`, depois publicado); a Tarefa 3 — Parte 0, Roteiro
17 e a caminhada no celular — foi feita pelo dono e aprovada no chat.

## Tarefa 3 — o que o dono disse, e só isso

No chat de **03/10/2026, ~10–11h de Brasília**, o Theo escreveu: *"1 - finalizei a verificação humana da
agenda."* É a aprovação da Tarefa 3 (Parte 2 de `05-VERIFICACAO-HUMANA.md`).

**O que ele NÃO deu, e por isso não está registrado:**
- nenhuma anotação por item da Parte 2 (critérios B.1–B.9, D.0, D.1–D.53): as caixas de
  `05-VERIFICACAO-HUMANA.md` não foram preenchidas por ele e este SUMMARY não as preenche;
- nenhum tempo de cronômetro nem contagem de toques do **C.1** (presença da turma inteira). O critério de
  aceite "os toques e o tempo da presença de uma turma inteira estão anotados" fica **sem o número**; vale a
  palavra do dono de que a caminhada foi feita. Não inventamos o tempo.

O mesmo padrão da Fase 6 (29/09: "repassei toda verificação… Aprovado.", sem anotação por item nem os tempos).

## Evidência independente da palavra do dono

- **Parte 0 respondida** pelo dono em 02/10/2026 (`29ab8de`).
- **Roteiro 17 feito em 02/10/2026** (registrado no topo de `05-VERIFICACAO-HUMANA.md`, ~14h30 UTC de 02/10):
  código no ar pelo run `36959745229` (implantar 03:46 UTC), **`0026` aplicada pelo dono** (~10h30 UTC),
  `/api/health/agenda` 200 `{"status":"ok"}` — a rota faz `select` das estruturas da `0026` e devolveria 503
  sem elas.
- **Correções da revisão de código no ar:** run `37013475323` (sha `1102e05`, criado 13:30 UTC de 02/10,
  `success` — conferido com `gh run view` em 03/10/2026).
- **`eac0203` no ar** (quick `261002-sdt`: caixa "Mostrar no calendário público" desmarcada por padrão e
  confirmação do lote): run `37061857675` (push em `main`, sha `eac0203`, criado 20:38 UTC de 02/10, `success`,
  conferido com `gh run view` em 03/10/2026); `git ls-remote origin main` = `eac0203…` (medido em 03/10/2026).
- **Caminhada independente do Cowork em produção:** `Claude outputs/agenda/VERIFICACAO-COWORK-05.md` — 02/10/2026,
  09h15–09h55 de Brasília, sobre `9b640e2` com a `0026` aplicada: estático verde num clone limpo (lint, tsc,
  `verificar-acoes` 114 ações, `npm test` 2287 testes, `test:migracoes`), e **22 passos online sem nenhum 🔴**,
  cobrindo os 9 critérios do ROADMAP (inclusive "Recebi agora" no Caixa, o lote, "Lançar na Venda", a venda
  cancelada que volta, uso livre com baixa no Estoque, lista cheia que só avisa, site sem nome, desativar e
  cancelar sem apagar, 320 px sem rolagem lateral).

## O que fica pendente (fora deste plano)

- **A `0027` (quick `261002-sdt`, "Dispensar" do uso livre) NÃO está no ar.** Os commits `c008b1d` (a
  migração), `534afd2` (a tela e o Roteiro 18) e os de docs estão no `main` local, depois de `eac0203`; o
  `origin/main` remoto termina em `eac0203` (medido com `git ls-remote` em 03/10/2026). A publicação e o
  `db:migrate` dela são do dono, pelo **Roteiro 19** (que leva o 18 de carona), previsto para 03/10/2026 junto
  com as Fases 06.2 e 06.3. Depois dela, `/api/health/agenda` passa a exigir a `0027`.
- O lado positivo do critério 8 com uma oficina pública **real** no site depende de o ateliê publicar uma —
  não é pendência da fase.
- O dado de teste da caminhada fica em produção pela regra da `0026` (pessoa, turma, matrícula e mensalidade
  não se apagam) — seção E da caminhada.
