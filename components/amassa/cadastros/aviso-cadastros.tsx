"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export type AvisoCadastrosProps = {
  // O texto PRONTO, montado pela página no servidor a partir de `?aviso=categoria-desativada`
  // ou `?aviso=categoria-reativada` — este componente nunca lê a URL nem monta o texto sozinho,
  // mesmo molde de `AvisoFinanceiro` (components/amassa/financeiro/aviso-financeiro.tsx).
  texto: string | null;
};

// Mostra o toast UMA VEZ e limpa a query com `history.replaceState` — recarregar a página não
// repete o aviso.
export function AvisoCadastros({ texto }: AvisoCadastrosProps) {
  useEffect(() => {
    if (!texto) {
      return;
    }

    toast.success(texto);

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    window.history.replaceState(null, "", url.toString());
  }, [texto]);

  return null;
}
