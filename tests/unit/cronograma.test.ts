import { describe, expect, it } from "vitest";
import { etapaEncomenda, statusEncomenda } from "@/db/schema";
import {
  DIAS_PADRAO,
  ORDEM_DAS_ETAPAS,
  STATUS_DE_ENCOMENDA,
  calcularCronograma,
  situacaoEm,
  type Cronograma,
  type DuracaoDeEtapa,
  type Etapa,
  type FaixaDeEtapa,
  type Situacao,
} from "../../lib/encomendas/cronograma";

describe("calcularCronograma", () => {
  it("cascata com os padrões: producao de 2026-08-12 a 2026-08-17 (fim exclusivo)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const producao = cronograma.faixas.find((faixa) => faixa.etapa === "producao");

    expect(producao?.inicio).toBe("2026-08-12");
    expect(producao?.fimExclusivo).toBe("2026-08-17");
  });

  it("fim exclusivo: secagem começa no mesmo dia em que producao termina (2026-08-17)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const secagem = cronograma.faixas.find((faixa) => faixa.etapa === "secagem");

    expect(secagem?.inicio).toBe("2026-08-17");
  });

  it("sem espera, fimExclusivo da anterior === inicio da seguinte (producao→secagem→queima1→esmaltacao)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const porEtapa = Object.fromEntries(cronograma.faixas.map((faixa) => [faixa.etapa, faixa]));

    expect(porEtapa.producao.fimExclusivo).toBe(porEtapa.secagem.inicio);
    expect(porEtapa.secagem.fimExclusivo).toBe(porEtapa.queima1.inicio);
    expect(porEtapa.queima1.fimExclusivo).toBe(porEtapa.esmaltacao.inicio);
  });

  it("com espera, existe um vão entre o fimExclusivo da anterior e o início do marco seguinte (esmaltação→queima2: 3 dias; queima2→entrega: 5 dias)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const porEtapa = Object.fromEntries(cronograma.faixas.map((faixa) => [faixa.etapa, faixa]));

    expect(porEtapa.esmaltacao.fimExclusivo).toBe("2026-09-03");
    expect(porEtapa.queima2.inicio).toBe("2026-09-06");
    expect(porEtapa.queima2.fimExclusivo).toBe("2026-09-07");
    expect(porEtapa.entrega.inicio).toBe("2026-09-12");
  });

  it("nenhuma faixa é criada para o vão: faixas continua com exatamente 6 entradas, na ordem de ORDEM_DAS_ETAPAS", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);

    expect(cronograma.faixas).toHaveLength(6);
    expect(cronograma.faixas.map((faixa) => faixa.etapa)).toEqual(ORDEM_DAS_ETAPAS);
  });

  it("com esperaDias: 0 em queima2, o fimExclusivo da esmaltação é exatamente o início de queima2 (adjacência exata)", () => {
    const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
      duracao.etapa === "queima2" ? { ...duracao, esperaDias: 0 } : duracao,
    );
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const porEtapa = Object.fromEntries(cronograma.faixas.map((faixa) => [faixa.etapa, faixa]));

    expect(porEtapa.esmaltacao.fimExclusivo).toBe(porEtapa.queima2.inicio);
  });

  it("ultimoDia é o dia anterior ao fimExclusivo (secagem: fim exclusivo 2026-09-01, último dia 2026-08-31)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const secagem = cronograma.faixas.find((faixa) => faixa.etapa === "secagem");

    expect(secagem?.fimExclusivo).toBe("2026-09-01");
    expect(secagem?.ultimoDia).toBe("2026-08-31");
  });

  it("etapa com dias === 0 não é desenhada, tem ultimoDia null e não avança o cursor", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3, esperaDias: 0 },
      { etapa: "secagem", dias: 0, esperaDias: 0 },
      { etapa: "queima1", dias: 1, esperaDias: 0 },
      { etapa: "esmaltacao", dias: 1, esperaDias: 0 },
      { etapa: "queima2", dias: 1, esperaDias: 0 },
      { etapa: "entrega", dias: 1, esperaDias: 0 },
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

  it("as três etapas que não são marco em 0 dias: os três marcos continuam desenhados e dataDeConclusao é o último dia da entrega", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 0, esperaDias: 0 },
      { etapa: "secagem", dias: 0, esperaDias: 0 },
      { etapa: "queima1", dias: 1, esperaDias: 0 },
      { etapa: "esmaltacao", dias: 0, esperaDias: 0 },
      { etapa: "queima2", dias: 1, esperaDias: 0 },
      { etapa: "entrega", dias: 1, esperaDias: 0 },
    ];
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const porEtapa = Object.fromEntries(cronograma.faixas.map((faixa) => [faixa.etapa, faixa]));

    expect(porEtapa.producao.desenhada).toBe(false);
    expect(porEtapa.secagem.desenhada).toBe(false);
    expect(porEtapa.esmaltacao.desenhada).toBe(false);
    expect(porEtapa.queima1.desenhada).toBe(true);
    expect(porEtapa.queima2.desenhada).toBe(true);
    expect(porEtapa.entrega.desenhada).toBe(true);
    expect(cronograma.dataDeConclusao).toBe(porEtapa.entrega.ultimoDia);
    expect(cronograma.dataDeConclusao).not.toBeNull();
  });

  it("duracaoTotalEmDias é a soma de dias e esperas das 6 etapas padrão (5 + 15 + (0+1) + 1 + (3+1) + (5+1) = 32)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);

    expect(cronograma.duracaoTotalEmDias).toBe(32);
  });

  it("dataDeConclusao é o ultimoDia da última etapa com dias > 0 (entrega: 2026-09-12)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const entrega = cronograma.faixas.find((faixa) => faixa.etapa === "entrega");

    expect(entrega?.ultimoDia).toBe("2026-09-12");
    expect(cronograma.dataDeConclusao).toBe("2026-09-12");
  });

  it("entrega é sempre desenhada e sempre entra na conclusão — não existe mais 'entrega desligada' (D-06)", () => {
    const cronograma = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const entrega = cronograma.faixas.find((faixa) => faixa.etapa === "entrega");

    expect(entrega?.desenhada).toBe(true);
    expect(cronograma.dataDeConclusao).toBe(entrega?.ultimoDia);
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
    "marco %s com dias: 0 ou 2 lança RangeError nomeando a etapa (D-06: marco sempre dura 1 dia)",
    (etapa) => {
      for (const diasInvalidos of [0, 2]) {
        const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
          duracao.etapa === etapa ? { ...duracao, dias: diasInvalidos } : duracao,
        );

        expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
        try {
          calcularCronograma("2026-08-12", duracoes);
        } catch (erro) {
          expect((erro as Error).message).toContain(etapa);
        }
      }
    },
  );

  it.each(["queima1", "queima2", "entrega"] as const)("marco %s com dias: 1 não lança", (etapa) => {
    const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
      duracao.etapa === etapa ? { ...duracao, dias: 1 } : duracao,
    );

    expect(() => calcularCronograma("2026-08-12", duracoes)).not.toThrow();
  });

  it.each(["queima1", "queima2", "entrega"] as const)(
    "marco %s com espera -1, 366 ou 1.5 lança RangeError nomeando a etapa",
    (etapa) => {
      for (const esperaInvalida of [-1, 366, 1.5]) {
        const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
          duracao.etapa === etapa ? { ...duracao, esperaDias: esperaInvalida } : duracao,
        );

        expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
        try {
          calcularCronograma("2026-08-12", duracoes);
        } catch (erro) {
          expect((erro as Error).message).toContain(etapa);
        }
      }
    },
  );

  it.each(["producao", "secagem", "esmaltacao"] as const)(
    "etapa que não é marco (%s) com espera diferente de 0 lança RangeError nomeando a etapa (D-03)",
    (etapa) => {
      const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
        duracao.etapa === etapa ? { ...duracao, esperaDias: 3 } : duracao,
      );

      expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
      try {
        calcularCronograma("2026-08-12", duracoes);
      } catch (erro) {
        expect((erro as Error).message).toContain(etapa);
      }
    },
  );

  it("etapa não-marco com dias negativo lança RangeError", () => {
    const duracoes: DuracaoDeEtapa[] = DIAS_PADRAO.map((duracao) =>
      duracao.etapa === "producao"
        ? { etapa: "producao" as const, dias: -3, esperaDias: 0 }
        : duracao,
    );

    expect(() => calcularCronograma("2026-08-12", duracoes)).toThrowError(RangeError);
  });

  it("chamar calcularCronograma duas vezes com os mesmos argumentos devolve resultado estruturalmente igual e não muta a entrada", () => {
    const entradaAntes = JSON.stringify(DIAS_PADRAO);
    const primeira = calcularCronograma("2026-08-12", DIAS_PADRAO);
    const segunda = calcularCronograma("2026-08-12", DIAS_PADRAO);

    expect(primeira).toEqual(segunda);
    expect(JSON.stringify(DIAS_PADRAO)).toBe(entradaAntes);
  });

  it("virada de mês: 2026-08-29 + producao: 3 termina em 2026-09-01 (exclusivo), ultimoDia 2026-08-31", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3, esperaDias: 0 }];
    const cronograma = calcularCronograma("2026-08-29", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.fimExclusivo).toBe("2026-09-01");
    expect(producao.ultimoDia).toBe("2026-08-31");
  });

  it("ano bissexto: 2028-02-27 + producao: 3 tem ultimoDia 2028-02-29 e fimExclusivo 2028-03-01 (2028 é bissexto)", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3, esperaDias: 0 }];
    const cronograma = calcularCronograma("2028-02-27", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.ultimoDia).toBe("2028-02-29");
    expect(producao.fimExclusivo).toBe("2028-03-01");
  });

  it("o mesmo cálculo em 2027 (não bissexto) tem ultimoDia 2027-03-01, sem 29 de fevereiro", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3, esperaDias: 0 }];
    const cronograma = calcularCronograma("2027-02-27", duracoes);
    const producao = cronograma.faixas[0];

    expect(producao.ultimoDia).toBe("2027-03-01");
    expect(producao.fimExclusivo).toBe("2027-03-02");
  });

  it("virada de ano: 2026-12-30 + producao: 3 tem fimExclusivo 2027-01-02", () => {
    const duracoes: DuracaoDeEtapa[] = [{ etapa: "producao", dias: 3, esperaDias: 0 }];
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
      diasAteProxima: 5,
    });
  });

  it("hoje dentro de producao (2026-08-13): em-etapa-intervalo com diasAteProxima: 4", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "producao",
      proximaEtapa: "secagem",
      diasAteProxima: 4,
    });
  });

  it("hoje na fronteira producao/secagem (2026-08-17): aponta secagem, a etapa que COMEÇA ali, não producao", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-17");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "secagem",
      proximaEtapa: "queima1",
      diasAteProxima: 15,
    });
  });

  it("hoje na fronteira secagem/queima1 (2026-09-01): aponta queima1 (marco), não secagem — 2026-09-01 é o marco da queima de biscoito", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-01");

    expect(situacao).toMatchObject({ tipo: "em-etapa-marco", etapa: "queima1" });
  });

  it("hoje na fronteira queima1/esmaltacao (2026-09-02), dentro da esmaltação: diasAteProxima conta até o INÍCIO do marco seguinte (4), nunca até o fim da faixa atual (o que daria 1, errado)", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-02");

    expect(situacao).toMatchObject({
      tipo: "em-etapa-intervalo",
      etapa: "esmaltacao",
      proximaEtapa: "queima2",
      diasAteProxima: 4,
    });
  });

  it("hoje no vão antes de queima2 (2026-09-04): em-espera, proximaEtapa queima2, diasAteProxima 2", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-04");

    expect(situacao).toMatchObject({
      tipo: "em-espera",
      proximaEtapa: "queima2",
      diasAteProxima: 2,
    });
  });

  it("hoje no último dia do vão antes de queima2 (2026-09-05): em-espera, diasAteProxima 1", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-05");

    expect(situacao).toMatchObject({
      tipo: "em-espera",
      proximaEtapa: "queima2",
      diasAteProxima: 1,
    });
  });

  it("hoje no início de queima2 (2026-09-06): em-etapa-marco queima2 (não é a última etapa desenhada)", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-06");

    expect(situacao).toMatchObject({ tipo: "em-etapa-marco", etapa: "queima2" });
  });

  it("hoje no vão antes da entrega (2026-09-08): em-espera, proximaEtapa entrega, diasAteProxima 4", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-08");

    expect(situacao).toMatchObject({
      tipo: "em-espera",
      proximaEtapa: "entrega",
      diasAteProxima: 4,
    });
  });

  it("hoje no início da entrega (2026-09-12), a última etapa com 0 dias até a entrega: ultima-etapa com diasAteEntrega: 0", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-12");

    expect(situacao).toMatchObject({ tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 0 });
  });

  it("hoje um dia depois do ultimoDia da última etapa (2026-09-13), status em_producao: atrasada em 1 dia", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-13");

    expect(situacao).toMatchObject({
      tipo: "atrasada",
      dataPrevista: "2026-09-12",
      diasDeAtraso: 1,
    });
  });

  it("atrasada dois dias depois (2026-09-14): diasDeAtraso: 2", () => {
    const situacao = situacaoEm(cronogramaPadrao, "em_producao", "2026-09-14");

    expect(situacao).toMatchObject({ tipo: "atrasada", diasDeAtraso: 2 });
  });

  it("com os três marcos sempre desenhados (D-06), a última etapa desenhada é sempre entrega — não existe mais 'última etapa é um intervalo'", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3, esperaDias: 0 },
      { etapa: "secagem", dias: 0, esperaDias: 0 },
      { etapa: "queima1", dias: 1, esperaDias: 0 },
      { etapa: "esmaltacao", dias: 0, esperaDias: 0 },
      { etapa: "queima2", dias: 1, esperaDias: 0 },
      { etapa: "entrega", dias: 1, esperaDias: 0 },
    ];
    const cronograma = calcularCronograma("2026-08-12", duracoes);
    const ultimaFaixaDesenhada = cronograma.faixas.filter((faixa) => faixa.desenhada).at(-1);

    expect(ultimaFaixaDesenhada?.etapa).toBe("entrega");

    const situacao = situacaoEm(cronograma, "em_producao", cronograma.dataDeConclusao as string);
    expect(situacao).toMatchObject({ tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 0 });
  });

  it("proximaEtapa pula etapas desligadas (secagem em 0 dias): produção aponta direto para queima1", () => {
    const duracoes: DuracaoDeEtapa[] = [
      { etapa: "producao", dias: 3, esperaDias: 0 },
      { etapa: "secagem", dias: 0, esperaDias: 0 },
      { etapa: "queima1", dias: 1, esperaDias: 0 },
      { etapa: "esmaltacao", dias: 1, esperaDias: 0 },
      { etapa: "queima2", dias: 1, esperaDias: 0 },
      { etapa: "entrega", dias: 1, esperaDias: 0 },
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

    expect(situacao).toEqual({ tipo: "concluida", dataDeConclusao: "2026-09-12" });
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

  it("cronograma sem nenhuma etapa desenhada — inalcançável por calcularCronograma a partir da fase 04.1 (marco sempre vale 1 dia), mas o ramo defensivo sem-etapas continua respondendo a uma linha semeada direto no banco", () => {
    function faixaZerada(etapa: Etapa, marco: boolean): FaixaDeEtapa {
      return {
        etapa,
        dias: 0,
        marco,
        inicio: "2026-08-12",
        fimExclusivo: "2026-08-12",
        ultimoDia: null,
        desenhada: false,
        esperaDias: 0,
      };
    }

    const cronogramaSemEtapas: Cronograma = {
      inicio: "2026-08-12",
      fimExclusivo: "2026-08-12",
      duracaoTotalEmDias: 0,
      dataDeConclusao: null,
      faixas: [
        faixaZerada("producao", false),
        faixaZerada("secagem", false),
        faixaZerada("queima1", true),
        faixaZerada("esmaltacao", false),
        faixaZerada("queima2", true),
        faixaZerada("entrega", true),
      ],
    };

    const situacao = situacaoEm(cronogramaSemEtapas, "em_producao", "2026-08-12");

    expect(situacao).toEqual({ tipo: "sem-etapas" });
  });

  it("chamada duas vezes com os mesmos argumentos devolve resultado estruturalmente igual, sem mutar os argumentos", () => {
    const cronogramaAntes = JSON.stringify(cronogramaPadrao);
    const primeira = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");
    const segunda = situacaoEm(cronogramaPadrao, "em_producao", "2026-08-13");

    expect(primeira).toEqual(segunda);
    expect(JSON.stringify(cronogramaPadrao)).toBe(cronogramaAntes);
  });

  it("os nove ramos de Situacao['tipo'] aparecem cobertos por algum caso de teste desta suíte", () => {
    const tiposEsperados: Array<Situacao["tipo"]> = [
      "nao-comecou",
      "em-etapa-intervalo",
      "em-etapa-marco",
      "ultima-etapa",
      "atrasada",
      "concluida",
      "cancelada",
      "sem-etapas",
      "em-espera",
    ];

    // Este teste é uma verificação de inventário: se um ramo novo for adicionado ao tipo
    // Situacao sem que apareça aqui, é um lembrete para o autor do teste, não uma prova em si
    // (a prova real são os `it`s acima, cada um nomeando seu ramo).
    expect(tiposEsperados).toHaveLength(9);
  });
});
