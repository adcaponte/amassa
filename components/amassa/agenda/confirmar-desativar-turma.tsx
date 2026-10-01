"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { desativarTurma } from "@/lib/agenda/acoes";
import type { PerdasAoDesativar } from "@/lib/agenda/consultas";
import {
  corpoConfirmarDesativarTurma,
  FRASE_FALHA_AO_DESATIVAR_TURMA,
  ROTULO_DESATIVANDO,
  ROTULO_DESATIVAR_TURMA,
  ROTULO_MANTER_TURMA,
  tituloConfirmarDesativarTurma,
  TOAST_TURMA_DESATIVADA,
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
import { Button } from "@/components/ui/button";

import { CLASSES_BOTAO_DE_ERRO } from "./confirmar-cancelar-data";

const CLASSES_BOTAO_NEUTRO = "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

export type ConfirmarDesativarTurmaProps = {
  turmaId: string;
  nome: string;
  // O que sai, lido quando a folha abriu (a regra de exclusão: dizer antes o que se perde).
  perdas: PerdasAoDesativar;
  aoDesativar: () => void;
};

// "Desativar turma" (D-03; 05-UI-SPEC.md §Confirmações): o botão `outline` de erro no fim da folha
// da turma e a confirmação com quantas datas e reposições saem. A turma nunca se apaga — só deixa de
// valer daqui para frente.
//
// Decisão do backstop E28·error (plano 06): o erro do servidor (a venda ativa, a rede) aparece DENTRO
// do diálogo, que continua aberto, e nada muda na turma. Ao fechar depois de um erro, a folha pede
// ao servidor a turma de agora.
export function ConfirmarDesativarTurma({ turmaId, nome, perdas, aoDesativar }: ConfirmarDesativarTurmaProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await desativarTurma({ turmaId });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      toast.success(TOAST_TURMA_DESATIVADA);
      setAberto(false);
      aoDesativar();
    } catch {
      setErro(FRASE_FALHA_AO_DESATIVAR_TURMA);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="desativar-turma"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className={`${CLASSES_BOTAO_DE_ERRO} mt-2 self-start`}
      >
        {ROTULO_DESATIVAR_TURMA}
      </Button>

      <AlertDialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !enviando) {
            if (erro !== null) {
              router.refresh();
            }
            setErro(null);
            setAberto(false);
          }
        }}
      >
        <AlertDialogContent data-testid="confirmar-desativar-turma" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">{tituloConfirmarDesativarTurma(nome)}</AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {corpoConfirmarDesativarTurma(perdas.datas, perdas.reposicoes)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p data-testid="confirmar-desativar-turma-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-desativar-turma-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_TURMA}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-desativar-turma-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO_DE_ERRO}
            >
              {enviando ? ROTULO_DESATIVANDO : ROTULO_DESATIVAR_TURMA}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
