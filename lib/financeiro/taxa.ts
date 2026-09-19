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

// Redeclarado localmente (mesma disciplina de `TipoDeDocumentoParaTaxa` acima) — nunca importado
// de `./esquemas`/`./textos`, que trariam Zod/tipo do banco para dentro de um módulo puro.
export type FormaDeParcelaParaAviso = "dinheiro" | "pix" | "cartao";

export type ParcelaParaAvisoDoCartao = {
  valorCentavos: number;
  forma: FormaDeParcelaParaAviso;
};

export type AvisoDoCartao = { taxaCentavos: number; entramCentavos: number };

// O aviso do cartão (04.4-06-PLAN.md, BRIEFING §5): só existe em VENDA com alguma parcela na
// forma "cartao" — despesa paga no cartão nunca tem taxa (o preço já é o que o fornecedor cobrou).
// É uma ESTIMATIVA com a taxa de HOJE (`taxaPontosBase`, lido da configuração no momento em que a
// tela é montada) — a taxa de VERDADE só é congelada na parcela quando ela é paga no cartão
// (`lib/financeiro/acoes.ts::lancarVenda`), e mudar a taxa depois nunca reescreve o que já foi
// lançado. `entramCentavos` soma TODAS as parcelas, descontando a taxa só das que são no cartão —
// é o mesmo cálculo de `liquidoDaParcela` acima, repetido parcela a parcela.
export function avisoDoCartao({
  tipo,
  parcelas,
  taxaPontosBase,
}: {
  tipo: TipoDeDocumentoParaTaxa;
  parcelas: readonly ParcelaParaAvisoDoCartao[];
  taxaPontosBase: number;
}): AvisoDoCartao | null {
  if (tipo !== "venda") {
    return null;
  }

  const parcelasNoCartao = parcelas.filter((parcela) => parcela.forma === "cartao");
  if (parcelasNoCartao.length === 0) {
    return null;
  }

  const taxaCentavos = parcelasNoCartao.reduce(
    (total, parcela) => total + taxaEmCentavos(parcela.valorCentavos, taxaPontosBase),
    0,
  );
  const entramCentavos = parcelas.reduce((total, parcela) => {
    if (parcela.forma !== "cartao") {
      return total + parcela.valorCentavos;
    }
    return total + parcela.valorCentavos - taxaEmCentavos(parcela.valorCentavos, taxaPontosBase);
  }, 0);

  return { taxaCentavos, entramCentavos };
}
