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
});
