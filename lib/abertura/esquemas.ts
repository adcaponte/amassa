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

// As duas regras cruzadas entre `formaPagamento` e `parcelas` espelham as duas `check`s do banco
// (`abertura_itens_vista_uma_parcela`/`abertura_itens_prazo_duas_ou_mais`) — extraídas em
// funções nomeadas para `esquemaItemDeAbertura` (criação) e `esquemaAtualizacaoDeItem` (edição,
// Tarefa 2 do 04.2-03-PLAN.md) aplicarem a MESMA regra sem reescrevê-la: um `.refine` anexado a
// uma cadeia Zod não pode ser "herdado" por outra cadeia, então reusar a FUNÇÃO (não o texto) é
// o que impede as duas versões da regra divergirem na primeira mudança.
const MENSAGEM_VISTA_UMA_PARCELA = "Um item à vista tem exatamente 1 parcela.";
const MENSAGEM_PRAZO_DUAS_A_36_PARCELAS = "Um item a prazo precisa de 2 a 36 parcelas.";

function itemVistaTemUmaParcela(dados: { formaPagamento: "vista" | "prazo"; parcelas: number }) {
  return dados.formaPagamento !== "vista" || dados.parcelas === 1;
}

function itemPrazoTemDuasA36Parcelas(dados: {
  formaPagamento: "vista" | "prazo";
  parcelas: number;
}) {
  return dados.formaPagamento !== "prazo" || (dados.parcelas >= 2 && dados.parcelas <= 36);
}

// O `transform` final é a única conversão de reais para centavos do módulo — nunca refeita em
// outro arquivo (T-04.2-04, defesa em duas camadas com o `check abertura_itens_valor_nao_negativo`).
export const esquemaItemDeAbertura = esquemaItemBase
  .refine(itemVistaTemUmaParcela, { message: MENSAGEM_VISTA_UMA_PARCELA, path: ["parcelas"] })
  .refine(itemPrazoTemDuasA36Parcelas, {
    message: MENSAGEM_PRAZO_DUAS_A_36_PARCELAS,
    path: ["parcelas"],
  })
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

// Tarefa 2 (04.2-03-PLAN.md, D-18): o esquema de criação MAIS `id` — mesma base
// (`esquemaItemBase`), mesmas duas regras cruzadas (`itemVistaTemUmaParcela`/
// `itemPrazoTemDuasA36Parcelas`), nunca uma segunda cópia da regra de item válido.
export const esquemaAtualizacaoDeItem = esquemaItemBase
  .extend({ id: esquemaId })
  .refine(itemVistaTemUmaParcela, { message: MENSAGEM_VISTA_UMA_PARCELA, path: ["parcelas"] })
  .refine(itemPrazoTemDuasA36Parcelas, {
    message: MENSAGEM_PRAZO_DUAS_A_36_PARCELAS,
    path: ["parcelas"],
  })
  .transform((dados) => ({
    id: dados.id,
    nome: dados.nome,
    categoria: dados.categoria,
    valorEmCentavos: Math.round(dados.valorEmReais * 100),
    formaPagamento: dados.formaPagamento,
    parcelas: dados.parcelas,
    primeiraParcelaEm: dados.primeiraParcelaEm,
    entregaPrevistaEm: dados.entregaPrevistaEm,
  }));

export type EntradaDeAtualizacaoDeItem = z.infer<typeof esquemaAtualizacaoDeItem>;

const GRUPOS_DE_TAREFA = [
  "obra",
  "documentacao",
  "aquisicao",
  "montagem",
  "divulgacao",
  "outros",
] as const;

// Mesmo formato de identificador que `esquemaId` valida, mas OPCIONAL: ausente, vazio ou só com
// espaços vira `null`, nunca cadeia vazia — "ninguém ainda" (D-11) e "tarefa solta" (D-13) são
// estados válidos, não campo não preenchido. A regex é a mesma forma de UUID de `esquemaId`,
// verificada por reconstrução da string (não por `.uuid()` do Zod, que rejeitaria `null` antes
// do `.transform` rodar).
function normalizarIdOpcional(valor: string | undefined | null): string | null {
  const normalizado = (valor ?? "").trim();
  return normalizado === "" ? null : normalizado;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esquemaIdOuNulo(mensagem: string) {
  return z
    .string()
    .optional()
    .nullable()
    .transform((valor) => normalizarIdOpcional(valor))
    .refine((valor) => valor === null || REGEX_UUID.test(valor), mensagem);
}

// `esquemaTarefaBase` — o formato de entrada CRU do formulário de tarefa, exportado para o
// cliente reaproveitar `.shape` campo a campo (mesmo molde de `esquemaItemBase` acima), nunca
// uma segunda cópia da regra. Ao contrário do item, não há regra cruzada entre campos aqui —
// `esquemaTarefaDeAbertura` é o mesmo objeto, sem transform adicional.
export const esquemaTarefaBase = z.object({
  descricao: z
    .string()
    .transform((valor) => valor.normalize("NFC").trim())
    .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Descreva o que precisa ser feito.")
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 160,
      "Descrição muito longa — no máximo 160 caracteres.",
    ),
  grupo: z.enum(GRUPOS_DE_TAREFA, { message: "Escolha um grupo." }),
  prazoEm: esquemaDataCivil,
  // `responsavelId` (D-11) e `itemId` (D-13): uuid OU nulo, nunca texto livre. A conferência de
  // que um `responsavelId` não nulo corresponde a um gestor ATIVO acontece em
  // `lib/abertura/acoes.ts`, não aqui — a chave estrangeira do banco garante que o
  // identificador EXISTE; só o servidor, com uma consulta, garante que ele é um gestor ativo
  // (T-04.2-07). Este schema só garante o FORMATO.
  responsavelId: esquemaIdOuNulo("Esse responsável não é válido — recarregue a página e tente de novo."),
  itemId: esquemaIdOuNulo("Esse item não é válido — recarregue a página e tente de novo."),
});

export type EntradaDeTarefaDeAbertura = z.infer<typeof esquemaTarefaBase>;

export const esquemaTarefaDeAbertura = esquemaTarefaBase;

// Tarefa 2 (04.2-03-PLAN.md, D-18): `esquemaTarefaBase` não tem `refine`/`transform` extra (ao
// contrário do item) — `.extend` é reuso direto, sem precisar extrair função nenhuma.
export const esquemaAtualizacaoDeTarefa = esquemaTarefaBase.extend({ id: esquemaId });

export type EntradaDeAtualizacaoDeTarefa = z.infer<typeof esquemaAtualizacaoDeTarefa>;

// A ação de marcação (Tarefa 1, 04.2-03-PLAN.md) recebe o ESTADO DESEJADO, nunca um pedido de
// "inverter" — é isso que torna o salvamento otimista seguro (UI-SPEC §"Salvamento otimista"):
// duas chamadas com o mesmo valor convergem para o mesmo resultado, e uma resposta que chega
// fora de ordem nunca faz a linha piscar de volta. D-07: uma marcação só por item, significando
// "resolvido" — não existe um segundo campo de estado.
export const esquemaMarcacaoDeItem = z.object({
  id: esquemaId,
  resolvido: z.boolean(),
});

export const esquemaMarcacaoDeTarefa = z.object({
  id: esquemaId,
  concluida: z.boolean(),
});

// D-17/ABE-14 (Tarefa 3, 04.2-04-PLAN.md): a data de inauguração — mesma validação de data civil
// do resto do módulo (regex + reconstrução: `2026-02-30` é recusada mesmo tendo o formato certo).
// Sem limite de intervalo: uma inauguração adiada para o ano que vem é legítima, e uma data no
// passado também (D-17 conta com isso — a contagem regressiva continua subindo depois de a data
// passar, em vez de recusar a data em si).
export const esquemaInauguracao = z.object({
  inauguracaoEm: esquemaDataCivil,
});

export type EntradaDeInauguracao = z.infer<typeof esquemaInauguracao>;
