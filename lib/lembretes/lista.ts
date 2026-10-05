// Módulo puro dos Lembretes (Fase 06.3, plano 02) — o que a tela decide sem banco: a ordem dos
// abertos, o rótulo de prazo no dia de Brasília e o resumo do Início. No molde de
// `lib/anotacoes/folha.ts`: `hoje` e o instante chegam SEMPRE por argumento; nada aqui lê o
// relógio. Não importa React, Next, drizzle-orm, pg nem `@/db` (teste de pureza em
// `tests/unit/lembretes-lista.test.ts`).
//
// `hoje` nasce na página (`hojeEmBrasilia(instante)`, `lib/financeiro/formato.ts`) e desce por prop.
// A aritmética de dias é a civil de `lib/producao/calendario.ts` — inteiros, sem `Date` na conta.

import { QUANTOS_POR_VEZ, TETO_DE_QUANTOS, quantosDaUrl } from "@/lib/clientes/lista";
import { diasEntre, formatarDiaMes } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import {
  FRASE_NADA_PENDENTE,
  ROTULO_AMANHA,
  ROTULO_HOJE,
  textoAbertos,
  textoVenceu,
  textoVencidos,
} from "./textos";

// Quantos abertos o Início mostra antes do "e mais N — ver todos" (BRIEFING, 06.3-UI-SPEC.md).
export const LIMITE_DE_ABERTOS_NO_INICIO = 6;
// Quantos feitos a sanfona "Feitos" do Início mostra antes do "e mais N em “ver todos”" (D-02).
export const LIMITE_DE_FEITOS_NO_INICIO = 5;
// Quanto tempo o toast de "Feito"/"Lembrete excluído" oferece o "Desfazer" (06.3-UI-SPEC.md §Toasts).
export const DURACAO_DO_DESFAZER_MS = 6000;
// O trecho do texto que o toast mostra, em pontos de código (06.3-UI-SPEC.md §Toasts).
export const TAMANHO_DO_TRECHO = 40;

// 06.3-WR-03 (quick 261005-2yu, 05/10/2026): qual aviso o toque na caixa merece. O "Desfazer" do "Feito"
// só existe quando FOI ESTA chamada que gravou o feito (`gravadoAgora`, pelo `returning` do update):
// se outra pessoa marcou antes, desfazer apagaria o feito DELA — o aviso só diz "já estava feito por …".
// E se a linha voltou aberta (reaberta entre o toque e a resposta), o aviso não pode dizer "Feito".
export type AvisoDaMarcacao = "feito" | "ja_feito" | "voltou_aberto";

export function avisoDaMarcacao({
  feitoEm,
  gravadoAgora,
}: {
  feitoEm: string | null;
  gravadoAgora: boolean;
}): AvisoDaMarcacao {
  if (feitoEm === null) {
    return "voltou_aberto";
  }
  return gravadoAgora ? "feito" : "ja_feito";
}

// 06.3-WR-02 (quick 261005-2yu; o dono decidiu só a correção mínima, sem paginação por cursor): a lista
// de "ver todos" chegou ao teto de `quantos` (500) e ainda há mais — a tela diz isso, em vez de o botão
// sumir em silêncio.
export function chegouAoTeto({ haMais, quantos }: { haMais: boolean; quantos: number }): boolean {
  return haMais && quantos >= TETO_DE_QUANTOS;
}

// Tipo estrutural: serve à `LembreteDaTela` do servidor e ao estado local do cliente sem importar
// `consultas.ts` (que alcança o banco).
export type AbertoParaOrdenar = {
  id: string;
  paraQuando: string | null;
  criadoEm: string;
};

// O "sem data" vai para o fim: `YYYY-MM-DD` compara bem como texto, e nenhuma data real passa de
// 9999-12-31.
const SEM_DATA_POR_ULTIMO = "9999-12-31";

// A mesma ordem do SQL de `lerLembretesDoInicio`: `para_quando asc nulls last, criado_em asc,
// id asc`. Uma regra, dois consumidores — o servidor ordena pelo SQL, o cliente reordena o estado
// otimista por esta função.
export function compararAbertos(a: AbertoParaOrdenar, b: AbertoParaOrdenar): number {
  const prazoA = a.paraQuando ?? SEM_DATA_POR_ULTIMO;
  const prazoB = b.paraQuando ?? SEM_DATA_POR_ULTIMO;
  if (prazoA !== prazoB) {
    return prazoA < prazoB ? -1 : 1;
  }
  // Instante, não texto: "…12:00:00Z" e "…12:00:00.000+00:00" são o mesmo momento.
  const criadoA = Date.parse(a.criadoEm);
  const criadoB = Date.parse(b.criadoEm);
  if (criadoA !== criadoB) {
    return criadoA - criadoB;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

export type SituacaoDoPrazo = "vencido" | "hoje" | "amanha" | "futuro" | "sem-data";

export function situacaoDoPrazo(paraQuando: string | null, hoje: string): SituacaoDoPrazo {
  if (paraQuando === null) {
    return "sem-data";
  }
  const dias = diasEntre(hoje, paraQuando);
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanha";
  return "futuro";
}

// O BRIEFING escreve "venceu dd/mm · N dias"; o protótipo — que vence na interface — escreve
// "ontem" para 1 dia (A5 da pesquisa B, Parte 0). N ≥ 2 segue "· N dias".
export function rotuloDoPrazo(paraQuando: string | null, hoje: string): string | null {
  const situacao = situacaoDoPrazo(paraQuando, hoje);
  if (paraQuando === null || situacao === "sem-data") {
    return null;
  }
  switch (situacao) {
    case "vencido":
      return textoVenceu(formatarDiaMes(paraQuando), diasEntre(paraQuando, hoje));
    case "hoje":
      return ROTULO_HOJE;
    case "amanha":
      return ROTULO_AMANHA;
    case "futuro":
      return formatarDiaMes(paraQuando);
  }
}

export type ResumoDoInicio<T extends AbertoParaOrdenar> = {
  visiveis: T[];
  restantes: number;
  totalDeAbertos: number;
  totalDeVencidos: number;
  contagem: string;
};

// A coluna "Para fazer" do Início: ordena uma CÓPIA (o estado de quem chamou não muda), corta nos
// primeiros `LIMITE_DE_ABERTOS_NO_INICIO` e escreve a contagem ao lado do título — "nada pendente",
// "1 aberto", "3 abertos · 1 vencido".
export function resumoDoInicio<T extends AbertoParaOrdenar>(
  abertos: readonly T[],
  hoje: string,
): ResumoDoInicio<T> {
  const ordenados = [...abertos].sort(compararAbertos);
  const visiveis = ordenados.slice(0, LIMITE_DE_ABERTOS_NO_INICIO);
  const totalDeAbertos = ordenados.length;
  const totalDeVencidos = ordenados.filter(
    (lembrete) => situacaoDoPrazo(lembrete.paraQuando, hoje) === "vencido",
  ).length;

  let contagem = FRASE_NADA_PENDENTE;
  if (totalDeAbertos > 0) {
    contagem = textoAbertos(totalDeAbertos);
    if (totalDeVencidos > 0) {
      contagem += ` · ${textoVencidos(totalDeVencidos)}`;
    }
  }

  return {
    visiveis,
    restantes: totalDeAbertos - visiveis.length,
    totalDeAbertos,
    totalDeVencidos,
    contagem,
  };
}

// "dd/mm hh:mm" em Brasília (UI-D11: "por Ana · 02/10 14:20"), no molde de `textoDaAutoria`
// (`lib/anotacoes/folha.ts`): o instante chega por argumento, e `hourCycle: "h23"` garante "00" à
// meia-noite (com `hour12: false` sozinho alguns motores escrevem "24").
const FORMATO_DO_INSTANTE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function instanteCurto(iso: string): string {
  const partes = FORMATO_DO_INSTANTE.formatToParts(new Date(iso));
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${parte("day")}/${parte("month")} ${parte("hour")}:${parte("minute")}`;
}

// O primeiro nome que aparece no chip e nas pílulas (UI-D3). Nulo ou só espaços → `null`.
export function primeiroNome(nome: string | null): string | null {
  if (nome === null) {
    return null;
  }
  const aparado = nome.trim();
  if (aparado === "") {
    return null;
  }
  return aparado.split(/\s+/)[0] ?? null;
}

// A cor do chip é pela POSIÇÃO da pessoa entre as ativas ordenadas por `usuarios.criado_em`
// (UI-D2), nunca pelo nome — nome de pessoa não entra no código. 3ª pessoa em diante e pessoa
// desativada (índice −1) ficam neutras. A cor é decorativa: o nome está escrito no chip. As classes
// ficam como LITERAIS inteiros para o Tailwind enxergá-las ao varrer `lib/`.
export function corDaPessoa(indice: number): string {
  if (indice === 0) return "bg-esmaltacao";
  if (indice === 1) return "bg-queima1";
  return "bg-tinta-fraca";
}

// O trecho do toast: corta em pontos de código (um emoji conta como um), "…" só se cortou.
export function trecho(texto: string, tamanho: number = TAMANHO_DO_TRECHO): string {
  const pontos = [...texto];
  if (pontos.length <= tamanho) {
    return texto;
  }
  return `${pontos.slice(0, tamanho).join("")}…`;
}

type ValorDaUrl = string | readonly string[] | null | undefined;

export type FiltrosDosLembretes = {
  situacao: "abertos" | "feitos";
  // "todos", "geral" (sem pessoa) ou o uuid de uma pessoa.
  quem: string;
  quantos: number;
};

const FILTROS_PADRAO: FiltrosDosLembretes = {
  situacao: "abertos",
  quem: "todos",
  quantos: QUANTOS_POR_VEZ,
};

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `/gestao/lembretes?situacao=&quem=&quantos=` (06.3-UI-SPEC.md §Rotas, T-06.3-09): só uniões
// fechadas, uuid por expressão e `quantos` pela MESMA regra de Clientes (múltiplo de 50 até 500,
// `quantosDaUrl` reaproveitado, não copiado). Lista repetida ou valor fora da união → o padrão,
// nunca erro nem consulta aberta.
export function filtrosDaUrl(parametros: {
  situacao?: ValorDaUrl;
  quem?: ValorDaUrl;
  quantos?: ValorDaUrl;
}): FiltrosDosLembretes {
  const { situacao, quem, quantos } = parametros;
  return {
    situacao: situacao === "abertos" || situacao === "feitos" ? situacao : FILTROS_PADRAO.situacao,
    quem:
      typeof quem === "string" && (quem === "todos" || quem === "geral" || FORMATO_UUID.test(quem))
        ? quem
        : FILTROS_PADRAO.quem,
    quantos: quantosDaUrl(quantos),
  };
}

// O endereço de "ver todos" com os filtros — só os valores diferentes do padrão, na ordem
// `situacao`, `quem`, `quantos`.
export function hrefDosLembretes(filtros: FiltrosDosLembretes): string {
  const busca = new URLSearchParams();
  if (filtros.situacao !== FILTROS_PADRAO.situacao) busca.set("situacao", filtros.situacao);
  if (filtros.quem !== FILTROS_PADRAO.quem) busca.set("quem", filtros.quem);
  if (filtros.quantos !== FILTROS_PADRAO.quantos) busca.set("quantos", String(filtros.quantos));
  const consulta = busca.toString();
  const caminho = rotaDeGestao("/lembretes");
  return consulta === "" ? caminho : `${caminho}?${consulta}`;
}
