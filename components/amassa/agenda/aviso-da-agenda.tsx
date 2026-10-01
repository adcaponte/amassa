"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export type AvisoDaAgendaProps = {
  // O texto PRONTO, montado pela página no servidor a partir de `?aviso=lancado&documento=<id>` (a volta
  // da Venda aberta pela Agenda — plano 12, UI-D26). Este componente nunca lê a URL para montar a frase —
  // mesmo molde de `AvisoCadastros` e `AvisoFinanceiro`.
  texto: string | null;
};

// Mostra o toast UMA vez e limpa `aviso` e `documento` da URL com `history.replaceState` — recarregar a
// página não repete o aviso (05-UI-SPEC.md §“Aba A receber”, “Volta da Venda”).
export function AvisoDaAgenda({ texto }: AvisoDaAgendaProps) {
  useEffect(() => {
    if (!texto) {
      return;
    }

    toast.success(texto);

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    url.searchParams.delete("documento");
    window.history.replaceState(null, "", url.toString());
  }, [texto]);

  return null;
}
