import { describe, expect, it } from "vitest";
import { JANELA_EM_HORAS, decidirFrescorDoBackup } from "../../lib/backup/frescor";

const UMA_HORA_EM_MS = 60 * 60 * 1000;
const AGORA = new Date("2026-08-08T12:00:00.000Z");

function horasAtras(horas: number): Date {
  return new Date(AGORA.getTime() - horas * UMA_HORA_EM_MS);
}

describe("decidirFrescorDoBackup", () => {
  it("nenhuma linha: erro, 503, motivo dizendo que nenhum backup foi registrado", () => {
    const decisao = decidirFrescorDoBackup(null, AGORA);

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/nenhum backup/i);
  });

  it("sucesso, cópia externa confirmada, 2 horas atrás: ok, 200", () => {
    const decisao = decidirFrescorDoBackup(
      { quando: horasAtras(2), sucesso: true, destinoExternoOk: true, mensagem: null },
      AGORA,
    );

    expect(decisao.status).toBe("ok");
    expect(decisao.http).toBe(200);
  });

  it("sucesso, cópia externa confirmada, 25h59 atrás (fronteira dentro da janela): ok, 200", () => {
    const decisao = decidirFrescorDoBackup(
      {
        quando: horasAtras(25 + 59 / 60),
        sucesso: true,
        destinoExternoOk: true,
        mensagem: null,
      },
      AGORA,
    );

    expect(decisao.status).toBe("ok");
    expect(decisao.http).toBe(200);
  });

  it("sucesso, cópia externa confirmada, 26h01 atrás (fronteira fora da janela): erro, 503, motivo cita as horas", () => {
    const decisao = decidirFrescorDoBackup(
      {
        quando: horasAtras(26 + 1 / 60),
        sucesso: true,
        destinoExternoOk: true,
        mensagem: null,
      },
      AGORA,
    );

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/26/);
    expect(decisao.motivo).toMatch(/hora/i);
  });

  it("linha recente com sucesso falso: erro, 503, motivo dizendo que a última execução falhou e repetindo a mensagem registrada", () => {
    const decisao = decidirFrescorDoBackup(
      {
        quando: horasAtras(1),
        sucesso: false,
        destinoExternoOk: false,
        mensagem: "disco cheio durante o pg_dump",
      },
      AGORA,
    );

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/falhou/i);
    expect(decisao.motivo).toMatch(/disco cheio durante o pg_dump/);
  });

  it("linha recente, com sucesso, mas cópia externa não confirmada: erro, 503, motivo dizendo que o dump não chegou ao armazenamento externo", () => {
    const decisao = decidirFrescorDoBackup(
      { quando: horasAtras(1), sucesso: true, destinoExternoOk: false, mensagem: null },
      AGORA,
    );

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/armazenamento externo/i);
  });

  it("linha com quando no futuro (relógio errado): erro, 503, com motivo próprio", () => {
    const decisao = decidirFrescorDoBackup(
      { quando: horasAtras(-1), sucesso: true, destinoExternoOk: true, mensagem: null },
      AGORA,
    );

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/futuro|relógio/i);
  });

  it("a janela é de 26 horas", () => {
    expect(JANELA_EM_HORAS).toBe(26);
  });

  it("motivo nunca traz o código de status como texto", () => {
    const decisao = decidirFrescorDoBackup(null, AGORA);
    expect(decisao.motivo).not.toMatch(/503/);
  });
});
