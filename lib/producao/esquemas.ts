// Ponto único de validação das ações da Produção (CLAUDE.md §Validação): a Server Action valida
// AQUI, no servidor, sempre. Molde de `lib/estoque/esquemas.ts`.
//
// Do cliente chegam SÓ o id da ordem e a etapa que o botão mostrava (T-06.1-03). A data da etapa
// feita, a etapa atual e a próxima são decididas no servidor, sob a trava da ordem — nunca aceitas
// daqui.
import { z } from "zod";

import { textoParaMilesimos } from "@/lib/estoque/esquemas";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { FRASE_QUANTIDADE_INVALIDA } from "@/lib/estoque/textos";

import {
  ORDEM_DAS_COLUNAS,
  type CaminhoOrdem,
  type EtapaProducao,
  type TipoOrdem,
} from "./etapas";
import {
  FRASE_A_MAIS_INVALIDO,
  FRASE_CAMINHO_INVALIDO,
  FRASE_CASA_PRECISA_DO_CATALOGO,
  FRASE_CLIENTE_LONGO,
  FRASE_CLIENTE_VAZIO,
  FRASE_CUSTO_DE_CADA_PECA_VAZIO,
  FRASE_ENCOMENDA_SEM_ITEM,
  FRASE_ENTREGA_INVALIDA,
  FRASE_ENTREGA_NO_PASSADO,
  FRASE_ESCOLHA_A_CATEGORIA_DE_COMPRA,
  FRASE_ESCOLHA_A_CATEGORIA_DE_VENDA,
  FRASE_ESCOLHA_O_MATERIAL,
  FRASE_FALHA_AO_DAR_BAIXA,
  FRASE_FALHA_AO_AJUSTAR,
  FRASE_FALHA_AO_CONCLUIR,
  FRASE_JA_DESFEITA,
  FRASE_JA_MARCADA,
  FRASE_NOME_DA_ORDEM_LONGO,
  FRASE_NOME_DA_ORDEM_VAZIO,
  FRASE_NOME_DA_PECA_LONGO,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_PARCIAL_ETAPA_MUDOU,
  FRASE_PARCIAL_NAO_INTEIRO,
  FRASE_PECA_NAO_EXISTE,
  FRASE_PECA_VAZIA,
  FRASE_PRECO_DE_VENDA_VAZIO,
  FRASE_QUANTIDADE_DA_PECA,
  FRASE_TIPO_INVALIDO,
  textoPecasDemais,
} from "./textos";

const ETAPAS = ORDEM_DAS_COLUNAS as unknown as readonly [EtapaProducao, ...EtapaProducao[]];

export const esquemaTerminarEtapa = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
  etapaEsperada: z.enum(ETAPAS, { error: FRASE_JA_MARCADA }),
});

export type TerminarEtapaValidado = z.infer<typeof esquemaTerminarEtapa>;

// "Sinal recebido — começar" / "Começar assim mesmo" (plano 03): só o id da ordem. O status e a
// data de início são decididos no servidor, sob a trava da ordem (T-06.1-12).
export const esquemaLiberarOrdem = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
});

export type LiberarOrdemValidado = z.infer<typeof esquemaLiberarOrdem>;

// "Fazer a mais, de segurança" (plano 04, PRD-08): o texto do campo vira inteiro UMA vez, aqui. Só
// dígitos (nada de vírgula, ponto, sinal ou expoente — "2,5" e "1e3" são recusados, não
// arredondados), de 0 a 100.000 — o mesmo intervalo do check `ordem_pecas_a_mais_faixa`. Vazio é
// zero: apagar o campo tira as a mais.
export const A_MAIS_MAXIMO = 100000;

const esquemaAMais = z.string({ error: FRASE_A_MAIS_INVALIDO }).transform((texto, contexto) => {
  const limpo = texto.trim();
  if (limpo === "") {
    return 0;
  }
  if (!/^\d{1,6}$/.test(limpo) || Number(limpo) > A_MAIS_MAXIMO) {
    contexto.addIssue({ code: "custom", message: FRASE_A_MAIS_INVALIDO });
    return z.NEVER;
  }
  return Number(limpo);
});

export const esquemaDefinirAMais = z
  .object({
    ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
    pecaId: z.string().uuid(FRASE_PECA_NAO_EXISTE),
    aMaisTexto: esquemaAMais,
  })
  .transform(({ ordemId, pecaId, aMaisTexto }) => ({ ordemId, pecaId, aMais: aMaisTexto }));

export type DefinirAMaisValidado = z.infer<typeof esquemaDefinirAMais>;

// "Desfazer a última" (plano 05, PRD-03): o id e a etapa que a confirmação mostrava — o servidor só
// desfaz se ela ainda for a última feita, sob a trava (Pitfall 7).
export const esquemaDesfazerEtapa = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
  etapaEsperada: z.enum(ETAPAS, { error: FRASE_JA_DESFEITA }),
});

export type DesfazerEtapaValidado = z.infer<typeof esquemaDesfazerEtapa>;

// "−"/"+" nos dias previstos (plano 05, PRD-12): um dia por toque — nunca um número digitado.
export const esquemaAjustarDiasPrevistos = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
  etapa: z.enum(ETAPAS, { error: FRASE_FALHA_AO_AJUSTAR }),
  delta: z.union([z.literal(-1), z.literal(1)], { error: FRASE_FALHA_AO_AJUSTAR }),
});

export type AjustarDiasPrevistosValidado = z.infer<typeof esquemaAjustarDiasPrevistos>;

// "Já passaram [ ] de {total}" (plano 05, PRD-06): o texto do campo vira inteiro ≥ 0 UMA vez, aqui.
// Só dígitos — "2,5", "1e3", "-1" são recusados, não arredondados. Vazio é `null` (sem parcial). A
// faixa superior (o total de feitas) não é daqui: o módulo puro a decide sob a trava, lendo as
// peças da ordem.
const esquemaPassaram = z
  .string({ error: FRASE_PARCIAL_NAO_INTEIRO })
  .transform((texto, contexto): number | null => {
    const limpo = texto.trim();
    if (limpo === "") {
      return null;
    }
    if (!/^\d{1,9}$/.test(limpo)) {
      contexto.addIssue({ code: "custom", message: FRASE_PARCIAL_NAO_INTEIRO });
      return z.NEVER;
    }
    return Number(limpo);
  });

export const esquemaRegistrarParcial = z
  .object({
    ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
    etapaEsperada: z.enum(ETAPAS, { error: FRASE_PARCIAL_ETAPA_MUDOU }),
    passaramTexto: esquemaPassaram,
  })
  .transform(({ ordemId, etapaEsperada, passaramTexto }) => ({
    ordemId,
    etapaEsperada,
    passaram: passaramTexto,
  }));

export type RegistrarParcialValidado = z.infer<typeof esquemaRegistrarParcial>;

// "Cancelar ordem" (plano 06, PRD-18): só o id da ordem. O status, a data e quem cancelou são
// decididos no servidor, sob a trava da ordem — nunca aceitos daqui (T-06.1-24/25).
export const esquemaCancelarOrdem = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
});

export type CancelarOrdemValidado = z.infer<typeof esquemaCancelarOrdem>;

// ---------------------------------------------------------------------------------------------
// "Nova ordem" (plano 07, PRD-09) — os dois tipos feitos à mão: produção da casa (sem cliente,
// termina guardada no estoque) e a encomenda combinada de boca (com cliente, termina na entrega).
// ---------------------------------------------------------------------------------------------

// Teto técnico de peças por ordem (decidido no plano 07, sem o dono — registrado no SUMMARY): uma
// ordem de boca com mais de 50 linhas diferentes não existe na vida do ateliê, e o teto impede que
// um pedido forjado grave milhares de linhas numa transação só. Não é regra de negócio.
export const LIMITE_DE_PECAS_POR_ORDEM = 50;

// O teto de cada peça — o mesmo do check `ordem_pecas_quantidade_faixa` e de `orcamento_linhas`.
export const QUANTIDADE_MAXIMA_DA_PECA = 100000;

const LIMITE_DO_NOME_DA_ORDEM = 120;
const LIMITE_DO_CLIENTE = 160;
const LIMITE_DO_NOME_DA_PECA = 160;

// Data civil `YYYY-MM-DD` — regex E reconstrução (`2026-02-30` é recusada). Cópia local de
// `lib/financeiro/esquemas.ts::dataCivilValida` (D-15 do projeto: cada módulo com a sua).
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

// Texto obrigatório: normalizado em NFC, aparado e contado em `length` do JavaScript (unidades
// UTF-16). Os checks do banco contam `length(trim(...))` em pontos de código, que nunca passa do
// `length` do JavaScript — então nada que passa aqui é recusado lá (o banco nunca é mais apertado
// que o Zod), e 120 letras acentuadas passam nos dois.
function esquemaTextoObrigatorio(limite: number, fraseVazia: string, fraseLonga: string) {
  return z.unknown().transform((valor, contexto) => {
    const texto = typeof valor === "string" ? valor.normalize("NFC").trim() : "";
    if (texto === "") {
      contexto.addIssue({ code: "custom", message: fraseVazia });
      return z.NEVER;
    }
    if (texto.length > limite) {
      contexto.addIssue({ code: "custom", message: fraseLonga });
      return z.NEVER;
    }
    return texto;
  });
}

// "Quantas": só dígitos, 1..100.000 — "0", "2,5", "1e3", "-1" e vazio são recusados, não
// arredondados.
const esquemaQuantidadeDaPeca = z.unknown().transform((valor, contexto) => {
  const limpo = typeof valor === "string" ? valor.trim() : "";
  const numero = /^\d{1,6}$/.test(limpo) ? Number(limpo) : Number.NaN;
  if (!(numero >= 1 && numero <= QUANTIDADE_MAXIMA_DA_PECA)) {
    contexto.addIssue({ code: "custom", message: FRASE_QUANTIDADE_DA_PECA });
    return z.NEVER;
  }
  return numero;
});

// "Entrega prometida (opcional)": vazia é nula; senão uma data civil que existe. A comparação com
// HOJE não é daqui — "hoje" é da borda (`validarNovaOrdem`, chamada pela ação com o dia de Brasília).
const esquemaEntregaPrometida = z.unknown().transform((valor, contexto): string | null => {
  if (valor === undefined || valor === null) {
    return null;
  }
  const limpo = typeof valor === "string" ? valor.trim() : null;
  if (limpo === "") {
    return null;
  }
  if (limpo === null || !dataCivilValida(limpo)) {
    contexto.addIssue({ code: "custom", message: FRASE_ENTREGA_INVALIDA });
    return z.NEVER;
  }
  return limpo;
});

const esquemaIdDaPeca = z.string({ error: FRASE_PECA_VAZIA }).uuid(FRASE_PECA_VAZIA);

// As três origens de uma peça (D-04/D-13): a ficha de precificação, o item do estoque sem ficha, ou
// o texto livre. O nome gravado (`ordem_pecas.descricao`) da ficha e do item é lido do BANCO pela
// ação e congelado — nunca aceito daqui.
const pecaDeFicha = z
  .object({
    origem: z.literal("ficha"),
    fichaId: esquemaIdDaPeca,
    quantidadeTexto: esquemaQuantidadeDaPeca,
  })
  .transform(({ fichaId, quantidadeTexto }) => ({
    origem: "ficha" as const,
    fichaId,
    quantidade: quantidadeTexto,
  }));

const pecaDoEstoque = z
  .object({
    origem: z.literal("item"),
    itemCatalogoId: esquemaIdDaPeca,
    quantidadeTexto: esquemaQuantidadeDaPeca,
  })
  .transform(({ itemCatalogoId, quantidadeTexto }) => ({
    origem: "item" as const,
    itemCatalogoId,
    quantidade: quantidadeTexto,
  }));

const pecaLivre = z
  .object({
    origem: z.literal("livre"),
    descricao: esquemaTextoObrigatorio(
      LIMITE_DO_NOME_DA_PECA,
      FRASE_PECA_VAZIA,
      FRASE_NOME_DA_PECA_LONGO,
    ),
    quantidadeTexto: esquemaQuantidadeDaPeca,
  })
  .transform(({ descricao, quantidadeTexto }) => ({
    origem: "livre" as const,
    descricao,
    quantidade: quantidadeTexto,
  }));

// Uma origem que o tipo não aceita: recusada com a frase própria, na posição da peça.
function origemRecusada<O extends string>(origem: O, frase: string) {
  return z.object({ origem: z.literal(origem) }).transform((_, contexto) => {
    contexto.addIssue({ code: "custom", message: frase });
    return z.NEVER;
  });
}

// D-05/D-13: a produção da casa só aceita peça do catálogo (ficha ou item); texto livre é recusado.
const pecaDaCasa = z.discriminatedUnion(
  "origem",
  [pecaDeFicha, pecaDoEstoque, origemRecusada("livre", FRASE_CASA_PRECISA_DO_CATALOGO)],
  { error: FRASE_PECA_VAZIA },
);

// D-04: a encomenda de boca aceita a ficha (de linha ou exclusiva) ou o texto livre — o item do
// estoque sem ficha é só da casa.
const pecaDaEncomenda = z.discriminatedUnion(
  "origem",
  [pecaDeFicha, pecaLivre, origemRecusada("item", FRASE_ENCOMENDA_SEM_ITEM)],
  { error: FRASE_PECA_VAZIA },
);

function listaDePecas<T extends z.ZodType>(peca: T) {
  return z
    .array(peca, { error: FRASE_PECA_VAZIA })
    .min(1, FRASE_PECA_VAZIA)
    .max(LIMITE_DE_PECAS_POR_ORDEM, textoPecasDemais(LIMITE_DE_PECAS_POR_ORDEM));
}

const camposComuns = {
  nome: esquemaTextoObrigatorio(
    LIMITE_DO_NOME_DA_ORDEM,
    FRASE_NOME_DA_ORDEM_VAZIO,
    FRASE_NOME_DA_ORDEM_LONGO,
  ),
  caminho: z.enum(["completo", "biscoito"], { error: FRASE_CAMINHO_INVALIDO }),
  entregaPrometida: esquemaEntregaPrometida,
};

export type PecaDaNovaOrdem =
  | { origem: "ficha"; fichaId: string; quantidade: number }
  | { origem: "item"; itemCatalogoId: string; quantidade: number }
  | { origem: "livre"; descricao: string; quantidade: number };

export type NovaOrdemValidada = {
  nome: string;
  tipo: TipoOrdem;
  caminho: CaminhoOrdem;
  clienteNome: string | null;
  entregaPrometida: string | null;
  pecas: PecaDaNovaOrdem[];
};

// Os dois tipos como união discriminada por `tipo`: cada ramo valida TODOS os seus campos de uma
// vez (a folha mostra nome, cliente e peças com erro juntos). Na casa o cliente é descartado.
export const esquemaCriarOrdem = z
  .discriminatedUnion(
    "tipo",
    [
      z.object({
        tipo: z.literal("casa"),
        ...camposComuns,
        clienteNome: z.unknown().transform((): null => null),
        pecas: listaDePecas(pecaDaCasa),
      }),
      z.object({
        tipo: z.literal("encomenda"),
        ...camposComuns,
        clienteNome: esquemaTextoObrigatorio(
          LIMITE_DO_CLIENTE,
          FRASE_CLIENTE_VAZIO,
          FRASE_CLIENTE_LONGO,
        ),
        pecas: listaDePecas(pecaDaEncomenda),
      }),
    ],
    { error: FRASE_TIPO_INVALIDO },
  )
  .transform(
    (dados): NovaOrdemValidada => ({
      nome: dados.nome,
      tipo: dados.tipo,
      caminho: dados.caminho,
      clienteNome: dados.clienteNome,
      entregaPrometida: dados.entregaPrometida,
      pecas: dados.pecas,
    }),
  );

// A chave do campo em que a folha mostra cada erro: "nome", "clienteNome", "entregaPrometida",
// "peca-{i}" (o seletor ou o nome escrito da peça i) e "quantidade-{i}". A lista vazia (ou longa
// demais) cai na primeira peça — a folha sempre tem ao menos uma linha.
export type ErrosDaNovaOrdem = Record<string, string>;

export function campoDaNovaOrdem(caminho: readonly PropertyKey[]): string {
  if (caminho[0] === "pecas") {
    const indice = typeof caminho[1] === "number" ? caminho[1] : 0;
    return caminho[2] === "quantidadeTexto" ? `quantidade-${indice}` : `peca-${indice}`;
  }
  return typeof caminho[0] === "string" ? caminho[0] : "geral";
}

export type ValidacaoDaNovaOrdem =
  | { ok: true; dados: NovaOrdemValidada }
  | { ok: false; erros: ErrosDaNovaOrdem };

// O esquema + a borda do "hoje" (UI-D15: a entrega prometida precisa ser hoje ou depois — uma data
// passada nasce "vai atrasar", quase sempre erro de digitação). `hoje` chega de fora (Brasília, na
// ação; da página, no cliente). A data é conferida contra hoje mesmo se outro campo falhou — a
// folha mostra todos os erros de uma vez. Um erro por campo: o primeiro.
export function validarNovaOrdem(entradaBruta: unknown, hoje: string): ValidacaoDaNovaOrdem {
  const resultado = esquemaCriarOrdem.safeParse(entradaBruta);
  const erros: ErrosDaNovaOrdem = {};
  if (!resultado.success) {
    for (const questao of resultado.error.issues) {
      const campo = campoDaNovaOrdem(questao.path);
      erros[campo] ??= questao.message;
    }
  }

  const entregaBruta =
    typeof entradaBruta === "object" && entradaBruta !== null
      ? (entradaBruta as Record<string, unknown>).entregaPrometida
      : undefined;
  const entrega = typeof entregaBruta === "string" ? entregaBruta.trim() : "";
  if (entrega !== "" && dataCivilValida(entrega) && entrega < hoje) {
    erros.entregaPrometida ??= FRASE_ENTREGA_NO_PASSADO;
  }

  if (resultado.success && Object.keys(erros).length === 0) {
    return { ok: true, dados: resultado.data };
  }
  return { ok: false, erros };
}

// ---------------------------------------------------------------------------------------------
// "Dar baixa" pela ordem (plano 10, PRD-14). Do cliente chegam SÓ o id da ordem, o id do item do
// Estoque, o TEXTO da quantidade e qual material previsto a baixa cobre (T-06.1-36): o destino é
// fixo ("consumo em encomenda"), a área sai de `areaDoDestino`, o valor em R$ do custo médio sob a
// trava do item, e o nome congelado na nota é lido da ordem sob a trava — nada disso vem daqui.
// A quantidade passa pela MESMA conversão da folha do Estoque (`textoParaMilesimos`: > 0, até 3
// casas, na unidade do item).
// ---------------------------------------------------------------------------------------------

const esquemaQuantidadeDaBaixa = z
  .string({ error: FRASE_QUANTIDADE_INVALIDA })
  .transform((texto, contexto) => {
    const resultado = textoParaMilesimos(texto);
    if (!resultado.ok) {
      contexto.addIssue({ code: "custom", message: resultado.erro });
      return z.NEVER;
    }
    return resultado.milesimos;
  });

export const esquemaDarBaixaNaOrdem = z
  .object({
    ordemId: z.string({ error: FRASE_ORDEM_NAO_EXISTE }).uuid(FRASE_ORDEM_NAO_EXISTE),
    itemId: z.string({ error: FRASE_ESCOLHA_O_MATERIAL }).uuid(FRASE_ESCOLHA_O_MATERIAL),
    quantidadeTexto: esquemaQuantidadeDaBaixa,
    // "+ Dar baixa de outro material" manda nulo: a coluna `material_da_ordem` fica vazia.
    material: z.enum(["argila", "esmalte"], { error: FRASE_FALHA_AO_DAR_BAIXA }).nullable(),
    // "Baixa total" (revisão 06.1, WR-101): o que a tela acreditava já baixado deste material, em
    // miligramas — a conta do "total" partiu dele. O servidor refaz a soma SOB A TRAVA DA ORDEM e
    // recusa se mudou (outro celular, ou tela sem recarregar). Nulo na parcial e no "outro".
    baixadoEsperadoMg: z
      .number({ error: FRASE_FALHA_AO_DAR_BAIXA })
      .int(FRASE_FALHA_AO_DAR_BAIXA)
      .min(0, FRASE_FALHA_AO_DAR_BAIXA)
      .max(Number.MAX_SAFE_INTEGER, FRASE_FALHA_AO_DAR_BAIXA)
      .nullish()
      .transform((valor) => valor ?? null),
  })
  .transform(({ ordemId, itemId, quantidadeTexto, material, baixadoEsperadoMg }) => ({
    ordemId,
    itemId,
    milesimos: quantidadeTexto,
    material,
    // Sem material, não há "total" a conferir.
    baixadoEsperadoMg: material === null ? null : baixadoEsperadoMg,
  }));

export type DarBaixaNaOrdemValidado = z.infer<typeof esquemaDarBaixaNaOrdem>;

// ---------------------------------------------------------------------------------------------
// Concluir a ordem (plano 11, PRD-15/PRD-16). Do cliente chegam, por peça, SÓ o texto das perdidas,
// o destino das extras e o texto do custo (T-06.1-42) — boas, entregues, extras e faltam são
// refeitas no servidor pelo módulo puro (`derivarPeca`), sob a trava da ordem; o custo pela ficha é
// calculado no servidor e o digitado só vale quando a ficha não dá custo (T-06.1-41).
// ---------------------------------------------------------------------------------------------

// "Quantas se perderam": vazio é 0 (o padrão da tela). Só dígitos viram número; qualquer outra
// coisa ("2,5", "-1", "1e3") vira `NaN`, que `derivarPeca` recusa com "Diga um número de 0 a
// {feitas}." — a frase precisa das feitas, que só a peça lida sob a trava conhece.
const esquemaPerdidas = z.string({ error: FRASE_FALHA_AO_CONCLUIR }).transform((texto): number => {
  const limpo = texto.trim();
  if (limpo === "") {
    return 0;
  }
  return /^\d{1,9}$/.test(limpo) ? Number(limpo) : Number.NaN;
});

// "Custo de cada peça" (D-14): opcional AQUI — se ele é exigido depende de a ficha dar custo, o que
// só o servidor decide. Vazio vira nulo; zero é recusado (um custo inventado de zero distorceria o
// custo médio); texto inválido recebe a frase de `converterReaisParaCentavos`.
const esquemaCustoDaPeca = z
  .string({ error: FRASE_CUSTO_DE_CADA_PECA_VAZIO })
  .nullish()
  .transform((texto, contexto): number | null => {
    if (texto === null || texto === undefined || texto.trim() === "") {
      return null;
    }
    const conversao = converterReaisParaCentavos(texto);
    if (!conversao.ok) {
      contexto.addIssue({ code: "custom", message: conversao.erro });
      return z.NEVER;
    }
    if (conversao.centavos === null || conversao.centavos <= 0) {
      contexto.addIssue({ code: "custom", message: FRASE_CUSTO_DE_CADA_PECA_VAZIO });
      return z.NEVER;
    }
    return conversao.centavos;
  });

// "Transformar em peça de linha" (D-12, plano 12): a categoria de venda e o preço de venda com que a
// peça EXCLUSIVA vira peça de linha para entrar no Estoque. Vem SÓ quando a folha mostra o passo
// (peça exclusiva, destino Estoque); se ele é exigido depende de a ficha ainda ser exclusiva SOB A
// TRAVA, o que só o servidor decide. A categoria é conferida no banco (existe, ativa, Receitas —
// T-06.1-46); o preço passa pelo conversor do Financeiro e precisa ser > 0.
const esquemaPrecoDeVenda = z
  .string({ error: FRASE_PRECO_DE_VENDA_VAZIO })
  .transform((texto, contexto): number => {
    const conversao = converterReaisParaCentavos(texto);
    if (!conversao.ok) {
      contexto.addIssue({ code: "custom", message: conversao.erro });
      return z.NEVER;
    }
    if (conversao.centavos === null || conversao.centavos <= 0) {
      contexto.addIssue({ code: "custom", message: FRASE_PRECO_DE_VENDA_VAZIO });
      return z.NEVER;
    }
    return conversao.centavos;
  });

const esquemaPromocaoDaPeca = z
  .object(
    {
      categoriaVendaId: z
        .string({ error: FRASE_ESCOLHA_A_CATEGORIA_DE_VENDA })
        .uuid(FRASE_ESCOLHA_A_CATEGORIA_DE_VENDA),
      precoTexto: esquemaPrecoDeVenda,
    },
    { error: FRASE_FALHA_AO_CONCLUIR },
  )
  .transform(({ categoriaVendaId, precoTexto }) => ({
    categoriaVendaId,
    precoCentavos: precoTexto,
  }));

export const esquemaConcluirOrdem = z.object({
  ordemId: z.string({ error: FRASE_ORDEM_NAO_EXISTE }).uuid(FRASE_ORDEM_NAO_EXISTE),
  pecas: z
    .array(
      z
        .object({
          pecaId: z.string({ error: FRASE_PECA_NAO_EXISTE }).uuid(FRASE_PECA_NAO_EXISTE),
          perdidasTexto: esquemaPerdidas,
          destino: z
            .enum(["estoque", "sem_destino"], { error: FRASE_FALHA_AO_CONCLUIR })
            .nullish()
            .transform((destino) => destino ?? null),
          custoTexto: esquemaCustoDaPeca,
          promocao: esquemaPromocaoDaPeca.nullish().transform((promocao) => promocao ?? null),
          // D-13, trocado pelo dono em 30/09/2026: a categoria de compra escolhida para o item
          // que passa a controlar estoque SEM ter categoria. Vem só quando a folha mostra o
          // seletor; se ela é exigida (o item, sob a trava, não tem categoria) e se é uma categoria
          // de compra ATIVA, quem decide é `concluirOrdem`, no banco (`categoriaDeCompraValida`).
          categoriaCompraId: z
            .string({ error: FRASE_ESCOLHA_A_CATEGORIA_DE_COMPRA })
            .uuid(FRASE_ESCOLHA_A_CATEGORIA_DE_COMPRA)
            .nullish()
            .transform((id) => id ?? null),
        })
        .transform(({ pecaId, perdidasTexto, destino, custoTexto, promocao, categoriaCompraId }) => ({
          pecaId,
          perdidas: perdidasTexto,
          destino,
          custoCentavos: custoTexto,
          promocao,
          categoriaCompraId,
        })),
      { error: FRASE_FALHA_AO_CONCLUIR },
    )
    // SEM teto fixo aqui (revisão 06.1, WR-02): a ordem vinda de orçamento (`criarOrdemDoOrcamento`
    // e o bloco D-02 da 0024) tem uma peça por linha do orçamento, sem limite — um teto de 50
    // deixaria a ordem de 51 linhas presa na Entrega para sempre. Quem confere a lista é
    // `concluirOrdem`, SOB A TRAVA: cada peça da ordem exatamente uma vez, contra as peças que a
    // própria ordem tem (senão "As peças desta ordem mudaram…" e a tela recarrega). O teto de 50
    // (`LIMITE_DE_PECAS_POR_ORDEM`) continua só na CRIAÇÃO à mão, em `esquemaCriarOrdem`; o corpo
    // de uma Server Action já é limitado pelo `bodySizeLimit` de `next.config.ts`.
    .min(1, FRASE_FALHA_AO_CONCLUIR),
});

export type ConcluirOrdemValidado = z.infer<typeof esquemaConcluirOrdem>;
