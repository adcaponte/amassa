"use client";

import type { EventoDaSemana } from "@/lib/agenda/consultas";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  DICA_FOLHA_FECHADO,
  ROTULO_FECHAR,
  ROTULO_VOLTAR_A_AGENDA,
  subTituloDoFechado,
} from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Folha, FolhaCabecalho, FolhaCorpo, FolhaRodape } from "@/components/amassa/folha";

import { ConfirmarTirarBloqueio } from "./confirmar-tirar-bloqueio";

export type FolhaFechadoProps = {
  // O que o cartão sabia no toque (ou o servidor, por `?evento=`): o fechado não tem lista para
  // carregar — a folha nasce inteira.
  fechado: EventoDaSemana;
  aoComecarATirar: () => void;
  aoFechar: () => void;
};

// A folha do dia fechado (05-UI-SPEC.md §"Folha do fechado (diálogo)"), aberta por `?evento={id}`:
// ponto `area-geral` + o motivo (Título, quebra livre ao lado do fechar 44×44 — nunca o empurra
// para fora), "Fechado · {dia}, {dd/mm} · o dia todo", a dica, e o rodapé "Tirar o bloqueio"
// (`outline` de erro) · "Voltar à agenda" (`outline`) — nenhum terracota nesta folha.
export function FolhaFechado({ fechado, aoComecarATirar, aoFechar }: FolhaFechadoProps) {
  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) {
          aoFechar();
        }
      }}
    >
      <Folha
        data-testid="folha-fechado"
        data-evento-id={fechado.id}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
      >
        <FolhaCabecalho
          titulo={
            <>
              <span aria-hidden="true" className="bg-area-geral mt-[10px] inline-block size-2 shrink-0 rounded-full" />
              <span className="min-w-0">{fechado.titulo}</span>
            </>
          }
          descricao={subTituloDoFechado(diaDaSemanaPorExtenso(fechado.data), formatarDiaMes(fechado.data))}
          descricaoVisivel
          aoFechar={aoFechar}
          rotuloFechar={ROTULO_FECHAR}
          dataTestIdFechar="folha-fechado-fechar"
          classeTitulo="flex items-start gap-2 [overflow-wrap:anywhere]"
          classeDescricao="break-words"
        />

        <FolhaCorpo>
          <p className="text-apoio text-tinta-fraca">{DICA_FOLHA_FECHADO}</p>
        </FolhaCorpo>

        <FolhaRodape className="flex-row flex-wrap items-start justify-between gap-2">
          <ConfirmarTirarBloqueio
            eventoId={fechado.id}
            data={fechado.data}
            aoComecar={aoComecarATirar}
            aoTirar={aoFechar}
          />
          <Button
            type="button"
            variant="outline"
            data-testid="folha-fechado-voltar"
            onClick={aoFechar}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal"
          >
            {ROTULO_VOLTAR_A_AGENDA}
          </Button>
        </FolhaRodape>
      </Folha>
    </Dialog>
  );
}
