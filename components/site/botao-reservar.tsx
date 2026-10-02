import { CONTEUDO_SITE, mensagemDeReserva } from "@/conteudo/site";
import { hrefDoWhatsapp } from "@/lib/site/whatsapp";

// "Reservar pelo WhatsApp" de um cartão de evento (AGE-18, D-10) — no molde de `BotaoWhatsapp`: o
// `href` sai só de `hrefDoWhatsapp` com o número de `CONTEUDO_SITE.zap` (D-17 da 04.6) e a mensagem
// do modelo `mensagemDeReserva` (`conteudo/site.ts`), nunca montada aqui. O site não reserva pela
// internet (§2.3 e §10 do briefing): o botão só abre a conversa.
type BotaoReservarProps = {
  nome: string;
  quando: string;
};

export function BotaoReservar({ nome, quando }: BotaoReservarProps) {
  const href = hrefDoWhatsapp(CONTEUDO_SITE.zap, mensagemDeReserva(nome, quando));

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      data-testid="site-reservar"
      className="mt-2 flex min-h-11 items-center justify-center self-start rounded-full bg-site-cerrado px-[18px] text-[15px] font-semibold text-white"
    >
      Reservar pelo WhatsApp
    </a>
  );
}
