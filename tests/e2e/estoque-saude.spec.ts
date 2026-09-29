import { test, expect } from "@playwright/test";

// `/api/health/estoque` (plano 06-11): a conferência de fora, DEPOIS do código, do Passo 7 do
// Roteiro 15 — 200 prova que o app publicado enxerga a migração 0023. Aqui o Postgres efêmero do
// e2e já tem a 0023 (o `test:e2e` aplica todas as migrações), então o caminho provado é o do 200.
// O 503 (banco sem a 0023) não é reproduzível sem derrubar a estrutura que o resto da suíte usa;
// ele é o `catch` da rota, no molde exato de `/api/health/backup`.
//
// T-06-49: a rota é pública e vigiada por monitor externo — o corpo é exatamente `{ status: "ok" }`,
// sem contagem, saldo, valor ou nome de banco. O `toEqual` abaixo recusa qualquer chave a mais.
test.describe("estoque saude", () => {
  test("sem sessão, /api/health/estoque responde 200 com o corpo exatamente { status: ok }", async ({
    request,
  }) => {
    const resposta = await request.get("/api/health/estoque", { maxRedirects: 0 });

    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["location"]).toBeUndefined();

    const corpo = await resposta.json();
    expect(corpo).toEqual({ status: "ok" });
    expect(Object.keys(corpo)).toEqual(["status"]);
  });
});
