// Módulo puro do Estoque — a VALORAÇÃO do livro (D-07, D-25, D-26). Zero import: nenhuma linha
// alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano 06-01), mesma disciplina
// de `lib/cadastros/catalogo.ts`. Não lê o relógio. Todo o valor em dinheiro que entra em
// `movimentacoes_estoque` é decidido AQUI; `lib/estoque/gravacao.ts` só passa o estado lido sob a
// trava e insere o que esta função devolve.
//
// O algoritmo é o CUSTO MÉDIO MÓVEL com os grampos do ERPNext para estoque negativo, exatamente
// como `06-RESEARCH.md` §Pergunta 3 especifica (regras R1–R6, a tabela dos sete casos), mais a
// regra R7 do estorno de venda, decidida pelo dono em 29/09/2026:
//
//   Estado: Q (Σ quantidade, milésimos, pode ser negativo), V (Σ valor, centavos), e a última
//   entrada com preço (compra, entrada manual, peça pronta ou contagem — NUNCA o estorno de uma
//   venda: WR-02, decidido pelo dono em 29/09/2026). Movimento com Δ (milésimos, com sinal);
//   Q' = Q + Δ.
//   Taxa corrente A: Q ≠ 0 → V/Q; Q = 0 → a da última entrada com preço; sem nenhuma → 0 (D-26).
//
//   R1  Q' = 0                                  → valor = −V   (zera o resíduo de arredondamento)
//   R2  entrada COM preço P, Q > 0              → valor = P
//   R3  entrada COM preço, Q ≤ 0 e Q' > 0       → V' = round(Q' × P / Δ); valor = V' − V
//   R4  entrada COM preço, Q < 0 e Q' < 0       → valor = round(Δ × A)
//   R5  saída                                   → valor = −round(|Δ| × A)
//   R6  entrada SEM preço (ajuste para mais)    → valor = round(Δ × A)
//   R7  estorno de venda (S = o que a venda levou):
//         Q > 0 → valor = S            (como R2 — D-23)
//         Q ≤ 0 → valor = round(Δ × A) (como R6 — WR-01, decidido pelo dono em 29/09/2026)
//   Ordem: R1 primeiro; depois a regra do tipo.
//
// A taxa A é mantida como RAZÃO EXATA (numerador, denominador), nunca como um custo unitário
// arredondado: um item em gramas a R$ 78/kg custa 7,8 centavos por grama — arredondar o unitário
// erraria 2,5%. Toda multiplicação e divisão é em `BigInt` (Pitfall 11 — quantidade × valor passa
// de 2^53 com folga), e o único arredondamento é `arredondarRazao`, meio-para-cima sobre valores
// absolutos com o sinal reaplicado — o mesmo "meio-para-cima" de `lib/financeiro/taxa.ts`.

export type EntradaComPreco = { valorCentavos: number; milesimos: number };

export type EstadoDoItem = {
  // Σ quantidade_milesimos do item — pode ser negativo (D-06: saldo negativo é permitido).
  saldoMilesimos: number;
  // Σ valor_centavos do item — mesmo sinal do saldo, ou zero.
  valorCentavos: number;
  // A última entrada com preço do livro (ordem de `numero`): o custo usado quando o saldo é zero.
  ultimaEntradaComPreco: EntradaComPreco | null;
};

export const ESTADO_VAZIO: EstadoDoItem = {
  saldoMilesimos: 0,
  valorCentavos: 0,
  ultimaEntradaComPreco: null,
};

// Milésimos SEMPRE positivos; o sinal vem do tipo. União fechada: não existe um quinto caso.
// - `entrada_com_preco`: compra, entrada manual ("quanto custou ao todo"), saldo inicial e peça
//   pronta. Só ela vira a "última entrada com preço".
// - `entrada_sem_preco`: ajuste para mais.
// - `saida`: saída manual, venda, ajuste para menos e estorno de compra.
// - `estorno_de_venda`: a volta de uma saída cancelada, com o valor que ela levou (R7). Grava no
//   livro como `tipo = 'entrada'` com `estorno_de_id` preenchido — por isso as duas consultas da
//   última entrada com preço (`lerEstados` em gravacao.ts, `listarSaldos` em consultas.ts) filtram
//   `estorno_de_id is null`, na mesma regra desta função (WR-02).
export type Movimento =
  | { tipo: "entrada_com_preco"; milesimos: number; pagoCentavos: number }
  | { tipo: "entrada_sem_preco"; milesimos: number }
  | { tipo: "saida"; milesimos: number }
  | { tipo: "estorno_de_venda"; milesimos: number; valorDaVendaCentavos: number };

export type MovimentoValorado = {
  // Com sinal: positivo nas entradas, negativo nas saídas.
  quantidadeMilesimos: number;
  // Com sinal: o efeito desta linha no valor em estoque.
  valorCentavos: number;
  estadoDepois: EstadoDoItem;
};

// `BigInt(...)` em vez de literais `0n`: o `tsconfig.json` do projeto mira ES2017, onde o literal
// não existe (TS2737) — a função `BigInt` existe no runtime (Node e navegadores atuais).
const ZERO = BigInt(0);
const UM = BigInt(1);
const DOIS = BigInt(2);
const MIL = BigInt(1000);

// Meio-para-cima sobre os valores absolutos, com o sinal reaplicado: 2,5 → 3 e −2,5 → −3.
function arredondarRazao(numerador: bigint, denominador: bigint): bigint {
  if (denominador === ZERO) {
    throw new RangeError("arredondarRazao: denominador zero.");
  }
  const negativo = numerador < ZERO !== denominador < ZERO;
  const n = numerador < ZERO ? -numerador : numerador;
  const d = denominador < ZERO ? -denominador : denominador;
  const q = (DOIS * n + d) / (DOIS * d);
  return negativo ? -q : q;
}

function conferirMilesimos(milesimos: number): void {
  if (!Number.isSafeInteger(milesimos) || milesimos <= 0) {
    throw new RangeError(
      `valorarMovimento: milésimos precisam ser inteiros positivos (recebido ${milesimos}).`,
    );
  }
}

// A taxa corrente como razão (centavos por milésimo). Q ≠ 0 → V/Q; Q = 0 → a da última entrada com
// preço; sem nenhuma → zero (D-26: aparece como R$ 0,00 no "Para onde foi").
function taxaCorrente(estado: EstadoDoItem): { numerador: bigint; denominador: bigint } {
  if (estado.saldoMilesimos !== 0) {
    return { numerador: BigInt(estado.valorCentavos), denominador: BigInt(estado.saldoMilesimos) };
  }
  if (estado.ultimaEntradaComPreco) {
    return {
      numerador: BigInt(estado.ultimaEntradaComPreco.valorCentavos),
      denominador: BigInt(estado.ultimaEntradaComPreco.milesimos),
    };
  }
  return { numerador: ZERO, denominador: UM };
}

export function valorarMovimento(estado: EstadoDoItem, movimento: Movimento): MovimentoValorado {
  conferirMilesimos(movimento.milesimos);

  const q = BigInt(estado.saldoMilesimos);
  const v = BigInt(estado.valorCentavos);
  const delta = movimento.tipo === "saida" ? -BigInt(movimento.milesimos) : BigInt(movimento.milesimos);
  const qDepois = q + delta;
  const taxa = taxaCorrente(estado);

  let valor: bigint;
  if (qDepois === ZERO) {
    // R1 — zera o resíduo: o saldo volta a zero, o valor também.
    valor = -v;
  } else if (movimento.tipo === "entrada_com_preco") {
    const pago = BigInt(movimento.pagoCentavos);
    if (q > ZERO) {
      // R2 — soma o que se pagou.
      valor = pago;
    } else if (qDepois > ZERO) {
      // R3 — vinha de zero ou negativo e ficou positivo: o custo vira o da entrada.
      valor = arredondarRazao(qDepois * pago, delta) - v;
    } else {
      // R4 — continua negativo: mantém a taxa corrente.
      valor = arredondarRazao(delta * taxa.numerador, taxa.denominador);
    }
  } else if (movimento.tipo === "estorno_de_venda") {
    if (q > ZERO) {
      // R7 com saldo positivo — volta ao valor que a venda levou (D-23).
      valor = BigInt(movimento.valorDaVendaCentavos);
    } else {
      // R7 com saldo zero ou negativo — à taxa corrente, como R6 (WR-01): o cancelamento não
      // reprecifica a prateleira pelo custo da venda antiga.
      valor = arredondarRazao(delta * taxa.numerador, taxa.denominador);
    }
  } else if (movimento.tipo === "saida") {
    // R5 — sai ao custo médio do instante (D-07).
    valor = -arredondarRazao(-delta * taxa.numerador, taxa.denominador);
  } else {
    // R6 — entrada sem preço (ajuste para mais): à taxa corrente.
    valor = arredondarRazao(delta * taxa.numerador, taxa.denominador);
  }

  // O estorno de venda NÃO atualiza a última entrada com preço (WR-02).
  const ultimaEntradaComPreco =
    movimento.tipo === "entrada_com_preco"
      ? { valorCentavos: movimento.pagoCentavos, milesimos: movimento.milesimos }
      : estado.ultimaEntradaComPreco;

  return {
    quantidadeMilesimos: Number(delta),
    valorCentavos: Number(valor),
    estadoDepois: {
      saldoMilesimos: Number(qDepois),
      valorCentavos: Number(v + valor),
      ultimaEntradaComPreco,
    },
  };
}

// D-23/D-24 foram tomadas sem o dono (`[auto]` em 06-CONTEXT.md) e CONFIRMADAS por ele na manhã
// de 29/09/2026 (formulário no chat; `06-VERIFICACAO-HUMANA.md` Parte 0). Trocar a regra é editar
// esta função, o ramo R7 de `valorarMovimento` e `tests/unit/estoque-custo.test.ts`.
//
// O estorno ESPELHA a movimentação gravada, nunca recalcula o efeito (Pitfall 4):
// - original com quantidade NEGATIVA (saída de venda) → volta como `estorno_de_venda`, carregando
//   o valor absoluto que a venda levou. Regra decidida pelo dono em 29/09 (R7):
//     · R1 primeiro: se o estorno zera o saldo, grava −V;
//     · saldo POSITIVO no cancelamento → grava o valor que a venda levou (D-23);
//     · saldo ZERO ou NEGATIVO → grava ao custo médio do instante, como um ajuste para mais (WR-01):
//       a prateleira NÃO é reprecificada pelo custo da venda antiga;
//     · o estorno NUNCA vira a "última entrada com preço" (WR-02).
//   Que o "Para onde foi" de uma venda cancelada zera sempre NÃO vem desta função: vem de
//   `contaComoConsumo` (`lib/estoque/historico.ts`), que deixa de fora a saída estornada e o estorno;
// - original com quantidade POSITIVA (entrada de compra) → sai ao custo médio CORRENTE (D-24): ao
//   custo original, o estoque poderia ficar com valor negativo e quantidade positiva quando houve
//   consumo entre a compra e o cancelamento (contraexemplo em 06-RESEARCH.md §Pergunta 3).
export function movimentoDoEstorno(original: {
  quantidadeMilesimos: number;
  valorCentavos: number;
}): Movimento {
  if (original.quantidadeMilesimos < 0) {
    return {
      tipo: "estorno_de_venda",
      milesimos: -original.quantidadeMilesimos,
      valorDaVendaCentavos: Math.abs(original.valorCentavos),
    };
  }
  if (original.quantidadeMilesimos > 0) {
    return { tipo: "saida", milesimos: original.quantidadeMilesimos };
  }
  throw new RangeError("movimentoDoEstorno: movimentação com quantidade zero não existe.");
}

// Centavos por UNIDADE inteira do item (1 unidade = 1000 milésimos), meio-para-cima — o "custo
// médio" que a tela mostra. `null` quando não há custo conhecido: saldo zero e nenhuma entrada com
// preço no livro.
export function custoMedioCentavosPorUnidade(estado: EstadoDoItem): number | null {
  if (estado.saldoMilesimos !== 0) {
    return Number(
      arredondarRazao(BigInt(estado.valorCentavos) * MIL, BigInt(estado.saldoMilesimos)),
    );
  }
  if (estado.ultimaEntradaComPreco) {
    return Number(
      arredondarRazao(
        BigInt(estado.ultimaEntradaComPreco.valorCentavos) * MIL,
        BigInt(estado.ultimaEntradaComPreco.milesimos),
      ),
    );
  }
  return null;
}
