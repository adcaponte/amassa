"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Flame,
  Home,
  ListTodo,
  Package,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ehItemAtivo, ITENS_NAVEGACAO_LATERAL, type ChaveDeIcone } from "@/lib/navegacao/itens";
import { Logo } from "@/components/amassa/logo";
import { MenuUsuario } from "@/components/amassa/menu-usuario";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

// Mesmo mapa (e mesma exigência de `Record<ChaveDeIcone, LucideIcon>` completo) que
// `barra-inferior.tsx` — a chave nova entra nos DOIS arquivos no mesmo commit, ou o TypeScript
// recusa a build.
const ICONES: Record<ChaveDeIcone, LucideIcon> = {
  inicio: Home,
  encomendas: Package,
  financeiro: Wallet,
  agenda: CalendarDays,
  queimas: Flame,
  estoque: Archive,
  lembretes: ListTodo,
  cadastros: SlidersHorizontal,
};

// Barra lateral do desktop (>= 768px): fixa em 240px, nunca recolhe (D-12 — decisão
// consciente que simplifica a §5 da fonte, que sugeria recolhível). `collapsible="none"`
// desliga o comportamento padrão de colapso/cookie do componente Sidebar do shadcn; a
// largura vem da própria variável --sidebar-width que o SidebarProvider expõe. Itera
// ITENS_NAVEGACAO_LATERAL (8 itens desde a Fase 06.3, que pôs Lembretes; D-11 da Fase 04.6: Início
// mais TODOS os módulos, Cadastros incluído na 04.6) — diverge de ITENS_NAVEGACAO_CELULAR (4 itens)
// de propósito.
export type BarraLateralProps = {
  nome: string;
  className?: string;
};

export function BarraLateral({ nome, className }: BarraLateralProps) {
  const pathname = usePathname();

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "240px" } as CSSProperties}
      className={cn("hidden w-auto md:flex", className)}
    >
      <Sidebar collapsible="none" className="border-r border-sidebar-border">
        <SidebarHeader className="px-4 py-4">
          <Logo />
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarMenu>
            {ITENS_NAVEGACAO_LATERAL.map((item) => {
              const Icone = ICONES[item.icone];
              const ativo = ehItemAtivo(pathname, item.href);

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={ativo} size="lg">
                    <Link
                      href={item.href}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2",
                        ativo && "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      <Icone aria-hidden="true" className="size-5" />
                      <span>{item.rotulo}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="px-2 pb-2">
          <Separator className="mb-2" />
          <MenuUsuario nome={nome} variante="desktop" />
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
