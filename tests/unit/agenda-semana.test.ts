import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  agruparPorDia,
  diasDaSemana,
  ordenarNoDia,
  rotuloDoDia,
  segundaDaSemana,
  tituloDaSemana,
  type ItemDoDia,
} from "@/lib/agenda/semana";

describe("segundaDaSemana", () => {
  it("o domingo pertence à semana que começou na segunda anterior", () => {
    expect(segundaDaSemana("2026-10-04")).toBe("2026-09-28");
  });

  it("a segunda é a própria segunda", () => {
    expect(segundaDaSemana("2026-10-05")).toBe("2026-10-05");
  });

  it("qualquer dia do meio volta à segunda, cruzando mês e ano", () => {
    expect(segundaDaSemana("2026-10-08")).toBe("2026-10-05");
    expect(segundaDaSemana("2027-01-01")).toBe("2026-12-28");
    expect(segundaDaSemana("2026-11-01")).toBe("2026-10-26");
  });

  it("29/02 cai na semana certa", () => {
    expect(segundaDaSemana("2028-02-29")).toBe("2028-02-28");
    expect(diasDaSemana("2028-02-28")).toContain("2028-02-29");
  });
});

describe("diasDaSemana", () => {
  it("sete dias de segunda a domingo, cruzando o ano", () => {
    expect(diasDaSemana("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("tituloDaSemana", () => {
  it("dd/mm a dd/mm dentro do ano", () => {
    expect(tituloDaSemana("2026-10-05")).toBe("05/10 a 11/10");
  });

  it("com o ano quando a semana cruza o ano", () => {
    expect(tituloDaSemana("2026-12-28")).toBe("28/12/2026 a 03/01/2027");
  });
});

describe("rotuloDoDia", () => {
  it("dia da semana · dd/mm, e · hoje no dia de hoje", () => {
    expect(rotuloDoDia("2026-10-05", "2026-10-01")).toBe("segunda · 05/10");
    expect(rotuloDoDia("2026-10-01", "2026-10-01")).toBe("quinta · 01/10 · hoje");
    expect(rotuloDoDia("2026-10-04", "2026-10-01")).toBe("domingo · 04/10");
  });
});

function item(parcial: Partial<ItemDoDia> & { id: string }): ItemDoDia {
  return { data: "2026-10-05", tipo: "avulsa", inicio: "10:00", ...parcial };
}

describe("ordenarNoDia", () => {
  it("fechado primeiro (dia todo), depois por início, depois por tipo, depois por id", () => {
    const ordenados = ordenarNoDia([
      item({ id: "c", tipo: "avulsa", inicio: "19:00:00" }),
      item({ id: "b", tipo: "avulsa", inicio: "09:00" }),
      item({ id: "z", tipo: "fechado", inicio: null }),
      item({ id: "a", tipo: "avulsa", inicio: "19:00" }),
      item({ id: "t", tipo: "turma", inicio: "19:00" }),
    ]);
    expect(ordenados.map((evento) => evento.id)).toEqual(["z", "b", "t", "a", "c"]);
  });

  it("no mesmo horário, o título desempata antes do tipo (sem caixa nem acento); sem título, tipo e id", () => {
    const ordenados = ordenarNoDia([
      item({ id: "1", tipo: "turma", inicio: "19:00", titulo: "Torno à noite" }),
      item({ id: "2", tipo: "avulsa", inicio: "19:00", titulo: "árvore de natal" }),
      item({ id: "3", tipo: "avulsa", inicio: "19:00", titulo: "Bule" }),
    ]);
    expect(ordenados.map((evento) => evento.id)).toEqual(["2", "3", "1"]);
  });

  it("dois eventos no mesmo horário aparecem os dois, e a ordem não muda entre chamadas", () => {
    const lista = [item({ id: "2", inicio: "14:00" }), item({ id: "1", inicio: "14:00" })];
    const primeira = ordenarNoDia(lista).map((evento) => evento.id);
    const segunda = ordenarNoDia([...lista].reverse()).map((evento) => evento.id);
    expect(primeira).toEqual(["1", "2"]);
    expect(segunda).toEqual(primeira);
  });

  it("não muda a lista recebida", () => {
    const lista = [item({ id: "2", inicio: "15:00" }), item({ id: "1", inicio: "14:00" })];
    ordenarNoDia(lista);
    expect(lista.map((evento) => evento.id)).toEqual(["2", "1"]);
  });
});

describe("agruparPorDia", () => {
  it("sete dias, segunda a domingo, cada um com a sua lista ordenada (vazia quando nada marcado)", () => {
    const grupos = agruparPorDia("2026-10-05", [
      item({ id: "x", data: "2026-10-07", inicio: "15:00" }),
      item({ id: "y", data: "2026-10-07", inicio: "09:00" }),
      item({ id: "w", data: "2026-10-11", inicio: "10:00" }),
      item({ id: "fora", data: "2026-10-12", inicio: "10:00" }),
    ]);
    expect(grupos.map((grupo) => grupo.data)).toEqual(diasDaSemana("2026-10-05"));
    expect(grupos[0].itens).toEqual([]);
    expect(grupos[2].itens.map((evento) => evento.id)).toEqual(["y", "x"]);
    expect(grupos[6].itens.map((evento) => evento.id)).toEqual(["w"]);
    expect(grupos.flatMap((grupo) => grupo.itens).map((evento) => evento.id)).not.toContain("fora");
  });
});

describe("pureza", () => {
  it("lib/agenda/semana.ts só importa módulos puros", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/semana.ts"), "utf8");
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    const imports = [...fonte.matchAll(/^import .* from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    for (const origem of imports) {
      expect(["@/lib/producao/calendario", "./horario", "./tipos"]).toContain(origem);
    }
  });
});
