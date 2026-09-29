import { describe, expect, it } from "vitest";

import { esquemaItem } from "@/lib/cadastros/esquemas";
import {
  campoDoMaterial,
  entradaDeItemDoMaterial,
  esquemaNovoMaterial,
  esquemaRegistrarMovimentacao,
  esquemaSalvarMaterial,
  textoParaMilesimos,
} from "@/lib/estoque/esquemas";
import {
  FRASE_CONTADO_VAZIO,
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_MINIMO_INVALIDO,
  FRASE_OBSERVACOES_LONGAS,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  FRASE_VINCULO_LONGO,
} from "@/lib/estoque/textos";

// Id fictício de item (uuid v4 válido) — nenhum dado real.
const ITEM_ID = "3f2c6a1e-8b4d-4c2a-9e1f-0a1b2c3d4e5f";

function saida(quantidadeTexto: string, destino: unknown = "atelie") {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "saida",
    itemId: ITEM_ID,
    quantidadeTexto,
    destino,
  });
}

function primeiraMensagem(resultado: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaRegistrarMovimentacao — a quantidade", () => {
  it("aceita “2,5” como 2500 milésimos", () => {
    const resultado = saida("2,5");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.quantidadeTexto).toBe(2500);
    }
  });

  it("aceita “0,001” como 1 milésimo — a menor quantidade que existe", () => {
    const resultado = saida("0,001");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.quantidadeTexto).toBe(1);
    }
  });

  it("recusa “0” com a frase da quantidade zero", () => {
    const resultado = saida("0");
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_QUANTIDADE_ZERO);
  });

  it("recusa “-1” — o sinal vem do tipo, nunca do texto", () => {
    expect(saida("-1").success).toBe(false);
  });

  it("recusa “1,2345” — mais de 3 casas decimais não cabem em milésimos", () => {
    expect(saida("1,2345").success).toBe(false);
  });

  it("recusa texto vazio", () => {
    expect(saida("").success).toBe(false);
    expect(saida("   ").success).toBe(false);
  });

  it("textoParaMilesimos converte o texto uma vez só, em inteiro", () => {
    expect(textoParaMilesimos("5")).toEqual({ ok: true, milesimos: 5000 });
    expect(textoParaMilesimos("2,250")).toEqual({ ok: true, milesimos: 2250 });
    expect(textoParaMilesimos("0.5")).toEqual({ ok: true, milesimos: 500 });
  });
});

describe("esquemaRegistrarMovimentacao — entrada e saída", () => {
  it("entrada sem custo é recusada com “Diga quanto custou ao todo — é daí que sai o custo médio.”", () => {
    const semCampo = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
    });
    expect(semCampo.success).toBe(false);
    expect(primeiraMensagem(semCampo)).toBe(FRASE_CUSTO_OBRIGATORIO);

    const vazio = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
      custoTexto: "",
    });
    expect(vazio.success).toBe(false);
    expect(primeiraMensagem(vazio)).toBe(
      "Diga quanto custou ao todo — é daí que sai o custo médio.",
    );
  });

  it("entrada com custo vira centavos inteiros", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
      custoTexto: "21,00",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "entrada") {
      expect(resultado.data.quantidadeTexto).toBe(5000);
      expect(resultado.data.custoTexto).toBe(2100);
    }
  });

  it("saída sem destino é recusada com “Escolha para onde o material foi.”", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "saida",
      itemId: ITEM_ID,
      quantidadeTexto: "2",
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
    expect(FRASE_DESTINO_OBRIGATORIO).toBe("Escolha para onde o material foi.");
  });

  it("destino fora dos cinco é recusado — inclusive “venda”", () => {
    for (const destino of ["venda", "doacao", "", 3]) {
      const resultado = saida("2", destino);
      expect(resultado.success, `destino ${String(destino)}`).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
    }
  });

  it("saída válida devolve o destino e os milésimos", () => {
    const resultado = saida("2", "encomenda");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.destino).toBe("encomenda");
      expect(resultado.data.quantidadeTexto).toBe(2000);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// O ajuste e os vínculos da saída (06-05-PLAN.md) — EST-07, EST-08, EST-11.
// ---------------------------------------------------------------------------------------------

function ajuste(contadoTexto: unknown, motivoTexto?: unknown) {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "ajuste",
    itemId: ITEM_ID,
    contadoTexto,
    ...(motivoTexto === undefined ? {} : { motivoTexto }),
  });
}

describe("esquemaRegistrarMovimentacao — o ajuste pelo saldo contado", () => {
  it("contado “0” é aceito: prateleira vazia é um contado válido (D-32)", () => {
    const resultado = ajuste("0");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "ajuste") {
      expect(resultado.data.contadoTexto).toBe(0);
    }
  });

  it("“2,5” e “2,500” viram os mesmos 2500 milésimos", () => {
    for (const texto of ["2,5", "2,500"]) {
      const resultado = ajuste(texto);
      expect(resultado.success).toBe(true);
      if (resultado.success && resultado.data.tipo === "ajuste") {
        expect(resultado.data.contadoTexto).toBe(2500);
      }
    }
  });

  it("contado vazio é recusado com “Diga quanto tem na prateleira — pode ser zero.”", () => {
    for (const texto of ["", "   "]) {
      const resultado = ajuste(texto);
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_CONTADO_VAZIO);
    }
    expect(FRASE_CONTADO_VAZIO).toBe("Diga quanto tem na prateleira — pode ser zero.");
    expect(primeiraMensagem(esquemaRegistrarMovimentacao.safeParse({ tipo: "ajuste", itemId: ITEM_ID }))).toBe(
      FRASE_CONTADO_VAZIO,
    );
  });

  it("contado negativo e contado com 4 casas são recusados com a frase da quantidade", () => {
    for (const texto of ["-1", "1,2345"]) {
      const resultado = ajuste(texto);
      expect(resultado.success, texto).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_QUANTIDADE_INVALIDA);
    }
  });

  it("motivo do ajuste: opcional, NFC, sem espaço nas pontas, vazio vira nulo", () => {
    const semMotivo = ajuste("3");
    expect(semMotivo.success && semMotivo.data.tipo === "ajuste" && semMotivo.data.motivoTexto).toBe(
      null,
    );
    const vazio = ajuste("3", "   ");
    expect(vazio.success && vazio.data.tipo === "ajuste" && vazio.data.motivoTexto).toBe(null);
    const comMotivo = ajuste("3", "  Conferência da prateleira  ");
    expect(comMotivo.success).toBe(true);
    if (comMotivo.success && comMotivo.data.tipo === "ajuste") {
      expect(comMotivo.data.motivoTexto).toBe("Conferência da prateleira");
      expect(comMotivo.data.motivoTexto).toBe("Conferência da prateleira".normalize("NFC"));
    }
  });

  it("motivo com 160 pontos de código passa; com 161 é recusado", () => {
    expect(ajuste("3", "a".repeat(160)).success).toBe(true);
    const longo = ajuste("3", "a".repeat(161));
    expect(longo.success).toBe(false);
    expect(primeiraMensagem(longo)).toBe(FRASE_VINCULO_LONGO);
  });
});

function saidaCom(destino: string, vinculos: Record<string, unknown>) {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "saida",
    itemId: ITEM_ID,
    quantidadeTexto: "1",
    destino,
    ...vinculos,
  });
}

describe("esquemaRegistrarMovimentacao — os vínculos da saída (EST-11)", () => {
  it("aula sem turma grava turma nula — o vínculo é opcional", () => {
    const resultado = saidaCom("aula", {});
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.turmaTexto).toBe(null);
      expect(resultado.data.encomendaId).toBe(null);
      expect(resultado.data.oQueAconteceuTexto).toBe(null);
    }
  });

  it("turma de 160 pontos de código passa; 161 é recusada", () => {
    // "🏺" é UM ponto de código e DUAS unidades UTF-16: 160 dele cabem (o banco conta caracteres).
    const cabe = saidaCom("aula", { turmaTexto: "🏺".repeat(160) });
    expect(cabe.success).toBe(true);
    const naoCabe = saidaCom("aula", { turmaTexto: "a".repeat(161) });
    expect(naoCabe.success).toBe(false);
    expect(primeiraMensagem(naoCabe)).toBe(FRASE_VINCULO_LONGO);
  });

  it("a turma é normalizada em NFC e aparada; só espaços vira nulo", () => {
    const decomposta = saidaCom("aula", { turmaTexto: " Turma de terça " });
    expect(decomposta.success).toBe(true);
    if (decomposta.success && decomposta.data.tipo === "saida") {
      expect(decomposta.data.turmaTexto).toBe("Turma de terça");
    }
    const branco = saidaCom("aula", { turmaTexto: "   " });
    expect(branco.success && branco.data.tipo === "saida" && branco.data.turmaTexto).toBe(null);
  });

  it("encomenda aceita um id (uuid) opcional; “Nenhuma” (vazio) vira nulo", () => {
    const encomendaId = "0b7c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3";
    const comId = saidaCom("encomenda", { encomendaId });
    expect(comId.success).toBe(true);
    if (comId.success && comId.data.tipo === "saida") {
      expect(comId.data.encomendaId).toBe(encomendaId);
    }
    const nenhuma = saidaCom("encomenda", { encomendaId: "" });
    expect(nenhuma.success && nenhuma.data.tipo === "saida" && nenhuma.data.encomendaId).toBe(null);
    expect(saidaCom("encomenda", { encomendaId: "nao-e-uuid" }).success).toBe(false);
  });

  it("perda: “o que aconteceu” é opcional, vazio vira nulo", () => {
    const semTexto = saidaCom("perda", { oQueAconteceuTexto: "" });
    expect(
      semTexto.success && semTexto.data.tipo === "saida" && semTexto.data.oQueAconteceuTexto,
    ).toBe(null);
    const comTexto = saidaCom("perda", { oQueAconteceuTexto: "Caiu da prateleira" });
    expect(
      comTexto.success && comTexto.data.tipo === "saida" && comTexto.data.oQueAconteceuTexto,
    ).toBe("Caiu da prateleira");
  });

  it("vínculo que não corresponde ao destino é ignorado", () => {
    const resultado = saidaCom("atelie", {
      turmaTexto: "Turma de terça",
      encomendaId: "0b7c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3",
      oQueAconteceuTexto: "Quebrou",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.turmaTexto).toBe(null);
      expect(resultado.data.encomendaId).toBe(null);
      expect(resultado.data.oQueAconteceuTexto).toBe(null);
    }
    const aula = saidaCom("aula", { turmaTexto: "Turma de terça", oQueAconteceuTexto: "Quebrou" });
    if (aula.success && aula.data.tipo === "saida") {
      expect(aula.data.turmaTexto).toBe("Turma de terça");
      expect(aula.data.oQueAconteceuTexto).toBe(null);
    }
  });

  it("sem destino, continua “Escolha para onde o material foi.” mesmo com vínculo", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "saida",
      itemId: ITEM_ID,
      quantidadeTexto: "1",
      turmaTexto: "Turma de terça",
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
  });
});

// ---------------------------------------------------------------------------------------------
// "+ Novo material" e "Editar material" (06-09-PLAN.md, Tarefa 2): a mesma validação do Cadastros
// (EST-13) e o mínimo e as observações, que são do Estoque (EST-02).
// ---------------------------------------------------------------------------------------------

const CATEGORIA_ID = "7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

function novoMaterial(parcial: Record<string, unknown> = {}) {
  return {
    nome: "[teste] Argila",
    unidade: "kg",
    categoriaCompraId: CATEGORIA_ID,
    minimoTexto: "0",
    observacoesTexto: "",
    ...parcial,
  };
}

// A validação do Cadastros, pela fábrica de lá, sobre a entrada que o Estoque monta.
function validarComoCadastros(entrada: unknown) {
  return esquemaItem(new Map()).safeParse(entradaDeItemDoMaterial(entrada));
}

describe("entradaDeItemDoMaterial + esquemaItem — a validação do Cadastros (EST-13)", () => {
  it("um material válido vira item com estoque próprio, fora da venda e sem ficha", () => {
    const resultado = validarComoCadastros(novoMaterial());
    expect(resultado.success).toBe(true);
    expect(resultado.data).toMatchObject({
      nome: "[teste] Argila",
      aparecenaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      atalhoCompra: false,
      categoriaVendaId: null,
      precoVendaCentavos: null,
      unidade: "kg",
      categoriaCompraId: CATEGORIA_ID,
      ficha: [],
    });
  });

  it("nome vazio ou só espaços: “Dê um nome ao item.” (EST-13 · empty)", () => {
    for (const nome of ["", "   ", undefined, 42]) {
      const resultado = validarComoCadastros(novoMaterial({ nome }));
      expect(primeiraMensagem(resultado)).toBe("Dê um nome ao item.");
      expect(resultado.error?.issues[0]?.path).toEqual(["nome"]);
    }
  });

  it("nome de 1 a 120 pontos de código, depois de NFC (EST-13 · encoding)", () => {
    expect(validarComoCadastros(novoMaterial({ nome: "a".repeat(120) })).success).toBe(true);
    expect(primeiraMensagem(validarComoCadastros(novoMaterial({ nome: "a".repeat(121) })))).toBe(
      "Nome muito longo — no máximo 120 caracteres.",
    );
    // 120 emojis: 240 unidades UTF-16, mas 120 pontos de código — cabe.
    expect(validarComoCadastros(novoMaterial({ nome: "🏺".repeat(120) })).success).toBe(true);
    // "e" + acento combinante vira "é" (um ponto) no NFC.
    const resultado = validarComoCadastros(novoMaterial({ nome: "Caf" + "é" }));
    expect(resultado.data?.nome).toBe("Café");
  });

  it("sem unidade: “Escolha a unidade do estoque.”; sem categoria: “Escolha a categoria da compra.”", () => {
    expect(primeiraMensagem(validarComoCadastros(novoMaterial({ unidade: null })))).toBe(
      "Escolha a unidade do estoque.",
    );
    expect(primeiraMensagem(validarComoCadastros(novoMaterial({ categoriaCompraId: "" })))).toBe(
      "Escolha a categoria da compra.",
    );
  });

  it("dois cadastros com o mesmo nome passam os dois — o catálogo não tem nome único (idempotency)", () => {
    expect(validarComoCadastros(novoMaterial()).success).toBe(true);
    expect(validarComoCadastros(novoMaterial()).success).toBe(true);
  });
});

describe("esquemaNovoMaterial — o mínimo e as observações (EST-02)", () => {
  it("mínimo começa em 0 e aceita zero, inteiro e até 3 casas, em milésimos", () => {
    expect(esquemaNovoMaterial.parse(novoMaterial({ minimoTexto: "0" })).minimoTexto).toBe(0);
    expect(esquemaNovoMaterial.parse(novoMaterial({ minimoTexto: "" })).minimoTexto).toBe(0);
    expect(esquemaNovoMaterial.parse(novoMaterial({ minimoTexto: "4" })).minimoTexto).toBe(4000);
    expect(esquemaNovoMaterial.parse(novoMaterial({ minimoTexto: "2,5" })).minimoTexto).toBe(2500);
    expect(esquemaNovoMaterial.parse(novoMaterial({ minimoTexto: "0,125" })).minimoTexto).toBe(125);
  });

  it("mínimo negativo, texto ou com 4 casas: “O mínimo precisa ser zero ou mais.”", () => {
    for (const minimoTexto of ["-1", "abc", "0,0001", "1,2345"]) {
      const resultado = esquemaNovoMaterial.safeParse(novoMaterial({ minimoTexto }));
      expect(primeiraMensagem(resultado)).toBe(FRASE_MINIMO_INVALIDO);
      expect(resultado.error?.issues[0]?.path).toEqual(["minimoTexto"]);
    }
  });

  it("observações vazias gravam nulo; aparadas; 500 cabem e 501 não", () => {
    expect(esquemaNovoMaterial.parse(novoMaterial({ observacoesTexto: "" })).observacoesTexto).toBeNull();
    expect(esquemaNovoMaterial.parse(novoMaterial({ observacoesTexto: "   " })).observacoesTexto).toBeNull();
    expect(esquemaNovoMaterial.parse(novoMaterial({ observacoesTexto: null })).observacoesTexto).toBeNull();
    expect(
      esquemaNovoMaterial.parse(novoMaterial({ observacoesTexto: "  Secar antes de pesar.  " }))
        .observacoesTexto,
    ).toBe("Secar antes de pesar.");
    expect(
      esquemaNovoMaterial.parse(novoMaterial({ observacoesTexto: "x".repeat(500) })).observacoesTexto,
    ).toHaveLength(500);
    const longo = esquemaNovoMaterial.safeParse(novoMaterial({ observacoesTexto: "x".repeat(501) }));
    expect(primeiraMensagem(longo)).toBe(FRASE_OBSERVACOES_LONGAS);
    expect(FRASE_OBSERVACOES_LONGAS).toBe("As observações cabem em até 500 letras.");
  });

  it("observações contadas em pontos de código, depois de NFC (EST-02 · encoding)", () => {
    // 500 emojis são 1000 unidades UTF-16 — mas 500 caracteres para o Postgres.
    expect(esquemaNovoMaterial.safeParse(novoMaterial({ observacoesTexto: "🏺".repeat(500) })).success).toBe(
      true,
    );
    const decomposto = ("é").repeat(500);
    const resultado = esquemaNovoMaterial.parse(novoMaterial({ observacoesTexto: decomposto }));
    expect(resultado.observacoesTexto).toBe("é".repeat(500));
  });

  it("unidade fora da lista é recusada com a frase do Cadastros", () => {
    expect(primeiraMensagem(esquemaNovoMaterial.safeParse(novoMaterial({ unidade: "tonelada" })))).toBe(
      "Escolha a unidade do estoque.",
    );
  });
});

describe("esquemaSalvarMaterial — só o mínimo e as observações", () => {
  it("aceita o id, o mínimo e as observações, e nada mais sai dele", () => {
    const resultado = esquemaSalvarMaterial.parse({
      itemId: ITEM_ID,
      minimoTexto: "4",
      observacoesTexto: "Fornecedor entrega às terças.",
      nome: "tentativa de trocar o nome",
      unidade: "g",
    });
    expect(resultado).toEqual({
      itemId: ITEM_ID,
      minimoTexto: 4000,
      observacoesTexto: "Fornecedor entrega às terças.",
    });
  });

  it("recusa id que não é uuid, mínimo negativo e observações longas", () => {
    expect(esquemaSalvarMaterial.safeParse({ itemId: "x", minimoTexto: "0" }).success).toBe(false);
    expect(
      primeiraMensagem(esquemaSalvarMaterial.safeParse({ itemId: ITEM_ID, minimoTexto: "-2" })),
    ).toBe(FRASE_MINIMO_INVALIDO);
    expect(
      primeiraMensagem(
        esquemaSalvarMaterial.safeParse({
          itemId: ITEM_ID,
          minimoTexto: "0",
          observacoesTexto: "y".repeat(501),
        }),
      ),
    ).toBe(FRASE_OBSERVACOES_LONGAS);
  });
});

describe("campoDoMaterial — o erro volta para baixo do campo certo", () => {
  it("pelo caminho do Zod", () => {
    expect(campoDoMaterial(["nome"], "Dê um nome ao item.")).toBe("nome");
    expect(campoDoMaterial(["minimoTexto"], FRASE_MINIMO_INVALIDO)).toBe("minimo");
    expect(campoDoMaterial(["observacoesTexto"], FRASE_OBSERVACOES_LONGAS)).toBe("observacoes");
    expect(campoDoMaterial(["categoriaCompraId"], "qualquer")).toBe("categoria");
  });

  it("pela frase de `validarItem`, que não tem caminho", () => {
    expect(campoDoMaterial([], "Escolha a unidade do estoque.")).toBe("unidade");
    expect(campoDoMaterial([], "Escolha a categoria da compra.")).toBe("categoria");
    expect(campoDoMaterial([], "Outra coisa.")).toBe("geral");
  });
});
