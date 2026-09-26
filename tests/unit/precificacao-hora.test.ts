import { describe, expect, it } from "vitest";

import { calcularHora } from "@/lib/precificacao/hora";

// 04.5-02-PLAN.md, Tarefa 1 — "Calcular minha hora" (ORC-04): custo fixo entra no preço por
// aqui, e só por aqui (D-13, sem rateio no Financeiro).

describe("calcularHora", () => {
  it("(retirada + casa) ÷ horas, arredondada meio-para-cima", () => {
    expect(
      calcularHora({ retiradaCentavos: 350000, casaCentavos: 140000, horasMilesimos: 140000 }),
    ).toBe(3500);
  });

  it("arredonda meio-para-cima quando a divisão não é exata", () => {
    // (100 + 0) / 3h = 33,333... centavos → 33.
    expect(calcularHora({ retiradaCentavos: 100, casaCentavos: 0, horasMilesimos: 3000 })).toBe(33);
    // 150 / 3h = 50 exato.
    expect(calcularHora({ retiradaCentavos: 150, casaCentavos: 0, horasMilesimos: 3000 })).toBe(50);
  });

  it("horas em zero devolve null — 'Informe as horas.', nunca um número", () => {
    expect(calcularHora({ retiradaCentavos: 350000, casaCentavos: 140000, horasMilesimos: 0 })).toBeNull();
  });

  it("horas negativas (defensivo) também devolvem null", () => {
    expect(calcularHora({ retiradaCentavos: 350000, casaCentavos: 140000, horasMilesimos: -1 })).toBeNull();
  });

  it("retirada e casa em zero, com horas positivas, devolve 0 — não null", () => {
    expect(calcularHora({ retiradaCentavos: 0, casaCentavos: 0, horasMilesimos: 140000 })).toBe(0);
  });
});
