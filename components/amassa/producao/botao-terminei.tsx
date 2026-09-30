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

// O botão novo ("Terminei: {próxima}") só aceita toque 1 s depois de aparecer — dois toques
// rápidos nunca marcam duas etapas (UI-SPEC §"Orçamento de toques").
const ESPERA_DEPOIS_DE_MUDAR_MS = 1000;

export type BotaoTermineiProps = {
  ordemId: string;
  tipo: TipoOrdem;
  // A etapa atual que a tela MOSTRA — vai para o servidor como `etapaEsperada` (Pitfall 7).
  etapa: EtapaProducao;
};

// "Terminei: {Etapa}" (UI-SPEC §Ações): primário, sem confirmação, sem campo, sem teclado — o
// segundo toque do caminho do quadro à etapa marcada (Valor central). No celular ele mora na barra
// de ação fixa (`BarraAcaoFixa`, UI-D3): `flex-1`, 52px no mínimo, quebra em duas linhas a 320px,
// nunca reticências. Enquanto grava: "Marcando…", `disabled`, `aria-busy`. Sucesso: toast "Feito: X.
// Agora: Y." — SEM botão de desfazer (UI-D16: desfazer só pela confirmação que diz a data que se
// perde) — e `router.refresh()`. Recusa ("já tinha sido marcada", outro celular) ou falha: a frase
// embaixo do botão (no celular, logo ACIMA da barra), `role="alert"`, e a tela recarrega o estado.
//
// A trava de 1 s: guarda a etapa que o botão mostra; quando ela muda (marcada aqui, desfeita, ou
// mudada noutro celular e trazida pelo `router.refresh()`), o botão ignora toques por 1000 ms.
// O componente NÃO muda de chave quando a etapa muda: a frase de erro e a trava sobrevivem.
export function BotaoTerminei({ ordemId, tipo, etapa }: BotaoTermineiProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  // Cada início de espera ganha um número novo — o temporizador recomeça do zero a cada mudança.
  const [inicioDaEspera, setInicioDaEspera] = useState(0);
  const [etapaVista, setEtapaVista] = useState(etapa);
  const [erro, setErro] = useState<string | null>(null);

  // A etapa mudou desde o último desenho: o botão novo acabou de aparecer.
  if (etapaVista !== etapa) {
    setEtapaVista(etapa);
    setEsperando(true);
    setInicioDaEspera((anterior) => anterior + 1);
  }

  useEffect(() => {
    if (inicioDaEspera === 0) {
      return;
    }
    const temporizador = window.setTimeout(() => setEsperando(false), ESPERA_DEPOIS_DE_MUDAR_MS);
    return () => window.clearTimeout(temporizador);
  }, [inicioDaEspera]);

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
        // Até a tela trazer a etapa nova, o botão velho não aceita toque.
        setEsperando(true);
        setInicioDaEspera((anterior) => anterior + 1);
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
    <div className="relative flex min-w-0 flex-1 flex-col items-stretch gap-2 md:flex-none md:items-end">
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
        <p
          data-testid="ordem-terminei-erro"
          role="alert"
          className="text-apoio text-erro bg-superficie border-borda absolute inset-x-0 bottom-full mb-2 rounded-md border p-2 shadow-sm md:static md:mb-0 md:border-0 md:bg-transparent md:p-0 md:text-right md:shadow-none"
        >
          {erro}
        </p>
      ) : null}
    </div>
  );
}
