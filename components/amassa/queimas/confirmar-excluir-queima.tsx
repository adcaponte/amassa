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
  // Fase 06.4 (QMC-11): as peças da contagem da queima, ou `null` sem contagem — com contagem, a frase
  // diz que ela vai junto (o cascade da 0030); sem, a frase herdada, sem mudança.
  pecasContadas: number | null;
  // Plano 04 (D-07, UI-D25): os números das vendas ATIVAS ligadas — elas continuam no Caixa
  // (`queima_vendas.documento_id` sem cascade), e a frase diz isso. Vazio: sem a frase das vendas.
  numerosDasVendasAtivas?: readonly number[];
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
  pecasContadas,
  numerosDasVendasAtivas = [],
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

    // 06.4-WR-03 (quick 261005-2yu, 05/10/2026): manda as vendas ativas que este diálogo MOSTRA agora; o
    // servidor confere sob a trava e recusa se a queima tiver ganhado venda depois de a página carregar.
    const resposta = await excluirQueima({ id, vendasVistas: [...numerosDasVendasAtivas] });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      if (resposta.telaMudou) {
        // O diálogo continua aberto com a frase; a página é relida e a descrição passa a citar a venda.
        // Confirmar de novo manda a lista nova.
        router.refresh();
      }
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
            {corpoExcluirQueima(nomeDoForno, pecasContadas, numerosDasVendasAtivas)}
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
