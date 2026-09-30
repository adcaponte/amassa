"use client";

import { useEffect } from "react";

import {
  FRASE_ERRO_CARREGAR_CONCLUIDAS,
  ROTULO_TENTAR_DE_NOVO,
  TITULO_ERRO,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/producao/concluidas` — "use client" é exigência do App Router. Mesmo
// padrão de `app/gestao/(app)/producao/error.tsx`: nenhuma propriedade de `error` (mensagem, pilha,
// `digest`) é renderizada na tela, só sai no console. A frase é a da UI-SPEC para "Carregar
// Concluídas e canceladas".
export default function ErroConcluidas({
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
      corpo={FRASE_ERRO_CARREGAR_CONCLUIDAS}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => retry()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}
