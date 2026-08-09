import Link from "next/link";

import { Button } from "@/components/ui/button";

export type AcoesEncomendaProps = {
  id: string;
  nome: string;
  quantidadeDeItens: number;
};

// Versão inicial (Tarefa 1): só "Editar", único botão terracota da tela (03-UI-SPEC.md
// "Color"). "Cancelar encomenda" e o menu "⋮ Mais ações" (excluir) chegam na Tarefa 3, que
// substitui este arquivo pela hierarquia completa de D-08.
export function AcoesEncomenda({ id }: AcoesEncomendaProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="default" className="min-h-[44px]">
        <Link href={`/encomendas?editar=${id}`}>Editar</Link>
      </Button>
    </div>
  );
}
