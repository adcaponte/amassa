import { describe, expect, it } from "vitest";

import { CONTEUDO_SITE, FOTOS_DO_INSTAGRAM, MENSAGENS_DO_WHATSAPP, SLOTS_DE_IMAGEM } from "@/conteudo/site";
import { DATA_DA_GUARDA, placeholdersNoAr } from "@/lib/site/placeholder";

// D-28 (Fase 06.5): a guarda anti-placeholder do site. Os casos com data INJETADA provam os dois
// lados de 01/12/2026 sem esperar o calendário; o último caso usa o relógio de verdade e é o que
// derruba o `npm run verificar` a partir da inauguração se `conteudo/site.ts` tiver um placeholder.
describe("lib/site/placeholder.ts — placeholdersNoAr (D-28)", () => {
  const COM_PLACEHOLDER = [
    "Rua [nome da rua], nº [00] — Centro",
    "Quem somos: Theo e Andressa. [texto]",
    "(62) 9 0000-0000",
  ];
  const LIMPOS = ["Abrimos em dezembro.", "Quem somos: Theo e Andressa.", "(11) 9 8765-4321", "[]", ""];

  it("a data da guarda é 01/12/2026, a inauguração", () => {
    expect(DATA_DA_GUARDA).toBe("2026-12-01");
  });

  it("antes de 01/12 (30/11/2026) não acusa nada — só registra", () => {
    expect(placeholdersNoAr([...COM_PLACEHOLDER, ...LIMPOS], "2026-11-30")).toEqual([]);
    expect(placeholdersNoAr(COM_PLACEHOLDER, "2026-10-06")).toEqual([]);
  });

  it("em 01/12/2026 acha o colchete com conteúdo e o telefone 0000-0000", () => {
    expect(placeholdersNoAr([...COM_PLACEHOLDER, ...LIMPOS], "2026-12-01")).toEqual(COM_PLACEHOLDER);
  });

  it("depois de 01/12 continua achando (o ano seguinte também)", () => {
    expect(placeholdersNoAr(["[texto]"], "2026-12-02")).toEqual(["[texto]"]);
    expect(placeholdersNoAr(["(62) 9 0000-0000"], "2027-01-15")).toEqual(["(62) 9 0000-0000"]);
  });

  it("“Abrimos em dezembro.” nunca é achado — nem antes, nem depois da guarda", () => {
    for (const hoje of ["2026-11-30", "2026-12-01", "2027-06-01"]) {
      expect(placeholdersNoAr(["Abrimos em dezembro."], hoje)).toEqual([]);
    }
  });

  it("colchete vazio, telefone de verdade e texto comum não são placeholder", () => {
    expect(placeholdersNoAr(LIMPOS, "2026-12-01")).toEqual([]);
  });

  it("um “hoje” fora do formato AAAA-MM-DD falha alto em vez de passar como “antes da guarda”", () => {
    for (const hoje of ["", "01/12/2026", "2026-12-1", "amanhã"]) {
      expect(() => placeholdersNoAr(["[texto]"], hoje), `"${hoje}"`).toThrow(/dia civil/);
    }
  });
});

// O dia civil de Brasília, calculado aqui (o `verificar` roda em UTC no CI e em Brasília na máquina
// do dono — perto da meia-noite, um "hoje" em UTC erraria o dia).
function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function coletarStrings(valor: unknown, acumulador: string[]) {
  if (typeof valor === "string") {
    acumulador.push(valor);
    return;
  }
  if (valor && typeof valor === "object") {
    for (const filho of Object.values(valor)) coletarStrings(filho, acumulador);
  }
}

describe("conteudo/site.ts — a guarda de 01/12/2026 com o relógio de verdade (D-28)", () => {
  it("nenhum placeholder no conteúdo do site (a partir de 01/12/2026 isto derruba o verificar)", () => {
    const strings: string[] = [];
    coletarStrings(CONTEUDO_SITE, strings);
    coletarStrings(MENSAGENS_DO_WHATSAPP, strings);
    coletarStrings(SLOTS_DE_IMAGEM, strings);
    // 06.5-21: o `alt` das fotos do Instagram também vai ao ar (no HTML), quando o dono mandar as fotos.
    coletarStrings(FOTOS_DO_INSTAGRAM, strings);
    expect(strings.length).toBeGreaterThan(0);

    const hoje = hojeEmBrasilia();

    // Antes de 01/12 a guarda só REGISTRA: o que ela acharia na inauguração sai no log do teste,
    // sem reprovar — o dono pode estar no meio de preencher o conteúdo.
    if (hoje < DATA_DA_GUARDA) {
      const naInauguracao = placeholdersNoAr(strings, DATA_DA_GUARDA);
      if (naInauguracao.length > 0) {
        console.warn(
          `[guarda do site] a partir de ${DATA_DA_GUARDA} estes textos de conteudo/site.ts reprovam o verificar:`,
          naInauguracao,
        );
      }
    }

    expect(placeholdersNoAr(strings, hoje), `placeholder no ar em ${hoje} — preencha ou esvazie o campo`).toEqual([]);
  });
});
