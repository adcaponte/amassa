import { describe, expect, it } from "vitest";

import {
  agruparTarefasPorGrupo,
  contagemRegressiva,
  contarEntregasVencidas,
  contarTarefasAbertasPorItem,
  entregaVencida,
  ordenarTarefasDoGrupo,
  urgenciaDaTarefa,
  type Grupo,
  type TarefaParaAgrupar,
} from "../../lib/abertura/prazos";

// Tarefa 1 (04.2-02-PLAN.md): os casos que definem o contrato de `lib/abertura/prazos.ts` —
// urgência, ordenação dentro do grupo e agrupamento por área (D-09/D-10). `hoje` sempre entra
// por argumento (nunca lido do relógio), mesma disciplina de `lib/abertura/parcelas.ts`, de onde
// `diferencaEmDias` é importado (o único import do módulo).

describe("urgenciaDaTarefa", () => {
  it("concluída é sempre 'feita', mesmo com prazo muito vencido", () => {
    expect(urgenciaDaTarefa({ concluida: true, prazoEm: "2026-01-01" }, "2026-09-10")).toEqual({
      tipo: "feita",
    });
  });

  it("prazo de ontem devolve atrasada há 1 dia", () => {
    expect(urgenciaDaTarefa({ concluida: false, prazoEm: "2026-09-09" }, "2026-09-10")).toEqual({
      tipo: "atrasada",
      dias: 1,
    });
  });

  it("atraso que atravessa o fim do mês conta os dias certos", () => {
    expect(urgenciaDaTarefa({ concluida: false, prazoEm: "2026-08-31" }, "2026-09-10")).toEqual({
      tipo: "atrasada",
      dias: 10,
    });
  });

  it("atraso que atravessa o ano conta os dias certos", () => {
    expect(urgenciaDaTarefa({ concluida: false, prazoEm: "2026-12-31" }, "2027-01-02")).toEqual({
      tipo: "atrasada",
      dias: 2,
    });
  });

  it("prazo igual a hoje devolve 'hoje'", () => {
    expect(urgenciaDaTarefa({ concluida: false, prazoEm: "2026-09-10" }, "2026-09-10")).toEqual({
      tipo: "hoje",
    });
  });

  it("prazo futuro devolve 'futura' com os dias que faltam", () => {
    expect(urgenciaDaTarefa({ concluida: false, prazoEm: "2026-09-11" }, "2026-09-10")).toEqual({
      tipo: "futura",
      dias: 1,
    });
  });
});

describe("ordenarTarefasDoGrupo", () => {
  it("abertas antes de concluídas, e entre as abertas o prazo mais próximo primeiro", () => {
    const concluidaAntiga = { id: "c", concluida: true, prazoEm: "2026-01-01" };
    const atrasada = { id: "a", concluida: false, prazoEm: "2026-09-09" };
    const futura = { id: "f", concluida: false, prazoEm: "2026-09-20" };

    const ordenadas = ordenarTarefasDoGrupo([concluidaAntiga, atrasada, futura]);

    expect(ordenadas.map((tarefa) => tarefa.id)).toEqual(["a", "f", "c"]);
  });

  it("não muta o vetor recebido", () => {
    const original = [
      { id: "1", concluida: false, prazoEm: "2026-09-20" },
      { id: "2", concluida: false, prazoEm: "2026-09-01" },
    ];
    const copia = [...original];

    ordenarTarefasDoGrupo(original);

    expect(original).toEqual(copia);
  });
});

describe("agruparTarefasPorGrupo", () => {
  const hoje = "2026-09-10";

  function tarefa(
    parcial: Partial<TarefaParaAgrupar> & { grupo: Grupo },
  ): TarefaParaAgrupar {
    return {
      concluida: false,
      prazoEm: hoje,
      ...parcial,
    };
  }

  it("devolve os grupos na ordem de D-09, pulando grupo sem tarefa", () => {
    const tarefas = [
      tarefa({ grupo: "montagem" }),
      tarefa({ grupo: "obra" }),
      tarefa({ grupo: "aquisicao" }),
    ];

    const grupos = agruparTarefasPorGrupo(tarefas, hoje);

    expect(grupos.map((grupo) => grupo.grupo)).toEqual(["obra", "aquisicao", "montagem"]);
    // Documentação e Divulgação não têm tarefa nenhuma nesta lista — nenhum cabeçalho vazio.
    expect(grupos).toHaveLength(3);
  });

  it("cada grupo traz concluidas, total e atrasadas já contados", () => {
    const tarefas = [
      tarefa({ grupo: "obra", concluida: true, prazoEm: "2026-01-01" }),
      tarefa({ grupo: "obra", concluida: false, prazoEm: "2026-09-01" }),
      tarefa({ grupo: "obra", concluida: false, prazoEm: "2026-09-20" }),
    ];

    const [grupoObra] = agruparTarefasPorGrupo(tarefas, hoje);

    expect(grupoObra).toMatchObject({ grupo: "obra", total: 3, concluidas: 1, atrasadas: 1 });
  });

  it("devolve vetor vazio, sem lançar, quando não há tarefa nenhuma", () => {
    expect(agruparTarefasPorGrupo([], hoje)).toEqual([]);
  });
});

describe("contarTarefasAbertasPorItem", () => {
  it("conta tarefas não concluídas por item, ignorando itemId nulo", () => {
    const mapa = contarTarefasAbertasPorItem([
      { concluida: false, itemId: "item-1" },
      { concluida: false, itemId: "item-1" },
      { concluida: true, itemId: "item-1" },
      { concluida: false, itemId: null },
    ]);

    expect(mapa.get("item-1")).toBe(2);
    expect(mapa.size).toBe(1);
  });

  // Tarefa 2 (04.2-02-PLAN.md): o vínculo item ↔ tarefa lido do lado do item (D-13) — a leitura
  // que a plano chama de mais importante, porque sem ela um item comprado parece encerrado
  // enquanto a instalação ainda não aconteceu.
  it("um item sem nenhuma tarefa não aparece como chave — nunca uma chave com valor 0", () => {
    const mapa = contarTarefasAbertasPorItem([
      { concluida: false, itemId: "item-1" },
      { concluida: false, itemId: null },
    ]);

    expect(mapa.has("item-2")).toBe(false);
    expect(mapa.get("item-2")).toBeUndefined();
  });

  it("um item cujas tarefas estão todas concluídas não aparece no mapa", () => {
    const mapa = contarTarefasAbertasPorItem([
      { concluida: true, itemId: "item-1" },
      { concluida: true, itemId: "item-1" },
    ]);

    expect(mapa.has("item-1")).toBe(false);
  });

  it("chamar duas vezes com a mesma lista devolve o mesmo mapa e não muta a lista", () => {
    const tarefas = [
      { concluida: false, itemId: "item-1" },
      { concluida: true, itemId: "item-1" },
      { concluida: false, itemId: "item-2" },
    ];
    const copia = tarefas.map((tarefa) => ({ ...tarefa }));

    const primeiraChamada = contarTarefasAbertasPorItem(tarefas);
    const segundaChamada = contarTarefasAbertasPorItem(tarefas);

    expect(Object.fromEntries(primeiraChamada)).toEqual(Object.fromEntries(segundaChamada));
    expect(tarefas).toEqual(copia);
  });
});

// Tarefa 1 (04.2-03-PLAN.md): `entregaVencida` exige os TRÊS fatos ao mesmo tempo (existe
// entrega prevista, o item NÃO está resolvido, a data já passou) — cada um tem caso próprio
// isolando exatamente ELE, porque tirar qualquer um produz um alerta que nunca apaga (D-07) ou
// que nunca aparece (D-04).
describe("entregaVencida", () => {
  it("com os três fatos (entrega no passado, não resolvido) é verdadeiro", () => {
    expect(
      entregaVencida(
        { entregaPrevistaEm: "2026-09-01", resolvido: false },
        "2026-09-10",
      ),
    ).toBe(true);
  });

  it("o mesmo item marcado como resolvido é falso — a marcação é a ÚNICA coisa que apaga o alerta", () => {
    expect(
      entregaVencida({ entregaPrevistaEm: "2026-09-01", resolvido: true }, "2026-09-10"),
    ).toBe(false);
  });

  it("o mesmo item sem entrega prevista é falso, por mais antigo que seja o item", () => {
    expect(entregaVencida({ entregaPrevistaEm: null, resolvido: false }, "2026-09-10")).toBe(
      false,
    );
  });

  it("entrega prevista para HOJE é falsa — vencer é a data já ter passado, não ser hoje", () => {
    expect(
      entregaVencida({ entregaPrevistaEm: "2026-09-10", resolvido: false }, "2026-09-10"),
    ).toBe(false);
  });

  it("entrega prevista para o futuro é falsa", () => {
    expect(
      entregaVencida({ entregaPrevistaEm: "2026-09-11", resolvido: false }, "2026-09-10"),
    ).toBe(false);
  });
});

describe("contarEntregasVencidas", () => {
  it("sobre uma lista mista devolve só as que satisfazem os três fatos", () => {
    const itens = [
      { entregaPrevistaEm: "2026-09-01", resolvido: false }, // vencida
      { entregaPrevistaEm: "2026-09-01", resolvido: true }, // resolvida, não conta
      { entregaPrevistaEm: null, resolvido: false }, // sem data, não conta
      { entregaPrevistaEm: "2026-09-10", resolvido: false }, // hoje, não conta
      { entregaPrevistaEm: "2026-08-20", resolvido: false }, // vencida
    ];

    expect(contarEntregasVencidas(itens, "2026-09-10")).toBe(2);
  });

  it("lista sem nenhum item vencido devolve 0", () => {
    expect(
      contarEntregasVencidas(
        [{ entregaPrevistaEm: null, resolvido: false }],
        "2026-09-10",
      ),
    ).toBe(0);
  });
});

// Tarefa 3 (04.2-04-PLAN.md): `contagemRegressiva` — D-17/ABE-14. `dias` é sempre não negativo;
// o TIPO é quem diz a direção. Depois de a data passar, a contagem continua subindo em vez de
// parar em zero — espaço que abriu tarde é informação, não erro.
describe("contagemRegressiva", () => {
  it("faltam 44 dias: 2026-10-24 com hoje 2026-09-10", () => {
    expect(contagemRegressiva("2026-10-24", "2026-09-10")).toEqual({ tipo: "faltam", dias: 44 });
  });

  it("falta 1 dia: 2026-10-24 com hoje 2026-10-23", () => {
    expect(contagemRegressiva("2026-10-24", "2026-10-23")).toEqual({ tipo: "faltam", dias: 1 });
  });

  it("é hoje: 2026-10-24 com hoje 2026-10-24", () => {
    expect(contagemRegressiva("2026-10-24", "2026-10-24")).toEqual({ tipo: "hoje", dias: 0 });
  });

  it("passou 1 dia: 2026-10-24 com hoje 2026-10-25 — nunca zero nem negativo", () => {
    expect(contagemRegressiva("2026-10-24", "2026-10-25")).toEqual({ tipo: "passou", dias: 1 });
  });

  it("passou 3 dias: 2026-10-24 com hoje 2026-10-27", () => {
    expect(contagemRegressiva("2026-10-24", "2026-10-27")).toEqual({ tipo: "passou", dias: 3 });
  });

  it("passou 3 dias atravessando o ano: 2026-12-31 com hoje 2027-01-03", () => {
    expect(contagemRegressiva("2026-12-31", "2027-01-03")).toEqual({ tipo: "passou", dias: 3 });
  });

  it("sem data definida (null) devolve null", () => {
    expect(contagemRegressiva(null, "2026-09-10")).toBeNull();
  });
});
