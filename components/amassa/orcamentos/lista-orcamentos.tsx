import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { numeroDeOrcamento, rotuloDeRevisao } from "@/lib/orcamentos/formato";
import type { OrcamentoParaLista } from "@/lib/orcamentos/consultas";
import { situacaoDoOrcamento } from "@/lib/orcamentos/situacao";
import {
  FRASE_SEM_CLIENTE,
  FRASE_SEM_TITULO,
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ROTULO_ABRIR_ORCAMENTO,
  TITULO_LISTA_ORCAMENTOS,
} from "@/lib/orcamentos/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { ChipDeSituacao } from "./chip-de-situacao";
import { NovoOrcamentoBotao } from "./novo-orcamento-botao";

export type ListaOrcamentosProps = {
  orcamentos: OrcamentoParaLista[];
  hoje: string;
};

// Server Component (nenhum estado, nenhum efeito) — só `NovoOrcamentoBotao` é cliente, pela
// mesma razão de `ListaContasFixas`: precisa de estado local para "enviando" e decidir a
// navegação a partir da resposta do servidor.
export function ListaOrcamentos({ orcamentos, hoje }: ListaOrcamentosProps) {
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
          // Empilhado no celular, em linha no desktop — e o motivo é um defeito real, visto pelo
          // dono num Android em 2026-09-27: com TUDO numa fileira só, o total, o chip e o "Abrir"
          // comiam a largura, sobrava uma coluna de poucos pixels para o nome, e o `break-words`
          // então quebrava o título UMA PALAVRA POR LINHA. Um orçamento chamado "jogo de mesa"
          // virava um cartão de seis linhas de altura.
          //
          // `flex-wrap` sozinho não resolvia: o nome tem `flex-1`, então ele ENCOLHE em vez de
          // empurrar os outros para a fileira de baixo. A correção é dar ao nome a largura
          // inteira no celular e agrupar os três controles numa fileira própria.
          <li
            key={orcamento.id}
            data-testid="orcamento-linha"
            className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
          >
            <a
              href={rotaDeGestao(`/financeiro?aba=orcamentos&orcamento=${orcamento.id}`)}
              className="flex min-w-0 flex-col sm:flex-1"
            >
              <span className="text-corpo text-foreground break-words">
                {orcamento.titulo ?? FRASE_SEM_TITULO}
              </span>
              <span className="text-apoio text-muted-foreground break-words">
                <span data-testid="orcamento-numero">
                  {`nº ${numeroDeOrcamento(orcamento.ano, orcamento.sequencial)}${rotuloDeRevisao(orcamento.revisao)}`}
                </span>
                {` · ${orcamento.clienteNome ?? FRASE_SEM_CLIENTE} · ${formatarDataCurta(orcamento.data)}`}
              </span>
            </a>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              {/* O total sai SEMPRE da soma das linhas, agregada na própria consulta
                  (`listarOrcamentos`) — nunca uma coluna gravada. */}
              <span data-testid="orcamento-total" className="text-corpo text-foreground tabular-nums">
                {formatarReais(orcamento.totalCentavos)}
              </span>

              <ChipDeSituacao situacao={situacaoDoOrcamento(orcamento, hoje)} />

              <a
                href={rotaDeGestao(`/financeiro?aba=orcamentos&orcamento=${orcamento.id}`)}
                className="text-corpo hover:bg-muted flex min-h-[44px] flex-none items-center rounded-md px-3 font-medium"
              >
                {ROTULO_ABRIR_ORCAMENTO}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
