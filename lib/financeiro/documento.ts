// Módulo puro (sem import): título do documento e nome de linha, no molde de `tituloDoc`/`L` do
// protótipo — sem React, sem banco, sem instanciar data nenhuma.

export type LinhaParaTitulo = {
  nome: string;
  quantidade?: number;
  // Presente só em linha de COMPRA (quanto entrou, na unidade do item) — "Esmalte (pote)" vira
  // "Esmalte (pote) × 100 un".
  quantidadeEstoque?: string | null;
  unidade?: string | null;
};

export type LinhaParaTotal = { valorCentavos: number };

// "l" (litro) aparece como "L" maiúsculo só na exibição — o valor gravado no banco continua
// minúsculo (enum `unidade_estoque`).
function unidadeExibida(unidade: string): string {
  return unidade === "l" ? "L" : unidade;
}

// "3× Café 200 ml" quando quantidade > 1; "Esmalte (pote) × 100 un" para linha de compra
// (quantidadeEstoque presente, formato DIFERENTE: quantidade depois do nome, com unidade).
export function nomeDaLinha(linha: LinhaParaTitulo): string {
  if (linha.quantidadeEstoque != null && linha.unidade) {
    const quantidadeTexto = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
      Number(linha.quantidadeEstoque),
    );
    return `${linha.nome} × ${quantidadeTexto} ${unidadeExibida(linha.unidade)}`;
  }
  if ((linha.quantidade ?? 1) > 1) {
    return `${linha.quantidade}× ${linha.nome}`;
  }
  return linha.nome;
}

// Soma inteira dos valores das linhas — aceita linha negativa (a linha "diferença", D-01/D-02).
// Nunca arredonda: os valores já são inteiros em centavos.
export function totalDasLinhas(linhas: readonly LinhaParaTotal[]): number {
  return linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
}

export type EntradaDeTituloDoDocumento = {
  titulo?: string | null;
  linhas: readonly LinhaParaTitulo[];
};

// Título explícito vence; senão, as duas primeiras linhas unidas por " + " e " +N" para o resto
// — mesmo molde de `tituloDoc` do protótipo.
export function tituloDoDocumento({ titulo, linhas }: EntradaDeTituloDoDocumento): string {
  if (titulo) {
    return titulo;
  }
  const nomes = linhas.map((linha) => nomeDaLinha(linha));
  const primeirosDois = nomes.slice(0, 2).join(" + ");
  const resto = nomes.length > 2 ? ` +${nomes.length - 2}` : "";
  return `${primeirosDois}${resto}`;
}

// As áreas distintas de uma venda, na ordem de PRIMEIRA aparição — nunca ordem alfabética, nunca
// a ordem fixa de `ROTULO_AREA` (a dica "dividido sozinho entre..." segue a ordem em que o gestor
// tocou nos itens).
export function areasDaVenda(linhas: readonly { area: string }[]): string[] {
  const vistas = new Set<string>();
  const areas: string[] = [];
  for (const linha of linhas) {
    if (!vistas.has(linha.area)) {
      vistas.add(linha.area);
      areas.push(linha.area);
    }
  }
  return areas;
}

// "Cafeteria"; "Cafeteria e Peças"; "Espaço, Peças e Cafeteria" — lista em português (D-06 do
// 04.4-03-PLAN.md: cópia literal do UI-SPEC "{área, área e área}", em vez das vírgulas soltas do
// protótipo).
export function listaEmPortugues(nomes: readonly string[]): string {
  if (nomes.length === 0) {
    return "";
  }
  if (nomes.length === 1) {
    return nomes[0];
  }
  if (nomes.length === 2) {
    return `${nomes[0]} e ${nomes[1]}`;
  }
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
