import type { ResumoDoMes } from "@/lib/financeiro/mes";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  DICA_DINHEIRO_SE_MEXEU,
  DICA_FORA_DO_RESULTADO_MES,
  FRASE_NADA_NESTE_MES,
  ROTULO_ENTROU_NO_CAIXA,
  ROTULO_SAIU_DO_CAIXA,
  TITULO_DINHEIRO_SE_MEXEU,
  TITULO_FORA_DO_RESULTADO_MES,
} from "@/lib/financeiro/textos";
import { NavegacaoMes } from "./navegacao-mes";
import { ReguaMes } from "./regua-mes";
import { TabelaAreas } from "./tabela-areas";

export type PainelMesProps = {
  mes: string;
  resumo: ResumoDoMes;
  hrefMesAnterior: string;
  hrefMesSeguinte: string;
};

// A tela Mês completa (04.4-09-PLAN.md, Tarefa 3): quanto cada área deixou, o Geral num bloco só
// com a taxa do cartão, o veredito, o dinheiro que se mexeu e o fora do resultado (FNC-11) — duas
// colunas a partir de 980px (mesmo ponto de quebra do resto do Financeiro).
export function PainelMes({ mes, resumo, hrefMesAnterior, hrefMesSeguinte }: PainelMesProps) {
  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
      <NavegacaoMes mes={mes} hrefMesAnterior={hrefMesAnterior} hrefMesSeguinte={hrefMesSeguinte} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TabelaAreas
          areas={resumo.areas}
          vendeuTotalCentavos={resumo.vendeuTotalCentavos}
          custouTotalCentavos={resumo.custouTotalCentavos}
          deixouTotalCentavos={resumo.deixouTotalCentavos}
        />
        <ReguaMes resumo={resumo} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="text-titulo text-foreground">{TITULO_DINHEIRO_SE_MEXEU}</h2>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-3">
              <span className="text-corpo">{ROTULO_ENTROU_NO_CAIXA}</span>
              <span data-testid="mes-entrou" className="text-sucesso text-corpo tabular-nums">
                {formatarReais(resumo.entrouCentavos)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-corpo">{ROTULO_SAIU_DO_CAIXA}</span>
              <span data-testid="mes-saiu" className="text-erro text-corpo tabular-nums">
                {formatarReais(resumo.saiuCentavos)}
              </span>
            </div>
          </div>
          <p className="text-apoio text-muted-foreground">{DICA_DINHEIRO_SE_MEXEU}</p>
        </section>

        <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="text-titulo text-foreground">{TITULO_FORA_DO_RESULTADO_MES}</h2>
          {resumo.fora.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{FRASE_NADA_NESTE_MES}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {resumo.fora.map((linha) => {
                const positivo = linha.valorCentavos >= 0;
                return (
                  <div key={linha.nome} data-testid="mes-fora-linha" className="flex justify-between gap-3">
                    <span className="text-corpo min-w-0 flex-1 truncate">{linha.nome}</span>
                    <span
                      className={
                        "text-corpo tabular-nums whitespace-nowrap " + (positivo ? "text-sucesso" : "text-erro")
                      }
                    >
                      {positivo ? "+" : "−"} {formatarReais(Math.abs(linha.valorCentavos))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-apoio text-muted-foreground">{DICA_FORA_DO_RESULTADO_MES}</p>
        </section>
      </div>
    </div>
  );
}
