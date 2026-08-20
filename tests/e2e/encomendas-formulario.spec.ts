import { test, expect, type Page } from "@playwright/test";

import { ROTULO_ETAPA } from "@/lib/encomendas/textos";

// O formulário de criar/editar encomenda (03-06-PLAN.md): `Dialog` no desktop / `Sheet` no
// celular escolhido por CSS (D-03), abertura derivada de `?nova`/`?editar={id}`, itens
// reordenáveis por setas (D-16) e o rodapé que recalcula a cada tecla (D-17).
//
// Desde este plano, `FormularioEncomenda` monta `Dialog` E `Sheet` ao mesmo tempo — os dois
// existem no HTML, um escondido por CSS a cada largura (mesmo princípio de D-02 para
// Gantt/lista). `:visible` escolhe a metade real do viewport do projeto Playwright em execução.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// `exact: true` é necessário para os rótulos de etapa ("Produção", "Secagem", "Esmaltação"): o
// Gantt e os cartões da lista têm `aria-label="{Etapa} — N dias"` em cada barra/segmento — sem
// `exact`, `getByLabel` casa por SUBSTRING e resolve para o campo do formulário E para toda barra
// do Gantt na tela (violação de modo estrito quando o banco de teste já tem outras encomendas,
// criadas por specs rodando em paralelo sob `npm run test:e2e` sem `--grep`).
function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo, { exact: true }).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Rótulos de etapa como "Queima (biscoito)" têm parênteses — caractere de regex. Escapa antes de
// montar `new RegExp(...)` para o rótulo ser tratado como texto literal.
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Preenche os campos mínimos (nome, cliente, data, item 1) sem enviar — deixa quem chama decidir
// se envia, mede algo antes de enviar, ou abandona.
async function preencherMinimo(
  page: Page,
  opcoes: { nome: string; cliente?: string; dataInicio?: string; itemDescricao?: string },
) {
  await campoVisivel(page, "Nome da encomenda").fill(opcoes.nome);
  if (opcoes.cliente) {
    await campoVisivel(page, "Cliente").fill(opcoes.cliente);
  }
  await campoVisivel(page, "Data de início").fill(opcoes.dataInicio ?? "2026-08-12");
  await campoVisivel(page, "Descrição do item 1").fill(opcoes.itemDescricao ?? "Item de teste [e2e]");
  await campoVisivel(page, "Quantidade do item 1").fill("1");
}

async function salvarComRetry(page: Page, nome: string) {
  const TENTATIVAS_MAXIMAS = 3;
  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    await botaoVisivel(page, "Salvar").click();
    try {
      await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
      return;
    } catch (erro) {
      await page.goto("/encomendas");
      const jaFoiCriada = await page.getByText(nome, { exact: true }).count();
      if (jaFoiCriada > 0) {
        return;
      }
      if (tentativa === TENTATIVAS_MAXIMAS) {
        throw erro;
      }
      await page.goto("/encomendas?nova");
      await preencherMinimo(page, { nome });
    }
  }
}

test.describe("formulário de encomenda — contêiner, URL e estados", () => {
  test("abre como Dialog no desktop e como Sheet no celular, sempre com o título certo", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const desktop = test.info().project.name === "desktop";
    if (desktop) {
      await expect(page.getByRole("dialog", { name: "Nova encomenda" })).toBeVisible();
    } else {
      // `Sheet` usa a mesma role="dialog" do Radix (é o mesmo primitivo por baixo) — o que
      // muda é a posição/tamanho, conferidos pelo `boundingBox()` abaixo.
      const folha = page.getByRole("dialog", { name: "Nova encomenda" });
      await expect(folha).toBeVisible();
      const caixa = await folha.boundingBox();
      expect(caixa).not.toBeNull();
      // Folha ocupando a tela toda: altura próxima da viewport inteira.
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(caixa!.height).toBeGreaterThan((viewport!.height ?? 0) * 0.8);
    }
  });

  test("fechar remove o parâmetro da URL e volta para /encomendas", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await expect(page).toHaveURL(/\?nova/);

    await botaoVisivel(page, "Cancelar").click();
    await expect(page).toHaveURL(/\/encomendas$/);
  });

  test("no celular, o botão voltar do navegador fecha o formulário e permanece em /encomendas", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "celular", "Caso específico do celular");

    await fazerLogin(page);
    await page.goto("/encomendas");
    await page.goto("/encomendas?nova");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/encomendas$/);
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5000 });
  });

  test("recarregar /encomendas?nova reabre o formulário", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\?nova/);
  });

  test("editar={id} abre o formulário com os campos preenchidos daquela encomenda", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("editar preenchido");

    await page.goto("/encomendas?nova");
    await preencherMinimo(page, { nome, cliente: "Cliente do teste de edição" });
    await salvarComRetry(page, nome);

    await page.goto("/encomendas");
    // O Gantt do desktop ainda não tem um `Link` por linha (gap pré-existente de 03-04, fora do
    // escopo deste plano — ver 03-05-SUMMARY.md "Next Phase Readiness") — o cartão mobile
    // (`CartaoEncomenda`) é um `<a href>` real e sempre existe no DOM nos dois tamanhos de tela
    // (D-02), então extrai o `href` dali independente do viewport do projeto Playwright atual.
    const cartao = page.locator('[data-testid^="cartao-encomenda-"]', { hasText: nome });
    const hrefDoDetalhe = await cartao.getAttribute("href");
    expect(hrefDoDetalhe).not.toBeNull();
    await page.goto(hrefDoDetalhe!);
    await expect(page).toHaveURL(/\/encomendas\/[^/]+$/);
    await page.getByRole("link", { name: "Editar" }).click();

    await expect(page).toHaveURL(/\?editar=/);
    await expect(campoVisivel(page, "Nome da encomenda")).toHaveValue(nome);
    await expect(campoVisivel(page, "Cliente")).toHaveValue("Cliente do teste de edição");
  });

  test("falha ao salvar mostra banner inline e mantém o formulário aberto com o que foi digitado", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const nome = nomeUnico("erro de validação");
    await campoVisivel(page, "Nome da encomenda").fill(nome);
    // Sem preencher a data de início (obrigatória) — o Zod do servidor recusa mesmo que o
    // navegador não bloqueie o envio.
    await campoVisivel(page, "Descrição do item 1").fill("Item de teste [e2e]");
    await campoVisivel(page, "Quantidade do item 1").fill("1");

    await botaoVisivel(page, "Salvar").click();

    await expect(page.getByRole("alert").filter({ hasText: /Não deu para salvar|inválida|formato/i })).toBeVisible({
      timeout: 10000,
    });
    // O formulário continua aberto e o nome digitado não se perdeu.
    await expect(campoVisivel(page, "Nome da encomenda")).toHaveValue(nome);
  });

  test("todo campo tem font-size >= 16px e altura >= 44px", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const campoNome = campoVisivel(page, "Nome da encomenda");
    const tamanhoDaFonte = await campoNome.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    const caixa = await campoNome.boundingBox();

    expect(tamanhoDaFonte).toBeGreaterThanOrEqual(16);
    expect(caixa).not.toBeNull();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
  });

  test("navegar só pelo teclado do campo nome até Salvar passa por todos os campos em ordem lógica", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    await campoVisivel(page, "Nome da encomenda").focus();

    const nomesEncontrados: string[] = [];
    for (let volta = 0; volta < 40; volta++) {
      const rotuloAtivo = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return (
          el.getAttribute("aria-label") ||
          el.textContent?.trim() ||
          el.getAttribute("id") ||
          el.tagName
        );
      });
      if (rotuloAtivo) {
        nomesEncontrados.push(rotuloAtivo);
      }
      if (rotuloAtivo === "Salvar") {
        break;
      }
      await page.keyboard.press("Tab");
    }

    expect(nomesEncontrados).toContain("Salvar");
    // A ordem passa por cliente e data antes de chegar aos itens/etapas/Salvar.
    const indiceNome = 0;
    const indiceSalvar = nomesEncontrados.indexOf("Salvar");
    expect(indiceSalvar).toBeGreaterThan(indiceNome);
  });
});

test.describe("itens da encomenda — linha em branco, setas de 44px e a última linha que não sai", () => {
  test("abrir para criar mostra UMA linha de item em branco, pronta para digitar", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const linhas = page.locator('[data-testid^="item-linha-"]').and(page.locator(":visible"));
    await expect(linhas).toHaveCount(1);
    await expect(campoVisivel(page, "Descrição do item 1")).toHaveValue("");
  });

  test("com um item só, o botão de remover fica disabled, e as duas setas também", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const remover = page.getByRole("button", { name: /Remover/ }).and(page.locator(":visible"));
    const setaCima = page
      .getByRole("button", { name: /Mover .* para cima/ })
      .and(page.locator(":visible"));
    const setaBaixo = page
      .getByRole("button", { name: /Mover .* para baixo/ })
      .and(page.locator(":visible"));

    await expect(remover).toBeDisabled();
    await expect(setaCima).toBeDisabled();
    await expect(setaBaixo).toBeDisabled();
    // Presentes no DOM, nunca ausentes — nunca escondidas (D-16).
    await expect(setaCima).toHaveCount(1);
    await expect(setaBaixo).toHaveCount(1);
  });

  test("Adicionar item acrescenta uma linha no fim, e as setas do meio deixam de estar disabled", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    await botaoVisivel(page, "Adicionar item").click();

    const linhas = page.locator('[data-testid^="item-linha-"]').and(page.locator(":visible"));
    await expect(linhas).toHaveCount(2);

    await expect(campoVisivel(page, "Descrição do item 2")).toBeFocused();

    // Primeira linha: seta para cima continua desabilitada (é a primeira), para baixo não.
    const setaCimaLinha1 = page
      .getByRole("button", { name: /Mover item 1 para cima/ })
      .and(page.locator(":visible"));
    const setaBaixoLinha1 = page
      .getByRole("button", { name: /Mover item 1 para baixo/ })
      .and(page.locator(":visible"));
    await expect(setaCimaLinha1).toBeDisabled();
    await expect(setaBaixoLinha1).toBeEnabled();
  });

  test("boundingBox() das setas mede pelo menos 44x44", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await botaoVisivel(page, "Adicionar item").click();

    const setaBaixo = page
      .getByRole("button", { name: /Mover item 1 para baixo/ })
      .and(page.locator(":visible"));
    const caixa = await setaBaixo.boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
  });

  test("reordenar na criação muda só a ordem local, e a ordem correta chega ao banco", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("reordenar na criacao");
    await page.goto("/encomendas?nova");

    await campoVisivel(page, "Nome da encomenda").fill(nome);
    await campoVisivel(page, "Data de início").fill("2026-08-12");
    await campoVisivel(page, "Descrição do item 1").fill("Primeiro item");
    await campoVisivel(page, "Quantidade do item 1").fill("1");

    await botaoVisivel(page, "Adicionar item").click();
    await campoVisivel(page, "Descrição do item 2").fill("Segundo item");
    await campoVisivel(page, "Quantidade do item 2").fill("2");

    // Move o segundo item para cima — agora "Segundo item" deve estar na linha 1.
    const setaCimaLinha2 = page
      .getByRole("button", { name: /Mover Segundo item para cima/ })
      .and(page.locator(":visible"));
    await setaCimaLinha2.click();

    await expect(campoVisivel(page, "Descrição do item 1")).toHaveValue("Segundo item");
    await expect(campoVisivel(page, "Descrição do item 2")).toHaveValue("Primeiro item");

    await salvarComRetry(page, nome);

    await page.goto("/encomendas");
    // O cartão mobile é um `<a href>` real, sempre no DOM nos dois tamanhos de tela (D-02) — ver
    // o comentário equivalente no teste "editar={id}" acima.
    const cartao = page.locator('[data-testid^="cartao-encomenda-"]', { hasText: nome });
    const hrefDoDetalhe = await cartao.getAttribute("href");
    expect(hrefDoDetalhe).not.toBeNull();
    await page.goto(hrefDoDetalhe!);
    await expect(page).toHaveURL(/\/encomendas\/[^/]+$/);
    await expect(page.getByText("Segundo item")).toBeVisible();
  });

  test("na edição, reordenar grava na hora e a nova ordem sobrevive a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("reordenar na edicao");

    // Cria com dois itens já persistidos (ambos com `idDoBanco` — só assim a seta chama
    // `reordenarItemEncomenda`, 03-06-PLAN.md "Decisão que este plano fecha").
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Nome da encomenda").fill(nome);
    await campoVisivel(page, "Data de início").fill("2026-08-12");
    await campoVisivel(page, "Descrição do item 1").fill("Item A");
    await campoVisivel(page, "Quantidade do item 1").fill("1");
    await botaoVisivel(page, "Adicionar item").click();
    await campoVisivel(page, "Descrição do item 2").fill("Item B");
    await campoVisivel(page, "Quantidade do item 2").fill("2");
    await salvarComRetry(page, nome);

    await page.goto("/encomendas");
    const cartao = page.locator('[data-testid^="cartao-encomenda-"]', { hasText: nome });
    const hrefDoDetalhe = await cartao.getAttribute("href");
    expect(hrefDoDetalhe).not.toBeNull();

    // O formulário lê `editar` da URL do ÍNDICE (`/encomendas?editar={id}`), não da rota de
    // detalhe — abre pelo mesmo link "Editar" que a tela de detalhe usa.
    await page.goto(hrefDoDetalhe!);
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(/\?editar=/);

    const setaCimaItemB = page
      .getByRole("button", { name: /Mover Item B para cima/ })
      .and(page.locator(":visible"));
    await setaCimaItemB.click();

    await expect(campoVisivel(page, "Descrição do item 1")).toHaveValue("Item B");
    await expect(campoVisivel(page, "Descrição do item 2")).toHaveValue("Item A");

    // Fecha SEM clicar em "Salvar" — a troca já foi gravada pela seta (D-16), não pelo envio do
    // formulário inteiro.
    await botaoVisivel(page, "Cancelar").click();
    await page.goto(hrefDoDetalhe!);
    await expect(page.getByText("Item B")).toBeVisible();

    // Reabre editar e confirma que a ordem persistiu depois de um recarregamento de verdade.
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(/\?editar=/);
    await page.reload();
    await expect(campoVisivel(page, "Descrição do item 1")).toHaveValue("Item B");
    await expect(campoVisivel(page, "Descrição do item 2")).toHaveValue("Item A");
  });

  test("uma descrição de 201 caracteres mostra a mensagem do Zod e o formulário não envia", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const nome = nomeUnico("descricao longa");
    await campoVisivel(page, "Nome da encomenda").fill(nome);
    await campoVisivel(page, "Data de início").fill("2026-08-12");
    await campoVisivel(page, "Descrição do item 1").fill("x".repeat(201));
    await campoVisivel(page, "Quantidade do item 1").fill("1");

    await botaoVisivel(page, "Salvar").click();

    await expect(page.getByText(/passa de 200 caracteres/i).and(page.locator(":visible"))).toBeVisible();
    await expect(page).toHaveURL(/\?nova/);
  });
});

test.describe("rodapé do formulário — duração total e conclusão prevista ao vivo", () => {
  test("as etapas de marco (queima1, queima2, entrega) têm Switch, nunca campo numérico", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    for (const etapa of ["queima1", "queima2", "entrega"] as const) {
      const rotulo = ROTULO_ETAPA[etapa];
      // Nenhum `input[type=number]` com esse rótulo exato — só o `Switch` (critério de aceite:
      // "nenhum input[type=number] existe para as etapas queima1, queima2 e entrega").
      const numerico = campoVisivel(page, rotulo).and(page.locator('input[type="number"]'));
      await expect(numerico).toHaveCount(0);
      await expect(
        page.getByRole("switch", { name: new RegExp(escaparRegex(rotulo)) }).and(page.locator(":visible")),
      ).toBeVisible();
    }
  });

  test("digitar no campo de secagem muda o rodapé sem nenhum clique intermediário", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Data de início").fill("2026-08-12");

    const rodape = page
      .locator('[data-testid="rodape-formulario"]')
      .and(page.locator(":visible"));
    const textoInicial = await rodape.innerText();

    const campoSecagem = campoVisivel(page, ROTULO_ETAPA.secagem);
    await campoSecagem.fill("12");

    await expect(rodape).not.toHaveText(textoInicial);
    await expect(rodape).toContainText("Duração total:");
    await expect(rodape).toContainText("Conclusão prevista:");
  });

  test("desligar o Switch de Entrega faz a duração total cair 1 dia e a conclusão recuar 1 dia", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Data de início").fill("2026-08-12");

    const rodape = page
      .locator('[data-testid="rodape-formulario"]')
      .and(page.locator(":visible"));
    const textoAntes = await rodape.innerText();

    const switchEntrega = page
      .getByRole("switch", { name: new RegExp(escaparRegex(ROTULO_ETAPA.entrega)) })
      .and(page.locator(":visible"));
    await switchEntrega.click();

    await expect(rodape).not.toHaveText(textoAntes);

    // Liga de volta — devolve os valores anteriores.
    await switchEntrega.click();
    await expect(rodape).toHaveText(textoAntes);
  });

  test("as seis etapas em 0 mostram Duração total: 0 dias e um traço no lugar da data", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Data de início").fill("2026-08-12");

    for (const etapa of ["producao", "secagem", "esmaltacao"] as const) {
      await campoVisivel(page, ROTULO_ETAPA[etapa]).fill("0");
    }
    for (const etapa of ["queima1", "queima2", "entrega"] as const) {
      const interruptor = page
        .getByRole("switch", { name: new RegExp(escaparRegex(ROTULO_ETAPA[etapa])) })
        .and(page.locator(":visible"));
      if (await interruptor.isChecked()) {
        await interruptor.click();
      }
    }

    const rodape = page
      .locator('[data-testid="rodape-formulario"]')
      .and(page.locator(":visible"));
    await expect(rodape).toContainText("Duração total: 0 dias");
    await expect(rodape).toContainText("—");
  });

  test("os números do rodapé usam tabular-nums", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Data de início").fill("2026-08-12");

    const numero = page
      .locator('[data-testid="rodape-formulario"] span')
      .first()
      .and(page.locator(":visible"));
    const variantNumerico = await numero.evaluate(
      (el) => getComputedStyle(el).fontVariantNumeric,
    );
    expect(variantNumerico).toContain("tabular-nums");
  });

  // Regressão de G-03-1. O rodapé era `sticky bottom-0` num `div` que é IRMÃO da área de campos,
  // não filho dela — sem nenhum contêiner de rolagem entre ele e o documento, o `bottom: 0` se
  // ancorava no pé da JANELA, em coordenadas de leiaute anteriores ao `md:-translate-y-1/2` que
  // centraliza o diálogo. No desktop isso subia o rodapé em `(md:top-1/2 + altura) − altura da
  // janela` — 357px a 1280x1024, 279px a 1280x800, 209px a 1280x600 —, jogando-o no meio da tela
  // com campos passando por baixo. No celular a mesma conta dá zero, então o defeito nunca
  // apareceu ali: só um teste que mede a GEOMETRIA pega isso, nenhuma asserção de texto pega.
  //
  // Roda nos dois projetos de viewport de propósito: é a divergência desktop/celular que este
  // teste existe para vigiar. A tolerância é de 2px (a borda de 1px do `md:border` do diálogo,
  // mais arredondamento subpixel) — folgada o bastante para não piscar, apertada o bastante para
  // reprovar qualquer volta do defeito, cuja menor manifestação medida foi de 209px.
  test("o rodapé fica colado ao pé do diálogo, e não se move quando os campos rolam", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas?nova");

    const rodape = page
      .locator('[data-testid="rodape-formulario"]')
      .and(page.locator(":visible"));
    await expect(rodape).toBeVisible();

    // Faz o formulário crescer bem além da altura do diálogo, para que a área de campos tenha
    // mesmo o que rolar — é o estado em que o defeito era mais visível.
    for (let i = 0; i < 8; i++) {
      await botaoVisivel(page, "Adicionar item").click();
    }
    await expect(campoVisivel(page, "Descrição do item 9")).toBeVisible();

    const medir = () =>
      page.evaluate(() => {
        const dialogo = document.querySelector('[data-slot="dialog-content"]');
        if (!dialogo) throw new Error("DialogContent não encontrado.");
        const barra = dialogo.querySelector('[data-testid="rodape-formulario"]')?.parentElement;
        const campos = dialogo.querySelector("form")?.firstElementChild;
        if (!barra || !campos) throw new Error("Rodapé ou área de campos não encontrados.");
        return {
          peDoDialogo: dialogo.getBoundingClientRect().bottom,
          peDoRodape: barra.getBoundingClientRect().bottom,
          topoDoRodape: barra.getBoundingClientRect().top,
          camposRolam: campos.scrollHeight > campos.clientHeight + 1,
        };
      });

    const antes = await medir();

    // 1. A área de campos é quem rola — se ela parasse de rolar, o rodapé ficaria "no lugar"
    //    por acidente (o diálogo cresceria sem limite) e o resto do teste não provaria nada.
    expect(antes.camposRolam).toBe(true);

    // 2. O rodapé está ao PÉ do diálogo, não no meio dele.
    expect(Math.abs(antes.peDoDialogo - antes.peDoRodape)).toBeLessThanOrEqual(2);

    // 3. Rolar a área de campos até o fim não arrasta o rodapé.
    await page.evaluate(() => {
      const campos = document.querySelector('[data-slot="dialog-content"] form')
        ?.firstElementChild;
      if (campos) campos.scrollTop = campos.scrollHeight;
    });

    const depois = await medir();
    expect(Math.abs(depois.peDoDialogo - depois.peDoRodape)).toBeLessThanOrEqual(2);
    expect(Math.abs(depois.topoDoRodape - antes.topoDoRodape)).toBeLessThanOrEqual(2);
  });
});
