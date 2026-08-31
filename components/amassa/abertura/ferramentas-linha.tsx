"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { rotuloEditar, rotuloRemover } from "@/lib/abertura/textos";
import { useAbridorAbertura } from "@/components/amassa/abertura/contexto-navegacao";

export type FerramentasLinhaProps = {
  // Uma caixa só serve às duas listas — o `tipo` decide o sufixo dos `data-testid`
  // ("abertura-editar-item"/"abertura-editar-tarefa" etc., ver artefatos do 04.2-03-PLAN.md).
  tipo: "item" | "tarefa";
  nome: string;
  hrefEditar: string;
  // O botão de remover só ABRE o diálogo (D-14, Tarefa 3 deste plano) — navega para a URL que o
  // `ConfirmarRemoverItem`/`ConfirmarRemoverTarefa` (montado ao lado da linha, ver
  // `lista-itens.tsx`/`lista-tarefas.tsx`) lê via o contexto de `contexto-navegacao.tsx`, exatamente como
  // `?item=<id>` já abre `FormularioItem` — nunca um `onClick` que apagaria direto.
  hrefRemover: string;
  // O identificador desta linha. O botão NAVEGA (a URL segue compartilhável) e ABRE o diálogo
  // localmente no mesmo toque — ver o comentário do abridor em contexto-navegacao.tsx. Sem o
  // segundo caminho, um toque cuja navegação não confirma não abre nada.
  id: string;
};

// Os dois botões só com ícone da linha (`Pencil`/`Trash2`, `lucide-react`, `aria-hidden="true"`
// no ícone) — cada um com `aria-label` dizendo o que faz E SOBRE O QUÊ ("Editar Bancada de
// trabalho", nunca só "Editar", CLAUDE.md §Acessibilidade). Os botões medem 30px por 30px
// DENTRO de uma linha de 44px ou mais (o pai garante a altura mínima) — o que mantém a área
// alcançável mesmo com o botão visualmente menor que 44px.
export function FerramentasLinha({
  tipo,
  nome,
  hrefEditar,
  hrefRemover,
  id,
}: FerramentasLinhaProps) {
  const abridor = useAbridorAbertura();
  const abrirEditar = tipo === "item" ? abridor.abrirItem : abridor.abrirTarefa;
  const abrirRemover = tipo === "item" ? abridor.abrirRemoverItem : abridor.abrirRemoverTarefa;

  return (
    <div className="flex flex-none items-center gap-0.5">
      <Link
        href={hrefEditar}
        onClick={() => abrirEditar(id)}
        aria-label={rotuloEditar(nome)}
        data-testid={`abertura-editar-${tipo}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-[30px] items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href={hrefRemover}
        onClick={() => abrirRemover(id)}
        aria-label={rotuloRemover(nome)}
        data-testid={`abertura-remover-${tipo}`}
        className="text-muted-foreground hover:bg-erro-fundo hover:text-erro focus-visible:ring-ring flex size-[30px] items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
