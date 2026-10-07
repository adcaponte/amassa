"use client";

import { useState } from "react";

import { cancelarDocumento } from "@/lib/financeiro/acoes";
import type { DocumentoParaDetalhe } from "@/lib/financeiro/consultas";
import { hrefDaCorrecao } from "@/lib/financeiro/navegacao";
import {
  fraseCancelarCorrecao,
  fraseConfirmarCancelamento,
  rotuloConfirmarCancelamento,
  rotuloCorrigir,
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
import { Button } from "@/components/ui/button";
import { rotaDeGestao } from "@/lib/rotas/gestao";

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
//
// 06.5-WR-02 (quick 261007-shs; decisão do dono, 07/10/2026): quando o documento CORRIGE outro, a confirmação
// diz que a original continua cancelada e que cancelar este não a traz de volta (não existe “descancelar”, e
// o vínculo da correção não se desfaz), e oferece “Corrigir esta venda/despesa” — a saída indicada quando a
// correção é que estava errada. Fora desse caso, o diálogo é o de sempre. Nenhum dado muda de forma.
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
      rotaDeGestao(`/financeiro?aba=caixa&aviso=cancelado&documento=${resposta.dados.documentoId}`),
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

            {documento.corrigeNumero !== null && (
              <p data-testid="cancelar-correcao-aviso" className="text-corpo text-foreground">
                {fraseCancelarCorrecao(documento.tipo, documento.corrigeNumero)}
              </p>
            )}

            {erro && (
              <p role="alert" className="text-apoio text-erro">
                {erro}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviando}>{ROTULO_VOLTAR}</AlertDialogCancel>
              {documento.corrigeNumero !== null && documento.origemParaCorrecao === null && (
                <Button
                  asChild
                  variant="outline"
                  data-testid="cancelar-correcao-corrigir"
                  className="h-auto min-h-[44px] whitespace-normal"
                >
                  <a href={hrefDaCorrecao(documento.tipo, documento.id)}>{rotuloCorrigir(documento.tipo)}</a>
                </Button>
              )}
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
