// Módulo puro do Estoque — A CONTAGEM (plano 06-10, D-16, D-17 refinado, D-18, D-32, UI-D2).
//
// Nenhum import que alcance React, Next, drizzle-orm, pg ou `@/db`; não lê o relógio. A tela (a
// prévia de cada linha) e o servidor (`gravarContagem`, sob a trava) leem a MESMA `planejarContagem`
// — uma regra, duas leituras. A diferença é o saldo: a tela usa o carregado com a página; o
// servidor, o lido sob a trava no instante da gravação. Se alguém vendeu no meio, vale o servidor.
//
// O modo é POR MATERIAL, nunca por visita (UI-D2): material sem nenhuma movimentação `manual` está
// na primeira contagem (o "saldo inicial" do D-17); com uma, na conferência (o "inventário" do
// D-18). Não existe bandeira global de "estoque iniciado" nem rascunho de contagem: cada material
// grava ao ser confirmado (D-18), e parar no meio não perde nada.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import { ROTULO_UNIDADE, type Unidade } from "@/lib/cadastros/catalogo";

import { ORDEM_DAS_AREAS, normalizarBusca, planejarAjuste, textoDeMilesimos } from "./saldo";
import {
  FRASE_CUSTO_DA_CONTAGEM,
  PREVIA_CONTAGEM_JA_CERTA,
  previaDaContagemTexto,
  textoProgressoDaContagem,
} from "./textos";

export type ModoDaContagem = "primeira" | "conferencia";

export function modoDoMaterial({ temManual }: { temManual: boolean }): ModoDaContagem {
  return temManual ? "conferencia" : "primeira";
}

// O que a contagem decide gravar. `saldoAntesMilesimos` é o saldo contra o qual se decidiu (na
// tela, o da página; no servidor, o do instante, sob a trava).
export type PlanoDeContagem =
  | { tipo: "nada"; saldoAntesMilesimos: number }
  | { tipo: "recusa"; erro: string; saldoAntesMilesimos: number }
  | {
      tipo: "entrada";
      diferencaMilesimos: number;
      custouCentavos: number;
      motivo: "saldo_inicial";
      saldoAntesMilesimos: number;
      saldoDepoisMilesimos: number;
    }
  | {
      tipo: "ajuste";
      diferencaMilesimos: number;
      motivo: "saldo_inicial" | null;
      saldoAntesMilesimos: number;
      saldoDepoisMilesimos: number;
    };

// Quanto gravar numa contagem — PELA DIFERENÇA, NÃO PELA QUANTIDADE CONTADA (D-17 refinado pela
// pesquisa, Pitfall 3): senão uma venda anterior à contagem fica somada ao contado. Se uma venda
// levou o saldo a −2 antes de alguém contar 10, entram 12 e o saldo termina exatamente em 10.
//
// A diferença é a de `planejarAjuste` (saldo.ts) — uma regra só para "contado − saldo". O que a
// primeira contagem acrescenta: diferença POSITIVA entra com preço ("Custou ao todo", obrigatório e
// maior que zero — é daí que nasce o custo médio) e motivo `saldo_inicial`; diferença NEGATIVA é um
// ajuste com o mesmo motivo, sem pedir custo (sai ao custo médio, R5). A conferência nunca pede
// custo: é um ajuste com a diferença (EST-07), e diferença zero não grava (EST-08). Zero é um
// contado válido (D-32).
export function planejarContagem({
  modo,
  saldoMilesimos,
  contadoMilesimos,
  custouCentavos,
}: {
  modo: ModoDaContagem;
  saldoMilesimos: number;
  contadoMilesimos: number;
  custouCentavos: number | null;
}): PlanoDeContagem {
  const ajuste = planejarAjuste({ saldoMilesimos, contadoMilesimos });
  if (ajuste.tipo === "nada") {
    return { tipo: "nada", saldoAntesMilesimos: saldoMilesimos };
  }
  const { diferencaMilesimos } = ajuste;

  if (modo === "primeira" && diferencaMilesimos > 0) {
    if (custouCentavos === null || !Number.isSafeInteger(custouCentavos) || custouCentavos <= 0) {
      return { tipo: "recusa", erro: FRASE_CUSTO_DA_CONTAGEM, saldoAntesMilesimos: saldoMilesimos };
    }
    return {
      tipo: "entrada",
      diferencaMilesimos,
      custouCentavos,
      motivo: "saldo_inicial",
      saldoAntesMilesimos: saldoMilesimos,
      saldoDepoisMilesimos: contadoMilesimos,
    };
  }

  return {
    tipo: "ajuste",
    diferencaMilesimos,
    motivo: modo === "primeira" ? "saldo_inicial" : null,
    saldoAntesMilesimos: saldoMilesimos,
    saldoDepoisMilesimos: contadoMilesimos,
  };
}

// A prévia da linha, depois de digitar (UI-D16: antes disso o saldo do sistema não aparece):
// "o saldo passa de −2 para 10 un" ou "já está certo — nada será gravado".
export function previaDaContagem({
  saldoMilesimos,
  contadoMilesimos,
  unidade,
}: {
  saldoMilesimos: number;
  contadoMilesimos: number;
  unidade: Unidade;
}): string {
  if (saldoMilesimos === contadoMilesimos) {
    return PREVIA_CONTAGEM_JA_CERTA;
  }
  return previaDaContagemTexto(
    textoDeMilesimos(saldoMilesimos),
    textoDeMilesimos(contadoMilesimos),
    ROTULO_UNIDADE[unidade],
  );
}

// ---------------------------------------------------------------------------------------------
// A lista da tela: dois grupos, área na ordem fixa, nome pt-BR.
// ---------------------------------------------------------------------------------------------

// O que a arrumação precisa de cada material — redeclaração estrutural do que
// `listarParaContagem` (consultas.ts, que alcança o banco) devolve.
export type MaterialParaContagem = {
  readonly id: string;
  readonly nome: string;
  readonly unidade: Unidade;
  readonly area: AreaFinanceira;
  readonly categoriaCompraNome: string | null;
  readonly ativo: boolean;
  readonly temManual: boolean;
};

export type FiltroDaContagem = {
  busca: string;
  // `null` = "Tudo".
  area: AreaFinanceira | null;
};

export type AreaDaContagem<T> = { area: AreaFinanceira; itens: T[] };
export type GrupoDaContagem<T> = { modo: ModoDaContagem; quantos: number; areas: AreaDaContagem<T>[] };

function compararNomes(a: { nome: string; id: string }, b: { nome: string; id: string }): number {
  return a.nome.localeCompare(b.nome, "pt-BR") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// "Ainda sem contagem" antes de "Conferência"; dentro de cada grupo, por área (Cafeteria · Espaço ·
// Peças · Loja · Geral) e, na área, por nome. Só ativos (UI-D11: desativado não se conta). Grupo e
// área sem material não aparecem. A busca é a da aba Saldos: sem acento e sem caixa, no nome ou na
// categoria de compra.
export function agruparContagem<T extends MaterialParaContagem>(
  itens: readonly T[],
  filtro: FiltroDaContagem,
): GrupoDaContagem<T>[] {
  const termo = normalizarBusca(filtro.busca);
  const visiveis = itens.filter((item) => {
    if (!item.ativo) {
      return false;
    }
    if (filtro.area !== null && item.area !== filtro.area) {
      return false;
    }
    if (termo === "") {
      return true;
    }
    return (
      normalizarBusca(item.nome).includes(termo) ||
      normalizarBusca(item.categoriaCompraNome ?? "").includes(termo)
    );
  });

  const modos: ModoDaContagem[] = ["primeira", "conferencia"];
  return modos.flatMap((modo) => {
    const doGrupo = visiveis.filter((item) => modoDoMaterial(item) === modo);
    if (doGrupo.length === 0) {
      return [];
    }
    const areas = ORDEM_DAS_AREAS.flatMap((area) => {
      const daArea = doGrupo.filter((item) => item.area === area).sort(compararNomes);
      return daArea.length === 0 ? [] : [{ area, itens: daArea }];
    });
    return [{ modo, quantos: doGrupo.length, areas }];
  });
}

// "{c} de {t} contados hoje" — `contadosHoje` vem do banco (sobrevive a recarregar, sem rascunho).
export function progressoDaContagem({
  contadosHoje,
  total,
}: {
  contadosHoje: number;
  total: number;
}): string {
  return textoProgressoDaContagem(contadosHoje, total);
}
