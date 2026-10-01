// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`. Fechada no plano 09 na
// ordem Venda · Despesa · Caixa · Mês · Cadastros; a Fase 04.5 (D-01/D-02) acrescenta
// "orcamentos" e "pecas" — Orçamentos e Peças vivem DENTRO do Financeiro, como aba, não como rota
// de primeiro nível. A ordem visual das 7 pílulas (duas fileiras) mora em
// `components/amassa/financeiro/abas-financeiro.tsx`; esta união não impõe ordem nenhuma.
export type AbaFinanceiro = "venda" | "despesa" | "caixa" | "mes" | "orcamentos" | "pecas";

// Normaliza `?aba=` para uma das abas da união fechada — qualquer valor desconhecido, ausente ou
// vazio vira "venda", a aba padrão (o módulo abre direto na Venda, D-06 do 04.4-CONTEXT.md).
// O fallback continua intocado (D-01): nenhuma aba nova muda o que acontece com um valor
// desconhecido.
export function abaDaUrl(valor: string | null | undefined): AbaFinanceiro {
  if (valor === "despesa") return "despesa";
  if (valor === "caixa") return "caixa";
  if (valor === "mes") return "mes";
  if (valor === "orcamentos") return "orcamentos";
  if (valor === "pecas") return "pecas";
  return "venda";
}

// Formato fechado de mês civil "AAAA-MM" — usado por `mesDaUrl` abaixo E por `mes.ts`/
// `extrato.ts` (redeclarado neste arquivo por ser o único módulo de abas do Financeiro; os outros
// dois importam só o TIPO, nunca o regex).
const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// Normaliza `?mes=` para "AAAA-MM" — mês inválido, mal formado ou ausente cai no mês de HOJE
// (argumento explícito, nunca `new Date()` interno: este módulo continua puro). "2021-13" tem o
// formato de dois dígitos mas mês inexistente — o regex acima já recusa (só aceita 01-12).
export function mesDaUrl(valor: string | null | undefined, hoje: string): string {
  if (valor && FORMATO_MES.test(valor)) {
    return valor;
  }
  return hoje.slice(0, 7);
}

export type FormaDoFiltroDoExtrato = "todas" | "dinheiro" | "pix" | "cartao";

// Normaliza `?forma=` para uma das quatro opções do filtro do extrato (D-11) — qualquer valor
// desconhecido, ausente ou vazio cai em "todas" (nenhum filtro aplicado).
export function formaDaUrl(valor: string | null | undefined): FormaDoFiltroDoExtrato {
  if (valor === "dinheiro" || valor === "pix" || valor === "cartao") {
    return valor;
  }
  return "todas";
}

// A Venda aberta pela Agenda (Fase 05, plano 12 — AGE-15, mecanismo B da pesquisa, UI-D26): o
// “Lançar na Venda” abre `?aba=venda&origem={tipo}:{uuid}`. A união é REDECLARADA aqui (nenhum
// import da Agenda: este módulo continua sem import nenhum); os três tipos são os de
// `lib/agenda/receber.ts::TIPOS_DE_COBRANCA`. A origem só diz QUAL cobrança — a página resolve tudo
// o mais no servidor (`cobrancaParaVenda`), e `lancarVenda` sobrescreve pessoa, cliente e descrição.
export type TipoDaOrigemDaVenda = "mensalidade" | "inscricao" | "uso_livre";
export type OrigemDaVenda = { tipo: TipoDaOrigemDaVenda; id: string };

const FORMATO_DA_ORIGEM =
  /^(mensalidade|inscricao|uso_livre):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Normaliza `?origem=` para a união fechada — tipo desconhecido, uuid inválido, vazio, ausente ou
// a lista (o parâmetro repetido) viram `null`. O tipo é exato (minúsculo); o uuid volta minúsculo.
export function origemDaUrl(valor: string | readonly string[] | null | undefined): OrigemDaVenda | null {
  if (typeof valor !== "string") {
    return null;
  }
  const casamento = FORMATO_DA_ORIGEM.exec(valor);
  if (!casamento) {
    return null;
  }
  const tipo = casamento[1];
  if (tipo !== "mensalidade" && tipo !== "inscricao" && tipo !== "uso_livre") {
    return null;
  }
  return { tipo, id: casamento[2].toLowerCase() };
}

// O texto de `?origem=` — o mesmo que o `PainelVenda` manda de volta para `lancarVenda`.
export function textoDaOrigem(origem: OrigemDaVenda): string {
  return `${origem.tipo}:${origem.id}`;
}
