"use client";

import { memo, useState } from "react";
import { toast } from "sonner";

import { removerTarefaDeAbertura } from "@/lib/abertura/acoes";
import { fraseConfirmarRemoverTarefa } from "@/lib/abertura/textos";
import {
  useRemoverTarefaId,
  useRouterAbertura,
} from "@/components/amassa/abertura/contexto-navegacao";
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

export type TarefaParaRemover = {
  id: string;
  descricao: string;
};

export type ConfirmarRemoverTarefaProps = {
  // A lista INTEIRA de tarefas (id/descrição), não uma tarefa só — mesmo molde de
  // confirmar-remover-item.tsx.
  tarefas: TarefaParaRemover[];
};

// UMA instância para a lista TODA (não mais uma por linha) — acha a tarefa certa por
// `?removerTarefa=<id>` dentro do array já carregado pela página. Mesmo molde e mesmo motivo
// quantitativo de `confirmar-remover-item.tsx` (ver .planning/debug/abertura-navegacao-trava.md).
// Nada de exclusão silenciosa — nomeia a tarefa, sempre (CLAUDE.md §Exclusão).
function ConfirmarRemoverTarefaBase({ tarefas }: ConfirmarRemoverTarefaProps) {
  const router = useRouterAbertura();
  const removerTarefaId = useRemoverTarefaId();
  const tarefa = tarefas.find((candidata) => candidata.id === removerTarefaId) ?? null;
  const aberto = tarefa !== null;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    router.push("/abertura?aba=tarefas");
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (!tarefa) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resposta = await removerTarefaDeAbertura(tarefa.id);

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
        {tarefa && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {fraseConfirmarRemoverTarefa(tarefa.descricao)}
              </AlertDialogTitle>
              <AlertDialogDescription>Ela deixa de aparecer na lista de tarefas.</AlertDialogDescription>
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
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Comparador PRÓPRIO explícito (nunca o padrão do `memo` — ver formulario-item.tsx e
// .planning/debug/abertura-navegacao-trava.md): compara pelo CONTEÚDO da lista, não pela
// referência do array.
function propsIguais(
  anterior: ConfirmarRemoverTarefaProps,
  atual: ConfirmarRemoverTarefaProps,
): boolean {
  return (
    anterior.tarefas.length === atual.tarefas.length &&
    anterior.tarefas.every(
      (tarefa, indice) =>
        tarefa.id === atual.tarefas[indice]?.id &&
        tarefa.descricao === atual.tarefas[indice]?.descricao,
    )
  );
}

export const ConfirmarRemoverTarefa = memo(ConfirmarRemoverTarefaBase, propsIguais);
