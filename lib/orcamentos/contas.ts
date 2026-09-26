// STUB TEMPORÁRIO para a fase RED do TDD (04.5-06-PLAN.md, Tarefa 1) — será substituído pela
// implementação real no commit GREEN, imediatamente em seguida.
import type { ResultadoDaFicha } from "@/lib/precificacao/ficha";

export type LinhaParaContas = {
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  horasMilesimos: number;
  resultado: ResultadoDaFicha;
};

export type ContasDoOrcamento = {
  pecasCentavos: number;
  projetoCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  custoCentavos: number;
  impostoETaxaPontosBase: number;
  sobraCentavos: number;
  horasMilesimos: number;
  fornadasBiscoitoMilesimos: number;
  fornadasEsmalteMilesimos: number;
  linhasSemCalculo: string[];
};

export function contasDoOrcamento(_linhas: LinhaParaContas[]): ContasDoOrcamento {
  throw new Error("não implementado ainda — fase RED do TDD");
}
