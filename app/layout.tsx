import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

// D-10: Archivo Narrow (títulos) e Inter (corpo); D-14/D-19 (Fase 04.6): Fraunces é a fonte de
// título SÓ do site público — a plataforma continua em Archivo Narrow, de propósito ("cara de
// convite" vs. "cara de ferramenta"). As três servidas pelo próprio domínio, nenhuma requisição
// a CDN em produção.
//
// Por que `next/font/local` e arquivos versionados em `app/_fontes/` (janela 60, WINDOWS.md):
// até 02/10/2026 isto era `next/font/google`, que BAIXA as fontes do Google durante o
// `next build`. O job "Publicar imagens no GHCR" falhou por rede pelo menos duas vezes
// (runs 36443052672 e 36802909361, "Can't resolve '@vercel/turbopack-next/internal/font/
// google/font'") e passou no run seguinte sem mudança nenhuma. Agora o build não toca a rede
// para fonte. Os `.woff2` são os MESMOS bytes que o Google servia (conferido com `cmp` contra
// `.next/static/media` de um build antigo) — proveniência, versões e licença em
// `app/_fontes/README.md`.
//
// Equivalência com o que o `next/font/google` gerava, para a aparência não mudar:
// - Uma `@font-face` por peso apontando para o mesmo arquivo variável, como o Google declarava.
// - Subset `latin` com preload e `latin-ext` sem preload, cada um com o `unicode-range` exato do
//   CSS do Google. O Google também declarava cirílico, grego e vietnamita (sem preload); ficaram
//   de fora — fora do alfabeto latino, o texto cai no "* Fallback".
// - O `next/font` exige literal em cada argumento: por isso as faixas se repetem, não há
//   constante compartilhada.
//
// 🔴 O NOME DA CONSTANTE É O NOME DA FAMÍLIA. No Turbopack, o valor de `--fonte-*` e o nome do
// "* Fallback" saem do nome da variável JS — um `font-family` em `declarations` muda só o
// `@font-face`, não a variável (medido: com `const archivoNarrow` e `declarations` "Archivo
// Narrow", a pilha computada saiu `archivoNarrow, "archivoNarrow Fallback"`, nome que nenhuma
// `@font-face` declarava — o título renderizaria na fonte de reserva). Por isso `Inter` e
// `Fraunces` são constantes com inicial maiúscula: dão exatamente o nome que o Google dava.
// "Archivo Narrow" tem espaço, que identificador não aceita: a família passa a se chamar
// `ArchivoNarrow` (mesmo arquivo, mesmo desenho; só o rótulo interno muda — o e2e de
// design-system confere esse nome). Renomear uma destas constantes troca o nome da família.
//
// Cada família tem DUAS chamadas porque `declarations` vale para todas as faces de uma chamada
// e o `unicode-range` é por subset. A chamada `latin` dá a variável que `globals.css` lê
// (`--fonte-*`) e o "* Fallback" de métricas ajustadas; a `latin-ext` só acrescenta faces à
// MESMA família (por isso o `font-family` explícito em `declarations`, igual ao nome da
// constante `latin`), e a variável dela (`--fonte-*-ext`) não é lida por ninguém — existe para
// a constante ter uso explícito no `<html>`.

const Inter = localFont({
  src: [
    { path: "./_fontes/Inter-latin.woff2", weight: "400", style: "normal" },
    { path: "./_fontes/Inter-latin.woff2", weight: "500", style: "normal" },
  ],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  variable: "--fonte-inter",
  display: "swap",
});

const InterLatinExt = localFont({
  src: [
    { path: "./_fontes/Inter-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./_fontes/Inter-latin-ext.woff2", weight: "500", style: "normal" },
  ],
  declarations: [
    { prop: "font-family", value: "Inter" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  variable: "--fonte-inter-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const ArchivoNarrow = localFont({
  src: [
    { path: "./_fontes/ArchivoNarrow-latin.woff2", weight: "600", style: "normal" },
    { path: "./_fontes/ArchivoNarrow-latin.woff2", weight: "700", style: "normal" },
  ],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  variable: "--fonte-archivo",
  display: "swap",
});

const ArchivoNarrowLatinExt = localFont({
  src: [
    { path: "./_fontes/ArchivoNarrow-latin-ext.woff2", weight: "600", style: "normal" },
    { path: "./_fontes/ArchivoNarrow-latin-ext.woff2", weight: "700", style: "normal" },
  ],
  declarations: [
    { prop: "font-family", value: "ArchivoNarrow" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  variable: "--fonte-archivo-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

// Fraunces é serifada: o "Fraunces Fallback" do Google era métrica sobre Times New Roman, não
// Arial — daí o `adjustFontFallback` explícito.
const Fraunces = localFont({
  src: [
    { path: "./_fontes/Fraunces-latin.woff2", weight: "400", style: "normal" },
    { path: "./_fontes/Fraunces-latin.woff2", weight: "600", style: "normal" },
    { path: "./_fontes/Fraunces-latin.woff2", weight: "700", style: "normal" },
  ],
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  variable: "--fonte-fraunces",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const FrauncesLatinExt = localFont({
  src: [
    { path: "./_fontes/Fraunces-latin-ext.woff2", weight: "400", style: "normal" },
    { path: "./_fontes/Fraunces-latin-ext.woff2", weight: "600", style: "normal" },
    { path: "./_fontes/Fraunces-latin-ext.woff2", weight: "700", style: "normal" },
  ],
  declarations: [
    { prop: "font-family", value: "Fraunces" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  variable: "--fonte-fraunces-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const classesDeFonte = [
  Inter,
  InterLatinExt,
  ArchivoNarrow,
  ArchivoNarrowLatinExt,
  Fraunces,
  FrauncesLatinExt,
]
  .map((fonte) => fonte.variable)
  .join(" ");

// Fase 04.6 (D-03): a partir desta fase "/" é o site público institucional — este metadata
// deixou de descrever a plataforma interna e passa a ser o que qualquer visitante da internet
// lê. O SEO completo (Open Graph, sitemap) é do plano 04 desta fase; aqui só se fecha o
// vazamento de informação que a versão antiga tinha (T-04.6-02: "Plataforma de gestão" contava
// a existência de um sistema interno para qualquer motor de busca).
export const metadata: Metadata = {
  title: "AMASSA CERRADO",
  description: "Cerâmica artesanal de alta temperatura em Pirenópolis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // As classes .variable do next/font entram no <html>, não no <body> — o bloco
    // @theme de app/globals.css lê --fonte-inter/--fonte-archivo no escopo de :root, e uma
    // variável declarada só no <body> não existe um nível acima. Com a variável no <body>,
    // --font-sans/--font-titulo resolviam vazio (getComputedStyle(documentElement) não via a
    // variável) e o preflight do Tailwind vencia em silêncio — o build passava, o console
    // ficava limpo, e a tela toda saía na pilha padrão do sistema. Achado e corrigido no
    // portão de retorno do tracer (Tarefa 2, 02b-01).
    //
    // `data-scroll-behavior="smooth"` (WR-02 da revisão da Fase 04.6): `globals.css` liga a
    // rolagem suave no `:root` para as âncoras do site público, e o mesmo CSS vale em `/gestao`.
    // Com este atributo, o roteador do Next 16 desliga a rolagem suave durante a troca de rota
    // (`disableSmoothScrollDuringRouteTransition`) — sem ele, toda navegação da plataforma a
    // partir de uma lista rolada animava até o topo. As âncoras do site continuam suaves.
    <html lang="pt-BR" data-scroll-behavior="smooth" className={classesDeFonte}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
