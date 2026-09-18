"use client";

import { TriangleAlert } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_ALERTA_NA_LINHA, ROTULO_MARCAR_PARA_COMPARAR } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import { FerramentasCotacao } from "@/components/amassa/cotacoes/ferramentas-cotacao";
import { PrecoCotacao } from "@/components/amassa/cotacoes/preco-cotacao";
import { SeloSituacao } from "@/components/amassa/cotacoes/selo-situacao";
import { Checkbox } from "@/components/ui/checkbox";

export type LinhaCotacaoProps = {
  cotacao: Cotacao;
  categoriaId: string;
  marcado: boolean;
  aoAlternarMarcacao: () => void;
};

// A forma de LINHA de tabela (≥660px) de uma cotação — extraída de `lista-cotacoes.tsx` (Tarefa
// 3, 04.3-03), mesmo par com `cartao-cotacao.tsx`: o comportamento visual de descartado e de
// alerta vive num lugar por FORMA, não espalhado no componente que só itera a lista.
export function LinhaCotacao({ cotacao, categoriaId, marcado, aoAlternarMarcacao }: LinhaCotacaoProps) {
  // D-10: a linha CONTINUA na tabela, sempre — nunca filtrada, escondida ou movida para o fim.
  // Opacidade reduzida em empresa/especificação/preço; o SELO fica em opacidade cheia.
  const descartada = cotacao.situacao === "descartado";

  return (
    <tr data-testid="cotacoes-linha" className="border-border border-b last:border-0">
      <td className="p-3">
        <Checkbox
          checked={marcado}
          onCheckedChange={aoAlternarMarcacao}
          aria-label={ROTULO_MARCAR_PARA_COMPARAR(cotacao.empresa)}
        />
      </td>
      <td className={cn("text-corpo p-3 font-medium", descartada && "opacity-60")}>
        <span className="flex items-center gap-1">
          {/* D-12: ícone (pista visual, vermelho, escondido do leitor de tela) + texto `sr-only`
              (pista para quem usa leitor de tela) — cor nunca é a única pista. Sem alerta, nada é
              desenhado, nem um espaço reservado que pareça um ícone faltando. */}
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
      </td>
      <td className={cn("text-corpo text-muted-foreground p-3", descartada && "opacity-60")}>
        {cotacao.produto}
      </td>
      <td className={cn("p-3", descartada && "opacity-60")}>
        <PrecoCotacao centavos={cotacao.precoCentavos} />
      </td>
      <td className="p-3">
        <SeloSituacao situacao={cotacao.situacao} />
      </td>
      <td className="p-3">
        <FerramentasCotacao cotacao={cotacao} categoriaId={categoriaId} />
      </td>
    </tr>
  );
}
