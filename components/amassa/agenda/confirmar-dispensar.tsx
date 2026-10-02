"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { definirDispensa } from "@/lib/agenda/acoes";
import { esquemaDefinirDispensa } from "@/lib/agenda/esquemas";
import {
  ariaDispensar,
  FRASE_FALHA_AO_DESFAZER_DISPENSA_DO_TOAST,
  FRASE_FALHA_AO_DISPENSAR,
  PLACEHOLDER_MOTIVO_DISPENSA,
  ROTULO_DESFAZER,
  ROTULO_DISPENSANDO,
  ROTULO_DISPENSAR_A_COBRANCA,
  ROTULO_MOTIVO_DISPENSA,
  ROTULO_VOLTAR,
  TOAST_DISPENSA_DESFEITA,
  TOAST_DISPENSADA,
  corpoConfirmarDispensar,
  tituloConfirmarDispensar,
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
import { Input } from "@/components/ui/input";

import { CLASSE_DO_CAMPO_DA_AGENDA } from "./campos-turma";

const CLASSES_BOTAO =
  "text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal";

export type ConfirmarDispensarProps = {
  // O uso livre entra só com a venda cancelada (decisão do dono no chat, 02/10/2026; `podeDispensar`).
  tipo: "mensalidade" | "inscricao" | "uso_livre";
  id: string;
  nome: string;
  // A descrição D-04 da cobrança — o `aria-label` do link (várias linhas têm o mesmo texto visível).
  descricao: string;
};

// O “Desfazer” do toast da dispensa (decisão E29 — a UI-SPEC não fixa): manda `dispensada: false`
// (estado desejado — dois toques convergem) e só age no PRIMEIRO toque; o sonner fecha o toast ao tocar.
// Se falhar, a frase diz onde desfazer de novo: a sanfona “Dispensadas”.
export function avisarDispensada(cobranca: {
  tipo: "mensalidade" | "inscricao" | "uso_livre";
  id: string;
}): void {
  let desfeito = false;
  toast.success(TOAST_DISPENSADA, {
    action: {
      label: ROTULO_DESFAZER,
      onClick: () => {
        if (desfeito) {
          return;
        }
        desfeito = true;
        void (async () => {
          try {
            const resposta = await definirDispensa({ ...cobranca, dispensada: false });
            if (resposta.ok) {
              toast.success(TOAST_DISPENSA_DESFEITA);
            } else {
              toast.error(FRASE_FALHA_AO_DESFAZER_DISPENSA_DO_TOAST);
            }
          } catch {
            toast.error(FRASE_FALHA_AO_DESFAZER_DISPENSA_DO_TOAST);
          }
        })();
      },
    },
  });
}

// “Dispensar a cobrança” (D-09, UI-D15; 05-UI-SPEC.md §Confirmações “Dispensar”): o link-botão de 44px em
// `tinta-media`, sublinhado — à esquerda da fileira de ações da linha de “A receber” (UI-D3: o terracota da
// tela é só o lote) — abre a confirmação com o campo “Motivo (opcional)”. Não é remoção: nada se apaga, a
// cobrança sai de “A receber” com quem e quando, e se desfaz em “Dispensadas”.
//
// O motivo é conferido pelo MESMO esquema Zod do servidor antes de enviar (conveniência — o servidor
// confere de novo): com mais de 200 caracteres, a frase aparece embaixo do campo, o foco vai a ele e nada
// é gravado (backstop E17 long-text). Sem `maxLength` no campo, de propósito: cortar em silêncio esconderia
// o que a pessoa digitou. Em voo, “Dispensando…” com os dois botões `disabled`; o `useRef` barra o segundo
// toque antes de o React redesenhar. A falha fica DENTRO da confirmação, que continua aberta.
export function ConfirmarDispensar({
  tipo,
  id,
  nome,
  descricao,
}: ConfirmarDispensarProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erroDoMotivo, setErroDoMotivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (emVoo.current) {
      return;
    }
    setErro(null);
    const conferido = esquemaDefinirDispensa.shape.motivo.safeParse(motivo);
    if (!conferido.success) {
      setErroDoMotivo(conferido.error.issues[0]?.message ?? FRASE_FALHA_AO_DISPENSAR);
      campo.current?.focus();
      return;
    }
    setErroDoMotivo(null);

    emVoo.current = true;
    setEnviando(true);
    try {
      const resposta = await definirDispensa({ tipo, id, dispensada: true, motivo });
      if (!resposta.ok) {
        if (resposta.campos?.motivo) {
          setErroDoMotivo(resposta.campos.motivo);
          campo.current?.focus();
        } else {
          setErro(resposta.erro);
        }
        return;
      }
      setAberto(false);
      avisarDispensada({ tipo, id });
    } catch {
      setErro(FRASE_FALHA_AO_DISPENSAR);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  const idDoCampo = `motivo-dispensa-${id}`;
  const idDoErro = `motivo-dispensa-erro-${id}`;

  return (
    <>
      <button
        type="button"
        data-testid="dispensar"
        aria-label={ariaDispensar(descricao, nome)}
        onClick={() => {
          setErro(null);
          setErroDoMotivo(null);
          setMotivo("");
          setAberto(true);
        }}
        className="text-apoio text-tinta-media focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        {ROTULO_DISPENSAR_A_COBRANCA}
      </button>

      <AlertDialog
        open={aberto}
        onOpenChange={(novoValor) => {
          if (!novoValor && !enviando) {
            // Depois de uma recusa (a cobrança virou venda em outro celular), a lista é pedida de novo.
            if (erro !== null) {
              router.refresh();
            }
            setErro(null);
            setAberto(false);
          }
        }}
      >
        <AlertDialogContent
          data-testid="confirmar-dispensar"
          className="max-h-[85svh] overflow-y-auto"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {tituloConfirmarDispensar(tipo, nome)}
            </AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {corpoConfirmarDispensar(tipo)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={idDoCampo} className="text-apoio text-tinta font-semibold">
              {ROTULO_MOTIVO_DISPENSA}
            </label>
            <Input
              id={idDoCampo}
              ref={campo}
              type="text"
              data-testid="motivo-dispensa"
              autoComplete="off"
              placeholder={PLACEHOLDER_MOTIVO_DISPENSA}
              value={motivo}
              disabled={enviando}
              aria-invalid={erroDoMotivo !== null ? "true" : undefined}
              aria-describedby={erroDoMotivo !== null ? idDoErro : undefined}
              onChange={(evento) => {
                setMotivo(evento.target.value);
                setErroDoMotivo(null);
              }}
              className={CLASSE_DO_CAMPO_DA_AGENDA}
            />
            {erroDoMotivo !== null ? (
              <p
                id={idDoErro}
                role="alert"
                data-testid="motivo-dispensa-erro"
                className="text-apoio text-erro"
              >
                {erroDoMotivo}
              </p>
            ) : null}
          </div>

          {erro !== null ? (
            <p
              data-testid="confirmar-dispensar-erro"
              role="alert"
              className="text-apoio text-erro"
            >
              {erro}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="confirmar-dispensar-nao"
              disabled={enviando}
              className={CLASSES_BOTAO}
            >
              {ROTULO_VOLTAR}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirmar-dispensar-sim"
              disabled={enviando}
              aria-busy={enviando ? "true" : undefined}
              onClick={confirmar}
              className={CLASSES_BOTAO}
            >
              {enviando ? ROTULO_DISPENSANDO : ROTULO_DISPENSAR_A_COBRANCA}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
