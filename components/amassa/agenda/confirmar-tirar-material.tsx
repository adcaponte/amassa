"use client";

import { useRef, useState } from "react";

import { tirarMaterial } from "@/lib/agenda/acoes";
import {
  CORPO_CONFIRMAR_TIRAR_MATERIAL,
  FRASE_FALHA_AO_TIRAR_MATERIAL,
  ROTULO_MANTER_O_MATERIAL,
  ROTULO_TIRANDO_MATERIAL,
  ROTULO_TIRAR_MATERIAL,
  ROTULO_TIRAR_O_MATERIAL,
  ariaTirarMaterial,
  tituloConfirmarTirarMaterial,
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

export type ConfirmarTirarMaterialProps = {
  materialId: string;
  nome: string;
  desabilitado?: boolean;
  // O diálogo fechado depois de uma recusa (o uso foi encerrado em outro celular): a folha relê o servidor.
  aoFecharDepoisDaRecusa: () => void;
};

// "tirar" de uma linha do "Material usado" (05-UI-SPEC.md §Confirmações "Tirar material", UI-D13): o link
// de 44px (`tinta-media`, sublinhado, `aria-label` com o nome) abre a confirmação que diz o que se perde —
// "Ainda não saiu do estoque — some só desta lista." — com "Manter o material" · "Tirar o material"
// (`outline` de erro). Em voo, "Tirando…" e os dois botões desabilitados. Recusa ou falha: a frase DENTRO
// do diálogo (`role="alert"`). Só existe antes de encerrar: a linha baixada nunca se tira (AGE-20).
export function ConfirmarTirarMaterial({
  materialId,
  nome,
  desabilitado = false,
  aoFecharDepoisDaRecusa,
}: ConfirmarTirarMaterialProps) {
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
      const resposta = await tirarMaterial({ materialId });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      // A ação revalidou a Agenda: a linha sai da lista na resposta.
      setAberto(false);
    } catch {
      setErro(FRASE_FALHA_AO_TIRAR_MATERIAL);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="tirar-material"
        aria-label={ariaTirarMaterial(nome)}
        disabled={desabilitado}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        className="text-apoio text-tinta-media hover:text-tinta inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md px-2 underline underline-offset-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        {ROTULO_TIRAR_MATERIAL}
      </button>

      <AlertDialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !enviando) {
            const houveRecusa = erro !== null;
            setErro(null);
            setAberto(false);
            if (houveRecusa) {
              aoFecharDepoisDaRecusa();
            }
          }
        }}
      >
        <AlertDialogContent data-testid="confirmar-tirar-material" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">{tituloConfirmarTirarMaterial(nome)}</AlertDialogTitle>
            <AlertDialogDescription>{CORPO_CONFIRMAR_TIRAR_MATERIAL}</AlertDialogDescription>
          </AlertDialogHeader>

          {erro ? (
            <p data-testid="confirmar-tirar-material-erro" role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-tirar-material-nao"
              disabled={enviando}
              className={CLASSES_BOTAO_NEUTRO}
            >
              {ROTULO_MANTER_O_MATERIAL}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              data-testid="confirmar-tirar-material-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO_DE_ERRO}
            >
              {enviando ? ROTULO_TIRANDO_MATERIAL : ROTULO_TIRAR_O_MATERIAL}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
