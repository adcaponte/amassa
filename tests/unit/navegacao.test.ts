import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ehItemAtivo,
  ITENS_NAVEGACAO_CELULAR,
  ITENS_NAVEGACAO_LATERAL,
} from "../../lib/navegacao/itens";
import { PREFIXO_GESTAO, rotaDeGestao } from "../../lib/rotas/gestao";

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
    expect(ehItemAtivo("/gestao/producao", "/gestao")).toBe(false);
  });

  it("um href de módulo casa com o próprio caminho e com sub-rotas futuras", () => {
    expect(ehItemAtivo("/gestao/producao", "/gestao/producao")).toBe(true);
    expect(ehItemAtivo("/gestao/producao/42", "/gestao/producao")).toBe(true);
  });

  it("prefixo de texto solto não basta — exige a barra separadora", () => {
    expect(ehItemAtivo("/gestao/producaox", "/gestao/producao")).toBe(false);
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

  it("não tem Lembretes — a Fase 06.3 o pôs na lateral e no índice, nunca na barra de baixo (D-11, UI-D1)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/gestao/lembretes")).toBe(false);
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.icone === "lembretes")).toBe(false);
  });

  it("nenhum item leva a /gestao/orcamentos — Orçamentos é item do menu do usuário, não da navegação principal (UI-04/D-12)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/gestao/orcamentos")).toBe(
      false,
    );
  });
});

describe("ITENS_NAVEGACAO_LATERAL (D-11)", () => {
  // Caso (b) do plano.
  it("tem exatamente 8 itens, nesta ordem — Início mais todos os módulos, Cadastros (04.6) e Lembretes (06.3, entre Estoque e Cadastros)", () => {
    expect(ITENS_NAVEGACAO_LATERAL).toHaveLength(8);
    expect(ITENS_NAVEGACAO_LATERAL.map((item) => item.rotulo)).toEqual([
      "Início",
      "Financeiro",
      "Produção",
      "Agenda",
      "Queimas",
      "Estoque",
      "Lembretes",
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
//
// A asserção deriva de `PREFIXO_GESTAO`, importado de `lib/rotas/gestao.ts`, e NÃO do literal
// "/gestao" escrito aqui. A diferença não é estética: `lib/navegacao/itens.ts` escreve cada
// `href` à mão, então a constante e as listas podem divergir. Com o literal repetido no teste,
// trocar `PREFIXO_GESTAO` deixaria este teste vermelho exigindo o prefixo ANTIGO — vermelho pelo
// motivo errado, fixando o literal em vez de seguir a constante. Derivando, o teste passa a
// provar coerência entre os dois módulos, que é o que importa. É a mesma classe de defeito que o
// plano 04.6-02 caçou em 15 `href` literais: 4 quebravam teste e 11 eram latentes até 2027.
describe(`todo href das duas listas vive sob ${PREFIXO_GESTAO}`, () => {
  for (const { nome, lista } of LISTAS) {
    it(`lista ${nome}`, () => {
      for (const item of lista) {
        expect(
          item.href === PREFIXO_GESTAO || item.href.startsWith(`${PREFIXO_GESTAO}/`),
        ).toBe(true);
      }
    });
  }

  // O portão que o caso acima sozinho não dá: se alguém trocar `PREFIXO_GESTAO` e esquecer as
  // listas, o teste acima acusa item por item, mas nada diz que o ERRO é a divergência entre os
  // dois módulos. Este diz, e é o que aparece primeiro na saída do vitest.
  it("rotaDeGestao() e as listas concordam sobre o prefixo", () => {
    expect(rotaDeGestao("/")).toBe(PREFIXO_GESTAO);
    for (const { nome, lista } of LISTAS) {
      const forasteiros = lista
        .map((item) => item.href)
        .filter((href) => href !== PREFIXO_GESTAO && !href.startsWith(`${PREFIXO_GESTAO}/`));
      expect(forasteiros, `hrefs fora de ${PREFIXO_GESTAO} na lista ${nome}`).toEqual([]);
    }
  });
});

// Casos (d) e (e) do plano 04.6 — D-13/GES-14 deu o rótulo "Produção" ao módulo de Encomendas. Fase
// 06.1 (D-03): o item aponta DIRETO para `/gestao/producao` (o endereço antigo só redireciona);
// a chave de ícone "encomendas" fica — é chave de mapa, sem efeito visível.
describe("\"Produção\" aponta para /gestao/producao, com a chave de ícone de sempre (D-03)", () => {
  for (const { nome, lista } of LISTAS) {
    it(`lista ${nome}`, () => {
      const producao = lista.find((item) => item.rotulo === "Produção");
      expect(producao).toBeDefined();
      expect(producao?.href).toBe("/gestao/producao");
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

  it("a união ChaveDeIcone tem exatamente as oito chaves esperadas", () => {
    expect(chavesDaUniao).toHaveLength(8);
    expect(chavesDaUniao.sort()).toEqual(
      [
        "agenda",
        "cadastros",
        "encomendas",
        "estoque",
        "financeiro",
        "inicio",
        "lembretes",
        "queimas",
      ].sort(),
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
