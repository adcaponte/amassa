// Módulo puro do Estoque — os destinos da saída MANUAL (D-14, D-15). Só `import type`: nenhuma
// linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano 06-01), mesma
// disciplina de `lib/cadastros/catalogo.ts`. `DestinoDeSaida` é REDECLARADO à mão, espelhando o enum
// `destino_saida` do banco (migrações 0023 e 0026) — nenhum import de `@/db/schema` é permitido aqui;
// `tests/unit/agenda-paridade.test.ts` compara as duas listas.
//
// A constante `DESTINOS_DE_SAIDA` é a ÚNICA fonte da DESCRIÇÃO dos destinos (rótulo, área que paga,
// vínculo): o "Para onde foi" agrega por ela — destino fora dela some do gráfico sem erro
// (`lib/estoque/historico.ts`). A folha de movimentação do Estoque desenha a grade a partir de
// `DESTINOS_DA_FOLHA_DO_ESTOQUE` (os cinco da saída manual), e a Server Action decide a área que paga
// por `areaDoDestino` — a área NUNCA vem do cliente.
//
// Cada destino carrega a área do Financeiro que paga (D-14): o protótipo já usava nome de área em
// três (aula → Espaço, encomenda → Peças, cafeteria → Cafeteria); os dois que iam para "Ateliê
// produtivo" (uso do ateliê, perda ou quebra) vão para Peças — o adendo diz que "Ateliê"
// corresponde a Peças. "Venda na loja" não existe (D-15): venda só nasce no Financeiro.
//
// Fase 5 — Agenda (D-06, migração 0026): o sexto destino, `uso_livre` ("Uso livre do espaço", área
// Espaço), é gravado SÓ pela Agenda, ao encerrar um uso livre, sempre com o vínculo `uso_livre_id`
// (o `check` `movimentacoes_estoque_destino_uso_livre_com_vinculo` recusa sem ele). Por isso a folha
// do Estoque NÃO o oferece — `ehDestinoDaFolha` o recusa no Zod da folha.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";

export type DestinoDeSaida = "aula" | "encomenda" | "cafeteria" | "atelie" | "perda" | "uso_livre";

// O que a folha pede junto do destino (UI-SPEC §"Rótulos e dicas de campo"): a saída "Consumo em
// aula" continua com a turma em texto livre; o uso livre tem vínculo real (`uso_livre_id`), posto
// pela Agenda; encomenda por seletor; "o que aconteceu?" na perda.
export type VinculoDoDestino = "turma" | "encomenda" | "o-que-aconteceu" | "uso-livre" | null;

export type DescricaoDoDestino = {
  valor: DestinoDeSaida;
  rotulo: string;
  area: AreaFinanceira;
  vinculo: VinculoDoDestino;
};

// Os cinco destinos que a folha de movimentação do Estoque oferece, na ordem da grade.
export const DESTINOS_DA_FOLHA_DO_ESTOQUE: readonly DescricaoDoDestino[] = [
  { valor: "aula", rotulo: "Consumo em aula", area: "espaco", vinculo: "turma" },
  { valor: "encomenda", rotulo: "Consumo em encomenda", area: "pecas", vinculo: "encomenda" },
  { valor: "cafeteria", rotulo: "Consumo na cafeteria", area: "cafeteria", vinculo: null },
  { valor: "atelie", rotulo: "Uso do ateliê", area: "pecas", vinculo: null },
  { valor: "perda", rotulo: "Perda ou quebra", area: "pecas", vinculo: "o-que-aconteceu" },
];

// Os seis destinos do enum, na ordem do enum: os cinco da folha + o uso livre da Agenda (D-06).
export const DESTINOS_DE_SAIDA: readonly DescricaoDoDestino[] = [
  ...DESTINOS_DA_FOLHA_DO_ESTOQUE,
  { valor: "uso_livre", rotulo: "Uso livre do espaço", area: "espaco", vinculo: "uso-livre" },
];

const DESTINO_POR_VALOR: ReadonlyMap<DestinoDeSaida, DescricaoDoDestino> = new Map(
  DESTINOS_DE_SAIDA.map((destino) => [destino.valor, destino]),
);

const DESTINOS_DA_FOLHA: ReadonlySet<DestinoDeSaida> = new Set(
  DESTINOS_DA_FOLHA_DO_ESTOQUE.map((destino) => destino.valor),
);

export function ehDestinoDeSaida(valor: unknown): valor is DestinoDeSaida {
  return typeof valor === "string" && DESTINO_POR_VALOR.has(valor as DestinoDeSaida);
}

// Só os cinco da folha do Estoque — `uso_livre` fica de fora (só a Agenda o grava, com vínculo).
export function ehDestinoDaFolha(valor: unknown): valor is DestinoDeSaida {
  return typeof valor === "string" && DESTINOS_DA_FOLHA.has(valor as DestinoDeSaida);
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
