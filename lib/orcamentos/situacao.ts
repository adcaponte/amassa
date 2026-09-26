// Módulo puro (D-14): SÓ `import type` é permitido aqui — nenhuma leitura do relógio, nenhum
// React, nenhum cliente de banco. "hoje" entra por argumento, como toda regra de negócio deste
// projeto.
//
// 🔴 Expirado NÃO EXISTE no banco (D-22) — é uma função de "hoje", nunca um status gravado.
// Gravar esse status criaria a necessidade de um processo que roda todo dia só para mudar uma
// linha quando o relógio vira: exatamente o tipo de trabalho agendado que o projeto decidiu não
// ter (nenhum worker/cron além do backup). `situacaoDoOrcamento` é a ÚNICA função que decide o
// chip (key_link do plano) — lista, editor e, mais adiante, o documento do cliente leem dela.
import type { orcamentos } from "@/db/schema";

type StatusOrcamento = (typeof orcamentos.status.enumValues)[number];

export type OrcamentoParaSituacao = {
  status: StatusOrcamento;
  // Data civil `YYYY-MM-DD` — a data em que o orçamento foi enviado (ou nasceu, enquanto
  // rascunho). Nunca um instante: comparar validade é aritmética de dias civis, não de fuso.
  data: string;
  validadeDias: number;
};

export type SituacaoDoOrcamento = {
  // As três semânticas já existentes do design system, mais a neutra do rascunho — nenhum token
  // novo (04.5-UI-SPEC.md §Color).
  semantica: "neutra" | "atencao" | "erro" | "sucesso";
  rotulo: string;
};

function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

function epocaDeDataCivil(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return diasDesdeAEpoca(ano, mes, dia);
}

// Dias entre "hoje" e o VENCIMENTO (data + validadeDias) — positivo ou zero enquanto ainda vale,
// negativo depois de vencido. Só aritmética de dias civis (subtração de inteiros): o mesmo par de
// datas devolve o mesmo número a qualquer hora do dia, porque nenhuma das duas datas carrega hora
// nenhuma (D-14/D-15: fuso é problema de quem lê o relógio, nunca deste módulo).
export function diasDeValidadeRestantes(
  dataDeEnvio: string,
  validadeDias: number,
  hoje: string,
): number {
  return epocaDeDataCivil(dataDeEnvio) + validadeDias - epocaDeDataCivil(hoje);
}

function rotuloEnviado(dias: number): string {
  return dias < 0 ? `expirou há ${-dias} dia(s)` : `enviado · vale mais ${dias} dia(s)`;
}

// A ÚNICA função que decide o chip (key_link do plano) — "hoje" entra por argumento, nunca lido
// de dentro. Expiração só vale para "enviado" (D-22); aprovado e recusado são finais e não
// dependem de validade nenhuma, mesmo que a validade já tenha vencido há muito tempo.
export function situacaoDoOrcamento(
  orcamento: OrcamentoParaSituacao,
  hoje: string,
): SituacaoDoOrcamento {
  if (orcamento.status === "rascunho") {
    return { semantica: "neutra", rotulo: "rascunho" };
  }
  if (orcamento.status === "aprovado") {
    return { semantica: "sucesso", rotulo: "aprovado" };
  }
  if (orcamento.status === "recusado") {
    return { semantica: "erro", rotulo: "recusado" };
  }

  // status === "enviado"
  const dias = diasDeValidadeRestantes(orcamento.data, orcamento.validadeDias, hoje);
  return dias < 0
    ? { semantica: "erro", rotulo: rotuloEnviado(dias) }
    : { semantica: "atencao", rotulo: rotuloEnviado(dias) };
}
