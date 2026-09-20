"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_ALERTA_NA_LINHA, rotuloAbrirDetalheCotacao } from "@/lib/cotacoes/textos";
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
  // D-10: a linha CONTINUA visível, sempre — nunca filtrada, escondida ou movida. O SELO
  // (`SeloSituacao`) é a pista de "descartado", em opacidade cheia — o texto dele já é a pista
  // não visual. Empresa/especificação/preço NÃO recebem mais `opacity-60` (achado de
  // acessibilidade, WCAG 1.4.3, UI-09, mesma família de `lista-contas-fixas.tsx`): mesmo
  // diluindo `--color-tinta` cheio — o token mais escuro do sistema — a 60% de opacidade o
  // contraste cai para ~4.15:1, abaixo do piso de 4.5:1; e o texto secundário já usa
  // `--color-tinta-fraca` (5.4:1), que reprova ainda mais rápido. Sem uma segunda pista visual
  // aqui, o selo continua sendo a única e suficiente (comentário original do plano 04.3-03).
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
            className="text-corpo hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-1 rounded-md px-1.5 font-semibold focus-visible:ring-2 focus-visible:outline-none"
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
      <p className="text-apoio text-muted-foreground line-clamp-2">{cotacao.produto}</p>
      <span>
        <PrecoCotacao centavos={cotacao.precoCentavos} />
      </span>
    </div>
  );
}
