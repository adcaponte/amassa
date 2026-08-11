"use client";

import "./globals.css";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import {
  FRASE_ERRO_CORPO_GENERICO,
  FRASE_ERRO_TITULO,
  ROTULO_TENTAR_DE_NOVO,
} from "@/lib/erro/textos";

// Último recurso — três fatos que quem mexer aqui depois não deve redescobrir do zero:
//
// (1) Só dispara para erro do LAYOUT RAIZ (app/layout.tsx) ou quando `app/error.tsx` falha ao
//     renderizar — uma fronteira de erro nunca captura um erro lançado por ela mesma. Sem este
//     arquivo, essa segunda situação faria o usuário voltar a ver a tela padrão do Next.js,
//     exatamente o desfecho que G-04-5 (WINDOWS.md id 23) descreve.
// (2) O Next.js NÃO usa este arquivo em `next dev` — a sobreposição de erro do modo de
//     desenvolvimento toma o lugar dele. Não é observável localmente; a prova aqui é
//     estrutural (existe, renderiza <html>/<body> próprios, importa globals.css), não
//     comportamental. Registrado assim no SUMMARY do plano que criou este arquivo, não
//     escondido.
// (3) Este arquivo SUBSTITUI o layout raiz inteiro, então tem que renderizar o próprio
//     `<html>`/`<body>`. As classes `.variable` do `next/font/google` (que definem
//     --fonte-inter/--fonte-archivo) moram no `<html>` de `app/layout.tsx`, que este arquivo
//     substitui — elas ficam indefinidas aqui, `--font-sans` cai no fallback `ui-sans-serif` de
//     `app/globals.css:76`. Degradação de fonte conhecida e aceita para uma tela de último
//     recurso: melhor uma fonte do sistema do que a tela em branco do Next.js.
export default function ErroGlobal({
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
    <html lang="pt-BR">
      <body className="font-sans antialiased">
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
      </body>
    </html>
  );
}
