// Auxiliar de teste: liga e desliga a coluna `ativo` de um e-mail direto no banco de teste,
// pelo cliente `pg` que o projeto já usa (o mesmo pacote de `db/index.ts`). SEMPRE
// ATUALIZA, nunca apaga — apagar quebraria o histórico de autoria, que é a própria razão de
// a coluna `ativo` existir em vez de um `DELETE` (AUTH-09, provado também em
// `tests/unit/auth-borda.test.ts`).
import { Client } from "pg";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export async function alternarAtivo(email: string, ativo: boolean): Promise<void> {
  await comCliente((cliente) =>
    cliente.query(`update usuarios set ativo = $1 where lower(email) = lower($2)`, [ativo, email]),
  );
}

// Usado pela prova em par de AUTH-09 (tests/e2e/sessao.spec.ts): confirma que a linha
// continua existindo depois de desativar — o oposto de apagar. Uma afirmação sozinha ("o
// acesso caiu") é ambígua; esta, ao lado dela, localiza a causa.
export async function usuarioExiste(email: string): Promise<boolean> {
  const linhas = await comCliente((cliente) =>
    cliente.query(`select 1 from usuarios where lower(email) = lower($1)`, [email]),
  );
  return (linhas.rowCount ?? 0) > 0;
}
