"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Flame,
  Home,
  Package,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ehItemAtivo, ITENS_NAVEGACAO_CELULAR, type ChaveDeIcone } from "@/lib/navegacao/itens";

// O mapa cobre as SETE chaves de ChaveDeIcone (inclusive "cadastros") mesmo esta barra só
// renderizando as quatro de ITENS_NAVEGACAO_CELULAR — é o mesmo mapa que BarraLateral usa, e
// `Record<ChaveDeIcone, LucideIcon>` exige as sete para o TypeScript aceitar sem `as`: esquecer
// uma chave nova aqui quebra a build em vez de renderizar item sem ícone.
const ICONES: Record<ChaveDeIcone, LucideIcon> = {
  inicio: Home,
  encomendas: Package,
  financeiro: Wallet,
  agenda: CalendarDays,
  queimas: Flame,
  estoque: Archive,
  cadastros: SlidersHorizontal,
};

// Barra fixa no rodapé do celular (< 768px) com exatamente os 4 itens de
// ITENS_NAVEGACAO_CELULAR (D-11/GES-12, Fase 04.6, substitui D-04 da Fase 04.4: Início ·
// Financeiro · Produção · Agenda) — Orçamentos nunca entra aqui (UI-04), e Queimas/Estoque/
// Cadastros continuam a um toque pela barra lateral e pelo Início, nunca por aqui. Cada item já
// tem rótulo visível, então nenhum precisa de aria-label próprio.
// pb-[env(safe-area-inset-bottom)] evita a faixa de gestos do iOS.
//
// A altura mínima de cada item lê `--altura-barra-inferior` (app/globals.css), o MESMO token
// que `app/(app)/layout.tsx` soma ao respiro inferior do `<main>` e ao deslocamento do aviso
// (toast) — achado da conferência do dono em 26/09/2026 (04.4-13-PLAN.md, Tarefa 1): o aviso
// com "Desfazer" aparecia embaralhado com esta barra no celular. Os três lugares compartilham
// o mesmo token de propósito: mudar a altura da barra aqui não pode reabrir aquele defeito.
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
              "flex min-h-[var(--altura-barra-inferior)] flex-1 flex-col items-center justify-center gap-0.5 text-nav",
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
