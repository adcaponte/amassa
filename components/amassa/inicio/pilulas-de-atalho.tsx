import Link from "next/link";

import { ITENS_NAVEGACAO_CELULAR, ITENS_NAVEGACAO_LATERAL } from "@/lib/navegacao/itens";
import { Button } from "@/components/ui/button";

// As pílulas logo abaixo da saudação: um atalho por módulo que está na barra LATERAL mas NÃO na
// barra de baixo do celular (hoje Queimas, Estoque e Cadastros) — DERIVADO das duas listas de
// `lib/navegacao/itens.ts`, nunca uma terceira lista escrita à mão. Se um módulo novo entrar na
// lateral sem entrar na barra de baixo, ele aparece aqui sozinho, sem edição deste arquivo.
const HREFS_DA_BARRA_DE_BAIXO = new Set(ITENS_NAVEGACAO_CELULAR.map((item) => item.href));
const ITENS_FORA_DA_BARRA = ITENS_NAVEGACAO_LATERAL.filter(
  (item) => !HREFS_DA_BARRA_DE_BAIXO.has(item.href),
);

export function PilulasDeAtalho() {
  return (
    <div data-testid="inicio-pilulas" className="flex flex-wrap gap-2">
      {ITENS_FORA_DA_BARRA.map((item) => (
        <Button key={item.href} asChild variant="secondary" className="min-h-[44px] rounded-full">
          <Link href={item.href}>{item.rotulo}</Link>
        </Button>
      ))}

      {/* "todos os módulos ↓" (protótipo `.pil.ex`) — pílula tracejada que rola até o índice do
          fim, `IndiceDosModulos`, que reserva a âncora `#tudo`. */}
      <Button
        asChild
        variant="outline"
        className="min-h-[44px] rounded-full border-dashed"
      >
        <a href="#tudo">todos os módulos ↓</a>
      </Button>
    </div>
  );
}
