"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { removerTarefaDeAbertura } from "@/lib/abertura/acoes";
import { fraseConfirmarRemoverTarefa } from "@/lib/abertura/textos";
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

export type ConfirmarRemoverTarefaProps = {
  id: string;
  descricao: string;
};

// Mesmo molde de `ConfirmarRemoverItem`: montado UMA VEZ por linha, lê o próprio
// `useSearchParams()` e só se considera aberta quando `?removerTarefa=<este id>` está na URL.
// Nada de exclusão silenciosa — nomeia a tarefa, sempre (CLAUDE.md §Exclusão).
export function ConfirmarRemoverTarefa({ id, descricao }: ConfirmarRemoverTarefaProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aberto = searchParams.get("removerTarefa") === id;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    router.push("/abertura?aba=tarefas");
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await removerTarefaDeAbertura(id);

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    toast.success("Tarefa removida.");
    router.push("/abertura?aba=tarefas");
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
            {fraseConfirmarRemoverTarefa(descricao)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ela deixa de aparecer na lista de tarefas.
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
