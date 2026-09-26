import { describe, expect, it } from "vitest";

import { diasDeValidadeRestantes, situacaoDoOrcamento } from "@/lib/orcamentos/situacao";

// 04.5-08-PLAN.md, Tarefa 1 — "como a expiração se calcula": `situacaoDoOrcamento` é a ÚNICA
// função que decide o chip (D-22, expirado é DERIVADO, nunca um status gravado). Nenhum dado real
// de cliente entra aqui — só datas e status ilustrativos.

describe("situacaoDoOrcamento", () => {
  it("rascunho devolve a forma neutra 'rascunho', independentemente da data", () => {
    expect(
      situacaoDoOrcamento({ status: "rascunho", data: "2026-01-01", validadeDias: 10 }, "2026-09-26"),
    ).toEqual({ semantica: "neutra", rotulo: "rascunho" });
  });

  it("enviado com 10 dias de validade, 3 dias depois da data, devolve âmbar com 'enviado · vale mais 7 dia(s)'", () => {
    expect(
      situacaoDoOrcamento({ status: "enviado", data: "2026-09-01", validadeDias: 10 }, "2026-09-04"),
    ).toEqual({ semantica: "atencao", rotulo: "enviado · vale mais 7 dia(s)" });
  });

  it("no último dia da validade, ainda devolve âmbar", () => {
    expect(
      situacaoDoOrcamento({ status: "enviado", data: "2026-09-01", validadeDias: 10 }, "2026-09-11"),
    ).toEqual({ semantica: "atencao", rotulo: "enviado · vale mais 0 dia(s)" });
  });

  it("um dia depois do último dia da validade, devolve vermelho com 'expirou há 1 dia(s)'", () => {
    expect(
      situacaoDoOrcamento({ status: "enviado", data: "2026-09-01", validadeDias: 10 }, "2026-09-12"),
    ).toEqual({ semantica: "erro", rotulo: "expirou há 1 dia(s)" });
  });

  it("aprovado devolve verde 'aprovado', mesmo com a validade vencida há muito tempo", () => {
    expect(
      situacaoDoOrcamento({ status: "aprovado", data: "2020-01-01", validadeDias: 10 }, "2026-09-26"),
    ).toEqual({ semantica: "sucesso", rotulo: "aprovado" });
  });

  it("recusado devolve vermelho 'recusado', mesmo com a validade vencida há muito tempo", () => {
    expect(
      situacaoDoOrcamento({ status: "recusado", data: "2020-01-01", validadeDias: 10 }, "2026-09-26"),
    ).toEqual({ semantica: "erro", rotulo: "recusado" });
  });
});

describe("diasDeValidadeRestantes", () => {
  it("conta em dias civis, sem fuso: o mesmo par de datas devolve o mesmo número, chamado várias vezes", () => {
    const primeiraChamada = diasDeValidadeRestantes("2026-09-01", 10, "2026-09-04");
    const segundaChamada = diasDeValidadeRestantes("2026-09-01", 10, "2026-09-04");

    expect(primeiraChamada).toBe(7);
    expect(segundaChamada).toBe(7);
  });

  it("atravessa virada de mês corretamente", () => {
    expect(diasDeValidadeRestantes("2026-09-25", 10, "2026-10-01")).toBe(4);
  });
});
