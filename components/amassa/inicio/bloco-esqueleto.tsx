import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type BlocoEsqueletoProps = {
  titulo: string;
  // Quantas linhas do tamanho do corpo o esqueleto desenha — existe para o esqueleto ocupar
  // aproximadamente a mesma altura do bloco cheio (D-09: a página não pode pular no celular
  // quando o conteúdo real chega).
  linhas: number;
};

// O esqueleto de carregamento, no formato que o comentário de `cartao-painel.tsx` já reserva:
// "um retângulo do tamanho do título mais linhas linhas do tamanho do corpo" — nunca um
// "carregando..." solto. `titulo` não aparece como texto visível (o retângulo continua sendo um
// retângulo, não o título real antecipado); ele vira só o nome acessível `sr-only`, para quem
// usa leitor de tela saber QUAL bloco está carregando, já que visualmente todos os esqueletos
// são idênticos.
export function BlocoEsqueleto({ titulo, linhas }: BlocoEsqueletoProps) {
  return (
    <Card data-testid="inicio-bloco-esqueleto">
      <CardHeader>
        <Skeleton aria-hidden="true" className="h-6 w-40" />
        <span className="sr-only">Carregando: {titulo}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: linhas }, (_, indice) => (
          <Skeleton key={indice} aria-hidden="true" className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
