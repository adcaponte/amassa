// Módulo puro dos Lembretes (Fase 06.3, plano 02) — o que a tela decide sem banco: a ordem dos
// abertos, o rótulo de prazo no dia de Brasília e o resumo do Início. No molde de
// `lib/anotacoes/folha.ts`: `hoje` e o instante chegam SEMPRE por argumento; nada aqui lê o
// relógio. Não importa React, Next, drizzle-orm, pg nem `@/db` (teste de pureza em
// `tests/unit/lembretes-lista.test.ts`).
//
// `hoje` nasce na página (`hojeEmBrasilia(instante)`, `lib/financeiro/formato.ts`) e desce por prop.
// A aritmética de dias é a civil de `lib/producao/calendario.ts` — inteiros, sem `Date` na conta.

import { diasEntre, formatarDiaMes } from "@/lib/producao/calendario";

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
