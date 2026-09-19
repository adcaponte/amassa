// Módulo puro, sem nenhum import: resolve o aviso pós-navegação de Cadastros a partir da query
// string (`?aviso=categoria-desativada` / `?aviso=categoria-reativada`) — o servidor lê isto e
// monta o texto pronto (`textos.ts`), nunca o cliente. Mesmo molde de `lib/financeiro/avisos.ts`,
// mas os dois tipos conhecidos são outros (Cadastros nunca lança documento).
export type TipoDeAvisoDeCadastros = "categoria-desativada" | "categoria-reativada";

export type AvisoDeCadastros = { tipo: TipoDeAvisoDeCadastros };

const TIPOS_CONHECIDOS: readonly TipoDeAvisoDeCadastros[] = [
  "categoria-desativada",
  "categoria-reativada",
];

export function avisoDaUrl(aviso: string | null | undefined): AvisoDeCadastros | null {
  const encontrado = TIPOS_CONHECIDOS.find((tipo) => tipo === aviso);
  return encontrado ? { tipo: encontrado } : null;
}
