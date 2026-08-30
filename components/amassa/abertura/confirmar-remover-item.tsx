"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { removerItemDeAbertura } from "@/lib/abertura/acoes";
import { formatarReais } from "@/lib/abertura/formato";
import { fraseConfirmarRemoverItem, fraseTarefasQueFicamSoltas } from "@/lib/abertura/textos";
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

export type ConfirmarRemoverItemProps = {
  id: string;
  nome: string;
  valorEmCentavos: number;
  // A contagem que a PÁGINA já carregou (D-14) — mostrada ANTES de confirmar. A resposta real de
  // `removerItemDeAbertura` (lida dentro da MESMA transação que remove) é a fonte de verdade
  // final; se as duas divergirem porque outra pessoa mexeu no meio, o `toast` de sucesso informa
  // a contagem real, não a que a tela mostrou antes de confirmar.
  tarefasLigadas: number;
};

// Montado UMA VEZ por linha (mesmo molde de `formulario-item.tsx`: cada instância lê o próprio
// `useSearchParams()` e só se considera aberta quando `?removerItem=<este id>` está na URL —
// nunca um `onClick` que abriria um estado local, o que exigiria promover `lista-itens.tsx` a
// Client Component inteiro). `FerramentasLinha` (Tarefa 2) só NAVEGA para essa URL; quem decide
// se mostra o diálogo é esta instância.
export function ConfirmarRemoverItem({
  id,
  nome,
  valorEmCentavos,
  tarefasLigadas,
}: ConfirmarRemoverItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aberto = searchParams.get("removerItem") === id;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    router.push("/abertura");
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await removerItemDeAbertura(id);

    setEnviando(false);

    if (!resposta.ok) {
      // Erro mostrado DENTRO do diálogo, sem fechá-lo.
      setErro(resposta.erro);
      return;
    }

    const { tarefasSoltas } = resposta.dados;
    const mensagem =
      tarefasSoltas === 0
        ? "Item removido."
        : `Item removido. (${tarefasSoltas} ${tarefasSoltas === 1 ? "tarefa ficou solta" : "tarefas ficaram soltas"})`;
    toast.success(mensagem);
    router.push("/abertura");
    router.refresh();
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!enviando && !novoValor) {
          fechar();
        }
      }}
    >
      <AlertDialogContent className="max-h-[85svh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">
            {fraseConfirmarRemoverItem(nome, formatarReais(valorEmCentavos))}
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="abertura-aviso-tarefas-ligadas">
            {tarefasLigadas > 0 ? fraseTarefasQueFicamSoltas(tarefasLigadas) : null}
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
            {enviando ? "Removendo…" : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
