import { formatarReais, nomeDoMes } from "@/lib/abertura/formato";
import type { MesDoFluxo } from "@/lib/abertura/parcelas";
import { FRASE_VAZIO_CORPO_MESES, FRASE_VAZIO_TITULO_MESES } from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export type ListaMesesProps = {
  meses: MesDoFluxo[];
};

// Server Component. A terceira aba do módulo (D-16/ABE-13): um cartão por mês, na ordem
// cronológica que `fluxoMensal` já devolve — nenhuma regra de negócio nasce aqui, o componente só
// formata o que `lib/abertura/parcelas.ts` já entregou pronto (total, composição, pico e
// percentual).
export function ListaMeses({ meses }: ListaMesesProps) {
  if (meses.length === 0) {
    return <EstadoVazio titulo={FRASE_VAZIO_TITULO_MESES} corpo={FRASE_VAZIO_CORPO_MESES} />;
  }

  const totalGeral = meses.reduce((total, mes) => total + mes.totalEmCentavos, 0);

  return (
    <div className="flex flex-col gap-2 px-6 py-6 md:px-8" data-testid="abertura-lista-meses">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-micro font-semibold tracking-wide text-muted-foreground uppercase">
          Quanto sai por mês
        </h2>
        <span className="text-apoio text-muted-foreground tabular-nums">
          {meses.length} {meses.length === 1 ? "mês" : "meses"} · {formatarReais(totalGeral)}
        </span>
      </div>

      {meses.map((mes) => (
        <CartaoDoMes key={mes.chave} mes={mes} />
      ))}
    </div>
  );
}

function CartaoDoMes({ mes }: { mes: MesDoFluxo }) {
  return (
    <div
      className={cn(
        "border-border bg-card rounded-md border p-3 shadow-sm",
        mes.ehPassado && "opacity-60",
      )}
      data-testid="abertura-mes"
      data-mes={mes.chave}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-corpo font-semibold capitalize">
          {nomeDoMes(mes.chave)}
          {mes.ehMesAtual && " · este mês"}
        </span>
        <span className="text-titulo font-bold tabular-nums">
          {formatarReais(mes.totalEmCentavos)}
        </span>
      </div>

      {/* A barra compara os meses ENTRE SI (largura proporcional ao pico) — `role="img"` e
          `aria-label` com a proporção em texto, para quem usa leitor de tela não receber
          silêncio no lugar do número (UI-SPEC §Acessibilidade). */}
      <div
        className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={`${mes.percentualDoPico}% do mês mais pesado`}
        data-testid="abertura-mes-barra"
      >
        <div
          className={cn(
            "bg-acento h-full rounded-full",
            mes.ehPico ? "opacity-100" : "opacity-45",
          )}
          style={{ width: `${mes.percentualDoPico}%` }}
        />
      </div>

      {/* A ESCALA NOMEADA em texto (D-16): não é redundante com a barra — é o que a transforma
          de enfeite em informação, acrescentado ao protótipo depois de o dono perguntar o que
          ela media. */}
      <div
        className={cn(
          "text-micro mt-1 tabular-nums",
          mes.ehPico ? "text-acento font-semibold" : "text-muted-foreground",
        )}
        data-testid="abertura-mes-escala"
      >
        {mes.ehPico ? "mês mais pesado" : `${mes.percentualDoPico}% do mês mais pesado`}
      </div>

      <div className="border-border mt-2 flex flex-col gap-1 border-t pt-2">
        {mes.composicao.map((linha, indice) => (
          <div
            key={indice}
            className="text-apoio flex items-center justify-between gap-3 tabular-nums"
            data-testid="abertura-mes-composicao"
          >
            {/* O rótulo TRUNCA com reticências, nunca empurra a largura — a visão "Por mês" é a
                tela de maior risco de rolagem horizontal no celular (UI-SPEC §Comportamento
                responsivo). O nome completo fica em `title`. */}
            <span className="min-w-0 truncate text-muted-foreground" title={linha.rotulo}>
              {linha.rotulo}
            </span>
            <span className="flex-none text-muted-foreground">
              {formatarReais(linha.valorEmCentavos)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
