// Módulo puro: serializa/lê o rascunho do carrinho de Venda (e, mais adiante, de Despesa) para o
// armazenamento por aba do navegador — "o que foi montado no carrinho sobrevive a trocar de aba
// e voltar, e a recarregar a página, na mesma aba do navegador" (must_haves do plano). O ACESSO
// ao armazenamento em si fica no componente (`painel-venda.tsx`); este módulo só transforma
// texto em dado e dado em texto, sem nunca lançar exceção — texto corrompido, de outra versão ou
// com formato errado vira sempre o rascunho VAZIO, nunca uma tela quebrada.
export const CHAVE_RASCUNHO_VENDA = "amassa-financeiro-rascunho-venda";
export const CHAVE_RASCUNHO_DESPESA = "amassa-financeiro-rascunho-despesa";

const VERSAO_RASCUNHO = 1;

export type LinhaDoRascunho =
  | { tipo: "item"; itemId: string; quantidade: number; valorUnitarioTexto: string }
  | { tipo: "livre"; descricao: string; categoriaId: string; valorTexto: string };

export type DescontoDoRascunho = { modo: "reais" | "percentual"; texto: string } | null;

export type RascunhoDeVenda = {
  data: string;
  pessoa: string;
  linhas: LinhaDoRascunho[];
  desconto: DescontoDoRascunho;
};

const RASCUNHO_VAZIO: RascunhoDeVenda = { data: "", pessoa: "", linhas: [], desconto: null };

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function linhaDeItemValida(valor: unknown): valor is Extract<LinhaDoRascunho, { tipo: "item" }> {
  return (
    ehRegistro(valor) &&
    valor.tipo === "item" &&
    typeof valor.itemId === "string" &&
    typeof valor.quantidade === "number" &&
    Number.isInteger(valor.quantidade) &&
    valor.quantidade >= 1 &&
    typeof valor.valorUnitarioTexto === "string"
  );
}

function linhaLivreValida(valor: unknown): valor is Extract<LinhaDoRascunho, { tipo: "livre" }> {
  return (
    ehRegistro(valor) &&
    valor.tipo === "livre" &&
    typeof valor.descricao === "string" &&
    typeof valor.categoriaId === "string" &&
    typeof valor.valorTexto === "string"
  );
}

function linhaValida(valor: unknown): valor is LinhaDoRascunho {
  return linhaDeItemValida(valor) || linhaLivreValida(valor);
}

function descontoValido(valor: unknown): valor is DescontoDoRascunho {
  if (valor === null || valor === undefined) {
    return true;
  }
  return (
    ehRegistro(valor) &&
    (valor.modo === "reais" || valor.modo === "percentual") &&
    typeof valor.texto === "string"
  );
}

// Ida e volta do mesmo objeto — a versão é gravada JUNTO, nunca lida de um lugar separado.
export function serializarRascunho(rascunho: RascunhoDeVenda): string {
  return JSON.stringify({ versao: VERSAO_RASCUNHO, ...rascunho });
}

// `idsDeItensExistentes` é o catálogo carregado NA HORA da leitura — uma linha de item que não
// existe mais nesse catálogo é descartada, nunca mantida com um id órfão.
export function lerRascunho(
  texto: string,
  idsDeItensExistentes: readonly string[],
): RascunhoDeVenda {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return RASCUNHO_VAZIO;
  }

  if (!ehRegistro(dados) || dados.versao !== VERSAO_RASCUNHO) {
    return RASCUNHO_VAZIO;
  }

  const idsValidos = new Set(idsDeItensExistentes);
  const linhasBrutas = Array.isArray(dados.linhas) ? dados.linhas : [];
  const linhas = linhasBrutas
    .filter(linhaValida)
    .filter((linha) => linha.tipo !== "item" || idsValidos.has(linha.itemId));

  const desconto = descontoValido(dados.desconto) ? dados.desconto : null;

  return {
    data: typeof dados.data === "string" ? dados.data : "",
    pessoa: typeof dados.pessoa === "string" ? dados.pessoa : "",
    linhas,
    desconto: desconto ?? null,
  };
}
