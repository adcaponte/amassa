import {
  FRASE_APROVADO_EXPLICACAO,
  FRASE_ENCOMENDA_CANCELADA_AVISO,
  FRASE_VENDA_CANCELADA_AVISO,
  ROTULO_VER_ENCOMENDA_NA_PRODUCAO,
  ROTULO_VER_VENDA_NO_FINANCEIRO,
  textoVeredito,
} from "@/lib/orcamentos/textos";
import { vereditoDaAprovacao, type StatusEncomenda } from "@/lib/orcamentos/situacao";

export type VereditoDaAprovacaoProps = {
  documentoId: string;
  documentoNumero: number;
  encomendaId: string | null;
  // O ESTADO da ordem, não só a existência dela (04.5-14) — `null` quando não há encomenda
  // vinculada. A tela não interpreta este valor: quem decide é `vereditoDaAprovacao`.
  encomendaStatus: StatusEncomenda | null;
  // "existe uma venda cancelada vinculada?" (D-25) — o orçamento continua aprovado; a venda em si
  // segue existindo e navegável (o "Ver venda no Financeiro" continua válido: é lá que se vê que
  // ela foi cancelada), só ganha a linha de aviso abaixo.
  vendaCancelada: boolean;
};

// Só as duas classes que este bloco pode ter. Os tokens já existem no design system
// (app/globals.css) — nenhum hex novo, nenhuma cor inventada aqui.
const CLASSE_DO_BLOCO: Record<"sucesso" | "atencao", string> = {
  sucesso: "bg-sucesso-fundo text-sucesso",
  atencao: "bg-atencao-fundo text-atencao",
};

// O bloco do orçamento aprovado (herdado do protótipo `telaEditor`), mais os DOIS links novos
// que tornam o vínculo gravado nos dois sentidos algo VISÍVEL (04.5-UI-SPEC.md, Assunção
// 6) — sem eles o vínculo existiria só no banco.
//
// 🔴 04.5-14 (achado 14 da verificação humana): o bloco NÃO é verde por decreto. Ele afirma
// "e ordem aberta na Produção" apenas enquanto a ordem estiver de fato aberta, e desce para
// `atencao` assim que a venda OU a encomenda for cancelada. Antes disso, um bloco verde
// afirmando uma coisa convivia com um aviso cinza desmentindo logo abaixo — que era o defeito,
// não a solução. As linhas de aviso continuam em `--color-tinta-fraca`, sem ação (D-25): o
// orçamento continua aprovado, nada foi apagado, só o estado do que ele criou mudou.
export function VereditoDaAprovacao({
  documentoId,
  documentoNumero,
  encomendaId,
  encomendaStatus,
  vendaCancelada,
}: VereditoDaAprovacaoProps) {
  const veredito = vereditoDaAprovacao({ encomendaId, encomendaStatus, vendaCancelada });

  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="orcamento-aviso-aprovado"
        className={`${CLASSE_DO_BLOCO[veredito.semantica]} text-corpo flex flex-col gap-2 rounded-lg p-3`}
      >
        <p>{textoVeredito(documentoNumero, veredito.ordemAberta)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            data-testid="veredito-ver-venda"
            href={`/financeiro?aba=caixa&documentoId=${documentoId}`}
            className="text-corpo font-medium underline underline-offset-2"
          >
            {ROTULO_VER_VENDA_NO_FINANCEIRO}
          </a>
          {encomendaId && (
            // O link continua válido mesmo com a ordem cancelada — é lá que se vê o que
            // aconteceu com ela, exatamente como o "Ver venda no Financeiro" (D-25).
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

      {veredito.ordemCancelada && (
        <p data-testid="orcamento-aviso-encomenda-cancelada" className="text-apoio text-muted-foreground">
          {FRASE_ENCOMENDA_CANCELADA_AVISO}
        </p>
      )}
    </div>
  );
}
