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
