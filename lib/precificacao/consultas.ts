// Leituras do módulo de precificação. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página (mesmo molde de `lib/financeiro/consultas.ts`).
//
// `parametrosVigentes` é a ÚNICA porta por onde ficha, orçamento e tela leem parâmetro — nenhum
// outro módulo monta o `ParametrosDoCalculo` na mão. A taxa do cartão nunca é lida de novo aqui:
// vem de `obterConfiguracaoFinanceira` (lib/financeiro/consultas.ts), a mesma leitura que a 04.4
// já faz — D-16, "não duplicar".
import { desc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { parametrosPrecificacao } from "@/db/schema";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";

import type { ParametrosDoCalculo } from "./calculo";
import { CATALOGO_DE_PARAMETROS, type ChaveDeParametro, type LinhaDeParametro } from "./parametros";

export type ParametroVigente = LinhaDeParametro & { chave: ChaveDeParametro };

export type ParametrosVigentesResultado =
  | {
      ok: true;
      // Os 18, um por chave — o que a TELA precisa (valor, selo, "desde") além do que
      // `calcularPeca` usa.
      porChave: Record<ChaveDeParametro, ParametroVigente>;
      // O mesmo agregado que `calcularPeca` espera — montado aqui, nunca por quem chama.
      calculo: ParametrosDoCalculo;
      taxaCartaoPontosBase: number;
    }
  // Uma chave sem NENHUMA linha vigente na data pedida — a tela precisa saber a diferença entre
  // "vale zero" e "não existe" (nunca finge zero).
  | { ok: false; faltando: ChaveDeParametro[] };

function valorInteiroDe(
  porChave: Map<ChaveDeParametro, ParametroVigente>,
  chave: ChaveDeParametro,
): number {
  // Não-nulo: só é chamada depois de confirmar que `faltando` está vazio.
  return porChave.get(chave)!.valorInteiro;
}

// A linha de maior `vigente_desde <= $1` POR CHAVE, numa consulta só — `distinct on (chave)` com
// `order by chave, vigente_desde desc` é o que o Postgres faz melhor aqui (nunca uma consulta por
// chave, nunca um laço). "hoje" chega por argumento: este módulo nunca lê o relógio.
export async function parametrosVigentes(hoje: string): Promise<ParametrosVigentesResultado> {
  const [linhasVigentes, configuracao] = await Promise.all([
    db
      .selectDistinctOn([parametrosPrecificacao.chave], {
        chave: parametrosPrecificacao.chave,
        valorInteiro: parametrosPrecificacao.valorInteiro,
        medido: parametrosPrecificacao.medido,
        vigenteDesde: parametrosPrecificacao.vigenteDesde,
      })
      .from(parametrosPrecificacao)
      .where(lte(parametrosPrecificacao.vigenteDesde, hoje))
      .orderBy(parametrosPrecificacao.chave, desc(parametrosPrecificacao.vigenteDesde)),
    obterConfiguracaoFinanceira(),
  ]);

  const porChave = new Map<ChaveDeParametro, ParametroVigente>(
    linhasVigentes.map((linha) => [
      linha.chave as ChaveDeParametro,
      { ...linha, chave: linha.chave as ChaveDeParametro },
    ]),
  );

  const faltando = CATALOGO_DE_PARAMETROS.map((definicao) => definicao.chave).filter(
    (chave) => !porChave.has(chave),
  );
  if (faltando.length > 0) {
    return { ok: false, faltando };
  }

  const valor = (chave: ChaveDeParametro) => valorInteiroDe(porChave, chave);

  const calculo: ParametrosDoCalculo = {
    argilaReaisPorKgCentavos: valor("material_argila"),
    esmalteReaisPorKgCentavos: valor("material_esmalte"),
    horaTrabalhoCentavos: valor("trabalho_hora"),
    tarifaEnergiaCentavos: valor("forno_tarifa_energia"),
    kwhBiscoitoMilesimos: valor("forno_kwh_biscoito"),
    kwhEsmalteMilesimos: valor("forno_kwh_esmalte"),
    desgastePorFornadaCentavos: valor("forno_desgaste_por_fornada"),
    perdaPontosBase: valor("perda_unica"),
    lucroPontosBase: valor("preco_lucro"),
    folgaNegociacaoPontosBase: valor("preco_folga_negociacao"),
    impostoPontosBase: valor("preco_imposto_sobre_venda"),
    comissaoGaleriaPontosBase: valor("preco_comissao_galeria"),
  };

  return {
    ok: true,
    porChave: Object.fromEntries(porChave) as Record<ChaveDeParametro, ParametroVigente>,
    calculo,
    taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
  };
}

// O histórico de UM parâmetro, mais recente primeiro — alimenta o "desde" da tela e, no futuro, a
// tela de histórico completo (se um dia existir). Nunca chamado em laço por `parametrosVigentes`
// acima (D1 do plano: uma consulta por chave nunca é o caminho de leitura em massa).
export async function historicoDoParametro(chave: ChaveDeParametro): Promise<LinhaDeParametro[]> {
  return db
    .select({
      valorInteiro: parametrosPrecificacao.valorInteiro,
      medido: parametrosPrecificacao.medido,
      vigenteDesde: parametrosPrecificacao.vigenteDesde,
    })
    .from(parametrosPrecificacao)
    .where(eq(parametrosPrecificacao.chave, chave))
    .orderBy(desc(parametrosPrecificacao.vigenteDesde));
}
