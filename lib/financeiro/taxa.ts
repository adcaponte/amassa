// Módulo puro (sem import): a taxa do cartão, congelada na parcela no momento do pagamento
// (BRIEFING §5) — "mudar a taxa em Cadastros depois não reescreve o passado".

// Arredondamento meio-para-cima: `Math.round` do JavaScript já arredonda 0,5 para cima em valores
// positivos — mesma regra usada pelo protótipo (`r2`, `Math.round(n*100)/100`), aqui já em
// centavos inteiros (sem ponto flutuante fracionário de reais).
export function taxaEmCentavos(valorCentavos: number, pontosBase: number): number {
  return Math.round((valorCentavos * pontosBase) / 10000);
}

export type TipoDeDocumentoParaTaxa = "venda" | "despesa";

export type EntradaDeLiquidoDaParcela = {
  tipo: TipoDeDocumentoParaTaxa;
  valorCentavos: number;
  taxaPontosBase?: number | null;
};

// Entra no caixa = valor − taxa (BRIEFING §5), e SÓ para venda: uma despesa paga no cartão entra
// inteira (a taxa não é custo do FORNECEDOR, é custo do dinheiro que ENTROU, então só se aplica
// quando o dinheiro está entrando).
export function liquidoDaParcela({
  tipo,
  valorCentavos,
  taxaPontosBase,
}: EntradaDeLiquidoDaParcela): number {
  if (tipo !== "venda" || !taxaPontosBase) {
    return valorCentavos;
  }
  return valorCentavos - taxaEmCentavos(valorCentavos, taxaPontosBase);
}
