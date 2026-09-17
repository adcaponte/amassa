// As frases fixas, os rótulos e os seis campos longos do Comparador de Compras — só `import
// type` é permitido aqui (nenhum import de valor), no molde de `lib/abertura/textos.ts`: o
// módulo não lê React nem o cliente do banco. Tudo copiado verbatim do §"Copywriting Contract"
// de `04.3-UI-SPEC.md`, que é o contrato aprovado — onde ele e o protótipo divergem, o UI-SPEC
// vence (D-01, exceções D-05 a D-08/D-13).
import type { situacaoCotacao } from "@/db/schema";

export type SituacaoCotacao = (typeof situacaoCotacao.enumValues)[number];

export const TITULO_ABA_COTACOES = "Cotações";

// D-09 — os três rótulos de situação, iguais ao protótipo (`selo(st)`).
export const ROTULO_SITUACAO: Record<SituacaoCotacao, string> = {
  cotando: "cotando",
  favorito: "favorito",
  descartado: "descartado",
};

export const ORDEM_DAS_SITUACOES: readonly SituacaoCotacao[] = ["cotando", "favorito", "descartado"];

export type CampoLongoDeCotacao =
  | "diferenciais"
  | "assistencia"
  | "pagamento"
  | "contato"
  | "observacoes"
  | "alertas";

// Os seis campos longos de D-06, rótulo e dica VERBATIM da constante `CAMPOS` do protótipo —
// nesta ordem, que é a ordem do formulário, do detalhe e da comparação. `alerta: true` só em
// `alertas` (D-12): é o único campo que ganha o tratamento vermelho quando preenchido.
export const CAMPOS_LONGOS: readonly {
  id: CampoLongoDeCotacao;
  rotulo: string;
  dica: string;
  alerta?: true;
}[] = [
  { id: "diferenciais", rotulo: "Diferenciais", dica: "o que esse tem que os outros não têm" },
  { id: "assistencia", rotulo: "Assistência técnica", dica: "onde fica, prazo, garantia" },
  { id: "pagamento", rotulo: "Condições de pagamento", dica: "parcelas, desconto à vista, frete" },
  { id: "contato", rotulo: "Contato", dica: "quem, telefone, e-mail" },
  { id: "observacoes", rotulo: "Observações", dica: "" },
  { id: "alertas", rotulo: "Alertas", dica: "o que te deixou em dúvida", alerta: true },
];

// Cabeçalhos de coluna da tabela (UI-SPEC §"Layout & Navigation Contract" / protótipo
// `renderTabela`), nesta ordem.
export const ROTULO_COLUNA_EMPRESA = "Empresa";
export const ROTULO_COLUNA_ESPECIFICACAO = "Especificação";
export const ROTULO_COLUNA_PRECO = "Preço";
export const ROTULO_COLUNA_SITUACAO = "Situação";

// Vocabulário (UI-SPEC §"Copywriting Contract"): nunca "item" solto — a aba "Itens" do módulo já
// usa "item" para outra entidade (a lista de compras).
export const ROTULO_NOVA_COTACAO = "+ Nova cotação";
export const ROTULO_NOVA_CATEGORIA = "+ Nova categoria";
export const ROTULO_COMPARAR_SELECIONADOS = "Comparar selecionados";
export const ROTULO_VOLTAR_A_LISTA = "Voltar à lista";

export const TITULO_DIALOGO_NOVA_COTACAO = "Nova cotação";
export const TITULO_DIALOGO_EDITAR_COTACAO = "Editar cotação";
export const TITULO_DIALOGO_NOVA_CATEGORIA = "Nova categoria";

export const ROTULO_SALVAR_COTACAO = "Salvar";
export const ROTULO_CRIAR_CATEGORIA = "Criar";
export const ROTULO_CANCELAR = "Cancelar";

// Estados vazios (UI-SPEC §"Copywriting Contract" / §"Estados e Comportamento"), verbatim —
// três níveis, D-18 a D-21 retiradas: o comparador sobe vazio, sem importação.
export const FRASE_VAZIO_SEM_CATEGORIA_TITULO = "Nenhuma categoria ainda.";
export const FRASE_VAZIO_SEM_CATEGORIA_CORPO =
  "Crie uma categoria para começar a comparar — fornos, torno, moedor de café…";

export function fraseVazioSemCotacaoCorpo(nomeDaCategoria: string): string {
  return `Adicione a primeira cotação de ${nomeDaCategoria.toLowerCase()}.`;
}
export const FRASE_VAZIO_SEM_COTACAO_TITULO = "Nenhuma cotação aqui ainda.";

export const FRASE_VAZIO_COMPARACAO_TITULO = "Marque pelo menos duas cotações.";
export const FRASE_VAZIO_COMPARACAO_CORPO =
  "Selecione na lista e volte aqui para comparar lado a lado.";

export const FRASE_FALHA_AO_SALVAR =
  "Não deu para salvar. Verifique a internet e tente de novo.";

export function fraseConfirmarRemoverCategoria(nome: string, quantidadeDeCotacoes: number): string {
  if (quantidadeDeCotacoes === 0) {
    return `Excluir a categoria «${nome}»? Ela não tem nenhuma cotação.`;
  }
  if (quantidadeDeCotacoes === 1) {
    return `Excluir a categoria «${nome}»? A cotação dela será perdida.`;
  }
  return `Excluir a categoria «${nome}»? As ${quantidadeDeCotacoes} cotações dela serão perdidas.`;
}

export function fraseConfirmarRemoverCotacao(empresa: string): string {
  return `Excluir a cotação de «${empresa}»? Todas as informações dela serão perdidas.`;
}

export const AVISO_COTACAO_CRIADA = "Cotação adicionada.";
export const AVISO_COTACAO_SALVA = "Alterações salvas.";
export const AVISO_COTACAO_EXCLUIDA = "Cotação excluída.";

export const PLACEHOLDER_CAMPO_PRECO = 'R$ 00.000 — deixe em branco para "sob consulta"';

// Preço nulo (D-07): "—" visualmente, mas o leitor de tela recebe a frase inteira — nunca
// deixá-lo anunciar só o traço.
export const ROTULO_PRECO_SOB_CONSULTA_VISUAL = "—";
export const ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL = "Preço sob consulta";

export const ROTULO_MARCAR_PARA_COMPARAR = (empresa: string) => `Marcar «${empresa}» para comparar`;

export const ROTULO_ALERTA_NA_LINHA = "— tem alerta";
