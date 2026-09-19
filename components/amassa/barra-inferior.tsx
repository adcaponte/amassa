"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, CalendarDays, Flame, Home, Package, Wallet, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ehItemAtivo, ITENS_NAVEGACAO_CELULAR, type ChaveDeIcone } from "@/lib/navegacao/itens";

// O mapa cobre as SEIS chaves de ChaveDeIcone (inclusive "estoque") mesmo esta barra só
// renderizando as cinco de ITENS_NAVEGACAO_CELULAR — é o mesmo mapa que BarraLateral usa, e
// `Record<ChaveDeIcone, LucideIcon>` exige as seis para o TypeScript aceitar sem `as`.
const ICONES: Record<ChaveDeIcone, LucideIcon> = {
  inicio: Home,
  encomendas: Package,
  financeiro: Wallet,
  agenda: CalendarDays,
  queimas: Flame,
  estoque: Archive,
};

// Barra fixa no rodapé do celular (< 768px) com exatamente os 5 itens de
// ITENS_NAVEGACAO_CELULAR (D-04, Fase 04.4: Financeiro entrou, Estoque saiu daqui) —
// Orçamentos nunca entra aqui (UI-04). Cada item já tem rótulo visível, então nenhum precisa
// de aria-label próprio. pb-[env(safe-area-inset-bottom)] evita a faixa de gestos do iOS.
export type BarraInferiorProps = {
  className?: string;
};

export function BarraInferior({ className }: BarraInferiorProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden",
        className,
      )}
    >
      {ITENS_NAVEGACAO_CELULAR.map((item) => {
        const Icone = ICONES[item.icone];
        const ativo = ehItemAtivo(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-nav",
              ativo ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icone aria-hidden="true" className="size-6" />
            <span>{item.rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
