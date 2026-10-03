"use client";

import { useEffect, useRef, useState } from "react";

import { COMPRAS_A_MOSTRAR } from "@/lib/fornecedores/compras";
import {
  DICA_COMPRAS_DELE,
  FRASE_ERRO_CARREGAR_COMPRAS,
  FRASE_SEM_COMPRAS,
  TITULO_COMPRAS_DELE,
  fraseNenhumaDespesaNoAno,
  prefixoDoTotalDoAno,
  rotuloMostrarAsOutras,
  sufixoDoTotalDoAno,
} from "@/lib/fornecedores/textos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

// Uma compra como a linha a desenha — tudo já formatado pela ficha (Server Component): o título
// (`tituloDoDocumento`), o valor (`formatarReais` do `totalDasLinhas`) e a 2ª linha ("{dd/mm/aa} ·
// {Compra de material | Outra despesa} · {item}…"). Nada de `Date` nem de conta no cliente.
export type CompraNaFicha = {
  id: string;
  titulo: string;
  valor: string;
  meta: string;
};

// O total do ano corrente (D-03, UI-D13): o valor já formatado e quantas despesas do ano.
export type TotalDoAnoNaFicha = {
  ano: string;
  valor: string;
  quantidade: number;
};

const ID_DO_TITULO = "ficha-fornecedor-compras";

// O cabeçalho comum aos quatro estados (carregando, erro, vazio, com compras): "COMPRAS DELE" (caixa
// alta pelo CSS, o molde de "ANEXOS") + a dica, que desce para baixo quando não cabe ao lado.
function CabecalhoDasCompras() {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 id={ID_DO_TITULO} className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase">
        {TITULO_COMPRAS_DELE}
      </h3>
      <p className="text-apoio text-tinta-fraca">{DICA_COMPRAS_DELE}</p>
    </div>
  );
}

// A seção "Compras dele" da ficha (06.2-UI-SPEC.md §"Bloco Ficha", item 7; FRN-13, D-03, UI-D12,
// UI-D13): as despesas ligadas a este fornecedor, mais recentes primeiro (a ordem vem de
// `montarComprasDele`); as 10 primeiras à vista e "Mostrar as outras {N}" (`outline`) quando há mais; o
// total do ano corrente — ou "Nenhuma despesa em {ano} ainda." — e, sem nenhuma despesa, a frase vazia
// reescrita pela D-04. Componente de cliente só por causa do "Mostrar as outras".
//
// Cada linha: grade `1fr auto`, gap 8 — à esquerda o título (600, quebra livre) e a 2ª linha (Apoio,
// quebra livre); à direita o valor (600, `tabular-nums`, `whitespace-nowrap`), que a 320 px nunca
// quebra nem é empurrado para fora (UI E5·long-text/overflow).
export function ComprasDele({ compras, total }: { compras: CompraNaFicha[]; total: TotalDoAnoNaFicha }) {
  const [todas, setTodas] = useState(false);
  // Depois de "Mostrar as outras", o foco vai para a primeira linha que apareceu (o botão some). Só o
  // toque no botão liga `todas`, então o efeito nunca rouba o foco ao abrir a ficha.
  const primeiraNova = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (todas) {
      primeiraNova.current?.focus();
    }
  }, [todas]);

  const limite = COMPRAS_A_MOSTRAR;
  const visiveis = todas ? compras : compras.slice(0, limite);
  const escondidas = compras.length - visiveis.length;

  return (
    <section aria-labelledby={ID_DO_TITULO} data-testid="fornecedor-compras" className="flex flex-col gap-2">
      <CabecalhoDasCompras />

      {compras.length === 0 ? (
        <p data-testid="compras-vazio" className="text-corpo text-tinta-fraca">
          {FRASE_SEM_COMPRAS}
        </p>
      ) : (
        <>
          <ul data-testid="compras-dele" className="flex flex-col gap-2">
            {visiveis.map((compra, indice) => (
              <li
                key={compra.id}
                ref={indice === limite ? primeiraNova : undefined}
                tabIndex={indice === limite ? -1 : undefined}
                data-testid="compra-linha"
                data-documento-id={compra.id}
                className="border-borda grid min-h-[48px] grid-cols-[1fr_auto] items-start gap-2 rounded-lg border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p
                    data-testid="compra-titulo"
                    className="text-corpo text-tinta min-w-0 font-semibold [overflow-wrap:anywhere]"
                  >
                    {compra.titulo}
                  </p>
                  <p
                    data-testid="compra-meta"
                    className="text-apoio text-tinta-media min-w-0 tabular-nums [overflow-wrap:anywhere]"
                  >
                    {compra.meta}
                  </p>
                </div>
                <p data-testid="compra-valor" className="text-corpo text-tinta font-semibold whitespace-nowrap tabular-nums">
                  {compra.valor}
                </p>
              </li>
            ))}
          </ul>

          {escondidas > 0 ? (
            <Button
              type="button"
              variant="outline"
              data-testid="compras-mostrar-mais"
              onClick={() => setTodas(true)}
              className="text-corpo h-auto min-h-[44px] self-start px-4 font-semibold"
            >
              {rotuloMostrarAsOutras(escondidas)}
            </Button>
          ) : null}

          {total.quantidade > 0 ? (
            <p data-testid="compras-total" className="text-apoio text-tinta-media tabular-nums">
              {prefixoDoTotalDoAno(total.ano)}
              <span className="font-semibold">{total.valor}</span>
              {sufixoDoTotalDoAno(total.quantidade)}
            </p>
          ) : (
            <p data-testid="compras-total" className="text-apoio text-tinta-media">
              {fraseNenhumaDespesaNoAno(total.ano)}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// Carregando (o `Suspense` próprio da seção, dentro da ficha): o cabeçalho de verdade, 3 linhas de 48
// px e a linha do total — o resto da ficha já está na tela.
export function EsqueletoDasCompras() {
  return (
    <section
      aria-labelledby={ID_DO_TITULO}
      aria-busy="true"
      data-testid="compras-carregando"
      className="flex flex-col gap-2"
    >
      <CabecalhoDasCompras />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((linha) => (
          <Skeleton key={linha} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-5 w-56" />
    </section>
  );
}

// Erro de carregar, só na seção: a frase e "Tentar de novo" — a ficha (contatos, anexos) continua.
export function ComprasComErro() {
  return (
    <section aria-labelledby={ID_DO_TITULO} data-testid="compras-erro" className="flex flex-col gap-2">
      <CabecalhoDasCompras />
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-corpo text-tinta-media">{FRASE_ERRO_CARREGAR_COMPRAS}</p>
        <TentarDeNovo />
      </div>
    </section>
  );
}
