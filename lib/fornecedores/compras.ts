// Módulo puro: "Compras dele" na ficha do fornecedor (06.2-11-PLAN.md; FRN-13, D-03, UI-D12, UI-D13).
// Sem React, sem Next, sem banco, sem relógio: recebe os documentos e as linhas que
// `comprasDoFornecedor` (lib/fornecedores/consultas.ts) leu e o "hoje" civil de Brasília por
// parâmetro. Importa só de `lib/financeiro/documento.ts`, que também é puro — o título, o nome de cada
// linha e o valor saem da MESMA regra que o Caixa e o extrato usam: nenhum número novo no Financeiro.
//
// D-03: a lista traz todas as despesas não canceladas (o filtro de cancelada é da consulta), mais
// recentes primeiro; o total e o N contam só as do ano de `hoje` (UI-D13). O ano sai de
// `hoje.slice(0, 4)` — nunca de um instante, que em UTC vira o ano às 21h de 31/12.
import { nomeDaLinha, tituloDoDocumento, totalDasLinhas } from "@/lib/financeiro/documento";

// UI-D12: a ficha mostra as 10 mais recentes e "Mostrar as outras {N}".
export const COMPRAS_A_MOSTRAR = 10;

// Um documento de despesa ligado ao fornecedor, como a consulta o entrega: `data` é o dia civil
// "YYYY-MM-DD"; `criadoEm` é o instante em ISO 8601 (só para o desempate).
export type DocumentoDaCompra = {
  id: string;
  data: string;
  titulo: string | null;
  criadoEm: string;
};

// Uma linha de um desses documentos, na ordem em que o Financeiro a grava. `itemId` presente = linha de
// material (compra); `quantidadeEstoque`/`unidade` são as da compra ("× 10 kg").
export type LinhaDaCompra = {
  documentoId: string;
  nome: string;
  quantidade: number;
  quantidadeEstoque: string | null;
  unidade: string | null;
  itemId: string | null;
  valorCentavos: number;
};

export type TipoDaCompra = "compra" | "outra";

export type CompraDele = {
  id: string;
  data: string;
  titulo: string;
  tipo: TipoDaCompra;
  // Os materiais (só linhas de item), por `nomeDaLinha`; vazio em "Outra despesa".
  itens: string[];
  // `totalDasLinhas` do documento — o valor que o Financeiro já mostra (aceita a linha de diferença).
  valorCentavos: number;
};

export type TotalDoAno = {
  ano: string;
  // Centavos inteiros; formatado em R$ só na tela.
  centavos: number;
  quantidade: number;
};

export type ComprasDele = {
  compras: CompraDele[];
  totalDoAno: TotalDoAno;
};

// Mais recentes primeiro: a data da despesa (dia civil, comparável como texto), depois o `criado_em`
// (instante, comparado como número), depois o id — a resposta não depende da ordem de entrada.
function compararMaisRecentePrimeiro(a: DocumentoDaCompra, b: DocumentoDaCompra): number {
  if (a.data !== b.data) {
    return a.data < b.data ? 1 : -1;
  }
  const criadoA = Date.parse(a.criadoEm);
  const criadoB = Date.parse(b.criadoEm);
  if (criadoA !== criadoB) {
    return criadoA < criadoB ? 1 : -1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? 1 : -1;
}

export function montarComprasDele({
  documentos,
  linhas,
  hoje,
}: {
  documentos: readonly DocumentoDaCompra[];
  linhas: readonly LinhaDaCompra[];
  hoje: string;
}): ComprasDele {
  const linhasPorDocumento = new Map<string, LinhaDaCompra[]>();
  for (const linha of linhas) {
    const lista = linhasPorDocumento.get(linha.documentoId) ?? [];
    lista.push(linha);
    linhasPorDocumento.set(linha.documentoId, lista);
  }

  const ano = hoje.slice(0, 4);
  let centavos = 0;
  let quantidade = 0;

  const compras = [...documentos].sort(compararMaisRecentePrimeiro).map((documento): CompraDele => {
    const dasLinhas = linhasPorDocumento.get(documento.id) ?? [];
    const paraOTitulo = dasLinhas.map((linha) => ({
      nome: linha.nome,
      quantidade: linha.quantidade,
      quantidadeEstoque: linha.quantidadeEstoque,
      unidade: linha.unidade,
    }));
    const deItem = dasLinhas.filter((linha) => linha.itemId !== null);
    const valorCentavos = totalDasLinhas(dasLinhas);
    if (documento.data.slice(0, 4) === ano) {
      centavos += valorCentavos;
      quantidade += 1;
    }
    return {
      id: documento.id,
      data: documento.data,
      titulo: tituloDoDocumento({ titulo: documento.titulo, linhas: paraOTitulo }),
      tipo: deItem.length > 0 ? "compra" : "outra",
      itens: deItem.map((linha) =>
        nomeDaLinha({
          nome: linha.nome,
          quantidade: linha.quantidade,
          quantidadeEstoque: linha.quantidadeEstoque,
          unidade: linha.unidade,
        }),
      ),
      valorCentavos,
    };
  });

  return { compras, totalDoAno: { ano, centavos, quantidade } };
}
