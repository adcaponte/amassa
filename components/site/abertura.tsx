import { CONTEUDO_SITE } from "@/conteudo/site";
import { Decoracao } from "@/components/site/decoracao";
import { ImagemDoSite } from "@/components/site/imagem-do-site";

// O `<header id="topo">`: eyebrow, título de duas linhas, lead, os dois botões de rolagem e a
// foto de abertura. É o alvo da âncora da marca (`href="#topo"` em `barra-superior.tsx`) — por
// isso carrega o MESMO `scroll-margin-top` que `components/site/secao.tsx` dá às seções
// (SIT-05): a mesma variável `--altura-barra-site`, nunca um pixel escrito de novo aqui.
export function Abertura() {
  return (
    <header
      id="topo"
      data-testid="site-abertura"
      className="relative overflow-hidden scroll-mt-[var(--altura-barra-site)] px-4 pt-10 pb-14 md:pt-18 md:pb-24"
    >
      <Decoracao arquivo="flor-a.svg" className="bottom-[-12%] left-[-5%] w-[min(24vw,230px)] -rotate-[8deg]" />

      <div className="relative z-10 mx-auto grid max-w-[1080px] items-center gap-7 md:grid-cols-[1.1fr_1fr] md:gap-12">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">
            {CONTEUDO_SITE.heroEyebrow}
          </p>
          <h1 className="font-titulo-site text-[40px] leading-[0.95] font-bold tracking-tight md:text-[72px]">
            <span className="block">{CONTEUDO_SITE.heroTitulo.linha1}</span>
            <span className="block text-site-barro">{CONTEUDO_SITE.heroTitulo.linha2}</span>
          </h1>
          <p className="mt-[18px] max-w-[60ch] text-lg text-site-tinta-media">{CONTEUDO_SITE.heroLead}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a
              href="#agenda"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-site-barro px-[18px] text-[15px] font-semibold text-white"
            >
              Ver aulas e oficinas
            </a>
            <a
              href="#espaco"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-site-barro bg-site-papel px-[18px] text-[15px] font-semibold text-site-barro"
            >
              Conhecer o espaço
            </a>
          </div>
        </div>

        <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-site-areia">
          {/* D-29 (Fase 06.5): a foto de abertura é o maior elemento da primeira tela — carrega primeiro. */}
          <ImagemDoSite slot="abertura" sizes="(min-width: 768px) 45vw, 100vw" prioridade />
        </div>
      </div>
    </header>
  );
}
