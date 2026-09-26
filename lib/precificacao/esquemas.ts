// Ponto único de validação do módulo de precificação (CLAUDE.md §Validação) — molde de
// `lib/financeiro/esquemas.ts`/`lib/cadastros/esquemas.ts`, REDECLARADO aqui (D-15 do projeto:
// cada módulo tem sua própria cópia).
import { z } from "zod";

import {
  converterPercentualParaPontosBase,
  converterQuantidade,
  converterReaisParaCentavos,
} from "@/lib/financeiro/dinheiro";

import { CATALOGO_DE_PARAMETROS, type ChaveDeParametro, type DefinicaoDeParametro } from "./parametros";
import { FRASE_INFORME_AS_HORAS } from "./textos";

// A lista fechada de chaves vem do PRÓPRIO catálogo (nunca reescrita à mão aqui) — uma única
// fonte de verdade para o enum do Zod, o `check` do banco e a semente.
const CHAVES_DE_PARAMETRO = CATALOGO_DE_PARAMETROS.map((item) => item.chave) as [
  ChaveDeParametro,
  ...ChaveDeParametro[],
];

function definicaoDe(chave: ChaveDeParametro): DefinicaoDeParametro {
  // Não-nulo: `chave` já passou pelo `z.enum(CHAVES_DE_PARAMETRO)` antes de chegar aqui.
  return CATALOGO_DE_PARAMETROS.find((item) => item.chave === chave)!;
}

type ResultadoDeConversaoDeValor = { ok: true; valorInteiro: number } | { ok: false; erro: string };

// O conversor certo para a UNIDADE da chave — dinheiro e percentual REAPROVEITAM os conversores
// de `lib/financeiro/dinheiro.ts` (nunca reimplementados); só a medida física (kWh/cm/×) usa
// `converterQuantidade`, multiplicada pela escala de milésimos (não existe ainda um conversor de
// "medida" em `lib/financeiro`).
function converterValorDeParametro(chave: ChaveDeParametro, valorTexto: string): ResultadoDeConversaoDeValor {
  const definicao = definicaoDe(chave);

  if (definicao.unidade.startsWith("R$")) {
    const resultado = converterReaisParaCentavos(valorTexto);
    if (!resultado.ok) {
      return resultado;
    }
    if (resultado.centavos === null) {
      return { ok: false, erro: `Informe o valor de "${definicao.rotulo}", em ${definicao.unidade}.` };
    }
    return { ok: true, valorInteiro: resultado.centavos };
  }

  if (definicao.unidade === "%") {
    const resultado = converterPercentualParaPontosBase(valorTexto);
    if (!resultado.ok) {
      return resultado;
    }
    return { ok: true, valorInteiro: resultado.pontosBase };
  }

  // kWh, cm, × — medida física guardada em milésimos (escala 1000, mesma de
  // `lib/precificacao/parametros.ts`).
  const resultado = converterQuantidade(valorTexto);
  if (!resultado.ok) {
    return resultado;
  }
  return { ok: true, valorInteiro: Math.round(Number(resultado.quantidade) * 1000) };
}

// `chave` no enum fechado do catálogo; `valorTexto` passa pelo conversor da UNIDADE daquela
// chave, com mensagem em português dizendo o que é aceito nela.
export const esquemaValorDeParametro = z
  .object({
    chave: z.enum(CHAVES_DE_PARAMETRO),
    valorTexto: z.string(),
  })
  .transform((dados, ctx) => {
    const resultado = converterValorDeParametro(dados.chave, dados.valorTexto);
    if (!resultado.ok) {
      ctx.addIssue({ code: "custom", message: resultado.erro, path: ["valorTexto"] });
      return z.NEVER;
    }
    return { chave: dados.chave, valorInteiro: resultado.valorInteiro };
  });

export const esquemaSeloDeParametro = z.object({
  chave: z.enum(CHAVES_DE_PARAMETRO),
  // O estado DESEJADO do selo (nunca "inverter") — mesma disciplina de `esquemaAtivacao`
  // (lib/cadastros/esquemas.ts).
  medido: z.boolean(),
});

// Mesmo formato decimal de `converterQuantidade` (lib/financeiro/dinheiro.ts), mas com a frase
// "Informe as horas." no lugar da genérica de quantidade — esta tela fala especificamente de
// horas, texto vazio ou zero é a MESMA recusa, nunca "não deu para entender".
function converterHorasMilesimos(
  valorTexto: string,
): { ok: true; horasMilesimos: number } | { ok: false; erro: string } {
  const normalizado = valorTexto.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(normalizado) || Number(normalizado) <= 0) {
    return { ok: false, erro: FRASE_INFORME_AS_HORAS };
  }
  return { ok: true, horasMilesimos: Math.round(Number(normalizado) * 1000) };
}

// Três textos numéricos ("Calcular minha hora", ORC-04): retirada desejada e parte dos custos da
// casa (reais, podem ser zero — `converterReaisParaCentavos` devolve `null` para vazio, tratado
// como zero aqui), horas obrigatória e maior que zero.
export const esquemaCalculoDaHora = z
  .object({
    retiradaTexto: z.string(),
    casaTexto: z.string(),
    horasTexto: z.string(),
  })
  .transform((dados, ctx) => {
    const retirada = converterReaisParaCentavos(dados.retiradaTexto);
    if (!retirada.ok) {
      ctx.addIssue({ code: "custom", message: retirada.erro, path: ["retiradaTexto"] });
      return z.NEVER;
    }
    const casa = converterReaisParaCentavos(dados.casaTexto);
    if (!casa.ok) {
      ctx.addIssue({ code: "custom", message: casa.erro, path: ["casaTexto"] });
      return z.NEVER;
    }
    const horas = converterHorasMilesimos(dados.horasTexto);
    if (!horas.ok) {
      ctx.addIssue({ code: "custom", message: horas.erro, path: ["horasTexto"] });
      return z.NEVER;
    }
    return {
      retiradaCentavos: retirada.centavos ?? 0,
      casaCentavos: casa.centavos ?? 0,
      horasMilesimos: horas.horasMilesimos,
    };
  });

export type EntradaDeValorDeParametro = z.infer<typeof esquemaValorDeParametro>;
export type EntradaDeSeloDeParametro = z.infer<typeof esquemaSeloDeParametro>;
export type EntradaDeCalculoDaHora = z.infer<typeof esquemaCalculoDaHora>;
