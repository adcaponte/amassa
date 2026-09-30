"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { terminarEtapa } from "@/lib/producao/acoes";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  FRASE_FALHA_AO_MARCAR,
  ROTULO_MARCANDO,
  rotuloTerminei,
  textoToastTerminei,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";

// Depois de marcar, o botão novo ("Terminei: {próxima}") só aceita toque 1 s depois de aparecer —
// dois toques rápidos nunca marcam duas etapas (UI-SPEC §"Orçamento de toques").
const ESPERA_DEPOIS_DE_MARCAR_MS = 1000;

export type BotaoTermineiProps = {
  ordemId: string;
  tipo: TipoOrdem;
  // A etapa atual que a tela MOSTRA — vai para o servidor como `etapaEsperada` (Pitfall 7).
  etapa: EtapaProducao;
};

// "Terminei: {Etapa}" (UI-SPEC §Ações): primário, sem confirmação, sem campo, sem teclado — o
// segundo toque do caminho do quadro à etapa marcada (Valor central). Enquanto grava: "Marcando…",
// `disabled`, `aria-busy`. Sucesso: toast "Feito: X. Agora: Y." e `router.refresh()`. Recusa ("já
// tinha sido marcada", outro celular) ou falha: a frase embaixo do botão, `role="alert"`, e a tela
// recarrega o estado — nunca grava por cima. A data da etapa é decidida no servidor.
//
// O componente NÃO muda de chave quando a etapa muda: a frase de erro e a espera de 1 s sobrevivem
// ao `router.refresh()`.
export function BotaoTerminei({ ordemId, tipo, etapa }: BotaoTermineiProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!esperando) {
      return;
    }
    const temporizador = window.setTimeout(() => setEsperando(false), ESPERA_DEPOIS_DE_MARCAR_MS);
    return () => window.clearTimeout(temporizador);
  }, [esperando]);

  async function aoTocar() {
    if (emVoo.current || esperando) {
      return;
    }
    emVoo.current = true;
    setGravando(true);
    setErro(null);
    try {
      const resultado = await terminarEtapa({ ordemId, etapaEsperada: etapa });
      if (resultado.ok) {
        toast.success(
          textoToastTerminei(
            rotuloDaEtapa(resultado.dados.etapa, tipo),
            rotuloDaEtapa(resultado.dados.proxima, tipo),
          ),
        );
        setEsperando(true);
      } else {
        setErro(resultado.erro);
      }
    } catch {
      setErro(FRASE_FALHA_AO_MARCAR);
    } finally {
      emVoo.current = false;
      setGravando(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 md:items-end">
      <Button
        type="button"
        data-testid="ordem-terminei"
        className="text-corpo h-auto min-h-[52px] px-6 font-semibold leading-tight whitespace-normal"
        disabled={gravando || esperando}
        aria-busy={gravando ? "true" : undefined}
        onClick={aoTocar}
      >
        {gravando ? ROTULO_MARCANDO : rotuloTerminei(rotuloDaEtapa(etapa, tipo))}
      </Button>
      {erro ? (
        <p data-testid="ordem-terminei-erro" role="alert" className="text-apoio text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
