import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import type { ContaEmAberto } from "@/lib/financeiro/consultas";
import { rotuloBotaoBaixa, ROTULO_TAG_VENCIDA, ROTULO_VER, textoRotuloDaConta, textoVence } from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";

export type CartaoContaProps = {
  conta: ContaEmAberto;
  // "hoje" (dia civil de Brasília) chega por prop — este componente nunca lê o relógio sozinho.
  // Vencimento ANTES de hoje é "vencida"; vence hoje NÃO é vencida (must_have desta plano).
  hoje: string;
  aoVer: (documentoId: string) => void;
  aoBaixar: (parcelaId: string, documentoId: string) => void;
};

// O cartão de conta (protótipo `contaHTML`): título numa linha só, valor, a etiqueta de rótulo ou
// "k de N" (só quando N > 1), pessoa, "vence DD/MM/AA", "vencida" quando atrasada, e os botões
// "Ver"/"Paguei"·"Recebi" com contorno (D-05 do UI-SPEC: o Caixa não está na lista de botões em
// acento — cada tela tem só um, e aqui é a Venda/Despesa/Cadastros, nunca o Caixa).
export function CartaoConta({ conta, hoje, aoVer, aoBaixar }: CartaoContaProps) {
  const vencida = conta.vencimento < hoje;
  const rotulo = textoRotuloDaConta(conta.rotulo, conta.numeroParcela, conta.deQuantas);

  return (
    <div
      data-testid="conta-cartao"
      className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-corpo text-foreground line-clamp-1 min-w-0 flex-1 font-semibold">
          {conta.titulo}
        </span>
        <span className="text-corpo text-foreground tabular-nums whitespace-nowrap">
          {formatarReais(conta.valorCentavos)}
        </span>
      </div>

      <div className="text-apoio text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
        {rotulo && (
          <span data-testid="conta-rotulo" className="bg-muted rounded px-1.5 py-0.5">
            {rotulo}
          </span>
        )}
        {conta.pessoa && <span>{conta.pessoa}</span>}
        <span>{textoVence(formatarDataCurta(conta.vencimento))}</span>
        {vencida && (
          <span
            data-testid="conta-vencida"
            className="bg-erro-fundo text-erro rounded px-1.5 py-0.5 font-semibold"
          >
            {ROTULO_TAG_VENCIDA}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] flex-1"
          onClick={() => aoVer(conta.documentoId)}
        >
          {ROTULO_VER}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] flex-1"
          onClick={() => aoBaixar(conta.parcelaId, conta.documentoId)}
        >
          {rotuloBotaoBaixa(conta.tipo)}
        </Button>
      </div>
    </div>
  );
}
