import { describe, expect, it } from "vitest";

import { agoraEmBrasilia, hojeEmBrasilia, nomeDoMes, nomeDoMesNoTitulo } from "@/lib/financeiro/formato";

// O "agora" do ateliê: a data civil e os minutos do dia em America/Sao_Paulo, a partir de um instante
// recebido por argumento — nunca o relógio do runtime nem o fuso do servidor (o Postgres roda em UTC).
describe("agoraEmBrasilia", () => {
  it("23:30 em Brasília ainda é o dia anterior ao do UTC", () => {
    expect(agoraEmBrasilia(new Date("2026-10-02T02:30:00Z"))).toEqual({ data: "2026-10-01", minutos: 1410 });
  });

  it("meia-noite em Brasília é minuto 0 do dia novo (nunca 24:00)", () => {
    expect(agoraEmBrasilia(new Date("2026-10-02T03:00:00Z"))).toEqual({ data: "2026-10-02", minutos: 0 });
  });

  it("23:59 em Brasília é o minuto 1439", () => {
    expect(agoraEmBrasilia(new Date("2026-10-02T02:59:59Z"))).toEqual({ data: "2026-10-01", minutos: 1439 });
  });

  it("14:05 da tarde", () => {
    expect(agoraEmBrasilia(new Date("2026-12-18T17:05:00Z"))).toEqual({ data: "2026-12-18", minutos: 845 });
  });

  it("concorda com hojeEmBrasilia no mesmo instante", () => {
    const instante = new Date("2026-10-31T23:45:00Z");
    expect(agoraEmBrasilia(instante).data).toBe(hojeEmBrasilia(instante));
  });
});

// O mês como título (D-14, achado 21): só a primeira letra sobe; o "de" fica minúsculo. No meio de
// frase, `nomeDoMes` continua todo em minúsculas.
describe("nomeDoMesNoTitulo", () => {
  it("outubro de 2026 → Outubro de 2026", () => {
    expect(nomeDoMesNoTitulo("2026-10")).toBe("Outubro de 2026");
  });

  it("o acento de março não muda", () => {
    expect(nomeDoMesNoTitulo("2027-03")).toBe("Março de 2027");
  });

  it("janeiro do ano seguinte", () => {
    expect(nomeDoMesNoTitulo("2027-01")).toBe("Janeiro de 2027");
  });

  it("o nome do meio de frase continua minúsculo", () => {
    expect(nomeDoMes("2026-10")).toBe("outubro de 2026");
  });
});
