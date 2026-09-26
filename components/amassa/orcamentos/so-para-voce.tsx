import { formatarDataCurta, formatarPercentual, formatarReais } from "@/lib/financeiro/formato";
import { formatarFornadas } from "@/lib/orcamentos/formato";
import {
  FRASE_NADA_APARECE_PARA_CLIENTE,
  ROTULO_CUSTO_DE_PRODUZIR_TUDO,
  ROTULO_HORAS_DE_TRABALHO,
  ROTULO_OCUPA_DO_FORNO,
  ROTULO_SOBRA_DEPOIS_DE_IMPOSTO_E_TAXA,
  TITULO_SO_PARA_VOCE,
  itemDeHistoricoDeRevisao,
  textoAvisoDeEstimados,
  textoFornadasOcupadas,
  textoHistoricoDeRevisoes,
} from "@/lib/orcamentos/textos";
import { formatarHoras } from "@/lib/precificacao/formato";

// Uma revisão guardada (04.5-09-PLAN.md, D-23) — `enviadoEmCivil` já vem como data CIVIL
// (`lib/orcamentos/consultas.ts::listarRevisoes`, convertida na borda a partir do instante
// `enviado_em`), nunca formatada por este componente a partir de um timestamptz bruto.
export type RevisaoParaHistorico = {
  revisao: number;
  enviadoEmCivil: string;
  totalCentavos: number;
};

export type SoParaVoceProps = {
  custoCentavos: number;
  sobraCentavos: number;
  sobraPontosBase: number;
  horasMilesimos: number;
  fornadasBiscoitoMilesimos: number;
  fornadasEsmalteMilesimos: number;
  parametrosEstimados: number;
  // "Calculado com os parâmetros de {data}..." (04.5-08-PLAN.md, D-21) — `null` enquanto rascunho
  // (nada a avisar: os números acima são de HOJE); já pronto, montado por quem chama
  // (`textoAvisoCongelado`, lib/orcamentos/textos.ts) a partir da data CIVIL do envio
  // (`orcamentos.data`, nunca do instante `congeladoEm` — evita o erro de fuso de truncar um
  // timestamptz em data).
  avisoCongelado: string | null;
  // Histórico de revisões (04.5-09-PLAN.md, D-23) — vazio quando "Atualizar preços" nunca foi
  // confirmado num orçamento congelado; nada aparece nesse caso (nenhum must_have pede um estado
  // vazio próprio aqui, ao contrário do resto da tela).
  revisoes: RevisaoParaHistorico[];
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
  avisoCongelado,
  revisoes,
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

      {revisoes.length > 0 && (
        <p data-testid="orcamento-historico-revisoes" className="text-apoio text-muted-foreground">
          {textoHistoricoDeRevisoes(
            revisoes.map((revisao) =>
              itemDeHistoricoDeRevisao(
                revisao.revisao,
                formatarDataCurta(revisao.enviadoEmCivil),
                formatarReais(revisao.totalCentavos),
              ),
            ),
          )}
        </p>
      )}

      {avisoCongelado && (
        <p data-testid="orcamento-aviso-congelado" className="text-apoio text-muted-foreground">
          {avisoCongelado}
        </p>
      )}
    </section>
  );
}
