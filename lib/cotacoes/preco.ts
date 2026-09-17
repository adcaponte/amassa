// Módulo puro do Comparador de Compras (D-08): converte o texto que a pessoa digita no campo de
// preço para um número inteiro de centavos, ou para `null` ("sob consulta", D-07 — campo em
// branco NUNCA vira zero, e zero NUNCA vira nulo, são informações diferentes). Zero imports,
// nenhuma instância de `Date` — mesma disciplina de `lib/abertura/parcelas.ts`.
//
// NESTA TAREFA (Tarefa 1, o traçado ponta a ponta): a função já cobre corretamente as quatro
// formas de D-08 (só dígitos, com separador de milhar, com centavos, com o símbolo da moeda) e o
// campo vazio — é o que o formulário real usa. A validação completa das recusas (letra, sinal
// negativo, grupo de milhar mal formado, teto de dez milhões) e das bordas (um dígito de
// centavos, sete dígitos sem separador) é completada TESTE-PRIMEIRO na Tarefa 2 deste plano
// (`tests/unit/cotacoes-preco.test.ts`), sem reescrever esta assinatura.

export type ResultadoDeConversaoDePreco =
  | { ok: true; centavos: number | null }
  | { ok: false; erro: string };

const MENSAGEM_FORMATO_INVALIDO =
  'Não deu para entender esse preço. Escreva como "24900", "24.900" ou "R$ 24.900,00" — ou deixe em branco para "sob consulta".';

// Descarta o símbolo da moeda ("R$", em qualquer caixa) e todo espaço — inclusive o espaço não
// separável (` `) que fica entre o símbolo e o número, que `\s` do JavaScript já cobre.
function normalizar(textoBruto: string): string {
  return textoBruto.replace(/r\$/gi, "").replace(/\s/g, "");
}

export function converterPrecoParaCentavos(textoBruto: string): ResultadoDeConversaoDePreco {
  const normalizado = normalizar(textoBruto);

  // Texto vazio, só espaço ou só o símbolo da moeda: sob consulta, nunca zero (D-07).
  if (normalizado === "") {
    return { ok: true, centavos: null };
  }

  const partes = normalizado.split(",");
  if (partes.length > 2) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  const [parteInteiraBruta, parteFracaoBruta] = partes;
  const parteInteira = parteInteiraBruta.replace(/\./g, "");

  if (!/^\d+$/.test(parteInteira)) {
    return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
  }

  let centavosDaFracao = 0;
  if (parteFracaoBruta !== undefined) {
    if (!/^\d{1,2}$/.test(parteFracaoBruta)) {
      return { ok: false, erro: MENSAGEM_FORMATO_INVALIDO };
    }
    // Um dígito só de centavos é décimo de real ("10,5" → 50 centavos), dois dígitos são
    // centavos de verdade ("10,50" → 50 centavos) — a Tarefa 2 cobre este caso em teste próprio.
    centavosDaFracao =
      parteFracaoBruta.length === 1 ? Number(parteFracaoBruta) * 10 : Number(parteFracaoBruta);
  }

  const reais = Number(parteInteira);
  return { ok: true, centavos: reais * 100 + centavosDaFracao };
}
