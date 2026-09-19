// As frases fixas e os rótulos do módulo Cadastros — só import de TIPO é permitido aqui (nunca
// `import` de valor), no molde de `lib/financeiro/textos.ts`: o módulo não lê React, não lê o
// cliente do banco. `ROTULO_GRUPO`/`ROTULO_AREA` são a cópia PRÓPRIA deste módulo (D-15: cada
// módulo redeclara, nunca importa de outro — a mesma disciplina que mantém `lib/financeiro` e
// `lib/cadastros` desacoplados apesar de compartilharem o mesmo banco).
import type { areaFinanceira, grupoCategoria } from "@/db/schema";

export type GrupoDeCategoria = (typeof grupoCategoria.enumValues)[number];
export type AreaFinanceira = (typeof areaFinanceira.enumValues)[number];

export const TITULO_MODULO = "Cadastros";

// Rótulos das quatro sub-abas (04.4-UI-SPEC.md §"Dentro de Cadastros (4 sub-abas)").
export const ROTULO_SUB_CATALOGO = "Catálogo";
export const ROTULO_SUB_CATEGORIAS = "Categorias";
export const ROTULO_SUB_FIXAS = "Contas fixas";
export const ROTULO_SUB_TAXAS = "Taxas";

export const ROTULO_GRUPO: Record<GrupoDeCategoria, string> = {
  receita: "Receitas",
  custo: "Custos diretos de uma área",
  geral: "Geral (custos da casa)",
  fora: "Fora do resultado",
};

export const ROTULO_AREA: Record<AreaFinanceira, string> = {
  cafeteria: "Cafeteria",
  espaco: "Espaço",
  pecas: "Peças",
  loja: "Loja",
  geral: "Geral",
};

// Categorias
export const DICA_CATEGORIAS =
  "A categoria já diz de que área é. Por isso você nunca escolhe área ao lançar.";
export const ROTULO_NOVA_CATEGORIA = "+ Nova categoria";
export const ROTULO_EDITAR_CATEGORIA = "Editar";
export const ROTULO_DESATIVAR_CATEGORIA = "Desativar";
export const ROTULO_REATIVAR_CATEGORIA = "Reativar";
export const TITULO_DIALOGO_NOVA_CATEGORIA = "Nova categoria";
export const TITULO_DIALOGO_EDITAR_CATEGORIA = "Editar categoria";
export const ROTULO_NOME = "Nome";
export const ROTULO_TIPO = "Tipo";
export const ROTULO_AREA_CAMPO = "Área";
export const DICA_TRAVADO_POR_USO = "Grupo e área ficam travados depois que a categoria é usada.";
export const ROTULO_CANCELAR = "Cancelar";
export const ROTULO_SALVAR = "Salvar";

// Literal "(s)" — mesma convenção de copy do protótipo para contagem sem distinguir singular de
// plural (UI-SPEC/must_haves do plano citam "N lançamento(s)" ao pé da letra).
export function rotuloLancamentos(quantidade: number): string {
  return `${quantidade} lançamento(s)`;
}

export const FRASE_NOME_REPETIDO = "Já existe uma categoria com esse nome.";
export const FRASE_CATEGORIA_COM_USO =
  "Essa categoria já tem uso — o grupo e a área ficam como estão. Dá para mudar o nome.";
export const FRASE_CATEGORIA_NAO_EXISTE_MAIS =
  "Essa categoria não existe mais. Recarregue a página e tente de novo.";

export const TOAST_CATEGORIA_DESATIVADA = "Categoria desativada.";
export const TOAST_CATEGORIA_REATIVADA = "Categoria reativada.";

// Taxas
export const TITULO_TAXA = "Taxa do cartão";
export const ROTULO_CAMPO_TAXA = "Quanto a maquininha cobra (%)";
export const DICA_TAXA =
  "Vale para as vendas no cartão daqui para a frente. As vendas já lançadas guardam a taxa do dia em que foram feitas. Dinheiro e Pix entram inteiros.";
export const ROTULO_SALVAR_TAXA = "Salvar taxa";
export const FRASE_TAXA_ACIMA_DE_30 = "Confira: uma taxa acima de 30% não parece de maquininha.";

// Estados de página
export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar os Cadastros. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// Estados vazios (04.4-UI-SPEC.md §Copywriting Contract)
export const FRASE_VAZIO_CATEGORIAS_TITULO = "Nenhuma categoria ainda.";
export const FRASE_VAZIO_CATEGORIAS_CORPO =
  "Categorias dizem de que área vêm as vendas e os custos — comece por uma.";

export const FRASE_VAZIO_CATALOGO_TITULO = "Nada no catálogo ainda.";
export const FRASE_VAZIO_CATALOGO_CORPO = "Cadastre o primeiro item que você vende ou compra.";
export const ROTULO_NOVO_ITEM = "+ Novo item";

// Catálogo — cabeçalho e lista (04.4-05-PLAN.md)
export const TITULO_CATALOGO = "O que se vende e o que se estoca";
export const ROTULO_EDITAR_ITEM = "Editar";
export const ROTULO_VALOR_NA_HORA = "valor na hora";
export const ROTULO_SEM_VALOR = "—";
export const ETIQUETA_SO_INSUMO = "só insumo";

export function etiquetaEstoqueEm(unidade: string): string {
  return `estoque em ${unidade}`;
}

// "gasta 15 g de Grão de café + 200 ml de Leite" — junta as partes já formatadas por quem chama
// (textos.ts nunca importa formato.ts nem faz conta — mesma disciplina do resto do projeto).
export function etiquetaGasta(partes: readonly string[]): string {
  return `gasta ${partes.join(" + ")}`;
}

// Catálogo — diálogo do item (04.4-05-PLAN.md)
export const TITULO_DIALOGO_NOVO_ITEM = "Novo item";
export const TITULO_DIALOGO_EDITAR_ITEM = "Editar item";
export const ROTULO_CATEGORIA_DE_VENDA = "Categoria de venda";
export const ROTULO_PRECO_DE_VENDA = "Preço de venda";
export const PLACEHOLDER_PRECO = "vazio = valor na hora";
export const ROTULO_APARECE_NA_VENDA = "Aparece na venda";
export const ROTULO_NOS_MAIS_USADOS = "Nos mais usados";
export const ROTULO_TEM_ESTOQUE_PROPRIO = "Tem estoque próprio";
export const ROTULO_UNIDADE_CAMPO = "Unidade";
export const ROTULO_CATEGORIA_DA_COMPRA = "Categoria da compra";
export const ROTULO_NOS_ATALHOS_DA_COMPRA = "Nos atalhos da compra";
export const ROTULO_SALVAR_ITEM = "Salvar";

// Catálogo — ficha técnica (04.4-05-PLAN.md)
export const TITULO_FICHA_TECNICA = "O que gasta do estoque a cada venda";
export const ROTULO_INSUMO = "Insumo";
export const ROTULO_QUANTIDADE = "Quantidade";
export const PLACEHOLDER_QUANTIDADE = "ex.: 15";
export const ROTULO_ADICIONAR_INSUMO = "Adicionar";
export const ROTULO_TIRAR_INSUMO = "tirar";
export const FRASE_VAZIO_FICHA_TECNICA = "Nada. Este item não mexe em insumo nenhum.";
export const DICA_FICHA_TECNICA =
  "Ex.: Café 200 ml gasta 15 g de grão. Uma bebida pode gastar vários insumos. Item com receita não precisa de estoque próprio.";
export const FRASE_ESCOLHA_INSUMO_E_QUANTIDADE = "Escolha o insumo e a quantidade.";

export const FRASE_CATEGORIA_DE_VENDA_INVALIDA =
  "Essa categoria não é de venda, ou não existe mais. Recarregue a página e tente de novo.";
export const FRASE_CATEGORIA_DE_COMPRA_INVALIDA =
  "Essa categoria não é de compra, ou não existe mais. Recarregue a página e tente de novo.";
export const FRASE_ITEM_NAO_EXISTE_MAIS =
  "Esse item não existe mais. Recarregue a página e tente de novo.";

export const FRASE_VAZIO_FIXAS_TITULO = "Nenhuma conta fixa ainda.";
export const FRASE_VAZIO_FIXAS_CORPO =
  "Cadastre o aluguel, a internet e outras contas que se repetem todo mês.";
export const ROTULO_NOVA_CONTA_FIXA = "+ Nova conta fixa";
