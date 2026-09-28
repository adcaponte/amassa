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
  // (`z-0`), nunca à frente. Nenhuma seção deste plano usa isto ainda; o plano 04 é quem
  // preenche `#espaco`, `#agenda`, `#encomendas` e `#onde`.
  decoracao?: ReactNode;
  className?: string;
};

export function Secao({ id, children, decoracao, className }: SecaoProps) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden scroll-mt-[var(--altura-barra-site)] py-14 md:py-22 ${className ?? ""}`}
    >
      {decoracao}
      <div className="relative z-10 mx-auto max-w-[1080px] px-4">{children}</div>
    </section>
  );
}
