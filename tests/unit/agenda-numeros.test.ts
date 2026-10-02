import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIAS_DAS_BARRAS,
  numerosDoMes,
  type DadosDosNumeros,
  type InscricaoDoMes,
  type UsoLivreDoMes,
} from "@/lib/agenda/numeros";

// AGE-19: a aba Números, só leitura, do dia 1 até hoje no fuso do ateliê. Nenhum dinheiro (§8).
const HOJE = "2026-10-15"; // quinta

function vazio(dados: Partial<DadosDosNumeros> = {}): DadosDosNumeros {
  return { usosLivres: [], inscricoes: [], saldosDeReposicao: [], ...dados };
}

function usoEncerrado(dados: Partial<UsoLivreDoMes> = {}): UsoLivreDoMes {
  return { data: "2026-10-05", clienteId: "c-uso", estado: "encerrado", pessoas: 2, horasCheias: 3, ...dados };
}

function inscricao(dados: Partial<InscricaoDoMes> = {}): InscricaoDoMes {
  return {
    data: "2026-10-06",
    clienteId: "c-1",
    presenca: "veio",
    inicio: "19:00",
    fim: "21:00",
    cancelada: false,
    ...dados,
  };
}

describe("numerosDoMes — mês vazio (UI-D22)", () => {
  it("zera tudo e a presença fica sem número (“—”), não 0%", () => {
    const numeros = numerosDoMes(vazio(), HOJE);
    expect(numeros).toMatchObject({
      usoLivre: { horas: 0, visitas: 0 },
      presenca: { porcento: null, faltas: 0 },
      aRepor: 0,
      pessoas: 0,
    });
    expect(numeros.barras.map((barra) => barra.horas)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("numerosDoMes — a presença nas aulas (precision)", () => {
  it("2 “Veio” e 1 “Faltou” → 67% e 1 falta", () => {
    const numeros = numerosDoMes(
      vazio({
        inscricoes: [inscricao(), inscricao({ clienteId: "c-2" }), inscricao({ clienteId: "c-3", presenca: "faltou" })],
      }),
      HOJE,
    );
    expect(numeros.presenca).toEqual({ porcento: 67, faltas: 1 });
  });

  it("1 de 3 → 33%; 1 de 2 → 50%; 1 de 8 (12,5) → 13, meio para cima", () => {
    const de = (veio: number, total: number) =>
      numerosDoMes(
        vazio({
          inscricoes: Array.from({ length: total }, (_, i) =>
            inscricao({ clienteId: `c-${i}`, presenca: i < veio ? "veio" : "faltou" }),
          ),
        }),
        HOJE,
      ).presenca.porcento;
    expect(de(1, 3)).toBe(33);
    expect(de(1, 2)).toBe(50);
    expect(de(1, 8)).toBe(13);
    expect(de(3, 3)).toBe(100);
    expect(de(0, 2)).toBe(0);
  });

  it("inscrição sem marcação não entra na conta; data cancelada também não", () => {
    const numeros = numerosDoMes(
      vazio({
        inscricoes: [
          inscricao(),
          inscricao({ clienteId: "c-2", presenca: null }),
          inscricao({ clienteId: "c-3", presenca: "faltou", cancelada: true }),
        ],
      }),
      HOJE,
    );
    expect(numeros.presenca).toEqual({ porcento: 100, faltas: 0 });
  });

  it("só sem marcação → “—” (null)", () => {
    expect(numerosDoMes(vazio({ inscricoes: [inscricao({ presenca: null })] }), HOJE).presenca.porcento).toBeNull();
  });
});

describe("numerosDoMes — horas-pessoa", () => {
  it("uso livre de 3 h cheias × 2 pessoas = 6 h, 1 visita", () => {
    const numeros = numerosDoMes(vazio({ usosLivres: [usoEncerrado()] }), HOJE);
    expect(numeros.usoLivre).toEqual({ horas: 6, visitas: 1 });
  });

  it("uso reservado ou ainda no espaço não soma horas nem visita", () => {
    const numeros = numerosDoMes(
      vazio({
        usosLivres: [
          usoEncerrado({ estado: "reservado", horasCheias: null }),
          usoEncerrado({ estado: "no_espaco", horasCheias: null }),
        ],
      }),
      HOJE,
    );
    expect(numeros.usoLivre).toEqual({ horas: 0, visitas: 0 });
  });

  it("aula de 2h30 com 2 presentes conta 6 h na barra do dia (teto da duração, A12)", () => {
    // 2026-10-06 é terça.
    const numeros = numerosDoMes(
      vazio({
        inscricoes: [
          inscricao({ inicio: "19:00", fim: "21:30" }),
          inscricao({ clienteId: "c-2", inicio: "19:00:00", fim: "21:30:00" }),
          inscricao({ clienteId: "c-3", presenca: "faltou", inicio: "19:00", fim: "21:30" }),
        ],
      }),
      HOJE,
    );
    expect(numeros.barras.find((barra) => barra.dia === "ter")?.horas).toBe(6);
  });

  it("a barra soma o uso livre e a aula do mesmo dia da semana", () => {
    // 2026-10-05 (segunda) e 2026-10-12 (segunda).
    const numeros = numerosDoMes(
      vazio({
        usosLivres: [usoEncerrado({ data: "2026-10-05" })],
        inscricoes: [inscricao({ data: "2026-10-12", inicio: "10:00", fim: "11:00" })],
      }),
      HOJE,
    );
    expect(numeros.barras.find((barra) => barra.dia === "seg")?.horas).toBe(7);
  });
});

describe("numerosDoMes — barras (ordering)", () => {
  it("vêm de segunda a domingo", () => {
    expect(numerosDoMes(vazio(), HOJE).barras.map((barra) => barra.dia)).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sáb",
      "dom",
    ]);
    expect(DIAS_DAS_BARRAS).toEqual(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]);
  });

  it("o domingo cai na última barra", () => {
    // 2026-10-04 é domingo.
    const numeros = numerosDoMes(vazio({ usosLivres: [usoEncerrado({ data: "2026-10-04", horasCheias: 1, pessoas: 1 })] }), HOJE);
    expect(numeros.barras[6]).toEqual({ dia: "dom", horas: 1 });
  });
});

describe("numerosDoMes — pessoas diferentes e aulas a repor", () => {
  it("quem veio duas vezes conta uma; uso livre iniciado conta; quem só faltou ou só reservou não", () => {
    const numeros = numerosDoMes(
      vazio({
        inscricoes: [
          inscricao({ clienteId: "a" }),
          inscricao({ clienteId: "a", data: "2026-10-08" }),
          inscricao({ clienteId: "b", presenca: "faltou" }),
          inscricao({ clienteId: "c", presenca: null }),
        ],
        usosLivres: [
          usoEncerrado({ clienteId: "a" }),
          usoEncerrado({ clienteId: "d", estado: "no_espaco", horasCheias: null }),
          usoEncerrado({ clienteId: "e", estado: "reservado", horasCheias: null }),
        ],
      }),
      HOJE,
    );
    expect(numeros.pessoas).toBe(2);
  });

  it("aulas a repor = soma dos saldos de hoje", () => {
    expect(numerosDoMes(vazio({ saldosDeReposicao: [1, 2, 0] }), HOJE).aRepor).toBe(3);
  });
});

describe("numerosDoMes — o intervalo é do dia 1 até hoje (boundary, adjacency)", () => {
  it("no dia 1, só o dia 1 entra — e os eventos de hoje contam", () => {
    const numeros = numerosDoMes(
      vazio({
        usosLivres: [usoEncerrado({ data: "2026-11-01" }), usoEncerrado({ data: "2026-10-31" }), usoEncerrado({ data: "2026-11-02" })],
        inscricoes: [inscricao({ data: "2026-11-01" }), inscricao({ data: "2026-10-31", presenca: "faltou" })],
      }),
      "2026-11-01",
    );
    expect(numeros.usoLivre).toEqual({ horas: 6, visitas: 1 });
    expect(numeros.presenca).toEqual({ porcento: 100, faltas: 0 });
  });

  it("depois de hoje não entra, nem o mês anterior", () => {
    const numeros = numerosDoMes(
      vazio({ usosLivres: [usoEncerrado({ data: "2026-10-16" }), usoEncerrado({ data: "2026-09-30" })] }),
      HOJE,
    );
    expect(numeros.usoLivre.visitas).toBe(0);
  });

  it.each([
    ["2026-02-28", "2026-02-01"],
    ["2028-02-29", "2028-02-01"],
    ["2026-04-30", "2026-04-01"],
    ["2026-12-31", "2026-12-01"],
  ])("último dia do mês %s: do dia 1 ao último, inclusive", (hoje, primeiro) => {
    const numeros = numerosDoMes(
      vazio({ usosLivres: [usoEncerrado({ data: primeiro }), usoEncerrado({ data: hoje })] }),
      hoje,
    );
    expect(numeros.usoLivre.visitas).toBe(2);
  });
});

describe("numeros.ts — pureza e sem dinheiro (§8)", () => {
  const fonte = readFileSync(join(process.cwd(), "lib/agenda/numeros.ts"), "utf8");

  it("não alcança banco, React nem Next, e não lê o relógio", () => {
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });

  it("nenhum valor em dinheiro nem custo", () => {
    expect(fonte).not.toMatch(/centavos|formatarReais|custo/i);
  });
});
