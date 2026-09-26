// Módulo puro — mesmo molde de `lib/financeiro/formato.ts`: zero import, nenhuma leitura do
// relógio. Este é o formato que o cliente vê no PDF (D-05) e o mesmo em toda tela — lista,
// cabeçalho do editor, diálogos, documento do cliente.

// "ORC-2026-001" — prefixo fixo, ano com quatro dígitos, sequencial com NO MÍNIMO três dígitos
// (`padStart` nunca trunca: o milésimo orçamento de um ano sai "ORC-2026-1000", não
// "ORC-2026-100").
export function numeroDeOrcamento(ano: number, sequencial: number): string {
  return `ORC-${ano}-${String(sequencial).padStart(3, "0")}`;
}

// " · revisão 2" ao lado do número — só quando a revisão é maior que 1 (a primeira revisão de
// todo orçamento não precisa dizer "revisão 1", é o estado padrão).
export function rotuloDeRevisao(revisao: number): string {
  return revisao > 1 ? ` · revisão ${revisao}` : "";
}
