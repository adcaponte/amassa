// Módulo puro: recebe dados, devolve dados. "hoje" nunca é lido do relógio por dentro, entra
// sempre por argumento como string `YYYY-MM-DD`. É a regra de negócio deste módulo: parcelas são
// CALCULADAS, nunca armazenadas linha a linha (D-05) — guarda-se valor total, número de parcelas
// e a data da primeira; as demais são derivadas daqui a cada leitura.
//
// Nenhuma instância de `Date` entra em conta nenhuma — a aritmética de calendário é toda
// inteira, replicada de `lib/encomendas/cronograma.ts` (não importada: são módulos de domínios
// diferentes, e `cronograma.ts` continua sendo a fonte única da cascata de Encomendas).
//
// Plano 04.2-04 (Tarefas 1/2): `resumoDoPainel` reusa `contarEntregasVencidas`/`urgenciaDaTarefa`
// de `lib/abertura/prazos.ts` em vez de reescrever as duas regras de tarefas/entregas aqui — a
// mesma razão de `fluxoMensal` nunca ter uma segunda soma por mês em outro lugar. Isso cria uma
// referência CIRCULAR deliberada com `prazos.ts` (que importa `diferencaEmDias` daqui): segura
// porque os dois lados só usam as importações DENTRO de corpos de função, nunca no topo do
// módulo — nenhuma das duas execuções acontece antes de as duas ligações (bindings) do ES module
// já estarem resolvidas.
import { contarEntregasVencidas, urgenciaDaTarefa, type ItemParaEntrega } from "./prazos";

// Dias desde 1970-01-01 (proléptico gregoriano), a partir de ano/mês/dia civis. Algoritmo de
// calendário puro (Howard Hinnant, "days_from_civil") — nenhuma instância de `Date` entra nesta
// conta, só inteiros, o que evita qualquer deslocamento de fuso.
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

// Inverso de `diasDesdeAEpoca`: de um número de dias desde a época devolve `{ano, mes, dia}`
// civis. Mesmo algoritmo ("civil_from_days"), mesma ausência de `Date`.
function civilDesdeDias(diasDesdeEpoca: number): { ano: number; mes: number; dia: number } {
  const z = diasDesdeEpoca + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const diaDoEra = z - era * 146097;
  const anoDoEra = Math.floor(
    (diaDoEra -
      Math.floor(diaDoEra / 1460) +
      Math.floor(diaDoEra / 36524) -
      Math.floor(diaDoEra / 146096)) /
      365,
  );
  const anoAjustado = anoDoEra + era * 400;
  const diaDoAno = diaDoEra - (365 * anoDoEra + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100));
  const mesProvisorio = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mesProvisorio + 2) / 5) + 1;
  const mes = mesProvisorio + (mesProvisorio < 10 ? 3 : -9);
  const ano = mes <= 2 ? anoAjustado + 1 : anoAjustado;
  return { ano, mes, dia };
}

function formatarDataCivil(ano: number, mes: number, dia: number): string {
  const anoTexto = String(ano).padStart(4, "0");
  const mesTexto = String(mes).padStart(2, "0");
  const diaTexto = String(dia).padStart(2, "0");
  return `${anoTexto}-${mesTexto}-${diaTexto}`;
}

// Diferença em dias inteiros entre duas datas civis `YYYY-MM-DD` — `dataMaisTarde` menos
// `dataMaisCedo`. Exportada: `lib/abertura/prazos.ts` do plano 02 importa daqui em vez de
// escrever uma terceira cópia (a segunda já vive em `lib/encomendas/cronograma.ts`).
export function diferencaEmDias(dataMaisTarde: string, dataMaisCedo: string): number {
  const [anoA, mesA, diaA] = dataMaisTarde.split("-").map(Number);
  const [anoB, mesB, diaB] = dataMaisCedo.split("-").map(Number);
  return diasDesdeAEpoca(anoA, mesA, diaA) - diasDesdeAEpoca(anoB, mesB, diaB);
}

// Soma `dias` dias de calendário (pode ser negativo) a uma data civil `YYYY-MM-DD`, devolvendo
// outra data civil `YYYY-MM-DD`. Exportada pela mesma razão de `diferencaEmDias` acima.
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const diasDesdeEpocaDaEntrada = diasDesdeAEpoca(ano, mes, dia);
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(
    diasDesdeEpocaDaEntrada + dias,
  );
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// Último dia do mês (28/29/30/31) — ano bissexto pela regra completa: divisível por 4, exceto
// século não divisível por 400 (2000 é bissexto, 1900 e 2100 não são).
export function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return bissexto ? 29 : 28;
  }
  if (mes === 4 || mes === 6 || mes === 9 || mes === 11) {
    return 30;
  }
  return 31;
}

// Soma `meses` meses inteiros a uma data civil `YYYY-MM-DD` — a regra de D-19, já decidida pelo
// dono em 2026-08-30 (04.2-CONTEXT.md): parcela cujo dia não existe no mês de destino cai no
// ÚLTIMO DIA daquele mês (31/01 → 28/02 → 31/03 → 30/04), e o dia original volta nos meses que o
// comportam. A soma acontece pelo ÍNDICE ABSOLUTO de mês (`ano*12 + (mes-1)`), nunca por
// encadeamento a partir da data anterior — é o que faz a virada de ano sair de graça, sem `Date`,
// e é o que impede o defeito clássico do dia 31: encadear a partir da parcela anterior prenderia
// a terceira parcela em 28/03 em vez de voltar para 31/03 (o mês de destino é sempre calculado a
// partir da PRIMEIRA data, nunca da anterior).
export function somarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const indiceAbsoluto = ano * 12 + (mes - 1) + meses;
  const anoSaida = Math.floor(indiceAbsoluto / 12);
  const mesSaida = indiceAbsoluto - anoSaida * 12 + 1;
  const ultimoDia = ultimoDiaDoMes(anoSaida, mesSaida);
  const diaSaida = Math.min(dia, ultimoDia);
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// Os 7 primeiros caracteres de uma data civil `YYYY-MM-DD` — a chave `YYYY-MM` que agrupa
// parcelas de meses diferentes na visão "Por mês" (plano 04).
export function chaveDoMes(dataIso: string): string {
  return dataIso.slice(0, 7);
}

// A chave do mês seguinte, com virada de ano — nunca somando 1 ao número do mês sem tratar
// dezembro (dezembro + 1 = janeiro do ano seguinte, não "mês 13").
export function proximoMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  const indiceAbsoluto = ano * 12 + (mes - 1) + 1;
  const anoSaida = Math.floor(indiceAbsoluto / 12);
  const mesSaida = indiceAbsoluto - anoSaida * 12 + 1;
  return `${String(anoSaida).padStart(4, "0")}-${String(mesSaida).padStart(2, "0")}`;
}

// Estrutura mínima que `calcularParcelas`/`totaisComprometidos` precisam — NÃO o tipo inferido
// do Drizzle: este módulo não conhece o banco (`db/schema.ts` não é importado aqui).
export type ItemParaCalculo = {
  valorEmCentavos: number;
  formaPagamento: "vista" | "prazo";
  parcelas: number;
  primeiraParcelaEm: string;
};

export type Parcela = {
  numero: number;
  de: number;
  vencimentoEm: string;
  valorEmCentavos: number;
};

// A fonte única da data e do valor de toda parcela do módulo (D-05) — o painel, a linha do item
// e a visão por mês (planos 03 e 04) leem daqui, nunca recalculam. Para `formaPagamento ===
// "vista"`, uma parcela só, no dia de `primeiraParcelaEm` (D-06). Para `"prazo"`, `n = parcelas`
// entradas, a k-ésima em `somarMeses(primeiraParcelaEm, k)` com k de 0 a n-1 — SEMPRE a partir
// da primeira data, nunca da parcela anterior (ver o comentário de `somarMeses` acima).
//
// `valorEmCentavos` de cada parcela é o QUOCIENTE EXATO, sem arredondar — D-06 manda parcelas de
// valor igual, e arredondar aqui produziria ou parcelas desiguais (a última quebrada, proibida)
// ou uma soma que não fecha com o total. O arredondamento acontece UMA ÚNICA VEZ, em
// `formatarReais` (`lib/abertura/formato.ts`). Não "consertar" isto para arredondar aqui — é o
// ponto que este comentário existe para proteger.
//
// A conta usa PREFIXO TELESCÓPICO (`(k+1)*total/n` menos o prefixo anterior), não
// `total/n` repetido `n` vezes: a divisão de ponto flutuante de uma dízima (R$ 100 em 3 vezes,
// por exemplo) não fecha exatamente quando o mesmo quociente é somado `n` vezes — o resto de
// arredondamento de cada soma se acumula e a soma final erra por uma fração de centavo
// invisível. O prefixo telescópico cancela esse resto: cada parcela é a diferença entre dois
// prefixos calculados de forma independente (nunca por acúmulo), e a soma de todas as diferenças
// telescopa exatamente para `total - 0 = total`, verificado nos casos deste módulo e do teste de
// bordas (Tarefa 3). As parcelas continuam "iguais" entre si a menos de um erro de ponto
// flutuante muito menor que um centavo — invisível depois de `formatarReais` arredondar.
export function calcularParcelas(item: ItemParaCalculo): Parcela[] {
  if (item.formaPagamento === "vista") {
    return [
      {
        numero: 1,
        de: 1,
        vencimentoEm: item.primeiraParcelaEm,
        valorEmCentavos: item.valorEmCentavos,
      },
    ];
  }

  const n = item.parcelas;
  const parcelas: Parcela[] = [];
  let prefixoAnterior = 0;
  for (let k = 0; k < n; k++) {
    const prefixoAtual = ((k + 1) * item.valorEmCentavos) / n;
    parcelas.push({
      numero: k + 1,
      de: n,
      vencimentoEm: somarMeses(item.primeiraParcelaEm, k),
      valorEmCentavos: prefixoAtual - prefixoAnterior,
    });
    prefixoAnterior = prefixoAtual;
  }
  return parcelas;
}

export type ProximaParcela = { tipo: "proxima" | "ultima"; parcela: Parcela };

// A parcela que a linha do item mostra ("próxima 10/11" ou "última 10/02", copiado do
// protótipo): a primeira com `vencimentoEm >= hoje`, e se nenhuma satisfizer (todas já
// passaram), a última. NENHUMA parcela é filtrada por já ter passado — `calcularParcelas`
// sempre devolve todas; só esta função decide qual destacar.
export function proximaParcela(parcelas: readonly Parcela[], hoje: string): ProximaParcela {
  const proxima = parcelas.find((parcela) => parcela.vencimentoEm >= hoje);
  if (proxima) {
    return { tipo: "proxima", parcela: proxima };
  }
  return { tipo: "ultima", parcela: parcelas[parcelas.length - 1] };
}

export type TotaisComprometidos = {
  comprometidoEmCentavos: number;
  aVistaEmCentavos: number;
  aPrazoEmCentavos: number;
};

// O bloco "Comprometido" do painel (D-15) — separa à vista de a prazo pelo VALOR TOTAL do item
// (nunca soma de parcela: à vista e a prazo já são os dois grupos que o painel precisa).
export function totaisComprometidos(itens: readonly ItemParaCalculo[]): TotaisComprometidos {
  let aVistaEmCentavos = 0;
  let aPrazoEmCentavos = 0;

  for (const item of itens) {
    if (item.formaPagamento === "vista") {
      aVistaEmCentavos += item.valorEmCentavos;
    } else {
      aPrazoEmCentavos += item.valorEmCentavos;
    }
  }

  return {
    comprometidoEmCentavos: aVistaEmCentavos + aPrazoEmCentavos,
    aVistaEmCentavos,
    aPrazoEmCentavos,
  };
}

// `ItemParaCalculo` MAIS o nome — o mínimo que a visão "Por mês" (D-16) precisa para rotular a
// composição de cada mês. `ItemDaAbertura` (`lib/abertura/consultas.ts`) já satisfaz este tipo
// estruturalmente (tem todos estes campos e mais), então a página passa o mesmo vetor de itens
// direto, sem remapear.
export type ItemParaFluxo = ItemParaCalculo & { nome: string };

export type ComposicaoDoMes = { rotulo: string; valorEmCentavos: number };

export type MesDoFluxo = {
  chave: string;
  totalEmCentavos: number;
  composicao: ComposicaoDoMes[];
  ehMesAtual: boolean;
  ehPassado: boolean;
  ehPico: boolean;
  percentualDoPico: number;
};

// A visão "Por mês" (D-16, a mais valiosa e a mais fácil de fazer errado): soma TODAS as
// parcelas de TODOS os itens no mês certo, incluindo as que já venceram — a visão é do fluxo
// inteiro, não só do que falta. Chama `calcularParcelas` — a MESMA função que a linha do item usa
// (`lista-itens.tsx`) — nunca uma segunda implementação da conta de parcela.
//
// O rótulo da composição é o nome do item, com "· k/n" só quando `n > 1` (`de === 1` nunca vira
// "1/1" — um item à vista não tem fração para mostrar). O total do mês é a SOMA EXATA dos valores
// das parcelas, em centavos, sem arredondar — o arredondamento só acontece em `formatarReais`; se
// acontecesse aqui, a soma dos meses deixaria de bater com o total comprometido do painel, e os
// dois números do topo passariam a se contradizer na mesma tela (a mesma invariante protegida no
// comentário de `calcularParcelas` acima).
//
// EMPATE NO TOPO (decisão desta função, coberta em teste): quando dois ou mais meses empatam no
// valor máximo, TODOS são marcados `ehPico`. A alternativa (marcar só o primeiro) faria o
// resultado depender da ordem de iteração — e um mês "quase pico" que na real empata com o pico
// ficaria mostrando "99% do mês mais pesado" ao lado de outro com o MESMO valor chamado de "o"
// mais pesado, o que é incoerente. Marcar os dois é a leitura que não engana.
//
// Com UM mês só, `ehPico` é sempre falso — um mês sozinho não se compara com nada, e chamá-lo de
// "mais pesado" seria ruído, não informação. Lista vazia devolve vetor vazio ANTES de qualquer
// divisão pelo pico (não há pico para dividir).
export function fluxoMensal(itens: readonly ItemParaFluxo[], hoje: string): MesDoFluxo[] {
  const mapa = new Map<string, { totalEmCentavos: number; composicao: ComposicaoDoMes[] }>();

  for (const item of itens) {
    const parcelas = calcularParcelas(item);
    for (const parcela of parcelas) {
      const chave = chaveDoMes(parcela.vencimentoEm);
      const mes = mapa.get(chave) ?? { totalEmCentavos: 0, composicao: [] };
      mes.totalEmCentavos += parcela.valorEmCentavos;
      mes.composicao.push({
        rotulo: parcela.de > 1 ? `${item.nome} · ${parcela.numero}/${parcela.de}` : item.nome,
        valorEmCentavos: parcela.valorEmCentavos,
      });
      mapa.set(chave, mes);
    }
  }

  const chaves = [...mapa.keys()].sort();
  if (chaves.length === 0) {
    return [];
  }

  const pico = Math.max(...chaves.map((chave) => mapa.get(chave)!.totalEmCentavos));
  const mesAtual = chaveDoMes(hoje);

  return chaves.map((chave) => {
    const { totalEmCentavos, composicao } = mapa.get(chave)!;
    const ehPico = chaves.length > 1 && totalEmCentavos === pico;

    return {
      chave,
      totalEmCentavos,
      composicao,
      ehMesAtual: chave === mesAtual,
      ehPassado: chave < mesAtual,
      ehPico,
      percentualDoPico: Math.round((totalEmCentavos / pico) * 100),
    };
  });
}

export type ItemParaResumoDoPainel = ItemParaFluxo & ItemParaEntrega;

export type TarefaParaResumoDoPainel = {
  concluida: boolean;
  prazoEm: string;
};

export type ResumoDoPainel = {
  comprometidoEmCentavos: number;
  aVistaEmCentavos: number;
  aPrazoEmCentavos: number;
  saiNesteMesEmCentavos: number;
  saiNoProximoMesEmCentavos: number;
  tarefasAtrasadas: number;
  entregasVencidas: number;
  precisamDeAtencao: number;
};

// Os TRÊS blocos do painel (D-15/ABE-12). Os dois valores mensais saem de `fluxoMensal` — A
// MESMA FUNÇÃO da visão "Por mês" acima, procurando a chave de `hoje` e a de `proximoMes(chave)`
// no vetor que ela devolve. Nunca uma segunda soma por mês aqui: duas somas com a mesma intenção
// divergem na primeira mudança, e o número do topo passaria a contradizer a lista de baixo na
// mesma tela. `proximoMes` é o que faz dezembro virar janeiro do ano seguinte — somar 1 ao número
// do mês produziria o mês 13 e um bloco em branco todo mês de dezembro.
//
// `entregasVencidas` reusa `contarEntregasVencidas` e `tarefasAtrasadas` reusa a classificação de
// `urgenciaDaTarefa` (`lib/abertura/prazos.ts`) — nenhuma das duas regras é reescrita aqui.
export function resumoDoPainel(
  itens: readonly ItemParaResumoDoPainel[],
  tarefas: readonly TarefaParaResumoDoPainel[],
  hoje: string,
): ResumoDoPainel {
  const totais = totaisComprometidos(itens);
  const meses = fluxoMensal(itens, hoje);
  const chaveHoje = chaveDoMes(hoje);
  const chaveProximo = proximoMes(chaveHoje);

  const mesAtual = meses.find((mes) => mes.chave === chaveHoje);
  const mesProximo = meses.find((mes) => mes.chave === chaveProximo);

  const tarefasAtrasadas = tarefas.filter(
    (tarefa) => urgenciaDaTarefa(tarefa, hoje).tipo === "atrasada",
  ).length;
  const entregasVencidas = contarEntregasVencidas(itens, hoje);

  return {
    comprometidoEmCentavos: totais.comprometidoEmCentavos,
    aVistaEmCentavos: totais.aVistaEmCentavos,
    aPrazoEmCentavos: totais.aPrazoEmCentavos,
    saiNesteMesEmCentavos: mesAtual?.totalEmCentavos ?? 0,
    saiNoProximoMesEmCentavos: mesProximo?.totalEmCentavos ?? 0,
    tarefasAtrasadas,
    entregasVencidas,
    precisamDeAtencao: tarefasAtrasadas + entregasVencidas,
  };
}
