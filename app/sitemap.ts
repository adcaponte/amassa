import type { MetadataRoute } from "next";

// Fase 04.6 (D-04/SIT-08): o critério do dono é aparecer no Google para "amassa cerrado
// pirenópolis" — é por isso que a raiz é liberada em `app/robots.ts` enquanto a plataforma
// interna fica bloqueada, e é por isso que este arquivo existe. Nenhuma âncora de seção
// (`#espaco`, `#agenda`...) entra aqui — âncoras são posições dentro da MESMA página, não rotas
// novas, e listá-las duplicaria a mesma URL várias vezes sem ganhar indexação nenhuma.
//
// Duas entradas desde 06/10/2026 (Fase 06.5, plano 21, D-29). Até então era UMA, a raiz. A
// `/privacidade` entrou porque é a segunda página pública de verdade (não uma âncora): o Google já
// precisa achá-la — é o URL da política que a tela de consentimento do app OAuth `amassa-backup`
// aponta — e ela agora tem canonical próprio. Nenhuma rota de `/gestao` entra, nunca.
//
// `lastModified` viva: `PUBLICADO_EM` é o instante em que este módulo foi carregado. O sitemap é
// estático (gerado no build), então esse instante é a publicação — cada deploy refaz a data, em vez
// de uma data escrita à mão que envelhece sem ninguém trocar (até 06/10 era "2026-09-28" fixo).
// Constante de MÓDULO, não `new Date()` dentro da função: duas chamadas devolvem exatamente a mesma
// lista, na mesma ordem (tests/unit/contraste.test.ts prova isso, junto dos casos de contraste — ver
// comentário no topo daquele arquivo).
//
// Função síncrona, sem chamada assíncrona de E/S nenhuma: não lê sessão nem banco, então
// responde igual sob carga e continua no ar com o Postgres derrubado (D-15) — a mesma garantia
// da raiz.
const PUBLICADO_EM = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://amassacerrado.com.br/",
      lastModified: PUBLICADO_EM,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://amassacerrado.com.br/privacidade",
      lastModified: PUBLICADO_EM,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
