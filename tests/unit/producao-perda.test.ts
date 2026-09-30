import { describe, expect, it } from "vitest";

import { subtrairMeses } from "@/lib/producao/calendario";
import { perdaMedida, perdaTecnica, type ConclusaoParaAPerda } from "@/lib/producao/perda";

// A perda medida dos últimos 6 meses (Fase 06.1, plano 12 — D-08, PRD-17): perdidas ÷ feitas
// (pedido + a mais) das ordens concluídas na janela, em pontos-base inteiros, meio-para-cima. As
// extras sem destino NUNCA entram — nem são campo da entrada (a separação é por construção).

describe("subtrairMeses — mês civil, dia ajustado ao último dia do mês", () => {
  it("31/08 − 6 meses = 28/02 (ano comum)", () => {
    expect(subtrairMeses("2026-08-31", 6)).toBe("2026-02-28");
  });

  it("31/08 − 6 meses = 29/02 (ano bissexto)", () => {
    expect(subtrairMeses("2028-08-31", 6)).toBe("2028-02-29");
  });

  it("30/09 − 6 meses = 30/03 (o dia existe, não muda)", () => {
    expect(subtrairMeses("2026-09-30", 6)).toBe("2026-03-30");
  });

  it("atravessa o ano: 15/03/2026 − 6 meses = 15/09/2025", () => {
    expect(subtrairMeses("2026-03-15", 6)).toBe("2025-09-15");
  });

  it("31/12 − 1 mês = 30/11; 0 meses devolve a mesma data", () => {
    expect(subtrairMeses("2026-12-31", 1)).toBe("2026-11-30");
    expect(subtrairMeses("2026-12-31", 0)).toBe("2026-12-31");
  });
});

describe("perdaTecnica — pontos-base inteiros, meio-para-cima", () => {
  it("1 de 3 → 3333 (33,33%)", () => {
    expect(perdaTecnica(1, 3)).toBe(3333);
  });

  it("2 de 3 → 6667 (66,666…% arredonda para cima)", () => {
    expect(perdaTecnica(2, 3)).toBe(6667);
  });

  it("meio exato sobe: 1 de 16 000 = 0,625 pb → 1", () => {
    expect(perdaTecnica(1, 16_000)).toBe(1);
  });

  it("4 de 100 → 400", () => {
    expect(perdaTecnica(4, 100)).toBe(400);
  });

  it("0 de 0 → null (sem medida)", () => {
    expect(perdaTecnica(0, 0)).toBeNull();
  });

  it("0 de 10 → 0", () => {
    expect(perdaTecnica(0, 10)).toBe(0);
  });
});

describe("perdaMedida — os últimos 6 meses", () => {
  const HOJE = "2026-09-30";

  it("duas ordens (3 de 60 e 1 de 40) → 400 pb, 4 de 100, 2 ordens", () => {
    const conclusoes: ConclusaoParaAPerda[] = [
      { concluidaEm: "2026-09-10", perdidas: 3, feitas: 60 },
      { concluidaEm: "2026-07-01", perdidas: 1, feitas: 40 },
    ];
    expect(perdaMedida(conclusoes, HOJE, 6)).toEqual({
      pontosBase: 400,
      perdidas: 4,
      feitas: 100,
      ordens: 2,
    });
  });

  it("o padrão é 6 meses", () => {
    const conclusoes: ConclusaoParaAPerda[] = [{ concluidaEm: "2026-03-30", perdidas: 1, feitas: 10 }];
    expect(perdaMedida(conclusoes, HOJE)).toEqual(perdaMedida(conclusoes, HOJE, 6));
  });

  it("a ordem concluída exatamente em hoje − 6 meses entra; um dia antes fica fora", () => {
    const noLimite: ConclusaoParaAPerda = { concluidaEm: "2026-03-30", perdidas: 2, feitas: 10 };
    const umDiaAntes: ConclusaoParaAPerda = { concluidaEm: "2026-03-29", perdidas: 9, feitas: 10 };
    expect(perdaMedida([noLimite, umDiaAntes], HOJE, 6)).toEqual({
      pontosBase: 2000,
      perdidas: 2,
      feitas: 10,
      ordens: 1,
    });
  });

  it("a janela usa o mês civil ajustado: hoje 31/08 → desde 28/02", () => {
    const conclusoes: ConclusaoParaAPerda[] = [
      { concluidaEm: "2026-02-28", perdidas: 1, feitas: 10 },
      { concluidaEm: "2026-02-27", perdidas: 5, feitas: 10 },
    ];
    expect(perdaMedida(conclusoes, "2026-08-31", 6)).toEqual({
      pontosBase: 1000,
      perdidas: 1,
      feitas: 10,
      ordens: 1,
    });
  });

  it("lista vazia → sem medida (pontosBase null), zeros", () => {
    expect(perdaMedida([], HOJE, 6)).toEqual({ pontosBase: null, perdidas: 0, feitas: 0, ordens: 0 });
  });

  it("só ordens fora da janela → sem medida", () => {
    const conclusoes: ConclusaoParaAPerda[] = [{ concluidaEm: "2025-01-10", perdidas: 1, feitas: 10 }];
    expect(perdaMedida(conclusoes, HOJE, 6).pontosBase).toBeNull();
  });

  it("feitas 0 na janela → sem medida", () => {
    const conclusoes: ConclusaoParaAPerda[] = [{ concluidaEm: "2026-09-01", perdidas: 0, feitas: 0 }];
    expect(perdaMedida(conclusoes, HOJE, 6).pontosBase).toBeNull();
  });

  it("a ordem da casa entra como qualquer outra (não há tipo na entrada: a casa é uma conclusão)", () => {
    const encomenda: ConclusaoParaAPerda = { concluidaEm: "2026-09-10", perdidas: 3, feitas: 60 };
    const casa: ConclusaoParaAPerda = { concluidaEm: "2026-09-12", perdidas: 1, feitas: 40 };
    expect(perdaMedida([encomenda, casa], HOJE, 6).ordens).toBe(2);
    expect(perdaMedida([encomenda, casa], HOJE, 6).pontosBase).toBe(400);
  });

  it("as extras sem destino não mudam o resultado — um campo a mais na conclusão é ignorado", () => {
    const base: ConclusaoParaAPerda = { concluidaEm: "2026-09-10", perdidas: 3, feitas: 60 };
    const comExtras = { ...base, extrasQueSobraram: 7 } as ConclusaoParaAPerda;
    expect(perdaMedida([comExtras], HOJE, 6)).toEqual(perdaMedida([base], HOJE, 6));
  });

  it("o acumulado é soma (perdidas ÷ feitas), não média das taxas, e não depende da ordem", () => {
    const conclusoes: ConclusaoParaAPerda[] = [
      { concluidaEm: "2026-09-01", perdidas: 1, feitas: 2 },
      { concluidaEm: "2026-08-01", perdidas: 0, feitas: 98 },
    ];
    // Média das taxas daria 25%; a soma dá 1 de 100 = 1%.
    expect(perdaMedida(conclusoes, HOJE, 6).pontosBase).toBe(100);
    expect(perdaMedida([...conclusoes].reverse(), HOJE, 6)).toEqual(perdaMedida(conclusoes, HOJE, 6));
  });
});
