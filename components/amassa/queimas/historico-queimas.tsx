import type { QueimaDoHistorico } from "@/lib/queimas/consultas";
import { formatarInstanteCurto } from "@/lib/queimas/formato";
import { FRASE_SEM_QUEIMAS, ROTULO_AUTOR_DESCONHECIDO, rotuloDoTipo } from "@/lib/queimas/textos";

export type HistoricoQueimasProps = {
  queimas: QueimaDoHistorico[];
};

// Cor de TIPO (`--color-biscoito`/`-esmalte`/`-ouro`) — nunca a cor de NÍVEL do forno
// (`--color-forno-*`): as duas nunca se misturam (04-UI-SPEC.md §Color, `04-DESIGN-SYSTEM.md`
// §3). Um ponto discreto ao lado do rótulo do tipo — a cor é informação (qual tipo), não
// decoração.
function corDoTipo(tipo: QueimaDoHistorico["tipo"]): string {
  switch (tipo) {
    case "biscoito":
      return "bg-biscoito";
    case "esmalte":
      return "bg-esmalte";
    case "ouro":
      return "bg-ouro";
    default: {
      const _exaustivo: never = tipo;
      throw new Error(`corDoTipo: tipo de queima não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

// O histórico das últimas 25 queimas (E6, FOR-09) — a lista já vem ordenada e limitada pela
// consulta (`buscarForno`); este componente NÃO corta nada por conta própria. Cada linha carrega
// o `id` da queima e reserva o espaço do controle de exclusão que a Tarefa 3 acrescenta.
export function HistoricoQueimas({ queimas }: HistoricoQueimasProps) {
  if (queimas.length === 0) {
    return (
      <p className="text-apoio text-muted-foreground" data-testid="historico-queimas-vazio">
        {FRASE_SEM_QUEIMAS}
      </p>
    );
  }

  return (
    <ul className="flex flex-col" data-testid="lista-historico-queimas">
      {queimas.map((queima) => (
        <li
          key={queima.id}
          data-testid={`linha-queima-${queima.id}`}
          className="border-border flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${corDoTipo(queima.tipo)}`}
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-corpo text-foreground">{rotuloDoTipo(queima.tipo)}</span>
              <span className="text-apoio text-muted-foreground break-words">
                {formatarInstanteCurto(queima.ocorridaEm)} ·{" "}
                {queima.registradoPorNome ?? ROTULO_AUTOR_DESCONHECIDO}
              </span>
            </div>
          </div>

          {/* Lugar reservado para o controle de exclusão — Tarefa 3. */}
          <div data-testid={`acoes-queima-${queima.id}`} className="shrink-0" />
        </li>
      ))}
    </ul>
  );
}
