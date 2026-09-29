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

// ---------------------------------------------------------------------------------------------
// A folha completa (plano 06-05) — ajuste, vínculos da saída, peça pronta e a prévia do rodapé.
// ---------------------------------------------------------------------------------------------

// §Ações — o botão de gravar segue o segmento marcado; os segmentos.
export const ROTULO_AJUSTE = "Ajuste";
export const ROTULO_REGISTRAR_AJUSTE = "Registrar ajuste";
export const ROTULO_TROCAR_MATERIAL = "Trocar material";
export function rotuloDoBotaoDeGravar(tipo: "entrada" | "saida" | "ajuste"): string {
  if (tipo === "entrada") {
    return ROTULO_REGISTRAR_ENTRADA;
  }
  return tipo === "saida" ? ROTULO_REGISTRAR_BAIXA : ROTULO_REGISTRAR_AJUSTE;
}
export function rotuloDoAtalho(quantidade: string, unidade: string): string {
  return `Somar ${quantidade} ${unidade}`;
}

// §Rótulos e dicas de campo — o ajuste.
export const ROTULO_CONTADO = "Quanto tem na prateleira agora?";
export function dicaDoContado(unidade: string): string {
  return `em ${unidade} — conte, não calcule a diferença`;
}
export const ROTULO_MOTIVO_AJUSTE = "Por quê?";
export const DICA_MOTIVO_AJUSTE = "opcional, mas ajuda quem ler depois";
export const PLACEHOLDER_MOTIVO_AJUSTE = "Conferência da prateleira";

// §Rótulos e dicas de campo — os vínculos da saída (todos opcionais).
export const ROTULO_VINCULO_TURMA = "Qual turma?";
export const ROTULO_VINCULO_ENCOMENDA = "Qual encomenda?";
export const ROTULO_VINCULO_O_QUE_ACONTECEU = "O que aconteceu?";
export const DICA_VINCULO_OPCIONAL = "opcional";
export const OPCAO_NENHUMA_ENCOMENDA = "Nenhuma";
// §Rótulos e dicas de campo → destinos: a dica abaixo da grade quando "Consumo na cafeteria" está
// marcado (D-15).
export const DICA_CAFETERIA =
  "Só o que não passa por venda — degustação, consumo interno. O que é vendido com ficha técnica já sai pela venda.";

// §Folha de movimentação → Entrada: a nota da compra (UI-D14), para material que NÃO é peça
// pronta — compra de verdade se lança no Financeiro (o Estoque nunca lança nada no Caixa).
export const NOTA_COMPRA_NO_FINANCEIRO =
  "Comprou? Lance em Financeiro → Despesa → Compra de material — ela já dá entrada aqui sozinha.";
export const ROTULO_IR_PARA_COMPRA = "Ir para Compra de material";
// §Rótulos e dicas de campo → custo da peça pronta com ficha (D-22). `custoPorPeca` chega
// formatado ("R$ 12,34").
export function dicaCustoPecaPronta(custoPorPeca: string): string {
  return `Pela ficha de precificação: ${custoPorPeca} por peça. Pode mudar.`;
}

// §Erros — o ajuste e os vínculos.
export const FRASE_CONTADO_VAZIO = "Diga quanto tem na prateleira — pode ser zero.";
// O `check` `movimentacoes_estoque_nota_comprimento` do banco é o mesmo limite, em caracteres.
export const LIMITE_DO_VINCULO = 160;
export const FRASE_VINCULO_LONGO = "Esse texto cabe em até 160 letras — resuma um pouco.";
export const FRASE_ENCOMENDA_FORA_DE_ANDAMENTO =
  "Essa encomenda não está mais em andamento — escolha outra ou deixe em branco.";

// §Pré-visualização — "o saldo passa de X para Y" (rodapé da folha). As partes em destaque são
// montadas por `previaDaMovimentacao` (saldo.ts); aqui só os pedaços de texto.
export const PREVIA_VAZIA = "Digite a quantidade para ver o saldo novo.";
export const PREVIA_SALDO_JA_CERTO = "O saldo já está certo. Nada será gravado.";
export const PREVIA_NEGATIVO = " Isso deixa o saldo negativo — só registre se tiver certeza.";
export function previaAbaixoDoMinimo(minimo: string, unidade: string): string {
  return ` Passa a ficar abaixo do mínimo (${minimo} ${unidade}).`;
}

// §Toasts — o ajuste.
export const TOAST_CONFERIDO = "Conferido. O saldo já estava correto.";
export function textoToastAjuste(dados: { nome: string; diferenca: string; unidade: string }): string {
  return `Ajuste em ${dados.nome}: ${dados.diferenca} ${dados.unidade}.`;
}
// Um vínculo que não chegou como texto (só acontece com pedido forjado — a folha sempre manda texto).
export const FRASE_TEXTO_INVALIDO = "Não deu para entender esse texto. Escreva de novo.";

// ---------------------------------------------------------------------------------------------
// A folha na tela (plano 06-06) — o seletor "Qual material?", a caixa "escolhido" e a barra fixa.
// ---------------------------------------------------------------------------------------------

// §Seletor "Qual material?" (folha) — título e sub ("pela área", não "pela frente" — D-12).
export const TITULO_SELETOR = "Qual material?";
export const SUB_SELETOR = "Filtre pela área ou busque pelo nome";
// §Rótulos e dicas de campo — "Busca do seletor".
export const PLACEHOLDER_BUSCA_SELETOR = "Buscar material";
// §Estados vazios — "Seletor — busca sem resultado" (herdado).
export const TITULO_SELETOR_SEM_RESULTADO = "Nenhum material com esse nome";
export const CORPO_SELETOR_SEM_RESULTADO = "Confira a escrita, ou toque em Tudo.";
// Nenhum material ATIVO para movimentar (todos desativados). A UI-SPEC não tem esta linha: o vazio
// sem nenhum material esconde a barra fixa (plano 06-09); este é o caso raro de só haver
// desativados — frase no molde de "Nenhum material desativado.".
export const TITULO_SELETOR_SEM_ATIVOS = "Nenhum material ativo.";
export const CORPO_SELETOR_SEM_ATIVOS =
  "Material desativado não se movimenta. Reative um pelo filtro Desativados da aba Saldos.";
// "1 material encontrado" / "{N} materiais encontrados" (herdado) — nunca "1 materiais".
export function textoMateriaisEncontrados(quantos: number): string {
  return quantos === 1 ? "1 material encontrado" : `${quantos} materiais encontrados`;
}
// O selo "⚠ {n}" da área leva este texto oculto, para o leitor de tela ler "3 acabando".
export const TEXTO_OCULTO_DO_SELO = " acabando";
// Material cuja categoria de compra sumiu não pode sumir da sanfona (herdado do protótipo).
export const SEM_CATEGORIA = "Sem categoria";

// §Folha de movimentação → caixa "escolhido".
export function textoSaldoDeAgora(saldo: string, unidade: string): string {
  return `saldo de agora: ${saldo} ${unidade}`;
}

// ---------------------------------------------------------------------------------------------
// As abas Histórico e Para onde foi (plano 06-07) — a barra de abas, as linhas do livro, as barras
// por destino, os vazios, os erros e as notas de rodapé.
// ---------------------------------------------------------------------------------------------

// §Layout, item 3 — a barra de abas (neutra, UI-D1).
export const ROTULO_ABA_SALDOS = "Saldos";
export const ROTULO_ABA_HISTORICO = "Histórico";
export const ROTULO_ABA_DESTINO = "Para onde foi";
export const ROTULO_BARRA_DE_ABAS = "Ver";

// §Aba Histórico — as pílulas (herdadas) e o contador. Nunca "1 movimentações".
export const ROTULO_PILULA_HISTORICO_TUDO = "Tudo";
export const ROTULO_PILULA_ENTRADAS = "Entradas";
export const ROTULO_PILULA_SAIDAS = "Saídas";
export const ROTULO_PILULA_AJUSTES = "Ajustes";
export const ROTULO_FILTRAR_HISTORICO = "Filtrar o histórico por tipo";
export function textoContadorDoHistorico(quantas: number): string {
  return quantas === 1 ? "1 movimentação" : `${quantas} movimentações`;
}
// §Ações — "Histórico — paginação".
export const ROTULO_MOSTRAR_MAIS = "Mostrar mais 50";

// §Aba Histórico — a linha 2 de cada tipo (a tabela "Movimentação × Linha 2 × Chips"). Os números
// e os nomes chegam formatados; a junção " · " é de `descreverMovimentacao` (historico.ts).
export const LINHA_VENDIDO = "Vendido";
export const LINHA_ENTRADA = "Entrada";
export const LINHA_PECA_PRONTA = "peça pronta";
export const LINHA_SALDO_INICIAL = "Saldo inicial";
export const LINHA_AJUSTE = "Ajuste de conferência";
export const LINHA_ESTORNO = "Estorno";
export function textoVendaNumero(numero: number): string {
  return `venda nº ${numero}`;
}
export function textoCompraNumero(numero: number): string {
  return `Compra nº ${numero}`;
}
export function textoPagaPor(area: string): string {
  return `paga por ${area}`;
}
export function textoDocumentoCancelado(tipo: "venda" | "compra", numero: number): string {
  return `${tipo} nº ${numero} cancelada`;
}
export function textoContadoNaPrateleira(contado: string, unidade: string): string {
  return `contado ${contado} ${unidade} na prateleira`;
}
export function textoContado(contado: string, unidade: string): string {
  return `contado ${contado} ${unidade}`;
}
export function textoPrecoPorUnidade(reais: string, unidade: string): string {
  return `${reais}/${unidade}`;
}

// §Aba Histórico — os chips da linha. "Estornada" é neutro; "Perda" em erro; "Venda" em sucesso;
// "do Financeiro" com a borda tracejada terracota.
export const CHIP_PERDA = "Perda";
export const CHIP_VENDA = "Venda";
export const CHIP_DO_FINANCEIRO = "do Financeiro";
export const CHIP_ESTORNO = "Estorno";
export const CHIP_ESTORNADA = "Estornada";
export const CHIP_SALDO_INICIAL = "Saldo inicial";

// §Estados vazios — Histórico.
export const TITULO_HISTORICO_VAZIO = "Nada registrado ainda";
export const CORPO_HISTORICO_VAZIO =
  "Toda entrada, saída e ajuste aparece aqui, com quem fez e quando — inclusive o que vem das vendas e compras do Financeiro.";
export const TITULO_HISTORICO_TIPO_VAZIO = "Nada deste tipo ainda.";
export const CORPO_HISTORICO_TIPO_VAZIO = "Toque em Tudo para ver todas as movimentações.";
export const ROTULO_VER_TUDO = "Ver tudo";

// §Erros — as duas abas.
export const FRASE_ERRO_CARREGAR_HISTORICO =
  "Não deu para carregar o histórico. Verifique a internet e tente de novo.";
export const FRASE_ERRO_CARREGAR_DESTINO =
  "Não deu para carregar para onde foi o material. Verifique a internet e tente de novo.";

// §Notas de rodapé — Histórico (1) e (2). Em partes: o destaque em negrito, as palavras em itálico.
export const NOTA_HISTORICO_DESTAQUE = "Nada aqui pode ser apagado nem editado.";
export const NOTA_HISTORICO_ANTES_DO_AJUSTE =
  " O histórico é a única fonte do saldo — se ele pudesse ser reescrito, o saldo deixaria de ser confiável. Errou a quantidade? Registre um ";
export const NOTA_HISTORICO_AJUSTE = "ajuste";
export const NOTA_HISTORICO_DEPOIS_DO_AJUSTE = ": os dois ficam visíveis, e dá para ver o que aconteceu.";
// Reescrita para valer também para compra (D-04).
export const NOTA_FINANCEIRO_DESTAQUE = "As linhas marcadas “do Financeiro” não foram digitadas aqui.";
export const NOTA_FINANCEIRO_ANTES_DO_ESTORNO =
  " Vendas e compras são lançadas no Financeiro, que tira e põe no estoque sozinho. A regra vale igual para elas: ninguém edita nem apaga. Venda ou compra cancelada não some — o Financeiro registra um ";
export const NOTA_FINANCEIRO_ESTORNO = "estorno";
export const NOTA_FINANCEIRO_DEPOIS_DO_ESTORNO = ", e as duas linhas ficam.";

// §Aba Para onde foi — as pílulas do período (herdadas; padrão 30) e o contador.
export const ROTULO_PERIODO_30 = "Últimos 30 dias";
export const ROTULO_PERIODO_90 = "90 dias";
export const ROTULO_PERIODO_TUDO = "Tudo";
export const ROTULO_FILTRAR_PERIODO = "Escolher o período";
export function textoSaidasNoPeriodo(quantas: number): string {
  return quantas === 1 ? "1 saída no período" : `${quantas} saídas no período`;
}
export const ROTULO_MATERIAL_CONSUMIDO = "Material consumido no período";
// D-31: a baixa por venda é a sexta barra.
export const NOME_BARRA_VENDAS = "Vendido · pelo Financeiro";
// A sub-linha de cada barra: "{Área} · {n} saída(s) · {p}% do período"; na de vendas,
// "{n} baixa(s) · {p}% do período"; sem nada, "nenhuma saída".
export const SEM_SAIDA = "nenhuma saída";
export function textoQuantasSaidas(quantas: number): string {
  return quantas === 1 ? "1 saída" : `${quantas} saídas`;
}
export function textoQuantasBaixas(quantas: number): string {
  return quantas === 1 ? "1 baixa" : `${quantas} baixas`;
}
export function textoDoPeriodo(percentual: number): string {
  return `${percentual}% do período`;
}
export function rotuloDaBarra(nome: string, valor: string, percentual: number): string {
  return `${nome}: ${valor}, ${percentual}% do período`;
}

// §Estados vazios — Para onde foi.
export const TITULO_DESTINO_VAZIO = "Nenhuma saída no período";
export const CORPO_DESTINO_VAZIO =
  "Quando você der baixa em algum material, ou quando uma venda tirar insumos do estoque, ele aparece aqui separado por destino.";

// §Notas de rodapé — Para onde foi (topo e rodapé), em partes para o negrito.
export const NOTA_DESTINO_TOPO_ANTES = "Este número diz ";
export const NOTA_DESTINO_TOPO_DESTAQUE = "qual área pagou cada grama de material";
export const NOTA_DESTINO_TOPO_DEPOIS =
  ". Sem o destino na saída, tudo viraria um custo só, e a margem de cada área ficaria errada.";
export const NOTA_DESTINO_RODAPE_DESTAQUE = "Como o valor é calculado.";
export const NOTA_DESTINO_RODAPE_ANTES =
  " Cada saída vale a quantidade vezes o custo médio do material ";
export const NOTA_DESTINO_RODAPE_INSTANTE = "no instante da saída";
export const NOTA_DESTINO_RODAPE_DEPOIS =
  " — o custo médio vem das entradas, que é onde o preço de compra é registrado. Por isso a entrada pergunta quanto custou.";

// ---------------------------------------------------------------------------------------------
// A folha de um material (plano 06-09) — resumo, "Gasto por", o livro dele e o rodapé.
// ---------------------------------------------------------------------------------------------

// §Ações — "Ação do cartão/linha": o nome acessível inclui o material (WCAG 2.5.3).
export const ROTULO_HISTORICO_DO_MATERIAL = "Histórico";
export function rotuloHistoricoDe(nome: string): string {
  return `Histórico de ${nome}`;
}
// §Ações — "Folha do material — rodapé" ("Editar material" encurta para caber a 360px).
export const ROTULO_EDITAR_MATERIAL_CURTO = "Editar";
export const ROTULO_REATIVAR_MATERIAL = "Reativar material";
export const ROTULO_REATIVANDO = "Reativando…";

// §Folha do material → caixa de resumo: "{R$}/{un} · {R$} em estoque · mínimo {m} {un}".
export function textoValorEmEstoque(reais: string): string {
  return `${reais} em estoque`;
}

// §Folha do material → "Gasto por" (EST-20, D-08). Só leitura; a ficha se edita no Catálogo.
export const ROTULO_GASTO_POR = "Gasto por";
export const ROTULO_EDITAR_FICHAS = "Editar fichas em Cadastros → Catálogo";

// §Estados vazios — "Folha do material — sem movimentação".
export const TITULO_MATERIAL_SEM_MOVIMENTACAO = "Nenhuma movimentação";
export const CORPO_MATERIAL_SEM_MOVIMENTACAO =
  "Este material foi cadastrado, mas ainda não entrou nem saiu nada.";

// §Erros — "Carregar a folha do material" (dentro da folha).
export const FRASE_ERRO_CARREGAR_MATERIAL =
  "Não deu para carregar o histórico deste material. Verifique a internet e tente de novo.";

// §Notas de rodapé — "Folha do material". Em partes, para o saldo sair em negrito. Só aparece com
// a lista COMPLETA: com "Mostrar mais 50" à vista, somar a página não dá o saldo e a frase mentiria.
export const NOTA_SOMA_ANTES = "Somando de cima para baixo você chega ao saldo de ";
export const NOTA_SOMA_DEPOIS = ". É assim que o sistema calcula — não há outra fonte.";

// ---------------------------------------------------------------------------------------------
// "+ Novo material" e "Editar material" (plano 06-09) — a mesma validação do Cadastros (EST-13) e
// só o que é do Estoque na edição (D-01).
// ---------------------------------------------------------------------------------------------

// §Ações — "CTA secundário — Estoque, novo material" (UI-D5: "+ Material" na barra fixa).
export const ROTULO_NOVO_MATERIAL = "+ Novo material";
export const ROTULO_NOVO_MATERIAL_CURTO = "+ Material";
export const ROTULO_CADASTRAR_MATERIAL = "Cadastrar material";
export const ROTULO_CADASTRANDO = "Cadastrando…";
export const ROTULO_VOLTAR_AO_ESTOQUE = "Voltar ao estoque";
export const ROTULO_SALVAR_MATERIAL = "Salvar material";
export const ROTULO_SALVANDO = "Salvando…";
export const ROTULO_DESATIVAR_MATERIAL = "Desativar material";

// Títulos das duas folhas (o cabeçalho herdado do protótipo: título e, embaixo, o que é a folha ou
// o nome do material).
export const TITULO_NOVO_MATERIAL = "Novo material";
export const SUB_NOVO_MATERIAL = "O que passa a ser controlado";
export const TITULO_EDITAR_MATERIAL = "Editar material";

// §Rótulos e dicas de campo.
export const ROTULO_NOME_DO_MATERIAL = "Nome";
export const ROTULO_UNIDADE_DO_MATERIAL = "Unidade";
export const DICA_UNIDADE_DO_MATERIAL = "em que você conta este material";
export const ROTULO_CATEGORIA_DA_COMPRA = "Categoria da compra";
export function dicaCategoriaDaCompra(area: string | null): string {
  return area === null ? "diz a área do material" : `diz a área — ${area}`;
}
export const OPCAO_ESCOLHA = "Escolha…";
export function opcaoCategoriaDaCompra(categoria: string, area: string): string {
  return `${categoria} · ${area}`;
}
export const ROTULO_ESTOQUE_MINIMO = "Estoque mínimo";
export const DICA_ESTOQUE_MINIMO = "zero = nunca avisa";
export function dicaEstoqueMinimoEm(unidade: string): string {
  return `em ${unidade} — zero = nunca avisa`;
}
export const ROTULO_OBSERVACOES = "Observações";
export const DICA_OBSERVACOES = "opcional — o que a próxima pessoa precisa saber";
// O `check itens_catalogo_observacoes_comprimento` do banco é o mesmo limite, em caracteres.
export const LIMITE_DAS_OBSERVACOES = 500;

// §Notas de rodapé — "Novo material" (D-17), em partes para o negrito em "contagem".
export const NOTA_NOVO_MATERIAL_ANTES =
  "Não existe campo de saldo aqui. O saldo inicial entra pela ";
export const NOTA_NOVO_MATERIAL_DESTAQUE = "contagem";
export const NOTA_NOVO_MATERIAL_DEPOIS = ", com custo — assim ele nasce dentro do histórico.";
export const LINHA_O_RESTO_FICA_NO_CATALOGO =
  "Preço de venda, atalhos e ficha técnica ficam em Cadastros → Catálogo.";

// §Estados vazios — "Novo material" sem nenhuma categoria de compra ativa (ligado a D-29): a frase
// com o link no lugar do seletor, e o motivo visível ao lado do botão indisponível.
export const FRASE_SEM_CATEGORIA_DE_COMPRA_ANTES =
  "Nenhuma categoria de compra ativa — crie uma em ";
export const ROTULO_LINK_CATEGORIAS = "Cadastros → Categorias";
export const MOTIVO_SEM_CATEGORIA_DE_COMPRA =
  "Sem uma categoria de compra ativa, o material não tem área — crie a categoria primeiro.";

// "Editar material" — o que é do Cadastros aparece para leitura, com o caminho para mudar.
export const ROTULO_CAMPOS_DO_CATALOGO =
  "Nome, unidade e categoria mudam em Cadastros → Catálogo";

// §Erros.
export const FRASE_MINIMO_INVALIDO = "O mínimo precisa ser zero ou mais.";
export const FRASE_OBSERVACOES_LONGAS = "As observações cabem em até 500 letras.";
export const FRASE_FALHA_AO_CADASTRAR =
  "Não deu para cadastrar. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_SALVAR_MATERIAL =
  "Não deu para salvar. Verifique a internet e tente de novo.";

// §Toasts.
export function textoToastMaterialCadastrado(nome: string): string {
  return `${nome} cadastrado. Registre a entrada para dar saldo a ele.`;
}
export const TOAST_MATERIAL_ATUALIZADO = "Material atualizado.";

// ---------------------------------------------------------------------------------------------
// A contagem do estoque e o painel da primeira abertura (plano 06-10) — UI-SPEC §Contagem do
// estoque, §Painel da primeira abertura, §Estados vazios, §Erros.
// ---------------------------------------------------------------------------------------------

// §Ações.
export const ROTULO_CONTAR_ESTOQUE = "Contar estoque";
export const ROTULO_COMECAR_CONTAGEM = "Começar a contagem";
export const ROTULO_CONFIRMAR_CONTAGEM = "Confirmar contagem";
export const ROTULO_GRAVANDO = "Gravando…";
export const ROTULO_CONTAR_DE_NOVO = "Contar de novo";

// §Estados vazios — "Primeira abertura (itens existem, nenhum foi contado)".
export const TITULO_PRIMEIRA_ABERTURA = "Antes de tudo, conte o que tem na prateleira.";
export const CORPO_PRIMEIRA_ABERTURA =
  "O Estoque começa pela contagem: diga quanto tem de cada material e quanto custou. Vendas e compras lançadas antes de hoje não entram. Dá para parar no meio — cada item fica gravado quando você confirma.";
export const FRASE_FALTA_ALGUM_MATERIAL = "Falta algum material?";

// A tela de contagem.
export const TITULO_CONTAGEM = "Contagem do estoque";
export function textoProgressoDaContagem(contados: number, total: number): string {
  return `${contados} de ${total} contados hoje`;
}
export const TITULO_GRUPO_PRIMEIRA = "Ainda sem contagem";
export const FRASE_GRUPO_PRIMEIRA =
  "Conte o que tem na prateleira e diga quanto custou. É daqui que o Estoque começa — vendas e compras de antes não entram.";
export const TITULO_GRUPO_CONFERENCIA = "Conferência";
export const FRASE_GRUPO_CONFERENCIA =
  "Conte e confirme material por material. Só grava o que mudou; se já estava certo, nada é gravado.";
export function textoQuantosMateriais(quantos: number): string {
  return quantos === 1 ? "1 material" : `${quantos} materiais`;
}
export const NOTA_PARAR_NO_MEIO =
  "Dá para parar no meio: cada material fica gravado quando você confirma.";
export function textoEmUnidade(unidade: string): string {
  return `em ${unidade}`;
}
export const ROTULO_BUSCA_CONTAGEM = "Buscar material para contar";

// §Rótulos — os campos da linha.
export const ROTULO_CONTADO_DA_CONTAGEM = "Contado";
export function ariaContadoDaContagem(nome: string, unidade: string): string {
  return `Contado de ${nome}, em ${unidade}`;
}
export const ROTULO_CUSTOU_AO_TODO = "Custou ao todo";
export function ariaCustouAoTodo(nome: string): string {
  return `Quanto custou ao todo ${nome}`;
}
export function dicaCustouAoTodo(diferenca: string, unidade: string): string {
  return `o que você pagou por ${diferenca} ${unidade} — uma estimativa serve se não souber exato`;
}

// §Pré-visualização da contagem (minúscula: é a continuação da linha, não uma frase solta).
export function previaDaContagemTexto(de: string, para: string, unidade: string): string {
  return `o saldo passa de ${de} para ${para} ${unidade}`;
}
export const PREVIA_CONTAGEM_JA_CERTA = "já está certo — nada será gravado";

// Depois de gravar: a linha compacta e o anúncio do leitor de tela.
export function textoContadoGravado(saldo: string, unidade: string, hora: string): string {
  return `✓ Contado: ${saldo} ${unidade} · hoje ${hora}`;
}
export const TEXTO_CONFERIDO_JA_CERTO = "✓ Conferido — já estava certo";
export function anuncioDaContagem(nome: string, de: string, para: string, unidade: string): string {
  return `${nome}: o saldo passou de ${de} para ${para} ${unidade}.`;
}
export function anuncioDaContagemConferida(nome: string): string {
  return `${nome}: conferido, já estava certo.`;
}

// §Estados vazios — contagem.
export const TITULO_NADA_PARA_CONTAR = "Nada para contar.";
export const CORPO_NADA_PARA_CONTAR = "Cadastre o primeiro material e volte aqui.";
export const CORPO_NADA_COM_FILTRO_CONTAGEM = "Tente outro nome, ou toque em Tudo.";

// §Erros — contagem.
export const FRASE_ERRO_CARREGAR_CONTAGEM =
  "Não deu para carregar a contagem. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_GRAVAR_CONTAGEM =
  "Não deu para gravar esta contagem. Verifique a internet e toque em Confirmar contagem de novo.";
export const FRASE_CUSTO_DA_CONTAGEM = "Diga quanto custou — uma estimativa serve.";
// Revisão WR-03: o "Custou ao todo" foi digitado para a diferença contra o saldo da tela, e o saldo
// mudou (uma venda no meio da contagem). A linha recebe o saldo novo e refaz a dica do custo.
export function fraseSaldoMudouNaContagem(de: string, para: string, unidade: string): string {
  return `O saldo mudou de ${de} para ${para} ${unidade} enquanto você contava — confira o custo e confirme de novo.`;
}
// O pedido chegou sem o saldo que a tela mostrava (tela aberta antes de uma atualização do sistema).
export const FRASE_CONTAGEM_DESATUALIZADA =
  "Esta tela da contagem está desatualizada. Recarregue a página e confirme de novo.";
