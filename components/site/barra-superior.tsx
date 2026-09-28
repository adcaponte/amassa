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

        <div className="hidden items-center gap-5 text-[15px] font-medium text-site-tinta-media md:flex">
          {LINKS_DE_SECAO.map((link) => (
            <a key={link.href} href={link.href} className="flex min-h-11 items-center hover:text-site-tinta">
              {link.rotulo}
            </a>
          ))}
        </div>

        <div className="flex gap-2">
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
