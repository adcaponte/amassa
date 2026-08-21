"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  situacaoEm,
  type Cronograma,
  type FaixaDeEtapa,
  type Situacao,
  type StatusDeEncomenda,
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
  // DERIVA CONHECIDA, pré-existente e NÃO corrigida aqui (registrada no ledger da sessão de
  // depuração): estes dois são cópias de prop semeadas UMA vez. Um `router.refresh()` que chega
  // com `cronograma` novo não os ressincroniza, porque o componente não remonta. Depois de
  // concluir, as seis `AjusteRapidoEtapa` continuam na tela; se uma delas confirmar, o rodapé
  // passa a imprimir a nova "Conclusão prevista" enquanto a linha de situação segue com a data
  // que a conclusão gravou — duas datas diferentes na mesma tela. NÃO fechei os controles de
  // ajuste quando `!podeConcluir` de propósito: passar a proibir corrigir a duração de uma
  // etapa numa encomenda encerrada é mudança de comportamento de produto (decisão do dono), não
  // conserto de defeito. A trava de conclusão abaixo não piora esta deriva: nasce com o mesmo
  // valor do rodapé (as duas vêm do mesmo cálculo sobre as mesmas linhas do banco) e se solta
  // assim que a árvore do servidor chega.
  const [duracaoTotalEmDias, setDuracaoTotalEmDias] = useState(cronograma.duracaoTotalEmDias);
  const [dataDeConclusao, setDataDeConclusao] = useState(cronograma.dataDeConclusao);

  const [dialogoAntecipadoAberto, setDialogoAntecipadoAberto] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  // A resposta da Server Action é a fonte CONFIRMADA — o mesmo princípio de
  // `AjusteRapidoEtapa` (03-UI-SPEC.md "Comportamento de salvamento — não é otimista"): a tela
  // só muda depois que o servidor respondeu, mas aí muda com o que ELE devolveu, sem depender de
  // uma segunda viagem. Isto existe porque `router.refresh()` é um canal COM PERDA: medido em
  // 3 de 50 conclusões sob dois workers (e 1 em 30 sob quatro), a resposta do refresh chega 200
  // ao navegador e a árvore nunca é aplicada — a tela fica mentindo para sempre, mostrando
  // "Marcar como concluída" numa encomenda já concluída, sem erro nenhum. O `router.refresh()`
  // abaixo continua (o resto da página depende dele, e tirá-lo piora: medido, 10 falhas em 60).
  const [conclusaoConfirmada, setConclusaoConfirmada] = useState<{
    dataDeConclusao: string | null;
  } | null>(null);

  // A trava acima precisa saber SE SOLTAR — senão vira a mesma mentira que existe para matar,
  // só que ao contrário. `AcoesEncomenda` mostra "Cancelar encomenda" sem porta de status
  // (acoes-encomenda.tsx:40-47, nenhuma condição) e `cancelarEncomenda` é um
  // `update ... set status='cancelada'` sem guarda de status (acoes.ts:227-231): concluir e
  // depois cancelar é uma sequência ALCANÇÁVEL hoje, na mesma tela, e os dois componentes são
  // irmãos sem estado compartilhado. Sem esta soltura, o refresh chegaria com "cancelada" e a
  // trilha continuaria dizendo "Concluída em …", porque a trava vence e o refresh NÃO remonta o
  // componente.
  //
  // Padrão React de "ajustar estado quando uma prop muda", feito na renderização (nunca em
  // efeito). A guarda NÃO é o `prop mudou` genérico, e sim "a prop chegou num estado FINAL":
  // solta só quando o servidor manda "concluida" (a árvore alcançou a trava) ou "cancelada" (a
  // verdade passou por cima dela). A diferença importa porque uma resposta ATRASADA, emitida
  // antes da gravação, ainda diz "em_producao" — com a guarda genérica ela soltaria a trava e a
  // tela voltaria a mentir, que é exatamente o defeito. Aqui ela não solta nada, e a soltura só
  // anda no sentido da verdade. É seguro porque `status` só é escrito em DOIS lugares no
  // sistema inteiro (acoes.ts:229 "cancelada" e acoes.ts:259 "concluida"), ambos finais: nada
  // devolve uma encomenda para "em_producao" ou "rascunho", então não existe transição legítima
  // pós-conclusão que esta guarda deixe passar.
  if (conclusaoConfirmada && (status === "concluida" || status === "cancelada")) {
    setConclusaoConfirmada(null);
  }

  const statusAtual: StatusDeEncomenda = conclusaoConfirmada ? "concluida" : status;
  const situacaoAtual: Situacao = conclusaoConfirmada
    ? situacaoEm(
        { ...cronograma, dataDeConclusao: conclusaoConfirmada.dataDeConclusao },
        "concluida",
        hoje,
      )
    : situacao;

  const etapaHoje = etapaDeHoje(situacaoAtual);
  const rascunho = statusAtual === "rascunho";
  const atrasada = situacaoAtual.tipo === "atrasada";
  // Concluída/cancelada não oferecem mais "Marcar como concluída" — já são um estado final
  // (decisão do executor, dentro do espaço discricionário de 03-CONTEXT.md).
  const podeConcluir = statusAtual !== "concluida" && statusAtual !== "cancelada";

  async function concluir() {
    setConcluindo(true);
    const resposta = await concluirEncomenda(encomendaId);
    setConcluindo(false);

    if (!resposta.ok) {
      toast.error(FRASE_FALHA_AO_SALVAR);
      return;
    }

    setConclusaoConfirmada({ dataDeConclusao: resposta.dados.dataDeConclusao });
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
        {/* `data-testid` para que a regressão da trava de conclusão possa afirmar o texto EXATO
            desta linha (`toHaveText`), em vez de procurar substring no `body` inteiro — onde o
            toast "Encomenda cancelada." e o rodapé "Conclusão prevista" moram junto e deixam a
            asserção passar pelo motivo errado. */}
        <p
          data-testid="situacao-encomenda"
          className={
            atrasada ? "text-corpo font-medium text-atencao" : "text-corpo text-tinta-media"
          }
        >
          {textoDaSituacao(situacaoAtual)}
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
                    esperaInicial={faixa.esperaDias}
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
