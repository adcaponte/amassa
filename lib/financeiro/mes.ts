// Módulo puro (D-15 do projeto): a régua do mês — "quanto cada área deixou", o Geral num bloco só
// (sem rateio, sem "nível de custo"), a taxa do cartão, a linha de diferença (D-02), o veredito
// "sobrou/faltou", o dinheiro que se mexeu e o fora do resultado. Mesmo espírito de
// fluxoMensal (o resumo mensal da Abertura): só o irmão de taxa deste mesmo diretório (também
// puro) é importado — nenhuma biblioteca de UI, nenhum driver de banco nem cliente de dados, e
// nenhuma instância de data-hora (mês é sempre um recorte "AAAA-MM" e data civil "AAAA-MM-DD"
// comparados como texto).
//
// Documentos e parcelas pagas chegam em DUAS listas separadas (key_link do 04.4-09-PLAN.md): a
// primeira pela DATA DO DOCUMENTO ("Vendeu"/"Custou"/Geral/Fora), a segunda pela DATA DE PAGAMENTO
// ("Dinheiro que se mexeu" e a "Taxa do cartão") — são as duas réguas do BRIEFING §5, e este
// módulo nunca as mistura numa lista só. As duas são filtradas AQUI por `mes` e por "não
// cancelado" (nunca confiadas cegas de quem chama) — o mesmo cuidado do módulo do extrato deste
// mesmo diretório com o campo `cancelado`, e o que torna "documento cancelado não entra em
// nada"/"dia 31 conta, dia 1 do mês seguinte não" provável em teste unitário, sem banco.
import { liquidoDaParcela, taxaEmCentavos, type TipoDeDocumentoParaTaxa } from "@/lib/financeiro/taxa";

export type GrupoDeCategoriaDoMes = "receita" | "custo" | "geral" | "fora";
export type AreaDoMes = "cafeteria" | "espaco" | "pecas" | "loja" | "geral";

export type LinhaDeDocumentoParaMes = {
  grupo: GrupoDeCategoriaDoMes;
  area: AreaDoMes;
  categoriaNome: string;
  // O valor da LINHA (já com desconto, nunca preço unitário — mesma convenção de
  // `documento_linhas.valor_centavos`); sempre >= 0, EXCETO a linha de diferença (D-01/D-02), que
  // pode ser negativa (recebeu/pagou a menos).
  valorCentavos: number;
};

export type DocumentoParaMes = {
  // Data civil "AAAA-MM-DD" do DOCUMENTO — "Vendeu"/"Custou" contam por ela (BRIEFING §5).
  data: string;
  tipo: TipoDeDocumentoParaTaxa;
  cancelado: boolean;
  linhas: readonly LinhaDeDocumentoParaMes[];
};

export type ParcelaPagaParaMes = {
  // Data civil "AAAA-MM-DD" de PAGAMENTO — "Dinheiro que se mexeu" e a taxa do cartão contam por
  // ela, nunca pela data do documento (BRIEFING §5, os "dois quadros separados de propósito").
  pagoEm: string;
  tipo: TipoDeDocumentoParaTaxa;
  cancelado: boolean;
  forma: "dinheiro" | "pix" | "cartao";
  valorCentavos: number;
  // Congelada só em venda paga no cartão (lib/financeiro/taxa.ts) — nula em qualquer outro caso.
  taxaPontosBase?: number | null;
};

export type LinhaNomeadaDoMes = { nome: string; valorCentavos: number };

export type AreaDoMesResumo = {
  area: AreaDoMes;
  vendeuCentavos: number;
  custouCentavos: number;
  deixouCentavos: number;
};

export type VeredictoDoMes = "sobrou" | "faltou";

export type ResumoDoMes = {
  // Sempre as 4 áreas de verdade, na ordem fixa — nunca omitidas mesmo com R$ 0,00 (partial do
  // UI-SPEC: "as 4 áreas aparecem sempre, na ordem fixa").
  areas: AreaDoMesResumo[];
  vendeuTotalCentavos: number;
  custouTotalCentavos: number;
  deixouTotalCentavos: number;
  // Ordenado por nome, com "Taxa do cartão" sempre por último (artefato do plano) — vazio quando
  // nenhum custo geral foi lançado no mês.
  geral: LinhaNomeadaDoMes[];
  geralTotalCentavos: number;
  veredicto: VeredictoDoMes;
  // Sempre >= 0 — "Sobrou {resultado}"/"Faltaram {resultado}" (o sinal já está em `veredicto`).
  resultadoCentavos: number;
  // "Dinheiro que se mexeu" (BRIEFING §5): líquido das parcelas de venda pagas no mês / cheio das
  // parcelas de despesa pagas no mês — pela DATA DE PAGAMENTO, nunca pela do documento.
  entrouCentavos: number;
  saiuCentavos: number;
  // Ordenado por nome, com o PRÓPRIO sinal (nunca invertido, ao contrário do Geral) — vazio
  // quando nada do grupo `fora` foi lançado no mês.
  fora: LinhaNomeadaDoMes[];
};

// As quatro áreas de verdade, na ordem fixa do resto do sistema — "Geral" nunca aparece nesta
// tabela (a área "geral" só existe para as categorias dos grupos `geral`/`fora`).
const AREAS_DE_VERDADE: readonly AreaDoMes[] = ["cafeteria", "espaco", "pecas", "loja"];

const NOME_TAXA_DO_CARTAO = "Taxa do cartão";

function ordenarPorNomeComTaxaPorUltimo(linhas: LinhaNomeadaDoMes[]): LinhaNomeadaDoMes[] {
  return [...linhas].sort((a, b) => {
    if (a.nome === NOME_TAXA_DO_CARTAO) return 1;
    if (b.nome === NOME_TAXA_DO_CARTAO) return -1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function resumoDoMes({
  mes,
  documentos,
  parcelasPagas,
}: {
  mes: string;
  documentos: readonly DocumentoParaMes[];
  parcelasPagas: readonly ParcelaPagaParaMes[];
}): ResumoDoMes {
  const documentosDoMes = documentos.filter(
    (documento) => !documento.cancelado && documento.data.slice(0, 7) === mes,
  );
  const parcelasDoMes = parcelasPagas.filter(
    (parcela) => !parcela.cancelado && parcela.pagoEm.slice(0, 7) === mes,
  );

  const porArea = new Map<AreaDoMes, { vendeuCentavos: number; custouCentavos: number }>();
  for (const area of AREAS_DE_VERDADE) {
    porArea.set(area, { vendeuCentavos: 0, custouCentavos: 0 });
  }
  const geralPorNome = new Map<string, number>();
  const foraPorNome = new Map<string, number>();

  for (const documento of documentosDoMes) {
    for (const linha of documento.linhas) {
      // A ÚNICA regra de sinal do módulo: o valor da linha com o sinal do TIPO do documento
      // (venda soma, despesa subtrai) — cobre venda, despesa e as quatro combinações da linha de
      // diferença (D-02) sem nenhum caso especial por categoria.
      const valorComSinal = documento.tipo === "venda" ? linha.valorCentavos : -linha.valorCentavos;

      if (linha.grupo === "receita") {
        const atual = porArea.get(linha.area) ?? { vendeuCentavos: 0, custouCentavos: 0 };
        atual.vendeuCentavos += valorComSinal;
        porArea.set(linha.area, atual);
      } else if (linha.grupo === "custo") {
        const atual = porArea.get(linha.area) ?? { vendeuCentavos: 0, custouCentavos: 0 };
        atual.custouCentavos += -valorComSinal;
        porArea.set(linha.area, atual);
      } else if (linha.grupo === "geral") {
        geralPorNome.set(linha.categoriaNome, (geralPorNome.get(linha.categoriaNome) ?? 0) + -valorComSinal);
      } else {
        // grupo "fora": soma com o PRÓPRIO sinal — nunca invertido (mexe no caixa, mas não é
        // custo nem receita da casa).
        foraPorNome.set(linha.categoriaNome, (foraPorNome.get(linha.categoriaNome) ?? 0) + valorComSinal);
      }
    }
  }

  let entrouCentavos = 0;
  let saiuCentavos = 0;
  let taxaDoCartaoCentavos = 0;
  for (const parcela of parcelasDoMes) {
    if (parcela.tipo === "venda") {
      entrouCentavos += liquidoDaParcela({
        tipo: "venda",
        valorCentavos: parcela.valorCentavos,
        taxaPontosBase: parcela.taxaPontosBase,
      });
      if (parcela.forma === "cartao" && parcela.taxaPontosBase) {
        taxaDoCartaoCentavos += taxaEmCentavos(parcela.valorCentavos, parcela.taxaPontosBase);
      }
    } else {
      saiuCentavos += parcela.valorCentavos;
    }
  }
  if (taxaDoCartaoCentavos > 0) {
    geralPorNome.set(NOME_TAXA_DO_CARTAO, (geralPorNome.get(NOME_TAXA_DO_CARTAO) ?? 0) + taxaDoCartaoCentavos);
  }

  const areas: AreaDoMesResumo[] = AREAS_DE_VERDADE.map((area) => {
    const valores = porArea.get(area) ?? { vendeuCentavos: 0, custouCentavos: 0 };
    return {
      area,
      vendeuCentavos: valores.vendeuCentavos,
      custouCentavos: valores.custouCentavos,
      deixouCentavos: valores.vendeuCentavos - valores.custouCentavos,
    };
  });

  const vendeuTotalCentavos = areas.reduce((total, area) => total + area.vendeuCentavos, 0);
  const custouTotalCentavos = areas.reduce((total, area) => total + area.custouCentavos, 0);
  const deixouTotalCentavos = areas.reduce((total, area) => total + area.deixouCentavos, 0);

  const geral = ordenarPorNomeComTaxaPorUltimo(
    [...geralPorNome.entries()].map(([nome, valorCentavos]) => ({ nome, valorCentavos })),
  );
  const geralTotalCentavos = geral.reduce((total, linha) => total + linha.valorCentavos, 0);

  const fora = [...foraPorNome.entries()]
    .map(([nome, valorCentavos]) => ({ nome, valorCentavos }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const diferenca = deixouTotalCentavos - geralTotalCentavos;
  const veredicto: VeredictoDoMes = diferenca >= 0 ? "sobrou" : "faltou";

  return {
    areas,
    vendeuTotalCentavos,
    custouTotalCentavos,
    deixouTotalCentavos,
    geral,
    geralTotalCentavos,
    veredicto,
    resultadoCentavos: Math.abs(diferenca),
    entrouCentavos,
    saiuCentavos,
    fora,
  };
}

// Percentual (0-100) de uma barra da régua "As áreas pagam a casa?" (protótipo `telaMes`):
// relativo a `max(deixouTotal, geral, 1)` — o piso de 1 evita divisão por zero num mês totalmente
// vazio; negativo vira 0% (uma área que deixou negativo não desenha barra para trás).
export function larguraDaRegua(
  valorCentavos: number,
  deixouTotalCentavos: number,
  geralTotalCentavos: number,
): number {
  const escala = Math.max(deixouTotalCentavos, geralTotalCentavos, 1);
  return (Math.max(0, valorCentavos) / escala) * 100;
}
