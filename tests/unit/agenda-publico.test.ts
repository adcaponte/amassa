import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  agendaPublica,
  fimDaJanela,
  gradeDoMes,
  type CartaoPublico,
  type DadosDaAgendaPublica,
  type EventoPublicoLido,
  type TurmaPublicaLida,
} from "@/lib/agenda/publico/agenda";

// AGE-18 com D-10 (preço só nos cartões), D-11 (sem evento público, o estado da 04.6) e D-12 (as duas
// contas de vagas). "Hoje" = terça, 01/12/2026.
const HOJE = "2026-12-01";

const TURMA: TurmaPublicaLida = {
  id: "t1",
  nome: "Torno às terças",
  diaSemana: 2,
  inicio: "19:00",
  fim: "21:00",
  vagas: 8,
  mensalidadeCentavos: 32000,
  ativa: true,
  alunosAtivos: 2,
};

function dataDaTurma(data: string, inscritos = 2): EventoPublicoLido {
  return {
    tipo: "turma",
    data,
    inicio: "19:00",
    fim: "21:00",
    titulo: null,
    vagas: 8,
    precoCentavos: null,
    turmaId: "t1",
    publico: true,
    cancelado: false,
    inscritos,
  };
}

function oficina(data: string, campos: Partial<EventoPublicoLido> = {}): EventoPublicoLido {
  return {
    tipo: "avulsa",
    data,
    inicio: "14:00",
    fim: "17:30",
    titulo: "Oficina de modelagem",
    vagas: 8,
    precoCentavos: 12000,
    turmaId: null,
    publico: true,
    cancelado: false,
    inscritos: 0,
    ...campos,
  };
}

function pronta(dados: Partial<DadosDaAgendaPublica>) {
  const resultado = agendaPublica({ eventos: [], turmas: [TURMA], fechados: [], ...dados }, HOJE);
  if (!resultado.temEventos) {
    throw new Error("esperava eventos");
  }
  return resultado;
}

describe("agendaPublica — Próximas e as vagas (D-12)", () => {
  it("a turma aparece uma vez, na posição da primeira data, com vagas da turma − alunos ativos", () => {
    const agenda = pronta({
      eventos: [dataDaTurma("2026-12-15", 3), oficina("2026-12-03"), dataDaTurma("2026-12-08", 4), dataDaTurma("2026-12-01", 5)],
    });
    expect(agenda.proximas.map((cartao) => [cartao.tipo, cartao.data])).toEqual([
      ["turma", "2026-12-01"],
      ["oficina", "2026-12-03"],
    ]);
    const turma = agenda.proximas[0];
    expect(turma.vagasTexto).toBe("6 vagas");
    expect(turma.quando).toBe("Turma fixa · toda terça, 19h às 21h");
    expect(turma.precoTexto.replace(/\s/g, " ")).toBe("R$ 320,00 por mês");
    expect(turma.quandoDaReserva).toBe("toda terça");
  });

  it("no calendário, cada data da turma conta a lista daquele dia", () => {
    const agenda = pronta({ eventos: [dataDaTurma("2026-12-08", 7), dataDaTurma("2026-12-15", 8)] });
    const dia8 = agenda.dias.find((dia) => dia.data === "2026-12-08");
    const dia15 = agenda.dias.find((dia) => dia.data === "2026-12-15");
    expect(dia8?.cartoes[0].vagasTexto).toBe("última vaga");
    expect(dia15?.cartoes[0].vagasTexto).toBe("esgotado");
    expect(dia15?.cartoes[0].podeReservar).toBe(false);
  });

  it("oficina: 7 de 8 é última vaga; 8 de 8 é esgotado e sem reservar", () => {
    const agenda = pronta({
      eventos: [oficina("2026-12-03", { inscritos: 7 }), oficina("2026-12-04", { inscritos: 8 }), oficina("2026-12-05", { inscritos: 6 })],
    });
    expect(agenda.proximas.map((cartao) => [cartao.vagasTexto, cartao.podeReservar])).toEqual([
      ["última vaga", true],
      ["esgotado", false],
      ["últimas 2 vagas", true],
    ]);
  });

  it("oficina: quando, preço por pessoa e o dd/mm da reserva", () => {
    const [cartao] = pronta({ eventos: [oficina("2026-12-03")] }).proximas;
    expect(cartao.quando).toBe("Quinta, 03/12 · 14h às 17h30");
    expect(cartao.precoTexto.replace(/\s/g, " ")).toBe("R$ 120,00 por pessoa");
    expect(cartao.quandoDaReserva).toBe("03/12");
    expect(cartao.vagasTexto).toBe("8 vagas");
  });

  it("ordem por data e hora; até 10 e o resto em `restantes`", () => {
    const eventos = Array.from({ length: 12 }, (_, indice) =>
      oficina(`2026-12-${String(20 - indice).padStart(2, "0")}`, { titulo: `Oficina ${indice}` }),
    );
    eventos.push(oficina("2026-12-09", { inicio: "09:00", fim: "10:00", titulo: "Cedo" }));
    const agenda = pronta({ eventos });
    expect(agenda.proximas).toHaveLength(10);
    expect(agenda.restantes).toBe(3);
    expect(agenda.proximas[0].titulo).toBe("Cedo");
    const datas = agenda.proximas.map((cartao) => cartao.data);
    expect([...datas].sort()).toEqual(datas);
  });
});

describe("agendaPublica — o que entra e o que não entra", () => {
  it("não público, cancelado ou de ontem não entra; o de hoje entra", () => {
    const agenda = pronta({
      eventos: [
        oficina("2026-12-02", { publico: false, titulo: "Privada" }),
        oficina("2026-12-02", { cancelado: true, titulo: "Cancelada" }),
        oficina("2026-11-30", { titulo: "Ontem" }),
        oficina(HOJE, { titulo: "Hoje" }),
      ],
    });
    expect(agenda.proximas.map((cartao) => cartao.titulo)).toEqual(["Hoje"]);
  });

  it("a janela vai até o fim do 6º mês, contando o de hoje", () => {
    expect(fimDaJanela(HOJE)).toBe("2027-05-31");
    const agenda = pronta({ eventos: [oficina("2027-05-31", { titulo: "Dentro" }), oficina("2027-06-01", { titulo: "Fora" })] });
    expect(agenda.proximas.map((cartao) => cartao.titulo)).toEqual(["Dentro"]);
    expect(agenda.meses.map((mes) => mes.nome)).toEqual([
      "dezembro de 2026",
      "janeiro de 2027",
      "fevereiro de 2027",
      "março de 2027",
      "abril de 2027",
      "maio de 2027",
    ]);
  });

  it("turma inativa não entra", () => {
    const resultado = agendaPublica(
      { eventos: [dataDaTurma("2026-12-08")], turmas: [{ ...TURMA, ativa: false }], fechados: [] },
      HOJE,
    );
    expect(resultado).toEqual({ temEventos: false });
  });

  it("dia fechado aparece como fechado, sem motivo", () => {
    const agenda = pronta({ eventos: [oficina("2026-12-03")], fechados: ["2026-12-24", "2026-11-20"] });
    expect(agenda.dias.find((dia) => dia.data === "2026-12-24")).toEqual({ data: "2026-12-24", fechado: true, cartoes: [] });
    expect(agenda.dias.some((dia) => dia.data === "2026-11-20")).toBe(false);
  });

  it("zero eventos públicos (mesmo com dia fechado) é o estado da D-11", () => {
    expect(agendaPublica({ eventos: [], turmas: [TURMA], fechados: ["2026-12-24"] }, HOJE)).toEqual({ temEventos: false });
  });

  it("a lista do mês mostra a turma uma vez", () => {
    const agenda = pronta({ eventos: [dataDaTurma("2026-12-08"), dataDaTurma("2026-12-15"), dataDaTurma("2027-01-05")] });
    expect(agenda.meses[0].cartoes).toHaveLength(1);
    expect(agenda.meses[1].cartoes).toHaveLength(1);
    expect(agenda.meses[2].cartoes).toHaveLength(0);
  });
});

describe("gradeDoMes", () => {
  it("começa na segunda e completa a última semana", () => {
    const grade = gradeDoMes("2026-12");
    expect(grade.slice(0, 2)).toEqual([null, "2026-12-01"]);
    expect(grade.length % 7).toBe(0);
    expect(grade.filter((celula) => celula !== null)).toHaveLength(31);
  });
});

describe("a forma do que sai (lista branca — T-05-69)", () => {
  const CHAVES_DO_CARTAO = [
    "chave",
    "data",
    "esgotado",
    "podeReservar",
    "precoTexto",
    "quando",
    "quandoDaReserva",
    "restantes",
    "tipo",
    "titulo",
    "vagasTexto",
  ];

  it("o cartão e a agenda têm exatamente as chaves da lista branca", () => {
    const agenda = pronta({ eventos: [dataDaTurma("2026-12-08"), oficina("2026-12-03")], fechados: ["2026-12-24"] });
    expect(Object.keys(agenda).sort()).toEqual(["dias", "hoje", "meses", "proximas", "restantes", "temEventos"]);
    const cartoes: CartaoPublico[] = [
      ...agenda.proximas,
      ...agenda.meses.flatMap((mes) => mes.cartoes),
      ...agenda.dias.flatMap((dia) => dia.cartoes),
    ];
    for (const cartao of cartoes) {
      expect(Object.keys(cartao).sort()).toEqual(CHAVES_DO_CARTAO);
    }
    for (const dia of agenda.dias) {
      expect(Object.keys(dia).sort()).toEqual(["cartoes", "data", "fechado"]);
    }
    for (const mes of agenda.meses) {
      expect(Object.keys(mes).sort()).toEqual(["cartoes", "chave", "nome"]);
    }
  });

  it("nenhuma palavra de pessoa nos tipos de entrada e saída", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/publico/agenda.ts"), "utf8");
    const codigo = fonte
      .split("\n")
      .filter((linha) => !linha.trim().startsWith("//"))
      .join("\n");
    expect(codigo).not.toMatch(/telefone|clienteId|pessoaNome|presenca|motivo/i);
  });
});

describe("pureza (leitura do arquivo)", () => {
  it("não importa React, Next, o banco nem drizzle", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/publico/agenda.ts"), "utf8");
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });
});
