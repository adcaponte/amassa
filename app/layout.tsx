import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
