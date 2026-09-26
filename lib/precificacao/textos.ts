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

// ---------------------------------------------------------------------------------------------
// Ficha de peça (04.5-04-PLAN.md — D-18/D-19, ORC-01/ORC-02/ORC-05/ORC-06)
// ---------------------------------------------------------------------------------------------

export const ROTULO_NOVA_PECA = "Nova peça";
export const TITULO_PECAS = "Peças";
export const TITULO_DIALOGO_FICHA_NOVA = "Peça nova";
export const TITULO_DIALOGO_FICHA_EDITAR = "Precificar peça";
export const ROTULO_SALVAR_FICHA = "Salvar";
export const TOAST_PECA_SALVA = "Peça salva.";

// Rótulos dos campos — ordem e texto herdados verbatim de `prototipo.html` (`CAMPOS`), mais o
// campo novo de categoria de venda (D-18, não existe no protótipo).
export const ROTULO_NOME_DA_PECA = "Nome da peça";
export const ROTULO_ARGILA = "Argila (g)";
export const ROTULO_ESMALTE = "Esmalte (g)";
export const ROTULO_HORAS_DE_TRABALHO = "Horas de trabalho, somando todas as etapas";
export const ROTULO_LARGURA = "Largura (cm), com alça ou bico";
export const ROTULO_PROFUNDIDADE = "Profundidade (cm)";
export const ROTULO_ALTURA = "Altura (cm)";
export const ROTULO_EMBALAGEM = "Embalagem e acessório (R$)";
export const ROTULO_PRECO_PRATICADO = "Preço que você pratica (R$)";
export const ROTULO_PRECO_MERCADO = "Preço de peça parecida no mercado (R$, opcional)";
export const ROTULO_CABEM_BISCOITO = "Já contei: cabem no biscoito (opcional)";
export const ROTULO_CABEM_ESMALTE = "Já contei: cabem no esmalte (opcional)";
export const ROTULO_CATEGORIA_DE_VENDA_FICHA = "Categoria de venda";
export const ROTULO_EXCLUSIVA =
  "Peça exclusiva deste pedido — não entra na lista de peças nem no Catálogo";

export const FRASE_NAO_CABE_NO_FORNO =
  "Com essas medidas a peça não cabe no forno cadastrado. Confira as dimensões, ou informe quantas cabem.";

// O selo do preço praticado (ORC-06) — cópia herdada, verbatim, de `prototipo.html` (`FAROL`).
export const TEXTO_FAROL: Record<"verde" | "amarelo" | "vermelho", string> = {
  verde: "paga tudo, com lucro e folga",
  amarelo: "cobre o custo, mas come o lucro",
  vermelho: "abaixo do custo: você paga para trabalhar",
};

export function fraseSugestaoParaComecar(precoFormatado: string): string {
  return `Sugestão para começar: ${precoFormatado}.`;
}

export const FRASE_MERCADO_ACIMA_DO_MINIMO =
  "O mercado paga mais que o seu mínimo: há espaço para cobrar pela autoria.";
export const FRASE_MERCADO_ABAIXO_DO_MINIMO =
  "O mercado paga menos que o seu mínimo: ou a peça é de base (vende volume, não paga a hora cheia), ou vale rever tempo e quantas cabem no forno.";

// "No forno: N por fornada de esmalte (X por prateleira × Y níveis) · M no biscoito." — cópia
// herdada, verbatim, de `prototipo.html` (`resFicha`). Quando a contagem veio de "já contei", o
// parêntese vira "(contado por você)" no esmalte, e desaparece de todo no biscoito (o protótipo
// só anota a origem quando ela NÃO é o cálculo automático).
export function fraseNoForno(entrada: {
  esmalte: number;
  biscoito: number;
  porPrateleira: number;
  niveis: number;
  origemEsmalte: "calculado" | "informado";
  origemBiscoito: "calculado" | "informado";
}): string {
  const parteEsmalte =
    entrada.origemEsmalte === "calculado"
      ? `${entrada.esmalte} por fornada de esmalte (${entrada.porPrateleira} por prateleira × ${entrada.niveis} níveis)`
      : `${entrada.esmalte} por fornada de esmalte (contado por você)`;
  const parteBiscoito =
    entrada.origemBiscoito === "calculado"
      ? `${entrada.biscoito} no biscoito`
      : `${entrada.biscoito} no biscoito (contado por você)`;
  return `No forno: ${parteEsmalte} · ${parteBiscoito}.`;
}

export const FRASE_CATEGORIA_DE_VENDA_INVALIDA =
  "Essa categoria de venda não existe mais, ou não é do grupo Receitas. Escolha outra.";
export const FRASE_FICHA_NAO_EXISTE_MAIS =
  "Essa peça não existe mais — recarregue a página e tente de novo.";
