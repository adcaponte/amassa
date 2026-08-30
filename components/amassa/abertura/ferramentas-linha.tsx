import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { rotuloEditar, rotuloRemover } from "@/lib/abertura/textos";

export type FerramentasLinhaProps = {
  // Uma caixa só serve às duas listas — o `tipo` decide o sufixo dos `data-testid`
  // ("abertura-editar-item"/"abertura-editar-tarefa" etc., ver artefatos do 04.2-03-PLAN.md).
  tipo: "item" | "tarefa";
  nome: string;
  hrefEditar: string;
  // O botão de remover só ABRE o diálogo (D-14, Tarefa 3 deste plano) — navega para a URL que o
  // `ConfirmarRemoverItem`/`ConfirmarRemoverTarefa` (montado ao lado da linha, ver
  // `lista-itens.tsx`/`lista-tarefas.tsx`) lê pelo próprio `useSearchParams()`, exatamente como
  // `?item=<id>` já abre `FormularioItem` — nunca um `onClick` que apagaria direto.
  hrefRemover: string;
};

// Os dois botões só com ícone da linha (`Pencil`/`Trash2`, `lucide-react`, `aria-hidden="true"`
// no ícone) — cada um com `aria-label` dizendo o que faz E SOBRE O QUÊ ("Editar Bancada de
// trabalho", nunca só "Editar", CLAUDE.md §Acessibilidade). Os botões medem 30px por 30px
// DENTRO de uma linha de 44px ou mais (o pai garante a altura mínima) — o que mantém a área
// alcançável mesmo com o botão visualmente menor que 44px.
export function FerramentasLinha({ tipo, nome, hrefEditar, hrefRemover }: FerramentasLinhaProps) {
  return (
    <div className="flex flex-none items-center gap-0.5">
      <Link
        href={hrefEditar}
        aria-label={rotuloEditar(nome)}
        data-testid={`abertura-editar-${tipo}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-[30px] items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href={hrefRemover}
        aria-label={rotuloRemover(nome)}
        data-testid={`abertura-remover-${tipo}`}
        className="text-muted-foreground hover:bg-erro-fundo hover:text-erro focus-visible:ring-ring flex size-[30px] items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
