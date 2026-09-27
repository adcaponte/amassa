import {
  FRASE_APROVADO_EXPLICACAO,
  FRASE_VENDA_CANCELADA_AVISO,
  ROTULO_VER_ENCOMENDA_NA_PRODUCAO,
  ROTULO_VER_VENDA_NO_FINANCEIRO,
  textoVeredito,
} from "@/lib/orcamentos/textos";

export type VereditoDaAprovacaoProps = {
  documentoId: string;
  documentoNumero: number;
  encomendaId: string | null;
  // "existe uma venda cancelada vinculada?" (D-25) — o orçamento continua aprovado; a venda em si
  // segue existindo e navegável (o "Ver venda no Financeiro" continua válido: é lá que se vê que
  // ela foi cancelada), só ganha a linha de aviso abaixo.
  vendaCancelada: boolean;
};

// O bloco verde do orçamento aprovado (herdado do protótipo `telaEditor`), mais os DOIS links
// novos que tornam o vínculo gravado nos dois sentidos algo VISÍVEL (04.5-UI-SPEC.md, Assunção
// 6) — sem eles o vínculo existiria só no banco. Quando a venda foi cancelada, a linha informativa
// aparece ABAIXO, em `--color-tinta-fraca`, sem ação e sem cor de destaque (D-25): o orçamento
// continua aprovado, o veredito original continua verdadeiro (a venda FOI criada), só o estado
// atual dela mudou.
export function VereditoDaAprovacao({
  documentoId,
  documentoNumero,
  encomendaId,
  vendaCancelada,
}: VereditoDaAprovacaoProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="orcamento-aviso-aprovado"
        className="bg-sucesso-fundo text-sucesso text-corpo flex flex-col gap-2 rounded-lg p-3"
      >
        <p>{textoVeredito(documentoNumero, encomendaId !== null)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            data-testid="veredito-ver-venda"
            href={`/financeiro?aba=caixa&documentoId=${documentoId}`}
            className="text-corpo font-medium underline underline-offset-2"
          >
            {ROTULO_VER_VENDA_NO_FINANCEIRO}
          </a>
          {encomendaId && (
            <a
              data-testid="veredito-ver-encomenda"
              href={`/encomendas/${encomendaId}`}
              className="text-corpo font-medium underline underline-offset-2"
            >
              {ROTULO_VER_ENCOMENDA_NA_PRODUCAO}
            </a>
          )}
        </div>
      </div>

      <p className="text-apoio text-muted-foreground">{FRASE_APROVADO_EXPLICACAO}</p>

      {vendaCancelada && (
        // `--color-tinta-fraca` é o token por trás de `text-muted-foreground` (app/globals.css)
        // — "sem cor de destaque além do texto fraco" (D-25), a mesma classe que o resto do
        // projeto já usa para texto secundário.
        <p data-testid="orcamento-aviso-venda-cancelada" className="text-apoio text-muted-foreground">
          {FRASE_VENDA_CANCELADA_AVISO}
        </p>
      )}
    </div>
  );
}
