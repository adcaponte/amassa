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
    <html lang="pt-BR">
      <body className={`${inter.variable} ${archivoNarrow.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
