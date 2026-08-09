"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { FRASE_ERRO_CORPO, FRASE_ERRO_TITULO } from "@/lib/encomendas/textos";

// Boundary de erro do detalhe — DOIS botões lado a lado (03-UI-SPEC.md "Estados de Carregamento
// e Erro", linha "Detalhe"): "Tentar de novo" e "Voltar para Encomendas". O segundo existe
// porque a encomenda pode ter sido excluída por outra pessoa nesse meio-tempo — sem ele, a
// pessoa fica presa apertando "Tentar de novo" numa página que nunca vai carregar. Mesmo padrão
// de `app/(app)/encomendas/error.tsx`: nenhuma propriedade de `error` renderizada na tela.
export default function ErroDetalheDaEncomenda({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErro
      titulo={FRASE_ERRO_TITULO}
      corpo={FRASE_ERRO_CORPO}
      acao={
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" variant="default" onClick={() => reset()}>
            Tentar de novo
          </Button>
          <Button asChild variant="outline">
            <Link href="/encomendas">Voltar para Encomendas</Link>
          </Button>
        </div>
      }
    />
  );
}
