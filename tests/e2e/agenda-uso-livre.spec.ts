import { test, expect, type Page } from "@playwright/test";

import {
  avisoDiaComLancamentos,
  avisoDiaFechado,
  dicaTipoUsoLivre,
  FRASE_JA_REMOVIDO,
  FRASE_RESERVA_JA_COMECOU,
  FRASE_SAIDA_ANTES_DA_CHEGADA,
  FRASE_SEM_PRECO_DA_HORA,
  FRASE_USO_JA_ENCERRADO,
  linhaHorasCheias,
  TOAST_RESERVA_CANCELADA,
  TOAST_USO_LIVRE_RESERVADO,
  toastChegadaMarcada,
  toastDiaFechado,
  tituloDoUsoLivre,
  toastUsoEncerrado,
} from "@/lib/agenda/textos";
import { horaDe } from "@/lib/agenda/horario";
import { agoraEmBrasilia, formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  semearCliente,
  semearFechado,
  semearUsoLivre,
  travarItemDaHora,
  usoLivreNoBanco,
  usosLivresDaPessoa,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-09 (AGE-13, AGE-01, AGE-05, AGE-17, D-13, D-18): o uso livre do ateliê — reservar pela folha
// "Lançar na agenda" (o preço da hora achado pela CHAVE do item, mesmo renomeado), marcar que a pessoa
// chegou (um segundo "Chegou" não muda a hora), cancelar a reserva que não vai acontecer (nunca a que já
// começou) e o uso esquecido de ontem pedindo "encerrar". Cada caso usa a PRÓPRIA pessoa com sufixo único
// e só afirma o que é dela; os dias futuros são 1000+ (longe dos que as outras specs da Agenda contam), um
// por caso e por projeto. O preço da hora é um só no banco: quem o escreve (ou o nome do item) segura a
// trava de `travarItemDaHora` e o devolve ao nulo no fim. Nomes `[e2e]`, datas de Brasília.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function diaReservado(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(1000 + caso * 2 + projeto);
}

// Os minutos do dia AGORA em Brasília (o mesmo `agoraEmBrasilia` da página) — nunca o fuso do teste.
function agoraNoAtelie(): number {
  return agoraEmBrasilia(new Date()).minutos;
}

function horaDoDia(minutos: number): string {
  return horaDe(Math.min(minutos, 1439));
}

function folhaLancar(page: Page) {
  return page.getByTestId("folha-lancar");
}

function folhaDoUso(page: Page) {
  return page.getByTestId("folha-uso-livre");
}

function cartaoDoUso(page: Page, usoId: string) {
  return page.locator(`[data-testid="agenda-cartao"][data-uso-id="${usoId}"]`);
}

async function abrirLancarNoDia(page: Page, data: string) {
  await page.goto(`/gestao/agenda?semana=${data}`);
  await page.getByTestId(`agenda-dia-${data}`).getByTestId("agenda-lancar-no-dia").click();
  await expect(folhaLancar(page)).toBeVisible();
  await expect(folhaLancar(page).getByTestId("lancar-data")).toHaveValue(data);
}

// A pílula "Uso livre" e a pessoa escolhida pelo seletor ("Quem"), pela busca do sufixo.
async function escolherUsoLivreE(page: Page, clienteId: string, busca: string) {
  const f = folhaLancar(page);
  await f.getByTestId("lancar-tipo-uso-livre").click();
  await expect(f.getByTestId("lancar-tipo-uso-livre")).toHaveAttribute("aria-checked", "true");
  await f.getByRole("combobox", { name: "Quem" }).fill(busca);
  await f.locator(`[data-testid="seletor-opcao"][data-cliente-id="${clienteId}"]`).click();
}

async function abrirUso(page: Page, data: string, usoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&uso=${usoId}`);
  await expect(folhaDoUso(page)).toBeVisible();
  await expect(folhaDoUso(page).getByTestId("uso-conta")).toBeVisible();
  return folhaDoUso(page);
}

test.describe("agenda uso livre", () => {
  test("(a) “+ lançar” de hoje → “Uso livre”: a dica mostra o preço da hora achado pela chave (item renomeado) e a reserva vira o cartão com “2 pessoas” e “reservado”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Uso Reserva ${suf}`;
    const hoje = hojeNoAtelie();
    const clienteId = await semearCliente({ nome });
    const centavos = test.info().project.name === "celular" ? 3500 : 3000;

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(centavos);
      // Renomeado em Cadastros: a Agenda continua achando o item pela chave (D-17).
      await trava.renomear(`[e2e] Hora ${suf}`);

      await fazerLogin(page);
      await page.goto("/gestao/agenda");
      await page.getByTestId(`agenda-dia-${hoje}`).getByTestId("agenda-lancar-no-dia").click();
      const f = folhaLancar(page);
      await expect(f).toBeVisible();
      await escolherUsoLivreE(page, clienteId, suf);

      // Os padrões da UI-SPEC: horas 2, pessoas 1; "Chega às" nasce vazio.
      await expect(f.getByTestId("lancar-horas")).toHaveValue("2");
      await expect(f.getByTestId("lancar-pessoas")).toHaveValue("1");
      await expect(f.getByTestId("lancar-dica")).toHaveText(dicaTipoUsoLivre(formatarReais(centavos)));

      await f.getByTestId("lancar-chegada").fill("10:00");
      await f.getByTestId("lancar-pessoas").fill("2");
      await expect(f.getByTestId("lancar-gravar")).toHaveText("Reservar uso livre");
      await f.getByTestId("lancar-gravar").click();

      await expect(page.getByText(TOAST_USO_LIVRE_RESERVADO).first()).toBeVisible();
      await expect(f).toHaveCount(0);
      await expect.poll(async () => (await usosLivresDaPessoa(clienteId)).length).toBe(1);
      const [uso] = await usosLivresDaPessoa(clienteId);
      expect(uso).toMatchObject({ estado: "reservado", data: hoje, pessoas: 2, horasPrevistas: 2, chegada: null });

      const cartao = cartaoDoUso(page, uso.id);
      await expect(cartao).toContainText(tituloDoUsoLivre(nome));
      await expect(cartao).toContainText("10:00");
      await expect(cartao).toContainText("2 pessoas");
      await expect(cartao).toContainText("Uso livre · até 12:00");
      await expect(cartao.getByTestId("tag-reservado")).toHaveText("reservado");
      await expect(cartao).toHaveAttribute("data-tipo", "uso_livre");
    } finally {
      await trava.soltar();
    }
  });

  test("(b) “Chegou” marca a chegada com a hora do campo e a tag “está no espaço”; “Chegou” de novo pela outra aba não muda a hora", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Uso Chegou ${suf}`;
    const dia = diaReservado(0);
    const clienteId = await semearCliente({ nome });
    const usoId = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "09:30", horasPrevistas: 3, pessoas: 1 });

    await fazerLogin(page);
    // A outra aba abre a folha ainda "reservado" — vai tocar "Chegou" depois.
    const outra = await page.context().newPage();
    const folhaDaOutra = await abrirUso(outra, dia, usoId);
    await expect(folhaDaOutra).toHaveAttribute("data-estado", "reservado");

    const folha = await abrirUso(page, dia, usoId);
    await expect(folha).toHaveAttribute("data-estado", "reservado");
    await expect(folha.getByTestId("tag-reservado")).toBeVisible();
    // "Chegou às" já vem com a hora da reserva.
    await expect(folha.getByTestId("uso-chegou-as")).toHaveValue("09:30");
    await folha.getByTestId("uso-chegou-as").fill("09:40");
    await folha.getByTestId("uso-chegou").click();
    await expect(page.getByText(toastChegadaMarcada("09:40")).first()).toBeVisible();
    await expect(folha).toHaveAttribute("data-estado", "no_espaco");
    await expect(folha.getByTestId("tag-no-espaco")).toHaveText("está no espaço");
    expect(await usoLivreNoBanco(usoId)).toMatchObject({ estado: "no_espaco", chegada: "09:40" });

    // A outra aba, com a folha velha, toca "Chegou" com outra hora: a hora gravada não muda.
    await folhaDaOutra.getByTestId("uso-chegou-as").fill("11:00");
    await folhaDaOutra.getByTestId("uso-chegou").click();
    await expect(outra.getByText(toastChegadaMarcada("09:40")).first()).toBeVisible();
    await expect(folhaDaOutra).toHaveAttribute("data-estado", "no_espaco");
    expect(await usoLivreNoBanco(usoId)).toMatchObject({ estado: "no_espaco", chegada: "09:40" });

    // Na semana: o cartão com a hora real e a tag.
    await folha.getByTestId("folha-uso-livre-fechar").click();
    await expect(folhaDoUso(page)).toHaveCount(0);
    const cartao = cartaoDoUso(page, usoId);
    await expect(cartao).toContainText("09:40");
    await expect(cartao).toContainText("1 pessoa");
    await expect(cartao.getByTestId("tag-no-espaco")).toBeVisible();
    await outra.close();
  });

  test("(c) “Cancelar reserva” pede confirmação e tira só a reserva; de novo pela outra aba é “Isso já tinha sido removido.”; a que outra aba marcou “Chegou” não sai", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaReservado(1);
    const nome = `[e2e] Uso Cancela ${suf}`;
    const clienteId = await semearCliente({ nome });
    const primeira = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "14:00" });

    await fazerLogin(page);
    const outra = await page.context().newPage();
    const folhaDaOutra = await abrirUso(outra, dia, primeira);

    const folha = await abrirUso(page, dia, primeira);
    await folha.getByTestId("uso-cancelar-reserva").click();
    const confirmacao = page.getByTestId("confirmar-cancelar-reserva");
    await expect(confirmacao).toContainText(`Cancelar a reserva de ${nome} em ${formatarDiaMes(dia)}?`);
    await expect(confirmacao).toContainText("A reserva sai da agenda. Nada foi cobrado nem baixado do estoque.");
    await expect(confirmacao.getByTestId("confirmar-cancelar-reserva-nao")).toHaveText("Manter a reserva");
    await confirmacao.getByTestId("confirmar-cancelar-reserva-sim").click();
    await expect(page.getByText(TOAST_RESERVA_CANCELADA).first()).toBeVisible();
    await expect(folhaDoUso(page)).toHaveCount(0);
    await expect(cartaoDoUso(page, primeira)).toHaveCount(0);
    expect(await usoLivreNoBanco(primeira)).toBeNull();

    // A outra aba ainda mostra a reserva: cancelar de novo é a frase humana, nada técnico.
    await folhaDaOutra.getByTestId("uso-cancelar-reserva").click();
    await outra.getByTestId("confirmar-cancelar-reserva-sim").click();
    await expect(outra.getByTestId("confirmar-cancelar-reserva-erro")).toHaveText(FRASE_JA_REMOVIDO);

    // Uma segunda reserva: a outra aba abre a folha, esta marca "Chegou", e a outra tenta cancelar.
    const segunda = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "16:00" });
    const folhaDaOutraDeNovo = await abrirUso(outra, dia, segunda);
    await expect(folhaDaOutraDeNovo).toHaveAttribute("data-estado", "reservado");
    const folhaDeNovo = await abrirUso(page, dia, segunda);
    await folhaDeNovo.getByTestId("uso-chegou").click();
    await expect(folhaDeNovo).toHaveAttribute("data-estado", "no_espaco");

    await folhaDaOutraDeNovo.getByTestId("uso-cancelar-reserva").click();
    await outra.getByTestId("confirmar-cancelar-reserva-sim").click();
    await expect(outra.getByTestId("confirmar-cancelar-reserva-erro")).toHaveText(FRASE_RESERVA_JA_COMECOU);
    expect(await usoLivreNoBanco(segunda)).toMatchObject({ estado: "no_espaco", chegada: "16:00" });
    // Fechar o diálogo relê a folha: ela já mostra o uso no espaço, sem "Cancelar reserva".
    await outra.getByTestId("confirmar-cancelar-reserva-nao").click();
    await expect(folhaDaOutraDeNovo).toHaveAttribute("data-estado", "no_espaco");
    await expect(folhaDaOutraDeNovo.getByTestId("uso-cancelar-reserva")).toHaveCount(0);
    await outra.close();
  });

  test("(d) D-18: o uso de ontem que ficou “no espaço” aparece na semana com a tag “encerrar”", async ({ page }) => {
    const suf = sufixoUnico();
    const ontem = somarDiasAoHoje(-1);
    const clienteId = await semearCliente({ nome: `[e2e] Uso Esquecido ${suf}` });
    const usoId = await semearUsoLivre({
      clienteId,
      data: ontem,
      chegadaPrevista: "14:00",
      horasPrevistas: 2,
      estado: "no_espaco",
      chegada: "14:10",
    });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${ontem}`);
    const cartao = cartaoDoUso(page, usoId);
    await expect(cartao).toContainText("14:10");
    await expect(cartao.getByTestId("tag-encerrar")).toHaveText("encerrar");
    await expect(cartao.getByTestId("tag-no-espaco")).toHaveCount(0);
  });

  test("(e) D-13: reservar num dia fechado avisa e grava; fechar um dia que só tem uma reserva avisa “1 lançamento” e não toca nela", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const diaFechado = diaReservado(2);
    const motivo = `[e2e] feriado ${suf}`;
    await semearFechado({ data: diaFechado, motivo });
    const clienteId = await semearCliente({ nome: `[e2e] Uso Fechado ${suf}` });

    await fazerLogin(page);
    await abrirLancarNoDia(page, diaFechado);
    await escolherUsoLivreE(page, clienteId, suf);
    await folhaLancar(page).getByTestId("lancar-chegada").fill("15:00");
    await expect(folhaLancar(page).getByTestId("aviso-dia-fechado")).toHaveText(avisoDiaFechado(motivo));
    await folhaLancar(page).getByTestId("lancar-gravar").click();
    await expect(page.getByText(TOAST_USO_LIVRE_RESERVADO).first()).toBeVisible();
    await expect.poll(async () => (await usosLivresDaPessoa(clienteId)).map((uso) => uso.data)).toEqual([diaFechado]);

    // Um outro dia, só com uma reserva: o tipo Fechado diz "1 lançamento" e, gravado, a reserva fica.
    const diaComReserva = diaReservado(3);
    const outraPessoa = await semearCliente({ nome: `[e2e] Uso Reservado ${suf}` });
    const reserva = await semearUsoLivre({ clienteId: outraPessoa, data: diaComReserva, chegadaPrevista: "10:00" });
    await abrirLancarNoDia(page, diaComReserva);
    await folhaLancar(page).getByTestId("lancar-tipo-fechado").click();
    await expect(folhaLancar(page).getByTestId("aviso-dia-fechado")).toHaveText(avisoDiaComLancamentos(1));
    await folhaLancar(page).getByTestId("lancar-motivo").fill(`[e2e] viagem ${suf}`);
    await folhaLancar(page).getByTestId("lancar-gravar").click();
    await expect(page.getByText(toastDiaFechado(formatarDiaMes(diaComReserva))).first()).toBeVisible();
    expect(await usoLivreNoBanco(reserva)).toMatchObject({ estado: "reservado", data: diaComReserva });
    await expect(cartaoDoUso(page, reserva).getByTestId("tag-reservado")).toBeVisible();
  });

  // ── Tarefa 3: encerrar e cobrar (AGE-13, AGE-17, UI-D7) ────────────────────────────────────────────

  test("(f) encerrar o uso de hoje: “Saiu às” vem com a hora de agora, 3 h × 2 pessoas × preço uma vez, o preço fica congelado; encerrar de novo pela outra aba é recusado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const hoje = hojeNoAtelie();
    const clienteId = await semearCliente({ nome: `[e2e] Uso Encerra ${suf}` });
    const centavos = test.info().project.name === "celular" ? 3500 : 3000;

    // Chegou 2h30 antes de agora → 3 horas cheias. Perto do começo do dia (antes das 02:31) o intervalo
    // não cabe antes de agora (Pitfall 12): a chegada vai para 00:00 e a saída é digitada (02:30).
    const agora = agoraNoAtelie();
    const cabeAntes = agora >= 151;
    const chegada = cabeAntes ? horaDoDia(agora - 150) : "00:00";
    const usoId = await semearUsoLivre({
      clienteId,
      data: hoje,
      chegadaPrevista: chegada,
      horasPrevistas: 2,
      pessoas: 2,
      estado: "no_espaco",
      chegada,
    });

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(centavos);
      await fazerLogin(page);
      const outra = await page.context().newPage();
      const folhaDaOutra = await abrirUso(outra, hoje, usoId);

      const folha = await abrirUso(page, hoje, usoId);
      await expect(folha).toHaveAttribute("data-estado", "no_espaco");
      await expect(folha.getByTestId("uso-chegou-as")).toHaveValue(chegada);
      // "Saiu às" = a hora de agora em Brasília (o minuto pode ter virado entre a semente e a página).
      const saiuAs = await folha.getByTestId("uso-saiu-as").inputValue();
      expect([agora, agora + 1, agora + 2].map(horaDoDia)).toContain(saiuAs);
      if (!cabeAntes) {
        await folha.getByTestId("uso-saiu-as").fill("02:30");
      }
      const total = 3 * 2 * centavos;
      await expect(folha.getByTestId("uso-conta-horas")).toHaveText(
        linhaHorasCheias(3, 2, formatarReais(centavos), formatarReais(total)),
      );
      await expect(folha.getByTestId("uso-conta-valor")).toHaveText(formatarReais(total));
      await expect(folha.getByTestId("uso-encerrar")).toHaveText("Encerrar e cobrar");
      await folha.getByTestId("uso-encerrar").click();

      await expect(page.getByText(toastUsoEncerrado(3, formatarReais(total))).first()).toBeVisible();
      await expect(folha).toHaveAttribute("data-estado", "encerrado");
      await expect(folha.getByTestId("uso-encerrado")).toHaveText("Encerrado · 3 h");
      await expect(folha.getByTestId("tag-encerrado")).toBeVisible();
      expect(await usoLivreNoBanco(usoId)).toMatchObject({
        estado: "encerrado",
        horasCheias: 3,
        precoHoraCentavos: centavos,
        valorCentavos: total,
      });

      // O preço do Catálogo muda depois: o uso encerrado guarda o daquele dia.
      await trava.definirPreco(centavos + 1000);
      expect(await usoLivreNoBanco(usoId)).toMatchObject({ precoHoraCentavos: centavos, valorCentavos: total });

      // A outra aba ainda mostra "no espaço": encerrar de novo é recusado com a frase, e ela atualiza.
      await folhaDaOutra.getByTestId("uso-encerrar").click();
      await expect(outra.getByText(FRASE_USO_JA_ENCERRADO).first()).toBeVisible();
      await expect(folhaDaOutra).toHaveAttribute("data-estado", "encerrado");
      expect(await usoLivreNoBanco(usoId)).toMatchObject({ horasCheias: 3, valorCentavos: total });
      await outra.close();
    } finally {
      await trava.soltar();
    }
  });

  test("(g) AGE-17: sem preço da hora no Catálogo, a caixa âmbar diz onde cadastrar e “Encerrar e cobrar” fica desabilitado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaReservado(4);
    const clienteId = await semearCliente({ nome: `[e2e] Uso Sem Preço ${suf}` });
    const usoId = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "10:00", estado: "no_espaco" });

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(null);
      await fazerLogin(page);
      const folha = await abrirUso(page, dia, usoId);
      await expect(folha.getByTestId("aviso-sem-preco-hora")).toHaveText(FRASE_SEM_PRECO_DA_HORA);
      const botao = folha.getByTestId("uso-encerrar");
      await expect(botao).toBeDisabled();
      await expect(botao).toHaveAttribute("aria-describedby", "aviso-sem-preco-hora");
      await expect(folha.getByTestId("uso-conta-valor")).toHaveText("—");
      expect(await usoLivreNoBanco(usoId)).toMatchObject({ estado: "no_espaco", valorCentavos: null });
    } finally {
      await trava.soltar();
    }
  });

  test("(h) “Saiu às” antes da chegada: “A saída precisa ser depois da chegada.” e nada é gravado", async ({ page }) => {
    const suf = sufixoUnico();
    const dia = diaReservado(5);
    const clienteId = await semearCliente({ nome: `[e2e] Uso Saída ${suf}` });
    const usoId = await semearUsoLivre({ clienteId, data: dia, chegadaPrevista: "14:00", estado: "no_espaco" });

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(2500);
      await fazerLogin(page);
      const folha = await abrirUso(page, dia, usoId);
      await folha.getByTestId("uso-saiu-as").fill("13:30");
      await expect(folha.getByTestId("uso-conta-horas")).toHaveText("—");
      await folha.getByTestId("uso-encerrar").click();
      await expect(folha.getByTestId("uso-saiu-as-erro")).toHaveText(FRASE_SAIDA_ANTES_DA_CHEGADA);
      await folha.getByTestId("uso-saiu-as").fill("14:00");
      await folha.getByTestId("uso-encerrar").click();
      await expect(folha.getByTestId("uso-saiu-as-erro")).toHaveText(FRASE_SAIDA_ANTES_DA_CHEGADA);
      expect(await usoLivreNoBanco(usoId)).toMatchObject({ estado: "no_espaco", saida: null });
    } finally {
      await trava.soltar();
    }
  });

  test("(i) D-18: o uso de ontem com “encerrar” se encerra pela mesma folha, com “Saiu às” vindo da saída prevista", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const ontem = somarDiasAoHoje(-1);
    const clienteId = await semearCliente({ nome: `[e2e] Uso Ontem ${suf}` });
    const usoId = await semearUsoLivre({
      clienteId,
      data: ontem,
      chegadaPrevista: "15:00",
      horasPrevistas: 2,
      pessoas: 1,
      estado: "no_espaco",
      chegada: "15:20",
    });

    const trava = await travarItemDaHora();
    try {
      await trava.definirPreco(4000);
      await fazerLogin(page);
      await page.goto(`/gestao/agenda?semana=${ontem}`);
      const cartao = cartaoDoUso(page, usoId);
      await expect(cartao.getByTestId("tag-encerrar")).toBeVisible();
      await cartao.click();
      const folha = folhaDoUso(page);
      await expect(folha).toHaveAttribute("data-estado", "no_espaco");
      await expect(folha.getByTestId("tag-encerrar")).toBeVisible();
      // A saída prevista: a chegada real (15:20) + 2 horas previstas.
      await expect(folha.getByTestId("uso-saiu-as")).toHaveValue("17:20");
      await expect(folha.getByTestId("uso-conta-horas")).toHaveText(linhaHorasCheias(2, 1, formatarReais(4000), ""));
      await folha.getByTestId("uso-encerrar").click();
      await expect(page.getByText(toastUsoEncerrado(2, formatarReais(8000))).first()).toBeVisible();
      expect(await usoLivreNoBanco(usoId)).toMatchObject({
        estado: "encerrado",
        saida: "17:20",
        horasCheias: 2,
        valorCentavos: 8000,
      });
      // Encerrado, a tag "encerrar" sai da semana.
      await folha.getByTestId("uso-voltar").click();
      await expect(cartaoDoUso(page, usoId).getByTestId("tag-encerrar")).toHaveCount(0);
      await expect(cartaoDoUso(page, usoId)).toContainText("Uso livre · até 17:20");
    } finally {
      await trava.soltar();
    }
  });
});
