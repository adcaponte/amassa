"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { toastLancadoNaVenda } from "@/lib/agenda/textos";
import { toastLancadoNaVendaPago } from "@/lib/queimas/textos";

export type AvisoDasQueimasProps = {
  // A venda da volta do “Lançar na Venda” (`?aviso=lancado&documento=<id>`), LIDA NO SERVIDOR pela página
  // (`lerAvisoDaVolta`): o número e se ela saiu paga. `null` = nenhum aviso (sem parâmetro, documento que
  // não existe, ou a leitura falhou). Este componente nunca lê a URL para montar a frase.
  aviso: { numero: number; pago: boolean } | null;
};

// Mostra o aviso UMA vez e limpa `aviso` e `documento` da URL — recarregar não repete (molde
// `AvisoDaAgenda`, Fase 05). Venda com parcela em aberto: a frase da Agenda (“A parcela está em “o que
// vence” do Caixa.”); venda que saiu paga na própria Venda: “Já está no Caixa de hoje.” (UI-D24).
export function AvisoDasQueimas({ aviso }: AvisoDasQueimasProps) {
  const numero = aviso?.numero ?? null;
  const pago = aviso?.pago ?? false;

  useEffect(() => {
    if (numero === null) {
      return;
    }

    toast.success(pago ? toastLancadoNaVendaPago(numero) : toastLancadoNaVenda(numero), { duration: 5000 });

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    url.searchParams.delete("documento");
    window.history.replaceState(null, "", url.toString());
  }, [numero, pago]);

  return null;
}
