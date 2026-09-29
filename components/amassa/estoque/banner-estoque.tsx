"use client";

import { AlertTriangle } from "lucide-react";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { resumoDoBanner, type SaldoParaLista } from "@/lib/estoque/saldo";
import { ROTULO_VER_SO_ESSES } from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { formatarMilesimos } from "./cartao-saldo";

export type BannerEstoqueProps = {
  // A MESMA lista da seção de saldos (nunca uma segunda consulta): banner e cartões não discordam.
  saldos: readonly SaldoParaLista[];
  aoVerSoEsses: () => void;
};

// Banner de alerta da página do Estoque (UI-SPEC §Layout, item 2) — a disciplina de
// `queimas/banner-atencao.tsx`: nenhum alerta → `null`; a ausência é a informação. Quem decide
// quem entra é `resumoDoBanner` (lib/estoque/saldo.ts), nunca este componente.
//
// Carregando ou com erro, ele simplesmente não existe: é renderizado pela `AbaSaldos`, que só
// monta depois que `listarSaldos` respondeu — sem esqueleto próprio, sem mensagem própria.
//
// Cores: fundo `atencao-fundo`, borda e texto `atencao` (P1, 4,51:1); título só-negativos e a linha
// "Com saldo negativo" em `erro` sobre `atencao-fundo` (P16, 5,81:1). Nenhum hex do protótipo.
export function BannerEstoque({ saldos, aoVerSoEsses }: BannerEstoqueProps) {
  const resumo = resumoDoBanner(saldos, (milesimos, unidade) => {
    return `${formatarMilesimos(milesimos)} ${ROTULO_UNIDADE[unidade]}`;
  });

  if (resumo === null) {
    return null;
  }

  const emErro = resumo.tom === "erro";

  return (
    <section
      aria-label="Alertas do estoque"
      data-testid="estoque-banner"
      className="border-atencao bg-atencao-fundo text-atencao mx-6 mt-6 flex items-start gap-2 rounded-lg border p-4 md:mx-8"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          data-testid="estoque-banner-titulo"
          className={cn("text-corpo font-semibold", emErro ? "text-erro" : "text-atencao")}
        >
          {resumo.titulo}
        </p>
        <p
          data-testid="estoque-banner-nomes"
          className={cn("text-apoio [overflow-wrap:anywhere]", emErro && "text-erro")}
        >
          {resumo.nomes}
        </p>
        {resumo.linhaNegativos ? (
          <p
            data-testid="estoque-banner-negativos"
            className="text-apoio text-erro font-semibold [overflow-wrap:anywhere]"
          >
            {resumo.linhaNegativos}
          </p>
        ) : null}
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            data-testid="estoque-banner-ver"
            onClick={aoVerSoEsses}
            className="border-atencao text-atencao hover:bg-superficie hover:text-atencao text-corpo min-h-[44px] bg-transparent px-4 font-semibold"
          >
            {ROTULO_VER_SO_ESSES}
          </Button>
        </div>
      </div>
    </section>
  );
}
