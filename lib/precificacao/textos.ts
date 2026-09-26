// As frases fixas e os rótulos do módulo de precificação (Parâmetros, e futuramente Peças/
// Orçamentos) — só `import type` é permitido aqui (nunca `import` de valor), no molde de
// `lib/financeiro/textos.ts`/`lib/cadastros/textos.ts`: o módulo não lê React, não lê o cliente
// do banco, e nunca importa `./formato` (a mesma regra cuja falta rendeu um bug real citado em
// `04.5-01-SUMMARY.md`, item de deviations).

export const TITULO_PARAMETROS = "Parâmetros do cálculo";

export const ROTULO_SELO_ESTIMADO = "estimado";
export const ROTULO_SELO_MEDIDO = "medido";

// "desde 18/12/26" — `dataFormatada` já vem pronta de quem chama (`formatarDataCurta`,
// lib/financeiro/formato.ts); este módulo nunca formata data sozinho.
export function rotuloDesde(dataFormatada: string): string {
  return `desde ${dataFormatada}`;
}

// "Calcular minha hora" (ORC-04) — CTA secundário da tela, dentro do grupo Trabalho.
export const ROTULO_CALCULAR_HORA = "Calcular minha hora";
export const TITULO_DIALOGO_CALCULAR_HORA = "Calcular minha hora";
export const DICA_CALCULAR_HORA =
  "A hora precisa pagar você e a parte da casa que a produção de peças deve sustentar. Cafeteria, loja e espaço pagam o resto.";
export const ROTULO_RETIRADA_DESEJADA = "Quanto quero tirar por mês da produção (R$)";
export const ROTULO_PARTE_DA_CASA = "Parte dos custos da casa que a produção paga (R$/mês)";
export const ROTULO_HORAS_POR_MES = "Horas por mês realmente fazendo peça";
export const ROTULO_SUA_HORA = "Sua hora";
export const DICA_REFERENCIA_HORA =
  "Referências da pesquisa de agosto/2026: R$ 25–35 é o piso defensável para autônomo; trabalho autoral pede R$ 60–100. Horas de aula, atendimento e administração não entram na conta.";
export const FRASE_INFORME_AS_HORAS = "Informe as horas.";
export const ROTULO_USAR_ESTA_HORA = "Usar esta hora";
export const ROTULO_CANCELAR = "Cancelar";
export const TOAST_HORA_ATUALIZADA = "Hora atualizada.";

// A taxa do cartão aparece como LEITURA nesta tela (D-16) — nunca um segundo campo editável.
export const TITULO_TAXA_LEITURA = "Taxa do cartão";
export const DICA_TAXA_LEITURA = "Vale para todo cálculo. Para mudar, vá em Cadastros → Taxas.";

// "Como o preço é montado" — bloco fixo, cinco linhas do protótipo, verbatim.
export const TITULO_COMO_O_PRECO_E_MONTADO = "Como o preço é montado";
export const LINHAS_COMO_O_PRECO_E_MONTADO: readonly { titulo: string; descricao: string }[] = [
  { titulo: "1 · Material", descricao: "argila + esmalte" },
  { titulo: "2 · Trabalho", descricao: "horas × sua hora" },
  { titulo: "3 · Queimas", descricao: "fornada ÷ peças que cabem, pelas medidas" },
  { titulo: "4 · Perda", descricao: "÷ (1 − perda)" },
  { titulo: "5 · Preço mínimo", descricao: "÷ (1 − lucro − folga − imposto − taxa)" },
];
export const DICA_PERCENTUAL_DIVIDE =
  "Tudo que é porcentagem do preço entra dividindo, não somando — é a fórmula do Sebrae. Assim 15% de lucro são 15% do preço, não do custo.";
export const DICA_ESTIMADO_MEDIDO =
  "Estimado × medido. Toque no selo quando trocar um número chutado por um número seu: conta de luz, peças contadas na fornada, tempo cronometrado. O orçamento avisa enquanto houver estimados.";
export const DICA_TAXA_E_QUANTAS_CABEM =
  "A taxa do cartão é a mesma do Financeiro. Quantas cabem sai das medidas da peça e do forno: peças por prateleira × níveis, com folga no esmalte e um fator a mais no biscoito.";

// O aviso do divisor que não fecha (D-11) — no lugar de qualquer preço, nunca um número grande.
export const FRASE_DIVISOR_INVALIDO =
  "Os parâmetros de preço não fazem sentido juntos (lucro + folga + imposto + taxa + comissão passam de 100%). Ajuste um deles em Parâmetros antes de calcular.";

export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar os parâmetros. Verifique a internet e tente de novo.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";
export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";
export const FRASE_PARAMETRO_NAO_EXISTE_MAIS =
  "Esse parâmetro não existe mais. Recarregue a página e tente de novo.";
