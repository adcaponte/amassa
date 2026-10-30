import { MARCA } from "@/conteudo/marca";
import { cn } from "@/lib/utils";

// Componente de servidor — sem "use client". A logo da marca é, por enquanto, a PALAVRA
// `MARCA.nomeCurto` em Archivo Narrow negrito (`font-titulo font-bold`), até a arte nova chegar
// (quick 261030-n01, 30/10/2026; briefing da troca de nome §2.4). Até essa data este arquivo
// desenhava o SVG vetorizado da marca anterior; ele saiu do código e fica no histórico do git
// (commit 90ca3f2). Antes do SVG já tinha sido texto assim (commit 08d299e).
//
// Quando o SVG/PNG novo do dono chegar, ele entra AQUI, como conteúdo deste componente, sem mexer
// em quem o usa: a barra lateral, o cartão de login (`como="h1"`, `className="text-4xl"`), a folha
// da Produção e a barra superior do site público (`className="text-site-tinta"`). Uma imagem que
// substitua o texto precisa manter o nome acessível — `role="img"` + `aria-label={MARCA.nomeCurto}`
// —, porque `getByRole("heading", { name: MARCA.nomeCurto })` (tests/e2e/fundacao.spec.ts) depende
// dele quando a Logo é o `h1` do login. Com texto, o nome acessível é o próprio texto.
//
// `text-foreground` é a cor padrão; `className` sobrescreve (o `cn()` deixa a última cor vencer).
export type LogoProps = {
  como?: "h1" | "span";
  className?: string;
};

export function Logo({ como = "span", className }: LogoProps) {
  const Elemento = como;

  return (
    <Elemento className={cn("font-titulo text-foreground font-bold", className)}>
      {MARCA.nomeCurto}
    </Elemento>
  );
}
