import type { SituacaoDoOrcamento } from "@/lib/orcamentos/situacao";

// As três semânticas já existentes do design system, mais a neutra do rascunho — nenhum token
// novo (04.5-UI-SPEC.md §Color). `bg-muted`/`text-muted-foreground` é o MESMO par que o chip
// provisório dos planos 06/07 já usava para "rascunho".
const CLASSES_POR_SEMANTICA: Record<SituacaoDoOrcamento["semantica"], string> = {
  neutra: "bg-muted text-muted-foreground",
  atencao: "bg-atencao-fundo text-atencao",
  erro: "bg-erro-fundo text-erro",
  sucesso: "bg-sucesso-fundo text-sucesso",
};

export type ChipDeSituacaoProps = {
  situacao: SituacaoDoOrcamento;
};

// O chip de situação do orçamento — recebe o resultado JÁ decidido de `situacaoDoOrcamento`
// (lib/orcamentos/situacao.ts, a ÚNICA função que decide o rótulo e a cor). Usado na lista e no
// cabeçalho do editor.
export function ChipDeSituacao({ situacao }: ChipDeSituacaoProps) {
  return (
    <span
      data-testid="orcamento-chip"
      className={`text-apoio rounded-full px-2 py-0.5 ${CLASSES_POR_SEMANTICA[situacao.semantica]}`}
    >
      {situacao.rotulo}
    </span>
  );
}
