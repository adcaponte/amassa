// As frases fixas e os rótulos do módulo Financeiro — só import de TIPO é permitido aqui (nunca
// `import` de valor), no molde de `lib/queimas/textos.ts`/`lib/abertura/textos.ts`: o módulo não
// lê React, não lê o cliente do banco e não importa `lib/financeiro/formato.ts` — a formatação de
// dinheiro usada em `textoVendaLancada` chega já pronta de quem chama (mesma disciplina de
// `gantt.ts`/`textos.ts` de Encomendas e de `lib/queimas/textos.ts`).
import type { areaFinanceira, formaPagamento, grupoCategoria } from "@/db/schema";

export type GrupoDeCategoria = (typeof grupoCategoria.enumValues)[number];
export type AreaFinanceira = (typeof areaFinanceira.enumValues)[number];
export type FormaDePagamento = (typeof formaPagamento.enumValues)[number];

export const TITULO_MODULO = "Financeiro";

// Sub-navegação do Financeiro — Venda, Despesa (plano 07) e Caixa são rota alcançável; o rótulo
// da última pílula (Mês) entra no plano 09, sempre na mesma ordem fixa
// (Venda · Despesa · Caixa · Mês · Cadastros).
export const ROTULO_ABA_VENDA = "Venda";
export const ROTULO_ABA_DESPESA = "Despesa";
export const ROTULO_ABA_CAIXA = "Caixa";
export const ROTULO_ABA_MES = "Mês";

// Os cinco rótulos de área (04.4-UI-SPEC.md §Color/§Copywriting) — "Área" nunca é escolhida pelo
// usuário, só exibida, derivada da categoria (briefing §2).
export const ROTULO_AREA: Record<AreaFinanceira, string> = {
  cafeteria: "Cafeteria",
  espaco: "Espaço",
  pecas: "Peças",
  loja: "Loja",
  geral: "Geral",
};

// Os quatro rótulos de grupo — mesmo texto de `GRUPOS` do protótipo.
export const ROTULO_GRUPO: Record<GrupoDeCategoria, string> = {
  receita: "Receitas",
  custo: "Custos diretos de uma área",
  geral: "Geral (custos da casa)",
  fora: "Fora do resultado",
};

export const ROTULO_FORMA: Record<FormaDePagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
};

export const ROTULO_LANCAR_VENDA = "Lançar venda";
export const FRASE_VAZIO_VENDA = "Toque nos itens para montar a venda.";
export const ROTULO_VALOR_LIVRE = "+ Valor livre";

// O bloco de pagamento (04.4-06-PLAN.md): "Como recebe"/"Como paga", os oito planos, "+ outra
// forma" (D-07/D-08) e o aviso do cartão. `PlanoDePagamento` redeclarado localmente — mesma
// disciplina de `FORMAS` em `lib/financeiro/esquemas.ts` — nunca importado de
// `lib/financeiro/parcelas.ts` (evita um import cruzado entre dois módulos puros irmãos).
export type PlanoDePagamento = "avista" | "sinal" | "2" | "3" | "4" | "6" | "10" | "12";

export const ROTULO_COMO_RECEBE = "Como recebe";
export const ROTULO_COMO_PAGA = "Como paga";
export const ROTULO_OUTRA_FORMA = "+ outra forma";
export const ROTULO_JA_RECEBI = "já recebi";
export const ROTULO_JA_PAGUEI = "já paguei";

export type TipoDeDocumentoParaTexto = "venda" | "despesa";

// "À vista"; "Sinal de 50% + saldo" (venda) / "Entrada de 50% + saldo" (despesa); "2x".."12x" —
// os rótulos do seletor "Como recebe"/"Como paga", na mesma ordem de `PLANOS_DE_PAGAMENTO`
// (lib/financeiro/parcelas.ts).
export function rotuloDoPlano(plano: PlanoDePagamento, tipo: TipoDeDocumentoParaTexto): string {
  if (plano === "avista") {
    return "À vista";
  }
  if (plano === "sinal") {
    return tipo === "venda" ? "Sinal de 50% + saldo" : "Entrada de 50% + saldo";
  }
  return `${plano}x`;
}

// "Cartão: a maquininha fica com 3,5% (R$ 5,25). Entram R$ 144,75 no caixa e a taxa vira custo do
// mês. A taxa muda em Cadastros → Taxas." — os três valores já chegam FORMATADOS de quem chama
// (`formatarPercentual`/`formatarReais`, lib/financeiro/formato.ts); este módulo nunca formata
// dinheiro sozinho.
export function textoAvisoCartao(
  percentualFormatado: string,
  taxaFormatada: string,
  entramFormatado: string,
): string {
  return `Cartão: a maquininha fica com ${percentualFormatado}% (${taxaFormatada}). Entram ${entramFormatado} no caixa e a taxa vira custo do mês. A taxa muda em Cadastros → Taxas.`;
}

// "1 de 3" — a etiqueta de parcela do extrato (zero-one-many: 1 parcela não mostra "1 de 1", só
// 2+ mostram "k de N", 04.4-UI-SPEC.md).
export function textoParcelaDoExtrato(numero: number, deQuantas: number): string {
  return `${numero} de ${deQuantas}`;
}

// O catálogo da Venda (plano 03): busca, pílulas de área, grade de atalhos, lista completa.
export const ROTULO_BUSCAR_NO_CATALOGO = "Buscar no catálogo";
export const ROTULO_TODOS_OS_ATALHOS = "Todos os atalhos";
export const ROTULO_LISTA_COMPLETA_E_ATALHOS = "Lista completa e atalhos";
export const FRASE_NENHUM_ATALHO =
  "Nenhum atalho aqui. Abra a lista completa e marque ★ nos itens que quer ver nesta tela.";
export const FRASE_NADA_ENCONTRADO = "Nada encontrado.";
export const TITULO_LISTA_COMPLETA = "Tudo o que se vende";
export const DICA_LISTA_COMPLETA =
  "Toque no nome para pôr na venda. A ★ escolhe o que aparece como atalho na tela.";
export const ROTULO_PRONTO = "Pronto";
export const ROTULO_BUSCAR = "Buscar";
export const ROTULO_CADA = "cada";
export const ROTULO_MENOS_UM = "menos um";
export const ROTULO_MAIS_UM = "mais um";
export const ROTULO_TIRAR = "tirar";
export const ROTULO_LIMPAR = "Limpar";
export const PLACEHOLDER_PESSOA_VENDA = "quem comprou";

// "tabela R$ 8,00" — a etiqueta que aparece quando o valor da linha difere do de tabela
// (`totalFormatado` chega pronto de `formatarReais`, textos.ts nunca importa formato.ts).
export function textoEtiquetaTabela(valorFormatado: string): string {
  return `tabela ${valorFormatado}`;
}

// "Atalho: Café 200 ml" — nome acessível da estrela na lista completa.
export function textoAtalhoAcessivel(nomeDoItem: string): string {
  return `Atalho: ${nomeDoItem}`;
}

// "+ Café 200 ml" — o aviso mostrado ao tocar num item dentro da lista completa (folha aberta).
export function textoItemAdicionado(nomeDoItem: string): string {
  return `+ ${nomeDoItem}`;
}

// "Lançando com data de 18/12/26 — serve para fechar um dia que já passou." (FNC-04).
export function textoDataRetroativa(dataFormatada: string): string {
  return `Lançando com data de ${dataFormatada} — serve para fechar um dia que já passou.`;
}

// "Um recebimento só, dividido sozinho entre Cafeteria e Peças." — `listaDeAreas` já vem pronta
// de `lib/financeiro/documento.ts::listaEmPortugues`.
export function textoDicaDeAreas(listaDeAreas: string): string {
  return `Um recebimento só, dividido sozinho entre ${listaDeAreas}.`;
}

export const TITULO_O_QUE_FOI_VENDIDO = "O que foi vendido";
export const TITULO_ESTA_VENDA = "Esta venda";
export const TITULO_EFEITO_ESTOQUE_VENDA = "O que esta venda tira do estoque";
export const DICA_EFEITO_ESTOQUE =
  "Aparece aqui para validar a regra. Passa a valer quando o módulo Estoque estiver ligado.";
export const ROTULO_DATA = "Data";
export const ROTULO_PESSOA_OPCIONAL = "Pessoa (opcional)";

// O diálogo "Valor livre" (04.4-UI-SPEC.md §Copywriting Contract).
export const TITULO_DIALOGO_VALOR_LIVRE = "Valor livre";
export const ROTULO_O_QUE_E = "O que é";
export const PLACEHOLDER_DESCRICAO_VALOR_LIVRE = "ex.: oficina fechada para grupo";
export const ROTULO_CATEGORIA = "Categoria";
export const ROTULO_VALOR = "Valor";
export const ROTULO_POR_NA_VENDA = "Pôr na venda";

// Os quatro rótulos dos tiles do Caixa.
export const ROTULO_TILE_SALDO = "Saldo em caixa";
export const ROTULO_TILE_A_RECEBER = "A receber";
export const ROTULO_TILE_A_PAGAR = "A pagar";
export const ROTULO_TILE_SE_TUDO_SE_CUMPRIR = "Se tudo se cumprir";

export const TITULO_EXTRATO = "O que já entrou e saiu";
export const FRASE_VAZIO_EXTRATO = "Nada neste mês ainda.";
// D-11: com filtro por forma aplicado e nenhuma linha bate — distinto do vazio SEM filtro acima.
export const FRASE_VAZIO_EXTRATO_NA_FORMA = "Nada neste mês, nesta forma.";
export const ROTULO_FILTRO_TODAS = "Todas";

// "Total em Dinheiro neste mês: + R$ 30,00" — resolução do Claude's Discretion de D-11
// (04.4-CONTEXT.md): o filtro por forma soma o total filtrado, resolvendo "quanto entrou em
// dinheiro?". `valorComSinalFormatado` já chega pronto de quem chama (com o sinal e
// `formatarReais`), este módulo nunca formata dinheiro sozinho.
export function textoTotalFiltrado(rotuloForma: string, valorComSinalFormatado: string): string {
  return `Total em ${rotuloForma} neste mês: ${valorComSinalFormatado}`;
}

export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar o Financeiro. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// "Venda nº 12 lançada · R$ 150,00" — o texto pronto, montado pela PÁGINA a partir do banco
// (`avisoDaUrl` + `obterDocumentoParaAviso`), nunca guardado no cliente. `totalFormatado` chega
// já pronto de `formatarReais` (lib/financeiro/formato.ts) — este módulo nunca formata dinheiro
// sozinho.
export function textoVendaLancada(
  numero: number,
  totalFormatado: string,
  parcelasEmAberto: number,
): string {
  const sufixo =
    parcelasEmAberto > 0
      ? ` · ${parcelasEmAberto} parcela${parcelasEmAberto > 1 ? "s" : ""} em aberto no Caixa`
      : "";
  return `Venda nº ${numero} lançada · ${totalFormatado}${sufixo}`;
}

// "Despesa nº 12 lançada · R$ 160,00" — o mesmo molde de `textoVendaLancada`, para o caminho de
// Despesa (04.4-07-PLAN.md); redeclarado (não parametrizado por "tipo") porque as duas frases só
// diferem na primeira palavra, e cada chamador (venda/despesa) já sabe qual delas usar.
export function textoDespesaLancada(
  numero: number,
  totalFormatado: string,
  parcelasEmAberto: number,
): string {
  const sufixo =
    parcelasEmAberto > 0
      ? ` · ${parcelasEmAberto} parcela${parcelasEmAberto > 1 ? "s" : ""} em aberto no Caixa`
      : "";
  return `Despesa nº ${numero} lançada · ${totalFormatado}${sufixo}`;
}

// A Despesa (04.4-07-PLAN.md): as três pílulas do topo, os títulos dos dois modos e os rótulos
// dos campos — o protótipo é a fonte literal de cada frase.
export const ROTULO_LANCAR_DESPESA = "Lançar despesa";
export const FRASE_VAZIO_DESPESA_COMPRA = "Toque nos materiais que chegaram.";

export const ROTULO_PILULA_COMPRA = "Compra de material";
export const ROTULO_PILULA_OUTRA = "Outra despesa";
export const ROTULO_PILULA_CONTA = "Pagar conta que já existe";

export const TITULO_O_QUE_CHEGOU = "O que chegou";
export const TITULO_ESTA_COMPRA = "Esta compra";
export const TITULO_QUE_DESPESA_E = "Que despesa é";
export const TITULO_PAGAMENTO_DESPESA = "Pagamento";

export const ROTULO_BUSCAR_MATERIAL_DO_ESTOQUE = "Buscar material do estoque";
export const ROTULO_FORNECEDOR_OPCIONAL = "Fornecedor (opcional)";
export const ROTULO_PARA_QUEM_OPCIONAL = "Para quem (opcional)";
export const ROTULO_DESCRICAO = "Descrição";
export const PLACEHOLDER_DESCRICAO_DESPESA = "ex.: jogo de estecas";
export const DICA_FORA_DO_RESULTADO =
  "Esta categoria sai do caixa, mas não entra como custo do mês — é investimento ou dívida, não despesa de operação.";

export const ROTULO_CUSTOU_AO_TODO = "custou ao todo";

// "quantos (kg)" — `unidadeExibida` já vem pronta de quem chama (o componente, mesma disciplina
// de nunca formatar por aqui).
export function textoRotuloQuantos(unidadeExibida: string): string {
  return `quantos (${unidadeExibida})`;
}

export const TITULO_EFEITO_ESTOQUE_COMPRA = "O que esta compra põe no estoque";
export const DICA_EFEITO_ESTOQUE_COMPRA =
  'O custo de cada unidade sai de "custou ao todo" ÷ quantidade. Vale quando o Estoque estiver ligado.';

export const TITULO_TODO_MATERIAL_DE_ESTOQUE = "Todo material de estoque";
export const DICA_LISTA_COMPLETA_COMPRA =
  "Toque no nome para pôr na compra. A ★ escolhe o que aparece como atalho na tela.";

// O Caixa que age (04.4-08-PLAN.md): as listas "A pagar"/"A receber", o cartão de conta, o
// detalhe do documento e o cancelamento que risca sem apagar (FNC-07, FNC-10).
export const ROTULO_VER = "Ver";
export const ROTULO_VOLTAR = "Voltar";
export const ROTULO_FECHAR = "Fechar";
export const ROTULO_TAG_VENCIDA = "vencida";

// "Recebi"/"Paguei" — o rótulo do botão no cartão de conta (protótipo `contaHTML`); distinto de
// `ROTULO_JA_RECEBI`/`ROTULO_JA_PAGUEI` (minúsculo, usado na caixinha "já recebi/já paguei" do
// bloco de pagamento — outra tela, outro propósito).
export function rotuloBotaoBaixa(tipo: TipoDeDocumentoParaTexto): string {
  return tipo === "venda" ? "Recebi" : "Paguei";
}

// "k de N" — só quando o documento tem MAIS de uma parcela (zero-one-many, 04.4-UI-SPEC.md); o
// rótulo de conta fixa ("parcela 26 de 60") sempre vence quando presente.
export function textoRotuloDaConta(rotulo: string | null, numero: number, deQuantas: number): string | null {
  if (rotulo) {
    return rotulo;
  }
  return deQuantas > 1 ? `${numero} de ${deQuantas}` : null;
}

// "vence 18/12/26" — o cartão de conta (protótipo `contaHTML`).
export function textoVence(dataFormatada: string): string {
  return `vence ${dataFormatada}`;
}

export const FRASE_VAZIO_A_PAGAR = "Nenhuma conta em aberto.";
export const FRASE_VAZIO_A_RECEBER = "Ninguém deve nada.";

// O cabeçalho do detalhe: "Venda nº 12 · 18/12/26 · Maria" (protótipo `folhaDoc`).
export function textoCabecalhoDocumento(
  tipo: TipoDeDocumentoParaTexto,
  numero: number,
  dataFormatada: string,
  pessoa: string | null,
): string {
  const rotuloTipo = tipo === "venda" ? "Venda" : "Despesa";
  const sufixoPessoa = pessoa ? ` · ${pessoa}` : "";
  return `${rotuloTipo} nº ${numero} · ${dataFormatada}${sufixoPessoa}`;
}

// "recebida em 18/12/26" / "paga em 18/12/26" — a etiqueta de parcela paga no detalhe.
export function textoPagoEm(tipo: TipoDeDocumentoParaTexto, dataFormatada: string): string {
  return `${tipo === "venda" ? "recebida" : "paga"} em ${dataFormatada}`;
}

// "1/3 · vence 18/12/26" — cada linha de parcela no detalhe (protótipo `folhaDoc`).
export function textoParcelaDetalhe(numero: number, deQuantas: number, vencimentoFormatado: string): string {
  return `${numero}/${deQuantas} · vence ${vencimentoFormatado}`;
}

// "Cancelado por Andressa em 18/12/26" — só aparece quando o documento está cancelado.
export function textoCanceladoPor(nome: string, dataFormatada: string): string {
  return `Cancelado por ${nome} em ${dataFormatada}`;
}

// O botão dentro do detalhe (protótipo `folhaDoc`): "Cancelar esta venda"/"Cancelar esta despesa".
export function rotuloCancelar(tipo: TipoDeDocumentoParaTexto): string {
  return tipo === "venda" ? "Cancelar esta venda" : "Cancelar esta despesa";
}

// O botão de CONFIRMAR dentro do AlertDialog (04.4-08-PLAN.md, Tarefa 2): "Cancelar venda"/
// "Cancelar despesa" — sem "esta", distinto do botão que ABRE o diálogo (`rotuloCancelar` acima).
export function rotuloConfirmarCancelamento(tipo: TipoDeDocumentoParaTexto): string {
  return tipo === "venda" ? "Cancelar venda" : "Cancelar despesa";
}

// A dica do detalhe (protótipo `folhaDoc`), MENOS "e o estoque é devolvido" — nesta fase nada é
// gravado no estoque ainda (a Fase 6 devolve essa parte da frase junto com o estorno real).
export const DICA_CANCELAR_NAO_APAGA =
  "Cancelar não apaga: o lançamento fica riscado no histórico e o dinheiro sai do saldo.";

// A confirmação exata do UI-SPEC (Copywriting Contract) — "esta venda"/"esta despesa" no meio da
// frase, nunca "este lançamento" genérico.
export function fraseConfirmarCancelamento(
  tipo: TipoDeDocumentoParaTexto,
  numero: number,
  titulo: string,
): string {
  const alvo = tipo === "venda" ? "esta venda" : "esta despesa";
  return `Cancelar ${alvo} nº ${numero} «${titulo}»? Ela fica riscada no extrato, sai do saldo e do Mês. Quem cancelou e quando ficam registrados. Isso não pode ser desfeito — se foi engano, lance de novo depois.`;
}

export const FRASE_LANCAMENTO_JA_CANCELADO = "Esse lançamento já foi cancelado.";
export const FRASE_LANCAMENTO_NAO_EXISTE_MAIS =
  "Esse lançamento não existe mais. Recarregue a página e tente de novo.";

// "Lançamento nº 12 cancelado. Continua visível, riscado." — o aviso pós-cancelamento.
export function textoCancelado(numero: number): string {
  return `Lançamento nº ${numero} cancelado. Continua visível, riscado.`;
}

// "Paguei"/"Recebi" com a linha de diferença (D-01/D-02) e o "Desfazer" (D-03).
export const ROTULO_QUANDO = "Quando";
export const ROTULO_FORMA_CAMPO = "Forma";
export const ROTULO_CONFIRMAR = "Confirmar";
export const ROTULO_DESFAZER = "Desfazer";
export const DICA_BAIXA =
  "Se o valor veio diferente do previsto, corrija aqui — o lançamento é ajustado junto.";

// "Recebi: {título}"/"Paguei: {título}" — o título do diálogo de baixa (protótipo `folhaBaixa`).
export function textoTituloBaixa(tipo: TipoDeDocumentoParaTexto, titulo: string): string {
  return `${tipo === "venda" ? "Recebi" : "Paguei"}: ${titulo}`;
}

// "Recebido: R$ 150,00" / "Pago: R$ 150,00" (sem diferença); com diferença, acrescenta
// ". R$ 12,00 a mais viraram uma linha de diferença." — `diferencaCentavos` nulo/zero omite o
// segundo trecho (D-01, UI-SPEC Copywriting Contract).
export function textoDoPagamento(
  tipo: TipoDeDocumentoParaTexto,
  valorFormatado: string,
  diferencaFormatadaAbsoluta: string | null,
  diferencaAMaisOuMenos: "a mais" | "a menos" | null,
): string {
  const base = `${tipo === "venda" ? "Recebido" : "Pago"}: ${valorFormatado}`;
  if (!diferencaFormatadaAbsoluta || !diferencaAMaisOuMenos) {
    return base;
  }
  return `${base}. ${diferencaFormatadaAbsoluta} ${diferencaAMaisOuMenos} viraram uma linha de diferença.`;
}

// "Desfeito. A conta voltou a R$ 148,00 em aberto." — o aviso pós-desfazer (D-03).
export function textoDoDesfazer(valorFormatado: string): string {
  return `Desfeito. A conta voltou a ${valorFormatado} em aberto.`;
}

// As recusas do servidor (registrarPagamento/desfazerPagamento) — a mesma frase serve à
// concorrência real (duas pessoas) e à simples tentativa de pagar/desfazer de novo.
export const FRASE_CONTA_JA_PAGA =
  "Essa conta já foi paga — recarregue a página para ver como ela está.";
export const FRASE_LANCAMENTO_CANCELADO_SEM_PAGAMENTO =
  "Esse lançamento foi cancelado — ele não recebe mais pagamento.";
export const FRASE_DESFAZER_LANCAMENTO_CANCELADO =
  "Esse lançamento foi cancelado — não dá para desfazer um pagamento dele.";
export const FRASE_DESFAZER_EM_ABERTO =
  "Essa conta ainda está em aberto — não tem pagamento para desfazer.";
export const FRASE_FALHA_AO_DESFAZER = "Não deu para desfazer. Verifique a internet e tente de novo.";
export const FRASE_DATA_DE_PAGAMENTO_FUTURA = "A data do pagamento não pode ser depois de hoje.";
export const FRASE_DATA_DE_PAGAMENTO_ANTES_DO_SALDO_INICIAL =
  "Essa data é anterior ao saldo inicial do Financeiro — confira a data.";
