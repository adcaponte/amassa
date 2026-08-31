"use client";

import Link from "next/link";

import { useAbridorAbertura } from "@/components/amassa/abertura/contexto-navegacao";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Button } from "@/components/ui/button";

// O botão do estado vazio da Abertura — o mesmo do `EstadoVazio` compartilhado por fora (link
// de verdade, com `href` compartilhável e alvo de 44px), mas que ABRE O DIÁLOGO LOCALMENTE no
// mesmo toque, além de navegar (ver o comentário do abridor em contexto-navegacao.tsx).
//
// Por que existe: este é o botão do PRIMEIRÍSSIMO item/tarefa — quem o toca não tem nenhuma
// outra forma de começar. Era o único caminho que ainda dependia só de a navegação confirmar, e
// foi o que voltou a falhar depois de as linhas e os diálogos já estarem consertados.
export function BotaoVazioAbertura({
  tipo,
  rotulo,
}: {
  tipo: "item" | "tarefa";
  rotulo: string;
}) {
  const abridor = useAbridorAbertura();
  const href = tipo === "item" ? "/abertura?item=novo" : "/abertura?aba=tarefas&tarefa=nova";

  return (
    <Button asChild variant="default" className="min-h-[44px]">
      <Link
        href={href}
        onClick={(evento) => {
          evento.preventDefault();
          irParaSemNavegar(href);
          if (tipo === "item") abridor.abrirItem("novo");
          else abridor.abrirTarefa("nova");
        }}
      >
        {rotulo}
      </Link>
    </Button>
  );
}
