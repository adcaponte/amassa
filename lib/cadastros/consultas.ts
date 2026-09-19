// Leituras do módulo Cadastros. Sem `"use server"` — não são Server Actions, mesmo molde de
// `lib/financeiro/consultas.ts`: consultas chamadas direto do Server Component da página;
// `lib/cadastros/acoes.ts` fica só com escrita.
import { db } from "@/db";
import { configuracaoFinanceira } from "@/db/schema";

// A taxa do cartão, em pontos-base, ou 0 quando a configuração ainda não existe (a migração não
// semeia nenhuma linha) — nunca um valor inventado. Mesma leitura de
// `obterConfiguracaoFinanceira` (lib/financeiro/consultas.ts), mas só o campo que esta tela
// precisa.
export async function obterTaxaDoCartao(): Promise<number> {
  const [linha] = await db
    .select({ taxaCartaoPontosBase: configuracaoFinanceira.taxaCartaoPontosBase })
    .from(configuracaoFinanceira)
    .limit(1);

  return linha?.taxaCartaoPontosBase ?? 0;
}
