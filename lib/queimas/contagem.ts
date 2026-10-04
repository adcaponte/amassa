// Módulo puro: recebe dados, devolve dados. Zero imports (regra de `lib/encomendas/cronograma.ts`
// / `lib/backup/frescor.ts`, CLAUDE.md §Regras de negócio) — sem React, sem cliente de banco, sem
// `date-fns`, nem `import type`. As regras da contagem opcional de uma queima (Fase 06.4, BRIEFING
// §2): seis contadores inteiros ≥ 0 — Internas P · M · G e Externas P · M · G — e "o forno saiu
// cheio" (marcado por padrão). Uma contagem com total 0 não existe: "sem contagem" é a AUSÊNCIA da
// linha em `queima_contagens`.
//
// O teto `TETO_DO_CONTADOR` é o MESMO dos checks `queima_contagens_*_faixa` da 0030 e de
// `esquemaContagem` (`lib/queimas/esquemas.ts`) — três cópias deliberadas; mudar uma é mudar todas.

export type Tamanho = "P" | "M" | "G";

export type Contagem = {
  internasP: number;
  internasM: number;
  internasG: number;
  externasP: number;
  externasM: number;
  externasG: number;
  saiuCheio: boolean;
};

export type ChaveDoContador =
  | "internasP"
  | "internasM"
  | "internasG"
  | "externasP"
  | "externasM"
  | "externasG";

// A folha abre com tudo zero e "saiu cheio" MARCADO (briefing §2: marcado por padrão).
export const CONTAGEM_VAZIA: Contagem = {
  internasP: 0,
  internasM: 0,
  internasG: 0,
  externasP: 0,
  externasM: 0,
  externasG: 0,
  saiuCheio: true,
};

export const TETO_DO_CONTADOR = 10000;

// Na ordem da folha: Internas P, M, G, depois Externas P, M, G.
export const CHAVES_DOS_CONTADORES: readonly ChaveDoContador[] = [
  "internasP",
  "internasM",
  "internasG",
  "externasP",
  "externasM",
  "externasG",
];

export function totalDasInternas(contagem: Contagem): number {
  return contagem.internasP + contagem.internasM + contagem.internasG;
}

export function totalDasExternas(contagem: Contagem): number {
  return contagem.externasP + contagem.externasM + contagem.externasG;
}

export function totalDaContagem(contagem: Contagem): number {
  return totalDasInternas(contagem) + totalDasExternas(contagem);
}

export function contagemVazia(contagem: Contagem): boolean {
  return totalDaContagem(contagem) === 0;
}

// O campo do contador só aceita dígitos, mas o valor que chega aqui pode ser qualquer coisa (campo
// vazio vira `NaN`): não-número → 0, abaixo de 0 → 0, acima do teto → teto, decimal → truncado.
export function limitarContador(valor: number): number {
  if (!Number.isFinite(valor)) {
    return 0;
  }
  const inteiro = Math.trunc(valor);
  if (inteiro < 0) {
    return 0;
  }
  return inteiro > TETO_DO_CONTADOR ? TETO_DO_CONTADOR : inteiro;
}

// "2026-12-18" → "18/12" — o dia civil já vem convertido para Brasília por quem chama
// (`diaCivilEmBrasilia`, `lib/queimas/formato.ts`).
export function diaMes(diaCivil: string): string {
  const [, mes, dia] = diaCivil.split("-");
  return `${dia}/${mes}`;
}

// ---------------------------------------------------------------------------------------------
// D-07 (decisão do dono, 04/10/2026): uma queima com externas pode ter VÁRIAS vendas, uma por
// pessoa, cada uma com a sua quantidade por tamanho (P · M · G) — nunca uma venda por peça como
// regra. O que está lançado é DERIVADO das vendas ligadas: só as ATIVAS (não canceladas) somam;
// uma venda cancelada no Caixa devolve a quantidade dela a "a cobrar" sem nada ser gravado (o
// princípio da D-08 da Agenda). O piso: a soma lançada em vendas ativas nunca passa das externas
// contadas, por tamanho — baixar a contagem abaixo do lançado é recusado (`abaixoDoLancado`).

export type Quantidades = { p: number; m: number; g: number };

export const QUANTIDADES_ZERADAS: Quantidades = { p: 0, m: 0, g: 0 };

// Uma venda ligada a uma queima, como as Queimas a enxergam: o número (para a frase), se o Caixa a
// cancelou, se está paga (nenhuma parcela em aberto) e a quantidade de cada tamanho que ela levou.
export type VendaLigada = {
  documentoId: string;
  numero: number;
  cancelada: boolean;
  paga: boolean;
  quantidades: Quantidades;
};

const TAMANHOS_EM_ORDEM: readonly { tamanho: Tamanho; chave: keyof Quantidades }[] = [
  { tamanho: "P", chave: "p" },
  { tamanho: "M", chave: "m" },
  { tamanho: "G", chave: "g" },
];

export function totalDasQuantidades(quantidades: Quantidades): number {
  return quantidades.p + quantidades.m + quantidades.g;
}

export function externasDaContagem(contagem: Contagem): Quantidades {
  return { p: contagem.externasP, m: contagem.externasM, g: contagem.externasG };
}

// Σ das vendas ATIVAS, por tamanho — a cancelada não soma.
export function lancadoAtivo(vendas: readonly VendaLigada[]): Quantidades {
  const soma = { ...QUANTIDADES_ZERADAS };
  for (const venda of vendas) {
    if (venda.cancelada) {
      continue;
    }
    soma.p += venda.quantidades.p;
    soma.m += venda.quantidades.m;
    soma.g += venda.quantidades.g;
  }
  return soma;
}

// O que ainda falta cobrar, por tamanho: externas − lançado, nunca negativo.
export function faltaCobrar(externas: Quantidades, lancado: Quantidades): Quantidades {
  return {
    p: Math.max(0, externas.p - lancado.p),
    m: Math.max(0, externas.m - lancado.m),
    g: Math.max(0, externas.g - lancado.g),
  };
}

// Cada tamanho do pedido cabe no que falta. A exigência de ao menos uma peça é de quem chama.
export function cabeNoQueFalta(pedido: Quantidades, falta: Quantidades): boolean {
  return pedido.p <= falta.p && pedido.m <= falta.m && pedido.g <= falta.g;
}

// O primeiro tamanho, na ordem P, M, G, em que as externas novas ficam ABAIXO do já lançado em
// vendas ativas; `null` quando nenhum fica (igual pode; subir é sempre livre).
export function abaixoDoLancado(externasNovas: Quantidades, lancado: Quantidades): Tamanho | null {
  for (const { tamanho, chave } of TAMANHOS_EM_ORDEM) {
    if (externasNovas[chave] < lancado[chave]) {
      return tamanho;
    }
  }
  return null;
}

// A chave de `Quantidades` de um tamanho — para quem precisa ler "o lançado no P".
export function chaveDoTamanho(tamanho: Tamanho): keyof Quantidades {
  return tamanho === "P" ? "p" : tamanho === "M" ? "m" : "g";
}

// ---------------------------------------------------------------------------------------------
// "Sem contagem" no índice (QMC-02, UI-D4 — plano 02). O estado "sem contagem" é PERMANENTE no dado
// (sem linha em `queima_contagens`); esta janela é só da visão PADRÃO da lista do índice, nunca do
// dado: as queimas dos últimos 30 dias civis de Brasília — hoje e os 29 dias anteriores —, no
// máximo 20, a mais recente primeiro. O que fica de fora (além das 20 ou mais antigas) vira a conta
// "e mais N"; o caminho para TODA queima sem contagem é o "Ver todas" (plano 03).
//
// Desempate: duas queimas no MESMO instante ordenam por `id` decrescente — a mesma regra do
// Histórico (`buscarForno`), para a ordem ficar estável entre uma carga e outra.

export const JANELA_SEM_CONTAGEM_DIAS = 30;
export const TETO_DA_LISTA_SEM_CONTAGEM = 20;

// Soma `dias` (pode ser negativo) a um dia civil `YYYY-MM-DD` — aritmética de calendário em UTC
// pura (`Date.UTC` normaliza o dia que transborda o mês ou o ano); nunca lê o relógio.
export function somarDiasCivis(diaCivil: string, dias: number): string {
  const [ano, mes, dia] = diaCivil.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// `diaCivil` chega já convertido para Brasília por quem chama (`diaCivilEmBrasilia`) — é ele, e
// não o instante, que decide se a queima está na janela: 23h59 de hoje − 30 em Brasília (02h59 de
// hoje − 29 em UTC) fica FORA. `totalSemContagem` é a conta de TODAS as queimas sem contagem, dentro
// e fora da janela.
//
// Plano 03 (QMC-02, o item travado "Pular não perde nada"): o modo `"todas"` — o "Ver todas" da
// lista — devolve TODAS as candidatas, sem janela de dias e sem teto (como "a cobrar", UI-D26), na
// mesma ordem, com `maisAntigas = 0`. Sem `modo`, ou `"recentes"`, é a visão padrão acima.
export type ModoSemContagem = "recentes" | "todas";

// O modo vem da URL (`?sem-contagem=todas`): só a string EXATA "todas" vale "todas"; qualquer outra
// coisa — ausente, vazia, outra caixa, repetida — é a visão padrão (T-06.4-44).
export function modoSemContagemDaUrl(valor: string | string[] | undefined): ModoSemContagem {
  return valor === "todas" ? "todas" : "recentes";
}

export function janelaSemContagem<T extends { id: string; ocorridaEm: string; diaCivil: string }>({
  candidatas,
  totalSemContagem,
  hoje,
  modo = "recentes",
}: {
  candidatas: readonly T[];
  totalSemContagem: number;
  hoje: string;
  modo?: ModoSemContagem;
}): { visiveis: T[]; maisAntigas: number } {
  const ordenadas = [...candidatas].sort((a, b) => {
    const porInstante = Date.parse(b.ocorridaEm) - Date.parse(a.ocorridaEm);
    if (porInstante !== 0) {
      return porInstante;
    }
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  if (modo === "todas") {
    return { visiveis: ordenadas, maisAntigas: 0 };
  }
  const inicio = somarDiasCivis(hoje, -(JANELA_SEM_CONTAGEM_DIAS - 1));
  const visiveis = ordenadas
    .filter((queima) => queima.diaCivil >= inicio)
    .slice(0, TETO_DA_LISTA_SEM_CONTAGEM);
  return { visiveis, maisAntigas: Math.max(0, totalSemContagem - visiveis.length) };
}

// ---------------------------------------------------------------------------------------------
// A régua P · M · G (QMC-04, D-03) — lida de `parametros_precificacao` (`queima_regua_p_ate`,
// `queima_regua_m_ate`) na escala do catálogo de parâmetros: cm × 1000 (10 cm = 10000). Nenhum
// número da régua é escrito no código: a folha mostra a régua VIGENTE.
export type Regua = { pAte: number; mAte: number };

// 10000 → "10"; 12500 → "12,5"; 12345 → "12,345" — até três casas, vírgula, sem zero à direita.
export function cmDaRegua(valor: number): string {
  const inteiro = Math.trunc(valor / 1000);
  const resto = Math.abs(valor % 1000);
  if (resto === 0) {
    return String(inteiro);
  }
  return `${inteiro},${String(resto).padStart(3, "0").replace(/0+$/, "")}`;
}

// Os seis números e a caixa iguais — a folha só fecha por Esc ou toque fora quando nada foi mexido
// desde a abertura (UI-D18).
export function mesmaContagem(a: Contagem, b: Contagem): boolean {
  return (
    CHAVES_DOS_CONTADORES.every((chave) => a[chave] === b[chave]) && a.saiuCheio === b.saiuCheio
  );
}

// "3 P · 1 G" — só os tamanhos com quantidade, na ordem P, M, G; tudo zero → "". Usado nos chips do
// Histórico ("internas: 12 P · 9 M") e, nos planos seguintes, nas linhas "a cobrar" e nas vendas.
export function resumoPmg(p: number, m: number, g: number): string {
  const partes: string[] = [];
  if (p > 0) {
    partes.push(`${p} P`);
  }
  if (m > 0) {
    partes.push(`${m} M`);
  }
  if (g > 0) {
    partes.push(`${g} G`);
  }
  return partes.join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 03 — a régua decide o tamanho (QMC-04, D-03). É a ÚNICA fronteira P/M/G do
// sistema: os chips da Produção (abaixo) e qualquer leitura futura passam por aqui. A régua vem em
// cm × 1000 (a escala do catálogo de parâmetros) e a ficha em mm: `mm × 100` é a mesma escala
// (100 mm = 10 cm = 10000), em inteiros, sem ponto flutuante. Maior medida 0 (ficha sem medida) ou
// que não é número → `null` ("sem medida", D-06).
export function tamanhoPelaRegua(maiorMm: number, regua: Regua): Tamanho | null {
  if (!Number.isFinite(maiorMm) || maiorMm <= 0) {
    return null;
  }
  const milesimosDeCm = maiorMm * 100;
  if (milesimosDeCm <= regua.pAte) {
    return "P";
  }
  if (milesimosDeCm <= regua.mAte) {
    return "M";
  }
  return "G";
}

// ---------------------------------------------------------------------------------------------
// Os chips da Produção (QMC-06, D-06) — SÓ LEITURA: as ordens ATIVAS da Produção cuja etapa atual é
// a queima desta folha (`queima1` = biscoito, `queima2` = esmalte; ouro não tem etapa na Produção),
// na ordem do quadro. Cada ordem vira um chip com as peças PENDENTES da etapa atual — a fórmula de
// `fornadasEstimadas` (`lib/producao/forno.ts`): pendentes = feitas − passaram (o `passaram` cortado
// entre 0 e as feitas), repartidas entre as peças na proporção das feitas de cada uma e então POR
// TAMANHO, pela maior medida da ficha e pela régua. A repartição fecha no inteiro pelo MAIOR RESTO,
// com desempate P, M, G, sem medida.

export type EtapaDeQueima = "queima1" | "queima2";

// Uma ordem esperando a queima, como as Queimas a enxergam — o que a consulta lê da Produção.
// `feitas` = quantidade + a mais; `maiorMm` = a maior das três medidas da ficha da peça (0 = sem
// ficha ou sem medida).
export type OrdemEsperando = {
  ordemId: string;
  nome: string;
  etapa: EtapaDeQueima;
  passaram: number;
  pecas: readonly { feitas: number; maiorMm: number }[];
};

export type ChipDaOrdem = {
  ordemId: string;
  nome: string;
  etapa: EtapaDeQueima;
  pendentes: number;
  porTamanho: Record<Tamanho, number>;
  // Peças sem medida na ficha: a folha pergunta o tamanho delas antes de somar (D-06).
  semMedida: number;
};

// Os quatro baldes na ordem do desempate: 0 = P, 1 = M, 2 = G, 3 = sem medida.
function baldeDe(tamanho: Tamanho | null): number {
  return tamanho === null ? 3 : tamanho === "P" ? 0 : tamanho === "M" ? 1 : 2;
}

// Inteiros que somam EXATAMENTE `pendentes`: cada peça entra com `feitas × pendentes ÷ feitasTotal`
// (= feitas − passaram × feitas ÷ feitasTotal), guardado como numerador inteiro para a conta ser
// exata; o piso de cada balde e, para o que falta, o maior resto (empate: a ordem de `BALDES`).
export function chipsDaProducao(
  ordens: readonly OrdemEsperando[],
  regua: Regua,
): ChipDaOrdem[] {
  const chips: ChipDaOrdem[] = [];
  for (const ordem of ordens) {
    const feitasPorPeca = ordem.pecas.map((peca) =>
      Number.isFinite(peca.feitas) ? Math.max(0, Math.trunc(peca.feitas)) : 0,
    );
    const feitasTotal = feitasPorPeca.reduce((total, feitas) => total + feitas, 0);
    if (feitasTotal <= 0) {
      continue;
    }
    const passaramLido = Number.isFinite(ordem.passaram) ? Math.trunc(ordem.passaram) : 0;
    const passaram = Math.min(feitasTotal, Math.max(0, passaramLido));
    const pendentes = feitasTotal - passaram;
    if (pendentes <= 0) {
      continue;
    }

    const numeradores = [0, 0, 0, 0];
    ordem.pecas.forEach((peca, indice) => {
      numeradores[baldeDe(tamanhoPelaRegua(peca.maiorMm, regua))] +=
        feitasPorPeca[indice] * pendentes;
    });
    const inteiros = numeradores.map((numerador) => Math.floor(numerador / feitasTotal));
    let faltam = pendentes - inteiros.reduce((total, valor) => total + valor, 0);
    const porResto = [0, 1, 2, 3].sort(
      (a, b) => (numeradores[b] % feitasTotal) - (numeradores[a] % feitasTotal) || a - b,
    );
    for (const balde of porResto) {
      if (faltam <= 0) {
        break;
      }
      inteiros[balde] += 1;
      faltam -= 1;
    }

    chips.push({
      ordemId: ordem.ordemId,
      nome: ordem.nome,
      etapa: ordem.etapa,
      pendentes,
      porTamanho: { P: inteiros[0], M: inteiros[1], G: inteiros[2] },
      semMedida: inteiros[3],
    });
  }
  return chips;
}

// ---------------------------------------------------------------------------------------------
// "Repetir a última" (QMC-05, D-01, UI-D10): a última fornada CONTADA do MESMO forno e do MESMO tipo,
// pela `ocorridaEm` mais recente (empate: `queimaId` maior), EXCLUINDO a queima aberta na folha —
// corrigindo a mais recente pelo Histórico, vale a anterior a ela. A página pré-carrega as DUAS mais
// recentes por forno + tipo (`lerUltimasContagens`), o bastante para a exclusão da própria funcionar
// sem ida ao servidor. Sem nenhuma → `null` (o botão fica desabilitado com a dica do porquê).
export type ContagemAnterior = {
  queimaId: string;
  fornoId: string;
  tipo: "biscoito" | "esmalte" | "ouro";
  // ISO do instante; `diaCivil` já em Brasília (para a dica "copia Biscoito de 09/12").
  ocorridaEm: string;
  diaCivil: string;
  contagem: Contagem;
};

export function ultimaContagemDoMesmoTipo(
  candidatas: readonly ContagemAnterior[],
  alvo: { fornoId: string; tipo: ContagemAnterior["tipo"]; queimaIdAtual: string },
): ContagemAnterior | null {
  let escolhida: ContagemAnterior | null = null;
  for (const candidata of candidatas) {
    if (
      candidata.fornoId !== alvo.fornoId ||
      candidata.tipo !== alvo.tipo ||
      candidata.queimaId === alvo.queimaIdAtual
    ) {
      continue;
    }
    if (escolhida === null) {
      escolhida = candidata;
      continue;
    }
    const porInstante = Date.parse(candidata.ocorridaEm) - Date.parse(escolhida.ocorridaEm);
    if (porInstante > 0 || (porInstante === 0 && candidata.queimaId > escolhida.queimaId)) {
      escolhida = candidata;
    }
  }
  return escolhida;
}

// Um toque no chip: as pendentes medidas entram nas INTERNAS do tamanho delas; as sem medida, no
// tamanho escolhido na pergunta (`tamanhoDoResto`) — com `null`, ficam de fora (a folha só chama
// assim quando não há peça sem medida). Nunca passa do teto do contador.
export function somarChip(
  contagem: Contagem,
  chip: ChipDaOrdem,
  tamanhoDoResto: Tamanho | null,
): Contagem {
  const soma = (tamanho: Tamanho) =>
    chip.porTamanho[tamanho] + (tamanhoDoResto === tamanho ? chip.semMedida : 0);
  return {
    ...contagem,
    internasP: limitarContador(contagem.internasP + soma("P")),
    internasM: limitarContador(contagem.internasM + soma("M")),
    internasG: limitarContador(contagem.internasG + soma("G")),
  };
}
