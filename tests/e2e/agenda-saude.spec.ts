import { test, expect } from "@playwright/test";

// `/api/health/agenda` (plano 05-16): a conferência de fora, DEPOIS do `db:migrate`, do Passo 6
// do Roteiro 17 — 200 prova que o app publicado enxerga a migração 0026. Aqui o Postgres efêmero
// do e2e já a tem (o `test:e2e` aplica todas as migrações), então o caminho provado é o do 200. O
// 503 (banco sem a 0026 — a janela da D-15 entre o deploy e a migração) não é reproduzível sem
// derrubar a estrutura que o resto da suíte usa; ele é o `catch` da rota, no molde exato de
// `/api/health/producao`.
//
// T-05-74: a rota é pública e vigiada por monitor externo — o corpo é exatamente
// `{ status: "ok" }`, sem contagem de pessoas, nome, valor ou nome de banco. O `toEqual` abaixo
// recusa qualquer chave a mais.
test.describe("agenda saude", () => {
  test("sem sessão, /api/health/agenda responde 200 com o corpo exatamente { status: ok }", async ({
    request,
  }) => {
    const resposta = await request.get("/api/health/agenda", { maxRedirects: 0 });

    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["location"]).toBeUndefined();

    const corpo = await resposta.json();
    expect(corpo).toEqual({ status: "ok" });
    expect(Object.keys(corpo)).toEqual(["status"]);
  });
});
