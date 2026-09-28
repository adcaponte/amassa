// Por que este módulo existe: o briefing do site (BRIEFING-site.md §4) manda CONFERIR o
// contraste da faixa amarela ("`--sol` com texto `--tinta` passa; conferir") — uma frase de
// plano não confere nada, um NÚMERO sim. `razaoDeContraste` calcula a razão de contraste WCAG
// 2.1 entre duas cores hex; `tests/unit/contraste.test.ts` lê os pares reais do site direto de
// `app/globals.css` (nunca hex repetido no teste) e exige 4.5 ou mais em cada um (SIT-10).
//
// Puro: zero import, nenhum `new Date()`, nenhum I/O — só matemática sobre duas strings hex.

const PADRAO_HEX = /^#?([0-9a-fA-F]{6})$/;

function normalizarHex(hex: string): [number, number, number] {
  const casado = hex.match(PADRAO_HEX);
  if (!casado) {
    throw new Error(
      `"${hex}" não é um hex de 6 dígitos válido (ex.: "#FFBD59" ou "FFBD59") — verifique o valor antes de medir o contraste.`,
    );
  }
  const seisDigitos = casado[1];
  const r = parseInt(seisDigitos.slice(0, 2), 16);
  const g = parseInt(seisDigitos.slice(2, 4), 16);
  const b = parseInt(seisDigitos.slice(4, 6), 16);
  return [r, g, b];
}

// Correção de gama de um canal sRGB normalizado (0–1), fórmula WCAG 2.1: abaixo do limite
// 0,03928 a curva é linear (evita o "afundamento" da fórmula de potência perto de zero);
// acima dela, a curva de potência 2.4 aproxima a resposta perceptual do olho humano.
function corrigirGama(canalNormalizado: number): number {
  return canalNormalizado <= 0.03928
    ? canalNormalizado / 12.92
    : Math.pow((canalNormalizado + 0.055) / 1.055, 2.4);
}

// Luminância relativa (0 = preto, 1 = branco) de uma cor hex, pela fórmula WCAG 2.1: os três
// canais corrigidos por gama, pesados pela sensibilidade do olho a cada um (mais verde, menos
// azul) — não uma média simples.
export function luminanciaRelativa(hex: string): number {
  const [r, g, b] = normalizarHex(hex);
  const rLinear = corrigirGama(r / 255);
  const gLinear = corrigirGama(g / 255);
  const bLinear = corrigirGama(b / 255);
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

// Razão de contraste WCAG 2.1 entre duas cores hex: (L1 + 0,05) / (L2 + 0,05), com a mais clara
// SEMPRE no numerador — por isso a função é simétrica (a ordem dos argumentos não importa).
// Varia de 1 (nenhum contraste) a 21 (preto sobre branco, o máximo possível).
export function razaoDeContraste(hexA: string, hexB: string): number {
  const luminanciaA = luminanciaRelativa(hexA);
  const luminanciaB = luminanciaRelativa(hexB);
  const maisClara = Math.max(luminanciaA, luminanciaB);
  const maisEscura = Math.min(luminanciaA, luminanciaB);
  return (maisClara + 0.05) / (maisEscura + 0.05);
}
