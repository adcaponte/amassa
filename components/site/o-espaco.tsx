import { CartaoDoSite } from "@/components/site/cartao-do-site";
import { Decoracao } from "@/components/site/decoracao";
import { Secao } from "@/components/site/secao";
import { CONTEUDO_SITE } from "@/conteudo/site";

// `#espaco`: os três jeitos de passar um tempo no ateliê — café, uso livre do ateliê e loja.
// As três linhas de apoio são as chaves de preço de D-18 (`c1Preco`/`c2Preco`/`c3Preco`), já
// sem número — "consulte pelo WhatsApp".
export function OEspaco() {
  return (
    <Secao
      id="espaco"
      testId="site-espaco"
      decoracao={<Decoracao arquivo="flor-b.svg" className="top-1 right-[-4%] w-[min(46vw,470px)]" />}
    >
      <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">O espaço</p>
      <h2 className="font-titulo-site text-[28px] font-semibold text-site-tinta md:text-[40px]">
        {CONTEUDO_SITE.espacoTitulo}
      </h2>
      <p className="mt-3 max-w-[60ch] text-lg text-site-tinta-media">{CONTEUDO_SITE.espacoLead}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
        <CartaoDoSite
          cor="--color-site-barro-claro"
          slot="cafe"
          titulo={CONTEUDO_SITE.c1Titulo}
          corpo={CONTEUDO_SITE.c1Corpo}
          apoio={CONTEUDO_SITE.c1Preco}
        />
        <CartaoDoSite
          cor="--color-site-cerrado"
          slot="usoLivre"
          titulo={CONTEUDO_SITE.c2Titulo}
          corpo={CONTEUDO_SITE.c2Corpo}
          apoio={CONTEUDO_SITE.c2Preco}
        />
        <CartaoDoSite
          cor="--color-site-folha"
          slot="loja"
          titulo={CONTEUDO_SITE.c3Titulo}
          corpo={CONTEUDO_SITE.c3Corpo}
          apoio={CONTEUDO_SITE.c3Preco}
        />
      </div>
    </Secao>
  );
}
