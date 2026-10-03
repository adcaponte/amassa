import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import {
  DIAS_PARA_TABELA_VELHA,
  efeitoDeTirar,
  seloDaTabela,
  tabelaVigente,
  type AnexoParaVigencia,
} from "@/lib/fornecedores/tabela-vigente";
import { somarDias } from "@/lib/producao/calendario";

// A tabela de preços vigente e o selo de 120 dias (06.2-08-PLAN.md; FRN-11, D-09). "Hoje" sempre por
// parâmetro, como dia civil de Brasília.

let contador = 0;
function anexo(dados: Partial<AnexoParaVigencia> & Pick<AnexoParaVigencia, "tipo">): AnexoParaVigencia {
  contador += 1;
  const sequencia = String(contador).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${sequencia}`,
    nome: `anexo ${contador}`,
    valeDesde: null,
    enviadoEm: "2026-09-01",
    criadoEm: "2026-09-01T15:00:00.000Z",
    ...dados,
  };
}

describe("pureza", () => {
  it("lib/fornecedores/tabela-vigente.ts não importa React, Next, o banco nem o driver", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/tabela-vigente.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+"(@\/db|react|next|drizzle-orm|pg)[/"]/);
    expect(fonte).not.toContain("toISOString");
  });

  it("o limite é 120 dias", () => {
    expect(DIAS_PARA_TABELA_VELHA).toBe(120);
  });
});

// ——— Tarefa 1: o <behavior> do traçador. ———

describe("tabelaVigente", () => {
  it("lista vazia → null", () => {
    expect(tabelaVigente([])).toBeNull();
  });

  it("só um catálogo → null", () => {
    expect(tabelaVigente([anexo({ tipo: "catalogo" })])).toBeNull();
  });

  it("tabelas de maio e de agosto → a de agosto", () => {
    const maio = anexo({ tipo: "tabela", valeDesde: "2026-05-01" });
    const agosto = anexo({ tipo: "tabela", valeDesde: "2026-08-01" });
    expect(tabelaVigente([maio, agosto])?.id).toBe(agosto.id);
    expect(tabelaVigente([agosto, maio])?.id).toBe(agosto.id);
  });
});

describe("seloDaTabela", () => {
  it("vale desde 04/06 com hoje 02/10 (120 dias) → recente", () => {
    expect(seloDaTabela({ valeDesde: "2026-06-04", enviadoEm: "2026-06-04" }, "2026-10-02")).toBe("recente");
  });

  it("vale desde 03/06 com hoje 02/10 (121 dias) → velha", () => {
    expect(seloDaTabela({ valeDesde: "2026-06-03", enviadoEm: "2026-10-01" }, "2026-10-02")).toBe("velha");
  });
});

describe("efeitoDeTirar", () => {
  const antiga = anexo({ tipo: "tabela", nome: "Tabela antiga", valeDesde: "2026-03-01" });
  const nova = anexo({ tipo: "tabela", nome: "Tabela nova", valeDesde: "2026-09-01" });
  const catalogo = anexo({ tipo: "catalogo", nome: "Catálogo" });

  it("a vigente com outra tabela → vigente-com-anterior, com o nome da outra", () => {
    expect(efeitoDeTirar([antiga, nova, catalogo], nova.id)).toEqual({
      caso: "vigente-com-anterior",
      anterior: "Tabela antiga",
    });
  });

  it("a única tabela → unica-tabela", () => {
    expect(efeitoDeTirar([nova, catalogo], nova.id)).toEqual({ caso: "unica-tabela" });
  });

  it("um catálogo → comum", () => {
    expect(efeitoDeTirar([antiga, nova, catalogo], catalogo.id)).toEqual({ caso: "comum" });
  });

  it("uma tabela que não é a vigente → comum (nada muda na linha de cima)", () => {
    expect(efeitoDeTirar([antiga, nova], antiga.id)).toEqual({ caso: "comum" });
  });
});

// ——— Tarefa 2: as arestas do EDGE-COVERAGE (FRN-11), uma categoria por `describe`. ———

// Todas as permutações de uma lista pequena — a vigente não pode depender da ordem de entrada.
function permutacoes<T>(lista: readonly T[]): T[][] {
  if (lista.length <= 1) {
    return [[...lista]];
  }
  return lista.flatMap((item, indice) =>
    permutacoes([...lista.slice(0, indice), ...lista.slice(indice + 1)]).map((resto) => [item, ...resto]),
  );
}

describe("boundary", () => {
  const hoje = "2026-10-02";

  it.each([
    ["com vale desde", { valeDesde: somarDias(hoje, -120), enviadoEm: "2026-01-01" }],
    ["sem vale desde (conta da data de envio)", { valeDesde: null, enviadoEm: somarDias(hoje, -120) }],
  ] as const)("120 dias → recente (%s)", (_caso, referencia) => {
    expect(seloDaTabela(referencia, hoje)).toBe("recente");
  });

  it.each([
    ["com vale desde", { valeDesde: somarDias(hoje, -121), enviadoEm: hoje }],
    ["sem vale desde (conta da data de envio)", { valeDesde: null, enviadoEm: somarDias(hoje, -121) }],
  ] as const)("121 dias → velha (%s)", (_caso, referencia) => {
    expect(seloDaTabela(referencia, hoje)).toBe("velha");
  });

  it("o vale desde manda sobre a data de envio: enviada há 200 dias, vale desde há 10 → recente", () => {
    expect(seloDaTabela({ valeDesde: somarDias(hoje, -10), enviadoEm: somarDias(hoje, -200) }, hoje)).toBe(
      "recente",
    );
  });

  it("hoje mesmo → recente (0 dias)", () => {
    expect(seloDaTabela({ valeDesde: hoje, enviadoEm: hoje }, hoje)).toBe("recente");
  });

  it("a borda atravessa a virada do ano e o fevereiro bissexto em dias civis", () => {
    // 2028 é bissexto: de 01/11/2027 a 29/02/2028 são 120 dias; a 01/03/2028, 121.
    expect(seloDaTabela({ valeDesde: "2027-11-01", enviadoEm: "2027-11-01" }, "2028-02-29")).toBe("recente");
    expect(seloDaTabela({ valeDesde: "2027-11-01", enviadoEm: "2027-11-01" }, "2028-03-01")).toBe("velha");
  });
});

describe("adjacency", () => {
  it("duas tabelas com o mesmo vale desde: vence a de criado_em mais recente", () => {
    const primeira = anexo({ tipo: "tabela", valeDesde: "2026-09-01", criadoEm: "2026-09-01T12:00:00.000Z" });
    const segunda = anexo({ tipo: "tabela", valeDesde: "2026-09-01", criadoEm: "2026-09-01T12:00:00.001Z" });
    expect(tabelaVigente([primeira, segunda])?.id).toBe(segunda.id);
    expect(tabelaVigente([segunda, primeira])?.id).toBe(segunda.id);
  });

  it("sem vale desde compara pela data de envio com quem tem data: envio de 10/09 vence vale desde de 05/09", () => {
    const semData = anexo({
      tipo: "tabela",
      valeDesde: null,
      enviadoEm: "2026-09-10",
      criadoEm: "2026-09-10T15:00:00.000Z",
    });
    const comData = anexo({ tipo: "tabela", valeDesde: "2026-09-05", criadoEm: "2026-09-20T15:00:00.000Z" });
    expect(tabelaVigente([semData, comData])?.id).toBe(semData.id);
  });

  it("…e perde para um vale desde de 25/09, mesmo enviada depois de a outra subir", () => {
    const semData = anexo({
      tipo: "tabela",
      valeDesde: null,
      enviadoEm: "2026-09-20",
      criadoEm: "2026-09-20T15:00:00.000Z",
    });
    const comData = anexo({ tipo: "tabela", valeDesde: "2026-09-25", criadoEm: "2026-09-01T15:00:00.000Z" });
    expect(tabelaVigente([semData, comData])?.id).toBe(comData.id);
  });

  it("envio no MESMO dia de um vale desde: empata na data e desempata pelo criado_em", () => {
    const semData = anexo({
      tipo: "tabela",
      valeDesde: null,
      enviadoEm: "2026-09-10",
      criadoEm: "2026-09-10T18:00:00.000Z",
    });
    const comData = anexo({ tipo: "tabela", valeDesde: "2026-09-10", criadoEm: "2026-09-10T13:00:00.000Z" });
    expect(tabelaVigente([comData, semData])?.id).toBe(semData.id);
  });

  it("efeitoDeTirar com duas tabelas empatadas na data: a outra é a que passa a valer", () => {
    const primeira = anexo({
      tipo: "tabela",
      nome: "Primeira",
      valeDesde: "2026-09-01",
      criadoEm: "2026-09-01T12:00:00.000Z",
    });
    const segunda = anexo({
      tipo: "tabela",
      nome: "Segunda",
      valeDesde: "2026-09-01",
      criadoEm: "2026-09-02T12:00:00.000Z",
    });
    expect(efeitoDeTirar([primeira, segunda], segunda.id)).toEqual({
      caso: "vigente-com-anterior",
      anterior: "Primeira",
    });
  });
});

describe("empty", () => {
  it("lista vazia → nenhuma vigente; tirar algo que não está na lista → comum", () => {
    expect(tabelaVigente([])).toBeNull();
    expect(efeitoDeTirar([], "00000000-0000-4000-8000-ffffffffffff")).toEqual({ caso: "comum" });
  });

  it("catálogo, nota e outro nunca viram a vigente — nem com a data mais nova", () => {
    const anexos = [
      anexo({ tipo: "catalogo", enviadoEm: "2026-12-01" }),
      anexo({ tipo: "nota", enviadoEm: "2026-12-02" }),
      anexo({ tipo: "outro", enviadoEm: "2026-12-03" }),
    ];
    expect(tabelaVigente(anexos)).toBeNull();
    for (const item of anexos) {
      expect(efeitoDeTirar(anexos, item.id)).toEqual({ caso: "comum" });
    }
  });

  it("uma tabela no meio de outros tipos mais novos é a vigente — e a única", () => {
    const tabela = anexo({ tipo: "tabela", valeDesde: "2026-01-01" });
    const anexos = [
      anexo({ tipo: "catalogo", enviadoEm: "2026-12-01" }),
      tabela,
      anexo({ tipo: "nota", enviadoEm: "2026-12-02" }),
    ];
    expect(tabelaVigente(anexos)?.id).toBe(tabela.id);
    expect(efeitoDeTirar(anexos, tabela.id)).toEqual({ caso: "unica-tabela" });
  });
});

describe("ordering", () => {
  it("a vigente é a mesma em toda ordem de entrada", () => {
    const anexos = [
      anexo({ tipo: "tabela", valeDesde: "2026-05-01" }),
      anexo({ tipo: "tabela", valeDesde: null, enviadoEm: "2026-08-01", criadoEm: "2026-08-01T12:00:00.000Z" }),
      anexo({ tipo: "tabela", valeDesde: "2026-08-01", criadoEm: "2026-07-01T12:00:00.000Z" }),
      anexo({ tipo: "catalogo", enviadoEm: "2026-09-30" }),
    ];
    const esperada = anexos[1].id;
    for (const ordem of permutacoes(anexos)) {
      expect(tabelaVigente(ordem)?.id).toBe(esperada);
    }
  });

  it("empate total (mesma data, mesmo instante): vence o maior id, em toda ordem", () => {
    const comum = { tipo: "tabela", valeDesde: "2026-09-01", criadoEm: "2026-09-01T12:00:00.000Z" } as const;
    const a = anexo({ ...comum, id: "00000000-0000-4000-8000-00000000000a" });
    const b = anexo({ ...comum, id: "00000000-0000-4000-8000-00000000000b" });
    const c = anexo({ ...comum, id: "00000000-0000-4000-8000-00000000000c" });
    for (const ordem of permutacoes([a, b, c])) {
      expect(tabelaVigente(ordem)?.id).toBe(c.id);
    }
  });

  it("o instante compara pelo tempo, não pelo texto: o mesmo momento escrito em outro fuso empata", () => {
    const utc = anexo({
      tipo: "tabela",
      valeDesde: "2026-09-01",
      criadoEm: "2026-09-01T15:00:00.000Z",
      id: "00000000-0000-4000-8000-00000000000e",
    });
    const brasilia = anexo({
      tipo: "tabela",
      valeDesde: "2026-09-01",
      criadoEm: "2026-09-01T12:00:00.000-03:00",
      id: "00000000-0000-4000-8000-00000000000d",
    });
    const depois = anexo({
      tipo: "tabela",
      valeDesde: "2026-09-01",
      criadoEm: "2026-09-01T12:30:00.000-03:00",
      id: "00000000-0000-4000-8000-000000000001",
    });
    // "…T15:00Z" e "…T12:00-03:00" são o mesmo instante (empate → id); "…T12:30-03:00" é meia hora depois.
    expect(tabelaVigente([utc, brasilia])?.id).toBe(utc.id);
    expect(tabelaVigente([brasilia, utc])?.id).toBe(utc.id);
    expect(tabelaVigente([utc, brasilia, depois])?.id).toBe(depois.id);
  });

  it("não mexe na lista recebida", () => {
    const anexos = [anexo({ tipo: "tabela", valeDesde: "2026-08-01" }), anexo({ tipo: "tabela", valeDesde: "2026-05-01" })];
    const copia = anexos.map((item) => ({ ...item }));
    tabelaVigente(anexos);
    efeitoDeTirar(anexos, anexos[0].id);
    expect(anexos).toEqual(copia);
  });
});

describe("precision", () => {
  it("23h50 de Brasília (02h50 UTC do dia seguinte) é o dia de Brasília", () => {
    expect(hojeEmBrasilia(new Date("2026-10-03T02:50:00Z"))).toBe("2026-10-02");
    expect(hojeEmBrasilia(new Date("2026-10-03T03:00:00Z"))).toBe("2026-10-03");
  });

  it("uma tabela enviada às 23h50 de Brasília conta o dia 2, não o 3 do UTC", () => {
    const enviada = { valeDesde: null, enviadoEm: hojeEmBrasilia(new Date("2026-10-03T02:50:00Z")) };
    // Do dia 2 são 120 dias até 30/01/2027; a 31/01, 121. Contando do dia 3 do UTC, 31/01 ainda seria
    // "recente" — a borda sairia um dia atrasada.
    expect(seloDaTabela(enviada, "2027-01-30")).toBe("recente");
    expect(seloDaTabela(enviada, "2027-01-31")).toBe("velha");
  });

  it("a mesma tabela perde para um vale desde do dia 3 — a data de envio dela é o dia 2", () => {
    const enviada = anexo({
      tipo: "tabela",
      valeDesde: null,
      enviadoEm: hojeEmBrasilia(new Date("2026-10-03T02:50:00Z")),
      criadoEm: "2026-10-03T02:50:00.000Z",
    });
    const doDia3 = anexo({ tipo: "tabela", valeDesde: "2026-10-03", criadoEm: "2026-09-01T12:00:00.000Z" });
    expect(tabelaVigente([enviada, doDia3])?.id).toBe(doDia3.id);
  });

  it("a idade é em dias civis inteiros — a hora do envio não entra na conta", () => {
    expect(seloDaTabela({ valeDesde: null, enviadoEm: "2026-06-04" }, "2026-10-02")).toBe("recente");
    expect(seloDaTabela({ valeDesde: null, enviadoEm: "2026-06-03" }, "2026-10-02")).toBe("velha");
  });

  it("D-09: vale desde no futuro — se é a mais recente, é a vigente, e conta como recente", () => {
    const hoje = "2026-10-02";
    const atual = anexo({ tipo: "tabela", nome: "Tabela de agora", valeDesde: somarDias(hoje, -5) });
    const futura = anexo({ tipo: "tabela", nome: "Tabela do mês que vem", valeDesde: somarDias(hoje, 30) });
    const vigente = tabelaVigente([atual, futura]);
    expect(vigente?.id).toBe(futura.id);
    expect(vigente && seloDaTabela(vigente, hoje)).toBe("recente");
    // Muito no futuro a conta dá negativa — continua "recente", nunca "velha".
    expect(seloDaTabela({ valeDesde: somarDias(hoje, 400), enviadoEm: hoje }, hoje)).toBe("recente");
    // Tirar a futura faz a de agora valer.
    expect(efeitoDeTirar([atual, futura], futura.id)).toEqual({
      caso: "vigente-com-anterior",
      anterior: "Tabela de agora",
    });
  });
});
