import type { ReactNode } from "react";

// O único lugar do site que sabe posicionar âncora (SIT-05). `scroll-margin-top` vem SEMPRE de
// `--altura-barra-site` — a MESMA propriedade que dá o `padding-top` do corpo da página
// (`app/page.tsx`). Separar essas duas origens em dois números é o defeito que SIT-05 existe
// para prevenir: a âncora voltaria a parar atrás da barra fixa assim que os dois valores
// divergissem, mesmo que só por um pixel.
type SecaoProps = {
  id: string;
  children: ReactNode;
  // Slot opcional para a arte decorativa (`Decoracao`) — posicionada atrás do conteúdo
  // (`z-0`), nunca à frente. Usado a partir do plano 04 (`#espaco`, `#agenda`, `#encomendas`,
  // `#onde`).
  decoracao?: ReactNode;
  className?: string;
  // `data-testid` de cada seção pública (`site-espaco`, `site-agenda`, `site-encomendas`,
  // `site-onde` — plano 04): passa direto para o `<section>`, nunca para a `div` interna, para
  // o e2e localizar a seção inteira (inclusive a arte decorativa) por um seletor só.
  testId?: string;
};

export function Secao({ id, children, decoracao, className, testId }: SecaoProps) {
  return (
    <section
      id={id}
      data-testid={testId}
      className={`relative overflow-hidden scroll-mt-[var(--altura-barra-site)] py-14 md:py-22 ${className ?? ""}`}
    >
      {decoracao}
      <div className="relative z-10 mx-auto max-w-[1080px] px-4">{children}</div>
    </section>
  );
}
