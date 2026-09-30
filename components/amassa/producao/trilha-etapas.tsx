import { formatarDiaMes } from "@/lib/producao/calendario";
import {
  rotuloDaEtapa,
  type EtapaProducao,
  type StatusOrdem,
  type TipoOrdem,
} from "@/lib/producao/etapas";
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

import { AjusteDias } from "./ajuste-dias";
import { CampoParcial } from "./campo-parcial";

export type EstadoDaEtapa = "feita" | "atual" | "futura";

export type TrilhaEtapasProps = {
  ordemId: string;
  tipo: TipoOrdem;
  status: StatusOrdem;
  // Por posição (a página as passa já ordenadas pelo módulo puro).
  etapas: readonly EtapaDaOrdem[];
  leitura: LeituraDaOrdem;
  levou: ReadonlyMap<EtapaProducao, number>;
  // Σ (quantidade + a mais) das peças — o "{total}" do parcial.
  totalDeFeitas: number;
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

// A trilha da ordem (UI-SPEC §"Página da ordem" → Trilha): uma linha por etapa do caminho (6 no
// completo, 4 no que termina no biscoito), grade `24px 1fr auto`, ponto de 16px com a borda na cor
// da etapa (decorativo). Feita × atual × futura não depende de cor — a linha de baixo escreve
// "feita em dd/mm", "há N dias", "previsto P dias", e um `sr-only` antes do nome diz "Feita:",
// "Etapa atual:" ou "Próxima:".
//
// Plano 05: à direita das etapas FUTURAS, o par −/+ dos dias previstos (aguardando o sinal: em
// TODAS — nada começou; feita e atual nunca, valem pelo que aconteceu; concluída e cancelada, em
// nenhuma). Na etapa atual de ordem ativa, não sendo a última e com mais de uma peça, o campo
// "já passaram [ ] de {total}".
//
// Os dois ficam MONTADOS em toda linha, e só se escondem (revisão 06.1, WR-104 — o molde de
// `CaixaAguardando`): a recusa de um toque que chegou tarde (outro celular marcou a etapa, e a
// recarga tirou o −/+ ou o campo daquela linha) continua na tela, em vez de sumir com o controle.
export function TrilhaEtapas({
  ordemId,
  tipo,
  status,
  etapas,
  leitura,
  levou,
  totalDeFeitas,
}: TrilhaEtapasProps) {
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
          // Aguardando o sinal: a primeira etapa também tem −/+, então o previsto dela aparece junto
          // do "ainda não começou" — senão o toque mudaria um número que a tela não mostra.
          linhaDeBaixo =
            leitura.tipo === "em-andamento"
              ? textoEtapaAtual(leitura.diasNestaEtapa, leitura.previstoDaEtapa)
              : `${TEXTO_AINDA_NAO_COMECOU} · ${textoEtapaFutura(etapa.diasPrevistos)}`;
        } else {
          linhaDeBaixo = textoEtapaFutura(etapa.diasPrevistos);
        }
        const ajustavel =
          status === "aguardando_sinal" || (status === "ativa" && estado === "futura");
        const comParcial =
          status === "ativa" &&
          estado === "atual" &&
          indice < etapas.length - 1 &&
          totalDeFeitas > 1;
        return (
          <li
            key={etapa.etapa}
            data-testid={`ordem-etapa-${etapa.etapa}`}
            data-estado={estado}
            className="border-borda grid grid-cols-[24px_1fr_auto] items-start gap-x-4 gap-y-1 border-b py-2 last:border-b-0"
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
              <span
                data-testid="ordem-etapa-linha"
                className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]"
              >
                {linhaDeBaixo}
              </span>
              {/* Um por linha (a linha tem a chave da etapa): quando a atual muda, o campo da linha
                  nova mostra o parcial DELA, e o da velha só guarda a frase de uma recusa. */}
              <CampoParcial
                ordemId={ordemId}
                tipo={tipo}
                etapa={etapa.etapa}
                total={totalDeFeitas}
                passaram={etapa.passaram}
                visivel={comParcial}
              />
            </div>
            <AjusteDias
              ordemId={ordemId}
              tipo={tipo}
              etapa={etapa.etapa}
              diasPrevistos={etapa.diasPrevistos}
              ajustavel={ajustavel}
            />
          </li>
        );
      })}
    </ol>
  );
}
