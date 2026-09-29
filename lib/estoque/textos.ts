// As frases do Estoque — módulo sem nenhum import (mesma disciplina de `lib/anotacoes/textos.ts`):
// nenhuma regra de negócio mora aqui, só o que a tela mostra. Cada frase é a da UI-SPEC da fase
// (`.planning/phases/06-estoque/06-UI-SPEC.md` §Copywriting Contract), na seção citada ao lado.
// Números chegam JÁ FORMATADOS de quem chama (`formatarQuantidade`, `ROTULO_UNIDADE`) — este
// módulo não formata nada.

// §Estados vazios — "Estoque sem nenhum item com estoque".
export const TITULO_ESTOQUE_VAZIO = "Nada no estoque ainda.";
export const CORPO_ESTOQUE_VAZIO =
  "Cadastre o primeiro material — argila, esmalte, café, embalagem — para acompanhar o que entra e o que sai. Item marcado com “Tem estoque próprio” em Cadastros → Catálogo aparece aqui sozinho.";

// §Erros — "Carregar a aba Saldos".
export const TITULO_ERRO = "Algo não funcionou.";
export const FRASE_ERRO_CARREGAR_SALDOS =
  "Não deu para carregar os saldos. Verifique a internet e tente de novo.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";

// §Erros — "Gravar movimentação" (a folha continua aberta e preenchida).
export const FRASE_FALHA_AO_REGISTRAR =
  "Não deu para registrar. Verifique a internet e tente de novo.";

// §Erros — campos da folha (embaixo do campo, `role="alert"`, nunca toast — UI-D9).
export const FRASE_QUANTIDADE_ZERO = "A quantidade precisa ser maior que zero.";
export const FRASE_QUANTIDADE_INVALIDA = "Digite a quantidade — por exemplo, 2 ou 0,5.";
export const FRASE_DESTINO_OBRIGATORIO = "Escolha para onde o material foi.";
export const FRASE_CUSTO_OBRIGATORIO = "Diga quanto custou ao todo — é daí que sai o custo médio.";

// §Erros — "Material desativado por outra pessoa enquanto a folha estava aberta".
export function fraseMaterialDesativado(nome: string): string {
  return `${nome} foi desativado enquanto você registrava. Reative-o para movimentar.`;
}
// O item sumiu do catálogo, ou deixou de ter estoque próprio, entre abrir a folha e gravar.
export const FRASE_MATERIAL_NAO_EXISTE_MAIS =
  "Esse material não está mais no estoque — recarregue a página e tente de novo.";

// §Ações.
export const ROTULO_DAR_BAIXA = "Dar baixa";
export const ROTULO_REGISTRAR_MOVIMENTACAO = "Registrar movimentação";
export const ROTULO_REGISTRAR_BAIXA = "Registrar baixa";
export const ROTULO_REGISTRAR_ENTRADA = "Registrar entrada";
export const ROTULO_REGISTRANDO = "Registrando…";
export const ROTULO_ENTRADA = "Entrada";
export const ROTULO_SAIDA = "Saída";
export const ROTULO_O_QUE_ACONTECEU = "O que aconteceu";

// §Rótulos e dicas de campo.
export const ROTULO_QUANTIDADE = "Quantidade";
export function dicaDaQuantidade(unidade: string): string {
  return `em ${unidade}`;
}
export const ROTULO_CUSTO = "Quanto custou ao todo";
export const DICA_CUSTO = "o valor da nota, em reais — é daí que sai o custo médio";
export const ROTULO_DESTINO = "Para onde foi?";
export const DICA_DESTINO = "obrigatório — é o que diz qual área pagou";

// §Toasts — "Saída gravada" e "Entrada gravada". `saldoNegativo` chega formatado com o sinal de
// menos tipográfico ("−2"), só quando a baixa deixou o saldo abaixo de zero.
export function textoToastBaixa(dados: {
  quantidade: string;
  unidade: string;
  nome: string;
  saldoNegativo?: string | null;
}): string {
  const base = `Baixa de ${dados.quantidade} ${dados.unidade} em ${dados.nome}.`;
  return dados.saldoNegativo
    ? `${base} O saldo ficou em ${dados.saldoNegativo} ${dados.unidade}.`
    : base;
}

export function textoToastEntrada(dados: {
  quantidade: string;
  unidade: string;
  nome: string;
}): string {
  return `Entrada de ${dados.quantidade} ${dados.unidade} em ${dados.nome}.`;
}

// ---------------------------------------------------------------------------------------------
// Aba Saldos (plano 06-04) — busca, pílulas, chips, banner, contador, vazios e nota de rodapé.
// ---------------------------------------------------------------------------------------------

// §Rótulos e dicas de campo — "Busca da lista".
export const PLACEHOLDER_BUSCA = "Buscar material ou categoria";
export const ROTULO_BUSCA = "Buscar material";

// §Aba Saldos → barra de ferramentas. As áreas usam `ROTULO_AREA` do Financeiro (D-12): o
// Estoque nunca tem uma classificação própria.
export const ROTULO_PILULA_TUDO = "Tudo";
export const ROTULO_PILULA_ACABANDO = "Acabando";
export const ROTULO_FILTRAR_POR_AREA = "Filtrar materiais por área";

// §Aba Saldos → filtro de situação (UI-D4) — mesmos rótulos das Queimas.
export const ROTULO_FILTRO_ATIVOS = "Ativos";
export const ROTULO_FILTRO_DESATIVADOS = "Desativados";
export const ROTULO_FILTRO_TODOS = "Todos";
export const ROTULO_FILTRAR_POR_SITUACAO = "Filtrar materiais por situação";

// §Aba Saldos → cartão: os chips (negativo vence acabando — nunca os dois) e a linha de
// metadados.
export const CHIP_ACABANDO = "Acabando";
export const CHIP_SALDO_NEGATIVO = "Saldo negativo";
export const CHIP_DESATIVADO = "Desativado";
export const META_SEM_MINIMO = "sem mínimo";
export const META_PECA_PRONTA = "peça pronta";
export function textoMetaMinimo(minimo: string, unidade: string): string {
  return `mínimo ${minimo} ${unidade}`;
}
// Custo médio sem nenhuma entrada com preço (D-26) — nunca "R$ 0,00/kg", nunca vazio.
export const SEM_CUSTO_CONHECIDO = "—";
export function textoCustoMedio(reais: string, unidade: string): string {
  return `${reais}/${unidade}`;
}

// §Aba Saldos → tabela (≥ 980px): cabeçalhos das colunas.
export const COLUNA_MATERIAL = "Material";
export const COLUNA_AREA = "Área";
export const COLUNA_SALDO = "Saldo";
export const COLUNA_MINIMO = "Mínimo";
export const COLUNA_CUSTO_MEDIO = "Custo médio";
export const COLUNA_VALOR = "Valor";
export const COLUNA_ACOES = "Ações";

// §Aba Saldos → contador: "{n} de {total} · {R$} em estoque" — nunca "1 de 1 materiais".
export function textoContador(mostrados: number, total: number, valorEmEstoque: string): string {
  return `${mostrados} de ${total} · ${valorEmEstoque} em estoque`;
}

// §Layout → banner de alerta. Singular e plural por conta própria; "só negativos" tem título
// próprio (D-21: negativo é aviso separado de "acabando").
export function tituloBannerAcabando(quantos: number): string {
  return quantos === 1 ? "1 material está acabando" : `${quantos} materiais estão acabando`;
}
export function tituloBannerNegativos(quantos: number): string {
  return quantos === 1
    ? "1 material com saldo negativo"
    : `${quantos} materiais com saldo negativo`;
}
export const PREFIXO_LINHA_NEGATIVOS = "Com saldo negativo: ";
export function textoEMais(quantos: number): string {
  return `e mais ${quantos}`;
}
export const ROTULO_VER_SO_ESSES = "Ver só esses";

// §Estados vazios — os três vazios de filtro da aba Saldos, cada um com a sua saída.
export const TITULO_NADA_COM_FILTRO = "Nada com esse filtro";
export const CORPO_NADA_COM_FILTRO = "Tente outro nome, ou limpe os filtros.";
export const ROTULO_LIMPAR_FILTROS = "Limpar filtros";
export const TITULO_NADA_ACABANDO = "Nada acabando.";
export const CORPO_NADA_ACABANDO =
  "Nenhum material está abaixo do mínimo nem com saldo negativo.";
export const ROTULO_VER_TODOS = "Ver todos";
export const TITULO_NENHUM_DESATIVADO = "Nenhum material desativado.";
export const CORPO_NENHUM_DESATIVADO =
  "Material desativado some da Venda e da Compra, mas continua aqui, com o histórico.";

// §Notas de rodapé — Saldos. Em partes, para a tela pôr o destaque em negrito e o "ajuste" em
// itálico sem reescrever a frase.
export const NOTA_SALDOS_DESTAQUE = "O saldo não é digitado.";
export const NOTA_SALDOS_ANTES_DO_AJUSTE =
  " Ele é sempre a soma do histórico — entradas menos saídas, mais ajustes. Não existe campo para corrigir um saldo à mão: se a prateleira discorda do sistema, registre um ";
export const NOTA_SALDOS_AJUSTE = "ajuste";
export const NOTA_SALDOS_DEPOIS_DO_AJUSTE = ", que fica no histórico com seu nome e a data.";
// §Aba Saldos → tabela: a coluna Mínimo mostra "—" quando o mínimo é zero (nunca avisa).
export const SEM_MINIMO_NA_TABELA = "—";
