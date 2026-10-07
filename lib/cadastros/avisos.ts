// Módulo puro, sem nenhum import: resolve o aviso pós-navegação de Cadastros a partir da query
// string — o servidor lê isto e monta o texto pronto (`textos.ts`), nunca o cliente. Mesmo molde
// de `lib/financeiro/avisos.ts`, mas os tipos conhecidos são outros (Cadastros nunca lança
// documento, exceto pelo lote de "Gerar as contas de {mês}").
export type TipoDeAvisoDeCadastros =
  | "categoria-desativada"
  | "categoria-reativada"
  | "conta-fixa-desativada"
  | "conta-fixa-reativada"
  | "contas-geradas"
  // "Usar esta hora" (04.5-02-PLAN.md, ORC-04) — a hora calculada acabou de virar parâmetro.
  | "hora-atualizada"
  // 06.2-WR-02 (quick 261005-2yu, 05/10/2026): o anexo de fornecedor que não abriu numa navegação
  // volta à ficha com um destes (`lib/fornecedores/cabecalhos.ts` destinoDoAvisoDeAnexo).
  | "anexo-sumiu"
  | "anexo-nao-encontrado"
  | "anexo-nao-abriu";

export type AvisoDeCadastros =
  | { tipo: "categoria-desativada" }
  | { tipo: "categoria-reativada" }
  | { tipo: "conta-fixa-desativada" }
  | { tipo: "conta-fixa-reativada" }
  | { tipo: "contas-geradas"; quantidade: number; mes: string; mantidas: number }
  | { tipo: "hora-atualizada" }
  | { tipo: "anexo-sumiu" }
  | { tipo: "anexo-nao-encontrado" }
  | { tipo: "anexo-nao-abriu" };

const TIPOS_SEM_PARAMETRO: readonly Exclude<TipoDeAvisoDeCadastros, "contas-geradas">[] = [
  "categoria-desativada",
  "categoria-reativada",
  "conta-fixa-desativada",
  "conta-fixa-reativada",
  "hora-atualizada",
  "anexo-sumiu",
  "anexo-nao-encontrado",
  "anexo-nao-abriu",
];

const REGEX_MES = /^\d{4}-\d{2}$/;
// Quantidade de contas geradas num único "Gerar" — teto generoso (nenhum ateliê tem mais de 500
// contas fixas), só para fechar o formato antes de o texto entrar num toast (T-04.4-64).
const QUANTIDADE_MAXIMA = 500;

export function avisoDaUrl(parametros: {
  aviso?: string | null;
  quantidade?: string | null;
  mes?: string | null;
  mantidas?: string | null;
}): AvisoDeCadastros | null {
  const encontrado = TIPOS_SEM_PARAMETRO.find((tipo) => tipo === parametros.aviso);
  if (encontrado) {
    return { tipo: encontrado };
  }

  if (parametros.aviso === "contas-geradas") {
    const quantidadeTexto = parametros.quantidade;
    if (!quantidadeTexto || !/^\d+$/.test(quantidadeTexto)) {
      return null;
    }
    const quantidade = Number(quantidadeTexto);
    if (quantidade < 0 || quantidade > QUANTIDADE_MAXIMA) {
      return null;
    }

    const mes = parametros.mes;
    if (!mes || !REGEX_MES.test(mes)) {
      return null;
    }

    // 06.5-WR-03 (quick 261007-shs): quantas canceladas no mês continuaram canceladas; ausente = 0.
    let mantidas = 0;
    if (parametros.mantidas !== undefined && parametros.mantidas !== null) {
      if (!/^\d+$/.test(parametros.mantidas)) {
        return null;
      }
      mantidas = Number(parametros.mantidas);
      if (mantidas > QUANTIDADE_MAXIMA) {
        return null;
      }
    }

    return { tipo: "contas-geradas", quantidade, mes, mantidas };
  }

  return null;
}
