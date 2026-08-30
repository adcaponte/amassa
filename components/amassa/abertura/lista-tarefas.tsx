import { Link2 } from "lucide-react";

import type { TarefaDaAbertura } from "@/lib/abertura/consultas";
import { agruparTarefasPorGrupo, urgenciaDaTarefa } from "@/lib/abertura/prazos";
import {
  FRASE_VAZIO_CORPO_TAREFAS,
  FRASE_VAZIO_TITULO_TAREFAS,
  ROTULO_GRUPO,
  ROTULO_NOVA_TAREFA,
  textoDaUrgencia,
} from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { CaixaMarcacao } from "@/components/amassa/abertura/caixa-marcacao";
import { FerramentasLinha } from "@/components/amassa/abertura/ferramentas-linha";

export type ListaTarefasProps = {
  tarefas: TarefaDaAbertura[];
  hoje: string;
};

// Server Component. Recebe as tarefas JÁ RESOLVIDAS (nome de responsável, nome de item) e
// `hoje`, e delega inteiramente a urgência/ordenação/agrupamento a `lib/abertura/prazos.ts` —
// nenhuma regra de negócio nasce aqui, este componente só formata e desenha (mesma disciplina de
// `lista-itens.tsx`).
export function ListaTarefas({ tarefas, hoje }: ListaTarefasProps) {
  if (tarefas.length === 0) {
    return (
      <EstadoVazio
        titulo={FRASE_VAZIO_TITULO_TAREFAS}
        corpo={FRASE_VAZIO_CORPO_TAREFAS}
        rotuloBotao={ROTULO_NOVA_TAREFA}
        hrefBotao="/abertura?aba=tarefas&tarefa=nova"
      />
    );
  }

  const grupos = agruparTarefasPorGrupo(tarefas, hoje);

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8" data-testid="abertura-lista-tarefas">
      {grupos.map((grupo) => (
        <div key={grupo.grupo} data-testid="abertura-grupo-tarefa">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-micro font-semibold tracking-wide text-muted-foreground uppercase">
              {ROTULO_GRUPO[grupo.grupo]}
            </h2>
            <span className="text-apoio flex items-center gap-2 text-muted-foreground tabular-nums">
              {grupo.atrasadas > 0 && (
                <span
                  className="text-micro font-semibold text-erro"
                  data-testid="abertura-atrasadas-do-grupo"
                >
                  {grupo.atrasadas} {grupo.atrasadas === 1 ? "atrasada" : "atrasadas"}
                </span>
              )}
              <span>
                {grupo.concluidas} de {grupo.total} {grupo.total === 1 ? "feita" : "feitas"}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {grupo.tarefas.map((tarefa) => (
              <LinhaDeTarefa key={tarefa.id} tarefa={tarefa} hoje={hoje} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinhaDeTarefa({ tarefa, hoje }: { tarefa: TarefaDaAbertura; hoje: string }) {
  const urgencia = urgenciaDaTarefa(tarefa, hoje);
  const texto = textoDaUrgencia(urgencia);

  return (
    <div
      className={cn(
        "border-border bg-card flex items-start gap-3 rounded-md border p-3 shadow-sm",
        urgencia.tipo === "atrasada" && "border-l-3 border-l-erro pl-2.5",
        urgencia.tipo === "hoje" && "border-l-3 border-l-atencao pl-2.5",
        tarefa.concluida && "bg-muted/40",
      )}
      data-testid="abertura-linha-tarefa"
    >
      <CaixaMarcacao
        tipo="tarefa"
        id={tarefa.id}
        nome={tarefa.descricao}
        marcado={tarefa.concluida}
      />

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-corpo font-medium break-words",
            tarefa.concluida && "text-muted-foreground line-through",
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
        tipo="tarefa"
        nome={tarefa.descricao}
        hrefEditar={`/abertura?aba=tarefas&tarefa=${tarefa.id}`}
        hrefRemover={`/abertura?aba=tarefas&removerTarefa=${tarefa.id}`}
      />
    </div>
  );
}
