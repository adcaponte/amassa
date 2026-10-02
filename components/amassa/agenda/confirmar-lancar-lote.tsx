"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { lancarMensalidadesEmLote } from "@/lib/agenda/acoes";
import {
  FRASE_FALHA_AO_LANCAR_LOTE,
  ROTULO_LANCANDO_LOTE,
  ROTULO_VOLTAR,
  corpoConfirmarLote,
  fraseCorridaDoLote,
  rotuloConfirmarLote,
  rotuloDoBotaoDoLote,
  tituloConfirmarLote,
  toastDoLote,
} from "@/lib/agenda/textos";
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

const CLASSES_BOTAO = "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

export type ConfirmarLancarLoteProps = {
  ids: string[];
  quantas: number;
  // O total do lote já formatado (“R$ 900,00”) — o mesmo do botão.
  total: string;
};

// A confirmação final do lote de mensalidades (decisão do dono no chat, 02/10/2026 —
// VERIFICACAO-COWORK-05 §2 item 3; AGE-16). O gatilho é o próprio botão primário do lote (o ÚNICO
// terracota da aba, UI-D3) e só o confirmar do diálogo chama `lancarMensalidadesEmLote`: um toque não
// cria mais N vendas que só se desfazem uma a uma no Caixa. Molde dos confirmar-*.tsx da Agenda: em voo,
// “Lançando…” com os dois botões `disabled`, `aria-busy` e o `useRef` contra o toque duplo; o confirmar
// não fecha antes da resposta (`preventDefault`). Recusa ou falha: a frase DENTRO do diálogo
// (`role="alert"`), que continua aberto. Sucesso: os toasts de sempre e o diálogo fecha.
export function ConfirmarLancarLote({ ids, quantas, total }: ConfirmarLancarLoteProps) {
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
    try {
      const resposta = await lancarMensalidadesEmLote({ ids });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      const { lancadas, jaLancadas } = resposta.dados;
      if (jaLancadas > 0) {
        // A corrida (outro celular, o “Recebi agora” ou o “Lançar na Venda” no meio): nada duplicou.
        toast.info(fraseCorridaDoLote(lancadas, jaLancadas));
      } else {
        toast.success(toastDoLote(lancadas));
      }
      setAberto(false);
    } catch {
      // A transação é uma só: se a resposta não chegou, nenhuma venda foi criada pela metade.
      setErro(FRASE_FALHA_AO_LANCAR_LOTE);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        data-testid="lote-lancar"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className="text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal max-[359px]:w-full"
      >
        {rotuloDoBotaoDoLote(quantas, total)}
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
        <AlertDialogContent data-testid="confirmar-lote" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{tituloConfirmarLote(quantas)}</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {corpoConfirmarLote(quantas, total)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {erro !== null ? (
            <p data-testid="confirmar-lote-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirmar-lote-nao" disabled={enviando} className={CLASSES_BOTAO}>
              {ROTULO_VOLTAR}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirmar-lote-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO}
            >
              {enviando ? ROTULO_LANCANDO_LOTE : rotuloConfirmarLote(quantas)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
