import { describe, expect, it } from "vitest";

import {
  FRASE_DIA_DA_SEMANA,
  FRASE_FIM_ANTES_DO_COMECO,
  FRASE_MENSALIDADE,
  FRASE_NOME_DA_TURMA,
  FRASE_SEMANAS,
  FRASE_VENCIMENTO,
} from "@/lib/agenda/textos";
import {
  esquemaCancelarData,
  esquemaConferirDia,
  esquemaFecharDia,
  esquemaLancarAvulsa,
  esquemaLancarTurma,
  esquemaTirarBloqueio,
} from "@/lib/agenda/esquemas";

// A validação do lançamento (AGE-01, AGE-12) — a MESMA regra roda no cliente (erro embaixo do campo,
// antes de gravar) e na Server Action (a única que vale, CLAUDE.md §Validação).

const AVULSA_VALIDA = {
  titulo: "  [teste] Oficina de pintura  ",
  data: "2026-10-08",
  inicio: "14:00",
  fim: "17:00",
  vagas: "8",
  preco: "120,50",
  publico: true,
};

function primeiraFrase(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.success ? null : (resultado.error?.issues[0]?.message ?? null);
}

function frasesPorCampo(resultado: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of resultado.error?.issues ?? []) {
    const campo = String(problema.path[0] ?? "");
    campos[campo] ??= problema.message;
  }
  return campos;
}

describe("esquemaLancarAvulsa", () => {
  it("aceita a aula válida: título aparado, vagas inteiras, preço em centavos inteiros (“120,50” → 12050)", () => {
    const resultado = esquemaLancarAvulsa.safeParse(AVULSA_VALIDA);
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      titulo: "[teste] Oficina de pintura",
      data: "2026-10-08",
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 12050,
      publico: true,
    });
  });

  it("“37,50” vira 3750 e “0” vale 0 (oficina gratuita)", () => {
    expect(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, preco: "37,50" }).data?.precoCentavos).toBe(
      3750,
    );
    const gratuita = esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, preco: "0" });
    expect(gratuita.success).toBe(true);
    expect(gratuita.data?.precoCentavos).toBe(0);
  });

  it("título vazio pede o nome", () => {
    expect(primeiraFrase(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, titulo: "   " }))).toBe(
      "Dê um nome à aula ou oficina.",
    );
  });

  it("título de 121 caracteres é recusado; 120 passa", () => {
    expect(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, titulo: "a".repeat(121) }).success).toBe(false);
    expect(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, titulo: "a".repeat(120) }).success).toBe(true);
  });

  it("horário vazio pede a hora de começo e de fim", () => {
    const campos = frasesPorCampo(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, inicio: "", fim: "" }));
    expect(campos.inicio).toBe("Diga a hora de começo e de fim.");
  });

  it("fim igual ou antes do começo: “O fim precisa ser depois do começo.”, embaixo do fim", () => {
    for (const fim of ["14:00", "13:55"]) {
      const campos = frasesPorCampo(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, fim }));
      expect(campos.fim).toBe("O fim precisa ser depois do começo.");
    }
  });

  it("vagas 0, 1000, fração e texto são recusados com a mesma frase; 1 e 999 passam", () => {
    for (const vagas of ["0", "1000", "2,5", "oito", ""]) {
      const campos = frasesPorCampo(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, vagas }));
      expect(campos.vagas, `vagas "${vagas}"`).toBe("Vagas: um número inteiro de 1 a 999.");
    }
    expect(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, vagas: "1" }).data?.vagas).toBe(1);
    expect(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, vagas: "999" }).data?.vagas).toBe(999);
  });

  it("preço vazio ou ilegível pede o preço por pessoa", () => {
    for (const preco of ["", "   ", "cento e vinte", "-10"]) {
      const campos = frasesPorCampo(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, preco }));
      expect(campos.preco, `preço "${preco}"`).toBe("Diga o preço por pessoa — por exemplo, 120 ou 37,50.");
    }
  });

  it("data impossível pede a data", () => {
    const campos = frasesPorCampo(esquemaLancarAvulsa.safeParse({ ...AVULSA_VALIDA, data: "2026-02-30" }));
    expect(campos.data).toBe("Escolha a data.");
  });

  it("formulário vazio aponta um erro por campo", () => {
    const campos = frasesPorCampo(
      esquemaLancarAvulsa.safeParse({
        titulo: "",
        data: "",
        inicio: "",
        fim: "",
        vagas: "8",
        preco: "",
        publico: true,
      }),
    );
    expect(campos).toMatchObject({
      titulo: "Dê um nome à aula ou oficina.",
      data: "Escolha a data.",
      inicio: "Diga a hora de começo e de fim.",
      preco: "Diga o preço por pessoa — por exemplo, 120 ou 37,50.",
    });
  });
});

describe("esquemaFecharDia", () => {
  it("aceita data e motivo aparado", () => {
    const resultado = esquemaFecharDia.safeParse({ data: "2026-12-25", motivo: " Natal " });
    expect(resultado.data).toEqual({ data: "2026-12-25", motivo: "Natal" });
  });

  it("motivo vazio pede o motivo; data inválida pede a data", () => {
    expect(frasesPorCampo(esquemaFecharDia.safeParse({ data: "2026-12-25", motivo: "  " })).motivo).toBe(
      "Diga o motivo do fechamento.",
    );
    expect(frasesPorCampo(esquemaFecharDia.safeParse({ data: "25/12/2026", motivo: "Natal" })).data).toBe(
      "Escolha a data.",
    );
  });

  it("motivo de 121 caracteres é recusado", () => {
    expect(esquemaFecharDia.safeParse({ data: "2026-12-25", motivo: "a".repeat(121) }).success).toBe(false);
  });
});

describe("esquemaConferirDia, esquemaCancelarData, esquemaTirarBloqueio", () => {
  const ID = "3f1c2a4e-9b7d-4c1e-8a2b-0d9e8f7a6b5c";

  it("conferir o dia só aceita data civil", () => {
    expect(esquemaConferirDia.safeParse({ data: "2026-10-08" }).success).toBe(true);
    expect(esquemaConferirDia.safeParse({ data: "amanhã" }).success).toBe(false);
  });

  it("cancelar a data pede o id e o estado DESEJADO (booleano), nunca “inverter”", () => {
    expect(esquemaCancelarData.safeParse({ eventoId: ID, cancelada: true }).success).toBe(true);
    expect(esquemaCancelarData.safeParse({ eventoId: ID, cancelada: false }).success).toBe(true);
    expect(esquemaCancelarData.safeParse({ eventoId: ID }).success).toBe(false);
    expect(esquemaCancelarData.safeParse({ eventoId: "1", cancelada: true }).success).toBe(false);
  });

  it("tirar o bloqueio pede só um uuid", () => {
    expect(esquemaTirarBloqueio.safeParse({ eventoId: ID }).success).toBe(true);
    expect(esquemaTirarBloqueio.safeParse({ eventoId: "x' or 1=1 --" }).success).toBe(false);
  });
});

// AGE-03 · boundary: semanas 1..52 (padrão 8), vencimento 1..28, mensalidade maior que zero — o que
// está fora é recusado pelo Zod no SERVIDOR com a frase humana do campo (T-05-29: nunca 10.000 datas).
const TURMA_VALIDA = {
  nome: "  [teste] Torno à noite  ",
  diaSemana: "2",
  aPartirDe: "2026-10-06",
  inicio: "19:00",
  fim: "21:00",
  vagas: "8",
  mensalidade: "320,50",
  semanas: "8",
  diaVencimento: "10",
  publica: true,
};

describe("esquemaLancarTurma", () => {
  it("válida: nome aparado, números inteiros, mensalidade em centavos", () => {
    const resultado = esquemaLancarTurma.safeParse(TURMA_VALIDA);
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      nome: "[teste] Torno à noite",
      diaSemana: 2,
      aPartirDe: "2026-10-06",
      inicio: "19:00",
      fim: "21:00",
      vagas: 8,
      mensalidadeCentavos: 32050,
      semanas: 8,
      diaVencimento: 10,
      publica: true,
    });
  });

  it.each([
    ["1", 1],
    ["52", 52],
  ])("semanas %s vale", (semanas, esperado) => {
    expect(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, semanas }).data?.semanas).toBe(esperado);
  });

  it.each(["0", "53", "", "1.5", "-1", "1e1", "oito"])("semanas “%s” → a frase do campo", (semanas) => {
    expect(frasesPorCampo(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, semanas })).semanas).toBe(FRASE_SEMANAS);
  });

  it.each(["1", "28"])("vencimento %s vale", (diaVencimento) => {
    expect(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, diaVencimento }).success).toBe(true);
  });

  it.each(["0", "29", "31", ""])("vencimento “%s” → a frase do campo", (diaVencimento) => {
    expect(frasesPorCampo(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, diaVencimento })).diaVencimento).toBe(
      FRASE_VENCIMENTO,
    );
  });

  it.each(["", "0", "0,00", "abc"])("mensalidade “%s” → a frase do campo (nenhum preço no código, maior que zero)", (mensalidade) => {
    expect(frasesPorCampo(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, mensalidade })).mensalidade).toBe(
      FRASE_MENSALIDADE,
    );
  });

  it("dia da semana fora de 0..6 e nome vazio", () => {
    expect(frasesPorCampo(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, diaSemana: "7" })).diaSemana).toBe(
      FRASE_DIA_DA_SEMANA,
    );
    expect(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, diaSemana: "0" }).data?.diaSemana).toBe(0);
    expect(frasesPorCampo(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, nome: "   " })).nome).toBe(FRASE_NOME_DA_TURMA);
  });

  it("fim antes do começo fica no campo do fim", () => {
    expect(frasesPorCampo(esquemaLancarTurma.safeParse({ ...TURMA_VALIDA, fim: "18:00" })).fim).toBe(
      FRASE_FIM_ANTES_DO_COMECO,
    );
  });
});

describe("esquemaConferirDia com intervalo (a turma)", () => {
  it("até um ano e um dia, para frente", () => {
    expect(esquemaConferirDia.safeParse({ data: "2026-10-06", ate: "2027-09-28" }).success).toBe(true);
    expect(esquemaConferirDia.safeParse({ data: "2026-10-06", ate: "2026-10-06" }).success).toBe(true);
    expect(esquemaConferirDia.safeParse({ data: "2026-10-06", ate: "2026-10-05" }).success).toBe(false);
    expect(esquemaConferirDia.safeParse({ data: "2026-10-06", ate: "2028-10-06" }).success).toBe(false);
  });
});
