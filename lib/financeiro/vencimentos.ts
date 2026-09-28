// Módulo puro, só `import type` — a janela de sete dias mora AQUI, no Financeiro (GES-09),
// porque é o Financeiro que possui a noção de vencimento; o Início só chama, nunca reimplementa
// a regra. `hoje` entra sempre por argumento: `contasQueVencem` não lê o relógio, e chamar duas
// vezes com o mesmo argumento devolve o mesmo resultado.
//
// Comparação por DIAS INTEIROS desde a época civil (mesmo algoritmo — Howard Hinnant,
// "days_from_civil" — de `lib/encomendas/cronograma.ts`/`gantt.ts`/`trilha.ts`, duplicado aqui
// porque este é outro módulo puro sem import de valor: dois módulos sem import não podem
// compartilhar função nenhuma) — nenhuma instância global de data entra nesta conta em nenhum
// momento. Isto é mais robusto do que comparar strings ISO deslocadas manualmente: incrementar
// "hoje + 7 dias" por texto cruzando virada de mês/ano exigiria reimplementar o mesmo
// calendário — comparar pela DIFERENÇA em dias já resolve isso de uma vez, sem montar uma
// segunda data.
import type { ContaEmAberto } from "./consultas";

// D-05: o bloco "O que vence" olha sete dias à frente, como o protótipo.
export const DIAS_DE_HORIZONTE = 7;

export type JanelaDeVencimento = {
  vencidas: readonly ContaEmAberto[];
  aVencer: readonly ContaEmAberto[];
};

const FORMATO_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra = anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

// `dataMaisTarde` menos `dataMaisCedo`, em dias inteiros — negativo quando `dataMaisTarde` é
// ANTES de `dataMaisCedo`.
function diferencaEmDias(dataMaisTarde: string, dataMaisCedo: string): number {
  const [anoA, mesA, diaA] = dataMaisTarde.split("-").map(Number);
  const [anoB, mesB, diaB] = dataMaisCedo.split("-").map(Number);
  return diasDesdeAEpoca(anoA, mesA, diaA) - diasDesdeAEpoca(anoB, mesB, diaB);
}

// `{ vencidas, aVencer }`, preservando em cada grupo a ordem de entrada (que já vem ordenada do
// módulo por `listarContasEmAberto` — vencimento e, no empate, número do documento) — esta
// função NUNCA reordena. Vencida = vencimento ANTES de hoje; vence hoje ou nos próximos
// `DIAS_DE_HORIZONTE` dias = aVencer; o que passa de `DIAS_DE_HORIZONTE` fica de fora dos dois
// grupos (GES-07, aresta `boundary`).
export function contasQueVencem(
  contas: readonly ContaEmAberto[],
  hoje: string,
): JanelaDeVencimento {
  const vencidas: ContaEmAberto[] = [];
  const aVencer: ContaEmAberto[] = [];

  for (const conta of contas) {
    // Vencimento em formato inesperado é descartado, nunca posicionado por acaso num dos dois
    // grupos por um cálculo de dias que partiu de um valor que não é uma data civil de verdade.
    if (!FORMATO_DATA_CIVIL.test(conta.vencimento)) {
      continue;
    }

    const diasAteVencimento = diferencaEmDias(conta.vencimento, hoje);

    if (diasAteVencimento < 0) {
      vencidas.push(conta);
    } else if (diasAteVencimento <= DIAS_DE_HORIZONTE) {
      aVencer.push(conta);
    }
  }

  return { vencidas, aVencer };
}
