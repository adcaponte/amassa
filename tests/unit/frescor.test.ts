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
      {
        quando: horasAtras(2),
        sucesso: true,
        destinoExternoOk: true,
        mensagem: null,
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: null,
      },
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
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: null,
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
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: null,
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
        fotosDestinoExternoOk: false,
        anexosDestinoExternoOk: null,
      },
      AGORA,
    );

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/falhou/i);
    expect(decisao.motivo).toMatch(/disco cheio durante o pg_dump/);
  });

  it("linha recente, com sucesso, mas cópia externa do DUMP não confirmada: erro, 503, motivo dizendo que o dump não chegou ao armazenamento externo", () => {
    const decisao = decidirFrescorDoBackup(
      {
        quando: horasAtras(1),
        sucesso: true,
        destinoExternoOk: false,
        mensagem: null,
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: null,
      },
      AGORA,
    );

    expect(decisao.status).toBe("erro");
    expect(decisao.http).toBe(503);
    expect(decisao.motivo).toMatch(/armazenamento externo/i);
  });

  it("linha com quando no futuro (relógio errado): erro, 503, com motivo próprio", () => {
    const decisao = decidirFrescorDoBackup(
      {
        quando: horasAtras(-1),
        sucesso: true,
        destinoExternoOk: true,
        mensagem: null,
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: null,
      },
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

  // --- Fase 04.5 (D-28/ORC-16): as fotos dos orçamentos entram na mesma linha de execução. ---
  describe("fotosDestinoExternoOk", () => {
    it("dump ok, fotos com cópia externa NÃO confirmada (false): erro, 503, motivo cita as fotos", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: false,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.status).toBe("erro");
      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toMatch(/fotos/i);
    });

    it("dump ok, fotos confirmadas (true): ok, 200", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: true,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.status).toBe("ok");
      expect(decisao.http).toBe(200);
    });

    it("dump ok, fotos nulas (linha escrita antes da Fase 04.5): ok, 200 — nulo nunca é falha", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: null,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.status).toBe("ok");
      expect(decisao.http).toBe(200);
    });

    it("fotos nulas e backup velho (27h): erro, 503, motivo cita a idade — nulo cai na checagem seguinte, não vira exceção", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(27),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: null,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.status).toBe("erro");
      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toMatch(/hora/i);
    });

    it("ordem de avaliação: sucesso falso vence sobre fotos falsas — motivo é o de sucesso, não o de fotos", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: false,
          destinoExternoOk: false,
          mensagem: "disco cheio durante o pg_dump",
          fotosDestinoExternoOk: false,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.motivo).toMatch(/falhou/i);
      expect(decisao.motivo).not.toMatch(/fotos/i);
    });

    it("ordem de avaliação: destino externo do DUMP falso vence sobre fotos falsas — motivo é o do dump, não o de fotos", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: false,
          mensagem: null,
          fotosDestinoExternoOk: false,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.motivo).toMatch(/armazenamento externo/i);
      expect(decisao.motivo).not.toMatch(/fotos/i);
    });
  });

  // --- Fase 06.2 (D-05): os anexos dos fornecedores entram na mesma linha de execução, no molde
  // exato das fotos. Os casos acima continuam com `anexosDestinoExternoOk: null` (a forma de uma
  // linha anterior à 0028), o que deixa a decisão de cada um exatamente como era. ---
  describe("anexosDestinoExternoOk", () => {
    it("dump ok, fotos ok, anexos com cópia externa NÃO confirmada (false): erro, 503, com a frase dos anexos", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: true,
          anexosDestinoExternoOk: false,
        },
        AGORA,
      );

      expect(decisao.status).toBe("erro");
      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toBe(
        "A cópia externa dos anexos dos fornecedores falhou na última execução.",
      );
      expect(decisao.ultimoBackupEm).toBe(horasAtras(1).toISOString());
    });

    it("dump ok, fotos ok, anexos nulos (linha escrita antes da 0028): ok, 200 — nulo nunca é falha", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: true,
          anexosDestinoExternoOk: null,
        },
        AGORA,
      );

      expect(decisao.status).toBe("ok");
      expect(decisao.http).toBe(200);
    });

    it("fotos falsas E anexos falsos: a frase é a das FOTOS — o ramo das fotos vem antes", () => {
      const decisao = decidirFrescorDoBackup(
        {
          quando: horasAtras(1),
          sucesso: true,
          destinoExternoOk: true,
          mensagem: null,
          fotosDestinoExternoOk: false,
          anexosDestinoExternoOk: false,
        },
        AGORA,
      );

      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toBe(
        "A cópia externa das fotos dos orçamentos falhou na última execução.",
      );
      expect(decisao.motivo).not.toMatch(/anexos/i);
    });
  });
});
