"use client";

import { TriangleAlert } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_ALERTA_NA_LINHA, ROTULO_MARCAR_PARA_COMPARAR } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import { FerramentasCotacao } from "@/components/amassa/cotacoes/ferramentas-cotacao";
import { PrecoCotacao } from "@/components/amassa/cotacoes/preco-cotacao";
import { SeloSituacao } from "@/components/amassa/cotacoes/selo-situacao";
import { Checkbox } from "@/components/ui/checkbox";

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

  return (
    <div data-testid="cotacoes-cartao" className="flex flex-col gap-1.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            className="mt-0.5 size-5"
            checked={marcado}
            onCheckedChange={aoAlternarMarcacao}
            aria-label={ROTULO_MARCAR_PARA_COMPARAR(cotacao.empresa)}
          />
          <span className={cn("text-corpo flex items-center gap-1 font-semibold", descartada && "opacity-60")}>
            {/* D-12: o ícone é a pista VISUAL (vermelho, escondido do leitor de tela); o texto
                `sr-only` logo abaixo é a pista para quem usa leitor de tela — cor nunca é a única
                pista. Cotação sem alerta não desenha nada, nem espaço reservado. */}
            {cotacao.alertas && (
              <TriangleAlert
                aria-hidden="true"
                data-testid="cotacoes-alerta-icone"
                className="text-erro size-4 flex-none"
              />
            )}
            {cotacao.alertas && <span className="sr-only">{ROTULO_ALERTA_NA_LINHA} </span>}
            {cotacao.empresa}
          </span>
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
