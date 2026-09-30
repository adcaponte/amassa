"use client";

import { useState } from "react";

import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  ROTULO_DESFAZER,
  ROTULO_DESFAZER_A_ULTIMA,
  ariaLabelDesfazerNaBarra,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";

import { BarraAcaoFixa, RotuloDesfazer } from "./barra-acao-fixa";
import { BotaoTerminei } from "./botao-terminei";
import { ConfirmarDesfazer, type AlvoDoDesfazer } from "./confirmar-desfazer";

export type AcoesDaOrdemProps = {
  ordemId: string;
  tipo: TipoOrdem;
  // A etapa atual quando ela ainda se "termina"; `null` na última (a Entrega se conclui — o
  // "Entreguei" / "Guardar no estoque" chega com a conclusão, plano 11).
  etapaParaTerminar: EtapaProducao | null;
  // A última etapa feita, com a data que o desfazer apaga; `null` sem nenhuma feita.
  ultimaFeita: AlvoDoDesfazer | null;
};

// As ações da ordem ATIVA (quem desenha só a monta nesse estado): "Desfazer a última" (`outline`,
// desabilitado sem nenhuma etapa feita) e "Terminei: {Etapa}" (primário). No celular, na barra de
// ação fixa acima da navegação; no desktop, a fileira à direita (ver `BarraAcaoFixa`). "Desfazer"
// abre a confirmação com a etapa e a data FOTOGRAFADAS no toque (UI-D4).
export function AcoesDaOrdem({ ordemId, tipo, etapaParaTerminar, ultimaFeita }: AcoesDaOrdemProps) {
  const [alvo, setAlvo] = useState<AlvoDoDesfazer | null>(null);
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <BarraAcaoFixa>
        <Button
          type="button"
          variant="outline"
          data-testid="ordem-desfazer"
          disabled={ultimaFeita === null}
          aria-label={
            ultimaFeita ? ariaLabelDesfazerNaBarra(rotuloDaEtapa(ultimaFeita.etapa, tipo)) : undefined
          }
          onClick={() => {
            if (ultimaFeita) {
              setAlvo(ultimaFeita);
              setAberto(true);
            }
          }}
          className="text-corpo h-auto min-h-[52px] shrink-0 px-4 font-semibold"
        >
          <RotuloDesfazer curto={ROTULO_DESFAZER} longo={ROTULO_DESFAZER_A_ULTIMA} />
        </Button>
        {etapaParaTerminar ? (
          <BotaoTerminei ordemId={ordemId} tipo={tipo} etapa={etapaParaTerminar} />
        ) : null}
      </BarraAcaoFixa>
      <ConfirmarDesfazer
        ordemId={ordemId}
        tipo={tipo}
        alvo={alvo}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
      />
    </>
  );
}
