import { CONTEUDO_SITE } from "@/conteudo/site";
import { BotaoWhatsapp } from "@/components/site/botao-whatsapp";

// O rodapé: a linha do ateliê, Instagram (link direto) e WhatsApp (pelo `BotaoWhatsapp`,
// mensagem "site" — a única mensagem que este plano exercita fora da abertura), e "quem somos"
// em tom menor. NENHUM link para a plataforma — nem discreto, nem em `title`, nem em comentário
// renderizado: acesso a ela é só por endereço (decisão do dono).
export function Rodape() {
  return (
    <footer
      data-testid="site-rodape"
      className="border-t border-site-borda px-4 py-8 text-center text-[13px] text-site-tinta-fraca"
    >
      <p>
        {CONTEUDO_SITE.rodape.linha} ·{" "}
        <a
          href={CONTEUDO_SITE.contato.instagramUrl}
          target="_blank"
          rel="noopener"
          className="text-site-tinta-fraca underline"
        >
          Instagram
        </a>{" "}
        · <BotaoWhatsapp mensagem="site" rotulo="WhatsApp" className="text-site-tinta-fraca underline" />
      </p>
      <p className="mt-1 opacity-70">{CONTEUDO_SITE.rodape.quemSomos}</p>
    </footer>
  );
}
