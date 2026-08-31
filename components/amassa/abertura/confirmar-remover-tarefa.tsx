"use client";

import { memo, useState } from "react";

import { removerTarefaDeAbertura } from "@/lib/abertura/acoes";
import { fraseConfirmarRemoverTarefa } from "@/lib/abertura/textos";
import {
  useRemoverTarefaId,
  useAbridorAbertura,
} from "@/components/amassa/abertura/contexto-navegacao";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
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
  const abridor = useAbridorAbertura();
  const removerTarefaId = useRemoverTarefaId();
  const tarefa = tarefas.find((candidata) => candidata.id === removerTarefaId) ?? null;
  const aberto = tarefa !== null;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fecha pelos DOIS caminhos, sempre juntos (ver useFecharDialogo/o abridor em
  // contexto-navegacao.tsx): zera o valor local E devolve a URL. Só um dos dois deixaria o
  // diálogo preso aberto quando a navegação de abertura não tivesse confirmado.
  function fechar() {
    setErro(null);
    abridor.abrirRemoverTarefa(null);
    irParaSemNavegar("/abertura?aba=tarefas");
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

    // Navegacao COMPLETA de proposito, nunca `router.push` + `router.refresh()`.
    // Depois de gravar, a lista precisa refletir o que SO o servidor sabe (um item renomeado,
    // uma linha que sumiu) -- e e exatamente essa confirmacao de transicao que falha em
    // silencio no React/Next (.planning/debug/abertura-navegacao-trava.md). Marcar, abrir e
    // editar ja nao dependem dela, porque o cliente tem o dado; isto aqui depende, e nao ha
    // como deduzir localmente. Um carregamento inteiro custa uns 200ms numa acao POUCO
    // frequente (salvar/remover) e sempre mostra a verdade -- ao contrario do caminho rapido,
    // que as vezes mostrava o valor velho.
    // Sem `toast` de sucesso: ele nao sobrevive ao carregamento. A propria lista ja atualizada
    // e a confirmacao -- mais forte que um aviso que some em tres segundos.
    window.location.assign("/abertura?aba=tarefas");
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
