"use client";

import Link from "next/link";

import type { AbaDoEstoque } from "@/lib/estoque/abas";
import {
  ROTULO_ABA_DESTINO,
  ROTULO_ABA_HISTORICO,
  ROTULO_ABA_SALDOS,
  ROTULO_BARRA_DE_ABAS,
} from "@/lib/estoque/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";

// As três abas do protótipo (D-11), na ordem dele. Rótulos fixos e curtos (UI · long-text · E12).
const ABAS: readonly { valor: AbaDoEstoque; rotulo: string }[] = [
  { valor: "saldos", rotulo: ROTULO_ABA_SALDOS },
  { valor: "historico", rotulo: ROTULO_ABA_HISTORICO },
  { valor: "destino", rotulo: ROTULO_ABA_DESTINO },
];

// Cópia estrutural de `financeiro/abas-financeiro.tsx`: pílulas NEUTRAS (UI-D1 — o terracota da
// tela é do "Registrar movimentação"; a aba marcada é `bg-background font-semibold shadow-sm`, nunca
// a cor de ação), papel de lista de abas com o nome "Ver", cada aba um `<Link>` de verdade para a
// MESMA rota com `?aba=` — navegação que o botão de voltar do navegador entende.
//
// `min-w-0` + `break-words`: a 320px cada pílula tem ~88px e "Para onde foi" quebra em duas linhas —
// permitido; nunca reticências, nunca rolagem horizontal (regra da 04.4). 44px de alvo. Peso 400
// desmarcada e 600 marcada (UI-SPEC §Typography: o 500 do protótipo não entra) — o estado nunca
// depende só da cor.
const CLASSE_DA_PILULA =
  "text-corpo flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center break-words transition-colors";

export function AbasEstoque({ abaAtual }: { abaAtual: AbaDoEstoque }) {
  return (
    <div
      role="tablist"
      aria-label={ROTULO_BARRA_DE_ABAS}
      data-testid="estoque-abas"
      className="bg-muted mx-6 flex gap-1 rounded-md p-1 md:mx-8 md:max-w-md"
    >
      {ABAS.map((aba) => {
        const selecionada = aba.valor === abaAtual;
        return (
          <Link
            key={aba.valor}
            href={rotaDeGestao(`/estoque?aba=${aba.valor}`)}
            role="tab"
            aria-selected={selecionada}
            data-testid={`estoque-aba-${aba.valor}`}
            className={cn(
              CLASSE_DA_PILULA,
              selecionada
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground font-normal",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
