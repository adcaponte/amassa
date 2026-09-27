// Módulo puro, sem nenhum import: resolve o aviso pós-navegação a partir da query string
// (`?aviso=lancado&documento=<id>`, `?aviso=cancelado&documento=<id>`, `?aviso=pago&parcela=<id>`,
// `?aviso=desfeito&parcela=<id>`) — o servidor lê isto e monta o texto pronto (`textos.ts`), nunca
// o cliente. O identificador é validado por expressão regular (não Zod — módulo sem dependência),
// a mesma forma de UUID usada em outros módulos do projeto.
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AvisoDaUrl =
  | { tipo: "lancado"; documentoId: string }
  | { tipo: "cancelado"; documentoId: string }
  | { tipo: "pago"; parcelaId: string }
  | { tipo: "desfeito"; parcelaId: string }
  // "Peça salva." (04.5-04-PLAN.md) — toast fixo, sem identificador nenhum: a peça em si já
  // aparece na URL por `?peca=<id>` (o parâmetro que reabre o diálogo em modo edição), um
  // propósito diferente do aviso.
  | { tipo: "peca-salva" }
  // O ciclo de vida do orçamento (04.5-08-PLAN.md) — nenhum dos quatro precisa de identificador
  // PRÓPRIO no aviso: o orçamento em si já está em `?orcamento=<id>` (o mesmo parâmetro que abre o
  // editor), inclusive depois de "Duplicar" (que navega para o NOVO id).
  | { tipo: "orcamento-enviado" }
  | { tipo: "orcamento-reaberto" }
  | { tipo: "orcamento-recusado" }
  | { tipo: "orcamento-duplicado" }
  // "Atualizar preços" (04.5-09-PLAN.md, D-23) — mesma disciplina: o orçamento já está em
  // `?orcamento=<id>`, o número da revisão nova vem do PRÓPRIO `orcamentoParaEditar` recarregado
  // (nunca da URL), porque a ação já gravou o valor novo antes da navegação completa.
  | { tipo: "orcamento-atualizado" }
  | { tipo: "orcamento-revisao-criada" }
  // "Cliente aprovou" (04.5-12-PLAN.md, D-25) — mesma disciplina das quatro transições acima:
  // nenhum identificador próprio no aviso. O número da venda e se a ordem foi aberta vêm do
  // PRÓPRIO `orcamentoParaEditar` recarregado (`documentoNumero`/`encomendaId`, já gravados pela
  // transação antes da navegação completa) — nunca da URL, que o cliente poderia forjar.
  | { tipo: "orcamento-aprovado" };

export function avisoDaUrl(parametros: {
  aviso?: string | null;
  documento?: string | null;
  parcela?: string | null;
}): AvisoDaUrl | null {
  if (parametros.aviso === "lancado" || parametros.aviso === "cancelado") {
    const documentoId = parametros.documento;
    if (!documentoId || !REGEX_UUID.test(documentoId)) {
      return null;
    }
    return { tipo: parametros.aviso, documentoId };
  }

  if (parametros.aviso === "pago" || parametros.aviso === "desfeito") {
    const parcelaId = parametros.parcela;
    if (!parcelaId || !REGEX_UUID.test(parcelaId)) {
      return null;
    }
    return { tipo: parametros.aviso, parcelaId };
  }

  if (parametros.aviso === "peca-salva") {
    return { tipo: "peca-salva" };
  }

  if (
    parametros.aviso === "orcamento-enviado" ||
    parametros.aviso === "orcamento-reaberto" ||
    parametros.aviso === "orcamento-recusado" ||
    parametros.aviso === "orcamento-duplicado" ||
    parametros.aviso === "orcamento-atualizado" ||
    parametros.aviso === "orcamento-revisao-criada" ||
    parametros.aviso === "orcamento-aprovado"
  ) {
    return { tipo: parametros.aviso };
  }

  return null;
}
