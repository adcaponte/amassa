import { describe, expect, it } from "vitest";

import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import {
  LIMITE_DE_ABERTOS_NO_INICIO,
  compararAbertos,
  resumoDoInicio,
  rotuloDoPrazo,
  situacaoDoPrazo,
} from "@/lib/lembretes/lista";

// O módulo puro dos Lembretes (plano 06.3-02). `hoje` chega sempre por argumento — nenhum caso
// abaixo depende do relógio da máquina que roda o teste.

type Aberto = { id: string; paraQuando: string | null; criadoEm: string };

function aberto(id: string, paraQuando: string | null, criadoEm = "2026-10-01T12:00:00.000Z"): Aberto {
  return { id, paraQuando, criadoEm };
}

const HOJE = "2026-10-03";

describe("compararAbertos", () => {
  it("vencido < hoje < futuro < sem data", () => {
    const lista = [
      aberto("d", null),
      aberto("c", "2026-10-10"),
      aberto("b", "2026-10-03"),
      aberto("a", "2026-10-01"),
    ];
    expect([...lista].sort(compararAbertos).map((l) => l.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("dois sem data seguem o criadoEm", () => {
    const lista = [
      aberto("tarde", null, "2026-10-02T15:00:00.000Z"),
      aberto("cedo", null, "2026-10-02T09:00:00.000Z"),
    ];
    expect([...lista].sort(compararAbertos).map((l) => l.id)).toEqual(["cedo", "tarde"]);
  });

  it("compara o criadoEm como INSTANTE, não como texto (Z e +00:00 com milissegundos)", () => {
    const lista = [
      aberto("depois", "2026-10-05", "2026-10-02T12:00:01Z"),
      aberto("antes", "2026-10-05", "2026-10-02T12:00:00.500+00:00"),
    ];
    expect([...lista].sort(compararAbertos).map((l) => l.id)).toEqual(["antes", "depois"]);
  });

  it("mesmo paraQuando e mesmo criadoEm desempatam pelo id", () => {
    const lista = [
      aberto("bbbbbbbb-0000-4000-8000-000000000000", "2026-10-05"),
      aberto("aaaaaaaa-0000-4000-8000-000000000000", "2026-10-05"),
    ];
    expect([...lista].sort(compararAbertos).map((l) => l.id)).toEqual([
      "aaaaaaaa-0000-4000-8000-000000000000",
      "bbbbbbbb-0000-4000-8000-000000000000",
    ]);
  });

  it("a ordem é a mesma de `para_quando asc nulls last, criado_em asc, id asc`, escrita à mão", () => {
    const lista = [
      aberto("7", null, "2026-09-01T10:00:00.000Z"),
      aberto("3", "2026-10-03", "2026-09-20T10:00:00.000Z"),
      aberto("5", "2026-10-20", "2026-09-01T10:00:00.000Z"),
      aberto("8", null, "2026-09-02T10:00:00.000Z"),
      aberto("1", "2026-09-30", "2026-09-25T10:00:00.000Z"),
      aberto("4", "2026-10-03", "2026-09-21T10:00:00.000Z"),
      aberto("2", "2026-10-02", "2026-09-01T10:00:00.000Z"),
      aberto("6", "2026-10-20", "2026-09-01T10:00:00.000Z"),
    ];
    // A ordem que o SQL escreveria: 30/09; 02/10; 03/10 (20/09 antes de 21/09); 20/10 (mesmo
    // instante → id "5" antes de "6"); sem data por último (01/09 antes de 02/09).
    const ordemDoSql = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect([...lista].sort(compararAbertos).map((l) => l.id)).toEqual(ordemDoSql);
  });
});

describe("situacaoDoPrazo e rotuloDoPrazo", () => {
  it.each([
    ["2026-10-02", "vencido", "venceu 02/10 · ontem"],
    ["2026-09-30", "vencido", "venceu 30/09 · 3 dias"],
    ["2026-10-03", "hoje", "hoje"],
    ["2026-10-04", "amanha", "amanhã"],
    ["2026-10-20", "futuro", "20/10"],
  ] as const)("prazo %s com hoje 2026-10-03 → %s / “%s”", (paraQuando, situacao, rotulo) => {
    expect(situacaoDoPrazo(paraQuando, HOJE)).toBe(situacao);
    expect(rotuloDoPrazo(paraQuando, HOJE)).toBe(rotulo);
  });

  it("sem data → sem-data / null", () => {
    expect(situacaoDoPrazo(null, HOJE)).toBe("sem-data");
    expect(rotuloDoPrazo(null, HOJE)).toBeNull();
  });
});

describe("viradas de dia em Brasília", () => {
  it("02h30 UTC do dia 3 ainda é dia 2 em Brasília — o prazo de 02/10 é “hoje”, não “venceu”", () => {
    const hoje = hojeEmBrasilia(new Date("2026-10-03T02:30:00Z"));
    expect(hoje).toBe("2026-10-02");
    expect(situacaoDoPrazo("2026-10-02", hoje)).toBe("hoje");
    expect(rotuloDoPrazo("2026-10-02", hoje)).toBe("hoje");
  });

  it("virada de ano: hoje 31/12, prazo 01/01 → “amanhã”", () => {
    expect(situacaoDoPrazo("2027-01-01", "2026-12-31")).toBe("amanha");
    expect(rotuloDoPrazo("2027-01-01", "2026-12-31")).toBe("amanhã");
  });

  it("fim de fevereiro: hoje 01/03, prazo 28/02 → “venceu 28/02 · ontem”", () => {
    expect(situacaoDoPrazo("2026-02-28", "2026-03-01")).toBe("vencido");
    expect(rotuloDoPrazo("2026-02-28", "2026-03-01")).toBe("venceu 28/02 · ontem");
  });
});

describe("resumoDoInicio", () => {
  it("LIMITE_DE_ABERTOS_NO_INICIO é 6", () => {
    expect(LIMITE_DE_ABERTOS_NO_INICIO).toBe(6);
  });

  it("sem abertos → “nada pendente”", () => {
    const resumo = resumoDoInicio([], HOJE);
    expect(resumo).toEqual({
      visiveis: [],
      restantes: 0,
      totalDeAbertos: 0,
      totalDeVencidos: 0,
      contagem: "nada pendente",
    });
  });

  it("1 aberto sem vencido → “1 aberto”", () => {
    expect(resumoDoInicio([aberto("a", "2026-10-03")], HOJE).contagem).toBe("1 aberto");
  });

  it("3 abertos com 1 vencido → “3 abertos · 1 vencido”", () => {
    const resumo = resumoDoInicio(
      [aberto("a", null), aberto("b", "2026-10-01"), aberto("c", "2026-10-04")],
      HOJE,
    );
    expect(resumo.contagem).toBe("3 abertos · 1 vencido");
    expect(resumo.totalDeVencidos).toBe(1);
    expect(resumo.restantes).toBe(0);
  });

  it("7 com 2 vencidos → 6 visíveis (os vencidos primeiro), 1 restante, “7 abertos · 2 vencidos”; a entrada desordenada sai ordenada", () => {
    const entrada = [
      aberto("sem-data", null),
      aberto("futuro-2", "2026-10-15"),
      aberto("hoje", "2026-10-03"),
      aberto("vencido-recente", "2026-10-02"),
      aberto("amanha", "2026-10-04"),
      aberto("futuro-1", "2026-10-10"),
      aberto("vencido-antigo", "2026-09-28"),
    ];
    const copia = [...entrada];
    const resumo = resumoDoInicio(entrada, HOJE);

    expect(resumo.visiveis.map((l) => l.id)).toEqual([
      "vencido-antigo",
      "vencido-recente",
      "hoje",
      "amanha",
      "futuro-1",
      "futuro-2",
    ]);
    expect(resumo.restantes).toBe(1);
    expect(resumo.totalDeAbertos).toBe(7);
    expect(resumo.totalDeVencidos).toBe(2);
    expect(resumo.contagem).toBe("7 abertos · 2 vencidos");
    // Ordena uma CÓPIA: a lista de quem chamou (o estado do cliente) não muda.
    expect(entrada).toEqual(copia);
  });
});
