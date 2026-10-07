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

// "Como o preço é montado" — bloco fixo: as cinco linhas do protótipo, verbatim, e a sexta da
// galeria, que entrou com a decisão do dono de 06/10/2026 (D-16, "b-sobre-o-direto").
export const TITULO_COMO_O_PRECO_E_MONTADO = "Como o preço é montado";
export const LINHAS_COMO_O_PRECO_E_MONTADO: readonly { titulo: string; descricao: string }[] = [
  { titulo: "1 · Material", descricao: "argila + esmalte" },
  { titulo: "2 · Trabalho", descricao: "horas × sua hora" },
  { titulo: "3 · Queimas", descricao: "fornada ÷ peças que cabem, pelas medidas" },
  { titulo: "4 · Perda", descricao: "÷ (1 − perda)" },
  { titulo: "5 · Preço mínimo", descricao: "÷ (1 − lucro − folga − imposto − taxa)" },
  { titulo: "6 · Galeria ou consignado", descricao: "preço mínimo ÷ (1 − comissão)" },
];
export const DICA_PERCENTUAL_DIVIDE =
  "Tudo que é porcentagem do preço entra dividindo, não somando — é a fórmula do Sebrae. Assim 15% de lucro são 15% do preço, não do custo.";
export const DICA_ESTIMADO_MEDIDO =
  "Estimado × medido. Toque no selo quando trocar um número chutado por um número seu: conta de luz, peças contadas na fornada, tempo cronometrado. O orçamento avisa enquanto houver estimados.";
export const DICA_TAXA_E_QUANTAS_CABEM =
  "A taxa do cartão é a mesma do Financeiro. Quantas cabem sai das medidas da peça e do forno: peças por prateleira × níveis, com folga no esmalte e um fator a mais no biscoito.";

// O aviso do divisor que não fecha (D-11) — no lugar de qualquer preço, nunca um número grande.
// Desde a D-16 (06/10/2026) a comissão da galeria não soma mais com os outros: tem divisor próprio.
export const FRASE_DIVISOR_INVALIDO =
  "Os parâmetros de preço não fazem sentido (lucro + folga + imposto + taxa, ou a comissão da galeria, chegam perto de 100%). Ajuste em Parâmetros antes de calcular.";

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
  // O plural de "nível" é concordado (achado da verificação do Cowork em produção, 27/09/2026:
  // a ficha de uma peça alta escrevia "1 níveis"). Zero vai no plural, como manda o português.
  const palavraNivel = entrada.niveis === 1 ? "nível" : "níveis";
  const parteEsmalte =
    entrada.origemEsmalte === "calculado"
      ? `${entrada.esmalte} por fornada de esmalte (${entrada.porPrateleira} por prateleira × ${entrada.niveis} ${palavraNivel})`
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

// ---------------------------------------------------------------------------------------------
// Lista de Peças (04.5-05-PLAN.md — D-19/D-20, ORC-05/ORC-06/ORC-18)
// ---------------------------------------------------------------------------------------------

export const TITULO_LISTA_PECAS = "Peças precificadas";
export const FRASE_VAZIO_PECAS_TITULO = "Nenhuma peça precificada ainda.";
export const FRASE_VAZIO_PECAS_CORPO =
  "Cadastre a primeira peça para saber quanto ela custa e qual é o preço mínimo.";
export const ETIQUETA_EXCLUSIVA = "exclusiva";
export const TEXTO_SEM_PRECO_DEFINIDO = "sem preço definido";
export const ROTULO_ABRIR_PECA = "Abrir";
export const DICA_RODAPE_PECAS =
  "O preço praticado é o que vai para o Catálogo e aparece na Venda. O custo é o que a peça pronta vale ao entrar no Estoque.";

// "Mostrar/Esconder peças exclusivas de pedidos (N)" — o alternador só aparece quando existe ao
// menos uma exclusiva (D-19), verbatim do protótipo (`ver-excl`).
export function rotuloAlternarExclusivas(mostrando: boolean, quantidade: number): string {
  return `${mostrando ? "Esconder" : "Mostrar"} peças exclusivas de pedidos (${quantidade})`;
}

// "custo {R$X} · mínimo {R$Y}" — a linha de apoio de cada peça na lista (verbatim do protótipo,
// `telaPecas`), montada aqui porque combina DOIS valores já formatados por quem chama (nunca
// formata dinheiro sozinho — mesma disciplina do resto do módulo).
export function linhaDeApoioDaPeca(custoFormatado: string, minimoFormatado: string): string {
  return `custo ${custoFormatado} · mínimo ${minimoFormatado}`;
}

export const ROTULO_COMECAR_A_PARTIR_DE = "Começar a partir de uma peça parecida (opcional)";
export const ROTULO_DO_ZERO = "— do zero —";
export const ROTULO_APAGAR_PECA = "Apagar";

// "Apagar a peça «{nome}»?" — título do `AlertDialog` destrutivo; o corpo é fixo (verbatim do
// 04.5-UI-SPEC.md §Copywriting), nomeado uma vez no título, nunca repetido no corpo.
export function tituloConfirmarApagarPeca(nome: string): string {
  return `Apagar a peça «${nome}»?`;
}
export const CORPO_CONFIRMAR_APAGAR_PECA =
  "Ela sai da lista e do Catálogo. Só é possível apagar uma peça que não está em nenhum orçamento.";

// A recusa do servidor (D-20) — a contagem é SEMPRE a que `apagarFicha` leu dentro da própria
// transação, nunca um número pré-carregado pela lista.
//
// O plural é escrito por extenso, não com "(s)": "está em 1 orçamento" e "está em 2 orçamentos".
// A forma preguiçosa lia "está em 1 orçamento(s)", e o CLAUDE.md pede erro em linguagem humana —
// registrada como WINDOWS #36 e corrigida a pedido do dono em 2026-09-26. A contagem nunca é
// zero aqui: `apagarFicha` só chama esta frase quando achou pelo menos um orçamento.
export function fraseFichaEmUso(quantidadeDeOrcamentos: number): string {
  const orcamentos = quantidadeDeOrcamentos === 1 ? "1 orçamento" : `${quantidadeDeOrcamentos} orçamentos`;
  return `Esta peça está em ${orcamentos}. Não dá para apagar.`;
}

// Fase 06.1 (plano 12, Pitfall 11): a ficha que uma ORDEM DE PRODUÇÃO usa também não se apaga — a
// frase da UI-SPEC, com o plural de verdade ("1 ordem de produção" / "2 ordens de produção").
export function fraseFichaEmOrdensDeProducao(quantidadeDeOrdens: number): string {
  const ordens =
    quantidadeDeOrdens === 1 ? "1 ordem de produção" : `${quantidadeDeOrdens} ordens de produção`;
  return `Esta peça é usada em ${ordens} — não dá para apagar.`;
}

// A recusa de `apagarFicha` junta as duas contagens: a dos orçamentos (quando houver) e a das
// ordens (quando houver) — uma frase de cada, na ordem em que o diálogo sempre as mostrou.
export function fraseFichaEmUsoCompleta(quantidadeDeOrcamentos: number, quantidadeDeOrdens: number): string {
  const frases: string[] = [];
  if (quantidadeDeOrcamentos > 0) {
    frases.push(fraseFichaEmUso(quantidadeDeOrcamentos));
  }
  if (quantidadeDeOrdens > 0) {
    frases.push(fraseFichaEmOrdensDeProducao(quantidadeDeOrdens));
  }
  return frases.join(" ");
}

// Revisão 06.1, WR-01 — o dono escolheu a opção (a) na Parte 0 (30/09/2026): a ficha de linha que
// uma ordem da PRODUÇÃO DA CASA ainda aberta usa não vira "exclusiva" — a ordem ficaria sem item
// onde guardar as peças. A frase diz qual ordem (ou quantas, com as duas primeiras pelo nome) e o
// que fazer. `nomes` nunca vem vazio: `editarFicha` só a chama quando achou pelo menos uma ordem.
export function fraseFichaNaProducaoDaCasa(nomes: readonly string[]): string {
  if (nomes.length === 1) {
    return `A ficha está na produção da casa “${nomes[0]}”. Conclua ou cancele a ordem na Produção antes de torná-la exclusiva. Nada foi gravado.`;
  }
  const citadas = nomes.slice(0, 2).map((nome) => `“${nome}”`);
  const lista =
    nomes.length === 2
      ? `${citadas[0]} e ${citadas[1]}`
      : `${citadas[0]}, ${citadas[1]} e mais ${nomes.length - 2}`;
  return `A ficha está em ${nomes.length} ordens da produção da casa ainda abertas (${lista}). Conclua ou cancele essas ordens na Produção antes de torná-la exclusiva. Nada foi gravado.`;
}

// Fase 06.4, plano 03 — a régua P · M · G das Queimas em Parâmetros (D-03, UI-D11). As recusas do
// servidor (`definirParametro`) e a frase do grupo "Queimas" antes da 0030.
export const FRASE_REGUA_P_MENOR_QUE_M = "O limite do P precisa ser menor que o do M.";
export const FRASE_REGUA_MAIOR_QUE_ZERO = "A medida precisa ser maior que zero.";
export const FRASE_REGUA_AUSENTE =
  "A régua P · M · G ainda não está no banco. Ela chega com a atualização das Queimas — até lá, as queimas registram sem a folha de contagem.";
