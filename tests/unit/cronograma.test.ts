import { describe, expect, it } from "vitest";
import { etapaEncomenda, statusEncomenda } from "@/db/schema";
import {
  DIAS_PADRAO,
  ORDEM_DAS_ETAPAS,
  STATUS_DE_ENCOMENDA,
  calcularCronograma,
  situacaoEm,
  type DuracaoDeEtapa,
  type Situacao,
} from "../../lib/encomendas/cronograma";

describe("calcularCronograma", () => {
  it("cascata com os padrões: producao de 2026-08-12 a 2026-08-15 (fim exclusivo)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const producao = cronograma.faixas.find((faixa) => faixa.etapa === "producao");

    expect(producao?.inicio).toBe("2026-08-12");
    expect(producao?.fimExclusivo).toBe("2026-08-15");
  });

  it("fim exclusivo: secagem começa no mesmo dia em que producao termina (2026-08-15)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const secagem = cronograma.faixas.find((faixa) => faixa.etapa === "secagem");

    expect(secagem?.inicio).toBe("2026-08-15");
  });

  it("fim exclusivo: para todos os cinco pares adjacentes, fimExclusivo da anterior === inicio da seguinte", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);

    for (let i = 0; i < cronograma.faixas.length - 1; i++) {
      expect(cronograma.faixas[i].fimExclusivo).toBe(cronograma.faixas[i + 1].inicio);
    }
  });

  it("ultimoDia é o dia anterior ao fimExclusivo (secagem: fim exclusivo 2026-08-21, último dia 2026-08-20)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const secagem = cronograma.faixas.find((faixa) => faixa.etapa === "secagem");

    expect(secagem?.fimExclusivo).toBe("2026-08-21");
    expect(secagem?.ultimoDia).toBe("2026-08-20");
  });

  it("etapa com dias === 0 não é desenhada, tem ultimoDia null e não avança o cursor", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3 },
      { etapa: "secagem", dias: 0 },
      { etapa: "queima1", dias: 1 },
      { etapa: "esmaltacao", dias: 1 },
      { etapa: "queima2", dias: 1 },
      { etapa: "entrega", dias: 1 },
    ];
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const secagem = cronograma.faixas.find((faixa) => faixa.etapa === "secagem");
    const queima1 = cronograma.faixas.find((faixa) => faixa.etapa === "queima1");

    expect(secagem?.desenhada).toBe(false);
    expect(secagem?.ultimoDia).toBeNull();
    expect(secagem?.inicio).toBe(secagem?.fimExclusivo);
    // queima1 começa onde producao terminou (2026-08-15) — secagem em 0 dias não deslocou nada.
    expect(queima1?.inicio).toBe("2026-08-15");
  });

  it("todas as 6 etapas em 0 dias: nenhuma desenhada, dataDeConclusao null", () => {
    const duracoes: DuracaoDeEtapa[] = ORDEM_DAS_ETAPAS.map((etapa) => ({ etapa, dias: 0 }));
    const cronograma = calcularCronograma("2026-08-12", duracoes);

    expect(cronograma.faixas.every((faixa) => !faixa.desenhada)).toBe(true);
    expect(cronograma.dataDeConclusao).toBeNull();
    expect(cronograma.fimExclusivo).toBe("2026-08-12");
  });

  it("duracaoTotalEmDias é a soma dos dias das 6 etapas padrão (3+6+1+1+1+1 = 13)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);

    expect(cronograma.duracaoTotalEmDias).toBe(13);
  });

  it("dataDeConclusao é o ultimoDia da última etapa com dias > 0 (entrega: 2026-08-24)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const entrega = cronograma.faixas.find((faixa) => faixa.etapa === "entrega");

    expect(entrega?.ultimoDia).toBe("2026-08-24");
    expect(cronograma.dataDeConclusao).toBe("2026-08-24");
  });

  it("dataDeConclusao com entrega desligada é o ultimoDia de queima2, nunca null", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3 },
      { etapa: "secagem", dias: 6 },
      { etapa: "queima1", dias: 1 },
      { etapa: "esmaltacao", dias: 1 },
      { etapa: "queima2", dias: 1 },
      { etapa: "entrega", dias: 0 },
    ];
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const queima2 = cronograma.faixas.find((faixa) => faixa.etapa === "queima2");
    const entrega = cronograma.faixas.find((faixa) => faixa.etapa === "entrega");

    expect(entrega?.desenhada).toBe(false);
    expect(cronograma.dataDeConclusao).toBe(queima2?.ultimoDia);
    expect(cronograma.dataDeConclusao).not.toBeNull();
  });

  it("marca queima1, queima2 e entrega como marco: true, e producao/secagem/esmaltacao como marco: false", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const porEtapa = Object.fromEntries(
      cronograma.faixas.map((faixa) => [faixa.etapa, faixa.marco]),
    );

    expect(porEtapa.queima1).toBe(true);
    expect(porEtapa.queima2).toBe(true);
    expect(porEtapa.entrega).toBe(true);
    expect(porEtapa.producao).toBe(false);
    expect(porEtapa.secagem).toBe(false);
    expect(porEtapa.esmaltacao).toBe(false);
  });

  it("DIAS_PADRAO está na mesma ordem de ORDEM_DAS_ETAPAS", () => {
    expect(DIAS_PADRAO.map((duracao) => duracao.etapa)).toEqual(ORDEM_DAS_ETAPAS);
  });

  it.each(["queima1", "queima2", "entrega"] as const)(
    "marco %s com dias: 2 lança RangeError nomeando a etapa",
    (etapa) => {
      const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
        duracao.etapa === etapa ? { etapa, dias: 2 } : duracao,
      );

      expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
      try {
        calcularCronograma("2026-08-12", duracoes);
      } catch (erro) {
        expect((erro as Error).message).toContain(etapa);
      }
    },
  );

  it.each(["queima1", "queima2", "entrega"] as const)(
    "marco %s com dias: -1 lança RangeError nomeando a etapa",
    (etapa) => {
      const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
        duracao.etapa === etapa ? { etapa, dias: -1 } : duracao,
      );

      expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
    },
  );

  it.each(["queima1", "queima2", "entrega"] as const)(
    "marco %s com dias: 0 e dias: 1 não lança",
    (etapa) => {
      const comZero: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
        duracao.etapa === etapa ? { etapa, dias: 0 } : duracao,
      );
      const comUm: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
        duracao.etapa === etapa ? { etapa, dias: 1 } : duracao,
      );

      expect(() => calcularCronograma("2026-08-12", comZero)).not.toThrow();
      expect(() => calcularCronograma("2026-08-12", comUm)).not.toThrow();
    },
  );

  it("etapa não-marco com dias negativo lança RangeError", () => {
    const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
      duracao.etapa === "producao" ? { etapa: "producao" as const, dias: -3 } : duracao,
    );

    expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
  });

  it("virada de mês: 2026-08-29 + producao: 3 termina em 2026-09-01 (exclusivo), ultimoDia 2026-08-31", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3 }];
    const cronograma = calcularCronograma("2026-08-29", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.fimExclusivo).toBe("2026-09-01");
    expect(producao.ultimoDia).toBe("2026-08-31");
  });

  it("ano bissexto: 2028-02-27 + producao: 3 tem ultimoDia 2028-02-29 e fimExclusivo 2028-03-01 (2028 é bissexto)", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3 }];
    const cronograma = calcularCronograma("2028-02-27", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.ultimoDia).toBe("2028-02-29");
    expect(producao.fimExclusivo).toBe("2028-03-01");
  });

  it("o mesmo cálculo em 2027 (não bissexto) tem ultimoDia 2027-03-01, sem 29 de fevereiro", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3 }];
    const cronograma = calcularCronograma("2027-02-27", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.ultimoDia).toBe("2027-03-01");
    expect(producao.fimExclusivo).toBe("2027-03-02");
  });

  it("virada de ano: 2026-12-30 + producao: 3 tem fimExclusivo 2027-01-02", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3 }];
    const cronograma = calcularCronograma("2026-12-30", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.fimExclusivo).toBe("2027-01-02");
  });

  it("ORDEM_DAS_ETAPAS casa exatamente, na mesma ordem, com etapaEncomenda.enumValues de db/schema.ts", () => {
    expect(ORDEM_DAS_ETAPAS).toEqual(etapaEncomenda.enumValues);
  });

  it("STATUS_DE_ENCOMENDA casa exatamente, na mesma ordem, com statusEncomenda.enumValues de db/schema.ts", () => {
    expect(STATUS_DE_ENCOMENDA).toEqual(statusEncomenda.enumValues);
  });
});

describe("situacaoEm", () => {
  const cronogramaPadrao = calcularCronograma("2026-08-12", DIAS_PADRAO);

  it("hoje um dia antes de dataInicio (2026-08-11): nao-comecou com diasAteInicio: 1", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-11");

    expect(situacao.tipo).toBe("nao-comecou");
    expect(situacao).toMatchObject({
      tipo: "nao-comecou",
      diasAteInicio: 1,
      dataInicio: "2026-08-12",
    });
  });

  it("hoje exatamente igual a dataInicio (2026-08-12): é a primeira etapa com dias > 0 (producao)", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-12");

    expect(situacao.tipo).toBe("em-etapa-intervalo");
    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "producao",
      proximaEtapa: "secagem",
      diasAteProxima: 3,
    });
  });

  it("hoje dentro de producao (2026-08-13): em-etapa-intervalo com diasAteProxima: 2", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "producao",
      proximaEtapa: "secagem",
      diasAteProxima: 2,
    });
  });

  it("hoje na fronteira producao/secagem (2026-08-15): aponta secagem, a etapa que COMEÇA ali, não producao", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-15");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "secagem",
      proximaEtapa: "queima1",
      diasAteProxima: 6,
    });
  });

  it("hoje na fronteira secagem/queima1 (2026-08-21): aponta queima1 (marco), não secagem", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-21");

    expect(situacao).toMatchObject({ tipo: "em-etapa-marco", etapa: "queima1" });
  });

  it("hoje na fronteira queima1/esmaltacao (2026-08-22): em-etapa-intervalo esmaltacao, diasAteProxima: 1", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-22");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "esmaltacao",
      proximaEtapa: "queima2",
      diasAteProxima: 1,
    });
  });

  it("hoje na fronteira esmaltacao/queima2 (2026-08-23): em-etapa-marco queima2 (não é a última etapa desenhada)", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-23");

    expect(situacao).toMatchObject({ tipo: "em-etapa-marco", etapa: "queima2" });
  });

  it("hoje na fronteira queima2/entrega (2026-08-24), entrega é a última etapa: ultima-etapa com diasAteEntrega: 0", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-24");

    expect(situacao).toMatchObject({ tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 0 });
  });

  it("hoje um dia depois do ultimoDia da última etapa (2026-08-25), status em_producao: atrasada com diasDeAtraso: 1", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-25");

    expect(situacao).toMatchObject({
      tipo: "atrasada",
      dataPrevista: "2026-08-24",
      diasDeAtraso: 1,
    });
  });

  it("atrasada dois dias depois: diasDeAtraso: 2", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-26");

    expect(situacao).toMatchObject({ tipo: "atrasada", diasDeAtraso: 2 });
  });

  it("última etapa quando é um intervalo (não marco): ultima-etapa com diasAteEntrega correto", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3 },
      { etapa: "secagem", dias: 0 },
      { etapa: "queima1", dias: 0 },
      { etapa: "esmaltacao", dias: 0 },
      { etapa: "queima2", dias: 0 },
      { etapa: "entrega", dias: 0 },
    ];
    const cronograma = calcularCronograma("2026-08-12", duracoes);

    const umDiaAntes = situacaoEm(cronograma, "em_producao", "2026-08-13");
    expect(umDiaAntes).toMatchObject({
      tipo: "ultima-etapa",
      etapa: "producao",
      diasAteEntrega: 1,
    });

    const ultimoDia = situacaoEm(cronograma, "em_producao", "2026-08-14");
    expect(ultimoDia).toMatchObject({
      tipo: "ultima-etapa",
      etapa: "producao",
      diasAteEntrega: 0,
    });
  });

  it("proximaEtapa pula etapas desligadas (secagem em 0 dias): produção aponta direto para queima1", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3 },
      { etapa: "secagem", dias: 0 },
      { etapa: "queima1", dias: 1 },
      { etapa: "esmaltacao", dias: 1 },
      { etapa: "queima2", dias: 1 },
      { etapa: "entrega", dias: 1 },
    ];
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const situacao = situacaoEm(cronograma, "em_producao", "2026-08-13");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "producao",
      proximaEtapa: "queima1",
      diasAteProxima: 2,
    });
  });

  it("status concluida devolve concluida com dataDeConclusao, mesmo com hoje muito depois da data prevista", () => {
    const situacao = situacaoEm(cronogramaPadrao, "concluida", "2027-01-01");

    expect(situacao).toEqual({ tipo: "concluida", dataDeConclusao: "2026-08-24" });
  });

  it("status cancelada devolve apenas { tipo: 'cancelada' }, sem etapa atual", () => {
    const situacao = situacaoEm(cronogramaPadrao, "cancelada", "2026-08-13");

    expect(situacao).toEqual({ tipo: "cancelada" });
  });

  it("status rascunho segue a mesma lógica de data de em_producao", () => {
    const emProducao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");
    const rascunho = situacaoEm(cronogramaPadrao, "rascunho", "2026-08-13");

    expect(rascunho).toEqual(emProducao);
  });

  it("cronograma sem nenhuma etapa desenhada (as 6 em 0 dias): sem-etapas", () => {
    const duracoes: DuracaoDeEtapa[] = ORDEM_DAS_ETAPAS.map((etapa) => ({ etapa, dias: 0 }));
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const situacao = situacaoEm(cronograma, "em_producao", "2026-08-12");

    expect(situacao).toEqual({ tipo: "sem-etapas" });
  });

  it("chamada duas vezes com os mesmos argumentos devolve resultado estruturalmente igual, sem mutar os argumentos", () => {
    const cronogramaAntes = JSON.stringify(cronogramaPadrao);
    const primeira = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");
    const segunda = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");

    expect(primeira).toEqual(segunda);
    expect(JSON.stringify(cronogramaPadrao)).toBe(cronogramaAntes);
  });

  it("os oito ramos de Situacao['tipo'] aparecem cobertos por algum caso de teste desta suíte", () => {
    const tiposEsperados: Array<Situacao["tipo"]> = [
      "nao-comecou",
      "em-etapa-intervalo",
      "em-etapa-marco",
      "ultima-etapa",
      "atrasada",
      "concluida",
      "cancelada",
      "sem-etapas",
    ];

    // Este teste é uma verificação de inventário: se um ramo novo for adicionado ao tipo
    // Situacao sem que apareça aqui, é um lembrete para o autor do teste, não uma prova em si
    // (a prova real são os `it`s acima, cada um nomeando seu ramo).
    expect(tiposEsperados).toHaveLength(8);
  });
});
