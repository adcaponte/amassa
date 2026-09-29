// Módulo puro do Estoque — o que as abas Histórico e Para onde foi MOSTRAM (plano 06-07).
//
// `descreverMovimentacao` é a ÚNICA fonte do texto de cada linha do livro: a aba Histórico e (plano
// 06-09) a folha do material desenham o MESMO `LinhaMovimentacao` a partir dela — a mesma
// movimentação tem a mesma frase nos dois lugares. `agregarParaOndeFoi` é a conta de qual área
// consumiu o quê; a exclusão do que foi cancelado é REGRA daqui, testada, não um `where` escondido
// na consulta (Pitfall 15).
//
// Nenhum import que alcance React, Next, drizzle-orm, pg ou `@/db`; não lê o relógio — quem chama
// passa `agora` e `hoje`. Os imports de valor são de módulos também puros (formatação do Financeiro,
// rótulos de unidade e de área, as frases de `textos.ts`, os destinos). As uniões de origem, tipo e
// motivo vêm como TIPO de `pedidos.ts`, que as redeclara espelhando os enums da migração 0023.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import { ROTULO_UNIDADE, type Unidade } from "@/lib/cadastros/catalogo";
import { formatarQuantidade, formatarReais } from "@/lib/financeiro/formato";
import { ROTULO_AREA } from "@/lib/financeiro/textos";

import { rotuloDoDestino, type DescricaoDoDestino, type DestinoDeSaida } from "./destinos";
import type {
  MotivoDaMovimentacao,
  OrigemDaMovimentacao,
  TipoDaMovimentacao,
} from "./pedidos";
import {
  CHIP_DO_FINANCEIRO,
  CHIP_ESTORNADA,
  CHIP_ESTORNO,
  CHIP_PERDA,
  CHIP_SALDO_INICIAL,
  CHIP_VENDA,
  LINHA_AJUSTE,
  LINHA_ENTRADA,
  LINHA_ESTORNO,
  LINHA_PECA_PRONTA,
  LINHA_SALDO_INICIAL,
  LINHA_VENDIDO,
  NOME_BARRA_VENDAS,
  textoCompraNumero,
  textoContado,
  textoContadoNaPrateleira,
  textoDocumentoCancelado,
  textoPagaPor,
  textoPrecoPorUnidade,
  textoVendaNumero,
} from "./textos";

const FUSO = "America/Sao_Paulo";
const SEPARADOR = " · ";
// O sinal de menos TIPOGRÁFICO, como no cartão e na prévia — nunca o hífen.
const MENOS = "−";

// ---------------------------------------------------------------------------------------------
// A linha do livro.
// ---------------------------------------------------------------------------------------------

// O que uma linha precisa para ser descrita — redeclaração estrutural do que `listarHistorico`
// (consultas.ts, que não pode ser importado aqui) lê de cada movimentação.
export type MovimentacaoParaDescrever = {
  origem: OrigemDaMovimentacao;
  tipo: TipoDaMovimentacao;
  motivo: MotivoDaMovimentacao | null;
  destino: DestinoDeSaida | null;
  // A área GRAVADA na linha (decidida no servidor no instante da saída), nunca recalculada.
  area: AreaFinanceira | null;
  unidade: Unidade;
  quantidadeMilesimos: number;
  valorCentavos: number;
  valorInformadoCentavos: number | null;
  saldoContadoMilesimos: number | null;
  // O vínculo em texto: turma, "o que aconteceu?", o nome congelado da encomenda, o motivo do ajuste.
  nota: string | null;
  // O número do documento do Financeiro (venda nº / compra nº), quando a linha veio de lá.
  documentoNumero: number | null;
  // Esta linha É um estorno (`estorno_de_id` preenchido).
  ehEstorno: boolean;
  // Existe um estorno apontando para esta linha — ela foi cancelada, mas continua (D-04).
  estornada: boolean;
};

export type SinalDaMovimentacao = "+" | "−";
// Entrada em verde, saída na cor da tinta, ajuste em terracota (UI-SPEC §Aba Histórico).
export type TomDaMovimentacao = "sucesso" | "tinta" | "acento";
export type TomDoChip = "perda" | "venda" | "financeiro" | "neutro";
export type ChipDaMovimentacao = { rotulo: string; tom: TomDoChip };

export type DescricaoDaMovimentacao = {
  sinal: SinalDaMovimentacao;
  tom: TomDaMovimentacao;
  // Com o sinal: "+25", "−1", "−0,9".
  quantidadeTexto: string;
  unidadeTexto: string;
  linha2: string;
  chips: ChipDaMovimentacao[];
};

function textoDeMilesimos(milesimos: number): string {
  return formatarQuantidade(String(Math.abs(milesimos) / 1000));
}

// Meio-para-cima em inteiros exatos (`BigInt(...)` e não literais `0n`: o tsconfig mira ES2017).
function multiplicarEDividir(a: number, b: number, divisor: number): number {
  const produto = BigInt(a) * BigInt(b);
  const d = BigInt(divisor);
  const dois = BigInt(2);
  return Number((dois * produto + d) / (dois * d));
}

// "R$ 5,00/kg" — o preço por UNIDADE inteira (1 unidade = 1000 milésimos) de uma entrada, pelo valor
// que se pagou. Só para mostrar; nunca gravado arredondado (D-19).
function precoPorUnidade(centavos: number, milesimos: number, unidade: string): string {
  const unitario = multiplicarEDividir(centavos, 1000, Math.abs(milesimos));
  return textoPrecoPorUnidade(formatarReais(unitario), unidade);
}

function juntar(partes: readonly (string | null | undefined | false)[]): string {
  return partes.filter((parte): parte is string => typeof parte === "string" && parte !== "").join(
    SEPARADOR,
  );
}

function tipoDoDocumento(origem: OrigemDaMovimentacao): "venda" | "compra" | null {
  if (origem === "venda") return "venda";
  if (origem === "compra") return "compra";
  return null;
}

// Uma linha do livro em texto, na tabela "Movimentação × Linha 2 × Chips" da UI-SPEC — linha a
// linha. O valor mostrado numa entrada é o DA NOTA (`valor_informado_centavos`) — é o que se pagou,
// mesmo quando o gravado difere porque a entrada chegou com saldo negativo e reprecificou (D-25). A
// saída mostra o valor gravado NO INSTANTE dela (D-07), em absoluto. Vocabulário da UI-SPEC: "venda
// nº {N}", "paga por {Área}" — nunca "SKU", "valoração" nem a "frente" do protótipo.
export function descreverMovimentacao(linha: MovimentacaoParaDescrever): DescricaoDaMovimentacao {
  const unidade = ROTULO_UNIDADE[linha.unidade];
  const sinal: SinalDaMovimentacao = linha.quantidadeMilesimos < 0 ? MENOS : "+";
  const tom: TomDaMovimentacao =
    linha.tipo === "ajuste" ? "acento" : linha.tipo === "entrada" ? "sucesso" : "tinta";
  const quantidadeTexto = `${sinal}${textoDeMilesimos(linha.quantidadeMilesimos)}`;
  const valorAbsoluto = formatarReais(Math.abs(linha.valorCentavos));
  // Numa entrada, o que se pagou; na falta (não acontece — o banco exige), o gravado.
  const valorDaNota = linha.valorInformadoCentavos ?? Math.abs(linha.valorCentavos);
  const doFinanceiro = linha.origem === "venda" || linha.origem === "compra";
  const documento = tipoDoDocumento(linha.origem);

  const chips: ChipDaMovimentacao[] = [];
  let linha2: string;

  if (linha.ehEstorno) {
    // Estorno de venda (entra) ou de compra (sai) — as duas linhas ficam (D-04).
    linha2 = juntar([
      LINHA_ESTORNO,
      documento !== null && linha.documentoNumero !== null
        ? textoDocumentoCancelado(documento, linha.documentoNumero)
        : null,
      valorAbsoluto,
    ]);
    chips.push({ rotulo: CHIP_ESTORNO, tom: "neutro" });
  } else if (linha.motivo === "saldo_inicial") {
    // A primeira contagem (plano 06-10): entrada com o custo, ou ajuste para menos sem custo.
    linha2 = juntar([
      LINHA_SALDO_INICIAL,
      linha.saldoContadoMilesimos !== null
        ? textoContado(textoDeMilesimos(linha.saldoContadoMilesimos), unidade)
        : null,
      linha.valorInformadoCentavos !== null ? formatarReais(linha.valorInformadoCentavos) : null,
    ]);
    chips.push({ rotulo: CHIP_SALDO_INICIAL, tom: "neutro" });
  } else if (linha.tipo === "ajuste") {
    linha2 = juntar([
      LINHA_AJUSTE,
      linha.saldoContadoMilesimos !== null
        ? textoContadoNaPrateleira(textoDeMilesimos(linha.saldoContadoMilesimos), unidade)
        : null,
      linha.nota,
    ]);
  } else if (linha.tipo === "entrada") {
    const preco = precoPorUnidade(valorDaNota, linha.quantidadeMilesimos, unidade);
    if (linha.origem === "compra") {
      linha2 = juntar([
        linha.documentoNumero !== null ? textoCompraNumero(linha.documentoNumero) : null,
        formatarReais(valorDaNota),
        preco,
      ]);
    } else {
      linha2 = juntar([
        LINHA_ENTRADA,
        linha.motivo === "peca_pronta" ? LINHA_PECA_PRONTA : null,
        formatarReais(valorDaNota),
        preco,
      ]);
    }
  } else if (linha.origem === "venda") {
    linha2 = juntar([
      LINHA_VENDIDO,
      linha.documentoNumero !== null ? textoVendaNumero(linha.documentoNumero) : null,
      linha.area !== null ? textoPagaPor(ROTULO_AREA[linha.area]) : null,
      valorAbsoluto,
    ]);
    chips.push({ rotulo: CHIP_VENDA, tom: "venda" });
  } else {
    // Saída manual: "{Destino} · paga por {Área} · {vínculo} · {R$}".
    linha2 = juntar([
      linha.destino !== null ? rotuloDoDestino(linha.destino) : null,
      linha.area !== null ? textoPagaPor(ROTULO_AREA[linha.area]) : null,
      linha.nota,
      valorAbsoluto,
    ]);
    if (linha.destino === "perda") {
      chips.push({ rotulo: CHIP_PERDA, tom: "perda" });
    }
  }

  if (doFinanceiro) {
    chips.push({ rotulo: CHIP_DO_FINANCEIRO, tom: "financeiro" });
  }
  if (linha.estornada) {
    chips.push({ rotulo: CHIP_ESTORNADA, tom: "neutro" });
  }

  return { sinal, tom, quantidadeTexto, unidadeTexto: unidade, linha2, chips };
}

// ---------------------------------------------------------------------------------------------
// Quando.
// ---------------------------------------------------------------------------------------------

const FORMATO_DO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATO_DA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "AAAA-MM-DD" do dia civil anterior — conta sobre `Date.UTC`, nunca o fuso do processo.
function diaAnterior(diaIso: string): string {
  return somarDias(diaIso, -1);
}

function somarDias(diaIso: string, dias: number): string {
  const [ano, mes, dia] = diaIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

// "Hoje, 14:32" / "Ontem, 09:10" / "28/09, 14:32" — o `quando()` do protótipo, mas com o dia civil
// e a hora de Brasília (`America/Sao_Paulo`) nos dois lados da comparação: às 23h30 de Brasília o
// instante já é o dia seguinte em UTC e continua "Hoje". `agora` chega por argumento.
export function quandoTexto(instante: Date, agora: Date): string {
  const diaDoInstante = FORMATO_DO_DIA.format(instante);
  const hoje = FORMATO_DO_DIA.format(agora);
  const hora = FORMATO_DA_HORA.format(instante);
  if (diaDoInstante === hoje) {
    return `Hoje, ${hora}`;
  }
  if (diaDoInstante === diaAnterior(hoje)) {
    return `Ontem, ${hora}`;
  }
  const [, mes, dia] = diaDoInstante.split("-");
  return `${dia}/${mes}, ${hora}`;
}

// A data civil em que o período começa: hoje e os `dias - 1` anteriores ("Últimos 30 dias" = hoje
// e os 29 dias antes). `hoje` é "AAAA-MM-DD" de `hojeEmBrasilia`.
export function inicioDoPeriodo(hoje: string, dias: number): string {
  return somarDias(hoje, -(dias - 1));
}

// ---------------------------------------------------------------------------------------------
// Para onde foi.
// ---------------------------------------------------------------------------------------------

// Uma saída lida do livro, com a marca `estornada`. A consulta já traz só saídas de origem manual
// ou venda que não são estorno — e esta função exclui DE NOVO, por regra: o que ela conta não
// depende de a consulta ter acertado o `where`.
export type SaidaParaOndeFoi = {
  origem: OrigemDaMovimentacao;
  tipo: TipoDaMovimentacao;
  destino: DestinoDeSaida | null;
  area: AreaFinanceira | null;
  valorCentavos: number;
  ehEstorno: boolean;
  estornada: boolean;
};

export type ChaveDaBarra = DestinoDeSaida | "venda";

export type ValorPorArea = { area: AreaFinanceira; valorCentavos: number };

export type BarraDoParaOndeFoi = {
  chave: ChaveDaBarra;
  nome: string;
  // A área que paga o destino (D-14); `null` na barra de vendas, que tem uma linha por área.
  area: AreaFinanceira | null;
  // Soma do valor ABSOLUTO das saídas.
  valorCentavos: number;
  saidas: number;
  // Percentual sobre o total do período, inteiro.
  percentual: number;
  // Largura do preenchimento, proporcional à maior barra, com mínimo 2 quando há valor.
  largura: number;
  // Só na barra de vendas (D-31): quanto cada área vendeu, maior primeiro.
  porArea: ValorPorArea[];
};

export type ParaOndeFoi = {
  totalCentavos: number;
  saidas: number;
  barras: BarraDoParaOndeFoi[];
};

// A ordem fixa das áreas (04.4-UI-SPEC.md) — desempate das linhas por área.
const ORDEM_DAS_AREAS: readonly AreaFinanceira[] = ["cafeteria", "espaco", "pecas", "loja", "geral"];

// O que conta como CONSUMO de uma área. Pitfall 15: uma venda cancelada não é consumo — a saída
// estornada fica fora, e o estorno de uma compra (saída de origem `compra`) também. Ajuste não é
// consumo de área nenhuma: é correção do livro. Só ficam as saídas manuais com destino (D-15) e
// as baixas por venda (D-31).
function contaComoConsumo(saida: SaidaParaOndeFoi): boolean {
  if (saida.tipo !== "saida" || saida.ehEstorno || saida.estornada) {
    return false;
  }
  if (saida.origem === "manual") {
    return saida.destino !== null;
  }
  return saida.origem === "venda";
}

function percentualInteiro(parte: number, todo: number): number {
  return todo > 0 ? Math.round((parte * 100) / todo) : 0;
}

// As seis barras do "Para onde foi" (D-12, D-31): os cinco destinos manuais, na ordem da constante,
// e "Vendido · pelo Financeiro". SEMPRE seis — destino sem saída tem trilho vazio. Ordem decrescente
// de valor; empate na ordem fixa (os cinco destinos, depois as vendas). Percentual sobre o total;
// largura proporcional à maior barra, com mínimo de 2% quando o valor é maior que zero (herdado).
export function agregarParaOndeFoi(
  saidas: readonly SaidaParaOndeFoi[],
  { destinos }: { destinos: readonly DescricaoDoDestino[] },
): ParaOndeFoi {
  type Acumulado = { valor: number; saidas: number; porArea: Map<AreaFinanceira, number> };
  const acumulado = new Map<ChaveDaBarra, Acumulado>();
  const ordemFixa: ChaveDaBarra[] = [...destinos.map((destino) => destino.valor), "venda"];
  for (const chave of ordemFixa) {
    acumulado.set(chave, { valor: 0, saidas: 0, porArea: new Map() });
  }

  let totalCentavos = 0;
  let totalSaidas = 0;
  for (const saida of saidas) {
    if (!contaComoConsumo(saida)) {
      continue;
    }
    const chave: ChaveDaBarra = saida.origem === "venda" ? "venda" : (saida.destino as DestinoDeSaida);
    const barra = acumulado.get(chave);
    if (!barra) {
      continue;
    }
    const valor = Math.abs(saida.valorCentavos);
    barra.valor += valor;
    barra.saidas += 1;
    if (chave === "venda" && saida.area !== null) {
      barra.porArea.set(saida.area, (barra.porArea.get(saida.area) ?? 0) + valor);
    }
    totalCentavos += valor;
    totalSaidas += 1;
  }

  const teto = Math.max(0, ...[...acumulado.values()].map((barra) => barra.valor));

  const barras = ordemFixa.map((chave, indice) => {
    const barra = acumulado.get(chave) as Acumulado;
    const descricao = destinos.find((destino) => destino.valor === chave);
    const larguraProporcional = percentualInteiro(barra.valor, teto);
    const porArea = [...barra.porArea.entries()]
      .map(([area, valorCentavos]) => ({ area, valorCentavos }))
      .sort(
        (a, b) =>
          b.valorCentavos - a.valorCentavos ||
          ORDEM_DAS_AREAS.indexOf(a.area) - ORDEM_DAS_AREAS.indexOf(b.area),
      );
    return {
      indice,
      barra: {
        chave,
        nome: descricao ? descricao.rotulo : NOME_BARRA_VENDAS,
        area: descricao ? descricao.area : null,
        valorCentavos: barra.valor,
        saidas: barra.saidas,
        percentual: percentualInteiro(barra.valor, totalCentavos),
        largura: barra.valor > 0 ? Math.max(larguraProporcional, 2) : 0,
        porArea,
      } satisfies BarraDoParaOndeFoi,
    };
  });

  barras.sort((a, b) => b.barra.valorCentavos - a.barra.valorCentavos || a.indice - b.indice);

  return {
    totalCentavos,
    saidas: totalSaidas,
    barras: barras.map((item) => item.barra),
  };
}

// ---------------------------------------------------------------------------------------------
// A folha de um material (plano 06-09): "Gasto por" (EST-20, D-08).
// ---------------------------------------------------------------------------------------------

// Um produto cuja ficha técnica gasta o material: o nome do produto como gravado, a quantidade da
// ficha (texto decimal com ponto, como o `numeric` volta do `pg`) e a unidade DO INSUMO (a do
// material — a ficha técnica sempre mede o insumo na unidade dele).
export type ProdutoQueGasta = {
  produto: string;
  quantidade: string;
  unidadeDoInsumo: Unidade;
};

const ORDEM_PT_BR = new Intl.Collator("pt-BR");

// "Gasto por" em ordem de nome do produto, pt-BR ("Água tônica" antes de "Café"), sem mutar a
// entrada. Cada produto aparece uma vez: `ficha_tecnica` tem `unique(item_id, insumo_id)`.
export function ordenarGastoPor<T extends Pick<ProdutoQueGasta, "produto">>(
  produtos: readonly T[],
): T[] {
  return [...produtos].sort((a, b) => ORDEM_PT_BR.compare(a.produto, b.produto));
}

// "Café 200 ml (15 g) · Café refil (30 g)" — todos os produtos, na ordem recebida, nunca
// truncado (a tela quebra por palavra). A quantidade sai por `formatarQuantidade` e a unidade pelo
// rótulo da tela (litro é "L"). Nenhum produto = texto vazio: a seção não aparece.
export function textoGastoPor(produtos: readonly ProdutoQueGasta[]): string {
  return produtos
    .map(
      (linha) =>
        `${linha.produto} (${formatarQuantidade(linha.quantidade)} ${ROTULO_UNIDADE[linha.unidadeDoInsumo]})`,
    )
    .join(SEPARADOR);
}
