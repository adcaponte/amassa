"use client";

import {
  CORPO_DESATIVAR_FORNECEDOR,
  ROTULO_DESATIVANDO,
  ROTULO_DESATIVAR_FORNECEDOR,
  ROTULO_VOLTAR,
  tituloDesativarFornecedor,
} from "@/lib/fornecedores/textos";
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

export type ConfirmarDesativarFornecedorProps = {
  aberto: boolean;
  nome: string;
  pendente: boolean;
  // A frase da ação quando ela falha — mostrada DENTRO do diálogo, que continua aberto.
  erro: string | null;
  aoConfirmar: () => void;
  aoVoltar: () => void;
};

// A confirmação de desativar um fornecedor (06.2-UI-SPEC.md §Confirmações → Desativar), no molde de
// `components/amassa/cadastros/confirmar-desativacao.tsx`: título "Desativar {nome}?" com quebra
// livre; o corpo diz o que some (a lista e o campo "Fornecedor" da Despesa) e o que FICA (anexos,
// observações, despesas ligadas). Desativar é reversível → o primário comum, nunca vermelho (UI-D20).
// "Voltar" é o primeiro na ordem de foco e recebe o foco inicial (o `AlertDialog` do Radix foca o
// Cancel). O rodapé é o `AlertDialogFooter` sem mudança: a 320 px os botões empilham. Enquanto a ação
// voa: "Desativando…", os dois botões desabilitados, e o diálogo só fecha com a resposta — quem fecha é
// quem chama, no `ok`.
export function ConfirmarDesativarFornecedor({
  aberto,
  nome,
  pendente,
  erro,
  aoConfirmar,
  aoVoltar,
}: ConfirmarDesativarFornecedorProps) {
  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!novoValor && !pendente) {
          aoVoltar();
        }
      }}
    >
      <AlertDialogContent data-testid="confirmar-desativar-fornecedor" className="max-h-[85svh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-titulo [overflow-wrap:anywhere]">
            {tituloDesativarFornecedor(nome)}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-corpo text-tinta">
            {CORPO_DESATIVAR_FORNECEDOR}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {erro ? (
          <p role="alert" data-testid="confirmar-desativar-fornecedor-erro" className="text-apoio text-erro">
            {erro}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pendente}
            onClick={aoVoltar}
            data-testid="confirmar-desativar-fornecedor-voltar"
            className="text-corpo min-h-[44px] px-4 font-semibold"
          >
            {ROTULO_VOLTAR}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pendente}
            aria-busy={pendente ? "true" : undefined}
            data-testid="confirmar-desativar-fornecedor-botao"
            onClick={(evento) => {
              // O Radix fecha o AlertDialog sozinho ao clicar em Action; quem fecha é quem chama,
              // depois da resposta do servidor.
              evento.preventDefault();
              if (!pendente) {
                aoConfirmar();
              }
            }}
            className="text-corpo min-h-[44px] px-4 font-semibold"
          >
            {pendente ? ROTULO_DESATIVANDO : ROTULO_DESATIVAR_FORNECEDOR}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
