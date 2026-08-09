import Link from "next/link";
import { Printer } from "lucide-react";

import { NOTA_NADA_PARA_IMPRIMIR, ROTULO_IMPRIMIR } from "@/lib/encomendas/textos";
import { Button } from "@/components/ui/button";

export type BotaoImprimirProps = {
  // Contagem de encomendas `rascunho`/`em_producao` já carregada pelo Server Component
  // (`page.tsx`) — o mesmo filtro que `listarEncomendasAtivas()` aplicaria, sem precisar de
  // uma segunda consulta ao banco só para decidir se o botão liga ou desliga.
  contagemAtivas: number;
};

// Botão do cabeçalho do índice levando a `/encomendas/imprimir` (D-18, ENC-14). Nunca terracota
// (`variant="default"` já pertence a "Nova encomenda" — 03-UI-SPEC.md §Color: um botão
// terracota por tela). Sem nenhuma ativa, decisão do dono (03-UI-SPEC.md "Sem nenhuma
// encomenda ativa"): o botão fica `disabled` no MESMO lugar de sempre, nunca some — com a nota
// abaixo dele, sempre no documento (nunca só em `title`/tooltip, para ser lida sem interação,
// inclusive por leitor de tela — mesma regra que `estado-vazio.tsx` já documenta).
export function BotaoImprimir({ contagemAtivas }: BotaoImprimirProps) {
  if (contagemAtivas === 0) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="outline" disabled aria-disabled="true" className="min-h-[44px]">
          <Printer aria-hidden="true" className="size-4" />
          {ROTULO_IMPRIMIR}
        </Button>
        <p className="text-apoio text-muted-foreground">{NOTA_NADA_PARA_IMPRIMIR}</p>
      </div>
    );
  }

  return (
    <Button asChild variant="outline" className="min-h-[44px]">
      <Link href="/encomendas/imprimir">
        <Printer aria-hidden="true" className="size-4" />
        {ROTULO_IMPRIMIR}
      </Link>
    </Button>
  );
}
