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
