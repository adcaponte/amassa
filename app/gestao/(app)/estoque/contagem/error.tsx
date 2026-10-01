"use client";

import { useEffect } from "react";

import { FRASE_ERRO_CARREGAR_CONTAGEM, ROTULO_TENTAR_DE_NOVO, TITULO_ERRO } from "@/lib/estoque/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/estoque/contagem` — mesmo padrão de `../error.tsx`: nada de `error`
// (mensagem, pilha, `digest`) vai para a tela, só para o console. A frase é a da UI-SPEC para
// "Carregar a contagem".
export default function ErroContagem({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, e não `reset` (revisão 06.1, WR-102): no Next 16.3.5 o `reset` só limpa o estado do
  // boundary e redesenha o MESMO payload do servidor, que ainda tem o erro; o `retry` faz
  // `router.refresh()` + `reset()` numa transição — busca de novo o que falhou no servidor
  // (`node_modules/next/dist/client/components/error-boundary.js`, `this.retry`).
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErro
      titulo={TITULO_ERRO}
      corpo={FRASE_ERRO_CARREGAR_CONTAGEM}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => retry()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}
