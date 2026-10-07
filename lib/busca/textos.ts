// As frases da busca por palavras (Fase 06.5, plano 09; D-17). Iguais na Venda, na Compra e nas
// pessoas — por isso moram aqui, e não no módulo de cada uma. Verbatim de 06.5-UI-SPEC.md
// §"Estados vazios". Módulo puro: não importa nada.

// "Nada encontrado para “cowork caneca”." — o termo como a pessoa digitou, sem os espaços das pontas.
export function fraseNadaEncontradoPara(termo: string): string {
  return `Nada encontrado para “${termo.trim()}”.`;
}

export const DICA_BUSCA_POR_PALAVRAS =
  "A busca acha cada palavra, em qualquer ordem e com ou sem acento. Tente uma palavra só.";
