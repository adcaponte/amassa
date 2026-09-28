import { BotaoWhatsapp } from "@/components/site/botao-whatsapp";
import { Decoracao } from "@/components/site/decoracao";
import { ImagemDoSite } from "@/components/site/imagem-do-site";
import { Secao } from "@/components/site/secao";
import { CONTEUDO_SITE } from "@/conteudo/site";

const PASSOS = [CONTEUDO_SITE.passo1, CONTEUDO_SITE.passo2, CONTEUDO_SITE.passo3] as const;

// `#encomendas`: como funciona pedir uma peça — foto, texto e os três passos numerados
// (conta a ideia · orçamento · sinal/produção/entrega), terminando no botão de WhatsApp com a
// mensagem "orcamento" (D-17) — a única porta para o link, via `BotaoWhatsapp`.
export function Encomendas() {
  return (
    <Secao
      id="encomendas"
      testId="site-encomendas"
      className="border-y border-site-borda bg-site-papel"
      decoracao={
        <Decoracao arquivo="flor-d.svg" className="right-[-6%] bottom-[-6%] w-[min(34vw,340px)] rotate-[12deg]" />
      }
    >
      <div className="grid items-center gap-7 md:grid-cols-2 md:gap-12">
        <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-site-areia md:aspect-square">
          <ImagemDoSite slot="encomendas" sizes="(min-width: 768px) 45vw, 100vw" />
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">Encomendas</p>
          <h2 className="font-titulo-site text-[28px] font-semibold text-site-tinta md:text-[40px]">
            {CONTEUDO_SITE.encomendasTitulo}
          </h2>
          <p className="mt-3 max-w-[60ch] text-lg text-site-tinta-media">{CONTEUDO_SITE.encomendasLead}</p>

          <div className="mt-5 flex flex-col gap-3">
            {PASSOS.map((passo, indice) => (
              <div key={passo.titulo} className="flex items-start gap-3.5 text-[15px] text-site-tinta-media">
                <span
                  aria-hidden="true"
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-site-barro text-sm font-semibold text-white"
                >
                  {indice + 1}
                </span>
                <p>
                  <span className="block font-semibold text-site-tinta">{passo.titulo}</span>
                  {passo.corpo}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <BotaoWhatsapp
              mensagem="orcamento"
              rotulo="Pedir um orçamento pelo WhatsApp"
              className="flex min-h-11 w-fit items-center justify-center gap-2 rounded-full bg-site-cerrado px-[18px] text-[15px] font-semibold text-white"
            />
          </div>
        </div>
      </div>
    </Secao>
  );
}
