import Image from "next/image";

import { Secao } from "@/components/site/secao";
import { CONTEUDO_SITE, FOTOS_DO_INSTAGRAM } from "@/conteudo/site";
import { fotosDaFaixa } from "@/lib/site/instagram";

// Fase 06.5, plano 21 (D-32, UI-D18): a faixa de fotos do Instagram, entre "Encomendas" e "Onde
// fica". Existe SÓ com fotos do dono: `fotosDaFaixa(FOTOS_DO_INSTAGRAM)` vazio devolve `null` inteiro
// — nenhum `<section>`, nenhum retângulo, nenhum "em breve" (a regra D-20 da faixa da fachada).
//
// As fotos são arquivos estáticos em `public/site/`, servidos pelo próprio site: nenhuma chamada à
// API do Instagram, nenhum embed, nada que rastreie quem visita (T-06.5-64). O único contato com o
// Instagram é o link "Ver no Instagram", que só sai do site quando a pessoa toca nele.
//
// Rótulo e título no molde do "Onde fica" (`onde-fica.tsx`); o link, no molde do link do Instagram
// de lá (`min-h-11`, `text-site-barro underline`, `rel="noopener"`).
export function FaixaDoInstagram() {
  const fotos = fotosDaFaixa(FOTOS_DO_INSTAGRAM);
  if (fotos.length === 0) return null;

  const { instagramUsuario, instagramUrl } = CONTEUDO_SITE.contato;

  return (
    <Secao id="instagram" testId="site-instagram">
      <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">Instagram</p>
      <h2 className="font-titulo-site text-[28px] font-semibold text-site-tinta md:text-[40px]">{instagramUsuario}</h2>

      <ul className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-4">
        {fotos.map((foto) => (
          <li
            key={foto.arquivo}
            data-testid="site-instagram-foto"
            className="relative aspect-square overflow-hidden rounded-2xl bg-site-areia"
          >
            <Image
              src={`/site/${foto.arquivo}`}
              alt={foto.alt}
              fill
              sizes="(min-width: 1080px) 162px, (min-width: 768px) 16vw, 33vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>

      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener"
        className="mt-4 inline-flex min-h-11 items-center text-[15px] font-semibold text-site-barro underline"
      >
        Ver no Instagram
      </a>
    </Secao>
  );
}
