"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ConfirmarCancelar } from "./confirmar-cancelar";
import { ConfirmarExcluir } from "./confirmar-excluir";

export type AcoesEncomendaProps = {
  id: string;
  nome: string;
  quantidadeDeItens: number;
};

// Hierarquia visual de D-08: "Editar" (terracota, único botão desta cor na tela) e "Cancelar
// encomenda" (`outline`) ficam à vista, lado a lado; "Excluir encomenda" só existe dentro do
// menu "⋮ Mais ações", separado por pelo menos 16px do grupo — nunca um botão "Excluir" solto ao
// lado de "Cancelar" (dois botões parecidos com consequências muito diferentes, numa tela
// pequena e com a mão suja, é pedido de acidente).
export function AcoesEncomenda({ id, nome, quantidadeDeItens }: AcoesEncomendaProps) {
  const [dialogoCancelarAberto, setDialogoCancelarAberto] = useState(false);
  const [dialogoExcluirAberto, setDialogoExcluirAberto] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-3">
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href={`/encomendas?editar=${id}`}>Editar</Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => setDialogoCancelarAberto(true)}
        >
          Cancelar encomenda
        </Button>
      </div>

      {/* `ml-4` (16px) garante a distância mínima do grupo Editar/Cancelar exigida por
          03-UI-SPEC.md — "⋮" nunca fica colado nos outros dois. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="Mais ações da encomenda"
            className="ml-4 flex size-11 items-center justify-center p-0"
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setDialogoExcluirAberto(true)}>
            <Trash2 aria-hidden="true" />
            Excluir encomenda
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmarCancelar
        id={id}
        nome={nome}
        aberto={dialogoCancelarAberto}
        aoMudarAberto={setDialogoCancelarAberto}
      />
      <ConfirmarExcluir
        id={id}
        nome={nome}
        quantidadeDeItens={quantidadeDeItens}
        aberto={dialogoExcluirAberto}
        aoMudarAberto={setDialogoExcluirAberto}
      />
    </div>
  );
}
