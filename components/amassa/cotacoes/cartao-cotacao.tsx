"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_ALERTA_NA_LINHA, rotuloAbrirDetalheCotacao } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { FerramentasCotacao } from "@/components/amassa/cotacoes/ferramentas-cotacao";
import { MarcarCotacao } from "@/components/amassa/cotacoes/marcar-cotacao";
import { PrecoCotacao } from "@/components/amassa/cotacoes/preco-cotacao";
import { SeloSituacao } from "@/components/amassa/cotacoes/selo-situacao";

export type CartaoCotacaoProps = {
  cotacao: Cotacao;
  categoriaId: string;
  marcado: boolean;
  aoAlternarMarcacao: () => void;
};

// A forma de CARTÃO (<660px) de uma cotação — extraída de `lista-cotacoes.tsx` (Tarefa 3,
// 04.3-03) para o comportamento visual de descartado e de alerta existir num lugar por forma, em
// vez de espalhado no componente que só itera a lista.
export function CartaoCotacao({ cotacao, categoriaId, marcado, aoAlternarMarcacao }: CartaoCotacaoProps) {
  // D-10: a linha CONTINUA visível, sempre — nunca filtrada, escondida ou movida. Opacidade
  // reduzida em empresa/especificação/preço; o SELO fica em opacidade cheia (o texto dele já é a
  // pista não visual).
  const descartada = cotacao.situacao === "descartado";
  const temAlerta = cotacao.alertas.length > 0;
  const hrefDetalhe = `/abertura?aba=cotacoes&categoria=${categoriaId}&detalhe=${cotacao.id}`;

  return (
    <div data-testid="cotacoes-cartao" className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <MarcarCotacao cotacao={cotacao} marcado={marcado} aoAlternar={aoAlternarMarcacao} />
          {/* Tarefa 2 (04.3-04, D-12): mesmo molde de `linha-cotacao.tsx` — o `<Link>` é o
              elemento acionável DE VERDADE (foco visível, nome acessível nomeando a empresa),
              nunca um `onClick` no `<div>` do cartão inteiro. */}
          <Link
            href={hrefDetalhe}
            onClick={(evento) => {
              evento.preventDefault();
              irParaSemNavegar(hrefDetalhe);
            }}
            aria-label={rotuloAbrirDetalheCotacao(cotacao.empresa, temAlerta)}
            data-testid="cotacoes-abrir-detalhe"
            className={cn(
              "text-corpo hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-1 rounded-md px-1.5 font-semibold focus-visible:ring-2 focus-visible:outline-none",
              descartada && "opacity-60",
            )}
          >
            {temAlerta && (
              <TriangleAlert
                aria-hidden="true"
                data-testid="cotacoes-alerta-icone"
                className="text-erro size-4 flex-none"
              />
            )}
            {temAlerta && <span className="sr-only">{ROTULO_ALERTA_NA_LINHA} </span>}
            {cotacao.empresa}
          </Link>
        </div>
        {/* Canto do cartão (UI-SPEC): selo + as ferramentas de editar/remover juntos. */}
        <div className="flex flex-none items-center gap-1.5">
          <SeloSituacao situacao={cotacao.situacao} />
          <FerramentasCotacao cotacao={cotacao} categoriaId={categoriaId} />
        </div>
      </div>
      <p className={cn("text-apoio text-muted-foreground line-clamp-2", descartada && "opacity-60")}>
        {cotacao.produto}
      </p>
      <span className={cn(descartada && "opacity-60")}>
        <PrecoCotacao centavos={cotacao.precoCentavos} />
      </span>
    </div>
  );
}
