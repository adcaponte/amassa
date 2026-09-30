import { test, expect } from "@playwright/test";

// `/api/health/producao` (plano 06.1-15): a conferência de fora, DEPOIS do `db:migrate`, do Passo
// 6 do Roteiro 16 — 200 prova que o app publicado enxerga as migrações 0024 e 0025. Aqui o
// Postgres efêmero do e2e já tem as duas (o `test:e2e` aplica todas as migrações), então o caminho
// provado é o do 200. O 503 (banco sem a 0024 — a janela do D-09 entre o deploy e a migração) não
// é reproduzível sem derrubar a estrutura que o resto da suíte usa; ele é o `catch` da rota, no
// molde exato de `/api/health/estoque`.
//
// T-06.1-56: a rota é pública e vigiada por monitor externo — o corpo é exatamente
// `{ status: "ok" }`, sem contagem de ordens, nome, valor ou nome de banco. O `toEqual` abaixo
// recusa qualquer chave a mais.
test.describe("producao saude", () => {
  test("sem sessão, /api/health/producao responde 200 com o corpo exatamente { status: ok }", async ({
    request,
  }) => {
    const resposta = await request.get("/api/health/producao", { maxRedirects: 0 });

    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["location"]).toBeUndefined();

    const corpo = await resposta.json();
    expect(corpo).toEqual({ status: "ok" });
    expect(Object.keys(corpo)).toEqual(["status"]);
  });
});
