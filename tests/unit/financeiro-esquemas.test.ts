import { describe, expect, it } from "vitest";

import {
  esquemaDespesa,
  esquemaVenda,
  FRASE_CORRECAO_COM_ORIGEM,
  FRASE_CORRECAO_INVALIDA,
  FRASE_VENDA_DESATUALIZADA,
} from "@/lib/financeiro/esquemas";
import {
  FRASE_VENDA_SEM_RESPOSTA,
  FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM,
  fraseCorrecaoRecusada,
  fraseCorrecaoSemRede,
  fraseSemCorrecaoPorOrigem,
  textoCorrecaoLancada,
} from "@/lib/financeiro/textos";

// 06.5-16-PLAN.md, Tarefa 2 — a `correcao` da Venda e da Despesa (o id da original e a versão que a
// página leu; nada mais vem do cliente) e as frases do “Corrigir”, verbatim da 06.5-UI-SPEC.md.

const ORIGINAL = "5b1f3c1e-8f2a-4c1d-9a3b-2e4f6a8b0c1d";
const CATEGORIA = "7c2e4d6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f";

function vendaBase(): Record<string, unknown> {
  return {
    data: "2026-10-05",
    linhas: [{ tipo: "livre", descricao: "Caneca", categoriaId: CATEGORIA, valorTexto: "70,00" }],
    parcelas: [{ vencimento: "2026-10-05", valorTexto: "70,00", forma: "pix", pago: true }],
  };
}

function despesaBase(): Record<string, unknown> {
  return {
    modo: "outra",
    data: "2026-10-05",
    descricao: "Gás",
    categoriaId: CATEGORIA,
    valorTexto: "250,00",
    parcelas: [{ vencimento: "2026-10-05", valorTexto: "250,00", forma: "pix", pago: true }],
  };
}

function primeiraMensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }): string {
  return resultado.error?.issues[0]?.message ?? "";
}

describe("esquemaVenda — correcao", () => {
  it("sem correcao, devolve correcao nula (a venda de sempre)", () => {
    const resultado = esquemaVenda.safeParse(vendaBase());
    expect(resultado.success).toBe(true);
    expect(resultado.data?.correcao).toBeNull();
  });

  it("aceita o id da original e a versão hexadecimal", () => {
    const resultado = esquemaVenda.safeParse({ ...vendaBase(), correcao: { documentoId: ORIGINAL, versao: "0a1b2c3d" } });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.correcao).toEqual({ documentoId: ORIGINAL, versao: "0a1b2c3d" });
    expect(resultado.data?.origem).toBeNull();
  });

  it("recusa versão inválida (vazia, não hexadecimal, maiúscula, longa demais) e id que não é uuid", () => {
    for (const versao of ["", "xyz", "0A1B2C3D", "0123456789abcdef0"]) {
      const resultado = esquemaVenda.safeParse({ ...vendaBase(), correcao: { documentoId: ORIGINAL, versao } });
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_CORRECAO_INVALIDA);
    }
    const semUuid = esquemaVenda.safeParse({ ...vendaBase(), correcao: { documentoId: "33", versao: "0a1b2c3d" } });
    expect(semUuid.success).toBe(false);
    expect(primeiraMensagem(semUuid)).toBe(FRASE_CORRECAO_INVALIDA);
  });

  it("recusa correcao junto com origem (pedido forjado)", () => {
    const resultado = esquemaVenda.safeParse({
      ...vendaBase(),
      origem: `mensalidade:${ORIGINAL}`,
      correcao: { documentoId: ORIGINAL, versao: "0a1b2c3d" },
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_CORRECAO_COM_ORIGEM);
    expect(FRASE_CORRECAO_COM_ORIGEM).toBe("Essa venda não pode vir de outro módulo e corrigir ao mesmo tempo.");
  });
});

describe("esquemaDespesa — correcao", () => {
  it("aceita nos dois modos e devolve nula sem ela", () => {
    const outra = esquemaDespesa.safeParse({ ...despesaBase(), correcao: { documentoId: ORIGINAL, versao: "ff" } });
    expect(outra.success).toBe(true);
    expect(outra.data?.correcao).toEqual({ documentoId: ORIGINAL, versao: "ff" });

    const compra = esquemaDespesa.safeParse({
      modo: "compra",
      data: "2026-10-05",
      linhas: [{ itemId: CATEGORIA, quantidadeEstoqueTexto: "2", valorTotalTexto: "250,00" }],
      parcelas: [{ vencimento: "2026-10-05", valorTexto: "250,00", forma: "pix", pago: true }],
      correcao: { documentoId: ORIGINAL, versao: "ff" },
    });
    expect(compra.success).toBe(true);
    expect(compra.data?.correcao).toEqual({ documentoId: ORIGINAL, versao: "ff" });

    expect(esquemaDespesa.safeParse(despesaBase()).data?.correcao).toBeNull();
  });

  it("recusa versão inválida", () => {
    const resultado = esquemaDespesa.safeParse({ ...despesaBase(), correcao: { documentoId: ORIGINAL, versao: "não" } });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_CORRECAO_INVALIDA);
  });
});

describe("frases do “Corrigir” — verbatim da UI-SPEC", () => {
  it("toast do sucesso", () => {
    expect(textoCorrecaoLancada("venda", 33, 38, "R$ 70,00")).toBe("Venda nº 33 cancelada e nº 38 lançada no lugar · R$ 70,00");
    expect(textoCorrecaoLancada("despesa", 37, 39, "R$ 250,00")).toBe(
      "Despesa nº 37 cancelada e nº 39 lançada no lugar · R$ 250,00",
    );
  });

  it("cancelada", () => {
    expect(fraseCorrecaoRecusada("cancelada", "venda", 33)).toBe(
      "Nada foi lançado: a venda nº 33 já tinha sido cancelada (talvez em outro celular). Os dados continuam aqui — se esta venda ainda vale, toque em “Lançar como venda nova”.",
    );
    expect(fraseCorrecaoRecusada("cancelada", "despesa", 37)).toBe(
      "Nada foi lançado: a despesa nº 37 já tinha sido cancelada (talvez em outro celular). Os dados continuam aqui — se esta despesa ainda vale, toque em “Lançar como despesa nova”.",
    );
  });

  it("original que não existe: a frase de “não achei”", () => {
    expect(fraseCorrecaoRecusada("cancelada", "venda", null)).toBe(
      "Não achei a venda a corrigir. Volte ao Caixa e toque em “Corrigir esta venda” de novo.",
    );
  });

  it("mudou e já corrigida", () => {
    expect(fraseCorrecaoRecusada("mudou", "venda", 33)).toBe(
      "Nada foi lançado: a venda nº 33 mudou depois que você abriu a correção. Volte ao Caixa e toque em “Corrigir esta venda” de novo, para partir do que vale agora.",
    );
    expect(fraseCorrecaoRecusada("ja_corrigida", "venda", 33, 38)).toBe("Nada foi lançado: a venda nº 33 já foi corrigida pela nº 38.");
    expect(fraseCorrecaoRecusada("ja_corrigida", "despesa", 37, 39)).toBe(
      "Nada foi lançado: a despesa nº 37 já foi corrigida pela nº 39.",
    );
  });

  it("rede", () => {
    expect(fraseCorrecaoSemRede("venda", 33)).toBe(
      "Não deu para lançar. A venda nº 33 continua valendo e nada novo foi gravado — verifique a internet e tente de novo.",
    );
    expect(fraseCorrecaoSemRede("despesa", null)).toBe(
      "Não deu para lançar. A despesa original continua valendo e nada novo foi gravado — verifique a internet e tente de novo.",
    );
  });

  it("origem (UI-D10) e conta fixa", () => {
    expect(fraseSemCorrecaoPorOrigem("venda", "agenda")).toBe(
      "Esta venda veio da Agenda. Para corrigir, cancele aqui e lance de novo por lá.",
    );
    expect(fraseSemCorrecaoPorOrigem("venda", "queimas")).toBe(
      "Esta venda veio das Queimas. Para corrigir, cancele aqui e lance de novo por lá.",
    );
    expect(fraseSemCorrecaoPorOrigem("venda", "orcamento", "ORC-2026-004")).toBe(
      "Esta venda veio do orçamento ORC-2026-004. Para corrigir, cancele aqui e lance de novo por lá.",
    );
    expect(fraseSemCorrecaoPorOrigem("despesa", "conta_fixa")).toBe(
      "Esta despesa veio das Contas fixas. Para corrigir, cancele aqui e gere o mês de novo em Contas fixas.",
    );
  });
});

// Quick 261008-pmi (08/10/2026), auditoria 08/10 — Queimas, aviso 1: a Venda aberta pelas Queimas leva o
// retrato das vendas ativas que a página leu (`vendasVistas`); só ela.
describe("esquemaVenda — o retrato das Queimas (auditoria 08/10)", () => {
  const QUEIMA = "1d2e3f40-5a6b-4c7d-8e9f-a0b1c2d3e4f5";

  it("origem queima SEM vendasVistas é recusada como tela desatualizada", () => {
    const resultado = esquemaVenda.safeParse({ ...vendaBase(), origem: `queima:${QUEIMA}` });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_VENDA_DESATUALIZADA);
  });

  it("origem queima com vendasVistas passa e devolve as vistas (inclusive a lista vazia)", () => {
    const comDuas = esquemaVenda.safeParse({ ...vendaBase(), origem: `queima:${QUEIMA}`, vendasVistas: [3, 7] });
    expect(comDuas.success).toBe(true);
    expect(comDuas.data?.vendasVistas).toEqual([3, 7]);
    const vazia = esquemaVenda.safeParse({ ...vendaBase(), origem: `queima:${QUEIMA}`, vendasVistas: [] });
    expect(vazia.success).toBe(true);
    expect(vazia.data?.vendasVistas).toEqual([]);
  });

  it("vendasVistas sem origem queima (Agenda, manual, ou com correcao) é recusado — pedido forjado", () => {
    const daAgenda = esquemaVenda.safeParse({ ...vendaBase(), origem: `mensalidade:${QUEIMA}`, vendasVistas: [3] });
    expect(daAgenda.success).toBe(false);
    const manual = esquemaVenda.safeParse({ ...vendaBase(), vendasVistas: [] });
    expect(manual.success).toBe(false);
    const comCorrecao = esquemaVenda.safeParse({
      ...vendaBase(),
      correcao: { documentoId: ORIGINAL, versao: "0a1b2c3d" },
      vendasVistas: [3],
    });
    expect(comCorrecao.success).toBe(false);
  });

  it("vendasVistas fora de forma (0, negativo, fracionário, mais de 500) é recusado com a frase da tela desatualizada", () => {
    const quinhentosEUm = Array.from({ length: 501 }, (_, indice) => indice + 1);
    for (const vistas of [[0], [-1], [1.5], quinhentosEUm]) {
      const resultado = esquemaVenda.safeParse({ ...vendaBase(), origem: `queima:${QUEIMA}`, vendasVistas: vistas });
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_VENDA_DESATUALIZADA);
    }
  });

  it("a Venda manual sem vendasVistas segue igual, com vendasVistas nulo", () => {
    const resultado = esquemaVenda.safeParse(vendaBase());
    expect(resultado.success).toBe(true);
    expect(resultado.data?.vendasVistas).toBeNull();
  });

  it("a Venda da Agenda sem vendasVistas segue igual, com vendasVistas nulo", () => {
    const resultado = esquemaVenda.safeParse({ ...vendaBase(), origem: `mensalidade:${QUEIMA}` });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.vendasVistas).toBeNull();
  });
});

describe("as frases da falha de rede no “Lançar venda” (auditoria 08/10)", () => {
  it("nenhuma afirma que nada foi gravado; as duas dizem que a conexão falhou", () => {
    for (const frase of [FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM, FRASE_VENDA_SEM_RESPOSTA]) {
      expect(frase).toContain("conexão falhou");
      expect(frase.startsWith("Não deu para salvar")).toBe(false);
      expect(frase).not.toMatch(/nada foi gravado/);
    }
  });

  it("com origem, diz que pode tocar de novo; na manual, manda conferir no Caixa", () => {
    expect(FRASE_VENDA_SEM_RESPOSTA_COM_ORIGEM).toMatch(/Pode tocar/);
    expect(FRASE_VENDA_SEM_RESPOSTA).toContain("Caixa");
  });
});
