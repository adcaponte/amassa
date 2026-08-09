// Módulo puro: recebe dados, devolve dados. Zero imports (regra de `lib/backup/frescor.ts` /
// 01-ARQUITETURA.md §3), e "hoje" nunca é lido do relógio por dentro — quando uma função
// precisar dele, ele entra como argumento. É a regra de negócio mais delicada do sistema: as
// datas de cada etapa nunca são armazenadas (`02-MODELO-DE-DADOS.md` §1 "as datas não são
// armazenadas"), só calculadas em cascata a partir de `dataInicio` — esta é a única fonte da
// cascata, nenhum outro arquivo reimplementa esta conta (proibição PR-2 do plano).
//
// Datas trafegam como string `YYYY-MM-DD` do começo ao fim (PD-05). A aritmética interna é
// puro inteiro — dias desde a época civil (algoritmo abaixo) — e volta para string por conta
// própria; nenhuma instância de `Date` entra na conta em nenhum momento, que é onde o fuso do
// runtime (ou um `Date` "vivo") poderia deslocar o dia.

export type Etapa = "producao" | "secagem" | "queima1" | "esmaltacao" | "queima2" | "entrega";

// Ordem fixa em que as 6 etapas nascem e avançam — a mesma ordem grava a coluna `ordem` de
// `encomenda_etapas` (0..5) em `lib/encomendas/acoes.ts`.
export const ORDEM_DAS_ETAPAS: readonly Etapa[] = [
  "producao",
  "secagem",
  "queima1",
  "esmaltacao",
  "queima2",
  "entrega",
];

// Os três marcos: valem 0 ou 1 dia, e na interface são um interruptor, nunca um campo
// numérico. `marcos_zero_ou_um` no banco é a mesma regra, no nível do Postgres (T-03-03).
export const ETAPAS_MARCO: readonly Etapa[] = ["queima1", "queima2", "entrega"];

export type DuracaoDeEtapa = { etapa: Etapa; dias: number };

// Padrões literais de `amassa-plataforma/02-MODELO-DE-DADOS.md` §1 — já na mesma ordem de
// `ORDEM_DAS_ETAPAS`, prontos para servir direto como segundo argumento de
// `calcularCronograma()`.
export const DIAS_PADRAO: readonly DuracaoDeEtapa[] = [
  { etapa: "producao", dias: 3 },
  { etapa: "secagem", dias: 6 },
  { etapa: "queima1", dias: 1 },
  { etapa: "esmaltacao", dias: 1 },
  { etapa: "queima2", dias: 1 },
  { etapa: "entrega", dias: 1 },
];

// Os quatro status possíveis de uma encomenda, na mesma ordem de `statusEncomenda.enumValues`
// (`db/schema.ts`). O módulo é sem imports, então esta lista é uma segunda cópia da verdade —
// o teste desta tarefa (`tests/unit/cronograma.test.ts`) é o único elo que obriga as duas a
// continuarem iguais.
export const STATUS_DE_ENCOMENDA = [
  "rascunho",
  "em_producao",
  "concluida",
  "cancelada",
] as const;

export type StatusDeEncomenda = (typeof STATUS_DE_ENCOMENDA)[number];

export type FaixaDeEtapa = {
  etapa: Etapa;
  dias: number;
  marco: boolean;
  inicio: string;
  fimExclusivo: string;
  // O dia anterior a `fimExclusivo` — o que a interface mostra como "fim" da etapa. `null`
  // quando `dias === 0`: uma etapa que não acontece não tem último dia.
  ultimoDia: string | null;
  // `false` para etapa de `dias === 0` — não é desenhada no Gantt (§8 do briefing).
  desenhada: boolean;
};

export type Cronograma = {
  inicio: string;
  fimExclusivo: string;
  duracaoTotalEmDias: number;
  // O `ultimoDia` da última etapa com `dias > 0`; `null` quando as 6 estão em 0 (encomenda sem
  // nenhuma etapa desenhada — caso de borda extremo, mas não proibido pelo schema).
  dataDeConclusao: string | null;
  faixas: FaixaDeEtapa[];
};

// A resposta de "que etapa é hoje", para a tabela "Etapa Atual e Dias Restantes (ENC-09)" de
// `03-UI-SPEC.md` — união discriminada por `tipo`, com exatamente um ramo por linha da tabela.
// `switch` exaustivo em `lib/encomendas/textos.ts` (Tarefa 3) é o que garante que um ramo novo
// nunca fica sem tratamento em silêncio.
export type Situacao =
  | { tipo: "nao-comecou"; diasAteInicio: number; dataInicio: string }
  | {
      tipo: "em-etapa-intervalo";
      etapa: Etapa;
      proximaEtapa: Etapa;
      diasAteProxima: number;
    }
  | { tipo: "em-etapa-marco"; etapa: Etapa }
  | { tipo: "ultima-etapa"; etapa: Etapa; diasAteEntrega: number }
  | { tipo: "atrasada"; dataPrevista: string; diasDeAtraso: number }
  | { tipo: "concluida"; dataDeConclusao: string | null }
  | { tipo: "cancelada" }
  // As 6 etapas em 0 dias: não há etapa atual possível. A tabela do UI-SPEC não nomeia este
  // caso — devolvê-lo explicitamente é melhor do que forçar "nao-comecou" numa encomenda que
  // nunca vai começar.
  | { tipo: "sem-etapas" };

// Dias desde 1970-01-01 (proléptico gregoriano), a partir de ano/mês/dia civis. Algoritmo de
// calendário puro (Howard Hinnant, "days_from_civil") — nenhuma instância de `Date` entra
// nesta conta, só inteiros, o que evita qualquer deslocamento de fuso.
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno =
    Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

// Inverso de `diasDesdeAEpoca`: de um número de dias desde a época devolve `{ano, mes, dia}`
// civis. Mesmo algoritmo ("civil_from_days"), mesma ausência de `Date`.
function civilDesdeDias(diasDesdeEpoca: number): { ano: number; mes: number; dia: number } {
  const z = diasDesdeEpoca + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const diaDoEra = z - era * 146097;
  const anoDoEra = Math.floor(
    (diaDoEra -
      Math.floor(diaDoEra / 1460) +
      Math.floor(diaDoEra / 36524) -
      Math.floor(diaDoEra / 146096)) /
      365,
  );
  const anoAjustado = anoDoEra + era * 400;
  const diaDoAno = diaDoEra - (365 * anoDoEra + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100));
  const mesProvisorio = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mesProvisorio + 2) / 5) + 1;
  const mes = mesProvisorio + (mesProvisorio < 10 ? 3 : -9);
  const ano = mes <= 2 ? anoAjustado + 1 : anoAjustado;
  return { ano, mes, dia };
}

function formatarDataCivil(ano: number, mes: number, dia: number): string {
  const anoTexto = String(ano).padStart(4, "0");
  const mesTexto = String(mes).padStart(2, "0");
  const diaTexto = String(dia).padStart(2, "0");
  return `${anoTexto}-${mesTexto}-${diaTexto}`;
}

// Diferença em dias inteiros entre duas datas civis `YYYY-MM-DD` — `dataMaisTarde` menos
// `dataMaisCedo`, na mesma aritmética de inteiros do resto do módulo (nunca `Date`, nunca
// `getTime()`), o que garante o mesmo resultado às 23h de Brasília e às 2h UTC do dia seguinte
// quando o instante já chegou como data civil.
function diferencaEmDias(dataMaisTarde: string, dataMaisCedo: string): number {
  const [anoA, mesA, diaA] = dataMaisTarde.split("-").map(Number);
  const [anoB, mesB, diaB] = dataMaisCedo.split("-").map(Number);
  return diasDesdeAEpoca(anoA, mesA, diaA) - diasDesdeAEpoca(anoB, mesB, diaB);
}

// Soma `dias` dias de calendário (pode ser negativo) a uma data civil `YYYY-MM-DD`, devolvendo
// outra data civil `YYYY-MM-DD`.
function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const diasDesdeEpocaDaEntrada = diasDesdeAEpoca(ano, mes, dia);
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(
    diasDesdeEpocaDaEntrada + dias,
  );
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// Calcula a cascata inteira: cada etapa começa no dia em que a anterior termina (fim
// exclusivo — 00-BRIEFING.md §5), na ordem em que `duracoes` chega (normalmente
// `ORDEM_DAS_ETAPAS`, sempre as 6, mas a função não impõe isso — quem monta a lista decide).
export function calcularCronograma(
  dataInicio: string,
  duracoes: readonly DuracaoDeEtapa[],
): Cronograma {
  // Validação de marco (T-03-10): a restrição `marcos_zero_ou_um` do banco e o `refine` do Zod
  // já barram o caminho normal da aplicação; esta terceira barreira existe porque um módulo
  // puro que coage em silêncio um valor fora do contrato é exatamente o defeito que esta fase
  // mais teme. Um `if` por caso, nenhum `default` que engula um valor impossível.
  for (const duracao of duracoes) {
    if (!Number.isInteger(duracao.dias) || duracao.dias < 0) {
      throw new RangeError(
        `A etapa "${duracao.etapa}" tem duração inválida (${duracao.dias}): precisa ser um ` +
          "número inteiro de dias maior ou igual a 0.",
      );
    }

    if (ETAPAS_MARCO.includes(duracao.etapa) && duracao.dias !== 0 && duracao.dias !== 1) {
      throw new RangeError(
        `A etapa "${duracao.etapa}" é um marco e só aceita 0 (desligado) ou 1 (ligado) dia — ` +
          `recebeu ${duracao.dias}.`,
      );
    }
  }

  const faixas: FaixaDeEtapa[] = [];
  let cursor = dataInicio;
  let duracaoTotalEmDias = 0;
  let dataDeConclusao: string | null = null;

  for (const duracao of duracoes) {
    const marco = ETAPAS_MARCO.includes(duracao.etapa);
    duracaoTotalEmDias += duracao.dias;

    if (duracao.dias === 0) {
      // Etapa zerada: não é desenhada e não avança o cursor — a etapa seguinte começa no
      // mesmo dia que esta começaria (peça que só vai a biscoito, encomenda retirada no
      // ateliê sem etapa de entrega).
      faixas.push({
        etapa: duracao.etapa,
        dias: 0,
        marco,
        inicio: cursor,
        fimExclusivo: cursor,
        ultimoDia: null,
        desenhada: false,
      });
      continue;
    }

    const fimExclusivo = somarDias(cursor, duracao.dias);
    const ultimoDia = somarDias(fimExclusivo, -1);

    faixas.push({
      etapa: duracao.etapa,
      dias: duracao.dias,
      marco,
      inicio: cursor,
      fimExclusivo,
      ultimoDia,
      desenhada: true,
    });

    dataDeConclusao = ultimoDia;
    cursor = fimExclusivo;
  }

  return {
    inicio: dataInicio,
    fimExclusivo: cursor,
    duracaoTotalEmDias,
    dataDeConclusao,
    faixas,
  };
}

// Traduz um `Cronograma` mais o status da encomenda numa `Situacao` em relação a `hoje` — a
// tabela "Etapa Atual e Dias Restantes (ENC-09)" de `03-UI-SPEC.md` inteira, num só lugar.
// Ordem dos ramos, e ela importa: `cancelada` primeiro, `concluida` segundo, `sem-etapas`
// terceiro, `nao-comecou` quarto, `atrasada` quinto, e só então a busca da etapa que contém
// `hoje` — um `if` por caso com retorno próprio, nenhum `default` que engula um caso novo em
// silêncio. Chamar duas vezes com os mesmos argumentos devolve resultado estruturalmente
// igual: nenhuma leitura de relógio, nenhum estado, nenhuma mutação dos argumentos recebidos.
export function situacaoEm(
  cronograma: Cronograma,
  status: StatusDeEncomenda,
  hoje: string,
): Situacao {
  if (status === "cancelada") {
    return { tipo: "cancelada" };
  }

  if (status === "concluida") {
    return { tipo: "concluida", dataDeConclusao: cronograma.dataDeConclusao };
  }

  if (cronograma.dataDeConclusao === null) {
    // As 6 etapas em 0 dias — nenhuma etapa atual é possível.
    return { tipo: "sem-etapas" };
  }

  if (hoje < cronograma.inicio) {
    return {
      tipo: "nao-comecou",
      diasAteInicio: diferencaEmDias(cronograma.inicio, hoje),
      dataInicio: cronograma.inicio,
    };
  }

  if (hoje > cronograma.dataDeConclusao) {
    // `status` só pode ser "em_producao" ou "rascunho" aqui (cancelada/concluida já
    // devolveram acima) — os dois seguem a mesma lógica de data (D-05/03-CONTEXT.md):
    // rascunho é só um aviso a mais na interface, não muda o cálculo.
    return {
      tipo: "atrasada",
      dataPrevista: cronograma.dataDeConclusao,
      diasDeAtraso: diferencaEmDias(hoje, cronograma.dataDeConclusao),
    };
  }

  const faixasDesenhadas = cronograma.faixas.filter((faixa) => faixa.desenhada);

  for (let indice = 0; indice < faixasDesenhadas.length; indice++) {
    const faixa = faixasDesenhadas[indice];

    if (hoje < faixa.inicio || hoje >= faixa.fimExclusivo) {
      continue;
    }

    // Fronteira exata entre duas etapas: a que COMEÇA naquele dia é encontrada primeiro pela
    // ordem do laço (a anterior falha `hoje < faixa.fimExclusivo`, que é exclusivo).
    const eUltimaEtapaDesenhada = indice === faixasDesenhadas.length - 1;

    if (eUltimaEtapaDesenhada) {
      return {
        tipo: "ultima-etapa",
        etapa: faixa.etapa,
        diasAteEntrega: diferencaEmDias(cronograma.dataDeConclusao, hoje),
      };
    }

    if (faixa.marco) {
      return { tipo: "em-etapa-marco", etapa: faixa.etapa };
    }

    const proxima = faixasDesenhadas[indice + 1];
    return {
      tipo: "em-etapa-intervalo",
      etapa: faixa.etapa,
      proximaEtapa: proxima.etapa,
      diasAteProxima: diferencaEmDias(faixa.fimExclusivo, hoje),
    };
  }

  // Inalcançável em uso normal: `hoje` já está entre `cronograma.inicio` (não antes) e
  // `cronograma.dataDeConclusao` (não depois), então alguma faixa desenhada precisa contê-lo.
  // Lançar em vez de devolver um valor arbitrário é a mesma disciplina do resto do módulo:
  // nunca coagir em silêncio um estado que a função não sabe explicar.
  throw new RangeError(
    `situacaoEm: nenhuma etapa desenhada contém "${hoje}", apesar de estar dentro do ` +
      "intervalo do cronograma — dado inconsistente.",
  );
}
