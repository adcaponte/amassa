"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { apagarFicha } from "@/lib/precificacao/acoes";
import {
  CORPO_CONFIRMAR_APAGAR_PECA,
  ROTULO_APAGAR_PECA,
  tituloConfirmarApagarPeca,
} from "@/lib/precificacao/textos";
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

export type ConfirmarApagarPecaProps = {
  id: string;
  nome: string;
};

// Montado POR LINHA da Lista de Peças (mesmo padrão já usado em Abertura para não promover a
// lista inteira a Client Component) — cada instância lê o PRÓPRIO `?apagarPeca=` e só abre quando
// o id bate com o seu. O gatilho de verdade é o botão "Apagar" dentro de `DialogoFicha` (modo de
// edição), que só navega para esta URL; esta instância nunca precisa saber de onde veio o clique.
//
// D-20: nunca mostra uma contagem lida antes — o texto de recusa ("Esta peça está em N
// orçamento(s)...") só existe se `apagarFicha` devolver `ok:false`, e é sempre a frase que o
// SERVIDOR montou, nunca um número pré-carregado pela lista (T-04.5-24).
export function ConfirmarApagarPeca({ id, nome }: ConfirmarApagarPecaProps) {
  const searchParams = useSearchParams();
  const aberto = searchParams.get("apagarPeca") === id;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    window.location.assign("/financeiro?aba=pecas");
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    // Radix fecha o AlertDialog sozinho ao clicar em Action, a menos que `preventDefault()` seja
    // chamado — é isso que impede o diálogo de fechar antes da resposta do servidor.
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await apagarFicha({ id });

    setEnviando(false);

    if (!resposta.ok) {
      // Erro mostrado DENTRO do diálogo, que continua aberto — o gestor vê que nada foi apagado.
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA — nunca a atualização client-side do roteador do Next — a lista precisa
    // refletir o que só o servidor sabe agora (a linha some).
    window.location.assign("/financeiro?aba=pecas");
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!enviando && !novoValor) {
          fechar();
        }
      }}
    >
      <AlertDialogContent data-testid="dialogo-apagar-peca" className="max-h-[85svh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">
            {tituloConfirmarApagarPeca(nome)}
          </AlertDialogTitle>
          <AlertDialogDescription>{CORPO_CONFIRMAR_APAGAR_PECA}</AlertDialogDescription>
        </AlertDialogHeader>

        {erro && (
          <p role="alert" className="text-apoio text-erro">
            {erro}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={enviando} onClick={confirmar}>
            {enviando ? "Apagando…" : ROTULO_APAGAR_PECA}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
