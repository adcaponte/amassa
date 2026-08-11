import { AlertTriangle } from "lucide-react";

import type { NivelDeForno } from "@/lib/queimas/contador";
import { fraseDoBanner, prefixoDoBanner } from "@/lib/queimas/textos";

export type FornoDoBanner = {
  nome: string;
  contador: number;
  limite: number;
  nivel: NivelDeForno;
};

export type BannerAtencaoProps = {
  fornos: readonly FornoDoBanner[];
};

// Banner agregado no topo de `/queimas` (E5, FOR-06) — sem análogo no repositório
// (04-PATTERNS.md "No Analog Found"). Server Component puro de apresentação: `fornos` já chega
// ORDENADO e FILTRADO (`ordenarParaBanner`, `lib/queimas/filtros.ts`) sobre a MESMA lista que
// alimenta os cartões do índice — nunca uma segunda consulta ao banco, para banner e cartões
// nunca discordarem entre si.
//
// N=0 → devolve `null`. Nenhuma faixa vazia, nenhum "0 fornos" — a AUSÊNCIA do banner é o sinal
// de que está tudo em dia (mesma disciplina de `EstadoVazio`: presença é a própria informação).
export function BannerAtencao({ fornos }: BannerAtencaoProps) {
  if (fornos.length === 0) {
    return null;
  }

  // O contêiner usa a cor do PIOR nível presente: crítico vence atenção — este vermelho
  // significa urgência de verdade (`04-DESIGN-SYSTEM.md` §3), e só ele leva o ícone de alerta.
  const temCritico = fornos.some((forno) => forno.nivel === "critico");

  const prefixo = prefixoDoBanner(fornos.length);
  const frase = fraseDoBanner(fornos);
  // `frase` sempre começa com `prefixo + " "` — `fraseDoBanner` monta a partir de
  // `prefixoDoBanner` internamente. Isolar o resto aqui é o que permite boldar só o prefixo sem
  // uma segunda redação da frase.
  const resto = frase.slice(prefixo.length);

  return (
    <div
      data-testid="banner-atencao"
      className={
        "mx-6 mt-6 flex items-start gap-2 rounded-lg border px-4 py-3 md:mx-8 " +
        (temCritico
          ? "border-forno-critico bg-forno-critico-fundo text-forno-critico-texto"
          : "border-forno-atencao bg-forno-atencao-fundo text-forno-atencao-texto")
      }
    >
      {temCritico && (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      {/* [overflow-wrap:anywhere]: nomes no limite de 80 caracteres do schema quebram por
          palavra — a truncagem em 3 fornos (`fraseDoBanner`) já mantém a altura previsível no
          celular (E5/long-text, backstop). */}
      <p className="text-apoio [overflow-wrap:anywhere]" data-testid="banner-atencao-texto">
        <strong className="font-semibold">{prefixo}</strong>
        {resto}
      </p>
    </div>
  );
}
