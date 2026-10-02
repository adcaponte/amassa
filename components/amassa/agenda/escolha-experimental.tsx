"use client";

import { useId, useRef, type KeyboardEvent } from "react";

import type { SugestaoDaAula } from "@/lib/agenda/consultas";
import { nomeDoMes } from "@/lib/agenda/semana";
import {
  ARIA_ESTA_AULA_E_COBRADA,
  dicaSugestaoDaAula,
  FRASE_EXPERIMENTAL_SEM_ESCOLHA,
  ROTULO_COBRAR,
  ROTULO_GRATUITA,
  ROTULO_VALOR_DESTA_AULA,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// 8000 → "80,00" — inteiro, sem ponto flutuante (o mesmo jeito da folha da turma).
export function centavosParaCampo(centavos: number): string {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`;
}

const OPCOES = [
  { valor: true, rotulo: ROTULO_COBRAR, testId: "escolha-cobrar" },
  { valor: false, rotulo: ROTULO_GRATUITA, testId: "escolha-gratuita" },
] as const;

export type EscolhaExperimentalProps = {
  // `null` = nada escolhido ainda (UI-D6, confirmada pelo dono: nenhum padrão marcado).
  cobrar: boolean | null;
  aoEscolher: (cobrar: boolean) => void;
  valor: string;
  aoMudarValor: (valor: string) => void;
  // A sugestão que o servidor calculou (mensalidade ÷ aulas do mês) — `null` sem aula para dividir.
  sugestao: SugestaoDaAula | null;
  erroDoValor: string | null;
  desabilitado: boolean;
  // O id da frase "Diga se esta aula é cobrada ou gratuita." — o botão "Colocar na lista" a cita como
  // `aria-describedby` enquanto está desabilitado.
  idDaFraseSemEscolha: string;
};

// A pergunta da aula experimental (D-07; 05-UI-SPEC.md §"Seletor de pessoa" — Escolhida experimental):
// o segmentado "Cobrar · Gratuita" (`radiogroup`, 52px, setas movem a escolha) que nasce SEM nada
// marcado — um padrão marcado viraria cobrança (ou gratuidade) por descuido (UI-D6). Em "Cobrar", o
// campo "Valor desta aula (R$)" já vem com o valor de uma aula e a dica de onde ele saiu; é editável —
// o que vale é o que o servidor converte em centavos inteiros ao gravar.
export function EscolhaExperimental({
  cobrar,
  aoEscolher,
  valor,
  aoMudarValor,
  sugestao,
  erroDoValor,
  desabilitado,
  idDaFraseSemEscolha,
}: EscolhaExperimentalProps) {
  const idBase = useId();
  const idDoCampo = `${idBase}-valor`;
  const idDaDica = `${idBase}-dica`;
  const idDoErro = `${idBase}-erro`;
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown"
        ? 1
        : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) {
      return;
    }
    evento.preventDefault();
    const indice = cobrar === null ? (passo === 1 ? -1 : 0) : OPCOES.findIndex((opcao) => opcao.valor === cobrar);
    const nova = OPCOES[(indice + passo + OPCOES.length) % OPCOES.length];
    aoEscolher(nova.valor);
    botoes.current[String(nova.valor)]?.focus();
  }

  return (
    <div className="flex flex-col gap-3" data-testid="escolha-experimental">
      <div role="radiogroup" aria-label={ARIA_ESTA_AULA_E_COBRADA} className="grid grid-cols-2 gap-2">
        {OPCOES.map((opcao, indice) => {
          const marcado = cobrar === opcao.valor;
          // Sem escolha, o primeiro recebe o foco do Tab (o grupo continua alcançável pelo teclado).
          const alcancavel = cobrar === null ? indice === 0 : marcado;
          return (
            <button
              key={opcao.testId}
              ref={(elemento) => {
                botoes.current[String(opcao.valor)] = elemento;
              }}
              type="button"
              role="radio"
              aria-checked={marcado}
              tabIndex={alcancavel ? 0 : -1}
              disabled={desabilitado}
              data-testid={opcao.testId}
              onClick={() => aoEscolher(opcao.valor)}
              onKeyDown={aoTeclar}
              className={cn(
                "text-corpo min-h-[52px] rounded-md border px-2 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                marcado ? "bg-acento border-acento text-white" : "bg-superficie border-borda-forte text-tinta-media",
              )}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {cobrar === null ? (
        <p id={idDaFraseSemEscolha} data-testid="escolha-sem-escolha" className="text-apoio text-tinta-fraca">
          {FRASE_EXPERIMENTAL_SEM_ESCOLHA}
        </p>
      ) : null}

      {cobrar === true ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={idDoCampo} className="text-apoio text-tinta font-semibold">
            {ROTULO_VALOR_DESTA_AULA}
          </label>
          <Input
            id={idDoCampo}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            data-testid="valor-da-aula"
            value={valor}
            disabled={desabilitado}
            aria-invalid={erroDoValor !== null ? "true" : undefined}
            aria-describedby={[sugestao !== null ? idDaDica : null, erroDoValor !== null ? idDoErro : null]
              .filter((id) => id !== null)
              .join(" ") || undefined}
            onChange={(evento) => aoMudarValor(evento.target.value)}
            className="text-corpo md:text-corpo bg-superficie min-h-[44px] w-40"
          />
          {sugestao !== null ? (
            <p id={idDaDica} data-testid="valor-da-aula-dica" className="text-apoio text-tinta-fraca">
              {dicaSugestaoDaAula(formatarReais(sugestao.mensalidadeCentavos), sugestao.aulas, nomeDoMes(sugestao.mes))}
            </p>
          ) : null}
          {erroDoValor !== null ? (
            <p id={idDoErro} role="alert" data-testid="valor-da-aula-erro" className="text-apoio text-erro">
              {erroDoValor}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
