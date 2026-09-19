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
  | { tipo: "desfeito"; parcelaId: string };

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

  return null;
}
