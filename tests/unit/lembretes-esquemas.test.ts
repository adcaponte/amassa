import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LIMITE_DO_TEXTO,
  esquemaCriarLembrete,
  esquemaEditarLembrete,
  esquemaExcluirLembrete,
  esquemaMarcarFeito,
} from "@/lib/lembretes/esquemas";

// 06.3-01-PLAN.md, Tarefa 2 (LMB-02/03): os Lembretes validam no SERVIDOR com os MESMOS números do
// banco — o check `lembretes_texto_comprimento` da 0029 (`length(trim(texto)) between 1 and 200`,
// contado em pontos de código). Data civil válida ou nula; pessoa uuid ou nula ("geral"). Autoria e
// momentos nunca vêm do cliente.

const ID = "3f0c9a52-6d1e-4b7a-9c2f-1a2b3c4d5e6f";
const FRASE_ESCREVA = "Escreva o lembrete.";
const FRASE_LONGO = "O lembrete pode ter até 200 caracteres.";
const FRASE_DATA = "Essa data não existe. Escolha outra no calendário.";
const FRASE_PESSOA = "Essa pessoa não está mais na lista. Escolha outra ou deixe “geral”.";

function primeiraMensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message;
}

function primeiroCampo(resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return resultado.error?.issues[0]?.path[0];
}

describe("esquemaCriarLembrete — texto", () => {
  it("o teto é o do check da 0029", () => {
    expect(LIMITE_DO_TEXTO).toBe(200);
  });

  it("vazio e só espaços → “Escreva o lembrete.” no campo texto", () => {
    for (const texto of ["", "   "]) {
      const resultado = esquemaCriarLembrete.safeParse({ texto });
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_ESCREVA);
      expect(primeiroCampo(resultado)).toBe("texto");
    }
  });

  it("texto ausente → “Escreva o lembrete.”", () => {
    const resultado = esquemaCriarLembrete.safeParse({});
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_ESCREVA);
  });

  it("200 caracteres passam; 201 → “O lembrete pode ter até 200 caracteres.”", () => {
    expect(esquemaCriarLembrete.safeParse({ texto: "x".repeat(200) }).success).toBe(true);
    const resultado = esquemaCriarLembrete.safeParse({ texto: "x".repeat(201) });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_LONGO);
    expect(primeiroCampo(resultado)).toBe("texto");
  });

  it("199 “x” + um emoji fora do BMP (dois códigos UTF-16, um ponto de código) passa", () => {
    const texto = "x".repeat(199) + "🏺";
    expect(texto.length).toBe(201);
    const resultado = esquemaCriarLembrete.safeParse({ texto });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.texto).toBe(texto);
  });

  it("apara as pontas: “  a  ” vira “a”", () => {
    expect(esquemaCriarLembrete.parse({ texto: "  a  " }).texto).toBe("a");
  });

  it("normaliza em NFC: “e” + acento combinante vira o “é” composto", () => {
    const decomposto = "é";
    const resultado = esquemaCriarLembrete.parse({ texto: decomposto });
    expect(resultado.texto).toBe("é");
    expect(resultado.texto.length).toBe(1);
  });
});

describe("esquemaCriarLembrete — paraQuando", () => {
  it("ausente, nulo e vazio → null (sem data)", () => {
    expect(esquemaCriarLembrete.parse({ texto: "a" }).paraQuando).toBeNull();
    expect(esquemaCriarLembrete.parse({ texto: "a", paraQuando: null }).paraQuando).toBeNull();
    expect(esquemaCriarLembrete.parse({ texto: "a", paraQuando: "" }).paraQuando).toBeNull();
  });

  it("um dia civil que existe passa", () => {
    expect(esquemaCriarLembrete.parse({ texto: "a", paraQuando: "2026-10-03" }).paraQuando).toBe(
      "2026-10-03",
    );
  });

  it("30 de fevereiro e data em formato brasileiro → a frase da data, no campo paraQuando", () => {
    for (const paraQuando of ["2026-02-30", "03/10/2026"]) {
      const resultado = esquemaCriarLembrete.safeParse({ texto: "a", paraQuando });
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_DATA);
      expect(primeiroCampo(resultado)).toBe("paraQuando");
    }
  });
});

describe("esquemaCriarLembrete — quem", () => {
  it("ausente, nulo e vazio → null (“geral”)", () => {
    expect(esquemaCriarLembrete.parse({ texto: "a" }).quem).toBeNull();
    expect(esquemaCriarLembrete.parse({ texto: "a", quem: null }).quem).toBeNull();
    expect(esquemaCriarLembrete.parse({ texto: "a", quem: "" }).quem).toBeNull();
  });

  it("um uuid passa", () => {
    expect(esquemaCriarLembrete.parse({ texto: "a", quem: ID }).quem).toBe(ID);
  });

  it("“abc” → a frase da pessoa, no campo quem", () => {
    const resultado = esquemaCriarLembrete.safeParse({ texto: "a", quem: "abc" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_PESSOA);
    expect(primeiroCampo(resultado)).toBe("quem");
  });
});

describe("autoria e momentos nunca vêm do cliente", () => {
  it("criadoPor, feitoPor, feitoEm e criadoEm enviados pela tela não aparecem no resultado", () => {
    const resultado = esquemaCriarLembrete.parse({
      texto: "a",
      criadoPor: ID,
      feitoPor: ID,
      feitoEm: "2026-10-03T12:00:00.000Z",
      criadoEm: "2026-10-03T12:00:00.000Z",
    });
    expect(resultado).toEqual({ texto: "a", paraQuando: null, quem: null });
    expect(resultado).not.toHaveProperty("criadoPor");
  });
});

describe("esquemaEditarLembrete", () => {
  it("sem id é recusado", () => {
    expect(esquemaEditarLembrete.safeParse({ texto: "a" }).success).toBe(false);
  });

  it("com id, os mesmos campos e regras do criar", () => {
    expect(esquemaEditarLembrete.parse({ id: ID, texto: "  b  ", paraQuando: "", quem: "" })).toEqual({
      id: ID,
      texto: "b",
      paraQuando: null,
      quem: null,
    });
    expect(esquemaEditarLembrete.safeParse({ id: ID, texto: "x".repeat(201) }).success).toBe(false);
  });
});

describe("esquemaMarcarFeito — o estado DESEJADO", () => {
  it("feito true e feito false passam", () => {
    expect(esquemaMarcarFeito.parse({ id: ID, feito: true })).toEqual({ id: ID, feito: true });
    expect(esquemaMarcarFeito.parse({ id: ID, feito: false })).toEqual({ id: ID, feito: false });
  });

  it("sem feito, ou com id inválido, é recusado", () => {
    expect(esquemaMarcarFeito.safeParse({ id: ID }).success).toBe(false);
    expect(esquemaMarcarFeito.safeParse({ id: "abc", feito: true }).success).toBe(false);
  });
});

describe("esquemaExcluirLembrete", () => {
  it("id válido passa; id inválido é recusado", () => {
    expect(esquemaExcluirLembrete.safeParse({ id: ID }).success).toBe(true);
    expect(esquemaExcluirLembrete.safeParse({ id: "abc" }).success).toBe(false);
    expect(esquemaExcluirLembrete.safeParse({}).success).toBe(false);
  });
});

describe("pureza", () => {
  it("lib/lembretes/esquemas.ts só importa zod, o calendário e ./textos", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/lembretes/esquemas.ts"), "utf8");
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    const origens = [...fonte.matchAll(/from "([^"]+)"/g)].map((casamento) => casamento[1]);
    expect(origens.length).toBeGreaterThan(0);
    for (const origem of origens) {
      expect(["zod", "@/lib/producao/calendario", "./textos"]).toContain(origem);
    }
  });

  it("lib/lembretes/textos.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/lembretes/textos.ts"), "utf8");
    expect(fonte).not.toMatch(/^import /m);
  });
});
