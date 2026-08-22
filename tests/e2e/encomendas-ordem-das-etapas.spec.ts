import { randomBytes } from "node:crypto";

import { test, expect } from "@playwright/test";

import { ORDEM_DAS_ETAPAS, calcularCronograma } from "@/lib/encomendas/cronograma";
import {
  apagarEncomenda,
  criarEncomendaComEtapasPadrao,
  inverterOrdemFisicaDasEtapas,
  lerEtapasOrdenadas,
  lerEtapasSemOrdenar,
} from "./apoio/etapas-no-banco";

// Gap 16 da verificação (04.1-05): prova, com Postgres DE VERDADE, que a ORDEM FÍSICA das
// linhas de `encomenda_etapas` pode divergir de `ORDEM_DAS_ETAPAS`, e que é `order by ordem`
// que fixa a ordem que `calcularCronograma` recebe. Não abre navegador — fala direto com o
// banco de teste, no molde de `tests/e2e/apoio/etapas-no-banco.ts`.
//
// Sem etiqueta `@vazio-global`/`@vazio-historico`: este teste não afirma nenhuma condição
// GLOBAL do banco, só sobre a encomenda `[e2e]` que ele mesmo cria — roda em `desktop` e
// `celular` como qualquer outro teste (playwright.config.ts).
test("a ordem física das linhas pode divergir de ORDEM_DAS_ETAPAS, e é o order by que fixa a ordem que a cascata recebe", async ({}, testInfo) => {
  const sufixo = `${randomBytes(4).toString("hex")}-${testInfo.project.name}`;
  const nome = `[e2e] ordem-das-etapas-${sufixo}`;
  const dataInicio = "2026-08-12";

  const encomendaId = await criarEncomendaComEtapasPadrao(nome, dataInicio);

  try {
    // Estado inicial: recém-criada, a leitura ordenada já bate com ORDEM_DAS_ETAPAS.
    const etapasIniciais = await lerEtapasOrdenadas(encomendaId);
    expect(etapasIniciais.map((etapa) => etapa.etapa)).toEqual(ORDEM_DAS_ETAPAS);

    await inverterOrdemFisicaDasEtapas(encomendaId);

    // A PREMISSA: a leitura sem ordenação agora devolve uma sequência DIFERENTE de
    // ORDEM_DAS_ETAPAS — a prova de que a ordem física foi mesmo forçada a divergir. Se isto
    // falhar, o resto do teste seria vazio (provaria nada): falha alto, com a sequência
    // observada na própria mensagem, nunca um `skip` silencioso.
    const etapasSemOrdenar = await lerEtapasSemOrdenar(encomendaId);
    const sequenciaSemOrdenar = etapasSemOrdenar.map((etapa) => etapa.etapa);
    expect(
      sequenciaSemOrdenar,
      `a ordem física não pôde ser forçada a divergir — leitura sem ordenação devolveu ` +
        `${JSON.stringify(sequenciaSemOrdenar)}, igual a ORDEM_DAS_ETAPAS. Sem essa divergência ` +
        `o restante deste teste não prova nada.`,
    ).not.toEqual([...ORDEM_DAS_ETAPAS]);

    // A CORREÇÃO: com order by ordem, a leitura volta a bater com ORDEM_DAS_ETAPAS mesmo com a
    // linha física invertida — é isto que o `.orderBy(asc(encomendaEtapas.ordem))` de
    // lib/encomendas/acoes.ts compra.
    const etapasOrdenadas = await lerEtapasOrdenadas(encomendaId);
    expect(etapasOrdenadas.map((etapa) => etapa.etapa)).toEqual(ORDEM_DAS_ETAPAS);

    // A CONSEQUÊNCIA: alimentar calcularCronograma com a leitura desordenada produz uma faixa
    // de queima2 com inicio DIFERENTE da leitura ordenada — a entrada errada produz cascata
    // errada.
    const cronogramaSemOrdenar = calcularCronograma(dataInicio, etapasSemOrdenar);
    const cronogramaOrdenado = calcularCronograma(dataInicio, etapasOrdenadas);

    const queima2SemOrdenar = cronogramaSemOrdenar.faixas.find(
      (faixa) => faixa.etapa === "queima2",
    );
    const queima2Ordenado = cronogramaOrdenado.faixas.find((faixa) => faixa.etapa === "queima2");

    expect(queima2SemOrdenar?.inicio).not.toBe(queima2Ordenado?.inicio);
  } finally {
    await apagarEncomenda(encomendaId);
  }
});
