import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ehItemAtivo,
  ITENS_NAVEGACAO_CELULAR,
  ITENS_NAVEGACAO_LATERAL,
} from "../../lib/navegacao/itens";

// Fase 04.6, plano 05 (D-11): a navegação FINAL. As duas listas continuam divergindo de
// propósito — todo teste abaixo que roda sobre "as duas listas" roda sobre elas
// SEPARADAMENTE, nunca uma derivada da outra.
const LISTAS = [
  { nome: "celular", lista: ITENS_NAVEGACAO_CELULAR },
  { nome: "lateral", lista: ITENS_NAVEGACAO_LATERAL },
] as const;

describe("ehItemAtivo", () => {
  it("o Início (/gestao) casa só por igualdade exata", () => {
    expect(ehItemAtivo("/gestao", "/gestao")).toBe(true);
    expect(ehItemAtivo("/gestao/encomendas", "/gestao")).toBe(false);
  });

  it("um href de módulo casa com o próprio caminho e com sub-rotas futuras", () => {
    expect(ehItemAtivo("/gestao/encomendas", "/gestao/encomendas")).toBe(true);
    expect(ehItemAtivo("/gestao/encomendas/42", "/gestao/encomendas")).toBe(true);
  });

  it("prefixo de texto solto não basta — exige a barra separadora", () => {
    expect(ehItemAtivo("/gestao/encomendasx", "/gestao/encomendas")).toBe(false);
  });

  // Caso (g) do plano: a regra de item ativo do Início veio do plano 01 e este plano não a
  // afrouxa — /gestao/financeiro não pode acender o Início só porque /gestao é prefixo de tudo.
  it("uma sub-rota da plataforma não acende o Início por ele ser prefixo de tudo", () => {
    expect(ehItemAtivo("/gestao/financeiro", "/gestao")).toBe(false);
  });

  // Caso (f) do plano: um caminho que NÃO é módulo (a tela de trocar senha) não acende item
  // nenhum das duas listas — a barra continua renderizada, só nada nela fica marcado.
  for (const { nome, lista } of LISTAS) {
    it(`/gestao/conta/senha não acende nenhum item da lista ${nome}`, () => {
      for (const item of lista) {
        expect(ehItemAtivo("/gestao/conta/senha", item.href)).toBe(false);
      }
    });

    it(`caminho vazio nunca casa com nenhum item (lista ${nome})`, () => {
      for (const item of lista) {
        expect(ehItemAtivo("", item.href)).toBe(false);
      }
    });

    it(`caminho desconhecido não casa com nenhum item (lista ${nome})`, () => {
      for (const item of lista) {
        expect(ehItemAtivo("/gestao/rota-que-nao-existe", item.href)).toBe(false);
      }
    });

    it(`para cada caminho dos itens da lista ${nome}, exatamente um item fica ativo — a barra nunca acende dois`, () => {
      for (const alvo of lista) {
        const ativos = lista.filter((item) => ehItemAtivo(alvo.href, item.href));
        expect(ativos).toHaveLength(1);
        expect(ativos[0]?.href).toBe(alvo.href);
      }
    });
  }
});

describe("ITENS_NAVEGACAO_CELULAR (D-11/GES-12)", () => {
  // Caso (a) do plano.
  it("tem exatamente 4 itens, nesta ordem — a navegação final substitui a barra provisória da Fase 04.4", () => {
    expect(ITENS_NAVEGACAO_CELULAR).toHaveLength(4);
    expect(ITENS_NAVEGACAO_CELULAR.map((item) => item.rotulo)).toEqual([
      "Início",
      "Financeiro",
      "Produção",
      "Agenda",
    ]);
  });

  it("não tem Queimas nem Estoque — continuam a um toque pela lateral e pelo Início (D-11)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/gestao/queimas")).toBe(false);
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/gestao/estoque")).toBe(false);
  });

  it("não tem Cadastros — módulo novo entra no índice e na lateral, nunca na barra de baixo (D-11)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/gestao/cadastros")).toBe(false);
  });

  it("nenhum item leva a /gestao/orcamentos — Orçamentos é item do menu do usuário, não da navegação principal (UI-04/D-12)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/gestao/orcamentos")).toBe(
      false,
    );
  });
});

describe("ITENS_NAVEGACAO_LATERAL (D-11)", () => {
  // Caso (b) do plano.
  it("tem exatamente 7 itens, nesta ordem — Início mais todos os módulos, Cadastros incluído pela primeira vez", () => {
    expect(ITENS_NAVEGACAO_LATERAL).toHaveLength(7);
    expect(ITENS_NAVEGACAO_LATERAL.map((item) => item.rotulo)).toEqual([
      "Início",
      "Financeiro",
      "Produção",
      "Agenda",
      "Queimas",
      "Estoque",
      "Cadastros",
    ]);
  });

  it("nenhum item leva a /gestao/orcamentos — Orçamentos é item do menu do usuário, não da navegação principal (UI-04/D-12)", () => {
    expect(ITENS_NAVEGACAO_LATERAL.some((item) => item.href === "/gestao/orcamentos")).toBe(
      false,
    );
  });
});

// Caso (c) do plano.
describe("todo href das duas listas vive sob /gestao", () => {
  for (const { nome, lista } of LISTAS) {
    it(`lista ${nome}`, () => {
      for (const item of lista) {
        expect(item.href === "/gestao" || item.href.startsWith("/gestao/")).toBe(true);
      }
    });
  }
});

// Casos (d) e (e) do plano — D-13/GES-14: "Produção" é só o rótulo novo, a rota e o ícone do
// módulo de Encomendas não mudaram.
describe("\"Produção\" é só o rótulo — a rota e o ícone continuam de Encomendas (D-13/GES-14)", () => {
  for (const { nome, lista } of LISTAS) {
    it(`lista ${nome}`, () => {
      const producao = lista.find((item) => item.rotulo === "Produção");
      expect(producao).toBeDefined();
      expect(producao?.href).toBe("/gestao/encomendas");
      expect(producao?.icone).toBe("encomendas");
    });
  }

  it("o rótulo é exatamente a string \"Produção\", com acento e cedilha corretos", () => {
    expect(ITENS_NAVEGACAO_CELULAR.map((item) => item.rotulo)).toContain("Produção");
    expect(ITENS_NAVEGACAO_LATERAL.map((item) => item.rotulo)).toContain("Produção");
  });
});

// Caso (h) do plano: toda ChaveDeIcone usada pelas duas listas existe nos DOIS mapas `ICONES`
// (barra-inferior.tsx e barra-lateral.tsx), e nenhuma chave da união ficou sem uso declarado —
// lê os arquivos por `node:fs`, no molde de tests/unit/tokens.test.ts, para não depender de
// importar React nem lucide-react.
describe("ChaveDeIcone — os dois mapas ICONES cobrem toda a união (D-11)", () => {
  const itensSource = readFileSync(join(process.cwd(), "lib/navegacao/itens.ts"), "utf-8");
  const barraInferiorSource = readFileSync(
    join(process.cwd(), "components/amassa/barra-inferior.tsx"),
    "utf-8",
  );
  const barraLateralSource = readFileSync(
    join(process.cwd(), "components/amassa/barra-lateral.tsx"),
    "utf-8",
  );

  const uniaoMatch = itensSource.match(/export type ChaveDeIcone =\s*([\s\S]*?);/);
  if (!uniaoMatch) {
    throw new Error("Não achei a declaração de ChaveDeIcone em lib/navegacao/itens.ts");
  }
  const chavesDaUniao = uniaoMatch[1]
    .split("|")
    .map((parte) => parte.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);

  it("a união ChaveDeIcone tem exatamente as sete chaves esperadas", () => {
    expect(chavesDaUniao.sort()).toEqual(
      ["agenda", "cadastros", "encomendas", "estoque", "financeiro", "inicio", "queimas"].sort(),
    );
  });

  it.each([
    ["barra-inferior.tsx", () => barraInferiorSource],
    ["barra-lateral.tsx", () => barraLateralSource],
  ])("%s declara todas as chaves da união no mapa ICONES", (_nomeDoArquivo, obterFonte) => {
    const fonte = obterFonte();
    for (const chave of chavesDaUniao) {
      expect(fonte).toMatch(new RegExp(`\\b${chave}:\\s*\\w+`));
    }
  });

  it("toda ChaveDeIcone usada pelas duas listas de navegação está na união", () => {
    for (const { lista } of LISTAS) {
      for (const item of lista) {
        expect(chavesDaUniao).toContain(item.icone);
      }
    }
  });
});
