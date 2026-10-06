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

// Vazio. O "Nova ordem" do vazio é o único terracota da tela — o cabeçalho fica sem o seu (UI-D11).
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

// "Terminei" com a regra da etapa (D-02, UI-D12 — dono, 05/10/2026). Quem decide se pode é
// `podeTerminarEtapa` (`transicoes.ts`); estas só escrevem as frases. `passaram` nulo ou zero = o
// campo parcial está vazio. O rótulo da etapa é feminino em todas ("pela Secagem", "pela Queima de
// biscoito").
//
// O motivo embaixo do "Terminei" desabilitado (Apoio, `tinta-fraca`, ligado por `aria-describedby`).
export function motivoTermineiDesabilitado(
  rotuloDaEtapa: string,
  total: number,
  passaram: number | null,
): string {
  if (passaram === null || passaram <= 0) {
    return `Diga quantas das ${total} peças já passaram pela ${rotuloDaEtapa} — a etapa só termina quando todas passarem.`;
  }
  const faltam = total - passaram;
  return faltam === 1
    ? `Falta 1 das ${total} peças passar pela ${rotuloDaEtapa}.`
    : `Faltam ${faltam} das ${total} peças passarem pela ${rotuloDaEtapa}.`;
}
// A recusa do servidor (tela velha, outro celular): o parcial lido sob a trava não chegou ao total.
export function fraseTermineiRecusado(
  rotuloDaEtapa: string,
  total: number,
  passaram: number | null,
): string {
  const jaPassaram =
    passaram === null || passaram <= 0
      ? "nenhuma passou ainda"
      : passaram === 1
        ? "já passou 1"
        : `já passaram ${passaram}`;
  return `A ${rotuloDaEtapa} só termina quando as ${total} peças passaram por ela — ${jaPassaram}. A tela foi atualizada.`;
}

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
  | { tipo: "encerrada" }
  | { tipo: "cancelada" };

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
    case "cancelada":
      return "cancelada";
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

// ---------------------------------------------------------------------------------------------
// Cancelar a ordem (plano 06, PRD-18) e a venda cancelada no Caixa (D-07)
// ---------------------------------------------------------------------------------------------

export const ROTULO_CANCELAR_ORDEM = "Cancelar ordem";
export const ROTULO_MANTER_ORDEM = "Manter ordem";
export const ROTULO_CANCELANDO = "Cancelando…";
export function tituloConfirmarCancelar(nome: string): string {
  return `Cancelar "${nome}"?`;
}
// O corpo muda por caso (UI-SPEC §Confirmações): quantas baixas ficam, e o que acontece com a venda.
// `vendaNumero` nulo = ordem sem venda (da casa, de boca). `vendaCancelada` = a venda já foi
// cancelada no Caixa (D-07) — aí não há sinal a decidir.
export function textoConfirmarCancelar(d: {
  baixasFeitas: number;
  vendaNumero: number | null;
  vendaCancelada: boolean;
}): string {
  const baixas =
    d.baixasFeitas > 0
      ? `A ordem sai do quadro e fica em Concluídas e canceladas. As baixas de material já feitas (${d.baixasFeitas}) não voltam para o estoque sozinhas.`
      : "A ordem sai do quadro e fica em Concluídas e canceladas. Nenhuma baixa de material foi feita.";
  if (d.vendaNumero === null) {
    return baixas;
  }
  return d.vendaCancelada
    ? `${baixas} A venda nº ${d.vendaNumero} já foi cancelada no Financeiro.`
    : `${baixas} A venda nº ${d.vendaNumero} no Financeiro não é cancelada junto — decida lá o que fazer com o sinal.`;
}
export const TOAST_CANCELADA = "Ordem cancelada. Ela continua em Concluídas e canceladas.";
export const FRASE_JA_ENCERRADA =
  "Esta ordem já foi concluída ou cancelada. A tela foi atualizada.";
export const FRASE_FALHA_AO_CANCELAR =
  "Não deu para cancelar a ordem. Verifique a internet e tente de novo.";

// Resultado da ordem cancelada (caixa neutra — cancelada não é sucesso).
export function textoResultadoCancelada(d: {
  canceladaEmDiaMes: string;
  canceladaPorNome: string | null;
  pelaVendaNumero: number | null;
}): string {
  if (d.pelaVendaNumero !== null) {
    return `Cancelada em ${d.canceladaEmDiaMes}, junto com a venda nº ${d.pelaVendaNumero}.`;
  }
  // A conta de quem cancelou pode ter sido removida (`cancelada_por` sem nome) — a data basta.
  return d.canceladaPorNome
    ? `Cancelada em ${d.canceladaEmDiaMes} por ${d.canceladaPorNome}.`
    : `Cancelada em ${d.canceladaEmDiaMes}.`;
}

// A venda cancelada no Caixa com a ordem já liberada (D-07): o aviso na ordem e o chip no cartão.
export function textoAvisoVendaCancelada(vendaNumero: number): string {
  return `A venda nº ${vendaNumero} foi cancelada no Financeiro. A ordem continua — decida se ela segue ou se cancela.`;
}
export const CHIP_VENDA_CANCELADA = "venda cancelada";

// ---------------------------------------------------------------------------------------------
// "Nova ordem" (plano 07, PRD-09, D-04/D-05/D-11/D-13/D-14) — UI-SPEC §Copywriting.
// ---------------------------------------------------------------------------------------------

export const ROTULO_NOVA_ORDEM = "Nova ordem";
export const TITULO_NOVA_ORDEM = "Nova ordem";
export const ROTULO_NOME_DA_ORDEM = "Nome";
export const PLACEHOLDER_NOME_DA_ORDEM = "ex.: Reposição de canecas";
export const ROTULO_TIPO_DA_ORDEM = "Tipo";
export const ROTULO_TIPO_CASA = "Produção da casa";
export const ROTULO_TIPO_ENCOMENDA = "Encomenda";
export const ROTULO_CAMINHO_DA_ORDEM = "Caminho";
export const ROTULO_CAMINHO_COMPLETO = "Completo, até o esmalte";
export const ROTULO_CAMINHO_BISCOITO = "Termina no biscoito";
export const ROTULO_CLIENTE_DA_ORDEM = "Cliente";
export const ROTULO_ENTREGA_PROMETIDA = "Entrega prometida (opcional)";
export const TITULO_PECAS_DA_NOVA_ORDEM = "Peças";
export const ROTULO_PECA = "Peça";
export const DICA_PECA_ENCOMENDA = "da lista de Peças precificadas, ou escreva o nome";
export const DICA_PECA_CASA =
  "precisa ser do catálogo — a produção da casa termina guardada no estoque";
export const PLACEHOLDER_PECA = "Escolha a peça";
export const GRUPO_PECAS_DE_LINHA = "Peças de linha";
export const GRUPO_PECAS_EXCLUSIVAS = "Peças exclusivas";
export const GRUPO_PECAS_PRECIFICADAS = "Peças precificadas";
export const GRUPO_ITENS_DO_ESTOQUE = "Itens do estoque";
export const OPCAO_OUTRA_PECA = "Outra peça — escrever o nome";
export const ROTULO_NOME_DA_PECA = "Nome da peça";
export const ROTULO_QUANTAS = "Quantas";
export const ROTULO_OUTRA_PECA = "+ outra peça";
export const ROTULO_CRIAR_ORDEM = "Criar ordem";
export const ROTULO_CRIANDO = "Criando…";
export const ROTULO_FECHAR = "Fechar";
// O "X" de tirar (só da 2ª peça em diante): o nome da peça quando já escolhida, o número quando não.
export function ariaTirarPeca(numero: number, nomeDaPeca: string | null): string {
  return nomeDaPeca ? `Tirar ${nomeDaPeca}` : `Tirar a peça ${numero}`;
}
// D-04 / D-14 — embaixo da peça em texto livre ou do item do estoque sem ficha; não bloqueia.
export const NOTA_PECA_SEM_FICHA =
  "Sem ficha de precificação: esta peça fica sem material previsto e fora da estimativa do forno.";
export const FRASE_CATALOGO_VAZIO_CASA =
  "Nenhuma peça no catálogo ainda. Precifique uma peça de linha em Financeiro → Peças, ou ligue o estoque de um item contado em unidades em Cadastros → Catálogo.";
export const FRASE_PECAS_TIRADAS = "As peças que só servem a encomenda foram tiradas.";
// Revisão 06.1, WR-107: enquanto o catálogo carrega, "Criar ordem" fica desligado e diz por quê.
export const FRASE_CATALOGO_CARREGANDO = "Carregando as peças do catálogo…";
export const FRASE_ERRO_CARREGAR_CATALOGO =
  "Não deu para carregar as peças do catálogo. Verifique a internet e tente de novo.";
export const DICA_FIM_NOVA_ORDEM =
  "Encomenda normalmente nasce sozinha, do orçamento aprovado. Aqui é para produção da casa e para o pedido combinado de boca.";
export const TOAST_ORDEM_CRIADA = "Ordem criada.";

// Erros da Nova ordem — embaixo do campo, `role="alert"` (UI-SPEC §Erros). As frases de "passa de N
// letras" seguem as do Orçamento (`lib/orcamentos/textos.ts`).
export const FRASE_NOME_DA_ORDEM_VAZIO = "Dê um nome à ordem.";
export const FRASE_NOME_DA_ORDEM_LONGO = "O nome da ordem passa de 120 letras — encurte.";
export const FRASE_PECA_VAZIA = "Diga qual é a peça.";
export const FRASE_NOME_DA_PECA_LONGO = "O nome da peça passa de 160 letras — encurte.";
export const FRASE_CLIENTE_VAZIO = "Diga para quem é a encomenda.";
export const FRASE_CLIENTE_LONGO = "O nome do cliente passa de 160 letras — encurte.";
export const FRASE_QUANTIDADE_DA_PECA =
  "A quantidade precisa ser um número inteiro de 1 a 100.000.";
export const FRASE_ENTREGA_NO_PASSADO = "A entrega prometida precisa ser hoje ou depois.";
export const FRASE_ENTREGA_INVALIDA = "Essa data não é válida.";
export const FRASE_CASA_PRECISA_DO_CATALOGO =
  "A produção da casa precisa de peça do catálogo — ela termina guardada no estoque.";
export const FRASE_ENCOMENDA_SEM_ITEM =
  "Na encomenda, a peça vem de uma ficha de precificação ou é escrita à mão. Escolha outra.";
export const FRASE_PECA_SAIU_DO_CATALOGO = "Essa peça não está mais no catálogo. Escolha outra.";
// Revisão 06.1, WR-03: a produção da casa guarda peças (1 peça = 1 unidade) — item contado em kg, g,
// ml, L ou m é material. `unidade` chega já escrita (`ROTULO_UNIDADE`).
export function fraseItemNaoGuardaPecas(nome: string, unidade: string): string {
  return `${nome} é contado em ${unidade} no Estoque, e a produção da casa guarda peças inteiras. Escolha um item contado em unidades.`;
}
export function textoPecasDemais(limite: number): string {
  return `Uma ordem cabe até ${limite} peças. Crie outra ordem para o resto.`;
}
export const FRASE_TIPO_INVALIDO = "Escolha se é produção da casa ou encomenda.";
export const FRASE_CAMINHO_INVALIDO = "Escolha o caminho da ordem.";
export const FRASE_FALHA_AO_CRIAR =
  "Não deu para criar a ordem. Nada foi gravado — verifique a internet e tente de novo.";

// ---------------------------------------------------------------------------------------------
// Os três números do topo (plano 08, PRD-13; UI-SPEC §"Três números do topo"). Os rótulos vão em
// caixa alta pelo CSS (`uppercase`) — o leitor de tela lê a palavra, não as letras soltas.
// ---------------------------------------------------------------------------------------------

export const ROTULO_NUMERO_EM_PRODUCAO = "Em produção";
export const ROTULO_NUMERO_FORNO = "Esperando o forno";
export const ROTULO_NUMERO_AGUARDANDO = "Aguardando sinal";
// "3 ordens · 48 peças" (peças = pedido + a mais).
export function textoSubEmProducao(quantasOrdens: number, quantasPecas: number): string {
  return `${ordens(quantasOrdens)} · ${pecas(quantasPecas)}`;
}
// O "≈" é desenho (`aria-hidden`); quem ouve escuta "aproximadamente" (`sr-only`).
export const SIMBOLO_APROXIMADAMENTE = "≈";
export const SR_APROXIMADAMENTE = "aproximadamente";
// Uma casa decimal, pt-BR, sem ",0": 2,5 · 1 · 0,3.
export function formatarFornadas(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(valor);
}
// "1 fornada" · "2,5 fornadas" · "0 fornadas".
export function textoFornadas(valor: number): string {
  return `${formatarFornadas(valor)} ${valor === 1 ? "fornada" : "fornadas"}`;
}
// Os dois trechos da primeira sub-linha, cada um precedido do "≈" pelo componente:
// "≈ 2,5 fornadas de biscoito · ≈ 1 de esmalte".
export function textoFornadasDeBiscoito(valor: number): string {
  return `${textoFornadas(valor)} de biscoito`;
}
export function textoFornadasDeEsmalte(valor: number): string {
  return `${formatarFornadas(valor)} de esmalte`;
}
export const LINHA_ESTIMATIVA_FORNO = "estimativa pelo que cabe no forno";
export function textoPecasSemEstimativa(quantas: number): string {
  return `${pecas(quantas)} sem estimativa — sem ficha ou sem medida`;
}
export const FRASE_FILA_DO_FORNO_VAZIA = "nenhuma fornada na fila";
export const SUB_AGUARDANDO_SINAL = "não contam prazo ainda";
export const ARIA_NUMEROS_DO_TOPO = "Resumo da produção";

// ---------------------------------------------------------------------------------------------
// Filtros do quadro (plano 08, PRD-05) — "Tudo · Encomendas · Da casa"; o filtro não vai para a URL.
// ---------------------------------------------------------------------------------------------

export const ARIA_FILTRAR_ORDENS = "Filtrar ordens";
// Chaves = `FiltroDoQuadro` (lib/producao/quadro.ts), repetidas à mão — este arquivo não importa nada.
export const ROTULO_DO_FILTRO: Readonly<Record<"todas" | "encomenda" | "casa", string>> = {
  todas: "Tudo",
  encomenda: "Encomendas",
  casa: "Da casa",
};
// Filtro sem nenhuma ordem (liberada ou aguardando) — os três números ficam, zerados.
export const TITULO_FILTRO_VAZIO: Readonly<Record<"encomenda" | "casa", string>> = {
  encomenda: "Nenhuma encomenda em andamento.",
  casa: "Nenhuma ordem da casa em andamento.",
};
export const CORPO_FILTRO_VAZIO = "Toque em Tudo para ver todas.";
export const ROTULO_VER_TUDO = "Ver tudo";

// ---------------------------------------------------------------------------------------------
// Concluídas e canceladas (plano 08, UI-D8) — `/gestao/producao/concluidas`.
// ---------------------------------------------------------------------------------------------

export const TITULO_CONCLUIDAS = "Concluídas e canceladas";
// O link embaixo do quadro — só com N > 0.
export function rotuloVerConcluidas(quantas: number): string {
  return `Ver concluídas e canceladas (${quantas})`;
}
export const TITULO_CONCLUIDAS_VAZIA = "Nenhuma ordem concluída ainda.";
export const CORPO_CONCLUIDAS_VAZIA =
  "Quando uma ordem for entregue, guardada no estoque ou cancelada, ela aparece aqui.";
export const FRASE_ERRO_CARREGAR_CONCLUIDAS =
  "Não deu para carregar as ordens concluídas. Verifique a internet e tente de novo.";
export const ROTULO_MOSTRAR_MAIS_50 = "Mostrar mais 50";
export const ROTULO_CARREGANDO = "Carregando…";
export const FRASE_ERRO_CARREGAR_MAIS =
  "Não deu para carregar mais ordens. Verifique a internet e tente de novo.";
export const ROTULO_ABRIR = "Abrir";
export function ariaLabelAbrirOrdem(nome: string): string {
  return `Abrir ${nome}`;
}
export const CHIP_CANCELADA = "cancelada";
export const CHIP_ENTREGA_PARCIAL = "Entrega parcial";
export const ARIA_LISTA_CONCLUIDAS = "Ordens concluídas e canceladas";
// "05/03/2026" a partir de `YYYY-MM-DD` (sem `Date` — o fuso do runtime nunca desloca o dia).
export function formatarDataCompleta(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
// A sub-linha da concluída: "{cliente | da casa} · {b} de {f} peças boas · concluída em {dd/mm/aaaa}".
export function textoSubLinhaConcluida(d: {
  quem: string;
  boas: number | null;
  feitas: number;
  concluidaEm: string;
}): string {
  const partes = [d.quem];
  if (d.boas !== null) {
    partes.push(`${d.boas} de ${d.feitas} ${d.feitas === 1 ? "peça boa" : "peças boas"}`);
  }
  partes.push(`concluída em ${formatarDataCompleta(d.concluidaEm)}`);
  return partes.join(" · ");
}
// A sub-linha da cancelada: "{cliente | da casa} · cancelada em {dd/mm/aaaa}" (+ " junto com a venda").
export function textoSubLinhaCancelada(d: {
  quem: string;
  canceladaEm: string;
  pelaVenda: boolean;
}): string {
  const base = `${d.quem} · cancelada em ${formatarDataCompleta(d.canceladaEm)}`;
  return d.pelaVenda ? `${base} junto com a venda` : base;
}

// ---------------------------------------------------------------------------------------------
// Alternador de vista e linha do tempo (plano 09, PRD-07, D-06) — frases herdadas do protótipo e
// do Gantt das Encomendas (UI-SPEC §Copywriting).
// ---------------------------------------------------------------------------------------------

export const ARIA_ALTERNADOR_VISTA = "Ver a produção como";
// Chaves = `VistaDaProducao` (lib/producao/quadro.ts), repetidas à mão — este arquivo não importa nada.
export const ROTULO_DA_VISTA: Readonly<Record<"quadro" | "tempo", string>> = {
  quadro: "Quadro por etapa",
  tempo: "Linha do tempo",
};
export const ARIA_LINHA_DO_TEMPO = "Linha do tempo das ordens — rola para os lados";
export function srLinhaDeHoje(hojeDiaMes: string): string {
  return `Uma linha vermelha marca hoje, ${hojeDiaMes}.`;
}
// O nome acessível inteiro da coluna fixa (o visível é truncado numa linha): "{nome}: {Etapa atual}, {selo}".
export function ariaLabelLinhaDaOrdem(nome: string, rotuloDaEtapa: string, selo: string): string {
  return `${nome}: ${rotuloDaEtapa}, ${selo}`;
}
// Os segmentos (`role="img"`): feita, atual (o cheio e o listrado dela) e prevista.
export function ariaLabelSegmentoFeito(rotuloDaEtapa: string, feitaEmDiaMes: string, levou: number): string {
  return `${rotuloDaEtapa}: feita em ${feitaEmDiaMes}, levou ${dias(levou)}`;
}
export function ariaLabelSegmentoAtual(rotuloDaEtapa: string, diasNestaEtapa: number, previsto: number): string {
  return `${rotuloDaEtapa}: etapa atual, há ${dias(diasNestaEtapa)}, previsto ${previsto}`;
}
export function ariaLabelSegmentoPrevisto(rotuloDaEtapa: string, previsto: number): string {
  return `${rotuloDaEtapa}: prevista, ${dias(previsto)}`;
}
export function ariaLabelEntregaPrometida(diaMes: string): string {
  return `Entrega prometida: ${diaMes}`;
}
export const LEGENDA_ENTREGA_PROMETIDA = "entrega prometida";
export const LEGENDA_LINHA_DO_TEMPO =
  "cor cheia = já aconteceu · listrado = previsto · linha vertical = hoje";
export const ARIA_LEGENDA_LINHA_DO_TEMPO = "Legenda da linha do tempo";
// Sem nenhuma ordem liberada no filtro atual.
export const TITULO_LINHA_DO_TEMPO_VAZIA = "Nenhuma ordem em andamento.";
export const CORPO_LINHA_DO_TEMPO_VAZIA_COM_AGUARDANDO =
  "As ordens aguardando o sinal entram aqui quando forem liberadas.";
export const CORPO_LINHA_DO_TEMPO_VAZIA_SEM_AGUARDANDO =
  "Crie uma ordem ou aprove um orçamento para ela aparecer aqui.";

// ---------------------------------------------------------------------------------------------
// Material usado e a folha de baixa (plano 10, PRD-14) — UI-SPEC §Copywriting.
// ---------------------------------------------------------------------------------------------

export const TITULO_MATERIAL = "Material usado";
export const DICA_MATERIAL =
  'O previsto vem da ficha de cada peça (gramas × peças feitas, com as a mais). Dar baixa tira do Estoque como "consumo em encomenda", ligado a esta ordem.';
// Chaves = `MaterialDaOrdem` (lib/producao/material.ts), repetidas à mão — este arquivo não importa nada.
export const ROTULO_DO_MATERIAL: Readonly<Record<"argila" | "esmalte", string>> = {
  argila: "Argila",
  esmalte: "Esmalte",
};
// "{X} de {Y}" — os dois pesos já formatados COM a unidade (`textoDePeso`, `./peso`: "850 g" abaixo
// de 1 000 g, "1,25 kg" a partir dele — regra do dono de 30/09/2026): "850 g de 1,25 kg".
export function textoBaixadoDoPrevisto(baixado: string, previsto: string): string {
  return `${baixado} de ${previsto}`;
}
export function textoFaltamDoPrevisto(faltam: string): string {
  return `faltam ${faltam} do previsto`;
}
export function textoGastouAMais(aMais: string): string {
  return `gastou ${aMais} a mais que o previsto`;
}
export const TEXTO_PREVISTO_TODO_BAIXADO = "previsto todo baixado";
export function textoPecasSemFichaNoPrevisto(quantas: number): string {
  return quantas === 1
    ? "1 peça sem ficha não entra no previsto."
    : `${quantas} peças sem ficha não entram no previsto.`;
}
export const FRASE_SEM_MATERIAL_PREVISTO =
  "Sem material previsto: nenhuma peça desta ordem tem ficha de precificação.";
export function textoBaixasEmOutrasUnidades(quantas: number): string {
  return quantas === 1
    ? "1 baixa em outra unidade não entra na conta de kg."
    : `${quantas} baixas em outras unidades não entram na conta de kg.`;
}
export const TITULO_BAIXAS_FEITAS = "Baixas feitas";
// A sub-linha de uma baixa feita: "{dd/mm} · {quem registrou}".
export function textoSubLinhaDaBaixa(diaMes: string, quem: string): string {
  return `${diaMes} · ${quem}`;
}
export const ROTULO_BAIXA_TOTAL = "Baixa total";
export const ROTULO_BAIXA_PARCIAL = "Baixa parcial";
export const ROTULO_BAIXA_DE_OUTRO_MATERIAL = "+ Dar baixa de outro material";
export function ariaLabelBaixa(rotulo: string, material: "argila" | "esmalte"): string {
  return `${rotulo} de ${ROTULO_DO_MATERIAL[material].toLowerCase()}`;
}

// A folha de baixa.
export function tituloDaFolhaDeBaixa(
  modo: "total" | "parcial" | "outro",
  material: "argila" | "esmalte" | null,
): string {
  if (modo === "outro" || material === null) {
    return "Dar baixa de outro material";
  }
  return `${modo === "total" ? ROTULO_BAIXA_TOTAL : ROTULO_BAIXA_PARCIAL} · ${material}`;
}
// "Previsto {X} · já baixado {Y} · faltam {Z}." — os pesos já com a unidade (`textoDePeso`,
// 30/09/2026): "Previsto 4,2 kg · já baixado 850 g · faltam 3,35 kg.". Quando já passou do previsto,
// a última parte diz quanto passou (nunca "faltam 0").
export function textoResumoDaFolhaDeBaixa(d: {
  previsto: string;
  baixado: string;
  faltam: string | null;
  aMais: string | null;
}): string {
  const fim = d.aMais !== null ? `${d.aMais} a mais` : `faltam ${d.faltam ?? "0 g"}`;
  return `Previsto ${d.previsto} · já baixado ${d.baixado} · ${fim}.`;
}
export const ROTULO_QUAL_MATERIAL_DO_ESTOQUE = "Qual material do estoque";
export const ROTULO_ESCOLHER_MATERIAL = "Escolher material";
export const ROTULO_TROCAR_MATERIAL = "Trocar material";
export const ROTULO_QUANTO = "Quanto";
export function dicaDoQuanto(unidade: string): string {
  return `em ${unidade}`;
}
export function dicaUnidadeNaoComparavel(unidade: string): string {
  return `Este material é contado em ${unidade} — digite quanto usou.`;
}
export const DICA_BAIXA_TOTAL =
  'Veio preenchido com o que falta do previsto. Pode ajustar se gastou diferente. A ficha diz "argila" e "esmalte" sem dizer qual — por isso a escolha aqui.';
export const DICA_BAIXA_PARCIAL =
  'A ficha diz "argila" e "esmalte" sem dizer qual — por isso a escolha aqui.';
export const ROTULO_DAR_BAIXA = "Dar baixa";
export const ROTULO_DANDO_BAIXA = "Dando baixa…";
// O toast: "Baixa registrada: {q} {un} de {material}." (+ " O saldo ficou em {−X} {un}.").
export function textoToastBaixaDaOrdem(d: {
  quantidade: string;
  unidade: string;
  nome: string;
  saldoNegativo: string | null;
}): string {
  const base = `Baixa registrada: ${d.quantidade} ${d.unidade} de ${d.nome}.`;
  return d.saldoNegativo ? `${base} O saldo ficou em ${d.saldoNegativo} ${d.unidade}.` : base;
}

// Erros da baixa (embaixo do campo; a folha continua aberta).
export const FRASE_ESCOLHA_O_MATERIAL = "Escolha o material do estoque.";
export function fraseQuantidadeNaUnidade(unidade: string): string {
  return `Digite a quantidade em ${unidade} — por exemplo, 2 ou 0,5.`;
}
export const FRASE_FALHA_AO_DAR_BAIXA =
  "Não deu para dar baixa. Verifique a internet e tente de novo.";
export function fraseMaterialDesativadoNaBaixa(nome: string): string {
  return `${nome} foi desativado enquanto você registrava. Reative-o no Estoque para dar baixa.`;
}
// "Baixa total" recusada sob a trava (revisão 06.1, WR-101): o "total" que a tela calculou já não
// vale. Aparece num toast — a folha fecha e a tela recarrega com o que falta de verdade.
export function fraseBaixaMudouEnquantoPreenchia(material: "argila" | "esmalte"): string {
  return `Outra baixa de ${material} foi registrada enquanto você preenchia — nada foi gravado. A tela foi atualizada: confira o que falta e dê baixa de novo, se precisar.`;
}
// A prévia antes de escolher o material (a folha ainda não sabe de qual saldo falar).
export const TEXTO_ESCOLHA_PARA_VER_O_SALDO = "Escolha o material para ver o saldo novo.";

// ---------------------------------------------------------------------------------------------
// Conclusão da ordem (plano 11, PRD-15/PRD-16/PRD-18 — UI-SPEC §Folha de conclusão, §Copywriting).
// ---------------------------------------------------------------------------------------------

// Recusas do servidor (a folha as mostra; a de estado mudado recarrega a tela).
export const FRASE_CONCLUSAO_JA_CONCLUIDA =
  "Esta ordem já foi concluída — talvez em outro celular. A tela foi atualizada.";
export const FRASE_FALHA_AO_CONCLUIR =
  "Não deu para concluir. Nada foi gravado — verifique a internet e tente de novo.";
export const FRASE_CUSTO_DE_CADA_PECA_VAZIO = "Diga o custo de cada peça — uma estimativa serve.";
export const FRASE_SEM_FICHA_NAO_ENTRA_NO_ESTOQUE =
  "Esta peça não tem ficha, e nesta fase só peça com ficha entra no Estoque. As extras boas ficam sem destino.";
export const FRASE_PECAS_DA_ORDEM_MUDARAM =
  "As peças desta ordem mudaram enquanto você concluía. A tela foi atualizada.";
// D-13 (trocado pelo dono em 30/09/2026): o item sem categoria de compra recebe a escolhida na folha.
export const FRASE_ESCOLHA_A_CATEGORIA_DE_COMPRA = "Escolha a categoria da compra.";
// A escolhida foi desativada (ou deixou de ser de compra) enquanto a folha estava aberta.
export const FRASE_CATEGORIA_DE_COMPRA_INVALIDA_NA_CONCLUSAO =
  "Essa categoria da compra não existe mais, ou foi desativada. Escolha outra.";
// Sob a trava, o item ficou sem categoria de compra e a folha não tinha mostrado o seletor (outro
// celular tirou a categoria dele): a tela recarrega e mostra o seletor.
export function fraseItemFicouSemCategoriaDeCompra(nome: string): string {
  return `${nome} ficou sem categoria da compra enquanto você concluía — talvez em outro celular. A tela foi atualizada: escolha a categoria e conclua de novo.`;
}
export function fraseItemDesativadoNaConclusao(nome: string): string {
  return `${nome} está desativado no Estoque. Reative-o para guardar as peças.`;
}
// Revisão 06.1, WR-03: sob a trava, o item que receberia as peças é contado em outra unidade.
export function fraseItemNaoGuardaPecasNaConclusao(
  nome: string,
  unidade: string,
  tipo: "encomenda" | "casa",
): string {
  const saida =
    tipo === "encomenda"
      ? "mande as extras desta peça para “sem destino”"
      : "cancele esta ordem e crie outra com um item contado em unidades";
  return `${nome} é contado em ${unidade} no Estoque, e a Produção só guarda peças contadas em unidades. Nada foi gravado — ${saida}.`;
}
// O nome exato que a migração 0023 semeou — a folha de conclusão a deixa marcada no seletor do D-13
// quando existe (a consulta tem a sua cópia, `NOME_PRODUCAO_DA_CASA` em `./consultas`).
export const NOME_CATEGORIA_PRODUCAO_DA_CASA = "Produção da casa";
export const FRASE_CONCLUSAO_ETAPA_MUDOU =
  "Esta ordem não está mais na entrega — talvez em outro celular. A tela foi atualizada.";

// A folha de conclusão (Tarefa 3 do plano 11).
export const ROTULO_ENTREGUEI = "Entreguei";
export const ROTULO_GUARDAR_NO_ESTOQUE = "Guardar no estoque";
export function rotuloDoConcluir(tipo: "encomenda" | "casa"): string {
  return tipo === "encomenda" ? ROTULO_ENTREGUEI : ROTULO_GUARDAR_NO_ESTOQUE;
}
export function tituloDaFolhaDeConclusao(tipo: "encomenda" | "casa"): string {
  return tipo === "encomenda" ? "Entrega" : "Guardar no estoque";
}
export const DICA_CONCLUSAO =
  "Diga quantas se perderam no caminho (racharam, escorreu esmalte, quebraram). O resto a tela calcula.";
export function textoPedidoEFeitas(pedido: number, feitas: number): string {
  return `pedido ${pedido} · fez ${feitas}`;
}
export function textoFeitas(feitas: number): string {
  return `fez ${feitas}`;
}
export const ROTULO_QUANTAS_SE_PERDERAM = "Quantas se perderam";
export function ariaQuantasSePerderam(nomeDaPeca: string): string {
  return `Quantas se perderam de ${nomeDaPeca}`;
}
export const ROTULO_ENTREGUES_AO_CLIENTE = "Entregues ao cliente";
export const ROTULO_EXTRAS_BOAS = "Extras boas";
export const ROTULO_BOAS = "Boas";
export const ROTULO_PERDIDAS = "Perdidas";
export function textoParteDeTotal(parte: number, total: number): string {
  return `${parte} de ${total}`;
}
export function textoPerdidasDeFeitas(perdidas: number, feitas: number): string {
  return `${perdidas} de ${feitas} feitas`;
}
export function textoFaltamParaCompletar(faltam: number): string {
  return `Faltam ${faltam} para completar o pedido. Dá para concluir como entrega parcial, ou voltar e produzir mais.`;
}
export function rotuloDestinoDasExtras(extras: number): string {
  return extras === 1 ? "O que fazer com a 1 extra boa" : `O que fazer com as ${extras} extras boas`;
}
export const ROTULO_ENTRAM_NO_ESTOQUE = "Entram no Estoque como pronta entrega";
export function textoCustoPelaFicha(reais: string): string {
  return `custo ${reais} cada, pela ficha`;
}
export const TEXTO_VOCE_DIZ_O_CUSTO = "você diz o custo abaixo";
export const ROTULO_SEM_DESTINO = "Sem destino";
export const TEXTO_NAO_VOU_VENDER = "não vou vender";
export const TEXTO_EXCLUSIVA_NAO_VOU_VENDER = "peça exclusiva, não vou vender";
// D-12: a peça em texto livre não tem ficha — as extras ficam sem destino, e a tela diz por quê.
export function textoExtrasSemFicha(extras: number): string {
  return extras === 1
    ? "A 1 extra boa fica sem destino: esta peça não tem ficha, e nesta fase só peça com ficha entra no Estoque."
    : `As ${extras} extras boas ficam sem destino: esta peça não tem ficha, e nesta fase só peça com ficha entra no Estoque.`;
}
// D-14: o custo quando a ficha não dá (UI-D12 — por peça, com a prévia do total).
export const ROTULO_CUSTO_DE_CADA_PECA = "Custo de cada peça";
export const DICA_CUSTO_SEM_FICHA =
  "Esta peça não tem ficha de precificação — diga quanto custou cada uma, para o Estoque saber quanto ela vale.";
export const DICA_CUSTO_FICHA_NAO_CALCULA =
  "A ficha desta peça não dá um custo hoje (falta parâmetro ou ela não cabe no forno) — diga quanto custou cada uma.";
export function textoPreviaDoCusto(boas: number, cada: string, total: string): string {
  return `${boas} × ${cada} = ${total} entram no Estoque`;
}
// D-12 (plano 12): a extra boa de peça EXCLUSIVA que vai para o Estoque passa pelo passo que a torna
// peça de linha — a categoria de venda e o preço vêm preenchidos ("Peças prontas" e o preço
// praticado da ficha), e a promoção é a mesma da Precificação (`promoverFichaParaLinha`).
export const TITULO_TRANSFORMAR_EM_LINHA = "Transformar em peça de linha";
export const TEXTO_TRANSFORMAR_EM_LINHA =
  "Para entrar no Estoque, a peça precisa estar no catálogo. Ela deixa de ser exclusiva e passa a ser peça de linha, com preço de venda — vai aparecer na Venda.";
export const ROTULO_CATEGORIA_DE_VENDA = "Categoria de venda";
export const PLACEHOLDER_CATEGORIA_DE_VENDA = "Escolha a categoria";
export const ROTULO_PRECO_DE_VENDA = "Preço de venda";
export const DICA_PRECO_DE_VENDA = "é o preço que vai aparecer na Venda";
// O nome exato que a migração 0016 semeou — a folha a deixa escolhida quando existe.
export const NOME_CATEGORIA_PECAS_PRONTAS = "Peças prontas";
export const FRASE_PRECO_DE_VENDA_VAZIO = "Diga o preço de venda — é o que vai aparecer na Venda.";
export const FRASE_ESCOLHA_A_CATEGORIA_DE_VENDA = "Escolha a categoria de venda.";
// A categoria escolhida foi desativada (ou saiu de Receitas) enquanto a folha estava aberta — a
// mesma frase da Precificação (cada módulo com a sua cópia).
export const FRASE_CATEGORIA_DE_VENDA_INVALIDA =
  "Essa categoria de venda não existe mais, ou não é do grupo Receitas. Escolha outra.";
// D-13: o item da peça ainda não controla estoque — a conclusão o liga. Trocado pelo dono em
// 30/09/2026: o item que já tem categoria de compra fica com ela (`categoria` = o nome dela); o que
// não tem (`null`) recebe a escolhida no seletor logo abaixo.
export function textoItemVaiControlarEstoque(item: string, categoria: string | null): string {
  return categoria === null
    ? `${item} ainda não controla estoque. Ao concluir, ele passa a controlar (em unidades, na categoria da compra escolhida abaixo). Vai passar a aparecer no Estoque.`
    : `${item} ainda não controla estoque. Ao concluir, ele passa a controlar (em unidades, categoria ${categoria}). Vai passar a aparecer no Estoque.`;
}
// O seletor do D-13 na peça: o mesmo rótulo e as mesmas opções "{categoria} · {área}" do
// "+ Novo material" do Estoque. Na peça exclusiva promovida (D-12), a dica diz que o item é novo.
export const ROTULO_CATEGORIA_DA_COMPRA = "Categoria da compra";
export const DICA_CATEGORIA_DA_COMPRA = "onde as peças vão aparecer no Estoque";
export const DICA_CATEGORIA_DA_COMPRA_DA_PROMOVIDA =
  "a peça de linha nova passa a controlar estoque em unidades — é onde ela vai aparecer no Estoque";
export const OPCAO_ESCOLHA_A_CATEGORIA_DA_COMPRA = "Escolha…";
export const FRASE_SEM_CATEGORIA_DE_COMPRA_ATIVA =
  "Não há nenhuma categoria da compra ativa. Crie uma em Cadastros → Categorias e volte para concluir.";
export function opcaoCategoriaDaCompraNaConclusao(categoria: string, area: string): string {
  return `${categoria} · ${area}`;
}
// As notas do fim da folha.
const FRASE_PERDA_MEDIDA =
  'As perdidas desta ordem entram na perda medida que aparece ao lado do parâmetro "perda", em Cadastros → Parâmetros — é essa perda que paga as peças feitas a mais.';
export function textoNotaDaEncomenda(vendaNumero: number | null): string {
  return vendaNumero === null
    ? FRASE_PERDA_MEDIDA
    : `O saldo a receber continua no Caixa (venda nº ${vendaNumero}). ${FRASE_PERDA_MEDIDA}`;
}
export function textoNotaDaCasa(boas: number): string {
  return boas === 1
    ? "A 1 boa entra no Estoque como pronta entrega."
    : `As ${boas} boas entram no Estoque como pronta entrega.`;
}
export const ROTULO_CONCLUIR_ORDEM = "Concluir ordem";
export const ROTULO_CONCLUIR_PARCIAL = "Concluir como entrega parcial";
export const ROTULO_CONCLUINDO = "Concluindo…";
// O toast: "Ordem entregue." / "Ordem concluída." + as peças no Estoque + os itens ligados (D-13).
export function textoToastConclusao(d: {
  tipo: "encomenda" | "casa";
  pecasNoEstoque: number;
  itensLigados: readonly string[];
}): string {
  const partes = [d.tipo === "encomenda" ? "Ordem entregue." : "Ordem concluída."];
  if (d.pecasNoEstoque > 0) {
    partes.push(
      d.pecasNoEstoque === 1
        ? "1 peça entrou no Estoque como pronta entrega."
        : `${d.pecasNoEstoque} peças entraram no Estoque como pronta entrega.`,
    );
  }
  for (const item of d.itensLigados) {
    partes.push(`${item} passou a aparecer no Estoque.`);
  }
  return partes.join(" ");
}
// O resultado da concluída (caixa `sucesso`): uma linha por peça, trechos zerados omitidos, a casa
// sem "entregues"; e "{N} dias do início ao fim.".
export function textoResultadoDaPeca(d: {
  descricao: string;
  tipo: "encomenda" | "casa";
  entregues: number;
  paraEstoque: number;
  semDestino: number;
  perdidas: number;
  feitas: number;
}): string {
  const partes: string[] = [];
  if (d.tipo === "encomenda" && d.entregues > 0) {
    partes.push(d.entregues === 1 ? "1 entregue" : `${d.entregues} entregues`);
  }
  if (d.paraEstoque > 0) {
    partes.push(`${d.paraEstoque} para o estoque`);
  }
  if (d.semDestino > 0) {
    partes.push(`${d.semDestino} sem destino`);
  }
  if (d.perdidas > 0) {
    partes.push(
      d.perdidas === 1 ? `1 perdida de ${d.feitas}` : `${d.perdidas} perdidas de ${d.feitas}`,
    );
  }
  return `${d.descricao}: ${partes.length > 0 ? partes.join(" · ") : `nenhuma de ${d.feitas}`}`;
}
export function textoDiasDoInicioAoFim(n: number): string {
  return `${dias(n)} do início ao fim.`;
}
export const SELO_CONCLUIDA = "concluída";

// ---------------------------------------------------------------------------------------------
// A perda medida em Cadastros → Parâmetros (plano 12, D-08 — UI-SPEC §"Cadastros → Parâmetros —
// perda medida", §Estados vazios, §Erros). Só leitura: nenhum botão troca o parâmetro.
// ---------------------------------------------------------------------------------------------

export const TITULO_PERDA_MEDIDA = "Perda medida nos últimos 6 meses";
export const FRASE_PERDA_SEM_MEDIDA = "Ainda sem medida: nenhuma ordem concluída nos últimos 6 meses.";
export const FRASE_PERDA_MEDIDA_ERRO = "Não deu para carregar a perda medida.";

// "{p} de {f} peças feitas se perderam, em {n} ordens concluídas. As extras sem destino não entram
// nesta conta. O parâmetro continua sendo trocado aqui, à mão." — plural de verdade ("1 ordem
// concluída", "1 de 1 peça feita", "1 … se perdeu").
export function textoExplicacaoDaPerdaMedida(perdidas: number, feitas: number, ordens: number): string {
  const pecasFeitas = feitas === 1 ? "peça feita" : "peças feitas";
  const verbo = perdidas === 1 ? "se perdeu" : "se perderam";
  const ordensConcluidas = ordens === 1 ? "1 ordem concluída" : `${ordens} ordens concluídas`;
  return `${perdidas} de ${feitas} ${pecasFeitas} ${verbo}, em ${ordensConcluidas}. As extras sem destino não entram nesta conta. O parâmetro continua sendo trocado aqui, à mão.`;
}

// "4,0%" a partir de 400 pontos-base — uma casa, meio-para-cima, em inteiros (nunca `toFixed`
// sobre ponto flutuante).
export function textoPercentualDaPerdaMedida(pontosBase: number): string {
  const decimos = Math.floor((pontosBase + 5) / 10);
  return `${Math.floor(decimos / 10)},${decimos % 10}%`;
}

// ---------------------------------------------------------------------------------------------
// As folhas A4 (plano 13, PRD-19/PRD-20 — UI-SPEC §"Folhas A4", §Copywriting). A folha da ordem
// não tem nenhuma frase de dinheiro: é folha de bancada.
// ---------------------------------------------------------------------------------------------

export const ROTULO_IMPRIMIR_FOLHA = "Imprimir folha";
export const ROTULO_IMPRIMIR_FOLHA_GERAL = "Imprimir folha geral";
export const ROTULO_VOLTAR_ORDEM = "Voltar à ordem";
export const FRASE_ERRO_MONTAR_FOLHA =
  "Não deu para montar a folha. Verifique a internet e tente de novo.";

// A marca das duas folhas.
export const MARCA_DA_FOLHA = "AMASSA CERRADO";
export const SUB_MARCA_DA_FOLHA = "ateliê · produção";

// O rodapé das duas folhas (herdado, PRD-20), com a data do dia em que a folha foi impressa.
export function textoRodapeDaFolha(impressaEm: string): string {
  return `${MARCA_DA_FOLHA} · folha impressa em ${impressaEm} · o que vale é o que está na plataforma`;
}

// Folha da ordem — cabeçalho.
export function textoOlhoDaOrdem(tipo: "encomenda" | "casa", numero: number): string {
  return `${tipo === "casa" ? "Produção da casa" : "Encomenda"} · ordem nº ${numero}`;
}
export const TEXTO_PARA = "para";
export const TEXTO_PARA_A_CASA = "para a loja e o espaço";
export const ROTULO_SELO_ENTREGA = "Entrega";
export function textoInicioNaFolha(inicio: string): string {
  return `início ${inicio}`;
}

// Folha da ordem — tabela de peças.
export const CABECALHO_PECAS_DA_FOLHA = [
  "Peça",
  "Pedido",
  "A mais",
  "Fazer",
  "Argila",
  "Medidas (cm)",
] as const;
// "Cor: azul · com o nome gravado" — o que houver, na ordem; nada: `null`.
export function textoDetalheDaPecaNaFolha(cor: string | null, personalizacao: string | null): string | null {
  const partes = [cor ? `Cor: ${cor}` : null, personalizacao].filter((parte): parte is string =>
    Boolean(parte),
  );
  return partes.length > 0 ? partes.join(" · ") : null;
}
export const TITULO_REFERENCIAS = "Referências";

// Folha da ordem — tabela de etapas.
export const SR_CAIXA_DA_ETAPA = "Feita";
export const SR_ETAPA_FEITA = "feita";
export const SR_ETAPA_A_FAZER = "a fazer";
export const CABECALHO_ETAPAS_DA_FOLHA = ["Etapa", "Previsto", "Feita em", "Quantas passaram"] as const;
export const SR_LINHA_DE_ESCREVER = "em branco, para escrever à mão";

// Folha da ordem — material previsto e "No fim".
export const TITULO_MATERIAL_PREVISTO = "Material previsto";
export const DICA_MATERIAL_NA_FOLHA = "Anote o que usou e dê baixa depois.";
export function textoSemFichaNaFolha(quantas: number): string {
  return `Sem ficha: ${pecas(quantas)} fora do previsto.`;
}
export const FRASE_SEM_MATERIAL_NA_FOLHA = "Sem material previsto — nenhuma peça tem ficha.";
export const TITULO_NO_FIM = "No fim";
export const TITULO_ANOTACOES = "Anotações";

// Folha geral (PRD-20) — o quadro no papel, por etapa.
export const OLHO_FOLHA_GERAL = "quadro da semana";
export const TITULO_FOLHA_GERAL = "O que está em produção";
export const SUB_FOLHA_GERAL = "por etapa, do barro à entrega";
// "{n} ordens · {p} peças" — só as liberadas.
export function textoTotaisDaFolhaGeral(quantasOrdens: number, quantasPecas: number): string {
  return `${ordens(quantasOrdens)} · ${pecas(quantasPecas)}`;
}
export const CABECALHO_FOLHA_GERAL = ["Ordem", "Peças", "Nesta etapa", "Entrega", "Feito"] as const;
export function textoJaPassaramNaFolha(passaram: number): string {
  return `${passaram} ${ROTULO_JA_PASSARAM}`;
}
// "{N} dias · previsto {P}".
export function textoNestaEtapaNaFolha(diasNestaEtapa: number, previsto: number): string {
  return `${dias(diasNestaEtapa)} · previsto ${previsto}`;
}
export function srContadorDaSecao(quantas: number): string {
  return ordens(quantas);
}
export const SR_CAIXA_FEITO = "em branco, para marcar à mão";
export const TITULO_AGUARDANDO_NA_FOLHA = "Aguardando sinal";
export function textoEntregaNaFolhaGeral(entrega: string): string {
  return `entrega ${entrega}`;
}
export const TITULO_NADA_PARA_IMPRIMIR = "Nada para imprimir.";
export const CORPO_NADA_PARA_IMPRIMIR =
  "Quando houver ordem em produção ou aguardando o sinal, a folha geral mostra todas, por etapa.";
