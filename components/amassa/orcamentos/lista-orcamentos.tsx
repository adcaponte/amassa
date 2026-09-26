import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { numeroDeOrcamento, rotuloDeRevisao } from "@/lib/orcamentos/formato";
import type { OrcamentoParaLista } from "@/lib/orcamentos/consultas";
import {
  FRASE_SEM_CLIENTE,
  FRASE_SEM_TITULO,
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ROTULO_CHIP_RASCUNHO,
  TITULO_LISTA_ORCAMENTOS,
} from "@/lib/orcamentos/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { NovoOrcamentoBotao } from "./novo-orcamento-botao";

export type ListaOrcamentosProps = {
  orcamentos: OrcamentoParaLista[];
};

// Server Component (nenhum estado, nenhum efeito) — só `NovoOrcamentoBotao` é cliente, pela
// mesma razão de `ListaContasFixas`: precisa de estado local para "enviando" e decidir a
// navegação a partir da resposta do servidor.
export function ListaOrcamentos({ orcamentos }: ListaOrcamentosProps) {
  if (orcamentos.length === 0) {
    return (
      <EstadoVazio
        testId="orcamentos-lista"
        titulo={FRASE_VAZIO_TITULO}
        corpo={FRASE_VAZIO_CORPO}
        botao={<NovoOrcamentoBotao />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8" data-testid="orcamentos-lista">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-titulo text-foreground">{TITULO_LISTA_ORCAMENTOS}</h2>
        <NovoOrcamentoBotao />
      </div>

      <ul className="flex flex-col gap-1">
        {orcamentos.map((orcamento) => (
          <li
            key={orcamento.id}
            data-testid="orcamento-linha"
            className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-corpo text-foreground break-words">
                {orcamento.titulo ?? FRASE_SEM_TITULO}
              </span>
              <span className="text-apoio text-muted-foreground break-words">
                <span data-testid="orcamento-numero">
                  {`nº ${numeroDeOrcamento(orcamento.ano, orcamento.sequencial)}${rotuloDeRevisao(orcamento.revisao)}`}
                </span>
                {` · ${orcamento.clienteNome ?? FRASE_SEM_CLIENTE} · ${formatarDataCurta(orcamento.data)}`}
              </span>
            </div>

            {/* Total à direita — por enquanto sempre R$ 0,00 (ainda não há linha de peça; o
                plano 04 acrescenta o cálculo). */}
            <span className="text-corpo text-foreground tabular-nums">{formatarReais(0)}</span>

            {/* Chip de situação — só "rascunho" existe até este plano; os demais chegam com o
                resto do ciclo de vida do orçamento. */}
            <span className="text-apoio bg-muted text-muted-foreground rounded-full px-2 py-0.5">
              {ROTULO_CHIP_RASCUNHO}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
