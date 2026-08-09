import { describe, expect, it } from "vitest";
import {
  DIAS_PADRAO,
  ORDEM_DAS_ETAPAS,
  calcularCronograma,
  type DuracaoDeEtapa,
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
});
