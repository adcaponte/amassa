"use client";

import { useState } from "react";

import { cancelarDocumento } from "@/lib/financeiro/acoes";
import type { DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import {
  fraseConfirmarCancelamento,
  rotuloConfirmarCancelamento,
  ROTULO_VOLTAR,
} from "@/lib/financeiro/textos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmarCancelarDocumentoProps = {
  // O documento já encontrado pelo `DialogoDocumento` (nunca uma segunda busca aqui) — nulo
  // quando nenhum documento está aberto no detalhe.
  documento: DocumentoParaDetalhe | null;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
};

// `AlertDialog` DESTRUTIVO (FNC-10): cancelar é irreversível pela interface — "errou, cancela e
// lança de novo" (briefing §5). O botão de confirmar não fecha antes da resposta do servidor
// (mesma disciplina de `ConfirmarCancelar`/`ConfirmarRemoverCategoria`); sucesso é uma NAVEGAÇÃO
// COMPLETA para o aviso `cancelado` — nunca uma atualização de roteador do Next.
export function ConfirmarCancelarDocumento({
  documento,
  aberto,
  aoMudarAberto,
}: ConfirmarCancelarDocumentoProps) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (!documento) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resposta = await cancelarDocumento({ documentoId: documento.id });

    if (!resposta.ok) {
      setEnviando(false);
      setErro(resposta.erro);
      return;
    }

    window.location.assign(
      `/financeiro?aba=caixa&aviso=cancelado&documento=${resposta.dados.documentoId}`,
    );
  }

  return (
    <AlertDialog
      open={aberto && documento !== null}
      onOpenChange={(novoValor) => {
        if (!enviando) {
          aoMudarAberto(novoValor);
          if (novoValor) {
            setErro(null);
          }
        }
      }}
    >
      <AlertDialogContent className="max-h-[85svh] overflow-y-auto">
        {documento && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {fraseConfirmarCancelamento(documento.tipo, documento.numero, documento.titulo)}
              </AlertDialogTitle>
            </AlertDialogHeader>

            {erro && (
              <p role="alert" className="text-apoio text-erro">
                {erro}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviando}>{ROTULO_VOLTAR}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={enviando} onClick={confirmar}>
                {enviando ? "Cancelando…" : rotuloConfirmarCancelamento(documento.tipo)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
