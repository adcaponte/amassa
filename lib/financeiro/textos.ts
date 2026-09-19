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

// Sub-navegação do Financeiro — nesta tarefa só Venda e Caixa são rota alcançável; os rótulos das
// outras três pílulas (Despesa, Mês, Cadastros) entram nos planos 07/09/02, sempre na mesma ordem
// fixa (Venda · Despesa · Caixa · Mês · Cadastros).
export const ROTULO_ABA_VENDA = "Venda";
export const ROTULO_ABA_CAIXA = "Caixa";

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
