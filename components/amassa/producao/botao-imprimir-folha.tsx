"use client";

import { Printer } from "lucide-react";

import { ROTULO_IMPRIMIR_FOLHA } from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";

// "Imprimir folha" (primário) da barra das folhas A4 — só dispara `window.print()`; o navegador
// decide o resto (impressora, PDF do próprio sistema). Nenhum PDF é gerado no servidor (§7.1). A
// barra inteira é `print:hidden`: um botão de imprimir não faz sentido no papel.
export function BotaoImprimirFolha() {
  return (
    <Button
      type="button"
      data-testid="folha-imprimir"
      onClick={() => window.print()}
      className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
    >
      <Printer aria-hidden="true" className="size-4" />
      {ROTULO_IMPRIMIR_FOLHA}
    </Button>
  );
}
