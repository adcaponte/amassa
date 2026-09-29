import { describe, expect, it } from "vitest";

import {
  producaoEmAndamento,
  type EncomendaParaProducao,
} from "../../lib/encomendas/producao-em-andamento";
import type { Situacao } from "../../lib/encomendas/cronograma";

function encomenda(id: string, titulo: string, situacao: Situacao): EncomendaParaProducao {
  return { id, titulo, situacao };
}

describe("producaoEmAndamento", () => {
  it("devolve uma linha com título, etapa atual e o que vem depois (em-etapa-intervalo)", () => {
    const situacao: Situacao = {
      tipo: "em-etapa-intervalo",
      etapa: "producao",
      proximaEtapa: "secagem",
      diasAteProxima: 3,
    };
    const linhas = producaoEmAndamento([
      encomenda("1", "[e2e] Xícaras com logo", situacao),
    ]);
    expect(linhas).toEqual([
      {
        id: "1",
        titulo: "[e2e] Xícaras com logo",
        etapaAtual: "producao",
        proximaEtapa: "secagem",
        diasAteProxima: 3,
        atrasoDias: null,
        diasAteInicio: null,
        emEspera: false,
      },
    ]);
  });

  it('nenhuma linha traz o estado que o dono tirou da amostra — o TIPO não permite: "etapaAtual" só aceita as etapas que o módulo de Encomendas realmente tem', () => {
    // Prova estrutural, não um `if` que testa e pula: toda `Situacao` possível (as nove que
    // `lib/encomendas/cronograma.ts` define) passa por `producaoEmAndamento` e o resultado
    // sempre cai dentro do union `Etapa | null` — não existe valor fora dele.
    const todasAsSituacoes: Situacao[] = [
      { tipo: "nao-comecou", diasAteInicio: 2, dataInicio: "2026-12-20" },
      { tipo: "em-etapa-intervalo", etapa: "producao", proximaEtapa: "secagem", diasAteProxima: 3 },
      { tipo: "em-etapa-marco", etapa: "queima1" },
      { tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 1 },
      { tipo: "atrasada", dataPrevista: "2026-12-10", diasDeAtraso: 5 },
      { tipo: "concluida", dataDeConclusao: "2026-12-10" },
      { tipo: "cancelada" },
      { tipo: "sem-etapas" },
      { tipo: "em-espera", proximaEtapa: "queima2", diasAteProxima: 2 },
    ];
    const ETAPAS_VALIDAS = new Set([
      "producao",
      "secagem",
      "queima1",
      "esmaltacao",
      "queima2",
      "entrega",
    ]);

    const linhas = producaoEmAndamento(
      todasAsSituacoes.map((situacao, indice) => encomenda(String(indice), `[e2e] Ordem ${indice}`, situacao)),
    );

    for (const linha of linhas) {
      if (linha.etapaAtual !== null) {
        expect(ETAPAS_VALIDAS.has(linha.etapaAtual)).toBe(true);
      }
      if (linha.proximaEtapa !== null) {
        expect(ETAPAS_VALIDAS.has(linha.proximaEtapa)).toBe(true);
      }
    }
  });

  it("lista de entrada vazia devolve lista vazia, sem erro", () => {
    expect(producaoEmAndamento([])).toEqual([]);
  });

  it("preserva a ordem de entrada — a ordenação é do módulo, não do Início", () => {
    const situacaoMarco: Situacao = { tipo: "em-etapa-marco", etapa: "queima1" };
    const linhas = producaoEmAndamento([
      encomenda("b", "[e2e] Ordem B", situacaoMarco),
      encomenda("a", "[e2e] Ordem A", situacaoMarco),
      encomenda("c", "[e2e] Ordem C", situacaoMarco),
    ]);
    expect(linhas.map((linha) => linha.id)).toEqual(["b", "a", "c"]);
  });

  it("etapa atual sem próxima etapa (ultima-etapa) devolve 'o que vem depois' nulo, sem texto vazio", () => {
    const situacao: Situacao = { tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 2 };
    const [linha] = producaoEmAndamento([encomenda("1", "[e2e] Ordem final", situacao)]);
    expect(linha.etapaAtual).toBe("entrega");
    expect(linha.proximaEtapa).toBeNull();
    expect(linha.diasAteProxima).toBeNull();
  });

  // CR-04 (revisão da Fase 04.6): "atrasada" e "nao-comecou" caíam no `default`, com
  // `etapaAtual: null` — e o bloco pintava toda linha sem etapa como "Em espera". Uma encomenda
  // com a entrega vencida, a linha mais urgente que a amostra pode mostrar, aparecia como parada.
  it("encomenda atrasada carrega os dias de atraso, e não é marcada como em espera", () => {
    const situacao: Situacao = { tipo: "atrasada", dataPrevista: "2026-12-10", diasDeAtraso: 3 };
    const [linha] = producaoEmAndamento([encomenda("1", "[e2e] Ordem atrasada", situacao)]);
    expect(linha).toEqual({
      id: "1",
      titulo: "[e2e] Ordem atrasada",
      etapaAtual: null,
      proximaEtapa: null,
      diasAteProxima: null,
      atrasoDias: 3,
      diasAteInicio: null,
      emEspera: false,
    });
  });

  it("encomenda que ainda não começou carrega os dias até o início, e não é marcada como em espera", () => {
    const situacao: Situacao = { tipo: "nao-comecou", diasAteInicio: 2, dataInicio: "2026-12-20" };
    const [linha] = producaoEmAndamento([encomenda("1", "[e2e] Ordem futura", situacao)]);
    expect(linha).toEqual({
      id: "1",
      titulo: "[e2e] Ordem futura",
      etapaAtual: null,
      proximaEtapa: null,
      diasAteProxima: null,
      atrasoDias: null,
      diasAteInicio: 2,
      emEspera: false,
    });
  });

  it("só a situação em-espera é marcada como em espera", () => {
    const todas: Situacao[] = [
      { tipo: "nao-comecou", diasAteInicio: 2, dataInicio: "2026-12-20" },
      { tipo: "em-etapa-intervalo", etapa: "producao", proximaEtapa: "secagem", diasAteProxima: 3 },
      { tipo: "em-etapa-marco", etapa: "queima1" },
      { tipo: "ultima-etapa", etapa: "entrega", diasAteEntrega: 1 },
      { tipo: "atrasada", dataPrevista: "2026-12-10", diasDeAtraso: 5 },
      { tipo: "concluida", dataDeConclusao: "2026-12-10" },
      { tipo: "cancelada" },
      { tipo: "sem-etapas" },
      { tipo: "em-espera", proximaEtapa: "queima2", diasAteProxima: 2 },
    ];
    const linhas = producaoEmAndamento(
      todas.map((situacao, indice) => encomenda(String(indice), `[e2e] Ordem ${indice}`, situacao)),
    );
    const emEspera = linhas.filter((linha) => linha.emEspera).map((linha) => linha.id);
    expect(emEspera).toEqual(["8"]);
  });
});
