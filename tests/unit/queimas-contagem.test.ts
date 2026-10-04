import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHAVES_DOS_CONTADORES,
  JANELA_SEM_CONTAGEM_DIAS,
  TETO_DA_LISTA_SEM_CONTAGEM,
  CONTAGEM_VAZIA,
  QUANTIDADES_ZERADAS,
  TETO_DO_CONTADOR,
  abaixoDoLancado,
  cabeNoQueFalta,
  chipsDaProducao,
  cmDaRegua,
  contagemVazia,
  diaMes,
  externasDaContagem,
  faltaCobrar,
  janelaSemContagem,
  lancadoAtivo,
  limitarContador,
  mesmaContagem,
  resumoPmg,
  somarChip,
  somarDiasCivis,
  tamanhoPelaRegua,
  totalDaContagem,
  totalDasExternas,
  totalDasInternas,
  totalDasQuantidades,
  type ChipDaOrdem,
  type Contagem,
  type OrdemEsperando,
  type VendaLigada,
} from "@/lib/queimas/contagem";
import {
  ROTULO_CHIPS,
  SUFIXO_SOMADO,
  ariaDoChip,
  textoDoChip,
} from "@/lib/queimas/textos";

const CONTAGEM: Contagem = {
  internasP: 3,
  internasM: 1,
  internasG: 0,
  externasP: 2,
  externasM: 4,
  externasG: 1,
  saiuCheio: false,
};

function venda(
  numero: number,
  cancelada: boolean,
  quantidades: { p: number; m: number; g: number },
): VendaLigada {
  return { documentoId: `doc-${numero}`, numero, cancelada, paga: false, quantidades };
}

describe("contagem — regras puras (Fase 06.4)", () => {
  it("CONTAGEM_VAZIA tem os seis contadores em 0 e “saiu cheio” marcado por padrão", () => {
    expect(totalDaContagem(CONTAGEM_VAZIA)).toBe(0);
    expect(contagemVazia(CONTAGEM_VAZIA)).toBe(true);
    expect(CONTAGEM_VAZIA.saiuCheio).toBe(true);
  });

  it("totais: soma as seis, só as internas, só as externas", () => {
    expect(totalDaContagem(CONTAGEM)).toBe(11);
    expect(totalDasInternas(CONTAGEM)).toBe(4);
    expect(totalDasExternas(CONTAGEM)).toBe(7);
    expect(contagemVazia(CONTAGEM)).toBe(false);
  });

  it("CHAVES_DOS_CONTADORES está na ordem da folha e TETO_DO_CONTADOR é 10000", () => {
    expect(CHAVES_DOS_CONTADORES).toEqual([
      "internasP",
      "internasM",
      "internasG",
      "externasP",
      "externasM",
      "externasG",
    ]);
    expect(TETO_DO_CONTADOR).toBe(10000);
  });

  it("limitarContador: NaN → 0; −5 → 0; 10001 → 10000; 7,9 → 7", () => {
    expect(limitarContador(Number.NaN)).toBe(0);
    expect(limitarContador(-5)).toBe(0);
    expect(limitarContador(10001)).toBe(10000);
    expect(limitarContador(7.9)).toBe(7);
    expect(limitarContador(10000)).toBe(10000);
    expect(limitarContador(0)).toBe(0);
  });

  it('diaMes("2026-12-18") → "18/12"', () => {
    expect(diaMes("2026-12-18")).toBe("18/12");
    expect(diaMes("2026-01-05")).toBe("05/01");
  });
});

describe("D-07 — várias vendas por queima (regras puras)", () => {
  it("lancadoAtivo soma só as vendas não canceladas", () => {
    const vendas = [
      venda(12, false, { p: 2, m: 0, g: 1 }),
      venda(13, true, { p: 5, m: 5, g: 5 }),
      venda(15, false, { p: 1, m: 1, g: 0 }),
    ];
    expect(lancadoAtivo(vendas)).toEqual({ p: 3, m: 1, g: 1 });
  });

  it("lancadoAtivo de lista vazia → zeros", () => {
    expect(lancadoAtivo([])).toEqual({ p: 0, m: 0, g: 0 });
    expect(QUANTIDADES_ZERADAS).toEqual({ p: 0, m: 0, g: 0 });
  });

  it("faltaCobrar: externas − lançado, por tamanho, nunca negativo", () => {
    expect(faltaCobrar({ p: 3, m: 2, g: 1 }, { p: 3, m: 1, g: 0 })).toEqual({ p: 0, m: 1, g: 1 });
    expect(faltaCobrar({ p: 1, m: 0, g: 0 }, { p: 4, m: 2, g: 0 })).toEqual({ p: 0, m: 0, g: 0 });
  });

  it("cabeNoQueFalta: cada tamanho do pedido ≤ o que falta", () => {
    expect(cabeNoQueFalta({ p: 1, m: 0, g: 0 }, { p: 1, m: 0, g: 0 })).toBe(true);
    expect(cabeNoQueFalta({ p: 2, m: 0, g: 0 }, { p: 1, m: 5, g: 5 })).toBe(false);
  });

  it("abaixoDoLancado: igual pode; abaixo devolve o primeiro tamanho na ordem P, M, G; subir nunca recusa", () => {
    expect(abaixoDoLancado({ p: 2, m: 1, g: 0 }, { p: 2, m: 1, g: 0 })).toBeNull();
    expect(abaixoDoLancado({ p: 1, m: 0, g: 0 }, { p: 2, m: 1, g: 0 })).toBe("P");
    expect(abaixoDoLancado({ p: 2, m: 0, g: 0 }, { p: 2, m: 1, g: 3 })).toBe("M");
    expect(abaixoDoLancado({ p: 9, m: 9, g: 9 }, { p: 2, m: 1, g: 0 })).toBeNull();
  });

  it("externasDaContagem devolve as três externas; totalDasQuantidades soma as três", () => {
    expect(externasDaContagem(CONTAGEM)).toEqual({ p: 2, m: 4, g: 1 });
    expect(totalDasQuantidades({ p: 2, m: 4, g: 1 })).toBe(7);
  });
});

describe("pureza de lib/queimas/contagem.ts", () => {
  it("não tem nenhuma linha de import (nem de tipo)", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/queimas/contagem.ts"), "utf8");
    const linhasDeImport = fonte.split(/\r?\n/).filter((linha) => /^\s*import\b/.test(linha));
    expect(linhasDeImport).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Plano 02 — a janela de "Sem contagem" no índice (UI-D4; sondas QMC-02 adjacency/empty/ordering).

describe("somarDiasCivis", () => {
  it("anda dentro do mês", () => {
    expect(somarDiasCivis("2026-12-18", -29)).toBe("2026-11-19");
  });

  it("atravessa o mês e o ano, para trás e para a frente", () => {
    expect(somarDiasCivis("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDiasCivis("2028-03-01", -1)).toBe("2028-02-29");
    expect(somarDiasCivis("2027-01-05", -10)).toBe("2026-12-26");
    expect(somarDiasCivis("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDiasCivis("2026-10-04", 0)).toBe("2026-10-04");
  });
});

type Candidata = { id: string; ocorridaEm: string; diaCivil: string };

function candidata(id: string, ocorridaEm: string, diaCivil: string): Candidata {
  return { id, ocorridaEm, diaCivil };
}

describe("janelaSemContagem", () => {
  const HOJE = "2026-12-18";

  it("as constantes são 30 dias e 20 linhas", () => {
    expect(JANELA_SEM_CONTAGEM_DIAS).toBe(30);
    expect(TETO_DA_LISTA_SEM_CONTAGEM).toBe(20);
  });

  it("hoje − 29 entra e hoje − 30 fica fora", () => {
    const dentro = candidata("a", "2026-11-19T15:00:00.000Z", "2026-11-19");
    const fora = candidata("b", "2026-11-18T15:00:00.000Z", "2026-11-18");
    const { visiveis, maisAntigas } = janelaSemContagem({
      candidatas: [dentro, fora],
      totalSemContagem: 2,
      hoje: HOJE,
    });
    expect(visiveis.map((q) => q.id)).toEqual(["a"]);
    expect(maisAntigas).toBe(1);
  });

  it("02h59 UTC de hoje − 29 (23h59 de hoje − 30 em Brasília) fica FORA — decide o dia civil", () => {
    const quaseMeiaNoite = candidata("c", "2026-11-19T02:59:00.000Z", "2026-11-18");
    const { visiveis, maisAntigas } = janelaSemContagem({
      candidatas: [quaseMeiaNoite],
      totalSemContagem: 1,
      hoje: HOJE,
    });
    expect(visiveis).toEqual([]);
    expect(maisAntigas).toBe(1);
  });

  it("20 cabem; a 21ª vira “e mais 1”", () => {
    const vinte = Array.from({ length: 20 }, (_, i) =>
      candidata(`id-${String(i).padStart(2, "0")}`, `2026-12-18T1${i % 10}:${String(i).padStart(2, "0")}:00.000Z`, HOJE),
    );
    const cabem = janelaSemContagem({ candidatas: vinte, totalSemContagem: 20, hoje: HOJE });
    expect(cabem.visiveis).toHaveLength(20);
    expect(cabem.maisAntigas).toBe(0);

    const vinteEUma = [...vinte, candidata("id-20", "2026-12-01T10:00:00.000Z", "2026-12-01")];
    const passa = janelaSemContagem({ candidatas: vinteEUma, totalSemContagem: 21, hoje: HOJE });
    expect(passa.visiveis).toHaveLength(20);
    expect(passa.visiveis.map((q) => q.id)).not.toContain("id-20");
    expect(passa.maisAntigas).toBe(1);
  });

  it("a mais recente primeiro; no empate de instante, `id` decrescente — estável", () => {
    const mesmoInstante = "2026-12-17T12:00:00.000Z";
    const candidatas = [
      candidata("a1", mesmoInstante, "2026-12-17"),
      candidata("b2", "2026-12-18T09:00:00.000Z", HOJE),
      candidata("c3", mesmoInstante, "2026-12-17"),
      candidata("a0", "2026-12-10T09:00:00.000Z", "2026-12-10"),
    ];
    const primeira = janelaSemContagem({ candidatas, totalSemContagem: 4, hoje: HOJE });
    expect(primeira.visiveis.map((q) => q.id)).toEqual(["b2", "c3", "a1", "a0"]);
    const segunda = janelaSemContagem({
      candidatas: [...candidatas].reverse(),
      totalSemContagem: 4,
      hoje: HOJE,
    });
    expect(segunda.visiveis.map((q) => q.id)).toEqual(["b2", "c3", "a1", "a0"]);
  });

  it("nenhuma candidata → nada visível e `maisAntigas` = o total (todas fora da janela)", () => {
    expect(janelaSemContagem({ candidatas: [], totalSemContagem: 0, hoje: HOJE })).toEqual({
      visiveis: [],
      maisAntigas: 0,
    });
    expect(janelaSemContagem({ candidatas: [], totalSemContagem: 3, hoje: HOJE })).toEqual({
      visiveis: [],
      maisAntigas: 3,
    });
  });

  it("não muda a lista recebida", () => {
    const candidatas = [
      candidata("a", "2026-12-01T09:00:00.000Z", "2026-12-01"),
      candidata("b", "2026-12-18T09:00:00.000Z", HOJE),
    ];
    janelaSemContagem({ candidatas, totalSemContagem: 2, hoje: HOJE });
    expect(candidatas.map((q) => q.id)).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Plano 02, Tarefa 2 — a régua em cm e o "nada mexido" da folha (UI-D18).

describe("cmDaRegua", () => {
  it("inteiro sem vírgula; fração com até três casas, sem zero à direita", () => {
    expect(cmDaRegua(10000)).toBe("10");
    expect(cmDaRegua(25000)).toBe("25");
    expect(cmDaRegua(12500)).toBe("12,5");
    expect(cmDaRegua(12345)).toBe("12,345");
    expect(cmDaRegua(12050)).toBe("12,05");
    expect(cmDaRegua(500)).toBe("0,5");
  });
});

describe("mesmaContagem", () => {
  it("iguais nos seis números e na caixa", () => {
    expect(mesmaContagem(CONTAGEM_VAZIA, { ...CONTAGEM_VAZIA })).toBe(true);
    expect(mesmaContagem(CONTAGEM, { ...CONTAGEM })).toBe(true);
  });

  it("qualquer contador diferente, ou a caixa, já é mudança", () => {
    for (const chave of CHAVES_DOS_CONTADORES) {
      expect(mesmaContagem(CONTAGEM_VAZIA, { ...CONTAGEM_VAZIA, [chave]: 1 })).toBe(false);
    }
    expect(mesmaContagem(CONTAGEM_VAZIA, { ...CONTAGEM_VAZIA, saiuCheio: false })).toBe(false);
  });
});

describe("resumoPmg", () => {
  it("só os tamanhos com quantidade, separados por ponto médio", () => {
    expect(resumoPmg(3, 0, 1)).toBe("3 P · 1 G");
    expect(resumoPmg(12, 9, 2)).toBe("12 P · 9 M · 2 G");
    expect(resumoPmg(0, 4, 0)).toBe("4 M");
  });

  it("tudo zero → vazio", () => {
    expect(resumoPmg(0, 0, 0)).toBe("");
  });
});

// ---------------------------------------------------------------------------------------------
// Plano 03 — a régua decide o tamanho; os chips da Produção (QMC-04, QMC-06, D-06).

const REGUA_10_25 = { pAte: 10000, mAte: 25000 };

describe("tamanhoPelaRegua (sonda QMC-04·boundary e ·precision)", () => {
  it("régua 10/25: 100 mm = 10 cm é P; 101 é M; 250 é M; 251 é G", () => {
    expect(tamanhoPelaRegua(100, REGUA_10_25)).toBe("P");
    expect(tamanhoPelaRegua(101, REGUA_10_25)).toBe("M");
    expect(tamanhoPelaRegua(250, REGUA_10_25)).toBe("M");
    expect(tamanhoPelaRegua(251, REGUA_10_25)).toBe("G");
  });

  it("maior medida 0, negativa ou que não é número → sem medida (null)", () => {
    expect(tamanhoPelaRegua(0, REGUA_10_25)).toBeNull();
    expect(tamanhoPelaRegua(-1, REGUA_10_25)).toBeNull();
    expect(tamanhoPelaRegua(Number.NaN, REGUA_10_25)).toBeNull();
  });

  it("ficha em mm × 100 = régua em cm × 1000, em inteiros: régua de 12,5 cm põe 125 mm em P e 126 em M", () => {
    expect(100 * 100).toBe(10000);
    const regua = { pAte: 12500, mAte: 25000 };
    expect(tamanhoPelaRegua(125, regua)).toBe("P");
    expect(tamanhoPelaRegua(126, regua)).toBe("M");
    expect(cmDaRegua(12500)).toBe("12,5");
  });
});

function ordem(parcial: Partial<OrdemEsperando> & Pick<OrdemEsperando, "pecas">): OrdemEsperando {
  return { ordemId: "a", nome: "x", etapa: "queima1", passaram: 0, ...parcial };
}

describe("chipsDaProducao (sonda QMC-06)", () => {
  it("o caso do e2e: 10 de ficha P e 6 de ficha M, 4 já passaram → 12 pendentes, 8 P + 4 M", () => {
    const chips = chipsDaProducao(
      [
        ordem({
          passaram: 4,
          pecas: [
            { feitas: 10, maiorMm: 80 },
            { feitas: 6, maiorMm: 200 },
          ],
        }),
      ],
      REGUA_10_25,
    );
    expect(chips).toEqual<ChipDaOrdem[]>([
      {
        ordemId: "a",
        nome: "x",
        etapa: "queima1",
        pendentes: 12,
        porTamanho: { P: 8, M: 4, G: 0 },
        semMedida: 0,
      },
    ]);
  });

  it("passaram igual às feitas → sem chip; passaram maior que as feitas → sem chip, nunca negativo", () => {
    const pecas = [
      { feitas: 10, maiorMm: 80 },
      { feitas: 6, maiorMm: 200 },
    ];
    expect(chipsDaProducao([ordem({ passaram: 16, pecas })], REGUA_10_25)).toEqual([]);
    expect(chipsDaProducao([ordem({ passaram: 99, pecas })], REGUA_10_25)).toEqual([]);
  });

  it("passaram negativo conta como 0", () => {
    const [chip] = chipsDaProducao(
      [ordem({ passaram: -3, pecas: [{ feitas: 5, maiorMm: 80 }] })],
      REGUA_10_25,
    );
    expect(chip?.pendentes).toBe(5);
    expect(chip?.porTamanho.P).toBe(5);
  });

  it("lista vazia → []; ordem sem peça ou com feitas 0 → sem chip", () => {
    expect(chipsDaProducao([], REGUA_10_25)).toEqual([]);
    expect(chipsDaProducao([ordem({ pecas: [] })], REGUA_10_25)).toEqual([]);
    expect(chipsDaProducao([ordem({ pecas: [{ feitas: 0, maiorMm: 80 }] })], REGUA_10_25)).toEqual(
      [],
    );
  });

  it("três restos iguais: o desempate é P, M, G, sem medida — e a soma fecha nas pendentes", () => {
    // 4 peças de cada (P, M, G, sem medida) = 16 feitas; 6 passaram → 10 pendentes; 2,5 em cada
    // balde: pisos 2 + 2 + 2 + 2 = 8, faltam 2, restos iguais → P e M ganham.
    const [chip] = chipsDaProducao(
      [
        ordem({
          passaram: 6,
          pecas: [
            { feitas: 4, maiorMm: 50 },
            { feitas: 4, maiorMm: 200 },
            { feitas: 4, maiorMm: 300 },
            { feitas: 4, maiorMm: 0 },
          ],
        }),
      ],
      REGUA_10_25,
    );
    expect(chip?.pendentes).toBe(10);
    expect(chip?.porTamanho).toEqual({ P: 3, M: 3, G: 2 });
    expect(chip?.semMedida).toBe(2);
  });

  it("três restos iguais entre M, G e sem medida: M e G antes de sem medida", () => {
    // 3 de cada (M, G, sem medida) = 9; 1 passou → 8 pendentes; 8/3 em cada: pisos 2 + 2 + 2,
    // faltam 2 → M e G.
    const [chip] = chipsDaProducao(
      [
        ordem({
          passaram: 1,
          pecas: [
            { feitas: 3, maiorMm: 0 },
            { feitas: 3, maiorMm: 300 },
            { feitas: 3, maiorMm: 200 },
          ],
        }),
      ],
      REGUA_10_25,
    );
    expect(chip?.porTamanho).toEqual({ P: 0, M: 3, G: 3 });
    expect(chip?.semMedida).toBe(2);
  });

  it("a soma dos tamanhos e das sem medida é sempre exatamente as pendentes", () => {
    for (let passaram = 0; passaram <= 23; passaram += 1) {
      const chips = chipsDaProducao(
        [
          ordem({
            passaram,
            pecas: [
              { feitas: 7, maiorMm: 90 },
              { feitas: 5, maiorMm: 150 },
              { feitas: 3, maiorMm: 400 },
              { feitas: 8, maiorMm: 0 },
            ],
          }),
        ],
        REGUA_10_25,
      );
      for (const chip of chips) {
        const soma = chip.porTamanho.P + chip.porTamanho.M + chip.porTamanho.G + chip.semMedida;
        expect(soma).toBe(chip.pendentes);
        expect(chip.pendentes).toBe(23 - passaram);
      }
    }
  });

  it("a peça no limite exato do P (100 mm) entra em P no chip — a fronteira de tamanhoPelaRegua", () => {
    const [chip] = chipsDaProducao([ordem({ pecas: [{ feitas: 3, maiorMm: 100 }] })], REGUA_10_25);
    expect(chip?.porTamanho).toEqual({ P: 3, M: 0, G: 0 });
  });

  it("preserva a ordem de entrada (a do quadro) e a etapa de cada ordem", () => {
    const chips = chipsDaProducao(
      [
        ordem({ ordemId: "c", nome: "terceira", etapa: "queima2", pecas: [{ feitas: 1, maiorMm: 80 }] }),
        ordem({ ordemId: "a", nome: "primeira", pecas: [{ feitas: 2, maiorMm: 80 }] }),
        ordem({ ordemId: "b", nome: "segunda", pecas: [{ feitas: 3, maiorMm: 80 }] }),
      ],
      REGUA_10_25,
    );
    expect(chips.map((chip) => [chip.ordemId, chip.etapa])).toEqual([
      ["c", "queima2"],
      ["a", "queima1"],
      ["b", "queima1"],
    ]);
  });
});

describe("somarChip", () => {
  const chip: ChipDaOrdem = {
    ordemId: "a",
    nome: "x",
    etapa: "queima1",
    pendentes: 10,
    porTamanho: { P: 5, M: 2, G: 0 },
    semMedida: 3,
  };

  it("sem tamanho para o resto, soma só os medidos nas internas", () => {
    expect(somarChip(CONTAGEM_VAZIA, chip, null)).toEqual({
      ...CONTAGEM_VAZIA,
      internasP: 5,
      internasM: 2,
      internasG: 0,
    });
  });

  it("com G escolhido, as sem medida entram em internas G; externas e caixa intocadas", () => {
    expect(somarChip(CONTAGEM, chip, "G")).toEqual({
      ...CONTAGEM,
      internasP: CONTAGEM.internasP + 5,
      internasM: CONTAGEM.internasM + 2,
      internasG: CONTAGEM.internasG + 3,
    });
  });

  it("nunca passa do teto do contador", () => {
    const quaseNoTeto = { ...CONTAGEM_VAZIA, internasP: TETO_DO_CONTADOR - 1 };
    expect(somarChip(quaseNoTeto, chip, null).internasP).toBe(TETO_DO_CONTADOR);
  });
});

describe("textos dos chips (verbatim da UI-SPEC)", () => {
  it("rótulo, texto, sufixo e aria-label com plural de verdade", () => {
    expect(ROTULO_CHIPS).toBe("Esperando esta queima na Produção — toque para somar:");
    expect(textoDoChip(16, "[e2e] canecas")).toBe("+16 · [e2e] canecas");
    expect(SUFIXO_SOMADO).toBe(" · somado");
    expect(ariaDoChip(12, "[e2e] canecas")).toBe("Somar 12 peças de [e2e] canecas às internas");
    expect(ariaDoChip(1, "[e2e] canecas")).toBe("Somar 1 peça de [e2e] canecas às internas");
  });
});
