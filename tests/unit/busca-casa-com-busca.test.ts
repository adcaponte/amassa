import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  casaComBusca,
  normalizarParaBusca,
  palavrasDaBusca,
  TETO_DE_PALAVRAS,
} from "@/lib/busca/casa-com-busca";
import { DICA_BUSCA_POR_PALAVRAS, fraseNadaEncontradoPara } from "@/lib/busca/textos";

// A busca por palavras e sem acento (06.5-09-PLAN.md, D-17, POL-09). Nomes inventados — nenhum dado
// real. Uma categoria de borda por `describe`, no molde de `fornecedores-busca.test.ts`.

describe("normalizarParaBusca — a regra de nome_normalizado() do banco", () => {
  it("tira acento, cedilha e caixa, colapsa e apara os espaços", () => {
    expect(normalizarParaBusca("  ÇÃO   Ārgíla ")).toBe("cao argila");
  });

  it("colapsa tabulação e quebra de linha como espaço", () => {
    expect(normalizarParaBusca("Café\t\ncoado")).toBe("cafe coado");
  });

  it("mantém colchetes e números", () => {
    expect(normalizarParaBusca("[Teste Cowork] Caneca 2")).toBe("[teste cowork] caneca 2");
  });
});

describe("palavrasDaBusca", () => {
  it("devolve as palavras normalizadas, sem as vazias", () => {
    expect(palavrasDaBusca("  Cowork   CANECA ")).toEqual(["cowork", "caneca"]);
  });

  it("termo vazio ou só de espaços não tem palavra", () => {
    expect(palavrasDaBusca("")).toEqual([]);
    expect(palavrasDaBusca("   \t ")).toEqual([]);
  });

  it(`12 palavras: só as ${TETO_DE_PALAVRAS} primeiras contam (T-06.5-19)`, () => {
    const termo = "a b c d e f g h i j k l";
    expect(palavrasDaBusca(termo)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
  });
});

describe("casaComBusca — ordem", () => {
  it("“cowork caneca” acha “[teste cowork] Caneca”", () => {
    expect(casaComBusca("[teste cowork] Caneca", "cowork caneca")).toBe(true);
  });

  it("a ordem trocada também acha", () => {
    expect(casaComBusca("[teste cowork] Caneca", "caneca cowork")).toBe(true);
    expect(casaComBusca("Caneca grande azul", "azul caneca")).toBe(true);
  });

  it("pedaço de palavra acha", () => {
    expect(casaComBusca("Caneca grande", "cane gra")).toBe(true);
  });
});

describe("casaComBusca — acento", () => {
  it("“cafe” acha “Café”", () => {
    expect(casaComBusca("Café coado", "cafe")).toBe(true);
  });

  it("“CAFÉ” acha “cafe”", () => {
    expect(casaComBusca("cafe coado", "CAFÉ")).toBe(true);
  });

  it("“pao de queijo” acha “Pão de Queijo”", () => {
    expect(casaComBusca("Pão de Queijo", "pao de queijo")).toBe(true);
  });
});

describe("casaComBusca — espaços e vazio", () => {
  it("espaços extras no termo não mudam nada", () => {
    expect(casaComBusca("[teste cowork] Caneca", "   cowork     caneca  ")).toBe(true);
  });

  it("termo vazio casa com tudo", () => {
    expect(casaComBusca("Qualquer coisa", "")).toBe(true);
    expect(casaComBusca("Qualquer coisa", "   ")).toBe(true);
    expect(casaComBusca("", "")).toBe(true);
  });
});

describe("casaComBusca — o que não acha", () => {
  it("uma palavra que não aparece basta para não achar", () => {
    expect(casaComBusca("[teste cowork] Caneca", "cowork xicara")).toBe(false);
  });

  it("a escrita errada não acha (sem distância de edição)", () => {
    expect(casaComBusca("Caneca", "canceca")).toBe(false);
  });

  it("texto vazio não acha termo com palavra", () => {
    expect(casaComBusca("", "caneca")).toBe(false);
  });

  it("12 palavras: a 11ª e a 12ª são ignoradas, mesmo sem aparecer", () => {
    const termo = "a b c d e f g h i j zzz yyy";
    expect(casaComBusca("a b c d e f g h i j", termo)).toBe(true);
  });
});

describe("textos da busca", () => {
  it("o vazio cita o termo entre aspas curvas, aparado", () => {
    expect(fraseNadaEncontradoPara(" cowork caneca ")).toBe("Nada encontrado para “cowork caneca”.");
  });

  it("a dica é a da UI-SPEC, verbatim", () => {
    expect(DICA_BUSCA_POR_PALAVRAS).toBe(
      "A busca acha cada palavra, em qualquer ordem e com ou sem acento. Tente uma palavra só.",
    );
  });
});

describe("pureza", () => {
  it("lib/busca/casa-com-busca.ts e lib/busca/textos.ts não importam nada", () => {
    for (const arquivo of ["lib/busca/casa-com-busca.ts", "lib/busca/textos.ts"]) {
      const fonte = readFileSync(join(process.cwd(), arquivo), "utf8");
      expect(fonte).not.toMatch(/^\s*import\s/m);
      expect(fonte).not.toMatch(/require\(/);
    }
  });
});
