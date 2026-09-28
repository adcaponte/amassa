// Ponto único de validação das Anotações da casa — todo caminho de escrita desta fase importa
// daqui, nenhum reimplementa a regra por conta própria (CLAUDE.md §Validação). Molde de
// `lib/financeiro/esquemas.ts`: normalização NFC, contagem por PONTOS DE CÓDIGO (nunca
// `texto.length`, que conta unidades UTF-16), mensagens em português.
import { z } from "zod";

import { LIMITE_DE_CARACTERES } from "./folha";

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 (`String.length`) — é
// assim que o `length()` do Postgres conta o `check` de comprimento espelhado em
// `db/schema.ts::anotacoesDaCasa`. Um emoji fora do plano básico multilíngue (ex.: 🔴) ocupa DUAS
// unidades UTF-16 mas UM ponto de código — sem o espalhamento (`[...texto]`), um texto de exatos
// 10.000 emojis passaria pela contagem ingênua como "20.000 caracteres" (recusado por engano) ou,
// pior, um texto de 10.001 pontos de código com emoji poderia escapar de uma contagem por
// unidade UTF-16 que dividisse errado — a aresta `encoding` de GES-10 pede a contagem certa, não
// uma aproximação.
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

// Instante ISO válido — `Date.parse` aceita várias formas (com/sem milissegundos, `Z`/`+00:00`);
// só recusamos o que vira `NaN`.
function instanteIsoValido(valor: string): boolean {
  return !Number.isNaN(Date.parse(valor));
}

const MENSAGEM_TEXTO_MUITO_LONGO = `A anotação passou de ${LIMITE_DE_CARACTERES.toLocaleString("pt-BR")} caracteres — reduza o texto antes de salvar.`;

// Texto vazio é ACEITO (esvaziar a folha é legítimo — "ver o dela" e o próprio uso do dia a dia
// podem deixar a caixa em branco); normalizado para NFC (duas grafias do mesmo acento, ex. "e" +
// acento combinante vs. "é" precomposto, viram a MESMA string e contam igual); limitado por
// pontos de código, nunca por `texto.length`.
export const esquemaSalvarAnotacoes = z.object({
  texto: z
    .string()
    .transform((valor) => valor.normalize("NFC"))
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= LIMITE_DE_CARACTERES,
      MENSAGEM_TEXTO_MUITO_LONGO,
    ),
  // `null` = "nunca vi nenhuma marca ainda" (decidirGravacao trata como "gravar" sempre); um
  // instante ISO válido = a marca que o cliente tinha na tela. Qualquer outra string é recusada.
  vistoEm: z
    .string()
    .refine(instanteIsoValido, "Essa marca de tempo não é válida — recarregue a página e tente de novo.")
    .nullable(),
});

export type EntradaDeSalvarAnotacoes = z.infer<typeof esquemaSalvarAnotacoes>;
