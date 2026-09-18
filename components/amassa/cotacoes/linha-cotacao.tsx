"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { ROTULO_ALERTA_NA_LINHA, ROTULO_MARCAR_PARA_COMPARAR, rotuloAbrirDetalheCotacao } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
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
  const temAlerta = cotacao.alertas.length > 0;
  const hrefDetalhe = `/abertura?aba=cotacoes&categoria=${categoriaId}&detalhe=${cotacao.id}`;

  return (
    <tr data-testid="cotacoes-linha" className="border-border border-b last:border-0">
      <td className="p-2">
        <Checkbox
          checked={marcado}
          onCheckedChange={aoAlternarMarcacao}
          aria-label={ROTULO_MARCAR_PARA_COMPARAR(cotacao.empresa)}
        />
      </td>
      <td className="p-1">
        {/* Tarefa 2 (04.3-04, D-12): a linha inteira NÃO é o alvo de teclado — uma `<tr>` não tem
            papel nem foco por natureza. O elemento acionável é este `<Link>` sobre o nome da
            empresa, ocupando a célula: alcançável por Tab, com foco visível e nome acessível
            dizendo que abre os detalhes DAQUELA empresa. Acionar a caixa de marcação ou os
            botões de editar/remover (outras células) nunca aciona este `onClick` — são elementos
            IRMÃOS, não descendentes dele. */}
        <Link
          href={hrefDetalhe}
          onClick={(evento) => {
            evento.preventDefault();
            irParaSemNavegar(hrefDetalhe);
          }}
          aria-label={rotuloAbrirDetalheCotacao(cotacao.empresa, temAlerta)}
          data-testid="cotacoes-abrir-detalhe"
          className={cn(
            "text-corpo hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-1 rounded-md p-2 font-medium focus-visible:ring-2 focus-visible:outline-none",
            descartada && "opacity-60",
          )}
        >
          {/* D-12: ícone (pista visual, vermelho, escondido do leitor de tela) + texto `sr-only`
              (pista para quem usa leitor de tela) — cor nunca é a única pista. O nome acessível
              deste `<Link>` já carrega "— tem alerta" via `aria-label` acima; este `sr-only`
              continua aqui só para o `toContainText` de outras verificações (achado do plano 03,
              regressão evitada). */}
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
