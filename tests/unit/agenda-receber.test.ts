import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  descricaoDaLinha,
  itensAReceber,
  linhasDaVenda,
  DISPENSADAS_POR_VEZ,
  loteDeMensalidades,
  ordenarDispensadas,
  podeDispensar,
  quantasDispensadasDaUrl,
  situacaoDaCobranca,
  subLinhaDaCobranca,
  totalAReceber,
  type CobrancaDaAgenda,
  type ItensDoSistema,
} from "@/lib/agenda/receber";
import {
  corpoConfirmarLote,
  fraseCorridaDoLote,
  linhaDoLote,
  resumoDoLote,
  rotuloConfirmarLote,
  rotuloDoBotaoDoLote,
  subLinhaDispensada,
  tituloConfirmarDispensar,
  tituloConfirmarLote,
  toastDoLote,
} from "@/lib/agenda/textos";

// AGE-15 (§5): a Agenda não guarda dinheiro. “Pago” é DERIVADO do Financeiro (a venda ligada e as
// parcelas dela), nunca uma coluna; “A receber” é o que ainda não virou venda ativa.

const SEM_VENDA = {
  documentoId: null,
  numeroDaVenda: null,
  canceladoEm: null,
  parcelasEmAberto: 0,
  dispensadaEm: null,
} as const;

function mensalidade(parcial: Partial<CobrancaDaAgenda & { tipo: "mensalidade" }> = {}): CobrancaDaAgenda {
  return {
    tipo: "mensalidade",
    id: "m-1",
    clienteId: "c-1",
    nome: "Marina Lopes",
    valorCentavos: 32000,
    turma: "Torno iniciante",
    mes: "2026-10-01",
    vencimento: "2026-10-05",
    proporcional: false,
    ...SEM_VENDA,
    ...parcial,
  } as CobrancaDaAgenda;
}

function inscricao(parcial: Partial<CobrancaDaAgenda & { tipo: "inscricao" }> = {}): CobrancaDaAgenda {
  return {
    tipo: "inscricao",
    id: "i-1",
    clienteId: "c-2",
    nome: "Caio Brandão",
    valorCentavos: 18000,
    experimental: false,
    titulo: "Oficina de esmalte",
    data: "2026-10-10",
    dataCancelada: false,
    ...SEM_VENDA,
    ...parcial,
  } as CobrancaDaAgenda;
}

function usoLivre(parcial: Partial<CobrancaDaAgenda & { tipo: "uso_livre" }> = {}): CobrancaDaAgenda {
  return {
    tipo: "uso_livre",
    id: "u-1",
    clienteId: "c-3",
    nome: "Helena Prado",
    valorCentavos: 9000,
    horas: 3,
    pessoas: 1,
    precoHoraCentavos: 3000,
    data: "2026-10-12",
    materiais: [],
    ...SEM_VENDA,
    ...parcial,
  } as CobrancaDaAgenda;
}

const ITENS: ItensDoSistema = {
  mensalidade: { id: "item-mens", categoriaId: "cat-aulas" },
  inscricaoOficina: { id: "item-insc", categoriaId: "cat-aulas" },
  usoLivreHora: { id: "item-uso", categoriaId: "cat-espaco" },
};

describe("situacaoDaCobranca — “pago” derivado do Financeiro (D-08, D-09)", () => {
  it("sem venda: a receber", () => {
    expect(situacaoDaCobranca({ documentoId: null })).toBe("a_receber");
  });

  it("com venda cancelada no Caixa: venda_cancelada (volta sozinha, nada gravado)", () => {
    expect(
      situacaoDaCobranca({ documentoId: "d-1", canceladoEm: "2026-10-02T12:00:00Z", parcelasEmAberto: 0 }),
    ).toBe("venda_cancelada");
  });

  it("com venda e 1 parcela em aberto: lançado", () => {
    expect(situacaoDaCobranca({ documentoId: "d-1", canceladoEm: null, parcelasEmAberto: 1 })).toBe("lancado");
  });

  it("com venda e nenhuma parcela em aberto: pago", () => {
    expect(situacaoDaCobranca({ documentoId: "d-1", canceladoEm: null, parcelasEmAberto: 0 })).toBe("pago");
  });

  it("dispensada e sem venda ativa: dispensada", () => {
    expect(situacaoDaCobranca({ documentoId: null, dispensadaEm: "2026-10-02T12:00:00Z" })).toBe("dispensada");
    expect(
      situacaoDaCobranca({
        documentoId: "d-1",
        canceladoEm: "2026-10-02T12:00:00Z",
        dispensadaEm: "2026-10-03T12:00:00Z",
      }),
    ).toBe("dispensada");
  });

  it("venda ativa vence a dispensa (a dispensa não apaga venda)", () => {
    expect(
      situacaoDaCobranca({ documentoId: "d-1", parcelasEmAberto: 0, dispensadaEm: "2026-10-03T12:00:00Z" }),
    ).toBe("pago");
  });
});

describe("itensAReceber — o que ainda não virou venda, em ordem de vencimento", () => {
  it("tira valor 0, lançado, pago, dispensada e inscrição de data cancelada; mantém venda cancelada", () => {
    const lista = itensAReceber([
      mensalidade({ id: "fica" }),
      inscricao({ id: "zero", valorCentavos: 0 }),
      inscricao({ id: "lancado", documentoId: "d-1", numeroDaVenda: 7, parcelasEmAberto: 1 }),
      inscricao({ id: "pago", documentoId: "d-2", numeroDaVenda: 8, parcelasEmAberto: 0 }),
      inscricao({ id: "dispensada", dispensadaEm: "2026-10-02T12:00:00Z" }),
      inscricao({ id: "data-cancelada", dataCancelada: true }),
      usoLivre({
        id: "cancelada",
        documentoId: "d-3",
        numeroDaVenda: 9,
        canceladoEm: "2026-10-02T12:00:00Z",
      }),
    ]);
    expect(lista.map((item) => item.id)).toEqual(["fica", "cancelada"]);
    expect(lista.map((item) => item.situacao)).toEqual(["a_receber", "venda_cancelada"]);
  });

  it("mensalidade que vence dia 05, inscrição do dia 10 e uso livre do dia 12, nessa ordem", () => {
    const lista = itensAReceber([
      usoLivre({ id: "uso", data: "2026-10-12" }),
      inscricao({ id: "insc", data: "2026-10-10" }),
      mensalidade({ id: "mens", vencimento: "2026-10-05" }),
    ]);
    expect(lista.map((item) => item.id)).toEqual(["mens", "insc", "uso"]);
  });

  it("empate na data: pelo nome (sem acento nem caixa), depois pelo id", () => {
    const lista = itensAReceber([
      inscricao({ id: "b", nome: "joana Reis", data: "2026-10-10" }),
      inscricao({ id: "c", nome: "Ágata", data: "2026-10-10" }),
      inscricao({ id: "a", nome: "Joana Reis", data: "2026-10-10" }),
    ]);
    expect(lista.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("a mesma pessoa com mensalidade e inscrição tem duas linhas, nunca fundidas", () => {
    const lista = itensAReceber([
      mensalidade({ id: "m", clienteId: "c-9", nome: "Lívia Sá" }),
      inscricao({ id: "i", clienteId: "c-9", nome: "Lívia Sá" }),
    ]);
    expect(lista).toHaveLength(2);
    expect(totalAReceber(lista)).toBe(32000 + 18000);
  });

  it("lista vazia: nada e total zero", () => {
    expect(itensAReceber([])).toEqual([]);
    expect(totalAReceber([])).toBe(0);
  });
});

describe("descricaoDaLinha — a descrição da linha da venda (D-04)", () => {
  it("mensalidade: “Mensalidade · {turma} · {mês}”", () => {
    expect(descricaoDaLinha({ tipo: "mensalidade", turma: "X", mes: "2026-10" })).toBe("Mensalidade · X · outubro");
    expect(descricaoDaLinha({ tipo: "mensalidade", turma: "Torno iniciante", mes: "2026-12-01" })).toBe(
      "Mensalidade · Torno iniciante · dezembro",
    );
  });

  it("turma de 200 caracteres: 160 caracteres terminando em “…”", () => {
    const descricao = descricaoDaLinha({ tipo: "mensalidade", turma: "t".repeat(200), mes: "2026-10" });
    expect([...descricao]).toHaveLength(160);
    expect(descricao.endsWith("…")).toBe(true);
    expect(descricao.startsWith("Mensalidade · ttt")).toBe(true);
  });

  it("oficina: “{oficina} · {dd/mm}”; experimental: “Aula experimental · {turma} · {dd/mm}”", () => {
    expect(
      descricaoDaLinha({ tipo: "inscricao", experimental: false, titulo: "Oficina de esmalte", data: "2026-10-10" }),
    ).toBe("Oficina de esmalte · 10/10");
    expect(
      descricaoDaLinha({ tipo: "inscricao", experimental: true, titulo: "Torno iniciante", data: "2026-10-07" }),
    ).toBe("Aula experimental · Torno iniciante · 07/10");
  });

  it("uso livre: “Uso livre · {h} h × {n} pessoas · {dd/mm}” (uma pessoa, sem o “×”)", () => {
    expect(descricaoDaLinha({ tipo: "uso_livre", horas: 3, pessoas: 2, data: "2026-10-12" })).toBe(
      "Uso livre · 3 h × 2 pessoas · 12/10",
    );
    expect(descricaoDaLinha({ tipo: "uso_livre", horas: 1, pessoas: 1, data: "2026-10-12" })).toBe(
      "Uso livre · 1 h · 12/10",
    );
  });
});

describe("subLinhaDaCobranca — a sub-linha de “A receber” (UI-SPEC)", () => {
  it("mensalidade, cheia e proporcional", () => {
    expect(subLinhaDaCobranca(mensalidade())).toBe("Mensalidade · Torno iniciante · outubro · vence dia 5");
    expect(subLinhaDaCobranca(mensalidade({ proporcional: true }))).toBe(
      "Mensalidade · Torno iniciante (proporcional) · outubro · vence dia 5",
    );
  });

  it("oficina e experimental", () => {
    expect(subLinhaDaCobranca(inscricao())).toBe("Oficina de esmalte · 10/10");
    expect(subLinhaDaCobranca(inscricao({ experimental: true, titulo: "Torno iniciante" }))).toBe(
      "Aula experimental · Torno iniciante · 10/10",
    );
  });

  it("uso livre com pessoas e material", () => {
    expect(subLinhaDaCobranca(usoLivre())).toBe("Uso livre · 3 h · 12/10");
    const texto = subLinhaDaCobranca(
      usoLivre({
        pessoas: 2,
        materiais: [
          { nome: "Argila", quantidadeMilesimos: 1200, unidade: "kg", cobrar: true, valorCentavos: 2160 },
          { nome: "Esmalte", quantidadeMilesimos: 100, unidade: "l", cobrar: false, valorCentavos: null },
        ],
      }),
    );
    expect(texto.replace(/ /g, " ")).toBe("Uso livre · 3 h × 2 pessoas · 12/10 · material R$ 21,60");
  });
});

describe("linhasDaVenda — como a cobrança vira linhas de venda (D-04, D-14, Pitfall 3)", () => {
  it("mensalidade: UMA linha do item “Mensalidade”, quantidade 1, valor da mensalidade", () => {
    expect(linhasDaVenda(mensalidade({ proporcional: true, valorCentavos: 24000 }), ITENS)).toEqual([
      {
        tipo: "item",
        itemId: "item-mens",
        descricao: "Mensalidade · Torno iniciante · outubro",
        categoriaId: "cat-aulas",
        quantidade: 1,
        valorCentavos: 24000,
      },
    ]);
  });

  it("inscrição de oficina e experimental: o item “Inscrição em oficina”", () => {
    expect(linhasDaVenda(inscricao(), ITENS)).toEqual([
      {
        tipo: "item",
        itemId: "item-insc",
        descricao: "Oficina de esmalte · 10/10",
        categoriaId: "cat-aulas",
        quantidade: 1,
        valorCentavos: 18000,
      },
    ]);
    const [linha] = linhasDaVenda(inscricao({ experimental: true, titulo: "Torno", valorCentavos: 8000 }), ITENS);
    expect(linha).toMatchObject({ itemId: "item-insc", descricao: "Aula experimental · Torno · 10/10", valorCentavos: 8000 });
  });

  it("uso livre com 2 materiais cobrados e 1 incluso: 1 linha de item + 2 livres na categoria do item", () => {
    const uso = usoLivre({
      horas: 3,
      pessoas: 2,
      precoHoraCentavos: 3000,
      valorCentavos: 3 * 2 * 3000 + 2160 + 450,
      materiais: [
        { nome: "Argila branca", quantidadeMilesimos: 1200, unidade: "kg", cobrar: true, valorCentavos: 2160 },
        { nome: "Esmalte", quantidadeMilesimos: 500, unidade: "l", cobrar: false, valorCentavos: null },
        { nome: "Engobe", quantidadeMilesimos: 3000, unidade: "un", cobrar: true, valorCentavos: 450 },
      ],
    });
    const linhas = linhasDaVenda(uso, ITENS);
    expect(linhas).toEqual([
      {
        tipo: "item",
        itemId: "item-uso",
        descricao: "Uso livre · 3 h × 2 pessoas · 12/10",
        categoriaId: "cat-espaco",
        quantidade: 1,
        valorCentavos: 18000,
      },
      { tipo: "livre", descricao: "Argila branca · 1,2 kg", categoriaId: "cat-espaco", valorCentavos: 2160 },
      { tipo: "livre", descricao: "Engobe · 3 un", categoriaId: "cat-espaco", valorCentavos: 450 },
    ]);
    expect(linhas.reduce((soma, linha) => soma + linha.valorCentavos, 0)).toBe(uso.valorCentavos);
  });

  it("a soma das linhas diferente do valor congelado é defeito, nunca desconto automático", () => {
    expect(() => linhasDaVenda(usoLivre({ valorCentavos: 9001 }), ITENS)).toThrow();
  });

  it("nome de material de 200 caracteres: a descrição cabe em 160", () => {
    const [, livre] = linhasDaVenda(
      usoLivre({
        valorCentavos: 9000 + 100,
        materiais: [{ nome: "a".repeat(200), quantidadeMilesimos: 1000, unidade: "kg", cobrar: true, valorCentavos: 100 }],
      }),
      ITENS,
    );
    expect([...livre.descricao].length).toBeLessThanOrEqual(160);
    expect(livre.descricao.endsWith(" · 1 kg")).toBe(true);
  });
});

describe("pureza do módulo de A receber", () => {
  it("não importa React, Next, drizzle-orm, pg nem @/db e não lê o relógio", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/receber.ts"), "utf8");
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });
});

// Plano 05-12 (AGE-16): o lote — todas as mensalidades a receber de uma vez, uma venda por mensalidade.
describe("loteDeMensalidades — quem entra no lote, em que ordem, e o total exato", () => {
  it("só mensalidades livres: a receber e com venda cancelada (D-08); nunca lançada, paga, dispensada (D-09) nem de valor 0", () => {
    const lote = loteDeMensalidades([
      mensalidade({ id: "m-livre" }),
      mensalidade({ id: "m-cancelada", documentoId: "d-1", numeroDaVenda: 7, canceladoEm: "2026-10-01T12:00:00Z" }),
      mensalidade({ id: "m-lancada", documentoId: "d-2", numeroDaVenda: 8, parcelasEmAberto: 1 }),
      mensalidade({ id: "m-paga", documentoId: "d-3", numeroDaVenda: 9 }),
      mensalidade({ id: "m-dispensada", dispensadaEm: "2026-10-02T12:00:00Z" }),
      mensalidade({ id: "m-zero", valorCentavos: 0 }),
      inscricao({ id: "i-1" }),
      usoLivre({ id: "u-1" }),
    ]);
    expect(lote.linhas.map((linha) => linha.id)).toEqual(["m-cancelada", "m-livre"].sort());
    expect(lote.quantas).toBe(2);
  });

  it("ordena por turma e nome (sem acento nem caixa), depois pelo id; a mesma pessoa em duas turmas = duas linhas (A6)", () => {
    const lote = loteDeMensalidades([
      mensalidade({ id: "m-4", turma: "Torno", nome: "Caio" }),
      mensalidade({ id: "m-2", turma: "Modelagem", nome: "caio" }),
      mensalidade({ id: "m-1", turma: "Modelagem", nome: "Ágata" }),
      mensalidade({ id: "m-3", turma: "Torno", nome: "Bia" }),
      mensalidade({ id: "m-0", turma: "Torno", nome: "Bia" }),
    ]);
    expect(lote.linhas.map((linha) => linha.id)).toEqual(["m-1", "m-2", "m-0", "m-3", "m-4"]);
  });

  it("o total em centavos é a soma exata das linhas, proporcionais incluídas", () => {
    const lote = loteDeMensalidades([
      mensalidade({ id: "m-1", valorCentavos: 32000 }),
      mensalidade({ id: "m-2", valorCentavos: 10667, proporcional: true }),
      mensalidade({ id: "m-3", valorCentavos: 1 }),
    ]);
    expect(lote.totalCentavos).toBe(42668);
    expect(lote.linhas.find((linha) => linha.id === "m-2")).toMatchObject({ proporcional: true, valorCentavos: 10667 });
  });

  it("cada linha leva o que a tela e a venda precisam: nome, turma, mês, vencimento, valor", () => {
    const [linha] = loteDeMensalidades([mensalidade()]).linhas;
    expect(linha).toEqual({
      id: "m-1",
      nome: "Marina Lopes",
      turma: "Torno iniciante",
      mes: "2026-10-01",
      vencimento: "2026-10-05",
      valorCentavos: 32000,
      proporcional: false,
    });
  });

  it("vazio: sem mensalidade livre, o lote não tem linha e o total é zero", () => {
    expect(loteDeMensalidades([inscricao(), usoLivre()])).toEqual({ linhas: [], totalCentavos: 0, quantas: 0 });
  });
});

describe("rótulos do lote — singular de verdade com uma (E16 zero-one-many)", () => {
  it("a sanfona", () => {
    expect(resumoDoLote(1)).toBe("Lançar todas as mensalidades de uma vez (1) — ver quem entra");
    expect(resumoDoLote(4)).toBe("Lançar todas as mensalidades de uma vez (4) — ver quem entra");
  });

  it("o botão: “esta 1”, nunca “estas 1”", () => {
    expect(rotuloDoBotaoDoLote(1, "R$ 320,00")).toBe("Lançar esta 1 na Venda · R$ 320,00");
    expect(rotuloDoBotaoDoLote(4, "R$ 1.280,00")).toBe("Lançar estas 4 na Venda · R$ 1.280,00");
  });

  // A confirmação final do lote — decisão do dono no chat, 02/10/2026 (VERIFICACAO-COWORK-05 §2 item 3).
  it("a confirmação: título e botão no singular de verdade com uma", () => {
    expect(tituloConfirmarLote(1)).toBe("Lançar 1 venda?");
    expect(tituloConfirmarLote(4)).toBe("Lançar 4 vendas?");
    expect(rotuloConfirmarLote(1)).toBe("Lançar 1 venda");
    expect(rotuloConfirmarLote(20)).toBe("Lançar 20 vendas");
  });

  it("a confirmação: o corpo diz quantas, o total e que desfazer é cancelar uma a uma no Caixa", () => {
    const plural = corpoConfirmarLote(4, "R$ 900,00");
    expect(plural).toContain("4 vendas");
    expect(plural).toContain("R$ 900,00");
    expect(plural).toContain("cancelar uma a uma no Caixa");

    const singular = corpoConfirmarLote(1, "R$ 320,00");
    expect(singular).toContain("1 venda,");
    expect(singular).not.toContain("vendas");
    expect(singular).toContain("R$ 320,00");
    expect(singular).toContain("no Caixa");
  });

  it("o toast e a corrida", () => {
    expect(toastDoLote(1)).toBe("1 mensalidade lançada na Venda. A parcela está em “o que vence” do Caixa.");
    expect(toastDoLote(4)).toBe("4 mensalidades lançadas na Venda. As parcelas estão em “o que vence” do Caixa.");
    expect(fraseCorridaDoLote(0, 4)).toBe("0 lançadas; 4 já estavam lançadas.");
  });

  it("a linha da lista, com “ (proporcional)” no fim", () => {
    expect(linhaDoLote("Ana", "Torno", "outubro", "R$ 106,67", true)).toBe("Ana · Torno · outubro · R$ 106,67 (proporcional)");
    expect(linhaDoLote("Ana", "Torno", "outubro", "R$ 320,00", false)).toBe("Ana · Torno · outubro · R$ 320,00");
  });
});

describe("podeDispensar — mensalidade e inscrição livres (D-09); o uso livre só com a venda cancelada (decisão do dono, 02/10/2026)", () => {
  it("mensalidade e inscrição a receber podem ser dispensadas", () => {
    expect(podeDispensar({ tipo: "mensalidade", situacao: "a_receber" })).toBe(true);
    expect(podeDispensar({ tipo: "inscricao", situacao: "a_receber" })).toBe(true);
  });

  it("com a venda cancelada no Caixa também (D-08: volta a ser livre)", () => {
    expect(podeDispensar({ tipo: "mensalidade", situacao: "venda_cancelada" })).toBe(true);
    expect(podeDispensar({ tipo: "inscricao", situacao: "venda_cancelada" })).toBe(true);
  });

  it("o uso livre sem venda (a receber), não: “Recebi agora” ou “Lançar na Venda”", () => {
    expect(podeDispensar({ tipo: "uso_livre", situacao: "a_receber" })).toBe(false);
  });

  it("o uso livre com a venda cancelada no Caixa, sim (decisão do dono no chat, 02/10/2026)", () => {
    expect(podeDispensar({ tipo: "uso_livre", situacao: "venda_cancelada" })).toBe(true);
  });

  it("o uso livre lançado, pago ou já dispensado, não", () => {
    for (const situacao of ["lancado", "pago", "dispensada"] as const) {
      expect(podeDispensar({ tipo: "uso_livre", situacao })).toBe(false);
    }
  });

  it("o que virou venda ativa (lançado ou pago) ou já foi dispensado, não", () => {
    for (const situacao of ["lancado", "pago", "dispensada"] as const) {
      expect(podeDispensar({ tipo: "mensalidade", situacao })).toBe(false);
      expect(podeDispensar({ tipo: "inscricao", situacao })).toBe(false);
    }
  });

  it("a mensalidade dispensada sai de “A receber”, do total e do lote", () => {
    const dispensada = mensalidade({ id: "m-d", dispensadaEm: "2026-10-02T12:00:00.000Z" });
    const livre = mensalidade({ id: "m-l" });
    const itens = itensAReceber([dispensada, livre]);
    expect(itens.map((item) => item.id)).toEqual(["m-l"]);
    expect(totalAReceber(itens)).toBe(32000);
    expect(loteDeMensalidades([dispensada, livre]).linhas.map((linha) => linha.id)).toEqual(["m-l"]);
  });
});

describe("ordenarDispensadas — as mais recentes primeiro (UI-D15)", () => {
  it("ordena pelo instante da dispensa, do mais novo ao mais velho", () => {
    const lista = [
      { id: "a", dispensadaEm: "2026-10-01T10:00:00.000Z" },
      { id: "b", dispensadaEm: "2026-10-03T10:00:00.000Z" },
      { id: "c", dispensadaEm: "2026-10-02T10:00:00.000Z" },
    ];
    expect(ordenarDispensadas(lista).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("no mesmo instante, desempata pelo id; não muda a lista recebida", () => {
    const lista = [
      { id: "z", dispensadaEm: "2026-10-01T10:00:00.000Z" },
      { id: "k", dispensadaEm: "2026-10-01T10:00:00.000Z" },
    ];
    expect(ordenarDispensadas(lista).map((item) => item.id)).toEqual(["k", "z"]);
    expect(lista.map((item) => item.id)).toEqual(["z", "k"]);
  });
});

describe("quantasDispensadasDaUrl — 20 por vez", () => {
  it("sem parâmetro, ou estranho, mostra 20", () => {
    for (const valor of [undefined, null, "", "abc", "15", "25", "-20", "20.0", ["40"]] as const) {
      expect(quantasDispensadasDaUrl(valor)).toBe(DISPENSADAS_POR_VEZ);
    }
  });

  it("múltiplos de 20 valem, com teto de 500", () => {
    expect(quantasDispensadasDaUrl("40")).toBe(40);
    expect(quantasDispensadasDaUrl("500")).toBe(500);
    expect(quantasDispensadasDaUrl("9000")).toBe(500);
  });
});

describe("frases da dispensa (UI-SPEC §Confirmações, “Dispensadas — linha”)", () => {
  it("o título diz o que é dispensado", () => {
    expect(tituloConfirmarDispensar("mensalidade", "Marina")).toBe("Dispensar a mensalidade de Marina?");
    expect(tituloConfirmarDispensar("inscricao", "Caio")).toBe("Dispensar a inscrição de Caio?");
  });

  it("a sub-linha termina na data sem motivo, e leva o motivo quando há", () => {
    expect(subLinhaDispensada("Theo", "02/10", null)).toBe("dispensada por Theo em 02/10");
    expect(subLinhaDispensada("Theo", "02/10", "bolsa")).toBe("dispensada por Theo em 02/10 · bolsa");
  });
});
