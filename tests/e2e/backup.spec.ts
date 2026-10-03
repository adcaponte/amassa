import { test, expect } from "@playwright/test";

import {
  destravarExecucoesBackupDeTeste,
  limparTodasAsExecucoesDeBackup,
  registrarBackup,
  removerBackup,
  travarExecucoesBackupParaTeste,
} from "./apoio/registrar-backup";

const UMA_HORA_EM_MS = 60 * 60 * 1000;

// Prova /api/health/backup nos dois sentidos (BKP-04, 02a-06-PLAN.md): sem registro reprova,
// com registro fresco aprova, backup velho reprova, cópia externa ausente reprova, e a rota
// responde sem sessão — o que permite um monitor externo vigiá-la. Roda em modo serial
// (mode: "serial") porque os casos mutam a mesma tabela global; o advisory lock em
// beforeAll/afterAll serializa também os dois PROJETOS entre si (ver comentário em
// tests/e2e/apoio/registrar-backup.ts).
test.describe("/api/health/backup", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await travarExecucoesBackupParaTeste();
    await limparTodasAsExecucoesDeBackup();
  });

  test.afterAll(async () => {
    await destravarExecucoesBackupDeTeste();
  });

  test("com a tabela vazia, a rota responde 503 e diz que nenhum backup foi registrado", async ({
    request,
  }) => {
    const resposta = await request.get("/api/health/backup");

    expect(resposta.status()).toBe(503);
    const corpo = await resposta.json();
    expect(corpo.status).toBe("erro");
    expect(corpo.motivo).toMatch(/nenhum backup/i);
  });

  test("com backup de duas horas atrás, com sucesso e cópia externa confirmada, a rota responde 200 ok", async ({
    request,
  }) => {
    const id = await registrarBackup({
      quando: new Date(Date.now() - 2 * UMA_HORA_EM_MS),
      sucesso: true,
      destinoExternoOk: true,
    });
    try {
      const resposta = await request.get("/api/health/backup");

      expect(resposta.status()).toBe(200);
      const corpo = await resposta.json();
      expect(corpo.status).toBe("ok");
    } finally {
      await removerBackup(id);
    }
  });

  test("com backup de 27 horas atrás, a rota volta a 503 e o motivo cita a idade", async ({
    request,
  }) => {
    const id = await registrarBackup({
      quando: new Date(Date.now() - 27 * UMA_HORA_EM_MS),
      sucesso: true,
      destinoExternoOk: true,
    });
    try {
      const resposta = await request.get("/api/health/backup");

      expect(resposta.status()).toBe(503);
      const corpo = await resposta.json();
      expect(corpo.status).toBe("erro");
      expect(corpo.idadeEmHoras).toBeGreaterThan(26);
      expect(corpo.motivo).toMatch(/27\.0|hora/i);
    } finally {
      await removerBackup(id);
    }
  });

  test("com backup recente mas cópia externa não confirmada, a rota responde 503", async ({
    request,
  }) => {
    const id = await registrarBackup({
      quando: new Date(Date.now() - 1 * UMA_HORA_EM_MS),
      sucesso: true,
      destinoExternoOk: false,
    });
    try {
      const resposta = await request.get("/api/health/backup");

      expect(resposta.status()).toBe(503);
      const corpo = await resposta.json();
      expect(corpo.status).toBe("erro");
      expect(corpo.motivo).toMatch(/armazenamento externo/i);
    } finally {
      await removerBackup(id);
    }
  });

  // Fase 04.5 (D-28/ORC-16): as fotos dos orçamentos entram na mesma linha de execução do
  // backup — este describe prova que /api/health/backup passa a cobrir isso, sem tocar em
  // nenhum caso existente acima.
  test.describe("fotos", () => {
    test("com o dump ok, mas a cópia externa das fotos falhou, a rota responde 503 citando as fotos, sem nenhum campo de bytes no corpo", async ({
      request,
    }) => {
      const id = await registrarBackup({
        quando: new Date(Date.now() - 1 * UMA_HORA_EM_MS),
        sucesso: true,
        destinoExternoOk: true,
        fotosDestinoExternoOk: false,
      });
      try {
        const resposta = await request.get("/api/health/backup");

        expect(resposta.status()).toBe(503);
        const corpo = await resposta.json();
        expect(corpo.status).toBe("erro");
        expect(corpo.motivo).toMatch(/fotos/i);
        expect(JSON.stringify(corpo)).not.toMatch(/byte/i);
      } finally {
        await removerBackup(id);
      }
    });

    test("com backup recente, cópia externa do dump confirmada e fotos NULAS (linha anterior à Fase 04.5), a rota responde 200 ok", async ({
      request,
    }) => {
      const id = await registrarBackup({
        quando: new Date(Date.now() - 1 * UMA_HORA_EM_MS),
        sucesso: true,
        destinoExternoOk: true,
        fotosDestinoExternoOk: null,
      });
      try {
        const resposta = await request.get("/api/health/backup");

        expect(resposta.status()).toBe(200);
        const corpo = await resposta.json();
        expect(corpo.status).toBe("ok");
        expect(JSON.stringify(corpo)).not.toMatch(/byte/i);
      } finally {
        await removerBackup(id);
      }
    });
  });

  // Fase 06.2 (D-05): os anexos dos fornecedores entram na mesma linha de execução do backup,
  // no molde exato do describe das fotos acima — sem tocar em nenhum caso existente.
  test.describe("anexos", () => {
    test("com o dump e as fotos ok, mas a cópia externa dos anexos falhou, a rota responde 503 citando os anexos, sem nenhum campo de bytes no corpo", async ({
      request,
    }) => {
      const id = await registrarBackup({
        quando: new Date(Date.now() - 1 * UMA_HORA_EM_MS),
        sucesso: true,
        destinoExternoOk: true,
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: false,
      });
      try {
        const resposta = await request.get("/api/health/backup");

        expect(resposta.status()).toBe(503);
        const corpo = await resposta.json();
        expect(corpo.status).toBe("erro");
        expect(corpo.motivo).toMatch(/anexos/i);
        expect(JSON.stringify(corpo)).not.toMatch(/byte/i);
      } finally {
        await removerBackup(id);
      }
    });

    test("com backup recente, dump e fotos confirmados e anexos NULOS (linha anterior à 0028), a rota responde 200 ok", async ({
      request,
    }) => {
      const id = await registrarBackup({
        quando: new Date(Date.now() - 1 * UMA_HORA_EM_MS),
        sucesso: true,
        destinoExternoOk: true,
        fotosDestinoExternoOk: true,
        anexosDestinoExternoOk: null,
      });
      try {
        const resposta = await request.get("/api/health/backup");

        expect(resposta.status()).toBe(200);
        const corpo = await resposta.json();
        expect(corpo.status).toBe("ok");
        expect(JSON.stringify(corpo)).not.toMatch(/byte/i);
      } finally {
        await removerBackup(id);
      }
    });
  });

  test("a rota responde sem nenhum cookie de sessão, pedida por um contexto novo, sem login", async ({
    browser,
  }) => {
    const contextoSemSessao = await browser.newContext();
    try {
      const cookiesAntes = await contextoSemSessao.cookies();
      expect(cookiesAntes).toHaveLength(0);

      // A tabela está vazia neste ponto (limpa pelo `finally` do caso anterior, modo
      // serial) — o que este caso prova não é o valor da resposta, é que ela chegou sem
      // nenhum redirecionamento de autenticação, mesmo sem sessão nenhuma.
      const resposta = await contextoSemSessao.request.get("/api/health/backup");

      expect(resposta.status()).toBe(503);
      expect(resposta.headers()["location"]).toBeUndefined();
      const corpo = await resposta.json();
      expect(corpo.status).toBe("erro");
    } finally {
      await contextoSemSessao.close();
    }
  });
});
