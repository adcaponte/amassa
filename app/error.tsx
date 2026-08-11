"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import {
  FRASE_ERRO_CORPO_GENERICO,
  FRASE_ERRO_TITULO,
  ROTULO_TENTAR_DE_NOVO,
} from "@/lib/erro/textos";

// Fronteira de erro do LAYOUT RAIZ (gap G-04-5, WINDOWS.md id 23) — não confundir com
// `app/(app)/error.tsx`, que é irmão do layout de `(app)` e por isso NUNCA captura um erro
// lançado pelo próprio layout de `(app)`. `app/(app)/` é um grupo de rotas, sem segmento de
// URL próprio: `app/(app)/layout.tsx` renderiza como filho direto de `app/layout.tsx` — logo
// este arquivo, que envolve os children do layout raiz, é a fronteira mais próxima ACIMA dele
// e é quem captura o `throw` de `exigirUsuario()` (app/(app)/layout.tsx:15) quando o banco está
// fora do ar. Antes deste arquivo existir, esse `throw` subia até a tela padrão do Next.js
// ("Application error: a server-side exception has occurred") — exatamente o que G-04-5 mediu.
//
// Renderiza DENTRO do layout raiz (`app/layout.tsx`), então `<html lang="pt-BR">`,
// `app/globals.css` e as variáveis de fonte Archivo Narrow / Inter continuam valendo — a tela
// parece o resto do AMASSA. Funciona em `next dev` e em produção, ao contrário de
// `app/global-error.tsx` (ver o comentário daquele arquivo).
//
// Vive FORA do grupo protegido — nunca pode renderizar dado de sessão, mesma restrição já
// documentada em `app/not-found.tsx` (T-02b-01). Só copy estática e o `reset()` que o Next.js
// injeta.
export default function ErroRaiz({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nenhuma propriedade do erro (mensagem, pilha, digest) vai para a tela — só para o
    // console, para quem estiver com as ferramentas de desenvolvedor abertas.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      <EstadoErro
        titulo={FRASE_ERRO_TITULO}
        corpo={FRASE_ERRO_CORPO_GENERICO}
        acao={
          <Button
            type="button"
            variant="default"
            className="min-h-[44px]"
            onClick={() => reset()}
          >
            {ROTULO_TENTAR_DE_NOVO}
          </Button>
        }
      />
    </div>
  );
}
