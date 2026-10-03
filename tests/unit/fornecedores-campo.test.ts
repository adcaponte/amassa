import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fornecedorComNomeIgual,
  MAXIMO_DE_SUGESTOES,
  mensagemDoPainel,
  situacaoDoVinculo,
  sugestoesDoCampo,
  type FornecedorDoCampo,
} from "@/lib/fornecedores/campo";

// O campo "Fornecedor" da Despesa (06.2-10-PLAN.md, Tarefa 1; FRN-12, D-04). Nomes inventados — nenhum
// dado real, nenhum nome do protótipo. A Tarefa 2 acrescenta a matriz de bordas das sugestões; as
// matrizes de `situacaoDoVinculo` com os seis estados são do plano 12 (06.2-12-PLAN.md).

function fornecedor(parcial: Partial<FornecedorDoCampo> & { id: string; nome: string }): FornecedorDoCampo {
  return { vende: null, cidadeEntrega: null, ...parcial };
}

function nomes(lista: readonly FornecedorDoCampo[]): string[] {
  return lista.map((item) => item.nome);
}

describe("sugestoesDoCampo", () => {
  it("“argila” acha quem tem argila no nome ou no que vende, em ordem alfabética", () => {
    const lista = [
      fornecedor({ id: "1", nome: "Zeta Embalagens", vende: "caixa, papel" }),
      fornecedor({ id: "2", nome: "Casa da Argila Fictícia", vende: "barbotina" }),
      fornecedor({ id: "3", nome: "Barro Inventado", vende: "argila, esmalte" }),
      fornecedor({ id: "4", nome: "Loja Qualquer", vende: null, cidadeEntrega: "Argilândia" }),
    ];
    const { opcoes, haMais } = sugestoesDoCampo(lista, "argila");
    expect(nomes(opcoes)).toEqual(["Barro Inventado", "Casa da Argila Fictícia"]);
    expect(haMais).toBe(false);
  });

  it("no máximo 8, com haMais quando passa", () => {
    const lista = Array.from({ length: 12 }, (_, indice) =>
      fornecedor({ id: String(indice), nome: `Fornecedor ${String(indice).padStart(2, "0")}`, vende: "argila" }),
    );
    const { opcoes, haMais } = sugestoesDoCampo(lista, "argila");
    expect(opcoes).toHaveLength(MAXIMO_DE_SUGESTOES);
    expect(MAXIMO_DE_SUGESTOES).toBe(8);
    expect(haMais).toBe(true);
  });
});

// Plano 12: `situacaoDoVinculo` passou a receber a lista de ativos e a devolver `{ estado, … }` — os três
// casos do plano 10 continuam aqui com o mesmo sentido, no formato novo.
const UM_ATIVO = [fornecedor({ id: "x", nome: "Outro Fornecedor Qualquer" })];

describe("situacaoDoVinculo", () => {
  it("campo vazio (ou só espaços) e sem escolha = vazio", () => {
    expect(situacaoDoVinculo({ texto: "", fornecedorId: null, fornecedores: UM_ATIVO })).toEqual({ estado: "vazio" });
    expect(situacaoDoVinculo({ texto: "   ", fornecedorId: null, fornecedores: UM_ATIVO })).toEqual({
      estado: "vazio",
    });
  });

  it("escolhido da lista = ligado", () => {
    expect(situacaoDoVinculo({ texto: "Barro Inventado", fornecedorId: "abc", fornecedores: UM_ATIVO })).toEqual({
      estado: "ligado",
    });
  });

  it("texto sem escolha = texto livre — nunca ligado (nada liga sozinho, UI-D4)", () => {
    expect(situacaoDoVinculo({ texto: "Barro Inventado", fornecedorId: null, fornecedores: UM_ATIVO })).toEqual({
      estado: "texto-livre",
    });
  });

  // Plano 12, Tarefa 1 (o <behavior> do plano).
  it("texto igual (sem acento, caixa ou espaços extras) ao nome de UM ativo, sem escolher = texto-igual-ao-cadastro", () => {
    expect(
      situacaoDoVinculo({
        texto: "  ARGILA sul ",
        fornecedorId: null,
        fornecedores: [{ nome: "Argila Sul" }],
      }),
    ).toEqual({ estado: "texto-igual-ao-cadastro", nome: "Argila Sul" });
  });

  it("cadastro sem nenhum ativo e texto escrito = cadastro-vazio; lista que não carregou = erro", () => {
    expect(situacaoDoVinculo({ texto: "Alguém", fornecedorId: null, fornecedores: [] })).toEqual({
      estado: "cadastro-vazio",
    });
    expect(situacaoDoVinculo({ texto: "Alguém", fornecedorId: null, fornecedores: null })).toEqual({ estado: "erro" });
    expect(situacaoDoVinculo({ texto: "", fornecedorId: null, fornecedores: null })).toEqual({ estado: "erro" });
  });
});

describe("fornecedorComNomeIgual", () => {
  it("devolve o único ativo com o nome igual ao texto normalizado; nenhum → null", () => {
    const lista = [fornecedor({ id: "1", nome: "Argila Sul" }), fornecedor({ id: "2", nome: "Argila Sul Norte" })];
    expect(fornecedorComNomeIgual(lista, "argíla SUL")?.id).toBe("1");
    expect(fornecedorComNomeIgual(lista, "argila")).toBeNull();
    expect(fornecedorComNomeIgual(lista, "")).toBeNull();
  });
});

describe("mensagemDoPainel", () => {
  it("cadastro vazio, sem resultado e há mais — a frase exata; com opções e sem mais, nada", () => {
    const lista = [fornecedor({ id: "1", nome: "Barro Inventado" })];
    expect(mensagemDoPainel({ fornecedores: [], texto: "", sugestoes: sugestoesDoCampo([], "") })).toBe(
      "Nenhum fornecedor cadastrado. Escreva o nome — ou cadastre em Cadastros → Fornecedores.",
    );
    expect(mensagemDoPainel({ fornecedores: lista, texto: "zzz", sugestoes: sugestoesDoCampo(lista, "zzz") })).toBe(
      "Nenhum fornecedor do cadastro com “zzz”. Fica só o nome escrito.",
    );
    const nove = muitos(9);
    expect(mensagemDoPainel({ fornecedores: nove, texto: "olaria", sugestoes: sugestoesDoCampo(nove, "olaria") })).toBe(
      "Há mais fornecedores — continue digitando.",
    );
    expect(mensagemDoPainel({ fornecedores: lista, texto: "barro", sugestoes: sugestoesDoCampo(lista, "barro") })).toBeNull();
    expect(mensagemDoPainel({ fornecedores: null, texto: "x", sugestoes: { opcoes: [], haMais: false } })).toBeNull();
  });
});

// ——— Tarefa 2: as bordas das sugestões que o gestor encontra (acento, caixa, oito e nove, vazio). ———

function muitos(quantos: number): FornecedorDoCampo[] {
  // Ids e nomes fora de ordem de propósito: a ordem da saída é a alfabética, não a de entrada.
  return Array.from({ length: quantos }, (_, indice) => {
    const numero = quantos - indice;
    return fornecedor({
      id: `id-${numero}`,
      nome: `Olaria ${String(numero).padStart(2, "0")}`,
      vende: "argila",
    });
  });
}

describe("sugestoesDoCampo — bordas", () => {
  const lista = [
    fornecedor({ id: "1", nome: "Depósito Sem Nome Útil", vende: "argila branca, esmalte" }),
    fornecedor({ id: "2", nome: "Embalagens Inventadas", vende: "caixa" }),
    fornecedor({ id: "3", nome: "Argileira Fictícia", vende: null }),
  ];

  it("“argila” acha por vende quem não tem argila no nome", () => {
    const { opcoes } = sugestoesDoCampo(lista, "argila");
    expect(nomes(opcoes)).toContain("Depósito Sem Nome Útil");
    expect(nomes(opcoes)).not.toContain("Embalagens Inventadas");
  });

  it("“ARGILA” e “argíla” acham o mesmo que “argila” (via normalizar)", () => {
    const esperado = nomes(sugestoesDoCampo(lista, "argila").opcoes);
    expect(esperado).toEqual(["Depósito Sem Nome Útil"]);
    expect(nomes(sugestoesDoCampo(lista, "ARGILA").opcoes)).toEqual(esperado);
    expect(nomes(sugestoesDoCampo(lista, "argíla").opcoes)).toEqual(esperado);
    expect(nomes(sugestoesDoCampo(lista, "  Argíla  ").opcoes)).toEqual(esperado);
  });

  it("o acento no cadastro também não atrapalha: “deposito util” não casa (pedaços separados), “deposito” casa", () => {
    expect(nomes(sugestoesDoCampo(lista, "deposito").opcoes)).toEqual(["Depósito Sem Nome Útil"]);
    expect(sugestoesDoCampo(lista, "deposito util").opcoes).toEqual([]);
  });

  it("8 exatos → os 8, haMais falso", () => {
    const { opcoes, haMais } = sugestoesDoCampo(muitos(8), "argila");
    expect(opcoes).toHaveLength(8);
    expect(haMais).toBe(false);
  });

  it("9 → os 8 primeiros por ordem alfabética, haMais verdadeiro", () => {
    const { opcoes, haMais } = sugestoesDoCampo(muitos(9), "argila");
    expect(nomes(opcoes)).toEqual([
      "Olaria 01",
      "Olaria 02",
      "Olaria 03",
      "Olaria 04",
      "Olaria 05",
      "Olaria 06",
      "Olaria 07",
      "Olaria 08",
    ]);
    expect(haMais).toBe(true);
  });

  it("texto vazio (ou só espaços) → os primeiros 8 por ordem alfabética", () => {
    const dez = muitos(10);
    const vazio = sugestoesDoCampo(dez, "");
    expect(nomes(vazio.opcoes)).toEqual(nomes(muitos(8).slice().reverse()));
    expect(vazio.haMais).toBe(true);
    expect(nomes(sugestoesDoCampo(dez, "   ").opcoes)).toEqual(nomes(vazio.opcoes));
  });

  it("nenhum que case → lista vazia, haMais falso", () => {
    expect(sugestoesDoCampo(lista, "porcelana")).toEqual({ opcoes: [], haMais: false });
  });
});

describe("pureza", () => {
  it("lib/fornecedores/campo.ts não importa React, Next, o banco nem o driver", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/campo.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+"(@\/db|react|next|drizzle-orm|pg)[/"]/);
  });
});

// ——— Plano 12, Tarefa 2: a matriz do campo — os seis estados, as bordas do aviso e as frases do painel. ———

describe("situacaoDoVinculo — os seis estados, um caso cada", () => {
  const ativos = [fornecedor({ id: "a", nome: "Argila Sul" }), fornecedor({ id: "b", nome: "Barro Inventado" })];

  it.each([
    ["vazio", { texto: "", fornecedorId: null, fornecedores: ativos }, { estado: "vazio" }],
    ["ligado", { texto: "Argila Sul", fornecedorId: "a", fornecedores: ativos }, { estado: "ligado" }],
    ["texto-livre", { texto: "Conserto do forno", fornecedorId: null, fornecedores: ativos }, { estado: "texto-livre" }],
    [
      "texto-igual-ao-cadastro",
      { texto: " argila   SUL ", fornecedorId: null, fornecedores: ativos },
      { estado: "texto-igual-ao-cadastro", nome: "Argila Sul" },
    ],
    ["cadastro-vazio", { texto: "Argila Sul", fornecedorId: null, fornecedores: [] }, { estado: "cadastro-vazio" }],
    ["erro", { texto: "Argila Sul", fornecedorId: null, fornecedores: null }, { estado: "erro" }],
  ] as const)("%s", (_nome, campo, esperado) => {
    expect(situacaoDoVinculo(campo)).toEqual(esperado);
  });
});

describe("situacaoDoVinculo — bordas do aviso (UI-D4: o aviso nunca liga)", () => {
  it("dois ativos com o mesmo nome normalizado → texto-livre, sem aviso (não há como dizer qual)", () => {
    const fornecedores = [fornecedor({ id: "1", nome: "Argila Sul" }), fornecedor({ id: "2", nome: "ARGÍLA  sul" })];
    expect(situacaoDoVinculo({ texto: "argila sul", fornecedorId: null, fornecedores })).toEqual({
      estado: "texto-livre",
    });
    expect(fornecedorComNomeIgual(fornecedores, "argila sul")).toBeNull();
  });

  it("um desativado com o nome igual não conta", () => {
    const soDesativadoIgual = [
      { ...fornecedor({ id: "1", nome: "Argila Sul" }), ativo: false },
      { ...fornecedor({ id: "2", nome: "Outro Ativo" }), ativo: true },
    ];
    expect(situacaoDoVinculo({ texto: "Argila Sul", fornecedorId: null, fornecedores: soDesativadoIgual })).toEqual({
      estado: "texto-livre",
    });

    // Um desativado e um ativo com o mesmo nome: só o ativo conta — é exatamente UM, então avisa.
    const umDeCada = [
      { ...fornecedor({ id: "1", nome: "Argila Sul" }), ativo: false },
      { ...fornecedor({ id: "2", nome: "Argila Sul" }), ativo: true },
    ];
    expect(fornecedorComNomeIgual(umDeCada, "argila sul")?.id).toBe("2");
    expect(situacaoDoVinculo({ texto: "argila sul", fornecedorId: null, fornecedores: umDeCada })).toEqual({
      estado: "texto-igual-ao-cadastro",
      nome: "Argila Sul",
    });

    // Só desativados: o campo se comporta como cadastro vazio.
    const soDesativados = [{ ...fornecedor({ id: "1", nome: "Argila Sul" }), ativo: false }];
    expect(situacaoDoVinculo({ texto: "Argila Sul", fornecedorId: null, fornecedores: soDesativados })).toEqual({
      estado: "cadastro-vazio",
    });
  });

  it("parte do nome não é “igual”: só o nome inteiro (normalizado) dispara o aviso", () => {
    const fornecedores = [fornecedor({ id: "1", nome: "Argila Sul" })];
    expect(situacaoDoVinculo({ texto: "Argila", fornecedorId: null, fornecedores })).toEqual({ estado: "texto-livre" });
    expect(situacaoDoVinculo({ texto: "Argila Sul Ltda", fornecedorId: null, fornecedores })).toEqual({
      estado: "texto-livre",
    });
  });

  it("escolhido continua ligado mesmo com o texto igual a outro nome — só a escolha manda", () => {
    const fornecedores = [fornecedor({ id: "1", nome: "Argila Sul" }), fornecedor({ id: "2", nome: "Barro" })];
    expect(situacaoDoVinculo({ texto: "Barro", fornecedorId: "1", fornecedores })).toEqual({ estado: "ligado" });
  });

  it("só espaços com o cadastro vazio = vazio (nada escrito), não cadastro-vazio", () => {
    expect(situacaoDoVinculo({ texto: "   ", fornecedorId: null, fornecedores: [] })).toEqual({ estado: "vazio" });
  });
});

describe("mensagemDoPainel — a frase exata de cada caso", () => {
  const um = [fornecedor({ id: "1", nome: "Barro Inventado" })];

  it("cadastro vazio — com ou sem texto, a mesma frase", () => {
    const frase = "Nenhum fornecedor cadastrado. Escreva o nome — ou cadastre em Cadastros → Fornecedores.";
    expect(mensagemDoPainel({ fornecedores: [], texto: "", sugestoes: sugestoesDoCampo([], "") })).toBe(frase);
    expect(mensagemDoPainel({ fornecedores: [], texto: "Alguém", sugestoes: sugestoesDoCampo([], "Alguém") })).toBe(
      frase,
    );
  });

  it("sem resultado — o texto entre aspas curvas, sem os espaços das pontas", () => {
    expect(
      mensagemDoPainel({ fornecedores: um, texto: "  porcelana  ", sugestoes: sugestoesDoCampo(um, "  porcelana  ") }),
    ).toBe("Nenhum fornecedor do cadastro com “porcelana”. Fica só o nome escrito.");
  });

  it("há mais — 9 casam; 8 exatos não dão frase nenhuma", () => {
    const nove = muitos(9);
    expect(mensagemDoPainel({ fornecedores: nove, texto: "", sugestoes: sugestoesDoCampo(nove, "") })).toBe(
      "Há mais fornecedores — continue digitando.",
    );
    const oito = muitos(8);
    expect(mensagemDoPainel({ fornecedores: oito, texto: "", sugestoes: sugestoesDoCampo(oito, "") })).toBeNull();
  });

  it("lista que não carregou — nada no painel (a frase de erro é da linha embaixo do campo)", () => {
    expect(mensagemDoPainel({ fornecedores: null, texto: "", sugestoes: { opcoes: [], haMais: false } })).toBeNull();
  });
});
