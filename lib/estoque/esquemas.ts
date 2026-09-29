// Ponto único de validação das ações do Estoque (CLAUDE.md §Validação): a Server Action valida
// AQUI, no servidor, sempre; a folha no celular pode reusar `textoParaMilesimos` para avisar antes,
// mas isso é conveniência, não segurança. Molde de `lib/anotacoes/esquemas.ts`.
//
// Do cliente chegam SÓ o id do item, o tipo, os TEXTOS de quantidade, de custo e do contado, o
// destino e os vínculos (T-06-03). Área, valor, custo médio, a DIFERENÇA do ajuste (T-06-22) e se o
// item é peça pronta (T-06-23) são decididos no servidor, sob a trava — nunca aceitos daqui.
import { z } from "zod";

import {
  FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA,
  FRASE_ESTOQUE_SEM_UNIDADE,
  type Unidade,
} from "@/lib/cadastros/catalogo";
import { converterQuantidade, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";

import {
  LIMITE_DO_HISTORICO,
  LIMITE_MAXIMO_DO_HISTORICO,
  PASSO_DO_HISTORICO,
} from "./abas";
import { DESTINOS_DE_SAIDA, ehDestinoDeSaida, type DestinoDeSaida } from "./destinos";
import {
  FRASE_CONTADO_VAZIO,
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_ENCOMENDA_FORA_DE_ANDAMENTO,
  FRASE_MINIMO_INVALIDO,
  FRASE_OBSERVACOES_LONGAS,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  FRASE_TEXTO_INVALIDO,
  FRASE_VINCULO_LONGO,
  LIMITE_DAS_OBSERVACOES,
  LIMITE_DO_VINCULO,
} from "./textos";

export type ResultadoDeMilesimos = { ok: true; milesimos: number } | { ok: false; erro: string };

// "2" → 2000; "0,5" → 500; "2,250" → 2250 — MILÉSIMOS INTEIROS da unidade do item, pela mesma
// conversão de texto do resto do sistema (`converterQuantidade`, vírgula ou ponto, até 3 casas, até
// 999.999). O texto vira inteiro UMA vez, aqui; daí em diante tudo é soma de inteiros (EST-01
// precision: 5 kg − 2 kg dá 3000 milésimos exatos). Zero é recusado com a frase própria do Estoque
// (entrada e saída — o saldo contado, que aceita zero, passa por `contadoParaMilesimos`).
export function textoParaMilesimos(texto: string): ResultadoDeMilesimos {
  const normalizado = texto.replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") {
    return { ok: false, erro: FRASE_QUANTIDADE_INVALIDA };
  }
  const formatoValido = /^\d+(\.\d{1,3})?$/.test(normalizado);
  if (formatoValido && Number(normalizado) === 0) {
    return { ok: false, erro: FRASE_QUANTIDADE_ZERO };
  }
  const conversao = converterQuantidade(normalizado);
  if (!conversao.ok) {
    // Formato certo mas recusado = passou do teto (a frase de `converterQuantidade` diz qual).
    return { ok: false, erro: formatoValido ? conversao.erro : FRASE_QUANTIDADE_INVALIDA };
  }
  return { ok: true, milesimos: Math.round(Number(conversao.quantidade) * 1000) };
}

const esquemaItemId = z.string().uuid(FRASE_MATERIAL_NAO_EXISTE_MAIS);

const esquemaQuantidade = z
  .string({ error: FRASE_QUANTIDADE_INVALIDA })
  .transform((texto, contexto) => {
    const resultado = textoParaMilesimos(texto);
    if (!resultado.ok) {
      contexto.addIssue({ code: "custom", message: resultado.erro });
      return z.NEVER;
    }
    return resultado.milesimos;
  });

// "Quanto custou ao todo" — obrigatório na entrada (é daí que sai o custo médio). Zero é aceito:
// uma doação ou amostra entra de graça, e o custo médio a absorve.
const esquemaCusto = z.string({ error: FRASE_CUSTO_OBRIGATORIO }).transform((texto, contexto) => {
  const conversao = converterReaisParaCentavos(texto);
  if (!conversao.ok) {
    contexto.addIssue({ code: "custom", message: conversao.erro });
    return z.NEVER;
  }
  if (conversao.centavos === null) {
    contexto.addIssue({ code: "custom", message: FRASE_CUSTO_OBRIGATORIO });
    return z.NEVER;
  }
  return conversao.centavos;
});

const esquemaDestino = z
  .unknown()
  .refine((valor): valor is DestinoDeSaida => ehDestinoDeSaida(valor), FRASE_DESTINO_OBRIGATORIO)
  .transform((valor) => valor as DestinoDeSaida);

// O SALDO CONTADO do ajuste (EST-07, D-32): aceita zero — "a prateleira está vazia" é resposta
// válida —, pela variante EXPLÍCITA de `converterQuantidade` (Pitfall 9). Vazio tem frase própria;
// negativo, texto e mais de 3 casas recebem a frase da quantidade.
export function contadoParaMilesimos(texto: string): ResultadoDeMilesimos {
  const normalizado = texto.replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") {
    return { ok: false, erro: FRASE_CONTADO_VAZIO };
  }
  const formatoValido = /^\d+(\.\d{1,3})?$/.test(normalizado);
  const conversao = converterQuantidade(normalizado, { aceitaZero: true });
  if (!conversao.ok) {
    return { ok: false, erro: formatoValido ? conversao.erro : FRASE_QUANTIDADE_INVALIDA };
  }
  return { ok: true, milesimos: Math.round(Number(conversao.quantidade) * 1000) };
}

const esquemaContado = z.string({ error: FRASE_CONTADO_VAZIO }).transform((texto, contexto) => {
  const resultado = contadoParaMilesimos(texto);
  if (!resultado.ok) {
    contexto.addIssue({ code: "custom", message: resultado.erro });
    return z.NEVER;
  }
  return resultado.milesimos;
});

// Texto livre curto (EST-11: turma, "o que aconteceu?", motivo do ajuste): normalizado em NFC,
// aparado, CONTADO EM PONTOS DE CÓDIGO (`[...texto]`, não `.length`, que conta unidades UTF-16 —
// um emoji contaria 2) de 0 a 160; vazio vira nulo. Espelha o `check`
// `movimentacoes_estoque_nota_comprimento` do banco (`length(trim(nota)) between 1 and 160`, que
// conta caracteres), por isso nenhum texto que passa aqui é recusado lá.
const esquemaTextoLivre = z
  .string({ error: FRASE_TEXTO_INVALIDO })
  .nullish()
  .transform((texto, contexto) => {
    if (texto === null || texto === undefined) {
      return null;
    }
    const normalizado = texto.normalize("NFC").trim();
    if (normalizado === "") {
      return null;
    }
    if ([...normalizado].length > LIMITE_DO_VINCULO) {
      contexto.addIssue({ code: "custom", message: FRASE_VINCULO_LONGO });
      return z.NEVER;
    }
    return normalizado;
  });

// A encomenda do destino "Consumo em encomenda" (D-15): referência opcional à encomenda real, por
// id. "Nenhuma" chega como texto vazio → nulo. Se ela existe e está em andamento é a AÇÃO que
// confere, dentro da transação (T-06-24) — aqui só a forma.
const esquemaEncomendaId = z
  .union([z.literal(""), z.string().uuid(FRASE_ENCOMENDA_FORA_DE_ANDAMENTO)])
  .nullish()
  .transform((valor) => (valor ? valor : null));

const esquemaPorTipo = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("entrada"),
    itemId: esquemaItemId,
    quantidadeTexto: esquemaQuantidade,
    custoTexto: esquemaCusto,
  }),
  z.object({
    tipo: z.literal("saida"),
    itemId: esquemaItemId,
    quantidadeTexto: esquemaQuantidade,
    destino: esquemaDestino,
    turmaTexto: esquemaTextoLivre,
    encomendaId: esquemaEncomendaId,
    oQueAconteceuTexto: esquemaTextoLivre,
  }),
  z.object({
    tipo: z.literal("ajuste"),
    itemId: esquemaItemId,
    contadoTexto: esquemaContado,
    motivoTexto: esquemaTextoLivre,
  }),
]);

// Vínculo que não corresponde ao destino marcado é IGNORADO (a folha preserva o que foi digitado
// em cada destino; só o do destino escolhido vale). A lista de destinos é a de `destinos.ts`.
export const esquemaRegistrarMovimentacao = esquemaPorTipo.transform((dados) => {
  if (dados.tipo !== "saida") {
    return dados;
  }
  const vinculo = DESTINOS_DE_SAIDA.find((destino) => destino.valor === dados.destino)?.vinculo;
  return {
    ...dados,
    turmaTexto: vinculo === "turma" ? dados.turmaTexto : null,
    encomendaId: vinculo === "encomenda" ? dados.encomendaId : null,
    oQueAconteceuTexto: vinculo === "o-que-aconteceu" ? dados.oQueAconteceuTexto : null,
  };
});

export type RegistrarMovimentacaoValidado = z.infer<typeof esquemaRegistrarMovimentacao>;

// ---------------------------------------------------------------------------------------------
// A folha de um material (plano 06-09).
// ---------------------------------------------------------------------------------------------

// O tamanho da página da folha do material: múltiplo de 50, de 50 a 1000 — a mesma regra de
// `limiteDaUrl` (abas.ts) da aba Histórico. Qualquer outra coisa (texto, fração, fora do passo,
// acima do teto) vira 50 em vez de recusar: é um parâmetro de paginação, não um dado do usuário, e
// o teto impede que um pedido forjado leia o livro inteiro de uma vez (T-06-42).
const esquemaLimiteDaFolha = z.unknown().transform((valor) => {
  if (
    typeof valor !== "number" ||
    !Number.isInteger(valor) ||
    valor < LIMITE_DO_HISTORICO ||
    valor > LIMITE_MAXIMO_DO_HISTORICO ||
    valor % PASSO_DO_HISTORICO !== 0
  ) {
    return LIMITE_DO_HISTORICO;
  }
  return valor;
});

export const esquemaLerMaterial = z.object({
  itemId: esquemaItemId,
  limite: esquemaLimiteDaFolha,
});

export type LerMaterialValidado = z.infer<typeof esquemaLerMaterial>;

// ---------------------------------------------------------------------------------------------
// "+ Novo material" e "Editar material" (plano 06-09). O nome, a unidade e a categoria de compra
// NÃO são validados aqui: a ação monta a entrada no formato de `esquemaItem` (Cadastros) e usa a
// fábrica de lá — EST-13 é literal, "a mesma validação do Cadastros", com as mesmas frases. Aqui
// fica só o que o Estoque acrescenta ao item: o mínimo e as observações (D-01).
// ---------------------------------------------------------------------------------------------

const UNIDADES_DO_MATERIAL = ["un", "g", "kg", "ml", "l", "m"] as const satisfies readonly Unidade[];

// Estoque mínimo em milésimos da unidade (EST-02 · boundary): zero ou mais — zero = nunca avisa —,
// até 3 casas, pela variante EXPLÍCITA `aceitaZero` de `converterQuantidade` (Pitfall 9). Vazio
// vale zero (o campo começa em 0; apagá-lo é "sem mínimo"). Negativo, texto e 4 casas: a frase do
// mínimo. O `check itens_catalogo_minimo_nao_negativo` do banco é a última camada.
const esquemaMinimo = z.string({ error: FRASE_MINIMO_INVALIDO }).transform((texto, contexto) => {
  const normalizado = texto.replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") {
    return 0;
  }
  const formatoValido = /^\d+(\.\d{1,3})?$/.test(normalizado);
  const conversao = converterQuantidade(normalizado, { aceitaZero: true });
  if (!conversao.ok) {
    // Formato certo mas recusado = passou do teto (a frase de `converterQuantidade` diz qual).
    contexto.addIssue({
      code: "custom",
      message: formatoValido ? conversao.erro : FRASE_MINIMO_INVALIDO,
    });
    return z.NEVER;
  }
  return Math.round(Number(conversao.quantidade) * 1000);
});

// Observações (EST-02 · encoding): NFC, aparadas, CONTADAS EM PONTOS DE CÓDIGO (`[...texto]` — um
// emoji conta 1, como o `length()` do Postgres) de 0 a 500; vazio vira nulo. Espelha o `check
// itens_catalogo_observacoes_comprimento` (`length(trim(observacoes)) between 1 and 500`).
const esquemaObservacoes = z
  .string({ error: FRASE_TEXTO_INVALIDO })
  .nullish()
  .transform((texto, contexto) => {
    if (texto === null || texto === undefined) {
      return null;
    }
    const normalizado = texto.normalize("NFC").trim();
    if (normalizado === "") {
      return null;
    }
    if ([...normalizado].length > LIMITE_DAS_OBSERVACOES) {
      contexto.addIssue({ code: "custom", message: FRASE_OBSERVACOES_LONGAS });
      return z.NEVER;
    }
    return normalizado;
  });

export const esquemaNovoMaterial = z.object({
  // Só a FORMA — o conteúdo é de `esquemaItem` (ver `entradaDeItemDoMaterial`).
  nome: z.string({ error: FRASE_TEXTO_INVALIDO }),
  unidade: z.enum(UNIDADES_DO_MATERIAL, { error: FRASE_ESTOQUE_SEM_UNIDADE }).nullable(),
  categoriaCompraId: z.string({ error: FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA }).nullable(),
  minimoTexto: esquemaMinimo,
  observacoesTexto: esquemaObservacoes,
});

export type NovoMaterialValidado = z.infer<typeof esquemaNovoMaterial>;

export const esquemaSalvarMaterial = z.object({
  itemId: esquemaItemId,
  minimoTexto: esquemaMinimo,
  observacoesTexto: esquemaObservacoes,
});

export type SalvarMaterialValidado = z.infer<typeof esquemaSalvarMaterial>;

function textoOuVazio(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

// A entrada do "+ Novo material" no formato EXATO de `esquemaItem` (lib/cadastros/esquemas.ts): o
// item do Estoque é um item do catálogo sem venda (sem categoria de venda, sem preço, fora da venda
// e dos mais usados), com estoque próprio, fora dos atalhos da compra e sem ficha técnica. Lê a
// entrada CRUA com cuidado (ela ainda não passou por Zod nenhum): o que não for texto vira vazio
// ou nulo, e a fábrica do Cadastros devolve a frase dela.
export function entradaDeItemDoMaterial(entradaBruta: unknown) {
  const bruta =
    typeof entradaBruta === "object" && entradaBruta !== null
      ? (entradaBruta as Record<string, unknown>)
      : {};
  return {
    nome: textoOuVazio(bruta.nome),
    categoriaVendaId: null,
    precoTexto: "",
    aparecenaVenda: false,
    atalhoVenda: false,
    controlaEstoque: true,
    atalhoCompra: false,
    unidade: textoOuNulo(bruta.unidade),
    categoriaCompraId: textoOuNulo(bruta.categoriaCompraId),
    ficha: [],
  };
}

// Os campos das duas folhas de material, para o erro voltar para BAIXO do campo certo (UI-D9).
export type CampoDoMaterial =
  | "nome"
  | "unidade"
  | "categoria"
  | "minimo"
  | "observacoes"
  | "geral";

const CAMPO_DO_CAMINHO: Record<string, CampoDoMaterial> = {
  nome: "nome",
  unidade: "unidade",
  categoriaCompraId: "categoria",
  minimoTexto: "minimo",
  observacoesTexto: "observacoes",
};

// O campo de um problema do Zod: pelo caminho (o nome, o mínimo, as observações) ou, quando a
// regra é de `validarItem` (sem caminho), pela frase do Cadastros.
export function campoDoMaterial(
  caminho: readonly PropertyKey[],
  mensagem: string,
): CampoDoMaterial {
  const primeiro = caminho[0];
  if (typeof primeiro === "string" && primeiro in CAMPO_DO_CAMINHO) {
    return CAMPO_DO_CAMINHO[primeiro];
  }
  if (mensagem === FRASE_ESTOQUE_SEM_UNIDADE) {
    return "unidade";
  }
  if (mensagem === FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA) {
    return "categoria";
  }
  return "geral";
}
