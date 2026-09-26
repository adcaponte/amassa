import { formatarPercentual, formatarReais } from "@/lib/financeiro/formato";
import { formatarFornadas } from "@/lib/orcamentos/formato";
import {
  FRASE_NADA_APARECE_PARA_CLIENTE,
  ROTULO_CUSTO_DE_PRODUZIR_TUDO,
  ROTULO_HORAS_DE_TRABALHO,
  ROTULO_OCUPA_DO_FORNO,
  ROTULO_SOBRA_DEPOIS_DE_IMPOSTO_E_TAXA,
  TITULO_SO_PARA_VOCE,
  textoAvisoDeEstimados,
  textoFornadasOcupadas,
} from "@/lib/orcamentos/textos";
import { formatarHoras } from "@/lib/precificacao/formato";

export type SoParaVoceProps = {
  custoCentavos: number;
  sobraCentavos: number;
  sobraPontosBase: number;
  horasMilesimos: number;
  fornadasBiscoitoMilesimos: number;
  fornadasEsmalteMilesimos: number;
  parametrosEstimados: number;
};

// O painel "Só para você" (D-24) — Server Component, sem interatividade nenhuma (nenhum campo
// aqui é editável): custo de produzir tudo, sobra depois de imposto e taxa, horas de trabalho e
// fornadas ocupadas — tudo o que o cliente NUNCA vê. 🔴 Nenhum campo daqui é lido por qualquer
// componente do documento do cliente (plano 11 monta o PDF a partir de uma estrutura própria, sem
// estes campos) — a separação é estrutural: este componente nunca é importado fora deste editor.
export function SoParaVoce({
  custoCentavos,
  sobraCentavos,
  sobraPontosBase,
  horasMilesimos,
  fornadasBiscoitoMilesimos,
  fornadasEsmalteMilesimos,
  parametrosEstimados,
}: SoParaVoceProps) {
  const sobraPositiva = sobraCentavos >= 0;

  return (
    <section
      data-testid="orcamento-so-para-voce"
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ backgroundColor: "var(--color-acento-fundo)" }}
    >
      <h2 className="text-titulo text-foreground">{TITULO_SO_PARA_VOCE}</h2>
      <p className="text-apoio text-muted-foreground">{FRASE_NADA_APARECE_PARA_CLIENTE}</p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">{ROTULO_CUSTO_DE_PRODUZIR_TUDO}</span>
          <span className="text-corpo text-foreground tabular-nums">{formatarReais(custoCentavos)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">{ROTULO_SOBRA_DEPOIS_DE_IMPOSTO_E_TAXA}</span>
          <span
            data-testid="orcamento-sobra"
            className={`text-corpo tabular-nums ${sobraPositiva ? "text-sucesso" : "text-erro"}`}
          >
            {`${formatarReais(sobraCentavos)} · ${formatarPercentual(sobraPontosBase)}%`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">{ROTULO_HORAS_DE_TRABALHO}</span>
          <span className="text-corpo text-foreground tabular-nums">{formatarHoras(horasMilesimos)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-corpo text-foreground">{ROTULO_OCUPA_DO_FORNO}</span>
          <span className="text-corpo text-foreground tabular-nums">
            {textoFornadasOcupadas(
              formatarFornadas(fornadasBiscoitoMilesimos),
              formatarFornadas(fornadasEsmalteMilesimos),
            )}
          </span>
        </div>
      </div>

      {parametrosEstimados > 0 && (
        <div
          data-testid="orcamento-aviso-estimados"
          role="status"
          className="bg-atencao-fundo text-atencao text-corpo rounded-lg p-3"
        >
          {textoAvisoDeEstimados(parametrosEstimados)}
        </div>
      )}

      {/* Histórico de revisões (D-24) — espaço reservado para o plano 09, que preenche o
          `orcamentoRevisoes` congelado por "Atualizar preços". Nenhum dado de revisão existe
          ainda nesta fase (nenhum orçamento foi atualizado de preço até aqui). */}
    </section>
  );
}
