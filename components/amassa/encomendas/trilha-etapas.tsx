"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
  Cronograma,
  FaixaDeEtapa,
  Situacao,
  StatusDeEncomenda,
} from "@/lib/encomendas/cronograma";
import { formatarDiaCompleto, formatarDiaCurto, formatarIntervalo } from "@/lib/encomendas/formato";
import {
  FRASE_FALHA_AO_SALVAR,
  ROTULO_ETAPA,
  SELO_ATRASADA,
  SELO_RASCUNHO,
  textoDaSituacao,
} from "@/lib/encomendas/textos";
import { concluirEncomenda } from "@/lib/encomendas/acoes";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { AjusteRapidoEtapa } from "./ajuste-rapido-etapa";

const TAMANHO_MARCADOR = 14;

export type TrilhaEtapasProps = {
  encomendaId: string;
  status: StatusDeEncomenda;
  cronograma: Cronograma;
  situacao: Situacao;
  hoje: string;
};

// A etapa que `situacaoEm` aponta como "hoje" — só os três ramos que de fato apontam uma etapa
// (em curso, em curso num marco, última etapa) recebem o selo/destaque; os demais nunca têm
// "HOJE" na trilha (03-UI-SPEC.md "Etapa de hoje — destaque"). A escolha de QUAL linha recebe o
// selo vem sempre de `situacaoEm` (D-15) — nunca de uma comparação de data refeita aqui.
function etapaDeHoje(situacao: Situacao): string | null {
  switch (situacao.tipo) {
    case "em-etapa-intervalo":
    case "em-etapa-marco":
    case "ultima-etapa":
      return situacao.etapa;
    default:
      return null;
  }
}

// "Desligada" no lugar das datas (dias: 0), data única para marco, "12 a 18 ago" para
// intervalo — o último dia mostrado é `ultimoDia` (o último dia que a etapa OCUPA), nunca
// `fimExclusivo` (o dia em que a próxima começa) — 00-BRIEFING.md §5.
function textoDeData(faixa: FaixaDeEtapa): string {
  if (faixa.dias === 0) {
    return "Desligada";
  }
  if (faixa.marco) {
    return formatarDiaCurto(faixa.inicio);
  }
  return formatarIntervalo(faixa.inicio, faixa.ultimoDia ?? faixa.inicio);
}

function Marcador({ marco, desligada, cor }: { marco: boolean; desligada: boolean; cor: string }) {
  const estiloComum: CSSProperties = {
    width: TAMANHO_MARCADOR,
    height: TAMANHO_MARCADOR,
    backgroundColor: desligada ? "transparent" : cor,
    border: desligada ? `1.5px solid ${cor}` : undefined,
  };

  if (marco) {
    // Mesma técnica visual do Gantt (quadrado rotacionado 45°) — para quem já leu o Gantt
    // reconhecer de cara o mesmo símbolo aqui (03-UI-SPEC.md).
    return (
      <span
        aria-hidden="true"
        className="shrink-0 rounded-[2px]"
        style={{ ...estiloComum, transform: "rotate(45deg)" }}
      />
    );
  }

  return <span aria-hidden="true" className="shrink-0 rounded-full" style={estiloComum} />;
}

// Client Component: precisa de estado próprio porque o rodapé de duração total/data de
// conclusão só recalcula quando UMA das seis `AjusteRapidoEtapa` confirma a resposta do
// servidor (passo 4, nunca o passo 1) — o estado sobe até aqui via o callback `aoConfirmar`
// (03-UI-SPEC.md "Comportamento de salvamento — não é otimista"). "Marcar como concluída" mora
// aqui (fim da trilha, abaixo da última etapa) — nunca um quarto botão na fileira do cabeçalho.
export function TrilhaEtapas({ encomendaId, status, cronograma, situacao, hoje }: TrilhaEtapasProps) {
  const router = useRouter();
  const [duracaoTotalEmDias, setDuracaoTotalEmDias] = useState(cronograma.duracaoTotalEmDias);
  const [dataDeConclusao, setDataDeConclusao] = useState(cronograma.dataDeConclusao);

  const [dialogoAntecipadoAberto, setDialogoAntecipadoAberto] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  const etapaHoje = etapaDeHoje(situacao);
  const rascunho = status === "rascunho";
  const atrasada = situacao.tipo === "atrasada";
  // Concluída/cancelada não oferecem mais "Marcar como concluída" — já são um estado final
  // (decisão do executor, dentro do espaço discricionário de 03-CONTEXT.md).
  const podeConcluir = status !== "concluida" && status !== "cancelada";

  async function concluir() {
    setConcluindo(true);
    const resposta = await concluirEncomenda(encomendaId);
    setConcluindo(false);

    if (!resposta.ok) {
      toast.error(FRASE_FALHA_AO_SALVAR);
      return;
    }

    setDialogoAntecipadoAberto(false);
    router.refresh();
  }

  function aoClicarConcluir() {
    if (dataDeConclusao && dataDeConclusao > hoje) {
      setDialogoAntecipadoAberto(true);
      return;
    }
    void concluir();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={
            atrasada ? "text-corpo font-medium text-atencao" : "text-corpo text-tinta-media"
          }
        >
          {textoDaSituacao(situacao)}
        </p>
        {rascunho && (
          <span className="text-micro shrink-0 rounded border border-borda-forte bg-superficie-2 px-1.5 py-0.5 tracking-wide text-tinta-media uppercase">
            {SELO_RASCUNHO}
          </span>
        )}
        {atrasada && (
          <span className="text-micro shrink-0 rounded border border-atencao bg-atencao-fundo px-1.5 py-0.5 tracking-wide text-atencao uppercase">
            {SELO_ATRASADA}
          </span>
        )}
      </div>

      <ol className="flex flex-col" data-testid="trilha-etapas">
        {cronograma.faixas.map((faixa, indice) => {
          const desligada = faixa.dias === 0;
          const ehHoje = faixa.etapa === etapaHoje;
          const ehUltima = indice === cronograma.faixas.length - 1;
          const cor = `var(--color-${faixa.etapa})`;

          return (
            <li
              key={faixa.etapa}
              className="relative flex gap-4"
              data-testid={`trilha-linha-${faixa.etapa}`}
            >
              <div className="flex flex-col items-center pt-1">
                <Marcador marco={faixa.marco} desligada={desligada} cor={cor} />
                {!ehUltima && (
                  <div
                    aria-hidden="true"
                    className="mt-1 w-px flex-1"
                    style={
                      desligada
                        ? { borderLeft: "1px dashed var(--color-borda-forte)" }
                        : { backgroundColor: "var(--color-borda-forte)" }
                    }
                  />
                )}
              </div>

              <div
                className={`min-w-0 flex-1 rounded-md px-2 py-1.5 ${ehHoje ? "bg-superficie-2" : ""}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className={`text-titulo ${desligada ? "text-tinta-fraca" : "text-tinta"}`}>
                    {ROTULO_ETAPA[faixa.etapa]}
                  </span>

                  <span className="flex items-center gap-2">
                    <span
                      className={`text-mono tabular-nums ${desligada ? "text-tinta-fraca" : "text-tinta-media"}`}
                    >
                      {textoDeData(faixa)}
                    </span>
                    {ehHoje && (
                      <span
                        data-testid="selo-hoje"
                        className="text-micro shrink-0 rounded bg-tinta px-1.5 py-0.5 tracking-wide text-white uppercase"
                      >
                        HOJE
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-4 pb-5">
                  <span className="text-apoio text-tinta-fraca">
                    {faixa.dias} dia{faixa.dias === 1 ? "" : "s"}
                  </span>
                  <AjusteRapidoEtapa
                    encomendaId={encomendaId}
                    etapa={faixa.etapa}
                    marco={faixa.marco}
                    diasInicial={faixa.dias}
                    aoConfirmar={(resposta) => {
                      setDuracaoTotalEmDias(resposta.duracaoTotalEmDias);
                      setDataDeConclusao(resposta.dataDeConclusao);
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <p className="text-corpo text-tinta-media" data-testid="rodape-trilha">
          Duração total:{" "}
          <span className="text-mono tabular-nums font-medium text-tinta">
            {duracaoTotalEmDias} dia{duracaoTotalEmDias === 1 ? "" : "s"}
          </span>
          {dataDeConclusao && (
            <>
              {" · Conclusão prevista: "}
              <span className="text-mono tabular-nums font-medium text-tinta">
                {formatarDiaCurto(dataDeConclusao)}
              </span>
            </>
          )}
        </p>

        {podeConcluir && (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={aoClicarConcluir}
            disabled={concluindo}
          >
            {concluindo ? "Concluindo…" : "Marcar como concluída"}
          </Button>
        )}
      </div>

      <AlertDialog
        open={dialogoAntecipadoAberto}
        onOpenChange={(novoValor) => {
          if (!concluindo) {
            setDialogoAntecipadoAberto(novoValor);
          }
        }}
      >
        <AlertDialogContent className="max-h-[85svh] overflow-y-auto [overflow-wrap:anywhere]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              A conclusão prevista é {dataDeConclusao ? formatarDiaCompleto(dataDeConclusao) : "—"},
              que ainda não chegou.
            </AlertDialogTitle>
            <AlertDialogDescription>Marcar como concluída assim mesmo?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={concluindo}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              disabled={concluindo}
              onClick={(evento) => {
                evento.preventDefault();
                void concluir();
              }}
            >
              {concluindo ? "Concluindo…" : "Concluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
