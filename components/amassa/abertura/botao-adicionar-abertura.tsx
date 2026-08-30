"use client";

import { memo } from "react";
import Link from "next/link";

import { ROTULO_NOVA_TAREFA, ROTULO_NOVO_ITEM } from "@/lib/abertura/textos";
import { useAbaAtual } from "@/components/amassa/abertura/contexto-navegacao";
import { Button } from "@/components/ui/button";

export type AbaAbertura = "itens" | "tarefas" | "meses";

// Casca fininha: só lê `?aba=` e repassa como prop primitiva (mesmo molde de
// `abas-abertura.tsx` — ver .planning/debug/abertura-navegacao-trava.md). Vive em
// `app/(app)/abertura/layout.tsx` (não em `page.tsx`) precisamente para NÃO fazer parte do patch
// de toda navegação `?item=`/`?tarefa=` — layouts do Next não são re-executados quando só a
// query muda, mas o botão continua reativo a `?aba=` porque `useSearchParams()` (dentro de
// `ProvedorNavegacaoAbertura`) é sempre client-side, independente de qual segmento do servidor
// disparou a navegação.
export function BotaoAdicionarAbertura() {
  const aba = useAbaAtual();
  return <BotaoAdicionarAberturaConteudo aba={aba} />;
}

function BotaoAdicionarAberturaConteudoBase({ aba }: { aba: string | null }) {
  const abaTarefas = aba === "tarefas";
  const abaMeses = aba === "meses";

  // A aba "Por mês" não tem ação de "adicionar" própria — um mês nasce de cadastrar um item na
  // aba Itens, não de um botão nesta tela.
  if (abaMeses) {
    return null;
  }

  return (
    <Button asChild variant="default" className="min-h-[44px]">
      <Link href={abaTarefas ? "/abertura?aba=tarefas&tarefa=nova" : "/abertura?item=novo"}>
        {abaTarefas ? ROTULO_NOVA_TAREFA : ROTULO_NOVO_ITEM}
      </Link>
    </Button>
  );
}

function propsIguais(anterior: { aba: string | null }, atual: { aba: string | null }): boolean {
  return anterior.aba === atual.aba;
}

const BotaoAdicionarAberturaConteudo = memo(BotaoAdicionarAberturaConteudoBase, propsIguais);
