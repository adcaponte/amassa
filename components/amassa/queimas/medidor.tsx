import type { MedidaDoForno } from "@/lib/queimas/contador";
import { ROTULO_MEDIDOR_ATENCAO, ROTULO_MEDIDOR_LIMITE } from "@/lib/queimas/textos";

// Primitivo visual novo, sem análogo no repositório (04-PATTERNS.md "No Analog Found") — o
// medidor com entalhes de `amassa-plataforma/04-DESIGN-SYSTEM.md` §8, "não simplifique para uma
// barra lisa". Server Component puro de apresentação: recebe só o que `medirForno`
// (`lib/queimas/contador.ts`) já decidiu — nenhuma regra de negócio mora aqui, e nenhum import
// de `@/db` ou `@/lib/queimas/acoes` (T-04-08: um cliente adulterado não recalcula nível, só
// desenha o número que o servidor mandou).
export type MedidorProps = Pick<MedidaDoForno, "contador" | "limite" | "atencao" | "nivel">;

// Cor do preenchimento pelos três tokens de nível — NUNCA `--color-acento` (o terracota é
// reservado para o botão "Queimar", um por tela, `04-UI-SPEC.md` §Color).
function corDoPreenchimento(nivel: MedidorProps["nivel"]): string {
  switch (nivel) {
    case "ok":
      return "var(--color-forno-ok)";
    case "atencao":
      return "var(--color-forno-atencao)";
    case "critico":
      return "var(--color-forno-critico)";
    default: {
      const _exaustivo: never = nivel;
      throw new Error(`corDoPreenchimento: nível de forno não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

export function Medidor({ contador, limite, atencao, nivel }: MedidorProps) {
  // Acima do limite (ex.: 103 de 100), o preenchimento trava em 100% — nunca estoura o
  // contêiner do cartão (edge probe FOR-05).
  const preenchimentoPercentual = Math.min(contador / limite, 1) * 100;
  // A marca do limiar cai na FRAÇÃO `atencao / limite`, nunca num valor fixo — o mesmo ponto
  // onde `medirForno` muda de "ok" para "atenção".
  const fracaoDoLimiar = atencao / limite;

  // Um entalhe a cada 10 queimas, de 0 até `limite`: `Math.floor(limite / 10) + 1` posições —
  // 11 para limite 100 (contando as duas extremidades), 2 para limite 10.
  const quantidadeDeEntalhes = Math.floor(limite / 10) + 1;
  const entalhes = Array.from({ length: quantidadeDeEntalhes }, (_, indice) => indice * 10);

  return (
    <div className="flex flex-col gap-1" data-testid="medidor">
      <div className="flex justify-end">
        <span className="text-mono text-tinta tabular-nums" data-testid="medidor-contador">
          {contador} / {limite}
        </span>
      </div>

      {/* Trilho: role="progressbar" carrega o estado para leitor de tela — os rótulos visuais
          abaixo são reforço, não a única fonte da informação. */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-valuenow={contador}
        aria-label={`Contador do forno: ${contador} de ${limite}`}
        data-testid="medidor-trilho"
        className="bg-superficie-2 border-borda relative h-3 w-full overflow-hidden rounded-full border"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width]"
          style={{ width: `${preenchimentoPercentual}%`, backgroundColor: corDoPreenchimento(nivel) }}
        />

        {/* Entalhes e marca do limiar são decorativos — o valor de verdade já está nos atributos
            `aria-value*` acima, então os dois levam `aria-hidden`. */}
        {entalhes.map((valor) => (
          <div
            key={valor}
            aria-hidden="true"
            data-testid="medidor-entalhe"
            className="bg-borda-forte absolute inset-y-0 w-px"
            style={{ left: `${(valor / limite) * 100}%` }}
          />
        ))}

        <div
          aria-hidden="true"
          data-testid="medidor-marca-limiar"
          className="bg-tinta absolute inset-y-0 w-0.5"
          style={{ left: `${fracaoDoLimiar * 100}%` }}
        />
      </div>

      {/* Rótulos: "0" à esquerda, "atenção N" na mesma fração da marca do limiar, "limite N" à
          direita — literal de `04-DESIGN-SYSTEM.md` §8, nunca omitido. */}
      <div className="text-micro text-tinta-fraca relative mt-1 h-4 tracking-wide">
        <span className="absolute left-0" data-testid="medidor-rotulo-zero">
          0
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${fracaoDoLimiar * 100}%` }}
          data-testid="medidor-rotulo-atencao"
        >
          {ROTULO_MEDIDOR_ATENCAO} {atencao}
        </span>
        <span className="absolute right-0" data-testid="medidor-rotulo-limite">
          {ROTULO_MEDIDOR_LIMITE} {limite}
        </span>
      </div>
    </div>
  );
}
