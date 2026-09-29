// Auxiliar de teste do Estoque (Fase 06): semeia materiais e LÊ o livro direto do banco de teste,
// pelo cliente `pg` — mesmo molde de `tests/e2e/apoio/semear-financeiro.ts`, cujo `semearItem` é
// reusado (o material É um item do catálogo com estoque próprio — D-01; não existe tabela de
// materiais). Nomes sempre inventados, com prefixo `[e2e]` — nenhum dado real no repositório.
//
// Este auxiliar NUNCA grava em `movimentacoes_estoque`: o livro só se escreve pela tela (a porta
// única `lib/estoque/gravacao.ts`). Aqui só se lê, para o teste conferir o que ficou gravado.
import { Client } from "pg";

import { semearItem } from "./semear-financeiro";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export type MaterialParaSemear = {
  nome: string;
  unidade: "un" | "g" | "kg" | "ml" | "l" | "m";
  // Nome exato de uma categoria de COMPRA da semente 0016 (ex.: "Argila, esmalte e insumos").
  categoriaCompra: string;
  minimoMilesimos?: number;
};

// Um material: controla estoque, não aparece na venda. Devolve o id do item.
export async function semearMaterial(dados: MaterialParaSemear): Promise<string> {
  const id = await semearItem({
    nome: dados.nome,
    apareceNaVenda: false,
    atalhoVenda: false,
    controlaEstoque: true,
    unidade: dados.unidade,
    categoriaCompra: dados.categoriaCompra,
    atalhoCompra: false,
  });

  if (dados.minimoMilesimos !== undefined) {
    await comCliente((cliente) =>
      cliente.query("update itens_catalogo set estoque_minimo_milesimos = $1 where id = $2", [
        dados.minimoMilesimos,
        id,
      ]),
    );
  }
  return id;
}

export type MovimentacaoNoBanco = {
  id: string;
  numero: number;
  origem: string;
  tipo: string;
  destino: string | null;
  area: string | null;
  quantidadeMilesimos: number;
  valorCentavos: number;
  valorInformadoCentavos: number | null;
  // Vínculos com o Financeiro (plano 06-03): venda e compra apontam o documento e a linha; o
  // estorno aponta a movimentação que ele espelha.
  documentoId: string | null;
  documentoLinhaId: string | null;
  estornoDeId: string | null;
};

// As linhas do livro de um item, na ORDEM DO LIVRO (`numero`, nunca `criado_em`). `bigint` volta
// como texto do `pg` — convertido aqui.
export async function movimentacoesDoItem(itemId: string): Promise<MovimentacaoNoBanco[]> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{
      id: string;
      numero: string;
      origem: string;
      tipo: string;
      destino: string | null;
      area: string | null;
      quantidade_milesimos: string;
      valor_centavos: string;
      valor_informado_centavos: string | null;
      documento_id: string | null;
      documento_linha_id: string | null;
      estorno_de_id: string | null;
    }>(
      `select id, numero, origem, tipo, destino, area, quantidade_milesimos, valor_centavos,
              valor_informado_centavos, documento_id, documento_linha_id, estorno_de_id
         from movimentacoes_estoque
        where item_id = $1
        order by numero`,
      [itemId],
    );
    return resultado.rows.map((linha) => ({
      id: linha.id,
      numero: Number(linha.numero),
      origem: linha.origem,
      tipo: linha.tipo,
      destino: linha.destino,
      area: linha.area,
      quantidadeMilesimos: Number(linha.quantidade_milesimos),
      valorCentavos: Number(linha.valor_centavos),
      valorInformadoCentavos:
        linha.valor_informado_centavos === null ? null : Number(linha.valor_informado_centavos),
      documentoId: linha.documento_id,
      documentoLinhaId: linha.documento_linha_id,
      estornoDeId: linha.estorno_de_id,
    }));
  });
}

// O saldo do item pela MESMA regra da aplicação: a soma do livro.
export async function saldoNoBanco(itemId: string): Promise<number> {
  return comCliente(async (cliente) => {
    const resultado = await cliente.query<{ saldo: string }>(
      "select coalesce(sum(quantidade_milesimos), 0) as saldo from movimentacoes_estoque where item_id = $1",
      [itemId],
    );
    return Number(resultado.rows[0]?.saldo ?? 0);
  });
}

// Desativa um material direto no banco de teste — SÓ para montar o cenário do filtro
// "Desativados" (plano 06-04). A ação de desativar de verdade, com a confirmação da UI-SPEC, é do
// plano 06-08; este auxiliar não a substitui nem a prova.
export async function desativarNoBanco(itemId: string): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update itens_catalogo set ativo = false where id = $1", [itemId]),
  );
}
