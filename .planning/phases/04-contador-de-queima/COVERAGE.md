# Phase 4 — API Coverage Declaration

No external API integration: esta fase é CRUD interno mais agregação e gráficos sobre o Postgres do
próprio projeto — nenhum serviço, SDK ou endpoint de terceiro é chamado em nenhum dos sete planos.

**Por que este arquivo existe.** O detector de cobertura de API pode disparar por causa de
`recharts`, a única dependência npm nova da fase (plano `04-06`). Recharts é uma **biblioteca de
renderização** que roda dentro do navegador; não é um serviço externo, não tem chave, não tem
endpoint e não constitui integração de API. Nenhuma matriz de cobertura foi fabricada.

**Superfícies externas do projeto, para contraste** (todas anteriores a esta fase e fora do escopo
dela): o armazenamento externo de backup (BKP-02), o monitor externo de `/api/health/backup`
(BKP-04) e o registro de contêineres GHCR usado pelo pipeline. Nenhuma delas é tocada aqui.

*Declarado durante o planejamento da Fase 4 — Contador de Queima.*
