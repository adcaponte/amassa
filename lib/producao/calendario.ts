// Módulo puro da Produção (Fase 06.1) — a aritmética de datas civis. Zero imports: nenhuma linha
// alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano 06.1-01), e "hoje" nunca é
// lido do relógio por dentro — quem precisa dele o recebe como argumento.
//
// CÓPIA PRÓPRIA da aritmética civil de `lib/encomendas/cronograma.ts` (algoritmo de Howard Hinnant,
// "days_from_civil" / "civil_from_days"), feita antes de o plano 06.1-14 apagar aquela pasta. Datas
// trafegam como string `YYYY-MM-DD` do começo ao fim; a conta interna é puro inteiro (dias desde
// 1970-01-01, proléptico gregoriano). Nenhuma instância de `Date` entra na conta — é onde o fuso do
// runtime poderia deslocar o dia.

const FORMATO_DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

// Dias desde 1970-01-01 a partir de ano/mês/dia civis ("days_from_civil").
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra = anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

// Inverso ("civil_from_days").
function civilDesdeDias(dias: number): { ano: number; mes: number; dia: number } {
  const z = dias + 719468;
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
  const diaDoAno =
    diaDoEra - (365 * anoDoEra + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100));
  const mesProvisorio = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mesProvisorio + 2) / 5) + 1;
  const mes = mesProvisorio + (mesProvisorio < 10 ? 3 : -9);
  const ano = mes <= 2 ? anoAjustado + 1 : anoAjustado;
  return { ano, mes, dia };
}

function partes(data: string): { ano: number; mes: number; dia: number } {
  const casamento = FORMATO_DATA_CIVIL.exec(data);
  if (!casamento) {
    throw new RangeError(`Data civil inválida (esperado AAAA-MM-DD): ${data}`);
  }
  return { ano: Number(casamento[1]), mes: Number(casamento[2]), dia: Number(casamento[3]) };
}

function paraDias(data: string): number {
  const { ano, mes, dia } = partes(data);
  return diasDesdeAEpoca(ano, mes, dia);
}

// Verdadeiro para uma data civil que existe de verdade no calendário (`2026-02-29` é falso,
// `2028-02-29` é verdadeiro) — a ida e volta pelo número de dias não pode mudar a data.
export function ehDataCivil(data: string): boolean {
  const casamento = FORMATO_DATA_CIVIL.exec(data);
  if (!casamento) {
    return false;
  }
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return false;
  }
  const volta = civilDesdeDias(diasDesdeAEpoca(ano, mes, dia));
  return volta.ano === ano && volta.mes === mes && volta.dia === dia;
}

// Quantos dias de calendário vão de `de` até `ate` (`ate − de`; negativo se `ate` vem antes).
export function diasEntre(de: string, ate: string): number {
  return paraDias(ate) - paraDias(de);
}

// `data` + `dias` dias de calendário (pode ser negativo), de volta como `YYYY-MM-DD`.
export function somarDias(data: string, dias: number): string {
  const { ano, mes, dia } = civilDesdeDias(paraDias(data) + dias);
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// "05/03" — dia e mês de uma data civil, sem passar por `Date` (a tela da Produção mostra só dd/mm).
export function formatarDiaMes(data: string): string {
  const { mes, dia } = partes(data);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}
