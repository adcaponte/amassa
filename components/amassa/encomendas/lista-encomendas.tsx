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
  ROTULO_LIMPAR_FILTROS,
} from "@/lib/encomendas/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { CartaoEncomenda } from "./cartao-encomenda";
import { FiltroEncomendas } from "./filtro-encomendas";
import { Gantt } from "./gantt";

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

  // A contagem TOTAL carregada decide entre os dois estados vazios, nunca a filtrada — mesma
  // regra que 03-04-SUMMARY.md já registrou para "A roda ainda não gira" vs. resultado de
  // filtro (ENC-13/adjacency). Como `ListaEncomendas` só monta quando `encomendas.length > 0`
  // (page.tsx decide isso antes), aqui só existe a distinção "nada bateu com o filtro".
  const nadaEncontrado = filtradas.length === 0;

  // As duas metades ativas (Gantt no desktop, cartões no celular) NUNCA desenham `concluida`/
  // `cancelada` (D-06) — a lista filtrada é estreitada de novo aqui para isso valer mesmo
  // quando o filtro de status é "Todas".
  const ativasFiltradas = filtradas.filter(
    (encomenda) => encomenda.status === "rascunho" || encomenda.status === "em_producao",
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

      {nadaEncontrado ? (
        <EstadoVazio
          titulo={FRASE_FILTRO_VAZIO_TITULO}
          corpo={FRASE_FILTRO_VAZIO_CORPO}
          rotuloBotao={ROTULO_LIMPAR_FILTROS}
          aoClicar={limparFiltros}
        />
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
        </div>
      )}
    </div>
  );
}
