"use client";

import { formatarReais } from "@/lib/abertura/formato";
import type { Cotacao } from "@/lib/cotacoes/consultas";
import {
  FRASE_VAZIO_SEM_COTACAO_TITULO,
  ROTULO_ALERTA_NA_LINHA,
  ROTULO_COLUNA_EMPRESA,
  ROTULO_COLUNA_ESPECIFICACAO,
  ROTULO_COLUNA_PRECO,
  ROTULO_COLUNA_SITUACAO,
  ROTULO_MARCAR_PARA_COMPARAR,
  ROTULO_NOVA_COTACAO,
  ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL,
  ROTULO_PRECO_SOB_CONSULTA_VISUAL,
  fraseVazioSemCotacaoCorpo,
} from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import { BotaoVazioCotacoes } from "@/components/amassa/cotacoes/botao-vazio-cotacoes";
import { SeloSituacao } from "@/components/amassa/cotacoes/selo-situacao";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Checkbox } from "@/components/ui/checkbox";

function PrecoCotacao({ centavos }: { centavos: number | null }) {
  if (centavos === null) {
    return (
      <span
        data-testid="cotacoes-preco"
        aria-label={ROTULO_PRECO_SOB_CONSULTA_ACESSIVEL}
        className="text-corpo font-bold tabular-nums"
      >
        {ROTULO_PRECO_SOB_CONSULTA_VISUAL}
      </span>
    );
  }
  return (
    <span data-testid="cotacoes-preco" className="text-corpo font-bold tabular-nums">
      {formatarReais(centavos)}
    </span>
  );
}

export type ListaCotacoesProps = {
  cotacoes: Cotacao[];
  categoriaId: string;
  categoriaNome: string;
  // A marcação para comparar (D-13) é estado só de CLIENTE, dono é `PainelCotacoes` — este
  // componente só lê e avisa, nunca guarda a própria cópia (evita duas fontes da mesma marca).
  marcados: ReadonlySet<string>;
  aoAlternarMarcacao: (id: string) => void;
};

// Duas formas do MESMO dado, alternadas por CSS na régua herdada de `04.2-UI-SPEC.md` (660px) —
// cartões empilhados abaixo, tabela HTML semântica a partir dali. Nenhuma regra de negócio nasce
// aqui: ordenar (plano 03) e comparar (plano 04) chegam prontos de fora.
export function ListaCotacoes({
  cotacoes,
  categoriaId,
  categoriaNome,
  marcados,
  aoAlternarMarcacao,
}: ListaCotacoesProps) {
  if (cotacoes.length === 0) {
    return (
      <EstadoVazio
        titulo={FRASE_VAZIO_SEM_COTACAO_TITULO}
        corpo={fraseVazioSemCotacaoCorpo(categoriaNome)}
        botao={
          <BotaoVazioCotacoes tipo="cotacao" rotulo={ROTULO_NOVA_COTACAO} categoriaId={categoriaId} />
        }
      />
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border" data-testid="cotacoes-painel">
      {/* Celular (<660px): cartões empilhados. */}
      <div className="divide-border flex flex-col divide-y min-[660px]:hidden">
        {cotacoes.map((cotacao) => (
          <div key={cotacao.id} data-testid="cotacoes-cartao" className="flex flex-col gap-1.5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-0.5 size-5"
                  checked={marcados.has(cotacao.id)}
                  onCheckedChange={() => aoAlternarMarcacao(cotacao.id)}
                  aria-label={ROTULO_MARCAR_PARA_COMPARAR(cotacao.empresa)}
                />
                {/* D-10: descartado continua visível, apagado — opacidade reduzida em
                    empresa/especificação/preço, NUNCA no selo (ele fica 100% opaco, o texto já é
                    a pista não visual). */}
                <span
                  className={cn(
                    "text-corpo font-semibold",
                    cotacao.situacao === "descartado" && "opacity-60",
                  )}
                >
                  {cotacao.alertas && <span className="sr-only">{ROTULO_ALERTA_NA_LINHA} </span>}
                  {cotacao.empresa}
                </span>
              </div>
              <SeloSituacao situacao={cotacao.situacao} />
            </div>
            <p
              className={cn(
                "text-apoio text-muted-foreground line-clamp-2",
                cotacao.situacao === "descartado" && "opacity-60",
              )}
            >
              {cotacao.produto}
            </p>
            <span className={cn(cotacao.situacao === "descartado" && "opacity-60")}>
              <PrecoCotacao centavos={cotacao.precoCentavos} />
            </span>
          </div>
        ))}
      </div>

      {/* A partir de 660px: tabela HTML semântica, todas as colunas (nunca `Table`/`Badge` do
          shadcn — não instalados, o projeto não usa essas abstrações). */}
      <table className="hidden w-full border-collapse min-[660px]:table">
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="w-11 p-3" />
            <th
              scope="col"
              className="text-micro text-muted-foreground p-3 text-left font-semibold tracking-wide uppercase"
            >
              {ROTULO_COLUNA_EMPRESA}
            </th>
            <th
              scope="col"
              className="text-micro text-muted-foreground p-3 text-left font-semibold tracking-wide uppercase"
            >
              {ROTULO_COLUNA_ESPECIFICACAO}
            </th>
            <th
              scope="col"
              className="text-micro text-muted-foreground p-3 text-left font-semibold tracking-wide uppercase"
            >
              {ROTULO_COLUNA_PRECO}
            </th>
            <th
              scope="col"
              className="text-micro text-muted-foreground p-3 text-left font-semibold tracking-wide uppercase"
            >
              {ROTULO_COLUNA_SITUACAO}
            </th>
          </tr>
        </thead>
        <tbody>
          {cotacoes.map((cotacao) => (
            <tr key={cotacao.id} data-testid="cotacoes-linha" className="border-border border-b last:border-0">
              <td className="p-3">
                <Checkbox
                  checked={marcados.has(cotacao.id)}
                  onCheckedChange={() => aoAlternarMarcacao(cotacao.id)}
                  aria-label={ROTULO_MARCAR_PARA_COMPARAR(cotacao.empresa)}
                />
              </td>
              {/* D-10: opacidade reduzida em empresa/especificação/preço, NUNCA no selo. */}
              <td
                className={cn(
                  "text-corpo p-3 font-medium",
                  cotacao.situacao === "descartado" && "opacity-60",
                )}
              >
                {cotacao.alertas && <span className="sr-only">{ROTULO_ALERTA_NA_LINHA} </span>}
                {cotacao.empresa}
              </td>
              <td
                className={cn(
                  "text-corpo text-muted-foreground p-3",
                  cotacao.situacao === "descartado" && "opacity-60",
                )}
              >
                {cotacao.produto}
              </td>
              <td className={cn("p-3", cotacao.situacao === "descartado" && "opacity-60")}>
                <PrecoCotacao centavos={cotacao.precoCentavos} />
              </td>
              <td className="p-3">
                <SeloSituacao situacao={cotacao.situacao} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
