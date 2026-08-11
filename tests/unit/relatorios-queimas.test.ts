import { describe, expect, it } from "vitest";

import { diaCivilEmBrasilia } from "../../lib/queimas/formato";
import {
  agregarPorForno,
  agregarPorMes,
  agregarPorSemana,
  estatisticasDeQueimas,
  inicioDaSemana,
  janelaDeOitoSemanas,
  janelaDeSeisMeses,
  type QueimaParaAgregacao,
} from "../../lib/queimas/relatorios";

// Fixture mínima — mesma técnica de tests/unit/filtros-fornos.test.ts.
function queima(sobrescritas: Partial<QueimaParaAgregacao> = {}): QueimaParaAgregacao {
  return {
    diaCivil: "2026-08-10",
    tipo: "biscoito",
    ...sobrescritas,
  };
}

describe("inicioDaSemana", () => {
  it("uma segunda-feira devolve ela mesma", () => {
    expect(inicioDaSemana("2026-08-10")).toBe("2026-08-10");
  });

  it("o domingo seguinte devolve a segunda que abriu aquela semana (a semana começa na segunda)", () => {
    expect(inicioDaSemana("2026-08-16")).toBe("2026-08-10");
  });

  it("cada dia de uma semana completa (terça a sábado) devolve a mesma segunda", () => {
    expect(inicioDaSemana("2026-08-11")).toBe("2026-08-10"); // terça
    expect(inicioDaSemana("2026-08-12")).toBe("2026-08-10"); // quarta
    expect(inicioDaSemana("2026-08-13")).toBe("2026-08-10"); // quinta
    expect(inicioDaSemana("2026-08-14")).toBe("2026-08-10"); // sexta
    expect(inicioDaSemana("2026-08-15")).toBe("2026-08-10"); // sábado
  });

  it("atravessa virada de mês e de ano corretamente", () => {
    expect(inicioDaSemana("2026-02-01")).toBe("2026-01-26"); // domingo → segunda anterior, mês anterior
    expect(inicioDaSemana("2027-01-02")).toBe("2026-12-28"); // sábado → segunda no ano anterior
  });
});

describe("fuso — o balde de uma queima perto da meia-noite de Brasília", () => {
  it("23:30 de domingo em Brasília (2026-08-10T02:30:00Z) cai na semana iniciada em 2026-08-03, não na que começa na segunda seguinte", () => {
    const diaCivil = diaCivilEmBrasilia("2026-08-10T02:30:00Z");
    expect(diaCivil).toBe("2026-08-09"); // domingo civil de Brasília

    expect(inicioDaSemana(diaCivil)).toBe("2026-08-03");

    const baldes = agregarPorSemana([queima({ diaCivil, tipo: "biscoito" })], "2026-08-10");
    const baldeDaSemanaAnterior = baldes.find((balde) => balde.inicio === "2026-08-03")!;
    const baldeDaSemanaSeguinte = baldes.find((balde) => balde.inicio === "2026-08-10")!;
    expect(baldeDaSemanaAnterior.total).toBe(1);
    expect(baldeDaSemanaSeguinte.total).toBe(0);
  });

  it("00:10 de segunda em Brasília abre a semana seguinte", () => {
    // 00:10 de segunda 2026-08-10 em Brasília = 03:10 UTC do mesmo dia.
    const diaCivil = diaCivilEmBrasilia("2026-08-10T03:10:00Z");
    expect(diaCivil).toBe("2026-08-10");
    expect(inicioDaSemana(diaCivil)).toBe("2026-08-10");
  });
});

describe("balde semiaberto — inicio <= x < fim", () => {
  it("uma queima exatamente no início de um balde entra NAQUELE balde", () => {
    const baldes = agregarPorSemana([queima({ diaCivil: "2026-08-10" })], "2026-08-10");
    const balde = baldes.find((b) => b.inicio === "2026-08-10")!;
    expect(balde.total).toBe(1);
  });

  it("uma queima exatamente no instante de fim de um balde entra no SEGUINTE, nunca nos dois", () => {
    // O balde iniciado em 2026-08-03 termina (exclusivo) em 2026-08-10 — uma queima no próprio
    // dia 2026-08-10 pertence ao balde seguinte, não ao que ela "fecharia".
    const baldes = agregarPorSemana([queima({ diaCivil: "2026-08-10" })], "2026-08-10");
    const baldeAnterior = baldes.find((b) => b.inicio === "2026-08-03")!;
    const baldeAtual = baldes.find((b) => b.inicio === "2026-08-10")!;
    expect(baldeAnterior.total).toBe(0);
    expect(baldeAtual.total).toBe(1);
  });
});

describe("agregarPorSemana — forma fixa da janela", () => {
  it("devolve sempre 8 baldes, do mais antigo ao mais recente, mesmo com entrada vazia", () => {
    const baldes = agregarPorSemana([], "2026-08-10");
    expect(baldes).toHaveLength(8);
    expect(baldes.every((balde) => balde.total === 0)).toBe(true);
    // Ordem crescente de `inicio` — do mais antigo ao mais recente.
    const inicios = baldes.map((b) => b.inicio);
    expect(inicios).toEqual([...inicios].sort());
  });

  it("o último balde é a semana de hoje, e o primeiro é 7 semanas antes dela", () => {
    const baldes = agregarPorSemana([], "2026-08-10");
    expect(baldes[7].inicio).toBe("2026-08-10"); // semana de hoje (hoje é a própria segunda)
    expect(baldes[0].inicio).toBe("2026-06-22"); // 7 * 7 = 49 dias antes de 2026-08-10
  });

  it("janelaDeOitoSemanas devolve os mesmos 8 limites, cada um com 7 dias de largura", () => {
    const limites = janelaDeOitoSemanas("2026-08-10");
    expect(limites).toHaveLength(8);
    expect(limites[7]).toEqual({ inicio: "2026-08-10", fimExclusivo: "2026-08-17" });
    expect(limites[0]).toEqual({ inicio: "2026-06-22", fimExclusivo: "2026-06-29" });
  });
});

describe("agregarPorMes — meses civis, virada de ano", () => {
  it("devolve sempre 6 baldes, do mais antigo ao mais recente, mesmo com entrada vazia", () => {
    const baldes = agregarPorMes([], "2026-02-15");
    expect(baldes).toHaveLength(6);
    expect(baldes.every((balde) => balde.total === 0)).toBe(true);
  });

  it("o mês de hoje mais os cinco anteriores, atravessando a virada de ano corretamente", () => {
    const limites = janelaDeSeisMeses("2026-02-15");
    expect(limites.map((l) => l.inicio)).toEqual([
      "2025-09-01",
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
    expect(limites[3]).toEqual({ inicio: "2025-12-01", fimExclusivo: "2026-01-01" });
    expect(limites[5]).toEqual({ inicio: "2026-02-01", fimExclusivo: "2026-03-01" });
  });

  it("uma queima em cada mês da janela, incluindo antes e depois da virada, soma corretamente por balde", () => {
    const queimas: QueimaParaAgregacao[] = [
      queima({ diaCivil: "2025-09-05" }),
      queima({ diaCivil: "2025-12-31" }), // último dia do ano
      queima({ diaCivil: "2026-01-01" }), // primeiro dia do ano seguinte
      queima({ diaCivil: "2026-02-15" }),
    ];
    const baldes = agregarPorMes(queimas, "2026-02-15");
    expect(baldes.find((b) => b.inicio === "2025-09-01")!.total).toBe(1);
    expect(baldes.find((b) => b.inicio === "2025-12-01")!.total).toBe(1);
    expect(baldes.find((b) => b.inicio === "2026-01-01")!.total).toBe(1);
    expect(baldes.find((b) => b.inicio === "2026-02-01")!.total).toBe(1);
  });
});

describe("a soma dos baldes bate com a contagem manual do histórico (FOR-12)", () => {
  it("a soma de todos os baldes de agregarPorSemana sobre um conjunto inteiramente dentro da janela é igual ao número de queimas", () => {
    const queimas: QueimaParaAgregacao[] = [
      queima({ diaCivil: "2026-06-22", tipo: "biscoito" }),
      queima({ diaCivil: "2026-06-25", tipo: "esmalte" }),
      queima({ diaCivil: "2026-07-10", tipo: "ouro" }),
      queima({ diaCivil: "2026-07-11", tipo: "ouro" }),
      queima({ diaCivil: "2026-08-09", tipo: "biscoito" }),
      queima({ diaCivil: "2026-08-10", tipo: "esmalte" }),
    ];
    const baldes = agregarPorSemana(queimas, "2026-08-10");
    const somaDosBaldes = baldes.reduce((soma, balde) => soma + balde.total, 0);
    expect(somaDosBaldes).toBe(queimas.length);
  });

  it("a soma de todos os baldes de agregarPorMes sobre um conjunto inteiramente dentro da janela é igual ao número de queimas", () => {
    const queimas: QueimaParaAgregacao[] = [
      queima({ diaCivil: "2025-09-05" }),
      queima({ diaCivil: "2025-09-06" }),
      queima({ diaCivil: "2025-12-31" }),
      queima({ diaCivil: "2026-01-01" }),
      queima({ diaCivil: "2026-02-15" }),
    ];
    const baldes = agregarPorMes(queimas, "2026-02-15");
    const somaDosBaldes = baldes.reduce((soma, balde) => soma + balde.total, 0);
    expect(somaDosBaldes).toBe(queimas.length);
  });
});

describe("cada balde traz a contagem separada por tipo, sempre na ordem biscoito, esmalte, ouro", () => {
  it("a soma dos três tipos do balde é igual ao total do balde", () => {
    const queimas: QueimaParaAgregacao[] = [
      queima({ diaCivil: "2026-08-10", tipo: "biscoito" }),
      queima({ diaCivil: "2026-08-10", tipo: "biscoito" }),
      queima({ diaCivil: "2026-08-10", tipo: "esmalte" }),
      queima({ diaCivil: "2026-08-10", tipo: "ouro" }),
    ];
    const baldes = agregarPorSemana(queimas, "2026-08-10");
    const balde = baldes.find((b) => b.inicio === "2026-08-10")!;
    expect(balde.biscoito).toBe(2);
    expect(balde.esmalte).toBe(1);
    expect(balde.ouro).toBe(1);
    expect(balde.total).toBe(4);
    expect(balde.biscoito + balde.esmalte + balde.ouro).toBe(balde.total);
  });
});

describe("estatisticasDeQueimas", () => {
  it("devolve total geral, total dos últimos 30 dias civis e a contagem de biscoito e esmalte", () => {
    const queimas: QueimaParaAgregacao[] = [
      queima({ diaCivil: "2026-08-10", tipo: "biscoito" }), // hoje
      queima({ diaCivil: "2026-07-12", tipo: "esmalte" }), // dentro dos últimos 30 dias (29 dias atrás)
      queima({ diaCivil: "2026-06-01", tipo: "ouro" }), // fora dos últimos 30 dias
      queima({ diaCivil: "2026-05-01", tipo: "biscoito" }), // fora dos últimos 30 dias
    ];
    const estatisticas = estatisticasDeQueimas(queimas, "2026-08-10");
    expect(estatisticas.total).toBe(4);
    expect(estatisticas.ultimos30Dias).toBe(2);
    expect(estatisticas.biscoito).toBe(2);
    expect(estatisticas.esmalte).toBe(1);
  });

  it("entrada vazia devolve estatísticas em zero, nunca lista vazia nem undefined", () => {
    const estatisticas = estatisticasDeQueimas([], "2026-08-10");
    expect(estatisticas).toEqual({ total: 0, ultimos30Dias: 0, biscoito: 0, esmalte: 0 });
  });

  it("uma queima exatamente 29 dias atrás de hoje entra nos últimos 30 dias (janela inclusiva de 30 dias civis)", () => {
    const estatisticas = estatisticasDeQueimas(
      [queima({ diaCivil: "2026-07-12" })], // 2026-08-10 menos 29 dias
      "2026-08-10",
    );
    expect(estatisticas.ultimos30Dias).toBe(1);
  });

  it("uma queima exatamente 30 dias atrás de hoje NÃO entra nos últimos 30 dias", () => {
    const estatisticas = estatisticasDeQueimas(
      [queima({ diaCivil: "2026-07-11" })], // 2026-08-10 menos 30 dias
      "2026-08-10",
    );
    expect(estatisticas.ultimos30Dias).toBe(0);
  });
});

describe("agregarPorForno", () => {
  it("agrupa o total de queimas por forno, um item por forno distinto", () => {
    const resultado = agregarPorForno([
      { fornoId: "1", fornoNome: "Forno 01" },
      { fornoId: "1", fornoNome: "Forno 01" },
      { fornoId: "2", fornoNome: "Forno 02" },
    ]);
    const forno1 = resultado.find((f) => f.fornoId === "1")!;
    const forno2 = resultado.find((f) => f.fornoId === "2")!;
    expect(forno1.total).toBe(2);
    expect(forno2.total).toBe(1);
  });

  it("um único forno produz uma única barra, não uma lista vazia nem um gráfico degenerado", () => {
    const resultado = agregarPorForno([{ fornoId: "1", fornoNome: "Forno único" }]);
    expect(resultado).toEqual([{ fornoId: "1", fornoNome: "Forno único", total: 1 }]);
  });

  it("entrada vazia devolve lista vazia", () => {
    expect(agregarPorForno([])).toEqual([]);
  });
});

describe("pureza — mesma entrada, mesma saída, sem ler o relógio por dentro", () => {
  it("chamar agregarPorSemana duas vezes com a mesma entrada devolve o mesmo resultado", () => {
    const queimas: QueimaParaAgregacao[] = [queima({ diaCivil: "2026-08-10" })];
    const primeira = agregarPorSemana(queimas, "2026-08-10");
    const segunda = agregarPorSemana(queimas, "2026-08-10");
    expect(segunda).toEqual(primeira);
  });

  it("chamar estatisticasDeQueimas duas vezes com a mesma entrada devolve o mesmo resultado", () => {
    const queimas: QueimaParaAgregacao[] = [queima({ diaCivil: "2026-08-10" })];
    const primeira = estatisticasDeQueimas(queimas, "2026-08-10");
    const segunda = estatisticasDeQueimas(queimas, "2026-08-10");
    expect(segunda).toEqual(primeira);
  });
});
