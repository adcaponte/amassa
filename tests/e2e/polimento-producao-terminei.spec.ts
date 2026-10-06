import { test, expect, type Page, type Route } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import {
  diaEmBrasilia,
  etapasDaOrdemNoBanco,
  semearOrdem,
  type OrdemParaSemear,
} from "./apoio/semear-producao";

// Fase 06.5, plano 06 (POL-04; D-02 e UI-D12, decididos pelo dono em 05/10/2026; achado 13 do
// Cowork): "Terminei: {etapa}" só quando todas as peças passaram pela etapa — no botão e no
// servidor. Com mais de uma peça e o parcial vazio ou menor que o total, o botão fica desabilitado
// com o motivo embaixo; a tela velha de outro celular recebe a recusa do servidor, sem gravar. A
// ordem de uma peça não muda. Cada teste semeia a PRÓPRIA ordem com nome único e a acha pelo id —
// nenhuma afirmação global do banco. Nomes inventados com prefixo `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(base: string): string {
  const sufixo = `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return `[e2e] ${base} ${sufixo}`;
}

// Uma ordem da casa, ativa, na Secagem (a Produção feita ontem).
function semearNaSecagem(nome: string, dados: Partial<OrdemParaSemear> = {}): Promise<string> {
  return semearOrdem({
    nome,
    tipo: "casa",
    caminho: "completo",
    status: "ativa",
    inicio: diaEmBrasilia(-3),
    etapasFeitas: [{ etapa: "producao", feitaEm: diaEmBrasilia(-1) }],
    pecas: [{ descricao: `${nome} · caneca`, quantidade: 6 }],
    ...dados,
  });
}

async function secagemNoBanco(ordemId: string) {
  const linha = (await etapasDaOrdemNoBanco(ordemId)).find((etapa) => etapa.etapa === "secagem");
  if (!linha) {
    throw new Error("a secagem não está no banco");
  }
  return linha;
}

// A página da ordem tem `loading.tsx` (streaming): espera a trilha de verdade antes de afirmar.
async function abrirOrdem(page: Page, ordemId: string) {
  await page.goto(`/gestao/producao/${ordemId}`);
  await expect(page.getByTestId("ordem-etapa-secagem")).toHaveAttribute("data-estado", "atual");
}

async function gravarParcial(page: Page, ordemId: string, valor: number) {
  const campo = page.getByTestId("ordem-parcial");
  await campo.fill(String(valor));
  await campo.press("Enter");
  await expect.poll(async () => (await secagemNoBanco(ordemId)).passaram).toBe(valor);
}

test.describe("polimento produção — terminei", () => {
  test("(a) 6 peças: “Terminei” desabilitado com o motivo até o parcial chegar a 6", async ({
    page,
  }) => {
    const ordemId = await semearNaSecagem(nomeUnico("Terminei seis"));

    await fazerLogin(page);
    await abrirOrdem(page, ordemId);

    const terminei = page.getByTestId("ordem-terminei");
    const motivo = page.getByTestId("terminei-motivo");

    // Campo vazio: desabilitado, visível, 52 px, e o motivo ligado por `aria-describedby`.
    await expect(terminei).toHaveText("Terminei: Secagem");
    await expect(terminei).toBeDisabled();
    await expect(motivo).toHaveText(
      "Diga quantas das 6 peças já passaram pela Secagem — a etapa só termina quando todas passarem.",
    );
    await expect(terminei).toHaveAttribute("aria-describedby", "terminei-motivo");
    await expect(terminei).toHaveAccessibleDescription(
      "Diga quantas das 6 peças já passaram pela Secagem — a etapa só termina quando todas passarem.",
    );
    await expect(motivo).toHaveClass(/text-tinta-fraca/);
    await expect(page.getByTestId("ordem-parcial")).toHaveValue("");

    // Parcial 4: faltam 2 (plural); 5: falta 1 (singular).
    await gravarParcial(page, ordemId, 4);
    await expect(motivo).toHaveText("Faltam 2 das 6 peças passarem pela Secagem.");
    await expect(terminei).toBeDisabled();
    await gravarParcial(page, ordemId, 5);
    await expect(motivo).toHaveText("Falta 1 das 6 peças passar pela Secagem.");
    await expect(terminei).toBeDisabled();

    // Parcial 6: habilita, o motivo some, e o toque avança a etapa.
    await gravarParcial(page, ordemId, 6);
    await expect(terminei).toBeEnabled();
    await expect(motivo).toHaveCount(0);
    await expect(terminei).not.toHaveAttribute("aria-describedby");
    await terminei.click();
    await expect(page.getByText("Feito: Secagem. Agora: Queima de biscoito.")).toBeVisible();
    await expect(page.getByTestId("ordem-etapa-queima1")).toHaveAttribute("data-estado", "atual");
    expect((await secagemNoBanco(ordemId)).feitaEm).toBe(diaEmBrasilia());

    // A etapa nova começa sem parcial: o "Terminei" dela volta a esperar as 6.
    await expect(page.getByTestId("ordem-terminei")).toHaveText("Terminei: Queima de biscoito");
    await expect(page.getByTestId("ordem-terminei")).toBeDisabled();
    await expect(motivo).toHaveText(
      "Diga quantas das 6 peças já passaram pela Queima de biscoito — a etapa só termina quando todas passarem.",
    );
  });

  test("(b) ordem de uma peça: “Terminei” habilitado, sem campo nem motivo", async ({ page }) => {
    const nome = nomeUnico("Terminei uma");
    const ordemId = await semearNaSecagem(nome, {
      pecas: [{ descricao: `${nome} · vaso`, quantidade: 1 }],
    });

    await fazerLogin(page);
    await abrirOrdem(page, ordemId);

    const terminei = page.getByTestId("ordem-terminei");
    await expect(terminei).toBeEnabled();
    await expect(page.getByTestId("ordem-parcial")).toHaveCount(0);
    await expect(page.getByTestId("terminei-motivo")).toHaveCount(0);
    await terminei.click();
    await expect(page.getByText("Feito: Secagem. Agora: Queima de biscoito.")).toBeVisible();
    expect((await secagemNoBanco(ordemId)).feitaEm).toBe(diaEmBrasilia());
  });

  // Critério 2 do ROADMAP ("valem no servidor"): a tela velha. A página A ainda mostra o "Terminei"
  // habilitado (parcial 6 de 6); noutra página da mesma sessão (outro celular), o parcial baixa para
  // 5; o toque na A, sem recarregar, é recusado pelo servidor sob a trava, sem gravar.
  test("(c) tela velha: o servidor recusa o “Terminei” quando o parcial baixou noutro celular", async ({
    page,
    context,
  }) => {
    const ordemId = await semearNaSecagem(nomeUnico("Terminei tela velha"), {
      passaramNaAtual: 6,
    });

    await fazerLogin(page);
    await abrirOrdem(page, ordemId);
    const terminei = page.getByTestId("ordem-terminei");
    await expect(terminei).toBeEnabled();

    const outra = await context.newPage();
    await abrirOrdem(outra, ordemId);
    await expect(outra.getByTestId("ordem-parcial")).toHaveValue("6");
    await gravarParcial(outra, ordemId, 5);
    await outra.close();

    // A página A não recarregou: o botão ainda está habilitado, e o toque chega ao servidor.
    await expect(terminei).toBeEnabled();
    await terminei.click();
    await expect(page.getByTestId("ordem-terminei-erro")).toHaveText(
      "A Secagem só termina quando as 6 peças passaram por ela — já passaram 5. A tela foi atualizada.",
    );
    // A recusa recarrega o estado: o botão desabilita com o motivo do parcial novo.
    await expect(page.getByTestId("terminei-motivo")).toHaveText(
      "Falta 1 das 6 peças passar pela Secagem.",
    );
    await expect(terminei).toBeDisabled();

    // Nada foi gravado: a Secagem continua a atual, sem data, com o parcial 5.
    const secagem = await secagemNoBanco(ordemId);
    expect(secagem.feitaEm).toBeNull();
    expect(secagem.passaram).toBe(5);
    await page.reload();
    await expect(page.getByTestId("ordem-etapa-secagem")).toHaveAttribute("data-estado", "atual");
    await expect(page.getByTestId("ordem-parcial")).toHaveValue("5");
  });

  // UI-D12: "Passaram todas as {N}" grava o parcial = total pelo mesmo caminho do campo e habilita o
  // "Terminei" — dois toques continuam bastando.
  test("(d) “Passaram todas as 6” e “Terminei”: dois toques terminam a etapa", async ({ page }) => {
    const ordemId = await semearNaSecagem(nomeUnico("Passaram todas"));

    await fazerLogin(page);
    await abrirOrdem(page, ordemId);

    const terminei = page.getByTestId("ordem-terminei");
    const motivo = page.getByTestId("terminei-motivo");
    const atalho = page.getByTestId("passaram-todas");
    await expect(terminei).toBeDisabled();
    await expect(atalho).toHaveText("Passaram todas as 6");
    await expect(atalho).toHaveAccessibleName("Passaram todas as 6 peças pela Secagem");

    // 44 px de toque; a partir de `@sm` da fileira (desktop) à esquerda do motivo, abaixo dele
    // embaixo (celular — a fileira do Pixel 7 mede menos de 384 px).
    const caixaDoAtalho = await medirCaixa(atalho, "passaram-todas");
    const caixaDoMotivo = await medirCaixa(motivo, "terminei-motivo");
    expect(caixaDoAtalho.height).toBeGreaterThanOrEqual(44);
    if (test.info().project.name.includes("celular")) {
      expect(caixaDoAtalho.y).toBeGreaterThanOrEqual(caixaDoMotivo.y + caixaDoMotivo.height - 1);
    } else {
      expect(caixaDoAtalho.x + caixaDoAtalho.width).toBeLessThanOrEqual(caixaDoMotivo.x + 1);
      expect(caixaDoAtalho.y).toBeLessThan(caixaDoMotivo.y + caixaDoMotivo.height);
      expect(caixaDoMotivo.y).toBeLessThan(caixaDoAtalho.y + caixaDoAtalho.height);
    }

    // Primeiro toque: o parcial vira 6 no banco e no campo; o motivo e o atalho somem.
    await atalho.click();
    await expect.poll(async () => (await secagemNoBanco(ordemId)).passaram).toBe(6);
    await expect(page.getByTestId("ordem-parcial")).toHaveValue("6");
    await expect(terminei).toBeEnabled();
    await expect(motivo).toHaveCount(0);
    await expect(atalho).toHaveCount(0);
    // Sem toast (UI-SPEC): o número no campo é o retorno.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

    // Segundo toque: a etapa avança.
    await terminei.click();
    await expect(page.getByText("Feito: Secagem. Agora: Queima de biscoito.")).toBeVisible();
    await expect(page.getByTestId("ordem-etapa-queima1")).toHaveAttribute("data-estado", "atual");
    expect((await secagemNoBanco(ordemId)).feitaEm).toBe(diaEmBrasilia());
  });

  test("(e) “Passaram todas” sem internet: a frase do campo parcial, e nada gravado", async ({
    page,
  }) => {
    const ordemId = await semearNaSecagem(nomeUnico("Passaram todas falha"), {
      passaramNaAtual: 2,
    });

    await fazerLogin(page);
    await abrirOrdem(page, ordemId);
    await expect(page.getByTestId("terminei-motivo")).toHaveText(
      "Faltam 4 das 6 peças passarem pela Secagem.",
    );

    // A Server Action é um POST para a própria página: derrubado, a chamada lança.
    const derrubarPost = (rota: Route) =>
      rota.request().method() === "POST" ? rota.abort("internetdisconnected") : rota.continue();
    await page.route(`**/gestao/producao/${ordemId}`, derrubarPost);
    await page.getByTestId("passaram-todas").click();
    await expect(page.getByTestId("passaram-todas-erro")).toHaveText(
      "Não deu para salvar quantas já passaram. Verifique a internet e tente de novo.",
    );
    await expect(page.getByTestId("passaram-todas-erro")).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("ordem-terminei")).toBeDisabled();
    expect((await secagemNoBanco(ordemId)).passaram).toBe(2);

    // A internet volta: o mesmo toque grava, e a frase sai.
    await page.unroute(`**/gestao/producao/${ordemId}`, derrubarPost);
    await page.getByTestId("passaram-todas").click();
    await expect.poll(async () => (await secagemNoBanco(ordemId)).passaram).toBe(6);
    await expect(page.getByTestId("ordem-terminei")).toBeEnabled();
    await expect(page.getByTestId("passaram-todas-erro")).toHaveCount(0);
  });
});
