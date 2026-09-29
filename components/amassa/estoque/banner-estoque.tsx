"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { resumoDoBanner, type SaldoParaLista } from "@/lib/estoque/saldo";
import { ROTULO_VER_SO_ESSES } from "@/lib/estoque/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { formatarMilesimos } from "./cartao-saldo";
import { useEstoque } from "./provedor-estoque";

export type BannerEstoqueProps = {
  // A MESMA lista da seção de saldos (nunca uma segunda consulta): banner e cartões não discordam.
  saldos: readonly SaldoParaLista[];
  aoVerSoEsses: () => void;
};

// Banner de alerta da página do Estoque (UI-SPEC §Layout, item 2) — a disciplina de
// `queimas/banner-atencao.tsx`: nenhum alerta → `null`; a ausência é a informação. Quem decide
// quem entra é `resumoDoBanner` (lib/estoque/saldo.ts), nunca este componente.
//
// Carregando ou com erro, ele simplesmente não existe: desde o plano 06-07 ele mora ACIMA das abas
// (`BannerDoEstoque`, abaixo) e é derivado da lista que o provedor recebeu — a da aba Saldos ou a do
// `CarregadorDoSeletor` nas outras abas, a MESMA consulta em `cache` da requisição. Sem esqueleto
// próprio, sem mensagem própria.
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

// O banner da página, acima das abas (UI-SPEC §Layout, itens 2 e 3): lê a lista do provedor e só
// existe quando ela chegou — `null` enquanto carrega ou quando falhou (UI · loading/error · E2).
// "Ver só esses" liga a pílula "Acabando" da aba Saldos, se ela estiver montada; nas outras abas,
// leva a `?aba=saldos&acabando=1`, que monta a aba Saldos já com a pílula ligada.
export function BannerDoEstoque() {
  const { lista, verSoAcabando } = useEstoque();
  const router = useRouter();

  if (lista.estado !== "pronta") {
    return null;
  }

  function aoVerSoEsses() {
    if (!verSoAcabando()) {
      router.push(rotaDeGestao("/estoque?aba=saldos&acabando=1"));
    }
  }

  return <BannerEstoque saldos={lista.saldos} aoVerSoEsses={aoVerSoEsses} />;
}
