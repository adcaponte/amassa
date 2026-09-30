import { describe, expect, it } from "vitest";

import { etapasIniciais, type EtapaProducao } from "@/lib/producao/etapas";
import {
  esperandoOForno,
  fornadasEstimadas,
  type CabemDaFicha,
  type OrdemNaFilaDoForno,
  type PecaEmResumo,
} from "@/lib/producao/forno";

// Fase 06.1 (plano 08, PRD-13): a fila do forno e as fornadas estimadas. O "cabem" chega PRONTO
// (a borda chama `quantasCabem` da Precificação) — este módulo nunca faz conta pelas medidas.

type OrdemDeTeste = OrdemNaFilaDoForno & { id: string; nome: string };

const DIA = "2026-03-01";

// As etapas feitas até (sem incluir) `atual`, todas no mesmo dia — prefixo válido do caminho.
function ordem(
  id: string,
  nome: string,
  opcoes: {
    atual?: EtapaProducao;
    caminho?: "completo" | "biscoito";
    status?: OrdemNaFilaDoForno["status"];
    passaram?: number | null;
    pecas?: PecaEmResumo[];
    inicio?: string | null;
    tipo?: "encomenda" | "casa";
  } = {},
): OrdemDeTeste {
  const caminho = opcoes.caminho ?? "completo";
  const iniciais = etapasIniciais(caminho);
  const indiceAtual =
    opcoes.atual === undefined ? 0 : iniciais.findIndex((etapa) => etapa.etapa === opcoes.atual);
  if (indiceAtual === -1) {
    throw new Error(`etapa ${opcoes.atual} fora do caminho ${caminho}`);
  }
  return {
    id,
    nome,
    tipo: opcoes.tipo ?? "casa",
    caminho,
    status: opcoes.status ?? "ativa",
    entregaPrometida: null,
    inicio: opcoes.inicio === undefined ? DIA : opcoes.inicio,
    etapas: iniciais.map((etapa, indice) => ({
      ...etapa,
      feitaEm: indice < indiceAtual ? DIA : null,
      passaram: indice === indiceAtual ? (opcoes.passaram ?? null) : null,
    })),
    pecasEmResumo: opcoes.pecas ?? [{ fichaId: "ficha-a", quantidade: 30, aMais: 0 }],
  };
}

const CABE_12_NO_BISCOITO: CabemDaFicha = { cabe: true, biscoito: 12, esmalte: 8 };

function cabem(entradas: Record<string, CabemDaFicha>): ReadonlyMap<string, CabemDaFicha> {
  return new Map(Object.entries(entradas));
}

describe("esperandoOForno (PRD-13 · adjacency, ordering)", () => {
  it("só as ordens ativas cuja etapa atual é uma queima", () => {
    const naProducao = ordem("a", "Pratos");
    const noBiscoito = ordem("b", "Canecas", { atual: "queima1" });
    const noEsmalte = ordem("c", "Tigelas", { atual: "queima2" });
    const naEsmaltacao = ordem("d", "Bules", { atual: "esmaltacao" });
    const naEntrega = ordem("e", "Xícaras", { atual: "entrega" });
    const fila = esperandoOForno([naProducao, noBiscoito, noEsmalte, naEsmaltacao, naEntrega]);
    expect(fila.map((o) => o.id)).toEqual(["b", "c"]);
  });

  it("aguardando o sinal, concluída e cancelada ficam fora, mesmo com a etapa numa queima", () => {
    const fila = esperandoOForno([
      ordem("a", "Aguardando", { status: "aguardando_sinal", inicio: null }),
      ordem("b", "Concluída", { status: "concluida", atual: "queima1" }),
      ordem("c", "Cancelada", { status: "cancelada", atual: "queima2" }),
    ]);
    expect(fila).toEqual([]);
  });

  it("ordem do caminho que termina no biscoito, em queima1, entra na fila", () => {
    const fila = esperandoOForno([ordem("a", "Pratos", { caminho: "biscoito", atual: "queima1" })]);
    expect(fila.map((o) => o.id)).toEqual(["a"]);
  });

  it("na mesma ordem dos cartões: primeiro a coluna do biscoito, depois a do esmalte; dentro, início, nome e id", () => {
    const fila = esperandoOForno([
      ordem("z", "Bules", { atual: "queima2" }),
      ordem("y", "Canecas", { atual: "queima1", inicio: "2026-03-02" }),
      ordem("x", "Açucareiros", { atual: "queima1", inicio: "2026-03-02" }),
      ordem("w", "Zebras", { atual: "queima1", inicio: "2026-02-20" }),
    ]);
    expect(fila.map((o) => o.id)).toEqual(["w", "x", "y", "z"]);
  });
});

describe("fornadasEstimadas (PRD-13 · boundary, precision, empty)", () => {
  it("fila vazia → zero fornadas e nenhuma peça sem estimativa", () => {
    expect(fornadasEstimadas([], cabem({}))).toEqual({
      biscoito: 0,
      esmalte: 0,
      pecasSemEstimativa: 0,
    });
  });

  it("30 peças em queima1, cabem 12 no biscoito, nada passou → 2,5 fornadas de biscoito", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima1" })];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 2.5,
      esmalte: 0,
      pecasSemEstimativa: 0,
    });
  });

  it("com 18 das 30 já passadas → 1 fornada", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima1", passaram: 18 })];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO })).biscoito).toBe(1);
  });

  it("com todas passadas → 0 restantes, 0 fornadas", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima1", passaram: 30 })];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 0,
      esmalte: 0,
      pecasSemEstimativa: 0,
    });
  });

  it("queima2 usa o cabem do esmalte", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima2" })];
    // 30 ÷ 8 = 3,75 → 3,8 (uma casa, meio para cima)
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 0,
      esmalte: 3.8,
      pecasSemEstimativa: 0,
    });
  });

  it("a mais entra nas feitas: 20 + 4 a mais cabendo 12 → 2 fornadas", () => {
    const fila = [
      ordem("a", "Pratos", {
        atual: "queima1",
        pecas: [{ fichaId: "ficha-a", quantidade: 20, aMais: 4 }],
      }),
    ];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO })).biscoito).toBe(2);
  });

  it("peça sem ficha fica fora da conta e é contada em pecasSemEstimativa", () => {
    const fila = [
      ordem("a", "Pratos", {
        atual: "queima1",
        pecas: [
          { fichaId: "ficha-a", quantidade: 24, aMais: 0 },
          { fichaId: null, quantidade: 7, aMais: 0 },
        ],
      }),
    ];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 2,
      esmalte: 0,
      pecasSemEstimativa: 7,
    });
  });

  it("ficha que não cabe (cabe: false) fica fora e contada — nunca divisão por zero", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima1" })];
    const resultado = fornadasEstimadas(
      fila,
      cabem({ "ficha-a": { cabe: false, biscoito: 0, esmalte: 0 } }),
    );
    expect(resultado).toEqual({ biscoito: 0, esmalte: 0, pecasSemEstimativa: 30 });
    expect(Number.isFinite(resultado.biscoito)).toBe(true);
  });

  it("ficha fora do mapa (parâmetro faltando, ficha sem medida) fica fora e contada", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima2" })];
    expect(fornadasEstimadas(fila, cabem({}))).toEqual({
      biscoito: 0,
      esmalte: 0,
      pecasSemEstimativa: 30,
    });
  });

  it("cabem zerado ou infinito no número da queima → fora da conta, nunca 0 nem Infinity de fornadas", () => {
    const fila = [ordem("a", "Pratos", { atual: "queima1" })];
    expect(
      fornadasEstimadas(fila, cabem({ "ficha-a": { cabe: true, biscoito: 0, esmalte: 8 } })),
    ).toEqual({ biscoito: 0, esmalte: 0, pecasSemEstimativa: 30 });
    expect(
      fornadasEstimadas(
        fila,
        cabem({ "ficha-a": { cabe: true, biscoito: Number.POSITIVE_INFINITY, esmalte: 8 } }),
      ),
    ).toEqual({ biscoito: 0, esmalte: 0, pecasSemEstimativa: 30 });
  });

  it("duas peças na mesma ordem com parcial: restantes proporcionais por peça", () => {
    // 30 + 10 = 40 feitas; passaram 20 → restam 15 da A (30 − 20×30/40) e 5 da B (10 − 20×10/40).
    // A cabe 10 no biscoito → 1,5; B cabe 4 → 1,25. Total 2,75 → 2,8.
    const fila = [
      ordem("a", "Jogo", {
        atual: "queima1",
        passaram: 20,
        pecas: [
          { fichaId: "ficha-a", quantidade: 30, aMais: 0 },
          { fichaId: "ficha-b", quantidade: 10, aMais: 0 },
        ],
      }),
    ];
    const resultado = fornadasEstimadas(
      fila,
      cabem({
        "ficha-a": { cabe: true, biscoito: 10, esmalte: 6 },
        "ficha-b": { cabe: true, biscoito: 4, esmalte: 3 },
      }),
    );
    expect(resultado).toEqual({ biscoito: 2.8, esmalte: 0, pecasSemEstimativa: 0 });
  });

  it("peças sem estimativa com parcial: a soma proporcional arredondada", () => {
    // 30 + 15 = 45; passaram 9 → restam 24 da A e 12 da B (sem ficha).
    const fila = [
      ordem("a", "Jogo", {
        atual: "queima1",
        passaram: 9,
        pecas: [
          { fichaId: "ficha-a", quantidade: 30, aMais: 0 },
          { fichaId: null, quantidade: 15, aMais: 0 },
        ],
      }),
    ];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 2,
      esmalte: 0,
      pecasSemEstimativa: 12,
    });
  });

  it("várias ordens somam por queima, cada uma com o seu cabem", () => {
    const fila = [
      ordem("a", "Pratos", { atual: "queima1" }),
      ordem("b", "Canecas", {
        atual: "queima2",
        pecas: [{ fichaId: "ficha-a", quantidade: 16, aMais: 0 }],
      }),
      ordem("c", "Tigelas", {
        atual: "queima1",
        caminho: "biscoito",
        pecas: [{ fichaId: "ficha-a", quantidade: 6, aMais: 0 }],
      }),
    ];
    // Biscoito: 30/12 + 6/12 = 3; esmalte: 16/8 = 2.
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 3,
      esmalte: 2,
      pecasSemEstimativa: 0,
    });
  });

  it("ordem que não está numa queima é ignorada (a fila é quem chama esperandoOForno)", () => {
    const fila = [ordem("a", "Pratos", { atual: "producao" })];
    expect(fornadasEstimadas(fila, cabem({ "ficha-a": CABE_12_NO_BISCOITO }))).toEqual({
      biscoito: 0,
      esmalte: 0,
      pecasSemEstimativa: 0,
    });
  });

  it("uma casa decimal, meio para cima: 1,25 → 1,3; 1,24 → 1,2", () => {
    // 5 ÷ 4 = 1,25
    const umaVirgulaVinteECinco = [
      ordem("a", "Pratos", {
        atual: "queima1",
        pecas: [{ fichaId: "ficha-a", quantidade: 5, aMais: 0 }],
      }),
    ];
    expect(
      fornadasEstimadas(
        umaVirgulaVinteECinco,
        cabem({ "ficha-a": { cabe: true, biscoito: 4, esmalte: 4 } }),
      ).biscoito,
    ).toBe(1.3);
    // 31 ÷ 25 = 1,24
    const umaVirgulaVinteEQuatro = [
      ordem("a", "Pratos", {
        atual: "queima1",
        pecas: [{ fichaId: "ficha-a", quantidade: 31, aMais: 0 }],
      }),
    ];
    expect(
      fornadasEstimadas(
        umaVirgulaVinteEQuatro,
        cabem({ "ficha-a": { cabe: true, biscoito: 25, esmalte: 25 } }),
      ).biscoito,
    ).toBe(1.2);
  });
});
