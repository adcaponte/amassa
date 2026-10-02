import type { CartaoPublico } from "@/lib/agenda/publico/agenda";

import { BotaoReservar } from "@/components/site/botao-reservar";

// O cartão de evento do calendário do site (05-UI-SPEC.md §"Site — calendário público", item 4):
// título, quando, preço (D-10 — o único lugar do site com valor em dinheiro) e vagas, e o botão de
// reservar — que não existe quando está esgotado. Nada de pessoa: o `CartaoPublico` não tem campo
// para isso (lista branca testada em `tests/unit/agenda-publico.test.ts`).
const BORDA_DO_TIPO = {
  turma: "border-l-site-folha",
  oficina: "border-l-site-sol",
} as const;

function corDasVagas(cartao: CartaoPublico): string {
  if (cartao.esgotado) {
    return "text-site-barro-claro";
  }
  return cartao.restantes <= 2 ? "text-site-ambar" : "text-site-cerrado";
}

export function CartaoEventoSite({ cartao }: { cartao: CartaoPublico }) {
  const borda = cartao.esgotado ? "border-l-site-borda" : BORDA_DO_TIPO[cartao.tipo];

  return (
    <article
      data-testid="site-cartao-evento"
      data-tipo={cartao.tipo}
      className={`flex min-w-0 flex-col gap-1 rounded-[12px] border border-l-4 border-site-borda bg-site-papel p-4 ${borda}`}
    >
      <h3 className="font-titulo-site text-[22px] font-semibold break-words text-site-tinta">{cartao.titulo}</h3>
      <p className="text-site-tinta-media">{cartao.quando}</p>
      <p className="text-site-tinta-media">
        {cartao.precoTexto} · material incluso ·{" "}
        <span className={`font-semibold ${corDasVagas(cartao)}`}>{cartao.vagasTexto}</span>
      </p>
      {cartao.podeReservar ? <BotaoReservar nome={cartao.titulo} quando={cartao.quandoDaReserva} /> : null}
    </article>
  );
}
