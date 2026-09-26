// Ponto único de validação do módulo de precificação (CLAUDE.md §Validação) — molde de
// `lib/financeiro/esquemas.ts`/`lib/cadastros/esquemas.ts`, REDECLARADO aqui (D-15 do projeto:
// cada módulo tem sua própria cópia).
import { z } from "zod";

import {
  converterPercentualParaPontosBase,
  converterQuantidade,
  converterReaisParaCentavos,
} from "@/lib/financeiro/dinheiro";
import { esquemaId } from "@/lib/financeiro/esquemas";

import { validarFicha, type FichaEmEdicao } from "./ficha";
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

// ---------------------------------------------------------------------------------------------
// Ficha de peça (04.5-04-PLAN.md — D-18/D-19)
// ---------------------------------------------------------------------------------------------

function normalizarTexto(valor: string): string {
  return valor.normalize("NFC").trim();
}

const MENSAGEM_MEDIDA_INVALIDA = 'Não deu para entender esse número. Escreva como "12" ou "0,6".';

// Texto decimal → inteiro na ESCALA pedida (1000 para grama→miligrama e hora→milésimo, 10 para
// cm→mm). Ao contrário de `converterQuantidade` (lib/financeiro/dinheiro.ts), aceita ZERO e vazio
// como zero — os `check`s de `fichas_precificacao` permitem 0 nestes campos (uma peça recém-
// -criada, ainda sem medida digitada, é uma ficha válida embora inútil).
function converterMedidaDaFicha(
  valorTexto: string,
  escala: number,
): { ok: true; valorInteiro: number } | { ok: false; erro: string } {
  const normalizado = valorTexto.replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") {
    return { ok: true, valorInteiro: 0 };
  }
  if (!/^\d+(\.\d{1,3})?$/.test(normalizado)) {
    return { ok: false, erro: MENSAGEM_MEDIDA_INVALIDA };
  }
  return { ok: true, valorInteiro: Math.round(Number(normalizado) * escala) };
}

const MENSAGEM_CONTAGEM_INVALIDA = "Escreva um número inteiro, ou deixe em branco.";

// "5" → 5; vazio → `null` ("não contei" — D-12, `lib/precificacao/ficha.ts::paraContagemInformada`
// decide o que "zero" significa, não este conversor). Nunca aceita fração — é contagem de peças.
function converterContagemDaFicha(
  valorTexto: string,
): { ok: true; valorInteiro: number | null } | { ok: false; erro: string } {
  const normalizado = valorTexto.replace(/\s/g, "");
  if (normalizado === "") {
    return { ok: true, valorInteiro: null };
  }
  if (!/^\d+$/.test(normalizado)) {
    return { ok: false, erro: MENSAGEM_CONTAGEM_INVALIDA };
  }
  return { ok: true, valorInteiro: Number(normalizado) };
}

const camposDeFichaBase = {
  nome: z.string(),
  argilaTexto: z.string(),
  esmalteTexto: z.string(),
  horasTexto: z.string(),
  larguraTexto: z.string(),
  profundidadeTexto: z.string(),
  alturaTexto: z.string(),
  embalagemTexto: z.string(),
  precoMercadoTexto: z.string(),
  precoPraticadoTexto: z.string(),
  cabemBiscoitoTexto: z.string(),
  cabemEsmalteTexto: z.string(),
  exclusiva: z.boolean(),
  categoriaVendaId: esquemaId.nullable(),
};

type CamposDeFichaBrutos = {
  nome: string;
  argilaTexto: string;
  esmalteTexto: string;
  horasTexto: string;
  larguraTexto: string;
  profundidadeTexto: string;
  alturaTexto: string;
  embalagemTexto: string;
  precoMercadoTexto: string;
  precoPraticadoTexto: string;
  cabemBiscoitoTexto: string;
  cabemEsmalteTexto: string;
  exclusiva: boolean;
  categoriaVendaId: string | null;
};

// Converte os textos crus para o formato que `validarFicha` (lib/precificacao/ficha.ts) espera —
// sequencial, para no PRIMEIRO campo que falhar (mesmo molde de
// `lib/cadastros/esquemas.ts::converterCamposDeItem`).
function converterCamposDeFicha(
  dados: CamposDeFichaBrutos,
  ctx: z.RefinementCtx,
): FichaEmEdicao | null {
  const argila = converterMedidaDaFicha(dados.argilaTexto, 1000);
  if (!argila.ok) {
    ctx.addIssue({ code: "custom", message: argila.erro, path: ["argilaTexto"] });
    return null;
  }
  const esmalte = converterMedidaDaFicha(dados.esmalteTexto, 1000);
  if (!esmalte.ok) {
    ctx.addIssue({ code: "custom", message: esmalte.erro, path: ["esmalteTexto"] });
    return null;
  }
  const horas = converterMedidaDaFicha(dados.horasTexto, 1000);
  if (!horas.ok) {
    ctx.addIssue({ code: "custom", message: horas.erro, path: ["horasTexto"] });
    return null;
  }
  const largura = converterMedidaDaFicha(dados.larguraTexto, 10);
  if (!largura.ok) {
    ctx.addIssue({ code: "custom", message: largura.erro, path: ["larguraTexto"] });
    return null;
  }
  const profundidade = converterMedidaDaFicha(dados.profundidadeTexto, 10);
  if (!profundidade.ok) {
    ctx.addIssue({ code: "custom", message: profundidade.erro, path: ["profundidadeTexto"] });
    return null;
  }
  const altura = converterMedidaDaFicha(dados.alturaTexto, 10);
  if (!altura.ok) {
    ctx.addIssue({ code: "custom", message: altura.erro, path: ["alturaTexto"] });
    return null;
  }
  const embalagem = converterReaisParaCentavos(dados.embalagemTexto);
  if (!embalagem.ok) {
    ctx.addIssue({ code: "custom", message: embalagem.erro, path: ["embalagemTexto"] });
    return null;
  }
  const precoMercado = converterReaisParaCentavos(dados.precoMercadoTexto);
  if (!precoMercado.ok) {
    ctx.addIssue({ code: "custom", message: precoMercado.erro, path: ["precoMercadoTexto"] });
    return null;
  }
  const precoPraticado = converterReaisParaCentavos(dados.precoPraticadoTexto);
  if (!precoPraticado.ok) {
    ctx.addIssue({ code: "custom", message: precoPraticado.erro, path: ["precoPraticadoTexto"] });
    return null;
  }
  const cabemBiscoito = converterContagemDaFicha(dados.cabemBiscoitoTexto);
  if (!cabemBiscoito.ok) {
    ctx.addIssue({ code: "custom", message: cabemBiscoito.erro, path: ["cabemBiscoitoTexto"] });
    return null;
  }
  const cabemEsmalte = converterContagemDaFicha(dados.cabemEsmalteTexto);
  if (!cabemEsmalte.ok) {
    ctx.addIssue({ code: "custom", message: cabemEsmalte.erro, path: ["cabemEsmalteTexto"] });
    return null;
  }

  return {
    nome: normalizarTexto(dados.nome),
    argilaMiligramas: argila.valorInteiro,
    esmalteMiligramas: esmalte.valorInteiro,
    horasMilesimos: horas.valorInteiro,
    larguraMm: largura.valorInteiro,
    profundidadeMm: profundidade.valorInteiro,
    alturaMm: altura.valorInteiro,
    embalagemCentavos: embalagem.centavos ?? 0,
    precoMercadoCentavos: precoMercado.centavos,
    precoPraticadoCentavos: precoPraticado.centavos,
    cabemBiscoitoInformado: cabemBiscoito.valorInteiro,
    cabemEsmalteInformado: cabemEsmalte.valorInteiro,
    exclusiva: dados.exclusiva,
    // Ficha exclusiva ignora a categoria (o campo some no diálogo) — normalizado aqui para que
    // NUNCA sobre um id de categoria "fantasma" numa ficha exclusiva gravada no banco.
    categoriaVendaId: dados.exclusiva ? null : dados.categoriaVendaId,
  };
}

// `esquemaFicha`/`esquemaEdicaoDeFicha` — a MESMA `validarFicha` para cliente e servidor (key_links
// do plano); nenhuma checagem de categoria de venda EXISTIR/ESTAR ATIVA acontece aqui — isso
// exige o banco e é feito em `lib/precificacao/acoes.ts`, dentro da transação (T-04.5-19).
export const esquemaFicha = z
  .object(camposDeFichaBase)
  .transform((dados, ctx) => {
    const convertido = converterCamposDeFicha(dados, ctx);
    return convertido === null ? z.NEVER : convertido;
  })
  .superRefine((dados, ctx) => {
    const resultado = validarFicha(dados);
    if (!resultado.ok) {
      ctx.addIssue({ code: "custom", message: resultado.erro });
    }
  });

export const esquemaEdicaoDeFicha = z
  .object({ id: esquemaId, ...camposDeFichaBase })
  .transform((dados, ctx) => {
    const convertido = converterCamposDeFicha(dados, ctx);
    return convertido === null ? z.NEVER : { id: dados.id, ...convertido };
  })
  .superRefine((dados, ctx) => {
    const resultado = validarFicha(dados);
    if (!resultado.ok) {
      ctx.addIssue({ code: "custom", message: resultado.erro });
    }
  });

export type EntradaDeFicha = z.infer<typeof esquemaFicha>;
export type EntradaDeEdicaoDeFicha = z.infer<typeof esquemaEdicaoDeFicha>;
