import { describe, expect, it } from "vitest";

import { areaFinanceira } from "@/db/schema";
import { AREAS_DO_FORNECEDOR, esquemaFornecedor } from "@/lib/fornecedores/esquemas";

// 06.2-01-PLAN.md (FRN-02): o cadastro de fornecedores valida no SERVIDOR com os MESMOS tetos dos
// checks `fornecedores_*_comprimento` da 0028 — nome aparado de 1 a 120 caracteres; whatsapp 40,
// site 300, observações 4000, os outros textos 160; opcionais vazios viram `null`.

function primeiraMensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaFornecedor — o essencial", () => {
  it("apara o nome e deixa todos os opcionais nulos", () => {
    const resultado = esquemaFornecedor.safeParse({ nome: "  Loja X  ", area: "pecas" });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      nome: "Loja X",
      area: "pecas",
      vende: null,
      cidadeEntrega: null,
      whatsapp: null,
      pessoaContato: null,
      email: null,
      site: null,
      pagamentoPrazo: null,
      observacoes: null,
    });
  });

  it("nome só com espaços → “Diga o nome do fornecedor.” no campo nome", () => {
    const resultado = esquemaFornecedor.safeParse({ nome: "   ", area: "pecas" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("Diga o nome do fornecedor.");
    expect(resultado.error?.issues[0]?.path).toEqual(["nome"]);
  });
});

describe("AREAS_DO_FORNECEDOR", () => {
  it("é o mesmo conjunto do enum `area_financeira` do banco", () => {
    expect([...AREAS_DO_FORNECEDOR].sort()).toEqual([...areaFinanceira.enumValues].sort());
  });

  it("segue a ordem do protótipo", () => {
    expect(AREAS_DO_FORNECEDOR).toEqual(["pecas", "cafeteria", "loja", "espaco", "geral"]);
  });
});
