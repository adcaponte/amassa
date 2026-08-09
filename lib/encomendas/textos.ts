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

export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar as encomendas. Verifique a internet e tente de novo.";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

export const ROTULO_NOVA_ENCOMENDA = "Nova encomenda";
export const SELO_RASCUNHO = "RASCUNHO";
export const SELO_ATRASADA = "ATRASADA";

export const ROTULO_ETAPA: Record<Etapa, string> = {
  producao: "Produção",
  secagem: "Secagem",
  queima1: "Queima (biscoito)",
  esmaltacao: "Esmaltação",
  queima2: "Queima (esmalte)",
  entrega: "Entrega",
};

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
// Dias Restantes (ENC-09)" de `03-UI-SPEC.md`. `switch` exaustivo sobre os oito ramos — o
// `_exaustivo: never` no `default` é o que faz o compilador reclamar se um ramo novo aparecer
// sem tratamento, em vez de cair num texto genérico em silêncio.
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

    default: {
      const _exaustivo: never = situacao;
      throw new Error(`textoDaSituacao: ramo de Situacao não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}
