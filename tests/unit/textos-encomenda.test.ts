import { describe, expect, it } from "vitest";
import type { Situacao } from "../../lib/encomendas/cronograma";
import {
  FRASE_ERRO_CORPO,
  FRASE_ERRO_TITULO,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FILTRO_VAZIO_CORPO,
  FRASE_FILTRO_VAZIO_TITULO,
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ROTULO_ETAPA,
  ROTULO_NOVA_ENCOMENDA,
  SELO_ATRASADA,
  SELO_RASCUNHO,
  SUFIXO_ESPERA,
  textoDaContagemDeItens,
  textoDaEspera,
  textoDaEsperaNaTrilha,
  textoDaSituacao,
} from "../../lib/encomendas/textos";

describe("frases fixas", () => {
  it('FRASE_VAZIO_TITULO é exatamente "A roda ainda não gira."', () => {
    expect(FRASE_VAZIO_TITULO).toBe("A roda ainda não gira.");
  });

  it('FRASE_FILTRO_VAZIO_TITULO é exatamente "Nada por aqui com esse filtro."', () => {
    expect(FRASE_FILTRO_VAZIO_TITULO).toBe("Nada por aqui com esse filtro.");
  });

  it("FRASE_VAZIO_TITULO e FRASE_FILTRO_VAZIO_TITULO são duas cadeias distintas, nunca a mesma", () => {
    expect(FRASE_VAZIO_TITULO).not.toBe(FRASE_FILTRO_VAZIO_TITULO);
  });

  it("todas as frases fixas são não vazias", () => {
    const frases = [
      FRASE_VAZIO_TITULO,
      FRASE_VAZIO_CORPO,
      FRASE_FILTRO_VAZIO_TITULO,
      FRASE_FILTRO_VAZIO_CORPO,
      FRASE_ERRO_TITULO,
      FRASE_ERRO_CORPO,
      FRASE_FALHA_AO_SALVAR,
      ROTULO_NOVA_ENCOMENDA,
      SELO_RASCUNHO,
      SELO_ATRASADA,
    ];

    for (const frase of frases) {
      expect(frase.length).toBeGreaterThan(0);
    }
  });

  it("ROTULO_ETAPA tem uma entrada para cada uma das 6 etapas, e nenhuma entrada a mais", () => {
    const etapas = [
      "producao",
      "secagem",
      "queima1",
      "esmaltacao",
      "queima2",
      "entrega",
    ] as const;

    expect(Object.keys(ROTULO_ETAPA).sort()).toEqual([...etapas].sort());
    for (const etapa of etapas) {
      expect(ROTULO_ETAPA[etapa].length).toBeGreaterThan(0);
    }
  });
});

describe("textoDaSituacao", () => {
  const casos: Array<{ nome: string; situacao: Situacao }> = [
    {
      nome: "nao-comecou",
      situacao: { tipo: "nao-comecou", diasAteInicio: 3, dataInicio: "2026-08-15" },
    },
    {
      nome: "em-etapa-intervalo",
      situacao: {
        tipo: "em-etapa-intervalo",
        etapa: "producao",
        proximaEtapa: "secagem",
        diasAteProxima: 2,
      },
    },
    { nome: "em-etapa-marco", situacao: { tipo: "em-etapa-marco", etapa: "queima1" } },
    {
      nome: "ultima-etapa",
      situacao: { tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 0 },
    },
    {
      nome: "atrasada",
      situacao: { tipo: "atrasada", dataPrevista: "2026-08-24", diasDeAtraso: 1 },
    },
    { nome: "concluida", situacao: { tipo: "concluida", dataDeConclusao: "2026-08-24" } },
    { nome: "cancelada", situacao: { tipo: "cancelada" } },
    { nome: "sem-etapas", situacao: { tipo: "sem-etapas" } },
    {
      nome: "em-espera",
      situacao: { tipo: "em-espera", proximaEtapa: "queima2", diasAteProxima: 3 },
    },
  ];

  it.each(casos)("devolve uma frase não vazia para o ramo $nome", ({ situacao }) => {
    expect(textoDaSituacao(situacao).length).toBeGreaterThan(0);
  });

  it("cobre os NOVE ramos de Situacao (inventário desta suíte)", () => {
    expect(casos).toHaveLength(9);
  });

  it('atrasada contém a palavra "Atrasada" e a data prevista', () => {
    const texto = textoDaSituacao({
      tipo: "atrasada",
      dataPrevista: "2026-08-24",
      diasDeAtraso: 3,
    });

    expect(texto).toContain("Atrasada");
    expect(texto).toContain("24 ago");
  });

  it('nao-comecou contém "Começa em" e o número de dias', () => {
    const texto = textoDaSituacao({
      tipo: "nao-comecou",
      diasAteInicio: 5,
      dataInicio: "2026-08-20",
    });

    expect(texto).toContain("Começa em");
    expect(texto).toContain("5");
  });

  it("semCor: true devolve a variante textual usada na folha impressa — o caso atrasada não depende de cor", () => {
    const comCor = textoDaSituacao({
      tipo: "atrasada",
      dataPrevista: "2026-08-24",
      diasDeAtraso: 2,
    });
    const semCor = textoDaSituacao(
      { tipo: "atrasada", dataPrevista: "2026-08-24", diasDeAtraso: 2 },
      { semCor: true },
    );

    expect(semCor).toContain("atrasada");
    expect(semCor).not.toBe(comCor);
  });

  it("concluida com dataDeConclusao null (as 6 etapas em 0 dias) ainda devolve frase não vazia, sem lançar", () => {
    expect(() => textoDaSituacao({ tipo: "concluida", dataDeConclusao: null })).not.toThrow();
    expect(textoDaSituacao({ tipo: "concluida", dataDeConclusao: null }).length).toBeGreaterThan(
      0,
    );
  });

  it("cancelada devolve exatamente a frase que diz que a encomenda foi cancelada", () => {
    expect(textoDaSituacao({ tipo: "cancelada" })).toContain("Cancelada");
  });

  it("em-etapa-intervalo usa ROTULO_ETAPA para nomear a etapa atual e a próxima", () => {
    const texto = textoDaSituacao({
      tipo: "em-etapa-intervalo",
      etapa: "producao",
      proximaEtapa: "secagem",
      diasAteProxima: 4,
    });

    expect(texto).toContain(ROTULO_ETAPA.producao);
    expect(texto).toContain(ROTULO_ETAPA.secagem);
    expect(texto).toContain("4");
  });

  it("em-espera nomeia a próxima etapa por ROTULO_ETAPA e traz a contagem de dias que faltam", () => {
    const texto = textoDaSituacao({
      tipo: "em-espera",
      proximaEtapa: "queima2",
      diasAteProxima: 2,
    });

    expect(texto).toContain(ROTULO_ETAPA.queima2);
    expect(texto).toContain("2");
  });
});

describe("textoDaEspera (D-08)", () => {
  it("0 devolve null — o marco segue direto da etapa anterior, nada a dizer", () => {
    expect(textoDaEspera(0)).toBeNull();
  });

  it("1 sai no singular", () => {
    expect(textoDaEspera(1)).toBe("1 dia depois");
  });

  it("3 sai no plural", () => {
    expect(textoDaEspera(3)).toBe("3 dias depois");
  });

  it("SUFIXO_ESPERA é exatamente 'dias depois' — a palavra do próprio dono (D-08)", () => {
    expect(SUFIXO_ESPERA).toBe("dias depois");
  });
});

describe("textoDaEsperaNaTrilha (D-09 — vão vazio da trilha e do Gantt)", () => {
  it("0 devolve null — nada a dizer, o marco segue direto da etapa anterior", () => {
    expect(textoDaEsperaNaTrilha(0)).toBeNull();
  });

  it("1 sai no singular", () => {
    expect(textoDaEsperaNaTrilha(1)).toBe("A peça fica parada 1 dia antes desta etapa.");
  });

  it("5 sai no plural", () => {
    expect(textoDaEsperaNaTrilha(5)).toBe("A peça fica parada 5 dias antes desta etapa.");
  });
});

describe("textoDaContagemDeItens (índice mostra a contagem)", () => {
  it("0 devolve 'sem itens'", () => {
    expect(textoDaContagemDeItens(0)).toBe("sem itens");
  });

  it("1 devolve '1 item', no singular", () => {
    expect(textoDaContagemDeItens(1)).toBe("1 item");
  });

  it("2 devolve '2 itens', no plural", () => {
    expect(textoDaContagemDeItens(2)).toBe("2 itens");
  });

  it("17 devolve '17 itens'", () => {
    expect(textoDaContagemDeItens(17)).toBe("17 itens");
  });
});
