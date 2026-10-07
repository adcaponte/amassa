// Módulo puro, sem nenhum import: resolve o aviso pós-navegação a partir da query string
// (`?aviso=lancado&documento=<id>`, `?aviso=cancelado&documento=<id>`, `?aviso=pago&parcela=<id>`,
// `?aviso=desfeito&parcela=<id>`) — o servidor lê isto e monta o texto pronto (`textos.ts`), nunca
// o cliente. O identificador é validado por expressão regular (não Zod — módulo sem dependência),
// a mesma forma de UUID usada em outros módulos do projeto.
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// `?aviso=contas-geradas` (06.5-12): a mesma validação de `lib/cadastros/avisos.ts`, redeclarada
// (este módulo não importa nada) — inteiro de 0 a 500 e um mês `YYYY-MM` que existe. Inválido =
// sem aviso (T-06.5-30); o texto é montado pelo servidor, nunca refletido da URL.
const REGEX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const QUANTIDADE_MAXIMA_DE_CONTAS = 500;

export type AvisoDaUrl =
  | { tipo: "lancado"; documentoId: string }
  // A correção lançada (06.5-17, UI-D9): `documentoId` é a NOVA; o número da original vem do vínculo no
  // banco (`obterCorrecaoParaAviso`), nunca da URL.
  | { tipo: "corrigido"; documentoId: string }
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
  | { tipo: "orcamento-aprovado" }
  // "Gerar as contas de {mês}" pelo aviso do Caixa (06.5-12, UI-D8): quantas a ação criou e de que
  // mês — o toast é `textoContasGeradas`, o mesmo dos Cadastros.
  | { tipo: "contas-geradas"; quantidade: number; mes: string; mantidas: number };

export function avisoDaUrl(parametros: {
  aviso?: string | null;
  documento?: string | null;
  parcela?: string | null;
  quantidade?: string | null;
  // Não é `?mes=`: essa chave já escolhe o mês do extrato nesta página.
  mesGerado?: string | null;
  mantidas?: string | null;
}): AvisoDaUrl | null {
  if (parametros.aviso === "contas-geradas") {
    const quantidadeTexto = parametros.quantidade;
    if (!quantidadeTexto || !/^\d+$/.test(quantidadeTexto)) {
      return null;
    }
    const quantidade = Number(quantidadeTexto);
    if (quantidade > QUANTIDADE_MAXIMA_DE_CONTAS) {
      return null;
    }
    const mes = parametros.mesGerado;
    if (!mes || !REGEX_MES.test(mes)) {
      return null;
    }
    // 06.5-WR-03 (quick 261007-shs): quantas canceladas no mês continuaram canceladas; ausente = 0.
    let mantidas = 0;
    if (parametros.mantidas !== undefined && parametros.mantidas !== null) {
      if (!/^\d+$/.test(parametros.mantidas)) {
        return null;
      }
      mantidas = Number(parametros.mantidas);
      if (mantidas > QUANTIDADE_MAXIMA_DE_CONTAS) {
        return null;
      }
    }
    return { tipo: "contas-geradas", quantidade, mes, mantidas };
  }

  if (parametros.aviso === "lancado" || parametros.aviso === "cancelado" || parametros.aviso === "corrigido") {
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
