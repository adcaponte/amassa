import { describe, expect, it } from "vitest";

import { etapasIniciais, ORDEM_DAS_COLUNAS } from "@/lib/producao/etapas";
import type { OrdemParaLeitura } from "@/lib/producao/leitura";
import { colunasDoQuadro, ordenarNaColuna } from "@/lib/producao/quadro";

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
