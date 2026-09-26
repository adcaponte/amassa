// As frases fixas e os rótulos do módulo Orçamentos — só import de TIPO é permitido aqui (nunca
// `import` de valor), no molde de `lib/financeiro/textos.ts`.

export const TITULO_LISTA_ORCAMENTOS = "Orçamentos";

export const ROTULO_NOVO_ORCAMENTO = "Novo orçamento";

// Estado vazio da lista (04.5-UI-SPEC.md §Copywriting, verbatim).
export const FRASE_VAZIO_TITULO = "Nenhum orçamento ainda.";
export const FRASE_VAZIO_CORPO =
  "Comece um orçamento para dar um preço e um prazo à próxima encomenda.";

export const FRASE_SEM_TITULO = "Sem título";
export const FRASE_SEM_CLIENTE = "sem cliente";

export const FRASE_FALHA_AO_CRIAR =
  "Não deu para criar o orçamento. Verifique a internet e tente de novo.";

// O chip de situação da lista (04.5-UI-SPEC.md §Copywriting) — só "rascunho" é usado nesta fase
// (o traçador só cria rascunhos); os demais chips (enviado/aprovado/recusado/expirado) chegam com
// os planos que implementam o resto do ciclo de vida do orçamento.
export const ROTULO_CHIP_RASCUNHO = "rascunho";

// ---------------------------------------------------------------------------------------------
// O editor do orçamento (04.5-06-PLAN.md) — cabeçalho, "Para quem e para quando", "Peças"
// ---------------------------------------------------------------------------------------------

export const ROTULO_TODOS = "◀ Todos";

export const TITULO_PARA_QUEM_E_QUANDO = "Para quem e para quando";
export const ROTULO_CLIENTE = "Cliente";
export const ROTULO_TITULO_DO_PEDIDO = "Título do pedido";
export const PLACEHOLDER_TITULO_DO_PEDIDO = "ex.: jogo de jantar";
export const ROTULO_ENTREGA_PREVISTA = "Entrega prevista";
export const ROTULO_VALIDADE_DIAS = "Vale por (dias)";
// A mesma leitura, quando o orçamento não é mais rascunho (04.5-UI-SPEC.md, "congelamento
// visual") — "Pedido"/"Válido até" são os rótulos de LEITURA do protótipo (`lista-simples`),
// diferentes dos rótulos de EDIÇÃO acima.
export const ROTULO_LEITURA_PEDIDO = "Pedido";
export const ROTULO_LEITURA_VALIDO_ATE = "Válido até";

export const TITULO_BLOCO_PECAS = "Peças";
export const FRASE_VAZIO_PECAS_DO_ORCAMENTO = "Nenhuma peça ainda.";
export const ROTULO_MAIS_PECA_DA_LISTA = "+ Peça da lista";
export const ROTULO_MAIS_PECA_EXCLUSIVA = "+ Peça exclusiva deste pedido";

export const ROTULO_QUANTAS = "quantas";
export const ROTULO_CADA = "cada";
export const ROTULO_VER_CALCULO = "ver cálculo";
export const ROTULO_TIRAR = "tirar";
export const ROTULO_COR_ESMALTE = "Cor / esmalte";
export const PLACEHOLDER_COR_ESMALTE = "ex.: verde-musgo fosco";
export const ROTULO_PERSONALIZACAO = "Personalização";
export const PLACEHOLDER_PERSONALIZACAO = "gravação, medida especial…";

// "preço mínimo {R$ X}" — a linha de apoio de cada linha de peça (verbatim do protótipo,
// `linhaOrc`), montada aqui porque combina um valor já formatado por quem chama (nunca formata
// dinheiro sozinho — mesma disciplina de `lib/precificacao/textos.ts::linhaDeApoioDaPeca`).
export function rotuloPrecoMinimoDaLinha(valorFormatado: string): string {
  return `preço mínimo ${valorFormatado}`;
}

// "Tirar «{nome}»?" — confirmação destrutiva de uma linha (CLAUDE.md: nenhuma exclusão
// silenciosa, sempre nomeando o que será perdido).
export function tituloConfirmarTirarLinha(nome: string): string {
  return `Tirar «${nome}» deste orçamento?`;
}
export const CORPO_CONFIRMAR_TIRAR_LINHA =
  "Ela sai da lista de peças deste orçamento. Você pode adicionar de novo depois, se precisar.";

export const TITULO_ESCOLHER_PECA = "Qual peça";
export const ROTULO_FECHAR = "Fechar";
export const FRASE_VAZIO_ESCOLHER_PECA =
  "Nenhuma peça na lista ainda. Cadastre uma em Peças, ou use \"+ Peça exclusiva deste pedido\".";

// "mín. {R$ X}" — ao lado de cada peça na folha de escolha (verbatim do protótipo,
// `folhaEscolher`).
export function rotuloMinimoNaLista(valorFormatado: string): string {
  return `mín. ${valorFormatado}`;
}

export const FRASE_ORCAMENTO_NAO_ENCONTRADO =
  "Esse orçamento não existe mais. Volte para a lista e confira.";
export const FRASE_ERRO_CARREGAR_ORCAMENTO =
  "Não deu para carregar o orçamento. Verifique a internet e tente de novo.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";

// ---------------------------------------------------------------------------------------------
// Validação e recusa do servidor (04.5-06-PLAN.md, Tarefa 2) — cada módulo tem sua própria cópia
// das frases (D-15 do projeto).
// ---------------------------------------------------------------------------------------------

export const FRASE_CLIENTE_MUITO_LONGO = "O nome do cliente passa de 160 letras — encurte.";
export const FRASE_TITULO_MUITO_LONGO = "O título passa de 160 letras — encurte.";
export const FRASE_VALIDADE_INVALIDA =
  '"Vale por (dias)" precisa ser um número inteiro entre 1 e 365.';
export const FRASE_QUANTIDADE_INVALIDA =
  "A quantidade precisa ser um número inteiro entre 1 e 100000.";
export const FRASE_PRECO_OBRIGATORIO = "Informe o preço desta peça.";
export const FRASE_COR_MUITO_LONGA = "A cor/esmalte passa de 80 letras — encurte.";
export const FRASE_PERSONALIZACAO_MUITO_LONGA = "A personalização passa de 200 letras — encurte.";

export const FRASE_ORCAMENTO_NAO_EXISTE_MAIS =
  "Esse orçamento não existe mais — recarregue a página e tente de novo.";
// A frase exata pedida pelo plano (D-21: só o servidor decide, dentro da transação, nunca a
// tela) — copiada verbatim, nunca reescrita.
export const FRASE_ORCAMENTO_NAO_E_RASCUNHO =
  'Este orçamento não é mais um rascunho. Para mudar os preços, use "Atualizar preços".';
export const FRASE_LINHA_NAO_EXISTE_MAIS =
  "Essa peça já não está mais neste orçamento — recarregue a página e tente de novo.";
export const FRASE_FICHA_NAO_ENCONTRADA_PARA_LINHA =
  "Essa peça não existe mais — recarregue a página e tente de novo.";
export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";
