"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROTULO_FORNOS, ROTULO_RELATORIOS } from "@/lib/queimas/textos";

// D-01: rotas de verdade com um seletor no topo que PARECE aba mas NAVEGA — `Link` de verdade
// para `/queimas` e `/queimas/relatorios`, nunca alternância por estado de cliente (o botão
// voltar do celular precisa funcionar de verdade, cada tela com endereço próprio). Montado nas
// três telas do módulo (`/queimas`, `/queimas/[id]`, `/queimas/relatorios`) logo abaixo de
// `CabecalhoPagina`. "Fornos" fica ativo tanto no índice quanto no detalhe de um forno — as duas
// são a mesma seção, só "Relatórios" é a outra.
//
// "Relatórios" permanece VISÍVEL e alcançável mesmo sem nenhuma queima registrada (D-08) — um
// controle que aparece e some é mais difícil de aprender que um sempre presente, mesma razão do
// botão de imprimir da Fase 3.
type ItemDoSeletor = {
  rotulo: string;
  href: "/queimas" | "/queimas/relatorios";
  testId: string;
  ativo: (pathname: string) => boolean;
};

const ITENS: readonly ItemDoSeletor[] = [
  {
    rotulo: ROTULO_FORNOS,
    href: "/queimas",
    testId: "fornos",
    ativo: (pathname) => !pathname.startsWith("/queimas/relatorios"),
  },
  {
    rotulo: ROTULO_RELATORIOS,
    href: "/queimas/relatorios",
    testId: "relatorios",
    ativo: (pathname) => pathname.startsWith("/queimas/relatorios"),
  },
];

export function SeletorQueimas() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções de Queimas"
      className="flex gap-1 border-b border-border px-6 md:px-8"
      data-testid="seletor-queimas"
    >
      {ITENS.map((item) => {
        const ativo = item.ativo(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            data-testid={`seletor-queimas-${item.testId}`}
            className={
              "text-apoio focus-visible:ring-ring flex min-h-[44px] items-center border-b-2 px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none " +
              (ativo
                ? "border-acento text-acento font-semibold"
                : "border-transparent font-medium text-tinta-fraca hover:text-tinta")
            }
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
