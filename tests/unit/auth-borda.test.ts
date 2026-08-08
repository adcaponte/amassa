import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Prova, por código, a divisão de configuração descrita em `01-ARQUITETURA.md` §4: o que é
// alcançável a partir de `lib/auth/auth.config.ts` (o que o middleware importa, no runtime
// Edge) nunca pode tocar o módulo nativo de hash, o cliente do banco, nem a função de
// checagem de credenciais do provedor. Um build verde não prova isso — só prova que
// funcionou hoje. Este teste fica vermelho no instante em que um import proibido entra,
// não seis semanas depois em produção.

const RAIZ = process.cwd();

function removerComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function lerSemComentarios(caminhoAbsoluto: string): string {
  return removerComentarios(readFileSync(caminhoAbsoluto, "utf-8"));
}

function extrairEspecificadoresDeImport(codigoSemComentarios: string): string[] {
  const especificadores: string[] = [];
  const regexEstatico = /(?:import|export)(?:[^'"();]*?)from\s+["']([^"']+)["']/g;
  const regexDinamico = /import\(\s*["']([^"']+)["']\s*\)/g;

  for (const regex of [regexEstatico, regexDinamico]) {
    let resultado: RegExpExecArray | null;
    while ((resultado = regex.exec(codigoSemComentarios))) {
      especificadores.push(resultado[1]);
    }
  }

  return especificadores;
}

// Só imports relativos (`./`, `../`) e por alias (`@/`) entram no grafo — é o que o próprio
// enunciado da tarefa pede ("imports relativos e por alias"). Pacotes de terceiro (ex.:
// "next-auth") não são percorridos para dentro de `node_modules`.
function resolverEspecificador(especificador: string, arquivoQueImporta: string): string | null {
  if (!especificador.startsWith(".") && !especificador.startsWith("@/")) {
    return null;
  }

  const base = especificador.startsWith("@/")
    ? resolve(RAIZ, especificador.slice(2))
    : resolve(dirname(arquivoQueImporta), especificador);

  const candidatos = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")];

  for (const candidato of candidatos) {
    if (existsSync(candidato) && extname(candidato) !== "") return candidato;
  }

  return null;
}

function coletarGrafoDeModulos(arquivoInicialRelativo: string): Map<string, string> {
  const visitados = new Map<string, string>();
  const pilha = [resolve(RAIZ, arquivoInicialRelativo)];

  while (pilha.length > 0) {
    const atual = pilha.pop()!;
    if (visitados.has(atual)) continue;

    const codigo = lerSemComentarios(atual);
    visitados.set(atual, codigo);

    for (const especificador of extrairEspecificadoresDeImport(codigo)) {
      const resolvido = resolverEspecificador(especificador, atual);
      if (resolvido && !visitados.has(resolvido)) pilha.push(resolvido);
    }
  }

  return visitados;
}

function listarArquivosTs(diretorioRelativo: string): string[] {
  const diretorioAbsoluto = resolve(RAIZ, diretorioRelativo);
  return readdirSync(diretorioAbsoluto, { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile() && /\.tsx?$/.test(entrada.name))
    .map((entrada) => resolve(entrada.parentPath ?? diretorioAbsoluto, entrada.name));
}

describe("divisão de borda: auth.config.ts nunca alcança runtime Node", () => {
  const grafo = coletarGrafoDeModulos("lib/auth/auth.config.ts");

  // Cada verificação usa um regex, não uma substring simples, porque "authorized" (o nome
  // do callback de borda, legítimo aqui) contém "authorize" como substring — testar a
  // palavra crua marcaria o próprio arquivo correto como culpado.
  const verificacoesProibidas: { descricao: string; regex: RegExp }[] = [
    { descricao: "o pacote nativo de hash (argon2)", regex: /argon2/ },
    { descricao: "o cliente do banco (@/db)", regex: /@\/db\b/ },
    { descricao: "o cliente do banco (db/index)", regex: /\bdb\/index\b/ },
    {
      descricao: "a função de checagem de credenciais do provedor (authorize)",
      regex: /authorize(?![a-zA-Z])/,
    },
  ];

  it("alcançou pelo menos um arquivo (o grafo não está vazio por engano)", () => {
    expect(grafo.size).toBeGreaterThan(0);
  });

  for (const { descricao, regex } of verificacoesProibidas) {
    it(`nenhum arquivo alcançável a partir de auth.config.ts referencia ${descricao}`, () => {
      const culpados = [...grafo.entries()]
        .filter(([, codigo]) => regex.test(codigo))
        .map(([arquivo]) => arquivo);

      expect(
        culpados,
        `${culpados.join(", ") || "(nenhum)"} — alcançável a partir de lib/auth/auth.config.ts, ` +
          `mas referencia ${descricao}. Isso quebraria o middleware no runtime Edge ` +
          `(01-ARQUITETURA.md §4).`,
      ).toHaveLength(0);
    });
  }
});

describe("middleware.ts importa a borda, não o runtime", () => {
  const caminhoMiddleware = resolve(RAIZ, "middleware.ts");
  const codigoMiddleware = lerSemComentarios(caminhoMiddleware);
  const especificadores = extrairEspecificadoresDeImport(codigoMiddleware);
  const resolvidos = especificadores
    .map((especificador) => resolverEspecificador(especificador, caminhoMiddleware))
    .filter((caminho): caminho is string => caminho !== null);

  it("importa lib/auth/auth.config.ts", () => {
    expect(resolvidos).toContain(resolve(RAIZ, "lib/auth/auth.config.ts"));
  });

  it("NÃO importa lib/auth/auth.ts", () => {
    expect(
      resolvidos,
      `middleware.ts importa lib/auth/auth.ts diretamente — isso alcança o módulo nativo de ` +
        `hash e o cliente do banco no runtime Edge, quebrando a inicialização (01-ARQUITETURA.md §4).`,
    ).not.toContain(resolve(RAIZ, "lib/auth/auth.ts"));
  });
});

describe("nenhum caminho de código apaga uma linha de usuarios (AUTH-09)", () => {
  const arquivos = [...listarArquivosTs("lib/auth"), ...listarArquivosTs("scripts")];

  const regexDeleteDrizzle = /\.delete\s*\(\s*usuarios\s*\)/;
  const regexDeleteSql = /delete\s+from\s+["'`]?usuarios["'`]?/i;

  it("encontrou arquivos para verificar (a lista não está vazia por engano)", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  for (const arquivo of arquivos) {
    it(`${arquivo.replace(`${RAIZ}\\`, "").replace(`${RAIZ}/`, "")} não emite exclusão sobre usuarios`, () => {
      const codigo = lerSemComentarios(arquivo);

      const temDeleteDrizzle = regexDeleteDrizzle.test(codigo);
      const temDeleteSql = regexDeleteSql.test(codigo);

      expect(
        temDeleteDrizzle,
        `${arquivo} chama .delete(usuarios) — desativar é ativo=false; apagar quebraria o ` +
          `histórico de autoria (AUTH-09).`,
      ).toBe(false);
      expect(
        temDeleteSql,
        `${arquivo} contém um "DELETE FROM usuarios" em SQL cru — desativar é ativo=false; ` +
          `apagar quebraria o histórico de autoria (AUTH-09).`,
      ).toBe(false);
    });
  }
});
