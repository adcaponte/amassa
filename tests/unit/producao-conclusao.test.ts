import { describe, expect, it } from "vitest";

import {
  categoriaDeCompraAoLigar,
  derivarPeca,
  destinoSugerido,
  distribuirExtras,
  itemGuardaPecas,
  pecaPedeCategoriaDeCompra,
  resumoDaConclusao,
  type PecaDerivada,
} from "@/lib/producao/conclusao";
import {
  fraseItemNaoGuardaPecas,
  fraseItemNaoGuardaPecasNaConclusao,
  textoItemVaiControlarEstoque,
} from "@/lib/producao/textos";

// A conclusão da ordem (06.1-11-PLAN.md, Tarefa 1): as cinco fórmulas do briefing §7, verbatim, em
// inteiros; o destino sugerido das extras; a divisão das boas entre Estoque e "sem destino"; e o
// resumo que decide a entrega parcial. Nomes e números inventados — nenhum dado real.

function ok(resultado: ReturnType<typeof derivarPeca>): PecaDerivada {
  if (!resultado.ok) {
    throw new Error(`esperava as contas, veio a recusa: ${resultado.frase}`);
  }
  return resultado;
}

describe("derivarPeca — as fórmulas do briefing §7", () => {
  it("encomenda, pedido 10, a mais 2, perdidas 1 → feitas 12, boas 11, entregues 10, extras 1, faltam 0", () => {
    expect(ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: 1 }))).toEqual({
      ok: true,
      feitas: 12,
      perdidas: 1,
      boas: 11,
      entregues: 10,
      extrasBoas: 1,
      faltam: 0,
    });
  });

  it("encomenda, pedido 10, a mais 0, perdidas 3 → boas 7, entregues 7, extras 0, faltam 3", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 0, perdidas: 3 }));
    expect(peca.boas).toBe(7);
    expect(peca.entregues).toBe(7);
    expect(peca.extrasBoas).toBe(0);
    expect(peca.faltam).toBe(3);
  });

  it("encomenda, perdidas = feitas → boas 0, entregues 0, faltam = pedido (PRD-15 · boundary)", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: 12 }));
    expect(peca.boas).toBe(0);
    expect(peca.entregues).toBe(0);
    expect(peca.extrasBoas).toBe(0);
    expect(peca.faltam).toBe(10);
  });

  it("encomenda, 0 perdidas e a mais 0 → entrega tudo, sem extras e sem falta", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 5, aMais: 0, perdidas: 0 }));
    expect(peca).toMatchObject({ feitas: 5, boas: 5, entregues: 5, extrasBoas: 0, faltam: 0 });
  });

  it("perdidas só nas a mais → entrega o pedido inteiro e sobram as extras que restaram", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 3, perdidas: 2 }));
    expect(peca).toMatchObject({ feitas: 13, boas: 11, entregues: 10, extrasBoas: 1, faltam: 0 });
  });

  it("casa, pedido 20, perdidas 2 → boas 18, entregues 0, extras = todas as boas, faltam 0", () => {
    expect(ok(derivarPeca({ tipo: "casa", pedido: 20, aMais: 0, perdidas: 2 }))).toEqual({
      ok: true,
      feitas: 20,
      perdidas: 2,
      boas: 18,
      entregues: 0,
      extrasBoas: 18,
      faltam: 0,
    });
  });

  it("casa, todas perdidas → boas 0, extras 0, faltam 0 (não há pedido de cliente a completar)", () => {
    const peca = ok(derivarPeca({ tipo: "casa", pedido: 4, aMais: 0, perdidas: 4 }));
    expect(peca).toMatchObject({ boas: 0, entregues: 0, extrasBoas: 0, faltam: 0 });
  });

  it("perdidas −1 → recusa “Diga um número de 0 a {feitas}.”", () => {
    expect(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: -1 })).toEqual({
      ok: false,
      frase: "Diga um número de 0 a 12.",
    });
  });

  it("perdidas 13 com feitas 12 → recusa", () => {
    expect(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: 13 })).toEqual({
      ok: false,
      frase: "Diga um número de 0 a 12.",
    });
  });

  it("perdidas 2,5 → recusa (PRD-15 · precision: perdidas é inteiro)", () => {
    expect(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: 2.5 })).toEqual({
      ok: false,
      frase: "Diga um número de 0 a 12.",
    });
  });

  it("perdidas NaN → recusa", () => {
    expect(derivarPeca({ tipo: "casa", pedido: 3, aMais: 0, perdidas: Number.NaN }).ok).toBe(false);
  });
});

describe("destinoSugerido — a sugestão das extras boas (briefing §7, D-12, D-15)", () => {
  it("casa → estoque", () => {
    expect(destinoSugerido({ tipo: "casa", exclusiva: false, temFicha: true })).toBe("estoque");
    expect(destinoSugerido({ tipo: "casa", exclusiva: false, temFicha: false })).toBe("estoque");
  });

  it("encomenda de peça de linha → estoque", () => {
    expect(destinoSugerido({ tipo: "encomenda", exclusiva: false, temFicha: true })).toBe("estoque");
  });

  it("encomenda de peça exclusiva → sem destino", () => {
    expect(destinoSugerido({ tipo: "encomenda", exclusiva: true, temFicha: true })).toBe(
      "sem_destino",
    );
  });

  it("encomenda de peça sem ficha (texto livre) → sem destino, fixo", () => {
    expect(destinoSugerido({ tipo: "encomenda", exclusiva: false, temFicha: false })).toBe(
      "sem_destino",
    );
    expect(destinoSugerido({ tipo: "encomenda", exclusiva: true, temFicha: false })).toBe(
      "sem_destino",
    );
  });
});

describe("distribuirExtras — para onde vão as boas que não foram entregues", () => {
  it("encomenda com 1 extra boa e destino estoque → 1 para o estoque, 0 sem destino", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: 1 }));
    expect(distribuirExtras(peca, "estoque", "encomenda")).toEqual({ paraEstoque: 1, semDestino: 0 });
  });

  it("encomenda com 2 extras e destino sem_destino → 0 e 2", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas: 0 }));
    expect(distribuirExtras(peca, "sem_destino", "encomenda")).toEqual({
      paraEstoque: 0,
      semDestino: 2,
    });
  });

  it("sem extras → zero e zero, qualquer que seja o destino (PRD-16 · boundary)", () => {
    const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 0, perdidas: 3 }));
    expect(distribuirExtras(peca, "estoque", "encomenda")).toEqual({ paraEstoque: 0, semDestino: 0 });
    expect(distribuirExtras(peca, "sem_destino", "encomenda")).toEqual({
      paraEstoque: 0,
      semDestino: 0,
    });
  });

  it("casa → todas as boas para o estoque, mesmo que chegue outro destino (D-15)", () => {
    const peca = ok(derivarPeca({ tipo: "casa", pedido: 20, aMais: 0, perdidas: 2 }));
    expect(distribuirExtras(peca, "sem_destino", "casa")).toEqual({ paraEstoque: 18, semDestino: 0 });
  });

  it("para o estoque + sem destino nunca passa das boas (o check `ordem_pecas_destinos_cabem`)", () => {
    for (const perdidas of [0, 1, 5, 12]) {
      const peca = ok(derivarPeca({ tipo: "encomenda", pedido: 10, aMais: 2, perdidas }));
      for (const destino of ["estoque", "sem_destino"] as const) {
        const { paraEstoque, semDestino } = distribuirExtras(peca, destino, "encomenda");
        expect(paraEstoque + semDestino).toBeLessThanOrEqual(peca.boas);
      }
    }
  });
});

describe("resumoDaConclusao — a entrega parcial e as somas", () => {
  it("nenhuma peça com falta → não é parcial; soma para o estoque e sem destino", () => {
    expect(
      resumoDaConclusao([
        { faltam: 0, paraEstoque: 1, semDestino: 0 },
        { faltam: 0, paraEstoque: 0, semDestino: 2 },
        { faltam: 0, paraEstoque: 3, semDestino: 0 },
      ]),
    ).toEqual({ entregaParcial: false, paraEstoque: 4, semDestino: 2 });
  });

  it("alguma peça com faltam > 0 → entrega parcial", () => {
    expect(
      resumoDaConclusao([
        { faltam: 0, paraEstoque: 1, semDestino: 0 },
        { faltam: 3, paraEstoque: 0, semDestino: 0 },
      ]),
    ).toEqual({ entregaParcial: true, paraEstoque: 1, semDestino: 0 });
  });

  it("lista vazia → nada parcial, nada a guardar", () => {
    expect(resumoDaConclusao([])).toEqual({ entregaParcial: false, paraEstoque: 0, semDestino: 0 });
  });
});

// Revisão 06.1, WR-03: a Produção guarda peças — 1 peça = 1 unidade do item. Material em kg, g, ml,
// L ou m nunca recebe peça (nem no seletor, nem na criação, nem sob a trava da conclusão).
describe("itemGuardaPecas", () => {
  it("aceita o item contado em unidades", () => {
    expect(itemGuardaPecas("un")).toBe(true);
  });

  it("aceita o item ainda sem unidade — o D-13 o liga em un na conclusão", () => {
    expect(itemGuardaPecas(null)).toBe(true);
  });

  it.each(["kg", "g", "ml", "l", "m"])("recusa o material contado em %s", (unidade) => {
    expect(itemGuardaPecas(unidade)).toBe(false);
  });

  it("as frases dizem a unidade e o que fazer", () => {
    expect(fraseItemNaoGuardaPecas("[teste] Argila vermelha", "kg")).toBe(
      "[teste] Argila vermelha é contado em kg no Estoque, e a produção da casa guarda peças inteiras. Escolha um item contado em unidades.",
    );
    expect(fraseItemNaoGuardaPecasNaConclusao("[teste] Argila vermelha", "kg", "encomenda")).toContain(
      "mande as extras desta peça para “sem destino”",
    );
    expect(fraseItemNaoGuardaPecasNaConclusao("[teste] Argila vermelha", "kg", "casa")).toContain(
      "cancele esta ordem e crie outra com um item contado em unidades",
    );
  });
});

// D-13, trocado pelo dono na Parte 0 (30/09/2026): o item que já tem categoria de compra fica com a
// dele; o item sem categoria recebe a escolhida na folha de conclusão; sem as duas, falta.
describe("categoriaDeCompraAoLigar", () => {
  const DA_CASA = "0b1c2d3e-4f50-4a6b-8c7d-000000000001";
  const OUTRA = "0b1c2d3e-4f50-4a6b-8c7d-000000000002";

  it("o item que já tem categoria fica com a dele — a escolhida é ignorada", () => {
    expect(categoriaDeCompraAoLigar(OUTRA, DA_CASA)).toEqual({ tipo: "mantem", categoriaCompraId: OUTRA });
    expect(categoriaDeCompraAoLigar(OUTRA, null)).toEqual({ tipo: "mantem", categoriaCompraId: OUTRA });
  });

  it("o item sem categoria recebe a escolhida na folha", () => {
    expect(categoriaDeCompraAoLigar(null, DA_CASA)).toEqual({
      tipo: "escolhida",
      categoriaCompraId: DA_CASA,
    });
  });

  it("sem categoria e sem escolha (nula ou vazia), falta — o servidor recusa", () => {
    expect(categoriaDeCompraAoLigar(null, null)).toEqual({ tipo: "falta" });
    expect(categoriaDeCompraAoLigar(null, "")).toEqual({ tipo: "falta" });
  });
});

describe("pecaPedeCategoriaDeCompra", () => {
  const semCategoria = { controlaEstoque: false, categoriaCompraId: null };

  it("pede quando o item vai passar a controlar estoque sem categoria", () => {
    expect(pecaPedeCategoriaDeCompra({ paraEstoque: 3, item: semCategoria, vaiSerPromovida: false })).toBe(true);
  });

  it("não pede quando o item já tem categoria — ele a mantém", () => {
    expect(
      pecaPedeCategoriaDeCompra({
        paraEstoque: 3,
        item: { controlaEstoque: false, categoriaCompraId: "0b1c2d3e-4f50-4a6b-8c7d-000000000002" },
        vaiSerPromovida: false,
      }),
    ).toBe(false);
  });

  it("não pede quando o item já controla estoque — nada é ligado", () => {
    expect(
      pecaPedeCategoriaDeCompra({
        paraEstoque: 3,
        item: { controlaEstoque: true, categoriaCompraId: null },
        vaiSerPromovida: false,
      }),
    ).toBe(false);
  });

  it("não pede quando nada vai ao Estoque", () => {
    expect(pecaPedeCategoriaDeCompra({ paraEstoque: 0, item: semCategoria, vaiSerPromovida: false })).toBe(false);
    expect(pecaPedeCategoriaDeCompra({ paraEstoque: 0, item: null, vaiSerPromovida: true })).toBe(false);
  });

  it("pede na exclusiva promovida (D-12): o item nasce agora, sem categoria", () => {
    expect(pecaPedeCategoriaDeCompra({ paraEstoque: 2, item: null, vaiSerPromovida: true })).toBe(true);
    expect(pecaPedeCategoriaDeCompra({ paraEstoque: 2, item: null, vaiSerPromovida: false })).toBe(false);
  });

  it("a caixa diz a categoria que o item já tem, ou aponta para o seletor", () => {
    expect(textoItemVaiControlarEstoque("[teste] Prato raso", "Louça da casa")).toBe(
      "[teste] Prato raso ainda não controla estoque. Ao concluir, ele passa a controlar (em unidades, categoria Louça da casa). Vai passar a aparecer no Estoque.",
    );
    expect(textoItemVaiControlarEstoque("[teste] Prato raso", null)).toBe(
      "[teste] Prato raso ainda não controla estoque. Ao concluir, ele passa a controlar (em unidades, na categoria da compra escolhida abaixo). Vai passar a aparecer no Estoque.",
    );
  });
});
