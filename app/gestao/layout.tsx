import type { Metadata } from "next";
import type { ReactNode } from "react";

// Layout de PASSAGEM: só devolve `children`, sem marcação nenhuma. A casca de navegação
// continua sendo `app/gestao/(app)/layout.tsx`, e o login continua fora dela (grupo `(auth)`) —
// este arquivo não decide nada sobre isso. Ele existe por um motivo só: ser o lugar único de
// onde `metadata.robots` alcança TODA tela sob `/gestao`, inclusive o login (D-04/GES-05) — o
// Next.js mescla `metadata` de layouts ancestrais, então declarar aqui, uma vez, cobre os dois
// grupos-filhos sem duplicar a marcação em cada um.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function LayoutGestao({ children }: { children: ReactNode }) {
  return children;
}
