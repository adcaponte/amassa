"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { cancelarData } from "@/lib/agenda/acoes";
import type { EventoCarregado, PerdasAoCancelar } from "@/lib/agenda/consultas";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  corpoConfirmarCancelarOficina,
  corpoConfirmarCancelarTurma,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_DESFAZER,
  FRASE_FALHA_AO_DESFAZER_CANCELAMENTO,
  FRASE_PERDAS_DA_DATA_MUDARAM,
  ROTULO_CANCELANDO,
  ROTULO_CANCELAR_DATA,
  ROTULO_DESFAZENDO,
  ROTULO_DESFAZER,
  ROTULO_DESFAZER_CANCELAMENTO,
  ROTULO_MANTER_A_DATA,
  TOAST_CANCELADA_OFICINA,
  TOAST_CANCELADA_TURMA,
  TOAST_DATA_VOLTOU,
  tituloConfirmarCancelarData,
} from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";

// "Cancelar esta data" (`outline` de erro, herdado de `.btn.perigo`).
export const CLASSES_BOTAO_DE_ERRO =
  "border-erro text-erro hover:bg-erro-fundo hover:text-erro text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";
const CLASSES_BOTAO_NEUTRO = "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

function temPerdas(perdas: PerdasAoCancelar): boolean {
  return perdas.presencas > 0 || perdas.inscricoesAReceber > 0;
}

export type CancelarEstaDataProps = {
  evento: EventoCarregado;
};

// "Cancelar esta data" / "Desfazer cancelamento" no rodapé da folha do evento (AGE-04, AGE-05,
// 05-UI-SPEC.md §Confirmações e UI-D13). Cancelar NUNCA apaga: risca a data. Pede confirmação SÓ
// quando algo se perde (presenças já marcadas, inscrições de oficina ainda em "A receber"); sem
// nada a perder, cancela direto com "Desfazer" no toast — o "um toque" da D-13. O servidor confere
// de novo sob a trava: se alguém marcou presença em outro celular depois de a folha abrir, ele
// devolve as perdas em vez de gravar, e a confirmação aparece com os números de agora.
//
// Decisão E29 (a UI-SPEC não fixa): o "Desfazer" do toast manda `cancelada: false` (estado
// desejado — dois toques convergem) e só age no PRIMEIRO toque; o sonner fecha o toast ao tocar.
// Se falhar, a frase diz o que fazer.
export function CancelarEstaData({ evento }: CancelarEstaDataProps) {
  const emVoo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // A confirmação aberta, com as perdas FOTOGRAFADAS no momento em que ela abriu.
  const [perdasEmConfirmacao, setPerdasEmConfirmacao] = useState<PerdasAoCancelar | null>(null);
  const [erroNaConfirmacao, setErroNaConfirmacao] = useState<string | null>(null);
  // WR-03 (revisão B): o servidor recontou e achou mais a perder do que a confirmação mostrava.
  const [mudou, setMudou] = useState(false);

  const ehTurma = evento.tipo === "turma";
  const diaMes = formatarDiaMes(evento.data);

  function avisarCancelada() {
    let desfeito = false;
    toast.success(ehTurma ? TOAST_CANCELADA_TURMA : TOAST_CANCELADA_OFICINA, {
      action: {
        label: ROTULO_DESFAZER,
        onClick: () => {
          if (desfeito) {
            return;
          }
          desfeito = true;
          void (async () => {
            try {
              const resposta = await cancelarData({ eventoId: evento.id, cancelada: false });
              if (resposta.ok) {
                toast.success(TOAST_DATA_VOLTOU);
              } else {
                toast.error(FRASE_FALHA_AO_DESFAZER);
              }
            } catch {
              toast.error(FRASE_FALHA_AO_DESFAZER);
            }
          })();
        },
      },
    });
  }

  // `confirmado`: o que a confirmação MOSTROU (WR-03 da revisão B) — o servidor reconta sob a trava e, se
  // se perde mais do que isso, devolve os números de agora em vez de gravar. `null`: ninguém viu nada.
  async function cancelar(confirmado: PerdasAoCancelar | null) {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    setErroNaConfirmacao(null);
    try {
      const resposta = await cancelarData({
        eventoId: evento.id,
        cancelada: true,
        ...(confirmado === null ? {} : { confirmado }),
      });
      if (!resposta.ok) {
        if (confirmado !== null) {
          setErroNaConfirmacao(resposta.erro);
        } else {
          setErro(resposta.erro);
        }
        return;
      }
      if (resposta.dados.situacao === "confirmar") {
        setMudou(confirmado !== null);
        setPerdasEmConfirmacao(resposta.dados.perdas);
        return;
      }
      setPerdasEmConfirmacao(null);
      avisarCancelada();
    } catch {
      if (confirmado !== null) {
        setErroNaConfirmacao(FRASE_FALHA_AO_CANCELAR);
      } else {
        setErro(FRASE_FALHA_AO_CANCELAR);
      }
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function aoTocarEmCancelar() {
    if (temPerdas(evento.perdasAoCancelar)) {
      setErroNaConfirmacao(null);
      setMudou(false);
      setPerdasEmConfirmacao(evento.perdasAoCancelar);
      return;
    }
    void cancelar(null);
  }

  async function desfazerCancelamento() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await cancelarData({ eventoId: evento.id, cancelada: false });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      toast.success(TOAST_DATA_VOLTOU);
    } catch {
      setErro(FRASE_FALHA_AO_DESFAZER_CANCELAMENTO);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  const corpo =
    perdasEmConfirmacao === null
      ? ""
      : ehTurma
        ? corpoConfirmarCancelarTurma(perdasEmConfirmacao.presencas)
        : corpoConfirmarCancelarOficina(perdasEmConfirmacao.inscricoesAReceber, perdasEmConfirmacao.presencas);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {evento.cancelado ? (
        <Button
          type="button"
          variant="outline"
          data-testid="desfazer-cancelamento"
          disabled={enviando}
          aria-busy={enviando ? "true" : undefined}
          onClick={() => void desfazerCancelamento()}
          className={CLASSES_BOTAO_NEUTRO}
        >
          {enviando ? ROTULO_DESFAZENDO : ROTULO_DESFAZER_CANCELAMENTO}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          data-testid="cancelar-data"
          disabled={enviando}
          aria-busy={enviando && perdasEmConfirmacao === null ? "true" : undefined}
          onClick={aoTocarEmCancelar}
          className={CLASSES_BOTAO_DE_ERRO}
        >
          {enviando && perdasEmConfirmacao === null ? ROTULO_CANCELANDO : ROTULO_CANCELAR_DATA}
        </Button>
      )}
      {erro ? (
        <p role="alert" data-testid="cancelar-data-erro" className="text-apoio text-erro">
          {erro}
        </p>
      ) : null}

      <AlertDialog
        open={perdasEmConfirmacao !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !enviando) {
            setPerdasEmConfirmacao(null);
            setErroNaConfirmacao(null);
            setMudou(false);
          }
        }}
      >
        <AlertDialogContent data-testid="confirmar-cancelar-data" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {tituloConfirmarCancelarData(diaDaSemanaPorExtenso(evento.data), diaMes)}
            </AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">{corpo}</AlertDialogDescription>
          </AlertDialogHeader>

          {mudou ? (
            <p data-testid="confirmar-cancelar-data-mudou" role="status" className="text-apoio text-tinta">
              {FRASE_PERDAS_DA_DATA_MUDARAM}
            </p>
          ) : null}

          {erroNaConfirmacao ? (
            <p data-testid="confirmar-cancelar-data-erro" role="alert" className="text-apoio text-erro">
              {erroNaConfirmacao}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-cancelar-data-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_A_DATA}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-cancelar-data-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={(evento) => {
                evento.preventDefault();
                void cancelar(perdasEmConfirmacao);
              }}
              className={cn(CLASSES_BOTAO_DE_ERRO)}
            >
              {enviando ? ROTULO_CANCELANDO : ROTULO_CANCELAR_DATA}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
