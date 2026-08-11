import type { ManutencaoDoHistorico } from "@/lib/queimas/consultas";
import { formatarInstanteCurto } from "@/lib/queimas/formato";
import { FRASE_SEM_MANUTENCOES } from "@/lib/queimas/textos";

export type HistoricoManutencoesProps = {
  manutencoes: ManutencaoDoHistorico[];
};

// O histórico de manutenções (E6) — TODAS as manutenções do forno, sem limite (são poucas por
// construção, uma a cada ~100 queimas). `queimasAcumuladas` é o "N" que o contador tinha quando a
// manutenção foi registrada — o que permite ler o ritmo de desgaste ao longo da vida do forno.
// `observacoes` (texto livre) quebra dentro de `max-w-prose`, nunca truncada no meio da palavra.
export function HistoricoManutencoes({ manutencoes }: HistoricoManutencoesProps) {
  if (manutencoes.length === 0) {
    return (
      <p className="text-apoio text-muted-foreground" data-testid="historico-manutencoes-vazio">
        {FRASE_SEM_MANUTENCOES}
      </p>
    );
  }

  return (
    <ul className="flex flex-col" data-testid="lista-historico-manutencoes">
      {manutencoes.map((manutencao) => (
        <li
          key={manutencao.id}
          data-testid={`linha-manutencao-${manutencao.id}`}
          className="border-border flex flex-col gap-1 border-b py-3 last:border-b-0"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-corpo text-foreground">
              {formatarInstanteCurto(manutencao.ocorridaEm.toISOString())}
            </span>
            {manutencao.responsavel && (
              <span className="text-apoio text-muted-foreground break-words">
                · {manutencao.responsavel}
              </span>
            )}
            <span className="text-mono text-tinta-fraca ml-auto tabular-nums">
              {manutencao.queimasAcumuladas} queimas
            </span>
          </div>

          {manutencao.observacoes && (
            <p className="text-apoio text-muted-foreground max-w-prose break-words">
              {manutencao.observacoes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
