import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import {
  CHIP_DO_SISTEMA,
  LINHA_ITEM_DO_SISTEMA,
  ROTULO_APARECE_NA_VENDA,
  ROTULO_DESATIVAR_ITEM,
  ROTULO_VALOR_NA_HORA,
} from "@/lib/cadastros/textos";

// Fase 5 (plano 05-02, D-17, AGE-17): os três itens que a Agenda acha por código aparecem no
// Catálogo marcados "do sistema"; o dono cadastra o preço da hora do uso livre pelo diálogo de
// sempre; e o diálogo não oferece "Desativar" nem "Aparece na venda" para eles. Os itens vêm da
// semente da 0026 (nunca de dado deste teste) e não se apagam — por isso o teste não cria item
// nenhum e devolve o preço da hora ao nulo no fim (outros specs dependem do "sem preço").
//
// O preço do "Uso livre (hora)" é UM só no banco, e os projetos desktop e celular rodam ao mesmo
// tempo: o caso que o escreve segura um `pg_advisory_lock` dedicado do começo ao fim, para um
// projeto não ler o preço (ou o nulo) que o outro acabou de gravar.

const TRAVA_DO_PRECO_DA_HORA = 5_020_017;

const NOMES_DOS_ITENS_DO_SISTEMA = ["Mensalidade", "Inscrição em oficina", "Uso livre (hora)"];

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function linhaDoCatalogo(page: Page, nome: string) {
  return page.getByTestId("catalogo-item").filter({ has: page.getByText(nome, { exact: true }) });
}

async function abrirEdicao(page: Page, nome: string) {
  await linhaDoCatalogo(page, nome).getByRole("button", { name: "Editar" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  return dialogo;
}

async function estadoDoUsoLivreHora(cliente: Client) {
  const { rows } = await cliente.query<{
    ativo: boolean;
    aparece_na_venda: boolean;
    preco_venda_centavos: number | null;
  }>(
    `select ativo, aparece_na_venda, preco_venda_centavos
       from itens_catalogo where chave_do_sistema = 'uso_livre_hora'`,
  );
  return rows[0];
}

test.describe("cadastros itens da agenda", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=catalogo");
  });

  test("os três itens do sistema aparecem com o chip “do sistema”", async ({ page }) => {
    // `agenda uso livre` (plano 09) renomeia o “Uso livre (hora)” sob a mesma trava, para provar que a
    // Agenda o acha pela chave: este caso lê os nomes segurando-a.
    const trava = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
    await trava.connect();
    await trava.query("select pg_advisory_lock($1)", [TRAVA_DO_PRECO_DA_HORA]);
    try {
      await page.reload();
      for (const nome of NOMES_DOS_ITENS_DO_SISTEMA) {
        const linha = linhaDoCatalogo(page, nome);
        await expect(linha).toHaveCount(1);
        await expect(linha.getByTestId("chip-do-sistema")).toHaveText(CHIP_DO_SISTEMA);
      }
      // Mensalidade e Inscrição em oficina: preço nulo — o valor vem da turma e do evento.
      for (const nome of ["Mensalidade", "Inscrição em oficina"]) {
        await expect(linhaDoCatalogo(page, nome)).toContainText(ROTULO_VALOR_NA_HORA);
      }
    } finally {
      await trava.query("select pg_advisory_unlock($1)", [TRAVA_DO_PRECO_DA_HORA]);
      await trava.end();
    }
  });

  test("o diálogo de Mensalidade não tem Desativar nem “Aparece na venda”", async ({ page }) => {
    const dialogo = await abrirEdicao(page, "Mensalidade");
    await expect(dialogo.getByText(LINHA_ITEM_DO_SISTEMA)).toBeVisible();
    await expect(dialogo.getByRole("button", { name: ROTULO_DESATIVAR_ITEM })).toHaveCount(0);
    await expect(dialogo.getByTestId("catalogo-desativar")).toHaveCount(0);
    await expect(dialogo.getByText(ROTULO_APARECE_NA_VENDA, { exact: true })).toHaveCount(0);
    // O resto do diálogo continua: nome e preço editáveis.
    await expect(dialogo.getByLabel("Preço de venda")).toBeVisible();
  });

  test("o dono cadastra o preço da hora do uso livre; o item continua ativo e na venda", async ({
    page,
  }) => {
    const trava = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
    await trava.connect();
    await trava.query("select pg_advisory_lock($1)", [TRAVA_DO_PRECO_DA_HORA]);
    try {
      // Um preço qualquer, diferente por projeto — o teste não afirma o número do protótipo.
      const centavos = test.info().project.name.includes("celular") ? 4321 : 1234;
      const textoDoPreco = (centavos / 100).toFixed(2).replace(".", ",");

      await page.reload();
      const dialogo = await abrirEdicao(page, "Uso livre (hora)");
      await expect(dialogo.getByText(LINHA_ITEM_DO_SISTEMA)).toBeVisible();
      await dialogo.getByLabel("Preço de venda").fill(textoDoPreco);
      await dialogo.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await expect(linhaDoCatalogo(page, "Uso livre (hora)")).toContainText(textoDoPreco);
      await expect(linhaDoCatalogo(page, "Uso livre (hora)").getByTestId("chip-do-sistema")).toBeVisible();

      // Pelo banco: salvar o diálogo não desativou nem tirou da venda (a tela não oferece, e
      // `editarItem` ignora `aparecenaVenda` de item com chave).
      const estado = await estadoDoUsoLivreHora(trava);
      expect(estado).toEqual({ ativo: true, aparece_na_venda: true, preco_venda_centavos: centavos });
    } finally {
      // Devolve o preço ao nulo (o gatilho deixa mudar preço) e solta a trava.
      await trava.query(
        "update itens_catalogo set preco_venda_centavos = null where chave_do_sistema = 'uso_livre_hora'",
      );
      await trava.query("select pg_advisory_unlock($1)", [TRAVA_DO_PRECO_DA_HORA]);
      await trava.end();
    }
  });
});
