// Módulo puro (D-14): o ÚNICO import de VALOR permitido aqui é `arredondarBonito` — a mesma
// regra de arredondamento que "Sugestão para começar" (`lib/orcamentos/acoes.ts::
// precoInicialDaLinha`) já usa, nunca reimplementada. Todo o resto é `import type` (nenhum React,
// nenhum cliente de banco, nenhuma leitura do relógio).
//
// 🔴 "Atualizar preços" (D-23, 04.5-CONTEXT.md) compara, peça a peça, o mínimo de ANTES com o
// mínimo de HOJE e sugere um preço novo que preserva a razão preço ÷ mínimo que o dono tinha dado
// na época. A diferença entre os dois modos que este módulo aceita — orçamento CONGELADO (o
// mínimo de antes vem do snapshot) e orçamento RASCUNHO (não existe um "antes" a comparar) — é
// de ORIGEM do mínimo anterior, nunca de regra: no rascunho não há razão a preservar, só o piso
// de hoje a respeitar (nunca baixa um preço que já estava acima dele).
import { arredondarBonito } from "@/lib/precificacao/calculo";

// Tolerância de comparação entre dois mínimos (D-23): uma diferença menor que isto é "igual", não
// "mudou" — nomeada, nunca um número solto no meio do código.
const TOLERANCIA_CENTAVOS = 1;

export type DirecaoDoMinimo = "subiu" | "caiu" | "igual";

// Uma linha do orçamento pronta para comparar. `minimoCongeladoCentavos`:
// - um número (inclusive zero) → orçamento CONGELADO: zero significa que a peça não calculava no
//   instante do congelamento (D-11/D-12) — "sem razão anterior", nunca uma divisão por zero;
// - `null` → orçamento RASCUNHO: não existe mínimo anterior nenhum (nunca confundir com zero).
export type LinhaParaAtualizar = {
  linhaId: string;
  nome: string;
  precoAtualCentavos: number;
  minimoDeHojeCentavos: number;
  minimoCongeladoCentavos: number | null;
};

// A sugestão de uma linha — sempre a MESMA forma, nos dois modos (key_link do plano: `sugerirPrecos`
// é a única função, o diálogo e o teste unitário são os dois únicos chamadores). `direcao`/
// `percentualAbsoluto` só existem quando há um mínimo anterior de verdade para comparar
// (`temRazaoAnterior === true`) — `null` no rascunho e na peça "sem razão anterior".
export type SugestaoDePreco = {
  linhaId: string;
  nome: string;
  precoAtualCentavos: number;
  minimoDeHojeCentavos: number;
  minimoCongeladoCentavos: number | null;
  precoSugeridoCentavos: number;
  temRazaoAnterior: boolean;
  direcao: DirecaoDoMinimo | null;
  // Percentual absoluto da variação do mínimo, com uma casa decimal (ex.: 12.3 = "12,3%") — a
  // formatação para tela é de quem chama, nunca deste módulo (nenhuma conversão para texto aqui).
  percentualAbsoluto: number | null;
};

function arredondarUmaCasaDecimal(valor: number): number {
  return Math.round(valor * 10) / 10;
}

// Modo RASCUNHO (sem snapshot): não há razão a preservar, só o piso de hoje a respeitar — nunca
// baixa um preço que já estava no mínimo de hoje ou acima dele.
function sugerirPrecoSemRazaoAnterior(linha: LinhaParaAtualizar): SugestaoDePreco {
  const precoSugeridoCentavos =
    linha.precoAtualCentavos >= linha.minimoDeHojeCentavos
      ? linha.precoAtualCentavos
      : arredondarBonito(linha.minimoDeHojeCentavos);

  return {
    linhaId: linha.linhaId,
    nome: linha.nome,
    precoAtualCentavos: linha.precoAtualCentavos,
    minimoDeHojeCentavos: linha.minimoDeHojeCentavos,
    minimoCongeladoCentavos: linha.minimoCongeladoCentavos,
    precoSugeridoCentavos,
    temRazaoAnterior: false,
    direcao: null,
    percentualAbsoluto: null,
  };
}

// Modo CONGELADO, com um mínimo anterior de verdade (> 0) para comparar: a razão preço ÷ mínimo
// da época, aplicada ao mínimo de hoje, e só então arredondada.
function sugerirPrecoComRazaoAnterior(
  linha: LinhaParaAtualizar,
  minimoCongeladoCentavos: number,
): SugestaoDePreco {
  const diferenca = linha.minimoDeHojeCentavos - minimoCongeladoCentavos;

  if (Math.abs(diferenca) < TOLERANCIA_CENTAVOS) {
    // Nada mudou (dentro da tolerância): a sugestão é o preço atual, sem arredondar para cima —
    // atualizar não pode SUBIR um preço que já estava correto só porque o dono clicou o botão.
    return {
      linhaId: linha.linhaId,
      nome: linha.nome,
      precoAtualCentavos: linha.precoAtualCentavos,
      minimoDeHojeCentavos: linha.minimoDeHojeCentavos,
      minimoCongeladoCentavos,
      precoSugeridoCentavos: linha.precoAtualCentavos,
      temRazaoAnterior: true,
      direcao: "igual",
      percentualAbsoluto: 0,
    };
  }

  // A razão preço ÷ mínimo da época, aplicada ao mínimo de hoje (D-23) — `Math.round` numa
  // expressão SÓ, sem passar por uma fração intermediária. Inverter a ordem (arredondar a razão
  // antes de multiplicar pelo mínimo de hoje, ou vice-versa em outra ordem) muda o resultado em
  // centavos e não é o que o protótipo aprovado faz (`bonito(l.pu*c.piso/a.piso)`).
  const precoNaRazao = Math.round(
    (linha.precoAtualCentavos * linha.minimoDeHojeCentavos) / minimoCongeladoCentavos,
  );
  const percentualAbsoluto = arredondarUmaCasaDecimal(
    Math.abs(diferenca / minimoCongeladoCentavos) * 100,
  );

  return {
    linhaId: linha.linhaId,
    nome: linha.nome,
    precoAtualCentavos: linha.precoAtualCentavos,
    minimoDeHojeCentavos: linha.minimoDeHojeCentavos,
    minimoCongeladoCentavos,
    precoSugeridoCentavos: arredondarBonito(precoNaRazao),
    temRazaoAnterior: true,
    direcao: diferenca > 0 ? "subiu" : "caiu",
    percentualAbsoluto,
  };
}

function sugerirPrecoDaLinha(linha: LinhaParaAtualizar): SugestaoDePreco {
  if (linha.minimoCongeladoCentavos === null) {
    return sugerirPrecoSemRazaoAnterior(linha);
  }

  // Peça cujo cálculo não fechava no instante do congelamento (D-11/D-12): mínimo congelado
  // zero, nenhuma razão a preservar — nunca uma divisão por zero. A sugestão vira o mínimo de
  // hoje, arredondado, exatamente como no modo rascunho.
  if (linha.minimoCongeladoCentavos === 0) {
    return sugerirPrecoSemRazaoAnterior({ ...linha, minimoCongeladoCentavos: 0 });
  }

  return sugerirPrecoComRazaoAnterior(linha, linha.minimoCongeladoCentavos);
}

// A ÚNICA função de sugestão do módulo (key_link do plano): a mesma que o diálogo usa para
// mostrar e que o teste unitário cobre — o servidor (`lib/orcamentos/acoes.ts::atualizarPrecos`)
// nunca a chama, só valida e grava o que o dono confirmou.
export function sugerirPrecos(linhas: LinhaParaAtualizar[]): SugestaoDePreco[] {
  return linhas.map(sugerirPrecoDaLinha);
}

// Verdadeiro quando ao menos uma linha CONGELADA (`minimoCongeladoCentavos` não nulo) tem o
// mínimo de hoje diferente do congelado além da tolerância — ignora linhas em modo rascunho (não
// há "mudou" a perguntar quando não existe um "antes"). Usado para decidir o aviso "Nada mudou
// nos custos desde então..." do diálogo.
export function algoMudou(sugestoes: SugestaoDePreco[]): boolean {
  return sugestoes.some(
    (sugestao) =>
      sugestao.minimoCongeladoCentavos !== null &&
      Math.abs(sugestao.minimoDeHojeCentavos - sugestao.minimoCongeladoCentavos) >= TOLERANCIA_CENTAVOS,
  );
}
