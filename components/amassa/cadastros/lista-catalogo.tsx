"use client";

import { useState } from "react";

import type { AreaFinanceira } from "@/lib/cadastros/catalogo";
import type {
  CategoriaParaItem,
  InsumoParaFicha,
  ItemDoCatalogoCompleto,
} from "@/lib/cadastros/consultas";
import {
  ETIQUETA_SO_INSUMO,
  FRASE_VAZIO_CATALOGO_CORPO,
  FRASE_VAZIO_CATALOGO_TITULO,
  ROTULO_AREA,
  ROTULO_EDITAR_ITEM,
  ROTULO_NOVO_ITEM,
  ROTULO_SEM_VALOR,
  ROTULO_VALOR_NA_HORA,
  TITULO_CATALOGO,
  etiquetaEstoqueEm,
  etiquetaGasta,
} from "@/lib/cadastros/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { DialogoItemCatalogo } from "@/components/amassa/cadastros/dialogo-item-catalogo";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export type ListaCatalogoProps = {
  catalogo: ItemDoCatalogoCompleto[];
  categoriasParaItem: { vendaveis: CategoriaParaItem[]; compraveis: CategoriaParaItem[] };
  insumosDisponiveis: InsumoParaFicha[];
};

// Ordem fixa de exibição das áreas — "Geral" só aparece se houver item nela (04.4-05-PLAN.md
// must_have: "agrupado por área (Cafeteria · Espaço · Peças · Loja, e Geral no fim quando
// houver)").
const ORDEM_DAS_AREAS: readonly AreaFinanceira[] = ["cafeteria", "espaco", "pecas", "loja", "geral"];

type AlvoDoDialogo = "novo" | ItemDoCatalogoCompleto;

function precoOuValorNaHora(item: ItemDoCatalogoCompleto): string {
  if (!item.aparecenaVenda) {
    return ROTULO_SEM_VALOR;
  }
  return item.precoVendaCentavos != null
    ? formatarReais(item.precoVendaCentavos)
    : ROTULO_VALOR_NA_HORA;
}

function textoDaEtiquetaGasta(item: ItemDoCatalogoCompleto): string | null {
  if (item.ficha.length === 0) {
    return null;
  }
  const partes = item.ficha.map(
    (linha) => `${Number(linha.quantidade).toLocaleString("pt-BR")} ${linha.unidade} de ${linha.insumoNome}`,
  );
  return etiquetaGasta(partes);
}

export function ListaCatalogo({ catalogo, categoriasParaItem, insumosDisponiveis }: ListaCatalogoProps) {
  const [alvoDoDialogo, setAlvoDoDialogo] = useState<AlvoDoDialogo | null>(null);

  const dialogo = (
    <DialogoItemCatalogo
      aberto={alvoDoDialogo !== null}
      itemParaEditar={alvoDoDialogo === "novo" ? null : alvoDoDialogo}
      categoriasParaItem={categoriasParaItem}
      insumosDisponiveis={insumosDisponiveis}
      catalogo={catalogo}
      onFechar={() => setAlvoDoDialogo(null)}
    />
  );

  if (catalogo.length === 0) {
    return (
      <>
        <EstadoVazio
          testId="cadastros-vazio-catalogo"
          titulo={FRASE_VAZIO_CATALOGO_TITULO}
          corpo={FRASE_VAZIO_CATALOGO_CORPO}
          botao={
            <button
              type="button"
              onClick={() => setAlvoDoDialogo("novo")}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
            >
              {ROTULO_NOVO_ITEM}
            </button>
          }
        />
        {dialogo}
      </>
    );
  }

  const blocosPorArea = ORDEM_DAS_AREAS.map((area) => ({
    area,
    itens: catalogo.filter((item) => item.area === area),
  })).filter((bloco) => bloco.itens.length > 0);

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-titulo text-foreground">{TITULO_CATALOGO}</h2>
        <button
          type="button"
          onClick={() => setAlvoDoDialogo("novo")}
          data-testid="novo-item"
          className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
        >
          {ROTULO_NOVO_ITEM}
        </button>
      </div>

      {blocosPorArea.map((bloco) => (
        <div key={bloco.area} className="flex flex-col gap-2">
          <h3 className="text-apoio font-semibold text-muted-foreground uppercase tracking-wide">
            {ROTULO_AREA[bloco.area]}
          </h3>
          <ul className="flex flex-col gap-1">
            {bloco.itens.map((item) => {
              const etiquetaGastaTexto = textoDaEtiquetaGasta(item);
              return (
                <li
                  key={item.id}
                  data-testid="catalogo-item"
                  className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-corpo text-foreground break-words">{item.nome}</span>
                      <span className="text-apoio text-muted-foreground tabular-nums">
                        {precoOuValorNaHora(item)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!item.aparecenaVenda && (
                        <span
                          data-testid="catalogo-etiqueta"
                          className="text-apoio bg-secondary text-secondary-foreground rounded-full px-2 py-0.5"
                        >
                          {ETIQUETA_SO_INSUMO}
                        </span>
                      )}
                      {item.controlaEstoque && (
                        <span
                          data-testid="catalogo-etiqueta"
                          className="text-apoio bg-secondary text-secondary-foreground rounded-full px-2 py-0.5"
                        >
                          {etiquetaEstoqueEm(item.unidade ?? "un")}
                        </span>
                      )}
                      {etiquetaGastaTexto && (
                        <span
                          data-testid="catalogo-etiqueta"
                          className="text-apoio bg-accent text-accent-foreground rounded-full px-2 py-0.5"
                        >
                          {etiquetaGastaTexto}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlvoDoDialogo(item)}
                    className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3 font-medium"
                  >
                    {ROTULO_EDITAR_ITEM}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {dialogo}
    </div>
  );
}
