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
