"use client";

import { useState } from "react";
import { toast } from "sonner";

import { gerarContasDoMes } from "@/lib/cadastros/acoes";
import { rotuloGerarContas } from "@/lib/cadastros/textos";

export type BotaoGerarContasProps = {
  // "YYYY-MM" — o mês que a ação de fato grava (sempre o mês seguinte ao de hoje,
  // `mesDaGeracao`, lib/cadastros/contas-fixas.ts).
  mes: string;
  // Já formatado por extenso (`nomeDoMes`, lib/financeiro/formato.ts) — este componente nunca
  // formata data.
  mesPorExtenso: string;
  // Desabilitado sem nenhuma conta fixa ATIVA (must_have do plano) — decidido pela página, que já
  // tem a lista carregada, nunca uma segunda consulta disparada por este botão.
  existeContaAtiva: boolean;
};

// O único botão terracota da sub-aba Contas fixas (04.4-UI-SPEC.md — "+ Nova conta fixa" é
// contorno para não ter duas ações terracota na mesma tela). Desabilitado enquanto grava — duplo
// toque não dispara duas vezes NESTA tela, e mesmo que disparasse, o `on conflict do nothing` do
// servidor (`gerarContasDoMes`) segura a idempotência de qualquer jeito.
export function BotaoGerarContas({ mes, mesPorExtenso, existeContaAtiva }: BotaoGerarContasProps) {
  const [enviando, setEnviando] = useState(false);

  async function gerar() {
    if (enviando) {
      return;
    }
    setEnviando(true);

    const resposta = await gerarContasDoMes({ mes });

    setEnviando(false);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    // Navegação COMPLETA com o aviso na URL — o servidor monta o texto certo ("N criada(s)" ou
    // "já existiam"), nunca um toast local antes de a lista real ter carregado.
    window.location.assign(
      `/cadastros?sub=fixas&aviso=contas-geradas&quantidade=${resposta.dados.criadas}&mes=${resposta.dados.mes}`,
    );
  }

  return (
    <button
      type="button"
      data-testid="gerar-contas"
      disabled={!existeContaAtiva || enviando}
      aria-busy={enviando}
      onClick={() => void gerar()}
      className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
    >
      {enviando ? "Gerando…" : rotuloGerarContas(mesPorExtenso)}
    </button>
  );
}
