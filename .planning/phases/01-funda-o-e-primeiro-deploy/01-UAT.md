---
status: complete
phase: 01-funda-o-e-primeiro-deploy
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md, 01-07-SUMMARY.md]
started: 2026-08-08
updated: 2026-08-08
---

## Current Test

[testing complete]

## Tests

### 1. Nenhum arquivo .env com valores reais no repositório público
expected: `git log --all --full-history -- .env` vazio; `.env` e `.env.local` ausentes da árvore publicada
result: pass
source: automated
coverage_id: D1

### 2. https://amassacerrado.com.br abre com cadeado, sem aviso de segurança
expected: HTTP 200 com handshake TLS sem erro; www redirecionando para o apex
result: pass
source: automated
coverage_id: D2

### 3. Alterar um texto, dar push na main, e a mudança aparecer sozinha
expected: commit alterando FRASE_NO_AR → quatro jobs verdes → frase nova servida em produção sem comando no servidor
result: pass
source: automated
coverage_id: D3

### 4. /api/health responde ok e confirma uma consulta real ao banco
expected: `{"status":"ok","banco":"ok"}` com o banco no ar; 503 com o Postgres parado
result: pass
source: automated
coverage_id: D4

### 5. A porta 5432 do VPS não aceita conexão de fora
expected: 5432 fechada e 443 aberta, vistas de fora do servidor
result: pass
source: automated
coverage_id: D5

### 6. Reiniciar o VPS traz a aplicação de volta sozinha, com os dados intactos
expected: após `sudo reboot`, /api/health volta a ok sem comando manual, e a linha de prova gravada antes do reinício continua no banco
result: pass
source: automated
coverage_id: D6

### 7. O Auto Backup da Contabo aparece ativo no painel
expected: o VPS listado no painel da Contabo com o Auto Backup marcado como ativo
result: pass
reported: "sim"
source: human
coverage_id: D7
nota: "Confirmado pelo dono. Ressalva registrada: havia um incidente aberto na Contabo (backups atrasados, restores temporariamente indisponíveis) no momento da execução. Camada ativa no papel e degradada na prática — reconferir no início da Fase 2, antes de qualquer dado real do ateliê entrar no sistema."

### 8. Um deploy não recria o container do Postgres
expected: `docker compose ps -q postgres` com o mesmo identificador antes e depois de publicações consecutivas
result: pass
source: automated
coverage_id: D8

### 9. Um deploy com teste quebrado é barrado pelo pipeline e não vai ao ar
expected: um job de teste falhando interrompe a cadeia antes da publicação da imagem
result: pass
source: automated
coverage_id: D9

### 10. Migrações podem ser aplicadas à mão no servidor, fora do pipeline
expected: `docker compose run --rm ferramentas npm run db:migrate` funciona; nenhuma migração roda no pipeline
result: pass
source: automated
coverage_id: D10

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[nenhuma]

## Deferred Follow-Ups

- test: 7
  idea: "Reconferir o Auto Backup da Contabo no início da Fase 2 — havia um incidente aberto com restores indisponíveis. Hoje é a única camada de proteção existente, e a Fase 2 é quem constrói as outras três (dump diário, cópia externa, retenção mensal)."
  deferred_at: 2026-08-08
- test: 7
  idea: "Criar a conta de armazenamento externo (Google Drive, decisão D-01) antes da Fase 2 — é pré-requisito do backup, não desta fase."
  deferred_at: 2026-08-08
