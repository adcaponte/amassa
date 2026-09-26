"use client";

import { useState } from "react";

import { definirObservacoes, definirPlanoDePagamento } from "@/lib/orcamentos/acoes";
import { formatarReais } from "@/lib/financeiro/formato";
import { PLANOS_DE_PAGAMENTO_DO_ORCAMENTO, type ParcelaDoPlano, type PlanoDePagamentoDoOrcamento } from "@/lib/orcamentos/plano";
import {
  ROTULO_COMO_CLIENTE_PAGA,
  ROTULO_OBSERVACOES_PARA_CLIENTE,
  ROTULO_SINAL_PORCENTO,
  ROTULO_TOTAL,
  ROTULOS_DO_PLANO_DE_PAGAMENTO,
  TITULO_TOTAL_E_PAGAMENTO,
} from "@/lib/orcamentos/textos";

export type TotalEPagamentoProps = {
  orcamentoId: string;
  vivo: boolean;
  totalCentavos: number;
  plano: PlanoDePagamentoDoOrcamento;
  sinalPercentual: number;
  // Passado adiante só para completar o trio que `definirPlanoDePagamento` sempre recebe junto
  // (lib/orcamentos/esquemas.ts explica o porquê) — este bloco nunca edita o frete, só o
  // reenvia sem mudança quando PLANO/SINAL mudam.
  freteCentavos: number;
  observacoes: string | null;
  // Já calculadas por `parcelasDoPlano` no Server Component (`EditorOrcamento`) — este componente
  // só EXIBE, nunca soma/arredonda parcela nenhuma.
  parcelas: ParcelaDoPlano[];
};

function paraTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// "Total e pagamento" (Client Component): o total em Display 28px, a escolha de como o cliente
// paga, o sinal (só no plano sinal) e as parcelas resultantes — mais as observações para o
// cliente, um campo isolado com a própria ação (`definirObservacoes`).
export function TotalEPagamento({
  orcamentoId,
  vivo,
  totalCentavos,
  plano,
  sinalPercentual,
  freteCentavos,
  observacoes,
  parcelas,
}: TotalEPagamentoProps) {
  const [planoAtual, setPlanoAtual] = useState<PlanoDePagamentoDoOrcamento>(plano);
  const [sinalTexto, setSinalTexto] = useState(String(sinalPercentual));
  const [salvandoPlano, setSalvandoPlano] = useState(false);
  const [erroPlano, setErroPlano] = useState<string | null>(null);

  const [observacoesTexto, setObservacoesTexto] = useState(observacoes ?? "");
  const [salvandoObservacoes, setSalvandoObservacoes] = useState(false);
  const [erroObservacoes, setErroObservacoes] = useState<string | null>(null);

  async function salvarPlano(planoParaSalvar: PlanoDePagamentoDoOrcamento, sinalParaSalvar: string) {
    setSalvandoPlano(true);
    setErroPlano(null);

    const resposta = await definirPlanoDePagamento({
      orcamentoId,
      planoTexto: planoParaSalvar,
      sinalTexto: planoParaSalvar === "sinal" ? sinalParaSalvar : undefined,
      freteTexto: paraTexto(freteCentavos),
    });

    setSalvandoPlano(false);

    if (!resposta.ok) {
      setErroPlano(resposta.erro);
      return;
    }

    window.location.assign(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  }

  async function salvarObservacoes() {
    setSalvandoObservacoes(true);
    setErroObservacoes(null);

    const resposta = await definirObservacoes({ orcamentoId, observacoesTexto });

    setSalvandoObservacoes(false);

    if (!resposta.ok) {
      setErroObservacoes(resposta.erro);
      return;
    }

    window.location.assign(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  }

  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_TOTAL_E_PAGAMENTO}</h2>

      <div data-testid="orcamento-total" className="flex items-center justify-between gap-3">
        <span className="text-corpo text-foreground">{ROTULO_TOTAL}</span>
        <span className="text-display text-foreground tabular-nums">{formatarReais(totalCentavos)}</span>
      </div>

      {vivo && (
        <>
          {erroPlano && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erroPlano}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <label className="text-apoio text-muted-foreground flex flex-1 flex-col gap-1" style={{ minWidth: 180 }}>
              {ROTULO_COMO_CLIENTE_PAGA}
              <select
                data-testid="orcamento-plano-select"
                value={planoAtual}
                disabled={salvandoPlano}
                onChange={(evento) => {
                  const novoPlano = evento.target.value as PlanoDePagamentoDoOrcamento;
                  setPlanoAtual(novoPlano);
                  void salvarPlano(novoPlano, sinalTexto);
                }}
                className="border-border text-corpo min-h-[44px] rounded-md border bg-transparent px-3"
              >
                {PLANOS_DE_PAGAMENTO_DO_ORCAMENTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {ROTULOS_DO_PLANO_DE_PAGAMENTO[valor]}
                  </option>
                ))}
              </select>
            </label>

            {planoAtual === "sinal" && (
              <label className="text-apoio text-muted-foreground flex flex-col gap-1" style={{ maxWidth: 130 }}>
                {ROTULO_SINAL_PORCENTO}
                <input
                  data-testid="orcamento-sinal-input"
                  inputMode="numeric"
                  value={sinalTexto}
                  disabled={salvandoPlano}
                  onChange={(evento) => setSinalTexto(evento.target.value)}
                  onBlur={() => void salvarPlano(planoAtual, sinalTexto)}
                  className="border-border text-corpo min-h-[44px] rounded-md border px-2"
                />
              </label>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        {parcelas.map((parcela, indice) => (
          <div key={indice} data-testid="orcamento-parcela" className="flex items-center justify-between gap-3">
            <span className="text-corpo text-foreground">{parcela.rotulo}</span>
            <span className="text-corpo text-foreground tabular-nums">{formatarReais(parcela.valorCentavos)}</span>
          </div>
        ))}
      </div>

      {vivo ? (
        <label className="text-apoio text-muted-foreground flex flex-col gap-1">
          {ROTULO_OBSERVACOES_PARA_CLIENTE}
          {erroObservacoes && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erroObservacoes}
            </p>
          )}
          <input
            data-testid="orcamento-observacoes"
            value={observacoesTexto}
            disabled={salvandoObservacoes}
            maxLength={300}
            onChange={(evento) => setObservacoesTexto(evento.target.value)}
            onBlur={() => void salvarObservacoes()}
            className="border-border text-corpo min-h-[44px] rounded-md border px-2"
          />
        </label>
      ) : (
        observacoes && <p className="text-apoio text-muted-foreground">{observacoes}</p>
      )}
    </section>
  );
}
