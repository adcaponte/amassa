import type { ReactNode } from "react";

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
};

// Server Component. Os três blocos de D-15/ABE-12, na ORDEM decidida (comprometido → sai neste
// mês → precisa de atenção), uma coluna no celular e três a partir de 660px (UI-SPEC
// §"Comportamento responsivo"). Nenhum total nasce aqui: o componente só formata o que
// `resumoDoPainel` (lib/abertura/parcelas.ts) já entregou pronto.
export function PainelResumo({ resumo }: PainelResumoProps) {
  const emAtencao = resumo.precisamDeAtencao > 0;

  return (
    <div
      className="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-3 md:px-8"
      data-testid="abertura-painel-resumo"
    >
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

      {/* O valor grande fica em `--color-erro` SÓ quando a soma passa de zero — um zero em
          vermelho gritaria sem ter o que gritar. */}
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
