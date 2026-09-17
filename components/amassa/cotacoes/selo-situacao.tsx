import { ROTULO_SITUACAO, type SituacaoCotacao } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";

// Os três selos de D-09 (UI-SPEC §Color): `cotando` no par de acento, `favorito` no par de
// sucesso, `descartado` em NEUTRO — nunca vermelho, que aqui é reservado a perigo/alerta, não a
// "descartado". O texto do selo é a pista NÃO visual e nunca depende só de cor.
const CLASSE_POR_SITUACAO: Record<SituacaoCotacao, string> = {
  cotando: "bg-acento-fundo text-acento",
  favorito: "bg-sucesso-fundo text-sucesso",
  descartado: "bg-muted text-muted-foreground",
};

export function SeloSituacao({ situacao }: { situacao: SituacaoCotacao }) {
  return (
    <span
      data-testid="cotacoes-selo"
      className={cn(
        "text-micro inline-block rounded-full px-2.5 py-1 font-semibold whitespace-nowrap",
        CLASSE_POR_SITUACAO[situacao],
      )}
    >
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}
