// Módulo puro: recebe dados, devolve dados. Zero imports (regra de `lib/encomendas/cronograma.ts`
// / `lib/backup/frescor.ts`, CLAUDE.md §Regras de negócio) — sem React, sem cliente de banco, sem
// `date-fns`, nem `import type`. As regras da contagem opcional de uma queima (Fase 06.4, BRIEFING
// §2): seis contadores inteiros ≥ 0 — Internas P · M · G e Externas P · M · G — e "o forno saiu
// cheio" (marcado por padrão). Uma contagem com total 0 não existe: "sem contagem" é a AUSÊNCIA da
// linha em `queima_contagens`.
//
// O teto `TETO_DO_CONTADOR` é o MESMO dos checks `queima_contagens_*_faixa` da 0030 e de
// `esquemaContagem` (`lib/queimas/esquemas.ts`) — três cópias deliberadas; mudar uma é mudar todas.

export type Tamanho = "P" | "M" | "G";

export type Contagem = {
  internasP: number;
  internasM: number;
  internasG: number;
  externasP: number;
  externasM: number;
  externasG: number;
  saiuCheio: boolean;
};

export type ChaveDoContador =
  | "internasP"
  | "internasM"
  | "internasG"
  | "externasP"
  | "externasM"
  | "externasG";

// A folha abre com tudo zero e "saiu cheio" MARCADO (briefing §2: marcado por padrão).
export const CONTAGEM_VAZIA: Contagem = {
  internasP: 0,
  internasM: 0,
  internasG: 0,
  externasP: 0,
  externasM: 0,
  externasG: 0,
  saiuCheio: true,
};

export const TETO_DO_CONTADOR = 10000;

// Na ordem da folha: Internas P, M, G, depois Externas P, M, G.
export const CHAVES_DOS_CONTADORES: readonly ChaveDoContador[] = [
  "internasP",
  "internasM",
  "internasG",
  "externasP",
  "externasM",
  "externasG",
];

export function totalDasInternas(contagem: Contagem): number {
  return contagem.internasP + contagem.internasM + contagem.internasG;
}

export function totalDasExternas(contagem: Contagem): number {
  return contagem.externasP + contagem.externasM + contagem.externasG;
}

export function totalDaContagem(contagem: Contagem): number {
  return totalDasInternas(contagem) + totalDasExternas(contagem);
}

export function contagemVazia(contagem: Contagem): boolean {
  return totalDaContagem(contagem) === 0;
}

// O campo do contador só aceita dígitos, mas o valor que chega aqui pode ser qualquer coisa (campo
// vazio vira `NaN`): não-número → 0, abaixo de 0 → 0, acima do teto → teto, decimal → truncado.
export function limitarContador(valor: number): number {
  if (!Number.isFinite(valor)) {
    return 0;
  }
  const inteiro = Math.trunc(valor);
  if (inteiro < 0) {
    return 0;
  }
  return inteiro > TETO_DO_CONTADOR ? TETO_DO_CONTADOR : inteiro;
}

// "2026-12-18" → "18/12" — o dia civil já vem convertido para Brasília por quem chama
// (`diaCivilEmBrasilia`, `lib/queimas/formato.ts`).
export function diaMes(diaCivil: string): string {
  const [, mes, dia] = diaCivil.split("-");
  return `${dia}/${mes}`;
}

// ---------------------------------------------------------------------------------------------
// D-07 (decisão do dono, 04/10/2026): uma queima com externas pode ter VÁRIAS vendas, uma por
// pessoa, cada uma com a sua quantidade por tamanho (P · M · G) — nunca uma venda por peça como
// regra. O que está lançado é DERIVADO das vendas ligadas: só as ATIVAS (não canceladas) somam;
// uma venda cancelada no Caixa devolve a quantidade dela a "a cobrar" sem nada ser gravado (o
// princípio da D-08 da Agenda). O piso: a soma lançada em vendas ativas nunca passa das externas
// contadas, por tamanho — baixar a contagem abaixo do lançado é recusado (`abaixoDoLancado`).

export type Quantidades = { p: number; m: number; g: number };

export const QUANTIDADES_ZERADAS: Quantidades = { p: 0, m: 0, g: 0 };

// Uma venda ligada a uma queima, como as Queimas a enxergam: o número (para a frase), se o Caixa a
// cancelou, se está paga (nenhuma parcela em aberto) e a quantidade de cada tamanho que ela levou.
export type VendaLigada = {
  documentoId: string;
  numero: number;
  cancelada: boolean;
  paga: boolean;
  quantidades: Quantidades;
};

const TAMANHOS_EM_ORDEM: readonly { tamanho: Tamanho; chave: keyof Quantidades }[] = [
  { tamanho: "P", chave: "p" },
  { tamanho: "M", chave: "m" },
  { tamanho: "G", chave: "g" },
];

export function totalDasQuantidades(quantidades: Quantidades): number {
  return quantidades.p + quantidades.m + quantidades.g;
}

export function externasDaContagem(contagem: Contagem): Quantidades {
  return { p: contagem.externasP, m: contagem.externasM, g: contagem.externasG };
}

// Σ das vendas ATIVAS, por tamanho — a cancelada não soma.
export function lancadoAtivo(vendas: readonly VendaLigada[]): Quantidades {
  const soma = { ...QUANTIDADES_ZERADAS };
  for (const venda of vendas) {
    if (venda.cancelada) {
      continue;
    }
    soma.p += venda.quantidades.p;
    soma.m += venda.quantidades.m;
    soma.g += venda.quantidades.g;
  }
  return soma;
}

// O que ainda falta cobrar, por tamanho: externas − lançado, nunca negativo.
export function faltaCobrar(externas: Quantidades, lancado: Quantidades): Quantidades {
  return {
    p: Math.max(0, externas.p - lancado.p),
    m: Math.max(0, externas.m - lancado.m),
    g: Math.max(0, externas.g - lancado.g),
  };
}

// Cada tamanho do pedido cabe no que falta. A exigência de ao menos uma peça é de quem chama.
export function cabeNoQueFalta(pedido: Quantidades, falta: Quantidades): boolean {
  return pedido.p <= falta.p && pedido.m <= falta.m && pedido.g <= falta.g;
}

// O primeiro tamanho, na ordem P, M, G, em que as externas novas ficam ABAIXO do já lançado em
// vendas ativas; `null` quando nenhum fica (igual pode; subir é sempre livre).
export function abaixoDoLancado(externasNovas: Quantidades, lancado: Quantidades): Tamanho | null {
  for (const { tamanho, chave } of TAMANHOS_EM_ORDEM) {
    if (externasNovas[chave] < lancado[chave]) {
      return tamanho;
    }
  }
  return null;
}

// A chave de `Quantidades` de um tamanho — para quem precisa ler "o lançado no P".
export function chaveDoTamanho(tamanho: Tamanho): keyof Quantidades {
  return tamanho === "P" ? "p" : tamanho === "M" ? "m" : "g";
}
