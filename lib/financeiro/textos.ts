// As frases fixas e os rótulos do módulo Financeiro — só import de TIPO é permitido aqui (nunca
// `import` de valor), no molde de `lib/queimas/textos.ts`/`lib/abertura/textos.ts`: o módulo não
// lê React, não lê o cliente do banco e não importa `lib/financeiro/formato.ts` — a formatação de
// dinheiro usada em `textoVendaLancada` chega já pronta de quem chama (mesma disciplina de
// `gantt.ts`/`textos.ts` de Encomendas e de `lib/queimas/textos.ts`).
import type { areaFinanceira, formaPagamento, grupoCategoria } from "@/db/schema";

import type { MotivoDaRecusaDaCorrecao, OrigemSemCorrecao } from "./correcao";

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

// As duas abas novas da Fase 04.5 (D-01/D-02), texto exato do dono (04.5-UI-SPEC.md
// §Copywriting) — segunda fileira da barra, ao lado de Cadastros.
export const ROTULO_ABA_ORCAMENTOS = "Orçamentos";
export const ROTULO_ABA_PECAS = "Peças";

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

// "Já recebi"/"Já paguei" — MAIÚSCULO, diferente dos dois de cima: aqueles rotulam a caixa de
// marcação DENTRO da grade de parcelas (Nx/sinal, `LinhaParcela`, texto apertado de coluna); estes
// rotulam a linha PRÓPRIA e compacta do à vista (04.4-12-PLAN.md — a caixinha "já recebi/já
// paguei" nasce marcada e some a grade inteira quando o plano é uma parcela única à vista).
export const ROTULO_JA_RECEBI_AVISTA = "Já recebi";
export const ROTULO_JA_PAGUEI_AVISTA = "Já paguei";
export const ROTULO_VENCE_EM = "Vence em";
// "Fica em 'A receber'/'A pagar' no Caixa até o dinheiro entrar/você registrar o pagamento." — só
// aparece com a caixinha DESMARCADA, ao lado do campo "Vence em" (04.4-12-PLAN.md).
export const DICA_AVISTA_A_RECEBER = 'Fica em "A receber" no Caixa até o dinheiro entrar.';
export const DICA_AVISTA_A_PAGAR = 'Fica em "A pagar" no Caixa até você registrar o pagamento.';

// Dica logo ABAIXO da grade de parcelas (04.4-13-PLAN.md, Tarefa 3 — resposta ao item 4 da
// conferência do dono, 26/09/2026: "não há local para editar o valor da parcela"). O campo já
// existia; faltava dizer que dá para mexer nele. Neutra para dedo e para mouse — o dono conferiu
// nos dois.
export const DICA_PARCELAS_EDITAVEIS = "Dá para mudar o valor e a data de cada parcela.";

// Rótulos MINÚSCULOS e decorativos (`aria-hidden`) acima de cada campo da grade de parcelas — o
// NOME acessível de cada campo continua sendo o `aria-label` descritivo completo já existente
// ("Valor da parcela 1 de 3"), nunca duplicado nem trocado por estes.
export const ROTULO_MINI_VENCE = "vence";
export const ROTULO_MINI_VALOR = "valor";

// Nome acessível do grupo das DUAS escolhas de verdade da Despesa (Compra de material / Outra
// despesa) — no plano 04.4-13 (Tarefa 3), este grupo era distinto do atalho "Pagar conta que já
// existe", que SAIA da tela e ficava FORA dele. O atalho foi REMOVIDO em 26/09/2026 por decisão
// do dono (pareceu inútil e grande no uso real no celular); quem quer pagar uma conta que já
// existe vai por Caixa → "A pagar" → "Paguei" (ver BRIEFING.md §1).
export const ROTULO_GRUPO_MODO_DESPESA = "Tipo de despesa";

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

// "− R$ 1,09 de desconto" — a etiqueta que aparece em toda linha atingida pelo desconto (D-09/
// D-10), qualquer que seja o tipo de linha (item de catálogo, item de "valor na hora" — sem preço
// de tabela — ou valor livre). Antes desta função, o desconto reusava `textoEtiquetaTabela` — a
// conferência do dono de 26/09/2026 (item 11) achou que "tabela R$ 153,00" numa linha de valor
// livre "não fala de desconto nenhum", e em item de "valor na hora" a etiqueta antiga nem
// aparecia. O MECANISMO visual continua um só (mesma pílula); só o TEXTO passa a ser um por
// motivo. `valorFormatado` chega pronto e POSITIVO de `formatarReais` — esta função é quem decide
// o sinal de menos, textos.ts nunca formata dinheiro.
export function textoEtiquetaDesconto(valorFormatado: string): string {
  return `− ${valorFormatado} de desconto`;
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
// Plano 06-08 (D-21): o Estoque está ligado — a frase antiga, que dizia que o efeito só valeria
// "quando o módulo Estoque estiver ligado", ficou falsa.
export const DICA_EFEITO_ESTOQUE = "Ao lançar a venda, isto sai do estoque.";

// O aviso de saldo negativo da Venda (06-UI-SPEC.md §Painel de Venda e de Compra): um material →
// o nome e o saldo final; dois ou mais → quantos, nunca a lista de nomes. Nunca bloqueia (D-06).
// `saldoFinalTexto` chega já formatado ("−1 kg") de `materiaisQueFicamNegativos`.
export function textoAvisoVendaNegativa<T extends { nome: string; saldoFinalTexto: string }>(
  materiais: readonly T[],
): string {
  const fim = "Pode lançar — depois confira a prateleira.";
  if (materiais.length === 1) {
    const [material] = materiais;
    return `Esta venda deixa ${material.nome} com saldo negativo (${material.saldoFinalTexto}). ${fim}`;
  }
  return `Esta venda deixa ${materiais.length} materiais com saldo negativo. ${fim}`;
}
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
// `formatarReais`), este módulo nunca formata dinheiro sozinho. Nunca chamada com o rótulo
// "Todas" — ver `textoTotalDoMes` abaixo.
export function textoTotalFiltrado(rotuloForma: string, valorComSinalFormatado: string): string {
  return `Total em ${rotuloForma} neste mês: ${valorComSinalFormatado}`;
}

// "Total de todas as formas neste mês: + R$ 150,00" — a frase do total quando o filtro do
// extrato é "Todas" (04.4-13-PLAN.md, Tarefa 2: resposta ao item 13 da conferência do dono,
// 26/09/2026 — "aparece a frase com a soma em todas categorias, mas nao na 'todas'"). A palavra
// "mês" é OBRIGATÓRIA: sem ela a frase seria lida como o tile "Saldo em caixa" (que soma saldo
// inicial e meses anteriores, D-12) — este total é só o movimento DESTE mês.
// `valorComSinalFormatado` chega pronto, mesma disciplina de `textoTotalFiltrado`.
export function textoTotalDoMes(valorComSinalFormatado: string): string {
  return `Total de todas as formas neste mês: ${valorComSinalFormatado}`;
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

// A Despesa (04.4-07-PLAN.md): as pílulas do topo, os títulos dos dois modos e os rótulos dos
// campos — o protótipo é a fonte literal de cada frase. A terceira pílula original, "Pagar conta
// que já existe" (link para o Caixa), foi REMOVIDA em 26/09/2026 por decisão do dono — pareceu
// inútil e grande no uso real no celular (BRIEFING.md §1). Quem quer pagar uma conta que já
// existe vai por Caixa → "A pagar" → "Paguei".
export const ROTULO_LANCAR_DESPESA = "Lançar despesa";
export const FRASE_VAZIO_DESPESA_COMPRA = "Toque nos materiais que chegaram.";

export const ROTULO_PILULA_COMPRA = "Compra de material";
export const ROTULO_PILULA_OUTRA = "Outra despesa";

export const TITULO_O_QUE_CHEGOU = "O que chegou";
export const TITULO_ESTA_COMPRA = "Esta compra";
export const TITULO_QUE_DESPESA_E = "Que despesa é";
export const TITULO_PAGAMENTO_DESPESA = "Pagamento";

export const ROTULO_BUSCAR_MATERIAL_DO_ESTOQUE = "Buscar material do estoque";
export const ROTULO_FORNECEDOR_OPCIONAL = "Fornecedor (opcional)";

// O campo "Fornecedor" da Despesa (Fase 06.2, plano 10 — D-04; 06.2-UI-SPEC.md §Copywriting e "Despesa
// do Financeiro — o campo Fornecedor"). O rótulo continua `ROTULO_FORNECEDOR_OPCIONAL`, sem mudança.
// Até 06/10/2026: "Escolha da lista ou escreva o nome" — cortava no celular de 375 px (D-14, achado 19;
// 06.5-UI-SPEC.md §Copywriting). O e2e `polimento-textos` mede que o texto novo cabe no campo.
export const PLACEHOLDER_CAMPO_FORNECEDOR = "Escolha ou escreva o nome";
// No `role="alert"` acima de "Lançar despesa": o fornecedor escolhido foi desativado (ou não existe
// mais) entre abrir o painel e lançar — nada é lançado (Pitfall 15).
export const FRASE_FORNECEDOR_DESATIVADO_NA_DESPESA =
  "Esse fornecedor foi desativado — escolha outro ou deixe em branco.";
// A linha de vínculo embaixo do campo: escolhido da lista (ligado) e escrito sem escolher (texto livre,
// com ao menos um fornecedor ativo no cadastro). Campo vazio: nenhuma linha.
export const FRASE_VINCULO_LIGADO = "Fornecedor do cadastro — esta despesa vai aparecer em “Compras dele”.";
export const FRASE_VINCULO_SO_O_NOME = "Só o nome escrito — não liga a nenhum fornecedor do cadastro.";

// Plano 12 (FRN-12 "em todos os modos"; UI-D2): o rótulo do campo no modo "Outra despesa" — o mesmo
// combobox, porque outra despesa muitas vezes paga quem não é fornecedor (aluguel, conserto).
export const ROTULO_FORNECEDOR_OU_PARA_QUEM_OPCIONAL = "Fornecedor ou para quem (opcional)";
// A linha de vínculo, em `atencao`, quando o texto escrito é igual (sem acento, caixa ou espaços
// extras) ao nome de UM fornecedor ativo e a pessoa não escolheu na lista — o aviso NÃO liga (UI-D4).
export function fraseTextoIgualAoCadastro(texto: string): string {
  return `“${texto}” está no cadastro. Escolha na lista para ligar esta despesa a ele.`;
}
// As mensagens do painel de sugestões, sempre FORA do `listbox` (06.2-UI-SPEC.md, Copywriting).
export const FRASE_CAMPO_CADASTRO_VAZIO =
  "Nenhum fornecedor cadastrado. Escreva o nome — ou cadastre em Cadastros → Fornecedores.";
export function fraseCampoSemResultado(texto: string): string {
  return `Nenhum fornecedor do cadastro com “${texto}”. Fica só o nome escrito.`;
}
export const FRASE_CAMPO_HA_MAIS = "Há mais fornecedores — continue digitando.";
// Embaixo do campo, quando a lista de fornecedores não carregou: o campo vira texto livre.
export const FRASE_CAMPO_FORNECEDORES_NAO_CARREGARAM =
  "Não deu para carregar a lista de fornecedores. Escreva o nome — dá para lançar assim mesmo.";
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
  'O custo de cada unidade sai de "custou ao todo" ÷ quantidade. Ao lançar, isto entra no estoque.';

export const TITULO_TODO_MATERIAL_DE_ESTOQUE = "Todo material de estoque";
export const DICA_LISTA_COMPLETA_COMPRA =
  "Toque no nome para pôr na compra. A ★ escolhe o que aparece como atalho na tela.";

// O Caixa que age (04.4-08-PLAN.md): as listas "A pagar"/"A receber", o cartão de conta, o
// detalhe do documento e o cancelamento que risca sem apagar (FNC-07, FNC-10).
export const ROTULO_VER = "Ver";

// O "ver" de cada linha do extrato (Fase 06.5, `LinhaDeRegistro`): o texto visível continua "ver";
// o nome acessível nomeia a linha — dez "ver" iguais numa lista não dizem a quem pertencem.
export function rotuloVerLinhaDoExtrato(titulo: string): string {
  return `${ROTULO_VER} ${titulo}`;
}

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

// A janela de 30 dias do Caixa (06.5-12, D-03 / UI-D7 — 06.5-UI-SPEC.md §Rótulos, §Ações, §Estados
// vazios), verbatim. `{dd/mm}` chega já formatado de quem chama (este módulo não importa valor).
// Sob o número dos tiles "A receber", "A pagar" e "Se tudo se cumprir" (o "Saldo em caixa" não
// ganha nada).
export function textoJanelaAte(diaMes: string): string {
  return `até ${diaMes}`;
}

// Sob os títulos "A pagar" e "A receber".
export function textoSubtituloDaJanela(diaMes: string): string {
  return `Vencidas e as que vencem até ${diaMes}.`;
}

// O botão no fim de cada lista — plural de verdade; com zero contas depois, o botão nem aparece.
export function rotuloVerDepois(quantidade: number, diaMes: string): string {
  return quantidade === 1
    ? `Ver a que vence depois de ${diaMes}`
    : `Ver as ${quantidade} que vencem depois de ${diaMes}`;
}

// O mesmo botão, com as de depois abertas.
export function rotuloMostrarSoAte(diaMes: string): string {
  return `Mostrar só até ${diaMes}`;
}

// A linha Apoio que separa, na mesma lista, as contas da janela das de depois.
export function textoDepoisDe(diaMes: string): string {
  return `Depois de ${diaMes}`;
}

// Vazios da janela quando há contas depois dela (sem conta nenhuma, valem os dois acima).
export function fraseVazioAPagarNaJanela(diaMes: string): string {
  return `Nada vence até ${diaMes}.`;
}

export function fraseVazioAReceberNaJanela(diaMes: string): string {
  return `Ninguém deve nada até ${diaMes}.`;
}

// O aviso âmbar do mês da janela sem contas fixas geradas (06.5-12, D-03 / UI-D8), verbatim da
// UI-SPEC: manchete com o mês por extenso e o ano; corpo só com o nome do mês, minúsculo no meio
// da frase. O botão usa `rotuloGerarContas` dos Cadastros — a mesma ação, o mesmo rótulo.
export function textoAvisoContasFixasManchete(mesPorExtenso: string): string {
  return `As contas fixas de ${mesPorExtenso} ainda não foram geradas.`;
}

export function textoAvisoContasFixasCorpo(nomeDoMes: string): string {
  return `O que vence em ${nomeDoMes} não aparece em “A pagar” nem conta em “Se tudo se cumprir”.`;
}

export const ROTULO_VER_EM_CONTAS_FIXAS = "ver em Contas fixas";
export const ROTULO_GERANDO_CONTAS = "Gerando…";
// A ação nem respondeu (rede caiu no meio): o aviso continua, e dá para tocar de novo — "Gerar" é
// idempotente no servidor. A recusa da própria ação chega com a frase dela (`resposta.erro`).
export const FRASE_FALHA_AO_GERAR_CONTAS =
  "Não deu para gerar as contas. Verifique a internet e tente de novo.";

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

// O “Corrigir” um lançamento (Fase 06.5, plano 16 — D-18 com a UI-D9 do dono, 05/10/2026), verbatim da
// 06.5-UI-SPEC.md (§Toasts “Correção — lançou”, §Erros “Lançar a correção”, §Rótulos “documento que não se
// corrige por aqui”, UI-D10). Venda e despesa são femininas: só o substantivo muda.

// “Venda nº 33 cancelada e nº 38 lançada no lugar · R$ 70,00” — o toast do sucesso. O total chega já
// formatado (`formatarReais`), como em `textoVendaLancada`: este módulo nunca formata dinheiro sozinho.
export function textoCorrecaoLancada(
  tipo: TipoDeDocumentoParaTexto,
  numeroOriginal: number,
  numeroNova: number,
  totalFormatado: string,
): string {
  const rotulo = tipo === "venda" ? "Venda" : "Despesa";
  return `${rotulo} nº ${numeroOriginal} cancelada e nº ${numeroNova} lançada no lugar · ${totalFormatado}`;
}

// As recusas sob a trava, no erro do painel (`role="alert"`). `origem` tem a frase própria
// (`fraseSemCorrecaoPorOrigem`). `numeroOriginal` nulo = a original não existe (a frase de “não achei”).
// Em `mudou`, a UI-SPEC sugere dizer o que mudou (“uma parcela foi recebida”): o servidor só sabe que a
// versão é outra, então a frase não chuta o motivo.
export function fraseCorrecaoRecusada(
  motivo: Exclude<MotivoDaRecusaDaCorrecao, "origem">,
  tipo: TipoDeDocumentoParaTexto,
  numeroOriginal: number | null,
  numeroNova?: number,
): string {
  const nome = tipo === "venda" ? "venda" : "despesa";
  if (numeroOriginal === null) {
    return `Não achei a ${nome} a corrigir. Volte ao Caixa e toque em “Corrigir esta ${nome}” de novo.`;
  }
  if (motivo === "cancelada") {
    return `Nada foi lançado: a ${nome} nº ${numeroOriginal} já tinha sido cancelada (talvez em outro celular). Os dados continuam aqui — se esta ${nome} ainda vale, toque em “Lançar como ${nome} nova”.`;
  }
  if (motivo === "ja_corrigida") {
    return numeroNova === undefined
      ? `Nada foi lançado: a ${nome} nº ${numeroOriginal} já foi corrigida.`
      : `Nada foi lançado: a ${nome} nº ${numeroOriginal} já foi corrigida pela nº ${numeroNova}.`;
  }
  return `Nada foi lançado: a ${nome} nº ${numeroOriginal} mudou depois que você abriu a correção. Volte ao Caixa e toque em “Corrigir esta ${nome}” de novo, para partir do que vale agora.`;
}

// A falha inesperada (rede, banco) com a correção: a transação desfez tudo, a original continua valendo.
// Sem o número (nem ele deu para ler), “a original”.
export function fraseCorrecaoSemRede(tipo: TipoDeDocumentoParaTexto, numeroOriginal: number | null): string {
  const nome = tipo === "venda" ? "venda" : "despesa";
  const alvo = numeroOriginal === null ? `A ${nome} original` : `A ${nome} nº ${numeroOriginal}`;
  return `Não deu para lançar. ${alvo} continua valendo e nada novo foi gravado — verifique a internet e tente de novo.`;
}

// UI-D10 e as contas fixas: no lugar do “Corrigir” (detalhe) e na recusa `origem` (lançamento).
// `numeroDoOrcamento` chega pronto (“ORC-2026-004”, `numeroDeOrcamento` de lib/orcamentos/formato.ts).
export function fraseSemCorrecaoPorOrigem(
  tipo: TipoDeDocumentoParaTexto,
  origem: OrigemSemCorrecao,
  numeroDoOrcamento?: string | null,
): string {
  const rotulo = tipo === "venda" ? "Esta venda" : "Esta despesa";
  if (origem === "conta_fixa") {
    return `${rotulo} veio das Contas fixas. Para corrigir, cancele aqui e gere o mês de novo em Contas fixas.`;
  }
  const deOnde =
    origem === "agenda"
      ? "da Agenda"
      : origem === "queimas"
        ? "das Queimas"
        : numeroDoOrcamento
          ? `do orçamento ${numeroDoOrcamento}`
          : "de um orçamento";
  return `${rotulo} veio ${deOnde}. Para corrigir, cancele aqui e lance de novo por lá.`;
}

// A tela do “Corrigir” (Fase 06.5, plano 17 — UI-D9), verbatim da 06.5-UI-SPEC.md §Rótulos “faixa da
// correção” e “item que não volta”, §Erros “Abrir a correção”. Vocabulário: “Corrigir”, “original”,
// “cancelada” — nunca “editar” nem “estornar” na tela.

// O botão no detalhe do documento, à esquerda de “Cancelar esta venda/despesa”.
export function rotuloCorrigir(tipo: TipoDeDocumentoParaTexto): string {
  return tipo === "venda" ? "Corrigir esta venda" : "Corrigir esta despesa";
}

// O “Lançar” herdado, com o rótulo que diz o que acontece com a original — é ele a confirmação (UI-D9).
export function rotuloLancarCorrecao(numeroOriginal: number): string {
  return `Lançar e cancelar a nº ${numeroOriginal}`;
}

export function tituloDaFaixaDaCorrecao(tipo: TipoDeDocumentoParaTexto, numeroOriginal: number): string {
  return `Corrigindo a ${tipo === "venda" ? "venda" : "despesa"} nº ${numeroOriginal}`;
}

// O trecho do estoque só entra quando a original mexeu no estoque.
export function linha2DaFaixaDaCorrecao(
  tipo: TipoDeDocumentoParaTexto,
  numeroOriginal: number,
  comEstoque: boolean,
): string {
  const estoque = !comEstoque
    ? ""
    : tipo === "venda"
      ? ", e o material dela volta ao estoque"
      : ", e as entradas de material dela saem do estoque";
  return `A nº ${numeroOriginal} continua valendo até você lançar esta. Ao lançar, ela é cancelada (fica riscada no extrato${estoque}) e esta entra no lugar, com outro número.`;
}

// A 2ª linha da faixa depois de “Lançar como venda/despesa nova” (Fase 06.5, plano 18 — §Erros “a original
// já foi cancelada”): o vínculo saiu, e a faixa diz isso no lugar da explicação do lançamento.
export function linha2DaFaixaDesligada(numeroOriginal: number): string {
  return `A nº ${numeroOriginal} já foi cancelada — esta não está mais ligada a ela.`;
}

// O botão `outline` que só aparece na recusa `cancelada`: tira o vínculo e deixa o “Lançar” herdado.
export function rotuloLancarComoNova(tipo: TipoDeDocumentoParaTexto): string {
  return tipo === "venda" ? "Lançar como venda nova" : "Lançar como despesa nova";
}

export const FRASE_FAIXA_DA_CORRECAO_SAIR = "Se sair sem lançar, nada muda.";
export const ROTULO_VOLTAR_AO_CAIXA = "Voltar ao Caixa";

// A 4ª linha da faixa: o item que não está mais ativo no Catálogo ficou de fora. `nomeOuLista` chega
// pronto (“A e B”, `listaEmPortugues`) — este módulo não importa valor.
export function fraseItensDeForaDaCorrecao(quantidade: number, nomeOuLista: string): string {
  return quantidade === 1
    ? `${nomeOuLista} não está mais ativa no Catálogo e ficou de fora.`
    : `${quantidade} itens não estão mais ativos no Catálogo e ficaram de fora: ${nomeOuLista}.`;
}

// `?corrige=` que aponta para uma original já cancelada (molde `OrigemIndisponivel`).
export function fraseCorrecaoDeCancelada(tipo: TipoDeDocumentoParaTexto, numeroOriginal: number): string {
  const nome = tipo === "venda" ? "venda" : "despesa";
  return `A ${nome} nº ${numeroOriginal} já foi cancelada — não há o que corrigir. Se precisar, lance uma ${nome} nova.`;
}

// O vínculo no detalhe do documento (06.5-UI-SPEC.md §“Corrigir”, passo 5): na original (riscada) e na
// nova.
export function textoCorrigidaPor(tipo: TipoDeDocumentoParaTexto, numeroNova: number): string {
  return `Corrigida pela ${tipo === "venda" ? "venda" : "despesa"} nº ${numeroNova}`;
}

export function textoCorrige(tipo: TipoDeDocumentoParaTexto, numeroOriginal: number): string {
  return `Corrige a ${tipo === "venda" ? "venda" : "despesa"} nº ${numeroOriginal}`;
}

// `?corrige=` que não acha a original (id inválido, inexistente ou de outro tipo).
export function fraseCorrecaoNaoAchada(tipo: TipoDeDocumentoParaTexto): string {
  const nome = tipo === "venda" ? "venda" : "despesa";
  return `Não achei a ${nome} a corrigir. Volte ao Caixa e toque em “Corrigir esta ${nome}” de novo.`;
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

// A tela Mês (04.4-09-PLAN.md, Tarefa 3): quanto cada área deixou, o Geral num bloco só, o
// veredito, o dinheiro que se mexeu e o fora do resultado (FNC-11).
export const TITULO_QUANTO_AREA_DEIXOU = "Quanto cada área deixou";
export const ROTULO_COLUNA_AREA = "Área";
export const ROTULO_COLUNA_VENDEU = "Vendeu";
export const ROTULO_COLUNA_CUSTOU = "Custou";
export const ROTULO_COLUNA_DEIXOU = "Deixou";
export const ROTULO_JUNTAS = "Juntas";

// A segunda fileira de cada área na forma lista do Mês (Fase 06.5, `TabelaResponsiva`): o "Deixou"
// fica à direita da primeira fileira, onde o olho pousa; as duas parcelas da conta vêm embaixo.
// Os dois valores chegam prontos de `formatarReais` (este módulo nunca importa formato.ts).
export function textoVendeuCustou(vendeuFormatado: string, custouFormatado: string): string {
  return `vendeu ${vendeuFormatado} · custou ${custouFormatado}`;
}
export const DICA_CUSTOU_DA_AREA =
  '"Custou" é só o que é daquela área: insumo do café, argila e esmalte, mercadoria da loja. Compra de material conta no mês em que foi comprada.';

export const TITULO_AREAS_PAGAM_A_CASA = "As áreas pagam a casa?";
export const ROTULO_O_QUE_AREAS_DEIXARAM = "O que as áreas deixaram";
export const ROTULO_GERAL_CUSTOS_DA_CASA = "Geral — custos da casa, sem dividir";
export const FRASE_NENHUM_CUSTO_GERAL = "Nenhum custo geral lançado neste mês.";

// "Sobrou R$ 600,00 no mês."/"Faltaram R$ 300,00 para o mês se pagar." — `valorFormatado` já
// chega pronto de `formatarReais` (sempre positivo; o sinal vem de `sobrou`).
export function textoVeredito(sobrou: boolean, valorFormatado: string): string {
  return sobrou ? `Sobrou ${valorFormatado} no mês.` : `Faltaram ${valorFormatado} para o mês se pagar.`;
}

export const TITULO_DINHEIRO_SE_MEXEU = "Dinheiro que se mexeu";
export const ROTULO_ENTROU_NO_CAIXA = "Entrou no caixa";
export const ROTULO_SAIU_DO_CAIXA = "Saiu do caixa";
export const DICA_DINHEIRO_SE_MEXEU =
  "Diferente do quadro acima: aqui conta o dia em que o dinheiro entrou ou saiu, não o dia da venda. Um sinal recebido hoje de uma encomenda de janeiro aparece aqui, não lá.";

export const TITULO_FORA_DO_RESULTADO_MES = "Fora do resultado";
export const DICA_FORA_DO_RESULTADO_MES =
  "Equipamento, parcela de financiamento, aporte e retirada. Mexem no caixa, mas não dizem se o mês foi bom ou ruim.";
export const FRASE_NADA_NESTE_MES = "Nada neste mês.";
