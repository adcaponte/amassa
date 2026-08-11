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
import { excluirQueima } from "@/lib/queimas/acoes";
import { TITULO_EXCLUIR_QUEIMA, corpoExcluirQueima } from "@/lib/queimas/textos";

export type ConfirmarExcluirQueimaProps = {
  id: string;
  nomeDoForno: string;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
};

// `AlertDialog` destrutivo quase idêntico a `components/amassa/encomendas/confirmar-excluir.tsx`
// (E8, FOR-10): `event.preventDefault()` no clique de confirmação para o dialog não fechar antes
// da resposta do servidor, `onOpenChange` ignora fechamento enquanto `enviando` é verdadeiro,
// erro renderizado com `role="alert"` DENTRO do dialog (que continua aberto — o gestor vê que
// nada foi excluído). Diferença deliberada do análogo: NÃO navega depois do sucesso —
// `excluirQueima` já revalida `/queimas/[id]` (04-PATTERNS.md), e `router.refresh()` busca os
// dados frescos do Server Component sem sair da página do forno.
export function ConfirmarExcluirQueima({
  id,
  nomeDoForno,
  aberto,
  aoMudarAberto,
}: ConfirmarExcluirQueimaProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await excluirQueima(id);

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    toast.success("Queima excluída.");
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
          <AlertDialogTitle>{TITULO_EXCLUIR_QUEIMA}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {corpoExcluirQueima(nomeDoForno)}
          </AlertDialogDescription>
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
