import { describe, expect, it } from "vitest";

import { avisoDaUrl } from "@/lib/financeiro/avisos";
import { nomeDoMesSemAno } from "@/lib/financeiro/formato";
import { textoAvisoContasFixasCorpo, textoAvisoContasFixasManchete } from "@/lib/financeiro/textos";

// 06.5-12 (T-06.5-30): `?aviso=contas-geradas&quantidade=N&mesGerado=AAAA-MM` no Financeiro — a mesma
// validação dos Cadastros; inválido = sem aviso.
describe("avisoDaUrl — contas-geradas", () => {
  it("aceita quantidade inteira de 0 a 500 e um mês que existe", () => {
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "3", mesGerado: "2026-11" })).toEqual({
      tipo: "contas-geradas",
      quantidade: 3,
      mes: "2026-11",
    });
    expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "0", mesGerado: "2027-01" })).toEqual({
      tipo: "contas-geradas",
      quantidade: 0,
      mes: "2027-01",
    });
  });

  it("recusa quantidade negativa, fracionária, acima de 500 ou ausente", () => {
    for (const quantidade of ["-1", "1.5", "501", "", "três", undefined]) {
      expect(avisoDaUrl({ aviso: "contas-geradas", quantidade, mesGerado: "2026-11" })).toBeNull();
    }
  });

  it("recusa mês inexistente, fora do formato ou ausente", () => {
    for (const mesGerado of ["2026-13", "2026-00", "2026-1", "novembro", "", undefined]) {
      expect(avisoDaUrl({ aviso: "contas-geradas", quantidade: "1", mesGerado })).toBeNull();
    }
  });
});

describe("o aviso das contas fixas do Caixa (verbatim da UI-SPEC)", () => {
  it("manchete com o mês e o ano; corpo só com o mês, minúsculo", () => {
    expect(textoAvisoContasFixasManchete("novembro de 2026")).toBe(
      "As contas fixas de novembro de 2026 ainda não foram geradas.",
    );
    expect(textoAvisoContasFixasCorpo(nomeDoMesSemAno("2026-11"))).toBe(
      "O que vence em novembro não aparece em “A pagar” nem conta em “Se tudo se cumprir”.",
    );
  });
});
