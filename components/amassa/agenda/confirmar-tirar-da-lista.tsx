"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { tirarDaLista } from "@/lib/agenda/acoes";
import type { TipoInscricao } from "@/lib/agenda/tipos";
import {
  ariaTirarDaLista,
  COMPLEMENTO_TOAST_REPOSICAO_VOLTOU,
  CORPO_TIRAR_INSCRICAO_DA_LISTA,
  corpoTirarExperimentalGratuita,
  corpoTirarReposicao,
  FRASE_FALHA_AO_TIRAR_DA_LISTA,
  ROTULO_MANTER_NA_LISTA,
  ROTULO_TIRANDO_DA_LISTA,
  ROTULO_TIRAR_DA_LISTA,
  ROTULO_TIRAR_DA_LISTA_LINK,
  tituloConfirmarTirarDaLista,
  toastSaiuDaLista,
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

const CLASSES_BOTAO_NEUTRO = "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

export type ConfirmarTirarDaListaProps = {
  inscricaoId: string;
  nome: string;
  // O que a pessoa é nesta data — decide o que a confirmação diz que se perde.
  tipo: TipoInscricao;
  // A inscrição cobra (oficina, experimental cobrada): sair dela tira a cobrança de "A receber".
  cobrar: boolean;
  // As aulas a repor da pessoa agora: tirar a reposição devolve uma (o corpo diz com quantas fica).
  aRepor: number;
};

// O corpo da confirmação (05-UI-SPEC.md §Confirmações "Tirar da lista"): a inscrição de oficina e a
// experimental cobrada saem de "A receber"; a reposição volta a ser crédito; a experimental gratuita só
// sai da data.
function corpoDaConfirmacao({
  nome,
  tipo,
  cobrar,
  aRepor,
}: Pick<ConfirmarTirarDaListaProps, "nome" | "tipo" | "cobrar" | "aRepor">): string {
  if (tipo === "reposicao") {
    return corpoTirarReposicao(nome, aRepor + 1);
  }
  if (tipo === "experimental" && !cobrar) {
    return corpoTirarExperimentalGratuita(nome);
  }
  return CORPO_TIRAR_INSCRICAO_DA_LISTA;
}

// "tirar da lista" de uma inscrição de oficina ou experimental sem venda ativa, ou de uma reposição
// (05-UI-SPEC.md §Confirmações; UI-D13):
// um link-botão de 44px em `tinta-media` sublinhado — nunca terracota, o primário da folha é "Pronto"
// — que abre a confirmação dizendo o que se perde. Em voo, "Tirando…", os dois botões desabilitados.
//
// A recusa do servidor aparece DENTRO do diálogo (`role="alert"`), que continua aberto: com a tela
// velha, a inscrição pode já ter virado venda em outro celular, e a frase da D-08 diz que a devolução
// é no Caixa. Ao fechar depois de uma recusa, a folha pede ao servidor a lista de agora.
export function ConfirmarTirarDaLista({ inscricaoId, nome, tipo, cobrar, aRepor }: ConfirmarTirarDaListaProps) {
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
      const resposta = await tirarDaLista({ inscricaoId });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      toast.success(
        toastSaiuDaLista(resposta.dados.nome) +
          (resposta.dados.tipo === "reposicao" ? COMPLEMENTO_TOAST_REPOSICAO_VOLTOU : ""),
      );
      setAberto(false);
    } catch {
      setErro(FRASE_FALHA_AO_TIRAR_DA_LISTA);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="tirar-da-lista"
        aria-label={ariaTirarDaLista(nome)}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className="text-apoio text-tinta-media inline-flex min-h-[44px] items-center self-start rounded-md underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        {ROTULO_TIRAR_DA_LISTA_LINK}
      </button>

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
        <AlertDialogContent data-testid="confirmar-tirar-da-lista" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">{tituloConfirmarTirarDaLista(nome)}</AlertDialogTitle>
            <AlertDialogDescription data-testid="confirmar-tirar-da-lista-corpo" className="[overflow-wrap:anywhere]">
              {corpoDaConfirmacao({ nome, tipo, cobrar, aRepor })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p data-testid="confirmar-tirar-da-lista-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-tirar-da-lista-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_NA_LISTA}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-tirar-da-lista-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO_DE_ERRO}
            >
              {enviando ? ROTULO_TIRANDO_DA_LISTA : ROTULO_TIRAR_DA_LISTA}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
