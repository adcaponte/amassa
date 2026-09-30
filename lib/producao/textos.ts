// As frases da Produção (Fase 06.1), citadas da UI-SPEC (§Copywriting) — zero imports. Quem precisa
// do nome de uma etapa passa o rótulo já escrito (`rotuloDaEtapa`, em `etapas.ts`). Plural de
// verdade: "1 dia", "2 dias" — nunca "dia(s)".

export const TITULO_ERRO = "Algo não funcionou.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";

export const TITULO_PRODUCAO = "Produção";
export const ROTULO_VOLTAR_PRODUCAO = "Voltar à Produção";

// Carregar.
export const FRASE_ERRO_CARREGAR_PRODUCAO =
  "Não deu para carregar a produção. Verifique a internet e tente de novo.";
export const FRASE_ERRO_CARREGAR_ORDEM =
  "Não deu para carregar esta ordem. Verifique a internet e tente de novo.";

// Vazio. Sem botão ainda: o "Nova ordem" do vazio chega com a folha de Nova ordem (plano 07) —
// botão sem destino é defeito.
export const TITULO_PRODUCAO_VAZIA = "Nada em produção agora.";
export const CORPO_PRODUCAO_VAZIA =
  "Uma encomenda aparece aqui sozinha quando o cliente aprova o orçamento. Para produção da casa ou pedido combinado de boca, crie uma ordem.";

// "Terminei".
export function rotuloTerminei(rotuloDaEtapa: string): string {
  return `Terminei: ${rotuloDaEtapa}`;
}
export const ROTULO_MARCANDO = "Marcando…";
export function textoToastTerminei(rotuloFeita: string, rotuloProxima: string): string {
  return `Feito: ${rotuloFeita}. Agora: ${rotuloProxima}.`;
}
export const FRASE_JA_MARCADA =
  "Essa etapa já tinha sido marcada — talvez em outro celular. A tela foi atualizada.";
export const FRASE_FALHA_AO_MARCAR =
  "Não deu para marcar a etapa. Verifique a internet e toque de novo.";
// A ordem mudou de estado entre abrir a tela e tocar (liberada, concluída ou cancelada noutro
// celular) — mesma forma da frase "já tinha sido marcada".
export const FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO =
  "Esta ordem não está mais em andamento — talvez em outro celular. A tela foi atualizada.";
export const FRASE_ULTIMA_ETAPA =
  "A última etapa se conclui pela conclusão da ordem, não por “Terminei”. A tela foi atualizada.";
export const FRASE_ORDEM_NAO_EXISTE = "Esta ordem não existe mais. A tela foi atualizada.";

// Plural.
export function dias(n: number): string {
  return n === 1 ? "1 dia" : `${n} dias`;
}
export function ordens(n: number): string {
  return n === 1 ? "1 ordem" : `${n} ordens`;
}
export function pecas(n: number): string {
  return n === 1 ? "1 peça" : `${n} peças`;
}

// Cartão do quadro.
export function textoDiasNestaEtapa(diasNestaEtapa: number, previsto: number): string {
  return `há ${dias(diasNestaEtapa)} nesta etapa · previsto ${previsto}`;
}
export function textoEntregaNoCartao(diaMes: string): string {
  return `entrega ${diaMes}`;
}
export function textoPecasNoCartao(total: number, aMais: number): string {
  return aMais > 0 ? `${pecas(total)} + ${aMais} a mais` : pecas(total);
}
export const CHIP_DA_CASA = "da casa";

// Quadro.
export function textoCabecalhoDaColuna(rotuloDaColuna: string, quantas: number): string {
  return `${rotuloDaColuna}, ${ordens(quantas)}`;
}
export const SR_COLUNA_VAZIA = "Nenhuma ordem nesta etapa";

// Selo — o tipo é declarado aqui de novo, estruturalmente (zero imports); `Selo` de `leitura.ts`
// cabe nele.
type SeloParaTexto =
  | { tipo: "aguardando-sinal" }
  | { tipo: "vai-atrasar"; dias: number }
  | { tipo: "passou-nesta-etapa"; dias: number }
  | { tipo: "no-ritmo" }
  | { tipo: "encerrada" };

export function textoSelo(selo: SeloParaTexto): string {
  switch (selo.tipo) {
    case "aguardando-sinal":
      return "aguardando o sinal";
    case "vai-atrasar":
      return `vai atrasar ${dias(selo.dias)}`;
    case "passou-nesta-etapa":
      return `+${dias(selo.dias)} nesta etapa`;
    case "no-ritmo":
      return "no ritmo";
    case "encerrada":
      return "encerrada";
  }
}

// Página da ordem — trilha.
export const TITULO_ETAPAS = "Etapas";
export const SR_FEITA = "Feita:";
export const SR_ATUAL = "Etapa atual:";
export const SR_PROXIMA = "Próxima:";
export function textoEtapaFeita(diaMes: string, levou: number | null, previsto: number): string {
  return levou === null
    ? `feita em ${diaMes} · previsto ${previsto}`
    : `feita em ${diaMes} · levou ${dias(levou)}, previsto ${previsto}`;
}
export function textoEtapaAtual(diasNestaEtapa: number, previsto: number): string {
  return `há ${dias(diasNestaEtapa)} · previsto ${previsto}`;
}
export const TEXTO_AINDA_NAO_COMECOU = "ainda não começou";
export function textoEtapaFutura(previsto: number): string {
  return `previsto ${dias(previsto)}`;
}

// Página da ordem — sub-título ("Produção da casa · ordem nº 9 · caminho completo · começou 05/03").
export function textoSubtituloDaOrdem(d: {
  clienteNome: string | null;
  ehDaCasa: boolean;
  numero: number;
  caminhoCompleto: boolean;
  inicioDiaMes: string | null;
  entregaDiaMes: string | null;
}): string {
  const partes = [
    d.ehDaCasa ? "Produção da casa" : d.clienteNome ? `Encomenda de ${d.clienteNome}` : "Encomenda",
    `ordem nº ${d.numero}`,
    d.caminhoCompleto ? "caminho completo" : "termina no biscoito",
    d.inicioDiaMes ? `começou ${d.inicioDiaMes}` : TEXTO_AINDA_NAO_COMECOU,
  ];
  if (d.entregaDiaMes) {
    partes.push(`entrega prometida ${d.entregaDiaMes}`);
  }
  return partes.join(" · ");
}

// Página da ordem — peças.
export const TITULO_PECAS = "Peças";
export function textoLinhaDaPeca(quantidade: number, descricao: string): string {
  return `${quantidade}× ${descricao}`;
}
// "Cor: azul · com o nome gravado · peça exclusiva" (UI-SPEC §Copywriting, "Peça — sub-linha"):
// sem personalização, "sem personalização" no lugar dela; sem cor, o trecho some; peça sem ficha
// ganha " · sem ficha" no fim (e nunca "peça exclusiva" — quem diz se é exclusiva é a ficha).
export function textoSubLinhaDaPeca(peca: {
  cor: string | null;
  personalizacao: string | null;
  temFicha: boolean;
  exclusiva: boolean;
}): string {
  const partes = [
    peca.cor ? `Cor: ${peca.cor}` : null,
    peca.personalizacao ?? "sem personalização",
    peca.temFicha && peca.exclusiva ? "peça exclusiva" : null,
    peca.temFicha ? null : "sem ficha",
  ].filter((parte): parte is string => Boolean(parte));
  return partes.join(" · ");
}
export function textoAMais(aMais: number): string {
  return `+${aMais} a mais`;
}

// Horas de trabalho — o ÚNICO lugar da fase que mostra horas (PRD-05): o bloco "Peças" da ordem.
// Milésimos de hora (a escala de `fichas_precificacao.horas_milesimos`) → "1,2 h", sempre com uma
// casa decimal (o `n1` do protótipo), pt-BR.
export function textoHoras(milesimos: number): string {
  const horas = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(milesimos / 1000);
  return `${horas} h`;
}

// A linha de origem da ordem, em partes — quem desenha põe os links nos trechos do orçamento e da
// venda. "Trabalho estimado: {h} h · veio do orçamento nº {N} · venda nº {M} no Financeiro"; ordem
// sem orçamento: só as horas; nenhuma peça com ficha: "sem estimativa (peça sem ficha)".
export const TEXTO_TRABALHO_ESTIMADO = "Trabalho estimado:";
export const TEXTO_SEM_ESTIMATIVA = "sem estimativa (peça sem ficha)";
export const TEXTO_VEIO_DO = "veio do";
export function textoOrcamentoDaOrigem(numeroDoOrcamento: string): string {
  return `orçamento nº ${numeroDoOrcamento}`;
}
export function textoVendaDaOrigem(numeroDaVenda: number): string {
  return `venda nº ${numeroDaVenda}`;
}
export const TEXTO_NO_FINANCEIRO = "no Financeiro";
// A linha inteira em texto corrido (`null` nas horas = nenhuma peça com ficha).
export function textoOrigemDaOrdem(d: {
  horasMilesimos: number | null;
  orcamentoNumero: string | null;
  documentoNumero: number | null;
}): string {
  const horas = d.horasMilesimos === null ? TEXTO_SEM_ESTIMATIVA : textoHoras(d.horasMilesimos);
  const partes = [`${TEXTO_TRABALHO_ESTIMADO} ${horas}`];
  if (d.orcamentoNumero) {
    partes.push(`${TEXTO_VEIO_DO} ${textoOrcamentoDaOrigem(d.orcamentoNumero)}`);
  }
  if (d.documentoNumero !== null) {
    partes.push(`${textoVendaDaOrigem(d.documentoNumero)} ${TEXTO_NO_FINANCEIRO}`);
  }
  return partes.join(" · ");
}

// As fotos de referência do orçamento, na ordem em que o orçamento as mostra.
export function altDaFotoDeReferencia(n: number, total: number): string {
  return `Foto de referência ${n} de ${total}`;
}

// O link de volta no diálogo do documento do Financeiro (PRD-10, "navegáveis nos dois sentidos").
export const ROTULO_VER_ORDEM_NA_PRODUCAO = "Ver ordem na Produção";

// ---------------------------------------------------------------------------------------------
// "Fazer a mais, de segurança" (plano 04, PRD-08) — só em encomenda (D-15); o cliente nunca vê.
// ---------------------------------------------------------------------------------------------

export const ROTULO_A_MAIS = "fazer a mais, de segurança";
export function ariaLabelAMais(nomeDaPeca: string): string {
  return `Peças a mais de ${nomeDaPeca}`;
}
export const ROTULO_SALVANDO = "Salvando…";
export const FRASE_A_MAIS_INVALIDO = "Diga um número inteiro, zero ou mais.";
export const FRASE_A_MAIS_SO_ENCOMENDA =
  "Na produção da casa todas as boas vão para o estoque — não há peças a mais.";
// A peça sumiu da ordem entre abrir a tela e gravar (id forjado ou ordem refeita) — mesmo molde das
// frases de estado mudado (decidido sem o Theo, plano 04).
export const FRASE_PECA_NAO_EXISTE = "Esta peça não está mais nesta ordem. A tela foi atualizada.";
// A UI-SPEC não traz a frase da falha de rede do "a mais"; mesmo molde das outras (decidido sem o
// Theo, plano 04).
export const FRASE_FALHA_AO_SALVAR_A_MAIS =
  "Não deu para salvar as peças a mais. Verifique a internet e tente de novo.";

// ---------------------------------------------------------------------------------------------
// A trilha na mão (plano 05): desfazer a última (PRD-03), ajustar os dias previstos (PRD-12), o
// parcial (PRD-06) e a previsão de conclusão.
// ---------------------------------------------------------------------------------------------

// Desfazer — a confirmação (UI-D4, `AlertDialog`) diz a data que se perde.
export const ROTULO_DESFAZER_A_ULTIMA = "Desfazer a última";
export const ROTULO_DESFAZER = "Desfazer";
export function ariaLabelDesfazerNaBarra(rotuloDaEtapa: string): string {
  return `Desfazer a última etapa: ${rotuloDaEtapa}`;
}
export function tituloConfirmarDesfazer(rotuloDaEtapa: string): string {
  return `Desfazer: ${rotuloDaEtapa}?`;
}
export function textoConfirmarDesfazer(rotuloDaEtapa: string, feitaEmDiaMes: string): string {
  return `A ${rotuloDaEtapa} volta a ser a etapa atual, e a data em que ela foi marcada como feita (${feitaEmDiaMes}) se perde. Se marcar de novo, vale a data do dia em que marcar.`;
}
export function rotuloConfirmarDesfazer(rotuloDaEtapa: string): string {
  return `Desfazer ${rotuloDaEtapa}`;
}
export const ROTULO_VOLTAR = "Voltar";
export const ROTULO_DESFAZENDO = "Desfazendo…";
export function textoToastDesfeito(rotuloDaEtapa: string): string {
  return `Desfeito: ${rotuloDaEtapa} voltou a ser a etapa atual.`;
}
export const FRASE_JA_DESFEITA = "Essa etapa já tinha sido desfeita. A tela foi atualizada.";
// Nenhuma etapa feita quando o "Desfazer" chegou ao servidor (o botão já estava desabilitado — só
// acontece se outro celular desfez antes). Mesmo molde das frases de estado mudado (decidido sem o
// Theo, plano 05).
export const FRASE_NADA_A_DESFAZER =
  "Nenhuma etapa desta ordem está feita — não há o que desfazer. A tela foi atualizada.";
export const FRASE_FALHA_AO_DESFAZER =
  "Não deu para desfazer. Verifique a internet e tente de novo.";

// Ajuste dos dias previstos — nenhum toast: o número muda na própria linha.
export function ariaLabelUmDiaAMenos(rotuloDaEtapa: string): string {
  return `Um dia a menos em ${rotuloDaEtapa}`;
}
export function ariaLabelUmDiaAMais(rotuloDaEtapa: string): string {
  return `Um dia a mais em ${rotuloDaEtapa}`;
}
export const SR_MINIMO_1_DIA = "mínimo 1 dia";
export const SR_MAXIMO_365_DIAS = "máximo 365 dias";
export const FRASE_FALHA_AO_AJUSTAR =
  "Não deu para mudar os dias previstos. Verifique a internet e tente de novo.";
// A etapa deixou de ser futura (marcada noutro celular) ou o previsto chegou ao limite noutro
// celular — as duas só chegam ao servidor quando a tela está velha (decidido sem o Theo, plano 05).
export const FRASE_AJUSTE_NAO_FUTURA =
  "Esta etapa já começou ou já foi feita — os dias dela valem pelo que aconteceu. A tela foi atualizada.";
export const FRASE_AJUSTE_NO_LIMITE =
  "Os dias previstos de uma etapa vão de 1 a 365. A tela foi atualizada.";

// Parcial — "já passaram [ ] de {total}"; nenhum toast: o número fica no campo e o cartão acompanha.
export const ROTULO_JA_PASSARAM = "já passaram";
export function textoDeTotal(total: number): string {
  return `de ${total}`;
}
export function ariaLabelParcial(rotuloDaEtapa: string, total: number): string {
  return `Quantas peças já passaram pela ${rotuloDaEtapa}, de ${total}`;
}
export function textoParcialInvalido(total: number): string {
  return `Diga um número de 0 a ${total}.`;
}
// A frase do Zod quando o texto não é um inteiro — a ação a troca por `textoParcialInvalido(total)`
// assim que sabe o total; esta só aparece se nem isso der para ler.
export const FRASE_PARCIAL_NAO_INTEIRO = "Diga um número inteiro de peças, de 0 até o total.";
// A etapa atual mudou entre abrir a tela e salvar (marcada ou desfeita noutro celular).
export const FRASE_PARCIAL_ETAPA_MUDOU =
  "A etapa atual mudou — talvez em outro celular. A tela foi atualizada.";
export const FRASE_PARCIAL_ULTIMA_ETAPA =
  "Na última etapa quem conta as peças é a conclusão da ordem. A tela foi atualizada.";
export const FRASE_FALHA_AO_SALVAR_PARCIAL =
  "Não deu para salvar quantas já passaram. Verifique a internet e tente de novo.";
// No cartão do quadro: " · 18 de 30 já passaram" (1: "1 de 30 já passou").
export function textoParcialNoCartao(passaram: number, total: number): string {
  return passaram === 1 ? `1 de ${total} já passou` : `${passaram} de ${total} já passaram`;
}

// Previsão de conclusão (só ordem ativa), embaixo da trilha: "Previsão de conclusão: {dd/mm}" +
// " · {N} dias de folga" / " · {N} dias depois do prometido" (erro, 600) / sem entrega: só a data.
export const TEXTO_PREVISAO_DE_CONCLUSAO = "Previsão de conclusão:";
export type TrechoDaFolga = { tipo: "folga" | "atraso"; texto: string } | null;
export function textoPrevisao(folgaDias: number | null): TrechoDaFolga {
  if (folgaDias === null) {
    return null;
  }
  return folgaDias >= 0
    ? { tipo: "folga", texto: `${dias(folgaDias)} de folga` }
    : { tipo: "atraso", texto: `${dias(-folgaDias)} depois do prometido` };
}
export const DICA_ETAPA_INTEIRA = "A etapa só termina quando todas as peças passaram por ela.";

// ---------------------------------------------------------------------------------------------
// Aguardando o sinal e liberar (plano 03, PRD-11)
// ---------------------------------------------------------------------------------------------

// Seção da página da Produção (id `aguardando-o-sinal`, destino do link do Início).
export const TITULO_SECAO_AGUARDANDO = "Aguardando o sinal";
export const DICA_SECAO_AGUARDANDO =
  "Vieram de orçamento aprovado. Começam a contar quando o sinal for recebido no Caixa — ou quando você decidir começar assim mesmo.";
// Linha 3 do cartão da ordem aguardando: "ainda não começou · entrega 05/03" (sem entrega, só o
// primeiro trecho).
export function textoAguardandoNoCartao(entregaDiaMes: string | null): string {
  return entregaDiaMes
    ? `${TEXTO_AINDA_NAO_COMECOU} · ${textoEntregaNoCartao(entregaDiaMes)}`
    : TEXTO_AINDA_NAO_COMECOU;
}

// Caixa âmbar da página da ordem.
export const FRASE_AGUARDANDO = "Aguardando o sinal. O prazo só começa a contar depois.";

// A linha do sinal, lida da parcela 1 da venda (só leitura — a Produção nunca escreve no Caixa).
// No plano à vista a parcela 1 é o pagamento inteiro da aprovação, não um "sinal".
export function textoSinal(avista: boolean, recebidoEmDiaMes: string | null): string {
  if (avista) {
    return recebidoEmDiaMes
      ? `Pagamento na aprovação: recebido em ${recebidoEmDiaMes}.`
      : "O pagamento da aprovação ainda não consta como recebido no Caixa.";
  }
  return recebidoEmDiaMes
    ? `Sinal recebido no Caixa em ${recebidoEmDiaMes}.`
    : "O sinal ainda não consta como recebido no Caixa.";
}
export const ROTULO_VER_NO_CAIXA = "ver no Caixa";

// Liberar.
export const ROTULO_LIBERAR = "Sinal recebido — começar";
export const ROTULO_COMECAR_ASSIM_MESMO = "Começar assim mesmo";
export const ROTULO_LIBERANDO = "Liberando…";
export const TOAST_LIBERADA = "Ordem liberada. O prazo começa a contar hoje.";
export const FRASE_JA_LIBERADA = "Esta ordem já foi liberada. A tela foi atualizada.";
// Mesmo molde da "já foi liberada" (decidido sem o Theo, plano 03): a ordem foi cancelada entre
// abrir a tela e tocar.
export const FRASE_ORDEM_CANCELADA_ATUALIZADA = "Esta ordem foi cancelada. A tela foi atualizada.";
export const FRASE_FALHA_AO_LIBERAR =
  "Não deu para liberar a ordem. Verifique a internet e tente de novo.";
