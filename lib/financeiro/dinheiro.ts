// Módulo puro (D-09 do briefing, "regras puras em lib/financeiro/"): zero imports, nenhuma
// instância de `Date`, mesma disciplina de `lib/cotacoes/preco.ts`/`lib/abertura/parcelas.ts`.
// A ÚNICA conversão de texto digitado para centavos do módulo — usada pelo cliente para mostrar e
// pelo servidor para gravar (regra única, CLAUDE.md §Validação).

// Teto de dez milhões de reais (10^9 centavos) — mesmo teto de `abertura_itens.valor_centavos`/
// `cotacoes.preco_centavos`: mantém a conta longe do limite do inteiro de 32 bits, e um valor
// acima disso é erro de digitação, não venda/compra de ateliê.
export const TETO_CENTAVOS = 1_000_000_000;

export type ResultadoDeConversaoDeDinheiro =
  | { ok: true; centavos: number | null }
  | { ok: false; erro: string };

// No máximo duas frases de recusa (mesma disciplina de `lib/cotacoes/preco.ts`): uma para "não
// deu para entender", com exemplo de como escrever, e uma para "valor alto demais".
const MENSAGEM_FORMATO_INVALIDO =
  'Não deu para entender esse valor. Escreva como "150", "150,50" ou "R$ 1.234,56".';
const MENSAGEM_VALOR_ALTO =
  "Esse valor passa de R$ 10.000.000 — confira se não é erro de digitação.";

// Descarta o símbolo da moeda ("R$", em qualquer caixa) e todo espaço — inclusive o espaço não
// separável que fica entre o símbolo e o número.
function normalizar(textoBruto: string): string {
  return textoBruto.replace(/r\$/gi, "").replace(/\s/g, "");
}

// Grupos de milhar válidos: sem ponto (bloco de dígitos corrido, "1234567"); ou com ponto,
// primeiro grupo de 1 a 3 dígitos e todo grupo seguinte com EXATAMENTE 3 ("24.900" vale,
// "24.90.1" não). Devolve os dígitos concatenados (sem os pontos), ou `null` se inválido.
function digitosDeGrupoDeMilhar(parteInteira: string): string | null {
  if (!parteInteira.includes(".")) {
    return /^\d+$/.test(parteInteira) ? parteInteira : null;
  }
  const grupos = parteInteira.split(".");
  if (grupos.some((grupo) => grupo.length === 0)) {
    return null;
  }
  const [primeiroGrupo, ...gruposSeguintes] = grupos;
  if (!/^\d{1,3}$/.test(primeiroGrupo)) {
    return null;
  }
  if (!gruposSeguintes.every((grupo) => /^\d{3}$/.test(grupo))) {
    return null;
  }
  return grupos.join("");
}

function finalizarConversao(centavos: number): ResultadoDeConversaoDeDinheiro {
  if (centavos > TETO_CENTAVOS) {
    return { ok: false, erro: MENSAGEM_VALOR_ALTO };
  }
  return { ok: true, centavos };
}

// Regra, em português do Brasil (04.4-01-PLAN.md, Tarefa 1):
// - vazio (ou só espaço/símbolo) → NULO, nunca zero;
// - com vírgula: o que vem depois da última vírgula são 1 ou 2 dígitos de centavos, e os pontos
//   à esquerda são separador de milhar;
// - sem vírgula, um ÚNICO ponto seguido de 1 ou 2 dígitos no fim é ponto decimal (teclado de
//   celular que só tem ponto — "8.50" → 850, "8.5" → 850); pontos seguidos de grupos de 3
//   dígitos são separador de milhar ("1.500" → 150000, "24.900" → 2.490.000);
// - qualquer outra coisa (letra, sinal negativo, duas vírgulas, grupo de milhar incompleto,
//   fração com 3+ dígitos fora do caso decimal) é recusada com frase que diz como escrever.
export function converterReaisParaCentavos(textoBruto: string): ResultadoDeConversaoDeDinheiro {
  const normalizado = normalizar(textoBruto);

  if (normalizado === "") {
    return { ok: true, centavos: null };
  }

  if (!/^[\d.,]+$/.test(normalizado)) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  const partesPorVirgula = normalizado.split(",");
  if (partesPorVirgula.length > 2) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  if (partesPorVirgula.length === 2) {
    const [parteInteira, parteFracao] = partesPorVirgula;
    if (!/^\d{1,2}$/.test(parteFracao)) {
      return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
    }
    const digitosInteiros = digitosDeGrupoDeMilhar(parteInteira);
    if (digitosInteiros === null) {
      return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
    }
    const centavosDaFracao =
      parteFracao.length === 1 ? Number(parteFracao) * 10 : Number(parteFracao);
    const reais = digitosInteiros === "" ? 0 : Number(digitosInteiros);
    return finalizarConversao(reais * 100 + centavosDaFracao);
  }

  // Sem vírgula: um único ponto seguido de 1 ou 2 dígitos é ponto decimal (celular só com
  // ponto); qualquer outro formato de ponto é separador de milhar.
  const quantidadeDePontos = (normalizado.match(/\./g) ?? []).length;
  if (quantidadeDePontos === 1) {
    const [parteInteira, parteDepoisDoPonto] = normalizado.split(".");
    if (parteInteira !== "" && /^\d+$/.test(parteInteira) && /^\d{1,2}$/.test(parteDepoisDoPonto)) {
      const centavosDaFracao =
        parteDepoisDoPonto.length === 1
          ? Number(parteDepoisDoPonto) * 10
          : Number(parteDepoisDoPonto);
      return finalizarConversao(Number(parteInteira) * 100 + centavosDaFracao);
    }
  }

  const digitosInteiros = digitosDeGrupoDeMilhar(normalizado);
  if (digitosInteiros === null) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }
  return finalizarConversao(Number(digitosInteiros) * 100);
}

export type ResultadoDeConversaoDePercentual =
  | { ok: true; pontosBase: number }
  | { ok: false; erro: string };

const MENSAGEM_PERCENTUAL_INVALIDO =
  'Não deu para entender esse percentual. Escreva como "3,5" ou "3.5".';
const MENSAGEM_PERCENTUAL_FORA_DO_INTERVALO = "O percentual precisa estar entre 0 e 100.";

// "3,5" → 350 pontos-base; "3.5" → 350; "0" → 0; "100" → 10000. Vírgula ou ponto como
// separador decimal, até 2 casas, entre 0 e 100 inclusive.
export function converterPercentualParaPontosBase(
  textoBruto: string,
): ResultadoDeConversaoDePercentual {
  const normalizado = textoBruto.replace(/\s/g, "");

  if (!/^\d+([.,]\d{1,2})?$/.test(normalizado)) {
    return { ok: false, erro: MENSAGEM_PERCENTUAL_INVALIDO };
  }

  const valor = Number(normalizado.replace(",", "."));
  if (valor < 0 || valor > 100) {
    return { ok: false, erro: MENSAGEM_PERCENTUAL_FORA_DO_INTERVALO };
  }

  return { ok: true, pontosBase: Math.round(valor * 100) };
}

export type ResultadoDeConversaoDeQuantidade =
  | { ok: true; quantidade: string }
  | { ok: false; erro: string };

const MENSAGEM_QUANTIDADE_INVALIDA =
  'Não deu para entender essa quantidade. Escreva como "15" ou "0,04", maior que zero.';
const MENSAGEM_QUANTIDADE_ALTA = "Essa quantidade passa de 999.999 — confira o que foi digitado.";

// "0,04" → "0.04"; "15" → "15"; "2,250" → "2.25" — texto decimal normalizado com PONTO e até 3
// casas, maior que zero e até 999999. Vírgula ou ponto como separador decimal.
export function converterQuantidade(textoBruto: string): ResultadoDeConversaoDeQuantidade {
  const normalizado = textoBruto.replace(/\s/g, "").replace(",", ".");

  if (!/^\d+(\.\d{1,3})?$/.test(normalizado)) {
    return { ok: false, erro: MENSAGEM_QUANTIDADE_INVALIDA };
  }

  const valor = Number(normalizado);
  if (valor <= 0) {
    return { ok: false, erro: MENSAGEM_QUANTIDADE_INVALIDA };
  }
  if (valor > 999_999) {
    return { ok: false, erro: MENSAGEM_QUANTIDADE_ALTA };
  }

  return { ok: true, quantidade: String(valor) };
}
