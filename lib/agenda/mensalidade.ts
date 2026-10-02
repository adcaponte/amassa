// Módulo puro da Agenda — a conta da mensalidade (AGE-07, AGE-16, AGE-20, D-07). Só importa o teto de
// `lib/financeiro/dinheiro.ts` (puro, zero imports); nenhuma linha alcança React, Next, drizzle-orm, pg
// ou `@/db`, e nenhuma lê o relógio — "hoje" e as datas chegam por argumento, já em datas civis
// `YYYY-MM-DD`.
//
// Dinheiro em CENTAVOS INTEIROS do começo ao fim (AGE-20 · precision): a divisão do proporcional e do
// valor da aula é feita por `arredondarMeioParaCima`, que só soma, multiplica e usa `Math.floor` sobre
// inteiros — nenhum ponto flutuante chega ao valor final. Entrada fora da faixa é erro de dado
// (`RangeError`), nunca um valor "corrigido" em silêncio.
import { TETO_CENTAVOS } from "@/lib/financeiro/dinheiro";

const DATA_CIVIL = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const CHAVE_DO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// O dia de vencimento da turma vai até 28 (check `turmas_dia_vencimento_faixa`): todo mês tem esse
// dia, então o vencimento nunca escorrega para o mês seguinte nem para o último dia.
export const DIA_DE_VENCIMENTO_MAXIMO = 28;

function conferirDataCivil(data: string): void {
  if (typeof data !== "string" || !DATA_CIVIL.test(data)) {
    throw new RangeError(`Data civil inválida (esperado AAAA-MM-DD): ${String(data)}`);
  }
}

function conferirCentavos(valor: number, minimo: number): void {
  if (!Number.isInteger(valor) || valor < minimo || valor > TETO_CENTAVOS) {
    throw new RangeError(`Valor em centavos fora da faixa (${minimo}..${TETO_CENTAVOS}): ${valor}`);
  }
}

// `numerador ÷ denominador` arredondado ao inteiro mais próximo, com o meio para cima (2,5 → 3), em
// aritmética inteira: floor((2n + d) / 2d). Os dois têm de ser inteiros, `numerador ≥ 0` e
// `denominador > 0` — a divisão por zero nunca acontece aqui (quem chama trata o "zero aulas" antes).
export function arredondarMeioParaCima(numerador: number, denominador: number): number {
  if (!Number.isInteger(numerador) || numerador < 0) {
    throw new RangeError(`Numerador inválido (inteiro ≥ 0): ${numerador}`);
  }
  if (!Number.isInteger(denominador) || denominador <= 0) {
    throw new RangeError(`Denominador inválido (inteiro > 0): ${denominador}`);
  }
  return Math.floor((2 * numerador + denominador) / (2 * denominador));
}

export type ValorDaEntrada =
  | { tipo: "cheia"; valorCentavos: number }
  | { tipo: "proporcional"; valorCentavos: number; restantes: number; noMes: number }
  | { tipo: "nenhuma" };

// A mensalidade do mês de quem ENTRA na turma (AGE-07 — proporcional, sempre: briefing §2.7).
// `datasDoMes` são as datas NÃO canceladas da turma no mês da entrada; `entrouEm` é o dia da entrada.
// - restantes = datas ≥ entrouEm (a aula do próprio dia conta, como no protótipo);
// - nenhuma data no mês, ou nenhuma restante → `nenhuma` (o proporcional daria R$ 0; a divisão por
//   zero nunca acontece);
// - todas restantes → `cheia`;
// - senão → `proporcional`: valor × restantes ÷ datas do mês, ao centavo, meio para cima. Um
//   proporcional que arredondaria a 0 centavo também é `nenhuma` (a mensalidade de R$ 0 não nasce —
//   check `mensalidades_valor_faixa`).
// Datas repetidas contam uma vez; a ordem não importa.
export function valorProporcional({
  valorCentavos,
  datasDoMes,
  entrouEm,
}: {
  valorCentavos: number;
  datasDoMes: readonly string[];
  entrouEm: string;
}): ValorDaEntrada {
  conferirCentavos(valorCentavos, 1);
  conferirDataCivil(entrouEm);
  for (const data of datasDoMes) {
    conferirDataCivil(data);
  }
  const datas = [...new Set(datasDoMes)];
  const noMes = datas.length;
  const restantes = datas.filter((data) => data >= entrouEm).length;
  if (noMes === 0 || restantes === 0) {
    return { tipo: "nenhuma" };
  }
  if (restantes === noMes) {
    return { tipo: "cheia", valorCentavos };
  }
  const proporcional = arredondarMeioParaCima(valorCentavos * restantes, noMes);
  if (proporcional === 0) {
    return { tipo: "nenhuma" };
  }
  return { tipo: "proporcional", valorCentavos: proporcional, restantes, noMes };
}

// D-07: o valor de UMA aula da turma = mensalidade ÷ aulas da turma no mês, ao centavo, meio para
// cima. Sem aula no mês → `null` (não há sugestão).
export function valorDaAula(mensalidadeCentavos: number, aulasNoMes: number): number | null {
  conferirCentavos(mensalidadeCentavos, 0);
  if (!Number.isInteger(aulasNoMes) || aulasNoMes < 0) {
    throw new RangeError(`Quantidade de aulas inválida (inteiro ≥ 0): ${aulasNoMes}`);
  }
  if (aulasNoMes === 0) {
    return null;
  }
  return arredondarMeioParaCima(mensalidadeCentavos, aulasNoMes);
}

// O vencimento da mensalidade: o dia de vencimento da turma (1..28) dentro do mês `mes` ("AAAA-MM").
export function vencimentoDaMensalidade(diaVencimento: number, mes: string): string {
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > DIA_DE_VENCIMENTO_MAXIMO) {
    throw new RangeError(`Dia de vencimento fora de 1..${DIA_DE_VENCIMENTO_MAXIMO}: ${diaVencimento}`);
  }
  if (typeof mes !== "string" || !CHAVE_DO_MES.test(mes)) {
    throw new RangeError(`Mês inválido (esperado AAAA-MM): ${String(mes)}`);
  }
  return `${mes}-${String(diaVencimento).padStart(2, "0")}`;
}

// A chave do mês ("AAAA-MM") de uma data civil.
export function mesDaData(data: string): string {
  conferirDataCivil(data);
  return data.slice(0, 7);
}
