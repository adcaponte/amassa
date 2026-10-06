import { describe, expect, it } from "vitest";

import { etapasIniciais } from "@/lib/producao/etapas";
import type { OrdemParaLeitura } from "@/lib/producao/leitura";
import {
  planejarAjusteDePrevisto,
  planejarCancelamento,
  planejarDesfazer,
  planejarLiberacao,
  planejarParcial,
  planejarTerminar,
  podeTerminarEtapa,
  totalDeFeitas,
} from "@/lib/producao/transicoes";

// Fase 06.1 (plano 01): "Terminei" decidido sob a trava da ordem, contra a etapa ESPERADA (o que o
// botão mostrava) — é o que recusa o toque duplo e o segundo celular (Pitfall 7). As demais
// transições são dos planos 03, 05 e 06.

function ordem(
  parcial: Partial<OrdemParaLeitura> & { feitas?: Record<string, string> } = {},
): OrdemParaLeitura {
  const { feitas = {}, ...resto } = parcial;
  const caminho = resto.caminho ?? "completo";
  return {
    tipo: "casa",
    caminho,
    status: "ativa",
    entregaPrometida: null,
    inicio: "2026-03-01",
    etapas: etapasIniciais(caminho).map((etapa) => ({
      ...etapa,
      feitaEm: feitas[etapa.etapa] ?? null,
      passaram: null,
    })),
    ...resto,
  };
}

// A ordem de uma peça: o "Terminei" não depende do parcial (D-02) — os casos abaixo são das regras
// de antes da Fase 06.5 e continuam valendo assim.
const UMA_PECA = { total: 1 };

function comParcialNaAtual(base: OrdemParaLeitura, passaram: number | null): OrdemParaLeitura {
  const atual = base.etapas.find((etapa) => etapa.feitaEm === null)?.etapa;
  return {
    ...base,
    etapas: base.etapas.map((etapa) => (etapa.etapa === atual ? { ...etapa, passaram } : etapa)),
  };
}

describe("planejarTerminar", () => {
  it("etapa esperada = atual → ok, feita hoje, a próxima vira a atual e o parcial é limpo", () => {
    expect(planejarTerminar(ordem(), "producao", "2026-03-04", UMA_PECA)).toEqual({
      tipo: "ok",
      etapa: "producao",
      feitaEm: "2026-03-04",
      proxima: "secagem",
      limparPassaram: true,
    });
  });

  it("no caminho biscoito, depois da queima de biscoito vem a entrega", () => {
    const plano = planejarTerminar(
      ordem({ caminho: "biscoito", feitas: { producao: "2026-03-05", secagem: "2026-03-20" } }),
      "queima1",
      "2026-03-21",
      UMA_PECA,
    );
    expect(plano).toMatchObject({ tipo: "ok", etapa: "queima1", proxima: "entrega" });
  });

  it("etapa esperada ≠ atual → recusa “já marcada” (toque duplo, outro celular)", () => {
    const jaMarcada = ordem({ feitas: { producao: "2026-03-04" } });
    expect(planejarTerminar(jaMarcada, "producao", "2026-03-04", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
  });

  it("ordem que não está ativa → recusa", () => {
    expect(
      planejarTerminar(ordem({ status: "aguardando_sinal", inicio: null }), "producao", "2026-03-04", UMA_PECA),
    ).toEqual({ tipo: "recusa", motivo: "nao-ativa" });
    expect(planejarTerminar(ordem({ status: "concluida" }), "producao", "2026-03-04", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "nao-ativa",
    });
  });

  it("etapa atual entrega → recusa “última etapa” (isso é concluir, plano 11)", () => {
    const naEntrega = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20", queima1: "2026-03-21" },
    });
    expect(planejarTerminar(naEntrega, "entrega", "2026-03-22", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "ultima-etapa",
    });
  });

  it("terminar no mesmo dia em que a anterior foi feita é aceito", () => {
    const plano = planejarTerminar(
      ordem({ feitas: { producao: "2026-03-05" } }),
      "secagem",
      "2026-03-05",
      UMA_PECA,
    );
    expect(plano).toMatchObject({ tipo: "ok", etapa: "secagem", feitaEm: "2026-03-05" });
  });
});

// Fase 06.1 (plano 02): "Terminei" nas bordas — todos os estados que não andam, a etapa esperada
// errada em qualquer posição do caminho (a já feita e a futura) e o parcial que não sobrevive.

describe("planejarTerminar nas bordas", () => {
  it("recusa ordem cancelada (além de aguardando e concluída)", () => {
    expect(planejarTerminar(ordem({ status: "cancelada" }), "producao", "2026-03-04", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "nao-ativa",
    });
  });

  it("o parcial (“já passaram N”) da etapa que termina é limpo (Pitfall 8)", () => {
    const base = ordem({ feitas: { producao: "2026-03-05" } });
    const comParcial = {
      ...base,
      etapas: base.etapas.map((etapa) =>
        etapa.etapa === "secagem" ? { ...etapa, passaram: 3 } : etapa,
      ),
    };
    expect(planejarTerminar(comParcial, "secagem", "2026-03-20", { total: 3 })).toMatchObject({
      tipo: "ok",
      etapa: "secagem",
      proxima: "queima1",
      limparPassaram: true,
    });
  });

  it("etapa esperada ≠ atual → “já marcada”, em qualquer posição (a já feita e a futura)", () => {
    for (const caminho of ["completo", "biscoito"] as const) {
      const etapas = etapasIniciais(caminho).map((etapa) => etapa.etapa);
      // A atual percorre todas as posições que ainda se "terminam" (todas menos a entrega).
      for (let atual = 0; atual < etapas.length - 1; atual += 1) {
        const feitas = Object.fromEntries(
          etapas.slice(0, atual).map((etapa) => [etapa, "2026-03-05"]),
        );
        const naPosicao = ordem({ caminho, feitas });
        for (const esperada of etapas) {
          if (esperada === etapas[atual]) {
            expect(planejarTerminar(naPosicao, esperada, "2026-03-06", UMA_PECA)).toMatchObject({
              tipo: "ok",
              etapa: esperada,
              proxima: etapas[atual + 1],
            });
          } else {
            expect(planejarTerminar(naPosicao, esperada, "2026-03-06", UMA_PECA)).toEqual({
              tipo: "recusa",
              motivo: "ja-marcada",
            });
          }
        }
      }
    }
  });

  it("no caminho biscoito, a esmaltação e a queima de esmalte nunca são a etapa esperada certa", () => {
    const naQueima1 = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20" },
    });
    expect(planejarTerminar(naQueima1, "esmaltacao", "2026-03-21", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
    expect(planejarTerminar(naQueima1, "queima2", "2026-03-21", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
  });

  it("“última etapa” também no caminho completo: a entrega não se termina", () => {
    const naEntrega = ordem({
      feitas: {
        producao: "2026-03-05",
        secagem: "2026-03-10",
        queima1: "2026-03-11",
        esmaltacao: "2026-03-12",
        queima2: "2026-03-20",
      },
    });
    expect(planejarTerminar(naEntrega, "entrega", "2026-03-22", UMA_PECA)).toEqual({
      tipo: "recusa",
      motivo: "ultima-etapa",
    });
  });

  it("virada de ano: termina em 02/01 uma etapa começada em 30/12 — a data é o hoje recebido", () => {
    expect(
      planejarTerminar(ordem({ feitas: { producao: "2026-12-30" } }), "secagem", "2027-01-02", UMA_PECA),
    ).toMatchObject({ tipo: "ok", feitaEm: "2027-01-02", proxima: "queima1" });
  });
});

// Fase 06.5 (D-02, UI-D12 — dono, 05/10/2026): "Terminei" só quando todas as peças passaram pela
// etapa. A mesma função decide no botão e no servidor.
describe("podeTerminarEtapa", () => {
  it("campo vazio (ou zero) com mais de uma peça → não pode, motivo “vazio”, faltam todas", () => {
    expect(podeTerminarEtapa(6, null)).toEqual({ pode: false, motivo: "vazio", faltam: 6 });
    expect(podeTerminarEtapa(6, 0)).toEqual({ pode: false, motivo: "vazio", faltam: 6 });
  });

  it("parcial menor que o total → não pode, motivo “parcial”, com quantas faltam", () => {
    expect(podeTerminarEtapa(6, 4)).toEqual({ pode: false, motivo: "parcial", faltam: 2 });
    expect(podeTerminarEtapa(6, 5)).toEqual({ pode: false, motivo: "parcial", faltam: 1 });
  });

  it("parcial igual ao total → pode", () => {
    expect(podeTerminarEtapa(6, 6)).toEqual({ pode: true });
    expect(podeTerminarEtapa(2, 2)).toEqual({ pode: true });
  });

  it("ordem de uma peça → pode, com ou sem parcial (o campo nem aparece)", () => {
    expect(podeTerminarEtapa(1, null)).toEqual({ pode: true });
    expect(podeTerminarEtapa(1, 1)).toEqual({ pode: true });
  });
});

describe("planejarTerminar com a regra da etapa (D-02)", () => {
  const naSecagem = ordem({ feitas: { producao: "2026-03-05" } });

  it("6 peças, campo vazio → recusa “faltam-pecas” com o parcial nulo, sem gravar", () => {
    expect(planejarTerminar(naSecagem, "secagem", "2026-03-20", { total: 6 })).toEqual({
      tipo: "recusa",
      motivo: "faltam-pecas",
      total: 6,
      passaram: null,
    });
  });

  it("6 peças, já passaram 4 → recusa “faltam-pecas” dizendo as 4", () => {
    expect(
      planejarTerminar(comParcialNaAtual(naSecagem, 4), "secagem", "2026-03-20", { total: 6 }),
    ).toEqual({ tipo: "recusa", motivo: "faltam-pecas", total: 6, passaram: 4 });
  });

  it("6 peças, já passaram 6 → ok, e o parcial é limpo", () => {
    expect(
      planejarTerminar(comParcialNaAtual(naSecagem, 6), "secagem", "2026-03-20", { total: 6 }),
    ).toMatchObject({ tipo: "ok", etapa: "secagem", proxima: "queima1", limparPassaram: true });
  });

  it("o parcial que conta é o da etapa ATUAL — o de outra etapa não libera", () => {
    const comParcialNaFeita = {
      ...naSecagem,
      etapas: naSecagem.etapas.map((etapa) =>
        etapa.etapa === "producao" ? { ...etapa, passaram: 6 } : etapa,
      ),
    };
    expect(planejarTerminar(comParcialNaFeita, "secagem", "2026-03-20", { total: 6 })).toMatchObject(
      { tipo: "recusa", motivo: "faltam-pecas" },
    );
  });

  it("as recusas de antes vêm primeiro: não ativa, já marcada, última etapa", () => {
    expect(
      planejarTerminar(ordem({ status: "concluida" }), "producao", "2026-03-04", { total: 6 }),
    ).toEqual({ tipo: "recusa", motivo: "nao-ativa" });
    expect(planejarTerminar(naSecagem, "producao", "2026-03-20", { total: 6 })).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
    const naEntrega = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20", queima1: "2026-03-21" },
    });
    expect(planejarTerminar(naEntrega, "entrega", "2026-03-22", { total: 6 })).toEqual({
      tipo: "recusa",
      motivo: "ultima-etapa",
    });
  });
});

// Fase 06.1 (plano 03, PRD-11): liberar a ordem que aguarda o sinal. Só de `aguardando_sinal`; o
// início é o "hoje" do servidor. O segundo "Liberar" (outro celular, toque duplo) é recusado e o
// início não muda.
describe("planejarLiberacao", () => {
  const aguardando = { status: "aguardando_sinal" as const, inicio: null };

  it("ordem aguardando o sinal → ok, com início = hoje", () => {
    expect(planejarLiberacao(aguardando, "2026-10-01")).toEqual({ tipo: "ok", inicio: "2026-10-01" });
  });

  it("o início é sempre o hoje recebido — virada de ano e 29/02", () => {
    expect(planejarLiberacao(aguardando, "2027-01-01")).toEqual({ tipo: "ok", inicio: "2027-01-01" });
    expect(planejarLiberacao(aguardando, "2028-02-29")).toEqual({ tipo: "ok", inicio: "2028-02-29" });
  });

  it("ordem já ativa → recusa ja-liberada (o início não muda)", () => {
    expect(planejarLiberacao({ status: "ativa", inicio: "2026-09-20" }, "2026-10-01")).toEqual({
      tipo: "recusa",
      motivo: "ja-liberada",
    });
  });

  it("ordem concluída → recusa ja-liberada", () => {
    expect(planejarLiberacao({ status: "concluida", inicio: "2026-08-01" }, "2026-10-01")).toEqual({
      tipo: "recusa",
      motivo: "ja-liberada",
    });
  });

  it("ordem cancelada → recusa cancelada", () => {
    expect(planejarLiberacao({ status: "cancelada", inicio: "2026-08-01" }, "2026-10-01")).toEqual({
      tipo: "recusa",
      motivo: "cancelada",
    });
  });

  it("aceita a ordem inteira da leitura (o que a ação passa depois de travar)", () => {
    expect(planejarLiberacao(ordem({ status: "aguardando_sinal", inicio: null }), "2026-10-01")).toEqual({
      tipo: "ok",
      inicio: "2026-10-01",
    });
  });
});

// Fase 06.1 (plano 05): desfazer a última, ajustar os dias previstos e o parcial — as três mexidas
// na trilha, decididas sob a trava da ordem contra o que a pessoa viu na tela (Pitfall 7).

function comParcial(base: OrdemParaLeitura, etapa: string, passaram: number): OrdemParaLeitura {
  return {
    ...base,
    etapas: base.etapas.map((linha) => (linha.etapa === etapa ? { ...linha, passaram } : linha)),
  };
}

describe("planejarDesfazer", () => {
  const duasFeitas = ordem({ feitas: { producao: "2026-03-05", secagem: "2026-03-20" } });

  it("esperada = a última feita → ok, e a ordem fica sem parcial nenhum", () => {
    expect(planejarDesfazer(duasFeitas, "secagem")).toEqual({
      tipo: "ok",
      etapa: "secagem",
      limparParciais: true,
    });
  });

  it("o parcial da etapa atual (que volta a ser futura) não sobrevive (Pitfall 8)", () => {
    expect(planejarDesfazer(comParcial(duasFeitas, "queima1", 4), "secagem")).toMatchObject({
      tipo: "ok",
      etapa: "secagem",
      limparParciais: true,
    });
  });

  it("esperada é uma feita que não é a última → recusa “já desfeita”", () => {
    expect(planejarDesfazer(duasFeitas, "producao")).toEqual({
      tipo: "recusa",
      motivo: "ja-desfeita",
    });
  });

  it("esperada é a atual ou uma futura → recusa “já desfeita” (outro celular desfez antes)", () => {
    expect(planejarDesfazer(duasFeitas, "queima1")).toEqual({
      tipo: "recusa",
      motivo: "ja-desfeita",
    });
    expect(planejarDesfazer(duasFeitas, "entrega")).toEqual({
      tipo: "recusa",
      motivo: "ja-desfeita",
    });
  });

  it("nenhuma etapa feita → recusa “nada a desfazer”", () => {
    expect(planejarDesfazer(ordem(), "producao")).toEqual({
      tipo: "recusa",
      motivo: "nada-a-desfazer",
    });
  });

  it("ordem aguardando, concluída ou cancelada → recusa “não ativa”", () => {
    for (const status of ["aguardando_sinal", "concluida", "cancelada"] as const) {
      expect(
        planejarDesfazer(ordem({ status, feitas: { producao: "2026-03-05" } }), "producao"),
      ).toEqual({ tipo: "recusa", motivo: "nao-ativa" });
    }
  });

  it("na entrega (tudo antes feito) desfaz a última queima — no biscoito, a de biscoito", () => {
    const naEntrega = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20", queima1: "2026-03-21" },
    });
    expect(planejarDesfazer(naEntrega, "queima1")).toMatchObject({ tipo: "ok", etapa: "queima1" });
  });

  it("desfazer a etapa feita no mesmo dia da anterior é aceito", () => {
    const mesmoDia = ordem({ feitas: { producao: "2026-03-05", secagem: "2026-03-05" } });
    expect(planejarDesfazer(mesmoDia, "secagem")).toMatchObject({ tipo: "ok", etapa: "secagem" });
  });
});

describe("planejarAjusteDePrevisto", () => {
  const naSecagem = ordem({ feitas: { producao: "2026-03-05" } });

  it("etapa futura +1 de 15 → 16; −1 de 4 → 3", () => {
    expect(planejarAjusteDePrevisto(ordem(), "secagem", 1)).toEqual({
      tipo: "ok",
      etapa: "secagem",
      diasPrevistos: 16,
    });
    // A esmaltação nasce com 4 desde a correção do dono de 01/10/2026 (antes, a queima de esmalte).
    expect(planejarAjusteDePrevisto(naSecagem, "esmaltacao", -1)).toEqual({
      tipo: "ok",
      etapa: "esmaltacao",
      diasPrevistos: 3,
    });
  });

  it("−1 de 1 → recusa “limite”; +1 de 365 → recusa “limite”", () => {
    expect(planejarAjusteDePrevisto(naSecagem, "queima1", -1)).toEqual({
      tipo: "recusa",
      motivo: "limite",
    });
    const no365 = {
      ...naSecagem,
      etapas: naSecagem.etapas.map((linha) =>
        linha.etapa === "entrega" ? { ...linha, diasPrevistos: 365 } : linha,
      ),
    };
    expect(planejarAjusteDePrevisto(no365, "entrega", 1)).toEqual({
      tipo: "recusa",
      motivo: "limite",
    });
    expect(planejarAjusteDePrevisto(no365, "entrega", -1)).toEqual({
      tipo: "ok",
      etapa: "entrega",
      diasPrevistos: 364,
    });
  });

  it("etapa atual → recusa “não futura”; etapa feita → recusa “não futura”", () => {
    expect(planejarAjusteDePrevisto(naSecagem, "secagem", 1)).toEqual({
      tipo: "recusa",
      motivo: "nao-futura",
    });
    expect(planejarAjusteDePrevisto(naSecagem, "producao", 1)).toEqual({
      tipo: "recusa",
      motivo: "nao-futura",
    });
  });

  it("ordem aguardando o sinal → todas as etapas aceitam, inclusive a primeira", () => {
    const aguardando = ordem({ status: "aguardando_sinal", inicio: null });
    for (const linha of aguardando.etapas) {
      expect(planejarAjusteDePrevisto(aguardando, linha.etapa, 1)).toEqual({
        tipo: "ok",
        etapa: linha.etapa,
        diasPrevistos: linha.diasPrevistos + 1,
      });
    }
  });

  it("ordem concluída ou cancelada → recusa “não ativa”", () => {
    for (const status of ["concluida", "cancelada"] as const) {
      expect(planejarAjusteDePrevisto(ordem({ status }), "entrega", 1)).toEqual({
        tipo: "recusa",
        motivo: "nao-ativa",
      });
    }
  });

  it("delta fora de ±1 → recusa “delta inválido”", () => {
    for (const delta of [0, 2, -2, 0.5, Number.NaN]) {
      expect(planejarAjusteDePrevisto(naSecagem, "entrega", delta)).toEqual({
        tipo: "recusa",
        motivo: "delta-invalido",
      });
    }
  });

  it("etapa fora do caminho (esmaltação no biscoito) → recusa “não futura”", () => {
    expect(planejarAjusteDePrevisto(ordem({ caminho: "biscoito" }), "esmaltacao", 1)).toEqual({
      tipo: "recusa",
      motivo: "nao-futura",
    });
  });
});

describe("totalDeFeitas", () => {
  it("soma quantidade + a mais de cada peça", () => {
    expect(
      totalDeFeitas([
        { quantidade: 20, aMais: 4 },
        { quantidade: 6, aMais: 0 },
      ]),
    ).toBe(30);
    expect(totalDeFeitas([])).toBe(0);
  });
});

describe("planejarParcial", () => {
  const naSecagem = ordem({ feitas: { producao: "2026-03-05" } });

  it("total 30, 18 na etapa atual → 18", () => {
    expect(planejarParcial(naSecagem, "secagem", 18, 30)).toEqual({ tipo: "ok", passaram: 18 });
  });

  it("0 e vazio → sem parcial (null)", () => {
    expect(planejarParcial(naSecagem, "secagem", 0, 30)).toEqual({ tipo: "ok", passaram: null });
    expect(planejarParcial(naSecagem, "secagem", null, 30)).toEqual({ tipo: "ok", passaram: null });
  });

  it("o total exato é aceito; 31 de 30 → recusa “fora da faixa”", () => {
    expect(planejarParcial(naSecagem, "secagem", 30, 30)).toEqual({ tipo: "ok", passaram: 30 });
    expect(planejarParcial(naSecagem, "secagem", 31, 30)).toEqual({
      tipo: "recusa",
      motivo: "fora-da-faixa",
    });
  });

  it("não inteiro ou negativo → recusa “fora da faixa” (o Zod já recusa antes)", () => {
    expect(planejarParcial(naSecagem, "secagem", 2.5, 30)).toEqual({
      tipo: "recusa",
      motivo: "fora-da-faixa",
    });
    expect(planejarParcial(naSecagem, "secagem", -1, 30)).toEqual({
      tipo: "recusa",
      motivo: "fora-da-faixa",
    });
  });

  it("etapa esperada ≠ atual → recusa “etapa mudou” (outro celular marcou ou desfez)", () => {
    expect(planejarParcial(naSecagem, "producao", 5, 30)).toEqual({
      tipo: "recusa",
      motivo: "etapa-mudou",
    });
    expect(planejarParcial(naSecagem, "queima1", 5, 30)).toEqual({
      tipo: "recusa",
      motivo: "etapa-mudou",
    });
  });

  it("etapa atual entrega → recusa “última etapa”", () => {
    const naEntrega = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20", queima1: "2026-03-21" },
    });
    expect(planejarParcial(naEntrega, "entrega", 5, 30)).toEqual({
      tipo: "recusa",
      motivo: "ultima-etapa",
    });
  });

  it("ordem não ativa → recusa “não ativa”", () => {
    for (const status of ["aguardando_sinal", "concluida", "cancelada"] as const) {
      expect(planejarParcial(ordem({ status }), "producao", 5, 30)).toEqual({
        tipo: "recusa",
        motivo: "nao-ativa",
      });
    }
  });

  it("salvar o mesmo parcial de novo dá o mesmo valor (idempotente)", () => {
    const jaCom18 = comParcial(naSecagem, "secagem", 18);
    expect(planejarParcial(jaCom18, "secagem", 18, 30)).toEqual({ tipo: "ok", passaram: 18 });
  });
});

// Plano 06 (PRD-18): cancelar a ordem só de aguardando ou ativa — decidido sob a trava. Concluída e
// cancelada valem pelo que aconteceu: o segundo "Cancelar" (outro celular, toque duplo) recebe a
// frase de estado já mudado, sem gravar nada. O plano só decide o status: venda, parcela e estoque
// não entram (a ação não escreve neles).
describe("planejarCancelamento", () => {
  it("ordem aguardando o sinal → ok", () => {
    expect(planejarCancelamento({ status: "aguardando_sinal" })).toEqual({ tipo: "ok" });
  });

  it("ordem ativa → ok", () => {
    expect(planejarCancelamento({ status: "ativa" })).toEqual({ tipo: "ok" });
  });

  it("ordem concluída → recusa ja-encerrada", () => {
    expect(planejarCancelamento({ status: "concluida" })).toEqual({
      tipo: "recusa",
      motivo: "ja-encerrada",
    });
  });

  it("ordem já cancelada → recusa ja-encerrada (cancelar de novo não grava)", () => {
    expect(planejarCancelamento({ status: "cancelada" })).toEqual({
      tipo: "recusa",
      motivo: "ja-encerrada",
    });
  });

  it("aceita a ordem inteira lida para a trilha (só o status decide)", () => {
    expect(planejarCancelamento(ordem({ feitas: { producao: "2026-03-03" } }))).toEqual({
      tipo: "ok",
    });
  });
});
