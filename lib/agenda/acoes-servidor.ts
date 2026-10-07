// Auxiliar de servidor das ações da Agenda, usado por mais de um arquivo de ações (D-24/P10, plano
// 06.5-27). SEM diretiva — exportado daqui não vira endpoint — e importado SÓ pelos arquivos
// "use server" (`acoes-datas.ts`, `acoes-turmas.ts`, `acoes-uso-livre.ts`, `acoes-cobranca.ts`);
// o índice `acoes.ts` nunca o reexporta (`next/cache` não tem lugar no pacote do cliente).

import { revalidatePath } from "next/cache";

import { rotaDeGestao } from "@/lib/rotas/gestao";

// As telas que mostram a Agenda. NÃO exportado (uma exportação deste arquivo vira endpoint): os
// planos seguintes o ampliam — o Início (`rotaDeGestao("/")`) e o site (`"/"`) quando o que é
// público muda. (06.5-27: o "NÃO exportado" valia para o antigo `acoes.ts`, com "use server"; aqui,
// sem diretiva, a exportação não vira endpoint.)
export function revalidarTelasDaAgenda({ publico }: { publico: boolean }): void {
  revalidatePath(rotaDeGestao("/agenda"));
  if (publico) {
    revalidatePath(rotaDeGestao("/"));
    revalidatePath("/");
  }
}
