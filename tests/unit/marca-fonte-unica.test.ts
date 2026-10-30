import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Quick 261030-n01 (30/10/2026): a marca mora em `conteudo/marca.ts` e só lá. Esta guarda lê do
// disco todo arquivo de texto das pastas de código e prova três coisas:
//   (a) o nome e o domínio antigos não sobraram em nenhum deles — `\s*` cobre o nome com espaço,
//       o domínio e o usuário do Instagram, que são a mesma palavra colada;
//   (b) o nome curto (em maiúsculas, como a marca se escreve) e o usuário do Instagram só existem
//       em `conteudo/marca.ts` — quem precisa do nome lê `MARCA`, nunca o escreve à mão;
//   (c) `conteudo/marca.ts` é dado puro: nenhum import, nenhum `let`/`var`.
//
// "amassa" sozinho NÃO entra em (a): é o codinome técnico do sistema (pastas, banco, contêineres,
// imagens, o app de backup), que fica (briefing da troca de nome §1).

const RAIZ = process.cwd();
const PASTAS = ["app", "components", "lib", "conteudo", "scripts"];
const EXTENSOES = [".ts", ".tsx", ".mjs", ".js", ".css", ".md"];
const IGNORADAS = new Set(["node_modules", ".next", ".git"]);
const ARQUIVO_DA_MARCA = "conteudo/marca.ts";

const NOME_ANTIGO = /amassa\s*cerrado/i;
const NOME_NOVO = /AMULETO/;
const INSTAGRAM_NOVO = /amuletoartecafe/i;

function listarArquivos(pasta: string): string[] {
  const encontrados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    if (IGNORADAS.has(nome)) continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarArquivos(caminho));
    } else if (EXTENSOES.some((extensao) => nome.endsWith(extensao))) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

const ARQUIVOS = PASTAS.flatMap((pasta) => listarArquivos(join(RAIZ, pasta))).map((caminho) => ({
  caminho: relative(RAIZ, caminho).split("\\").join("/"),
  linhas: readFileSync(caminho, "utf-8").split(/\r?\n/),
}));

function ocorrencias(regex: RegExp, filtro: (caminho: string) => boolean): string[] {
  const achadas: string[] = [];
  for (const { caminho, linhas } of ARQUIVOS) {
    if (!filtro(caminho)) continue;
    linhas.forEach((linha, indice) => {
      if (regex.test(linha)) achadas.push(`${caminho}:${indice + 1}: ${linha.trim()}`);
    });
  }
  return achadas;
}

describe("a marca tem uma fonte só (conteudo/marca.ts)", () => {
  it("a varredura achou os arquivos das pastas de código", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(50);
    expect(ARQUIVOS.some(({ caminho }) => caminho === ARQUIVO_DA_MARCA)).toBe(true);
  });

  it("(a) nenhum arquivo de app/, components/, lib/, conteudo/ e scripts/ tem o nome ou o domínio antigos", () => {
    const achadas = ocorrencias(NOME_ANTIGO, () => true);
    expect(achadas, `nome antigo ainda escrito em:\n${achadas.join("\n")}`).toEqual([]);
  });

  it("(b) o nome novo e o usuário do Instagram só estão escritos em conteudo/marca.ts", () => {
    const foraDaMarca = (caminho: string) => caminho !== ARQUIVO_DA_MARCA;
    const achadas = [
      ...ocorrencias(NOME_NOVO, foraDaMarca),
      ...ocorrencias(INSTAGRAM_NOVO, foraDaMarca),
    ];
    expect(achadas, `marca escrita à mão fora de ${ARQUIVO_DA_MARCA}:\n${achadas.join("\n")}`).toEqual([]);
  });

  it("(c) conteudo/marca.ts não importa nada e não declara let/var", () => {
    const conteudo = readFileSync(join(RAIZ, ARQUIVO_DA_MARCA), "utf-8");
    expect(conteudo.match(/^import /m)).toBeNull();
    expect(conteudo.match(/^\s*(let|var) /m)).toBeNull();
  });
});
