import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { medirForno } from "@/lib/queimas/contador";
import type { FornoMedido } from "@/lib/queimas/consultas";

import { RegistrarQueima } from "./registrar-queima";

export type CartaoFornoProps = {
  forno: FornoMedido;
};

// Cartão do índice (E2, D-03): nome (quebra por palavra, nunca truncado — `[overflow-wrap:anywhere]`),
// contador `atual / limite` em `text-mono` (números tabulares, alinham ao mudar), e um único
// botão — "Queimar" (`RegistrarQueima`) — nada mais compete com ele. Server Component: quem
// decide contador/total/nível é o módulo puro `lib/queimas/contador.ts`, nunca este componente
// nem a consulta (CLAUDE.md §Regras de negócio) — `medirForno()` recebe o dado bruto de
// `FornoMedido` e devolve a medida.
export function CartaoForno({ forno }: CartaoFornoProps) {
  const medida = medirForno({
    limite: forno.limite,
    ocorrenciasDeQueima: forno.ocorrenciasDeQueima,
    ultimaManutencaoEm: forno.ultimaManutencaoEm,
  });

  return (
    <Card data-testid={`cartao-forno-${forno.id}`}>
      <CardHeader>
        <CardTitle className="text-titulo [overflow-wrap:anywhere]">{forno.nome}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <span className="text-mono tabular-nums text-tinta" data-testid={`contador-forno-${forno.id}`}>
          {medida.contador} / {medida.limite}
        </span>

        <RegistrarQueima fornoId={forno.id} />
      </CardContent>
    </Card>
  );
}
