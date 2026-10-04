"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { TETO_DO_CONTADOR, limitarContador, type Tamanho } from "@/lib/queimas/contagem";
import {
  ariaCampoDoContador,
  ariaPassoDoContador,
  type GrupoDoContador,
} from "@/lib/queimas/textos";

export type ContadorTamanhoProps = {
  grupo: GrupoDoContador;
  tamanho: Tamanho;
  // A faixa da régua VIGENTE ("até {p} cm"), montada pela folha (`faixasDaRegua`); sem faixa, só o tamanho.
  faixa?: string;
  valor: number;
  aoMudar: (valor: number) => void;
  desabilitado?: boolean;
  // Plano 04 (D-07). O PISO: a folha de contagem passa o já lançado em vendas ativas (as externas não
  // descem abaixo dele); padrão 0.
  minimo?: number;
  // O TETO: o passo de quantidade do "Recebi agora" passa o que falta naquele tamanho; padrão
  // `TETO_DO_CONTADOR`.
  maximo?: number;
  // O prefixo dos `data-testid` (o campo, `-menos`, `-mais`); padrão `contador-{grupo}-{tamanho}`.
  idDeTeste?: string;
  // Chamado ao SAIR do campo quando o número digitado ficou abaixo do `minimo` — o campo volta ao piso
  // e quem usa mostra a frase do porquê.
  aoFicarAbaixoDoMinimo?: () => void;
};

const CLASSE_DO_PASSO =
  "bg-superficie-2 text-tinta flex shrink-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5";

// Uma linha da folha "O que queimou?" (06.4-UI-SPEC.md §"Linha do contador"): à esquerda o tamanho
// (e a faixa da régua, quando vier); à direita o passo COLADO "−" · campo · "+", 48 px de altura —
// o controle que se toca repetidamente com a mão suja. O campo só aceita dígitos (`inputMode`
// numérico, `maxLength={5}`); enquanto se digita, vazio conta 0, e ao sair o campo volta a mostrar o
// número limitado (`limitarContador`: 0..10000, inteiro). Enter no campo não envia nada — a folha
// não é um formulário; "Salvar" é o único envio.
//
// Plano 04 (D-07): `minimo` e `maximo` estreitam a faixa — o "−" para no piso e o "+" no teto. Enquanto
// se digita, só o teto corta (um número abaixo do piso aparece como foi digitado); ao sair do campo o
// valor volta para dentro de [minimo, maximo] e, se estava abaixo do piso, `aoFicarAbaixoDoMinimo` é
// chamado. Sem as props novas, o componente é exatamente o do plano 01.
export function ContadorTamanho({
  grupo,
  tamanho,
  faixa,
  valor,
  aoMudar,
  desabilitado = false,
  minimo = 0,
  maximo = TETO_DO_CONTADOR,
  idDeTeste,
  aoFicarAbaixoDoMinimo,
}: ContadorTamanhoProps) {
  // Texto em edição: só existe enquanto o campo tem foco (para o vazio poder aparecer vazio).
  const [texto, setTexto] = useState<string | null>(null);
  const prefixo = idDeTeste ?? `contador-${grupo}-${tamanho.toLowerCase()}`;
  const piso = limitarContador(minimo);
  const teto = Math.max(piso, limitarContador(maximo));

  function noIntervalo(numero: number): number {
    return Math.min(teto, Math.max(piso, limitarContador(numero)));
  }

  return (
    <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-corpo text-tinta font-semibold">{tamanho}</span>
        {faixa ? <span className="text-apoio text-tinta-fraca">{faixa}</span> : null}
      </div>
      <div className="border-borda-forte flex overflow-hidden rounded-sm border">
        <button
          type="button"
          data-testid={`${prefixo}-menos`}
          aria-label={ariaPassoDoContador(grupo, tamanho, "menos")}
          disabled={desabilitado || valor <= piso}
          onClick={() => aoMudar(noIntervalo(valor - 1))}
          className={`size-12 ${CLASSE_DO_PASSO}`}
        >
          <Minus aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          data-testid={prefixo}
          aria-label={ariaCampoDoContador(grupo, tamanho)}
          disabled={desabilitado}
          value={texto ?? String(valor)}
          onFocus={(evento) => evento.currentTarget.select()}
          onChange={(evento) => {
            const digitos = evento.currentTarget.value.replace(/\D/g, "");
            setTexto(digitos);
            aoMudar(Math.min(teto, limitarContador(digitos === "" ? 0 : Number(digitos))));
          }}
          onBlur={() => {
            setTexto(null);
            if (valor < piso) {
              aoMudar(piso);
              aoFicarAbaixoDoMinimo?.();
            } else if (valor > teto) {
              aoMudar(teto);
            }
          }}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
            }
          }}
          className="border-borda-forte text-tinta text-corpo md:text-corpo h-12 w-14 border-x bg-transparent text-center font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-50"
        />
        <button
          type="button"
          data-testid={`${prefixo}-mais`}
          aria-label={ariaPassoDoContador(grupo, tamanho, "mais")}
          disabled={desabilitado || valor >= teto}
          onClick={() => aoMudar(noIntervalo(valor + 1))}
          className={`size-12 ${CLASSE_DO_PASSO}`}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
