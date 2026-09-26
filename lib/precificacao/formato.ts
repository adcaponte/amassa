// Módulo puro: converte os inteiros do banco (miligramas, milésimos, milímetros) para o texto que
// o dono lê, com vírgula decimal — mesma disciplina de `lib/financeiro/formato.ts`. `tabular-nums`
// é responsabilidade do CHAMADOR (className no componente), nunca deste módulo. NUNCA importa
// `./textos.ts` e nunca é importado por ele — a mesma regra cuja falta rendeu um bug real de build
// (`04.5-01-SUMMARY.md`, deviation 1: um comentário com `*/` fechou um bloco de CSS mais cedo;
// aqui a disciplina é sobre imports, não sobre comentários, mas o princípio é o mesmo: módulos com
// responsabilidades diferentes não se misturam).

function paraTextoComVirgula(valor: number, casasMaximas: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casasMaximas }).format(valor);
}

// "450 g" a partir de 450000 miligramas (escala 1000, mesma de `lib/precificacao/parametros.ts`).
export function formatarGramas(miligramas: number): string {
  return `${paraTextoComVirgula(miligramas / 1000, 3)} g`;
}

// "0,6 h" a partir de 600 milésimos de hora.
export function formatarHoras(horasMilesimos: number): string {
  return `${paraTextoComVirgula(horasMilesimos / 1000, 3)} h`;
}

// "12 cm" a partir de 120 milímetros (escala 10 — a mesma da conversão de medida da ficha).
export function formatarCentimetros(milimetros: number): string {
  return `${paraTextoComVirgula(milimetros / 10, 2)} cm`;
}
