// Módulo puro (D-14): zero import de valor (só `import type`, se algum dia precisar) — nenhuma
// leitura do relógio, nenhum React, nenhum cliente de banco. "hoje" e "entregaPrevista" SEMPRE
// entram por argumento, nunca lidos de dentro.
//
// `parcelasDoPlano` é a ÚNICA função que decide a FORMA das parcelas de um orçamento (key_links
// do 04.5-07-PLAN.md): a tela usa para desenhar "Total e pagamento", o documento do cliente
// (plano 11) para escrever as parcelas no PDF, e a aprovação (plano 12) para criar as parcelas DE
// VERDADE na parte 1 (`lib/financeiro/parcelas.ts`) — três usos, uma regra. Mudar a forma do
// sinal em um lugar só é impossível por construção.
//
// Redeclara localmente a aritmética de calendário civil (D-15 do projeto: cada módulo puro tem a
// própria cópia, nunca um import cruzado entre `lib/orcamentos` e `lib/financeiro`/
// `lib/abertura` — mesmo algoritmo de Howard Hinnant, "days_from_civil"/"civil_from_days", já
// usado por `lib/financeiro/calendario.ts` e `lib/abertura/parcelas.ts`).
//
// Regra de arredondamento, dita aqui porque DIVERGE do prefixo telescópico de
// `lib/abertura/parcelas.ts`: no 3x, DIVISÃO INTEIRA com o resto na PRIMEIRA parcela (mesma regra
// Nx de `lib/financeiro/parcelas.ts::gerarPlano`); no sinal, o sinal é
// `Math.round(total × percentual / 100)` e o saldo é `total − sinal`. Em ambos, a soma fecha POR
// CONSTRUÇÃO (o resto/saldo absorve o que sobra), nunca por conferência a posteriori.

function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

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
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(
    diasDesdeAEpoca(ano, mes, dia) + dias,
  );
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// Os três planos do protótipo (`telaEditor`, select "Como o cliente paga") — a MESMA lista de
// valores do enum `plano_pagamento_orcamento` do banco (`db/schema.ts`, migração 0017). Exportado
// como valor (não só tipo): `lib/orcamentos/esquemas.ts` valida contra esta lista, uma fonte só.
export const PLANOS_DE_PAGAMENTO_DO_ORCAMENTO = ["sinal", "avista", "3x"] as const;
export type PlanoDePagamentoDoOrcamento = (typeof PLANOS_DE_PAGAMENTO_DO_ORCAMENTO)[number];

export type ParcelaDoPlano = {
  rotulo: string;
  valorCentavos: number;
  // Dia civil `YYYY-MM-DD` — nunca um instante (as parcelas do orçamento não têm hora).
  vencimento: string;
};

export type EntradaDoPlanoDePagamento = {
  plano: PlanoDePagamentoDoOrcamento;
  // Só faz sentido quando `plano === "sinal"` — ignorado nos outros dois.
  sinalPercentual: number;
  totalCentavos: number;
  hoje: string;
  entregaPrevista: string;
};

const ROTULOS_3X = [
  "1ª parcela, na aprovação",
  "2ª parcela, em 30 dias",
  "3ª parcela, em 60 dias",
] as const;
const DIAS_3X = [0, 30, 60] as const;

// Devolve SEMPRE as parcelas — nunca um `{ok:false}` de recusa (ao contrário de
// `lib/financeiro/parcelas.ts::gerarPlano`): aqui é só EXIBIÇÃO do que o orçamento vale hoje,
// nunca uma parcela de verdade sendo criada. A recusa de valor pequeno demais, se um dia existir,
// é decisão da aprovação (plano 12), que cria as parcelas de VERDADE reaproveitando esta MESMA
// função para a forma, e `conferirParcelas` (parte 1) para a conferência.
export function parcelasDoPlano({
  plano,
  sinalPercentual,
  totalCentavos,
  hoje,
  entregaPrevista,
}: EntradaDoPlanoDePagamento): ParcelaDoPlano[] {
  if (plano === "avista") {
    return [{ rotulo: "À vista, na aprovação", valorCentavos: totalCentavos, vencimento: hoje }];
  }

  if (plano === "sinal") {
    const sinalCentavos = Math.round((totalCentavos * sinalPercentual) / 100);
    const saldoCentavos = totalCentavos - sinalCentavos;
    return [
      { rotulo: `Sinal de ${sinalPercentual}%, na aprovação`, valorCentavos: sinalCentavos, vencimento: hoje },
      { rotulo: "Saldo, na entrega", valorCentavos: saldoCentavos, vencimento: entregaPrevista },
    ];
  }

  // 3x: divisão inteira, resto na PRIMEIRA parcela (nunca telescópico aqui — comentário no topo).
  const base = Math.floor(totalCentavos / 3);
  const resto = totalCentavos - base * 3;
  return ROTULOS_3X.map((rotulo, indice) => ({
    rotulo,
    valorCentavos: indice === 0 ? base + resto : base,
    vencimento: somarDias(hoje, DIAS_3X[indice]),
  }));
}
