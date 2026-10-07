"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export type AvisoCadastrosProps = {
  // O texto PRONTO, montado pela página no servidor a partir de `?aviso=categoria-desativada`
  // ou `?aviso=categoria-reativada` — este componente nunca lê a URL nem monta o texto sozinho,
  // mesmo molde de `AvisoFinanceiro` (components/amassa/financeiro/aviso-financeiro.tsx).
  texto: string | null;
  // "erro" para o anexo de fornecedor que não abriu (06.2-WR-02, quick 261005-2yu); o resto é sucesso.
  tom?: "sucesso" | "erro";
};

// Mostra o toast UMA VEZ e limpa a query com `history.replaceState` — recarregar a página não
// repete o aviso.
export function AvisoCadastros({ texto, tom = "sucesso" }: AvisoCadastrosProps) {
  useEffect(() => {
    if (!texto) {
      return;
    }

    if (tom === "erro") {
      toast.error(texto);
    } else {
      toast.success(texto);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    // Os parâmetros do aviso das contas geradas (06.5-WR-03, quick 261007-shs: `mantidas`) saem junto.
    url.searchParams.delete("quantidade");
    url.searchParams.delete("mes");
    url.searchParams.delete("mantidas");
    window.history.replaceState(null, "", url.toString());
  }, [texto, tom]);

  return null;
}
