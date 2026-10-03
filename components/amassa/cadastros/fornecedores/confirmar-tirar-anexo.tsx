"use client";

import type { EfeitoDeTirar } from "@/lib/fornecedores/tabela-vigente";
import {
  COMPLEMENTO_TIRAR_UNICA,
  ROTULO_TIRANDO,
  ROTULO_TIRAR_ANEXO,
  ROTULO_VOLTAR,
  complementoTirarVigente,
  corpoTirarAnexo,
  tituloTirarAnexo,
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

export type AnexoParaTirar = {
  nome: string;
  extensao: string;
  // Já formatado por `textoDoTamanho` ("1,2 MB").
  tamanho: string;
  efeito: EfeitoDeTirar;
};

export type ConfirmarTirarAnexoProps = {
  aberto: boolean;
  // O anexo continua aqui enquanto o diálogo fecha (a animação de saída não mostra um diálogo vazio).
  anexo: AnexoParaTirar | null;
  pendente: boolean;
  // A frase da ação quando ela falha — mostrada DENTRO do diálogo, que continua aberto.
  erro: string | null;
  aoConfirmar: () => void;
  aoVoltar: () => void;
};

// O corpo diz o que se perde, e o que muda na linha "Última tabela de preços" (`efeitoDeTirar`).
function corpoDaConfirmacao(anexo: AnexoParaTirar): string {
  const base = corpoTirarAnexo(anexo.extensao, anexo.tamanho);
  if (anexo.efeito.caso === "vigente-com-anterior") {
    return base + complementoTirarVigente(anexo.efeito.anterior);
  }
  if (anexo.efeito.caso === "unica-tabela") {
    return base + COMPLEMENTO_TIRAR_UNICA;
  }
  return base;
}

// A confirmação de tirar um anexo (06.2-UI-SPEC.md §Confirmações → Tirar anexo) — a ÚNICA remoção do
// módulo, no molde de `confirmar-desativar-fornecedor.tsx`: título 'Tirar “{nome}”?' com quebra livre;
// o corpo diz o tipo e o tamanho do arquivo, que ele sai do servidor sem volta e, quando é a tabela
// vigente, qual passa a valer (ou que a ficha fica sem tabela). "Voltar" é o primeiro na ordem de foco e
// recebe o foco inicial (o `AlertDialog` do Radix foca o Cancel). "Tirar anexo" é `outline` de erro —
// tirar não volta (UI-D20). Enquanto a ação voa: "Tirando…", os dois botões desabilitados, e o diálogo
// só fecha com a resposta — quem fecha é quem chama.
export function ConfirmarTirarAnexo({
  aberto,
  anexo,
  pendente,
  erro,
  aoConfirmar,
  aoVoltar,
}: ConfirmarTirarAnexoProps) {
  return (
    <AlertDialog
      open={aberto && anexo !== null}
      onOpenChange={(novoValor) => {
        if (!novoValor && !pendente) {
          aoVoltar();
        }
      }}
    >
      <AlertDialogContent data-testid="confirmar-tirar-anexo" className="max-h-[85svh] overflow-y-auto">
        {anexo !== null ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-titulo [overflow-wrap:anywhere]">
                {tituloTirarAnexo(anexo.nome)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-corpo text-tinta" data-testid="confirmar-tirar-anexo-corpo">
                {corpoDaConfirmacao(anexo)}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {erro ? (
              <p role="alert" data-testid="confirmar-tirar-anexo-erro" className="text-apoio text-erro">
                {erro}
              </p>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={pendente}
                onClick={aoVoltar}
                data-testid="confirmar-tirar-anexo-voltar"
                className="text-corpo min-h-[44px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pendente}
                aria-busy={pendente ? "true" : undefined}
                data-testid="confirmar-tirar-anexo-botao"
                onClick={(evento) => {
                  // O Radix fecha o AlertDialog sozinho ao clicar em Action; quem fecha é quem chama,
                  // depois da resposta do servidor.
                  evento.preventDefault();
                  if (!pendente) {
                    aoConfirmar();
                  }
                }}
                variant="outline"
                className="border-erro text-erro hover:bg-erro-fundo hover:text-erro text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal"
              >
                {pendente ? ROTULO_TIRANDO : ROTULO_TIRAR_ANEXO}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
