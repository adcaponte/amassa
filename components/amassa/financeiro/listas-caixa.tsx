"use client";

import { useEffect, useState } from "react";

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
  // "Ver venda no Financeiro" (04.5-12-PLAN.md, D-25) — o id que a página já resolveu de
  // `?documentoId=<uuid>`, para o detalhe abrir sozinho assim que a aba Caixa carrega. `null` na
  // navegação normal (o dono clica "Ver" num cartão, como sempre).
  documentoParaAbrirId?: string | null;
  // "Paguei"/"Recebi" no Início, na parcela específica (D-06, 04.6-06-PLAN.md) — o id que a
  // página já resolveu de `?parcelaFoco=<uuid>`. A linha cujo `parcelaId` casa ganha destaque
  // visual e rola até a vista sozinha; `null` na navegação normal (nenhuma linha em foco).
  parcelaParaFocarId?: string | null;
};

// "A pagar" e "A receber" (protótipo `telaCaixa`), lado a lado a partir de 980px (aproximado por
// `md:`, mesma convenção já usada em `painel-venda.tsx`/`painel-despesa.tsx` para este breakpoint
// do UI-SPEC) — cada lista com o próprio estado vazio (FNC-07). O detalhe do documento ("Ver") e o
// diálogo de "Paguei"/"Recebi" são UMA instância cada, compartilhada pelas duas colunas.
export function ListasCaixa({
  contas,
  documentos,
  hoje,
  documentoParaAbrirId = null,
  parcelaParaFocarId = null,
}: ListasCaixaProps) {
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(documentoParaAbrirId);
  const [baixaSelecionada, setBaixaSelecionada] = useState<ContaSelecionada | null>(null);

  const aPagar = contas.filter((conta) => conta.tipo === "despesa");
  const aReceber = contas.filter((conta) => conta.tipo === "venda");

  // Chegar pela URL rola até a linha em foco (D-06) — só na MONTAGEM, nunca de novo se
  // `parcelaParaFocarId` mudar depois (navegação normal dentro da mesma tela não deve
  // "puxar" a rolagem de volta).
  useEffect(() => {
    if (!parcelaParaFocarId) {
      return;
    }
    document
      .getElementById(`conta-${parcelaParaFocarId}`)
      ?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function linhaDaConta(conta: (typeof contas)[number]) {
    const emFoco = conta.parcelaId === parcelaParaFocarId;
    return (
      <div
        key={conta.parcelaId}
        id={`conta-${conta.parcelaId}`}
        data-testid={emFoco ? "caixa-parcela-focada" : undefined}
        className={emFoco ? "-mx-2 rounded-lg bg-atencao-fundo px-2 py-1" : undefined}
      >
        <CartaoConta
          conta={conta}
          hoje={hoje}
          aoVer={setDocumentoAbertoId}
          aoBaixar={(parcelaId, documentoId) => setBaixaSelecionada({ parcelaId, documentoId })}
        />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section data-testid="caixa-a-pagar" className="flex flex-col gap-2">
          <h2 className="text-titulo text-foreground">{ROTULO_TILE_A_PAGAR}</h2>
          {aPagar.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_A_PAGAR}</p>
          ) : (
            <div className="flex flex-col gap-2">{aPagar.map((conta) => linhaDaConta(conta))}</div>
          )}
        </section>

        <section data-testid="caixa-a-receber" className="flex flex-col gap-2">
          <h2 className="text-titulo text-foreground">{ROTULO_TILE_A_RECEBER}</h2>
          {aReceber.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_A_RECEBER}</p>
          ) : (
            <div className="flex flex-col gap-2">{aReceber.map((conta) => linhaDaConta(conta))}</div>
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
