"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { cancelarReserva } from "@/lib/agenda/acoes";
import {
  CORPO_CONFIRMAR_CANCELAR_RESERVA,
  FRASE_FALHA_AO_CANCELAR_RESERVA,
  ROTULO_CANCELANDO,
  ROTULO_CANCELAR_RESERVA,
  ROTULO_MANTER_A_RESERVA,
  TOAST_RESERVA_CANCELADA,
  tituloConfirmarCancelarReserva,
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

export type ConfirmarCancelarReservaProps = {
  usoLivreId: string;
  nome: string;
  data: string;
  desabilitado?: boolean;
  // Chamado ANTES de pedir ao servidor (a folha não deve avisar "não existe mais" do que ela mesma está
  // removendo) e depois de remover (fecha a folha).
  aoComecar: () => void;
  aoCancelar: () => void;
  // O diálogo fechado depois de uma recusa (outro celular mudou o uso): a folha relê o servidor.
  aoFecharDepoisDaRecusa: () => void;
};

// "Cancelar reserva" (AGE-05, 05-UI-SPEC.md §Confirmações): só a reserva não iniciada sai da agenda, e
// sempre com a confirmação que diz o que se perde ("Nada foi cobrado nem baixado do estoque."). O botão
// de confirmar não fecha antes da resposta: em voo "Cancelando…", os dois botões desabilitados e
// `aria-busy`. Recusa ou falha: a frase DENTRO do diálogo (`role="alert"`) — a reserva que outro
// celular acabou de marcar "Chegou" é "Esta reserva já começou…", a já removida é "Isso já tinha sido
// removido.", nunca erro técnico. Fechar o diálogo depois da recusa relê a folha (o estado novo).
export function ConfirmarCancelarReserva({
  usoLivreId,
  nome,
  data,
  desabilitado = false,
  aoComecar,
  aoCancelar,
  aoFecharDepoisDaRecusa,
}: ConfirmarCancelarReservaProps) {
  const emVoo = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      const resposta = await cancelarReserva({ usoLivreId });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      toast.success(TOAST_RESERVA_CANCELADA);
      setAberto(false);
      aoCancelar();
    } catch {
      setErro(FRASE_FALHA_AO_CANCELAR_RESERVA);
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
        data-testid="uso-cancelar-reserva"
        disabled={desabilitado}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className={CLASSES_BOTAO_DE_ERRO}
      >
        {ROTULO_CANCELAR_RESERVA}
      </Button>

      <AlertDialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !enviando) {
            const houveRecusa = erro !== null;
            setErro(null);
            setAberto(false);
            if (houveRecusa) {
              aoFecharDepoisDaRecusa();
            }
          }
        }}
      >
        <AlertDialogContent data-testid="confirmar-cancelar-reserva" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {tituloConfirmarCancelarReserva(nome, formatarDiaMes(data))}
            </AlertDialogTitle>
            <AlertDialogDescription>{CORPO_CONFIRMAR_CANCELAR_RESERVA}</AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p data-testid="confirmar-cancelar-reserva-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-cancelar-reserva-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_A_RESERVA}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-cancelar-reserva-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO_DE_ERRO}
            >
              {enviando ? ROTULO_CANCELANDO : ROTULO_CANCELAR_RESERVA}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
