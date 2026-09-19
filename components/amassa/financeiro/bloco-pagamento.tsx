"use client";

import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { formatarPercentual, formatarReais } from "@/lib/financeiro/formato";
import { conferirParcelas, PLANOS_DE_PAGAMENTO, type PlanoDePagamento } from "@/lib/financeiro/parcelas";
import { avisoDoCartao } from "@/lib/financeiro/taxa";
import {
  ROTULO_COMO_PAGA,
  ROTULO_COMO_RECEBE,
  ROTULO_FORMA,
  ROTULO_JA_PAGUEI,
  ROTULO_JA_RECEBI,
  ROTULO_OUTRA_FORMA,
  rotuloDoPlano,
  textoAvisoCartao,
  type FormaDePagamento,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LinhaParcela } from "./linha-parcela";

const FORMAS_EM_ORDEM: readonly FormaDePagamento[] = ["dinheiro", "pix", "cartao"];

export type ParcelaDoBloco = {
  vencimento: string;
  valorTexto: string;
  forma: FormaDePagamento;
  pago: boolean;
};

export type BlocoPagamentoProps = {
  // Decide só rótulos e o aviso do cartão (key_links do 04.4-06-PLAN.md) — o MESMO componente na
  // Venda (aqui) e na Despesa (plano 07).
  tipo: "venda" | "despesa";
  totalCentavos: number;
  taxaPontosBase: number;
  hoje: string;
  dataSaldoInicial: string | null;
  // Estado controlado pelo painel: `gerarPlano`/`dividirEmDuasFormas` (a REGRA do plano em si)
  // são decisão de quem chama, nunca deste componente — ele só mostra e recebe eventos.
  plano: PlanoDePagamento;
  aoMudarPlano: (plano: PlanoDePagamento) => void;
  forma: FormaDePagamento;
  aoMudarForma: (forma: FormaDePagamento) => void;
  duasFormas: boolean;
  aoAtivarOutraForma: () => void;
  aoTirarOutraForma: () => void;
  parcelas: ParcelaDoBloco[];
  aoMudarParcela: (indice: number, alteracao: Partial<ParcelaDoBloco>) => void;
  // Erro de GERAÇÃO do plano (`gerarPlano`/`dividirEmDuasFormas` recusou — valor pequeno demais
  // para dividir), decidido por quem chama no momento da troca de plano/forma.
  erroDeGeracao: string | null;
};

// O pagamento completo da Venda/Despesa (04.4-06-PLAN.md): "Como recebe"/"Como paga" (à vista,
// sinal, 2x a 12x), "Forma" (vale para todas as parcelas do plano, D-07), "+ outra forma" só no à
// vista (D-08), a grade de parcelas editável e o aviso do cartão. `conferirParcelas` é chamada
// AQUI (para mostrar a falta/sobra) e de novo em `lib/financeiro/acoes.ts::lancarVenda` (para
// recusar) — a MESMA função, nunca uma segunda conta.
export function BlocoPagamento({
  tipo,
  totalCentavos,
  taxaPontosBase,
  hoje,
  dataSaldoInicial,
  plano,
  aoMudarPlano,
  forma,
  aoMudarForma,
  duasFormas,
  aoAtivarOutraForma,
  aoTirarOutraForma,
  parcelas,
  aoMudarParcela,
  erroDeGeracao,
}: BlocoPagamentoProps) {
  const rotuloPago = tipo === "venda" ? ROTULO_JA_RECEBI : ROTULO_JA_PAGUEI;

  const parcelasConvertidas = parcelas.map((parcela) => {
    const resultado = converterReaisParaCentavos(parcela.valorTexto);
    return {
      vencimento: parcela.vencimento,
      valorCentavos: resultado.ok && resultado.centavos ? resultado.centavos : 0,
      forma: parcela.forma,
      pago: parcela.pago,
    };
  });

  const conferencia =
    !erroDeGeracao && parcelas.length > 0
      ? conferirParcelas({ totalCentavos, parcelas: parcelasConvertidas, hoje, dataSaldoInicial })
      : null;
  const erroDeSoma = conferencia && !conferencia.ok ? conferencia.erro : null;
  const erro = erroDeGeracao ?? erroDeSoma;

  // Aviso do cartão (BRIEFING §5): só em VENDA com alguma parcela no cartão, estimativa com a
  // taxa de hoje (`taxaEmCentavos`, chamada dentro de `avisoDoCartao`) — a taxa de VERDADE só é
  // congelada no servidor, no instante em que a parcela é paga.
  const aviso =
    tipo === "venda"
      ? avisoDoCartao({ tipo: "venda", parcelas: parcelasConvertidas, taxaPontosBase })
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-apoio text-muted-foreground flex flex-col gap-1">
          {tipo === "venda" ? ROTULO_COMO_RECEBE : ROTULO_COMO_PAGA}
          <select
            data-testid="pagamento-plano"
            value={plano}
            onChange={(evento) => aoMudarPlano(evento.target.value as PlanoDePagamento)}
            className="border-border text-corpo min-h-[44px] rounded-md border bg-transparent px-3"
          >
            {PLANOS_DE_PAGAMENTO.map((valor) => (
              <option key={valor} value={valor}>
                {rotuloDoPlano(valor, tipo)}
              </option>
            ))}
          </select>
        </label>

        {!duasFormas && (
          <fieldset data-testid="pagamento-forma" className="flex flex-col gap-1">
            <legend className="text-apoio text-muted-foreground">Forma</legend>
            <div className="flex gap-2">
              {FORMAS_EM_ORDEM.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={forma === valor}
                  onClick={() => aoMudarForma(valor)}
                  className={cn(
                    "text-corpo min-h-[44px] flex-1 rounded-md border px-3",
                    forma === valor
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-secondary text-secondary-foreground",
                  )}
                >
                  {ROTULO_FORMA[valor]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {plano === "avista" && !duasFormas && totalCentavos > 0 && (
        <Button
          type="button"
          variant="outline"
          data-testid="pagamento-outra-forma"
          className="min-h-[44px] self-start"
          onClick={aoAtivarOutraForma}
        >
          {ROTULO_OUTRA_FORMA}
        </Button>
      )}

      {(duasFormas || parcelas.length > 1) && (
        <div className="flex flex-col gap-2">
          {parcelas.map((parcela, indice) => (
            <LinhaParcela
              key={indice}
              numero={indice + 1}
              de={parcelas.length}
              valorTexto={parcela.valorTexto}
              aoMudarValor={(valor) => aoMudarParcela(indice, { valorTexto: valor })}
              vencimento={duasFormas ? undefined : parcela.vencimento}
              aoMudarVencimento={
                duasFormas ? undefined : (valor) => aoMudarParcela(indice, { vencimento: valor })
              }
              pago={duasFormas ? undefined : parcela.pago}
              aoMudarPago={duasFormas ? undefined : (valor) => aoMudarParcela(indice, { pago: valor })}
              rotuloPago={rotuloPago}
              forma={duasFormas ? parcela.forma : undefined}
              aoMudarForma={duasFormas ? (valor) => aoMudarParcela(indice, { forma: valor }) : undefined}
              aoTirar={duasFormas && indice === 1 ? aoTirarOutraForma : undefined}
            />
          ))}
        </div>
      )}

      {aviso && (
        <p data-testid="pagamento-aviso-cartao" className="text-apoio text-muted-foreground">
          {textoAvisoCartao(
            formatarPercentual(taxaPontosBase),
            formatarReais(aviso.taxaCentavos),
            formatarReais(aviso.entramCentavos),
          )}
        </p>
      )}

      {erro && (
        <p
          data-testid="pagamento-falta"
          role="alert"
          aria-live="assertive"
          className="text-apoio text-destructive"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
