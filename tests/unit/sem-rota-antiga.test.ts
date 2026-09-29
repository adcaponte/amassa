import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { REDIRECIONAMENTOS_ANTIGOS } from "../../lib/rotas/redirecionamentos-antigos";

// CR-01 da revisão da Fase 04.6: a plataforma mudou da raiz para `/gestao`, e 65 pontos de
// navegação (`router.push`, `window.location.assign`, `history.pushState`, `href`) continuaram
// escrevendo o endereço ANTIGO à mão. Tudo funcionava só por causa dos redirecionamentos 307
// temporários — que o próprio código manda remover em 2027-03-28. Removidos, cada um desses
// pontos cairia no 404 do site público (pagar uma parcela, salvar uma peça…).
//
// Este teste torna a regressão impossível: nenhum literal de texto em `app/`, `components/` ou
// `lib/` pode COMEÇAR por um caminho antigo. A lista de caminhos antigos vem da constante
// `REDIRECIONAMENTOS_ANTIGOS` — nunca escrita à mão aqui, senão ela envelhece calada no dia em
// que um redirecionamento novo entrar na lista.
//
// A análise é pela árvore sintática do TypeScript, não por expressão regular sobre linhas: só
// literais de texto (`"..."`, `'...'`, `` `...` `` e a cabeça de um template `` `/x/${y}` ``)
// contam. Comentários não são literais, então não disparam; âncoras do site (`#encomendas`) não
// começam por `/`, então também não.

const RAIZ = process.cwd();
const PASTAS = ["app", "components", "lib"] as const;

// O único arquivo que legitimamente escreve os caminhos antigos: a própria lista de
// redirecionamentos.
const ARQUIVOS_EXCLUIDOS = new Set([
  join("lib", "rotas", "redirecionamentos-antigos.ts"),
]);

// De cada `source` (que pode ter segmento dinâmico, ex. `/encomendas/:id`), o prefixo estático —
// `/encomendas/:id` vira `/encomendas`, que já cobre `/encomendas/123` pela regra de fronteira.
const PREFIXOS_ANTIGOS: readonly string[] = [
  ...new Set(
    REDIRECIONAMENTOS_ANTIGOS.map(({ source }) => {
      const segmentos = source.split("/");
      const indiceDinamico = segmentos.findIndex((segmento) => segmento.startsWith(":"));
      const estaticos =
        indiceDinamico === -1 ? segmentos : segmentos.slice(0, indiceDinamico);
      return estaticos.join("/");
    }),
  ),
];

// Verdadeiro quando o texto COMEÇA por um caminho antigo e o caminho termina ali mesmo: fim do
// texto, `/`, `?` ou `#`. `"/financeiroX"` não casa; `"/financeiro?aba=caixa"` casa.
// `fimAberto` vale para a cabeça de um template — o que vem depois dela é uma substituição
// (`` `/financeiro${consulta}` ``), então o fim da cabeça também é fronteira.
function prefixoAntigoDe(texto: string): string | null {
  for (const prefixo of PREFIXOS_ANTIGOS) {
    if (!texto.startsWith(prefixo)) continue;
    const proximo = texto.charAt(prefixo.length);
    if (proximo === "" || proximo === "/" || proximo === "?" || proximo === "#")
      return prefixo;
  }
  return null;
}

function listarArquivos(pasta: string): string[] {
  const encontrados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarArquivos(caminho));
    } else if (/\.tsx?$/.test(nome) && !nome.endsWith(".d.ts")) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

// O nome da porta única de montagem de URL da plataforma (`lib/rotas/gestao.ts`). Um literal
// que é ARGUMENTO dela está certo por construção: `rotaDeGestao("/estoque")` vira
// `/gestao/estoque`.
const PORTA_DA_GESTAO = "rotaDeGestao";

// Sobe da folha até achar a chamada `rotaDeGestao(...)` que recebe o literal como argumento —
// atravessando só o que monta um texto a partir de pedaços (ternário, parênteses, `+`, template,
// `as`). Qualquer outro nó no caminho (outra chamada, um objeto, uma função) interrompe: o
// literal aí não vai direto para a porta, e continua sendo acusado.
function estaDentroDaPortaDaGestao(no: ts.Node): boolean {
  let atual: ts.Node = no;
  while (atual.parent) {
    const pai: ts.Node = atual.parent;
    if (ts.isCallExpression(pai)) {
      return (
        ts.isIdentifier(pai.expression) &&
        pai.expression.text === PORTA_DA_GESTAO &&
        pai.arguments.some((argumento) => argumento === atual)
      );
    }
    const atravessavel =
      ts.isConditionalExpression(pai) ||
      ts.isParenthesizedExpression(pai) ||
      (ts.isBinaryExpression(pai) &&
        pai.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
      ts.isTemplateExpression(pai) ||
      ts.isTemplateSpan(pai) ||
      ts.isAsExpression(pai);
    if (!atravessavel) return false;
    atual = pai;
  }
  return false;
}

type Ocorrencia = { arquivo: string; linha: number; texto: string };

function ocorrenciasNoTexto(arquivo: string, conteudo: string): Ocorrencia[] {
  const fonte = ts.createSourceFile(
    arquivo,
    conteudo,
    ts.ScriptTarget.Latest,
    true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const achados: Ocorrencia[] = [];
  const registrar = (no: ts.Node, texto: string) => {
    if (prefixoAntigoDe(texto) === null) return;
    if (estaDentroDaPortaDaGestao(no)) return;
    const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
    achados.push({ arquivo, linha: line + 1, texto });
  };

  const visitar = (no: ts.Node): void => {
    // Especificadores de import/export não são endereços — nunca começam por `/` de rota, mas
    // pular deixa a intenção explícita.
    if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) return;
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      registrar(no, no.text);
    } else if (ts.isTemplateExpression(no)) {
      registrar(no, no.head.text);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

function ocorrenciasEm(caminhoAbsoluto: string): Ocorrencia[] {
  const arquivo = relative(RAIZ, caminhoAbsoluto).split(sep).join("/");
  return ocorrenciasNoTexto(arquivo, readFileSync(caminhoAbsoluto, "utf8"));
}

describe("nenhuma navegação da plataforma aponta para o endereço antigo da raiz (CR-01)", () => {
  it("a lista de prefixos antigos vem da constante e não está vazia", () => {
    expect(PREFIXOS_ANTIGOS.length).toBeGreaterThan(0);
    for (const prefixo of PREFIXOS_ANTIGOS) {
      expect(prefixo.startsWith("/")).toBe(true);
      expect(prefixo.includes(":")).toBe(false);
    }
  });

  it("a regra de fronteira distingue caminho antigo de texto parecido", () => {
    const umPrefixo = PREFIXOS_ANTIGOS[0];
    expect(prefixoAntigoDe(umPrefixo)).toBe(umPrefixo);
    expect(prefixoAntigoDe(`${umPrefixo}/123`)).toBe(umPrefixo);
    expect(prefixoAntigoDe(`${umPrefixo}?aba=x`)).toBe(umPrefixo);
    expect(prefixoAntigoDe(`${umPrefixo}x`)).toBeNull();
    expect(prefixoAntigoDe(`/gestao${umPrefixo}`)).toBeNull();
    expect(prefixoAntigoDe(`#${umPrefixo.slice(1)}`)).toBeNull();
  });

  it("acusa literal cru, e só ele — comentário, âncora e argumento de rotaDeGestao passam", () => {
    const antigo = PREFIXOS_ANTIGOS[0];
    const codigo = [
      `// comentário citando ${antigo} não é literal`,
      `router.push("${antigo}");`,
      "window.location.assign(`" + antigo + "/${id}`);",
      `const ancora = "#${antigo.slice(1)}";`,
      `const certo = rotaDeGestao("${antigo}");`,
      "const certoTernario = rotaDeGestao(condicao ? `" +
        antigo +
        '/${id}` : "' +
        antigo +
        '");',
      `const errado = rotaDeGestao(outra("${antigo}"));`,
      `const jaPrefixado = "/gestao${antigo}";`,
    ].join("\n");
    const linhas = ocorrenciasNoTexto("exemplo.tsx", codigo).map(({ linha }) => linha);
    expect(linhas).toEqual([2, 3, 7]);
  });

  it("zero literais começando por um caminho antigo em app/, components/ e lib/", () => {
    const ocorrencias = PASTAS.flatMap((pasta) => listarArquivos(join(RAIZ, pasta)))
      .filter((caminho) => !ARQUIVOS_EXCLUIDOS.has(relative(RAIZ, caminho)))
      .flatMap(ocorrenciasEm);

    const relatorio = ocorrencias.map(
      ({ arquivo, linha, texto }) => `${arquivo}:${linha}  ${texto}`,
    );
    expect(
      relatorio,
      "use rotaDeGestao(...) ou um montador de URL (hrefDoCaixa, hrefDaAbaPecas…)",
    ).toEqual([]);
  });
});
