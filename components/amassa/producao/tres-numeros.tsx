import type { ReactNode } from "react";

import type { NumerosDoTopo } from "@/lib/producao/quadro";
import {
  ARIA_NUMEROS_DO_TOPO,
  FRASE_FILA_DO_FORNO_VAZIA,
  LINHA_ESTIMATIVA_FORNO,
  ROTULO_NUMERO_AGUARDANDO,
  ROTULO_NUMERO_EM_PRODUCAO,
  ROTULO_NUMERO_FORNO,
  SIMBOLO_APROXIMADAMENTE,
  SR_APROXIMADAMENTE,
  SUB_AGUARDANDO_SINAL,
  textoFornadasDeBiscoito,
  textoFornadasDeEsmalte,
  textoPecasSemEstimativa,
  textoSubEmProducao,
} from "@/lib/producao/textos";

// "≈" é desenho; quem usa leitor de tela ouve "aproximadamente" — a estimativa nunca soa como conta
// exata (PRD-13 · precision).
function Aproximadamente() {
  return (
    <>
      <span aria-hidden="true">{SIMBOLO_APROXIMADAMENTE} </span>
      <span className="sr-only">{SR_APROXIMADAMENTE} </span>
    </>
  );
}

// Um quadro: o rótulo em caixa alta, o número em Display e as sub-linhas. Abaixo de 640px é UMA
// LINHA (UI-D10) — rótulo e sub-linhas à esquerda, o número à direita; a partir de 640px, rótulo em
// cima, número, sub-linhas embaixo. A ordem no documento é sempre rótulo → número → sub-linhas (o
// leitor de tela ouve "Esperando o forno, 2, …"); só a grade muda de lugar. Não é clicável.
function Quadro({
  testId,
  rotulo,
  numero,
  children,
}: {
  testId: string;
  rotulo: string;
  numero: number;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="bg-superficie border-borda grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg border p-4 sm:grid-cols-1 sm:items-start"
    >
      <p className="text-apoio text-tinta-media col-start-1 row-start-1 font-semibold tracking-[0.06em] uppercase">
        {rotulo}
      </p>
      <p
        data-testid={`${testId}-valor`}
        className="text-display text-tinta col-start-2 row-span-2 row-start-1 tabular-nums sm:col-start-1 sm:row-span-1 sm:row-start-2"
      >
        {numero}
      </p>
      <div className="text-apoio text-tinta-fraca col-start-1 row-start-2 flex min-w-0 flex-col [overflow-wrap:anywhere] sm:row-start-3">
        {children}
      </div>
    </div>
  );
}

// Os três números do topo da Produção (UI-SPEC §"Três números do topo"; PRD-13). Chegam prontos
// (`numerosDoTopo` sobre as ordens JÁ filtradas) — aqui só se desenha. Nenhuma hora de trabalho
// (PRD-05). Plural de verdade em tudo.
export function TresNumeros({ numeros }: { numeros: NumerosDoTopo }) {
  const { emProducao, esperandoOForno, aguardando } = numeros;
  const { fornadas } = esperandoOForno;
  return (
    <div
      role="group"
      aria-label={ARIA_NUMEROS_DO_TOPO}
      data-testid="producao-numeros"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4"
    >
      <Quadro
        testId="producao-numero-em-producao"
        rotulo={ROTULO_NUMERO_EM_PRODUCAO}
        numero={emProducao.ordens}
      >
        <span className="tabular-nums">
          {textoSubEmProducao(emProducao.ordens, emProducao.pecas)}
        </span>
      </Quadro>
      <Quadro testId="producao-numero-forno" rotulo={ROTULO_NUMERO_FORNO} numero={esperandoOForno.ordens}>
        {esperandoOForno.ordens === 0 ? (
          <span>{FRASE_FILA_DO_FORNO_VAZIA}</span>
        ) : (
          <>
            <span data-testid="producao-numero-forno-fornadas" className="tabular-nums">
              <Aproximadamente />
              {textoFornadasDeBiscoito(fornadas.biscoito)}
              {" · "}
              <Aproximadamente />
              {textoFornadasDeEsmalte(fornadas.esmalte)}
            </span>
            <span>{LINHA_ESTIMATIVA_FORNO}</span>
            {fornadas.pecasSemEstimativa > 0 ? (
              <span data-testid="producao-numero-forno-sem-estimativa" className="tabular-nums">
                {textoPecasSemEstimativa(fornadas.pecasSemEstimativa)}
              </span>
            ) : null}
          </>
        )}
      </Quadro>
      <Quadro
        testId="producao-numero-aguardando"
        rotulo={ROTULO_NUMERO_AGUARDANDO}
        numero={aguardando}
      >
        <span>{SUB_AGUARDANDO_SINAL}</span>
      </Quadro>
    </div>
  );
}
