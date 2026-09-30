"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cancelarOrdem } from "@/lib/producao/acoes";
import {
  FRASE_FALHA_AO_CANCELAR,
  ROTULO_CANCELANDO,
  ROTULO_CANCELAR_ORDEM,
  ROTULO_MANTER_ORDEM,
  TOAST_CANCELADA,
  textoConfirmarCancelar,
  tituloConfirmarCancelar,
} from "@/lib/producao/textos";
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

// O "Cancelar ordem" (`outline` de erro) é o mesmo nos dois lugares em que aparece: o bloco próprio
// da página e o aviso de venda cancelada (D-07). Nunca os dois juntos (UI-SPEC §"Página da ordem").
export const CLASSES_BOTAO_CANCELAR_ORDEM =
  "border-erro text-erro text-corpo min-h-[44px] px-4 font-semibold whitespace-normal";

export type ConfirmarCancelarOrdemProps = {
  ordemId: string;
  nome: string;
  // O que o corpo da confirmação diz, por caso (UI-SPEC §Confirmações).
  baixasFeitas: number;
  vendaNumero: number | null;
  vendaCancelada: boolean;
  // A ordem ainda se cancela (aguardando ou ativa) e ESTE é o lugar do botão? Quem desenha monta o
  // componente SEMPRE no mesmo lugar e só desliga o botão: depois do `router.refresh()` de uma
  // recusa (outro celular cancelou antes), a ordem deixa de se cancelar, o botão some — mas o
  // diálogo continua montado e a frase da recusa fica na tela (molde de `CaixaAguardando`).
  podeCancelar: boolean;
  // Classes do botão (o bloco da página e o aviso têm alinhamentos diferentes).
  className?: string;
};

// "Cancelar ordem" (PRD-18, UI-SPEC §Confirmações): `AlertDialog` destrutivo que diz, ANTES de
// confirmar, o que NÃO acontece — as baixas de material já feitas não voltam para o estoque, e a
// venda no Financeiro não é cancelada junto (o dono decide lá o que fazer com o sinal). O botão de
// confirmar não fecha antes da resposta do servidor (molde de `ConfirmarCancelarDocumento`); em voo
// "Cancelando…", os dois botões desabilitados e `aria-busy`. Sucesso: toast, e a resposta da ação
// traz a página revalidada (a página mostra o resultado da cancelada). Recusa ou falha: a frase dentro do diálogo, `role="alert"`,
// e a tela recarrega o estado.
export function ConfirmarCancelarOrdem({
  ordemId,
  nome,
  baixasFeitas,
  vendaNumero,
  vendaCancelada,
  podeCancelar,
  className,
}: ConfirmarCancelarOrdemProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O corpo é FOTOGRAFADO no toque: se a tela recarregar por baixo com o diálogo aberto, ele
  // continua dizendo o que a pessoa leu (molde de `ConfirmarDesfazer`).
  const [corpo, setCorpo] = useState("");

  function abrir() {
    setCorpo(textoConfirmarCancelar({ baixasFeitas, vendaNumero, vendaCancelada }));
    setErro(null);
    setAberto(true);
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await cancelarOrdem({ ordemId });
      if (resultado.ok) {
        // Sem `router.refresh()`: a ação já revalida esta página e a resposta dela traz a árvore
        // nova (revisão 06.1, WR-106; `.planning/debug/abertura-navegacao-trava.md`).
        toast.success(TOAST_CANCELADA);
        setAberto(false);
      } else {
        setErro(resultado.erro);
        // A recusa volta antes de qualquer `revalidatePath`: a recarga do estado é daqui.
        router.refresh();
      }
    } catch {
      setErro(FRASE_FALHA_AO_CANCELAR);
      router.refresh();
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      {podeCancelar ? (
        <Button
          type="button"
          variant="outline"
          data-testid="ordem-cancelar"
          onClick={abrir}
          className={cn(CLASSES_BOTAO_CANCELAR_ORDEM, "h-auto", className)}
        >
          {ROTULO_CANCELAR_ORDEM}
        </Button>
      ) : null}

      <AlertDialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !enviando) {
            setErro(null);
            setAberto(false);
          }
        }}
      >
        <AlertDialogContent
          data-testid="ordem-confirmar-cancelar"
          className="max-h-[85svh] overflow-y-auto"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {tituloConfirmarCancelar(nome)}
            </AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {corpo}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p data-testid="ordem-cancelar-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="ordem-confirmar-cancelar-nao"
              disabled={enviando}
              className="text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal"
            >
              {ROTULO_MANTER_ORDEM}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="ordem-confirmar-cancelar-sim"
              // Depois de uma recusa a ordem já não se cancela: o botão fica, desabilitado, ao lado
              // da frase que explica por quê.
              disabled={enviando || !podeCancelar}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={cn(CLASSES_BOTAO_CANCELAR_ORDEM, "h-auto")}
            >
              {enviando ? ROTULO_CANCELANDO : ROTULO_CANCELAR_ORDEM}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
