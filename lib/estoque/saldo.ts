// Módulo puro do Estoque — a REGRA DE ALERTA e a arrumação da lista de saldos (plano 06-04).
//
// A regra de alerta mora aqui e SÓ aqui — a lista, o banner, o contador e o bloco do Início (plano
// 06-10) a leem; nenhum componente compara saldo com mínimo por conta própria. EST-04 é literal:
// mínimo zero nunca alerta, e negativo é aviso próprio (D-21), nunca disfarçado de "acabando".
//
// Nenhum import que alcance React, Next, drizzle-orm, pg ou `@/db`; não lê o relógio. Os imports
// de valor são só de módulos também puros (`custo.ts`, `textos.ts`, e — desde o plano 06-05, para a
// prévia do rodapé — `lib/financeiro/formato.ts` e `ROTULO_UNIDADE` de `lib/cadastros/catalogo.ts`,
// ambos sem import de valor nenhum). As funções da lista (banner, contador) recebem o formatador de
// quem chama; a prévia formata aqui porque a frase inteira é a regra.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import { ROTULO_UNIDADE, type Unidade } from "@/lib/cadastros/catalogo";
import { formatarQuantidade, formatarReais } from "@/lib/financeiro/formato";

import { custoMedioCentavosPorUnidade, valorarMovimento, type EntradaComPreco } from "./custo";
import {
  PREFIXO_LINHA_NEGATIVOS,
  PREVIA_NEGATIVO,
  PREVIA_SALDO_JA_CERTO,
  PREVIA_VAZIA,
  previaAbaixoDoMinimo,
  textoContador,
  textoEMais,
  tituloBannerAcabando,
  tituloBannerNegativos,
} from "./textos";

export type SituacaoDoSaldo = "negativo" | "acabando" | "ok";

// O filtro Ativos · Desativados · Todos (D-20, UI-D4) — mesma forma de `FiltroDeForno`.
export type FiltroDeSituacao = "ativos" | "desativados" | "todos";

// O que a lista precisa de cada material — redeclaração estrutural do `SaldoDoItem` de
// `consultas.ts` (que não pode ser importado aqui: aquele módulo alcança o banco).
export type SaldoParaLista = {
  readonly id: string;
  readonly nome: string;
  readonly unidade: Unidade;
  readonly ativo: boolean;
  readonly area: AreaFinanceira;
  readonly categoriaCompraNome: string | null;
  readonly saldoMilesimos: number;
  readonly estoqueMinimoMilesimos: number;
  readonly valorCentavos: number;
  readonly ultimaEntradaComPreco: EntradaComPreco | null;
};

// A ordem fixa das áreas do Financeiro (04.4-UI-SPEC.md), nas pílulas e em todo agrupamento.
export const ORDEM_DAS_AREAS: readonly AreaFinanceira[] = [
  "cafeteria",
  "espaco",
  "pecas",
  "loja",
  "geral",
];

// A classificação — UMA função. Compara milésimos INTEIROS (nunca decimal: "2,5" e "2,500" já
// chegaram aqui como os mesmos 2500). Negativo primeiro e sempre (D-21); acabando é `<=` (D-28,
// `prototipo.html:607-608`) e só quando há mínimo (EST-04: mínimo zero nunca alerta).
export function situacaoDoSaldo({ saldo, minimo }: { saldo: number; minimo: number }): SituacaoDoSaldo {
  if (saldo < 0) {
    return "negativo";
  }
  if (minimo > 0 && saldo <= minimo) {
    return "acabando";
  }
  return "ok";
}

// O alerta de UM material da lista: material desativado não se movimenta nem se compra (UI-D11),
// então não alerta — o cartão dele leva só o chip neutro "Desativado" (UI-SPEC §Aba Saldos).
export function alertaDoItem(
  item: Pick<SaldoParaLista, "ativo" | "saldoMilesimos" | "estoqueMinimoMilesimos">,
): SituacaoDoSaldo {
  if (!item.ativo) {
    return "ok";
  }
  return situacaoDoSaldo({ saldo: item.saldoMilesimos, minimo: item.estoqueMinimoMilesimos });
}

const PESO_DO_ALERTA: Record<SituacaoDoSaldo, number> = { negativo: 0, acabando: 1, ok: 2 };

function compararNomes(a: { nome: string; id: string }, b: { nome: string; id: string }): number {
  // `localeCompare` pt-BR ("Água" antes de "Argila"); o id desempata nomes idênticos, para a
  // ordem nunca depender da ordem em que o banco devolveu as linhas.
  return a.nome.localeCompare(b.nome, "pt-BR") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Negativo, depois acabando, depois o resto — cada grupo por nome. Devolve uma CÓPIA: a entrada
// não é mutada. Filtrar depois de ordenar nunca reordena (`filtrarSaldos` só remove).
export function ordenarSaldos<
  T extends Pick<SaldoParaLista, "id" | "nome" | "ativo" | "saldoMilesimos" | "estoqueMinimoMilesimos">,
>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    const pesoA = PESO_DO_ALERTA[alertaDoItem(a)];
    const pesoB = PESO_DO_ALERTA[alertaDoItem(b)];
    if (pesoA !== pesoB) {
      return pesoA - pesoB;
    }
    return compararNomes(a, b);
  });
}

// A área do material NO ESTOQUE: a da categoria de COMPRA; na falta, a de venda; por último
// "Geral" (D-12, D-27, ADENDO §2).
//
// Por que não reusa `areaDoItem` de `lib/cadastros/catalogo.ts` (Pitfall 5 da pesquisa): aquela
// prefere a VENDA, que é o certo para o Financeiro (quem vendeu, recebe). O Estoque pergunta
// outra coisa — de que prateleira é o material —, e o adendo manda a compra primeiro. Mudar a do
// Financeiro mudaria a atribuição que ele já faz; por isso são duas funções, cada uma no seu lugar.
export function areaDoItemNoEstoque({
  compra,
  venda,
}: {
  compra: AreaFinanceira | null;
  venda: AreaFinanceira | null;
}): AreaFinanceira {
  return compra ?? venda ?? "geral";
}

// Busca sem acento e sem caixa: NFD, fora os diacríticos, minúsculas pt-BR, sem espaço nas pontas.
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export type FiltroDaLista = {
  busca: string;
  // `null` = "Tudo".
  area: AreaFinanceira | null;
  // "Acabando" traz os abaixo do mínimo E os de saldo negativo, cada um com o seu chip (UI-D7).
  acabando: boolean;
  situacao: FiltroDeSituacao;
};

// Roda no cliente, sobre a lista já carregada (dezenas de itens — UI-SPEC, Assunção 8). Só
// remove: a ordem de saída é a de entrada.
export function filtrarSaldos<T extends SaldoParaLista>(
  itens: readonly T[],
  filtro: FiltroDaLista,
): T[] {
  const termo = normalizarBusca(filtro.busca);
  return itens.filter((item) => {
    if (filtro.situacao === "ativos" && !item.ativo) {
      return false;
    }
    if (filtro.situacao === "desativados" && item.ativo) {
      return false;
    }
    if (filtro.area !== null && item.area !== filtro.area) {
      return false;
    }
    if (filtro.acabando && alertaDoItem(item) === "ok") {
      return false;
    }
    if (termo !== "") {
      const casaNome = normalizarBusca(item.nome).includes(termo);
      const casaCategoria = normalizarBusca(item.categoriaCompraNome ?? "").includes(termo);
      if (!casaNome && !casaCategoria) {
        return false;
      }
    }
    return true;
  });
}

// As pílulas de área: só as que têm pelo menos um material, na ordem fixa.
export function areasComMaterial(itens: readonly Pick<SaldoParaLista, "area">[]): AreaFinanceira[] {
  const presentes = new Set(itens.map((item) => item.area));
  return ORDEM_DAS_AREAS.filter((area) => presentes.has(area));
}

export type ResumoDoBanner = {
  // "{N} material está acabando" / "{N} materiais estão acabando"; ou, se SÓ houver negativos,
  // "{N} material(is) com saldo negativo".
  titulo: string;
  // `erro` só quando todos os alertas são negativos — o título vai em `--color-erro`.
  tom: "atencao" | "erro";
  // Até 3 "{nome} ({saldo} {un})" separados por " · ", e "e mais N".
  nomes: string;
  // "Com saldo negativo: …" — só quando há acabando E negativo ao mesmo tempo.
  linhaNegativos: string | null;
};

const NOMES_NO_BANNER = 3;

function listaDeNomes<T extends SaldoParaLista>(
  itens: readonly T[],
  formatarSaldo: (milesimos: number, unidade: Unidade) => string,
): string {
  const partes = itens
    .slice(0, NOMES_NO_BANNER)
    .map((item) => `${item.nome} (${formatarSaldo(item.saldoMilesimos, item.unidade)})`);
  if (itens.length > NOMES_NO_BANNER) {
    partes.push(textoEMais(itens.length - NOMES_NO_BANNER));
  }
  return partes.join(" · ");
}

// O banner é derivado da MESMA lista da seção de saldos: nenhum alerta → `null` (o banner não
// existe). Os nomes saem na ordem de `ordenarSaldos` (por nome dentro de cada grupo).
export function resumoDoBanner<T extends SaldoParaLista>(
  itens: readonly T[],
  formatarSaldo: (milesimos: number, unidade: Unidade) => string,
): ResumoDoBanner | null {
  const ordenados = ordenarSaldos(itens);
  const negativos = ordenados.filter((item) => alertaDoItem(item) === "negativo");
  const acabando = ordenados.filter((item) => alertaDoItem(item) === "acabando");

  if (acabando.length === 0 && negativos.length === 0) {
    return null;
  }
  if (acabando.length === 0) {
    return {
      titulo: tituloBannerNegativos(negativos.length),
      tom: "erro",
      nomes: listaDeNomes(negativos, formatarSaldo),
      linhaNegativos: null,
    };
  }
  return {
    titulo: tituloBannerAcabando(acabando.length),
    tom: "atencao",
    nomes: listaDeNomes(acabando, formatarSaldo),
    linhaNegativos:
      negativos.length > 0
        ? `${PREFIXO_LINHA_NEGATIVOS}${listaDeNomes(negativos, formatarSaldo)}`
        : null,
  };
}

// "{n} de {total} · {R$} em estoque": `total` é a lista do filtro de situação atual, e o valor
// soma só os materiais com saldo POSITIVO (negativo não abate — UI-SPEC §Aba Saldos).
export function contadorDaLista(
  mostrados: number,
  daSituacao: readonly Pick<SaldoParaLista, "saldoMilesimos" | "valorCentavos">[],
  formatarDinheiro: (centavos: number) => string,
): string {
  const valor = daSituacao.reduce(
    (soma, item) => (item.saldoMilesimos > 0 ? soma + item.valorCentavos : soma),
    0,
  );
  return textoContador(mostrados, daSituacao.length, formatarDinheiro(valor));
}

// ---------------------------------------------------------------------------------------------
// O bloco "Estoque acabando" do Início (plano 06-10, D-10, D-21) — a MESMA regra do banner e da
// pílula Acabando (`alertaDoItem`): o Início não compara saldo com mínimo por conta própria.
// ---------------------------------------------------------------------------------------------

export const LINHAS_NO_INICIO = 5;

export type LinhaDoInicio<T> = T & { situacao: Exclude<SituacaoDoSaldo, "ok"> };

// Até 5 linhas — negativo primeiro, depois acabando, cada grupo por nome (`ordenarSaldos`) — e
// `maisN` com o que ficou de fora ("e mais {N}"). Material ok, com mínimo zero e saldo positivo, ou
// desativado (UI-D11) nunca entra.
export function itensParaOInicio<
  T extends Pick<SaldoParaLista, "id" | "nome" | "ativo" | "saldoMilesimos" | "estoqueMinimoMilesimos">,
>(itens: readonly T[]): { linhas: LinhaDoInicio<T>[]; maisN: number } {
  const comAlerta = ordenarSaldos(itens).flatMap((item) => {
    const situacao = alertaDoItem(item);
    return situacao === "ok" ? [] : [{ ...item, situacao }];
  });
  return {
    linhas: comAlerta.slice(0, LINHAS_NO_INICIO),
    maisN: Math.max(0, comAlerta.length - LINHAS_NO_INICIO),
  };
}

// "Nunca contado" (UI-SPEC §Bloco Estoque acabando): há material, e nenhuma movimentação manual foi
// gravada. É a mesma condição do painel da primeira abertura (UI-D3), lida da mesma
// `estadoDoEstoque` — o Início convida a contar em vez de listar negativos que só existem porque
// ninguém contou ainda.
export function estoqueNuncaContado({
  temMaterial,
  temManual,
}: {
  temMaterial: boolean;
  temManual: boolean;
}): boolean {
  return temMaterial && !temManual;
}

// O custo médio que a tela mostra, em centavos por unidade — `null` ("—") quando o material nunca
// teve entrada com preço (D-26: a saída dele grava custo zero, e "R$ 0,00/kg" seria mentira).
export function custoMedioParaExibir(
  item: Pick<SaldoParaLista, "saldoMilesimos" | "valorCentavos" | "ultimaEntradaComPreco">,
): number | null {
  if (item.ultimaEntradaComPreco === null) {
    return null;
  }
  return custoMedioCentavosPorUnidade({
    saldoMilesimos: item.saldoMilesimos,
    valorCentavos: item.valorCentavos,
    ultimaEntradaComPreco: item.ultimaEntradaComPreco,
  });
}

// ---------------------------------------------------------------------------------------------
// A folha completa (plano 06-05): o ajuste pelo contado, a prévia do rodapé, os atalhos e o custo
// da peça pronta. A prévia (plano 06-06, no cliente) e o servidor (`gravarAjuste`, sob a trava)
// leem as MESMAS funções — como `conferirParcelas` na Venda: uma regra, duas leituras. A diferença
// é o saldo: a prévia usa o carregado com a página; o servidor, o lido sob a trava no instante da
// gravação (D-18). Se alguém mexeu no meio, vale o servidor — a prévia era só prévia.
// ---------------------------------------------------------------------------------------------

export type PlanoDeAjuste = { tipo: "nada" } | { tipo: "ajuste"; diferencaMilesimos: number };

// EST-07/EST-08: o ajuste pergunta o CONTADO (nunca a diferença). Diferença = contado − saldo, em
// milésimos inteiros ("2,5" e "2,500" já chegaram como os mesmos 2500). Zero → nada a gravar.
export function planejarAjuste({
  saldoMilesimos,
  contadoMilesimos,
}: {
  saldoMilesimos: number;
  contadoMilesimos: number;
}): PlanoDeAjuste {
  if (!Number.isSafeInteger(contadoMilesimos) || contadoMilesimos < 0) {
    throw new RangeError(
      `planejarAjuste: o contado precisa ser um inteiro de milésimos, zero ou mais (recebido ${contadoMilesimos}).`,
    );
  }
  const diferencaMilesimos = contadoMilesimos - saldoMilesimos;
  return diferencaMilesimos === 0 ? { tipo: "nada" } : { tipo: "ajuste", diferencaMilesimos };
}

// Milésimos inteiros → "3", "2,5", "−1" (sinal de menos TIPOGRÁFICO). A divisão por 1000 só
// acontece aqui, na hora de mostrar.
export function textoDeMilesimos(milesimos: number): string {
  const absoluto = formatarQuantidade(String(Math.abs(milesimos) / 1000));
  return milesimos < 0 ? `−${absoluto}` : absoluto;
}

// Meio-para-cima em inteiros exatos (`BigInt(...)` e não literais `0n`: o tsconfig mira ES2017).
function multiplicarEDividir(a: number, b: number, divisor: number): number {
  const produto = BigInt(a) * BigInt(b);
  const d = BigInt(divisor);
  const dois = BigInt(2);
  return Number((dois * produto + d) / (dois * d));
}

export type TomDaPrevia = "neutra" | "acento" | "atencao" | "erro";

// Um pedaço da frase; `forte` = em negrito na tela (os números — UI-SPEC §Pré-visualização).
export type ParteDaPrevia = { texto: string; forte?: boolean };

export type PreviaDaMovimentacao = { tom: TomDaPrevia; partes: ParteDaPrevia[] };

export type EntradaDaPrevia = {
  tipo: "entrada" | "saida" | "ajuste";
  unidade: Unidade;
  // O estado do material com a página — o mesmo `SaldoDoItem` da lista (saldo, valor e a última
  // entrada com preço bastam para o custo médio de `valorarMovimento`).
  saldoMilesimos: number;
  valorCentavos: number;
  ultimaEntradaComPreco: EntradaComPreco | null;
  minimoMilesimos: number;
  // Entrada e saída: o que foi digitado, já em milésimos; `null` = campo vazio ou inválido.
  quantidadeMilesimos: number | null;
  // Ajuste: o contado, já em milésimos (aceita zero); `null` = campo vazio ou inválido.
  contadoMilesimos: number | null;
  // Entrada: "quanto custou ao todo", em centavos; `null` = ainda sem custo.
  custoCentavos: number | null;
};

function frasePassaDe(
  deMilesimos: number,
  paraMilesimos: number,
  unidade: string,
): ParteDaPrevia[] {
  return [
    { texto: "O saldo passa de " },
    { texto: textoDeMilesimos(deMilesimos), forte: true },
    { texto: " para " },
    { texto: `${textoDeMilesimos(paraMilesimos)} ${unidade}`, forte: true },
    { texto: "." },
  ];
}

// O rodapé da folha: as frases literais da UI-SPEC (tabela "Pré-visualização"). Não bloqueia nada —
// saída que deixa negativo só avisa (D-06). O valor da saída é o de `valorarMovimento`, a MESMA regra
// que vai gravar. Não lê relógio.
export function previaDaMovimentacao(entrada: EntradaDaPrevia): PreviaDaMovimentacao {
  const unidade = ROTULO_UNIDADE[entrada.unidade];
  const saldo = entrada.saldoMilesimos;

  if (entrada.tipo === "ajuste") {
    if (entrada.contadoMilesimos === null) {
      return { tom: "neutra", partes: [{ texto: PREVIA_VAZIA }] };
    }
    const plano = planejarAjuste({ saldoMilesimos: saldo, contadoMilesimos: entrada.contadoMilesimos });
    if (plano.tipo === "nada") {
      return { tom: "neutra", partes: [{ texto: PREVIA_SALDO_JA_CERTO }] };
    }
    const sinal = plano.diferencaMilesimos > 0 ? "+" : "−";
    return {
      tom: "acento",
      partes: [
        { texto: "Diferença de " },
        {
          texto: `${sinal}${textoDeMilesimos(Math.abs(plano.diferencaMilesimos))} ${unidade}`,
          forte: true,
        },
        { texto: ". " },
        ...frasePassaDe(saldo, entrada.contadoMilesimos, unidade),
      ],
    };
  }

  const quantidade = entrada.quantidadeMilesimos;
  if (quantidade === null || quantidade <= 0) {
    return { tom: "neutra", partes: [{ texto: PREVIA_VAZIA }] };
  }

  if (entrada.tipo === "entrada") {
    const partes = frasePassaDe(saldo, saldo + quantidade, unidade);
    if (entrada.custoCentavos !== null) {
      // Custo por UNIDADE inteira (1 unidade = 1000 milésimos), só para mostrar — nunca gravado
      // arredondado (D-19).
      const unitario = multiplicarEDividir(entrada.custoCentavos, 1000, quantidade);
      partes.push(
        { texto: " Custo unitário: " },
        { texto: `${formatarReais(unitario)}/${unidade}`, forte: true },
        { texto: "." },
      );
    }
    return { tom: "acento", partes };
  }

  // Saída.
  const valorado = valorarMovimento(
    {
      saldoMilesimos: saldo,
      valorCentavos: entrada.valorCentavos,
      ultimaEntradaComPreco: entrada.ultimaEntradaComPreco,
    },
    { tipo: "saida", milesimos: quantidade },
  );
  const depois = valorado.estadoDepois.saldoMilesimos;
  const partes = [
    ...frasePassaDe(saldo, depois, unidade),
    { texto: " Vale " },
    { texto: formatarReais(Math.abs(valorado.valorCentavos)), forte: true },
    { texto: " ao custo médio." },
  ];
  // A MESMA regra de alerta da lista: negativo vence acabando, mínimo zero nunca avisa.
  const situacao = situacaoDoSaldo({ saldo: depois, minimo: entrada.minimoMilesimos });
  if (situacao === "negativo") {
    partes.push({ texto: PREVIA_NEGATIVO });
    return { tom: "erro", partes };
  }
  if (situacao === "acabando") {
    partes.push({
      texto: previaAbaixoDoMinimo(textoDeMilesimos(entrada.minimoMilesimos), unidade),
    });
    return { tom: "atencao", partes };
  }
  return { tom: "acento", partes };
}

// Os atalhos de quantidade (herdados, SOMAM ao campo), em unidades inteiras: `ml` segue `g` (a
// mesma ordem de grandeza); `L` e `m` seguem `un`.
const ATALHOS_POR_UNIDADE: Record<Unidade, readonly number[]> = {
  un: [1, 2, 5, 10],
  g: [50, 100, 250, 500],
  ml: [50, 100, 250, 500],
  kg: [1, 5, 10, 25],
  l: [1, 2, 5, 10],
  m: [1, 2, 5, 10],
};

export function atalhosDaUnidade(unidade: Unidade): readonly number[] {
  return ATALHOS_POR_UNIDADE[unidade];
}

// EST-21/D-22: o custo que a entrada de uma peça pronta traz preenchido — custo da peça pela ficha
// × quantidade, em inteiros, meio-para-cima. O custo por peça é o `custoCentavos` de `calcularPeca`
// (canal direto), o mesmo número que a Precificação mostra; quem chama o lê com a página
// (`custosDasPecasProntas`) e o servidor grava o que foi mostrado ou digitado — não recalcula.
export function custoPreenchidoDaPecaPronta({
  custoPorPecaCentavos,
  quantidadeMilesimos,
}: {
  custoPorPecaCentavos: number;
  quantidadeMilesimos: number;
}): number {
  return multiplicarEDividir(custoPorPecaCentavos, quantidadeMilesimos, 1000);
}
