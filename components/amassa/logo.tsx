import { cn } from "@/lib/utils";

// Componente de servidor — sem "use client". Renderiza a palavra "AMASSA" em Archivo Narrow
// enquanto o dono não exporta o SVG da Vinila Condensed do mídia kit (D-13). Nenhuma
// aproximação da Vinila é desenhada em curvas — quando o SVG chegar, ele entra AQUI, como
// conteúdo interno deste componente, sem mudar onde `Logo` é usado (barra lateral, login).
export type LogoProps = {
  como?: "h1" | "span";
  className?: string;
};

export function Logo({ como = "span", className }: LogoProps) {
  const Elemento = como;

  return (
    <Elemento className={cn("font-titulo text-foreground font-bold", className)}>
      AMASSA
    </Elemento>
  );
}
