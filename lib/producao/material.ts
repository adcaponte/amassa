// Módulo puro da Produção — o MATERIAL da ordem (Fase 06.1, plano 10, PRD-14): quanto de argila e de
// esmalte a ordem deveria gastar, quanto já saiu do Estoque para ela e quanto falta. Só imports de
// tipo de módulos puros; nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`.
//
// Tudo em INTEIROS de miligramas — a escala da ficha (`argila_miligramas`, `esmalte_miligramas`).
// A conversão para a unidade do item só acontece em `baixaTotalSugerida`, com arredondamento meio
// para cima, uma vez.
//
// A unidade manda (Pitfall 10): `quantidade_milesimos` do livro está na unidade do ITEM. Em `kg`, um
// milésimo é um grama (1 000 mg); em `g`, um milésimo é um miligrama. `un`, `ml`, `l` e `m` não se
// comparam com a grama da ficha — ficam fora do "baixado X de Y kg" e são contados à parte.
import type { Unidade } from "@/lib/cadastros/catalogo";

import type { CaminhoOrdem } from "./etapas";

// Espelha o enum `material_da_ordem` da 0024 — redeclarado, sem import do schema.
export type MaterialDaOrdem = "argila" | "esmalte";

// Uma peça da ordem no que o previsto precisa: as feitas (pedido + a mais) e as gramas da ficha,
// lidas AO VIVO pela `ficha_id` (a ficha é referência). `null` = peça sem ficha (D-04).
export type PecaParaPrevisto = {
  quantidade: number;
  aMais: number;
  ficha: { argilaMiligramas: number; esmalteMiligramas: number } | null;
};

export type MaterialPrevisto = {
  argilaMg: number;
  esmalteMg: number;
  // As peças FEITAS (pedido + a mais) que ficaram fora do previsto por não terem ficha.
  pecasSemFicha: number;
};

// Σ (gramas da ficha × peças feitas) para argila e esmalte. No caminho "termina no biscoito" o
// esmalte previsto é zero, mesmo com gramas na ficha (Pitfall 9) — a ordem não passa pela
// esmaltação.
export function materialPrevisto(
  pecas: readonly PecaParaPrevisto[],
  caminho: CaminhoOrdem,
): MaterialPrevisto {
  let argilaMg = 0;
  let esmalteMg = 0;
  let pecasSemFicha = 0;
  for (const peca of pecas) {
    const feitas = peca.quantidade + peca.aMais;
    if (peca.ficha === null) {
      pecasSemFicha += feitas;
      continue;
    }
    argilaMg += peca.ficha.argilaMiligramas * feitas;
    esmalteMg += peca.ficha.esmalteMiligramas * feitas;
  }
  return {
    argilaMg,
    esmalteMg: caminho === "biscoito" ? 0 : esmalteMg,
    pecasSemFicha,
  };
}

// Quantos miligramas vale UM milésimo da unidade do item; `null` = unidade que não se compara com
// a grama da ficha.
export function miligramasPorMilesimo(unidade: Unidade): number | null {
  if (unidade === "kg") {
    return 1000;
  }
  if (unidade === "g") {
    return 1;
  }
  return null;
}

// Uma baixa da ordem como o livro a guarda: a quantidade COM SINAL (a saída é negativa), a unidade
// do item e o material marcado na baixa (`null` = "outro material").
export type BaixaParaSomar = {
  quantidadeMilesimos: number;
  unidade: Unidade;
  material: MaterialDaOrdem | null;
};

export type BaixadoDoMaterial = {
  mg: number;
  // Baixas deste material em unidade não comparável — "{N} baixas em outras unidades".
  foraDaConta: number;
};

// O que já saiu do Estoque para este material, em miligramas (positivo).
export function baixadoEmMg(
  baixas: readonly BaixaParaSomar[],
  material: MaterialDaOrdem,
): BaixadoDoMaterial {
  let mg = 0;
  let foraDaConta = 0;
  for (const baixa of baixas) {
    if (baixa.material !== material) {
      continue;
    }
    const fator = miligramasPorMilesimo(baixa.unidade);
    if (fator === null) {
      foraDaConta += 1;
      continue;
    }
    mg += -baixa.quantidadeMilesimos * fator;
  }
  return { mg, foraDaConta };
}

export type SituacaoDoMaterial =
  | { tipo: "completo" }
  | { tipo: "faltam"; diferencaMg: number }
  | { tipo: "passou"; diferencaMg: number };

// "previsto todo baixado" / "faltam {Z} kg do previsto" / "gastou {Z} kg a mais que o previsto".
export function situacaoDoMaterial(previstoMg: number, baixadoMg: number): SituacaoDoMaterial {
  if (baixadoMg === previstoMg) {
    return { tipo: "completo" };
  }
  if (baixadoMg > previstoMg) {
    return { tipo: "passou", diferencaMg: baixadoMg - previstoMg };
  }
  return { tipo: "faltam", diferencaMg: previstoMg - baixadoMg };
}

// O que a "Baixa total" traz preenchido: max(0, previsto − baixado), em MILÉSIMOS DA UNIDADE DO ITEM,
// arredondado meio para cima. `null` = unidade não comparável (o campo vem vazio).
export function baixaTotalSugerida(
  previstoMg: number,
  baixadoMg: number,
  unidade: Unidade,
): number | null {
  return mgEmMilesimos(Math.max(0, previstoMg - baixadoMg), unidade);
}

// Miligramas (≥ 0) → milésimos da unidade, meio para cima; `null` = unidade não comparável. É
// também o que a tela usa para mostrar "{X} kg" (`mgEmMilesimos(mg, "kg")`).
export function mgEmMilesimos(mg: number, unidade: Unidade): number | null {
  const fator = miligramasPorMilesimo(unidade);
  if (fator === null) {
    return null;
  }
  // Inteiros não negativos: `floor((2·a + d) / (2·d))` é a divisão com meio para cima, exata.
  return Math.floor((2 * mg + fator) / (2 * fator));
}
