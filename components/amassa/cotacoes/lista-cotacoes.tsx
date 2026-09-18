"use client";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import {
  FRASE_VAZIO_SEM_COTACAO_TITULO,
  ROTULO_COLUNA_EMPRESA,
  ROTULO_COLUNA_ESPECIFICACAO,
  ROTULO_COLUNA_PRECO,
  ROTULO_COLUNA_SITUACAO,
  ROTULO_NOVA_COTACAO,
  fraseVazioSemCotacaoCorpo,
} from "@/lib/cotacoes/textos";
import { BotaoVazioCotacoes } from "@/components/amassa/cotacoes/botao-vazio-cotacoes";
import { CartaoCotacao } from "@/components/amassa/cotacoes/cartao-cotacao";
import { LinhaCotacao } from "@/components/amassa/cotacoes/linha-cotacao";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

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
// cartões empilhados abaixo (`CartaoCotacao`), tabela HTML semântica a partir dali
// (`LinhaCotacao`). As duas formas foram extraídas para componentes próprios na Tarefa 3
// (04.3-03) — o comportamento visual de descartado (D-10) e de alerta (D-12) vive num lugar por
// FORMA, não espalhado aqui. Nenhuma regra de negócio nasce neste componente: ordenar (plano 03)
// e comparar (plano 04) chegam prontos de fora.
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
        testId="cotacoes-vazio-cotacoes"
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
          <CartaoCotacao
            key={cotacao.id}
            cotacao={cotacao}
            categoriaId={categoriaId}
            marcado={marcados.has(cotacao.id)}
            aoAlternarMarcacao={() => aoAlternarMarcacao(cotacao.id)}
          />
        ))}
      </div>

      {/* A partir de 660px: tabela HTML semântica, todas as colunas (nunca `Table`/`Badge` do
          shadcn — não instalados, o projeto não usa essas abstrações). */}
      <table className="hidden w-full border-collapse min-[660px]:table">
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="w-11 p-1" />
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
            {/* Célula própria para as ferramentas (editar/remover) — sem rótulo visível, mesmo
                molde da coluna da caixa de marcação acima. */}
            <th scope="col" className="w-[76px] p-3" />
          </tr>
        </thead>
        <tbody>
          {cotacoes.map((cotacao) => (
            <LinhaCotacao
              key={cotacao.id}
              cotacao={cotacao}
              categoriaId={categoriaId}
              marcado={marcados.has(cotacao.id)}
              aoAlternarMarcacao={() => aoAlternarMarcacao(cotacao.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
