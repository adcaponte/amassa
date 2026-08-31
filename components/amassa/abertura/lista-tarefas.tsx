
import type { TarefaDaAbertura } from "@/lib/abertura/consultas";
import { agruparTarefasPorGrupo } from "@/lib/abertura/prazos";
import {
  FRASE_VAZIO_CORPO_TAREFAS,
  FRASE_VAZIO_TITULO_TAREFAS,
  ROTULO_GRUPO,
  ROTULO_NOVA_TAREFA,
} from "@/lib/abertura/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { BotaoVazioAbertura } from "@/components/amassa/abertura/botao-vazio-abertura";
import { LinhaDeTarefa } from "@/components/amassa/abertura/linha-tarefa";
import { ConfirmarRemoverTarefa } from "@/components/amassa/abertura/confirmar-remover-tarefa";

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
        botao={<BotaoVazioAbertura tipo="tarefa" rotulo={ROTULO_NOVA_TAREFA} />}
      />
    );
  }

  const grupos = agruparTarefasPorGrupo(tarefas, hoje);

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8" data-testid="abertura-lista-tarefas">
      {/* UMA instância para a lista toda (nunca uma por linha) — ver o comentário em
          confirmar-remover-tarefa.tsx e .planning/debug/abertura-navegacao-trava.md. */}
      <ConfirmarRemoverTarefa
        tarefas={tarefas.map((tarefa) => ({ id: tarefa.id, descricao: tarefa.descricao }))}
      />

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
