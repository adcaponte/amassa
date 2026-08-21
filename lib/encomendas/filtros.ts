// Módulo puro: recebe dados, devolve dados. Zero imports — nem de `lib/encomendas/cronograma.ts`,
// que já calculou a `Situacao` de cada encomenda em relação a "hoje" antes de chegar aqui
// (03-CONTEXT.md D-11: filtro, busca e ordenação rodam no CLIENTE, sobre a lista já carregada).
// `SituacaoDeUrgencia` abaixo é uma redeclaração ESTRUTURAL do `Situacao` de `cronograma.ts` —
// mesma disciplina de `lib/encomendas/gantt.ts`, que duplica a aritmética de calendário em vez
// de importar o irmão. Como TypeScript tipa por estrutura, o `Situacao` real (com campos extras
// por ramo) continua atribuível aqui sem nenhum `import type`.
//
// D-13: a busca varre nome, cliente e descrição de item, ignorando acento e caixa — com
// `normalize("NFD")` + remoção de `\p{Diacritic}` + `toLocaleLowerCase("pt-BR")`. Nunca a função
// de índice funcional do banco documentada em `02-MODELO-DE-DADOS.md` §0 (a armadilha do índice
// não-imutável, que aqui não se aplica porque o filtro roda no navegador sobre a lista já
// carregada).

export type FiltroDeStatus = "todas" | "rascunho" | "em_producao" | "concluida" | "cancelada";
export type OrdenacaoDeEncomendas = "data-inicio" | "urgencia" | "nome";

// Subconjunto estrutural do `Situacao` de `lib/encomendas/cronograma.ts` — só os campos que
// `compararPorUrgencia` precisa por ramo. Um `Situacao` real, com campos a mais em cada ramo,
// continua sendo um valor válido deste tipo (TypeScript não faz checagem de propriedade
// excedente em valores já tipados, só em literais de objeto frescos).
export type SituacaoDeUrgencia =
  | { tipo: "nao-comecou"; diasAteInicio: number }
  | { tipo: "em-etapa-intervalo"; diasAteProxima: number }
  | { tipo: "em-etapa-marco" }
  | { tipo: "ultima-etapa"; diasAteEntrega: number }
  | { tipo: "atrasada"; diasDeAtraso: number }
  | { tipo: "concluida" }
  | { tipo: "cancelada" }
  | { tipo: "sem-etapas" }
  // Fase 04.1 (D-06/D-09): `hoje` cai dentro de um vão de espera antes de um marco — mesma
  // forma de urgência que `em-etapa-intervalo` (contagem de dias até a próxima faixa).
  | { tipo: "em-espera"; diasAteProxima: number };

// Formato mínimo que este módulo precisa de uma encomenda — compatível por estrutura com
// `EncomendaDoIndice` (`components/amassa/encomendas/lista-encomendas.tsx`), sem importar de
// lá. `itens` só precisa da descrição: é o único campo que a busca (D-13) consulta.
export type EncomendaFiltravel = {
  readonly id: string;
  readonly nome: string;
  readonly clienteNome: string | null;
  readonly status: "rascunho" | "em_producao" | "concluida" | "cancelada";
  readonly dataInicio: string;
  readonly itens: readonly { readonly descricao: string }[];
  readonly situacao: SituacaoDeUrgencia;
};

// `\p{Diacritic}` com a bandeira `u` é o que faz «ç» virar «c» DEPOIS da decomposição NFD — sem
// o NFD, o «ç» pré-composto passa intacto pela remoção de diacríticos e a busca por `acucar` não
// acha «açúcar». É exatamente o defeito que ninguém relata como bug: a pessoa digita, não acha,
// e conclui que o sistema não tem o que ela está procurando.
export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

// Monta a cadeia de busca UMA VEZ por encomenda — nome + cliente + todas as descrições de item,
// normalizados e unidos por espaço — e procura o termo normalizado inteiro como subcadeia.
// Termo vazio ou só com espaços é verdadeiro para qualquer encomenda (não filtra nada). O termo
// NÃO é quebrado em palavras: "caneca azul" só acha uma encomenda que tem essa frase inteira em
// algum lugar da cadeia, nunca uma que tem "caneca" e "azul" em itens diferentes — é o
// comportamento menos surpreendente para quem digita uma frase inteira.
export function combina(encomenda: EncomendaFiltravel, termo: string): boolean {
  const termoNormalizado = normalizarParaBusca(termo);
  if (termoNormalizado === "") {
    return true;
  }

  const cadeia = normalizarParaBusca(
    [encomenda.nome, encomenda.clienteNome ?? "", ...encomenda.itens.map((item) => item.descricao)].join(
      " ",
    ),
  );

  return cadeia.includes(termoNormalizado);
}

// Interseção com o status (D-11/adjacency combinam por interseção, nunca substituição) —
// "todas" devolve a lista inteira, sem cópia desnecessária de comportamento (ainda assim uma
// nova array, para nunca mutar `lista`).
export function filtrarPorStatus<T extends EncomendaFiltravel>(
  lista: readonly T[],
  status: FiltroDeStatus,
): T[] {
  if (status === "todas") {
    return [...lista];
  }
  return lista.filter((encomenda) => encomenda.status === status);
}

// Comparador total: só devolve 0 quando os `id`s são iguais — data de início ascendente,
// desempate por nome (`localeCompare('pt-BR')`), depois por id. Mesma disciplina de
// `ordenarParaGantt` (lib/encomendas/gantt.ts), para as duas metades do índice nunca discordarem
// (D-12, padrão).
export function compararPorDataDeInicio(a: EncomendaFiltravel, b: EncomendaFiltravel): number {
  if (a.dataInicio !== b.dataInicio) {
    return a.dataInicio < b.dataInicio ? -1 : 1;
  }

  const porNome = a.nome.localeCompare(b.nome, "pt-BR");
  if (porNome !== 0) {
    return porNome;
  }

  return a.id.localeCompare(b.id);
}

// Comparador total: nome (`localeCompare('pt-BR')`) primeiro, desempatando por data de início e
// depois por id — nunca dois desempates pela mesma coluna.
export function compararPorNome(a: EncomendaFiltravel, b: EncomendaFiltravel): number {
  const porNome = a.nome.localeCompare(b.nome, "pt-BR");
  if (porNome !== 0) {
    return porNome;
  }

  if (a.dataInicio !== b.dataInicio) {
    return a.dataInicio < b.dataInicio ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

// Um único número por `Situacao`, quanto MENOR mais urgente — a régua que `compararPorUrgencia`
// usa. `null` marca "sem próxima etapa" (concluída, cancelada, sem etapas): essas vão sempre
// para o FIM, nunca para o começo, porque não há nada a decidir sobre elas.
//
// Atrasada é a mais urgente de todas — quanto mais dias de atraso, mais urgente — por isso entra
// com um número bem negativo (mais negativo quanto maior o atraso), à frente de qualquer
// proximidade futura (0 ou positiva) das demais situações. Um marco (queima1/queima2/entrega)
// já "está acontecendo agora": mais urgente que qualquer contagem de dias, mas menos que um
// atraso de verdade.
function proximidadeDeUrgencia(situacao: SituacaoDeUrgencia): number | null {
  switch (situacao.tipo) {
    case "atrasada":
      return -1_000_000 - situacao.diasDeAtraso;
    case "em-etapa-marco":
      return 0;
    case "em-etapa-intervalo":
    case "em-espera":
      return situacao.diasAteProxima;
    case "ultima-etapa":
      return situacao.diasAteEntrega;
    case "nao-comecou":
      return situacao.diasAteInicio;
    case "concluida":
    case "cancelada":
    case "sem-etapas":
      return null;
  }
}

// Comparador total: proximidade de urgência ascendente (mais perto primeiro); duas encomendas
// com a mesma proximidade — inclusive as duas `null` — desempatam por `compararPorDataDeInicio`
// (que já é total: data, depois nome, depois id). "Sem próxima etapa" nunca vai para o começo.
export function compararPorUrgencia(a: EncomendaFiltravel, b: EncomendaFiltravel): number {
  const proximidadeA = proximidadeDeUrgencia(a.situacao);
  const proximidadeB = proximidadeDeUrgencia(b.situacao);

  if (proximidadeA === null && proximidadeB === null) {
    return compararPorDataDeInicio(a, b);
  }
  if (proximidadeA === null) {
    return 1;
  }
  if (proximidadeB === null) {
    return -1;
  }
  if (proximidadeA !== proximidadeB) {
    return proximidadeA - proximidadeB;
  }

  return compararPorDataDeInicio(a, b);
}

const COMPARADORES: Record<
  OrdenacaoDeEncomendas,
  (a: EncomendaFiltravel, b: EncomendaFiltravel) => number
> = {
  "data-inicio": compararPorDataDeInicio,
  urgencia: compararPorUrgencia,
  nome: compararPorNome,
};

export type OpcoesDeFiltro = {
  termo: string;
  status: FiltroDeStatus;
  ordenacao: OrdenacaoDeEncomendas;
  // `hoje` não é lido aqui — `situacao` já chega calculada em relação a "hoje" (D-11: o
  // instante nunca é lido do relógio por dentro de um módulo puro). Mantido no formato de
  // entrada para o chamador nunca precisar de dois objetos diferentes (um para `aplicarFiltros`,
  // outro para `calcularJanelaDoHistorico`) e para deixar a porta aberta a um futuro critério de
  // urgência que precise da data corrente sem mudar a assinatura desta função de novo.
  hoje: string;
};

// Interseção das três dimensões (D-11/adjacency): filtra por status, depois por termo de busca,
// depois ordena — cada etapa estreita o resultado da anterior, nenhuma substitui a outra. Uma
// combinação sem resultado devolve lista vazia; quem chama decide o estado "Nada por aqui com
// esse filtro." a partir disso.
export function aplicarFiltros<T extends EncomendaFiltravel>(
  lista: readonly T[],
  opcoes: OpcoesDeFiltro,
): T[] {
  const porStatus = filtrarPorStatus(lista, opcoes.status);
  const porBusca = porStatus.filter((encomenda) => combina(encomenda, opcoes.termo));
  return [...porBusca].sort(COMPARADORES[opcoes.ordenacao]);
}

// A data de corte da janela de histórico (03-UI-SPEC.md "Janela carregada — decisão do dono"):
// doze meses antes de `hoje`, em `YYYY-MM-DD`. `consultas.ts` usa isto no `where` — a `concluida`/
// `cancelada` mais antiga que a data devolvida não vem no carregamento padrão (D-11, o teto que
// impede o conjunto filtrado no cliente de crescer sem limite).
export function calcularJanelaDoHistorico(hoje: string): string {
  const [anoTexto, mesTexto, diaTexto] = hoje.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  const anoDeCorte = ano - 1;
  // Ajusta o dia se o mês de doze meses atrás tiver menos dias que o mês de origem (o único
  // caso possível é 29 de fevereiro de um ano bissexto voltando para um fevereiro comum).
  const diaDeCorte = Math.min(dia, diasNoMes(anoDeCorte, mes));

  return `${String(anoDeCorte).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(diaDeCorte).padStart(2, "0")}`;
}

function diasNoMes(ano: number, mes: number): number {
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return diasPorMes[mes - 1];
}
