import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// T-04.6-11/T-04.6-13/D-15: a fronteira que garante que o site público NUNCA alcança sessão ou
// banco, e nunca nasce uma Server Action nele. Fase 04.6, plano 03 — este teste nasce ANTES da
// página existir (é o portão que define a fronteira), e continua valendo por diante: qualquer
// import novo em `app/page.tsx` ou em `components/site/` que alcance o banco reprova aqui, no
// commit, muito antes de um usuário perceber que o site parou de sobreviver ao Postgres cair.

const RAIZ = process.cwd();

// Especificadores de módulo proibidos no grafo de import do site. `@/db` cobre também
// `@/db/schema` (prefixo); os demais são pacotes externos, checados por igualdade ou por
// prefixo de subcaminho (ex.: `next-auth/providers/credentials`).
const ESPECIFICADORES_PROIBIDOS = [
  "@/db",
  "drizzle-orm",
  "pg",
  "next-auth",
  "next/headers",
  "@/lib/auth/",
] as const;

function especificadorEhProibido(especificador: string): string | null {
  for (const proibido of ESPECIFICADORES_PROIBIDOS) {
    if (proibido.endsWith("/")) {
      if (especificador.startsWith(proibido)) return proibido;
      continue;
    }
    if (especificador === proibido || especificador.startsWith(`${proibido}/`)) {
      return proibido;
    }
  }
  return null;
}

// Extrai os especificadores de módulo de todo `import ... from "..."` (com ou sem `type`,
// nomeado, default ou namespace) e todo `export ... from "..."` (reexportação). Não segue
// `import()` dinâmico — nenhum arquivo do site usa isso.
const REGEX_IMPORT = /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\bfrom\s+["']([^"']+)["']/g;

function extrairEspecificadores(conteudo: string): string[] {
  const encontrados: string[] = [];
  let m: RegExpExecArray | null;
  REGEX_IMPORT.lastIndex = 0;
  while ((m = REGEX_IMPORT.exec(conteudo))) {
    encontrados.push(m[1]);
  }
  return encontrados;
}

// Resolve um especificador de import para um caminho absoluto de arquivo dentro do repositório,
// ou `null` se for um pacote externo (node_modules) — nunca seguido, por decisão do plano (o
// mesmo princípio de scripts/verificar-acoes.mjs).
function resolverCaminhoDoRepositorio(especificador: string, diretorioDoArquivo: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) {
    base = join(RAIZ, especificador.slice(2));
  } else if (especificador.startsWith("./") || especificador.startsWith("../")) {
    base = resolve(diretorioDoArquivo, especificador);
  } else {
    return null; // pacote externo — não é caminho do repositório.
  }

  const candidatos = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];

  for (const candidato of candidatos) {
    try {
      if (statSync(candidato).isFile()) return candidato;
    } catch {
      // Não existe com essa extensão — tenta o próximo candidato.
    }
  }
  return null;
}

type Violacao = {
  especificador: string;
  proibidoPor: string;
  cadeia: string[];
};

// Percorre o grafo de imports a partir de `arquivoEntrada`, só caminhos do próprio repositório
// (`@/` resolvido para a raiz), e devolve toda violação encontrada com a CADEIA INTEIRA de
// arquivos que levou até ela — não só o arquivo final. Protegido contra ciclo por `visitados`.
function percorrerGrafoDeImports(arquivoEntrada: string): Violacao[] {
  const violacoes: Violacao[] = [];
  const visitados = new Set<string>();

  function visitar(caminhoAbsoluto: string, cadeia: string[]) {
    if (visitados.has(caminhoAbsoluto)) return;
    visitados.add(caminhoAbsoluto);

    let conteudo: string;
    try {
      conteudo = readFileSync(caminhoAbsoluto, "utf-8");
    } catch {
      return;
    }

    const proximaCadeia = [...cadeia, caminhoRelativo(caminhoAbsoluto)];
    const diretorio = dirname(caminhoAbsoluto);

    for (const especificador of extrairEspecificadores(conteudo)) {
      const proibidoPor = especificadorEhProibido(especificador);
      if (proibidoPor) {
        violacoes.push({
          especificador,
          proibidoPor,
          cadeia: [...proximaCadeia, especificador],
        });
        continue; // não segue para dentro do pacote proibido — já é a violação.
      }

      const caminhoResolvido = resolverCaminhoDoRepositorio(especificador, diretorio);
      if (caminhoResolvido) {
        visitar(caminhoResolvido, proximaCadeia);
      }
      // Pacote externo não proibido (react, next/image, next/font/google...): não seguido —
      // seguir para dentro de node_modules seria lento e não é o que este teste mede.
    }
  }

  visitar(resolve(RAIZ, arquivoEntrada), []);
  return violacoes;
}

function caminhoRelativo(caminhoAbsoluto: string): string {
  return caminhoAbsoluto.slice(RAIZ.length + 1).split("\\").join("/");
}

function mensagemDaViolacao(v: Violacao): string {
  return `importação proibida "${v.especificador}" (via ${v.proibidoPor}) alcançada pela cadeia: ${v.cadeia.join(" -> ")}`;
}

// --- Varredura de diretório, para os arquivos-alvo que o percorredor de imports não cobre
// sozinho: `components/site/` inteiro, mesmo o que `app/page.tsx` não importa (ainda). ---

const IGNORAR = new Set(["node_modules", ".next", ".git"]);

function listarArquivosTs(diretorio: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(diretorio);
  } catch {
    return [];
  }
  const resultado: string[] = [];
  for (const entrada of entradas) {
    if (IGNORAR.has(entrada)) continue;
    const caminhoAbsoluto = join(diretorio, entrada);
    const info = statSync(caminhoAbsoluto);
    if (info.isDirectory()) {
      resultado.push(...listarArquivosTs(caminhoAbsoluto));
      continue;
    }
    if (entrada.endsWith(".ts") || entrada.endsWith(".tsx")) {
      resultado.push(caminhoAbsoluto);
    }
  }
  return resultado;
}

describe("isolamento do site público (D-03, D-15, T-04.6-11, T-04.6-13)", () => {
  it("o grafo de import de app/page.tsx nunca alcança banco, sessão ou autenticação", () => {
    const violacoes = percorrerGrafoDeImports("app/page.tsx");
    expect(violacoes, violacoes.map(mensagemDaViolacao).join("\n")).toEqual([]);
  });

  it("falha simulada: o percorredor nomeia a CADEIA INTEIRA, não só o arquivo final", () => {
    const violacoes = percorrerGrafoDeImports("tests/fixtures/site-isolamento/entrada-proibida.ts");
    expect(violacoes.length).toBeGreaterThan(0);
    const mensagem = mensagemDaViolacao(violacoes[0]);
    expect(mensagem).toContain("tests/fixtures/site-isolamento/entrada-proibida.ts");
    expect(mensagem).toContain("tests/fixtures/site-isolamento/meio-proibido.ts");
    expect(mensagem).toContain("@/db");
    // A cadeia é ORDENADA: entrada, depois o salto intermediário, depois o especificador —
    // não só "contém as três", mas nesta ordem.
    const indiceEntrada = mensagem.indexOf("entrada-proibida.ts");
    const indiceMeio = mensagem.indexOf("meio-proibido.ts");
    const indiceDb = mensagem.indexOf("@/db");
    expect(indiceEntrada).toBeLessThan(indiceMeio);
    expect(indiceMeio).toBeLessThan(indiceDb);
  });

  it("app/page.tsx não contém a diretiva de Server Action", () => {
    const conteudo = readFileSync(join(RAIZ, "app/page.tsx"), "utf-8");
    expect(conteudo).not.toMatch(/["']use server["']/);
  });

  it("nenhum arquivo de components/site/ contém a diretiva de Server Action", () => {
    const arquivos = listarArquivosTs(join(RAIZ, "components/site"));
    expect(arquivos.length).toBeGreaterThan(0);
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf-8");
      expect(conteudo, `${caminhoRelativo(arquivo)} não deveria ter "use server"`).not.toMatch(
        /["']use server["']/,
      );
    }
  });

  it("nenhum arquivo do site usa dangerouslySetInnerHTML", () => {
    const arquivos = [join(RAIZ, "app/page.tsx"), ...listarArquivosTs(join(RAIZ, "components/site"))];
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf-8");
      expect(
        conteudo,
        `${caminhoRelativo(arquivo)} não deveria usar dangerouslySetInnerHTML`,
      ).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("nenhum arquivo do site contém a string /gestao", () => {
    const arquivos = [join(RAIZ, "app/page.tsx"), ...listarArquivosTs(join(RAIZ, "components/site"))];
    for (const arquivo of arquivos) {
      const linhasSemComentario = readFileSync(arquivo, "utf-8")
        .split("\n")
        .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
        .join("\n");
      expect(
        linhasSemComentario,
        `${caminhoRelativo(arquivo)} não deveria mencionar /gestao`,
      ).not.toContain("/gestao");
    }
  });
});
