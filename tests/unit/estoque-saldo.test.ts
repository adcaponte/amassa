import { describe, expect, it } from "vitest";

import { formatarReais } from "@/lib/financeiro/formato";
import {
  ORDEM_DAS_AREAS,
  alertaDoItem,
  areaDoItemNoEstoque,
  areasComMaterial,
  atalhosDaUnidade,
  contadorDaLista,
  custoMedioParaExibir,
  custoPreenchidoDaPecaPronta,
  estoqueNuncaContado,
  filtrarSaldos,
  itensParaOInicio,
  normalizarBusca,
  ordenarSaldos,
  planejarAjuste,
  previaDaMovimentacao,
  resumoDoBanner,
  situacaoDoSaldo,
  type EntradaDaPrevia,
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

// ---------------------------------------------------------------------------------------------
// A folha completa (06-05-PLAN.md): o ajuste pelo contado, a prévia do rodapé, os atalhos e o
// custo da peça pronta. A prévia e o servidor leem as MESMAS funções — uma regra, duas leituras.
// ---------------------------------------------------------------------------------------------

describe("planejarAjuste — EST-07/EST-08", () => {
  it("contado igual ao saldo → nada a gravar", () => {
    expect(planejarAjuste({ saldoMilesimos: 2500, contadoMilesimos: 2500 })).toEqual({
      tipo: "nada",
    });
  });

  it("1 milésimo a menos → ajuste de −1", () => {
    expect(planejarAjuste({ saldoMilesimos: 2500, contadoMilesimos: 2499 })).toEqual({
      tipo: "ajuste",
      diferencaMilesimos: -1,
    });
  });

  it("1 milésimo a mais → ajuste de +1", () => {
    expect(planejarAjuste({ saldoMilesimos: 2500, contadoMilesimos: 2501 })).toEqual({
      tipo: "ajuste",
      diferencaMilesimos: 1,
    });
  });

  it("saldo −2000 e prateleira vazia (contado 0) → ajuste de +2000", () => {
    expect(planejarAjuste({ saldoMilesimos: -2000, contadoMilesimos: 0 })).toEqual({
      tipo: "ajuste",
      diferencaMilesimos: 2000,
    });
  });

  it("“2,5” e “2,500” sobre 2500 milésimos: os dois chegam como 2500 — diferença zero", () => {
    // A comparação é em inteiros: nenhum decimal chega aqui.
    expect(planejarAjuste({ saldoMilesimos: 2500, contadoMilesimos: 2500 }).tipo).toBe("nada");
  });

  it("idempotente: depois de gravar a diferença, o mesmo contado de novo não grava nada", () => {
    const primeiro = planejarAjuste({ saldoMilesimos: 3000, contadoMilesimos: 1200 });
    expect(primeiro).toEqual({ tipo: "ajuste", diferencaMilesimos: -1800 });
    const saldoDepois = 3000 + (primeiro.tipo === "ajuste" ? primeiro.diferencaMilesimos : 0);
    expect(planejarAjuste({ saldoMilesimos: saldoDepois, contadoMilesimos: 1200 })).toEqual({
      tipo: "nada",
    });
  });

  it("contado negativo é recusado — a validação já barra, mas a regra não finge", () => {
    expect(() => planejarAjuste({ saldoMilesimos: 0, contadoMilesimos: -1 })).toThrow(RangeError);
  });
});

function previa(parcial: Partial<EntradaDaPrevia>): EntradaDaPrevia {
  return {
    tipo: "saida",
    unidade: "kg",
    saldoMilesimos: 5000,
    valorCentavos: 2100,
    ultimaEntradaComPreco: { valorCentavos: 2100, milesimos: 5000 },
    minimoMilesimos: 0,
    quantidadeMilesimos: null,
    contadoMilesimos: null,
    custoCentavos: null,
    ...parcial,
  };
}

function textoDa(resultado: { partes: readonly { texto: string }[] }): string {
  // `Intl` separa "R$" do número com espaço não separável; o teste compara com espaço comum.
  return resultado.partes
    .map((parte) => parte.texto)
    .join("")
    .replace(/ /g, " ");
}

describe("previaDaMovimentacao — o rodapé da folha (UI-SPEC §Pré-visualização)", () => {
  it("campo vazio → “Digite a quantidade para ver o saldo novo.”, neutra", () => {
    const resultado = previaDaMovimentacao(previa({ quantidadeMilesimos: null }));
    expect(textoDa(resultado)).toBe("Digite a quantidade para ver o saldo novo.");
    expect(resultado.tom).toBe("neutra");
  });

  it("ajuste com o contado vazio também pede a quantidade", () => {
    const resultado = previaDaMovimentacao(previa({ tipo: "ajuste", contadoMilesimos: null }));
    expect(textoDa(resultado)).toBe("Digite a quantidade para ver o saldo novo.");
    expect(resultado.tom).toBe("neutra");
  });

  it("saída de 2 sobre 5 kg com mínimo 4 → saldo, valor ao custo médio e o aviso do mínimo, em atenção", () => {
    const resultado = previaDaMovimentacao(
      previa({ quantidadeMilesimos: 2000, minimoMilesimos: 4000 }),
    );
    expect(textoDa(resultado)).toBe(
      "O saldo passa de 5 para 3 kg. Vale R$ 8,40 ao custo médio. Passa a ficar abaixo do mínimo (4 kg).",
    );
    expect(resultado.tom).toBe("atencao");
  });

  it("os números vão em destaque (negrito na tela)", () => {
    const resultado = previaDaMovimentacao(previa({ quantidadeMilesimos: 2000 }));
    const fortes = resultado.partes
      .filter((parte) => parte.forte)
      .map((parte) => parte.texto.replace(/ /g, " "));
    expect(fortes).toEqual(["5", "3 kg", "R$ 8,40"]);
  });

  it("saída sem mínimo, que não deixa negativo → só saldo e valor, tom de acento", () => {
    const resultado = previaDaMovimentacao(previa({ quantidadeMilesimos: 2000 }));
    expect(textoDa(resultado)).toBe("O saldo passa de 5 para 3 kg. Vale R$ 8,40 ao custo médio.");
    expect(resultado.tom).toBe("acento");
  });

  it("saída que deixa −1 milésimo → a frase do negativo, tom de erro, e nada bloqueia (D-06)", () => {
    const resultado = previaDaMovimentacao(
      previa({ quantidadeMilesimos: 5001, minimoMilesimos: 4000 }),
    );
    expect(textoDa(resultado)).toContain("O saldo passa de 5 para −0,001 kg.");
    expect(textoDa(resultado)).toContain(
      "Isso deixa o saldo negativo — só registre se tiver certeza.",
    );
    expect(textoDa(resultado)).not.toContain("abaixo do mínimo");
    expect(resultado.tom).toBe("erro");
  });

  it("o valor da saída é o de `valorarMovimento` — a mesma regra que vai gravar", () => {
    // 1 kg sai de 3 kg que valem R$ 10,00: 1000 × 1000/3000 = 333,33… → 333.
    const resultado = previaDaMovimentacao(
      previa({ saldoMilesimos: 3000, valorCentavos: 1000, quantidadeMilesimos: 1000 }),
    );
    expect(textoDa(resultado)).toContain("Vale R$ 3,33 ao custo médio.");
  });

  it("entrada com custo → saldo novo e custo unitário", () => {
    const resultado = previaDaMovimentacao(
      previa({ tipo: "entrada", quantidadeMilesimos: 25000, custoCentavos: 12500 }),
    );
    expect(textoDa(resultado)).toBe("O saldo passa de 5 para 30 kg. Custo unitário: R$ 5,00/kg.");
    expect(resultado.tom).toBe("acento");
  });

  it("entrada sem custo → só o saldo novo", () => {
    const resultado = previaDaMovimentacao(
      previa({ tipo: "entrada", quantidadeMilesimos: 2000, custoCentavos: null }),
    );
    expect(textoDa(resultado)).toBe("O saldo passa de 5 para 7 kg.");
  });

  it("entrada em litros usa o rótulo “L”", () => {
    const resultado = previaDaMovimentacao(
      previa({ tipo: "entrada", unidade: "l", quantidadeMilesimos: 2000, custoCentavos: 1000 }),
    );
    expect(textoDa(resultado)).toBe("O saldo passa de 5 para 7 L. Custo unitário: R$ 5,00/L.");
  });

  it("ajuste com diferença → “Diferença de −2 kg. O saldo passa de 5 para 3 kg.”", () => {
    const resultado = previaDaMovimentacao(previa({ tipo: "ajuste", contadoMilesimos: 3000 }));
    expect(textoDa(resultado)).toBe("Diferença de −2 kg. O saldo passa de 5 para 3 kg.");
    expect(resultado.tom).toBe("acento");
  });

  it("ajuste para mais leva o sinal de +", () => {
    const resultado = previaDaMovimentacao(
      previa({ tipo: "ajuste", saldoMilesimos: -2000, valorCentavos: 0, contadoMilesimos: 0 }),
    );
    expect(textoDa(resultado)).toBe("Diferença de +2 kg. O saldo passa de −2 para 0 kg.");
  });

  it("ajuste com o contado igual ao saldo → “O saldo já está certo. Nada será gravado.”, neutra", () => {
    const resultado = previaDaMovimentacao(previa({ tipo: "ajuste", contadoMilesimos: 5000 }));
    expect(textoDa(resultado)).toBe("O saldo já está certo. Nada será gravado.");
    expect(resultado.tom).toBe("neutra");
  });
});

describe("atalhosDaUnidade — os botões que somam ao campo", () => {
  it("un → +1 +2 +5 +10", () => {
    expect(atalhosDaUnidade("un")).toEqual([1, 2, 5, 10]);
  });

  it("g e ml → +50 +100 +250 +500", () => {
    expect(atalhosDaUnidade("g")).toEqual([50, 100, 250, 500]);
    expect(atalhosDaUnidade("ml")).toEqual([50, 100, 250, 500]);
  });

  it("kg → +1 +5 +10 +25", () => {
    expect(atalhosDaUnidade("kg")).toEqual([1, 5, 10, 25]);
  });

  it("L e m → +1 +2 +5 +10", () => {
    expect(atalhosDaUnidade("l")).toEqual([1, 2, 5, 10]);
    expect(atalhosDaUnidade("m")).toEqual([1, 2, 5, 10]);
  });
});

describe("custoPreenchidoDaPecaPronta — EST-21/D-22", () => {
  it("R$ 12,34 por peça × 3 peças → R$ 37,02", () => {
    expect(
      custoPreenchidoDaPecaPronta({ custoPorPecaCentavos: 1234, quantidadeMilesimos: 3000 }),
    ).toBe(3702);
  });

  it("R$ 12,34 × 1,5 → 1851 (em inteiros)", () => {
    expect(
      custoPreenchidoDaPecaPronta({ custoPorPecaCentavos: 1234, quantidadeMilesimos: 1500 }),
    ).toBe(1851);
  });

  it("o meio arredonda para cima: 1 centavo × 0,5 → 1", () => {
    expect(custoPreenchidoDaPecaPronta({ custoPorPecaCentavos: 1, quantidadeMilesimos: 500 })).toBe(
      1,
    );
  });

  it("não perde precisão quando o produto intermediário passa de 2^53", () => {
    expect(
      custoPreenchidoDaPecaPronta({
        custoPorPecaCentavos: 1_000_000_000,
        quantidadeMilesimos: 999_999_001,
      }),
    ).toBe(999_999_001_000_000);
  });
});

// O bloco "Estoque acabando" do Início (06-10-PLAN.md, Tarefa 1): a mesma regra de alerta, até 5
// linhas, negativo primeiro, e o "e mais {N}" com o resto.
describe("itensParaOInicio — D-10, D-21, EST-03", () => {
  it("negativos antes de acabando, cada grupo por nome; ok e mínimo zero com saldo positivo nunca entram", () => {
    const itens = [
      item({ nome: "Sacola", saldoMilesimos: 1000, estoqueMinimoMilesimos: 5000 }),
      item({ nome: "Esmalte", saldoMilesimos: -500, estoqueMinimoMilesimos: 0 }),
      item({ nome: "Argila", saldoMilesimos: 2000, estoqueMinimoMilesimos: 2000 }),
      item({ nome: "Café", saldoMilesimos: 9000, estoqueMinimoMilesimos: 2000 }),
      item({ nome: "Copo", saldoMilesimos: 3000, estoqueMinimoMilesimos: 0 }),
      item({ nome: "Bico", saldoMilesimos: -1000, estoqueMinimoMilesimos: 1000 }),
    ];
    const resultado = itensParaOInicio(itens);
    expect(resultado.linhas.map((linha) => [linha.nome, linha.situacao])).toEqual([
      ["Bico", "negativo"],
      ["Esmalte", "negativo"],
      ["Argila", "acabando"],
      ["Sacola", "acabando"],
    ]);
    expect(resultado.maisN).toBe(0);
  });

  it("no máximo 5 linhas; o resto vira maisN", () => {
    const itens = Array.from({ length: 8 }, (_, indice) =>
      item({ nome: `Material ${indice}`, saldoMilesimos: 0, estoqueMinimoMilesimos: 1000 }),
    );
    const resultado = itensParaOInicio(itens);
    expect(resultado.linhas).toHaveLength(5);
    expect(resultado.maisN).toBe(3);
  });

  it("material desativado não alerta no Início", () => {
    const resultado = itensParaOInicio([
      item({ nome: "Parado", ativo: false, saldoMilesimos: -1000, estoqueMinimoMilesimos: 0 }),
    ]);
    expect(resultado).toEqual({ linhas: [], maisN: 0 });
  });
});

describe("estoqueNuncaContado — o Início convida a contar em vez de alarmar", () => {
  it("material sem nenhuma movimentação manual → nunca contado", () => {
    expect(estoqueNuncaContado({ temMaterial: true, temManual: false })).toBe(true);
  });

  it("qualquer outra combinação → falso", () => {
    expect(estoqueNuncaContado({ temMaterial: true, temManual: true })).toBe(false);
    expect(estoqueNuncaContado({ temMaterial: false, temManual: false })).toBe(false);
    expect(estoqueNuncaContado({ temMaterial: false, temManual: true })).toBe(false);
  });
});
