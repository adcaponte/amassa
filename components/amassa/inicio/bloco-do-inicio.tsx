import type { ReactNode } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BlocoDoInicioProps = {
  titulo: string;
  // Link de ação do cabeçalho ("abrir agenda", "abrir caixa", "abrir produção", "abrir
  // estoque" — como o protótipo). Os dois vêm juntos ou nenhum: um bloco sem destino próprio
  // (nenhum previsto ainda) simplesmente não recebe a dupla.
  acaoRotulo?: string;
  acaoHref?: string;
  dataTestId?: string;
  // Classes a mais no `Card` (Fase 06.3: o bloco "Anotações e lembretes" passa `md:col-span-2` para
  // ocupar as duas colunas da grade). Os outros quatro blocos não passam nada.
  className?: string;
  children: ReactNode;
};

// O envelope de todo bloco do Início, no molde de `CartaoPainel` (título + corpo) — mas com um
// link de ação opcional no cabeçalho, que `CartaoPainel` não tem. Server Component puro: quem
// decide vazio/carregando/erro é quem chama (cada bloco tem o próprio `try`/`catch`, D-09),
// nunca este envelope.
export function BlocoDoInicio({
  titulo,
  acaoRotulo,
  acaoHref,
  dataTestId,
  className,
  children,
}: BlocoDoInicioProps) {
  return (
    <Card data-testid={dataTestId} className={cn(className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-titulo text-foreground">{titulo}</CardTitle>
        {acaoRotulo && acaoHref && (
          <Link
            href={acaoHref}
            className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {acaoRotulo}
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
