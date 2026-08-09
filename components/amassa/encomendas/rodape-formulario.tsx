"use client";

import { useWatch, type Control } from "react-hook-form";

import { calcularCronograma } from "@/lib/encomendas/cronograma";
import { formatarDiaCurto } from "@/lib/encomendas/formato";

import type { ValoresDoFormulario } from "./formulario-encomenda";

export type RodapeFormularioProps = {
  control: Control<ValoresDoFormulario>;
};

// D-17: recalcula a CADA TECLA, sem esperar "Salvar" e sem ida ao servidor (ENC-11/concurrency).
// `useWatch` (não `watch()`) é o que faz o recálculo acontecer sem re-renderizar o formulário
// inteiro a cada tecla — só este componente pequeno re-renderiza. Chama a MESMA
// `calcularCronograma` que o servidor usa ao gravar (D-15): é esse compartilhamento que impede
// a pré-visualização de mentir — um segundo cálculo aqui divergiria do primeiro na primeira
// regra que alguém mudasse. Sempre derivado do estado atual do formulário, nunca somando
// incrementos (ENC-11/idempotency): recalcular duas vezes com a mesma entrada dá o mesmo
// resultado.
export function RodapeFormulario({ control }: RodapeFormularioProps) {
  const dataInicio = useWatch({ control, name: "dataInicio" });
  const etapas = useWatch({ control, name: "etapas" });

  let duracaoTotalEmDias = 0;
  let dataDeConclusao: string | null = null;

  // Enquanto se digita, `dataInicio` pode estar temporariamente vazia/incompleta e `etapas` pode
  // ter um marco fora de {0,1} no instante entre dois cliques — `calcularCronograma` lança nesses
  // casos (RangeError, por desenho). O rodapé simplesmente não recalcula naquele instante, sem
  // travar a pré-visualização do resto do formulário (03-UI-SPEC.md "E4 formulário — parcial").
  if (dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(dataInicio) && Array.isArray(etapas)) {
    try {
      const cronograma = calcularCronograma(dataInicio, etapas);
      duracaoTotalEmDias = cronograma.duracaoTotalEmDias;
      dataDeConclusao = cronograma.dataDeConclusao;
    } catch {
      // Ver comentário acima — mantém os valores em 0/null deste render.
    }
  }

  return (
    <p className="text-corpo text-tinta-media" data-testid="rodape-formulario">
      Duração total:{" "}
      <span className="text-mono tabular-nums font-medium text-tinta">
        {duracaoTotalEmDias} dia{duracaoTotalEmDias === 1 ? "" : "s"}
      </span>
      {" · Conclusão prevista: "}
      <span className="text-mono tabular-nums font-medium text-tinta">
        {dataDeConclusao ? formatarDiaCurto(dataDeConclusao) : "—"}
      </span>
    </p>
  );
}
