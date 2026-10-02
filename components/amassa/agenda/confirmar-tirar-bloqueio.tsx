"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { tirarBloqueio } from "@/lib/agenda/acoes";
import {
  CORPO_CONFIRMAR_TIRAR_BLOQUEIO,
  FRASE_FALHA_AO_TIRAR_BLOQUEIO,
  ROTULO_MANTER_FECHADO,
  ROTULO_TIRANDO_BLOQUEIO,
  ROTULO_TIRAR_BLOQUEIO,
  tituloConfirmarTirarBloqueio,
  toastBloqueioTirado,
} from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";
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

import { CLASSES_BOTAO_DE_ERRO } from "./confirmar-cancelar-data";

const CLASSES_BOTAO_NEUTRO = "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

export type ConfirmarTirarBloqueioProps = {
  eventoId: string;
  data: string;
  // Chamado ANTES de pedir ao servidor (a folha não deve avisar "não existe mais" do que ela mesma
  // está tirando) e depois de tirar (fecha a folha).
  aoComecar: () => void;
  aoTirar: () => void;
};

// "Tirar o bloqueio" (AGE-05, 05-UI-SPEC.md §Confirmações): o fechado é o único evento que se
// apaga, e sempre com confirmação que diz o que muda. O botão de confirmar não fecha antes da
// resposta: em voo "Tirando…", os dois botões desabilitados e `aria-busy`. Recusa ou falha: a frase
// DENTRO do diálogo (`role="alert"`), que continua aberto — tirado em outro celular é
// "Isso já tinha sido removido.", nunca erro técnico.
export function ConfirmarTirarBloqueio({ eventoId, data, aoComecar, aoTirar }: ConfirmarTirarBloqueioProps) {
  const emVoo = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const diaMes = formatarDiaMes(data);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    aoComecar();
    try {
      const resposta = await tirarBloqueio({ eventoId });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      toast.success(toastBloqueioTirado(formatarDiaMes(resposta.dados.data)));
      setAberto(false);
      aoTirar();
    } catch {
      setErro(FRASE_FALHA_AO_TIRAR_BLOQUEIO);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="tirar-bloqueio"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className={CLASSES_BOTAO_DE_ERRO}
      >
        {ROTULO_TIRAR_BLOQUEIO}
      </Button>

      <AlertDialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !enviando) {
            setErro(null);
            setAberto(false);
          }
        }}
      >
        <AlertDialogContent data-testid="confirmar-tirar-bloqueio" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{tituloConfirmarTirarBloqueio(diaMes)}</AlertDialogTitle>
            <AlertDialogDescription>{CORPO_CONFIRMAR_TIRAR_BLOQUEIO}</AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p data-testid="confirmar-tirar-bloqueio-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-tirar-bloqueio-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_FECHADO}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-tirar-bloqueio-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO_DE_ERRO}
            >
              {enviando ? ROTULO_TIRANDO_BLOQUEIO : ROTULO_TIRAR_BLOQUEIO}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
