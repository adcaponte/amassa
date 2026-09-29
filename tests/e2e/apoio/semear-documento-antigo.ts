// Auxiliar de teste do Estoque (plano 06-03, EST-17/D-05): o retrato de uma venda lançada ANTES de
// o Estoque existir — um documento de venda com uma linha de ITEM e a parcela paga, inserido direto
// no banco de teste, SEM nenhuma movimentação no livro. É exatamente o que a produção terá quando a
// `0023` for aplicada: todas as vendas antigas sem baixa. Cancelar uma delas não pode inventar
// estorno nenhum.
//
// Mesmo molde de `semear-conta-a-pagar.ts`: uma transação, documento → linha → parcela, com a soma
// das parcelas igual à das linhas (a restrição adiada `conferir_soma_do_documento()` confere no
// `commit`). Nomes inventados; nenhum dado real.
import { Client } from "pg";

import { buscarCategoriaPorNome, hojeNoAtelie } from "./semear-financeiro";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export type VendaAntigaParaSemear = {
  itemId: string;
  // Nome exato de uma categoria de VENDA da semente 0016 (ex.: "Peças prontas").
  categoria: string;
  quantidade: number;
  valorCentavos: number;
  // O texto da linha — quem chama embute "[e2e] … {sufixo}" para achar a venda no extrato.
  descricao: string;
};

// Devolve o id e o número do documento.
export async function semearVendaSemMovimentacao(
  dados: VendaAntigaParaSemear,
): Promise<{ documentoId: string; numero: number }> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error("semearVendaSemMovimentacao: a variável E2E_EMAIL_TESTE não está definida.");
  }
  const categoriaId = await buscarCategoriaPorNome(dados.categoria);
  const hoje = hojeNoAtelie();

  return comCliente(async (cliente) => {
    const usuario = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1) limit 1",
      [email],
    );
    const criadoPor = usuario.rows[0]?.id;
    if (!criadoPor) {
      throw new Error(`semearVendaSemMovimentacao: nenhum usuário com o e-mail "${email}".`);
    }

    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string; numero: number }>(
        `insert into documentos (tipo, data, criado_por)
         values ('venda'::tipo_documento, $1, $2)
         returning id, numero`,
        [hoje, criadoPor],
      );
      const documento = rows[0];

      await cliente.query(
        `insert into documento_linhas
           (documento_id, ordem, item_id, descricao, categoria_id, quantidade, valor_centavos)
         values ($1, 0, $2, $3, $4, $5, $6)`,
        [documento.id, dados.itemId, dados.descricao, categoriaId, dados.quantidade, dados.valorCentavos],
      );

      await cliente.query(
        `insert into parcelas
           (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
         values ($1, 1, $2, $3, 'dinheiro'::forma_pagamento, $2, $4)`,
        [documento.id, hoje, dados.valorCentavos, criadoPor],
      );

      await cliente.query("commit");
      return { documentoId: documento.id, numero: Number(documento.numero) };
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}
