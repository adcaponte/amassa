import { describe, expect, it } from "vitest";

import {
  FRASE_DIA_DA_SEMANA,
  FRASE_ESCOLHA_QUEM_VEM,
  FRASE_HORA_DE_CHEGADA,
  FRASE_HORAS_PREVISTAS,
  FRASE_JA_REMOVIDO,
  FRASE_PESSOAS,
  FRASE_SAIDA_ANTES_DA_CHEGADA,
  FRASE_EXPERIMENTAL_SEM_ESCOLHA,
  FRASE_EXPERIMENTAL_VALOR,
  FRASE_FIM_ANTES_DO_COMECO,
  FRASE_MENSALIDADE,
  FRASE_NOME_DA_TURMA,
  FRASE_SEMANAS,
  FRASE_VENCIMENTO,
} from "@/lib/agenda/textos";
import {
  esquemaCancelarData,
  esquemaCancelarReserva,
  esquemaColocarNaData,
  esquemaDefinirDispensa,
  esquemaConferirDia,
  esquemaDefinirDireitoARepor,
  esquemaEncerrarUsoLivre,
  esquemaFecharDia,
  esquemaLancarAvulsa,
  esquemaLancarTurma,
  esquemaMarcarChegada,
  esquemaReservarUsoLivre,
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

// Plano 08 — "Colocar na lista" com o modo (AGE-10; D-07, UI-D6) e o direito a repor (AGE-09).
describe("esquemaColocarNaData e esquemaDefinirDireitoARepor", () => {
  const ids = {
    eventoId: "11111111-1111-4111-8111-111111111111",
    clienteId: "22222222-2222-4222-8222-222222222222",
  };

  it("sem modo é a inscrição de oficina, e nada de valor vem da tela", () => {
    const resultado = esquemaColocarNaData.safeParse({ ...ids, valor: "999" });
    expect(resultado.success && resultado.data).toEqual({ ...ids, modo: "oficina", cobrar: null, valorCentavos: null });
  });

  it("reposição ignora cobrar e valor", () => {
    const resultado = esquemaColocarNaData.safeParse({ ...ids, modo: "reposicao", cobrar: true, valor: "40" });
    expect(resultado.success && resultado.data).toEqual({ ...ids, modo: "reposicao", cobrar: null, valorCentavos: null });
  });

  it("experimental sem escolha é recusada com a frase de escolher", () => {
    const resultado = esquemaColocarNaData.safeParse({ ...ids, modo: "experimental" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(FRASE_EXPERIMENTAL_SEM_ESCOLHA);
  });

  it("experimental cobrada converte o valor em centavos inteiros", () => {
    expect(esquemaColocarNaData.safeParse({ ...ids, modo: "experimental", cobrar: true, valor: "37,50" }).data).toEqual({
      ...ids,
      modo: "experimental",
      cobrar: true,
      valorCentavos: 3750,
    });
    expect(esquemaColocarNaData.safeParse({ ...ids, modo: "experimental", cobrar: true, valor: "40" }).data?.valorCentavos).toBe(
      4000,
    );
  });

  it("experimental cobrada sem valor, com valor ilegível, negativo ou zero é recusada", () => {
    for (const valor of [undefined, "", "abc", "-40", "0", "0,00", "1,234"]) {
      const resultado = esquemaColocarNaData.safeParse({ ...ids, modo: "experimental", cobrar: true, valor });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.message).toBe(FRASE_EXPERIMENTAL_VALOR);
    }
  });

  it("experimental gratuita não leva valor, nem que a tela mande", () => {
    expect(esquemaColocarNaData.safeParse({ ...ids, modo: "experimental", cobrar: false, valor: "40" }).data).toEqual({
      ...ids,
      modo: "experimental",
      cobrar: false,
      valorCentavos: null,
    });
  });

  it("o direito a repor é o estado desejado: booleano e o id", () => {
    expect(esquemaDefinirDireitoARepor.safeParse({ inscricaoId: ids.eventoId, direito: true }).success).toBe(true);
    expect(esquemaDefinirDireitoARepor.safeParse({ inscricaoId: ids.eventoId, direito: "sim" }).success).toBe(false);
    expect(esquemaDefinirDireitoARepor.safeParse({ inscricaoId: "x", direito: true }).success).toBe(false);
  });
});

// Plano 09 — o uso livre: quem, quando, por quanto tempo, quantas pessoas. Preço e valor NUNCA vêm da tela.
describe("esquemaReservarUsoLivre", () => {
  const VALIDA = {
    clienteId: "0b9d2f1e-1a2b-4c3d-8e9f-001122334455",
    data: "2026-10-08",
    chegadaPrevista: "14:00",
    horasPrevistas: "2",
    pessoas: "1",
  };

  it("aceita os padrões da folha e devolve números", () => {
    expect(esquemaReservarUsoLivre.parse(VALIDA)).toEqual({ ...VALIDA, horasPrevistas: 2, pessoas: 1 });
  });

  it("sem ninguém escolhido: “Escolha quem vem.” no campo Quem", () => {
    const resultado = esquemaReservarUsoLivre.safeParse({ ...VALIDA, clienteId: "" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]).toMatchObject({ path: ["clienteId"], message: FRASE_ESCOLHA_QUEM_VEM });
  });

  it("horas previstas de 1 a 12 e pessoas de 1 a 50", () => {
    for (const horasPrevistas of ["0", "13", "1,5", ""]) {
      const resultado = esquemaReservarUsoLivre.safeParse({ ...VALIDA, horasPrevistas });
      expect(resultado.error?.issues[0].message).toBe(FRASE_HORAS_PREVISTAS);
    }
    for (const pessoas of ["0", "51", "-1", "x"]) {
      const resultado = esquemaReservarUsoLivre.safeParse({ ...VALIDA, pessoas });
      expect(resultado.error?.issues[0].message).toBe(FRASE_PESSOAS);
    }
    expect(esquemaReservarUsoLivre.parse({ ...VALIDA, horasPrevistas: "12", pessoas: "50" })).toMatchObject({
      horasPrevistas: 12,
      pessoas: 50,
    });
  });

  it("hora de chegada vazia ou ilegível: “Diga a hora de chegada.”", () => {
    for (const chegadaPrevista of ["", "25:00", "9h"]) {
      const resultado = esquemaReservarUsoLivre.safeParse({ ...VALIDA, chegadaPrevista });
      expect(resultado.error?.issues[0]).toMatchObject({ path: ["chegadaPrevista"], message: FRASE_HORA_DE_CHEGADA });
    }
  });

  it("preço e valor mandados pela tela são ignorados (T-05-42)", () => {
    const dados = esquemaReservarUsoLivre.parse({ ...VALIDA, precoHoraCentavos: 1, valorCentavos: 1 });
    expect(dados).not.toHaveProperty("precoHoraCentavos");
    expect(dados).not.toHaveProperty("valorCentavos");
  });
});

describe("esquemaMarcarChegada e esquemaCancelarReserva", () => {
  it("a chegada é “HH:MM”", () => {
    const id = "0b9d2f1e-1a2b-4c3d-8e9f-001122334455";
    expect(esquemaMarcarChegada.parse({ usoLivreId: id, chegada: "09:05" })).toEqual({ usoLivreId: id, chegada: "09:05" });
    expect(esquemaMarcarChegada.safeParse({ usoLivreId: id, chegada: "" }).error?.issues[0].message).toBe(
      FRASE_HORA_DE_CHEGADA,
    );
  });

  it("cancelar com id que não é uuid é “Isso já tinha sido removido.”", () => {
    expect(esquemaCancelarReserva.safeParse({ usoLivreId: "x" }).error?.issues[0].message).toBe(FRASE_JA_REMOVIDO);
  });
});

describe("esquemaEncerrarUsoLivre", () => {
  const id = "0b9d2f1e-1a2b-4c3d-8e9f-001122334455";

  it("aceita a saída depois da chegada e não leva preço nem valor", () => {
    expect(esquemaEncerrarUsoLivre.parse({ usoLivreId: id, chegada: "14:00", saida: "15:01", valorCentavos: 1 })).toEqual({
      usoLivreId: id,
      chegada: "14:00",
      saida: "15:01",
    });
  });

  it("saída igual ou antes da chegada: a frase no campo “Saiu às”", () => {
    for (const saida of ["14:00", "13:59"]) {
      const resultado = esquemaEncerrarUsoLivre.safeParse({ usoLivreId: id, chegada: "14:00", saida });
      expect(resultado.error?.issues[0]).toMatchObject({ path: ["saida"], message: FRASE_SAIDA_ANTES_DA_CHEGADA });
    }
  });
});

// Decisão do dono no chat, 02/10/2026 (VERIFICACAO-COWORK-05 §2 item 1): a caixa pública vem desmarcada na
// tela — e o servidor nunca decide pela pessoa. Sem a chave, o lançamento é recusado (sem `.default`): ele
// nunca fica público (nem privado) por omissão.
describe("o lançamento nunca fica público por omissão", () => {
  it("esquemaLancarAvulsa sem `publico` falha", () => {
    const semPublico: Partial<typeof AVULSA_VALIDA> = { ...AVULSA_VALIDA };
    delete semPublico.publico;
    expect(esquemaLancarAvulsa.safeParse(semPublico).success).toBe(false);
  });

  it("esquemaLancarTurma sem `publica` falha", () => {
    const semPublica: Partial<typeof TURMA_VALIDA> = { ...TURMA_VALIDA };
    delete semPublica.publica;
    expect(esquemaLancarTurma.safeParse(semPublica).success).toBe(false);
  });
});

describe("esquemaDefinirDispensa — o uso livre entra (decisão do dono no chat, 02/10/2026)", () => {
  const ID = "00000000-0000-4000-8000-000000000001";

  it("aceita mensalidade, inscrição e uso livre (quem confere a venda cancelada é a ação, sob a trava)", () => {
    for (const tipo of ["mensalidade", "inscricao", "uso_livre"] as const) {
      expect(esquemaDefinirDispensa.safeParse({ tipo, id: ID, dispensada: true }).success).toBe(true);
    }
  });

  it("recusa qualquer outro tipo", () => {
    expect(esquemaDefinirDispensa.safeParse({ tipo: "venda", id: ID, dispensada: true }).success).toBe(false);
  });
});
