"use client";

import { useState } from "react";
import { toast } from "sonner";

import { definirAtalhoDoItem } from "@/lib/financeiro/acoes";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  DICA_LISTA_COMPLETA,
  DICA_LISTA_COMPLETA_COMPRA,
  FRASE_NADA_ENCONTRADO,
  FRASE_FALHA_AO_SALVAR,
  ROTULO_AREA,
  ROTULO_BUSCAR,
  ROTULO_PRONTO,
  TITULO_LISTA_COMPLETA,
  TITULO_TODO_MATERIAL_DE_ESTOQUE,
  textoAtalhoAcessivel,
  textoItemAdicionado,
  type AreaFinanceira,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ItemCatalogoParaGrade } from "./grade-catalogo";

const AREAS_DE_VENDA = (Object.keys(ROTULO_AREA) as AreaFinanceira[]).filter(
  (area) => area !== "geral",
);

function unidadeExibida(unidade: string): string {
  return unidade === "l" ? "L" : unidade;
}

export type ListaCompletaProps<T extends ItemCatalogoParaGrade> = {
  // Mesmo "modo" de `GradeCatalogo` (04.4-07-PLAN.md) — "venda" (padrão) ou "compra".
  modo?: "venda" | "compra";
  aberto: boolean;
  catalogo: readonly T[];
  aoFechar: () => void;
  aoTocarItem: (item: T) => void;
};

// "Tudo o que se vende" / "Todo material de estoque" (`folhaLista('v'|'d')` do protótipo): busca,
// agrupado por área, tocar no nome adiciona (sem fechar o diálogo), a estrela marca/desmarca o
// atalho certo (`definirAtalhoDoItem` com `tipo: modo`) na hora — otimista, some ao tocar em
// "Pronto".
export function ListaCompleta<T extends ItemCatalogoParaGrade>({
  modo = "venda",
  aberto,
  catalogo,
  aoFechar,
  aoTocarItem,
}: ListaCompletaProps<T>) {
  const [busca, setBusca] = useState("");
  const [atalhosLocais, setAtalhosLocais] = useState<Record<string, boolean>>({});
  const [alternando, setAlternando] = useState<string | null>(null);

  const buscaNormalizada = busca.trim().toLowerCase();
  const itensFiltrados = catalogo.filter((item) =>
    buscaNormalizada ? item.nome.toLowerCase().includes(buscaNormalizada) : true,
  );

  function atalhoDoItem(item: T): boolean {
    return modo === "venda" ? !!item.atalhoVenda : !!item.atalhoCompra;
  }

  function atalhoAtualDoItem(item: T): boolean {
    return atalhosLocais[item.id] ?? atalhoDoItem(item);
  }

  async function alternarAtalho(item: T) {
    if (alternando) {
      return;
    }
    const novoEstado = !atalhoAtualDoItem(item);
    setAtalhosLocais((atual) => ({ ...atual, [item.id]: novoEstado }));
    setAlternando(item.id);

    const resposta = await definirAtalhoDoItem({
      itemId: item.id,
      tipo: modo,
      marcado: novoEstado,
    });

    setAlternando(null);

    if (!resposta.ok) {
      setAtalhosLocais((atual) => ({ ...atual, [item.id]: !novoEstado }));
      toast.error(resposta.erro ?? FRASE_FALHA_AO_SALVAR);
    }
  }

  function tocar(item: T) {
    aoTocarItem(item);
    toast(textoItemAdicionado(item.nome));
  }

  const titulo = modo === "venda" ? TITULO_LISTA_COMPLETA : TITULO_TODO_MATERIAL_DE_ESTOQUE;
  const dica = modo === "venda" ? DICA_LISTA_COMPLETA : DICA_LISTA_COMPLETA_COMPRA;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && aoFechar()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[85svh] w-full max-w-lg flex-col gap-0 p-0"
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-display">{titulo}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <Input
            type="search"
            placeholder={ROTULO_BUSCAR}
            aria-label={ROTULO_BUSCAR}
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            className="text-corpo min-h-[44px]"
          />
          <p className="text-apoio text-muted-foreground">{dica}</p>

          {itensFiltrados.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{FRASE_NADA_ENCONTRADO}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {AREAS_DE_VENDA.map((area) => {
                const itensDaArea = itensFiltrados.filter((item) => item.area === area);
                if (itensDaArea.length === 0) {
                  return null;
                }
                return (
                  <div key={area} className="flex flex-col gap-1">
                    <h3 className="text-apoio text-muted-foreground font-semibold tracking-wide uppercase">
                      {ROTULO_AREA[area]}
                    </h3>
                    {itensDaArea.map((item) => (
                      <div
                        key={item.id}
                        className="flex min-h-[44px] items-center justify-between gap-2 py-1"
                      >
                        <button
                          type="button"
                          onClick={() => tocar(item)}
                          className="text-corpo text-foreground flex min-w-0 flex-1 items-center gap-2 truncate text-left"
                        >
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: `var(--color-area-${item.area})` }}
                          />
                          <span className="truncate">{item.nome}</span>
                        </button>
                        <span className="text-apoio text-muted-foreground shrink-0 tabular-nums">
                          {modo === "venda"
                            ? item.precoVendaCentavos != null
                              ? formatarReais(item.precoVendaCentavos)
                              : "na hora"
                            : `em ${unidadeExibida(item.unidade ?? "un")}`}
                        </span>
                        <button
                          type="button"
                          aria-pressed={atalhoAtualDoItem(item)}
                          aria-label={textoAtalhoAcessivel(item.nome)}
                          disabled={alternando === item.id}
                          onClick={() => void alternarAtalho(item)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span
                            aria-hidden="true"
                            className={
                              atalhoAtualDoItem(item) ? "text-primary" : "text-muted-foreground"
                            }
                          >
                            ★
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-border bg-popover flex justify-end border-t px-6 py-4">
          <Button type="button" variant="default" className="min-h-[44px]" onClick={aoFechar}>
            {ROTULO_PRONTO}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
