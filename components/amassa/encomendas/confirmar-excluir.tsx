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
import { excluirEncomenda } from "@/lib/encomendas/acoes";

export type ConfirmarExcluirProps = {
  id: string;
  nome: string;
  // A contagem que a página já carregou — mostrada ANTES de confirmar (D-09). A resposta real
  // de `excluirEncomenda` (lida dentro da mesma transação que apaga) é a fonte de verdade final;
  // se as duas divergirem (outra pessoa mexeu nos itens nesse meio-tempo), o toast de sucesso
  // informa a contagem real em vez da que a tela mostrou antes de confirmar.
  quantidadeDeItens: number;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
};

// `AlertDialog` destrutivo (D-08/D-09): título e botão de confirmação em `--color-erro` (via
// `variant="destructive"`, que resolve para o mesmo token). Formato literal de UI-08
// (`04-DESIGN-SYSTEM.md` §7): "Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão
// apagados." — singular quando N=1. PD-01/estado em trânsito: mesma regra de
// `confirmar-cancelar.tsx`.
export function ConfirmarExcluir({
  id,
  nome,
  quantidadeDeItens,
  aberto,
  aoMudarAberto,
}: ConfirmarExcluirProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await excluirEncomenda(id);

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    const mensagem =
      resposta.dados.itensApagados === quantidadeDeItens
        ? "Encomenda excluída."
        : `Encomenda excluída. (${resposta.dados.itensApagados} ${
            resposta.dados.itensApagados === 1 ? "item apagado" : "itens apagados"
          })`;
    toast.success(mensagem);
    aoMudarAberto(false);
    router.push("/encomendas");
  }

  const textoCorpo =
    quantidadeDeItens === 1
      ? "O item dela será apagado."
      : `Os ${quantidadeDeItens} itens dela serão apagados.`;

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
            Excluir a encomenda «{nome}»?
          </AlertDialogTitle>
          <AlertDialogDescription>{textoCorpo}</AlertDialogDescription>
        </AlertDialogHeader>

        {erro && (
          <p role="alert" className="text-apoio text-erro">
            {erro}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={enviando} onClick={confirmar}>
            {enviando ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
