// Módulo puro: recebe dados, devolve dados. Zero imports — no molde de `lib/encomendas/filtros.ts`
// (03-CONTEXT.md D-11: filtro roda no CLIENTE, sobre a lista já carregada). `NivelDeFornoFiltro`
// abaixo é uma redeclaração ESTRUTURAL do `NivelDeForno` de `lib/queimas/contador.ts` — mesma
// disciplina de `SituacaoDeUrgencia` em `lib/encomendas/filtros.ts`: como TypeScript tipa por
// estrutura, o `NivelDeForno` real continua atribuível aqui sem nenhum `import type`.

export type FiltroDeForno = "ativos" | "desativados" | "todos";

type NivelDeFornoFiltro = "ok" | "atencao" | "critico";

export type FornoDeIndiceFiltravel = {
  readonly ativo: boolean;
};

// D-05: o filtro do índice de `/queimas` — Ativos (padrão) / Desativados / Todos. Devolve a
// MESMA lista na MESMA ordem, só removendo itens — nunca reordena; ordenar é responsabilidade de
// quem monta a lista (`listarFornosDoIndice`, já ordenada por nome), nunca deste filtro.
export function filtrarPorAtivo<T extends FornoDeIndiceFiltravel>(
  fornos: readonly T[],
  filtro: FiltroDeForno,
): T[] {
  if (filtro === "todos") {
    return [...fornos];
  }
  const querAtivo = filtro === "ativos";
  return fornos.filter((forno) => forno.ativo === querAtivo);
}

export type FornoParaBanner = {
  readonly nome: string;
  readonly ativo: boolean;
  readonly nivel: NivelDeFornoFiltro;
  readonly contador: number;
};

const PESO_NIVEL_NO_BANNER: Record<"critico" | "atencao", number> = {
  critico: 0,
  atencao: 1,
};

// FOR-06: os fornos que precisam de atenção, na ordem do banner agregado — críticos primeiro,
// depois os em atenção e, dentro de cada nível, por contador decrescente (o mais perto de
// estourar primeiro); o nome entra como terceiro critério, para a ordem ficar estável entre
// recargas mesmo com contadores empatados.
//
// Fornos DESATIVADOS nunca entram no banner — um forno fora de uso não precisa de manutenção
// urgente, e o aviso existe para guiar ação sobre o que está em uso (esta função filtra por
// `ativo` além de por `nivel`, não é responsabilidade só de `filtrarPorAtivo`: o banner é
// calculado sobre a lista COMPLETA carregada, e é esta função que decide quem entra nele).
export function ordenarParaBanner<T extends FornoParaBanner>(fornos: readonly T[]): T[] {
  return fornos
    .filter((forno) => forno.ativo && forno.nivel !== "ok")
    .sort((a, b) => {
      const pesoA = PESO_NIVEL_NO_BANNER[a.nivel as "critico" | "atencao"];
      const pesoB = PESO_NIVEL_NO_BANNER[b.nivel as "critico" | "atencao"];
      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }
      if (a.contador !== b.contador) {
        return b.contador - a.contador;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}
