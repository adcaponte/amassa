"use client";

import { X } from "lucide-react";

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

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
      <DialogContent
        showCloseButton={false}
        data-testid="folha-fechado"
        data-evento-id={fechado.id}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta flex items-start gap-2 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="bg-area-geral mt-[10px] inline-block size-2 shrink-0 rounded-full" />
              <span className="min-w-0">{fechado.titulo}</span>
            </DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca break-words">
              {subTituloDoFechado(diaDaSemanaPorExtenso(fechado.data), formatarDiaMes(fechado.data))}
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-fechado-fechar"
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          <p className="text-apoio text-tinta-fraca">{DICA_FOLHA_FECHADO}</p>
        </div>

        <div className="border-border bg-popover flex flex-wrap items-start justify-between gap-2 border-t px-6 py-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
