import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { medirForno } from "@/lib/queimas/contador";
import type { FornoMedido } from "@/lib/queimas/consultas";
import { formatarInstanteCurto } from "@/lib/queimas/formato";
import { fraseDoRodape, textoDoNivel } from "@/lib/queimas/textos";

import { Medidor } from "./medidor";
import { RegistrarQueima } from "./registrar-queima";

export type CartaoFornoProps = {
  forno: FornoMedido;
};

// Cartão do índice (E2, D-03): nome (Link para a página do forno, quebra por palavra, nunca
// truncado), o selo textual por nível quando existe, o medidor, o rodapé com as duas contagens,
// e um único botão — "Queimar" (`RegistrarQueima`) — nada mais compete com ele. Server
// Component: quem decide contador/total/nível é o módulo puro `lib/queimas/contador.ts`, nunca
// este componente nem a consulta (CLAUDE.md §Regras de negócio) — `medirForno()` recebe o dado
// bruto de `FornoMedido` e devolve a medida; `Medidor` só desenha o que recebe (T-04-08).
export function CartaoForno({ forno }: CartaoFornoProps) {
  const medida = medirForno({
    limite: forno.limite,
    ocorrenciasDeQueima: forno.ocorrenciasDeQueima,
    ultimaManutencaoEm: forno.ultimaManutencaoEm,
  });

  const selo = textoDoNivel(medida.nivel);

  const dataDaUltimaManutencao = forno.ultimaManutencaoEm
    ? formatarInstanteCurto(forno.ultimaManutencaoEm)
    : null;
  const rodape = fraseDoRodape({
    data: dataDaUltimaManutencao,
    responsavel: forno.ultimaManutencaoResponsavel,
    total: medida.total,
  });

  return (
    <Card data-testid={`cartao-forno-${forno.id}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <Link
          href={`/queimas/${forno.id}`}
          className="text-titulo text-foreground focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:outline-none"
        >
          {forno.nome}
        </Link>

        {/* Selo textual — nunca renderizado em nível "ok" (`textoDoNivel` devolve null). O
            crítico leva o ícone de alerta ao lado do texto visível (`04-DESIGN-SYSTEM.md` §3:
            este vermelho significa urgência de verdade). */}
        {selo && (
          <span
            data-testid={`selo-forno-${forno.id}`}
            className={
              "text-apoio flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-medium " +
              (medida.nivel === "critico"
                ? "border-forno-critico bg-forno-critico-fundo text-forno-critico-texto"
                : "border-forno-atencao bg-forno-atencao-fundo text-forno-atencao-texto")
            }
          >
            {medida.nivel === "critico" && (
              <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            {selo}
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Medidor contador={medida.contador} limite={medida.limite} atencao={medida.atencao} nivel={medida.nivel} />

        {/* Rodapé — quebra em duas linhas no celular em vez de estourar o cartão; nome do
            responsável (texto livre) quebra por palavra, nunca trunca. */}
        <p className="text-apoio text-muted-foreground break-words" data-testid={`rodape-forno-${forno.id}`}>
          {rodape}
        </p>

        <RegistrarQueima fornoId={forno.id} />
      </CardContent>
    </Card>
  );
}
