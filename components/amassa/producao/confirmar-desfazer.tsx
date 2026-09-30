"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { desfazerEtapa } from "@/lib/producao/acoes";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  FRASE_FALHA_AO_DESFAZER,
  ROTULO_DESFAZENDO,
  ROTULO_VOLTAR,
  rotuloConfirmarDesfazer,
  textoConfirmarDesfazer,
  textoToastDesfeito,
  tituloConfirmarDesfazer,
} from "@/lib/producao/textos";
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

// O que a confirmação mostra — FOTOGRAFADO por quem abre, no momento em que abre. Se a tela
// recarregar por baixo (outro celular), o diálogo continua falando da etapa que a pessoa leu: um
// segundo "Desfazer" manda a mesma etapa e o servidor recusa ("já tinha sido desfeita"), em vez de
// desfazer em silêncio uma etapa que ninguém confirmou.
export type AlvoDoDesfazer = { etapa: EtapaProducao; feitaEmDiaMes: string };

export type ConfirmarDesfazerProps = {
  ordemId: string;
  tipo: TipoOrdem;
  alvo: AlvoDoDesfazer | null;
  aberto: boolean;
  aoFechar: () => void;
};

// "Desfazer a última" (UI-D4, UI-SPEC §Confirmações): `AlertDialog` que diz a data que se perde —
// desfazer apaga o dia REAL em que a etapa foi marcada, e marcar de novo grava o de hoje. O botão de
// confirmar não fecha antes da resposta do servidor (molde de `ConfirmarCancelarDocumento`); em voo
// "Desfazendo…", os dois botões desabilitados e `aria-busy`. Sucesso: toast "Desfeito: …" (a
// resposta da ação traz a página revalidada). Recusa ou falha: a frase dentro do diálogo, `role="alert"`, e a tela
// recarrega o estado.
export function ConfirmarDesfazer({
  ordemId,
  tipo,
  alvo,
  aberto,
  aoFechar,
}: ConfirmarDesfazerProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (!alvo || enviando) {
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await desfazerEtapa({ ordemId, etapaEsperada: alvo.etapa });
      if (resultado.ok) {
        // Sem `router.refresh()`: a ação já revalida esta página e a resposta dela traz a árvore
        // nova (revisão 06.1, WR-106; `.planning/debug/abertura-navegacao-trava.md`).
        toast.success(textoToastDesfeito(rotuloDaEtapa(resultado.dados.etapa, tipo)));
        aoFechar();
      } else {
        setErro(resultado.erro);
        // A recusa volta antes de qualquer `revalidatePath`: a recarga do estado é daqui.
        router.refresh();
      }
    } catch {
      setErro(FRASE_FALHA_AO_DESFAZER);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  const rotulo = alvo ? rotuloDaEtapa(alvo.etapa, tipo) : "";
  // O alvo fica guardado depois de fechar — o conteúdo não some no meio da animação de saída.

  return (
    <AlertDialog
      open={aberto && alvo !== null}
      onOpenChange={(novoValor) => {
        if (!novoValor && !enviando) {
          setErro(null);
          aoFechar();
        }
      }}
    >
      <AlertDialogContent data-testid="ordem-confirmar-desfazer" className="max-h-[85svh] overflow-y-auto">
        {alvo ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {tituloConfirmarDesfazer(rotulo)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {textoConfirmarDesfazer(rotulo, alvo.feitaEmDiaMes)}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {erro ? (
              <p data-testid="ordem-desfazer-erro" role="alert" className="text-apoio text-erro">
                {erro}
              </p>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={enviando}
                className="text-corpo min-h-[44px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR}
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid="ordem-confirmar-desfazer-sim"
                disabled={enviando}
                aria-busy={enviando ? "true" : undefined}
                onClick={confirmar}
                className="text-corpo min-h-[44px] px-4 font-semibold whitespace-normal"
              >
                {enviando ? ROTULO_DESFAZENDO : rotuloConfirmarDesfazer(rotulo)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
