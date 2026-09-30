import { describe, expect, it } from "vitest";

import { etapasIniciais, ORDEM_DAS_COLUNAS } from "@/lib/producao/etapas";
import type { OrdemParaLeitura } from "@/lib/producao/leitura";
import {
  colunasDoQuadro,
  FILTROS_DO_QUADRO,
  filtrarOrdens,
  NOME_DO_COOKIE_DA_VISTA,
  numerosDoTopo,
  ordenarNaColuna,
  vistaDoCookie,
} from "@/lib/producao/quadro";

// Fase 06.1 (plano 01): o quadro por etapa — seis colunas em ordem fixa, cada ordem ativa na
// coluna da etapa atual; filtros e os três números do topo são do plano 08.

type OrdemDeTeste = OrdemParaLeitura & { id: string; nome: string };

function ordem(
  id: string,
  nome: string,
  parcial: Partial<OrdemParaLeitura> & { feitas?: Record<string, string> } = {},
): OrdemDeTeste {
  const { feitas = {}, ...resto } = parcial;
  const caminho = resto.caminho ?? "completo";
  return {
    id,
    nome,
    tipo: "casa",
    caminho,
    status: "ativa",
    entregaPrometida: null,
    inicio: "2026-03-01",
    etapas: etapasIniciais(caminho).map((etapa) => ({
      ...etapa,
      feitaEm: feitas[etapa.etapa] ?? null,
      passaram: null,
    })),
    ...resto,
  };
}

describe("colunasDoQuadro", () => {
  it("são seis colunas, na ordem fixa, mesmo vazias", () => {
    const colunas = colunasDoQuadro([]);
    expect(colunas.map((coluna) => coluna.etapa)).toEqual([...ORDEM_DAS_COLUNAS]);
    expect(colunas.every((coluna) => coluna.ordens.length === 0)).toBe(true);
  });

  it("cada ordem ativa cai na coluna da etapa atual", () => {
    const naProducao = ordem("a", "Pratos");
    const naSecagem = ordem("b", "Canecas", { feitas: { producao: "2026-03-05" } });
    const colunas = colunasDoQuadro([naProducao, naSecagem]);
    expect(colunas[0].ordens.map((o) => o.id)).toEqual(["a"]);
    expect(colunas[1].ordens.map((o) => o.id)).toEqual(["b"]);
  });

  it("ordem do caminho biscoito que já passou da queima de biscoito cai em Entrega / estoque", () => {
    const biscoito = ordem("c", "Tigelas", {
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20", queima1: "2026-03-21" },
    });
    const colunas = colunasDoQuadro([biscoito]);
    expect(colunas[5].etapa).toBe("entrega");
    expect(colunas[5].ordens.map((o) => o.id)).toEqual(["c"]);
  });

  it("aguardando, concluída e cancelada não entram no quadro", () => {
    const colunas = colunasDoQuadro([
      ordem("d", "Aguardando", { status: "aguardando_sinal", inicio: null }),
      ordem("e", "Concluída", { status: "concluida" }),
      ordem("f", "Cancelada", { status: "cancelada" }),
    ]);
    expect(colunas.flatMap((coluna) => coluna.ordens)).toEqual([]);
  });

  it("dentro da coluna, ordena por início, nome e id", () => {
    const colunas = colunasDoQuadro([
      ordem("z", "Bules", { inicio: "2026-03-02" }),
      ordem("y", "Canecas", { inicio: "2026-03-01" }),
      ordem("x", "Açucareiros", { inicio: "2026-03-01" }),
    ]);
    expect(colunas[0].ordens.map((o) => o.id)).toEqual(["x", "y", "z"]);
  });
});

describe("ordenarNaColuna (PRD-01 · ordering)", () => {
  it("desempate estável: mesmo início e mesmo nome → por id", () => {
    const lista = [
      { id: "b", nome: "Canecas", inicio: "2026-03-01" },
      { id: "a", nome: "Canecas", inicio: "2026-03-01" },
    ];
    expect(ordenarNaColuna(lista).map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("nome compara em pt-BR (acento não joga para o fim)", () => {
    const lista = [
      { id: "1", nome: "Bules", inicio: "2026-03-01" },
      { id: "2", nome: "Ânforas", inicio: "2026-03-01" },
    ];
    expect(ordenarNaColuna(lista).map((o) => o.id)).toEqual(["2", "1"]);
  });

  it("não muda a lista recebida", () => {
    const lista = [
      { id: "b", nome: "B", inicio: "2026-03-02" },
      { id: "a", nome: "A", inicio: "2026-03-01" },
    ];
    ordenarNaColuna(lista);
    expect(lista.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

// Fase 06.1 (plano 08, PRD-05 · adjacency, PRD-13): os filtros e os três números do topo.

type OrdemComPecas = OrdemDeTeste & { totalPecas: number; totalAMais: number };

function comPecas(base: OrdemDeTeste, totalPecas: number, totalAMais = 0): OrdemComPecas {
  return { ...base, totalPecas, totalAMais };
}

describe("filtrarOrdens (PRD-05 · adjacency)", () => {
  const lista = [
    ordem("a", "Pratos", { tipo: "encomenda" }),
    ordem("b", "Canecas", { tipo: "casa" }),
    ordem("c", "Tigelas", { tipo: "encomenda", status: "aguardando_sinal", inicio: null }),
    ordem("d", "Bules", { tipo: "casa", status: "aguardando_sinal", inicio: null }),
  ];

  it("“todas” devolve tudo, na mesma ordem", () => {
    expect(filtrarOrdens(lista, "todas").map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("“encomenda” e “casa” são disjuntos e a união é “todas”", () => {
    const encomendas = filtrarOrdens(lista, "encomenda").map((o) => o.id);
    const daCasa = filtrarOrdens(lista, "casa").map((o) => o.id);
    expect(encomendas).toEqual(["a", "c"]);
    expect(daCasa).toEqual(["b", "d"]);
    expect(encomendas.filter((id) => daCasa.includes(id))).toEqual([]);
    expect([...encomendas, ...daCasa].sort()).toEqual(
      filtrarOrdens(lista, "todas")
        .map((o) => o.id)
        .sort(),
    );
  });

  it("os três filtros, na ordem das pílulas", () => {
    expect([...FILTROS_DO_QUADRO]).toEqual(["todas", "encomenda", "casa"]);
  });

  it("não muda a lista recebida", () => {
    const copia = [...lista];
    filtrarOrdens(lista, "casa");
    expect(lista).toEqual(copia);
  });
});

describe("numerosDoTopo (PRD-13)", () => {
  const semFornadas = { biscoito: 0, esmalte: 0, pecasSemEstimativa: 0 };

  it("sem ordem: tudo zero", () => {
    expect(numerosDoTopo([], semFornadas)).toEqual({
      emProducao: { ordens: 0, pecas: 0 },
      esperandoOForno: { ordens: 0, fornadas: semFornadas },
      aguardando: 0,
    });
  });

  it("conta ordens liberadas e peças (pedido + a mais), a fila do forno e as aguardando", () => {
    const fornadas = { biscoito: 2.5, esmalte: 1, pecasSemEstimativa: 3 };
    const numeros = numerosDoTopo(
      [
        comPecas(ordem("a", "Pratos"), 10, 2),
        comPecas(
          ordem("b", "Canecas", {
            feitas: { producao: "2026-03-05", secagem: "2026-03-20" },
          }),
          30,
        ),
        comPecas(
          ordem("c", "Tigelas", {
            feitas: {
              producao: "2026-03-05",
              secagem: "2026-03-20",
              queima1: "2026-03-21",
              esmaltacao: "2026-03-22",
            },
          }),
          5,
          1,
        ),
        comPecas(ordem("d", "Bules", { status: "aguardando_sinal", inicio: null }), 8),
        comPecas(ordem("e", "Xícaras", { status: "aguardando_sinal", inicio: null }), 4),
      ],
      fornadas,
    );
    expect(numeros).toEqual({
      // a (12), b (30) e c (6) — as aguardando não entram.
      emProducao: { ordens: 3, pecas: 48 },
      // b em queima1, c em queima2.
      esperandoOForno: { ordens: 2, fornadas },
      aguardando: 2,
    });
  });

  it("obedece ao filtro: conta só as ordens que recebe", () => {
    const lista = [
      comPecas(ordem("a", "Pratos", { tipo: "encomenda" }), 10),
      comPecas(ordem("b", "Canecas", { tipo: "casa" }), 7, 3),
      comPecas(ordem("c", "Tigelas", { tipo: "casa", status: "aguardando_sinal", inicio: null }), 4),
    ];
    expect(numerosDoTopo(filtrarOrdens(lista, "casa"), semFornadas)).toEqual({
      emProducao: { ordens: 1, pecas: 10 },
      esperandoOForno: { ordens: 0, fornadas: semFornadas },
      aguardando: 1,
    });
    expect(numerosDoTopo(filtrarOrdens(lista, "encomenda"), semFornadas).emProducao).toEqual({
      ordens: 1,
      pecas: 10,
    });
  });
});

// Plano 09 (PRD-07, UI-D18): a vista "Quadro por etapa · Linha do tempo" lembrada por cookie. O
// valor vem do navegador — qualquer coisa fora da união fechada vira "quadro" (T-06.1-34).
describe("vistaDoCookie", () => {
  it("o cookie se chama producao_vista", () => {
    expect(NOME_DO_COOKIE_DA_VISTA).toBe("producao_vista");
  });

  it("tempo → tempo; quadro → quadro", () => {
    expect(vistaDoCookie("tempo")).toBe("tempo");
    expect(vistaDoCookie("quadro")).toBe("quadro");
  });

  it("ausente, vazio ou desconhecido → quadro", () => {
    expect(vistaDoCookie(undefined)).toBe("quadro");
    expect(vistaDoCookie(null)).toBe("quadro");
    expect(vistaDoCookie("")).toBe("quadro");
    expect(vistaDoCookie("x")).toBe("quadro");
    expect(vistaDoCookie("TEMPO")).toBe("quadro");
    expect(vistaDoCookie("tempo ")).toBe("quadro");
  });

  it("escolher de novo a mesma vista não muda nada (idempotente)", () => {
    expect(vistaDoCookie(vistaDoCookie("tempo"))).toBe("tempo");
    expect(vistaDoCookie(vistaDoCookie("quadro"))).toBe("quadro");
  });
});
