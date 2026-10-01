import type { EventoDaSemana, ItemDaSemana, UsoLivreDaSemana } from "@/lib/agenda/consultas";
import { ocupacaoDoEspaco } from "@/lib/agenda/espaco";
import {
  ocupacaoDoCartao,
  ROTULO_CANCELADA,
  ROTULO_DIA_TODO,
  subLinhaDoCartao,
  subLinhaDoUsoLivre,
  TAG_DIA_FECHADO,
  TAG_ENCERRADO,
  TAG_ENCERRAR,
  TAG_MARCAR_PRESENCA,
  TAG_NO_ESPACO,
  TAG_RESERVADO,
  tituloDoUsoLivre,
} from "@/lib/agenda/textos";
import { cn } from "@/lib/utils";

// A cor da borda esquerda é DECORATIVA (UI-D12): o tipo está sempre escrito na sub-linha.
const BORDA_DO_TIPO = {
  turma: "border-l-area-espaco",
  avulsa: "border-l-ouro",
  fechado: "border-l-area-geral",
  uso_livre: "border-l-area-loja",
} as const;

const CLASSE_DA_TAG = "rounded-sm px-2 font-semibold";

// A tag de estado do uso livre (05-UI-SPEC.md §Color): "encerrar" (D-18 — dia passado ainda no espaço,
// âmbar) no lugar de "está no espaço" (verde); "reservado" e "encerrado" neutros. No cartão o encerrado
// fica sem tag de estado — a tag de pagamento ("a receber", "pago") é do plano 11.
export function TagDoUsoLivre({ uso, comEncerrado = false }: { uso: UsoLivreDaSemana; comEncerrado?: boolean }) {
  if (uso.encerrar) {
    return (
      <span data-testid="tag-encerrar" className={cn(CLASSE_DA_TAG, "bg-atencao-fundo text-atencao")}>
        {TAG_ENCERRAR}
      </span>
    );
  }
  if (uso.estado === "no_espaco") {
    return (
      <span data-testid="tag-no-espaco" className={cn(CLASSE_DA_TAG, "bg-sucesso-fundo text-sucesso")}>
        {TAG_NO_ESPACO}
      </span>
    );
  }
  if (uso.estado === "reservado") {
    return (
      <span data-testid="tag-reservado" className={cn(CLASSE_DA_TAG, "bg-superficie-2 text-tinta-media")}>
        {TAG_RESERVADO}
      </span>
    );
  }
  return comEncerrado ? (
    <span data-testid="tag-encerrado" className={cn(CLASSE_DA_TAG, "bg-superficie-2 text-tinta-media")}>
      {TAG_ENCERRADO}
    </span>
  ) : null;
}

export type CartaoEventoProps = {
  evento: ItemDaSemana;
  aoTocar: (evento: ItemDaSemana) => void;
};

// O cartão de um item na semana (05-UI-SPEC.md §"Cartão de evento (semana)"): `<button>` de
// largura total, 64px de altura mínima, grade `64px 1fr auto` — hora de início, título com quebra
// livre (nunca truncado), "{n} / {vagas}" (uso livre: "{n} pessoa(s)", nunca "lugar") — e, embaixo, o
// tipo + o fim. O nome acessível é o texto do cartão inteiro (não sobrescrito). Tocar abre a folha do
// evento (`?evento={id}`) ou a do uso livre (`?uso={id}`).
export function CartaoEvento({ evento, aoTocar }: CartaoEventoProps) {
  const uso = evento.tipo === "uso_livre" ? evento : null;
  const doCalendario = evento.tipo === "uso_livre" ? null : (evento as EventoDaSemana);
  return (
    <button
      type="button"
      data-testid="agenda-cartao"
      data-evento-id={doCalendario?.id}
      data-uso-id={uso?.id}
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
          doCalendario?.cancelado ? "text-tinta-fraca line-through" : "text-tinta",
        )}
      >
        {uso ? tituloDoUsoLivre(uso.titulo) : evento.titulo}
      </span>
      <span className="text-apoio text-tinta-media font-semibold tabular-nums">
        {uso
          ? ocupacaoDoEspaco(uso.pessoas)
          : doCalendario?.vagas === null || doCalendario === null
            ? null
            : ocupacaoDoCartao(doCalendario.inscritos, doCalendario.vagas)}
      </span>
      <span className="text-apoio text-tinta-fraca col-span-2 col-start-2 flex flex-wrap gap-x-2 gap-y-1">
        {uso ? (
          <>
            <span>{subLinhaDoUsoLivre(uso.fim)}</span>
            <TagDoUsoLivre uso={uso} />
          </>
        ) : doCalendario ? (
          <>
            <span>{subLinhaDoCartao(doCalendario.tipo, doCalendario.fim)}</span>
            {doCalendario.cancelado ? (
              <span className="bg-erro-fundo text-erro rounded-sm px-2 font-semibold">{ROTULO_CANCELADA}</span>
            ) : null}
            {/* D-13: a data de turma num dia fechado continua marcada, com a etiqueta — o gestor decide. */}
            {doCalendario.diaFechadoMotivo !== null ? (
              <span data-testid="tag-dia-fechado" className="bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold">
                {TAG_DIA_FECHADO}
              </span>
            ) : null}
            {/* AGE-08: data passada, não cancelada, com alguém sem marcação — é por esta tag que se acha o
                que pede ação na semana. */}
            {doCalendario.marcarPresenca ? (
              <span
                data-testid="tag-marcar-presenca"
                className="bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold"
              >
                {TAG_MARCAR_PRESENCA}
              </span>
            ) : null}
          </>
        ) : null}
      </span>
    </button>
  );
}
