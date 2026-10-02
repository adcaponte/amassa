import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ocupacaoDoEspaco,
  pessoasAgoraNoEspaco,
  presencaPendenteAgora,
  type AulaParaContar,
  type UsoLivreParaContar,
} from "@/lib/agenda/espaco";

// D-05 + D-18: "Agora no espaço" soma as pessoas dos usos livres DE HOJE com "Chegou" e não encerrados
// e os inscritos das aulas/oficinas de hoje, não canceladas, cujo horário cobre o agora, sem quem está
// marcado "Faltou". É uma CONTAGEM — o espaço não tem capacidade (decisão do dono de 29/09).
const HOJE = "2026-10-01";
const ONTEM = "2026-09-30";

function agoraAs(hora: string): { data: string; minutos: number } {
  const [h, m] = hora.split(":").map(Number);
  return { data: HOJE, minutos: h * 60 + m };
}

function uso(dados: Partial<UsoLivreParaContar> = {}): UsoLivreParaContar {
  return { data: HOJE, estado: "no_espaco", pessoas: 3, ...dados };
}

function aula(dados: Partial<AulaParaContar> = {}): AulaParaContar {
  return { data: HOJE, inicio: "19:00", fim: "21:00", cancelada: false, inscritos: 4, faltaram: 1, ...dados };
}

describe("pessoasAgoraNoEspaco — o uso livre", () => {
  it("uso de hoje no espaço com 3 pessoas → 3", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [uso()], aulas: [], agora: agoraAs("10:00") })).toBe(3);
  });

  it("o mesmo uso, de ontem e esquecido no espaço, não conta (D-18)", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [uso({ data: ONTEM })], aulas: [], agora: agoraAs("10:00") })).toBe(0);
  });

  it("reservado (ainda não chegou) e encerrado (já saiu) não contam", () => {
    expect(
      pessoasAgoraNoEspaco({
        usosLivres: [uso({ estado: "reservado" }), uso({ estado: "encerrado" })],
        aulas: [],
        agora: agoraAs("10:00"),
      }),
    ).toBe(0);
  });

  it("soma todos os usos de hoje no espaço", () => {
    expect(
      pessoasAgoraNoEspaco({
        usosLivres: [uso({ pessoas: 2 }), uso({ pessoas: 5 }), uso({ pessoas: 7, data: ONTEM })],
        aulas: [],
        agora: agoraAs("10:00"),
      }),
    ).toBe(7);
  });
});

describe("pessoasAgoraNoEspaco — a aula conta pelo horário", () => {
  it("aula 19:00-21:00 com 4 inscritos e 1 “Faltou”, agora 19:30 → 3", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula()], agora: agoraAs("19:30") })).toBe(3);
  });

  it("o início entra: agora 19:00 → 3", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula()], agora: agoraAs("19:00") })).toBe(3);
  });

  it("o fim não entra: agora 21:00 → 0", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula()], agora: agoraAs("21:00") })).toBe(0);
  });

  it("antes do início → 0", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula()], agora: agoraAs("18:59") })).toBe(0);
  });

  it("aula cancelada → 0", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula({ cancelada: true })], agora: agoraAs("19:30") })).toBe(0);
  });

  it("aula de outro dia no mesmo horário → 0", () => {
    expect(pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula({ data: ONTEM })], agora: agoraAs("19:30") })).toBe(0);
  });

  it("aceita a hora com segundos, como o `pg` devolve", () => {
    expect(
      pessoasAgoraNoEspaco({
        usosLivres: [],
        aulas: [aula({ inicio: "19:00:00", fim: "21:00:00" })],
        agora: agoraAs("20:59"),
      }),
    ).toBe(3);
  });

  it("todos faltaram → 0, nunca negativo", () => {
    expect(
      pessoasAgoraNoEspaco({ usosLivres: [], aulas: [aula({ inscritos: 2, faltaram: 2 })], agora: agoraAs("19:30") }),
    ).toBe(0);
  });
});

describe("pessoasAgoraNoEspaco — as duas fontes juntas", () => {
  it("soma o uso livre e a aula", () => {
    expect(
      pessoasAgoraNoEspaco({
        usosLivres: [uso({ pessoas: 2 })],
        aulas: [aula(), aula({ inicio: "08:00", fim: "10:00", inscritos: 9, faltaram: 0 })],
        agora: agoraAs("19:30"),
      }),
    ).toBe(5);
  });

  it("nada → 0, e a frase é “0 pessoas”, sem fração nem capacidade", () => {
    const n = pessoasAgoraNoEspaco({ usosLivres: [], aulas: [], agora: agoraAs("12:00") });
    expect(n).toBe(0);
    expect(ocupacaoDoEspaco(n)).toBe("0 pessoas");
    expect(ocupacaoDoEspaco(n)).not.toMatch(/lugar|capacidade|lota|\bde\s+\d/i);
  });
});

describe("presencaPendenteAgora — a tag “marcar presença” da linha do Início", () => {
  it("depois do início, com alguém sem marcação → pede", () => {
    expect(presencaPendenteAgora({ inicio: "19:00", cancelada: false, semMarcacao: 1 }, 19 * 60)).toBe(true);
  });

  it("antes do início → não pede", () => {
    expect(presencaPendenteAgora({ inicio: "19:00", cancelada: false, semMarcacao: 1 }, 18 * 60 + 59)).toBe(false);
  });

  it("todos marcados ou data cancelada → não pede", () => {
    expect(presencaPendenteAgora({ inicio: "19:00", cancelada: false, semMarcacao: 0 }, 20 * 60)).toBe(false);
    expect(presencaPendenteAgora({ inicio: "19:00", cancelada: true, semMarcacao: 3 }, 20 * 60)).toBe(false);
  });
});

describe("espaco.ts — pureza e a decisão do dono", () => {
  const fonte = readFileSync(join(process.cwd(), "lib/agenda/espaco.ts"), "utf8");

  it("não alcança banco, React nem Next, e não lê o relógio", () => {
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });

  it("o comentário fala do presente (sem “quando a Agenda existir” nem os requisitos velhos)", () => {
    expect(fonte).not.toMatch(/AGD-0|quando a Agenda existir/);
    expect(fonte).toMatch(/29\/09\/2026/);
  });
});
