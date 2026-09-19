// Módulo puro, sem nenhum import: resolve o aviso pós-navegação a partir da query string
// (`?aviso=lancado&documento=<id>`) — o servidor lê isto e monta o texto pronto (`textos.ts`),
// nunca o cliente. O identificador é validado por expressão regular (não Zod — módulo sem
// dependência), a mesma forma de UUID usada em outros módulos do projeto.
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AvisoDaUrl = { tipo: "lancado"; documentoId: string };

export function avisoDaUrl(parametros: {
  aviso?: string | null;
  documento?: string | null;
  parcela?: string | null;
}): AvisoDaUrl | null {
  if (parametros.aviso !== "lancado") {
    return null;
  }
  const documentoId = parametros.documento;
  if (!documentoId || !REGEX_UUID.test(documentoId)) {
    return null;
  }
  return { tipo: "lancado", documentoId };
}
