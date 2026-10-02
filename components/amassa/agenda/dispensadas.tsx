"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { definirDispensa } from "@/lib/agenda/acoes";
import type { DispensadaCarregada, DispensadasCarregadas } from "@/lib/agenda/consultas";
import { DISPENSADAS_POR_VEZ } from "@/lib/agenda/receber";
import {
  ARIA_LISTA_DISPENSADAS,
  ariaDesfazerDispensa,
  FRASE_FALHA_AO_DESFAZER_DISPENSA,
  linhaDispensada,
  ROTULO_DESFAZENDO,
  ROTULO_DESFAZER,
  ROTULO_MOSTRAR_MAIS_DISPENSADAS,
  subLinhaDispensada,
  TOAST_DISPENSA_DESFEITA,
  tituloDispensadas,
} from "@/lib/agenda/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";

export type DispensadasProps = {
  dados: DispensadasCarregadas;
  // Quantas a página pediu (`?dispensadas=`, 20 por vez).
  quantas: number;
};

// “Dispensadas ({N})” no fim de “A receber” (D-09, UI-D15; 05-UI-SPEC.md §“Aba A receber”, item 4, e
// §“Lote e A receber — linhas de leitura”, “Dispensadas — linha”): uma sanfona (`<details>`) FECHADA, que
// só aparece com N > 0 (§Estados vazios). As mais recentes primeiro, 20 por vez — “Mostrar mais 20” pede
// a página de novo com `?dispensadas=` (o padrão de “Mostrar mais 50” de Pessoas, UI-D23), e a sanfona já
// vem aberta quando a pessoa pediu mais. Cada linha: “{nome} · {descrição}” + “dispensada por {quem} em
// {dd/mm}” + “ · {motivo}” e “Desfazer” (`outline`, 44px).
export function Dispensadas({ dados, quantas }: DispensadasProps) {
  if (dados.total === 0) {
    return null;
  }
  const haMais = dados.linhas.length < dados.total;
  return (
    <details
      data-testid="dispensadas"
      open={quantas > DISPENSADAS_POR_VEZ ? true : undefined}
      className="border-border rounded-md border px-4 py-2"
    >
      <summary
        data-testid="dispensadas-resumo"
        className="text-apoio text-tinta focus-visible:ring-ring flex min-h-[44px] cursor-pointer items-center rounded-md font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {tituloDispensadas(dados.total)}
      </summary>
      <ul
        aria-label={ARIA_LISTA_DISPENSADAS}
        className="divide-border flex flex-col divide-y"
      >
        {dados.linhas.map((linha) => (
          <LinhaDispensada key={`${linha.tipo}:${linha.id}`} linha={linha} />
        ))}
      </ul>
      {haMais ? (
        <Button asChild variant="outline" className="text-corpo my-2 min-h-[44px] px-4">
          <Link
            data-testid="dispensadas-mais"
            href={rotaDeGestao(
              `/agenda?aba=receber&dispensadas=${quantas + DISPENSADAS_POR_VEZ}`,
            )}
            scroll={false}
          >
            {ROTULO_MOSTRAR_MAIS_DISPENSADAS}
          </Link>
        </Button>
      ) : null}
    </details>
  );
}

// Uma linha de “Dispensadas”. “Desfazer” manda `dispensada: false` (estado desejado); em voo,
// “Desfazendo…” com `disabled`, e o `useRef` barra o segundo toque. A falha aparece embaixo da linha.
function LinhaDispensada({ linha }: { linha: DispensadaCarregada }) {
  const emVoo = useRef(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function desfazer() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setDesfazendo(true);
    setErro(null);
    try {
      const resposta = await definirDispensa({
        tipo: linha.tipo,
        id: linha.id,
        dispensada: false,
      });
      if (!resposta.ok) {
        setErro(FRASE_FALHA_AO_DESFAZER_DISPENSA);
        return;
      }
      toast.success(TOAST_DISPENSA_DESFEITA);
    } catch {
      setErro(FRASE_FALHA_AO_DESFAZER_DISPENSA);
    } finally {
      emVoo.current = false;
      setDesfazendo(false);
    }
  }

  return (
    <li
      data-testid="dispensada-linha"
      data-tipo={linha.tipo}
      data-id={linha.id}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2"
    >
      <div className="flex min-w-0 flex-col">
        <span
          data-testid="dispensada-titulo"
          className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]"
        >
          {linhaDispensada(linha.nome, linha.descricao)}
        </span>
        <span
          data-testid="dispensada-sub"
          className="text-apoio text-tinta-media [overflow-wrap:anywhere]"
        >
          {subLinhaDispensada(linha.quem, linha.diaMes, linha.motivo)}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        data-testid="desfazer-dispensa"
        aria-label={ariaDesfazerDispensa(linha.descricao, linha.nome)}
        disabled={desfazendo}
        aria-busy={desfazendo ? "true" : undefined}
        onClick={() => void desfazer()}
        className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
      >
        {desfazendo ? ROTULO_DESFAZENDO : ROTULO_DESFAZER}
      </Button>
      {erro !== null ? (
        <p
          role="alert"
          data-testid="desfazer-dispensa-erro"
          className="text-apoio text-erro col-span-2"
        >
          {erro}
        </p>
      ) : null}
    </li>
  );
}
