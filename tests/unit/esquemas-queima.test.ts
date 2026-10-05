import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  esquemaApagarContagem,
  esquemaContagem,
  esquemaExcluirQueima,
  esquemaForno,
  esquemaManutencao,
  esquemaReceberQueima,
} from "@/lib/queimas/esquemas";

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

// Fase 06.4 — `esquemaContagem` (QMC-03): os mesmos tetos dos checks `queima_contagens_*` da 0030.
describe("esquemaContagem", () => {
  const ZERADA = {
    internasP: 0,
    internasM: 0,
    internasG: 0,
    externasP: 0,
    externasM: 0,
    externasG: 0,
  };
  const TETO = "Confira o número: cada contador vai até 10.000.";

  function entrada(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { queimaId: randomUUID(), ...ZERADA, internasP: 1, saiuCheio: true, esperada: null, ...extra };
  }

  function mensagem(valor: unknown): string | undefined {
    const resultado = esquemaContagem.safeParse(valor);
    return resultado.success ? undefined : resultado.error.issues[0]?.message;
  }

  it("aceita uma contagem com alguma peça", () => {
    expect(esquemaContagem.safeParse(entrada()).success).toBe(true);
  });

  it("recusa os seis contadores em 0, com qualquer “saiu cheio”", () => {
    for (const saiuCheio of [true, false]) {
      expect(mensagem({ queimaId: randomUUID(), ...ZERADA, saiuCheio, esperada: null })).toBe(
        "Nenhuma peça contada — nada foi salvo.",
      );
    }
  });

  it("aceita 10000 e 0 em cada contador", () => {
    for (const chave of Object.keys(ZERADA)) {
      expect(esquemaContagem.safeParse(entrada({ [chave]: 10000 })).success).toBe(true);
    }
    expect(esquemaContagem.safeParse(entrada({ externasG: 0 })).success).toBe(true);
  });

  it("recusa 10001 e −1 com a frase do teto", () => {
    expect(mensagem(entrada({ externasG: 10001 }))).toBe(TETO);
    expect(mensagem(entrada({ internasM: -1 }))).toBe(TETO);
  });

  it("recusa 1,5 e o texto \"3\" (inteiros, número de verdade)", () => {
    expect(esquemaContagem.safeParse(entrada({ externasM: 1.5 })).success).toBe(false);
    expect(esquemaContagem.safeParse(entrada({ externasM: "3" })).success).toBe(false);
  });

  it("recusa sem “saiu cheio”", () => {
    const semSaiuCheio = entrada();
    delete semSaiuCheio.saiuCheio;
    expect(esquemaContagem.safeParse(semSaiuCheio).success).toBe(false);
  });

  it("recusa queimaId inválido", () => {
    expect(esquemaContagem.safeParse(entrada({ queimaId: "nao-e-uuid" })).success).toBe(false);
  });

  it("descarta documentoId e quantidades enviados pelo cliente", () => {
    const resultado = esquemaContagem.safeParse(
      entrada({ documentoId: randomUUID(), quantidades: { p: 1, m: 0, g: 0 } }),
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).not.toHaveProperty("documentoId");
      expect(resultado.data).not.toHaveProperty("quantidades");
    }
  });
});

// Quick 261005-2yu (05/10/2026), 06.4-WR-01/02/03: o retrato que a tela viu é OBRIGATÓRIO — ausente
// nunca pula a conferência; uma aba velha depois do deploy recebe a frase de tela desatualizada.
describe("o retrato da tela (06.4-WR-01/02/03)", () => {
  const TELA_DESATUALIZADA = "Esta tela está desatualizada — recarregue a página e tente de novo.";
  const CONTAGEM = {
    internasP: 31,
    internasM: 0,
    internasG: 0,
    externasP: 0,
    externasM: 0,
    externasG: 0,
    saiuCheio: true,
  };

  function primeiraMensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
    return resultado.success ? undefined : resultado.error?.issues[0]?.message;
  }

  it("esquemaContagem sem a chave `esperada` falha com a frase de tela desatualizada", () => {
    const resultado = esquemaContagem.safeParse({ queimaId: randomUUID(), ...CONTAGEM });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(TELA_DESATUALIZADA);
  });

  it("esquemaContagem com `esperada: null` ou uma contagem passa, e devolve a esperada", () => {
    expect(esquemaContagem.safeParse({ queimaId: randomUUID(), ...CONTAGEM, esperada: null }).success).toBe(true);
    const resultado = esquemaContagem.safeParse({ queimaId: randomUUID(), ...CONTAGEM, esperada: CONTAGEM });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.esperada).toEqual(CONTAGEM);
  });

  it("esquemaApagarContagem exige a esperada (uma contagem)", () => {
    expect(esquemaApagarContagem.safeParse({ queimaId: randomUUID() }).success).toBe(false);
    expect(esquemaApagarContagem.safeParse({ queimaId: randomUUID(), esperada: CONTAGEM }).success).toBe(true);
  });

  it("esquemaReceberQueima sem `vendasVistas` falha com a frase de tela desatualizada", () => {
    const resultado = esquemaReceberQueima.safeParse({
      queimaId: randomUUID(),
      forma: "pix",
      quantidades: { p: 1, m: 0, g: 0 },
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(TELA_DESATUALIZADA);
  });

  it("esquemaExcluirQueima: { id, vendasVistas: [] } passa; número ≤ 0 ou fracionário falha", () => {
    expect(esquemaExcluirQueima.safeParse({ id: randomUUID(), vendasVistas: [] }).success).toBe(true);
    expect(esquemaExcluirQueima.safeParse({ id: randomUUID(), vendasVistas: [12, 13] }).success).toBe(true);
    expect(esquemaExcluirQueima.safeParse({ id: randomUUID(), vendasVistas: [0] }).success).toBe(false);
    expect(esquemaExcluirQueima.safeParse({ id: randomUUID(), vendasVistas: [-3] }).success).toBe(false);
    expect(esquemaExcluirQueima.safeParse({ id: randomUUID(), vendasVistas: [1.5] }).success).toBe(false);
    expect(primeiraMensagem(esquemaExcluirQueima.safeParse({ id: randomUUID() }))).toBe(TELA_DESATUALIZADA);
  });
});
