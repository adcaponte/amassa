// Módulo puro do Estoque — os destinos da saída MANUAL (D-14, D-15). Só `import type`: nenhuma
// linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano 06-01), mesma
// disciplina de `lib/cadastros/catalogo.ts`. `DestinoDeSaida` é REDECLARADO à mão, espelhando o enum
// `destino_saida` do banco (migração 0023) — nenhum import de `@/db/schema` é permitido aqui.
//
// A constante `DESTINOS_DE_SAIDA` é a ÚNICA fonte da lista: a folha de movimentação desenha a grade
// a partir dela (na ordem dela), e a Server Action decide a área que paga por `areaDoDestino` — a
// área NUNCA vem do cliente.
//
// Cada destino carrega a área do Financeiro que paga (D-14): o protótipo já usava nome de área em
// três (aula → Espaço, encomenda → Peças, cafeteria → Cafeteria); os dois que iam para "Ateliê
// produtivo" (uso do ateliê, perda ou quebra) vão para Peças — o adendo diz que "Ateliê"
// corresponde a Peças. "Venda na loja" não existe (D-15): venda só nasce no Financeiro.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";

export type DestinoDeSaida = "aula" | "encomenda" | "cafeteria" | "atelie" | "perda";

// O que a folha pede junto do destino (UI-SPEC §"Rótulos e dicas de campo"): turma em texto livre
// até a Agenda existir; encomenda por seletor; "o que aconteceu?" na perda. O traçador (06-01) não
// desenha o vínculo — os campos entram no plano da folha completa.
export type VinculoDoDestino = "turma" | "encomenda" | "o-que-aconteceu" | null;

export type DescricaoDoDestino = {
  valor: DestinoDeSaida;
  rotulo: string;
  area: AreaFinanceira;
  vinculo: VinculoDoDestino;
};

export const DESTINOS_DE_SAIDA: readonly DescricaoDoDestino[] = [
  { valor: "aula", rotulo: "Consumo em aula", area: "espaco", vinculo: "turma" },
  { valor: "encomenda", rotulo: "Consumo em encomenda", area: "pecas", vinculo: "encomenda" },
  { valor: "cafeteria", rotulo: "Consumo na cafeteria", area: "cafeteria", vinculo: null },
  { valor: "atelie", rotulo: "Uso do ateliê", area: "pecas", vinculo: null },
  { valor: "perda", rotulo: "Perda ou quebra", area: "pecas", vinculo: "o-que-aconteceu" },
];

const DESTINO_POR_VALOR: ReadonlyMap<DestinoDeSaida, DescricaoDoDestino> = new Map(
  DESTINOS_DE_SAIDA.map((destino) => [destino.valor, destino]),
);

export function ehDestinoDeSaida(valor: unknown): valor is DestinoDeSaida {
  return typeof valor === "string" && DESTINO_POR_VALOR.has(valor as DestinoDeSaida);
}

function descricao(destino: DestinoDeSaida): DescricaoDoDestino {
  const encontrado = DESTINO_POR_VALOR.get(destino);
  if (!encontrado) {
    throw new RangeError(`Destino de saída desconhecido: ${String(destino)}`);
  }
  return encontrado;
}

export function areaDoDestino(destino: DestinoDeSaida): AreaFinanceira {
  return descricao(destino).area;
}

export function rotuloDoDestino(destino: DestinoDeSaida): string {
  return descricao(destino).rotulo;
}
