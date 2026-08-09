"use client";

import { useState } from "react";

import type { Cronograma, Situacao, StatusDeEncomenda } from "@/lib/encomendas/cronograma";
import {
  aplicarFiltros,
  type FiltroDeStatus,
  type OrdenacaoDeEncomendas,
} from "@/lib/encomendas/filtros";
import { calcularIntervalo } from "@/lib/encomendas/gantt";
import {
  FRASE_FILTRO_VAZIO_CORPO,
  FRASE_FILTRO_VAZIO_TITULO,
  FRASE_HISTORICO_VAZIO,
  ROTULO_LIMPAR_FILTROS,
} from "@/lib/encomendas/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { CartaoEncomenda } from "./cartao-encomenda";
import { FiltroEncomendas } from "./filtro-encomendas";
import { Gantt } from "./gantt";
import { LinhaHistorico } from "./linha-historico";

// A casca cliente do índice — Client Component porque D-11 põe filtro/busca/ordenação AQUI
// dentro, sobre a lista inteira já carregada pelo Server Component (`page.tsx`). `FormularioEncomenda`
// NÃO mora aqui — este componente só é montado quando existe ao menos uma encomenda (`page.tsx`
// troca por `EstadoVazio` quando o índice inteiro está vazio), e `?nova` precisa abrir o
// formulário mesmo na primeiríssima encomenda; por isso `FormularioEncomenda` é montado direto em
// `page.tsx`, fora deste componente, uma única vez por página.
export type EncomendaDoIndice = {
  id: string;
  nome: string;
  clienteNome: string | null;
  status: StatusDeEncomenda;
  dataInicio: string;
  cronograma: Cronograma;
  situacao: Situacao;
  // D-13: a busca varre nome, cliente E descrição de item — os itens precisam vir carregados
  // junto da lista do índice (não só na página de detalhe), consequência já anotada em
  // 03-CONTEXT.md.
  itens: { descricao: string }[];
  // Usada só por `linha-historico.tsx` (uma encomenda cancelada mostra "cancelada em {data}",
  // nunca a conclusão prevista que nunca aconteceu) — o instante do UPDATE mais recente,
  // serializado como ISO string pelo Server Component (Date não atravessa a fronteira de props
  // com a mesma previsibilidade de uma string).
  atualizadoEm: string;
};

export type ListaEncomendasProps = {
  encomendas: EncomendaDoIndice[];
  hoje: string;
};

// O padrão de D-12 (ordenação por data de início) e do "Limpar filtros" (03-UI-SPEC.md "Nada
// encontrado"): zerar busca/status/ordenação volta exatamente a este objeto.
const FILTRO_PADRAO = {
  termo: "",
  status: "todas" as FiltroDeStatus,
  ordenacao: "data-inicio" as OrdenacaoDeEncomendas,
};

const STATUS_HISTORICO: readonly FiltroDeStatus[] = ["concluida", "cancelada"];

// Recebe a lista completa (ativas + histórico da janela de 12 meses, já calculada com
// `situacao`/`cronograma` no Server Component) por props. D-11: filtro, busca e ordenação rodam
// aqui, no navegador, sem nenhuma ida ao servidor a cada tecla — `useState` local, nunca
// parâmetro de URL (consequência aceita: recarregar a página perde o filtro, ponto de volta
// registrado em D-11 se o volume crescer).
export function ListaEncomendas({ encomendas, hoje }: ListaEncomendasProps) {
  const [termo, setTermo] = useState(FILTRO_PADRAO.termo);
  const [status, setStatus] = useState<FiltroDeStatus>(FILTRO_PADRAO.status);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoDeEncomendas>(FILTRO_PADRAO.ordenacao);

  const filtradas = aplicarFiltros(encomendas, { termo, status, ordenacao, hoje });

  function limparFiltros() {
    setTermo(FILTRO_PADRAO.termo);
    setStatus(FILTRO_PADRAO.status);
    setOrdenacao(FILTRO_PADRAO.ordenacao);
  }

  // "Concluídas"/"Canceladas" no seletor de status (D-07): a tela vira LISTA nas duas larguras,
  // nenhuma barra, nenhum Gantt — Gantt de encomenda que já acabou não ajuda a decidir nada.
  const somenteHistorico = STATUS_HISTORICO.includes(status);

  // Contagem TOTAL carregada do status atual (SEM aplicar o termo de busca) — decide entre os
  // dois estados vazios do histórico: "Nada concluído ou cancelado ainda." (não existe NENHUMA
  // encomenda daquele status — a busca não teria o que achar de qualquer forma) e "Nada por
  // aqui com esse filtro." (existem, mas a busca/ordenação atual não achou nenhuma). Mesma regra
  // de ENC-13/adjacency que decide "A roda ainda não gira" vs. resultado de busca no índice
  // inteiro — aqui aplicada ao recorte do histórico.
  const totalDoStatusAtual = somenteHistorico
    ? encomendas.filter((encomenda) => encomenda.status === status).length
    : null;
  const historicoGenuinamenteVazio = totalDoStatusAtual === 0;

  const nadaEncontrado = !historicoGenuinamenteVazio && filtradas.length === 0;

  // As duas metades ativas (Gantt no desktop, cartões no celular) NUNCA desenham `concluida`/
  // `cancelada` (D-06) — a lista filtrada é estreitada de novo aqui para isso valer mesmo
  // quando o filtro de status é "Todas".
  const ativasFiltradas = filtradas.filter(
    (encomenda) => encomenda.status === "rascunho" || encomenda.status === "em_producao",
  );
  // O recorte histórico da lista filtrada — não vazio só quando o status é "Todas" (as ativas
  // continuam no Gantt/lista normal e as históricas aparecem ABAIXO, sempre como lista) ou já é
  // "Concluídas"/"Canceladas" (nesse caso É a lista inteira, `ativasFiltradas` fica vazia).
  const historicoFiltrado = filtradas.filter((encomenda) =>
    STATUS_HISTORICO.includes(encomenda.status as FiltroDeStatus),
  );

  // D-14, explícito: a lista filtrada volta a passar por `calcularIntervalo` AQUI — o mesmo
  // "lista filtrada → calcularIntervalo de novo → Gantt redesenhado" que 03-07-PLAN.md descreve
  // como key_link. O `Gantt` (lib/encomendas/gantt.ts dentro do componente) também chama
  // `calcularIntervalo` sobre o `encomendas` que recebe — os dois cálculos são sempre iguais
  // (mesma função pura, mesmos dados), e expor o resultado aqui como atributo `data-*` deixa o
  // e2e confirmar o reajuste do intervalo sem depender de nenhum detalhe interno do `Gantt`.
  const intervaloAtivo = calcularIntervalo(
    ativasFiltradas.map((encomenda) => ({
      inicio: encomenda.cronograma.inicio,
      fimExclusivo: encomenda.cronograma.fimExclusivo,
    })),
    hoje,
  );

  return (
    <div>
      <FiltroEncomendas
        termo={termo}
        status={status}
        ordenacao={ordenacao}
        aoMudarTermo={setTermo}
        aoMudarStatus={setStatus}
        aoMudarOrdenacao={setOrdenacao}
      />

      {historicoGenuinamenteVazio ? (
        // Sem botão de ação (03-UI-SPEC.md E7/empty) — não há nada a oferecer: não existe
        // nenhuma encomenda concluída ou cancelada, "Limpar filtros" não mudaria isso.
        <EstadoVazio titulo={FRASE_HISTORICO_VAZIO} corpo="Quando uma encomenda for concluída ou cancelada, ela aparece bem aqui." />
      ) : nadaEncontrado ? (
        <EstadoVazio
          titulo={FRASE_FILTRO_VAZIO_TITULO}
          corpo={FRASE_FILTRO_VAZIO_CORPO}
          rotuloBotao={ROTULO_LIMPAR_FILTROS}
          aoClicar={limparFiltros}
        />
      ) : somenteHistorico ? (
        <ul className="flex flex-col gap-3 px-6 py-6 md:px-8" data-testid="lista-historico">
          {historicoFiltrado.map((encomenda) => (
            <li key={encomenda.id}>
              <LinhaHistorico encomenda={encomenda} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-6 py-6 md:px-8">
          <div
            className="hidden md:block"
            data-testid="intervalo-do-gantt"
            data-primeiro-dia={intervaloAtivo.primeiroDia}
            data-largura-em-pixels={intervaloAtivo.larguraEmPixels}
          >
            <Gantt encomendas={ativasFiltradas} hoje={hoje} />
          </div>

          {/* Metade do celular: cartões empilhados, na mesma ordem que o Gantt recebe
              (`aplicarFiltros` já ordenou pela ordenação escolhida — nunca reordenado aqui,
              ENC-08/ordering). */}
          <ul className="flex flex-col gap-3 md:hidden" data-testid="lista-cartoes">
            {ativasFiltradas.map((encomenda) => (
              <li key={encomenda.id}>
                <CartaoEncomenda encomenda={encomenda} />
              </li>
            ))}
          </ul>

          {/* Filtro em "Todas": as ativas ficam no Gantt/lista normal acima, e as históricas da
              janela de 12 meses aparecem ABAIXO, sempre como lista (D-07) — nunca desenhadas no
              Gantt (D-06). */}
          {historicoFiltrado.length > 0 && (
            <div className="mt-8" data-testid="historico-abaixo-das-ativas">
              <h2 className="text-micro text-muted-foreground mb-3 tracking-wide uppercase">
                Histórico
              </h2>
              <ul className="flex flex-col gap-3">
                {historicoFiltrado.map((encomenda) => (
                  <li key={encomenda.id}>
                    <LinhaHistorico encomenda={encomenda} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
