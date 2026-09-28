import type { Metadata } from "next";
import { Archivo_Narrow, Fraunces, Inter } from "next/font/google";

import "./globals.css";

// D-10: Archivo Narrow (títulos) e Inter (corpo) via next/font/google — baixadas no
// `next build` (que roda no GitHub Actions, com internet) e servidas pelo próprio domínio.
// Nenhum arquivo de fonte é versionado, nenhuma requisição a CDN em produção.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fonte-inter",
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--fonte-archivo",
  display: "swap",
});

// D-14/D-19 (Fase 04.6, site público): Fraunces é a fonte de título SÓ do site — a plataforma
// continua em Archivo Narrow, de propósito (D-19: "cara de convite" vs. "cara de ferramenta").
// Mesmo padrão das outras duas: baixada no `next build`, servida pelo próprio domínio, nenhum
// arquivo de fonte versionado, nenhuma requisição a CDN em produção.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--fonte-fraunces",
  display: "swap",
});

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
    // As classes .variable do next/font/google entram no <html>, não no <body> — o bloco
    // @theme de app/globals.css lê --fonte-inter/--fonte-archivo no escopo de :root, e uma
    // variável declarada só no <body> não existe um nível acima. Com a variável no <body>,
    // --font-sans/--font-titulo resolviam vazio (getComputedStyle(documentElement) não via a
    // variável) e o preflight do Tailwind vencia em silêncio — o build passava, o console
    // ficava limpo, e a tela toda saía na pilha padrão do sistema. Achado e corrigido no
    // portão de retorno do tracer (Tarefa 2, 02b-01).
    <html lang="pt-BR" className={`${inter.variable} ${archivoNarrow.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
