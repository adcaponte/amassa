# Fase 06.2 — itens adiados (fora do escopo dos planos)

## 06.2-01 (03/10/2026, madrugada UTC)

- **`orcamento_fotos_arquivo_formato` (0017) perdeu a barra invertida do regex.** Em `db/schema.ts`
  o check escreve `\.jpg$` dentro de um template literal do `sql`, e o JavaScript entrega `.jpg$`
  (o `\.` vira `.`). A migração aplicada tem
  `'^[0-9a-f]{8}-…-[0-9a-f]{12}.jpg$'` (`db/migrations/0017_precificacao-e-orcamentos.sql:64`) —
  o ponto casa com qualquer caractere. A porta da travessia de caminho continua fechada (o uuid
  ancorado e o fim `jpg$` não deixam `/` nem `..` entrar), então é aperto, não brecha. Como sei:
  `grep -n "orcamento_fotos_arquivo_formato" db/migrations/0017_precificacao-e-orcamentos.sql`.
  A 0028 escreve `\\.` no `db/schema.ts` e saiu certo (`\.`). Corrigir a 0017 exige uma migração
  nova (a 0017 já está aplicada e é intocável) — tarefa `/gsd-quick` separada, se o dono quiser.
