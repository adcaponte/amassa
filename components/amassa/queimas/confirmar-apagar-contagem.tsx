"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apagarContagem } from "@/lib/queimas/acoes";
import type { Contagem } from "@/lib/queimas/contagem";
import {
  FRASE_FALHA_AO_APAGAR_CONTAGEM,
  ROTULO_APAGANDO,
  ROTULO_APAGAR_CONTAGEM,
  TITULO_APAGAR_CONTAGEM,
  TOAST_CONTAGEM_APAGADA,
  corpoApagarContagem,
} from "@/lib/queimas/textos";

export type ConfirmarApagarContagemProps = {
  queimaId: string;
  // A contagem que a folha mostra — o servidor só apaga se a gravada for ESTA (06.4-WR-01, quick
  // 261005-2yu).
  esperada: Contagem;
  // As peças da contagem GRAVADA — é o que se perde.
  pecasContadas: number;
  // "Biscoito de 18/12".
  tituloDaQueima: string;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  // Depois de apagar: quem abriu fecha a folha.
  aoApagar: () => void;
  // A gravada mudou desde que a folha abriu: o diálogo fecha e a folha mostra a frase e passa a esperar
  // a contagem atual.
  aoTelaMudar: (frase: string, contagemAtual: Contagem | null) => void;
};

// "Salvar" com tudo zero numa contagem EXISTENTE (UI-D6, U08): antes de apagar, pergunta e diz o que se
// perde (CLAUDE.md §Exclusão). Molde exato de `ConfirmarExcluirQueima`: `preventDefault` no clique de
// confirmação para o diálogo não fechar antes da resposta, `onOpenChange` ignorado durante o envio, erro
// `role="alert"` DENTRO do diálogo (que continua aberto) — inclusive a recusa da D-07, com peça lançada
// em venda ativa. Confirmado, a queima volta para "Sem contagem"; a queima em si continua.
export function ConfirmarApagarContagem({
  queimaId,
  esperada,
  pecasContadas,
  tituloDaQueima,
  aberto,
  aoMudarAberto,
  aoApagar,
  aoTelaMudar,
}: ConfirmarApagarContagemProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      const resposta = await apagarContagem({ queimaId, esperada });
      if (!resposta.ok) {
        if (resposta.telaMudou) {
          aoMudarAberto(false);
          aoTelaMudar(resposta.erro, resposta.contagemAtual ?? null);
          router.refresh();
          return;
        }
        setErro(resposta.erro);
        return;
      }
    } catch {
      setErro(FRASE_FALHA_AO_APAGAR_CONTAGEM);
      return;
    } finally {
      setEnviando(false);
    }

    toast.success(TOAST_CONTAGEM_APAGADA);
    aoMudarAberto(false);
    aoApagar();
    router.refresh();
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!enviando) {
          aoMudarAberto(novoValor);
          if (novoValor) {
            setErro(null);
          }
        }
      }}
    >
      <AlertDialogContent
        data-testid="confirmar-apagar-contagem"
        className="max-h-[85svh] overflow-y-auto"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{TITULO_APAGAR_CONTAGEM}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {corpoApagarContagem(pecasContadas, tituloDaQueima)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {erro && (
          <p role="alert" className="text-apoio text-erro">
            {erro}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={enviando} onClick={confirmar}>
            {enviando ? ROTULO_APAGANDO : ROTULO_APAGAR_CONTAGEM}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
