import { describe, expect, it } from "vitest";

import {
  agruparTarefasPorGrupo,
  contarTarefasAbertasPorItem,
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
});
