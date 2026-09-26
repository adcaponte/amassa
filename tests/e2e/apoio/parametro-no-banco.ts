// Auxiliar de teste de `precificacao-parametros.spec.ts`: uma leitura DIRETA no banco de teste
// (cliente `pg` cru, mesmo padrão de `tests/e2e/apoio/semear-conta-fixa.ts`/
// `tests/e2e/apoio/semear-financeiro.ts` — nunca `@/db`/Drizzle, que nenhum spec desta suíte
// importa) — prova D-15 (mudar o valor de um parâmetro cria linha nova, nunca sobrescreve) sem
// depender de uma tela de histórico que não existe nesta fase. É a "segunda leitura" que o plano
// permite como alternativa a uma verificação só pela interface.
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

// Quantas linhas de HISTÓRICO uma chave de parâmetro tem, direto no banco.
export async function contarHistoricoDoParametro(chave: string): Promise<number> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ total: string }>(
      "select count(*)::text as total from parametros_precificacao where chave = $1",
      [chave],
    );
    return Number(resultado.rows[0]?.total ?? 0);
  });
}

// Insere uma linha de história ANTIGA (dias atrás), direto no banco — simula o "seed aplicado no
// passado" que D-15 pressupõe. O banco de teste é EFÊMERO e as migrações rodam no MESMO dia da
// suíte (a semente da 0019 grava `current_date`, que é HOJE aqui) — sem isto, editar um parâmetro
// pela tela sempre cairia no caminho "duas edições no mesmo dia" (on conflict do update da MESMA
// linha), e o teste nunca veria as "duas entradas" que o must_have descreve. `on conflict do
// nothing`: idempotente, nunca duplica se a linha já existir.
export async function inserirLinhaAntigaDoParametro(dados: {
  chave: string;
  valorInteiro: number;
  diasAtras: number;
}): Promise<void> {
  await comCliente(async (cliente) => {
    await cliente.query(
      `insert into parametros_precificacao (chave, valor_inteiro, medido, vigente_desde)
       values ($1, $2, false, current_date - $3::int)
       on conflict (chave, vigente_desde) do nothing`,
      [dados.chave, dados.valorInteiro, dados.diasAtras],
    );
  });
}

// O valor da linha ANTIGA, direto no banco — prova que ela continua intacta (D-15) depois de uma
// edição feita hoje pela tela.
export async function valorDoParametroNaData(chave: string, diasAtras: number): Promise<number | null> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ valor_inteiro: number }>(
      `select valor_inteiro from parametros_precificacao
       where chave = $1 and vigente_desde = current_date - $2::int`,
      [chave, diasAtras],
    );
    return resultado.rows[0]?.valor_inteiro ?? null;
  });
}
