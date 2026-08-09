"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { cancelarEncomenda } from "@/lib/encomendas/acoes";

export type ConfirmarCancelarProps = {
  id: string;
  nome: string;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
};

// `AlertDialog` NÃO destrutivo (D-08): título e botão de confirmação em `outline`, NUNCA
// vermelho — cancelar é o caminho normal quando um cliente desiste, não um erro. PD-01: o nome
// da encomenda quebra em linha dentro do título (nunca trunca), o conteúdo rola se precisar
// (`max-h-[85svh] overflow-y-auto`). Estado em trânsito (decisão do dono, 03-UI-SPEC.md): o
// botão de confirmar desabilita e o diálogo NÃO fecha até haver resposta do servidor.
export function ConfirmarCancelar({ id, nome, aberto, aoMudarAberto }: ConfirmarCancelarProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    // Radix fecha o AlertDialog sozinho ao clicar em Action, a menos que `preventDefault()`
    // seja chamado — é isso que impede o diálogo de fechar antes da resposta do servidor.
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await cancelarEncomenda(id);

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    toast.success("Encomenda cancelada.");
    aoMudarAberto(false);
    router.refresh();
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!enviando) {
          aoMudarAberto(novoValor);
          if (novoValor) {
            setErro(null);
          }
        }
      }}
    >
      <AlertDialogContent className="max-h-[85svh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">
            Cancelar a encomenda «{nome}»?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ela sai do Gantt e vai para o histórico. Dá para consultar depois, mas não dá para reabrir
            — se foi engano, prefira Excluir.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {erro && (
          <p role="alert" className="text-apoio text-erro">
            {erro}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="outline" disabled={enviando} onClick={confirmar}>
            {enviando ? "Cancelando…" : "Cancelar encomenda"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
