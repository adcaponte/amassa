import { describe, expect, it } from "vitest";

import { agoraEmBrasilia, hojeEmBrasilia } from "@/lib/financeiro/formato";

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
