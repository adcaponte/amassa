import { describe, expect, it } from "vitest";

import {
  motivoSemCorrecao,
  normalizarParaVersao,
  versaoDoDocumento,
  type LeituraParaVersao,
} from "@/lib/financeiro/correcao";

// 06.5-16-PLAN.md, Tarefa 1 — a versão do documento que a página manda à tela e que a transação relê
// sob a trava: a MESMA leitura e o MESMO normalizador nos dois lados. Representações diferentes do
// mesmo dado dão a mesma versão; uma mudança de verdade dá outra.

const LINHA_A = "11111111-1111-4111-8111-111111111111";
const LINHA_B = "22222222-2222-4222-8222-222222222222";
const PARCELA_A = "33333333-3333-4333-8333-333333333333";
const PARCELA_B = "44444444-4444-4444-8444-444444444444";

// A leitura como o Drizzle entrega (`date` em modo texto, `numeric` em texto de 3 casas, inteiros).
function leituraBase(): LeituraParaVersao {
  return {
    canceladoEm: null,
    linhas: [
      { id: LINHA_A, quantidade: 2, valorCentavos: 7000, quantidadeEstoque: null },
      { id: LINHA_B, quantidade: 1, valorCentavos: 3000, quantidadeEstoque: "2.000" },
    ],
    parcelas: [
      { id: PARCELA_A, valorCentavos: 5000, forma: "pix", vencimento: "2026-10-05", pagoEm: "2026-10-05" },
      { id: PARCELA_B, valorCentavos: 5000, forma: "cartao", vencimento: "2026-11-05", pagoEm: null },
    ],
  };
}

function versao(leitura: LeituraParaVersao): string {
  return versaoDoDocumento(normalizarParaVersao(leitura));
}

describe("versaoDoDocumento — resumo curto e determinístico", () => {
  it("é hexadecimal de 8 casas e igual em duas chamadas", () => {
    const v = versao(leituraBase());
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(versao(leituraBase())).toBe(v);
  });
});

describe("versaoDoDocumento — a MESMA versão quando só a representação muda", () => {
  const base = versao(leituraBase());

  it("cancelado_em: Date × texto ISO × texto do Postgres", () => {
    const instante = "2026-10-05T15:04:05.123Z";
    const comDate = versao({ ...leituraBase(), canceladoEm: new Date(instante) });
    expect(versao({ ...leituraBase(), canceladoEm: instante })).toBe(comDate);
    expect(versao({ ...leituraBase(), canceladoEm: "2026-10-05 15:04:05.123+00" })).toBe(comDate);
    expect(versao({ ...leituraBase(), canceladoEm: "2026-10-05 12:04:05.123-03" })).toBe(comDate);
  });

  it("vencimento e pago em: Date × “2026-10-05” (meia-noite UTC e meia-noite de Brasília)", () => {
    const leitura = leituraBase();
    const comDateUtc: LeituraParaVersao = {
      ...leitura,
      parcelas: [
        { ...leitura.parcelas[0], vencimento: new Date("2026-10-05"), pagoEm: new Date("2026-10-05T00:00:00Z") },
        leitura.parcelas[1],
      ],
    };
    const comDateBrasilia: LeituraParaVersao = {
      ...leitura,
      parcelas: [
        {
          ...leitura.parcelas[0],
          vencimento: new Date("2026-10-05T00:00:00-03:00"),
          pagoEm: new Date("2026-10-05T00:00:00-03:00"),
        },
        { ...leitura.parcelas[1], vencimento: new Date("2026-11-05T00:00:00-03:00") },
      ],
    };
    expect(versao(comDateUtc)).toBe(base);
    expect(versao(comDateBrasilia)).toBe(base);
  });

  it("valor: “70” × 70, e quantidade como texto", () => {
    const leitura = leituraBase();
    const comTexto: LeituraParaVersao = {
      ...leitura,
      linhas: [
        { ...leitura.linhas[0], quantidade: "2", valorCentavos: "7000" },
        { ...leitura.linhas[1], valorCentavos: "3000" },
      ],
      parcelas: [{ ...leitura.parcelas[0], valorCentavos: "5000" }, leitura.parcelas[1]],
    };
    expect(versao(comTexto)).toBe(base);

    const pequena = (valor: number | string): string =>
      versao({ ...leitura, linhas: [{ ...leitura.linhas[0], valorCentavos: valor }] });
    expect(pequena("70")).toBe(pequena(70));
  });

  it("quantidade de estoque: “2” × “2.000” × 2 × “2.0”", () => {
    const leitura = leituraBase();
    for (const quantidade of ["2", 2, "2.0", "02.000"] as const) {
      expect(versao({ ...leitura, linhas: [leitura.linhas[0], { ...leitura.linhas[1], quantidadeEstoque: quantidade }] })).toBe(
        base,
      );
    }
    const fracionada = (valor: number | string): string =>
      versao({ ...leitura, linhas: [{ ...leitura.linhas[1], quantidadeEstoque: valor }] });
    expect(fracionada("2.5")).toBe(fracionada("2.500"));
    expect(fracionada(2.5)).toBe(fracionada("2.500"));
  });

  it("linhas e parcelas em outra ordem", () => {
    const leitura = leituraBase();
    expect(
      versao({ ...leitura, linhas: [...leitura.linhas].reverse(), parcelas: [...leitura.parcelas].reverse() }),
    ).toBe(base);
  });
});

describe("versaoDoDocumento — versão DIFERENTE quando o documento mudou", () => {
  const base = versao(leituraBase());

  it("uma parcela foi paga", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, parcelas: [leitura.parcelas[0], { ...leitura.parcelas[1], pagoEm: "2026-10-06" }] })).not.toBe(
      base,
    );
  });

  it("um valor mudou (linha ou parcela)", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, linhas: [{ ...leitura.linhas[0], valorCentavos: 7001 }, leitura.linhas[1]] })).not.toBe(base);
    expect(versao({ ...leitura, parcelas: [{ ...leitura.parcelas[0], valorCentavos: 5001 }, leitura.parcelas[1]] })).not.toBe(
      base,
    );
  });

  it("a forma, o vencimento ou a quantidade de estoque mudaram", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, parcelas: [{ ...leitura.parcelas[0], forma: "dinheiro" }, leitura.parcelas[1]] })).not.toBe(base);
    expect(versao({ ...leitura, parcelas: [leitura.parcelas[0], { ...leitura.parcelas[1], vencimento: "2026-11-06" }] })).not.toBe(
      base,
    );
    expect(versao({ ...leitura, linhas: [leitura.linhas[0], { ...leitura.linhas[1], quantidadeEstoque: "2.001" }] })).not.toBe(base);
  });

  it("uma parcela a mais ou a menos", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, parcelas: [leitura.parcelas[0]] })).not.toBe(base);
  });

  it("o documento foi cancelado", () => {
    expect(versao({ ...leituraBase(), canceladoEm: new Date("2026-10-05T15:04:05Z") })).not.toBe(base);
  });
});

describe("normalizarParaVersao — recusa o que não é dado do banco", () => {
  it("inteiro que não é inteiro, data e instante inválidos", () => {
    const leitura = leituraBase();
    expect(() => normalizarParaVersao({ ...leitura, linhas: [{ ...leitura.linhas[0], valorCentavos: "70,00" }] })).toThrow();
    expect(() => normalizarParaVersao({ ...leitura, parcelas: [{ ...leitura.parcelas[0], vencimento: "05/10/2026" }] })).toThrow();
    expect(() => normalizarParaVersao({ ...leitura, canceladoEm: "ontem" })).toThrow();
  });
});

describe("motivoSemCorrecao — UI-D10 e as contas fixas", () => {
  const nenhuma = { temAgenda: false, temQueima: false, temOrcamento: false, temContaFixa: false };

  it("sem origem → null (corrige)", () => {
    expect(motivoSemCorrecao(nenhuma)).toBeNull();
  });

  it("cada origem dá o seu motivo", () => {
    expect(motivoSemCorrecao({ ...nenhuma, temAgenda: true })).toBe("agenda");
    expect(motivoSemCorrecao({ ...nenhuma, temQueima: true })).toBe("queimas");
    expect(motivoSemCorrecao({ ...nenhuma, temOrcamento: true })).toBe("orcamento");
    expect(motivoSemCorrecao({ ...nenhuma, temContaFixa: true })).toBe("conta_fixa");
  });
});
