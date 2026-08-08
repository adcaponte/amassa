import type { Metadata } from "next";
import { Archivo_Narrow, Inter } from "next/font/google";

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

export const metadata: Metadata = {
  title: "AMASSA",
  description: "Plataforma de gestão do ateliê AMASSA.",
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
    <html lang="pt-BR" className={`${inter.variable} ${archivoNarrow.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
