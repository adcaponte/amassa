import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// O rastreio do `output: "standalone"` não leva o pacote `strtok3` para a imagem de produção, e as
// funções de arquivo/stream do `file-type` o carregam em tempo de execução: na imagem, qualquer uma
// delas cai em "Cannot find package 'strtok3'" — e o e2e local, com o `node_modules` inteiro, não vê.
// Foi o que derrubou todo envio de anexo de fornecedor no run 37127538506 (03/10/2026). Só a versão
// de buffer (`fileTypeFromBuffer`) é permitida no código que roda no servidor.
const PROIBIDAS = /fileTypeFrom(File|Stream|Tokenizer|Blob)\b/;

function arquivosDeCodigo(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe("file-type na imagem de produção", () => {
  it("nenhum código de app/ ou lib/ chama a versão de arquivo, stream ou tokenizer do file-type", () => {
    const culpados = ["app", "lib"]
      .flatMap((pasta) => arquivosDeCodigo(pasta))
      .filter((arquivo) => {
        const linhas = readFileSync(arquivo, "utf8").split("\n");
        return linhas.some((linha) => !linha.trimStart().startsWith("//") && PROIBIDAS.test(linha));
      });
    expect(culpados).toEqual([]);
  });
});
