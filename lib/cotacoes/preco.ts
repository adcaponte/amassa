// Módulo puro do Comparador de Compras (D-08): converte o texto que a pessoa digita no campo de
// preço para um número inteiro de centavos, ou para `null` ("sob consulta", D-07 — campo em
// branco NUNCA vira zero, e zero NUNCA vira nulo, são informações diferentes). Zero imports,
// nenhuma instância de `Date` — mesma disciplina de `lib/abertura/parcelas.ts`.
//
// Regra, em português do Brasil: descarta o símbolo da moeda e todo espaço (inclusive o não
// separável); texto vazio ou só com espaço/símbolo devolve NULO; se houver vírgula, o que vem
// depois dela são os centavos (um ou dois dígitos) e os pontos à esquerda são separador de
// milhar; sem vírgula, os pontos (se houver) são separador de milhar e o resultado é reais
// inteiros. Recusa, com frase que diz o que fazer: letra, sinal, mais de uma vírgula, grupo de
// milhar que não tem três dígitos, e valor acima do teto de dez milhões de reais.
export type ResultadoDeConversaoDePreco =
  | { ok: true; centavos: number | null }
  | { ok: false; erro: string };

// No máximo duas frases de recusa (D-08 do plano): uma para "não deu para entender", com exemplo
// de como escrever, e uma para "valor alto demais". Nunca uma terceira variação — mais frases não
// ajudam quem só quer saber o que fazer.
const MENSAGEM_FORMATO_INVALIDO =
  'Não deu para entender esse preço. Escreva como "24900", "24.900" ou "R$ 24.900,00" — ou deixe em branco para "sob consulta".';
const MENSAGEM_VALOR_ALTO =
  "Esse valor passa de R$ 10.000.000 — confira se não é erro de digitação.";

// Mesmo teto de `abertura_itens_valor_nao_negativo` (db/schema.ts) e de
// `cotacoes_preco_no_intervalo`: mantém a conta longe do limite do inteiro de 32 bits, e um valor
// acima disso é erro de digitação, não compra de ateliê.
const TETO_CENTAVOS = 1_000_000_000;

// Descarta o símbolo da moeda ("R$", em qualquer caixa) e todo espaço — inclusive o espaço não
// separável (` `) que fica entre o símbolo e o número, que `\s` do JavaScript já cobre.
function normalizar(textoBruto: string): string {
  return textoBruto.replace(/r\$/gi, "").replace(/\s/g, "");
}

// Um grupo de milhar só é válido se: sem ponto nenhum (o texto todo é um bloco de dígitos, aceito
// sem exigir agrupamento — é o caso de "1234567", sete dígitos digitados corridos); OU com ponto,
// primeiro grupo de 1 a 3 dígitos e todo grupo seguinte com EXATAMENTE 3 — "24.900" vale,
// "24.90" (grupo de dois dígitos) não.
function gruposDeMilharValidos(parteInteiraComSeparadores: string): boolean {
  if (!parteInteiraComSeparadores.includes(".")) {
    return true;
  }
  const grupos = parteInteiraComSeparadores.split(".");
  if (grupos.some((grupo) => grupo.length === 0)) {
    return false;
  }
  const [primeiroGrupo, ...gruposSeguintes] = grupos;
  if (primeiroGrupo.length < 1 || primeiroGrupo.length > 3) {
    return false;
  }
  return gruposSeguintes.every((grupo) => grupo.length === 3);
}

export function converterPrecoParaCentavos(textoBruto: string): ResultadoDeConversaoDePreco {
  const normalizado = normalizar(textoBruto);

  // Texto vazio, só espaço ou só o símbolo da moeda: sob consulta, nunca zero (D-07).
  if (normalizado === "") {
    return { ok: true, centavos: null };
  }

  // Mais de uma vírgula ("1,2,3") não tem leitura válida nenhuma.
  const partes = normalizado.split(",");
  if (partes.length > 2) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  const [parteInteiraBruta, parteFracaoBruta] = partes;

  if (!gruposDeMilharValidos(parteInteiraBruta)) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  const parteInteira = parteInteiraBruta.replace(/\./g, "");
  // Sinal negativo, letra ou qualquer outro caractere fora de [0-9.,] já foi descartado pela
  // normalização de espaço/símbolo, mas nunca por acaso: só dígito puro passa daqui em diante.
  if (!/^\d+$/.test(parteInteira)) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  let centavosDaFracao = 0;
  if (parteFracaoBruta !== undefined) {
    if (!/^\d{1,2}$/.test(parteFracaoBruta)) {
      return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
    }
    // Um dígito só de centavos é décimo de real ("10,5" → 50 centavos); dois dígitos são
    // centavos de verdade ("10,50" → 50 centavos).
    centavosDaFracao =
      parteFracaoBruta.length === 1 ? Number(parteFracaoBruta) * 10 : Number(parteFracaoBruta);
  }

  const reais = Number(parteInteira);
  const centavos = reais * 100 + centavosDaFracao;

  if (centavos > TETO_CENTAVOS) {
    return { ok: false, erro: MENSAGEM_VALOR_ALTO };
  }

  return { ok: true, centavos };
}
