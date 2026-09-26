// Módulo puro (D-14): SÓ `import type` é permitido aqui — nenhuma leitura do relógio, nenhum
// React, nenhum cliente de banco, e nenhuma CHAMADA a `quantasCabem`/`calcularPeca`/
// `farolDoPreco`/`resultadoDaFicha` (só os TIPOS que essas funções produzem). Quem WIRE-A a
// cadeia inteira para cada linha (o mesmo caminho que `DialogoFicha` e `ListaPecas` já usam) é o
// `EditorOrcamento` (Server Component, 04.5-06-PLAN.md Tarefa 3) — esta função só SOMA o que já
// veio calculado.
//
// `contasDoOrcamento` é a fonte ÚNICA do total (key_links do plano): a lista de orçamentos, o
// editor, o documento do cliente e a aprovação leem dela, nunca de uma segunda soma — mesmo
// precedente de `lib/financeiro/documento.ts::totalDasLinhas`.
//
// Tudo em inteiros: centavos para dinheiro, milésimos para hora e para fornada ocupada (o único
// número fracionário exibido — a formatação decimal fica para a tela, nunca para este módulo).
import type { ResultadoDaFicha } from "@/lib/precificacao/ficha";

// Uma linha já com o resultado de `resultadoDaFicha` daquela peça (custo/mínimo/farol, ou o
// motivo de recusa) — `horasMilesimos` vem à parte porque `ResultadoDaFicha` não carrega esse
// campo (ele pertence à FICHA, não ao resultado do cálculo).
export type LinhaParaContas = {
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  horasMilesimos: number;
  resultado: ResultadoDaFicha;
};

// Um custo de projeto do orçamento (molde, protótipo, carimbo, embalagem especial) — só o valor
// importa para a soma; a descrição é assunto da tela, nunca deste módulo.
export type CustoDeProjetoParaContas = {
  valorCentavos: number;
};

// O que só quem chama sabe decidir (04.5-07-PLAN.md, key_links): a lista de custos de projeto e o
// frete do orçamento (vindos de `orcamento_projeto`/`orcamentos.frete_centavos`), o imposto+taxa
// do MOMENTO (parâmetros vigentes enquanto rascunho, ou o snapshot congelado a partir do plano
// 08) e a contagem de parâmetros estimados (de `parametrosVigentes`, nunca somada aqui). Este
// módulo nunca lê banco nem decide qual das duas fontes usar — só recebe e soma.
export type ExtrasDoOrcamentoParaContas = {
  custosDeProjeto: readonly CustoDeProjetoParaContas[];
  freteCentavos: number;
  impostoETaxaPontosBase: number;
  parametrosEstimados: number;
};

export type ContasDoOrcamento = {
  // A soma de quantidade × preço de cada linha — nunca contaminada por uma linha sem cálculo
  // (D-11/D-12): o total das peças continua verdadeiro mesmo quando alguma linha não calcula.
  pecasCentavos: number;
  // Soma de `extras.custosDeProjeto` — uma cobrança única, fora do preço da peça.
  projetoCentavos: number;
  freteCentavos: number;
  // `pecasCentavos + projetoCentavos + freteCentavos`.
  totalCentavos: number;
  // A soma de quantidade × custo unitário de cada linha calculável, MAIS projeto e frete (eles
  // também custam) — sempre ≤ `totalCentavos` quando todo preço praticado está no mínimo ou acima
  // (o mínimo é, por definição, o preço que cobre exatamente o custo mais lucro/folga/imposto/
  // taxa).
  custoCentavos: number;
  // Recebido de `extras`, devolvido tal como veio — a soma de imposto + taxa do cartão, em
  // pontos-base (10000 = 100%, mesma convenção de `taxaCartaoPontosBase`).
  impostoETaxaPontosBase: number;
  // `totalCentavos − (totalCentavos × impostoETaxaPontosBase ÷ 10000) − custoCentavos` — pode ser
  // NEGATIVA (devolvida como está: a tela é que pinta de vermelho, este módulo nunca zera).
  sobraCentavos: number;
  // `sobraCentavos ÷ totalCentavos`, em pontos-base — zero quando o total é zero (nunca divisão
  // por zero).
  sobraPontosBase: number;
  // Recebido de `extras`, devolvido tal como veio (key_links: a contagem nunca nasce aqui).
  parametrosEstimados: number;
  // Soma de quantidade × horas de cada linha, em milésimos de hora.
  horasMilesimos: number;
  // Soma de quantidade ÷ quantas cabem, em milésimos — o único número fracionário exibido.
  // Ignora a linha sem cálculo (não cabe, divisor inválido) ou cuja contagem de forno é zero,
  // em vez de dividir por zero.
  fornadasBiscoitoMilesimos: number;
  fornadasEsmalteMilesimos: number;
  // Nomes das linhas cujo cálculo veio com motivo de recusa — a tela mostra o aviso por linha; o
  // total das peças continua sendo a soma verdadeira de quantidade × preço (D-11/D-12: a recusa
  // de UMA linha nunca contamina a soma inteira).
  linhasSemCalculo: string[];
};

// Mesma fórmula de `lib/financeiro/taxa.ts::taxaEmCentavos` (arredondamento meio-para-cima) —
// redeclarada aqui porque este módulo é puro e só permite `import type` (D-14/D-15): imposto e
// taxa aplicados sobre o total, nunca importados como valor de outro módulo.
function aplicarPontosBase(valorCentavos: number, pontosBase: number): number {
  return Math.round((valorCentavos * pontosBase) / 10000);
}

export function contasDoOrcamento(
  linhas: LinhaParaContas[],
  extras: ExtrasDoOrcamentoParaContas,
): ContasDoOrcamento {
  let pecasCentavos = 0;
  let custoCentavos = 0;
  let horasMilesimos = 0;
  let fornadasBiscoitoMilesimos = 0;
  let fornadasEsmalteMilesimos = 0;
  const linhasSemCalculo: string[] = [];

  for (const linha of linhas) {
    pecasCentavos += linha.quantidade * linha.precoUnitarioCentavos;
    horasMilesimos += linha.quantidade * linha.horasMilesimos;

    if (!linha.resultado.ok) {
      linhasSemCalculo.push(linha.nome);
      continue;
    }

    custoCentavos += linha.quantidade * linha.resultado.custoCentavos;

    // Ignora contagem zero ou desconhecida (D-12: uma ficha "ok" sempre tem as duas contagens
    // maiores que zero — `quantasCabem` só devolve `cabe: true` quando as duas são positivas —,
    // mas a checagem fica aqui, explícita, em vez de confiar nesse invariante de um módulo
    // vizinho).
    if (linha.resultado.forno.biscoito > 0) {
      fornadasBiscoitoMilesimos += Math.round((linha.quantidade * 1000) / linha.resultado.forno.biscoito);
    }
    if (linha.resultado.forno.esmalte > 0) {
      fornadasEsmalteMilesimos += Math.round((linha.quantidade * 1000) / linha.resultado.forno.esmalte);
    }
  }

  let projetoCentavos = 0;
  for (const custo of extras.custosDeProjeto) {
    projetoCentavos += custo.valorCentavos;
  }

  const totalCentavos = pecasCentavos + projetoCentavos + extras.freteCentavos;
  // Projeto e frete TAMBÉM custam — entram no custo total, não só no total cobrado (D-24: é
  // exatamente essa diferença que "Só para você" existe para mostrar).
  const custoTotalCentavos = custoCentavos + projetoCentavos + extras.freteCentavos;
  const impostoETaxaAplicadoCentavos = aplicarPontosBase(totalCentavos, extras.impostoETaxaPontosBase);
  const sobraCentavos = totalCentavos - impostoETaxaAplicadoCentavos - custoTotalCentavos;
  const sobraPontosBase =
    totalCentavos === 0 ? 0 : Math.round((sobraCentavos * 10000) / totalCentavos);

  return {
    pecasCentavos,
    projetoCentavos,
    freteCentavos: extras.freteCentavos,
    totalCentavos,
    custoCentavos: custoTotalCentavos,
    impostoETaxaPontosBase: extras.impostoETaxaPontosBase,
    sobraCentavos,
    sobraPontosBase,
    parametrosEstimados: extras.parametrosEstimados,
    horasMilesimos,
    fornadasBiscoitoMilesimos,
    fornadasEsmalteMilesimos,
    linhasSemCalculo,
  };
}
