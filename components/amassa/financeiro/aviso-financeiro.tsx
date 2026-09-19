"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export type AvisoFinanceiroProps = {
  // O texto PRONTO, montado pela página no servidor a partir de `?aviso=lancado&documento=<id>`
  // — este componente nunca lê a URL nem monta o texto sozinho (T-04.4-09 do threat model:
  // nenhum texto refletido da URL, sempre montado a partir do banco).
  texto: string | null;
};

// Mostra o toast UMA VEZ e limpa a query com `history.replaceState` — recarregar a página não
// repete o aviso (mesmo padrão de `registrar-queima.tsx`, sem o `router.refresh` de lá, que é o
// antipadrão que este módulo não copia).
export function AvisoFinanceiro({ texto }: AvisoFinanceiroProps) {
  useEffect(() => {
    if (!texto) {
      return;
    }

    toast.success(texto);

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    url.searchParams.delete("documento");
    url.searchParams.delete("parcela");
    window.history.replaceState(null, "", url.toString());
  }, [texto]);

  return null;
}
