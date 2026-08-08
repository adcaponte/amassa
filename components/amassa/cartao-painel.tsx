import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Cartão nomeado do painel inicial (D-02): título do cartão + frase do estado vazio dele. Sem
// botão e sem esqueleto nesta fase — nenhum cartão busca dado ainda (D-03).
//
// Formato do esqueleto para quando as Fases 3 a 6 trouxerem consulta real para este cartão:
// um retângulo do tamanho do título mais duas linhas do tamanho do corpo, ocupando o mesmo
// espaço que este conteúdo ocupa — nunca um "carregando..." solto, e nunca um esqueleto que
// nunca resolve (leria como travamento). Registrado aqui só como comentário, não como código
// morto: o `Skeleton` do shadcn só é importado quando houver dado assíncrono de verdade.
export type CartaoPainelProps = {
  titulo: string;
  vazio: string;
};

export function CartaoPainel({ titulo, vazio }: CartaoPainelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-titulo text-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-corpo text-muted-foreground">{vazio}</p>
      </CardContent>
    </Card>
  );
}
