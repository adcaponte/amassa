"use client";

import { useRouter } from "next/navigation";

import { ROTULO_TENTAR_DE_NOVO } from "@/lib/inicio/textos";
import { Button } from "@/components/ui/button";

// Botão "Tentar de novo" de um bloco falho (D-09). Comentário honesto obrigatório sobre o
// alcance real da chamada de atualização abaixo: ela reexecuta a árvore de Server Components
// INTEIRA desta rota, não só o bloco que falhou — hoje não existe, no projeto, um caminho para
// reexecutar um
// Server Component isolado sem transformar o bloco inteiro num Client Component com a própria
// leitura (o caminho literal seria uma Server Action de leitura por bloco, com
// `exigirUsuario()` na primeira linha; não tomado agora porque dobraria o caminho de
// renderização de cada bloco para um ganho que quem está no ateliê, de pé, não distingue).
//
// O que D-09 pede e o que isto entrega é o comportamento VISÍVEL: este botão vive DENTRO do
// bloco que falhou (via `EstadoErro`/`acao`), o resto da página continua na tela enquanto a
// árvore volta, e nenhum outro bloco perde o conteúdo — mesmo a implementação reexecutando tudo
// por baixo.
export function TentarDeNovo() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-[44px]"
      onClick={() => router.refresh()}
    >
      {ROTULO_TENTAR_DE_NOVO}
    </Button>
  );
}
