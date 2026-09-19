// Ponto único de validação do módulo Cadastros — mesmo molde de `lib/financeiro/esquemas.ts`.
// `esquemaId` é REAPROVEITADO de `lib/financeiro/esquemas.ts` (não redeclarado): Financeiro e
// Cadastros são módulos PERMANENTES do mesmo domínio (nunca desmontados como a Abertura), então
// o acoplamento é seguro — decisão explícita do plano, diferente da disciplina "cada módulo
// redeclara" que vale entre módulos que podem ser desmontados independentemente.
import { z } from "zod";

import { converterPercentualParaPontosBase } from "@/lib/financeiro/dinheiro";
import { esquemaId } from "@/lib/financeiro/esquemas";

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
