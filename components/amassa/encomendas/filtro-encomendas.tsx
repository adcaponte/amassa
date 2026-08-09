"use client";

import { Search, SlidersHorizontal } from "lucide-react";

import type { FiltroDeStatus, OrdenacaoDeEncomendas } from "@/lib/encomendas/filtros";
import { PLACEHOLDER_BUSCA, ROTULO_FILTRAR_E_ORDENAR, ROTULO_ORDENACAO, ROTULO_STATUS } from "@/lib/encomendas/textos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Os três controles de D-11/D-12/D-13, em duas larguras (03-UI-SPEC.md "Filtro, Busca e
// Ordenação"). Componente burro: recebe estado + manipuladores de `lista-encomendas.tsx`, nunca
// chama `aplicarFiltros` por conta própria — o filtro em si é responsabilidade de quem monta a
// lista, não de quem desenha os controles.
//
// Sem o hook de detecção de largura de tela que veio com o Sidebar do shadcn (mesmo motivo de
// D-02): as duas larguras nascem no HTML, uma escondida por CSS a cada breakpoint.
export type FiltroEncomendasProps = {
  termo: string;
  status: FiltroDeStatus;
  ordenacao: OrdenacaoDeEncomendas;
  aoMudarTermo: (valor: string) => void;
  aoMudarStatus: (valor: FiltroDeStatus) => void;
  aoMudarOrdenacao: (valor: OrdenacaoDeEncomendas) => void;
};

const OPCOES_DE_STATUS: { valor: FiltroDeStatus; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "em_producao", rotulo: "Em produção" },
  { valor: "rascunho", rotulo: "Rascunho" },
  { valor: "concluida", rotulo: "Concluídas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

const OPCOES_DE_ORDENACAO: { valor: OrdenacaoDeEncomendas; rotulo: string }[] = [
  { valor: "data-inicio", rotulo: "Data de início" },
  { valor: "urgencia", rotulo: "Urgência" },
  { valor: "nome", rotulo: "Nome" },
];

function CampoDeBusca({
  termo,
  aoMudarTermo,
  className,
}: {
  termo: string;
  aoMudarTermo: (valor: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {/* text-corpo (16px) explícito — o `Input` do shadcn tem `md:text-sm` embutido que venceria
          um `text-corpo` sem o mesmo prefixo de variante (achado real de 03-06-SUMMARY.md). */}
      <Input
        type="search"
        value={termo}
        onChange={(evento) => aoMudarTermo(evento.target.value)}
        placeholder={PLACEHOLDER_BUSCA}
        aria-label="Buscar encomendas"
        className="text-corpo md:text-corpo min-h-11 pl-8"
      />
    </div>
  );
}

function SeletorDeStatus({
  status,
  aoMudarStatus,
  idPrefixo,
  className,
}: {
  status: FiltroDeStatus;
  aoMudarStatus: (valor: FiltroDeStatus) => void;
  idPrefixo: string;
  className?: string;
}) {
  return (
    <Select value={status} onValueChange={(valor) => aoMudarStatus(valor as FiltroDeStatus)}>
      <SelectTrigger
        id={`${idPrefixo}-status`}
        aria-label={ROTULO_STATUS}
        className={`min-h-11 ${className ?? ""}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPCOES_DE_STATUS.map((opcao) => (
          <SelectItem key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SeletorDeOrdenacao({
  ordenacao,
  aoMudarOrdenacao,
  idPrefixo,
  className,
}: {
  ordenacao: OrdenacaoDeEncomendas;
  aoMudarOrdenacao: (valor: OrdenacaoDeEncomendas) => void;
  idPrefixo: string;
  className?: string;
}) {
  return (
    <Select
      value={ordenacao}
      onValueChange={(valor) => aoMudarOrdenacao(valor as OrdenacaoDeEncomendas)}
    >
      <SelectTrigger
        id={`${idPrefixo}-ordenacao`}
        aria-label={ROTULO_ORDENACAO}
        className={`min-h-11 ${className ?? ""}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPCOES_DE_ORDENACAO.map((opcao) => (
          <SelectItem key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FiltroEncomendas({
  termo,
  status,
  ordenacao,
  aoMudarTermo,
  aoMudarStatus,
  aoMudarOrdenacao,
}: FiltroEncomendasProps) {
  return (
    <>
      {/* Desktop: os três controles lado a lado, sempre visíveis, acima do Gantt/lista. */}
      <div
        className="hidden items-center gap-3 border-b border-border px-6 py-4 md:flex md:px-8"
        data-testid="filtro-desktop"
      >
        <CampoDeBusca termo={termo} aoMudarTermo={aoMudarTermo} className="max-w-sm flex-1" />
        <SeletorDeStatus status={status} aoMudarStatus={aoMudarStatus} idPrefixo="desktop" className="w-44" />
        <SeletorDeOrdenacao
          ordenacao={ordenacao}
          aoMudarOrdenacao={aoMudarOrdenacao}
          idPrefixo="desktop"
          className="w-44"
        />
      </div>

      {/* Celular: busca sempre visível numa barra fixa de 56px logo abaixo do cabeçalho móvel
          (mesma altura de `cabecalho-movel.tsx`, para manter o ritmo vertical); status/ordenação
          atrás de um botão que abre um `Sheet` — decisão de discrição do 03-UI-SPEC.md
          "Filtro, Busca e Ordenação — Celular". */}
      <div
        className="sticky top-14 z-10 flex h-14 items-center gap-2 border-b border-border bg-superficie-2 px-4 md:hidden"
        data-testid="filtro-celular"
      >
        <CampoDeBusca termo={termo} aoMudarTermo={aoMudarTermo} className="flex-1" />

        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={ROTULO_FILTRAR_E_ORDENAR}
              className="size-11 shrink-0 bg-superficie"
            >
              <SlidersHorizontal aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" data-testid="filtro-sheet">
            <SheetHeader>
              <SheetTitle>{ROTULO_FILTRAR_E_ORDENAR}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="celular-status"
                  className="text-micro text-muted-foreground tracking-wide uppercase"
                >
                  {ROTULO_STATUS}
                </label>
                <SeletorDeStatus
                  status={status}
                  aoMudarStatus={aoMudarStatus}
                  idPrefixo="celular"
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="celular-ordenacao"
                  className="text-micro text-muted-foreground tracking-wide uppercase"
                >
                  {ROTULO_ORDENACAO}
                </label>
                <SeletorDeOrdenacao
                  ordenacao={ordenacao}
                  aoMudarOrdenacao={aoMudarOrdenacao}
                  idPrefixo="celular"
                  className="w-full"
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
