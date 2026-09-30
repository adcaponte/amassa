import { describe, expect, it } from "vitest";

import {
  esquemaAjustarDiasPrevistos,
  esquemaCancelarOrdem,
  esquemaCriarOrdem,
  esquemaDefinirAMais,
  esquemaDesfazerEtapa,
  esquemaRegistrarParcial,
  LIMITE_DE_PECAS_POR_ORDEM,
  validarNovaOrdem,
} from "@/lib/producao/esquemas";
import {
  FRASE_A_MAIS_INVALIDO,
  FRASE_CASA_PRECISA_DO_CATALOGO,
  FRASE_CLIENTE_LONGO,
  FRASE_CLIENTE_VAZIO,
  FRASE_ENCOMENDA_SEM_ITEM,
  FRASE_ENTREGA_INVALIDA,
  FRASE_ENTREGA_NO_PASSADO,
  FRASE_FALHA_AO_AJUSTAR,
  FRASE_NOME_DA_ORDEM_LONGO,
  FRASE_NOME_DA_ORDEM_VAZIO,
  FRASE_NOME_DA_PECA_LONGO,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_PARCIAL_NAO_INTEIRO,
  FRASE_PECA_VAZIA,
  FRASE_QUANTIDADE_DA_PECA,
  textoParcialInvalido,
  textoPecasDemais,
} from "@/lib/producao/textos";

// "Fazer a mais, de segurança" (Fase 06.1, plano 04, PRD-08): o texto do campo vira inteiro de 0 a
// 100.000 AQUI, no servidor — o mesmo intervalo do check `ordem_pecas_a_mais_faixa`. Vazio é zero
// (apagar o campo tira as a mais); qualquer outra coisa é recusada com a frase da UI-SPEC.

const ORDEM = "0b7e8a4c-1f2d-4c3b-9a8e-7d6c5b4a3f21";
const PECA = "5e4d3c2b-1a09-4f8e-8d7c-6b5a49382716";

function definir(aMaisTexto: unknown) {
  return esquemaDefinirAMais.safeParse({ ordemId: ORDEM, pecaId: PECA, aMaisTexto });
}

describe("esquemaDefinirAMais", () => {
  it.each([
    ["0", 0],
    ["5", 5],
    ["100000", 100000],
    ["", 0],
    ["   ", 0],
    [" 12 ", 12],
    ["007", 7],
  ])("aceita %j como %i", (texto, esperado) => {
    const resultado = definir(texto);
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({
      ordemId: ORDEM,
      pecaId: PECA,
      aMais: esperado,
    });
  });

  it.each(["100001", "-1", "2,5", "2.5", "abc", "1e3", "5 peças", "+5"])(
    "recusa %j com a frase da UI-SPEC",
    (texto) => {
      const resultado = definir(texto);
      expect(resultado.success).toBe(false);
      expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_A_MAIS_INVALIDO);
    },
  );

  it("recusa um número que não é texto (o campo sempre manda texto)", () => {
    const resultado = definir(5);
    expect(resultado.success).toBe(false);
    expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_A_MAIS_INVALIDO);
  });

  it("a frase é a da UI-SPEC", () => {
    expect(FRASE_A_MAIS_INVALIDO).toBe("Diga um número inteiro, zero ou mais.");
  });

  it("recusa id de ordem ou de peça que não é uuid (a mais)", () => {
    const semOrdem = esquemaDefinirAMais.safeParse({ ordemId: "x", pecaId: PECA, aMaisTexto: "1" });
    expect(semOrdem.success).toBe(false);
    expect(!semOrdem.success && semOrdem.error.issues[0]?.message).toBe(FRASE_ORDEM_NAO_EXISTE);
    const semPeca = esquemaDefinirAMais.safeParse({ ordemId: ORDEM, pecaId: "y", aMaisTexto: "1" });
    expect(semPeca.success).toBe(false);
  });
});

// Plano 05: desfazer, ajustar o previsto e o parcial. Do cliente chegam só os ids, a etapa que a
// tela mostrava, o ±1 e o TEXTO do parcial — a faixa superior do parcial (o total de feitas) é
// decidida no servidor, sob a trava, pelo módulo puro.

describe("esquemaDesfazerEtapa", () => {
  it("aceita id e etapa esperada", () => {
    expect(esquemaDesfazerEtapa.safeParse({ ordemId: ORDEM, etapaEsperada: "secagem" })).toEqual({
      success: true,
      data: { ordemId: ORDEM, etapaEsperada: "secagem" },
    });
  });

  it("recusa etapa que não é uma das seis e id que não é uuid", () => {
    expect(esquemaDesfazerEtapa.safeParse({ ordemId: ORDEM, etapaEsperada: "forno" }).success).toBe(
      false,
    );
    const semOrdem = esquemaDesfazerEtapa.safeParse({ ordemId: "x", etapaEsperada: "secagem" });
    expect(!semOrdem.success && semOrdem.error.issues[0]?.message).toBe(FRASE_ORDEM_NAO_EXISTE);
  });
});

describe("esquemaAjustarDiasPrevistos", () => {
  it.each([1, -1])("aceita delta %i", (delta) => {
    expect(
      esquemaAjustarDiasPrevistos.safeParse({ ordemId: ORDEM, etapa: "queima2", delta }),
    ).toEqual({ success: true, data: { ordemId: ORDEM, etapa: "queima2", delta } });
  });

  it.each([0, 2, -2, 0.5, "1", null])("recusa delta %j", (delta) => {
    const resultado = esquemaAjustarDiasPrevistos.safeParse({
      ordemId: ORDEM,
      etapa: "queima2",
      delta,
    });
    expect(resultado.success).toBe(false);
    expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_FALHA_AO_AJUSTAR);
  });

  it("recusa etapa desconhecida", () => {
    expect(
      esquemaAjustarDiasPrevistos.safeParse({ ordemId: ORDEM, etapa: "forno", delta: 1 }).success,
    ).toBe(false);
  });
});

describe("esquemaRegistrarParcial", () => {
  function parcial(passaramTexto: unknown) {
    return esquemaRegistrarParcial.safeParse({
      ordemId: ORDEM,
      etapaEsperada: "secagem",
      passaramTexto,
    });
  }

  it.each([
    ["18", 18],
    [" 18 ", 18],
    ["0", 0],
    ["007", 7],
    ["", null],
    ["   ", null],
  ])("aceita %j como %j", (texto, esperado) => {
    expect(parcial(texto)).toEqual({
      success: true,
      data: { ordemId: ORDEM, etapaEsperada: "secagem", passaram: esperado },
    });
  });

  it.each(["2,5", "2.5", "abc", "-1", "+5", "1e3", "18 peças", "9999999999"])(
    "recusa %j (inteiro de verdade, sem vírgula, ponto, sinal ou expoente)",
    (texto) => {
      const resultado = parcial(texto);
      expect(resultado.success).toBe(false);
      expect(!resultado.success && resultado.error.issues[0]?.path).toEqual(["passaramTexto"]);
      expect(!resultado.success && resultado.error.issues[0]?.message).toBe(
        FRASE_PARCIAL_NAO_INTEIRO,
      );
    },
  );

  it("recusa um número cru (o campo sempre manda texto)", () => {
    expect(parcial(18).success).toBe(false);
  });

  it("a frase do parcial fora da faixa é a da UI-SPEC", () => {
    expect(textoParcialInvalido(30)).toBe("Diga um número de 0 a 30.");
  });
});

// "Cancelar ordem" (plano 06, PRD-18): do cliente chega SÓ o id — nada de status, data ou quem
// cancelou; o resto o servidor decide sob a trava.
describe("esquemaCancelarOrdem", () => {
  it("aceita o id da ordem e descarta qualquer outro campo", () => {
    const resultado = esquemaCancelarOrdem.safeParse({
      ordemId: ORDEM,
      status: "concluida",
      canceladaPor: PECA,
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ordemId: ORDEM });
  });

  it.each([["não é uuid"], [""]])("recusa ordemId %p com a frase de ordem inexistente", (ordemId) => {
    const resultado = esquemaCancelarOrdem.safeParse({ ordemId });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(FRASE_ORDEM_NAO_EXISTE);
  });
});

// "Nova ordem" (plano 07, PRD-09, D-04/D-05/D-11/D-13): os dois tipos, as peças como união por
// origem (ficha | item | livre) e os limites da UI-SPEC (nome 1..120, cliente 1..160, peça livre
// 1..160, quantidade 1..100.000, 1..LIMITE_DE_PECAS_POR_ORDEM peças). A regra da peça da casa
// (ficha de LINHA com item, item que controla estoque e está ativo) é conferida de novo no banco,
// pela ação — aqui só a forma.
describe("esquemaCriarOrdem", () => {
  const FICHA = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const ITEM = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

  function casa(extra: Record<string, unknown> = {}) {
    return {
      nome: "[teste] Reposição de canecas",
      tipo: "casa",
      caminho: "completo",
      clienteNome: "",
      entregaPrometida: "",
      pecas: [{ origem: "ficha", fichaId: FICHA, quantidadeTexto: "12" }],
      ...extra,
    };
  }

  function encomenda(extra: Record<string, unknown> = {}) {
    return {
      nome: "[teste] Pratos da Fulana",
      tipo: "encomenda",
      caminho: "biscoito",
      clienteNome: "[teste] Fulana",
      entregaPrometida: "2026-12-10",
      pecas: [{ origem: "livre", descricao: "Prato fundo", quantidadeTexto: "6" }],
      ...extra,
    };
  }

  function primeiraQuestao(entrada: unknown) {
    const resultado = esquemaCriarOrdem.safeParse(entrada);
    expect(resultado.success).toBe(false);
    return !resultado.success ? resultado.error.issues[0] : undefined;
  }

  it("casa com uma peça de ficha e quantidade “12” é válida e sai sem cliente", () => {
    const resultado = esquemaCriarOrdem.safeParse(casa({ clienteNome: "[teste] Alguém" }));
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      nome: "[teste] Reposição de canecas",
      tipo: "casa",
      caminho: "completo",
      clienteNome: null,
      entregaPrometida: null,
      pecas: [{ origem: "ficha", fichaId: FICHA, quantidade: 12 }],
    });
  });

  it("casa aceita item do estoque", () => {
    const resultado = esquemaCriarOrdem.safeParse(
      casa({ pecas: [{ origem: "item", itemCatalogoId: ITEM, quantidadeTexto: "3" }] }),
    );
    expect(resultado.success).toBe(true);
    expect(resultado.data?.pecas).toEqual([{ origem: "item", itemCatalogoId: ITEM, quantidade: 3 }]);
  });

  it("casa com peça livre é recusada com a frase do D-05", () => {
    const questao = primeiraQuestao(
      casa({ pecas: [{ origem: "livre", descricao: "Caneca", quantidadeTexto: "1" }] }),
    );
    expect(questao?.message).toBe(FRASE_CASA_PRECISA_DO_CATALOGO);
    expect(questao?.path.slice(0, 2)).toEqual(["pecas", 0]);
  });

  it("encomenda com texto livre e ficha, na ordem escrita, com cliente e entrega", () => {
    const resultado = esquemaCriarOrdem.safeParse(
      encomenda({
        pecas: [
          { origem: "livre", descricao: "  Prato fundo  ", quantidadeTexto: "6" },
          { origem: "ficha", fichaId: FICHA, quantidadeTexto: " 2 " },
        ],
      }),
    );
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      nome: "[teste] Pratos da Fulana",
      tipo: "encomenda",
      caminho: "biscoito",
      clienteNome: "[teste] Fulana",
      entregaPrometida: "2026-12-10",
      pecas: [
        { origem: "livre", descricao: "Prato fundo", quantidade: 6 },
        { origem: "ficha", fichaId: FICHA, quantidade: 2 },
      ],
    });
  });

  it("encomenda não aceita item do estoque", () => {
    const questao = primeiraQuestao(
      encomenda({ pecas: [{ origem: "item", itemCatalogoId: ITEM, quantidadeTexto: "1" }] }),
    );
    expect(questao?.message).toBe(FRASE_ENCOMENDA_SEM_ITEM);
  });

  it.each([[""], ["   "], [undefined], [null]])(
    "encomenda sem cliente (%j) → “Diga para quem é a encomenda.”",
    (clienteNome) => {
      const questao = primeiraQuestao(encomenda({ clienteNome }));
      expect(questao?.message).toBe(FRASE_CLIENTE_VAZIO);
      expect(questao?.path).toEqual(["clienteNome"]);
    },
  );

  it("cliente com 161 caracteres é recusado; 160 passam", () => {
    expect(primeiraQuestao(encomenda({ clienteNome: "a".repeat(161) }))?.message).toBe(
      FRASE_CLIENTE_LONGO,
    );
    expect(esquemaCriarOrdem.safeParse(encomenda({ clienteNome: "a".repeat(160) })).success).toBe(
      true,
    );
  });

  it("nome só com espaços → “Dê um nome à ordem.”", () => {
    const questao = primeiraQuestao(casa({ nome: "    " }));
    expect(questao?.message).toBe(FRASE_NOME_DA_ORDEM_VAZIO);
    expect(questao?.path).toEqual(["nome"]);
  });

  it("nome com 121 caracteres é recusado; 120 letras acentuadas passam", () => {
    expect(primeiraQuestao(casa({ nome: "a".repeat(121) }))?.message).toBe(
      FRASE_NOME_DA_ORDEM_LONGO,
    );
    const acentuado = "ãéíõç".repeat(24);
    expect(acentuado.length).toBe(120);
    const resultado = esquemaCriarOrdem.safeParse(casa({ nome: acentuado }));
    expect(resultado.success).toBe(true);
    expect(resultado.data?.nome).toBe(acentuado);
  });

  it("o nome decomposto (NFD) é normalizado para NFC antes de contar", () => {
    const decomposto = "é".normalize("NFD").repeat(120);
    expect(decomposto.length).toBe(240);
    const resultado = esquemaCriarOrdem.safeParse(casa({ nome: decomposto }));
    expect(resultado.success).toBe(true);
    expect(resultado.data?.nome).toBe("é".repeat(120));
  });

  it("peça livre sem descrição → “Diga qual é a peça.”; 161 caracteres → recusa; 160 passam", () => {
    const vazia = primeiraQuestao(
      encomenda({ pecas: [{ origem: "livre", descricao: "  ", quantidadeTexto: "1" }] }),
    );
    expect(vazia?.message).toBe(FRASE_PECA_VAZIA);
    expect(vazia?.path).toEqual(["pecas", 0, "descricao"]);
    expect(
      primeiraQuestao(
        encomenda({ pecas: [{ origem: "livre", descricao: "b".repeat(161), quantidadeTexto: "1" }] }),
      )?.message,
    ).toBe(FRASE_NOME_DA_PECA_LONGO);
    expect(
      esquemaCriarOrdem.safeParse(
        encomenda({ pecas: [{ origem: "livre", descricao: "ç".repeat(160), quantidadeTexto: "1" }] }),
      ).success,
    ).toBe(true);
  });

  it("peça sem nada escolhido → “Diga qual é a peça.”", () => {
    const questao = primeiraQuestao(casa({ pecas: [{ origem: "", quantidadeTexto: "1" }] }));
    expect(questao?.message).toBe(FRASE_PECA_VAZIA);
    expect(questao?.path.slice(0, 2)).toEqual(["pecas", 0]);
  });

  it.each(["0", "2,5", "2.5", "100001", "", "-1", "1e3", "abc"])(
    "quantidade %j → a frase da quantidade",
    (quantidadeTexto) => {
      const questao = primeiraQuestao(
        casa({ pecas: [{ origem: "ficha", fichaId: FICHA, quantidadeTexto }] }),
      );
      expect(questao?.message).toBe(FRASE_QUANTIDADE_DA_PECA);
      expect(questao?.path).toEqual(["pecas", 0, "quantidadeTexto"]);
    },
  );

  it.each([
    ["1", 1],
    ["100000", 100000],
    ["007", 7],
  ])("quantidade %j vira %i", (quantidadeTexto, esperado) => {
    const resultado = esquemaCriarOrdem.safeParse(
      casa({ pecas: [{ origem: "ficha", fichaId: FICHA, quantidadeTexto }] }),
    );
    expect(resultado.data?.pecas[0]?.quantidade).toBe(esperado);
  });

  it("lista de peças vazia → “Diga qual é a peça.”", () => {
    const questao = primeiraQuestao(casa({ pecas: [] }));
    expect(questao?.message).toBe(FRASE_PECA_VAZIA);
  });

  it(`aceita até LIMITE_DE_PECAS_POR_ORDEM (50) peças e recusa uma a mais`, () => {
    const peca = { origem: "ficha", fichaId: FICHA, quantidadeTexto: "1" };
    expect(LIMITE_DE_PECAS_POR_ORDEM).toBe(50);
    expect(
      esquemaCriarOrdem.safeParse(casa({ pecas: Array(LIMITE_DE_PECAS_POR_ORDEM).fill(peca) }))
        .success,
    ).toBe(true);
    const questao = primeiraQuestao(casa({ pecas: Array(LIMITE_DE_PECAS_POR_ORDEM + 1).fill(peca) }));
    expect(questao?.message).toBe(textoPecasDemais(LIMITE_DE_PECAS_POR_ORDEM));
  });

  it("tipo e caminho desconhecidos são recusados", () => {
    expect(esquemaCriarOrdem.safeParse(casa({ tipo: "loja" })).success).toBe(false);
    expect(esquemaCriarOrdem.safeParse(casa({ caminho: "cru" })).success).toBe(false);
  });

  it.each([["2026-02-30"], ["10/12/2026"], ["amanhã"]])(
    "entrega %j que não é data → “Essa data não é válida.”",
    (entregaPrometida) => {
      const questao = primeiraQuestao(casa({ entregaPrometida }));
      expect(questao?.message).toBe(FRASE_ENTREGA_INVALIDA);
      expect(questao?.path).toEqual(["entregaPrometida"]);
    },
  );
});

// A borda do "hoje" (UI-D15) e os erros por campo que a folha mostra embaixo de cada campo — o
// mesmo código roda no servidor (a ação) e no cliente (conveniência).
describe("validarNovaOrdem", () => {
  const HOJE = "2026-09-30";
  const FICHA = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

  function entrada(extra: Record<string, unknown> = {}) {
    return {
      nome: "[teste] Ordem",
      tipo: "casa",
      caminho: "completo",
      clienteNome: "",
      entregaPrometida: "",
      pecas: [{ origem: "ficha", fichaId: FICHA, quantidadeTexto: "1" }],
      ...extra,
    };
  }

  it("entrega hoje é aceita; ontem é recusada com a frase do UI-D15", () => {
    expect(validarNovaOrdem(entrada({ entregaPrometida: HOJE }), HOJE).ok).toBe(true);
    const ontem = validarNovaOrdem(entrada({ entregaPrometida: "2026-09-29" }), HOJE);
    expect(ontem).toEqual({ ok: false, erros: { entregaPrometida: FRASE_ENTREGA_NO_PASSADO } });
  });

  it("junta os erros de todos os campos de uma vez — nome, cliente e entrega", () => {
    const resultado = validarNovaOrdem(
      entrada({
        nome: "",
        tipo: "encomenda",
        entregaPrometida: "2026-09-01",
        pecas: [{ origem: "livre", descricao: "Prato", quantidadeTexto: "1" }],
      }),
      HOJE,
    );
    expect(resultado).toEqual({
      ok: false,
      erros: {
        nome: FRASE_NOME_DA_ORDEM_VAZIO,
        clienteNome: FRASE_CLIENTE_VAZIO,
        entregaPrometida: FRASE_ENTREGA_NO_PASSADO,
      },
    });
  });

  it("o erro de cada peça vai para a peça (ou a quantidade dela), pela posição", () => {
    const resultado = validarNovaOrdem(
      entrada({
        tipo: "encomenda",
        clienteNome: "[teste] Fulana",
        pecas: [
          { origem: "ficha", fichaId: FICHA, quantidadeTexto: "1" },
          { origem: "livre", descricao: "", quantidadeTexto: "0" },
        ],
      }),
      HOJE,
    );
    expect(resultado).toEqual({
      ok: false,
      erros: { "peca-1": FRASE_PECA_VAZIA, "quantidade-1": FRASE_QUANTIDADE_DA_PECA },
    });
  });

  it("lista de peças vazia cai na primeira peça", () => {
    expect(validarNovaOrdem(entrada({ pecas: [] }), HOJE)).toEqual({
      ok: false,
      erros: { "peca-0": FRASE_PECA_VAZIA },
    });
  });

  it("devolve os dados validados quando está tudo certo", () => {
    const resultado = validarNovaOrdem(entrada(), HOJE);
    expect(resultado.ok && resultado.dados.pecas).toEqual([
      { origem: "ficha", fichaId: FICHA, quantidade: 1 },
    ]);
  });
});
