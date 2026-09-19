import type { ReactNode } from "react";

import type { CartaoDoPainel } from "@/lib/abertura/abas";
import { formatarReais } from "@/lib/abertura/formato";
import type { ResumoDoPainel } from "@/lib/abertura/parcelas";
import {
  ROTULO_A_PRAZO,
  ROTULO_A_VISTA,
  ROTULO_COMPROMETIDO,
  ROTULO_PRECISA_DE_ATENCAO,
  ROTULO_PROXIMO_MES,
  ROTULO_SAI_NESTE_MES,
} from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";

export type PainelResumoProps = {
  resumo: ResumoDoPainel;
  cartoes: readonly CartaoDoPainel[];
};

// Server Component. Os três blocos de D-15/ABE-12 continuam existindo — quais aparecem em cada
// aba é decidido por `cartoesDaAba` (lib/abertura/abas.ts, pedido do dono em 19/09: "Comprometido"
// e "Sai neste mês" só em Por mês, "Precisa de atenção" só em Itens, nenhum em Tarefas/Cotações).
// Com `cartoes` vazio, devolve `null` — nenhum `div` do grid, nenhum `pt-6` sobrando. Com a lista
// cheia, o MESMO contêiner de sempre, uma coluna no celular e três a partir de 660px (UI-SPEC
// §"Comportamento responsivo") — `grid-cols-3` nunca muda para o número de cartões visíveis, para
// cada cartão manter o tamanho de hoje (um terço no desktop) em vez de esticar. Nenhum total nasce
// aqui: o componente só formata o que `resumoDoPainel` (lib/abertura/parcelas.ts) já entregou
// pronto.
export function PainelResumo({ resumo, cartoes }: PainelResumoProps) {
  if (cartoes.length === 0) {
    return null;
  }

  const emAtencao = resumo.precisamDeAtencao > 0;
  const mostrarComprometido = cartoes.includes("comprometido");
  const mostrarMes = cartoes.includes("mes");
  const mostrarAtencao = cartoes.includes("atencao");

  return (
    <div
      className="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-3 md:px-8"
      data-testid="abertura-painel-resumo"
    >
      {mostrarComprometido ? (
        <BlocoDoPainel
          testId="abertura-bloco-comprometido"
          rotulo={ROTULO_COMPROMETIDO}
          valor={formatarReais(resumo.comprometidoEmCentavos)}
        >
          <strong className="font-semibold">{formatarReais(resumo.aVistaEmCentavos)}</strong>{" "}
          {ROTULO_A_VISTA} ·{" "}
          <strong className="font-semibold">{formatarReais(resumo.aPrazoEmCentavos)}</strong>{" "}
          {ROTULO_A_PRAZO}
        </BlocoDoPainel>
      ) : null}

      {mostrarMes ? (
        <BlocoDoPainel
          testId="abertura-bloco-mes"
          rotulo={ROTULO_SAI_NESTE_MES}
          valor={formatarReais(resumo.saiNesteMesEmCentavos)}
        >
          {ROTULO_PROXIMO_MES}{" "}
          <strong className="font-semibold">
            {formatarReais(resumo.saiNoProximoMesEmCentavos)}
          </strong>
        </BlocoDoPainel>
      ) : null}

      {/* O valor grande fica em `--color-erro` SÓ quando a soma passa de zero — um zero em
          vermelho gritaria sem ter o que gritar. */}
      {mostrarAtencao ? (
        <BlocoDoPainel
          testId="abertura-bloco-atencao"
          rotulo={ROTULO_PRECISA_DE_ATENCAO}
          valor={String(resumo.precisamDeAtencao)}
          valorEmAlerta={emAtencao}
        >
          <strong className="font-semibold">{resumo.tarefasAtrasadas}</strong>{" "}
          {resumo.tarefasAtrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"} ·{" "}
          <strong className="font-semibold">{resumo.entregasVencidas}</strong>{" "}
          {resumo.entregasVencidas === 1 ? "entrega vencida" : "entregas vencidas"}
        </BlocoDoPainel>
      ) : null}
    </div>
  );
}

function BlocoDoPainel({
  testId,
  rotulo,
  valor,
  valorEmAlerta,
  children,
}: {
  testId: string;
  rotulo: string;
  valor: string;
  valorEmAlerta?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-card rounded-lg border p-4 shadow-sm" data-testid={testId}>
      <div className="text-micro text-muted-foreground font-semibold tracking-wide uppercase">
        {rotulo}
      </div>
      <div
        className={cn(
          "text-titulo mt-1 font-bold tabular-nums",
          valorEmAlerta ? "text-erro" : "text-foreground",
        )}
        data-testid={`${testId}-valor`}
      >
        {valor}
      </div>
      <div className="text-apoio text-muted-foreground mt-1 tabular-nums">{children}</div>
    </div>
  );
}
