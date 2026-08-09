"use client";

import { Printer } from "lucide-react";

import { ROTULO_IMPRIMIR } from "@/lib/encomendas/textos";
import { Button } from "@/components/ui/button";

// Só existe para disparar `window.print()` — o navegador é quem decide o resto (impressora,
// PDF do próprio SO, pré-visualização). Não estava em `<files>` do plano por nome próprio: a
// própria `/encomendas/imprimir/page.tsx` é Server Component (`exigirUsuario()` na primeira
// instrução), e `window.print()` só existe no cliente — sem um Client Component sibling aqui,
// não haveria NENHUM jeito de disparar a impressão a partir da rota (Rule 2 — funcionalidade
// crítica ausente, mesmo idioma de `botao-salvar-encomenda.tsx` do plano 01). `print:hidden`
// (Tailwind v4) some da própria folha impressa — um botão "Imprimir" não faz sentido no papel.
export function BotaoImprimirFolha() {
  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="size-4" />
      {ROTULO_IMPRIMIR}
    </Button>
  );
}
