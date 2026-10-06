import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ESTADO_VAZIO, valorarMovimento } from "@/lib/estoque/custo";
import { custoMedioParaExibir } from "@/lib/estoque/saldo";
import { SEM_CUSTO, SEM_CUSTO_CONHECIDO, rotuloDoCustoMedio } from "@/lib/estoque/textos";
import { formatarReais } from "@/lib/financeiro/formato";

// D-04 (06.5): o custo médio zero — doação, sobra, entrada com o custo vazio ou com 0 digitado —
// aparece como "sem custo"; o "—" fica para o custo DESCONHECIDO (material sem nenhuma entrada).
// Nunca "R$ 0,00/kg". O caminho é o mesmo da tela: o estado do livro → `custoMedioParaExibir` →
// `rotuloDoCustoMedio` (que o `textoDoCustoMedio` do cartão, da tabela e da folha do material chama).
function rotuloDoEstado(estado: typeof ESTADO_VAZIO): string {
  return rotuloDoCustoMedio(custoMedioParaExibir(estado), "kg", formatarReais);
}

describe("o custo médio na tela — D-04", () => {
  it("material sem nenhuma entrada → “—”", () => {
    expect(rotuloDoEstado(ESTADO_VAZIO)).toBe(SEM_CUSTO_CONHECIDO);
  });

  it("entrada de 5 kg com 0 (o vazio vira 0 no esquema) → “sem custo”", () => {
    const entrada = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 5000,
      pagoCentavos: 0,
    });
    expect(rotuloDoEstado(entrada.estadoDepois)).toBe(SEM_CUSTO);
  });

  it("a doação saiu toda: o saldo zera e continua “sem custo” (a última entrada foi a R$ 0)", () => {
    const entrada = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 2000,
      pagoCentavos: 0,
    });
    const saida = valorarMovimento(entrada.estadoDepois, { tipo: "saida", milesimos: 2000 });
    expect(saida.estadoDepois.saldoMilesimos).toBe(0);
    expect(rotuloDoEstado(saida.estadoDepois)).toBe(SEM_CUSTO);
  });

  it("uma compra paga depois da doação volta a mostrar o preço", () => {
    const doacao = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 5000,
      pagoCentavos: 0,
    });
    const compra = valorarMovimento(doacao.estadoDepois, {
      tipo: "entrada_com_preco",
      milesimos: 5000,
      pagoCentavos: 4200,
    });
    // 10 kg valendo R$ 42,00 → R$ 4,20/kg.
    expect(rotuloDoEstado(compra.estadoDepois).replace(/ /g, " ")).toBe("R$ 4,20/kg");
  });

  it("lib/estoque/textos.ts continua sem nenhum import", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/estoque/textos.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});
