"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { ajustarDiasPrevistos } from "@/lib/producao/acoes";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  FRASE_FALHA_AO_AJUSTAR,
  SR_MAXIMO_365_DIAS,
  SR_MINIMO_1_DIA,
  ariaLabelUmDiaAMais,
  ariaLabelUmDiaAMenos,
} from "@/lib/producao/textos";
import { DIAS_PREVISTOS_MAXIMO, DIAS_PREVISTOS_MINIMO } from "@/lib/producao/transicoes";
import { Button } from "@/components/ui/button";

export type AjusteDiasProps = {
  ordemId: string;
  tipo: TipoOrdem;
  etapa: EtapaProducao;
  diasPrevistos: number;
};

// O par −/+ de uma etapa FUTURA (UI-SPEC §"Página da ordem" → Trilha; PRD-12): dois botões de 44×44
// (`superficie-2`, borda `borda-forte`), um dia por toque. Quem desenha só o põe nas etapas futuras
// (aguardando o sinal: em todas); o servidor confere de novo, sob a trava. "−" desabilitado em 1 e
// "+" em 365, cada um apontando (`aria-describedby`) para o `sr-only` que diz o porquê. Toques
// seguidos vão um de cada vez: enquanto um grava, o par fica `aria-busy` e o toque seguinte é
// ignorado. O "previsto P" da linha muda quando o servidor confirma (a resposta da ação). Nenhum
// toast (UI-SPEC §Toasts). Erro: na linha da etapa, embaixo do nome, `role="alert"`.
//
// Devolve DOIS itens da grade da linha (`24px 1fr auto`): o par na terceira coluna e, quando há
// erro, a frase numa linha nova a partir da segunda coluna.
export function AjusteDias({ ordemId, tipo, etapa, diasPrevistos }: AjusteDiasProps) {
  const router = useRouter();
  const idMinimo = useId();
  const idMaximo = useId();
  const emVoo = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rotulo = rotuloDaEtapa(etapa, tipo);
  const noMinimo = diasPrevistos <= DIAS_PREVISTOS_MINIMO;
  const noMaximo = diasPrevistos >= DIAS_PREVISTOS_MAXIMO;

  async function ajustar(delta: 1 | -1) {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setGravando(true);
    setErro(null);
    try {
      const resultado = await ajustarDiasPrevistos({ ordemId, etapa, delta });
      if (!resultado.ok) {
        setErro(resultado.erro);
        // A recusa volta antes de qualquer `revalidatePath`: a recarga do estado é daqui.
        router.refresh();
      }
      // Sucesso: sem `router.refresh()` — a ação já revalida esta página e a resposta dela traz a
      // árvore nova (revisão 06.1, WR-106; `.planning/debug/abertura-navegacao-trava.md`).
    } catch {
      setErro(FRASE_FALHA_AO_AJUSTAR);
      router.refresh();
    } finally {
      emVoo.current = false;
      setGravando(false);
    }
  }

  const classeDoBotao =
    "bg-superficie-2 border-borda-forte text-tinta size-11 shrink-0 rounded-sm border [&_svg]:size-5";

  return (
    <>
      <div
        data-testid={`ordem-ajuste-${etapa}`}
        aria-busy={gravando ? "true" : undefined}
        className="flex items-center gap-2 self-center"
      >
        <Button
          type="button"
          variant="outline"
          data-testid={`ordem-ajuste-menos-${etapa}`}
          aria-label={ariaLabelUmDiaAMenos(rotulo)}
          aria-describedby={noMinimo ? idMinimo : undefined}
          disabled={noMinimo}
          onClick={() => void ajustar(-1)}
          className={classeDoBotao}
        >
          <Minus aria-hidden="true" />
        </Button>
        <span id={idMinimo} className="sr-only">
          {SR_MINIMO_1_DIA}
        </span>
        <Button
          type="button"
          variant="outline"
          data-testid={`ordem-ajuste-mais-${etapa}`}
          aria-label={ariaLabelUmDiaAMais(rotulo)}
          aria-describedby={noMaximo ? idMaximo : undefined}
          disabled={noMaximo}
          onClick={() => void ajustar(1)}
          className={classeDoBotao}
        >
          <Plus aria-hidden="true" />
        </Button>
        <span id={idMaximo} className="sr-only">
          {SR_MAXIMO_365_DIAS}
        </span>
      </div>
      {erro ? (
        <p
          data-testid={`ordem-ajuste-erro-${etapa}`}
          role="alert"
          className="text-apoio text-erro col-span-2 col-start-2"
        >
          {erro}
        </p>
      ) : null}
    </>
  );
}
