// Ponto único de validação do módulo Cadastros — mesmo molde de `lib/financeiro/esquemas.ts`.
// `esquemaId` é REAPROVEITADO de `lib/financeiro/esquemas.ts` (não redeclarado): Financeiro e
// Cadastros são módulos PERMANENTES do mesmo domínio (nunca desmontados como a Abertura), então
// o acoplamento é seguro — decisão explícita do plano, diferente da disciplina "cada módulo
// redeclara" que vale entre módulos que podem ser desmontados independentemente.
import { z } from "zod";

import {
  converterPercentualParaPontosBase,
  converterQuantidade,
  converterReaisParaCentavos,
} from "@/lib/financeiro/dinheiro";
import { esquemaId } from "@/lib/financeiro/esquemas";

import { MAXIMO_DE_INSUMOS_POR_ITEM, validarItem, type InsumoDisponivel } from "./catalogo";
import { FRASE_TAXA_ACIMA_DE_30 } from "./textos";

export { esquemaId };

const GRUPOS = ["receita", "custo", "geral", "fora"] as const;
const AREAS = ["cafeteria", "espaco", "pecas", "loja", "geral"] as const;

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 — é assim que o
// `length()` do Postgres conta a restrição `categorias_nome_comprimento` (db/schema.ts).
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

function normalizarTexto(valor: string): string {
  return valor.normalize("NFC").trim();
}

const campoNome = z
  .string()
  .transform((valor) => normalizarTexto(valor))
  .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Dê um nome para a categoria.")
  .refine(
    (valor) => contarPontosDeCodigo(valor) <= 120,
    "Nome muito longo — no máximo 120 caracteres.",
  );

const camposDeCategoriaBase = {
  nome: campoNome,
  grupo: z.enum(GRUPOS, { message: "Esse grupo não é válido." }),
  area: z.enum(AREAS, { message: "Essa área não é válida." }),
};

// Equivalência grupo↔área — a MESMA regra do `check` `categorias_grupo_area_coerente`
// (db/schema.ts), provada aqui ANTES do banco: grupo `geral`/`fora` exige área `geral`;
// `receita`/`custo` exige uma das quatro de verdade.
function refinarGrupoEArea(
  dados: { grupo: (typeof GRUPOS)[number]; area: (typeof AREAS)[number] },
  ctx: z.RefinementCtx,
) {
  const areaFixa = dados.grupo === "geral" || dados.grupo === "fora";
  if (areaFixa && dados.area !== "geral") {
    ctx.addIssue({
      code: "custom",
      message: "Esse grupo só aceita a área Geral.",
      path: ["area"],
    });
  }
  if (!areaFixa && dados.area === "geral") {
    ctx.addIssue({ code: "custom", message: "Escolha uma área para este grupo.", path: ["area"] });
  }
}

export const esquemaCategoria = z.object(camposDeCategoriaBase).superRefine(refinarGrupoEArea);

export const esquemaEdicaoDeCategoria = z
  .object({ id: esquemaId, ...camposDeCategoriaBase })
  .superRefine(refinarGrupoEArea);

export const esquemaAtivacao = z.object({
  id: esquemaId,
  // O estado DESEJADO (não "inverter") — mesma disciplina de `esquemaMarcacaoDeItem`
  // (lib/abertura/esquemas.ts): duas chamadas com o mesmo valor convergem sempre.
  ativa: z.boolean(),
});

// "3,5" ou "3.5" → 350 pontos-base, recusando acima de 30% (3000 pontos-base) com a frase dos
// 30% — `converterPercentualParaPontosBase` (lib/financeiro/dinheiro.ts) já recusa acima de
// 100%; este esquema aperta o teto para o que faz sentido numa taxa de maquininha.
export const esquemaTaxa = z.object({ percentualTexto: z.string() }).transform((dados, ctx) => {
  const resultado = converterPercentualParaPontosBase(dados.percentualTexto);
  if (!resultado.ok) {
    ctx.addIssue({ code: "custom", message: resultado.erro, path: ["percentualTexto"] });
    return z.NEVER;
  }
  if (resultado.pontosBase > 3000) {
    ctx.addIssue({ code: "custom", message: FRASE_TAXA_ACIMA_DE_30, path: ["percentualTexto"] });
    return z.NEVER;
  }
  return { pontosBase: resultado.pontosBase };
});

// ---------------------------------------------------------------------------------------------
// Catálogo (04.4-05-PLAN.md)
// ---------------------------------------------------------------------------------------------

const UNIDADES = ["un", "g", "kg", "ml", "l", "m"] as const;

const campoNomeItem = z
  .string()
  .transform((valor) => normalizarTexto(valor))
  .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Dê um nome ao item.")
  .refine(
    (valor) => contarPontosDeCodigo(valor) <= 120,
    "Nome muito longo — no máximo 120 caracteres.",
  );

const camposDeItemBase = {
  nome: campoNomeItem,
  categoriaVendaId: esquemaId.nullable(),
  // Vazio = "valor na hora" — a MESMA conversão de `lib/financeiro/dinheiro.ts` usada pela Venda.
  precoTexto: z.string(),
  aparecenaVenda: z.boolean(),
  atalhoVenda: z.boolean(),
  controlaEstoque: z.boolean(),
  atalhoCompra: z.boolean(),
  unidade: z.enum(UNIDADES).nullable(),
  categoriaCompraId: esquemaId.nullable(),
  ficha: z
    .array(z.object({ insumoId: esquemaId, quantidadeTexto: z.string() }))
    .max(MAXIMO_DE_INSUMOS_POR_ITEM, `No máximo ${MAXIMO_DE_INSUMOS_POR_ITEM} insumos por item.`),
};

// Converte os textos crus (preço, quantidade de cada linha da ficha) para os tipos que
// `validarItem` (lib/cadastros/catalogo.ts) espera — a MESMA conversão usada pela Venda
// (`lib/financeiro/dinheiro.ts`), nunca uma segunda regra de formato escrita aqui.
function converterCamposDeItem(
  dados: {
    nome: string;
    categoriaVendaId: string | null;
    precoTexto: string;
    aparecenaVenda: boolean;
    atalhoVenda: boolean;
    controlaEstoque: boolean;
    atalhoCompra: boolean;
    unidade: (typeof UNIDADES)[number] | null;
    categoriaCompraId: string | null;
    ficha: { insumoId: string; quantidadeTexto: string }[];
  },
  ctx: z.RefinementCtx,
) {
  const preco = converterReaisParaCentavos(dados.precoTexto);
  if (!preco.ok) {
    ctx.addIssue({ code: "custom", message: preco.erro, path: ["precoTexto"] });
    return null;
  }

  const fichaConvertida: ({ insumoId: string; quantidade: number } | null)[] = dados.ficha.map(
    (linha, indice) => {
      const resultado = converterQuantidade(linha.quantidadeTexto);
      if (!resultado.ok) {
        ctx.addIssue({
          code: "custom",
          message: resultado.erro,
          path: ["ficha", indice, "quantidadeTexto"],
        });
        return null;
      }
      return { insumoId: linha.insumoId, quantidade: Number(resultado.quantidade) };
    },
  );
  if (fichaConvertida.some((linha) => linha === null)) {
    return null;
  }

  return {
    nome: dados.nome,
    categoriaVendaId: dados.categoriaVendaId,
    precoVendaCentavos: preco.centavos,
    aparecenaVenda: dados.aparecenaVenda,
    atalhoVenda: dados.atalhoVenda,
    controlaEstoque: dados.controlaEstoque,
    atalhoCompra: dados.atalhoCompra,
    unidade: dados.unidade,
    categoriaCompraId: dados.categoriaCompraId,
    ficha: fichaConvertida as { insumoId: string; quantidade: number }[],
  };
}

// `esquemaItem`/`esquemaEdicaoDeItem` são FÁBRICAS (não constantes): `validarItem` precisa do
// retrato dos insumos disponíveis (id → nome/controlaEstoque) para dizer QUAL insumo não tem
// estoque próprio — dado que só existe depois de uma leitura do banco. O diálogo (cliente) e a
// Server Action (servidor) chamam a MESMA `validarItem` com o MESMO formato de entrada; só a
// origem do mapa de insumos muda (o cliente já tem a lista carregada na tela; o servidor carrega
// de novo dentro da própria ação, nunca confiando no que o cliente mandou).
export function esquemaItem(insumosDisponiveis: ReadonlyMap<string, InsumoDisponivel>) {
  return z
    .object(camposDeItemBase)
    .transform((dados, ctx) => {
      const convertido = converterCamposDeItem(dados, ctx);
      return convertido === null ? z.NEVER : convertido;
    })
    .superRefine((dados, ctx) => {
      const resultado = validarItem({ id: null, ...dados }, insumosDisponiveis);
      if (!resultado.ok) {
        ctx.addIssue({ code: "custom", message: resultado.erro });
      }
    });
}

export function esquemaEdicaoDeItem(insumosDisponiveis: ReadonlyMap<string, InsumoDisponivel>) {
  return z
    .object({ id: esquemaId, ...camposDeItemBase })
    .transform((dados, ctx) => {
      const convertido = converterCamposDeItem(dados, ctx);
      return convertido === null ? z.NEVER : { id: dados.id, ...convertido };
    })
    .superRefine((dados, ctx) => {
      const resultado = validarItem(dados, insumosDisponiveis);
      if (!resultado.ok) {
        ctx.addIssue({ code: "custom", message: resultado.erro });
      }
    });
}
