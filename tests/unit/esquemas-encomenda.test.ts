import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  esquemaAjusteDeEtapa,
  esquemaEncomenda,
  esquemaEtapas,
  esquemaId,
  esquemaItem,
  esquemaReordenacao,
} from "@/lib/encomendas/esquemas";
import { DIAS_PADRAO } from "@/lib/encomendas/cronograma";

// Fronteira de 200 pontos de código medida em EMOJI (par substituto, 2 unidades UTF-16 cada) —
// se o esquema medisse por `.length` em vez de `[...texto].length`, 200 emojis já teria 400 e
// seria recusado por engano.
function textoDeEmojis(quantidade: number): string {
  return "😀".repeat(quantidade);
}

describe("esquemaItem", () => {
  it("aceita descrição de exatamente 1 ponto de código", () => {
    const resultado = esquemaItem.safeParse({ descricao: "a", quantidade: 1 });
    expect(resultado.success).toBe(true);
  });

  it("recusa descrição vazia (0 pontos de código) — a mensagem diz o que fazer", () => {
    const resultado = esquemaItem.safeParse({ descricao: "", quantidade: 1 });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/descrev/i);
    }
  });

  it("aceita descrição de exatamente 200 pontos de código (200 emojis)", () => {
    const resultado = esquemaItem.safeParse({
      descricao: textoDeEmojis(200),
      quantidade: 1,
    });
    expect(resultado.success).toBe(true);
  });

  it("recusa descrição de 201 pontos de código (201 emojis) — String.length daria 402 e recusaria a de 200 também, mas aqui só a de 201 falha", () => {
    const resultado200 = esquemaItem.safeParse({
      descricao: textoDeEmojis(200),
      quantidade: 1,
    });
    const resultado201 = esquemaItem.safeParse({
      descricao: textoDeEmojis(201),
      quantidade: 1,
    });
    expect(resultado200.success).toBe(true);
    expect(resultado201.success).toBe(false);
    if (!resultado201.success) {
      expect(resultado201.error.issues[0]?.message).toMatch(/200 caracteres/i);
    }
  });

  it("normaliza NFC antes de medir: acento composto e acento pré-composto contam o mesmo comprimento", () => {
    const composto = "café"; // é pré-composto — 4 pontos de código
    const decomposto = "café"; // e + acento combinante — 5 unidades antes de normalizar

    const resultadoComposto = esquemaItem.safeParse({ descricao: composto, quantidade: 1 });
    const resultadoDecomposto = esquemaItem.safeParse({ descricao: decomposto, quantidade: 1 });

    expect(resultadoComposto.success).toBe(true);
    expect(resultadoDecomposto.success).toBe(true);
    if (resultadoComposto.success && resultadoDecomposto.success) {
      expect(resultadoDecomposto.data.descricao).toBe(resultadoComposto.data.descricao);
      expect([...resultadoDecomposto.data.descricao].length).toBe(4);
    }
  });

  it("aceita quantidade: 1", () => {
    expect(esquemaItem.safeParse({ descricao: "caneca", quantidade: 1 }).success).toBe(true);
  });

  it("recusa quantidade: 0", () => {
    expect(esquemaItem.safeParse({ descricao: "caneca", quantidade: 0 }).success).toBe(false);
  });

  it("recusa quantidade: -1", () => {
    expect(esquemaItem.safeParse({ descricao: "caneca", quantidade: -1 }).success).toBe(false);
  });

  it("recusa quantidade: 40.5 (nunca trunca para 40)", () => {
    const resultado = esquemaItem.safeParse({ descricao: "caneca", quantidade: 40.5 });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/inteiro/i);
    }
  });
});

describe("esquemaEncomenda", () => {
  const etapasValidas = DIAS_PADRAO.map((duracao) => ({ etapa: duracao.etapa, dias: duracao.dias }));

  function encomendaBase(overrides: Record<string, unknown> = {}) {
    return {
      nome: "Coleção Verão",
      dataInicio: "2026-08-12",
      itens: [{ descricao: "caneca cônica", quantidade: 40 }],
      etapas: etapasValidas,
      ...overrides,
    };
  }

  it("aceita 1 item", () => {
    expect(esquemaEncomenda.safeParse(encomendaBase()).success).toBe(true);
  });

  it("recusa 0 itens", () => {
    expect(esquemaEncomenda.safeParse(encomendaBase({ itens: [] })).success).toBe(false);
  });

  it("aceita 50 itens", () => {
    const itens = Array.from({ length: 50 }, (_valor, indice) => ({
      descricao: `item ${indice}`,
      quantidade: 1,
    }));
    expect(esquemaEncomenda.safeParse(encomendaBase({ itens })).success).toBe(true);
  });

  it("recusa 51 itens", () => {
    const itens = Array.from({ length: 51 }, (_valor, indice) => ({
      descricao: `item ${indice}`,
      quantidade: 1,
    }));
    expect(esquemaEncomenda.safeParse(encomendaBase({ itens })).success).toBe(false);
  });

  it("dois itens com a mesma descrição e quantidade continuam sendo duas entradas distintas (nada funde)", () => {
    const itens = [
      { descricao: "40 canecas brancas", quantidade: 40 },
      { descricao: "40 canecas brancas", quantidade: 40 },
    ];
    const resultado = esquemaEncomenda.safeParse(encomendaBase({ itens }));
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.itens).toHaveLength(2);
    }
  });

  it("clienteNome ausente vira null", () => {
    const entrada = encomendaBase();
    const resultado = esquemaEncomenda.safeParse(entrada);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.clienteNome).toBeNull();
    }
  });

  it("clienteNome vazio vira null", () => {
    const resultado = esquemaEncomenda.safeParse(encomendaBase({ clienteNome: "" }));
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.clienteNome).toBeNull();
    }
  });

  it("clienteNome só com espaços vira null", () => {
    const resultado = esquemaEncomenda.safeParse(encomendaBase({ clienteNome: "   " }));
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.clienteNome).toBeNull();
    }
  });

  it("clienteNome com texto é preservado (trim aplicado)", () => {
    const resultado = esquemaEncomenda.safeParse(encomendaBase({ clienteNome: "  Maria  " }));
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.clienteNome).toBe("Maria");
    }
  });

  it("recusa dataInicio que não casa o formato AAAA-MM-DD", () => {
    expect(esquemaEncomenda.safeParse(encomendaBase({ dataInicio: "12/08/2026" })).success).toBe(
      false,
    );
  });

  it("recusa 2026-02-30 (formato certo, data inexistente)", () => {
    const resultado = esquemaEncomenda.safeParse(encomendaBase({ dataInicio: "2026-02-30" }));
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/data de início inválida/i);
    }
  });
});

describe("esquemaEtapas", () => {
  const etapasValidas = DIAS_PADRAO.map((duracao) => ({ etapa: duracao.etapa, dias: duracao.dias }));

  it("aceita exatamente as 6 etapas fixas, uma por valor de Etapa", () => {
    expect(esquemaEtapas.safeParse(etapasValidas).success).toBe(true);
  });

  it("recusa quando falta uma etapa (só 5)", () => {
    expect(esquemaEtapas.safeParse(etapasValidas.slice(0, 5)).success).toBe(false);
  });

  it("recusa etapa repetida (7 entradas, uma duplicada)", () => {
    const comRepeticao = [...etapasValidas, etapasValidas[0]];
    expect(esquemaEtapas.safeParse(comRepeticao).success).toBe(false);
  });

  it.each(["queima1", "queima2", "entrega"] as const)(
    "recusa dias: 2 no marco %s",
    (etapaMarco) => {
      const comMarcoInvalido = etapasValidas.map((etapa) =>
        etapa.etapa === etapaMarco ? { ...etapa, dias: 2 } : etapa,
      );
      expect(esquemaEtapas.safeParse(comMarcoInvalido).success).toBe(false);
    },
  );

  it.each(["queima1", "queima2", "entrega"] as const)("aceita dias: 0 no marco %s", (etapaMarco) => {
    const comMarcoZero = etapasValidas.map((etapa) =>
      etapa.etapa === etapaMarco ? { ...etapa, dias: 0 } : etapa,
    );
    expect(esquemaEtapas.safeParse(comMarcoZero).success).toBe(true);
  });

  it.each(["queima1", "queima2", "entrega"] as const)("aceita dias: 1 no marco %s", (etapaMarco) => {
    const comMarcoUm = etapasValidas.map((etapa) =>
      etapa.etapa === etapaMarco ? { ...etapa, dias: 1 } : etapa,
    );
    expect(esquemaEtapas.safeParse(comMarcoUm).success).toBe(true);
  });

  it.each(["producao", "secagem", "esmaltacao"] as const)(
    "aceita dias: 0 na etapa de intervalo %s",
    (etapaIntervalo) => {
      const comZero = etapasValidas.map((etapa) =>
        etapa.etapa === etapaIntervalo ? { ...etapa, dias: 0 } : etapa,
      );
      expect(esquemaEtapas.safeParse(comZero).success).toBe(true);
    },
  );

  it.each(["producao", "secagem", "esmaltacao"] as const)(
    "recusa dias: -1 na etapa de intervalo %s",
    (etapaIntervalo) => {
      const comNegativo = etapasValidas.map((etapa) =>
        etapa.etapa === etapaIntervalo ? { ...etapa, dias: -1 } : etapa,
      );
      expect(esquemaEtapas.safeParse(comNegativo).success).toBe(false);
    },
  );
});

describe("esquemaAjusteDeEtapa", () => {
  it("aceita { delta: 1 } numa etapa de intervalo", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "producao",
      delta: 1,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita { delta: -1 } numa etapa de intervalo", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "secagem",
      delta: -1,
    });
    expect(resultado.success).toBe(true);
  });

  it("recusa qualquer delta fora de -1/1 numa etapa de intervalo", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "producao",
      delta: 2,
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita { ligado: true } num marco", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "queima1",
      ligado: true,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita { ligado: false } num marco", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "entrega",
      ligado: false,
    });
    expect(resultado.success).toBe(true);
  });

  it("recusa delta numa etapa de marco — o esquema, não o componente, sabe que marco é interruptor", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "queima1",
      delta: 1,
    });
    expect(resultado.success).toBe(false);
  });

  it("recusa ligado numa etapa de intervalo", () => {
    const resultado = esquemaAjusteDeEtapa.safeParse({
      encomendaId: randomUUID(),
      etapa: "producao",
      ligado: true,
    });
    expect(resultado.success).toBe(false);
  });
});

describe("esquemaReordenacao", () => {
  it('aceita direcao: "cima"', () => {
    const resultado = esquemaReordenacao.safeParse({ itemId: randomUUID(), direcao: "cima" });
    expect(resultado.success).toBe(true);
  });

  it('aceita direcao: "baixo"', () => {
    const resultado = esquemaReordenacao.safeParse({ itemId: randomUUID(), direcao: "baixo" });
    expect(resultado.success).toBe(true);
  });

  it("recusa qualquer outro valor de direcao", () => {
    const resultado = esquemaReordenacao.safeParse({ itemId: randomUUID(), direcao: "lateral" });
    expect(resultado.success).toBe(false);
  });
});

describe("esquemaId", () => {
  it("aceita um UUID válido", () => {
    expect(esquemaId.safeParse(randomUUID()).success).toBe(true);
  });

  it("recusa cadeia vazia", () => {
    expect(esquemaId.safeParse("").success).toBe(false);
  });

  it("recusa número", () => {
    expect(esquemaId.safeParse(123).success).toBe(false);
  });

  it("recusa UUID malformado", () => {
    expect(esquemaId.safeParse("not-a-uuid").success).toBe(false);
  });
});
