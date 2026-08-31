"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

import type { TarefaDaAbertura } from "@/lib/abertura/consultas";
import { urgenciaDaTarefa } from "@/lib/abertura/prazos";
import { textoDaUrgencia } from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
import { CaixaMarcacao } from "@/components/amassa/abertura/caixa-marcacao";
import { FerramentasLinha } from "@/components/amassa/abertura/ferramentas-linha";

// Client Component pelo MESMO motivo de `linha-item.tsx` — leia o comentário de lá. Em resumo:
// o risco no texto, o esmaecido e a etiqueta de urgência dependiam de o servidor redesenhar a
// tela depois da Server Action, e essa confirmação falha em silêncio em 83% dos toques (medido
// no servidor `standalone`, o mesmo do VPS). Marcar uma tarefa como concluída é dedução do
// estado local; não precisa de ida e volta.
//
// A REGRA continua no módulo puro: `urgenciaDaTarefa` é quem decide (inclusive o `feita`) — este
// componente só lhe passa o valor otimista de `concluida`.
export function LinhaDeTarefa({ tarefa, hoje }: { tarefa: TarefaDaAbertura; hoje: string }) {
  const [concluida, setConcluida] = useState(tarefa.concluida);

  useEffect(() => {
    setConcluida(tarefa.concluida);
  }, [tarefa.concluida]);

  const urgencia = urgenciaDaTarefa({ ...tarefa, concluida }, hoje);
  const texto = textoDaUrgencia(urgencia);

  return (
    <div
      className={cn(
        "border-border bg-card flex items-start gap-3 rounded-md border p-3 shadow-sm",
        urgencia.tipo === "atrasada" && "border-l-3 border-l-erro pl-2.5",
        urgencia.tipo === "hoje" && "border-l-3 border-l-atencao pl-2.5",
        concluida && "bg-muted/40",
      )}
      data-testid="abertura-linha-tarefa"
    >
      <CaixaMarcacao
        tipo="tarefa"
        id={tarefa.id}
        nome={tarefa.descricao}
        marcado={concluida}
        aoMudar={setConcluida}
      />

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-corpo font-medium break-words",
            concluida && "text-muted-foreground line-through",
          )}
        >
          {tarefa.descricao}
        </div>
        <div className="text-apoio mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
          {/* Nome do responsável só quando houver — sem espaço reservado vazio, sem travessão
              (ABE-07/D-11): "ninguém ainda" desenha nada aqui, não um placeholder. */}
          {tarefa.responsavelNome && (
            <span data-testid="abertura-responsavel-tarefa">{tarefa.responsavelNome}</span>
          )}

          {/* O vínculo com o item, lido do lado da tarefa (D-13) — truncado com reticências
              (UI-SPEC §"Comportamento responsivo") e com o nome completo em `title`. */}
          {tarefa.itemNome && (
            <span
              title={tarefa.itemNome}
              className="text-micro bg-muted text-muted-foreground inline-flex max-w-[180px] items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              data-testid="abertura-vinculo-item"
            >
              <Link2 aria-hidden="true" className="size-2.5 flex-none" />
              <span className="truncate">{tarefa.itemNome}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-0.5 text-right">
        <span
          data-testid="abertura-etiqueta-urgencia"
          data-urgencia={urgencia.tipo}
          className={cn(
            "text-micro rounded-full px-2 py-0.5 font-semibold whitespace-nowrap",
            urgencia.tipo === "atrasada" && "bg-erro-fundo text-erro",
            urgencia.tipo === "hoje" && "bg-atencao-fundo text-atencao",
            (urgencia.tipo === "futura" || urgencia.tipo === "feita") &&
              "bg-muted text-muted-foreground",
          )}
        >
          {texto}
        </span>
      </div>

      <FerramentasLinha
        dados={tarefa}
        id={tarefa.id}
        tipo="tarefa"
        nome={tarefa.descricao}
        hrefEditar={`/abertura?aba=tarefas&tarefa=${tarefa.id}`}
        hrefRemover={`/abertura?aba=tarefas&removerTarefa=${tarefa.id}`}
      />
    </div>
  );
}
