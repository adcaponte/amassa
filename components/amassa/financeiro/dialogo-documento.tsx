"use client";

import { useState } from "react";

import type { DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import { nomeDaLinha } from "@/lib/financeiro/documento";
import { formatarDataCurta, formatarInstanteCurto, formatarReais } from "@/lib/financeiro/formato";
import {
  DICA_CANCELAR_NAO_APAGA,
  ROTULO_FECHAR,
  rotuloCancelar,
  textoCabecalhoDocumento,
  textoCanceladoPor,
  textoParcelaDetalhe,
  textoPagoEm,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmarCancelarDocumento } from "./confirmar-cancelar-documento";

export type DialogoDocumentoProps = {
  // Estado local do PAI (nunca `?query=`, mesma disciplina de `DialogoValorLivre`) — nulo fecha o
  // diálogo. `documentos` é a lista JÁ carregada pela página (contas em aberto + movimentos do
  // mês): este componente acha o documento pelo id, nunca faz uma segunda consulta ao abrir.
  documentoId: string | null;
  documentos: ReadonlyMap<string, DocumentoParaDetalhe>;
  aoFechar: () => void;
};

// O detalhe do documento (protótipo `folhaDoc`): cabeçalho, linhas com a etiqueta de categoria
// (inclusive a linha de diferença — sem selo especial, é uma linha normal), as parcelas com
// "recebida/paga em" nas pagas, e "Cancelar esta venda/despesa" quando ainda não cancelado.
export function DialogoDocumento({ documentoId, documentos, aoFechar }: DialogoDocumentoProps) {
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const documento = documentoId ? (documentos.get(documentoId) ?? null) : null;
  const aberto = documento !== null;

  return (
    <>
      <Dialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !cancelarAberto) {
            aoFechar();
          }
        }}
      >
        <DialogContent
          data-testid="documento-detalhe"
          className="max-h-[85svh] overflow-y-auto"
        >
          {documento && (
            <>
              <DialogHeader>
                <DialogTitle className="[overflow-wrap:anywhere]">{documento.titulo}</DialogTitle>
              </DialogHeader>

              <p className="text-apoio text-muted-foreground">
                {textoCabecalhoDocumento(
                  documento.tipo,
                  documento.numero,
                  formatarDataCurta(documento.data),
                  documento.pessoa,
                )}
                {documento.cancelado && (
                  <>
                    {" · "}
                    <b>cancelada</b>
                  </>
                )}
              </p>

              <ul className="flex flex-col gap-2">
                {documento.linhas.map((linha, indice) => (
                  <li
                    key={indice}
                    data-testid="documento-linha"
                    className="flex items-center justify-between gap-3 border-b py-1 last:border-0"
                  >
                    <span className="text-corpo min-w-0 flex-1">
                      {nomeDaLinha({
                        nome: linha.descricao,
                        quantidade: linha.quantidade,
                        quantidadeEstoque: linha.quantidadeEstoque,
                        unidade: linha.unidade,
                      })}{" "}
                      <span className="bg-muted text-apoio rounded px-1.5 py-0.5">
                        {linha.categoriaNome}
                      </span>
                    </span>
                    <span className="text-corpo tabular-nums whitespace-nowrap">
                      {formatarReais(linha.valorCentavos)}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="text-corpo text-foreground font-semibold">Parcelas</h3>
              <ul className="flex flex-col gap-2">
                {documento.parcelas.map((parcela) => (
                  <li
                    key={parcela.id}
                    data-testid="documento-parcela"
                    className="flex items-center justify-between gap-3 border-b py-1 last:border-0"
                  >
                    <span className="text-corpo min-w-0 flex-1">
                      {textoParcelaDetalhe(
                        parcela.numero,
                        documento.deQuantasParcelas,
                        formatarDataCurta(parcela.vencimento),
                      )}{" "}
                      {parcela.pagoEm && (
                        <span className="text-sucesso text-apoio">
                          {textoPagoEm(documento.tipo, formatarDataCurta(parcela.pagoEm))}
                        </span>
                      )}
                    </span>
                    <span className="text-corpo tabular-nums whitespace-nowrap">
                      {formatarReais(parcela.valorCentavos)}
                    </span>
                  </li>
                ))}
              </ul>

              {documento.cancelado ? (
                documento.canceladoPorNome &&
                documento.canceladoEm && (
                  <p className="text-apoio text-muted-foreground">
                    {textoCanceladoPor(
                      documento.canceladoPorNome,
                      formatarInstanteCurto(documento.canceladoEm),
                    )}
                  </p>
                )
              ) : (
                <p className="text-apoio text-muted-foreground">{DICA_CANCELAR_NAO_APAGA}</p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {!documento.cancelado && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-erro text-erro min-h-[44px]"
                    onClick={() => setCancelarAberto(true)}
                  >
                    {rotuloCancelar(documento.tipo)}
                  </Button>
                )}
                <Button type="button" variant="outline" className="min-h-[44px]" onClick={aoFechar}>
                  {ROTULO_FECHAR}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmarCancelarDocumento
        documento={documento}
        aberto={cancelarAberto}
        aoMudarAberto={setCancelarAberto}
      />
    </>
  );
}
