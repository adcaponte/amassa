// Módulo puro (sem import, nenhuma instância de `Date`): a aritmética de calendário civil que o
// plano de pagamento (lib/financeiro/parcelas.ts) precisa — mesmo algoritmo de
// `lib/abertura/parcelas.ts` (Howard Hinnant, "days_from_civil"/"civil_from_days"), redeclarado
// aqui pela mesma disciplina de D-15 do projeto: cada módulo tem sua própria cópia, nunca um
// import cruzado entre `lib/financeiro` e `lib/abertura`.
//
// 04.4-06-PLAN.md, Tarefa 1.

// Dias desde 1970-01-01 (proléptico gregoriano), a partir de ano/mês/dia civis.
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

// Inverso de `diasDesdeAEpoca`.
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

// Soma `dias` dias de calendário (pode ser negativo) a uma data civil `YYYY-MM-DD`.
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const diasDesdeEpocaDaEntrada = diasDesdeAEpoca(ano, mes, dia);
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(
    diasDesdeEpocaDaEntrada + dias,
  );
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// Último dia do mês (28/29/30/31) — ano bissexto pela regra completa: divisível por 4, exceto
// século não divisível por 400 (2000 é bissexto, 1900 e 2100 não são).
export function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return bissexto ? 29 : 28;
  }
  if (mes === 4 || mes === 6 || mes === 9 || mes === 11) {
    return 30;
  }
  return 31;
}

// Soma `meses` meses inteiros a uma data civil `YYYY-MM-DD` — parcela cujo dia não existe no mês
// de destino cai no ÚLTIMO DIA daquele mês (31/01 → 28/02 → 31/03 → 30/04), sempre contada a
// partir da data ORIGINAL (índice absoluto de mês, `ano*12 + (mes-1)`), nunca encadeando a partir
// da parcela anterior — é o que faz a terceira parcela voltar para 31/03 em vez de ficar presa em
// 28/03 (mesma regra de `lib/abertura/parcelas.ts`, D-19).
export function somarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const indiceAbsoluto = ano * 12 + (mes - 1) + meses;
  const anoSaida = Math.floor(indiceAbsoluto / 12);
  const mesSaida = indiceAbsoluto - anoSaida * 12 + 1;
  const ultimoDia = ultimoDiaDoMes(anoSaida, mesSaida);
  const diaSaida = Math.min(dia, ultimoDia);
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// "2026-12-01" a partir da chave "2026-12" — o primeiro dia civil do mês.
export function primeiroDiaDoMes(chave: string): string {
  return `${chave}-01`;
}

// A chave do mês seguinte ("YYYY-MM"), com virada de ano — nunca somando 1 ao número do mês sem
// tratar dezembro (dezembro + 1 = janeiro do ano seguinte, não "mês 13").
export function mesSeguinte(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  const indiceAbsoluto = ano * 12 + (mes - 1) + 1;
  const anoSaida = Math.floor(indiceAbsoluto / 12);
  const mesSaida = indiceAbsoluto - anoSaida * 12 + 1;
  return `${String(anoSaida).padStart(4, "0")}-${String(mesSaida).padStart(2, "0")}`;
}

// A chave do mês anterior ("YYYY-MM"), com virada de ano no outro sentido (janeiro − 1 = dezembro
// do ano anterior).
export function mesAnterior(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  const indiceAbsoluto = ano * 12 + (mes - 1) - 1;
  const anoSaida = Math.floor(indiceAbsoluto / 12);
  const mesSaida = indiceAbsoluto - anoSaida * 12 + 1;
  return `${String(anoSaida).padStart(4, "0")}-${String(mesSaida).padStart(2, "0")}`;
}
