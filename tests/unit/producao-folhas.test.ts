import { describe, expect, it } from "vitest";

import { etapasIniciais, type CaminhoOrdem, type EtapaProducao } from "@/lib/producao/etapas";
import {
  linhasDaFolhaDaOrdem,
  medidasEmCm,
  secoesDaFolhaGeral,
  type OrdemParaAFolha,
  type OrdemParaAFolhaGeral,
  type PecaParaAFolha,
} from "@/lib/producao/folhas";

// As duas folhas A4 da bancada (Fase 06.1, plano 13 — PRD-19, PRD-20). A folha da ordem é
// incapaz, por TIPO, de carregar dinheiro: nenhuma chave do que `linhasDaFolhaDaOrdem` devolve
// fala de preço, custo ou valor (o teste percorre todas, recursivamente). A folha geral mostra
// só as etapas que têm ordem, na ordem fixa, com "Aguardando sinal" à parte, no fim.

function etapas(caminho: CaminhoOrdem, feitas: Partial<Record<EtapaProducao, string>> = {}) {
  return etapasIniciais(caminho).map((etapa) => ({
    etapa: etapa.etapa,
    posicao: etapa.posicao,
    diasPrevistos: etapa.diasPrevistos,
    feitaEm: feitas[etapa.etapa] ?? null,
    passaram: null,
  }));
}

const FICHA_CANECA = {
  argilaMiligramas: 350_000,
  esmalteMiligramas: 40_000,
  larguraMm: 95,
  profundidadeMm: 80,
  alturaMm: 105,
};

function peca(parcial: Partial<PecaParaAFolha> = {}): PecaParaAFolha {
  return {
    posicao: 0,
    descricao: "Caneca",
    quantidade: 10,
    aMais: 2,
    cor: null,
    personalizacao: null,
    ficha: FICHA_CANECA,
    ...parcial,
  };
}

function ordem(parcial: Partial<OrdemParaAFolha> = {}): OrdemParaAFolha {
  return {
    tipo: "encomenda",
    caminho: "completo",
    status: "ativa",
    numero: 9,
    nome: "Canecas da pousada",
    clienteNome: "Pousada do Rio",
    orcamentoNumero: "ORC-2026-014",
    entregaPrometida: "2026-12-18",
    inicio: "2026-10-01",
    etapas: etapas("completo", { producao: "2026-10-05" }),
    pecas: [peca()],
    fotos: [],
    ...parcial,
  };
}

// Todas as chaves de um valor, em qualquer profundidade (objetos e listas).
function todasAsChaves(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap(todasAsChaves);
  }
  if (valor !== null && typeof valor === "object") {
    return Object.entries(valor).flatMap(([chave, filho]) => [chave, ...todasAsChaves(filho)]);
  }
  return [];
}

describe("medidasEmCm — mm → cm, uma casa decimal pt-BR, sem casa quando inteiro", () => {
  it("270 × 270 × 30 mm → 27 × 27 × 3", () => {
    expect(medidasEmCm(270, 270, 30)).toBe("27 × 27 × 3");
  });

  it("95 × 80 × 105 mm → 9,5 × 8 × 10,5", () => {
    expect(medidasEmCm(95, 80, 105)).toBe("9,5 × 8 × 10,5");
  });

  it("ficha sem medidas (algum lado 0) → —", () => {
    expect(medidasEmCm(0, 0, 0)).toBe("—");
    expect(medidasEmCm(120, 0, 100)).toBe("—");
  });
});

describe("linhasDaFolhaDaOrdem — a folha de bancada", () => {
  it("encomenda: pedido = quantidade, fazer = pedido + a mais, no fim 'extras'", () => {
    const folha = linhasDaFolhaDaOrdem(ordem());
    expect(folha.pecas).toHaveLength(1);
    expect(folha.pecas[0]).toMatchObject({ pedido: 10, aMais: 2, fazer: 12 });
    expect(folha.noFim).toBe("extras");
    expect(folha.tipo).toBe("encomenda");
    expect(folha.numero).toBe(9);
    expect(folha.clienteNome).toBe("Pousada do Rio");
    expect(folha.orcamentoNumero).toBe("ORC-2026-014");
  });

  it("casa: pedido —, a mais 0, fazer = quantidade, no fim 'boas'", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({ tipo: "casa", clienteNome: null, orcamentoNumero: null, pecas: [peca({ aMais: 0 })] }),
    );
    expect(folha.pecas[0]).toMatchObject({ pedido: "—", aMais: 0, fazer: 10 });
    expect(folha.noFim).toBe("boas");
  });

  it("argila por peça em gramas (350 000 mg → 350 g) e medidas em cm; sem ficha → —", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({ pecas: [peca(), peca({ posicao: 1, descricao: "Prato", ficha: null })] }),
    );
    expect(folha.pecas[0]).toMatchObject({ argila: "350 g", medidas: "9,5 × 8 × 10,5" });
    expect(folha.pecas[1]).toMatchObject({ argila: "—", medidas: "—" });
  });

  it("argila por peça a partir de 1 000 g sai em kg, até duas casas (regra do dono, 30/09/2026)", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({ pecas: [peca({ ficha: { ...FICHA_CANECA, argilaMiligramas: 1_250_000 } })] }),
    );
    expect(folha.pecas[0]).toMatchObject({ argila: "1,25 kg" });
  });

  it("peças pela posição, não pela ordem em que chegaram", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({
        pecas: [
          peca({ posicao: 2, descricao: "Terceira" }),
          peca({ posicao: 0, descricao: "Primeira" }),
          peca({ posicao: 1, descricao: "Segunda" }),
        ],
      }),
    );
    expect(folha.pecas.map((p) => p.descricao)).toEqual(["Primeira", "Segunda", "Terceira"]);
  });

  it("cor e personalização passam como vieram", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({ pecas: [peca({ cor: "azul-cobalto", personalizacao: "com o nome gravado" })] }),
    );
    expect(folha.pecas[0]).toMatchObject({ cor: "azul-cobalto", personalizacao: "com o nome gravado" });
  });

  it("entrega e início em dd/mm/aaaa; sem entrega e sem início → null", () => {
    const folha = linhasDaFolhaDaOrdem(ordem());
    expect(folha.entrega).toBe("18/12/2026");
    expect(folha.inicio).toBe("01/10/2026");

    const aguardando = linhasDaFolhaDaOrdem(
      ordem({ status: "aguardando_sinal", inicio: null, entregaPrometida: null, etapas: etapas("completo") }),
    );
    expect(aguardando.entrega).toBeNull();
    expect(aguardando.inicio).toBeNull();
  });

  it("material previsto com a unidade (textoDePeso, 30/09/2026): argila e esmalte do caminho completo (feitas = pedido + a mais)", () => {
    // 12 feitas × 350 g = 4,2 kg; 12 × 40 g = 480 g (abaixo de 1 000 g, gramas inteiras).
    const folha = linhasDaFolhaDaOrdem(ordem());
    expect(folha.material).toEqual({
      tipo: "previsto",
      argila: "4,2 kg",
      esmalte: "480 g",
      pecasSemFicha: 0,
    });
  });

  it("caminho biscoito: o esmalte some (null), mesmo com gramas na ficha", () => {
    const folha = linhasDaFolhaDaOrdem(ordem({ caminho: "biscoito", etapas: etapas("biscoito") }));
    expect(folha.material).toMatchObject({ tipo: "previsto", argila: "4,2 kg", esmalte: null });
  });

  it("esmalte 0 na ficha: o esmalte some (null)", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({ pecas: [peca({ ficha: { ...FICHA_CANECA, esmalteMiligramas: 0 } })] }),
    );
    expect(folha.material).toMatchObject({ tipo: "previsto", esmalte: null });
  });

  it("peças sem ficha contam à parte; nenhuma peça com ficha → 'sem-ficha'", () => {
    const misturada = linhasDaFolhaDaOrdem(
      ordem({ pecas: [peca(), peca({ posicao: 1, ficha: null, quantidade: 3, aMais: 1 })] }),
    );
    expect(misturada.material).toMatchObject({ tipo: "previsto", pecasSemFicha: 4 });

    const nenhuma = linhasDaFolhaDaOrdem(ordem({ pecas: [peca({ ficha: null })] }));
    expect(nenhuma.material).toEqual({ tipo: "sem-ficha" });
  });

  it("etapas: 6 no completo, 4 no biscoito, na ordem do caminho, com a data só nas feitas", () => {
    const completa = linhasDaFolhaDaOrdem(ordem());
    expect(completa.etapas.map((e) => e.etapa)).toEqual([
      "producao",
      "secagem",
      "queima1",
      "esmaltacao",
      "queima2",
      "entrega",
    ]);
    expect(completa.etapas[0]).toMatchObject({ feitaEm: "05/10/2026", diasPrevistos: 5, feita: true });
    expect(completa.etapas.slice(1).every((e) => e.feitaEm === null && !e.feita)).toBe(true);

    const biscoito = linhasDaFolhaDaOrdem(
      ordem({ tipo: "casa", caminho: "biscoito", etapas: etapas("biscoito") }),
    );
    expect(biscoito.etapas.map((e) => e.etapa)).toEqual(["producao", "secagem", "queima1", "entrega"]);
    // A última etapa da casa é "Guardar no estoque" (o mesmo `rotuloDaEtapa` da tela).
    expect(biscoito.etapas.at(-1)?.rotulo).toBe("Guardar no estoque");
  });

  it("etapas chegando fora de ordem saem pela posição", () => {
    const folha = linhasDaFolhaDaOrdem(ordem({ etapas: [...etapas("completo")].reverse() }));
    expect(folha.etapas.map((e) => e.etapa)[0]).toBe("producao");
  });

  it("régua: feitas cheias, a atual pela metade, as futuras listradas", () => {
    const folha = linhasDaFolhaDaOrdem(ordem());
    expect(folha.regua.map((r) => r.estado)).toEqual([
      "feita",
      "atual",
      "futura",
      "futura",
      "futura",
      "futura",
    ]);
  });

  it("régua da aguardando: nenhuma atual; da concluída: todas feitas", () => {
    const aguardando = linhasDaFolhaDaOrdem(
      ordem({ status: "aguardando_sinal", inicio: null, etapas: etapas("completo") }),
    );
    expect(aguardando.regua.every((r) => r.estado === "futura")).toBe(true);

    const concluida = linhasDaFolhaDaOrdem(
      ordem({
        status: "concluida",
        caminho: "biscoito",
        etapas: etapas("biscoito", {
          producao: "2026-10-05",
          secagem: "2026-10-20",
          queima1: "2026-10-21",
          entrega: "2026-10-27",
        }),
      }),
    );
    expect(concluida.regua.every((r) => r.estado === "feita")).toBe(true);
    expect(concluida.etapas.every((e) => e.feita)).toBe(true);
  });

  it("fotos passam na ordem; sem foto, lista vazia", () => {
    expect(linhasDaFolhaDaOrdem(ordem({ fotos: ["a", "b"] })).fotos).toEqual(["a", "b"]);
    expect(linhasDaFolhaDaOrdem(ordem()).fotos).toEqual([]);
  });

  it("NENHUMA chave do resultado fala de dinheiro (percorrido recursivamente)", () => {
    const folha = linhasDaFolhaDaOrdem(
      ordem({ fotos: ["f1"], pecas: [peca(), peca({ posicao: 1, ficha: null })] }),
    );
    const chaves = todasAsChaves(folha);
    expect(chaves.length).toBeGreaterThan(20);
    expect(chaves.filter((chave) => /preco|custo|valor|centavos|reais/i.test(chave))).toEqual([]);

    const semFicha = todasAsChaves(linhasDaFolhaDaOrdem(ordem({ pecas: [peca({ ficha: null })] })));
    expect(semFicha.filter((chave) => /preco|custo|valor|centavos|reais/i.test(chave))).toEqual([]);
  });
});

describe("secoesDaFolhaGeral — o quadro no papel", () => {
  const HOJE = "2026-10-20";

  function ordemGeral(parcial: Partial<OrdemParaAFolhaGeral> & { id: string }): OrdemParaAFolhaGeral {
    return {
      tipo: "encomenda",
      caminho: "completo",
      status: "ativa",
      nome: `Ordem ${parcial.id}`,
      clienteNome: "Cliente",
      entregaPrometida: null,
      inicio: "2026-10-10",
      etapas: etapas("completo"),
      totalPecas: 10,
      totalAMais: 2,
      ...parcial,
    };
  }

  it("sem nenhuma ordem: vazia", () => {
    const folha = secoesDaFolhaGeral([], HOJE);
    expect(folha).toEqual({ vazia: true, secoes: [], aguardando: [], totalOrdens: 0, totalPecas: 0 });
  });

  it("só as etapas que têm ordem, na ordem fixa das etapas", () => {
    const folha = secoesDaFolhaGeral(
      [
        ordemGeral({
          id: "q",
          etapas: etapas("completo", { producao: "2026-10-12", secagem: "2026-10-18" }),
        }),
        ordemGeral({ id: "p" }),
      ],
      HOJE,
    );
    expect(folha.vazia).toBe(false);
    expect(folha.secoes.map((secao) => secao.etapa)).toEqual(["producao", "queima1"]);
    expect(folha.secoes[1].rotulo).toBe("Queima de biscoito");
  });

  it("a última seção junta os dois tipos: 'Entrega / estoque'", () => {
    const folha = secoesDaFolhaGeral(
      [
        ordemGeral({
          id: "b",
          caminho: "biscoito",
          etapas: etapas("biscoito", {
            producao: "2026-10-11",
            secagem: "2026-10-15",
            queima1: "2026-10-16",
          }),
        }),
      ],
      HOJE,
    );
    expect(folha.secoes).toHaveLength(1);
    expect(folha.secoes[0]).toMatchObject({ etapa: "entrega", rotulo: "Entrega / estoque" });
  });

  it("dentro da seção: por início, depois nome, depois id", () => {
    const folha = secoesDaFolhaGeral(
      [
        ordemGeral({ id: "3", nome: "Beta", inicio: "2026-10-10" }),
        ordemGeral({ id: "2", nome: "Alfa", inicio: "2026-10-10" }),
        ordemGeral({ id: "1", nome: "Zeta", inicio: "2026-10-08" }),
        ordemGeral({ id: "0", nome: "Alfa", inicio: "2026-10-10" }),
      ],
      HOJE,
    );
    expect(folha.secoes[0].linhas.map((linha) => linha.id)).toEqual(["1", "0", "2", "3"]);
  });

  it("a linha: peças feitas, já passaram (só > 0), dias nesta etapa, previsto, entrega", () => {
    const folha = secoesDaFolhaGeral(
      [
        ordemGeral({
          id: "x",
          entregaPrometida: "2026-12-18",
          etapas: etapas("completo").map((etapa) =>
            etapa.etapa === "producao" ? { ...etapa, passaram: 4 } : etapa,
          ),
        }),
        ordemGeral({
          id: "y",
          tipo: "casa",
          clienteNome: null,
          etapas: etapas("completo").map((etapa) =>
            etapa.etapa === "producao" ? { ...etapa, passaram: 0 } : etapa,
          ),
        }),
      ],
      HOJE,
    );
    const [x, y] = folha.secoes[0].linhas;
    expect(x).toMatchObject({
      id: "x",
      daCasa: false,
      clienteNome: "Cliente",
      pecas: 12,
      passaram: 4,
      diasNestaEtapa: 10,
      previsto: 5,
      entrega: "18/12/2026",
    });
    expect(y).toMatchObject({ id: "y", daCasa: true, passaram: null, entrega: null });
  });

  it("aguardando à parte (por nome), e os totais só das liberadas", () => {
    const folha = secoesDaFolhaGeral(
      [
        ordemGeral({ id: "a", totalPecas: 10, totalAMais: 2 }),
        ordemGeral({ id: "b", totalPecas: 5, totalAMais: 0 }),
        ordemGeral({
          id: "w2",
          nome: "Zínia",
          status: "aguardando_sinal",
          inicio: null,
          entregaPrometida: "2026-11-30",
          totalPecas: 30,
          totalAMais: 0,
        }),
        ordemGeral({ id: "w1", nome: "Açucena", status: "aguardando_sinal", inicio: null, totalPecas: 7 }),
      ],
      HOJE,
    );
    expect(folha.totalOrdens).toBe(2);
    expect(folha.totalPecas).toBe(17);
    expect(folha.aguardando.map((linha) => linha.id)).toEqual(["w1", "w2"]);
    expect(folha.aguardando[1]).toMatchObject({ pecas: 30, entrega: "30/11/2026", daCasa: false });
    // Nenhuma seção de etapa leva uma aguardando.
    expect(folha.secoes.flatMap((secao) => secao.linhas.map((linha) => linha.id))).toEqual(["a", "b"]);
  });

  it("só aguardando: nenhuma seção de etapa, mas não vazia", () => {
    const folha = secoesDaFolhaGeral(
      [ordemGeral({ id: "w", status: "aguardando_sinal", inicio: null })],
      HOJE,
    );
    expect(folha.vazia).toBe(false);
    expect(folha.secoes).toEqual([]);
    expect(folha.aguardando).toHaveLength(1);
    expect(folha.totalOrdens).toBe(0);
  });

  it("concluída e cancelada ficam fora", () => {
    const folha = secoesDaFolhaGeral(
      [
        ordemGeral({ id: "c", status: "concluida" }),
        ordemGeral({ id: "k", status: "cancelada" }),
      ],
      HOJE,
    );
    expect(folha.vazia).toBe(true);
  });
});
