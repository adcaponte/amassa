import { describe, expect, it } from "vitest";

import {
  esquemaDespesa,
  esquemaVenda,
  FRASE_CORRECAO_COM_ORIGEM,
  FRASE_CORRECAO_INVALIDA,
} from "@/lib/financeiro/esquemas";
import {
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
