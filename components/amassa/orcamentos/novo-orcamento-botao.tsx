import { ROTULO_NOVO_ORCAMENTO } from "@/lib/orcamentos/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hrefDoOrcamentoNovo } from "@/lib/financeiro/navegacao";

// "Novo orçamento" — o único acento terracota da tela (04.5-UI-SPEC.md §Color).
//
// D-15 (06.5-14, achado 22 do Cowork): o botão NÃO grava mais nada. É um link para o editor
// vazio (`?aba=orcamentos&orcamento=novo`, `OrcamentoNovo`); o registro só nasce quando o
// primeiro campo é preenchido. Antes, cada toque deixava um "Sem título" para trás quando a
// pessoa desistia.
//
// `<a>` comum (navegação completa), como o "Abrir" de cada linha da lista — nenhuma transição
// do roteador do lado do cliente (o defeito de agendamento documentado em
// `.planning/PROXIMA-SESSAO.md`, "Fase 4.2 ensinou").
export function NovoOrcamentoBotao({ className }: { className?: string }) {
  return (
    <Button asChild variant="default" className={cn("min-h-[44px]", className)}>
      <a href={hrefDoOrcamentoNovo()}>{ROTULO_NOVO_ORCAMENTO}</a>
    </Button>
  );
}
