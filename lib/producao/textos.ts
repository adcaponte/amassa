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
// "Cor: azul · com o nome gravado" — `null` quando a peça não tem cor nem personalização.
export function textoSubLinhaDaPeca(cor: string | null, personalizacao: string | null): string | null {
  const partes = [cor ? `Cor: ${cor}` : null, personalizacao].filter(
    (parte): parte is string => Boolean(parte),
  );
  return partes.length > 0 ? partes.join(" · ") : null;
}
export function textoAMais(aMais: number): string {
  return `+${aMais} a mais`;
}
