// Módulo puro (D-14): SÓ `import type` é permitido aqui — nenhuma leitura do relógio, nenhum
// React, nenhum cliente de banco. "hoje" entra por argumento, como toda regra de negócio deste
// projeto.
//
// 🔴 Expirado NÃO EXISTE no banco (D-22) — é uma função de "hoje", nunca um status gravado.
// Gravar esse status criaria a necessidade de um processo que roda todo dia só para mudar uma
// linha quando o relógio vira: exatamente o tipo de trabalho agendado que o projeto decidiu não
// ter (nenhum worker/cron além do backup). `situacaoDoOrcamento` é a ÚNICA função que decide o
// chip (key_link do plano) — lista, editor e, mais adiante, o documento do cliente leem dela.
import type { orcamentos, statusOrdem } from "@/db/schema";

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

// ---------------------------------------------------------------------------------------------
// O veredito da aprovação (04.5-14, achado 14 da verificação humana).
//
// O bloco do orçamento aprovado afirmava "e ordem aberta na Produção" sempre que
// `orcamentos.encomenda_id` não era nulo — um booleano chamado `ordemAberta` que respondia
// "o id existe?", nunca "a ordem está aberta?". Cancelada a encomenda, o orçamento seguia em
// verde anunciando uma ordem que a Produção já tinha mandado para o histórico.
//
// A decisão vive aqui, em módulo puro, e não dentro do componente: é regra de negócio ("o que
// este orçamento ainda pode afirmar?"), não desenho de tela. O componente só escolhe as classes
// a partir da `semantica`, como o chip já faz com `situacaoDoOrcamento`.

// Exportado: o status da ordem atravessa consulta → barra de ações → veredito, e repetir a
// expressão `(typeof statusOrdem.enumValues)[number]` em cada camada é como duas verdades nascem.
// `import type` em toda parte — nada de `@/db/schema` no pacote do cliente. Fase 06.1 (plano 03,
// Pitfall 14): é o status da ORDEM DE PRODUÇÃO (`ordens_producao.status`), para onde
// `orcamentos.encomenda_id` aponta desde a migração 0024.
export type StatusOrdem = (typeof statusOrdem.enumValues)[number];

export type VereditoDaAprovacao = {
  // Só verdadeiro enquanto a ordem existir E estiver aguardando o sinal ou liberada (ativa) — é o
  // que a frase do veredito tem o direito de afirmar.
  ordemAberta: boolean;
  // A ordem foi cancelada na Produção: o orçamento continua aprovado, mas ganha a linha de
  // aviso. Concluída NÃO é isto — uma ordem concluída é um fim feliz, só não é mais "aberta".
  ordemCancelada: boolean;
  // "sucesso" só enquanto nada do que o veredito afirma foi desfeito. Venda cancelada OU ordem
  // cancelada rebaixam o bloco para "atencao": um bloco verde afirmando uma coisa com um aviso
  // desmentindo logo abaixo é o defeito, não a solução.
  semantica: "sucesso" | "atencao";
};

export function vereditoDaAprovacao(entrada: {
  encomendaId: string | null;
  // `null` quando não há ordem vinculada. Com `encomenda_id` preenchido o status sempre existe (a
  // chave estrangeira não permite apagar a ordem referenciada); um `null` aqui é tratado como "não
  // dá para afirmar que está aberta" — nunca como "está".
  encomendaStatus: StatusOrdem | null;
  vendaCancelada: boolean;
}): VereditoDaAprovacao {
  const temOrdem = entrada.encomendaId !== null;
  const ordemCancelada = temOrdem && entrada.encomendaStatus === "cancelada";
  const ordemAberta =
    temOrdem &&
    (entrada.encomendaStatus === "aguardando_sinal" || entrada.encomendaStatus === "ativa");

  return {
    ordemAberta,
    ordemCancelada,
    semantica: entrada.vendaCancelada || ordemCancelada ? "atencao" : "sucesso",
  };
}
