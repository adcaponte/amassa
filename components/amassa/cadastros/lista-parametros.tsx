"use client";

import { useState } from "react";

import Link from "next/link";

import { formatarDataCurta, formatarPercentual } from "@/lib/financeiro/formato";
import { parametrosDoPrecoFazemSentido } from "@/lib/precificacao/calculo";
import type { ParametroVigente, ParametrosVigentesResultado } from "@/lib/precificacao/consultas";
import {
  CATALOGO_DE_PARAMETROS,
  semSeloDoParametro,
  type ChaveDoCalculo,
  type ChaveForaDoCalculo,
  type DefinicaoDeParametro,
  type GrupoDeParametro,
} from "@/lib/precificacao/parametros";
import { dicaDaReguaNosParametros } from "@/lib/queimas/textos";
import type { PerdaMedida } from "@/lib/producao/perda";
import {
  FRASE_PERDA_MEDIDA_ERRO,
  FRASE_PERDA_SEM_MEDIDA,
  TITULO_PERDA_MEDIDA,
  textoExplicacaoDaPerdaMedida,
  textoPercentualDaPerdaMedida,
} from "@/lib/producao/textos";
import {
  DICA_ESTIMADO_MEDIDO,
  DICA_PERCENTUAL_DIVIDE,
  DICA_TAXA_E_QUANTAS_CABEM,
  DICA_TAXA_LEITURA,
  FRASE_DIVISOR_INVALIDO,
  FRASE_ERRO_CORPO,
  FRASE_ERRO_TITULO,
  FRASE_REGUA_AUSENTE,
  LINHAS_COMO_O_PRECO_E_MONTADO,
  ROTULO_CALCULAR_HORA,
  ROTULO_TENTAR_DE_NOVO,
  TITULO_COMO_O_PRECO_E_MONTADO,
  TITULO_PARAMETROS,
  TITULO_TAXA_LEITURA,
} from "@/lib/precificacao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

import { CampoParametro } from "./campo-parametro";
import { DialogoCalcularHora } from "./dialogo-calcular-hora";

export type ListaParametrosProps = {
  resultado: ParametrosVigentesResultado;
  // A perda medida dos últimos 6 meses (D-08), calculada no Server Component; "erro" quando a
  // leitura falhou — só a linha dela avisa.
  perdaMedida: PerdaMedida | "erro";
};

// A ordem dos grupos vem do PRÓPRIO catálogo (nunca reescrita à mão aqui) — mesma ordem do
// protótipo: Material · Trabalho · Forno · Perda · No preço; e, no fim, "Queimas" (a régua P · M · G
// das Queimas, Fase 06.4 — o único grupo que não é da precificação).
const GRUPOS_EM_ORDEM: readonly GrupoDeParametro[] = [
  ...new Set(CATALOGO_DE_PARAMETROS.map((definicao) => definicao.grupo)),
];

// "use client" (mesmo molde de `ListaCategorias`/`ListaContasFixas`): o único estado local é
// "o diálogo de Calcular minha hora está aberto" — os 18 campos e o selo são
// `CampoParametro`, cada um dono da própria gravação.
export function ListaParametros({ resultado, perdaMedida }: ListaParametrosProps) {
  const [dialogoHoraAberto, setDialogoHoraAberto] = useState(false);

  // `faltando`: uma chave sem nenhuma linha vigente — não deveria acontecer em produção (D-17:
  // a semente sempre popula as 18), mas a tela nunca finge zero. Mesma frase de "não deu para
  // carregar" do resto do módulo, com "Tentar de novo" recarregando a mesma sub-aba.
  if (!resultado.ok) {
    return (
      <EstadoErro
        titulo={FRASE_ERRO_TITULO}
        corpo={FRASE_ERRO_CORPO}
        acao={
          <Button asChild variant="default" className="min-h-[44px]">
            <Link href="/gestao/cadastros?sub=parametros">{ROTULO_TENTAR_DE_NOVO}</Link>
          </Button>
        }
      />
    );
  }

  const { porChave, foraDoCalculo, calculo, taxaCartaoPontosBase } = resultado;
  // A linha vigente de cada definição: as 18 do cálculo em `porChave` (sempre presentes, com `ok`);
  // a régua em `foraDoCalculo` (ausente antes da 0030).
  const linhaDe = (definicao: DefinicaoDeParametro): ParametroVigente | undefined =>
    definicao.foraDoCalculo === true
      ? foraDoCalculo[definicao.chave as ChaveForaDoCalculo]
      : porChave[definicao.chave as ChaveDoCalculo];
  const reguaP = foraDoCalculo.queima_regua_p_ate;
  const reguaM = foraDoCalculo.queima_regua_m_ate;
  const reguaCompleta = reguaP !== undefined && reguaM !== undefined;
  // D-11: lucro + folga + imposto + taxa (ou, desde a D-16, a comissão sozinha) passando do limite —
  // a mesma conta de `calcularPeca`, exposta para avisar ANTES de existir qualquer ficha
  // (`lib/precificacao/calculo.ts`).
  const parametrosFazemSentido = parametrosDoPrecoFazemSentido(calculo, taxaCartaoPontosBase);

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      {/* `sr-only`: o rótulo da sub-aba selecionada ("Parâmetros") já identifica a tela para quem
          vê a barra de pílulas — um `<h1>` visível duplicaria "Cadastros" do cabeçalho da página
          (`layout.tsx`, `CabecalhoPagina`). Fica só para quem usa leitor de tela. */}
      <h2 className="sr-only">{TITULO_PARAMETROS}</h2>

      {GRUPOS_EM_ORDEM.map((grupo) => (
        <section
          key={grupo}
          className="border-border bg-card flex flex-col rounded-lg border p-4"
        >
          <h3 className="text-apoio text-muted-foreground mb-2 font-semibold tracking-[0.06em] uppercase">
            {grupo}
          </h3>

          {grupo === "Queimas" && !reguaCompleta ? (
            // Antes da 0030 a régua não está no banco: nenhum campo dela (editar bateria no check de
            // chaves) e, no lugar, a frase que diz por quê. Os outros grupos aparecem inteiros.
            <p data-testid="parametros-regua-ausente" className="text-apoio text-tinta-fraca">
              {FRASE_REGUA_AUSENTE}
            </p>
          ) : (
            CATALOGO_DE_PARAMETROS.filter((definicao) => definicao.grupo === grupo).map(
              (definicao) => {
                const linha = linhaDe(definicao);
                if (linha === undefined) {
                  return null;
                }
                return (
                  <CampoParametro
                    key={definicao.chave}
                    chave={definicao.chave}
                    rotulo={definicao.rotulo}
                    unidade={definicao.unidade}
                    valorInteiro={linha.valorInteiro}
                    medido={linha.medido}
                    desdeFormatado={formatarDataCurta(linha.vigenteDesde)}
                    semSelo={semSeloDoParametro(definicao.chave)}
                  />
                );
              },
            )
          )}

          {grupo === "Queimas" && reguaCompleta && (
            // A régua de hoje por extenso (UI-D11). Mudar a régua não muda contagem já feita.
            <p data-testid="parametros-regua-dica" className="text-apoio text-tinta-fraca mt-3">
              {dicaDaReguaNosParametros({ pAte: reguaP.valorInteiro, mAte: reguaM.valorInteiro })}
            </p>
          )}

          {grupo === "Trabalho" && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setDialogoHoraAberto(true)}
                data-testid="abrir-calcular-hora"
                className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4 font-medium"
              >
                {ROTULO_CALCULAR_HORA}
              </button>
            </div>
          )}

          {grupo === "Perda" && (
            // A perda MEDIDA (D-08): SÓ LEITURA, no molde da taxa do cartão — nenhum botão, nenhuma
            // escrita. Trocar o parâmetro acima continua sendo à mão.
            <div
              data-testid="parametros-perda-medida"
              className="border-border flex flex-wrap items-start justify-between gap-3 border-t pt-3"
            >
              {perdaMedida === "erro" ? (
                <p role="alert" className="text-apoio text-erro">
                  {FRASE_PERDA_MEDIDA_ERRO}
                </p>
              ) : perdaMedida.pontosBase === null ? (
                <p className="text-apoio text-muted-foreground">{FRASE_PERDA_SEM_MEDIDA}</p>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-corpo text-foreground font-semibold">{TITULO_PERDA_MEDIDA}</span>
                    <span className="text-apoio text-muted-foreground">
                      {textoExplicacaoDaPerdaMedida(
                        perdaMedida.perdidas,
                        perdaMedida.feitas,
                        perdaMedida.ordens,
                      )}
                    </span>
                  </div>
                  <span
                    data-testid="perda-medida-valor"
                    className="text-corpo text-foreground tabular-nums"
                  >
                    {textoPercentualDaPerdaMedida(perdaMedida.pontosBase)}
                  </span>
                </>
              )}
            </div>
          )}

          {grupo === "No preço" && (
            // A taxa do cartão é LEITURA aqui (D-16) — nunca um campo editável; a única forma de
            // mudá-la continua sendo Cadastros → Taxas.
            <div
              data-testid="taxa-do-cartao-leitura"
              className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-corpo text-foreground font-medium">{TITULO_TAXA_LEITURA}</span>
                <span className="text-apoio text-muted-foreground">{DICA_TAXA_LEITURA}</span>
              </div>
              <span className="text-corpo text-foreground tabular-nums">
                {formatarPercentual(taxaCartaoPontosBase)}%
              </span>
            </div>
          )}
        </section>
      ))}

      {!parametrosFazemSentido && (
        <div
          role="alert"
          data-testid="aviso-divisor"
          className="bg-erro-fundo text-erro text-corpo rounded-lg p-4"
        >
          {FRASE_DIVISOR_INVALIDO}
        </div>
      )}

      <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-titulo text-foreground">{TITULO_COMO_O_PRECO_E_MONTADO}</h2>
        <div className="flex flex-col gap-1">
          {LINHAS_COMO_O_PRECO_E_MONTADO.map((linha) => (
            <div key={linha.titulo} className="flex items-center justify-between gap-3">
              <span className="text-corpo text-foreground">{linha.titulo}</span>
              <span className="text-apoio text-muted-foreground">{linha.descricao}</span>
            </div>
          ))}
        </div>
        <p className="text-apoio text-muted-foreground">{DICA_PERCENTUAL_DIVIDE}</p>
        <p className="text-apoio text-muted-foreground">{DICA_ESTIMADO_MEDIDO}</p>
        <p className="text-apoio text-muted-foreground">{DICA_TAXA_E_QUANTAS_CABEM}</p>
      </section>

      <DialogoCalcularHora aberto={dialogoHoraAberto} onFechar={() => setDialogoHoraAberto(false)} />
    </div>
  );
}
