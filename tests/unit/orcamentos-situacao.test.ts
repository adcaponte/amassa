import { describe, expect, it } from "vitest";

import {
  diasDeValidadeRestantes,
  situacaoDoOrcamento,
  vereditoDaAprovacao,
} from "@/lib/orcamentos/situacao";

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

// 04.5-14, achado 14 da verificação humana: "na produção ela fica cancelada e vai pro historico,
// mas tambem segue em verde com 'ordem aberta na Produção'". A pergunta que o veredito fazia era
// "o id existe?"; a que ele precisava fazer é "a ordem está aberta?".
describe("vereditoDaAprovacao", () => {
  const ID = "11111111-1111-1111-1111-111111111111";

  it("sem encomenda vinculada, não há ordem para afirmar — e o bloco continua verde", () => {
    expect(vereditoDaAprovacao({ encomendaId: null, encomendaStatus: null, vendaCancelada: false })).toEqual({
      ordemAberta: false,
      ordemCancelada: false,
      semantica: "sucesso",
    });
  });

  it("encomenda em produção: a ordem está aberta e o bloco é verde", () => {
    expect(
      vereditoDaAprovacao({ encomendaId: ID, encomendaStatus: "em_producao", vendaCancelada: false }),
    ).toEqual({ ordemAberta: true, ordemCancelada: false, semantica: "sucesso" });
  });

  it("🔴 encomenda cancelada: a ordem NÃO está aberta, e o bloco deixa de ser verde", () => {
    expect(
      vereditoDaAprovacao({ encomendaId: ID, encomendaStatus: "cancelada", vendaCancelada: false }),
    ).toEqual({ ordemAberta: false, ordemCancelada: true, semantica: "atencao" });
  });

  it("encomenda concluída: a ordem não está mais aberta, mas isso não é um aviso — é um fim feliz", () => {
    expect(
      vereditoDaAprovacao({ encomendaId: ID, encomendaStatus: "concluida", vendaCancelada: false }),
    ).toEqual({ ordemAberta: false, ordemCancelada: false, semantica: "sucesso" });
  });

  it("encomenda em rascunho conta como aberta — não foi cancelada nem concluída", () => {
    expect(
      vereditoDaAprovacao({ encomendaId: ID, encomendaStatus: "rascunho", vendaCancelada: false }),
    ).toEqual({ ordemAberta: true, ordemCancelada: false, semantica: "sucesso" });
  });

  it("venda cancelada sozinha já rebaixa o bloco, mesmo com a ordem aberta (D-25)", () => {
    expect(
      vereditoDaAprovacao({ encomendaId: ID, encomendaStatus: "em_producao", vendaCancelada: true }),
    ).toEqual({ ordemAberta: true, ordemCancelada: false, semantica: "atencao" });
  });

  it("id sem status conhecido nunca é tratado como aberta", () => {
    expect(vereditoDaAprovacao({ encomendaId: ID, encomendaStatus: null, vendaCancelada: false })).toEqual({
      ordemAberta: false,
      ordemCancelada: false,
      semantica: "sucesso",
    });
  });
});
