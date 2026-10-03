// Módulo puro de Fornecedores — a TABELA DE PREÇOS VIGENTE e o selo de idade dela (Fase 06.2, plano
// 08; FRN-11, D-09). Um import só, `diasEntre` de `lib/producao/calendario.ts` (puro, conta dias civis
// sem fuso); nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano).
//
// "Hoje" chega por PARÂMETRO, sempre o dia civil de Brasília: a ficha passa `hojeEmBrasilia(new Date())`
// — nunca o dia UTC. E `enviadoEm` também chega pronto: é o dia civil de Brasília do `criado_em`,
// calculado na consulta (`hojeEmBrasilia(criadoEm)`), de modo que um envio às 23h50 de Brasília conta o
// dia de Brasília, não o dia seguinte do UTC.
//
// Nada aqui vira número: a tabela não é lida nem convertida em preço; o selo é só a idade do arquivo, e
// nenhum lembrete nasce dele (briefing §1 e §7).
import { diasEntre } from "@/lib/producao/calendario";

// Passados 120 dias da referência, a tabela "tem mais de 4 meses" (o selo de atenção). Com 120 ela
// ainda é "recente"; com 121, não.
export const DIAS_PARA_TABELA_VELHA = 120;

export type TipoDeAnexoParaVigencia = "tabela" | "catalogo" | "nota" | "outro";

// O que a regra precisa de cada anexo. Quem chama pode passar mais campos.
export type AnexoParaVigencia = {
  id: string;
  nome: string;
  tipo: TipoDeAnexoParaVigencia;
  // Dia civil "YYYY-MM-DD" do "Vale a partir de" (só tabela) — nulo = vale pela data de envio.
  valeDesde: string | null;
  // Dia civil "YYYY-MM-DD" de Brasília do envio (o `criado_em` no fuso do ateliê).
  enviadoEm: string;
  // O instante do envio (ISO 8601), para o desempate de duas tabelas com a mesma referência.
  criadoEm: string;
};

export type SeloDaTabela = "recente" | "velha";

export type EfeitoDeTirar =
  | { caso: "comum" }
  | { caso: "unica-tabela" }
  | { caso: "vigente-com-anterior"; anterior: string };

// A data que conta para a vigência e para a idade: o "vale desde" quando existe; senão, o dia do envio.
export function referenciaDaTabela(anexo: Pick<AnexoParaVigencia, "valeDesde" | "enviadoEm">): string {
  return anexo.valeDesde ?? anexo.enviadoEm;
}

function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Ordem crescente de vigência: (referência, instante do envio, id). Datas civis "YYYY-MM-DD" comparam
// como texto; o instante, pelo número de milissegundos (um ISO com outro fuso compara certo); o id
// desempata o empate total — a resposta nunca depende da ordem da lista.
function compararVigencia(a: AnexoParaVigencia, b: AnexoParaVigencia): number {
  const porReferencia = compararTexto(referenciaDaTabela(a), referenciaDaTabela(b));
  if (porReferencia !== 0) {
    return porReferencia;
  }
  const porInstante = Date.parse(a.criadoEm) - Date.parse(b.criadoEm);
  if (porInstante !== 0 && !Number.isNaN(porInstante)) {
    return porInstante;
  }
  return compararTexto(a.id, b.id);
}

// A tabela vigente: o MÁXIMO, entre os anexos do tipo "tabela", por (vale desde ?? data de envio,
// criado_em, id). Catálogo, nota e outro nunca viram a vigente; sem tabela → `null`. Um "vale desde" no
// futuro segue a regra literal (D-09): se for o mais recente, é a vigente.
export function tabelaVigente<T extends AnexoParaVigencia>(anexos: readonly T[]): T | null {
  let vigente: T | null = null;
  for (const anexo of anexos) {
    if (anexo.tipo !== "tabela") {
      continue;
    }
    if (vigente === null || compararVigencia(anexo, vigente) > 0) {
      vigente = anexo;
    }
  }
  return vigente;
}

// O selo da vigente: "velha" quando passaram MAIS de 120 dias civis da referência até hoje; senão
// "recente" — inclusive com a referência no futuro (D-09: a conta dá negativo).
export function seloDaTabela(
  vigente: Pick<AnexoParaVigencia, "valeDesde" | "enviadoEm">,
  hoje: string,
): SeloDaTabela {
  return diasEntre(referenciaDaTabela(vigente), hoje) > DIAS_PARA_TABELA_VELHA ? "velha" : "recente";
}

// O que muda na ficha ao tirar o anexo `id` (o corpo da confirmação): se ele é a vigente e há outra
// tabela, qual passa a valer; se é a vigente e a única, a ficha fica sem tabela; em qualquer outro caso
// (catálogo, nota, outro, uma tabela que não é a vigente, ou um id que não está na lista), nada muda.
export function efeitoDeTirar(anexos: readonly AnexoParaVigencia[], id: string): EfeitoDeTirar {
  const vigente = tabelaVigente(anexos);
  if (vigente === null || vigente.id !== id) {
    return { caso: "comum" };
  }
  const anterior = tabelaVigente(anexos.filter((anexo) => anexo.id !== id));
  if (anterior === null) {
    return { caso: "unica-tabela" };
  }
  return { caso: "vigente-com-anterior", anterior: anterior.nome };
}
