import { describe, expect, it } from "vitest";

import { esquemaRegistrarMovimentacao, textoParaMilesimos } from "@/lib/estoque/esquemas";
import {
  FRASE_CONTADO_VAZIO,
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  FRASE_VINCULO_LONGO,
} from "@/lib/estoque/textos";

// Id fictício de item (uuid v4 válido) — nenhum dado real.
const ITEM_ID = "3f2c6a1e-8b4d-4c2a-9e1f-0a1b2c3d4e5f";

function saida(quantidadeTexto: string, destino: unknown = "atelie") {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "saida",
    itemId: ITEM_ID,
    quantidadeTexto,
    destino,
  });
}

function primeiraMensagem(resultado: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaRegistrarMovimentacao — a quantidade", () => {
  it("aceita “2,5” como 2500 milésimos", () => {
    const resultado = saida("2,5");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.quantidadeTexto).toBe(2500);
    }
  });

  it("aceita “0,001” como 1 milésimo — a menor quantidade que existe", () => {
    const resultado = saida("0,001");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.quantidadeTexto).toBe(1);
    }
  });

  it("recusa “0” com a frase da quantidade zero", () => {
    const resultado = saida("0");
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_QUANTIDADE_ZERO);
  });

  it("recusa “-1” — o sinal vem do tipo, nunca do texto", () => {
    expect(saida("-1").success).toBe(false);
  });

  it("recusa “1,2345” — mais de 3 casas decimais não cabem em milésimos", () => {
    expect(saida("1,2345").success).toBe(false);
  });

  it("recusa texto vazio", () => {
    expect(saida("").success).toBe(false);
    expect(saida("   ").success).toBe(false);
  });

  it("textoParaMilesimos converte o texto uma vez só, em inteiro", () => {
    expect(textoParaMilesimos("5")).toEqual({ ok: true, milesimos: 5000 });
    expect(textoParaMilesimos("2,250")).toEqual({ ok: true, milesimos: 2250 });
    expect(textoParaMilesimos("0.5")).toEqual({ ok: true, milesimos: 500 });
  });
});

describe("esquemaRegistrarMovimentacao — entrada e saída", () => {
  it("entrada sem custo é recusada com “Diga quanto custou ao todo — é daí que sai o custo médio.”", () => {
    const semCampo = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
    });
    expect(semCampo.success).toBe(false);
    expect(primeiraMensagem(semCampo)).toBe(FRASE_CUSTO_OBRIGATORIO);

    const vazio = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
      custoTexto: "",
    });
    expect(vazio.success).toBe(false);
    expect(primeiraMensagem(vazio)).toBe(
      "Diga quanto custou ao todo — é daí que sai o custo médio.",
    );
  });

  it("entrada com custo vira centavos inteiros", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
      custoTexto: "21,00",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "entrada") {
      expect(resultado.data.quantidadeTexto).toBe(5000);
      expect(resultado.data.custoTexto).toBe(2100);
    }
  });

  it("saída sem destino é recusada com “Escolha para onde o material foi.”", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "saida",
      itemId: ITEM_ID,
      quantidadeTexto: "2",
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
    expect(FRASE_DESTINO_OBRIGATORIO).toBe("Escolha para onde o material foi.");
  });

  it("destino fora dos cinco é recusado — inclusive “venda”", () => {
    for (const destino of ["venda", "doacao", "", 3]) {
      const resultado = saida("2", destino);
      expect(resultado.success, `destino ${String(destino)}`).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
    }
  });

  it("saída válida devolve o destino e os milésimos", () => {
    const resultado = saida("2", "encomenda");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.destino).toBe("encomenda");
      expect(resultado.data.quantidadeTexto).toBe(2000);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// O ajuste e os vínculos da saída (06-05-PLAN.md) — EST-07, EST-08, EST-11.
// ---------------------------------------------------------------------------------------------

function ajuste(contadoTexto: unknown, motivoTexto?: unknown) {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "ajuste",
    itemId: ITEM_ID,
    contadoTexto,
    ...(motivoTexto === undefined ? {} : { motivoTexto }),
  });
}

describe("esquemaRegistrarMovimentacao — o ajuste pelo saldo contado", () => {
  it("contado “0” é aceito: prateleira vazia é um contado válido (D-32)", () => {
    const resultado = ajuste("0");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "ajuste") {
      expect(resultado.data.contadoTexto).toBe(0);
    }
  });

  it("“2,5” e “2,500” viram os mesmos 2500 milésimos", () => {
    for (const texto of ["2,5", "2,500"]) {
      const resultado = ajuste(texto);
      expect(resultado.success).toBe(true);
      if (resultado.success && resultado.data.tipo === "ajuste") {
        expect(resultado.data.contadoTexto).toBe(2500);
      }
    }
  });

  it("contado vazio é recusado com “Diga quanto tem na prateleira — pode ser zero.”", () => {
    for (const texto of ["", "   "]) {
      const resultado = ajuste(texto);
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_CONTADO_VAZIO);
    }
    expect(FRASE_CONTADO_VAZIO).toBe("Diga quanto tem na prateleira — pode ser zero.");
    expect(primeiraMensagem(esquemaRegistrarMovimentacao.safeParse({ tipo: "ajuste", itemId: ITEM_ID }))).toBe(
      FRASE_CONTADO_VAZIO,
    );
  });

  it("contado negativo e contado com 4 casas são recusados com a frase da quantidade", () => {
    for (const texto of ["-1", "1,2345"]) {
      const resultado = ajuste(texto);
      expect(resultado.success, texto).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_QUANTIDADE_INVALIDA);
    }
  });

  it("motivo do ajuste: opcional, NFC, sem espaço nas pontas, vazio vira nulo", () => {
    const semMotivo = ajuste("3");
    expect(semMotivo.success && semMotivo.data.tipo === "ajuste" && semMotivo.data.motivoTexto).toBe(
      null,
    );
    const vazio = ajuste("3", "   ");
    expect(vazio.success && vazio.data.tipo === "ajuste" && vazio.data.motivoTexto).toBe(null);
    const comMotivo = ajuste("3", "  Conferência da prateleira  ");
    expect(comMotivo.success).toBe(true);
    if (comMotivo.success && comMotivo.data.tipo === "ajuste") {
      expect(comMotivo.data.motivoTexto).toBe("Conferência da prateleira");
      expect(comMotivo.data.motivoTexto).toBe("Conferência da prateleira".normalize("NFC"));
    }
  });

  it("motivo com 160 pontos de código passa; com 161 é recusado", () => {
    expect(ajuste("3", "a".repeat(160)).success).toBe(true);
    const longo = ajuste("3", "a".repeat(161));
    expect(longo.success).toBe(false);
    expect(primeiraMensagem(longo)).toBe(FRASE_VINCULO_LONGO);
  });
});

function saidaCom(destino: string, vinculos: Record<string, unknown>) {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "saida",
    itemId: ITEM_ID,
    quantidadeTexto: "1",
    destino,
    ...vinculos,
  });
}

describe("esquemaRegistrarMovimentacao — os vínculos da saída (EST-11)", () => {
  it("aula sem turma grava turma nula — o vínculo é opcional", () => {
    const resultado = saidaCom("aula", {});
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.turmaTexto).toBe(null);
      expect(resultado.data.encomendaId).toBe(null);
      expect(resultado.data.oQueAconteceuTexto).toBe(null);
    }
  });

  it("turma de 160 pontos de código passa; 161 é recusada", () => {
    // "🏺" é UM ponto de código e DUAS unidades UTF-16: 160 dele cabem (o banco conta caracteres).
    const cabe = saidaCom("aula", { turmaTexto: "🏺".repeat(160) });
    expect(cabe.success).toBe(true);
    const naoCabe = saidaCom("aula", { turmaTexto: "a".repeat(161) });
    expect(naoCabe.success).toBe(false);
    expect(primeiraMensagem(naoCabe)).toBe(FRASE_VINCULO_LONGO);
  });

  it("a turma é normalizada em NFC e aparada; só espaços vira nulo", () => {
    const decomposta = saidaCom("aula", { turmaTexto: " Turma de terça " });
    expect(decomposta.success).toBe(true);
    if (decomposta.success && decomposta.data.tipo === "saida") {
      expect(decomposta.data.turmaTexto).toBe("Turma de terça");
    }
    const branco = saidaCom("aula", { turmaTexto: "   " });
    expect(branco.success && branco.data.tipo === "saida" && branco.data.turmaTexto).toBe(null);
  });

  it("encomenda aceita um id (uuid) opcional; “Nenhuma” (vazio) vira nulo", () => {
    const encomendaId = "0b7c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3";
    const comId = saidaCom("encomenda", { encomendaId });
    expect(comId.success).toBe(true);
    if (comId.success && comId.data.tipo === "saida") {
      expect(comId.data.encomendaId).toBe(encomendaId);
    }
    const nenhuma = saidaCom("encomenda", { encomendaId: "" });
    expect(nenhuma.success && nenhuma.data.tipo === "saida" && nenhuma.data.encomendaId).toBe(null);
    expect(saidaCom("encomenda", { encomendaId: "nao-e-uuid" }).success).toBe(false);
  });

  it("perda: “o que aconteceu” é opcional, vazio vira nulo", () => {
    const semTexto = saidaCom("perda", { oQueAconteceuTexto: "" });
    expect(
      semTexto.success && semTexto.data.tipo === "saida" && semTexto.data.oQueAconteceuTexto,
    ).toBe(null);
    const comTexto = saidaCom("perda", { oQueAconteceuTexto: "Caiu da prateleira" });
    expect(
      comTexto.success && comTexto.data.tipo === "saida" && comTexto.data.oQueAconteceuTexto,
    ).toBe("Caiu da prateleira");
  });

  it("vínculo que não corresponde ao destino é ignorado", () => {
    const resultado = saidaCom("atelie", {
      turmaTexto: "Turma de terça",
      encomendaId: "0b7c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3",
      oQueAconteceuTexto: "Quebrou",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.turmaTexto).toBe(null);
      expect(resultado.data.encomendaId).toBe(null);
      expect(resultado.data.oQueAconteceuTexto).toBe(null);
    }
    const aula = saidaCom("aula", { turmaTexto: "Turma de terça", oQueAconteceuTexto: "Quebrou" });
    if (aula.success && aula.data.tipo === "saida") {
      expect(aula.data.turmaTexto).toBe("Turma de terça");
      expect(aula.data.oQueAconteceuTexto).toBe(null);
    }
  });

  it("sem destino, continua “Escolha para onde o material foi.” mesmo com vínculo", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "saida",
      itemId: ITEM_ID,
      quantidadeTexto: "1",
      turmaTexto: "Turma de terça",
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
  });
});
