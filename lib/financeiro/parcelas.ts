// Módulo puro: a REGRA ÚNICA do plano de parcelas (04.4-06-PLAN.md) — "Como recebe"/"Como paga"
// gera as parcelas, a mudança em uma delas confere de novo se a soma ainda fecha com o total. O
// `BlocoPagamento` usa `gerarPlano`/`dividirEmDuasFormas`/`conferirParcelas` para MOSTRAR; o
// servidor (`lib/financeiro/acoes.ts::lancarVenda`) usa `conferirParcelas` de novo para RECUSAR —
// nunca confia na soma calculada no cliente, mesmo com o botão habilitado à força (T-04.4-38).
//
// Zero import de React, Next, do cliente do banco, de `lib/abertura` ou `lib/cotacoes`; nenhuma
// instância de `Date` — só `./calendario` (também puro) e `./formato` (formatação de dinheiro,
// também sem import nenhum).
import { somarDias, somarMeses } from "./calendario";
import { formatarReais } from "./formato";

// Redeclarado localmente (D-15 do projeto: cada módulo do Financeiro tem sua própria cópia de
// "forma de pagamento" — `lib/financeiro/esquemas.ts` já faz o mesmo com `FORMAS`), nunca
// importado de `./textos` (evitaria um import cruzado entre dois módulos puros irmãos).
export const FORMAS_DE_PAGAMENTO = ["dinheiro", "pix", "cartao"] as const;
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];

// Os oito planos do protótipo, na mesma ordem do seletor "Como recebe"/"Como paga"
// (04.4-UI-SPEC.md): à vista, sinal de 50% + saldo, e 2x a 12x.
export const PLANOS_DE_PAGAMENTO = ["avista", "sinal", "2", "3", "4", "6", "10", "12"] as const;
export type PlanoDePagamento = (typeof PLANOS_DE_PAGAMENTO)[number];

export type ParcelaDoPlano = {
  numero: number;
  de: number;
  vencimento: string;
  valorCentavos: number;
  forma: FormaDePagamento;
  paga: boolean;
};

export type ResultadoDoPlano =
  | { ok: true; parcelas: ParcelaDoPlano[] }
  | { ok: false; erro: string };

function mensagemValorPequenoDemais(vezes: number): string {
  return `O valor é pequeno demais para dividir em ${vezes} vezes.`;
}

// `gerarPlano` é a ÚNICA função que decide data e valor de cada parcela de um plano — nunca
// recalculada em outro lugar (mesma disciplina de `calcularParcelas`, `lib/abertura/parcelas.ts`).
//
// À vista: uma parcela só, já paga, na data do documento. Sinal: a primeira metade ARREDONDADA
// PARA CIMA no centavo (R$ 150,01 → R$ 75,01 + R$ 75,00), já paga na data; a segunda, em aberto,
// 30 dias depois. Nx: `n` parcelas mensais — a primeira na data do documento (já paga) e as
// demais em `somarMeses(data, k)`, SEMPRE a partir da data original (nunca encadeando a partir da
// parcela anterior, mesma regra de `somarMeses`) — o valor é a DIVISÃO INTEIRA (`floor`), com todo
// o resto do arredondamento na PRIMEIRA parcela (R$ 100,00 em 3x → 33,34 + 33,33 + 33,33; R$ 1,00
// em 12x → 0,12 + onze de 0,08). Um valor pequeno demais para o número de parcelas escolhido
// (qualquer parcela resultando em zero ou menos) é recusado com frase humana, antes de qualquer
// conferência de soma (`conferirParcelas` abaixo nunca precisa lidar com uma parcela de R$ 0,00
// vinda daqui).
export function gerarPlano({
  plano,
  totalCentavos,
  data,
  forma,
}: {
  plano: PlanoDePagamento;
  totalCentavos: number;
  data: string;
  forma: FormaDePagamento;
}): ResultadoDoPlano {
  if (plano === "avista") {
    return {
      ok: true,
      parcelas: [{ numero: 1, de: 1, vencimento: data, valorCentavos: totalCentavos, forma, paga: true }],
    };
  }

  if (plano === "sinal") {
    const primeiro = Math.ceil(totalCentavos / 2);
    const segundo = totalCentavos - primeiro;
    if (primeiro <= 0 || segundo <= 0) {
      return { ok: false, erro: "O valor é pequeno demais para dividir em sinal e saldo." };
    }
    return {
      ok: true,
      parcelas: [
        { numero: 1, de: 2, vencimento: data, valorCentavos: primeiro, forma, paga: true },
        {
          numero: 2,
          de: 2,
          vencimento: somarDias(data, 30),
          valorCentavos: segundo,
          forma,
          paga: false,
        },
      ],
    };
  }

  const n = Number(plano);
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  const parcelas: ParcelaDoPlano[] = [];
  for (let k = 0; k < n; k++) {
    const valorCentavos = k === 0 ? base + resto : base;
    if (valorCentavos <= 0) {
      return { ok: false, erro: mensagemValorPequenoDemais(n) };
    }
    parcelas.push({
      numero: k + 1,
      de: n,
      vencimento: somarMeses(data, k),
      valorCentavos,
      forma,
      paga: k === 0,
    });
  }
  return { ok: true, parcelas };
}

// "+ outra forma" (D-07/D-08): só no à vista, divide o recebimento/pagamento em DUAS parcelas
// pagas na data do documento, cada uma com a própria forma. `primeiroValorCentavos` chega já
// escolhido por quem chama (o painel decide o valor inicial da divisão, ex.: metade); esta função
// só confere que as duas pontas ficam maiores que zero — nunca aceita uma "segunda forma" que não
// entra em nada.
export function dividirEmDuasFormas({
  totalCentavos,
  primeiroValorCentavos,
  data,
  formas,
}: {
  totalCentavos: number;
  primeiroValorCentavos: number;
  data: string;
  formas: readonly [FormaDePagamento, FormaDePagamento];
}): ResultadoDoPlano {
  const segundoValorCentavos = totalCentavos - primeiroValorCentavos;
  if (primeiroValorCentavos <= 0 || segundoValorCentavos <= 0) {
    return { ok: false, erro: "Cada forma precisa ficar com um valor maior que zero." };
  }
  return {
    ok: true,
    parcelas: [
      { numero: 1, de: 2, vencimento: data, valorCentavos: primeiroValorCentavos, forma: formas[0], paga: true },
      { numero: 2, de: 2, vencimento: data, valorCentavos: segundoValorCentavos, forma: formas[1], paga: true },
    ],
  };
}

export type ParcelaParaConferencia = {
  vencimento: string;
  valorCentavos: number;
  pago: boolean;
};

export type ResultadoDaConferencia = { ok: true } | { ok: false; erro: string };

// A ÚNICA função que decide se um conjunto de parcelas fecha com o total — chamada IDÊNTICA no
// cliente (`BlocoPagamento`, para mostrar) e no servidor (`lancarVenda`, para recusar). Ordem das
// checagens: forma/tamanho antes de valor, valor antes de soma, soma antes de data — cada uma
// recusa com a MESMA frase, não importa quem chamou.
export function conferirParcelas({
  totalCentavos,
  parcelas,
  hoje,
  dataSaldoInicial,
}: {
  totalCentavos: number;
  parcelas: readonly ParcelaParaConferencia[];
  hoje: string;
  dataSaldoInicial?: string | null;
}): ResultadoDaConferencia {
  if (parcelas.length > 12) {
    return { ok: false, erro: "No máximo 12 parcelas." };
  }

  if (parcelas.some((parcela) => parcela.valorCentavos <= 0)) {
    return { ok: false, erro: "Cada parcela precisa ter um valor maior que zero." };
  }

  const totalDasParcelas = parcelas.reduce((total, parcela) => total + parcela.valorCentavos, 0);
  if (totalDasParcelas !== totalCentavos) {
    const diferenca = totalCentavos - totalDasParcelas;
    const verbo = diferenca > 0 ? "Faltam" : "Sobram";
    return {
      ok: false,
      erro: `As parcelas somam ${formatarReais(totalDasParcelas)}. ${verbo} ${formatarReais(Math.abs(diferenca))} para fechar com o total.`,
    };
  }

  for (const parcela of parcelas) {
    if (parcela.pago && parcela.vencimento > hoje) {
      return {
        ok: false,
        erro:
          "Uma parcela que vence depois de hoje não pode estar paga — desmarque e registre no Caixa quando o dinheiro entrar.",
      };
    }
  }

  if (dataSaldoInicial) {
    for (const parcela of parcelas) {
      if (parcela.pago && parcela.vencimento < dataSaldoInicial) {
        return {
          ok: false,
          erro: "Essa parcela vence antes do saldo inicial do Financeiro — confira a data.",
        };
      }
    }
  }

  return { ok: true };
}
