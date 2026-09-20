import { describe, expect, it } from "vitest";

import { pool } from "@/db";

// Guarda de regressão para .planning/debug/auth-bloqueio-timeout-e2e.md (2026-09-20):
// o `pg-pool` não tem padrão seguro para `connectionTimeoutMillis` — ausente (ou `0`) é
// espera INFINITA por uma conexão livre. Construir um `Pool` não abre conexão nenhuma
// (a conexão real só acontece em `.connect()`/consulta), então este teste roda dentro de
// `npm test` sem precisar de `DATABASE_URL_TESTE`. Prova só a CONFIGURAÇÃO — não o
// comportamento sob contenção real, que exigiria um Postgres de verdade e não reproduziu
// nem sob carga real nem sintética durante o debug (ver seção Evidence daquele arquivo).
describe("db/index — connectionTimeoutMillis do pool", () => {
  it("está definido, finito e maior que zero — nunca ausente/0 (espera infinita)", () => {
    const timeout = pool.options.connectionTimeoutMillis;
    expect(typeof timeout).toBe("number");
    expect(Number.isFinite(timeout)).toBe(true);
    expect(timeout).toBeGreaterThan(0);
  });
});
