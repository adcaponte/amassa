"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { sairDaTurma } from "@/lib/agenda/acoes";
import { nomeDoMes } from "@/lib/agenda/semana";
import {
  corpoConfirmarSairDaTurma,
  FRASE_FALHA_AO_SAIR_DA_TURMA,
  ROTULO_MANTER_NA_TURMA,
  ROTULO_TIRANDO_DA_TURMA,
  ROTULO_TIRAR_DA_TURMA,
  tituloConfirmarSairDaTurma,
  TOAST_SAIU_DA_TURMA,
} from "@/lib/agenda/textos";
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

import { CLASSES_BOTAO_DE_ERRO } from "./confirmar-cancelar-data";

const CLASSES_BOTAO_NEUTRO =
  "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

export type TurmaParaSair = {
  id: string;
  nome: string;
  aulasFuturas: number;
  mensalidadeDoMesAReceber: boolean;
};

export type ConfirmarSairDaTurmaProps = {
  // `null` = fechado.
  turma: TurmaParaSair | null;
  pessoa: { id: string; nome: string };
  // "AAAA-MM" — o mês da mensalidade que continua em "A receber".
  mes: string;
  // Fechou sem tirar ("Manter na turma", Esc, fora): a caixa continua marcada.
  aoFechar: () => void;
  aoTirar: () => void;
};

// "Sair da turma" (05-UI-SPEC.md §Confirmações; CLAUDE.md §Exclusão): desmarcar a caixa da turma na
// ficha abre esta confirmação, que diz antes o que sai — as aulas daqui para frente — e o que fica.
// Título com quebra livre (nome de 160 + turma de 120 a 320px — E28), os botões empilham pelo próprio
// rodapé do AlertDialog. Em voo, "Tirando…" e os dois botões desabilitados. O erro do servidor aparece
// DENTRO do diálogo, que continua aberto; ao fechar depois de um erro, a ficha pede ao servidor o
// estado de agora.
export function ConfirmarSairDaTurma({
  turma,
  pessoa,
  mes,
  aoFechar,
  aoTirar,
}: ConfirmarSairDaTurmaProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (emVoo.current || turma === null) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await sairDaTurma({ turmaId: turma.id, clienteId: pessoa.id });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      toast.success(TOAST_SAIU_DA_TURMA);
      aoTirar();
    } catch {
      setErro(FRASE_FALHA_AO_SAIR_DA_TURMA);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <AlertDialog
      open={turma !== null}
      onOpenChange={(aberto) => {
        if (!aberto && !enviando) {
          if (erro !== null) {
            router.refresh();
          }
          setErro(null);
          aoFechar();
        }
      }}
    >
      {turma !== null ? (
        <AlertDialogContent
          data-testid="confirmar-sair"
          className="max-h-[85svh] overflow-y-auto"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {tituloConfirmarSairDaTurma(pessoa.nome, turma.nome)}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="confirmar-sair-corpo">
              {corpoConfirmarSairDaTurma(
                turma.aulasFuturas,
                nomeDoMes(mes),
                turma.mensalidadeDoMesAReceber,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p
              data-testid="confirmar-sair-erro"
              role="alert"
              className="text-apoio text-erro"
            >
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-sair-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_NA_TURMA}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-sair-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO_DE_ERRO}
            >
              {enviando ? ROTULO_TIRANDO_DA_TURMA : ROTULO_TIRAR_DA_TURMA}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
