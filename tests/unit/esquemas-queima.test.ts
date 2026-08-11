import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { esquemaForno, esquemaManutencao } from "@/lib/queimas/esquemas";

// `esquemaManutencao` (FOR-07, Tarefa 1 do plano 04-04) — `responsavel`/`observacoes` são os
// únicos dois campos aceitos do cliente, os dois opcionais; `queimasAcumuladas` DELIBERADAMENTE
// não existe no esquema (é derivado no servidor, dentro da mesma transação que grava a linha).
describe("esquemaManutencao", () => {
  it("aceita entrada só com fornoId (responsável e observações ausentes)", () => {
    const resultado = esquemaManutencao.safeParse({ fornoId: randomUUID() });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.responsavel).toBeNull();
      expect(resultado.data.observacoes).toBeNull();
    }
  });

  it("aceita entrada só com responsável", () => {
    const resultado = esquemaManutencao.safeParse({
      fornoId: randomUUID(),
      responsavel: "Zé Ferreira",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.responsavel).toBe("Zé Ferreira");
      expect(resultado.data.observacoes).toBeNull();
    }
  });

  it("aceita entrada só com observações", () => {
    const resultado = esquemaManutencao.safeParse({
      fornoId: randomUUID(),
      observacoes: "Troquei duas resistências.",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.responsavel).toBeNull();
      expect(resultado.data.observacoes).toBe("Troquei duas resistências.");
    }
  });

  it("responsável e observações vazios ou só com espaços viram null, nunca cadeia vazia", () => {
    const resultado = esquemaManutencao.safeParse({
      fornoId: randomUUID(),
      responsavel: "   ",
      observacoes: "",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.responsavel).toBeNull();
      expect(resultado.data.observacoes).toBeNull();
    }
  });

  it("recusa fornoId que não é uuid, com a mensagem certa", () => {
    const resultado = esquemaManutencao.safeParse({ fornoId: "não-é-um-uuid" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/identificador não é válido/i);
    }
  });

  it("recusa responsável com mais de 120 caracteres", () => {
    const resultado = esquemaManutencao.safeParse({
      fornoId: randomUUID(),
      responsavel: "a".repeat(121),
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/responsável muito longo/i);
    }
  });

  it("recusa observações com mais de 500 caracteres", () => {
    const resultado = esquemaManutencao.safeParse({
      fornoId: randomUUID(),
      observacoes: "a".repeat(501),
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/observações muito longas/i);
    }
  });

  it("recusa silenciosamente um queimasAcumuladas enviado pelo cliente — o campo não existe no esquema, então não chega ao banco", () => {
    const resultado = esquemaManutencao.safeParse({
      fornoId: randomUUID(),
      queimasAcumuladas: 999,
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      // `zod` descarta chaves não declaradas no objeto por padrão (sem `.passthrough()`) — o
      // dado validado nunca carrega `queimasAcumuladas`, mesmo que o cliente tenha enviado.
      expect(resultado.data).not.toHaveProperty("queimasAcumuladas");
      expect(Object.keys(resultado.data).sort()).toEqual(["fornoId", "observacoes", "responsavel"]);
    }
  });
});

describe("esquemaForno", () => {
  it("recusa limite 9 (abaixo do mínimo de 10)", () => {
    const resultado = esquemaForno.safeParse({ nome: "Forno 01", limite: 9 });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/não pode ser menor que 10/i);
    }
  });

  it("aceita limite 10 (o próprio mínimo)", () => {
    const resultado = esquemaForno.safeParse({ nome: "Forno 01", limite: 10 });
    expect(resultado.success).toBe(true);
  });

  it("recusa nome vazio", () => {
    const resultado = esquemaForno.safeParse({ nome: "", limite: 100 });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/dê um nome para o forno/i);
    }
  });

  it("recusa nome só com espaços (0 pontos de código após o trim)", () => {
    const resultado = esquemaForno.safeParse({ nome: "   ", limite: 100 });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/dê um nome para o forno/i);
    }
  });
});
