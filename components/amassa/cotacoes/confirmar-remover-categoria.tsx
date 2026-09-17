"use client";

import { useState } from "react";

import { removerCategoriaDeCotacao } from "@/lib/cotacoes/acoes";
import type { CategoriaDeCotacao } from "@/lib/cotacoes/consultas";
import { fraseConfirmarRemoverCategoria } from "@/lib/cotacoes/textos";
import { useCategoriaRemoverId } from "@/components/amassa/cotacoes/contexto-cotacoes";
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

export type ConfirmarRemoverCategoriaProps = {
  // A lista INTEIRA de categorias e o MESMO mapa de contagem calculado uma vez em `page.tsx`
  // (Tarefa 1) — nunca uma segunda consulta. UMA instância para a aba TODA, achando a categoria
  // certa pelo identificador de `?categoriaRemover=<id>` dentro do array já carregado, no mesmo
  // molde de `ConfirmarRemoverItem` (custo O(1) no payload RSC de qualquer navegação, não O(N)).
  categorias: CategoriaDeCotacao[];
  contagemPorCategoria: Map<string, number>;
};

export function ConfirmarRemoverCategoria({
  categorias,
  contagemPorCategoria,
}: ConfirmarRemoverCategoriaProps) {
  const categoriaRemoverId = useCategoriaRemoverId();
  const categoria = categorias.find((candidata) => candidata.id === categoriaRemoverId) ?? null;
  const aberto = categoria !== null;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fecha pelos DOIS caminhos, sempre juntos: zera o parâmetro local E devolve a URL — só um dos
  // dois deixaria o diálogo preso aberto quando a navegação de abertura não confirmasse (mesmo
  // cuidado de `ConfirmarRemoverItem`).
  function fechar() {
    setErro(null);
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("categoriaRemover");
    const query = parametros.toString();
    irParaSemNavegar(`/abertura${query ? `?${query}` : ""}`);
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (!categoria) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resposta = await removerCategoriaDeCotacao(categoria.id);

    setEnviando(false);

    if (!resposta.ok) {
      // Erro mostrado DENTRO do diálogo, sem fechá-lo.
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA (D-23), para a aba Cotações SEM `&categoria=` — a categoria removida
    // não pode continuar sendo a "ativa", e só o servidor sabe qual sobrou (a primeira por ordem
    // de criação, via `resolverCategoriaAtiva` em `page.tsx`) ou se não sobrou nenhuma (o
    // comparador volta ao estado vazio de zero categorias). Sem `toast` de sucesso: ele não
    // sobrevive à navegação completa — a própria lista já atualizada é a confirmação.
    window.location.assign("/abertura?aba=cotacoes");
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
        {categoria && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {fraseConfirmarRemoverCategoria(
                  categoria.nome,
                  contagemPorCategoria.get(categoria.id) ?? 0,
                )}
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
