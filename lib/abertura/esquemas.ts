// Ponto único de validação do módulo Abertura do Espaço, no molde de `lib/queimas/esquemas.ts`
// (D-15): todos os caminhos de escrita desta fase importam daqui, nenhum reimplementa a regra
// por conta própria. Validação no cliente é conveniência; esta é a que vale (CLAUDE.md
// §Validação).
import { z } from "zod";

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 (`String.length`) —
// é assim que o `length()` do Postgres conta (`abertura_itens_nome_comprimento`), e os dois
// divergem para qualquer texto fora do plano básico (emoji, acentos compostos). Mesma
// disciplina de `lib/queimas/esquemas.ts`.
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

// Usado por toda ação que recebe um identificador — a mesma fronteira de "isso parece um `id`
// de verdade" antes de qualquer uma delas tocar o banco.
export const esquemaId = z
  .string()
  .uuid("Esse identificador não é válido — recarregue a página e tente de novo.");

// Data civil `YYYY-MM-DD` — validada por regex E por reconstrução (a data precisa existir de
// verdade: `2026-02-30` é recusada mesmo tendo o formato certo).
export function dataCivilValida(valor: string): boolean {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!casamento) {
    return false;
  }
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  if (mes < 1 || mes > 12 || dia < 1) {
    return false;
  }
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia <= diasNoMes;
}

const esquemaDataCivil = z.string().refine(dataCivilValida, "Essa data não é válida.");

const CATEGORIAS = ["moveis", "equipamentos", "material", "utensilios", "obra", "outros"] as const;

// Ausente, vazio ou só com espaços vira `null`, nunca cadeia vazia — mesma normalização de
// `encomendas.clienteNome`.
function normalizarOpcional(valor: string | undefined | null): string | null {
  const normalizado = (valor ?? "").normalize("NFC").trim();
  return normalizado === "" ? null : normalizado;
}

// Formato de entrada CRU (o que o formulário envia) — exportado para o cliente reaproveitar
// `.shape` campo a campo (mesmo molde de `esquemaForno.shape.nome` em
// `components/amassa/queimas/formulario-forno.tsx`), nunca uma segunda cópia da regra.
// `valorEmReais` chega em reais inteiros (como o protótipo); a transformação para
// `valorEmCentavos` acontece só no schema completo abaixo, depois da validação condicional de
// `parcelas` — o resto do sistema só conhece centavos (`lib/abertura/parcelas.ts`).
export const esquemaItemBase = z.object({
  nome: z
    .string()
    .transform((valor) => valor.normalize("NFC").trim())
    .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Dê um nome para o item.")
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 120,
      "Nome muito longo — no máximo 120 caracteres.",
    ),
  categoria: z.enum(CATEGORIAS, { message: "Escolha uma categoria." }),
  valorEmReais: z
    .number()
    .int("O valor precisa ser um número inteiro de reais.")
    .min(0, "O valor não pode ser negativo.")
    .max(10_000_000, "Valor muito alto — confira se não é erro de digitação."),
  formaPagamento: z.enum(["vista", "prazo"], {
    message: "Essa forma de pagamento não é válida.",
  }),
  parcelas: z.number().int("O número de parcelas precisa ser inteiro.").min(1),
  primeiraParcelaEm: esquemaDataCivil,
  entregaPrevistaEm: z
    .string()
    .optional()
    .transform((valor) => normalizarOpcional(valor))
    .refine(
      (valor) => valor === null || dataCivilValida(valor),
      "Essa data de entrega não é válida.",
    ),
});

// O `refine` no objeto inteiro espelha as duas `check`s do banco
// (`abertura_itens_vista_uma_parcela`/`abertura_itens_prazo_duas_ou_mais`): à vista exige
// EXATAMENTE 1 parcela; a prazo exige de 2 a 36. O `transform` final é a única conversão de
// reais para centavos do módulo — nunca refeita em outro arquivo (T-04.2-04, defesa em duas
// camadas com o `check abertura_itens_valor_nao_negativo`).
export const esquemaItemDeAbertura = esquemaItemBase
  .refine((dados) => dados.formaPagamento !== "vista" || dados.parcelas === 1, {
    message: "Um item à vista tem exatamente 1 parcela.",
    path: ["parcelas"],
  })
  .refine(
    (dados) => dados.formaPagamento !== "prazo" || (dados.parcelas >= 2 && dados.parcelas <= 36),
    { message: "Um item a prazo precisa de 2 a 36 parcelas.", path: ["parcelas"] },
  )
  .transform((dados) => ({
    nome: dados.nome,
    categoria: dados.categoria,
    valorEmCentavos: Math.round(dados.valorEmReais * 100),
    formaPagamento: dados.formaPagamento,
    parcelas: dados.parcelas,
    primeiraParcelaEm: dados.primeiraParcelaEm,
    entregaPrevistaEm: dados.entregaPrevistaEm,
  }));

export type EntradaDeItemDeAbertura = z.infer<typeof esquemaItemDeAbertura>;
