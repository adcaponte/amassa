// Módulo puro, só `import type` — GES-09: nenhuma regra nova, este módulo só REORGANIZA uma
// `Situacao` já calculada (`lib/encomendas/cronograma.ts::calcularCronograma`/`situacaoEm`, que
// quem chama já reaproveita) num formato pronto para o bloco do Início apresentar. É por isso
// que este arquivo não importa as funções de valor de `cronograma.ts`: quem monta a `Situacao`
// é o componente (Server Component, sem a restrição de "só import type" deste módulo); este
// arquivo só sabe interpretar o resultado.
//
// D-10, comentário obrigatório (sem reproduzir o literal que o critério de aceite varre): o
// protótipo aprovado mostrava, para um pedido ainda esperando o pagamento combinado entrar,
// um estado próprio na amostra de produção. Esse dado até existiria (um orçamento aprovado cria
// uma venda com aquele pagamento vencendo hoje, 04.5-12) — e MESMO ASSIM não se usa aqui: o
// briefing manda não antecipar nada do redesenho da Produção, que é quem vai decidir de
// verdade como aquele estado aparece. O jeito como isto é garantido não é um `if` que testa e
// pula — é o TIPO: `etapaAtual`/`proximaEtapa` abaixo só aceitam `Etapa`
// (`lib/encomendas/cronograma.ts`), a união fechada das seis etapas que o módulo de Encomendas
// realmente tem hoje. Não existe valor de `Etapa` para representar aquele estado — o
// compilador recusaria antes de qualquer teste rodar.
import type { Etapa, Situacao } from "./cronograma";

export type LinhaDeProducao = {
  id: string;
  titulo: string;
  // `null` quando a `Situacao` não tem uma etapa atual definida (a ordem ainda não começou, já
  // concluiu/cancelou, está atrasada sem etapa localizável, ou está no vão de espera antes de um
  // marco) — casos defensivos: `listarEncomendasAtivas()` só traz `rascunho`/`em_producao`, mas
  // este módulo não presume isso.
  etapaAtual: Etapa | null;
  // A etapa que vem depois, e quantos dias faltam para ela — os dois vêm juntos ou nenhum.
  // `null` na última etapa (Entrega): não há "o que vem depois", e a tela OMITE a frase em vez
  // de mostrar algo vazio.
  proximaEtapa: Etapa | null;
  diasAteProxima: number | null;
};

export type EncomendaParaProducao = {
  id: string;
  titulo: string;
  situacao: Situacao;
};

// Uma linha por encomenda de entrada, preservando a ordem — a ordenação é do módulo de
// Encomendas (`listarEncomendasAtivas`, por `data_inicio`), nunca deste arquivo (GES-09, aresta
// `ordering`). Lista vazia devolve lista vazia, sem erro.
export function producaoEmAndamento(
  encomendas: readonly EncomendaParaProducao[],
): LinhaDeProducao[] {
  return encomendas.map(({ id, titulo, situacao }) => {
    switch (situacao.tipo) {
      case "em-etapa-intervalo":
        return {
          id,
          titulo,
          etapaAtual: situacao.etapa,
          proximaEtapa: situacao.proximaEtapa,
          diasAteProxima: situacao.diasAteProxima,
        };

      case "em-etapa-marco":
        return { id, titulo, etapaAtual: situacao.etapa, proximaEtapa: null, diasAteProxima: null };

      case "ultima-etapa":
        // Entrega é a última etapa desenhada — não há próxima (o campo "o que vem depois" fica
        // nulo, e a tela omite a frase em vez de mostrar texto vazio).
        return { id, titulo, etapaAtual: situacao.etapa, proximaEtapa: null, diasAteProxima: null };

      case "em-espera":
        // A peça está parada entre o fim de uma etapa e o início do próximo marco — não há
        // etapa ATUAL neste instante (nenhuma faixa desenhada contém "hoje"), só a próxima.
        return {
          id,
          titulo,
          etapaAtual: null,
          proximaEtapa: situacao.proximaEtapa,
          diasAteProxima: situacao.diasAteProxima,
        };

      // "nao-comecou", "atrasada", "concluida", "cancelada", "sem-etapas": nenhum tem uma etapa
      // ATUAL no sentido dos ramos acima — devolvidos sem tag nem próxima etapa, nunca com um
      // valor inventado. `listarEncomendasAtivas()` só traz `rascunho`/`em_producao`, então
      // "concluida"/"cancelada" são inalcançáveis na prática; ficam aqui só como defesa (o
      // mesmo espírito de `situacaoEm`, que também trata "sem-etapas" como defesa).
      default:
        return { id, titulo, etapaAtual: null, proximaEtapa: null, diasAteProxima: null };
    }
  });
}
