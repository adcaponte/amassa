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

export type ContasDoOrcamento = {
  // A soma de quantidade × preço de cada linha — nunca contaminada por uma linha sem cálculo
  // (D-11/D-12): o total das peças continua verdadeiro mesmo quando alguma linha não calcula.
  pecasCentavos: number;
  // Declarados aqui, sempre zero NESTA fase — o plano 07 acrescenta custos de projeto e frete ao
  // orçamento (e ao total), e com eles o imposto/taxa e a sobra que dependem dos dois. Manter o
  // campo no tipo agora evita que quem consome `ContasDoOrcamento` precise mudar de formato
  // quando o plano 07 chegar — só o VALOR muda de zero para algo real.
  projetoCentavos: number;
  freteCentavos: number;
  // `pecasCentavos + projetoCentavos + freteCentavos` — nesta fase é sempre igual a
  // `pecasCentavos`, porque os outros dois ainda são zero.
  totalCentavos: number;
  // A soma de quantidade × custo unitário de cada linha calculável — sempre ≤ `totalCentavos`
  // quando todo preço praticado está no mínimo ou acima (o mínimo é, por definição, o preço que
  // cobre exatamente o custo mais lucro/folga/imposto/taxa).
  custoCentavos: number;
  // Declarados aqui, sempre zero NESTA fase — dependem de imposto/taxa do orçamento congelado e
  // dos custos de projeto/frete que só o plano 07 acrescenta.
  impostoETaxaPontosBase: number;
  sobraCentavos: number;
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

export function contasDoOrcamento(linhas: LinhaParaContas[]): ContasDoOrcamento {
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

  return {
    pecasCentavos,
    projetoCentavos: 0,
    freteCentavos: 0,
    totalCentavos: pecasCentavos,
    custoCentavos,
    impostoETaxaPontosBase: 0,
    sobraCentavos: 0,
    horasMilesimos,
    fornadasBiscoitoMilesimos,
    fornadasEsmalteMilesimos,
    linhasSemCalculo,
  };
}
