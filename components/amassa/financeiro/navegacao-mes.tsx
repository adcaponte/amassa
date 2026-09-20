import Link from "next/link";

import { nomeDoMes } from "@/lib/financeiro/formato";

export type NavegacaoMesProps = {
  mes: string;
  hrefMesAnterior: string;
  hrefMesSeguinte: string;
};

// ◀ nome do mês ▶ — o MESMO componente entre o extrato do Caixa (D-11) e a tela Mês
// (04.4-UI-SPEC.md). Cada seta é um `<Link>` normal do Next.js (a navegação por mês é navegação
// de conteúdo, mesma disciplina de `?aba=`), 44px, com `aria-label` fixo — quem monta o `href` é
// SEMPRE quem chama (a página), preservando o que mais precisar sobreviver na URL (a `forma` do
// extrato, por exemplo) sem este componente precisar conhecer esse detalhe.
export function NavegacaoMes({ mes, hrefMesAnterior, hrefMesSeguinte }: NavegacaoMesProps) {
  return (
    <div data-testid="mes-nav" className="flex items-center justify-center gap-3">
      <Link
        href={hrefMesAnterior}
        aria-label="mês anterior"
        className="border-border bg-secondary text-secondary-foreground flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border"
      >
        ◀
      </Link>
      <h2 className="text-titulo text-foreground min-w-[150px] text-center capitalize">
        {nomeDoMes(mes)}
      </h2>
      <Link
        href={hrefMesSeguinte}
        aria-label="mês seguinte"
        className="border-border bg-secondary text-secondary-foreground flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border"
      >
        ▶
      </Link>
    </div>
  );
}
