import { describe, expect, it } from "vitest";

import { limiarDeAtencao, medirForno } from "../../lib/queimas/contador";

// Gera N timestamps ISO distintos e crescentes, uma queima "ocorrida" a cada minuto a partir de
// uma âncora fixa — nunca `Date.now()` (o módulo não lê o relógio, e o teste também não precisa).
function queimasFalsas(quantidade: number, aPartirDe = "2026-01-01T00:00:00.000Z"): string[] {
  const inicio = new Date(aPartirDe).getTime();
  return Array.from({ length: quantidade }, (_, indice) =>
    new Date(inicio + indice * 60_000).toISOString(),
  );
}

describe("limiarDeAtencao", () => {
  it("limite 100 → 90", () => {
    expect(limiarDeAtencao(100)).toBe(90);
  });

  it("limite 10 → 1 (o piso Math.max(1, ...) vale)", () => {
    expect(limiarDeAtencao(10)).toBe(1);
  });

  it("limite 11 → 1 (o piso continua valendo mesmo um pouco acima do mínimo)", () => {
    expect(limiarDeAtencao(11)).toBe(1);
  });
});

describe("medirForno — níveis (limite 100, sem manutenção)", () => {
  it("89 → ok", () => {
    const medida = medirForno({
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(89),
      ultimaManutencaoEm: null,
    });
    expect(medida.contador).toBe(89);
    expect(medida.nivel).toBe("ok");
  });

  it("90 → atencao", () => {
    const medida = medirForno({
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(90),
      ultimaManutencaoEm: null,
    });
    expect(medida.nivel).toBe("atencao");
  });

  it("99 → atencao", () => {
    const medida = medirForno({
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(99),
      ultimaManutencaoEm: null,
    });
    expect(medida.nivel).toBe("atencao");
  });

  it("100 → critico", () => {
    const medida = medirForno({
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(100),
      ultimaManutencaoEm: null,
    });
    expect(medida.nivel).toBe("critico");
  });

  it("101 → critico", () => {
    const medida = medirForno({
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(101),
      ultimaManutencaoEm: null,
    });
    expect(medida.nivel).toBe("critico");
  });
});

describe("medirForno — corte por manutenção", () => {
  it("forno sem nenhuma manutenção: contador conta todas as queimas (contador === total)", () => {
    const medida = medirForno({
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(5),
      ultimaManutencaoEm: null,
    });
    expect(medida.contador).toBe(5);
    expect(medida.total).toBe(5);
  });

  it("uma queima ESTRITAMENTE depois da última manutenção entra no contador; uma EXATAMENTE igual não entra; ambas entram no total", () => {
    const corte = "2026-01-01T00:00:00.000Z";
    const ocorrenciasDeQueima = [
      corte, // exatamente igual — NÃO entra no contador
      new Date(new Date(corte).getTime() + 1).toISOString(), // 1ms depois — entra
    ];

    const medida = medirForno({ limite: 100, ocorrenciasDeQueima, ultimaManutencaoEm: corte });

    expect(medida.contador).toBe(1);
    expect(medida.total).toBe(2);
  });

  it("forno sem nenhuma queima: contador 0, total 0, nível ok", () => {
    const medida = medirForno({ limite: 100, ocorrenciasDeQueima: [], ultimaManutencaoEm: null });
    expect(medida.contador).toBe(0);
    expect(medida.total).toBe(0);
    expect(medida.nivel).toBe("ok");
  });
});

describe("medirForno — guarda de entrada e pureza", () => {
  it("limite menor que 10 lança RangeError com mensagem em português nomeando o campo", () => {
    expect(() =>
      medirForno({ limite: 9, ocorrenciasDeQueima: [], ultimaManutencaoEm: null }),
    ).toThrow(RangeError);
    expect(() =>
      medirForno({ limite: 9, ocorrenciasDeQueima: [], ultimaManutencaoEm: null }),
    ).toThrow(/limite/i);
  });

  it("chamar medirForno duas vezes com a mesma entrada devolve o mesmo resultado (sem ler o relógio)", () => {
    const entrada = {
      limite: 100,
      ocorrenciasDeQueima: queimasFalsas(42),
      ultimaManutencaoEm: null,
    };
    const primeira = medirForno(entrada);
    const segunda = medirForno(entrada);
    expect(segunda).toEqual(primeira);
  });
});
