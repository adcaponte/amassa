import { describe, expect, it } from "vitest";

import { janelaDoCaixa, mesesDaJanela, separarPelaJanela } from "@/lib/financeiro/janela";
import {
  fraseVazioAPagarNaJanela,
  fraseVazioAReceberNaJanela,
  rotuloMostrarSoAte,
  rotuloVerDepois,
  textoDepoisDe,
  textoJanelaAte,
  textoSubtituloDaJanela,
} from "@/lib/financeiro/textos";

describe("janelaDoCaixa", () => {
  it("vai até hoje + 30 dias corridos", () => {
    expect(janelaDoCaixa("2026-10-06")).toEqual({ ate: "2026-11-05" });
  });

  it("vira o mês e o ano", () => {
    expect(janelaDoCaixa("2026-12-15")).toEqual({ ate: "2027-01-14" });
    expect(janelaDoCaixa("2027-01-31")).toEqual({ ate: "2027-03-02" });
  });

  it("fevereiro de ano bissexto conta o dia 29", () => {
    expect(janelaDoCaixa("2028-02-01")).toEqual({ ate: "2028-03-02" });
  });
});

describe("separarPelaJanela", () => {
  const janela = janelaDoCaixa("2026-10-06"); // até 2026-11-05

  it("no limite (hoje + 30) entra; um dia depois, não", () => {
    const { daJanela, depois } = separarPelaJanela(
      [{ vencimento: "2026-11-05", id: "limite" }, { vencimento: "2026-11-06", id: "fora" }],
      janela,
    );
    expect(daJanela.map((c) => c.id)).toEqual(["limite"]);
    expect(depois.map((c) => c.id)).toEqual(["fora"]);
  });

  it("vencidas (inclusive de anos atrás) e as de hoje entram na janela", () => {
    const { daJanela, depois } = separarPelaJanela(
      [
        { vencimento: "2024-01-10", id: "antiga" },
        { vencimento: "2026-10-05", id: "ontem" },
        { vencimento: "2026-10-06", id: "hoje" },
      ],
      janela,
    );
    expect(daJanela.map((c) => c.id)).toEqual(["antiga", "ontem", "hoje"]);
    expect(depois).toEqual([]);
  });

  it("mantém a ordem de chegada nas duas partes e não muta a lista recebida", () => {
    const contas = [
      { vencimento: "2027-01-10", id: "a" },
      { vencimento: "2026-10-20", id: "b" },
      { vencimento: "2026-12-01", id: "c" },
      { vencimento: "2026-10-01", id: "d" },
    ];
    const copia = structuredClone(contas);
    const { daJanela, depois } = separarPelaJanela(contas, janela);
    expect(daJanela.map((c) => c.id)).toEqual(["b", "d"]);
    expect(depois.map((c) => c.id)).toEqual(["a", "c"]);
    expect(contas).toEqual(copia);
  });

  it("lista vazia dá duas partes vazias", () => {
    expect(separarPelaJanela([], janela)).toEqual({ daJanela: [], depois: [] });
  });
});

describe("mesesDaJanela", () => {
  it("um mês só quando a janela não sai do mês de hoje", () => {
    expect(mesesDaJanela("2026-10-01", "2026-10-31")).toEqual(["2026-10"]);
  });

  it("dois meses na virada de mês", () => {
    expect(mesesDaJanela("2026-10-06", "2026-11-05")).toEqual(["2026-10", "2026-11"]);
  });

  it("dois meses na virada de ano", () => {
    expect(mesesDaJanela("2026-12-15", "2027-01-14")).toEqual(["2026-12", "2027-01"]);
  });

  it("três meses quando 30 dias atravessam um fevereiro curto", () => {
    expect(mesesDaJanela("2027-01-31", "2027-03-02")).toEqual(["2027-01", "2027-02", "2027-03"]);
  });
});

describe("textos da janela (verbatim da UI-SPEC)", () => {
  it("o botão tem singular e plural de verdade; aberto, vira “Mostrar só até”", () => {
    expect(rotuloVerDepois(1, "05/11")).toBe("Ver a que vence depois de 05/11");
    expect(rotuloVerDepois(3, "05/11")).toBe("Ver as 3 que vencem depois de 05/11");
    expect(rotuloMostrarSoAte("05/11")).toBe("Mostrar só até 05/11");
  });

  it("sub-linha, tile, separador e os vazios com data", () => {
    expect(textoSubtituloDaJanela("05/11")).toBe("Vencidas e as que vencem até 05/11.");
    expect(textoJanelaAte("05/11")).toBe("até 05/11");
    expect(textoDepoisDe("05/11")).toBe("Depois de 05/11");
    expect(fraseVazioAPagarNaJanela("05/11")).toBe("Nada vence até 05/11.");
    expect(fraseVazioAReceberNaJanela("05/11")).toBe("Ninguém deve nada até 05/11.");
  });
});
