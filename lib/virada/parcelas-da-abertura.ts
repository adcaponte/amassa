// Módulo de USO ÚNICO (04.4-04-PLAN.md, Tarefa 1): existe só para a virada — o dia em que as
// parcelas ainda em aberto da Abertura do Espaço viram contas a pagar no Financeiro (briefing §7)
// — e sai junto com o código da Abertura quando o módulo for desmontado (Roteiro 8,
// `docs/operacao/08-remover-abertura-do-espaco.md`).
//
// Este é o ÚNICO lugar do repositório fora de `lib/abertura` que importa `lib/abertura/
// parcelas.ts`, e o faz por caminho relativo (nunca `@/lib/abertura`) — a mesma disciplina que
// isola `lib/financeiro/` da Abertura (nenhuma chave estrangeira, nenhum import): quando a
// Abertura sair, só este módulo, o script da virada e as funções de prova correspondentes em
// `scripts/testar-migracoes.mjs` saem com ela.
//
// Zero import de React, Next, `drizzle-orm`, `pg` ou do cliente do banco — módulo puro, testado
// sem banco.
import { calcularParcelas, type ItemParaCalculo, type Parcela } from "../abertura/parcelas";

// Redeclarado como literais, nunca importado de `db/schema.ts` (traria `drizzle-orm` e o cliente
// do banco para dentro de um módulo puro) — mesma disciplina de `lib/cadastros/categorias.ts`.
export type CategoriaDaAbertura =
  | "moveis"
  | "equipamentos"
  | "material"
  | "utensilios"
  | "obra"
  | "outros";

// O mínimo que a Abertura precisa entregar para a virada calcular o plano — `ItemParaCalculo`
// (valor, forma de pagamento, número de parcelas, primeira parcela) mais o que só a virada usa:
// identidade, categoria (para decidir a categoria de destino no Financeiro) e a marca de
// resolvido (só para o ensaio mostrar, nunca muda a regra).
export type ItemDaAberturaParaVirada = ItemParaCalculo & {
  id: string;
  nome: string;
  categoria: CategoriaDaAbertura;
  resolvido: boolean;
};

export type ParcelaInteira = {
  numero: number;
  de: number;
  vencimentoEm: string;
  valorEmCentavos: number;
};

// `calcularParcelas` (lib/abertura/parcelas.ts) devolve o QUOCIENTE EXATO de ponto flutuante,
// telescopado para somar exatamente ao total — de propósito, porque a Abertura só EXIBE o valor
// já arredondado por `formatarReais` (arredonda uma vez, no fim). A virada precisa GRAVAR um
// valor inteiro de centavos por parcela, e arredondar cada parcela de forma independente
// quebraria a soma (ex.: 33333,333 e 33333,334 e 33333,333 arredondados soltos dão 99999, não
// 100000). Por isso este módulo acumula o PREFIXO de ponto flutuante que `calcularParcelas` já
// produz, arredonda CADA PREFIXO (nunca a parcela isolada) e devolve as diferenças entre
// prefixos consecutivos — a mesma técnica de telescopagem de `calcularParcelas`, uma camada
// acima, garantindo que a soma das parcelas INTEIRAS feche exatamente com o valor do item.
export function parcelasInteirasDoItem(item: ItemParaCalculo): ParcelaInteira[] {
  const parcelasEmPontoFlutuante: readonly Parcela[] = calcularParcelas(item);

  let prefixoFlutuante = 0;
  let prefixoArredondadoAnterior = 0;

  return parcelasEmPontoFlutuante.map((parcela) => {
    prefixoFlutuante += parcela.valorEmCentavos;
    const prefixoArredondado = Math.round(prefixoFlutuante);
    const valorEmCentavos = prefixoArredondado - prefixoArredondadoAnterior;
    prefixoArredondadoAnterior = prefixoArredondado;

    return {
      numero: parcela.numero,
      de: parcela.de,
      vencimentoEm: parcela.vencimentoEm,
      valorEmCentavos,
    };
  });
}

export type ParcelaPlanejada = {
  numero: number;
  vencimento: string;
  valorCentavos: number;
  forma: "pix";
  // "7 de 10" — o rótulo de origem da Abertura (D-chave desta fase). `null` quando o item era à
  // vista (uma parcela só, sem fração para mostrar) — mesma regra de `calcularParcelas`/
  // `fluxoMensal` em `lib/abertura/parcelas.ts` ("de === 1 nunca vira '1/1'").
  rotulo: string | null;
};

export type DocumentoPlanejado = {
  itemId: string;
  nome: string;
  categoriaAbertura: CategoriaDaAbertura;
  // Id da categoria do FINANCEIRO (material ou demais) já resolvida — quem chama
  // `planejarImportacao` decide o id de cada uma (`--categoria-material`/`--categoria-demais` no
  // script); esta função só decide QUAL das duas usar por item.
  categoriaFinanceiraId: string;
  // A data da COMPRA (a primeira parcela ORIGINAL do item na Abertura) — suposição 2 do plano:
  // o briefing manda compra de material contar no mês da compra, não no mês da primeira parcela
  // ainda em aberto.
  data: string;
  // Soma das parcelas PLANEJADAS (só as em aberto) — nunca o valor total do item quando parte
  // dele já foi paga antes da virada.
  valorCentavos: number;
  resolvido: boolean;
  chaveDeImportacao: string;
  parcelas: ParcelaPlanejada[];
};

export type ItemIgnorado = {
  itemId: string;
  nome: string;
  motivo: string;
};

export type PlanoDeImportacao = {
  documentos: DocumentoPlanejado[];
  ignorados: ItemIgnorado[];
};

function ehPrimeiroDiaDoMes(dataIso: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(dataIso);
}

// A ÚNICA função que decide TUDO (key_links do plano): quais itens entram, quais parcelas de
// cada um ficam de fora (já pagas antes da virada), os valores inteiros, os rótulos e a
// categoria de destino. O script da virada só lê a Abertura, chama esta função, imprime o plano
// (ensaio) e grava exatamente o que foi impresso (aplicação) — os dois nunca divergem porque os
// dois partem do mesmo `PlanoDeImportacao`.
export function planejarImportacao(parametros: {
  itens: readonly ItemDaAberturaParaVirada[];
  dataDaVirada: string;
  categoriaMaterialId: string;
  categoriaDemaisId: string;
}): PlanoDeImportacao {
  const { itens, dataDaVirada, categoriaMaterialId, categoriaDemaisId } = parametros;

  if (!ehPrimeiroDiaDoMes(dataDaVirada)) {
    throw new Error(
      `A data da virada precisa ser o primeiro dia de um mês (formato AAAA-MM-01) — veio "${dataDaVirada}".`,
    );
  }

  const documentos: DocumentoPlanejado[] = [];
  const ignorados: ItemIgnorado[] = [];

  for (const item of itens) {
    const todasAsParcelas = parcelasInteirasDoItem(item);
    const parcelasEmAberto = todasAsParcelas.filter(
      (parcela) => parcela.vencimentoEm >= dataDaVirada,
    );

    if (parcelasEmAberto.length === 0) {
      ignorados.push({ itemId: item.id, nome: item.nome, motivo: "já quitado antes da virada" });
      continue;
    }

    const categoriaFinanceiraId =
      item.categoria === "material" ? categoriaMaterialId : categoriaDemaisId;

    documentos.push({
      itemId: item.id,
      nome: item.nome,
      categoriaAbertura: item.categoria,
      categoriaFinanceiraId,
      data: item.primeiraParcelaEm,
      valorCentavos: parcelasEmAberto.reduce((total, parcela) => total + parcela.valorEmCentavos, 0),
      resolvido: item.resolvido,
      chaveDeImportacao: `abertura:${item.id}`,
      parcelas: parcelasEmAberto.map((parcela, indice) => ({
        numero: indice + 1,
        vencimento: parcela.vencimentoEm,
        valorCentavos: parcela.valorEmCentavos,
        forma: "pix",
        rotulo: parcela.de > 1 ? `${parcela.numero} de ${parcela.de}` : null,
      })),
    });
  }

  return { documentos, ignorados };
}
