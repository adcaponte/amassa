import { describe, expect, it } from "vitest";

import {
  agruparContagem,
  conferirSaldoDoCusto,
  modoDoMaterial,
  planejarContagem,
  previaDaContagem,
  progressoDaContagem,
  type MaterialParaContagem,
} from "@/lib/estoque/contagem";
import { esquemaConfirmarContagem } from "@/lib/estoque/esquemas";
import { pedidoDeContagem } from "@/lib/estoque/pedidos";
import {
  FRASE_CONTADO_VAZIO,
  FRASE_CONTAGEM_DESATUALIZADA,
  FRASE_CUSTO_DA_CONTAGEM,
  fraseSaldoMudouNaContagem,
} from "@/lib/estoque/textos";

// A contagem do estoque (06-10-PLAN.md, Tarefa 1). Um `it` por comportamento do `<behavior>` do
// plano, mais as arestas de EST-17 (boundary, adjacency, empty, ordering, precision, idempotency).
// Nomes inventados — nenhum dado real.

let sequencia = 0;
function material(parcial: Partial<MaterialParaContagem> & { nome: string }): MaterialParaContagem {
  sequencia += 1;
  return {
    id: `id-${String(sequencia).padStart(3, "0")}`,
    unidade: "un",
    area: "pecas",
    categoriaCompraNome: "Insumos",
    ativo: true,
    temManual: false,
    ...parcial,
  };
}

describe("modoDoMaterial — o modo é por material, nunca por visita (UI-D2)", () => {
  it("sem nenhuma movimentação manual → primeira contagem", () => {
    expect(modoDoMaterial({ temManual: false })).toBe("primeira");
  });

  it("com movimentação manual → conferência", () => {
    expect(modoDoMaterial({ temManual: true })).toBe("conferencia");
  });
});

describe("planejarContagem — primeira contagem, pela diferença (D-17 refinado, Pitfall 3)", () => {
  it("saldo zero, contado 10 com custo → entrada de 10 com o custo, motivo saldo_inicial", () => {
    expect(
      planejarContagem({ modo: "primeira", saldoMilesimos: 0, contadoMilesimos: 10000, custouCentavos: 5000 }),
    ).toEqual({
      tipo: "entrada",
      diferencaMilesimos: 10000,
      custouCentavos: 5000,
      motivo: "saldo_inicial",
      saldoAntesMilesimos: 0,
      saldoDepoisMilesimos: 10000,
    });
  });

  // UI-D14 (06.5): a contagem segue a regra da entrada — vazio vale R$ 0. Até 05/10/2026 o vazio
  // e o zero eram recusados com “Diga quanto custou — uma estimativa serve.”.
  it("diferença positiva sem custo (ou com custo zero) entra a R$ 0 (D-04, UI-D14)", () => {
    for (const custouCentavos of [null, 0]) {
      expect(
        planejarContagem({ modo: "primeira", saldoMilesimos: 0, contadoMilesimos: 10000, custouCentavos }),
      ).toEqual({
        tipo: "entrada",
        diferencaMilesimos: 10000,
        custouCentavos: 0,
        motivo: "saldo_inicial",
        saldoAntesMilesimos: 0,
        saldoDepoisMilesimos: 10000,
      });
    }
  });

  it("custo negativo ou que não é centavo inteiro continua recusado com a frase da contagem", () => {
    for (const custouCentavos of [-100, 12.5, Number.NaN]) {
      expect(
        planejarContagem({ modo: "primeira", saldoMilesimos: 0, contadoMilesimos: 10000, custouCentavos }),
      ).toEqual({ tipo: "recusa", erro: FRASE_CUSTO_DA_CONTAGEM, saldoAntesMilesimos: 0 });
    }
    expect(FRASE_CUSTO_DA_CONTAGEM).toBe("Diga quanto custou — uma estimativa serve.");
  });

  it("uma venda antes da contagem (saldo −2): entra a DIFERENÇA, e o saldo termina no contado", () => {
    const plano = planejarContagem({
      modo: "primeira",
      saldoMilesimos: -2000,
      contadoMilesimos: 10000,
      custouCentavos: 6000,
    });
    expect(plano).toMatchObject({ tipo: "entrada", diferencaMilesimos: 12000, saldoDepoisMilesimos: 10000 });
  });

  it("contado abaixo do saldo → ajuste para menos, motivo saldo_inicial, sem pedir custo", () => {
    expect(
      planejarContagem({ modo: "primeira", saldoMilesimos: 5000, contadoMilesimos: 3000, custouCentavos: null }),
    ).toEqual({
      tipo: "ajuste",
      diferencaMilesimos: -2000,
      motivo: "saldo_inicial",
      saldoAntesMilesimos: 5000,
      saldoDepoisMilesimos: 3000,
    });
  });

  it("zero sobre saldo zero → nada (e o material continua sem contagem — consequência aceita)", () => {
    expect(
      planejarContagem({ modo: "primeira", saldoMilesimos: 0, contadoMilesimos: 0, custouCentavos: null }),
    ).toEqual({ tipo: "nada", saldoAntesMilesimos: 0 });
  });
});

describe("planejarContagem — conferência (D-18, EST-07, EST-08, D-32)", () => {
  it("contado igual ao saldo → nada (idempotência: confirmar de novo não grava)", () => {
    expect(
      planejarContagem({ modo: "conferencia", saldoMilesimos: 4000, contadoMilesimos: 4000, custouCentavos: null }),
    ).toEqual({ tipo: "nada", saldoAntesMilesimos: 4000 });
  });

  it("contado zero é válido → ajuste de −4000, sem motivo", () => {
    expect(
      planejarContagem({ modo: "conferencia", saldoMilesimos: 4000, contadoMilesimos: 0, custouCentavos: null }),
    ).toEqual({
      tipo: "ajuste",
      diferencaMilesimos: -4000,
      motivo: null,
      saldoAntesMilesimos: 4000,
      saldoDepoisMilesimos: 0,
    });
  });

  it("contado acima → ajuste de +100, e o custo nunca é exigido na conferência", () => {
    const plano = planejarContagem({
      modo: "conferencia",
      saldoMilesimos: 4000,
      contadoMilesimos: 4100,
      custouCentavos: null,
    });
    expect(plano).toMatchObject({ tipo: "ajuste", diferencaMilesimos: 100, motivo: null });
    const comCusto = planejarContagem({
      modo: "conferencia",
      saldoMilesimos: 4000,
      contadoMilesimos: 4100,
      custouCentavos: 999,
    });
    expect(comCusto).toEqual(plano);
  });

  it("contado negativo ou fracionário de milésimo é erro de programação (inteiros só)", () => {
    expect(() =>
      planejarContagem({ modo: "conferencia", saldoMilesimos: 0, contadoMilesimos: -1, custouCentavos: null }),
    ).toThrow(RangeError);
    expect(() =>
      planejarContagem({ modo: "primeira", saldoMilesimos: 0, contadoMilesimos: 1.5, custouCentavos: 100 }),
    ).toThrow(RangeError);
  });
});

describe("previaDaContagem — a frase que aparece depois de digitar (UI-D16)", () => {
  it("diz de quanto para quanto o saldo passa, com o sinal tipográfico", () => {
    expect(previaDaContagem({ saldoMilesimos: -2000, contadoMilesimos: 10000, unidade: "un" })).toBe(
      "o saldo passa de −2 para 10 un",
    );
    expect(previaDaContagem({ saldoMilesimos: 2500, contadoMilesimos: 2250, unidade: "kg" })).toBe(
      "o saldo passa de 2,5 para 2,25 kg",
    );
  });

  it("diferença zero: já está certo", () => {
    expect(previaDaContagem({ saldoMilesimos: 4000, contadoMilesimos: 4000, unidade: "un" })).toBe(
      "já está certo — nada será gravado",
    );
  });
});

describe("agruparContagem — dois grupos, área na ordem fixa, nome pt-BR", () => {
  it("separa por temManual, ordena por área e nome, exclui desativados e omite grupo vazio", () => {
    const itens = [
      material({ nome: "Esmalte azul", area: "pecas" }),
      material({ nome: "Café em grão", area: "cafeteria" }),
      material({ nome: "Argila", area: "pecas" }),
      material({ nome: "Água", area: "pecas" }),
      material({ nome: "Sacola", area: "loja", temManual: true }),
      material({ nome: "Guardanapo", area: "cafeteria", temManual: true }),
      material({ nome: "Velho", area: "geral", ativo: false }),
    ];
    const grupos = agruparContagem(itens, { busca: "", area: null });
    expect(grupos.map((grupo) => grupo.modo)).toEqual(["primeira", "conferencia"]);
    expect(grupos[0].areas.map((area) => area.area)).toEqual(["cafeteria", "pecas"]);
    expect(grupos[0].areas[1].itens.map((item) => item.nome)).toEqual(["Água", "Argila", "Esmalte azul"]);
    expect(grupos[0].quantos).toBe(4);
    expect(grupos[1].areas.map((area) => area.area)).toEqual(["cafeteria", "loja"]);
    expect(grupos[1].quantos).toBe(2);

    const soPrimeira = agruparContagem(
      itens.filter((item) => !item.temManual),
      { busca: "", area: null },
    );
    expect(soPrimeira.map((grupo) => grupo.modo)).toEqual(["primeira"]);
  });

  it("filtra por busca sem acento (nome ou categoria) e por área, como a aba Saldos", () => {
    const itens = [
      material({ nome: "Café em grão", area: "cafeteria", categoriaCompraNome: "Insumos da cafeteria" }),
      material({ nome: "Argila", area: "pecas", categoriaCompraNome: "Argila e esmalte" }),
      material({ nome: "Sacola", area: "loja", temManual: true, categoriaCompraNome: "Embalagem" }),
    ];
    expect(
      agruparContagem(itens, { busca: "CAFE", area: null }).flatMap((g) => g.areas.flatMap((a) => a.itens.map((i) => i.nome))),
    ).toEqual(["Café em grão"]);
    expect(
      agruparContagem(itens, { busca: "embalagem", area: null }).map((g) => g.modo),
    ).toEqual(["conferencia"]);
    expect(
      agruparContagem(itens, { busca: "", area: "pecas" }).flatMap((g) => g.areas.flatMap((a) => a.itens.map((i) => i.nome))),
    ).toEqual(["Argila"]);
    expect(agruparContagem(itens, { busca: "nada disso", area: null })).toEqual([]);
  });

  it("sem nenhum material → nenhum grupo", () => {
    expect(agruparContagem([], { busca: "", area: null })).toEqual([]);
  });
});

describe("progressoDaContagem", () => {
  it("“{c} de {t} contados hoje”", () => {
    expect(progressoDaContagem({ contadosHoje: 3, total: 12 })).toBe("3 de 12 contados hoje");
    expect(progressoDaContagem({ contadosHoje: 1, total: 1 })).toBe("1 de 1 contados hoje");
  });
});

describe("pedidoDeContagem — o que vai para o livro", () => {
  it("entrada da primeira contagem: preço informado, motivo saldo_inicial, contado gravado", () => {
    const plano = planejarContagem({
      modo: "primeira",
      saldoMilesimos: -2000,
      contadoMilesimos: 10000,
      custouCentavos: 6000,
    });
    expect(pedidoDeContagem(plano, { itemId: "item-1", contadoMilesimos: 10000 })).toEqual({
      itemId: "item-1",
      origem: "manual",
      tipo: "entrada",
      movimento: { tipo: "entrada_com_preco", milesimos: 12000, pagoCentavos: 6000 },
      valorInformadoCentavos: 6000,
      motivo: "saldo_inicial",
      saldoContadoMilesimos: 10000,
    });
  });

  it("ajuste da primeira contagem leva o motivo; o da conferência, não", () => {
    const primeira = planejarContagem({
      modo: "primeira",
      saldoMilesimos: 5000,
      contadoMilesimos: 3000,
      custouCentavos: null,
    });
    expect(pedidoDeContagem(primeira, { itemId: "item-1", contadoMilesimos: 3000 })).toEqual({
      itemId: "item-1",
      origem: "manual",
      tipo: "ajuste",
      movimento: { tipo: "saida", milesimos: 2000 },
      saldoContadoMilesimos: 3000,
      motivo: "saldo_inicial",
    });
    const conferencia = planejarContagem({
      modo: "conferencia",
      saldoMilesimos: 4000,
      contadoMilesimos: 4100,
      custouCentavos: null,
    });
    expect(pedidoDeContagem(conferencia, { itemId: "item-2", contadoMilesimos: 4100 })).toEqual({
      itemId: "item-2",
      origem: "manual",
      tipo: "ajuste",
      movimento: { tipo: "entrada_sem_preco", milesimos: 100 },
      saldoContadoMilesimos: 4100,
    });
  });

  it("plano sem gravação não vira pedido", () => {
    const nada = planejarContagem({
      modo: "conferencia",
      saldoMilesimos: 4000,
      contadoMilesimos: 4000,
      custouCentavos: null,
    });
    expect(() => pedidoDeContagem(nada, { itemId: "item-1", contadoMilesimos: 4000 })).toThrow(RangeError);
  });
});

describe("conferirSaldoDoCusto — o custo vale para a diferença que a pessoa viu (revisão WR-03)", () => {
  it("primeira contagem com custo e o saldo mudou no meio: recusa dizendo de quanto para quanto", () => {
    // A tela mostrou −2 e a pessoa contou 10: precificou 12 un. Uma venda levou o saldo a −3.
    const plano = planejarContagem({
      modo: "primeira",
      saldoMilesimos: -3000,
      contadoMilesimos: 10000,
      custouCentavos: 12000,
    });
    expect(plano.tipo).toBe("entrada");
    expect(conferirSaldoDoCusto({ plano, saldoEsperadoMilesimos: -2000, unidade: "un" })).toBe(
      "O saldo mudou de −2 para −3 un enquanto você contava — confira o custo e confirme de novo.",
    );
    expect(fraseSaldoMudouNaContagem("−2", "−3", "un")).toBe(
      "O saldo mudou de −2 para −3 un enquanto você contava — confira o custo e confirme de novo.",
    );
  });

  it("primeira contagem com custo e o saldo igual ao da tela: segue", () => {
    const plano = planejarContagem({
      modo: "primeira",
      saldoMilesimos: -2000,
      contadoMilesimos: 10000,
      custouCentavos: 12000,
    });
    expect(conferirSaldoDoCusto({ plano, saldoEsperadoMilesimos: -2000, unidade: "un" })).toBeNull();
  });

  it("ajuste e diferença zero não levam custo: seguem contra o saldo do instante, mesmo que ele tenha mudado", () => {
    const ajusteDaPrimeira = planejarContagem({
      modo: "primeira",
      saldoMilesimos: 5000,
      contadoMilesimos: 3000,
      custouCentavos: null,
    });
    const ajusteDaConferencia = planejarContagem({
      modo: "conferencia",
      saldoMilesimos: -3000,
      contadoMilesimos: 10000,
      custouCentavos: 12000,
    });
    const nada = planejarContagem({
      modo: "primeira",
      saldoMilesimos: 4000,
      contadoMilesimos: 4000,
      custouCentavos: null,
    });
    expect(ajusteDaConferencia.tipo).toBe("ajuste");
    for (const plano of [ajusteDaPrimeira, ajusteDaConferencia, nada]) {
      expect(conferirSaldoDoCusto({ plano, saldoEsperadoMilesimos: 1000, unidade: "kg" })).toBeNull();
    }
  });
});

describe("esquemaConfirmarContagem — o que o servidor aceita", () => {
  const itemId = "7b0c9f3e-2d4a-4c1b-9a8e-1f2d3c4b5a69";

  it("contado aceita zero; custo opcional vira centavos ou nulo", () => {
    expect(esquemaConfirmarContagem.parse({ itemId, contadoTexto: "0", saldoEsperadoMilesimos: 0 })).toEqual({
      itemId,
      contadoMilesimos: 0,
      custouCentavos: null,
      saldoEsperadoMilesimos: 0,
    });
    expect(esquemaConfirmarContagem.parse({ itemId, contadoTexto: "10", custouTexto: "50,00", saldoEsperadoMilesimos: -2000 })).toEqual({
      itemId,
      contadoMilesimos: 10000,
      custouCentavos: 5000,
      saldoEsperadoMilesimos: -2000,
    });
    expect(esquemaConfirmarContagem.parse({ itemId, contadoTexto: "2,5", custouTexto: "", saldoEsperadoMilesimos: 4000 })).toEqual({
      itemId,
      contadoMilesimos: 2500,
      custouCentavos: null,
      saldoEsperadoMilesimos: 4000,
    });
  });

  it("revisão WR-03: sem o saldo que a tela usou (ou com um que não é inteiro), recusa pedindo para recarregar", () => {
    for (const saldoEsperadoMilesimos of [undefined, null, "4000", 1.5]) {
      const resultado = esquemaConfirmarContagem.safeParse({ itemId, contadoTexto: "4", saldoEsperadoMilesimos });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.message).toBe(FRASE_CONTAGEM_DESATUALIZADA);
    }
  });

  it("contado vazio é recusado com a frase “pode ser zero”", () => {
    const resultado = esquemaConfirmarContagem.safeParse({ itemId, contadoTexto: "", saldoEsperadoMilesimos: 0 });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(FRASE_CONTADO_VAZIO);
    expect(FRASE_CONTADO_VAZIO).toBe("Diga quanto tem na prateleira — pode ser zero.");
  });

  it("custo vazio passa como nulo — a regra pura o lê como R$ 0 (UI-D14)", () => {
    const resultado = esquemaConfirmarContagem.safeParse({ itemId, contadoTexto: "5", custouTexto: "  ", saldoEsperadoMilesimos: 0 });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.custouCentavos).toBeNull();
  });

  it("custo negativo é recusado", () => {
    expect(esquemaConfirmarContagem.safeParse({ itemId, contadoTexto: "1", custouTexto: "-5", saldoEsperadoMilesimos: 0 }).success).toBe(
      false,
    );
  });

  it("custo inválido é recusado", () => {
    expect(esquemaConfirmarContagem.safeParse({ itemId, contadoTexto: "1", custouTexto: "abc", saldoEsperadoMilesimos: 0 }).success).toBe(
      false,
    );
  });
});
