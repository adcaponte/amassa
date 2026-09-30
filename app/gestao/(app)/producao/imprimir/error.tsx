"use client";

import { useEffect } from "react";

import { FRASE_ERRO_MONTAR_FOLHA, ROTULO_TENTAR_DE_NOVO, TITULO_ERRO } from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro da folha geral A4 — nenhuma propriedade de `error` chega à tela, só ao
// console. Sem ordem nenhuma também não: a página mostra o estado vazio.
export default function ErroFolhaGeral({
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
      corpo={FRASE_ERRO_MONTAR_FOLHA}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => retry()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}
