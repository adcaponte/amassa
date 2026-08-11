import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Cartão nomeado do painel inicial (D-02): título do cartão + frase do estado vazio dele.
//
// Formato do esqueleto para quando as Fases 3 a 6 trouxerem consulta real para este cartão:
// um retângulo do tamanho do título mais duas linhas do tamanho do corpo, ocupando o mesmo
// espaço que este conteúdo ocupa — nunca um "carregando..." solto, e nunca um esqueleto que
// nunca resolve (leria como travamento). Registrado aqui só como comentário, não como código
// morto: o `Skeleton` do shadcn só é importado quando houver dado assíncrono de verdade.
//
// `children` (plano 04-05, E11): prop ADITIVA — `titulo`/`vazio` continuam exatamente como
// estavam, e os três cartões que ainda não têm dado real (Encomendas, Aulas, Estoque) não mudam
// de assinatura nem de comportamento. Quando `children` vem, o cartão renderiza o conteúdo
// populado no lugar da frase de `vazio`; quando não vem, nada muda.
export type CartaoPainelProps = {
  titulo: string;
  vazio: string;
  children?: ReactNode;
};

export function CartaoPainel({ titulo, vazio, children }: CartaoPainelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-titulo text-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? <p className="text-corpo text-muted-foreground">{vazio}</p>}
      </CardContent>
    </Card>
  );
}
