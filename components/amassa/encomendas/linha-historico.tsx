import Link from "next/link";

import { formatarDiaCurto, formatarPeriodo, hojeEmBrasilia } from "@/lib/encomendas/formato";

import type { EncomendaDoIndice } from "./lista-encomendas";

// A linha do histórico (D-07, 03-UI-SPEC.md "Histórico — Linhas da Lista") — Server Component de
// apresentação puro, a mesma convenção de linha clicável de 56px de `cartao-encomenda.tsx`. O
// histórico é filtro do próprio índice ("Concluídas"/"Canceladas"), renderizado como LISTA
// inclusive no desktop: nunca uma barra de Gantt de encomenda que já acabou.
export type LinhaHistoricoProps = {
  encomenda: EncomendaDoIndice;
};

type StatusDoHistorico = "concluida" | "cancelada";

const ROTULO_BADGE: Record<StatusDoHistorico, string> = {
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function BadgeDeStatus({ status }: { status: StatusDoHistorico }) {
  if (status === "concluida") {
    return (
      <span className="text-micro shrink-0 rounded bg-sucesso-fundo px-1.5 py-0.5 tracking-wide text-sucesso uppercase">
        {ROTULO_BADGE.concluida}
      </span>
    );
  }

  // "Cancelada" usa `--color-superficie-2`/`--color-tinta-media` — nunca a cor semântica de
  // falha: cancelar não é erro (D-08, 03-UI-SPEC.md Color).
  return (
    <span className="text-micro border-borda-forte bg-superficie-2 text-tinta-media shrink-0 rounded border px-1.5 py-0.5 tracking-wide uppercase">
      {ROTULO_BADGE.cancelada}
    </span>
  );
}

// Uma encomenda cancelada mostra o período que chegou a existir, nunca a data de conclusão
// PREVISTA que nunca aconteceu (E7/partial). `atualizadoEm` é o instante do UPDATE que gravou
// `status = cancelada` (gatilho `tocar_atualizado_em`, migração 0006) — o que o schema guarda
// mais perto de "quando", sem uma coluna dedicada de cancelamento. `hojeEmBrasilia` é reaproveitada
// aqui pelo que ela já faz de genérico: converte QUALQUER instante para o dia civil de Brasília,
// não só "agora" — o nome descreve o uso mais comum, não uma restrição da função.
function periodoDaLinha(encomenda: EncomendaDoIndice): string {
  if (encomenda.status === "cancelada") {
    const diaDoCancelamento = hojeEmBrasilia(new Date(encomenda.atualizadoEm));
    return `${formatarDiaCurto(encomenda.dataInicio)} – cancelada em ${formatarDiaCurto(diaDoCancelamento)}`;
  }

  return formatarPeriodo(encomenda.dataInicio, encomenda.cronograma.dataDeConclusao);
}

// "{primeira descrição} · +N" quando há mais de um item — a pista de conteúdo que
// 03-UI-SPEC.md pede, sem abrir o detalhe. Com um item só, a própria descrição já é a pista;
// não faz sentido um "+0" atrás dela.
function resumoDeItens(encomenda: EncomendaDoIndice): string {
  const { itens } = encomenda;
  if (itens.length === 0) {
    return "Sem itens";
  }
  if (itens.length === 1) {
    return itens[0].descricao;
  }
  return `${itens[0].descricao} · +${itens.length - 1}`;
}

export function LinhaHistorico({ encomenda }: LinhaHistoricoProps) {
  // `EncomendaDoIndice.status` cobre os 4 valores de `StatusDeEncomenda` — `LinhaHistorico` só é
  // montada por `lista-encomendas.tsx` quando o status já é `concluida`/`cancelada` (D-07); o
  // `as` documenta esse contrato sem duplicar o enum aqui.
  const status = encomenda.status as StatusDoHistorico;

  return (
    <Link
      href={`/encomendas/${encomenda.id}`}
      className="focus-visible:ring-ring block min-h-14 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      data-testid={`linha-historico-${encomenda.id}`}
    >
      <div className="flex min-h-14 flex-col justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-titulo text-foreground break-words">{encomenda.nome}</span>
          <BadgeDeStatus status={status} />
        </div>

        <span className="text-apoio text-muted-foreground break-words">
          {encomenda.clienteNome ?? "—"}
        </span>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-mono text-tinta-fraca tabular-nums">{periodoDaLinha(encomenda)}</span>
          <span className="text-apoio text-muted-foreground break-words">
            {resumoDeItens(encomenda)}
          </span>
        </div>
      </div>
    </Link>
  );
}
