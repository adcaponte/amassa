"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { criarOrcamento } from "@/lib/orcamentos/acoes";
import { ROTULO_NOVO_ORCAMENTO } from "@/lib/orcamentos/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

// "Novo orçamento" — o único acento terracota da tela (04.5-UI-SPEC.md §Color). Cliente porque
// precisa de estado local de "enviando" e de decidir a navegação depois da resposta do servidor.
//
// Gravar usa navegação COMPLETA (`window.location.assign`) — nunca a atualização client-side do
// roteador do Next.js — só o servidor sabe o resultado (o número do orçamento), e o defeito de
// agendamento do React/Next em produção documentado em `.planning/PROXIMA-SESSAO.md` ("Fase 4.2
// ensinou") já custou horas em Abertura/Encomendas/Queimas por confiar naquele antipadrão depois
// de uma Server Action.
export function NovoOrcamentoBotao({ className }: { className?: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (enviando) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resultado = await criarOrcamento({});

    if (!resultado.ok) {
      setErro(resultado.erro);
      setEnviando(false);
      return;
    }

    window.location.assign(hrefDoOrcamento(resultado.dados.id));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="default"
        disabled={enviando}
        onClick={() => void criar()}
        className={cn("min-h-[44px]", className)}
      >
        {enviando ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {ROTULO_NOVO_ORCAMENTO}
      </Button>
      {erro ? (
        <p className="text-apoio text-destructive max-w-[240px] text-right">{erro}</p>
      ) : null}
    </div>
  );
}
