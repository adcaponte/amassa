import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/verificar-acoes.mjs";

type ErroDeProcesso = {
  status: number | null;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
};

function rodarVerificador(caminhos: string[]): { codigo: number; saida: string } {
  try {
    const saida = execFileSync("node", [SCRIPT, ...caminhos], { encoding: "utf8" });
    return { codigo: 0, saida };
  } catch (erro) {
    const erroDeProcesso = erro as ErroDeProcesso;
    return {
      codigo: erroDeProcesso.status ?? 1,
      saida: `${erroDeProcesso.stdout ?? ""}${erroDeProcesso.stderr ?? ""}`,
    };
  }
}

// Prova o portão nos dois sentidos — o mesmo padrão que 01-07 estabeleceu para o pipeline: um
// portão que nunca foi visto vermelho não prova nada.
describe("verificar-acoes", () => {
  it("reprova a fixture violando.ts e a mensagem cita o nome da função", () => {
    const { codigo, saida } = rodarVerificador(["tests/fixtures/acoes/violando.ts"]);

    expect(codigo).not.toBe(0);
    expect(saida).toContain("listarNomesSemAutorizar");
  });

  it("aprova as fixtures conforme.ts e sem-banco.ts", () => {
    const { codigo } = rodarVerificador([
      "tests/fixtures/acoes/conforme.ts",
      "tests/fixtures/acoes/sem-banco.ts",
    ]);

    expect(codigo).toBe(0);
  });

  // Regressão de CR-01: uma ação que alcança o banco só por transitividade (através de um
  // módulo de apoio, sem importar `@/db` diretamente) precisa ser reprovada do mesmo jeito que
  // violando.ts — não basta olhar os imports do próprio arquivo.
  it("reprova a fixture violando-transitivo.ts (alcance ao banco via helper) citando arquivo, linha e função", () => {
    const { codigo, saida } = rodarVerificador(["tests/fixtures/acoes/violando-transitivo.ts"]);

    expect(codigo).not.toBe(0);
    expect(saida).toContain("violando-transitivo.ts:");
    expect(saida).toContain("listarNomesPorHelperSemAutorizar");
  });

  // Regressão da exceção nomeada de CR-01: entrar/sair em lib/auth/acoes.ts alcançam o banco
  // por transitividade (via lib/auth/auth.ts) mas são o próprio ponto de entrada/saída da
  // autenticação, exentos por nome — o portão precisa continuar aprovando o arquivo inteiro.
  it("aprova lib/auth/acoes.ts (entrar/sair exentos por serem entrada/saída da autenticação)", () => {
    const { codigo } = rodarVerificador(["lib/auth/acoes.ts"]);

    expect(codigo).toBe(0);
  });
});
