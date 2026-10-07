import { describe, expect, it } from "vitest";

import {
  mesDaGeracao,
  mesesParaGeracao,
  mesPermitidoParaGeracao,
  nomeCurtoDoMes,
  planejarGeracaoDoMes,
  tituloDaContaFixa,
  vencimentoNoMes,
} from "@/lib/cadastros/contas-fixas";
import { esquemaContaFixa, esquemaGeracao } from "@/lib/cadastros/esquemas";

const CATEGORIA_ID = "11111111-1111-4111-8111-111111111111";

function entradaValida(sobrescritas: Partial<Record<string, unknown>> = {}) {
  return {
    nome: "Aluguel",
    categoriaId: CATEGORIA_ID,
    valorTexto: "1500",
    diaVencimento: 5,
    ...sobrescritas,
  };
}

describe("vencimentoNoMes — dia que não existe no mês cai no último dia daquele mês", () => {
  it("dia 5 num mês de 31 dias", () => {
    expect(vencimentoNoMes(5, "2027-01")).toBe("2027-01-05");
  });

  it("dia 31 num mês de 30 dias (abril)", () => {
    expect(vencimentoNoMes(31, "2027-04")).toBe("2027-04-30");
  });

  it("dia 31 em fevereiro fora de ano bissexto", () => {
    expect(vencimentoNoMes(31, "2027-02")).toBe("2027-02-28");
  });

  it("dia 29 em fevereiro de ano bissexto", () => {
    expect(vencimentoNoMes(29, "2028-02")).toBe("2028-02-29");
  });
});

describe("nomeCurtoDoMes/tituloDaContaFixa — 'nome · mês/ano'", () => {
  it("monta o título curto com barra, nunca 'de'", () => {
    expect(nomeCurtoDoMes("2027-01")).toBe("janeiro/2027");
    expect(tituloDaContaFixa("Aluguel", "2027-01")).toBe("Aluguel · janeiro/2027");
  });

  it("dezembro não estoura o índice do array de nomes", () => {
    expect(nomeCurtoDoMes("2026-12")).toBe("dezembro/2026");
  });
});

describe("mesDaGeracao — sempre o mês seguinte ao de hoje", () => {
  it("18 de dezembro de 2026 gera janeiro de 2027", () => {
    expect(mesDaGeracao("2026-12-18")).toBe("2027-01");
  });

  it("30 de novembro de 2026 gera dezembro de 2026", () => {
    expect(mesDaGeracao("2026-11-30")).toBe("2026-12");
  });

  it("é sempre o SEGUNDO item de mesesParaGeracao do mesmo dia", () => {
    expect(mesDaGeracao("2026-09-20")).toBe(mesesParaGeracao("2026-09-20")[1]);
  });
});

describe("mesesParaGeracao — o mês de hoje e os onze seguintes, sem repetição", () => {
  it("2026-09-20 começa em '2026-09' e termina em '2027-08', doze meses", () => {
    const meses = mesesParaGeracao("2026-09-20");
    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe("2026-09");
    expect(meses[11]).toBe("2027-08");
    expect(new Set(meses).size).toBe(12);
  });

  it("2026-12-31 atravessa o ano: começa em '2026-12' e termina em '2027-11'", () => {
    const meses = mesesParaGeracao("2026-12-31");
    expect(meses[0]).toBe("2026-12");
    expect(meses[11]).toBe("2027-11");
  });
});

describe("mesPermitidoParaGeracao — o mês corrente entra, o teto é onze meses à frente", () => {
  it("o mês corrente é permitido", () => {
    expect(mesPermitidoParaGeracao("2026-09-20", "2026-09")).toBe(true);
  });

  it("um mês passado não é permitido", () => {
    expect(mesPermitidoParaGeracao("2026-09-20", "2026-08")).toBe(false);
  });

  it("o último mês da faixa (onze à frente) é permitido", () => {
    expect(mesPermitidoParaGeracao("2026-09-20", "2027-08")).toBe(true);
  });

  it("um mês além do último da faixa não é permitido", () => {
    expect(mesPermitidoParaGeracao("2026-09-20", "2027-09")).toBe(false);
  });

  it("formato inválido nunca é permitido", () => {
    expect(mesPermitidoParaGeracao("2026-09-20", "2026-9")).toBe(false);
    expect(mesPermitidoParaGeracao("2026-09-20", "lixo")).toBe(false);
  });
});

describe("esquemaContaFixa — dia de vencimento fora de 1-31 recusado com frase humana", () => {
  it("dia 0 é recusado", () => {
    const resultado = esquemaContaFixa.safeParse(entradaValida({ diaVencimento: 0 }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/1 a 31/);
    }
  });

  it("dia 32 é recusado", () => {
    const resultado = esquemaContaFixa.safeParse(entradaValida({ diaVencimento: 32 }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/1 a 31/);
    }
  });

  it("dia 1 e dia 31 são aceitos", () => {
    expect(esquemaContaFixa.safeParse(entradaValida({ diaVencimento: 1 })).success).toBe(true);
    expect(esquemaContaFixa.safeParse(entradaValida({ diaVencimento: 31 })).success).toBe(true);
  });

  it("valor esperado vazio ou zero é recusado", () => {
    expect(esquemaContaFixa.safeParse(entradaValida({ valorTexto: "" })).success).toBe(false);
    expect(esquemaContaFixa.safeParse(entradaValida({ valorTexto: "0" })).success).toBe(false);
  });

  it("nome vazio é recusado", () => {
    expect(esquemaContaFixa.safeParse(entradaValida({ nome: "" })).success).toBe(false);
  });
});

// 06.5-WR-03 (quick 261007-shs; decisão do dono, 07/10/2026 — “perguntar antes”; a D-26 continua: cancelar e
// gerar de novo é o caminho para corrigir uma conta, mas por escolha explícita).
describe("planejarGeracaoDoMes — WR-03", () => {
  const ALUGUEL = "10000000-0000-4000-8000-000000000001";
  const INTERNET = "10000000-0000-4000-8000-000000000002";
  const AGUA = "10000000-0000-4000-8000-000000000003";
  const LUZ = "10000000-0000-4000-8000-000000000004";
  const conta = (id: string, nome: string, temAtiva: boolean, temCancelada: boolean) => ({
    id,
    nome,
    valorCentavos: 10000,
    temAtiva,
    temCancelada,
  });

  it("sem conta cancelada: gera as que não têm despesa no mês; a que tem despesa ativa não entra em lista nenhuma", () => {
    expect(
      planejarGeracaoDoMes({
        contas: [conta(ALUGUEL, "Aluguel", true, false), conta(AGUA, "Água", false, false)],
        canceladasVistas: [],
        recriar: [],
      }),
    ).toEqual({ tipo: "gerar", criar: [AGUA], recriar: [], mantidas: [] });
  });

  it("conta só com despesa cancelada, não vista: pergunta antes, em ordem de nome, com quantas novas", () => {
    expect(
      planejarGeracaoDoMes({
        contas: [
          conta(ALUGUEL, "Aluguel", true, true),
          conta(INTERNET, "Internet", false, true),
          conta(AGUA, "Água", false, true),
          conta(LUZ, "Luz", false, false),
        ],
        canceladasVistas: [],
        recriar: [],
      }),
    ).toEqual({
      tipo: "perguntar",
      canceladas: [
        { id: AGUA, nome: "Água", valorCentavos: 10000 },
        { id: INTERNET, nome: "Internet", valorCentavos: 10000 },
      ],
      novas: 1,
    });
  });

  it("todas as canceladas vistas: recria as marcadas, mantém as outras, cria as sem despesa", () => {
    expect(
      planejarGeracaoDoMes({
        contas: [
          conta(INTERNET, "Internet", false, true),
          conta(AGUA, "Água", false, true),
          conta(LUZ, "Luz", false, false),
        ],
        canceladasVistas: [INTERNET, AGUA],
        recriar: [AGUA],
      }),
    ).toEqual({ tipo: "gerar", criar: [LUZ], recriar: [AGUA], mantidas: [INTERNET] });
  });

  it("a marcada que alguém gerou no meio (tem ativa agora) não entra em recriar nem em mantidas", () => {
    expect(
      planejarGeracaoDoMes({
        contas: [conta(INTERNET, "Internet", true, true), conta(AGUA, "Água", false, true)],
        canceladasVistas: [INTERNET, AGUA],
        recriar: [INTERNET],
      }),
    ).toEqual({ tipo: "gerar", criar: [], recriar: [], mantidas: [AGUA] });
  });

  it("uma cancelada nova (não vista) junto com uma vista: pergunta de novo, com a lista inteira de agora", () => {
    expect(
      planejarGeracaoDoMes({
        contas: [conta(INTERNET, "Internet", false, true), conta(AGUA, "Água", false, true)],
        canceladasVistas: [INTERNET],
        recriar: [INTERNET],
      }),
    ).toEqual({
      tipo: "perguntar",
      canceladas: [
        { id: AGUA, nome: "Água", valorCentavos: 10000 },
        { id: INTERNET, nome: "Internet", valorCentavos: 10000 },
      ],
      novas: 0,
    });
  });
});

describe("esquemaGeracao — WR-03", () => {
  const ID_A = "20000000-0000-4000-8000-000000000001";
  const ID_B = "20000000-0000-4000-8000-000000000002";

  it("{ mes } sozinho passa, com as listas vazias (a aba aberta antes da publicação — o servidor pergunta)", () => {
    const resultado = esquemaGeracao.safeParse({ mes: "2026-11" });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ mes: "2026-11", canceladasVistas: [], recriar: [] });
  });

  it("recriar dentro das vistas passa", () => {
    expect(esquemaGeracao.safeParse({ mes: "2026-11", canceladasVistas: [ID_A, ID_B], recriar: [ID_B] }).success).toBe(
      true,
    );
  });

  it("recriar fora das vistas falha com frase humana", () => {
    const resultado = esquemaGeracao.safeParse({ mes: "2026-11", canceladasVistas: [ID_A], recriar: [ID_B] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("Essa escolha não vale mais — recarregue a página e tente de novo.");
  });

  it("id que não é uuid falha; mais de 500 itens falha", () => {
    expect(esquemaGeracao.safeParse({ mes: "2026-11", canceladasVistas: ["nao-e-id"], recriar: [] }).success).toBe(false);
    const muitas = Array.from({ length: 501 }, (_, indice) => `20000000-0000-4000-8000-${String(indice).padStart(12, "0")}`);
    expect(esquemaGeracao.safeParse({ mes: "2026-11", canceladasVistas: muitas, recriar: [] }).success).toBe(false);
  });
});
