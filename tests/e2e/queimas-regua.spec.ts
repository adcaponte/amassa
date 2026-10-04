import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { hojeNoAtelie } from "./apoio/semear-financeiro";
import {
  lerContagem,
  semearContagem,
  semearForno,
  semearQueimaSemContagem,
} from "./apoio/semear-queimas";

// A régua P · M · G das Queimas em Cadastros → Parâmetros (06.4-03-PLAN.md, Tarefa 3; D-03,
// UI-D11): o grupo "Queimas", sem o selo estimado/medido, com a dica por extenso; mudar grava por
// histórico (linha nova com a data de hoje, a da semente intacta); o servidor recusa P ≥ M e zero; e
// nenhuma contagem já feita muda.
//
// A régua é GLOBAL (`parametros_precificacao`): por isso `@parametro-global` (os projetos
// `parametros-*`, por último e com `workers: 1` — `playwright.config.ts`). Cada projeto mexe numa
// chave só — `parametros-desktop` no P, `parametros-celular` no M (molde da divisão
// argila/esmalte de `precificacao-parametros.spec.ts`) — e as afirmações sobre a dica olham só a
// parte da própria chave, para os dois não se poluírem nem sob `--no-deps`. O `afterAll` devolve o
// valor da semente.

// A semente da 0030 (data fixa do dia em que o dono definiu a régua).
const DATA_DA_SEMENTE = "2026-09-20";
const VALOR_DA_SEMENTE = { queima_regua_p_ate: 10000, queima_regua_m_ate: 25000 } as const;
type ChaveDaRegua = keyof typeof VALOR_DA_SEMENTE;

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

// O valor da linha da chave NAQUELA data (`null` se não há linha) — direto no banco.
async function valorNaData(chave: ChaveDaRegua, data: string): Promise<number | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ valor_inteiro: number }>(
      "select valor_inteiro from parametros_precificacao where chave = $1 and vigente_desde = $2::date",
      [chave, data],
    );
    return rows[0]?.valor_inteiro ?? null;
  });
}

// Devolve a linha de HOJE ao valor da semente (molde `restaurarParametro` de
// `precificacao-parametros.spec.ts`: a gravação de hoje é a única que este spec cria).
async function restaurar(chave: ChaveDaRegua): Promise<void> {
  await comCliente((cliente) =>
    cliente.query(
      "update parametros_precificacao set valor_inteiro = $2 where chave = $1 and vigente_desde = hoje_brasilia()",
      [chave, VALOR_DA_SEMENTE[chave]],
    ),
  );
}

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function chaveDoProjeto(): ChaveDaRegua {
  return test.info().project.name.endsWith("celular") ? "queima_regua_m_ate" : "queima_regua_p_ate";
}

test.describe("régua das queimas @parametro-global", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({}, testInfo) => {
    await restaurar(
      testInfo.project.name.endsWith("celular") ? "queima_regua_m_ate" : "queima_regua_p_ate",
    );
  });

  test("a régua muda por histórico, sem selo, recusa P ≥ M e zero, e não mexe em contagem feita", async ({
    page,
  }) => {
    const chave = chaveDoProjeto();
    const ehP = chave === "queima_regua_p_ate";

    // Uma contagem feita ANTES da mudança — no olho, fica como foi salva.
    const email = process.env.E2E_EMAIL_TESTE ?? "";
    const forno = `[e2e] régua ${test.info().project.name} ${Date.now()}`;
    await semearForno(forno);
    const queimaId = await semearQueimaSemContagem(forno, email);
    await semearContagem(queimaId, { internasP: 7, internasM: 3, externasG: 2 });
    const contagemAntes = await lerContagem(queimaId);

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=parametros");
    await expect(page.getByRole("heading", { name: "Queimas", level: 3 })).toBeVisible();

    const campoP = page.getByTestId("parametro-queima_regua_p_ate");
    const campoM = page.getByTestId("parametro-queima_regua_m_ate");
    await expect(campoP).toContainText("P (pequena) vai até");
    await expect(campoM).toContainText("M (média) vai até — acima disso é G");
    await expect(campoP).toContainText("cm");
    // Sem o selo estimado/medido (não se aplica a uma régua).
    await expect(page.getByTestId("parametro-selo-queima_regua_p_ate")).toHaveCount(0);
    await expect(page.getByTestId("parametro-selo-queima_regua_m_ate")).toHaveCount(0);
    await expect(page.getByTestId("parametros-regua-ausente")).toHaveCount(0);
    await expect(page.getByTestId("parametros-regua-dica")).toContainText(
      "Vale para internas e externas; a contagem é no olho, pela maior medida da peça. Mudar a régua não muda as contagens já feitas.",
    );

    // Mudar a própria chave: P 10 → 12 (desktop) ou M 25 → 30 (celular).
    const meuCampo = (ehP ? campoP : campoM).locator("input");
    await meuCampo.fill(ehP ? "12" : "30");
    await meuCampo.blur();
    // A gravação termina em navegação completa — esperar o carregamento é o que prova que gravou.
    await page.waitForLoadState("load");
    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=parametros$/);
    await expect(meuCampo).toHaveValue(ehP ? "12" : "30", { timeout: 10000 });
    await expect(page.getByTestId("parametros-regua-dica")).toContainText(
      ehP ? "P até 12 cm" : "G maior que 30 cm",
    );
    // Histórico: a linha nova com a data de hoje, a da semente intacta.
    expect(await valorNaData(chave, hojeNoAtelie())).toBe(ehP ? 12000 : 30000);
    expect(await valorNaData(chave, DATA_DA_SEMENTE)).toBe(VALOR_DA_SEMENTE[chave]);

    // P ≥ M: recusado no servidor, e o campo volta ao valor gravado.
    const inputP = campoP.locator("input");
    const pGravado = await inputP.inputValue();
    await inputP.fill("40");
    await inputP.blur();
    await expect(page.getByText("O limite do P precisa ser menor que o do M.")).toBeVisible({
      timeout: 10000,
    });
    await expect(inputP).toHaveValue(pGravado);

    // Zero: recusado, e o campo volta.
    const meuGravado = await meuCampo.inputValue();
    await meuCampo.fill("0");
    await meuCampo.blur();
    await expect(page.getByText("A medida precisa ser maior que zero.")).toBeVisible({
      timeout: 10000,
    });
    await expect(meuCampo).toHaveValue(meuGravado);
    expect(await valorNaData(chave, hojeNoAtelie())).toBe(ehP ? 12000 : 30000);

    // A contagem feita antes continua com os mesmos números.
    expect(await lerContagem(queimaId)).toEqual(contagemAntes);
  });
});
