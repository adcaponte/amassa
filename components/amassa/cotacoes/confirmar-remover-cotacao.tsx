"use client";

import { useState } from "react";

import { removerCotacao } from "@/lib/cotacoes/acoes";
import type { Cotacao } from "@/lib/cotacoes/consultas";
import { fraseConfirmarRemoverCotacao } from "@/lib/cotacoes/textos";
import { useCotacaoRemoverId } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmarRemoverCotacaoProps = {
  // A lista de cotações da categoria ATIVA, já carregada por `page.tsx` — nunca uma segunda
  // consulta. UMA instância para a lista TODA, achando a cotação certa pelo identificador de
  // `?cotacaoRemover=<id>` dentro do array, mesmo molde de `ConfirmarRemoverCategoria`/
  // `ConfirmarRemoverItem` (custo O(1) no payload RSC de qualquer navegação, não O(N)).
  cotacoes: Cotacao[];
};

export function ConfirmarRemoverCotacao({ cotacoes }: ConfirmarRemoverCotacaoProps) {
  const cotacaoRemoverId = useCotacaoRemoverId();
  const cotacao = cotacoes.find((candidata) => candidata.id === cotacaoRemoverId) ?? null;
  const aberto = cotacao !== null;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fecha pelos DOIS caminhos, sempre juntos: zera o parâmetro da URL — nenhum dado local a
  // limpar aqui (ao contrário do formulário de edição), porque esta confirmação nunca guarda
  // cópia própria da cotação.
  function fechar() {
    setErro(null);
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("cotacaoRemover");
    const query = parametros.toString();
    irParaSemNavegar(`/abertura${query ? `?${query}` : ""}`);
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (!cotacao) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resposta = await removerCotacao(cotacao.id);

    setEnviando(false);

    if (!resposta.ok) {
      // Erro mostrado DENTRO do diálogo, sem fechá-lo.
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA (D-23), de volta para a MESMA categoria — a cotação some, a categoria
    // continua a mesma. Sem `toast` de sucesso: ele não sobrevive à navegação completa — a
    // própria lista já atualizada, sem a linha, é a confirmação mais forte que um aviso que some
    // em três segundos.
    window.location.assign(`/abertura?aba=cotacoes&categoria=${resposta.dados.categoriaId}`);
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
      <AlertDialogContent className="max-h-[85svh] overflow-y-auto">
        {cotacao && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {fraseConfirmarRemoverCotacao(cotacao.empresa)}
              </AlertDialogTitle>
            </AlertDialogHeader>

            {erro && (
              <p role="alert" className="text-apoio text-erro">
                {erro}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={enviando} onClick={confirmar}>
                {enviando ? "Excluindo…" : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
