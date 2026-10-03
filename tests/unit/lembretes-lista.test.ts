import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import {
  DURACAO_DO_DESFAZER_MS,
  LIMITE_DE_ABERTOS_NO_INICIO,
  LIMITE_DE_FEITOS_NO_INICIO,
  TAMANHO_DO_TRECHO,
  compararAbertos,
  corDaPessoa,
  filtrosDaUrl,
  hrefDosLembretes,
  instanteCurto,
  primeiroNome,
  resumoDoInicio,
  rotuloDoPrazo,
  situacaoDoPrazo,
  trecho,
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

describe("constantes", () => {
  it("5 feitos no Início (D-02), 6 s de desfazer, trecho de 40", () => {
    expect(LIMITE_DE_FEITOS_NO_INICIO).toBe(5);
    expect(DURACAO_DO_DESFAZER_MS).toBe(6000);
    expect(TAMANHO_DO_TRECHO).toBe(40);
  });
});

describe("instanteCurto (UI-D11)", () => {
  it("“dd/mm hh:mm” em America/Sao_Paulo", () => {
    expect(instanteCurto("2026-10-02T17:20:00.000Z")).toBe("02/10 14:20");
  });

  it("02h30 UTC do dia 3 ainda é 02/10 às 23:30 em Brasília", () => {
    expect(instanteCurto("2026-10-03T02:30:00.000Z")).toBe("02/10 23:30");
  });

  it("meia-noite em Brasília é 00:00, nunca 24:00", () => {
    expect(instanteCurto("2026-10-03T03:00:00.000Z")).toBe("03/10 00:00");
  });
});

describe("primeiroNome (UI-D3)", () => {
  it("apara e devolve o primeiro pedaço", () => {
    expect(primeiroNome("  Gestora de Teste ")).toBe("Gestora");
    expect(primeiroNome("Ana")).toBe("Ana");
  });

  it("nulo ou vazio → null", () => {
    expect(primeiroNome(null)).toBeNull();
    expect(primeiroNome("   ")).toBeNull();
  });
});

describe("corDaPessoa (UI-D2)", () => {
  it("pela posição: 1ª esmaltacao, 2ª queima1, 3ª em diante e desativada tinta-fraca", () => {
    expect(corDaPessoa(0)).toBe("bg-esmaltacao");
    expect(corDaPessoa(1)).toBe("bg-queima1");
    expect(corDaPessoa(2)).toBe("bg-tinta-fraca");
    expect(corDaPessoa(5)).toBe("bg-tinta-fraca");
    expect(corDaPessoa(-1)).toBe("bg-tinta-fraca");
  });
});

describe("trecho", () => {
  it("40 pontos de código voltam iguais, sem “…”", () => {
    const quarenta = "a".repeat(40);
    expect(trecho(quarenta)).toBe(quarenta);
  });

  it("41 viram os 40 primeiros + “…”", () => {
    expect(trecho(`${"b".repeat(40)}c`)).toBe(`${"b".repeat(40)}…`);
  });

  it("um emoji fora do BMP conta como um ponto de código", () => {
    const quarenta = "🌱".repeat(40);
    expect(trecho(quarenta)).toBe(quarenta);
    expect(trecho(`${quarenta}🌱`)).toBe(`${quarenta}…`);
  });

  it("aceita outro tamanho", () => {
    expect(trecho("abcdef", 3)).toBe("abc…");
  });
});

describe("filtrosDaUrl", () => {
  const PADRAO = { situacao: "abertos", quem: "todos", quantos: 50 };
  const UUID = "3f2b6c1e-8a4d-4e2f-9b1a-7c5d0e9f1a2b";

  it("nada na URL → o padrão", () => {
    expect(filtrosDaUrl({})).toEqual(PADRAO);
  });

  it("valores válidos passam", () => {
    expect(filtrosDaUrl({ situacao: "feitos", quem: "geral", quantos: "100" })).toEqual({
      situacao: "feitos",
      quem: "geral",
      quantos: 100,
    });
    expect(filtrosDaUrl({ quem: UUID }).quem).toBe(UUID);
  });

  it("valor inválido vira o padrão, nunca erro", () => {
    expect(filtrosDaUrl({ situacao: "lixo" })).toEqual(PADRAO);
    expect(filtrosDaUrl({ quem: "abc" })).toEqual(PADRAO);
    expect(filtrosDaUrl({ quem: ["geral", "todos"] })).toEqual(PADRAO);
    expect(filtrosDaUrl({ situacao: ["feitos", "feitos"] })).toEqual(PADRAO);
    expect(filtrosDaUrl({ quantos: "75" })).toEqual(PADRAO);
  });

  it("quantos acima do teto vira 500, como em Clientes", () => {
    expect(filtrosDaUrl({ quantos: "9999" }).quantos).toBe(500);
  });
});

describe("hrefDosLembretes", () => {
  const UUID = "3f2b6c1e-8a4d-4e2f-9b1a-7c5d0e9f1a2b";

  it("o padrão não entra na URL", () => {
    expect(hrefDosLembretes({ situacao: "abertos", quem: "todos", quantos: 50 })).toBe(
      "/gestao/lembretes",
    );
  });

  it("só o que difere do padrão", () => {
    expect(hrefDosLembretes({ situacao: "feitos", quem: "todos", quantos: 50 })).toBe(
      "/gestao/lembretes?situacao=feitos",
    );
  });

  it("os três parâmetros, na ordem situacao, quem, quantos", () => {
    expect(hrefDosLembretes({ situacao: "feitos", quem: UUID, quantos: 100 })).toBe(
      `/gestao/lembretes?situacao=feitos&quem=${UUID}&quantos=100`,
    );
  });
});

describe("pureza", () => {
  it("lib/lembretes/lista.ts só importa módulos puros", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/lembretes/lista.ts"), "utf8");
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    const imports = [...fonte.matchAll(/from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const origem of imports) {
      expect([
        "@/lib/producao/calendario",
        "@/lib/clientes/lista",
        "@/lib/rotas/gestao",
        "./textos",
      ]).toContain(origem);
    }
  });

  it("nenhuma linha de lib/lembretes/lista.ts lê o relógio", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/lembretes/lista.ts"), "utf8");
    expect(fonte).not.toMatch(/new Date\(\)|Date\.now\(/);
  });
});
