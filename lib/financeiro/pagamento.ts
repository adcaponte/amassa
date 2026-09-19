// Módulo puro (D-01/D-02/D-03, 04.4-CONTEXT.md): decide o que muda quando "Paguei"/"Recebi"
// registra um valor diferente do previsto, e o que restaurar quando "Desfazer" desfaz esse
// pagamento — os dois têm de ser o inverso exato um do outro (D-03), verificado no teste unitário
// por uma propriedade de ida e volta sobre 200 documentos gerados deterministicamente.
//
// A regra "uma linha e uma parcela ajusta a linha" é do BRIEFING (§5, "Pagar / receber"); a regra
// "mais de uma linha OU mais de uma parcela cria uma linha 'diferença' na categoria Geral" é do
// CONTEXT (D-01/D-02).
//
// Sem nenhum import: nem React, nem Next, nem o driver do banco, nem o cliente de banco do
// projeto, nem o módulo da Abertura do Espaço — só tipos redeclarados localmente (D-15 do
// projeto, mesma disciplina de lib/financeiro/taxa.ts), e nenhuma instância de `Date` (este
// módulo não lida com "hoje" nenhum).

export type FormaDePagamentoParaPagamento = "dinheiro" | "pix" | "cartao";

// A mesma ação, nos dois sentidos: "ajustar" muda a única linha; "diferenca" acrescenta (no
// pagamento) ou remove (no desfazer) a linha de diferença; "nenhuma" não toca em linha nenhuma.
export type AcaoNaLinha = "nenhuma" | "ajustar" | "diferenca";

export type EntradaDePlanoDePagamento = {
  tipoDocumento: "venda" | "despesa";
  quantidadeDeLinhas: number;
  quantidadeDeParcelas: number;
  previstoCentavos: number;
  pagoCentavos: number;
  formaAnterior: FormaDePagamentoParaPagamento;
  formaNova: FormaDePagamentoParaPagamento;
  taxaPontosBaseAtual: number;
};

export type PlanoDePagamentoDaParcela = {
  acaoNaLinha: AcaoNaLinha;
  // pago − previsto, com sinal — SEMPRE calculado, mesmo quando `acaoNaLinha` não é "diferenca".
  // Quem chama só usa este número no texto do aviso quando `acaoNaLinha === "diferenca"`.
  diferencaCentavos: number;
  // Congelada SÓ em VENDA paga no cartão (BRIEFING §5) — despesa no cartão e qualquer forma que
  // não seja cartão nunca gravam taxa (T-04.4-... nenhuma taxa fantasma).
  taxaPontosBase: number | null;
};

// `formaAnterior` não entra na decisão desta função (ela só decide o que muda na LINHA) — mas
// continua no formato de entrada porque quem chama (a Server Action) grava `forma_prevista` a
// partir dela, sempre, mesmo quando `pagoCentavos === previstoCentavos` ("para o desfazer ser
// uniforme", ver `<behavior>` do plano).
export function planejarPagamento({
  tipoDocumento,
  quantidadeDeLinhas,
  quantidadeDeParcelas,
  previstoCentavos,
  pagoCentavos,
  formaNova,
  taxaPontosBaseAtual,
}: EntradaDePlanoDePagamento): PlanoDePagamentoDaParcela {
  const diferencaCentavos = pagoCentavos - previstoCentavos;
  const taxaPontosBase =
    tipoDocumento === "venda" && formaNova === "cartao" ? taxaPontosBaseAtual : null;

  if (diferencaCentavos === 0) {
    return { acaoNaLinha: "nenhuma", diferencaCentavos: 0, taxaPontosBase };
  }

  const linhaUnicaEParcelaUnica = quantidadeDeLinhas === 1 && quantidadeDeParcelas === 1;

  return {
    acaoNaLinha: linhaUnicaEParcelaUnica ? "ajustar" : "diferenca",
    diferencaCentavos,
    taxaPontosBase,
  };
}

export type EntradaDePlanoDeDesfazer = {
  // Se ESTA parcela tem uma linha de diferença ligada a ela (`parcela_diferenca_id`) — é o que
  // diz ao desfazer se ele remove uma linha ou restaura a única linha do documento.
  temLinhaDeDiferenca: boolean;
  quantidadeDeLinhas: number;
  quantidadeDeParcelas: number;
  // Nulo = pagamento sem previsto guardado (paga no próprio lançamento, ou documento cancelado
  // antes de o previsto existir) — desfazer é sempre recusado nesse caso.
  previstoCentavos: number | null;
  pagoCentavos: number;
  formaPrevista: FormaDePagamentoParaPagamento | null;
};

export type PlanoDeDesfazer =
  | {
      ok: true;
      acaoNaLinha: AcaoNaLinha;
      valorParaRestaurarCentavos: number;
      formaParaRestaurar: FormaDePagamentoParaPagamento;
    }
  | { ok: false; erro: string };

// Sem `valor_previsto_centavos`/`forma_prevista` guardados, não tem o que desfazer — a parcela foi
// paga no próprio lançamento (D-03 exige o previsto gravado para o inverso existir).
export const FRASE_DESFAZER_SEM_PREVISTO =
  "Essa parcela foi paga direto no lançamento, sem valor previsto guardado — não dá para desfazer. Se foi engano, cancele o lançamento e lance de novo.";

// O inverso exato de `planejarPagamento` (D-03): decide como devolver a parcela e a linha ao
// estado de antes do "Paguei"/"Recebi". `quantidadeDeLinhas`/`quantidadeDeParcelas` não entram na
// decisão em si (`temLinhaDeDiferenca` já diz tudo que é preciso saber sobre a linha) — ficam no
// formato de entrada por simetria com `planejarPagamento` e porque descrevem o estado do
// documento no momento do desfazer, útil para quem chama auditar/logar.
export function planejarDesfazer({
  temLinhaDeDiferenca,
  previstoCentavos,
  pagoCentavos,
  formaPrevista,
}: EntradaDePlanoDeDesfazer): PlanoDeDesfazer {
  if (previstoCentavos === null || formaPrevista === null) {
    return { ok: false, erro: FRASE_DESFAZER_SEM_PREVISTO };
  }

  if (temLinhaDeDiferenca) {
    return {
      ok: true,
      acaoNaLinha: "diferenca",
      valorParaRestaurarCentavos: previstoCentavos,
      formaParaRestaurar: formaPrevista,
    };
  }

  if (previstoCentavos !== pagoCentavos) {
    return {
      ok: true,
      acaoNaLinha: "ajustar",
      valorParaRestaurarCentavos: previstoCentavos,
      formaParaRestaurar: formaPrevista,
    };
  }

  return {
    ok: true,
    acaoNaLinha: "nenhuma",
    valorParaRestaurarCentavos: previstoCentavos,
    formaParaRestaurar: formaPrevista,
  };
}
