import { eq } from "drizzle-orm";

import { db } from "@/db";
import { anotacoesDaCasa, usuarios } from "@/db/schema";

export type FolhaDaCasa = {
  texto: string;
  salvoPorNome: string | null;
  atualizadoEm: string;
};

// A folha inteira, numa consulta só — a tabela tem UMA linha por construção (a semente da
// migração 0022 garante isso, D-08), então nenhum `limit` acrobático é necessário aqui além do
// `limit(1)` defensivo. `leftJoin` com `usuarios` porque `salvo_por` é ANULÁVEL (ninguém salvou
// ainda) — mesmo raciocínio do `leftJoin` de autoria em `lib/abertura/consultas.ts`.
export async function lerFolhaDaCasa(): Promise<FolhaDaCasa> {
  const [linha] = await db
    .select({
      texto: anotacoesDaCasa.texto,
      salvoPorNome: usuarios.nome,
      atualizadoEm: anotacoesDaCasa.atualizadoEm,
    })
    .from(anotacoesDaCasa)
    .leftJoin(usuarios, eq(anotacoesDaCasa.salvoPor, usuarios.id))
    .limit(1);

  if (!linha) {
    // A semente da migração 0022 garante que esta linha sempre existe (D-08) — chegar aqui
    // significa que a migração não foi aplicada (ou foi desfeita à mão), nunca um estado de
    // negócio real que a tela precise tratar como vazio.
    throw new Error(
      "A folha de anotações da casa não existe — confira se a migração 0022 foi aplicada.",
    );
  }

  return {
    texto: linha.texto,
    salvoPorNome: linha.salvoPorNome,
    atualizadoEm: linha.atualizadoEm.toISOString(),
  };
}
