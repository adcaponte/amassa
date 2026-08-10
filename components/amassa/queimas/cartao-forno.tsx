import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FornoMedido } from "@/lib/queimas/consultas";
import { ROTULO_QUEIMAR } from "@/lib/queimas/textos";

export type CartaoFornoProps = {
  forno: FornoMedido;
};

// Cartão do índice (E2, D-03): nome (quebra por palavra, nunca truncado), contador `atual /
// limite` em `text-mono`, e um único botão — "Queimar" — nada mais compete com ele. Server
// Component: o botão real de dois toques (`RegistrarQueima`, Tarefa 3) é um Client Component
// separado; aqui, nesta tarefa (traçado), ele ainda não existe — este cartão mostra um espaço
// reservado desabilitado só para o índice compilar e exibir a forma completa do cartão (D-03),
// já com o contador correto (sempre 0, já que nenhuma queima pode existir antes da Tarefa 3).
export function CartaoForno({ forno }: CartaoFornoProps) {
  // Contador ainda trivial nesta tarefa (nenhum caminho de escrita de queima existe até a
  // Tarefa 3) — o valor real, com a regra do corte por manutenção, passa a vir de
  // `medirForno()` (`lib/queimas/contador.ts`) na Tarefa 3.
  const contador = forno.ocorrenciasDeQueima.length;

  return (
    <Card data-testid={`cartao-forno-${forno.id}`}>
      <CardHeader>
        <CardTitle className="text-titulo [overflow-wrap:anywhere]">{forno.nome}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <span className="text-mono tabular-nums text-tinta">
          {contador} / {forno.limite}
        </span>

        <Button
          type="button"
          variant="default"
          disabled
          aria-disabled="true"
          className="min-h-[44px] w-full md:w-auto"
        >
          {ROTULO_QUEIMAR}
        </Button>
      </CardContent>
    </Card>
  );
}
