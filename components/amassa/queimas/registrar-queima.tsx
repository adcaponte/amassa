"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { excluirQueima, registrarQueima } from "@/lib/queimas/acoes";
import {
  FRASE_FALHA_AO_DESFAZER,
  FRASE_FALHA_AO_REGISTRAR_QUEIMA,
  ROTULO_DESFAZER,
  ROTULO_QUEIMAR,
  TOAST_QUEIMA_DESFEITA,
  TOAST_QUEIMA_REGISTRADA,
  rotuloDoTipo,
  type TipoDeQueima,
} from "@/lib/queimas/textos";
import { Button } from "@/components/ui/button";

// Ordem fixa e estável — Biscoito · Esmalte · Ouro — em qualquer largura de tela (04-01-PLAN.md
// Tarefa 3, edge probe FOR-03).
const TIPOS_EM_ORDEM: readonly TipoDeQueima[] = ["biscoito", "esmalte", "ouro"];

export type RegistrarQueimaProps = {
  fornoId: string;
};

// D-04, o fluxo mais usado do sistema inteiro: dois toques — "Queimar" no cartão, depois o
// tipo — sem formulário, sem campo, sem confirmação (proibição deste plano). Divergência
// DELIBERADA do análogo `AjusteRapidoEtapa` (`components/amassa/encomendas/ajuste-rapido-etapa.tsx`):
// NADA muda na tela antes da resposta do servidor — a queima existe porque o banco confirmou,
// nunca porque o cliente supôs. O seletor abre imediatamente no primeiro toque, sem nenhum
// indicador de carregamento entre os dois toques (E3/loading, backstop, FOR-01) — só o segundo
// toque (a escrita em si) desabilita os três botões enquanto está pendente.
export function RegistrarQueima({ fornoId }: RegistrarQueimaProps) {
  const router = useRouter();
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [pendente, setPendente] = useState(false);

  async function registrar(tipo: TipoDeQueima) {
    setPendente(true);

    const resposta = await registrarQueima({ fornoId, tipo });

    setPendente(false);
    setSeletorAberto(false);

    if (!resposta.ok) {
      // Nunca perda silenciosa: o contador do cartão permanece no valor anterior porque nada
      // mudou na tela antes desta resposta (fluxo não otimista, de propósito).
      toast.error(FRASE_FALHA_AO_REGISTRAR_QUEIMA);
      return;
    }

    const { id } = resposta.dados;

    // Os 7 segundos são a única exceção aos 5s do resto do sistema — ali o aviso não é
    // informativo, é uma janela de ação (04-DESIGN-SYSTEM.md §7).
    toast.success(TOAST_QUEIMA_REGISTRADA, {
      duration: 7000,
      action: {
        label: ROTULO_DESFAZER,
        onClick: () => {
          void desfazer(id);
        },
      },
    });

    router.refresh();
  }

  async function desfazer(idDaQueima: string) {
    const resposta = await excluirQueima(idDaQueima);

    if (!resposta.ok) {
      // A queima permanece registrada — o que a tela mostra é sempre o estado real, nunca um
      // contador otimista órfão.
      toast.error(FRASE_FALHA_AO_DESFAZER);
      return;
    }

    toast.success(TOAST_QUEIMA_DESFEITA);
    router.refresh();
  }

  if (!seletorAberto) {
    return (
      <Button
        type="button"
        variant="default"
        className="min-h-[44px] w-full md:w-auto"
        onClick={() => setSeletorAberto(true)}
      >
        {ROTULO_QUEIMAR}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="seletor-tipo-queima">
      {TIPOS_EM_ORDEM.map((tipo) => (
        <Button
          key={tipo}
          type="button"
          variant="outline"
          disabled={pendente}
          className="min-h-[44px] w-full"
          data-testid={`tipo-queima-${tipo}`}
          onClick={() => {
            void registrar(tipo);
          }}
        >
          {rotuloDoTipo(tipo)}
        </Button>
      ))}

      <button
        type="button"
        disabled={pendente}
        onClick={() => setSeletorAberto(false)}
        className="text-apoio text-muted-foreground hover:text-foreground flex min-h-[44px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancelar
      </button>
    </div>
  );
}
