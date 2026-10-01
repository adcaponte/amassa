"use client";

import { X } from "lucide-react";

import type { EventoCarregado, EventoDaSemana } from "@/lib/agenda/consultas";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  DICA_FIM_OFICINA,
  DICA_FIM_TURMA,
  FRASE_NINGUEM_INSCRITO,
  ROTULO_AULA_AVULSA,
  ROTULO_CANCELADA,
  ROTULO_FECHAR,
  ROTULO_PRONTO,
  ROTULO_TURMA_FIXA,
  tituloQuemVem,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { LinhaInscrito } from "./linha-inscrito";

const PONTO_DO_TIPO = {
  turma: "bg-area-espaco",
  avulsa: "bg-ouro outline outline-1 outline-tinta-fraca",
  fechado: "bg-area-geral",
} as const;

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;

// "{Turma fixa | Aula ou oficina avulsa} · {dia da semana}, {dd/mm} · {hh:mm} às {hh:mm}" +
// " · cancelada" + avulsa: " · {R$} por pessoa" (05-UI-SPEC.md §"Folha do evento — linhas de leitura").
function subTitulo(evento: EventoDaSemana, precoCentavos: number | null): string {
  const partes = [
    evento.tipo === "turma" ? ROTULO_TURMA_FIXA : ROTULO_AULA_AVULSA,
    `${diaDaSemanaPorExtenso(evento.data)}, ${formatarDiaMes(evento.data)}`,
  ];
  if (evento.inicio !== null && evento.fim !== null) {
    partes.push(`${evento.inicio} às ${evento.fim}`);
  }
  if (evento.cancelado) {
    partes.push(ROTULO_CANCELADA);
  }
  if (evento.tipo === "avulsa" && precoCentavos !== null) {
    partes.push(`${formatarReais(precoCentavos)} por pessoa`);
  }
  return partes.join(" · ");
}

export type FolhaEventoProps = {
  // O que o cartão já sabia no toque — o cabeçalho real aparece antes de o servidor responder.
  cabecalho: EventoDaSemana;
  // A lista, quando o servidor já respondeu; `null` enquanto carrega.
  carregado: EventoCarregado | null;
  aoFechar: () => void;
};

// A folha do evento (turma ou avulsa), aberta por `?evento={id}` (UI-D8): diálogo de tela toda no
// celular, centrado `max-w-lg` a partir de `md` (o mesmo contêiner das folhas do Estoque), fechar
// 44×44 e rodapé preso por flex com "Pronto". Da folha aberta à presença marcada é UM toque por
// pessoa — nenhuma confirmação, campo ou teclado no caminho (Valor central).
export function FolhaEvento({ cabecalho, carregado, aoFechar }: FolhaEventoProps) {
  const evento = carregado ?? cabecalho;

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
        data-testid="folha-evento"
        data-evento-id={evento.id}
        onOpenAutoFocus={(eventoDeFoco) => eventoDeFoco.preventDefault()}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta flex items-center gap-2 break-words">
              <span
                aria-hidden="true"
                className={cn("inline-block size-2 shrink-0 rounded-full", PONTO_DO_TIPO[evento.tipo])}
              />
              {evento.titulo}
            </DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca break-words">
              {subTitulo(evento, carregado?.precoCentavos ?? null)}
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-evento-fechar"
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {carregado === null ? (
            <div aria-busy="true" className="flex flex-col gap-3" data-testid="folha-evento-carregando">
              <Skeleton className="h-4 w-40" />
              {LINHAS_DO_ESQUELETO.map((linha) => (
                <Skeleton key={linha} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <>
              <h3 className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase">
                {tituloQuemVem(carregado.inscricoes.length, carregado.vagas ?? 0)}
              </h3>
              {carregado.inscricoes.length === 0 ? (
                <p className="text-corpo text-tinta-fraca">{FRASE_NINGUEM_INSCRITO}</p>
              ) : (
                <ul className="flex flex-col" data-testid="folha-evento-lista">
                  {carregado.inscricoes.map((inscrito) => (
                    <LinhaInscrito
                      key={inscrito.id}
                      inscrito={inscrito}
                      somenteLeitura={carregado.cancelado}
                    />
                  ))}
                </ul>
              )}
              <p className="text-apoio text-tinta-fraca">
                {carregado.tipo === "turma" ? DICA_FIM_TURMA : DICA_FIM_OFICINA}
              </p>
            </>
          )}
        </div>

        <div className="border-border bg-popover flex justify-end border-t px-6 py-4">
          <Button
            type="button"
            variant="default"
            data-testid="folha-evento-pronto"
            onClick={aoFechar}
            className="text-corpo min-h-[52px] px-6 font-semibold"
          >
            {ROTULO_PRONTO}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
