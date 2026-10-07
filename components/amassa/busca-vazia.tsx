import { DICA_BUSCA_POR_PALAVRAS, fraseNadaEncontradoPara } from "@/lib/busca/textos";
import { cn } from "@/lib/utils";

// O vazio de uma busca com termo que não achou nada (06.5-UI-SPEC.md §"Estados vazios", D-17): o
// termo entre aspas e a regra da busca, dizendo o que fazer. O mesmo bloco na Venda, na Compra e nas
// pessoas. `data-termo` leva o termo como foi digitado (aparado), para o e2e conferir.
export function BuscaVazia({ termo, className }: { termo: string; className?: string }) {
  return (
    <div data-testid="busca-vazia" data-termo={termo.trim()} className={cn("flex flex-col gap-1", className)}>
      <p className="text-corpo text-tinta [overflow-wrap:anywhere]">{fraseNadaEncontradoPara(termo)}</p>
      <p className="text-apoio text-tinta-fraca">{DICA_BUSCA_POR_PALAVRAS}</p>
    </div>
  );
}
