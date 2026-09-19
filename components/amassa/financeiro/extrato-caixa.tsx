"use client";

import { useState } from "react";

import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import type { LinhaDoExtrato } from "@/lib/financeiro/extrato";
import type { DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import { taxaEmCentavos } from "@/lib/financeiro/taxa";
import {
  FRASE_VAZIO_EXTRATO,
  ROTULO_FORMA,
  ROTULO_VER,
  textoParcelaDoExtrato,
  TITULO_EXTRATO,
} from "@/lib/financeiro/textos";
import { DialogoDocumento } from "./dialogo-documento";

export type ExtratoCaixaProps = {
  // Já filtradas para o mês corrente e ordenadas mais recente primeiro pela página — este
  // componente só desenha, nunca reordena nem refiltra (mesma disciplina de `lista-itens.tsx`).
  linhas: readonly LinhaDoExtrato[];
  // A mesma lista JÁ carregada pela página, para o link "ver" abrir o detalhe sem uma segunda
  // consulta — instância PRÓPRIA de `DialogoDocumento` (independente da de `ListasCaixa`; os dois
  // recebem o mesmo mapa, cada um cuida do próprio estado local de "qual documento está aberto").
  documentos: ReadonlyMap<string, DocumentoParaDetalhe>;
};

// "O que já entrou e saiu" (protótipo `telaCaixa`) — "+"/"−" com cor de sucesso/erro, forma,
// "saldo R$ Y" (nulo/riscado quando cancelado), e o link "ver" por linha (04.4-08-PLAN.md).
// Cancelamento pelo extrato usa o MESMO detalhe/confirmação do Caixa; navegação por mês/filtro
// por forma (D-11/D-12) entram em planos futuros — aqui é o mês corrente, sempre.
export function ExtratoCaixa({ linhas, documentos }: ExtratoCaixaProps) {
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(null);

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_EXTRATO}</h2>

      {linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_EXTRATO}</p>
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
