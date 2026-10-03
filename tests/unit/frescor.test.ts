import { describe, expect, it } from "vitest";
import {
  JANELA_EM_HORAS,
  decidirFrescorDoBackup,
  type ExecucaoBackup,
} from "../../lib/backup/frescor";

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

  // --- Fase 06.2 (D-05): a ordem de decisão inteira com os anexos, uma linha da ordem por caso.
  // Ordem: relógio no futuro → execução sem sucesso → destino do dump → fotos → ANEXOS → idade. ---
  describe("ordem de decisão com anexosDestinoExternoOk", () => {
    const FRASE_ANEXOS = "A cópia externa dos anexos dos fornecedores falhou na última execução.";

    function linha(parcial: Partial<ExecucaoBackup>): ExecucaoBackup {
      return {
        quando: horasAtras(1),
        sucesso: true,
        destinoExternoOk: true,
        mensagem: null,
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: true,
        ...parcial,
      };
    }

    it("relógio no futuro vence anexos false", () => {
      const decisao = decidirFrescorDoBackup(
        linha({ quando: horasAtras(-1), anexosDestinoExternoOk: false }),
        AGORA,
      );

      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toMatch(/futuro|relógio/i);
      expect(decisao.motivo).not.toMatch(/anexos/i);
    });

    it("execução sem sucesso vence anexos false", () => {
      const decisao = decidirFrescorDoBackup(
        linha({
          sucesso: false,
          mensagem: "Envio dos anexos dos fornecedores ao destino externo falhou: x",
          anexosDestinoExternoOk: false,
        }),
        AGORA,
      );

      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toMatch(/^A última execução do backup falhou\./);
      expect(decisao.motivo).not.toBe(FRASE_ANEXOS);
    });

    it("destino externo do DUMP false vence anexos false", () => {
      const decisao = decidirFrescorDoBackup(
        linha({ destinoExternoOk: false, anexosDestinoExternoOk: false }),
        AGORA,
      );

      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toMatch(/armazenamento externo/i);
      expect(decisao.motivo).not.toMatch(/anexos/i);
    });

    it("fotos false vence anexos false", () => {
      const decisao = decidirFrescorDoBackup(
        linha({ fotosDestinoExternoOk: false, anexosDestinoExternoOk: false }),
        AGORA,
      );

      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toMatch(/fotos/i);
      expect(decisao.motivo).not.toMatch(/anexos/i);
    });

    it("anexos false vence a idade acima de 26 h — a frase é a dos anexos, não a das horas", () => {
      const decisao = decidirFrescorDoBackup(
        linha({ quando: horasAtras(30), anexosDestinoExternoOk: false }),
        AGORA,
      );

      expect(decisao.status).toBe("erro");
      expect(decisao.http).toBe(503);
      expect(decisao.motivo).toBe(FRASE_ANEXOS);
      expect(decisao.idadeEmHoras).toBe(30);
    });

    it("anexos false com fotos nulas (linha nova, fotos sem tentativa): ainda a frase dos anexos", () => {
      const decisao = decidirFrescorDoBackup(
        linha({ fotosDestinoExternoOk: null, anexosDestinoExternoOk: false }),
        AGORA,
      );

      expect(decisao.motivo).toBe(FRASE_ANEXOS);
    });

    // As linhas antigas da ordem (cada caso acima da Fase 06.2): com anexos `true` ou `null`, a
    // decisão é idêntica, campo a campo, e é a que cada linha já tinha.
    const LINHAS_ANTIGAS: Array<[string, Omit<ExecucaoBackup, "anexosDestinoExternoOk">, 200 | 503]> = [
      ["recente e tudo confirmado", linha({}), 200],
      ["25h59, dentro da janela", linha({ quando: horasAtras(25 + 59 / 60) }), 200],
      ["26h01, fora da janela", linha({ quando: horasAtras(26 + 1 / 60) }), 503],
      ["relógio no futuro", linha({ quando: horasAtras(-1) }), 503],
      ["sem sucesso", linha({ sucesso: false, destinoExternoOk: false, mensagem: "disco cheio" }), 503],
      ["dump sem destino", linha({ destinoExternoOk: false }), 503],
      ["fotos false", linha({ fotosDestinoExternoOk: false }), 503],
      ["fotos nulas e recente", linha({ fotosDestinoExternoOk: null }), 200],
      ["fotos nulas e 27h", linha({ quando: horasAtras(27), fotosDestinoExternoOk: null }), 503],
    ];

    it.each(LINHAS_ANTIGAS)(
      "anexos true e null não mudam a decisão da linha antiga: %s",
      (_rotulo, base, httpEsperado) => {
        const comTrue = decidirFrescorDoBackup({ ...base, anexosDestinoExternoOk: true }, AGORA);
        const comNull = decidirFrescorDoBackup({ ...base, anexosDestinoExternoOk: null }, AGORA);

        expect(comTrue).toEqual(comNull);
        expect(comTrue.http).toBe(httpEsperado);
        expect(comTrue.motivo).not.toMatch(/anexos/i);
      },
    );
  });
});
