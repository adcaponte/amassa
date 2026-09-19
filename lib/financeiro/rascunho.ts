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

// O rascunho da Despesa (04.4-07-PLAN.md): chave PRÓPRIA (`CHAVE_RASCUNHO_DESPESA`, separada da
// Venda), e os DOIS modos vivem lado a lado — "trocar de pílula não perde o que foi digitado no
// outro modo" (must_have do plano) exige guardar `compra` e `outra` ao mesmo tempo, nunca um
// discriminado que descarta o outro ao trocar `modo`.
export type LinhaDeCompraDoRascunho = {
  itemId: string;
  quantidadeEstoqueTexto: string;
  valorTotalTexto: string;
};

export type RascunhoDeDespesa = {
  modo: "compra" | "outra";
  compra: { data: string; pessoa: string; linhas: LinhaDeCompraDoRascunho[] };
  outra: { data: string; pessoa: string; descricao: string; categoriaId: string; valorTexto: string };
};

const RASCUNHO_DESPESA_VAZIO: RascunhoDeDespesa = {
  modo: "compra",
  compra: { data: "", pessoa: "", linhas: [] },
  outra: { data: "", pessoa: "", descricao: "", categoriaId: "", valorTexto: "" },
};

function linhaDeCompraValida(valor: unknown): valor is LinhaDeCompraDoRascunho {
  return (
    ehRegistro(valor) &&
    typeof valor.itemId === "string" &&
    typeof valor.quantidadeEstoqueTexto === "string" &&
    typeof valor.valorTotalTexto === "string"
  );
}

export function serializarRascunhoDespesa(rascunho: RascunhoDeDespesa): string {
  return JSON.stringify({ versao: VERSAO_RASCUNHO, ...rascunho });
}

// `idsDeItensExistentes` é o catálogo de COMPRA carregado na hora da leitura — uma linha de
// material que não existe mais (ou deixou de controlar estoque) é descartada, nunca mantida com
// um id órfão (mesma disciplina de `lerRascunho`).
export function lerRascunhoDespesa(
  texto: string,
  idsDeItensExistentes: readonly string[],
): RascunhoDeDespesa {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return RASCUNHO_DESPESA_VAZIO;
  }

  if (!ehRegistro(dados) || dados.versao !== VERSAO_RASCUNHO) {
    return RASCUNHO_DESPESA_VAZIO;
  }

  const idsValidos = new Set(idsDeItensExistentes);
  const compraBruto = ehRegistro(dados.compra) ? dados.compra : {};
  const linhasBrutas = Array.isArray(compraBruto.linhas) ? compraBruto.linhas : [];
  const linhas = linhasBrutas
    .filter(linhaDeCompraValida)
    .filter((linha) => idsValidos.has(linha.itemId));

  const outraBruto = ehRegistro(dados.outra) ? dados.outra : {};

  return {
    modo: dados.modo === "outra" ? "outra" : "compra",
    compra: {
      data: typeof compraBruto.data === "string" ? compraBruto.data : "",
      pessoa: typeof compraBruto.pessoa === "string" ? compraBruto.pessoa : "",
      linhas,
    },
    outra: {
      data: typeof outraBruto.data === "string" ? outraBruto.data : "",
      pessoa: typeof outraBruto.pessoa === "string" ? outraBruto.pessoa : "",
      descricao: typeof outraBruto.descricao === "string" ? outraBruto.descricao : "",
      categoriaId: typeof outraBruto.categoriaId === "string" ? outraBruto.categoriaId : "",
      valorTexto: typeof outraBruto.valorTexto === "string" ? outraBruto.valorTexto : "",
    },
  };
}
