"use client";

import { Search } from "lucide-react";

import { ROTULO_AREA, type AreaFinanceira } from "@/lib/financeiro/textos";
import {
  PLACEHOLDER_BUSCA,
  ROTULO_BUSCA,
  ROTULO_FILTRAR_POR_AREA,
  ROTULO_PILULA_ACABANDO,
  ROTULO_PILULA_TUDO,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

import { PontoDaArea } from "./cartao-saldo";

export type BarraFerramentasSaldosProps = {
  busca: string;
  aoMudarBusca: (valor: string) => void;
  // Só as áreas com pelo menos um material, já na ordem fixa (`areasComMaterial`).
  areas: readonly AreaFinanceira[];
  area: AreaFinanceira | null;
  aoMudarArea: (valor: AreaFinanceira | null) => void;
  acabando: boolean;
  aoMudarAcabando: (valor: boolean) => void;
  // "{n} de {total} · {R$} em estoque" — já montado por `contadorDaLista`.
  contador: string;
};

// Pílula de filtro (UI-SPEC §Color, item 4): marcada = fundo `acento-fundo`, borda e texto `acento`
// (P5, 6,41:1), peso 600; desmarcada, peso 400 — o estado nunca depende só de cor. 44px.
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

// A barra de ferramentas da aba Saldos: busca (material OU categoria, sem acento), pílulas de área
// ("Tudo" + as áreas com material — D-12/EST-12, nunca a "frente" do protótipo), a pílula
// "Acabando", independente e combinável (UI-D7), e o contador. `flex-wrap` em tudo: a 320px as
// pílulas quebram linha, nunca rolam na horizontal (overflow E1). Componente burro — quem filtra é
// a `AbaSaldos`.
export function BarraFerramentasSaldos({
  busca,
  aoMudarBusca,
  areas,
  area,
  aoMudarArea,
  acabando,
  aoMudarAcabando,
  contador,
}: BarraFerramentasSaldosProps) {
  return (
    <div className="flex flex-col gap-3 min-[980px]:flex-row min-[980px]:flex-wrap min-[980px]:items-center">
      <div className="relative w-full min-[980px]:max-w-sm">
        <Search
          aria-hidden="true"
          className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <Input
          type="search"
          value={busca}
          onChange={(evento) => aoMudarBusca(evento.target.value)}
          placeholder={PLACEHOLDER_BUSCA}
          aria-label={ROTULO_BUSCA}
          data-testid="estoque-busca"
          className="text-corpo md:text-corpo bg-superficie min-h-[44px] pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={ROTULO_FILTRAR_POR_AREA} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={area === null}
            onClick={() => aoMudarArea(null)}
            data-testid="estoque-pilula-tudo"
            className={classeDaPilula(area === null)}
          >
            {ROTULO_PILULA_TUDO}
          </button>
          {areas.map((umaArea) => (
            <button
              key={umaArea}
              type="button"
              aria-pressed={area === umaArea}
              onClick={() => aoMudarArea(umaArea)}
              data-testid={`estoque-pilula-area-${umaArea}`}
              className={classeDaPilula(area === umaArea)}
            >
              <PontoDaArea area={umaArea} />
              {ROTULO_AREA[umaArea]}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={acabando}
          onClick={() => aoMudarAcabando(!acabando)}
          data-testid="estoque-pilula-acabando"
          className={classeDaPilula(acabando)}
        >
          {ROTULO_PILULA_ACABANDO}
        </button>
      </div>

      <p
        data-testid="estoque-contador"
        aria-live="polite"
        className="text-apoio text-tinta-fraca tabular-nums min-[980px]:ml-auto"
      >
        {contador}
      </p>
    </div>
  );
}
