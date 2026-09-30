// `lib/inicio/` só pode conter apresentação pura (GES-09). As quatro frases de ERRO abaixo são
// PRÓPRIAS de cada bloco (D-09): nenhuma é reaproveitada de outra — no ateliê a pessoa precisa
// saber SE é a agenda ou o dinheiro que está sem resposta; "Algo não funcionou" repetido quatro
// vezes não diz nada. As frases de VAZIO são verbatim do protótipo aprovado
// (`prototipo-gestao.html`, `telaInicio()`).
import { ROTULO_TENTAR_DE_NOVO } from "@/lib/erro/textos";

export type ChaveDoBloco = "agenda" | "vence" | "producao" | "estoque";

type TextosDoBloco = { vazio: string; erro: string };

// O bloco do Estoque tem um terceiro estado (plano 06-10): o estoque que ninguém contou ainda. Em vez
// de listar negativos que só existem porque ninguém contou, o bloco convida a contar.
export const TEXTOS_DOS_BLOCOS = {
  agenda: {
    vazio: "Nada marcado para hoje. O espaço está livre.",
    erro: "Não deu para carregar a agenda de hoje.",
  },
  vence: {
    vazio: "Nenhuma conta vence nos próximos 7 dias.",
    erro: "Não deu para carregar o que vence.",
  },
  producao: {
    vazio: "Nenhuma ordem em andamento.",
    erro: "Não deu para carregar a produção.",
    // Fase 06.1 (D-16): a segunda frase do vazio depende de haver ordem esperando o sinal.
    vazioComAguardando: "Elas entram em andamento quando forem liberadas, na Produção.",
    vazioSemAguardando: "Abra a Produção para criar uma ordem.",
  },
  estoque: {
    vazio: "Nenhum material abaixo do mínimo.",
    erro: "Não deu para carregar o estoque.",
    naoContado: "O estoque ainda não foi contado.",
    linkNaoContado: "começar a contagem",
  },
} satisfies Record<
  ChaveDoBloco,
  TextosDoBloco & {
    naoContado?: string;
    linkNaoContado?: string;
    vazioComAguardando?: string;
    vazioSemAguardando?: string;
  }
>;

// Bloco "Produção" (Fase 06.1, D-16): a linha final das ordens que esperam o sinal e o "e mais N"
// das liberadas que passam das 5 linhas (UI-D9).
export function textoAguardandoOSinal(quantas: number): string {
  return `${quantas} aguardando o sinal`;
}
export function textoEMaisOrdens(quantas: number): string {
  return `e mais ${quantas}`;
}

// Reexportado, não duplicado: `lib/erro/textos.ts` já é a voz única do rótulo "Tentar de novo"
// (usado por `app/gestao/(app)/error.tsx`) e é um módulo puro sem import — reimportá-lo aqui não
// quebra a pureza de `lib/inicio/`, só evita uma segunda cópia do mesmo literal.
export { ROTULO_TENTAR_DE_NOVO };
