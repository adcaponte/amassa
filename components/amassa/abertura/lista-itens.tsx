import type { ItemDaAbertura } from "@/lib/abertura/consultas";
import { formatarReais } from "@/lib/abertura/formato";
import { contarEntregasVencidas } from "@/lib/abertura/prazos";
import {
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ORDEM_DAS_CATEGORIAS,
  ROTULO_CATEGORIA,
  ROTULO_NOVO_ITEM,
} from "@/lib/abertura/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { LinhaDeItem } from "@/components/amassa/abertura/linha-item";
import { ConfirmarRemoverItem } from "@/components/amassa/abertura/confirmar-remover-item";


export type ListaItensProps = {
  itens: ItemDaAbertura[];
  hoje: string;
  // Contagem de tarefas ABERTAS por item (D-13, `contarTarefasAbertasPorItem` em
  // `lib/abertura/prazos.ts`), calculada UMA VEZ na página a partir das tarefas já carregadas —
  // nunca uma segunda consulta por item aqui. Chave ausente = nenhuma tarefa aberta, nunca 0.
  contagemDeTarefasAbertas: Map<string, number>;
  // Contagem de TODAS as tarefas ligadas ao item — concluídas ou não (D-14, Tarefa 3,
  // `contarTarefasLigadasPorItem`) — mostrada na confirmação de remoção ANTES de confirmar.
  // Diferente do mapa acima: remover o item solta toda tarefa ligada, não só as abertas.
  contagemDeTarefasLigadas: Map<string, number>;
};

// Server Component. Percorre `ORDEM_DAS_CATEGORIAS` (D-08) e desenha um grupo por categoria QUE
// TENHA item — categoria vazia não desenha cabeçalho nenhum. Nenhuma regra de negócio nasce
// aqui: `calcularParcelas`/`proximaParcela` (`lib/abertura/parcelas.ts`) já chegam prontos por
// item, este componente só formata e desenha.
export function ListaItens({
  itens,
  hoje,
  contagemDeTarefasAbertas,
  contagemDeTarefasLigadas,
}: ListaItensProps) {
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
      {/* UMA instância para a lista toda (nunca uma por linha) — ver o comentário em
          confirmar-remover-item.tsx e .planning/debug/abertura-navegacao-trava.md. */}
      <ConfirmarRemoverItem
        itens={itens.map((item) => ({
          id: item.id,
          nome: item.nome,
          valorEmCentavos: item.valorEmCentavos,
          tarefasLigadas: contagemDeTarefasLigadas.get(item.id) ?? 0,
        }))}
      />

      {categoriasComItem.map((categoria) => {
        const linhas = itens.filter((item) => item.categoria === categoria);
        const soma = linhas.reduce((total, item) => total + item.valorEmCentavos, 0);
        // D-04/ABE-04: quantos itens deste grupo estão com entrega vencida — o cabeçalho
        // GRITA esse número antes da contagem normal (mesma disciplina de D-10 para tarefas).
        const naoChegaram = contarEntregasVencidas(linhas, hoje);

        return (
          <div key={categoria} data-testid="abertura-grupo-categoria">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-micro font-semibold tracking-wide text-muted-foreground uppercase">
                {ROTULO_CATEGORIA[categoria]}
              </h2>
              <span
                className="text-apoio flex items-center gap-2 text-muted-foreground tabular-nums"
                data-testid="abertura-total-grupo"
              >
                {naoChegaram > 0 && (
                  <span
                    className="text-micro font-semibold text-erro"
                    data-testid="abertura-nao-chegaram-do-grupo"
                  >
                    {naoChegaram} {naoChegaram === 1 ? "não chegou" : "não chegaram"}
                  </span>
                )}
                <span>
                  {linhas.length} {linhas.length === 1 ? "item" : "itens"} · {formatarReais(soma)}
                </span>
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
