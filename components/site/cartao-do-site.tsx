import type { CSSProperties } from "react";

import { ImagemDoSite } from "@/components/site/imagem-do-site";
import type { SlotDeImagem } from "@/conteudo/site";

// O cartão do protótipo (`.cartao`): reaproveitado por O espaço (com foto) e por Aulas e
// oficinas (só texto, Tarefa 2) — mesmo componente, cor e conteúdo diferentes por seção. A cor
// do marcador vem SEMPRE de um token do bloco `@theme` do site (D-19), nunca de um hex: `cor`
// recebe o NOME da variável CSS, e o componente só a referencia via `var(...)` em `style` —
// nunca escreve o valor hexadecimal por trás dela. `grep -rniE '#[0-9a-f]{6}'` sobre
// `components/site/` prova isso.
type CorDoCartaoDoSite =
  | "--color-site-barro-claro"
  | "--color-site-cerrado"
  | "--color-site-folha"
  | "--color-site-sol";

type CartaoDoSiteProps = {
  cor: CorDoCartaoDoSite;
  titulo: string;
  corpo: string;
  // Linha de apoio opcional, em negrito — usada pelas três chaves de preço sem número de O
  // espaço (D-18). A seção de Aulas e oficinas (Tarefa 2) não usa este slot.
  apoio?: string;
  // Slot de imagem opcional (D-20): O espaço usa foto (café, uso livre, loja); Aulas e
  // oficinas é só texto, sem `slot` — `ImagemDoSite` já resolve o caso de arquivo nulo, então
  // nada muda aqui se um dia um slot de foto desta seção ficar vazio.
  slot?: SlotDeImagem;
  testId?: string;
};

export function CartaoDoSite({ cor, titulo, corpo, apoio, slot, testId }: CartaoDoSiteProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-2.5 rounded-[14px] border border-site-borda bg-site-papel p-5"
    >
      {slot ? (
        <div className="relative -mx-1.5 -mt-1.5 mb-1 aspect-[3/2] overflow-hidden rounded-[10px]">
          <ImagemDoSite slot={slot} sizes="(min-width: 768px) 30vw, 90vw" />
        </div>
      ) : null}
      <h3 className="flex items-center gap-2.5 font-titulo-site text-[22px] font-semibold text-site-tinta">
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: `var(${cor})` } as CSSProperties}
        />
        {titulo}
      </h3>
      <p className="text-[15px] text-site-tinta-media">{corpo}</p>
      {apoio ? <p className="text-[15px] font-semibold text-site-tinta">{apoio}</p> : null}
    </div>
  );
}
