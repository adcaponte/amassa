import { formatarDiaMes } from "@/lib/producao/calendario";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import type { EtapaDaOrdem, LeituraDaOrdem } from "@/lib/producao/leitura";
import {
  SR_ATUAL,
  SR_FEITA,
  SR_PROXIMA,
  TEXTO_AINDA_NAO_COMECOU,
  textoEtapaAtual,
  textoEtapaFeita,
  textoEtapaFutura,
} from "@/lib/producao/textos";
import { cn } from "@/lib/utils";

export type EstadoDaEtapa = "feita" | "atual" | "futura";

export type TrilhaEtapasProps = {
  tipo: TipoOrdem;
  // Por posição (a página as passa já ordenadas pelo módulo puro).
  etapas: readonly EtapaDaOrdem[];
  leitura: LeituraDaOrdem;
  levou: ReadonlyMap<EtapaProducao, number>;
};

// Qual é o estado de cada linha: a etapa atual da leitura; na ordem aguardando o sinal, a primeira
// é a "atual" que ainda não começou; o resto se lê pelo `feita_em`.
function estadoDaEtapa(
  etapa: EtapaDaOrdem,
  indice: number,
  leitura: LeituraDaOrdem,
): EstadoDaEtapa {
  if (etapa.feitaEm !== null) {
    return "feita";
  }
  if (leitura.tipo === "em-andamento") {
    return indice === leitura.indice ? "atual" : "futura";
  }
  if (leitura.tipo === "aguardando") {
    return indice === 0 ? "atual" : "futura";
  }
  return "futura";
}

// A trilha da ordem (UI-SPEC §"Página da ordem" → Trilha): uma linha por etapa do caminho, grade
// `24px 1fr auto`, ponto de 16px com a borda na cor da etapa (decorativo). Feita × atual × futura
// não depende de cor — a linha de baixo escreve "feita em dd/mm", "há N dias", "previsto P dias",
// e um `sr-only` antes do nome diz "Feita:", "Etapa atual:" ou "Próxima:".
export function TrilhaEtapas({ tipo, etapas, leitura, levou }: TrilhaEtapasProps) {
  return (
    <ol data-testid="ordem-trilha" className="flex flex-col">
      {etapas.map((etapa, indice) => {
        const estado = estadoDaEtapa(etapa, indice, leitura);
        const rotulo = rotuloDaEtapa(etapa.etapa, tipo);
        let linhaDeBaixo: string;
        if (estado === "feita" && etapa.feitaEm !== null) {
          linhaDeBaixo = textoEtapaFeita(
            formatarDiaMes(etapa.feitaEm),
            levou.get(etapa.etapa) ?? null,
            etapa.diasPrevistos,
          );
        } else if (estado === "atual") {
          linhaDeBaixo =
            leitura.tipo === "em-andamento"
              ? textoEtapaAtual(leitura.diasNestaEtapa, leitura.previstoDaEtapa)
              : TEXTO_AINDA_NAO_COMECOU;
        } else {
          linhaDeBaixo = textoEtapaFutura(etapa.diasPrevistos);
        }
        return (
          <li
            key={etapa.etapa}
            data-testid={`ordem-etapa-${etapa.etapa}`}
            data-estado={estado}
            className="border-borda grid grid-cols-[24px_1fr_auto] items-start gap-4 border-b py-2 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 inline-block size-4 rounded-full border-2",
                estado === "atual" && "bg-superficie ring-acento-fundo ring-4",
                etapa.etapa === "secagem" && "outline-tinta-fraca outline-1",
              )}
              style={{
                borderColor: `var(--color-${etapa.etapa})`,
                backgroundColor: estado === "feita" ? `var(--color-${etapa.etapa})` : undefined,
              }}
            />
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-corpo [overflow-wrap:anywhere]",
                  estado === "feita" && "text-tinta font-semibold",
                  estado === "atual" && "text-acento font-semibold",
                  estado === "futura" && "text-tinta-fraca",
                )}
              >
                <span className="sr-only">
                  {estado === "feita" ? SR_FEITA : estado === "atual" ? SR_ATUAL : SR_PROXIMA}{" "}
                </span>
                {rotulo}
              </span>
              <span data-testid="ordem-etapa-linha" className="text-apoio text-tinta-fraca">
                {linhaDeBaixo}
              </span>
            </div>
            <span />
          </li>
        );
      })}
    </ol>
  );
}
