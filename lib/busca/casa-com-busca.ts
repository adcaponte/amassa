// A busca por PALAVRAS e sem acento, comum a todo o sistema (Fase 06.5, plano 09; D-17, POL-09).
// Módulo puro: não importa nada — nem React, nem Next, nem o banco.
//
// A regra é a mesma de `nome_normalizado()` do banco (migrações 0002 e 0026: `trim`, espaços
// colapsados, `unaccent`, `lower`). Assim, o que a Venda e a Compra acham no navegador e o que
// `listarClientes` acha no servidor (um `like` por palavra) não divergem.
//
// "cowork caneca" acha "[teste cowork] Caneca": TODA palavra digitada precisa aparecer no texto, em
// qualquer ordem, como pedaço de palavra ("cane" acha "Caneca"). Sem pg_trgm, sem distância de
// edição: a escrita errada não acha, e o vazio diz isso ("Tente uma palavra só").

// Quantas palavras do termo contam. As demais são ignoradas: um termo colado com centenas de
// palavras não vira centenas de condições (T-06.5-19).
export const TETO_DE_PALAVRAS = 10;

// NFD, fora as marcas combinantes (acento, cedilha, mácron), minúsculas, espaços colapsados, sem
// espaço nas pontas. Vale para o termo E para o texto em que se procura — "ÇÃO" casa "cao".
export function normalizarParaBusca(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// As palavras do termo, já normalizadas, sem as vazias, no máximo `TETO_DE_PALAVRAS`.
export function palavrasDaBusca(termo: string): string[] {
  const normalizado = normalizarParaBusca(termo);
  if (normalizado === "") {
    return [];
  }
  return normalizado.split(" ").slice(0, TETO_DE_PALAVRAS);
}

// Termo sem palavra nenhuma casa com tudo (a lista inteira). Senão, cada palavra precisa estar
// contida no texto normalizado.
export function casaComBusca(texto: string, termo: string): boolean {
  const palavras = palavrasDaBusca(termo);
  if (palavras.length === 0) {
    return true;
  }
  const alvo = normalizarParaBusca(texto);
  return palavras.every((palavra) => alvo.includes(palavra));
}
