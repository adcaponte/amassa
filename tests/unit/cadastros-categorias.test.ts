import { describe, expect, it } from "vitest";

import { areaFixaDoGrupo, ordemDosGrupos, podeMudarGrupoEArea } from "../../lib/cadastros/categorias";
import { subDaUrl } from "../../lib/cadastros/abas";
import { avisoDaUrl } from "../../lib/cadastros/avisos";

describe("areaFixaDoGrupo", () => {
  it("geral e fora sempre andam com a área geral (a restrição do banco espelhada aqui)", () => {
    expect(areaFixaDoGrupo("geral")).toBe("geral");
    expect(areaFixaDoGrupo("fora")).toBe("geral");
  });

  it("receita e custo não têm área fixa — a área é escolhida", () => {
    expect(areaFixaDoGrupo("receita")).toBeNull();
    expect(areaFixaDoGrupo("custo")).toBeNull();
  });
});

describe("podeMudarGrupoEArea", () => {
  it("sem nenhum uso e sem chave de sistema, pode mudar", () => {
    expect(
      podeMudarGrupoEArea({ lancamentos: 0, itens: 0, contasFixas: 0, chaveDoSistema: null }),
    ).toBe(true);
  });

  it("qualquer um dos três usos maior que zero trava a mudança", () => {
    expect(
      podeMudarGrupoEArea({ lancamentos: 1, itens: 0, contasFixas: 0, chaveDoSistema: null }),
    ).toBe(false);
    expect(
      podeMudarGrupoEArea({ lancamentos: 0, itens: 1, contasFixas: 0, chaveDoSistema: null }),
    ).toBe(false);
    expect(
      podeMudarGrupoEArea({ lancamentos: 0, itens: 0, contasFixas: 1, chaveDoSistema: null }),
    ).toBe(false);
  });

  it("categoria com chave de sistema nunca muda, mesmo sem nenhum uso", () => {
    expect(
      podeMudarGrupoEArea({
        lancamentos: 0,
        itens: 0,
        contasFixas: 0,
        chaveDoSistema: "diferenca",
      }),
    ).toBe(false);
  });
});

describe("ordemDosGrupos", () => {
  it("é receita, custo, geral, fora, nesta ordem", () => {
    expect(ordemDosGrupos).toEqual(["receita", "custo", "geral", "fora"]);
  });
});

describe("subDaUrl", () => {
  it("reconhece as quatro sub-abas", () => {
    expect(subDaUrl("catalogo")).toBe("catalogo");
    expect(subDaUrl("categorias")).toBe("categorias");
    expect(subDaUrl("fixas")).toBe("fixas");
    expect(subDaUrl("taxas")).toBe("taxas");
  });

  it("ausente, vazio ou desconhecido cai em catalogo (o padrão)", () => {
    expect(subDaUrl(undefined)).toBe("catalogo");
    expect(subDaUrl(null)).toBe("catalogo");
    expect(subDaUrl("")).toBe("catalogo");
    expect(subDaUrl("nao-existe")).toBe("catalogo");
  });
});

describe("avisoDaUrl (Cadastros)", () => {
  it("aceita os tipos sem parâmetro (categorias e contas fixas)", () => {
    expect(avisoDaUrl({ aviso: "categoria-desativada" })).toEqual({ tipo: "categoria-desativada" });
    expect(avisoDaUrl({ aviso: "categoria-reativada" })).toEqual({ tipo: "categoria-reativada" });
    expect(avisoDaUrl({ aviso: "conta-fixa-desativada" })).toEqual({ tipo: "conta-fixa-desativada" });
    expect(avisoDaUrl({ aviso: "conta-fixa-reativada" })).toEqual({ tipo: "conta-fixa-reativada" });
  });

  it("contas-geradas exige quantidade (0-500) e mês (AAAA-MM) válidos", () => {
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "3", mes: "2027-01" })).toEqual({
      tipo: "contas-geradas",
      quantidade: 3,
      mes: "2027-01",
    });
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "0", mes: "2027-01" })).toEqual({
      tipo: "contas-geradas",
      quantidade: 0,
      mes: "2027-01",
    });
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "-1", mes: "2027-01" })).toBeNull();
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "501", mes: "2027-01" })).toBeNull();
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "3", mes: "não-é-mês" })).toBeNull();
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "3" })).toBeNull();
    expect(avisoDaUrl({ aviso: "contas-geradas" })).toBeNull();
  });

  it("devolve nulo para o resto — ausente, vazio ou desconhecido", () => {
    expect(avisoDaUrl({})).toBeNull();
    expect(avisoDaUrl({ aviso: null })).toBeNull();
    expect(avisoDaUrl({ aviso: "" })).toBeNull();
    expect(avisoDaUrl({ aviso: "lancado" })).toBeNull();
    expect(avisoDaUrl({ aviso: "qualquer-coisa" })).toBeNull();
  });
});
