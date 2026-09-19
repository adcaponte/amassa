"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleUserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { NOME_ACESSIVEL_MENU_USUARIO } from "@/lib/acessibilidade/rotulos";
import { ehItemAtivo, ITENS_NAVEGACAO_LATERAL } from "@/lib/navegacao/itens";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MenuUsuario } from "@/components/amassa/menu-usuario";

// Cabeçalho fixo no topo do celular (< 768px). À esquerda o título da página; à direita o
// botão de avatar que abre o menu do usuário num Sheet. Este botão é o único da fase inteira
// sem rótulo visível — o `aria-label` abaixo é obrigatório (UI-09) e a asserção de teste
// procura exatamente por esse nome acessível: getByRole('button', { name: 'Abrir menu do
// usuário' }).
//
// A cadeia em si vive em lib/acessibilidade/rotulos.ts (módulo puro, zero import) — não aqui —
// porque tests/e2e/acessibilidade.spec.ts precisa importá-la sem herdar a cadeia de imports
// deste componente (que passa por Server Actions e next-auth, incompatíveis com o carregador
// de teste do Playwright fora do runtime do Next.js). Reexportada abaixo para quem só olha
// este arquivo continuar encontrando a fonte da string.
export { NOME_ACESSIVEL_MENU_USUARIO };

export type CabecalhoMovelProps = {
  nome: string;
  titulo?: string;
  className?: string;
};

// Deriva o título da tela atual a partir do mesmo caminho que a navegação usa para decidir o
// item ativo (ehItemAtivo) — uma só fonte de verdade para "em que tela eu estou". Lê SEMPRE a
// lista LATERAL (a mais completa, 6 itens) — nunca a do celular: se lesse a do celular,
// `/estoque` no celular perderia o título, porque saiu da barra do celular na Fase 04.4 (D-04)
// mas continua sendo uma rota alcançável por URL direta, com cabeçalho próprio. Orçamentos e
// `/cadastros` ficam fora das duas listas de propósito (UI-04, D-06 — nenhum dos dois é item da
// navegação principal), mas ainda precisam de um título aqui; reaproveita ehItemAtivo com o
// mesmo href da página em vez de inventar uma segunda forma de comparação de rota. Qualquer
// caminho sem casamento (ex.: /login, antes do redirect) cai no `undefined` e quem chama decide
// o retrocesso.
function derivarTituloDaTela(caminho: string): string | undefined {
  if (ehItemAtivo(caminho, "/orcamentos")) {
    return "Orçamentos";
  }

  if (ehItemAtivo(caminho, "/cadastros")) {
    return "Cadastros";
  }

  return ITENS_NAVEGACAO_LATERAL.find((item) => ehItemAtivo(caminho, item.href))?.rotulo;
}

export function CabecalhoMovel({ nome, titulo, className }: CabecalhoMovelProps) {
  const pathname = usePathname();
  const tituloExibido = titulo ?? derivarTituloDaTela(pathname) ?? "AMASSA";

  // `Sheet` controlado (não mais uncontrolled): uma navegação por `<Link>` dentro dele é troca
  // de rota client-side — este cabeçalho não desmonta entre rotas, então o Sheet ficaria aberto
  // por cima da página nova se ninguém o fechasse de propósito (achado ao rodar o e2e de
  // verdade, `04.2-01-SUMMARY.md`). `MenuUsuario` chama `aoNavegar` ao ativar qualquer link ou
  // botão da variante celular.
  const [aberto, setAberto] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden",
        className,
      )}
    >
      <span className="truncate text-titulo text-foreground">{tituloExibido}</span>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={NOME_ACESSIVEL_MENU_USUARIO}
            className="flex size-11 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <CircleUserRound aria-hidden="true" className="size-10 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <MenuUsuario nome={nome} variante="celular" aoNavegar={() => setAberto(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
