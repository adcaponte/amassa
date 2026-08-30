import type { ItemDaAbertura } from "@/lib/abertura/consultas";
import { formatarDiaEMes, formatarReais } from "@/lib/abertura/formato";
import { calcularParcelas, proximaParcela } from "@/lib/abertura/parcelas";
import {
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ORDEM_DAS_CATEGORIAS,
  ROTULO_A_PRAZO,
  ROTULO_A_VISTA,
  ROTULO_CATEGORIA,
  ROTULO_NOVO_ITEM,
} from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export type ListaItensProps = {
  itens: ItemDaAbertura[];
  hoje: string;
  // Contagem de tarefas ABERTAS por item (D-13, `contarTarefasAbertasPorItem` em
  // `lib/abertura/prazos.ts`), calculada UMA VEZ na página a partir das tarefas já carregadas —
  // nunca uma segunda consulta por item aqui. Chave ausente = nenhuma tarefa aberta, nunca 0.
  contagemDeTarefasAbertas: Map<string, number>;
};

// Server Component. Percorre `ORDEM_DAS_CATEGORIAS` (D-08) e desenha um grupo por categoria QUE
// TENHA item — categoria vazia não desenha cabeçalho nenhum. Nenhuma regra de negócio nasce
// aqui: `calcularParcelas`/`proximaParcela` (`lib/abertura/parcelas.ts`) já chegam prontos por
// item, este componente só formata e desenha.
export function ListaItens({ itens, hoje, contagemDeTarefasAbertas }: ListaItensProps) {
  if (itens.length === 0) {
    return (
      <EstadoVazio
        titulo={FRASE_VAZIO_TITULO}
        corpo={FRASE_VAZIO_CORPO}
        rotuloBotao={ROTULO_NOVO_ITEM}
        hrefBotao="/abertura?item=novo"
      />
    );
  }

  const categoriasComItem = ORDEM_DAS_CATEGORIAS.filter((categoria) =>
    itens.some((item) => item.categoria === categoria),
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8" data-testid="abertura-lista-itens">
      {categoriasComItem.map((categoria) => {
        const linhas = itens.filter((item) => item.categoria === categoria);
        const soma = linhas.reduce((total, item) => total + item.valorEmCentavos, 0);

        return (
          <div key={categoria} data-testid="abertura-grupo-categoria">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-micro font-semibold tracking-wide text-muted-foreground uppercase">
                {ROTULO_CATEGORIA[categoria]}
              </h2>
              <span
                className="text-apoio flex items-center gap-1 text-muted-foreground tabular-nums"
                data-testid="abertura-total-grupo"
              >
                {linhas.length} {linhas.length === 1 ? "item" : "itens"} · {formatarReais(soma)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {linhas.map((item) => (
                <LinhaDeItem
                  key={item.id}
                  item={item}
                  hoje={hoje}
                  tarefasAbertas={contagemDeTarefasAbertas.get(item.id) ?? 0}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinhaDeItem({
  item,
  hoje,
  tarefasAbertas,
}: {
  item: ItemDaAbertura;
  hoje: string;
  // 0 = nenhuma tarefa aberta (chave ausente do mapa) — nunca desenha etiqueta "0 tarefas
  // abertas", só a ausência dela.
  tarefasAbertas: number;
}) {
  const parcelas = calcularParcelas(item);
  const { tipo, parcela } = proximaParcela(parcelas, hoje);
  const aPrazo = item.formaPagamento === "prazo";

  return (
    <div
      className="border-border bg-card flex items-start gap-3 rounded-md border p-3 shadow-sm"
      data-testid="abertura-linha-item"
    >
      <div className="min-w-0 flex-1">
        <div className="text-corpo font-medium break-words">{item.nome}</div>
        <div className="text-apoio mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-micro rounded-full px-2 py-0.5 font-semibold whitespace-nowrap",
              aPrazo ? "bg-acento-fundo text-acento" : "bg-sucesso-fundo text-sucesso",
            )}
          >
            {aPrazo ? ROTULO_A_PRAZO : ROTULO_A_VISTA}
          </span>

          {/* Etiqueta "chega DD/MM" só quando há data de entrega prevista (D-04/ABE-03) — a
              distinção entre "não chegou" (entrega vencida) e "chega em" fica para o plano 03,
              quando `resolvido` e o alerta de atraso entram em jogo. */}
          {item.entregaPrevistaEm && (
            <span className="text-micro bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
              chega {formatarDiaEMes(item.entregaPrevistaEm)}
            </span>
          )}

          {/* A leitura que D-13 chama de mais importante: sem ela, um item marcado como
              comprado parece encerrado enquanto a instalação ainda não aconteceu. `tarefasAbertas
              === 0` não desenha nada — nunca "0 tarefas abertas". */}
          {tarefasAbertas > 0 && (
            <span
              className="text-micro bg-atencao-fundo text-atencao rounded-full px-2 py-0.5 font-semibold whitespace-nowrap"
              data-testid="abertura-tarefas-abertas"
            >
              {tarefasAbertas} {tarefasAbertas === 1 ? "tarefa aberta" : "tarefas abertas"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-0.5 text-right">
        <span
          className="text-corpo font-bold tabular-nums whitespace-nowrap"
          data-testid="abertura-valor-item"
        >
          {formatarReais(item.valorEmCentavos)}
        </span>
        {aPrazo ? (
          <>
            <span
              className="text-apoio text-muted-foreground tabular-nums whitespace-nowrap"
              data-testid="abertura-parcela"
            >
              {item.parcelas}× {formatarReais(parcela.valorEmCentavos)}
            </span>
            <span className="text-apoio text-muted-foreground tabular-nums whitespace-nowrap">
              {tipo === "proxima" ? "próxima" : "última"} {formatarDiaEMes(parcela.vencimentoEm)}
            </span>
          </>
        ) : (
          <span
            className="text-apoio text-muted-foreground tabular-nums whitespace-nowrap"
            data-testid="abertura-parcela"
          >
            {formatarDiaEMes(item.primeiraParcelaEm)}
          </span>
        )}
      </div>
    </div>
  );
}
