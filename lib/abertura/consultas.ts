import { asc } from "drizzle-orm";

import { db } from "@/db";
import { aberturaItens } from "@/db/schema";
import type { ItemParaCalculo } from "@/lib/abertura/parcelas";
import type { CategoriaDeItem } from "@/lib/abertura/textos";

// Leitura da aba de itens de `/abertura`. Sem `"use server"` — não é uma Server Action, é uma
// consulta chamada direto do Server Component da página; `lib/abertura/acoes.ts` fica só com
// escrita (mesmo molde de `lib/queimas/consultas.ts`).
//
// `ItemDaAbertura` inclui os campos brutos do banco MAIS `ItemParaCalculo` (o formato mínimo que
// `lib/abertura/parcelas.ts` consome) — esta consulta NÃO calcula nada: parcela, soma de grupo e
// total são derivados por `calcularParcelas`/`totaisComprometidos` a partir deste dado bruto, o
// único lugar que sabe a regra de negócio.
export type ItemDaAbertura = ItemParaCalculo & {
  id: string;
  nome: string;
  categoria: CategoriaDeItem;
  entregaPrevistaEm: string | null;
  resolvido: boolean;
};

export async function listarItensDaAbertura(): Promise<ItemDaAbertura[]> {
  const linhas = await db.select().from(aberturaItens).orderBy(asc(aberturaItens.nome));

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria,
    valorEmCentavos: linha.valorCentavos,
    formaPagamento: linha.formaPagamento,
    parcelas: linha.parcelas,
    primeiraParcelaEm: linha.primeiraParcelaEm,
    entregaPrevistaEm: linha.entregaPrevistaEm,
    resolvido: linha.resolvido,
  }));
}
