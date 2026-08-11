"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreVertical } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { desativarForno, reativarForno } from "@/lib/queimas/acoes";
import {
  ROTULO_DESATIVAR_FORNO,
  ROTULO_REATIVAR_FORNO,
  fraseDesativarForno,
  rotuloMaisAcoes,
} from "@/lib/queimas/textos";

export type AcoesFornoProps = {
  id: string;
  nome: string;
  ativo: boolean;
};

// Menu "⋮ Mais ações" da página do forno (D-02/D-06, Tarefa 3 do plano 04-04) — botão só de
// ícone com `aria-label` exato `"Mais ações do forno {nome}"` (04-UI-SPEC.md §"Icon-only
// controls") e alvo de no mínimo 44px (`size-11`). "Editar forno" abre `FormularioForno` em modo
// de edição (`?editar`, tratado por aquele componente); "Desativar forno" **ou** "Reativar
// forno" aparece conforme `ativo` — NUNCA os dois ao mesmo tempo. Cada item chama a Server Action
// de dentro de um botão real (`onSelect` deste `DropdownMenuItem`), nunca `asChild` sobre um
// `<form>` aninhado (achado do 02b-02: o alvo do `asChild` não submete formulário dentro dele).
export function AcoesForno({ id, nome, ativo }: AcoesFornoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirmarDesativarAberto, setConfirmarDesativarAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirEdicao() {
    const parametros = new URLSearchParams(searchParams.toString());
    parametros.set("editar", "");
    router.push(`?${parametros.toString()}`);
  }

  async function confirmarDesativar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const resposta = await desativarForno(id);

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    toast.success("Forno desativado.");
    setConfirmarDesativarAberto(false);
    router.refresh();
  }

  // D-06: reativar é direto — desativar por engano é fácil e o conserto tem que ser óbvio, sem
  // uma segunda confirmação no caminho de volta.
  async function reativar() {
    const resposta = await reativarForno(id);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    toast.success("Forno reativado.");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={rotuloMaisAcoes(nome)}
            className="flex size-11 items-center justify-center p-0"
            data-testid={`acoes-forno-${id}`}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={abrirEdicao} data-testid="editar-forno">
            Editar forno
          </DropdownMenuItem>
          {ativo ? (
            <DropdownMenuItem
              onSelect={() => setConfirmarDesativarAberto(true)}
              data-testid="desativar-forno"
            >
              {ROTULO_DESATIVAR_FORNO}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void reativar()} data-testid="reativar-forno">
              {ROTULO_REATIVAR_FORNO}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reversível, não é exclusão (D-06) — sem `variant="destructive"`, ao contrário de
          `ConfirmarExcluirQueima`. Confirmação LEVE só para desativar; reativar não tem esta. */}
      <AlertDialog
        open={confirmarDesativarAberto}
        onOpenChange={(novoValor) => {
          if (!enviando) {
            setConfirmarDesativarAberto(novoValor);
            if (novoValor) {
              setErro(null);
            }
          }
        }}
      >
        <AlertDialogContent className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {ROTULO_DESATIVAR_FORNO}?
            </AlertDialogTitle>
            <AlertDialogDescription className="[overflow-wrap:anywhere]">
              {fraseDesativarForno(nome)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {erro && (
            <p role="alert" className="text-apoio text-erro">
              {erro}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="secondary"
              disabled={enviando}
              onClick={confirmarDesativar}
            >
              {enviando ? "Desativando…" : ROTULO_DESATIVAR_FORNO}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
