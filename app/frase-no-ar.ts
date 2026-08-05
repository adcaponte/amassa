// Frase exibida na página mínima da marca (D-12/D-13). Trivialmente encontrável: alterar
// este valor, dar push, e a mudança aparece sozinha é o próprio critério de aceite INFRA-02.
//
// Vive num módulo à parte porque `app/page.tsx` é validado pelo Next.js contra um conjunto
// fechado de exports (default, metadata, generateStaticParams, etc.) — qualquer export
// extra nesse arquivo quebra `next build` com um erro de tipo. Ver Deviations no SUMMARY.
export const FRASE_NO_AR = "A plataforma do ateliê está no ar.";
