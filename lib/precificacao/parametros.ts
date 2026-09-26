// Módulo puro (D-14 do CONTEXT.md, regra da pasta `lib/` do CLAUDE.md): zero `import` de valor,
// nenhuma leitura do relógio, nenhum React, nenhum cliente de banco. Mesmo molde de
// `lib/encomendas/cronograma.ts`/`lib/queimas/contador.ts`.
//
// `CATALOGO_DE_PARAMETROS` é a lista FECHADA das 18 chaves de `parametros_precificacao` — o
// `check` de `parametros_precificacao.chave` em `db/schema.ts`/`db/migrations/0017` e a semente
// de `db/migrations/0019` espelham esta lista literalmente. Três lugares, uma verdade: divergir
// quebra `npm run test:migracoes`. A taxa do cartão NÃO é uma destas chaves (D-16) — ela é lida
// de `configuracao_financeira.taxa_cartao_pontos_base` (Fase 04.4) e entra em `calcularPeca`
// (`lib/precificacao/calculo.ts`) por argumento.
//
// Cada entrada declara a ESCALA: o multiplicador entre o valor exibido na tela (unidade humana)
// e o inteiro guardado no banco. Dinheiro guarda em centavos (escala 100); percentual guarda em
// pontos-base (escala 100, 3,5% = 350 — mesma convenção de
// `configuracao_financeira.taxa_cartao_pontos_base`); medida física (cm/kWh/×) guarda em
// milésimos (escala 1000) — nunca ponto flutuante numa coluna que entra em cálculo.

export type GrupoDeParametro = "Material" | "Trabalho" | "Forno" | "Perda" | "No preço";

export type ChaveDeParametro =
  | "material_argila"
  | "material_esmalte"
  | "trabalho_hora"
  | "forno_tarifa_energia"
  | "forno_kwh_biscoito"
  | "forno_kwh_esmalte"
  | "forno_largura_util"
  | "forno_profundidade_util"
  | "forno_altura_util"
  | "forno_folga_entre_pecas"
  | "forno_prateleira_e_pilar"
  | "forno_fator_biscoito"
  | "forno_desgaste_por_fornada"
  | "perda_unica"
  | "preco_lucro"
  | "preco_folga_negociacao"
  | "preco_imposto_sobre_venda"
  | "preco_comissao_galeria";

export type DefinicaoDeParametro = {
  chave: ChaveDeParametro;
  grupo: GrupoDeParametro;
  rotulo: string;
  unidade: string;
  // Multiplicador entre o valor na unidade exibida e o inteiro guardado — ver nota acima.
  escala: number;
};

export const CATALOGO_DE_PARAMETROS: readonly DefinicaoDeParametro[] = [
  { chave: "material_argila", grupo: "Material", rotulo: "Argila", unidade: "R$/kg", escala: 100 },
  { chave: "material_esmalte", grupo: "Material", rotulo: "Esmalte", unidade: "R$/kg", escala: 100 },
  {
    chave: "trabalho_hora",
    grupo: "Trabalho",
    rotulo: "Sua hora de trabalho",
    unidade: "R$/h",
    escala: 100,
  },
  {
    chave: "forno_tarifa_energia",
    grupo: "Forno",
    rotulo: "Energia",
    unidade: "R$/kWh",
    escala: 100,
  },
  {
    chave: "forno_kwh_biscoito",
    grupo: "Forno",
    rotulo: "Gasto de uma fornada de biscoito",
    unidade: "kWh",
    escala: 1000,
  },
  {
    chave: "forno_kwh_esmalte",
    grupo: "Forno",
    rotulo: "Gasto de uma fornada de esmalte",
    unidade: "kWh",
    escala: 1000,
  },
  {
    chave: "forno_largura_util",
    grupo: "Forno",
    rotulo: "Largura útil do forno por dentro",
    unidade: "cm",
    escala: 1000,
  },
  {
    chave: "forno_profundidade_util",
    grupo: "Forno",
    rotulo: "Profundidade útil",
    unidade: "cm",
    escala: 1000,
  },
  {
    chave: "forno_altura_util",
    grupo: "Forno",
    rotulo: "Altura útil",
    unidade: "cm",
    escala: 1000,
  },
  {
    chave: "forno_folga_entre_pecas",
    grupo: "Forno",
    rotulo: "Folga entre peças esmaltadas",
    unidade: "cm",
    escala: 1000,
  },
  {
    chave: "forno_prateleira_e_pilar",
    grupo: "Forno",
    rotulo: "Prateleira + pilar, somados à altura da peça",
    unidade: "cm",
    escala: 1000,
  },
  {
    chave: "forno_fator_biscoito",
    grupo: "Forno",
    rotulo: "No biscoito cabem quantas vezes mais (peças se tocam e empilham)",
    unidade: "×",
    escala: 1000,
  },
  {
    chave: "forno_desgaste_por_fornada",
    grupo: "Forno",
    rotulo: "Desgaste do forno por fornada (resistência, termopar, prateleira)",
    unidade: "R$",
    escala: 100,
  },
  {
    chave: "perda_unica",
    grupo: "Perda",
    rotulo: "Peças que se perdem no caminho",
    unidade: "%",
    escala: 100,
  },
  { chave: "preco_lucro", grupo: "No preço", rotulo: "Lucro", unidade: "%", escala: 100 },
  {
    chave: "preco_folga_negociacao",
    grupo: "No preço",
    rotulo: "Folga para negociar",
    unidade: "%",
    escala: 100,
  },
  {
    chave: "preco_imposto_sobre_venda",
    grupo: "No preço",
    rotulo: "Imposto sobre a venda (MEI: 0 — o DAS é conta fixa)",
    unidade: "%",
    escala: 100,
  },
  {
    chave: "preco_comissao_galeria",
    grupo: "No preço",
    rotulo: "Comissão de galeria ou consignado",
    unidade: "%",
    escala: 100,
  },
];

function definicaoDe(chave: ChaveDeParametro): DefinicaoDeParametro {
  const definicao = CATALOGO_DE_PARAMETROS.find((item) => item.chave === chave);
  if (!definicao) {
    throw new RangeError(`"${chave}" não é uma chave de parâmetro conhecida.`);
  }
  return definicao;
}

// Unidade exibida → inteiro guardado. Ex.: `inteiroDaUnidade("material_argila", 10)` → 1000
// (R$ 10,00/kg em centavos). Arredonda para o inteiro mais próximo — a entrada vem de um campo
// de formulário, nunca de outro cálculo interno (que já trabalha só com inteiros).
export function inteiroDaUnidade(chave: ChaveDeParametro, valorExibido: number): number {
  return Math.round(valorExibido * definicaoDe(chave).escala);
}

// Inversa de `inteiroDaUnidade` — inteiro guardado → unidade exibida. Ex.:
// `valorNaUnidade("perda_unica", 350)` → 3,5 (%).
export function valorNaUnidade(chave: ChaveDeParametro, valorInteiro: number): number {
  return valorInteiro / definicaoDe(chave).escala;
}

export type LinhaDeParametro = {
  valorInteiro: number;
  medido: boolean;
  // Data civil "YYYY-MM-DD" — comparação lexicográfica de ISO-8601 coincide com ordenação
  // temporal, então nunca precisa virar `Date` (D-14: nenhum módulo puro instancia `Date`).
  vigenteDesde: string;
};

// A linha de maior `vigenteDesde` menor ou igual a `data` — o "vigente naquele dia". Uma linha
// com `vigenteDesde` no futuro nunca é escolhida; sem nenhuma linha válida, devolve `null` (não
// há parâmetro nenhum vigente naquela data — o chamador decide o que fazer). Empate de
// `vigenteDesde` é impossível na prática: `unique(chave, vigenteDesde)` no banco garante que o
// `historico` recebido aqui (já filtrado por uma chave) nunca tem duas linhas com a mesma data.
export function vigenteEm(
  historico: readonly LinhaDeParametro[],
  data: string,
): LinhaDeParametro | null {
  const validas = historico.filter((linha) => linha.vigenteDesde <= data);
  if (validas.length === 0) {
    return null;
  }
  return validas.reduce((maisRecente, atual) =>
    atual.vigenteDesde > maisRecente.vigenteDesde ? atual : maisRecente,
  );
}
