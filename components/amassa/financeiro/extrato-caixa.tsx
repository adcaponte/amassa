"use client";

import { useState } from "react";
import Link from "next/link";

import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import type { ExtratoFiltrado } from "@/lib/financeiro/extrato";
import type { FormaDoFiltroDoExtrato } from "@/lib/financeiro/abas";
import type { DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import { taxaEmCentavos } from "@/lib/financeiro/taxa";
import {
  FRASE_VAZIO_EXTRATO,
  FRASE_VAZIO_EXTRATO_NA_FORMA,
  ROTULO_FILTRO_TODAS,
  ROTULO_FORMA,
  ROTULO_VER,
  textoParcelaDoExtrato,
  textoTotalFiltrado,
  TITULO_EXTRATO,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { DialogoDocumento } from "./dialogo-documento";
import { NavegacaoMes } from "./navegacao-mes";

const FORMAS_DO_FILTRO: readonly FormaDoFiltroDoExtrato[] = ["todas", "dinheiro", "pix", "cartao"];

function rotuloDaForma(forma: FormaDoFiltroDoExtrato): string {
  return forma === "todas" ? ROTULO_FILTRO_TODAS : ROTULO_FORMA[forma];
}

export type ExtratoCaixaProps = {
  mes: string;
  forma: FormaDoFiltroDoExtrato;
  // Já filtrado por mês/forma (D-11/D-12) pela página, com o saldo depois de `montarExtrato`
  // intacto — este componente só desenha, nunca refiltra nem recalcula saldo.
  extrato: ExtratoFiltrado;
  hrefMesAnterior: string;
  hrefMesSeguinte: string;
  // Um `href` por pílula de forma, preservando o mês atual — montado pela página (a mesma
  // disciplina de `NavegacaoMes`: este componente não conhece a estrutura da URL).
  hrefPorForma: Record<FormaDoFiltroDoExtrato, string>;
  // A mesma lista JÁ carregada pela página, para o link "ver" abrir o detalhe sem uma segunda
  // consulta — instância PRÓPRIA de `DialogoDocumento` (independente da de `ListasCaixa`; os dois
  // recebem o mesmo mapa, cada um cuida do próprio estado local de "qual documento está aberto").
  documentos: ReadonlyMap<string, DocumentoParaDetalhe>;
};

// "O que já entrou e saiu" (protótipo `telaCaixa`) — navegação por mês e filtro por forma
// (D-11/D-12): "+"/"−" com cor de sucesso/erro, forma, "saldo R$ Y" (nulo/riscado quando
// cancelado), o link "ver" por linha, e o total filtrado quando uma forma está escolhida. A régua
// que cortava o protótipo num número fixo de movimentos recentes não existe mais — a paginação
// natural por mês (D-11) já resolve o mesmo problema sem um segundo corte arbitrário por cima:
// todos os movimentos do mês/forma escolhidos aparecem.
export function ExtratoCaixa({
  mes,
  forma,
  extrato,
  hrefMesAnterior,
  hrefMesSeguinte,
  hrefPorForma,
  documentos,
}: ExtratoCaixaProps) {
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(null);
  const { linhas, totalFiltradoCentavos, motivoVazio } = extrato;

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_EXTRATO}</h2>

      <NavegacaoMes mes={mes} hrefMesAnterior={hrefMesAnterior} hrefMesSeguinte={hrefMesSeguinte} />

      <div role="group" aria-label="Filtrar por forma" className="flex flex-wrap gap-2">
        {FORMAS_DO_FILTRO.map((valor) => {
          const marcada = valor === forma;
          return (
            <Link
              key={valor}
              href={hrefPorForma[valor]}
              aria-current={marcada ? "true" : undefined}
              data-testid={`extrato-filtro-${valor}`}
              className={cn(
                "text-corpo flex min-h-[44px] items-center justify-center rounded-md border px-4 font-medium",
                marcada
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-secondary text-secondary-foreground",
              )}
            >
              {rotuloDaForma(valor)}
            </Link>
          );
        })}
      </div>

      {totalFiltradoCentavos !== null && (
        <p data-testid="extrato-total-filtrado" className="text-corpo text-foreground tabular-nums">
          {textoTotalFiltrado(
            rotuloDaForma(forma),
            `${totalFiltradoCentavos < 0 ? "− " : "+ "}${formatarReais(Math.abs(totalFiltradoCentavos))}`,
          )}
        </p>
      )}

      {linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">
          {motivoVazio === "sem-movimento-na-forma" ? FRASE_VAZIO_EXTRATO_NA_FORMA : FRASE_VAZIO_EXTRATO}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.map((linha) => {
            const sinal = linha.tipo === "venda" ? "+" : "−";
            return (
              <li
                key={linha.parcelaId}
                data-testid="extrato-linha"
                className={
                  "border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border px-3 py-2" +
                  (linha.cancelado ? " text-muted-foreground line-through" : "")
                }
              >
                <span className="text-corpo min-w-0 flex-1 truncate">
                  {linha.titulo}
                  {linha.deQuantas > 1 && (
                    <span data-testid="extrato-parcela" className="text-apoio text-muted-foreground ml-2">
                      {textoParcelaDoExtrato(linha.numeroParcela, linha.deQuantas)}
                    </span>
                  )}
                </span>
                <span
                  className={
                    "text-corpo tabular-nums " +
                    (linha.cancelado
                      ? ""
                      : linha.tipo === "venda"
                        ? "text-sucesso"
                        : "text-erro")
                  }
                >
                  {sinal} {formatarReais(linha.liquidoCentavos)}
                </span>
                <span className="text-apoio text-muted-foreground flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="extrato-ver"
                    className="hover:text-foreground underline underline-offset-2"
                    onClick={() => setDocumentoAbertoId(linha.documentoId)}
                  >
                    {ROTULO_VER.toLowerCase()}
                  </button>
                  {formatarDataCurta(linha.pagoEm)} · {ROTULO_FORMA[linha.forma]}
                  {linha.cancelado ? " · cancelada" : ""}
                </span>
                {linha.taxaPontosBase != null && (
                  <span data-testid="extrato-taxa" className="text-apoio text-muted-foreground">
                    taxa {formatarReais(taxaEmCentavos(linha.valorCentavos, linha.taxaPontosBase))}
                  </span>
                )}
                {linha.saldoDepoisCentavos !== null ? (
                  <span data-testid="extrato-saldo-depois" className="text-apoio tabular-nums">
                    saldo {formatarReais(linha.saldoDepoisCentavos)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <DialogoDocumento
        documentoId={documentoAbertoId}
        documentos={documentos}
        aoFechar={() => setDocumentoAbertoId(null)}
      />
    </section>
  );
}
