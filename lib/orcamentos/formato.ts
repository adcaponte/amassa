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

// "0,2" a partir de 200 milésimos de fornada (escala 1000, mesma de `horasMilesimos`/
// `fornadasBiscoitoMilesimos`/`fornadasEsmalteMilesimos` em `lib/orcamentos/contas.ts`) — até 1
// casa decimal, a mesma precisão do protótipo (`n1`) para "Ocupa do forno" no painel "Só para
// você". Redeclarado aqui (D-15): não é o mesmo formato de `lib/precificacao/formato.ts::
// formatarHoras` (até 3 casas) porque "fornada" é um conceito agregado do ORÇAMENTO, não da
// ficha.
export function formatarFornadas(milesimos: number): string {
  // `minimumFractionDigits: 1` junto com o máximo (achado da verificação do Cowork em produção,
  // 27/09/2026): sem ele, a frase saía "0 fornada(s) de biscoito · 0,1 de esmalte" — duas
  // precisões na mesma linha. O `n1` do protótipo sempre mostra a casa decimal, mesmo zero, e é
  // o que `formatarPercentualDeVariacao`, logo abaixo, já fazia.
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(milesimos / 1000);
}

// "10,0" / "9,4" a partir de um percentual já com uma casa decimal (lib/orcamentos/atualizacao.ts
// ::SugestaoDePreco.percentualAbsoluto) — usado pelas etiquetas "subiu X%"/"caiu X%" do diálogo
// "Atualizar preços" (D-23). `minimumFractionDigits: 1` garante "10,0", nunca "10" — o protótipo
// (`n1`) sempre mostra a casa decimal, mesmo quando ela é zero.
export function formatarPercentualDeVariacao(percentual: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(percentual);
}
