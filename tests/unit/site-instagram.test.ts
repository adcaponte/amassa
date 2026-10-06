import { describe, expect, it } from "vitest";

import { FOTOS_DO_INSTAGRAM } from "@/conteudo/site";
import { MAXIMO_DE_FOTOS_NA_FAIXA, fotosDaFaixa } from "@/lib/site/instagram";

// Fase 06.5, plano 21 (D-32, UI-D18): a faixa do Instagram mostra só fotos do dono, com `alt`, no
// máximo 6. Os nomes de arquivo abaixo são inventados — nenhuma foto real entra por este teste.
function foto(numero: number, alt = `Peça de cerâmica ${numero}.`) {
  return { arquivo: `instagram-${numero}.jpg`, alt };
}

describe("lib/site/instagram — fotosDaFaixa", () => {
  it("lista vazia devolve vazia (a faixa não renderiza)", () => {
    expect(fotosDaFaixa([])).toEqual([]);
  });

  it("oito fotos viram seis, as seis primeiras, na ordem", () => {
    const oito = [1, 2, 3, 4, 5, 6, 7, 8].map((numero) => foto(numero));
    const resultado = fotosDaFaixa(oito);
    expect(MAXIMO_DE_FOTOS_NA_FAIXA).toBe(6);
    expect(resultado).toHaveLength(6);
    expect(resultado.map((f) => f.arquivo)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `instagram-${n}.jpg`));
  });

  it("foto sem alt — vazio ou só espaço — fica de fora, e a de depois sobe no lugar", () => {
    const lista = [foto(1), foto(2, ""), foto(3, "   "), foto(4)];
    expect(fotosDaFaixa(lista).map((f) => f.arquivo)).toEqual(["instagram-1.jpg", "instagram-4.jpg"]);
  });

  it("o teto de 6 conta só as fotos que entram (as sem alt não ocupam vaga)", () => {
    const lista = [foto(1, ""), ...[2, 3, 4, 5, 6, 7, 8].map((numero) => foto(numero))];
    expect(fotosDaFaixa(lista).map((f) => f.arquivo)).toEqual(
      [2, 3, 4, 5, 6, 7].map((n) => `instagram-${n}.jpg`),
    );
  });

  it("apara o alt e não muda a lista recebida", () => {
    const lista = [foto(1, "  Caneca azul.  ")];
    expect(fotosDaFaixa(lista)).toEqual([{ arquivo: "instagram-1.jpg", alt: "Caneca azul." }]);
    expect(lista[0]?.alt).toBe("  Caneca azul.  ");
  });

  it("foto sem arquivo também fica de fora", () => {
    expect(fotosDaFaixa([{ arquivo: "", alt: "Caneca." }])).toEqual([]);
  });
});

describe("conteudo/site.ts — FOTOS_DO_INSTAGRAM", () => {
  it("toda foto listada tem alt e mora em public/site/ (só o nome do arquivo, sem caminho nem URL)", () => {
    for (const { arquivo, alt } of FOTOS_DO_INSTAGRAM) {
      expect(alt.trim().length, `${arquivo} sem alt`).toBeGreaterThan(0);
      expect(arquivo, `${arquivo} deveria ser só o nome do arquivo`).toMatch(/^[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$/i);
    }
  });
});
