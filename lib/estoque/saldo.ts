// Módulo puro do Estoque — a REGRA DE ALERTA e a arrumação da lista de saldos (plano 06-04).
//
// A regra de alerta mora aqui e SÓ aqui — a lista, o banner, o contador e o bloco do Início (plano
// 06-10) a leem; nenhum componente compara saldo com mínimo por conta própria. EST-04 é literal:
// mínimo zero nunca alerta, e negativo é aviso próprio (D-21), nunca disfarçado de "acabando".
//
// Nenhum import que alcance React, Next, drizzle-orm, pg ou `@/db`; não lê o relógio. Os imports
// de valor são só de módulos também puros e sem import nenhum (`custo.ts`, `textos.ts`). Números
// formatados (dinheiro, quantidade) chegam por função de quem chama — este módulo não formata.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import type { Unidade } from "@/lib/cadastros/catalogo";

import { custoMedioCentavosPorUnidade, type EntradaComPreco } from "./custo";
import {
  PREFIXO_LINHA_NEGATIVOS,
  textoContador,
  textoEMais,
  tituloBannerAcabando,
  tituloBannerNegativos,
} from "./textos";

export type SituacaoDoSaldo = "negativo" | "acabando" | "ok";

// O filtro Ativos · Desativados · Todos (D-20, UI-D4) — mesma forma de `FiltroDeForno`.
export type FiltroDeSituacao = "ativos" | "desativados" | "todos";

// O que a lista precisa de cada material — redeclaração estrutural do `SaldoDoItem` de
// `consultas.ts` (que não pode ser importado aqui: aquele módulo alcança o banco).
export type SaldoParaLista = {
  readonly id: string;
  readonly nome: string;
  readonly unidade: Unidade;
  readonly ativo: boolean;
  readonly area: AreaFinanceira;
  readonly categoriaCompraNome: string | null;
  readonly saldoMilesimos: number;
  readonly estoqueMinimoMilesimos: number;
  readonly valorCentavos: number;
  readonly ultimaEntradaComPreco: EntradaComPreco | null;
};

// A ordem fixa das áreas do Financeiro (04.4-UI-SPEC.md), nas pílulas e em todo agrupamento.
export const ORDEM_DAS_AREAS: readonly AreaFinanceira[] = [
  "cafeteria",
  "espaco",
  "pecas",
  "loja",
  "geral",
];

// A classificação — UMA função. Compara milésimos INTEIROS (nunca decimal: "2,5" e "2,500" já
// chegaram aqui como os mesmos 2500). Negativo primeiro e sempre (D-21); acabando é `<=` (D-28,
// `prototipo.html:607-608`) e só quando há mínimo (EST-04: mínimo zero nunca alerta).
export function situacaoDoSaldo({ saldo, minimo }: { saldo: number; minimo: number }): SituacaoDoSaldo {
  if (saldo < 0) {
    return "negativo";
  }
  if (minimo > 0 && saldo <= minimo) {
    return "acabando";
  }
  return "ok";
}

// O alerta de UM material da lista: material desativado não se movimenta nem se compra (UI-D11),
// então não alerta — o cartão dele leva só o chip neutro "Desativado" (UI-SPEC §Aba Saldos).
export function alertaDoItem(
  item: Pick<SaldoParaLista, "ativo" | "saldoMilesimos" | "estoqueMinimoMilesimos">,
): SituacaoDoSaldo {
  if (!item.ativo) {
    return "ok";
  }
  return situacaoDoSaldo({ saldo: item.saldoMilesimos, minimo: item.estoqueMinimoMilesimos });
}

const PESO_DO_ALERTA: Record<SituacaoDoSaldo, number> = { negativo: 0, acabando: 1, ok: 2 };

function compararNomes(a: { nome: string; id: string }, b: { nome: string; id: string }): number {
  // `localeCompare` pt-BR ("Água" antes de "Argila"); o id desempata nomes idênticos, para a
  // ordem nunca depender da ordem em que o banco devolveu as linhas.
  return a.nome.localeCompare(b.nome, "pt-BR") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Negativo, depois acabando, depois o resto — cada grupo por nome. Devolve uma CÓPIA: a entrada
// não é mutada. Filtrar depois de ordenar nunca reordena (`filtrarSaldos` só remove).
export function ordenarSaldos<
  T extends Pick<SaldoParaLista, "id" | "nome" | "ativo" | "saldoMilesimos" | "estoqueMinimoMilesimos">,
>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    const pesoA = PESO_DO_ALERTA[alertaDoItem(a)];
    const pesoB = PESO_DO_ALERTA[alertaDoItem(b)];
    if (pesoA !== pesoB) {
      return pesoA - pesoB;
    }
    return compararNomes(a, b);
  });
}

// A área do material NO ESTOQUE: a da categoria de COMPRA; na falta, a de venda; por último
// "Geral" (D-12, D-27, ADENDO §2).
//
// Por que não reusa `areaDoItem` de `lib/cadastros/catalogo.ts` (Pitfall 5 da pesquisa): aquela
// prefere a VENDA, que é o certo para o Financeiro (quem vendeu, recebe). O Estoque pergunta
// outra coisa — de que prateleira é o material —, e o adendo manda a compra primeiro. Mudar a do
// Financeiro mudaria a atribuição que ele já faz; por isso são duas funções, cada uma no seu lugar.
export function areaDoItemNoEstoque({
  compra,
  venda,
}: {
  compra: AreaFinanceira | null;
  venda: AreaFinanceira | null;
}): AreaFinanceira {
  return compra ?? venda ?? "geral";
}

// Busca sem acento e sem caixa: NFD, fora os diacríticos, minúsculas pt-BR, sem espaço nas pontas.
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export type FiltroDaLista = {
  busca: string;
  // `null` = "Tudo".
  area: AreaFinanceira | null;
  // "Acabando" traz os abaixo do mínimo E os de saldo negativo, cada um com o seu chip (UI-D7).
  acabando: boolean;
  situacao: FiltroDeSituacao;
};

// Roda no cliente, sobre a lista já carregada (dezenas de itens — UI-SPEC, Assunção 8). Só
// remove: a ordem de saída é a de entrada.
export function filtrarSaldos<T extends SaldoParaLista>(
  itens: readonly T[],
  filtro: FiltroDaLista,
): T[] {
  const termo = normalizarBusca(filtro.busca);
  return itens.filter((item) => {
    if (filtro.situacao === "ativos" && !item.ativo) {
      return false;
    }
    if (filtro.situacao === "desativados" && item.ativo) {
      return false;
    }
    if (filtro.area !== null && item.area !== filtro.area) {
      return false;
    }
    if (filtro.acabando && alertaDoItem(item) === "ok") {
      return false;
    }
    if (termo !== "") {
      const casaNome = normalizarBusca(item.nome).includes(termo);
      const casaCategoria = normalizarBusca(item.categoriaCompraNome ?? "").includes(termo);
      if (!casaNome && !casaCategoria) {
        return false;
      }
    }
    return true;
  });
}

// As pílulas de área: só as que têm pelo menos um material, na ordem fixa.
export function areasComMaterial(itens: readonly Pick<SaldoParaLista, "area">[]): AreaFinanceira[] {
  const presentes = new Set(itens.map((item) => item.area));
  return ORDEM_DAS_AREAS.filter((area) => presentes.has(area));
}

export type ResumoDoBanner = {
  // "{N} material está acabando" / "{N} materiais estão acabando"; ou, se SÓ houver negativos,
  // "{N} material(is) com saldo negativo".
  titulo: string;
  // `erro` só quando todos os alertas são negativos — o título vai em `--color-erro`.
  tom: "atencao" | "erro";
  // Até 3 "{nome} ({saldo} {un})" separados por " · ", e "e mais N".
  nomes: string;
  // "Com saldo negativo: …" — só quando há acabando E negativo ao mesmo tempo.
  linhaNegativos: string | null;
};

const NOMES_NO_BANNER = 3;

function listaDeNomes<T extends SaldoParaLista>(
  itens: readonly T[],
  formatarSaldo: (milesimos: number, unidade: Unidade) => string,
): string {
  const partes = itens
    .slice(0, NOMES_NO_BANNER)
    .map((item) => `${item.nome} (${formatarSaldo(item.saldoMilesimos, item.unidade)})`);
  if (itens.length > NOMES_NO_BANNER) {
    partes.push(textoEMais(itens.length - NOMES_NO_BANNER));
  }
  return partes.join(" · ");
}

// O banner é derivado da MESMA lista da seção de saldos: nenhum alerta → `null` (o banner não
// existe). Os nomes saem na ordem de `ordenarSaldos` (por nome dentro de cada grupo).
export function resumoDoBanner<T extends SaldoParaLista>(
  itens: readonly T[],
  formatarSaldo: (milesimos: number, unidade: Unidade) => string,
): ResumoDoBanner | null {
  const ordenados = ordenarSaldos(itens);
  const negativos = ordenados.filter((item) => alertaDoItem(item) === "negativo");
  const acabando = ordenados.filter((item) => alertaDoItem(item) === "acabando");

  if (acabando.length === 0 && negativos.length === 0) {
    return null;
  }
  if (acabando.length === 0) {
    return {
      titulo: tituloBannerNegativos(negativos.length),
      tom: "erro",
      nomes: listaDeNomes(negativos, formatarSaldo),
      linhaNegativos: null,
    };
  }
  return {
    titulo: tituloBannerAcabando(acabando.length),
    tom: "atencao",
    nomes: listaDeNomes(acabando, formatarSaldo),
    linhaNegativos:
      negativos.length > 0
        ? `${PREFIXO_LINHA_NEGATIVOS}${listaDeNomes(negativos, formatarSaldo)}`
        : null,
  };
}

// "{n} de {total} · {R$} em estoque": `total` é a lista do filtro de situação atual, e o valor
// soma só os materiais com saldo POSITIVO (negativo não abate — UI-SPEC §Aba Saldos).
export function contadorDaLista(
  mostrados: number,
  daSituacao: readonly Pick<SaldoParaLista, "saldoMilesimos" | "valorCentavos">[],
  formatarDinheiro: (centavos: number) => string,
): string {
  const valor = daSituacao.reduce(
    (soma, item) => (item.saldoMilesimos > 0 ? soma + item.valorCentavos : soma),
    0,
  );
  return textoContador(mostrados, daSituacao.length, formatarDinheiro(valor));
}

// O custo médio que a tela mostra, em centavos por unidade — `null` ("—") quando o material nunca
// teve entrada com preço (D-26: a saída dele grava custo zero, e "R$ 0,00/kg" seria mentira).
export function custoMedioParaExibir(
  item: Pick<SaldoParaLista, "saldoMilesimos" | "valorCentavos" | "ultimaEntradaComPreco">,
): number | null {
  if (item.ultimaEntradaComPreco === null) {
    return null;
  }
  return custoMedioCentavosPorUnidade({
    saldoMilesimos: item.saldoMilesimos,
    valorCentavos: item.valorCentavos,
    ultimaEntradaComPreco: item.ultimaEntradaComPreco,
  });
}
