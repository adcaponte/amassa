// Portão estrutural do gap 16 da verificação (04.1-05): decide pela ÁRVORE SINTÁTICA do
// compilador do TypeScript se uma leitura de `encomenda_etapas` termina em
// `.orderBy(asc(encomendaEtapas.ordem))` — nunca por expressão regular sobre o texto cru, que
// erraria dentro de comentário e de cadeia de caracteres. Mesma disciplina de
// `scripts/verificar-acoes.mjs` (repare no quarto argumento `true` de `ts.createSourceFile`,
// que popula `node.parent` — sem ele o passo de subir a cadeia de chamadas não funciona).
//
// Sem `calcularCronograma` percorrer `duracoes` na ordem em que ela chega do Postgres, e sem
// `order by`, o Postgres não promete NENHUMA ordem — semântica padrão de SQL, não caso
// extremo. Este teste fica vermelho se a ordenação sumir de qualquer uma das quatro leituras
// de `encomenda_etapas` do projeto (`lib/encomendas/acoes.ts` × 2,
// `lib/encomendas/consultas.ts` × 2).
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import ts from "typescript";

type PontoDeLeitura = { linha: number; ordenado: boolean };

// Percorre a árvore de `caminho` procurando toda `CallExpression` da forma `algo.from(encomendaEtapas)`
// — cada ocorrência é um "ponto de leitura". Para cada uma, sobe pelos `parent` enquanto o pai
// for `CallExpression` ou `PropertyAccessExpression`, até o topo da cadeia de chamadas
// encadeadas (a consulta inteira), e decide o veredito pelo TEXTO desse nó do topo — nunca
// sobre o arquivo inteiro.
function encontrarPontosDeLeitura(caminho: string): PontoDeLeitura[] {
  const texto = readFileSync(caminho, "utf8");
  const sourceFile = ts.createSourceFile(
    caminho,
    texto,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const pontos: PontoDeLeitura[] = [];

  function visitar(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from" &&
      node.arguments.length > 0 &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === "encomendaEtapas"
    ) {
      let topo: ts.Node = node;
      while (
        topo.parent &&
        (ts.isCallExpression(topo.parent) || ts.isPropertyAccessExpression(topo.parent))
      ) {
        topo = topo.parent;
      }

      const textoDoTopo = topo.getText(sourceFile);
      const ordenado =
        textoDoTopo.includes("orderBy") && textoDoTopo.includes("encomendaEtapas.ordem");
      const linha =
        ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;

      pontos.push({ linha, ordenado });
    }

    ts.forEachChild(node, visitar);
  }

  visitar(sourceFile);
  return pontos;
}

// Afirma que TODOS os pontos de leitura encontrados em `caminho` estão ordenados, com uma
// mensagem de falha que cita arquivo e linha — para quem quebrar a regra daqui a um ano saber
// onde olhar. Também afirma o mínimo de pontos de leitura: um caminhador quebrado que não
// encontra nada passaria em silêncio, o pior defeito possível num portão.
function afirmarTodosOrdenados(caminho: string, minimoDePontos: number) {
  const pontos = encontrarPontosDeLeitura(caminho);

  expect(
    pontos.length,
    `esperava encontrar pelo menos ${minimoDePontos} ponto(s) de leitura de encomendaEtapas em ${caminho}, encontrou ${pontos.length}`,
  ).toBeGreaterThanOrEqual(minimoDePontos);

  for (const ponto of pontos) {
    expect(
      ponto.ordenado,
      `${caminho}:${ponto.linha} — leitura de encomenda_etapas sem .orderBy(asc(encomendaEtapas.ordem))`,
    ).toBe(true);
  }
}

describe("leituras de encomenda_etapas ordenam por ordem", () => {
  it("as leituras de encomenda_etapas de acoes.ts ordenam por ordem", () => {
    afirmarTodosOrdenados("lib/encomendas/acoes.ts", 2);
  });

  it("as leituras de encomenda_etapas de consultas.ts ordenam por ordem", () => {
    afirmarTodosOrdenados("lib/encomendas/consultas.ts", 2);
  });

  it("a fixture sem-ordem.ts é REPROVADA — o portão é visto vermelho", () => {
    const pontos = encontrarPontosDeLeitura("tests/fixtures/leituras/sem-ordem.ts");

    expect(pontos).toHaveLength(1);
    expect(
      pontos[0].ordenado,
      `tests/fixtures/leituras/sem-ordem.ts:${pontos[0].linha} — deveria ser reprovado por não ter .orderBy(asc(encomendaEtapas.ordem))`,
    ).toBe(false);
  });

  it("a fixture com-ordem.ts é aprovada", () => {
    const pontos = encontrarPontosDeLeitura("tests/fixtures/leituras/com-ordem.ts");

    expect(pontos).toHaveLength(1);
    expect(pontos[0].ordenado).toBe(true);
  });
});
