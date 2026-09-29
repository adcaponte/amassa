"use client";

import {
  previaDaMovimentacao,
  type EntradaDaPrevia,
  type TomDaPrevia,
} from "@/lib/estoque/saldo";
import { cn } from "@/lib/utils";

// A cor da caixa pelo tom da prévia (UI-SPEC §Color): acento (P6), acabando em âmbar (P1),
// negativo em vermelho (P4) e a neutra (P8). O texto diz tudo; a cor é a segunda pista.
const CLASSE_DO_TOM: Record<TomDaPrevia, string> = {
  acento: "bg-acento-fundo text-acento-hover border-acento-fundo",
  atencao: "bg-atencao-fundo text-atencao border-atencao-fundo",
  erro: "bg-erro-fundo text-erro border-erro-fundo",
  neutra: "bg-superficie-2 text-tinta-media border-borda",
};

// O rodapé da folha: "O saldo passa de X para Y" ANTES de gravar (D-11, §5 do adendo). É só uma
// LEITURA de `previaDaMovimentacao` (plano 06-05) — esta tela não recalcula saldo por conta
// própria; o servidor aplica a mesma regra ao saldo lido sob a trava, e o toast conta o que foi
// GRAVADO (T-06-54). Com o campo vazio, a frase neutra mantém a altura do rodapé estável: o botão
// "Registrar baixa" não pula de lugar entre o toque 2 e o 4 (UI-D8).
export function PreviaDoSaldo({ entrada }: { entrada: EntradaDaPrevia }) {
  const previa = previaDaMovimentacao(entrada);
  return (
    <p
      aria-live="polite"
      data-testid="folha-previa"
      data-tom={previa.tom}
      className={cn("text-apoio rounded-md border px-4 py-2", CLASSE_DO_TOM[previa.tom])}
    >
      {previa.partes.map((parte, indice) =>
        parte.forte ? (
          <b key={indice} className="font-semibold tabular-nums">
            {parte.texto}
          </b>
        ) : (
          <span key={indice}>{parte.texto}</span>
        ),
      )}
    </p>
  );
}
