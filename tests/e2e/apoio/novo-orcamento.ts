// “Novo orçamento” do jeito de depois do 06.5-14 (D-15): o botão só abre o orçamento vazio
// (`?aba=orcamentos&orcamento=novo`), e o registro nasce ao sair do primeiro campo preenchido. Todo
// spec que precisa de um orçamento criado pela tela passa por aqui — antes, cada um tocava o botão
// e esperava o editor na hora, o que deixou de existir.
import { expect, type Locator, type Page } from "@playwright/test";

const URL_DO_ORCAMENTO_CRIADO =
  /\/gestao\/financeiro\?aba=orcamentos&orcamento=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// O `onBlur` só existe depois que o React hidrata o campo. Sair do campo antes disso não dispara
// nada, e o teste esperaria a URL à toa. O React pendura as props no elemento (`__reactProps$…`)
// ao hidratar: é o sinal determinístico, sem `waitForTimeout`.
export async function esperarHidratacao(campo: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        campo.evaluate((elemento) =>
          Object.keys(elemento).some((chave) => chave.startsWith("__reactProps$")),
        ),
      { message: "o campo não hidratou" },
    )
    .toBe(true);
}

// Da lista para o orçamento vazio, pelo botão — e espera o conteúdo real (não o esqueleto do
// `loading.tsx`) e a hidratação do campo Cliente.
export async function abrirOrcamentoNovo(page: Page): Promise<void> {
  await page.goto("/gestao/financeiro?aba=orcamentos");
  await page
    .getByTestId("orcamentos-lista")
    .getByRole("link", { name: "Novo orçamento" })
    .click();
  await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=orcamentos&orcamento=novo$/);
  await expect(page.getByTestId("orcamento-nao-salvo")).toBeVisible();
  await esperarHidratacao(page.getByTestId("orcamento-campo-cliente"));
}

// Toca “Novo orçamento”, preenche o primeiro campo (o Cliente, ou o Título para quem precisa do
// cliente vazio), sai dele e espera o editor do orçamento criado. Devolve o id.
export async function criarOrcamentoPelaTela(
  page: Page,
  texto: string,
  { campo = "cliente" }: { campo?: "cliente" | "titulo" } = {},
): Promise<string> {
  await abrirOrcamentoNovo(page);
  const alvo = page.getByTestId(
    campo === "cliente" ? "orcamento-campo-cliente" : "orcamento-campo-titulo",
  );
  await alvo.fill(texto);
  await alvo.blur();
  await expect(page).toHaveURL(URL_DO_ORCAMENTO_CRIADO, { timeout: 15000 });
  await expect(page.getByTestId("orcamento-cabecalho")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("orcamento") ?? "";
  expect(id).not.toBe("");
  return id;
}
