"use client";

import { useState } from "react";
import Link from "next/link";

import type {
  LembreteDaTela,
  LembretesDoInicio,
  PessoaDaCasa,
} from "@/lib/lembretes/consultas";
import { resumoDoInicio } from "@/lib/lembretes/lista";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import {
  FRASE_NADA_PARA_FAZER,
  TITULO_PARA_FAZER,
  textoEMaisN,
} from "@/lib/lembretes/textos";

import { LinhaDeCriar } from "./linha-de-criar";
import { LinhaLembrete } from "./linha-lembrete";

export type ListaDoInicioProps = {
  // O objeto inteiro de `lerLembretesDoInicio()` — os planos 03 e 04 acrescentam campos a ele sem
  // mexer na assinatura do bloco.
  inicio: LembretesDoInicio;
  // O dia civil de Brasília, da PÁGINA (`hojeEmBrasilia`, o mesmo instante da saudação). Nenhum
  // componente desta pasta lê o relógio para decidir vencido/hoje/amanhã.
  hoje: string;
  // As pessoas ATIVAS, na ordem de cadastro (`listarPessoasDaCasa`): as pílulas da linha de criar e
  // a cor dos chips (pela posição, UI-D2).
  pessoas: readonly PessoaDaCasa[];
};

// A coluna "Para fazer" do Início (Fase 06.3). Plano 01 (o traçador): a linha de criar e a lista
// dos abertos. Plano 03: o título com a contagem ao lado (desenhado AQUI, no cliente, porque a
// contagem muda com os toques), a linha de criar completa (`LinhaDeCriar`, com data e pessoa), no
// máximo 6 abertos na ordem do briefing, "e mais N — ver todos" e a frase do vazio — tudo de
// `resumoDoInicio` (puro, `lib/lembretes/lista.ts`) sobre o estado local. A caixa de feito, editar,
// excluir e os feitos são do plano 04.
//
// O resultado de um toque NUNCA espera o redesenho do servidor: a re-renderização depois de uma
// Server Action às vezes não chega à tela (debug da Abertura, ~54% medido). A lista mora num estado
// local, semeado das props e re-semeado quando o servidor manda props novas (o padrão do React de
// guardar a prop anterior no estado e comparar durante a renderização — sem efeito). Nenhum
// refresh do roteador depois da ação (molde `caixa-marcacao.tsx`): `criarLembrete` já revalida.
export function ListaDoInicio({ inicio, hoje, pessoas }: ListaDoInicioProps) {
  const [inicioAnterior, setInicioAnterior] = useState(inicio);
  const [abertos, setAbertos] = useState<LembreteDaTela[]>(inicio.abertos);
  if (inicio !== inicioAnterior) {
    setInicioAnterior(inicio);
    setAbertos(inicio.abertos);
  }

  // Uma criação entra no estado local na hora; a posição sai de `resumoDoInicio` (que ordena por
  // `compararAbertos`, a mesma ordem do SQL) — sem esperar o servidor.
  function aoCriar(novo: LembreteDaTela) {
    setAbertos((atuais) => [
      ...atuais.filter((lembrete) => lembrete.id !== novo.id),
      novo,
    ]);
  }

  const { visiveis, restantes, contagem } = resumoDoInicio(abertos, hoje);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-apoio text-muted-foreground font-semibold tracking-[0.05em] uppercase">
          {TITULO_PARA_FAZER}
        </h3>
        <span
          data-testid="lembretes-contagem"
          aria-live="polite"
          className="text-apoio text-tinta-fraca font-normal tabular-nums"
        >
          {contagem}
        </span>
      </div>

      <LinhaDeCriar pessoas={pessoas} aoCriar={aoCriar} />

      {visiveis.length > 0 ? (
        <ul data-testid="lembretes-lista" className="flex flex-col gap-1">
          {visiveis.map((lembrete) => (
            <LinhaLembrete
              key={lembrete.id}
              lembrete={lembrete}
              hoje={hoje}
              pessoas={pessoas}
            />
          ))}
        </ul>
      ) : (
        <p
          data-testid="lembretes-vazio"
          className="text-apoio text-tinta-fraca border-borda rounded-md border border-dashed p-4"
        >
          {FRASE_NADA_PARA_FAZER}
        </p>
      )}

      {restantes > 0 && (
        <Link
          href={rotaDeGestao("/lembretes")}
          data-testid="lembretes-mais"
          className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center self-start rounded-md font-normal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {textoEMaisN(restantes)}
        </Link>
      )}
    </div>
  );
}
