"use client";

import { useState } from "react";

import type { ContaEmAberto, DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import {
  FRASE_VAZIO_A_PAGAR,
  FRASE_VAZIO_A_RECEBER,
  ROTULO_TILE_A_PAGAR,
  ROTULO_TILE_A_RECEBER,
} from "@/lib/financeiro/textos";
import { CartaoConta } from "./cartao-conta";
import { DialogoBaixa, type ContaSelecionadaParaBaixa } from "./dialogo-baixa";
import { DialogoDocumento } from "./dialogo-documento";

export type ContaSelecionada = ContaSelecionadaParaBaixa;

export type ListasCaixaProps = {
  contas: readonly ContaEmAberto[];
  documentos: ReadonlyMap<string, DocumentoParaDetalhe>;
  hoje: string;
};

// "A pagar" e "A receber" (protótipo `telaCaixa`), lado a lado a partir de 980px (aproximado por
// `md:`, mesma convenção já usada em `painel-venda.tsx`/`painel-despesa.tsx` para este breakpoint
// do UI-SPEC) — cada lista com o próprio estado vazio (FNC-07). O detalhe do documento ("Ver") e o
// diálogo de "Paguei"/"Recebi" são UMA instância cada, compartilhada pelas duas colunas.
export function ListasCaixa({ contas, documentos, hoje }: ListasCaixaProps) {
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(null);
  const [baixaSelecionada, setBaixaSelecionada] = useState<ContaSelecionada | null>(null);

  const aPagar = contas.filter((conta) => conta.tipo === "despesa");
  const aReceber = contas.filter((conta) => conta.tipo === "venda");

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section data-testid="caixa-a-pagar" className="flex flex-col gap-2">
          <h2 className="text-titulo text-foreground">{ROTULO_TILE_A_PAGAR}</h2>
          {aPagar.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_A_PAGAR}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aPagar.map((conta) => (
                <CartaoConta
                  key={conta.parcelaId}
                  conta={conta}
                  hoje={hoje}
                  aoVer={setDocumentoAbertoId}
                  aoBaixar={(parcelaId, documentoId) => setBaixaSelecionada({ parcelaId, documentoId })}
                />
              ))}
            </div>
          )}
        </section>

        <section data-testid="caixa-a-receber" className="flex flex-col gap-2">
          <h2 className="text-titulo text-foreground">{ROTULO_TILE_A_RECEBER}</h2>
          {aReceber.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_A_RECEBER}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aReceber.map((conta) => (
                <CartaoConta
                  key={conta.parcelaId}
                  conta={conta}
                  hoje={hoje}
                  aoVer={setDocumentoAbertoId}
                  aoBaixar={(parcelaId, documentoId) => setBaixaSelecionada({ parcelaId, documentoId })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <DialogoDocumento
        documentoId={documentoAbertoId}
        documentos={documentos}
        aoFechar={() => setDocumentoAbertoId(null)}
      />

      <DialogoBaixa
        selecao={baixaSelecionada}
        contas={contas}
        hoje={hoje}
        aoFechar={() => setBaixaSelecionada(null)}
      />
    </>
  );
}
