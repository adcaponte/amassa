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
// Quinta sub-aba (D-03, 04.5-02-PLAN.md) — texto exato do dono (04.5-UI-SPEC.md §Copywriting).
export const ROTULO_SUB_PARAMETROS = "Parâmetros";
// Sexta sub-aba (Fase 5, D-01, UI-D20) — o cadastro de pessoas, o mesmo das Pessoas da Agenda. As
// frases da sub-aba moram em `lib/clientes/textos.ts`, o módulo transversal do cadastro.
export const ROTULO_SUB_CLIENTES = "Clientes";
// Sétima sub-aba (Fase 06.2, UI-D1) — quem vende para o ateliê. As frases da sub-aba moram em
// `lib/fornecedores/textos.ts`, o módulo do cadastro.
export const ROTULO_SUB_FORNECEDORES = "Fornecedores";

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

// Desativar/reativar item e a trava da unidade (06-UI-SPEC.md §Cadastros → Catálogo, §Toasts,
// §Confirmação; Pitfall 6). Item nunca se apaga — desativa (D-20, FNC-10).
export const FRASE_ITEM_COM_MOVIMENTACAO =
  "Este item já tem movimentação no Estoque — a unidade e o “Tem estoque próprio” não mudam mais. Se ele saiu de uso, desative.";
export const ROTULO_CHIP_DESATIVADO = "Desativado";
export const ROTULO_DESATIVAR_ITEM = "Desativar item";

// Os itens do sistema da Agenda (Fase 5, D-17; 05-UI-SPEC.md §Cadastros → Catálogo, §Erros) e das
// Queimas (Fase 06.4, D-05: "Queima externa P/M/G"). A frase do erro é a MESMA do `raise` do gatilho
// `travar_item_do_sistema` (0026; reescrito na 0030 com a frase por chave) — a tela mostra estas
// constantes, nunca o texto cru do banco. As da Agenda continuam LITERAIS; quem escolhe entre os dois
// módulos é a CHAVE do item (`linhaDoItemDoSistema`, `fraseDoItemDoSistema`), nunca o nome.
export const CHIP_DO_SISTEMA = "do sistema";
export const LINHA_ITEM_DO_SISTEMA =
  "Usado pela Agenda — não se desativa nem sai da Venda. Nome, preço e categoria podem mudar.";
export const FRASE_ITEM_DO_SISTEMA =
  "Este item é usado pela Agenda e não se desativa. Nome, preço e categoria podem mudar.";
export const LINHA_ITEM_DAS_QUEIMAS =
  "Usado pelas Queimas — não se desativa nem sai da Venda. Nome, preço e categoria podem mudar.";
export const FRASE_ITEM_DAS_QUEIMAS =
  "Este item é usado pelas Queimas e não se desativa. Nome, preço e categoria podem mudar.";

function ehItemDasQueimas(chave: string | null): boolean {
  return chave !== null && chave.startsWith("queima_externa_");
}

// A linha sob o chip "do sistema" no diálogo do item, pela chave. Chave nula → a da Agenda (como antes).
export function linhaDoItemDoSistema(chave: string | null): string {
  return ehItemDasQueimas(chave) ? LINHA_ITEM_DAS_QUEIMAS : LINHA_ITEM_DO_SISTEMA;
}

// A frase da recusa de desativar/tirar da Venda, pela chave do item lido na transação.
export function fraseDoItemDoSistema(chave: string | null): string {
  return ehItemDasQueimas(chave) ? FRASE_ITEM_DAS_QUEIMAS : FRASE_ITEM_DO_SISTEMA;
}
export const ROTULO_REATIVAR_ITEM = "Reativar item";
export const ROTULO_REATIVANDO = "Reativando…";

// Toast do Cadastros ao desativar — sem o "Continua no filtro Desativados." do Estoque: no
// Catálogo não há filtro, o item continua na lista com o chip "Desativado".
export function textoItemDesativado(nome: string): string {
  return `${nome} desativado.`;
}

// Toast do Estoque ao desativar um material (06-UI-SPEC.md §Toasts) — a mesma ação, outra tela.
export function textoMaterialDesativado(nome: string): string {
  return `${nome} desativado. Continua no filtro Desativados.`;
}

export function textoItemReativado(nome: string): string {
  return `${nome} reativado.`;
}

// A confirmação de desativar — a ÚNICA desta fase (06-UI-SPEC.md §Confirmação), partilhada pelo
// Cadastros ("item") e pelo Estoque ("material"). `saldoTexto` já vem formatado por quem chama
// ("1,5 kg") — este módulo nunca formata número.
export type SubstantivoDaDesativacao = "item" | "material";

export function tituloDaDesativacao(nome: string): string {
  return `Desativar ${nome}?`;
}

export function corpoDaDesativacao(movimentacoes: number, saldoTexto: string | null): string {
  const inicio = "Ele some da Venda, da Compra e da lista do Estoque.";
  if (movimentacoes === 0) {
    return `${inicio} Nada é apagado, e dá para reativar quando quiser.`;
  }
  const historico = movimentacoes === 1 ? "1 movimentação" : `${movimentacoes} movimentações`;
  const guardados =
    saldoTexto === null
      ? `O histórico (${historico}) continua guardado`
      : `O histórico (${historico}) e o saldo de ${saldoTexto} continuam guardados`;
  return `${inicio} ${guardados} — nada é apagado — e dá para reativar quando quiser.`;
}

export function rotuloConfirmarDesativacao(substantivo: SubstantivoDaDesativacao): string {
  return `Desativar ${substantivo}`;
}

export const ROTULO_DESATIVANDO = "Desativando…";
export const ROTULO_VOLTAR = "Voltar";
export const ROTULO_ABRIR_CATALOGO = "Abrir Cadastros → Catálogo";

export const FRASE_VAZIO_FIXAS_TITULO = "Nenhuma conta fixa ainda.";
export const FRASE_VAZIO_FIXAS_CORPO =
  "Cadastre o aluguel, a internet e outras contas que se repetem todo mês.";
export const ROTULO_NOVA_CONTA_FIXA = "+ Nova conta fixa";

// Contas fixas — cadastro completo (04.4-10-PLAN.md, D-13)
export const TITULO_CONTAS_FIXAS = "Contas fixas";
export const DICA_CONTAS_FIXAS =
  "Todo mês viram a pagar no Caixa. O valor aqui é o esperado; se a conta vier diferente, você acerta na hora de pagar.";
export const TITULO_DIALOGO_NOVA_CONTA_FIXA = "Nova conta fixa";
export const ROTULO_CATEGORIA_DA_CONTA_FIXA = "Categoria";
export const ROTULO_VALOR_ESPERADO = "Valor esperado";
export const ROTULO_DIA_VENCIMENTO = "Dia de vencimento";
export const ROTULO_DESATIVAR_CONTA_FIXA = "Desativar";
export const ROTULO_REATIVAR_CONTA_FIXA = "Reativar";

export function rotuloVencimentoDaContaFixa(diaVencimento: number, categoriaNome: string): string {
  return `todo dia ${diaVencimento} · ${categoriaNome}`;
}

export const TOAST_CONTA_FIXA_DESATIVADA = "Conta fixa desativada.";
export const TOAST_CONTA_FIXA_REATIVADA = "Conta fixa reativada.";

export const FRASE_CATEGORIA_DA_CONTA_FIXA_INVALIDA =
  "Essa categoria não é válida para conta fixa, ou não existe mais. Recarregue a página e tente de novo.";
export const FRASE_CONTA_FIXA_NAO_EXISTE_MAIS =
  "Essa conta fixa não existe mais. Recarregue a página e tente de novo.";
// Reescrita no 04.4-12-PLAN.md: diz o que fazer, agora que a faixa tem doze meses em vez de um só.
export const FRASE_MES_DE_GERACAO_INVALIDO =
  "Só dá para gerar do mês atual até onze meses à frente — escolha um mês da lista.";
export const ROTULO_MES_DA_GERACAO = "Mês";

// "Gerar as contas de {mês por extenso}" — `mesPorExtenso` já vem formatado por quem chama
// (`nomeDoMes`, lib/financeiro/formato.ts) — este módulo nunca importa `formato.ts`.
export function rotuloGerarContas(mesPorExtenso: string): string {
  return `Gerar as contas de ${mesPorExtenso}`;
}

// "3 conta(s) de janeiro de 2027 criada(s) no Caixa." / "As contas de janeiro de 2027 já
// existiam." — `mesPorExtenso` já formatado por quem chama, mesma disciplina de `rotuloGerarContas`.
export function textoContasGeradas(quantidade: number, mesPorExtenso: string): string {
  if (quantidade === 0) {
    return `As contas de ${mesPorExtenso} já existiam.`;
  }
  return `${quantidade} conta(s) de ${mesPorExtenso} criada(s) no Caixa.`;
}
