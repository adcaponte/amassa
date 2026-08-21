// As frases fixas da interface de Encomendas e a função que traduz `Situacao` em frase — só
// import de TIPO é permitido aqui (`import type`, nunca `import` de valor): o módulo não lê
// React nem o cliente do banco, e não importa nenhuma função de `lib/encomendas/formato.ts`
// (a formatação de data usada nas frases é feita localmente, ver `mesAbreviado` abaixo — a
// mesma disciplina de `gantt.ts`, que duplica a aritmética de calendário em vez de importar
// `cronograma.ts`).
//
// Nasce na onda 2 porque dois planos da onda 3 o consomem em paralelo (o índice do plano 04 e
// o detalhe do plano 05) — se nascesse num dos dois, o outro dependeria de um irmão da mesma
// onda. Os planos 07 e 08 acrescentam constantes próprias a este mesmo arquivo, em ondas
// posteriores.
import type { Etapa, Situacao } from "./cronograma";

export const FRASE_VAZIO_TITULO = "A roda ainda não gira.";
export const FRASE_VAZIO_CORPO =
  "Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui.";

export const FRASE_FILTRO_VAZIO_TITULO = "Nada por aqui com esse filtro.";
export const FRASE_FILTRO_VAZIO_CORPO =
  "Tente outro nome, cliente ou item — ou limpe a busca para ver tudo de novo.";

// Filtro, busca e ordenação (D-11 a D-14, plano 07) — rótulos e placeholder dos três controles,
// nas duas larguras (`filtro-encomendas.tsx`).
export const ROTULO_LIMPAR_FILTROS = "Limpar filtros";
export const PLACEHOLDER_BUSCA = "Buscar por nome, cliente ou item…";
export const ROTULO_FILTRAR_E_ORDENAR = "Filtrar e ordenar encomendas";
export const ROTULO_STATUS = "Status";
export const ROTULO_ORDENACAO = "Ordenar por";

// Histórico (D-07, plano 07) — estado vazio próprio, distinto de `FRASE_VAZIO_*` ("nenhuma
// encomenda existe") e de `FRASE_FILTRO_VAZIO_*` ("a busca não achou nada"): este é "não existe
// NENHUMA concluída/cancelada", independente do termo de busca.
export const FRASE_HISTORICO_VAZIO = "Nada concluído ou cancelado ainda.";

export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar as encomendas. Verifique a internet e tente de novo.";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

export const ROTULO_NOVA_ENCOMENDA = "Nova encomenda";
export const SELO_RASCUNHO = "RASCUNHO";
export const SELO_ATRASADA = "ATRASADA";

// Impressão A4 (D-18, ENC-14, plano 08) — as três frases fixas da folha e do botão que leva a
// ela. `NOTA_NADA_PARA_IMPRIMIR` aparece em DOIS lugares: abaixo do botão desabilitado no
// índice (03-UI-SPEC.md "Sem nenhuma encomenda ativa") e como corpo do `EstadoVazio` da própria
// rota `/encomendas/imprimir` quando acessada direto nesse estado — mesma frase, nunca duas.
export const TITULO_FOLHA_IMPRESSAO = "AMASSA — Encomendas ativas";
export const NOTA_NADA_PARA_IMPRIMIR = "Nada ativo para imprimir agora.";
export const ROTULO_IMPRIMIR = "Imprimir";

export const ROTULO_ETAPA: Record<Etapa, string> = {
  producao: "Produção",
  secagem: "Secagem",
  queima1: "Queima (biscoito)",
  esmaltacao: "Esmaltação",
  queima2: "Queima (esmalte)",
  entrega: "Entrega",
};

// Sufixo do campo de espera do marco (D-08) — palavra do próprio dono na caminhada de
// 2026-08-20. `textoDaEspera` devolve `null` para espera 0 (nada a dizer: o marco segue direto
// da etapa anterior) e uma frase com singular/plural correto para os demais.
export const SUFIXO_ESPERA = "dias depois";

export function textoDaEspera(esperaDias: number): string | null {
  if (esperaDias === 0) {
    return null;
  }
  return esperaDias === 1 ? "1 dia depois" : `${esperaDias} dias depois`;
}

// A frase do vão vazio na trilha (D-09) — usada tanto pela linha própria da trilha vertical do
// detalhe (`trilha-etapas.tsx`, um marco com espera > 0) quanto pelo `title`/`aria-label` do
// vão sem preenchimento da barra proporcional do celular (`trilha-segmentos.tsx`). `null` para
// espera 0: o marco segue direto da etapa anterior, nada a dizer — mesma regra de
// `textoDaEspera`, mas em forma de frase completa (a outra é um sufixo de campo).
export function textoDaEsperaNaTrilha(esperaDias: number): string | null {
  if (esperaDias === 0) {
    return null;
  }
  return esperaDias === 1
    ? "A peça fica parada 1 dia antes desta etapa."
    : `A peça fica parada ${esperaDias} dias antes desta etapa.`;
}

// Contagem de itens do índice (Gantt e cartão) em frase de interface, com singular/plural
// corretos em português — a interface não deixa criar `0` (`esquemaEncomenda.itens.min(1)`), mas
// uma linha semeada direto no banco alcança esse caso, então ele ganha frase própria em vez de
// "0 itens" (nenhuma frase, ninguém escreve). G-03-3-índice / índice mostra contagem, quick
// 260820-uot.
export function textoDaContagemDeItens(quantidade: number): string {
  if (quantidade === 0) return "sem itens";
  if (quantidade === 1) return "1 item";
  return `${quantidade} itens`;
}

const MESES_ABREVIADOS_PT: readonly string[] = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

// "24 ago" — a mesma forma curta de `formatarDiaCurto` (`lib/encomendas/formato.ts`), duplicada
// aqui porque este arquivo só pode ter `import type`. Sem `Intl`, sem `Date`: só divisão de
// string e uma tabela de 12 nomes, o bastante para uma frase de interface.
function diaCurto(dataIso: string): string {
  const [, mesTexto, diaTexto] = dataIso.split("-");
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  return `${dia} ${MESES_ABREVIADOS_PT[mes - 1]}`;
}

function pluralDias(quantidade: number): string {
  return quantidade === 1 ? "1 dia" : `${quantidade} dias`;
}

// Traduz uma `Situacao` (lib/encomendas/cronograma.ts) na frase exata da tabela "Etapa Atual e
// Dias Restantes (ENC-09)" de `03-UI-SPEC.md`. `switch` exaustivo sobre os nove ramos (o ramo
// `em-espera` chegou na fase 04.1, D-06/D-09) — o `_exaustivo: never` no `default` é o que faz
// o compilador reclamar se um ramo novo aparecer sem tratamento, em vez de cair num texto
// genérico em silêncio.
//
// `opcoes.semCor` existe para a folha impressa do plano 08 (D-18): o caso `atrasada` vira uma
// forma textual que não depende de `--color-atencao` para carregar o significado — mesma
// função, duas apresentações, nunca duas tabelas de frases (D-15).
export function textoDaSituacao(situacao: Situacao, opcoes?: { semCor?: boolean }): string {
  switch (situacao.tipo) {
    case "nao-comecou":
      return `Começa em ${pluralDias(situacao.diasAteInicio)} (previsto para ${diaCurto(situacao.dataInicio)})`;

    case "em-etapa-intervalo":
      return (
        `Etapa atual: ${ROTULO_ETAPA[situacao.etapa]} · faltam ` +
        `${pluralDias(situacao.diasAteProxima)} para ${ROTULO_ETAPA[situacao.proximaEtapa]}`
      );

    case "em-etapa-marco":
      return `Etapa atual: ${ROTULO_ETAPA[situacao.etapa]}`;

    case "ultima-etapa":
      return (
        `Etapa atual: ${ROTULO_ETAPA[situacao.etapa]} · ` +
        `${pluralDias(situacao.diasAteEntrega)} até a entrega`
      );

    case "atrasada": {
      const dataTexto = diaCurto(situacao.dataPrevista);
      const diasTexto = pluralDias(situacao.diasDeAtraso);
      if (opcoes?.semCor) {
        return `${dataTexto} passou há ${diasTexto} (atrasada)`;
      }
      return `Atrasada — a conclusão prevista era ${dataTexto}, há ${diasTexto}`;
    }

    case "concluida":
      return situacao.dataDeConclusao
        ? `Concluída em ${diaCurto(situacao.dataDeConclusao)}`
        : "Concluída.";

    case "cancelada":
      return "Cancelada";

    case "sem-etapas":
      return "Sem etapas definidas.";

    case "em-espera":
      return (
        `Em espera · faltam ${pluralDias(situacao.diasAteProxima)} para ` +
        `${ROTULO_ETAPA[situacao.proximaEtapa]}`
      );

    default: {
      const _exaustivo: never = situacao;
      throw new Error(`textoDaSituacao: ramo de Situacao não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}
