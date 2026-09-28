import type { MetadataRoute } from "next";

// Fase 04.6 (D-04/GES-05): a raiz é liberada de propósito — o critério do dono é aparecer no
// Google para "amassa cerrado pirenópolis" (SIT-08) —, e `/gestao` é bloqueado. Função estática
// sem nenhum `await` de I/O: não lê sessão nem banco, então responde igual sob carga e continua
// no ar com o Postgres derrubado (D-15), a mesma garantia da raiz.
//
// Duas camadas, de propósito: este arquivo é o PEDIDO educado ao buscador (`robots.txt`); quem
// dá a ORDEM de verdade é `metadata.robots` (`index: false`) em `app/gestao/layout.tsx` — um
// buscador mal comportado pode ignorar `robots.txt`, mas não ignora uma marcação `noindex` na
// própria página.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/gestao",
      },
    ],
  };
}
