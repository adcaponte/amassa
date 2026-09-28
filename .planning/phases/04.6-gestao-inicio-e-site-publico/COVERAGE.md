# API Coverage — Fase 04.6

No external API integration: a fase move rotas do próprio Next.js, publica uma página estática e
lê os módulos internos do projeto — os links de WhatsApp são URLs `https://wa.me/...` montadas por
um helper puro (nenhum cliente de API, nenhuma chave, nenhuma resposta a interpretar), o embed do
mapa é um `iframe`/link do Google Maps sem chamada autenticada, e `/api/health` é rota deste
próprio repositório.

**Como esta declaração foi decidida:** o detector determinístico
(`gsd-core/bin/lib/api-coverage.cjs --json`) foi executado em 2026-09-28 sobre o escopo da fase
(`04.6-CONTEXT.md` + a seção `### Phase 04.6` do `ROADMAP.md`) e devolveu
`{"detected":false,"signals":[]}`. A declaração fica registrada mesmo assim porque o portão de
selagem reexecuta o detector sobre o corpo dos PLAN.md — e o corpo deles fala de `/api/health`,
`/gestao/api/orcamentos/...` e `wa.me`. Sem esta declaração, um falso positivo do detector
bloquearia a selagem por uma matriz de capacidade que não tem o que descrever.
