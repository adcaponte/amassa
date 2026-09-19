"use client";

import type { ItemDoCatalogoParaVenda } from "@/lib/financeiro/consultas";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  FRASE_NADA_ENCONTRADO,
  FRASE_NENHUM_ATALHO,
  ROTULO_AREA,
  ROTULO_BUSCAR_NO_CATALOGO,
  ROTULO_TODOS_OS_ATALHOS,
  type AreaFinanceira,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// As 4 áreas de venda de verdade, na ordem fixa do resto do sistema — "Geral" nunca aparece aqui
// porque nenhuma categoria de RECEITA usa a área Geral (categorias_grupo_area_coerente).
const AREAS_DE_VENDA = (Object.keys(ROTULO_AREA) as AreaFinanceira[]).filter(
  (area) => area !== "geral",
);

export type FiltroDeArea = "tudo" | AreaFinanceira;

export type GradeCatalogoProps = {
  catalogo: readonly ItemDoCatalogoParaVenda[];
  busca: string;
  aoMudarBusca: (valor: string) => void;
  filtro: FiltroDeArea;
  aoMudarFiltro: (valor: FiltroDeArea) => void;
  aoTocarItem: (item: ItemDoCatalogoParaVenda) => void;
};

function precoOuValorNaHora(centavos: number | null): string {
  return centavos != null ? formatarReais(centavos) : "valor na hora";
}

// A grade de atalhos do catálogo — o foco visual principal da Venda (04.4-UI-SPEC.md). Com busca
// preenchida, vira lista agrupada por área (mesmo comportamento de `gradeItens`/`listaHTML` do
// protótipo); sem busca, mostra só os itens marcados como atalho de venda, filtrados pela pílula
// de área ativa.
export function GradeCatalogo({
  catalogo,
  busca,
  aoMudarBusca,
  filtro,
  aoMudarFiltro,
  aoTocarItem,
}: GradeCatalogoProps) {
  const buscaNormalizada = busca.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        data-testid="venda-busca"
        placeholder={ROTULO_BUSCAR_NO_CATALOGO}
        value={busca}
        onChange={(evento) => aoMudarBusca(evento.target.value)}
        className="text-corpo min-h-[44px]"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="venda-filtro-tudo"
          aria-pressed={filtro === "tudo"}
          onClick={() => aoMudarFiltro("tudo")}
          className={cn(
            "text-apoio min-h-[44px] rounded-full border px-3 font-medium",
            filtro === "tudo"
              ? "border-primary bg-accent text-accent-foreground"
              : "border-border bg-secondary text-secondary-foreground",
          )}
        >
          {ROTULO_TODOS_OS_ATALHOS}
        </button>
        {AREAS_DE_VENDA.map((area) => (
          <button
            key={area}
            type="button"
            data-testid={`venda-filtro-${area}`}
            aria-pressed={filtro === area}
            onClick={() => aoMudarFiltro(area)}
            className={cn(
              "text-apoio min-h-[44px] rounded-full border px-3 font-medium",
              filtro === area
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-secondary text-secondary-foreground",
            )}
          >
            {ROTULO_AREA[area]}
          </button>
        ))}
      </div>

      {buscaNormalizada ? (
        <ListaAgrupadaPorArea
          itens={catalogo.filter((item) => item.nome.toLowerCase().includes(buscaNormalizada))}
          aoTocarItem={aoTocarItem}
        />
      ) : (
        <GradeDeAtalhos
          itens={catalogo.filter(
            (item) => item.atalhoVenda && (filtro === "tudo" || item.area === filtro),
          )}
          aoTocarItem={aoTocarItem}
        />
      )}
    </div>
  );
}

function GradeDeAtalhos({
  itens,
  aoTocarItem,
}: {
  itens: readonly ItemDoCatalogoParaVenda[];
  aoTocarItem: (item: ItemDoCatalogoParaVenda) => void;
}) {
  if (itens.length === 0) {
    return <p className="text-corpo text-muted-foreground">{FRASE_NENHUM_ATALHO}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {itens.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid="venda-atalho"
          onClick={() => aoTocarItem(item)}
          style={{ borderLeftColor: `var(--color-area-${item.area})` }}
          className="border-border bg-card flex min-h-[44px] flex-col gap-1 rounded-md border border-l-4 p-3 text-left"
        >
          <b className="text-corpo text-foreground break-words">{item.nome}</b>
          <span className="text-apoio text-muted-foreground tabular-nums">
            {precoOuValorNaHora(item.precoVendaCentavos)}
          </span>
        </button>
      ))}
    </div>
  );
}

function ListaAgrupadaPorArea({
  itens,
  aoTocarItem,
}: {
  itens: readonly ItemDoCatalogoParaVenda[];
  aoTocarItem: (item: ItemDoCatalogoParaVenda) => void;
}) {
  if (itens.length === 0) {
    return <p className="text-corpo text-muted-foreground">{FRASE_NADA_ENCONTRADO}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {AREAS_DE_VENDA.map((area) => {
        const itensDaArea = itens.filter((item) => item.area === area);
        if (itensDaArea.length === 0) {
          return null;
        }
        return (
          <div key={area} className="flex flex-col gap-1">
            <h3 className="text-apoio text-muted-foreground font-semibold tracking-wide uppercase">
              {ROTULO_AREA[area]}
            </h3>
            {itensDaArea.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid="venda-atalho"
                onClick={() => aoTocarItem(item)}
                style={{ borderLeftColor: `var(--color-area-${item.area})` }}
                className="border-border flex min-h-[44px] items-center justify-between gap-2 rounded-md border border-l-4 px-3 py-2 text-left"
              >
                <span className="text-corpo text-foreground break-words">{item.nome}</span>
                <span className="text-apoio text-muted-foreground tabular-nums">
                  {precoOuValorNaHora(item.precoVendaCentavos)}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
