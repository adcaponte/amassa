import { describe, expect, it } from "vitest";

import { formatarReais } from "@/lib/financeiro/formato";
import {
  ORDEM_DAS_AREAS,
  alertaDoItem,
  areaDoItemNoEstoque,
  areasComMaterial,
  contadorDaLista,
  custoMedioParaExibir,
  filtrarSaldos,
  normalizarBusca,
  ordenarSaldos,
  resumoDoBanner,
  situacaoDoSaldo,
  type SaldoParaLista,
} from "@/lib/estoque/saldo";

// A regra de alerta do Estoque (06-04-PLAN.md, Tarefa 1). Um `it` por comportamento do
// `<behavior>` do plano, mais as arestas sondadas de EST-02/03/04/12 que o plano lista em
// `must_haves.truths`. Nomes inventados — nenhum dado real.

let sequencia = 0;
function item(parcial: Partial<SaldoParaLista> & { nome: string }): SaldoParaLista {
  sequencia += 1;
  return {
    id: `id-${sequencia}`,
    unidade: "kg",
    ativo: true,
    area: "pecas",
    categoriaCompraNome: "Argila, esmalte e insumos",
    saldoMilesimos: 0,
    estoqueMinimoMilesimos: 0,
    valorCentavos: 0,
    ultimaEntradaComPreco: null,
    ...parcial,
  };
}

// Formatador simples para os testes do banner: milésimos → "2 kg", "−1 kg".
function formatarSaldo(milesimos: number, unidade: string): string {
  const absoluto = String(Math.abs(milesimos) / 1000).replace(".", ",");
  return `${milesimos < 0 ? "−" : ""}${absoluto} ${unidade}`;
}

describe("situacaoDoSaldo — EST-03/EST-04/D-21/D-28", () => {
  it("saldo exatamente igual ao mínimo conta como acabando (D-28, `<=`)", () => {
    expect(situacaoDoSaldo({ saldo: 2000, minimo: 2000 })).toBe("acabando");
  });

  it("1 milésimo acima do mínimo não está acabando", () => {
    expect(situacaoDoSaldo({ saldo: 2001, minimo: 2000 })).toBe("ok");
  });

  it("mínimo zero com saldo zero não alerta (EST-04)", () => {
    expect(situacaoDoSaldo({ saldo: 0, minimo: 0 })).toBe("ok");
  });

  it("mínimo zero com saldo −1 milésimo é SÓ negativo, nunca acabando (EST-04 + D-21)", () => {
    expect(situacaoDoSaldo({ saldo: -1, minimo: 0 })).toBe("negativo");
  });

  it("negativo E abaixo do mínimo: negativo vence — um aviso só", () => {
    expect(situacaoDoSaldo({ saldo: -1, minimo: 5000 })).toBe("negativo");
  });

  it("mínimo zero com saldo positivo nunca alerta", () => {
    expect(situacaoDoSaldo({ saldo: 12000, minimo: 0 })).toBe("ok");
  });

  it("a comparação é em milésimos inteiros: 2,5 kg contra mínimo “2,500” kg é igual", () => {
    // "2,5" e "2,500" viram os mesmos 2500 milésimos (`textoParaMilesimos`) — nenhum decimal
    // chega a esta função.
    expect(situacaoDoSaldo({ saldo: 2500, minimo: 2500 })).toBe("acabando");
  });
});

describe("alertaDoItem — o material desativado não alerta", () => {
  it("usa situacaoDoSaldo para o ativo", () => {
    expect(alertaDoItem(item({ nome: "A", saldoMilesimos: -5 }))).toBe("negativo");
    expect(alertaDoItem(item({ nome: "B", saldoMilesimos: 10, estoqueMinimoMilesimos: 10 }))).toBe(
      "acabando",
    );
  });

  it("devolve ok para o desativado, mesmo negativo (UI-SPEC: desativado tem só o chip neutro)", () => {
    expect(alertaDoItem(item({ nome: "C", ativo: false, saldoMilesimos: -5 }))).toBe("ok");
  });
});

describe("ordenarSaldos — EST-03 · ordering", () => {
  it("negativos, depois acabando, depois o resto — cada grupo por nome pt-BR", () => {
    const lista = [
      item({ nome: "Argila", saldoMilesimos: 9000 }),
      item({ nome: "Esmalte", saldoMilesimos: 1000, estoqueMinimoMilesimos: 2000 }),
      item({ nome: "Óxido", saldoMilesimos: -1 }),
      item({ nome: "Água destilada", saldoMilesimos: 5000 }),
      item({ nome: "Caulim", saldoMilesimos: 500, estoqueMinimoMilesimos: 500 }),
      item({ nome: "Bórax", saldoMilesimos: -3000, estoqueMinimoMilesimos: 1000 }),
    ];
    expect(ordenarSaldos(lista).map((saldo) => saldo.nome)).toEqual([
      "Bórax",
      "Óxido",
      "Caulim",
      "Esmalte",
      "Água destilada",
      "Argila",
    ]);
  });

  it("“Água” vem antes de “Argila” (localeCompare pt-BR, não ordem de byte)", () => {
    const lista = [item({ nome: "Argila" }), item({ nome: "Água" })];
    expect(ordenarSaldos(lista).map((saldo) => saldo.nome)).toEqual(["Água", "Argila"]);
  });

  it("“café” e “Café” saem na mesma ordem qualquer que seja a ordem de entrada (estável)", () => {
    const minusculo = item({ nome: "café" });
    const maiusculo = item({ nome: "Café" });
    const uma = ordenarSaldos([minusculo, maiusculo]).map((saldo) => saldo.id);
    const outra = ordenarSaldos([maiusculo, minusculo]).map((saldo) => saldo.id);
    expect(uma).toEqual(outra);
  });

  it("não muta a lista de entrada", () => {
    const lista = [item({ nome: "Zinco" }), item({ nome: "Alumina", saldoMilesimos: -1 })];
    const copia = [...lista];
    ordenarSaldos(lista);
    expect(lista).toEqual(copia);
  });
});

describe("areaDoItemNoEstoque — D-12/D-27/EST-12 · adjacency", () => {
  it("compra de Peças e venda de Cafeteria → Peças (a COMPRA vence no Estoque)", () => {
    expect(areaDoItemNoEstoque({ compra: "pecas", venda: "cafeteria" })).toBe("pecas");
  });

  it("sem compra, a venda", () => {
    expect(areaDoItemNoEstoque({ compra: null, venda: "loja" })).toBe("loja");
  });

  it("sem as duas, Geral", () => {
    expect(areaDoItemNoEstoque({ compra: null, venda: null })).toBe("geral");
  });
});

describe("normalizarBusca e a busca de filtrarSaldos — EST-12 · encoding", () => {
  it("“  Café ” vira “cafe” (NFD sem diacríticos, minúsculas, sem espaço nas pontas)", () => {
    expect(normalizarBusca("  Café ")).toBe("cafe");
  });

  it("“cafe” acha o material “Grão de CAFÉ” e o material cuja categoria é “Café e grãos”", () => {
    const peloNome = item({ nome: "Grão de CAFÉ", categoriaCompraNome: "Insumos da cafeteria" });
    const pelaCategoria = item({ nome: "Filtro de papel", categoriaCompraNome: "Café e grãos" });
    const outro = item({ nome: "Argila", categoriaCompraNome: "Argila, esmalte e insumos" });
    const achados = filtrarSaldos([peloNome, pelaCategoria, outro], {
      busca: "cafe",
      area: null,
      acabando: false,
      situacao: "todos",
    });
    expect(achados.map((saldo) => saldo.nome)).toEqual(["Grão de CAFÉ", "Filtro de papel"]);
  });

  it("busca vazia (ou só espaços) mostra todos — EST-12 · empty", () => {
    const lista = [item({ nome: "A" }), item({ nome: "B" })];
    expect(
      filtrarSaldos(lista, { busca: "   ", area: null, acabando: false, situacao: "todos" }),
    ).toHaveLength(2);
  });
});

describe("filtrarSaldos — área, Acabando e situação combinados", () => {
  const pecasAcabando = item({
    nome: "Esmalte",
    area: "pecas",
    saldoMilesimos: 1000,
    estoqueMinimoMilesimos: 2000,
  });
  const pecasNegativo = item({ nome: "Óxido", area: "pecas", saldoMilesimos: -1 });
  const pecasOk = item({ nome: "Argila", area: "pecas", saldoMilesimos: 9000 });
  const cafeAcabando = item({
    nome: "Café",
    area: "cafeteria",
    saldoMilesimos: 100,
    estoqueMinimoMilesimos: 500,
  });
  const desativado = item({ nome: "Engobe", area: "pecas", ativo: false });
  const lista = [pecasAcabando, pecasNegativo, pecasOk, cafeAcabando, desativado];

  it("área Peças + Acabando → só os de Peças acabando ou negativos", () => {
    const achados = filtrarSaldos(lista, {
      busca: "",
      area: "pecas",
      acabando: true,
      situacao: "ativos",
    });
    expect(achados.map((saldo) => saldo.nome)).toEqual(["Esmalte", "Óxido"]);
  });

  it("“ativos” exclui desativados; “desativados” só eles; “todos” ambos", () => {
    const filtro = { busca: "", area: null, acabando: false } as const;
    expect(filtrarSaldos(lista, { ...filtro, situacao: "ativos" })).toHaveLength(4);
    expect(
      filtrarSaldos(lista, { ...filtro, situacao: "desativados" }).map((saldo) => saldo.nome),
    ).toEqual(["Engobe"]);
    expect(filtrarSaldos(lista, { ...filtro, situacao: "todos" })).toHaveLength(5);
  });

  it("nunca reordena — só remove", () => {
    const ordenada = ordenarSaldos(lista);
    const filtrada = filtrarSaldos(ordenada, {
      busca: "",
      area: null,
      acabando: false,
      situacao: "todos",
    });
    expect(filtrada.map((saldo) => saldo.id)).toEqual(ordenada.map((saldo) => saldo.id));
  });

  it("Acabando nunca traz mínimo zero com saldo positivo (EST-04)", () => {
    const semMinimo = item({ nome: "Caulim", saldoMilesimos: 3000, estoqueMinimoMilesimos: 0 });
    expect(
      filtrarSaldos([semMinimo], { busca: "", area: null, acabando: true, situacao: "ativos" }),
    ).toEqual([]);
  });

  it("filtro sem resultado devolve lista vazia (a tela mostra “Nada com esse filtro”)", () => {
    expect(
      filtrarSaldos(lista, { busca: "inexistente", area: null, acabando: false, situacao: "todos" }),
    ).toEqual([]);
  });
});

describe("areasComMaterial — EST-12 · ordering/empty", () => {
  it("só as áreas presentes, na ordem fixa Cafeteria · Espaço · Peças · Loja · Geral", () => {
    const lista = [
      item({ nome: "A", area: "geral" }),
      item({ nome: "B", area: "pecas" }),
      item({ nome: "C", area: "cafeteria" }),
      item({ nome: "D", area: "pecas" }),
    ];
    expect(areasComMaterial(lista)).toEqual(["cafeteria", "pecas", "geral"]);
  });

  it("a ordem fixa é a do Financeiro", () => {
    expect(ORDEM_DAS_AREAS).toEqual(["cafeteria", "espaco", "pecas", "loja", "geral"]);
  });
});

describe("resumoDoBanner — EST-03 · empty / zero-one-many E2 / long-text E2", () => {
  it("nenhum alerta → null (o banner não existe)", () => {
    const lista = [
      item({ nome: "A", saldoMilesimos: 9000, estoqueMinimoMilesimos: 1000 }),
      item({ nome: "B", saldoMilesimos: 0, estoqueMinimoMilesimos: 0 }),
    ];
    expect(resumoDoBanner(lista, formatarSaldo)).toBeNull();
  });

  it("1 acabando → “1 material está acabando”, com o nome e o saldo", () => {
    const resumo = resumoDoBanner(
      [item({ nome: "Esmalte", saldoMilesimos: 2000, estoqueMinimoMilesimos: 2000 })],
      formatarSaldo,
    );
    expect(resumo).toEqual({
      titulo: "1 material está acabando",
      tom: "atencao",
      nomes: "Esmalte (2 kg)",
      linhaNegativos: null,
    });
  });

  it("4 acabando → “4 materiais estão acabando”, 3 nomes e “e mais 1”", () => {
    const lista = ["Dolomita", "Caulim", "Bórax", "Alumina"].map((nome) =>
      item({ nome, saldoMilesimos: 1000, estoqueMinimoMilesimos: 2000 }),
    );
    const resumo = resumoDoBanner(lista, formatarSaldo);
    expect(resumo?.titulo).toBe("4 materiais estão acabando");
    expect(resumo?.nomes).toBe("Alumina (1 kg) · Bórax (1 kg) · Caulim (1 kg) · e mais 1");
  });

  it("só negativos → título próprio “2 materiais com saldo negativo”, em tom de erro", () => {
    const lista = [
      item({ nome: "Óxido", saldoMilesimos: -1000 }),
      item({ nome: "Bórax", saldoMilesimos: -500, estoqueMinimoMilesimos: 2000 }),
    ];
    const resumo = resumoDoBanner(lista, formatarSaldo);
    expect(resumo).toEqual({
      titulo: "2 materiais com saldo negativo",
      tom: "erro",
      nomes: "Bórax (−0,5 kg) · Óxido (−1 kg)",
      linhaNegativos: null,
    });
  });

  it("1 negativo sozinho → singular “1 material com saldo negativo”", () => {
    const resumo = resumoDoBanner([item({ nome: "Óxido", saldoMilesimos: -1 })], formatarSaldo);
    expect(resumo?.titulo).toBe("1 material com saldo negativo");
  });

  it("mistos → linha própria “Com saldo negativo: …”, e o título conta só os acabando", () => {
    const lista = [
      item({ nome: "Esmalte", saldoMilesimos: 1000, estoqueMinimoMilesimos: 2000 }),
      item({ nome: "Óxido", saldoMilesimos: -1000 }),
    ];
    const resumo = resumoDoBanner(lista, formatarSaldo);
    expect(resumo).toEqual({
      titulo: "1 material está acabando",
      tom: "atencao",
      nomes: "Esmalte (1 kg)",
      linhaNegativos: "Com saldo negativo: Óxido (−1 kg)",
    });
  });

  it("material desativado nunca entra no banner", () => {
    const lista = [item({ nome: "Engobe", ativo: false, saldoMilesimos: -1000 })];
    expect(resumoDoBanner(lista, formatarSaldo)).toBeNull();
  });
});

describe("contadorDaLista — populated/zero-one-many E1", () => {
  it("“3 de 10 · R$ 42,00 em estoque”, somando só os saldos positivos", () => {
    const daSituacao = [
      item({ nome: "A", saldoMilesimos: 1000, valorCentavos: 2000 }),
      item({ nome: "B", saldoMilesimos: 500, valorCentavos: 2200 }),
      item({ nome: "C", saldoMilesimos: -1000, valorCentavos: -900 }),
      ...Array.from({ length: 7 }, (_, indice) => item({ nome: `Z${indice}` })),
    ];
    expect(contadorDaLista(3, daSituacao, formatarReais)).toBe(
      `3 de 10 · ${formatarReais(4200)} em estoque`,
    );
    // O formatador real é o do Financeiro: “R$ 42,00” (com o espaço não separável do Intl).
    expect(formatarReais(4200).replace(/\s/g, " ")).toBe("R$ 42,00");
  });

  it("“1 de 1” nunca vira “1 de 1 materiais”", () => {
    expect(contadorDaLista(1, [item({ nome: "A" })], formatarReais)).toBe(
      `1 de 1 · ${formatarReais(0)} em estoque`,
    );
  });
});

describe("custoMedioParaExibir — EST-02 · empty / partial E1", () => {
  it("material sem nenhuma entrada com preço → null (a tela mostra “—”), mesmo com saldo", () => {
    expect(custoMedioParaExibir(item({ nome: "A" }))).toBeNull();
    expect(custoMedioParaExibir(item({ nome: "B", saldoMilesimos: -160 }))).toBeNull();
  });

  it("com entrada com preço → o custo médio do livro, em centavos por unidade", () => {
    const argila = item({
      nome: "Argila",
      saldoMilesimos: 5000,
      valorCentavos: 2100,
      ultimaEntradaComPreco: { valorCentavos: 2100, milesimos: 5000 },
    });
    expect(custoMedioParaExibir(argila)).toBe(420);
  });
});
