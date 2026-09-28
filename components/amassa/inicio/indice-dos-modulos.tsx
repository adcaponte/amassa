import Link from "next/link";
import {
  Archive,
  CalendarDays,
  Flame,
  Package,
  Plus,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { ITENS_NAVEGACAO_LATERAL, type ChaveDeIcone } from "@/lib/navegacao/itens";

type ChaveDeModulo = Exclude<ChaveDeIcone, "inicio">;

// Mesma disciplina de `barra-lateral.tsx`/`barra-inferior.tsx`: um `Record` completo sobre as
// chaves de módulo (sem "inicio", que não entra no índice) — esquecer uma chave nova aqui
// quebra `tsc --noEmit`, nunca renderiza cartão sem ícone em silêncio.
const ICONES: Record<ChaveDeModulo, LucideIcon> = {
  encomendas: Package,
  financeiro: Wallet,
  agenda: CalendarDays,
  queimas: Flame,
  estoque: Archive,
  cadastros: SlidersHorizontal,
};

// Frase de apoio de cada módulo — verbatim do protótipo aprovado (`prototipo-gestao.html`,
// constante `MODS`). Vive aqui, não em `lib/navegacao/itens.ts`, porque é copy do Início, não
// dado de rota (este plano não modifica aquele arquivo).
const FRASE_DE_APOIO: Record<ChaveDeModulo, string> = {
  financeiro: "Venda, despesa, caixa, mês e orçamentos",
  encomendas: "Encomendas e produção da casa",
  agenda: "Aulas, reservas e uso do espaço",
  queimas: "Fornadas e manutenção do forno",
  estoque: "Materiais, insumos e peças prontas",
  cadastros: "Catálogo, pessoas, categorias, contas fixas, parâmetros",
};

// "Tudo da plataforma" — o índice do fim (protótipo `.mods`): um cartão por módulo de
// ITENS_NAVEGACAO_LATERAL sem o Início, mais o cartão tracejado "Próximos módulos". Âncora
// `#tudo` é o alvo da pílula "todos os módulos ↓" (`pilulas-de-atalho.tsx`).
export function IndiceDosModulos() {
  const modulos = ITENS_NAVEGACAO_LATERAL.filter(
    (item): item is (typeof ITENS_NAVEGACAO_LATERAL)[number] & { icone: ChaveDeModulo } =>
      item.icone !== "inicio",
  );

  return (
    <section id="tudo" data-testid="inicio-indice" aria-labelledby="inicio-indice-titulo">
      <h2
        id="inicio-indice-titulo"
        className="text-apoio text-muted-foreground mt-2 mb-3 uppercase tracking-wide"
      >
        Tudo da plataforma
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modulos.map((item) => {
          const Icone = ICONES[item.icone];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="border-border bg-card focus-visible:ring-ring flex min-h-[118px] min-w-0 flex-col gap-1 rounded-lg border p-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Icone aria-hidden="true" className="text-acento size-5" />
              <span className="text-corpo font-semibold text-foreground">{item.rotulo}</span>
              <span className="text-apoio text-muted-foreground">{FRASE_DE_APOIO[item.icone]}</span>
            </Link>
          );
        })}

        {/* "Próximos módulos" (protótipo `.mod.futuro`) — cartão tracejado, sem link, sem
            ícone acentuado: entram aqui quando existirem, sem mexer na barra de baixo. */}
        <div className="border-border text-muted-foreground flex min-h-[118px] min-w-0 flex-col gap-1 rounded-lg border border-dashed p-4">
          <Plus aria-hidden="true" className="size-5" />
          <span className="text-corpo font-semibold">Próximos módulos</span>
          <span className="text-apoio">entram aqui, sem mexer na barra de baixo</span>
        </div>
      </div>
    </section>
  );
}
