// A regra PURA do “Corrigir” um lançamento (Fase 06.5, plano 16 — D-18 com a UI-D9 do dono,
// 05/10/2026, POL-08). Sem React, sem Next, sem drizzle, sem `pg`, sem `@/db`: só a conta da VERSÃO
// do documento e a lista das origens que não se corrigem por aqui (UI-D10).
//
// A VERSÃO é o marcador que a tela leva ao abrir a correção e devolve ao lançar: sob a trava da
// original, o servidor relê o documento e compara. Diferente → `mudou`, nada gravado. Não serve
// `documentos.atualizado_em` (um “Recebi” numa parcela não o toca); serve uma impressão
// determinística das linhas (id, quantidade, valor, quantidade de estoque), das parcelas (id, valor,
// forma, vencimento, pago em) e do cancelamento.
//
// UMA leitura (`lerParaVersao`, em `gravacao.ts`) e UM normalizador (`normalizarParaVersao`, aqui)
// para a página E para a transação: o driver pode entregar `Date` ou texto, `numeric` como "2" ou
// "2.000", inteiro como número ou texto — a forma canônica apaga essas diferenças, e só ela entra em
// `versaoDoDocumento` (o tipo `FormaDaVersao` não se constrói fora daqui). Assim uma correção válida
// nunca cai em `mudou` por representação.
//
// Desde o plano 17, também o RASCUNHO da correção (`rascunhoDaCorrecao`): os únicos imports são os
// dois módulos puros irmãos do pagamento (`./parcelas`, `./calendario`). Desde o quick 261007-shs
// (BL-01), também a herança da taxa congelada (`taxasHerdadasDaCorrecao`).
import { somarDias, somarMeses } from "./calendario";
import { PLANOS_DE_PAGAMENTO, type FormaDePagamento, type PlanoDePagamento } from "./parcelas";

// Os quatro motivos da recusa, sob a trava (E12 error da UI-SPEC). `cancelada`: a original já estava
// cancelada e ninguém a corrigiu (ou não existe). `ja_corrigida`: cancelada E com vínculo. `mudou`: ativa,
// mas diferente do que a tela leu. `origem`: veio de um módulo que a Venda/Despesa não recria.
export type MotivoDaRecusaDaCorrecao = "cancelada" | "ja_corrigida" | "mudou" | "origem";

// UI-D10 e a extensão às contas fixas (“Decidido sem o dono” do plano 16).
export type OrigemSemCorrecao = "agenda" | "queimas" | "orcamento" | "conta_fixa";

// O que `lerParaVersao` devolve, CRU — do jeito que o driver entregou.
export type LinhaLidaParaVersao = {
  id: string;
  quantidade: number | string;
  valorCentavos: number | string;
  quantidadeEstoque: number | string | null;
};

export type ParcelaLidaParaVersao = {
  id: string;
  valorCentavos: number | string;
  forma: string;
  vencimento: Date | string;
  pagoEm: Date | string | null;
};

export type LeituraParaVersao = {
  canceladoEm: Date | string | null;
  linhas: readonly LinhaLidaParaVersao[];
  parcelas: readonly ParcelaLidaParaVersao[];
};

declare const formaNormalizada: unique symbol;

// A forma canônica: instante em ISO UTC, datas civis em `YYYY-MM-DD`, inteiros como número, a
// quantidade de estoque com 3 casas, linhas e parcelas ordenadas por id. A marca impede que alguém
// passe uma leitura crua a `versaoDoDocumento`.
export type FormaDaVersao = {
  readonly [formaNormalizada]: true;
  readonly canceladoEm: string | null;
  readonly linhas: readonly {
    readonly id: string;
    readonly quantidade: number;
    readonly valorCentavos: number;
    readonly quantidadeEstoque: string | null;
  }[];
  readonly parcelas: readonly {
    readonly id: string;
    readonly valorCentavos: number;
    readonly forma: string;
    readonly vencimento: string;
    readonly pagoEm: string | null;
  }[];
};

function inteiro(valor: number | string, campo: string): number {
  const numero = typeof valor === "number" ? valor : Number(valor.trim());
  if (!Number.isSafeInteger(numero)) {
    throw new Error(`Versão do documento: ${campo} não é um inteiro (${String(valor)}).`);
  }
  return numero;
}

// O texto do Postgres para `timestamptz` (“2026-10-05 15:04:05.123456+00”) não é ISO estrito: o
// espaço vira `T` e o fuso de duas casas ganha os minutos, antes do `Date`.
function instante(valor: Date | string): string {
  const data =
    valor instanceof Date
      ? valor
      : new Date(
          valor
            .trim()
            .replace(" ", "T")
            .replace(/([+-]\d{2})$/, "$1:00"),
        );
  if (Number.isNaN(data.getTime())) {
    throw new Error(`Versão do documento: instante inválido (${String(valor)}).`);
  }
  return data.toISOString();
}

// Data civil. Texto: os 10 primeiros caracteres, conferidos. `Date`: o dia em UTC — o `new
// Date("2026-10-05")` é meia-noite UTC, e a meia-noite local que o `pg` monta com o `TZ` do serviço
// (America/Sao_Paulo, UTC−3) cai às 03:00 UTC do MESMO dia.
function dataCivil(valor: Date | string): string {
  const texto = valor instanceof Date ? valor.toISOString().slice(0, 10) : valor.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new Error(`Versão do documento: data inválida (${String(valor)}).`);
  }
  return texto;
}

// `numeric(12,3)` com três casas: 2, "2", "2.0" e "2.000" dão "2.000".
function quantidadeDeEstoque(valor: number | string | null): string | null {
  if (valor === null) {
    return null;
  }
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) {
      throw new Error(`Versão do documento: quantidade de estoque inválida (${valor}).`);
    }
    return valor.toFixed(3);
  }
  const casamento = /^(\d+)(?:\.(\d*))?$/.exec(valor.trim());
  if (!casamento) {
    throw new Error(`Versão do documento: quantidade de estoque inválida (${valor}).`);
  }
  const inteira = casamento[1].replace(/^0+(?=\d)/, "");
  const fracao = (casamento[2] ?? "").replace(/0+$/, "").padEnd(3, "0");
  return `${inteira}.${fracao}`;
}

function porId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function normalizarParaVersao(leitura: LeituraParaVersao): FormaDaVersao {
  return {
    canceladoEm: leitura.canceladoEm === null ? null : instante(leitura.canceladoEm),
    linhas: leitura.linhas
      .map((linha) => ({
        id: linha.id,
        quantidade: inteiro(linha.quantidade, "quantidade"),
        valorCentavos: inteiro(linha.valorCentavos, "valor da linha"),
        quantidadeEstoque: quantidadeDeEstoque(linha.quantidadeEstoque),
      }))
      .sort(porId),
    parcelas: leitura.parcelas
      .map((parcela) => ({
        id: parcela.id,
        valorCentavos: inteiro(parcela.valorCentavos, "valor da parcela"),
        forma: parcela.forma,
        vencimento: dataCivil(parcela.vencimento),
        pagoEm: parcela.pagoEm === null ? null : dataCivil(parcela.pagoEm),
      }))
      .sort(porId),
  } as Omit<FormaDaVersao, typeof formaNormalizada> as FormaDaVersao;
}

// FNV-1a de 32 bits, em hexadecimal de 8 casas. Não é segurança (o servidor relê tudo sob a trava);
// é um resumo curto e determinístico para a tela levar e devolver.
function fnv1a32(texto: string): string {
  let hash = 0x811c9dc5;
  for (let indice = 0; indice < texto.length; indice++) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function versaoDoDocumento(forma: FormaDaVersao): string {
  // A cadeia canônica: posições fixas (arrays), nunca a ordem das chaves de um objeto.
  const cadeia = JSON.stringify([
    forma.canceladoEm,
    forma.linhas.map((linha) => [linha.id, linha.quantidade, linha.valorCentavos, linha.quantidadeEstoque]),
    forma.parcelas.map((parcela) => [
      parcela.id,
      parcela.valorCentavos,
      parcela.forma,
      parcela.vencimento,
      parcela.pagoEm,
    ]),
  ]);
  return fnv1a32(cadeia);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// O RASCUNHO da correção (Fase 06.5, plano 17 — UI-D9, UI-D10, UI-D11): o que a Venda/Despesa abre
// preenchida a partir da original. Calculado no SERVIDOR (a página), entregue pronto ao painel.

// A linha da original como `obterDocumentoParaCorrecao` lê (o valor gravado é o FINAL da linha, já com
// a parte do desconto, se houve).
export type LinhaDaOriginal = {
  itemId: string | null;
  descricao: string;
  categoriaId: string;
  quantidade: number;
  valorCentavos: number;
  quantidadeEstoque: string | null;
  // A linha de diferença de um “Recebi/Paguei” com valor diferente (D-01 da 04.4): não é do carrinho.
  ehDiferenca: boolean;
};

export type ParcelaDaOriginal = {
  numero: number;
  vencimento: string;
  valorCentavos: number;
  forma: FormaDePagamento;
  pagoEm: string | null;
  // A taxa congelada no recebimento (só venda paga no cartão; `null` em todo o resto) — BL-01.
  taxaPontosBase: number | null;
};

// BL-01 (quick 261007-shs): a parcela JÁ RECEBIDA da original, como a correção a herda. Lida do banco —
// pela página (só para o aviso estimado da tela) e, sob a trava, por `lancarCorrecaoNaTransacao` (a que
// vale). `pagoEm` aceita `Date` ou texto, pelo mesmo motivo da versão.
export type ParcelaPagaDaOriginal = {
  numero: number;
  pagoEm: Date | string;
  forma: string;
  valorCentavos: number;
  taxaPontosBase: number | null;
};

export type TaxaDaParcelaDaCorrecao = { herdada: true; pontosBase: number | null } | { herdada: false };

export type ParcelaDaNovaParaHeranca = {
  vencimento: Date | string;
  valorCentavos: number;
  forma: string;
  pago: boolean;
};

// O dia civil, ou `null` quando não é data (o campo de data da tela pode estar vazio) — a herança nunca
// lança por causa de um campo em edição; só não casa.
function diaOuNulo(valor: Date | string): string | null {
  try {
    return dataCivil(valor);
  } catch {
    return null;
  }
}

// BL-01 da revisão 06.5 — decisão do dono, 07/10/2026 (quick 261007-shs; D-18/UI-D9). A regra da casa,
// escrita em `gravarVenda`: “mudar a taxa em Cadastros depois não reescreve o passado”. A corrigida nasce
// com parcelas NOVAS, então a parcela que já tinha sido recebida no cartão precisa levar a taxa com que
// foi recebida — senão o líquido dela, o extrato daquele dia, o saldo de toda linha posterior e o Mês do
// passado mudam em silêncio. Só parcela nova, ou em aberto que foi marcada paga agora, usa a taxa de hoje.
//
// Qual parcela da nova é “a mesma” recebida da original (o array devolvido é alinhado com
// `parcelasDaNova`):
// - só concorre parcela da nova PAGA no CARTÃO; todas as outras → `{ herdada: false }`;
// - candidatas: as recebidas da original no CARTÃO, na ordem do número; cada uma casa UMA vez;
// - 1ª passada: o mesmo dia (a parcela paga vence no dia do pagamento — `gravarVenda` grava
//   `pago_em = vencimento`) e o MESMO valor;
// - 2ª passada, para as que sobraram: o mesmo dia, com qualquer valor. Existe porque o dinheiro daquele
//   dia passou pela maquininha com a taxa daquele dia: mudar o valor de uma parcela recebida é uma escolha
//   VISÍVEL na tela; trocar a taxa junto não seria;
// - o que casou herda o `taxaPontosBase` da original, MESMO `null` (recebida no cartão sem taxa gravada
//   continua sem taxa — nunca vira a taxa de hoje).
export function taxasHerdadasDaCorrecao(
  pagasDaOriginal: readonly ParcelaPagaDaOriginal[],
  parcelasDaNova: readonly ParcelaDaNovaParaHeranca[],
): TaxaDaParcelaDaCorrecao[] {
  const candidatas = pagasDaOriginal
    .filter((parcela) => parcela.forma === "cartao")
    .map((parcela) => ({
      numero: parcela.numero,
      dia: diaOuNulo(parcela.pagoEm),
      valorCentavos: parcela.valorCentavos,
      taxaPontosBase: parcela.taxaPontosBase,
      livre: true,
    }))
    .sort((a, b) => a.numero - b.numero);
  const resultado: TaxaDaParcelaDaCorrecao[] = parcelasDaNova.map(() => ({ herdada: false }));
  const concorrentes = parcelasDaNova.flatMap((parcela, indice) => {
    const dia = parcela.pago && parcela.forma === "cartao" ? diaOuNulo(parcela.vencimento) : null;
    return dia === null ? [] : [{ indice, dia, valorCentavos: parcela.valorCentavos }];
  });
  const casadas = new Set<number>();
  for (const mesmoValor of [true, false]) {
    for (const nova of concorrentes) {
      if (casadas.has(nova.indice)) {
        continue;
      }
      const candidata = candidatas.find(
        (original) =>
          original.livre && original.dia === nova.dia && (!mesmoValor || original.valorCentavos === nova.valorCentavos),
      );
      if (candidata) {
        candidata.livre = false;
        casadas.add(nova.indice);
        resultado[nova.indice] = { herdada: true, pontosBase: candidata.taxaPontosBase };
      }
    }
  }
  return resultado;
}

export type OriginalParaRascunho = {
  data: string;
  pessoaNome: string | null;
  linhas: readonly LinhaDaOriginal[];
  // Na ordem do número da parcela.
  parcelas: readonly ParcelaDaOriginal[];
};

export type LinhaDaCorrecao =
  | {
      tipo: "item";
      itemId: string;
      descricao: string;
      categoriaId: string;
      quantidade: number;
      valorCentavos: number;
      quantidadeEstoque: string | null;
    }
  | { tipo: "livre"; descricao: string; categoriaId: string; valorCentavos: number };

export type ParcelaDaCorrecao = {
  vencimento: string;
  valorCentavos: number;
  forma: FormaDePagamento;
  pago: boolean;
};

export type PagamentoDaCorrecao = {
  // O plano que o seletor “Como recebe/paga” mostra — o melhor palpite a partir das parcelas; as
  // parcelas em si vêm como estavam, e é a elas que o painel começa (mudar o carrinho regenera).
  plano: PlanoDePagamento;
  forma: FormaDePagamento;
  duasFormas: boolean;
  parcelas: ParcelaDaCorrecao[];
};

export type RascunhoDaCorrecao = {
  pessoa: string;
  data: string;
  linhas: LinhaDaCorrecao[];
  pagamento: PagamentoDaCorrecao;
  // O nome (da linha da original) de cada item que não está mais ativo no Catálogo — ficou de fora.
  deFora: string[];
  // BL-01: as parcelas JÁ RECEBIDAS da original, com a taxa congelada — só para o aviso do cartão da tela
  // dizer a taxa que de fato vai ser gravada. Quem grava relê sob a trava; nada disto volta do navegador.
  pagasDaOriginal: ParcelaPagaDaOriginal[];
};

const PLANOS_EM_N: readonly PlanoDePagamento[] = PLANOS_DE_PAGAMENTO.filter(
  (plano) => plano !== "avista" && plano !== "sinal",
);

function planoDasParcelas(parcelas: readonly ParcelaDaCorrecao[]): { plano: PlanoDePagamento; duasFormas: boolean } {
  if (parcelas.length <= 1) {
    return { plano: "avista", duasFormas: false };
  }
  if (parcelas.length === 2 && parcelas[0].forma !== parcelas[1].forma) {
    // “+ outra forma” (D-08): o à vista dividido em duas formas.
    return { plano: "avista", duasFormas: true };
  }
  if (
    parcelas.length === 2 &&
    parcelas[1].vencimento === somarDias(parcelas[0].vencimento, 30) &&
    parcelas[1].vencimento !== somarMeses(parcelas[0].vencimento, 1)
  ) {
    return { plano: "sinal", duasFormas: false };
  }
  const emN = PLANOS_EM_N.find((plano) => plano === String(parcelas.length));
  return { plano: emN ?? "avista", duasFormas: false };
}

// UI-D11: o preço é o da LINHA ANTIGA (o valor gravado, não o do Catálogo de hoje). Linhas de
// diferença ficam de fora; linha de item que não está mais ativo (ou não aparece mais na Venda/Compra)
// sai para `deFora`; livres entram com a categoria. O pagamento vem como estava: a parcela PAGA vence
// no dia em que o dinheiro entrou/saiu (`pago_em`) — o escritor grava `pago_em = vencimento`, e assim o
// extrato da nova cai no mesmo dia da original —; o valor e a forma são os que estão gravados, sem
// desfazer diferença nenhuma (nenhum dinheiro muda em silêncio: se não fechar, o painel mostra a falta).
export function rascunhoDaCorrecao(
  original: OriginalParaRascunho,
  itensAtivos: ReadonlySet<string>,
): RascunhoDaCorrecao {
  const linhas: LinhaDaCorrecao[] = [];
  const deFora: string[] = [];
  for (const linha of original.linhas) {
    if (linha.ehDiferenca) {
      continue;
    }
    if (linha.itemId === null) {
      linhas.push({
        tipo: "livre",
        descricao: linha.descricao,
        categoriaId: linha.categoriaId,
        valorCentavos: linha.valorCentavos,
      });
      continue;
    }
    if (!itensAtivos.has(linha.itemId)) {
      if (!deFora.includes(linha.descricao)) {
        deFora.push(linha.descricao);
      }
      continue;
    }
    linhas.push({
      tipo: "item",
      itemId: linha.itemId,
      descricao: linha.descricao,
      categoriaId: linha.categoriaId,
      quantidade: linha.quantidade,
      valorCentavos: linha.valorCentavos,
      quantidadeEstoque: linha.quantidadeEstoque,
    });
  }

  const parcelas: ParcelaDaCorrecao[] = original.parcelas.map((parcela) => ({
    vencimento: parcela.pagoEm ?? parcela.vencimento,
    valorCentavos: parcela.valorCentavos,
    forma: parcela.forma,
    pago: parcela.pagoEm !== null,
  }));
  const { plano, duasFormas } = planoDasParcelas(parcelas);

  return {
    pessoa: original.pessoaNome ?? "",
    data: original.data,
    linhas,
    pagamento: { plano, forma: parcelas[0]?.forma ?? "pix", duasFormas, parcelas },
    deFora,
    pagasDaOriginal: original.parcelas.flatMap((parcela) =>
      parcela.pagoEm === null
        ? []
        : [
            {
              numero: parcela.numero,
              pagoEm: parcela.pagoEm,
              forma: parcela.forma,
              valorCentavos: parcela.valorCentavos,
              taxaPontosBase: parcela.taxaPontosBase,
            },
          ],
    ),
  };
}

// Por que este documento NÃO se corrige pela Venda/Despesa (UI-D10): a tela preenchida não recria o
// vínculo com a inscrição/mensalidade/uso livre, com a queima, com o orçamento ou com a conta fixa —
// corrigir por aqui desligaria a cobrança da origem. `null` = corrige.
export function motivoSemCorrecao(origens: {
  temAgenda: boolean;
  temQueima: boolean;
  temOrcamento: boolean;
  temContaFixa: boolean;
}): OrigemSemCorrecao | null {
  if (origens.temAgenda) {
    return "agenda";
  }
  if (origens.temQueima) {
    return "queimas";
  }
  if (origens.temOrcamento) {
    return "orcamento";
  }
  if (origens.temContaFixa) {
    return "conta_fixa";
  }
  return null;
}
