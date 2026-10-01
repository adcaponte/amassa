import type { EventoDaSemana } from "@/lib/agenda/consultas";
import {
  ocupacaoDoCartao,
  ROTULO_CANCELADA,
  ROTULO_DIA_TODO,
  subLinhaDoCartao,
  TAG_DIA_FECHADO,
} from "@/lib/agenda/textos";
import { cn } from "@/lib/utils";

// A cor da borda esquerda é DECORATIVA (UI-D12): o tipo está sempre escrito na sub-linha.
const BORDA_DO_TIPO = {
  turma: "border-l-area-espaco",
  avulsa: "border-l-ouro",
  fechado: "border-l-area-geral",
} as const;

export type CartaoEventoProps = {
  evento: EventoDaSemana;
  aoTocar: (evento: EventoDaSemana) => void;
};

// O cartão de um evento na semana (05-UI-SPEC.md §"Cartão de evento (semana)"): `<button>` de
// largura total, 64px de altura mínima, grade `64px 1fr auto` — hora de início, título com quebra
// livre (nunca truncado), "{n} / {vagas}" — e, embaixo, o tipo + o fim. O nome acessível é o texto
// do cartão inteiro (não sobrescrito). Tocar abre a folha do evento (`?evento={id}`).
export function CartaoEvento({ evento, aoTocar }: CartaoEventoProps) {
  return (
    <button
      type="button"
      data-testid="agenda-cartao"
      data-evento-id={evento.id}
      data-tipo={evento.tipo}
      onClick={() => aoTocar(evento)}
      className={cn(
        "bg-superficie border-borda grid min-h-[64px] w-full grid-cols-[64px_1fr_auto] items-start gap-x-2 gap-y-1 rounded-md border border-l-4 px-4 py-2 text-left",
        "md:hover:bg-superficie-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        BORDA_DO_TIPO[evento.tipo],
      )}
    >
      <span className="text-apoio text-tinta-media font-semibold tabular-nums">
        {evento.inicio ?? ROTULO_DIA_TODO}
      </span>
      <span
        className={cn(
          "text-corpo min-w-0 font-semibold break-words",
          evento.cancelado ? "text-tinta-fraca line-through" : "text-tinta",
        )}
      >
        {evento.titulo}
      </span>
      <span className="text-apoio text-tinta-media font-semibold tabular-nums">
        {evento.vagas === null ? null : ocupacaoDoCartao(evento.inscritos, evento.vagas)}
      </span>
      <span className="text-apoio text-tinta-fraca col-span-2 col-start-2 flex flex-wrap gap-x-2 gap-y-1">
        <span>{subLinhaDoCartao(evento.tipo, evento.fim)}</span>
        {evento.cancelado ? (
          <span className="bg-erro-fundo text-erro rounded-sm px-2 font-semibold">
            {ROTULO_CANCELADA}
          </span>
        ) : null}
        {/* D-13: a data de turma num dia fechado continua marcada, com a etiqueta — o gestor decide. */}
        {evento.diaFechadoMotivo !== null ? (
          <span data-testid="tag-dia-fechado" className="bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold">
            {TAG_DIA_FECHADO}
          </span>
        ) : null}
      </span>
    </button>
  );
}
