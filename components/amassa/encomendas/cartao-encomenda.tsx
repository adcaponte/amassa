import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { SELO_ATRASADA, SELO_RASCUNHO, textoDaSituacao } from "@/lib/encomendas/textos";

import type { EncomendaDoIndice } from "./lista-encomendas";
import { TrilhaSegmentos } from "./trilha-segmentos";

export type CartaoEncomendaProps = {
  encomenda: EncomendaDoIndice;
  hoje: string;
};

// Cartão da lista mobile (03-UI-SPEC.md "Lista Vertical Mobile"): nome (papel `título`, quebra
// em linha com `break-words`, NUNCA truncado — o cartão tem altura livre, ao contrário da
// coluna fixa do Gantt), cliente, selo(s), a trilha de 6 segmentos e o texto de situação. O
// cartão inteiro é um link para `/encomendas/{id}` (a página nasce no plano 05), com alvo de
// toque de no mínimo 56px de altura.
export function CartaoEncomenda({ encomenda, hoje }: CartaoEncomendaProps) {
  const rascunho = encomenda.status === "rascunho";
  const atrasada = encomenda.situacao.tipo === "atrasada";

  return (
    <Link
      href={`/encomendas/${encomenda.id}`}
      className="focus-visible:ring-ring block min-h-[56px] rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      data-testid={`cartao-encomenda-${encomenda.id}`}
    >
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-titulo text-foreground break-words">{encomenda.nome}</span>
            {rascunho && (
              <span className="text-micro border-borda-forte bg-superficie-2 text-tinta-media shrink-0 rounded border px-1.5 py-0.5 tracking-wide uppercase">
                {SELO_RASCUNHO}
              </span>
            )}
            {atrasada && (
              <span className="text-micro border-atencao bg-atencao-fundo text-atencao shrink-0 rounded border px-1.5 py-0.5 tracking-wide uppercase">
                {SELO_ATRASADA}
              </span>
            )}
          </div>

          <span className="text-apoio text-muted-foreground">{encomenda.clienteNome ?? "—"}</span>

          <TrilhaSegmentos
            faixas={encomenda.cronograma.faixas}
            situacao={encomenda.situacao}
            rascunho={rascunho}
            hoje={hoje}
          />

          <span
            className={
              atrasada ? "text-apoio text-atencao font-medium" : "text-apoio text-muted-foreground"
            }
          >
            {textoDaSituacao(encomenda.situacao)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
