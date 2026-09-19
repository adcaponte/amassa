"use client";

import { formatarReais } from "@/lib/financeiro/formato";
import {
  FRASE_NADA_ENCONTRADO,
  FRASE_NENHUM_ATALHO,
  ROTULO_AREA,
  ROTULO_BUSCAR_MATERIAL_DO_ESTOQUE,
  ROTULO_BUSCAR_NO_CATALOGO,
  ROTULO_TODOS_OS_ATALHOS,
  type AreaFinanceira,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// As 4 áreas de venda de verdade, na ordem fixa do resto do sistema — "Geral" nunca aparece aqui
// porque nenhuma categoria de RECEITA/CUSTO usa a área Geral (categorias_grupo_area_coerente).
const AREAS_DE_VENDA = (Object.keys(ROTULO_AREA) as AreaFinanceira[]).filter(
  (area) => area !== "geral",
);

export type FiltroDeArea = "tudo" | AreaFinanceira;

// Forma mínima compartilhada por Venda e Compra (04.4-07-PLAN.md key_links: "GradeCatalogo e
// ListaCompleta recebem o modo"). Os quatro campos por modo ficam OPCIONAIS de propósito —
// `ItemDoCatalogoParaVenda` (plano 03) e `ItemDoCatalogoParaCompra` (plano 07) satisfazem esta
// forma cada um com só os seus, sem precisar herdar um do outro nem duplicar o componente.
export type ItemCatalogoParaGrade = {
  id: string;
  nome: string;
  area: AreaFinanceira;
  atalhoVenda?: boolean;
  atalhoCompra?: boolean;
  precoVendaCentavos?: number | null;
  unidade?: string | null;
};

function unidadeExibida(unidade: string): string {
  return unidade === "l" ? "L" : unidade;
}

function precoOuValorNaHora(centavos: number | null | undefined): string {
  return centavos != null ? formatarReais(centavos) : "valor na hora";
}

export type GradeCatalogoProps<T extends ItemCatalogoParaGrade> = {
  // "venda" (padrão, compatível com `painel-venda.tsx` do plano 03) ou "compra" (plano 07):
  // decide o rótulo de busca, se a linha de pílulas de área aparece (a Despesa não tem — o
  // protótipo não mostra pílulas na compra) e o texto de valor de cada atalho.
  modo?: "venda" | "compra";
  catalogo: readonly T[];
  busca: string;
  aoMudarBusca: (valor: string) => void;
  filtro: FiltroDeArea;
  aoMudarFiltro: (valor: FiltroDeArea) => void;
  aoTocarItem: (item: T) => void;
};

// A grade de atalhos do catálogo — o foco visual principal da Venda (04.4-UI-SPEC.md), e o
// primeiro bloco de "O que chegou" na compra da Despesa. Com busca preenchida, vira lista
// agrupada por área (mesmo comportamento de `gradeItens`/`listaHTML` do protótipo); sem busca,
// mostra só os itens marcados como atalho (de venda ou de compra, conforme `modo`).
export function GradeCatalogo<T extends ItemCatalogoParaGrade>({
  modo = "venda",
  catalogo,
  busca,
  aoMudarBusca,
  filtro,
  aoMudarFiltro,
  aoTocarItem,
}: GradeCatalogoProps<T>) {
  const buscaNormalizada = busca.trim().toLowerCase();
  const testIdPrefixo = modo === "venda" ? "venda" : "compra";

  function ehAtalho(item: T): boolean {
    return modo === "venda" ? !!item.atalhoVenda : !!item.atalhoCompra;
  }
  function rotuloValor(item: T): string {
    return modo === "venda"
      ? precoOuValorNaHora(item.precoVendaCentavos)
      : `em ${unidadeExibida(item.unidade ?? "un")}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        data-testid={`${testIdPrefixo}-busca`}
        placeholder={modo === "venda" ? ROTULO_BUSCAR_NO_CATALOGO : ROTULO_BUSCAR_MATERIAL_DO_ESTOQUE}
        value={busca}
        onChange={(evento) => aoMudarBusca(evento.target.value)}
        className="text-corpo min-h-[44px]"
      />

      {modo === "venda" && (
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
      )}

      {buscaNormalizada ? (
        <ListaAgrupadaPorArea
          itens={catalogo.filter((item) => item.nome.toLowerCase().includes(buscaNormalizada))}
          aoTocarItem={aoTocarItem}
          testIdPrefixo={testIdPrefixo}
          rotuloValor={rotuloValor}
        />
      ) : (
        <GradeDeAtalhos
          itens={catalogo.filter(
            (item) => ehAtalho(item) && (modo === "compra" || filtro === "tudo" || item.area === filtro),
          )}
          aoTocarItem={aoTocarItem}
          testIdPrefixo={testIdPrefixo}
          rotuloValor={rotuloValor}
        />
      )}
    </div>
  );
}

function GradeDeAtalhos<T extends ItemCatalogoParaGrade>({
  itens,
  aoTocarItem,
  testIdPrefixo,
  rotuloValor,
}: {
  itens: readonly T[];
  aoTocarItem: (item: T) => void;
  testIdPrefixo: string;
  rotuloValor: (item: T) => string;
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
          data-testid={`${testIdPrefixo}-atalho`}
          onClick={() => aoTocarItem(item)}
          style={{ borderLeftColor: `var(--color-area-${item.area})` }}
          className="border-border bg-card flex min-h-[44px] flex-col gap-1 rounded-md border border-l-4 p-3 text-left"
        >
          <b className="text-corpo text-foreground break-words">{item.nome}</b>
          <span className="text-apoio text-muted-foreground tabular-nums">{rotuloValor(item)}</span>
        </button>
      ))}
    </div>
  );
}

function ListaAgrupadaPorArea<T extends ItemCatalogoParaGrade>({
  itens,
  aoTocarItem,
  testIdPrefixo,
  rotuloValor,
}: {
  itens: readonly T[];
  aoTocarItem: (item: T) => void;
  testIdPrefixo: string;
  rotuloValor: (item: T) => string;
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
                data-testid={`${testIdPrefixo}-atalho`}
                onClick={() => aoTocarItem(item)}
                style={{ borderLeftColor: `var(--color-area-${item.area})` }}
                className="border-border flex min-h-[44px] items-center justify-between gap-2 rounded-md border border-l-4 px-3 py-2 text-left"
              >
                <span className="text-corpo text-foreground break-words">{item.nome}</span>
                <span className="text-apoio text-muted-foreground tabular-nums">
                  {rotuloValor(item)}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
