---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1
current_phase_name: Fundação e Primeiro Deploy
status: executing
stopped_at: Completed 01-03-PLAN.md
last_updated: "2026-08-06T17:38:17.190Z"
last_activity: 2026-08-05
last_activity_desc: ROADMAP.md criado a partir de `amassa-plataforma/03-ROADMAP.md`, mapeando 99/99 requisitos v1 em 7 fases (M0, M1, M2, M4, M3, M5, M7 — M6 excluída por bloqueio de informação)
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 7
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05)

**Core value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.
**Current focus:** Phase 1 — Fundação e Primeiro Deploy

## Current Position

Phase: 1 of 7 (Fundação e Primeiro Deploy)
Plan: 2 of 7 in current phase
Status: Ready to execute
Last activity: 2026-08-05 — ROADMAP.md criado a partir de `amassa-plataforma/03-ROADMAP.md`, mapeando 99/99 requisitos v1 em 7 fases (M0, M1, M2, M4, M3, M5, M7 — M6 excluída por bloqueio de informação)

Progress: [███░░░░░░░] 29%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 45min | 2 tasks | 26 files |
| Phase 01 P03 | 45min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: ordem de execução M0→M1→M2→**M4**→M3→M5→M7 preservada do documento fonte (Fornos antecipado por ser o menor módulo e o fluxo mais usado; Agenda deslocada por ser a mais complexa)
- Roadmap: backup automático (BKP-01..07) mapeado para a Fase 2 (M1), não para a fase de polimento final — é a única rede de proteção sem serviço gerenciado
- Roadmap: M6 (Calculadora de Orçamento) excluída do roadmap ativo — bloqueada por planilhas de precificação ausentes; requisitos ORC-01..05 vivem em REQUIREMENTS.md v2
- Roadmap: M0 e M1 mantidas como fases separadas (não fundidas) — decisão estrutural do documento fonte para isolar toda a dor de infraestrutura antes dos módulos de produto
- [Phase ?]: FRASE_NO_AR vive em app/frase-no-ar.ts (nao em app/page.tsx) porque o Next.js 15 rejeita exports extras em arquivos de pagina
- [Phase ?]: db/migrate.ts e drizzle.config.ts carregam .env.local via process.loadEnvFile() quando o arquivo existe, ja que scripts soltos nao herdam o .env do runtime do Next.js
- [Phase ?]: node:24.19.0-alpine fixado como imagem base do Dockerfile — mesma versao exata do Node local, confirmado por digest identico ao de node:24-alpine
- [Phase ?]: NPM_CONFIG_OFFLINE=true na imagem app — garante que a falha do drizzle-kit na imagem de producao seja deterministica mesmo com rede disponivel no container

### Pending Todos

None yet.

### Blockers/Concerns

- M6 (Calculadora de Orçamento) permanece bloqueada até as planilhas de precificação do Theo existirem. Não afeta a Fase 7 (Polimento), que não depende de M6.
- Fonte de títulos (Vinila Condensed vs. Archivo Narrow) é decisão pendente do Theo — usar Archivo Narrow até lá (ver `04-DESIGN-SYSTEM.md`).
- Lista real de materiais do ateliê precisa ser levantada durante a Fase 6 (Estoque), senão o módulo nasce vazio.
- Pré-requisitos de conta (domínio, VPS Contabo, GitHub, armazenamento externo de backup) precisam existir antes de a Fase 1 poder começar de fato.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Calculadora de Orçamento (M6) — ORC-01..05 | Bloqueado (planilhas de precificação) | Definição do roadmap |
| v2 | Financeiro da Escola — FIN-01, FIN-02 | Adiado conscientemente | Definição do roadmap |
| v2 | Integração Encomenda↔Queima (INT-01), Módulo Experiências (INT-02) | Adiado conscientemente | Definição do roadmap |

## Session Continuity

Last session: 2026-08-06T17:38:17.169Z
Stopped at: Completed 01-03-PLAN.md
Resume file: None
