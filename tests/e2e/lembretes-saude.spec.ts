import { test, expect } from "@playwright/test";

// `/api/health/lembretes` (plano 06.3-02): a conferência de fora, DEPOIS do `db:migrate`, do
// Roteiro 20 — 200 prova que o app publicado enxerga a migração 0029. Aqui o Postgres efêmero do
// e2e já a tem (o `test:e2e` aplica todas as migrações), então o caminho provado é o do 200. O 503
// (banco sem a 0029 — a janela entre o deploy e a migração) não é reproduzível sem derrubar a
// estrutura que o resto da suíte usa; ele é o `catch` da rota, no molde exato de
// `/api/health/fornecedores`.
//
// T-06.3-08: a rota é pública e vigiada por monitor externo — o corpo é exatamente
// `{ status: "ok" }`, sem contagem de lembretes, texto, nome, data ou nome de banco. O `toEqual`
// abaixo recusa qualquer chave a mais. O `request` do Playwright nasce num contexto novo, sem o
// `storageState` da sessão: a rota responde sem login.
test.describe("lembretes saude", () => {
  test("sem sessão, /api/health/lembretes responde 200 com o corpo exatamente { status: ok }", async ({
    playwright,
    baseURL,
  }) => {
    const semSessao = await playwright.request.newContext({ baseURL });
    try {
      const resposta = await semSessao.get("/api/health/lembretes", { maxRedirects: 0 });

      expect(resposta.status()).toBe(200);
      expect(resposta.headers()["location"]).toBeUndefined();

      const corpo = await resposta.json();
      expect(corpo).toEqual({ status: "ok" });
      expect(Object.keys(corpo)).toEqual(["status"]);
    } finally {
      await semSessao.dispose();
    }
  });
});
