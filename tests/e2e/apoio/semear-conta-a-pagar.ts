// Auxiliar de teste do Caixa (04.4-08-PLAN.md): insere um documento com UMA parcela em ABERTO
// direto no banco de teste, pelo cliente `pg` que o projeto já usa (mesmo padrão de
// `tests/e2e/apoio/semear-financeiro.ts`). É o formato mais comum de conta a pagar/receber (uma
// linha, uma parcela) — a compra de 100x/sinal continua sendo lançada PELA TELA quando o teste
// precisa de mais de uma parcela (ex.: o exemplo 5 de despesa do protótipo).
import { Client } from "pg";

import { buscarCategoriaPorNome } from "./semear-financeiro";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// O `criado_por` de todo documento semeado é o GESTOR de `E2E_EMAIL_TESTE` — nunca um usuário
// inventado, mesma disciplina de autoria real usada no resto da suíte.
async function idDoGestorDeTeste(): Promise<string> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error("semearContaAPagar: a variável E2E_EMAIL_TESTE não está definida.");
  }
  const id = await comCliente(async (cliente) => {
    const resultado = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1) limit 1",
      [email],
    );
    return resultado.rows[0]?.id ?? null;
  });
  if (!id) {
    throw new Error(`semearContaAPagar: nenhum usuário com o e-mail "${email}".`);
  }
  return id;
}

export type LinhaParaSemear = { descricao: string; valorCentavos: number; categoria: string };

export type ContaParaSemear = {
  // O TÍTULO explícito do documento (`documentos.titulo`) — quem chama já embute "[e2e] ... "
  // e um sufixo único, mesma disciplina do resto da suíte de e2e do Financeiro.
  titulo: string;
  pessoa?: string;
  // Nome exato da categoria (resolvido por `buscarCategoriaPorNome`) — ignorado quando `linhas`
  // é passado.
  categoria: string;
  valorCentavos: number;
  vencimento: string;
  rotulo?: string;
  // Quando presente, substitui a linha única default por várias linhas (cada uma com a própria
  // categoria) — o total da parcela é a soma delas.
  linhas?: LinhaParaSemear[];
  tipo?: "venda" | "despesa";
};

export async function semearContaAPagar(
  dados: ContaParaSemear,
): Promise<{ documentoId: string; parcelaId: string; numero: number }> {
  const criadoPor = await idDoGestorDeTeste();
  const tipo = dados.tipo ?? "despesa";

  const linhasParaGravar =
    dados.linhas && dados.linhas.length > 0
      ? await Promise.all(
          dados.linhas.map(async (linha) => ({
            descricao: linha.descricao,
            valorCentavos: linha.valorCentavos,
            categoriaId: await buscarCategoriaPorNome(linha.categoria),
          })),
        )
      : [
          {
            descricao: dados.titulo,
            valorCentavos: dados.valorCentavos,
            categoriaId: await buscarCategoriaPorNome(dados.categoria),
          },
        ];

  const totalCentavos = linhasParaGravar.reduce((soma, linha) => soma + linha.valorCentavos, 0);

  return comCliente(async (cliente) => {
    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string; numero: number }>(
        `insert into documentos (tipo, data, pessoa_nome, titulo, criado_por)
         values ($1::tipo_documento, $2, $3, $4, $5)
         returning id, numero`,
        [tipo, dados.vencimento, dados.pessoa ?? null, dados.titulo, criadoPor],
      );
      const documento = rows[0];

      for (let indice = 0; indice < linhasParaGravar.length; indice++) {
        const linha = linhasParaGravar[indice];
        await cliente.query(
          `insert into documento_linhas
             (documento_id, ordem, descricao, categoria_id, quantidade, valor_centavos)
           values ($1, $2, $3, $4, 1, $5)`,
          [documento.id, indice, linha.descricao, linha.categoriaId, linha.valorCentavos],
        );
      }

      const parcelaResultado = await cliente.query<{ id: string }>(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, rotulo)
         values ($1, 1, $2, $3, 'dinheiro'::forma_pagamento, $4)
         returning id`,
        [documento.id, dados.vencimento, totalCentavos, dados.rotulo ?? null],
      );

      await cliente.query("commit");
      return {
        documentoId: documento.id,
        parcelaId: parcelaResultado.rows[0].id,
        numero: documento.numero,
      };
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}
