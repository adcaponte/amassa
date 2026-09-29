// Barra fixa no topo, SEMPRE visível (computador e celular) — a marca, os quatro links de
// seção (só a partir de `md`, como o protótipo) e os dois botões fixos "Agenda"/"Encomendas",
// nesta ordem (SIT-05: mesma ordem da barra de baixo). Altura mínima igual a
// `--altura-barra-site` — a MESMA variável que dá o `scroll-margin-top` das seções
// (`components/site/secao.tsx`) e o `padding-top` do corpo da página (`app/page.tsx`).
//
// Toda âncora aqui é um `<a href="#...">` sem manipulador de clique: a rolagem é do navegador,
// funciona sem JavaScript e sobrevive a erro de hidratação — requisito, não estilo (SIT-05).
const LINKS_DE_SECAO = [
  { href: "#espaco", rotulo: "O espaço" },
  { href: "#agenda", rotulo: "Aulas e oficinas" },
  { href: "#encomendas", rotulo: "Encomendas" },
  { href: "#onde", rotulo: "Onde fica" },
] as const;

export function BarraSuperior() {
  return (
    <nav
      data-testid="site-barra-superior"
      className="fixed inset-x-0 top-0 z-50 min-h-[var(--altura-barra-site)] border-b border-site-borda bg-site-fundo/90 backdrop-blur"
    >
      <div className="mx-auto flex min-h-[var(--altura-barra-site)] max-w-[1080px] items-center justify-between gap-3 px-4">
        <a
          href="#topo"
          className="flex min-h-11 items-center gap-2.5 font-titulo-site text-[15px] font-bold whitespace-nowrap text-site-tinta md:text-lg"
        >
          <span aria-hidden="true" className="inline-block h-[34px] w-[34px] shrink-0 rounded-full bg-site-barro" />
          AMASSA CERRADO
        </a>

        {/* Os quatro links de seção só entram a partir de 880px, não de 768px (`md`). Em 768px a
            marca + quatro links + dois botões não cabem: "Encomendas" terminava em 778 numa tela
            de 768 — medido em produção em 29/09/2026. O próprio protótipo aprovado tem o mesmo
            defeito na virada dele (760px: "Encomendas" até 810). 880px é um ponto de quebra que o
            protótipo já usa em três seções, e dá folga para diferença de fonte entre sistemas.
            Decisão tomada sem o dono, registrada; reverter é voltar `min-[880px]:flex` para
            `md:flex` — e aceitar o botão cortado entre 768 e ~795px. Guardado por
            tests/e2e/site-abertura.spec.ts, caso (k). */}
        <div className="hidden items-center gap-5 text-[15px] font-medium text-site-tinta-media min-[880px]:flex">
          {LINKS_DE_SECAO.map((link) => (
            <a key={link.href} href={link.href} className="flex min-h-11 items-center hover:text-site-tinta">
              {link.rotulo}
            </a>
          ))}
        </div>

        {/* Os dois botões fixos ficam ESCONDIDOS no celular — exatamente como o protótipo aprovado
            renderiza (`nav.topo .fixos{display:none}` abaixo de 760px; medido em 29/09/2026). Lá
            quem os entrega é a barra de baixo (`barra-inferior-fixa.tsx`, `md:hidden`), então os
            dois pontos de quebra são complementares: em nenhuma largura os botões somem das duas
            barras. Antes eles apareciam aqui também, e "Encomendas" saía cortado na borda da tela
            — em 375px lia-se "Encom". O executor do plano 03 seguiu a regra de celular da linha 33
            do CSS do protótipo sem ver que a linha 37 a anula pela cascata. */}
        <div className="hidden gap-2 md:flex">
          <a
            data-testid="site-botao-agenda"
            href="#agenda"
            className="flex min-h-11 items-center justify-center rounded-full border-[1.5px] border-site-barro px-4 text-sm font-semibold text-site-barro"
          >
            Agenda
          </a>
          <a
            data-testid="site-botao-encomendas"
            href="#encomendas"
            className="flex min-h-11 items-center justify-center rounded-full bg-site-barro px-4 text-sm font-semibold text-white"
          >
            Encomendas
          </a>
        </div>
      </div>
    </nav>
  );
}
