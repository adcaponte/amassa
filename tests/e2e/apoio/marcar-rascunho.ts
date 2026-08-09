// Auxiliar de teste: grava `status = 'rascunho'` direto no banco de teste, pelo cliente `pg`
// (o mesmo pacote de `db/index.ts`) — mesmo padrão de `tests/e2e/apoio/alternar-ativo.ts`.
// Existe porque NENHUM caminho de escrita da fase 03 alcança `rascunho` (só `criarEncomenda`
// grava, sempre em `em_producao` por padrão do schema; nenhum formulário expõe um campo de
// status) — gap arquitetural pré-existente, já registrado em `03-04-SUMMARY.md` ("Known
// Stubs", coverage D11/D12) e `03-CONTEXT.md` ("o tratamento visual exato do rascunho...").
// Sem este auxiliar, o sufixo " (rascunho)" da folha impressa (plano 08) não teria como ser
// provado com dado real — só por leitura de código, como o Gantt/cartão já ficaram até aqui.
import { Client } from "pg";

export async function marcarComoRascunho(id: string): Promise<void> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await cliente.query(`update encomendas set status = 'rascunho' where id = $1`, [id]);
  } finally {
    await cliente.end();
  }
}
