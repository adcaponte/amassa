import type { MetadataRoute } from "next";

// Fase 04.6 (D-04/SIT-08): o critério do dono é aparecer no Google para "amassa cerrado
// pirenópolis" — é por isso que a raiz é liberada em `app/robots.ts` enquanto a plataforma
// interna fica bloqueada, e é por isso que este arquivo existe: uma ÚNICA entrada, a raiz.
// Nenhuma âncora de seção (`#espaco`, `#agenda`...) entra aqui — âncoras são posições dentro da
// MESMA página, não rotas novas, e listá-las duplicaria a mesma URL várias vezes sem ganhar
// indexação nenhuma.
//
// Função síncrona, sem chamada assíncrona de E/S nenhuma: não lê sessão nem banco, então
// responde igual sob carga e continua no ar com o Postgres derrubado (D-15) — a mesma garantia
// da raiz. Duas chamadas devolvem exatamente a mesma lista, na mesma ordem
// (tests/unit/contraste.test.ts prova isso, junto dos casos de contraste — ver comentário no
// topo daquele arquivo).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://amassacerrado.com.br/",
      lastModified: new Date("2026-09-28"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
