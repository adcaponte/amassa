// Ponto único de validação do Comparador de Compras — todo caminho de escrita desta fase importa
// daqui, nenhum reimplementa a regra por conta própria (CLAUDE.md §Validação: validação no
// cliente é conveniência, esta é a que vale). Molde de `lib/abertura/esquemas.ts`.
import { z } from "zod";

import { esquemaId } from "@/lib/abertura/esquemas";

import { converterPrecoParaCentavos } from "./preco";

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 (`String.length`) —
// é assim que o `length()` do Postgres conta as restrições de `db/schema.ts`. Mesma disciplina
// de `lib/abertura/esquemas.ts`.
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

function normalizarTexto(valor: string): string {
  return valor.normalize("NFC").trim();
}

// Um campo longo opcional (os seis de D-06): ausente vira texto vazio, nunca `undefined` —
// mesma informação que a coluna do banco (`default('')`, nunca nula).
function esquemaCampoLongo() {
  return z
    .string()
    .optional()
    .transform((valor) => normalizarTexto(valor ?? ""))
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 2000,
      "Texto muito longo — no máximo 2000 caracteres.",
    );
}

const SITUACOES = ["cotando", "favorito", "descartado"] as const;

// Formato de entrada CRUA da categoria (o que o diálogo envia) — exportado para o cliente
// reaproveitar `.shape` campo a campo, nunca uma segunda cópia da regra (mesmo molde de
// `esquemaItemBase` em `lib/abertura/esquemas.ts`).
export const esquemaCategoriaBase = z.object({
  nome: z
    .string()
    .transform((valor) => normalizarTexto(valor))
    .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Dê um nome para a categoria.")
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 60,
      "Nome muito longo — no máximo 60 caracteres.",
    ),
});

// Sem `transform` adicional — ao contrário da cotação abaixo, a categoria não tem campo de preço
// para converter, então o esquema de escrita é o mesmo objeto da base.
export const esquemaCategoriaDeCotacao = esquemaCategoriaBase;

export type EntradaDeCategoriaDeCotacao = z.infer<typeof esquemaCategoriaDeCotacao>;

// Formato de entrada CRUA da cotação — exportado para o formulário reaproveitar `.shape` campo a
// campo (`esquemaCotacaoBase.shape.empresa` etc.). `preco` fica como TEXTO aqui: é o formato que
// o campo do formulário produz ("R$ 24.900"), e a conversão para centavos (D-08) acontece só no
// esquema completo abaixo — a ÚNICA conversão de preço do módulo, nunca repetida num componente.
export const esquemaCotacaoBase = z.object({
  categoriaId: esquemaId,
  empresa: z
    .string()
    .transform((valor) => normalizarTexto(valor))
    .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Dê o nome da empresa.")
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 160,
      "Nome muito longo — no máximo 160 caracteres.",
    ),
  produto: z
    .string()
    .optional()
    .transform((valor) => normalizarTexto(valor ?? ""))
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 200,
      "Texto muito longo — no máximo 200 caracteres.",
    ),
  preco: z.string(),
  situacao: z.enum(SITUACOES, { message: "Essa situação não é válida." }),
  diferenciais: esquemaCampoLongo(),
  assistencia: esquemaCampoLongo(),
  pagamento: esquemaCampoLongo(),
  contato: esquemaCampoLongo(),
  observacoes: esquemaCampoLongo(),
  alertas: esquemaCampoLongo(),
});

// O esquema completo transforma o TEXTO do preço no inteiro de centavos ou em `null` (D-07),
// reaproveitando a mesma função pura e testada de `lib/cotacoes/preco.ts` — nunca uma segunda
// versão da regra de conversão. `z.NEVER` interrompe o parse na primeira falha de preço, com a
// frase humana que a própria função devolveu.
export const esquemaCotacao = esquemaCotacaoBase.extend({
  preco: z.string().transform((valor, ctx) => {
    const resultado = converterPrecoParaCentavos(valor);
    if (!resultado.ok) {
      ctx.addIssue({ code: "custom", message: resultado.erro });
      return z.NEVER;
    }
    return resultado.centavos;
  }),
});

export type EntradaDeCotacao = z.infer<typeof esquemaCotacao>;
