import { CONTEUDO_SITE, MENSAGENS_DO_WHATSAPP, type ChaveDeMensagemDoWhatsapp } from "@/conteudo/site";
import { hrefDoWhatsapp } from "@/lib/site/whatsapp";

// A ÚNICA porta para um botão do site chegar ao link de WhatsApp (D-17): o `href` sai só de
// `hrefDoWhatsapp`, nunca montado à mão aqui. `mensagem` é uma das quatro chaves nomeadas de
// `MENSAGENS_DO_WHATSAPP` — nenhum componente do site passa uma string solta.
type BotaoWhatsappProps = {
  mensagem: ChaveDeMensagemDoWhatsapp;
  rotulo: string;
  className?: string;
};

export function BotaoWhatsapp({ mensagem, rotulo, className }: BotaoWhatsappProps) {
  const href = hrefDoWhatsapp(CONTEUDO_SITE.zap, MENSAGENS_DO_WHATSAPP[mensagem]);

  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {rotulo}
    </a>
  );
}
