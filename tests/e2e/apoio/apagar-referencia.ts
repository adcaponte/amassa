// Auxiliar de teste: apaga, direto no banco de teste, a linha referenciada por uma Server
// Action de escrita — cria a corrida real "a linha sumiu entre a montagem do formulário e o
// envio", que nenhum caminho da aplicação consegue produzir sob demanda. É a base da prova e2e
// de que Queimas, Abertura e Cotações mostram a mensagem humana de chave estrangeira em vez da
// frase genérica de falha (lib/erro/postgres.ts).
//
// As três exclusões são possíveis porque nenhuma restrição as impede: `queimas.forno_id` e
// `cotacoes.categoria_id` são `on delete cascade`; `abertura_tarefas.item_id` é
// `on delete set null` (db/schema.ts). O `insert`/`update` posterior, feito pela interface com o
// identificador já apagado em mãos, é quem levanta o SQLSTATE `23503`.
import { Client } from "pg";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  // Nunca `DATABASE_URL`, nunca um fallback para outra variável — apagar linha é destrutivo e o
  // único banco em que isso pode acontecer é o efêmero de teste.
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// Apaga um forno pelo `nome`, filtrando por parâmetro posicional. Falha ALTO se não apagar
// exatamente uma linha — um apagamento silenciosamente vazio deixaria o teste passando pelo
// motivo errado (a mensagem humana não apareceria e não saberíamos por quê).
export async function apagarFornoPeloNome(nome: string): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(`delete from fornos where nome = $1`, [nome]),
  );

  if (resultado.rowCount !== 1) {
    throw new Error(
      `apagarFornoPeloNome: esperava apagar 1 linha da tabela "fornos" com nome "${nome}", ` +
        `mas apagou ${resultado.rowCount}.`,
    );
  }
}

// Apaga um item de abertura pelo `nome`, mesma disciplina de `apagarFornoPeloNome`.
export async function apagarItemDeAberturaPeloNome(nome: string): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(`delete from abertura_itens where nome = $1`, [nome]),
  );

  if (resultado.rowCount !== 1) {
    throw new Error(
      `apagarItemDeAberturaPeloNome: esperava apagar 1 linha da tabela "abertura_itens" com ` +
        `nome "${nome}", mas apagou ${resultado.rowCount}.`,
    );
  }
}

// Apaga uma categoria de cotação pelo `nome`, mesma disciplina de `apagarFornoPeloNome`.
export async function apagarCategoriaDeCotacaoPeloNome(nome: string): Promise<void> {
  const resultado = await comCliente((cliente) =>
    cliente.query(`delete from cotacao_categorias where nome = $1`, [nome]),
  );

  if (resultado.rowCount !== 1) {
    throw new Error(
      `apagarCategoriaDeCotacaoPeloNome: esperava apagar 1 linha da tabela ` +
        `"cotacao_categorias" com nome "${nome}", mas apagou ${resultado.rowCount}.`,
    );
  }
}

// Uma exclusão PRESA, aberta mas ainda não confirmada — molde diferente das três acima porque o
// Financeiro (lib/financeiro/acoes.ts) é diferente dos outros três módulos: `lancarVenda`/
// `lancarDespesa` fazem uma PRÉ-CONFERÊNCIA da categoria (um `select` fresco) ANTES do `insert`.
// Apagar a categoria antes do envio (o mesmo truque de `apagarFornoPeloNome` etc.) nunca alcança
// o backstop de chave estrangeira: a pré-conferência já vê a categoria sumida e devolve a SUA
// PRÓPRIA frase, diferente da de `ehViolacaoDeChaveEstrangeira`. A prova real exige uma corrida
// de verdade — a categoria sumindo DEPOIS da pré-conferência e ANTES do `insert`.
//
// `comecarExclusaoDeCategoria` abre uma transação e executa o `DELETE`, mas NÃO dá `commit`: sob
// MVCC (READ COMMITTED, o padrão do Postgres), uma leitura comum feita por OUTRA sessão — a
// pré-conferência do servidor — nunca enxerga uma exclusão não confirmada, então ela passa
// normalmente. O `insert` seguinte, que precisa de um lock na linha referenciada pela chave
// estrangeira, BLOQUEIA na mesma linha até esta transação terminar (commit ou rollback) — é
// exatamente essa espera que reproduz a janela sem depender de timing best-effort. Quem chama
// isto dispara o envio do formulário e só ENTÃO chama `commitar()`, destravando o `insert`
// bloqueado no instante exato em que ele tentaria gravar — aí sim ele encontra a categoria
// ausente e levanta 23503.
export type ExclusaoPresa = {
  commitar: () => Promise<void>;
  cancelar: () => Promise<void>;
};

export async function comecarExclusaoDeCategoria(id: string): Promise<ExclusaoPresa> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  await cliente.query("begin");

  const resultado = await cliente.query(`delete from categorias where id = $1`, [id]);
  if (resultado.rowCount !== 1) {
    await cliente.query("rollback");
    await cliente.end();
    throw new Error(
      `comecarExclusaoDeCategoria: esperava apagar 1 linha da tabela "categorias" com id ` +
        `"${id}", mas apagou ${resultado.rowCount}.`,
    );
  }

  let concluida = false;
  return {
    commitar: async () => {
      if (concluida) {
        return;
      }
      concluida = true;
      await cliente.query("commit");
      await cliente.end();
    },
    cancelar: async () => {
      if (concluida) {
        return;
      }
      concluida = true;
      await cliente.query("rollback");
      await cliente.end();
    },
  };
}
