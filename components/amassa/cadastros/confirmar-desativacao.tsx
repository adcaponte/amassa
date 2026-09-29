"use client";

import Link from "next/link";

import {
  ROTULO_ABRIR_CATALOGO,
  ROTULO_DESATIVANDO,
  ROTULO_VOLTAR,
  corpoDaDesativacao,
  rotuloConfirmarDesativacao,
  tituloDaDesativacao,
  type SubstantivoDaDesativacao,
} from "@/lib/cadastros/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
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

export type ConfirmarDesativacaoProps = {
  aberto: boolean;
  // "item" no Cadastros → Catálogo, "material" no Estoque (plano 06-09) — só o botão muda.
  substantivo: SubstantivoDaDesativacao;
  nome: string;
  movimentacoes: number;
  // "1,5 kg", já formatado por quem chama; `null` quando não há movimentação.
  saldoTexto: string | null;
  pendente: boolean;
  // A frase da ação quando ela recusa (insumo de ficha ativa) — mostrada DENTRO do diálogo.
  erro: string | null;
  aoConfirmar: () => void;
  aoVoltar: () => void;
};

// A confirmação de desativar — a única desta fase (06-UI-SPEC.md §Confirmação). Um componente só,
// partilhado pelo Cadastros e pelo Estoque: título "Desativar {nome}?", o corpo diz o que continua
// guardado e que nada é apagado. Desativar é reversível, então o botão é o primário comum, nunca
// vermelho. Enquanto a ação voa: "Desativando…", os dois botões desabilitados, e o diálogo não
// fecha até a resposta (mesmo molde de `ConfirmarCancelar`, components/amassa/encomendas).
export function ConfirmarDesativacao({
  aberto,
  substantivo,
  nome,
  movimentacoes,
  saldoTexto,
  pendente,
  erro,
  aoConfirmar,
  aoVoltar,
}: ConfirmarDesativacaoProps) {
  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!novoValor && !pendente) {
          aoVoltar();
        }
      }}
    >
      <AlertDialogContent data-testid="confirmar-desativacao" className="max-h-[85svh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-titulo [overflow-wrap:anywhere]">
            {tituloDaDesativacao(nome)}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-corpo text-tinta">
            {corpoDaDesativacao(movimentacoes, saldoTexto)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {erro && (
          <div role="alert" className="text-apoio text-erro flex flex-col gap-1">
            <p>{erro}</p>
            {substantivo === "material" && (
              <Link
                href={rotaDeGestao("/cadastros?sub=catalogo")}
                className="text-apoio text-tinta flex min-h-[44px] items-center font-medium underline underline-offset-3"
              >
                {ROTULO_ABRIR_CATALOGO}
              </Link>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pendente}
            onClick={aoVoltar}
            className="text-corpo min-h-[44px] px-4"
          >
            {ROTULO_VOLTAR}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pendente}
            aria-busy={pendente ? "true" : undefined}
            data-testid="confirmar-desativacao-botao"
            onClick={(evento) => {
              // Radix fecha o AlertDialog sozinho ao clicar em Action; quem fecha é quem chama,
              // depois da resposta do servidor.
              evento.preventDefault();
              if (!pendente) {
                aoConfirmar();
              }
            }}
            className="text-corpo min-h-[44px] px-4"
          >
            {pendente ? ROTULO_DESATIVANDO : rotuloConfirmarDesativacao(substantivo)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
