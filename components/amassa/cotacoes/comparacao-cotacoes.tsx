"use client";

import Link from "next/link";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { FRASE_VAZIO_COMPARACAO_CORPO, FRASE_VAZIO_COMPARACAO_TITULO, rotuloEditarCotacao } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import { useAbridorDeCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { CamposLongos } from "@/components/amassa/cotacoes/campos-longos";
import { PrecoCotacao } from "@/components/amassa/cotacoes/preco-cotacao";
import { SeloSituacao } from "@/components/amassa/cotacoes/selo-situacao";

export type ComparacaoCotacoesProps = {
  // As cotações MARCADAS, já na ordem que a lista está mostrando (`PainelCotacoes` já aplicou
  // `ordenarCotacoes` antes de filtrar pelos marcados) — nunca uma segunda ordenação aqui.
  cotacoes: Cotacao[];
  categoriaId: string;
};

// A visão de colunas (D-13) — a razão de o módulo existir. Cada coluna: empresa, especificação,
// preço EM DESTAQUE, selo, e então os MESMOS seis campos longos do detalhe (`CamposLongos`,
// Tarefa 2), na MESMA ordem — é isso que faz os campos ficarem ALINHADOS entre as colunas, não
// só "lado a lado".
export function ComparacaoCotacoes({ cotacoes, categoriaId }: ComparacaoCotacoesProps) {
  const abridor = useAbridorDeCotacoes();

  // Menos de duas marcadas: a mensagem do §Copywriting Contract, NENHUMA coluna — nem uma solta.
  // Mesma mensagem para zero e para uma marcada.
  if (cotacoes.length < 2) {
    return (
      <div
        data-testid="cotacoes-comparacao"
        className="border-border bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center"
      >
        <h2 className="text-titulo text-foreground">{FRASE_VAZIO_COMPARACAO_TITULO}</h2>
        <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_COMPARACAO_CORPO}</p>
      </div>
    );
  }

  return (
    // A rolagem horizontal é DO CONTÊINER, nunca da página — a única exceção de rolagem
    // horizontal do módulo (D-13), vale igual no celular e no desktop.
    <div data-testid="cotacoes-comparacao" className="flex gap-3.5 overflow-x-auto pb-1.5">
      {cotacoes.map((cotacao) => {
        // D-10: cotação descartada PODE ser marcada e comparada — a coluna toda fica com
        // opacidade reduzida, mas o SELO continua 100% visível no topo (evita que a coluna
        // pareça um erro de carregamento).
        const descartada = cotacao.situacao === "descartado";
        const hrefEditar = `/abertura?aba=cotacoes&categoria=${categoriaId}&cotacao=${cotacao.id}`;

        return (
          <div
            key={cotacao.id}
            data-testid="cotacoes-comparacao-coluna"
            className="border-border bg-card w-[260px] flex-none rounded-xl border p-4 min-[980px]:w-[300px]"
          >
            <h3 className={cn("text-corpo font-semibold", descartada && "opacity-60")}>{cotacao.empresa}</h3>
            {cotacao.produto && (
              <p className={cn("text-apoio text-muted-foreground mb-2.5", descartada && "opacity-60")}>
                {cotacao.produto}
              </p>
            )}
            <div className={cn("mb-3 flex items-center gap-2", descartada && "opacity-60")}>
              <PrecoCotacao centavos={cotacao.precoCentavos} tamanho="titulo" />
            </div>
            <div className="mb-3.5">
              <SeloSituacao situacao={cotacao.situacao} />
            </div>

            <div className={cn(descartada && "opacity-60")}>
              <CamposLongos cotacao={cotacao} />
            </div>

            <Link
              href={hrefEditar}
              onClick={(evento) => {
                evento.preventDefault();
                irParaSemNavegar(hrefEditar);
                abridor.abrirCotacao(cotacao);
              }}
              aria-label={rotuloEditarCotacao(cotacao.empresa)}
              className="border-border hover:bg-muted text-corpo mt-3.5 flex min-h-[44px] w-full items-center justify-center rounded-md border px-4"
            >
              Editar
            </Link>
          </div>
        );
      })}
    </div>
  );
}
