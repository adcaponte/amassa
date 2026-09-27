// As frases fixas e os rótulos do módulo Orçamentos — só import de TIPO é permitido aqui (nunca
// `import` de valor), no molde de `lib/financeiro/textos.ts`.

export const TITULO_LISTA_ORCAMENTOS = "Orçamentos";

export const ROTULO_NOVO_ORCAMENTO = "Novo orçamento";
export const ROTULO_ABRIR_ORCAMENTO = "Abrir";

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

// ---------------------------------------------------------------------------------------------
// "Custos do projeto e frete" / "Total e pagamento" / "Só para você" (04.5-07-PLAN.md)
// ---------------------------------------------------------------------------------------------

export const TITULO_CUSTOS_DO_PROJETO = "Custos do projeto e frete";
// Dica verbatim do protótipo (`prototipo.html`, `telaEditor`).
export const DICA_CUSTOS_DE_PROJETO =
  "Molde, protótipo, carimbo, embalagem especial: cobrados uma vez, fora do preço da peça.";
export const ROTULO_O_QUE = "O quê";
export const ROTULO_VALOR = "Valor";
export const ROTULO_MAIS_CUSTO_DE_PROJETO = "+ Custo do projeto";
export const ROTULO_FRETE = "Frete";

export function tituloConfirmarTirarCustoDeProjeto(descricao: string): string {
  return `Tirar «${descricao}» deste orçamento?`;
}
export const CORPO_CONFIRMAR_TIRAR_CUSTO_DE_PROJETO =
  "Ele sai da lista de custos deste orçamento. Você pode adicionar de novo depois, se precisar.";

export const TITULO_TOTAL_E_PAGAMENTO = "Total e pagamento";
export const ROTULO_TOTAL = "Total";
export const ROTULO_COMO_CLIENTE_PAGA = "Como o cliente paga";
export const ROTULO_SINAL_PORCENTO = "Sinal (%)";
export const ROTULO_OBSERVACOES_PARA_CLIENTE = "Observações para o cliente";

// Rótulos do `<select>` "Como o cliente paga" — verbatim do protótipo, na mesma ordem
// (`prototipo.html`, `telaEditor`), indexados pelo próprio valor de
// `lib/orcamentos/plano.ts::PlanoDePagamentoDoOrcamento`.
export const ROTULOS_DO_PLANO_DE_PAGAMENTO: Record<"sinal" | "avista" | "3x", string> = {
  sinal: "Sinal + saldo na entrega",
  avista: "À vista",
  "3x": "3 parcelas",
};

export const TITULO_SO_PARA_VOCE = "Só para você";
export const FRASE_NADA_APARECE_PARA_CLIENTE = "Nada disto aparece para o cliente.";
export const ROTULO_CUSTO_DE_PRODUZIR_TUDO = "Custo de produzir tudo";
export const ROTULO_SOBRA_DEPOIS_DE_IMPOSTO_E_TAXA = "Sobra depois de imposto e taxa";
export const ROTULO_HORAS_DE_TRABALHO = "Horas de trabalho";
export const ROTULO_OCUPA_DO_FORNO = "Ocupa do forno";

// "{N} parâmetro(s) deste cálculo ainda são estimados. O preço é uma boa base, não uma medição."
// — cópia verbatim do must_have (D-17): a contagem vem dos parâmetros vigentes, nunca de um
// número guardado.
export function textoAvisoDeEstimados(quantos: number): string {
  return `${quantos} parâmetro(s) deste cálculo ainda são estimados. O preço é uma boa base, não uma medição.`;
}

// "{X} fornada(s) de biscoito · {Y} de esmalte" — cópia verbatim do protótipo (`telaEditor`,
// bloco "Só para você"); os dois textos já formatados chegam prontos (nunca formata dinheiro nem
// quantidade sozinho — mesma disciplina do resto do módulo).
export function textoFornadasOcupadas(biscoitoTexto: string, esmalteTexto: string): string {
  return `${biscoitoTexto} fornada(s) de biscoito · ${esmalteTexto} de esmalte`;
}

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

// ---------------------------------------------------------------------------------------------
// Validação e recusa do servidor (04.5-07-PLAN.md, Tarefa 2)
// ---------------------------------------------------------------------------------------------

export const FRASE_DESCRICAO_DO_CUSTO_OBRIGATORIA = "Descreva o que é esse custo do projeto.";
export const FRASE_DESCRICAO_DO_CUSTO_MUITO_LONGA = "Essa descrição passa de 120 letras — encurte.";
export const FRASE_VALOR_DO_CUSTO_OBRIGATORIO = "Informe o valor desse custo do projeto.";
export const FRASE_CUSTO_DE_PROJETO_NAO_EXISTE_MAIS =
  "Esse custo de projeto já não está mais neste orçamento — recarregue a página e tente de novo.";

export const FRASE_PLANO_INVALIDO = "Escolha uma das formas de pagamento da lista.";
export const FRASE_SINAL_INVALIDO = 'O "Sinal (%)" precisa ser um número inteiro entre 1 e 100.';
export const FRASE_OBSERVACOES_MUITO_LONGAS = "As observações passam de 300 letras — encurte.";

// ---------------------------------------------------------------------------------------------
// O ciclo de vida do orçamento (04.5-08-PLAN.md) — congelar, recusar, reabrir, duplicar
// ---------------------------------------------------------------------------------------------

export const ROTULO_VER_COMO_CLIENTE_VE = "Ver como o cliente vê";
export const ROTULO_MARCAR_COMO_ENVIADO = "Marcar como enviado";
export const ROTULO_CLIENTE_APROVOU = "Cliente aprovou";
export const ROTULO_RECUSOU = "Recusou";
export const ROTULO_ATUALIZAR_PRECOS = "Atualizar preços";
export const ROTULO_ATUALIZAR_PRECOS_E_REABRIR = "Atualizar preços e reabrir";
export const ROTULO_VOLTAR_PARA_RASCUNHO = "Voltar para rascunho";
export const ROTULO_DUPLICAR = "Duplicar";

// "Para enviar, falta o cliente e ao menos uma peça." (04.5-UI-SPEC.md §Copywriting, verbatim) —
// usada nos dois lados: na tela, sob o botão desabilitado; no servidor, como recusa de
// `marcarComoEnviado` se a tela for contornada.
export const FRASE_FALTA_CLIENTE_E_PECA = "Para enviar, falta o cliente e ao menos uma peça.";

// Frase herdada do protótipo (`telaEditor`, bloco do status aprovado), verbatim.
export const FRASE_APROVADO_EXPLICACAO =
  "Orçamento aprovado fica travado, porque já virou venda. Para refazer com preços novos, use Duplicar: nasce um rascunho com as mesmas peças.";

// As duas ações que ainda não existem nesta fase (chegam nos planos 11/12) — o botão existe,
// desabilitado, com uma nota curta explicando o motivo em vez de um controle morto sem explicação.
// "Atualizar preços" saiu daqui no plano 09: tem ação de verdade, não é mais "em breve".
export const NOTA_VER_CLIENTE_EM_BREVE = "A visualização para o cliente chega em breve.";
export const NOTA_CLIENTE_APROVOU_EM_BREVE = "Registrar a aprovação do cliente chega em breve.";

export const TOAST_ORCAMENTO_ENVIADO = "Marcado como enviado. Preços e custos ficaram congelados.";
export const TOAST_ORCAMENTO_REABERTO = "Voltou para rascunho. O cálculo usa os parâmetros de hoje.";
// Sem copy própria no protótipo/UI-SPEC para a recusa — decisão do executor (ver SUMMARY, "Decidido
// sem o dono"), seguindo o mesmo tom dos demais toasts de transição.
export const TOAST_ORCAMENTO_RECUSADO = "Marcado como recusado.";

export function textoOrcamentoDuplicado(numero: string): string {
  return `Cópia criada como rascunho nº ${numero}.`;
}

// "Calculado com os parâmetros de {data}. Mudar parâmetros depois não altera este orçamento."
// (04.5-UI-SPEC.md §Copywriting, verbatim) — `dataFormatada` já vem pronta de quem chama
// (`formatarDataCurta`, lib/financeiro/formato.ts).
export function textoAvisoCongelado(dataFormatada: string): string {
  return `Calculado com os parâmetros de ${dataFormatada}. Mudar parâmetros depois não altera este orçamento.`;
}

// Recusa das quatro transições (`lib/orcamentos/acoes.ts`) quando o status atual não permite —
// nenhuma delas confia no status que a tela mandou.
export const FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR =
  'Este orçamento está aprovado e não aceita mais mudanças. Para refazer com preços novos, use "Duplicar".';
export const FRASE_ORCAMENTO_NAO_ENVIADO_PARA_RECUSAR =
  "Este orçamento não está enviado — não há como recusar.";
export const FRASE_ORCAMENTO_JA_E_RASCUNHO = "Este orçamento já é um rascunho.";
export const FRASE_PARAMETROS_INDISPONIVEIS_PARA_CONGELAR =
  "Não deu para calcular os parâmetros de hoje. Confira Parâmetros em Cadastros e tente de novo.";

// ---------------------------------------------------------------------------------------------
// "Atualizar preços" (04.5-09-PLAN.md) — compara o mínimo de antes com o de hoje, guarda a
// revisão anterior antes de reabrir (D-23)
// ---------------------------------------------------------------------------------------------

export const FRASE_LISTA_DE_PRECOS_DIVERGENTE =
  "A lista de preços não bate com as peças deste orçamento — recarregue a página e tente de novo.";

// Toasts (04.5-UI-SPEC.md §Copywriting, verbatim, herdados do protótipo).
export const TOAST_PRECOS_ATUALIZADOS = "Preços atualizados.";
export function textoRevisaoCriada(numero: number): string {
  return `Revisão ${numero} criada como rascunho. Confira e marque como enviado.`;
}

// O diálogo (04.5-09-PLAN.md, Tarefa 3) — copy verbatim do protótipo aprovado (`prototipo.html`,
// `folhaAtualizar`, os dois ramos).
export const TITULO_ATUALIZAR_PRECOS = "Atualizar preços";
export const ROTULO_ATUALIZAR = "Atualizar";
export const ROTULO_CANCELAR = "Cancelar";
export const ROTULO_NOVO_PRECO_CADA = "Novo preço, cada";

export const DICA_ATUALIZAR_RASCUNHO =
  "Rascunho: o cálculo já usa os parâmetros de hoje. Aqui você confere cada preço contra o mínimo atual. Onde o preço está abaixo do mínimo, a sugestão sobe até ele.";

export function dicaAtualizarCongelado(dataFormatada: string): string {
  return `Este orçamento foi calculado em ${dataFormatada}. Abaixo, o que mudou com os parâmetros e as fichas de hoje. O preço sugerido mantém a mesma margem que você tinha dado na época. Ajuste o que quiser.`;
}

export const FRASE_NADA_MUDOU_NOS_CUSTOS =
  "Nada mudou nos custos desde então. Atualizar só renova a data e a validade.";

export function dicaAtualizarConfirmarCongelado(novaRevisao: number): string {
  return `Ao confirmar, o orçamento volta a rascunho como revisão ${novaRevisao}, com a data de hoje e a validade renovada. Custos de projeto e frete não mudam sozinhos — confira. O que foi enviado antes fica registrado no histórico.`;
}

export function rotuloMinimoHoje(valorFormatado: string): string {
  return `preço mínimo hoje: ${valorFormatado}`;
}

// Prefixo verbatim do protótipo (`preço mínimo: {antes} → {hoje}`) — os DOIS valores ficam em
// `<span>` separados no componente (cada um com o próprio `data-testid`), para o e2e conferir
// antes/hoje individualmente; esta constante é só o texto fixo entre eles.
export const ROTULO_PRECO_MINIMO_PREFIXO = "preço mínimo:";

export const ROTULO_ESTA_ACIMA = "está acima";
export const ROTULO_ESTA_ABAIXO = "está abaixo";
export const ROTULO_IGUAL = "igual";
export const ROTULO_SEM_RAZAO_ANTERIOR = "sem razão anterior";

export function rotuloSubiu(percentualFormatado: string): string {
  return `subiu ${percentualFormatado}%`;
}
export function rotuloCaiu(percentualFormatado: string): string {
  return `caiu ${percentualFormatado}%`;
}

// "Um orçamento aprovado não tem 'Atualizar preços'" (must_have) — nenhuma frase própria: o botão
// simplesmente não existe nesse status (04.5-UI-SPEC.md, `AcoesDoOrcamento`), a mesma frase de
// `FRASE_APROVADO_EXPLICACAO` já cobre o "por quê".

// Histórico de revisões, no painel "Só para você" (verbatim do protótipo: "Histórico: revisão 1
// de 02/12 · R$ 1.234,00 · revisão 2 de 15/01 · R$ 1.310,00").
export function itemDeHistoricoDeRevisao(
  numero: number,
  dataFormatada: string,
  totalFormatado: string,
): string {
  return `revisão ${numero} de ${dataFormatada} · ${totalFormatado}`;
}
export function textoHistoricoDeRevisoes(itens: string[]): string {
  return `Histórico: ${itens.join(" · ")}`;
}

// ---------------------------------------------------------------------------------------------
// Fotos de referência (04.5-10-PLAN.md) — upload, validação, limite, remoção
// ---------------------------------------------------------------------------------------------

export const TITULO_BLOCO_FOTOS = "Fotos de referência";
// Dica verbatim do protótipo (`prototipo.html`, bloco "Fotos de referência").
export const DICA_FOTOS_DE_REFERENCIA =
  "Até 3 por orçamento. Vão no documento do cliente, para ele confirmar que é aquilo mesmo, e seguem para a Produção.";

// Erro — upload, tipo de arquivo inválido (04.5-UI-SPEC.md §Copywriting, verbatim). Usada nos
// DOIS lados: `lib/orcamentos/fotos.ts::validarTipoRealDaFoto` (servidor) e a tela, que mostra a
// MESMA frase que o servidor devolveu — nunca uma segunda cópia reescrita no componente.
export const FRASE_ARQUIVO_NAO_E_IMAGEM = "Esse arquivo não é uma imagem. Escolha uma foto.";

// Sem cópia verbatim no UI-SPEC/protótipo para este caso específico (a pesquisa e o protótipo
// tratam "até ~15 MB" como o tamanho esperado, não como um teto com frase de recusa própria) —
// decisão do executor (ver SUMMARY, "Decidido sem o dono"), no mesmo tom das demais frases de
// recusa deste módulo: diz o limite e o que fazer, nunca só "arquivo inválido".
export const FRASE_ARQUIVO_MUITO_GRANDE =
  "Essa foto passa de 15 MB. Tire outra ou escolha uma menor.";

// Erro — upload, falha de rede/servidor (04.5-UI-SPEC.md §Copywriting, verbatim) — usada tanto
// quando `anexarFotoDeOrcamento` falha por um motivo que não é "não é imagem" quanto pela
// célula de erro na tela, que reenvia o MESMO arquivo com "Tentar de novo" (`ROTULO_TENTAR_DE_NOVO`,
// já existe desde 04.5-06-PLAN.md).
export const FRASE_FALHA_AO_ENVIAR_FOTO =
  "Não deu para enviar essa foto. Tente outra ou tente de novo.";

// Aviso — limite de fotos (04.5-UI-SPEC.md §Copywriting, verbatim, herdado do protótipo) — vale
// nos DOIS lados: a tela some com o botão ao chegar em 3, e a ação recusa uma quarta com a
// MESMA frase, para o caso (nunca esperado) de duas abas tentarem ao mesmo tempo.
export const FRASE_LIMITE_DE_FOTOS = "Limite de 3 fotos atingido. Tire uma para trocar.";

// A legenda passa de 80 letras — mesmo padrão de `FRASE_COR_MUITO_LONGA`/`FRASE_PERSONALIZACAO_MUITO_LONGA`
// (nenhuma cópia verbatim no UI-SPEC para este caso específico — o teto de 80 caracteres é o
// must_have; a frase de recusa segue o tom do resto do arquivo).
export const FRASE_LEGENDA_MUITO_LONGA = "A legenda passa de 80 letras — encurte.";

// "Essa foto já não está mais neste orçamento" — mesma forma de `FRASE_LINHA_NAO_EXISTE_MAIS`,
// para quando `definirLegendaDaFoto`/`removerFotoDeOrcamento` recebem um id de foto que já não
// existe mais na tabela (recarregar/outra aba apagou primeiro).
export const FRASE_FOTO_NAO_EXISTE_MAIS =
  "Essa foto já não está mais neste orçamento — recarregue a página e tente de novo.";

// Toast — foto anexada (herdado do protótipo) / foto removida (novo, 04.5-UI-SPEC.md
// §Copywriting).
export const TOAST_FOTO_ANEXADA = "Foto de referência anexada.";
export const TOAST_FOTO_REMOVIDA = "Foto removida.";

// Destructive confirmation — remover foto (04.5-UI-SPEC.md §Copywriting, verbatim). Dividida em
// título (a pergunta) + corpo (a consequência) no MESMO ponto da frase — a mesma disciplina de
// `tituloConfirmarTirarLinha`/`CORPO_CONFIRMAR_TIRAR_LINHA` acima: as duas metades aparecem
// juntas na tela, só vivem em constantes separadas porque `AlertDialogTitle`/
// `AlertDialogDescription` são elementos diferentes.
export const TITULO_CONFIRMAR_REMOVER_FOTO = "Remover esta foto de referência?";
export const CORPO_CONFIRMAR_REMOVER_FOTO = "Ela some do orçamento e do documento do cliente.";

// "+ Foto de referência" / "Enviando foto…" (04.5-UI-SPEC.md §Copywriting, verbatim).
export const ROTULO_MAIS_FOTO_DE_REFERENCIA = "+ Foto de referência";
export const ROTULO_ENVIANDO_FOTO = "Enviando foto…";

// Placeholder — legenda da foto (herdado). "referência {N}" é o `alt` genérico quando a foto
// não tem legenda (must_have) — a MESMA frase serve de `alt` e de rótulo visual quando a
// legenda ainda não existe.
export const PLACEHOLDER_LEGENDA_FOTO = "legenda (opcional)";
export function rotuloReferenciaGenerica(numero: number): string {
  return `referência ${numero}`;
}

// "{N} de 3" (herdado) — a contagem ao lado do botão de upload.
export function rotuloContagemDeFotos(quantas: number): string {
  return `${quantas} de 3`;
}

// Empty — Fotos de referência, quando o orçamento não é mais rascunho e não tem nenhuma foto
// (04.5-UI-SPEC.md, herdado) — enquanto rascunho, o botão de upload já ocupa esse lugar, então
// esta frase só aparece fora de rascunho.
export const FRASE_VAZIO_FOTOS = "Nenhuma foto.";

// `aria-label` do controle de upload (herdado, 04.5-UI-SPEC.md ponto 9) — o `<input
// type="file">` nativo fica sobreposto a um botão puramente visual sem texto acessível próprio;
// este rótulo é o que um leitor de tela anuncia.
export const ARIA_ADICIONAR_FOTO_DE_REFERENCIA = "adicionar foto de referência";

// As três respostas de `GET /api/orcamentos/fotos/[id]` (D-27/T-04.5-48/50) — nenhuma delas
// cita caminho de arquivo, nome de diretório ou mensagem do sistema operacional (mesmo espírito
// de `app/api/health/backup/route.ts`).
export const FRASE_NAO_AUTORIZADO = "Não autorizado.";
export const FRASE_FOTO_NAO_ENCONTRADA = "Essa foto não existe.";
export const FRASE_NAO_DEU_PARA_LER_FOTO = "Não deu para ler essa foto.";
